"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle";
import { getOreNaviAudio } from "@/lib/ore-navi-audio";
import type { OreNaviResult, QueueItem, SectionType } from "@/lib/ore-navi-types";
import { MODE_LABELS, presetQuestions } from "@/lib/ore-navi-presets";
import { useOreNaviHistory } from "@/hooks/useOreNaviHistory";
import { useOreNaviChat } from "@/hooks/useOreNaviChat";
import { useOreNaviAudio } from "@/hooks/useOreNaviAudio";
import { HistoryPanel } from "@/components/ore-navi/HistoryPanel";
import { AudioControls } from "@/components/ore-navi/AudioControls";
import { InsightCard } from "@/components/ore-navi/InsightCard";
import { OreNaviChat } from "@/components/ore-navi/OreNaviChat";
import { QuestionQueue } from "@/components/ore-navi/QuestionQueue";

export default function OreNaviPage() {
  const t = useTranslations("me");
  const tc = useTranslations("common");
  const [question, setQuestion] = useState("");
  const [currentMode, setCurrentMode] = useState<string | undefined>(undefined);
  const [modeOverride, setModeOverride] = useState<string | undefined>(undefined);
  const [displayMode, setDisplayMode] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<OreNaviResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [isImproving, setIsImproving] = useState(false);

  // 質問キュー
  const [questionQueue, setQuestionQueue] = useState<QueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const queueProcessingRef = useRef(false);

  // キュー自動再生
  const [autoPlayQueue, setAutoPlayQueue] = useState(true);
  const [playingQueueIndex, setPlayingQueueIndex] = useState<number>(-1);
  const lastPlayedIndexRef = useRef<number>(-1);
  const currentPlayingIdRef = useRef<string | null>(null);

  // プログレスバー関連
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // カスタムフック
  const historyHook = useOreNaviHistory();
  const audio = useOreNaviAudio(result, setExpandedInsight);
  const chat = useOreNaviChat(result, question, currentMode);

  // ハイライト関連
  const sectionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const setSectionRef = useCallback((section: string, el: HTMLDivElement | null) => {
    if (el) {
      sectionRefs.current.set(section, el);
    }
  }, []);

  // ハイライト時に自動スクロール
  useEffect(() => {
    if (audio.currentSection) {
      const timer = setTimeout(() => {
        const el = sectionRefs.current.get(audio.currentSection!);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [audio.currentSection]);

  // プログレスバーのシミュレーション
  useEffect(() => {
    if (loading) {
      setProgress(0);
      const startTime = Date.now();
      const estimatedDuration = 25000;

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

  // 履歴削除時のリセット処理
  const handleDeleteHistory = async (id: string) => {
    await historyHook.deleteHistory(id);
    if (historyHook.viewingHistoryId === id) {
      setResult(null);
      setDisplayMode(undefined);
      setQuestion("");
    }
  };

  // 履歴表示
  const handleViewHistory = (item: Parameters<typeof historyHook.viewHistory>[0]) => {
    const { question: q, result: r } = historyHook.viewHistory(item);
    setQuestion(q);
    setResult(r);
    setDisplayMode(undefined);
  };

  // 単一アイテムを処理
  const processItem = async (itemId: string, itemQuestion: string, itemMode?: string) => {
    const TIMEOUT_MS = 180000;

    setQuestionQueue((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, status: "processing" as const } : item
      )
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch("/api/ore-navi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: itemQuestion, mode: itemMode }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || tc("error"));
      }

      const data = await res.json();

      setQuestionQueue((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, status: "completed" as const, result: data }
            : item
        )
      );
    } catch (err) {
      clearTimeout(timeoutId);
      const errorMsg = err instanceof Error && err.name === "AbortError"
        ? t("timeoutError", { seconds: String(TIMEOUT_MS / 1000) })
        : err instanceof Error ? err.message : tc("error");

      setQuestionQueue((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, status: "error" as const, error: errorMsg }
            : item
        )
      );
    }
  };

  // キューに質問を追加し、即座に並列処理を開始
  const handleSubmit = async (q?: string) => {
    const targetQuestion = q || question;
    if (!targetQuestion.trim()) return;

    if (questionQueue.length === 0) {
      lastPlayedIndexRef.current = -1;
      currentPlayingIdRef.current = null;
      setPlayingQueueIndex(-1);
    }

    const newItem: QueueItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      question: targetQuestion,
      mode: currentMode,
      status: "pending",
    };

    setQuestionQueue((prev) => [...prev, newItem]);
    setQuestion("");
    if (!modeOverride) {
      setCurrentMode(undefined);
    }

    processItem(newItem.id, targetQuestion, newItem.mode);
  };

  // 処理中のアイテム数を監視
  useEffect(() => {
    const processingCount = questionQueue.filter((item) => item.status === "processing").length;
    setLoading(processingCount > 0);
    setIsProcessingQueue(processingCount > 0);
  }, [questionQueue]);

  // キューからアイテムを削除
  const removeFromQueue = (id: string) => {
    setQuestionQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // キューの結果を表示
  const viewQueueResult = (item: QueueItem) => {
    if (item.result) {
      setResult(item.result);
      setDisplayMode(item.mode);
      setQuestion(item.question);
    }
  };

  // キュー再生を参照で保持
  const questionQueueRef = useRef<QueueItem[]>([]);
  questionQueueRef.current = questionQueue;
  const autoPlayQueueRef = useRef(true);
  autoPlayQueueRef.current = autoPlayQueue;

  // キューアイテムの結果を再生し、完了後に次へ自動遷移
  const playQueueItemResult = useCallback(async (queueItem: QueueItem, index: number) => {
    const audioManager = getOreNaviAudio();
    if (!queueItem.result || !audioManager) return;

    currentPlayingIdRef.current = queueItem.id;
    setPlayingQueueIndex(index);
    setResult(queueItem.result);
    setDisplayMode(queueItem.mode);
    setQuestion(queueItem.question);

    const sections = audio.getSections(queueItem.result);
    const sectionsData = sections
      .map((section) => ({
        section,
        text: audio.getSectionText(queueItem.result!, section),
      }))
      .filter((s) => s.text.trim());

    console.log(`[AutoPlay] Playing item ${index}: "${queueItem.question.slice(0, 30)}..." (${sectionsData.length} sections)`);

    await audioManager.generateAndPlay(sectionsData);

    if (!autoPlayQueueRef.current) {
      console.log("[AutoPlay] Auto-play disabled, stopping");
      setPlayingQueueIndex(-1);
      currentPlayingIdRef.current = null;
      return;
    }

    const currentQueue = questionQueueRef.current;
    const completedItems = currentQueue.filter(item => item.status === "completed");
    const nextIndex = lastPlayedIndexRef.current + 1;

    console.log(`[AutoPlay] Item done. lastPlayed=${lastPlayedIndexRef.current}, nextIndex=${nextIndex}, completedCount=${completedItems.length}`);

    if (nextIndex < completedItems.length) {
      const nextItem = completedItems[nextIndex];
      lastPlayedIndexRef.current = nextIndex;
      await new Promise(resolve => setTimeout(resolve, 500));
      playQueueItemResult(nextItem, currentQueue.indexOf(nextItem));
    } else {
      console.log("[AutoPlay] All items played");
      setPlayingQueueIndex(-1);
      currentPlayingIdRef.current = null;
    }
  }, [audio]);

  // 新しいアイテムが完了したら自動再生開始
  useEffect(() => {
    if (!autoPlayQueue) return;

    const completedItems = questionQueue.filter(item => item.status === "completed");

    if (completedItems.length > 0 && lastPlayedIndexRef.current < 0 && !audio.isPlaying) {
      console.log("[AutoPlay Effect] First completed item detected, starting playback");
      lastPlayedIndexRef.current = 0;
      const firstCompleted = completedItems[0];
      playQueueItemResult(firstCompleted, questionQueue.indexOf(firstCompleted));
    }
  }, [questionQueue, autoPlayQueue, audio.isPlaying, playQueueItemResult]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setProgress(0);
  };

  const handlePresetClick = (preset: typeof presetQuestions[0]) => {
    setQuestion(preset.question);
    if (!modeOverride) {
      setCurrentMode(preset.mode);
    }
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, 0);
  };

  // LLMでテキストを改善
  const handleImproveText = async () => {
    if (!question.trim() || isImproving) return;

    setIsImproving(true);
    try {
      const res = await fetch("/api/improve-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.content) {
          setQuestion(data.content);
        }
      }
    } catch (err) {
      console.error("Failed to improve text:", err);
    } finally {
      setIsImproving(false);
    }
  };

  // ハイライトスタイル
  const getHighlightStyle = (section: SectionType) => {
    if (audio.currentSection === section) {
      return "ring-2 ring-amber-400 bg-amber-900/30 shadow-lg shadow-amber-500/20 scale-[1.01]";
    }
    return "";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
            >
              {t("backToHome")}
            </Link>
            <div className="h-4 w-px bg-slate-700" />
            <div>
              <h1 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                <span className="text-2xl">🧭</span>
                {t("title")}
              </h1>
              <p className="text-slate-500 text-xs">{t("subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                historyHook.setShowHistory(!historyHook.showHistory);
                if (!historyHook.showHistory) historyHook.fetchHistory();
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                historyHook.showHistory
                  ? "bg-amber-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <span>📜</span>
              <span>{t("history")}</span>
              {historyHook.history.length > 0 && (
                <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">
                  {historyHook.history.length}
                </span>
              )}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* 履歴パネル */}
      {historyHook.showHistory && (
        <HistoryPanel
          history={historyHook.history}
          historyLoading={historyHook.historyLoading}
          viewingHistoryId={historyHook.viewingHistoryId}
          onClose={() => historyHook.setShowHistory(false)}
          onView={handleViewHistory}
          onDelete={handleDeleteHistory}
        />
      )}

      <main className="w-full px-6 py-8">
        {/* 北極星の表示 */}
        <div className="mb-6 p-4 bg-slate-900/50 border border-slate-800 rounded-lg w-full">
          <p className="text-amber-400/80 text-sm">
            <span className="font-bold text-emerald-400">+</span> {t("northStar.positive")}
          </p>
          <p className="text-amber-400/80 text-sm">
            <span className="font-bold text-red-400">−</span> {t("northStar.negative")}
          </p>
          <p className="text-slate-500 text-xs mt-1">{t("northStar.profile")}</p>
        </div>

        {/* 入力エリア */}
        <div className="mb-6 w-full flex gap-3 items-stretch">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("inputPlaceholder")}
            className="flex-1 h-20 p-4 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
          />
          <button
            onClick={handleImproveText}
            disabled={isImproving || loading || !question.trim()}
            className="px-4 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 border border-slate-700 rounded-lg transition-colors flex flex-col items-center justify-center text-sm leading-tight"
          >
            {isImproving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full" />
                <span className="text-xs mt-1">{t("improving")}</span>
              </>
            ) : (
              <>
                <span>{t("improveText")}</span>
              </>
            )}
          </button>
          <button
            onClick={() => handleSubmit()}
            disabled={!question.trim()}
            className="px-6 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <span>🚀</span>
            <span>{loading ? t("addToQueue") : t("ask")}</span>
          </button>
          {loading && (
            <button
              onClick={handleCancel}
              className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {t("cancel")}
            </button>
          )}
        </div>

        {/* クイックアクセス */}
        <div className="mb-4 w-full">
          <div className="flex flex-wrap gap-2 mb-2 text-[14px]">
            {Object.entries(MODE_LABELS).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => {
                  if (modeOverride === key) {
                    setModeOverride(undefined);
                    setCurrentMode(undefined);
                  } else {
                    setModeOverride(key);
                    setCurrentMode(key);
                  }
                }}
                className={`px-2 py-1 rounded border transition-colors bg-slate-800/80 ${
                  modeOverride === key
                    ? `${MODE_LABELS[key].badge} ring-1 ring-white/30 font-bold`
                    : `${MODE_LABELS[key].badge} opacity-50 hover:opacity-80`
                }`}
              >
                {label}
              </button>
            ))}
            {modeOverride && (
              <button
                onClick={() => { setModeOverride(undefined); setCurrentMode(undefined); }}
                className="px-2 py-1 rounded border border-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {t("releaseMode")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presetQuestions.map((preset) => {
              const badgeStyle = preset.mode && MODE_LABELS[preset.mode]
                ? MODE_LABELS[preset.mode].badge
                : "border-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200";
              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset)}
                  className={`px-3 py-1.5 bg-slate-800/80 border rounded text-sm transition-colors ${badgeStyle}`}
                  title={preset.question}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 質問キュー表示 */}
        <QuestionQueue
          questionQueue={questionQueue}
          autoPlayQueue={autoPlayQueue}
          setAutoPlayQueue={setAutoPlayQueue}
          playingQueueIndex={playingQueueIndex}
          isPlaying={audio.isPlaying}
          onViewResult={viewQueueResult}
          onRemove={removeFromQueue}
          onClearCompleted={() => {
            setQuestionQueue(prev => prev.filter(item => item.status === "pending" || item.status === "processing"));
            lastPlayedIndexRef.current = -1;
            currentPlayingIdRef.current = null;
            setPlayingQueueIndex(-1);
          }}
        />

        {/* 履歴表示中のインジケーター */}
        {result && historyHook.viewingHistoryId && (
          <div className="mb-4 w-full flex justify-end">
            <span className="text-slate-500 text-sm flex items-center gap-2">
              <span>📜</span>
              <span>{t("historyViewing")}</span>
            </span>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 w-full">
            {error}
          </div>
        )}

        {/* フローティング音声コントロール（結果非表示時に再生中の場合） */}
        {audio.isPlaying && !result && (
          <div className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 border border-amber-700 rounded-lg shadow-lg shadow-amber-900/20">
            <div className="flex items-center gap-3">
              <div className="flex gap-0.5">
                <span className="w-1 h-3 bg-amber-500 rounded animate-pulse"></span>
                <span className="w-1 h-4 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.1s" }}></span>
                <span className="w-1 h-2 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.2s" }}></span>
              </div>
              <span className="text-amber-300 text-sm">{t("playing")}</span>
              <button
                onClick={audio.togglePlayPause}
                className="ml-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                title={t("pauseTitle")}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* 結果表示 */}
        {result && (
          <div className="space-y-6 w-full">
            {/* 音声コントロール */}
            <AudioControls
              isPlaying={audio.isPlaying}
              isPaused={audio.isPaused}
              speechSpeed={audio.speechSpeed}
              setSpeechSpeed={audio.setSpeechSpeed}
              queueStatus={audio.queueStatus}
              audioError={audio.audioError}
              onGenerateSpeech={audio.generateSpeech}
              onTogglePlayPause={audio.togglePlayPause}
              onStop={audio.stopSpeech}
            />

            {/* 質問内容 */}
            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-slate-500 text-xs">{t("question")}</p>
                {displayMode && MODE_LABELS[displayMode] && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${MODE_LABELS[displayMode].color}`}>
                    {MODE_LABELS[displayMode].label}
                  </span>
                )}
              </div>
              <p className="text-slate-300">{question}</p>
            </div>

            {/* サマリー */}
            <div
              ref={(el) => setSectionRef("summary", el)}
              onClick={() => audio.handleSectionClick("summary")}
              className={`p-5 bg-slate-900 border border-amber-800/50 rounded-lg transition-all duration-300 ${getHighlightStyle("summary")} ${(audio.isPlaying || audio.isPaused) ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
            >
              <p className="text-amber-300 text-lg">{result.summary}</p>
            </div>

            {/* 警告 */}
            {result.warning && (
              <div
                ref={(el) => setSectionRef("warning", el)}
                onClick={() => audio.handleSectionClick("warning")}
                className={`p-4 bg-red-900/30 border border-red-800 rounded-lg transition-all duration-300 ${getHighlightStyle("warning")} ${(audio.isPlaying || audio.isPaused) ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
              >
                <p className="text-red-300 text-sm flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{result.warning}</span>
                </p>
              </div>
            )}

            {/* インサイト一覧 */}
            <div className="space-y-4" id="insights-list">
              {result.insights.map((insight, index) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  index={index}
                  isExpanded={expandedInsight === insight.id}
                  onToggle={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
                  isPlaying={audio.isPlaying}
                  isPaused={audio.isPaused}
                  currentSection={audio.currentSection}
                  onSectionClick={audio.handleSectionClick}
                  setSectionRef={setSectionRef}
                />
              ))}
            </div>

            {/* AIチャット */}
            <OreNaviChat
              chatMessages={chat.chatMessages}
              chatInput={chat.chatInput}
              setChatInput={chat.setChatInput}
              chatLoading={chat.chatLoading}
              chatEndRef={chat.chatEndRef}
              sendChatMessage={chat.sendChatMessage}
            />
          </div>
        )}

        {/* 空の状態 */}
        {!result && !loading && !error && questionQueue.length === 0 && (
          <div className="text-center py-8 w-full">
            <p className="text-slate-500 text-lg">{t("emptyState")}</p>
            <p className="text-slate-600 text-sm mt-2">
              {t("emptyStateDesc")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
