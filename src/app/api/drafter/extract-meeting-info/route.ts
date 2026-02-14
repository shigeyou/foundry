"use server";

import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";

const EXTRACTION_SYSTEM_PROMPT = `あなたは会議関連ドキュメントから議事概要情報を抽出するアシスタントです。

与えられたテキスト（メール、ドキュメント等）から以下の情報を抽出してください：
- 会議名/件名
- 日時（開始・終了時刻含む）
- 場所（オンライン会議の場合はその旨も）
- 参加者/出席者
- 議題/アジェンダ
- その他の関連情報（準備事項、注意事項など）

【出力形式】
以下のフォーマットで出力してください。情報がない項目は省略可能です：

会議名: [会議名]
日時: [日時情報]
場所: [場所]
参加者: [参加者リスト]
議題:
1. [議題1]
2. [議題2]
...

備考:
[その他の関連情報]

【注意事項】
- テキストに含まれる情報のみを抽出してください
- 情報が見つからない場合は「（情報なし）」と記載してください
- 日本語で出力してください

【人名の漢字変換 - 重要】
ローマ字の人名は必ず漢字に変換してください。最も一般的・確からしい漢字を推測して使用します。
- 姓の例: OSHIMA→大島、MORITA→森田、KUMATA→熊田、URASAKI→浦崎、MORIOKA→森岡、NAGASHIMA→長島、KONO→河野、YAMAMOTO→山本、MAEDE→前出、ANADA→穴田、NITTA→新田、KASHIWAGI→柏木、KITAOKA→北岡、IKEDA→池田、KOYAMA→小山
- 名の例: Ryozo→良三、Yoshihiro→義弘、Toru→徹、Toshifumi→俊文、Ako→亜子、Akiko→明子、Haruka→遥、Yutaka→豊、Daisuke→大輔、Yuji→祐司、Kyoya→恭也、Takao→隆夫、Teruo→輝夫、Yoshiteru→義輝、Shigeo→茂生
- カタカナは使用せず、必ず漢字で出力すること`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, fileName } = body;

    if (!content || content.trim() === "") {
      return NextResponse.json(
        { error: "抽出元のテキストがありません" },
        { status: 400 }
      );
    }

    // Azure OpenAI設定
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o";

    if (!endpoint || !apiKey) {
      return NextResponse.json(
        { error: "Azure OpenAI設定が見つかりません" },
        { status: 500 }
      );
    }

    const client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion: "2024-08-01-preview",
    });

    // 長大なコンテンツを切り詰め（APIタイムアウト・トークン制限対策）
    const MAX_CONTENT_LEN = 15000;
    const truncatedContent = content.length > MAX_CONTENT_LEN
      ? content.slice(0, MAX_CONTENT_LEN) + "\n\n...(以下省略)"
      : content;

    const userMessage = fileName
      ? `以下のファイル「${fileName}」から議事概要情報を抽出してください：\n\n${truncatedContent}`
      : `以下のテキストから議事概要情報を抽出してください：\n\n${truncatedContent}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2 * 60 * 1000);

    const response = await client.chat.completions.create(
      {
        model: deployment,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_completion_tokens: 2000,
        temperature: 0.3,
      },
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    const extractedContent = response.choices[0]?.message?.content || "";

    return NextResponse.json({
      success: true,
      extractedContent,
      originalFileName: fileName,
    });
  } catch (error) {
    console.error("Meeting info extraction error:", error);
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const message = isTimeout
      ? "議事概要の抽出がタイムアウトしました（2分）。ファイルを小さくして再試行してください。"
      : "議事概要の抽出中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
