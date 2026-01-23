"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";

interface Strategy {
  id?: string;
  name: string;
  reason: string;
  howToObtain?: string;
  totalScore: number;
  scores?: Record<string, number>;
  question: string;
  judgment?: string;
  createdAt?: string;
  explorationId?: string;
}

interface Decision {
  strategyName: string;
  decision: string;
  reason?: string;
  explorationId: string;
}

export function RankingTab() {
  const { setActiveTab } = useApp();
  const [rankingStrategies, setRankingStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDecisions, setAllDecisions] = useState<Record<string, Decision>>({});
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [decisionsRes, rankingRes] = await Promise.all([
        fetch("/api/decisions"),
        fetch("/api/ranking"),
      ]);

      const decisionsData = await decisionsRes.json();
      const decisions: Decision[] = decisionsData.decisions || [];
      const decisionsByName: Record<string, Decision> = {};
      for (const d of decisions) {
        decisionsByName[d.strategyName] = d;
      }
      setAllDecisions(decisionsByName);

      const rankingData = await rankingRes.json();
      setRankingStrategies(rankingData.strategies || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (strategy: Strategy, decision: "adopt" | "reject" | "pending") => {
    const explorationId = strategy.explorationId || "ranking-" + strategy.name;

    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          explorationId,
          strategyName: strategy.name,
          decision,
        }),
      });

      if (res.ok) {
        setAllDecisions((prev) => ({
          ...prev,
          [strategy.name]: { strategyName: strategy.name, decision, explorationId },
        }));
      } else {
        alert("決定の保存に失敗しました");
      }
    } catch (error) {
      console.error("Failed to save decision:", error);
      alert("決定の保存に失敗しました");
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });
  };

  const judgmentBadge = (judgment?: string) => {
    if (judgment === "優先投資") {
      return (
        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
          優先投資
        </span>
      );
    } else if (judgment === "条件付き") {
      return (
        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
          条件付き
        </span>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">ランキング</h1>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {rankingStrategies.length}件の戦略
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">読み込み中...</div>
      ) : rankingStrategies.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 mb-4">ランキングデータがありません</p>
          <Button onClick={() => setActiveTab("explore")}>探索を始める</Button>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700">
                <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  #
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  戦略名
                </th>
                <th className="text-center py-3 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  スコア
                </th>
                <th className="text-center py-3 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  判定
                </th>
                <th className="text-center py-3 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  採否
                </th>
                <th className="text-center py-3 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  日付
                </th>
              </tr>
            </thead>
            <tbody>
              {rankingStrategies.map((strategy, index) => {
                const isExpanded = expandedIndex === index;
                return (
                  <tr
                    key={index}
                    className={`border-b border-slate-100 dark:border-slate-700 cursor-pointer transition-colors ${
                      index < 3 ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""
                    } ${isExpanded ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  >
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          index === 0
                            ? "bg-yellow-400 text-yellow-900"
                            : index === 1
                            ? "bg-slate-300 text-slate-700"
                            : index === 2
                            ? "bg-orange-300 text-orange-900"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                        <span className="text-sm text-slate-900 dark:text-slate-100">
                          {strategy.name}
                        </span>
                      </div>
                      {/* 展開時の詳細表示 */}
                      {isExpanded && (
                        <div
                          className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 space-y-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {strategy.question && (
                            <div>
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">問い:</span>
                              <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                                {strategy.question}
                              </p>
                            </div>
                          )}
                          {strategy.reason && (
                            <div>
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">なぜ勝てる:</span>
                              <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                                {strategy.reason}
                              </p>
                            </div>
                          )}
                          {strategy.howToObtain && (
                            <div>
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">実現方法:</span>
                              <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                                {strategy.howToObtain}
                              </p>
                            </div>
                          )}
                          {strategy.scores && Object.keys(strategy.scores).length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">スコア内訳:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(strategy.scores).map(([key, value]) => (
                                  <span
                                    key={key}
                                    className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded"
                                  >
                                    {key}: {value}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center align-top">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {strategy.totalScore?.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center align-top">{judgmentBadge(strategy.judgment)}</td>
                    <td className="py-3 px-3 text-center align-top">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDecision(strategy, "adopt"); }}
                          className={`px-2 py-0.5 text-xs rounded transition-colors ${
                            allDecisions[strategy.name]?.decision === "adopt"
                              ? "bg-green-600 text-white"
                              : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                          }`}
                          title="採用"
                        >
                          ✓
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDecision(strategy, "reject"); }}
                          className={`px-2 py-0.5 text-xs rounded transition-colors ${
                            allDecisions[strategy.name]?.decision === "reject"
                              ? "bg-red-600 text-white"
                              : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                          title="却下"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center text-xs text-slate-500 dark:text-slate-400 align-top">
                      {formatDate(strategy.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
