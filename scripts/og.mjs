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
// Social Share Polish V1: the homepage card is portrait-led and editorial
// rather than another headline. On the dark slate-to-black ground, the hero's
// own photograph (its wall toned down toward the slate) and, over it, the hero's
// foreground layer at full strength, so John stands out; both fade into the
// ground behind the type. On the left, a small teal eyebrow, the name in large
// capitals on two lines and one small line of disciplines, all from site.json's
// homeShare. It is written as a JPEG (the photograph would make a PNG several
// times larger; WhatsApp is known to skip preview images much over 300 KB).
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

  /* Home (Social Share Polish V1): portrait-led. The photograph sits on the right
     at the hero's own framing, scaled so the face reads at a WhatsApp size; its
     wall is toned toward the slate (brightness) and its left edge fades into the
     ground (mask), and the foreground layer (John alone) sits over it at full
     strength, fading in a little sooner. The copy keeps a column of its own on
     the left, inside the safe area. */
  body.share {
    padding: 0;
    display: block;
    background: linear-gradient(160deg, ${C.slate} 0%, #172027 45%, ${C.ink} 100%);
  }
  .share-photo {
    position: absolute; left: 510px; top: 0;
    width: ${1536 * 0.86}px; height: ${1024 * 0.86}px;
    background-size: 100% 100%;
  }
  .share-photo--wall { filter: brightness(.5) saturate(.8); -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 340px); }
  .share-photo--subject { -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 160px); }
  .share-shade { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(13, 15, 16, .55) 0%, rgba(13, 15, 16, 0) 24%); }
  .share-copy {
    position: absolute; left: 72px; top: 0; bottom: 0; width: 520px;
    display: grid; grid-template-rows: auto 1fr auto; padding: 66px 0 64px;
  }
  .share-eyebrow { font-size: 17px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: ${C.aquaLight}; white-space: nowrap; }
  .share-name {
    align-self: center;
    font-family: 'Archivo', sans-serif; font-weight: 700; font-stretch: 90%;
    font-size: 132px; line-height: .86; letter-spacing: -0.01em; text-transform: uppercase; color: ${C.fog}; white-space: nowrap;
  }
  .share-line { font-size: 15px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${C.fog2}; white-space: nowrap; }
  .share-line b { color: ${C.aqua}; font-weight: 700; padding: 0 .35em; }
`;

// Same geometry as the hero arrow (Hero.astro).
const arrow = `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6 L20 20"/><path d="M20 12 L20 20 L12 20"/></svg>`;

function homeCard() {
  const [first, ...rest] = site.name.split(' ');
  const line = share.image.disciplines.map(esc).join('<b>&bull;</b>');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="share">
    <div class="share-photo share-photo--wall" style="background-image:url('${dataUri(heroFile('hero-portrait'))}')"></div>
    <div class="share-photo share-photo--subject" style="background-image:url('${dataUri(heroFile('hero-foreground'))}')"></div>
    <div class="share-shade"></div>
    <div class="share-copy">
      <div class="share-eyebrow">${esc(share.image.eyebrow)}</div>
      <div class="share-name">${esc(first)}<br>${esc(rest.join(' '))}</div>
      <div class="share-line">${line}</div>
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

const cards = [{ name: 'home', file: 'home.jpg', html: homeCard() }, ...cases.map((c, i) => ({ name: c.slug, file: `${c.slug}.png`, html: caseCard(c, i) }))].filter(
  (card) => !only.length || only.includes(card.name),
);
if (!cards.length) throw new Error(`og: no card named ${only.join(', ')}`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

for (const card of cards) {
  await page.setContent(card.html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // Guard against type that would clip, overflow the card or leave the safe area (72 px each side; on the homepage
  // card the copy also keeps clear of the portrait, which begins at 600 px).
  const overflow = await page.evaluate(() => {
    const home = document.body.classList.contains('share');
    return [...document.querySelectorAll('.title, .role, .eyebrow, .share-eyebrow, .share-name, .share-line')]
      .filter((e) => {
        const range = document.createRange();
        range.selectNodeContents(e);
        const r = range.getBoundingClientRect();
        return e.scrollWidth > e.clientWidth + 1 || r.left < 72 - 1 || r.right > (home ? 600 : 1200 - 72) + 1 || r.top < 48 || r.bottom > 630 - 48;
      })
      .map((e) => e.className);
  });
  if (overflow.length) throw new Error(`og: ${card.file} overflows (${overflow.join(', ')})`);
  const png = await page.screenshot({ type: 'png' });
  const out = path.join(outDir, card.file);
  if (card.file.endsWith('.jpg')) await sharp(png).jpeg({ quality: 88, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(out);
  else fs.writeFileSync(out, png);
  console.log('og  ', card.file, `${Math.round(fs.statSync(out).size / 1024)} KB`);
}

// Browser icons are not generated here: they are derived from the photographic
// favicon master by scripts/icons.py, which keeps the circular crop and the
// transparent exterior and crops tighter at 16 and 32 pixels.

await browser.close();
