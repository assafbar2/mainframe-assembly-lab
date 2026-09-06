import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const screenshotsDir = path.join(rootDir, 'docs', 'screenshots');
  const demoDir = path.join(rootDir, 'docs', 'demo');

  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(demoDir, { recursive: true });

  const chromePath =
    '/Users/assafbarnir/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: demoDir,
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // 1. Capture Hero Overview
  await page.screenshot({ path: path.join(screenshotsDir, '01-hero-overview.png') });
  console.log('Saved 01-hero-overview.png');

  // 2. Demo: Click Load Solution to populate code
  await page.hover('text=Load Solution');
  await page.waitForTimeout(500);
  await page.click('text=Load Solution');
  await page.waitForTimeout(1000);

  // 3. Click Assemble
  await page.hover('text=Assemble');
  await page.waitForTimeout(500);
  await page.click('text=Assemble');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '02-code-assembled.png') });
  console.log('Saved 02-code-assembled.png');

  // 4. Step through instructions 1 and 2
  await page.hover('button:has-text("Step")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Step")');
  await page.waitForTimeout(1200);

  await page.click('button:has-text("Step")');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(screenshotsDir, '03-stepping-and-registers.png') });
  console.log('Saved 03-stepping-and-registers.png');

  // 5. Verify Mission
  await page.hover('text=Verify Mission');
  await page.waitForTimeout(600);
  await page.click('text=Verify Mission');
  await page.waitForTimeout(2000); // Allow confetti animation
  await page.screenshot({ path: path.join(screenshotsDir, '04-mission-solved.png') });
  console.log('Saved 04-mission-solved.png');

  // 6. Switch to Assembly Listing tab
  await page.hover('text=Assembly Listing');
  await page.waitForTimeout(500);
  await page.click('text=Assembly Listing');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, '05-sysprint-listing.png') });
  console.log('Saved 05-sysprint-listing.png');

  // 7. Toggle Amber Phosphor Theme
  await page.click('button[title="IBM Amber Phosphor"]');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(screenshotsDir, '06-amber-theme.png') });
  console.log('Saved 06-amber-theme.png');

  // 8. Open Deep Dive modal
  await page.click('text=Deep Dive');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, '07-architecture-deep-dive.png') });
  console.log('Saved 07-architecture-deep-dive.png');

  // 9. Close Guide & Switch back to Green Phosphor & Go to Sandbox
  await page.click('text=Close Guide');
  await page.waitForTimeout(600);
  await page.click('button[title="Classic IBM 3270 Green Phosphor"]');
  await page.waitForTimeout(600);

  await page.click('text=Sandbox');
  await page.waitForTimeout(1000);

  // Click Banking Packed Decimal preset
  await page.click('text=2. Banking Packed Decimal');
  await page.waitForTimeout(800);
  await page.click('text=Assemble');
  await page.waitForTimeout(800);
  await page.click('button:has-text("Run")');
  await page.waitForTimeout(2500); // Let it run
  await page.screenshot({ path: path.join(screenshotsDir, '08-packed-decimal-banking.png') });
  console.log('Saved 08-packed-decimal-banking.png');

  await page.waitForTimeout(1000);

  // Close context to finish video
  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const videoPath = await video.path();
    const destPath = path.join(demoDir, 'mainframe-assembly-lab-demo.webm');
    fs.copyFileSync(videoPath, destPath);
    console.log(`Video recorded successfully to: ${destPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
