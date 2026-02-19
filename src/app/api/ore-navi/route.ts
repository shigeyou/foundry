import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/claude";
import { PERSONALITY_OS, SYSTEM_PROMPT_ORE_NAVI, ORE_NAVI_MODE_MODIFIERS } from "@/lib/personality-os";
import { loadPersonalData, buildPersonalityPrompt } from "@/lib/personal-data-loader";
import { checkAndIngestNewFiles } from "@/lib/auto-ingest";

// GET: 履歴を取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const history = await prisma.oreNaviHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      history: history.map((h) => ({
        id: h.id,
        question: h.question,
        result: JSON.parse(h.result),
        createdAt: h.createdAt,
      })),
    });
  } catch (error) {
    console.error("Ore-navi history fetch failed:", error);
    return NextResponse.json(
      { error: "履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: 履歴を削除
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "IDが必要です" },
        { status: 400 }
      );
    }

    await prisma.oreNaviHistory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ore-navi history delete failed:", error);
    return NextResponse.json(
      { error: "履歴の削除に失敗しました" },
      { status: 500 }
    );
  }
}

interface OreNaviInsight {
  id: string;
  title: string;
  content: string;
  why_now: string;
  why_you: string;
  action: string;
  risk: string;
  lifevalue_impact: {
    reward: string;
    freedom: string;
    stress: string;
    meaning: string;
  };
}

interface OreNaviResult {
  insights: OreNaviInsight[];
  summary: string;
  warning: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, mode } = body;

    if (!question || question.trim() === "") {
      return NextResponse.json(
        { error: "問いを入力してください" },
        { status: 400 }
      );
    }

    // TTLベースの自動インジェストチェック（新ファイルがあれば取り込む）
    await checkAndIngestNewFiles();

    // 個人情報をローカルファイルから読み込む（俺ナビ専用）
    // Azure環境では読み込まない（デフォルトのPERSONALITY_OSを使用）
    const personalData = await loadPersonalData();
    let personalityPrompt: string;

    if (personalData) {
      // ローカル環境：詳細な個人情報を使用
      personalityPrompt = buildPersonalityPrompt(personalData);
      console.log(`[OreNavi] Using personal data (${personalityPrompt.length} chars)`);
    } else {
      // Azure環境またはファイルなし：ハードコードされたデフォルトを使用
      personalityPrompt = PERSONALITY_OS;
      console.log(`[OreNavi] Using default PERSONALITY_OS`);
    }

    // RAGドキュメントを取得（会社の文脈）
    const ragDocuments = await prisma.rAGDocument.findMany({
      select: {
        filename: true,
        content: true,
      },
    });

    // ドキュメントをプロンプト用にフォーマット
    let companyContext = "## 会社の文脈（RAGドキュメントより）\n\n";
    if (ragDocuments.length > 0) {
      for (const doc of ragDocuments) {
        companyContext += `### ${doc.filename}\n${doc.content.slice(0, 3000)}\n\n`;
      }
    } else {
      companyContext += "（RAGドキュメントは未登録）\n\n";
    }

    const userPrompt = `${personalityPrompt}

---

${companyContext}

---

## あなたからの問い

${question}

---

上記の人格OS（プロフィール・価値観・運用モジュール）と会社の文脈を踏まえて、回答を生成してください。
出力はJSON形式で。`;

    // モード修飾子をシステムプロンプトに結合
    const modeModifier = mode && ORE_NAVI_MODE_MODIFIERS[mode] ? ORE_NAVI_MODE_MODIFIERS[mode] : "";
    const systemPrompt = modeModifier
      ? `${SYSTEM_PROMPT_ORE_NAVI}\n\n${modeModifier}`
      : SYSTEM_PROMPT_ORE_NAVI;

    const response = await generateWithClaude(
      `${systemPrompt}\n\n${userPrompt}`,
      {
        temperature: 0.9,
        maxTokens: 8000,
        jsonMode: true,
      }
    );

    const result: OreNaviResult = JSON.parse(response);

    // 履歴に保存
    const historyId = `orenavi-${Date.now()}`;
    await prisma.oreNaviHistory.create({
      data: {
        id: historyId,
        question,
        result: JSON.stringify(result),
      },
    });

    return NextResponse.json({ ...result, historyId });
  } catch (error) {
    console.error("Ore-navi failed:", error);
    return NextResponse.json(
      { error: "エラーが発生しました: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500 }
    );
  }
}
