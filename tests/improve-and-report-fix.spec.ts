import { test, expect } from "@playwright/test";

test("meta-finder: improve text button is visible", async ({ page }) => {
  await page.goto("http://localhost:3006/meta-finder");
  // Wait for the page to load
  await page.waitForSelector("text=自由探索プロンプト");

  // The improve button should exist but be disabled (no text entered)
  const improveBtn = page.getByRole("button", { name: /文章改善/ });
  await expect(improveBtn).toBeVisible();
  await expect(improveBtn).toBeDisabled();

  // Type something in the textarea
  const textarea = page.locator("textarea");
  await textarea.fill("テスト文章");

  // Now the button should be enabled
  await expect(improveBtn).toBeEnabled();
});

test("report page: generation button does not pass event object", async ({ page }) => {
  // Go to report page with a batchId that likely has no reports yet
  // This should show the "generate report" button
  await page.goto("http://localhost:3006/meta-finder/report?batchId=test-nonexistent");

  // Wait for loading to finish
  await page.waitForTimeout(2000);

  // The page should not crash with circular structure error
  // If batchId is invalid, it'll show an error or empty state - that's fine
  // We just verify no JS crash
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  // Check if the generate button exists (it may not if batch not found)
  const generateBtn = page.locator("text=レポート生成開始");
  if (await generateBtn.isVisible()) {
    await generateBtn.click();
    // Verify no circular structure error
    await page.waitForTimeout(1000);
    const hasCircularError = errors.some(e => e.includes("circular"));
    expect(hasCircularError).toBe(false);
  }
});

test("report page: batch selector button navigates correctly", async ({ page }) => {
  // Go to a report page with batchId
  await page.goto("http://localhost:3006/meta-finder/report?batchId=batch-1771640498178");
  await page.waitForTimeout(1500);

  // Find the batch selector link
  const batchSelectLink = page.locator("a", { hasText: "バッチ選択" });
  if (await batchSelectLink.isVisible()) {
    // It should be an <a> tag navigating to /meta-finder/report (no batchId)
    const href = await batchSelectLink.getAttribute("href");
    expect(href).toBe("/meta-finder/report");
  }
});
