"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";

type SubTabType = "patterns" | "meta";

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

export function InsightsTab() {
  const {
    setActiveTab,
    metaAnalysisStatus,
    metaAnalysisProgress,
    metaAnalysisResult,
    metaAnalysisError,
    startMetaAnalysis,
    clearMetaAnalysisResult,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<SubTabType>("patterns");
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [patternStats, setPatternStats] = useState<{
    successPatterns: number;
    failurePatterns: number;
    total: number;
  } | null>(null);
  const [filterType, setFilterType] = useState<"all" | "success_pattern" | "failure_pattern">("all");
  const [loading, setLoading] = useState(true);

  // パターン抽出
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
      const [patternsRes, historyRes] = await Promise.all([
        fetch("/api/learning"),
        fetch("/api/meta-analysis?limit=10"),
      ]);
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

  const filteredPatterns = patterns.filter((p) => filterType === "all" || p.type === filterType);

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">インサイト</h1>

      {/* サブタブ */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
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
          {/* 学習パターンサブタブ */}
          {activeSubTab === "patterns" && (
            <div className="space-y-6">
              {/* 学習パターンの仕組み説明 */}
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                  学習パターンの仕組み
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                  「探索履歴」や「ランキング」で戦略に対して採否を判断すると、その履歴がここに蓄積されます。
                </p>
                <div className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                  <p>
                    <span className="text-green-600 dark:text-green-400 font-medium">✓ 採用</span>
                    した戦略 → 「成功パターン」として学習
                  </p>
                  <p>
                    <span className="text-red-600 dark:text-red-400 font-medium">✗ 却下</span>
                    した戦略 → 「失敗パターン」として学習
                  </p>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  採否の判断が蓄積されるほど、AIは「どんな戦略が求められているか」を学習し、次回の探索でより的確な提案ができるようになります。
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
                      あなたが「採用」「却下」した戦略には、意思決定の傾向が隠れています。
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
                      <li><span className="font-medium">探索精度の向上</span>：抽出されたパターンは次回以降の探索時にAIへ自動的に渡され、あなた好みの戦略が提案されやすくなる</li>
                      <li><span className="font-medium">意思決定基準の可視化</span>：自分がどんな戦略を好み、何を避けているかを客観視できる</li>
                      <li><span className="font-medium">組織知の蓄積</span>：個人の判断基準をチームで共有可能な形で残せる</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-indigo-800 dark:text-indigo-200 mb-1">
                      考え方の整理（どのようなロジックか）
                    </p>
                    <p>
                      採否ログ（採用/却下した戦略とその理由）を入力とし、AIが以下を分析します：
                      (1) 採用された戦略の共通点を「成功パターン」として抽出、
                      (2) 却下された戦略の共通点を「失敗パターン」として抽出、
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

          {/* メタ分析サブタブ */}
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
                      <span className="font-medium">「勝ち筋の勝ち筋」</span>（何度も出現する本質的な戦略パターン）を発見します。
                      木を見て森を見ず、にならないための分析です。
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200 mb-1">
                      得られるメリット（何が有効なのか）
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li><span className="font-medium">頻出戦略の発見</span>：異なる問いから同じ方向性の戦略が出てくれば、それは本質的な強みの可能性が高い</li>
                      <li><span className="font-medium">盲点の発見</span>：探索されていない領域を指摘し、次に探るべき問いのヒントを得られる</li>
                      <li><span className="font-medium">クラスタリング</span>：類似戦略をグループ化し、戦略の全体像を把握できる</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200 mb-1">
                      考え方の整理（どのようなロジックか）
                    </p>
                    <p>
                      探索履歴の全戦略を入力とし、AIが以下を分析します：
                      (1) 戦略名・理由・タグの類似性から頻出パターンを抽出、
                      (2) 意味的に近い戦略をクラスタに分類、
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
                  全ての探索結果を横断的に分析し、繰り返し出現する戦略パターンや盲点を発見します。
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
                      <p className="text-xs text-slate-500 dark:text-slate-400">総戦略数</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {metaAnalysisResult.summary.metaStrategiesCount}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">メタ戦略</p>
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
                        勝ち筋の勝ち筋（頻出戦略）
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
                              {history.totalExplorations}探索 / {history.totalStrategies}戦略
                            </span>
                            <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                              {history.topStrategies.length}メタ戦略
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
