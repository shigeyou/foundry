"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportToMarkdown } from "@/lib/export-pdf";

interface WinningStrategy {
  name: string;
  reason: string;
  howToObtain: string;
  metrics: string;
  confidence: "high" | "medium" | "low";
  tags: string[];
}

interface ExplorationResult {
  strategies: WinningStrategy[];
  thinkingProcess: string;
  followUpQuestions?: string[];
}

const defaultConstraints = [
  { id: "existing", label: "既存事業・リソースを活用", checked: true },
  { id: "noLargeInvestment", label: "大型投資に限定", checked: true },
  { id: "parent", label: "親会社との連携を重視", checked: false },
  { id: "synergy", label: "3社シナジーを優先", checked: false },
];
const sampleQuestions = [
  { title: "親会社支援", question: "商船三井グループへの貢献価値を高めるには？" },
  { title: "DX全般", question: "社内業務や顧客向けサービスのDX化で何ができるか？" },
  { title: "生成AI", question: "生成AIで業務効率化・新サービス創出するには？" },
  { title: "脱炭素", question: "脱炭素化支援で新たな収益源を作るには？" },
  { title: "海技育成", question: "船員育成・技術継承で差別化するには？" },
  { title: "コスト削減", question: "業務コストを削減しながら価値を高めるには？" },
  { title: "安全管理", question: "安全管理の高度化で収益に繋げるには？" },
  { title: "新規事業", question: "既存の強みを活かした新規事業は何か？" },
  { title: "3社統合", question: "3社統合で生まれるシナジーをどう活かすか？" },
  { title: "海外展開", question: "アジア市場で勝てるサービスは何か？" },
  { title: "データ活用", question: "蓄積データを収益化するには？" },
];



export default function ExplorePage() {
  const [question, setQuestion] = useState("");
  const [selectedSamples, setSelectedSamples] = useState<Set<number>>(new Set());
  const [constraints, setConstraints] = useState(defaultConstraints);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExplorationResult | null>(null);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [context, setContext] = useState("");
  const [contentHeight, setContentHeight] = useState("calc(100vh - 120px)");

  useEffect(() => {
    const updateHeight = () => {
      // ヘッダー分を引いた高さを計算
      setContentHeight(`calc(100vh - 120px)`);
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const handleExplore = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          context,
          constraintIds: constraints.filter((c) => c.checked).map((c) => c.id),
        }),
      });

      if (!res.ok) {
        throw new Error("探索に失敗しました");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleConstraint = (id: string) => {
    setConstraints(
      constraints.map((c) =>
        c.id === id ? { ...c, checked: !c.checked } : c
      )
    );
  };

  const handleSampleClick = (index: number) => {
    const newSelected = new Set(selectedSamples);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSamples(newSelected);

    // Combine selected questions
    const combinedQuestions = Array.from(newSelected)
      .sort((a, b) => a - b)
      .map((i) => sampleQuestions[i].question)
      .join("\n");
    setQuestion(combinedQuestions);
  };

  const handleExport = () => {
    if (!result) return;
    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      exportToMarkdown(question, result, "kachisuji-report-" + timestamp);
    } catch (err) {
      console.error("Export failed:", err);
      setError("エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  };

  const confidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const confidenceLabel = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "高";
      case "medium":
        return "中";
      case "low":
        return "低";
      default:
        return confidence;
    }
  };

  return (
    <main className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-50 px-4 py-3 border-b border-slate-200">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-600 hover:text-slate-900 text-sm">
              ← ホーム
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">勝ち筋を探索</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto h-full px-4 py-4">
          <div className="grid lg:grid-cols-2 gap-4 h-full">
            {/* Input Section */}
            <div
              className="overflow-y-auto pr-2 space-y-3"
              style={{ maxHeight: contentHeight }}
            >
              {/* Sample Questions */}
              <Card className="flex-shrink-0">
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs text-slate-600">サンプルの問い（複数選択可）</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {sampleQuestions.map((sample, index) => (
                      <button
                        key={index}
                        onClick={() => handleSampleClick(index)}
                        className={`px-2.5 py-1 text-xs rounded-full transition-colors border ${
                          selectedSamples.has(index)
                            ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {sample.title}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-sm">問い</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="例：〇〇領域で、3年以内に収益化できる勝ち筋を見つけたい"
                    className="min-h-[80px] text-sm"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-sm">追加文脈（任意）</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <Textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="問いの背景情報など"
                    className="min-h-[60px] text-sm"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-sm">制約条件</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {constraints.map((constraint) => (
                      <button
                        key={constraint.id}
                        onClick={() => toggleConstraint(constraint.id)}
                        className={`px-2.5 py-1 text-xs rounded-full transition-colors border ${
                          constraint.checked
                            ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {constraint.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleExplore}
                disabled={!question.trim() || isLoading}
                className="w-full"
                size="default"
              >
                {isLoading ? "探索中..." : "勝ち筋を探索"}
              </Button>

              {isLoading && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="py-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-700 font-medium">AIが勝ち筋を探索中...</span>
                        <span className="text-blue-600 text-xs">約2分</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                        <div className="bg-blue-600 h-2 rounded-full animate-progress"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Results Section */}
            <div
              className="overflow-y-auto pl-2"
              style={{ maxHeight: contentHeight }}
            >
              {result ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between sticky top-0 bg-slate-50 py-2 z-10">
                    <h2 className="text-lg font-bold text-slate-900">
                      探索結果（{result.strategies?.length || 0}件）
                    </h2>
                    <Button
                      onClick={handleExport}
                      disabled={isExporting}
                      variant="outline"
                      size="sm"
                    >
                      {isExporting ? "出力中..." : "MD出力"}
                    </Button>
                  </div>

                  <div id="export-content" className="space-y-3">
                    {result.thinkingProcess && (
                      <Card className="bg-slate-100">
                        <CardHeader className="py-2 px-4">
                          <CardTitle className="text-xs">思考プロセス</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                          <p className="text-xs text-slate-600 whitespace-pre-wrap">
                            {result.thinkingProcess}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {result.strategies?.map((strategy, index) => (
                      <Card key={index}>
                        <CardHeader className="py-2 px-4">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-sm">
                              {index + 1}. {strategy.name}
                            </CardTitle>
                            <span
                              className={`px-2 py-0.5 text-xs rounded ${confidenceColor(
                                strategy.confidence
                              )}`}
                            >
                              {confidenceLabel(strategy.confidence)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {strategy.tags?.map((tag, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-500">
                              なぜ勝てる
                            </p>
                            <p className="text-xs">{strategy.reason}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500">
                              入手方法
                            </p>
                            <p className="text-xs">{strategy.howToObtain}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500">
                              指標例
                            </p>
                            <p className="text-xs">{strategy.metrics}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <Card className="h-full flex items-center justify-center min-h-[300px]">
                  <CardContent className="text-center text-slate-500 py-8">
                    <p className="text-sm">問いを入力して「勝ち筋を探索」を押してください</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
