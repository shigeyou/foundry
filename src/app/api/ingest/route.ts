import { NextResponse } from "next/server";
import { syncWithManifest, checkAndIngestNewFiles } from "@/lib/auto-ingest";

// GET: 現在のingestステータスを取得
export async function GET() {
  try {
    const fs = await import("fs");
    const ingestDir = "C:\\Dev\\kaede_ver10\\agent_docs\\ingest_files";

    const ingestResult = await checkAndIngestNewFiles();

    if (!fs.existsSync(ingestDir)) {
      return NextResponse.json({
        status: "directory_not_found",
        directory: ingestDir,
        files: [],
        autoIngested: ingestResult.ingested,
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
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST: マニフェスト同期を強制実行
export async function POST() {
  try {
    console.log("[Ingest API] 手動同期を開始...");

    const result = await syncWithManifest();
    console.log("[Ingest API] 同期完了:", result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Ingest API] エラー:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
