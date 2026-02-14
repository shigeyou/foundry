"use client";

import { useDrafter } from "@/contexts/DrafterContext";
import { getDrafterSettings } from "@/config/drafter-config";

export function DrafterIntroTab() {
  const { setActiveTab, drafterId } = useDrafter();
  const drafterSettings = getDrafterSettings(drafterId);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center text-3xl">
            📝
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{drafterSettings.name}へようこそ</h1>
            <p className="text-slate-600 dark:text-slate-400">{drafterSettings.description}</p>
          </div>
        </div>

        {/* ドラフターの説明 */}
        <section className="mb-6">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            {drafterSettings.introDescription.split('\n').map((paragraph, i) => (
              <p key={i} className="text-slate-700 dark:text-slate-300 leading-relaxed mb-2 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">使い方</h2>
            <div className="grid gap-4">
              <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{drafterSettings.templateLabel}を確認</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">使用するテンプレートを確認・選択します</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">入力情報を入力</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{drafterSettings.outputLabel}生成に必要な情報を入力します</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{drafterSettings.outputLabel}を生成</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">AIが入力情報とRAGデータを元に{drafterSettings.outputLabel}を生成します</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">編集・出力</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">生成された{drafterSettings.outputLabel}を編集し、最終文書として出力します</p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              onClick={() => setActiveTab("template")}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              はじめる →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
