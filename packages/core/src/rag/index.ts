import * as cheerio from 'cheerio';
import type { RAGSource, RAGDocument, RAGContext } from '../types';

// シンプルなメモリキャッシュ
const cache: Map<string, { content: string; timestamp: number }> = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1時間

/**
 * Webコンテンツを取得
 */
export async function fetchWebContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FoundryBot/1.0)',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return '';
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 不要な要素を削除
    $('script, style, nav, footer, header, aside').remove();

    // メインコンテンツを抽出
    const mainContent = $('main, article, .content, #content, body').text();

    // 空白を正規化
    return mainContent
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000); // 10000文字に制限
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return '';
  }
}

/**
 * PDFコンテンツを取得
 */
export async function fetchPDFContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch PDF ${url}: ${response.status}`);
      return '';
    }

    const buffer = await response.arrayBuffer();

    // pdf-parseの動的インポート
    const pdfParse = (await import('pdf-parse')).default as (
      buffer: Buffer
    ) => Promise<{ text: string }>;
    const data = await pdfParse(Buffer.from(buffer));

    return data.text.slice(0, 15000); // 15000文字に制限
  } catch (error) {
    console.error(`Error fetching PDF ${url}:`, error);
    return '';
  }
}

/**
 * キャッシュ付きでコンテンツを取得
 */
export async function fetchWithCache(
  key: string,
  url: string,
  isPDF: boolean
): Promise<string> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }

  const content = isPDF
    ? await fetchPDFContent(url)
    : await fetchWebContent(url);

  cache.set(key, { content, timestamp: Date.now() });
  return content;
}

/**
 * RAGソースからコンテンツを取得
 */
export async function fetchRAGSources(sources: RAGSource[]): Promise<string> {
  const results = await Promise.all(
    sources.map(async (source) => {
      const isPDF = source.type === 'pdf' || source.url.endsWith('.pdf');
      const content = await fetchWithCache(source.name, source.url, isPDF);
      if (content) {
        return `\n\n### ${source.name}:\n${content}`;
      }
      return '';
    })
  );

  return results.filter(Boolean).join('');
}

/**
 * RAGドキュメントをフォーマット
 */
export function formatRAGDocuments(documents: RAGDocument[]): string {
  if (documents.length === 0) {
    return '';
  }

  let result = '\n\n## 登録済みドキュメント:\n';
  for (const doc of documents) {
    const contentPreview = doc.content.slice(0, 8000); // 各ドキュメント8000文字に制限
    result += `\n### ${doc.filename} (${doc.fileType.toUpperCase()}):\n${contentPreview}\n`;
  }

  return result;
}

/**
 * 完全なRAGコンテキストを生成
 */
export async function generateRAGContext(
  sources: RAGSource[],
  documents: RAGDocument[]
): Promise<RAGContext> {
  const webContent = await fetchRAGSources(sources);
  const docContent = formatRAGDocuments(documents);

  return {
    sources,
    documents,
    content: webContent + docContent,
  };
}

/**
 * キャッシュをクリア
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * 特定のキャッシュをクリア
 */
export function clearCacheKey(key: string): void {
  cache.delete(key);
}
