import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AzureOpenAI } from "openai";
import { getCurrentUser } from "@/lib/auth";

// GET: メタ分析履歴を取得（ユーザー別・ファインダー別）
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");
    const finderId = searchParams.get("finderId") || null;

    // finderIdがnullのデータも含める（後方互換性）
    const finderIdFilter = finderId ? { OR: [{ finderId }, { finderId: null }] } : {};

    // 自分のメタ分析履歴のみ取得（ファインダー別）
    const history = await prisma.metaAnalysisRun.findMany({
      where: { userId: user.id, ...finderIdFilter },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const parsed = history.map((run) => ({
      id: run.id,
      totalExplorations: run.totalExplorations,
      totalStrategies: run.totalStrategies,
      topStrategies: JSON.parse(run.topStrategies),
      frequentTags: JSON.parse(run.frequentTags),
      clusters: JSON.parse(run.clusters),
      blindSpots: JSON.parse(run.blindSpots),
      thinkingProcess: run.thinkingProcess,
      createdAt: run.createdAt,
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error fetching meta-analysis history:", error);
    return NextResponse.json(
      { error: "履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}

interface WinningStrategy {
  name: string;
  reason: string;
  howToObtain: string;
  metrics: string;
  confidence: string;
  tags: string[];
}

interface ExplorationResult {
  strategies: WinningStrategy[];
  thinkingProcess: string;
}

interface MetaAnalysisResult {
  totalExplorations: number;
  totalStrategies: number;
  topStrategies: {
    name: string;
    reason: string;
    frequency: number;
    relatedQuestions: string[];
  }[];
  frequentTags: { tag: string; count: number }[];
  clusters: {
    name: string;
    description: string;
    strategies: string[];
  }[];
  blindSpots: string[];
  thinkingProcess: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const finderId: string | null = body.finderId || null;

    const user = await getCurrentUser();

    // finderIdがnullのデータも含める（後方互換性）
    const finderIdFilter = finderId ? { OR: [{ finderId }, { finderId: null }] } : {};

    // 自分の探索履歴のみを取得（ファインダー別）
    const explorations = await prisma.exploration.findMany({
      where: { userId: user.id, ...finderIdFilter },
      orderBy: { createdAt: "desc" },
    });

    if (explorations.length === 0) {
      return NextResponse.json(
        { error: "分析対象の履歴がありません" },
        { status: 400 }
      );
    }

    // 全勝ち筋を抽出
    const allStrategies: { strategy: WinningStrategy; question: string }[] = [];
    const allTags: string[] = [];

    for (const exploration of explorations) {
      try {
        if (!exploration.result) continue;
        const result: ExplorationResult = JSON.parse(exploration.result);
        if (result.strategies) {
          for (const strategy of result.strategies) {
            allStrategies.push({
              strategy,
              question: exploration.question,
            });
            if (strategy.tags) {
              allTags.push(...strategy.tags);
            }
          }
        }
      } catch {
        // JSONパースエラーはスキップ
      }
    }

    if (allStrategies.length === 0) {
      return NextResponse.json(
        { error: "分析対象の勝ち筋がありません" },
        { status: 400 }
      );
    }

    // タグの頻度分析
    const tagCounts = new Map<string, number>();
    for (const tag of allTags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
    const frequentTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Azure OpenAIでメタ分析
    const client = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: "2024-08-01-preview",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    });

    const strategiesSummary = allStrategies
      .map(
        (s, i) =>
          `${i + 1}. 【${s.strategy.name}】\n   問い: ${s.question}\n   理由: ${s.strategy.reason}\n   タグ: ${s.strategy.tags?.join(", ") || "なし"}`
      )
      .join("\n\n");

    const systemPrompt = `あなたは「勝ち筋ファインダー」のメタ分析AIです。
複数の経営者が探索した勝ち筋を横断分析し、より高次の戦略的洞察を抽出します。

## あなたの役割
1. 複数の勝ち筋から共通パターンを発見
2. 重複・類似した勝ち筋をクラスタリング
3. 最も有望な「勝ち筋の勝ち筋」を特定
4. 探索されていない空白領域を指摘

## 出力形式
必ず以下のJSON形式で回答してください：
{
  "topStrategies": [
    {
      "name": "メタ勝ち筋名",
      "reason": "なぜこれが最重要か（複数の勝ち筋からの共通パターン）",
      "frequency": 類似の勝ち筋が何件あったか,
      "relatedQuestions": ["関連する問い1", "関連する問い2"]
    }
  ],
  "clusters": [
    {
      "name": "クラスタ名（例：DX推進系、コスト削減系）",
      "description": "このクラスタの特徴",
      "strategies": ["含まれる勝ち筋名1", "勝ち筋名2"]
    }
  ],
  "blindSpots": [
    "探索されていないが重要と思われる領域1",
    "領域2"
  ],
  "thinkingProcess": "どのような思考プロセスでこの分析を行ったか"
}

topStrategiesは5〜10件、clustersは3〜6件程度を目安にしてください。`;

    const userPrompt = `## 分析対象
探索回数: ${explorations.length}回
勝ち筋総数: ${allStrategies.length}件

## 頻出タグ
${frequentTags.map((t) => `${t.tag}: ${t.count}件`).join(", ")}

## 全勝ち筋リスト
${strategiesSummary}

上記の勝ち筋を横断分析し、「勝ち筋の勝ち筋」を抽出してください。`;

    console.log("Starting meta-analysis request...");
    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_completion_tokens: 8000,
      response_format: { type: "json_object" },
    });

    console.log("Meta-analysis response received");
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const aiResult = JSON.parse(content);

    const result: MetaAnalysisResult = {
      totalExplorations: explorations.length,
      totalStrategies: allStrategies.length,
      topStrategies: aiResult.topStrategies || [],
      frequentTags,
      clusters: aiResult.clusters || [],
      blindSpots: aiResult.blindSpots || [],
      thinkingProcess: aiResult.thinkingProcess || "",
    };

    // 履歴をデータベースに保存（ユーザー別・ファインダー別）
    const savedRun = await prisma.metaAnalysisRun.create({
      data: {
        id: `meta-${Date.now()}`,
        totalExplorations: result.totalExplorations,
        totalStrategies: result.totalStrategies,
        topStrategies: JSON.stringify(result.topStrategies),
        frequentTags: JSON.stringify(result.frequentTags),
        clusters: JSON.stringify(result.clusters),
        blindSpots: JSON.stringify(result.blindSpots),
        thinkingProcess: result.thinkingProcess,
        userId: user.id,
        userName: user.name,
        finderId,
      },
    });

    console.log("Meta-analysis saved with id:", savedRun.id);

    return NextResponse.json({ ...result, id: savedRun.id, createdAt: savedRun.createdAt });
  } catch (error) {
    console.error("Error in meta-analysis:", error);
    return NextResponse.json(
      { error: "メタ分析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
