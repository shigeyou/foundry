/**
 * RAG チャンク分割ユーティリティ
 *
 * 段落ベース分割（\n\n、Markdownヘッダ ##/###、スライドマーカー）
 * 最大1500文字/チャンク、最小100文字（小さすぎるものは隣接チャンクに結合）
 * 150文字オーバーラップ（境界のコンテキスト保持）
 * メタデータ自動抽出: deptIds, docType, tags
 */

const MAX_CHUNK_CHARS = 1500;
const MIN_CHUNK_CHARS = 100;
const OVERLAP_CHARS = 150;

// 部門名 → 部門ID マッピング
const DEPT_KEYWORDS: Record<string, string[]> = {
  "planning": ["総合企画", "企画部", "経営企画"],
  "hr": ["人事", "総務", "人材"],
  "finance": ["経理", "財務", "会計"],
  "maritime-tech": ["海洋技術", "港湾コンサル", "交通流解析"],
  "simulator": ["シミュレータ技術", "シミュレーター技術"],
  "training": ["海技訓練", "操船訓練", "機関訓練"],
  "cable": ["ケーブル船", "海底ケーブル"],
  "offshore-training": ["オフショア船訓練", "DP訓練", "DPコース"],
  "ocean": ["海洋事業", "研究船", "観測船"],
  "wind": ["洋上風力", "風力発電", "O&M"],
  "onsite": ["オンサイト", "技術者派遣", "艤装"],
  "maritime-ops": ["海事業務", "JG検査", "GC発給", "LC発給"],
  "newbuild": ["新造船", "建造監理", "PM事業"],
};

// docType 推定キーワード
const DOC_TYPE_PATTERNS: Array<{ type: string; keywords: string[] }> = [
  { type: "budget", keywords: ["予算", "P/L", "損益", "営業利益", "売上", "FY2", "収支", "財務"] },
  { type: "survey", keywords: ["エンゲージメント", "サーベイ", "従業員満足", "ES調査", "組織診断", "職場環境", "engagement"] },
  { type: "strategy", keywords: ["事業計画", "中期計画", "経営戦略", "ビジョン", "CDIO", "方針"] },
  { type: "org", keywords: ["組織図", "組織体制", "人員構成", "配置"] },
];

// 重要キーワード（タグ抽出用）
const TAG_KEYWORDS = [
  "予算", "FY25", "FY26", "FY27", "営業利益", "売上",
  "エンゲージメント", "離職", "採用", "育成", "研修",
  "DX", "AI", "RPA", "デジタル",
  "安全", "品質", "コンプライアンス",
  "GX", "脱炭素", "サステナビリティ",
  "M&A", "アライアンス", "シナジー",
  "海洋", "船舶", "港湾", "洋上風力",
  "赤字", "黒字", "改善", "課題",
];

export interface ChunkMetadata {
  deptIds: string[];
  docType: string;
  tags: string[];
}

export interface RawChunk {
  content: string;
  chunkIndex: number;
  charCount: number;
  tokenEstimate: number;
  metadata: ChunkMetadata;
}

/**
 * ドキュメントをチャンク分割する
 */
export function chunkDocument(
  content: string,
  filename: string,
): RawChunk[] {
  // 1. 段落分割
  const segments = splitIntoSegments(content);

  // 2. セグメントをMAX_CHUNK_CHARS以内のチャンクに結合/分割
  const rawChunks = mergeSegments(segments);

  // 3. オーバーラップ追加
  const overlappedChunks = addOverlap(rawChunks);

  // 4. メタデータ抽出
  const filenameAndContent = filename + " " + content.slice(0, 2000);
  const globalMeta = extractMetadata(filenameAndContent, filename);

  return overlappedChunks.map((text, idx) => {
    const chunkMeta = extractMetadata(text, filename);
    // グローバルメタとチャンクメタをマージ
    const mergedDeptIds = [...new Set([...globalMeta.deptIds, ...chunkMeta.deptIds])];
    const mergedTags = [...new Set([...globalMeta.tags, ...chunkMeta.tags])];

    return {
      content: text,
      chunkIndex: idx,
      charCount: text.length,
      tokenEstimate: estimateTokens(text),
      metadata: {
        deptIds: mergedDeptIds.length > 0 ? mergedDeptIds : ["all"],
        docType: chunkMeta.docType || globalMeta.docType || "general",
        tags: mergedTags.slice(0, 10), // 最大10タグ
      },
    };
  });
}

/**
 * テキストを意味的な段落に分割
 */
function splitIntoSegments(text: string): string[] {
  // スライドマーカー、Markdownヘッダ、空行で分割
  const splitPattern = /(?=\[スライド\d+\])|(?=^#{2,3}\s)/m;
  const paragraphSplit = text.split(/\n\n+/);

  const segments: string[] = [];
  for (const para of paragraphSplit) {
    // さらにMarkdownヘッダ/スライドマーカーで分割
    const subSegments = para.split(splitPattern).filter(s => s.trim().length > 0);
    segments.push(...subSegments);
  }

  return segments.filter(s => s.trim().length > 0);
}

/**
 * セグメントをMAX_CHUNK_CHARS以内のチャンクに結合
 * MIN_CHUNK_CHARS未満のセグメントは隣接チャンクに結合
 */
function mergeSegments(segments: string[]): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    // 現在のバッファ + セグメントがMAX以内なら結合
    if (current.length + trimmed.length + 1 <= MAX_CHUNK_CHARS) {
      current = current ? current + "\n\n" + trimmed : trimmed;
    } else {
      // 現在のバッファを確定
      if (current.length >= MIN_CHUNK_CHARS) {
        chunks.push(current);
      } else if (chunks.length > 0) {
        // 小さすぎる場合は前のチャンクに結合
        chunks[chunks.length - 1] += "\n\n" + current;
      } else if (current.length > 0) {
        chunks.push(current);
      }

      // セグメント自体がMAXを超える場合は文字数で強制分割
      if (trimmed.length > MAX_CHUNK_CHARS) {
        const subChunks = forceChunkByChars(trimmed);
        // 最後のサブチャンクは次のcurrentに
        current = subChunks.pop() || "";
        chunks.push(...subChunks);
      } else {
        current = trimmed;
      }
    }
  }

  // 残りを確定
  if (current.length >= MIN_CHUNK_CHARS) {
    chunks.push(current);
  } else if (current.length > 0 && chunks.length > 0) {
    chunks[chunks.length - 1] += "\n\n" + current;
  } else if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * 長すぎるテキストを文字数で強制分割
 */
function forceChunkByChars(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + MAX_CHUNK_CHARS;
    if (end < text.length) {
      // 句読点・改行で切れ目を探す
      const searchStart = Math.max(start + MAX_CHUNK_CHARS - 200, start);
      const slice = text.slice(searchStart, end);
      const breakIdx = Math.max(
        slice.lastIndexOf("\n"),
        slice.lastIndexOf("。"),
        slice.lastIndexOf("．"),
        slice.lastIndexOf(". "),
      );
      if (breakIdx > 0) {
        end = searchStart + breakIdx + 1;
      }
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(c => c.length > 0);
}

/**
 * チャンク間にオーバーラップを追加
 */
function addOverlap(chunks: string[]): string[] {
  if (chunks.length <= 1) return chunks;

  return chunks.map((chunk, idx) => {
    if (idx === 0) return chunk;
    // 前のチャンクの末尾をオーバーラップとして先頭に付与
    const prev = chunks[idx - 1];
    const overlapText = prev.slice(-OVERLAP_CHARS);
    return overlapText + "\n" + chunk;
  });
}

/**
 * テキストからメタデータを抽出
 */
function extractMetadata(text: string, filename: string): ChunkMetadata {
  const combined = filename + " " + text;

  // deptIds 推定
  const deptIds: string[] = [];
  for (const [deptId, keywords] of Object.entries(DEPT_KEYWORDS)) {
    if (keywords.some(kw => combined.includes(kw))) {
      deptIds.push(deptId);
    }
  }

  // docType 推定
  let docType = "general";
  let maxMatches = 0;
  for (const pattern of DOC_TYPE_PATTERNS) {
    const matches = pattern.keywords.filter(kw => combined.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      docType = pattern.type;
    }
  }
  // 少なくとも2つのキーワードがマッチしないとgeneralのまま
  if (maxMatches < 2) docType = "general";

  // tags 抽出
  const tags = TAG_KEYWORDS.filter(kw => combined.includes(kw));

  return { deptIds, docType, tags };
}

/**
 * トークン数を推定（日本語1文字≈1.5トークン、英語1文字≈0.3トークン）
 */
function estimateTokens(text: string): number {
  const jpChars = (text.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length;
  const otherChars = text.length - jpChars;
  return Math.ceil(jpChars * 1.5 + otherChars * 0.3);
}
