"use client";

import { AppProvider, useApp, TabType } from "@/contexts/AppContext";
import { Navigation } from "@/components/navigation";
import { SwotTab } from "@/components/tabs/SwotTab";
import { RagTab } from "@/components/tabs/RagTab";
import { ScoreSettingsTab } from "@/components/tabs/ScoreSettingsTab";
import { ExploreTab } from "@/components/tabs/ExploreTab";
import { HistoryTab } from "@/components/tabs/HistoryTab";
import { RankingTab } from "@/components/tabs/RankingTab";
import { StrategiesTab } from "@/components/tabs/StrategiesTab";

const tabComponents: Record<TabType, React.FC> = {
  swot: SwotTab,
  rag: RagTab,
  score: ScoreSettingsTab,
  explore: ExploreTab,
  history: HistoryTab,
  ranking: RankingTab,
  strategies: StrategiesTab,
};

function MainContent() {
  const { activeTab } = useApp();
  const TabComponent = tabComponents[activeTab];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      <TabComponent />
    </main>
  );
}

export default function MainPage() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
