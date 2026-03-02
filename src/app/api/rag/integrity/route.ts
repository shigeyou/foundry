import { NextRequest, NextResponse } from "next/server";
import { runIntegrityCheck, clearIntegrityCache } from "@/lib/rag-integrity";
import { refineFile } from "@/lib/rag-refiner";
import { syncWithManifest } from "@/lib/auto-ingest";

// GET: 整合性チェック実行
export async function GET() {
  try {
    const result = await runIntegrityCheck();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Integrity API] チェックエラー:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST: 指定ファイルの再変換を強制実行
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json(
        { error: "filename is required" },
        { status: 400 }
      );
    }

    console.log(`[Integrity API] 再変換開始: ${filename}`);

    // ファイルを再変換
    const entry = await refineFile(filename);

    // キャッシュクリア
    clearIntegrityCache();

    // DB同期
    await syncWithManifest();

    return NextResponse.json({
      success: true,
      filename,
      status: entry.status,
      refinedFile: entry.refinedFile,
      error: entry.error,
    });
  } catch (error) {
    console.error("[Integrity API] 再変換エラー:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
