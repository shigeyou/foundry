import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/claude";
import {
  BATCH_PROMPT,
  normalizeScore,
  type DiscoveredNeed,
  businessThemes,
  departments,
  themeAngles,
  deptContext,
} from "@/lib/meta-finder-prompt";
import { triggerReportGeneration } from "@/app/api/meta-finder/report/route";
import { getFinancialSummaryForPrompt } from "@/config/department-financials";

// 単一パターンの探索を実行（テーマ別視点・部門別文脈を注入）
async function explorePattern(
  themeId: string,
  themeName: string,
  deptId: string,
  deptName: string,
  documentContext: string
): Promise<DiscoveredNeed[]> {
  const themeAngle = themeAngles[themeId] || "";
  const deptCtx = deptContext[deptId] || "";

  const userPrompt = `${documentContext}

## 追加の指示

### 探索テーマ：${themeName}
${themeAngle}

### 対象部門：${deptName}
${deptCtx}

上記のテーマと部門の文脈を深く理解した上で、
この組み合わせでしか出てこない固有の課題と打ち手を発見してください。
「どのテーマ・部門でも言えること」は除外し、この組み合わせならではの施策に集中してください。`;

  const response = await generateWithClaude(
    `${BATCH_PROMPT}\n\n${userPrompt}`,
    {
      temperature: 0.8,
      maxTokens: 8000,
      jsonMode: true,
      usePoolDeployment: true,
    }
  );

  const parsed = JSON.parse(response);
  return (parsed.needs || []).map((need: DiscoveredNeed) => ({
    ...need,
    financial: normalizeScore(need.financial),
    customer: normalizeScore(need.customer),
    process: normalizeScore(need.process),
    growth: normalizeScore(need.growth),
  }));
}

// バックグラウンドでバッチ処理を実行（再開対応）
async function runBatchInBackground(batchId: string) {
  const errors: string[] = [];

  try {
    // バッチの現在状態を取得（再開時に途中からスキップするため）
    const batch = await prisma.metaFinderBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) return;

    let completedPatterns = batch.completedPatterns || 0;
    let totalIdeas = batch.totalIdeas || 0;

    // 既存エラーを引き継ぐ
    if (batch.errors) {
      try { errors.push(...JSON.parse(batch.errors)); } catch { /* ignore */ }
    }

    // 既に完了済みのパターンをDBから取得（再開時スキップ用）
    const existingIdeas = await prisma.metaFinderIdea.findMany({
      where: { batchId },
      select: { themeId: true, deptId: true },
    });
    const completedSet = new Set(
      existingIdeas.map((i) => `${i.themeId}:${i.deptId}`)
    );

    console.log(`[MetaFinder Batch] Starting/Resuming: ${completedPatterns}/${batch.totalPatterns} done, ${completedSet.size} patterns in DB`);

    // RAGドキュメントを取得（俺ナビ専用を除外）
    const ragDocuments = await prisma.rAGDocument.findMany({
      where: { scope: { not: "orenavi" } },
      select: { filename: true, content: true },
    });

    if (ragDocuments.length === 0) {
      await prisma.metaFinderBatch.update({
        where: { id: batchId },
        data: { status: "failed", errors: JSON.stringify(["RAGドキュメントがありません"]) },
      });
      return;
    }

    // 予算ドキュメントを優先配置
    const RAG_CONTEXT_BUDGET = 50000;
    const budgetDocs = ragDocuments.filter(d =>
      d.filename.includes("予算") || d.filename.includes("取締役会議案書")
    );
    const otherDocs = ragDocuments.filter(d => !budgetDocs.includes(d));

    let documentContext = "## 【最重要】FY26期初予算・財務データ\n\n";
    documentContext += "以下の予算データは最も重要な参照資料です。探索においては各部門の財務状況を最優先で考慮してください。\n";
    documentContext += "※FY25は着地見込み（未確定）、FY26は期初予算（予測値）であり、いずれも実績確定値ではありません。\n\n";

    // 予算ドキュメント: 全文注入（最大15,000文字）
    for (const doc of budgetDocs) {
      documentContext += `### ${doc.filename}\n${doc.content.slice(0, 15000)}\n\n`;
    }

    // 静的財務サマリーも追加
    documentContext += getFinancialSummaryForPrompt();

    // その他ドキュメント: 残り予算で均等配分
    documentContext += "\n\n## その他の分析対象ドキュメント\n\n";
    const remainingBudget = RAG_CONTEXT_BUDGET - documentContext.length;
    const charsPerOtherDoc = otherDocs.length > 0
      ? Math.max(500, Math.min(2000, Math.floor(remainingBudget / otherDocs.length)))
      : 0;
    for (const doc of otherDocs) {
      documentContext += `### ${doc.filename}\n${doc.content.slice(0, charsPerOtherDoc)}\n\n`;
    }

    // SWOT分析結果を取得・注入
    const swot = await prisma.defaultSwot.findFirst();
    if (swot) {
      documentContext += `## SWOT分析（自社の戦略的位置づけ）

### 強み（Strengths）
${swot.strengths}

### 弱み（Weaknesses）
${swot.weaknesses}

### 機会（Opportunities）
${swot.opportunities}

### 脅威（Threats）
${swot.threats}
${swot.summary ? `\n### SWOT総括\n${swot.summary}` : ""}

**上記のSWOT分析を踏まえ、強みを活かし弱みを補う施策、機会を捉え脅威に備える施策を優先的に提案してください。**

`;
    }

    // 全パターンを構築（未完了のみ）
    const pendingPatterns: { theme: typeof businessThemes[0]; dept: typeof departments[0] }[] = [];
    for (const theme of businessThemes) {
      for (const dept of departments) {
        const patternKey = `${theme.id}:${dept.id}`;
        if (!completedSet.has(patternKey)) {
          pendingPatterns.push({ theme, dept });
        }
      }
    }

    console.log(`[MetaFinder Batch] ${pendingPatterns.length} patterns remaining`);

    // 並列数: BATCH_CONCURRENCY環境変数で調整可能（デフォルト40）
    // スライディングウィンドウ方式: N件を常に並列稼働し、完了次第次の呼び出しを開始
    // RAGコンテキスト20,000文字 x 40 = 推定TPM余裕あり
    // レート制限エラーが出る場合: env BATCH_CONCURRENCY=20 などで下げること
    const CONCURRENCY = parseInt(process.env.BATCH_CONCURRENCY || "60");

    // DB保存用バッファ（スライディングウィンドウ内の完了済み結果を随時保存）
    const ideasBuffer: {
      id: string; batchId: string; themeId: string; themeName: string;
      deptId: string; deptName: string; name: string; description: string;
      actions: string | null; reason: string;
      financial: number; customer: number; process: number; growth: number; score: number;
    }[] = [];

    let cancelledFlag = false;
    let lastProgressSave = Date.now();

    // スライディングウィンドウ: N個のワーカーが常に並列稼働
    let patternIndex = 0;

    async function worker() {
      while (true) {
        const idx = patternIndex++;
        if (idx >= pendingPatterns.length) break;

        // キャンセルチェック（10パターンごと）
        if (idx % 10 === 0) {
          const currentBatch = await prisma.metaFinderBatch.findUnique({
            where: { id: batchId },
            select: { status: true },
          });
          if (currentBatch?.status === "cancelled") {
            cancelledFlag = true;
            return;
          }
        }

        if (cancelledFlag) return;

        const { theme, dept } = pendingPatterns[idx];

        try {
          const needs = await explorePattern(
            theme.id, theme.label, dept.id, dept.label, documentContext
          );

          for (const need of needs) {
            const score = (need.financial + need.customer + need.process + need.growth) / 4;
            ideasBuffer.push({
              id: `idea-${batchId}-${theme.id}-${dept.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              batchId,
              themeId: theme.id,
              themeName: theme.label,
              deptId: dept.id,
              deptName: dept.label,
              name: need.name,
              description: need.description,
              actions: need.actions ? JSON.stringify(need.actions) : null,
              reason: need.reason,
              financial: need.financial,
              customer: need.customer,
              process: need.process,
              growth: need.growth,
              score,
            });
            totalIdeas++;
          }
        } catch (err) {
          const errorMsg = `${theme.label} × ${dept.label}: ${err instanceof Error ? err.message : "Unknown error"}`;
          console.error(`[MetaFinder Batch] Error:`, errorMsg);
          errors.push(errorMsg);
        }

        completedPatterns++;

        // バッファが溜まったら or 5秒経過したら DBに保存
        const now = Date.now();
        if (ideasBuffer.length >= 20 || (now - lastProgressSave) >= 5000) {
          if (ideasBuffer.length > 0) {
            const toInsert = ideasBuffer.splice(0, ideasBuffer.length);
            await prisma.metaFinderIdea.createMany({ data: toInsert });
          }
          await prisma.metaFinderBatch.update({
            where: { id: batchId },
            data: {
              completedPatterns,
              totalIdeas,
              currentTheme: theme.label,
              currentDept: dept.label,
              ...(errors.length > 0 && { errors: JSON.stringify(errors) }),
            },
          });
          lastProgressSave = now;
        }
      }
    }

    // N個のワーカーを起動して待機
    console.log(`[MetaFinder Batch] Starting ${CONCURRENCY} workers (sliding window)`);
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    if (cancelledFlag) {
      console.log(`[MetaFinder Batch] Cancelled at ${completedPatterns}/${batch.totalPatterns}`);
      return;
    }

    // 残バッファをDB保存
    if (ideasBuffer.length > 0) {
      await prisma.metaFinderIdea.createMany({ data: ideasBuffer });
    }
    await prisma.metaFinderBatch.update({
      where: { id: batchId },
      data: { completedPatterns, totalIdeas, ...(errors.length > 0 && { errors: JSON.stringify(errors) }) },
    });

    // 完了
    await prisma.metaFinderBatch.update({
      where: { id: batchId },
      data: {
        status: "completed",
        completedAt: new Date(),
        currentTheme: null,
        currentDept: null,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
      },
    });

    console.log(`[MetaFinder Batch] Completed: ${totalIdeas} ideas from ${completedPatterns} patterns`);

    // 完了後に自動でレポート生成を起動（バックグラウンド）
    triggerReportGeneration(batchId).catch(err => {
      console.error("[MetaFinder Batch] Auto report trigger failed:", err);
    });

  } catch (error) {
    console.error(`[MetaFinder Batch] Fatal error:`, error);
    await prisma.metaFinderBatch.update({
      where: { id: batchId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errors: JSON.stringify([...errors, error instanceof Error ? error.message : "Unknown error"]),
      },
    });
  }
}

// サーバー起動時に未完了バッチを再開
export async function resumeRunningBatches() {
  try {
    const runningBatches = await prisma.metaFinderBatch.findMany({
      where: { status: "running" },
    });

    for (const batch of runningBatches) {
      console.log(`[MetaFinder Batch] Resuming interrupted batch: ${batch.id} (${batch.completedPatterns}/${batch.totalPatterns})`);
      runBatchInBackground(batch.id);
    }
  } catch (error) {
    console.error("[MetaFinder Batch] Failed to resume batches:", error);
  }
}

// POST: バッチ処理を開始
export async function POST() {
  try {
    // 既に実行中のバッチがあるか確認
    const running = await prisma.metaFinderBatch.findFirst({
      where: { status: "running" },
    });

    if (running) {
      return NextResponse.json({
        error: "既にバッチ処理が実行中です",
        batchId: running.id,
        progress: `${running.completedPatterns}/${running.totalPatterns}`,
      }, { status: 409 });
    }

    // 新しいバッチを作成
    const totalPatterns = businessThemes.length * departments.length;
    const batch = await prisma.metaFinderBatch.create({
      data: {
        id: `batch-${Date.now()}`,
        totalPatterns,
      },
    });

    // バックグラウンドで実行開始（awaitしない）
    runBatchInBackground(batch.id);

    return NextResponse.json({
      message: "バッチ処理を開始しました",
      batchId: batch.id,
      totalPatterns,
      estimatedTime: `約${Math.ceil(totalPatterns / 60)}時間`,
    });

  } catch (error) {
    console.error("Failed to start batch:", error);
    return NextResponse.json(
      { error: "バッチ処理の開始に失敗しました" },
      { status: 500 }
    );
  }
}

// GET: バッチ処理の状態を取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("id");

    // 特定のバッチを取得
    if (batchId) {
      const batch = await prisma.metaFinderBatch.findUnique({
        where: { id: batchId },
      });

      if (!batch) {
        return NextResponse.json({ error: "バッチが見つかりません" }, { status: 404 });
      }

      return NextResponse.json(batch);
    }

    // 最新のバッチを取得
    const latest = await prisma.metaFinderBatch.findFirst({
      orderBy: { startedAt: "desc" },
    });

    // 全バッチ一覧（全件返却）
    const batches = await prisma.metaFinderBatch.findMany({
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        totalPatterns: true,
        completedPatterns: true,
        totalIdeas: true,
        startedAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json({ latest, batches });

  } catch (error) {
    console.error("Failed to get batch status:", error);
    return NextResponse.json(
      { error: "バッチ状態の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: バッチ処理をキャンセル or 全履歴削除
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("id");

    // 全履歴削除
    if (batchId === "all") {
      // 実行中のバッチがあれば削除不可
      const running = await prisma.metaFinderBatch.findFirst({
        where: { status: "running" },
      });
      if (running) {
        return NextResponse.json(
          { error: "実行中のバッチがあります。先にキャンセルしてください。" },
          { status: 409 }
        );
      }

      // 全バッチを削除（Ideaはカスケード削除）
      const deleteResult = await prisma.metaFinderBatch.deleteMany({});

      return NextResponse.json({
        message: "全履歴を削除しました",
        deletedCount: deleteResult.count,
      });
    }

    if (!batchId) {
      return NextResponse.json({ error: "batchIdが必要です" }, { status: 400 });
    }

    const batch = await prisma.metaFinderBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json({ error: "バッチが見つかりません" }, { status: 404 });
    }

    // 実行中のバッチはキャンセル、それ以外は削除
    if (batch.status === "running") {
      await prisma.metaFinderBatch.update({
        where: { id: batchId },
        data: {
          status: "cancelled",
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ message: "バッチ処理をキャンセルしました" });
    }

    // 完了済み/キャンセル済み/失敗バッチを削除（Idea・Reportはカスケード削除）
    await prisma.metaFinderReport.deleteMany({ where: { batchId } });
    await prisma.metaFinderBatch.delete({ where: { id: batchId } });

    return NextResponse.json({ message: "履歴を削除しました" });

  } catch (error) {
    console.error("Failed to delete/cancel batch:", error);
    return NextResponse.json(
      { error: "処理に失敗しました" },
      { status: 500 }
    );
  }
}
