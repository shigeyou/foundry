"use client";

import { useState } from "react";
import { useApp, presetQuestions } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";

export function ExploreTab() {
  const {
    swot,
    explorationStatus,
    explorationProgress,
    explorationResult,
    explorationError,
    startExploration,
    clearExplorationResult,
  } = useApp();

  const [question, setQuestion] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [selectedPresets, setSelectedPresets] = useState<Set<number>>(new Set());
  const [expandedStrategy, setExpandedStrategy] = useState<number | null>(null);

  const togglePreset = (index: number) => {
    const newSelected = new Set(selectedPresets);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedPresets(newSelected);
    const combinedQuestions = Array.from(newSelected)
      .sort((a, b) => a - b)
      .map((i) => presetQuestions[i].question)
      .join("\n");
    setQuestion(combinedQuestions);
  };

  const handleExplore = async () => {
    if (!question.trim()) return;

    const swotContext = swot
      ? `SWOT分析に基づく探索。強み: ${swot.strengths.join(", ")}。機会: ${swot.opportunities.join(", ")}。`
      : "";
    const fullContext = additionalContext.trim()
      ? `${swotContext}\n\n追加文脈: ${additionalContext.trim()}`
      : swotContext;

    await startExploration(question.trim(), fullContext);
  };

  const handleClear = () => {
    clearExplorationResult();
    setQuestion("");
    setAdditionalContext("");
    setSelectedPresets(new Set());
    setExpandedStrategy(null);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左カラム: 入力エリア */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">勝ち筋探索</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              問いを立てて、AIが勝ち筋（戦略）を探索します。
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                問いを立てる
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="例: 生成AIで新規事業を立ち上げるには？"
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none"
                rows={5}
                disabled={explorationStatus === "running"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                プリセット質問（複数選択可）
              </label>
              <div className="flex flex-wrap gap-2">
                {presetQuestions.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => togglePreset(i)}
                    disabled={explorationStatus === "running"}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      selectedPresets.has(i)
                        ? "bg-blue-600 text-white"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    }`}
                    title={preset.question}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                追加文脈（任意）
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="制約条件や背景情報など"
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none text-sm"
                rows={2}
                disabled={explorationStatus === "running"}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleExplore}
                disabled={!question.trim() || explorationStatus === "running"}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {explorationStatus === "running" ? "探索中..." : "探索する"}
              </Button>
              {(explorationResult || explorationError) && (
                <Button variant="outline" onClick={handleClear}>
                  クリア
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 右カラム: 結果エリア */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 min-h-[400px]">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            探索結果
          </h2>

          {/* 探索中 */}
          {explorationStatus === "running" && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      探索中です...
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      バックグラウンドで処理中です。ブラウザを閉じても処理は継続されます。
                    </p>
                  </div>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, explorationProgress)}%` }}
                  />
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 text-right">
                  {Math.round(explorationProgress)}%
                </p>
              </div>
            </div>
          )}

          {/* エラー */}
          {explorationStatus === "failed" && explorationError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                探索に失敗しました
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">{explorationError}</p>
            </div>
          )}

          {/* 結果表示 */}
          {explorationStatus === "completed" && explorationResult && (
            <div className="space-y-4">
              <div className="text-sm text-slate-500 dark:text-slate-400 p-2 bg-slate-50 dark:bg-slate-700 rounded">
                問い: {explorationResult.question}
              </div>

              {explorationResult.strategies.length > 0 ? (
                <div className="space-y-3">
                  {explorationResult.strategies.map((strategy, i) => (
                    <div
                      key={i}
                      className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => setExpandedStrategy(expandedStrategy === i ? null : i)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            #{i + 1}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {strategy.name}
                          </span>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                          {strategy.totalScore.toFixed(1)}点
                        </span>
                      </div>

                      {expandedStrategy === i && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600 space-y-3 text-sm">
                          <div>
                            <span className="font-medium text-slate-600 dark:text-slate-400">
                              なぜ勝てる:
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 mt-1">
                              {strategy.reason}
                            </p>
                          </div>
                          {strategy.howToObtain && (
                            <div>
                              <span className="font-medium text-slate-600 dark:text-slate-400">
                                実現方法:
                              </span>
                              <p className="text-slate-700 dark:text-slate-300 mt-1">
                                {strategy.howToObtain}
                              </p>
                            </div>
                          )}
                          {strategy.scores && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {Object.entries(strategy.scores).map(([key, value]) => (
                                <span
                                  key={key}
                                  className="px-2 py-0.5 bg-slate-200 dark:bg-slate-600 rounded text-xs text-slate-600 dark:text-slate-300"
                                >
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  戦略が見つかりませんでした
                </p>
              )}
            </div>
          )}

          {/* 初期状態 */}
          {explorationStatus === "idle" && !explorationResult && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500">
              <svg
                className="w-16 h-16 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p className="text-sm">問いを入力して探索を開始してください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
