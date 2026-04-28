const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = "http://localhost:3000/landlords";
const OUT_DIR = path.join(process.cwd(), "qa-artifacts", "visual-landlords");

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const sampleImagePath = path.join(process.cwd(), "qa-artifacts", "fixtures", "interior.jpg");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function saveShot(page, name) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function runForViewport(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  const prefix = viewport.name;
  await saveShot(page, `${prefix}-default-empty`);

  const firstInput = page.getByPlaceholder("Bedrooms");
  await firstInput.focus();
  await saveShot(page, `${prefix}-focus-state`);

  await page.locator("label[for='photos']").nth(1).hover();
  await saveShot(page, `${prefix}-hover-state`);

  const photoInput = page.locator("#photos");
  await photoInput.setInputFiles([sampleImagePath, sampleImagePath, sampleImagePath]);
  await page.waitForTimeout(250);
  await saveShot(page, `${prefix}-upload-preview-grid`);

  await page.getByPlaceholder("Neighborhood (e.g. Rockridge)").fill("Rockridge");
  await page.getByPlaceholder("Monthly rent (USD)").fill("2800");
  await page
    .locator("#standout-notes")
    .fill("Top-floor corner unit with bright windows and recently upgraded bath.");

  await page.getByRole("button", { name: "Generate listing copy" }).click();
  await page.waitForTimeout(1100);
  await saveShot(page, `${prefix}-loading-state`);

  await page.waitForSelector("text=AI Draft Output", { timeout: 30000 });
  await page.waitForTimeout(1200);
  await saveShot(page, `${prefix}-generated-output-card`);

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByPlaceholder("Neighborhood (e.g. Rockridge)").fill("Temescal");
  await page.getByPlaceholder("Monthly rent (USD)").fill("3000");
  await page.locator("#standout-notes").fill("Near transit and shopping.");
  const invalidButton = page.getByRole("button", { name: "Generate listing copy" });
  if (await invalidButton.isEnabled()) {
    await invalidButton.click();
    await page.waitForTimeout(700);
  }
  await saveShot(page, `${prefix}-invalid-submit-error`);

  await context.close();
}

async function main() {
  ensureDir(OUT_DIR);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const vp of viewports) {
      await runForViewport(browser, vp);
    }
  } finally {
    await browser.close();
  }
  console.log(`Saved screenshots to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
