/**
 * RAG自動インジェスト（マニフェスト+ハッシュ方式）
 *
 * 検知: fs.watch（即時）+ 5分ポーリング（フォールバック）
 * 差分: SHA-256ハッシュで内容変更を正確に検出
 * 同期: 新規→create / 変更→update / 削除→delete
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import { parse as csvParse } from "csv-parse/sync";
import { prisma } from "./db";

// 設定
const SUPPORTED_TYPES = ["pdf", "txt", "md", "json", "doc", "docx", "csv", "pptx", "msg", "eml", "urls"];
const INGEST_SOURCE_DIR = process.env.INGEST_SOURCE_DIR || "C:\\Dev\\kaede_ver10\\agent_docs\\ingest_files";
const MANIFEST_FILENAME = "_ingest_manifest.json";
const DEBOUNCE_MS = parseInt(process.env.INGEST_DEBOUNCE_MS || "5000", 10);
const POLL_INTERVAL_MS = parseInt(process.env.INGEST_POLL_INTERVAL_MS || "300000", 10); // 5分

// 状態
let watcherStarted = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false; // 排他制御

// ─── マニフェスト管理 ───

type Manifest = Record<string, string>; // { filename: "sha256:xxx" }

function getManifestPath(): string {
  return path.join(INGEST_SOURCE_DIR, MANIFEST_FILENAME);
}

function loadManifest(): Manifest {
  const p = getManifestPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    console.warn("[Auto-Ingest] マニフェスト読み込み失敗、初期化します");
    return {};
  }
}

function saveManifest(manifest: Manifest): void {
  const p = getManifestPath();
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2), "utf-8");
  fs.renameSync(tmp, p); // アトミック書き込み
}

function computeFileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  return `sha256:${hash}`;
}

// ─── 同期エンジン ───

interface SyncResult {
  created: string[];
  updated: string[];
  deleted: string[];
  skipped: string[];
  errors: Array<{ file: string; error: string }>;
}

/**
 * マニフェストとディレクトリを比較し、DBを同期する
 */
export async function syncWithManifest(): Promise<SyncResult> {
  // 排他制御: 同時実行を防止
  if (syncing) {
    console.log("[Auto-Ingest] 同期中のためスキップ");
    return { created: [], updated: [], deleted: [], skipped: [], errors: [] };
  }
  syncing = true;

  const result: SyncResult = {
    created: [],
    updated: [],
    deleted: [],
    skipped: [],
    errors: [],
  };

  try {
    if (!fs.existsSync(INGEST_SOURCE_DIR)) {
      console.log("[Auto-Ingest] ディレクトリが見つかりません:", INGEST_SOURCE_DIR);
      return result;
    }

    const manifest = loadManifest();
    const newManifest: Manifest = {};

    // ディレクトリ内のファイルを列挙
    const files = fs.readdirSync(INGEST_SOURCE_DIR).filter((f) => {
      if (f === MANIFEST_FILENAME) return false;
      const fp = path.join(INGEST_SOURCE_DIR, f);
      return fs.statSync(fp).isFile();
    });

    // 各ファイルを処理
    for (const filename of files) {
      const fileType = getFileType(filename);
      if (!SUPPORTED_TYPES.includes(fileType)) {
        result.skipped.push(filename);
        continue;
      }

      const filePath = path.join(INGEST_SOURCE_DIR, filename);
      const currentHash = computeFileHash(filePath);
      newManifest[filename] = currentHash;

      const previousHash = manifest[filename];

      // ハッシュ一致 → スキップ
      if (previousHash === currentHash) {
        result.skipped.push(filename);
        continue;
      }

      // 新規 or 変更 → インジェスト
      try {
        const { content, metadata } = await extractContent(filePath, fileType);

        if (!content || content.trim().length === 0) {
          result.errors.push({ file: filename, error: "コンテンツが空です" });
          continue;
        }

        const metadataStr = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;

        const existing = await prisma.rAGDocument.findFirst({
          where: { filename },
        });

        if (existing) {
          // 変更 → update
          await prisma.rAGDocument.update({
            where: { id: existing.id },
            data: { content, fileType, metadata: metadataStr },
          });
          console.log(`[Auto-Ingest] 更新: ${filename}`);
          result.updated.push(filename);
        } else {
          // 新規 → create
          const docId = `rag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await prisma.rAGDocument.create({
            data: { id: docId, filename, fileType, content, metadata: metadataStr },
          });
          console.log(`[Auto-Ingest] 新規: ${filename}`);
          result.created.push(filename);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Auto-Ingest] エラー: ${filename} - ${msg}`);
        result.errors.push({ file: filename, error: msg });
      }
    }

    // 削除検出: DBにあるがディレクトリにないファイルを全て削除
    // (マニフェストベースだけでなく、手動アップロードやシード経由の古いデータも対象)
    // 注意: orenavi scopeのドキュメントは別管理なので除外
    const allDbDocs = await prisma.rAGDocument.findMany({
      where: { scope: { not: "orenavi" } },
      select: { id: true, filename: true },
    });
    const currentFiles = new Set(Object.keys(newManifest));

    for (const doc of allDbDocs) {
      if (currentFiles.has(doc.filename)) continue; // ディレクトリに存在する

      try {
        await prisma.rAGDocument.delete({ where: { id: doc.id } });
        console.log(`[Auto-Ingest] 削除: ${doc.filename}`);
        result.deleted.push(doc.filename);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Auto-Ingest] 削除エラー: ${doc.filename} - ${msg}`);
        result.errors.push({ file: doc.filename, error: msg });
      }
    }

    // マニフェスト保存
    saveManifest(newManifest);

    // サマリーログ
    const actions = [
      result.created.length > 0 ? `新規${result.created.length}` : "",
      result.updated.length > 0 ? `更新${result.updated.length}` : "",
      result.deleted.length > 0 ? `削除${result.deleted.length}` : "",
      result.errors.length > 0 ? `エラー${result.errors.length}` : "",
    ].filter(Boolean);
    if (actions.length > 0) {
      console.log(`[Auto-Ingest] 同期完了: ${actions.join(", ")}`);
    } else {
      console.log("[Auto-Ingest] 変更なし");
    }

    return result;
  } finally {
    syncing = false;
  }
}

// ─── 検知エンジン（2層構造）───

/** デバウンス付きで同期を実行 */
function triggerSync(reason: string): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      console.log(`[Auto-Ingest] 同期トリガー: ${reason}`);
      await syncWithManifest();
    } catch (err) {
      console.error("[Auto-Ingest] 同期エラー:", err);
    }
  }, DEBOUNCE_MS);
}

/**
 * インジェスト監視を開始（instrumentation.tsから呼ばれる）
 * 第1層: fs.watch（即時検知）
 * 第2層: setInterval（5分ポーリング、フォールバック）
 */
export function startIngestWatcher(): void {
  if (watcherStarted) return;

  if (!fs.existsSync(INGEST_SOURCE_DIR)) {
    console.log("[Auto-Ingest] 監視ディレクトリが見つかりません:", INGEST_SOURCE_DIR);
    return;
  }

  watcherStarted = true;

  // 第1層: fs.watch
  try {
    fs.watch(INGEST_SOURCE_DIR, (eventType, filename) => {
      if (!filename || filename === MANIFEST_FILENAME) return;
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      if (!SUPPORTED_TYPES.includes(ext)) return;
      triggerSync(`fs.watch: ${filename} (${eventType})`);
    });
    console.log(`[Auto-Ingest] 第1層: fs.watch 開始 (${INGEST_SOURCE_DIR})`);
  } catch (err) {
    console.warn("[Auto-Ingest] fs.watch 開始失敗、ポーリングのみで動作:", err);
  }

  // 第2層: ポーリング
  setInterval(() => {
    triggerSync("定期ポーリング");
  }, POLL_INTERVAL_MS);
  console.log(`[Auto-Ingest] 第2層: ポーリング開始 (${POLL_INTERVAL_MS / 1000}秒間隔)`);
}

/**
 * APIリクエスト時の互換用（既存の呼び出し元を壊さない）
 * 監視ベースに移行したため、ここでは何もしない
 */
export async function checkAndIngestNewFiles(): Promise<{
  checked: boolean;
  ingested: string[];
}> {
  return { checked: false, ingested: [] };
}

// ─── 俺ナビ専用ドキュメント インジェスト ───

const ORE_NAVI_SOURCE_DIR = "C:\\Dev\\kaede_ver10\\agent_docs\\system_prompt";
const ORE_NAVI_FILES = [
  "Myプロフィール.md",
  "My運用モジュール.md",
  "My価値観.md",
  "My回答ルール.md",
];

/**
 * 俺ナビ専用の4ファイルをRAGにインジェスト（scope: "orenavi"）
 * ハッシュベースで変更があった場合のみ更新
 */
export async function ingestOreNaviDocuments(): Promise<{
  created: string[];
  updated: string[];
  skipped: string[];
  errors: string[];
}> {
  const result = { created: [] as string[], updated: [] as string[], skipped: [] as string[], errors: [] as string[] };

  if (!fs.existsSync(ORE_NAVI_SOURCE_DIR)) {
    console.log("[OreNavi-Ingest] ディレクトリが見つかりません:", ORE_NAVI_SOURCE_DIR);
    return result;
  }

  for (const filename of ORE_NAVI_FILES) {
    const filePath = path.join(ORE_NAVI_SOURCE_DIR, filename);

    if (!fs.existsSync(filePath)) {
      console.log(`[OreNavi-Ingest] ファイルなし: ${filename}`);
      result.errors.push(filename);
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
      const currentHash = computeFileHash(filePath);

      const existing = await prisma.rAGDocument.findFirst({
        where: { filename, scope: "orenavi" },
      });

      if (existing) {
        // ハッシュチェック: metadataにハッシュを保存
        const existingMeta = existing.metadata ? JSON.parse(existing.metadata) : {};
        if (existingMeta.hash === currentHash) {
          result.skipped.push(filename);
          continue;
        }
        await prisma.rAGDocument.update({
          where: { id: existing.id },
          data: { content, metadata: JSON.stringify({ hash: currentHash }) },
        });
        console.log(`[OreNavi-Ingest] 更新: ${filename} (${content.length} chars)`);
        result.updated.push(filename);
      } else {
        const docId = `orenavi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await prisma.rAGDocument.create({
          data: {
            id: docId,
            filename,
            fileType: "md",
            content,
            scope: "orenavi",
            metadata: JSON.stringify({ hash: currentHash }),
          },
        });
        console.log(`[OreNavi-Ingest] 新規: ${filename} (${content.length} chars)`);
        result.created.push(filename);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[OreNavi-Ingest] エラー: ${filename} - ${msg}`);
      result.errors.push(filename);
    }
  }

  const actions = [
    result.created.length > 0 ? `新規${result.created.length}` : "",
    result.updated.length > 0 ? `更新${result.updated.length}` : "",
    result.skipped.length > 0 ? `スキップ${result.skipped.length}` : "",
  ].filter(Boolean);
  if (actions.length > 0) {
    console.log(`[OreNavi-Ingest] 完了: ${actions.join(", ")}`);
  }

  return result;
}

// ─── ファイル内容抽出 ───

function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text;
}

async function fetchUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en;q=0.9",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const html = await response.text();
    return extractTextFromHtml(html);
  } catch (error) {
    throw new Error(`URL取得失敗 (${url}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const texts: string[] = [];

  const slideFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
  );

  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
    return numA - numB;
  });

  for (const slidePath of slideFiles) {
    const content = await zip.files[slidePath].async("string");
    const textMatches = content.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
    if (textMatches) {
      const slideTexts = textMatches
        .map((match) => match.replace(/<[^>]+>/g, ""))
        .filter((text) => text.trim());
      if (slideTexts.length > 0) {
        const slideNum = slidePath.match(/slide(\d+)/)?.[1];
        texts.push(`[スライド${slideNum}]\n${slideTexts.join("\n")}`);
      }
    }
  }

  return texts.join("\n\n");
}

function getFileType(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

async function extractContent(
  filePath: string,
  fileType: string
): Promise<{ content: string; metadata: Record<string, unknown> }> {
  const buffer = fs.readFileSync(filePath);
  let content = "";
  const metadata: Record<string, unknown> = {};

  switch (fileType) {
    case "pdf": {
      const pdfData = await pdfParse(buffer);
      content = pdfData.text;
      metadata.pages = pdfData.numpages;
      metadata.info = pdfData.info;
      break;
    }

    case "doc": {
      // 旧Word形式: バイナリからテキスト部分を抽出
      const raw = buffer.toString("utf-8", 0, buffer.length);
      const textParts = raw
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
        .split(/\s+/)
        .filter((w) => /[\u3000-\u9FFFa-zA-Z0-9]{2,}/.test(w));
      content = textParts.join(" ");
      metadata.format = "doc-legacy";
      break;
    }

    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
      if (result.messages.length > 0) {
        metadata.warnings = result.messages;
      }
      break;
    }

    case "pptx": {
      content = await extractTextFromPptx(buffer);
      const slideCount = (content.match(/\[スライド\d+\]/g) || []).length;
      metadata.slides = slideCount;
      break;
    }

    case "csv": {
      const textContent = buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const records = csvParse(textContent, {
        columns: true,
        skip_empty_lines: true,
      });
      content = JSON.stringify(records, null, 2);
      metadata.rows = records.length;
      break;
    }

    case "json": {
      const textContent = buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const parsed = JSON.parse(textContent);
      content = JSON.stringify(parsed, null, 2);
      break;
    }

    case "msg":
    case "eml":
    case "txt":
    case "md": {
      content = buffer.toString("utf-8").replace(/^\uFEFF/, "");
      break;
    }

    case "urls": {
      const textContent = buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const urls = textContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.startsWith("http"));

      const contents: string[] = [];
      const fetchedUrls: string[] = [];
      const failedUrls: string[] = [];

      for (const url of urls) {
        try {
          console.log(`[Auto-Ingest] URL取得中: ${url}`);
          const urlContent = await fetchUrlContent(url);
          contents.push(`--- ${url} ---\n${urlContent}`);
          fetchedUrls.push(url);
        } catch (error) {
          console.error(`[Auto-Ingest] URL取得失敗: ${url} - ${error instanceof Error ? error.message : String(error)}`);
          failedUrls.push(url);
        }
      }

      content = contents.join("\n\n");
      metadata.urls = fetchedUrls;
      metadata.failedUrls = failedUrls;
      metadata.totalUrls = urls.length;
      break;
    }

    default:
      throw new Error(`未対応のファイル形式: ${fileType}`);
  }

  return { content, metadata };
}
