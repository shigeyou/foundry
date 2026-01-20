import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const history = await prisma.exploration.findMany({
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
