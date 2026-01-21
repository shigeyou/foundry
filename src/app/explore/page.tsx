"use client";

import { useState } from "react";
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
  { title: "親会社支援", question: "商船三井マリテックスが商船三井の事業をどう支援できるか？" },
  { title: "DX全般", question: "商船三井マリテックスのDXを実現するために、どのような新サービスを開発できるか？" },
  { title: "生成AI", question: "生成AIを活用して、商船三井マリテックスの業務効率化や新サービス開発にどう貢献できるか？" },
  { title: "脱炭素", question: "海運業界の脱炭素化に向けて、技術支援でどのような貢献ができるか？" },
  { title: "海技育成", question: "船員の技術力向上のために、どのような研修プログラムを提供できるか？" },
  { title: "コスト削減", question: "会社の業務コストを削減するために、どのようなソリューションを提案できるか？" },
  { title: "安全管理", question: "船舶の安全管理を強化するために、どのようなサービスを展開できるか？" },
  { title: "新規事業", question: "既存の技術・ノウハウを活かして、どのような新規事業に参入できるか？" },
  { title: "3社統合シナジー", question: "2025年4月のMOLグループ3社(MOLマリン、MOLシップテック、MOLオーシャンエキスパート)の統合によるバリューチェーンの拡大により、どのような相乗効果を生み出せるか？" },
  { title: "海外展開", question: "アジア市場において、どのようなサービス展開が有望か？" },
  { title: "データ活用", question: "商船三井マリテックスがこれまで蓄積してきたデータを活用して、どのような付加価値サービスを提供できるか？" },
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
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/" className="text-slate-600 hover:text-slate-900 text-sm">
            ← ホームに戻る
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-2">勝ち筋を探索</h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Sample Questions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600">サンプルの問い（複数選択可）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {sampleQuestions.map((sample, index) => (
                    <button
                      key={index}
                      onClick={() => handleSampleClick(index)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors border ${
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
              <CardHeader>
                <CardTitle>問い</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="特に商船三井マリテックスの〇〇事業について、〇年後に成熟期を迎える「勝ち筋」を示してほしい。"
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>追加文脈（任意）</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="今回の問いをたてた理由や背景情報など、探索にあたって、より深い洞察を得るための情報があれば入力してください。"
                  className="min-h-[80px]"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>制約条件</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {constraints.map((constraint) => (
                    <button
                      key={constraint.id}
                      onClick={() => toggleConstraint(constraint.id)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors border ${
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
              size="lg"
            >
              {isLoading ? "探索中..." : "勝ち筋を探索"}
            </Button>

            {isLoading && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="py-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-700 font-medium">AIが勝ち筋を探索中...</span>
                      <span className="text-blue-600">約2分</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 h-2 rounded-full animate-progress"></div>
                    </div>
                    <p className="text-xs text-blue-600">
                      コア情報・制約条件・外部情報を分析しています
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Results Section */}
          <div>
            {result ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">
                    探索結果（{result.strategies?.length || 0}件の勝ち筋）
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

                <div id="export-content" className="space-y-4 bg-white p-4 rounded-lg">
                  {result.thinkingProcess && (
                    <Card className="bg-slate-100">
                      <CardHeader>
                        <CardTitle className="text-sm">思考プロセス</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">
                          {result.thinkingProcess}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {result.strategies?.map((strategy, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">
                            {index + 1}. {strategy.name}
                          </CardTitle>
                          <span
                            className={`px-2 py-1 text-xs rounded ${confidenceColor(
                              strategy.confidence
                            )}`}
                          >
                            {confidenceLabel(strategy.confidence)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {strategy.tags?.map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1">
                            なぜ勝てる
                          </p>
                          <p className="text-sm">{strategy.reason}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1">
                            入手方法
                          </p>
                          <p className="text-sm">{strategy.howToObtain}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1">
                            指標例
                          </p>
                          <p className="text-sm">{strategy.metrics}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center text-slate-500 py-16">
                  <p>問いを入力して「勝ち筋を探索」を押してください</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
