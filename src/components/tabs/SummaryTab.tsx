"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";

export function SummaryTab() {
  const {
    summaryStatus,
    summaryProgress,
    summaryResult,
    summaryError,
    startSummary,
    cancelSummary,
    clearSummaryResult,
  } = useApp();

  const [loading, setLoading] = useState(true);
  const [currentStats, setCurrentStats] = useState<{
    explorationCount: number;
    topStrategiesCount: number;
  } | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  // まとめ完了時にデータを再取得
  useEffect(() => {
    if (summaryStatus === "completed") {
      fetchCurrentStats();
    }
  }, [summaryStatus]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/summary");
      const data = await res.json();
      setCurrentStats(data.currentStats || null);
    } catch (err) {
      console.error("Failed to fetch summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentStats = async () => {
    try {
      const res = await fetch("/api/summary");
      const data = await res.json();
      setCurrentStats(data.currentStats || null);
    } catch (err) {
      console.error("Failed to fetch current stats:", err);
    }
  };

  const handleGenerate = async () => {
    await startSummary();
  };

  const handleExportPDF = () => {
    if (!summaryResult) return;

    // 新しいウィンドウを開いて印刷用HTMLを生成
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("ポップアップがブロックされました。許可してください。");
      return;
    }

    const content = summaryResult.content;
    const date = new Date(summaryResult.createdAt).toLocaleString("ja-JP");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>探索まとめ</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
          h1 { font-size: 24px; margin-bottom: 8px; color: #0f172a; }
          h2 { font-size: 18px; margin: 24px 0 12px; color: #334155; border-bottom: 2px solid #10b981; padding-bottom: 4px; }
          h3 { font-size: 14px; margin: 16px 0 8px; color: #475569; }
          p { margin: 8px 0; font-size: 14px; }
          .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
          .executive-summary { background: #ecfdf5; border: 2px solid #10b981; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .executive-summary p { font-size: 15px; }
          .section { margin: 20px 0; }
          ul, ol { margin: 8px 0 8px 24px; }
          li { margin: 4px 0; font-size: 14px; }
          .recommendation { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin: 8px 0; }
          .recommendation .title { font-weight: bold; }
          .priority-high { color: #dc2626; }
          .priority-medium { color: #d97706; }
          .priority-low { color: #16a34a; }
          .patterns { display: flex; gap: 16px; flex-wrap: wrap; }
          .pattern-box { flex: 1; min-width: 200px; padding: 12px; border-radius: 6px; }
          .pattern-strengths { background: #dcfce7; border: 1px solid #86efac; }
          .pattern-opportunities { background: #dbeafe; border: 1px solid #93c5fd; }
          .pattern-risks { background: #fef3c7; border: 1px solid #fcd34d; }
          .next-steps { background: #f3e8ff; border: 1px solid #c4b5fd; border-radius: 6px; padding: 16px; }
          .stats { font-size: 12px; color: #64748b; background: #f8fafc; padding: 12px; border-radius: 6px; margin-top: 24px; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>探索まとめレポート</h1>
        <p class="meta">生成日時: ${date}</p>

        <div class="executive-summary">
          <h2 style="margin-top: 0;">エグゼクティブサマリー</h2>
          <p>${content.executiveSummary || ""}</p>
        </div>

        ${content.keyFindings && content.keyFindings.length > 0 ? `
        <div class="section">
          <h2>主要な発見</h2>
          <ol>
            ${content.keyFindings.map((f: string) => `<li>${f}</li>`).join("")}
          </ol>
        </div>
        ` : ""}

        ${content.topRecommendations && content.topRecommendations.length > 0 ? `
        <div class="section">
          <h2>推奨事項</h2>
          ${content.topRecommendations.map((r: { title: string; description: string; priority: string }) => `
            <div class="recommendation">
              <span class="priority-${r.priority}">[優先度: ${r.priority === "high" ? "高" : r.priority === "medium" ? "中" : "低"}]</span>
              <span class="title">${r.title}</span>
              <p>${r.description}</p>
            </div>
          `).join("")}
        </div>
        ` : ""}

        ${content.patterns ? `
        <div class="section">
          <h2>パターン分析</h2>
          <div class="patterns">
            ${content.patterns.strengths && content.patterns.strengths.length > 0 ? `
            <div class="pattern-box pattern-strengths">
              <h3>強み</h3>
              <ul>${content.patterns.strengths.map((s: string) => `<li>${s}</li>`).join("")}</ul>
            </div>
            ` : ""}
            ${content.patterns.opportunities && content.patterns.opportunities.length > 0 ? `
            <div class="pattern-box pattern-opportunities">
              <h3>機会</h3>
              <ul>${content.patterns.opportunities.map((o: string) => `<li>${o}</li>`).join("")}</ul>
            </div>
            ` : ""}
            ${content.patterns.risks && content.patterns.risks.length > 0 ? `
            <div class="pattern-box pattern-risks">
              <h3>リスク</h3>
              <ul>${content.patterns.risks.map((r: string) => `<li>${r}</li>`).join("")}</ul>
            </div>
            ` : ""}
          </div>
        </div>
        ` : ""}

        ${content.nextSteps && content.nextSteps.length > 0 ? `
        <div class="section next-steps">
          <h2 style="margin-top: 0; color: #7c3aed;">次に取るべきアクション</h2>
          <ol>
            ${content.nextSteps.map((s: string) => `<li>${s}</li>`).join("")}
          </ol>
        </div>
        ` : ""}

        ${summaryResult.stats ? `
        <div class="stats">
          <strong>分析対象:</strong>
          探索${summaryResult.stats.explorationCount}件、
          トップ戦略${summaryResult.stats.topStrategiesCount}件、
          採用${summaryResult.stats.adoptedCount}件、
          却下${summaryResult.stats.rejectedCount}件
        </div>
        ` : ""}

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const priorityColors = {
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  };

  const priorityLabels = {
    high: "高",
    medium: "中",
    low: "低",
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          読み込み中...
        </div>
      </div>
    );
  }

  const isRunning = summaryStatus === "running";

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        まとめ
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        あなたの探索データをAIが分析し、包括的なまとめを生成します。
      </p>

      {/* 統計情報 */}
      {currentStats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {currentStats.explorationCount}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">探索件数</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {currentStats.topStrategiesCount}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              トップ戦略数
            </p>
          </div>
        </div>
      )}

      {/* 生成ボタン */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              AIまとめを生成
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {currentStats && currentStats.explorationCount === 0
                ? "まず「勝ち筋探索」でデータを蓄積してください"
                : "探索履歴・トップ戦略・採否判断を分析します"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGenerate}
              disabled={isRunning || (currentStats?.explorationCount === 0)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isRunning ? "生成中..." : summaryResult ? "再生成" : "まとめを生成"}
            </Button>
            {isRunning && (
              <Button
                onClick={cancelSummary}
                variant="outline"
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600"
              >
                キャンセル
              </Button>
            )}
            {summaryResult && (
              <Button
                onClick={handleExportPDF}
                variant="outline"
                className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                PDF保存
              </Button>
            )}
          </div>
        </div>

        {/* プログレスバー */}
        {isRunning && (
          <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full"></div>
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  まとめを生成中です...
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  バックグラウンドで処理中です。ブラウザを閉じても処理は継続されます。
                </p>
              </div>
            </div>
            <div className="w-full bg-emerald-200 dark:bg-emerald-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-600 dark:bg-emerald-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, summaryProgress)}%` }}
              />
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 text-right">
              {Math.round(summaryProgress)}%
            </p>
          </div>
        )}

        {/* エラー表示 */}
        {summaryStatus === "failed" && summaryError && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
              まとめの生成に失敗しました
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">{summaryError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={clearSummaryResult}
            >
              閉じる
            </Button>
          </div>
        )}
      </div>

      {/* まとめ表示 */}
      {summaryResult && (
        <div className="space-y-6">
          {/* 最終生成日時 */}
          <p className="text-xs text-slate-500 dark:text-slate-400 text-right">
            生成日時: {new Date(summaryResult.createdAt).toLocaleString("ja-JP")}
          </p>

          {/* エグゼクティブサマリー */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 p-6">
            <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mb-3">
              エグゼクティブサマリー
            </h3>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {summaryResult.content.executiveSummary}
            </p>
          </div>

          {/* 主要な発見 */}
          {summaryResult.content.keyFindings && summaryResult.content.keyFindings.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                主要な発見
              </h3>
              <ul className="space-y-2">
                {summaryResult.content.keyFindings.map((finding, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-slate-700 dark:text-slate-300"
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-medium">
                      {i + 1}
                    </span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 推奨事項 */}
          {summaryResult.content.topRecommendations &&
            summaryResult.content.topRecommendations.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                  推奨事項
                </h3>
                <div className="space-y-3">
                  {summaryResult.content.topRecommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            priorityColors[rec.priority]
                          }`}
                        >
                          優先度: {priorityLabels[rec.priority]}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {rec.title}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {rec.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* パターン分析 */}
          {summaryResult.content.patterns && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 強み */}
              {summaryResult.content.patterns.strengths &&
                summaryResult.content.patterns.strengths.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-4">
                    <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">
                      強みパターン
                    </h4>
                    <ul className="space-y-1">
                      {summaryResult.content.patterns.strengths.map((s, i) => (
                        <li
                          key={i}
                          className="text-sm text-green-700 dark:text-green-300"
                        >
                          • {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* 機会 */}
              {summaryResult.content.patterns.opportunities &&
                summaryResult.content.patterns.opportunities.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">
                      機会パターン
                    </h4>
                    <ul className="space-y-1">
                      {summaryResult.content.patterns.opportunities.map((o, i) => (
                        <li
                          key={i}
                          className="text-sm text-blue-700 dark:text-blue-300"
                        >
                          • {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* リスク */}
              {summaryResult.content.patterns.risks &&
                summaryResult.content.patterns.risks.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-3">
                      リスクパターン
                    </h4>
                    <ul className="space-y-1">
                      {summaryResult.content.patterns.risks.map((r, i) => (
                        <li
                          key={i}
                          className="text-sm text-amber-700 dark:text-amber-300"
                        >
                          • {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}

          {/* 次のステップ */}
          {summaryResult.content.nextSteps && summaryResult.content.nextSteps.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-6">
              <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200 mb-4">
                次に取るべきアクション
              </h3>
              <ol className="space-y-2">
                {summaryResult.content.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 flex items-center justify-center text-sm font-medium">
                      {i + 1}
                    </span>
                    <span className="text-purple-700 dark:text-purple-300">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 統計情報 */}
          {summaryResult.stats && (
            <div className="text-xs text-slate-500 dark:text-slate-400 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="font-medium">分析対象:</span> 探索{summaryResult.stats.explorationCount}件、
              トップ戦略{summaryResult.stats.topStrategiesCount}件、
              採用{summaryResult.stats.adoptedCount}件、
              却下{summaryResult.stats.rejectedCount}件
            </div>
          )}
        </div>
      )}

      {/* まとめがない場合 */}
      {!summaryResult && !isRunning && (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 mb-2">
            まとめがまだ生成されていません
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            上の「まとめを生成」ボタンをクリックしてください
          </p>
        </div>
      )}
    </div>
  );
}
