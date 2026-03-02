"use client";

import type {
  DepartmentAggregate,
  AggregateBottleneck,
  AggregateSolution,
  AggregateQuickWin,
  SeverityLevel,
} from "@/lib/bottleneck-types";

const severityConfig: Record<SeverityLevel, { label: string; bg: string; text: string }> = {
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

const effortLabels: Record<string, string> = { low: "低", medium: "中", high: "高" };
const impactLabels: Record<string, string> = { low: "低", medium: "中", high: "高" };

const quadrantConfig = {
  "quick-win": { label: "クイックウィン", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  strategic: { label: "戦略的施策", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  "fill-in": { label: "余裕があれば", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  thankless: { label: "要再検討", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

interface AggregateReportContentProps {
  data: DepartmentAggregate;
}

export function AggregateReportContent({ data }: AggregateReportContentProps) {
  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="分析案件数" value={data.projectCount} />
        <SummaryCard label="総ノード数" value={data.totalNodes} />
        <SummaryCard label="手動ノード" value={data.manualNodes} color="text-red-600 dark:text-red-400" />
        <SummaryCard label="自動化率" value={`${data.automationRate}%`} color="text-blue-600 dark:text-blue-400" />
        <SummaryCard label="ボトルネック数" value={data.allBottlenecks.length} color="text-orange-600 dark:text-orange-400" />
      </div>

      {/* ボトルネック一覧 */}
      {data.allBottlenecks.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
            ボトルネック一覧
            <span className="text-sm font-normal text-slate-500 ml-2">({data.allBottlenecks.length}件)</span>
          </h3>
          <div className="space-y-3">
            {data.allBottlenecks.map((bn, i) => (
              <BottleneckCard key={i} bn={bn} />
            ))}
          </div>
        </div>
      )}

      {/* 改善提案一覧 - ツールカテゴリ別 */}
      {data.allSolutions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
            改善提案一覧
            <span className="text-sm font-normal text-slate-500 ml-2">({data.allSolutions.length}件)</span>
          </h3>
          <SolutionsByCategory solutions={data.allSolutions} />
        </div>
      )}

      {/* 優先度マトリクス */}
      {data.allQuickWins.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">優先度マトリクス</h3>
          <PriorityMatrix items={data.allQuickWins} />
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || "text-slate-900 dark:text-white"}`}>{value}</p>
    </div>
  );
}

function BottleneckCard({ bn }: { bn: AggregateBottleneck }) {
  const sev = severityConfig[bn.severity] || severityConfig.none;
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
      <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${sev.bg} ${sev.text}`}>
        {sev.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{bn.nodeLabel}</p>
          <span className="text-xs text-slate-400 dark:text-slate-500">- {bn.projectName}</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">{bn.issue}</p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{bn.impact}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {[1, 2, 3, 4, 5].map((j) => (
          <div key={j} className={`w-2 h-2 rounded-sm ${j <= bn.automationPotential ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700"}`} />
        ))}
      </div>
    </div>
  );
}

function SolutionsByCategory({ solutions }: { solutions: AggregateSolution[] }) {
  const categories = ["RPA", "API", "SaaS", "AI", "workflow", "other"] as const;
  const grouped = new Map<string, AggregateSolution[]>();
  for (const sol of solutions) {
    const cat = sol.toolCategory;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(sol);
  }

  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        return (
          <div key={cat}>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                {toolCategoryLabels[cat] || cat}
              </span>
              <span className="text-xs text-slate-400">({items.length}件)</span>
            </h4>
            <div className="space-y-2">
              {items.map((sol, i) => (
                <div key={i} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start justify-between mb-1">
                    <h5 className="text-sm font-semibold text-slate-900 dark:text-white">{sol.title}</h5>
                    <span className="text-xs text-slate-400 whitespace-nowrap ml-2">{sol.projectName}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{sol.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>導入コスト: {effortLabels[sol.implementationEffort] || sol.implementationEffort}</span>
                    <span>期待効果: {impactLabels[sol.expectedImpact] || sol.expectedImpact}</span>
                    <span>優先度: {sol.priority}/5</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PriorityMatrix({ items }: { items: AggregateQuickWin[] }) {
  const quadrants = ["quick-win", "strategic", "fill-in", "thankless"] as const;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {quadrants.map((quadrant) => {
        const filtered = items.filter((m) => m.quadrant === quadrant);
        if (filtered.length === 0) return null;
        const qc = quadrantConfig[quadrant];
        return (
          <div key={quadrant} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${qc.color}`}>
              {qc.label} ({filtered.length})
            </span>
            <ul className="mt-2 space-y-1">
              {filtered.map((item, i) => (
                <li key={i} className="text-sm text-slate-700 dark:text-slate-300">
                  {item.title}
                  <span className="text-xs text-slate-400 ml-2">
                    ({item.projectName}) 影響{item.impact} / 工数{item.effort}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
