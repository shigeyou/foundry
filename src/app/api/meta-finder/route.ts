import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/claude";
import { SINGLE_PROMPT, normalizeScore, type DiscoveredNeed } from "@/lib/meta-finder-prompt";

interface SingleDiscoveredNeed extends DiscoveredNeed {
  sourceDocuments: string[];
}

interface MetaFinderResult {
  needs: SingleDiscoveredNeed[];
  thinkingProcess: string;
  summary: string;
}

// GET: 保存された分析結果を取得
export async function GET() {
  try {
    const results = await prisma.metaAnalysisRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Failed to fetch meta-finder results:", error);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}

// POST: 新しい分析を実行
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const additionalContext = body.additionalContext || "";
    const themeId = body.themeId || "holistic";
    const themeName = body.themeName || "全部入り（本質探索）";
    const deptId = body.deptId || "all";
    const deptName = body.deptName || "全社";

    // docs/summaries/ からドキュメントを取得
    const ragDocuments = await prisma.rAGDocument.findMany({
      select: {
        filename: true,
        content: true,
      },
    });

    if (ragDocuments.length === 0) {
      return NextResponse.json(
        { error: "分析対象のドキュメントがありません。docs/summaries/ にドキュメントを追加してください。" },
        { status: 400 }
      );
    }

    // ドキュメントをプロンプト用にフォーマット
    let documentContext = "## 分析対象ドキュメント\n\n";
    for (const doc of ragDocuments) {
      documentContext += `### ${doc.filename}\n${doc.content.slice(0, 5000)}\n\n`;
    }

    const userPrompt = `${documentContext}

${additionalContext ? `## 追加の指示\n${additionalContext}` : "## 指示\n上記のドキュメントを分析し、最も価値のある課題と打ち手を発見してください。"}`;

    const response = await generateWithClaude(
      `${SINGLE_PROMPT}\n\n${userPrompt}`,
      {
        temperature: 0.7,
        maxTokens: 8000,
        jsonMode: true,
      }
    );

    const parsed: MetaFinderResult = JSON.parse(response);

    // ★★★ BSCスコアを5点満点に強制正規化 ★★★
    const result: MetaFinderResult = {
      ...parsed,
      needs: parsed.needs.map((need) => ({
        ...need,
        financial: normalizeScore(need.financial),
        customer: normalizeScore(need.customer),
        process: normalizeScore(need.process),
        growth: normalizeScore(need.growth),
      })),
    };

    // ★★★ 探索履歴を永久保存 ★★★
    // 1. バッチレコードを作成（単発探索用）
    const batchId = `manual-${Date.now()}`;
    await prisma.metaFinderBatch.create({
      data: {
        id: batchId,
        status: "completed",
        totalPatterns: 1,
        completedPatterns: 1,
        totalIdeas: result.needs.length,
        currentTheme: themeName,
        currentDept: deptName,
        completedAt: new Date(),
      },
    });

    // 2. 各アイデアをMetaFinderIdeaテーブルに保存
    // ★★★ スコアリングルール：BSC 4視点の平均 ★★★
    // score = (financial + customer + process + growth) / 4
    // 結果: 1.0 〜 5.0 の小数（平均値）
    for (const need of result.needs) {
      const score = (need.financial + need.customer + need.process + need.growth) / 4;
      await prisma.metaFinderIdea.create({
        data: {
          id: `idea-${batchId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          batchId,
          themeId,
          themeName,
          deptId,
          deptName,
          name: need.name,
          description: need.description,
          actions: need.actions ? JSON.stringify(need.actions) : null,
          reason: need.reason,
          financial: need.financial,
          customer: need.customer,
          process: need.process,
          growth: need.growth,
          score,
        },
      });
    }

    // 3. 旧形式（MetaAnalysisRun）も互換性のため残す
    await prisma.metaAnalysisRun.create({
      data: {
        id: `meta-${Date.now()}`,
        totalExplorations: ragDocuments.length,
        totalStrategies: result.needs.length,
        topStrategies: JSON.stringify(result.needs.slice(0, 5)),
        frequentTags: JSON.stringify({}),
        clusters: JSON.stringify(result.needs.map(n => ({ name: n.name }))),
        blindSpots: JSON.stringify([]),
        thinkingProcess: result.thinkingProcess,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Meta-finder analysis failed:", error);
    return NextResponse.json(
      { error: "分析に失敗しました: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500 }
    );
  }
}
