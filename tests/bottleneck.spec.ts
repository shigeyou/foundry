import { test, expect } from "@playwright/test";

test.describe("ボトルネックファインダー", () => {
  test("ダッシュボードにボトルネックカードが表示される", async ({ page }) => {
    await page.goto("http://localhost:3006/");
    await expect(page.locator("text=ボトルネックファインダー")).toBeVisible();
    await expect(page.locator("text=業務フローを分析し、自動化可能なボトルネックを発見")).toBeVisible();
  });

  test("ボトルネック一覧ページが表示される", async ({ page }) => {
    await page.goto("http://localhost:3006/ja/bottleneck");
    await expect(page.locator("h1")).toContainText("ボトルネックファインダー");
    await expect(page.locator("text=+ 新規プロジェクト")).toBeVisible();
  });

  test("プロジェクト作成フローが動作する", async ({ page }) => {
    await page.goto("http://localhost:3006/ja/bottleneck");

    // 新規プロジェクトボタンをクリック
    await page.locator("button:has-text('+ 新規プロジェクト')").click();

    // フォーム入力
    const uniqueName = `E2E作成テスト${Date.now()}`;
    await page.fill('input[placeholder="例: 経費精算フロー分析"]', uniqueName);
    await page.fill('input[placeholder="例: 経理部"]', "テスト部門");

    // 作成ボタンクリック
    await page.locator("button:has-text('作成')").last().click();

    // プロジェクトが一覧に表示される
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible({ timeout: 5000 });
  });

  test("プロジェクトワークスペースが表示される", async ({ page }) => {
    // まずプロジェクトを作成
    await page.goto("http://localhost:3006/ja/bottleneck");
    await page.click("text=+ 新規プロジェクト");
    const uniqueName = `WSテスト${Date.now()}`;
    await page.fill('input[placeholder="例: 経費精算フロー分析"]', uniqueName);
    await page.click("button:has-text('作成')");
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible({ timeout: 5000 });

    // プロジェクトリンクをクリック（Linkコンポーネント経由）
    await page.locator(`a:has-text("${uniqueName}")`).first().click();

    // ページ遷移を待つ
    await page.waitForURL(/\/bottleneck\/bnp-/, { timeout: 10000 });

    // ワークスペースが表示される
    await expect(page.locator("button:has-text('アップロード')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button:has-text('フロー')")).toBeVisible();
    await expect(page.locator("button:has-text('レポート')")).toBeVisible();
    await expect(page.locator("text=AI分析を実行")).toBeVisible();
  });

  test("ダッシュボードからボトルネックページに遷移できる", async ({ page }) => {
    await page.goto("http://localhost:3006/");
    await page.click("text=ボトルネックファインダー");
    await expect(page).toHaveURL(/\/bottleneck/);
    await expect(page.locator("h1")).toContainText("ボトルネックファインダー");
  });
});
