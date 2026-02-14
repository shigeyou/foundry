import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";

export const runtime = "nodejs";

// Azure OpenAI クライアントを初期化
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

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || "unknown";

  try {
    const { text, language } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required", requestId },
        { status: 400 }
      );
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return NextResponse.json({ content: "", requestId });
    }

    // 言語に応じたプロンプト
    const isEnglish = language === "en";
    const systemPrompt = isEnglish
      ? "You are a text editor. Improve the text to be more natural and clear. Return ONLY the improved text, nothing else."
      : "あなたは文章校正者です。テキストをより自然で分かりやすく改善してください。改善後のテキストのみを返してください。";

    const userPrompt = isEnglish
      ? `Improve this text: "${trimmedText}"`
      : `このテキストを改善してください: "${trimmedText}"`;

    console.log(`[request_id=${requestId}] Improve text API: Starting...`);

    const response = await getClient().chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: Math.min(trimmedText.length * 2 + 100, 500), // 元のテキスト長に応じて制限
      temperature: 0.3, // 低めで安定した出力
    });

    const improvedText =
      response.choices[0]?.message?.content?.trim() || trimmedText;

    console.log(`[request_id=${requestId}] Improve text API: Success`);

    return NextResponse.json({
      content: improvedText,
      requestId,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[request_id=${requestId}] Improve text API error:`, error);

    // エラー時はエラーを返す
    return NextResponse.json(
      { error: errorMessage, requestId },
      { status: 500 }
    );
  }
}
