import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/claude";

// コア情報から業界・外部環境を推論
export async function GET() {
  try {
    // コア情報を取得
    const [services, assets, ragDocs] = await Promise.all([
      prisma.coreService.findMany(),
      prisma.coreAsset.findMany(),
      prisma.rAGDocument.findMany({
        select: {
          filename: true,
          content: true,
        },
      }),
    ]);

    // コア情報がない場合
    if (services.length === 0 && assets.length === 0 && ragDocs.length === 0) {
      return NextResponse.json({
        industry: "",
        companyContext: "",
        inferred: false,
        message: "コア情報が登録されていません",
      });
    }

    // コンテキストを構築
    const serviceList = services
      .map((s) => `- ${s.name} (${s.category || "未分類"}): ${s.description || ""}`)
      .join("\n");

    const assetList = assets
      .map((a) => `- ${a.name} (${a.type}): ${a.description || ""}`)
      .join("\n");

    const ragContent = ragDocs
      .map((d) => `【${d.filename}】\n${d.content}`)
      .join("\n\n");

    const prompt = `以下の企業情報から、この企業の業界・市場と会社の状況を推論してください。

## 登録サービス・機能
${serviceList || "なし"}

## 登録資産・強み
${assetList || "なし"}

## 参考ドキュメント（抜粋）
${ragContent || "なし"}

## 出力形式（JSON）
{
  "industry": "業界・市場（例：外航海運、海事サービス、船舶管理など）",
  "companyContext": "会社の状況を1-2文で（例：海運大手グループの技術子会社、船舶管理と海技者派遣を主力事業とする）",
  "reasoning": "推論の根拠を簡潔に"
}

JSONのみを出力してください。`;

    const response = await generateWithClaude(prompt);

    // JSONをパース
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        industry: "",
        companyContext: "",
        inferred: false,
        message: "推論結果のパースに失敗しました",
      });
    }

    const result = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      industry: result.industry || "",
      companyContext: result.companyContext || "",
      reasoning: result.reasoning || "",
      inferred: true,
    });
  } catch (error) {
    console.error("Infer context error:", error);
    return NextResponse.json(
      {
        industry: "",
        companyContext: "",
        inferred: false,
        message: "推論中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
