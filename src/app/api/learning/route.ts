import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { AzureOpenAI } from "openai";
import { getCurrentUserId } from "@/lib/auth";

// 最低必要な採否件数（採用・却下それぞれ5件以上）
const MIN_ADOPT_REQUIRED = 5;
const MIN_REJECT_REQUIRED = 5;

// パターン抽出結果の型
interface ExtractedPattern {
  type: "success_pattern" | "failure_pattern";
  category: string;
  pattern: string;
  examples: string[];
  evidence: string;
  confidence: number;
}

// AIでパターンを抽出
async function extractPatternsWithAI(
  adoptedStrategies: { name: string; reason: string; question: string; decisionReason?: string }[],
  rejectedStrategies: { name: string; reason: string; question: string; decisionReason?: string }[]
): Promise<ExtractedPattern[]> {
  const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: "2024-08-01-preview",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  });

  const prompt = `あなたは戦略分析の専門家です。以下の採用された戦略と却下された戦略を分析し、成功パターンと失敗パターンを抽出してください。

## 採用された戦略（${adoptedStrategies.length}件）
${adoptedStrategies.map((s, i) => `${i + 1}. ${s.name}
   問い: ${s.question}
   理由: ${s.reason}
   ${s.decisionReason ? `採用理由: ${s.decisionReason}` : ""}`).join("\n\n")}

## 却下された戦略（${rejectedStrategies.length}件）
${rejectedStrategies.map((s, i) => `${i + 1}. ${s.name}
   問い: ${s.question}
   理由: ${s.reason}
   ${s.decisionReason ? `却下理由: ${s.decisionReason}` : ""}`).join("\n\n")}

## 分析指示
1. 採用された戦略に共通する特徴（成功パターン）を3〜5個抽出
2. 却下された戦略に共通する特徴（失敗パターン）を3〜5個抽出
3. 各パターンにカテゴリ（シナジー系、DX系、コスト系、新規事業系など）を付与
4. 確信度（0.0〜1.0）を評価

## 出力形式（JSON）
{
  "patterns": [
    {
      "type": "success_pattern" または "failure_pattern",
      "category": "カテゴリ名",
      "pattern": "パターンの説明（1-2文）",
      "examples": ["関連する戦略名1", "関連する戦略名2"],
      "evidence": "このパターンが有効/無効な根拠",
      "confidence": 0.0〜1.0
    }
  ]
}`;

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_completion_tokens: 16000,
    response_format: { type: "json_object" },
  });

  const choice = response.choices[0];
  const content = choice?.message?.content;
  console.log(`[Learning] OpenAI response: finish_reason=${choice?.finish_reason}, content_length=${content?.length ?? "null"}`);

  if (!content) {
    console.error("[Learning] OpenAI returned empty content. Full response:", JSON.stringify({
      id: response.id,
      model: response.model,
      finish_reason: choice?.finish_reason,
      usage: response.usage,
    }));
    return [];
  }

  try {
    const parsed = JSON.parse(content);
    if (!parsed.patterns || parsed.patterns.length === 0) {
      console.warn("[Learning] OpenAI returned JSON but no patterns:", content.substring(0, 500));
    }
    return parsed.patterns || [];
  } catch (e) {
    console.error("[Learning] Failed to parse OpenAI response as JSON:", String(e), "content:", content.substring(0, 500));
    return [];
  }
}

// POST: パターン抽出を実行（ユーザー別・ファインダー別）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const finderId: string | null = body.finderId || null;

    const userId = await getCurrentUserId();

    // 採否ログを取得（自分のデータ・ファインダー別、finderIdがnullのデータも含める）
    const finderIdFilter = finderId ? { OR: [{ finderId }, { finderId: null }] } : {};
    const decisions = await prisma.strategyDecision.findMany({
      where: {
        userId,
        ...finderIdFilter,
        decision: { in: ["adopt", "reject"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const adoptCount = decisions.filter(d => d.decision === "adopt").length;
    const rejectCount = decisions.filter(d => d.decision === "reject").length;

    if (adoptCount < MIN_ADOPT_REQUIRED || rejectCount < MIN_REJECT_REQUIRED) {
      return NextResponse.json(
        {
          error: `パターン抽出には採用${MIN_ADOPT_REQUIRED}件以上・却下${MIN_REJECT_REQUIRED}件以上が必要です（現在: 採用${adoptCount}件・却下${rejectCount}件）`,
          adoptCount,
          rejectCount,
          minAdoptRequired: MIN_ADOPT_REQUIRED,
          minRejectRequired: MIN_REJECT_REQUIRED,
        },
        { status: 400 }
      );
    }

    // 関連する探索結果を取得（自分のデータ・ファインダー別）
    const explorationIds = [...new Set(decisions.map((d) => d.explorationId))];
    const realExplorationIds = explorationIds.filter((id) => !id.startsWith("ranking-"));
    const explorations = await prisma.exploration.findMany({
      where: { id: { in: realExplorationIds }, userId, finderId },
    });

    const explorationMap = new Map(explorations.map((e) => [e.id, e]));

    // ランキングからの決定用にTopStrategyテーブルも取得（自分のデータ・ファインダー別）
    const rankingStrategyNames = decisions
      .filter((d) => d.explorationId.startsWith("ranking-"))
      .map((d) => d.strategyName);
    const topStrategies = await prisma.topStrategy.findMany({
      where: { name: { in: rankingStrategyNames }, userId, finderId },
    });
    const topStrategyMap = new Map(topStrategies.map((s) => [s.name, s]));

    // 採用/却下された戦略を分類
    const adoptedStrategies: { name: string; reason: string; question: string; decisionReason?: string }[] = [];
    const rejectedStrategies: { name: string; reason: string; question: string; decisionReason?: string }[] = [];

    for (const decision of decisions) {
      let item: { name: string; reason: string; question: string; decisionReason?: string } | null = null;

      // ランキングからの決定の場合
      if (decision.explorationId.startsWith("ranking-")) {
        const topStrategy = topStrategyMap.get(decision.strategyName);
        if (topStrategy) {
          item = {
            name: topStrategy.name,
            reason: topStrategy.reason || "",
            question: topStrategy.question || "",
            decisionReason: decision.reason || undefined,
          };
        }
      } else {
        // 探索履歴からの決定の場合
        const exploration = explorationMap.get(decision.explorationId);
        if (!exploration?.result) continue;

        try {
          const result = JSON.parse(exploration.result);
          const strategy = result.strategies?.find(
            (s: { name: string }) => s.name === decision.strategyName
          );

          if (strategy) {
            item = {
              name: strategy.name,
              reason: strategy.reason || "",
              question: exploration.question,
              decisionReason: decision.reason || undefined,
            };
          }
        } catch {
          // JSON parse error - skip
        }
      }

      if (item) {
        if (decision.decision === "adopt") {
          adoptedStrategies.push(item);
        } else {
          rejectedStrategies.push(item);
        }
      }
    }

    if (adoptedStrategies.length === 0 && rejectedStrategies.length === 0) {
      return NextResponse.json(
        { error: "有効な戦略データがありません" },
        { status: 400 }
      );
    }

    // AIでパターンを抽出
    const patterns = await extractPatternsWithAI(adoptedStrategies, rejectedStrategies);

    if (patterns.length === 0) {
      console.error("[Learning] extractPatternsWithAI returned 0 patterns. adopted:", adoptedStrategies.length, "rejected:", rejectedStrategies.length);
      return NextResponse.json(
        { error: "パターンを抽出できませんでした（OpenAIレスポンスが空でした。Azureログを確認してください）" },
        { status: 500 }
      );
    }

    // LearningMemoryに保存（重複チェック付き、ユーザー別・ファインダー別）
    let savedCount = 0;
    let updatedCount = 0;

    for (const pattern of patterns) {
      // 類似パターンを検索（自分のデータ・ファインダー別）
      const existing = await prisma.learningMemory.findFirst({
        where: {
          userId,
          type: pattern.type,
          category: pattern.category,
          pattern: { contains: pattern.pattern.substring(0, 20) },
        },
      });

      if (existing) {
        // 既存パターンを更新（確信度を上げる）
        await prisma.learningMemory.update({
          where: { id: existing.id },
          data: {
            validationCount: { increment: 1 },
            confidence: Math.min(1.0, existing.confidence + 0.1),
            examples: JSON.stringify([
              ...JSON.parse(existing.examples || "[]"),
              ...pattern.examples,
            ].slice(-10)), // 最新10件を保持
          },
        });
        updatedCount++;
      } else {
        // 新規パターンを作成（ユーザー情報・ファインダー情報付き）
        await prisma.learningMemory.create({
          data: {
            id: crypto.randomUUID(),
            type: pattern.type,
            category: pattern.category,
            pattern: pattern.pattern,
            examples: JSON.stringify(pattern.examples),
            evidence: pattern.evidence,
            confidence: pattern.confidence,
            isActive: true,
            userId,
          },
        });
        savedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      extracted: patterns.length,
      saved: savedCount,
      updated: updatedCount,
      patterns,
      stats: {
        adoptedCount: adoptedStrategies.length,
        rejectedCount: rejectedStrategies.length,
      },
    });
  } catch (error) {
    console.error("Learning extract error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `パターン抽出に失敗しました: ${detail}` },
      { status: 500 }
    );
  }
}

// GET: 学習パターンを取得（ユーザー別・ファインダー別）
export async function GET(request: NextRequest) {
  // 各ステップを個別にtry-catchして、どこで失敗するか特定
  let step = "init";
  try {
    step = "parse-params";
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // success_pattern | failure_pattern
    const activeOnly = searchParams.get("active") !== "false";
    const limit = parseInt(searchParams.get("limit") || "50");
    const finderId = searchParams.get("finderId") || null;

    step = "get-userId";
    const userId = await getCurrentUserId();

    const where: Record<string, unknown> = { userId };
    if (type) where.type = type;
    if (activeOnly) where.isActive = true;

    step = "findMany-learningMemory";
    let patterns: Awaited<ReturnType<typeof prisma.learningMemory.findMany>> = [];
    try {
      patterns = await prisma.learningMemory.findMany({
        where,
        orderBy: [{ confidence: "desc" }, { validationCount: "desc" }],
        take: limit,
      });
    } catch (e) {
      // テーブルが存在しない場合は空配列で続行
      console.error(`Learning GET: findMany failed (${String(e)}), using empty array`);
      patterns = [];
    }

    step = "count-patterns";
    let successPatternCount = 0;
    let failurePatternCount = 0;
    try {
      [successPatternCount, failurePatternCount] = await Promise.all([
        prisma.learningMemory.count({ where: { userId, isActive: true, type: "success_pattern" } }),
        prisma.learningMemory.count({ where: { userId, isActive: true, type: "failure_pattern" } }),
      ]);
    } catch (e) {
      console.error(`Learning GET: count patterns failed (${String(e)})`);
    }

    step = "count-decisions";
    let adoptCount = 0;
    let rejectCount = 0;
    try {
      // finderIdがnullのデータも含める（後方互換性）
      const finderIdFilter = finderId ? { OR: [{ finderId }, { finderId: null }] } : {};
      [adoptCount, rejectCount] = await Promise.all([
        prisma.strategyDecision.count({ where: { userId, ...finderIdFilter, decision: "adopt" } }),
        prisma.strategyDecision.count({ where: { userId, ...finderIdFilter, decision: "reject" } }),
      ]);
    } catch (e) {
      console.error(`Learning GET: count decisions failed (${String(e)})`);
    }

    const canExtract = adoptCount >= MIN_ADOPT_REQUIRED && rejectCount >= MIN_REJECT_REQUIRED;

    step = "build-response";
    return NextResponse.json({
      patterns: patterns.map((p) => {
        let examples: string[] = [];
        try {
          examples = JSON.parse(p.examples || "[]");
        } catch {
          examples = [];
        }
        return { ...p, examples };
      }),
      stats: {
        successPatterns: successPatternCount,
        failurePatterns: failurePatternCount,
        total: patterns.length,
      },
      decisionStats: {
        adoptCount,
        rejectCount,
        minAdoptRequired: MIN_ADOPT_REQUIRED,
        minRejectRequired: MIN_REJECT_REQUIRED,
        canExtract,
      },
    });
  } catch (error) {
    console.error(`Learning GET error at step [${step}]:`, error);
    return NextResponse.json(
      { error: `パターン取得に失敗しました (step: ${step})`, detail: String(error) },
      { status: 500 }
    );
  }
}

// PATCH: パターンの有効/無効を切り替え（自分のデータのみ）
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "id は必須です" }, { status: 400 });
    }

    const userId = await getCurrentUserId();

    // 自分のパターンか確認
    const pattern = await prisma.learningMemory.findUnique({ where: { id } });
    if (!pattern || pattern.userId !== userId) {
      return NextResponse.json(
        { error: "パターンが見つからないか、権限がありません" },
        { status: 403 }
      );
    }

    const updated = await prisma.learningMemory.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ success: true, pattern: updated });
  } catch (error) {
    console.error("Learning PATCH error:", error);
    return NextResponse.json(
      { error: "パターン更新に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: パターンを削除（自分のデータのみ）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id は必須です" }, { status: 400 });
    }

    const userId = await getCurrentUserId();

    // 自分のパターンか確認
    const pattern = await prisma.learningMemory.findUnique({ where: { id } });
    if (!pattern || pattern.userId !== userId) {
      return NextResponse.json(
        { error: "パターンが見つからないか、権限がありません" },
        { status: 403 }
      );
    }

    await prisma.learningMemory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Learning DELETE error:", error);
    return NextResponse.json(
      { error: "パターン削除に失敗しました" },
      { status: 500 }
    );
  }
}
