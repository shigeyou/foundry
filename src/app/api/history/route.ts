import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    // 自分の探索履歴のみ取得
    const history = await prisma.exploration.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "履歴取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "履歴IDが必要です" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();

    // 自分の探索のみ削除可能
    const exploration = await prisma.exploration.findUnique({
      where: { id },
    });

    if (!exploration) {
      return NextResponse.json(
        { error: "履歴が見つかりません" },
        { status: 404 }
      );
    }

    if (exploration.userId !== userId) {
      return NextResponse.json(
        { error: "他のユーザーの履歴は削除できません" },
        { status: 403 }
      );
    }

    await prisma.exploration.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting history:", error);
    return NextResponse.json(
      { error: "履歴削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
