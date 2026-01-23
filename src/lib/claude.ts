import { AzureOpenAI } from "openai";
import { prisma } from "@/lib/db";

let client: AzureOpenAI | null = null;

// 学習パターンを取得
async function getLearningPatterns(): Promise<{
  successPatterns: string[];
  failurePatterns: string[];
}> {
  try {
    const patterns = await prisma.learningMemory.findMany({
      where: {
        isActive: true,
        confidence: { gte: 0.5 }, // 確信度50%以上のみ
      },
      orderBy: [{ confidence: "desc" }, { validationCount: "desc" }],
      take: 10, // 上位10件
    });

    const successPatterns = patterns
      .filter((p) => p.type === "success_pattern")
      .map((p) => `- [${p.category || "一般"}] ${p.pattern}`);

    const failurePatterns = patterns
      .filter((p) => p.type === "failure_pattern")
      .map((p) => `- [${p.category || "一般"}] ${p.pattern}`);

    // 使用カウントを更新
    const usedIds = patterns.map((p) => p.id);
    if (usedIds.length > 0) {
      await prisma.learningMemory.updateMany({
        where: { id: { in: usedIds } },
        data: {
          usedCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    }

    return { successPatterns, failurePatterns };
  } catch (error) {
    console.error("Failed to fetch learning patterns:", error);
    return { successPatterns: [], failurePatterns: [] };
  }
}

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

export interface StrategyScores {
  revenuePotential: number;      // A: 収益ポテンシャル (1-5)
  timeToRevenue: number;         // B: 収益化までの距離 (1-5)
  competitiveAdvantage: number;  // C: 勝ち筋の強さ (1-5)
  executionFeasibility: number;  // D: 実行可能性 (1-5)
  hqContribution: number;        // E: 本社貢献 (1-5)
  mergerSynergy: number;         // F: 合併シナジー (1-5)
}

export interface WinningStrategy {
  name: string;
  reason: string;
  howToObtain: string;
  metrics: string;
  confidence: "high" | "medium" | "low";
  tags: string[];
  scores: StrategyScores;
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
  // 学習パターンを取得
  const { successPatterns, failurePatterns } = await getLearningPatterns();

  const systemPrompt = `あなたは「勝ち筋ファインダーVer.0.5」のAIアシスタントです。
海運グループ企業の戦略立案を支援します。

## あなたの役割
現場が持っている力（実績・技術・ノウハウ）を、AIの視点で増幅し、具体的な戦略オプション（勝ち筋）に変換します。

## 重要な原則
1. 既存リソースの活用を優先する
2. 実行可能な提案のみ行う
3. 抽象的ではなく具体的に
4. 3社統合のシナジーを意識する

## 技術基盤
商船三井マリテックスでは、マイクロソフトのAzure環境を商船三井と共有しており、機密性が高いプライバシーやセキュリティが高い環境で各種の自社アプリケーションの開発が可能である。すでに生成AIを活用した各種アプリケーションの自社開発を進めている。これを武器として、今後のDXに活かしたい。

## 評価基準（各1〜5点）
各勝ち筋を以下の6軸で評価してください：

A. 収益ポテンシャル（revenuePotential）：儲かる大きさ
- 5点：市場が大きく、単価と量の両方が立つ。勝てば会社の柱になる
- 3点：特定領域で十分な利益が出る。部門の柱にはなる
- 1点：良い話だが、上限が小さく事業になりにくい

B. 収益化までの距離（timeToRevenue）：いつ儲かるか
- 5点：3〜12か月で課金検証まで進める
- 3点：12〜24か月
- 1点：3年超。規制や大規模投資が前提

C. 勝ち筋の強さ（competitiveAdvantage）：なぜ自社が勝てるか
- 5点：自社にしかない資産が決定的に効く
- 3点：優位性はあるが、模倣も可能
- 1点：誰でもできる。価格競争になりやすい

D. 実行可能性（executionFeasibility）：作れる、売れる、運用できる
- 5点：必要なデータ、システム、体制、意思決定が揃っている
- 3点：不足はあるが、半年以内に埋められる
- 1点：権限、データ、現場運用のいずれかが欠けて詰む

E. 本社貢献（hqContribution）：グループとして意味があるか
- 5点：本社の戦略テーマや収益に直結し、横展開できる
- 3点：間接効果はあるが、主戦場ではない
- 1点：ローカル最適で、説明が難しい

F. 合併シナジー（mergerSynergy）：1社では出ない価値が出るか
- 5点：両社の資産が掛け算になる
- 3点：足し算の効率化レベル
- 1点：シナジーが薄く、調整コストが勝つ

## 出力形式
必ず以下のJSON形式で回答してください：
{
  "strategies": [
    {
      "name": "勝ち筋名（簡潔に）",
      "reason": "なぜこれが勝ち筋か（既存の強みとの関連）",
      "howToObtain": "具体的な実現ステップ・アクション",
      "metrics": "成功を測る指標例",
      "confidence": "high/medium/low",
      "tags": ["タグ1", "タグ2"],
      "scores": {
        "revenuePotential": 1-5,
        "timeToRevenue": 1-5,
        "competitiveAdvantage": 1-5,
        "executionFeasibility": 1-5,
        "hqContribution": 1-5,
        "mergerSynergy": 1-5
      }
    }
  ],
  "thinkingProcess": "どのような思考プロセスでこれらの勝ち筋を導いたか",
  "followUpQuestions": ["追加で確認したい質問（あれば）"]
}

10〜20件の勝ち筋を生成してください。スコアは厳密に評価し、すべて高評価にならないよう現実的に判定してください。`;

  // 学習パターンセクションを構築
  const learningSection = (successPatterns.length > 0 || failurePatterns.length > 0)
    ? `
## 過去の学習（ユーザーの採否から抽出されたパターン）
${successPatterns.length > 0 ? `
### 成功パターン（これらの特徴を持つ戦略は採用されやすい）
${successPatterns.join("\n")}
` : ""}
${failurePatterns.length > 0 ? `
### 失敗パターン（これらの特徴を持つ戦略は却下されやすい）
${failurePatterns.join("\n")}
` : ""}
上記パターンを参考に、成功パターンに沿った戦略を優先し、失敗パターンに該当する戦略は避けてください。
`
    : "";

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
${learningSection}
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

// Generic Claude/OpenAI generation function
export async function generateWithClaude(
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4",
    messages: [
      { role: "user", content: prompt },
    ],
    temperature: options?.temperature ?? 0.7,
    max_completion_tokens: options?.maxTokens ?? 4000,
    ...(options?.jsonMode && { response_format: { type: "json_object" as const } }),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return content;
}
