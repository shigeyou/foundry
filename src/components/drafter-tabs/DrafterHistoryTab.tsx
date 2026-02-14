"use client";

import { useDrafter } from "@/contexts/DrafterContext";

export function DrafterHistoryTab() {
  const { setActiveTab } = useDrafter();

  // TODO: 実際にはAPIから履歴を取得
  const history: Array<{
    id: string;
    title: string;
    createdAt: Date;
    status: string;
  }> = [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">生成履歴</h2>

        {history.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-slate-600 dark:text-slate-400 mb-4">まだ履歴がありません</p>
            <button
              onClick={() => setActiveTab("input")}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              新しい文書を作成
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
                    <p className="font-medium text-slate-800 dark:text-slate-200">{item.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {item.createdAt.toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    item.status === "final"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200"
                  }`}>
                    {item.status === "final" ? "完成" : "下書き"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
