import { NextResponse } from "next/server";
import { processAllDocuments } from "@/lib/rag-ingest-pipeline";

// POST: 全ドキュメントの再チャンク＋再埋め込み
export async function POST() {
  try {
    const result = await processAllDocuments();

    return NextResponse.json({
      message: `${result.success}/${result.total} ドキュメントを処理しました`,
      ...result,
    });
  } catch (error) {
    console.error("[Reprocess] Error:", error);
    return NextResponse.json(
      { error: "再処理に失敗しました: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500 },
    );
  }
}
