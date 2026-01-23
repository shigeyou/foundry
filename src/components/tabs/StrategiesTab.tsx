"use client";

import { useState, useEffect } from "react";
import { useApp, EvolveMode } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";

type SubTabType = "evolution" | "auto-explore" | "patterns" | "meta";

interface EvolvedStrategy {
  name: string;
  reason: string;
  howToObtain: string;
  metrics: string;
  sourceStrategies: string[];
  evolveType: "mutation" | "crossover" | "refutation";
  improvement: string;
}

interface EvolveInfo {
  canEvolve: boolean;
  adoptedCount: number;
  topStrategyCount: number;
}

interface AutoExploreRunHistory {
  id: string;
  status: string;
  triggerType: string;
  questionsGenerated: number;
  explorationsCompleted: number;
  highScoresFound: number;
  topScore: number | null;
  topStrategyName: string | null;
  improvement: number | null;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  errors: string[];
}

interface EvolveHistory {
  id: string;
  question: string;
  createdAt: string;
  strategies?: EvolvedStrategy[];
}

interface LearningPattern {
  id: string;
  type: "success_pattern" | "failure_pattern";
  category: string | null;
  pattern: string;
  examples: string[];
  evidence: string | null;
  confidence: number;
  validationCount: number;
  usedCount: number;
  isActive: boolean;
}

interface MetaAnalysisHistory {
  id: string;
  totalExplorations: number;
  totalStrategies: number;
  topStrategies: { name: string; reason: string; frequency: number; relatedQuestions: string[] }[];
  frequentTags: { tag: string; count: number }[];
  clusters: { name: string; description: string; strategies: string[] }[];
  blindSpots: string[];
  thinkingProcess: string;
  createdAt: string;
}

export function StrategiesTab() {
  const {
    setActiveTab,
    evolveStatus,
    evolveProgress,
    evolveResult,
    evolveError,
    startEvolve,
    clearEvolveResult,
    autoExploreStatus,
    autoExploreProgress,
    autoExploreResult,
    autoExploreError,
    startAutoExplore,
    clearAutoExploreResult,
    metaAnalysisStatus,
    metaAnalysisProgress,
    metaAnalysisResult,
    metaAnalysisError,
    startMetaAnalysis,
    clearMetaAnalysisResult,
  } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>("evolution");
  const [loading, setLoading] = useState(true);

  // 進化生成
  const [evolveInfo, setEvolveInfo] = useState<EvolveInfo | null>(null);
  const [evolveMode, setEvolveMode] = useState<EvolveMode>("all");
  const [evolveHistory, setEvolveHistory] = useState<EvolveHistory[]>([]);

  // AI自動探索の履歴
  const [autoExploreHistory, setAutoExploreHistory] = useState<AutoExploreRunHistory[]>([]);

  // 学習パターン
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [patternStats, setPatternStats] = useState<{
    successPatterns: number;
    failurePatterns: number;
    total: number;
  } | null>(null);
  const [filterType, setFilterType] = useState<"all" | "success_pattern" | "failure_pattern">("all");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<string | null>(null);

  // メタ分析履歴
  const [metaHistory, setMetaHistory] = useState<MetaAnalysisHistory[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // メタ分析完了時に履歴を更新
  useEffect(() => {
    if (metaAnalysisStatus === "completed") {
      fetchMetaHistory();
    }
  }, [metaAnalysisStatus]);

  const fetchMetaHistory = async () => {
    try {
      const res = await fetch("/api/meta-analysis?limit=10");
      if (res.ok) {
        const data = await res.json();
        setMetaHistory(data);
      }
    } catch (error) {
      console.error("Failed to fetch meta history:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [evolveRes, autoExploreRes, patternsRes, historyRes] = await Promise.all([
        fetch("/api/evolve"),
        fetch("/api/auto-explore"),
        fetch("/api/learning"),
        fetch("/api/meta-analysis?limit=10"),
      ]);

      if (evolveRes.ok) {
        const evolveData = await evolveRes.json();
        setEvolveInfo(evolveData);
        setEvolveHistory(evolveData.recentEvolutions || []);
      }

      if (autoExploreRes.ok) {
        const autoExploreData = await autoExploreRes.json();
        setAutoExploreHistory(autoExploreData.runHistory || []);
      }

      const patternsData = await patternsRes.json();
      setPatterns(patternsData.patterns || []);
      setPatternStats(patternsData.stats || null);

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setMetaHistory(historyData);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEvolve = async () => {
    await startEvolve(evolveMode);
    const evolveRes = await fetch("/api/evolve");
    if (evolveRes.ok) {
      const evolveData = await evolveRes.json();
      setEvolveInfo(evolveData);
      setEvolveHistory(evolveData.recentEvolutions || []);
    }
  };

  const handleAutoExplore = async () => {
    await startAutoExplore();
    fetchData();
  };

  const handleMetaAnalysis = async () => {
    await startMetaAnalysis();
  };

  const handleExtractPatterns = async () => {
    setIsExtracting(true);
    setExtractResult(null);

    try {
      const res = await fetch("/api/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minDecisions: 5 }),
      });

      const data = await res.json();

      if (!res.ok) {
        setExtractResult(`エラー: ${data.error}`);
      } else {
        setExtractResult(
          `抽出完了: ${data.extracted}パターン（新規${data.saved}件、更新${data.updated}件）`
        );
        fetchData();
      }
    } catch {
      setExtractResult("パターン抽出に失敗しました");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleTogglePattern = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch("/api/learning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });

      if (res.ok) {
        setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: !isActive } : p)));
      }
    } catch (error) {
      console.error("Failed to toggle pattern:", error);
    }
  };

  const handleDeletePattern = async (id: string) => {
    if (!confirm("このパターンを削除しますか？")) return;

    try {
      const res = await fetch(`/api/learning?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setPatterns((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete pattern:", error);
    }
  };

  const evolveTypeLabel = (type: string) => {
    switch (type) {
      case "mutation":
        return "一部を変える";
      case "crossover":
        return "組み合わせ";
      case "refutation":
        return "逆から考える";
      default:
        return type;
    }
  };

  const filteredPatterns = patterns.filter((p) => filterType === "all" || p.type === filterType);

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">シン・勝ち筋の探求</h1>

      {/* サブタブ */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveSubTab("evolution")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "evolution"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          進化生成
        </button>
        <button
          onClick={() => setActiveSubTab("auto-explore")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "auto-explore"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          AI自動探索
        </button>
        <button
          onClick={() => setActiveSubTab("patterns")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "patterns"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          学習パターン ({patterns.length})
        </button>
        <button
          onClick={() => setActiveSubTab("meta")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "meta"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          メタ分析
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">読み込み中...</div>
      ) : (
        <>
          {/* 進化生成タブ */}
          {activeSubTab === "evolution" && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  進化生成
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  あなたが採用した勝ち筋をもとに、一部を変えたり組み合わせたりしながら検証を行い、より良い新しい勝ち筋を段階的に生み出していく仕組みです。
                </p>

                {/* 「あなたが採用した勝ち筋」の説明 */}
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                    「あなたが採用した勝ち筋」とは？
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                    進化生成は、あなたが「これは良い」と判断した勝ち筋をベースに、さらに優れた勝ち筋を生み出します。
                  </p>
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-green-600">✓</span>
                      <span>ランキングタブで「採用」にチェックを入れた勝ち筋が対象になります</span>
                    </span>
                    <button
                      onClick={() => setActiveTab("ranking")}
                      className="underline hover:text-amber-800 dark:hover:text-amber-200"
                    >
                      → ランキングで採用を選ぶ
                    </button>
                  </div>
                </div>

                {/* 進化生成の流れ説明 */}
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">進化生成の3つのアプローチ:</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                      <span className="font-medium text-blue-700 dark:text-blue-300">① 一部を変える</span>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        良い勝ち筋の一部分だけを変えて、もっと良くならないか試します
                      </p>
                    </div>
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-800">
                      <span className="font-medium text-purple-700 dark:text-purple-300">② 組み合わせる</span>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        複数の良い勝ち筋の長所を組み合わせて、新しい勝ち筋を作ります
                      </p>
                    </div>
                    <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded border border-orange-200 dark:border-orange-800">
                      <span className="font-medium text-orange-700 dark:text-orange-300">③ 逆から考える</span>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        あえて反対の視点から検証し、見落としていた可能性を探ります
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-700 dark:text-slate-300">生成モード:</label>
                    <select
                      value={evolveMode}
                      onChange={(e) => setEvolveMode(e.target.value as EvolveMode)}
                      disabled={evolveStatus === "running"}
                      className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="all">全て（①②③すべて試す）</option>
                      <option value="mutation">① 一部を変える</option>
                      <option value="crossover">② 組み合わせる</option>
                      <option value="refutation">③ 逆から考える</option>
                    </select>
                  </div>

                  <Button
                    onClick={handleEvolve}
                    disabled={evolveStatus === "running" || !evolveInfo?.canEvolve}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {evolveStatus === "running" ? "生成中..." : "進化生成を実行"}
                  </Button>

                  {evolveInfo && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      採用済み: {evolveInfo.adoptedCount}件 / TopStrategy: {evolveInfo.topStrategyCount}件
                    </span>
                  )}
                </div>

                {/* プログレスバー */}
                {evolveStatus === "running" && (
                  <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                          進化生成中です...
                        </p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400">
                          バックグラウンドで処理中です。ブラウザを閉じても処理は継続されます。
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 dark:bg-indigo-400 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, evolveProgress)}%` }}
                      />
                    </div>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 text-right">
                      {Math.round(evolveProgress)}%
                    </p>
                  </div>
                )}

                {/* エラー表示 */}
                {evolveStatus === "failed" && evolveError && (
                  <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                      進化生成に失敗しました
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">{evolveError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={clearEvolveResult}
                    >
                      閉じる
                    </Button>
                  </div>
                )}

                {!evolveInfo?.canEvolve && evolveStatus !== "running" && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mb-2">
                      進化生成を始めるには、まず勝ち筋を採用してください
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      「ランキング」タブで良いと思った勝ち筋の「✓」ボタンを押すと、その勝ち筋が進化のベースとして使われます。
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/30"
                      onClick={() => setActiveTab("ranking")}
                    >
                      ランキングで勝ち筋を採用する →
                    </Button>
                  </div>
                )}
              </div>

              {/* 結果表示 */}
              {evolveStatus === "completed" && evolveResult && evolveResult.strategies.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      生成された勝ち筋（{evolveResult.strategies.length}件）
                    </h3>
                    <Button variant="outline" size="sm" onClick={clearEvolveResult}>
                      クリア
                    </Button>
                  </div>

                  {evolveResult.thinkingProcess && (
                    <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        <strong>思考プロセス:</strong> {evolveResult.thinkingProcess}
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {evolveResult.strategies.map((strategy, index) => (
                      <div
                        key={index}
                        className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-slate-900 dark:text-slate-100">
                            {strategy.name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${
                              strategy.evolveType === "mutation"
                                ? "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200"
                                : strategy.evolveType === "crossover"
                                ? "bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200"
                                : "bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200"
                            }`}
                          >
                            {evolveTypeLabel(strategy.evolveType)}
                          </span>
                        </div>

                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                          <strong>なぜ勝てる:</strong> {strategy.reason}
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                          <strong>実現ステップ:</strong> {strategy.howToObtain}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          <strong>改善点:</strong> {strategy.improvement}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-slate-500 dark:text-slate-400">元の勝ち筋:</span>
                          {strategy.sourceStrategies.map((source, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded"
                            >
                              {source}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 進化生成履歴 */}
              {evolveHistory.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    進化生成の履歴（最新5件）
                  </h3>
                  <div className="space-y-3">
                    {evolveHistory.map((history) => (
                      <div
                        key={history.id}
                        className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {history.question.replace("[進化生成] ", "")}
                          </p>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(history.createdAt).toLocaleDateString("ja-JP", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI自動探索タブ */}
          {activeSubTab === "auto-explore" && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  AI自動探索
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  AIが自分でさまざまな視点から問いを立て、それぞれを試しながら結果を比較し、うまくいったパターン（スコアの高い勝ち筋）を見つけ出していく仕組みです。
                </p>

                {/* AI自動探索の流れ説明 */}
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">AIが行う3つのステップ:</p>
                  <div className="flex flex-col md:flex-row items-stretch gap-2">
                    <div className="flex-1 p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🤔</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-300 text-xs">① 問いを立てる</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        「こんな切り口はどうだろう？」とAIが自分で考えます
                      </p>
                    </div>
                    <div className="hidden md:flex items-center text-slate-400">→</div>
                    <div className="flex-1 p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔍</span>
                        <span className="font-medium text-blue-700 dark:text-blue-300 text-xs">② 試して比べる</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        それぞれの問いで探索し、結果を比較します
                      </p>
                    </div>
                    <div className="hidden md:flex items-center text-slate-400">→</div>
                    <div className="flex-1 p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⭐</span>
                        <span className="font-medium text-yellow-700 dark:text-yellow-300 text-xs">③ 良いものを選ぶ</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        評価の高い勝ち筋をランキングに自動で追加します
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <Button
                    onClick={handleAutoExplore}
                    disabled={autoExploreStatus === "running"}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {autoExploreStatus === "running" ? "探索中..." : "自動探索を実行"}
                  </Button>
                </div>

                {/* プログレスバー */}
                {autoExploreStatus === "running" && (
                  <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                          AI自動探索中です...
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                          バックグラウンドで処理中です。他のタブに移動しても処理は継続されます。
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-emerald-200 dark:bg-emerald-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 dark:bg-emerald-400 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, autoExploreProgress)}%` }}
                      />
                    </div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 text-right">
                      {Math.round(autoExploreProgress)}%
                    </p>
                  </div>
                )}

                {/* エラー表示 */}
                {autoExploreStatus === "failed" && autoExploreError && (
                  <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                      自動探索に失敗しました
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">{autoExploreError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={clearAutoExploreResult}
                    >
                      閉じる
                    </Button>
                  </div>
                )}

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ※ AIが5つの問いを自動で考え、それぞれ探索します。
                  高スコア（<span className="font-medium text-yellow-600 dark:text-yellow-400">4.0以上</span>）の勝ち筋は自動的にランキングに追加されます。
                </p>
              </div>

              {/* 実行結果 */}
              {autoExploreStatus === "completed" && autoExploreResult && (
                <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    実行結果
                    {autoExploreResult.timestamp && (
                      <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
                        {new Date(autoExploreResult.timestamp).toLocaleString("ja-JP")}
                      </span>
                    )}
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-white dark:bg-slate-700 rounded-lg">
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {autoExploreResult.questionsGenerated}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">生成した問い</div>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-slate-700 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {autoExploreResult.explorationsCompleted}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">完了した探索</div>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-slate-700 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {autoExploreResult.highScoresFound}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">高スコア（4.0以上）</div>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-slate-700 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {autoExploreResult.topScore.toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">最高スコア</div>
                    </div>
                  </div>

                  {autoExploreResult.topStrategy && (
                    <div className="p-3 bg-white dark:bg-slate-700 rounded-lg mb-4">
                      <span className="text-xs text-slate-500 dark:text-slate-400">トップ勝ち筋: </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {autoExploreResult.topStrategy}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                    {autoExploreResult.duration && <span>所要時間: {autoExploreResult.duration}</span>}
                    {autoExploreResult.improvement && (
                      <span className="text-green-600 dark:text-green-400">
                        改善: {autoExploreResult.improvement}
                      </span>
                    )}
                  </div>

                  {autoExploreResult.errors.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">
                        エラー（{autoExploreResult.errors.length}件）
                      </p>
                      <ul className="text-xs text-red-500 dark:text-red-400 list-disc list-inside">
                        {autoExploreResult.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* AI自動探索履歴 */}
              {autoExploreHistory.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    AI自動探索の履歴
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700">
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                            日時
                          </th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                            ステータス
                          </th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                            問い数
                          </th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                            高スコア
                          </th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                            最高スコア
                          </th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                            トップ勝ち筋
                          </th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                            所要時間
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {autoExploreHistory.map((run) => (
                          <tr
                            key={run.id}
                            className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          >
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                              {new Date(run.startedAt).toLocaleString("ja-JP", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 text-xs rounded ${
                                  run.status === "completed"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : run.status === "running"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                {run.status === "completed" ? "完了" : run.status === "running" ? "実行中" : "失敗"}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-300">
                              {run.questionsGenerated}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {run.highScoresFound > 0 ? (
                                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                                  {run.highScoresFound}件
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {run.topScore ? (
                                <span className="text-purple-600 dark:text-purple-400 font-medium">
                                  {run.topScore.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                              {run.topStrategyName || "-"}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-500 dark:text-slate-400">
                              {run.duration ? `${(run.duration / 60).toFixed(1)}分` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 学習パターンタブ */}
          {activeSubTab === "patterns" && (
            <div className="space-y-6">
              {/* 学習パターンの仕組み説明 */}
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                  学習パターンの仕組み
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                  「探索履歴」や「ランキング」で勝ち筋に対して採否を判断すると、その履歴がここに蓄積されます。
                </p>
                <div className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                  <p>
                    <span className="text-green-600 dark:text-green-400 font-medium">✓ 採用</span>
                    した勝ち筋 → 「成功パターン」として学習
                  </p>
                  <p>
                    <span className="text-red-600 dark:text-red-400 font-medium">✗ 却下</span>
                    した勝ち筋 → 「失敗パターン」として学習
                  </p>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  採否の判断が蓄積されるほど、AIは「どんな勝ち筋が求められているか」を学習し、次回の探索でより的確な提案ができるようになります。
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setActiveTab("history")}
                    className="text-xs text-amber-700 dark:text-amber-300 underline hover:text-amber-900 dark:hover:text-amber-100"
                  >
                    → 探索履歴で採否を判断
                  </button>
                  <button
                    onClick={() => setActiveTab("ranking")}
                    className="text-xs text-amber-700 dark:text-amber-300 underline hover:text-amber-900 dark:hover:text-amber-100"
                  >
                    → ランキングで採否を判断
                  </button>
                </div>
              </div>

              {/* パターン抽出の説明 */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-3">
                  パターン抽出とは？
                </p>

                <div className="space-y-3 text-xs text-indigo-700 dark:text-indigo-300">
                  <div>
                    <p className="font-medium text-indigo-800 dark:text-indigo-200 mb-1">
                      実施目的（なぜ行うのか）
                    </p>
                    <p>
                      あなたが「採用」「却下」した勝ち筋には、意思決定の傾向が隠れています。
                      パターン抽出は、その傾向をAIが言語化し、
                      <span className="font-medium">「成功パターン」「失敗パターン」</span>として明示します。
                      暗黙知を形式知に変える作業です。
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-indigo-800 dark:text-indigo-200 mb-1">
                      得られるメリット（何が有効なのか）
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li><span className="font-medium">探索精度の向上</span>：抽出されたパターンは次回以降の探索時にAIへ自動的に渡され、あなた好みの勝ち筋が提案されやすくなる</li>
                      <li><span className="font-medium">意思決定基準の可視化</span>：自分がどんな勝ち筋を好み、何を避けているかを客観視できる</li>
                      <li><span className="font-medium">組織知の蓄積</span>：個人の判断基準をチームで共有可能な形で残せる</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-indigo-800 dark:text-indigo-200 mb-1">
                      考え方の整理（どのようなロジックか）
                    </p>
                    <p>
                      採否ログ（採用/却下した勝ち筋とその理由）を入力とし、AIが以下を分析します：
                      (1) 採用された勝ち筋の共通点を「成功パターン」として抽出、
                      (2) 却下された勝ち筋の共通点を「失敗パターン」として抽出、
                      (3) 各パターンに確信度（どれだけ確からしいか）を付与。
                      採否の数が増えるほど、パターンの精度が上がります。
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  パターン抽出を実行
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  蓄積された採否ログをAIが分析し、成功・失敗の傾向をパターンとして抽出します。
                </p>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleExtractPatterns}
                    disabled={isExtracting}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isExtracting ? "抽出中..." : "パターンを抽出"}
                  </Button>
                  {extractResult && (
                    <p
                      className={`text-sm ${
                        extractResult.startsWith("エラー")
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {extractResult}
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  抽出されたパターンは次回の探索時にAIへ自動的に渡され、提案の質が向上します。
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-3 py-1 text-xs rounded ${
                    filterType === "all"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  全て ({patternStats?.total || 0})
                </button>
                <button
                  onClick={() => setFilterType("success_pattern")}
                  className={`px-3 py-1 text-xs rounded ${
                    filterType === "success_pattern"
                      ? "bg-green-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  成功 ({patternStats?.successPatterns || 0})
                </button>
                <button
                  onClick={() => setFilterType("failure_pattern")}
                  className={`px-3 py-1 text-xs rounded ${
                    filterType === "failure_pattern"
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  失敗 ({patternStats?.failurePatterns || 0})
                </button>
              </div>

              {filteredPatterns.length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400">
                    パターンがありません。採否を蓄積してから「パターンを抽出」を実行してください。
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPatterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      className={`p-4 rounded-lg border ${
                        pattern.isActive
                          ? pattern.type === "success_pattern"
                            ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
                            : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
                          : "opacity-50 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`px-2 py-0.5 text-xs rounded ${
                                pattern.type === "success_pattern"
                                  ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200"
                                  : "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200"
                              }`}
                            >
                              {pattern.type === "success_pattern" ? "成功" : "失敗"}
                            </span>
                            {pattern.category && (
                              <span className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded">
                                {pattern.category}
                              </span>
                            )}
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              確信度: {(pattern.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                            {pattern.pattern}
                          </p>
                          {pattern.evidence && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              根拠: {pattern.evidence}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleTogglePattern(pattern.id, pattern.isActive)}
                            className={`px-2 py-1 text-xs rounded ${
                              pattern.isActive
                                ? "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"
                                : "bg-blue-500 text-white"
                            }`}
                          >
                            {pattern.isActive ? "無効化" : "有効化"}
                          </button>
                          <button
                            onClick={() => handleDeletePattern(pattern.id)}
                            className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* メタ分析タブ */}
          {activeSubTab === "meta" && (
            <div className="space-y-6">
              {/* メタ分析の説明 */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <p className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-3">
                  メタ分析とは？
                </p>

                <div className="space-y-3 text-xs text-purple-700 dark:text-purple-300">
                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200 mb-1">
                      実施目的（なぜ行うのか）
                    </p>
                    <p>
                      個別の探索では「その問いに対する勝ち筋」しか見えません。メタ分析は、複数の探索結果を俯瞰し、
                      <span className="font-medium">「勝ち筋の勝ち筋」</span>（何度も出現する本質的な勝ちパターン）を発見します。
                      木を見て森を見ず、にならないための分析です。
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200 mb-1">
                      得られるメリット（何が有効なのか）
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li><span className="font-medium">頻出勝ち筋の発見</span>：異なる問いから同じ方向性の勝ち筋が出てくれば、それは本質的な強みの可能性が高い</li>
                      <li><span className="font-medium">盲点の発見</span>：探索されていない領域を指摘し、次に探るべき問いのヒントを得られる</li>
                      <li><span className="font-medium">クラスタリング</span>：類似の勝ち筋をグループ化し、全体像を把握できる</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200 mb-1">
                      考え方の整理（どのようなロジックか）
                    </p>
                    <p>
                      探索履歴の全勝ち筋を入力とし、AIが以下を分析します：
                      (1) 勝ち筋名・理由・タグの類似性から頻出パターンを抽出、
                      (2) 意味的に近い勝ち筋をクラスタに分類、
                      (3) 探索されていない空白領域を推定。
                      探索回数が増えるほど、分析の精度が上がります。
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  メタ分析を実行
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  全ての探索結果を横断的に分析し、繰り返し出現する勝ちパターンや盲点を発見します。
                </p>
                <Button
                  onClick={handleMetaAnalysis}
                  disabled={metaAnalysisStatus === "running"}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {metaAnalysisStatus === "running" ? "分析中..." : "メタ分析を実行"}
                </Button>

                {/* プログレスバー */}
                {metaAnalysisStatus === "running" && (
                  <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="animate-spin h-5 w-5 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                          メタ分析中です...
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                          バックグラウンドで処理中です。他のタブに移動しても処理は継続されます。
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-purple-600 dark:bg-purple-400 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, metaAnalysisProgress)}%` }}
                      />
                    </div>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 text-right">
                      {Math.round(metaAnalysisProgress)}%
                    </p>
                  </div>
                )}

                {/* エラー表示 */}
                {metaAnalysisStatus === "failed" && metaAnalysisError && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                      メタ分析に失敗しました
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">{metaAnalysisError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={clearMetaAnalysisResult}
                    >
                      閉じる
                    </Button>
                  </div>
                )}
              </div>

              {metaAnalysisStatus === "completed" && metaAnalysisResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {metaAnalysisResult.summary.totalExplorations}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">探索数</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {metaAnalysisResult.summary.totalStrategies}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">総勝ち筋数</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {metaAnalysisResult.summary.metaStrategiesCount}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">メタ勝ち筋</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {metaAnalysisResult.summary.clusterCount}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">クラスター</p>
                    </div>
                  </div>

                  {metaAnalysisResult.topStrategies.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        勝ち筋の勝ち筋（頻出パターン）
                      </h3>
                      <div className="space-y-2">
                        {metaAnalysisResult.topStrategies.slice(0, 5).map((s, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm text-slate-700 dark:text-slate-300">{s.name}</span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">{s.count}回</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {metaAnalysisResult.blindSpots.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800 p-6">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        盲点（探索されていない領域）
                      </h3>
                      <ul className="space-y-1">
                        {metaAnalysisResult.blindSpots.map((spot, i) => (
                          <li key={i} className="text-sm text-amber-700 dark:text-amber-300">
                            • {spot}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {metaAnalysisResult.thinkingProcess && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        <strong>分析プロセス:</strong> {metaAnalysisResult.thinkingProcess}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* メタ分析履歴 */}
              {metaHistory.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    過去のメタ分析（{metaHistory.length}件）
                  </h3>
                  <div className="space-y-3">
                    {metaHistory.map((history) => (
                      <div
                        key={history.id}
                        className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <button
                          onClick={() => setExpandedHistoryId(expandedHistoryId === history.id ? null : history.id)}
                          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              {new Date(history.createdAt).toLocaleString("ja-JP")}
                            </span>
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {history.totalExplorations}探索 / {history.totalStrategies}勝ち筋
                            </span>
                            <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                              {history.topStrategies.length}メタ勝ち筋
                            </span>
                          </div>
                          <span className="text-slate-400">
                            {expandedHistoryId === history.id ? "▼" : "▶"}
                          </span>
                        </button>

                        {expandedHistoryId === history.id && (
                          <div className="px-4 pb-4 space-y-4 border-t border-slate-200 dark:border-slate-700">
                            {/* 勝ち筋の勝ち筋 */}
                            {history.topStrategies.length > 0 && (
                              <div className="mt-4">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  勝ち筋の勝ち筋:
                                </p>
                                <div className="space-y-2">
                                  {history.topStrategies.slice(0, 5).map((s, i) => (
                                    <div key={i} className="text-sm text-slate-600 dark:text-slate-400 pl-3 border-l-2 border-purple-300 dark:border-purple-700">
                                      <span className="font-medium">{s.name}</span>
                                      <span className="text-slate-400 ml-2">({s.frequency}回)</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 盲点 */}
                            {history.blindSpots.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
                                  盲点:
                                </p>
                                <ul className="space-y-1">
                                  {history.blindSpots.slice(0, 3).map((spot, i) => (
                                    <li key={i} className="text-xs text-amber-600 dark:text-amber-400">• {spot}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* クラスター */}
                            {history.clusters.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  クラスター ({history.clusters.length}):
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {history.clusters.map((cluster, i) => (
                                    <span key={i} className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                                      {cluster.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
