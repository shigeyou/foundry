import { AzureOpenAI } from 'openai';
import type { LLMOptions, LLMConfig } from '../types';

let client: AzureOpenAI | null = null;
let currentConfig: LLMConfig | null = null;

/**
 * LLMクライアントを初期化
 */
export function initializeLLM(config: LLMConfig): void {
  currentConfig = config;
  client = new AzureOpenAI({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    apiVersion: config.apiVersion || '2024-08-01-preview',
    deployment: config.deployment,
  });
}

/**
 * 環境変数からLLMクライアントを初期化
 */
export function initializeLLMFromEnv(): void {
  const config: LLMConfig = {
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || '',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
  };
  initializeLLM(config);
}

/**
 * LLMクライアントを取得（未初期化の場合は環境変数から初期化）
 */
function getClient(): AzureOpenAI {
  if (!client) {
    initializeLLMFromEnv();
  }
  if (!client) {
    throw new Error('LLM client not initialized. Call initializeLLM() first.');
  }
  return client;
}

/**
 * LLMで生成を実行
 */
export async function generate(
  prompt: string,
  options?: LLMOptions
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: currentConfig?.deployment || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
    messages: [
      { role: 'user', content: prompt },
    ],
    temperature: options?.temperature ?? 0.7,
    max_completion_tokens: options?.maxTokens ?? 4000,
    ...(options?.jsonMode && { response_format: { type: 'json_object' as const } }),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  return content;
}

/**
 * システムプロンプトとユーザープロンプトで生成を実行
 */
export async function generateWithSystem(
  systemPrompt: string,
  userPrompt: string,
  options?: LLMOptions
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: currentConfig?.deployment || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options?.temperature ?? 0.7,
    max_completion_tokens: options?.maxTokens ?? 4000,
    ...(options?.jsonMode && { response_format: { type: 'json_object' as const } }),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  return content;
}

/**
 * JSON形式で生成を実行
 */
export async function generateJSON<T>(
  prompt: string,
  options?: Omit<LLMOptions, 'jsonMode'>
): Promise<T> {
  const response = await generate(prompt, { ...options, jsonMode: true });
  try {
    return JSON.parse(response) as T;
  } catch {
    // JSONパースに失敗した場合、レスポンスからJSONを抽出を試みる
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    throw new Error('Failed to parse AI response as JSON');
  }
}
