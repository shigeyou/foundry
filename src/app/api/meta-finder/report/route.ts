import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/claude";
import { departments, deptContext } from "@/lib/meta-finder-prompt";
import { getDeptFinancial, formatProfitLoss } from "@/config/department-financials";
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag-retrieval";

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

// GET: レポート取得（欠けたスコープがあれば自動補完生成）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");

    if (!batchId) {
      return NextResponse.json({ error: "batchIdが必要です" }, { status: 400 });
    }

    let reports = await prisma.metaFinderReport.findMany({
      where: { batchId },
      orderBy: { createdAt: "asc" },
    });

    // バッチ情報も返す
    const batch = await prisma.metaFinderBatch.findUnique({
      where: { id: batchId },
    });

    // departments配列に存在するがレポートが未生成のスコープを検出・自動生成
    if (reports.length > 0) {
      const existingScopes = new Set(reports.map(r => r.scope));
      const allScopes = departments.map(d => ({ id: d.id, name: d.label, desc: d.description }));
      const missingScopes = allScopes.filter(s => !existingScopes.has(s.id));

      if (missingScopes.length > 0) {
        console.log(`[Report] Auto-filling ${missingScopes.length} missing scopes for batch ${batchId}: ${missingScopes.map(s => s.id).join(", ")}`);

        // 欠けたスコープのレコードをpending状態で作成
        for (const s of missingScopes) {
          await prisma.metaFinderReport.upsert({
            where: { id: `report-${batchId}-${s.id}` },
            create: {
              id: `report-${batchId}-${s.id}`,
              batchId,
              scope: s.id,
              scopeName: s.name,
              sections: "{}",
              status: "pending",
            },
            update: {},
          });
        }

        // バックグラウンドで欠けたスコープのみ生成
        generateAllReports(batchId, missingScopes).catch(err => {
          console.error("[Report] Auto-fill generation failed:", err);
        });

        // 更新後のレポート一覧を再取得して返す
        reports = await prisma.metaFinderReport.findMany({
          where: { batchId },
          orderBy: { createdAt: "asc" },
        });
      }
    }

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

    // 全社 + 横断テーマ + 各部門 = 18スコープ
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

    // 全社スコープ専用の分析方針
    const isCompanyWide = scope.id === "all";

    // アイデアをフォーマット（全社向けは簡潔版でプロンプトサイズを抑制）
    const ideasText = ideas.map((idea, idx) => {
      if (isCompanyWide) {
        return `【${idx + 1}】${idea.name}（${idea.score.toFixed(1)}）${idea.themeName}／${idea.deptName}: ${idea.description.slice(0, 120)}`;
      }
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

    // RAG意味検索: エンゲージメント関連チャンクを取得
    const engagementChunks = await retrieveRelevantChunks({
      query: `${scope.name} エンゲージメント サーベイ 従業員満足度 組織診断 職場環境`,
      scope: ["shared"],
      deptIds: scope.id !== "all" ? [scope.id, "all"] : undefined,
      docTypes: ["survey"],
      topK: 15,
      maxChars: isCompanyWide ? 8000 : 15000,
    });
    const engagementContext = formatChunksForPrompt(
      engagementChunks,
      "エンゲージメントサーベイ・従業員調査データ",
    );

    // RAG意味検索: 経営戦略・組織関連チャンクを取得
    const strategicChunks = await retrieveRelevantChunks({
      query: `${scope.name} 経営戦略 組織体制 事業計画 経営課題`,
      scope: ["shared"],
      deptIds: scope.id !== "all" ? [scope.id, "all"] : undefined,
      docTypes: ["strategy", "org"],
      topK: 15,
      maxChars: isCompanyWide ? 8000 : 15000,
    });
    let strategicContext = "";
    if (strategicChunks.length > 0) {
      strategicContext = "\n**重要：これらのドキュメントの出典名・ファイル名をレポート本文中で言及しないでください。情報は自然に組み込んでください。**\n\n";
      strategicContext += formatChunksForPrompt(strategicChunks, "経営戦略・組織関連ドキュメント");
    }

    // RAG意味検索: 予算・財務関連チャンクを取得
    const budgetChunks = await retrieveRelevantChunks({
      query: `${scope.name} 予算 営業利益 売上 FY26 損益 財務`,
      scope: ["shared"],
      deptIds: scope.id !== "all" ? [scope.id, "all"] : undefined,
      docTypes: ["budget"],
      topK: 15,
      maxChars: isCompanyWide ? 8000 : 12000,
    });
    const budgetContext = formatChunksForPrompt(budgetChunks, "予算・財務関連データ");

    const prompt = `あなたは${isCompanyWide ? "CDIO直轄の経営戦略アドバイザー" : "経営企画部の分析担当"}です。メタファインダーで発見されたアイデア群を分析し、${scope.name}の経営レポートを日本語で作成してください。

## 文章の方針
- 読み手は**経営陣**です。ビジネス用語・専門用語はそのまま使ってください
- ただし**結論と具体的なアクションを明確に**書くこと。「何をするのか」が曖昧な文は不可
- 以下の表現は**結論を曖昧にするため禁止**：
  ❌ 「〜を図る」「〜を目指す」「〜を検討する」「〜の在り方を見直す」（やるのかやらないのか不明）
  → 代わりに「〜を導入する」「〜を廃止する」「〜を○○に変更する」など、行動が特定できる表現を使う
- actions・keyActionsには**担当部門・担当者レベルと期限の目安**を含めること（不明なら「要検討」と記載）
- 確信のない推測は書かない。データや根拠がなければ「情報不足」と明記すること
${isCompanyWide ? `
## 【重要】全社レポートの視座
これは個別部門の改善施策を寄せ集めたレポートではない。**取締役会・経営会議で議論すべき経営戦略レポート**である。
以下の視座を厳守すること：
- **部門単位のDX化・マニュアル整備・研修実施等の業務改善は一切記載しない**
- 事業ポートフォリオの最適化（赤字事業の撤退・縮小含む）
- M&A・アライアンス・新規事業開発による成長戦略
- 親会社（商船三井）グループ内での戦略的ポジショニング
- 組織ガバナンス改革（出向者依存体制の見直し、プロパー人材の経営参画）
- 全社の資本効率・営業損益の構造的改善
- エンゲージメント危機（全社45%、グループ比-18.7pt）の経営インパクトと対策
- 3-5年後のあるべき姿からの逆算戦略
` : ""}
## 対象スコープ: ${scope.name}
${scope.desc ? `（${scope.desc}）` : ""}
${financialContext}

## この部門の特徴
${deptCharacteristics || `${scope.name}は全社横断的な視点で課題を捉える対象です。`}
${budgetContext}
${engagementContext}
${strategicContext}

## 分析対象アイデア（スコア順、上位${totalCount}件）
${ideasText}

## 統計情報
- 総アイデア数: ${totalCount}
- 平均スコア: ${avgScore}
- BSC平均: 財務${avgFinancial} 顧客${avgCustomer} 業務${avgProcess} 成長${avgGrowth}

## 分析の重点方針
${isCompanyWide ? `1. 個別部門の話ではなく、全社の経営戦略・事業構造・組織ガバナンスの観点で分析すること
2. 各部門のアイデアを横断的に俯瞰し、全社レベルで共通する構造的課題を抽出すること
3. エンゲージメントサーベイのデータを全社経営課題として位置づけ、離職リスク・生産性低下の経営インパクトを定量的に論じること
4. 勝ち筋は「どの事業にどれだけ経営資源を投下するか」レベルの意思決定を伴うものとすること` : `1. ${scope.name}固有の業務特性・人員構成・働き方を踏まえた分析とすること
2. エンゲージメントサーベイのデータがある場合は、**この部門の個別数値**を引用すること（全社平均のみの引用は不可）
3. サーベイデータがない場合でも、**この部門の業務実態に即した固有のエンゲージメント課題**を推論すること（一般論は不可）
4. 課題は事業面だけでなく、**組織体制・人材・マネジメント・エンゲージメント等の内部課題**も半数程度含めること`}

## 出力JSON形式

{${deptFinancial && deptFinancial.profitStatus !== "na" ? `
  "financialAssessment": {
    "fy26OperatingProfit": ${deptFinancial.fy26OperatingProfit},
    "fy25OperatingProfit": ${deptFinancial.fy25OperatingProfit},
    "yoyChange": ${deptFinancial.fy26OperatingProfit - deptFinancial.fy25OperatingProfit},
    "profitStatus": "${deptFinancial.profitStatus}",
    "assessment": "FY26予算とFY25着地見込みを比較し、損益の増減要因を2-3文で分析。いずれも予測・見込みであり実績確定値ではない点を明記",
    "keyRisks": ["財務上の具体的リスク（何がどう悪化すると損益にいくら影響するか）を2-3個"],
    "improvementLevers": ["損益改善の具体策（売上増 or コスト減の施策と想定効果）を2-3個"]
  },` : ""}
  "executiveSummary": "${deptFinancial && deptFinancial.profitStatus !== "na"
    ? `以下の5項目を箇条書き形式で記述すること（各行は「・ラベル：内容」の形式）:\\n・財務評価：FY26予算の営業損益${formatProfitLoss(deptFinancial.fy26OperatingProfit)}（予算値）。FY25着地見込みからの増減要因を1文で\\n・部門概要：${scope.name}の主要業務・強み・人員の特徴を1文で\\n・エンゲージメント：この部門固有の従業員課題（サーベイデータがあれば個別スコアを引用）を1文で\\n・主要課題：事業面・組織面の最重要問題を1-2文で\\n・重点施策：最優先で実行すべき具体的な打ち手を1文で`
    : `以下の3項目を箇条書き形式で記述すること（各行は「・ラベル：内容」の形式）:\\n・主要課題：${scope.name}が担う全社横断機能における最重要課題を1-2文で\\n・改善の方向性：課題に対する具体的なアプローチを1文で\\n・重点施策：最優先で実行すべき施策を1文で`
  }",
  "issues": {
    "items": [
      {
        "title": "課題の端的なタイトル（10-20文字）",
        "category": "課題カテゴリ（例: エンゲージメント, 組織体制, 人材育成・HR, マネジメント, 業務効率, DX推進, 事業戦略 等）",
        "challenge": "課題の概要を2-3文で。${scope.name}の業務特性を踏まえ、なぜこの部門で特に深刻かを具体的に記述",
        "evidence": "アイデア群やサーベイデータからの根拠。具体的な数値やアイデア名を引用すること",
        "severity": "high | medium | low"
      }
    ],
    "summary": "課題全体の総括を2-3文で。事業面・組織内部面の両面から俯瞰した状況認識を記述"
  },
  "solutions": {
    "items": [
      {
        "title": "施策の端的なタイトル（10-20文字）",
        "challenge": "対応する課題名",
        "solution": "施策名",
        "description": "施策の詳細を2-3文で。${scope.name}の実情を考慮した実行可能な打ち手を記述",
        "actions": ["担当部門/担当者が・何を・いつまでに実行するか（例：事業部長が4月までに○○体制を立ち上げ）", "アクション2", "アクション3"],
        "priority": "immediate | short-term | mid-term",
        "expectedOutcome": "期待成果を1-2文で。可能なら定量的な目標を含める"
      }
    ],
    "summary": "施策全体の総括を2-3文で"
  },
  "strategies": {
    "items": [
      {
        "name": "勝ち筋の名前",
        "description": "戦略の概要と期待される変化を2-3文で。${scope.name}の強みをどう活かすかを含める",
        "bscScores": { "financial": 1-5, "customer": 1-5, "process": 1-5, "growth": 1-5 },
        "rationale": "この戦略が有効である根拠を2-3文で",
        "keyActions": ["担当・期限を含む具体的アクション1", "アクション2", "アクション3"],
        "kpi": "成果を測定するKPI（例: 外部売上比率を現状XX%→FY27にYY%）"
      }
    ],
    "summary": "この部門の勝ち筋の全体像を2-3文で"
  }
}

## 制約
- ${deptFinancial && deptFinancial.profitStatus !== "na"
    ? `executiveSummaryは「・財務評価」「・部門概要」「・エンゲージメント」「・主要課題」「・重点施策」の5項目で構成し、先頭に必ず財務評価を記述すること\n- financialAssessmentは具体的な数字と増減要因分析を含めること`
    : isCompanyWide
      ? `executiveSummaryは「・全社財務概観」「・事業ポートフォリオ評価」「・組織・ガバナンス課題」「・エンゲージメント危機」「・最優先経営アジェンダ」の5項目で構成すること`
      : `executiveSummaryは「・主要課題」「・改善の方向性」「・重点施策」の3項目で構成すること`
  }
${isCompanyWide ? `- issuesは8-10件。事業ポートフォリオ・財務構造・組織ガバナンス・人材戦略・エンゲージメント等の経営レベルの課題を網羅すること
- 個別部門の業務改善レベルの課題（DX化、マニュアル整備等）は記載しない
- severity=highを5-6件含めること
- solutionsは各課題に対応して8-10件。経営会議で承認が必要なレベルの施策とすること
- strategiesは6-10件。事業ポートフォリオの再構築、M&A/アライアンス、組織再編等の大きな打ち手を含めること。BSCスコアは1-5の整数` : `- issuesは6-8件。うち半数は組織・人材・マネジメント・エンゲージメント等の内部課題とすること
- エンゲージメントの課題を最低1件含め、**${scope.name}固有の問題**を記述すること（全社共通の一般論は不可）
- severity=highを3-4件含めること（内部課題にもhighを付けること）
- solutionsは各課題に対応して6-8件
- strategiesは5-8件、BSCスコアは1-5の整数`}
- actionsとkeyActionsには担当（部門/役職レベル）と期限の目安を含めること。特定できない場合は「要検討」と記載
- アイデア群のデータに基づいた分析であること。根拠のない提案は不可
- サーベイデータがある場合は**この部門の個別数値**を引用すること
- JSONのみを出力し、前後に余分なテキストを付けないこと`;

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
