import { BaseEngine, EngineInput } from './base-engine';
import type { DrafterConfig, InputField } from '../types';

/**
 * ドラフターのセクション
 */
export interface DrafterSection {
  id: string;
  title: string;
  content: string;
  order: number;
}

/**
 * ドラフターの実行結果
 */
export interface DrafterResult {
  content: string;
  format: 'markdown' | 'html' | 'docx';
  sections: DrafterSection[];
  thinkingProcess: string;
  suggestions?: string[];
}

/**
 * ドラフター型エンジン
 * テンプレートと入力材料から文書を生成する
 */
export class DrafterEngine extends BaseEngine<DrafterConfig, DrafterResult> {
  /**
   * 入力フィールドの説明を生成
   */
  private formatInputFields(userInput: Record<string, unknown>): string {
    return this.config.inputFields
      .map((field) => this.formatSingleField(field, userInput))
      .join('\n\n');
  }

  /**
   * 単一の入力フィールドをフォーマット
   */
  private formatSingleField(
    field: InputField,
    userInput: Record<string, unknown>
  ): string {
    const value = userInput[field.id];
    const valueStr = value !== undefined ? String(value) : '（未入力）';
    const requiredMark = field.required ? '【必須】' : '【任意】';

    return `### ${field.name} ${requiredMark}
${valueStr}`;
  }

  /**
   * 出力形式の指示を生成
   */
  private getOutputFormatInstruction(): string {
    return `必ず以下のJSON形式で回答してください：
{
  "content": "生成された文書の全文（${this.config.outputFormat}形式）",
  "sections": [
    {
      "id": "section-1",
      "title": "セクションタイトル",
      "content": "セクション内容",
      "order": 1
    }
  ],
  "thinkingProcess": "どのような思考プロセスで文書を構成したか",
  "suggestions": ["改善提案があれば"]
}`;
  }

  /**
   * ユーザープロンプトを構築
   */
  buildUserPrompt(input: EngineInput): string {
    return `## テンプレート

${this.config.template}

## 入力情報

${this.formatInputFields(input.userInput)}

## 参照情報（RAG）

${input.ragContext || 'なし'}

## 追加コンテキスト

${input.additionalContext || 'なし'}

## 指示

上記のテンプレートと入力情報を基に、「${this.config.name}」として文書を生成してください。
出力形式: ${this.config.outputFormat}

${this.getOutputFormatInstruction()}`;
  }

  /**
   * 結果を解析
   */
  parseResult(response: string): DrafterResult {
    const parsed = JSON.parse(response);

    return {
      content: parsed.content || '',
      format: this.config.outputFormat,
      sections: parsed.sections || [],
      thinkingProcess: parsed.thinkingProcess || '',
      suggestions: parsed.suggestions || [],
    };
  }

  /**
   * 必須フィールドが全て入力されているか確認
   */
  validateInput(userInput: Record<string, unknown>): {
    valid: boolean;
    missingFields: string[];
  } {
    const missingFields: string[] = [];

    for (const field of this.config.inputFields) {
      if (field.required) {
        const value = userInput[field.id];
        if (value === undefined || value === null || value === '') {
          missingFields.push(field.name);
        }
      }
    }

    return {
      valid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * 特定のセクションを取得
   */
  getSection(sections: DrafterSection[], sectionId: string): DrafterSection | undefined {
    return sections.find((s) => s.id === sectionId);
  }

  /**
   * Markdownに変換
   */
  toMarkdown(result: DrafterResult): string {
    if (result.format === 'markdown') {
      return result.content;
    }

    // セクションからMarkdownを生成
    return result.sections
      .sort((a, b) => a.order - b.order)
      .map((section) => `## ${section.title}\n\n${section.content}`)
      .join('\n\n');
  }
}
