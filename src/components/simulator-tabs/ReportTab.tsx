"use client";

import { useSimulator } from "@/contexts/SimulatorContext";

export function ReportTab() {
  const { setActiveTab, results, scenarios, preconditions, simulatorId } = useSimulator();

  const handleExport = () => {
    const report = {
      simulatorId,
      generatedAt: new Date().toISOString(),
      preconditions: preconditions.map((p) => ({ label: p.label, value: p.value, unit: p.unit })),
      scenarios: scenarios.map((s) => ({ name: s.name, description: s.description })),
      results: results.map((r) => ({ scenarioName: r.scenarioName, metrics: r.metrics, analysis: r.analysis })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulation-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">レポート</h2>

        <div className="space-y-6">
          {/* レポートサマリー */}
          <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">シミュレーション概要</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 dark:text-slate-400">前提条件</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{preconditions.length}項目</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">シナリオ数</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{scenarios.length}件</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">結果数</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{results.length}件</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">生成日時</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {new Date().toLocaleDateString("ja-JP")}
                </p>
              </div>
            </div>
          </div>

          {/* 結果ハイライト */}
          {results.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">結果ハイライト</h3>
              <div className="space-y-2">
                {results.map((result) => (
                  <div key={result.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{result.scenarioName}</p>
                    {result.analysis && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{result.analysis}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* エクスポート */}
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <h3 className="font-medium text-purple-800 dark:text-purple-200 mb-3">レポートのエクスポート</h3>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              JSONでダウンロード
            </button>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("compare")}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              ← シナリオ比較
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className="px-4 py-2 text-purple-600 dark:text-purple-400 hover:text-purple-700"
            >
              履歴を見る →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
