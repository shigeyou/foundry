"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
  { id: "noLargeInvestment", label: "大型投資を抑制", checked: true },
  { id: "parent", label: "親会社との連携を重視", checked: false },
  { id: "synergy", label: "3社シナジーを優先", checked: false },
];

export default function ExplorePage() {
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [constraints, setConstraints] = useState(defaultConstraints);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExplorationResult | null>(null);
  const [error, setError] = useState("");

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
            <Card>
              <CardHeader>
                <CardTitle>問い</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="例: 親会社の〇〇事業をどう支援できるか？"
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
                  placeholder="今回限りの追加情報があれば入力..."
                  className="min-h-[80px]"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>制約条件</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {constraints.map((constraint) => (
                    <div key={constraint.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={constraint.id}
                        checked={constraint.checked}
                        onCheckedChange={() => toggleConstraint(constraint.id)}
                      />
                      <Label htmlFor={constraint.id}>{constraint.label}</Label>
                    </div>
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
                <h2 className="text-xl font-bold text-slate-900">
                  探索結果（{result.strategies?.length || 0}件の勝ち筋）
                </h2>

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
                          {strategy.confidence}
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
