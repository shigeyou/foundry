import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/claude";
import { departments, deptContext } from "@/lib/meta-finder-prompt";
import { getDeptFinancial, formatProfitLoss } from "@/config/department-financials";

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

    // 財務データを取得
    const deptFinancial = getDeptFinancial(scope.id);
    let financialContext = "";
    if (deptFinancial && deptFinancial.profitStatus !== "na") {
      const yoy = deptFinancial.fy26OperatingProfit - deptFinancial.fy25OperatingProfit;
      const yoyPct = deptFinancial.fy25OperatingProfit !== 0
        ? ((yoy / Math.abs(deptFinancial.fy25OperatingProfit)) * 100).toFixed(1)
        : "—";
      financialContext = `\n## 【最重要】財務データ（${deptFinancial.budgetDeptName}）
※FY25は着地見込み（2026年2月時点の見込値・未確定）、FY26は期初予算（予測値）です。いずれも実績確定値ではありません。
- FY26予算 営業損益: ${formatProfitLoss(deptFinancial.fy26OperatingProfit)}
- FY25着地見込 営業損益: ${formatProfitLoss(deptFinancial.fy25OperatingProfit)}
- 見込→予算の増減: ${formatProfitLoss(yoy)}（${yoyPct}%）
- FY26予算 売上高: ${deptFinancial.fy26Revenue.toLocaleString("ja-JP")}千円
- 損益見通し: ${deptFinancial.profitStatus === "profit" ? "黒字予算" : "赤字予算"}
- 傾向: ${deptFinancial.trend === "up" ? "改善見込↑" : deptFinancial.trend === "down" ? "悪化見込↓" : "横ばい見込→"}
- 備考: ${deptFinancial.keyNote}

**この予算データを最優先で参照し、レポートの先頭（executiveSummary）で必ず財務評価に言及してください。**
**「実績」ではなく「予算・見込み」であることを明記し、赤字予算の部門は「黒字化・損益改善」を主軸に、黒字予算の部門は「利益拡大・競争力強化」を主軸に分析してください。**\n`;
    } else if (deptFinancial) {
      financialContext = `\n## 財務データ
${deptFinancial.budgetDeptName}は間接部門のため個別P/Lはありません。\n`;
    }

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
        engagementContext += `### ${doc.filename}\n${doc.content}\n\n`;
      }
    }

    const prompt = `あなたは社内の経営企画担当です。メタファインダーで見つかったアイデアを分析し、${scope.name}のレポートを作ってください。

## ★最重要：文章のルール
- **中学生でも読める平易な日本語**で書くこと。難しい言い回しは禁止
- すべての提案は**「誰が」「何を」「いつまでに」やるか**が分かるように書くこと
- 1文は60文字以内を目安に。短く、歯切れよく
- 確信がないことは書かない。データや根拠がないなら「不明」と書くこと

### 使ってはいけない表現（これらを使ったら書き直すこと）
❌ 「〜の醸成」「〜の構築」「〜の推進」「〜の強化」「〜の高度化」「〜の最適化」
❌ 「エコシステム」「レバレッジ」「シナジー」「パラダイム」「トランスフォーメーション」
❌ 「包括的な」「戦略的に」「抜本的な」「横断的に」「持続的な」「有機的な」
❌ 「〜を図る」「〜を目指す」「〜を検討する」（←やるのかやらないのか不明）

### 代わりにこう書くこと
✅ 「〜を始める」「〜をやめる」「〜を変える」「〜を作る」「〜を減らす」
✅ 「部長が」「経理部が」「4月までに」「月1回」「3ヶ月以内に」
✅ 具体的な数字・期限・担当を入れる。入れられないなら「要検討」と正直に書く

## 対象: ${scope.name}
${scope.desc ? `（${scope.desc}）` : ""}
${financialContext}

## この部門の特徴
${deptCharacteristics || `${scope.name}は全社横断的な視点で課題を捉える対象です。`}
${engagementContext}

## アイデア一覧（スコア順、上位${totalCount}件）
${ideasText}

## 統計
- 総アイデア数: ${totalCount}
- 平均スコア: ${avgScore}
- BSC平均: 財務${avgFinancial} 顧客${avgCustomer} 業務${avgProcess} 成長${avgGrowth}

## 分析の方針
1. ${scope.name}の実際の仕事内容・人の働き方を踏まえて書くこと
2. エンゲージメントサーベイのデータがあれば、この部門の数値を引用すること
3. サーベイデータがなくても、この部門ならではの働き方の問題を具体的に書くこと（一般論は不要）
4. 課題は事業面だけでなく、組織・人材・マネジメントの内部問題も半分程度含めること

## 出力JSON形式

{${deptFinancial && deptFinancial.profitStatus !== "na" ? `
  "financialAssessment": {
    "fy26OperatingProfit": ${deptFinancial.fy26OperatingProfit},
    "fy25OperatingProfit": ${deptFinancial.fy25OperatingProfit},
    "yoyChange": ${deptFinancial.fy26OperatingProfit - deptFinancial.fy25OperatingProfit},
    "profitStatus": "${deptFinancial.profitStatus}",
    "assessment": "FY26予算とFY25見込みを比較して2-3文で。予算・見込みであり確定値ではない点を明記",
    "keyRisks": ["この部門の財務上の具体的リスクを2-3個。抽象的に書かず、何がどうなるとまずいかを書く"],
    "improvementLevers": ["売上を増やす具体策、またはコストを減らす具体策を2-3個"]
  },` : ""}
  "executiveSummary": "${deptFinancial && deptFinancial.profitStatus !== "na"
    ? `5項目を箇条書き（各行「・ラベル：内容」形式）:\\n・財務評価：FY26予算 営業損益${formatProfitLoss(deptFinancial.fy26OperatingProfit)}。前年見込みとの差と、その主な原因を1文で\\n・部門概要：何をしている部門か、どんな人が何人くらいいるかを1文で\\n・エンゲージメント：この部門で働く人が抱える具体的な不満・不安を1文で\\n・主要課題：一番深刻な問題は何かを1-2文で\\n・やるべきこと：最優先でやるべき具体的な打ち手を1文で`
    : `3項目を箇条書き（各行「・ラベル：内容」形式）:\\n・主要課題：${scope.name}の一番大きな問題を1-2文で\\n・やるべきこと：その課題への対処法を1文で\\n・最優先の打ち手：すぐ始められる施策を1文で`
  }",
  "issues": {
    "items": [
      {
        "title": "課題名（10-20文字。例：見積作成に3日かかりすぎ）",
        "category": "カテゴリ（例: エンゲージメント, 組織体制, 人材, マネジメント, 業務効率, DX, 事業戦略 等）",
        "challenge": "何が問題なのかを2-3文で。${scope.name}でなぜ深刻なのかを具体的に書く",
        "evidence": "そう言える根拠。アイデアのデータやサーベイの数値から",
        "severity": "high | medium | low"
      }
    ],
    "summary": "課題をまとめると要するにどういう状態なのかを2-3文で"
  },
  "solutions": {
    "items": [
      {
        "title": "やること（10-20文字。例：見積テンプレート統一）",
        "challenge": "対応する課題名",
        "solution": "打ち手の名前",
        "description": "何をどうするのかを2-3文で。この部門で実際にできることを書く",
        "actions": ["誰が何をいつまでにやるか1", "誰が何をいつまでにやるか2", "誰が何をいつまでにやるか3"],
        "priority": "immediate | short-term | mid-term",
        "expectedOutcome": "これをやると何がどう良くなるか1-2文で"
      }
    ],
    "summary": "打ち手をまとめると結局何をやるのかを2-3文で"
  },
  "strategies": {
    "items": [
      {
        "name": "勝ち筋の名前（分かりやすく）",
        "description": "この戦略で何がどう変わるかを2-3文で",
        "bscScores": { "financial": 1-5, "customer": 1-5, "process": 1-5, "growth": 1-5 },
        "rationale": "なぜうまくいくと思うのか、根拠を2-3文で",
        "keyActions": ["具体的にやること1（担当・期限入り）", "具体的にやること2", "具体的にやること3"],
        "kpi": "成功したかどうかを測る指標（例：受注件数を月5件→8件に）"
      }
    ],
    "summary": "結局この部門は何で勝つのかを2-3文で"
  }
}

## 制約
- ${deptFinancial && deptFinancial.profitStatus !== "na"
    ? `executiveSummaryは「・財務評価」「・部門概要」「・エンゲージメント」「・主要課題」「・やるべきこと」の5項目\n- financialAssessmentは具体的な数字と原因分析を入れること`
    : `executiveSummaryは「・主要課題」「・やるべきこと」「・最優先の打ち手」の3項目`
  }
- issuesは6-8件。うち半分は組織・人材・マネジメントの内部課題とする
- エンゲージメントの課題を最低1件含め、${scope.name}固有の問題を書くこと
- severity=highは3-4件
- solutionsは各課題に対応して6-8件
- strategiesは5-8件、BSCスコアは1-5の整数
- actionsとkeyActionsは「誰が・何を・いつまでに」を意識して書くこと。書けない部分は「要検討」と書く
- データに基づいて書くこと。根拠のない提案は不可
- JSONのみ出力。前後に余分なテキスト不要`;

    // 段階的リトライ: 途切れた場合はトークン数を増やして再試行（最大2回）
    const tokenLevels = [16000, 32000];
    let sections;
    let lastError: Error | null = null;

    for (const maxTokens of tokenLevels) {
      try {
        const result = await generateWithClaude(prompt, {
          temperature: 0.25,
          maxTokens,
          jsonMode: true,
        });

        // JSON解析
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

        // パース成功 → ループ抜ける
        if (sections) break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[Report] ${scope.name}: maxTokens=${maxTokens} で失敗、リトライ: ${lastError.message}`);
        continue;
      }
    }

    if (!sections) {
      throw lastError || new Error("レポート生成に失敗");
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
