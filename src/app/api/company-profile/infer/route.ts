import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { generateWithClaude } from "@/lib/claude";

// Webページからコンテンツを取得
async function fetchWebContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KachisujiBot/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 不要な要素を削除
    $("script, style, nav, footer, header, aside, iframe, noscript").remove();

    // メインコンテンツを抽出
    const mainContent = $("main, article, .content, #content, body").text();

    // 空白を整理
    return mainContent
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000); // 15,000文字に制限
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

// AIで企業情報を抽出
async function extractCompanyInfo(content: string, url: string): Promise<{
  name: string;
  shortName: string;
  description: string;
  industry: string;
  background: string;
  techStack: string;
  parentCompany: string;
  parentRelation: string;
}> {
  const prompt = `以下は企業のホームページから取得したテキストです。この内容から企業情報を抽出してください。

URL: ${url}

=== ホームページの内容 ===
${content}
=== ここまで ===

以下のJSON形式で回答してください。情報が見つからない項目は空文字""にしてください：

{
  "name": "正式な会社名（例：株式会社サンプル）",
  "shortName": "略称があれば（例：サンプル社）",
  "description": "会社の概要・主な事業内容（1-2文で簡潔に）",
  "industry": "業界・業種（例：製造業、IT、物流など）",
  "background": "設立の経緯や沿革で特筆すべき点（合併、分社化など）",
  "techStack": "技術的な強み・DXの取り組み（あれば）",
  "parentCompany": "親会社名（グループ会社の場合）",
  "parentRelation": "親会社との関係性の説明（子会社として何を担っているかなど）"
}

JSONのみを出力してください。`;

  const response = await generateWithClaude(prompt, {
    temperature: 0.3,
    maxTokens: 2000,
    jsonMode: true,
  });

  try {
    return JSON.parse(response);
  } catch {
    // JSONパースに失敗した場合、JSON部分を抽出
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Failed to parse AI response");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URLを入力してください" },
        { status: 400 }
      );
    }

    // URLの簡易バリデーション
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "有効なURLを入力してください" },
        { status: 400 }
      );
    }

    // Webコンテンツを取得
    console.log(`Fetching content from: ${url}`);
    const content = await fetchWebContent(url);

    if (!content || content.length < 100) {
      return NextResponse.json(
        { error: "ページの内容を取得できませんでした" },
        { status: 400 }
      );
    }

    // AIで企業情報を抽出
    console.log(`Extracting company info from ${content.length} chars...`);
    const companyInfo = await extractCompanyInfo(content, url);

    return NextResponse.json({
      profile: companyInfo,
      sourceUrl: url,
      message: "企業情報を抽出しました",
    });
  } catch (error) {
    console.error("Company profile inference error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "情報の抽出に失敗しました" },
      { status: 500 }
    );
  }
}
