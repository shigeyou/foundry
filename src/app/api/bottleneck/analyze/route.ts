import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/claude";
import {
  buildFlowExtractionPrompt,
  buildBottleneckAnalysisPrompt,
  buildReportPrompt,
  buildAfterFlowPrompt,
  addSeverityColoring,
  sanitizeMermaidCode,
} from "@/lib/bottleneck-prompts";
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag-retrieval";
import type { BottleneckNode, BottleneckEdge, BottleneckReportSections } from "@/lib/bottleneck-types";

// In-memory analysis status tracking
const analysisStatus = new Map<string, {
  status: string;
  progress: number;
  error?: string;
}>();

// POST: 分析実行
export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "プロジェクトIDが必要です" }, { status: 400 });
    }

    // プロジェクトとドキュメント取得
    const project = await prisma.bottleneckProject.findUnique({
      where: { id: projectId },
      include: { documents: true },
    });

    if (!project) {
      return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
    }

    if (project.documents.length === 0) {
      return NextResponse.json({ error: "ドキュメントをアップロードしてください" }, { status: 400 });
    }

    // 既に実行中なら拒否
    const currentStatus = analysisStatus.get(projectId);
    if (currentStatus && !["completed", "failed"].includes(currentStatus.status)) {
      return NextResponse.json({
        error: "分析が既に実行中です",
        status: currentStatus,
      }, { status: 409 });
    }

    // ステータス初期化
    analysisStatus.set(projectId, { status: "extracting-flow", progress: 0 });

    // プロジェクトステータス更新
    await prisma.bottleneckProject.update({
      where: { id: projectId },
      data: { status: "analyzing" },
    });

    // バックグラウンドで分析実行（awaitしない）
    runAnalysis(projectId, project.documents).catch((err) => {
      console.error("[Bottleneck Analyze] Fatal error:", err);
      analysisStatus.set(projectId, {
        status: "failed",
        progress: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    });

    return NextResponse.json({
      message: "分析を開始しました",
      projectId,
    });
  } catch (error) {
    console.error("[Bottleneck Analyze] Error:", error);
    return NextResponse.json({ error: "分析の開始に失敗しました" }, { status: 500 });
  }
}

// GET: 分析ステータス確認
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectIdが必要です" }, { status: 400 });
    }

    const status = analysisStatus.get(projectId);

    if (!status) {
      // DBからプロジェクトステータスを確認
      const project = await prisma.bottleneckProject.findUnique({
        where: { id: projectId },
        select: { status: true },
      });

      return NextResponse.json({
        projectId,
        status: project?.status === "completed" ? "completed" : "idle",
        progress: 0,
      });
    }

    return NextResponse.json({ projectId, ...status });
  } catch (error) {
    console.error("[Bottleneck Analyze] Status error:", error);
    return NextResponse.json({ error: "ステータスの取得に失敗しました" }, { status: 500 });
  }
}

// バックグラウンド分析パイプライン
async function runAnalysis(
  projectId: string,
  documents: { id: string; content: string; filename: string }[]
) {
  try {
    // RAGから社内システム・組織情報を取得
    let ragContext = "";
    try {
      const docSummary = documents.map(d => d.filename).join(", ");
      const ragChunks = await retrieveRelevantChunks({
        query: `業務プロセス システム構成 ICT環境 組織 ${docSummary}`,
        scope: ["shared"],
        topK: 10,
        maxChars: 8000,
      });
      if (ragChunks.length > 0) {
        ragContext = formatChunksForPrompt(ragChunks, "社内参考情報（システム構成・組織情報）");
        console.log(`[Bottleneck Analyze] RAG context: ${ragChunks.length} chunks, ${ragContext.length} chars`);
      }
    } catch (err) {
      console.warn("[Bottleneck Analyze] RAG retrieval failed, continuing without context:", err);
    }

    // ステージ1: フロー抽出
    analysisStatus.set(projectId, { status: "extracting-flow", progress: 10 });

    const allContent = documents
      .map((d) => `## ${d.filename}\n${d.content}`)
      .join("\n\n---\n\n");

    // テキスト長制限（AIのコンテキスト制限を考慮）
    const maxDocChars = ragContext ? 70000 : 80000;
    const truncatedContent = allContent.length > maxDocChars
      ? allContent.slice(0, maxDocChars) + "\n\n[...以降省略...]"
      : allContent;

    const flowPrompt = buildFlowExtractionPrompt(truncatedContent, ragContext);
    const flowResponse = await generateWithClaude(flowPrompt, {
      temperature: 0.3,
      maxTokens: 16000,
      jsonMode: true,
    });

    const flowData = JSON.parse(flowResponse);
    let nodes: BottleneckNode[] = flowData.nodes || [];
    const edges: BottleneckEdge[] = flowData.edges || [];
    let mermaidCode: string = flowData.mermaidCode || "";

    analysisStatus.set(projectId, { status: "analyzing", progress: 40 });

    // ステージ2: ボトルネック分析
    const analysisPrompt = buildBottleneckAnalysisPrompt(nodes, edges);
    const analysisResponse = await generateWithClaude(analysisPrompt, {
      temperature: 0.3,
      maxTokens: 16000,
      jsonMode: true,
    });

    const analysisData = JSON.parse(analysisResponse);
    const analyzedNodes = analysisData.analyzedNodes || [];

    // ノードに分析結果をマージ
    nodes = nodes.map((node) => {
      const analyzed = analyzedNodes.find((a: { id: string }) => a.id === node.id);
      if (analyzed) {
        return {
          ...node,
          severity: analyzed.severity || node.severity,
          automationPotential: analyzed.automationPotential || node.automationPotential,
          issues: analyzed.issues || node.issues,
          suggestions: analyzed.suggestions || node.suggestions,
        };
      }
      return node;
    });

    // Mermaidコードをサニタイズ＋色分けを追加
    mermaidCode = sanitizeMermaidCode(mermaidCode);
    mermaidCode = addSeverityColoring(mermaidCode, nodes);

    // フローをDB保存
    const flowId = `bnf-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await prisma.bottleneckFlow.create({
      data: {
        id: flowId,
        projectId,
        mermaidCode,
        nodesJson: JSON.stringify(nodes),
        edgesJson: JSON.stringify(edges),
      },
    });

    analysisStatus.set(projectId, { status: "generating-report", progress: 70 });

    // ステージ3: レポート生成（RAGコンテキスト付き）
    const reportPrompt = buildReportPrompt(nodes, edges, ragContext);
    const reportResponse = await generateWithClaude(reportPrompt, {
      temperature: 0.4,
      maxTokens: 16000,
      jsonMode: true,
    });

    const reportData = JSON.parse(reportResponse);

    // レポートセクションを構築
    const sections: BottleneckReportSections = {
      executiveSummary: reportData.executiveSummary || "",
      flowSummary: {
        totalNodes: nodes.length,
        manualNodes: nodes.filter((n) => n.type === "manual").length,
        automatedNodes: nodes.filter((n) => n.type === "automated").length,
        semiAutomatedNodes: nodes.filter((n) => n.type === "semi-automated").length,
        automationRate: nodes.length > 0
          ? Math.round((nodes.filter((n) => n.type === "automated").length / nodes.length) * 100)
          : 0,
      },
      bottlenecks: nodes
        .filter((n) => n.severity !== "none")
        .sort((a, b) => {
          const order = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
          return order[a.severity] - order[b.severity];
        })
        .map((n) => ({
          nodeId: n.id,
          nodeLabel: n.label,
          severity: n.severity,
          automationPotential: n.automationPotential,
          issue: n.issues?.[0] || "",
          impact: n.suggestions?.[0] || "",
        })),
      solutions: reportData.solutions || [],
      priorityMatrix: reportData.priorityMatrix || [],
    };

    // レポートをDB保存
    await prisma.bottleneckReport.create({
      data: {
        id: `bnr-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        projectId,
        sections: JSON.stringify(sections),
        status: "completed",
      },
    });

    // ステージ4: After（改善後）フロー生成
    analysisStatus.set(projectId, { status: "generating-after", progress: 85 });

    const solutions = (reportData.solutions || []).map((s: { title: string; targetNodeIds: string[]; toolCategory: string }) => ({
      title: s.title,
      targetNodeIds: s.targetNodeIds || [],
      toolCategory: s.toolCategory || "other",
    }));

    const afterPrompt = buildAfterFlowPrompt(nodes, edges, mermaidCode, solutions, ragContext);
    const afterResponse = await generateWithClaude(afterPrompt, {
      temperature: 0.3,
      maxTokens: 16000,
      jsonMode: true,
    });

    const afterData = JSON.parse(afterResponse);

    // AfterフローをDB更新
    const afterMermaid = sanitizeMermaidCode(afterData.mermaidCode || "");
    await prisma.bottleneckFlow.update({
      where: { id: flowId },
      data: {
        afterMermaidCode: afterMermaid,
        afterChangesJson: JSON.stringify(afterData.changes || []),
        afterSummary: afterData.summary || "",
      },
    });

    // プロジェクトステータス更新
    await prisma.bottleneckProject.update({
      where: { id: projectId },
      data: { status: "completed" },
    });

    analysisStatus.set(projectId, { status: "completed", progress: 100 });
    console.log(`[Bottleneck Analyze] Completed for project ${projectId}`);

  } catch (error) {
    console.error(`[Bottleneck Analyze] Error for project ${projectId}:`, error);

    // エラーレポートを保存
    await prisma.bottleneckReport.create({
      data: {
        id: `bnr-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        projectId,
        sections: "{}",
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    }).catch(() => {});

    await prisma.bottleneckProject.update({
      where: { id: projectId },
      data: { status: "draft" },
    }).catch(() => {});

    analysisStatus.set(projectId, {
      status: "failed",
      progress: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
