import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AzureOpenAI } from "openai";
import { getCurrentUser } from "@/lib/auth";

// API route の最大実行時間を延長（秒）
// 進化生成は時間がかかるため長めに設定
export const maxDuration = 300;

// 進化生成の型
type EvolveMode = "mutation" | "crossover" | "refutation" | "all";

interface EvolvedStrategy {
  name: string;
  reason: string;
  howToObtain: string;
  metrics: string;
  sourceStrategies: string[]; // 元になった戦略名
  evolveType: "mutation" | "crossover" | "refutation";
  improvement: string; // 元からの改善点
  scores?: {
    revenuePotential: number;
    timeToRevenue: number;
    competitiveAdvantage: number;
    executionFeasibility: number;
    hqContribution: number;
    mergerSynergy: number;
  };
  totalScore?: number;
}

interface EvolveResult {
  strategies: EvolvedStrategy[];
  thinkingProcess: string;
}

// 採用された戦略を取得（ユーザー別）
async function getAdoptedStrategies(userId: string, limit: number = 10): Promise<
  {
    name: string;
    reason: string;
    howToObtain?: string;
    question: string;
    scores?: string;
  }[]
> {
  // StrategyDecisionから採用された戦略を取得（自分のデータのみ）
  const decisions = await prisma.strategyDecision.findMany({
    where: { userId, decision: "adopt" },
    orderBy: { createdAt: "desc" },
    take: limit * 2, // 重複を考慮して多めに取得
  });

  if (decisions.length === 0) {
    // TopStrategyから高スコア戦略を取得（フォールバック、自分のデータのみ）
    const topStrategies = await prisma.topStrategy.findMany({
      where: { userId },
      orderBy: { totalScore: "desc" },
      take: limit,
    });

    return topStrategies.map((s) => ({
      name: s.name,
      reason: s.reason,
      howToObtain: s.howToObtain || undefined,
      question: s.question,
      scores: s.scores,
    }));
  }

  const strategies: {
    name: string;
    reason: string;
    howToObtain?: string;
    question: string;
    scores?: string;
  }[] = [];

  // ランキングからの採用と探索からの採用を分離
  const rankingDecisions = decisions.filter((d) => d.explorationId.startsWith("ranking-"));
  const explorationDecisions = decisions.filter((d) => !d.explorationId.startsWith("ranking-"));

  // ランキングから採用された戦略を探索結果から取得
  // 注: ランキングはExploration.resultからパースされるため、同じソースを使用
  if (rankingDecisions.length > 0) {
    const strategyNames = new Set(rankingDecisions.map((d) => d.strategyName));

    // 完了した探索から戦略を検索
    const explorations = await prisma.exploration.findMany({
      where: { status: "completed", userId },
      orderBy: { createdAt: "desc" },
    });

    let foundCount = 0;
    for (const exploration of explorations) {
      if (!exploration.result) continue;
      try {
        const result = JSON.parse(exploration.result);
        if (!result.strategies) continue;

        for (const strategy of result.strategies) {
          if (strategyNames.has(strategy.name) && !strategies.some((s) => s.name === strategy.name)) {
            strategies.push({
              name: strategy.name,
              reason: strategy.reason || "",
              howToObtain: strategy.howToObtain,
              question: exploration.question,
              scores: strategy.scores ? JSON.stringify(strategy.scores) : undefined,
            });
            foundCount++;
            if (strategies.length >= limit) break;
          }
        }
      } catch {
        // JSON parse error - skip
      }
      if (strategies.length >= limit) break;
    }
  }

  // 探索から採用された戦略をExplorationから取得
  if (strategies.length < limit && explorationDecisions.length > 0) {
    const explorationIds = [...new Set(explorationDecisions.map((d) => d.explorationId))];
    const explorations = await prisma.exploration.findMany({
      where: { id: { in: explorationIds } },
    });

    const explorationMap = new Map(explorations.map((e) => [e.id, e]));

    for (const decision of explorationDecisions) {
      const exploration = explorationMap.get(decision.explorationId);
      if (!exploration?.result) continue;

      try {
        const result = JSON.parse(exploration.result);
        const strategy = result.strategies?.find(
          (s: { name: string }) => s.name === decision.strategyName
        );

        if (strategy && !strategies.some((s) => s.name === strategy.name)) {
          strategies.push({
            name: strategy.name,
            reason: strategy.reason || "",
            howToObtain: strategy.howToObtain,
            question: exploration.question,
            scores: strategy.scores ? JSON.stringify(strategy.scores) : undefined,
          });

          if (strategies.length >= limit) break;
        }
      } catch {
        // JSON parse error - skip
      }
    }
  }

  return strategies;
}

// AIで進化生成を実行
async function evolveStrategies(
  strategies: { name: string; reason: string; howToObtain?: string; question: string }[],
  mode: EvolveMode,
  coreServices: string,
  coreAssets: string
): Promise<EvolveResult> {
  const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: "2024-08-01-preview",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  });

  const strategiesText = strategies
    .map(
      (s, i) =>
        `${i + 1}. ${s.name}
   元の問い: ${s.question}
   なぜ勝てる: ${s.reason}
   ${s.howToObtain ? `実現ステップ: ${s.howToObtain}` : ""}`
    )
    .join("\n\n");

  const modeInstructions = {
    mutation: `
## 変異生成（Mutation）
各戦略の一部要素だけを変えて、新しい戦略を生成してください。
変更する要素の例：
- 顧客セグメント（B2B→B2C、大企業→中小企業など）
- 課金モデル（サブスク→従量課金、買い切り→レンタルなど）
- 提供価値（コスト削減→売上向上、効率化→品質向上など）
- 技術基盤（オンプレ→クラウド、手動→自動化など）

各元戦略から1〜2個の変異を生成してください。`,

    crossover: `
## 交叉生成（Crossover）
複数の戦略の良い要素を組み合わせて、新しい戦略を生成してください。
組み合わせの例：
- 戦略Aの顧客セグメント × 戦略Bの収益モデル
- 戦略Aの技術基盤 × 戦略Bの提供価値
- 戦略Aの強み × 戦略Bのチャネル

3〜5個の交叉戦略を生成してください。`,

    refutation: `
## 反証生成（Refutation）
各戦略の弱点・リスクを特定し、それを克服した改良版を生成してください。
検討する弱点の例：
- 競合優位性の脆弱さ
- 実行上のボトルネック
- 市場の不確実性
- 技術的な制約
- 組織的な障壁

各元戦略の弱点を克服した改良版を生成してください。`,

    all: `
## 3種類の進化生成を実行

### 1. 変異生成（Mutation）
各戦略の一部要素を変えて新戦略を生成

### 2. 交叉生成（Crossover）
複数の戦略の要素を組み合わせて新戦略を生成

### 3. 反証生成（Refutation）
各戦略の弱点を克服した改良版を生成

各タイプ2〜3個ずつ、合計6〜9個の新戦略を生成してください。`,
  };

  const prompt = `あなたは戦略コンサルタントです。以下の採用された戦略を基に、進化した新戦略を生成してください。

## 採用済み戦略（ベースとなる成功戦略）
${strategiesText}

## 企業の資産・強み
${coreServices || "未登録"}
${coreAssets || "未登録"}

${modeInstructions[mode]}

## 出力形式（JSON）
{
  "strategies": [
    {
      "name": "新戦略名",
      "reason": "なぜこの新戦略が勝てるか",
      "howToObtain": "具体的な実現ステップ",
      "metrics": "成功を測る指標",
      "sourceStrategies": ["元になった戦略名1", "元になった戦略名2"],
      "evolveType": "mutation" | "crossover" | "refutation",
      "improvement": "元戦略からの改善点・進化ポイント",
      "scores": {
        "revenuePotential": 1-5の数値,
        "timeToRevenue": 1-5の数値,
        "competitiveAdvantage": 1-5の数値,
        "executionFeasibility": 1-5の数値,
        "hqContribution": 1-5の数値,
        "mergerSynergy": 1-5の数値
      }
    }
  ],
  "thinkingProcess": "どのような思考で進化戦略を導いたか"
}

## スコア評価基準（各1-5点）
- revenuePotential: 収益ポテンシャル
- timeToRevenue: 収益化までの距離（近いほど高得点）
- competitiveAdvantage: 勝ち筋の強さ
- executionFeasibility: 実行可能性
- hqContribution: 本社貢献
- mergerSynergy: 合併シナジー

重要：
- 元の戦略の良さを活かしつつ、明確な改善点を持つ戦略を生成
- 実行可能性を重視し、絵に描いた餅にならないように
- 各戦略の元になった戦略を明記すること
- 各戦略に6項目のスコアを必ず付けること`;

  console.log("[Evolve] Starting Azure OpenAI request...");
  console.log("[Evolve] Strategies count:", strategies.length);

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8, // 創造性を高める
    max_completion_tokens: 8000, // 十分なトークン数を確保
    response_format: { type: "json_object" },
  });

  console.log("[Evolve] Response received");
  const choice = response.choices[0];
  console.log("[Evolve] Finish reason:", choice?.finish_reason);
  console.log("[Evolve] Usage:", JSON.stringify(response.usage));

  // Azure OpenAI のコンテンツフィルタリングチェック
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentFilterResults = (choice as any)?.content_filter_results;
  if (contentFilterResults) {
    console.log("[Evolve] Content filter results:", JSON.stringify(contentFilterResults));
  }

  const content = choice?.message?.content;
  if (!content) {
    console.error("[Evolve] No content in response.");
    console.error("[Evolve] Choice:", JSON.stringify(choice, null, 2));

    // フィニッシュ理由を確認
    if (choice?.finish_reason === "content_filter") {
      throw new Error("AIの応答がコンテンツフィルタによりブロックされました");
    }
    if (choice?.finish_reason === "length") {
      throw new Error("AIの応答が長すぎてトークン制限に達しました");
    }
    throw new Error("AIからの応答がありませんでした");
  }

  console.log("[Evolve] Content length:", content.length);

  try {
    return JSON.parse(content) as EvolveResult;
  } catch {
    throw new Error("Failed to parse AI response");
  }
}

// スコアから加重平均を計算
function calculateTotalScore(scores: {
  revenuePotential: number;
  timeToRevenue: number;
  competitiveAdvantage: number;
  executionFeasibility: number;
  hqContribution: number;
  mergerSynergy: number;
}): number {
  // デフォルトの重み（均等）
  const weights = {
    revenuePotential: 1,
    timeToRevenue: 1,
    competitiveAdvantage: 1,
    executionFeasibility: 1,
    hqContribution: 1,
    mergerSynergy: 1,
  };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightedSum =
    scores.revenuePotential * weights.revenuePotential +
    scores.timeToRevenue * weights.timeToRevenue +
    scores.competitiveAdvantage * weights.competitiveAdvantage +
    scores.executionFeasibility * weights.executionFeasibility +
    scores.hqContribution * weights.hqContribution +
    scores.mergerSynergy * weights.mergerSynergy;
  return weightedSum / totalWeight;
}

// POST: 進化生成を実行（ユーザー別）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode: EvolveMode = body.mode || "all";
    const limit = body.limit || 5;

    const user = await getCurrentUser();

    // 採用された戦略を取得（自分のデータのみ）
    const strategies = await getAdoptedStrategies(user.id, limit);

    if (strategies.length === 0) {
      return NextResponse.json(
        { error: "採用された戦略がありません。まず探索で戦略を採用してください。" },
        { status: 400 }
      );
    }

    // コア情報を取得
    const [coreServices, coreAssets] = await Promise.all([
      prisma.coreService.findMany(),
      prisma.coreAsset.findMany(),
    ]);

    const servicesText = coreServices
      .map((s) => `- ${s.name}${s.category ? ` (${s.category})` : ""}`)
      .join("\n");

    const assetsText = coreAssets
      .map((a) => `- ${a.name} [${a.type}]`)
      .join("\n");

    // 進化生成を実行
    const result = await evolveStrategies(strategies, mode, servicesText, assetsText);

    // スコアを計算して戦略に追加
    const strategiesWithScores = result.strategies.map((s) => {
      if (s.scores) {
        const totalScore = calculateTotalScore(s.scores);
        return { ...s, totalScore };
      }
      return s;
    });

    // 探索として保存（ユーザー情報付き）
    const exploration = await prisma.exploration.create({
      data: {
        question: `[進化生成] ${mode}モード - ${strategies.slice(0, 3).map((s) => s.name).join(", ")}から`,
        context: `[進化生成] 元戦略: ${strategies.map((s) => s.name).join(", ")}`,
        constraints: "[]",
        status: "completed",
        userId: user.id,
        userName: user.name,
        result: JSON.stringify({
          strategies: strategiesWithScores.map((s) => ({
            name: s.name,
            reason: s.reason,
            howToObtain: s.howToObtain,
            metrics: s.metrics,
            scores: s.scores,
            totalScore: s.totalScore,
            confidence: "medium",
            tags: [s.evolveType, "進化生成"],
          })),
          thinkingProcess: result.thinkingProcess,
          evolveMetadata: {
            mode,
            sourceStrategies: strategies.map((s) => s.name),
          },
        }),
      },
    });

    // 高スコア（4.0以上）の戦略をランキング（TopStrategy）に自動登録（ユーザー別）
    let archivedCount = 0;
    for (const strategy of strategiesWithScores) {
      if (strategy.totalScore && strategy.totalScore >= 4.0 && strategy.scores) {
        // 既存チェック（自分のデータのみ）
        const existing = await prisma.topStrategy.findFirst({
          where: { userId: user.id, name: strategy.name },
        });

        if (!existing) {
          await prisma.topStrategy.create({
            data: {
              explorationId: exploration.id,
              name: strategy.name,
              reason: strategy.reason,
              howToObtain: strategy.howToObtain,
              totalScore: strategy.totalScore,
              scores: JSON.stringify(strategy.scores),
              question: `[進化生成] ${strategy.evolveType}`,
              judgment: "",
              userId: user.id,
              userName: user.name,
            },
          });
          archivedCount++;
        }
      }
    }

    console.log(`[Evolve] Archived ${archivedCount} high-score strategies to ranking`);

    return NextResponse.json({
      success: true,
      mode,
      sourceCount: strategies.length,
      generatedCount: strategiesWithScores.length,
      archivedCount,
      strategies: strategiesWithScores,
      thinkingProcess: result.thinkingProcess,
      explorationId: exploration.id,
    });
  } catch (error) {
    console.error("Evolve error:", error);
    return NextResponse.json(
      { error: "進化生成に失敗しました" },
      { status: 500 }
    );
  }
}

// GET: 進化生成の情報を取得（ユーザー別）
export async function GET() {
  try {
    const user = await getCurrentUser();

    // 採用された戦略数を取得（自分のデータのみ）
    const adoptedCount = await prisma.strategyDecision.count({
      where: { userId: user.id, decision: "adopt" },
    });

    // TopStrategy数を取得（自分のデータのみ）
    const topStrategyCount = await prisma.topStrategy.count({
      where: { userId: user.id },
    });

    // 最近の進化生成を取得（戦略情報も含む、自分のデータのみ）
    const recentEvolutionsRaw = await prisma.exploration.findMany({
      where: {
        userId: user.id,
        question: { startsWith: "[進化生成]" },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        question: true,
        createdAt: true,
        result: true,
      },
    });

    // 戦略情報をパースして追加
    const recentEvolutions = recentEvolutionsRaw.map((evolution) => {
      let strategies: {
        name: string;
        evolveType: string;
        sourceStrategies: string[];
        totalScore?: number;
      }[] = [];

      if (evolution.result) {
        try {
          const parsed = JSON.parse(evolution.result);
          strategies = (parsed.strategies || []).map((s: {
            name: string;
            evolveType?: string;
            tags?: string[];
            sourceStrategies?: string[];
            totalScore?: number;
          }) => ({
            name: s.name,
            evolveType: s.evolveType || (s.tags?.find((t: string) => ["mutation", "crossover", "refutation"].includes(t)) || "unknown"),
            sourceStrategies: s.sourceStrategies || parsed.evolveMetadata?.sourceStrategies || [],
            totalScore: s.totalScore,
          }));
        } catch {
          // パース失敗時は空配列
        }
      }

      return {
        id: evolution.id,
        question: evolution.question,
        createdAt: evolution.createdAt,
        strategies,
      };
    });

    return NextResponse.json({
      canEvolve: adoptedCount > 0 || topStrategyCount > 0,
      adoptedCount,
      topStrategyCount,
      recentEvolutions,
    });
  } catch (error) {
    console.error("Evolve GET error:", error);
    return NextResponse.json(
      { error: "情報取得に失敗しました" },
      { status: 500 }
    );
  }
}
