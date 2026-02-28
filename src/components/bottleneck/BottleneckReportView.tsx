"use client";

import type { BottleneckReportSections } from "@/lib/bottleneck-types";

interface BottleneckReportViewProps {
  sections: BottleneckReportSections;
}

const severityConfig = {
  critical: { label: "重大", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" },
  high: { label: "高", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
  medium: { label: "中", bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" },
  low: { label: "低", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
  none: { label: "なし", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" },
};

const toolCategoryLabels: Record<string, string> = {
  RPA: "RPA",
  API: "API連携",
  SaaS: "SaaS導入",
  AI: "AI活用",
  workflow: "ワークフロー改善",
  other: "その他",
};

const effortLabels = { low: "低", medium: "中", high: "高" };
const impactLabels = { low: "低", medium: "中", high: "高" };

const quadrantConfig = {
  "quick-win": { label: "クイックウィン", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  strategic: { label: "戦略的施策", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  "fill-in": { label: "余裕があれば", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  thankless: { label: "要再検討", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

export function BottleneckReportView({ sections }: BottleneckReportViewProps) {
  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-5 border border-orange-200 dark:border-orange-800">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">エグゼクティブサマリー</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{sections.executiveSummary}</p>
      </div>

      {/* Flow Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">フロー概要</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="総ステップ" value={sections.flowSummary.totalNodes} />
          <SummaryCard label="手動" value={sections.flowSummary.manualNodes} color="text-red-600 dark:text-red-400" />
          <SummaryCard label="半自動" value={sections.flowSummary.semiAutomatedNodes} color="text-yellow-600 dark:text-yellow-400" />
          <SummaryCard label="自動" value={sections.flowSummary.automatedNodes} color="text-green-600 dark:text-green-400" />
          <SummaryCard label="自動化率" value={`${sections.flowSummary.automationRate}%`} color="text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      {/* Bottlenecks */}
      {sections.bottlenecks.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
            ボトルネック一覧
            <span className="text-sm font-normal text-slate-500 ml-2">({sections.bottlenecks.length}件)</span>
          </h3>
          <div className="space-y-3">
            {sections.bottlenecks.map((bn, i) => {
              const sev = severityConfig[bn.severity];
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${sev.bg} ${sev.text}`}>
                    {sev.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{bn.nodeLabel}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{bn.issue}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{bn.impact}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className={`w-2 h-2 rounded-sm ${j <= bn.automationPotential ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Solutions */}
      {sections.solutions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">解決策</h3>
          <div className="space-y-4">
            {sections.solutions.map((sol, i) => (
              <div key={i} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{sol.title}</h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {toolCategoryLabels[sol.toolCategory] || sol.toolCategory}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{sol.description}</p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>導入コスト: {effortLabels[sol.implementationEffort]}</span>
                  <span>期待効果: {impactLabels[sol.expectedImpact]}</span>
                  {sol.estimatedCost && <span>概算: {sol.estimatedCost}</span>}
                  {sol.estimatedTimeline && <span>期間: {sol.estimatedTimeline}</span>}
                  <span>優先度: {sol.priority}/5</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority Matrix */}
      {sections.priorityMatrix.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">優先度マトリクス</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(["quick-win", "strategic", "fill-in", "thankless"] as const).map((quadrant) => {
              const items = sections.priorityMatrix.filter((m) => m.quadrant === quadrant);
              if (items.length === 0) return null;
              const qc = quadrantConfig[quadrant];
              return (
                <div key={quadrant} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${qc.color}`}>{qc.label}</span>
                  <ul className="mt-2 space-y-1">
                    {items.map((item, i) => (
                      <li key={i} className="text-sm text-slate-700 dark:text-slate-300">
                        {item.title}
                        <span className="text-xs text-slate-400 ml-2">
                          影響{item.impact} / 工数{item.effort}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color || "text-slate-900 dark:text-white"}`}>{value}</p>
    </div>
  );
}
