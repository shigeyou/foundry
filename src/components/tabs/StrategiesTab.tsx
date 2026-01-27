"use client";

import { useState, useEffect } from "react";
import { useApp, EvolveMode } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";

type SubTabType = "evolution" | "auto-explore";

interface EvolvedStrategy {
  name: string;
  reason: string;
  howToObtain: string;
  metrics: string;
  sourceStrategies: string[];
  evolveType: "mutation" | "crossover" | "refutation";
  improvement: string;
  totalScore?: number;
}

interface EvolveInfo {
  canEvolve: boolean;
  adoptedCount: number;
  topStrategyCount: number;
}

interface AutoExploreStrategy {
  name: string;
  question: string;
  totalScore: number;
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
  strategies?: AutoExploreStrategy[];
}

interface EvolveHistoryStrategy {
  name: string;
  evolveType: string;
  sourceStrategies: string[];
  totalScore?: number;
}

interface EvolveHistory {
  id: string;
  question: string;
  createdAt: string;
  strategies?: EvolveHistoryStrategy[];
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
  } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>("evolution");
  const [loading, setLoading] = useState(true);

  // 進化生成
  const [evolveInfo, setEvolveInfo] = useState<EvolveInfo | null>(null);
  const [evolveHistory, setEvolveHistory] = useState<EvolveHistory[]>([]);

  // AI自動探索の履歴
  const [autoExploreHistory, setAutoExploreHistory] = useState<AutoExploreRunHistory[]>([]);

  // 進化生成履歴の展開状態
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
  // AI自動探索履歴の展開状態
  const [expandedAutoExploreIds, setExpandedAutoExploreIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [evolveRes, autoExploreRes] = await Promise.all([
        fetch("/api/evolve"),
        fetch("/api/auto-explore"),
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
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEvolve = async () => {
    await startEvolve("all");
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

  const evolveTypeLabel = (type: string) => {
    switch (type) {
      case "mutation":
        return "突然変異";
      case "crossover":
        return "交差";
      case "refutation":
        return "反証";
      default:
        return type;
    }
  };

  const evolveTypeIcon = (type: string) => {
    switch (type) {
      case "mutation":
        return "💡";
      case "crossover":
        return "🧬";
      case "refutation":
        return "🔄";
      default:
        return "•";
    }
  };

  const toggleHistoryExpand = (id: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAutoExploreExpand = (id: string) => {
    setExpandedAutoExploreIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">シン・勝ち筋の探求</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        AIが過去の探索結果を学習し、より優れた勝ち筋（シン・勝ち筋）を自動で発見・進化させます。
      </p>

      {/* サブタブ */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveSubTab("evolution")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "evolution"
              ? "border-indigo-500 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🧬</span>
            <div className="text-left">
              <div>進化生成</div>
              <div className={`text-xs ${activeSubTab === "evolution" ? "text-indigo-600 dark:text-indigo-500" : "text-slate-500"}`}>
                採用した勝ち筋を進化させる
              </div>
            </div>
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab("auto-explore")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "auto-explore"
              ? "border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div className="text-left">
              <div>AI自動探索</div>
              <div className={`text-xs ${activeSubTab === "auto-explore" ? "text-emerald-600 dark:text-emerald-500" : "text-slate-500"}`}>
                AIが自動で問いを立て探索
              </div>
            </div>
          </div>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">読み込み中...</div>
      ) : (
        <>
          {/* 進化生成タブ */}
          {activeSubTab === "evolution" && (
            <div className="space-y-6">
              {/* 進化生成とは */}
              <div className="p-4 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-lg border-2 border-indigo-300 dark:border-indigo-700">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🧬</span>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
                      進化生成とは
                    </h2>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-2">
                      ランキングで<span className="text-green-600 dark:text-green-400 font-medium"> ✓採用 </span>
                      した勝ち筋をベースに、シン・勝ち筋を生み出します。
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                {/* 進化生成の3つのアプローチ */}
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">進化生成の3つのアプローチ:</p>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      （遺伝的アルゴリズム + 批判的思考に基づく手法）
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                      <span className="font-medium text-blue-700 dark:text-blue-300">① 一部を変える</span>
                      <span className="text-xs text-blue-500 dark:text-blue-400 ml-1">（突然変異）</span>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        良い勝ち筋の一部分だけを変えて、もっと良くならないか試します
                      </p>
                    </div>
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-800">
                      <span className="font-medium text-purple-700 dark:text-purple-300">② 組み合わせる</span>
                      <span className="text-xs text-purple-500 dark:text-purple-400 ml-1">（交叉）</span>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        複数の良い勝ち筋の長所を組み合わせて、シン・勝ち筋を作ります
                      </p>
                    </div>
                    <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded border border-orange-200 dark:border-orange-800">
                      <span className="font-medium text-orange-700 dark:text-orange-300">③ 逆から考える</span>
                      <span className="text-xs text-orange-500 dark:text-orange-400 ml-1">（反証）</span>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        あえて反対の視点から検証し、見落としていた可能性を探ります
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-4">
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
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-3">
                    <span className="text-amber-600">⚠</span>
                    <span className="text-sm text-amber-700 dark:text-amber-300">
                      まずランキングで勝ち筋を採用してください
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/30"
                      onClick={() => setActiveTab("ranking")}
                    >
                      採用する →
                    </Button>
                  </div>
                )}
              </div>

              {/* 結果表示 */}
              {evolveStatus === "completed" && evolveResult && evolveResult.strategies.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        生成された勝ち筋（{evolveResult.strategies.length}件）
                      </h3>
                      {evolveResult.archivedCount !== undefined && evolveResult.archivedCount > 0 && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          ✓ {evolveResult.archivedCount}件がランキングに自動登録されました（スコア4.0以上）
                        </p>
                      )}
                    </div>
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
                          <div className="flex items-center gap-2">
                            {strategy.totalScore && (
                              <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                                strategy.totalScore >= 4.0
                                  ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200"
                                  : "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300"
                              }`}>
                                スコア: {strategy.totalScore.toFixed(1)}
                              </span>
                            )}
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

              {/* 進化生成履歴 - アコーディオン形式 */}
              {evolveHistory.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    進化生成の履歴（最新5件）
                  </h3>
                  <div className="space-y-2">
                    {evolveHistory.map((history) => {
                      const isExpanded = expandedHistoryIds.has(history.id);
                      const strategies = history.strategies || [];
                      const topScore = strategies.length > 0
                        ? Math.max(...strategies.map((s) => s.totalScore || 0))
                        : null;

                      return (
                        <div
                          key={history.id}
                          className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden"
                        >
                          {/* ヘッダー（クリックで展開/折りたたみ） */}
                          <button
                            onClick={() => toggleHistoryExpand(history.id)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                                  ▶
                                </span>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {history.question.replace("[進化生成] ", "")}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(history.createdAt).toLocaleDateString("ja-JP", {
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 ml-5">
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                🧬 {strategies.length}件生成
                              </span>
                              {topScore !== null && topScore > 0 && (
                                <span className="text-xs text-amber-600 dark:text-amber-400">
                                  最高 {topScore}点
                                </span>
                              )}
                            </div>
                          </button>

                          {/* 展開時の詳細 */}
                          {isExpanded && strategies.length > 0 && (
                            <div className="border-t border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3">
                              <div className="space-y-2">
                                {strategies.map((strategy, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 bg-slate-50 dark:bg-slate-700/30 rounded border border-slate-100 dark:border-slate-600"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className={strategy.totalScore === topScore ? "text-amber-500" : "text-slate-400"}>
                                          {strategy.totalScore === topScore ? "★" : "○"}
                                        </span>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                          {strategy.name}
                                        </span>
                                      </div>
                                      {strategy.totalScore && (
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">
                                          {strategy.totalScore}点
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 ml-5 text-xs text-slate-500 dark:text-slate-400">
                                      <span>{evolveTypeIcon(strategy.evolveType)} {evolveTypeLabel(strategy.evolveType)}</span>
                                      <span>←</span>
                                      <span className="truncate">{strategy.sourceStrategies.join(" + ")}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 展開時だが戦略がない場合 */}
                          {isExpanded && strategies.length === 0 && (
                            <div className="border-t border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3">
                              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                                詳細情報がありません
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI自動探索タブ */}
          {activeSubTab === "auto-explore" && (
            <div className="space-y-6">
              {/* AI自動探索とは（概要＋仕組み） */}
              <div className="p-4 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-lg border-2 border-emerald-300 dark:border-emerald-700">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🤖</span>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                      AI自動探索とは
                    </h2>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                      AIが自分で問いを立て、探索を実行し、高スコア（4.0以上）の勝ち筋を自動でランキングに登録します。
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                {/* AI自動探索の流れ説明 */}
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">AIが行う3つのステップ:</p>
                  <div className="flex flex-col md:flex-row items-stretch gap-2">
                    <div className="flex-1 p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🤔</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-300 text-xs">①AIが問いを立てる</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        「こんな切り口はどうだろう？」とAIが自分で考えます
                      </p>
                    </div>
                    <div className="hidden md:flex items-center text-slate-400">→</div>
                    <div className="flex-1 p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔍</span>
                        <span className="font-medium text-blue-700 dark:text-blue-300 text-xs">②AIが試して比べる</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        それぞれの問いでAIが自分で探索し、結果を比較します
                      </p>
                    </div>
                    <div className="hidden md:flex items-center text-slate-400">→</div>
                    <div className="flex-1 p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⭐</span>
                        <span className="font-medium text-yellow-700 dark:text-yellow-300 text-xs">③AIがよいものを選ぶ</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        評価の高い勝ち筋をAIが自分でランキングに登録します
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
                      <div className="text-xs text-slate-500 dark:text-slate-400">AIが作成した問い</div>
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

              {/* AI自動探索履歴 - アコーディオン形式 */}
              {autoExploreHistory.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    AI自動探索の履歴（最新5件）
                  </h3>
                  <div className="space-y-2">
                    {autoExploreHistory.map((run) => {
                      const isExpanded = expandedAutoExploreIds.has(run.id);

                      return (
                        <div
                          key={run.id}
                          className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden"
                        >
                          {/* ヘッダー（クリックで展開/折りたたみ） */}
                          <button
                            onClick={() => toggleAutoExploreExpand(run.id)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                                  ▶
                                </span>
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
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {run.topStrategyName ? `トップ: ${run.topStrategyName}` : "AI自動探索"}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(run.startedAt).toLocaleDateString("ja-JP", {
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 ml-5">
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                🤔 {run.questionsGenerated}件の問い
                              </span>
                              {run.highScoresFound > 0 && (
                                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                  ⭐ 高スコア {run.highScoresFound}件
                                </span>
                              )}
                              {run.topScore && (
                                <span className="text-xs text-purple-600 dark:text-purple-400">
                                  最高 {run.topScore.toFixed(2)}点
                                </span>
                              )}
                            </div>
                          </button>

                          {/* 展開時の詳細 */}
                          {isExpanded && (
                            <div className="border-t border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div className="p-2 bg-slate-50 dark:bg-slate-700/30 rounded text-center">
                                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                    {run.questionsGenerated}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">AIが作成した問い</div>
                                </div>
                                <div className="p-2 bg-slate-50 dark:bg-slate-700/30 rounded text-center">
                                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                    {run.explorationsCompleted}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">完了した探索</div>
                                </div>
                                <div className="p-2 bg-slate-50 dark:bg-slate-700/30 rounded text-center">
                                  <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                                    {run.highScoresFound}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">高スコア（4.0以上）</div>
                                </div>
                                <div className="p-2 bg-slate-50 dark:bg-slate-700/30 rounded text-center">
                                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                    {run.topScore ? run.topScore.toFixed(2) : "-"}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">最高スコア</div>
                                </div>
                              </div>

                              {/* 勝ち筋リスト */}
                              {run.strategies && run.strategies.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                    発見した勝ち筋（{run.strategies.length}件・スコア順）
                                  </p>
                                  <div className="space-y-2">
                                    {run.strategies.map((strategy, idx) => {
                                      const isTop = idx === 0;
                                      return (
                                        <div
                                          key={idx}
                                          className="p-2 bg-slate-50 dark:bg-slate-700/30 rounded border border-slate-100 dark:border-slate-600"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              <span className={isTop ? "text-amber-500" : "text-slate-400"}>
                                                {isTop ? "★" : "○"}
                                              </span>
                                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {strategy.name}
                                              </span>
                                            </div>
                                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                              strategy.totalScore >= 4.0
                                                ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                                                : "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-400"
                                            }`}>
                                              {strategy.totalScore.toFixed(1)}点
                                            </span>
                                          </div>
                                          <div className="mt-1 ml-5 text-xs text-slate-500 dark:text-slate-400 truncate">
                                            問い: {strategy.question}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {run.topStrategyName && (!run.strategies || run.strategies.length === 0) && (
                                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800 mb-3">
                                  <span className="text-xs text-slate-500 dark:text-slate-400">トップ勝ち筋: </span>
                                  <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                    {run.topStrategyName}
                                  </span>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                                {run.duration && (
                                  <span>所要時間: {(run.duration / 60).toFixed(1)}分</span>
                                )}
                                {run.improvement && (
                                  <span className="text-green-600 dark:text-green-400">
                                    改善: +{run.improvement.toFixed(2)}%
                                  </span>
                                )}
                                {run.completedAt && (
                                  <span>
                                    完了: {new Date(run.completedAt).toLocaleString("ja-JP", {
                                      month: "2-digit",
                                      day: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                )}
                              </div>

                              {run.errors && run.errors.length > 0 && (
                                <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">
                                    エラー（{run.errors.length}件）
                                  </p>
                                  <ul className="text-xs text-red-500 dark:text-red-400 list-disc list-inside">
                                    {run.errors.map((error, i) => (
                                      <li key={i}>{error}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
