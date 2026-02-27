/**
 * RAG 意味検索ユーティリティ
 *
 * 1. SQLフィルタ: scope, docType, deptIds でチャンクを絞り込み
 * 2. クエリ埋め込み: queryを埋め込みベクトル化
 * 3. コサイン類似度: 全フィルタ済みチャンクとの類似度を計算
 * 4. ブースト: 予算ドキュメントに1.3倍、部門一致に1.2倍
 * 5. TopK選択: 類似度順にmaxChars以内で返却
 * 6. 5分間キャッシュ: 埋め込みインデックスをメモリにキャッシュ
 */

import { prisma } from "./db";
import {
  isEmbeddingAvailable,
  base64ToFloat32,
  cosineSimilarity,
  keywordSimilarity,
  generateSingleEmbedding,
} from "./rag-embeddings";

export interface RetrievalOptions {
  query: string;
  scope?: string[];
  deptIds?: string[];
  docTypes?: string[];
  topK?: number;
  maxChars?: number;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  filename: string;
  score: number;
  docType: string | null;
  deptIds: string[];
  chunkIndex: number;
}

interface CachedIndex {
  chunks: Array<{
    id: string;
    content: string;
    embedding: number[] | null;
    filename: string;
    scope: string;
    docType: string | null;
    deptIds: string[];
    tags: string[];
    chunkIndex: number;
    charCount: number;
  }>;
  timestamp: number;
}

// 5分間キャッシュ
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedIndex: CachedIndex | null = null;

/**
 * キャッシュを無効化（チャンク更新後に呼ぶ）
 */
export function invalidateRetrievalCache(): void {
  cachedIndex = null;
}

/**
 * チャンクインデックスをロード（キャッシュあり）
 */
async function loadIndex(): Promise<CachedIndex["chunks"]> {
  const now = Date.now();
  if (cachedIndex && (now - cachedIndex.timestamp) < CACHE_TTL_MS) {
    return cachedIndex.chunks;
  }

  const dbChunks = await prisma.rAGChunk.findMany({
    select: {
      id: true,
      content: true,
      embedding: true,
      filename: true,
      scope: true,
      docType: true,
      deptIds: true,
      tags: true,
      chunkIndex: true,
      charCount: true,
    },
  });

  const chunks = dbChunks.map(c => ({
    ...c,
    embedding: c.embedding ? base64ToFloat32(c.embedding) : null,
    deptIds: c.deptIds ? JSON.parse(c.deptIds) as string[] : [],
    tags: c.tags ? JSON.parse(c.tags) as string[] : [],
  }));

  cachedIndex = { chunks, timestamp: now };
  console.log(`[RAG Retrieval] Index loaded: ${chunks.length} chunks, ${chunks.filter(c => c.embedding).length} with embeddings`);
  return chunks;
}

/**
 * 関連チャンクを検索して返す
 */
export async function retrieveRelevantChunks(
  options: RetrievalOptions,
): Promise<RetrievedChunk[]> {
  const {
    query,
    scope = ["shared"],
    deptIds,
    docTypes,
    topK = 20,
    maxChars = 15000,
  } = options;

  const allChunks = await loadIndex();

  // 1. SQLフィルタ（インメモリ）
  let filtered = allChunks.filter(c => scope.includes(c.scope));

  if (docTypes && docTypes.length > 0) {
    filtered = filtered.filter(c => c.docType && docTypes.includes(c.docType));
  }

  if (deptIds && deptIds.length > 0) {
    // deptIdsフィルタ: "all" を含むチャンクか、指定部門を含むチャンク
    filtered = filtered.filter(c =>
      c.deptIds.includes("all") ||
      c.deptIds.some(d => deptIds.includes(d))
    );
  }

  if (filtered.length === 0) {
    console.log(`[RAG Retrieval] No chunks after filter (scope=${scope}, deptIds=${deptIds}, docTypes=${docTypes})`);
    return [];
  }

  // 2. スコアリング
  const useEmbeddings = isEmbeddingAvailable() && filtered.some(c => c.embedding);
  let queryEmbedding: number[] | null = null;

  if (useEmbeddings) {
    queryEmbedding = await generateSingleEmbedding(query);
  }

  const scored = filtered.map(chunk => {
    let score: number;

    if (queryEmbedding && chunk.embedding) {
      // ベクトル類似度
      score = cosineSimilarity(queryEmbedding, chunk.embedding);
    } else {
      // キーワードフォールバック
      score = keywordSimilarity(query, chunk.content);
    }

    // 3. ブースト
    // 予算ドキュメント: 1.3倍
    if (chunk.docType === "budget") {
      score *= 1.3;
    }

    // 部門一致: 1.2倍
    if (deptIds && deptIds.length > 0) {
      const hasDeptMatch = chunk.deptIds.some(d => deptIds.includes(d));
      if (hasDeptMatch) {
        score *= 1.2;
      }
    }

    return { chunk, score };
  });

  // 4. スコア順にソート
  scored.sort((a, b) => b.score - a.score);

  // 5. TopK & maxChars制限
  const results: RetrievedChunk[] = [];
  let totalChars = 0;

  for (const { chunk, score } of scored) {
    if (results.length >= topK) break;
    if (totalChars + chunk.charCount > maxChars) {
      // まだ1つも結果がない場合は少なくとも1つは返す
      if (results.length === 0) {
        results.push({
          id: chunk.id,
          content: chunk.content.slice(0, maxChars),
          filename: chunk.filename,
          score,
          docType: chunk.docType,
          deptIds: chunk.deptIds,
          chunkIndex: chunk.chunkIndex,
        });
        break;
      }
      continue;
    }

    results.push({
      id: chunk.id,
      content: chunk.content,
      filename: chunk.filename,
      score,
      docType: chunk.docType,
      deptIds: chunk.deptIds,
      chunkIndex: chunk.chunkIndex,
    });
    totalChars += chunk.charCount;
  }

  console.log(`[RAG Retrieval] query="${query.slice(0, 50)}..." → ${results.length} chunks (${totalChars} chars), mode=${useEmbeddings ? "embedding" : "keyword"}`);
  return results;
}

/**
 * 検索結果をプロンプト用テキストにフォーマット
 */
export function formatChunksForPrompt(
  chunks: RetrievedChunk[],
  header?: string,
): string {
  if (chunks.length === 0) return "";

  let text = header ? `## ${header}\n\n` : "";

  // ファイル名でグルーピングして表示
  const byFile = new Map<string, RetrievedChunk[]>();
  for (const chunk of chunks) {
    const existing = byFile.get(chunk.filename) || [];
    existing.push(chunk);
    byFile.set(chunk.filename, existing);
  }

  for (const [filename, fileChunks] of byFile) {
    // チャンクインデックス順にソート
    fileChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    text += `### ${filename}\n`;
    text += fileChunks.map(c => c.content).join("\n\n");
    text += "\n\n";
  }

  return text;
}
