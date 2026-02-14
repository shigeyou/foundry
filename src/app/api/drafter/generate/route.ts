"use server";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
  defaultQuery: { "api-version": "2024-08-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
});

// 議事録用システムプロンプト
const MEETING_MINUTES_SYSTEM_PROMPT = `あなたはプロフェッショナルな議事録作成アシスタントです。
与えられた情報を基に、正確で読みやすい議事録を作成してください。

## 議事録作成のルール

1. **構造化**: 議事録は以下の構成で作成してください
   - 会議基本情報（日時、場所、参加者）
   - 議題一覧
   - 各議題の討議内容
   - 決定事項
   - 次回予定（あれば）

2. **文体**:
   - 簡潔で客観的な表現を使用
   - 「〜した」「〜である」などの常体を使用
   - 発言者を明記する場合は「〇〇氏」の形式

3. **フォーマット**:
   - 見出しには##を使用
   - 箇条書きを効果的に活用
   - 決定事項は太字で強調

4. **注意事項**:
   - 事実と意見を区別して記載
   - 重要な数字や日付は正確に記載
   - 不明確な情報は推測せず、そのまま記載するか省略`;

// 過去の議事録からスタイルを学習するプロンプト
function buildPastMinutesContext(pastMinutes: { fileName: string; content: string }[]): string {
  if (pastMinutes.length === 0) return "";

  const examples = pastMinutes
    .map((file, i) => `### 参考議事録 ${i + 1}: ${file.fileName}\n\n${file.content.slice(0, 3000)}${file.content.length > 3000 ? "\n...(以下省略)" : ""}`)
    .join("\n\n---\n\n");

  return `\n\n## 参考にすべき過去の議事録

以下の過去の議事録のスタイル・フォーマット・文体を参考にして、同様の形式で新しい議事録を作成してください。

${examples}`;
}

interface MeetingInputData {
  meetingOverview: string;
  transcript: string;
  pastMinutes: { id: string; fileName: string; content: string }[];
  additionalInstructions: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { drafterId, inputs, meetingInput } = body;

    // 議事録ドラフターの場合
    const isMeetingDrafter = drafterId === "minutes";
    if (isMeetingDrafter && meetingInput) {
      const { meetingOverview, transcript, pastMinutes, additionalInstructions } = meetingInput as MeetingInputData;

      // 入力チェック
      if (!meetingOverview?.trim() && !transcript?.trim()) {
        return NextResponse.json(
          { error: "議事概要または文字起こしのどちらかを入力してください" },
          { status: 400 }
        );
      }

      // システムプロンプトを構築
      let systemPrompt = MEETING_MINUTES_SYSTEM_PROMPT;

      // 過去の議事録があればスタイル参考として追加
      if (pastMinutes && pastMinutes.length > 0) {
        systemPrompt += buildPastMinutesContext(pastMinutes);
      }

      // ユーザープロンプトを構築
      let userPrompt = "以下の情報を基に議事録を作成してください。\n\n";

      if (meetingOverview?.trim()) {
        userPrompt += `## 議事概要\n\n${meetingOverview}\n\n`;
      }

      if (transcript?.trim()) {
        userPrompt += `## 文字起こし（会議の発言記録）\n\n${transcript}\n\n`;
      }

      if (additionalInstructions?.trim()) {
        userPrompt += `## 追加指示\n\n${additionalInstructions}\n\n`;
      }

      userPrompt += "\n---\n\n上記の情報を基に、構造化された議事録を作成してください。";

      // OpenAI APIを呼び出し（5分タイムアウト）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

      const completion = await openai.chat.completions.create(
        {
          model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_completion_tokens: 4000,
          temperature: 0.3,
        },
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      const content = completion.choices[0]?.message?.content || "";

      // タイトルを抽出（最初の見出しから）
      const titleMatch = content.match(/^#+ (.+)$/m);
      const title = titleMatch ? titleMatch[1] : "議事録";

      return NextResponse.json({
        id: crypto.randomUUID(),
        title,
        content,
      });
    }

    // その他のドラフター（従来型）
    // TODO: 稟議書・提案書などの生成ロジックを実装
    return NextResponse.json(
      { error: "このドラフタータイプはまだ実装されていません" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Draft generation error:", error);
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const message = isTimeout
      ? "議事録の生成がタイムアウトしました（5分）。入力内容を短くして再試行してください。"
      : "議事録の生成中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
