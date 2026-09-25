// Generates the social-preview images (1200x630) from the site's own type and
// palette, so a shared link looks like the site it opens. Run: npm run og
//
// Version 1.5 system: Archivo (variable, wdth + wght) for display, Manrope for
// labels. The home card echoes the hero (name, rule, arrow and descriptor on the
// dark image surface); each case-study card uses the same tonal ground as its
// panel in the homepage work rail. Every card title comes from the page's
// current title metadata, so the preview and the browser tab always agree.
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

// "John Cowin - Web3 Marketing, Strategy, & Content" -> name and role line.
const [ownerName, roleLine] = site.browserTitle.split(' - ');

// Pull case-study frontmatter without a full MDX parse.
const workDir = path.join(root, 'src/content/work');
const cases = fs
  .readdirSync(workDir)
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => {
    const src = fs.readFileSync(path.join(workDir, f), 'utf8');
    const fm = src.split('---')[1] ?? '';
    const get = (k) => (fm.match(new RegExp(`^${k}:\\s*"(.*)"\\s*$`, 'm')) ?? [])[1] ?? '';
    const order = Number((fm.match(/^order:\s*(\d+)\s*$/m) ?? [])[1] ?? 99);
    return { slug: f.replace(/\.mdx$/, ''), order, eyebrow: get('eyebrow'), title: get('title') };
  })
  .sort((a, b) => a.order - b.order);

// Fonts are inlined as data URIs: pages created with setContent() cannot load file:// resources.
const font = (pkgPath) => `data:font/woff2;base64,${fs.readFileSync(path.join(root, 'node_modules', pkgPath)).toString('base64')}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Palette tokens, copied from src/styles/global.css (raw tokens and surfaces).
const C = {
  ink: '#0d0f10',
  slate: '#25313a',
  fog: '#edf0ef',
  fog2: '#c3cacb',
  steelDeep: '#4e5862',
  teal: '#1f4546',
  aquaLight: '#9fc9c3',
};

// Case-study grounds match the work-rail panels (WorkPanels.astro, 3n+1..3).
const CASE_GROUNDS = [
  { bg: '#f4f0e9', line: '#bdb5a7' },
  { bg: '#e9ecea', line: '#b8c1c1' },
  { bg: '#dce2e2', line: '#a9b3b5' },
];

const css = `
  @font-face { font-family: 'Archivo'; src: url('${font('@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2')}') format('woff2-variations'); font-weight: 100 900; font-stretch: 62% 125%; }
  @font-face { font-family: 'Manrope'; src: url('${font('@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2')}') format('woff2-variations'); font-weight: 200 800; }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    position: relative; overflow: hidden;
    padding: 60px 72px 56px;
    display: grid; grid-template-rows: auto 1fr auto;
    font-family: 'Manrope', sans-serif;
    background: var(--bg); color: var(--ink);
    -webkit-font-smoothing: antialiased;
  }
  .top { display: flex; justify-content: space-between; align-items: baseline; }
  .eyebrow { font-size: 19px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
  .num { font-family: 'Archivo', sans-serif; font-weight: 700; font-stretch: 86%; font-size: 26px; color: var(--accent); font-variant-numeric: tabular-nums; }
  .title {
    align-self: center;
    font-family: 'Archivo', sans-serif; font-weight: 700; font-stretch: 86%;
    font-size: 100px; line-height: .98; letter-spacing: -0.012em; color: var(--heading);
    text-wrap: balance; max-width: 1000px;
  }
  .foot { display: grid; gap: 22px; }
  .rule { height: 1px; background: var(--line); }
  .meta { display: flex; justify-content: space-between; align-items: center; }
  .name { font-size: 24px; font-weight: 700; letter-spacing: -0.005em; color: var(--ink); }
  /* The descriptor is set like the hero's: uppercase, tracked, beside the arrow. */
  .role { display: flex; align-items: center; gap: 12px; font-size: 17px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3); }
  .role svg { width: 30px; height: 30px; flex: none; }

  /* Home: the hero in type. Name in the hero's own Archivo 500, the rule, and
     the arrow with the descriptor at the lower right, on the dark image ground. */
  body.home {
    --bg: ${C.ink}; --ink: ${C.fog}; --ink-3: ${C.fog}; --heading: ${C.fog}; --accent: ${C.aquaLight}; --line: rgba(237, 240, 239, .55);
    background:
      radial-gradient(ellipse 75% 95% at 80% 16%, rgba(126, 137, 149, .22) 0%, rgba(37, 49, 58, .5) 40%, transparent 74%),
      linear-gradient(180deg, ${C.slate} 0%, ${C.ink} 100%);
  }
  body.home .hero-name {
    align-self: center;
    font-family: 'Archivo', sans-serif; font-weight: 500; font-stretch: 100%;
    font-size: 188px; line-height: .9; letter-spacing: -0.01em; color: var(--heading); white-space: nowrap;
  }
  body.home .role { font-size: 21px; color: var(--ink); }
  body.home .role svg { width: 40px; height: 40px; }
`;

// Same geometry as the hero arrow (Hero.astro).
const arrow = `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6 L20 20"/><path d="M20 12 L20 20 L12 20"/></svg>`;

function homeCard() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="home">
    <div></div>
    <div class="hero-name">${esc(ownerName)}</div>
    <div class="foot"><div class="rule"></div>
      <div class="meta"><div></div><div class="role">${arrow}<span>${esc(roleLine)}</span></div></div>
    </div>
  </body></html>`;
}

function caseCard(c, i) {
  const g = CASE_GROUNDS[i % CASE_GROUNDS.length];
  const vars = `--bg:${g.bg};--ink:${C.ink};--ink-3:${C.steelDeep};--heading:${C.slate};--accent:${C.teal};--line:${g.line};`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="${vars}">
    <div class="top"><div class="eyebrow">${esc(c.eyebrow)}</div><div class="num">${String(i + 1).padStart(2, '0')}</div></div>
    <div class="title">${esc(c.title)}</div>
    <div class="foot"><div class="rule"></div>
      <div class="meta"><div class="name">${esc(ownerName)}</div><div class="role">${arrow}<span>${esc(roleLine)}</span></div></div>
    </div>
  </body></html>`;
}

const cards = [{ file: 'home.png', html: homeCard() }, ...cases.map((c, i) => ({ file: `${c.slug}.png`, html: caseCard(c, i) }))];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

for (const card of cards) {
  await page.setContent(card.html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // Guard against a title that would clip or overflow the card.
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll('.title, .hero-name, .role, .eyebrow')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > 1200 - 72 + 1).map((e) => e.className),
  );
  if (overflow.length) throw new Error(`og: ${card.file} overflows (${overflow.join(', ')})`);
  await page.screenshot({ path: path.join(outDir, card.file), type: 'png' });
  console.log('og  ', card.file);
}

// Browser icons are not generated here: they are derived from the photographic
// favicon master by scripts/icons.py, which keeps the circular crop and the
// transparent exterior and crops tighter at 16 and 32 pixels.

await browser.close();
