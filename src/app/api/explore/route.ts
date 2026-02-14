import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWinningStrategies } from "@/lib/claude";
import { generateRAGContext } from "@/lib/rag";
import { getCurrentUser } from "@/lib/auth";

// Background task runner (using Promise to not block the response)
async function runExplorationInBackground(explorationId: string, question: string, context: string, constraintIds: string[], finderId?: string) {
  try {
    // Fetch data in parallel
    const [coreServices, coreAssets, defaultConstraints, ragContext] =
      await Promise.all([
        prisma.coreService.findMany(),
        prisma.coreAsset.findMany(),
        prisma.constraint.findMany({ where: { isDefault: true } }),
        generateRAGContext(),
      ]);

    // Format core services
    const servicesText = coreServices
      .map(
        (s) =>
          `- ${s.name}${s.category ? ` (${s.category})` : ""}${s.description ? `: ${s.description}` : ""}`
      )
      .join("\n");

    // Format core assets
    const assetsText = coreAssets
      .map(
        (a) =>
          `- ${a.name} [${a.type}]${a.description ? `: ${a.description}` : ""}`
      )
      .join("\n");

    // Format constraints
    const constraintsText = defaultConstraints
      .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`)
      .join("\n");

    // Generate strategies (finderId に応じたプロンプトを使用)
    const result = await generateWinningStrategies(
      question,
      context || "",
      servicesText,
      assetsText,
      constraintsText,
      ragContext,
      finderId
    );

    // Update exploration with result
    await prisma.exploration.update({
      where: { id: explorationId },
      data: {
        status: "completed",
        result: JSON.stringify(result),
      },
    });

    console.log(`Exploration ${explorationId} completed`);
  } catch (error) {
    console.error(`Exploration ${explorationId} failed:`, error);

    // Update exploration with error
    await prisma.exploration.update({
      where: { id: explorationId },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, context, constraintIds, background, finderId } = body;

    if (!question || question.trim() === "") {
      return NextResponse.json(
        { error: "問いを入力してください" },
        { status: 400 }
      );
    }

    // ユーザー情報を取得
    const user = await getCurrentUser();

    // Background mode: create record and return immediately
    if (background) {
      const exploration = await prisma.exploration.create({
        data: {
          id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          question,
          context: context || null,
          constraints: JSON.stringify(constraintIds || []),
          status: "processing",
          result: null,
          userId: user.id,
          userName: user.name,
          finderId: finderId || null,
        },
      });

      // Start background processing (don't await)
      runExplorationInBackground(exploration.id, question, context || "", constraintIds || [], finderId);

      return NextResponse.json({
        id: exploration.id,
        status: "processing",
        message: "探索を開始しました。バックグラウンドで処理中です。",
      });
    }

    // Synchronous mode (existing behavior)
    const [coreServices, coreAssets, defaultConstraints, ragContext] =
      await Promise.all([
        prisma.coreService.findMany(),
        prisma.coreAsset.findMany(),
        prisma.constraint.findMany({ where: { isDefault: true } }),
        generateRAGContext(),
      ]);

    const servicesText = coreServices
      .map(
        (s) =>
          `- ${s.name}${s.category ? ` (${s.category})` : ""}${s.description ? `: ${s.description}` : ""}`
      )
      .join("\n");

    const assetsText = coreAssets
      .map(
        (a) =>
          `- ${a.name} [${a.type}]${a.description ? `: ${a.description}` : ""}`
      )
      .join("\n");

    const constraintsText = defaultConstraints
      .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`)
      .join("\n");

    const result = await generateWinningStrategies(
      question,
      context || "",
      servicesText,
      assetsText,
      constraintsText,
      ragContext,
      finderId
    );

    await prisma.exploration.create({
      data: {
        id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        question,
        context: context || null,
        constraints: JSON.stringify(constraintIds || []),
        status: "completed",
        result: JSON.stringify(result),
        userId: user.id,
        userName: user.name,
        finderId: finderId || null,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Exploration error:", error);
    return NextResponse.json(
      { error: "探索中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// GET: Check exploration status or find processing explorations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status");

    // processing中の探索を返す（ページ再訪問時の復帰用）
    if (status === "processing") {
      const processing = await prisma.exploration.findFirst({
        where: { status: "processing" },
        orderBy: { createdAt: "desc" },
      });

      if (processing) {
        return NextResponse.json({
          id: processing.id,
          status: processing.status,
          question: processing.question,
          result: null,
          createdAt: processing.createdAt,
        });
      }
      return NextResponse.json({ id: null, status: "none" });
    }

    if (!id) {
      return NextResponse.json(
        { error: "探索IDが必要です" },
        { status: 400 }
      );
    }

    const exploration = await prisma.exploration.findUnique({
      where: { id },
    });

    if (!exploration) {
      return NextResponse.json(
        { error: "探索が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: exploration.id,
      status: exploration.status,
      question: exploration.question,
      result: exploration.result ? JSON.parse(exploration.result) : null,
      error: exploration.error,
      createdAt: exploration.createdAt,
    });
  } catch (error) {
    console.error("Exploration status error:", error);
    return NextResponse.json(
      { error: "ステータス取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
