import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/claude";

interface DiscoveredNeed {
  id: string;
  name: string;
  description: string;
  reason: string;
  sourceDocuments: string[];
  // BSC 4視点スコア
  financial: number;   // 財務視点
  customer: number;    // 顧客視点
  process: number;     // 業務プロセス視点
  growth: number;      // 学習と成長視点
}

interface MetaFinderResult {
  needs: DiscoveredNeed[];
  thinkingProcess: string;
  summary: string;
}

// ★★★ スコア正規化: 5点満点に強制変換 ★★★
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

const SYSTEM_PROMPT = `あなたは「メタファインダー」です。
企業の内部ドキュメントと与えられた文脈に基づいて、本質的な課題と打ち手を発見します。

## 重要な原則

**「追加の指示」セクションの内容を最優先してください。**

テーマと対象に応じて、最も価値のある洞察・提案を出力してください。
打ち手は「AIアプリ」に限定しません。組織変革、プロセス改善、人材育成、
新規事業、提携、撤退判断など、あらゆる施策が対象です。

## 出力形式（JSON）

{
  "needs": [
    {
      "id": "idea-1",
      "name": "課題・打ち手の名称",
      "description": "内容の説明（2-3文）",
      "reason": "なぜこれが重要か、背景・根拠",
      "sourceDocuments": ["参照した情報源（あれば）"],
      "financial": 1-5,
      "customer": 1-5,
      "process": 1-5,
      "growth": 1-5
    }
  ],
  "thinkingProcess": "どのような思考プロセスで発見したか",
  "summary": "分析のまとめ（2-3文）"
}

## 評価基準：バランススコアカード（BSC）4視点

各アイデアを以下の4視点で評価してください（各1〜5点の整数・5点満点厳守）：

1. **financial（財務視点）**: 収益向上・コスト削減への貢献度
   - 5点: 大きな収益増または大幅なコスト削減が期待できる
   - 3点: 中程度の財務効果
   - 1点: 財務への直接的な影響は限定的

2. **customer（顧客視点）**: 顧客価値・満足度への貢献度
   - 5点: 顧客体験を大きく改善、差別化につながる
   - 3点: 顧客にとって一定のメリットがある
   - 1点: 顧客への直接的な影響は限定的

3. **process（業務プロセス視点）**: 業務効率・品質への貢献度
   - 5点: 業務を大幅に効率化、品質を飛躍的に向上
   - 3点: 一定の効率化・品質向上が見込める
   - 1点: 業務プロセスへの影響は限定的

4. **growth（学習と成長視点）**: 人材・組織能力への貢献度
   - 5点: 組織の能力を大きく高め、将来の競争力につながる
   - 3点: 一定のスキル向上・組織学習が期待できる
   - 1点: 人材・組織への影響は限定的

※スコアは必ず1, 2, 3, 4, 5のいずれか。6以上は禁止。
※4視点のバランスを意識し、すべて高評価にならないよう現実的に評価してください。

10〜20件を目安に出力してください。`;

// GET: 保存された分析結果を取得
export async function GET() {
  try {
    const results = await prisma.metaAnalysisRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Failed to fetch meta-finder results:", error);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}

// POST: 新しい分析を実行
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const additionalContext = body.additionalContext || "";
    const themeId = body.themeId || "holistic";
    const themeName = body.themeName || "全部入り（本質探索）";
    const deptId = body.deptId || "all";
    const deptName = body.deptName || "全社";

    // docs/summaries/ からドキュメントを取得
    const ragDocuments = await prisma.rAGDocument.findMany({
      select: {
        filename: true,
        content: true,
      },
    });

    if (ragDocuments.length === 0) {
      return NextResponse.json(
        { error: "分析対象のドキュメントがありません。docs/summaries/ にドキュメントを追加してください。" },
        { status: 400 }
      );
    }

    // ドキュメントをプロンプト用にフォーマット
    let documentContext = "## 分析対象ドキュメント\n\n";
    for (const doc of ragDocuments) {
      documentContext += `### ${doc.filename}\n${doc.content.slice(0, 5000)}\n\n`;
    }

    const userPrompt = `${documentContext}

${additionalContext ? `## 追加の指示\n${additionalContext}` : "## 指示\n上記のドキュメントを分析し、最も価値のある課題と打ち手を発見してください。"}`;

    const response = await generateWithClaude(
      `${SYSTEM_PROMPT}\n\n${userPrompt}`,
      {
        temperature: 0.7,
        maxTokens: 8000,
        jsonMode: true,
      }
    );

    const parsed: MetaFinderResult = JSON.parse(response);

    // ★★★ BSCスコアを5点満点に強制正規化 ★★★
    const result: MetaFinderResult = {
      ...parsed,
      needs: parsed.needs.map((need) => ({
        ...need,
        financial: normalizeScore(need.financial),
        customer: normalizeScore(need.customer),
        process: normalizeScore(need.process),
        growth: normalizeScore(need.growth),
      })),
    };

    // ★★★ 探索履歴を永久保存 ★★★
    // 1. バッチレコードを作成（単発探索用）
    const batchId = `manual-${Date.now()}`;
    await prisma.metaFinderBatch.create({
      data: {
        id: batchId,
        status: "completed",
        totalPatterns: 1,
        completedPatterns: 1,
        totalIdeas: result.needs.length,
        currentTheme: themeName,
        currentDept: deptName,
        completedAt: new Date(),
      },
    });

    // 2. 各アイデアをMetaFinderIdeaテーブルに保存
    // ★★★ スコアリングルール：BSC 4視点の平均 ★★★
    // score = (financial + customer + process + growth) / 4
    // 結果: 1.0 〜 5.0 の小数（平均値）
    for (const need of result.needs) {
      const score = (need.financial + need.customer + need.process + need.growth) / 4;
      await prisma.metaFinderIdea.create({
        data: {
          id: `idea-${batchId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          batchId,
          themeId,
          themeName,
          deptId,
          deptName,
          name: need.name,
          description: need.description,
          reason: need.reason,
          financial: need.financial,
          customer: need.customer,
          process: need.process,
          growth: need.growth,
          score,
        },
      });
    }

    // 3. 旧形式（MetaAnalysisRun）も互換性のため残す
    await prisma.metaAnalysisRun.create({
      data: {
        id: `meta-${Date.now()}`,
        totalExplorations: ragDocuments.length,
        totalStrategies: result.needs.length,
        topStrategies: JSON.stringify(result.needs.slice(0, 5)),
        frequentTags: JSON.stringify({}),
        clusters: JSON.stringify(result.needs.map(n => ({ name: n.name }))),
        blindSpots: JSON.stringify([]),
        thinkingProcess: result.thinkingProcess,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Meta-finder analysis failed:", error);
    return NextResponse.json(
      { error: "分析に失敗しました: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500 }
    );
  }
}
