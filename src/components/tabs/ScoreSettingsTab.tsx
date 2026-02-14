"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { getFinderSettings, getDefaultWeights, type ScoreConfig } from "@/config/finder-config";

// 各評価軸の詳細説明（ファインダーごと）
interface ScoreDescription {
  subtitle: string;
  question: string;
  levels: { score: number; description: string }[];
}

// 勝ち筋ファインダー用
const winningStrategyDescriptions: Record<string, ScoreDescription> = {
  revenuePotential: {
    subtitle: "儲かる大きさ",
    question: "この勝ち筋が成功した場合、どれだけの収益が見込めるか？",
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

// 自社開発AIアプリファインダー用
const defensiveDxDescriptions: Record<string, ScoreDescription> = {
  costReduction: {
    subtitle: "どれだけコストを削減できるか",
    question: "この施策によって年間どれだけのコスト削減が見込めるか？",
    levels: [
      { score: 5, description: "年間1000万円以上の削減効果" },
      { score: 3, description: "年間100〜500万円程度の削減効果" },
      { score: 1, description: "削減効果は限定的（100万円未満）" },
    ],
  },
  implementationEase: {
    subtitle: "内製で実装できるか",
    question: "内製開発チームでどれだけ容易に実装できるか？",
    levels: [
      { score: 5, description: "既存スキルで1〜2ヶ月で実装可能" },
      { score: 3, description: "一部学習が必要だが、半年以内に実装可能" },
      { score: 1, description: "外部委託や長期開発が必要" },
    ],
  },
  riskMitigation: {
    subtitle: "リスクをどれだけ減らせるか",
    question: "業務リスクや障害リスクをどれだけ軽減できるか？",
    levels: [
      { score: 5, description: "重大インシデントを防止できる" },
      { score: 3, description: "中程度のリスクを軽減できる" },
      { score: 1, description: "リスク軽減効果は限定的" },
    ],
  },
  efficiencyGain: {
    subtitle: "業務をどれだけ効率化できるか",
    question: "工数削減や処理速度向上にどれだけ貢献するか？",
    levels: [
      { score: 5, description: "工数を50%以上削減、または処理時間を大幅短縮" },
      { score: 3, description: "工数を20〜50%削減" },
      { score: 1, description: "効率化効果は限定的" },
    ],
  },
  employeeSatisfaction: {
    subtitle: "従業員の満足度への貢献",
    question: "従業員の働きやすさにどれだけ貢献するか？",
    levels: [
      { score: 5, description: "煩雑作業の大幅削減、ストレス軽減" },
      { score: 3, description: "一定の改善効果あり" },
      { score: 1, description: "満足度への影響は限定的" },
    ],
  },
  scalability: {
    subtitle: "他部門への展開可能性",
    question: "他部門や他業務にも展開できるか？",
    levels: [
      { score: 5, description: "全社展開可能、汎用性が高い" },
      { score: 3, description: "一部の部門で横展開可能" },
      { score: 1, description: "特定業務に限定される" },
    ],
  },
};

// 人材ファインダー用
const talentDescriptions: Record<string, ScoreDescription> = {
  skillMatch: {
    subtitle: "必要スキルとの適合度",
    question: "求めるスキルセットとどれだけマッチしているか？",
    levels: [
      { score: 5, description: "必須スキルを全て保有し、追加スキルもある" },
      { score: 3, description: "必須スキルの大半を保有" },
      { score: 1, description: "スキルギャップが大きい" },
    ],
  },
  growthPotential: {
    subtitle: "成長の伸びしろ",
    question: "育成によってどれだけ成長が期待できるか？",
    levels: [
      { score: 5, description: "高い学習意欲と吸収力、急成長が期待できる" },
      { score: 3, description: "一定の成長が期待できる" },
      { score: 1, description: "成長余地が限定的" },
    ],
  },
  cultureFit: {
    subtitle: "企業文化との相性",
    question: "組織文化や価値観とどれだけ合うか？",
    levels: [
      { score: 5, description: "価値観が一致し、チームに良い影響を与える" },
      { score: 3, description: "大きな問題はなく適応できる" },
      { score: 1, description: "文化的な不一致が懸念される" },
    ],
  },
  futureValue: {
    subtitle: "中長期的な価値",
    question: "将来的にどれだけの価値を創出できるか？",
    levels: [
      { score: 5, description: "将来のリーダー候補、組織を牽引できる" },
      { score: 3, description: "安定した貢献が期待できる" },
      { score: 1, description: "短期的な貢献に留まる可能性" },
    ],
  },
  immediateImpact: {
    subtitle: "入社後すぐに貢献できるか",
    question: "即戦力としてどれだけ期待できるか？",
    levels: [
      { score: 5, description: "入社初月から成果を出せる" },
      { score: 3, description: "3〜6ヶ月で戦力化" },
      { score: 1, description: "戦力化まで1年以上必要" },
    ],
  },
  costEfficiency: {
    subtitle: "採用・育成コスト対効果",
    question: "採用コストに対してどれだけのリターンが期待できるか？",
    levels: [
      { score: 5, description: "コスト対効果が非常に高い" },
      { score: 3, description: "標準的なコスト対効果" },
      { score: 1, description: "コストに見合う効果が不透明" },
    ],
  },
};

// ファインダーIDから詳細説明を取得
function getScoreDescriptions(finderId: string | null): Record<string, ScoreDescription> {
  switch (finderId) {
    case "defensive-dx":
      return defensiveDxDescriptions;
    case "talent":
      return talentDescriptions;
    default:
      return winningStrategyDescriptions;
  }
}

export function ScoreSettingsTab() {
  const { weights, setWeights, adjustWeight, finderId } = useApp();
  const [expandedAxis, setExpandedAxis] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedWeights, setSavedWeights] = useState<Record<string, number> | null>(null);

  // ファインダー設定を取得
  const finderSettings = useMemo(() => getFinderSettings(finderId), [finderId]);
  const defaultWeights = useMemo(() => getDefaultWeights(finderId), [finderId]);
  const scoreDescriptions = useMemo(() => getScoreDescriptions(finderId), [finderId]);
  const scoreLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    finderSettings.scoreConfig.forEach((config) => {
      labels[config.key] = config.label;
    });
    return labels;
  }, [finderSettings]);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  // 保存済み設定を読み込む
  const loadSavedConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/score-config${finderId ? `?finderId=${finderId}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.isDefault && data.weights) {
          setWeights(data.weights);
          setSavedWeights(data.weights);
          setIsDefault(false);
        } else {
          setWeights(defaultWeights);
          setSavedWeights(defaultWeights);
          setIsDefault(true);
        }
      } else {
        setWeights(defaultWeights);
        setSavedWeights(defaultWeights);
        setIsDefault(true);
      }
    } catch (error) {
      console.error("Failed to load score config:", error);
      setWeights(defaultWeights);
      setSavedWeights(defaultWeights);
      setIsDefault(true);
    } finally {
      setIsLoading(false);
    }
  }, [setWeights, defaultWeights, finderId]);

  // 初回読み込み
  useEffect(() => {
    loadSavedConfig();
  }, [loadSavedConfig]);

  // 変更検知
  useEffect(() => {
    if (savedWeights) {
      const hasChanges = Object.keys(weights).some(
        (key) => weights[key as keyof typeof weights] !== savedWeights[key as keyof typeof savedWeights]
      );
      setHasUnsavedChanges(hasChanges);
    }
  }, [weights, savedWeights]);

  // 設定を保存
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    const isDefaultValues = Object.keys(defaultWeights).every(
      (key) => weights[key as keyof typeof weights] === defaultWeights[key as keyof typeof defaultWeights]
    );

    try {
      if (isDefaultValues) {
        await fetch(`/api/score-config${finderId ? `?finderId=${finderId}` : ""}`, { method: "DELETE" });
        setSaveStatus({ type: "success", message: "デフォルト設定で保存しました" });
        setSavedWeights({ ...defaultWeights });
        setIsDefault(true);
      } else {
        const res = await fetch("/api/score-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...weights, finderId }),
        });

        if (res.ok) {
          setSaveStatus({ type: "success", message: "保存しました" });
          setSavedWeights({ ...weights });
          setIsDefault(false);
        } else {
          const data = await res.json();
          setSaveStatus({ type: "error", message: data.error || "保存に失敗しました" });
          return;
        }
      }
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error("Save error:", error);
      setSaveStatus({ type: "error", message: "保存に失敗しました" });
    } finally {
      setIsSaving(false);
    }
  };

  // デフォルトに戻す
  const handleResetToDefault = () => {
    setWeights(defaultWeights);
    setSaveStatus({ type: "success", message: "デフォルト値に設定しました。保存ボタンで確定してください。" });
    setTimeout(() => setSaveStatus(null), 5000);
  };

  // 正規化後の比率を計算
  const getNormalizedPercentage = (value: number) => {
    if (totalWeight === 0) return 0;
    return Math.round((value / totalWeight) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 dark:text-slate-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 py-3" style={{ height: 'calc(100vh - 130px)', maxHeight: 'calc(100vh - 130px)' }}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            スコア設定{" "}
            <span className={`text-sm font-normal ${totalWeight === 100 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
              (設定値合計: {totalWeight})
            </span>
            {!isDefault && (
              <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">
                (カスタム設定)
              </span>
            )}
            {hasUnsavedChanges && (
              <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                (未保存の変更あり)
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {finderSettings.resultLabel}の評価軸の重みを設定。設定値は<strong>比率</strong>として計算時に正規化されます。
          </p>
        </div>
      </div>

      {/* 案内メッセージ */}
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 flex-shrink-0">
        デフォルト設定のまま進めて問題ありません。自社の評価基準に合わせたい場合のみ調整してください。
      </p>

      {/* 2カラムレイアウト */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden">
        {/* 左カラム: スライダー */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 overflow-y-auto h-full">
          <div className="flex items-center justify-between mb-3 sticky top-0 bg-white dark:bg-slate-800 pb-2 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              重み設定
            </h2>
            <div className="flex items-center gap-2">
              {saveStatus && (
                <span className={`text-xs ${saveStatus.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {saveStatus.message}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToDefault}
                className="text-xs h-7 px-2"
              >
                デフォルトに戻す
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3"
              >
                {isSaving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {finderSettings.scoreConfig.map((config) => {
              const desc = scoreDescriptions[config.key];
              const isExpanded = expandedAxis === config.key;
              const value = weights[config.key] ?? config.defaultWeight;
              const normalizedPct = getNormalizedPercentage(value);

              return (
                <div key={config.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {config.label}
                        </span>
                        {desc && (
                          <button
                            onClick={() => setExpandedAxis(isExpanded ? null : config.key)}
                            className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="詳細を表示"
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        )}
                      </div>
                      {desc && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {desc.subtitle}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {value}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
                        → {normalizedPct}%
                      </span>
                    </div>
                  </div>

                  {/* 詳細説明（展開時） */}
                  {isExpanded && desc && (
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
                    value={value}
                    onChange={(e) => adjustWeight(config.key as keyof typeof weights, parseInt(e.target.value))}
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
              {finderSettings.scoreConfig.map((config) => (
                <div
                  key={config.key}
                  className="flex justify-between p-1.5 bg-slate-50 dark:bg-slate-700 rounded"
                >
                  <span className="text-slate-600 dark:text-slate-400">{config.label}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {config.defaultWeight}%
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
              本スコア設定では、{finderSettings.resultLabel}の初期評価に必要な観点を整理した結果、{finderSettings.scoreConfig.length}つの指標を設定しています。
              これらは、{finderSettings.name}の目的に沿って、過不足なく{finderSettings.resultLabel}を整理することを目的としています。
            </p>
          </div>

          {/* スコア計算ロジックの説明 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-3 flex-1">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
              スコア計算の仕組み
            </h3>
            <div className="space-y-2 text-xs text-blue-900 dark:text-blue-100">
              <p className="text-blue-700 dark:text-blue-300">
                AIが各{finderSettings.resultLabel}を{finderSettings.scoreConfig.length}軸で <strong>1〜5点</strong> で評価し、重み（比率）を掛けて合計します。
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
