import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "ファイルが必要です" },
        { status: 400 }
      );
    }

    // ファイル拡張子チェック
    if (!file.name.endsWith(".docx")) {
      return NextResponse.json(
        { error: ".docxファイルのみサポートしています" },
        { status: 400 }
      );
    }

    // ファイルをArrayBufferとして読み込み
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // mammothでテキスト抽出
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Parse DOCX error:", error);
    return NextResponse.json(
      { error: "文書の解析に失敗しました" },
      { status: 500 }
    );
  }
}
