import { test, expect } from "@playwright/test";

test.describe("SharePointタブ", () => {
  test("設定ページにSharePointタブが表示される", async ({ page }) => {
    await page.goto("http://localhost:3006/ja/settings?tab=sharepoint");
    await page.waitForLoadState("networkidle");

    // SharePointタブボタンが存在する
    const tabButton = page.getByRole("button", { name: "☁️ SharePoint" });
    await expect(tabButton).toBeVisible();

    // SharePoint連携の見出しが表示される
    await expect(page.locator("text=SharePoint連携")).toBeVisible();

    // 接続ボタンが表示される
    await expect(page.locator("text=SharePointに接続")).toBeVisible();
  });

  test("接続ボタンをクリックすると階層ビューまたはセットアップバナーが表示される", async ({ page }) => {
    await page.goto("http://localhost:3006/ja/settings?tab=sharepoint");
    await page.waitForLoadState("networkidle");

    // 接続ボタンをクリック
    await page.click("text=SharePointに接続");

    // トークンあり→階層ビュー / トークンなし→セットアップバナー
    const treeHeading = page.locator("text=階層ビュー");
    const setupBanner = page.locator("text=セットアップが必要です");
    await expect(treeHeading.or(setupBanner)).toBeVisible({ timeout: 30000 });
  });

  test("設定ページの全タブが表示される", async ({ page }) => {
    await page.goto("http://localhost:3006/ja/settings");
    await page.waitForLoadState("networkidle");

    // 全タブが表示される
    for (const tabName of ["はじめに", "対象企業", "RAG情報", "SWOT", "SharePoint"]) {
      await expect(page.locator("button", { hasText: tabName }).first()).toBeVisible();
    }
  });
});
