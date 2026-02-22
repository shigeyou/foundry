"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { AppProvider, useApp, TabType } from "@/contexts/AppContext";
import { Navigation } from "@/components/navigation";
import { IntroTab } from "@/components/tabs/IntroTab";
import { CompanyProfileTab } from "@/components/tabs/CompanyProfileTab";
import { SwotTab } from "@/components/tabs/SwotTab";
import { RagTab } from "@/components/tabs/RagTab";
import { ScoreSettingsTab } from "@/components/tabs/ScoreSettingsTab";
import { ExploreTab } from "@/components/tabs/ExploreTab";
import { HistoryTab } from "@/components/tabs/HistoryTab";
import { RankingTab } from "@/components/tabs/RankingTab";
import { StrategiesTab } from "@/components/tabs/StrategiesTab";
import { InsightsTab } from "@/components/tabs/InsightsTab";
import { SummaryTab } from "@/components/tabs/SummaryTab";

const tabComponents: Record<TabType, React.FC> = {
  intro: IntroTab,
  company: CompanyProfileTab,
  swot: SwotTab,
  rag: RagTab,
  score: ScoreSettingsTab,
  explore: ExploreTab,
  history: HistoryTab,
  ranking: RankingTab,
  strategies: StrategiesTab,
  insights: InsightsTab,
  summary: SummaryTab,
};

// ファインダーIDから翻訳キーへのマッピング
const finderTitleKeys: Record<string, string> = {
  "winning-strategy": "titles.winning",
  "defensive-dx": "titles.aiApp",
  "talent": "titles.talent",
};

function MainContent({ finderId }: { finderId: string }) {
  const t = useTranslations("finderDetail");
  const { activeTab } = useApp();
  const TabComponent = tabComponents[activeTab];
  const titleKey = finderTitleKeys[finderId];
  const title = titleKey ? t(titleKey) : t("titles.fallback");

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation title={title} />
      <TabComponent />
    </main>
  );
}

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function FinderPage({ params }: PageProps) {
  const { id } = use(params);

  return (
    <AppProvider initialFinderId={id}>
      <MainContent finderId={id} />
    </AppProvider>
  );
}
