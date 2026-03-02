import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/sharepoint";
import { generateWithClaude } from "@/lib/claude";
import { prisma } from "@/lib/db";
import type { SharePointFile, FileSuggestion } from "@/lib/sharepoint";

// AIが提案不要と判断すべきファイル拡張子
const SKIP_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "svg", "ico", "webp",
  "mp4", "avi", "mov", "wmv", "mkv", "mp3", "wav",
  "zip", "rar", "7z", "gz", "tar",
  "exe", "dll", "sys", "bin",
  "tmp", "log", "bak",
]);

// 3年以上前のファイルをフィルタ
const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "unauthorized", message: "SharePointアクセストークンが設定されていません" },
        { status: 401 }
      );
    }

    const { files } = await request.json() as { files: SharePointFile[] };

    if (!files?.length) {
      return NextResponse.json(
        { error: "files配列が必要です" },
        { status: 400 }
      );
    }

    // 既存RAGドキュメント名を取得（重複チェック用）
    const existingDocs = await prisma.rAGDocument.findMany({
      select: { filename: true },
    });
    const existingNames = new Set(existingDocs.map(d => d.filename));

    // プリフィルタ: 画像/動画、既存重複、3年以上前、フォルダ、システムファイル
    const now = Date.now();
    const candidates = files.filter(f => {
      if (f.folder) return false;
      if (!f.file) return false;
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (SKIP_EXTENSIONS.has(ext)) return false;
      if (existingNames.has(f.name)) return false;
      if (f.name.startsWith("~$") || f.name.startsWith(".")) return false;
      const age = now - new Date(f.lastModifiedDateTime).getTime();
      if (age > THREE_YEARS_MS) return false;
      return true;
    });

    if (candidates.length === 0) {
      return NextResponse.json({ suggestions: [], message: "提案対象のファイルがありません" });
    }

    // ファイルメタデータをプロンプトに渡す
    const fileList = candidates.map(f => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      const sizeMB = (f.size / 1024 / 1024).toFixed(1);
      return `- ${f.name} (${ext}, ${sizeMB}MB, 更新: ${f.lastModifiedDateTime.slice(0, 10)})`;
    }).join("\n");

    // 既存RAGドキュメント名もコンテキストとして渡す
    const existingList = existingDocs.map(d => d.filename).slice(0, 50).join(", ");

    const prompt = `あなたはRAG（Retrieval Augmented Generation）の専門家です。
以下のSharePointファイル一覧から、社内ナレッジベースに追加すべきドキュメントを提案してください。

## 既存RAGドキュメント（重複除外用）
${existingList || "なし"}

## SharePointファイル候補
${fileList}

## 判断基準
- high: 業務知識・ノウハウ・手順書・規定など、社内AIの回答品質向上に直結
- medium: 参考になるが必須ではない（レポート、議事録など）
- low: あまり有用でないが一応候補（古いバージョン、一般的な資料）

## 出力形式（JSON）
{
  "suggestions": [
    {
      "filename": "ファイル名",
      "relevance": "high" | "medium" | "low",
      "reason": "推薦理由（日本語、1文）"
    }
  ]
}

high/mediumのファイルのみ返してください。全ファイルを返す必要はありません。`;

    const result = await generateWithClaude(prompt, {
      jsonMode: true,
      temperature: 0.3,
      maxTokens: 4000,
    });

    let suggestions: FileSuggestion[] = [];
    try {
      const parsed = JSON.parse(result);
      suggestions = (parsed.suggestions || []).map((s: { filename: string; relevance: string; reason: string }) => {
        const matchedFile = candidates.find(f => f.name === s.filename);
        return {
          itemId: matchedFile?.id || "",
          filename: s.filename,
          relevance: s.relevance as "high" | "medium" | "low",
          reason: s.reason,
        };
      }).filter((s: FileSuggestion) => s.itemId); // マッチしないファイルは除外
    } catch {
      console.error("[SharePoint Suggest] AI応答のパースに失敗:", result);
      return NextResponse.json(
        { error: "AI応答の解析に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[SharePoint Suggest]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI提案中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
