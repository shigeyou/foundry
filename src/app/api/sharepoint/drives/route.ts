import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, listDrives } from "@/lib/sharepoint";

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
    const siteId = searchParams.get("siteId");

    if (!siteId) {
      return NextResponse.json(
        { error: "siteIdパラメータが必要です" },
        { status: 400 }
      );
    }

    const drives = await listDrives(token, siteId);
    return NextResponse.json({ drives });
  } catch (error) {
    console.error("[SharePoint Drives]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ドライブ一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
