import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAccessToken, downloadFile } from "@/lib/sharepoint";
import { prisma } from "@/lib/db";
import { processDocument } from "@/lib/rag-ingest-pipeline";
import { getFileType, SUPPORTED_TYPES } from "@/lib/file-parser";
import { extractTextFromPptx } from "@/lib/file-parser";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { parse as csvParse } from "csv-parse/sync";

async function extractContentFromBuffer(
  buffer: Buffer,
  fileType: string
): Promise<{ content: string; metadata: Record<string, unknown> }> {
  const metadata: Record<string, unknown> = {};
  let content = "";

  switch (fileType) {
    case "pdf": {
      const pdfData = await pdfParse(buffer);
      content = pdfData.text;
      metadata.pages = pdfData.numpages;
      break;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
      break;
    }
    case "pptx": {
      content = await extractTextFromPptx(buffer);
      break;
    }
    case "csv": {
      const textContent = buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const records = csvParse(textContent, { columns: true, skip_empty_lines: true });
      content = JSON.stringify(records, null, 2);
      metadata.rows = records.length;
      break;
    }
    case "json": {
      const textContent = buffer.toString("utf-8").replace(/^\uFEFF/, "");
      content = JSON.stringify(JSON.parse(textContent), null, 2);
      break;
    }
    case "txt":
    case "md": {
      content = buffer.toString("utf-8").replace(/^\uFEFF/, "");
      break;
    }
    default:
      throw new Error(`未対応のファイル形式: ${fileType}`);
  }

  return { content, metadata };
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "unauthorized", message: "SharePointアクセストークンが設定されていません" },
        { status: 401 }
      );
    }

    const { driveId, items } = await request.json() as {
      driveId: string;
      items: Array<{ itemId: string; filename: string }>;
    };

    if (!driveId || !items?.length) {
      return NextResponse.json(
        { error: "driveIdとitems配列が必要です" },
        { status: 400 }
      );
    }

    const results: Array<{ filename: string; action: string; error?: string }> = [];

    for (const item of items) {
      try {
        const fileType = getFileType(item.filename);
        if (!SUPPORTED_TYPES.includes(fileType)) {
          results.push({ filename: item.filename, action: "skipped", error: `未対応形式: ${fileType}` });
          continue;
        }

        // Graph APIからファイルダウンロード
        const buffer = await downloadFile(token, driveId, item.itemId);

        // テキスト抽出
        const { content, metadata } = await extractContentFromBuffer(buffer, fileType);
        if (!content.trim()) {
          results.push({ filename: item.filename, action: "skipped", error: "コンテンツが空です" });
          continue;
        }

        metadata.source = "sharepoint";
        metadata.driveId = driveId;
        metadata.itemId = item.itemId;

        // Upsert: 同名ファイルがあれば更新
        const existing = await prisma.rAGDocument.findFirst({ where: { filename: item.filename } });
        if (existing) {
          await prisma.rAGDocument.update({
            where: { id: existing.id },
            data: { content, fileType, metadata: JSON.stringify(metadata) },
          });
          processDocument(existing.id).catch(err =>
            console.error(`[SP Download] チャンク処理エラー: ${item.filename}`, err)
          );
          results.push({ filename: item.filename, action: "updated" });
        } else {
          const doc = await prisma.rAGDocument.create({
            data: {
              id: crypto.randomUUID(),
              filename: item.filename,
              fileType,
              content,
              metadata: JSON.stringify(metadata),
            },
          });
          processDocument(doc.id).catch(err =>
            console.error(`[SP Download] チャンク処理エラー: ${item.filename}`, err)
          );
          results.push({ filename: item.filename, action: "created" });
        }
      } catch (err) {
        console.error(`[SP Download] ${item.filename}:`, err);
        results.push({
          filename: item.filename,
          action: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const imported = results.filter(r => r.action === "created" || r.action === "updated").length;
    return NextResponse.json({ success: true, imported, results });
  } catch (error) {
    console.error("[SharePoint Download]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "インポート中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
