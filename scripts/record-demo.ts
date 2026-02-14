import { chromium } from 'playwright';
import * as path from 'path';

const BASE_URL = 'http://localhost:3006';

// 各セクションの待機時間（ミリ秒）- ナレーション長に合わせて調整
const TIMING = {
  intro: 32000,        // 01_intro: 31秒
  overview: 57000,     // 02_overview: 55秒
  company: 45000,      // 03_company: 43秒
  rag: 41000,          // 04_rag: 39秒
  swot: 43000,         // 05_swot: 41秒
  explore: 37000,      // 06_explore: 35秒
  preset: 51000,       // 07_preset: 49秒
  ranking: 45000,      // 08_ranking: 43秒
  strategies: 54000,   // 09_strategies: 52秒
  insights: 43000,     // 10_insights: 41秒
  closing: 42000,      // 11_closing: 40秒
};

async function recordDemo() {
  const outputDir = path.join(process.cwd(), 'demo-video');

  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1280,720'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();

  console.log('Recording started...');
  console.log('Total expected duration: ~490 seconds (8 minutes)');

  try {
    // 1. はじめに（イントロ）- 32秒
    console.log('Section 1: はじめに (32s)');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.click('nav button:has-text("はじめに")');
    await page.waitForTimeout(5000);
    // スクロールしてコンテンツを見せる
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(TIMING.intro - 23000);

    // 2. タブ構成の俯瞰 - 57秒
    console.log('Section 2: タブ構成の俯瞰 (57s)');
    // 各タブを順にハイライトするようにホバー（ゆっくり）
    const tabs = ['対象企業', 'RAG情報', 'SWOT', 'スコア設定', '勝ち筋探索', 'ランキング', 'シン・勝ち筋の探求', 'インサイト', '探索履歴'];
    for (const tab of tabs) {
      const tabButton = page.locator(`nav button:has-text("${tab}")`);
      if (await tabButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tabButton.hover();
        await page.waitForTimeout(5500); // 各タブで5.5秒
      }
    }
    await page.waitForTimeout(TIMING.overview - tabs.length * 5500);

    // 3. 対象企業 - 45秒
    console.log('Section 3: 対象企業 (45s)');
    await page.click('nav button:has-text("対象企業")');
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(10000);
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
    await page.waitForTimeout(10000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(TIMING.company - 28000);

    // 4. RAG情報 - 41秒
    console.log('Section 4: RAG情報 (41s)');
    await page.click('nav button:has-text("RAG情報")');
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(12000);
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
    await page.waitForTimeout(12000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(TIMING.rag - 32000);

    // 5. SWOT - 43秒
    console.log('Section 5: SWOT (43s)');
    await page.click('nav button:has-text("SWOT")');
    await page.waitForTimeout(15000);
    // 4象限をゆっくり見せる
    await page.evaluate(() => window.scrollTo({ top: 100, behavior: 'smooth' }));
    await page.waitForTimeout(15000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(TIMING.swot - 30000);

    // 6. 勝ち筋探索（説明部分）- 37秒
    console.log('Section 6: 勝ち筋探索（説明）(37s)');
    await page.click('nav button:has-text("勝ち筋探索")');
    await page.waitForTimeout(10000);
    // 画面全体を見せる
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'smooth' }));
    await page.waitForTimeout(12000);
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(TIMING.explore - 22000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // 7. プリセット質問の実行フロー - 51秒
    console.log('Section 7: プリセット質問の実行 (51s)');
    await page.waitForTimeout(3000);

    // プリセット質問バッジをクリック（rounded-full のボタンを探す）
    let presetClicked = false;
    try {
      // プリセット質問のバッジを探す（rounded-full クラスを持つボタン）
      const presetBadges = page.locator('button.rounded-full');
      const count = await presetBadges.count();
      console.log(`  - Found ${count} preset badges`);

      if (count > 0) {
        // 最初のバッジをクリック
        const firstBadge = presetBadges.first();
        await firstBadge.scrollIntoViewIfNeeded();
        await page.waitForTimeout(2000);
        console.log('  - Clicking first preset badge...');
        await firstBadge.click();
        presetClicked = true;
        await page.waitForTimeout(3000);

        // 2番目のバッジもクリック（複数選択をデモ）
        if (count > 1) {
          console.log('  - Clicking second preset badge...');
          await presetBadges.nth(1).click();
          await page.waitForTimeout(3000);
        }

        // 「探索する」ボタンをクリック
        const exploreButton = page.locator('button:has-text("探索する")');
        if (await exploreButton.isVisible({ timeout: 2000 })) {
          console.log('  - Clicking explore button...');
          await exploreButton.click();
          await page.waitForTimeout(5000);

          // プログレスバーの進行を見せる
          console.log('  - Waiting for exploration progress...');
          await page.waitForTimeout(25000);
        }
      }
    } catch (e) {
      console.log('  - Preset badge click error:', e);
    }

    if (!presetClicked) {
      // バッジが見つからない場合は直接入力
      console.log('  - Preset badges not found, typing question manually');
      const questionInput = page.locator('textarea').first();
      if (await questionInput.isVisible({ timeout: 2000 })) {
        await questionInput.click();
        await page.waitForTimeout(2000);
        await questionInput.fill('既存の強みを活かした新規事業として、どのような領域が考えられますか？');
        await page.waitForTimeout(5000);
      }
    }

    // 探索結果エリアを見せる
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(Math.max(0, TIMING.preset - 48000));

    // 8. ランキング - 45秒
    console.log('Section 8: ランキング (45s)');
    await page.click('nav button:has-text("ランキング")');
    await page.waitForTimeout(8000);
    // 1行目を展開
    try {
      const firstRow = page.locator('table tbody tr').first();
      if (await firstRow.isVisible({ timeout: 2000 })) {
        await firstRow.click();
        await page.waitForTimeout(8000);
        // スコア内訳を見せる
        await page.evaluate(() => window.scrollTo({ top: 150, behavior: 'smooth' }));
        await page.waitForTimeout(10000);
      }
    } catch {
      // 続行
    }
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(10000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(TIMING.ranking - 36000);

    // 9. シン・勝ち筋の探求 - 54秒
    console.log('Section 9: シン・勝ち筋の探求 (54s)');
    await page.click('nav button:has-text("シン・勝ち筋の探求")');
    await page.waitForTimeout(10000);
    // 進化生成の説明を見せる
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(10000);
    // 「AI自動探索」サブタブをクリック
    try {
      const autoExploreTab = page.locator('button:has-text("AI自動探索")').first();
      if (await autoExploreTab.isVisible({ timeout: 2000 })) {
        await autoExploreTab.click();
        await page.waitForTimeout(8000);
        // AI自動探索の説明を見せる
        await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'smooth' }));
        await page.waitForTimeout(8000);
      }
    } catch {
      // 続行
    }
    // 履歴を展開
    try {
      const historyItem = page.locator('button').filter({ hasText: /トップ:|完了/ }).first();
      if (await historyItem.isVisible({ timeout: 2000 })) {
        await historyItem.click();
        await page.waitForTimeout(8000);
      }
    } catch {
      // 続行
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(TIMING.strategies - 44000);

    // 10. インサイト - 43秒
    console.log('Section 10: インサイト (43s)');
    await page.click('nav button:has-text("インサイト")');
    await page.waitForTimeout(10000);
    // 学習パターンを見せる
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'smooth' }));
    await page.waitForTimeout(8000);
    // メタ分析タブをクリック
    try {
      const metaTab = page.locator('button:has-text("メタ分析")').first();
      if (await metaTab.isVisible({ timeout: 2000 })) {
        await metaTab.click();
        await page.waitForTimeout(10000);
        await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'smooth' }));
        await page.waitForTimeout(8000);
      }
    } catch {
      // 続行
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(TIMING.insights - 36000);

    // 11. クロージング - 42秒
    console.log('Section 11: クロージング (42s)');
    await page.click('nav button:has-text("はじめに")');
    await page.waitForTimeout(8000);
    // AIとの向き合い方セクションを見せる
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(12000);
    // 「対象企業の設定から始める」ボタンを見せる
    await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
    await page.waitForTimeout(12000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(TIMING.closing - 32000);

    console.log('Recording completed!');
  } catch (error) {
    console.error('Error during recording:', error);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  console.log(`Video saved to: ${outputDir}`);
}

recordDemo().catch(console.error);
