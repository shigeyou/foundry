"use server";

import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: "2024-04-01-preview",
});

const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";

export async function POST(request: NextRequest) {
  try {
    const { content, fileName } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    // 長大なコンテンツを切り詰め（APIタイムアウト・トークン制限対策）
    const MAX_CONTENT_LEN = 15000;
    const truncatedContent = content.length > MAX_CONTENT_LEN
      ? content.slice(0, MAX_CONTENT_LEN) + "\n\n...(以下省略)"
      : content;

    const systemPrompt = `議事録からテンプレート（骨格）を抽出してください。

## ルール
- 見出し（#, ##, ###）はそのまま残す
- 具体的な内容（日付、人名、議論内容、数値など）は全て削除
- 各項目は空欄または「-」のみにする
- 説明文や補足は一切不要
- 元の構造を忠実に再現する

## 出力例
# 会議名

## 基本情報
- 日時:
- 場所:
- 参加者:

## 議題
-
-

## 議論内容

## 決定事項
-

## アクションアイテム
- 担当者: / 期限:

テンプレートのみを出力。説明や補足は不要。`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2 * 60 * 1000);

    const response = await client.chat.completions.create(
      {
        model: deployment,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `以下の議事録からテンプレートを抽出してください。\n\nファイル名: ${fileName || "不明"}\n\n---\n${truncatedContent}`,
          },
        ],
        max_completion_tokens: 1000,
        temperature: 0.1,
      },
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    const extractedTemplate = response.choices[0]?.message?.content?.trim();

    if (!extractedTemplate) {
      return NextResponse.json(
        { error: "テンプレートの抽出に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      template: extractedTemplate,
      originalLength: content.length,
      templateLength: extractedTemplate.length,
    });
  } catch (error) {
    console.error("Template extraction failed:", error);
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const message = isTimeout
      ? "テンプレート抽出がタイムアウトしました（2分）。ファイルを小さくして再試行してください。"
      : "テンプレート抽出中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
