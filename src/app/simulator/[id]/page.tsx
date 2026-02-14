"use client";

import { use } from "react";
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

// シミュレーターIDからタイトルを取得
const simulatorTitles: Record<string, string> = {
  "investment": "投資シミュレーター",
  "withdrawal": "撤退シミュレーター",
  "competitor": "競合分析シミュレーター",
};

function MainContent({ simulatorId }: { simulatorId: string }) {
  const { activeTab } = useSimulator();
  const TabComponent = tabComponents[activeTab];
  const title = simulatorTitles[simulatorId] || "シミュレーター";

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
