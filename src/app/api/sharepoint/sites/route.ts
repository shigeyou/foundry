import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, listSites } from "@/lib/sharepoint";

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
    const search = searchParams.get("search") || undefined;

    const sites = await listSites(token, search);
    return NextResponse.json({ sites });
  } catch (error) {
    console.error("[SharePoint Sites]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "サイト一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
