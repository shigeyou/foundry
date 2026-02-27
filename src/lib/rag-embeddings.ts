/**
 * RAG 埋め込みベクトル生成ユーティリティ
 *
 * - Azure OpenAI text-embedding-3-small (1536次元)
 * - 16件ずつバッチ処理
 * - Float32 ↔ Base64 エンコード/デコード
 * - コサイン類似度計算
 * - フォールバック: 埋め込みモデル未設定時はキーワードマッチング
 */

const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 16;

// openaiは動的importで遅延ロード（バンドル問題を回避）
let embeddingClient: InstanceType<Awaited<ReturnType<typeof getAzureOpenAI>>> | null = null;

async function getAzureOpenAI() {
  const { AzureOpenAI } = await import("openai");
  return AzureOpenAI;
}

function getEmbeddingDeployment(): string | null {
  return process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || null;
}

export function isEmbeddingAvailable(): boolean {
  return !!(
    getEmbeddingDeployment() &&
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_ENDPOINT
  );
}

async function getEmbeddingClient() {
  if (!embeddingClient) {
    const AzureOpenAI = await getAzureOpenAI();
    embeddingClient = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: "2024-08-01-preview",
    });
  }
  return embeddingClient!;
}

// ─── Float32 ↔ Base64 変換 ───

export function float32ToBase64(vec: number[]): string {
  const buf = Buffer.alloc(vec.length * 4);
  for (let i = 0; i < vec.length; i++) {
    buf.writeFloatLE(vec[i], i * 4);
  }
  return buf.toString("base64");
}

export function base64ToFloat32(b64: string): number[] {
  const buf = Buffer.from(b64, "base64");
  const vec = new Array(buf.length / 4);
  for (let i = 0; i < vec.length; i++) {
    vec[i] = buf.readFloatLE(i * 4);
  }
  return vec;
}

// ─── 埋め込み生成 ───

/**
 * テキスト配列の埋め込みベクトルを生成（16件ずつバッチ処理）
 * 埋め込みモデル未設定時はnull配列を返す
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<(number[] | null)[]> {
  if (!isEmbeddingAvailable()) {
    console.log("[Embeddings] Embedding model not configured, skipping");
    return texts.map(() => null);
  }

  const client = await getEmbeddingClient();
  const deployment = getEmbeddingDeployment()!;
  const results: (number[] | null)[] = new Array(texts.length).fill(null);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    // テキストが空の場合はスキップ
    const validBatch = batch.map(t => t.trim() || " ");

    try {
      const response = await client.embeddings.create({
        model: deployment,
        input: validBatch,
      });

      for (let j = 0; j < response.data.length; j++) {
        results[i + j] = response.data[j].embedding;
      }
    } catch (error) {
      console.error(`[Embeddings] Batch ${i}-${i + batch.length} failed:`, error);
      // バッチ失敗時は個別リトライ
      for (let j = 0; j < validBatch.length; j++) {
        try {
          const single = await client.embeddings.create({
            model: deployment,
            input: [validBatch[j]],
          });
          results[i + j] = single.data[0].embedding;
        } catch (singleErr) {
          console.error(`[Embeddings] Single ${i + j} failed:`, singleErr);
          results[i + j] = null;
        }
      }
    }
  }

  const successCount = results.filter(r => r !== null).length;
  console.log(`[Embeddings] Generated ${successCount}/${texts.length} embeddings`);
  return results;
}

/**
 * 単一テキストの埋め込みベクトルを生成
 */
export async function generateSingleEmbedding(
  text: string,
): Promise<number[] | null> {
  const results = await generateEmbeddings([text]);
  return results[0];
}

// ─── コサイン類似度 ───

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// ─── キーワードフォールバック ───

/**
 * 埋め込みが利用できない場合のキーワードベース類似度
 * クエリの単語がチャンク内に出現する割合で近似
 */
export function keywordSimilarity(query: string, chunkText: string): number {
  // 日本語はスペースで分割しにくいので、N-gram的にキーワードマッチ
  const queryTokens = tokenizeJapanese(query);
  if (queryTokens.length === 0) return 0;

  let matchCount = 0;
  for (const token of queryTokens) {
    if (chunkText.includes(token)) {
      matchCount++;
    }
  }

  return matchCount / queryTokens.length;
}

/**
 * 簡易日本語トークナイズ（2-4文字の重要キーワードを抽出）
 */
function tokenizeJapanese(text: string): string[] {
  const tokens: string[] = [];

  // 漢字2文字以上の連続を抽出
  const kanjiMatches = text.match(/[\u4e00-\u9fff]{2,}/g) || [];
  tokens.push(...kanjiMatches);

  // カタカナ2文字以上の連続を抽出
  const kataMatches = text.match(/[\u30a0-\u30ff]{2,}/g) || [];
  tokens.push(...kataMatches);

  // 英数字2文字以上
  const alphaMatches = text.match(/[a-zA-Z0-9]{2,}/gi) || [];
  tokens.push(...alphaMatches);

  return [...new Set(tokens)];
}

export { EMBEDDING_DIMENSIONS };
