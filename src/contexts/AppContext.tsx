"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

// ===== 型定義 =====
export interface SwotData {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  summary: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface CoreService {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  url: string | null;
}

export interface RAGDocument {
  id: string;
  filename: string;
  fileType: string;
  metadata: string | null;
  createdAt: string;
}

export interface ScoreWeights {
  revenuePotential: number;
  timeToRevenue: number;
  competitiveAdvantage: number;
  executionFeasibility: number;
  hqContribution: number;
  mergerSynergy: number;
}

export interface Strategy {
  name: string;
  reason: string;
  howToObtain?: string;
  totalScore: number;
  scores?: Record<string, number>;
  judgment?: string;
}

export interface ExplorationResult {
  id: string;
  question: string;
  strategies: Strategy[];
  thinking?: string;
}

export type TabType = "intro" | "company" | "swot" | "rag" | "score" | "explore" | "history" | "ranking" | "strategies" | "insights" | "summary";

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

// ===== 定数 =====
export const defaultWeights: ScoreWeights = {
  revenuePotential: 30,
  timeToRevenue: 20,
  competitiveAdvantage: 20,
  executionFeasibility: 15,
  hqContribution: 10,
  mergerSynergy: 5,
};

export const scoreLabels: Record<keyof ScoreWeights, string> = {
  revenuePotential: "収益ポテンシャル",
  timeToRevenue: "収益化までの距離",
  competitiveAdvantage: "勝ち筋の強さ",
  executionFeasibility: "実行可能性",
  hqContribution: "本社貢献",
  mergerSynergy: "合併シナジー",
};

export const categories = [
  "IT基盤",
  "データサービス",
  "コンサルティング",
  "物流サービス",
  "新規事業",
  "管理機能",
  "研究開発",
  "その他",
];

export const presetQuestions = [
  { label: "親会社支援", question: "商船三井グループへの貢献価値を高めるには？" },
  { label: "生成AI", question: "生成AIで業務効率化・新サービス創出するには？" },
  { label: "脱炭素", question: "脱炭素化支援で新たな収益源を作るには？" },
  { label: "船員育成", question: "船員育成・技術継承で差別化するには？" },
  { label: "コスト削減", question: "業務コストを削減しながら価値を高めるには？" },
  { label: "安全管理", question: "安全管理の高度化で収益に繋げるには？" },
  { label: "新規事業", question: "既存の強みを活かした新規事業は何か？" },
  { label: "統合シナジー", question: "3社統合で生まれるシナジーをどう活かすか？" },
  // 商船三井マリテックス固有の問い（RAGドキュメント参照）
  { label: "洋上風力", question: "洋上風力発電分野での事業機会を拡大するには？" },
  { label: "ケーブル船", question: "海底ケーブル敷設事業で競争優位を築くには？" },
  { label: "船主サービス", question: "船主向けサービスの付加価値を最大化するには？" },
  { label: "シミュレータ", question: "操船シミュレータを活用した新サービスを展開するには？" },
  { label: "DX推進", question: "デジタル変革で顧客への提供価値を向上させるには？" },
  { label: "オフショア", question: "オフショア事業を次の成長ドライバーにするには？" },
  { label: "E2E提供", question: "特殊船のE2Eソリューション提供で差別化するには？" },
  { label: "海洋調査", question: "海洋調査・研究支援サービスで新規顧客を開拓するには？" },
  { label: "グローバル", question: "海外市場での事業展開を加速するには？" },
  { label: "船舶検査", question: "船舶検査・管理サービスの収益性を向上させるには？" },
  { label: "ドローン", question: "ドローン技術を活用した新サービス・業務効率化を実現するには？" },
];

// ===== Context 型 =====
interface AppContextType {
  // タブ
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;

  // SWOT
  swot: SwotData | null;
  setSwot: (swot: SwotData | null) => void;
  swotLoading: boolean;
  fetchSwot: () => Promise<void>;

  // 探索入力（タブ切替時も保持）
  exploreQuestion: string;
  setExploreQuestion: (q: string) => void;
  exploreAdditionalContext: string;
  setExploreAdditionalContext: (c: string) => void;
  exploreSelectedPresets: Set<number>;
  setExploreSelectedPresets: (p: Set<number>) => void;

  // コアサービス
  services: CoreService[];
  setServices: (services: CoreService[]) => void;
  servicesLoading: boolean;
  fetchServices: () => Promise<void>;

  // RAG
  ragDocuments: RAGDocument[];
  setRagDocuments: (docs: RAGDocument[]) => void;
  fetchRAGDocuments: () => Promise<void>;

  // スコア設定
  weights: ScoreWeights;
  setWeights: (weights: ScoreWeights) => void;
  adjustWeight: (key: keyof ScoreWeights, newValue: number) => void;

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
  presetQuestions: { label: string; question: string }[];
  presetQuestionsStatus: ExplorationStatus;
  presetQuestionsProgress: number;
  generatePresetQuestions: () => Promise<void>;

  // ユーティリティ
  calculateWeightedScore: (scores: Record<string, number>) => number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ===== Provider =====
export function AppProvider({ children }: { children: ReactNode }) {
  // タブ
  const [activeTab, setActiveTab] = useState<TabType>("intro");

  // SWOT
  const [swot, setSwot] = useState<SwotData | null>(null);
  const [swotLoading, setSwotLoading] = useState(true);

  // 探索入力（タブ切替時も保持）
  const [exploreQuestion, setExploreQuestion] = useState("");
  const [exploreAdditionalContext, setExploreAdditionalContext] = useState("");
  const [exploreSelectedPresets, setExploreSelectedPresets] = useState<Set<number>>(new Set());

  // コアサービス
  const [services, setServices] = useState<CoreService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  // RAG
  const [ragDocuments, setRagDocuments] = useState<RAGDocument[]>([]);

  // スコア設定
  const [weights, setWeightsState] = useState<ScoreWeights>(defaultWeights);

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

  // プリセット質問
  const [presetQuestionsState, setPresetQuestionsState] = useState<{ label: string; question: string }[]>(presetQuestions);
  const [presetQuestionsStatus, setPresetQuestionsStatus] = useState<ExplorationStatus>("idle");
  const [presetQuestionsProgress, setPresetQuestionsProgress] = useState(0);
  const presetQuestionsProgressRef = useRef<NodeJS.Timeout | null>(null);
  const presetQuestionsStartTimeRef = useRef<number>(0);
  const presetQuestionsMaxProgressRef = useRef<number>(0);

  // 完了時に100%までアニメーションさせる関数
  const animateToComplete = useCallback((
    currentProgress: number,
    setProgress: (p: number) => void,
    onComplete: () => void,
    duration: number = 1500 // デフォルト1.5秒
  ) => {
    const startProgress = currentProgress;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      // イージング: ease-out (減速)
      const eased = 1 - Math.pow(1 - t, 3);
      const newProgress = startProgress + (100 - startProgress) * eased;

      setProgress(Math.min(newProgress, 100));

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setProgress(100);
        // 100%表示を少し見せてから完了
        setTimeout(onComplete, 300);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  // イージング関数: 前半ゆっくり→後半加速（尻上がり）
  // ユーザー要望: 前半を現在の50%の速度に抑え、93%付近での停滞感を解消
  const calculateEasedProgress = useCallback((startTime: number, expectedDuration: number): number => {
    const elapsed = Date.now() - startTime;
    const t = elapsed / expectedDuration; // 時間比率（1を超える可能性あり）

    let progress: number;

    if (t <= 0.5) {
      // 前半 (0-50%時間): 0-10%進捗 (非常にゆっくり - 現在の約50%の速度)
      progress = (t / 0.5) * 10;
    } else if (t <= 0.8) {
      // 中盤 (50-80%時間): 10-35%進捗 (やや加速)
      const midT = (t - 0.5) / 0.3;
      progress = 10 + midT * 25;
    } else if (t <= 1.0) {
      // 後半 (80-100%時間): 35-70%進捗 (加速)
      const lateT = (t - 0.8) / 0.2;
      progress = 35 + lateT * 35;
    } else if (t <= 1.5) {
      // 時間超過前半 (100-150%時間): 70-90%進捗 (まだ動いている感じ)
      const overT = (t - 1.0) / 0.5;
      progress = 70 + overT * 20;
    } else {
      // 時間超過後半 (150%以降): 90-99%進捗 (ゆっくりだが停滞感なし)
      const overT2 = t - 1.5;
      const extraProgress = Math.min(overT2 * 10, 9);
      progress = 90 + extraProgress;
    }

    return Math.min(progress, 99);
  }, []);

  // ===== 初期化 =====
  useEffect(() => {
    fetchSwot();
    fetchServices();
    fetchRAGDocuments();
    loadWeights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== SWOT =====
  const fetchSwot = async () => {
    setSwotLoading(true);
    try {
      const res = await fetch("/api/admin/swot");
      const data = await res.json();
      if (data.exists) {
        setSwot(data.swot);
      }
    } catch (error) {
      console.error("Failed to fetch SWOT:", error);
    } finally {
      setSwotLoading(false);
    }
  };

  // ===== コアサービス =====
  const fetchServices = async () => {
    setServicesLoading(true);
    try {
      const res = await fetch("/api/core/services");
      const data = await res.json();
      setServices(Array.isArray(data) ? data : data.services || []);
    } catch (error) {
      console.error("Failed to fetch services:", error);
    } finally {
      setServicesLoading(false);
    }
  };

  // ===== RAG =====
  const fetchRAGDocuments = async () => {
    try {
      const res = await fetch("/api/rag");
      const data = await res.json();
      setRagDocuments(data.documents || []);
    } catch (error) {
      console.error("Error fetching RAG documents:", error);
    }
  };

  // ===== スコア設定 =====
  const loadWeights = () => {
    const saved = localStorage.getItem("scoreWeights");
    if (saved) {
      setWeightsState(JSON.parse(saved));
    }
  };

  const setWeights = useCallback((newWeights: ScoreWeights) => {
    setWeightsState(newWeights);
    localStorage.setItem("scoreWeights", JSON.stringify(newWeights));
  }, []);

  // 個別の重みを変更（他の項目は変更しない）
  // スコア計算時に合計で正規化されるため、合計が100%でなくても問題ない
  const adjustWeight = useCallback((key: keyof ScoreWeights, newValue: number) => {
    setWeightsState((prev) => {
      const clampedValue = Math.max(0, Math.min(100, newValue));
      const newWeights = { ...prev, [key]: clampedValue };
      localStorage.setItem("scoreWeights", JSON.stringify(newWeights));
      return newWeights;
    });
  }, []);

  // ===== スコア計算 =====
  const calculateWeightedScore = useCallback(
    (scores: Record<string, number>) => {
      const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
      if (totalWeight === 0) return 0;
      const weightedSum =
        (scores.revenuePotential || 0) * weights.revenuePotential +
        (scores.timeToRevenue || 0) * weights.timeToRevenue +
        (scores.competitiveAdvantage || 0) * weights.competitiveAdvantage +
        (scores.executionFeasibility || 0) * weights.executionFeasibility +
        (scores.hqContribution || 0) * weights.hqContribution +
        (scores.mergerSynergy || 0) * weights.mergerSynergy;
      return weightedSum / totalWeight;
    },
    [weights]
  );

  // ===== 探索 =====
  const pollExplorationStatus = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/explore?id=${id}`);
        const data = await res.json();

        if (data.status === "completed" && data.result) {
          // 完了
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
            .map((s: { name: string; reason: string; howToObtain?: string; scores?: Record<string, number> }) => ({
              ...s,
              totalScore: s.scores ? calculateWeightedScore(s.scores) : 0,
            }))
            .sort((a: { totalScore: number }, b: { totalScore: number }) => b.totalScore - a.totalScore);

          const result = {
            id: data.id,
            question: data.question,
            strategies: strategiesWithScore,
            thinking: parsed.thinkingProcess,
          };

          // 100%までアニメーションしてから完了状態にする
          animateToComplete(explorationMaxProgressRef.current, setExplorationProgress, () => {
            setExplorationResult(result);
            setExplorationStatus("completed");
          });
        } else if (data.status === "failed") {
          // 失敗
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
          // まだ処理中 - イージングで進捗更新（後退防止）
          const newProgress = calculateEasedProgress(explorationStartTimeRef.current, 450000); // 450秒想定（20%速度）
          explorationMaxProgressRef.current = Math.max(explorationMaxProgressRef.current, newProgress);
          setExplorationProgress(explorationMaxProgressRef.current);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    },
    [calculateWeightedScore, calculateEasedProgress]
  );

  const startExploration = async (question: string, context: string) => {
    if (!question.trim()) return;

    // 既存のポーリングをクリア
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (explorationProgressRef.current) {
      clearInterval(explorationProgressRef.current);
      explorationProgressRef.current = null;
    }

    // 開始時間を記録
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
        }),
      });

      const data = await res.json();

      if (data.id) {
        setExplorationId(data.id);

        // プログレスアニメーション開始（500msごとにスムーズに更新、後退防止）
        explorationProgressRef.current = setInterval(() => {
          const newProgress = calculateEasedProgress(explorationStartTimeRef.current, 90000);
          explorationMaxProgressRef.current = Math.max(explorationMaxProgressRef.current, newProgress);
          setExplorationProgress(explorationMaxProgressRef.current);
        }, 500);

        // ポーリング開始（ステータス確認）
        pollingRef.current = setInterval(() => {
          pollExplorationStatus(data.id);
        }, 3000);
        // 即座に1回実行
        pollExplorationStatus(data.id);
      } else if (data.strategies) {
        // 同期レスポンス（background: falseの場合）
        const strategiesWithScore = data.strategies
          .map((s: { name: string; reason: string; howToObtain?: string; scores?: Record<string, number> }) => ({
            ...s,
            totalScore: s.scores ? calculateWeightedScore(s.scores) : 0,
          }))
          .sort((a: { totalScore: number }, b: { totalScore: number }) => b.totalScore - a.totalScore);

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
    // 既存のプログレスタイマーをクリア
    if (evolveProgressRef.current) {
      clearInterval(evolveProgressRef.current);
      evolveProgressRef.current = null;
    }

    // 開始時間を記録
    evolveStartTimeRef.current = Date.now();

    setEvolveStatus("running");
    setEvolveProgress(0);
    evolveMaxProgressRef.current = 0;
    setEvolveResult(null);
    setEvolveError(null);

    // プログレスバーアニメーション開始（イージング適用、後退防止）
    evolveProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(evolveStartTimeRef.current, 300000); // 300秒想定（20%速度）
      evolveMaxProgressRef.current = Math.max(evolveMaxProgressRef.current, newProgress);
      setEvolveProgress(evolveMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch("/api/evolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, save: true }),
      });

      // プログレスタイマーをクリア
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

        // 100%までアニメーションしてから完了状態にする
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
    // 既存のプログレスタイマーをクリア
    if (autoExploreProgressRef.current) {
      clearInterval(autoExploreProgressRef.current);
      autoExploreProgressRef.current = null;
    }

    // 開始時間を記録
    autoExploreStartTimeRef.current = Date.now();

    setAutoExploreStatus("running");
    setAutoExploreProgress(0);
    autoExploreMaxProgressRef.current = 0;
    setAutoExploreResult(null);
    setAutoExploreError(null);

    // プログレスバーアニメーション開始（イージング適用、後退防止）
    // AI自動探索は5つの問いを探索するため、長めの時間を想定（600秒 = 10分、20%速度）
    autoExploreProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(autoExploreStartTimeRef.current, 600000);
      autoExploreMaxProgressRef.current = Math.max(autoExploreMaxProgressRef.current, newProgress);
      setAutoExploreProgress(autoExploreMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch("/api/auto-explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // プログレスタイマーをクリア
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

        // 100%までアニメーションしてから完了状態にする
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
    // 既存のプログレスタイマーをクリア
    if (metaAnalysisProgressRef.current) {
      clearInterval(metaAnalysisProgressRef.current);
      metaAnalysisProgressRef.current = null;
    }

    // 開始時間を記録
    metaAnalysisStartTimeRef.current = Date.now();

    setMetaAnalysisStatus("running");
    setMetaAnalysisProgress(0);
    metaAnalysisMaxProgressRef.current = 0;
    setMetaAnalysisResult(null);
    setMetaAnalysisError(null);

    // プログレスバーアニメーション開始（イージング適用、後退防止）
    // メタ分析は300秒（5分、20%速度）を想定
    metaAnalysisProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(metaAnalysisStartTimeRef.current, 300000);
      metaAnalysisMaxProgressRef.current = Math.max(metaAnalysisMaxProgressRef.current, newProgress);
      setMetaAnalysisProgress(metaAnalysisMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch("/api/meta-analysis", { method: "POST" });

      // プログレスタイマーをクリア
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
        // APIレスポンスをフロントエンドの期待する形式に変換
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

        // 100%までアニメーションしてから完了状態にする
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

    // パターン抽出は60秒を想定
    patternExtractProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(patternExtractStartTimeRef.current, 60000);
      patternExtractMaxProgressRef.current = Math.max(patternExtractMaxProgressRef.current, newProgress);
      setPatternExtractProgress(patternExtractMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch("/api/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minDecisions: 5 }),
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
    // 既存のプログレスタイマーをクリア
    if (summaryProgressRef.current) {
      clearInterval(summaryProgressRef.current);
      summaryProgressRef.current = null;
    }

    // 開始時間を記録
    summaryStartTimeRef.current = Date.now();

    setSummaryStatus("running");
    setSummaryProgress(0);
    summaryMaxProgressRef.current = 0;
    setSummaryResult(null);
    setSummaryError(null);

    // プログレスバーアニメーション開始（イージング適用、後退防止）
    // まとめ生成は60秒（1分）を想定
    summaryProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(summaryStartTimeRef.current, 60000);
      summaryMaxProgressRef.current = Math.max(summaryMaxProgressRef.current, newProgress);
      setSummaryProgress(summaryMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch("/api/summary", { method: "POST" });

      // プログレスタイマーをクリア
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

        // 100%までアニメーションしてから完了状態にする
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

    // プログレスバーアニメーション（30秒想定）
    presetQuestionsProgressRef.current = setInterval(() => {
      const newProgress = calculateEasedProgress(presetQuestionsStartTimeRef.current, 30000);
      presetQuestionsMaxProgressRef.current = Math.max(presetQuestionsMaxProgressRef.current, newProgress);
      setPresetQuestionsProgress(presetQuestionsMaxProgressRef.current);
    }, 500);

    try {
      const res = await fetch("/api/preset-questions");

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

        // 100%までアニメーションしてから完了状態にする
        animateToComplete(presetQuestionsMaxProgressRef.current, setPresetQuestionsProgress, () => {
          setPresetQuestionsState(questions);
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
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (explorationProgressRef.current) {
        clearInterval(explorationProgressRef.current);
      }
      if (evolveProgressRef.current) {
        clearInterval(evolveProgressRef.current);
      }
      if (autoExploreProgressRef.current) {
        clearInterval(autoExploreProgressRef.current);
      }
      if (metaAnalysisProgressRef.current) {
        clearInterval(metaAnalysisProgressRef.current);
      }
      if (patternExtractProgressRef.current) {
        clearInterval(patternExtractProgressRef.current);
      }
      if (summaryProgressRef.current) {
        clearInterval(summaryProgressRef.current);
      }
      if (presetQuestionsProgressRef.current) {
        clearInterval(presetQuestionsProgressRef.current);
      }
    };
  }, []);

  const value: AppContextType = {
    activeTab,
    setActiveTab,
    swot,
    setSwot,
    swotLoading,
    fetchSwot,
    exploreQuestion,
    setExploreQuestion,
    exploreAdditionalContext,
    setExploreAdditionalContext,
    exploreSelectedPresets,
    setExploreSelectedPresets,
    services,
    setServices,
    servicesLoading,
    fetchServices,
    ragDocuments,
    setRagDocuments,
    fetchRAGDocuments,
    weights,
    setWeights,
    adjustWeight,
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
    presetQuestions: presetQuestionsState,
    presetQuestionsStatus,
    presetQuestionsProgress,
    generatePresetQuestions,
    calculateWeightedScore,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ===== Hook =====
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
