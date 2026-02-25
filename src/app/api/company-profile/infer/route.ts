import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { generateWithClaude } from "@/lib/claude";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// 会社名からTavilyで公式サイトURLを検索
async function findOfficialWebsite(companyName: string): Promise<string> {
  if (!TAVILY_API_KEY || TAVILY_API_KEY.startsWith("your_")) {
    throw new Error("Tavily APIキーが設定されていません");
  }

  const query = `${companyName} 公式サイト`;
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily検索エラー: ${response.status}`);
  }

  const data = await response.json();
  const results: Array<{ url: string; score: number }> = data.results || [];

  if (results.length === 0) {
    throw new Error(`「${companyName}」の公式サイトが見つかりませんでした`);
  }

  // スコア順上位のURLをそのまま使う（公式サイトが最上位に来ることが多い）
  // wikipediaやニュースサイトは除外
  const skipDomains = ["wikipedia.org", "linkedin.com", "facebook.com", "twitter.com", "x.com", "youtube.com"];
  const official = results.find(
    (r) => !skipDomains.some((d) => r.url.includes(d))
  );

  if (!official) {
    throw new Error(`「${companyName}」の公式サイトを特定できませんでした`);
  }

  // トップページのURLに変換
  try {
    const parsed = new URL(official.url);
    return `${parsed.protocol}//${parsed.hostname}/`;
  } catch {
    return official.url;
  }
}

// Webページからコンテンツを取得
interface WebContent {
  title: string;
  metaDescription: string;
  ogSiteName: string;
  bodyText: string;
}

async function fetchWebContent(url: string): Promise<WebContent> {
  // URLを正規化（www.がない場合は追加してリトライ）
  const urlsToTry = [url];
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.startsWith("www.")) {
      const wwwUrl = `${parsedUrl.protocol}//www.${parsedUrl.hostname}${parsedUrl.pathname}${parsedUrl.search}`;
      urlsToTry.push(wwwUrl);
    }
  } catch {
    // ignore
  }

  let lastError: Error | null = null;
  let html = "";

  for (const tryUrl of urlsToTry) {
    try {
      console.log(`Trying to fetch: ${tryUrl}`);
      const response = await fetch(tryUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      html = await response.text();
      console.log(`Successfully fetched from: ${tryUrl}`);
      break;
    } catch (error) {
      console.log(`Failed to fetch ${tryUrl}:`, error instanceof Error ? error.message : error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (!html) {
    throw lastError || new Error("Failed to fetch URL");
  }

  const $ = cheerio.load(html);

  // titleタグを取得
  const title = $("title").text().trim();

  // metaタグを取得
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || "";
  const ogSiteName = $('meta[property="og:site_name"]').attr("content")?.trim() || "";

  // 不要な要素を削除
  $("script, style, nav, footer, header, aside, iframe, noscript").remove();

  // メインコンテンツを抽出
  const bodyText = $("main, article, .content, #content, body").text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000); // 12,000文字に制限

  return { title, metaDescription, ogSiteName, bodyText };
}

// AIで企業情報を抽出
async function extractCompanyInfo(webContent: WebContent, url: string): Promise<{
  name: string;
  shortName: string;
  description: string;
  industry: string;
  background: string;
  techStack: string;
  parentCompany: string;
  parentRelation: string;
}> {
  // URLからドメイン名を抽出（ヒントとして使用）
  let domainHint = "";
  try {
    const parsedUrl = new URL(url);
    domainHint = parsedUrl.hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    // ignore
  }

  const prompt = `あなたは企業情報を抽出する専門家です。以下のWebページ情報から、この企業の情報をJSON形式で抽出してください。

【入力データ】
URL: ${url}
ドメイン名: ${domainHint}
ページタイトル: ${webContent.title || "(取得できず)"}
OGサイト名: ${webContent.ogSiteName || "(取得できず)"}
meta description: ${webContent.metaDescription || "(取得できず)"}

ページ本文（抜粋）:
${webContent.bodyText.slice(0, 8000)}

【タスク】
上記の情報から企業名と企業情報を抽出してください。

【会社名の抽出ルール - 最重要】
1. ページタイトルに「株式会社○○」「○○株式会社」があれば、それが会社名です
2. OGサイト名に会社名が含まれていれば、それを使用してください
3. 本文中の「会社概要」「企業情報」セクションに正式名称があります
4. 「Co., Ltd.」「Inc.」「Corporation」も会社名の一部です
5. 会社名は必ず存在します。空にしないでください。

【出力形式】
以下のJSONを出力してください。値は具体的な内容を入れてください：

{
  "name": "会社の正式名称をここに入れる",
  "shortName": "略称があれば入れる、なければ空文字",
  "description": "事業内容の要約",
  "industry": "業界・業種",
  "background": "設立経緯や沿革の特記事項",
  "techStack": "技術的な強みやDXの取り組み",
  "parentCompany": "親会社名（グループ会社の場合）",
  "parentRelation": "親会社との関係"
}

JSONのみを出力してください。説明文は不要です。`;

  const response = await generateWithClaude(prompt, {
    temperature: 0.3,
    maxTokens: 2000,
    jsonMode: true,
  });

  let result;
  try {
    result = JSON.parse(response);
  } catch {
    // JSONパースに失敗した場合、JSON部分を抽出
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Failed to parse AI response");
    }
  }

  // フォールバック: nameが空の場合、タイトルやOGサイト名から抽出を試みる
  if (!result.name || result.name.trim() === "") {
    console.log("Name extraction failed, attempting fallback...");

    // タイトルから会社名らしきものを抽出
    const companyPatterns = [
      /(.+(?:株式会社|Co\.,?\s*Ltd\.?|Inc\.?|Corporation))/i,
      /((?:株式会社|有限会社).+?)(?:\s|$|[|｜])/,
    ];

    const sources = [webContent.ogSiteName, webContent.title];
    for (const source of sources) {
      if (!source) continue;
      for (const pattern of companyPatterns) {
        const match = source.match(pattern);
        if (match && match[1]) {
          result.name = match[1].trim();
          console.log(`Fallback extracted name: "${result.name}" from "${source}"`);
          break;
        }
      }
      if (result.name) break;
    }

    // それでも見つからない場合、OGサイト名またはタイトルをそのまま使用
    if (!result.name || result.name.trim() === "") {
      if (webContent.ogSiteName) {
        result.name = webContent.ogSiteName;
        console.log(`Using og:site_name as fallback: "${result.name}"`);
      } else if (webContent.title) {
        // タイトルから区切り文字以降を除去
        result.name = webContent.title.split(/[|｜\-–—]/)[0].trim();
        console.log(`Using title as fallback: "${result.name}"`);
      }
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, companyName } = body;

    // 会社名からURLを自動検索、またはURLを直接使用
    let targetUrl: string;
    if (companyName && typeof companyName === "string" && companyName.trim()) {
      console.log(`[Infer] Searching official website for: ${companyName}`);
      targetUrl = await findOfficialWebsite(companyName.trim());
      console.log(`[Infer] Found official website: ${targetUrl}`);
    } else if (url && typeof url === "string") {
      try {
        const parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid protocol");
        }
        targetUrl = url;
      } catch {
        return NextResponse.json(
          { error: "有効なURLを入力してください" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "会社名またはURLを入力してください" },
        { status: 400 }
      );
    }

    // Webコンテンツを取得
    console.log(`Fetching content from: ${targetUrl}`);
    const url_used = targetUrl;
    const webContent = await fetchWebContent(url_used);

    console.log("=== Extracted Web Content ===");
    console.log(`Title: "${webContent.title}"`);
    console.log(`OG Site Name: "${webContent.ogSiteName}"`);
    console.log(`Meta Description: "${webContent.metaDescription?.slice(0, 100)}..."`);
    console.log(`Body length: ${webContent.bodyText.length} chars`);
    console.log("=============================");

    if (!webContent.bodyText || webContent.bodyText.length < 100) {
      return NextResponse.json(
        { error: "ページの内容を取得できませんでした" },
        { status: 400 }
      );
    }

    // AIで企業情報を抽出
    console.log("Calling AI to extract company info...");
    const companyInfo = await extractCompanyInfo(webContent, url);
    console.log("=== AI Extraction Result ===");
    console.log(`Name: "${companyInfo.name}"`);
    console.log(`ShortName: "${companyInfo.shortName}"`);
    console.log(`Industry: "${companyInfo.industry}"`);
    console.log("============================");

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
