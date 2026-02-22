"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { exportMetaFinderPdf } from "@/lib/export-pdf";
import { IdeaChatDialog, type IdeaChatTarget } from "@/components/meta-finder/IdeaChatDialog";
import {
  businessThemes,
  departments,
  themeAngles,
  deptContext,
} from "@/lib/meta-finder-prompt";

interface DiscoveredIdea {
  id: string;
  name: string;
  description: string;
  reason: string;
  // BSC 4視点スコア
  financial: number;
  customer: number;
  process: number;
  growth: number;
  // ソース情報（どのセルから生まれたか）
  themeName?: string;
  deptName?: string;
}

interface MetaFinderResult {
  ideas: DiscoveredIdea[];
  thinkingProcess: string;
  summary: string;
}

// バッチ関連のインターフェース
interface BatchInfo {
  id: string;
  status: string;
  totalPatterns: number;
  completedPatterns: number;
  totalIdeas: number;
  currentTheme?: string;
  currentDept?: string;
  startedAt: string;
  completedAt?: string;
  errors?: string;
}

interface BatchIdea {
  id: string;
  themeId: string;
  themeName: string;
  deptId: string;
  deptName: string;
  name: string;
  description: string;
  actions: string | null;
  reason: string;
  // BSC 4視点スコア
  financial: number;
  customer: number;
  process: number;
  growth: number;
  score: number;
}

interface BatchSummary {
  batch: BatchInfo;
  stats: {
    totalIdeas: number;
    avgScore: string;
    // BSC 4視点の平均
    avgFinancial: string;
    avgCustomer: string;
    avgProcess: string;
    avgGrowth: string;
    maxScore: number;
  };
  scoreDistribution: {
    excellent: number;
    good: number;
    average: number;
    low: number;
  };
  topIdeas: BatchIdea[];
  themeBest: BatchIdea[];
  deptBest: BatchIdea[];
}

// カテゴリ定義（大項目）- labels are set dynamically with translations
const themeCategoryDefs = [
  { id: "special", color: "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200" },
  { id: "strategy", color: "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200" },
  { id: "operations", color: "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200" },
  { id: "people", color: "bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200" },
  { id: "governance", color: "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200" },
  { id: "external", color: "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200" },
];

// businessThemes, departments, themeAngles, deptContext は @/lib/meta-finder-prompt から import

// カテゴリごとにテーマをグループ化（ラベルはコンポーネント内でtranslation適用）
const themeCategoryGroups = themeCategoryDefs.map(cat => ({
  ...cat,
  themes: businessThemes.filter(t => t.category === cat.id),
}));



// プロンプト生成関数
function generatePrompt(themeId: string, deptId: string): string {
  const theme = businessThemes.find(t => t.id === themeId);
  const dept = departments.find(d => d.id === deptId);
  if (!theme || !dept) return "";

  const themeAngle = themeAngles[themeId] || "";
  const deptCtx = deptContext[deptId] || "";

  return `## 探索テーマ：${theme.label}
## 対象：${dept.label}

---

### 文脈
${deptCtx}

---

### テーマへのアプローチ
${themeAngle}

---

### 探索の指針

上記の文脈を踏まえ、${dept.label}における「${theme.label}」に関するアイデアを探索してください。

**思考のポイント**
- 表面的な改善にとどまらず、本質的な価値創出を狙う
- 「あったらいいな」ではなく「これがないと困る」を目指す
- 実現可能性を意識しつつも、まずは理想形から発想する
- RAGドキュメントに記載された実態を参照し、地に足のついた提案をする

**アウトプット形式**
各アイデアについて以下を記述：
- 名称と概要（何ができるか／何が変わるか）
- なぜ有効か（現状の課題とのつながり）
- 期待される効果
- 実現へのハードル`;
}

export default function MetaFinderPage() {
  const t = useTranslations("metaFinder");
  const tc = useTranslations("common");

  // カテゴリラベルを翻訳で解決
  const themeCategories = themeCategoryDefs.map(cat => ({
    ...cat,
    label: t(`categories.${cat.id}` as "categories.special" | "categories.strategy" | "categories.operations" | "categories.people" | "categories.governance" | "categories.external"),
  }));
  const themesByCategory = themeCategoryGroups.map(group => ({
    ...group,
    label: t(`categories.${group.id}` as "categories.special" | "categories.strategy" | "categories.operations" | "categories.people" | "categories.governance" | "categories.external"),
  }));

  // 単発探索用の状態（複数セル選択対応）
  const [result, setResult] = useState<MetaFinderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [multiExploreProgress, setMultiExploreProgress] = useState<{ current: number; total: number } | null>(null);

  // フリーテキストプロンプト
  const [freePrompt, setFreePrompt] = useState<string>("");
  const [isListening, setIsListening] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // バッチ探索用の状態
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [latestBatch, setLatestBatch] = useState<BatchInfo | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
  const [batchStarting, setBatchStarting] = useState(false);
  const [batchActiveTab, setBatchActiveTab] = useState<"top" | "theme" | "dept">("top");
  const [batchExpandedIdea, setBatchExpandedIdea] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // AIチャット用の状態
  const [chatIdea, setChatIdea] = useState<IdeaChatTarget | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // プログレスバーのシミュレーション（easeIn: 最初ゆっくり→後半加速）
  useEffect(() => {
    if (loading) {
      setProgress(0);
      const startTime = Date.now();
      const estimatedDuration = 30000; // 推定30秒

      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const t = elapsed / estimatedDuration;

        let p: number;
        if (t <= 1) {
          p = t * t * t * 92;
        } else {
          const overtime = t - 1;
          p = 92 + 5 * (1 - Math.exp(-overtime * 0.8));
        }
        setProgress(Math.min(p, 97));
      }, 200);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (progress > 0) {
        setProgress(100);
        setTimeout(() => setProgress(0), 500);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [loading]);

  // セルキーのヘルパー
  const cellKey = (themeId: string, deptId: string) => `${themeId}::${deptId}`;
  const parseCell = (key: string) => {
    const [themeId, deptId] = key.split("::");
    return { themeId, deptId };
  };

  // セル選択時の処理（複数選択対応・トグル式）
  const handleCellClick = (themeId: string, deptId: string) => {
    if (loading) return;

    const key = cellKey(themeId, deptId);
    setResult(null);
    setError(null);

    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      // プロンプトプレビューは最後に選択したセルのもの
      if (next.size > 0) {
        const lastKey = Array.from(next).pop()!;
        const { themeId: lastTheme, deptId: lastDept } = parseCell(lastKey);
        setGeneratedPrompt(generatePrompt(lastTheme, lastDept));
      } else {
        setGeneratedPrompt("");
      }
      return next;
    });
  };

  // 選択解除
  const clearSelection = () => {
    setSelectedCells(new Set());
    setGeneratedPrompt("");
    setResult(null);
    setError(null);
  };

  // 探索実行（複数セル対応：順次探索→結果統合）
  const handleExplore = async () => {
    if (loading || selectedCells.size === 0) return;

    // 既存のリクエストをキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setResult(null);

    const cells = Array.from(selectedCells).map(parseCell);
    const allIdeas: DiscoveredIdea[] = [];
    const allThinkingProcesses: string[] = [];
    const allSummaries: string[] = [];
    setMultiExploreProgress({ current: 0, total: cells.length });

    try {
      for (let i = 0; i < cells.length; i++) {
        if (abortControllerRef.current.signal.aborted) break;

        const { themeId, deptId } = cells[i];
        const theme = businessThemes.find(t => t.id === themeId);
        const dept = departments.find(d => d.id === deptId);
        const prompt = generatePrompt(themeId, deptId);

        setMultiExploreProgress({ current: i, total: cells.length });

        const res = await fetch("/api/meta-finder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            additionalContext: prompt,
            themeId,
            themeName: theme?.label || themeId,
            deptId,
            deptName: dept?.label || deptId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `分析に失敗しました（${theme?.label} × ${dept?.label}）`);
        }

        const data = await res.json();
        const ideas: DiscoveredIdea[] = (data.needs || []).map((need: { id: string; name: string; description: string; reason: string; financial: number; customer: number; process: number; growth: number }) => ({
          id: need.id,
          name: need.name,
          description: need.description,
          reason: need.reason,
          financial: need.financial,
          customer: need.customer,
          process: need.process,
          growth: need.growth,
          themeName: theme?.label || themeId,
          deptName: dept?.label || deptId,
        }));
        allIdeas.push(...ideas);
        if (data.thinkingProcess) allThinkingProcesses.push(`【${theme?.label} × ${dept?.label}】\n${data.thinkingProcess}`);
        if (data.summary) allSummaries.push(`[${theme?.label} × ${dept?.label}] ${data.summary}`);

        // 途中経過を表示
        setResult({
          ideas: [...allIdeas],
          thinkingProcess: allThinkingProcesses.join("\n\n---\n\n"),
          summary: allSummaries.join("\n"),
        });
      }

      setMultiExploreProgress({ current: cells.length, total: cells.length });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setLoading(false);
      setMultiExploreProgress(null);
    }
  };

  // フリーテキスト探索実行
  const handleFreeExplore = async () => {
    if (loading || !freePrompt.trim()) return;

    // マトリクス選択をクリア
    setSelectedCells(new Set());
    setGeneratedPrompt("");

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/meta-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          additionalContext: freePrompt.trim(),
          themeId: "freetext",
          themeName: t("freePrompt.freeExplore"),
          deptId: "all",
          deptName: t("freePrompt.allDepts"),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("explore.analysisFailed"));
      }

      const data = await res.json();
      const ideas: DiscoveredIdea[] = (data.needs || []).map((need: { id: string; name: string; description: string; reason: string; financial: number; customer: number; process: number; growth: number }) => ({
        id: need.id,
        name: need.name,
        description: need.description,
        reason: need.reason,
        financial: need.financial,
        customer: need.customer,
        process: need.process,
        growth: need.growth,
      }));
      setResult({
        ideas,
        thinkingProcess: data.thinkingProcess,
        summary: data.summary,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setLoading(false);
    }
  };

  // 音声入力トグル
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t("freePrompt.speechNotSupported"));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = freePrompt;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim = transcript;
        }
      }
      setFreePrompt(finalTranscript + interim);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // 文章改善
  const handleImproveText = async () => {
    if (!freePrompt.trim() || isImproving) return;
    setIsImproving(true);
    try {
      const res = await fetch("/api/improve-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: freePrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.content) {
          setFreePrompt(data.content);
        }
      }
    } catch (err) {
      console.error("Failed to improve text:", err);
    } finally {
      setIsImproving(false);
    }
  };

  // キャンセル処理
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setLoading(false);
    setProgress(0);
  };

  // ========== バッチ探索関連の関数 ==========

  // バッチ状態を取得
  const fetchBatchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/meta-finder/batch");
      const data = await res.json();
      setBatches(data.batches || []);
      setLatestBatch(data.latest || null);

      // 完了したバッチがあり、まだサマリーを読み込んでいなければ最新を取得
      const completedBatches = (data.batches || []).filter((b: BatchInfo) => b.status === "completed");
      if (completedBatches.length > 0 && !batchSummary && !selectedBatchId) {
        fetchBatchSummary(completedBatches[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch batch status:", error);
    }
  }, [batchSummary, selectedBatchId]);

  // サマリーを取得
  const fetchBatchSummary = async (batchId: string) => {
    try {
      const res = await fetch(`/api/meta-finder/batch/summary?batchId=${batchId}`);
      const data = await res.json();
      setBatchSummary(data);
      setSelectedBatchId(batchId);
    } catch (error) {
      console.error("Failed to fetch summary:", error);
    }
  };

  // バッチ処理を開始
  const startBatch = async () => {
    if (batchStarting) return;

    const confirmed = confirm(t("batch.confirmStart"));

    if (!confirmed) return;

    try {
      setBatchStarting(true);
      const res = await fetch("/api/meta-finder/batch", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        alert(t("batch.started", { batchId: data.batchId, estimatedTime: data.estimatedTime }));
        fetchBatchStatus();
      } else {
        alert(data.error || t("batch.startFailed"));
      }
    } catch (error) {
      console.error("Failed to start batch:", error);
      alert(t("batch.startError"));
    } finally {
      setBatchStarting(false);
    }
  };

  // バッチ処理をキャンセル
  const cancelBatch = async () => {
    if (!latestBatch || latestBatch.status !== "running") return;

    const confirmed = confirm(t("batch.confirmCancel", { completed: latestBatch.completedPatterns, total: latestBatch.totalPatterns }));

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/meta-finder/batch?id=${latestBatch.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert(t("batch.cancelled"));
        fetchBatchStatus();
      } else {
        const data = await res.json();
        alert(data.error || t("batch.cancelFailed"));
      }
    } catch (error) {
      console.error("Failed to cancel batch:", error);
      alert(t("batch.cancelFailed"));
    }
  };

  // 全履歴を削除
  const clearAllHistory = async () => {
    const confirmed = confirm(t("batch.confirmClearAll"));

    if (!confirmed) return;

    try {
      const res = await fetch("/api/meta-finder/batch?id=all", {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        alert(t("batch.cleared", { count: data.deletedCount }));
        setBatches([]);
        setLatestBatch(null);
        setBatchSummary(null);
        setSelectedBatchId(null);
      } else {
        alert(data.error || t("batch.clearFailed"));
      }
    } catch (error) {
      console.error("Failed to clear history:", error);
      alert(t("batch.clearFailed"));
    }
  };

  // バッチ状態の初回読み込みと定期更新
  useEffect(() => {
    // 初回読み込み
    fetchBatchStatus();

    // 実行中の場合は定期的に更新
    const interval = setInterval(() => {
      if (latestBatch?.status === "running") {
        fetchBatchStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchBatchStatus, latestBatch?.status]);

  // スコアに応じた色
  const getScoreColor = (score: number) => {
    if (score >= 4) return "text-green-600 dark:text-green-400";
    if (score >= 3) return "text-blue-600 dark:text-blue-400";
    if (score >= 2) return "text-yellow-600 dark:text-yellow-400";
    return "text-gray-600 dark:text-gray-400";
  };

  // バッチ進捗率
  const batchProgressPercent = latestBatch
    ? Math.round((latestBatch.completedPatterns / latestBatch.totalPatterns) * 100)
    : 0;

  // ========== ここまでバッチ関連 ==========

  const sortedIdeas = result?.ideas.sort((a, b) => {
    const scoreA = (a.financial + a.customer + a.process + a.growth) / 4;
    const scoreB = (b.financial + b.customer + b.process + b.growth) / 4;
    return scoreB - scoreA;
  });

  // 選択中セルの情報を取得
  const selectedCellsList = Array.from(selectedCells).map(key => {
    const { themeId, deptId } = parseCell(key);
    return {
      themeId,
      deptId,
      theme: businessThemes.find(t => t.id === themeId),
      dept: departments.find(d => d.id === deptId),
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div className="max-w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                🌱 {t("title")}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {t("headerDesc")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/settings"
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              ⚙️ {tc("settings")}
            </a>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 py-6">
        {/* ========== フリーテキストプロンプトボックス ========== */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t("freePrompt.title")}
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
              {t("freePrompt.desc")}
            </span>
          </h2>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <textarea
                value={freePrompt}
                onChange={(e) => setFreePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleFreeExplore();
                  }
                }}
                placeholder={t("freePrompt.placeholder")}
                className="w-full h-20 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              {isListening && (
                <span className="absolute top-2 right-2 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={toggleListening}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isListening
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300"
                }`}
                title={isListening ? t("freePrompt.voiceStopTitle") : t("freePrompt.voiceStartTitle")}
                disabled={loading}
              >
                {isListening ? `⏹ ${t("freePrompt.voiceStop")}` : `🎤 ${t("freePrompt.voice")}`}
              </button>
              <button
                onClick={handleImproveText}
                disabled={loading || isImproving || !freePrompt.trim()}
                className="px-3 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
                title={t("freePrompt.improveTitle")}
              >
                {isImproving ? t("freePrompt.improving") : `✨ ${t("freePrompt.improveText")}`}
              </button>
              <button
                onClick={handleFreeExplore}
                disabled={loading || !freePrompt.trim()}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg text-sm font-bold shadow-md transition-all disabled:cursor-not-allowed"
              >
                {loading ? t("freePrompt.exploring") : `🚀 ${t("freePrompt.explore")}`}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {t("freePrompt.ctrlEnter")}
          </p>
        </div>

        {/* ========== 全探索セクション（常に表示）========== */}
        {/* 進捗表示（実行中の場合のみ） */}
        {latestBatch?.status === "running" && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600 dark:text-slate-400">
                  {latestBatch.currentTheme} × {latestBatch.currentDept}
                </span>
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  {latestBatch.completedPatterns}/{latestBatch.totalPatterns} ({batchProgressPercent}%)
                </span>
              </div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${batchProgressPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("batch.discoveredIdeas", { count: latestBatch.totalIdeas })}
                </p>
                <button
                  onClick={cancelBatch}
                  className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900 text-red-700 dark:text-red-300 rounded-lg transition-colors"
                >
                  {tc("cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 全探索履歴セクション（履歴がある場合のみ） */}
        {batches.length > 0 && latestBatch?.status !== "running" && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4 mb-6">
            <div className="space-y-4">
              {/* 履歴セレクター */}
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                  📚 {t("batch.history")}
                </h3>
                {batchSummary && (
                  <>
                    <a
                      href={`/meta-finder/report?batchId=${batchSummary.batch.id}`}
                      className="px-2 py-1 text-xs bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded transition-colors"
                    >
                      📊 {t("batch.reportGenerate")}
                    </a>
                    <button
                      onClick={() => exportMetaFinderPdf(batchSummary)}
                      className="px-2 py-1 text-xs bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded transition-colors"
                    >
                      📄 {t("batch.pdfExport")}
                    </button>
                  </>
                )}
                <button
                  onClick={clearAllHistory}
                  className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded transition-colors"
                >
                  🗑️ {t("batch.deleteAll")}
                </button>
                <div className="flex flex-wrap gap-2">
                  {batches.filter(b => b.status === "completed").map((batch, index) => (
                    <div key={batch.id} className="flex items-center gap-0.5">
                      <button
                        onClick={() => fetchBatchSummary(batch.id)}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                          selectedBatchId === batch.id
                            ? "bg-purple-600 text-white shadow-md"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <span className="font-medium">
                          {index === 0 ? t("batch.latest") : `#${batches.filter(b => b.status === "completed").length - index}`}
                        </span>
                        <span className="ml-1.5 opacity-75">
                          {new Date(batch.startedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                        </span>
                        <span className="ml-1.5 text-purple-300 dark:text-purple-500">
                          {batch.totalIdeas}件
                        </span>
                      </button>
                      <a
                        href={`/meta-finder/report?batchId=${batch.id}`}
                        title={t("batch.reportGenerate")}
                        className="px-1.5 py-1.5 text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                      >
                        📊
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* サマリー表示 */}
              {batchSummary && (
                <>
                  {/* 選択中のバッチ情報 */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{t("batch.showing")}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {new Date(batchSummary.batch.startedAt).toLocaleString("ja-JP")}
                    </span>
                    <span>{t("batch.executed")}</span>
                    {batchSummary.batch.completedAt && (
                      <>
                        <span>→</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {new Date(batchSummary.batch.completedAt).toLocaleString("ja-JP")}
                        </span>
                        <span>{t("batch.completed")}</span>
                      </>
                    )}
                  </div>

                  {/* 統計カード */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {batchSummary.stats.totalIdeas}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">{t("batch.totalIdeas")}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {batchSummary.stats.avgScore}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">{t("batch.avgScore")}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {batchSummary.scoreDistribution.excellent}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">{t("batch.highScore")}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {batchSummary.stats.maxScore?.toFixed(1)}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">{t("batch.maxScore")}</div>
                    </div>
                  </div>

                  {/* タブ切り替え */}
                  <div className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden">
                    <div className="flex border-b border-slate-200 dark:border-slate-700">
                      {[
                        { id: "top", label: t("batch.topIdeas"), count: batchSummary.topIdeas.length },
                        { id: "theme", label: t("batch.themeBest"), count: batchSummary.themeBest.length },
                        { id: "dept", label: t("batch.deptBest"), count: batchSummary.deptBest.length },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setBatchActiveTab(tab.id as "top" | "theme" | "dept")}
                          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                            batchActiveTab === tab.id
                              ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-b-2 border-purple-500"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                          }`}
                        >
                          {tab.label} ({tab.count})
                        </button>
                      ))}
                    </div>

                    {/* アイデアリスト */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[400px] overflow-y-auto">
                      {(batchActiveTab === "top" ? batchSummary.topIdeas : batchActiveTab === "theme" ? batchSummary.themeBest : batchSummary.deptBest).map((idea, index) => (
                        <div
                          key={idea.id}
                          className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                          onClick={() => setBatchExpandedIdea(batchExpandedIdea === idea.id ? null : idea.id)}
                        >
                          <div className="flex items-start gap-3" style={{ zoom: 1.2 }}>
                            <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-full font-bold text-xs">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium text-slate-800 dark:text-white text-sm">
                                  {idea.name}
                                </h3>
                                <span className={`text-sm font-bold ${getScoreColor(idea.score)}`}>
                                  {idea.score.toFixed(1)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                                  {idea.themeName}
                                </span>
                                <span className="px-1.5 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded">
                                  {idea.deptName}
                                </span>
                              </div>
                          </div>
                          </div>

                              {batchExpandedIdea === idea.id && (
                                <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300" style={{ zoom: 1.4 }}>
                                  <div>
                                    <span className="font-medium text-slate-500 dark:text-slate-400">{t("results.overview")}</span>
                                    <p className="mt-0.5">{idea.description}</p>
                                  </div>
                                  {idea.actions && (() => {
                                    try {
                                      const actions: string[] = JSON.parse(idea.actions);
                                      return actions.length > 0 ? (
                                        <div>
                                          <span className="font-medium text-slate-500 dark:text-slate-400">{t("results.specificActions")}</span>
                                          <ul className="mt-0.5 space-y-1 list-none">
                                            {actions.map((action, i) => (
                                              <li key={i} className="flex gap-1.5">
                                                <span className="text-blue-500 shrink-0">{i + 1}.</span>
                                                <span>{action}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null;
                                    } catch { return null; }
                                  })()}
                                  <div>
                                    <span className="font-medium text-slate-500 dark:text-slate-400">{t("results.whyEffective")}</span>
                                    <p className="mt-0.5">{idea.reason}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2 pt-1 text-slate-500">
                                    <span>💰{t("results.financialScore")} {idea.financial}/5</span>
                                    <span>👥{t("results.customerScore")} {idea.customer}/5</span>
                                    <span>⚙️{t("results.processScore")} {idea.process}/5</span>
                                    <span>🌱{t("results.growthScore")} {idea.growth}/5</span>
                                  </div>
                                  <div className="pt-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setChatIdea({
                                          id: idea.id,
                                          name: idea.name,
                                          description: idea.description,
                                          actions: idea.actions,
                                          reason: idea.reason,
                                          themeName: idea.themeName,
                                          deptName: idea.deptName,
                                          financial: idea.financial,
                                          customer: idea.customer,
                                          process: idea.process,
                                          growth: idea.growth,
                                          score: idea.score,
                                        });
                                        setChatOpen(true);
                                      }}
                                      className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium transition-colors"
                                    >
                                      💬 {t("results.askAi")}
                                    </button>
                                  </div>
                                </div>
                              )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* サマリーがない場合（初回ロード中など） */}
              {!batchSummary && batches.some(b => b.status === "completed") && (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                  <p className="text-sm">{t("batch.clickToShow")}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Matrix Section */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 mb-6 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("matrix.title")}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                {t("matrix.desc")}
              </span>
            </h2>
            <button
              onClick={startBatch}
              disabled={batchStarting || latestBatch?.status === "running"}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all shadow-lg ${
                latestBatch?.status === "running"
                  ? "bg-yellow-500 text-white animate-pulse"
                  : "bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-purple-500/25"
              }`}
            >
              {batchStarting
                ? t("matrix.starting")
                : latestBatch?.status === "running"
                ? `🌙 ${t("matrix.running")} ${batchProgressPercent}%`
                : `🌙 ${t("matrix.fullExplore")}`}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1300px]">
              <thead>
                <tr>
                  <th className="p-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 sticky left-0 z-20 w-[40px]">
                    {t("matrix.majorCategory")}
                  </th>
                  <th className="p-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 sticky left-[40px] z-20 min-w-[180px]">
                    {t("matrix.subCategory")}
                  </th>
                  {departments.map((dept) => (
                    <th
                      key={dept.id}
                      className={`p-2 border border-gray-200 dark:border-slate-600 text-center text-xs font-medium min-w-[90px] ${
                        dept.id === "all"
                          ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300"
                          : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                      }`}
                      title={dept.description}
                    >
                      {dept.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {themesByCategory.map((category) => (
                  category.themes.map((theme, themeIndex) => (
                    <tr key={theme.id}>
                      {/* 大項目セル（カテゴリの最初の行のみ表示、縦書き） */}
                      {themeIndex === 0 && (
                        <td
                          rowSpan={category.themes.length}
                          className={`p-1 border border-gray-200 dark:border-slate-600 text-center font-bold sticky left-0 z-10 ${category.color}`}
                          style={{ writingMode: "vertical-rl", textOrientation: "upright", width: "40px" }}
                        >
                          {category.label}
                        </td>
                      )}
                      {/* 小項目セル */}
                      <td
                        className="p-2 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-gray-300 sticky left-[40px] z-10"
                        title={theme.description}
                      >
                        {theme.label}
                      </td>
                      {/* 各部門のセル */}
                      {departments.map((dept) => {
                        const isSelected = selectedCells.has(cellKey(theme.id, dept.id));
                        return (
                          <td
                            key={`${theme.id}-${dept.id}`}
                            className={`p-1 border border-gray-200 dark:border-slate-600 text-center cursor-pointer transition-all ${
                              isSelected
                                ? "bg-blue-500 dark:bg-blue-600 ring-2 ring-blue-400 ring-offset-1"
                                : "bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                            onClick={() => handleCellClick(theme.id, dept.id)}
                          >
                            {isSelected ? (
                              <span className="text-white text-lg">✓</span>
                            ) : (
                              <span className="text-gray-300 dark:text-slate-600 text-lg">•</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 選択情報と探索ボタン（表の直下） */}
        {selectedCells.size > 0 && !result && (
          <div className="mb-6">
            {/* 選択中のセル一覧 */}
            <div className="flex items-start gap-4 flex-wrap mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t("explore.selected")} ({selectedCells.size}{t("explore.items")}):
                </span>
                {selectedCellsList.map(({ themeId, deptId, theme, dept }) => (
                  <span
                    key={cellKey(themeId, deptId)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-lg text-xs font-medium"
                  >
                    {theme?.label} × {dept?.label}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCellClick(themeId, deptId);
                      }}
                      className="ml-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  onClick={clearSelection}
                  className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  {t("explore.clearAll")}
                </button>
              </div>
            </div>

            {/* 探索ボタン */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleExplore}
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 disabled:cursor-not-allowed flex items-center gap-3"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>{t("explore.exploring")} {multiExploreProgress ? `(${multiExploreProgress.current + 1}/${multiExploreProgress.total})` : ""}</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>{selectedCells.size === 1 ? t("explore.startExplore") : t("explore.bulkExplore", { count: selectedCells.size })}</span>
                  </>
                )}
              </button>
              {loading && (
                <button
                  onClick={handleCancel}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  {tc("cancel")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 処理中の表示（探索ボタン直下） */}
        {loading && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-blue-200 dark:border-blue-800/50 p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {t("explore.backgroundExploring")}
                  {multiExploreProgress && multiExploreProgress.total > 1 && (
                    <span className="ml-2 font-normal">
                      {t("explore.patternProgress", { current: multiExploreProgress.current + 1, total: multiExploreProgress.total })}
                    </span>
                  )}
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                  {t("explore.referencing")}
                </p>
              </div>
            </div>
            <div className="w-full bg-blue-100 dark:bg-blue-900/50 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-2 text-right">
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* プロンプト表示エリア（処理中は非表示） */}
        {selectedCells.size > 0 && !result && !loading && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
            {/* プロンプト内容 */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                <span>📝</span>
                <span>{t("explore.generatedPrompt")}</span>
              </h3>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                  {generatedPrompt}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            {/* Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4 mb-6">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                {selectedCellsList.length > 0 ? (
                  selectedCellsList.map(({ themeId, deptId, theme, dept }) => (
                    <span key={cellKey(themeId, deptId)} className="inline-flex items-center gap-1">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                        {theme?.label}
                      </span>
                      <span className="text-gray-400 text-xs">×</span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200">
                        {dept?.label}
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 rounded-full text-sm font-medium">
                    {t("freePrompt.freeExplore")}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t("results.title")}
              </h2>
              <p className="text-gray-700 dark:text-gray-300 text-sm">{result.summary}</p>

              <div className="mt-4">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {result.ideas.length}
                </span>
                <span className="text-gray-600 dark:text-gray-400 ml-2 text-sm">{t("results.ideasCount")}</span>
              </div>
            </div>

            {/* Ideas List */}
            <div className="space-y-3">
              {sortedIdeas?.map((idea, index) => {
                const score = (idea.financial + idea.customer + idea.process + idea.growth) / 4;
                const isExpanded = expandedIdea === idea.id;

                return (
                  <div
                    key={idea.id}
                    className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => setExpandedIdea(isExpanded ? null : idea.id)}
                  >
                    <div className="flex items-start justify-between gap-4" style={{ zoom: 1.2 }}>
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                          #{index + 1}
                        </span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                            {idea.name}
                          </h3>
                          {idea.themeName && idea.deptName && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                                {idea.themeName}
                              </span>
                              <span className="text-gray-400 text-xs">×</span>
                              <span className="px-1.5 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded">
                                {idea.deptName}
                              </span>
                            </div>
                          )}
                          {!isExpanded && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                              {idea.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                          {score.toFixed(1)}{t("results.score")}
                        </span>
                        <svg
                          className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600 space-y-3 text-sm" style={{ zoom: 1.4 }}>
                        <div>
                          <span className="font-medium text-slate-600 dark:text-slate-400">{t("results.overview")}</span>
                          <p className="text-slate-700 dark:text-slate-300 mt-1">{idea.description}</p>
                        </div>
                        <div>
                          <span className="font-medium text-slate-600 dark:text-slate-400">{t("results.whyEffective")}</span>
                          <p className="text-slate-700 dark:text-slate-300 mt-1">{idea.reason}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded text-xs">
                            💰{t("results.financialScore")}: {idea.financial}/5
                          </span>
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs">
                            👥{t("results.customerScore")}: {idea.customer}/5
                          </span>
                          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-xs">
                            ⚙️{t("results.processScore")}: {idea.process}/5
                          </span>
                          <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded text-xs">
                            🌱{t("results.growthScore")}: {idea.growth}/5
                          </span>
                        </div>
                        <div className="pt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const ideaScore = (idea.financial + idea.customer + idea.process + idea.growth) / 4;
                              setChatIdea({
                                id: idea.id,
                                name: idea.name,
                                description: idea.description,
                                actions: null,
                                reason: idea.reason,
                                themeName: idea.themeName || selectedCellsList[0]?.theme?.label || "",
                                deptName: idea.deptName || selectedCellsList[0]?.dept?.label || "",
                                financial: idea.financial,
                                customer: idea.customer,
                                process: idea.process,
                                growth: idea.growth,
                                score: ideaScore,
                              });
                              setChatOpen(true);
                            }}
                            className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium transition-colors"
                          >
                            💬 {t("results.askAi")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Thinking Process */}
            <details className="mt-6">
              <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 text-sm">
                🧠 {t("results.showThinking")}
              </summary>
              <div className="mt-4 bg-gray-50 dark:bg-slate-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {result.thinkingProcess}
              </div>
            </details>

            {/* 別の組み合わせを探索 */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700 text-center">
              <button
                onClick={() => {
                  setResult(null);
                  setSelectedCells(new Set());
                  setGeneratedPrompt("");
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                {t("results.exploreOther")}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* AIチャットダイアログ */}
      {chatIdea && (
        <IdeaChatDialog
          idea={chatIdea}
          open={chatOpen}
          onOpenChange={setChatOpen}
        />
      )}
    </div>
  );
}
