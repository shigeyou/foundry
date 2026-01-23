import { NextRequest, NextResponse } from "next/server";
import { generateWithClaude } from "@/lib/claude";

interface SwotItem {
  text: string;
  source?: string;
}

interface SwotResult {
  swot: {
    strengths: SwotItem[];
    weaknesses: SwotItem[];
    opportunities: SwotItem[];
    threats: SwotItem[];
  };
  summary: string;
}

export async function POST(request: NextRequest) {
  try {
    const { industry, companyContext, coreInfo, externalData } = await request.json();

    if (!industry) {
      return NextResponse.json({ error: "業界情報が必要です" }, { status: 400 });
    }

    // 外部データを整形
    const externalContext = Object.entries(externalData || {})
      .map(([key, data]: [string, unknown]) => {
        const d = data as { answer?: string; results?: { title: string; content: string }[] };
        return `【${key}】\n${d.answer || ""}\n${(d.results || [])
          .slice(0, 3)
          .map((r) => `- ${r.title}: ${r.content?.slice(0, 200)}`)
          .join("\n")}`;
      })
      .join("\n\n");

    const prompt = `あなたは戦略コンサルタントです。以下の情報を基にSWOT分析を行い、JSONで出力してください。

## 最重要ルール（必ず遵守）
- 「登録サービスなし」「サービスが未登録」「登録がない」等の表現を絶対に使用しないでください。
- 本システムへの登録状況は分析対象外です。登録の有無について一切言及しないでください。
- コア情報欄が空欄でも、それは会社にサービスが存在しないという意味ではありません。

【業界】
${industry}

【自社状況】
${companyContext || "（記載なし）"}

【自社のコア情報（サービス・資産・強み）】
${coreInfo || "（別資料参照）"}

【外部環境情報（Web検索結果）】
${externalContext || "（取得なし）"}

以下のJSON形式で出力してください。各項目は3〜5個、簡潔に：

{
  "swot": {
    "strengths": [{"text": "強み1"}, {"text": "強み2"}],
    "weaknesses": [{"text": "弱み1"}, {"text": "弱み2"}],
    "opportunities": [{"text": "機会1"}, {"text": "機会2"}],
    "threats": [{"text": "脅威1"}, {"text": "脅威2"}]
  },
  "summary": "【状況認識】1-2行で要約\\n【最大の機会】1行\\n【最大のリスク】1行\\n【推奨アクション】1行"
}

重要：
- summaryは経営者が30秒で読める長さに凝縮
- 各項目は具体的かつ簡潔に
- 外部情報がある場合は最新トレンドを反映
- 「登録」「未登録」等のシステム用語をサマリーに含めない
- JSONのみ出力、説明不要`;

    const response = await generateWithClaude(prompt);

    // JSONを抽出
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSONの解析に失敗しました");
    }

    const result: SwotResult = JSON.parse(jsonMatch[0]);

    return NextResponse.json(result);
  } catch (error) {
    console.error("SWOT analysis error:", error);
    return NextResponse.json(
      { error: "SWOT分析に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
