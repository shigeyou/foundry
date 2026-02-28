import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

// Go to bottleneck list
await page.goto("http://localhost:3006/ja/bottleneck", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Verify ThemeToggle button exists
const toggleBtn = page.locator("button[title*='モード']");
const toggleCount = await toggleBtn.count();
console.log(`Theme toggle buttons: ${toggleCount}`);

// Take light mode screenshot
await page.screenshot({ path: "tests/screenshots/bottleneck-light.png", fullPage: true });
console.log("Light mode screenshot saved");

// Click dark mode toggle
if (toggleCount > 0) {
  await toggleBtn.first().click();
  await page.waitForTimeout(1000);

  // Verify dark class was added
  const htmlClass = await page.locator("html").getAttribute("class");
  console.log(`HTML class after toggle: ${htmlClass}`);

  await page.screenshot({ path: "tests/screenshots/bottleneck-dark.png", fullPage: true });
  console.log("Dark mode screenshot saved");

  // Navigate to a project workspace
  const projectLink = page.locator("a").filter({ hasText: "フロー" }).first();
  if (await projectLink.count() > 0) {
    await projectLink.click();
    await page.waitForTimeout(2000);

    // Click flow tab
    const flowTab = page.locator("button").filter({ hasText: "フロー" });
    await flowTab.click();
    await page.waitForTimeout(4000);

    // Check for errors
    const bodyText = await page.textContent("body");
    if (bodyText.includes("描画エラー")) {
      console.log("ERROR: Mermaid render error in dark mode!");
    } else {
      console.log("OK: No render errors in dark mode");
    }

    // Verify dark mode toggle exists on workspace
    const wsToggle = page.locator("button[title*='モード']");
    console.log(`Workspace theme toggles: ${await wsToggle.count()}`);

    await page.screenshot({ path: "tests/screenshots/flow-dark.png", fullPage: true });
    console.log("Dark mode flow screenshot saved");
  }
}

await browser.close();
console.log("Done!");
