import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateChatWithClaude } from "@/lib/claude";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface IdeaContext {
  name: string;
  description: string;
  actions: string | null;
  reason: string;
  themeName: string;
  deptName: string;
  financial: number;
  customer: number;
  process: number;
  growth: number;
  score: number;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, ideaContext } = (await req.json()) as {
      messages: ChatMessage[];
      ideaContext: IdeaContext;
    };

    if (!messages?.length || !ideaContext) {
      return NextResponse.json({ error: "messages and ideaContext are required" }, { status: 400 });
    }

    // Load RAG documents for context
    const ragDocuments = await prisma.rAGDocument.findMany({
      select: { filename: true, content: true },
    });

    let ragContext = "";
    for (const doc of ragDocuments) {
      ragContext += `### ${doc.filename}\n${doc.content.slice(0, 2000)}\n\n`;
    }

    const systemPrompt = `あなたはメタファインダーのアイデアについて深掘りするAIアシスタントです。
以下のアイデアについてユーザーの質問に回答してください。

## アイデア情報
- 名称: ${ideaContext.name}
- テーマ: ${ideaContext.themeName}
- 対象部門: ${ideaContext.deptName}
- 概要: ${ideaContext.description}
- 具体的アクション: ${ideaContext.actions || "なし"}
- なぜ有効か: ${ideaContext.reason}
- BSCスコア: 財務${ideaContext.financial}/5, 顧客${ideaContext.customer}/5, 業務${ideaContext.process}/5, 成長${ideaContext.growth}/5 (総合${ideaContext.score.toFixed(1)})

## 参考ドキュメント（RAG）
${ragContext}

ユーザーの質問に具体的に、このアイデアの文脈に沿って回答してください。
日本語で回答してください。回答は簡潔かつ具体的にしてください。`;

    const apiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const response = await generateChatWithClaude(apiMessages, {
      temperature: 0.7,
      maxTokens: 4000,
    });

    return NextResponse.json({ response });
  } catch (error) {
    console.error("[meta-finder/chat] Error:", error);
    return NextResponse.json(
      { error: "AI response generation failed" },
      { status: 500 }
    );
  }
}
