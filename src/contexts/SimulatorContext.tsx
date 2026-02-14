"use client";

import { createContext, useContext, useState, ReactNode } from "react";

// シミュレーター用タブタイプ
export type SimulatorTabType =
  | "intro"
  | "company"
  | "rag"
  | "preconditions"
  | "scenario"
  | "simulation"
  | "analysis"
  | "compare"
  | "report"
  | "history";

// シナリオデータ
export interface Scenario {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, number | string>;
  createdAt: Date;
}

// シミュレーション結果
export interface SimulationResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  metrics: Record<string, number>;
  analysis: string;
  createdAt: Date;
}

// 前提条件
export interface Precondition {
  id: string;
  label: string;
  type: "number" | "text" | "select";
  value: string | number;
  unit?: string;
  options?: string[];
}

interface SimulatorContextType {
  // タブ管理
  activeTab: SimulatorTabType;
  setActiveTab: (tab: SimulatorTabType) => void;

  // シミュレーターID
  simulatorId: string | null;
  setSimulatorId: (id: string | null) => void;

  // 前提条件
  preconditions: Precondition[];
  setPreconditions: (conditions: Precondition[]) => void;
  updatePrecondition: (id: string, value: string | number) => void;

  // シナリオ
  scenarios: Scenario[];
  setScenarios: (scenarios: Scenario[]) => void;
  addScenario: (scenario: Omit<Scenario, "id" | "createdAt">) => void;
  removeScenario: (id: string) => void;
  currentScenario: Scenario | null;
  setCurrentScenario: (scenario: Scenario | null) => void;

  // シミュレーション結果
  results: SimulationResult[];
  setResults: (results: SimulationResult[]) => void;

  // シミュレーションステータス
  simulationStatus: "idle" | "running" | "completed" | "error";
  setSimulationStatus: (status: "idle" | "running" | "completed" | "error") => void;

  // シミュレーション実行
  runSimulation: () => Promise<void>;
}

const SimulatorContext = createContext<SimulatorContextType | undefined>(undefined);

interface SimulatorProviderProps {
  children: ReactNode;
  initialSimulatorId?: string | null;
}

export function SimulatorProvider({ children, initialSimulatorId = null }: SimulatorProviderProps) {
  const [activeTab, setActiveTab] = useState<SimulatorTabType>("intro");
  const [simulatorId, setSimulatorId] = useState<string | null>(initialSimulatorId);
  const [preconditions, setPreconditions] = useState<Precondition[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [simulationStatus, setSimulationStatus] = useState<"idle" | "running" | "completed" | "error">("idle");

  const updatePrecondition = (id: string, value: string | number) => {
    setPreconditions((conditions) =>
      conditions.map((c) => (c.id === id ? { ...c, value } : c))
    );
  };

  const addScenario = (scenario: Omit<Scenario, "id" | "createdAt">) => {
    const newScenario: Scenario = {
      ...scenario,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    setScenarios((prev) => [...prev, newScenario]);
    setCurrentScenario(newScenario);
  };

  const removeScenario = (id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    if (currentScenario?.id === id) {
      setCurrentScenario(null);
    }
  };

  const runSimulation = async () => {
    if (!simulatorId || scenarios.length === 0) return;

    setSimulationStatus("running");
    try {
      // TODO: Implement actual API call
      const res = await fetch("/api/simulator/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulatorId,
          preconditions: preconditions.reduce((acc, p) => {
            acc[p.id] = p.value;
            return acc;
          }, {} as Record<string, string | number>),
          scenarios: scenarios.map((s) => ({
            id: s.id,
            name: s.name,
            parameters: s.parameters,
          })),
        }),
      });

      if (!res.ok) throw new Error("Simulation failed");

      const data = await res.json();
      setResults(
        data.results?.map((r: SimulationResult) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        })) || []
      );
      setSimulationStatus("completed");
      setActiveTab("analysis");
    } catch (error) {
      console.error("Simulation error:", error);
      setSimulationStatus("error");
    }
  };

  return (
    <SimulatorContext.Provider
      value={{
        activeTab,
        setActiveTab,
        simulatorId,
        setSimulatorId,
        preconditions,
        setPreconditions,
        updatePrecondition,
        scenarios,
        setScenarios,
        addScenario,
        removeScenario,
        currentScenario,
        setCurrentScenario,
        results,
        setResults,
        simulationStatus,
        setSimulationStatus,
        runSimulation,
      }}
    >
      {children}
    </SimulatorContext.Provider>
  );
}

export function useSimulator() {
  const context = useContext(SimulatorContext);
  if (context === undefined) {
    throw new Error("useSimulator must be used within a SimulatorProvider");
  }
  return context;
}
