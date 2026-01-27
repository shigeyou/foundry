import { prisma } from "@/lib/db";

// 6軸スコアの型
interface StrategyScores {
  revenuePotential: number;
  timeToRevenue: number;
  competitiveAdvantage: number;
  executionFeasibility: number;
  hqContribution: number;
  mergerSynergy: number;
}

// デフォルトの重み
const defaultWeights = {
  revenuePotential: 30,
  timeToRevenue: 20,
  competitiveAdvantage: 20,
  executionFeasibility: 15,
  hqContribution: 10,
  mergerSynergy: 5,
};

// 加重平均スコアを計算
export function calculateTotalScore(scores: StrategyScores): number {
  const totalWeight = Object.values(defaultWeights).reduce((a, b) => a + b, 0);
  const weightedSum =
    scores.revenuePotential * defaultWeights.revenuePotential +
    scores.timeToRevenue * defaultWeights.timeToRevenue +
    scores.competitiveAdvantage * defaultWeights.competitiveAdvantage +
    scores.executionFeasibility * defaultWeights.executionFeasibility +
    scores.hqContribution * defaultWeights.hqContribution +
    scores.mergerSynergy * defaultWeights.mergerSynergy;
  return weightedSum / totalWeight;
}

// 判定を取得
export function getJudgment(scores: StrategyScores): string {
  // ゲート条件
  if (scores.revenuePotential <= 2) return "見送り";
  if (scores.competitiveAdvantage <= 2) return "見送り";
  if (scores.executionFeasibility === 1) return "見送り";

  const totalScore = calculateTotalScore(scores);
  if (totalScore >= 4.0) return "優先投資";
  if (totalScore >= 3.0) return "条件付き";
  return "見送り";
}

// 全戦略のスコアを取得（ユーザー別）
export async function getAllStrategiesWithScores(userId?: string): Promise<
  {
    explorationId: string;
    name: string;
    reason: string;
    howToObtain?: string;
    totalScore: number;
    scores: StrategyScores;
    question: string;
    judgment: string;
  }[]
> {
  const explorations = await prisma.exploration.findMany({
    where: {
      status: "completed",
      ...(userId ? { userId } : {}),
    },
    select: {
      id: true,
      question: true,
      result: true,
    },
  });

  const allStrategies: {
    explorationId: string;
    name: string;
    reason: string;
    howToObtain?: string;
    totalScore: number;
    scores: StrategyScores;
    question: string;
    judgment: string;
  }[] = [];

  for (const exploration of explorations) {
    if (!exploration.result) continue;

    try {
      const result = JSON.parse(exploration.result);
      if (!result.strategies) continue;

      for (const strategy of result.strategies) {
        if (!strategy.scores) continue;

        const totalScore = calculateTotalScore(strategy.scores);
        const judgment = getJudgment(strategy.scores);

        allStrategies.push({
          explorationId: exploration.id,
          name: strategy.name,
          reason: strategy.reason,
          howToObtain: strategy.howToObtain,
          totalScore,
          scores: strategy.scores,
          question: exploration.question,
          judgment,
        });
      }
    } catch {
      // JSON parse error - skip
    }
  }

  return allStrategies;
}

// ベースラインスコアを記録
export async function recordBaseline(runId?: string) {
  const allStrategies = await getAllStrategiesWithScores();

  if (allStrategies.length === 0) {
    return null;
  }

  const scores = allStrategies.map((s) => s.totalScore);
  const topScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const highScoreCount = scores.filter((s) => s >= 3.5).length;

  // 前回のベースラインを取得
  const previousBaseline = await prisma.scoreBaseline.findFirst({
    orderBy: { date: "desc" },
  });

  // 改善率を計算
  let improvement: number | null = null;
  if (previousBaseline && previousBaseline.topScore > 0) {
    improvement =
      ((topScore - previousBaseline.topScore) / previousBaseline.topScore) * 100;
  }

  // 新しいベースラインを作成
  const baseline = await prisma.scoreBaseline.create({
    data: {
      runId,
      topScore,
      avgScore,
      totalStrategies: allStrategies.length,
      highScoreCount,
      improvement,
    },
  });

  return baseline;
}

// 高スコア戦略をアーカイブ（重複チェック付き、ユーザー別）
export async function archiveTopStrategies(
  minScore: number = 4.0,
  userId?: string,
  userName?: string
) {
  const allStrategies = await getAllStrategiesWithScores(userId);

  // 既存のアーカイブを取得（重複チェック用、ユーザー別）
  const existingArchives = await prisma.topStrategy.findMany({
    where: userId ? { userId } : {},
    select: {
      explorationId: true,
      name: true,
    },
  });

  const existingKeys = new Set(
    existingArchives.map((a) => `${a.explorationId}:${a.name}`)
  );

  // 高スコア戦略をフィルタ
  const highScoreStrategies = allStrategies.filter(
    (s) => s.totalScore >= minScore && s.judgment !== "見送り"
  );

  // 新規のみアーカイブ
  const newStrategies = highScoreStrategies.filter(
    (s) => !existingKeys.has(`${s.explorationId}:${s.name}`)
  );

  if (newStrategies.length === 0) {
    return { archived: 0, total: highScoreStrategies.length };
  }

  // バッチ作成（ユーザー情報付き）
  await prisma.topStrategy.createMany({
    data: newStrategies.map((s) => ({
      explorationId: s.explorationId,
      name: s.name,
      reason: s.reason,
      howToObtain: s.howToObtain,
      totalScore: s.totalScore,
      scores: JSON.stringify(s.scores),
      question: s.question,
      judgment: s.judgment,
      userId,
      userName,
    })),
  });

  return { archived: newStrategies.length, total: highScoreStrategies.length };
}

// 現在のベースラインを取得
export async function getCurrentBaseline() {
  return prisma.scoreBaseline.findFirst({
    orderBy: { date: "desc" },
  });
}

// ベースライン履歴を取得
export async function getBaselineHistory(limit: number = 30) {
  return prisma.scoreBaseline.findMany({
    orderBy: { date: "desc" },
    take: limit,
  });
}

// 高スコア戦略を取得（ユーザー別）
export async function getTopStrategies(limit: number = 50, userId?: string) {
  return prisma.topStrategy.findMany({
    where: userId ? { userId } : {},
    orderBy: { totalScore: "desc" },
    take: limit,
  });
}
