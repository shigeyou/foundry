import { generate, generateJSON } from '../llm';
import type { LLMOptions } from '../types';

/**
 * エンジン入力の共通インターフェース
 */
export interface EngineInput {
  userInput: Record<string, unknown>;
  ragContext?: string;
  additionalContext?: string;
}

/**
 * エンジン出力の共通インターフェース
 */
export interface EngineOutput<T> {
  result: T;
  thinkingProcess: string;
  metadata: {
    duration: number;
    tokensUsed?: number;
  };
}

/**
 * エンジン設定の基底インターフェース
 */
export interface BaseEngineConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
}

/**
 * 全てのエンジンの基底クラス
 * ファインダー、ドラフター、シミュレーターはこのクラスを継承する
 */
export abstract class BaseEngine<TConfig extends BaseEngineConfig, TResult> {
  protected config: TConfig;
  protected llmOptions: LLMOptions;

  constructor(config: TConfig, llmOptions?: LLMOptions) {
    this.config = config;
    this.llmOptions = {
      temperature: 0.7,
      maxTokens: 16000,
      jsonMode: true,
      ...llmOptions,
    };
  }

  /**
   * ユーザープロンプトを構築する（サブクラスで実装）
   */
  abstract buildUserPrompt(input: EngineInput): string;

  /**
   * LLMの応答を解析する（サブクラスで実装）
   */
  abstract parseResult(response: string): TResult;

  /**
   * 思考プロセスを抽出する
   */
  protected extractThinkingProcess(parsed: unknown): string {
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.thinkingProcess === 'string') {
        return obj.thinkingProcess;
      }
    }
    return '';
  }

  /**
   * エンジンを実行する
   */
  async run(input: EngineInput): Promise<EngineOutput<TResult>> {
    const startTime = Date.now();

    const userPrompt = this.buildUserPrompt(input);
    const fullPrompt = `${this.config.systemPrompt}\n\n${userPrompt}`;

    let response: string;
    if (this.llmOptions.jsonMode) {
      response = JSON.stringify(await generateJSON(fullPrompt, this.llmOptions));
    } else {
      response = await generate(fullPrompt, this.llmOptions);
    }

    const result = this.parseResult(response);
    const parsed = JSON.parse(response);

    return {
      result,
      thinkingProcess: this.extractThinkingProcess(parsed),
      metadata: {
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * 設定を取得
   */
  getConfig(): TConfig {
    return this.config;
  }

  /**
   * 設定IDを取得
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * 名前を取得
   */
  getName(): string {
    return this.config.name;
  }
}
