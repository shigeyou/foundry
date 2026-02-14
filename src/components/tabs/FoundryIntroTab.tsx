"use client";

import Link from "next/link";

export function FoundryIntroTab() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">はじめに</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Foundryの概要と基本的な使い方をご紹介します。
      </p>

      {/* Foundryとは */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-blue-500 rounded"></span>
          Foundryとは
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            <strong>Foundry（ファウンドリー）</strong>は、企業の課題解決をAIで支援するプラットフォームです。
            「鋳造所」の名前が示す通り、様々なAIツールを鋳型（テンプレート）から生成し、
            企業固有のニーズに合わせてカスタマイズできます。
          </p>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            単なるチャットボットではなく、企業の情報（RAGドキュメント、SWOT分析など）を
            ベースにした<strong>文脈を理解したAI</strong>が、実務に即した提案を行います。
          </p>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            ユーザーの採否判断を学習し、回を重ねるごとにより的確な提案ができるようになる
            <strong>学習型AI</strong>を搭載しています。
          </p>
        </div>
      </section>

      {/* 3つのアプリタイプ */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-indigo-500 rounded"></span>
          3つのアプリタイプ
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            Foundryは3種類のAIアプリを提供しています。それぞれ異なるタスクに最適化されています。
          </p>

          <div className="space-y-4">
            {/* ファインダー */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🔍</span>
                <p className="font-bold text-blue-800 dark:text-blue-200">ファインダー型</p>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                データや情報を探索・発見するためのアプリです。
              </p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li>・勝ち筋ファインダー：企業の勝ち筋（戦略）をAIで探索</li>
                <li>・ユースケースに応じて様々なファインダーを構築可能</li>
              </ul>
            </div>

            {/* ドラフター */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">📝</span>
                <p className="font-bold text-emerald-800 dark:text-emerald-200">ドラフター型</p>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-2">
                文書やレポートを自動生成するためのアプリです。
              </p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li>・企業情報を踏まえた提案書・報告書の下書き作成</li>
                <li>・テンプレートに沿った文書生成</li>
              </ul>
            </div>

            {/* シミュレーター */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🔮</span>
                <p className="font-bold text-purple-800 dark:text-purple-200">シミュレーター型</p>
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                シナリオ分析・将来予測を行うためのアプリです。
              </p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li>・What-if分析：仮定条件を変えた場合の影響予測</li>
                <li>・リスクシナリオの洗い出し</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 共通設定について */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-slate-500 rounded"></span>
          共通設定について
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            <strong>共通設定</strong>は全てのアプリで共有される基本情報です。
            一度設定すれば、どのアプリでも同じ情報を参照できます。
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            <Link
              href="/settings?tab=company"
              className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🏢</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">対象企業</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                探索対象となる企業の基本情報（社名、業種、事業内容など）を設定します。
              </p>
            </Link>

            <Link
              href="/settings?tab=rag"
              className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📚</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">RAG情報</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                AIが参照する社内ドキュメント（会社案内、事業計画、パンフレット等）を登録します。
              </p>
            </Link>

            <Link
              href="/settings?tab=swot"
              className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📊</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">SWOT</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                企業のSWOT分析（強み・弱み・機会・脅威）を設定。AIで自動生成も可能です。
              </p>
            </Link>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-500 mt-4">
            ※ 共通設定は管理者が設定し、全ユーザー・全アプリで共有されます
          </p>
        </div>
      </section>

      {/* メタファインダー */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-6 bg-green-500 rounded"></span>
          メタファインダー
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
              🌱
            </div>
            <div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                <strong>メタファインダー</strong>は、社内ドキュメントを分析して「作るべきAIアプリ」の可能性を発見するアドバイザーです。
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                RAGに登録されたドキュメントから、業務課題やAI活用の機会を自動的に特定し、
                Foundryで構築すべきアプリの候補を提案します。
                「何を作れば良いかわからない」という段階から始められます。
              </p>
              <Link
                href="/meta-finder"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors text-sm font-medium"
              >
                メタファインダーを開く
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
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
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">共通設定を行う（管理者）</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  対象企業・RAG情報・SWOTを設定します。これは全アプリで共有される基本情報です。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">アプリを選択</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  ホーム画面から目的に合ったアプリ（ファインダー/ドラフター/シミュレーター）を選びます。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">アプリ内の「はじめに」を確認</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  各アプリには固有の「はじめに」があり、そのアプリの使い方を詳しく説明しています。
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">探索・生成を実行</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  問いを入力してAIに提案を求めます。採否を判断することでAIが学習し、精度が向上します。
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
            AIの活用については、さまざまな立場や意見があります。Foundryは特定の立場を押し付けるものではなく、
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
                <li>・前提が不正確だと結果も不正確に</li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
              <strong>Foundryの基本姿勢：</strong>
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
