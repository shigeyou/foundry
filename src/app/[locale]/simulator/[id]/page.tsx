"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { SimulatorProvider, useSimulator, SimulatorTabType } from "@/contexts/SimulatorContext";
import { SimulatorNavigation } from "@/components/simulator-navigation";
import {
  SimulatorIntroTab,
  PreconditionsTab,
  ScenarioTab,
  SimulationTab,
  AnalysisTab,
  CompareTab,
  ReportTab,
  SimulatorHistoryTab,
} from "@/components/simulator-tabs";

// 共通タブはファインダーと共有
import { CompanyProfileTab } from "@/components/tabs/CompanyProfileTab";
import { RagTab } from "@/components/tabs/RagTab";

const tabComponents: Record<SimulatorTabType, React.FC> = {
  intro: SimulatorIntroTab,
  company: CompanyProfileTab,
  rag: RagTab,
  preconditions: PreconditionsTab,
  scenario: ScenarioTab,
  simulation: SimulationTab,
  analysis: AnalysisTab,
  compare: CompareTab,
  report: ReportTab,
  history: SimulatorHistoryTab,
};

function MainContent({ simulatorId }: { simulatorId: string }) {
  const { activeTab } = useSimulator();
  const t = useTranslations("simulatorDetail");
  const TabComponent = tabComponents[activeTab];

  // シミュレーターIDからタイトルを取得
  const simulatorTitleKeys: Record<string, string> = {
    "investment": "titles.investment",
    "withdrawal": "titles.withdrawal",
    "competitor": "titles.competitor",
  };
  const titleKey = simulatorTitleKeys[simulatorId];
  const title = titleKey ? t(titleKey) : t("titles.fallback");

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <SimulatorNavigation title={title} />
      <TabComponent />
    </main>
  );
}

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function SimulatorPage({ params }: PageProps) {
  const { id } = use(params);

  return (
    <SimulatorProvider initialSimulatorId={id}>
      <MainContent simulatorId={id} />
    </SimulatorProvider>
  );
}
