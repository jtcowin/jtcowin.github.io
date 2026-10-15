// Post-build verification. Run after `npm run build` with `npm run preview` serving dist.
//
//   1. Internal link check: every href/src in dist resolves to a built file (base-path aware).
//   2. Content guardrails: strings that must never appear in the public build.
//   3. Asset manifest integrity: every asset id used in content exists; every `file` exists on disk.
//   4. Repository hygiene: no .DS_Store shipped or tracked, and no oversized file in dist.
//   5. Accessibility: axe-core scan of each page (requires the preview server, see PREVIEW_URL).
//
// Exits non-zero on any failure so it can gate a PR.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
  { re: /\u2014|&mdash;|&#8212;|&#x2014;/i, why: 'no em dashes in public-facing copy' },
  { re: /class="[^"]*\bph\b[^"]*"/, why: 'placeholder block rendered into the public build' },
  { re: /pending permission|pending confirmation/i, why: 'pending-permission UI rendered into the public build' },
  // v1.2: one aggregate impressions figure only. Location-level figures are retired.
  { re: /approximately\s+[\d,]+\s+impressions/i, why: 'location-level impression figures were retired in v1.2' },
  { re: /\b\d+\s+(?:active\s+|automated\s+|governed\s+)*workflows\b/i, why: 'do not publish a count of active workflows' },
  // v1.7: John did not lead a community function in this B2B role.
  { re: /community strateg/i, why: 'the portfolio must not imply community strategy' },
];
// Two em dashes are approved, and each is excised in its exact approved form
// before the guardrails run: the hero name stream separates its repeats with
// one, which is deliberate typography rather than prose punctuation, and the
// Version 1.9 footer credit, "© <year> John Cowin — Built end to end.", keeps
// one on purpose. Everything else is still tested, so an em dash anywhere
// else, or in a reworded credit, still fails.
const STREAM = /<span class="stream"[\s\S]*?<\/span>\s*<\/h1>/g;
const FOOTER_CREDIT = /(<p class="site-footer__meta[^"]*"[^>]*>)© \d{4} John Cowin — Built end to end\.(<\/p>)/g;

for (const f of htmlFiles) {
  const raw = fs.readFileSync(f, 'utf8');
  const html = raw.replace(STREAM, '').replace(FOOTER_CREDIT, '$1$2');
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
// v1.5: the standalone metrics strip is gone; v1.7 moves the figures to the
// case-study pages (see Select Work below).
if (/class="proof[\s"]/.test(home)) failures.push('[claim] the standalone metrics strip was retired in v1.5');
// The About redesign states no formal title on the homepage. The only formal
// title for the Phi Labs role is still "Social Media Manager" (resume); the
// invented-title check above keeps any other title from appearing.
// v1.3 hero: name and descriptor only.
if (!/hero__name/.test(home)) failures.push('[claim] hero must render the name as live text');
if (!/<header class="[^"]*site-header--overlay/.test(home)) failures.push('[claim] homepage header must overlay the hero, not sit on its own bar');
// v1.4 hero, title and About.
if (!/<title>John Cowin - Web3 Marketing, Strategy, (?:&amp;|&#38;|&) Content<\/title>/.test(home)) {
  failures.push('[claim] homepage must use the exact approved browser-tab title');
}
// v1.8: the hero and the footer carry the same descriptor, exactly (the hero
// sets it in capitals through CSS only).
const DESCRIPTOR = 'Web3 Marketing, Strategy, & Content';
const heroDescriptor = (home.match(/<p class="hero__descriptor"[^>]*>([\s\S]*?)<\/p>/) || [])[1];
if (heroDescriptor === undefined || heroDescriptor.replace(/&amp;|&#38;/g, '&').trim() !== DESCRIPTOR) failures.push(`[claim] the hero descriptor must read exactly "${DESCRIPTOR}"`);
if (!/hero__subject/.test(home)) failures.push('[claim] hero must layer the foreground cutout in front of the moving name');
if (!/hero__rule/.test(home)) failures.push('[claim] hero must carry the lower rule');
if (!/class="stream"/.test(home)) failures.push('[claim] hero name must render as the moving stream');
if (/icon-192\.png"[^>]*class="brand__mark"|brand__mark/.test(home)) failures.push('[claim] no brand mark may appear in the hero header');
if (!/Creative instincts\. Operator discipline\./.test(home)) failures.push('[claim] About must use the approved headline');
if (/class="eyebrow[^"]*">About</.test(home)) failures.push('[claim] the About section must have no eyebrow');
// About (v1.7): the static headline, the three approved paragraphs
// (every word its own span, so the flow never re-wraps a line), exactly the
// three approved blue-teal highlights, the resume button on the closing row
// after the third paragraph, then the lower rule and the trust bar, all inside
// About on its own background. No caret, no retired copy, no em dash.
const decode = (t) => t.replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const textOf = (html) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const aboutStart = home.indexOf('id="about"');
const aboutEnd = home.indexOf('</section>', aboutStart);
const aboutHtml = aboutStart < 0 ? '' : home.slice(aboutStart, aboutEnd);
const flow = (aboutHtml.match(/<div class="flow"[\s\S]*?<hr class="about__rule"/) || [''])[0];
if (!flow) failures.push('[claim] the About narrative (flow, then the lower rule) was not found');
const paragraphHtml = [...flow.matchAll(/<p class="flow__p[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
const approvedParagraphs = [
  'I came to DeFi in 2021 after a decade of building audiences and running the business behind a globally distributed music project, securing sponsorships, media appearances, and major bookings.',
  'In 2024, I joined Phi Labs Global to manage social across a product portfolio reaching more than 200,000 people. As the company evolved, my role expanded into positioning, technical documentation and websites, partnerships and KOL management, and campaigns and distribution.',
  'Today, I turn product complexity into market narratives people understand and connect with.',
];
if (paragraphHtml.length !== approvedParagraphs.length) failures.push(`[claim] About must present three paragraphs (found ${paragraphHtml.length})`);
approvedParagraphs.forEach((copy, i) => {
  const html = paragraphHtml[i] || '';
  if (textOf(html) !== copy) failures.push(`[claim] About paragraph ${i + 1} must use the approved copy`);
  const spans = (html.match(/<span class="w">/g) || []).length;
  const words = copy.split(' ').length;
  if (spans !== words) failures.push(`[claim] About paragraph ${i + 1} must set each word in its own span (${spans} spans for ${words} words)`);
});
// Each highlight is one <strong> around its words; a comma or period that
// follows it sits inside, set plain, and is not part of the phrase.
const marks = [...flow.matchAll(/<strong class="flow__mark"[^>]*>([\s\S]*?)<\/strong>/g)].map((m) => textOf(m[1].replace(/<span class="flow__plain">[\s\S]*?<\/span>/g, '')));
if (marks.join(' | ') !== 'globally distributed music project | more than 200,000 people | market narratives') {
  failures.push(`[claim] About must highlight exactly the three approved phrases, in order (found: ${marks.join(' | ') || 'none'})`);
}
if (/<(?:b|em|mark|u)[\s>]/.test(flow) || /<strong(?![^>]*class="flow__mark")/.test(flow)) {
  failures.push('[claim] nothing in the About narrative may be emphasized besides the three approved phrases');
}
const closing = (flow.match(/<div class="flow__close"[\s\S]*?<\/div>/) || [''])[0];
const thirdAt = closing.indexOf('flow__p--three');
if (thirdAt < 0 || closing.indexOf('flow__resume') < thirdAt || !/Read the full resume/.test(closing)) {
  failures.push('[claim] the "Read the full resume" button must follow the third paragraph on the closing row');
}
for (const product of ['Archway', 'Ambur', 'Bolt']) {
  if (flow.includes(product)) failures.push(`[claim] the About narrative must not name individual products (found "${product}")`);
}
// Earlier About copy, including the retired music metrics, must not return.
const retiredAbout = [
  'Late 2024 to present',
  'Bolt Liquidity phase',
  'Archway and Ambur Marketplace phase',
  'Web3 Marketing Consultant',
  'Independent Music and Marketing',
  'Owns positioning',
  'Selected DeFi',
  'Selected Companies',
  'publishing calendars',
  'my role expanded far beyond social',
  'I entered DeFi',
  'rofessionally managed',
  'listeners in',
  '80+',
  '80-plus',
  '140+',
  '140-plus',
  'shows annually',
  'major-festival',
  'combined audience',
  'strategy with execution',
  'difficult to ignore',
  // retired in v1.7
  'That chapter included',
  'community strategy',
  'technical storytelling',
  'understand and act on',
];
for (const retired of retiredAbout) {
  if (aboutHtml.includes(retired)) failures.push(`[claim] "${retired}" was retired from the About section`);
}
if (/securing global distribution/.test(home)) failures.push('[claim] the About copy must not repeat "securing global distribution"');
if (/\u2014|&mdash;|&#8212;|&#x2014;/i.test(aboutHtml)) failures.push('[claim] no em dash anywhere in the About section');
for (const token of ['timeline__', 'data-timeline', 'timeline-detail', 'career__', 'about__cols', 'logobar--band', 'data-surface="band"', 'story__', 'data-story', 'caret']) {
  if (aboutHtml.includes(token)) failures.push(`[claim] "${token}" is left over from a retired About (timeline, columns, band or type-on)`);
}
// The flow is progressive: armed only by the inline script, skipped for
// reduced motion, so the HTML alone shows everything.
for (const token of ['data-about', 'data-flow', 'data-trust', 'prefers-reduced-motion: reduce', 'IntersectionObserver', 'is-armed']) {
  if (!aboutHtml.includes(token)) failures.push(`[claim] the About flow is missing "${token}" (script or motion guard)`);
}
if (!/Select Companies, Products, and Partners/.test(home)) failures.push('[claim] trust-bar heading must read "Select Companies, Products, and Partners"');
// Trust bar: closes About beneath the lower rule, on the About background,
// seven entries in the approved order, no Sui Summit.
const bar = (home.match(/class="logobar[ "][\s\S]*?<\/ul>/) || [''])[0];
const barOrder = ['Phi Labs', 'Bolt Liquidity', 'Archway', 'Ambur Marketplace', 'Trezor', 'Bitrefill', 'Rayls Labs'];
const positions = barOrder.map((n) => bar.indexOf(n));
if (positions.some((x) => x < 0) || positions.some((x, i) => i > 0 && x < positions[i - 1])) {
  failures.push('[claim] trust bar must list its seven entries in the approved order');
}
if (/Sui Summit/.test(bar)) failures.push('[claim] Sui Summit was removed from the trust bar');
// Version 2.0: every entry shows its own logo file. Ambur Marketplace uses the
// supplied SVG exactly as delivered (a vector, never redrawn or recolored in
// the file: the bar's monochrome treatment and its optical sizing are CSS),
// sized and raised by its logos.json `optical` values so its capitals share
// the cap height and baseline of Bolt Liquidity beside Archway.
const barImgs = [...bar.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
if (barImgs.length !== barOrder.length || /logobar__wordmark/.test(bar)) failures.push(`[claim] all seven trust-bar entries must show their logo files (${barImgs.length} images)`);
const amburImg = barImgs.find((t) => /\balt="Ambur Marketplace"/.test(t)) || '';
const amburSrc = (amburImg.match(/\bsrc="([^"]+)"/) || [, ''])[1];
const amburFile = path.join(root, 'src/assets/logos/ambur-marketplace.svg');
if (!/\/ambur-marketplace\.[\w-]+\.svg$/.test(amburSrc)) failures.push('[claim] Ambur Marketplace must use its supplied SVG (src/assets/logos/ambur-marketplace.svg) as a vector image');
else if (!fs.existsSync(amburFile) || !fs.readFileSync(path.join(dist, amburSrc.replace(BASE, ''))).equals(fs.readFileSync(amburFile))) failures.push('[claim] the Ambur logo must ship byte for byte as supplied');
if (!fs.existsSync(amburFile) || !/viewBox="0 0 2022\.59 421\.513"/.test(fs.readFileSync(amburFile, 'utf8'))) failures.push('[claim] src/assets/logos/ambur-marketplace.svg must be the supplied artwork, unaltered');
if (!/--logo-scale: 0?\.\d+; --logo-shift: -0?\.\d+/.test(amburImg)) failures.push('[claim] the Ambur logo must carry its optical sizing (logos.json `optical`)');
const ruleAt = aboutHtml.indexOf('class="about__rule"');
const barAt = aboutHtml.indexOf('class="logobar');
if (ruleAt < 0 || barAt < ruleAt) failures.push('[claim] the lower rule and then the trust bar must close the About section');
if (/data-surface=/.test(aboutHtml)) failures.push('[claim] the trust bar must stay on the About background (no surface of its own)');
// Homepage order (v1.7): hero, About with the trust bar, Select Work, the
// wordless work reel, From positioning to production, Contact.
const at = (needle) => home.indexOf(needle);
const orderMarks = [['about', at('id="about"')], ['work', at('id="work"')], ['reel', at('data-reel')], ['capabilities', at('id="capabilities"')], ['contact', at('id="contact"')]];
if (orderMarks.some(([, i]) => i < 0) || orderMarks.some(([, i], k) => k > 0 && i < orderMarks[k - 1][1])) {
  failures.push(`[claim] homepage order must be hero, about, work, reel, capabilities, contact (${orderMarks.map(([n, i]) => `${n} at ${i}`).join(', ')})`);
}
if (/id="how-i-work"/.test(home)) failures.push('[claim] How I Work is part of the combined section in v1.7, not a section of its own');
const surfaceOrder = [...home.matchAll(/class="chapter"[^>]*data-surface="([a-z-]+)"|data-surface="([a-z-]+)"[^>]*class="chapter"/g)].map((m) => m[1] || m[2]);
if (surfaceOrder.join(',') !== 'light,dark,soft,brand') {
  failures.push(`[claim] the four chapters must take surfaces 02 to 05 in order (got ${surfaceOrder.join(', ')})`);
}

// The built CSS as flat rules, each with the at-rules around it, for the few
// checks that are about layout rather than copy (Select Work, the Stack and
// Contact below). Media queries may come out in either syntax, so the tests
// accept both "(min-width: 60rem)" and "(width>=60rem)".
const cssText = [
  ...files.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(f, 'utf8')),
  ...htmlFiles.flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])),
].join('\n');
const CSS_RULES = (() => {
  const rules = [];
  const stack = [];
  let buf = '';
  for (const ch of cssText.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') {
      stack.push(buf.split(';').pop().trim());
      buf = '';
    } else if (ch === '}') {
      const sel = stack.pop();
      if (sel && !sel.startsWith('@') && buf.trim()) rules.push({ sel, body: buf.trim(), at: stack.filter((x) => x.startsWith('@')).join(' ') });
      buf = '';
    } else buf += ch;
  }
  return rules;
})();
const rulesFor = (re) => CSS_RULES.filter((r) => re.test(r.sel));
// The built scripts, inline and bundled, for the checks on their guards.
const scriptsText = [
  ...htmlFiles.flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])),
  ...files.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(f, 'utf8')),
];
const DESKTOP = /min-width:\s*60rem|width\s*>=\s*60rem/;
const TALL = /min-height:\s*[\d.]+rem|height\s*>=\s*[\d.]+rem/;
const MOTION_OK = /prefers-reduced-motion:\s*no-preference/;

// Select Work (v1.7): the approved title and intro, then three cards in one
// template: number and category, a short title, a one-sentence subline, one
// dominant panel and two supporting panels, and one case-study link. Metrics
// live on the case-study pages; the only figure a card may show is the
// approved aggregate, on the creator card's typographic stand-in.
const sectionAt = (i) => (i < 0 ? '' : home.slice(i, home.indexOf('</section>', i)));
const workHtml = sectionAt(at('id="work"'));
if (!/<h2 id="work-heading"[^>]*>Select Work<\/h2>/.test(workHtml)) failures.push('[claim] the work section must be titled "Select Work"');
if (!workHtml.includes('The examples below show how I move from strategy through execution and coordinate the people, systems, and details required to ship.')) {
  failures.push('[claim] Select Work must use the approved intro');
}
const cardsHtml = [...workHtml.matchAll(/<article class="card"[\s\S]*?<\/article>/g)].map((m) => m[0]);
const approvedCards = [
  ['Creator Marketing and Partnerships', 'Built international creator campaigns from partner strategy and logistics through production and coordinated distribution.', 'work/creator-campaigns/'],
  ['Technical Product Marketing', 'Turned a complex DeFi protocol into a clear positioning, documentation, website, and content system.', 'work/technical-marketing/'],
  ['Events and Multimedia Production', 'Led event strategy and multi-camera production that turned live technical moments into reusable content.', 'work/events-video/'],
];
if (cardsHtml.length !== approvedCards.length) failures.push(`[claim] Select Work must show three cards (found ${cardsHtml.length})`);
approvedCards.forEach(([title, sub, href], i) => {
  const c = cardsHtml[i] || '';
  const t = textOf((c.match(/<h3 class="card__title"[\s\S]*?<\/h3>/) || [''])[0]);
  const line = textOf((c.match(/<p class="card__subline"[\s\S]*?<\/p>/) || [''])[0]);
  const words = line.split(' ').length;
  if (t !== title) failures.push(`[claim] card ${i + 1} must be titled "${title}" (found "${t}")`);
  if (line !== sub) failures.push(`[claim] card ${i + 1} must use the approved subline`);
  if (line.length < 95 || line.length > 130 || words < 12 || words > 16 || (line.match(/[.!?]/g) || []).length !== 1) {
    failures.push(`[claim] card ${i + 1} subline must be one sentence of 95 to 130 characters and 12 to 16 words (${line.length} characters, ${words} words)`);
  }
  const links = [...c.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);
  if (links.length !== 1 || links[0] !== `${BASE}/${href}`) failures.push(`[claim] card ${i + 1} must carry exactly one link, to /${href} (found ${links.join(', ') || 'none'})`);
  if (!/View case study/.test(c)) failures.push(`[claim] card ${i + 1} must carry the case-study link label`);
  if (!/<span class="card__num"[^>]*>0\d<\/span>/.test(c) || !/<span class="card__label"[^>]*>[^<]+<\/span>/.test(c)) failures.push(`[claim] card ${i + 1} must carry its number and category`);
  if ((c.match(/class="card__panel card__panel--main[\s"]/g) || []).length !== 1 || (c.match(/class="card__panel card__panel--side[\s"]/g) || []).length !== 2) {
    failures.push(`[claim] card ${i + 1} must have one dominant panel and two supporting panels`);
  }
  // The Sui Fest stand-in names its event and year (TOKEN2049 Singapore 2025),
  // which are not metrics; its wording is checked with the card media below.
  const visible = textOf(c.replace(/<span class="card__num"[\s\S]*?<\/span>/, '').replace(/<p class="fb__event"[\s\S]*?<\/p>/g, ''));
  const figures = (visible.match(/\d[\d.,]*[%MKx]?/g) || []).filter((f) => !(i === 0 && f === '1.25M'));
  if (figures.length) failures.push(`[claim] card ${i + 1} must leave its metrics to the case-study page (found ${figures.join(', ')})`);
  if (/1\.25M/.test(visible) && !/Approximately 1\.25M impressions/.test(visible)) failures.push('[claim] the creator card may show only "Approximately 1.25M impressions"');
});
// Every card video (Version 2.0): muted, inline, looping, nothing loaded until
// needed, no player controls or autoplay in the HTML (the script decides what
// plays), an accessible name, and its own labeled play and pause control. Each
// is either its card's primary (data-card-video) or a secondary tile
// (data-card-secondary), and each sits in a frame on its poster: a lazy,
// responsive picture of the loop at the loop's own crop, decorative since the
// video carries the description, used instead of the poster attribute (which
// browsers fetch at once). The video stays invisible until it plays, so the
// poster holds the tile without JavaScript and when a video cannot load.
const workVideos = workHtml.match(/<video\b[^>]*>/g) || [];
for (const video of workVideos) {
  for (const attr of ['muted', 'loop', 'playsinline', 'preload="none"', 'aria-label="']) {
    if (!video.includes(attr)) failures.push(`[claim] a card video is missing ${attr}`);
  }
  if (/\b(?:controls|autoplay)\b/.test(video)) failures.push('[claim] a card video must not show player controls or autoplay from the HTML');
  if (/\bposter=/.test(video)) failures.push('[claim] a card video takes its poster from the lazy picture beneath it, never the eagerly fetched poster attribute');
  if (/\bdata-card-video\b/.test(video) === /\bdata-card-secondary\b/.test(video)) failures.push("[claim] each card video must be either its card's primary (data-card-video) or a secondary tile (data-card-secondary)");
}
const workToggles = workHtml.match(/<button\b[^>]*\bdata-card-toggle\b[^>]*>/g) || [];
if (workToggles.length !== workVideos.length || workToggles.some((t) => !/aria-label="(?:Play|Pause) video: [^"]+"/.test(t))) {
  failures.push(`[claim] every card video needs its own labeled play and pause control (${workToggles.length} controls for ${workVideos.length} videos)`);
}
const frames = workHtml.match(/<div class="card__frame"[\s\S]*?<\/video>\s*<\/div>/g) || [];
const posterImgOf = (html) => (html.match(/<img\b[^>]*\bclass="card__img card__poster"[^>]*>/) || [''])[0];
if (
  frames.length !== workVideos.length ||
  frames.some((f) => {
    const img = posterImgOf(f);
    return !img || !/<\/picture>\s*<video\b/.test(f) || !/\balt(?:="")?[\s>]/.test(img) || !/\bloading="lazy"/.test(img) || !/\bsrcset="/.test(img);
  })
) {
  failures.push(`[claim] every card video must sit in its frame on a lazy, responsive poster picture with empty alt text (${frames.length} frames for ${workVideos.length} videos)`);
}
if (!rulesFor(/^\.card__video(?:\[data-astro-cid-[\w-]+\])?$/).some((r) => /opacity:\s*0\b/.test(r.body)) || !rulesFor(/^\.card__video(?:\[data-astro-cid-[\w-]+\])?\[data-shown\]/).some((r) => /opacity:\s*1\b/.test(r.body))) {
  failures.push('[claim] a card video must stay invisible over its poster until it plays (opacity 0, then 1 once shown)');
}
const playback = scriptsText.join('\n');
for (const token of ['data-shown', 'source:last-of-type', 'requestVideoFrameCallback', 'visibilitychange', 'prefers-reduced-motion: reduce', '(hover: hover) and (pointer: fine)']) {
  if (!playback.includes(token)) failures.push(`[claim] the card playback script is missing "${token}" (poster, failure, frame, tab, motion or pointer guard)`);
}
// Select Work media (Version 2.0): every tile is a video on John's approved
// loops. Case Study 01: the Costa Rica aftermovie primary, then the Trezor
// paper airplane and the Bolt Bus trailer. Case Study 02: the hero animation
// loop, the unchanged website hero motion, and the architecture diagram loop,
// contained whole on its own plate like the still it replaced. Case Study 03:
// the unchanged slippage preview, then the Sui Fest interview and the opening
// of the Sui Summit presentation (cropped to keep the slide's title whole).
// The typographic stand-ins remain only as a fallback and render nowhere.
const panelsOf = (c) => (c.match(/<div class="card__media"[\s\S]*/) || [''])[0].split(/(?=<div class="card__panel )/).slice(1);
const sourcesOf = (html) => [...html.matchAll(/<source\b[^>]*\bsrc="([^"]+)"/g)].map((m) => path.basename(m[1]));
const CARD_MEDIA = [
  ['creator-costa-rica-aftermovie-loop.mp4', 'creator-trezor-paper-airplane-loop.mp4', 'creator-bolt-bus-trailer-loop.mp4'],
  ['bolt-hero-animation-loop.mp4', 'bolt-website-hero-motion.mp4', 'bolt-architecture-diagram-loop.mp4'],
  ['bolt-slippage-explainer-preview.mp4', 'suifest-interview-loop.mp4', 'sui-summit-max-presentation-loop.mp4'],
];
cardsHtml.map(panelsOf).forEach((panels, i) => {
  CARD_MEDIA[i].forEach((name, n) => {
    const panel = panels[n] || '';
    const role = n === 0 ? 'data-card-video' : 'data-card-secondary';
    if (!new RegExp(`\\b${role}\\b`).test(panel) || !sourcesOf(panel).includes(name)) {
      failures.push(`[claim] card ${i + 1}, ${n === 0 ? 'its primary' : `secondary ${n}`}, must play ${name}`);
    }
  });
});
if (/class="fb[ "]/.test(cardsHtml.join(''))) failures.push('[claim] no typographic stand-in may render on the Select Work cards once their videos are approved');
const [, cs2 = [], cs3 = []] = cardsHtml.map(panelsOf);
if (!/^<div class="card__panel card__panel--side card__panel--contain" style="--plate: #[0-9a-f]{6}; --ratio: 1\.16\d\d"/.test(cs2[2] || '') || /object-position/.test(cs2[2] || '')) {
  failures.push('[claim] the architecture loop must be contained whole on its plate, at its own aspect ratio, like the still it replaced');
}
if (!rulesFor(/\.card__panel--contain\b.*>\s*\.card__frame\b/).some((r) => /var\(--ratio/.test(r.body) && /var\(--room\)/.test(r.body))) failures.push('[claim] a contained video frame must take its loop\'s aspect ratio and the plate\'s room');
if (!/object-position: 30% 50%/.test(posterImgOf(cs3[2] || '')) || !/<video\b[^>]*object-position: 30% 50%/.test(cs3[2] || '')) failures.push('[claim] the Sui Summit tile must keep the slide\'s title in view (30% 50%) on its poster and its loop alike');
// The card videos are web derivatives made for the homepage, never the
// original masters (which stay outside the repository): silent (no audio
// track), H.264 in MP4 with the index first so they start at once, each at its
// approved length, a primary under 4 MB and a secondary under 2 MB, and each
// poster at its loop's aspect ratio, so poster and loop share one crop.
const mp4Seconds = (file) => {
  const buf = fs.readFileSync(file);
  const i = buf.indexOf('mvhd');
  if (i < 4) return NaN;
  const v1 = buf[i + 4] === 1;
  const scale = buf.readUInt32BE(i + (v1 ? 24 : 16));
  const duration = v1 ? Number(buf.readBigUInt64BE(i + 28)) : buf.readUInt32BE(i + 20);
  return scale ? duration / scale : NaN;
};
const mp4Facts = (file) => {
  const buf = fs.readFileSync(file);
  const top = [];
  let moov = null;
  for (let off = 0; off + 8 <= buf.length; ) {
    let size = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (size === 1) size = Number(buf.readBigUInt64BE(off + 8));
    if (size === 0) size = buf.length - off;
    if (size < 8) break;
    top.push(type);
    if (type === 'moov') moov = buf.subarray(off, off + size);
    off += size;
  }
  const facts = { top, handlers: [], width: 0, height: 0, avc: false };
  if (!moov) return facts;
  for (let i = moov.indexOf('hdlr'); i >= 0; i = moov.indexOf('hdlr', i + 4)) facts.handlers.push(moov.toString('latin1', i + 12, i + 16));
  for (let i = moov.indexOf('tkhd'); i >= 0 && !facts.width; i = moov.indexOf('tkhd', i + 4)) {
    const at = i + 8 + (moov[i + 4] === 1 ? 32 : 20) + 52;
    facts.width = moov.readUInt32BE(at) / 65536;
    facts.height = moov.readUInt32BE(at + 4) / 65536;
  }
  facts.avc = moov.indexOf('avc1') >= 0;
  return facts;
};
const imageSize = (file) => {
  const b = fs.readFileSync(file);
  if (b.toString('latin1', 1, 4) === 'PNG') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
};
// Seconds per loop, as cut from the approved ranges (see each manifest entry's
// source note for the frames trimmed from an edge, and why).
const LOOP_SECONDS = {
  'creator-costa-rica-aftermovie-loop.mp4': 13.56,
  'creator-trezor-paper-airplane-loop.mp4': 12.01,
  'creator-bolt-bus-trailer-loop.mp4': 10.93,
  'bolt-hero-animation-loop.mp4': 11.68,
  'bolt-website-hero-motion.mp4': 13.5,
  'bolt-architecture-diagram-loop.mp4': 11.0,
  'bolt-slippage-explainer-preview.mp4': 9.72,
  'suifest-interview-loop.mp4': 12.01,
  'sui-summit-max-presentation-loop.mp4': 11.01,
};
const cardManifest = JSON.parse(fs.readFileSync(path.join(root, 'src/data/assets.json'), 'utf8')).assets;
cardsHtml.forEach((c, i) => {
  for (const video of c.match(/<video\b[\s\S]*?<\/video>/g) || []) {
    const primary = /\bdata-card-video\b/.test(video);
    for (const name of sourcesOf(video).filter((n) => n.endsWith('.mp4'))) {
      const file = path.join(root, 'public/media', name);
      if (!fs.existsSync(file)) {
        failures.push(`[asset] card ${i + 1}: public/media/${name} not found`);
        continue;
      }
      const mb = fs.statSync(file).size / 1048576;
      if (mb > (primary ? 4 : 2)) failures.push(`[asset] card ${i + 1}: ${name} is ${mb.toFixed(2)} MB; a ${primary ? 'primary stays under 4' : 'secondary stays under 2'} MB`);
      const sec = mp4Seconds(file);
      const want = LOOP_SECONDS[name];
      if (!want) failures.push(`[asset] card ${i + 1}: ${name} is not one of the approved loops`);
      else if (!(Math.abs(sec - want) <= 0.06)) failures.push(`[asset] card ${i + 1}: ${name} runs ${sec.toFixed(2)} s; its approved loop runs ${want} s`);
      const f = mp4Facts(file);
      if (f.handlers.includes('soun')) failures.push(`[asset] card ${i + 1}: ${name} carries an audio track; card videos are silent files`);
      if (!f.avc) failures.push(`[asset] card ${i + 1}: ${name} must be H.264 (avc1) for every browser`);
      if (!(f.top.indexOf('moov') >= 0 && f.top.indexOf('moov') < f.top.indexOf('mdat'))) failures.push(`[asset] card ${i + 1}: ${name} must keep its index (moov) before its data (faststart)`);
      const entry = cardManifest.find((a) => a.type === 'video' && a.file === name);
      const poster = entry?.poster ? path.join(root, 'src/assets', entry.poster) : null;
      const size = poster && fs.existsSync(poster) && /\.(?:jpe?g|png)$/i.test(poster) ? imageSize(poster) : null;
      if (!size) failures.push(`[asset] card ${i + 1}: ${name} needs a poster in its manifest entry`);
      else if (f.width && Math.abs(size.width / size.height - f.width / f.height) > 0.01 * (f.width / f.height)) {
        failures.push(`[asset] card ${i + 1}: the poster for ${name} is ${size.width}x${size.height}; it must share the loop's ${f.width}x${f.height} aspect ratio`);
      }
    }
  }
});
for (const retired of ['bolt-hero-animation-preview.mp4']) {
  if (fs.existsSync(path.join(root, 'public/media', retired)) || fs.existsSync(path.join(dist, 'media', retired))) failures.push(`[hygiene] ${retired} was retired in Version 2.0 and must not ship`);
}
// Select Work (v1.9): on tall desktop screens the title and intro stay pinned
// beneath the header while the cards park under them, and both release
// together after the last card. It is an enhancement only: the inline head
// script marks the page with .js, and every sticky rule for the intro or the
// cards needs that class, a desktop width and prefers-reduced-motion:
// no-preference, so without JavaScript or with reduced motion the section
// reads as an ordinary sequence. The pinned intro also needs a minimum height.
const workHead = (workHtml.match(/<div class="[^"]*\bwork__head\b[^"]*"[^>]*\bdata-work-head\b[^>]*>[\s\S]*?<\/div>/) || [''])[0];
if (!/class="[^"]*\bwork__track\b/.test(workHtml) || !workHead) failures.push('[claim] Select Work must hold its title and intro (data-work-head) and its cards in one track');
else if (!/id="work-heading"/.test(workHead) || !/class="lede"/.test(workHead)) failures.push('[claim] the pinned Select Work head must hold the title and the intro');
for (const f of htmlFiles) {
  const headHtml = (fs.readFileSync(f, 'utf8').match(/<head\b[^>]*>[\s\S]*?<\/head>/) || [''])[0];
  if (!/<script>document\.documentElement\.classList\.add\(['"`]js['"`]\);?<\/script>/.test(headHtml)) failures.push(`[claim] ${path.relative(dist, f)}: the head must mark the page with the .js class`);
}
const stickyWork = CSS_RULES.filter((r) => /position:\s*sticky/.test(r.body) && /\.(?:card|work__head)\b(?!-)/.test(r.sel));
for (const part of ['work__head', 'card']) {
  if (!stickyWork.some((r) => new RegExp(`\\.${part}\\b(?!-)`).test(r.sel))) failures.push(`[claim] no sticky rule for .${part} was found in the built CSS`);
}
for (const r of stickyWork) {
  if (!r.sel.split(',').every((x) => /^\s*\.js\s/.test(x)) || !DESKTOP.test(r.at) || !MOTION_OK.test(r.at)) {
    failures.push(`[claim] "${r.sel}" is sticky without the .js class, a 60rem minimum width and prefers-reduced-motion: no-preference`);
  }
  if (/\.work__head\b/.test(r.sel) && !TALL.test(r.at)) failures.push('[claim] the pinned Select Work intro must be limited to screens tall enough to hold it');
}
// Keyboard focus never rests on a covered card: the stack script brings a
// covered card back into view when one of its controls takes keyboard focus.
const stackScript = scriptsText.find((t) => t.includes('data-catalog') && t.includes('focusin')) || '';
if (!stackScript.includes(':focus-visible')) failures.push('[claim] the Select Work stack must bring a covered card into view when it takes keyboard focus');

// The work reel (v1.8): a purely visual transition between Select Work and
// the combined section. No heading, label, caption, badge, tooltip or text of
// any kind: the whole reel is hidden from assistive technology and every
// image has empty alt text. Three rows of eight, moving right, left, right,
// dealt from the approved 24-piece pool, each piece once. The HTML carries a
// fixed mixed order; the inline script shuffles once per visit and keeps that
// order for the browser session. No video. It stays at three rows until eight
// more approved pieces arrive (32 in all): a fourth row now would have to
// repeat pieces or bring back excluded ones.
const REEL_POOL = [
  'ambur-1', 'ambur-2',
  'archway-1', 'archway-2', 'archway-3', 'archway-4', 'archway-5', 'archway-6', 'archway-7',
  'bolt-1', 'bolt-2', 'bolt-3', 'bolt-4', 'bolt-5', 'bolt-6', 'bolt-7', 'bolt-8', 'bolt-9', 'bolt-10', 'bolt-11',
  // the four approved screenshots, renamed for what they show
  'bolt-explainer-opaque-logic', 'bolt-explainer-composition', 'archway-under-the-arch', 'archway-jackal-outpost',
];
const reelAt = at('data-reel');
const reelOpen = reelAt < 0 ? -1 : home.lastIndexOf('<div', reelAt);
const reelHtml = reelOpen < 0 ? '' : home.slice(reelOpen, home.indexOf('<script', reelAt));
const reelTag = reelOpen < 0 ? '' : home.slice(reelOpen, home.indexOf('>', reelAt) + 1);
if (!reelHtml) failures.push('[claim] the work reel was not found');
if (!/\baria-hidden="true"/.test(reelTag)) failures.push('[claim] the reel must be hidden from assistive technology (aria-hidden="true" on the reel)');
if (/<h[1-6][\s>]/.test(reelHtml)) failures.push('[claim] the reel must carry no heading, visible or hidden');
if (/\b(?:aria-label|aria-labelledby|aria-describedby|title)=/.test(reelHtml) || /<(?:figcaption|figure|video|audio|iframe)\b/.test(reelHtml)) {
  failures.push('[claim] the reel must carry no label, caption, tooltip or video');
}
if (textOf(reelHtml) !== '') failures.push(`[claim] the reel must carry no text (found "${textOf(reelHtml).slice(0, 60)}")`);
const reelImgs = reelHtml.match(/<img\b[^>]*>/g) || [];
if (!reelImgs.length || reelImgs.some((t) => !/\salt(?:="")?(?=[\s>])/.test(t))) failures.push('[claim] every reel image must have empty alt text');
const reelDirs = [...reelHtml.matchAll(/data-reel-row data-direction="(left|right)"/g)].map((m) => m[1]).join(',');
if (reelDirs !== 'right,left,right') failures.push(`[claim] the reel rows must move right, left, right (found ${reelDirs || 'none'})`);
const reelRuns = [...reelHtml.matchAll(/<ul class="reel__run" data-reel-run[^>]*>([\s\S]*?)<\/ul>/g)].map((m) => [...m[1].matchAll(/data-reel-id="reel-([a-z0-9-]+)"/g)].map((x) => x[1]));
const reelIds = reelRuns.flat();
if (reelRuns.length !== 3 || reelRuns.some((r) => r.length !== 8)) failures.push(`[claim] the reel must deal three rows of eight (found ${reelRuns.map((r) => r.length).join('/') || 'none'})`);
if (new Set(reelIds).size !== reelIds.length || reelIds.length !== REEL_POOL.length || REEL_POOL.some((id) => !reelIds.includes(id))) {
  failures.push(`[claim] the reel must use the approved 24-piece pool, each piece once (found ${reelIds.length} pieces, ${new Set(reelIds).size} unique)`);
}
if (reelIds.join() === REEL_POOL.join()) failures.push('[claim] the reel HTML must carry a mixed order, not the pool order');
for (const token of ['jc-reel-order', 'sessionStorage', 'getRandomValues', 'data-reel-clone']) {
  if (!home.includes(token)) failures.push(`[claim] the reel's per-visit shuffle or repeat logic is missing "${token}"`);
}
// The approved files, and only those, sit in src/assets/reel: the excluded
// screenshots (2:53 PM and 2:59 PM), Discord.jpeg and Educational.jpeg never
// enter the repository, and the originals stay outside it.
const reelDir = path.join(root, 'src/assets/reel');
const reelFiles = fs.existsSync(reelDir) ? fs.readdirSync(reelDir).filter((f) => f !== '.DS_Store') : [];
const reelStems = reelFiles.map((f) => f.replace(/\.(jpe?g|png|webp|avif)$/i, ''));
const strayReel = reelStems.filter((st) => !REEL_POOL.includes(st));
if (strayReel.length || REEL_POOL.some((st) => !reelStems.includes(st))) {
  failures.push(`[asset] src/assets/reel must hold exactly the 24 approved pieces (extra: ${strayReel.join(', ') || 'none'}; missing: ${REEL_POOL.filter((st) => !reelStems.includes(st)).join(', ') || 'none'})`);
}
if (reelFiles.some((f) => /discord|educational|screenshot/i.test(f))) failures.push('[asset] an excluded or unrenamed screenshot is in src/assets/reel');
// v1.9: the reel stays purely visual. Nothing but the reel sits between Select
// Work and the combined section, so no title, note or caption can appear above
// or below it either; roles are stated on the case-study pages instead.
const reelGap = home.slice(home.indexOf('</section>', at('id="work"')), home.lastIndexOf('<section', at('id="capabilities"')));
if (textOf(reelGap.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '')) !== '') {
  failures.push('[claim] nothing but the reel may sit between Select Work and the combined section');
}

// From positioning to production (v1.7, Stack rebuilt in v1.8): What I Do and
// How I Work in one frame. AI appears only as an enabler, in a short
// working-style statement.
const prHtml = sectionAt(at('id="capabilities"'));
if (!/<h2 id="practice-heading"[^>]*>From positioning to production\.<\/h2>/.test(prHtml)) failures.push('[claim] the combined section must be headed "From positioning to production."');
const prLabels = [...prHtml.matchAll(/<h3 class="practice__label"[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1].trim()).join(', ');
// v1.9: the How I Work eyebrow is gone, so the statement follows the headline directly.
if (prLabels !== 'Capabilities, Stack') failures.push(`[claim] the combined section's labels must be Capabilities, Stack (found ${prLabels})`);
if (/>\s*How I Work\s*</i.test(prHtml)) failures.push('[claim] the How I Work eyebrow was removed in Version 1.9');
const prCaps = [...prHtml.matchAll(/<span class="cap__title"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]).join(' | ');
if (prCaps !== 'Positioning and messaging | Technical content and websites | Partnerships and KOL programs | Campaigns and distribution') {
  failures.push(`[claim] the four capability groups must be the approved ones, in order (found ${prCaps})`);
}
const prGroups = [...prHtml.matchAll(/<h4 class="stack__name"[^>]*>([^<]+)<\/h4>/g)].map((m) => m[1]).join(' | ');
if (prGroups !== 'AI and building | Systems and measurement | Creative and distribution') failures.push(`[claim] the Stack groups must be the approved three, in order (found ${prGroups})`);
// The Stack (v1.8): the approved 18 tools in their groups and order, each
// with its own brand artwork in a neutral tile (decorative, since the name is
// set beside it) and a readable name. ChatGPT appears once.
const STACK = [
  ['ChatGPT', 'Google Gemini', 'Claude Cowork', 'Claude Code', 'GitHub', 'MDX'],
  ['Linear', 'Mintlify', 'GitBook', 'Grafana', 'Google Analytics', 'Slack', 'Microsoft Teams'],
  ['Figma', 'Photoshop', 'Descript', 'Typefully', 'Grammarly'],
];
const prGroupHtml = [...prHtml.matchAll(/<div class="stack__group"[\s\S]*?<\/ul>/g)].map((m) => m[0]);
const prToolNames = prGroupHtml.map((g) => [...g.matchAll(/<span class="tool__name"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1].trim()));
if (JSON.stringify(prToolNames) !== JSON.stringify(STACK)) {
  failures.push(`[claim] the Stack must show the approved 18 tools in their groups and order (found ${prToolNames.map((g) => g.join(', ')).join(' | ')})`);
}
const prTools = (prHtml.match(/<li class="tool[ "]/g) || []).length;
const prLogos = [...prHtml.matchAll(/<img\b[^>]*class="tool__logo"[^>]*>/g)].map((m) => m[0]);
if (prLogos.length !== prTools || prLogos.some((t) => !/\salt(?:="")?(?=[\s>])/.test(t))) {
  failures.push(`[claim] every Stack tool needs its logo, with empty alt text beside the visible name (${prLogos.length} logos for ${prTools} tools)`);
}
if ((prHtml.match(/>ChatGPT</g) || []).length !== 1) failures.push('[claim] ChatGPT must appear once in the Stack');
// The logo files: exactly the approved SVGs, lower-case names, the selected
// ChatGPT file only, and nothing that could run or fetch anything.
const STACK_FILES = ['chatgpt', 'gemini', 'claude-cowork', 'claude-code', 'github', 'mdx', 'linear', 'mintlify', 'gitbook', 'grafana', 'google-analytics', 'slack', 'microsoft-teams', 'figma', 'photoshop', 'descript', 'typefully', 'grammarly'].map((n) => `${n}.svg`);
const stackDir = path.join(root, 'src/assets/stack');
const stackFiles = fs.existsSync(stackDir) ? fs.readdirSync(stackDir).filter((f) => f !== '.DS_Store') : [];
if (JSON.stringify([...stackFiles].sort()) !== JSON.stringify([...STACK_FILES].sort())) {
  failures.push(`[asset] src/assets/stack must hold exactly the 18 approved logos (found ${stackFiles.join(', ') || 'none'})`);
}
for (const f of stackFiles) {
  const svg = fs.readFileSync(path.join(stackDir, f), 'utf8');
  if (/<script|<foreignObject|<image\b|\son[a-z]+\s*=|(?:xlink:)?href\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/i.test(svg)) failures.push(`[asset] src/assets/stack/${f} carries a script, event handler, embedded image or external reference`);
}
const homeJson = JSON.parse(fs.readFileSync(path.join(root, 'src/data/home.json'), 'utf8'));
for (const g of homeJson.practice?.stack?.groups ?? []) {
  for (const t of g.tools ?? []) {
    if (!t.logo || !fs.existsSync(path.join(root, 'src/assets', t.logo))) failures.push(`[asset] Stack tool "${t.name}" has no logo file (src/assets/${t.logo})`);
  }
}
// The Stack (v1.9): each group's heading and its collection of tiles are
// centered in the group, and the tiles keep their own width rather than
// stretching to fill a row.
if (!rulesFor(/\.stack__name\b/).some((r) => /text-align:\s*center/.test(r.body))) failures.push('[claim] each Stack group heading must be centered in its group');
const toolRows = rulesFor(/\.stack__tools\b/);
if (!toolRows.some((r) => /justify-content:\s*center/.test(r.body))) failures.push('[claim] each Stack group must center its tiles');
if (toolRows.some((r) => /justify-content:\s*(?:space-|stretch)/.test(r.body)) || rulesFor(/\.tool\b(?!__|--)/).some((r) => /(?:^|;)\s*flex(?:-grow)?:\s*(?:[1-9]|auto)/.test(r.body))) {
  failures.push('[claim] Stack tiles must keep their own width, not stretch to fill a row');
}
// The capability rows answer the pointer and the keyboard alike.
const capRows = prHtml.match(/<li class="cap"[^>]*>/g) || [];
if (capRows.length !== 4 || capRows.some((t) => !/tabindex="0"/.test(t))) failures.push('[claim] the four capability rows must be reachable by keyboard');
for (const m of prHtml.matchAll(/--tilt:\s*(-?[\d.]+)deg/g)) if (Math.abs(+m[1]) > 2) failures.push(`[claim] a capability icon tilts ${m[1]} degrees (2 at most)`);
if (/certificat/i.test(prHtml)) failures.push('[claim] the Stack has no certificate column');
const prStatement = textOf((prHtml.match(/<p class="practice__statement"[\s\S]*?<\/p>/) || [''])[0]);
if (!prStatement || prStatement.split(' ').length > 60) failures.push(`[claim] the How I Work statement must be short (${prStatement.split(' ').length} words)`);
for (const retired of ['Governed by human judgment', 'AI-accelerated', 'AI accelerates the work', 'operating infrastructure', 'Governed automation', 'Marketing intelligence', 'What I do']) {
  if (home.includes(retired)) failures.push(`[claim] "${retired}" was retired with the separate What I Do and How I Work sections`);
}
// About must be the second section, directly after the hero.
const order = [...home.matchAll(/<section[^>]*\bid="([a-z-]+)"/g)].map((m) => m[1]);
if (order[0] !== undefined && order.indexOf('about') !== 0 && !/class="hero"/.test(home)) {
  failures.push('[claim] unexpected homepage section order');
}
if (/<header class="[^"]*site-header--overlay/.test(creator)) failures.push('[claim] case-study pages must keep the ordinary header bar');
if (/hero__(?:marquee|lede|actions)/.test(home)) failures.push('[claim] retired v1.2 hero elements are still in the build');
// Contact (v1.8): the approved headline and subline, then the email and
// resume actions and nothing else. Apostrophes may be typographic.
const plain = (t) => textOf(t).replace(/[‘’]/g, "'");
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  const rel = path.relative(dist, f);
  const contactHtml = (html.match(/<section id="contact"[\s\S]*?<\/section>/) || [''])[0];
  if (contactHtml) {
    const heading = plain((contactHtml.match(/<h2 id="contact-heading"[^>]*>([\s\S]*?)<\/h2>/) || [, ''])[1]);
    if (heading !== "Your product is complex. Its story shouldn't be.") failures.push(`[claim] ${rel}: the Contact headline must read "Your product is complex. Its story shouldn't be." (found "${heading}")`);
    const paras = [...contactHtml.matchAll(/<p class="(?!eyebrow)[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => plain(m[1]));
    if (paras.length !== 1 || paras[0] !== "If you need someone who can bring clarity from positioning through execution, let's talk.") {
      failures.push(`[claim] ${rel}: Contact must carry only the approved subline (found ${paras.length} paragraph(s))`);
    }
    const actions = [...contactHtml.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    if (actions.length !== 2 || !actions[0].startsWith('mailto:') || !/John-Cowin-Resume\.pdf$/.test(actions[1])) failures.push(`[claim] ${rel}: Contact keeps exactly the email and resume actions (found ${actions.join(', ')})`);
  }
  // Footer (v1.9): the descriptor, identical to the hero's, and the approved
  // credit, which names John once: "© <year> John Cowin — Built end to end."
  // Its em dash is intentional (see the guardrails above).
  const footer = (html.match(/<footer[\s\S]*?<\/footer>/) || [''])[0];
  const line = (footer.match(/<p class="site-footer__line"[^>]*>([\s\S]*?)<\/p>/) || [])[1];
  if (!line || textOf(line) !== DESCRIPTOR) failures.push(`[claim] ${rel}: the footer must carry the descriptor "${DESCRIPTOR}" exactly`);
  const credit = textOf((footer.match(/<p class="site-footer__meta[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1]);
  const year = new Date().getFullYear();
  if (credit !== `© ${year} John Cowin — Built end to end.`) failures.push(`[claim] ${rel}: the footer credit must read "© ${year} John Cowin — Built end to end." (found "${credit}")`);
  if ((textOf(footer).match(/John Cowin/g) || []).length !== 1) failures.push(`[claim] ${rel}: John's name must appear once in the footer`);
}
for (const retired of ['Make the complex impossible to ignore', 'Site by John Cowin']) {
  if (home.includes(retired)) failures.push(`[claim] "${retired}" was retired in Version 1.8`);
}
// Contact (v1.9): on the homepage, Contact and the footer form one closing
// frame at least a screen tall (small-viewport units where supported, so
// browser chrome never pushes the footer out of it), over a quiet grid. The
// grid is decorative (aria-hidden, no text), drawn with CSS gradients alone
// (no canvas or WebGL), and never animates on its own. Its pointer layer shows
// only for a fine pointer that can hover, without reduced motion, so touch
// and reduced motion keep the still grid.
const contactHome = (home.match(/<section id="contact"[\s\S]*?<\/section>/) || [''])[0];
if (!/class="[^"]*\bcontact--frame\b/.test(contactHome)) failures.push('[claim] the homepage Contact must be the full-height closing frame (contact--frame)');
const gridHtml = (contactHome.match(/<div class="contact__grid"[^>]*>[\s\S]*?<\/div>/) || [''])[0];
if (!gridHtml || !/\baria-hidden="true"/.test(gridHtml.slice(0, gridHtml.indexOf('>') + 1)) || !/data-contact-grid/.test(gridHtml)) {
  failures.push('[claim] the Contact grid must be present and hidden from assistive technology');
} else if (textOf(gridHtml) !== '' || /<(?:canvas|svg|img|picture|video)\b/.test(gridHtml)) {
  failures.push('[claim] the Contact grid must be drawn in CSS alone, with no text, canvas, image or SVG');
}
if (/<canvas\b/.test(home) || scriptsText.some((t) => /getContext\(\s*['"`](?:webgl|experimental-webgl)/.test(t))) failures.push('[claim] the homepage must not use canvas or WebGL');
const gridScript = scriptsText.find((t) => t.includes('data-contact-grid')) || '';
for (const token of ['(hover: hover) and (pointer: fine)', '(prefers-reduced-motion: reduce)', 'pointermove', 'pointerout', 'requestAnimationFrame', 'touch', 'IntersectionObserver']) {
  if (!gridScript.includes(token)) failures.push(`[claim] the Contact grid's pointer response is missing "${token}"`);
}
const frameRules = rulesFor(/\.contact--frame\b/);
if (!frameRules.some((r) => /min-height:/.test(r.body)) || !frameRules.some((r) => /100svh/.test(r.body))) failures.push('[claim] the Contact frame needs a min-height based on 100svh');
if (rulesFor(/\.contact__(?:grid|lines)\b/).some((r) => /(?:^|;)\s*animation(?:-name)?\s*:/.test(r.body))) failures.push('[claim] the Contact grid must never animate on its own');
const litRules = rulesFor(/\.contact__lines--lit\b/);
const litShown = litRules.filter((r) => /display:\s*block/.test(r.body));
if (!litRules.some((r) => /display:\s*none/.test(r.body) && !r.at) || !litShown.length || litShown.some((r) => !/hover:\s*hover/.test(r.at) || !/pointer:\s*fine/.test(r.at) || !MOTION_OK.test(r.at))) {
  failures.push('[claim] the grid\'s pointer layer must stay hidden except for a fine pointer that can hover, without reduced motion');
}
// Contact grid (Version 1.9 update): one even field behind the headline, the
// subline, the actions, the navigation and the footer, with no calm field
// masking it behind the text, eased in only at its outer edges. It runs on
// beneath the footer, so the frame must not clip it, the footer is at least
// that deep and its content paints above the grid. The lines take 8% of the
// light aqua at rest (about 4.6 points of L*, inside the 4 to 8% asked for)
// and 17% around the pointer, five points more than the reviewed build's 12%.
if (rulesFor(/\.contact__(?:copy|actions)\b[^,]*::?(?:before|after)/).length) failures.push('[claim] the Contact grid must run behind the text: no calm field behind the copy or the actions');
if (!rulesFor(/\.contact__grid\b/).some((r) => /inset:\s*0\s+0\s+calc\(\s*-1\s*\*\s*var\(--footer-h\)\s*\)/.test(r.body))) failures.push('[claim] the Contact grid must run on beneath the footer (bottom inset of minus --footer-h)');
if (frameRules.some((r) => /overflow(?:-[xy])?:\s*(?:hidden|clip)/.test(r.body))) failures.push('[claim] the Contact frame must not clip the grid that runs on beneath the footer');
const stillLines = rulesFor(/\.contact__lines(?!-)/).filter((r) => /mask-image/.test(r.body));
if (!stillLines.length || stillLines.some((r) => /radial-gradient|--grid-shape/.test(r.body))) failures.push('[claim] the still grid must be one even field, eased only at its edges (no shaped or calm area in its mask)');
// The row that meets the footer's rule is left to the rule, so the rule keeps
// its own color edge to edge instead of taking the grid's color.
if (!rulesFor(/\.contact__lines\b/).filter((r) => /mask-image/.test(r.body)).every((r) => /var\(--grid-rule\)/.test(r.body)) || !rulesFor(/\.contact__grid\b/).some((r) => /--grid-rule:\s*linear-gradient\(to top/.test(r.body))) {
  failures.push('[claim] the Contact grid must leave the footer rule\'s row to the rule (--grid-rule in every line mask)');
}
if (!rulesFor(/^\.site-footer(?:\[[^\]]*\])?$/).some((r) => /min-height:\s*var\(--footer-h\)/.test(r.body))) failures.push('[claim] the footer must be at least --footer-h tall, the depth the Contact grid runs beneath it');
if (!rulesFor(/^\.site-footer__inner(?:\[[^\]]*\])?$/).some((r) => /position:\s*relative/.test(r.body))) failures.push('[claim] the footer content must paint above the Contact grid (position: relative)');
const hexToken = (name) => (cssText.match(new RegExp(`${name}:\\s*(#[0-9a-f]{3,8})\\b`, 'i')) || [])[1];
const rgbOf = (hex) => {
  let h = hex.slice(1, 7);
  if (h.length === 3) h = [...h].map((x) => x + x).join('');
  return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16));
};
const linear = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lumOf = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const ratioOf = (a, b) => {
  const [x, y] = [lumOf(a), lumOf(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const lstarOf = (c) => {
  const y = lumOf(c);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
};
const brandBody = CSS_RULES.filter((r) => /^\[data-surface=["']?brand["']?\]$/.test(r.sel)).map((r) => r.body).join(';');
const brandToken = (name) => {
  const v = (brandBody.match(new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+)`)) || [])[1]?.trim();
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(v || '');
  return ref ? hexToken(ref[1]) : v;
};
const aquaShare = (name) => {
  const m = cssText.match(new RegExp(`${name}:\\s*color-mix\\(in srgb,\\s*var\\(--bg\\)\\s+(\\d+(?:\\.\\d+)?)%,\\s*var\\(--c-aqua-light\\)\\s*\\)`));
  return m ? 100 - Number(m[1]) : NaN;
};
const restShare = aquaShare('--grid-ink');
const litShare = aquaShare('--grid-lit');
if (restShare !== 8 || litShare !== 17) failures.push(`[claim] the Contact grid lines take 8% of the light aqua at rest and 17% around the pointer (found ${restShare}% and ${litShare}%)`);
const teal = brandToken('--bg');
const aqua = hexToken('--c-aqua-light');
if (!teal || !aqua) failures.push('[claim] the brand surface or the light aqua was not found in the built CSS');
else {
  const lineAt = (share) => rgbOf(teal).map((c, k) => Math.round(c + (rgbOf(aqua)[k] - c) * (share / 100)));
  const restPoints = lstarOf(lineAt(restShare)) - lstarOf(rgbOf(teal));
  if (!(restPoints >= 4 && restPoints <= 8)) failures.push(`[claim] the still Contact grid must sit at about 4 to 8% perceived contrast (found ${restPoints.toFixed(1)} points of L*)`);
  // Text on the brand surface keeps 4.5:1 even beside a fully lit line, with
  // one level of rendering variation added to the line.
  const lit = lineAt(litShare).map((c) => c + 1);
  for (const name of ['--heading', '--ink', '--ink-2', '--ink-3', '--accent', '--accent-ink']) {
    const v = brandToken(name);
    if (!v || !/^#[0-9a-f]{3,8}$/i.test(v)) {
      failures.push(`[claim] the brand surface's ${name} could not be read from the built CSS`);
      continue;
    }
    const r = ratioOf(rgbOf(v), lit);
    if (r < 4.5) failures.push(`[claim] brand ${name} (${v}) is ${r.toFixed(2)}:1 beside a fully lit Contact grid line; text there needs 4.5:1`);
  }
}

// Case-study roles (v1.9): each case study states John's part in one compact
// line under its intro, "My role: ...", naming how he set the strategy and
// briefed, shaped, approved and distributed work made with designers, editors
// and creators, without implying he was the hands-on designer. The label
// appears once per page.
// (Technical Product Marketing left the shared case-study layout in its
// Version 1 redesign and Events and Multimedia Production in its Version 1.0;
// each states John's part in its own copy, the latter with credits under each
// piece of work, checked below.)
for (const slug of ['creator-campaigns']) {
  const page = fs.readFileSync(path.join(dist, `work/${slug}/index.html`), 'utf8');
  const roles = [...page.matchAll(/<p class="cs-hero__role[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  if (roles.length !== 1) {
    failures.push(`[claim] ${slug}: the hero must carry one "My role" line (found ${roles.length})`);
    continue;
  }
  const label = textOf((roles[0].match(/^\s*<strong\b[^>]*>([\s\S]*?)<\/strong>/) || [, ''])[1]);
  const role = textOf(roles[0].replace(/^\s*<strong\b[^>]*>[\s\S]*?<\/strong>/, ''));
  if (label !== 'My role:') failures.push(`[claim] ${slug}: the role line must open with a bold "My role:" (found "${label}")`);
  if (!role || role.split(' ').length > 22 || !role.endsWith('.')) failures.push(`[claim] ${slug}: the role line must be one compact list of responsibilities (${role.split(' ').length} words)`);
  for (const [re, what] of [[/strateg/i, 'strategy'], [/brief/i, 'briefing'], [/approv/i, 'approval'], [/distribut|publish/i, 'distribution or publishing']]) {
    if (!re.test(role)) failures.push(`[claim] ${slug}: the role line must name ${what}`);
  }
  if (/graphic design|\bdesigned\b|\bdesigner\b|illustrat|\banimat/i.test(role)) failures.push(`[claim] ${slug}: the role line must not imply John was the hands-on designer`);
  if (page.indexOf('cs-hero__intro') < 0 || page.indexOf('cs-hero__role') < page.indexOf('cs-hero__intro')) failures.push(`[claim] ${slug}: the role line must follow the intro`);
  if ((textOf(page.replace(/<script\b[\s\S]*?<\/script>/g, '')).match(/My role/g) || []).length !== 1) failures.push(`[claim] ${slug}: "My role" must appear once on the page`);
}

// ------------------------------------------------ Technical Product Marketing
// Version 1.5 (John's TPM V1.1 to V1.4 briefs, the V1.2 delta and the
// Combined Build Brief, October 12 to 14, 2026): the case study's own page
// through 01 Hero, 02 Foundation, 03 the transitional statement, 04 Website,
// 05 Technical documentation, 06 the flagship animation campaign and 07 the
// conclusion, then Contact and the footer (Selected Writing, added in V1.3,
// was taken out in V1.4). Copy is checked word for word against the briefs
// and the approved concept.
const tpmPage = fs.readFileSync(path.join(dist, 'work/technical-marketing/index.html'), 'utf8');
const tpmData = JSON.parse(fs.readFileSync(path.join(root, 'src/data/tpm.json'), 'utf8'));
const norm = (t) => (t || '').replace(/[‘’]/g, "'");
const tpmText = (re) => textOf(norm(((tpmPage.match(re) || [, ''])[1] || '')));
// Text with a space at every tag, for runs of separate elements.
const spaced = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
// A scoped rule's selector, with Astro's data-astro-cid attributes taken out.
const bare = (sel) => sel.replace(/\[data-astro-cid-[^\]]*\]/g, '').replace(/:where\([^)]*\)/g, '');
const tpmRules = (re) => CSS_RULES.filter((r) => re.test(bare(r.sel)));
// The body of one @keyframes block.
const keyframesOf = (name) => (cssText.replace(/\/\*[\s\S]*?\*\//g, '').match(new RegExp(`@keyframes ${name}\\s*\\{((?:[^{}]*\\{[^{}]*\\})*)[^{}]*\\}`)) || [, ''])[1];
const TPM = {
  headline: 'Building the system behind the message.',
  copy: "I built the strategic foundation that turned Bolt Liquidity's technical complexity into a clear market narrative, then carried it across documentation, web experiences, articles, and campaigns.",
  scope: ['Research', 'Positioning', 'Messaging', 'Claims Governance', 'Technical Documentation', 'Web Content', 'Campaign Direction'],
  foundationLines: ['Before the message', 'comes the foundation.'],
  foundationCopy: ['Before a product can be explained externally, it needs a shared internal language.', 'For Bolt Liquidity, I built that language from stakeholder interviews and product research, shaping the positioning, claims, proof points, and narrative architecture behind every public-facing expression.'],
  statement: 'Once the product language is clear, it guides every expression that follows: the website, technical documentation, articles, campaigns, and content that bring the product to market.',
};
if (/class="cs-hero[\s"_]/.test(tpmPage)) failures.push('[tpm] the page must not use the shared case-study hero (cs-hero)');

// ---- 01 Hero (V1.6): an asymmetrical split. The section label, then the
// headline (always two lines, sized to its column) and the paragraph on the
// left; on the right, in open space, the isometric system; the seven scope
// terms in one centered line beneath the split, on a fine rule (wrapping,
// still centered, only on narrow screens), the three composed as one group
// in the first screen. No media; the headline never changes. Leaving the hero
// (the live choreography only), the Foundation's full-width surface rises
// over it, its leading edge slightly rounded, as the hero's content fades and
// softens a little and the Foundation headline fades up 24 to 40px: a layered
// reveal within about 0.8 to 1.2 viewports, nothing passing from one section
// to the other (V1.3, unchanged).
const HERO_LABEL = '02 / Technical Product Marketing';
if (tpmText(/<p class="tpm-hero__label[^"]*"[^>]*>([\s\S]*?)<\/p>/) !== HERO_LABEL || tpmData.hero?.label !== HERO_LABEL) failures.push(`[tpm] the hero opens with its section label, ${HERO_LABEL}`);
if (!tpmRules(/^\.tpm-hero__label$/).some((r) => /text-transform:\s*uppercase/.test(r.body))) failures.push('[tpm] the section label is set in capitals, as the brief writes it');
if (/tpm-hero__kicker/.test(tpmPage)) failures.push('[tpm] the label is the section label, not a kicker');
if (tpmText(/<h1 id="tpm-title"[^>]*>([\s\S]*?)<\/h1>/) !== TPM.headline) failures.push(`[tpm] the headline must read "${TPM.headline}"`);
if (tpmText(/<p class="lede tpm-hero__lede[^"]*"[^>]*>([\s\S]*?)<\/p>/) !== TPM.copy) failures.push('[tpm] the hero must carry the approved supporting sentence');
const scopeItems = [...((tpmPage.match(/<ul class="tpm-hero__scope[\s\S]*?<\/ul>/) || [''])[0]).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => textOf(m[1]));
if (scopeItems.join(' · ') !== TPM.scope.join(' · ')) failures.push(`[tpm] the scope line must be all seven areas, ${TPM.scope.join(' · ')} (found ${scopeItems.join(' · ')})`);
if ((textOf(tpmPage.replace(/<script\b[\s\S]*?<\/script>/g, '')).match(/My role/g) || []).length) failures.push('[tpm] the redesigned page carries no "My role" line');
const tpmHeroHtml = (tpmPage.match(/<section class="tpm-hero"[\s\S]*?<\/section>/) || [''])[0];
if (!tpmHeroHtml) failures.push('[tpm] the page opens with its own hero');
if (/<(?:video|img|picture|iframe|canvas)\b|data-loop-toggle|tpm-screen/.test(tpmHeroHtml)) failures.push('[tpm] the hero has no media and no canvas (the animation plays in full in 06)');
const assetIds = (JSON.parse(fs.readFileSync(path.join(root, 'src/data/assets.json'), 'utf8')).assets || []).map((a) => a.id);
if (/bolt-in-60-seconds-hero/.test(tpmPage) || assetIds.includes('tm-bolt-60-loop')) failures.push('[tpm] the short hero loop and its poster are gone from the page and the manifest');
for (const gone of ['public/media/bolt-in-60-seconds-hero-loop.mp4', 'public/media/bolt-in-60-seconds-hero-loop-720.mp4', 'src/assets/technical-marketing/bolt-in-60-seconds-hero-poster.jpg']) {
  if (fs.existsSync(path.join(root, gone))) failures.push(`[tpm] ${gone} is no longer used and is removed`);
}
// The label, the headline and the paragraph together in the copy column,
// before the visual; the scope line after the split, its own row of the
// stage (not in the copy column), centered, one line on wide screens.
const heroCopyAt = tpmHeroHtml.indexOf('class="tpm-hero__copy');
const heroVisualAt = tpmHeroHtml.indexOf('class="tpm-hero__visual');
const heroCopyHtml = heroCopyAt < 0 || heroVisualAt < 0 ? '' : tpmHeroHtml.slice(heroCopyAt, heroVisualAt);
if (!heroCopyHtml || !/class="tpm-hero__label/.test(heroCopyHtml) || !/<h1 id="tpm-title"/.test(heroCopyHtml) || !/tpm-hero__lede/.test(heroCopyHtml) || /tpm-hero__scope/.test(heroCopyHtml) || heroCopyHtml.indexOf('tpm-hero__label') > heroCopyHtml.indexOf('<h1')) failures.push('[tpm] the label, the headline and the paragraph sit together in the copy column, in that order, before the visual; the scope is not in it');
// Two lines, always: broken after "the system", each line unbroken, the size
// V1.5's or less where the column is too narrow for the first line.
const heroLines = (((tpmPage.match(/<h1 id="tpm-title"[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1]).split(/<span class="tpm-hero__line"[^>]*>/).slice(1)).map((chunk) => textOf(norm(chunk)));
if (JSON.stringify(heroLines) !== JSON.stringify(['Building the system', 'behind the message.']) || tpmData.hero?.break !== 'the system') failures.push(`[tpm] the headline sets in two lines, Building the system / behind the message. (found ${heroLines.join(' / ')})`);
if (!tpmRules(/^\.tpm-hero__line$/).some((r) => /display:\s*block/.test(r.body) && /white-space:\s*nowrap/.test(r.body))) failures.push('[tpm] each line of the headline is its own unbroken line');
if (!tpmRules(/^\.tpm-hero__title$/).some((r) => /font-size:\s*min\(clamp\(2\.5rem,\s*1rem \+ 3\.6vw,\s*5rem\),\s*[\d.]+cqi\)/.test(r.body)) || !tpmRules(/^\.tpm-hero__copy$/).some((r) => /container-type:\s*inline-size/.test(r.body))) failures.push('[tpm] the headline is V1.5\'s size, or smaller where its column is too narrow for the first line');
const heroStageAt = tpmHeroHtml.indexOf('<div class="tpm-hero__stage');
const heroRailAt = tpmHeroHtml.indexOf('<div class="container tpm-hero__rail');
const heroScopeAt = tpmHeroHtml.indexOf('<ul class="tpm-hero__scope');
const divDepth = (html) => (html.match(/<div\b/g) || []).length - (html.match(/<\/div>/g) || []).length;
if (heroStageAt < 0 || heroRailAt < heroVisualAt || heroScopeAt < heroRailAt || divDepth(tpmHeroHtml.slice(heroStageAt, heroRailAt)) !== 1 || divDepth(tpmHeroHtml.slice(heroRailAt, heroScopeAt)) !== 1) failures.push('[tpm] the scope line sits beneath the split, in its own row of the stage');
const stageRest = tpmRules(/^\.tpm-hero__stage$/).filter((r) => !r.at).map((r) => r.body).join(';');
if (!/align-content:\s*center/.test(stageRest) || !/row-gap:\s*clamp\(/.test(stageRest) || /grid-template-rows:\s*1fr\s+auto/.test(stageRest)) failures.push('[tpm] the split and the scope line are composed as one group, centered in the first screen (V1.6: the line no longer stranded at the foot)');
const railRule = tpmRules(/^\.tpm-hero__rail$/).filter((r) => !r.at).map((r) => r.body).join(';');
const scopeRule = tpmRules(/^\.tpm-hero__scope$/).filter((r) => !r.at).map((r) => r.body).join(';');
if (!/text-align:\s*center/.test(scopeRule) || !/justify-items:\s*center/.test(railRule)) failures.push('[tpm] the scope line is centered, wrapped or not');
if (!tpmRules(/^\.tpm-hero__scope$/).some((r) => DESKTOP.test(r.at) && /white-space:\s*nowrap/.test(r.body))) failures.push('[tpm] on wide screens the scope is one line');
if (!tpmRules(/^\.tpm-hero__scope li$/).some((r) => /white-space:\s*nowrap/.test(r.body))) failures.push('[tpm] a scope term never breaks inside itself when the line wraps');
// The companion pass: on large desktops the scope line sits 24 to 32px lower,
// moved alone (a translate), so the split above keeps its place.
const railDrop = tpmRules(/^\.tpm-hero__rail$/).find((r) => /min-width:\s*75rem|width\s*>=\s*75rem/.test(r.at) && /translate:/.test(r.body));
const dropRange = railDrop && (railDrop.body.match(/translate:\s*0\s+clamp\(([\d.]+)rem,\s*[\d.]+vw,\s*([\d.]+)rem\)/) || []).slice(1).map((v) => Number(v) * 16);
if (!railDrop || !dropRange || dropRange[0] !== 24 || dropRange[1] !== 32 || !/min-height:\s*46rem|height\s*>=\s*46rem/.test(railDrop.at)) failures.push(`[tpm] on large desktops the scope line sits 24 to 32px lower, alone (found ${dropRange ? dropRange.join(' to ') + 'px' : 'none'})`);
if (!tpmRules(/^\.tpm-hero__rail::?before,\s*\.tpm-hero__rail::?after$/).some((r) => /min-width:\s*88rem|width\s*>=\s*88rem/.test(r.at) && /height:\s*1px/.test(r.body))) failures.push('[tpm] where there is room, a fine rule runs out from either end of the scope line');
const heroGrid = tpmRules(/^\.tpm-hero__grid$/).filter((r) => DESKTOP.test(r.at)).map((r) => r.body).join(';');
if (!/grid-template-columns:\s*minmax\(0,\s*5fr\)\s*minmax\(0,\s*7fr\)/.test(heroGrid) || !/align-items:\s*center/.test(heroGrid)) failures.push('[tpm] wide screens split the hero asymmetrically, the copy narrower than the system, the two centered on each other');
if (!tpmRules(/^\.tpm-hero__stage$/).some((r) => DESKTOP.test(r.at) && /min-height:\s*var\(--view-h\)/.test(r.body)) || !tpmRules(/^\.tpm-hero__grid$/).some((r) => !r.at && /align-self:\s*center/.test(r.body))) failures.push('[tpm] the hero is the first screen, its split vertically centered in it');
if (/tpm-hero__band|tpm-hero__dusk|\bdata-band\b|tpm-hero__foot/.test(tpmPage)) failures.push('[tpm] the V1.2 bands, rising ground and centered foot are gone: no fragments, strips or morphing between the sections');

// The isometric system (V1.6) replaces the V1.5 Narrative Engine and its
// signal field, which are gone with their modules (as the V1.4 stacked object
// and topographic field before them): a small designed environment on a faint
// grid of its own, research and inputs on the left, the shared product
// language at the center as an architectural foundation (a base and deck,
// blocks, guides and a glass canopy, never an eye, target, circular core,
// brain, orb or hub), the public-facing expressions on the right, joined by
// conduits in the floor.
if (/class="[^"]*\btpm-(?:system|object|layer|field|signal)\b|data-system-|data-field-(?:drift|light|lit)|data-tpm-field|data-engine\b|class="nx\b|class="nx__/.test(tpmPage)) failures.push('[tpm] the V1.4 object and field and the V1.5 engine and signal field are gone from the page');
for (const gone of ['src/lib/tpm-system.ts', 'src/lib/tpm-field.ts', 'src/lib/tpm-engine.ts', 'src/lib/tpm-signal.ts']) if (fs.existsSync(path.join(root, gone))) failures.push(`[tpm] ${gone} is no longer used and is removed`);
if (!fs.existsSync(path.join(root, 'src/lib/tpm-iso.ts'))) failures.push('[tpm] the system is drawn by src/lib/tpm-iso.ts');
const SYSTEM = tpmData.hero?.system || {};
const SYS_KEYS = ['interviews', 'research', 'documents', 'core', 'website', 'documentation', 'campaigns'];
const SYS_WORDS = SYS_KEYS.map((k) => (SYSTEM.labels || {})[k]);
// The Events V1.1 brief's companion pass renamed the third input ANALYSIS (its node, icon and place unchanged).
if (JSON.stringify(SYS_WORDS) !== JSON.stringify(['Interviews', 'Research', 'Analysis', 'Shared product language', 'Website', 'Documentation', 'Campaigns']) || tpmData.hero?.engine) failures.push('[tpm] tpm.json carries the system\'s seven words, the third input ANALYSIS (and no V1.5 engine block)');
const isoAt = tpmHeroHtml.indexOf('<div class="iso"');
const isoHtml = isoAt < 0 ? '' : tpmHeroHtml.slice(isoAt, tpmHeroHtml.indexOf('<button', isoAt));
const isoScene = (isoHtml.match(/<div class="iso__scene"[^>]*>/) || [''])[0];
if (!isoScene || !/role="img"/.test(isoScene) || decode((isoScene.match(/aria-label="([^"]*)"/) || [, ''])[1]) !== SYSTEM.description) failures.push('[tpm] the drawing is one image to assistive technology, described in tpm.json\'s words');
const isoParts = [...isoHtml.matchAll(/<div class="iso__part iso__part--(in|core|out)[^"]*"[^>]*data-part="([\w-]+)"[^>]*style="([^"]*)"/g)].map((m) => ({ group: m[1], id: m[2], style: m[3] }));
const partIds = isoParts.map((p) => p.id);
const needParts = ['in-interviews', 'in-research', 'in-documents', 'core-base', 'core-canopy', 'core-guide-back', 'core-guide-left', 'core-guide-right', 'core-guide-front', 'out-website', 'out-documentation', 'out-campaigns', ...[0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => `core-block-${i}${j}`))];
if (needParts.some((id) => !partIds.includes(id))) failures.push(`[tpm] the system has its three inputs, its foundation (base, nine blocks, four guides, the canopy) and its three expressions (missing ${needParts.filter((id) => !partIds.includes(id)).join(', ')})`);
if (partIds.indexOf('core-guide-front') < Math.max(...partIds.filter((id) => id.startsWith('core-block-')).map((id) => partIds.indexOf(id))) || partIds.indexOf('core-canopy') < partIds.indexOf('core-guide-front') || partIds.findIndex((id) => id.startsWith('out-') && !id.endsWith('-shadow')) < partIds.indexOf('core-canopy') || partIds.findIndex((id) => id.endsWith('-shadow')) !== 0) failures.push('[tpm] the parts are drawn back to front: shadows, inputs, the foundation (its front guide over the blocks, then the canopy), the expressions');
const corePartsHtml = [...isoHtml.matchAll(/<div class="iso__part iso__part--core[\s\S]*?(?=<div class="iso__part |<\/div>\s*<ul class="iso__labels)/g)].map((m) => m[0]).join('');
if (!corePartsHtml || /<circle\b|<ellipse\b|radialGradient|<text\b|<image\b|<foreignObject\b/.test(corePartsHtml)) failures.push('[tpm] the foundation is an architecture of planes and blocks: no circles, orbs, glows or words drawn into it');
if (/<text\b|<foreignObject\b|<image\b/.test(isoHtml)) failures.push('[tpm] the system draws no words: its labels are page text');
// The assembly: once, from the first paint, in about 2.5 to 4 seconds; the
// idle cycle starts after it; every movement is a transform or opacity of an
// HTML box, with motion allowed only.
const sNum = (style, name) => Number((style.match(new RegExp(`--${name}:\\s*(-?[\\d.]+)`)) || [])[1]);
const assemblyEnd = Math.max(...isoParts.map((p) => sNum(p.style, 'd') + sNum(p.style, 'dur')));
const isoVars = (isoHtml.match(/<div class="iso"[^>]*style="([^"]*)"/) || [, ''])[1];
const litEnd = sNum(isoVars, 'lit-at') + sNum(isoVars, 'lit-dur');
if (!(assemblyEnd >= 2.5 && assemblyEnd <= 4) || !(litEnd <= 4.6) || !(sNum(isoVars, 'idle') >= assemblyEnd)) failures.push(`[tpm] the system assembles once in about 2.5 to 4 seconds and settles before its idle life begins (parts by ${assemblyEnd}s, the light by ${litEnd}s, idle at ${sNum(isoVars, 'idle')}s)`);
if (!(sNum(isoVars, 'cycle') >= 10) || !(sNum(isoVars, 'cycle') <= 13) || !(sNum(isoVars, 'hcycle') >= 2.5)) failures.push(`[tpm] the idle cycle is calm but perceptible (a signal every 3.3 to 4.3 seconds, the cycle 10 to 13 seconds; found ${sNum(isoVars, 'cycle')}), the engaged one controlled`);
// The companion pass: the shared product language breathes, slowly and faintly,
// on its own clock (its glass brightens and settles); nothing floats as a whole.
const canopyPart = (isoHtml.match(/<div class="iso__part iso__part--core[^"]*"[^>]*data-part="core-canopy"[\s\S]*?(?=<div class="iso__part )/) || [''])[0];
const breathRule = tpmRules(/^\.iso__breath$/).find((r) => MOTION_OK.test(r.at) && /animation:\s*iso-breathe\b/.test(r.body));
const breathPeak = Math.max(...[...keyframesOf('iso-breathe').matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1])));
if (!/class="iso__fill iso__breath"/.test(canopyPart) || (isoHtml.match(/class="iso__fill iso__breath"/g) || []).length !== 1 || !breathRule || !(sNum(isoVars, 'breath') >= 5) || !(breathPeak > 0.2 && breathPeak <= 0.5)) failures.push(`[tpm] the shared product language breathes, slowly (5 seconds or more) and faintly (found a peak of ${breathPeak})`);
if (!tpmRules(/^\.iso__breath$/).some((r) => !r.at && /opacity:\s*0\b/.test(r.body)) && !tpmRules(/\.iso__breath/).some((r) => !r.at && /opacity:\s*0\b/.test(r.body))) failures.push('[tpm] at rest (reduced motion) the breath is not shown');
if (/class="iso"[^>]*\bdata-float\b/.test(isoHtml) || tpmRules(/^\.iso(?:__scene)?$/).some((r) => /(?:^|;)\s*animation:/.test(r.body))) failures.push('[tpm] the illustration never floats, bobs or turns as a whole');
const floats = isoParts.map((p) => sNum(p.style, 'fl')).filter((v) => v > 0);
if (!floats.length || floats.some((v) => v > 0.4)) failures.push(`[tpm] at rest only a few parts drift, and only a pixel or two (found ${floats.join(', ')} cqw)`);
for (const k of ['iso-in', 'iso-grow', 'iso-fade', 'iso-float', 'iso-flash', 'iso-draw']) if (!keyframesOf(k)) failures.push(`[tpm] the system's ${k} keyframes are missing`);
if (/rotate|scale\(/.test(keyframesOf('iso-in') + keyframesOf('iso-float'))) failures.push('[tpm] nothing in the system spins or swells: parts rise, settle and drift');
const tpmHead = (tpmPage.match(/<head>[\s\S]*?<\/head>/) || [''])[0];
const isoSparks = [...tpmHead.matchAll(/@keyframes (iso-s-[\w-]+)/g)].length;
const isoHoverSparks = [...tpmHead.matchAll(/@keyframes (iso-h-[\w-]+)/g)].length;
const isoGlows = [...tpmHead.matchAll(/@keyframes (iso-g-[\w-]+)/g)].length;
if (isoSparks !== 9 || isoHoverSparks !== 9 || isoGlows < 6 || !/@keyframes iso-lit-run/.test(tpmHead)) failures.push(`[tpm] the signals' and lights' keyframes (made with the geometry) are in the head: nine stretches of conduit each way, the lit blocks and plinths (found ${isoSparks}, ${isoHoverSparks}, ${isoGlows})`);
const isoAnimated = tpmRules(/\.iso/).filter((r) => /(?:^|;)\s*animation:/.test(r.body) && !/animation:\s*none/.test(r.body));
if (!isoAnimated.length || isoAnimated.some((r) => !MOTION_OK.test(r.at))) failures.push('[tpm] the system moves only with motion allowed');
if (isoAnimated.some((r) => /\b(?:svg|path|g|rect|circle)\b/.test(bare(r.sel).replace(/\.iso__lit path$/, '')))) failures.push('[tpm] the system\'s movements are on HTML boxes (the compositor runs them alone), never inside its drawings, save the light\'s one run along the conduits');
if (isoAnimated.some((r) => (r.body.match(/(?:^|;)\s*animation:[^;]*/) || [''])[0].replace(/\([^()]*\)/g, '').split(',').length > 1)) failures.push('[tpm] one movement to an element, so every one of them stays on the compositor');
if (!tpmRules(/\.iso:is\(\.is-asleep,\s*\.is-held\)/).some((r) => /animation-play-state:\s*paused/.test(r.body)) || !tpmRules(/^\.iso\.is-held :is\(/).some((r) => /animation:\s*none/.test(r.body))) failures.push('[tpm] off screen the system holds still; under the rising Foundation its idle life stops');
// Engaged (the pointer over the system itself, a tap, or the control): the
// layers separate, the conduits light, the signals run faster, seven short
// labels arrive; leaving, it settles calmly. On a phone the labels give way
// to a small legend beneath it.
if (!tpmRules(/^\.iso\.is-open \.iso__part,\s*\.iso\.is-open \.iso__label--core$/).some((r) => MOTION_OK.test(r.at) && /translate:\s*0 calc\(var\(--lift\)\s*\*\s*-1cqw\)/.test(r.body) && /transition:\s*translate/.test(r.body)) || !tpmRules(/^\.iso__part$/).some((r) => !r.at && /transition:\s*translate/.test(r.body))) failures.push('[tpm] engaged, the layers separate and settle back by transitions, controlled, never snapping');
if (!tpmRules(/^\.iso\.is-open \.iso__part--guide$/).some((r) => /scale:\s*1 var\(--st\)/.test(r.body))) failures.push('[tpm] the guides stretch with the rising canopy');
if (!tpmRules(/^\.iso\.is-open \.iso__lit$/).some((r) => /opacity:\s*0?\.[5-9]/.test(r.body)) || !tpmRules(/^\.iso\.is-flow \.iso__pulses--hover \.iso__spark$/).some((r) => /var\(--hcycle\)/.test(r.body))) failures.push('[tpm] engaged, the conduits light and the signals run faster');
const isoLabels = [...((isoHtml.match(/<ul class="iso__labels"[\s\S]*?<\/ul>/) || [''])[0]).matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => textOf(m[0]));
const isoLegend = [...((tpmHeroHtml.match(/<ul class="iso-legend"[\s\S]*?<\/ul>/) || [''])[0]).matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => textOf(m[0]));
if (JSON.stringify(isoLabels) !== JSON.stringify(SYS_WORDS) || JSON.stringify(isoLegend) !== JSON.stringify(SYS_WORDS)) failures.push(`[tpm] seven concise labels, inputs, the foundation and the expressions in order, in the drawing and in the phone's legend (found ${isoLabels.join(', ')})`);
const labelsRest = tpmRules(/^\.iso__labels$/).filter((r) => !r.at).map((r) => r.body).join(';');
if (!/visibility:\s*hidden/.test(labelsRest) || !/pointer-events:\s*none/.test(labelsRest) || !tpmRules(/^\.iso\.is-open \.iso__labels$/).some((r) => /visibility:\s*visible/.test(r.body)) || !tpmRules(/^\.iso__word$/).some((r) => /opacity:\s*0\b/.test(r.body))) failures.push('[tpm] at rest no labels surround the system; engaged, they arrive');
if (!tpmRules(/^\.iso-legend$/).some((r) => !r.at && /display:\s*none/.test(r.body)) || !tpmRules(/^\.iso-legend$/).some((r) => /max-width:\s*37\.49rem|width\s*<=\s*37\.49rem/.test(r.at) && /display:\s*grid/.test(r.body) && /visibility:\s*hidden/.test(r.body)) || !tpmRules(/^\.iso\.is-open\s*~\s*\.iso-legend$/).some((r) => /visibility:\s*visible/.test(r.body))) failures.push('[tpm] on a phone the labels give way to a legend beneath the system, its room kept, shown while engaged');
// Only direct engagement: the pointer's area is the outline of the system at
// rest (its whole box once open); never the rest of the hero or the page.
const isoHit = (isoHtml.match(/<div class="iso__hit"[^>]*>/) || [''])[0];
if (!/aria-hidden="true"/.test(isoHit) || !/clip-path:\s*polygon\(/.test(isoHit) || !tpmRules(/^\.iso\.is-open \.iso__hit$/).some((r) => /clip-path:\s*inset\(0\)/.test(r.body))) failures.push('[tpm] the system answers only to a pointer over its own outline');
const heroButtons = [...tpmHeroHtml.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]);
const toggleTag = (heroButtons[0] || '').match(/<button\b[^>]*>/)?.[0] || '';
if (heroButtons.length !== 1 || !/\bdata-iso-toggle\b/.test(toggleTag) || !/type="button"/.test(toggleTag) || !/aria-expanded="false"/.test(toggleTag) || !/aria-controls="tpm-iso-labels tpm-iso-legend"/.test(toggleTag) || !/<ul class="iso__labels"[^>]*id="tpm-iso-labels"/.test(isoHtml) || !/<ul class="iso-legend"[^>]*id="tpm-iso-legend"/.test(tpmHeroHtml)) failures.push('[tpm] the hero has one control, the system\'s own: a button that says whether its parts are shown and names what it shows');
const toggleWords = [...(heroButtons[0] || '').matchAll(/<span data-iso-(?:show|hide)[^>]*>([\s\S]*?)<\/span>/g)].map((m) => textOf(norm(m[1])));
if (JSON.stringify(toggleWords) !== JSON.stringify([norm(SYSTEM.toggle?.show), norm(SYSTEM.toggle?.hide)]) || !toggleWords[0]) failures.push(`[tpm] the control reads "${SYSTEM.toggle?.show}" and, open, "${SYSTEM.toggle?.hide}"`);
if (!tpmRules(/^\.iso__toggle:not\(:focus-visible\)$/).some((r) => /hover:\s*hover/.test(r.at) && /clip-path:\s*inset\(50%\)/.test(r.body)) || !tpmRules(/^\.iso__toggle$/).some((r) => /hover:\s*none/.test(r.at) && /position:\s*static/.test(r.body))) failures.push('[tpm] with a mouse the control is out of sight until keyboard focus reaches it; on touch screens it stays in view');
// Without JavaScript, hover or focus opens it; reduced motion keeps every
// movement out (the media query above) and shows it complete.
if (!tpmRules(/^html:not\(\.js\) \.iso:is\(:hover,\s*:focus-within\) \.iso__labels$/).some((r) => /visibility:\s*visible/.test(r.body))) failures.push('[tpm] without JavaScript the system opens on hover or focus');
// A grid of its own, local to the drawing and faded at its edges; no
// topographic background and nothing that follows the pointer across the page.
const isoFloor = (isoHtml.match(/<div class="iso__layer iso__floor"[\s\S]*?<\/svg>/) || [''])[0];
if (!/<radialGradient id="iso-grid-fade"/.test(isoFloor) || !/stroke="url\(#iso-grid-fade\)"/.test(isoFloor) || !tpmRules(/^\.iso__floor \.iso__art$/).some((r) => /overflow:\s*hidden/.test(r.body))) failures.push('[tpm] the grid beneath the system is faint, local to it and fading at its edges');
// One accent in the headline, one emphasis in the paragraph (V1.3).
const accentsIn = (html) => [...html.matchAll(/<span class="tpm-accent"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => textOf(norm(m[1])));
const emsIn = (html) => [...html.matchAll(/<strong class="tpm-em"[^>]*>([\s\S]*?)<\/strong>/g)].map((m) => textOf(norm(m[1])));
const heroH1 = (tpmPage.match(/<h1 id="tpm-title"[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1];
if (JSON.stringify(accentsIn(heroH1)) !== JSON.stringify(['the system']) || /</.test(heroH1.replace(/<span class="(?:tpm-accent|tpm-hero__line)"[^>]*>|<\/span>/g, ''))) failures.push('[tpm] the hero headline sets "the system" in the accent, and nothing else in it moves or changes');
const heroLede = (tpmPage.match(/<p class="lede tpm-hero__lede[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1];
if (JSON.stringify(emsIn(heroLede)) !== JSON.stringify(['a clear market narrative'])) failures.push('[tpm] the hero paragraph emphasizes one phrase: a clear market narrative');
if (tpmRules(/^\.tpm-hero__scope/).some((r) => /font-size:\s*(?:clamp|calc|[\d.]+vw)/.test(r.body))) failures.push('[tpm] the scope line never shrinks its type to fit');
// Leaving the hero: one held screen (about 0.8 to 1.2 viewports) while the
// Foundation rises over it.
const heroRun = tpmRules(/^\.tpm-hero\.is-live$/).map((r) => Number((r.body.match(/height:\s*calc\(var\(--view-h\)\s*\*\s*([\d.]+)\)/) || [])[1])).find((v) => v > 0);
if (!(heroRun >= 1.8 && heroRun <= 2.2)) failures.push(`[tpm] leaving the hero takes about 0.8 to 1.2 viewports of scrolling (found ${heroRun ? (heroRun - 1).toFixed(2) : 'none'})`);
if (!tpmRules(/^\.tpm-hero\.is-live$/).some((r) => /margin-bottom:\s*calc\(var\(--view-h\)\s*\*\s*-1\)/.test(r.body))) failures.push('[tpm] the Foundation rises over the held hero: the hero gives its last screen to it');
if (!tpmRules(/^\.tpm-flow\.is-live$/).some((r) => /border-radius:\s*var\(--lead-r,\s*0px\)\s*var\(--lead-r,\s*0px\)\s*0\s*0/.test(r.body))) failures.push('[tpm] the rising surface keeps a slightly rounded leading edge until it settles');
const riseRule = tpmRules(/^\.tpm-flow\.is-live \.tpm-foundation__head\s*>\s*\*?$/).map((r) => r.body).join(';');
const riseBy = Number((riseRule.match(/translate:\s*0\s*calc\(\(1 - var\(--rise,\s*1\)\)\s*\*\s*([\d.]+)px\)/) || [])[1]);
if (!(riseBy >= 24 && riseBy <= 40) || !/opacity:\s*var\(--rise/.test(riseRule)) failures.push(`[tpm] the Foundation headline fades upward 24 to 40px as the surface settles (found ${riseBy || 'none'})`);

// ---- 02 Foundation: a centered two-line opening, then twelve named documents
// in the brief's order (display numbers 00 to 11, not their Linear numbers),
// each with its own accent and its own icon, and one or two blank covers.
const FOUNDATION = [
  ['00', 'Stakeholder Interviews', 'Cross-functional leadership input'],
  ['01', 'Strategic Foundation Brief', 'Product foundations'],
  ['02', 'Target Buyer Analysis', 'Audience and use cases'],
  ['03', 'Market Pain Points Research', 'Market tensions and unmet needs'],
  ['04', 'Target Audience Psychology', 'Motivations and decision drivers'],
  ['05', 'Competitor Analysis', 'Market context and differentiation'],
  ['06', 'Product Positioning', 'Positioning system'],
  ['07', 'Brand Archetype', 'Strategic character'],
  ['08', 'Claims Log', 'Claims and proof'],
  ['09', 'Messaging Hierarchy', 'Messaging architecture'],
  ['10', 'Brand Tone of Voice', 'Verbal expression'],
  ['11', 'Brand Lexicon', 'Language system'],
];
const titleHtml = (tpmPage.match(/<h2 id="tpm-foundation-title"[^>]*>([\s\S]*?)<\/h2>/) || [, ''])[1];
const titleLines = [...titleHtml.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/g)].map((m) => textOf(m[1]));
if (JSON.stringify(titleLines) !== JSON.stringify(TPM.foundationLines)) failures.push(`[tpm] 02 is headed in exactly two lines: ${TPM.foundationLines.join(' / ')} (found ${titleLines.join(' / ')})`);
if (!tpmRules(/^\.tpm-foundation__title\s*>\s*span$/).some((r) => /display:\s*block/.test(r.body) && /white-space:\s*nowrap/.test(r.body))) failures.push('[tpm] each line of the 02 headline is its own unbroken line');
if (!tpmRules(/^\.tpm-foundation__head$/).some((r) => /text-align:\s*center/.test(r.body))) failures.push('[tpm] the 02 opening is centered');
const foundationPs = [...tpmPage.matchAll(/<p class="tpm-foundation__copy[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => textOf(norm(m[1])));
if (JSON.stringify(foundationPs) !== JSON.stringify(TPM.foundationCopy.map(norm))) failures.push('[tpm] 02 carries the approved words in two paragraphs: the first sentence alone, then the rest');
const copiesGap = tpmRules(/^\.tpm-foundation__copies$/).map((r) => r.body).join(';');
if (!/display:\s*grid/.test(copiesGap) || !/gap:\s*clamp\(1\.25rem/.test(copiesGap) || !/justify-items:\s*center/.test(copiesGap)) failures.push('[tpm] the first sentence stands alone with intentional room beneath it, still centered');
// V1.3: "the foundation." in the accent and one phrase of the paragraph
// emphasized. V1.4: the paragraph widened to about 800 to 860px, so on wide
// screens it reads in three even lines.
const foundationH2 = (tpmPage.match(/<h2 id="tpm-foundation-title"[^>]*>([\s\S]*?)<\/h2>/) || [, ''])[1];
if (JSON.stringify(accentsIn(foundationH2)) !== JSON.stringify(['the foundation.'])) failures.push('[tpm] the 02 headline sets "the foundation." in the accent');
const foundationP = (tpmPage.match(/<div class="tpm-foundation__copies[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1];
const foundationFirst = (foundationP.match(/<p\b[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1];
if (JSON.stringify(emsIn(foundationP)) !== JSON.stringify(['a shared internal language']) || JSON.stringify(emsIn(foundationFirst)) !== JSON.stringify(['a shared internal language'])) failures.push('[tpm] the 02 opening emphasizes one phrase, in its first sentence: a shared internal language');
const remOf = (body) => Number((body.match(/max-width:\s*([\d.]+)rem/) || [])[1]);
const measureOk = (rem) => rem * 16 >= 800 && rem * 16 <= 860;
const foundationMeasure = tpmRules(/^\.tpm-foundation__copy$/).map((r) => remOf(r.body)).find((v) => v > 0);
if (!measureOk(foundationMeasure)) failures.push(`[tpm] the 02 paragraph runs to about 800 to 860px (found ${foundationMeasure ? foundationMeasure * 16 : 'none'}px)`);
if (!tpmRules(/^\.tpm-foundation__copy$/).some((r) => DESKTOP.test(r.at) && /text-wrap:\s*balance/.test(r.body))) failures.push('[tpm] on wide screens the 02 paragraph balances its lines, with no short last line');
const docItems = [...tpmPage.matchAll(/<li class="tpm-doc"[\s\S]*?<\/li>/g)].map((m) => m[0]);
const docRows = docItems.map((li) => [
  textOf((li.match(/<span class="tpm-doc__num[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [, ''])[1]),
  textOf((li.match(/<span class="tpm-doc__title[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [, ''])[1]),
  textOf((li.match(/<span class="tpm-doc__sub[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [, ''])[1]),
]);
if (JSON.stringify(docRows) !== JSON.stringify(FOUNDATION)) failures.push(`[tpm] the library lists the twelve named documents in the brief's order, numbered 00 to 11, with their sublines (found ${docRows.map((r) => r.join(' ')).join(', ')})`);
const pageText = textOf(tpmPage.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, ''));
// (The retired library documents; since V1.5 the hero names its core
// "Shared product language" (V1.6: the system's label for its foundation), so
// that one is checked outside it.)
const pageTextOutsideHero = textOf(tpmPage.replace(/<section class="tpm-hero"[\s\S]*?<\/section>/, '').replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, ''));
for (const gone of ['Invariants', 'Mission Statement', 'Category North Star', 'Brand Manifesto', 'Copy Bank', 'Shared product language']) {
  if (pageTextOutsideHero.includes(gone)) failures.push(`[tpm] "${gone}" is no longer in the library or anywhere outside the hero`);
}
if (/\b(?:six|6)\s+(?:structured\s+)?(?:stakeholder\s+)?interviews\b/i.test(pageText)) failures.push('[tpm] the interview count is not published');
const accents = docItems.map((li) => ((li.match(/--doc:\s*(#[0-9a-f]{6})/i) || [])[1] || '').toLowerCase());
const icons = docItems.map((li) => (li.match(/<svg\b[^>]*class="tpm-doc__icon[\s\S]*?<\/svg>/) || [''])[0].replace(/\s*data-astro-cid-[\w-]+(?:="[^"]*")?/g, ''));
if (new Set(accents).size !== docItems.length || accents.some((c) => !c)) failures.push('[tpm] every named document has its own accent color');
if (new Set(icons.map((s) => (s.match(/\bd="[^"]+"/g) || []).join(''))).size !== docItems.length) failures.push('[tpm] every named document has its own icon');
// The icons (V1.2 delta): one professional outline family, Phosphor's
// Regular weight, one per card, no mixed libraries and nothing constructed;
// the same size, placement and fade on every card (one rule).
const ICONS = ['chats-circle', 'stack', 'user-focus', 'warning-diamond', 'brain', 'binoculars', 'crosshair', 'fingerprint', 'seal-check', 'tree-structure', 'waveform', 'book-open-text'];
const iconNames = icons.map((svg) => (svg.match(/data-icon="([^"]+)"/) || [])[1] || '');
if (JSON.stringify(iconNames) !== JSON.stringify(ICONS)) failures.push(`[tpm] the twelve icons are Phosphor's ${ICONS.join(', ')}, in order (found ${iconNames.join(', ')})`);
if (icons.some((svg) => !/viewBox="0 0 256 256"/.test(svg) || !/fill="currentColor"/.test(svg) || (svg.match(/<path\b/g) || []).length !== 1)) failures.push('[tpm] every icon is one Phosphor outline path on its 256 grid, drawn in its card\'s accent');
if (!tpmRules(/^\.tpm-doc__face \.tpm-doc__icon$/).some((r) => /fill-opacity:\s*0?\.\d+/.test(r.body) && /width:\s*[\d.]+%/.test(r.body))) failures.push('[tpm] one rule sizes, places and fades every icon (through fill-opacity)');
const hexLab = (hex) => {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
accents.forEach((c, i) => {
  if (i && c && accents[i - 1]) {
    const [a, b] = [hexLab(c), hexLab(accents[i - 1])];
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 24) failures.push(`[tpm] documents ${FOUNDATION[i - 1][0]} and ${FOUNDATION[i][0]} sit side by side in too similar accents`);
  }
});
docItems.forEach((li, i) => {
  if (!/<span class="tpm-doc__strip[^"]*"[^>]*aria-hidden="true"/.test(li)) failures.push(`[tpm] document ${FOUNDATION[i]?.[0]} needs its accent strip`);
  if (!/<svg\b[^>]*class="tpm-doc__icon[^"]*"[^>]*aria-hidden="true"/.test(li) && !/<svg\b[^>]*aria-hidden="true"[^>]*class="tpm-doc__icon/.test(li)) failures.push(`[tpm] document ${FOUNDATION[i]?.[0]} needs its faded icon, hidden from assistive technology`);
  const rest = spaced(li);
  if (rest !== docRows[i].join(' ')) failures.push(`[tpm] document ${FOUNDATION[i]?.[0]} shows only its number, title and subline (found "${rest}")`);
});
const covers = [...tpmPage.matchAll(/<li class="tpm-doc tpm-doc--depth"[^>]*>[\s\S]*?<\/li>/g)].map((m) => m[0]);
if (covers.length < 1 || covers.length > 2) failures.push(`[tpm] one or two unlabeled covers follow the named documents (found ${covers.length})`);
if (covers.some((c) => !/aria-hidden="true"/.test(c) || spaced(c) || /<svg\b/.test(c))) failures.push('[tpm] the covers carry no number, title, subline or icon, and are hidden from assistive technology');
// The card grid: a fixed row for the number, a two-line title area, the
// subline in a fixed area at the bottom.
const textRule = tpmRules(/^\.tpm-doc__text$/).find((r) => /grid-template-rows/.test(r.body));
if (!textRule || !/grid-template-rows:\s*[\d.]+rem\s+auto\s+1fr\s+calc\(/.test(textRule.body)) failures.push('[tpm] every card shares one internal grid (number row, title area, open space, subline area)');
const words02 = spaced(((tpmPage.match(/<section class="tpm-foundation"[\s\S]*?<\/section>/) || [''])[0]).replace(/<h2[\s\S]*?<\/h2>/, '').replace(/<span class="tpm-doc__title[^"]*"[^>]*>[\s\S]*?<\/span>/g, '').replace(/<span class="tpm-doc__num[^"]*"[^>]*>[\s\S]*?<\/span>/g, '')).split(' ').filter(Boolean).length;
if (words02 > 80) failures.push(`[tpm] 02 keeps to about 50 to 80 words outside its titles (found ${words02})`);

// ---- 03 the statement: the one block of type, nothing else; read in full by
// assistive technology, revealed word by word on screen.
const stmtHtml = (tpmPage.match(/<div class="tpm-statement"[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
const stmtSr = textOf(norm((stmtHtml.match(/<p class="sr-only"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1]));
// Word by word; a piece split off a word (the colon after the highlighted
// clause, V1.3) is revealed with that word.
const stmtPieces = [...stmtHtml.matchAll(/<span class="tpm-word"([^>]*)>([\s\S]*?)<\/span>/g)].map((m) => ({ text: textOf(m[2]), joined: /\bdata-with-previous\b/.test(m[1]) }));
const stmtWords = stmtPieces.reduce((out, p) => (p.joined && out.length ? [...out.slice(0, -1), out[out.length - 1] + p.text] : [...out, p.text]), []);
if (stmtSr !== TPM.statement) failures.push('[tpm] 03 must carry the statement word for word');
if (stmtWords.join(' ') !== TPM.statement) failures.push('[tpm] 03 reveals the statement word by word, every word in order');
// The page's one animated highlight (V1.3): a restrained translucent teal
// behind the clause on how the shared language guides every expression,
// swept in once the statement is complete; not a marker, no bold, no color.
const markHtml = (stmtHtml.match(/<span class="tpm-mark"[^>]*>((?:\s*<span class="tpm-word"[^>]*>[^<]*<\/span>)*)\s*<\/span>/) || [, ''])[1];
if (spaced(markHtml) !== 'it guides every expression that follows' || norm(tpmData.statement.highlight) !== 'it guides every expression that follows') failures.push(`[tpm] the highlight sits behind "it guides every expression that follows" (found "${spaced(markHtml)}")`);
const markRule = tpmRules(/^\.tpm-mark$/).map((r) => r.body).join(';');
// The muted aqua (#4f918a) at partial opacity, however the minifier writes it.
const markAlpha = (() => {
  const hex = markRule.match(/#4f918a([0-9a-f]{2})\b/i);
  if (hex) return parseInt(hex[1], 16) / 255;
  const rgba = markRule.match(/rgba?\(\s*79[,\s]+145[,\s]+138\s*[,/]\s*(0?\.\d+)\s*\)/);
  return rgba ? Number(rgba[1]) : NaN;
})();
if (!(markAlpha >= 0.2 && markAlpha <= 0.45) || !/background-size:\s*calc\(var\(--sweep\)\s*\*\s*100%\)/.test(markRule) || /font-weight|color:\s*(?!inherit)/.test(markRule.replace(/background[^;]*/g, ''))) failures.push('[tpm] the highlight is a restrained translucent teal band that sweeps in, with no bold or color change');
if ((tpmPage.match(/class="tpm-mark"/g) || []).length !== 1) failures.push('[tpm] the page has one highlight');
if (!/<p class="tpm-statement__copy[^"]*"[^>]*aria-hidden="true"/.test(stmtHtml)) failures.push('[tpm] the word-by-word copy is hidden from assistive technology (the full sentence is read instead)');
if (/<h[1-6]\b|<svg\b|<img\b|<video\b|<li\b|eyebrow/.test(stmtHtml)) failures.push('[tpm] 03 has no eyebrow, heading, cards, icons, diagram or arrow');
if (/tpm-line|tpm-words|tpm-site__/.test(tpmPage)) failures.push('[tpm] the arrow-based Shared Product Language sequence is gone');

// ---- 04 Website and 05 Technical documentation: the name, the metadata row,
// the contribution, then one dominant visual: a walkthrough that plays once.
const caseHtml = (cls) => (tpmPage.match(new RegExp(`<section class="tpm-case ${cls}"[\\s\\S]*?<\\/section>`)) || [''])[0];
const metaOf = (html) => [...html.matchAll(/<div class="tpm-meta__item[^"]*"[^>]*>\s*<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => [textOf(m[1]), [...m[2].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((p) => textOf(norm(p[1])))]);
const expectMeta = (items) => items.map((it) => [it.label, it.value.map((v) => norm(v).replace(/\*\*/g, ''))]);
const walkCheck = (html, what, large, small) => {
  const video = (html.match(/<video\b[\s\S]*?<\/video>/) || [''])[0];
  const tag = (video.match(/<video\b[^>]*>/) || [''])[0];
  for (const attr of ['muted', 'playsinline', 'preload="none"', 'aria-label="']) if (!tag.includes(attr)) failures.push(`[tpm] the ${what} walkthrough is missing ${attr}`);
  if (/\b(?:loop|controls|autoplay)\b|\bposter=/.test(tag)) failures.push(`[tpm] the ${what} walkthrough plays once from its script: no loop, controls, autoplay or poster attribute`);
  const sources = [...video.matchAll(/<source\b[^>]*>/g)].map((m) => m[0]);
  if (sources.length !== 2 || !sources[0].includes(small) || !/media="\(max-width: 47\.99rem\)"/.test(sources[0]) || !sources[1].includes(large) || /\bmedia=/.test(sources[1])) failures.push(`[tpm] the ${what} walkthrough lists the phone encode, then the wide-screen one`);
  const toggle = (html.match(/<button\b[^>]*\bdata-walk-toggle\b[^>]*>/) || [''])[0];
  if (!toggle || !/\bhidden\b/.test(toggle) || !/aria-label="Play video: [^"]+"/.test(toggle)) failures.push(`[tpm] the ${what} walkthrough has one labeled control, hidden until its script runs`);
  if (!/<img\b[^>]*class="tpm-walk__poster"[^>]*loading="lazy"|<img\b[^>]*loading="lazy"[^>]*class="tpm-walk__poster"/.test(html)) failures.push(`[tpm] the ${what} walkthrough sits on a lazy, responsive poster`);
};
const posterAt = (name, w, h, what) => {
  const file = path.join(root, 'src/assets/technical-marketing', name);
  const size = fs.existsSync(file) ? imageSize(file) : null;
  if (!size || size.width !== w || size.height !== h) failures.push(`[tpm] ${what} must be the ${w}x${h} ${name}`);
};
const fileCheck = (name, w, h, mb, [minS, maxS], what) => {
  const file = path.join(root, 'public/media', name);
  if (!fs.existsSync(file)) return failures.push(`[tpm] public/media/${name} not found`);
  const f = mp4Facts(file);
  const sec = mp4Seconds(file);
  const size = fs.statSync(file).size / 1e6;
  if (!(sec >= minS && sec <= maxS)) failures.push(`[tpm] ${name} runs ${sec.toFixed(2)} s; ${what}`);
  if (f.handlers.includes('soun')) failures.push(`[tpm] ${name} carries an audio track`);
  if (!f.avc) failures.push(`[tpm] ${name} must be H.264`);
  if (!(f.top.indexOf('moov') >= 0 && f.top.indexOf('moov') < f.top.indexOf('mdat'))) failures.push(`[tpm] ${name} must keep its index before its data (faststart)`);
  if (f.width !== w || f.height !== h) failures.push(`[tpm] ${name} is ${f.width}x${f.height}; expected ${w}x${h}`);
  if (size > mb) failures.push(`[tpm] ${name} is ${size.toFixed(2)} MB; it stays under ${mb} MB`);
};

const webHtml = caseHtml('tpm-website');
if (!/data-surface="soft"/.test((webHtml.match(/<section\b[^>]*>/) || [''])[0])) failures.push('[tpm] 04 opens its own chapter on its own surface');
if (tpmText(/<h2 id="tpm-website-title"[^>]*>([\s\S]*?)<\/h2>/) !== 'Website') failures.push('[tpm] 04 is named Website');
// The V1.2 delta: Goal, Services and Credits only (as 06 has them), the
// contribution centered beneath them, Bob's name only in the credits.
const WEB_META = [
  ['Goal', ["Translate the company's new positioning into a credible, conversion-focused website."]],
  ['Services', ['Web strategy, information architecture, copywriting, UX direction, and conversion design.']],
  ['Credits', ['Visual design and development: Bob van der Meer.']],
];
const WEB_CONTRIBUTION = 'I mapped the experience from the opening section to the final CTA, wrote the complete website narrative, shaped its scroll behavior and interactions, and defined the partnership journey and form flow. Working closely with design, I guided each revision through a complete rebuild and launch in two weeks.';
if (JSON.stringify(metaOf(webHtml)) !== JSON.stringify(WEB_META) || JSON.stringify(expectMeta(tpmData.website.meta)) !== JSON.stringify(WEB_META)) failures.push(`[tpm] 04 metadata: Goal, Services and Credits, as approved (found ${JSON.stringify(metaOf(webHtml))})`);
if (/Timeline|Location|Brief|Role/.test(spaced(webHtml.replace(/<p class="tpm-case__contribution[\s\S]*?<\/p>/, '')))) failures.push('[tpm] 04 carries no timeline, location, brief or role');
if (!/<strong\b[^>]*>Bob van der Meer<\/strong>\./.test(webHtml)) failures.push('[tpm] the 04 credits name Bob van der Meer in bold, and nothing after his name');
const webP = webHtml.match(/<p class="(tpm-case__contribution[^"]*)"[^>]*>([\s\S]*?)<\/p>/) || [, '', ''];
if (textOf(norm(webP[2])) !== WEB_CONTRIBUTION || norm(tpmData.website.contribution) !== WEB_CONTRIBUTION) failures.push('[tpm] 04 must carry the approved contribution statement');
if (/Bob/.test(webP[2])) failures.push("[tpm] 04 does not repeat Bob's name in the contribution");
if (!/\btpm-case__contribution--center\b/.test(webP[1])) failures.push('[tpm] the 04 contribution is centered beneath the metadata');
if (!/class="tpm-display__body/.test(webHtml) || !/<div class="tpm-display__stand[^"]*"[^>]*aria-hidden="true"/.test(webHtml)) failures.push('[tpm] 04 shows the website in a thin-bezel desktop display');
walkCheck(webHtml, 'website', 'bolt-website-walkthrough.mp4', 'bolt-website-walkthrough-720.mp4');
fileCheck('bolt-website-walkthrough.mp4', 1920, 1080, 10, [46.5, 47.1], 'the approved take runs about 47 s, hero to partnership form, not shortened');
fileCheck('bolt-website-walkthrough-720.mp4', 1280, 720, 4, [46.5, 47.1], 'the approved take runs about 47 s, hero to partnership form, not shortened');
posterAt('bolt-website-walkthrough-poster.jpg', 1920, 1080, 'the website poster (the hero at rest)');
// The live site (V1.3): one quiet button beside the display, never on it,
// at the display's right edge on the line of its foot; it opens a new tab and
// says so to assistive technology.
const liveHtml = (webHtml.match(/<div class="tpm-display__live[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1];
const liveA = (liveHtml.match(/<a\b[^>]*>[\s\S]*?<\/a>/) || [''])[0];
const liveTag = (liveA.match(/<a\b[^>]*>/) || [''])[0];
if (!liveA || !/href="https:\/\/boltliquidity\.io\/"/.test(liveTag) || !/target="_blank"/.test(liveTag) || !/rel="noopener[^"]*"/.test(liveTag) || !/\bbtn--secondary\b/.test(liveTag)) failures.push('[tpm] 04 offers one secondary Visit live site button to boltliquidity.io, in a new tab');
if (textOf(liveA.replace(/<span class="sr-only"[\s\S]*?<\/span>/, '')) !== 'Visit live site' || !/<svg\b/.test(liveA) || !/<span class="sr-only"[^>]*>\s*\(opens [^)]+ in a new tab\)<\/span>/.test(liveA)) failures.push('[tpm] the live-site button reads Visit live site with its external arrow, and tells assistive technology it opens a new tab');
const displayInside = (webHtml.match(/<div class="tpm-display__body[\s\S]*?(?=<div class="tpm-display__stand)/) || [''])[0];
if (!displayInside || /tpm-display__live|Visit live site/.test(displayInside) || webHtml.indexOf('tpm-display__live') < webHtml.indexOf('tpm-display__stand')) failures.push('[tpm] the live-site button sits outside the display, after its stand');
const WIDE48 = /min-width:\s*48rem|width\s*>=\s*48rem/;
if (!tpmRules(/^\.tpm-display__live$/).some((r) => WIDE48.test(r.at) && /position:\s*absolute/.test(r.body) && /right:\s*0\b/.test(r.body) && /bottom:\s*0\b/.test(r.body))) failures.push("[tpm] on wide screens the button lines up with the display's right edge and the foot of its stand");

const docsHtml = caseHtml('tpm-docs');
if (!/data-surface="light-return"/.test((docsHtml.match(/<section\b[^>]*>/) || [''])[0])) failures.push('[tpm] 05 opens its own chapter on its own surface');
if (tpmText(/<h2 id="tpm-docs-title"[^>]*>([\s\S]*?)<\/h2>/) !== 'Technical documentation') failures.push('[tpm] 05 is named Technical documentation');
const DOCS_META = [
  ['Goal', ['Replace fragmented documentation with a clear, connected system for technical audiences while controlling what product information could be made public.']],
  ['Services', ['Documentation strategy, information architecture, technical writing, content governance, and MDX implementation.']],
  ['Credits', ['Visual design and interactive implementation: Bob van der Meer.']],
];
const DOCS_CONTRIBUTION = 'I rebuilt the documentation from the ground up, moving it from a fragmented GitBook into a connected Mintlify system. I owned the architecture, technical writing, cross-references, calls to action, MDX build, and GitHub publishing, working across engineering, growth, and design to make complex product information useful, accurate, and appropriate for public release.';
if (JSON.stringify(metaOf(docsHtml)) !== JSON.stringify(DOCS_META) || JSON.stringify(expectMeta(tpmData.documentation.meta)) !== JSON.stringify(DOCS_META)) failures.push(`[tpm] 05 metadata: Goal, Services and Credits, as approved (found ${JSON.stringify(metaOf(docsHtml))})`);
if (/Timeline|Brief|Role/.test(spaced(docsHtml.replace(/<p class="tpm-case__contribution[\s\S]*?<\/p>/, '')))) failures.push('[tpm] 05 carries no timeline, brief or role');
const docsP = docsHtml.match(/<p class="(tpm-case__contribution[^"]*)"[^>]*>([\s\S]*?)<\/p>/) || [, '', ''];
if (textOf(norm(docsP[2])) !== DOCS_CONTRIBUTION || norm(tpmData.documentation.contribution) !== DOCS_CONTRIBUTION) failures.push('[tpm] 05 must carry the approved contribution statement');
if (/Bob/.test(docsP[2])) failures.push("[tpm] 05 does not repeat Bob's name in the contribution");
if (!/\btpm-case__contribution--center\b/.test(docsP[1])) failures.push('[tpm] the 05 contribution is centered beneath the metadata');
if (/tpm-display/.test(docsHtml) || !/class="tpm-browser\b/.test(docsHtml)) failures.push('[tpm] 05 reads in a frameless browser frame, not a second device');
walkCheck(docsHtml, 'documentation', 'bolt-docs-walkthrough.mp4', 'bolt-docs-walkthrough-720.mp4');
fileCheck('bolt-docs-walkthrough.mp4', 2560, 1440, 9, [28, 35], 'the documentation edit runs 28 to 35 s');
fileCheck('bolt-docs-walkthrough-720.mp4', 1280, 720, 3, [28, 35], 'the documentation edit runs 28 to 35 s');
posterAt('bolt-docs-walkthrough-poster.jpg', 2560, 1440, 'the documentation poster (its home page)');
const chapterItems = [...docsHtml.matchAll(/<li class="tpm-chapter"[^>]*data-start="([\d.]+)"[\s\S]*?<\/li>/g)];
const chapterTitles = chapterItems.map((m) => textOf((m[0].match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [, ''])[1]));
const docsSec = fs.existsSync(path.join(root, 'public/media/bolt-docs-walkthrough.mp4')) ? mp4Seconds(path.join(root, 'public/media/bolt-docs-walkthrough.mp4')) : 0;
const starts = chapterItems.map((m) => Number(m[1]));
if (chapterTitles.join(' | ') !== 'Documentation overview | Interactive architecture | Developer SDK') failures.push(`[tpm] the walkthrough's three chapters are Documentation overview, Interactive architecture and Developer SDK (found ${chapterTitles.join(' | ')})`);
// Introduced as selected views from a broader system: no page count, no
// spotlight.
const chaptersLabel = (docsHtml.match(/<p id="tpm-chapters-label"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1];
if (textOf(chaptersLabel) !== 'Selected views from a broader documentation system' || !/<ol class="tpm-chapters[^"]*"[^>]*aria-labelledby="tpm-chapters-label"/.test(docsHtml)) failures.push('[tpm] the chapters are introduced as "Selected views from a broader documentation system", which also names the list');
if (!tpmRules(/^\.tpm-chapters__label$/).some((r) => /text-align:\s*center/.test(r.body)) || !tpmRules(/^\.tpm-chapters__wrap$/).some((r) => /max-width:\s*90rem/.test(r.body) && /margin:\s*0 auto/.test(r.body)) || !tpmRules(/^\.tpm-browser$/).some((r) => /max-width:\s*90rem/.test(r.body))) failures.push('[tpm] "Selected views from a broader documentation system" is centered on the frame (V1.3)');
if (/\b\d+\s*(?:\+\s*)?pages?\b|Architecture Spotlight/i.test(spaced(docsHtml))) failures.push('[tpm] 05 gives no page count and no Architecture Spotlight');
if (starts[0] !== 0 || starts.some((s, i) => i && s <= starts[i - 1]) || starts.some((s) => s >= docsSec)) failures.push('[tpm] the chapters start at 0 and in order, inside the walkthrough');
if (!(starts[2] - starts[1] >= starts[1] - starts[0] && starts[2] - starts[1] >= docsSec - starts[2])) failures.push('[tpm] the architecture diagram is the longest moment of the walkthrough');
if (chapterItems.some((m) => !/<button\b[^>]*data-seek[^>]*\bhidden\b|<button\b[^>]*\bhidden\b[^>]*data-seek/.test(m[0]))) failures.push('[tpm] each chapter plays from its point with a button that its script reveals');
if (!/Bob van der Meer/.test(chapterItems[1]?.[0] || '')) failures.push('[tpm] the diagram chapter credits Bob van der Meer for its final design and build');

// ---- 06 the flagship animation campaign (V1.2): the headline, then Goal,
// Services and Credits, the contribution centered beneath them (Bob's name
// only in the credits), then the complete film, with its sound, in a large,
// nearly full-width 16:9 frame and no device, and the launch results. The
// film plays silently once in view; "Play with sound" restarts it from 00:00
// with sound, then standard controls take its place; it never loops, and its
// native controls serve readers without scripts. No caption track: every
// spoken line is also on screen (see the manifest's source note).
const campHtml = caseHtml('tpm-campaign');
const CAMP = tpmData.campaign || {};
const campAt = tpmPage.indexOf('class="tpm-case tpm-campaign"');
if (!campHtml) failures.push('[tpm] 06 the flagship animation campaign must follow the documentation');
else {
  if (!(tpmPage.indexOf('class="tpm-case tpm-docs"') < campAt && campAt < tpmPage.indexOf('id="contact"'))) failures.push('[tpm] 06 comes right after 05 Technical documentation, before what follows it');
  if (!/data-surface="dark"/.test((campHtml.match(/<section\b[^>]*>/) || [''])[0])) failures.push('[tpm] 06 plays on the dark ground');
  if (tpmText(/<h2 id="tpm-campaign-title"[^>]*>([\s\S]*?)<\/h2>/) !== 'One minute to make the product clear.') failures.push('[tpm] 06 headline: One minute to make the product clear.');
  const campMeta = [
    ['Goal', ["Create a flagship product explanation that could anchor the brand's X profile, build awareness across the target ecosystem, and direct interest toward the website and technical documentation."]],
    ['Services', ['Campaign concept, narrative strategy, storyboarding, voiceover direction, creative direction, and distribution strategy.']],
    ['Credits', ['Animation and visual production: Bob van der Meer.']],
  ];
  if (JSON.stringify(metaOf(campHtml)) !== JSON.stringify(campMeta) || JSON.stringify(expectMeta(CAMP.meta || [])) !== JSON.stringify(campMeta)) failures.push('[tpm] 06 metadata: Goal, Services and Credits, as approved');
  if (!/<strong\b[^>]*>Bob van der Meer<\/strong>/.test(campHtml)) failures.push('[tpm] the 06 credits name Bob van der Meer in bold');
  const campContribution = 'I conceived the campaign, mapped the one-minute narrative from first frame to final CTA, built the storyboard, and recorded reference voiceover tracks that guided the finished AI-generated narration. I worked closely with design through each revision, then coordinated amplification across partners, ecosystem accounts, and creators.';
  const campP = (campHtml.match(/<p class="(tpm-case__contribution[^"]*)"[^>]*>([\s\S]*?)<\/p>/) || [, '', '']);
  if (textOf(norm(campP[2])) !== campContribution || norm(CAMP.contribution) !== campContribution) failures.push('[tpm] 06 must carry the approved contribution statement');
  if (/Bob/.test(campP[2])) failures.push("[tpm] 06 does not repeat Bob's name in the contribution");
  if (!/\btpm-case__contribution--center\b/.test(campP[1]) || !tpmRules(/^\.tpm-case__contribution--center$/).some((r) => /text-align:\s*center/.test(r.body) && /justify-self:\s*center/.test(r.body))) failures.push('[tpm] the 06 contribution is centered beneath the metadata');
  // The frame: no device, nearly the full width, 16:9, all of it on screen.
  if (/tpm-display|tpm-browser|bezel|phone|device/i.test(campHtml.replace(/<p\b[\s\S]*?<\/p>/g, ''))) failures.push('[tpm] 06 shows the film in a frame, with no device, browser or phone around it');
  const filmW = tpmRules(/^\.tpm-film$/).map((r) => r.body).join(';');
  if (!/width:\s*min\(100% - 2 \* var\(--film-edge\)/.test(filmW) || !/\*\s*16\s*\/\s*9/.test(filmW)) failures.push('[tpm] the film frame runs nearly the full width, held to the screen height at 16:9');
  if (!tpmRules(/^\.tpm-film__screen$/).some((r) => /aspect-ratio:\s*16\s*\/\s*9/.test(r.body))) failures.push('[tpm] the film keeps its native 16:9');
  const film = (campHtml.match(/<video\b[\s\S]*?<\/video>/) || [''])[0];
  const filmTag = (film.match(/<video\b[^>]*>/) || [''])[0];
  for (const attr of ['muted', 'playsinline', 'preload="none"', 'controls', 'aria-label="']) if (!filmTag.includes(attr)) failures.push(`[tpm] the film is missing ${attr}`);
  if (/\b(?:loop|autoplay)\b|\bposter=/.test(filmTag)) failures.push('[tpm] the film plays once from its script: no loop, autoplay or poster attribute');
  if (/<track\b/.test(campHtml) || /transcript/i.test(spaced(campHtml))) failures.push('[tpm] the film carries no captions or transcript on screen (every spoken line is also on screen)');
  const filmSources = [...film.matchAll(/<source\b[^>]*>/g)].map((m) => m[0]);
  if (filmSources.length !== 2 || !filmSources[0].includes('bolt-in-60-seconds-film-720.mp4') || !/media="\(max-width: 47\.99rem\)"/.test(filmSources[0]) || !filmSources[1].includes('bolt-in-60-seconds-film.mp4') || /\bmedia=/.test(filmSources[1])) failures.push('[tpm] the film lists the phone encode, then the wide-screen one');
  if (/bolt-in-60-seconds\.mp4|bolt-in-60-seconds-hero-loop|Hero animation/.test(film)) failures.push('[tpm] the film is the optimized full cut, not the master or the shortened loop');
  if (!/<img\b[^>]*class="tpm-film__poster"[^>]*loading="lazy"|<img\b[^>]*loading="lazy"[^>]*class="tpm-film__poster"/.test(campHtml)) failures.push('[tpm] the film sits on its lazy, responsive poster');
  posterAt('bolt-in-60-seconds-film-poster.png', 1920, 1080, 'the film poster (hero-thumbnail.png)');
  const soundBtn = (campHtml.match(/<button\b[^>]*\bdata-film-sound\b[^>]*>[\s\S]*?<\/button>/) || [''])[0];
  if (!soundBtn || !/\bhidden\b/.test((soundBtn.match(/<button\b[^>]*>/) || [''])[0]) || textOf(soundBtn) !== 'Play with sound' || !/<svg\b[\s\S]*?<path d="M2\.5 6\.25h2\.1L8 3\.25v9\.5L4\.6 9\.75H2\.5zM10\.4/.test(soundBtn)) failures.push('[tpm] the film carries a Play with sound button with a speaker icon and its text label, revealed by its script');
  const controlsHtml = (campHtml.match(/<div class="tpm-film__controls"[\s\S]*?<\/div>/) || [''])[0];
  if (!/\bhidden\b/.test((controlsHtml.match(/<div\b[^>]*>/) || [''])[0]) || [...controlsHtml.matchAll(/<button\b[\s\S]*?<\/button>/g)].map((m) => textOf(m[0])).join(' | ') !== 'Mute | Pause | Replay') failures.push('[tpm] once there is sound, the film has standard controls: mute or unmute, pause, replay');
  if (!tpmRules(/^\.tpm-film__sound$/).some((r) => /background:\s*#f2f1ec/.test(r.body) && /color:\s*var\(--c-ink\)/.test(r.body) && /min-height:\s*2\.75rem/.test(r.body))) failures.push('[tpm] Play with sound is prominent and high-contrast, a full touch target');
  // The files: the complete film with its mix, under a name that is not the master's.
  const filmFile = (name, w, h, mb) => {
    const file = path.join(root, 'public/media', name);
    if (!fs.existsSync(file)) return failures.push(`[tpm] public/media/${name} not found`);
    const f = mp4Facts(file);
    const sec = mp4Seconds(file);
    const size = fs.statSync(file).size / 1e6;
    if (!(sec >= 59.9 && sec <= 60.1)) failures.push(`[tpm] ${name} runs ${sec.toFixed(2)} s; the complete one-minute film`);
    if (!f.handlers.includes('soun')) failures.push(`[tpm] ${name} must keep the film's music, voiceover and sound effects`);
    if (!f.avc) failures.push(`[tpm] ${name} must be H.264`);
    if (!(f.top.indexOf('moov') >= 0 && f.top.indexOf('moov') < f.top.indexOf('mdat'))) failures.push(`[tpm] ${name} must keep its index before its data (faststart)`);
    if (f.width !== w || f.height !== h) failures.push(`[tpm] ${name} is ${f.width}x${f.height}; expected ${w}x${h}`);
    if (size > mb) failures.push(`[tpm] ${name} is ${size.toFixed(2)} MB; it stays under ${mb} MB`);
    if (fs.readFileSync(file).includes('Adobe Premiere')) failures.push(`[tpm] ${name} still carries the editing application's metadata`);
  };
  filmFile('bolt-in-60-seconds-film.mp4', 1920, 1080, 17);
  filmFile('bolt-in-60-seconds-film-720.mp4', 1280, 720, 7);
  // The results: the first 48 hours, four figures and two supporting lines.
  const res = (campHtml.match(/<div class="container tpm-results[\s\S]*$/) || [''])[0];
  if (textOf((res.match(/<h3\b[^>]*class="tpm-results__label"[^>]*>([\s\S]*?)<\/h3>/) || [, ''])[1]) !== 'First 48 hours after launch') failures.push('[tpm] the results are labeled First 48 hours after launch');
  const resItems = [...res.matchAll(/<li class="tpm-results__item"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => {
    const v = (m[1].match(/<span class="tpm-results__value"[^>]*>([\s\S]*?)<\/span>\s*<span class="tpm-results__what/) || [, ''])[1];
    const seen = textOf((v.match(/<span aria-hidden="true"[^>]*>([\s\S]*?)<\/span>/) || [, v])[1]);
    const heard = textOf((v.match(/<span class="sr-only"[^>]*>([\s\S]*?)<\/span>/) || [, ''])[1]);
    return [seen, heard, textOf((m[1].match(/<span class="tpm-results__what"[^>]*>([\s\S]*?)<\/span>\s*$/) || [, ''])[1])];
  });
  const resWant = [['~14%', 'About 14%', 'engagement rate'], ['84%', '', 'of impressions from non-followers'], ['+140%', '', 'website traffic'], ['+153%', '', 'technical-documentation traffic']];
  if (JSON.stringify(resItems) !== JSON.stringify(resWant)) failures.push(`[tpm] the four results, as approved (found ${JSON.stringify(resItems)})`);
  const support = [...res.matchAll(/<ul class="tpm-results__supporting[^"]*"[^>]*>([\s\S]*?)<\/ul>/g)].flatMap((m) => [...m[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((l) => [textOf(l[1]), [...l[1].matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>/g)].map((b) => textOf(b[1]))]));
  // V1.3: the foundation accounts as a group, none of them named.
  if (JSON.stringify(support) !== JSON.stringify([['More than 16x typical post reach', ['16x typical post reach']], ['Recognized and amplified by key ecosystem foundation accounts', ['key ecosystem foundation accounts']]])) failures.push('[tpm] the supporting results: More than 16x typical post reach; Recognized and amplified by key ecosystem foundation accounts');
  if (/\bSui\b|Community Official/.test(spaced(res))) failures.push('[tpm] the results name no ecosystem or account');
  if (/84\s*%[^.<]*engagement|of engagements/i.test(spaced(campHtml))) failures.push('[tpm] the 84% is a share of impressions, never of engagements');
}
// ---- V1.3 across 04, 05 and 06: Goal, Services and Credits in three equal
// columns on wide screens (one column below, never a lone entry on a second
// row), the same in every chapter, labels and first lines aligned; each
// contribution running to its measure rather than balanced shorter, with one
// phrase emphasized. V1.4: that measure widened to about 800 to 860px (about
// 65 to 78 characters a line at their size).
const metaWide = tpmRules(/^\.tpm-meta$/).filter((r) => DESKTOP.test(r.at)).map((r) => r.body).join(';');
if (!/grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/.test(metaWide) || /--meta-columns/.test(cssText) || /--meta-columns/.test(tpmPage)) failures.push('[tpm] the metadata row is three equal columns on wide screens, the same in every chapter');
if (tpmRules(/^\.tpm-meta$/).some((r) => /repeat\(2,/.test(r.body)) || !tpmRules(/^\.tpm-meta$/).some((r) => !r.at && /align-items:\s*start/.test(r.body))) failures.push('[tpm] the metadata row never leaves one entry alone on a second row, and its entries start on one line');
const contributionMeasure = tpmRules(/^\.tpm-case__contribution$/).map((r) => remOf(r.body)).find((v) => v > 0);
if (!measureOk(contributionMeasure)) failures.push(`[tpm] the chapter paragraphs run to about 800 to 860px (found ${contributionMeasure ? contributionMeasure * 16 : 'none'}px)`);
if (tpmRules(/^\.tpm-case__contribution(?:--center)?$/).some((r) => /text-wrap:\s*balance/.test(r.body))) failures.push('[tpm] the chapter paragraphs run to their measure rather than being balanced shorter');
for (const [cls, phrase] of [['tpm-website', 'a complete rebuild and launch in two weeks'], ['tpm-docs', 'useful, accurate, and appropriate for public release'], ['tpm-campaign', 'mapped the one-minute narrative from first frame to final CTA']]) {
  const p = (caseHtml(cls).match(/<p class="tpm-case__contribution[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1];
  if (JSON.stringify(emsIn(p)) !== JSON.stringify([phrase])) failures.push(`[tpm] the ${cls.replace('tpm-', '')} paragraph emphasizes one phrase: ${phrase}`);
}

// ---- Selected Writing (V1.3) was taken out in V1.4, completely: no section,
// no hidden or dormant markup, no excerpts or covers, no scripts or styles of
// its own, and its covers gone from the repository, the manifest and the
// build (the articles may return later on a page of their own; the manifest
// keeps only the original pending placeholder). The campaign leads straight
// into the conclusion.
const tpmAssets = JSON.parse(fs.readFileSync(path.join(root, 'src/data/assets.json'), 'utf8')).assets || [];
if (/tpm-writing|tpm-article|data-article/.test(tpmPage) || /Selected Writing|Missing Price Layer|Billion-Dollar Problem|Liquidity Puzzle/i.test(norm(tpmPage))) failures.push('[tpm] Selected Writing is gone from the page: no section, rows, excerpts or covers');
if (tpmData.writing) failures.push('[tpm] tpm.json carries no writing block');
if (fs.existsSync(path.join(root, 'src/components/tpm/TpmWriting.astro'))) failures.push('[tpm] TpmWriting.astro is removed');
for (const gone of ['article-billion-dollar-problem.png', 'article-missing-price-layer.png']) {
  if (fs.existsSync(path.join(root, 'src/assets/technical-marketing', gone))) failures.push(`[tpm] src/assets/technical-marketing/${gone} is no longer used and is removed`);
}
if (tpmAssets.some((a) => a.page === 'work/technical-marketing' && (a.section === 'writing' || (a.type === 'article' && (a.file || a.permission !== 'pending'))))) failures.push('[tpm] the manifest lists no article cover for the page (the original placeholder stays pending)');
if (files.some((f) => /article-(?:billion-dollar-problem|missing-price-layer)/.test(path.basename(f)))) failures.push('[tpm] the build carries no article covers');
if (CSS_RULES.some((r) => /\.tpm-(?:writing|article)\b/.test(r.sel))) failures.push('[tpm] no styles are left for Selected Writing');
const campEnd = campHtml ? tpmPage.indexOf(campHtml) + campHtml.length : -1;
const conclusionAt = tpmPage.indexOf('<section class="tpm-conclusion"');
// (The campaign's own module script may sit between them; it renders nothing.)
if (campEnd < 0 || conclusionAt < campEnd || tpmPage.slice(campEnd, conclusionAt).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').trim()) failures.push('[tpm] the campaign leads straight into the conclusion, with nothing (not even a spacer) between them');

// ---- 07 the conclusion (V1.3; renumbered and its way on rewritten in V1.4):
// straight after the campaign and before Contact; the approved headline (its
// second sentence in the accent) and paragraph, then one conversational
// sentence leading to the next case study in the collection's order, since
// the Events V1.2 brief inside the case studies' shared way on (below). No
// metrics, services, credits or roles.
// The case studies' shared way on (NextCase, Events V1.2): one understated
// container about as wide as the conclusion's paragraph, the whole of it the
// link: bordered and gently rounded (not a pill), the sentence set left and
// the arrow in a small circle at the right; on hover and keyboard focus only a
// light accent wash and a small arrow movement; a strong focus ring; the
// arrow still with reduced motion.
const nextCaseFailures = (tag) => {
  const out = [];
  const link = tpmRules(/^\.next-case__link$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const radius = Number((link.match(/border-radius:\s*([\d.]+)px/) || [])[1]);
  if (!/border:\s*1px solid/.test(link) || !(radius >= 8 && radius <= 20) || !/display:\s*flex/.test(link) || !/justify-content:\s*space-between/.test(link) || !/text-align:\s*left/.test(link)) out.push(`${tag} the way on is one bordered, gently rounded container (not a pill), the sentence set left and the arrow at the right`);
  const go = tpmRules(/^\.next-case__go$/).filter((r) => !r.at).map((r) => r.body).join(';');
  if (!/border-radius:\s*50%/.test(go) || !/border:\s*1px solid/.test(go)) out.push(`${tag} the arrow sits in a small circle`);
  const hover = tpmRules(/^\.next-case__link:hover,\s*\.next-case__link:focus-visible$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const move = tpmRules(/^\.next-case__link:hover \.next-case__go,\s*\.next-case__link:focus-visible \.next-case__go$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const by = Number((move.match(/translate(?:X)?\(\s*([\d.]+)px/) || [])[1]);
  if (!/background-color:\s*(?:rgba\(|#[0-9a-f]{8}\b)/i.test(hover) || !(by > 0 && by <= 6)) out.push(`${tag} on hover and keyboard focus only a light accent wash and a small arrow movement`);
  if (!tpmRules(/^\.next-case__link:focus-visible$/).some((r) => /outline:\s*2px solid/.test(r.body)) || tpmRules(/\.next-case/).some((r) => /outline:\s*(?:none|0)\b/.test(r.body))) out.push(`${tag} the way on has a strong keyboard focus ring`);
  if (!tpmRules(/\.next-case__link:hover \.next-case__go/).some((r) => /prefers-reduced-motion:\s*reduce/.test(r.at) && /transform:\s*none/.test(r.body))) out.push(`${tag} with reduced motion the arrow stays put`);
  return out;
};
const NEXT_LINE = 'Next, see how I bring events and multimedia production from concept through execution.';
const conclusionHtml = (tpmPage.match(/<section class="tpm-conclusion"[\s\S]*?<\/section>/) || [''])[0];
if (!conclusionHtml) failures.push('[tpm] 07 the conclusion closes the case study');
else {
  const h2 = (conclusionHtml.match(/<h2 id="tpm-conclusion-title"[^>]*>([\s\S]*?)<\/h2>/) || [, ''])[1];
  if (spaced(h2) !== 'One foundation. Every expression aligned.' || JSON.stringify(accentsIn(h2)) !== JSON.stringify(['Every expression aligned.'])) failures.push('[tpm] 07 headline: One foundation. Every expression aligned. (its second sentence in the accent)');
  const conclusionCopy = 'The work began with a shared product language and carried through the website, technical documentation, and flagship campaign, giving every public-facing expression the same strategic foundation.';
  if (textOf((conclusionHtml.match(/<p class="tpm-conclusion__copy[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1]) !== conclusionCopy || tpmData.conclusion?.copy !== conclusionCopy) failures.push('[tpm] 07 carries the approved paragraph');
  const cases = fs.readdirSync(path.join(root, 'src/content/work')).filter((f) => f.endsWith('.mdx')).map((f) => {
    const fm = fs.readFileSync(path.join(root, 'src/content/work', f), 'utf8');
    return { id: f.replace(/\.mdx$/, ''), order: Number((fm.match(/^order:\s*(\d+)/m) || [])[1]), card: (fm.match(/^card:[\s\S]*?^\s+title:\s*"([^"]+)"/m) || [, ''])[1] };
  }).sort((a, b) => a.order - b.order);
  const nextCase = cases[(cases.findIndex((c) => c.id === 'technical-marketing') + 1) % cases.length];
  const links = [...conclusionHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  const href = ((links[0]?.[1] || '').match(/href="([^"]+)"/) || [])[1];
  const inner = links[0]?.[2] || '';
  if (links.length !== 1 || href !== `${BASE}/work/${nextCase.id}/` || tpmData.conclusion?.next !== nextCase.id) failures.push(`[tpm] the conclusion's one link leads to the next case study in order, ${nextCase.card} (found ${href})`);
  if (textOf(inner) !== NEXT_LINE || tpmData.conclusion?.nextLine !== NEXT_LINE) failures.push(`[tpm] the whole sentence is the link: "${NEXT_LINE}" (found "${textOf(inner)}")`);
  if (!NEXT_LINE.toLowerCase().includes(nextCase.card.toLowerCase())) failures.push(`[tpm] the sentence names the case study it leads to (${nextCase.card})`);
  // Since the Events V1.2 brief: the case studies' shared way on (NextCase).
  if (!/<nav class="next-case"[^>]*aria-label="Next case study"/.test(conclusionHtml)) failures.push('[tpm] the way on is a navigation landmark, named for assistive technology');
  if (!/^\s*<span class="next-case__line[^"]*"[^>]*>[^<]+<\/span>\s*<span class="next-case__go[^"]*"[^>]*aria-hidden="true"[^>]*>\s*<svg\b/.test(inner)) failures.push('[tpm] the way on: the sentence first, then the arrow in its small circle, hidden from assistive technology');
  failures.push(...nextCaseFailures('[tpm]'));
  const onwardW = tpmRules(/^\.tpm-onward$/).filter((r) => !r.at).map((r) => remOf(r.body)).find((v) => v > 0);
  const paraW = tpmRules(/^\.tpm-conclusion__copy$/).map((r) => remOf(r.body)).find((v) => v > 0);
  if (!(onwardW > 0 && paraW > 0 && Math.abs(onwardW - paraW) <= 3)) failures.push(`[tpm] the way on is about as wide as the conclusion's paragraph (found ${onwardW}rem and ${paraW}rem)`);
}

// V1.5: the closing movement. The conclusion is a dark ground that begins on
// the campaign's black and ends exactly on the Contact green, through a deep
// charcoal teal (OKLab stops, each a little lighter and a little more teal
// than the last, never a muddy grey), with no light band and no seam; the type
// is the warm cream of the green surface; a full screen tall on wide screens,
// with distinct beats (about 48 to 64px, then about 80 to 100px); its
// paragraph as wide as the case study's other primary paragraphs. Contact's
// grid rises out of its lower part, and the conclusion's words sit above it.
{
  const head = (conclusionHtml.match(/<section[^>]*>/) || [''])[0];
  const base = tpmRules(/^\.tpm-conclusion$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const grad = (base.match(/background:\s*linear-gradient\(([^;]*)\)/) || [, ''])[1];
  const stops = [...grad.matchAll(/#([0-9a-f]{6})\b/gi)].map((m) => m[1].toLowerCase());
  const lum = (hex) => {
    const c = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  if (!/data-surface="dark"/.test(head)) failures.push('[tpm] the conclusion is a dark ground (the header reads it as one)');
  if (stops[0] !== '0d0f10' || stops[stops.length - 1] !== '1f4546' || stops.length < 8) failures.push(`[tpm] the conclusion's ground runs from the campaign's black (#0d0f10) to the Contact green (#1f4546) (found ${stops.join(' ')})`);
  if (stops.some((s, i) => i && lum(s) < lum(stops[i - 1])) || stops.some((s) => parseInt(s.slice(0, 2), 16) > parseInt(s.slice(2, 4), 16) || parseInt(s.slice(0, 2), 16) > parseInt(s.slice(4, 6), 16))) failures.push('[tpm] each step of the closing ground is a little lighter and stays on the teal side: no muddy intermediate color');
  if (!/--heading:\s*var\(--c-bone\)/.test(base) || !/--ink-2:\s*var\(--c-bone-2\)/.test(base)) failures.push('[tpm] the conclusion is set in the warm cream of the green surface');
  if (/data-surface="light"/.test(head) || tpmRules(/^\.tpm-conclusion/).some((r) => /background(?:-color)?:\s*(?:var\(--c-bone\)|#f3efe8(?![0-9a-f]))/i.test(r.body))) failures.push('[tpm] no cream band between the campaign and Contact');
  if (!tpmRules(/^\.tpm-conclusion$/).some((r) => DESKTOP.test(r.at) && /min-height:\s*var\(--view-h\)/.test(r.body)) || !tpmRules(/^\.tpm-conclusion$/).some((r) => /--view-h:\s*100svh/.test(r.body))) failures.push('[tpm] on wide screens the conclusion is a full screen tall');
  const conclMeasure = tpmRules(/^\.tpm-conclusion__copy$/).map((r) => remOf(r.body)).find((v) => v > 0);
  const caseMeasure = tpmRules(/^\.tpm-case__contribution$/).map((r) => remOf(r.body)).find((v) => v > 0);
  if (!measureOk(conclMeasure) || conclMeasure !== caseMeasure) failures.push(`[tpm] the conclusion's paragraph is as wide as the other primary paragraphs, about 800 to 860px (found ${conclMeasure ? conclMeasure * 16 : 'none'}px)`);
  const clampPx = (body, prop) => {
    const m = body.match(new RegExp(`${prop}:\\s*clamp\\(([\\d.]+)rem,[^,]+,\\s*([\\d.]+)rem\\)`));
    return m ? [Number(m[1]) * 16, Number(m[2]) * 16] : [];
  };
  const leadGap = clampPx(tpmRules(/^\.tpm-conclusion__lead$/).filter((r) => /min-width:\s*48rem|width\s*>=\s*48rem/.test(r.at)).map((r) => r.body).join(';'), 'gap');
  const onwardGap = clampPx(tpmRules(/^\.tpm-onward$/).filter((r) => /min-width:\s*48rem|width\s*>=\s*48rem/.test(r.at)).map((r) => r.body).join(';'), 'margin-top');
  if (!(leadGap[0] >= 48 && leadGap[1] <= 64)) failures.push(`[tpm] about 48 to 64px between the headline and the paragraph (found ${leadGap.join(' to ')})`);
  if (!(onwardGap[0] >= 80 && onwardGap[1] <= 100)) failures.push(`[tpm] about 80 to 100px between the paragraph and the way on (found ${onwardGap.join(' to ')})`);
  if (!tpmRules(/^\.tpm-conclusion__inner$/).some((r) => /z-index:\s*1/.test(r.body) && /position:\s*relative/.test(r.body))) failures.push('[tpm] the conclusion\'s words sit above the rising grid');
  if (!/<section id="contact" class="[^"]*\bcontact--lead\b[^"]*" style="--grid-lead:\s*[^"]+"/.test(tpmPage)) failures.push('[tpm] Contact\'s grid rises out of the conclusion (Contact has a lead)');
  const leadRule = rulesFor(/\.contact--lead.*\.contact__grid/).map((r) => r.body).join(';');
  if (!/inset:\s*calc\(-1\s*\*\s*var\(--grid-lead\)\)/.test(leadRule) || !/--grid-fade:\s*linear-gradient\(to bottom,\s*transparent 0,[^;]*#000 var\(--grid-lead\)/.test(leadRule)) failures.push('[tpm] the grid begins above Contact, from nothing to its usual strength where Contact begins');
  if (/contact--lead/.test(home)) failures.push('[tpm] the homepage Contact keeps its own grid (no lead)');
}

// ---- the page's order (V1.4), Contact kept after the conclusion.
const tpmOrder = [['hero', '<section class="tpm-hero"'], ['foundation', 'data-tpm-flow'], ['website', 'class="tpm-case tpm-website"'], ['documentation', 'class="tpm-case tpm-docs"'], ['campaign', 'class="tpm-case tpm-campaign"'], ['conclusion', '<section class="tpm-conclusion"'], ['contact', 'id="contact"']].map(([n, s]) => [n, tpmPage.indexOf(s)]);
if (tpmOrder.some(([, i]) => i < 0) || tpmOrder.some(([, i], k) => k && i < tpmOrder[k - 1][1])) failures.push(`[tpm] the page runs hero, foundation, website, documentation, campaign, conclusion, contact (${tpmOrder.map(([n, i]) => `${n} at ${i}`).join(', ')})`);

// ---- the emphasis system (V1.3): at most one emphasized phrase per
// paragraph, set a little heavier; the accent color on a few headline phrases,
// not every headline; never bold, accent and highlight on one phrase; no
// icons in headlines.
const tpmArticle = (tpmPage.match(/<article class="tpm"[\s\S]*<\/article>\s*<div class="chapter"/) || [''])[0];
const tpmParas = [...tpmArticle.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
const tpmHeads = [...tpmArticle.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => ({ level: Number(m[1]), html: m[2] }));
if (tpmParas.some((p) => (p.match(/class="tpm-em"/g) || []).length > 1)) failures.push('[tpm] no paragraph emphasizes more than one phrase');
const accented = tpmHeads.filter((h) => h.level <= 2 && /class="tpm-accent"/.test(h.html)).length;
const headlines = tpmHeads.filter((h) => h.level <= 2).length;
if (!(accented >= 2 && accented <= 4 && accented < headlines) || (tpmArticle.match(/class="tpm-accent"/g) || []).length !== accented) failures.push(`[tpm] the accent marks one phrase in a few headlines, not every headline (found ${accented} of ${headlines})`);
if (tpmHeads.some((h) => /tpm-em/.test(h.html)) || tpmParas.some((p) => /tpm-accent/.test(p)) || /tpm-em|tpm-accent|<strong\b|<b\b/.test(markHtml)) failures.push('[tpm] bold, accent and highlight never meet on one phrase');
if (tpmHeads.some((h) => /<svg\b|<img\b/.test(h.html))) failures.push('[tpm] no icons in headlines');
const emRule = rulesFor(/^\.tpm-em$/).map((r) => r.body).join(';');
const accentRule = rulesFor(/^\.tpm-accent$/).map((r) => r.body).join(';');
const emWeight = Number((emRule.match(/font-weight:\s*(\d+)/) || [])[1]);
if (!(emWeight >= 500 && emWeight <= 650) || /background|accent/.test(emRule)) failures.push('[tpm] emphasis in a paragraph is a slightly heavier weight, nothing more');
if (!/color:\s*var\(--accent-ink\)/.test(accentRule) || /font-weight|background/.test(accentRule)) failures.push('[tpm] a headline accent is a change of color only');

// ---- the choreography is an enhancement: every sticky stage and every
// scroll height needs the script's is-live class, a 60rem minimum width, a
// minimum height and prefers-reduced-motion: no-preference.
const tpmSticky = CSS_RULES.filter((r) => /position:\s*sticky/.test(r.body) && /\.tpm-/.test(r.sel));
if (tpmSticky.length < 2) failures.push('[tpm] the hero and the passage after it each need a sticky stage');
for (const r of [...tpmSticky, ...CSS_RULES.filter((x) => /\.tpm-(?:hero|flow)(?:\[[^\]]*\])?\.is-live(?:\[[^\]]*\])?$/.test(x.sel.trim()))]) {
  if (!/\.is-live\b/.test(r.sel) || !DESKTOP.test(r.at) || !TALL.test(r.at) || !MOTION_OK.test(r.at)) failures.push(`[tpm] "${r.sel}" must need .is-live, a 60rem minimum width, a minimum height and prefers-reduced-motion: no-preference`);
}
if (CSS_RULES.some((r) => /\.tpm-/.test(r.sel) && /writing-mode|text-orientation/.test(r.body))) failures.push('[tpm] no vertical copy');
// The page's own scripts, inline and bundled, with the chunks they import.
const pageScripts = (html) => {
  const seenJs = new Set();
  const out = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const queue = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  for (const m of out.join('\n').matchAll(/from\s*["']([^"']+\.js)["']|import\s*["']([^"']+\.js)["']/g)) queue.push(m[1] || m[2]);
  while (queue.length) {
    let src = queue.shift();
    if (src.startsWith(SITE_ORIGIN)) src = src.slice(SITE_ORIGIN.length);
    const file = path.join(dist, src.replace(BASE, '').replace(/^\/+/, ''));
    if (seenJs.has(file) || !fs.existsSync(file)) continue;
    seenJs.add(file);
    const js = fs.readFileSync(file, 'utf8');
    out.push(js);
    for (const m of js.matchAll(/from\s*["'](\.\/[^"']+\.js)["']|import\s*["'](\.\/[^"']+\.js)["']/g)) queue.push(path.posix.join(path.posix.dirname('/' + path.relative(dist, file).split(path.sep).join('/')), m[1] || m[2]));
  }
  return out.join('\n');
};
const tpmScripts = pageScripts(tpmPage);
// The film's controls (06): sound on request, mute or unmute, a silent replay.
for (const token of ['Unmute', 'volumechange', 'Replay video without sound']) if (!tpmScripts.includes(token)) failures.push(`[tpm] the film's script is missing ${token}`);
if (!/addEventListener\(\s*[`"']ended[`"']/.test(tpmScripts)) failures.push('[tpm] the walkthroughs hold their last frame when they end');
// The walkthroughs play continuously: the website (V1.2 delta) about a second
// on the partnership form, the documentation (V1.3) a moment on its final
// page, then a fade back to the first frame (the poster) and again, never a
// cut; out of view they pause, and nothing in the loop touches the mute state.
if (!/cycle:\{hold:(?:1e3|1000),fade:(?:[5-9]\d\d)\}/.test(tpmScripts)) failures.push('[tpm] the website walkthrough holds its form for about a second, then fades back to the hero before it replays');
if (!/\{threshold:\.55,cycle:\{hold:(?:1e3|1000|1[0-5]\d\d),fade:(?:[5-9]\d\d)\}\}/.test(tpmScripts)) failures.push('[tpm] the documentation walkthrough runs continuously: a moment on its final page, a fade back to the start, and again (V1.3)');
// The hero (V1.6): no WebGL and no canvas. The system opens only for a
// pointer over its own outline (a clip-path polygon, the whole box once open),
// for a tap (touch, a quicker version) or for its control (keyboard), and
// closes on leaving, a second tap, a tap elsewhere or Escape; the pointer
// engages it once the foundation stands. Off screen it rests closed and still;
// under the rising Foundation, closed and without its idle life.
if (/webgl|getContext\(/i.test(tpmScripts)) failures.push('[tpm] no WebGL and no canvas: the system is SVG and CSS');
for (const token of ['[data-iso]', '[data-iso-hit]', '[data-iso-toggle]', 'aria-expanded', 'Escape', 'pointerleave', 'pointerup', 'pointerdown', 'animationend', 'is-quick', 'is-asleep', 'is-flow', 'IntersectionObserver', '(hover: hover) and (pointer: fine)']) if (!tpmScripts.includes(token)) failures.push(`[tpm] the system's script is missing ${token}`);
if (!/pointerType===?[`"']touch[`"']/.test(tpmScripts)) failures.push('[tpm] the system never follows a touch pointer: a tap toggles it');
if (/data-tpm-field|tpm-signal|SignalField/.test(tpmScripts)) failures.push('[tpm] nothing is left of the signal field\'s script');
if (!tpmScripts.includes('is-held')) failures.push('[tpm] the hero script stills the system while the Foundation rises over it');
// The layered reveal hands the Foundation its edge, its shadow and its rise.
for (const token of ['--lead-r', '--lead-shadow', '--rise']) if (!tpmScripts.includes(token)) failures.push(`[tpm] the layered reveal's script is missing ${token}`);
// Nothing is left of Selected Writing's entrance.
if (/tpm-writing|data-article/.test(tpmScripts)) failures.push('[tpm] no script is left for Selected Writing');
if (!CSS_RULES.some((r) => /\[data-turn=["']?fade["']?\]\s+\.tpm-walk__video/.test(bare(r.sel)) && /opacity:\s*0\b/.test(r.body) && /transition:\s*opacity/.test(r.body))) failures.push('[tpm] the turn fades the recording out to its poster');
for (const token of ['prefers-reduced-motion: no-preference', 'prefers-reduced-motion: reduce', 'prefers-reduced-data: reduce', 'saveData', 'requestVideoFrameCallback', 'visibilitychange', 'IntersectionObserver', 'is-live', 'NotAllowedError', 'ended', 'Replay']) {
  if (!tpmScripts.includes(token)) failures.push(`[tpm] the page's motion script is missing ${token}`);
}
if (!/<div class="chapter" data-surface="brand"[^>]*>\s*<section id="contact" class="[^"]*\bcontact--frame\b/.test(tpmPage)) failures.push('[tpm] the page closes with the full Contact frame on the brand surface');
if (!/<footer class="site-footer" data-surface="brand"[\s>]/.test(tpmPage)) failures.push('[tpm] the footer continues the brand surface');

// ------------------------------------------ Events and Multimedia Production
// Version 1.3 (the V1.3 delta brief of October 14, 2026, on the live V1.2
// page, after the V1.1 and V1.2 deltas and John's Combined Build Brief): the
// third case study, on its own page. 01 Hero (one editorial reel in a wide
// cinematic frame beneath the headline and its paragraph), 02 the transition
// (SECURE. BUILD. CAPTURE. CUT. AMPLIFY., and since V1.3 the broadcast signal
// after the last word), 03 Build the activation (an original 3D concept
// rendering whose two screens play; since V1.3 about John's capabilities
// across events), 04 the Expanding Production Deck (V1.3: the live
// presentation, the production room and the event film in one deck, in place
// of their three sections), 05 the conclusion, with the way on to the next
// case study, then Contact. Copy is checked against the briefs; only
// public-safe outcomes, no unverified metrics.
{
  const evPage = fs.readFileSync(path.join(dist, 'work/events-video/index.html'), 'utf8');
  const evData = JSON.parse(fs.readFileSync(path.join(root, 'src/data/events.json'), 'utf8'));
  const evAssets = JSON.parse(fs.readFileSync(path.join(root, 'src/data/assets.json'), 'utf8')).assets || [];
  const evAsset = (id) => evAssets.find((x) => x.id === id) || {};
  const evNoCode = evPage.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '');
  const evText = textOf(norm(evNoCode));
  const evSection = (cls) => (evPage.match(new RegExp(`<section class="${cls}"[\\s\\S]*?<\\/section>`)) || [''])[0];
  const evRules = (re) => CSS_RULES.filter((r) => re.test(bare(r.sel)));
  const one = (html, re) => textOf(norm((html.match(re) || [, ''])[1]));
  const block = (html, start) => {
    // the element that opens at `start`, with its nested elements of the same tag
    const at = html.indexOf(start);
    if (at < 0) return '';
    const tag = (start.match(/^<(\w+)/) || [])[1];
    const re = new RegExp(`<${tag}\\b|<\\/${tag}>`, 'g');
    re.lastIndex = at;
    let depth = 0;
    for (let m; (m = re.exec(html)); ) {
      depth += m[0].startsWith('</') ? -1 : 1;
      if (depth === 0) return html.slice(at, m.index + m[0].length);
    }
    return html.slice(at);
  };
  if (/class="cs-hero[\s"_]/.test(evPage) || /My role/.test(evText)) failures.push('[events] the page has its own hero and no "My role" line: credits sit with the work they describe');
  if (/class="tpm-/.test(evNoCode)) failures.push('[events] the page shares no Technical Product Marketing component: its own structure and motion');
  const order = [['hero', '<section class="evh"'], ['transition', '<div class="evx"'], ['activation', '<section class="eva"'], ['deck', '<section class="evd"'], ['conclusion', '<section class="evc"'], ['contact', 'id="contact"']].map(([n, s]) => [n, evPage.indexOf(s)]);
  if (order.some(([, i]) => i < 0) || order.some(([, i], k) => k && i < order[k - 1][1])) failures.push(`[events] the page runs hero, transition, activation, the production deck, conclusion, Contact (${order.map(([n, i]) => `${n} at ${i}`).join(', ')})`);

  // ---- 01 Hero (V1.2): the approved words; one editorial reel, no category control
  const EV = {
    kicker: '03 / Events and Multimedia Production',
    headline: 'From live experience to lasting momentum.',
    copy: 'I turn live opportunities into complete marketing systems, from sponsorship and on-site production to content, distribution, and the relationships that continue after the room clears.',
  };
  const hero = evSection('evh');
  if (!/data-surface="dark"/.test(hero.match(/<section[^>]*>/)?.[0] || '')) failures.push('[events] the hero is on the dark ground of the screens');
  if (one(hero, /<p class="evh__kicker[^"]*"[^>]*>([\s\S]*?)<\/p>/) !== EV.kicker) failures.push(`[events] the kicker reads "${EV.kicker}"`);
  if (one(hero, /<h1 id="ev-title"[^>]*>([\s\S]*?)<\/h1>/) !== EV.headline) failures.push(`[events] the headline reads "${EV.headline}"`);
  if (one(hero, /<p class="lede evh__lede[^"]*"[^>]*>([\s\S]*?)<\/p>/) !== EV.copy) failures.push('[events] the hero carries the approved supporting copy');
  // The category system is gone: no LIVE, CONVERSATIONS or PRODUCED control, no chapter buttons, one control (pause and play).
  if (/class="evh__cues|data-cue-btn|data-ev-program|aria-label="Program"/.test(hero) || /\b(?:Q0\d|CONVERSATIONS|PRODUCED)\b/i.test(textOf(hero))) failures.push('[events] the LIVE, CONVERSATIONS and PRODUCED controls are gone from beneath the hero');
  const heroButtons = [...hero.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
  if (heroButtons.length !== 1 || !/data-reel-toggle/.test(heroButtons[0] || '') || !/aria-label="[^"]+"/.test(heroButtons[0] || '')) failures.push(`[events] the reel has only its pause control: no next, previous or category buttons (found ${heroButtons.length} buttons)`);
  // The chapters: in events.json's order, those whose video is approved and present, numbered in order; a pending one is absent.
  const CHAPTERS = [['presentation', 'Live presentation'], ['podcast', 'Creator podcast'], ['team-interview', 'Team interview'], ['explainer', 'Technical explainer'], ['event-film', 'Event film']];
  if (JSON.stringify((evData.hero?.chapters || []).map((c) => [c.key, c.title])) !== JSON.stringify(CHAPTERS)) failures.push('[events] events.json orders the reel: live presentation, creator podcast, team interview, technical explainer, event film');
  const chapterReady = (c) => {
    const a = evAsset(c.asset);
    return a.permission === 'approved' && a.type === 'video' && Boolean(a.file) && fs.existsSync(path.join(root, 'public/media', a.file));
  };
  const expected = (evData.hero?.chapters || []).filter(chapterReady).map((c, i) => [c.key, String(i + 1).padStart(2, '0'), c.title]);
  const shown = [...hero.matchAll(/<div\b[^>]*data-chapter-layer="([\w-]+)"[^>]*data-number="(\d+)"[^>]*data-title="([^"]+)"/g)].map((m) => [m[1], m[2], decode(m[3])]);
  if (JSON.stringify(shown) !== JSON.stringify(expected)) failures.push(`[events] the reel shows its ready chapters in order, numbered in order (found ${shown.map((x) => x.join(' ')).join(', ')})`);
  const interview = evAsset('ev-hero-team-interview');
  if (interview.permission !== 'approved') {
    if (JSON.stringify(shown.map(([, n, t]) => `${n} / ${t}`)) !== JSON.stringify(['01 / Live presentation', '02 / Creator podcast', '03 / Technical explainer', '04 / Event film'])) failures.push('[events] until the team interview arrives the reel runs four chapters: 01 / LIVE PRESENTATION, 02 / CREATOR PODCAST, 03 / TECHNICAL EXPLAINER, 04 / EVENT FILM');
    if (/Team interview|team-interview/i.test(hero) || /Singapore Team|\bTBD\b|coming soon/i.test(evText)) failures.push('[events] no placeholder, disabled chapter or "coming soon" while the team interview is pending');
  } else if (JSON.stringify(shown.map(([, n, t]) => `${n} / ${t}`)) !== JSON.stringify(['01 / Live presentation', '02 / Creator podcast', '03 / Team interview', '04 / Technical explainer', '05 / Event film'])) failures.push('[events] with the team interview in, the reel runs five chapters, the interview third');
  if (textOf(block(hero, '<span data-reel-label')) !== `${expected[0]?.[1]} / ${expected[0]?.[2]}` || !evRules(/^\.evh__reading,\s*\.evh__tc$/).some((r) => /text-transform:\s*uppercase/.test(r.body))) failures.push('[events] the label at the top left reads the chapter\'s number and title, in capitals (01 / LIVE PRESENTATION)');
  const NAMES = /Sui Summit|ETHDenver|TOKEN2049|Singapore|Sui Fest|SuiFest|Jungle|Food Talk|Slippage|Max Presentation|McKendry|Bolt|20(?:25|26)|\.mp4|Denver/i;
  const heroWords = textOf(hero.replace(/<p class="lede evh__lede[\s\S]*?<\/p>/, '').replace(/<h1\b[\s\S]*?<\/h1>/, '').replace(/<p class="evh__kicker[\s\S]*?<\/p>/, ''));
  if (NAMES.test(heroWords) || shown.some(([, , t]) => NAMES.test(t))) failures.push(`[events] the hero shows no file name, event, place or date (found "${heroWords}")`);
  const heroVideos = [...hero.matchAll(/<video\b[^>]*>[\s\S]*?<\/video>/g)].map((m) => m[0]);
  if (heroVideos.length !== expected.length || heroVideos.some((v) => !/\bmuted\b/.test(v) || !/\bplaysinline\b/.test(v) || !/preload="none"/.test(v) || !/\bposter="/.test(v) || /\bautoplay\b/.test(v) || /<video\b[^>]*\bloop\b/.test(v))) failures.push('[events] one video per chapter, each muted, inline, unlooped, with a poster, and nothing loaded or autoplayed by the markup (the script plays the chapter on air)');
  for (const c of (evData.hero?.chapters || []).filter(chapterReady)) {
    const a = evAsset(c.asset);
    if (!heroVideos.some((v) => v.includes(`/media/${a.file}`))) failures.push(`[events] the reel plays ${a.file}`);
    if (!(a.duration >= 3 && a.duration <= 15) || !a.poster || !/^(?:16:9|2\.157:1)$/.test(a.aspect)) failures.push(`[events] ${c.asset} is an approved chapter of 3 to 15 seconds with its poster`);
    if (NAMES.test(a.alt || '')) failures.push(`[events] ${c.asset}'s description names no event (it describes what is on screen)`);
    if (/Food Talk\.mp4/.test(a.source || '')) failures.push(`[events] ${c.asset}: Food Talk is not used`);
  }
  if (/Food Talk/i.test(evText)) failures.push('[events] Food Talk appears nowhere on the page');
  const pres = evAsset('ev-hero-presentation');
  if (!/0:00 to 0:04\.2/.test(pres.source || '') || !/6:03\.154 to 6:05\.78/.test(pres.source || '') || !/20:16 to 20:20/.test(pres.source || '') || !/dissolves? of 0\.334 s/.test(pres.source || '')) failures.push('[events] the presentation chapter: the opening, the on-chain pools passage and 20:16 to 20:20, joined by 250 to 400ms dissolves');
  const expl = evAsset('ev-hero-explainer');
  if (!/0:15\.18 to 0:24/.test(expl.source || '') || !/One is related to just/.test(expl.source || '') || !/source audio/.test(expl.source || '')) failures.push('[events] the explainer begins on the first frame of "One is related to just", found in the source audio, and keeps its approved end');
  // The cinematic frame (the composition is an implementation trial), its crop per chapter, its crossfade.
  if (!evRules(/^\.evh__frame$/).some((r) => /min-width:\s*40rem|width\s*>=\s*40rem/.test(r.at) && /aspect-ratio:\s*2\.2(?:\s*\/\s*1)?\s*(?:;|$)/.test(r.body)) || !evRules(/^\.evh__frame$/).some((r) => !r.at && /aspect-ratio:\s*16\s*\/\s*9/.test(r.body))) failures.push('[events] the reel plays in a wide cinematic frame (2.2:1; 16:9 on narrow screens)');
  // On shorter wide screens the frame may widen a little (2.3 to 2.45:1, still the content's full width), so the whole reel stays in the first screen.
  const shortFrames = evRules(/^\.evh__frame$/).filter((r) => r.at && !/min-width:\s*40rem\)?\s*$|width\s*>=\s*40rem\)?\s*$/.test(r.at.trim()) && /aspect-ratio:/.test(r.body));
  if (shortFrames.some((r) => !/max-height|height\s*<=/.test(r.at) || !(Number((r.body.match(/aspect-ratio:\s*([\d.]+)/) || [])[1]) >= 2.3 && Number((r.body.match(/aspect-ratio:\s*([\d.]+)/) || [])[1]) <= 2.45))) failures.push('[events] only shorter wide screens widen the frame, and only a little (2.3 to 2.45:1)');
  if (!evRules(/^\.evh__layer--contain \.evh__video$/).some((r) => /max-width:\s*39\.99rem|width\s*<=?\s*39\.99rem|width\s*<\s*40rem/.test(r.at) && /object-fit:\s*contain/.test(r.body))) failures.push('[events] on narrow screens the presentation, wider than 16:9, shows whole');
  if (!evRules(/^\.evh__video$/).some((r) => /object-fit:\s*cover/.test(r.body) && /object-position:\s*var\(--pos/.test(r.body)) || shown.length !== [...hero.matchAll(/data-chapter-layer="[\w-]+"[^>]*style="--pos:\s*\d+% \d+%"/g)].length) failures.push('[events] each chapter sets its own crop of the wide frame');
  const fade = evRules(/^\.evh__layer$/).map((r) => r.body).join(';');
  const fadeMs = Number((fade.match(/opacity\s+([\d.]+)s/) || [])[1]) * 1000;
  if (!(fadeMs >= 300 && fadeMs <= 400)) failures.push(`[events] between chapters a restrained dissolve of 300 to 400ms (found ${fadeMs || 'none'})`);
  if ((hero.match(/class="evh__layer[^"]*\bis-on\b/g) || []).length !== 1) failures.push('[events] only one chapter is on the frame');
  // The production accents: the corner brackets, the label, the timecode, the pause control, one segmented rail and no words beneath it.
  if (!/data-reel-tc/.test(hero) || !/data-reel-label/.test(hero) || (hero.match(/class="evh__crop /g) || []).length !== 4) failures.push('[events] the reel keeps its corner brackets, its label at the top left and its timecode at the top right');
  const rail = block(hero, '<span class="evh__rail"');
  if (!/aria-hidden="true"/.test(rail.match(/<span class="evh__rail"[^>]*>/)?.[0] || '') || (rail.match(/data-reel-seg=/g) || []).length !== expected.length || textOf(rail)) failures.push('[events] one segmented progress rail, a segment to a chapter, with no words');
  const reelWords = textOf(block(hero, '<div class="evh__reel').replace(/<div class="evh__hud[\s\S]*?<\/div>/, '').replace(/<button\b[\s\S]*?<\/button>/, ''));
  if (reelWords) failures.push(`[events] no text labels beneath the reel or along its rail (found "${reelWords}")`);
  if (!evRules(/^\.evh__toggle-text$/).some((r) => /display:\s*none/.test(r.body)) || !evRules(/^\.evh__reel\.is-waiting \.evh__toggle-text$/).some((r) => /display:\s*inline/.test(r.body)) || !/class="evh__toggle-text[^"]*"[^>]*>Play reel</.test(hero)) failures.push('[events] with reduced motion the reel waits on its poster with an explicit Play control');
  // The trial composition: the kicker, a header row (headline about 60 to 65%, paragraph about 30 to 35%, set to its lower lines), the reel beneath across the content.
  const headAt = hero.indexOf('<header class="evh__head'), reelAt = hero.indexOf('<div class="evh__reel');
  if (hero.indexOf('<p class="evh__kicker') > headAt || headAt < 0 || reelAt < headAt || block(hero, '<header class="evh__head').includes('evh__reel')) failures.push('[events] the kicker, then the header row, then the reel beneath it');
  const headRule = evRules(/^\.evh__head$/).filter((r) => DESKTOP.test(r.at)).map((r) => r.body).join(';');
  const cols = (headRule.match(/grid-template-columns:\s*minmax\(0,\s*(\d+)fr\)\s*minmax\(0,\s*(\d+)fr\)/) || []).slice(1).map(Number);
  if (!(cols[0] >= 60 && cols[0] <= 65 && cols[1] >= 30 && cols[1] <= 35) || !/align-items:\s*end/.test(headRule)) failures.push(`[events] on wide screens the headline takes about 60 to 65% and the paragraph about 30 to 35%, set against the headline's lower lines (found ${cols.join('/')})`);
  if (evRules(/^\.evh__head$/).some((r) => !r.at && /grid-template-columns/.test(r.body))) failures.push('[events] on narrow screens the headline, the paragraph and the reel simply stack');
  if (/<(?:video|audio)\b[^>]*\bautoplay\b/.test(evPage)) failures.push('[events] no video on the page autoplays from the markup');

  // ---- 02 The transition (V1.1): the run of show is gone
  if (/class="evr|data-ev-run|Run of show|The event is only the middle of the work/i.test(evNoCode)) failures.push('[events] the run of show (its headline, copy, line, nodes and layout) is gone');
  const tr = block(evPage, '<div class="evx"');
  const PHRASE = 'Secure. Build. Capture. Cut. Amplify.';
  const trWords = [...tr.matchAll(/<span class="evx__word[^"]*"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => textOf(m[1]));
  const trLines = [...tr.matchAll(/<span class="evx__line[^"]*"[^>]*>([\s\S]*?)<\/span>\s*(?=<\/span>|<\/p>|\s)/g)];
  if (trWords.join(' ') !== PHRASE || one(tr, /<span class="sr-only"[^>]*>([\s\S]*?)<\/span>/) !== PHRASE || (tr.match(/class="evx__line[^"]*"[^>]*aria-hidden="true"/g) || []).length !== 2) failures.push(`[events] the transition reads SECURE. BUILD. CAPTURE. CUT. AMPLIFY., in two lines on small screens (found ${trWords.join(' ')})`);
  if (!/data-surface="dark"/.test((tr.match(/<div class="evx"[^>]*>/) || [''])[0])) failures.push('[events] the transition carries the hero\'s dark ground');
  // (V1.3: its one icon is the broadcast signal after AMPLIFY., checked below.)
  const trBare = tr.replace(/<span class="evx__signal"[^>]*>[\s\S]*?<\/svg><\/span><\/span>/, '');
  if (/<svg\b|<img\b|<video\b|<h2\b|<a\b|<ol\b|<ul\b|<button\b/.test(trBare) || /\d/.test(textOf(tr))) failures.push('[events] the transition has no other icon, lines, nodes, numbers, links or paragraphs: only the phrase and its signal');
  if (!evRules(/^\.evx__phrase$/).some((r) => /text-transform:\s*uppercase/.test(r.body) && /text-align:\s*center/.test(r.body)) || !evRules(/^\.evx__line$/).some((r) => /min-width:\s*48rem|width\s*>=\s*48rem/.test(r.at) && /display:\s*inline/.test(r.body)) || !evRules(/^\.evx__line$/).some((r) => !r.at && /display:\s*block/.test(r.body))) failures.push('[events] one centered uppercase line where it fits; two deliberate lines on a small screen');
  const trRun = Number((evRules(/^\.evx\.is-live$/).map((r) => r.body).join(';').match(/var\(--evx-run,\s*([\d.]+)\)/) || [])[1]);
  if (!(trRun >= 1.6 && trRun <= 2) || !evRules(/^\.evx\.is-live \.evx__pin$/).some((r) => /position:\s*sticky/.test(r.body))) failures.push(`[events] the phrase holds at the middle of the screen while it is read (the section about 1.6 to 2 screens tall, found ${trRun || 'none'})`);
  if (!evRules(/^\.evx\.is-live \.evx__word$/).some((r) => MOTION_OK.test(r.at) && /opacity:\s*0\b/.test(r.body) && /transition:/.test(r.body)) || evRules(/^\.evx/).some((r) => /(?:^|;)\s*animation:/.test(r.body) && !/evx__signal|evx__tile|evx__g\b|evx__g--|evx__pulse/.test(bare(r.sel)))) failures.push('[events] the words arrive by a short wipe and fade, only with motion allowed; nothing blinks or tunnels');
  const evScriptsAll = pageScripts(evPage);
  const trSource = fs.readFileSync(path.join(root, 'src/components/events/EvTransition.astro'), 'utf8');
  const trConst = (name) => Number((trSource.match(new RegExp(`const ${name} = ([\\d.]+);`)) || [])[1]);
  const travel = trConst('TRAVEL');
  if (!(travel >= 0.6 && travel <= 0.8) || !/p >= i \/ \(words\.length - 1\)/.test(trSource)) failures.push(`[events] the words arrive over about 0.6 to 0.8 of a screen of scrolling, the first at its start and the last at its end (found ${travel || 'none'})`);
  // After the last word a short hold, then the next section: the phrase is
  // released (UNPIN) a little after it completes (START less TRAVEL), and the
  // section is as tall as that (the script sets it; the stylesheet's fallback
  // repeats it).
  const hold = trConst('UNPIN') - (travel - trConst('START'));
  if (!(hold >= 0.1 && hold <= 0.4) || Math.abs(1 + trConst('UNPIN') - trRun) > 0.001) failures.push(`[events] after the last word a short hold (0.1 to 0.4 of a screen, found ${hold.toFixed(2)}), then the next section (the section ${1 + trConst('UNPIN')} screens tall, its fallback ${trRun})`);

  // ---- 02 the broadcast signal after AMPLIFY. (V1.3): the approved Option A,
  // Broadcast, in the solid tile treatment. Placed immediately after the word
  // (the word kept, the two never split across lines), punctuation and not a
  // button, hidden from assistive technology with its line; a point and two
  // pairs of arcs in outline weight on a solid tile in the accent; it arrives
  // only after the last word is in, opens, sends one restrained pulse and
  // settles (nothing repeats), and with reduced motion it is simply there.
  const sigs = tr.match(/class="evx__signal"/g) || [];
  const tail = (tr.match(/<span class="evx__tail"[^>]*>[\s\S]*?<\/svg><\/span><\/span><\/span>/) || [''])[0];
  const lines2 = [...tr.matchAll(/<span class="evx__line"[^>]*aria-hidden="true"[^>]*>/g)].map((m) => m.index);
  const tailAt = tr.indexOf('<span class="evx__tail"');
  if (sigs.length !== 1 || !/^<span class="evx__tail"[^>]*><span class="evx__word"[^>]*>Amplify\.<\/span><span class="evx__signal"[^>]*data-evx-signal/.test(tail) || !(lines2.length === 2 && tailAt > lines2[1]) || !evRules(/^\.evx__tail$/).some((r) => /white-space:\s*nowrap/.test(r.body))) failures.push('[events] one broadcast signal, immediately after AMPLIFY. on its line, the word kept and the two never split');
  if (/<button\b|tabindex=|role="button"|<a\b/.test(tail)) failures.push('[events] the signal is punctuation, not a button');
  const glyphPaths = [...tail.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
  if ((tail.match(/<circle\b/g) || []).length !== 1 || glyphPaths.length !== 2 || glyphPaths.some((d) => (d.match(/a/g) || []).length !== 2) || /<(?:rect|polygon|polyline|line|ellipse|image|text)\b/.test(tail)) failures.push('[events] the signal is Option A, Broadcast: a point with two pairs of arcs, and nothing else');
  const tileRule = evRules(/^\.evx__tile$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const glyphRule = evRules(/^\.evx__glyph$/).filter((r) => !r.at).map((r) => r.body).join(';');
  if (!/background:\s*var\(--accent\)/.test(tileRule) || !/fill:\s*none/.test(glyphRule) || !/stroke:\s*currentColor/i.test(glyphRule) || !/stroke-width:\s*2(?:\.\d+)?\b/.test(glyphRule)) failures.push('[events] the signal is a solid tile in the accent with the glyph in outline weight');
  const sigBox = evRules(/^\.evx__signal$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const sigEm = Number((sigBox.match(/width:\s*([\d.]+)em/) || [])[1]);
  if (!(sigEm >= 0.75 && sigEm <= 1) || !/height:\s*[\d.]+em/.test(sigBox) || !/display:\s*inline-block/.test(sigBox)) failures.push(`[events] the tile sits in the line like punctuation, about the height of the capitals (found ${sigEm || 'none'}em)`);
  if (!/signal\?\.classList\.toggle\('is-on', p >= 1\)/.test(trSource)) failures.push('[events] the signal arrives only once the last word is in, and steps away if the reader scrolls back');
  const tileIn = evRules(/^\.evx\.is-live \.evx__signal\.is-on \.evx__tile$/).find((r) => MOTION_OK.test(r.at));
  // The shorthand's second time is its delay (whatever order the minifier writes it in).
  const delayOf = (body) => {
    const times = [...((body || '').match(/animation:([^;]*)/) || [, ''])[1].matchAll(/(?:^|[\s,])(\d*\.?\d+)(m?s)\b/g)].map((m) => Number(m[1]) / (m[2] === 'ms' ? 1000 : 1));
    return times.length >= 2 ? times[1] : NaN;
  };
  if (!tileIn || !(delayOf(tileIn.body) >= 0.2)) failures.push('[events] the tile waits a moment after the last word, then wipes in as the words do');
  const pulse = evRules(/^\.evx\.is-live \.evx__signal\.is-on \.evx__pulse$/).find((r) => MOTION_OK.test(r.at));
  const pulseEnd = CSS_RULES.filter((r) => /@keyframes evx-pulse\b/.test(r.at) && /^(?:100%|to)$/.test(r.sel.trim())).map((r) => r.body).join(';');
  if (!pulse || !/forwards/.test(pulse.body) || /infinite/.test(pulse.body) || !/opacity:\s*0\b/.test(pulseEnd) || evRules(/^\.evx/).some((r) => /infinite/.test(r.body))) failures.push('[events] one restrained outward pulse, then it settles: nothing in the transition repeats');
  const hides = evRules(/evx__tile|evx__g\b|evx__g--/).filter((r) => /clip-path:\s*inset\(0(?:px)?\s+100%|opacity:\s*0\b/.test(r.body) && !/@keyframes/.test(r.at));
  if (!hides.length || hides.some((r) => !MOTION_OK.test(r.at))) failures.push('[events] with reduced motion the signal is simply there: it waits to be revealed only with motion allowed');

  // ---- the sections' headlines and words
  const H = {
    eva: ['ev-activation-title', 'The work starts before anyone enters the room.'],
    evc: ['ev-conclusion-title', 'The room clears. The work keeps moving.'],
  };
  for (const [cls, [id, text]] of Object.entries(H)) {
    const got = one(evSection(cls), new RegExp(`<h2 id="${id}"[^>]*>([\\s\\S]*?)<\\/h2>`));
    if (got !== text) failures.push(`[events] headline: "${text}" (found "${got}")`);
  }
  // V1.2: the standalone Amplify section (what continued after) is folded into the conclusion.
  if (/class="evt\b|id="ev-after|Every event opens a longer conversation/.test(evPage) || fs.existsSync(path.join(root, 'src/components/events/EvAfter.astro'))) failures.push('[events] the standalone Amplify section, its step list and its credits are gone (the conclusion carries its point)');
  const conclCopy = 'An event is only the starting point. I turn live moments into content, extend their reach through partner and ecosystem distribution, and carry that momentum into strategic relationships and new opportunities.';
  const concl = evSection('evc');
  if (one(concl, /<p class="evc__copy[^"]*"[^>]*>([\s\S]*?)<\/p>/) !== conclCopy || evData.conclusion?.copy !== conclCopy) failures.push('[events] the conclusion carries the approved copy');
  // The static row of the five stages: a quiet callback, never animated a second time.
  const conclCues = [...block(concl, '<p class="evc__cues"').matchAll(/<span class="evc__cue[^"]*"[^>]*>\s*<span class="evc__sq[^"]*"[^>]*><\/span>\s*([^<]+)<\/span>/g)].map((m) => textOf(m[1]));
  if (conclCues.join(' ') !== 'Secure Build Capture Cut Amplify' || !/<p class="evc__cues"[^>]*aria-hidden="true"/.test(concl) || evRules(/^\.evc__(?:cues|cue|sq)$/).some((r) => /(?:^|;)\s*(?:animation|transition):/.test(r.body)) || /data-ev-reveal/.test(concl.match(/<p class="evc__cues"[^>]*>/)?.[0] || '')) failures.push(`[events] the conclusion keeps the static square markers and the five words, not animated again (found ${conclCues.join(', ')})`);
  if (/<ul\b|<ol\b|<figure\b|<img\b|<video\b|evt__|evidence|\d+\s*%/.test(concl)) failures.push('[events] no evidence rail, metrics strip, card grid or line-and-node sequence in the conclusion');
  // The way on to the next case study in the collection's order (it wraps around to the first).
  const evCases = fs.readdirSync(path.join(root, 'src/content/work')).filter((f) => f.endsWith('.mdx')).map((f) => ({ id: f.replace(/\.mdx$/, ''), order: Number((fs.readFileSync(path.join(root, 'src/content/work', f), 'utf8').match(/^order:\s*(\d+)/m) || [])[1]) })).sort((a, b) => a.order - b.order);
  const evNext = evCases[(evCases.findIndex((c) => c.id === 'events-video') + 1) % evCases.length];
  const EV_NEXT = 'Next, see how I build creator partnerships into campaigns designed to travel.';
  const conclLinks = [...concl.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  if (conclLinks.length !== 1 || ((conclLinks[0][1].match(/href="([^"]+)"/) || [])[1]) !== `${BASE}/work/${evNext.id}/` || evData.conclusion?.next !== evNext.id || evNext.id !== 'creator-campaigns') failures.push(`[events] the conclusion's one link leads to the next case study in order, Creator Campaigns (found ${conclLinks.length} links)`);
  if (textOf(conclLinks[0]?.[2] || '') !== EV_NEXT || evData.conclusion?.nextLine !== EV_NEXT || !/<nav class="next-case"[^>]*aria-label="Next case study"/.test(concl) || !/<span class="next-case__go[^"]*"[^>]*aria-hidden="true"/.test(concl)) failures.push(`[events] the way on reads "${EV_NEXT}", its arrow in a small circle, a named navigation landmark`);
  failures.push(...nextCaseFailures('[events]'));
  const evNextW = evRules(/^\.evc__next$/).map((r) => remOf(r.body)).find((v) => v > 0);
  const evParaW = evRules(/^\.evc__copy$/).map((r) => remOf(r.body)).find((v) => v > 0);
  if (!(evNextW > 0 && evParaW > 0 && Math.abs(evNextW - evParaW) <= 3)) failures.push(`[events] the way on is about as wide as the conclusion's paragraph (found ${evNextW}rem and ${evParaW}rem)`);
  if (!/<div class="chapter" data-surface="brand"[^>]*>\s*<section id="contact" class="[^"]*\bcontact--frame\b[^"]*\bcontact--lead\b/.test(evPage) || !/<footer class="site-footer" data-surface="brand"[\s>]/.test(evPage)) failures.push('[events] the conclusion runs straight into the full Contact frame and the brand footer');
  const evcBase = evRules(/^\.evc$/).filter((r) => !r.at).map((r) => r.body).join(';');
  if (!/#0d0f10 0%/.test(evcBase) || !/#1f4546 100%/.test(evcBase)) failures.push('[events] the conclusion turns from black to exactly the Contact green');

  // ---- 03 The activation: its words, and the 3D render in place of the schematic.
  // V1.3: the paragraph speaks to John's capabilities across events and names no
  // one event; the caption calls the image a concept rendering combining the
  // activation elements he plans and coordinates across events; the Sui Summit
  // story lives in the deck's live presentation chapter.
  const act = evSection('eva');
  const ACT_COPY = 'Before the doors open, I negotiate sponsorships and pricing, coordinate with event hosts, source and price merchandise, and work with design on screen animations and physical assets. I plan how those pieces come together on site and how the activation continues through content and distribution afterward.';
  if (one(act, /<p class="eva__copy[^"]*"[^>]*>([\s\S]*?)<\/p>/) !== ACT_COPY || evData.activation?.copy !== ACT_COPY) failures.push('[events] the activation carries the V1.3 paragraph: what John does before the doors open, at any event');
  if (/Sui Summit|ETHDenver|TOKEN2049|Sui Fest|SuiFest|\b20(?:25|26)\b|this booth|the booth at/i.test(textOf(norm(act.replace(/<script\b[\s\S]*?<\/script>/g, ''))))) failures.push('[events] the activation names no one event and implies no one booth');
  if (/class="ev-cue\b|Stages?:/.test(act) || evData.activation?.cues) failures.push('[events] the activation has no eyebrow (V1.2 removed its stages, Secure and Build)');
  if (/Phi Labs sponsored/.test(evPage)) failures.push('[events] the sponsorship is attributed to Bolt Liquidity');
  if (/eva__svg|eva__pin|eva__notes|eva__plan|Schematic/i.test(act)) failures.push('[events] the flat booth schematic, its numbered pins and legend are gone');
  const viz = block(act, '<figure class="eva__viz"');
  const vizImg = (viz.match(/<img\b[^>]*class="eva__still[^"]*"[^>]*>/) || viz.match(/<img\b[^>]*>/) || [''])[0];
  if (!/<picture\b/.test(viz) || !/\balt="[^"]{60,}"/.test(vizImg) || !/aspect-ratio:\s*2560\s*\/\s*1280/.test(viz)) failures.push('[events] the visualization is one rendered picture (2:1), described for assistive technology');
  if (!/<figcaption class="eva__caption[^"]*"[^>]*>[^<]*(?:render|visualization)[^<]*<\/figcaption>/i.test(viz)) failures.push('[events] the visualization is captioned as a rendering made for the page, never a photograph');
  const ACT_CAPTION = 'Concept rendering combining the activation elements I plan and coordinate across events.';
  if (one(viz, /<figcaption class="eva__caption[^"]*"[^>]*>([\s\S]*?)<\/figcaption>/) !== ACT_CAPTION || evData.activation?.caption !== ACT_CAPTION) failures.push(`[events] the rendering's caption reads "${ACT_CAPTION}"`);
  // The modest desktop adjustment: the rendering about 8% narrower than the
  // content at its widest (86.5rem), centered, and whole; the copy row about
  // 10 to 15% closer to it (from clamp(2.5rem, 5vw, 4rem)).
  const vizRule = evRules(/^\.eva__viz$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const vizMax = remOf(vizRule);
  if (!(vizMax >= 86.5 * 0.9 && vizMax <= 86.5 * 0.94) || !/justify-self:\s*center|margin-inline:\s*auto/.test(vizRule) || evRules(/^\.eva__stage$/).some((r) => /max-width:\s*(?!100%)/.test(r.body))) failures.push(`[events] on large desktops the rendering is about 8% narrower than the content, centered (found ${vizMax || 'none'}rem)`);
  const actGap = (evRules(/^\.eva__inner$/).filter((r) => !r.at).map((r) => r.body).join(';').match(/gap:\s*clamp\(([\d.]+)rem,\s*([\d.]+)vw,\s*([\d.]+)rem\)/) || []).slice(1).map(Number);
  if (!(actGap[0] >= 2.5 * 0.85 && actGap[0] <= 2.5 * 0.9 && actGap[1] >= 5 * 0.85 && actGap[1] <= 5 * 0.9 && actGap[2] >= 4 * 0.85 && actGap[2] <= 4 * 0.9)) failures.push(`[events] the copy row sits about 10 to 15% closer to the rendering (found ${actGap.join(', ') || 'none'})`);
  const live = block(viz, '<div class="eva__live"');
  const screens = [...live.matchAll(/<video\b[^>]*data-screen="(tv|wall)"[^>]*>[\s\S]*?<\/video>/g)].map((m) => [m[1], m[0]]);
  if (JSON.stringify(screens.map(([k]) => k).sort()) !== '["tv","wall"]' || screens.some(([, v]) => !/\bmuted\b/.test(v) || !/\bloop\b/.test(v) || !/\bplaysinline\b/.test(v) || !/preload="none"/.test(v) || !/\bposter="/.test(v) || /\bautoplay\b/.test(v))) failures.push('[events] the television and the projected wall each play a muted, inline, looped video that loads nothing before the frame comes near and never autoplays from the markup');
  if (!screens.some(([k, v]) => k === 'tv' && v.includes('/media/ev-activation-tv.mp4')) || !screens.some(([k, v]) => k === 'wall' && v.includes('/media/ev-activation-wall.mp4'))) failures.push('[events] the screens play their approved loops (ev-activation-tv.mp4, ev-activation-wall.mp4)');
  if (!/\shidden(?=[\s>=])/.test((live.match(/<div class="eva__live"[^>]*>/) || [''])[0]) || !/aria-hidden="true"/.test((live.match(/<div class="eva__live"[^>]*>/) || [''])[0])) failures.push('[events] the live layers wait, hidden, until a screen that can play them brings the frame near (the static render stands for them)');
  if (!/<button\b[^>]*data-ev-stage-toggle[^>]*aria-label="[^"]+"/.test(viz)) failures.push('[events] the playing screens have one labeled pause control');
  if (!evRules(/^\.eva__wall$/).some((r) => /mix-blend-mode:\s*screen/.test(r.body) && /mask-size:\s*100% 100%/.test(r.body)) || !/class="eva__wall"[^>]*style="[^"]*mask-image:\s*url\(/.test(live)) failures.push('[events] the projection is light on the wall: screened over it through its mask (the wall\'s texture, soft edges, nothing on the booth)');
  const stageJson = JSON.parse(fs.readFileSync(path.join(root, 'src/data/ev-activation.json'), 'utf8'));
  const quadOk = (q) => Array.isArray(q) && q.length === 4 && q.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1);
  if (!quadOk(stageJson.tv) || !quadOk(stageJson.wall)) failures.push('[events] ev-activation.json carries both screens\' corners');
  const qArea = (q) => Math.abs(q.reduce((s, [x, y], i) => s + x * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * y, 0) / 2);
  if (quadOk(stageJson.tv) && quadOk(stageJson.wall) && !(qArea(stageJson.wall) > qArea(stageJson.tv) * 2.5)) failures.push('[events] the projected wall is the large surface, the television the bright one');
  if (!(stageJson.wallOpacity >= 0.25 && stageJson.wallOpacity <= 0.45)) failures.push(`[events] the wall plays at about a quarter to two fifths of the television's intensity (found ${stageJson.wallOpacity})`);
  const tvLoop = evAsset('ev-activation-tv');
  if (!(stageJson.lum?.tv?.length >= Math.floor(tvLoop.duration * stageJson.rate) - 1) || !(stageJson.lum?.wall?.length > 20)) failures.push('[events] the screens\' light on the room follows what they show (their brightness over time)');
  // V1.2: the television calmed into the stable anchor (the charger card, about six seconds with a second's hold); the wall carries more of the motion, softer and lower in luminance.
  if (!/0:29\.20 to 0:34\.90/.test(tvLoop.source || '') || !/Want a wireless Bolt charger\?/.test(tvLoop.source || '')) failures.push('[events] the television plays the charger card: from its headline animating in, through the steps, to a second\'s hold');
  if (!(stageJson.surface?.wall < stageJson.surface?.tv)) failures.push(`[events] the projection stays lower in luminance than the television (found ${JSON.stringify(stageJson.surface)})`);
  const feather = Number((fs.readFileSync(path.join(root, 'scripts/render/activation-composite.py'), 'utf8').match(/^FEATHER = ([\d.]+)/m) || [])[1]);
  if (!(feather >= 0.085 && feather <= 0.1)) failures.push(`[events] the projection's edge feathering is about a third less than V1.1's 0.14 (found ${feather})`);
  for (const [id, aspect, min, max] of [['ev-activation-tv', '16:9', 5, 7], ['ev-activation-wall', '3:2', 7, 9]]) {
    const a = evAsset(id);
    if (a.permission !== 'approved' || a.type !== 'video' || a.aspect !== aspect || !(a.duration >= min && a.duration <= max) || !a.poster) failures.push(`[events] ${id} is an approved ${aspect} loop with its poster`);
  }
  for (const f of ['scripts/render/activation-booth.py', 'scripts/render/activation-composite.py', 'scripts/render/tex/bolt-yellow-4096.png', 'scripts/render/tex/bolt-mark-1000.png']) if (!fs.existsSync(path.join(root, f))) failures.push(`[events] ${f} is in the repository (the render's sources)`);
  // The render's reference (a vendor's slide) and the wordmark's SVG stay with the project, out of Git
  // (so they never reach GitHub) and out of the site.
  if (!/^reference\/$/m.test(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'))) failures.push('[events] reference/ (the render\'s reference material) is kept out of Git');
  for (const f of ['reference/events-video/booth-render.png', 'reference/events-video/bolt-liquidity-yellow.svg']) if (!fs.existsSync(path.join(root, f))) notes.push(`[events] ${f} is not in this checkout (local reference material, kept out of Git)`);
  if (files.some((f) => /booth-render|bolt-liquidity-yellow/i.test(path.basename(f)))) failures.push('[events] the render\'s reference and the brand source never reach the published site');
  if (evPage.includes('Desktop/') || evPage.includes('Booth Render')) failures.push('[events] nothing on the page points at a file on a desktop');

  // ---- what may not be said
  // A verified figure or named outcome reaches the page only from its approved
  // metric entry in assets.json (EvSlot sets it as .ev-slot__metric); outside
  // those, the page never names an integration or gives an exact figure.
  const evMetricIds = [...evNoCode.matchAll(/<p class="ev-slot__metric[^"]*"[^>]*data-asset="([\w-]+)"/g)].map((m) => m[1]);
  for (const id of evMetricIds) {
    const a = evAsset(id);
    if (!a.id || a.type !== 'metric' || a.permission !== 'approved' || !a.value) failures.push(`[events] ${id}: a figure or named outcome on the page comes only from an approved metric entry`);
  }
  const evUnverified = evNoCode.replace(/<p class="ev-slot__metric[\s\S]*?<\/p>/g, ' ');
  const evUnverifiedText = textOf(norm(evUnverified));
  for (const [re, what] of [[/\bpilot\b/i, 'an unannounced pilot'], [/\bcontract\b/i, 'contract discussions'], [/diligence/i, 'investor diligence'], [/data room/i, 'data rooms'], [/fundrais|funding round|raising/i, 'fundraising'], [/Foundation discussion/i, 'Foundation discussions'], [/youtube|youtu\.be/i, 'YouTube'], [/Sui Network/, 'confidential Sui negotiations']]) {
    if (re.test(evText) || re.test(evNoCode.replace(/<[^>]+>/g, ' '))) failures.push(`[events] the page never mentions ${what}`);
  }
  if (/Aftermath/i.test(evUnverifiedText) || /Aftermath/i.test(evUnverified.replace(/<[^>]+>/g, ' '))) failures.push('[events] the page never mentions a named integration before it is verified');
  if (/\d[\d,.]*\s*[KkMm]?\+?\s+(?:impressions|likes|views|reposts|shares)/.test(evUnverifiedText)) failures.push('[events] no exact engagement figures until they are verified');

  // ---- 04 The Expanding Production Deck (V1.3): deployed from the V1.2 review
  // checkpoint as approved, in place of the session, the production room and
  // Sui Fest. Three chapters in order, every rail always visible, one open at a
  // time (the first to begin with), each opened by a click, a tap or the
  // keyboard, never by itself; the checkpoint's words; a muted preview of 8 to
  // 15 seconds and the full film with sound; one credit line each; an
  // accordion on narrow screens; a short fade with reduced motion; all three
  // open without JavaScript.
  if (/<section class="(?:evm|evs|evf)"|id="ev-room"|id="ev-setup"|id="ev-suifest"|class="ev-credits|class="ev-cue\b/.test(evPage)) failures.push('[events] the deck replaces the three separate sections (the session, the production room and Sui Fest), with their tallies and credit blocks');
  const deckSec = evSection('evd');
  const DECK = [
    {
      key: 'live', label: 'Live presentation', headline: 'Build the session. Fill the room. Extend its life.',
      context: 'I organized and ran Bolt Liquidity’s presentation at Sui Summit, ETHDenver, in 2025 and 2026, from the speaking slot to the recording.',
      points: ['Booked the slot, helped shape the subject and promoted the session', 'Directed the deck and ran the setup and live slides', 'Captured it from multiple angles, then published it whole and in clips'],
      outcome: 'Event-led relationships contribute to ongoing conversations and integrations with key partners.',
      credit: 'Organized, directed and captured by John Cowin · Speaker Max McKendry · Deck design Bob van der Meer',
      preview: 'ev-max-loop', full: 'ev-room-presentation',
    },
    {
      key: 'room', label: 'Production room', headline: 'A compact setup. A full content system.',
      context: 'At ETHDenver 2026 I booked a production room at the venue and built a studio from what was on hand.',
      points: ['Set up two cameras, a clip-on mic and the venue’s own light', 'Wrote about 20 questions and directed multiple takes', 'Chose the strongest takes and wrote the edit direction'],
      outcome: 'Finished explainers, edited by Bob van der Meer from my takes and direction.',
      credit: 'Questions, direction, capture and edit briefs by John Cowin · On camera Max McKendry · Final edit Bob van der Meer',
      preview: 'ev-slippage-preview', full: 'ev-video-slippage-full',
    },
    {
      key: 'film', label: 'Event film', headline: 'If you cannot own the stage, create the moment everyone shares.',
      context: 'Bolt was not a sponsor at Sui Fest, TOKEN2049 Singapore, so the opportunity had to be made.',
      points: ['Developed the interview concept', 'Interviewed established teams on camera, Bolt one voice among many', 'Tagged every team, giving each a reason to share it'],
      outcome: 'Tens of thousands of impressions and hundreds of likes, shared by the teams themselves.',
      credit: 'Concept, interviews, coordination and distribution by John Cowin · With Cetus, Bluefin, 7K DeFi, NAVI & Astros, FlowX Finance, DoubleUp, Claynosaurz and Talus',
      preview: 'ev-suifest-loop', full: 'ev-video-suifest-full',
    },
  ];
  if (!/data-surface="dark"/.test((deckSec.match(/<section[^>]*>/) || [''])[0]) || !/<h2 id="ev-deck-title" class="sr-only"[^>]*>[^<]+<\/h2>/.test(deckSec)) failures.push('[events] the deck is on the dark ground of the screens, its section named for assistive technology');
  const deckChs = [...deckSec.matchAll(/<article class="evd__ch[^"]*"[^>]*data-deck-ch="([\w-]+)"[^>]*>([\s\S]*?)<\/article>/g)].map((m) => ({ key: m[1], html: m[2], open: /class="evd__ch is-open"/.test(m[0]) }));
  if (JSON.stringify(deckChs.map((c) => c.key)) !== JSON.stringify(DECK.map((c) => c.key)) || JSON.stringify((evData.deck?.chapters || []).map((c) => c.key)) !== JSON.stringify(DECK.map((c) => c.key))) failures.push(`[events] the deck's three chapters in order: live presentation, production room, event film (found ${deckChs.map((c) => c.key).join(', ')})`);
  if (JSON.stringify(deckChs.map((c) => c.open)) !== JSON.stringify([true, false, false])) failures.push('[events] one chapter open at a time, the live presentation to begin with');
  for (const [i, want] of DECK.entries()) {
    const ch = deckChs[i];
    if (!ch) continue;
    const rail = (ch.html.match(/<h3 class="evd__h"[^>]*><button\b([^>]*)>([\s\S]*?)<\/button><\/h3>/) || []);
    const railAttrs = rail[1] || '';
    if (!rail[0] || textOf(rail[2]) !== `${String(i + 1).padStart(2, '0')} ${want.label}` || !new RegExp(`aria-expanded="${i === 0}"`).test(railAttrs) || !new RegExp(`aria-controls="ev-deck-${want.key}"`).test(railAttrs) || !/type="button"/.test(railAttrs) || !new RegExp(`<div class="evd__body" id="ev-deck-${want.key}" role="region" aria-labelledby="ev-deck-rail-${want.key}"`).test(ch.html)) failures.push(`[events] chapter ${want.key}: its rail is a labeled button ("${String(i + 1).padStart(2, '0')} ${want.label}") that expands and collapses its region`);
    const got = {
      headline: one(ch.html, /<h4 class="display evd__title[^"]*"[^>]*>([\s\S]*?)<\/h4>/),
      context: one(ch.html, /<p class="evd__context[^"]*"[^>]*>([\s\S]*?)<\/p>/),
      points: [...(ch.html.match(/<ul class="evd__points[^"]*"[^>]*>([\s\S]*?)<\/ul>/) || [, ''])[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => textOf(m[1])),
      outcome: one(ch.html, /<p class="evd__outcome[^"]*"[^>]*>([\s\S]*?)<\/p>/),
      credit: one(ch.html, /<p class="evd__credit[^"]*"[^>]*>([\s\S]*?)<\/p>/),
    };
    // (Apostrophes may be typographic.)
    const flat = (t) => (t || '').replace(/[‘’]/g, "'");
    for (const k of ['headline', 'context', 'outcome', 'credit']) if (flat(got[k]) !== flat(want[k])) failures.push(`[events] chapter ${want.key}: its ${k} as the checkpoint has it (found "${got[k]}")`);
    if (JSON.stringify(got.points.map(flat)) !== JSON.stringify(want.points.map(flat)) || got.points.length > 3) failures.push(`[events] chapter ${want.key}: up to three things John did, as the checkpoint has them`);
    // its media: the preview (a silent loop of 8 to 15 seconds), the full film with sound, and the way to it
    const prev = evAsset(want.preview);
    const full = evAsset(want.full);
    if (!new RegExp(`<div class="evd__preview"[^>]*data-deck-preview[^>]*>\\s*<div class="ev-slot ev-slot--loop[^"]*"[^>]*data-asset="${want.preview}"[^>]*data-ev-loop`).test(ch.html) || prev.permission !== 'approved' || prev.type !== 'video' || !(prev.duration >= 8 && prev.duration <= 15)) failures.push(`[events] chapter ${want.key}: a muted preview of 8 to 15 seconds (${want.preview})`);
    if (!new RegExp(`<div class="evd__full"[^>]*data-deck-full[^>]*>\\s*<figure class="evp[^"]*"[^>]*data-evp[^>]*id="ev-deck-player-${want.key}"`).test(ch.html) || full.permission !== 'approved' || !ch.html.includes(`/media/${full.file}`)) failures.push(`[events] chapter ${want.key}: the full film (${want.full}) waits behind its preview, to play with sound`);
    if (textOf(norm((ch.html.match(/<button\b[^>]*data-deck-watch[^>]*>([\s\S]*?)<\/button>/) || [, ''])[1])).replace(/\s*\d+:\d\d$/, '') !== 'Watch full video with sound') failures.push(`[events] chapter ${want.key}: "Watch full video with sound"`);
    if (/\bautoplay\b/.test(ch.html)) failures.push(`[events] chapter ${want.key}: nothing autoplays from the markup`);
  }
  // Wide: side by side, the closed chapters narrowed to their rails; the open
  // one's width eases; its content fixed at the open width; narrow: an accordion.
  const deckWide = (re) => evRules(re).filter((r) => /@container[^@]*(?:min-width:\s*(\d+(?:\.\d+)?)rem|width\s*>=\s*(\d+(?:\.\d+)?)rem)/.test(r.at));
  const closedRule = deckWide(/^(?:html\.js )?\.evd__ch$/).map((r) => r.body).join(';');
  const openRule = deckWide(/^(?:html\.js )?\.evd__ch\.is-open$/).map((r) => r.body).join(';');
  if (!/flex:\s*0 0 var\(--rail\)/.test(closedRule) || !/flex-grow:\s*1\b/.test(openRule) || !/transition:[^;]*flex-grow/.test(closedRule) || !deckWide(/^(?:html\.js )?\.evd__row$/).some((r) => /flex-direction:\s*row/.test(r.body))) failures.push('[events] wide: the chapters side by side, the closed ones on their rails, the open one easing to its width');
  if (!evRules(/^(?:html\.js )?\.evd__body$/).some((r) => !r.at && /grid-template-rows:\s*0fr/.test(r.body) && /visibility:\s*hidden/.test(r.body)) || !evRules(/^(?:html\.js )?\.evd__ch\.is-open \.evd__body$/).some((r) => !r.at && /grid-template-rows:\s*1fr/.test(r.body))) failures.push('[events] narrow: a vertical accordion, closed chapters hidden from everyone');
  if (evRules(/^\.evd__body$/).some((r) => !r.at && /grid-template-rows:\s*0fr|visibility:\s*hidden/.test(r.body))) failures.push('[events] without JavaScript every chapter is open (the accordion needs the script)');
  const deckReduce = evRules(/evd__ch|evd__body|evd__chev/).filter((r) => /prefers-reduced-motion:\s*reduce/.test(r.at));
  if (!deckReduce.some((r) => /transition:\s*none/.test(r.body)) || !deckReduce.some((r) => /transition:\s*opacity\s+0?\.[1-3]\d*s/.test(r.body))) failures.push('[events] with reduced motion a chapter changes through a short fade, nothing morphs');
  const deckScript = pageScripts(evPage);
  if (!/\[data-ev-deck\]/.test(deckScript) || !/classList\.toggle\(\s*[`'"]is-open[`'"],\s*\w+\s*\)/.test(deckScript) || !/aria-expanded/.test(deckScript) || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].every((k) => deckScript.includes(k)) || !/\[data-deck-watch\]/.test(deckScript) || !/\.begin\(\)/.test(deckScript)) failures.push('[events] the deck opens a chapter on a click, a tap or the keyboard (arrows, Home, End), one at a time, and Watch plays the film with sound');
  if (/setInterval|requestIdleCallback/.test(deckScript.slice(deckScript.indexOf('[data-ev-deck]'), deckScript.indexOf('[data-ev-deck]') + 4000))) failures.push('[events] nothing advances the deck by itself');
  if (!evRules(/^\.evd__rail:focus-visible$/).some((r) => /outline:\s*2px solid/.test(r.body)) || !evRules(/^\.evd__watch:focus-visible$/).some((r) => /outline:\s*2px solid/.test(r.body))) failures.push('[events] the rails and the watch buttons show a strong focus ring');
  // Kept for the next revision: the setup photograph, its caption and the
  // finished explainer stay in the project (not on the page).
  const setupPhoto = evAsset('ev-image-production-setup');
  const finalFilm = evAsset('ev-video-slippage-full');
  if (setupPhoto.permission !== 'approved' || !fs.existsSync(path.join(root, 'src/assets', setupPhoto.file || '-')) || evData.setupFinal?.photo !== 'ev-image-production-setup' || evData.setupFinal?.caption !== 'Two cameras, two tripods, a clip-on mic, a laptop, and the venue’s existing lighting.' || evData.setupFinal?.final !== 'ev-video-slippage-full' || finalFilm.permission !== 'approved' || !fs.existsSync(path.join(root, 'public/media', finalFilm.file || '-')) || !fs.existsSync(path.join(root, 'src/assets', finalFilm.poster || '-'))) failures.push('[events] the setup photograph, its caption and the finished explainer stay in the project for the next revision');
  // Credits: one line per chapter, never a block per item; titles never invented.
  const deckCredits = deckChs.map((c) => one(c.html, /<p class="evd__credit[^"]*"[^>]*>([\s\S]*?)<\/p>/));
  if (!deckCredits[0]?.includes('Speaker Max McKendry') || !deckCredits[0]?.includes('Deck design Bob van der Meer') || !deckCredits[1]?.includes('On camera Max McKendry') || !deckCredits[1]?.includes('Final edit Bob van der Meer') || !deckCredits[2]?.includes('Cetus, Bluefin, 7K DeFi, NAVI & Astros, FlowX Finance, DoubleUp, Claynosaurz and Talus')) failures.push('[events] each chapter credits its collaborators in one line: the speaker and on-camera subject, the deck design and the final edit, the participating teams');
  if (/Max McKendry,\s*(?:Head|Chief|Director|Founder|Co-founder|CEO|CTO|VP)/i.test(evText)) failures.push('[events] no titles are invented for the collaborators');

  // ---- media: posters, nothing loaded early, controls where sound matters
  const players = [...evPage.matchAll(/<figure class="evp\b[\s\S]*?<\/figure>/g)].map((m) => m[0]);
  if (players.length !== 3) failures.push(`[events] the films with sound each have a player, one to a chapter of the deck: the presentation, the explainer, the event film (found ${players.length})`);
  for (const p of players) {
    const v = (p.match(/<video\b[^>]*>/) || [''])[0];
    if (!/preload="none"/.test(v) || !/\bposter="/.test(v) || !/\bcontrols\b/.test(v) || /\bautoplay\b/.test(v)) failures.push('[events] a player\'s video loads nothing before it is asked, has a poster, and keeps native controls without JavaScript');
    if (textOf(norm((p.match(/<button\b[^>]*data-evp-start[^>]*>([\s\S]*?)<\/button>/) || [, ''])[1])).replace(/\s*\d+:\d\d$/, '') !== 'Play with sound') failures.push('[events] each player offers "Play with sound"');
    if (!/<button\b[^>]*data-evp-play[^>]*aria-label="[^"]+"/.test(p) || !/<button\b[^>]*data-evp-mute[^>]*aria-label="[^"]+"/.test(p) || !/<input\b[^>]*type="range"[^>]*aria-label="Seek: [^"]+"[^>]*data-evp-seek/.test(p)) failures.push('[events] each player has labeled play or pause, mute or unmute, and seek controls');
  }
  for (const src of new Set([...evPage.matchAll(/<source src="[^"]*\/media\/([^"]+)"/g)].map((m) => m[1]))) {
    const f = path.join(root, 'public/media', src);
    if (!fs.existsSync(f)) failures.push(`[events] public/media/${src} is missing`);
    else if (fs.statSync(f).size > 25 * 1024 * 1024) failures.push(`[events] public/media/${src} is over 25 MB`);
  }
  for (const gone of ['ev-hero-present.mp4', 'ev-hero-engage.mp4', 'bolt-vs-amm-explainer.mp4', 'ev-hero-live.mp4', 'ev-hero-conversations.mp4', 'ev-hero-produced.mp4']) if (fs.existsSync(path.join(root, 'public/media', gone))) failures.push(`[events] public/media/${gone} is no longer used and is removed`);
  // Placeholders exist only while authoring.
  if (/data-pending|ev-slot--pending|Placeholder ·/.test(evPage)) failures.push('[events] no placeholder reaches the production build');
  // A silent loop (an approved screen animation) sits on its poster, muted,
  // looped and inline, loads nothing before it is in view, never autoplays from
  // the markup, and carries its own labeled pause control.
  for (const loop of [...evPage.matchAll(/<div class="ev-slot ev-slot--loop[\s\S]*?<\/button>/g)].map((m) => m[0])) {
    const v = (loop.match(/<video\b[^>]*>/) || [''])[0];
    if (!/\bmuted\b/.test(v) || !/\bloop\b/.test(v) || !/\bplaysinline\b/.test(v) || !/preload="none"/.test(v) || !/\bposter="/.test(v) || /\bautoplay\b/.test(v) || !/data-ev-loop\b/.test(loop) || !/<button\b[^>]*data-ev-loop-toggle[^>]*aria-label="Play: [^"]+"/.test(loop)) failures.push('[events] a silent loop is muted, looped, inline, on its poster, loads nothing early and has its own pause control');
  }
  // The production layer stays restrained: crop marks, timecodes and progress
  // lines (V1.3 retired the sections' cue tallies with their sections).
  if (!/evp__crop/.test(evPage) || !/evh__crop/.test(evPage)) failures.push('[events] the frames keep their crop marks');
  if (/class="ev-cue\b[\s\S]{0,400}?Run of show/.test(evPage)) failures.push('[events] the cue tallies no longer point at a run of show');
  if (evRules(/^\.(?:evh|evx|eva|evd|evc|evp)/).some((r) => /(?:^|;)\s*animation:[^;]*(?:glitch|flicker|shake)/.test(r.body))) failures.push('[events] no glitching or flicker');
  if (evRules(/^\.(?:evh|evx|eva|evd|evc|evp)/).some((r) => /(?:^|;)\s*animation:/.test(r.body) && !/animation:\s*none/.test(r.body) && !MOTION_OK.test(r.at) && !/\.ev-in$/.test(bare(r.sel)))) failures.push('[events] looping motion only with motion allowed');
  // The scripts: one reel at a time, paused off screen or hidden, posters for
  // reduced motion or saving data; the screens mapped onto the render; one
  // sound at a time.
  const evScripts = evScriptsAll;
  for (const token of ['[data-ev-reel]', '[data-reel-toggle]', 'is-waiting', 'IntersectionObserver', 'visibilitychange', 'prefers-reduced-motion: reduce', 'prefers-reduced-data: reduce', 'saveData', 'NotAllowedError', 'preload', '[data-evp]', 'muted', '[data-ev-deck]', '[data-deck-rail]', '[data-deck-watch]', 'aria-expanded', 'ArrowRight', 'ArrowLeft', '[data-ev-transition]', '[data-ev-reveal]', '[data-ev-loop]', '[data-ev-loop-toggle]', '[data-ev-stage]', 'matrix3d', '(min-width: 48rem)', '[data-evp-sound]', 'ResizeObserver']) {
    if (!evScripts.includes(token)) failures.push(`[events] the page's script is missing ${token}`);
  }
  if (!/\.pause\(\)/.test(evScripts) || !/addEventListener\(\s*[`"']play[`"']/.test(evScripts) || !/addEventListener\(\s*[`"']volumechange[`"']/.test(evScripts)) failures.push('[events] starting one video with sound, or turning its sound on, pauses every other');
  if (!/addEventListener\(\s*[`"']ended[`"']/.test(evScripts)) failures.push('[events] at the end of a chapter the reel moves on to the next');
}

// HOME (TPM V1, global): every page but the homepage leads its header with a
// restrained HOME link to the homepage in place of the name.
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  const rel = path.relative(dist, f);
  const headerHtml = (html.match(/<header class="site-header[\s\S]*?<\/header>/) || [''])[0];
  if (rel === 'index.html') {
    if (/brand--home/.test(headerHtml)) failures.push('[home] the homepage header carries no HOME link');
    continue;
  }
  const brand = (headerHtml.match(/<a\b[^>]*class="brand brand--home"[^>]*>([\s\S]*?)<\/a>/) || [, null])[1];
  if (brand === null || textOf(brand) !== 'Home' || !new RegExp(`<a href="${BASE}/" class="brand brand--home"`).test(headerHtml)) failures.push(`[home] ${rel}: the header must lead with the HOME link to the homepage`);
  if (/>\s*John Cowin\s*<\/a>/.test(headerHtml)) failures.push(`[home] ${rel}: the name no longer leads the header`);
}
if (!rulesFor(/\.brand--home\b/).some((r) => /text-transform:\s*uppercase/.test(r.body))) failures.push('[home] HOME is set in capitals through CSS');
// The house (TPM V1.2 delta): a small outlined house, Phosphor's House
// Simple, before the word, decorative, the label's size; a one-pixel rise on
// hover, none for reduced motion.
for (const f of htmlFiles) {
  const rel = path.relative(dist, f);
  if (rel === 'index.html') continue;
  const brand = (fs.readFileSync(f, 'utf8').match(/<a\b[^>]*class="brand brand--home"[^>]*>([\s\S]*?)<\/a>/) || [, ''])[1];
  if (!/^<svg\b[^>]*class="brand__house"[^>]*aria-hidden="true"[^>]*data-icon="house-simple"[\s\S]*?<\/svg>\s*Home\s*$/.test(brand.trim())) failures.push(`[home] ${rel}: a small outlined house leads the HOME link, hidden from assistive technology`);
}
if (!rulesFor(/\.brand__house/).some((r) => /width:\s*1\.25em/.test(r.body) && /height:\s*1\.25em/.test(r.body))) failures.push('[home] the house is set at the label\'s optical size');
if (!rulesFor(/:hover \.brand__house/).some((r) => !r.at && /translateY\(-1px\)/.test(r.body)) || !rulesFor(/:hover \.brand__house/).some((r) => /prefers-reduced-motion:\s*reduce/.test(r.at) && /transform:\s*none/.test(r.body))) failures.push('[home] the house rises a pixel on hover, and not for reduced motion');

// The opening sequence (TPM V1.2, global): homepage only, exactly three
// phrases ending on "Strategy into execution.", set as the faces of one
// restrained vertical cylinder, centered, smaller and lighter than the display
// headlines and one line long; turns of 400 to 550 ms, reading holds of 550 to
// 700 ms, the last a little longer, about 3.2 to 3.8 seconds in all with the
// handoff into the hero (which rises 12 to 16 px from slight softness, with a
// 102 to 100 percent correction, as its name and the navigation fade in, in
// that order); once per browsing session, decided before the first paint,
// never for a visit that began inside the site or a link to a section, a
// still crossfade for reduced motion, dismissed by any intent, hidden from
// assistive technology, the hero photograph and the faces preloaded.
const introHtml = (home.match(/<div class="intro"[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
const faces = [...introHtml.matchAll(/<p class="intro__face[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1]));
if (faces.join(' | ') !== 'Product complexity. | Market clarity. | Strategy into execution.') failures.push(`[intro] the opening sequence must be Product complexity. / Market clarity. / Strategy into execution. (found ${faces.join(' / ') || 'none'})`);
if (/Welcome\./.test(introHtml) || /intro__beat/.test(home)) failures.push('[intro] Welcome. is gone from the opening sequence');
if (!/<div class="intro"[^>]*aria-hidden="true"/.test(home)) failures.push('[intro] the opening sequence is decorative: aria-hidden');
const headHome = (home.match(/<head\b[^>]*>[\s\S]*?<\/head>/) || [''])[0];
const introHead = [...headHome.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((t) => t.includes('jc-intro')) || '';
for (const token of ['prefers-reduced-motion: reduce', 'sessionStorage', 'jc-intro', "classList.add('intro', 'intro-hold')", 'intro-still', 'document.referrer', 'location.hash', 'visibilityState', 'intro-wait']) if (!introHead.includes(token)) failures.push(`[intro] the head decision is missing "${token}"`);
// The session flag is set before any reason to skip, so it never plays later in a visit that began elsewhere on the site.
if (introHead.indexOf("setItem('jc-intro'") < 0 || introHead.indexOf("setItem('jc-intro'") > introHead.indexOf('location.hash')) failures.push('[intro] the session flag is set before the sequence decides to skip');
const ms = (v) => {
  const m = String(v).trim().match(/^(-?[\d.]+)(ms|s)$/);
  return m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : NaN;
};
const varsOf = (body) => Object.fromEntries([...body.matchAll(/--intro-([a-z0-9]+):\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]));
const holdRules = rulesFor(/^html\.intro-hold$/);
const PHONE = /max-width:\s*47\.99rem|width\s*<\s*48rem|width\s*<=\s*47\.99rem/;
const baseVars = varsOf(holdRules.filter((r) => !r.at).map((r) => r.body).join(';'));
const phoneVars = { ...baseVars, ...varsOf(holdRules.filter((r) => PHONE.test(r.at)).map((r) => r.body).join(';')) };
const hero = (name) => rulesFor(new RegExp(`^html\\.intro-hold \\.${name}\\b`)).filter((r) => MOTION_OK.test(r.at));
const handoff = (re) => {
  const rule = CSS_RULES.find((r) => MOTION_OK.test(r.at) && re.test(r.sel) && /animation:/.test(r.body));
  const v = rule ? (rule.body.match(/animation:\s*([^;]*)/) || [])[1] : '';
  const dur = ms((v.match(/(?:^|\s)(-?[\d.]+m?s)\b/) || [])[1] || '');
  const off = ms((v.match(/calc\(var\(--intro-hero\)\s*\+\s*([\d.]+m?s)\)/) || [])[1] || '0ms');
  return { v, dur, off };
};
const nameIn = handoff(/^html\.intro-hold \.hero__name\b/);
const navIn = handoff(/^html\.intro-hold \.site-header\b/);
const infoIn = handoff(/^html\.intro-hold \.hero__info\b/);
for (const [label, vars] of [['wide screens', baseVars], ['phones', phoneVars]]) {
  const t = Object.fromEntries(['lead', 'in', 'read', 'turn', 'last', 'out', 'gap', 'clear', 'settle'].map((k) => [k, ms(vars[k])]));
  if (Object.values(t).some((x) => Number.isNaN(x))) {
    failures.push(`[intro] ${label}: every timing value must be set (${JSON.stringify(vars)})`);
    continue;
  }
  if (t.read < 550 || t.read > 700) failures.push(`[intro] ${label}: each reading hold runs 550 to 700 ms (found ${t.read})`);
  if (t.last <= t.read || t.last > 760) failures.push(`[intro] ${label}: the final hold is a little longer than the others (found ${t.last} after ${t.read})`);
  for (const [k, v] of [['first turn', t.in], ['turn', t.turn]]) if (v < 400 || v > 550) failures.push(`[intro] ${label}: each ${k} runs 400 to 550 ms (found ${v})`);
  const reveal = t.lead + t.in + 2 * (t.read + t.turn) + t.last + t.gap;
  const total = reveal + Math.max(t.settle, nameIn.off + nameIn.dur, navIn.off + navIn.dur, infoIn.off + infoIn.dur);
  if (!(total >= 3200 && total <= 3800)) failures.push(`[intro] ${label}: the whole sequence with the handoff runs about 3.2 to 3.8 seconds (found ${total} ms)`);
  if (t.out >= t.gap + t.clear) failures.push(`[intro] ${label}: the last phrase dissolves before the ground has cleared`);
  if (label === 'phones' && total > (() => {
    const b = Object.fromEntries(['lead', 'in', 'read', 'turn', 'last', 'gap', 'settle'].map((k) => [k, ms(baseVars[k])]));
    return b.lead + b.in + 2 * (b.read + b.turn) + b.last + b.gap + Math.max(b.settle, nameIn.off + nameIn.dur, navIn.off + navIn.dur, infoIn.off + infoIn.dur);
  })()) failures.push('[intro] phones: the sequence is no longer than on wide screens');
}
const rise = Number((baseVars.rise || '').replace('px', ''));
if (!(rise >= 12 && rise <= 16)) failures.push(`[intro] the hero rises 12 to 16 px (found ${baseVars.rise})`);
if (!(nameIn.off < navIn.off && navIn.off < infoIn.off) || infoIn.off > 300) failures.push('[intro] the hero name, then the navigation, then its information fade in with a minimal stagger');
for (const [k, re] of [['photo', /^html\.intro-hold \.hero__photo\b/], ['subject', /^html\.intro-hold \.hero__subject\b/]]) {
  if (!CSS_RULES.some((r) => MOTION_OK.test(r.at) && r.sel.split(',').some((x) => re.test(x.trim())) && /hero-reveal/.test(r.body) && /var\(--intro-hero\)/.test(r.body))) failures.push(`[intro] the hero ${k} reveals with the handoff`);
}
const keyframes = (name) => (cssText.replace(/\/\*[\s\S]*?\*\//g, '').match(new RegExp(`@keyframes ${name}\\s*\\{((?:[^{}]*\\{[^{}]*\\})*)[^{}]*\\}`)) || [, ''])[1];
const reveal = keyframes('hero-reveal');
if (!/scale\(1\.02\)/.test(reveal) || !/blur\(/.test(reveal) || !/translate3d\(0,\s*var\(--intro-rise/.test(reveal)) failures.push('[intro] the hero reveal: a 14 px rise, a 102 percent correction and slight softness');
// The turns: a rotation about a horizontal axis behind the screen, from and to only (no overshoot), on curves that never leave 0 to 1.
for (const name of ['intro-turn-in', 'intro-turn-out', 'intro-turn-away']) {
  const k = keyframes(name);
  const stops = [...k.matchAll(/(^|\})\s*([^{}]+)\{/g)].map((m) => m[2].trim());
  if (!/rotateX\(/.test(k) || stops.some((x) => !/^(from|to|0%|100%)$/.test(x))) failures.push(`[intro] ${name} turns about a horizontal axis, from and to only (found ${stops.join(', ') || 'none'})`);
}
const drum = rulesFor(/^\.intro__drum\b/).map((r) => r.body).join(';');
const easings = [...(rulesFor(/^html\.intro \.intro__drum\b/).map((r) => r.body).join(';') + drum).matchAll(/cubic-bezier\(([^)]*)\)/g)].map((m) => m[1].split(',').map(Number));
if (!easings.length || easings.some(([, y1, , y2]) => y1 < 0 || y1 > 1 || y2 < 0 || y2 > 1)) failures.push('[intro] the turns ease without bounce or overshoot');
if (!/perspective:/.test(drum) || !/transform-origin:\s*50% 50% calc\(-1 \* var\(--intro-r\)\)/.test(rulesFor(/^\.intro__face\b/).map((r) => r.body).join(';'))) failures.push('[intro] the phrases are faces of one drum: a perspective and an axis behind the screen');
const weight = Number((drum.match(/font-weight:\s*(\d+)/) || [])[1]);
if (!(weight < 700) || !/font-family:\s*var\(--font-display\)/.test(drum)) failures.push(`[intro] the phrases use the portfolio's display face, lighter than its headlines (found ${weight})`);
const maxRem = Number((drum.match(/clamp\([^,]+,[^,]+,\s*([\d.]+)rem\)/) || [])[1]);
const lineEm = Number((drum.match(/\(100vw - 2 \* var\(--gutter\)\)\s*\/\s*([\d.]+)/) || [])[1]);
if (!(maxRem <= 3.5) || !(lineEm >= 10.6)) failures.push(`[intro] the phrases are smaller than before and Strategy into execution. keeps to one line (max ${maxRem}rem, line bound ${lineEm}em)`);
if (!/place-items:\s*center/.test(drum) || !/white-space:\s*nowrap/.test(rulesFor(/^\.intro__face\b/).map((r) => r.body).join(';'))) failures.push('[intro] every phrase is centered, on one line, at one center');
if (!rulesFor(/^html\.intro-still \.intro__face--3\b/).some((r) => /opacity:\s*1/.test(r.body)) || !CSS_RULES.some((r) => /prefers-reduced-motion:\s*reduce/.test(r.at) && /^html\.intro-still/.test(r.sel) && /animation-delay:/.test(r.body))) failures.push('[intro] reduced motion: the final phrase, still, then a timed crossfade');
const introScript = scriptsText.find((t) => t.includes('intro-skip')) || '';
for (const token of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll']) if (!introScript.includes(token)) failures.push(`[intro] the sequence must end on "${token}"`);
// Preloaded: the hero photograph's two layers, exactly as its pictures request them, and the two faces of the first screen.
const heroAvif = [...home.matchAll(/<source[^>]*srcset="([^"]*)"[^>]*type="image\/avif"/g)].map((m) => m[1]);
const preImages = [...headHome.matchAll(/<link rel="preload" as="image" type="image\/avif" imagesrcset="([^"]*)" imagesizes="100vw"/g)].map((m) => m[1]);
if (preImages.length !== 2 || preImages.some((x) => !heroAvif.includes(x)) || !preImages.some((x) => /portrait/.test(x)) || !preImages.some((x) => /foreground/.test(x))) failures.push('[intro] the hero photograph (both layers) is preloaded as its pictures request it');
const preFonts = [...headHome.matchAll(/<link rel="preload" as="font" type="font\/woff2" href="([^"]+)" crossorigin/g)].map((m) => m[1]);
if (preFonts.length !== 2 || preFonts.some((x) => !fs.existsSync(path.join(dist, x.replace(BASE, ''))) || !cssText.includes(path.basename(x)))) failures.push('[intro] the two faces of the first screen are preloaded, as the stylesheet requests them');
for (const f of htmlFiles) {
  if (path.relative(dist, f) === 'index.html') continue;
  const html = fs.readFileSync(f, 'utf8');
  if (/jc-intro|class="intro"/.test(html)) failures.push(`[intro] ${path.relative(dist, f)}: the opening sequence is for the homepage only`);
}

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
  // Decorative entries (the reel) carry empty alt text on purpose.
  if (a.decorative) {
    if (a.alt !== '') failures.push(`[manifest] ${a.id}: a decorative entry must have empty alt text`);
  } else if (!a.alt) failures.push(`[manifest] ${a.id}: missing alt text`);
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
  for (const m of s.matchAll(/"(portrait|docPanel|websiteFrame|summitStill|metric|media|screen|cover)":\s*"([a-z0-9-]+)"/g)) idRefs.add(m[2]);
  // Select Work card media in each case study's frontmatter.
  if (f.endsWith('.mdx')) {
    for (const m of s.matchAll(/^\s*(?:main|motion):\s*["']([a-z0-9-]+)["']/gm)) idRefs.add(m[1]);
    for (const m of s.matchAll(/^\s*side:\s*\[([^\]]+)\]/gm)) for (const id of m[1].matchAll(/["']([a-z0-9-]+)["']/g)) idRefs.add(id[1]);
  }
}
// Ids referenced from home.json structures that the generic scan above cannot see
// (the reel's pool, and the hero portrait).
const homeData = JSON.parse(fs.readFileSync(path.join(root, 'src/data/home.json'), 'utf8'));
for (const id of homeData.reel?.pool ?? []) {
  idRefs.add(id);
  const a = manifest.assets.find((x) => x.id === id);
  if (a && (a.permission !== 'approved' || !a.decorative || a.type !== 'image')) failures.push(`[manifest] reel piece ${id} must be an approved, decorative image`);
}
if ((homeData.reel?.pool ?? []).length !== (homeData.reel?.perRow ?? 0) * 3) failures.push('[claim] the reel pool must fill three rows of reel.perRow pieces');
if (homeData.hero?.portrait) idRefs.add(homeData.hero.portrait);
if (homeData.hero?.foreground) idRefs.add(homeData.hero.foreground);

for (const id of idRefs) {
  if (!ids.has(id) && !['context', 'role', 'main', 'top', 'work', 'about', 'contact', 'capabilities'].includes(id)) {
    // Section ids in MDX also match the pattern; only flag ids that look like asset ids.
    if (/^(hero|card|about|cc|tm|ev|og|rail|reel)-/.test(id)) failures.push(`[manifest] referenced asset id "${id}" is not in assets.json`);
  }
}
// Ids named by the Events page's data (its sources, players, kit and placeholders).
for (const m of fs.readFileSync(path.join(root, 'src/data/events.json'), 'utf8').matchAll(/"(ev-[a-z0-9-]+)"/g)) {
  if (ids.has(m[1])) idRefs.add(m[1]);
  else failures.push(`[manifest] events.json names "${m[1]}", which is not in assets.json`);
}
const unused = [...ids].filter((id) => !idRefs.has(id));
if (unused.length) notes.push(`[manifest] unreferenced asset ids (fine, but tidy up if unneeded): ${unused.join(', ')}`);

// ------------------------------------------------------ 4. hygiene
// No Finder metadata ships or is tracked, and nothing oversized (such as the
// full-length explainer video) reaches dist. The original video masters (the
// hero animation, the slippage explainer, the Version 2.0 sources: the
// creator videos, the architecture recording, Sui Fest and the Sui Summit
// presentation, and bolt-in-60-seconds.mp4, the source of the Technical
// Product Marketing hero) never enter the site under their own names either;
// only the web loops made from them do.
const MASTER_NAME = /hero animation|slippage explained|bolt explainers|aftermovie\.|paper airplane|bolt bus trailer|architecture diagram video|max presentation|^suifest\.mp4$|^bolt-in-60-seconds\.mp4$/i;
for (const f of [...files, ...walk(path.join(root, 'public'))]) {
  if (MASTER_NAME.test(path.basename(f))) failures.push(`[hygiene] ${path.relative(root, f)} looks like an original video master; only its web preview belongs in the site`);
}
for (const f of files) {
  const rel = path.relative(dist, f);
  if (path.basename(f) === '.DS_Store') failures.push(`[hygiene] dist/${rel} must not ship`);
  const mb = fs.statSync(f).size / 1048576;
  if (mb > 25) failures.push(`[hygiene] dist/${rel} is ${mb.toFixed(0)} MB; nothing over 25 MB belongs on the site`);
}
try {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
  for (const t of tracked.filter((x) => /(^|\/)\.DS_Store$/.test(x))) failures.push(`[hygiene] ${t} is tracked by git`);
  for (const t of tracked.filter((x) => /chatgpt #2/i.test(x) || /(^|\/)ChatGPT\.svg$/.test(x))) failures.push(`[hygiene] ${t}: only the normalized chatgpt.svg belongs in the repository`);
  for (const t of tracked.filter((x) => x.startsWith('reference/'))) failures.push(`[hygiene] ${t} is reference material: it stays in the project folder, out of Git`);
  for (const t of tracked.filter(Boolean)) {
    const full = path.join(root, t);
    if (fs.existsSync(full) && fs.statSync(full).size > 25 * 1048576) failures.push(`[hygiene] ${t} is tracked and over 25 MB; video masters stay outside the repository`);
  }
} catch {
  notes.push('[hygiene] git not available; skipped the tracked-file check');
}

// ------------------------------------------------------------- 5. axe
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
