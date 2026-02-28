import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: プロジェクトの最新フロー取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectIdが必要です" }, { status: 400 });
    }

    const flow = await prisma.bottleneckFlow.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ flow });
  } catch (error) {
    console.error("[Bottleneck Flow] Error:", error);
    return NextResponse.json({ error: "フローの取得に失敗しました" }, { status: 500 });
  }
}
