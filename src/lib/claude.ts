import { AzureOpenAI } from "openai";

let client: AzureOpenAI | null = null;

function getClient(): AzureOpenAI {
  if (!client) {
    client = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: "2024-08-01-preview",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    });
  }
  return client;
}

export interface WinningStrategy {
  name: string;
  reason: string;
  howToObtain: string;
  metrics: string;
  confidence: "high" | "medium" | "low";
  tags: string[];
}

export interface ExplorationResult {
  strategies: WinningStrategy[];
  thinkingProcess: string;
  followUpQuestions?: string[];
}

export async function generateWinningStrategies(
  question: string,
  context: string,
  coreServices: string,
  coreAssets: string,
  constraints: string,
  ragContext: string
): Promise<ExplorationResult> {
  const systemPrompt = `あなたは「勝ち筋ファインダーVer.0.5」のAIアシスタントです。
海運グループ企業の戦略立案を支援します。

## あなたの役割
現場が持っている力（実績・技術・ノウハウ）を、AIの視点で増幅し、具体的な戦略オプション（勝ち筋）に変換します。

## 重要な原則
1. 既存リソースの活用を優先する
2. 実行可能な提案のみ行う
3. 抽象的ではなく具体的に
4. 3社統合のシナジーを意識する

## 出力形式
必ず以下のJSON形式で回答してください：
{
  "strategies": [
    {
      "name": "勝ち筋名（簡潔に）",
      "reason": "なぜこれが勝ち筋か（既存の強みとの関連）",
      "howToObtain": "具体的な入手方法・アクション",
      "metrics": "成功を測る指標例",
      "confidence": "high/medium/low",
      "tags": ["タグ1", "タグ2"]
    }
  ],
  "thinkingProcess": "どのような思考プロセスでこれらの勝ち筋を導いたか",
  "followUpQuestions": ["追加で確認したい質問（あれば）"]
}

10〜20件の勝ち筋を生成してください。`;

  const userPrompt = `## 問い
${question}

## 追加文脈
${context || "なし"}

## 登録済みサービス・機能
${coreServices || "未登録"}

## 登録済み資産・強み
${coreAssets || "未登録"}

## 制約条件
${constraints}

## 外部情報（RAG）
${ragContext || "取得できませんでした"}

上記の情報を踏まえ、勝ち筋を提案してください。`;

  console.log("Starting Azure OpenAI request...");
  const response = await getClient().chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_completion_tokens: 16000,
    response_format: { type: "json_object" },
  });

  console.log("Response finish_reason:", response.choices[0]?.finish_reason);
  console.log("Response tokens:", JSON.stringify(response.usage));
  const content = response.choices[0]?.message?.content;
  if (!content) {
    console.error("No content in response. finish_reason:", response.choices[0]?.finish_reason);
    throw new Error("No response from AI");
  }

  try {
    return JSON.parse(content) as ExplorationResult;
  } catch {
    // If JSON parsing fails, try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ExplorationResult;
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}
