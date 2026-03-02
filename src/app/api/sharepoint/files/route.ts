import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, listFiles } from "@/lib/sharepoint";

export async function GET(request: NextRequest) {
  try {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "unauthorized", message: "SharePointアクセストークンが設定されていません" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const driveId = searchParams.get("driveId");
    const itemId = searchParams.get("itemId") || undefined;
    const nextLink = searchParams.get("nextLink") || undefined;

    if (!driveId) {
      return NextResponse.json(
        { error: "driveIdパラメータが必要です" },
        { status: 400 }
      );
    }

    const result = await listFiles(token, driveId, itemId, nextLink);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[SharePoint Files]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ファイル一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
