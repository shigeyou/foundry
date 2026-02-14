"use client";

import { useSimulator } from "@/contexts/SimulatorContext";

export function AnalysisTab() {
  const { setActiveTab, results } = useSimulator();

  if (results.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">結果がありません</p>
          <button
            onClick={() => setActiveTab("simulation")}
            className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            シミュレーションを実行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">結果分析</h2>

        <div className="space-y-6">
          {results.map((result) => (
            <div key={result.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">{result.scenarioName}</h3>

              {/* メトリクス */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                {Object.entries(result.metrics).map(([key, value]) => (
                  <div key={key} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{key}</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {typeof value === "number" ? value.toLocaleString() : value}
                    </p>
                  </div>
                ))}
              </div>

              {/* 分析コメント */}
              {result.analysis && (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
                  <p className="text-sm text-purple-800 dark:text-purple-200">{result.analysis}</p>
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("simulation")}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              ← 再シミュレーション
            </button>
            <button
              onClick={() => setActiveTab("compare")}
              className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              シナリオ比較へ →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
