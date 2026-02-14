"use client";

import { useSimulator } from "@/contexts/SimulatorContext";

export function CompareTab() {
  const { setActiveTab, results, scenarios } = useSimulator();

  if (results.length < 2) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            比較には2つ以上のシナリオ結果が必要です
          </p>
          <button
            onClick={() => setActiveTab("scenario")}
            className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            シナリオを追加
          </button>
        </div>
      </div>
    );
  }

  // メトリクスのキーを収集
  const allMetricKeys = [...new Set(results.flatMap((r) => Object.keys(r.metrics)))];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">シナリオ比較</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">指標</th>
                {results.map((result) => (
                  <th key={result.id} className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                    {result.scenarioName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allMetricKeys.map((key) => (
                <tr key={key} className="border-b border-slate-100 dark:border-slate-700/50">
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{key}</td>
                  {results.map((result) => {
                    const value = result.metrics[key];
                    return (
                      <td key={result.id} className="text-right py-3 px-4 font-mono text-slate-800 dark:text-slate-200">
                        {typeof value === "number" ? value.toLocaleString() : value ?? "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 比較サマリー */}
        <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <h3 className="font-medium text-purple-800 dark:text-purple-200 mb-2">比較サマリー</h3>
          <p className="text-sm text-purple-700 dark:text-purple-300">
            {results.length}つのシナリオを比較しています。
            各指標の数値を確認し、最適なシナリオを選択してください。
          </p>
        </div>

        <div className="flex justify-between pt-6 border-t border-slate-200 dark:border-slate-700 mt-6">
          <button
            onClick={() => setActiveTab("analysis")}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ← 結果分析
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            レポートへ →
          </button>
        </div>
      </div>
    </div>
  );
}
