"use server";

import { NextRequest, NextResponse } from "next/server";

// Dynamic import for PDF parsing (Node.js only)
async function parsePDF(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

// Dynamic import for DOCX parsing
async function parseDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// Dynamic import for MSG (Outlook) parsing
async function parseMSG(buffer: Buffer): Promise<string> {
  const MsgReader = (await import("msgreader")).default;
  const msgReader = new MsgReader(buffer);
  const fileData = msgReader.getFileData();

  const parts: string[] = [];

  // Subject
  if (fileData.subject) {
    parts.push(`件名: ${fileData.subject}`);
  }

  // From
  if (fileData.senderName || fileData.senderEmail) {
    const from = fileData.senderName
      ? `${fileData.senderName} <${fileData.senderEmail || ""}>`
      : fileData.senderEmail;
    parts.push(`差出人: ${from}`);
  }

  // To
  if (fileData.recipients && fileData.recipients.length > 0) {
    const toList = fileData.recipients
      .map((r: { name?: string; email?: string }) => r.name || r.email)
      .join(", ");
    parts.push(`宛先: ${toList}`);
  }

  // Date
  if (fileData.messageDeliveryTime || fileData.clientSubmitTime) {
    const date = fileData.messageDeliveryTime || fileData.clientSubmitTime;
    parts.push(`日時: ${date}`);
  }

  parts.push(""); // 空行

  // Body
  if (fileData.body) {
    parts.push(fileData.body);
  }

  return parts.join("\n");
}

// Parse EML (standard email) format
async function parseEML(buffer: Buffer): Promise<string> {
  const content = buffer.toString("utf-8");
  const lines = content.split(/\r?\n/);

  const parts: string[] = [];
  let inHeaders = true;
  let bodyLines: string[] = [];

  for (const line of lines) {
    if (inHeaders) {
      if (line === "") {
        inHeaders = false;
        continue;
      }
      // Parse common headers
      if (line.startsWith("Subject:")) {
        parts.push(`件名: ${line.substring(8).trim()}`);
      } else if (line.startsWith("From:")) {
        parts.push(`差出人: ${line.substring(5).trim()}`);
      } else if (line.startsWith("To:")) {
        parts.push(`宛先: ${line.substring(3).trim()}`);
      } else if (line.startsWith("Date:")) {
        parts.push(`日時: ${line.substring(5).trim()}`);
      }
    } else {
      bodyLines.push(line);
    }
  }

  parts.push(""); // 空行
  parts.push(bodyLines.join("\n"));

  return parts.join("\n");
}

// ファイルサイズ上限（10MB） - 大きなPDF解析を防ぐ
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが選択されていません" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `ファイルサイズが大きすぎます（上限${MAX_FILE_SIZE / 1024 / 1024}MB）。小さなファイルをアップロードしてください。` },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let content = "";
    let fileType = "";

    // PDF
    if (fileName.endsWith(".pdf")) {
      fileType = "pdf";
      content = await parsePDF(buffer);
    }
    // DOCX
    else if (fileName.endsWith(".docx")) {
      fileType = "docx";
      content = await parseDOCX(buffer);
    }
    // Markdown
    else if (fileName.endsWith(".md")) {
      fileType = "md";
      content = buffer.toString("utf-8");
    }
    // Plain text
    else if (fileName.endsWith(".txt")) {
      fileType = "txt";
      content = buffer.toString("utf-8");
    }
    // JSON
    else if (fileName.endsWith(".json")) {
      fileType = "json";
      const jsonContent = buffer.toString("utf-8");
      // Try to pretty-print JSON
      try {
        const parsed = JSON.parse(jsonContent);
        content = JSON.stringify(parsed, null, 2);
      } catch {
        content = jsonContent;
      }
    }
    // Outlook MSG
    else if (fileName.endsWith(".msg")) {
      fileType = "msg";
      content = await parseMSG(buffer);
    }
    // EML (standard email)
    else if (fileName.endsWith(".eml")) {
      fileType = "eml";
      content = await parseEML(buffer);
    }
    // Unsupported format
    else {
      return NextResponse.json(
        { error: "対応していないファイル形式です。PDF, DOCX, MD, TXT, JSON, MSG, EMLに対応しています。" },
        { status: 400 }
      );
    }

    // Clean up content - remove excessive whitespace
    content = content
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileType,
      content,
      size: file.size,
    });
  } catch (error) {
    console.error("File parse error:", error);
    return NextResponse.json(
      { error: "ファイルの解析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
