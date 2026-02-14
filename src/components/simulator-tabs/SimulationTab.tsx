"use client";

import { useSimulator } from "@/contexts/SimulatorContext";

export function SimulationTab() {
  const { setActiveTab, scenarios, preconditions, simulationStatus, runSimulation, results } = useSimulator();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">シミュレーション実行</h2>

        <div className="space-y-6">
          {/* サマリー */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400">前提条件</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{preconditions.length}項目</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400">シナリオ</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{scenarios.length}件</p>
            </div>
          </div>

          {/* 実行ボタン */}
          <div className="text-center py-8">
            {simulationStatus === "idle" && (
              <>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  {scenarios.length}件のシナリオでシミュレーションを実行します
                </p>
                <button
                  onClick={runSimulation}
                  disabled={scenarios.length === 0}
                  className="px-8 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors text-lg disabled:bg-slate-400"
                >
                  シミュレーションを実行
                </button>
              </>
            )}

            {simulationStatus === "running" && (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">シミュレーション実行中...</p>
              </div>
            )}

            {simulationStatus === "completed" && (
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-purple-600 dark:text-purple-400 font-medium mb-4">
                  シミュレーション完了（{results.length}件の結果）
                </p>
                <button
                  onClick={() => setActiveTab("analysis")}
                  className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  結果分析へ →
                </button>
              </div>
            )}

            {simulationStatus === "error" && (
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-red-600 dark:text-red-400 font-medium mb-4">シミュレーションに失敗しました</p>
                <button
                  onClick={runSimulation}
                  className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  再試行
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("scenario")}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              ← シナリオ設定
            </button>
            {results.length > 0 && (
              <button
                onClick={() => setActiveTab("analysis")}
                className="px-4 py-2 text-purple-600 dark:text-purple-400 hover:text-purple-700"
              >
                結果分析へ →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
