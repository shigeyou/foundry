import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

// Navigate to a completed project
await page.goto("http://localhost:3006/ja/bottleneck", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Click first completed project
const projectLink = page.locator("a").filter({ hasText: "フロー" }).first();
await projectLink.click();
await page.waitForTimeout(2000);

// Click flow tab
const flowTab = page.locator("button").filter({ hasText: "フロー" });
await flowTab.click();
await page.waitForTimeout(4000);

// Check for render errors
const bodyText = await page.textContent("body");
if (bodyText.includes("描画エラー") || bodyText.includes("Parse error")) {
  console.log("ERROR: Mermaid render error detected!");
} else {
  console.log("OK: No render errors");
}

// Check for side-by-side layout
const beforeLabel = await page.locator("text=Before（現状）").count();
const afterLabel = await page.locator("text=After（改善後）").count();
console.log(`Before label: ${beforeLabel}, After label: ${afterLabel}`);

if (beforeLabel > 0 && afterLabel > 0) {
  console.log("OK: Side-by-side layout detected");
} else {
  console.log("WARN: Side-by-side layout not found (may not have After data)");
}

// Check no scrollbars (overflow-hidden)
const viewport = page.locator(".overflow-hidden").first();
const hasViewport = await viewport.count();
console.log(`overflow-hidden viewports: ${hasViewport > 0 ? "found" : "not found"}`);

await page.screenshot({ path: "tests/screenshots/flow-comparison.png", fullPage: true });
console.log("Screenshot saved: tests/screenshots/flow-comparison.png");

await browser.close();
