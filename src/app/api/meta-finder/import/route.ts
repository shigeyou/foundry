import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";

// GET: /home/data/export-batch.json からバッチデータをインポート
// Kudu経由で内部呼び出し専用（Easy Auth不要）
export async function GET() {
  const importPath = "/home/data/export-batch.json";

  try {
    if (!fs.existsSync(importPath)) {
      return NextResponse.json({ error: `File not found: ${importPath}` }, { status: 404 });
    }

    const raw = fs.readFileSync(importPath, "utf-8");
    const data = JSON.parse(raw);

    const { batch, ideas, reports } = data;

    // 既存データを削除（同じbatchIdがあれば上書き）
    await prisma.metaFinderReport.deleteMany({ where: { batchId: batch.id } });
    await prisma.metaFinderIdea.deleteMany({ where: { batchId: batch.id } });
    await prisma.metaFinderBatch.deleteMany({ where: { id: batch.id } });

    // バッチ作成
    await prisma.metaFinderBatch.create({
      data: {
        id: batch.id,
        status: batch.status,
        totalPatterns: batch.totalPatterns,
        completedPatterns: batch.completedPatterns,
        totalIdeas: batch.totalIdeas,
        currentTheme: batch.currentTheme,
        currentDept: batch.currentDept,
        errors: batch.errors,
        startedAt: new Date(batch.startedAt),
        completedAt: batch.completedAt ? new Date(batch.completedAt) : null,
      },
    });

    // アイデアを100件ずつバルクインサート
    for (let i = 0; i < ideas.length; i += 100) {
      const chunk = ideas.slice(i, i + 100).map((idea: Record<string, unknown>) => ({
        id: idea.id as string,
        batchId: idea.batchId as string,
        themeId: idea.themeId as string,
        themeName: idea.themeName as string,
        deptId: idea.deptId as string,
        deptName: idea.deptName as string,
        name: idea.name as string,
        description: idea.description as string,
        actions: (idea.actions as string) || null,
        sourceEvidence: (idea.sourceEvidence as string) || null,
        reason: idea.reason as string,
        financial: idea.financial as number,
        customer: idea.customer as number,
        process: idea.process as number,
        growth: idea.growth as number,
        score: idea.score as number,
        createdAt: new Date(idea.createdAt as string),
      }));
      await prisma.metaFinderIdea.createMany({ data: chunk });
    }

    // レポート作成
    for (const report of reports) {
      await prisma.metaFinderReport.create({
        data: {
          id: report.id,
          batchId: report.batchId,
          scope: report.scope,
          scopeName: report.scopeName,
          sections: report.sections,
          status: report.status,
          error: report.error,
          createdAt: new Date(report.createdAt),
        },
      });
    }

    return NextResponse.json({
      message: "Import completed",
      batchId: batch.id,
      ideas: ideas.length,
      reports: reports.length,
    });
  } catch (error) {
    console.error("Import failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
