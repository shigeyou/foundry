"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

type TabType = "history" | "patterns" | "meta";

interface Exploration {
  id: string;
  question: string;
  status: string;
  createdAt: string;
  result?: string;
}

interface Decision {
  strategyName: string;
  decision: string;
  reason?: string;
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

interface MetaResult {
  summary: {
    totalExplorations: number;
    totalStrategies: number;
    metaStrategiesCount: number;
    clusterCount: number;
  };
  topStrategies: { name: string; count: number }[];
  clusters: { name: string; strategies: string[] }[];
  frequentTags: { tag: string; count: number }[];
  blindSpots: string[];
  thinkingProcess: string;
}

function InsightsPageContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabType) || "history";
  const highlightId = searchParams.get("id");

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [explorations, setExplorations] = useState<Exploration[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Record<string, Decision>>>({});
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [patternStats, setPatternStats] = useState<{ successPatterns: number; failurePatterns: number; total: number } | null>(null);
  const [filterType, setFilterType] = useState<"all" | "success_pattern" | "failure_pattern">("all");
  const [loading, setLoading] = useState(true);

  // 展開中の探索ID
  const [expandedId, setExpandedId] = useState<string | null>(highlightId);

  // メタ分析
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metaResult, setMetaResult] = useState<MetaResult | null>(null);

  // パターン抽出
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 探索履歴を取得
      const historyRes = await fetch("/api/history");
      const historyData = await historyRes.json();
      setExplorations(historyData.explorations || []);

      // 採否データを取得
      const decisionsRes = await fetch("/api/decisions");
      const decisionsData = await decisionsRes.json();
      const decisionsList: Decision[] = decisionsData.decisions || [];

      // explorationIdでグループ化
      const grouped: Record<string, Record<string, Decision>> = {};
      for (const d of decisionsList) {
        const expId = (d as Decision & { explorationId: string }).explorationId;
        if (!grouped[expId]) grouped[expId] = {};
        grouped[expId][d.strategyName] = d;
      }
      setDecisions(grouped);

      // 学習パターンを取得
      const patternsRes = await fetch("/api/learning");
      const patternsData = await patternsRes.json();
      setPatterns(patternsData.patterns || []);
      setPatternStats(patternsData.stats || null);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaAnalysis = async () => {
    setIsAnalyzing(true);
    setMetaResult(null);

    try {
      const res = await fetch("/api/meta-analysis", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        alert(`エラー: ${data.error}`);
      } else {
        setMetaResult(data);
      }
    } catch (error) {
      alert("メタ分析に失敗しました");
    } finally {
      setIsAnalyzing(false);
    }
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
    } catch (error) {
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
        setPatterns((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: !isActive } : p))
        );
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDecisionSummary = (explorationId: string) => {
    const expDecisions = decisions[explorationId] || {};
    const values = Object.values(expDecisions);
    const adopted = values.filter((d) => d.decision === "adopt").length;
    const rejected = values.filter((d) => d.decision === "reject").length;
    const pending = values.filter((d) => d.decision === "pending").length;
    return { adopted, rejected, pending, total: values.length };
  };

  const filteredPatterns = patterns.filter(
    (p) => filterType === "all" || p.type === filterType
  );

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* ヘッダー */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
              ← ダッシュボード
            </Link>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              インサイト
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/strategies"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              戦略一覧
            </Link>
            <Link
              href="/settings"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              設定
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* タブ */}
        <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            探索履歴 ({explorations.length})
          </button>
          <button
            onClick={() => setActiveTab("patterns")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "patterns"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            学習パターン ({patterns.length})
          </button>
          <button
            onClick={() => setActiveTab("meta")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "meta"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            メタ分析
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            読み込み中...
          </div>
        ) : (
          <>
            {/* 探索履歴タブ */}
            {activeTab === "history" && (
              <div className="space-y-4">
                {explorations.length === 0 ? (
                  <Card className="dark:bg-slate-800 dark:border-slate-700">
                    <CardContent className="py-12 text-center">
                      <p className="text-slate-500 dark:text-slate-400 mb-4">
                        探索履歴がありません
                      </p>
                      <Link href="/">
                        <Button>探索を始める</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  explorations.map((exploration) => {
                    const summary = getDecisionSummary(exploration.id);
                    const isExpanded = expandedId === exploration.id;
                    const result = exploration.result ? JSON.parse(exploration.result) : null;
                    const strategies = result?.strategies || [];

                    return (
                      <Card
                        key={exploration.id}
                        className={`dark:bg-slate-800 dark:border-slate-700 ${
                          highlightId === exploration.id ? "ring-2 ring-blue-500" : ""
                        }`}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                {formatDate(exploration.createdAt)}
                              </p>
                              <h3 className="font-medium text-slate-900 dark:text-slate-100">
                                {exploration.question}
                              </h3>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedId(isExpanded ? null : exploration.id)}
                            >
                              {isExpanded ? "閉じる" : `結果を見る (${strategies.length}件)`}
                            </Button>
                          </div>
                          {summary.total > 0 && (
                            <div className="flex gap-2 mt-2">
                              {summary.adopted > 0 && (
                                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                                  採用 {summary.adopted}
                                </span>
                              )}
                              {summary.rejected > 0 && (
                                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
                                  却下 {summary.rejected}
                                </span>
                              )}
                              {summary.pending > 0 && (
                                <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                                  保留 {summary.pending}
                                </span>
                              )}
                            </div>
                          )}

                          {/* 展開表示 */}
                          {isExpanded && strategies.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600 space-y-3">
                              {strategies.map((strategy: { name: string; reason: string; howToObtain?: string; scores?: Record<string, number> }, idx: number) => {
                                const expDecisions = decisions[exploration.id] || {};
                                const decision = expDecisions[strategy.name];
                                const totalScore = strategy.scores
                                  ? Object.values(strategy.scores).reduce((a, b) => a + b, 0) / Object.keys(strategy.scores).length
                                  : 0;

                                return (
                                  <div
                                    key={idx}
                                    className={`p-3 rounded-lg ${
                                      decision?.decision === "adopt"
                                        ? "bg-green-50 dark:bg-green-900/20"
                                        : decision?.decision === "reject"
                                        ? "bg-red-50 dark:bg-red-900/20"
                                        : "bg-slate-100 dark:bg-slate-700"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <h4 className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                        {strategy.name}
                                      </h4>
                                      <div className="flex items-center gap-2">
                                        {totalScore > 0 && (
                                          <span className="text-xs text-blue-600 dark:text-blue-400">
                                            {totalScore.toFixed(1)}
                                          </span>
                                        )}
                                        {decision && (
                                          <span
                                            className={`px-2 py-0.5 text-xs rounded ${
                                              decision.decision === "adopt"
                                                ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200"
                                                : decision.decision === "reject"
                                                ? "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200"
                                                : "bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200"
                                            }`}
                                          >
                                            {decision.decision === "adopt" ? "採用" : decision.decision === "reject" ? "却下" : "保留"}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                      {strategy.reason}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {/* 学習パターンタブ */}
            {activeTab === "patterns" && (
              <div className="space-y-6">
                {/* パターン抽出 */}
                <Card className="dark:bg-slate-800 dark:border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-lg dark:text-slate-100">パターン抽出</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Button
                        onClick={handleExtractPatterns}
                        disabled={isExtracting}
                        className="bg-purple-600 hover:bg-purple-700"
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
                      人の採否ログから成功/失敗パターンをAIで抽出し、次回の探索に反映します。
                    </p>
                  </CardContent>
                </Card>

                {/* フィルター */}
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

                {/* パターン一覧 */}
                {filteredPatterns.length === 0 ? (
                  <Card className="dark:bg-slate-800 dark:border-slate-700">
                    <CardContent className="py-8 text-center">
                      <p className="text-slate-500 dark:text-slate-400">
                        パターンがありません。採否を蓄積してから「パターンを抽出」を実行してください。
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {filteredPatterns.map((pattern) => (
                      <Card
                        key={pattern.id}
                        className={`${
                          pattern.isActive
                            ? pattern.type === "success_pattern"
                              ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
                              : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"
                            : "opacity-50"
                        }`}
                      >
                        <CardContent className="py-4">
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
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* メタ分析タブ */}
            {activeTab === "meta" && (
              <div className="space-y-6">
                <Card className="dark:bg-slate-800 dark:border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-lg dark:text-slate-100">メタ分析</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      全ての探索結果を横断的に分析し、繰り返し出現する戦略パターンや盲点を発見します。
                    </p>
                    <Button
                      onClick={handleMetaAnalysis}
                      disabled={isAnalyzing}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isAnalyzing ? "分析中..." : "メタ分析を実行"}
                    </Button>
                  </CardContent>
                </Card>

                {/* メタ分析結果 */}
                {metaResult && (
                  <div className="space-y-4">
                    {/* サマリー */}
                    <div className="grid grid-cols-4 gap-4">
                      <Card className="dark:bg-slate-800 dark:border-slate-700">
                        <CardContent className="py-4 text-center">
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {metaResult.summary.totalExplorations}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">探索数</p>
                        </CardContent>
                      </Card>
                      <Card className="dark:bg-slate-800 dark:border-slate-700">
                        <CardContent className="py-4 text-center">
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {metaResult.summary.totalStrategies}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">総戦略数</p>
                        </CardContent>
                      </Card>
                      <Card className="dark:bg-slate-800 dark:border-slate-700">
                        <CardContent className="py-4 text-center">
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {metaResult.summary.metaStrategiesCount}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">メタ戦略</p>
                        </CardContent>
                      </Card>
                      <Card className="dark:bg-slate-800 dark:border-slate-700">
                        <CardContent className="py-4 text-center">
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {metaResult.summary.clusterCount}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">クラスター</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* トップ戦略 */}
                    {metaResult.topStrategies.length > 0 && (
                      <Card className="dark:bg-slate-800 dark:border-slate-700">
                        <CardHeader>
                          <CardTitle className="text-lg dark:text-slate-100">
                            勝ち筋の勝ち筋（頻出戦略）
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {metaResult.topStrategies.slice(0, 5).map((s, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                  {s.name}
                                </span>
                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                  {s.count}回
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 盲点 */}
                    {metaResult.blindSpots.length > 0 && (
                      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                        <CardHeader>
                          <CardTitle className="text-lg dark:text-slate-100">
                            盲点（探索されていない領域）
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-1">
                            {metaResult.blindSpots.map((spot, i) => (
                              <li key={i} className="text-sm text-amber-700 dark:text-amber-300">
                                • {spot}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* 思考プロセス */}
                    {metaResult.thinkingProcess && (
                      <Card className="dark:bg-slate-800 dark:border-slate-700">
                        <CardContent className="py-4">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            <strong>分析プロセス:</strong> {metaResult.thinkingProcess}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">読み込み中...</div>}>
      <InsightsPageContent />
    </Suspense>
  );
}
