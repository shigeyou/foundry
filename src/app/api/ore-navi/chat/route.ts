import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateChatWithClaude } from "@/lib/claude";
import { PERSONALITY_OS, SYSTEM_PROMPT_ORE_NAVI, ORE_NAVI_MODE_MODIFIERS } from "@/lib/personality-os";
import { loadPersonalData, buildPersonalityPrompt } from "@/lib/personal-data-loader";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OreNaviInsight {
  id: string;
  title: string;
  content: string;
  why_now: string;
  why_you: string;
  action: string;
  risk: string;
}

interface OreNaviContext {
  question: string;
  mode?: string;
  summary: string;
  warning?: string;
  insights: OreNaviInsight[];
}

export async function POST(req: NextRequest) {
  try {
    const { messages, oreNaviContext } = (await req.json()) as {
      messages: ChatMessage[];
      oreNaviContext: OreNaviContext;
    };

    if (!messages?.length || !oreNaviContext) {
      return NextResponse.json({ error: "messages and oreNaviContext are required" }, { status: 400 });
    }

    // 個人情報を読み込む
    const personalData = await loadPersonalData();
    const personalityPrompt = personalData
      ? buildPersonalityPrompt(personalData)
      : PERSONALITY_OS;

    // 俺ナビ専用RAGを取得
    const ragDocuments = await prisma.rAGDocument.findMany({
      where: { scope: { in: ["shared", "orenavi"] } },
      select: { filename: true, content: true, scope: true },
    });

    let ragContext = "";
    for (const doc of ragDocuments) {
      ragContext += `### ${doc.filename}\n${doc.content}\n\n`;
    }

    // モード修飾子
    const modeModifier = oreNaviContext.mode && ORE_NAVI_MODE_MODIFIERS[oreNaviContext.mode]
      ? ORE_NAVI_MODE_MODIFIERS[oreNaviContext.mode]
      : "";

    // インサイトを要約
    const insightsSummary = oreNaviContext.insights
      .map((i, idx) => `#${idx + 1} ${i.title}: ${i.content.slice(0, 200)}...`)
      .join("\n");

    const systemPrompt = `あなたは「俺ナビ」のフォローアップAIです。
先ほどの探索結果について、ユーザーの追加質問に回答してください。

## 人格OS（ユーザーの個性・価値観）
${personalityPrompt.slice(0, 3000)}

## 先ほどの探索結果
- 問い: ${oreNaviContext.question}
${oreNaviContext.mode ? `- モード: ${oreNaviContext.mode}` : ""}
- サマリー: ${oreNaviContext.summary}
${oreNaviContext.warning ? `- 警告: ${oreNaviContext.warning}` : ""}

### インサイト一覧
${insightsSummary}

## 参考ドキュメント
${ragContext}

${modeModifier}

## 回答ルール
- ユーザーの人格OS・価値観を踏まえて回答する
- 探索結果の文脈に沿って具体的に回答する
- 日本語で、簡潔かつ深い回答をする
- 抽象論を避け、「次に何をすべきか」を明確にする`;

    const apiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const response = await generateChatWithClaude(apiMessages, {
      temperature: 0.8,
      maxTokens: 4000,
    });

    return NextResponse.json({ response });
  } catch (error) {
    console.error("[ore-navi/chat] Error:", error);
    return NextResponse.json(
      { error: "AI応答の生成に失敗しました: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500 }
    );
  }
}
