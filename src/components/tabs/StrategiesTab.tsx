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
  const [evolveMode, setEvolveMode] = useState<EvolveMode>("all");
  const [evolveHistory, setEvolveHistory] = useState<EvolveHistory[]>([]);

  // AI自動探索の履歴
  const [autoExploreHistory, setAutoExploreHistory] = useState<AutoExploreRunHistory[]>([]);

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
    await startEvolve(evolveMode);
    // 完了後に履歴を更新
    const evolveRes = await fetch("/api/evolve");
    if (evolveRes.ok) {
      const evolveData = await evolveRes.json();
      setEvolveInfo(evolveData);
      setEvolveHistory(evolveData.recentEvolutions || []);
    }
  };

  const handleAutoExplore = async () => {
    await startAutoExplore();
    // 完了後に履歴を更新
    fetchData();
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
                  あなたが採用した勝ち筋をもとに、一部を変えたり組み合わせたりしながら検証を行い、より良い新しい戦略を段階的に生み出していく仕組みです。
                </p>

                {/* 「あなたが採用した勝ち筋」の説明 */}
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                    「あなたが採用した勝ち筋」とは？
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                    進化生成は、あなたが「これは良い」と判断した戦略をベースに、さらに優れた戦略を生み出します。
                  </p>
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-green-600">✓</span>
                      <span>ランキングタブで「採用」にチェックを入れた戦略が対象になります</span>
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
                        良い戦略の一部分だけを変えて、もっと良くならないか試します
                      </p>
                    </div>
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-800">
                      <span className="font-medium text-purple-700 dark:text-purple-300">② 組み合わせる</span>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        複数の良い戦略の長所を組み合わせて、新しい戦略を作ります
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
                      進化生成を始めるには、まず戦略を採用してください
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      「ランキング」タブで良いと思った戦略の「✓」ボタンを押すと、その戦略が進化のベースとして使われます。
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/30"
                      onClick={() => setActiveTab("ranking")}
                    >
                      ランキングで戦略を採用する →
                    </Button>
                  </div>
                )}
              </div>

              {/* 結果表示 */}
              {evolveStatus === "completed" && evolveResult && evolveResult.strategies.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      生成された戦略（{evolveResult.strategies.length}件）
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
                          <span className="text-xs text-slate-500 dark:text-slate-400">元戦略:</span>
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
                        評価の高い戦略をランキングに自動で追加します
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
                  高スコア（<span className="font-medium text-yellow-600 dark:text-yellow-400">4.0以上</span>）の戦略は自動的にランキングに追加されます。
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
                      <span className="text-xs text-slate-500 dark:text-slate-400">トップ戦略: </span>
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
                            トップ戦略
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
        </>
      )}
    </div>
  );
}
