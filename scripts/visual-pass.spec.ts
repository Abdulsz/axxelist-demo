import { test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'http://localhost:3002';
const OUT_DIR = path.join(process.cwd(), 'artifacts', 'visual-pass');

const viewports = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

async function collectLayoutMetrics(page: Parameters<typeof test>[1]['page']) {
  return page.evaluate(() => {
    const q = (s: string) => document.querySelector(s);
    const logo =
      q('header h1') ||
      q('h1') ||
      [...document.querySelectorAll('body *')].find((el) => el.textContent?.includes('Axxelist')) ||
      q('[class*="logo"]');
    const chips = q('[class*="chip"]')?.parentElement || q('[class*="filter"]');
    const grid = q('[class*="grid"]');
    const chat = q('[class*="concierge"]') || q('[class*="chat"]');
    const drawer = q('[role="dialog"]') || q('[class*="drawer"]');
    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const fonts = [...document.querySelectorAll('h1,h2,h3,p,li,span')]
      .slice(0, 140)
      .map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
      .filter((n) => Number.isFinite(n));

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      rects: { logo: rect(logo), chips: rect(chips), grid: rect(grid), chat: rect(chat), drawer: rect(drawer) },
      fontSizes: [...new Set(fonts.map((n) => Math.round(n * 10) / 10))].sort((a, b) => a - b),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

for (const [name, viewport] of Object.entries(viewports)) {
  test(`visual pass ${name}`, async ({ page }) => {
    await fs.mkdir(OUT_DIR, { recursive: true });
    await page.setViewportSize(viewport);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await page.screenshot({ path: path.join(OUT_DIR, `${name}-initial.png`), fullPage: true });
    const initial = await collectLayoutMetrics(page);

    const input = page.locator('textarea, input[type="text"]').first();
    if (await input.count()) {
      await input.fill('2BR under $2500 near BART dogs ok');
      await input.press('Enter');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT_DIR, `${name}-after-search.png`), fullPage: true });
    }

    const clickableCard = page.locator('article, [class*="card"], a').nth(3);
    if (await clickableCard.count()) {
      await clickableCard.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT_DIR, `${name}-drawer.png`), fullPage: true });
    }

    const after = await collectLayoutMetrics(page);
    await fs.writeFile(
      path.join(OUT_DIR, `${name}-metrics.json`),
      JSON.stringify({ initial, after }, null, 2),
      'utf8'
    );
  });
}
