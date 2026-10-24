// Generates the social-preview images (1200x630) from the site's own type and
// palette, so a shared link looks like the site it opens. Run: npm run og
// (every card), or `npm run og -- home` for one card (or a case study's slug);
// `--out=<dir>` writes the cards somewhere other than public/og (to compare a
// fresh render with the committed files). Each card is written under the file
// name its manifest entry gives (src/data/assets.json, og-home and og-<slug>).
//
// Version 1.5 system: Archivo (variable, wdth + wght) for display, Manrope for
// labels.
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
// Case Study Share Cards (October 2026): each case study's card is its own,
// built from its page's hero, not one template in three colors, and John
// approved each as rendered here. Creator Marketing and Partnerships is the
// hero's layered scene (sky, headline, villa, fronds) with prints from the
// three trips and a dotted route between them; Technical Product Marketing is
// the hero's isometric system, opened and running, labeled as the hero labels
// it, beside the headline; Events and Multimedia Production is the program
// monitor on the event floor, a still of the reel's event film under the
// monitor's own marks, with SECURE. BUILD. CAPTURE. CUT. AMPLIFY. as its lower
// third. What ties them together: the same faces, the teal accents and each
// case study's name, without the number the pages put before it (John: the
// number reads on the site, not on a thumbnail). The words come from the pages'
// data. Each is crop-safe like the homepage card: every piece of text lies
// wholly inside the central square or wholly outside it, so a compact preview
// shows complete words over a complete picture. The sources are in
// scripts/og (the README says where each came from). The approved files are
// pinned in verify.mjs: a re-render on another machine differs from them in its
// bytes, so commit a case-study card only when its design changes, under a new
// versioned file name (in its manifest entry) and with its new pin.
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

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const site = readJson('src/data/site.json');
const manifest = readJson('src/data/assets.json').assets;
const share = site.homeShare;
// An image the site already uses, by its manifest id (the hero layers).
const heroFile = (id) => path.join(root, 'src/assets', manifest.find((a) => a.id === id).file);
const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const fileUri = (file) => `data:${MIME[path.extname(file)]};base64,${fs.readFileSync(file).toString('base64')}`;
// A case-study card's own source (scripts/og).
const ogSource = (name) => fileUri(path.join(root, 'scripts/og', name));
// The file a card is written to: its manifest entry's, e.g. og/creator-campaigns-v2.jpg -> creator-campaigns-v2.jpg.
const cardFile = (id) => {
  const entry = manifest.find((a) => a.id === id && a.type === 'og');
  if (!entry?.file) throw new Error(`og: the manifest has no card entry ${id}`);
  return path.basename(entry.file);
};
// A case study's name without the number the pages put before it: "02 / Technical Product Marketing" -> "Technical Product Marketing".
const caseName = (label) => label.replace(/^\s*\d+\s*\/\s*/, '');

// The case studies, in their order, from their frontmatter (without a full MDX parse).
const workDir = path.join(root, 'src/content/work');
const cases = fs
  .readdirSync(workDir)
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => {
    const fm = fs.readFileSync(path.join(workDir, f), 'utf8').split('---')[1] ?? '';
    const order = Number((fm.match(/^order:\s*(\d+)\s*$/m) ?? [])[1] ?? 99);
    return { slug: f.replace(/\.mdx$/, ''), order };
  })
  .sort((a, b) => a.order - b.order);

// The homepage card's photograph: scale, and the offsets that put the face (x 510, the eyes at y 236 of the original)
// on the card's center line with the head 44 px from the top.
const SHARE = { scale: 0.94, left: Math.round(600 - 510 * 0.94), top: 22 };
// The central square that compact previews crop to (Slack's thumbnail).
const SQUARE = { left: 285, right: 915 };

// Fonts are inlined as data URIs: pages created with setContent() cannot load file:// resources.
const font = (pkgPath) => `data:font/woff2;base64,${fs.readFileSync(path.join(root, 'node_modules', pkgPath)).toString('base64')}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Palette tokens, copied from src/styles/global.css (raw tokens and surfaces).
const C = {
  ink: '#0d0f10',
  slate: '#25313a',
  bone: '#f3efe8',
  fog: '#edf0ef',
  fog2: '#c3cacb',
  steelDeep: '#4e5862',
  teal: '#1f4546',
  aquaLight: '#9fc9c3',
  aqua: '#4f918a',
  white: '#fbfaf7',
};

const faces = `
  @font-face { font-family: 'Archivo'; src: url('${font('@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2')}') format('woff2-variations'); font-weight: 100 900; font-stretch: 62% 125%; }
  @font-face { font-family: 'Manrope'; src: url('${font('@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2')}') format('woff2-variations'); font-weight: 200 800; }`;

const css = `${faces}
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    position: relative; overflow: hidden;
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

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

// The case-study cards' base: the same faces, a full reset, and the few utilities the three cards share.
const caseCss = `${faces}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; }
  body { position: relative; overflow: hidden; font-family: 'Manrope', sans-serif; -webkit-font-smoothing: antialiased; }
  .abs { position: absolute; }
  .display { font-family: 'Archivo', sans-serif; font-weight: 700; font-stretch: 86%; letter-spacing: -0.012em; }
  .label { font-weight: 700; text-transform: uppercase; letter-spacing: .16em; white-space: nowrap; }
  [data-t] { white-space: nowrap; }
`;

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

// ---- Creator Marketing and Partnerships --------------------------------------------------------------------------
// The hero's own layered scene, as the page sets it: the sky, the headline, the villa in front of the headline's
// lower line, the two fronds at the corners, then the bone fade and the case study's name. Laid on it, three prints
// from the trips (a frame each from the page's destination loops: scripts/og/creator-print-*.jpg), turned a few
// degrees, and the trip's dotted route from Costa Rica over the headline to Singapore. The villa is illustrative stock
// (credited on the page), never presented as one of the trips. The headline and the name sit inside the central
// square, the prints wholly outside it.
function creatorCard() {
  const { hero } = readJson('src/data/creator.json');
  const layer = (id) => fileUri(heroFile(hero.layers[id]));
  const W = 1300;
  const H = Math.round((W * 2019) / 3200);
  const left = Math.round((1200 - W) / 2) + 34;
  const top = 630 - H + 46;
  const scene = `left:${left}px;top:${top}px;width:${W}px;height:${H}px;`;
  // The headline breaks after its comma, as the page sets it in two lines.
  const [first, second] = hero.headline.split(/(?<=,)\s+/);
  const print = (file, place, cap, rot, pos = 'center') => `
    <figure class="print abs" style="${place};transform:rotate(${rot}deg)">
      <div class="print__img" style="background-image:url('${ogSource(file)}');background-position:${pos}"></div>
      <figcaption class="label"><span data-t>${esc(cap)}</span></figcaption>
    </figure>`;
  const route = `<svg class="route abs" viewBox="0 0 1200 630" width="1200" height="630" style="left:0;top:0"><g fill="none" stroke="rgba(251,250,247,.9)" stroke-width="2.4" stroke-dasharray="0.1 10" stroke-linecap="round"><path d="M 166 298 C 140 120, 320 30, 600 24 S 906 44, 950 100"/></g></svg>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${caseCss}
    body { background: #6f9fd0; }
    .scene { position: absolute; ${scene} background-size: 100% 100%; }
    .title { left: 0; right: 0; top: 70px; text-align: center; color: ${C.white}; font-size: 72px; line-height: .92; letter-spacing: -0.015em; text-shadow: 0 .02em .5em rgba(14,44,78,.25); }
    .title span { display: inline-block; }
    .frond { background-size: 100% 100%; }
    .fade { left: 0; right: 0; bottom: 0; height: 196px;
      background: radial-gradient(ellipse 58% 100% at 50% 100%, ${C.bone} 0%, ${C.bone} 38%, rgba(243,239,232,.82) 62%, rgba(243,239,232,0) 100%),
                  linear-gradient(to bottom, rgba(243,239,232,0) 0%, rgba(243,239,232,.7) 70%, ${C.bone} 100%); }
    .foot { left: 0; right: 0; bottom: 46px; text-align: center; color: ${C.teal}; font-size: 15px; }
    .foot span { display: inline-block; }
    .print { width: 226px; padding: 10px 10px 34px; background: #fdfcf9; border-radius: 3px;
      box-shadow: 0 1px 2px rgba(20,30,40,.18), 0 16px 30px -12px rgba(14,30,48,.5); }
    .print__img { width: 100%; aspect-ratio: 4 / 3; background-size: cover; }
    .print figcaption { position: absolute; left: 0; right: 0; bottom: 11px; text-align: center; font-size: 12px; letter-spacing: .22em; color: ${C.slate}; }
  </style></head><body>
    <div class="scene" style="background-image:url('${layer('sky')}')"></div>
    <h1 class="title abs display"><span data-t>${esc(first)}</span><br><span data-t>${esc(second)}</span></h1>
    <div class="scene" style="background-image:url('${layer('estate')}')"></div>
    <div class="frond abs" style="left:-44px;bottom:-30px;width:340px;height:${Math.round((340 * 1044) / 1400)}px;background-image:url('${layer('frondLeft')}')"></div>
    <div class="frond abs" style="right:-34px;bottom:-34px;width:350px;height:350px;background-image:url('${layer('frondRight')}')"></div>
    <div class="fade abs"></div>
    ${print('creator-print-costa-rica.jpg', 'left:30px;top:300px', 'Costa Rica', -7, '50% 70%')}
    ${print('creator-print-singapore.jpg', 'right:30px;top:52px', 'Singapore', 5, '45% 50%')}
    ${print('creator-print-mykonos.jpg', 'right:48px;top:300px', 'Mykonos', -4, '55% 50%')}
    ${route}
    <p class="foot abs label"><span data-t>${esc(caseName(hero.label))}</span></p>
  </body></html>`;
}

// ---- Technical Product Marketing ---------------------------------------------------------------------------------
// The hero's isometric system, captured from the page opened (its parts apart, its conduits running) at 2x
// (scripts/og/tpm-system.png, 1472 x 922: two moments of its pulse cycle joined where they agree, so signals run
// into the core from interviews, research and analysis and out of it to the website, documentation and campaigns),
// labeled as the hero labels it: each part along its plinth's outer lower edge, the core's name above it. Beside it,
// the headline in four lines with its accent, and the case study's name in two lines. The system and its labels lie
// inside the central square or wholly right of it; the headline and the name wholly left of it.
function tpmCard() {
  const { hero } = readJson('src/data/tpm.json');
  const words = hero.system.labels;
  const s = 0.5163; // 760 / 1472
  const sysW = 760;
  const sysH = Math.round(922 * s);
  const L = 364;
  const T = Math.round((630 - sysH) / 2) + 22;
  const at = (x, y) => [Math.round(L + x * s), Math.round(T + y * s)];
  const tag = (txt, x, y, cls = '') => `<span class="tag label abs ${cls}" style="left:${x}px;top:${y}px" data-t>${esc(txt)}</span>`;
  // Edge labels, as the hero's open state sets them: along each plinth's outer lower edge (left plinths: from the
  // left corner, descending; right plinths: from the front corner, ascending), just outside it. The corners are in
  // the capture's pixels.
  const ANG = 29;
  const rad = (ANG * Math.PI) / 180;
  const edge = (txt, [x, y], side) => {
    const [cx2, cy2] = at(x, y);
    const off = 7;
    const ox = side === 'left' ? -Math.sin(rad) * off : Math.sin(rad) * off;
    const oy = Math.cos(rad) * off;
    const inset = side === 'left' ? 4 : 6;
    const ix = Math.cos(rad) * inset;
    const iy = side === 'left' ? Math.sin(rad) * inset : -Math.sin(rad) * inset;
    return `<span class="etag label abs" style="left:${(cx2 + ox + ix).toFixed(1)}px;top:${(cy2 + oy + iy).toFixed(1)}px;transform:rotate(${side === 'left' ? ANG : -ANG}deg)" data-t>${esc(txt)}</span>`;
  };
  const [cx, cy] = at(735, 70);
  // "Building / the system / behind the / message.": the accent on its own line, the last word on its own.
  const [before, after] = hero.headline.split(hero.accent).map((t) => t.trim());
  const rest = after.split(' ');
  // The name in two lines: its first word beside the tile, the rest beneath.
  const [firstWord, ...otherWords] = caseName(hero.label).split(' ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${caseCss}
    body { background: ${C.bone}; }
    .grid { inset: 0; opacity: .6;
      background-image: repeating-linear-gradient(26.565deg, rgba(37,49,58,.075) 0 1px, transparent 1px 44px), repeating-linear-gradient(153.435deg, rgba(37,49,58,.075) 0 1px, transparent 1px 44px);
      -webkit-mask-image: radial-gradient(ellipse 62% 80% at 66% 54%, #000 0%, rgba(0,0,0,.45) 55%, transparent 100%); }
    .glow { left: 520px; top: 250px; width: 480px; height: 300px; background: radial-gradient(ellipse at center, rgba(79,145,138,.26) 0%, rgba(79,145,138,0) 70%); }
    .sys { left: ${L}px; top: ${T}px; width: ${sysW}px; height: ${sysH}px; background-size: 100% 100%;
      -webkit-mask-image: radial-gradient(ellipse 74% 80% at 50% 50%, #000 72%, transparent 100%); }
    .head { color: ${C.teal}; font-size: 13px; line-height: 1.6; }
    .tile { display: inline-block; width: 10px; height: 10px; margin-right: 10px; vertical-align: -1px; background: ${C.aqua}; transform: rotate(45deg) scale(.82); }
    .title { color: ${C.slate}; font-size: 47px; line-height: 1; }
    .title span { display: inline-block; }
    .accent { color: #2f6f69; }
    .tag { font-size: 10.5px; letter-spacing: .2em; color: ${C.steelDeep}; translate: -50% 0; }
    .tag--core { color: ${C.teal}; font-size: 11px; }
    .etag { font-size: 10px; letter-spacing: .2em; color: ${C.steelDeep}; transform-origin: 0 0; }
  </style></head><body>
    <div class="grid abs"></div>
    <div class="glow abs"></div>
    <div class="sys abs" style="background-image:url('${ogSource('tpm-system.png')}')"></div>
    ${edge(words.interviews, [37, 272], 'left')}${edge(words.research, [37, 538], 'left')}${edge(words.documents, [37, 804], 'left')}
    ${edge(words.website, [1309, 342], 'right')}${edge(words.documentation, [1307, 607], 'right')}${edge(words.campaigns, [1310, 872], 'right')}
    ${tag(words.core, cx, cy - 26, 'tag--core')}
    <p class="head label abs" style="left:56px;top:62px"><span data-t><span class="tile"></span>${esc(firstWord)}</span><br><span style="padding-left:20px" data-t>${esc(otherWords.join(' '))}</span></p>
    <h1 class="title display abs" style="left:56px;top:206px"><span data-t>${esc(before)}</span><br><span class="accent" data-t>${esc(hero.accent)}</span><br><span data-t>${esc(rest.slice(0, -1).join(' '))}</span><br><span data-t>${esc(rest.at(-1))}</span></h1>
  </body></html>`;
}

// ---- Events and Multimedia Production ----------------------------------------------------------------------------
// The program monitor on the event floor: a still of the hero reel's event film (its second chapter) at 4.4 s, the
// entrance corridor in neon (scripts/og/events-program.jpg: frame 106, 4.42 s), framed lower than the film so its
// burned-in banner stays off the card, under the monitor's marks: the corner brackets, the tally and PROGRAM with the
// chapter's title, and that frame's timecode as the page reads it (src/lib/ev-media.ts: hours, minutes, seconds and
// frames at 24 a second). The lower third is the page's five words, each with its period, in one even line, so the
// central square holds BUILD. CAPTURE. CUT. whole and the edges fall in the gaps; beneath it, the case study's name.
function eventsCard() {
  const ev = readJson('src/data/events.json');
  const { hero } = ev;
  const words = ev.stages.map((st) => `${st.label}.`);
  const chapter = hero.chapters.find((c) => c.key === 'event-film');
  // The still's frame and its time (the film runs at 24000/1001 frames a second); the page's own timecode formula.
  const FRAME = 106;
  const t = (FRAME * 1001) / 24000;
  const pad = (v) => String(Math.max(0, Math.floor(v))).padStart(2, '0');
  const tc = `${pad(t / 3600)}:${pad((t / 60) % 60)}:${pad(t % 60)}:${pad((t % 1) * 24)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${caseCss}
    body { background: ${C.ink}; }
    .film { left: -36px; right: -36px; top: -74px; bottom: -20px; background-size: cover; background-position: 50% 100%; filter: saturate(1.1) contrast(1.04); }
    .shade { inset: 0; background:
      linear-gradient(to bottom, rgba(10,12,14,.55) 0%, rgba(10,12,14,0) 22%, rgba(10,12,14,0) 46%, rgba(10,12,14,.8) 78%, rgba(10,12,14,.94) 100%),
      radial-gradient(ellipse 80% 70% at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,.38) 100%); }
    .bracket { width: 34px; height: 34px; border: 0 solid rgba(237,240,239,.7); }
    .chip { font-size: 12px; line-height: 1.55; letter-spacing: .16em; color: ${C.fog}; background: rgba(13,15,16,.58); border: 1px solid rgba(237,240,239,.16); border-radius: 3px; padding: 8px 12px 7px; }
    .chip .sub { color: ${C.aquaLight}; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 9px; vertical-align: 1px; background: #e5484d; box-shadow: 0 0 10px 1px rgba(229,72,77,.85); }
    .row { left: 0; right: 0; bottom: 84px; height: 56px; }
    .w { position: absolute; bottom: 0; font-size: 44px; line-height: 1; color: ${C.white}; text-transform: uppercase; }
    .foot { left: 0; right: 0; bottom: 30px; text-align: center; font-size: 13px; letter-spacing: .2em; color: ${C.aquaLight}; }
    .foot span { display: inline-block; }
    .ldot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 10px; vertical-align: 1px; background: ${C.aquaLight}; }
  </style></head><body>
    <div class="film abs" style="background-image:url('${ogSource('events-program.jpg')}')"></div>
    <div class="shade abs"></div>
    <div class="bracket abs" style="left:28px;top:28px;border-left-width:2px;border-top-width:2px"></div>
    <div class="bracket abs" style="right:28px;top:28px;border-right-width:2px;border-top-width:2px"></div>
    <div class="bracket abs" style="left:28px;bottom:28px;border-left-width:2px;border-bottom-width:2px"></div>
    <div class="bracket abs" style="right:28px;bottom:28px;border-right-width:2px;border-bottom-width:2px"></div>
    <p class="chip label abs" style="left:60px;top:58px"><span data-t><span class="dot"></span>${esc(hero.monitor.program)}</span><br><span class="sub" data-t>${esc(chapter.title)}</span></p>
    <p class="chip label abs" style="right:60px;top:58px"><span data-t>${esc(hero.monitor.timecode)} ${tc}</span></p>
    <div class="row abs" data-row>
      ${words.map((w, i) => `<span class="w display" data-word="${i}"><span data-t>${esc(w)}</span></span>`).join('')}
    </div>
    <p class="foot abs label"><span data-t><span class="ldot"></span>${esc(caseName(hero.kicker))}</span></p>
  </body></html>`;
}

const CASE_CARDS = { 'creator-campaigns': creatorCard, 'technical-marketing': tpmCard, 'events-video': eventsCard };
for (const c of cases) if (!CASE_CARDS[c.slug]) throw new Error(`og: no card is designed for the case study "${c.slug}"`);

const cards = [
  { name: 'home', file: cardFile('og-home'), quality: 92, html: homeCard() },
  ...cases.map((c) => ({ name: c.slug, file: cardFile(`og-${c.slug}`), quality: 88, html: CASE_CARDS[c.slug]() })),
].filter((card) => !only.length || only.includes(card.name));
if (!cards.length) throw new Error(`og: no card named ${only.join(', ')}`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

for (const card of cards) {
  await page.setContent(card.html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // The events card's lower third: one even line from 62 to 1158 px, four equal gaps.
  await page.evaluate(() => {
    const row = document.querySelector('[data-row]');
    if (!row) return;
    const ws = [...row.querySelectorAll('[data-word]')];
    const w = ws.map((e) => e.getBoundingClientRect().width);
    const L = 62;
    const R = 1158;
    const gap = (R - L - w.reduce((x, y) => x + y, 0)) / (ws.length - 1);
    let x = L;
    const xs = w.map((wi) => {
      const here = x;
      x += wi + gap;
      return here;
    });
    ws.forEach((e, i) => {
      e.style.left = xs[i] + 'px';
    });
  });
  // Guard against type that would clip, overflow the card or leave the safe area. On the homepage card every note
  // also stays wholly outside the central square that compact previews crop to (with 24 px to spare), so a crop
  // never cuts through a letter; on the case-study cards every piece of text lies wholly inside the square or wholly
  // outside it, 12 px clear of its edges either way, and at least 40 px from the card's sides, 36 px from its top and
  // 30 px from its foot.
  const overflow = await page.evaluate((square) => {
    if (document.body.classList.contains('share')) {
      return [...document.querySelectorAll('.share-note')]
        .filter((e) => {
          const range = document.createRange();
          range.selectNodeContents(e);
          const r = range.getBoundingClientRect();
          const inSquare = r.right > square.left - 24 && r.left < square.right + 24;
          return e.scrollWidth > e.clientWidth + 1 || r.left < 72 - 1 || r.right > 1200 - 72 + 1 || r.top < 48 || r.bottom > 630 - 48 || inSquare;
        })
        .map((e) => e.className);
    }
    return [...document.querySelectorAll('[data-t]')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        const inside = r.left >= square.left + 12 && r.right <= square.right - 12;
        const outside = r.right <= square.left - 12 || r.left >= square.right + 12;
        return !(inside || outside) || r.left < 40 || r.right > 1160 || r.top < 36 || r.bottom > 600;
      })
      .map((e) => e.textContent.trim());
  }, SQUARE);
  if (overflow.length) throw new Error(`og: ${card.file} overflows or straddles the crop (${overflow.join(', ')})`);
  const png = await page.screenshot({ type: 'png' });
  const out = path.join(outDir, card.file);
  await sharp(png).jpeg({ quality: card.quality, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(out);
  console.log('og  ', card.file, `${Math.round(fs.statSync(out).size / 1024)} KB`);
}

// Browser icons are not generated here: they are derived from the photographic
// favicon master by scripts/icons.py, which keeps the circular crop and the
// transparent exterior and crops tighter at 16 and 32 pixels.

await browser.close();
