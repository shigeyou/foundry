import { chromium } from 'playwright';
import path from 'path';

// 各セクションの長さ（秒）- ナレーションの元の長さに合わせる
const sections = [
  { name: 'intro', tab: null, duration: 31 },
  { name: 'overview', tab: null, duration: 55 },
  { name: 'company', tab: '対象企業', duration: 43 },
  { name: 'rag', tab: 'RAG情報', duration: 33 },
  { name: 'swot', tab: 'SWOT', duration: 41 },
  { name: 'score', tab: 'スコア設定', duration: 40 },
  { name: 'explore', tab: '勝ち筋探索', duration: 35 },
  { name: 'preset', tab: '勝ち筋探索', duration: 49 },
  { name: 'ranking', tab: 'ランキング', duration: 43 },
  { name: 'strategies', tab: 'シン・勝ち筋', duration: 52 },
  { name: 'insights', tab: 'インサイト', duration: 41 },
  { name: 'closing', tab: null, duration: 40 },
];

async function recordFullDemo() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: path.join(process.cwd(), 'demo-video'),
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  // ホームに移動
  await page.goto('http://localhost:3006');
  await page.waitForTimeout(2000);

  let currentTab = '';

  for (const section of sections) {
    console.log(`Recording section: ${section.name} (${section.duration}s)`);

    if (section.tab && section.tab !== currentTab) {
      // タブをクリック
      try {
        await page.click(`text=${section.tab}`);
        currentTab = section.tab;
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log(`Tab not found: ${section.tab}`);
      }
    }

    // セクション固有のアクション
    if (section.name === 'company') {
      // 対象企業タブのデモ
      await page.waitForTimeout(section.duration * 1000);
    } else if (section.name === 'rag') {
      // RAG情報タブのデモ
      await page.waitForTimeout(section.duration * 1000);
    } else if (section.name === 'swot') {
      // SWOTタブのデモ
      await page.waitForTimeout(section.duration * 1000);
    } else if (section.name === 'score') {
      // スコア設定タブのデモ - スライダーを動かす
      await page.waitForTimeout(2000);
      const slider = page.locator('input[type="range"]').first();
      if (await slider.count() > 0) {
        await slider.click();
        await page.waitForTimeout(1000);
      }
      // 詳細を展開
      const expandBtn = page.locator('button:has-text("▶")').first();
      if (await expandBtn.count() > 0) {
        await expandBtn.click();
        await page.waitForTimeout(2000);
      }
      await page.waitForTimeout(section.duration * 1000 - 5000);
    } else if (section.name === 'explore') {
      // 勝ち筋探索タブの説明
      await page.waitForTimeout(section.duration * 1000);
    } else if (section.name === 'preset') {
      // プリセット質問デモ - バッジをクリックして探索
      await page.waitForTimeout(3000);

      // バッジをクリック（ドローンなど）
      const badges = page.locator('.flex.flex-wrap.gap-2 button, button.rounded-full');
      const badgeCount = await badges.count();
      console.log(`Found ${badgeCount} badges`);
      if (badgeCount > 0) {
        await badges.first().click();
        console.log('Clicked badge');
        await page.waitForTimeout(2000);
      }

      // 「探索する」ボタンをクリック（青いボタン）
      const exploreBtn = page.getByRole('button', { name: '探索する', exact: true });
      if (await exploreBtn.count() > 0) {
        await exploreBtn.click();
        console.log('Clicked explore button');
        await page.waitForTimeout(3000);
      }

      // 探索完了を待つ（最大60秒）
      console.log('Waiting for exploration results...');
      try {
        await page.waitForSelector('text=なぜ勝てる', { timeout: 60000 });
        console.log('Exploration completed!');
        await page.waitForTimeout(10000); // 結果を10秒間表示
      } catch {
        console.log('Exploration timeout, continuing...');
        // タイムアウトしても続行
      }
    } else if (section.name === 'ranking') {
      // ランキングタブのデモ - 行をクリックして詳細表示
      await page.waitForTimeout(3000);
      const row = page.locator('tr').nth(1);
      if (await row.count() > 0) {
        await row.click();
        await page.waitForTimeout(3000);
      }
      await page.waitForTimeout(section.duration * 1000 - 6000);
    } else if (section.name === 'strategies') {
      // シン・勝ち筋タブのデモ
      await page.waitForTimeout(5000);

      // 進化生成タブを表示（デフォルト）
      await page.waitForTimeout(20000);

      // AI自動探索タブをクリック
      const autoExploreTab = page.locator('button:has-text("AI自動探索")');
      if (await autoExploreTab.count() > 0) {
        await autoExploreTab.click();
        await page.waitForTimeout(section.duration * 1000 - 25000);
      } else {
        await page.waitForTimeout(section.duration * 1000 - 25000);
      }
    } else if (section.name === 'insights') {
      // インサイトタブのデモ
      await page.waitForTimeout(5000);

      // 学習パターンを表示（デフォルト）
      await page.waitForTimeout(15000);

      // メタ分析タブをクリック
      const metaTab = page.locator('button:has-text("メタ分析")');
      if (await metaTab.count() > 0) {
        await metaTab.click();
        await page.waitForTimeout(section.duration * 1000 - 20000);
      } else {
        await page.waitForTimeout(section.duration * 1000 - 20000);
      }
    } else {
      // その他
      await page.waitForTimeout(section.duration * 1000);
    }
  }

  await context.close();
  await browser.close();

  console.log('Full demo recording completed!');
}

recordFullDemo().catch(console.error);
