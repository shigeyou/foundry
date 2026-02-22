"use client";

import { useApp, TabType } from "@/contexts/AppContext";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface TabItem {
  id: TabType;
  labelKey: string;
}

// ツール固有の導入タブ
const introTab: TabItem = { id: "intro", labelKey: "intro" };

// 個別設定（ユーザーごと）
const personalTabs: TabItem[] = [
  { id: "score", labelKey: "score" },
  { id: "explore", labelKey: "explore" },
  { id: "ranking", labelKey: "ranking" },
  { id: "strategies", labelKey: "strategies" },
  { id: "insights", labelKey: "insights" },
  { id: "summary", labelKey: "summary" },
  { id: "history", labelKey: "history" },
];

// ビューポート幅に基づくフォントサイズを計算（タブが1行に収まるよう調整）
function useResponsiveFontSize() {
  const [fontSizes, setFontSizes] = useState({
    tabFont: "14px",
    labelFont: "11px",
    tabPadding: "6px",
    logoSubtitle: "14px",
    logoTitle: "20px",
    logoVersion: "18px",
  });

  useEffect(() => {
    const calculateFontSizes = () => {
      // ビューポート幅を使用（実際の表示領域）
      const viewportWidth = window.innerWidth;

      // 基準: 1920pxで最大サイズ、1200px以下で最小サイズ
      // タブが1行に収まるよう、より緩やかにスケーリング
      const ratio = Math.min(1, Math.max(0.6, (viewportWidth - 800) / (1920 - 800)));

      // 最小値と最大値を設定
      const tabFont = 11 + ratio * 9;      // 11px ~ 20px
      const labelFont = 9 + ratio * 5;      // 9px ~ 14px
      const tabPadding = 4 + ratio * 6;     // 4px ~ 10px
      const logoSubtitle = 12 + ratio * 8;  // 12px ~ 20px
      const logoTitle = 18 + ratio * 12;    // 18px ~ 30px
      const logoVersion = 16 + ratio * 11;  // 16px ~ 27px

      setFontSizes({
        tabFont: `${tabFont}px`,
        labelFont: `${labelFont}px`,
        tabPadding: `${tabPadding}px`,
        logoSubtitle: `${logoSubtitle}px`,
        logoTitle: `${logoTitle}px`,
        logoVersion: `${logoVersion}px`,
      });
    };

    calculateFontSizes();

    window.addEventListener("resize", calculateFontSizes);
    return () => window.removeEventListener("resize", calculateFontSizes);
  }, []);

  return fontSizes;
}

interface NavigationProps {
  title?: string;
}

export function Navigation({ title }: NavigationProps) {
  const { activeTab, setActiveTab, explorationStatus, evolveStatus, autoExploreStatus, metaAnalysisStatus } = useApp();
  const fontSizes = useResponsiveFontSize();
  const t = useTranslations("finderNav");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const displayTitle = title || tn("finder");

  return (
    <header className="border-b border-blue-300 dark:border-blue-800 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900">
      <div className="w-full px-3">
        <div className="flex items-center justify-between py-2 gap-4">
          {/* Foundryリンク + ロゴ */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group"
            >
              <span className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                {/* 工房アイコン（三角屋根＋煙突＋窯＋炎） */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <defs>
                    <linearGradient id="flameNavOuter" x1="0.5" y1="1" x2="0.5" y2="0">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                    <linearGradient id="flameNavInner" x1="0.5" y1="1" x2="0.5" y2="0">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#f97316" />
                    </linearGradient>
                  </defs>
                  {/* 煙突 */}
                  <rect x="15" y="4" width="4" height="7" rx="0.5" fill="white" opacity="0.3" />
                  <path d="M15 4h4v7h-4V4" strokeLinecap="round" strokeLinejoin="round" />
                  {/* 三角屋根 */}
                  <path d="M3 12l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
                  {/* 建物 */}
                  <rect x="5" y="12" width="14" height="9" fill="white" opacity="0.15" />
                  <path d="M5 12v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
                  {/* 窯（アーチ型開口部） */}
                  <path d="M8 21v-5a4 4 0 0 1 8 0v5" stroke="white" strokeWidth="1.5" fill="rgba(0,0,0,0.3)" />
                  {/* 炎（外側） */}
                  <path d="M10 20.5c0-2.5 1-3.5 2-5 1 1.5 2 2.5 2 5" fill="url(#flameNavOuter)" stroke="none" />
                  {/* 炎（内側・明るい芯） */}
                  <path d="M11 20.5c0-1.5 0.5-2 1-3 0.5 1 1 1.5 1 3" fill="url(#flameNavInner)" stroke="none" />
                </svg>
              </span>
              <span className="text-white text-sm font-medium hidden sm:inline group-hover:-translate-x-0.5 transition-transform">{tc("back")}</span>
            </Link>
            <button
              onClick={() => setActiveTab("explore")}
              className="text-left hover:opacity-80"
            >
              <p className="text-blue-100 dark:text-blue-200 text-xs">
                {tn("finderSubtitle")}
              </p>
              <p className="font-bold text-white dark:text-white text-lg whitespace-nowrap">
                {displayTitle}
              </p>
            </button>
          </div>

          {/* タブナビゲーション */}
          <nav className="flex items-center gap-1 flex-1 justify-end overflow-x-auto flex-nowrap">
            {/* 共通設定へのリンク */}
            <Link
              href="/settings"
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-500/30 dark:bg-slate-700/50 hover:bg-slate-500/50 dark:hover:bg-slate-600/50 rounded-lg transition-colors flex-shrink-0"
              style={{ fontSize: fontSizes.tabFont }}
            >
              <svg className="w-4 h-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-slate-100 whitespace-nowrap">{tn("commonSettings")}</span>
            </Link>

            {/* セパレーター */}
            <div className="h-6 w-px bg-blue-400/50 dark:bg-blue-600 mx-1 flex-shrink-0"></div>

            {/* はじめにタブ */}
            <button
              onClick={() => setActiveTab(introTab.id)}
              className={`py-1 font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === introTab.id
                  ? "bg-white dark:bg-blue-700 text-blue-700 dark:text-white shadow-sm"
                  : "text-blue-100 dark:text-blue-200 hover:bg-white/20 dark:hover:bg-blue-700/50 hover:text-white"
              }`}
              style={{ fontSize: fontSizes.tabFont, paddingLeft: fontSizes.tabPadding, paddingRight: fontSizes.tabPadding }}
            >
              {t(introTab.labelKey)}
            </button>

            {/* セパレーター */}
            <div className="h-6 w-px bg-blue-400/50 dark:bg-blue-600 mx-1 flex-shrink-0"></div>

            {/* 個別設定グループ */}
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-400/30 dark:bg-blue-950/50 rounded-lg flex-shrink-0">
              <span
                className="text-yellow-200 dark:text-yellow-300 px-1 whitespace-nowrap"
                style={{ fontSize: fontSizes.labelFont }}
              >{tn("personal")}</span>
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
                    className={`py-1 font-medium rounded-md transition-colors relative whitespace-nowrap ${
                      isActive
                        ? "bg-white dark:bg-blue-700 text-blue-700 dark:text-white shadow-sm"
                        : "text-blue-100 dark:text-blue-200 hover:bg-white/20 dark:hover:bg-blue-700/50 hover:text-white"
                    }`}
                    style={{ fontSize: fontSizes.tabFont, paddingLeft: fontSizes.tabPadding, paddingRight: fontSizes.tabPadding }}
                  >
                    {t(item.labelKey)}
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

            <div className="ml-2 flex items-center gap-1">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
