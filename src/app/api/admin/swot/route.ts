import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/claude";

// GET: デフォルトSWOTを取得
export async function GET() {
  try {
    const swot = await prisma.defaultSwot.findUnique({
      where: { id: "default" },
    });

    if (!swot) {
      return NextResponse.json({
        exists: false,
        message: "デフォルトSWOTが未設定です",
      });
    }

    return NextResponse.json({
      exists: true,
      swot: {
        strengths: JSON.parse(swot.strengths),
        weaknesses: JSON.parse(swot.weaknesses),
        opportunities: JSON.parse(swot.opportunities),
        threats: JSON.parse(swot.threats),
        summary: swot.summary,
        updatedAt: swot.updatedAt,
        updatedBy: swot.updatedBy,
      },
    });
  } catch (error) {
    console.error("Admin SWOT GET error:", error);
    return NextResponse.json(
      { error: "SWOT取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: デフォルトSWOTを作成/更新（手動またはAI生成）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { regenerate, additionalInfo, strengths, weaknesses, opportunities, threats, summary, updatedBy } = body;

    // AI生成モード
    if (regenerate) {
      // コア情報を取得
      const coreServices = await prisma.coreService.findMany();
      const servicesText = coreServices.length > 0
        ? coreServices.map(s => `- ${s.name}${s.category ? ` (${s.category})` : ""}${s.description ? `: ${s.description}` : ""}`).join("\n")
        : "";

      // RAGドキュメントも参照
      const ragDocuments = await prisma.rAGDocument.findMany({
        select: { filename: true, content: true },
        take: 10,
      });
      const ragContext = ragDocuments.length > 0
        ? ragDocuments.map(d => `### ${d.filename}\n${d.content.substring(0, 3000)}`).join("\n\n")
        : "";

      const prompt = `あなたは企業戦略コンサルタントです。以下の情報を基にSWOT分析を行ってください。

## 最重要ルール（必ず遵守）
1. 「登録サービスなし」「サービスが未登録」「登録がない」等の表現を絶対に使用しないでください。
2. 本システムへの登録状況は分析対象外です。登録の有無について一切言及しないでください。
3. RAGドキュメント（会社資料）に記載されている事業・サービス・実績こそが正式な情報源です。
4. 下記「追加登録サービス」欄が空欄でも、それは「RAGドキュメントと重複を避けるため意図的に空欄」であり、サービスが存在しないわけではありません。

${servicesText ? `## 追加登録サービス（RAGドキュメントへの補足）
${servicesText}

` : ""}${ragContext ? `## 会社資料（RAGドキュメント）※最も重要な情報源
${ragContext}

` : ""}${additionalInfo ? `## 補足情報・追加資料
${additionalInfo}

` : ""}## 出力形式
必ず以下のJSON形式で回答してください：
{
  "strengths": ["強み1", "強み2", ...],
  "weaknesses": ["弱み1", "弱み2", ...],
  "opportunities": ["機会1", "機会2", ...],
  "threats": ["脅威1", "脅威2", ...],
  "summary": "SWOT分析のサマリー（2-3文）"
}

## 分析ガイドライン
- 各項目は5〜8個程度、具体的かつ実用的な内容にしてください。
- RAGドキュメントに記載されている会社情報・事業内容・強みを最大限活用してください。
- 海運グループ企業の視点で、市場環境や競合状況も考慮してください。
- サマリーには「登録」「未登録」「システム」等のメタ情報を含めず、純粋に事業戦略の観点で記述してください。`;

      console.log("Generating SWOT analysis with AI...");
      const aiResponse = await generateWithClaude(prompt, {
        temperature: 0.7,
        maxTokens: 4000,
        jsonMode: true,
      });

      let swotData;
      try {
        swotData = JSON.parse(aiResponse);
      } catch {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          swotData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("AI応答のパースに失敗しました");
        }
      }

      // バリデーション
      if (!swotData.strengths || !Array.isArray(swotData.strengths) || swotData.strengths.length === 0) {
        throw new Error("AI生成結果にstrengthsがありません");
      }

      // DBに保存
      const swot = await prisma.defaultSwot.upsert({
        where: { id: "default" },
        update: {
          strengths: JSON.stringify(swotData.strengths),
          weaknesses: JSON.stringify(swotData.weaknesses || []),
          opportunities: JSON.stringify(swotData.opportunities || []),
          threats: JSON.stringify(swotData.threats || []),
          summary: swotData.summary || null,
          updatedBy: "AI生成",
        },
        create: {
          id: "default",
          strengths: JSON.stringify(swotData.strengths),
          weaknesses: JSON.stringify(swotData.weaknesses || []),
          opportunities: JSON.stringify(swotData.opportunities || []),
          threats: JSON.stringify(swotData.threats || []),
          summary: swotData.summary || null,
          updatedBy: "AI生成",
        },
      });

      return NextResponse.json({
        success: true,
        swot: {
          strengths: JSON.parse(swot.strengths),
          weaknesses: JSON.parse(swot.weaknesses),
          opportunities: JSON.parse(swot.opportunities),
          threats: JSON.parse(swot.threats),
          summary: swot.summary,
          updatedAt: swot.updatedAt,
          updatedBy: swot.updatedBy,
        },
      });
    }

    // 手動設定モード（従来の処理）
    // バリデーション
    if (!strengths || !Array.isArray(strengths) || strengths.length === 0) {
      return NextResponse.json(
        { error: "strengths は必須です（配列）" },
        { status: 400 }
      );
    }
    if (!weaknesses || !Array.isArray(weaknesses) || weaknesses.length === 0) {
      return NextResponse.json(
        { error: "weaknesses は必須です（配列）" },
        { status: 400 }
      );
    }
    if (!opportunities || !Array.isArray(opportunities) || opportunities.length === 0) {
      return NextResponse.json(
        { error: "opportunities は必須です（配列）" },
        { status: 400 }
      );
    }
    if (!threats || !Array.isArray(threats) || threats.length === 0) {
      return NextResponse.json(
        { error: "threats は必須です（配列）" },
        { status: 400 }
      );
    }

    // upsert（存在すれば更新、なければ作成）
    const swot = await prisma.defaultSwot.upsert({
      where: { id: "default" },
      update: {
        strengths: JSON.stringify(strengths),
        weaknesses: JSON.stringify(weaknesses),
        opportunities: JSON.stringify(opportunities),
        threats: JSON.stringify(threats),
        summary: summary || null,
        updatedBy: updatedBy || null,
      },
      create: {
        id: "default",
        strengths: JSON.stringify(strengths),
        weaknesses: JSON.stringify(weaknesses),
        opportunities: JSON.stringify(opportunities),
        threats: JSON.stringify(threats),
        summary: summary || null,
        updatedBy: updatedBy || null,
      },
    });

    return NextResponse.json({
      success: true,
      swot: {
        strengths: JSON.parse(swot.strengths),
        weaknesses: JSON.parse(swot.weaknesses),
        opportunities: JSON.parse(swot.opportunities),
        threats: JSON.parse(swot.threats),
        summary: swot.summary,
        updatedAt: swot.updatedAt,
        updatedBy: swot.updatedBy,
      },
    });
  } catch (error) {
    console.error("Admin SWOT POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SWOT保存に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: デフォルトSWOTを削除（開発者専用）
export async function DELETE() {
  try {
    await prisma.defaultSwot.delete({
      where: { id: "default" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin SWOT DELETE error:", error);
    return NextResponse.json(
      { error: "SWOT削除に失敗しました" },
      { status: 500 }
    );
  }
}
