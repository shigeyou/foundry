/**
 * RAG AI構造化フィルター
 *
 * raw_documents/ のPDF/PPTX等をAIで構造化Markdownに変換し、rag-ready/ に保存。
 * 1回のみ変換し、マニフェストでハッシュ管理。変更検知で再変換。
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const INGEST_SOURCE_DIR = process.env.INGEST_SOURCE_DIR || "C:\\Dev\\kaede_ver10\\agent_docs\\raw_documents";
const RAG_READY_DIR = process.env.RAG_READY_DIR || "C:\\Dev\\kaede_ver10\\agent_docs\\rag-ready";
const MANIFEST_FILENAME = "_refine_manifest.json";
const INTEGRITY_LOG = "_integrity.log";

// AI変換が必要なファイル拡張子
const AI_CONVERSION_TYPES = new Set(["pdf", "doc", "docx", "pptx"]);
// そのままコピーするファイル拡張子
const COPY_TYPES = new Set(["txt", "md", "csv", "json", "msg", "eml", "urls"]);
const ALL_SUPPORTED = new Set([...AI_CONVERSION_TYPES, ...COPY_TYPES]);

// 長文分割の閾値（文字数ベース、約50Kトークン相当）
const MAX_CHARS_PER_CHUNK = 60000;

// ─── 進捗トラッキング ───

export interface RefineProgress {
  running: boolean;
  phase: "idle" | "refining" | "syncing" | "done";
  total: number;
  processed: number;
  currentFile: string;
  converted: number;
  copied: number;
  skipped: number;
  failed: number;
  startedAt: string | null;
  completedAt: string | null;
  syncResult?: { created: number; updated: number; deleted: number };
}

const progress: RefineProgress = {
  running: false,
  phase: "idle",
  total: 0,
  processed: 0,
  currentFile: "",
  converted: 0,
  copied: 0,
  skipped: 0,
  failed: 0,
  startedAt: null,
  completedAt: null,
};

export function getRefineProgress(): RefineProgress {
  return { ...progress };
}

// ─── マニフェスト ───

interface RefineEntry {
  sourceFile: string;
  sourceHash: string;
  refinedFile: string;
  refinedHash: string;
  status: "converted" | "copied" | "failed";
  convertedAt: string;
  error?: string;
}

interface RefineManifest {
  entries: Record<string, RefineEntry>;
}

function getManifestPath(): string {
  return path.join(RAG_READY_DIR, MANIFEST_FILENAME);
}

function loadManifest(): RefineManifest {
  const p = getManifestPath();
  if (!fs.existsSync(p)) return { entries: {} };
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    console.warn("[RAG Refiner] マニフェスト読み込み失敗、初期化します");
    return { entries: {} };
  }
}

function saveManifest(manifest: RefineManifest): void {
  const p = getManifestPath();
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2), "utf-8");
  fs.renameSync(tmp, p);
}

function computeHash(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  return `sha256:${crypto.createHash("sha256").update(buf).digest("hex")}`;
}

function computeFileHash(filePath: string): string {
  return computeHash(fs.readFileSync(filePath));
}

function getFileType(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function needsAiConversion(fileType: string): boolean {
  return AI_CONVERSION_TYPES.has(fileType);
}

// ─── 古いファイルの自動削除 ───

// ファイル名末尾の _YYYYMMDD_HHMM パターン
const DATE_SUFFIX_RE = /^(.+)_(\d{8}_\d{4})\.(md|txt)$/;

/**
 * raw_documents/ 内の同一プレフィックスのファイルを検出し、最新1件のみ残して削除
 * 例: AI技術動向予測_20260301_1200.md と AI技術動向予測_20260228_0600.md → 後者を削除
 */
export function cleanupOldFiles(): string[] {
  if (!fs.existsSync(INGEST_SOURCE_DIR)) return [];

  const files = fs.readdirSync(INGEST_SOURCE_DIR).filter((f) => {
    const fp = path.join(INGEST_SOURCE_DIR, f);
    return fs.statSync(fp).isFile();
  });

  // プレフィックスごとにグループ化
  const groups = new Map<string, Array<{ filename: string; dateStr: string }>>();

  for (const filename of files) {
    const match = filename.match(DATE_SUFFIX_RE);
    if (!match) continue;

    const prefix = match[1];
    const dateStr = match[2];

    if (!groups.has(prefix)) {
      groups.set(prefix, []);
    }
    groups.get(prefix)!.push({ filename, dateStr });
  }

  const deleted: string[] = [];

  for (const [prefix, entries] of groups) {
    if (entries.length <= 1) continue;

    // 日付文字列でソート（降順 = 最新が先頭）
    entries.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

    // 最新以外を削除
    for (let i = 1; i < entries.length; i++) {
      const filePath = path.join(INGEST_SOURCE_DIR, entries[i].filename);
      try {
        fs.unlinkSync(filePath);
        console.log(`[RAG Refiner] 旧版削除: ${entries[i].filename} (最新: ${entries[0].filename})`);
        deleted.push(entries[i].filename);
      } catch (err) {
        console.error(`[RAG Refiner] 旧版削除失敗: ${entries[i].filename}`, err);
      }
    }
  }

  if (deleted.length > 0) {
    console.log(`[RAG Refiner] 旧版ファイル ${deleted.length}件を削除しました`);
  }

  return deleted;
}

function ensureRagReadyDir(): void {
  if (!fs.existsSync(RAG_READY_DIR)) {
    fs.mkdirSync(RAG_READY_DIR, { recursive: true });
    console.log(`[RAG Refiner] rag-ready/ ディレクトリを作成: ${RAG_READY_DIR}`);
  }
}

function appendIntegrityLog(message: string): void {
  const logPath = path.join(RAG_READY_DIR, INTEGRITY_LOG);
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `${timestamp} ${message}\n`, "utf-8");
}

// ─── テキスト抽出（auto-ingest.tsと同等のロジック） ───

async function extractRawText(filePath: string, fileType: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);

  switch (fileType) {
    case "pdf": {
      const pdfParse = (await import("pdf-parse")).default;
      const pdfData = await pdfParse(buffer);
      return pdfData.text;
    }
    case "doc": {
      const raw = buffer.toString("utf-8", 0, buffer.length);
      return raw
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
        .split(/\s+/)
        .filter((w) => /[\u3000-\u9FFFa-zA-Z0-9]{2,}/.test(w))
        .join(" ");
    }
    case "docx": {
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "pptx": {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      const texts: string[] = [];
      const slideFiles = Object.keys(zip.files)
        .filter((name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"))
        .sort((a, b) => {
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
    case "txt":
    case "md":
    case "msg":
    case "eml":
      return buffer.toString("utf-8").replace(/^\uFEFF/, "");
    case "csv": {
      const { parse: csvParse } = await import("csv-parse/sync");
      const textContent = buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const records = csvParse(textContent, { columns: true, skip_empty_lines: true });
      return JSON.stringify(records, null, 2);
    }
    case "json": {
      const textContent = buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const parsed = JSON.parse(textContent);
      return JSON.stringify(parsed, null, 2);
    }
    case "urls": {
      return buffer.toString("utf-8").replace(/^\uFEFF/, "");
    }
    default:
      throw new Error(`未対応のファイル形式: ${fileType}`);
  }
}

// ─── AI変換 ───

const SYSTEM_PROMPT = `あなたは文書構造の専門家です。与えられたテキストを構造化されたMarkdownに変換してください。

## 変換ルール
- 表 → Markdownテーブル（| ヘッダー | ... | 形式）
- 見出し → ##/### の適切なレベル
- ページ番号・ヘッダー/フッターの繰り返し → 除去
- 段組みの崩れ → 正しい読み順に修正
- 箇条書き → Markdownリスト（- または 1. 形式）
- 数値データ → 可能な限り表形式に整理

## 厳守事項
- 情報を削除しない
- 要約しない（全文を保持する）
- 翻訳しない（原文の言語のまま）
- コメントや注釈を追加しない
- Markdownのコードブロックで囲まない（直接Markdownとして出力する）`;

async function convertWithAI(rawText: string): Promise<string> {
  const { generateChatWithClaude } = await import("./claude");

  // 長文チェック
  if (rawText.length <= MAX_CHARS_PER_CHUNK) {
    return await callAI(generateChatWithClaude, rawText);
  }

  // 長文分割
  console.log(`[RAG Refiner] 長文検出 (${rawText.length}文字)、セクション分割で処理`);
  const sections = splitIntoSections(rawText);
  const results: string[] = [];

  for (let i = 0; i < sections.length; i++) {
    console.log(`[RAG Refiner]   セクション ${i + 1}/${sections.length} (${sections[i].length}文字)`);
    const result = await callAI(generateChatWithClaude, sections[i]);
    results.push(result);
  }

  return results.join("\n\n---\n\n");
}

async function callAI(
  generateChatWithClaude: (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: { temperature?: number; maxTokens?: number }
  ) => Promise<string>,
  text: string
): Promise<string> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: text },
  ];
  return await generateChatWithClaude(messages, { temperature: 0.1, maxTokens: 16000 });
}

function splitIntoSections(text: string): string[] {
  const sections: string[] = [];
  // スライド区切りまたは空行2つ以上で分割を試みる
  const parts = text.split(/(?=\[スライド\d+\])|(?:\n{3,})/);

  let current = "";
  for (const part of parts) {
    if (current.length + part.length > MAX_CHARS_PER_CHUNK && current.length > 0) {
      sections.push(current.trim());
      current = "";
    }
    current += part;
  }
  if (current.trim()) {
    sections.push(current.trim());
  }

  // 分割できなかった場合、強制分割
  if (sections.length === 0) {
    for (let i = 0; i < text.length; i += MAX_CHARS_PER_CHUNK) {
      sections.push(text.slice(i, i + MAX_CHARS_PER_CHUNK));
    }
  }

  return sections;
}

// ─── メイン処理 ───

export interface RefineResult {
  converted: string[];
  copied: string[];
  skipped: string[];
  failed: Array<{ file: string; error: string }>;
}

/**
 * raw_documents/ を走査し、未変換ファイルをAI変換してrag-ready/に保存
 */
export async function refineAllFiles(): Promise<RefineResult> {
  const result: RefineResult = { converted: [], copied: [], skipped: [], failed: [] };

  if (!fs.existsSync(INGEST_SOURCE_DIR)) {
    console.log("[RAG Refiner] raw_documents/ が見つかりません:", INGEST_SOURCE_DIR);
    return result;
  }

  // 古いファイルを先に削除
  cleanupOldFiles();

  // 排他制御
  if (progress.running) {
    console.log("[RAG Refiner] 既に実行中です");
    return result;
  }

  ensureRagReadyDir();
  const manifest = loadManifest();

  const files = fs.readdirSync(INGEST_SOURCE_DIR).filter((f) => {
    const fp = path.join(INGEST_SOURCE_DIR, f);
    return fs.statSync(fp).isFile() && ALL_SUPPORTED.has(getFileType(f));
  });

  // 進捗初期化
  progress.running = true;
  progress.phase = "refining";
  progress.total = files.length;
  progress.processed = 0;
  progress.currentFile = "";
  progress.converted = 0;
  progress.copied = 0;
  progress.skipped = 0;
  progress.failed = 0;
  progress.startedAt = new Date().toISOString();
  progress.completedAt = null;
  progress.syncResult = undefined;

  try {
    for (const filename of files) {
      progress.currentFile = filename;

      try {
        const filePath = path.join(INGEST_SOURCE_DIR, filename);
        const currentHash = computeFileHash(filePath);
        const entry = manifest.entries[filename];

        // ハッシュ一致 → スキップ
        if (entry && entry.sourceHash === currentHash && entry.status !== "failed") {
          // refined fileが存在するかも確認
          const refinedPath = path.join(RAG_READY_DIR, entry.refinedFile);
          if (fs.existsSync(refinedPath)) {
            result.skipped.push(filename);
            progress.skipped++;
            progress.processed++;
            continue;
          }
        }

        // 変換実行
        const singleResult = await refineFile(filename, currentHash, manifest);
        if (singleResult.status === "converted") {
          result.converted.push(filename);
          progress.converted++;
        } else if (singleResult.status === "copied") {
          result.copied.push(filename);
          progress.copied++;
        } else {
          result.failed.push({ file: filename, error: singleResult.error || "unknown" });
          progress.failed++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[RAG Refiner] エラー: ${filename} - ${msg}`);
        result.failed.push({ file: filename, error: msg });
        progress.failed++;
      }

      progress.processed++;
    }

    // rag-ready/ から、raw_documents/ に存在しないファイルを削除
    const sourceSet = new Set(files);
    for (const [key, entry] of Object.entries(manifest.entries)) {
      if (!sourceSet.has(key)) {
        const refinedPath = path.join(RAG_READY_DIR, entry.refinedFile);
        if (fs.existsSync(refinedPath)) {
          fs.unlinkSync(refinedPath);
          console.log(`[RAG Refiner] 削除: ${entry.refinedFile} (元ファイル ${key} が存在しない)`);
        }
        delete manifest.entries[key];
      }
    }

    saveManifest(manifest);

    // サマリーログ
    const actions = [
      result.converted.length > 0 ? `AI変換${result.converted.length}` : "",
      result.copied.length > 0 ? `コピー${result.copied.length}` : "",
      result.skipped.length > 0 ? `スキップ${result.skipped.length}` : "",
      result.failed.length > 0 ? `失敗${result.failed.length}` : "",
    ].filter(Boolean);
    if (actions.length > 0) {
      console.log(`[RAG Refiner] 完了: ${actions.join(", ")}`);
    } else {
      console.log("[RAG Refiner] 対象ファイルなし");
    }
  } finally {
    progress.currentFile = "";
    progress.completedAt = new Date().toISOString();
    progress.phase = "done";
    progress.running = false;
  }

  return result;
}

/**
 * 単一ファイルの変換（refineAllFilesとAPIから呼ばれる）
 */
export async function refineFile(
  filename: string,
  sourceHash?: string,
  existingManifest?: RefineManifest
): Promise<RefineEntry> {
  ensureRagReadyDir();
  const manifest = existingManifest || loadManifest();
  const filePath = path.join(INGEST_SOURCE_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`ファイルが見つかりません: ${filename}`);
  }

  const hash = sourceHash || computeFileHash(filePath);
  const fileType = getFileType(filename);
  const refinedFilename = filename.replace(/\.[^.]+$/, ".md");

  console.log(`[RAG Refiner] 処理中: ${filename} (${fileType})`);

  let refinedContent: string;
  let status: "converted" | "copied" | "failed" = "copied";
  let error: string | undefined;

  try {
    const rawText = await extractRawText(filePath, fileType);

    if (!rawText || rawText.trim().length === 0) {
      throw new Error("テキスト抽出結果が空です");
    }

    if (needsAiConversion(fileType)) {
      console.log(`[RAG Refiner] AI変換中: ${filename} (${rawText.length}文字)`);
      refinedContent = await convertWithAI(rawText);
      status = "converted";
      console.log(`[RAG Refiner] AI変換完了: ${filename} → ${refinedFilename}`);
    } else {
      refinedContent = rawText;
      status = "copied";
      console.log(`[RAG Refiner] コピー: ${filename} → ${refinedFilename}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[RAG Refiner] 変換失敗: ${filename} - ${msg}`);

    // フォールバック: 生テキストをそのままコピー
    try {
      refinedContent = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
    } catch {
      refinedContent = `[変換失敗] ${filename}: ${msg}`;
    }
    status = "failed";
    error = msg;
    appendIntegrityLog(`REFINE FAILED: ${filename} - ${msg}`);
  }

  // rag-ready/ に保存
  const refinedPath = path.join(RAG_READY_DIR, refinedFilename);
  fs.writeFileSync(refinedPath, refinedContent, "utf-8");

  // マニフェスト更新
  const entry: RefineEntry = {
    sourceFile: filename,
    sourceHash: hash,
    refinedFile: refinedFilename,
    refinedHash: computeHash(refinedContent),
    status,
    convertedAt: new Date().toISOString(),
    ...(error && { error }),
  };
  manifest.entries[filename] = entry;

  if (!existingManifest) {
    saveManifest(manifest);
  }

  return entry;
}

// エクスポート（他モジュールから使用）
export { RAG_READY_DIR, MANIFEST_FILENAME, INTEGRITY_LOG, computeHash, computeFileHash, loadManifest, getFileType };
