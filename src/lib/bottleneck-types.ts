// ボトルネックファインダー 型定義

export type NodeType = "manual" | "automated" | "semi-automated";
export type SeverityLevel = "critical" | "high" | "medium" | "low" | "none";

export interface BottleneckNode {
  id: string;
  label: string;
  type: NodeType;
  description?: string;
  actor?: string;          // 担当者/部門
  tool?: string;           // 使用ツール
  estimatedTime?: string;  // 所要時間
  severity: SeverityLevel;
  automationPotential: number; // 1-5
  issues?: string[];       // 問題点
  suggestions?: string[];  // 改善提案
}

export interface BottleneckEdge {
  from: string;
  to: string;
  label?: string;
  condition?: string; // 条件分岐の条件
}

export interface BottleneckSolution {
  id: string;
  title: string;
  description: string;
  targetNodeIds: string[];
  toolCategory: "RPA" | "API" | "SaaS" | "AI" | "workflow" | "other";
  implementationEffort: "low" | "medium" | "high";
  expectedImpact: "low" | "medium" | "high";
  estimatedCost?: string;
  estimatedTimeline?: string;
  priority: number; // 1-5 (5=highest)
}

export interface PriorityMatrixItem {
  solutionId: string;
  title: string;
  impact: number;  // 1-5
  effort: number;  // 1-5
  quadrant: "quick-win" | "strategic" | "fill-in" | "thankless";
}

export interface BottleneckReportSections {
  executiveSummary: string;
  flowSummary: {
    totalNodes: number;
    manualNodes: number;
    automatedNodes: number;
    semiAutomatedNodes: number;
    automationRate: number; // percentage
  };
  bottlenecks: {
    nodeId: string;
    nodeLabel: string;
    severity: SeverityLevel;
    automationPotential: number;
    issue: string;
    impact: string;
  }[];
  solutions: BottleneckSolution[];
  priorityMatrix: PriorityMatrixItem[];
}

// API response types
export interface BottleneckProjectResponse {
  id: string;
  name: string;
  department?: string | null;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    documents: number;
    flows: number;
    reports: number;
  };
}

export interface AnalysisStatus {
  projectId: string;
  status: "idle" | "extracting-flow" | "analyzing" | "generating-report" | "completed" | "failed";
  progress?: number;
  error?: string;
}
