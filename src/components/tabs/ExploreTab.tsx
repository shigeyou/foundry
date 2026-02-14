"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { FileDropzoneInline } from "@/components/ui/file-dropzone";
import { getFinderSettings, getScoreLabels } from "@/config/finder-config";

export function ExploreTab() {
  const {
    swot,
    explorationStatus,
    explorationProgress,
    explorationResult,
    explorationError,
    startExploration,
    cancelExploration,
    clearExplorationResult,
    // グローバルな入力状態（タブ切替時も保持）
    exploreQuestion: question,
    setExploreQuestion: setQuestion,
    exploreAdditionalContext: additionalContext,
    setExploreAdditionalContext: setAdditionalContext,
    exploreSelectedPresets: selectedPresets,
    setExploreSelectedPresets: setSelectedPresets,
    finderId,
  } = useApp();

  // ファインダー固有の設定を取得
  const finderSettings = getFinderSettings(finderId);
  const scoreLabels = getScoreLabels(finderId);

  const [expandedStrategy, setExpandedStrategy] = useState<number | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  // 動的プリセット質問（デフォルトはファインダー設定から）
  const [presetQuestions, setPresetQuestions] = useState(finderSettings.presetQuestions);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetsSource, setPresetsSource] = useState<"default" | "cached" | "rag">("default");

  // localStorageのキー（ファインダーごとに別キャッシュ）
  const PRESETS_CACHE_KEY = `${finderId || "default"}_preset_questions`;

  // RAG情報からプリセット質問を生成（手動再生成用）
  const generatePresets = async () => {
    setPresetsLoading(true);
    try {
      const res = await fetch("/api/preset-questions");
      if (res.ok) {
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          setPresetQuestions(data.questions);
          setPresetsSource("rag");
          // localStorageにキャッシュ
          localStorage.setItem(PRESETS_CACHE_KEY, JSON.stringify({
            questions: data.questions,
            timestamp: Date.now(),
          }));
        }
      }
    } catch (error) {
      console.error("Failed to generate preset questions:", error);
    } finally {
      setPresetsLoading(false);
    }
  };

  // 初回ロード時：キャッシュがあれば使用、なければファインダーデフォルトを使用
  useEffect(() => {
    const cached = localStorage.getItem(PRESETS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.questions && parsed.questions.length > 0) {
          setPresetQuestions(parsed.questions);
          setPresetsSource("cached");
          return;
        }
      } catch {
        // パースエラーの場合は無視
      }
    }
    // キャッシュがない場合はファインダーのデフォルト質問を使用
    setPresetQuestions(finderSettings.presetQuestions);
    setPresetsSource("default");
  }, [finderId, finderSettings.presetQuestions, PRESETS_CACHE_KEY]);

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

  const handleFileAttach = async (file: File) => {
    setFileLoading(true);
    try {
      const text = await file.text();
      setAttachedFile({ name: file.name, content: text });
      // ファイル内容を追加文脈に追加
      const fileContext = `\n\n【添付ファイル: ${file.name}】\n${text}`;
      setAdditionalContext((prev) => prev + fileContext);
    } catch (error) {
      console.error("Failed to read file:", error);
    } finally {
      setFileLoading(false);
    }
  };

  const handleRemoveFile = () => {
    if (attachedFile) {
      // 追加文脈からファイル内容を削除
      const fileContext = `\n\n【添付ファイル: ${attachedFile.name}】\n${attachedFile.content}`;
      setAdditionalContext((prev) => prev.replace(fileContext, ""));
      setAttachedFile(null);
    }
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

  const handleClear = useCallback(() => {
    clearExplorationResult();
    setQuestion("");
    setAdditionalContext("");
    setSelectedPresets(new Set());
    setExpandedStrategy(null);
    setAttachedFile(null);
  }, [clearExplorationResult, setQuestion, setAdditionalContext, setSelectedPresets]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 p-4 min-h-0">
        {/* 左カラム: 入力エリア (2/5) */}
        <div className="lg:col-span-2 flex flex-col space-y-3 min-h-0">
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{finderSettings.exploreLabel}</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              問いを立てて、AIが{finderSettings.resultLabel}を探索します。
            </p>
          </div>

          <div className="flex-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3 overflow-y-auto min-h-0">
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  プリセット質問（複数選択可）
                  <span className="ml-2 text-xs text-slate-400">
                    {presetQuestions.length}個
                  </span>
                </label>
                <button
                  onClick={generatePresets}
                  disabled={presetsLoading || explorationStatus === "running"}
                  className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {presetsLoading ? "生成中..." : "RAGから再生成"}
                </button>
              </div>
              {presetsLoading ? (
                <div className="flex items-center justify-center py-4 text-sm text-slate-500">
                  <span className="animate-spin mr-2">⏳</span>
                  RAG情報から質問を生成中...
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                  {presetQuestions.map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => togglePreset(i)}
                      disabled={explorationStatus === "running"}
                      className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
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
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  追加文脈（任意）
                </label>
                <FileDropzoneInline
                  accept=".txt,.md,.json,.csv"
                  onFileSelected={(file) => handleFileAttach(file)}
                  disabled={explorationStatus === "running" || fileLoading}
                  loading={fileLoading}
                />
              </div>
              {attachedFile && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-xs text-blue-700 dark:text-blue-300 flex-1 truncate">
                    {attachedFile.name}
                  </span>
                  <button
                    onClick={handleRemoveFile}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    title="ファイルを削除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
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
              {explorationStatus === "running" && (
                <Button
                  onClick={cancelExploration}
                  variant="outline"
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600"
                >
                  キャンセル
                </Button>
              )}
              {(explorationResult || explorationError) && (
                <Button variant="outline" onClick={handleClear}>
                  クリア
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 右カラム: 結果エリア (3/5) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 flex flex-col min-h-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3 flex-shrink-0">
            探索結果
          </h2>

          {/* コンテンツエリア（スクロール可能） */}
          <div className="flex-1 overflow-y-auto min-h-0">
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
                        className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => setExpandedStrategy(expandedStrategy === i ? null : i)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              #{i + 1}
                            </span>
                            <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                              {strategy.name}
                            </span>
                            {finderSettings.departmentBadgeEnabled && strategy.tags?.[0] && (
                              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                                {strategy.tags[0]}
                              </span>
                            )}
                            {finderSettings.fixedBadge && (
                              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-medium">
                                {finderSettings.fixedBadge}
                              </span>
                            )}
                          </div>
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                            {(strategy.totalScore || 0).toFixed(1)}点
                          </span>
                        </div>

                        {expandedStrategy === i && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 space-y-2 text-sm">
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
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {Object.entries(strategy.scores).map(([key, value]) => (
                                  <span
                                    key={key}
                                    className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-600 rounded text-xs text-slate-600 dark:text-slate-300"
                                  >
                                    {scoreLabels[key] || key}: {value}
                                  </span>
                                ))}
                              </div>
                            )}
                            {strategy.tags && strategy.tags.length > (finderSettings.departmentBadgeEnabled ? 1 : 0) && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {strategy.tags.slice(finderSettings.departmentBadgeEnabled ? 1 : 0).map((tag, ti) => (
                                  <span key={ti} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded text-xs">
                                    {tag}
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
                    {finderSettings.resultLabel}が見つかりませんでした
                  </p>
                )}
              </div>
            )}

            {/* 初期状態 */}
            {explorationStatus === "idle" && !explorationResult && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                <svg
                  className="w-12 h-12 mb-3"
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
    </div>
  );
}
