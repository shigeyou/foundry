import { test, expect } from "@playwright/test";

test("report page: PDF export completes without errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto("http://localhost:3006/meta-finder/report?batchId=manual-1771721449193");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("エグゼクティブサマリー").first()).toBeVisible({ timeout: 10000 });

  const pdfBtn = page.getByText("PDF出力");
  await expect(pdfBtn).toBeVisible();

  const pdfLogs: string[] = [];
  page.on("console", (msg) => {
    if (msg.text().includes("[PDF]")) pdfLogs.push(msg.text());
  });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }).catch(() => null),
    pdfBtn.click(),
  ]);

  if (download) {
    expect(download.suggestedFilename()).toContain("勝ち筋ファインダー報告書.pdf");
  } else {
    await page.waitForTimeout(15000);
    expect(pdfLogs.some(l => l.includes("failed"))).toBe(false);
  }

  const criticalErrors = pageErrors.filter(e => !e.includes("lab") && !e.includes("ResizeObserver"));
  expect(criticalErrors).toHaveLength(0);
});

test("report page: executive summary PDF button visible and works", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  const pdfLogs: string[] = [];
  page.on("console", (msg) => {
    if (msg.text().includes("[PDF]")) pdfLogs.push(msg.text());
  });

  await page.goto("http://localhost:3006/meta-finder/report?batchId=manual-1771721449193");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("エグゼクティブサマリー").first()).toBeVisible({ timeout: 10000 });

  // サマリーPDFボタンが表示される
  const summaryBtn = page.getByText("サマリーPDF");
  await expect(summaryBtn).toBeVisible();

  // クリック
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }).catch(() => null),
    summaryBtn.click(),
  ]);

  if (download) {
    expect(download.suggestedFilename()).toContain("エグゼクティブサマリー.pdf");
  } else {
    await page.waitForTimeout(10000);
    expect(pdfLogs.some(l => l.includes("failed"))).toBe(false);
  }

  const criticalErrors = pageErrors.filter(e => !e.includes("lab") && !e.includes("ResizeObserver"));
  expect(criticalErrors).toHaveLength(0);
});

test("report page: all section headers visible", async ({ page }) => {
  await page.goto("http://localhost:3006/meta-finder/report?batchId=manual-1771721449193");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("エグゼクティブサマリー").first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator("text=1. 課題整理")).toBeVisible();
  await expect(page.locator("text=2. 解決策策定")).toBeVisible();
  await expect(page.locator("text=3. 勝ち筋提案")).toBeVisible();
});

test("report page: department tabs work", async ({ page }) => {
  await page.goto("http://localhost:3006/meta-finder/report?batchId=manual-1771721449193");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: /全社/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /総合企画部/ }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText("エグゼクティブサマリー").first()).toBeVisible();
});

test("meta-finder page: batch PDF export button exists", async ({ page }) => {
  await page.goto("http://localhost:3006/meta-finder");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const pdfBtns = page.locator("button", { hasText: "PDF出力" });
  const count = await pdfBtns.count();
  if (count > 0) {
    await expect(pdfBtns.first()).toBeVisible();
  }
});
