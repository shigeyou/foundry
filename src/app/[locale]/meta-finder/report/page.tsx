"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { HomeButton } from "@/components/ui/home-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { departments } from "@/lib/meta-finder-prompt";
import type { ReportSections, ReportIssueItem, ReportSolutionItem, ReportStrategyItem } from "@/lib/meta-finder-report-types";
import { useReportAudio } from "@/hooks/useReportAudio";

interface ReportRecord {
  id: string;
  batchId: string;
  scope: string;
  scopeName: string;
  sections: string;
  status: string;
  error?: string;
  createdAt: string;
}

interface BatchInfo {
  id: string;
  status: string;
  totalPatterns: number;
  completedPatterns: number;
  totalIdeas: number;
  startedAt: string;
  completedAt?: string;
}

const severityConfig = {
  high: { labelKey: "high", bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", border: "border-red-400" },
  medium: { labelKey: "medium", bg: "bg-yellow-100 dark:bg-yellow-900/40", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-400" },
  low: { labelKey: "low", bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", border: "border-green-400" },
};

const priorityConfig = {
  immediate: { labelKey: "immediate", bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300" },
  "short-term": { labelKey: "shortTerm", bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  "mid-term": { labelKey: "midTerm", bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300" },
};

function scoreColor(score: number): string {
  if (score >= 4) return "text-green-600 dark:text-green-400";
  if (score >= 3) return "text-blue-600 dark:text-blue-400";
  if (score >= 2) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 4) return "bg-green-500";
  if (score >= 3) return "bg-blue-500";
  if (score >= 2) return "bg-yellow-500";
  return "bg-red-500";
}

export default function ReportPage() {
  const t = useTranslations("metaFinderReport");
  const tc = useTranslations("common");
  const searchParams = useSearchParams();
  const router = useRouter();
  const batchId = searchParams.get("batchId");

  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [activeScope, setActiveScope] = useState("all");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  // 音声ハイライト用セクションRef
  const sectionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const setSectionRef = useCallback((section: string, el: HTMLDivElement | null) => {
    if (el) {
      sectionRefs.current.set(section, el);
    }
  }, []);

  // バッチ一覧（batchId未指定時用）
  const [allBatches, setAllBatches] = useState<BatchInfo[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // batchId未指定時: バッチ一覧を取得
  useEffect(() => {
    if (batchId) return;
    setLoadingBatches(true);
    fetch("/api/meta-finder/batch")
      .then(res => res.json())
      .then(data => {
        const completed = (data.batches || []).filter((b: BatchInfo) => b.status === "completed");
        setAllBatches(completed);
      })
      .catch(() => setError(t("fetchFailed")))
      .finally(() => {
        setLoadingBatches(false);
        setLoading(false);
      });
  }, [batchId]);

  const fetchReports = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await fetch(`/api/meta-finder/report?batchId=${batchId}`);
      const data = await res.json();
      setBatch(data.batch);
      setReports(data.reports || []);

      // 生成中かチェック
      const hasGenerating = (data.reports || []).some(
        (r: ReportRecord) => r.status === "pending" || r.status === "generating"
      );
      if (hasGenerating) {
        setGenerating(true);
      } else {
        setGenerating(false);
      }
    } catch {
      setError(t("reportFetchFailed"));
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (batchId) fetchReports();
  }, [batchId, fetchReports]);

  // 生成中はポーリング
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(fetchReports, 3000);
    return () => clearInterval(interval);
  }, [generating, fetchReports]);

  const startGeneration = async (targetBatchId?: string) => {
    // onClickからイベントオブジェクトが渡される場合を除外
    const id = (typeof targetBatchId === "string") ? targetBatchId : batchId;
    if (!id) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/meta-finder/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: id }),
      });
      if (!res.ok) throw new Error(t("generationStartFailed"));
      // batchId未指定時は選択したバッチのページに遷移
      if (!batchId) {
        router.push(`/meta-finder/report?batchId=${id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
      setGenerating(false);
    }
  };

  const handlePdfExport = async () => {
    if (!printRef.current) return;
    try {
      const { exportReportPdf } = await import("@/lib/export-pdf");
      await exportReportPdf("report-print-area");
    } catch (err) {
      console.error("[PDF] Export failed:", err);
    }
  };

  const handleExecutiveSummaryPdf = async () => {
    try {
      const { exportExecutiveSummaryPdf } = await import("@/lib/export-pdf");
      const deptData = departments.map(dept => {
        const report = reports.find(r => r.scope === dept.id);
        let parsed: ReportSections | null = null;
        if (report?.status === "completed" && report.sections) {
          try { parsed = JSON.parse(report.sections); } catch { /* skip */ }
        }
        return {
          name: report?.scopeName || dept.label,
          executiveSummary: parsed?.executiveSummary || "",
          topStrategies: (parsed?.strategies?.items || []).map(s => ({
            name: s.name,
            score: s.bscScores
              ? (s.bscScores.financial + s.bscScores.customer + s.bscScores.process + s.bscScores.growth) / 4
              : 0,
          })),
          issueCount: parsed?.issues?.items?.length || 0,
          solutionCount: parsed?.solutions?.items?.length || 0,
        };
      }).filter(d => d.executiveSummary);

      await exportExecutiveSummaryPdf({
        companyName: "商船三井マリテックス株式会社",
        batchDate: batch ? new Date(batch.startedAt).toLocaleDateString("ja-JP") : "",
        departments: deptData,
      });
    } catch (err) {
      console.error("[PDF] Executive summary export failed:", err);
    }
  };

  // 音声読み上げ
  const audio = useReportAudio();

  // 現在のスコープのレポート
  const activeReport = reports.find(r => r.scope === activeScope);
  let sections: ReportSections | null = null;
  if (activeReport?.status === "completed" && activeReport.sections) {
    try {
      sections = JSON.parse(activeReport.sections);
    } catch { /* ignore */ }
  }

  // 全文読み上げ用セクション構築
  const buildFullSpeechSections = useCallback((s: ReportSections, name: string, scopeId: string) => {
    const prefix = `dept:${scopeId}:`;
    const parts: { section: string; text: string }[] = [];
    parts.push({ section: `${prefix}summary`, text: `${name}のレポートです。${s.executiveSummary}` });
    if (s.issues?.items) {
      parts.push({ section: `${prefix}issues-header`, text: "続いて、課題整理です。" + (s.issues.summary || "") });
      s.issues.items.forEach((item: ReportIssueItem, i: number) => {
        const titleText = item.title ? `${item.title}。` : "";
        parts.push({
          section: `${prefix}issue-${i}`,
          text: `課題${i + 1}。${titleText}カテゴリ：${item.category}。重要度${item.severity === "high" ? "高" : item.severity === "medium" ? "中" : "低"}。${item.challenge}。根拠：${item.evidence}`,
        });
      });
    }
    if (s.solutions?.items) {
      parts.push({ section: `${prefix}solutions-header`, text: "続いて、解決策策定です。" + (s.solutions.summary || "") });
      s.solutions.items.forEach((item: ReportSolutionItem, i: number) => {
        const titleText = item.title ? `${item.title}。` : "";
        const actions = item.actions?.length > 0 ? `具体的アクション：${item.actions.join("、")}。` : "";
        parts.push({
          section: `${prefix}solution-${i}`,
          text: `解決策${i + 1}。${titleText}${item.solution}。対応課題：${item.challenge}。${item.description}。${actions}${item.expectedOutcome ? `期待成果：${item.expectedOutcome}` : ""}`,
        });
      });
    }
    if (s.strategies?.items) {
      parts.push({ section: `${prefix}strategies-header`, text: "続いて、勝ち筋提案です。" + (s.strategies.summary || "") });
      s.strategies.items.forEach((item: ReportStrategyItem, i: number) => {
        const bsc = item.bscScores ? `BSCスコア：財務${item.bscScores.financial}、顧客${item.bscScores.customer}、業務${item.bscScores.process}、成長${item.bscScores.growth}。` : "";
        const actions = item.keyActions?.length > 0 ? `重要アクション：${item.keyActions.join("、")}。` : "";
        parts.push({
          section: `${prefix}strategy-${i}`,
          text: `勝ち筋${i + 1}。${item.name}。${item.description}。${bsc}${item.rationale}。${actions}KPI：${item.kpi || "未設定"}`,
        });
      });
    }
    return parts;
  }, []);

  // 概要読み上げ用セクション構築（カードごとにタイトルだけ読み上げ→ハイライト＆スクロール）
  const buildSummarySpeechSections = useCallback((s: ReportSections, name: string, scopeId: string) => {
    const prefix = `dept:${scopeId}:`;
    const parts: { section: string; text: string }[] = [];
    // エグゼクティブサマリー
    parts.push({ section: `${prefix}summary`, text: `${name}の概要です。${s.executiveSummary}` });
    // 課題：セクション導入→各カードのタイトルを1枚ずつ読み上げ
    if (s.issues?.items) {
      parts.push({ section: `${prefix}issues-header`, text: `課題整理、全${s.issues.items.length}件です。` });
      s.issues.items.forEach((item: ReportIssueItem, i: number) => {
        const sev = item.severity === "high" ? "重要度高" : item.severity === "medium" ? "重要度中" : "重要度低";
        const label = item.title || item.challenge;
        parts.push({
          section: `${prefix}issue-${i}`,
          text: `${sev}。${item.category}。${label}`,
        });
      });
    }
    // 解決策：各カードのタイトルと優先度のみ
    if (s.solutions?.items) {
      parts.push({ section: `${prefix}solutions-header`, text: `解決策策定、全${s.solutions.items.length}件です。` });
      s.solutions.items.forEach((item: ReportSolutionItem, i: number) => {
        const pri = item.priority === "immediate" ? "即時対応" : item.priority === "short-term" ? "短期" : "中期";
        const label = item.title || item.solution;
        parts.push({
          section: `${prefix}solution-${i}`,
          text: `${pri}。${label}`,
        });
      });
    }
    // 勝ち筋：名前とスコアのみ
    if (s.strategies?.items) {
      parts.push({ section: `${prefix}strategies-header`, text: `勝ち筋提案、全${s.strategies.items.length}件です。` });
      s.strategies.items.forEach((item: ReportStrategyItem, i: number) => {
        const avg = item.bscScores ? ((item.bscScores.financial + item.bscScores.customer + item.bscScores.process + item.bscScores.growth) / 4).toFixed(1) : "?";
        parts.push({
          section: `${prefix}strategy-${i}`,
          text: `${item.name}。総合スコア${avg}`,
        });
      });
    }
    return parts;
  }, []);

  // 読み上げ実行（モード指定）
  const handlePlayReport = useCallback((mode: "full" | "summary") => {
    if (reports.length === 0) return;
    const builder = mode === "full" ? buildFullSpeechSections : buildSummarySpeechSections;
    const allSpeechSections: { section: string; text: string }[] = [];
    for (const dept of departments) {
      const report = reports.find(r => r.scope === dept.id);
      if (report?.status !== "completed" || !report.sections) continue;
      try {
        const parsed: ReportSections = JSON.parse(report.sections);
        allSpeechSections.push(...builder(parsed, report.scopeName, dept.id));
      } catch { /* skip */ }
    }
    if (allSpeechSections.length > 0) {
      audio.playSections(allSpeechSections);
    }
  }, [reports, buildFullSpeechSections, buildSummarySpeechSections, audio]);

  // 再生中のセクションから部門IDを抽出してタブを自動切替
  const currentAudioScopeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!audio.currentSection) return;
    const match = audio.currentSection.match(/^dept:([^:]+):/);
    if (match) {
      currentAudioScopeRef.current = match[1];
      if (match[1] !== activeScope) {
        setActiveScope(match[1]);
      }
    }
  }, [audio.currentSection, activeScope]);

  // 自動スクロール（タブ切替によるDOM更新完了後にスクロール）
  useEffect(() => {
    if (!audio.currentSection) return;
    // activeScope変更→ReportContent再レンダリング→ref登録完了を待つ
    const timer = setTimeout(() => {
      const el = sectionRefs.current.get(audio.currentSection!);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [audio.currentSection, activeScope]);

  // カードクリックで読み上げジャンプ（再生中のみ反応）
  const handleSectionClick = useCallback((section: string) => {
    if (audio.isPlaying) {
      audio.playFromSection(section);
    }
  }, [audio]);

  // 生成進捗
  const completedCount = reports.filter(r => r.status === "completed").length;
  const totalCount = departments.length;

  // batchId未指定: バッチ選択画面
  if (!batchId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HomeButton />
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {t("title")}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/meta-finder"
                className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
              >
                {t("back")}
              </a>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">📊</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {t("selectBatch")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("selectBatchDesc")}
            </p>
          </div>

          {loadingBatches ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-500">{tc("loading")}</p>
            </div>
          ) : allBatches.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {t("noBatches")}
              </p>
              <a
                href="/meta-finder"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
              >
                {t("runFullExplore")}
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {allBatches.map((b, index) => {
                const date = new Date(b.startedAt);
                const dateStr = date.toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
                const timeStr = date.toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={b.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {index === 0 ? "最新" : `#${allBatches.length - index}`}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {dateStr} {timeStr}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span>{t("ideasCount", { count: b.totalIdeas })}</span>
                          <span>{t("patterns", { count: b.totalPatterns })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/meta-finder/report?batchId=${b.id}`}
                          className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg transition-colors"
                        >
                          {t("view")}
                        </a>
                        <button
                          onClick={() => startGeneration(b.id)}
                          disabled={generating}
                          className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                        >
                          {t("generateReport")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ヘッダー */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/meta-finder"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm font-medium"
            >
              ← {tc("backToMetaFinder")}
            </a>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {t("title")}
              </h1>
              {batch && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("ideasCount", { count: batch.totalIdeas })} | {t("patterns", { count: batch.totalPatterns })} |{" "}
                  {new Date(batch.startedAt).toLocaleDateString("ja-JP")}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reports.some(r => r.status === "completed") && (
              <>
                <button
                  onClick={() => handlePlayReport("summary")}
                  disabled={audio.isPlaying}
                  className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <span>🔊</span>
                  <span>{t("summaryReadAloud")}</span>
                </button>
                <button
                  onClick={() => handlePlayReport("full")}
                  disabled={audio.isPlaying}
                  className="px-3 py-1.5 text-xs bg-amber-700 hover:bg-amber-600 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <span>🔊</span>
                  <span>{t("fullReadAloud")}</span>
                </button>
                <button
                  onClick={handleExecutiveSummaryPdf}
                  className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                >
                  {t("summaryPdf")}
                </button>
                <button
                  onClick={handlePdfExport}
                  className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  {t("pdfExport")}
                </button>
              </>
            )}
            <a
              href="/meta-finder/report"
              className="px-3 py-1.5 text-xs bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-lg transition-colors"
            >
              {t("batchSelect")}
            </a>
            <a
              href="/meta-finder"
              className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              {t("back")}
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* 部門タブ */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-[57px] z-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-1 py-2 scrollbar-thin">
            {departments.map(dept => {
              const report = reports.find(r => r.scope === dept.id);
              const isActive = activeScope === dept.id;
              const isCompleted = report?.status === "completed";
              const isFailed = report?.status === "failed";
              const isGen = report?.status === "generating" || report?.status === "pending";

              return (
                <button
                  key={dept.id}
                  onClick={() => setActiveScope(dept.id)}
                  className={`whitespace-nowrap px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {isGen && <span className="animate-pulse">●</span>}
                  {isFailed && <span className="text-red-400">!</span>}
                  {isCompleted && <span className={isActive ? "text-white" : "text-green-500"}>✓</span>}
                  {dept.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 音声コントロールバー */}
      {(audio.isPlaying || audio.audioError) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 sticky top-[102px] z-10">
          <div className="max-w-5xl mx-auto px-4 py-2">
            <div className="flex items-center gap-4 flex-wrap">
              {/* 一時停止/再開 + 停止 */}
              {audio.isPlaying && (
                <div className="flex items-center gap-2">
                  {/* 再生ボタン */}
                  <button
                    onClick={audio.togglePlayPause}
                    disabled={!audio.isPaused}
                    className={`p-1.5 rounded-lg transition-colors ${audio.isPaused ? "bg-green-600 hover:bg-green-500 text-white" : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"}`}
                    title={t("play")}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                  {/* 一時停止ボタン */}
                  <button
                    onClick={audio.togglePlayPause}
                    disabled={audio.isPaused}
                    className={`p-1.5 rounded-lg transition-colors ${!audio.isPaused ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"}`}
                    title={t("pause")}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                  </button>
                  {/* 停止ボタン */}
                  <button
                    onClick={audio.stopSpeech}
                    className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                    title={t("stop")}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                  </button>
                  <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300 text-xs">
                    <div className="flex gap-0.5">
                      <span className="w-0.5 h-2 bg-amber-500 rounded animate-pulse"></span>
                      <span className="w-0.5 h-3 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.1s" }}></span>
                      <span className="w-0.5 h-1.5 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.2s" }}></span>
                      <span className="w-0.5 h-3.5 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.3s" }}></span>
                    </div>
                    <span>{audio.isPaused ? t("paused") : t("playing")}{(() => {
                      const m = audio.currentSection?.match(/^dept:([^:]+):/);
                      if (!m) return null;
                      const dept = departments.find(d => d.id === m[1]);
                      return dept ? ` — ${dept.label}` : null;
                    })()}</span>
                  </div>
                </div>
              )}

              {/* 速度スライダー */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-gray-500 dark:text-gray-400 text-xs">{t("speed")}</span>
                <button
                  onClick={() => audio.setSpeechSpeed((prev: number) => Math.max(50, prev - 10))}
                  className="w-5 h-5 flex items-center justify-center border border-amber-500 text-amber-600 dark:text-amber-400 rounded text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30"
                >
                  −
                </button>
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                  value={audio.speechSpeed}
                  onChange={(e) => audio.setSpeechSpeed(Number(e.target.value))}
                  className="w-20 h-1 cursor-pointer accent-amber-500"
                />
                <button
                  onClick={() => audio.setSpeechSpeed((prev: number) => Math.min(200, prev + 10))}
                  className="w-5 h-5 flex items-center justify-center border border-amber-500 text-amber-600 dark:text-amber-400 rounded text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30"
                >
                  +
                </button>
                <span className="text-amber-700 dark:text-amber-300 text-xs font-medium w-8">{audio.speechSpeed}%</span>
              </div>

              {/* キュー状態 */}
              {audio.queueStatus.total > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    <span className="text-green-600 dark:text-green-400">{audio.queueStatus.ready}</span>
                  </div>
                  {audio.queueStatus.generating > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                      <span className="text-amber-600 dark:text-amber-400">{audio.queueStatus.generating}</span>
                    </div>
                  )}
                  <span className="text-gray-400">/ {audio.queueStatus.total}</span>
                </div>
              )}
            </div>

            {/* エラー */}
            {audio.audioError && (
              <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-xs">
                ⚠ {audio.audioError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="max-w-5xl mx-auto px-4 py-6" style={{ fontSize: "120%" }}>
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500">{tc("loading")}</p>
          </div>
        ) : reports.length === 0 ? (
          /* レポート未生成 */
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {t("generatePrompt")}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {t("generateDesc", { count: batch?.totalIdeas || 0 })}
            </p>
            <button
              onClick={() => startGeneration()}
              disabled={generating}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-xl font-bold transition-colors"
            >
              {generating ? t("generating") : t("generateReportStart")}
            </button>
          </div>
        ) : generating ? (
          /* 生成中プログレス */
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {t("generating")}
            </h2>
            <p className="text-gray-500 mb-4">
              {t("scopeCompleted", { completed: completedCount, total: totalCount })}
            </p>
            <div className="w-64 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
            {/* 完了済みタブは閲覧可能 */}
            {sections && (
              <div className="mt-8">
                <ReportContent sections={sections} scopeName={activeReport?.scopeName || ""} scopeId={activeScope} currentSection={audio.currentSection} setSectionRef={setSectionRef} onSectionClick={audio.isPlaying ? handleSectionClick : undefined} t={t} />
              </div>
            )}
          </div>
        ) : activeReport?.status === "failed" ? (
          /* 生成失敗 */
          <div className="text-center py-20">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-red-600 mb-2">{t("generationFailed")}</h2>
            <p className="text-gray-500 mb-4">{activeReport.error}</p>
            <button
              onClick={() => startGeneration()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
            >
              {t("regenerate")}
            </button>
          </div>
        ) : sections ? (
          /* レポート表示 */
          <div id="report-print-area" ref={printRef}>
            <ReportContent sections={sections} scopeName={activeReport?.scopeName || ""} scopeId={activeScope} currentSection={audio.currentSection} setSectionRef={setSectionRef} t={t} />
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            {t("scopeNotGenerated")}
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

// ハイライトスタイル
function highlightClass(currentSection: string | null, section: string): string {
  if (currentSection === section) {
    return "ring-2 ring-amber-400 bg-amber-50/80 dark:bg-amber-900/30 shadow-lg shadow-amber-500/20 scale-[1.01]";
  }
  return "";
}

// レポート本文コンポーネント（フォント120%拡大＋ハイライト対応＋クリックジャンプ）
function ReportContent({ sections, scopeName, scopeId, currentSection, setSectionRef, onSectionClick, t }: {
  sections: ReportSections;
  scopeName: string;
  scopeId: string;
  currentSection: string | null;
  setSectionRef: (section: string, el: HTMLDivElement | null) => void;
  onSectionClick?: (section: string) => void;
  t: (key: string) => string;
}) {
  const prefix = `dept:${scopeId}:`;
  const hl = (key: string) => highlightClass(currentSection, `${prefix}${key}`);
  const ref = (key: string) => (el: HTMLDivElement | null) => setSectionRef(`${prefix}${key}`, el);
  const click = (key: string) => onSectionClick ? () => onSectionClick(`${prefix}${key}`) : undefined;

  return (
    <div className="space-y-8" style={{ fontSize: "19.2px" }}>
      {/* エグゼクティブサマリー */}
      <section
        ref={ref("summary")}
        onClick={click("summary")}
        className={`bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-indigo-200 dark:border-indigo-800 transition-all duration-300 ${onSectionClick ? "cursor-pointer" : ""} ${hl("summary")}`}
      >
        <h2 className="font-bold text-indigo-900 dark:text-indigo-200 mb-3 flex items-center gap-2" style={{ fontSize: "1.4em" }}>
          <span style={{ fontSize: "1.3em" }}>📋</span>
          {t("executiveSummary")} — {scopeName}
        </h2>
        <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
          {sections.executiveSummary}
        </p>
      </section>

      {/* 1. 課題整理 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-8 bg-red-500 rounded-full" />
          <h2 className="font-bold text-gray-900 dark:text-white" style={{ fontSize: "1.5em" }}>1. {t("issuesSection")}</h2>
        </div>
        {sections.issues?.summary && (
          <div
            ref={ref("issues-header")}
            onClick={click("issues-header")}
            className={`mb-4 pl-4 border-l-2 border-gray-300 dark:border-gray-600 rounded-r-lg py-2 transition-all duration-300 ${onSectionClick ? "cursor-pointer" : ""} ${hl("issues-header")}`}
          >
            <p className="text-gray-600 dark:text-gray-400">
              {sections.issues.summary}
            </p>
          </div>
        )}
        <div className="space-y-3">
          {sections.issues?.items?.map((issue: ReportIssueItem, i: number) => {
            const sev = severityConfig[issue.severity] || severityConfig.medium;
            const key = `issue-${i}`;
            return (
              <div
                key={i}
                ref={ref(key)}
                onClick={click(key)}
                className={`rounded-xl border-l-4 ${sev.border} bg-white dark:bg-gray-800 p-4 shadow-sm transition-all duration-300 ${onSectionClick ? "cursor-pointer" : ""} ${hl(key)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-bold ${sev.bg} ${sev.text}`} style={{ fontSize: "0.85em" }}>
                      {t(sev.labelKey)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded" style={{ fontSize: "0.85em" }}>
                      {issue.category}
                    </span>
                  </div>
                </div>
                {issue.title && (
                  <h3 className="font-bold text-gray-900 dark:text-white mb-1" style={{ fontSize: "1.05em" }}>
                    {issue.title}
                  </h3>
                )}
                <p className="text-gray-800 dark:text-gray-200 mb-2">{issue.challenge}</p>
                <p className="text-gray-500 dark:text-gray-400" style={{ fontSize: "0.9em" }}>
                  <span className="font-semibold">{t("evidence")}:</span> {issue.evidence}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. 解決策策定 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-8 bg-blue-500 rounded-full" />
          <h2 className="font-bold text-gray-900 dark:text-white" style={{ fontSize: "1.5em" }}>2. {t("solutionsSection")}</h2>
        </div>
        {sections.solutions?.summary && (
          <div
            ref={ref("solutions-header")}
            onClick={click("solutions-header")}
            className={`mb-4 pl-4 border-l-2 border-gray-300 dark:border-gray-600 rounded-r-lg py-2 transition-all duration-300 ${onSectionClick ? "cursor-pointer" : ""} ${hl("solutions-header")}`}
          >
            <p className="text-gray-600 dark:text-gray-400">
              {sections.solutions.summary}
            </p>
          </div>
        )}
        <div className="space-y-3">
          {sections.solutions?.items?.map((sol: ReportSolutionItem, i: number) => {
            const pri = priorityConfig[sol.priority] || priorityConfig["mid-term"];
            const key = `solution-${i}`;
            return (
              <div
                key={i}
                ref={ref(key)}
                onClick={click(key)}
                className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-300 ${onSectionClick ? "cursor-pointer" : ""} ${hl(key)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white" style={{ fontSize: "1.05em" }}>
                    {i + 1}. {sol.title || sol.solution}
                  </h3>
                  <span className={`px-2 py-0.5 rounded font-bold ${pri.bg} ${pri.text}`} style={{ fontSize: "0.85em" }}>
                    {t(pri.labelKey)}
                  </span>
                </div>
                {sol.title && (
                  <p className="text-gray-600 dark:text-gray-400 mb-1" style={{ fontSize: "0.9em" }}>
                    {sol.solution}
                  </p>
                )}
                <p className="text-gray-500 dark:text-gray-400 mb-2" style={{ fontSize: "0.9em" }}>
                  {t("correspondingChallenge")}: {sol.challenge}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">{sol.description}</p>
                {sol.actions?.length > 0 && (
                  <div className="mb-2">
                    <p className="font-semibold text-gray-500 dark:text-gray-400 mb-1" style={{ fontSize: "0.9em" }}>{t("specificActions")}:</p>
                    <ul className="space-y-1">
                      {sol.actions.map((action: string, j: number) => (
                        <li key={j} className="flex items-start gap-2 text-gray-700 dark:text-gray-300" style={{ fontSize: "0.9em" }}>
                          <span className="text-blue-500 mt-0.5">▸</span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {sol.expectedOutcome && (
                  <p className="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded" style={{ fontSize: "0.9em" }}>
                    {t("expectedOutcome")}: {sol.expectedOutcome}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. 勝ち筋提案 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-8 bg-purple-500 rounded-full" />
          <h2 className="font-bold text-gray-900 dark:text-white" style={{ fontSize: "1.5em" }}>3. {t("strategiesSection")}</h2>
        </div>
        {sections.strategies?.summary && (
          <div
            ref={ref("strategies-header")}
            onClick={click("strategies-header")}
            className={`mb-4 pl-4 border-l-2 border-gray-300 dark:border-gray-600 rounded-r-lg py-2 transition-all duration-300 ${onSectionClick ? "cursor-pointer" : ""} ${hl("strategies-header")}`}
          >
            <p className="text-gray-600 dark:text-gray-400">
              {sections.strategies.summary}
            </p>
          </div>
        )}
        <div className="space-y-4">
          {sections.strategies?.items?.map((strat: ReportStrategyItem, i: number) => {
            const totalScore = strat.bscScores
              ? ((strat.bscScores.financial + strat.bscScores.customer + strat.bscScores.process + strat.bscScores.growth) / 4)
              : 0;
            const key = `strategy-${i}`;
            return (
              <div
                key={i}
                ref={ref(key)}
                onClick={click(key)}
                className={`bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-300 ${onSectionClick ? "cursor-pointer" : ""} ${hl(key)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-gray-900 dark:text-white" style={{ fontSize: "1.15em" }}>
                    {i + 1}. {strat.name}
                  </h3>
                  <span className={`font-bold ${scoreColor(totalScore)}`} style={{ fontSize: "1.3em" }}>
                    {totalScore.toFixed(1)}
                  </span>
                </div>

                {/* BSCバー */}
                {strat.bscScores && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { key: "financial" as const, label: t("bscFinancial"), icon: "💰" },
                      { key: "customer" as const, label: t("bscCustomer"), icon: "👥" },
                      { key: "process" as const, label: t("bscProcess"), icon: "⚙️" },
                      { key: "growth" as const, label: t("bscGrowth"), icon: "🌱" },
                    ].map(bsc => (
                      <div key={bsc.key} className="text-center">
                        <div className="text-gray-500 dark:text-gray-400 mb-1" style={{ fontSize: "0.85em" }}>
                          {bsc.icon} {bsc.label}
                        </div>
                        <div className="flex justify-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <div
                              key={n}
                              className={`w-4 h-4 rounded-sm ${
                                n <= (strat.bscScores?.[bsc.key] || 0)
                                  ? scoreBg(strat.bscScores?.[bsc.key] || 0)
                                  : "bg-gray-200 dark:bg-gray-700"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-gray-700 dark:text-gray-300 mb-2">{strat.description}</p>
                <p className="text-gray-500 dark:text-gray-400 mb-3" style={{ fontSize: "0.9em" }}>
                  <span className="font-semibold">{t("evidence")}:</span> {strat.rationale}
                </p>

                {strat.keyActions?.length > 0 && (
                  <div className="mb-2">
                    <p className="font-semibold text-gray-500 dark:text-gray-400 mb-1" style={{ fontSize: "0.9em" }}>{t("keyActions")}:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {strat.keyActions.map((action: string, j: number) => (
                        <span key={j} className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded" style={{ fontSize: "0.85em" }}>
                          {action}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {strat.kpi && (
                  <p className="text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded mt-2" style={{ fontSize: "0.9em" }}>
                    {t("kpi")}: {strat.kpi}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
