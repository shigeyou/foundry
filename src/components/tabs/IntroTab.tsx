"use client";

import { useApp } from "@/contexts/AppContext";
import { getFinderSettings } from "@/config/finder-config";

export function IntroTab() {
  const { finderId } = useApp();
  const finderSettings = getFinderSettings(finderId);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">はじめに</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        {finderSettings.name}の概要と基本的な使い方をご紹介します。
      </p>

      {/* アプリの概要 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-blue-500 rounded"></span>
          {finderSettings.name}とは
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          {finderSettings.introDescription.split('\n').map((paragraph, i) => (
            <p key={i} className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4 last:mb-0">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      {/* データの区分 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-green-500 rounded"></span>
          データの区分
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            本アプリのデータは<strong>「共通」</strong>と<strong>「個人」</strong>の2種類に分かれています。
            画面上部のタブも、この区分に応じてグループ化されています。
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {/* 共通設定 */}
            <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg border border-slate-300 dark:border-slate-600">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded">共通</span>
                <p className="font-medium text-slate-800 dark:text-slate-200">全員共通の設定</p>
              </div>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-slate-400">•</span>
                  <span><strong>はじめに</strong> - この説明ページ</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400">•</span>
                  <span><strong>対象企業</strong> - 探索対象の企業情報</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400">•</span>
                  <span><strong>RAG情報</strong> - 参照用ドキュメント</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400">•</span>
                  <span><strong>SWOT</strong> - 企業のSWOT分析</span>
                </li>
              </ul>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-3">
                ※ これらは管理者が設定し、全ユーザーで共有されます
              </p>
            </div>

            {/* 個人設定 */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded">個人</span>
                <p className="font-medium text-slate-800 dark:text-slate-200">ユーザーごとの設定</p>
              </div>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <span><strong>スコア設定</strong> - 評価基準のカスタマイズ</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <span><strong>{finderSettings.exploreLabel}</strong> - 探索の実行</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <span><strong>ランキング</strong> - {finderSettings.resultLabel}の評価・採否</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <span><strong>シン・{finderSettings.resultLabel}の探求</strong> - {finderSettings.resultLabel}の進化</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <span><strong>インサイト</strong> - 学習パターン・メタ分析</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <span><strong>まとめ</strong> - 探索結果の総括レポート</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <span><strong>探索履歴</strong> - 過去の探索結果</span>
                </li>
              </ul>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
                ※ これらはユーザーごとに独立して保存されます
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 基本的な使い方 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-purple-500 rounded"></span>
          基本的な使い方
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
            共通設定は管理者が事前に設定済みです。一般ユーザーは<span className="font-medium text-blue-600 dark:text-blue-400">「個人」タブ</span>から始めてください。
          </p>
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">スコア設定（任意）</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {finderSettings.resultLabel}の評価基準をカスタマイズできます。デフォルト設定でも十分使えます。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">{finderSettings.exploreLabel}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  「問い」を入力して探索を実行すると、AIが複数の{finderSettings.resultLabel}を提案します。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">ランキングで採否判断</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  提案された{finderSettings.resultLabel}を「採用」「却下」で評価。この判断履歴がAIの学習に使われます。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">シン・{finderSettings.resultLabel}の探求</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  採用した{finderSettings.resultLabel}をベースに、AIがさらに進化した{finderSettings.resultLabel}を自動生成します。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">5</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">インサイト</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  採否の履歴から「学習パターン」を抽出し、「メタ分析」で本質的な勝ちパターンを発見します。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">6</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">まとめ</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  全ての探索データをAIが分析し、エグゼクティブサマリー・推奨事項・パターン分析を含む総括レポートを生成。PDF出力も可能です。
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* 管理者向け：共通設定の手順 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-slate-500 rounded"></span>
          管理者向け：共通設定の手順
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
            初回セットアップ時に、管理者が以下の共通設定を行ってください。
          </p>
          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>対象企業</strong> - 探索対象の企業情報（社名、業種、背景など）を設定
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>RAG情報</strong> - 会社案内、事業計画などの参照ドキュメントを登録
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>SWOT</strong> - AI生成または手動でSWOT分析を作成・調整
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


    </div>
  );
}
