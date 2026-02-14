"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CompanyProfileTab } from "@/components/tabs/CompanyProfileTab";
import { RagTab } from "@/components/tabs/RagTab";
import { SwotTab } from "@/components/tabs/SwotTab";
import { FoundryIntroTab } from "@/components/tabs/FoundryIntroTab";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppProvider } from "@/contexts/AppContext";

type SettingsTabType = "intro" | "company" | "rag" | "swot";

const tabs: { id: SettingsTabType; label: string; icon: string }[] = [
  { id: "intro", label: "はじめに", icon: "📖" },
  { id: "company", label: "対象企業", icon: "🏢" },
  { id: "rag", label: "RAG情報", icon: "📚" },
  { id: "swot", label: "SWOT", icon: "📊" },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as SettingsTabType | null;
  const validTabs = ["intro", "company", "rag", "swot"];
  const initialTab = tabParam && validTabs.includes(tabParam) ? tabParam : "intro";
  const [activeTab, setActiveTab] = useState<SettingsTabType>(initialTab);

  // Update tab when URL parameter changes
  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const renderTab = () => {
    switch (activeTab) {
      case "intro":
        return <FoundryIntroTab />;
      case "company":
        return <CompanyProfileTab />;
      case "rag":
        return <RagTab />;
      case "swot":
        return <SwotTab />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 sticky top-0 z-10 shadow-lg border-b border-slate-200 dark:border-slate-700">
        <div className="w-full px-3">
          <div className="flex items-center justify-between py-2 gap-4">
            {/* Left: Home link + Title */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-200/60 hover:bg-slate-300/60 dark:bg-slate-700/50 dark:hover:bg-slate-600/50 rounded-lg transition-colors group"
              >
                <span className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  {/* 工房アイコン（三角屋根＋煙突） */}
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {/* 煙突 */}
                    <rect x="15" y="4" width="4" height="7" rx="0.5" fill="currentColor" opacity="0.3" />
                    <path d="M15 4h4v7h-4V4" strokeLinecap="round" strokeLinejoin="round" />
                    {/* 三角屋根 */}
                    <path d="M3 12l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
                    {/* 建物 */}
                    <rect x="5" y="12" width="14" height="9" fill="currentColor" opacity="0.2" />
                    <path d="M5 12v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
                    {/* ドア */}
                    <rect x="10" y="15" width="4" height="6" rx="0.5" fill="currentColor" opacity="0.4" />
                  </svg>
                </span>
                <span className="text-slate-700 dark:text-white text-sm font-medium hidden sm:inline group-hover:-translate-x-0.5 transition-transform">← 戻る</span>
              </Link>
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs">全ツール共通</p>
                <h1 className="text-lg font-bold text-slate-800 dark:text-white">共通設定</h1>
              </div>
            </div>

            {/* Right: Tab Navigation + Theme toggle */}
            <nav className="flex items-center gap-1 flex-1 justify-end">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-white dark:bg-slate-700 text-slate-700 dark:text-white shadow-md"
                      : "bg-slate-200/60 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-slate-600/50"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
              <div className="ml-2">
                <ThemeToggle />
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto">
        {renderTab()}
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppProvider finderId="settings">
      <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-900" />}>
        <SettingsContent />
      </Suspense>
    </AppProvider>
  );
}
