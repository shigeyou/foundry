import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import { parse as csvParse } from "csv-parse/sync";

// 対応ファイルタイプ
export const SUPPORTED_TYPES = ["pdf", "txt", "md", "json", "docx", "csv", "pptx"];

// ファイルタイプを取得
export function getFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ext;
}

// PPTXからテキストを抽出
export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
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

// ファイルからテキストコンテンツとメタデータを抽出
export async function parseFileContent(
  file: File
): Promise<{ content: string; metadata: Record<string, unknown> }> {
  const filename = file.name;
  const fileType = getFileType(filename);

  if (!SUPPORTED_TYPES.includes(fileType)) {
    throw new Error(
      `サポートされていないファイル形式です: ${fileType}。対応形式: ${SUPPORTED_TYPES.join(", ")}`
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

  return { content, metadata };
}
