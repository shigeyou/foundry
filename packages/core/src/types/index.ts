// LLM関連の型
export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMConfig {
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion?: string;
}

// RAG関連の型
export interface RAGSource {
  name: string;
  url: string;
  type?: 'web' | 'pdf';
}

export interface RAGDocument {
  id: string;
  filename: string;
  fileType: string;
  content: string;
  metadata?: string | null;
}

export interface RAGContext {
  sources: RAGSource[];
  documents: RAGDocument[];
  content: string;
}

// ファインダー型の基本構造
export interface FinderConfig {
  id: string;
  name: string;
  description: string;
  evaluationAxes: EvaluationAxis[];
  systemPrompt: string;
  outputFormat: 'scorecard' | 'ranking' | 'matrix';
}

export interface EvaluationAxis {
  id: string;
  name: string;
  description: string;
  weight: number;
  minScore: number;
  maxScore: number;
  scoringGuide: ScoreLevel[];
}

export interface ScoreLevel {
  score: number;
  description: string;
}

// ドラフター型の基本構造
export interface DrafterConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  template: string;
  inputFields: InputField[];
  outputFormat: 'markdown' | 'html' | 'docx';
}

export interface InputField {
  id: string;
  name: string;
  type: 'text' | 'textarea' | 'file' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

// シミュレーター型の基本構造
export interface SimulatorConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  assumptions: AssumptionField[];
  scenarios: ScenarioTemplate[];
  outputFormat: 'comparison' | 'timeline' | 'chart';
}

export interface AssumptionField {
  id: string;
  name: string;
  type: 'number' | 'percentage' | 'select' | 'boolean';
  defaultValue: unknown;
  range?: { min: number; max: number };
  options?: string[];
}

export interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  modifiers: Record<string, unknown>;
}

// メタファインダー関連の型
export interface DiscoveredNeed {
  id: string;
  type: 'finder' | 'drafter' | 'simulator';
  name: string;
  reason: string;
  sourceDocuments: string[];
  priority: number;
  impact: number;
  feasibility: number;
}

export interface MetaFinderResult {
  needs: DiscoveredNeed[];
  thinkingProcess: string;
  generatedAt: Date;
}
