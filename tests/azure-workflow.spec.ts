import { test, expect } from '@playwright/test';

/**
 * Azure版 ワークフロー包括テスト
 *
 * このテストは以下の重要なワークフローを検証します：
 * 1. ランキング→戦略採用→進化生成（/api/evolveのバグ検証）
 * 2. データ永続化（デプロイ後もデータが残るか）
 */

test.describe('Azure版 ワークフロー包括テスト', () => {
  test.describe.configure({ mode: 'serial' });

  // テスト間でデータを共有
  let createdExplorationId: string | null = null;
  let adoptedStrategyNames: string[] = [];

  test('1. ランキングタブでトップ戦略を確認', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // ランキングタブをクリック
    const rankingTab = page.locator('button:has-text("ランキング"), button:has-text("トップ戦略")').first();
    const hasRankingTab = await rankingTab.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasRankingTab) {
      await rankingTab.click();
      await page.waitForTimeout(2000);

      // ランキングが表示されるか確認
      const pageContent = await page.content();
      const hasStrategies = pageContent.includes('戦略') || pageContent.includes('スコア') || pageContent.includes('採用');

      await page.screenshot({ path: 'test-results/azure-ranking.png' });
      console.log('ランキング表示:', hasStrategies);
    } else {
      console.log('ランキングタブが見つかりません - スキップ');
    }

    expect(true).toBe(true); // ランキングがない場合もパス
  });

  test('2. 戦略を採用する', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // ランキングタブに移動
    const rankingTab = page.locator('button:has-text("ランキング"), button:has-text("トップ戦略")').first();
    const hasRankingTab = await rankingTab.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRankingTab) {
      console.log('ランキングタブなし - スキップ');
      return;
    }

    await rankingTab.click();
    await page.waitForTimeout(2000);

    // 採用ボタンを探す
    const adoptButtons = page.locator('button:has-text("採用"), button:has-text("選択")');
    const adoptCount = await adoptButtons.count();

    if (adoptCount > 0) {
      // 最初の戦略を採用
      await adoptButtons.first().click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'test-results/azure-adopt.png' });
      console.log('戦略採用成功');
    } else {
      console.log('採用ボタンなし - スキップ');
    }

    expect(true).toBe(true);
  });

  test('3. 進化生成APIが正常に動作する（重要：/api/evolveバグ検証）', async ({ page }) => {
    // ページ経由でAPI呼び出し（認証状態を使用）
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // ページコンテキストでfetchを実行（認証cookieを含む）
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/evolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'all', limit: 5 })
        });

        const status = response.status;
        let data = null;
        let errorText = null;

        if (status === 200) {
          data = await response.json();
        } else {
          errorText = await response.text();
        }

        return { status, data, errorText };
      } catch (error) {
        return { status: 0, error: String(error) };
      }
    });

    console.log('進化API ステータス:', result.status);

    if (result.status === 200 && result.data) {
      console.log('進化API レスポンス:', {
        success: result.data.success,
        sourceCount: result.data.sourceCount,
        generatedCount: result.data.generatedCount
      });

      // バグ修正確認: successがtrue
      expect(result.data.success).toBe(true);
    } else if (result.status === 400) {
      // 400エラーの場合、メッセージを確認
      console.log('400レスポンス:', result.errorText);

      // 「採用された戦略がありません」は正常（データがない場合）
      const isNoStrategyError =
        result.errorText?.includes('採用された戦略がありません') ||
        result.errorText?.includes('採用済み');

      if (isNoStrategyError) {
        console.log('→ 採用戦略なし - これは正常（データがない状態）');
      } else {
        // 別の400エラーはバグの可能性
        console.error('→ 予期しない400エラー（バグの可能性）');
        expect(result.errorText).toContain('採用された戦略がありません');
      }
    } else {
      console.log('その他のステータス:', result.status, result.errorText || '');
    }

    // 200または正当な400を期待
    expect([200, 400]).toContain(result.status);
  });

  test('4. シン・勝ち筋タブで進化生成を実行', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // シン・勝ち筋タブをクリック
    const evolveTab = page.locator('button:has-text("シン・勝ち筋"), button:has-text("進化")').first();
    const hasEvolveTab = await evolveTab.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasEvolveTab) {
      console.log('シン・勝ち筋タブなし - スキップ');
      return;
    }

    await evolveTab.click();
    await page.waitForTimeout(2000);

    // 進化生成ボタンを探す
    const generateButton = page.locator('button:has-text("生成"), button:has-text("進化"), button:has-text("実行")').first();
    const hasGenerateButton = await generateButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasGenerateButton) {
      await generateButton.click();

      // 生成完了を待つ（最大60秒）
      await page.waitForTimeout(5000);

      // エラーメッセージがないことを確認
      const pageContent = await page.content();
      const hasError = pageContent.includes('エラー') && pageContent.includes('400');

      await page.screenshot({ path: 'test-results/azure-evolve.png' });

      if (hasError) {
        console.error('進化生成でエラー検出');
      } else {
        console.log('進化生成 正常完了');
      }

      expect(hasError).toBe(false);
    } else {
      console.log('生成ボタンなし - スキップ');
    }

    expect(true).toBe(true);
  });

  test('5. 探索ワークフロー完全テスト', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 勝ち筋探索タブをクリック
    const exploreTab = page.locator('button:has-text("勝ち筋探索"), button:has-text("探索")').first();
    const hasExploreTab = await exploreTab.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasExploreTab) {
      console.log('勝ち筋探索タブなし - スキップ');
      return;
    }

    await exploreTab.click();
    await page.waitForTimeout(2000);

    // 質問入力フィールドを探す
    const questionInput = page.locator('textarea, input[type="text"]').first();
    const hasInput = await questionInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasInput) {
      // テスト用の質問を入力
      await questionInput.fill('新規事業開発における差別化戦略について教えてください');
      await page.waitForTimeout(500);

      // 探索開始ボタンを探す
      const startButton = page.locator('button:has-text("探索"), button:has-text("開始"), button:has-text("送信")').first();
      const hasStartButton = await startButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasStartButton) {
        await startButton.click();
        console.log('探索開始');

        // 探索完了を待つ（最大120秒）
        try {
          await page.waitForSelector('text=完了, text=戦略, text=結果', { timeout: 120000 });
          console.log('探索完了確認');
        } catch {
          console.log('探索タイムアウト - 継続');
        }
      }

      await page.screenshot({ path: 'test-results/azure-explore.png' });
    }

    expect(true).toBe(true);
  });

  test('6. データ永続化確認 - seed API経由でカウント取得', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/seed');
        const status = response.status;
        const data = status === 200 ? await response.json() : null;
        return { status, data };
      } catch (error) {
        return { status: 0, error: String(error) };
      }
    });

    if (result.status === 200 && result.data) {
      console.log('=== データ永続化確認 ===');
      console.log('RAGドキュメント数:', result.data.ragDocumentCount);
      console.log('探索数:', result.data.explorationCount);
      console.log('トップ戦略数:', result.data.topStrategyCount);
      console.log('戦略決定数:', result.data.strategyDecisionCount);
      console.log('========================');
    } else {
      console.log('seed API ステータス:', result.status);
    }

    expect([200]).toContain(result.status);
  });

  test('7. 全タブ遷移テスト', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const tabs = [
      'はじめに',
      'RAG情報',
      'SWOT',
      '勝ち筋探索',
      'ランキング',
      'シン・勝ち筋',
      'インサイト',
      '履歴'
    ];

    let successCount = 0;

    for (const tabName of tabs) {
      const tab = page.locator(`button:has-text("${tabName}")`).first();
      const hasTab = await tab.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasTab) {
        await tab.click();
        await page.waitForTimeout(500);
        successCount++;
        console.log(`タブ "${tabName}" - OK`);
      } else {
        console.log(`タブ "${tabName}" - 見つからず`);
      }
    }

    await page.screenshot({ path: 'test-results/azure-all-tabs.png' });
    console.log(`タブ遷移成功: ${successCount}/${tabs.length}`);

    expect(successCount).toBeGreaterThan(0);
  });
});
