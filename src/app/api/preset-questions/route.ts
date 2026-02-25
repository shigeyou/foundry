import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/claude";

// プリセット質問をRAGドキュメントから生成
export async function GET() {
  try {
    // RAGドキュメントを取得
    const ragDocuments = await prisma.rAGDocument.findMany({
      select: { filename: true, content: true },
      take: 10,
    });

    if (ragDocuments.length === 0) {
      // RAGドキュメントがない場合はデフォルトの質問を返す
      const companyProfile = await prisma.companyProfile.findFirst();
      const companyName = companyProfile?.name || "";
      return NextResponse.json({
        questions: getDefaultQuestions(companyName),
        source: "default",
      });
    }

    // RAGドキュメントの内容を要約（コンテンツを短縮してAPI応答を高速化）
    const ragContext = ragDocuments
      .slice(0, 5) // 最大5ドキュメントに制限
      .map((d) => `### ${d.filename}\n${d.content}`)
      .join("\n\n");

    const prompt = `あなたは事業戦略コンサルタントです。以下の会社資料を分析し、この会社にとって「勝ち筋」となりうる戦略的質問を30個生成してください。

## 会社資料
${ragContext}

## 最重要ルール
1. **RAG情報から具体的なキーワードを抽出**し、それを質問に反映してください
2. 会社の**実際の事業・サービス・強み**に直接関連する質問を優先してください
3. 資料に記載されている**固有名詞・専門用語・事業名**を積極的に使用してください
4. 一般的すぎる質問ではなく、**この会社だからこそ意味のある質問**にしてください

## 出力要件
1. 質問は「〜するには？」「〜を実現するには？」という形式にしてください
2. ラベルは2〜6文字程度の短いキーワード（資料から抽出した用語を優先）
3. 優先順位：
   - 第1優先：資料に明記されている事業・サービス・技術に関する質問
   - 第2優先：資料から読み取れる強み・競争優位に関する質問
   - 第3優先：資料に示唆されている成長機会・新規事業に関する質問
   - 第4優先：業界トレンド・デジタル化に関する質問

## 禁止事項（以下のような抽象的・汎用的な質問は絶対に作成しないこと）
- 「価値提案」「顧客価値」「ブランド価値」など抽象的なラベル
- 「差別化された価値提案を作るには？」のような具体性のない質問
- 「顧客体験を改善するには？」のようなどの会社にも当てはまる質問
- 「イノベーションを促進するには？」のような経営書の見出しのような質問
- 「効率投資」「知見活用」「市場開拓」など具体的な対象が不明な質問

## 出力形式（JSON配列）
[
  { "label": "ラベル", "question": "質問文" },
  ...
]

30個の質問をJSON配列で出力してください。資料の内容に基づいた具体的な質問を優先してください。`;

    // タイムアウト付きでAI呼び出し（30秒でタイムアウト）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("AI呼び出しがタイムアウトしました")), 30000);
    });

    const aiResponse = await Promise.race([
      generateWithClaude(prompt, {
        temperature: 0.7,
        maxTokens: 3000,
        jsonMode: true,
      }),
      timeoutPromise,
    ]);

    let questions;
    try {
      questions = JSON.parse(aiResponse);
    } catch {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("AI応答のパースに失敗しました");
      }
    }

    // バリデーション
    if (!Array.isArray(questions) || questions.length === 0) {
      const companyProfile = await prisma.companyProfile.findFirst();
      const companyName = companyProfile?.name || "";
      return NextResponse.json({
        questions: getDefaultQuestions(companyName),
        source: "default",
      });
    }

    // 30個に調整
    let finalQuestions = questions.slice(0, 30).map((q: { label: string; question: string }) => ({
      label: q.label?.substring(0, 8) || "質問",
      question: q.question || "",
    }));

    // 対象企業を取得
    const companyProfile = await prisma.companyProfile.findFirst();
    const companyName = companyProfile?.name || "";
    const isMOLMaritex = companyName.includes("商船三井マリテックス") || companyName.includes("MOLマリテックス");

    // 必須バッジの定義（対象企業によって変わる）
    const requiredBadges = [
      {
        keyword: "ドローン",
        label: "ドローン",
        question: "ドローン技術を活用した新サービス・業務効率化を実現するには？",
        alwaysRequired: true, // 全企業で必須
      },
      {
        keyword: "社内DX",
        label: "社内DX",
        question: "会社でDXを推進したいと考えています。社内の自動化・効率化を進められる仕組みを作りたいです。まずは、最もインパクトの大きいアプリ案を提案してください。全社で共通利用できるもの、または親会社・グループ会社でも同様のニーズが見込めて横展開できるものを優先したいです。社内にはAzure環境があり、自前で自由にアプリ開発できる体制も整っています。各部門の課題を精査したうえで、効果が大きいものに絞って提案してください。なお、一般的なサブスクで簡単に入手できるようなものは評価されにくいため、その点も踏まえて選定したいです。",
        alwaysRequired: true, // 全企業で必須
      },
      {
        keyword: "E2E",
        label: "E2E",
        question: "E2E（エンド・ツー・エンド）サービスで顧客価値を最大化するには？",
        alwaysRequired: false,
        requiredForMOLMaritex: true,
      },
      {
        keyword: "デジタルツイン",
        label: "デジタルツイン",
        question: "デジタルツイン技術を活用して業務効率化・予測保全を実現するには？",
        alwaysRequired: false,
        requiredForMOLMaritex: true,
      },
    ];

    // 必須バッジを追加
    for (const badge of requiredBadges) {
      // このバッジが必要かどうかを判定
      const isRequired = badge.alwaysRequired || (badge.requiredForMOLMaritex && isMOLMaritex);
      if (!isRequired) continue;

      // 既に含まれているかチェック
      const hasKeyword = finalQuestions.some(
        (q: { label: string; question: string }) =>
          q.label.includes(badge.keyword) || q.question.includes(badge.keyword)
      );

      // 含まれていなければ追加
      if (!hasKeyword) {
        // 30個を超えないよう、最後の1つを置き換え
        if (finalQuestions.length >= 30) {
          finalQuestions = finalQuestions.slice(0, 29);
        }
        finalQuestions.push({
          label: badge.label,
          question: badge.question,
        });
      }
    }

    return NextResponse.json({
      questions: finalQuestions,
      source: "rag",
    });
  } catch (error) {
    console.error("Preset questions generation error:", error);
    // エラー時もcompanyProfileを取得してみる（失敗しても問題なし）
    let companyName = "";
    try {
      const companyProfile = await prisma.companyProfile.findFirst();
      companyName = companyProfile?.name || "";
    } catch {
      // ignore
    }
    return NextResponse.json({
      questions: getDefaultQuestions(companyName),
      source: "default",
      error: error instanceof Error ? error.message : "生成に失敗しました",
    });
  }
}

// デフォルトの質問（RAGがない場合や生成失敗時）
// 注意：抽象的・汎用的な質問（価値提案、顧客価値、イノベーションなど）は除外
function getDefaultQuestions(companyName: string = "") {
  const isMOLMaritex = companyName.includes("商船三井マリテックス") || companyName.includes("MOLマリテックス");

  const baseQuestions = [
    // === AI・生成AI系 ===
    { label: "生成AI", question: "生成AIで業務効率化・新サービス創出するには？" },
    { label: "AIエージェント", question: "AIエージェントで複雑な業務を自動化するアプリを作るには？" },
    { label: "RAG構築", question: "社内ナレッジをRAG化して、誰でもAIに質問できる環境を作るには？" },
    { label: "AI活用", question: "AIチャットボットで顧客対応を効率化するには？" },
    { label: "Claude/GPT", question: "Claude/GPTを業務に組み込んだ内製アプリを開発するには？" },

    // === 自動化・システム系 ===
    { label: "社内DX", question: "会社でDXを推進したいと考えています。社内の自動化・効率化を進められる仕組みを作りたいです。まずは、最もインパクトの大きいアプリ案を提案してください。全社で共通利用できるもの、または親会社・グループ会社でも同様のニーズが見込めて横展開できるものを優先したいです。社内にはAzure環境があり、自前で自由にアプリ開発できる体制も整っています。各部門の課題を精査したうえで、効果が大きいものに絞って提案してください。なお、一般的なサブスクで簡単に入手できるようなものは評価されにくいため、その点も踏まえて選定したいです。" },
    { label: "自動化", question: "業務自動化（RPA・AI）で人的リソースを最適化するには？" },
    { label: "ワークフロー", question: "承認ワークフローを自動化して意思決定速度を上げるには？" },
    { label: "API連携", question: "複数システムをAPI連携させてデータの二重入力をなくすには？" },

    // === ドローン・IoT・先端技術系 ===
    { label: "ドローン", question: "ドローン技術を活用した新サービス・業務効率化を実現するには？" },
    { label: "IoTセンサー", question: "IoTセンサーでリアルタイム監視・予知保全を実現するには？" },
    { label: "エッジAI", question: "エッジAIで現場判断を自動化・高速化するには？" },

    // === データ・分析系 ===
    { label: "データ分析", question: "顧客データ分析で売上を向上させるには？" },
    { label: "ダッシュボード", question: "経営ダッシュボードでリアルタイムにKPIを可視化するには？" },
    { label: "予測モデル", question: "需要予測モデルで在庫コスト・機会損失を最小化するには？" },

    // === 組織・プロセス最適化系 ===
    { label: "会議削減", question: "会議時間を半減させながら意思決定品質を維持するには？" },
    { label: "非同期化", question: "同期コミュニケーションを減らし、深い集中時間を確保するには？" },
    { label: "属人化解消", question: "ベテランの暗黙知をシステム化して属人化を解消するには？" },
    { label: "破滅回避", question: "致命的な失敗を防ぐためのフェイルセーフ設計をどう組み込むか？" },

    // === 事業・収益系 ===
    { label: "親会社支援", question: "親会社グループへの貢献価値を高めるには？" },
    { label: "新規事業", question: "既存の強みを活かした新規事業は何か？" },
    { label: "サブスク", question: "サブスクリプション型収益モデルを導入するには？" },
    { label: "横展開", question: "成功した社内システムを他社・グループ会社に横展開するには？" },

    // === 人材・組織系 ===
    { label: "専門人材", question: "エンジニア・専門人材の採用競争に勝つには？" },
    { label: "人材育成", question: "人材育成・技術継承で差別化するには？" },
    { label: "内製化", question: "IT内製化で外注コストを削減しながら開発速度を上げるには？" },

    // === インフラ・セキュリティ系 ===
    { label: "クラウド", question: "クラウド移行でシステムコストを削減するには？" },
    { label: "Azure活用", question: "Azure環境を最大限活用してコスト効率の良いシステムを構築するには？" },
    { label: "セキュリティ", question: "サイバーセキュリティ対策を強化しながら利便性を損なわないには？" },

    // === その他戦略系 ===
    { label: "脱炭素", question: "脱炭素化支援で新たな収益源を作るには？" },
  ];

  // 商船三井マリテックスの場合のみ追加するバッジ
  if (isMOLMaritex) {
    baseQuestions.push(
      { label: "E2E", question: "E2E（エンド・ツー・エンド）サービスで顧客価値を最大化するには？" },
      { label: "デジタルツイン", question: "デジタルツイン技術を活用して業務効率化・予測保全を実現するには？" },
      { label: "船舶IoT", question: "船舶へのIoT導入で運航効率・安全性を向上させるには？" },
      { label: "遠隔監視", question: "遠隔監視システムで現場作業を効率化するには？" }
    );
  }

  return baseQuestions;
}
