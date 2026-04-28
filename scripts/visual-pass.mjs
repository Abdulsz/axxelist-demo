import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'http://localhost:3002';
const OUT_DIR = path.join(process.cwd(), 'artifacts', 'visual-pass');

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const cardCandidates = [
  '[data-testid="listing-card"]',
  '[class*="listing-card"]',
  'article',
  'a[href*="listing"]',
  '[role="button"]',
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function firstVisible(page, selectors) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try {
        if (await el.isVisible()) return el;
      } catch {
        // ignore detached elements
      }
    }
  }
  return null;
}

async function collectLayoutMetrics(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const byText = (text) =>
      [...document.querySelectorAll('body *')].find((el) =>
        el.textContent?.trim().includes(text)
      );

    const logo =
      q('header h1') ||
      q('h1') ||
      byText('Axxelist') ||
      q('[class*="logo"]');
    const chips =
      q('[data-testid="filter-chips"]') ||
      q('[class*="filter"][class*="chip"]') ||
      q('[class*="chips"]');
    const grid =
      q('[data-testid="listings-grid"]') ||
      q('[class*="listings-grid"]') ||
      q('[class*="grid"][class*="listing"]') ||
      q('main .grid');
    const chat =
      q('[data-testid="concierge-panel"]') ||
      q('[class*="concierge"]') ||
      q('[class*="chat"]');
    const drawer =
      q('[data-testid="listing-detail-drawer"]') ||
      q('[role="dialog"]') ||
      q('[class*="drawer"]');

    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };

    const bodyStyle = getComputedStyle(document.body);
    const rootFontSize = getComputedStyle(document.documentElement).fontSize;

    const maybeText = [...document.querySelectorAll('p,li,span,h1,h2,h3')].slice(0, 120);
    const fontSizes = maybeText
      .map((n) => Number.parseFloat(getComputedStyle(n).fontSize))
      .filter((v) => Number.isFinite(v));
    const uniqueFontSizes = [...new Set(fontSizes.map((v) => Math.round(v * 10) / 10))].sort(
      (a, b) => a - b
    );

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      rects: {
        logo: rect(logo),
        chips: rect(chips),
        grid: rect(grid),
        chat: rect(chat),
        drawer: rect(drawer),
      },
      body: {
        bg: bodyStyle.backgroundColor,
        color: bodyStyle.color,
        lineHeight: bodyStyle.lineHeight,
        rootFontSize,
      },
      typography: {
        uniqueFontSizes,
      },
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

async function run() {
  await ensureDir(OUT_DIR);
  const browser = await chromium.launch({ headless: true });
  const summary = [];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 45000 });

    await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-initial.png`), fullPage: true });
    const initial = await collectLayoutMetrics(page);

    const input = await firstVisible(page, [
      'textarea[placeholder*="search" i]',
      'textarea[placeholder*="message" i]',
      'input[placeholder*="search" i]',
      'input[placeholder*="message" i]',
      'textarea',
      'input[type="text"]',
    ]);

    let motionAttempted = false;
    if (input) {
      motionAttempted = true;
      await input.fill('2BR under $2500 near BART dogs ok');
      await input.press('Enter');
      await page.waitForTimeout(1400);
      await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-after-search.png`), fullPage: true });
    }

    const card = await firstVisible(page, cardCandidates);
    let drawerOpened = false;
    if (card) {
      try {
        await card.click({ timeout: 3000 });
        await page.waitForTimeout(900);
        drawerOpened = await page.locator('[role="dialog"], [class*="drawer"]').first().isVisible();
        await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-drawer.png`), fullPage: true });
      } catch {
        // ignore click failures
      }
    }

    const after = await collectLayoutMetrics(page);
    summary.push({ viewport: vp.name, initial, after, motionAttempted, drawerOpened });
    await context.close();
  }

  await browser.close();
  await fs.writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Wrote visual pass artifacts to ${OUT_DIR}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
