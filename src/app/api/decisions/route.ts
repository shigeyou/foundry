import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// 採否を記録（ユーザー別・ファインダー別）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { explorationId, strategyName, decision, reason, feasibilityNote, finderId } = body;
    const finderIdValue: string | null = finderId || null;

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

    // upsert: 既存なら更新、なければ作成（ユーザーごと・ファインダーごとに独立）
    // Note: Prismaの複合ユニークキーはnullable fieldを含むため、findFirstで確認してから操作
    const existing = await prisma.strategyDecision.findFirst({
      where: {
        explorationId,
        strategyName,
        userId,
        finderId: finderIdValue,
      },
    });

    const result = existing
      ? await prisma.strategyDecision.update({
          where: { id: existing.id },
          data: {
            decision,
            reason: reason || null,
            feasibilityNote: feasibilityNote || null,
          },
        })
      : await prisma.strategyDecision.create({
          data: {
            id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            explorationId,
            strategyName,
            decision,
            reason: reason || null,
            feasibilityNote: feasibilityNote || null,
            userId,
            finderId: finderIdValue,
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

// 採否ログを取得（ユーザー別・ファインダー別）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const explorationId = searchParams.get("explorationId");
    const decisionFilter = searchParams.get("decision");
    const stats = searchParams.get("stats") === "true";
    const finderId = searchParams.get("finderId") || null;

    const userId = await getCurrentUserId();

    // 統計情報を返す（自分のデータ・ファインダー別）
    if (stats) {
      const [total, adopted, rejected, pending] = await Promise.all([
        prisma.strategyDecision.count({ where: { userId, finderId } }),
        prisma.strategyDecision.count({ where: { userId, finderId, decision: "adopt" } }),
        prisma.strategyDecision.count({ where: { userId, finderId, decision: "reject" } }),
        prisma.strategyDecision.count({ where: { userId, finderId, decision: "pending" } }),
      ]);

      // よくある却下理由を取得
      const rejectReasons = await prisma.strategyDecision.findMany({
        where: { userId, finderId, decision: "reject", reason: { not: null } },
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

    // 特定のExplorationの採否を取得（自分のデータ・ファインダー別）
    if (explorationId) {
      const decisions = await prisma.strategyDecision.findMany({
        where: { explorationId, userId, finderId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ decisions });
    }

    // フィルター付き一覧取得（自分のデータ・ファインダー別）
    const where = decisionFilter
      ? { decision: decisionFilter, userId, finderId }
      : { userId, finderId };
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

// 採否を削除（ユーザー別・ファインダー別）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("clearAll");
    const clearRanking = searchParams.get("clearRanking");
    const finderId = searchParams.get("finderId") || null;

    const userId = await getCurrentUserId();

    // ランキングの採否をすべてクリア（自分のデータ・ファインダー別）
    if (clearRanking === "true") {
      const result = await prisma.strategyDecision.deleteMany({
        where: {
          userId,
          finderId,
          explorationId: { startsWith: "ranking-" },
        },
      });
      return NextResponse.json({ success: true, deleted: result.count });
    }

    // すべての採否をクリア（自分のデータ・ファインダー別）
    if (clearAll === "true") {
      const result = await prisma.strategyDecision.deleteMany({
        where: { userId, finderId },
      });
      return NextResponse.json({ success: true, deleted: result.count });
    }

    // explorationId + strategyName で削除（自分のデータ・ファインダー別）
    const explorationId = searchParams.get("explorationId");
    const strategyName = searchParams.get("strategyName");
    if (explorationId && strategyName) {
      const result = await prisma.strategyDecision.deleteMany({
        where: {
          explorationId,
          strategyName,
          userId,
          finderId,
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
