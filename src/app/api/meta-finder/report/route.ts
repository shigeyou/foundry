import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/claude";
import { departments, deptContext } from "@/lib/meta-finder-prompt";

// 自動レポート生成のトリガー（バッチ完了時に呼び出す）
export async function triggerReportGeneration(batchId: string): Promise<void> {
  try {
    // 既存レポートを削除（再生成）
    await prisma.metaFinderReport.deleteMany({ where: { batchId } });

    const scopes = departments.map(d => ({ id: d.id, name: d.label, desc: d.description }));

    const reportRecords = scopes.map(s => ({
      id: `report-${batchId}-${s.id}`,
      batchId,
      scope: s.id,
      scopeName: s.name,
      sections: "{}",
      status: "pending",
    }));

    for (const r of reportRecords) {
      await prisma.metaFinderReport.create({ data: r });
    }

    // バックグラウンドで生成開始
    generateAllReports(batchId, scopes).catch(err => {
      console.error("[Report] Auto background generation failed:", err);
    });

    console.log(`[Report] Auto-triggered report generation for batch ${batchId}`);
  } catch (error) {
    console.error(`[Report] Failed to trigger auto report generation for ${batchId}:`, error);
  }
}

// GET: レポート取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");

    if (!batchId) {
      return NextResponse.json({ error: "batchIdが必要です" }, { status: 400 });
    }

    const reports = await prisma.metaFinderReport.findMany({
      where: { batchId },
      orderBy: { createdAt: "asc" },
    });

    // バッチ情報も返す
    const batch = await prisma.metaFinderBatch.findUnique({
      where: { id: batchId },
    });

    return NextResponse.json({ batch, reports });
  } catch (error) {
    console.error("Failed to get reports:", error);
    return NextResponse.json({ error: "レポート取得に失敗しました" }, { status: 500 });
  }
}

// POST: レポート生成
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId } = body;

    if (!batchId) {
      return NextResponse.json({ error: "batchIdが必要です" }, { status: 400 });
    }

    // バッチ存在チェック
    const batch = await prisma.metaFinderBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return NextResponse.json({ error: "バッチが見つかりません" }, { status: 404 });
    }

    // 既存レポートを削除（再生成）
    await prisma.metaFinderReport.deleteMany({ where: { batchId } });

    // 全社 + 各部門 = 14スコープ
    const scopes = departments.map(d => ({ id: d.id, name: d.label, desc: d.description }));

    // レポートレコードを一括作成
    const reportRecords = scopes.map(s => ({
      id: `report-${batchId}-${s.id}`,
      batchId,
      scope: s.id,
      scopeName: s.name,
      sections: "{}",
      status: "pending",
    }));

    for (const r of reportRecords) {
      await prisma.metaFinderReport.create({ data: r });
    }

    // バックグラウンドで生成開始（レスポンスは即返す）
    generateAllReports(batchId, scopes).catch(err => {
      console.error("[Report] Background generation failed:", err);
    });

    return NextResponse.json({
      message: "レポート生成を開始しました",
      batchId,
      totalScopes: scopes.length,
    });
  } catch (error) {
    console.error("Failed to start report generation:", error);
    return NextResponse.json({ error: "レポート生成の開始に失敗しました" }, { status: 500 });
  }
}

// バックグラウンドで全スコープのレポートを生成
async function generateAllReports(
  batchId: string,
  scopes: Array<{ id: string; name: string; desc: string }>
) {
  // 3並列で処理
  const concurrency = 3;
  for (let i = 0; i < scopes.length; i += concurrency) {
    const chunk = scopes.slice(i, i + concurrency);
    await Promise.all(chunk.map(scope => generateScopeReport(batchId, scope)));
  }
  console.log(`[Report] All ${scopes.length} scope reports generated for batch ${batchId}`);
}

async function generateScopeReport(
  batchId: string,
  scope: { id: string; name: string; desc: string }
) {
  const reportId = `report-${batchId}-${scope.id}`;

  try {
    await prisma.metaFinderReport.update({
      where: { id: reportId },
      data: { status: "generating" },
    });

    // このスコープのアイデアを取得（全社の場合は全部門、部門の場合はその部門のみ）
    const whereClause: Record<string, unknown> = { batchId };
    if (scope.id !== "all") {
      whereClause.deptId = scope.id;
    }

    const ideas = await prisma.metaFinderIdea.findMany({
      where: whereClause,
      orderBy: { score: "desc" },
      take: scope.id === "all" ? 40 : 25,
    });

    if (ideas.length === 0) {
      await prisma.metaFinderReport.update({
        where: { id: reportId },
        data: {
          status: "completed",
          sections: JSON.stringify({
            executiveSummary: `${scope.name}に該当するアイデアが見つかりませんでした。`,
            issues: { items: [], summary: "" },
            solutions: { items: [], summary: "" },
            strategies: { items: [], summary: "" },
          }),
        },
      });
      return;
    }

    // 統計計算
    const totalCount = ideas.length;
    const avgScore = (ideas.reduce((s, i) => s + i.score, 0) / totalCount).toFixed(2);
    const avgFinancial = (ideas.reduce((s, i) => s + i.financial, 0) / totalCount).toFixed(1);
    const avgCustomer = (ideas.reduce((s, i) => s + i.customer, 0) / totalCount).toFixed(1);
    const avgProcess = (ideas.reduce((s, i) => s + i.process, 0) / totalCount).toFixed(1);
    const avgGrowth = (ideas.reduce((s, i) => s + i.growth, 0) / totalCount).toFixed(1);

    // アイデアをフォーマット
    const ideasText = ideas.map((idea, idx) => {
      const actions = idea.actions ? JSON.parse(idea.actions) : [];
      return `【${idx + 1}】${idea.name}（スコア: ${idea.score.toFixed(1)}）
テーマ: ${idea.themeName} ／ 部門: ${idea.deptName}
概要: ${idea.description}
理由: ${idea.reason}
BSC: 財務${idea.financial}/5 顧客${idea.customer}/5 業務${idea.process}/5 成長${idea.growth}/5
${actions.length > 0 ? `アクション: ${actions.join(" / ")}` : ""}`;
    }).join("\n\n");

    // 部門特徴を取得
    const deptCharacteristics = deptContext[scope.id] || "";

    // RAGからエンゲージメントサーベイ関連ドキュメントを検索
    const engagementDocs = await prisma.rAGDocument.findMany({
      where: {
        scope: { not: "orenavi" },
        OR: [
          { filename: { contains: "エンゲージメント" } },
          { filename: { contains: "サーベイ" } },
          { filename: { contains: "従業員満足" } },
          { filename: { contains: "engagement" } },
          { filename: { contains: "ES調査" } },
          { filename: { contains: "組織診断" } },
          { filename: { contains: "職場環境" } },
        ],
      },
      select: { filename: true, content: true },
    });

    let engagementContext = "";
    if (engagementDocs.length > 0) {
      engagementContext = `\n## エンゲージメントサーベイ・従業員調査データ\n以下はRAGに格納されたエンゲージメント関連ドキュメントです。レポートの課題分析において、該当部門に関連するサーベイ結果を引用・参照してください。\n\n`;
      for (const doc of engagementDocs) {
        engagementContext += `### ${doc.filename}\n${doc.content.slice(0, 4000)}\n\n`;
      }
    }

    const prompt = `あなたは組織開発・経営コンサルタントです。メタファインダーで発見されたアイデア群を分析し、経営層向けのレポートを日本語で作成してください。

## 対象スコープ: ${scope.name}
${scope.desc ? `（${scope.desc}）` : ""}

## この部門の特徴
${deptCharacteristics || `${scope.name}は全社横断的な視点で課題を捉える対象です。`}
${engagementContext}

## 分析対象アイデア（スコア順、上位${totalCount}件）
${ideasText}

## 統計情報
- 総アイデア数: ${totalCount}
- 平均スコア: ${avgScore}
- BSC平均: 財務${avgFinancial} 顧客${avgCustomer} 業務${avgProcess} 成長${avgGrowth}

## 分析の重点方針

### レポートの構成順序
1. まず**${scope.name}固有の特徴**（役割・ミッション・業務の性質・人員構成の傾向）を踏まえて分析すること
2. エンゲージメントサーベイのデータがある場合は、**${scope.name}の個別スコア・順位・前年比等**を特定し引用すること（全社平均との比較も有効）。全社共通の数値をそのまま使うのではなく、この部門に該当する結果を抜き出すこと
3. サーベイデータがない場合は、**この部門の業務特性から固有のエンゲージメントリスクを具体的に推論**すること。例えば：
   - 長期洋上勤務がある部門 → 孤立感、家族との分離、キャリア不安
   - 技術者派遣部門 → 帰属意識の希薄化、自社への一体感の欠如
   - 管理・間接部門 → ルーティン業務による成長実感の喪失、貢献の可視化不足
   - 新規事業部門 → 先行き不透明感、成果が出るまでのモチベーション維持
   このように**部門の業務実態に即した具体的なエンゲージメント課題**を指摘すること
4. 「従業員のやりがい」「成長実感」「帰属意識」等の一般論ではなく、**${scope.name}の日常業務・働き方から逆算した具体的な問題**を述べること

### 内部課題の重視
課題整理にあたっては、**外部環境・技術的な課題だけでなく、組織内部の課題にも十分に目を向けること**。
具体的には以下のような内部課題を必ず含めて分析すること：
- **組織・体制**: 部門間サイロ、意思決定の遅さ、権限委譲不足、組織構造の硬直化
- **人材・HR**: 人材不足、スキルギャップ、採用難、離職率、後継者育成、キャリアパス不在
- **組織文化**: 変革への抵抗、心理的安全性、挑戦を許容しない風土、ナレッジ共有の欠如
- **マネジメント**: 中間管理職の負担、評価制度の形骸化、目標管理の不備、リーダーシップ不足
- **エンゲージメント**: この部門固有の従業員満足度の課題、仕事の意味実感、成長実感、貢献の認知、将来展望

**エンゲージメントの課題は全社共通の一般論を述べるのではなく、${scope.name}の業務実態・働き方・人員構成に即した固有の問題を指摘すること。**

これらの内部課題は、技術・事業面の課題と同等以上に重要であり、issues項目の半数程度（3-4件）は内部組織課題に割くこと。

## 出力指示
以下のJSON形式で出力してください。日本語で記述すること。

{
  "executiveSummary": "以下の4項目を箇条書き形式で記述すること（各行は「・ラベル：内容」の形式）:\n・部門概要：${scope.name}の役割・強み・人員の働き方を1文で\n・エンゲージメント：この部門固有の状況（サーベイデータがあれば個別スコアを引用、なければ業務特性から固有リスクを推論）を1文で\n・主要課題：事業課題と組織内部課題の両面から最重要の問題点を1-2文で\n・重点施策：最も有望な戦略・勝ち筋を1文で",
  "issues": {
    "items": [
      {
        "title": "課題の短いタイトル（10-20文字、例: 意思決定プロセスの品質不足）",
        "category": "課題カテゴリ名（例: エンゲージメント, 組織体制, 人材育成・HR, 組織文化, マネジメント, 業務効率, DX推進, 品質管理, 事業戦略 等）",
        "challenge": "課題の概要を2-3文で。${scope.name}の業務特性・働き方を踏まえ、なぜ**この部門で**この課題が特に深刻なのかを具体的に記述する。エンゲージメント関連の場合は、この部門の業務実態に基づく固有の問題（例：洋上勤務による孤立、派遣先常駐による帰属意識低下、等）を述べる。サーベイデータがあればこの部門の個別数値を引用する。",
        "evidence": "アイデア群やサーベイデータからの根拠。エンゲージメントについてはこの部門の業務実態のどの側面が問題を示唆しているか具体的に述べる。",
        "severity": "high | medium | low"
      }
    ],
    "summary": "課題整理全体のまとめを2-3文で。${scope.name}の特徴を踏まえ、事業面・組織内部面・エンゲージメント面の課題を俯瞰した総括とする。"
  },
  "solutions": {
    "items": [
      {
        "title": "解決策の短いタイトル（10-20文字、例: 事前統制Shift Left導入）",
        "challenge": "対応する課題名",
        "solution": "解決策名",
        "description": "解決策の詳細を2-3文で。${scope.name}の業務特性を考慮した実現可能な打ち手を記述する。エンゲージメント課題に対しては、この部門の働き方に合った具体的な施策（例：洋上からのオンライン1on1制度、派遣技術者の帰社日イベント等）を提案する。",
        "actions": ["具体的アクション1", "具体的アクション2", "具体的アクション3"],
        "priority": "immediate | short-term | mid-term",
        "expectedOutcome": "期待成果を1-2文で"
      }
    ],
    "summary": "解決策全体のまとめを2-3文で"
  },
  "strategies": {
    "items": [
      {
        "name": "勝ち筋の名前",
        "description": "戦略の概要を2-3文で。${scope.name}の強みを活かした戦略であること。",
        "bscScores": { "financial": 1-5, "customer": 1-5, "process": 1-5, "growth": 1-5 },
        "rationale": "なぜこの戦略が有効なのか、根拠を2-3文で",
        "keyActions": ["重要アクション1", "重要アクション2", "重要アクション3"],
        "kpi": "成果を測るKPI（例: 〇〇率を△%向上）"
      }
    ],
    "summary": "勝ち筋全体のまとめを2-3文で"
  }
}

## 重要な制約
- executiveSummaryは「・部門概要」「・エンゲージメント」「・主要課題」「・重点施策」の4項目箇条書きで記述し、必ず**この部門固有の**エンゲージメント状況にも触れること
- issuesは6-10件とし、うち3-4件は組織内部課題（組織体制/人材HR/文化/マネジメント/エンゲージメント）とすること
- エンゲージメント関連の課題を最低1件はissuesに含め、**全社共通の一般論ではなく${scope.name}固有の問題**を述べること
- severity=highを3-4件含むこと（内部課題にもhighを付けること）
- solutionsはissuesの各課題に1つ以上対応すること（6-10件）
- strategiesは5-8件、BSCスコアは1-5の整数で付けること
- 抽象的な表現を避け、具体的な施策名・アクション・KPIを記述すること
- アイデア群のデータに基づいた分析であること（根拠なき提案は不可）
- サーベイデータがある場合は**この部門の個別数値**を引用すること（全社平均だけの引用は不可）
- JSONのみを出力し、前後に余分なテキストを付けないこと`;

    const result = await generateWithClaude(prompt, {
      temperature: 0.4,
      maxTokens: 8000,
      jsonMode: true,
    });

    // JSON解析
    let sections;
    try {
      sections = JSON.parse(result);
    } catch {
      // JSONブロック抽出を試みる
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        sections = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("AI応答のJSON解析に失敗");
      }
    }

    await prisma.metaFinderReport.update({
      where: { id: reportId },
      data: {
        status: "completed",
        sections: JSON.stringify(sections),
      },
    });

    console.log(`[Report] Generated: ${scope.name} (${scope.id})`);
  } catch (error) {
    console.error(`[Report] Failed for ${scope.name}:`, error);
    await prisma.metaFinderReport.update({
      where: { id: reportId },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => {});
  }
}
