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
      maxTokens: 6000,
      jsonMode: true,
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

    let documentContext = "## 分析対象ドキュメント\n\n";
    for (const doc of ragDocuments) {
      documentContext += `### ${doc.filename}\n${doc.content.slice(0, 3000)}\n\n`;
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

    // 並列数: 各パターン約12,500トークン(入力+出力) x 10 = 125,000 TPM
    // Azure制限を超える場合は6-8に減らすこと
    const CONCURRENCY = 10;

    // チャンク単位で並列実行
    for (let i = 0; i < pendingPatterns.length; i += CONCURRENCY) {
      // キャンセルチェック
      const currentBatch = await prisma.metaFinderBatch.findUnique({
        where: { id: batchId },
        select: { status: true },
      });
      if (currentBatch?.status === "cancelled") {
        console.log(`[MetaFinder Batch] Cancelled at ${completedPatterns}/${batch.totalPatterns}`);
        return;
      }

      const chunk = pendingPatterns.slice(i, i + CONCURRENCY);

      // 進捗表示（チャンク内の最初のパターン名）
      const labels = chunk.map((p) => `${p.theme.label}×${p.dept.label}`).join(", ");
      console.log(`[MetaFinder Batch] Exploring ${chunk.length} patterns in parallel: ${labels}`);

      await prisma.metaFinderBatch.update({
        where: { id: batchId },
        data: {
          currentTheme: chunk.map((p) => p.theme.label).join(", "),
          currentDept: chunk.map((p) => p.dept.label).join(", "),
        },
      });

      // 並列実行
      const results = await Promise.allSettled(
        chunk.map(async ({ theme, dept }) => {
          const needs = await explorePattern(
            theme.id, theme.label, dept.id, dept.label, documentContext
          );
          return { theme, dept, needs };
        })
      );

      // 結果をDB保存
      for (const result of results) {
        if (result.status === "fulfilled") {
          const { theme, dept, needs } = result.value;
          for (const need of needs) {
            const score = (need.financial + need.customer + need.process + need.growth) / 4;
            await prisma.metaFinderIdea.create({
              data: {
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
              },
            });
            totalIdeas++;
          }
        } else {
          const pattern = chunk[results.indexOf(result)];
          const errorMsg = `${pattern.theme.label} × ${pattern.dept.label}: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`;
          console.error(`[MetaFinder Batch] Error:`, errorMsg);
          errors.push(errorMsg);
        }
        completedPatterns++;
      }

      // チャンク完了後に進捗更新
      await prisma.metaFinderBatch.update({
        where: { id: batchId },
        data: {
          completedPatterns,
          totalIdeas,
          ...(errors.length > 0 && { errors: JSON.stringify(errors) }),
        },
      });
    }

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

    if (batch.status !== "running") {
      return NextResponse.json({ error: "実行中のバッチではありません" }, { status: 400 });
    }

    // ステータスをキャンセル済みに更新
    await prisma.metaFinderBatch.update({
      where: { id: batchId },
      data: {
        status: "cancelled",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ message: "バッチ処理をキャンセルしました" });

  } catch (error) {
    console.error("Failed to delete/cancel batch:", error);
    return NextResponse.json(
      { error: "処理に失敗しました" },
      { status: 500 }
    );
  }
}
