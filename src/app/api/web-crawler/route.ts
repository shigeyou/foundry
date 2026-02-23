import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runWebCrawl } from "@/lib/web-crawler";

type WebCrawlLogEntry = {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  pagesVisited: number;
  docsUpdated: number;
  errors: string | null;
};

type PrismaWithWebCrawlLog = typeof prisma & {
  webCrawlLog: {
    findFirst: (args: {
      orderBy: { startedAt: string };
    }) => Promise<WebCrawlLogEntry | null>;
    findMany: (args: {
      orderBy: { startedAt: string };
      take: number;
    }) => Promise<WebCrawlLogEntry[]>;
  };
};

// GET: クロール状態を取得
export async function GET() {
  try {
    const db = prisma as unknown as PrismaWithWebCrawlLog;

    const latest = await db.webCrawlLog.findFirst({
      orderBy: { startedAt: "desc" },
    });

    const history = await db.webCrawlLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    });

    const webSources = await prisma.webSource.findMany({
      select: { id: true, name: true, url: true },
    });

    // scopeがwebのRAGドキュメント数
    const webDocCount = await prisma.rAGDocument.count({
      where: { scope: "web" },
    });

    return NextResponse.json({
      latest,
      history,
      webSources,
      webDocCount,
    });
  } catch (error) {
    console.error("Failed to get crawler status:", error);
    return NextResponse.json(
      { error: "クロール状態の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 手動クロール実行
export async function POST() {
  try {
    const db = prisma as unknown as PrismaWithWebCrawlLog;

    // 実行中チェック
    const running = await db.webCrawlLog.findFirst({
      orderBy: { startedAt: "desc" },
    });

    if (running?.status === "running") {
      return NextResponse.json(
        { error: "クロールが既に実行中です" },
        { status: 409 }
      );
    }

    // バックグラウンドで実行
    void runWebCrawl();

    return NextResponse.json({
      message: "Webクロールを開始しました",
    });
  } catch (error) {
    console.error("Failed to start crawl:", error);
    return NextResponse.json(
      { error: "クロール開始に失敗しました" },
      { status: 500 }
    );
  }
}
