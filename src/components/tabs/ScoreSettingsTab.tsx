"use client";

import { useState } from "react";
import { useApp, defaultWeights, scoreLabels, ScoreWeights } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";

// 各評価軸の詳細説明
const scoreDescriptions: Record<keyof ScoreWeights, {
  subtitle: string;
  question: string;
  levels: { score: number; description: string }[];
}> = {
  revenuePotential: {
    subtitle: "儲かる大きさ",
    question: "この戦略が成功した場合、どれだけの収益が見込めるか？",
    levels: [
      { score: 5, description: "市場が大きく、単価と量の両方が立つ。勝てば会社の柱になる" },
      { score: 3, description: "特定領域で十分な利益が出る。部門の柱にはなる" },
      { score: 1, description: "良い話だが、上限が小さく事業になりにくい" },
    ],
  },
  timeToRevenue: {
    subtitle: "いつ儲かるか",
    question: "収益化までにどれくらいの期間がかかるか？",
    levels: [
      { score: 5, description: "3〜12か月で課金検証まで進める" },
      { score: 3, description: "12〜24か月で収益化" },
      { score: 1, description: "3年超。規制や大規模投資が前提" },
    ],
  },
  competitiveAdvantage: {
    subtitle: "なぜ自社が勝てるか",
    question: "競合に対してどれだけ優位性があるか？",
    levels: [
      { score: 5, description: "自社にしかない資産が決定的に効く" },
      { score: 3, description: "優位性はあるが、模倣も可能" },
      { score: 1, description: "誰でもできる。価格競争になりやすい" },
    ],
  },
  executionFeasibility: {
    subtitle: "作れる、売れる、運用できる",
    question: "実行に必要なリソース・体制は揃っているか？",
    levels: [
      { score: 5, description: "必要なデータ、システム、体制、意思決定が揃っている" },
      { score: 3, description: "不足はあるが、半年以内に埋められる" },
      { score: 1, description: "権限、データ、現場運用のいずれかが欠けて詰む" },
    ],
  },
  hqContribution: {
    subtitle: "グループとして意味があるか",
    question: "本社や他グループ会社への貢献度は？",
    levels: [
      { score: 5, description: "本社の戦略テーマや収益に直結し、横展開できる" },
      { score: 3, description: "間接効果はあるが、主戦場ではない" },
      { score: 1, description: "ローカル最適で、説明が難しい" },
    ],
  },
  mergerSynergy: {
    subtitle: "1社では出ない価値が出るか",
    question: "合併による相乗効果はどれくらいあるか？",
    levels: [
      { score: 5, description: "両社の資産が掛け算になる" },
      { score: 3, description: "足し算の効率化レベル" },
      { score: 1, description: "シナジーが薄く、調整コストが勝つ" },
    ],
  },
};

export function ScoreSettingsTab() {
  const { weights, setWeights, adjustWeight } = useApp();
  const [expandedAxis, setExpandedAxis] = useState<keyof ScoreWeights | null>(null);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  // 正規化後の比率を計算（合計100%になるよう換算）
  const getNormalizedPercentage = (value: number) => {
    if (totalWeight === 0) return 0;
    return Math.round((value / totalWeight) * 100);
  };

  return (
    <div className="h-full flex flex-col px-4 py-3" style={{ height: 'calc(100vh - 120px)' }}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            スコア設定{" "}
            <span className={`text-sm font-normal ${totalWeight === 100 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
              (設定値合計: {totalWeight})
            </span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            各評価軸の重みを設定。設定値は<strong>比率</strong>として計算時に正規化されます。
          </p>
        </div>
      </div>

      {/* 2カラムレイアウト */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* 左カラム: スライダー */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 overflow-auto">
          <div className="flex items-center justify-between mb-3 sticky top-0 bg-white dark:bg-slate-800 pb-2 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              重み設定
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeights(defaultWeights)}
              className="text-xs h-7 px-2"
            >
              デフォルトに戻す
            </Button>
          </div>
          <div className="space-y-4">
            {(Object.keys(weights) as (keyof ScoreWeights)[]).map((key) => {
              const desc = scoreDescriptions[key];
              const isExpanded = expandedAxis === key;
              const normalizedPct = getNormalizedPercentage(weights[key]);

              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {scoreLabels[key]}
                        </span>
                        <button
                          onClick={() => setExpandedAxis(isExpanded ? null : key)}
                          className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          title="詳細を表示"
                        >
                          {isExpanded ? "▼" : "▶"}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {desc.subtitle}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {weights[key]}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
                        → {normalizedPct}%
                      </span>
                    </div>
                  </div>

                  {/* 詳細説明（展開時） */}
                  {isExpanded && (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded p-2 text-xs space-y-1.5">
                      <p className="text-slate-600 dark:text-slate-300 font-medium">
                        {desc.question}
                      </p>
                      <div className="space-y-1">
                        {desc.levels.map((level) => (
                          <div key={level.score} className="flex items-start gap-1.5">
                            <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-white text-xs font-bold flex-shrink-0 ${
                              level.score === 5 ? "bg-green-500" :
                              level.score === 3 ? "bg-yellow-500" : "bg-red-500"
                            }`}>
                              {level.score}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300 text-xs leading-tight">
                              {level.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weights[key]}
                    onChange={(e) => adjustWeight(key, parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 右カラム: 説明とプレビュー */}
        <div className="flex flex-col gap-3 min-h-0 overflow-auto">
          {/* デフォルト設定 */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              デフォルト値
            </h3>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {(Object.keys(defaultWeights) as (keyof ScoreWeights)[]).map((key) => (
                <div
                  key={key}
                  className="flex justify-between p-1.5 bg-slate-50 dark:bg-slate-700 rounded"
                >
                  <span className="text-slate-600 dark:text-slate-400">{scoreLabels[key]}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {defaultWeights[key]}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 重み係数の考え方 */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              重み係数（デフォルト値）の考え方
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              本スコア設定では、初期評価に必要な観点を整理した結果、6つの指標を設定している。これらは、事業としての成立性、実行の現実性、全社的な意味合いという三つの軸を分解し、初期段階で過不足なく案件を整理することを目的としている。
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-2">
              収益性や事業規模、実行可能性に関する指標は、まず取り組む価値があるか、現実的に進められるかを確認するための基本的な観点である。一方で、本社貢献や合併シナジーといった指標は、戦略的な位置づけを評価するための観点として設けているが、初期評価では解釈の幅が出やすいため、比重を抑えている。
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-2">
              この6指標は役割が重複しないよう整理しており、いずれかが欠けると評価に偏りが生じる。一方で、これ以上細分化すると初期評価としては複雑になりすぎるため、比較と整理を行ううえで適切な粒度として、この構成としている。
            </p>
          </div>

          {/* スコア計算ロジックの説明 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-3 flex-1">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
              スコア計算の仕組み
            </h3>
            <div className="space-y-2 text-xs text-blue-900 dark:text-blue-100">
              <p className="text-blue-700 dark:text-blue-300">
                AIが各戦略を6軸で <strong>1〜5点</strong> で評価し、重み（比率）を掛けて合計します。
              </p>
              <div className="bg-white/50 dark:bg-slate-800/50 rounded p-2 font-mono text-xs">
                <p>総合スコア = Σ（各軸スコア × 正規化比率）</p>
                <p className="text-slate-500">※ 正規化比率 = 各設定値 ÷ 設定値合計</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
