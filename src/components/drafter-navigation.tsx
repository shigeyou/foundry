"use client";

import { useDrafter, DrafterTabType } from "@/contexts/DrafterContext";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";

interface TabItem {
  id: DrafterTabType;
  labelKey: string;
}

// ツール固有の導入タブ
const introTab: TabItem = { id: "intro", labelKey: "intro" };

// テンプレート設定（ドラフター固有）
const templateTab: TabItem = { id: "template", labelKey: "template" };

// 議事録ドラフター用タブ（統合ワークフロー）
const minutesTabs: TabItem[] = [
  { id: "workflow", labelKey: "minutesWorkflow" },
];

// 報告書ドラフター用タブ（統合ワークフロー）
const reportTabs: TabItem[] = [
  { id: "workflow", labelKey: "reportWorkflow" },
];

// その他のドラフター用タブ（従来フロー）
const defaultPersonalTabs: TabItem[] = [
  { id: "input", labelKey: "input" },
  { id: "generate", labelKey: "generate" },
  { id: "edit", labelKey: "edit" },
  { id: "output", labelKey: "output" },
];

interface DrafterNavigationProps {
  title?: string;
}

export function DrafterNavigation({ title }: DrafterNavigationProps) {
  const { activeTab, setActiveTab, generateStatus, drafterId } = useDrafter();
  const t = useTranslations("drafterNav");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const displayTitle = title || tn("drafter");

  const isMinutesDrafter = drafterId === "minutes";
  const isReportDrafter = drafterId === "report";
  const isWorkflowDrafter = isMinutesDrafter || isReportDrafter;
  const workflowTabs = isReportDrafter ? reportTabs : minutesTabs;

  return (
    <header className="border-b border-green-300 dark:border-green-800 bg-gradient-to-r from-green-600 to-green-700 dark:from-green-800 dark:to-green-900">
      <div className="w-full px-3">
        <div className="flex items-center justify-between py-2 gap-4">
          {/* Foundryリンク + ロゴ */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <span className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M3 11L12 3L21 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 11V20H19V11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.15)"/>
                  <path d="M12 19C12 19 9 16.2 9 13.8C9 12.25 10.35 11 12 11C13.65 11 15 12.25 15 13.8C15 16.2 12 19 12 19Z" fill="#FF8C42"/>
                  <path d="M12 17.5C12 17.5 10.5 15.8 10.5 14.5C10.5 13.7 11.15 13 12 13C12.85 13 13.5 13.7 13.5 14.5C13.5 15.8 12 17.5 12 17.5Z" fill="#FFD166"/>
                </svg>
              </span>
              <span className="text-white text-sm font-medium hidden sm:inline">Foundry</span>
            </Link>
            <Link
              href="/drafter"
              className="text-left hover:opacity-80"
            >
              <p className="text-green-100 dark:text-green-200 text-xs">
                {tn("drafterSubtitle")}
              </p>
              <p className="font-bold text-white dark:text-white text-lg whitespace-nowrap">
                {displayTitle}
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
              <span className="text-slate-100 whitespace-nowrap">{tn("commonSettings")}</span>
            </Link>

            {/* セパレーター */}
            <div className="h-6 w-px bg-green-400/50 dark:bg-green-600 mx-1 flex-shrink-0"></div>

            {isWorkflowDrafter ? (
              /* 議事録/報告書ドラフター: シンプルなタブ構成 */
              <div className="flex items-center gap-1">
                {workflowTabs.map((item) => {
                  const isActive = activeTab === item.id;
                  const isGenerating = item.id === "workflow" && generateStatus === "running";

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors relative whitespace-nowrap ${
                        isActive
                          ? "bg-white dark:bg-green-700 text-green-700 dark:text-white shadow-sm"
                          : "text-green-100 dark:text-green-200 hover:bg-white/20 dark:hover:bg-green-700/50"
                      }`}
                    >
                      {t(item.labelKey)}
                      {isGenerating && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* その他のドラフター: 従来のタブ構成 */
              <>
                {/* はじめにタブ */}
                <button
                  onClick={() => setActiveTab(introTab.id)}
                  className={`px-2 py-1 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeTab === introTab.id
                      ? "bg-white dark:bg-green-700 text-green-700 dark:text-white shadow-sm"
                      : "text-green-100 dark:text-green-200 hover:bg-white/20 dark:hover:bg-green-700/50"
                  }`}
                >
                  {t(introTab.labelKey)}
                </button>

                {/* テンプレートタブ */}
                <button
                  onClick={() => setActiveTab(templateTab.id)}
                  className={`px-2 py-1 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeTab === templateTab.id
                      ? "bg-white dark:bg-green-700 text-green-700 dark:text-white shadow-sm"
                      : "text-green-100 dark:text-green-200 hover:bg-white/20 dark:hover:bg-green-700/50"
                  }`}
                >
                  {t(templateTab.labelKey)}
                </button>

                {/* セパレーター */}
                <div className="h-6 w-px bg-green-400/50 dark:bg-green-600 mx-1 flex-shrink-0"></div>

                {/* 個別設定グループ */}
                <div className="flex items-center gap-1 px-2 py-1 bg-green-400/30 dark:bg-green-950/50 rounded-lg flex-shrink-0">
                  <span className="text-yellow-200 dark:text-yellow-300 text-xs px-1 whitespace-nowrap">{tn("personal")}</span>
                  {defaultPersonalTabs.map((item) => {
                    const isActive = activeTab === item.id;
                    const isGenerating = item.id === "generate" && generateStatus === "running";

                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`px-2 py-1 text-sm font-medium rounded-md transition-colors relative whitespace-nowrap ${
                          isActive
                            ? "bg-white dark:bg-green-700 text-green-700 dark:text-white shadow-sm"
                            : "text-green-100 dark:text-green-200 hover:bg-white/20 dark:hover:bg-green-700/50"
                        }`}
                      >
                        {t(item.labelKey)}
                        {isGenerating && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
