/**
 * Webクローラー（月次自動実行）
 *
 * WebSourceに登録されたURLを起点にBFSクロール
 * - 同一ドメインのリンクを深さ優先で追跡（最大深さ6、最大200ページ/ドメイン）
 * - PDFは直接ダウンロードして内容を抽出
 * - 結果をRAGDocument（scope="web"）として保存
 * - 月次スケジュール（前回から30日以上経過で自動実行）
 */

import { load as cheerioLoad } from "cheerio";
import pdfParse from "pdf-parse";
import { prisma } from "./db";

// ─── 設定 ───────────────────────────────────────────────────────────────────
const MAX_DEPTH = 6;          // クロール最大深さ
const MAX_PAGES_PER_DOMAIN = 200; // ドメインあたり最大ページ数
const REQUEST_DELAY_MS = 500; // リクエスト間隔（サーバー負荷配慮）
const CRAWL_INTERVAL_DAYS = 30; // 月次クロール間隔（日）
const MAX_CONTENT_CHARS = 10000; // ページあたり最大文字数（RAG容量管理）
const FETCH_TIMEOUT_MS = 15000;  // 1リクエストのタイムアウト

// クロール対象外パターン（ナビゲーション・外部リンクなど）
const SKIP_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "svg", "webp", "ico",
  "css", "js", "woff", "woff2", "ttf", "eot",
  "zip", "tar", "gz", "exe", "dmg",
  "mp4", "mp3", "avi", "mov",
  "xml", "rss", "atom",
]);

let crawlRunning = false;

// ─── ユーティリティ ──────────────────────────────────────────────────────────

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

function normalizeUrl(href: string, base: string): string | null {
  try {
    const resolved = new URL(href, base);
    // httpとhttpsのみ
    if (!["http:", "https:"].includes(resolved.protocol)) return null;
    // フラグメント除去
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}

function shouldSkipUrl(url: string): boolean {
  try {
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
    return SKIP_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

function isPdfUrl(url: string): boolean {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FoundryBot/1.0; +https://foundry.internal/bot)",
        "Accept": "text/html,application/pdf,*/*",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

// ─── HTMLパース ──────────────────────────────────────────────────────────────

function extractTextFromHtml(html: string, url: string): { text: string; links: string[] } {
  const $ = cheerioLoad(html);

  // ナビゲーション・フッター・スクリプトを除去
  $("nav, footer, script, style, noscript, header, .navigation, .footer, .menu").remove();

  // メインコンテンツを優先（main, article, .content等）
  let text = "";
  const mainContent = $("main, article, [role='main'], .content, .main-content, #content, #main").first();
  if (mainContent.length) {
    text = mainContent.text();
  } else {
    text = $("body").text();
  }

  // ページタイトル付与
  const title = $("title").text().trim();
  if (title) text = `タイトル: ${title}\n\n${text}`;

  // 空白・改行の正規化
  text = text
    .replace(/\s{3,}/g, "\n\n")
    .replace(/　/g, " ")
    .trim()
    .slice(0, MAX_CONTENT_CHARS);

  // 同一ドメインリンク収集
  const domain = getDomain(url);
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const normalized = normalizeUrl(href, url);
    if (normalized && getDomain(normalized) === domain && !shouldSkipUrl(normalized)) {
      links.push(normalized);
    }
  });

  return { text, links };
}

// ─── PDFパース ───────────────────────────────────────────────────────────────

async function extractTextFromPdf(buffer: Buffer, url: string): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    const title = url.split("/").pop() || url;
    return `PDF: ${title}\nURL: ${url}\n\n${data.text.slice(0, MAX_CONTENT_CHARS)}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    throw new Error(`PDF解析失敗: ${msg}`);
  }
}

// ─── RAG保存 ─────────────────────────────────────────────────────────────────

async function upsertRagDocument(url: string, content: string, fileType: string): Promise<boolean> {
  if (!content.trim()) return false;

  // URLをfilenameとして使用（既存ドキュメントを識別）
  const existing = await prisma.rAGDocument.findFirst({
    where: { filename: url, scope: "web" },
    select: { id: true, content: true },
  });

  if (existing) {
    // 内容が変わっていれば更新
    if (existing.content === content) return false;
    await prisma.rAGDocument.update({
      where: { id: existing.id },
      data: { content, fileType, updatedAt: new Date() },
    });
  } else {
    await prisma.rAGDocument.create({
      data: {
        id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        filename: url,
        fileType,
        content,
        scope: "web",
        metadata: JSON.stringify({ source: "web-crawler", crawledAt: new Date().toISOString() }),
      },
    });
  }

  return true;
}

// ─── BFSクローラー ────────────────────────────────────────────────────────────

async function crawlDomain(seedUrl: string, logId: string): Promise<{ pagesVisited: number; docsUpdated: number; docsDeleted: number; errors: string[] }> {
  const domain = getDomain(seedUrl);
  const visited = new Set<string>();
  const successfulUrls = new Set<string>();
  const notFoundUrls = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: seedUrl, depth: 0 }];
  let pagesVisited = 0;
  let docsUpdated = 0;
  let docsDeleted = 0;
  const errors: string[] = [];

  console.log(`[WebCrawler] Starting crawl: ${domain}`);

  while (queue.length > 0 && visited.size < MAX_PAGES_PER_DOMAIN) {
    const item = queue.shift()!;
    const { url, depth } = item;

    if (visited.has(url) || depth > MAX_DEPTH) continue;
    visited.add(url);

    try {
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));

      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        console.warn(`[WebCrawler] ${res.status} ${url}`);
        // 404はページが削除されたとみなす
        if (res.status === 404) notFoundUrls.add(url);
        continue;
      }

      pagesVisited++;

      if (isPdfUrl(url)) {
        // PDFページ
        const buffer = Buffer.from(await res.arrayBuffer());
        const text = await extractTextFromPdf(buffer, url);
        const updated = await upsertRagDocument(url, text, "pdf");
        if (updated) docsUpdated++;
        successfulUrls.add(url);

      } else {
        // HTMLページ
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) continue;

        const html = await res.text();
        const { text, links } = extractTextFromHtml(html, url);

        const updated = await upsertRagDocument(url, text, "html");
        if (updated) docsUpdated++;
        successfulUrls.add(url);

        // リンクをキューに追加（深さ制限内）
        if (depth < MAX_DEPTH) {
          for (const link of links) {
            if (!visited.has(link)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      }

      // 10ページ毎にログ更新
      if (pagesVisited % 10 === 0) {
        await (prisma as unknown as { webCrawlLog: { update: (args: { where: { id: string }; data: { pagesVisited: number; docsUpdated: number } }) => Promise<unknown> } }).webCrawlLog.update({
          where: { id: logId },
          data: { pagesVisited, docsUpdated },
        });
        console.log(`[WebCrawler] ${domain}: ${pagesVisited} pages, ${docsUpdated} updated`);
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.warn(`[WebCrawler] Error at ${url}: ${msg}`);
      errors.push(`${url}: ${msg}`);
    }
  }

  // 404が確認されたURLのRAGドキュメントを削除（ページが消えたとみなす）
  if (notFoundUrls.size > 0) {
    for (const deadUrl of notFoundUrls) {
      const deleted = await prisma.rAGDocument.deleteMany({
        where: { filename: deadUrl, scope: "web" },
      });
      if (deleted.count > 0) {
        docsDeleted += deleted.count;
        console.log(`[WebCrawler] Deleted stale doc: ${deadUrl}`);
      }
    }
  }

  console.log(`[WebCrawler] Done: ${domain} - ${pagesVisited} pages, ${docsUpdated} updated, ${docsDeleted} deleted, ${errors.length} errors`);
  return { pagesVisited, docsUpdated, docsDeleted, errors };
}

// ─── メインクロール処理 ───────────────────────────────────────────────────────

export async function runWebCrawl(): Promise<void> {
  if (crawlRunning) {
    console.log("[WebCrawler] Already running, skipping");
    return;
  }
  crawlRunning = true;

  // ログ作成
  const log = await (prisma as unknown as { webCrawlLog: { create: (args: { data: { id: string; status: string } }) => Promise<{ id: string }> } }).webCrawlLog.create({
    data: {
      id: `crawl-${Date.now()}`,
      status: "running",
    },
  });

  const allErrors: string[] = [];
  let totalPages = 0;
  let totalDocs = 0;
  let totalDeleted = 0;

  try {
    const webSources = await prisma.webSource.findMany();

    if (webSources.length === 0) {
      console.log("[WebCrawler] No web sources registered");
      await (prisma as unknown as { webCrawlLog: { update: (args: { where: { id: string }; data: object }) => Promise<unknown> } }).webCrawlLog.update({
        where: { id: log.id },
        data: { status: "completed", completedAt: new Date(), errors: JSON.stringify(["No web sources"]) },
      });
      return;
    }

    console.log(`[WebCrawler] Starting monthly crawl for ${webSources.length} sources`);

    for (const source of webSources) {
      try {
        const { pagesVisited, docsUpdated, docsDeleted, errors } = await crawlDomain(source.url, log.id);
        totalPages += pagesVisited;
        totalDocs += docsUpdated;
        totalDeleted += docsDeleted;
        allErrors.push(...errors.slice(0, 10)); // 最大10件/ドメイン
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown";
        allErrors.push(`${source.url}: ${msg}`);
      }
    }

    // 完了
    await (prisma as unknown as { webCrawlLog: { update: (args: { where: { id: string }; data: object }) => Promise<unknown> } }).webCrawlLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        pagesVisited: totalPages,
        docsUpdated: totalDocs,
        errors: allErrors.length > 0 ? JSON.stringify(allErrors) : null,
      },
    });

    console.log(`[WebCrawler] Monthly crawl completed: ${totalPages} pages, ${totalDocs} updated, ${totalDeleted} deleted`);

  } catch (err) {
    console.error("[WebCrawler] Fatal error:", err);
    await (prisma as unknown as { webCrawlLog: { update: (args: { where: { id: string }; data: object }) => Promise<unknown> } }).webCrawlLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errors: JSON.stringify([err instanceof Error ? err.message : "Unknown"]),
      },
    });
  } finally {
    crawlRunning = false;
  }
}

// ─── 月次スケジューラー ───────────────────────────────────────────────────────

let schedulerStarted = false;

export async function startWebCrawlScheduler(): Promise<void> {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const checkAndRun = async () => {
    try {
      // 最後のクロールを確認
      const lastLog = await (prisma as unknown as { webCrawlLog: { findFirst: (args: { orderBy: { startedAt: string }; select: { startedAt: boolean; status: boolean } }) => Promise<{ startedAt: Date; status: string } | null> } }).webCrawlLog.findFirst({
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, status: true },
      });

      const now = new Date();
      const daysSinceLast = lastLog
        ? (now.getTime() - new Date(lastLog.startedAt).getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      if (!lastLog) {
        console.log("[WebCrawler] 初回クロールを開始します");
        void runWebCrawl();
      } else if (daysSinceLast >= CRAWL_INTERVAL_DAYS) {
        console.log(`[WebCrawler] ${Math.floor(daysSinceLast)}日経過 - 月次クロールを開始します`);
        void runWebCrawl();
      } else {
        console.log(`[WebCrawler] 前回クロールから${Math.floor(daysSinceLast)}日 - 次回まであと${Math.ceil(CRAWL_INTERVAL_DAYS - daysSinceLast)}日`);
      }
    } catch (err) {
      console.error("[WebCrawler] Scheduler error:", err);
    }
  };

  // 起動時に即座に確認
  await checkAndRun();

  // 1日ごとに確認（サーバー再起動に対応）
  setInterval(checkAndRun, 24 * 60 * 60 * 1000);
}
