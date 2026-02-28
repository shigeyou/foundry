"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { FlowUploadPanel } from "@/components/bottleneck/FlowUploadPanel";
import { MermaidFlowchart } from "@/components/bottleneck/MermaidFlowchart";
import { NodeDetailPanel } from "@/components/bottleneck/NodeDetailPanel";
import { BottleneckReportView } from "@/components/bottleneck/BottleneckReportView";
import type { BottleneckNode, BottleneckEdge, BottleneckReportSections } from "@/lib/bottleneck-types";
import { ThemeToggle } from "@/components/theme-toggle";

type Tab = "upload" | "flow" | "report";

interface ProjectData {
  id: string;
  name: string;
  department?: string | null;
  description?: string | null;
  status: string;
  documents: { id: string; filename: string; fileType: string; createdAt: string }[];
  flows: { id: string; createdAt: string }[];
  reports: { id: string; status: string; createdAt: string }[];
  _count: { documents: number; flows: number; reports: number };
}

interface AfterChange {
  beforeNodeId: string;
  change: "eliminated" | "automated" | "simplified" | "merged" | "added";
  description: string;
}

interface FlowData {
  mermaidCode: string;
  nodesJson: string;
  edgesJson: string;
  afterMermaidCode?: string | null;
  afterChangesJson?: string | null;
  afterSummary?: string | null;
}

interface AnalysisStatusData {
  status: string;
  progress: number;
  error?: string;
}

export default function BottleneckWorkspacePage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("upload");

  // Flow state
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [nodes, setNodes] = useState<BottleneckNode[]>([]);
  const [, setEdges] = useState<BottleneckEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<BottleneckNode | null>(null);

  // Report state
  const [reportSections, setReportSections] = useState<BottleneckReportSections | null>(null);

  // Analysis state
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatusData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // After flow state
  const [afterMermaidCode, setAfterMermaidCode] = useState<string | null>(null);
  const [afterChanges, setAfterChanges] = useState<AfterChange[]>([]);
  const [afterSummary, setAfterSummary] = useState<string | null>(null);


  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/bottleneck/project?id=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);

        // If there's a flow, fetch it
        if (data.project.flows?.length > 0) {
          await fetchFlow(data.project.flows[0].id);
        }

        // If there's a completed report, fetch it
        if (data.project.reports?.length > 0) {
          const latestReport = data.project.reports[0];
          if (latestReport.status === "completed") {
            await fetchReport(latestReport.id);
          }
        }

        // Auto-select tab based on state
        if (data.project._count.reports > 0) {
          setActiveTab("report");
        } else if (data.project._count.flows > 0) {
          setActiveTab("flow");
        }
      }
    } catch (err) {
      console.error("Failed to fetch project:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchFlow = async (flowId: string) => {
    try {
      const res = await fetch(`/api/bottleneck/project?id=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        // Get the latest flow data from DB
        if (data.project.flows?.length > 0) {
          // We need to fetch the actual flow data - use a simple approach
          const flowRes = await fetch(`/api/bottleneck/analyze?projectId=${projectId}`);
          // Flow data is embedded in the project; we'll fetch it from the flow model
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchReport = async (reportId: string) => {
    // Report is included via the project detail endpoint
    // For now, we fetch it separately
  };

  // Fetch full flow and report data
  const fetchFullData = useCallback(async () => {
    try {
      // Use prisma direct via API - fetch flow
      const flowRes = await fetch(`/api/bottleneck/project?id=${projectId}`);
      if (!flowRes.ok) return;

      const projectData = await flowRes.json();
      setProject(projectData.project);

    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // Poll analysis status when analyzing
  useEffect(() => {
    if (!analyzing) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/bottleneck/analyze?projectId=${projectId}`);
        if (res.ok) {
          const status: AnalysisStatusData = await res.json();
          setAnalysisStatus(status);

          if (status.status === "completed" || status.status === "failed") {
            setAnalyzing(false);
            // Refresh project data
            fetchProject();
          }
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [analyzing, projectId, fetchProject]);

  const startAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisStatus({ status: "extracting-flow", progress: 0 });

    try {
      const res = await fetch("/api/bottleneck/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setAnalysisStatus({ status: "failed", progress: 0, error: data.error });
        setAnalyzing(false);
      }
    } catch (err) {
      setAnalysisStatus({ status: "failed", progress: 0, error: "分析の開始に失敗しました" });
      setAnalyzing(false);
    }
  };

  const handleNodeClick = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    setSelectedNode(node || null);
  };

  // Parse flow and report data from project
  useEffect(() => {
    if (!project) return;

    // We need additional API to fetch flow/report content
    // For now, use a dedicated fetch
    async function loadFlowAndReport() {
      try {
        // Fetch flow data
        const flowRes = await fetch(`/api/bottleneck/flow?projectId=${projectId}`);
        if (flowRes.ok) {
          const fd = await flowRes.json();
          if (fd.flow) {
            setFlowData(fd.flow);
            setNodes(JSON.parse(fd.flow.nodesJson || "[]"));
            setEdges(JSON.parse(fd.flow.edgesJson || "[]"));
            if (fd.flow.afterMermaidCode) {
              setAfterMermaidCode(fd.flow.afterMermaidCode);
              setAfterChanges(JSON.parse(fd.flow.afterChangesJson || "[]"));
              setAfterSummary(fd.flow.afterSummary || null);
            }
          }
        }

        // Fetch report data
        const reportRes = await fetch(`/api/bottleneck/report?projectId=${projectId}`);
        if (reportRes.ok) {
          const rd = await reportRes.json();
          if (rd.report?.sections) {
            const parsed = typeof rd.report.sections === "string"
              ? JSON.parse(rd.report.sections)
              : rd.report.sections;
            setReportSections(parsed);
          }
        }
      } catch {
        // ignore - these endpoints may not exist yet
      }
    }

    loadFlowAndReport();
  }, [project, projectId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-600 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white">
        <div className="text-center">
          <p className="text-lg mb-4">プロジェクトが見つかりません</p>
          <Link href="/bottleneck" className="text-orange-500 hover:underline">一覧に戻る</Link>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "upload", label: "アップロード", count: project._count.documents },
    { key: "flow", label: "フロー", count: project._count.flows },
    { key: "report", label: "レポート", count: project._count.reports },
  ];

  const statusMessage: Record<string, string> = {
    "extracting-flow": "業務フローを抽出中...",
    "analyzing": "ボトルネックを分析中...",
    "generating-report": "レポートを生成中...",
    "generating-after": "改善後フローを生成中...",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white">
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/bottleneck"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {project.department && (
                <span className="text-sm text-slate-500 dark:text-slate-400">{project.department}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={startAnalysis}
              disabled={analyzing || project._count.documents === 0}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-600 dark:disabled:to-slate-700 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all disabled:cursor-not-allowed"
            >
              {analyzing ? "分析中..." : "AI分析を実行"}
            </button>
          </div>
        </div>

        {/* Analysis progress bar */}
        {analyzing && analysisStatus && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {statusMessage[analysisStatus.status] || "処理中..."}
              </span>
            </div>
            <div className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${analysisStatus.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error display */}
        {analysisStatus?.status === "failed" && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">分析エラー</p>
            <p className="text-sm text-red-500 mt-1">{analysisStatus.error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === "upload" && (
            <FlowUploadPanel
              projectId={projectId}
              documents={project.documents.map((d) => ({
                id: d.id,
                filename: d.filename,
                fileType: d.fileType,
                contentLength: 0,
                createdAt: d.createdAt,
              }))}
              onDocumentsChange={fetchProject}
              disabled={analyzing}
            />
          )}

          {activeTab === "flow" && (
            <div className="space-y-4">
              {flowData ? (
                <>
                  {/* Legend bar */}
                  <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">凡例:</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500" /> 重大</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-500" /> 高リスク</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-500" /> 中程度</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500" /> 自動化済み</span>
                    {afterMermaidCode && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500" /> 半自動</span>
                      </>
                    )}
                    <span className="ml-auto text-slate-400">ドラッグで移動 / Ctrl+ホイールでズーム</span>
                  </div>

                  {/* Side-by-side flowcharts */}
                  {afterMermaidCode ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {/* Before */}
                      <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-orange-200 dark:border-orange-800 p-3">
                        <MermaidFlowchart
                          code={flowData.mermaidCode}
                          onNodeClick={handleNodeClick}
                          height={550}
                          label="Before（現状）"
                          labelColor="text-orange-600 dark:text-orange-400"
                        />
                      </div>
                      {/* After */}
                      <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-green-200 dark:border-green-800 p-3">
                        <MermaidFlowchart
                          code={afterMermaidCode}
                          height={550}
                          label="After（改善後）"
                          labelColor="text-green-600 dark:text-green-400"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Before only (full width) */
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                      <MermaidFlowchart
                        code={flowData.mermaidCode}
                        onNodeClick={handleNodeClick}
                        height={550}
                      />
                    </div>
                  )}

                  {/* Bottom panels: node detail + changes */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left: Node detail + step list */}
                    <div className="space-y-3">
                      {selectedNode ? (
                        <NodeDetailPanel
                          node={selectedNode}
                          onClose={() => setSelectedNode(null)}
                        />
                      ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Beforeフローのノードをクリックすると詳細が表示されます
                          </p>
                        </div>
                      )}
                      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          ステップ一覧 ({nodes.length})
                        </h4>
                        <div className="space-y-1 max-h-[250px] overflow-y-auto">
                          {nodes.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => setSelectedNode(n)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                selectedNode?.id === n.id
                                  ? "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  n.severity === "critical" ? "bg-red-500" :
                                  n.severity === "high" ? "bg-orange-500" :
                                  n.severity === "medium" ? "bg-yellow-500" :
                                  n.severity === "low" ? "bg-green-400" :
                                  "bg-slate-300"
                                }`} />
                                <span className="truncate text-slate-700 dark:text-slate-300">{n.label}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: After changes */}
                    {afterChanges.length > 0 && (
                      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                          改善内容 ({afterChanges.length}件)
                        </h4>
                        {afterSummary && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                            {afterSummary}
                          </p>
                        )}
                        <div className="space-y-2 max-h-[350px] overflow-y-auto">
                          {afterChanges.map((c, i) => (
                            <div key={i} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  c.change === "automated" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                                  c.change === "eliminated" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                                  c.change === "simplified" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                                  c.change === "merged" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" :
                                  "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                }`}>
                                  {c.change === "automated" ? "自動化" :
                                   c.change === "eliminated" ? "廃止" :
                                   c.change === "simplified" ? "簡素化" :
                                   c.change === "merged" ? "統合" : "追加"}
                                </span>
                                <span className="text-xs text-slate-400">{c.beforeNodeId}</span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300">{c.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-4xl mb-4 block">📊</span>
                  <p className="text-slate-500 dark:text-slate-400 mb-2">フローデータがありません</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    ドキュメントをアップロードし、「AI分析を実行」をクリックしてください
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "report" && (
            <div>
              {reportSections ? (
                <BottleneckReportView sections={reportSections} />
              ) : (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-4xl mb-4 block">📋</span>
                  <p className="text-slate-500 dark:text-slate-400 mb-2">レポートがありません</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    AI分析が完了するとレポートが生成されます
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
