import { BaseEngine, EngineInput, EngineOutput } from './base-engine';
import type { FinderConfig, EvaluationAxis } from '../types';

/**
 * ファインダーで発見されたアイテム
 */
export interface FinderItem {
  id?: string;
  name: string;
  description: string;
  reason: string;
  howToObtain?: string;
  metrics?: string;
  scores: Record<string, number>;
  totalScore: number;
  tags: string[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * ファインダーの実行結果
 */
export interface FinderResult {
  items: FinderItem[];
  thinkingProcess: string;
  followUpQuestions?: string[];
}

/**
 * ファインダー型エンジン
 * 多軸評価でアイテムを発見・スコアリングする
 */
export class FinderEngine extends BaseEngine<FinderConfig, FinderResult> {
  /**
   * 評価軸の説明を生成
   */
  private formatEvaluationAxes(): string {
    return this.config.evaluationAxes
      .map((axis) => this.formatSingleAxis(axis))
      .join('\n\n');
  }

  /**
   * 単一の評価軸をフォーマット
   */
  private formatSingleAxis(axis: EvaluationAxis): string {
    const levels = axis.scoringGuide
      .map((level) => `- ${level.score}点: ${level.description}`)
      .join('\n');

    return `### ${axis.name} (重み: ${axis.weight}%)
${axis.description}

**スコアリング基準:**
${levels}`;
  }

  /**
   * 出力形式の指示を生成
   */
  private getOutputFormatInstruction(): string {
    const axisIds = this.config.evaluationAxes.map(a => `"${a.id}": 1-${a.maxScore}`).join(',\n        ');

    return `必ず以下のJSON形式で回答してください：
{
  "items": [
    {
      "name": "アイテム名（簡潔に）",
      "description": "何か（1-2文）",
      "reason": "なぜこれが重要か",
      "howToObtain": "具体的な実現ステップ",
      "metrics": "成功を測る指標",
      "confidence": "high/medium/low",
      "tags": ["タグ1", "タグ2"],
      "scores": {
        ${axisIds}
      }
    }
  ],
  "thinkingProcess": "どのような思考プロセスでこれらを導いたか",
  "followUpQuestions": ["追加で確認したい質問"]
}

10〜20件のアイテムを生成してください。スコアは厳密に評価し、すべて高評価にならないよう現実的に判定してください。`;
  }

  /**
   * ユーザープロンプトを構築
   */
  buildUserPrompt(input: EngineInput): string {
    return `## 評価軸

${this.formatEvaluationAxes()}

## 入力情報

${this.formatUserInput(input.userInput)}

## 外部情報（RAG）

${input.ragContext || '取得できませんでした'}

## 追加コンテキスト

${input.additionalContext || 'なし'}

## 出力形式

${this.getOutputFormatInstruction()}`;
  }

  /**
   * ユーザー入力をフォーマット
   */
  private formatUserInput(userInput: Record<string, unknown>): string {
    const entries = Object.entries(userInput);
    if (entries.length === 0) {
      return 'なし';
    }

    return entries
      .map(([key, value]) => `**${key}:** ${value}`)
      .join('\n');
  }

  /**
   * 結果を解析
   */
  parseResult(response: string): FinderResult {
    const parsed = JSON.parse(response);

    // アイテムの総合スコアを計算とID付与
    const items = (parsed.items || parsed.strategies || []).map((item: FinderItem, index: number) => ({
      ...item,
      id: item.id || `item-${index + 1}`,
      totalScore: this.calculateTotalScore(item.scores),
    }));

    // スコアでソート（降順）
    items.sort((a: FinderItem, b: FinderItem) => b.totalScore - a.totalScore);

    return {
      items,
      thinkingProcess: parsed.thinkingProcess || '',
      followUpQuestions: parsed.followUpQuestions || [],
    };
  }

  /**
   * 総合スコアを計算
   */
  calculateTotalScore(scores: Record<string, number>): number {
    const totalWeight = this.config.evaluationAxes.reduce(
      (sum, axis) => sum + axis.weight,
      0
    );

    if (totalWeight === 0) return 0;

    let weightedSum = 0;
    for (const axis of this.config.evaluationAxes) {
      const score = scores[axis.id] || 0;
      const normalizedScore = score / axis.maxScore; // 0-1に正規化
      weightedSum += normalizedScore * axis.weight;
    }

    // 0-100のスコアとして返す
    return Math.round((weightedSum / totalWeight) * 100);
  }

  /**
   * 特定の軸のスコアでフィルタリング
   */
  filterByAxisScore(
    items: FinderItem[],
    axisId: string,
    minScore: number
  ): FinderItem[] {
    return items.filter((item) => (item.scores[axisId] || 0) >= minScore);
  }

  /**
   * タグでフィルタリング
   */
  filterByTags(items: FinderItem[], tags: string[]): FinderItem[] {
    return items.filter((item) =>
      tags.some((tag) => item.tags.includes(tag))
    );
  }

  /**
   * 信頼度でフィルタリング
   */
  filterByConfidence(
    items: FinderItem[],
    minConfidence: 'high' | 'medium' | 'low'
  ): FinderItem[] {
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    const minOrder = confidenceOrder[minConfidence];

    return items.filter(
      (item) => confidenceOrder[item.confidence] >= minOrder
    );
  }
}
