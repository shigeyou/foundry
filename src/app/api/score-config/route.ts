import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { getDefaultWeights } from "@/config/finder-config";

// GET: ユーザーのスコア設定を取得
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const finderId = request.nextUrl.searchParams.get("finderId") || "winning-strategy";

    const config = await prisma.userScoreConfig.findUnique({
      where: { userId_finderId: { userId, finderId } },
    });

    if (!config) {
      return NextResponse.json({
        config: null,
        weights: getDefaultWeights(finderId),
        isDefault: true,
      });
    }

    return NextResponse.json({
      config: {
        id: config.id,
        userId: config.userId,
        finderId: config.finderId,
        updatedAt: config.updatedAt,
      },
      weights: JSON.parse(config.weightsJson),
      isDefault: false,
    });
  } catch (error) {
    console.error("Score config GET error:", error);
    return NextResponse.json(
      { error: "スコア設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: ユーザーのスコア設定を保存
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();

    const { finderId: bodyFinderId, ...weights } = body;
    const finderId = bodyFinderId || "winning-strategy";

    // バリデーション: 全ての値が0〜100の数値であること
    for (const [key, value] of Object.entries(weights)) {
      if (typeof value !== "number" || value < 0 || value > 100) {
        return NextResponse.json(
          { error: `重みは0〜100の数値で指定してください (${key}: ${value})` },
          { status: 400 }
        );
      }
    }

    const weightsJson = JSON.stringify(weights);

    const config = await prisma.userScoreConfig.upsert({
      where: { userId_finderId: { userId, finderId } },
      update: { weightsJson },
      create: { userId, finderId, weightsJson },
    });

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        userId: config.userId,
        finderId: config.finderId,
        updatedAt: config.updatedAt,
      },
      weights,
    });
  } catch (error) {
    console.error("Score config POST error:", error);
    return NextResponse.json(
      { error: "スコア設定の保存に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: ユーザーのスコア設定を削除（デフォルトに戻す）
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const finderId = request.nextUrl.searchParams.get("finderId") || "winning-strategy";

    await prisma.userScoreConfig.deleteMany({
      where: { userId, finderId },
    });

    return NextResponse.json({
      success: true,
      message: "スコア設定をデフォルトに戻しました",
    });
  } catch (error) {
    console.error("Score config DELETE error:", error);
    return NextResponse.json(
      { error: "スコア設定の削除に失敗しました" },
      { status: 500 }
    );
  }
}
