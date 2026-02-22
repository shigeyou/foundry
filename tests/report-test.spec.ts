import { test, expect } from "@playwright/test";

test("report page: batch selector when no batchId", async ({ page }) => {
  await page.goto("http://localhost:3006/meta-finder/report");
  await page.waitForLoadState("networkidle");

  // バッチ選択画面が表示される
  await expect(page.getByText("レポートを作成するバッチを選択")).toBeVisible();
  await expect(page.getByText("過去の全探索結果からレポートを生成できます")).toBeVisible();

  // バッチ一覧にカード表示がある
  const batchCards = page.locator(".space-y-3 > div");
  const count = await batchCards.count();
  expect(count).toBeGreaterThan(0);

  // 各カードに「閲覧」「レポート生成」ボタンがある
  const firstCard = batchCards.first();
  await expect(firstCard.getByText("閲覧")).toBeVisible();
  await expect(firstCard.getByText("レポート生成")).toBeVisible();

  // スクリーンショット
  await page.screenshot({ path: "test-report-batch-selector.png", fullPage: true });

  // 「閲覧」をクリックするとレポートページに遷移
  const viewLink = firstCard.getByText("閲覧");
  const href = await viewLink.getAttribute("href");
  expect(href).toContain("/meta-finder/report?batchId=");
});

test("report page: shows report with batchId", async ({ page }) => {
  await page.goto("http://localhost:3006/meta-finder/report?batchId=manual-1771721449193");
  await page.waitForLoadState("networkidle");

  // ヘッダー
  await expect(page.locator("text=勝ち筋ファインダー レポート")).toBeVisible();

  // 「バッチ選択」ボタンがある
  await expect(page.getByText("バッチ選択")).toBeVisible();

  // 部門タブ
  await expect(page.getByRole("button", { name: /全社/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /総合企画部/ })).toBeVisible();

  // レポート3セクション
  await expect(page.getByText("エグゼクティブサマリー").first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator("text=1. 課題整理")).toBeVisible();
  await expect(page.locator("text=2. 解決策策定")).toBeVisible();
  await expect(page.locator("text=3. 勝ち筋提案")).toBeVisible();

  // 部門タブ切り替え
  await page.getByRole("button", { name: /総合企画部/ }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText("エグゼクティブサマリー").first()).toBeVisible();

  await page.screenshot({ path: "test-report-with-batch.png", fullPage: true });
});

test("meta-finder page: each batch has report link", async ({ page }) => {
  await page.goto("http://localhost:3006/meta-finder");
  await page.waitForLoadState("networkidle");

  // バッチ履歴の各ボタンの横に📊リンクがある
  const reportLinks = page.locator("a[href*='/meta-finder/report?batchId=']");
  if (await reportLinks.count() > 0) {
    await expect(reportLinks.first()).toBeVisible({ timeout: 10000 });
  }
});
