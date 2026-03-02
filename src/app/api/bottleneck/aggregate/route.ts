import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type {
  BottleneckReportSections,
  BottleneckNode,
  DepartmentAggregate,
  AggregateBottleneck,
  AggregateSolution,
  AggregateQuickWin,
  SeverityLevel,
} from "@/lib/bottleneck-types";

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

export async function GET() {
  try {
    // completed案件を全て取得（report + flow付き）
    const projects = await prisma.bottleneckProject.findMany({
      where: { status: "completed" },
      include: {
        reports: {
          where: { status: "completed" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        flows: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // 部門ごとに集計
    const deptMap = new Map<string, {
      projects: typeof projects;
      totalNodes: number;
      manualNodes: number;
      automatedNodes: number;
      semiAutomatedNodes: number;
      bottlenecks: AggregateBottleneck[];
      solutions: AggregateSolution[];
      quickWins: AggregateQuickWin[];
    }>();

    for (const project of projects) {
      const dept = project.department || "未分類";
      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          projects: [],
          totalNodes: 0,
          manualNodes: 0,
          automatedNodes: 0,
          semiAutomatedNodes: 0,
          bottlenecks: [],
          solutions: [],
          quickWins: [],
        });
      }
      const entry = deptMap.get(dept)!;
      entry.projects.push(project);

      // フローからノード集計
      const flow = project.flows[0];
      if (flow) {
        try {
          const nodes: BottleneckNode[] = JSON.parse(flow.nodesJson);
          entry.totalNodes += nodes.length;
          entry.manualNodes += nodes.filter((n) => n.type === "manual").length;
          entry.automatedNodes += nodes.filter((n) => n.type === "automated").length;
          entry.semiAutomatedNodes += nodes.filter((n) => n.type === "semi-automated").length;
        } catch { /* ignore parse errors */ }
      }

      // レポートからボトルネック・ソリューション集計
      const report = project.reports[0];
      if (report) {
        try {
          const sections: BottleneckReportSections =
            typeof report.sections === "string" ? JSON.parse(report.sections) : report.sections;

          // ボトルネック
          for (const bn of sections.bottlenecks) {
            entry.bottlenecks.push({
              projectId: project.id,
              projectName: project.name,
              department: dept,
              nodeId: bn.nodeId,
              nodeLabel: bn.nodeLabel,
              severity: bn.severity,
              automationPotential: bn.automationPotential,
              issue: bn.issue,
              impact: bn.impact,
            });
          }

          // ソリューション
          for (const sol of sections.solutions) {
            entry.solutions.push({
              projectId: project.id,
              projectName: project.name,
              department: dept,
              id: sol.id,
              title: sol.title,
              description: sol.description,
              toolCategory: sol.toolCategory,
              implementationEffort: sol.implementationEffort,
              expectedImpact: sol.expectedImpact,
              priority: sol.priority,
            });
          }

          // 優先度マトリクス
          for (const pm of sections.priorityMatrix) {
            entry.quickWins.push({
              projectId: project.id,
              projectName: project.name,
              department: dept,
              solutionId: pm.solutionId,
              title: pm.title,
              impact: pm.impact,
              effort: pm.effort,
              quadrant: pm.quadrant,
            });
          }
        } catch { /* ignore parse errors */ }
      }
    }

    // DepartmentAggregate配列を構築
    const departments: DepartmentAggregate[] = [];
    for (const [dept, data] of deptMap.entries()) {
      const total = data.totalNodes;
      const autoRate = total > 0
        ? Math.round(((data.automatedNodes + data.semiAutomatedNodes * 0.5) / total) * 100)
        : 0;

      // ボトルネックをseverity順ソート
      data.bottlenecks.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

      departments.push({
        department: dept,
        projectCount: data.projects.length,
        totalNodes: data.totalNodes,
        manualNodes: data.manualNodes,
        automatedNodes: data.automatedNodes,
        semiAutomatedNodes: data.semiAutomatedNodes,
        automationRate: autoRate,
        allBottlenecks: data.bottlenecks,
        allSolutions: data.solutions,
        allQuickWins: data.quickWins,
      });
    }

    // 全社サマリー
    const totalSummary: DepartmentAggregate = {
      department: "全社",
      projectCount: projects.length,
      totalNodes: departments.reduce((s, d) => s + d.totalNodes, 0),
      manualNodes: departments.reduce((s, d) => s + d.manualNodes, 0),
      automatedNodes: departments.reduce((s, d) => s + d.automatedNodes, 0),
      semiAutomatedNodes: departments.reduce((s, d) => s + d.semiAutomatedNodes, 0),
      automationRate: 0,
      allBottlenecks: departments.flatMap((d) => d.allBottlenecks)
        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
      allSolutions: departments.flatMap((d) => d.allSolutions),
      allQuickWins: departments.flatMap((d) => d.allQuickWins),
    };
    const totalAll = totalSummary.totalNodes;
    totalSummary.automationRate = totalAll > 0
      ? Math.round(((totalSummary.automatedNodes + totalSummary.semiAutomatedNodes * 0.5) / totalAll) * 100)
      : 0;

    return NextResponse.json({
      summary: totalSummary,
      departments,
    });
  } catch (error) {
    console.error("[Bottleneck Aggregate] Error:", error);
    return NextResponse.json({ error: "集計に失敗しました" }, { status: 500 });
  }
}
