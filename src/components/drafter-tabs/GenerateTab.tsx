"use client";

import { useDrafter } from "@/contexts/DrafterContext";

export function GenerateTab() {
  const { setActiveTab, inputFields, generateStatus, generateDraft, currentDraft } = useDrafter();

  const filledFields = inputFields.filter((f) => f.value.trim() !== "");

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">下書き生成</h2>

        <div className="space-y-6">
          {/* 入力サマリー */}
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3">入力情報サマリー</h3>
            <div className="space-y-2">
              {filledFields.map((field) => (
                <div key={field.id} className="flex">
                  <span className="text-sm text-slate-500 dark:text-slate-400 w-32 flex-shrink-0">
                    {field.label}:
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                    {field.value.length > 50 ? field.value.substring(0, 50) + "..." : field.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 生成ボタン */}
          <div className="text-center py-8">
            {generateStatus === "idle" && (
              <>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  入力情報とRAGデータを元に、AIが下書きを生成します
                </p>
                <button
                  onClick={generateDraft}
                  className="px-8 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-lg"
                >
                  下書きを生成する
                </button>
              </>
            )}

            {generateStatus === "running" && (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">生成中...</p>
              </div>
            )}

            {generateStatus === "completed" && currentDraft && (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-green-600 dark:text-green-400 font-medium mb-4">生成完了</p>
                <button
                  onClick={() => setActiveTab("edit")}
                  className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  編集画面へ →
                </button>
              </div>
            )}

            {generateStatus === "error" && (
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-red-600 dark:text-red-400 font-medium mb-4">生成に失敗しました</p>
                <button
                  onClick={generateDraft}
                  className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  再試行
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("input")}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              ← 入力情報を修正
            </button>
            {currentDraft && (
              <button
                onClick={() => setActiveTab("edit")}
                className="px-4 py-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
              >
                編集画面へ →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
