import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { AzureOpenAI } from "openai";
import { getCurrentUserId } from "@/lib/auth";

// GET: 保存済みのまとめを取得（ファインダー別）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const finderId = searchParams.get("finderId") || null;
    const userId = await getCurrentUserId();

    // 最新のまとめを取得
    const summary = await prisma.exploreSummary.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // 探索データの統計（ファインダー別）
    const explorationCount = await prisma.exploration.count({
      where: { userId, finderId },
    });

    const topStrategiesCount = await prisma.topStrategy.count({
      where: { userId, finderId },
    });

    return NextResponse.json({
      summary: summary
        ? {
            id: summary.id,
            content: summary.content,
            stats: JSON.parse(summary.stats || "{}"),
            createdAt: summary.createdAt,
          }
        : null,
      currentStats: {
        explorationCount,
        topStrategiesCount,
      },
    });
  } catch (error) {
    console.error("Summary GET error:", error);
    return NextResponse.json(
      { error: "まとめの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: AIでまとめを生成（ファインダー別）
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const finderId: string | null = body.finderId || null;
    const userId = await getCurrentUserId();

    // 探索履歴を取得（ファインダー別）
    const explorations = await prisma.exploration.findMany({
      where: { userId, finderId, status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 50, // 最新50件
    });

    if (explorations.length === 0) {
      return NextResponse.json(
        { error: "まとめを生成するための探索データがありません。まず「勝ち筋探索」で探索を行ってください。" },
        { status: 400 }
      );
    }

    // トップ戦略を取得（ファインダー別）
    const topStrategies = await prisma.topStrategy.findMany({
      where: { userId, finderId },
      orderBy: { totalScore: "desc" },
      take: 20,
    });

    // 採否データを取得（ファインダー別）
    const decisions = await prisma.strategyDecision.findMany({
      where: { userId, finderId },
      orderBy: { createdAt: "desc" },
    });

    const adoptedStrategies = decisions.filter((d) => d.decision === "adopt");
    const rejectedStrategies = decisions.filter((d) => d.decision === "reject");

    // 探索データを整理
    const explorationSummaries = explorations.map((e) => {
      let strategies: { name: string; reason: string; totalScore?: number }[] = [];
      try {
        const result = JSON.parse(e.result || "{}");
        strategies = (result.strategies || []).slice(0, 3).map((s: { name: string; reason: string; totalScore?: number }) => ({
          name: s.name,
          reason: s.reason?.substring(0, 100) || "",
          totalScore: s.totalScore,
        }));
      } catch {
        // JSON parse error
      }
      return {
        question: e.question,
        topStrategies: strategies,
      };
    });

    // AIプロンプト作成
    const prompt = `あなたは戦略コンサルタントです。以下のデータを分析し、包括的なまとめを日本語で作成してください。

## 探索履歴（${explorations.length}件）
${explorationSummaries
  .slice(0, 20)
  .map(
    (e, i) => `${i + 1}. 問い: ${e.question}
   上位戦略: ${e.topStrategies.map((s) => s.name).join(", ") || "なし"}`
  )
  .join("\n")}

## トップ戦略（スコア上位${topStrategies.length}件）
${topStrategies.map((s, i) => `${i + 1}. ${s.name} (スコア: ${s.totalScore?.toFixed(1) || "N/A"})`).join("\n")}

## 採用された戦略（${adoptedStrategies.length}件）
${adoptedStrategies.slice(0, 10).map((d) => `- ${d.strategyName}`).join("\n") || "なし"}

## 却下された戦略（${rejectedStrategies.length}件）
${rejectedStrategies.slice(0, 10).map((d) => `- ${d.strategyName}`).join("\n") || "なし"}

## 出力形式（JSON）
以下の形式で出力してください：
{
  "executiveSummary": "経営者向けの要約（3-4文）",
  "keyFindings": [
    "主要な発見1",
    "主要な発見2",
    "主要な発見3"
  ],
  "topRecommendations": [
    {
      "title": "推奨事項のタイトル",
      "description": "詳細説明（1-2文）",
      "priority": "high" | "medium" | "low"
    }
  ],
  "patterns": {
    "strengths": ["強みとして繰り返し現れるパターン"],
    "opportunities": ["機会として特定されたパターン"],
    "risks": ["注意すべきリスクパターン"]
  },
  "nextSteps": ["次に取るべきアクション1", "次に取るべきアクション2"]
}`;

    const client = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: "2024-08-01-preview",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    });

    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_completion_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "AIからの応答がありませんでした" },
        { status: 500 }
      );
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "AIの応答を解析できませんでした" },
        { status: 500 }
      );
    }

    // まとめをDBに保存
    const stats = {
      explorationCount: explorations.length,
      topStrategiesCount: topStrategies.length,
      adoptedCount: adoptedStrategies.length,
      rejectedCount: rejectedStrategies.length,
    };

    const savedSummary = await prisma.exploreSummary.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        content: JSON.stringify(parsedContent),
        stats: JSON.stringify(stats),
      },
    });

    return NextResponse.json({
      success: true,
      summary: {
        id: savedSummary.id,
        content: parsedContent,
        stats,
        createdAt: savedSummary.createdAt,
      },
    });
  } catch (error) {
    console.error("Summary POST error:", error);
    return NextResponse.json(
      { error: "まとめの生成に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: まとめを削除（ファインダー別）
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const finderId = searchParams.get("finderId") || null;
    const userId = await getCurrentUserId();

    await prisma.exploreSummary.deleteMany({
      where: { userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Summary DELETE error:", error);
    return NextResponse.json(
      { error: "まとめの削除に失敗しました" },
      { status: 500 }
    );
  }
}
