"use client";

import { useSimulator, SimulatorTabType } from "@/contexts/SimulatorContext";
import Link from "next/link";

interface TabItem {
  id: SimulatorTabType;
  label: string;
}

// ツール固有の導入タブ
const introTab: TabItem = { id: "intro", label: "はじめに" };

// 前提条件設定（シミュレーター固有）
const preconditionsTab: TabItem = { id: "preconditions", label: "前提条件" };

// 個別設定
const personalTabs: TabItem[] = [
  { id: "scenario", label: "シナリオ設定" },
  { id: "simulation", label: "シミュレーション" },
  { id: "analysis", label: "結果分析" },
  { id: "compare", label: "シナリオ比較" },
  { id: "report", label: "レポート" },
  { id: "history", label: "履歴" },
];

interface SimulatorNavigationProps {
  title?: string;
}

export function SimulatorNavigation({ title = "シミュレーター" }: SimulatorNavigationProps) {
  const { activeTab, setActiveTab, simulationStatus } = useSimulator();

  return (
    <header className="border-b border-purple-300 dark:border-purple-800 bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-800 dark:to-purple-900">
      <div className="w-full px-3">
        <div className="flex items-center justify-between py-2 gap-4">
          {/* Foundryリンク + ロゴ */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <span className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="4" width="14" height="12" rx="2" fill="currentColor" opacity="0.2" />
                  <rect x="5" y="4" width="14" height="12" rx="2" strokeLinecap="round" />
                  <circle cx="9" cy="10" r="1.5" fill="currentColor" />
                  <circle cx="15" cy="10" r="1.5" fill="currentColor" />
                  <path d="M12 4V1" strokeLinecap="round" />
                </svg>
              </span>
              <span className="text-white text-sm font-medium hidden sm:inline">Foundry</span>
            </Link>
            <Link
              href="/simulator"
              className="text-left hover:opacity-80"
            >
              <p className="text-purple-100 dark:text-purple-200 text-xs">
                将来の可能性をAIで予測する
              </p>
              <p className="font-bold text-white dark:text-white text-lg whitespace-nowrap">
                {title}
              </p>
            </Link>
          </div>

          {/* タブナビゲーション */}
          <nav className="flex items-center gap-1 flex-1 justify-end overflow-x-auto flex-nowrap">
            {/* 共通設定へのリンク */}
            <Link
              href="/settings"
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-500/30 dark:bg-slate-700/50 hover:bg-slate-500/50 dark:hover:bg-slate-600/50 rounded-lg transition-colors flex-shrink-0 text-sm"
            >
              <svg className="w-4 h-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-slate-100 whitespace-nowrap">共通設定</span>
            </Link>

            {/* セパレーター */}
            <div className="h-6 w-px bg-purple-400/50 dark:bg-purple-600 mx-1 flex-shrink-0"></div>

            {/* はじめにタブ */}
            <button
              onClick={() => setActiveTab(introTab.id)}
              className={`px-2 py-1 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === introTab.id
                  ? "bg-white dark:bg-purple-700 text-purple-700 dark:text-white shadow-sm"
                  : "text-purple-100 dark:text-purple-200 hover:bg-white/20 dark:hover:bg-purple-700/50"
              }`}
            >
              {introTab.label}
            </button>

            {/* 前提条件タブ */}
            <button
              onClick={() => setActiveTab(preconditionsTab.id)}
              className={`px-2 py-1 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === preconditionsTab.id
                  ? "bg-white dark:bg-purple-700 text-purple-700 dark:text-white shadow-sm"
                  : "text-purple-100 dark:text-purple-200 hover:bg-white/20 dark:hover:bg-purple-700/50"
              }`}
            >
              {preconditionsTab.label}
            </button>

            {/* セパレーター */}
            <div className="h-6 w-px bg-purple-400/50 dark:bg-purple-600 mx-1 flex-shrink-0"></div>

            {/* 個別設定グループ */}
            <div className="flex items-center gap-1 px-2 py-1 bg-purple-400/30 dark:bg-purple-950/50 rounded-lg flex-shrink-0">
              <span className="text-yellow-200 dark:text-yellow-300 text-xs px-1 whitespace-nowrap">個人</span>
              {personalTabs.map((item) => {
                const isActive = activeTab === item.id;
                const isRunning = item.id === "simulation" && simulationStatus === "running";

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-2 py-1 text-sm font-medium rounded-md transition-colors relative whitespace-nowrap ${
                      isActive
                        ? "bg-white dark:bg-purple-700 text-purple-700 dark:text-white shadow-sm"
                        : "text-purple-100 dark:text-purple-200 hover:bg-white/20 dark:hover:bg-purple-700/50"
                    }`}
                  >
                    {item.label}
                    {isRunning && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
