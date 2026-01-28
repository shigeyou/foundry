"use client";

import { useApp, TabType } from "@/contexts/AppContext";
import { ThemeToggle } from "@/components/theme-toggle";

interface TabItem {
  id: TabType;
  label: string;
}

// 共通設定（全員共通）
const commonTabs: TabItem[] = [
  { id: "intro", label: "はじめに" },
  { id: "company", label: "対象企業" },
  { id: "rag", label: "RAG情報" },
  { id: "swot", label: "SWOT" },
];

// 個別設定（ユーザーごと）
const personalTabs: TabItem[] = [
  { id: "score", label: "スコア設定" },
  { id: "explore", label: "勝ち筋探索" },
  { id: "ranking", label: "ランキング" },
  { id: "strategies", label: "シン・勝ち筋の探求" },
  { id: "insights", label: "インサイト" },
  { id: "history", label: "探索履歴" },
];

export function Navigation() {
  const { activeTab, setActiveTab, explorationStatus, evolveStatus, autoExploreStatus, metaAnalysisStatus } = useApp();

  return (
    <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-2">
          {/* ロゴ */}
          <button
            onClick={() => setActiveTab("explore")}
            className="text-left hover:opacity-80"
          >
            <p className="text-[0.9rem] text-slate-500 dark:text-slate-400">
              企業の勝ち筋をAIで探索する
            </p>
            <p className="text-[1.35rem] font-bold text-slate-900 dark:text-slate-100">
              勝ち筋ファインダー <span className="text-[1.225rem] font-normal text-slate-500 dark:text-slate-400">Ver.0.6</span>
            </p>
          </button>

          {/* タブナビゲーション */}
          <nav className="flex items-center gap-1 overflow-x-auto max-w-[60vw] md:max-w-none scrollbar-hide">
            {/* 共通設定グループ */}
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
              <span className="text-[0.65rem] text-slate-500 dark:text-slate-400 px-1 whitespace-nowrap">共通</span>
              {commonTabs.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-2.5 py-1 text-[0.9rem] font-medium rounded-md transition-colors relative ${
                      isActive
                        ? "bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-600/50 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* セパレーター */}
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>

            {/* 個別設定グループ */}
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <span className="text-[0.65rem] text-blue-600 dark:text-blue-400 px-1 whitespace-nowrap">個人</span>
              {personalTabs.map((item) => {
                const isActive = activeTab === item.id;
                const isExploring = item.id === "explore" && explorationStatus === "running";
                const isStrategiesRunning = item.id === "strategies" && (evolveStatus === "running" || autoExploreStatus === "running");
                const isInsightsRunning = item.id === "insights" && metaAnalysisStatus === "running";
                const showIndicator = isExploring || isStrategiesRunning || isInsightsRunning;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-2.5 py-1 text-[0.9rem] font-medium rounded-md transition-colors relative ${
                      isActive
                        ? "bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:bg-blue-100/50 dark:hover:bg-blue-800/50 hover:text-blue-700 dark:hover:text-blue-200"
                    }`}
                  >
                    {item.label}
                    {showIndicator && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                          isStrategiesRunning ? "bg-emerald-400" : isInsightsRunning ? "bg-purple-400" : "bg-blue-400"
                        } opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${
                          isStrategiesRunning ? "bg-emerald-500" : isInsightsRunning ? "bg-purple-500" : "bg-blue-500"
                        }`}></span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="ml-2">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
