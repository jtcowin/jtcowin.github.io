// Local verification: screenshots at common widths (+ reduced motion).
import { chromium } from 'playwright';
import fs from 'node:fs';
import { resolveSite } from '../site.config.mjs';

const basePath = resolveSite().base.replace(/\/$/, '');
const base = process.env.PREVIEW_URL ?? `http://localhost:4321${basePath}/`;
const out = '.verify';
fs.mkdirSync(out, { recursive: true });

const pages = [
  ['home', ''],
  ['creator', 'work/creator-campaigns/'],
  ['technical', 'work/technical-marketing/'],
  ['events', 'work/events-video/'],
  ['404', 'does-not-exist/'],
];
const widths = [375, 768, 1280];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

// NOTE: Chromium's stitched `fullPage` capture can silently omit individual composited
// layers — the hero's metric marker is one of them, even though it renders correctly in
// every real viewport. So each page is captured twice: a full-page shot for overall flow,
// and a viewport-sized "fold" shot that is trustworthy for anything above the fold.
// `animations: 'disabled'` fast-forwards entry animations to their end state so shots are
// deterministic instead of depending on the wait below.
for (const [name, path] of pages) {
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true, animations: 'disabled' });
    await page.screenshot({ path: `${out}/${name}-${w}-fold.png`, animations: 'disabled' });
    await ctx.close();
  }
}
// reduced motion + hero viewport only
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(base, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${out}/home-1280-reduced-motion.png`, animations: 'disabled' });
await ctx.close();
await browser.close();
console.log('done');
