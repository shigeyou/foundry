import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import { parse as csvParse } from "csv-parse/sync";

// PPTXからテキストを抽出
async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const texts: string[] = [];

  // スライドファイルを取得
  const slideFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
  );

  // スライド番号順にソート
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
    return numA - numB;
  });

  for (const slidePath of slideFiles) {
    const content = await zip.files[slidePath].async("string");
    // XMLからテキストを抽出（<a:t>タグ）
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

// ファイルタイプを取得
function getFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ext;
}

// 対応ファイルタイプ
const SUPPORTED_TYPES = ["pdf", "txt", "md", "json", "docx", "csv", "pptx"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルを選択してください" },
        { status: 400 }
      );
    }

    const filename = file.name;
    const fileType = getFileType(filename);

    if (!SUPPORTED_TYPES.includes(fileType)) {
      return NextResponse.json(
        {
          error: `サポートされていないファイル形式です: ${fileType}。対応形式: ${SUPPORTED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    let content = "";
    const metadata: Record<string, unknown> = {};

    const buffer = Buffer.from(await file.arrayBuffer());

    switch (fileType) {
      case "pdf": {
        const pdfData = await pdfParse(buffer);
        content = pdfData.text;
        metadata.pages = pdfData.numpages;
        metadata.info = pdfData.info;
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
        // JSONとして整形
        const parsed = JSON.parse(textContent);
        content = JSON.stringify(parsed, null, 2);
        break;
      }

      case "txt":
      case "md": {
        content = buffer.toString("utf-8").replace(/^\uFEFF/, "");
        break;
      }
    }

    // DBに保存
    const doc = await prisma.rAGDocument.create({
      data: {
        filename,
        fileType,
        content,
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        contentLength: content.length,
        metadata,
      },
      message: `${filename} をインポートしました（${content.length.toLocaleString()}文字）`,
    });
  } catch (error) {
    console.error("RAG import error:", error);
    return NextResponse.json(
      { error: `インポート中にエラーが発生しました: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

// RAGドキュメント一覧を取得
export async function GET() {
  try {
    const documents = await prisma.rAGDocument.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        fileType: true,
        metadata: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("RAG list error:", error);
    return NextResponse.json(
      { error: "ドキュメント一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// RAGドキュメントを削除
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ドキュメントIDが必要です" },
        { status: 400 }
      );
    }

    await prisma.rAGDocument.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("RAG delete error:", error);
    return NextResponse.json(
      { error: "ドキュメントの削除に失敗しました" },
      { status: 500 }
    );
  }
}
