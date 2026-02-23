"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CompanyProfileTab } from "@/components/tabs/CompanyProfileTab";
import { RagTab } from "@/components/tabs/RagTab";
import { SwotTab } from "@/components/tabs/SwotTab";
import { FoundryIntroTab } from "@/components/tabs/FoundryIntroTab";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppProvider } from "@/contexts/AppContext";

type SettingsTabType = "intro" | "company" | "rag" | "swot";

function SettingsContent() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const searchParams = useSearchParams();

  const tabs: { id: SettingsTabType; label: string; icon: string }[] = [
    { id: "intro", label: t("tabs.intro"), icon: "📖" },
    { id: "company", label: t("tabs.company"), icon: "🏢" },
    { id: "rag", label: t("tabs.rag"), icon: "📚" },
    { id: "swot", label: t("tabs.swot"), icon: "📊" },
  ];
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
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    {/* 屋根 */}
                    <path d="M3 11L12 3L21 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    {/* 壁 */}
                    <path d="M5 11V20H19V11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.15)"/>
                    {/* 炎 */}
                    <path d="M12 19C12 19 9 16.2 9 13.8C9 12.25 10.35 11 12 11C13.65 11 15 12.25 15 13.8C15 16.2 12 19 12 19Z" fill="#FF8C42"/>
                    <path d="M12 17.5C12 17.5 10.5 15.8 10.5 14.5C10.5 13.7 11.15 13 12 13C12.85 13 13.5 13.7 13.5 14.5C13.5 15.8 12 17.5 12 17.5Z" fill="#FFD166"/>
                  </svg>
                </span>
                <span className="text-slate-700 dark:text-white text-sm font-medium hidden sm:inline group-hover:-translate-x-0.5 transition-transform">{tc("back")}</span>
              </Link>
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs">{t("allTools")}</p>
                <h1 className="text-lg font-bold text-slate-800 dark:text-white">{t("title")}</h1>
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
    <AppProvider initialFinderId="settings">
      <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-900" />}>
        <SettingsContent />
      </Suspense>
    </AppProvider>
  );
}
