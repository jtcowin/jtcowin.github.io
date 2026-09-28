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
  if ((c.match(/class="card__panel card__panel--main"/g) || []).length !== 1 || (c.match(/class="card__panel card__panel--side"/g) || []).length !== 2) {
    failures.push(`[claim] card ${i + 1} must have one dominant panel and two supporting panels`);
  }
  const visible = textOf(c.replace(/<span class="card__num"[\s\S]*?<\/span>/, ''));
  const figures = (visible.match(/\d[\d.,]*[%MKx]?/g) || []).filter((f) => !(i === 0 && f === '1.25M'));
  if (figures.length) failures.push(`[claim] card ${i + 1} must leave its metrics to the case-study page (found ${figures.join(', ')})`);
  if (/1\.25M/.test(visible) && !/Approximately 1\.25M impressions/.test(visible)) failures.push('[claim] the creator card may show only "Approximately 1.25M impressions"');
});
// The dominant-panel loop: muted, inline, looping, a poster, nothing loaded
// until needed, no player controls, and a pause control for the reader.
for (const video of workHtml.match(/<video\b[^>]*>/g) || []) {
  for (const attr of ['muted', 'loop', 'playsinline', 'preload="none"', 'poster="']) {
    if (!video.includes(attr)) failures.push(`[claim] the card loop is missing ${attr}`);
  }
  if (/\b(?:controls|autoplay)\b/.test(video)) failures.push('[claim] the card loop must not show player controls or autoplay from the HTML');
  if (!/data-card-toggle/.test(workHtml)) failures.push('[claim] a card loop needs its pause control');
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
// order for the browser session. No video.
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
for (const token of ['(hover: hover) and (pointer: fine)', '(prefers-reduced-motion: reduce)', 'pointermove', 'pointerleave', 'requestAnimationFrame', 'touch']) {
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
// full-length explainer video) reaches dist.
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
