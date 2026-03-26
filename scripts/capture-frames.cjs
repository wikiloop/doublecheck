// Playwright screenshot capture for demo GIF
// Usage: node scripts/capture-frames.cjs [url] [framesDir]
const { chromium } = require("playwright");
const url = process.argv[2] || "https://doublecheck.wikiloop.org/review";
const framesDir = process.argv[3] || ".tmp-gif-frames";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${framesDir}/frame-001.png` });
  console.log("Frame 1: Review page loaded");

  // Wait for revision content to appear
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${framesDir}/frame-002.png` });
  console.log("Frame 2: Revision displayed");

  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${framesDir}/frame-003.png` });
  console.log("Frame 3: Action buttons visible");

  try {
    const btn = page.locator("button").filter({ hasText: "Should Revert" }).first();
    if (await btn.isVisible({ timeout: 2000 })) {
      await btn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${framesDir}/frame-004.png` });
      console.log("Frame 4: Should Revert clicked");
    }
  } catch {
    console.log("Frame 4: Skipped");
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${framesDir}/frame-005.png` });
  console.log("Frame 5: Overview");

  await browser.close();
  console.log("Done");
})();
