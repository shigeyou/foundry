"use client";

import { useSimulator } from "@/contexts/SimulatorContext";
import { getSimulatorSettings } from "@/config/simulator-config";

export function SimulatorIntroTab() {
  const { setActiveTab, simulatorId } = useSimulator();
  const simulatorSettings = getSimulatorSettings(simulatorId);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center text-3xl">
            🔮
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{simulatorSettings.name}へようこそ</h1>
            <p className="text-slate-600 dark:text-slate-400">{simulatorSettings.description}</p>
          </div>
        </div>

        {/* シミュレーターの説明 */}
        <section className="mb-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            {simulatorSettings.introDescription.split('\n').map((paragraph, i) => (
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
                <span className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">前提条件を設定</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{simulatorSettings.analysisLabel}の基本パラメータを設定します</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <span className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{simulatorSettings.scenarioLabel}を定義</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">比較したい複数のシナリオを作成します</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <span className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">シミュレーション実行</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">AIが各{simulatorSettings.scenarioLabel}の結果を予測します</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <span className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{simulatorSettings.analysisLabel}・比較</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">シナリオ間の比較と最終レポートを確認します</p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              onClick={() => setActiveTab("preconditions")}
              className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              はじめる →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
