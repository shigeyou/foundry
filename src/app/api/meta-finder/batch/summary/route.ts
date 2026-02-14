import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: バッチ結果のサマリーを取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");

    if (!batchId) {
      return NextResponse.json({ error: "batchIdが必要です" }, { status: 400 });
    }

    // バッチ情報を取得
    const batch = await prisma.metaFinderBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json({ error: "バッチが見つかりません" }, { status: 404 });
    }

    // 全体トップ20
    const topIdeas = await prisma.metaFinderIdea.findMany({
      where: { batchId },
      orderBy: { score: "desc" },
      take: 20,
    });

    // テーマ別ベスト（各テーマのトップ1）
    const themeIds = await prisma.metaFinderIdea.groupBy({
      by: ["themeId", "themeName"],
      where: { batchId },
      _max: { score: true },
    });

    const themeBest = await Promise.all(
      themeIds.map(async (t) => {
        const best = await prisma.metaFinderIdea.findFirst({
          where: { batchId, themeId: t.themeId, score: t._max.score || 0 },
        });
        return best;
      })
    );

    // 部門別ベスト（各部門のトップ1）
    const deptIds = await prisma.metaFinderIdea.groupBy({
      by: ["deptId", "deptName"],
      where: { batchId },
      _max: { score: true },
    });

    const deptBest = await Promise.all(
      deptIds.map(async (d) => {
        const best = await prisma.metaFinderIdea.findFirst({
          where: { batchId, deptId: d.deptId, score: d._max.score || 0 },
        });
        return best;
      })
    );

    // 統計情報（BSC 4視点）
    const stats = await prisma.metaFinderIdea.aggregate({
      where: { batchId },
      _count: true,
      _avg: { score: true, financial: true, customer: true, process: true, growth: true },
      _max: { score: true },
    });

    // スコア分布
    const scoreDistribution = {
      excellent: await prisma.metaFinderIdea.count({ where: { batchId, score: { gte: 4 } } }),
      good: await prisma.metaFinderIdea.count({ where: { batchId, score: { gte: 3, lt: 4 } } }),
      average: await prisma.metaFinderIdea.count({ where: { batchId, score: { gte: 2, lt: 3 } } }),
      low: await prisma.metaFinderIdea.count({ where: { batchId, score: { lt: 2 } } }),
    };

    return NextResponse.json({
      batch,
      stats: {
        totalIdeas: stats._count,
        avgScore: stats._avg.score?.toFixed(2),
        // BSC 4視点の平均
        avgFinancial: stats._avg.financial?.toFixed(2),
        avgCustomer: stats._avg.customer?.toFixed(2),
        avgProcess: stats._avg.process?.toFixed(2),
        avgGrowth: stats._avg.growth?.toFixed(2),
        maxScore: stats._max.score,
      },
      scoreDistribution,
      topIdeas,
      themeBest: themeBest.filter(Boolean),
      deptBest: deptBest.filter(Boolean),
    });

  } catch (error) {
    console.error("Failed to get batch summary:", error);
    return NextResponse.json(
      { error: "サマリー取得に失敗しました" },
      { status: 500 }
    );
  }
}
