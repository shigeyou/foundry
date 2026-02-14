"use client";

import { useEffect } from "react";
import { useSimulator, Precondition } from "@/contexts/SimulatorContext";

export function PreconditionsTab() {
  const { setActiveTab, simulatorId, preconditions, setPreconditions, updatePrecondition } = useSimulator();

  useEffect(() => {
    const conditionsBySimulator: Record<string, Precondition[]> = {
      "investment": [
        { id: "initial_investment", label: "初期投資額", type: "number", value: 100000000, unit: "円" },
        { id: "project_period", label: "プロジェクト期間", type: "number", value: 5, unit: "年" },
        { id: "discount_rate", label: "割引率", type: "number", value: 5, unit: "%" },
        { id: "risk_level", label: "リスクレベル", type: "select", value: "medium", options: ["low", "medium", "high"] },
      ],
      "withdrawal": [
        { id: "current_revenue", label: "現在の売上", type: "number", value: 50000000, unit: "円/年" },
        { id: "operating_cost", label: "運営コスト", type: "number", value: 40000000, unit: "円/年" },
        { id: "withdrawal_cost", label: "撤退コスト", type: "number", value: 10000000, unit: "円" },
        { id: "market_trend", label: "市場トレンド", type: "select", value: "declining", options: ["growing", "stable", "declining"] },
      ],
    };

    const conditions = conditionsBySimulator[simulatorId || ""] || [
      { id: "parameter1", label: "パラメータ1", type: "number", value: 0, unit: "" },
    ];

    if (preconditions.length === 0) {
      setPreconditions(conditions);
    }
  }, [simulatorId, preconditions.length, setPreconditions]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">前提条件</h2>

        <div className="space-y-4">
          {preconditions.map((condition) => (
            <div key={condition.id} className="flex items-center gap-4">
              <label className="w-40 text-sm font-medium text-slate-700 dark:text-slate-300">
                {condition.label}
              </label>
              {condition.type === "select" ? (
                <select
                  value={condition.value as string}
                  onChange={(e) => updatePrecondition(condition.id, e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  {condition.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type={condition.type}
                    value={condition.value}
                    onChange={(e) => updatePrecondition(condition.id, condition.type === "number" ? Number(e.target.value) : e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  {condition.unit && (
                    <span className="text-sm text-slate-500 dark:text-slate-400 w-16">{condition.unit}</span>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-between pt-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("rag")}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              ← RAG情報
            </button>
            <button
              onClick={() => setActiveTab("scenario")}
              className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              シナリオ設定へ →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
