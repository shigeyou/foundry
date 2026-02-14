"use client";

import { useSimulator } from "@/contexts/SimulatorContext";

export function SimulatorHistoryTab() {
  const { setActiveTab } = useSimulator();

  // TODO: 実際にはAPIから履歴を取得
  const history: Array<{
    id: string;
    name: string;
    scenarioCount: number;
    createdAt: Date;
  }> = [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">シミュレーション履歴</h2>

        {history.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-slate-600 dark:text-slate-400 mb-4">まだ履歴がありません</p>
            <button
              onClick={() => setActiveTab("preconditions")}
              className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              新しいシミュレーションを開始
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{item.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {item.createdAt.toLocaleDateString("ja-JP")} · {item.scenarioCount}シナリオ
                    </p>
                  </div>
                  <button className="text-purple-600 hover:text-purple-700 text-sm">
                    詳細を見る
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
