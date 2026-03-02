/**
 * RAG 3レベル整合性チェック
 *
 * Level 1 (source): raw_documents/ の現在ハッシュ vs マニフェストのsourceHash
 * Level 2 (refined): rag-ready/ の現在ハッシュ vs マニフェストのrefinedHash
 * Level 3 (db): DB content SHA-256 vs rag-ready/ ファイルのSHA-256
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { prisma } from "./db";

const INGEST_SOURCE_DIR = process.env.INGEST_SOURCE_DIR || "C:\\Dev\\kaede_ver10\\agent_docs\\raw_documents";
const RAG_READY_DIR = process.env.RAG_READY_DIR || "C:\\Dev\\kaede_ver10\\agent_docs\\rag-ready";
const MANIFEST_FILENAME = "_refine_manifest.json";
const INTEGRITY_LOG = "_integrity.log";

interface IntegrityWarning {
  level: "source" | "refined" | "db";
  filename: string;
  message: string;
}

export interface IntegrityCheckResult {
  warnings: IntegrityWarning[];
  checkedAt: string;
  sourceFiles: number;
  refinedFiles: number;
  dbDocuments: number;
}

// キャッシュ（5分TTL）
let cachedResult: IntegrityCheckResult | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function computeContentHash(content: string): string {
  return `sha256:${crypto.createHash("sha256").update(Buffer.from(content, "utf-8")).digest("hex")}`;
}

function computeFileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

function loadManifest(): Record<string, {
  sourceFile: string;
  sourceHash: string;
  refinedFile: string;
  refinedHash: string;
  status: string;
}> {
  const p = path.join(RAG_READY_DIR, MANIFEST_FILENAME);
  if (!fs.existsSync(p)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return data.entries || {};
  } catch {
    return {};
  }
}

function appendLog(message: string): void {
  try {
    const logPath = path.join(RAG_READY_DIR, INTEGRITY_LOG);
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `${timestamp} ${message}\n`, "utf-8");
  } catch {
    // ログ書き込み失敗は無視
  }
}

/**
 * 3レベル整合性チェック実行
 */
export async function runIntegrityCheck(): Promise<IntegrityCheckResult> {
  const warnings: IntegrityWarning[] = [];
  let sourceFiles = 0;
  let refinedFiles = 0;
  let dbDocuments = 0;

  const manifest = loadManifest();

  // Level 1: source チェック（raw_documents/ vs マニフェスト）
  if (fs.existsSync(INGEST_SOURCE_DIR)) {
    const files = fs.readdirSync(INGEST_SOURCE_DIR).filter((f) => {
      const fp = path.join(INGEST_SOURCE_DIR, f);
      return fs.statSync(fp).isFile() && !f.startsWith("_");
    });
    sourceFiles = files.length;

    for (const filename of files) {
      const entry = manifest[filename];
      if (!entry) {
        warnings.push({
          level: "source",
          filename,
          message: "マニフェストに未登録（未変換ファイル）",
        });
        continue;
      }

      const filePath = path.join(INGEST_SOURCE_DIR, filename);
      const currentHash = computeFileHash(filePath);
      if (currentHash !== entry.sourceHash) {
        warnings.push({
          level: "source",
          filename,
          message: "元ファイルが変更されています（再変換が必要）",
        });
        const logMsg = `SOURCE MISMATCH: ${filename}`;
        console.log(`[RAG Integrity] ${logMsg}`);
        appendLog(logMsg);
      }
    }
  }

  // Level 2: refined チェック（rag-ready/ vs マニフェスト）
  if (fs.existsSync(RAG_READY_DIR)) {
    const refinedFilesList = fs.readdirSync(RAG_READY_DIR).filter((f) => {
      return !f.startsWith("_") && f.endsWith(".md");
    });
    refinedFiles = refinedFilesList.length;

    for (const [, entry] of Object.entries(manifest)) {
      const refinedPath = path.join(RAG_READY_DIR, entry.refinedFile);
      if (!fs.existsSync(refinedPath)) {
        warnings.push({
          level: "refined",
          filename: entry.refinedFile,
          message: "変換済みファイルが見つかりません",
        });
        continue;
      }

      const currentHash = computeFileHash(refinedPath);
      if (currentHash !== entry.refinedHash) {
        warnings.push({
          level: "refined",
          filename: entry.refinedFile,
          message: "変換済みファイルが手動編集されています",
        });
        const logMsg = `REFINED MISMATCH: ${entry.refinedFile}`;
        console.log(`[RAG Integrity] ${logMsg}`);
        appendLog(logMsg);
      }
    }
  }

  // Level 3: DB チェック（DB content vs rag-ready/ファイル）
  try {
    const dbDocs = await prisma.rAGDocument.findMany({
      where: { scope: { not: "orenavi" } },
      select: { id: true, filename: true, content: true },
    });
    dbDocuments = dbDocs.length;

    for (const doc of dbDocs) {
      // rag-ready/ にある対応ファイルを探す
      const mdFilename = doc.filename.replace(/\.[^.]+$/, ".md");
      const refinedPath = path.join(RAG_READY_DIR, mdFilename);

      if (!fs.existsSync(refinedPath)) {
        // rag-ready/ に存在しない場合は元のファイル名で試行
        const originalPath = path.join(RAG_READY_DIR, doc.filename);
        if (!fs.existsSync(originalPath)) {
          continue; // シード等で直接DBに入ったドキュメントは対象外
        }
      }

      const fileToCheck = fs.existsSync(path.join(RAG_READY_DIR, mdFilename))
        ? path.join(RAG_READY_DIR, mdFilename)
        : path.join(RAG_READY_DIR, doc.filename);

      if (!fs.existsSync(fileToCheck)) continue;

      const fileContent = fs.readFileSync(fileToCheck, "utf-8");
      const fileHash = computeContentHash(fileContent);
      const dbHash = computeContentHash(doc.content);

      if (fileHash !== dbHash) {
        warnings.push({
          level: "db",
          filename: doc.filename,
          message: "DBの内容とrag-ready/のファイルが不一致（再取り込みが必要）",
        });
        const logMsg = `DB MISMATCH: ${doc.filename}`;
        console.log(`[RAG Integrity] ${logMsg}`);
        appendLog(logMsg);
      }
    }
  } catch (err) {
    console.error("[RAG Integrity] DBチェックエラー:", err);
  }

  const result: IntegrityCheckResult = {
    warnings,
    checkedAt: new Date().toISOString(),
    sourceFiles,
    refinedFiles,
    dbDocuments,
  };

  // キャッシュ更新
  cachedResult = result;
  cachedAt = Date.now();

  if (warnings.length > 0) {
    console.log(`[RAG Integrity] ${warnings.length}件の警告を検出`);
  } else {
    console.log("[RAG Integrity] 整合性OK");
  }

  return result;
}

/**
 * キャッシュ付き警告取得（UIから呼ばれる）
 */
export async function getIntegrityWarnings(): Promise<IntegrityCheckResult> {
  if (cachedResult && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }
  return await runIntegrityCheck();
}

/**
 * キャッシュクリア
 */
export function clearIntegrityCache(): void {
  cachedResult = null;
  cachedAt = 0;
}
