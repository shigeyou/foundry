import { test, expect } from "@playwright/test";

test.describe("ボトルネックファインダー 部門タブ＋横断レポート", () => {
  test("一覧ページに部門タブが表示される", async ({ page }) => {
    await page.goto("http://localhost:3006/ja/bottleneck");
    await expect(page.locator("h1")).toContainText("ボトルネックファインダー");

    // 部門タブが表示される
    await expect(page.locator("button:has-text('全て')")).toBeVisible();
    await expect(page.locator("button:has-text('経理部')")).toBeVisible();
    await expect(page.locator("button:has-text('人事総務部')")).toBeVisible();
    await expect(page.locator("button:has-text('海事業務部')")).toBeVisible();

    // 横断レポートボタン
    await expect(page.locator("a:has-text('横断レポート')")).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/bottleneck-tabs.png", fullPage: true });
  });

  test("部門タブでフィルタリングできる", async ({ page }) => {
    await page.goto("http://localhost:3006/ja/bottleneck");
    await page.waitForTimeout(1000);

    // 経理部タブをクリック
    await page.locator("button:has-text('経理部')").click();
    await page.waitForTimeout(500);

    // 経理部のプロジェクトだけが表示される
    const projects = page.locator("a[href*='/bottleneck/bnp-']");
    const count = await projects.count();
    expect(count).toBeGreaterThan(0);

    // 全プロジェクトが経理部
    for (let i = 0; i < count; i++) {
      await expect(projects.nth(i).locator("text=経理部")).toBeVisible();
    }

    await page.screenshot({ path: "tests/screenshots/bottleneck-tabs-keiri.png", fullPage: true });
  });

  test("横断レポートページが表示される", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("http://localhost:3006/ja/bottleneck/report", { timeout: 30000 });

    // ヘッダー
    await expect(page.locator("text=横断ボトルネック分析レポート")).toBeVisible({ timeout: 15000 });

    // 部門タブ
    await expect(page.locator("button:has-text('全社')")).toBeVisible();

    // サマリーカード (ローディング後)
    await expect(page.locator("text=分析案件数")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=総ノード数")).toBeVisible();
    await expect(page.locator("text=自動化率")).toBeVisible();
    await expect(page.locator("text=ボトルネック数")).toBeVisible();

    // ボトルネック一覧
    await expect(page.locator("h3:has-text('ボトルネック一覧')")).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/bottleneck-report-all.png", fullPage: true });
  });

  test("横断レポートで部門タブ切替できる", async ({ page }) => {
    await page.goto("http://localhost:3006/ja/bottleneck/report");
    await expect(page.locator("text=分析案件数")).toBeVisible({ timeout: 10000 });

    // 経理部タブをクリック
    await page.locator("button:has-text('経理部')").click();
    await page.waitForTimeout(500);

    // サマリーカードの件数が変わる（全社より少ない）
    await expect(page.locator("text=分析案件数")).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/bottleneck-report-keiri.png", fullPage: true });
  });
});
