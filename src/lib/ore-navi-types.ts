export interface LifeValueImpact {
  reward: string;
  freedom: string;
  stress: string;
  meaning: string;
}

export interface Insight {
  id: string;
  title: string;
  content: string;
  why_now: string;
  why_you: string;
  action: string;
  risk: string;
  lifevalue_impact: LifeValueImpact;
}

export interface OreNaviResult {
  insights: Insight[];
  summary: string;
  warning: string;
}

export interface HistoryItem {
  id: string;
  question: string;
  result: OreNaviResult;
  createdAt: string;
}

export interface QueueItem {
  id: string;
  question: string;
  mode?: string;
  status: "pending" | "processing" | "completed" | "error";
  result?: OreNaviResult;
  error?: string;
}

// セクションタイプ（インサイト内のサブセクションも含む）
export type SectionType = string;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
