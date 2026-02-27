/**
 * RAG インジェストパイプライン
 *
 * ドキュメント → チャンク分割 → 埋め込み生成 → DB保存
 * auto-ingest.ts / RAG API / instrumentation.ts から呼ばれる
 */

import { prisma } from "./db";
import { chunkDocument } from "./rag-chunker";
import { generateEmbeddings, float32ToBase64, isEmbeddingAvailable } from "./rag-embeddings";
import { invalidateRetrievalCache } from "./rag-retrieval";

interface ProcessResult {
  documentId: string;
  filename: string;
  chunksCreated: number;
  embeddingsGenerated: number;
  error?: string;
}

/**
 * 単一ドキュメントをチャンク化＋埋め込み生成してDBに保存
 */
export async function processDocument(documentId: string): Promise<ProcessResult> {
  const doc = await prisma.rAGDocument.findUnique({
    where: { id: documentId },
  });

  if (!doc) {
    return { documentId, filename: "unknown", chunksCreated: 0, embeddingsGenerated: 0, error: "Document not found" };
  }

  try {
    // 1. 既存チャンクを削除
    await prisma.rAGChunk.deleteMany({
      where: { documentId },
    });

    // 2. チャンク分割
    const rawChunks = chunkDocument(doc.content, doc.filename);

    if (rawChunks.length === 0) {
      console.log(`[Ingest] ${doc.filename}: No chunks generated (content too short?)`);
      return { documentId, filename: doc.filename, chunksCreated: 0, embeddingsGenerated: 0 };
    }

    // 3. 埋め込み生成
    const texts = rawChunks.map(c => c.content);
    const embeddings = await generateEmbeddings(texts);

    // 4. DB保存
    const chunkData = rawChunks.map((chunk, idx) => ({
      id: `chunk-${documentId}-${chunk.chunkIndex}-${Date.now()}`,
      documentId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      embedding: embeddings[idx] ? float32ToBase64(embeddings[idx]!) : null,
      charCount: chunk.charCount,
      tokenEstimate: chunk.tokenEstimate,
      filename: doc.filename,
      scope: doc.scope,
      tags: JSON.stringify(chunk.metadata.tags),
      deptIds: JSON.stringify(chunk.metadata.deptIds),
      docType: chunk.metadata.docType,
    }));

    // バッチ作成（SQLiteの変数上限対策で50件ずつ）
    for (let i = 0; i < chunkData.length; i += 50) {
      const batch = chunkData.slice(i, i + 50);
      await prisma.rAGChunk.createMany({ data: batch });
    }

    const embCount = embeddings.filter(e => e !== null).length;
    console.log(`[Ingest] ${doc.filename}: ${rawChunks.length} chunks, ${embCount} embeddings`);

    // キャッシュ無効化
    invalidateRetrievalCache();

    return {
      documentId,
      filename: doc.filename,
      chunksCreated: rawChunks.length,
      embeddingsGenerated: embCount,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Ingest] ${doc.filename}: Error - ${msg}`);
    return {
      documentId,
      filename: doc.filename,
      chunksCreated: 0,
      embeddingsGenerated: 0,
      error: msg,
    };
  }
}

/**
 * 全ドキュメントを一括チャンク化＋埋め込み生成
 * instrumentation.ts の初回シード後、または reprocess API から呼ばれる
 */
export async function processAllDocuments(): Promise<{
  total: number;
  success: number;
  failed: number;
  results: ProcessResult[];
}> {
  const docs = await prisma.rAGDocument.findMany({
    select: { id: true, filename: true },
  });

  console.log(`[Ingest] Processing all ${docs.length} documents...`);

  const results: ProcessResult[] = [];
  let success = 0;
  let failed = 0;

  // 並列度3で処理（API制限を考慮）
  const concurrency = 3;
  for (let i = 0; i < docs.length; i += concurrency) {
    const batch = docs.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(doc => processDocument(doc.id)),
    );

    for (const r of batchResults) {
      results.push(r);
      if (r.error) {
        failed++;
      } else {
        success++;
      }
    }

    // 進捗ログ
    if ((i + concurrency) % 15 === 0 || i + concurrency >= docs.length) {
      console.log(`[Ingest] Progress: ${Math.min(i + concurrency, docs.length)}/${docs.length}`);
    }
  }

  console.log(`[Ingest] Complete: ${success} success, ${failed} failed out of ${docs.length} documents`);

  // 最終統計
  const chunkCount = await prisma.rAGChunk.count();
  const embeddedCount = await prisma.rAGChunk.count({ where: { embedding: { not: null } } });
  console.log(`[Ingest] Total chunks in DB: ${chunkCount}, with embeddings: ${embeddedCount}`);

  if (!isEmbeddingAvailable()) {
    console.log(`[Ingest] ⚠ Embedding model not configured (AZURE_OPENAI_EMBEDDING_DEPLOYMENT). Using keyword fallback.`);
  }

  return { total: docs.length, success, failed, results };
}
