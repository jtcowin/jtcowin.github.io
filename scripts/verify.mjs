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
    if (paras.length !== 1 || paras[0] !== "If you need someone who can carry its story from positioning through execution, let's talk.") {
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
for (const slug of ['creator-campaigns', 'technical-marketing', 'events-video']) {
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
  for (const m of s.matchAll(/"(portrait|docPanel|websiteFrame|summitStill|metric)":\s*"([a-z0-9-]+)"/g)) idRefs.add(m[2]);
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
const unused = [...ids].filter((id) => !idRefs.has(id));
if (unused.length) notes.push(`[manifest] unreferenced asset ids (fine, but tidy up if unneeded): ${unused.join(', ')}`);

// ------------------------------------------------------ 4. hygiene
// No Finder metadata ships or is tracked, and nothing oversized (such as the
// full-length explainer video) reaches dist. The original video masters (the
// hero animation, the slippage explainer, and the Version 2.0 sources: the
// creator videos, the architecture recording, Sui Fest and the Sui Summit
// presentation) never enter the site under their own names either; only the
// web loops made from them do.
const MASTER_NAME = /hero animation|slippage explained|bolt explainers|aftermovie\.|paper airplane|bolt bus trailer|architecture diagram video|max presentation|^suifest\.mp4$/i;
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
