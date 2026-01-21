import * as cheerio from "cheerio";
import { prisma } from "./db";

export const DEFAULT_RAG_SOURCES = {
  company: {
    name: "MOL Maritex（自社）",
    url: "https://www.mol-maritex.co.jp/",
  },
  parent: {
    name: "商船三井（親会社）",
    url: "https://www.mol.co.jp/",
  },
  parentDX: {
    name: "MOLグループDXの取組み",
    url: "https://www.mol.co.jp/sustainability/innovation/dx/pdf/mol_group_digital_transformation_initiatives.pdf",
  },
};

// Simple in-memory cache
const cache: Map<string, { content: string; timestamp: number }> = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchWebContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KachisujiBot/1.0)",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return "";
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove scripts, styles, nav, footer
    $("script, style, nav, footer, header, aside").remove();

    // Extract main content
    const mainContent = $("main, article, .content, #content, body").text();

    // Clean up whitespace
    return mainContent
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000); // Limit to 10k chars
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return "";
  }
}

async function fetchPDFContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch PDF ${url}: ${response.status}`);
      return "";
    }

    const buffer = await response.arrayBuffer();

    // Dynamic import for pdf-parse
    const pdfParse = (await import("pdf-parse")).default as (buffer: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(Buffer.from(buffer));

    return data.text.slice(0, 15000); // Limit to 15k chars
  } catch (error) {
    console.error(`Error fetching PDF ${url}:`, error);
    return "";
  }
}

async function fetchWithCache(
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

export async function generateRAGContext(): Promise<string> {
  // Fetch web content and DB documents in parallel
  const [webResults, ragDocuments] = await Promise.all([
    Promise.all([
      fetchWithCache("company", DEFAULT_RAG_SOURCES.company.url, false),
      fetchWithCache("parent", DEFAULT_RAG_SOURCES.parent.url, false),
      fetchWithCache("parentDX", DEFAULT_RAG_SOURCES.parentDX.url, true),
    ]),
    prisma.rAGDocument.findMany({
      select: {
        filename: true,
        fileType: true,
        content: true,
      },
    }),
  ]);

  const [companyContent, parentContent, dxContent] = webResults;

  let context = "";

  // Add web content
  if (companyContent) {
    context += `\n\n### ${DEFAULT_RAG_SOURCES.company.name}のウェブサイト情報:\n${companyContent}`;
  }

  if (parentContent) {
    context += `\n\n### ${DEFAULT_RAG_SOURCES.parent.name}のウェブサイト情報:\n${parentContent}`;
  }

  if (dxContent) {
    context += `\n\n### ${DEFAULT_RAG_SOURCES.parentDX.name}（PDF）:\n${dxContent}`;
  }

  // Add RAG documents from database
  if (ragDocuments.length > 0) {
    context += "\n\n## 登録済みドキュメント:\n";
    for (const doc of ragDocuments) {
      const contentPreview = doc.content.slice(0, 8000); // Limit each doc to 8k chars
      context += `\n### ${doc.filename} (${doc.fileType.toUpperCase()}):\n${contentPreview}\n`;
    }
  }

  return context;
}
