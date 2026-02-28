"use client";

import type { BottleneckNode } from "@/lib/bottleneck-types";

interface NodeDetailPanelProps {
  node: BottleneckNode | null;
  onClose: () => void;
}

const severityConfig = {
  critical: { label: "重大", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
  high: { label: "高", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", dot: "bg-orange-500" },
  medium: { label: "中", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", dot: "bg-yellow-500" },
  low: { label: "低", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", dot: "bg-green-500" },
  none: { label: "なし", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-400" },
};

const typeLabels = {
  manual: "手動",
  automated: "自動",
  "semi-automated": "半自動",
};

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  if (!node) return null;

  const severity = severityConfig[node.severity];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{node.label}</h3>
          {node.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{node.description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Meta info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-slate-500 dark:text-slate-400">タイプ</span>
          <p className="font-medium text-slate-900 dark:text-white">{typeLabels[node.type]}</p>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">深刻度</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${severity.dot}`} />
            <span className={`text-xs px-1.5 py-0.5 rounded ${severity.color}`}>{severity.label}</span>
          </div>
        </div>
        {node.actor && (
          <div>
            <span className="text-slate-500 dark:text-slate-400">担当</span>
            <p className="font-medium text-slate-900 dark:text-white">{node.actor}</p>
          </div>
        )}
        {node.tool && (
          <div>
            <span className="text-slate-500 dark:text-slate-400">ツール</span>
            <p className="font-medium text-slate-900 dark:text-white">{node.tool}</p>
          </div>
        )}
        {node.estimatedTime && (
          <div>
            <span className="text-slate-500 dark:text-slate-400">所要時間</span>
            <p className="font-medium text-slate-900 dark:text-white">{node.estimatedTime}</p>
          </div>
        )}
        <div>
          <span className="text-slate-500 dark:text-slate-400">自動化ポテンシャル</span>
          <div className="flex items-center gap-1 mt-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-sm ${
                  i <= node.automationPotential
                    ? "bg-blue-500"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
            <span className="text-xs text-slate-500 ml-1">{node.automationPotential}/5</span>
          </div>
        </div>
      </div>

      {/* Issues */}
      {node.issues && node.issues.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">問題点</h4>
          <ul className="space-y-1">
            {node.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="text-red-500 mt-0.5">!</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {node.suggestions && node.suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">改善提案</h4>
          <ul className="space-y-1">
            {node.suggestions.map((suggestion, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="text-green-500 mt-0.5">*</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
