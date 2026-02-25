// メタファインダー レポート型定義

export interface ReportIssueItem {
  title: string;
  category: string;
  challenge: string;
  evidence: string;
  severity: "high" | "medium" | "low";
}

export interface ReportSolutionItem {
  title: string;
  challenge: string;
  solution: string;
  description: string;
  actions: string[];
  priority: "immediate" | "short-term" | "mid-term";
  expectedOutcome: string;
}

export interface ReportStrategyItem {
  name: string;
  description: string;
  bscScores: {
    financial: number;
    customer: number;
    process: number;
    growth: number;
  };
  rationale: string;
  keyActions: string[];
  kpi: string;
}

export interface FinancialAssessment {
  fy26OperatingProfit: number;
  fy25OperatingProfit: number;
  yoyChange: number;
  profitStatus: "profit" | "loss" | "na";
  assessment: string;
  keyRisks: string[];
  improvementLevers: string[];
}

export interface ReportSections {
  financialAssessment?: FinancialAssessment;
  executiveSummary: string;
  issues: {
    items: ReportIssueItem[];
    summary: string;
  };
  solutions: {
    items: ReportSolutionItem[];
    summary: string;
  };
  strategies: {
    items: ReportStrategyItem[];
    summary: string;
  };
}

export interface ReportData {
  id: string;
  batchId: string;
  scope: string;
  scopeName: string;
  sections: ReportSections;
  status: string;
  createdAt: string;
}
