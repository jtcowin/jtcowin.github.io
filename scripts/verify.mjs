// Post-build verification. Run after `npm run build` with `npm run preview` serving dist.
//
//   1. Internal link check: every href/src in dist resolves to a built file (base-path aware).
//   2. Content guardrails: strings that must never appear in the public build.
//   3. Asset manifest integrity: every asset id used in content exists; every `file` exists on disk.
//   4. Accessibility: axe-core scan of each page (requires the preview server, see PREVIEW_URL).
//
// Exits non-zero on any failure so it can gate a PR.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSite } from '../site.config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

// Resolved from site.config.mjs so this script follows the deployment target
// (user site at `/`, project site at `/<repo>`, or a custom domain) automatically.
const resolved = resolveSite();
const SITE_ORIGIN = resolved.site.replace(/\/$/, '');
const BASE = resolved.base.replace(/\/$/, ''); // '' at the domain root
const PREVIEW = process.env.PREVIEW_URL ?? `http://localhost:4321${BASE}/`;
const failures = [];
const notes = [];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

if (!fs.existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const files = walk(dist);
const htmlFiles = files.filter((f) => f.endsWith('.html'));

// ---------------------------------------------------------------- 1. links
const known = new Set();
const seen = new Set();
for (const f of files) {
  const rel = '/' + path.relative(dist, f).split(path.sep).join('/');
  known.add(rel);
  if (rel.endsWith('/index.html')) known.add(rel.replace(/index\.html$/, ''));
}
// Nothing is expected later in v1.1: every linked file must resolve.
const expectedLater = new Set();

for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  const attrs = [...html.matchAll(/\b(?:href|src|poster|content)="([^"]+)"/g)].map((m) => m[1]);
  for (let url of attrs) {
    if (!url.startsWith('/') && !url.startsWith(SITE_ORIGIN)) continue;
    if (url.startsWith(SITE_ORIGIN)) url = url.slice(SITE_ORIGIN.length) || '/';
    url = url.split('#')[0].split('?')[0];
    if (!url) continue;
    if (!url.startsWith(BASE + '/') && url !== BASE) {
      failures.push(`[base] ${path.relative(dist, f)} links to "${url}" which is outside the base path ${BASE}`);
      continue;
    }
    const relPath = url.slice(BASE.length) || '/';
    const key = `${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (known.has(relPath) || known.has(relPath.replace(/\/$/, '') + '/index.html')) continue;
    if (expectedLater.has(url)) {
      notes.push(`[pending] ${url} is linked but not present yet (expected: add the resume PDF).`);
      continue;
    }
    failures.push(`[link] ${path.relative(dist, f)} -> ${url} does not resolve in dist/`);
  }
}

// ----------------------------------------------------------- 2. guardrails
const forbidden = [
  { re: /@johnboycrypto/i, why: 'handle must not appear' },
  { re: /524\s?%/, why: 'retired Trezor lift claim' },
  { re: /\bXETA\b/i, why: 'XETA must not appear on public surfaces' },
  { re: /Phoenix Community Capital/i, why: 'Phoenix must not appear on public surfaces' },
  { re: /Sui Network/i, why: 'confidential negotiations must not be mentioned' },
  { re: /17 unique creators/i, why: 'must be 8 unique creators across 17 participations' },
  { re: /linear\.app/i, why: 'internal Linear links must not be published' },
  { re: /youtube\.com|youtu\.be/i, why: 'do not link the Sui Summit YouTube upload' },
  { re: /(prepared|provided|supplied)\s+by\s+Trezor/i, why: 'Trezor did not prepare the creator-account comparison' },
  { re: /Influencer Manager/i, why: 'do not name or title the individual behind the testimonial' },
  { re: /Senior (Marketing|Social)/i, why: 'do not invent a senior title' },
  { re: /Head of/i, why: 'do not invent a senior title' },
  { re: /\[\[[A-Z ]+PLACEHOLDER/i, why: 'raw brief placeholder token leaked into output' },
  { re: /article reads/i, why: 'X figures must be labeled as post views' },
  { re: /\bclients?\b/i, why: 'logo bar organizations must not be called clients' },
  { re: /\u2014/, why: 'no em dashes in public-facing copy' },
  { re: /class="[^"]*\bph\b[^"]*"/, why: 'placeholder block rendered into the public build' },
  { re: /pending permission|pending confirmation/i, why: 'pending-permission UI rendered into the public build' },
  // v1.2: one aggregate impressions figure only. Location-level figures are retired.
  { re: /approximately\s+[\d,]+\s+impressions/i, why: 'location-level impression figures were retired in v1.2' },
  { re: /\b\d+\s+(?:active\s+|automated\s+|governed\s+)*workflows\b/i, why: 'do not publish a count of active workflows' },
];
// The hero name stream separates its repeats with an em dash, which is
// deliberate typography rather than prose punctuation, so that one element is
// excised before the guardrails run. Everything else is still tested.
const STREAM = /<span class="stream"[\s\S]*?<\/span>\s*<\/h1>/g;

for (const f of htmlFiles) {
  const raw = fs.readFileSync(f, 'utf8');
  const html = raw.replace(STREAM, '');
  for (const { re, why } of forbidden) {
    const m = html.match(re);
    if (m) failures.push(`[guardrail] ${path.relative(dist, f)} contains "${m[0]}" (${why})`);
  }
}
// Required claims phrasing on the creator page.
const creator = fs.readFileSync(path.join(dist, 'work/creator-campaigns/index.html'), 'utf8');
if (!/Eight unique creators across 17 participations/.test(creator)) {
  failures.push('[claim] creator page must state "Eight unique creators across 17 participations"');
}
if (!/Approximately 1\.25 million impressions/.test(creator)) {
  failures.push('[claim] creator page must use the 1.25 million aggregate impressions figure');
}
if (!/8\.7 times the account/i.test(creator)) {
  failures.push('[claim] creator page must use the approved 8.7x impressions benchmark');
}
if (!/directional performance benchmarks, not Trezor-owned analytics/i.test(creator)) {
  failures.push('[claim] creator page must carry the comparison methodology note');
}
const home = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
// v1.5: the standalone metrics strip is gone; figures live with the work they describe.
if (!/Approximately 1\.25M impressions/.test(home)) failures.push('[claim] the creator work card must carry "Approximately 1.25M impressions"');
if (/class="proof[\s"]/.test(home)) failures.push('[claim] the standalone metrics strip was retired in v1.5');
if (!/Social Media Manager/.test(home)) failures.push('[claim] homepage must preserve the official title "Social Media Manager"');
if (!/Web3 Marketing Consulting/.test(home)) failures.push('[claim] homepage must carry the consulting career entry');
// v1.3 hero: name and descriptor only.
if (!/hero__name/.test(home)) failures.push('[claim] hero must render the name as live text');
if (!/<header class="[^"]*site-header--overlay/.test(home)) failures.push('[claim] homepage header must overlay the hero, not sit on its own bar');
// v1.4 hero, title and About.
if (!/<title>John Cowin - Web3 Marketing, Strategy, (?:&amp;|&#38;|&) Content<\/title>/.test(home)) {
  failures.push('[claim] homepage must use the exact approved browser-tab title');
}
if (!/Web3 marketing, strategy, (?:&amp;|&#38;|&) content/i.test(home)) failures.push('[claim] hero must carry the approved descriptor');
if (!/hero__subject/.test(home)) failures.push('[claim] hero must layer the foreground cutout in front of the moving name');
if (!/hero__rule/.test(home)) failures.push('[claim] hero must carry the lower rule');
if (!/class="stream"/.test(home)) failures.push('[claim] hero name must render as the moving stream');
if (/icon-192\.png"[^>]*class="brand__mark"|brand__mark/.test(home)) failures.push('[claim] no brand mark may appear in the hero header');
if (!/Creative instincts\. Operator discipline\./.test(home)) failures.push('[claim] About must use the approved headline');
if (/class="eyebrow[^"]*">About</.test(home)) failures.push('[claim] the About section must have no eyebrow');
// v1.6 About narrative: the company is named, individual products are not, and
// the resume action sits in the third column beneath the thesis.
const decode = (t) => t.replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const textOf = (html) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const aboutCols = (home.match(/<div class="about__cols"[\s\S]*?<div class="timeline"/) || [''])[0];
if (!aboutCols) failures.push('[claim] About narrative columns not found');
if (!/Phi Labs Global/.test(aboutCols)) failures.push('[claim] the About narrative must name Phi Labs Global');
if (/<(?:strong|b)[\s>]/.test(aboutCols)) failures.push('[claim] the About narrative is set without bold (Version 1.6)');
for (const product of ['Archway', 'Ambur', 'Bolt']) {
  if (aboutCols.includes(product)) failures.push(`[claim] the About narrative must not name individual products (found "${product}")`);
}
if (!textOf(aboutCols).includes('to manage social media across a product portfolio that included a Layer 1 blockchain, an NFT marketplace, and a proprietary AMM.')) {
  failures.push('[claim] the Phi Labs column must use the approved Version 1.6 copy');
}
const thesisCol = (aboutCols.match(/<div class="about__col about__col--thesis"[\s\S]*?<\/div>/) || [''])[0];
const thesisAt = thesisCol.indexOf('difficult to ignore.');
const resumeAt = thesisCol.indexOf('about__resume');
if (thesisAt < 0 || resumeAt < thesisAt || !/Read the full resume/.test(thesisCol)) {
  failures.push('[claim] the "Read the full resume" button must sit in the third column, beneath the thesis');
}
// v1.6 career timeline: three chapters NOW to EARLIER, numbered 01 to 03, three
// primary nodes. Phi Labs Global is one chapter holding two phases, Current
// scope and Original mandate; every label sits beneath its chapter heading.
const retiredCareer = [
  'Late 2024 to present',
  'Bolt Liquidity phase',
  'Archway and Ambur Marketplace phase',
  'Web3 Marketing Consultant',
  'Independent Music and Marketing',
  'Owns positioning',
  'Selected DeFi',
  'Selected Companies',
  'publishing calendars',
];
for (const retired of retiredCareer) {
  if (home.includes(retired)) failures.push(`[claim] "${retired}" was retired from the About section`);
}
if (/securing global distribution/.test(home)) failures.push('[claim] the music entry must not repeat "securing global distribution"');
const timeline = (home.match(/<ol class="timeline__list"[\s\S]*?<\/ol>/) || [''])[0];
const chapterHtml = timeline.split('<li class="timeline__chapter').slice(1);
const timelineSpec = [
  ['Phi Labs Global', [
    ['Current scope', 'Own positioning, messaging, technical documentation, social and community strategy, creator partnerships, events, websites, campaign operations, and distribution.'],
    ['Original mandate', 'Joined as Social Media Manager to manage social channels, community engagement, campaigns, and product education across a portfolio with a combined audience of more than 200,000, including a Layer 1 blockchain and NFT marketplace.'],
  ]],
  ['Web3 Marketing Consulting', [
    ['Select DeFi Projects', 'Led social, community, content, and partner marketing for DeFi startups across Avalanche and Ethereum, managing audiences of up to 40,000 and a five-person moderator team.'],
  ]],
  ['Independent Music and Business Operator', [
    ['Global Music Project', 'Built a globally distributed music project streamed in 80+ countries, performed 140+ shows annually, and secured sponsorships, media appearances, and major-festival bookings.'],
  ]],
];
if (chapterHtml.length !== timelineSpec.length) failures.push(`[claim] the career timeline must have three chapters (found ${chapterHtml.length})`);
if ((timeline.match(/class="timeline__node"/g) || []).length !== 3) failures.push('[claim] the career timeline must have exactly three primary nodes');
if ((timeline.match(/Phi Labs Global/g) || []).length !== 1) failures.push('[claim] Phi Labs Global must appear once in the timeline, over both of its phases');
const details = [];
timelineSpec.forEach(([heading, phases], i) => {
  const c = chapterHtml[i] || '';
  const want = String(i + 1).padStart(2, '0');
  const markers = [...c.matchAll(/class="timeline__marker"[^>]*>([^<]*)</g)].map((m) => m[1]);
  const h = (c.match(/<h4 class="timeline__heading"[^>]*>([^<]*)<\/h4>/) || [])[1];
  if (markers.join(',') !== want) failures.push(`[claim] timeline chapter ${i + 1} must carry one typographic marker, ${want} (found ${markers.join(', ') || 'none'})`);
  if (h !== heading) failures.push(`[claim] timeline chapter ${want} must be headed "${heading}" (found ${h || 'none'})`);
  if (/<img|<svg/.test(c)) failures.push(`[claim] timeline chapter ${want} must not use icons or logos`);
  const phaseHtml = c.split(/<div class="timeline__phase[ "]/).slice(1);
  if (phaseHtml.length !== phases.length) failures.push(`[claim] "${heading}" must hold ${phases.length} phase(s) (found ${phaseHtml.length})`);
  phases.forEach(([label, copy], j) => {
    const ph = phaseHtml[j] || '';
    const l = (ph.match(/class="timeline__pill"[^>]*>([^<]*)</) || [])[1];
    const d = textOf((ph.match(/<p class="timeline__copy"[^>]*>([\s\S]*?)<\/p>/) || ['', ''])[1]);
    details.push(d);
    if (l !== label) failures.push(`[claim] "${heading}" phase ${j + 1} must carry the label "${label}" (found ${l || 'none'})`);
    if (c.indexOf('timeline__heading') > c.indexOf(`>${label}<`)) failures.push(`[claim] "${label}" must sit beneath "${heading}"`);
    if (d !== copy) failures.push(`[claim] the "${label}" description must use the approved copy`);
    if (!/<div class="timeline__detail" id="timeline-detail-\d+"/.test(ph)) failures.push(`[claim] the "${label}" description needs an id for its toggle`);
  });
});
const chapterClass = (c) => c.slice(0, c.indexOf('"'));
if (!chapterClass(chapterHtml[0] || '').includes('timeline__chapter--current') || chapterHtml.slice(1).some((c) => chapterClass(c).includes('--current'))) {
  failures.push('[claim] only the first chapter may be marked current');
}
if (!chapterClass(chapterHtml[0] || '').includes('timeline__chapter--wide')) failures.push('[claim] Phi Labs Global must span two timeline columns');
if (/production/i.test(details[0] || '')) failures.push('[claim] the Current scope description must not include "production"');
if (!/^Joined as Social Media Manager/.test(details[1] || '')) failures.push('[claim] the Original mandate description must open with the official title');
if (/\bindependent\b/i.test(details[3] || '')) failures.push('[claim] the music description must not include "independent"');
// Progressive disclosure is script-built on top of complete HTML, so without
// JavaScript every description above is simply visible.
for (const token of ['data-timeline', 'prefers-reduced-motion: reduce', 'timeline__toggle', 'aria-expanded', 'aria-controls', 'Escape']) {
  if (!home.includes(token)) failures.push(`[claim] the timeline script is missing "${token}" (disclosure, keyboard or motion guard)`);
}
if (!/Select Companies, Products, and Partners/.test(home)) failures.push('[claim] trust-bar heading must read "Select Companies, Products, and Partners"');
// Trust bar: its own band between About and Selected Work, seven entries in
// the approved order, no Sui Summit.
const bar = (home.match(/class="logobar[ "][\s\S]*?<\/ul>/) || [''])[0];
const barOrder = ['Phi Labs', 'Bolt Liquidity', 'Archway', 'Ambur Marketplace', 'Trezor', 'Bitrefill', 'Rayls Labs'];
const positions = barOrder.map((n) => bar.indexOf(n));
if (positions.some((x) => x < 0) || positions.some((x, i) => i > 0 && x < positions[i - 1])) {
  failures.push('[claim] trust bar must list its seven entries in the approved order');
}
if (/Sui Summit/.test(bar)) failures.push('[claim] Sui Summit was removed from the trust bar');
const aboutEnd = home.indexOf('</section>', home.indexOf('id="about"'));
const bandAt = home.indexOf('logobar--band');
if (!(bandAt > aboutEnd && bandAt < home.indexOf('id="work"'))) {
  failures.push('[claim] the trust bar must be its own band after About and before Selected Work');
}
if (!/<section[^>]*data-surface="band"[^>]*logobar--band/.test(home)) failures.push('[claim] the trust band must sit on its own band surface');
// Homepage order and surfaces.
const sectionIds = [...home.matchAll(/<section[^>]*\bid="([a-z-]+)"/g)].map((m) => m[1]);
const expected = ['about', 'work', 'capabilities', 'how-i-work', 'contact'];
if (expected.some((id, i) => sectionIds.indexOf(id) < 0 || (i > 0 && sectionIds.indexOf(id) < sectionIds.indexOf(expected[i - 1])))) {
  failures.push(`[claim] homepage order must be hero, about, work, capabilities, how-i-work, contact (got ${sectionIds.join(', ')})`);
}
const surfaceOrder = [...home.matchAll(/class="chapter"[^>]*data-surface="([a-z-]+)"|data-surface="([a-z-]+)"[^>]*class="chapter"/g)].map((m) => m[1] || m[2]);
if (surfaceOrder.join(',') !== 'light,dark,soft,brand,light-return') {
  failures.push(`[claim] chapters must take surfaces 02 to 06 in order (got ${surfaceOrder.join(', ')})`);
}
// About must be the second section, directly after the hero.
const order = [...home.matchAll(/<section[^>]*\bid="([a-z-]+)"/g)].map((m) => m[1]);
if (order[0] !== undefined && order.indexOf('about') !== 0 && !/class="hero"/.test(home)) {
  failures.push('[claim] unexpected homepage section order');
}
if (/<header class="[^"]*site-header--overlay/.test(creator)) failures.push('[claim] case-study pages must keep the ordinary header bar');
if (/hero__(?:marquee|lede|actions)/.test(home)) failures.push('[claim] retired v1.2 hero elements are still in the build');
if (!textOf(aboutCols).includes('I entered DeFi full-time in 2021 after a decade of building audiences and managing the business behind a globally distributed music project.')) {
  failures.push('[claim] homepage must use the approved About copy');
}
if (!textOf(aboutCols).includes('As the organization evolved, my role expanded far beyond social.')) failures.push('[claim] the Phi Labs column must close with the approved line');
// v1.2 sections and copy.
if (!/Governed by human judgment/.test(home)) failures.push('[claim] homepage must carry the How I Work heading');
if (!/AI accelerates the work/.test(home)) failures.push('[claim] homepage must carry the How I Work accountability statement');
if (!/Make the complex impossible to ignore/.test(home)) failures.push('[claim] homepage must use the approved contact headline');
if (!/Web3 Marketing, Content/.test(home)) failures.push('[claim] footer must carry the approved role line');
// The resume must actually exist for v1.1.
if (!fs.existsSync(path.join(root, 'public/resume/John-Cowin-Resume.pdf'))) {
  failures.push('[asset] public/resume/John-Cowin-Resume.pdf is missing');
}

// ---------------------------------------------------------- 3. manifest
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/data/assets.json'), 'utf8'));
const ids = new Set(manifest.assets.map((a) => a.id));
const dupes = manifest.assets.map((a) => a.id).filter((id, i, arr) => arr.indexOf(id) !== i);
for (const d of dupes) failures.push(`[manifest] duplicate asset id "${d}"`);
const perms = new Set(['pending', 'approved', 'redacted', 'private-only']);
for (const a of manifest.assets) {
  if (!perms.has(a.permission)) failures.push(`[manifest] ${a.id}: invalid permission "${a.permission}"`);
  if (!a.alt) failures.push(`[manifest] ${a.id}: missing alt text`);
  if (a.file && a.type !== 'video' && a.type !== 'og') {
    if (!fs.existsSync(path.join(root, 'src/assets', a.file))) failures.push(`[manifest] ${a.id}: file src/assets/${a.file} not found`);
  }
  if (a.type === 'og' && a.file && !fs.existsSync(path.join(root, 'public', a.file))) {
    failures.push(`[manifest] ${a.id}: public/${a.file} not found (run npm run og)`);
  }
  if (a.type === 'video' && a.file && !fs.existsSync(path.join(root, 'public/media', a.file))) {
    failures.push(`[manifest] ${a.id}: public/media/${a.file} not found`);
  }
  if (a.poster && !fs.existsSync(path.join(root, 'src/assets', a.poster))) {
    failures.push(`[manifest] ${a.id}: poster src/assets/${a.poster} not found`);
  }
}
// Every asset id referenced in src must exist.
const srcFiles = walk(path.join(root, 'src')).filter((f) => /\.(astro|mdx|json)$/.test(f) && !f.endsWith('assets.json'));
const idRefs = new Set();
for (const f of srcFiles) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/<(?:Media|Gallery|Testimonial|LinkCard|ArticleCard|MetricMarker)\b[^>]*\bid=["']([a-z0-9-]+)["']/g)) idRefs.add(m[1]);
  for (const m of s.matchAll(/\b(?:heroAsset|ogAsset|asset|poster|gallery|headshot)"?\s*[:=]\s*["']([a-z0-9-]+)["']/g)) idRefs.add(m[1]);
  for (const m of s.matchAll(/ids=\{\[([^\]]+)\]\}/g)) for (const id of m[1].matchAll(/["']([a-z0-9-]+)["']/g)) idRefs.add(id[1]);
  for (const m of s.matchAll(/"(portrait|docPanel|websiteFrame|summitStill|metric)":\s*"([a-z0-9-]+)"/g)) idRefs.add(m[2]);
}
// Ids referenced from home.json structures that the generic scan above cannot see
// (the visual rail's list, and the hero portrait).
const homeData = JSON.parse(fs.readFileSync(path.join(root, 'src/data/home.json'), 'utf8'));
for (const id of homeData.rail?.items ?? []) idRefs.add(id);
if (homeData.hero?.portrait) idRefs.add(homeData.hero.portrait);
if (homeData.hero?.foreground) idRefs.add(homeData.hero.foreground);

for (const id of idRefs) {
  if (!ids.has(id) && !['context', 'role', 'main', 'top', 'work', 'about', 'contact', 'capabilities'].includes(id)) {
    // Section ids in MDX also match the pattern; only flag ids that look like asset ids.
    if (/^(hero|card|about|cc|tm|ev|og)-/.test(id)) failures.push(`[manifest] referenced asset id "${id}" is not in assets.json`);
  }
}
const unused = [...ids].filter((id) => !idRefs.has(id));
if (unused.length) notes.push(`[manifest] unreferenced asset ids (fine, but tidy up if unneeded): ${unused.join(', ')}`);

// ------------------------------------------------------------- 4. axe
let axeRan = false;
try {
  const { chromium } = await import('playwright');
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const res = await fetch(PREVIEW).catch(() => null);
  if (!res || !res.ok) {
    notes.push(`[axe] preview server not reachable at ${PREVIEW}; skipped accessibility scan (run \`npm run preview\` first).`);
  } else {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    const pages = ['', 'work/creator-campaigns/', 'work/technical-marketing/', 'work/events-video/', '404.html'];
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 800 }]) {
      const ctx = await browser.newContext({ viewport });
      const page = await ctx.newPage();
      for (const p of pages) {
        await page.goto(PREVIEW + p, { waitUntil: 'networkidle' });
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
        for (const v of results.violations) {
          const targets = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ');
          failures.push(`[axe:${viewport.width}] ${p || '/'} ${v.id} (${v.impact}): ${v.help} -> ${targets}`);
        }
      }
      await ctx.close();
    }
    await browser.close();
    axeRan = true;
  }
} catch (e) {
  notes.push(`[axe] skipped: ${e.message}`);
}

// ----------------------------------------------------------------- report
console.log(`\nChecked ${htmlFiles.length} HTML pages, ${seen.size} internal URLs, ${manifest.assets.length} manifest entries${axeRan ? ', axe scan on 5 pages x 2 viewports' : ''}.`);
for (const n of notes) console.log('note ', n);
if (failures.length) {
  for (const f of failures) console.log('FAIL ', f);
  console.log(`\n${failures.length} failure(s).`);
  process.exit(1);
}
console.log('All checks passed.');
