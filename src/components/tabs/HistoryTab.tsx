"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";

type SubTabType = "all" | "manual" | "auto";

interface Exploration {
  id: string;
  question: string;
  context: string | null;
  constraints: string;
  status: string;
  result: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Strategy {
  name: string;
  reason: string;
  howToObtain?: string;
  totalScore?: number;
  scores?: Record<string, number>;
  judgment?: string;
}

interface ParsedResult {
  strategies?: Strategy[];
  thinking?: string;
  summary?: string;
}

interface Decision {
  strategyName: string;
  decision: string;
  reason?: string;
  explorationId: string;
}

export function HistoryTab() {
  const { calculateWeightedScore } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>("all");
  const [explorations, setExplorations] = useState<Exploration[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Record<string, Decision>>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [historyRes, decisionsRes] = await Promise.all([
        fetch("/api/history"),
        fetch("/api/decisions"),
      ]);

      const historyData = await historyRes.json();
      setExplorations(Array.isArray(historyData) ? historyData : []);

      const decisionsData = await decisionsRes.json();
      const decisionsList: Decision[] = decisionsData.decisions || [];
      const grouped: Record<string, Record<string, Decision>> = {};
      for (const d of decisionsList) {
        if (!grouped[d.explorationId]) grouped[d.explorationId] = {};
        grouped[d.explorationId][d.strategyName] = d;
      }
      setDecisions(grouped);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (
    explorationId: string,
    strategyName: string,
    decision: "adopt" | "reject" | "pending"
  ) => {
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explorationId, strategyName, decision }),
      });

      if (res.ok) {
        setDecisions((prev) => ({
          ...prev,
          [explorationId]: {
            ...prev[explorationId],
            [strategyName]: { strategyName, decision, explorationId },
          },
        }));
      } else {
        alert("決定の保存に失敗しました");
      }
    } catch (error) {
      console.error("Failed to save decision:", error);
      alert("決定の保存に失敗しました");
    }
  };

  const getDecisionSummary = (explorationId: string) => {
    const expDecisions = decisions[explorationId] || {};
    const values = Object.values(expDecisions);
    const adopted = values.filter((d) => d.decision === "adopt").length;
    const rejected = values.filter((d) => d.decision === "reject").length;
    const pending = values.filter((d) => d.decision === "pending").length;
    return { adopted, rejected, pending, total: values.length };
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この探索履歴を削除しますか？")) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setExplorations((prev) => prev.filter((e) => e.id !== id));
        if (expandedId === id) setExpandedId(null);
      } else {
        alert("削除に失敗しました");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  };

  const parseResult = (result: string | null): ParsedResult | null => {
    if (!result) return null;
    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isAutoExplore = (exploration: Exploration) => {
    return exploration.context?.includes("[自動探索]") ?? false;
  };

  const filteredExplorations = explorations.filter((e) => {
    if (activeSubTab === "all") return true;
    if (activeSubTab === "auto") return isAutoExplore(e);
    if (activeSubTab === "manual") return !isAutoExplore(e);
    return true;
  });

  const allCount = explorations.length;
  const autoCount = explorations.filter(isAutoExplore).length;
  const manualCount = allCount - autoCount;

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
            完了
          </span>
        );
      case "failed":
        return (
          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
            失敗
          </span>
        );
      case "running":
      case "processing":
        return (
          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
            実行中
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 rounded">
            {status}
          </span>
        );
    }
  };

  const typeBadge = (exploration: Exploration) => {
    if (isAutoExplore(exploration)) {
      return (
        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded">
          自動
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
        手動
      </span>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">探索履歴</h1>
        <Button variant="outline" onClick={fetchData}>
          更新
        </Button>
      </div>

      {/* サブタブ */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveSubTab("all")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "all"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          すべて ({allCount})
        </button>
        <button
          onClick={() => setActiveSubTab("manual")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "manual"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          手動探索 ({manualCount})
        </button>
        <button
          onClick={() => setActiveSubTab("auto")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === "auto"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          AI自動探索 ({autoCount})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">読み込み中...</div>
      ) : filteredExplorations.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 mb-2">
            {activeSubTab === "all" && "探索履歴がありません"}
            {activeSubTab === "manual" && "手動探索の履歴がありません"}
            {activeSubTab === "auto" && "AI自動探索の履歴がありません"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExplorations.map((exploration) => {
            const parsedResult = parseResult(exploration.result);
            const isExpanded = expandedId === exploration.id;
            const strategies = parsedResult?.strategies || [];
            const summary = getDecisionSummary(exploration.id);

            return (
              <div
                key={exploration.id}
                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                        {exploration.question}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                        <span>{formatDate(exploration.createdAt)}</span>
                        {typeBadge(exploration)}
                        {statusBadge(exploration.status)}
                        {strategies.length > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {strategies.length}件の戦略
                          </span>
                        )}
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
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : exploration.id)}
                      >
                        {isExpanded ? "閉じる" : "詳細"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(exploration.id)}
                        disabled={deleting === exploration.id}
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {deleting === exploration.id ? "..." : "削除"}
                      </Button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-slate-100 dark:border-slate-700">
                    {exploration.context && !isAutoExplore(exploration) && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          コンテキスト
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 p-3 rounded">
                          {exploration.context}
                        </p>
                      </div>
                    )}

                    {exploration.error && (
                      <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded">
                        <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                          エラー
                        </h4>
                        <p className="text-sm text-red-600 dark:text-red-400">{exploration.error}</p>
                      </div>
                    )}

                    {parsedResult?.thinking && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          思考プロセス
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                          {parsedResult.thinking}
                        </p>
                      </div>
                    )}

                    {strategies.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                          探索された戦略
                        </h4>
                        <div className="space-y-3">
                          {strategies.map((strategy, index) => {
                            const expDecisions = decisions[exploration.id] || {};
                            const decision = expDecisions[strategy.name];
                            return (
                              <div
                                key={index}
                                className={`p-3 rounded-lg border ${
                                  decision?.decision === "adopt"
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                    : decision?.decision === "reject"
                                    ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                                    : decision?.decision === "pending"
                                    ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                                    : "bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h5 className="font-medium text-slate-900 dark:text-slate-100">
                                    {strategy.name}
                                  </h5>
                                  <div className="flex items-center gap-2">
                                    {strategy.totalScore !== undefined && (
                                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                        {strategy.totalScore.toFixed(1)}点
                                      </span>
                                    )}
                                    {strategy.scores && !strategy.totalScore && (
                                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                        {calculateWeightedScore(strategy.scores).toFixed(1)}点
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                  <strong className="text-slate-700 dark:text-slate-300">
                                    なぜ勝てる:
                                  </strong>{" "}
                                  {strategy.reason}
                                </p>
                                {strategy.howToObtain && (
                                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                                    <strong className="text-slate-700 dark:text-slate-300">
                                      実現方法:
                                    </strong>{" "}
                                    {strategy.howToObtain}
                                  </p>
                                )}
                                {/* 決定ボタン */}
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                                  <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                                    判定:
                                  </span>
                                  <button
                                    onClick={() => handleDecision(exploration.id, strategy.name, "adopt")}
                                    className={`px-3 py-1 text-xs rounded transition-colors ${
                                      decision?.decision === "adopt"
                                        ? "bg-green-600 text-white"
                                        : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                                    }`}
                                  >
                                    採用
                                  </button>
                                  <button
                                    onClick={() => handleDecision(exploration.id, strategy.name, "reject")}
                                    className={`px-3 py-1 text-xs rounded transition-colors ${
                                      decision?.decision === "reject"
                                        ? "bg-red-600 text-white"
                                        : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                                    }`}
                                  >
                                    却下
                                  </button>
                                  <button
                                    onClick={() => handleDecision(exploration.id, strategy.name, "pending")}
                                    className={`px-3 py-1 text-xs rounded transition-colors ${
                                      decision?.decision === "pending"
                                        ? "bg-yellow-600 text-white"
                                        : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
                                    }`}
                                  >
                                    保留
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
