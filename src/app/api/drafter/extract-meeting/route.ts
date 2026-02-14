import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";

// Azure OpenAI クライアント
const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  apiVersion: "2024-08-01-preview",
});

const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o";

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "文字起こしテキストが必要です" },
        { status: 400 }
      );
    }

    const systemPrompt = `あなたは会議の文字起こしから議事録に必要な情報を抽出する専門家です。
以下の情報を抽出してJSON形式で返してください：

1. meeting_date: 会議日時（文字起こしから推測できる場合）
2. meeting_place: 場所（オンライン/会議室名など）
3. attendees: 出席者（発言者名をカンマ区切りで）
4. agenda: 議題（箇条書き形式で）
5. discussion: 討議内容のまとめ（主要な議論のポイントを箇条書きで）
6. decisions: 決定事項（具体的なアクション項目を箇条書きで）

推測できない項目は空文字にしてください。
必ず有効なJSONのみを返してください（説明文は不要です）。`;

    const response = await client.chat.completions.create({
      model: deploymentName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      temperature: 0.3,
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "AIからの応答がありませんでした" },
        { status: 500 }
      );
    }

    // JSONをパース
    let extracted;
    try {
      extracted = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "AIの応答をパースできませんでした" },
        { status: 500 }
      );
    }

    return NextResponse.json({ extracted });
  } catch (error) {
    console.error("Extract meeting error:", error);
    return NextResponse.json(
      { error: "抽出処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
