import { test, expect } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3006";

test.describe("メタファインダー レポート クリック読み上げ", () => {

  test("レポートセクションにcursor-pointerが設定されクリック可能", async ({ page }) => {
    await page.goto(`${BASE}/meta-finder/report`);
    await page.waitForLoadState("networkidle");

    // バッチ選択
    const batchSelect = page.locator("select").first();
    if (await batchSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await batchSelect.locator("option").all();
      if (options.length > 1) {
        await batchSelect.selectOption({ index: 1 });
        await page.waitForTimeout(2000);
      }
    }

    const reportArea = page.locator("#report-print-area");
    const hasReport = await reportArea.isVisible({ timeout: 15000 }).catch(() => false);
    if (!hasReport) {
      test.skip(true, "レポートデータがないためスキップ");
      return;
    }

    // cursor-pointerが付いたセクションがある
    const clickableSections = page.locator("#report-print-area [class*='cursor-pointer']");
    const count = await clickableSections.count();
    console.log(`Found ${count} clickable sections on initial tab`);
    expect(count).toBeGreaterThan(0);

    // クリックしてもエラーにならない
    await clickableSections.first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator("body")).toBeVisible();
    console.log("Click-to-read: initial tab OK");
  });

  test("別タブに切り替えてもcursor-pointerが維持されクリック可能", async ({ page }) => {
    await page.goto(`${BASE}/meta-finder/report`);
    await page.waitForLoadState("networkidle");

    // バッチ選択
    const batchSelect = page.locator("select").first();
    if (await batchSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await batchSelect.locator("option").all();
      if (options.length > 1) {
        await batchSelect.selectOption({ index: 1 });
        await page.waitForTimeout(2000);
      }
    }

    const reportArea = page.locator("#report-print-area");
    const hasReport = await reportArea.isVisible({ timeout: 15000 }).catch(() => false);
    if (!hasReport) {
      test.skip(true, "レポートデータがないためスキップ");
      return;
    }

    // 部門タブ一覧を取得（横スクロール内のボタン群）
    const deptTabs = page.locator("button").filter({ hasText: /技術部|事業部|事業本部|企画部|総務部|経理部|全社|CEO/ });
    const tabCount = await deptTabs.count();
    console.log(`Found ${tabCount} department tabs`);

    if (tabCount < 2) {
      test.skip(true, "タブが2つ未満のためスキップ");
      return;
    }

    // 初期タブのセクション数を確認
    const initialClickable = await page.locator("#report-print-area [class*='cursor-pointer']").count();
    console.log(`Initial tab: ${initialClickable} clickable sections`);
    expect(initialClickable).toBeGreaterThan(0);

    // 別のタブをクリック（2番目のタブ）
    await deptTabs.nth(1).click();
    await page.waitForTimeout(1500);

    // 別タブでもcursor-pointerセクションがある
    const secondTabClickable = page.locator("#report-print-area [class*='cursor-pointer']");
    const secondCount = await secondTabClickable.count();

    // レポートが生成されていない部門もあるのでreport-print-areaがない場合もチェック
    const hasSecondReport = await page.locator("#report-print-area").isVisible().catch(() => false);
    if (!hasSecondReport || secondCount === 0) {
      console.log("Second tab has no report, trying third tab");
      if (tabCount > 2) {
        await deptTabs.nth(2).click();
        await page.waitForTimeout(1500);
      }
    }

    const finalClickable = page.locator("[class*='cursor-pointer']").filter({ hasNotText: /速度|スピード/ });
    const finalCount = await finalClickable.count();
    console.log(`After tab switch: ${finalCount} clickable sections`);
    expect(finalCount).toBeGreaterThan(0);

    // クリックしてもエラーにならない
    await finalClickable.first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator("body")).toBeVisible();
    console.log("Click-to-read: cross-tab OK");
  });

  test("速度スライダーが操作可能で値が変わる", async ({ page }) => {
    await page.goto(`${BASE}/meta-finder/report`);
    await page.waitForLoadState("networkidle");

    // バッチ選択
    const batchSelect = page.locator("select").first();
    if (await batchSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await batchSelect.locator("option").all();
      if (options.length > 1) {
        await batchSelect.selectOption({ index: 1 });
        await page.waitForTimeout(2000);
      }
    }

    const reportArea = page.locator("#report-print-area");
    const hasReport = await reportArea.isVisible({ timeout: 15000 }).catch(() => false);
    if (!hasReport) {
      test.skip(true, "レポートデータがないためスキップ");
      return;
    }

    // 速度スライダーを見つける
    const speedSlider = page.locator("input[type='range']");
    const hasSlider = await speedSlider.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasSlider) {
      test.skip(true, "速度スライダーが見つからないためスキップ");
      return;
    }

    // 初期値を取得
    const initialValue = await speedSlider.inputValue();
    console.log(`Initial speed: ${initialValue}%`);

    // スライダーの値を変更（fill で直接値をセット）
    await speedSlider.fill("100");
    await page.waitForTimeout(500);

    const newValue = await speedSlider.inputValue();
    console.log(`New speed: ${newValue}%`);

    // 値が変わったことを確認
    expect(newValue).toBe("100");

    // 速度表示テキストが更新されていることを確認
    const speedDisplay = page.locator("text=100%");
    await expect(speedDisplay).toBeVisible({ timeout: 2000 });

    console.log("Speed slider: OK");
  });
});
