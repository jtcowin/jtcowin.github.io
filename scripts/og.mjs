// Generates the social-preview images (1200x630) from the site's own type and
// palette, so a shared link looks like the site it opens. Run: npm run og
// (every card), or `npm run og -- home` for one card; `--out=<dir>` writes the
// cards somewhere other than public/og (to compare a fresh render with the
// committed files).
//
// Version 1.5 system: Archivo (variable, wdth + wght) for display, Manrope for
// labels. Each case-study card uses the same tonal ground as its panel in the
// homepage work rail, and its title comes from the page's current title
// metadata, so the preview and the browser tab always agree.
//
// Social Share Polish V1.1: the homepage card is a crop-safe portrait. Apps
// show it whole (WhatsApp, X, LinkedIn) or crop it around its center (Slack's
// compact thumbnail takes about the central 630 x 630), so John's face sits on
// the vertical center line and the central square holds no type at all: it
// reads as a portrait thumbnail on its own. On the dark ground, the hero's own
// photograph (its wall toned toward the slate) and, over it, the hero's
// foreground layer at full strength, so John stands out; both fade into the
// ground toward the sides, and the wall toward the top. Outside the square, two
// small quiet notes that nothing depends on: the teal eyebrow at the upper left
// and the disciplines at the lower right, from site.json's homeShare. No name or
// headline in the image: the preview's own text carries those. It is written as
// a JPEG (the photograph would make a PNG several times larger; WhatsApp is
// known to skip preview images much over 300 KB).
//
// Requires Playwright (dev dependency). If the bundled browser is missing, run
// `npx playwright install chromium` once, or point CHROMIUM_PATH at a Chromium binary.

import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outArg = args.find((a) => a.startsWith('--out='));
const outDir = outArg ? path.resolve(outArg.slice('--out='.length)) : path.join(root, 'public', 'og');
const only = args.filter((a) => !a.startsWith('--'));
fs.mkdirSync(outDir, { recursive: true });

const site = JSON.parse(fs.readFileSync(path.join(root, 'src/data/site.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/data/assets.json'), 'utf8')).assets;
const share = site.homeShare;
// The hero's two photographic layers, exactly as the homepage uses them.
const heroFile = (id) => path.join(root, 'src/assets', manifest.find((a) => a.id === id).file);
const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

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

// The homepage card's photograph: scale, and the offsets that put the face (x 510, the eyes at y 236 of the original)
// on the card's center line with the head 44 px from the top.
const SHARE = { scale: 0.94, left: Math.round(600 - 510 * 0.94), top: 22 };
// The central square that compact previews crop to (Slack's thumbnail): it holds no type.
const SQUARE = { left: 285, right: 915 };

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
  aqua: '#4f918a',
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

  /* Home (Social Share Polish V1.1): the photograph at 0.94 of its size, its face
     centered on the card's vertical center line (x 600: the face's center is at
     x 510 of the 1536-wide original), its head 44 px from the top. Masks are drawn
     in card coordinates and shifted onto each layer: both layers fade out toward
     the sides (opaque from 420 to 780, gone by 250 and 950), and the wall also
     fades in from its top edge, so no edge of the photograph shows. */
  body.share {
    padding: 0;
    display: block;
    background: radial-gradient(ellipse 46% 80% at 50% 38%, #2a343c 0%, #1a2228 55%, ${C.ink} 100%);
  }
  .share-photo {
    position: absolute; left: ${SHARE.left}px; top: ${SHARE.top}px;
    width: ${1536 * SHARE.scale}px; height: ${1024 * SHARE.scale}px;
    background-size: 100% 100%;
    mask-size: 1200px 630px; mask-position: ${-SHARE.left}px ${-SHARE.top}px; mask-repeat: no-repeat; mask-composite: intersect;
  }
  .share-photo--wall {
    filter: brightness(.6) saturate(.8);
    mask-image: linear-gradient(90deg, transparent 250px, #000 420px, #000 780px, transparent 950px), linear-gradient(180deg, transparent ${SHARE.top}px, #000 ${SHARE.top + 70}px);
  }
  .share-photo--subject { mask-image: linear-gradient(90deg, transparent 250px, #000 420px, #000 780px, transparent 950px); }
  .share-note { position: absolute; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
  .share-eyebrow { left: 72px; top: 66px; font-size: 15px; letter-spacing: .2em; line-height: 1.55; color: ${C.aquaLight}; }
  .share-disciplines { right: 72px; bottom: 60px; text-align: right; font-size: 14px; letter-spacing: .18em; line-height: 1.75; color: ${C.fog2}; }
`;

// Same geometry as the hero arrow (Hero.astro).
const arrow = `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6 L20 20"/><path d="M20 12 L20 20 L12 20"/></svg>`;

function homeCard() {
  const eyebrow = esc(share.image.eyebrow).replace(' / ', ' /<br>');
  const disciplines = share.image.disciplines.map(esc).join('<br>');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="share">
    <div class="share-photo share-photo--wall" style="background-image:url('${dataUri(heroFile('hero-portrait'))}')"></div>
    <div class="share-photo share-photo--subject" style="background-image:url('${dataUri(heroFile('hero-foreground'))}')"></div>
    <div class="share-note share-eyebrow">${eyebrow}</div>
    <div class="share-note share-disciplines">${disciplines}</div>
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

const cards = [{ name: 'home', file: 'home.jpg', html: homeCard() }, ...cases.map((c, i) => ({ name: c.slug, file: `${c.slug}.png`, html: caseCard(c, i) }))].filter(
  (card) => !only.length || only.includes(card.name),
);
if (!cards.length) throw new Error(`og: no card named ${only.join(', ')}`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

for (const card of cards) {
  await page.setContent(card.html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // Guard against type that would clip, overflow the card or leave the safe area (72 px each side). On the homepage
  // card every note also stays wholly outside the central square that compact previews crop to (with 24 px to
  // spare), so a crop never cuts through a letter.
  const overflow = await page.evaluate((square) => {
    const home = document.body.classList.contains('share');
    return [...document.querySelectorAll('.title, .role, .eyebrow, .share-note')]
      .filter((e) => {
        const range = document.createRange();
        range.selectNodeContents(e);
        const r = range.getBoundingClientRect();
        const inSquare = home && r.right > square.left - 24 && r.left < square.right + 24;
        return e.scrollWidth > e.clientWidth + 1 || r.left < 72 - 1 || r.right > 1200 - 72 + 1 || r.top < 48 || r.bottom > 630 - 48 || inSquare;
      })
      .map((e) => e.className);
  }, SQUARE);
  if (overflow.length) throw new Error(`og: ${card.file} overflows (${overflow.join(', ')})`);
  const png = await page.screenshot({ type: 'png' });
  const out = path.join(outDir, card.file);
  if (card.file.endsWith('.jpg')) await sharp(png).jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(out);
  else fs.writeFileSync(out, png);
  console.log('og  ', card.file, `${Math.round(fs.statSync(out).size / 1024)} KB`);
}

// Browser icons are not generated here: they are derived from the photographic
// favicon master by scripts/icons.py, which keeps the circular crop and the
// transparent exterior and crops tighter at 16 and 32 pixels.

await browser.close();
