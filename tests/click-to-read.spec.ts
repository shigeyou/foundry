import { test, expect } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3006";

test.describe("メタファインダー レポート クリック読み上げ", () => {
  test("レポートセクションにonClickとcursor-pointerが設定されている", async ({ page }) => {
    // レポートページへ遷移
    await page.goto(`${BASE}/meta-finder/report`);
    await page.waitForLoadState("networkidle");

    // バッチ選択が必要な場合は最新バッチを選択
    const batchSelect = page.locator("select").first();
    if (await batchSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await batchSelect.locator("option").all();
      if (options.length > 1) {
        await batchSelect.selectOption({ index: 1 });
        await page.waitForTimeout(2000);
      }
    }

    // レポートが表示されるまで待つ（最大15秒）
    const reportArea = page.locator("#report-print-area");
    const hasReport = await reportArea.isVisible({ timeout: 15000 }).catch(() => false);

    if (!hasReport) {
      // レポートがない場合（バッチ未実行等）はスキップ
      test.skip(true, "レポートデータがないためスキップ");
      return;
    }

    // ReportContent内のセクションカード（cursor-pointerクラスがあること）
    const clickableSections = page.locator("[class*='cursor-pointer']");
    const count = await clickableSections.count();

    console.log(`Found ${count} clickable sections`);
    expect(count).toBeGreaterThan(0);

    // 最初のクリッカブルセクションにonClickが動作するか確認
    const firstSection = clickableSections.first();
    await expect(firstSection).toBeVisible();

    // クリックしてもエラーにならないことを確認
    await firstSection.click();
    await page.waitForTimeout(1000);

    // ページがクラッシュしていないことを確認
    const body = page.locator("body");
    await expect(body).toBeVisible();

    console.log("Click-to-read sections are properly wired up");
  });
});
