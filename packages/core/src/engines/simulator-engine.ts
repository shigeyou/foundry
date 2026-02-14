import { BaseEngine, EngineInput } from './base-engine';
import type { SimulatorConfig, AssumptionField, ScenarioTemplate } from '../types';

/**
 * タイムラインのポイント
 */
export interface TimelinePoint {
  period: string;
  events: string[];
  metrics: Record<string, number>;
}

/**
 * シミュレートされたシナリオ
 */
export interface SimulatedScenario {
  id: string;
  name: string;
  description: string;
  assumptions: Record<string, unknown>;
  outcomes: {
    summary: string;
    timeline: TimelinePoint[];
    metrics: Record<string, number>;
    risks: string[];
    opportunities: string[];
  };
}

/**
 * シナリオ比較
 */
export interface ScenarioComparison {
  bestCase: string;
  worstCase: string;
  recommendation: string;
  keyDecisionPoints: string[];
  tradeoffs: string[];
}

/**
 * シミュレーターの実行結果
 */
export interface SimulatorResult {
  scenarios: SimulatedScenario[];
  comparison: ScenarioComparison;
  thinkingProcess: string;
}

/**
 * シミュレーター型エンジン
 * 仮定を置いて将来を予測し、複数シナリオを比較する
 */
export class SimulatorEngine extends BaseEngine<SimulatorConfig, SimulatorResult> {
  /**
   * 仮定条件の説明を生成
   */
  private formatAssumptions(userInput: Record<string, unknown>): string {
    return this.config.assumptions
      .map((assumption) => this.formatSingleAssumption(assumption, userInput))
      .join('\n');
  }

  /**
   * 単一の仮定条件をフォーマット
   */
  private formatSingleAssumption(
    assumption: AssumptionField,
    userInput: Record<string, unknown>
  ): string {
    const value = userInput[assumption.id] ?? assumption.defaultValue;
    const rangeStr = assumption.range
      ? ` (範囲: ${assumption.range.min}〜${assumption.range.max})`
      : '';

    return `- **${assumption.name}**: ${value}${rangeStr}`;
  }

  /**
   * シナリオ設定の説明を生成
   */
  private formatScenarios(): string {
    return this.config.scenarios
      .map((scenario) => this.formatSingleScenario(scenario))
      .join('\n\n');
  }

  /**
   * 単一のシナリオをフォーマット
   */
  private formatSingleScenario(scenario: ScenarioTemplate): string {
    const modifiers = Object.entries(scenario.modifiers)
      .map(([key, value]) => `  - ${key}: ${value}`)
      .join('\n');

    return `### ${scenario.name}
${scenario.description}

**調整係数:**
${modifiers || '  なし'}`;
  }

  /**
   * 出力形式の指示を生成
   */
  private getOutputFormatInstruction(): string {
    const scenarioIds = this.config.scenarios.map((s) => s.id);

    return `必ず以下のJSON形式で回答してください：
{
  "scenarios": [
    {
      "id": "${scenarioIds[0] || 'scenario-1'}",
      "name": "シナリオ名",
      "description": "シナリオの説明",
      "assumptions": { "仮定ID": "適用された値" },
      "outcomes": {
        "summary": "結果の要約",
        "timeline": [
          {
            "period": "1年目",
            "events": ["起こること1", "起こること2"],
            "metrics": { "指標名": 数値 }
          }
        ],
        "metrics": { "ROI": 15, "paybackPeriod": 3 },
        "risks": ["リスク1", "リスク2"],
        "opportunities": ["機会1", "機会2"]
      }
    }
  ],
  "comparison": {
    "bestCase": "最も良いシナリオのID",
    "worstCase": "最も悪いシナリオのID",
    "recommendation": "推奨事項",
    "keyDecisionPoints": ["判断ポイント1", "判断ポイント2"],
    "tradeoffs": ["トレードオフ1", "トレードオフ2"]
  },
  "thinkingProcess": "どのような思考プロセスでシミュレーションしたか"
}

${this.config.scenarios.length}つのシナリオ（${scenarioIds.join(', ')}）をすべてシミュレートしてください。`;
  }

  /**
   * ユーザープロンプトを構築
   */
  buildUserPrompt(input: EngineInput): string {
    return `## 仮定条件

${this.formatAssumptions(input.userInput)}

## シナリオ設定

${this.formatScenarios()}

## 参照情報（RAG）

${input.ragContext || 'なし'}

## 追加コンテキスト

${input.additionalContext || 'なし'}

## 指示

上記の仮定条件とシナリオ設定を基に、「${this.config.name}」としてシミュレーションを実行してください。

${this.getOutputFormatInstruction()}`;
  }

  /**
   * 結果を解析
   */
  parseResult(response: string): SimulatorResult {
    const parsed = JSON.parse(response);

    return {
      scenarios: parsed.scenarios || [],
      comparison: parsed.comparison || {
        bestCase: '',
        worstCase: '',
        recommendation: '',
        keyDecisionPoints: [],
        tradeoffs: [],
      },
      thinkingProcess: parsed.thinkingProcess || '',
    };
  }

  /**
   * 特定のシナリオを取得
   */
  getScenario(
    scenarios: SimulatedScenario[],
    scenarioId: string
  ): SimulatedScenario | undefined {
    return scenarios.find((s) => s.id === scenarioId);
  }

  /**
   * シナリオを指標でソート
   */
  sortByMetric(
    scenarios: SimulatedScenario[],
    metricKey: string,
    ascending: boolean = false
  ): SimulatedScenario[] {
    return [...scenarios].sort((a, b) => {
      const valueA = a.outcomes.metrics[metricKey] || 0;
      const valueB = b.outcomes.metrics[metricKey] || 0;
      return ascending ? valueA - valueB : valueB - valueA;
    });
  }

  /**
   * 最良のシナリオを取得
   */
  getBestScenario(result: SimulatorResult): SimulatedScenario | undefined {
    return this.getScenario(result.scenarios, result.comparison.bestCase);
  }

  /**
   * 最悪のシナリオを取得
   */
  getWorstScenario(result: SimulatorResult): SimulatedScenario | undefined {
    return this.getScenario(result.scenarios, result.comparison.worstCase);
  }
}
