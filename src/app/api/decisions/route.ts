import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// 採否を記録
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { explorationId, strategyName, decision, reason, feasibilityNote } = body;

    // バリデーション
    if (!explorationId || !strategyName || !decision) {
      return NextResponse.json(
        { error: "explorationId, strategyName, decision は必須です" },
        { status: 400 }
      );
    }

    if (!["adopt", "reject", "pending"].includes(decision)) {
      return NextResponse.json(
        { error: "decision は adopt, reject, pending のいずれかです" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();

    // upsert: 既存なら更新、なければ作成（ユーザーごとに独立）
    const result = await prisma.strategyDecision.upsert({
      where: {
        explorationId_strategyName_userId: {
          explorationId,
          strategyName,
          userId,
        },
      },
      update: {
        decision,
        reason: reason || null,
        feasibilityNote: feasibilityNote || null,
      },
      create: {
        explorationId,
        strategyName,
        decision,
        reason: reason || null,
        feasibilityNote: feasibilityNote || null,
        userId,
      },
    });

    return NextResponse.json({
      success: true,
      decision: result,
    });
  } catch (error) {
    console.error("Decision POST error:", error);
    return NextResponse.json(
      { error: "採否の記録に失敗しました" },
      { status: 500 }
    );
  }
}

// 採否ログを取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const explorationId = searchParams.get("explorationId");
    const decisionFilter = searchParams.get("decision");
    const stats = searchParams.get("stats") === "true";

    const userId = await getCurrentUserId();

    // 統計情報を返す（自分のデータのみ）
    if (stats) {
      const [total, adopted, rejected, pending] = await Promise.all([
        prisma.strategyDecision.count({ where: { userId } }),
        prisma.strategyDecision.count({ where: { userId, decision: "adopt" } }),
        prisma.strategyDecision.count({ where: { userId, decision: "reject" } }),
        prisma.strategyDecision.count({ where: { userId, decision: "pending" } }),
      ]);

      // よくある却下理由を取得
      const rejectReasons = await prisma.strategyDecision.findMany({
        where: { userId, decision: "reject", reason: { not: null } },
        select: { reason: true },
        take: 100,
      });

      // 理由をカウント
      const reasonCounts: Record<string, number> = {};
      rejectReasons.forEach((r) => {
        if (r.reason) {
          reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
        }
      });

      const topRejectReasons = Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }));

      return NextResponse.json({
        stats: {
          total,
          adopted,
          rejected,
          pending,
          adoptionRate: total > 0 ? ((adopted / total) * 100).toFixed(1) : 0,
          topRejectReasons,
        },
      });
    }

    // 特定のExplorationの採否を取得（自分のデータのみ）
    if (explorationId) {
      const decisions = await prisma.strategyDecision.findMany({
        where: { explorationId, userId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ decisions });
    }

    // フィルター付き一覧取得（自分のデータのみ）
    const where = decisionFilter
      ? { decision: decisionFilter, userId }
      : { userId };
    const decisions = await prisma.strategyDecision.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ decisions });
  } catch (error) {
    console.error("Decision GET error:", error);
    return NextResponse.json(
      { error: "採否ログの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 採否を削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("clearAll");
    const clearRanking = searchParams.get("clearRanking");

    const userId = await getCurrentUserId();

    // ランキングの採否をすべてクリア（自分のデータのみ）
    if (clearRanking === "true") {
      const result = await prisma.strategyDecision.deleteMany({
        where: {
          userId,
          explorationId: { startsWith: "ranking-" },
        },
      });
      return NextResponse.json({ success: true, deleted: result.count });
    }

    // すべての採否をクリア（自分のデータのみ）
    if (clearAll === "true") {
      const result = await prisma.strategyDecision.deleteMany({
        where: { userId },
      });
      return NextResponse.json({ success: true, deleted: result.count });
    }

    // explorationId + strategyName で削除（自分のデータのみ）
    const explorationId = searchParams.get("explorationId");
    const strategyName = searchParams.get("strategyName");
    if (explorationId && strategyName) {
      const result = await prisma.strategyDecision.deleteMany({
        where: {
          explorationId,
          strategyName,
          userId,
        },
      });
      return NextResponse.json({ success: true, deleted: result.count });
    }

    // 個別削除（idで）- 自分のデータのみ
    if (!id) {
      return NextResponse.json(
        { error: "id または explorationId + strategyName は必須です" },
        { status: 400 }
      );
    }

    const decision = await prisma.strategyDecision.findUnique({
      where: { id },
    });

    if (!decision) {
      return NextResponse.json(
        { error: "採否記録が見つかりません" },
        { status: 404 }
      );
    }

    if (decision.userId !== userId) {
      return NextResponse.json(
        { error: "他のユーザーの採否記録は削除できません" },
        { status: 403 }
      );
    }

    await prisma.strategyDecision.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Decision DELETE error:", error);
    return NextResponse.json(
      { error: "採否の削除に失敗しました" },
      { status: 500 }
    );
  }
}
