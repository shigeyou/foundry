"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";

export function SwotTab() {
  const { swot, setSwot, swotLoading, fetchSwot } = useApp();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isAnalyzingRef = useRef(false); // 連打防止用の同期ガード
  const [swotProgress, setSwotProgress] = useState(0);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [showAdditionalInput, setShowAdditionalInput] = useState(false);

  // クリーンアップ用のRef
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const lastClickTimeRef = useRef<number>(0); // クールダウン用

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // すべてのタイマー・アニメーション・リクエストをキャンセル
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // 100%までアニメーションさせる関数（安全なバージョン）
  const animateToComplete = useCallback((
    currentProgress: number,
    onComplete: () => void,
    duration: number = 1500
  ) => {
    // 既存のアニメーションをキャンセル
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const startProgress = currentProgress;
    const startTime = Date.now();

    const animate = () => {
      // アンマウント済みなら何もしない
      if (!isMountedRef.current) return;

      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const newProgress = startProgress + (100 - startProgress) * eased;

      setSwotProgress(Math.min(newProgress, 100));

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setSwotProgress(100);
        animationFrameRef.current = null;
        setTimeout(() => {
          if (isMountedRef.current) {
            onComplete();
          }
        }, 300);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // クリーンアップヘルパー
  const cleanup = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const runSwotAnalysis = useCallback(async () => {
    // 連打防止: 複数のガードを組み合わせる
    // 1. State check
    if (isAnalyzing) {
      console.log("SWOT analysis already in progress (state), ignoring click");
      return;
    }

    // 2. Ref check (synchronous)
    if (isAnalyzingRef.current) {
      console.log("SWOT analysis already in progress (ref), ignoring click");
      return;
    }

    // 3. クールダウン: 最後のクリックから3秒以内は無視
    const now = Date.now();
    if (now - lastClickTimeRef.current < 3000) {
      console.log("SWOT analysis cooldown, ignoring click");
      return;
    }

    // 即座にガードをセット（これ以降のクリックをブロック）
    isAnalyzingRef.current = true;
    lastClickTimeRef.current = now;

    // 既存の処理をすべてキャンセル
    cleanup();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsAnalyzing(true);
    setSwotProgress(0);
    const startTime = Date.now();
    const expectedDuration = 150000; // 150秒想定（20%速度）
    let maxProgress = 0;

    // easeInCubic: 前半ゆっくり→後半尻上がりに加速→97%まで自然に到達
    const calculateProgress = () => {
      const elapsed = Date.now() - startTime;
      const t = elapsed / expectedDuration;

      let progress: number;
      if (t <= 1) {
        progress = t * t * t * 92;
      } else {
        const overtime = t - 1;
        progress = 92 + 5 * (1 - Math.exp(-overtime * 0.8));
      }
      return Math.min(progress, 97);
    };

    progressIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      const newProgress = calculateProgress();
      maxProgress = Math.max(maxProgress, newProgress);
      setSwotProgress(maxProgress);
    }, 300);

    try {
      const res = await fetch("/api/admin/swot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regenerate: true,
          additionalInfo: additionalInfo.trim() || undefined,
        }),
        signal: abortControllerRef.current.signal,
      });

      // アンマウント済みなら何もしない
      if (!isMountedRef.current) return;

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      const data = await res.json();
      if (data.success) {
        // 100%までアニメーションしてから完了
        animateToComplete(maxProgress, () => {
          if (!isMountedRef.current) return;
          setSwot(data.swot);
          setIsAnalyzing(false);
          setSwotProgress(0);
          isAnalyzingRef.current = false; // ガード解除
        });
      } else {
        setIsAnalyzing(false);
        setSwotProgress(0);
        isAnalyzingRef.current = false; // ガード解除
        alert("SWOT分析に失敗しました: " + (data.error || "不明なエラー"));
      }
    } catch (error) {
      // AbortErrorは正常なキャンセルなので無視
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("SWOT analysis was cancelled");
        return;
      }
      console.error("SWOT analysis failed:", error);
      cleanup();
      if (isMountedRef.current) {
        setIsAnalyzing(false);
        setSwotProgress(0);
        isAnalyzingRef.current = false; // ガード解除
        alert("SWOT分析に失敗しました");
      }
    }
  }, [isAnalyzing, additionalInfo, animateToComplete, cleanup, setSwot]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <div className="flex flex-col px-4 py-3 overflow-hidden" style={{ height: 'calc(100vh - 130px)' }}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">SWOT分析</h1>
          {swot && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              最終更新: {formatDate(swot.updatedAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdditionalInput(!showAdditionalInput)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showAdditionalInput ? "補足情報を閉じる" : "補足情報を追加"}
          </button>
          <Button
            onClick={runSwotAnalysis}
            disabled={isAnalyzing}
            size="sm"
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? "分析中..." : "再分析"}
          </Button>
          {isAnalyzing && (
            <button
              onClick={() => {
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort();
                  abortControllerRef.current = null;
                }
                cleanup();
                setIsAnalyzing(false);
                setSwotProgress(0);
                isAnalyzingRef.current = false;
              }}
              className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md font-medium transition-colors"
            >
              キャンセル
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 flex-shrink-0">
        外部データを検索・参照するRAGの仕組みと、大規模言語モデルが保持する知識を組み合わせて、SWOT分析を行います。
      </p>

      {/* 案内メッセージ */}
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 flex-shrink-0">
        このままでよければ次に進んで問題ありません。内容を変更したい場合は「再分析」を実行してください。
      </p>

      {/* 補足情報入力欄（折りたたみ式） */}
      {showAdditionalInput && (
        <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex-shrink-0">
          <textarea
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="市場情報、競合状況など、SWOT分析の参考情報..."
            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm resize-none"
            rows={2}
          />
        </div>
      )}

      {/* プログレスバー */}
      {isAnalyzing && (
        <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 flex-shrink-0">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-green-700 dark:text-green-300 font-medium">
              AIがSWOT分析を実行中...
            </span>
            <span className="text-green-600 dark:text-green-400">{Math.round(swotProgress)}%</span>
          </div>
          <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-green-600 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, swotProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* SWOT表示 */}
      {swotLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
          読み込み中...
        </div>
      ) : swot ? (
        <div className="flex-1 flex flex-col min-h-0 gap-2 overflow-hidden">
          {/* 4象限グリッド */}
          <div className="flex-1 grid grid-cols-2 gap-2 min-h-0 overflow-hidden">
            {/* 強み */}
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 overflow-auto">
              <h3 className="font-semibold text-green-800 dark:text-green-300 mb-1.5 text-sm sticky top-0 bg-green-50 dark:bg-green-900/20">
                強み (Strengths)
              </h3>
              <ul className="space-y-1 text-xs text-green-700 dark:text-green-400">
                {swot.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                    <span className="leading-snug">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 弱み */}
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 overflow-auto">
              <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1.5 text-sm sticky top-0 bg-red-50 dark:bg-red-900/20">
                弱み (Weaknesses)
              </h3>
              <ul className="space-y-1 text-xs text-red-700 dark:text-red-400">
                {swot.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                    <span className="leading-snug">{w}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 機会 */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-auto">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1.5 text-sm sticky top-0 bg-blue-50 dark:bg-blue-900/20">
                機会 (Opportunities)
              </h3>
              <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-400">
                {swot.opportunities.map((o, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                    <span className="leading-snug">{o}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 脅威 */}
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 overflow-auto">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1.5 text-sm sticky top-0 bg-yellow-50 dark:bg-yellow-900/20">
                脅威 (Threats)
              </h3>
              <ul className="space-y-1 text-xs text-yellow-700 dark:text-yellow-400">
                {swot.threats.map((t, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-yellow-500 mt-0.5 flex-shrink-0">•</span>
                    <span className="leading-snug">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* サマリー */}
          {swot.summary && (
            <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 flex-shrink-0">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1" style={{ fontSize: '110%' }}>
                サマリー
              </h3>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed" style={{ fontSize: '110%' }}>
                {swot.summary}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-slate-500 dark:text-slate-400 mb-2">
            SWOT分析がまだ実行されていません
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            「再分析」ボタンをクリックしてください
          </p>
        </div>
      )}
    </div>
  );
}
