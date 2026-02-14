"use client";

import { use } from "react";
import { DrafterProvider, useDrafter, DrafterTabType } from "@/contexts/DrafterContext";
import { DrafterNavigation } from "@/components/drafter-navigation";
import {
  DrafterIntroTab,
  TemplateTab,
  InputTab,
  MeetingInputTab,
  MeetingWorkflowTab,
  ReportWorkflowTab,
  GenerateTab,
  EditTab,
  OutputTab,
  DrafterHistoryTab,
} from "@/components/drafter-tabs";

// 共通タブはファインダーと共有
import { CompanyProfileTab } from "@/components/tabs/CompanyProfileTab";
import { RagTab } from "@/components/tabs/RagTab";

// 基本タブコンポーネント
const baseTabComponents: Record<DrafterTabType, React.FC> = {
  intro: DrafterIntroTab,
  company: CompanyProfileTab,
  rag: RagTab,
  template: TemplateTab,
  input: InputTab,
  workflow: MeetingWorkflowTab,
  generate: GenerateTab,
  edit: EditTab,
  output: OutputTab,
  history: DrafterHistoryTab,
};

// 議事録用タブコンポーネント（workflowを使用）
const meetingTabComponents: Record<DrafterTabType, React.FC> = {
  ...baseTabComponents,
  input: MeetingInputTab,
  workflow: MeetingWorkflowTab,
};

// 報告書用タブコンポーネント
const reportTabComponents: Record<DrafterTabType, React.FC> = {
  ...baseTabComponents,
  workflow: ReportWorkflowTab,
};

// ドラフターIDからタイトルを取得
const drafterTitles: Record<string, string> = {
  "minutes": "議事録ドラフター",
  "approval-document": "決裁書ドラフター",
  "proposal": "提案書ドラフター",
  "report": "マルチモーダル報告書ドラフター",
};

// 議事録系のドラフターID
const meetingDrafterIds = ["minutes"];

// 報告書系のドラフターID
const reportDrafterIds = ["report"];

function MainContent({ drafterId }: { drafterId: string }) {
  const { activeTab } = useDrafter();
  // ドラフター種別に応じたタブコンポーネントを使用
  const tabComponents = meetingDrafterIds.includes(drafterId)
    ? meetingTabComponents
    : reportDrafterIds.includes(drafterId)
      ? reportTabComponents
      : baseTabComponents;
  const TabComponent = tabComponents[activeTab];
  const title = drafterTitles[drafterId] || "ドラフター";

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <DrafterNavigation title={title} />
      <TabComponent />
    </main>
  );
}

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function DrafterPage({ params }: PageProps) {
  const { id } = use(params);

  return (
    <DrafterProvider initialDrafterId={id}>
      <MainContent drafterId={id} />
    </DrafterProvider>
  );
}
