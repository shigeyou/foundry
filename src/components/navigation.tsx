"use client";

import { useApp, TabType } from "@/contexts/AppContext";
import { ThemeToggle } from "@/components/theme-toggle";

interface TabItem {
  id: TabType;
  label: string;
}

const tabItems: TabItem[] = [
  { id: "rag", label: "RAG情報" },
  { id: "swot", label: "SWOT" },
  { id: "score", label: "スコア設定" },
  { id: "explore", label: "勝ち筋探索" },
  { id: "strategies", label: "シン・勝ち筋の探求" },
  { id: "ranking", label: "ランキング" },
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
              勝ち筋ファインダー <span className="text-[1.225rem] font-normal text-slate-500 dark:text-slate-400">Ver.0.5</span>
            </p>
          </button>

          {/* タブナビゲーション */}
          <nav className="flex items-center gap-1">
            {tabItems.map((item) => {
              const isActive = activeTab === item.id;
              const isExploring = item.id === "explore" && explorationStatus === "running";
              const isStrategiesRunning = item.id === "strategies" && (evolveStatus === "running" || autoExploreStatus === "running" || metaAnalysisStatus === "running");
              const showIndicator = isExploring || isStrategiesRunning;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1.5 text-[1.05rem] font-medium rounded-lg transition-colors relative ${
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {item.label}
                  {showIndicator && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                        isStrategiesRunning ? "bg-emerald-400" : "bg-blue-400"
                      } opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${
                        isStrategiesRunning ? "bg-emerald-500" : "bg-blue-500"
                      }`}></span>
                    </span>
                  )}
                </button>
              );
            })}
            <div className="ml-2">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
