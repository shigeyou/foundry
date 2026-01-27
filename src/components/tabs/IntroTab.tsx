"use client";

import { useState } from "react";
import { useApp } from "@/contexts/AppContext";

export function IntroTab() {
  const { setActiveTab } = useApp();
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [clearStatus, setClearStatus] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [myClearStatus, setMyClearStatus] = useState<string | null>(null);
  const [isMyClear, setIsMyClear] = useState(false);

  const handleForceSeed = async () => {
    if (!confirm("強制シードを実行すると、現在の探索データが初期データに置き換わります。続行しますか？")) {
      return;
    }
    setIsSeeding(true);
    setSeedStatus("シード中...");
    try {
      const res = await fetch("/api/seed?type=exploration&force=true", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const counts = data.results?.exploration?.seeded || {};
        setSeedStatus(`完了: Exploration ${counts.explorations || 0}件, TopStrategy ${counts.topStrategies || 0}件, StrategyDecision ${counts.strategyDecisions || 0}件`);
      } else {
        setSeedStatus(`エラー: ${data.error || "不明なエラー"}`);
      }
    } catch (e) {
      setSeedStatus(`エラー: ${e instanceof Error ? e.message : "通信エラー"}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearMyData = async () => {
    if (!confirm("あなたの探索データをすべて削除します。会社情報・RAG・SWOTは残ります。続行しますか？")) {
      return;
    }
    setIsMyClear(true);
    setMyClearStatus("削除中...");
    try {
      const res = await fetch("/api/seed?user-only=true", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        const d = data.deleted || {};
        setMyClearStatus(`削除完了: 探索${d.explorations || 0}件, ランキング${d.topStrategies || 0}件, 採否${d.strategyDecisions || 0}件, 学習${d.learningMemories || 0}件`);
      } else {
        setMyClearStatus(`エラー: ${data.error || "不明なエラー"}`);
      }
    } catch (e) {
      setMyClearStatus(`エラー: ${e instanceof Error ? e.message : "通信エラー"}`);
    } finally {
      setIsMyClear(false);
    }
  };

  const handleClearExplorations = async () => {
    if (!confirm("【管理者】全ユーザーの探索データをすべて削除します。会社情報やRAGドキュメントは残ります。続行しますか？")) {
      return;
    }
    setIsClearing(true);
    setClearStatus("削除中...");
    try {
      const res = await fetch("/api/seed", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        const d = data.deleted || {};
        setClearStatus(`削除完了: Exploration ${d.explorations || 0}件, TopStrategy ${d.topStrategies || 0}件, StrategyDecision ${d.strategyDecisions || 0}件, LearningMemory ${d.learningMemories || 0}件`);
      } else {
        setClearStatus(`エラー: ${data.error || "不明なエラー"}`);
      }
    } catch (e) {
      setClearStatus(`エラー: ${e instanceof Error ? e.message : "通信エラー"}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">はじめに</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        勝ち筋ファインダーの概要と基本的な使い方をご紹介します。
      </p>

      {/* アプリの概要 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-blue-500 rounded"></span>
          勝ち筋ファインダーとは
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            勝ち筋ファインダーは、<strong>AIの力を借りて企業の「勝ち筋」を探索するツール</strong>です。
          </p>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            外部データを検索・参照する<strong>RAG（Retrieval-Augmented Generation）</strong>の仕組みと、
            大規模言語モデル（LLM）が保持する広範な知識を組み合わせることで、
            自社の強みを活かした戦略オプションを多角的に提案します。
          </p>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            単なるアイデア出しにとどまらず、提案された勝ち筋を評価・選別し、
            その判断履歴からAIが学習することで、より的確な提案へと進化していく仕組みを備えています。
          </p>
        </div>
      </section>

      {/* 基本的な使い方 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-green-500 rounded"></span>
          基本的な使い方
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">対象企業の設定</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  勝ち筋を探索する対象企業の基本情報を設定します。親会社がある場合はその関係性も設定できます。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">RAG情報の登録</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  会社案内や事業計画などの資料を登録すると、AIがそれらを参照して提案の精度を高めます。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">SWOT分析の確認</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  登録情報をもとにAIがSWOT分析を実行します。必要に応じて内容を調整してください。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">勝ち筋の探索</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  「問い」を入力して探索を実行すると、AIが複数の勝ち筋を提案します。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">5</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">採否の判断と学習</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  提案された勝ち筋を「採用」「却下」で評価すると、その傾向をAIが学習し、次回以降の提案に反映されます。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">6</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">シン・勝ち筋の探求</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  採用した勝ち筋をベースに、AIがさらに進化した勝ち筋を自動生成します。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">7</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">インサイト</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  採否の履歴から「学習パターン」を抽出し、全探索結果を俯瞰する「メタ分析」で本質的な勝ちパターンを発見します。
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* AIとの向き合い方 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-amber-500 rounded"></span>
          AIとの向き合い方
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            AIの活用については、さまざまな立場や意見があります。本アプリは特定の立場を押し付けるものではなく、
            AIを<strong>「道具」として適切に活用する</strong>ことを目指しています。
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="font-medium text-green-800 dark:text-green-200 mb-2">AIを活用するメリット</p>
              <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                <li>・多角的な視点からアイデアを得られる</li>
                <li>・大量の情報を短時間で整理できる</li>
                <li>・思考の壁打ち相手として有用</li>
                <li>・人間が見落としがちな観点を補完</li>
                <li>・前提整理を支援し、誰でも一定品質を出せる</li>
              </ul>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="font-medium text-red-800 dark:text-red-200 mb-2">注意すべき点</p>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                <li>・AIの提案が常に正しいとは限らない</li>
                <li>・最終判断は必ず人間が行う</li>
                <li>・機密情報の取り扱いに注意</li>
                <li>・過度な依存は思考力の低下を招く恐れ</li>
                <li>・前提が不正確だと、結果も不正確になる（Garbage In, Garbage Out）</li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
              <strong>本アプリの基本姿勢：</strong>
              AIはあくまで「提案者」であり、最終的な意思決定は人間が行います。
              AIの提案を鵜呑みにせず、批判的に検討し、自社の文脈に照らして判断することが重要です。
              AIを「答えを出してくれる存在」ではなく「思考を広げる触媒」として活用することで、
              人間の創造性とAIの処理能力を相互補完的に活かすことができます。
            </p>
          </div>
        </div>
      </section>

      {/* 始めるボタン */}
      <div className="text-center mb-12">
        <button
          onClick={() => setActiveTab("company")}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          対象企業の設定から始める
        </button>
      </div>

      {/* データ管理 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-orange-500 rounded"></span>
          データ管理
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
            RAGデータが更新された場合など、自分の探索データをリセットしたい場合に使用します。
            会社情報・RAG・SWOTは共有データのため残ります。
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={handleClearMyData}
              disabled={isMyClear}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium rounded-lg transition-colors text-sm"
            >
              {isMyClear ? "削除中..." : "自分のデータをクリア"}
            </button>
            {myClearStatus && (
              <span className={`text-sm ${myClearStatus.startsWith("エラー") ? "text-red-600" : "text-green-600"}`}>
                {myClearStatus}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 管理者向け */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-slate-500 rounded"></span>
          管理者向け
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          {/* 探索データクリア */}
          <div>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-2">
              探索データのみ削除します（会社情報・RAGは残ります）。
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={handleClearExplorations}
                disabled={isClearing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors text-sm"
              >
                {isClearing ? "削除中..." : "探索データをクリア"}
              </button>
              {clearStatus && (
                <span className={`text-sm ${clearStatus.startsWith("エラー") ? "text-red-600" : "text-green-600"}`}>
                  {clearStatus}
                </span>
              )}
            </div>
          </div>

          {/* 強制シード */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-2">
              デプロイ後にデータが不足している場合、初期データを強制的に読み込みます。
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={handleForceSeed}
                disabled={isSeeding}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors text-sm"
              >
                {isSeeding ? "シード中..." : "強制シード実行"}
              </button>
              {seedStatus && (
                <span className={`text-sm ${seedStatus.startsWith("エラー") ? "text-red-600" : "text-green-600"}`}>
                  {seedStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
