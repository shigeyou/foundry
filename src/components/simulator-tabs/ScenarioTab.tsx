"use client";

import { useState } from "react";
import { useSimulator } from "@/contexts/SimulatorContext";

// サンプルシナリオ
interface SampleScenario {
  label: string;
  name: string;
  description: string;
}

const sampleScenariosBySimulator: Record<string, SampleScenario[]> = {
  "investment": [
    { label: "楽観", name: "楽観シナリオ", description: "市場成長率が予想を上回り、計画より早期に収益化を達成するケース" },
    { label: "基準", name: "基準シナリオ", description: "現在の市場予測に基づく最も可能性の高いケース" },
    { label: "悲観", name: "悲観シナリオ", description: "市場環境の悪化や競合の参入により、計画が遅延するケース" },
    { label: "最悪", name: "最悪シナリオ", description: "重大なリスクが顕在化し、投資回収が困難になるケース" },
  ],
  "withdrawal": [
    { label: "即時撤退", name: "即時撤退シナリオ", description: "損失を最小化するため、直ちに事業を終了するケース" },
    { label: "段階的撤退", name: "段階的撤退シナリオ", description: "1〜2年かけて事業を縮小・終了し、顧客・従業員への影響を最小化するケース" },
    { label: "事業売却", name: "事業売却シナリオ", description: "事業を第三者に売却し、一定の回収を図るケース" },
    { label: "継続検討", name: "継続シナリオ", description: "撤退せず継続した場合の比較用シナリオ" },
  ],
  "competitor": [
    { label: "現状維持", name: "現状維持シナリオ", description: "競合他社が現在の戦略を継続するケース" },
    { label: "価格競争", name: "価格競争シナリオ", description: "競合他社が価格引き下げで市場シェアを狙うケース" },
    { label: "技術革新", name: "技術革新シナリオ", description: "競合他社が新技術で差別化を図るケース" },
    { label: "新規参入", name: "新規参入シナリオ", description: "新たな競合が市場に参入するケース" },
  ],
};

export function ScenarioTab() {
  const { setActiveTab, simulatorId, scenarios, addScenario, removeScenario, setCurrentScenario } = useSimulator();
  const [newScenarioName, setNewScenarioName] = useState("");
  const [newScenarioDesc, setNewScenarioDesc] = useState("");

  // 現在のシミュレーターのサンプルシナリオ一覧
  const currentSamples = sampleScenariosBySimulator[simulatorId || ""] || [];

  // サンプルシナリオを入力欄に適用
  const applySample = (sample: SampleScenario) => {
    setNewScenarioName(sample.name);
    setNewScenarioDesc(sample.description);
  };

  // サンプルシナリオを直接追加
  const addSampleScenario = (sample: SampleScenario) => {
    // 同名のシナリオが既にある場合はスキップ
    if (scenarios.some((s) => s.name === sample.name)) return;
    addScenario({
      name: sample.name,
      description: sample.description,
      parameters: {},
    });
  };

  const handleAddScenario = () => {
    if (!newScenarioName.trim()) return;
    addScenario({
      name: newScenarioName,
      description: newScenarioDesc,
      parameters: {},
    });
    setNewScenarioName("");
    setNewScenarioDesc("");
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">シナリオ設定</h2>

        <div className="space-y-6">
          {/* サンプルシナリオバッジ */}
          {currentSamples.length > 0 && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-purple-800 dark:text-purple-200">サンプルシナリオ</span>
                <span className="text-xs text-purple-600 dark:text-purple-400">（クリックで入力欄に、ダブルクリックで直接追加）</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentSamples.map((sample, i) => {
                  const isAdded = scenarios.some((s) => s.name === sample.name);
                  return (
                    <button
                      key={i}
                      onClick={() => applySample(sample)}
                      onDoubleClick={() => addSampleScenario(sample)}
                      disabled={isAdded}
                      className={`px-3 py-1.5 text-sm rounded-full transition-colors border ${
                        isAdded
                          ? "bg-purple-200 dark:bg-purple-800 text-purple-500 dark:text-purple-400 border-purple-300 dark:border-purple-700 cursor-not-allowed"
                          : "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 border-purple-300 dark:border-purple-700"
                      }`}
                      title={sample.description}
                    >
                      {sample.label}
                      {isAdded && " ✓"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 新規シナリオ追加 */}
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3">新しいシナリオを追加</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                placeholder="シナリオ名（例：楽観シナリオ）"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <textarea
                value={newScenarioDesc}
                onChange={(e) => setNewScenarioDesc(e.target.value)}
                placeholder="シナリオの説明（任意）"
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <button
                onClick={handleAddScenario}
                disabled={!newScenarioName.trim()}
                className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:bg-slate-400"
              >
                追加
              </button>
            </div>
          </div>

          {/* シナリオ一覧 */}
          <div>
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3">
              登録済みシナリオ ({scenarios.length})
            </h3>
            {scenarios.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                シナリオがまだありません。上のフォームから追加してください。
              </p>
            ) : (
              <div className="space-y-2">
                {scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{scenario.name}</p>
                      {scenario.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{scenario.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeScenario(scenario.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between pt-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("preconditions")}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              ← 前提条件
            </button>
            <button
              onClick={() => setActiveTab("simulation")}
              disabled={scenarios.length === 0}
              className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:bg-slate-400"
            >
              シミュレーション実行へ →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
