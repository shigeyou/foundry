import { NextResponse } from "next/server";
import { syncWithManifest, checkAndIngestNewFiles } from "@/lib/auto-ingest";

// GET: 現在のingestステータスを取得
export async function GET() {
  try {
    const fs = await import("fs");
    const ingestDir = "C:\\Dev\\kaede_ver10\\agent_docs\\raw_documents";

    const ingestResult = await checkAndIngestNewFiles();

    // 進捗情報も含める
    let progress = null;
    try {
      const { getRefineProgress } = await import("@/lib/rag-refiner");
      progress = getRefineProgress();
    } catch {
      // ignore
    }

    if (!fs.existsSync(ingestDir)) {
      return NextResponse.json({
        status: "directory_not_found",
        directory: ingestDir,
        files: [],
        autoIngested: ingestResult.ingested,
        progress,
      });
    }

    const files = fs.readdirSync(ingestDir).filter((file: string) => {
      const filePath = `${ingestDir}\\${file}`;
      return fs.statSync(filePath).isFile();
    });

    return NextResponse.json({
      status: "ready",
      directory: ingestDir,
      fileCount: files.length,
      files: files,
      checked: ingestResult.checked,
      autoIngested: ingestResult.ingested,
      progress,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST: AI変換 + マニフェスト同期をバックグラウンドで実行
export async function POST() {
  try {
    // 既に実行中かチェック
    const { getRefineProgress, refineAllFiles } = await import("@/lib/rag-refiner");
    const currentProgress = getRefineProgress();
    if (currentProgress.running) {
      return NextResponse.json({
        success: true,
        alreadyRunning: true,
        progress: currentProgress,
      });
    }

    console.log("[Ingest API] バックグラウンド同期を開始...");

    // バックグラウンドで実行（awaitしない）
    (async () => {
      try {
        const refineResult = await refineAllFiles();
        console.log("[Ingest API] AI変換完了:", refineResult);

        const syncResult = await syncWithManifest();
        console.log("[Ingest API] 同期完了:", syncResult);
      } catch (err) {
        console.error("[Ingest API] バックグラウンド処理エラー:", err);
      }
    })();

    return NextResponse.json({
      success: true,
      started: true,
      message: "バックグラウンドで変換・同期を開始しました",
    });
  } catch (error) {
    console.error("[Ingest API] エラー:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
