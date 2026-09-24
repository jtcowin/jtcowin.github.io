// Generates social-preview images (1200x630) and PNG icons from the site's own
// typography and tokens, so previews match the site. Run: npm run og
//
// Requires Playwright (dev dependency). If the bundled browser is missing, run
// `npx playwright install chromium` once, or point CHROMIUM_PATH at a Chromium binary.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'og');
fs.mkdirSync(outDir, { recursive: true });

const site = JSON.parse(fs.readFileSync(path.join(root, 'src/data/site.json'), 'utf8'));

// Pull case-study frontmatter without a full MDX parse (title/eyebrow/headline/ogAsset only).
const workDir = path.join(root, 'src/content/work');
const cases = fs
  .readdirSync(workDir)
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => {
    const src = fs.readFileSync(path.join(workDir, f), 'utf8');
    const fm = src.split('---')[1] ?? '';
    const get = (k) => (fm.match(new RegExp(`^${k}:\\s*"(.*)"\\s*$`, 'm')) ?? [])[1] ?? '';
    return { slug: f.replace(/\.mdx$/, ''), eyebrow: get('eyebrow'), headline: get('headline'), title: get('title'), og: get('ogAsset') };
  });

// Fonts are inlined as data URIs: pages created with setContent() cannot load file:// resources.
const font = (pkgPath) => `data:font/woff2;base64,${fs.readFileSync(path.join(root, 'node_modules', pkgPath)).toString('base64')}`;

const css = `
  @font-face { font-family: 'Instrument Serif'; src: url('${font('@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2')}') format('woff2'); }
  @font-face { font-family: 'Inter'; src: url('${font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')}') format('woff2-variations'); font-weight: 100 900; }
  @font-face { font-family: 'JetBrains Mono'; src: url('${font('@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2')}') format('woff2-variations'); font-weight: 100 800; }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    font-family: 'Inter', sans-serif; color: #16181a; background: #fafaf8; position: relative; overflow: hidden;
    padding: 64px 72px; display: grid; grid-template-rows: auto 1fr auto;
  }
  .grid { position: absolute; inset: 0; pointer-events: none;
    background-image: linear-gradient(to right, rgba(22,24,26,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(22,24,26,.05) 1px, transparent 1px);
    background-size: 48px 48px; mask-image: radial-gradient(ellipse at 85% 20%, #000 0%, transparent 70%); -webkit-mask-image: radial-gradient(ellipse at 85% 20%, #000 0%, transparent 70%); }
  .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 20px; letter-spacing: .14em; text-transform: uppercase; color: #0f6e63; font-weight: 500; position: relative; }
  .title { font-family: 'Instrument Serif', serif; line-height: 1.02; letter-spacing: -0.015em; align-self: center; position: relative; text-wrap: balance; max-width: 1000px; }
  .foot { display: flex; align-items: center; justify-content: space-between; position: relative; }
  .name { font-weight: 600; font-size: 24px; letter-spacing: -0.01em; }
  .role { color: #5f646b; font-size: 20px; }
  .mark { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 10px; background: #16181a; color: #fff; font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 15px; margin-right: 16px; }
  .brand { display: flex; align-items: center; }
  .bar { position: absolute; left: 0; top: 0; bottom: 0; width: 14px; background: #0f6e63; }
`;

function html({ eyebrow, title, size, foot }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
    <div class="bar"></div><div class="grid"></div>
    <div class="eyebrow">${eyebrow}</div>
    <div class="title" style="font-size:${size}px">${title}</div>
    <div class="foot"><div class="brand"><div class="mark">JC</div><div><div class="name">${site.name}</div><div class="role">${foot}</div></div></div></div>
  </body></html>`;
}

const cards = [
  { file: 'home.png', eyebrow: 'Web3 marketing · content · community', title: site.tagline, size: 96, foot: site.title },
  ...cases.map((c) => ({
    file: `${c.slug}.png`,
    eyebrow: c.eyebrow,
    title: c.headline.length > 70 ? c.title : c.headline,
    size: c.headline.length > 70 ? 88 : 84,
    foot: 'Selected work · ' + c.title,
  })),
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

for (const card of cards) {
  await page.setContent(html(card), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, card.file), type: 'png' });
  console.log('og  ', card.file);
}

// Browser icons are not generated here: they are derived from the photographic
// favicon master by scripts/icons.py, which keeps the circular crop and the
// transparent exterior and crops tighter at 16 and 32 pixels.

await browser.close();
