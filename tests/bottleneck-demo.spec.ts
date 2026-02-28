import { test, expect } from "@playwright/test";

test("経費精算フロー分析のデモ画面を確認", async ({ page }) => {
  // プロジェクト一覧
  await page.goto("http://localhost:3006/ja/bottleneck");
  await page.waitForTimeout(3000);

  // スクリーンショット: 一覧画面
  await page.screenshot({ path: "tests/screenshots/bottleneck-list.png", fullPage: true });

  // 完了ステータスのプロジェクトをクリック
  const projectLink = page.locator('a[href*="/bottleneck/bnp-"]').first();
  await expect(projectLink).toBeVisible({ timeout: 10000 });
  await projectLink.click();
  await page.waitForURL(/\/bottleneck\/bnp-/, { timeout: 10000 });
  await page.waitForTimeout(3000);

  // ワークスペースが表示される（タブが表示されるまで待機）
  await expect(page.locator("text=AI分析を実行").or(page.locator("text=分析中"))).toBeVisible({ timeout: 15000 });

  // スクリーンショット: ワークスペース画面
  await page.screenshot({ path: "tests/screenshots/bottleneck-workspace.png", fullPage: true });

  // フロータブに切り替え
  const flowTab = page.locator("button").filter({ hasText: "フロー" });
  await flowTab.click();
  await page.waitForTimeout(3000);

  // フローチャートが表示される
  await expect(page.locator("text=現状フロー").or(page.locator("text=業務フローチャート"))).toBeVisible({ timeout: 10000 });

  // スクリーンショット: Before フロー画面
  await page.screenshot({ path: "tests/screenshots/bottleneck-flow-before.png", fullPage: true });

  // After切り替えボタンがあれば切り替え
  const afterBtn = page.locator("button").filter({ hasText: "After" });
  if (await afterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await afterBtn.click();
    await page.waitForTimeout(3000);

    // スクリーンショット: After フロー画面
    await page.screenshot({ path: "tests/screenshots/bottleneck-flow-after.png", fullPage: true });

    // Beforeに戻す
    const beforeBtn = page.locator("button").filter({ hasText: "Before" });
    await beforeBtn.click();
    await page.waitForTimeout(1000);
  }

  // レポートタブに切り替え
  const reportTab = page.locator("button").filter({ hasText: "レポート" });
  await reportTab.click();
  await page.waitForTimeout(2000);

  // レポートが表示される
  await expect(page.locator("text=エグゼクティブサマリー")).toBeVisible({ timeout: 10000 });

  // スクリーンショット: レポート画面
  await page.screenshot({ path: "tests/screenshots/bottleneck-report.png", fullPage: true });
});
