// 各シミュレーターの設定（シナリオ情報、パラメータなど）

export interface SimulatorSettings {
  id: string;
  name: string;
  description: string;
  introDescription: string;
  scenarioLabel: string;   // 「シナリオ」「ケース」など
  analysisLabel: string;   // 「分析」「予測」など
}

// ===== 投資シミュレーター =====
const investmentConfig: SimulatorSettings = {
  id: "investment",
  name: "投資シミュレーター",
  description: "投資案件の収益性を複数シナリオで分析するツール",
  scenarioLabel: "投資シナリオ",
  analysisLabel: "収益分析",
  introDescription: `投資シミュレーターは、新規投資案件の収益性を複数のシナリオで分析するツールです。
楽観・基準・悲観などの複数シナリオを設定し、それぞれの条件下での収益予測をAIが行います。
投資判断に必要な情報を多角的に提供し、リスクを可視化します。`,
};

// ===== 撤退シミュレーター =====
const withdrawalConfig: SimulatorSettings = {
  id: "withdrawal",
  name: "撤退シミュレーター",
  description: "事業撤退時の影響を複数シナリオで分析するツール",
  scenarioLabel: "撤退シナリオ",
  analysisLabel: "影響分析",
  introDescription: `撤退シミュレーターは、事業撤退を検討する際の影響を複数のシナリオで分析するツールです。
即時撤退、段階的撤退、事業売却など、様々な撤退オプションについてAIが影響を予測します。
財務的影響、従業員への影響、顧客への影響などを総合的に評価します。`,
};

// ===== 競合シミュレーター =====
const competitorConfig: SimulatorSettings = {
  id: "competitor",
  name: "競合シミュレーター",
  description: "競合他社の動向による影響を分析するツール",
  scenarioLabel: "競合シナリオ",
  analysisLabel: "競争分析",
  introDescription: `競合シミュレーターは、競合他社の様々な動向が自社に与える影響を分析するツールです。
価格競争、技術革新、新規参入など、競合の戦略変化に対する自社への影響をAIが予測します。
競争環境の変化に備えた戦略立案をサポートします。`,
};

// ===== 設定マップ =====
export const simulatorSettingsMap: Record<string, SimulatorSettings> = {
  "investment": investmentConfig,
  "withdrawal": withdrawalConfig,
  "competitor": competitorConfig,
};

// デフォルト設定を取得
export function getSimulatorSettings(simulatorId: string | null): SimulatorSettings {
  if (simulatorId && simulatorSettingsMap[simulatorId]) {
    return simulatorSettingsMap[simulatorId];
  }
  // デフォルトは投資シミュレーター
  return investmentConfig;
}
