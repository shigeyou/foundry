// 各ドラフターの設定（テンプレート情報、入力フィールド、サンプルデータなど）

export interface DrafterSettings {
  id: string;
  name: string;
  description: string;
  introDescription: string;
  templateLabel: string;  // 「テンプレート」「フォーマット」など
  outputLabel: string;    // 「下書き」「文書」など
}

// ===== 議事録ドラフター =====
const meetingMinutesConfig: DrafterSettings = {
  id: "minutes",
  name: "議事録ドラフター",
  description: "会議の内容から議事録を自動生成するツール",
  templateLabel: "議事録テンプレート",
  outputLabel: "議事録",
  introDescription: `議事録ドラフターは、会議の情報を入力するだけで、整った議事録を自動生成するツールです。
出席者、議題、討議内容、決定事項などを入力すると、AIが標準的なフォーマットで議事録を作成します。
手書きメモや箇条書きからでも、読みやすい文書に仕上げます。`,
};

// ===== 決裁文書ドラフター =====
const approvalDocumentConfig: DrafterSettings = {
  id: "approval-document",
  name: "決裁文書ドラフター",
  description: "稟議書・決裁申請書を自動生成するツール",
  templateLabel: "決裁文書テンプレート",
  outputLabel: "決裁文書",
  introDescription: `決裁文書ドラフターは、稟議書や決裁申請書を効率的に作成するためのツールです。
起案理由、内容詳細、予算、スケジュールなどの情報を入力すると、AIが適切な形式で決裁文書を生成します。
社内の承認プロセスを円滑に進めるための文書作成をサポートします。`,
};

// ===== 提案書ドラフター =====
const proposalConfig: DrafterSettings = {
  id: "proposal",
  name: "提案書ドラフター",
  description: "顧客向け提案書を自動生成するツール",
  templateLabel: "提案書テンプレート",
  outputLabel: "提案書",
  introDescription: `提案書ドラフターは、顧客向けの提案書を効率的に作成するためのツールです。
提案先、プロジェクト名、背景・課題、提案概要などを入力すると、AIが説得力のある提案書を生成します。
RAGデータを活用して、自社の強みや過去の実績を反映した提案が可能です。`,
};

// ===== マルチモーダル報告書ドラフター =====
const reportConfig: DrafterSettings = {
  id: "report",
  name: "マルチモーダル報告書ドラフター",
  description: "画像・文書・音声・表データなど、あらゆる素材を投入するだけで報告書を自動生成",
  templateLabel: "報告書テンプレート",
  outputLabel: "報告書",
  introDescription: `マルチモーダル報告書ドラフターは、画像・PDF・Excel・音声など複数の素材をドロップするだけで、AIが報告書を自動生成するツールです。
画像は内容を読み取って適切な箇所に配置し、音声は自動で文字起こしして統合します。
点検報告、プロジェクト進捗、出張報告など、あらゆる業務報告書の作成を効率化します。`,
};

// ===== 設定マップ =====
export const drafterSettingsMap: Record<string, DrafterSettings> = {
  "minutes": meetingMinutesConfig,
  "approval-document": approvalDocumentConfig,
  "proposal": proposalConfig,
  "report": reportConfig,
};

// デフォルト設定を取得
export function getDrafterSettings(drafterId: string | null): DrafterSettings {
  if (drafterId && drafterSettingsMap[drafterId]) {
    return drafterSettingsMap[drafterId];
  }
  // デフォルトは議事録ドラフター
  return meetingMinutesConfig;
}
