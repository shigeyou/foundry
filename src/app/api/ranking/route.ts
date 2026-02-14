import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

type StrategyScores = Record<string, number>;

interface Strategy {
  name: string;
  reason: string;
  howToObtain: string;
  scores?: StrategyScores;
  tags?: string[];
}

interface RankedStrategy {
  rank: number;
  name: string;
  reason: string;
  totalScore: number;
  scores: StrategyScores;
  question: string;
  explorationDate: Date;
  judgment: string;
  tags?: string[];
}

function calculateTotalScore(scores: StrategyScores): number {
  const keys = Object.keys(scores).filter((k) => typeof scores[k] === "number");
  if (keys.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  keys.forEach((key) => {
    weightedSum += (scores[key] || 0);
    totalWeight += 1;
  });
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function getJudgment(scores: StrategyScores): string {
  const values = Object.values(scores).filter((v) => typeof v === "number");
  if (values.some((v) => v <= 1)) return "見送り";

  const totalScore = calculateTotalScore(scores);
  if (totalScore >= 4.0) return "優先投資";
  if (totalScore >= 3.0) return "条件付き";
  return "見送り";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const minScore = parseFloat(searchParams.get("minScore") || "0");
    const judgment = searchParams.get("judgment"); // filter by judgment

    const userId = await getCurrentUserId();

    // Fetch user's completed explorations only
    const explorations = await prisma.exploration.findMany({
      where: { status: "completed", userId },
      orderBy: { createdAt: "desc" },
    });

    // Extract and rank all strategies
    const allStrategies: RankedStrategy[] = [];

    for (const exploration of explorations) {
      if (!exploration.result) continue;

      try {
        const result = JSON.parse(exploration.result);
        if (!result.strategies) continue;

        for (const strategy of result.strategies as Strategy[]) {
          if (!strategy.scores) continue;

          const totalScore = calculateTotalScore(strategy.scores);
          const strategyJudgment = getJudgment(strategy.scores);

          // Apply filters
          if (totalScore < minScore) continue;
          if (judgment && strategyJudgment !== judgment) continue;

          allStrategies.push({
            rank: 0, // Will be set after sorting
            name: strategy.name,
            reason: strategy.reason,
            totalScore,
            scores: strategy.scores,
            question: exploration.question,
            explorationDate: exploration.createdAt,
            judgment: strategyJudgment,
            tags: strategy.tags,
          });
        }
      } catch (e) {
        console.error("Failed to parse exploration result:", e);
      }
    }

    // Sort by total score (descending)
    allStrategies.sort((a, b) => b.totalScore - a.totalScore);

    // Assign ranks
    allStrategies.forEach((strategy, index) => {
      strategy.rank = index + 1;
    });

    // Limit results
    const rankedStrategies = allStrategies.slice(0, limit);

    // Summary stats
    const stats = {
      totalStrategies: allStrategies.length,
      priorityCount: allStrategies.filter(s => s.judgment === "優先投資").length,
      conditionalCount: allStrategies.filter(s => s.judgment === "条件付き").length,
      declineCount: allStrategies.filter(s => s.judgment === "見送り").length,
      avgScore: allStrategies.length > 0
        ? allStrategies.reduce((sum, s) => sum + s.totalScore, 0) / allStrategies.length
        : 0,
      topScore: allStrategies.length > 0 ? allStrategies[0].totalScore : 0,
    };

    return NextResponse.json({
      strategies: rankedStrategies,
      stats,
    });
  } catch (error) {
    console.error("Ranking API error:", error);
    return NextResponse.json(
      { error: "ランキング取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
