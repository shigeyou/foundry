"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import type { FinderConfig } from "@foundry/core/types";

// ===== 型定義 =====

export interface EvaluationAxis {
  id: string;
  name: string;
  description: string;
  weight: number;
  minScore: number;
  maxScore: number;
  scoringGuide: { score: number; description: string }[];
}

export interface PresetQuestion {
  id: string;
  label: string;
  question: string;
}

export interface Strategy {
  name: string;
  reason: string;
  howToObtain?: string;
  metrics?: string;
  confidence?: number;
  totalScore: number;
  scores?: Record<string, number>;
  judgment?: string;
  tags?: string[];
}

export interface ExplorationResult {
  id: string;
  question: string;
  strategies: Strategy[];
  thinking?: string;
}

export type ExplorationStatus = "idle" | "running" | "completed" | "failed";

export type EvolveMode = "mutation" | "crossover" | "refutation" | "all";

export interface EvolvedStrategy {
  name: string;
  reason: string;
  howToObtain: string;
  metrics: string;
  sourceStrategies: string[];
  evolveType: "mutation" | "crossover" | "refutation";
  improvement: string;
  totalScore?: number;
}

export interface EvolveResult {
  strategies: EvolvedStrategy[];
  thinkingProcess: string;
  sourceCount: number;
  archivedCount?: number;
}

export interface AutoExploreResult {
  questionsGenerated: number;
  explorationsCompleted: number;
  highScoresFound: number;
  topScore: number;
  topStrategy: string | null;
  errors: string[];
  runId?: string;
  improvement?: string | null;
  duration?: string;
  timestamp?: string;
}

export interface MetaAnalysisResult {
  summary: {
    totalExplorations: number;
    totalStrategies: number;
    metaStrategiesCount: number;
    clusterCount: number;
  };
  topStrategies: { name: string; count: number }[];
  clusters: { name: string; strategies: string[] }[];
  frequentTags: { tag: string; count: number }[];
  blindSpots: string[];
  thinkingProcess: string;
}

export interface SummaryContent {
  executiveSummary: string;
  keyFindings: string[];
  topRecommendations: {
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }[];
  patterns: {
    strengths: string[];
    opportunities: string[];
    risks: string[];
  };
  nextSteps: string[];
}

export interface SummaryResult {
  id: string;
  content: SummaryContent;
  stats: {
    explorationCount: number;
    topStrategiesCount: number;
    adoptedCount: number;
    rejectedCount: number;
  };
  createdAt: string;
}

export interface PatternExtractResult {
  extracted: number;
  saved: number;
  updated: number;
}

// ===== Context 型 =====
interface FinderContextType {
  // ファインダー設定
  finderId: string;
  finderConfig: FinderConfig | null;
  finderLoading: boolean;
  finderError: string | null;

  // 評価軸と重み
  evaluationAxes: EvaluationAxis[];
  weights: Record<string, number>;
  setWeights: (weights: Record<string, number>) => void;
  adjustWeight: (axisId: string, newValue: number) => void;

  // プリセット質問
  presetQuestions: PresetQuestion[];

  // 探索入力
  exploreQuestion: string;
  setExploreQuestion: (q: string) => void;
  exploreAdditionalContext: string;
  setExploreAdditionalContext: (c: string) => void;
  exploreSelectedPresets: Set<number>;
  setExploreSelectedPresets: (p: Set<number>) => void;

  // 探索
  explorationStatus: ExplorationStatus;
  explorationId: string | null;
  explorationProgress: number;
  explorationResult: ExplorationResult | null;
  explorationError: string | null;
  startExploration: (question: string, context: string) => Promise<void>;
  clearExplorationResult: () => void;

  // 進化生成
  evolveStatus: ExplorationStatus;
  evolveProgress: number;
  evolveResult: EvolveResult | null;
  evolveError: string | null;
  startEvolve: (mode: EvolveMode) => Promise<void>;
  clearEvolveResult: () => void;

  // AI自動探索
  autoExploreStatus: ExplorationStatus;
  autoExploreProgress: number;
  autoExploreResult: AutoExploreResult | null;
  autoExploreError: string | null;
  startAutoExplore: () => Promise<void>;
  clearAutoExploreResult: () => void;

  // メタ分析
  metaAnalysisStatus: ExplorationStatus;
  metaAnalysisProgress: number;
  metaAnalysisResult: MetaAnalysisResult | null;
  metaAnalysisError: string | null;
  startMetaAnalysis: () => Promise<void>;
  clearMetaAnalysisResult: () => void;

  // パターン抽出
  patternExtractStatus: ExplorationStatus;
  patternExtractProgress: number;
  patternExtractResult: PatternExtractResult | null;
  patternExtractError: string | null;
  startPatternExtract: () => Promise<void>;
  clearPatternExtractResult: () => void;

  // まとめ
  summaryStatus: ExplorationStatus;
  summaryProgress: number;
  summaryResult: SummaryResult | null;
  summaryError: string | null;
  startSummary: () => Promise<void>;
  clearSummaryResult: () => void;

  // プリセット質問生成
  presetQuestionsStatus: ExplorationStatus;
  presetQuestionsProgress: number;
  generatePresetQuestions: () => Promise<void>;

  // ユーティリティ
  calculateWeightedScore: (scores: Record<string, number>) => number;
  getScoreLabel: (axisId: string) => string;
}

const FinderContext = createContext<FinderContextType | undefined>(undefined);

// ===== Provider Props =====
interface FinderProviderProps {
  children: ReactNode;
  finderId: string;
}

// ===== Provider =====
export function FinderProvider({ children, finderId }: FinderProviderProps) {
  // ファインダー設定
  const [finderConfig, setFinderConfig] = useState<FinderConfig | null>(null);
  const [finderLoading, setFinderLoading] = useState(true);
  const [finderError, setFinderError] = useState<string | null>(null);

  // 評価軸と重み
  const [evaluationAxes, setEvaluationAxes] = useState<EvaluationAxis[]>([]);
  const [weights, setWeightsState] = useState<Record<string, number>>({});

  // プリセット質問
  const [presetQuestions, setPresetQuestions] = useState<PresetQuestion[]>([]);

  // 探索入力
  const [exploreQuestion, setExploreQuestion] = useState("");
  const [exploreAdditionalContext, setExploreAdditionalContext] = useState("");
  const [exploreSelectedPresets, setExploreSelectedPresets] = useState<Set<number>>(new Set());

  // 探索
  const [explorationStatus, setExplorationStatus] = useState<ExplorationStatus>("idle");
  const [explorationId, setExplorationId] = useState<string | null>(null);
  const [explorationProgress, setExplorationProgress] = useState(0);
  const [explorationResult, setExplorationResult] = useState<ExplorationResult | null>(null);
  const [explorationError, setExplorationError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const explorationStartTimeRef = useRef<number>(0);
  const explorationProgressRef = useRef<NodeJS.Timeout | null>(null);
  const explorationMaxProgressRef = useRef<number>(0);

  // 進化生成
  const [evolveStatus, setEvolveStatus] = useState<ExplorationStatus>("idle");
  const [evolveProgress, setEvolveProgress] = useState(0);
  const [evolveResult, setEvolveResult] = useState<EvolveResult | null>(null);
  const [evolveError, setEvolveError] = useState<string | null>(null);
  const evolveProgressRef = useRef<NodeJS.Timeout | null>(null);
  const evolveStartTimeRef = useRef<number>(0);
  const evolveMaxProgressRef = useRef<number>(0);

  // AI自動探索
  const [autoExploreStatus, setAutoExploreStatus] = useState<ExplorationStatus>("idle");
  const [autoExploreProgress, setAutoExploreProgress] = useState(0);
  const [autoExploreResult, setAutoExploreResult] = useState<AutoExploreResult | null>(null);
  const [autoExploreError, setAutoExploreError] = useState<string | null>(null);
  const autoExploreProgressRef = useRef<NodeJS.Timeout | null>(null);
  const autoExploreStartTimeRef = useRef<number>(0);
  const autoExploreMaxProgressRef = useRef<number>(0);

  // メタ分析
  const [metaAnalysisStatus, setMetaAnalysisStatus] = useState<ExplorationStatus>("idle");
  const [metaAnalysisProgress, setMetaAnalysisProgress] = useState(0);
  const [metaAnalysisResult, setMetaAnalysisResult] = useState<MetaAnalysisResult | null>(null);
  const [metaAnalysisError, setMetaAnalysisError] = useState<string | null>(null);
  const metaAnalysisProgressRef = useRef<NodeJS.Timeout | null>(null);
  const metaAnalysisStartTimeRef = useRef<number>(0);
  const metaAnalysisMaxProgressRef = useRef<number>(0);

  // パターン抽出
  const [patternExtractStatus, setPatternExtractStatus] = useState<ExplorationStatus>("idle");
  const [patternExtractProgress, setPatternExtractProgress] = useState(0);
  const [patternExtractResult, setPatternExtractResult] = useState<PatternExtractResult | null>(null);
  const [patternExtractError, setPatternExtractError] = useState<string | null>(null);
  const patternExtractProgressRef = useRef<NodeJS.Timeout | null>(null);
  const patternExtractStartTimeRef = useRef<number>(0);
  const patternExtractMaxProgressRef = useRef<number>(0);

  // まとめ
  const [summaryStatus, setSummaryStatus] = useState<ExplorationStatus>("idle");
  const [summaryProgress, setSummaryProgress] = useState(0);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summaryProgressRef = useRef<NodeJS.Timeout | null>(null);
  const summaryStartTimeRef = useRef<number>(0);
  const summaryMaxProgressRef = useRef<number>(0);

  // プリセット質問生成
  const [presetQuestionsStatus, setPresetQuestionsStatus] = useState<ExplorationStatus>("idle");
  const [presetQuestionsProgress, setPresetQuestionsProgress] = useState(0);
  const presetQuestionsProgressRef = useRef<NodeJS.Timeout | null>(null);
  const presetQuestionsStartTimeRef = useRef<number>(0);
  const presetQuestionsMaxProgressRef = useRef<number>(0);

  // ===== ユーティリティ関数 =====

  // 完了時に100%までアニメーションさせる関数
  const animateToComplete = useCallback((
    currentProgress: number,
    setProgress: (p: number) => void,
    onComplete: () => void,
    duration: number = 1500
  ) => {
    const startProgress = currentProgress;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const newProgress = startProgress + (100 - startProgress) * eased;

      setProgress(Math.min(newProgress, 100));

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setProgress(100);
        setTimeout(onComplete, 300);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  // イージング関数: 前半ゆっくり→後半尻上がりに加速→97%まで自然に到達
  const calculateEasedProgress = useCallback((startTime: number, expectedDuration: number): number => {
    const elapsed = Date.now() - startTime;
    const t = elapsed / expectedDuration;

    let progress: number;

    if (t <= 1.0) {
      // easeInCubic (t³): 前半ゆっくり、後半急加速で0→92%
      progress = t * t * t * 92;
    } else {
      // 時間超過: 92%→97%を漸近的に
      const overtime = t - 1.0;
      progress = 92 + 5 * (1 - Math.exp(-overtime * 0.8));
    }

    return Math.min(progress, 97);
  }, []);

  // ===== ファインダー設定の読み込み =====
  useEffect(() => {
    async function loadFinderConfig() {
      setFinderLoading(true);
      setFinderError(null);

      try {
        const res = await fetch(`/api/tools/finder/${finderId}`);
        if (!res.ok) {
          throw new Error("ファインダーの設定が見つかりませんでした");
        }
        const data = await res.json();
        const config = data.config as FinderConfig & { presetQuestions?: PresetQuestion[] };

        setFinderConfig(config);
        setEvaluationAxes(config.evaluationAxes || []);
        setPresetQuestions(config.presetQuestions || []);

        // 重みを初期化（設定ファイルのweightを使用）
        const initialWeights: Record<string, number> = {};
        (config.evaluationAxes || []).forEach((axis: EvaluationAxis) => {
          initialWeights[axis.id] = axis.weight * 100; // 0-1 を 0-100 に変換
        });

        // ローカルストレージから保存された重みを読み込み
        const savedWeights = localStorage.getItem(`finder-weights-${finderId}`);
        if (savedWeights) {
          const parsed = JSON.parse(savedWeights);
          Object.keys(parsed).forEach((key) => {
            if (key in initialWeights) {
              initialWeights[key] = parsed[key];
            }
          });
        }

        setWeightsState(initialWeights);
      } catch (err) {
        setFinderError(err instanceof Error ? err.message : "設定の読み込みに失敗しました");
      } finally {
        setFinderLoading(false);
      }
    }

    loadFinderConfig();
  }, [finderId]);

  // ===== 重み設定 =====
  const setWeights = useCallback((newWeights: Record<string, number>) => {
    setWeightsState(newWeights);
    localStorage.setItem(`finder-weights-${finderId}`, JSON.stringify(newWeights));
  }, [finderId]);

  const adjustWeight = useCallback((axisId: string, newValue: number) => {
    setWeightsState((prev) => {
      const clampedValue = Math.max(0, Math.min(100, newValue));
      const newWeights = { ...prev, [axisId]: clampedValue };
      localStorage.setItem(`finder-weights-${finderId}`, JSON.stringify(newWeights));
      return newWeights;
    });
  }, [finderId]);

  // ===== スコア計算 =====
  const calculateWeightedScore = useCallback(
    (scores: Record<string, number>) => {
      const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
      if (totalWeight === 0) return 0;

      let weightedSum = 0;
      Object.keys(weights).forEach((axisId) => {
        weightedSum += (scores[axisId] || 0) * weights[axisId];
      });

      return weightedSum / totalWeight;
    },
    [weights]
  );

  const getScoreLabel = useCallback(
    (axisId: string) => {
      const axis = evaluationAxes.find((a) => a.id === axisId);
      return axis?.name || axisId;
    },
    [evaluationAxes]
  );

  // ===== 探索 =====
  const pollExplorationStatus = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/explore?id=${id}`);
        const data = await res.json();

        if (data.status === "completed" && data.result) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (explorationProgressRef.current) {
            clearInterval(explorationProgressRef.current);
            explorationProgressRef.current = null;
          }

          const parsed = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
          const strategiesWithScore = (parsed.strategies || [])
            .map((s: Strategy) => ({
              ...s,
              totalScore: s.scores ? calculateWeightedScore(s.scores) : 0,
            }))
            .sort((a: Strategy, b: Strategy) => b.totalScore - a.totalScore);

          const result = {
            id: data.id,
            question: data.question,
            strategies: strategiesWithScore,
            thinking: parsed.thinkingProcess,
          };

          animateToComplete(explorationMaxProgressRef.current, setExplorationProgress, () => {
            setExplorationResult(result);
            setExplorationStatus("completed");
          });
        } else if (data.status === "failed") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (explorationProgressRef.current) {
            clearInterval(explorationProgressRef.current);
            explorationProgressRef.current = null;
          }
          setExplorationError(data.error || "探索に失敗しました");
          setExplorationStatus("failed");
          setExplorationProgress(0);
        } else {
          const newProgress = calculateEasedProgress(explorationStartTimeRef.current, 450000);
          explorationMaxProgressRef.current = Math.max(explorationMaxProgressRef.current, newProgress);
          setExplorationProgress(explorationMaxProgressRef.current);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    },
    [calculateWeightedScore, calculateEasedProgress, animateToComplete]
  );

  const startExploration = async (question: string, context: string) => {
    if (!question.trim()) return;

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (explorationProgressRef.current) {
      clearInterval(explorationProgressRef.current);
      explorationProgressRef.current = null;
    }

    explorationStartTimeRef.current = Date.now();

    setExplorationStatus("running");
    setExplorationProgress(0);
    explorationMaxProgressRef.current = 0;
    setExplorationResult(null);
    setExplorationError(null);

    try {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          context,
          constraints: [],
          background: true,
          finderId, // ファインダーIDを渡す
        }),
      });

      const data = await res.json();

      if (data.id) {
        setExplorationId(data.id);

        explorationProgressRef.current = setInterval(() => {
          const newProgress = calculateEasedProgress(explorationStartTimeRef.current, 90000);
          explorationMaxProgressRef.current = Math.max(explorationMaxProgressRef.current, newProgress);
          setExplorationProgress(explorationMaxProgressRef.current);
        }, 500);

        pollingRef.current = setInterval(() => {
          pollExplorationStatus(data.id);
        }, 3000);
        pollExplorationStatus(data.id);
      } else if (data.strategies) {
        const strategiesWithScore = data.strategies
          .map((s: Strategy) => ({
            ...s,
            totalScore: s.scores ? calculateWeightedScore(s.scores) : 0,
          }))
          .sort((a: Strategy, b: Strategy) => b.totalScore - a.totalScore);

        setExplorationResult({
          id: Date.now().toString(),
          question: question.trim(),
          strategies: strategiesWithScore,
          thinking: data.thinkingProcess,
        });
        setExplorationStatus("completed");
        setExplorationProgress(100);
      } else if (data.error) {
        setExplorationError(data.error);
        setExplorationStatus("failed");
      }
    } catch (error) {
      console.error("Exploration failed:", error);
      setExplorationError("探索に失敗しました");
      setExplorationStatus("failed");
    }
  };

  const clearExplorationResult = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (explorationProgressRef.current) {
      clearInterval(explorationProgressRef.current);
      explorationProgressRef.current = null;
    }
    setExplorationStatus("idle");
    setExplorationId(null);
    setExplorationProgress(0);
    setExplorationResult(null);
    setExplorationError(null);
  };

  // ===== 進化生成 =====
  const startEvolve = async (mode: EvolveMode) => {
    if (evolveProgressRef.current) {
      clearInterval(evolveProgressRef.current);
      evolveProgressRef.current = null;
    }

    evolveStartTimeRef.current = Date.now();

    setEvolveStatus("running");
    setEvolveProgress(0);
    evolveMaxProgressRef.current = 0;
    setEvolveResult(null);
    setEvolveError(null);

    evolveProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(evolveStartTimeRef.current, 300000);
      evolveMaxProgressRef.current = Math.max(evolveMaxProgressRef.current, newProgress);
      setEvolveProgress(evolveMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch("/api/evolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, save: true, finderId }),
      });

      if (evolveProgressRef.current) {
        clearInterval(evolveProgressRef.current);
        evolveProgressRef.current = null;
      }

      const data = await res.json();

      if (!res.ok) {
        setEvolveError(data.error || "進化生成に失敗しました");
        setEvolveStatus("failed");
        setEvolveProgress(0);
      } else {
        const result = {
          strategies: data.strategies || [],
          thinkingProcess: data.thinkingProcess || "",
          sourceCount: data.sourceCount || 0,
          archivedCount: data.archivedCount,
        };

        animateToComplete(evolveMaxProgressRef.current, setEvolveProgress, () => {
          setEvolveResult(result);
          setEvolveStatus("completed");
        });
      }
    } catch (error) {
      console.error("Evolve failed:", error);
      if (evolveProgressRef.current) {
        clearInterval(evolveProgressRef.current);
        evolveProgressRef.current = null;
      }
      setEvolveError("進化生成に失敗しました");
      setEvolveStatus("failed");
      setEvolveProgress(0);
    }
  };

  const clearEvolveResult = () => {
    if (evolveProgressRef.current) {
      clearInterval(evolveProgressRef.current);
      evolveProgressRef.current = null;
    }
    setEvolveStatus("idle");
    setEvolveProgress(0);
    setEvolveResult(null);
    setEvolveError(null);
  };

  // ===== AI自動探索 =====
  const startAutoExplore = async () => {
    if (autoExploreProgressRef.current) {
      clearInterval(autoExploreProgressRef.current);
      autoExploreProgressRef.current = null;
    }

    autoExploreStartTimeRef.current = Date.now();

    setAutoExploreStatus("running");
    setAutoExploreProgress(0);
    autoExploreMaxProgressRef.current = 0;
    setAutoExploreResult(null);
    setAutoExploreError(null);

    autoExploreProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(autoExploreStartTimeRef.current, 600000);
      autoExploreMaxProgressRef.current = Math.max(autoExploreMaxProgressRef.current, newProgress);
      setAutoExploreProgress(autoExploreMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch("/api/auto-explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finderId }),
      });

      if (autoExploreProgressRef.current) {
        clearInterval(autoExploreProgressRef.current);
        autoExploreProgressRef.current = null;
      }

      const data = await res.json();

      if (!res.ok) {
        setAutoExploreError(data.error || "自動探索に失敗しました");
        setAutoExploreStatus("failed");
        setAutoExploreProgress(0);
      } else {
        const result = {
          questionsGenerated: data.questionsGenerated || 0,
          explorationsCompleted: data.explorationsCompleted || 0,
          highScoresFound: data.highScoresFound || 0,
          topScore: data.topScore || 0,
          topStrategy: data.topStrategy || null,
          errors: data.errors || [],
          runId: data.runId,
          improvement: data.improvement,
          duration: data.duration,
          timestamp: data.timestamp || new Date().toISOString(),
        };

        animateToComplete(autoExploreMaxProgressRef.current, setAutoExploreProgress, () => {
          setAutoExploreResult(result);
          setAutoExploreStatus("completed");
        });
      }
    } catch (error) {
      console.error("Auto-explore failed:", error);
      if (autoExploreProgressRef.current) {
        clearInterval(autoExploreProgressRef.current);
        autoExploreProgressRef.current = null;
      }
      setAutoExploreError("自動探索に失敗しました");
      setAutoExploreStatus("failed");
      setAutoExploreProgress(0);
    }
  };

  const clearAutoExploreResult = () => {
    if (autoExploreProgressRef.current) {
      clearInterval(autoExploreProgressRef.current);
      autoExploreProgressRef.current = null;
    }
    setAutoExploreStatus("idle");
    setAutoExploreProgress(0);
    setAutoExploreResult(null);
    setAutoExploreError(null);
  };

  // ===== メタ分析 =====
  const startMetaAnalysis = async () => {
    if (metaAnalysisProgressRef.current) {
      clearInterval(metaAnalysisProgressRef.current);
      metaAnalysisProgressRef.current = null;
    }

    metaAnalysisStartTimeRef.current = Date.now();

    setMetaAnalysisStatus("running");
    setMetaAnalysisProgress(0);
    metaAnalysisMaxProgressRef.current = 0;
    setMetaAnalysisResult(null);
    setMetaAnalysisError(null);

    metaAnalysisProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(metaAnalysisStartTimeRef.current, 300000);
      metaAnalysisMaxProgressRef.current = Math.max(metaAnalysisMaxProgressRef.current, newProgress);
      setMetaAnalysisProgress(metaAnalysisMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch("/api/meta-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finderId }),
      });

      if (metaAnalysisProgressRef.current) {
        clearInterval(metaAnalysisProgressRef.current);
        metaAnalysisProgressRef.current = null;
      }

      const data = await res.json();

      if (!res.ok) {
        setMetaAnalysisError(data.error || "メタ分析に失敗しました");
        setMetaAnalysisStatus("failed");
        setMetaAnalysisProgress(0);
      } else {
        const transformedResult: MetaAnalysisResult = {
          summary: {
            totalExplorations: data.totalExplorations || 0,
            totalStrategies: data.totalStrategies || 0,
            metaStrategiesCount: data.topStrategies?.length || 0,
            clusterCount: data.clusters?.length || 0,
          },
          topStrategies: (data.topStrategies || []).map((s: { name: string; frequency?: number }) => ({
            name: s.name,
            count: s.frequency || 1,
          })),
          clusters: (data.clusters || []).map((c: { name: string; strategies: string[] }) => ({
            name: c.name,
            strategies: c.strategies || [],
          })),
          frequentTags: data.frequentTags || [],
          blindSpots: data.blindSpots || [],
          thinkingProcess: data.thinkingProcess || "",
        };

        animateToComplete(metaAnalysisMaxProgressRef.current, setMetaAnalysisProgress, () => {
          setMetaAnalysisResult(transformedResult);
          setMetaAnalysisStatus("completed");
        });
      }
    } catch (error) {
      console.error("Meta analysis failed:", error);
      if (metaAnalysisProgressRef.current) {
        clearInterval(metaAnalysisProgressRef.current);
        metaAnalysisProgressRef.current = null;
      }
      setMetaAnalysisError("メタ分析に失敗しました");
      setMetaAnalysisStatus("failed");
      setMetaAnalysisProgress(0);
    }
  };

  const clearMetaAnalysisResult = () => {
    if (metaAnalysisProgressRef.current) {
      clearInterval(metaAnalysisProgressRef.current);
      metaAnalysisProgressRef.current = null;
    }
    setMetaAnalysisStatus("idle");
    setMetaAnalysisProgress(0);
    setMetaAnalysisResult(null);
    setMetaAnalysisError(null);
  };

  // ===== パターン抽出 =====
  const startPatternExtract = async () => {
    if (patternExtractProgressRef.current) {
      clearInterval(patternExtractProgressRef.current);
      patternExtractProgressRef.current = null;
    }

    patternExtractStartTimeRef.current = Date.now();
    setPatternExtractStatus("running");
    setPatternExtractProgress(0);
    patternExtractMaxProgressRef.current = 0;
    setPatternExtractResult(null);
    setPatternExtractError(null);

    patternExtractProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(patternExtractStartTimeRef.current, 60000);
      patternExtractMaxProgressRef.current = Math.max(patternExtractMaxProgressRef.current, newProgress);
      setPatternExtractProgress(patternExtractMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch("/api/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minDecisions: 5, finderId }),
      });

      if (patternExtractProgressRef.current) {
        clearInterval(patternExtractProgressRef.current);
        patternExtractProgressRef.current = null;
      }

      const data = await res.json();

      if (!res.ok) {
        setPatternExtractError(data.error || "パターン抽出に失敗しました");
        setPatternExtractStatus("failed");
        setPatternExtractProgress(0);
      } else {
        const result: PatternExtractResult = {
          extracted: data.extracted || 0,
          saved: data.saved || 0,
          updated: data.updated || 0,
        };

        animateToComplete(patternExtractMaxProgressRef.current, setPatternExtractProgress, () => {
          setPatternExtractResult(result);
          setPatternExtractStatus("completed");
        });
      }
    } catch (error) {
      console.error("Pattern extract failed:", error);
      if (patternExtractProgressRef.current) {
        clearInterval(patternExtractProgressRef.current);
        patternExtractProgressRef.current = null;
      }
      setPatternExtractError("パターン抽出に失敗しました");
      setPatternExtractStatus("failed");
      setPatternExtractProgress(0);
    }
  };

  const clearPatternExtractResult = () => {
    if (patternExtractProgressRef.current) {
      clearInterval(patternExtractProgressRef.current);
      patternExtractProgressRef.current = null;
    }
    setPatternExtractStatus("idle");
    setPatternExtractProgress(0);
    setPatternExtractResult(null);
    setPatternExtractError(null);
  };

  // ===== まとめ =====
  const startSummary = async () => {
    if (summaryProgressRef.current) {
      clearInterval(summaryProgressRef.current);
      summaryProgressRef.current = null;
    }

    summaryStartTimeRef.current = Date.now();

    setSummaryStatus("running");
    setSummaryProgress(0);
    summaryMaxProgressRef.current = 0;
    setSummaryResult(null);
    setSummaryError(null);

    summaryProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(summaryStartTimeRef.current, 60000);
      summaryMaxProgressRef.current = Math.max(summaryMaxProgressRef.current, newProgress);
      setSummaryProgress(summaryMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finderId }),
      });

      if (summaryProgressRef.current) {
        clearInterval(summaryProgressRef.current);
        summaryProgressRef.current = null;
      }

      const data = await res.json();

      if (!res.ok) {
        setSummaryError(data.error || "まとめの生成に失敗しました");
        setSummaryStatus("failed");
        setSummaryProgress(0);
      } else {
        const result: SummaryResult = {
          id: data.summary.id,
          content: typeof data.summary.content === "string"
            ? JSON.parse(data.summary.content)
            : data.summary.content,
          stats: data.summary.stats,
          createdAt: data.summary.createdAt,
        };

        animateToComplete(summaryMaxProgressRef.current, setSummaryProgress, () => {
          setSummaryResult(result);
          setSummaryStatus("completed");
        });
      }
    } catch (error) {
      console.error("Summary generation failed:", error);
      if (summaryProgressRef.current) {
        clearInterval(summaryProgressRef.current);
        summaryProgressRef.current = null;
      }
      setSummaryError("まとめの生成に失敗しました");
      setSummaryStatus("failed");
      setSummaryProgress(0);
    }
  };

  const clearSummaryResult = () => {
    if (summaryProgressRef.current) {
      clearInterval(summaryProgressRef.current);
      summaryProgressRef.current = null;
    }
    setSummaryStatus("idle");
    setSummaryProgress(0);
    setSummaryResult(null);
    setSummaryError(null);
  };

  // ===== プリセット質問生成 =====
  const generatePresetQuestions = async () => {
    if (presetQuestionsProgressRef.current) {
      clearInterval(presetQuestionsProgressRef.current);
      presetQuestionsProgressRef.current = null;
    }

    presetQuestionsStartTimeRef.current = Date.now();
    presetQuestionsMaxProgressRef.current = 0;
    setPresetQuestionsStatus("running");
    setPresetQuestionsProgress(0);

    presetQuestionsProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(presetQuestionsStartTimeRef.current, 30000);
      presetQuestionsMaxProgressRef.current = Math.max(presetQuestionsMaxProgressRef.current, newProgress);
      setPresetQuestionsProgress(presetQuestionsMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch(`/api/preset-questions?finderId=${finderId}`);

      if (presetQuestionsProgressRef.current) {
        clearInterval(presetQuestionsProgressRef.current);
        presetQuestionsProgressRef.current = null;
      }

      const data = await res.json();

      if (!res.ok) {
        setPresetQuestionsStatus("failed");
        setPresetQuestionsProgress(0);
      } else {
        const questions = data.questions || presetQuestions;

        animateToComplete(presetQuestionsMaxProgressRef.current, setPresetQuestionsProgress, () => {
          setPresetQuestions(questions);
          setPresetQuestionsStatus("completed");
        });
      }
    } catch (error) {
      console.error("Preset questions generation failed:", error);
      if (presetQuestionsProgressRef.current) {
        clearInterval(presetQuestionsProgressRef.current);
        presetQuestionsProgressRef.current = null;
      }
      setPresetQuestionsStatus("failed");
      setPresetQuestionsProgress(0);
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (explorationProgressRef.current) clearInterval(explorationProgressRef.current);
      if (evolveProgressRef.current) clearInterval(evolveProgressRef.current);
      if (autoExploreProgressRef.current) clearInterval(autoExploreProgressRef.current);
      if (metaAnalysisProgressRef.current) clearInterval(metaAnalysisProgressRef.current);
      if (patternExtractProgressRef.current) clearInterval(patternExtractProgressRef.current);
      if (summaryProgressRef.current) clearInterval(summaryProgressRef.current);
      if (presetQuestionsProgressRef.current) clearInterval(presetQuestionsProgressRef.current);
    };
  }, []);

  const value: FinderContextType = {
    finderId,
    finderConfig,
    finderLoading,
    finderError,
    evaluationAxes,
    weights,
    setWeights,
    adjustWeight,
    presetQuestions,
    exploreQuestion,
    setExploreQuestion,
    exploreAdditionalContext,
    setExploreAdditionalContext,
    exploreSelectedPresets,
    setExploreSelectedPresets,
    explorationStatus,
    explorationId,
    explorationProgress,
    explorationResult,
    explorationError,
    startExploration,
    clearExplorationResult,
    evolveStatus,
    evolveProgress,
    evolveResult,
    evolveError,
    startEvolve,
    clearEvolveResult,
    autoExploreStatus,
    autoExploreProgress,
    autoExploreResult,
    autoExploreError,
    startAutoExplore,
    clearAutoExploreResult,
    metaAnalysisStatus,
    metaAnalysisProgress,
    metaAnalysisResult,
    metaAnalysisError,
    startMetaAnalysis,
    clearMetaAnalysisResult,
    patternExtractStatus,
    patternExtractProgress,
    patternExtractResult,
    patternExtractError,
    startPatternExtract,
    clearPatternExtractResult,
    summaryStatus,
    summaryProgress,
    summaryResult,
    summaryError,
    startSummary,
    clearSummaryResult,
    presetQuestionsStatus,
    presetQuestionsProgress,
    generatePresetQuestions,
    calculateWeightedScore,
    getScoreLabel,
  };

  return <FinderContext.Provider value={value}>{children}</FinderContext.Provider>;
}

// ===== Hook =====
export function useFinder() {
  const context = useContext(FinderContext);
  if (context === undefined) {
    throw new Error("useFinder must be used within a FinderProvider");
  }
  return context;
}
