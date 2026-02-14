import { NextRequest, NextResponse } from "next/server";
import { getTopStrategies, archiveTopStrategies } from "@/lib/self-improve";
import { getCurrentUser } from "@/lib/auth";

// 高スコア戦略一覧を取得（ユーザー別・ファインダー別）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const finderId = searchParams.get("finderId") || null;

    const user = await getCurrentUser();
    const strategies = await getTopStrategies(limit, user.id, finderId);

    // scoresをパース
    const parsed = strategies.map((s) => ({
      ...s,
      scores: JSON.parse(s.scores),
    }));

    return NextResponse.json({
      strategies: parsed,
      total: strategies.length,
    });
  } catch (error) {
    console.error("Top strategies GET error:", error);
    return NextResponse.json(
      { error: "高スコア戦略の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 高スコア戦略をアーカイブ（ユーザー別・ファインダー別）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const minScore = body.minScore ?? 4.0;
    const finderId: string | null = body.finderId ?? null;

    const user = await getCurrentUser();
    const result = await archiveTopStrategies(minScore, user.id, user.name, finderId);

    return NextResponse.json({
      success: true,
      archived: result.archived,
      total: result.total,
      message: `${result.archived}件の新規高スコア戦略をアーカイブしました（合計: ${result.total}件）`,
    });
  } catch (error) {
    console.error("Top strategies POST error:", error);
    return NextResponse.json(
      { error: "高スコア戦略のアーカイブに失敗しました" },
      { status: 500 }
    );
  }
}
