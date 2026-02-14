import { chromium } from 'playwright';
import path from 'path';

async function recordScoreTab() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: path.join(process.cwd(), 'demo-video'),
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  // スコア設定タブに移動
  await page.goto('http://localhost:3006');
  await page.waitForTimeout(1000);

  // スコア設定タブをクリック
  await page.click('text=スコア設定');
  await page.waitForTimeout(2000);

  // スライダーを少し動かすデモ
  const slider = page.locator('input[type="range"]').first();
  await slider.click();
  await page.waitForTimeout(1000);

  // 詳細を展開
  await page.click('button:has-text("▶")');
  await page.waitForTimeout(2000);

  // 少し下にスクロール
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(2000);

  // 別の軸をクリック
  const buttons = page.locator('button:has-text("▶")');
  if (await buttons.count() > 0) {
    await buttons.first().click();
    await page.waitForTimeout(2000);
  }

  // 40秒まで待機（ナレーションの長さに合わせる）
  await page.waitForTimeout(30000);

  await context.close();
  await browser.close();

  console.log('Recording completed!');
}

recordScoreTab().catch(console.error);
