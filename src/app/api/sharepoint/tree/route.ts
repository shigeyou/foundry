import { NextResponse } from "next/server";
import { getAccessToken, listSites, listDrives } from "@/lib/sharepoint";

export async function GET() {
  try {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "unauthorized", message: "SharePointアクセストークンが設定されていません" },
        { status: 401 }
      );
    }

    const sites = await listSites(token);

    // 各サイトのドライブを並列取得（最大10並列）
    const BATCH = 10;
    const tree: Array<{
      site: { id: string; displayName: string; webUrl: string; description?: string };
      drives: Array<{ id: string; name: string; driveType: string; webUrl: string }>;
    }> = [];

    for (let i = 0; i < sites.length; i += BATCH) {
      const batch = sites.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (site) => {
          const drives = await listDrives(token, site.id);
          return { site, drives };
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          tree.push(r.value);
        }
      }
    }

    // displayNameでソート
    tree.sort((a, b) => a.site.displayName.localeCompare(b.site.displayName, "ja"));

    return NextResponse.json({ tree, totalSites: sites.length });
  } catch (error) {
    console.error("[SharePoint Tree]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ツリー取得に失敗しました" },
      { status: 500 }
    );
  }
}
