import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// bodyサイズ制限を拡大（画像base64を含むため）
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
  defaultQuery: { "api-version": "2024-08-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
});

const REPORT_SYSTEM_PROMPT = `あなたはプロフェッショナルな報告書作成アシスタントです。
与えられた複数の素材（画像、文書、表データ、音声の文字起こし）を分析し、
それらを統合した報告書のドラフトを作成してください。

## 報告書作成のルール

1. **構造化**: 報告書は以下の構成を基本とする
   - 表紙情報（タイトル、日付、作成者）
   - 概要（エグゼクティブサマリー）
   - 本文（素材に基づく各セクション）
   - まとめ・所見
   - 添付資料一覧

2. **画像の扱い**:
   - 画像の内容を正確に読み取り、報告書に反映する
   - 写真であれば、写っている状況・対象物を客観的に記述
   - スクリーンショットであれば、表示されているデータ・情報を抽出
   - グラフや図表であれば、示しているトレンドや数値を文章化
   - **最重要: 画像を報告書内の最も適切な箇所に挿入すること**
   - 画像の挿入には **必ず** 以下のマーカー形式を使うこと:
     [IMAGE:ファイル名]
   - **ファイル名は素材として渡されたものをそのまま正確にコピーすること（拡張子含む）**
   - 例: 素材名が「月別点検合格率グラフ.png」なら → [IMAGE:月別点検合格率グラフ.png]
   - マーカーは必ず独立した行に1つだけ記述する（前後に他のテキストを混ぜない）
   - マーカーの前後に画像の説明文を書くこと（例: 「図1に点検合格率の推移を示す。」の次の行にマーカー）
   - **すべての画像素材のマーカーを必ず報告書内に含めること。使わない画像があってはならない**

3. **文書の扱い**:
   - テキスト文書の内容を報告書に統合する
   - 重複する情報は整理・統合する

4. **表データの扱い**:
   - 表データはMarkdownテーブルとして報告書に組み込む
   - 重要な数値にはコメントを付記する

5. **音声文字起こしの扱い**:
   - 音声から文字起こしされた内容を整理して報告書に組み込む
   - 口語的な表現は適切な書き言葉に変換する
   - 発言者が特定できる場合は明記する

6. **文体**:
   - 客観的で簡潔な表現
   - 「である」調を基本とする
   - 数字や日付は正確に記載

7. **注意事項**:
   - 推測で情報を補わない
   - 素材に含まれない情報を捏造しない
   - 不明な点は[要確認]と記載する`;

interface MaterialItem {
  id: string;
  fileName: string;
  fileType: "image" | "document" | "spreadsheet" | "audio";
  base64?: string;
  mimeType?: string;
  textContent?: string;
  memo?: string;
}

interface GenerateReportRequest {
  reportTitle: string;
  reportType?: string;
  materials: MaterialItem[];
  additionalInstructions?: string;
  templateContent?: string;
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" | "low" | "auto" } };

export async function POST(request: NextRequest) {
  try {
    const body: GenerateReportRequest = await request.json();
    const { reportTitle, reportType, materials, additionalInstructions, templateContent } = body;

    if (!reportTitle?.trim()) {
      return NextResponse.json({ error: "報告書タイトルを入力してください" }, { status: 400 });
    }

    if (!materials || materials.length === 0) {
      return NextResponse.json({ error: "素材を1つ以上投入してください" }, { status: 400 });
    }

    // content array を構築
    const contentParts: ContentPart[] = [];

    // 冒頭指示
    let intro = `以下の素材を基に「${reportTitle}」の報告書ドラフトを作成してください。`;
    if (reportType) {
      intro += `\n報告書の種類: ${reportType}`;
    }
    intro += `\n素材数: ${materials.length}件\n`;
    contentParts.push({ type: "text", text: intro });

    // 各素材を追加
    let imageCount = 0;
    for (const material of materials) {
      const memoText = material.memo ? ` (メモ: ${material.memo})` : "";

      if (material.fileType === "image" && material.base64) {
        imageCount++;
        if (imageCount > 10) {
          // 10枚を超える画像はテキスト説明のみ
          contentParts.push({
            type: "text",
            text: `\n--- 素材: ${material.fileName}${memoText} ---\n[画像: 上限超過のため省略]\n`,
          });
          continue;
        }
        contentParts.push({
          type: "text",
          text: `\n--- 素材 (画像): ${material.fileName}${memoText} ---`,
        });
        contentParts.push({
          type: "image_url",
          image_url: { url: material.base64, detail: "high" },
        });
      } else {
        // テキスト系素材（文書、表、音声文字起こし）
        const typeLabel =
          material.fileType === "audio" ? "音声文字起こし" :
          material.fileType === "spreadsheet" ? "表データ" : "文書";
        const content = material.textContent || "[内容なし]";
        contentParts.push({
          type: "text",
          text: `\n--- 素材 (${typeLabel}): ${material.fileName}${memoText} ---\n${content}\n`,
        });
      }
    }

    // テンプレート指示
    if (templateContent?.trim()) {
      contentParts.push({
        type: "text",
        text: `\n\n## 報告書テンプレート（この構成に従うこと）\n${templateContent}`,
      });
    }

    // 追加指示
    if (additionalInstructions?.trim()) {
      contentParts.push({
        type: "text",
        text: `\n\n## 追加指示\n${additionalInstructions}`,
      });
    }

    // 画像ファイル名リストを明示（マーカー用）
    const imageFileNames = materials
      .filter((m) => m.fileType === "image" && m.base64)
      .map((m) => m.fileName);

    let finalInstruction = "\n\n---\n\n上記の素材を基に、構造化された報告書ドラフトをMarkdown形式で作成してください。";
    if (imageFileNames.length > 0) {
      finalInstruction += `\n\n**画像マーカーの挿入を忘れないこと。以下のファイル名をそのまま使用すること:**\n`;
      for (const name of imageFileNames) {
        finalInstruction += `- [IMAGE:${name}]\n`;
      }
    }

    contentParts.push({
      type: "text",
      text: finalInstruction,
    });

    // OpenAI API 呼び出し（vision対応）
    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages: [
        { role: "system", content: REPORT_SYSTEM_PROMPT },
        { role: "user", content: contentParts as unknown as string },
      ],
      max_completion_tokens: 8000,
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content || "";
    const titleMatch = content.match(/^#+ (.+)$/m);
    const title = titleMatch ? titleMatch[1] : reportTitle;

    return NextResponse.json({
      id: crypto.randomUUID(),
      title,
      content,
    });
  } catch (error) {
    console.error("Report generation error:", error);
    const message = error instanceof Error ? error.message : "報告書の生成中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
