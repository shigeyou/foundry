import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

// Go to bottleneck list page
await page.goto("http://localhost:3006/ja/bottleneck", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: "tests/screenshots/bottleneck-all-projects.png", fullPage: true });

// Count projects
const cards = await page.locator('[class*="border"]').filter({ hasText: "分析完了" }).count();
console.log(`Found ${cards} completed projects`);

// Get all project names
const allText = await page.textContent("body");
const names = allText.match(/[^\n]+フロー/g);
if (names) {
  console.log(`\nProject names found (${names.length}):`);
  for (const n of [...new Set(names)]) {
    console.log(`  - ${n}`);
  }
}

// Click first project and check flow tab renders
const firstProject = page.locator("a").filter({ hasText: "フロー" }).first();
if (await firstProject.count() > 0) {
  await firstProject.click();
  await page.waitForTimeout(3000);

  // Check for mermaid render errors
  const errorText = await page.textContent("body");
  if (errorText.includes("描画エラー") || errorText.includes("Parse error") || errorText.includes("Lexical error")) {
    console.log("\n⚠️ MERMAID RENDER ERROR DETECTED!");
  } else {
    console.log("\n✓ No mermaid render errors on first project");
  }
  await page.screenshot({ path: "tests/screenshots/bottleneck-first-flow.png" });
}

await browser.close();
console.log("\nDone!");
