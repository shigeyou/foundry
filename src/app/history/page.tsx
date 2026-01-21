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

export default function HistoryPage() {
  const [history, setHistory] = useState<Exploration[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            <Button variant="outline" onClick={handleExportCSV} data-testid="export-csv">
              CSVエクスポート
            </Button>
            <Button variant="outline" onClick={handleExportJSON} data-testid="export-json">
              JSONエクスポート
            </Button>
          </div>
        </div>

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
