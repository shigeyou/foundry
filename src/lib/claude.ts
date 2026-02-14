import { AzureOpenAI } from "openai";
import { prisma } from "@/lib/db";
import { getFinderSettings } from "@/config/finder-config";

let client: AzureOpenAI | null = null;

// 対象企業プロファイルの型
interface CompanyProfile {
  name: string;
  shortName?: string | null;
  description?: string | null;
  background?: string | null;
  techStack?: string | null;
  parentCompany?: string | null;
  parentRelation?: string | null;
  industry?: string | null;
  additionalContext?: string | null;
}

// 対象企業プロファイルを取得
async function getCompanyProfile(): Promise<CompanyProfile | null> {
  try {
    const profile = await prisma.companyProfile.findUnique({
      where: { id: "default" },
    });
    return profile;
  } catch (error) {
    console.error("Failed to fetch company profile:", error);
    return null;
  }
}

// 対象企業セクションを生成
function buildCompanySection(profile: CompanyProfile | null): string {
  if (!profile) {
    return `## 対象企業
対象企業が設定されていません。「設定」タブから対象企業の情報を登録してください。
勝ち筋探索を行う前に、対象企業の基本情報を設定することを推奨します。`;
  }

  let section = `## 対象企業（勝ち筋を探す主体）
**${profile.name}${profile.shortName ? `（${profile.shortName}）` : ""}**`;

  if (profile.industry) {
    section += `\n- 業界: ${profile.industry}`;
  }

  if (profile.description) {
    section += `\n- ${profile.description}`;
  }

  if (profile.background) {
    section += `\n- ${profile.background}`;
  }

  if (profile.parentCompany) {
    section += `\n\n### 親会社との関係`;
    section += `\n親会社: ${profile.parentCompany}`;
    if (profile.parentRelation) {
      section += `\n${profile.parentRelation}`;
    }
    section += `\n※ RAGに親会社の情報が含まれる場合、それは参考情報です。勝ち筋は${profile.shortName || profile.name}の視点で探索してください。`;
  }

  if (profile.techStack) {
    section += `\n\n### 技術基盤\n${profile.techStack}`;
  }

  if (profile.additionalContext) {
    section += `\n\n### その他の文脈\n${profile.additionalContext}`;
  }

  return section;
}

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

// ★★★ スコア正規化: 5点満点に強制変換 ★★★
// AIが10点満点で返した場合は5点満点に変換、範囲外の値はクランプ
const MAX_SCORE = 5;
function normalizeScore(value: number): number {
  if (typeof value !== "number" || isNaN(value)) return 1;
  // 6以上の場合は10点満点と見なして5点満点に変換
  if (value > MAX_SCORE) {
    return Math.round((value / 10) * MAX_SCORE);
  }
  // 1未満は1に、5超は5にクランプ
  return Math.max(1, Math.min(MAX_SCORE, Math.round(value)));
}

function normalizeStrategyScores(scores: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(scores)) {
    normalized[key] = normalizeScore(value);
  }
  return normalized;
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

// finderIdに応じたシステムプロンプトを構築
function buildFinderSystemPrompt(finderId: string, companySection: string, companyName: string): string {
  const settings = getFinderSettings(finderId);

  // スコア定義を動的に構築（finder-config.tsのscoreConfigから）
  // ★★★ 重要: スコアは必ず1〜5点の整数 ★★★
  const labels = "ABCDEFGHIJ";
  const scoreDefinitions = settings.scoreConfig
    .map((sc, i) => `${labels[i]}. ${sc.label}（${sc.key}）：${sc.description}\n- 5点：非常に優れている（最高点）\n- 4点：優れている\n- 3点：一定の水準\n- 2点：やや不足\n- 1点：効果が限定的（最低点）`)
    .join("\n\n");

  // スコアキーのJSON部分を構築
  const scoreJsonKeys = settings.scoreConfig
    .map((sc) => `        "${sc.key}": 1-5`)
    .join(",\n");

  return `あなたは「${settings.name}」のAIアシスタントです。

${companySection}

## あなたの役割
${companyName}について、${settings.description}

## 重要な原則
1. 既存リソースの活用を優先する
2. 実行可能な提案のみ行う
3. 抽象的ではなく具体的に
4. 組織のシナジーを意識する

## 評価基準（各1〜5点の整数・5点満点厳守）
【重要】スコアは必ず1, 2, 3, 4, 5のいずれかの整数で評価してください。6以上や小数は禁止です。
各${settings.resultLabel}を以下の${settings.scoreConfig.length}軸で評価してください：

${scoreDefinitions}

## 出力形式
必ず以下のJSON形式で回答してください：
{
  "strategies": [
    {
      "name": "${settings.resultLabel}名（簡潔に）",
      "reason": "なぜこれが重要か（既存の強みとの関連）",
      "howToObtain": "具体的な実現ステップ・アクション",
      "metrics": "成功を測る指標例",
      "confidence": "high/medium/low",
      "tags": ["タグ1", "タグ2"],
      "scores": {
${scoreJsonKeys}
      }
    }
  ],
  "thinkingProcess": "どのような思考プロセスでこれらの${settings.resultLabel}を導いたか",
  "followUpQuestions": ["追加で確認したい質問（あれば）"]
}

10〜20件の${settings.resultLabel}を生成してください。スコアは厳密に評価し、すべて高評価にならないよう現実的に判定してください。${
  settings.departmentBadgeEnabled
    ? `

## 事業部・部門の割り当て
tagsフィールドの最初の要素には、その${settings.resultLabel}が最も活躍できる事業部・部門名を入れてください。
事業部名はRAGドキュメント（企業情報）や対象企業の情報から抽出してください。
例: "tags": ["海技部", "エンジニアリング", "AI活用"]
事業部が特定できない場合は「全社共通」としてください。
tagsの2番目以降には、スキル分野や役割など自由なタグを入れてください。`
    : ""
}`;
}

export async function generateWinningStrategies(
  question: string,
  context: string,
  coreServices: string,
  coreAssets: string,
  constraints: string,
  ragContext: string,
  finderId?: string
): Promise<ExplorationResult> {
  // 学習パターンと対象企業プロファイルを並行取得
  const [{ successPatterns, failurePatterns }, companyProfile] = await Promise.all([
    getLearningPatterns(),
    getCompanyProfile(),
  ]);

  // 対象企業セクションを動的に生成
  const companySection = buildCompanySection(companyProfile);
  const companyName = companyProfile?.shortName || companyProfile?.name || "対象企業";

  // finderId に応じたプロンプトを構築
  const systemPrompt = buildFinderSystemPrompt(finderId || "winning-strategy", companySection, companyName);

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
    const parsed = JSON.parse(content) as ExplorationResult;
    // ★★★ スコアを5点満点に強制正規化 ★★★
    if (parsed.strategies) {
      parsed.strategies = parsed.strategies.map((s) => ({
        ...s,
        scores: s.scores ? normalizeStrategyScores(s.scores as unknown as Record<string, number>) as unknown as StrategyScores : s.scores,
      }));
    }
    return parsed;
  } catch {
    // If JSON parsing fails, try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as ExplorationResult;
      // ★★★ スコアを5点満点に強制正規化 ★★★
      if (parsed.strategies) {
        parsed.strategies = parsed.strategies.map((s) => ({
          ...s,
          scores: s.scores ? normalizeStrategyScores(s.scores as unknown as Record<string, number>) as unknown as StrategyScores : s.scores,
        }));
      }
      return parsed;
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
