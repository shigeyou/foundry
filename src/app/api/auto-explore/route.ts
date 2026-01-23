import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWinningStrategies } from "@/lib/claude";
import { generateRAGContext } from "@/lib/rag";
import { AzureOpenAI } from "openai";
import {
  recordBaseline,
  archiveTopStrategies,
  getCurrentBaseline,
} from "@/lib/self-improve";

// Auto-exploration API - runs in background to find high-scoring strategies
// Can be triggered by Azure Functions Timer or manual call

interface AutoExploreResult {
  questionsGenerated: number;
  explorationsCompleted: number;
  highScoresFound: number;
  topScore: number;
  topStrategy: string | null;
  errors: string[];
}

// Generate exploration questions based on core info
async function generateQuestions(
  services: string,
  assets: string
): Promise<string[]> {
  const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: "2024-08-01-preview",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  });

  const prompt = `あなたは戦略コンサルタントです。以下の企業情報をもとに、高スコアの勝ち筋が見つかりそうな探索クエスチョンを5つ生成してください。

## 登録済みサービス
${services || "なし"}

## 登録済み資産・強み
${assets || "なし"}

## 生成ルール
- 具体的で収益に直結しそうな問いにする
- 既存資産の新しい活用法を探る問いを含める
- 3社シナジーを活かせる問いを含める
- JSON形式で出力

出力形式（必ずこの形式で）:
{"questions": ["問い1", "問い2", "問い3", "問い4", "問い5"]}`;

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    max_completion_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.questions) return parsed.questions;
    return [];
  } catch {
    return [];
  }
}

// Calculate weighted score
function calculateScore(scores: {
  revenuePotential: number;
  timeToRevenue: number;
  competitiveAdvantage: number;
  executionFeasibility: number;
  hqContribution: number;
  mergerSynergy: number;
}): number {
  const weights = {
    revenuePotential: 30,
    timeToRevenue: 20,
    competitiveAdvantage: 20,
    executionFeasibility: 15,
    hqContribution: 10,
    mergerSynergy: 5,
  };
  const totalWeight = 100;

  return (
    (scores.revenuePotential * weights.revenuePotential +
      scores.timeToRevenue * weights.timeToRevenue +
      scores.competitiveAdvantage * weights.competitiveAdvantage +
      scores.executionFeasibility * weights.executionFeasibility +
      scores.hqContribution * weights.hqContribution +
      scores.mergerSynergy * weights.mergerSynergy) /
    totalWeight
  );
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const result: AutoExploreResult = {
    questionsGenerated: 0,
    explorationsCompleted: 0,
    highScoresFound: 0,
    topScore: 0,
    topStrategy: null,
    errors: [],
  };

  // Create AutoExploreRun record
  const run = await prisma.autoExploreRun.create({
    data: {
      status: "running",
      triggerType: "manual",
    },
  });

  try {
    // Check for API key (basic auth for scheduled jobs)
    const authHeader = request.headers.get("x-api-key");
    const expectedKey = process.env.AUTO_EXPLORE_API_KEY;
    if (expectedKey && authHeader !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Auto-Explore] Starting autonomous exploration...");

    // Record baseline before exploration
    const baselineBefore = await getCurrentBaseline();
    const baselineScore = baselineBefore?.topScore ?? 0;

    // Fetch core data
    const [coreServices, coreAssets, defaultConstraints, ragContext] =
      await Promise.all([
        prisma.coreService.findMany(),
        prisma.coreAsset.findMany(),
        prisma.constraint.findMany({ where: { isDefault: true } }),
        generateRAGContext(),
      ]);

    const servicesText = coreServices
      .map((s) => `- ${s.name}${s.category ? ` (${s.category})` : ""}${s.description ? `: ${s.description}` : ""}`)
      .join("\n");

    const assetsText = coreAssets
      .map((a) => `- ${a.name} [${a.type}]${a.description ? `: ${a.description}` : ""}`)
      .join("\n");

    const constraintsText = defaultConstraints
      .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`)
      .join("\n");

    // Generate exploration questions
    console.log("[Auto-Explore] Generating questions...");
    const questions = await generateQuestions(servicesText, assetsText);
    result.questionsGenerated = questions.length;
    console.log(`[Auto-Explore] Generated ${questions.length} questions`);

    if (questions.length === 0) {
      result.errors.push("No questions generated");
      return NextResponse.json(result);
    }

    // Run explorations for each question
    for (const question of questions) {
      try {
        console.log(`[Auto-Explore] Exploring: ${question.substring(0, 50)}...`);

        const explorationResult = await generateWinningStrategies(
          question,
          "自動探索による問い",
          servicesText,
          assetsText,
          constraintsText,
          ragContext
        );

        // Save exploration
        await prisma.exploration.create({
          data: {
            question,
            context: "[自動探索] " + new Date().toISOString(),
            constraints: "[]",
            status: "completed",
            result: JSON.stringify(explorationResult),
          },
        });

        result.explorationsCompleted++;

        // Check for high scores
        for (const strategy of explorationResult.strategies || []) {
          if (strategy.scores) {
            const score = calculateScore(strategy.scores);
            if (score >= 4.0) {
              result.highScoresFound++;
            }
            if (score > result.topScore) {
              result.topScore = score;
              result.topStrategy = strategy.name;
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Question "${question.substring(0, 30)}...": ${errorMsg}`);
        console.error(`[Auto-Explore] Error:`, error);
      }
    }

    const durationSec = Math.floor((Date.now() - startTime) / 1000);
    const durationStr = `${(durationSec / 60).toFixed(1)}分`;
    console.log(`[Auto-Explore] Completed in ${durationSec}s. Top score: ${result.topScore.toFixed(2)}`);

    // Record new baseline after exploration
    const newBaseline = await recordBaseline(run.id);
    const achievedScore = newBaseline?.topScore ?? result.topScore;

    // Archive top strategies
    const archiveResult = await archiveTopStrategies(4.0);
    console.log(`[Auto-Explore] Archived ${archiveResult.archived} top strategies`);

    // Calculate improvement
    let improvement: number | null = null;
    if (baselineScore > 0 && achievedScore > baselineScore) {
      improvement = ((achievedScore - baselineScore) / baselineScore) * 100;
    }

    // Update AutoExploreRun
    await prisma.autoExploreRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        questionsGenerated: result.questionsGenerated,
        explorationsCompleted: result.explorationsCompleted,
        highScoresFound: result.highScoresFound,
        topScore: result.topScore,
        topStrategyName: result.topStrategy,
        baselineScore,
        achievedScore,
        improvement,
        completedAt: new Date(),
        duration: durationSec,
        errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      },
    });

    return NextResponse.json({
      ...result,
      runId: run.id,
      baselineScore,
      achievedScore,
      improvement: improvement ? `+${improvement.toFixed(1)}%` : null,
      archived: archiveResult.archived,
      duration: durationStr,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Auto-Explore] Fatal error:", error);

    // Update run as failed
    await prisma.autoExploreRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        duration: Math.floor((Date.now() - startTime) / 1000),
        errors: JSON.stringify([error instanceof Error ? error.message : "Unknown"]),
      },
    });

    return NextResponse.json(
      { error: "Auto-exploration failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

// GET: Check last auto-exploration results and history
export async function GET() {
  try {
    // Get AutoExploreRun history
    const runHistory = await prisma.autoExploreRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    });

    // Find recent auto-explorations (exploration records)
    const recentAutoExplorations = await prisma.exploration.findMany({
      where: {
        context: { contains: "[自動探索]" },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      runHistory: runHistory.map((run) => ({
        id: run.id,
        status: run.status,
        triggerType: run.triggerType,
        questionsGenerated: run.questionsGenerated,
        explorationsCompleted: run.explorationsCompleted,
        highScoresFound: run.highScoresFound,
        topScore: run.topScore,
        topStrategyName: run.topStrategyName,
        baselineScore: run.baselineScore,
        achievedScore: run.achievedScore,
        improvement: run.improvement,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        duration: run.duration,
        errors: run.errors ? JSON.parse(run.errors) : [],
      })),
      explorationCount: recentAutoExplorations.length,
      recentExplorations: recentAutoExplorations.map((e) => ({
        id: e.id,
        question: e.question,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    console.error("Auto-explore history error:", error);
    return NextResponse.json({ error: "Failed to fetch auto-exploration history" }, { status: 500 });
  }
}
