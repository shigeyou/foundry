"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Exploration {
  id: string;
  question: string;
  context: string | null;
  result: string;
  createdAt: string;
}

interface MetaAnalysisResult {
  totalExplorations: number;
  totalStrategies: number;
  topStrategies: {
    name: string;
    reason: string;
    frequency: number;
    relatedQuestions: string[];
  }[];
  frequentTags: { tag: string; count: number }[];
  clusters: {
    name: string;
    description: string;
    strategies: string[];
  }[];
  blindSpots: string[];
  thinkingProcess: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<Exploration[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metaResult, setMetaResult] = useState<MetaAnalysisResult | null>(null);
  const [metaError, setMetaError] = useState("");
  const [showMeta, setShowMeta] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この履歴を削除しますか？")) return;

    try {
      await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      fetchHistory();
    } catch (error) {
      console.error("Error deleting history:", error);
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch("/api/export?type=history&format=csv");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "exploration_history.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  const handleExportJSON = async () => {
    try {
      const res = await fetch("/api/export?type=history&format=json");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "exploration_history.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  const handleMetaAnalysis = async () => {
    setIsAnalyzing(true);
    setMetaError("");
    setMetaResult(null);
    setShowMeta(true);

    try {
      const res = await fetch("/api/meta-analysis", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "メタ分析に失敗しました");
      }
      const data = await res.json();
      setMetaResult(data);
    } catch (error) {
      setMetaError(error instanceof Error ? error.message : "エラーが発生しました");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const parseResult = (resultString: string) => {
    try {
      return JSON.parse(resultString);
    } catch {
      return null;
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-slate-600 hover:text-slate-900 text-sm">
              ← ホームに戻る
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">探索履歴</h1>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleMetaAnalysis}
              disabled={isAnalyzing || history.length === 0}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isAnalyzing ? "分析中..." : "メタ分析"}
            </Button>
            <Button variant="outline" onClick={handleExportCSV} data-testid="export-csv">
              CSVエクスポート
            </Button>
            <Button variant="outline" onClick={handleExportJSON} data-testid="export-json">
              JSONエクスポート
            </Button>
          </div>
        </div>

        {/* メタ分析結果 */}
        {showMeta && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-purple-900">メタ分析結果</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowMeta(false)}>
                閉じる
              </Button>
            </div>

            {isAnalyzing && (
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="py-8 text-center">
                  <div className="animate-pulse">
                    <p className="text-purple-700 font-semibold">全履歴を横断分析中...</p>
                    <p className="text-purple-600 text-sm mt-2">
                      「勝ち筋の勝ち筋」を抽出しています
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {metaError && (
              <Card className="bg-red-50 border-red-200">
                <CardContent className="py-4 text-red-700">
                  {metaError}
                </CardContent>
              </Card>
            )}

            {metaResult && (
              <div className="space-y-6">
                {/* サマリー */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-purple-100">
                    <CardContent className="py-4 text-center">
                      <p className="text-3xl font-bold text-purple-900">
                        {metaResult.totalExplorations}
                      </p>
                      <p className="text-sm text-purple-700">探索回数</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-100">
                    <CardContent className="py-4 text-center">
                      <p className="text-3xl font-bold text-purple-900">
                        {metaResult.totalStrategies}
                      </p>
                      <p className="text-sm text-purple-700">勝ち筋総数</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-100">
                    <CardContent className="py-4 text-center">
                      <p className="text-3xl font-bold text-purple-900">
                        {metaResult.topStrategies.length}
                      </p>
                      <p className="text-sm text-purple-700">メタ勝ち筋</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-100">
                    <CardContent className="py-4 text-center">
                      <p className="text-3xl font-bold text-purple-900">
                        {metaResult.clusters.length}
                      </p>
                      <p className="text-sm text-purple-700">クラスタ数</p>
                    </CardContent>
                  </Card>
                </div>

                {/* 勝ち筋の勝ち筋 */}
                <Card className="border-purple-300">
                  <CardHeader className="bg-purple-50">
                    <CardTitle className="text-purple-900">
                      勝ち筋の勝ち筋 TOP{metaResult.topStrategies.length}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {metaResult.topStrategies.map((strategy, index) => (
                      <div key={index} className="p-4 bg-gradient-to-r from-purple-50 to-white rounded-lg border border-purple-200">
                        <div className="flex items-start justify-between">
                          <h3 className="font-bold text-lg text-purple-900">
                            {index + 1}. {strategy.name}
                          </h3>
                          <span className="px-2 py-1 bg-purple-200 text-purple-800 text-xs rounded-full">
                            類似{strategy.frequency}件
                          </span>
                        </div>
                        <p className="text-slate-700 mt-2">{strategy.reason}</p>
                        {strategy.relatedQuestions.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-slate-500 mb-1">関連する問い:</p>
                            <div className="flex flex-wrap gap-1">
                              {strategy.relatedQuestions.map((q, i) => (
                                <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                                  {q.length > 30 ? q.substring(0, 30) + "..." : q}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* クラスタ */}
                <Card>
                  <CardHeader>
                    <CardTitle>勝ち筋クラスタ</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {metaResult.clusters.map((cluster, index) => (
                      <div key={index} className="p-4 bg-slate-50 rounded-lg">
                        <h3 className="font-semibold text-slate-900">{cluster.name}</h3>
                        <p className="text-sm text-slate-600 mt-1">{cluster.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {cluster.strategies.map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* 頻出タグ */}
                <Card>
                  <CardHeader>
                    <CardTitle>頻出タグ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {metaResult.frequentTags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-slate-200 text-slate-700 text-sm rounded-full"
                        >
                          {tag.tag} ({tag.count})
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 空白領域 */}
                {metaResult.blindSpots.length > 0 && (
                  <Card className="border-orange-300">
                    <CardHeader className="bg-orange-50">
                      <CardTitle className="text-orange-900">
                        探索されていない空白領域
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ul className="space-y-2">
                        {metaResult.blindSpots.map((spot, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-orange-500">●</span>
                            <span className="text-slate-700">{spot}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* 思考プロセス */}
                {metaResult.thinkingProcess && (
                  <Card className="bg-slate-100">
                    <CardHeader>
                      <CardTitle className="text-sm">分析プロセス</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">
                        {metaResult.thinkingProcess}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* 履歴一覧 */}
        <div className="space-y-4">
          {history.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                探索履歴がありません
              </CardContent>
            </Card>
          ) : (
            history.map((item) => {
              const result = parseResult(item.result);
              const isExpanded = expandedId === item.id;

              return (
                <Card key={item.id} data-testid="history-card">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-slate-500">
                          {formatDate(item.createdAt)}
                        </p>
                        <CardTitle className="text-lg mt-1">
                          {item.question}
                        </CardTitle>
                        {result && (
                          <p className="text-sm text-slate-600 mt-1">
                            {result.strategies?.length || 0}件の勝ち筋
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : item.id)
                          }
                        >
                          {isExpanded ? "閉じる" : "詳細"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          削除
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && result && (
                    <CardContent>
                      <div className="space-y-3 pt-4 border-t">
                        {result.strategies?.map(
                          (
                            strategy: {
                              name: string;
                              reason: string;
                              howToObtain: string;
                              metrics: string;
                            },
                            index: number
                          ) => (
                            <div
                              key={index}
                              className="p-3 bg-slate-100 rounded-lg"
                            >
                              <p className="font-semibold">
                                {index + 1}. {strategy.name}
                              </p>
                              <p className="text-sm text-slate-600 mt-1">
                                {strategy.reason}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
