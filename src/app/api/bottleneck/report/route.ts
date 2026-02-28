import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: プロジェクトの最新レポート取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectIdが必要です" }, { status: 400 });
    }

    const report = await prisma.bottleneckReport.findFirst({
      where: { projectId, status: "completed" },
      orderBy: { createdAt: "desc" },
    });

    if (!report) {
      return NextResponse.json({ report: null });
    }

    return NextResponse.json({
      report: {
        ...report,
        sections: typeof report.sections === "string" ? JSON.parse(report.sections) : report.sections,
      },
    });
  } catch (error) {
    console.error("[Bottleneck Report] Error:", error);
    return NextResponse.json({ error: "レポートの取得に失敗しました" }, { status: 500 });
  }
}
