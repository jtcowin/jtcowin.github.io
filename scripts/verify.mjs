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
  // v1.7: John did not lead a community function in this B2B role.
  { re: /community strateg/i, why: 'the portfolio must not imply community strategy' },
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
// v1.5: the standalone metrics strip is gone; v1.7 moves the figures to the
// case-study pages (see Select Work below).
if (/class="proof[\s"]/.test(home)) failures.push('[claim] the standalone metrics strip was retired in v1.5');
const release = process.argv.includes('--release') || process.env.RELEASE === '1';
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
if (!/Web3 marketing, strategy, (?:&amp;|&#38;|&) content/i.test(home)) failures.push('[claim] hero must carry the approved descriptor');
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

// The work reel (v1.7): no visible title or paragraph, a visually hidden
// heading, three rows moving right, left, right. Placeholder frames are
// allowed for review builds only.
const reelAt = at('data-reel');
const reelHtml = reelAt < 0 ? '' : home.slice(home.lastIndexOf('<section', reelAt), home.indexOf('</section>', reelAt));
if (!/<h2 id="reel-heading" class="sr-only"[^>]*>[^<]+<\/h2>/.test(reelHtml)) failures.push('[claim] the reel must be named by a visually hidden heading');
if (textOf(reelHtml.replace(/<h2[\s\S]*?<\/h2>/, '').replace(/<[^>]*\balt="[^"]*"[^>]*>/g, '')) !== '') failures.push('[claim] the reel must carry no visible text');
const reelDirs = [...reelHtml.matchAll(/data-reel-row data-direction="(left|right)"/g)].map((m) => m[1]).join(',');
if (reelDirs !== 'right,left,right') failures.push(`[claim] the reel rows must move right, left, right (found ${reelDirs || 'none'})`);
const reelFrames = (reelHtml.match(/<li class="reel__frame/g) || []).length;
const reelPlaceholders = (reelHtml.match(/<li class="reel__frame reel__frame--t\d/g) || []).length;
if (reelPlaceholders) {
  // Each row is laid out twice for the seamless loop, so a slot is two frames.
  const msg = `[reel] ${reelPlaceholders / 2} of ${reelFrames / 2} reel slots are placeholders; replace them with approved stills before pushing`;
  if (release) failures.push(msg);
  else notes.push(msg + ' (fails with --release)');
}

// From positioning to production (v1.7): What I Do and How I Work in one
// frame. AI appears only as an enabler, in a short working-style statement.
const prHtml = sectionAt(at('id="capabilities"'));
if (!/<h2 id="practice-heading"[^>]*>From positioning to production\.<\/h2>/.test(prHtml)) failures.push('[claim] the combined section must be headed "From positioning to production."');
const prLabels = [...prHtml.matchAll(/<h3 class="practice__label"[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1].trim()).join(', ');
if (prLabels !== 'How I Work, Capabilities, Stack') failures.push(`[claim] the combined section's labels must be How I Work, Capabilities, Stack (found ${prLabels})`);
const prCaps = [...prHtml.matchAll(/<span class="cap__title"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]).join(' | ');
if (prCaps !== 'Positioning and messaging | Technical content and websites | Partnerships and KOL programs | Campaigns and distribution') {
  failures.push(`[claim] the four capability groups must be the approved ones, in order (found ${prCaps})`);
}
const prGroups = [...prHtml.matchAll(/<h4 class="stack__name"[^>]*>([^<]+)<\/h4>/g)].map((m) => m[1]).join(' | ');
if (prGroups !== 'AI and building | Systems and measurement | Creative and distribution') failures.push(`[claim] the Stack groups must be the approved three, in order (found ${prGroups})`);
const prTools = (prHtml.match(/<li class="tool[ "]/g) || []).length;
if (prTools < 12 || prTools > 15) failures.push(`[claim] the Stack should show about 12 to 15 primary tools (found ${prTools})`);
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
// Contact and footer.
if (!/Make the complex impossible to ignore/.test(home)) failures.push('[claim] homepage must use the approved contact headline');
for (const f of htmlFiles) {
  const line = (fs.readFileSync(f, 'utf8').match(/<p class="site-footer__line"[^>]*>([\s\S]*?)<\/p>/) || [])[1];
  if (!line || textOf(line) !== 'Web3 Marketing, Strategy, & Content') failures.push(`[claim] ${path.relative(dist, f)}: the footer must carry the approved line "Web3 Marketing, Strategy, & Content"`);
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
  // Select Work card media in each case study's frontmatter.
  if (f.endsWith('.mdx')) {
    for (const m of s.matchAll(/^\s*(?:main|motion):\s*["']([a-z0-9-]+)["']/gm)) idRefs.add(m[1]);
    for (const m of s.matchAll(/^\s*side:\s*\[([^\]]+)\]/gm)) for (const id of m[1].matchAll(/["']([a-z0-9-]+)["']/g)) idRefs.add(id[1]);
  }
}
// Ids referenced from home.json structures that the generic scan above cannot see
// (the reel's frames, and the hero portrait).
const homeData = JSON.parse(fs.readFileSync(path.join(root, 'src/data/home.json'), 'utf8'));
for (const row of homeData.reel?.rows ?? []) for (const fr of row.frames ?? []) if (fr.asset) idRefs.add(fr.asset);
if (homeData.hero?.portrait) idRefs.add(homeData.hero.portrait);
if (homeData.hero?.foreground) idRefs.add(homeData.hero.foreground);

for (const id of idRefs) {
  if (!ids.has(id) && !['context', 'role', 'main', 'top', 'work', 'about', 'contact', 'capabilities'].includes(id)) {
    // Section ids in MDX also match the pattern; only flag ids that look like asset ids.
    if (/^(hero|card|about|cc|tm|ev|og|rail)-/.test(id)) failures.push(`[manifest] referenced asset id "${id}" is not in assets.json`);
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
