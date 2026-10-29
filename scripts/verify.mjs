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
import { createHash } from 'node:crypto';
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
  { re: /524\s?%/, why: 'retired Trezor lift claim (V1.1 approves it only as the creator-account highlight, in its exact form)' },
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
  // Creator Marketing V1.2: the impressions aggregate is retired everywhere, and the Trezor ranking is by reach.
  { re: /1\.25\s?M\b|1,250,000|1\.25 million/i, why: 'the retired impressions aggregate (Creator Marketing V1.2)' },
  { re: /most[- ]viewed/i, why: 'the Trezor ranking is "#2 by reach", never most-viewed (Creator Marketing V1.2)' },
];
// Two em dashes are approved, and each is excised in its exact approved form
// before the guardrails run: the hero name stream separates its repeats with
// one, which is deliberate typography rather than prose punctuation, and the
// Version 1.9 footer credit, "© <year> John Cowin — Built end to end.", keeps
// one on purpose. Everything else is still tested, so an em dash anywhere
// else, or in a reworded credit, still fails.
const STREAM = /<span class="stream"[\s\S]*?<\/span>\s*<\/h1>/g;
const FOOTER_CREDIT = /(<p class="site-footer__meta[^"]*"[^>]*>)© \d{4} John Cowin — Built end to end\.(<\/p>)/g;
// Creator Marketing and Partnerships V1.4: the credits name the creators by
// their public X handles only, so the one confirmed creator title that V1.0 to
// V1.3 excised here (Raj's, among his affiliations in the credits) appears
// nowhere any more and its exemption is gone: "Head of" anywhere fails.
// Creator Marketing and Partnerships V1.1 approves one figure that the guardrail
// above had retired: "524%", only as the Trezor Dare Ad's first creator-account
// highlight, its value immediately followed by its exact label (the framing note
// and the other highlights are checked with the page below). Anywhere else, or
// with any other label, it still fails.
const TREZOR_HIGHLIGHT = /(<strong class="cmz__value"[^>]*>)524%(<\/strong><span class="cmz__metric-label"[^>]*>above the account(?:&#39;|')s average impressions<\/span>)/g;

for (const f of htmlFiles) {
  const raw = fs.readFileSync(f, 'utf8');
  const html = raw.replace(STREAM, '').replace(FOOTER_CREDIT, '$1$2').replace(TREZOR_HIGHLIGHT, '$1$2');
  for (const { re, why } of forbidden) {
    const m = html.match(re);
    if (m) failures.push(`[guardrail] ${path.relative(dist, f)} contains "${m[0]}" (${why})`);
  }
}
// The creator page. Creator Marketing and Partnerships V1.0 gave it its own
// page and retired the shared layout's figures (the aggregate impressions,
// the account benchmark and its methodology note) with it; the page's words
// are checked in its own section below.
const creator = fs.readFileSync(path.join(dist, 'work/creator-campaigns/index.html'), 'utf8');
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
// About Copy delta (October 2026): John's approved headline, three short
// sentences, each its own piece of the heading and kept whole (one to a line
// on phones and tablets, one line across the canvas on desktop).
const aboutHeading = (home.match(/<h2 id="about-heading"[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || '';
const aboutHeadingText = aboutHeading.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const headingPieces = [...aboutHeading.matchAll(/<span class="about__line"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => m[1]);
if (aboutHeadingText !== 'Creative instincts. Operator discipline. Built for DeFi.') failures.push(`[claim] About must use the approved headline, "Creative instincts. Operator discipline. Built for DeFi." (found "${aboutHeadingText}")`);
if (headingPieces.join('|') !== 'Creative instincts.|Operator discipline.|Built for DeFi.') failures.push(`[claim] each sentence of the About headline is its own piece, kept whole (found ${headingPieces.join(' | ') || 'none'})`);
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
// (About Copy delta, October 2026: all three paragraphs as John approved them.)
// V1.3 (October 2026): John's approved four paragraphs, word for word.
const approvedParagraphs = [
  'For a decade, I built audiences and ran the business side of a global music project. That work landed sponsorships, media appearances, and major bookings. In 2021, I brought those skills to DeFi.',
  'Phi Labs Global hired me in 2024 to lead social across a product portfolio with an audience of more than 200,000 people. Over time, I took ownership of positioning and messaging, technical documentation and websites, partnerships and KOL management, and campaigns and distribution.',
  'At Bolt Liquidity, I joined before launch and worked across product marketing, partnerships, content, and growth, helping drive ecosystem relationships and integrations as the protocol grew from zero to more than $300 million in processed volume.',
  'Today, I turn complex products into stories people understand and connect with.',
];
if (paragraphHtml.length !== approvedParagraphs.length) failures.push(`[claim] About must present the four approved paragraphs (found ${paragraphHtml.length})`);
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
if (marks.join(' | ') !== 'global music project | more than 200,000 people | more than $300 million in processed volume') {
  failures.push(`[claim] About must highlight exactly the three chosen phrases, in order (found: ${marks.join(' | ') || 'none'})`);
}
// The brief's retained wording, named so that no later edit drops it unnoticed.
for (const [where, text, phrase] of [
  ['the headline', aboutHeadingText, 'Built for DeFi.'],
  ['the second paragraph', textOf(paragraphHtml[1] || ''), 'lead social'],
  ['the second paragraph', textOf(paragraphHtml[1] || ''), 'a product portfolio with an audience of more than 200,000 people'],
  ['the third paragraph', textOf(paragraphHtml[2] || ''), 'from zero to more than $300 million in processed volume'],
  ['the closing paragraph', textOf(paragraphHtml[3] || ''), 'understand and connect with.'],
]) {
  if (!text.includes(phrase)) failures.push(`[claim] About keeps "${phrase}" in ${where} (About Copy delta)`);
}
// The closing line ends on its last three words together, and only it does.
if (!/<span class="flow__keep"[^>]*>\s*<span class="w">and<\/span>\s+<span class="w">connect<\/span>\s+<span class="w">with\.<\/span>\s*<\/span>\s*$/.test(paragraphHtml[3] || '') || (flow.match(/class="flow__keep"/g) || []).length !== 1) {
  failures.push('[claim] the closing paragraph keeps "and connect with." together, and nothing else is held');
}
if (/<(?:b|em|mark|u)[\s>]/.test(flow) || /<strong(?![^>]*class="flow__mark")/.test(flow)) {
  failures.push('[claim] nothing in the About narrative may be emphasized besides the three approved phrases');
}
const closing = (flow.match(/<div class="flow__close"[\s\S]*?<\/div>/) || [''])[0];
const thirdAt = closing.indexOf('flow__p--close');
if (thirdAt < 0 || closing.indexOf('flow__resume') < thirdAt || !/Read the full resume/.test(closing)) {
  failures.push('[claim] the "Read the full resume" button must follow the concluding paragraph on the closing row');
}
// V1.3: Bolt Liquidity is named in the approved third paragraph; no other product is.
for (const product of ['Archway', 'Ambur']) {
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
  // retired in Full Site Iteration V1
  'expanded into positioning, technical',
  // retired in the About Copy delta (October 2026)
  'I came to DeFi in 2021',
  'globally distributed',
  'joined Phi Labs Global',
  'manage social',
  'As the company evolved',
  'my role expanded into',
  'product complexity',
  'market narratives',
  'along the way',
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
// V1.3 (October 2026): the commercial proof, after About and its trust bar and before Select Work, on the Select
// Work chapter's dark ground (so the chapters keep surfaces 02 to 05). One dominant result, John's approved
// paragraph, then the three direct integrations in order with the downstream statement attached; no cards, no
// count for the downstream integrations, no Sui Foundation or Mysten Labs.
{
  const impact = (home.match(/<section id="impact"[\s\S]*?<\/section>/) || [''])[0];
  const impactAt = home.indexOf('<section id="impact"');
  const t = textOf(impact);
  const want = ['COMMERCIAL IMPACT', '$0 → $300M+', 'processed protocol volume', "I joined Bolt before launch and helped drive direct integrations with Cetus, Aftermath, and FlowX. Because other Sui applications were integrated with those aggregators, the work also created downstream integration paths beyond the three direct relationships. As Bolt's distribution expanded, the protocol grew from zero to more than $300 million in processed volume.", 'DIRECT AGGREGATOR INTEGRATIONS', 'Additional downstream integrations through connected Sui applications'];
  const missing = want.filter((w) => !t.includes(w));
  if (!impact || missing.length) failures.push(`[claim] V1.3: the commercial proof carries John's approved copy word for word (missing: ${missing.join(' | ') || 'the section'})`);
  if (!(impactAt > home.indexOf('class="logobar') && impactAt < home.indexOf('id="work"'))) failures.push('[claim] V1.3: the commercial proof sits after the trust bar and before Select Work');
  const logos = [...impact.matchAll(/data-integration="([\w-]+)"/g)].map((m) => m[1]).join(',');
  if (logos !== 'cetus,aftermath,flowx') failures.push(`[claim] V1.3: the integrations show Cetus, Aftermath and FlowX in that order (found ${logos})`);
  if ((impact.match(/class="impact__figure"/g) || []).length !== 1 || /Sui Foundation|Mysten/.test(t) || /\d+\s+(?:downstream|applications|apps)/i.test(t)) failures.push('[claim] V1.3: one dominant result, no Sui Foundation or Mysten Labs, and no count for the downstream integrations');
  for (const f of ['cetus.svg', 'aftermath.svg', 'flowx.svg']) {
    const a = path.join(root, 'src/assets/integrations', f);
    if (!fs.existsSync(a) || /<script|https?:\/\/(?!www\.w3\.org)/i.test(fs.readFileSync(a, 'utf8'))) failures.push(`[asset] src/assets/integrations/${f} is John's supplied SVG, local, with no script or external reference`);
  }
}
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

// Mobile Optimization V1, the homepage hero on phones (below 48rem): the name
// runs higher, its letters starting just under the header row (through the
// hair, above the brows, behind the portrait as everywhere), a little smaller
// (15vw); the grade's band moves up with it; no rule across the chest; the
// arrow, a little smaller and as heavy, leads the descriptor as one lockup
// (both set left, the lockup still at the lower right); with reduced motion
// the still name starts in the open wall beside the head. Tablets and
// desktops keep the composition: the name at 31% (24% from 60rem), the rule,
// the arrow above the right-set descriptor.
const heroPhone = (re) => CSS_RULES.filter((r) => re.test(r.sel.replace(/\[data-astro-cid-[^\]]*\]/g, '')) && /max-width:\s*47\.99rem|width\s*<=\s*47\.99rem/.test(r.at));
const heroBase = (re) => CSS_RULES.filter((r) => re.test(r.sel.replace(/\[data-astro-cid-[^\]]*\]/g, '')) && !r.at).map((r) => r.body).join(';');
const nameP = heroPhone(/^\.hero__name$/).map((r) => r.body).join(';');
if (!/--name-size:\s*15vw/.test(nameP) || !/top:\s*calc\(var\(--header-row\)\s*\+\s*\.?0?\.6rem\s*-\s*\.?0?\.1\s*\*\s*var\(--name-size\)\)/.test(nameP) || !/font-size:\s*var\(--name-size\)/.test(nameP)) failures.push('[mobile] on phones the hero name runs just under the header row, at 15vw (found "' + nameP + '")');
if (!/top:\s*31%/.test(heroBase(/^\.hero__name$/)) || !CSS_RULES.some((r) => /^\.hero__name$/.test(r.sel.replace(/\[data-astro-cid-[^\]]*\]/g, '')) && DESKTOP.test(r.at) && /top:\s*24%/.test(r.body))) failures.push('[mobile] tablets and desktops keep the hero name where it was (31%, 24% from 60rem)');
if (!heroPhone(/^\.hero__rule--front$/).some((r) => /display:\s*none/.test(r.body))) failures.push('[mobile] on phones no rule crosses the chest');
const infoP = heroPhone(/^\.hero__info$/).map((r) => r.body).join(';');
const arrowP = heroPhone(/^\.hero__arrow$/).map((r) => r.body).join(';');
if (!/grid-auto-flow:\s*column/.test(infoP) || !/text-align:\s*left/.test(infoP) || !/width:\s*1\.25rem/.test(arrowP) || !/stroke-width:\s*1\.75/.test(arrowP)) failures.push('[mobile] on phones the arrow, a little smaller and as heavy, leads the descriptor as one lockup');
if (!/justify-items:\s*end/.test(heroBase(/^\.hero__info$/)) || !/text-align:\s*right/.test(heroBase(/^\.hero__info$/))) failures.push('[mobile] wider screens keep the arrow above the right-set descriptor');
if (!heroPhone(/^\.hero__grade$/).length) failures.push('[mobile] on phones the grade\'s band moves up with the name');
if (!CSS_RULES.some((r) => /^\.stream__track$/.test(r.sel.replace(/\[data-astro-cid-[^\]]*\]/g, '')) && /47\.99rem/.test(r.at) && /prefers-reduced-motion:\s*reduce/.test(r.at) && /translate(?:3d)?\(60vw/.test(r.body))) failures.push('[mobile] with reduced motion a phone\'s still name starts beside the head, its first word whole');

// About Copy delta (October 2026), the longer headline and the new copy set
// in the same design: on phones and tablets each sentence of the headline is a
// line of its own; from 60rem the sentences share one line across the canvas,
// each kept whole (so a wider fallback face could only break the line between
// sentences, never push the page sideways), at 4.1 units (4.1vw, then 4.1 frame
// units capped at 4rem from 64rem; it was 5 and 5.5rem for the shorter line);
// below 24rem the headline is sized to the canvas, so "Operator discipline."
// never breaks (it did at 360px). Paragraphs wrap "pretty" on phones and are
// balanced from 37.5rem; the desktop measure grew with the headline (47.5em,
// was 44em) and the paragraphs' type stops at 1.8rem (was 1.9rem), so the
// second paragraph takes three full lines; the closing words that stay
// together never wrap; and no highlight has a background.
const aboutRules = (re, atRe) => CSS_RULES.filter((r) => re.test(r.sel.replace(/\[data-astro-cid-[^\]]*\]/g, '')) && (atRe ? atRe.test(r.at) : !r.at));
const aboutBodies = (list) => list.map((r) => r.body).join(';');
const AT64 = /min-width:\s*64rem|width\s*>=\s*64rem/;
if (!/display:\s*block/.test(aboutBodies(aboutRules(/^\.about__line$/)))) failures.push('[about] on phones and tablets each sentence of the headline takes a line of its own');
const aboutLineWide = aboutBodies(aboutRules(/^\.about__line$/, DESKTOP));
if (!/display:\s*inline(?![-\w])/.test(aboutLineWide) || !/white-space:\s*nowrap/.test(aboutLineWide)) failures.push('[about] from 60rem the headline\'s sentences share one line, each kept whole');
const aboutHeadWide = aboutBodies(aboutRules(/^\.about__heading$/, DESKTOP));
if (!/font-size:\s*4\.1vw/.test(aboutHeadWide) || CSS_RULES.some((r) => /^\.about__heading$/.test(r.sel.replace(/\[data-astro-cid-[^\]]*\]/g, '')) && /white-space:\s*nowrap/.test(r.body))) failures.push(`[about] from 60rem the headline is set at 4.1vw and may break only between its sentences (found "${aboutHeadWide}")`);
const aboutHead64 = aboutBodies(aboutRules(/^\.about__heading$/, AT64));
if (!/font-size:\s*min\(calc\(4\.1\s*\*\s*var\(--fit\)\),\s*4rem\)/.test(aboutHead64)) failures.push(`[about] from 64rem the headline is 4.1 frame units, capped at 4rem, so its line fits the canvas (found "${aboutHead64}")`);
const aboutHeadSmall = aboutBodies(aboutRules(/^\.about__heading$/, /max-width:\s*24rem|width\s*<=\s*24rem/));
if (!/font-size:\s*min\(2\.5rem,\s*(?:calc\(\(100vw\s*-\s*2\.5rem\)\s*\/\s*8\.2\)|12\.195\d*vw\s*-\s*\.304878\d*rem)\)/.test(aboutHeadSmall)) failures.push(`[about] below 24rem the headline is sized to the canvas, so "Operator discipline." stays whole (found "${aboutHeadSmall}")`);
if (!/text-wrap:\s*pretty/.test(aboutBodies(aboutRules(/^\.flow__p$/))) || !/text-wrap:\s*balance/.test(aboutBodies(aboutRules(/^\.flow__p$/, /min-width:\s*37\.5rem|width\s*>=\s*37\.5rem/)))) failures.push('[about] the paragraphs wrap "pretty" on phones and are balanced from 37.5rem');
const aboutFlow64 = aboutBodies(aboutRules(/^\.flow__p$/, AT64));
if (!/max-width:\s*47\.5em/.test(aboutFlow64) || !/font-size:\s*clamp\(1\.1875rem,\s*calc\(0?\.38rem\s*\+\s*1\.425\s*\*\s*var\(--fit\)\),\s*1\.8rem\)/.test(aboutFlow64)) failures.push(`[about] the desktop measure is 47.5em, about the headline's width, with the paragraphs' type capped at 1.8rem (found "${aboutFlow64}")`);
if (!/white-space:\s*nowrap/.test(aboutBodies(aboutRules(/\.flow__keep$/)))) failures.push('[about] the closing words kept together never wrap');
if (CSS_RULES.some((r) => /\.flow__mark/.test(r.sel) && /background/.test(r.body))) failures.push('[about] the highlights carry no background (no highlighter)');

// Select Work (v1.7; Full Site Iteration V1): the approved title and intro, the
// intro's one emphasis on "strategy through execution" (slightly heavier, in the
// surrounding color), then three cards in one template: number and category, a
// short title, a one-sentence subline (never emphasized), one landscape video at
// the card's full media width, and one case-study link. Metrics live on the
// case-study pages; no card shows a figure (Creator Marketing V1.2 retired the
// creator card's impressions stand-in).
const sectionAt = (i) => (i < 0 ? '' : home.slice(i, home.indexOf('</section>', i)));
const workHtml = sectionAt(at('id="work"'));
if (!/<h2 id="work-heading"[^>]*>Select Work<\/h2>/.test(workHtml)) failures.push('[claim] the work section must be titled "Select Work"');
const workLede = (workHtml.match(/<p class="lede"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1];
if (textOf(workLede) !== 'The examples below show how I move from strategy through execution and coordinate the people, systems, and details required to ship.') {
  failures.push('[claim] Select Work must use the approved intro');
}
const ledeMarks = [...workLede.matchAll(/<strong class="em-key"[^>]*>([\s\S]*?)<\/strong>/g)].map((m) => textOf(m[1]));
if (ledeMarks.join(' | ') !== 'strategy through execution' || (workLede.match(/<strong\b/g) || []).length !== 1 || /<(?:b|em|mark|u)[\s>]/.test(workLede)) {
  failures.push(`[claim] the Select Work intro emphasizes "strategy through execution" and nothing else (found ${ledeMarks.join(' | ') || 'none'})`);
}
const cardsHtml = [...workHtml.matchAll(/<article class="card"[\s\S]*?<\/article>/g)].map((m) => m[0]);
// (Creator Marketing V1.2: the creator card no longer claims the logistics; drafted for John's confirmation.)
const approvedCards = [
  ['Creator Marketing and Partnerships', 'Helped lead international creator campaigns, from sponsor strategy and creative direction to production and distribution.', 'work/creator-campaigns/'],
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
  const mediaCount = (c.match(/<div class="card__media"/g) || []).length;
  const videoCount = (c.match(/<video\b/g) || []).length;
  if (mediaCount !== 1 || videoCount !== 1 || /card__panel|data-card-secondary/.test(c)) {
    failures.push(`[claim] card ${i + 1} must hold one video at its full media width and no supporting panels (found ${mediaCount} media areas, ${videoCount} videos)`);
  }
  if (/<(?:strong|b|em|mark|u)[\s>]/.test((c.match(/<p class="card__subline"[\s\S]*?<\/p>/) || [''])[0])) failures.push(`[claim] card ${i + 1}: its subline carries no emphasis`);
  // The Sui Fest stand-in names its event and year (TOKEN2049 Singapore 2025),
  // which are not metrics; its wording is checked with the card media below.
  const visible = textOf(c.replace(/<span class="card__num"[\s\S]*?<\/span>/, '').replace(/<p class="fb__event"[\s\S]*?<\/p>/g, ''));
  // (Creator Marketing V1.2: the creator card's "Approximately 1.25M impressions" stand-in is retired; no card shows a figure.)
  const figures = visible.match(/\d[\d.,]*[%MKx]?/g) || [];
  if (figures.length) failures.push(`[claim] card ${i + 1} must leave its metrics to the case-study page (found ${figures.join(', ')})`);
  if (/impressions|1\.25M|fb--metric/.test(c)) failures.push(`[claim] card ${i + 1} carries no impressions stand-in (retired in Creator Marketing V1.2)`);
});
// Every card video (Version 2.0; Full Site Iteration V1, one per card): muted,
// inline, looping, nothing loaded until needed, no player controls or autoplay
// in the HTML (the script decides what plays), an accessible name, and its own
// labeled play and pause control. Each is its card's one video
// (data-card-video), and each sits in a frame on its poster: a lazy, responsive
// picture of the loop at the loop's own crop, decorative since the video
// carries the description, used instead of the poster attribute (which
// browsers fetch at once). The video stays invisible until it plays, so the
// poster holds the frame without JavaScript and when a video cannot load.
const workVideos = workHtml.match(/<video\b[^>]*>/g) || [];
for (const video of workVideos) {
  for (const attr of ['muted', 'loop', 'playsinline', 'preload="none"', 'aria-label="']) {
    if (!video.includes(attr)) failures.push(`[claim] a card video is missing ${attr}`);
  }
  if (/\b(?:controls|autoplay)\b/.test(video)) failures.push('[claim] a card video must not show player controls or autoplay from the HTML');
  if (/\bposter=/.test(video)) failures.push('[claim] a card video takes its poster from the lazy picture beneath it, never the eagerly fetched poster attribute');
  if (!/\bdata-card-video\b/.test(video) || /\bdata-card-secondary\b/.test(video)) failures.push("[claim] each card video must be its card's one video (data-card-video)");
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
const playback = scriptsText.find((t) => t.includes('data-card-video') && t.includes('data-card-toggle')) || '';
for (const token of ['data-shown', 'source:last-of-type', 'requestVideoFrameCallback', 'visibilitychange', 'prefers-reduced-motion: reduce', 'prefers-reduced-data: reduce', 'saveData', 'IntersectionObserver']) {
  if (!playback.includes(token)) failures.push(`[claim] the card playback script is missing "${token}" (poster, failure, frame, tab, motion, data or loading guard)`);
}
// Full Site Iteration V1 retired hover-play with the supporting panels: nothing on a card plays on hover.
if (/pointerenter|mouseenter|mouseover|\(hover: hover\)/.test(playback)) failures.push('[claim] the cards play nothing on hover (hover-play was retired with the supporting panels)');
// Select Work media (Full Site Iteration V1): one video per card, at the card's
// full media width, in one frame and treatment: the creator montage, the
// Technical Product Marketing hero animation alone, and the events montage. No
// supporting panel, contained plate, typographic stand-in or hover-play remains.
// The frame is 16:9 on phones and tablets; on desktop it is the whole of the card
// below its head, and every head keeps room for a two-line subline, so the
// three frames share one size and one aspect ratio at any width.
const sourcesOf = (html) => [...html.matchAll(/<source\b[^>]*\bsrc="([^"]+)"/g)].map((m) => path.basename(m[1]));
const CARD_MEDIA = ['home-creator-montage.mp4', 'bolt-hero-animation-loop.mp4', 'home-events-montage-fs13.mp4'];
cardsHtml.forEach((c, i) => {
  const v = (c.match(/<video\b[\s\S]*?<\/video>/) || [''])[0];
  if (!/\bdata-card-video\b/.test(v) || sourcesOf(v).join() !== CARD_MEDIA[i]) failures.push(`[claim] card ${i + 1} must play ${CARD_MEDIA[i]} (found ${sourcesOf(v).join(', ') || 'none'})`);
  if (/object-position/.test(c)) failures.push(`[claim] card ${i + 1} keeps the frame centered (no per-card focus is set)`);
});
if (/class="fb[ "]/.test(cardsHtml.join(''))) failures.push('[claim] no typographic stand-in may render on the Select Work cards');
// Full Site Iteration V1.1 (03): the complete video in every card, at every width: an exact 16:9 frame at the card's
// full inner width (no other aspect ratio anywhere, desktop included), the video and its poster contained in it as a
// safeguard (never covering, so never cropped), and no per-card focus. On desktop the card is the content's width or,
// in the stack, the widest whose head and complete frame fit the screen below the header, centered; its height
// follows from its width, every head kept at the tallest one's height.
if (!rulesFor(/^\.card__media(?:\[data-astro-cid-[\w-]+\])?$/).some((r) => !r.at && /aspect-ratio:\s*16\s*\/\s*9/.test(r.body)) || rulesFor(/\.card__media(?:\[data-astro-cid-[\w-]+\])?$/).some((r) => /aspect-ratio:\s*(?!16\s*\/\s*9)/.test(r.body))) failures.push('[claim] V1.1: every card video frame is an exact 16:9 at every width, desktop included');
const fitRules = rulesFor(/^\.card__media (?:picture )?\.card__img|^\.card__media(?:\[data-astro-cid-[\w-]+\])? \.card__img|^\.card__video(?:\[data-astro-cid-[\w-]+\])?$/);
if (!fitRules.some((r) => /object-fit:\s*contain/.test(r.body)) || CSS_RULES.some((r) => /\.card__(?:img|video|poster)\b/.test(r.sel) && /object-fit:\s*cover/.test(r.body))) failures.push('[claim] V1.1: the card video and its poster are contained in the frame, never covering (cropping) it');
if (/\bfocus\s*:/.test(fs.readFileSync(path.join(root, 'src/content.config.ts'), 'utf8').split('media: z.object')[1]?.split('})')[0] || '')) failures.push('[claim] V1.1: the cards have no crop to steer (card.media.focus is gone)');
{
  const work = rulesFor(/^\.work(?:\[data-astro-cid-[\w-]+\])?$/).filter((r) => DESKTOP.test(r.at) && !/min-height|max-aspect/.test(r.at)).map((r) => r.body).join(';');
  const stack = CSS_RULES.filter((r) => /^\.js \.work$/.test(r.sel.replace(/\[data-astro-cid-[^\]]*\]/g, '').trim()) && DESKTOP.test(r.at) && /min-height:\s*45rem|height\s*>=\s*45rem/.test(r.at) && MOTION_OK.test(r.at)).map((r) => r.body).join(';');
  const norm = (v) => v.replace(/\s+/g, ' ');
  if (!/--card-h:\s*calc\(2 ?\* ?var\(--card-pad\) ?\+ ?2px ?\+ ?var\(--card-head\) ?\+ ?var\(--card-gap\) ?\+ ?\(var\(--card-w\) ?- ?2 ?\* ?var\(--card-pad\) ?- ?2px\) ?\* ?9 ?\/ ?16\)/.test(norm(work))) failures.push('[claim] V1.1: the card\'s height follows from its width: its padding and border, its head, the gap, and a 16:9 frame at its inner width');
  if (!/--card-w:\s*min\(var\(--card-max\), ?calc\(\(var\(--view-h\) ?- ?var\(--nav-h\) ?- ?2rem\) ?\* ?16 ?\/ ?9/.test(norm(work))) failures.push('[claim] V1.1: on desktop a card is the content\'s width, but never so wide that its complete frame is taller than the screen below the header');
  if (!/--card-room:/.test(stack) || !/--card-w:\s*min\(var\(--card-max\), ?calc\(\(var\(--card-room\) ?- ?2 ?\* ?var\(--card-pad\) ?- ?2px ?- ?var\(--card-head\) ?- ?var\(--card-gap\)\) ?\* ?16 ?\/ ?9/.test(norm(stack))) failures.push('[claim] V1.1: in the stack a card is the widest whose head and complete 16:9 frame fit the room below the header, never wider than the content');
  const cardDesk = rulesFor(/^\.card(?:\[data-astro-cid-[\w-]+\])?$/).filter((r) => DESKTOP.test(r.at)).map((r) => r.body).join(';');
  if (!/width:\s*var\(--card-w/.test(cardDesk) || !/margin-inline:\s*auto/.test(cardDesk) || /(?:^|;)\s*height:/.test(cardDesk)) failures.push('[claim] V1.1: a desktop card takes the stack\'s width, centered, and its own height (no fixed height cropping the frame)');
  const headDesk = rulesFor(/^\.card__head(?:\[data-astro-cid-[\w-]+\])?$/).filter((r) => DESKTOP.test(r.at)).map((r) => r.body).join(';');
  const stackJs = scriptsText.find((t) => t.includes('data-catalog') && t.includes('--card-head')) || '';
  if (!/min-height:\s*var\(--card-head\)/.test(headDesk) || !/align-content:\s*start/.test(headDesk) || !/offsetTop/.test(stackJs) || !/ResizeObserver/.test(stackJs)) failures.push('[claim] V1.1: every card head keeps the tallest head\'s height, measured as set (the layout\'s own offsets), so the three cards share one size');
  if (!/getComputedStyle\(\w+\[0\]\)\.position\s*===?\s*['"`]sticky['"`]/.test(stackJs)) failures.push('[claim] V1.1: the playback reads whether the cards are stacking from the stylesheet (a short screen reads them in sequence)');
}
if (!rulesFor(/^\.card__subline(?:\[data-astro-cid-[\w-]+\])?$/).some((r) => DESKTOP.test(r.at) && /min-height:\s*3em/.test(r.body))) failures.push('[claim] on desktop every card head keeps room for a two-line subline, so the three frames share one size');
if (rulesFor(/\.card__panel/).length) failures.push('[claim] the supporting-panel styles were retired with the panels');
// The card videos are web derivatives made for the homepage, never the
// original masters (which stay outside the repository): silent (no audio
// track), H.264 in MP4 with the index first so they start at once, each at its
// approved length, each card's one video under 5 MB (Full Site Iteration V1:
// one video per card, so the cards together weigh less than the nine of
// Version 2.0), and each poster at its loop's aspect ratio, so poster and loop
// share one crop. Full Site Iteration V1.3: the events montage plays the Events
// page's four edits whole (38.4 s), and its brief lets it pass the 5 MB rather
// than fragment them or soften them further; it stays under 9 MB (a lighter file
// for phones may follow).
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
  'home-creator-montage.mp4': 15.52,
  'bolt-hero-animation-loop.mp4': 11.68,
  'home-events-montage-fs13.mp4': 38.37,
};
const CARD_CAP_MB = { 'home-events-montage-fs13.mp4': 9 };
const cardManifest = JSON.parse(fs.readFileSync(path.join(root, 'src/data/assets.json'), 'utf8')).assets;
cardsHtml.forEach((c, i) => {
  for (const video of c.match(/<video\b[\s\S]*?<\/video>/g) || []) {
    for (const name of sourcesOf(video).filter((n) => n.endsWith('.mp4'))) {
      const file = path.join(root, 'public/media', name);
      if (!fs.existsSync(file)) {
        failures.push(`[asset] card ${i + 1}: public/media/${name} not found`);
        continue;
      }
      const mb = fs.statSync(file).size / 1048576;
      const cap = CARD_CAP_MB[name] || 5;
      if (mb > cap) failures.push(`[asset] card ${i + 1}: ${name} is ${mb.toFixed(2)} MB; ${cap === 5 ? 'a card\'s one video stays under 5 MB' : `this card's video stays under ${cap} MB (Full Site Iteration V1.3)`}`);
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
// Full Site Iteration V1 retired the cards' supporting panels and their earlier primaries, files and posters alike.
for (const retired of ['creator-costa-rica-aftermovie-loop.mp4', 'creator-trezor-paper-airplane-loop.mp4', 'creator-bolt-bus-trailer-loop.mp4', 'bolt-architecture-diagram-loop.mp4', 'bolt-slippage-explainer-preview.mp4', 'suifest-interview-loop.mp4', 'sui-summit-max-presentation-loop.mp4']) {
  if (fs.existsSync(path.join(root, 'public/media', retired)) || fs.existsSync(path.join(dist, 'media', retired))) failures.push(`[hygiene] ${retired} was retired in Full Site Iteration V1 and must not ship`);
}
for (const retired of ['creator-campaigns/creator-costa-rica-aftermovie-poster.jpg', 'creator-campaigns/creator-trezor-paper-airplane-poster.jpg', 'creator-campaigns/creator-bolt-bus-trailer-poster.jpg', 'technical-marketing/bolt-architecture-diagram-poster.jpg', 'events-video/bolt-slippage-explainer-poster.jpg', 'events-video/suifest-interview-poster.jpg', 'events-video/sui-summit-max-presentation-poster.jpg']) {
  if (fs.existsSync(path.join(root, 'src/assets', retired))) failures.push(`[hygiene] src/assets/${retired} was retired in Full Site Iteration V1`);
}
for (const id of ['cc-costa-rica-loop', 'cc-trezor-loop', 'cc-bolt-bus-loop', 'tm-architecture-loop', 'ev-slippage-preview', 'ev-suifest-loop', 'ev-max-loop']) {
  if (cardManifest.some((a) => a.id === id)) failures.push(`[hygiene] the manifest entry ${id} was retired in Full Site Iteration V1`);
}
// Full Site Iteration V1.1 re-cut the events montage (moving footage only), under a new name; V1.2 expanded it, under
// another; V1.3 reassembled it from the Events page's four approved edits, under a third.
for (const [retired, by] of [['home-events-montage.mp4', 'V1.1'], ['home-events-montage-fs11.mp4', 'V1.2'], ['home-events-montage-fs12.mp4', 'V1.3']]) {
  if (fs.existsSync(path.join(root, 'public/media', retired)) || fs.existsSync(path.join(dist, 'media', retired))) failures.push(`[hygiene] ${retired} was replaced in Full Site Iteration ${by} and must not ship`);
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
  // Full Site Iteration V1.1: the cards stack only where a complete card fits with room to spare (45rem of height), and
  // the introduction stays pinned only where it and a complete card at the content's width fit together (82rem).
  if (/\.card\b(?!-)/.test(r.sel) && !/min-height:\s*45rem|height\s*>=\s*45rem/.test(r.at)) failures.push('[claim] V1.1: the cards stack only on screens at least 45rem tall');
  if (/\.work__head\b/.test(r.sel) && !/min-height:\s*82rem|height\s*>=\s*82rem/.test(r.at)) failures.push('[claim] V1.1: the introduction stays pinned only on screens at least 82rem tall, where a complete card fits beneath it');
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
// order for the browser session. No video. Wider screens stay at three rows
// until eight more approved pieces arrive (32 in all); phones (Mobile
// Optimization V1, below) deal the same 24 into four rows of six instead, so
// the fourth row repeats nothing and brings back nothing excluded.
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
if (reelDirs !== 'right,left,right,left') failures.push(`[claim] the reel rows must move right, left, right (and left, the phones' fourth row) (found ${reelDirs || 'none'})`);
const reelRuns = [...reelHtml.matchAll(/<ul class="reel__run" data-reel-run[^>]*>([\s\S]*?)<\/ul>/g)].map((m) => [...m[1].matchAll(/data-reel-id="reel-([a-z0-9-]+)"/g)].map((x) => x[1]));
const reelIds = reelRuns.flat();
if (reelRuns.length !== 4 || reelRuns.slice(0, 3).some((r) => r.length !== 8) || reelRuns[3].length) failures.push(`[claim] the reel must deal three rows of eight, the phones' fourth row left for the script (found ${reelRuns.map((r) => r.length).join('/') || 'none'})`);
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
// Mobile Optimization V1: on phones (below 48rem) four rows of six, moving
// right, left, right, left. The HTML's fourth row is empty and marked for
// phones; the deal fills it only where the script runs on a phone (the reel
// is then marked data-reel-four), so wider screens and no JavaScript keep the
// three rows. The phone deal spreads the squarer pieces one to a row first,
// keeps every look-alike group (home.json reel.alike) out of neighboring rows
// and from sitting side by side, and deals again across 48rem.
const PHONE = /max-width:\s*47\.99rem|width\s*<=\s*47\.99rem/;
const reelRowTags = [...reelHtml.matchAll(/<div class="reel__row"[^>]*>/g)].map((m) => m[0]);
if (reelRowTags.length !== 4 || reelRowTags.slice(0, 3).some((t) => /data-reel-phone/.test(t)) || !/data-reel-phone/.test(reelRowTags[3] || '') || !/data-speed="(?!1"|0\.8"|1\.2")[\d.]+"/.test(reelRowTags[3] || '')) failures.push('[mobile] the reel carries a fourth row for phones only, marked and at a rate of its own');
const reelPhoneHide = rulesFor(/\.reel__row/).filter((r) => /\[data-reel-phone\]/.test(r.sel));
if (!reelPhoneHide.some((r) => !r.at && !/data-reel-four/.test(r.sel) && /display:\s*none/.test(r.body)) || !reelPhoneHide.some((r) => /\.reel(?:\[[^\]]*\])*\[data-reel-four\]/.test(r.sel) && /display:\s*flex/.test(r.body))) failures.push('[mobile] the fourth row shows only where the phone deal has run (data-reel-four), never wider or without JavaScript');
const reelInline = scriptsText.find((t) => t.includes('jc-reel-order')) || '';
for (const token of ['(max-width: 47.99rem)', 'data-reel-four', 'data-reel-phone', 'data-reel-shape', 'data-reel-alike', 'reelDeal']) {
  if (!reelInline.includes(token)) failures.push(`[mobile] the reel's phone deal is missing "${token}"`);
}
if (!scriptsText.some((t) => t.includes('reelDeal') && t.includes('data-reel-clone') && t.includes('47.99rem'))) failures.push('[mobile] across 48rem the reel deals again and repeats its rows afresh');
const reelFrames = [...reelHtml.matchAll(/<li class="reel__frame"[^>]*>/g)].map((m) => m[0]);
if (reelFrames.length !== 24 || reelFrames.some((t) => !/data-reel-shape="(?:square|wide)"/.test(t))) failures.push('[mobile] every reel piece says whether it is square or wide, for the phone deal');
const reelData = JSON.parse(fs.readFileSync(path.join(root, 'src/data/home.json'), 'utf8')).reel || {};
const alikeIds = (reelData.alike || []).flat();
if (reelData.phoneRows !== 4 || !(reelData.alike || []).length || (reelData.alike || []).some((g) => g.length < 2 || g.length > 3) || new Set(alikeIds).size !== alikeIds.length || alikeIds.some((id) => !(reelData.pool || []).includes(id))) failures.push('[mobile] home.json deals phones four rows and names its look-alike groups (two or three pieces each, every one in the pool, none in two groups)');
const alikeHtml = new Map(reelFrames.map((t) => [(t.match(/data-reel-id="([^"]+)"/) || [])[1], (t.match(/data-reel-alike="(\d+)"/) || [])[1]]));
if ((reelData.alike || []).some((g, k) => g.some((id) => alikeHtml.get(id) !== String(k))) || [...alikeHtml.values()].filter((v) => v !== undefined).length !== alikeIds.length) failures.push('[mobile] each look-alike piece carries its group in the page, and only those');

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
// Mobile Optimization V1 (desktop and phones alike): each Stack collection is
// a strict grid, filled left to right and top to bottom, so a short last row
// starts under the first column instead of centering: three across on phones;
// from 40rem the group's own column count (half its tools, rounded up: 3, 4
// and 3), so Google Analytics sits under Linear, Slack under Mintlify and
// Microsoft Teams under GitBook (on phones Teams under Grafana), Typefully
// under Figma and Grammarly under Photoshop. The grid itself stays centered
// in its group, under its centered heading.
const toolsBase = toolRows.filter((r) => !r.at).map((r) => r.body).join(';');
if (!/display:\s*grid/.test(toolsBase) || !/grid-template-columns:\s*repeat\(3,\s*minmax\(0(?:px)?,\s*1fr\)\)/.test(toolsBase) || toolRows.some((r) => /flex-wrap|display:\s*flex/.test(r.body))) failures.push('[mobile] each Stack collection is a strict grid, three across on phones, never a centered wrapping row');
if (!toolRows.some((r) => /min-width:\s*40rem|width\s*>=\s*40rem/.test(r.at) && /grid-template-columns:\s*repeat\(var\(--cols\),\s*6\.25rem\)/.test(r.body)) || !toolRows.some((r) => /min-width:\s*64rem|width\s*>=\s*64rem/.test(r.at) && /grid-template-columns:\s*repeat\(var\(--cols\),\s*minmax\(0(?:px)?,\s*1fr\)\)/.test(r.body))) failures.push('[mobile] from 40rem each Stack group keeps its own column count, in cells of one width');
if (rulesFor(/\.tool\b(?!__|--)/).some((r) => /(?:^|;)\s*(?:width|flex):/.test(r.body))) failures.push('[mobile] the Stack tiles take their grid cells, with no widths of their own that could set a short row apart');
const stackCols = [...prHtml.matchAll(/<div class="stack__group"[^>]*style="--cols:\s*(\d+)"/g)].map((m) => Number(m[1]));
if (JSON.stringify(stackCols) !== JSON.stringify(STACK.map((g) => Math.ceil(g.length / 2)))) failures.push(`[mobile] each Stack group's column count is half its tools, rounded up (3, 4 and 3), so every last row starts under the first column (found ${stackCols.join(', ') || 'none'})`);
// The capability rows answer the pointer and the keyboard alike.
const capRows = prHtml.match(/<li class="cap"[^>]*>/g) || [];
if (capRows.length !== 4 || capRows.some((t) => !/tabindex="0"/.test(t) || !/\bdata-cap\b/.test(t))) failures.push('[claim] the four capability rows must be reachable by keyboard');
// Full Site Iteration V1: a capability's icon makes one full turn (360 degrees, about half a second, easing out)
// when a fine pointer arrives on its row, with a very small lift and scale; it never loops while the pointer
// stays, and it resets without turning backwards (the class that turns it comes off when the turn ends). Keyboard
// focus shows the completed state with no motion; reduced motion keeps the color change alone. The old resting
// tilt is gone, and nothing about the turn moves the layout.
if (/--tilt/.test(prHtml) || rulesFor(/\.cap\b/).some((r) => /--tilt/.test(r.body))) failures.push('[claim] the capability icons\' resting tilt was retired in Full Site Iteration V1');
const turnFrames = CSS_RULES.filter((r) => /@keyframes cap-turn\b/.test(r.at));
if (!turnFrames.some((r) => /^(?:from|0%)$/.test(r.sel) && /rotate:\s*0(?:deg)?\b/.test(r.body)) || !turnFrames.some((r) => /^(?:to|100%)$/.test(r.sel) && /rotate:\s*360deg/.test(r.body))) {
  failures.push('[claim] the capability icon turns exactly once around (0 to 360 degrees)');
}
const turning = rulesFor(/\.cap__icon(?:\[data-astro-cid-[\w-]+\])?\.is-turning\b/);
// (The minifier may reorder the shorthand and write 560ms as .56s.)
const turnDecl = turning.map((r) => (r.body.match(/animation:\s*([^;]+)/) || [])[1]).find((v) => v && /\bcap-turn\b/.test(v)) || '';
const turnDur = turnDecl.match(/(?:^|\s)(\d*\.?\d+)(ms|s)\b/);
const turnMs = turnDur ? Math.round(+turnDur[1] * (turnDur[2] === 's' ? 1000 : 1)) : NaN;
const turnCurve = (turnDecl.match(/cubic-bezier\(([^)]*)\)/) || [, ''])[1].split(',').map(Number);
const easesOut = /\bease-out\b/.test(turnDecl) || (turnCurve.length === 4 && turnCurve[1] > turnCurve[0] && turnCurve[3] >= turnCurve[2]);
if (!(turnMs >= 450 && turnMs <= 650) || !easesOut || turning.some((r) => !MOTION_OK.test(r.at)) || /infinite|alternate|reverse|(?:^|\s)[2-9](?:\s|$)/.test(turnDecl)) {
  failures.push(`[claim] the turn runs once, 450 to 650 ms with an ease-out, and only without reduced motion (found "${turnDecl || 'none'}")`);
}
const lifted = rulesFor(/\.cap(?:\[data-astro-cid-[\w-]+\])?:(?:hover|focus-visible) \.cap__icon/);
const liftOk = (r) => /translate:\s*0\s+-[12]px/.test(r.body) && /scale:\s*1\.0[1-5]\b/.test(r.body);
if (!lifted.some((r) => /:focus-visible/.test(r.sel) && liftOk(r)) || !lifted.some((r) => /:hover/.test(r.sel) && /hover:\s*hover/.test(r.at) && /pointer:\s*fine/.test(r.at) && liftOk(r))) {
  failures.push('[claim] hover (a fine pointer) and keyboard focus show the completed state: a lift of a pixel or two and a scale of 1.05 at most');
}
if (lifted.some((r) => /rotate|animation/.test(r.body))) failures.push('[claim] keyboard focus never turns the icon (the turn belongs to the pointer\'s arrival)');
if (!rulesFor(/\.cap__icon/).some((r) => /prefers-reduced-motion:\s*reduce/.test(r.at) && /translate:\s*none/.test(r.body) && /scale:\s*none/.test(r.body))) failures.push('[claim] with reduced motion the capability icon only changes color');
const capScript = scriptsText.find((t) => t.includes('data-cap') && t.includes('is-turning')) || '';
for (const token of ['pointerenter', 'animationend', 'animationcancel', '(hover: hover) and (pointer: fine)', '(prefers-reduced-motion: reduce)', 'touch']) {
  if (!capScript.includes(token)) failures.push(`[claim] the capability icon's turn is missing "${token}" (arrival, reset, pointer or motion guard)`);
}
if (/mouseover|setInterval|\.reverse\(|playbackRate/.test(capScript)) failures.push('[claim] the capability icon turns once on arrival, never repeating while the pointer stays or turning backwards to reset');
if (/certificat/i.test(prHtml)) failures.push('[claim] the Stack has no certificate column');
const prStatementHtml = (prHtml.match(/<p class="practice__statement"[\s\S]*?<\/p>/) || [''])[0];
const prStatement = textOf(prStatementHtml);
if (!prStatement || prStatement.split(' ').length > 60) failures.push(`[claim] the How I Work statement must be short (${prStatement.split(' ').length} words)`);
// Full Site Iteration V1: the statement as John decided it, its one emphasis on "strategy and execution".
if (prStatement !== 'I move between strategy and execution, building clear systems and working closely with the people responsible for shipping. AI accelerates research, organization, production, and analysis, while judgment, verification, brand fit, and final approval remain mine.') {
  failures.push('[claim] the practice statement must use the approved copy (Full Site Iteration V1)');
}
const prMarks = [...prStatementHtml.matchAll(/<strong class="em-key"[^>]*>([\s\S]*?)<\/strong>/g)].map((m) => textOf(m[1]));
if (prMarks.join(' | ') !== 'strategy and execution' || (prStatementHtml.match(/<strong\b/g) || []).length !== 1 || /<(?:b|em|mark|u)[\s>]/.test(prStatementHtml)) {
  failures.push(`[claim] the practice statement emphasizes "strategy and execution" and nothing else (found ${prMarks.join(' | ') || 'none'})`);
}
// The emphasis treatment (Full Site Iteration V1, site-wide): a slightly heavier weight in the surrounding color,
// never a highlighter, background, pill or decorative underline.
const emKey = rulesFor(/(?:^|,)\s*\.em-key\s*(?=,|$)/);
if (!emKey.length || emKey.some((r) => /background|box-shadow|text-decoration|border|padding/.test(r.body)) || !emKey.some((r) => /font-weight:\s*600/.test(r.body))) {
  failures.push('[claim] .em-key is a slightly heavier weight (600) and nothing more: no background, underline, border or padding');
}
// Site-wide (Full Site Iteration V1): one emphasized phrase per paragraph at most (a quotation keeps its approved
// phrases), and no highlighter or underline mark anywhere.
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8').replace(/<blockquote\b[\s\S]*?<\/blockquote>/g, '').replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/g, '');
  for (const m of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
    const n = (m[1].match(/<(?:strong|b|em)\b/g) || []).length;
    if (n > 1) failures.push(`[claim] ${path.relative(dist, f)}: a paragraph emphasizes ${n} phrases ("${textOf(m[1]).slice(0, 60)}"); one at most`);
  }
  if (/<(?:mark|u)\b/.test(html)) failures.push(`[claim] ${path.relative(dist, f)}: no highlighter or underline marks`);
}
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
    // Full Site Iteration V1: "Its story shouldn't be." in the section's accent color, at the headline's own
    // display weight, inside the one heading (so it reads as one sentence), and nothing else set apart.
    const headingHtml = (contactHtml.match(/<h2 id="contact-heading"[^>]*>([\s\S]*?)<\/h2>/) || [, ''])[1];
    const accents = [...headingHtml.matchAll(/<span class="contact__accent"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => plain(m[1]));
    if (accents.join(' | ') !== "Its story shouldn't be." || /<(?:strong|b|em|mark|u|br)[\s>/]/.test(headingHtml)) failures.push(`[claim] ${rel}: the Contact headline sets "Its story shouldn't be." in the accent color, and nothing else (found ${accents.join(' | ') || 'none'})`);
    const paras = [...contactHtml.matchAll(/<p class="(?!eyebrow)[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => plain(m[1]));
    if (paras.length !== 1 || paras[0] !== "If you need someone who can bring clarity from positioning through execution, let's talk.") {
      failures.push(`[claim] ${rel}: Contact must carry only the approved subline (found ${paras.length} paragraph(s))`);
    }
    const actions = [...contactHtml.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    // Cleanup V1 (October 2026): LinkedIn joins Contact, after the resume.
    if (actions.length !== 3 || !actions[0].startsWith('mailto:') || !/John-Cowin-Resume\.pdf$/.test(actions[1]) || actions[2] !== 'https://www.linkedin.com/in/johncowin/') failures.push(`[claim] ${rel}: Contact keeps exactly the email, resume and LinkedIn actions (found ${actions.join(', ')})`);
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
{
  const accentRules = rulesFor(/^\.contact__accent(?:\[data-astro-cid-[\w-]+\])?$/);
  if (!accentRules.some((r) => /color:\s*var\(--accent-ink\)/.test(r.body)) || accentRules.some((r) => /font-(?:weight|size|family)|background|text-decoration|display:\s*block/.test(r.body))) {
    failures.push('[claim] the Contact accent takes the section\'s accent color and nothing else (same display weight and size, no block break, no background)');
  }
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

// Case-study roles (v1.9) were one compact "My role" line under each case
// study's intro, in the shared case-study layout. All three case studies have
// since left that layout (Technical Product Marketing in its Version 1,
// Events and Multimedia Production in its Version 1.0, Creator Marketing and
// Partnerships in its Version 1.0), and each states John's part in its own
// copy and credits, checked with each page below.

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
// Mobile Optimization V1: on a phone (below 48rem) the system shows complete
// without being asked: once it stands it opens and stays open, and the
// control is gone, with no room kept for it. Tablets keep the visible control.
if (!tpmRules(/^\.iso__toggle$/).some((r) => PHONE.test(r.at) && /display:\s*none/.test(r.body))) failures.push('[mobile] on phones the system needs no control, and none is shown or kept room for');
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
// (Counted as each screen reads it: wide, the opening and the library; on a phone, the opening and the line under
// its stack of documents, Mobile Optimization V1.)
const sec02 = (tpmPage.match(/<section class="tpm-foundation"[\s\S]*?<\/section>/) || [''])[0];
const stack02 = (sec02.match(/<div class="container tpm-stack"[\s\S]*?<\/p>\s*<\/div>/) || [''])[0];
const count02 = (h) => spaced(h.replace(/<h2[\s\S]*?<\/h2>/, '').replace(/<span class="tpm-doc__title[^"]*"[^>]*>[\s\S]*?<\/span>/g, '').replace(/<span class="tpm-doc__num[^"]*"[^>]*>[\s\S]*?<\/span>/g, '')).split(' ').filter(Boolean).length;
const words02 = count02(sec02.replace(stack02, ''));
const words02Phone = count02(sec02.replace(/<div class="container tpm-library"[\s\S]*$/, '').replace(/<ul class="tpm-stack__cards"[\s\S]*?<\/ul>/, ''));
if (words02 > 80 || words02Phone > 80) failures.push(`[tpm] 02 keeps to about 50 to 80 words outside its titles (found ${words02}, ${words02Phone} on a phone)`);
// Mobile Optimization V1: on phones one composed stack of four representative documents stands in for the
// library (the Strategic Foundation Brief, Target Buyer Analysis, Market Pain Points Research and Competitor
// Analysis, from the back of the stack to the front: each card behind shows its number and title, the front card
// shows whole), with one line beneath it on what the work became; no button opens the rest and nothing turns it
// into a carousel. The stack is a picture (hidden from assistive technology); the library stays in the page, out
// of sight, and is read instead. Wider screens never show the stack.
const STACK_DOCS = [['01', 'Strategic Foundation Brief'], ['02', 'Target Buyer Analysis'], ['03', 'Market Pain Points Research'], ['05', 'Competitor Analysis']];
const stackDocs = [...stack02.matchAll(/<li class="tpm-stack__doc"[^>]*data-stack-doc="(\d+)"[^>]*>[\s\S]*?<\/li>/g)].map((m) => [m[1], textOf((m[0].match(/<span class="tpm-doc__title[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [, ''])[1])]);
if (JSON.stringify(stackDocs) !== JSON.stringify(STACK_DOCS) || JSON.stringify(tpmData.foundation?.stack?.documents) !== JSON.stringify(STACK_DOCS.map((d) => d[0]))) failures.push(`[mobile] on phones the Foundation shows one stack of the four representative documents, in order (found ${stackDocs.map((d) => d.join(' ')).join(', ') || 'none'})`);
if (!/<ul class="tpm-stack__cards"[^>]*aria-hidden="true"/.test(stack02)) failures.push('[mobile] the phone\'s stack of documents is a picture, hidden from assistive technology (the library is read instead)');
const stackLine = textOf((stack02.match(/<p class="tpm-stack__line"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1]);
if (!stackLine || stackLine !== tpmData.foundation?.stack?.line || !/\bmulti-document marketing foundation\b/.test(stackLine) || stackLine.split(' ').length > 12 || !/<span class="tpm-nowrap"[^>]*>multi-document<\/span>/.test(stack02) || /\u2014/.test(stackLine)) failures.push(`[mobile] one concise line under the stack says the work became a multi-document marketing foundation, its compound never split (found "${stackLine}")`);
if (/<button\b|<a\b|aria-expanded|data-expand|carousel|tabindex=/i.test(stack02)) failures.push('[mobile] no button opens the rest of the library and nothing turns the stack into a carousel');
const tpmPhone = (re) => tpmRules(re).filter((r) => PHONE.test(r.at)).map((r) => r.body).join(';');
if (!tpmRules(/^\.tpm-stack$/).some((r) => !r.at && /display:\s*none/.test(r.body)) || !/display:\s*grid/.test(tpmPhone(/^\.tpm-stack$/))) failures.push('[mobile] the stack of documents shows on phones only');
const libPhone = tpmPhone(/^\.tpm-library$/);
if (!/position:\s*absolute/.test(libPhone) || !/clip-path:\s*inset\(50%\)/.test(libPhone) || !/width:\s*1px/.test(libPhone) || /display:\s*none/.test(libPhone)) failures.push('[mobile] on phones the library leaves the screen but stays in the page for assistive technology');
if (!/position:\s*absolute/.test(tpmPhone(/^\.tpm-stack__sheet$/)) || !/aspect-ratio:\s*10\s*\/\s*13/.test(tpmPhone(/^\.tpm-stack__sheet$/)) || !/position:\s*relative/.test(tpmPhone(/^\.tpm-stack__head$/))) failures.push('[mobile] each card in the stack is a whole card hanging below its own heading, so the next card covers the rest and never a title');

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
// Mobile Optimization V1: "follows:" never breaks. The colon is its own piece, revealed with "follows", set with no
// space between them; outside the live stage the words are plain text, so the two are one word to the line breaker
// (the type is not reduced to manage it); the live stage, on wide screens, sets each word as a box that rises.
if (!/>follows<\/span><\/span><span class="tpm-word"[^>]*\bdata-with-previous\b[^>]*>:<\/span>/.test(stmtHtml)) failures.push('[mobile] the colon after "follows" follows it directly, revealed with it');
if (!tpmRules(/^\.tpm-word$/).some((r) => !r.at && /display:\s*inline(?:;|$)/.test(r.body)) || tpmRules(/^\.tpm-word$/).some((r) => /inline-block/.test(r.body)) || !tpmRules(/^\.tpm-flow\.is-live \.tpm-word$/).some((r) => DESKTOP.test(r.at) && /display:\s*inline-block/.test(r.body))) failures.push('[mobile] outside the live stage the statement\'s words are plain text, so "follows:" never breaks; the live stage still sets each word as a box');
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
  // (Full Site Iteration V1: the goal and the contribution as John decided them.)
  ['Goal', ['Replace outdated documentation with a clear, structured system for technical audiences while controlling what product information could be made public.']],
  ['Services', ['Documentation strategy, information architecture, technical writing, content governance, and MDX implementation.']],
  ['Credits', ['Visual design and interactive implementation: Bob van der Meer.']],
];
const DOCS_CONTRIBUTION = 'I rebuilt the documentation from the ground up, moving it from an outdated GitBook into a purpose-built Mintlify documentation system. I owned the architecture, technical writing, cross-references, calls to action, MDX build, and GitHub publishing, working across engineering, growth, and design to make complex product information useful, accurate, and appropriate for public release.';
for (const retired of ['fragmented GitBook', 'connected Mintlify system', 'fragmented documentation']) {
  if (spaced(docsHtml).includes(retired)) failures.push(`[tpm] "${retired}" was retired in Full Site Iteration V1`);
}
if (JSON.stringify(metaOf(docsHtml)) !== JSON.stringify(DOCS_META) || JSON.stringify(expectMeta(tpmData.documentation.meta)) !== JSON.stringify(DOCS_META)) failures.push(`[tpm] 05 metadata: Goal, Services and Credits, as approved (found ${JSON.stringify(metaOf(docsHtml))})`);
if (/Timeline|Brief|Role/.test(spaced(docsHtml.replace(/<p class="tpm-case__contribution[\s\S]*?<\/p>/, '')))) failures.push('[tpm] 05 carries no timeline, brief or role');
const docsP = docsHtml.match(/<p class="(tpm-case__contribution[^"]*)"[^>]*>([\s\S]*?)<\/p>/) || [, '', ''];
if (textOf(norm(docsP[2])) !== DOCS_CONTRIBUTION || norm(tpmData.documentation.contribution) !== DOCS_CONTRIBUTION) failures.push('[tpm] 05 must carry the approved contribution statement');
if (/Bob/.test(docsP[2])) failures.push("[tpm] 05 does not repeat Bob's name in the contribution");
if (!/\btpm-case__contribution--center\b/.test(docsP[1])) failures.push('[tpm] the 05 contribution is centered beneath the metadata');
if (/tpm-display/.test(docsHtml) || !/class="tpm-browser\b/.test(docsHtml)) failures.push('[tpm] 05 reads in a frameless browser frame, not a second device');
// Creator Marketing V1.4 (04): the documentation walkthrough without the 0.35 s still in the SDK page (21 frames
// identical to the one before them, between a short scroll and the scroll that follows it), under new names so no
// browser keeps the older cut; 32.85 s (33.2 before). The website's two pauses and the documentation home's are left:
// the page's own animation runs through each (see the README).
walkCheck(docsHtml, 'documentation', 'bolt-docs-walkthrough-v14.mp4', 'bolt-docs-walkthrough-v14-720.mp4');
fileCheck('bolt-docs-walkthrough-v14.mp4', 2560, 1440, 9, [32.8, 32.9], 'V1.4: the documentation edit runs 32.85 s, the SDK page pause taken out');
fileCheck('bolt-docs-walkthrough-v14-720.mp4', 1280, 720, 3, [32.8, 32.9], 'V1.4: the documentation edit runs 32.85 s, the SDK page pause taken out');
for (const old of ['bolt-docs-walkthrough.mp4', 'bolt-docs-walkthrough-720.mp4']) if (fs.existsSync(path.join(root, 'public/media', old))) failures.push(`[tpm] V1.4: the older documentation cut is gone (${old})`);
const docsWalk = cardManifest.find((x) => x.id === 'tm-docs-walkthrough') || {};
if (!/V1\.4 takes out the 0\.35 s pause at 0:42\.43 to 0:42\.78 of the take, 21 frames identical to the one before them/.test(docsWalk.source || '') || !/Edited to 32\.85 s/.test(docsWalk.source || '') || docsWalk.file !== 'bolt-docs-walkthrough-v14.mp4' || docsWalk.fileSmall !== 'bolt-docs-walkthrough-v14-720.mp4') failures.push('[tpm] V1.4: the manifest records the documentation pause taken out, and the new length');
posterAt('bolt-docs-walkthrough-poster.jpg', 2560, 1440, 'the documentation poster (its home page)');
const chapterItems = [...docsHtml.matchAll(/<li class="tpm-chapter"[^>]*data-start="([\d.]+)"[\s\S]*?<\/li>/g)];
const chapterTitles = chapterItems.map((m) => textOf((m[0].match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [, ''])[1]));
const docsSec = fs.existsSync(path.join(root, 'public/media/bolt-docs-walkthrough-v14.mp4')) ? mp4Seconds(path.join(root, 'public/media/bolt-docs-walkthrough-v14.mp4')) : 0;
const starts = chapterItems.map((m) => Number(m[1]));
if (chapterTitles.join(' | ') !== 'Documentation overview | Interactive architecture | Developer SDK') failures.push(`[tpm] the walkthrough's three chapters are Documentation overview, Interactive architecture and Developer SDK (found ${chapterTitles.join(' | ')})`);
// Introduced as selected views from a broader system: no page count, no
// spotlight.
const chaptersLabel = (docsHtml.match(/<p id="tpm-chapters-label"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1];
if (textOf(chaptersLabel) !== 'Selected views from a broader documentation system' || !/<ol class="tpm-chapters[^"]*"[^>]*aria-labelledby="tpm-chapters-label"/.test(docsHtml)) failures.push('[tpm] the chapters are introduced as "Selected views from a broader documentation system", which also names the list');
if (!tpmRules(/^\.tpm-chapters__wrap$/).some((r) => PHONE.test(r.at) && /display:\s*none/.test(r.body))) failures.push('[mobile] on phones the documentation walkthrough plays alone: no selected views, no controls, no room kept for them');
if (!tpmRules(/^\.tpm-chapters__label$/).some((r) => /text-align:\s*center/.test(r.body)) || !tpmRules(/^\.tpm-chapters__wrap$/).some((r) => /max-width:\s*90rem/.test(r.body) && /margin:\s*0 auto/.test(r.body)) || !tpmRules(/^\.tpm-browser$/).some((r) => /max-width:\s*90rem/.test(r.body))) failures.push('[tpm] "Selected views from a broader documentation system" is centered on the frame (V1.3)');
if (/\b\d+\s*(?:\+\s*)?pages?\b|Architecture Spotlight/i.test(spaced(docsHtml))) failures.push('[tpm] 05 gives no page count and no Architecture Spotlight');
if (starts[0] !== 0 || starts.some((s, i) => i && s <= starts[i - 1]) || starts.some((s) => s >= docsSec)) failures.push('[tpm] the chapters start at 0 and in order, inside the walkthrough');
if (!(starts[2] - starts[1] >= starts[1] - starts[0] && starts[2] - starts[1] >= docsSec - starts[2])) failures.push('[tpm] the architecture diagram is the longest moment of the walkthrough');
if (chapterItems.some((m) => !/<button\b[^>]*data-seek[^>]*\bhidden\b|<button\b[^>]*\bhidden\b[^>]*data-seek/.test(m[0]))) failures.push('[tpm] each chapter plays from its point with a button that its script reveals');
// Full Site Iteration V1: the overview's note and the diagram's note as John decided them. The diagram's note
// tells John's part only; Bob van der Meer's credit for the visual design and interactive build stays in 05's
// Credits.
const chapterNotes = chapterItems.map((m) => textOf((m[0].match(/<p\b[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1]));
if (chapterNotes[0] !== 'One branded Mintlify system in place of outdated GitBook documentation, organized from product understanding to implementation.') failures.push(`[tpm] the overview chapter carries its approved note (found "${chapterNotes[0] || ''}")`);
if (chapterNotes[1] !== 'I developed the early diagram with engineering, validated it with the liquidity team, refined its structure, filtered out internal-only information, briefed design, and wrote every pop-up explanation.') failures.push(`[tpm] the diagram chapter carries its approved note (found "${chapterNotes[1] || ''}")`);
if (/Bob/.test(chapterItems[1]?.[0] || '')) failures.push('[tpm] the diagram chapter\'s note no longer names Bob (his credit is in 05\'s Credits)');

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
// V1.3: the Ecosystem Distribution section sits between the campaign and the conclusion, and nothing else does.
// (The campaign's own module script may sit between them; it renders nothing.)
const ecoHtml = (tpmPage.match(/<section class="tpm-eco"[\s\S]*?<\/section>/) || [''])[0];
const ecoAt = ecoHtml ? tpmPage.indexOf(ecoHtml) : -1;
if (campEnd < 0 || ecoAt < campEnd || conclusionAt < ecoAt || tpmPage.slice(campEnd, ecoAt).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').trim() || tpmPage.slice(ecoAt + ecoHtml.length, conclusionAt).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').trim()) failures.push('[tpm] V1.3: the campaign leads into Ecosystem Distribution, which leads straight into the conclusion');
{
  const eco = tpmData.ecosystem || {};
  const ecoText = textOf(norm(ecoHtml));
  const want = ['ECOSYSTEM DISTRIBUTION', 'Product clarity carried into the market.', "The same product fluency behind the positioning, website, documentation, and campaign also supported ecosystem growth. I helped translate Bolt's value and architecture into partner conversations and direct integrations with Cetus, Aftermath, and FlowX. Because other Sui applications were integrated with those aggregators, the work also created downstream integration paths as the protocol grew from zero to more than $300 million in processed volume.", 'CETUS · AFTERMATH · FLOWX', 'Direct aggregator integrations', 'DOWNSTREAM REACH', 'Additional integrations through connected Sui applications', '$300M+', 'Protocol volume processed'];
  const missing = want.filter((w) => !ecoText.includes(w));
  if (missing.length) failures.push(`[tpm] V1.3: Ecosystem Distribution carries John's approved copy word for word (missing: ${missing.join(' | ')})`);
  const logos = [...ecoHtml.matchAll(/data-integration="([\w-]+)"/g)].map((m) => m[1]).join(',');
  if (logos !== 'cetus,aftermath,flowx') failures.push(`[tpm] V1.3: the integrations show Cetus, Aftermath and FlowX in that order (found ${logos})`);
  if (/tpm-results__primary/.test(ecoHtml) || /Sui Foundation|Mysten/.test(ecoText) || /\d+\s+(?:downstream|applications|apps)/i.test(ecoText)) failures.push('[tpm] V1.3: Ecosystem Distribution is no second results panel, names no Sui Foundation or Mysten Labs, and never counts the downstream reach');
  if (eco.accent && !(ecoHtml.match(/<span class="tpm-accent"[^>]*>([^<]*)<\/span>/) || [])[1]?.includes(eco.accent)) failures.push('[tpm] V1.3: the ecosystem headline sets its accent phrase');
}

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
  // (Full Site Iteration V1: broadened to the full public-facing system, as John decided; the headline is unchanged.)
  const conclusionCopy = 'The work began with a shared product language and carried across the full public-facing system, from the website and technical documentation to campaigns, articles, content, and every expression built from the same strategic foundation.';
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
const emRule = rulesFor(/(?:^|,)\s*\.tpm-em\s*(?=,|$)/).map((r) => r.body).join(';');
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
if (!tpmScripts.includes('(max-width: 47.99rem)') || !/\(?\w+\.matches\s*&&\s*\w+\)?\s*\|\|/.test(tpmScripts)) failures.push('[mobile] on phones the system opens by itself once it stands, and stays open');
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
// Creator Marketing V1.2, Part One (trackpad hiccups): the page always scrolls natively. Nothing listens to the wheel
// or to touch moves, nothing sets the scroll position, and nothing snaps; the motion is read from the scroll position
// through one passive listener. The first movement of a gesture moves the page and its pinned stages at once: no
// still stretch at a stage's entry, the hero answering from its first pixel, and the large frames (the website's
// display, the documentation's browser, the flagship film) rising with the scroll itself rather than on a timed
// transition set off by a threshold. Recordings are fetched while the browser is idle, two screens ahead.
if (/addEventListener\(\s*[`'"](?:wheel|mousewheel|DOMMouseScroll|touchmove|touchstart)[`'"]|passive:\s*(?:false|!1)|scrollTo\(|scrollBy\(|scrollIntoView|scrollTop\s*=/.test(tpmScripts) || !/addEventListener\(\s*[`'"]scroll[`'"],\s*\w+,\s*\{\s*passive:\s*(?:true|!0)\s*\}\)/.test(tpmScripts) || CSS_RULES.some((r) => /\.tpm-/.test(r.sel) && /scroll-snap/.test(r.body)) || /scroll-snap-type/.test(rulesFor(/^html$|^body$/).map((r) => r.body).join(';'))) failures.push('[tpm] the page scrolls natively: no wheel or touch listeners, no scroll position set by the script, no snapping; one passive scroll listener');
const tpmSrc = (f) => fs.readFileSync(path.join(root, 'src/components/tpm', f), 'utf8');
const flowSrc = tpmSrc('TpmFlow.astro');
const flowPhases = [...((flowSrc.match(/const PHASES: Array<\[string, number\]> = \[([\s\S]*?)\];/) || [, ''])[1]).matchAll(/\['(\w+)',\s*([\d.]+)\]/g)].map((m) => [m[1], Number(m[2])]);
const flowRun = flowPhases.reduce((s, [, v]) => s + v, 0);
const flowFallback = Number((flowSrc.match(/var\(--flow-run,\s*([\d.]+)\)/) || [])[1]);
// Creator Marketing V1.4 (03): once the frame has pinned and the stack has settled, the whole stack holds for a short
// stretch of scrolling before it spreads (the 'stack' phase, 0.12 to 0.18 of a screen, first), so it reads as one
// object; a phase of the scroll, not a timer (the script's one timeout is the resize debounce). The spread then eases
// in and out (smooth), so the hold ends without a jolt; the rail, the exit, the statement and its short hold (half a
// screen at most) are as they were, with no dead stretch at the release; the pin's length and its CSS fallback agree.
const flowNames = flowPhases.map(([k]) => k).join(' ');
const stackHold = (flowPhases.find(([k]) => k === 'stack') || [, 0])[1];
if (flowNames !== 'stack spread rail exit statement hold' || !(stackHold >= 0.12 && stackHold <= 0.18) || (flowPhases.find(([k]) => k === 'hold') || [, 9])[1] > 0.5 || Math.abs(flowRun - flowFallback) > 0.001 || flowRun > 4) failures.push(`[tpm] V1.4: the Foundation holds its whole stack for 0.12 to 0.18 of a screen once pinned, then spreads, runs its rail, exits, states and releases without a dead stretch (found ${flowPhases.map(([k, v]) => `${k} ${v}`).join(', ')}; ${flowRun} screens, the CSS fallback ${flowFallback})`);
if (!/const tSpread = phase\(p, 'spread'\);/.test(flowSrc) || !/const q = smooth\(clamp\(\(tSpread - i \* 0\.07\) \/ \(1 - \(IN_PILE - 1\) \* 0\.07\)\)\);/.test(flowSrc) || (flowSrc.match(/setTimeout/g) || []).length !== 1 || !/addEventListener\('resize', \(\) => \{\s*window\.clearTimeout\(t\);\s*t = window\.setTimeout/.test(flowSrc)) failures.push('[tpm] V1.4: the stack spreads from the end of its hold, eased in and out, driven by the scroll alone (no timer)');
if (!/const fade = span\(p, 0(?:\.0\d)?, [\d.]+\);/.test(tpmSrc('TpmHero.astro')) || !/const lift = easeOut\(p\);/.test(tpmSrc('TpmHero.astro'))) failures.push('[tpm] the hero answers the very first movement of the scroll: its fade starts at once and its lift eases out from the start');
for (const [f, re] of [['TpmWebsite.astro', /addRise\(/], ['TpmDocs.astro', /addRise\(/], ['TpmCampaign.astro', /addRise\(/]]) {
  const s = tpmSrc(f);
  if (!re.test(s) || /is-pending/.test(s)) failures.push(`[tpm] ${f}: its large frame rises with the scroll itself (addRise), never on a timed entrance set off by a threshold`);
}
if (/is-pending/.test(tpmPage) || CSS_RULES.some((r) => /\.tpm-/.test(r.sel) && /is-pending/.test(r.sel))) failures.push('[tpm] no timed, threshold-triggered entrances are left (is-pending)');
const tpmMotionSrc = fs.readFileSync(path.join(root, 'src/lib/tpm-motion.ts'), 'utf8');
if (!/const t = still \? 1 : clamp\(\(y \+ vh - r\.top\) \/ \(vh \* [\d.]+\)\);/.test(tpmMotionSrc) || !/\|\$\{e\.toFixed\(3\)\}`;/.test(tpmMotionSrc) || !/n = n\.offsetParent/.test(tpmMotionSrc) || !/requestIdleCallback/.test(tpmMotionSrc) || (tpmMotionSrc.match(/rootMargin: '200% 0px 200% 0px'/g) || []).length < 2) failures.push('[tpm] the rises are read from the scroll position and the layout (never from their own transform), fade in from nothing (never half there below the screen), still for reduced motion; recordings load while the browser is idle, two screens ahead');

// ------------------------------------------ Events and Multimedia Production
// Version 1.4 (the V1.4 delta brief of October 14, 2026, on the live V1.3
// page, after the V1.1 to V1.3 deltas and John's Combined Build Brief): the
// third case study, on its own page. 01 Hero (one editorial reel in a wide
// cinematic frame beneath the headline and its paragraph; since V1.4 a
// restrained program monitor), 02 the transition (SECURE. BUILD. CAPTURE.
// CUT. AMPLIFY., and since V1.3 the broadcast signal after the last word,
// since V1.4 moving only inside its tile), 03 Build the activation (an
// original 3D concept rendering whose two screens play; since V1.3 about
// John's capabilities across events), 04 the Expanding Production Deck (V1.3:
// the live presentation, the production room and the event film in one deck,
// in place of their three sections; V1.4: one vertical accordion at every
// width, with the production room's Setup and Final), 05 the conclusion, with
// the way on to the next case study, then Contact. Copy is checked against the
// briefs; only public-safe outcomes, no unverified metrics.
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
  // V1.6: the technical explainer first, then the Sui Fest footage, the Jungle Talk podcast and the live presentation (the pending team interview after the podcast).
  const CHAPTERS = [['explainer', 'Technical explainer'], ['event-film', 'Event film'], ['podcast', 'Creator podcast'], ['team-interview', 'Team interview'], ['presentation', 'Live presentation']];
  if (JSON.stringify((evData.hero?.chapters || []).map((c) => [c.key, c.title])) !== JSON.stringify(CHAPTERS)) failures.push('[events] events.json orders the reel (V1.6): technical explainer, event film, creator podcast, (team interview,) live presentation');
  const chapterReady = (c) => {
    const a = evAsset(c.asset);
    return a.permission === 'approved' && a.type === 'video' && Boolean(a.file) && fs.existsSync(path.join(root, 'public/media', a.file));
  };
  const expected = (evData.hero?.chapters || []).filter(chapterReady).map((c, i) => [c.key, String(i + 1).padStart(2, '0'), c.title]);
  const shown = [...hero.matchAll(/<div\b[^>]*data-chapter-layer="([\w-]+)"[^>]*data-number="(\d+)"[^>]*data-title="([^"]+)"/g)].map((m) => [m[1], m[2], decode(m[3])]);
  if (JSON.stringify(shown) !== JSON.stringify(expected)) failures.push(`[events] the reel shows its ready chapters in order, numbered in order (found ${shown.map((x) => x.join(' ')).join(', ')})`);
  const interview = evAsset('ev-hero-team-interview');
  if (interview.permission !== 'approved') {
    if (JSON.stringify(shown.map(([, n, t]) => `${n} / ${t}`)) !== JSON.stringify(['01 / Technical explainer', '02 / Event film', '03 / Creator podcast', '04 / Live presentation'])) failures.push('[events] until the team interview arrives the reel runs four chapters (V1.6): 01 / TECHNICAL EXPLAINER, 02 / EVENT FILM, 03 / CREATOR PODCAST, 04 / LIVE PRESENTATION');
    if (/Team interview|team-interview/i.test(hero) || /Singapore Team|\bTBD\b|coming soon/i.test(evText)) failures.push('[events] no placeholder, disabled chapter or "coming soon" while the team interview is pending');
  } else if (JSON.stringify(shown.map(([, n, t]) => `${n} / ${t}`)) !== JSON.stringify(['01 / Technical explainer', '02 / Event film', '03 / Creator podcast', '04 / Team interview', '05 / Live presentation'])) failures.push('[events] with the team interview in, the reel runs five chapters, the interview after the podcast');
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
  // V1.6: the Sui Fest chapter is the approved two-cut edit (in on the head of the shot that carries
  // "And we asked our favorite teams", through the montage shot on screen at 0:11; then from the first
  // frame of "Like a lot of people" to the last before "a whale, like a"); Jungle Talk two cuts, each
  // ending on its shot's last frame. Both files are cut to those lengths.
  const film = evAsset('ev-hero-event-film');
  const pod = evAsset('ev-hero-podcast');
  const secOf = (a) => (a.file && fs.existsSync(path.join(root, 'public/media', a.file)) ? mp4Seconds(path.join(root, 'public/media', a.file)) : NaN);
  if (!/0:02\.711 to 0:11\.386/.test(film.source || '') || !/2:36\.615 to 2:39\.909/.test(film.source || '') || !/And we asked our favorite teams/.test(film.source || '') || !/a whale, like a/.test(film.source || '') || /0:03 to 0:06|0:07\.007/.test(film.source || '') || !(Math.abs(secOf(film) - 11.97) < 0.05) || Math.abs(film.duration - 11.97) > 0.01) failures.push(`[events] the event film chapter is the approved Sui Fest two-cut edit, 11.97 seconds (found ${secOf(film)})`);
  if (!/0:00 to 0:04\.421/.test(pod.source || '') || !/0:24\.566 to 0:27\.861/.test(pod.source || '') || !/PUSH FOR LONGER DEALS/.test(pod.source || '') || !(Math.abs(secOf(pod) - 7.72) < 0.05) || Math.abs(pod.duration - 7.72) > 0.01) failures.push(`[events] the creator podcast chapter is Jungle Talk's two cuts, 0:00 to 0:04.4 and 0:24.6 to 0:27.9 (found ${secOf(pod)})`);
  for (const a of [film, pod]) {
    const f = mp4Facts(path.join(root, 'public/media', a.file || '-'));
    if (f.top.indexOf('moov') > f.top.indexOf('mdat') || f.handlers.includes('soun') || f.width !== 1600 || f.height !== 900 || !f.avc) failures.push(`[events] ${a.file}: 1600 by 900 H.264, silent, its index first`);
  }
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

  // V1.4: a restrained program monitor, nothing more. Beside the label a steady
  // tally dot and the word PROGRAM; TC before the counter; the rail as a
  // sequence timeline (a segment to each chapter at the chapter's length, so a
  // fifth takes its place on its own; completed, active and upcoming told apart
  // by a quiet difference in opacity; one playhead through the active segment;
  // nothing to drag); faint title-safe corner marks only on hover with a fine
  // pointer or with keyboard focus. No REC, meters, grain, flicker or crosshair.
  const hud = block(hero, '<div class="evh__hud"');
  const reading = block(hud, '<span class="evh__reading"');
  if (!/^<span class="evh__reading"[^>]*>\s*<span class="evh__dot"[^>]*><\/span>\s*<span class="evh__bus"[^>]*>Program<\/span>\s*<span class="evh__sep"[^>]*>·<\/span>\s*<span data-reel-label/.test(reading) || evData.hero?.monitor?.program !== 'Program') failures.push('[events] the label reads PROGRAM · 01 / LIVE PRESENTATION: a tally dot and the word before the chapter');
  const dotRules = evRules(/evh__dot/);
  if (!dotRules.length || dotRules.some((r) => /animation|transition/.test(r.body)) || CSS_RULES.some((r) => /@keyframes evh-tally/.test(r.at)) || !evRules(/^\.evh__reel\.is-playing \.evh__dot$/).some((r) => /background:\s*#9fc9c3/i.test(r.body))) failures.push('[events] the tally dot is steady: lit in the light accent while the reel plays, never blinking');
  if (!/<span class="evh__tc"[^>]*>\s*<span class="evh__tc-key"[^>]*>TC<\/span>\s*<span data-reel-tc[^>]*>00:00:00:00<\/span>\s*<\/span>/.test(hud) || evData.hero?.monitor?.timecode !== 'TC') failures.push('[events] the counter at the top right reads TC 00:00:00:00');
  const hudWords = hud.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/^Program · \d\d \/ [A-Za-z ]+ TC 00:00:00:00$/.test(hudWords)) failures.push(`[events] the monitor's only words are PROGRAM, the chapter and TC (found "${hudWords}")`);
  const segs = [...rail.matchAll(/<span class="evh__seg"([^>]*)>/g)].map((m) => ({ key: (m[1].match(/data-reel-seg="([\w-]+)"/) || [])[1], state: (m[1].match(/data-state="(\w+)"/) || [])[1], w: Number((m[1].match(/--w:\s*([\d.]+)/) || [])[1]) }));
  const segLen = (k) => Number(evAsset((evData.hero?.chapters || []).find((c) => c.key === k)?.asset).duration) || 1;
  if (segs.length !== expected.length || segs.some((g, i) => g.key !== expected[i]?.[0] || Math.abs(g.w - segLen(g.key)) > 0.01 || g.state !== (i === 0 ? 'active' : 'next'))) failures.push(`[events] the timeline: a segment to each chapter, as long as the chapter, the first active (found ${segs.map((g) => `${g.key} ${g.w} ${g.state}`).join(', ')})`);
  if ((rail.match(/data-reel-head/g) || []).length !== 1 || /<(?:input|button|a)\b|role="slider"|draggable|tabindex/.test(rail) || !evRules(/^\.evh__rail$/).some((r) => /pointer-events:\s*none/.test(r.body))) failures.push('[events] the timeline has one playhead and nothing to drag: information, not a scrubber');
  const segOp = (re) => Number((evRules(re).filter((r) => !r.at).map((r) => r.body).join(';').match(/opacity:\s*(0?\.\d+)/) || [])[1]);
  const [opNext, opDone, opActive] = [segOp(/^\.evh__seg$/), segOp(/^\.evh__seg\[data-state=['"]?done['"]?\]$/), segOp(/^\.evh__seg\[data-state=['"]?active['"]?\]$/)];
  if (!(opNext > 0 && opNext < opDone && opDone < opActive && opActive <= 0.8 && opActive - opNext <= 0.6)) failures.push(`[events] completed, active and upcoming segments differ by a quiet change of opacity (found ${opNext}, ${opDone}, ${opActive})`);
  const heroScripts = pageScripts(evPage);
  if (!/data-state/.test(heroScripts) || !/\[data-reel-head\]/.test(heroScripts) || !/head\.style\.left\s*=/.test(heroScripts) || !/['"`]done['"`]/.test(heroScripts) || !/['"`]next['"`]/.test(heroScripts)) failures.push('[events] the reel marks its segments completed, active and upcoming and moves the playhead');
  const safeTag = (hero.match(/<span class="evh__safe"[^>]*><\/span>/) || [''])[0];
  const safeRule = evRules(/^\.evh__safe$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const markRaw = (safeRule.match(/--mark:\s*([^;]+)/) || [])[1] || '';
  const markAlpha = /^#[0-9a-f]{8}$/i.test(markRaw.trim()) ? parseInt(markRaw.trim().slice(7, 9), 16) / 255 : Number((markRaw.match(/rgba?\([^)]*[,/]\s*(0?\.\d+)\)/) || [])[1]);
  if (!safeTag || !/aria-hidden="true"/.test(safeTag) || !block(hero, '<div class="evh__frame').includes('class="evh__safe"') || !/inset:\s*10%/.test(safeRule) || (safeRule.match(/linear-gradient/g) || []).length !== 8 || /(?:^|;)\s*border(?:-width)?:/.test(safeRule) || !(markAlpha >= 0.08 && markAlpha <= 0.12) || !/opacity:\s*0\b/.test(safeRule)) failures.push(`[events] the title-safe guides: four faint corner marks (8 to 12%) at the 80% area inside the frame, not a rectangle, hidden at rest (found ${markAlpha.toFixed ? markAlpha.toFixed(3) : markAlpha})`);
  const safeOn = evRules(/evh__safe$/).filter((r) => /opacity:\s*1\b/.test(r.body));
  if (!safeOn.length || safeOn.some((r) => !/hover:\s*hover/.test(r.at) || !/pointer:\s*fine/.test(r.at)) || !safeOn.some((r) => /:hover \.evh__safe/.test(bare(r.sel))) || !safeOn.some((r) => /:has\(:focus-visible\) \.evh__safe/.test(bare(r.sel))) || !/transition:\s*opacity\s+0?\.[3-5]\d*s/.test(safeRule) || !evRules(/evh__safe/).some((r) => /prefers-reduced-motion:\s*reduce/.test(r.at) && /transition:\s*none/.test(r.body))) failures.push('[events] the guides show only on hover with a fine pointer or with keyboard focus (never on touch), fading gently, at once with reduced motion');
  const heroChrome = block(hero, '<div class="evh__reel').replace(/<video\b[\s\S]*?<\/video>/g, '');
  if (/class="evh__rec\b|\bREC\b|wave|meter|grain|crosshair|flicker|glitch|lens/i.test(heroChrome) || CSS_RULES.some((r) => /^\.evh/.test(bare(r.sel)) && /grain|flicker|glitch|noise|crosshair|meter/i.test(r.sel + r.body))) failures.push('[events] no REC, meters, waveforms, grain, crosshair, flicker or glitch in the hero');

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
  // (Mobile Optimization V1: the phone's sequence numbers, 01 to 05, are the one exception, checked below; they are
  // never shown wider and never read out.)
  const trNoNums = tr.replace(/<span class="evx__num"[^>]*>\d{2}<\/span>/g, '');
  if (/<svg\b|<img\b|<video\b|<h2\b|<a\b|<ol\b|<ul\b|<button\b/.test(trBare) || /\d/.test(textOf(trNoNums))) failures.push('[events] the transition has no other icon, lines, nodes, numbers, links or paragraphs: only the phrase and its signal');
  // Mobile Optimization V1, phones (below 48rem): no pin and no full screen. The five words become a compact numbered
  // sequence, 01 to 05, in two columns (AMPLIFY. and its signal across the last row), the section well within one
  // screen. The same face, case and color; the words wipe in, in turn, as the sequence comes into view (a wipe alone,
  // only with motion allowed) and the signal plays once after AMPLIFY.; with reduced motion it is simply there. The
  // numbers are hidden from assistive technology with the words (the phrase is read once), and never shown wider.
  const trNums = [...tr.matchAll(/<span class="evx__num"[^>]*>(\d{2})<\/span>/g)].map((m) => m[1]);
  const trCells = tr.match(/<span class="evx__cell[^"]*"[^>]*>/g) || [];
  if (trNums.join(',') !== '01,02,03,04,05' || trCells.length !== 5 || trCells.some((t) => !/aria-hidden="true"/.test(t)) || !/evx__cell--last/.test(trCells[4] || '')) failures.push(`[mobile] the phone's sequence numbers the five words 01 to 05, each with its word, hidden from assistive technology (found ${trNums.join(', ') || 'none'})`);
  const evPhone = (re) => evRules(re).filter((r) => PHONE.test(r.at)).map((r) => r.body).join(';');
  if (!evRules(/^\.evx__num$/).some((r) => !r.at && /display:\s*none/.test(r.body)) || !/display:\s*block/.test(evPhone(/^\.evx__num$/)) || !/color:\s*var\(--accent-ink\)/.test(evPhone(/^\.evx__num$/))) failures.push('[mobile] the numbers show on phones only, as the page\'s small numerals in the accent');
  const phrasePhone = evPhone(/^\.evx__phrase$/);
  if (!/display:\s*grid/.test(phrasePhone) || !/grid-template-columns:\s*repeat\(2,\s*minmax\(0(?:px)?,\s*1fr\)\)/.test(phrasePhone) || !/display:\s*contents/.test(evPhone(/^\.evx__line$/)) || !/grid-column:\s*1\s*\/\s*-1/.test(evPhone(/^\.evx__cell--last$/)) || !/min-height:\s*0/.test(evPhone(/^\.evx__pin$/))) failures.push('[mobile] on phones the five words sit in two columns, AMPLIFY. across the last row, in a section no taller than it needs');
  const trSrc = fs.readFileSync(path.join(root, 'src/components/events/EvTransition.astro'), 'utf8');
  if (!/const live = motion && wide\.matches/.test(trSrc) || !/matchMedia\('\(min-width: 48rem\)'\)/.test(trSrc) || !/is-reveal/.test(trSrc) || !/is-shown/.test(trSrc)) failures.push('[mobile] the phrase pins and follows the scroll only from 48rem; a phone reveals its sequence once as it comes into view');
  const revealWipe = evRules(/^\.evx\.is-reveal :is\(\.evx__num,\s*\.evx__word\)$/).filter((r) => MOTION_OK.test(r.at)).map((r) => r.body).join(';');
  if (!/clip-path:\s*inset\(-\.?0?\.2em 100% -\.?0?\.2em 0(?:px)?\)/.test(revealWipe) || /opacity/.test(revealWipe) || !/transition:\s*clip-path/.test(revealWipe) || evRules(/\.is-reveal/).some((r) => !MOTION_OK.test(r.at))) failures.push('[mobile] on phones each number and word wipes in, in turn (a wipe alone, every letter at full strength once uncovered), only with motion allowed');
  if (!evRules(/^\.evx\.is-reveal\.is-shown \.evx__tile$/).some((r) => MOTION_OK.test(r.at) && /evx-tile/.test(r.body)) || !evRules(/^\.evx\.is-reveal\.is-shown \.evx__g--far$/).some((r) => /evx-far/.test(r.body))) failures.push('[mobile] on phones the signal plays its sequence once, after AMPLIFY. lands');
  if (!evRules(/^\.evx__phrase$/).some((r) => /text-transform:\s*uppercase/.test(r.body) && /text-align:\s*center/.test(r.body)) || !evRules(/^\.evx__line$/).some((r) => /min-width:\s*48rem|width\s*>=\s*48rem/.test(r.at) && /display:\s*inline/.test(r.body)) || !evRules(/^\.evx__line$/).some((r) => !r.at && /display:\s*block/.test(r.body))) failures.push('[events] one centered uppercase line where it fits; two deliberate lines on a small screen');
  const trRun = Number((evRules(/^\.evx\.is-live$/).map((r) => r.body).join(';').match(/var\(--evx-run,\s*([\d.]+)\)/) || [])[1]);
  if (!(trRun >= 2.1 && trRun <= 2.4) || !evRules(/^\.evx\.is-live \.evx__pin$/).some((r) => /position:\s*sticky/.test(r.body))) failures.push(`[events] the phrase holds at the middle of the screen while it is read (V1.6: the section about 2.1 to 2.4 screens tall, found ${trRun || 'none'})`);
  if (!evRules(/^\.evx\.is-live \.evx__word$/).some((r) => MOTION_OK.test(r.at) && /opacity:\s*0\b/.test(r.body) && /transition:/.test(r.body)) || evRules(/^\.evx/).some((r) => /(?:^|;)\s*animation:/.test(r.body) && !/evx__signal|evx__tile|evx__g\b|evx__g--/.test(bare(r.sel)))) failures.push('[events] the words arrive by a short wipe and fade, only with motion allowed; nothing blinks or tunnels');
  const evScriptsAll = pageScripts(evPage);
  const trSource = fs.readFileSync(path.join(root, 'src/components/events/EvTransition.astro'), 'utf8');
  const trConst = (name) => Number((trSource.match(new RegExp(`const ${name} = ([\\d.]+);`)) || [])[1]);
  const travel = trConst('TRAVEL');
  if (!(travel >= 0.6 && travel <= 0.8) || !/p >= i \/ \(words\.length - 1\)/.test(trSource)) failures.push(`[events] the words arrive over about 0.6 to 0.8 of a screen of scrolling, the first at its start and the last at its end (found ${travel || 'none'})`);
  // V1.6, a longer final beat (the first four words keep their pace): after AMPLIFY.
  // the signal is shown complete by RESOLVE (a little over its own second at an
  // ordinary pace), then the finished line holds for HOLD (0.25 to 0.35 of a
  // screen) before the section lets go; the section is as tall as that (the script
  // sets it; the stylesheet's fallback repeats it).
  const resolve = trConst('RESOLVE');
  const hold = trConst('HOLD');
  const unpin = travel - trConst('START') + resolve + hold;
  if (!/const UNPIN = TRAVEL - START \+ RESOLVE \+ HOLD;/.test(trSource) || !(resolve >= 0.3 && resolve <= 0.5) || !(hold >= 0.25 && hold <= 0.35) || Math.abs(1 + unpin - trRun) > 0.001) failures.push(`[events] after AMPLIFY. the signal completes within about 0.3 to 0.5 of a screen and the finished line then holds for 0.25 to 0.35 more before the section lets go (found ${resolve} and ${hold}; the section ${(1 + unpin).toFixed(2)} screens tall, its fallback ${trRun})`);
  if (!/signal\?\.classList\.toggle\('is-done', p >= 1 \+ RESOLVE \/ TRAVEL\)/.test(trSource)) failures.push('[events] from RESOLVE past AMPLIFY. the signal is shown complete, however fast the reader scrolls (V1.6)');
  const doneRule = (re) => evRules(re).filter((r) => MOTION_OK.test(r.at)).map((r) => r.body).join(';');
  const doneTile = doneRule(/^\.evx\.is-live \.evx__signal\.is-done \.evx__tile$/);
  const donePoint = doneRule(/^\.evx\.is-live \.evx__signal\.is-done \.evx__g--point$/);
  const doneNear = doneRule(/^\.evx\.is-live \.evx__signal\.is-done \.evx__g--near$/);
  const doneFar = doneRule(/^\.evx\.is-live \.evx__signal\.is-done \.evx__g--far$/);
  const doneLift = doneRule(/^\.evx\.is-live \.evx__signal\.is-done \.evx__tile::?after$/);
  if (![doneTile, donePoint, doneNear, doneFar, doneLift].every((b) => /animation:\s*none/.test(b)) || !/clip-path:\s*inset\(0(?:px)?(?: 0(?:px)?){0,3}\)/.test(doneTile) || !/opacity:\s*1\b/.test(donePoint) || !/stroke-dasharray:\s*7\.66/.test(doneNear) || !/stroke-dasharray:\s*13\.86/.test(doneFar) || !/opacity:\s*0\b/.test(doneLift)) failures.push('[events] complete, the signal is its sequence\'s own last frame, still: the tile whole, the point bright, both pairs of arcs drawn, the lift settled (V1.6)');

  // ---- 02 the broadcast signal after AMPLIFY. (V1.3): the approved Option A,
  // Broadcast, in the solid tile treatment. Placed immediately after the word
  // (the word kept, the two never split across lines), punctuation and not a
  // button, hidden from assistive technology with its line; a point and two
  // pairs of arcs in outline weight on a solid tile in the accent; it arrives
  // only after the last word is in, and with reduced motion it is simply there.
  // V1.4: the ring outside the tile is gone; once the tile is revealed, a short
  // sequence plays inside it, once (about 450 to 600ms): the point brightens,
  // the inner arcs draw outward, the outer follow, the tile lifts very slightly
  // in brightness and settles. No halo, ring, bloom, bounce, overshoot or repeat.
  const sigs = tr.match(/class="evx__signal"/g) || [];
  const tail = (tr.match(/<span class="evx__tail"[^>]*>[\s\S]*?<\/svg><\/span><\/span><\/span>/) || [''])[0];
  const lines2 = [...tr.matchAll(/<span class="evx__line"[^>]*aria-hidden="true"[^>]*>/g)].map((m) => m.index);
  const tailAt = tr.indexOf('<span class="evx__tail"');
  if (sigs.length !== 1 || !/^<span class="evx__tail"[^>]*><span class="evx__word"[^>]*>Amplify\.<\/span><span class="evx__signal"[^>]*data-evx-signal/.test(tail) || !(lines2.length === 2 && tailAt > lines2[1]) || !evRules(/^\.evx__tail$/).some((r) => /white-space:\s*nowrap/.test(r.body))) failures.push('[events] one broadcast signal, immediately after AMPLIFY. on its line, the word kept and the two never split');
  if (/<button\b|tabindex=|role="button"|<a\b/.test(tail)) failures.push('[events] the signal is punctuation, not a button');
  const glyphPaths = [...tail.matchAll(/<path\b([^>]*)>/g)].map((m) => [(m[1].match(/evx__g--(near|far)/) || [])[1], (m[1].match(/\bd="([^"]+)"/) || [])[1] || '']);
  if ((tail.match(/<circle\b/g) || []).length !== 1 || glyphPaths.length !== 4 || glyphPaths.filter(([k]) => k === 'near').length !== 2 || glyphPaths.filter(([k]) => k === 'far').length !== 2 || glyphPaths.some(([, d]) => (d.match(/a/g) || []).length !== 1) || /<(?:rect|polygon|polyline|line|ellipse|image|text)\b/.test(tail)) failures.push('[events] the signal is Option A, Broadcast: a point with two pairs of arcs (each arc drawn on its own), and nothing else');
  const tileRule = evRules(/^\.evx__tile$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const glyphRule = evRules(/^\.evx__glyph$/).filter((r) => !r.at).map((r) => r.body).join(';');
  if (!/background:\s*var\(--accent\)/.test(tileRule) || !/overflow:\s*hidden/.test(tileRule) || !/fill:\s*none/.test(glyphRule) || !/stroke:\s*currentColor/i.test(glyphRule) || !/stroke-width:\s*2(?:\.\d+)?\b/.test(glyphRule)) failures.push('[events] the signal is a solid tile in the accent with the glyph in outline weight');
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
  if (!tileIn || !(delayOf(tileIn.body) >= 0.05 && delayOf(tileIn.body) < 0.3)) failures.push(`[events] the tile wipes in as the last word is still landing, sooner than V1.4's 0.3s (V1.6, found ${tileIn ? delayOf(tileIn.body) : 'none'}s)`);
  // The ring is gone: nothing leaves the tile, nothing scales, glows or repeats.
  if (/evx__pulse/.test(evPage) || CSS_RULES.some((r) => /evx-pulse/.test(r.at) || /evx__pulse/.test(r.sel)) || evRules(/^\.evx/).some((r) => /box-shadow|drop-shadow|blur\(|infinite/.test(r.body)) || CSS_RULES.some((r) => /@keyframes evx-/.test(r.at) && /scale|transform|filter|box-shadow/.test(r.body))) failures.push('[events] no ring, halo, bloom, scaling or repeat: every movement stays inside the tile');
  // The sequence inside the tile, once it is revealed (times as the minifier writes the shorthand).
  const timing = (re) => {
    const r = evRules(re).find((x) => MOTION_OK.test(x.at) && /animation:/.test(x.body));
    const times = r ? [...(r.body.match(/animation:([^;]*)/) || [, ''])[1].matchAll(/(?:^|[\s,])(\d*\.?\d+)(m?s)\b/g)].map((m) => Number(m[1]) / (m[2] === 'ms' ? 1000 : 1)) : [];
    return { dur: times[0], delay: times[1], iter: r ? /infinite/.test(r.body) : false, body: r?.body || '' };
  };
  const tileT = timing(/^\.evx\.is-live \.evx__signal\.is-on \.evx__tile$/);
  const pointT = timing(/^\.evx\.is-live \.evx__signal\.is-on \.evx__g--point$/);
  const nearT = timing(/^\.evx\.is-live \.evx__signal\.is-on \.evx__g--near$/);
  const farT = timing(/^\.evx\.is-live \.evx__signal\.is-on \.evx__g--far$/);
  const liftT = timing(/^\.evx\.is-live \.evx__signal\.is-on \.evx__tile::?after$/);
  const seqStart = pointT.delay;
  const seqEnd = Math.max(...[pointT, nearT, farT, liftT].map((t) => t.delay + t.dur));
  const seqOk = [tileT, pointT, nearT, farT, liftT].every((t) => t.dur > 0 && t.delay >= 0 && !t.iter) && seqStart >= tileT.delay + tileT.dur - 0.1 && pointT.delay < nearT.delay && nearT.delay < farT.delay && farT.delay <= liftT.delay && liftT.delay + liftT.dur === seqEnd && seqEnd - seqStart >= 0.45 && seqEnd - seqStart <= 0.6;
  if (!seqOk) failures.push(`[events] once the tile is revealed, in about 450 to 600ms: the point brightens, the inner arcs draw, the outer follow, the tile lifts and settles (found ${(seqEnd - seqStart).toFixed(2)}s from ${seqStart}s)`);
  if (!(seqEnd <= 1.15)) failures.push(`[events] the signal is complete about a second after AMPLIFY., sooner than before (V1.6, found ${seqEnd}s)`);
  const kf = (name, step) => CSS_RULES.filter((r) => new RegExp(`@keyframes ${name}\\b`).test(r.at) && step.test(r.sel.trim())).map((r) => r.body).join(';');
  const drawsOut = (name) => {
    const from = kf(name, /^(?:0%|from)$/), to = kf(name, /^(?:100%|to)$/);
    const dash0 = Number((from.match(/stroke-dasharray:\s*([\d.]+)/) || [])[1]);
    const off0 = Number((from.match(/stroke-dashoffset:\s*(-?[\d.]+)/) || [])[1]);
    const dash1 = Number((to.match(/stroke-dasharray:\s*([\d.]+)/) || [])[1]);
    return dash0 === 0 && off0 < 0 && dash1 > 0 && Math.abs(-off0 - dash1 / 2) <= 0.15 && /opacity:\s*0\b/.test(from);
  };
  if (!/evx-point/.test(pointT.body) || !/opacity:\s*0?\.[1-5]/.test(kf('evx-point', /^(?:0%|from)$/)) || !/opacity:\s*1\b/.test(kf('evx-point', /^(?:100%|to)$/)) || !/evx-near/.test(nearT.body) || !/evx-far/.test(farT.body) || !drawsOut('evx-near') || !drawsOut('evx-far')) failures.push('[events] the point brightens and each arc draws outward from its middle');
  const liftPeak = Math.max(...CSS_RULES.filter((r) => /@keyframes evx-lift\b/.test(r.at)).map((r) => Number((r.body.match(/opacity:\s*(0?\.?\d+)/) || [])[1]) || 0));
  if (!/evx-lift/.test(liftT.body) || !(liftPeak > 0 && liftPeak <= 0.15) || !/opacity:\s*0\b/.test(kf('evx-lift', /^(?:100%|to)$/))) failures.push(`[events] the tile's lift is very slight and settles (found a peak of ${liftPeak})`);
  const hides = evRules(/evx__tile|evx__g\b|evx__g--/).filter((r) => /clip-path:\s*inset\(0(?:px)?\s+100%|opacity:\s*0\b/.test(r.body) && !/@keyframes/.test(r.at) && !/::?after$/.test(bare(r.sel)));
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
  // V1.6: the approved wider scope of the work, and the headline's second half in the page's teal, the color alone.
  const ACT_COPY = 'Before the doors open, I shape the strategy and coordinate every part of the activation, from sponsorships, speaking opportunities, and merchandise to event assets, on-site content, and post-event distribution.';
  if (one(act, /<p class="eva__copy[^"]*"[^>]*>([\s\S]*?)<\/p>/) !== ACT_COPY || evData.activation?.copy !== ACT_COPY) failures.push('[events] the activation carries the V1.6 paragraph: the strategy and every part of the activation, before the doors open');
  // Full Site Iteration V1.1 (05): on wide screens the headline stays left and the paragraph right, set left, and
  // the paragraph block is centered against the full height of the multi-line headline: the row's items centered
  // (never their tops or feet), with no margin offsetting the paragraph; widths, gap and rendering as before;
  // stacked on small screens.
  const evaHeadWide = evRules(/^\.eva__head$/).filter((r) => DESKTOP.test(r.at)).map((r) => r.body).join(';');
  const evaCopyWide = evRules(/^\.eva__copy$/).filter((r) => DESKTOP.test(r.at)).map((r) => r.body).join(';');
  if (!/align-items:\s*center/.test(evaHeadWide) || evRules(/^\.eva__head$/).some((r) => /align-items:\s*(?:start|end|flex-start|flex-end|baseline|last baseline)/.test(r.body)) || evRules(/^\.eva__copy$/).some((r) => /margin-top:|align-self:|text-align:\s*(?:center|right)/.test(r.body)) || /margin-top:|padding-top:/.test(evaCopyWide) || !/grid-template-columns:\s*minmax\(0(?:px)?,\s*5fr\)\s+minmax\(0(?:px)?,\s*7fr\)/.test(evaHeadWide) || evRules(/^\.eva__head$/).some((r) => !r.at && /grid-template-columns/.test(r.body))) failures.push('[events] V1.1: the activation\'s paragraph is centered against the headline\'s full height on wide screens (the row\'s items centered, no offsetting margin), the headline left and the paragraph right, set left, and stacked on small screens');
  const actTitle = (act.match(/<h2 id="ev-activation-title"[\s\S]*?<\/h2>/) || [''])[0];
  const actAccent = [...actTitle.matchAll(/<span class="eva__accent"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => textOf(m[1]));
  const accentRule = evRules(/^\.eva__accent$/).map((r) => r.body).join(';');
  if (JSON.stringify(actAccent) !== JSON.stringify(['before anyone enters the room.']) || evData.activation?.accent !== 'before anyone enters the room.' || !/^\s*color:\s*var\(--accent-ink\);?\s*$/.test(accentRule) || evRules(/eva__accent/).some((r) => /background|outline|border|box-shadow|animation|transition|text-decoration/.test(r.body))) failures.push('[events] one restrained accent: "before anyone enters the room." in the page\'s teal, the color alone (V1.6)');
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
  // V1.3 (October 2026): John approved one outcome that names the integrations, Sui Foundation and Mysten Labs and
  // a potential pilot; that exact sentence, in its labeled callout, is the only exception to what follows.
  const EV_FOLLOW = 'Event-led introductions and follow-through helped secure direct integrations with Cetus, Aftermath, and FlowX while opening strategic discussions with Sui Foundation and Mysten Labs. I created and managed the shared working group as it grew to more than 20 cross-organization stakeholders exploring a potential pilot.';
  const evCallouts = [...evNoCode.matchAll(/<div class="evd__callout"[^>]*>\s*<p class="evd__callout-label"[^>]*>([\s\S]*?)<\/p>\s*<p class="evd__outcome"[^>]*>([\s\S]*?)<\/p>\s*<\/div>/g)];
  if (evCallouts.length !== 1 || textOf(evCallouts[0][1]) !== 'COMMERCIAL FOLLOW-THROUGH' || textOf(norm(evCallouts[0][2])).replace(/[’‘]/g, "'") !== EV_FOLLOW) failures.push('[events] V1.3: the live presentation carries the approved Commercial Follow-Through, labeled, in its teal-ruled callout, once');
  if (/Sui Foundation|Mysten/.test(textOf(norm(evNoCode.replace(/<div class="evd__callout"[\s\S]*?<\/div>/g, ' '))))) failures.push('[events] V1.3: Sui Foundation and Mysten Labs appear only in the Commercial Follow-Through');
  const evUnverified = evNoCode.replace(/<p class="ev-slot__metric[\s\S]*?<\/p>/g, ' ').replace(/<div class="evd__callout"[\s\S]*?<\/div>/g, ' ');
  const evUnverifiedText = textOf(norm(evUnverified));
  for (const [re, what] of [[/\bpilot\b/i, 'an unannounced pilot'], [/\bcontract\b/i, 'contract discussions'], [/diligence/i, 'investor diligence'], [/data room/i, 'data rooms'], [/fundrais|funding round|raising/i, 'fundraising'], [/Foundation discussion/i, 'Foundation discussions'], [/youtube\.com|youtu\.be/i, 'a YouTube link (the V1.5 outcome may name the channel, as approved)'], [/Sui Network/, 'confidential Sui negotiations']]) {
    if (re.test(evText.split(EV_FOLLOW).join(' ')) || re.test(evUnverified.replace(/<[^>]+>/g, ' '))) failures.push(`[events] the page never mentions ${what}`);
  }
  if (/Aftermath/i.test(evUnverifiedText) || /Aftermath/i.test(evUnverified.replace(/<[^>]+>/g, ' '))) failures.push('[events] the page never mentions a named integration before it is verified');
  if (/\d[\d,.]*\s*[KkMm]?\+?\s+(?:impressions|likes|views|reposts|shares)/.test(evUnverifiedText)) failures.push('[events] no exact engagement figures until they are verified');

  // ---- 04 The Expanding Production Deck (V1.3): deployed from the V1.2 review
  // checkpoint as approved, in place of the session, the production room and
  // Sui Fest. Three chapters in order, every header always visible, one open at
  // a time (the first to begin with), each opened by a click, a tap or the
  // keyboard, never by itself; the checkpoint's words; a muted preview of 8 to
  // 15 seconds and the full film with sound; one credit line each; a short fade
  // with reduced motion; all three open without JavaScript. V1.4: one
  // full-width vertical accordion at every width, the open chapter a
  // substantial section on wide screens (media and words side by side), and the
  // production room's Setup and Final inside its chapter.
  if (/<section class="(?:evm|evs|evf)"|id="ev-room"|id="ev-setup"|id="ev-suifest"|class="ev-credits|class="ev-cue\b/.test(evPage)) failures.push('[events] the deck replaces the three separate sections (the session, the production room and Sui Fest), with their tallies and credit blocks');
  const deckSec = evSection('evd');
  // Full Site Iteration V1.2: the production room first, then the event film and
  // the live presentation, in the data and on the page alike (it led with the live
  // presentation before), so every number, label and order below follows it.
  // V1.5: the approved words for each chapter, the live presentation without
  // its full film (its preview only), Bob van der Meer credited for the edit in
  // the fine print only, and the participating teams on a line of their own.
  // V1.6: the live presentation's new outcome and credit, its preview the hero's
  // own presentation edit; the event film's preview the hero's Sui Fest edit and
  // no film with sound; the production room's Final its two-scene loop.
  const DECK = [
    {
      key: 'room', label: 'Production room', headline: 'Build the set. Direct the take. Shape the final cut.',
      context: 'At ETHDenver, I turned a production room and a minimal kit into a repeatable technical explainer series.',
      points: ['Built a compact setup with two cameras and a clip-on mic', 'Wrote 20 interview questions and directed multiple takes', 'Selected the strongest moments and shaped the edit direction'],
      outcome: 'One focused production session became a library of finished product explainers for the YouTube channel and social media.',
      credit: 'Concept, questions, direction, capture, and edit briefs by John Cowin · On-camera Max McKendry · Final edit Bob van der Meer',
      participants: '',
      preview: 'ev-room-final-loop', full: 'ev-video-slippage-full',
    },
    {
      key: 'film', label: 'Event film', headline: 'Capture the event. Connect the ecosystem.',
      context: 'At Sui Fest, I developed an interview-led event film featuring established teams across the ecosystem and positioned Bolt alongside them as an active participant. I conducted the interviews, coordinated contributors, shaped the edit, and led content distribution.',
      points: ['Interviewed established ecosystem teams and included Bolt within the same editorial frame', 'Built the narrative around a shared event experience rather than a standalone brand feature', 'Tagged participating teams and coordinated distribution to extend the film’s reach'],
      outcome: 'Featuring multiple teams turned the film into a shared distribution asset, expanding Bolt’s presence across the ecosystem.',
      credit: 'Concept, interviews, coordination, and distribution by John Cowin · Final edit Bob van der Meer',
      participants: 'With Cetus, Bluefin, 7K DeFi, NAVI & Astros, FlowX Finance, DoubleUp, Claynosaurz and Talus',
      preview: 'ev-hero-event-film', full: null,
    },
    {
      key: 'live', label: 'Live presentation', headline: 'From live presentation to lasting content.',
      context: 'I led Bolt Liquidity’s Sui Summit presentation from early planning through session strategy, deck direction, live production, capture, and post-event distribution.',
      points: ['Secured the slot, helped shape the subject, and promoted the session', 'Directed the deck, presentation setup, and live slides', 'Captured the presentation from multiple angles and repackaged it for continued distribution'],
      // V1.3 (October 2026): the Commercial Follow-Through, John's approved copy, word for word.
      outcome: 'Event-led introductions and follow-through helped secure direct integrations with Cetus, Aftermath, and FlowX while opening strategic discussions with Sui Foundation and Mysten Labs. I created and managed the shared working group as it grew to more than 20 cross-organization stakeholders exploring a potential pilot.',
      credit: 'Organized, directed, and captured by John Cowin · Speaker Max McKendry · Deck design and video edit by Bob van der Meer',
      participants: '',
      preview: 'ev-hero-presentation', full: null,
    },
  ];
  if (!/data-surface="dark"/.test((deckSec.match(/<section[^>]*>/) || [''])[0]) || !/<h2 id="ev-deck-title" class="sr-only"[^>]*>[^<]+<\/h2>/.test(deckSec)) failures.push('[events] the deck is on the dark ground of the screens, its section named for assistive technology');
  const deckChs = [...deckSec.matchAll(/<article class="evd__ch[^"]*"[^>]*data-deck-ch="([\w-]+)"[^>]*>([\s\S]*?)<\/article>/g)].map((m) => ({ key: m[1], html: m[2], open: /class="evd__ch is-open"/.test(m[0]) }));
  if (JSON.stringify(deckChs.map((c) => c.key)) !== JSON.stringify(DECK.map((c) => c.key)) || JSON.stringify((evData.deck?.chapters || []).map((c) => c.key)) !== JSON.stringify(DECK.map((c) => c.key))) failures.push(`[events] V1.2: the deck's three chapters in order: production room, event film, live presentation (found ${deckChs.map((c) => c.key).join(', ')})`);
  if (JSON.stringify(deckChs.map((c) => c.open)) !== JSON.stringify([true, false, false])) failures.push('[events] V1.2: one chapter open at a time, the production room to begin with');
  // ... and wherever the three chapters appear together: the hero's reel plays the same three in the same order (the
  // explainer from the production room, the Sui Fest film, the live presentation; the creator podcast between them is
  // the reel's own).
  const reelKeys = (evData.hero?.chapters || []).map((c) => c.key);
  const reelOrder = { room: 'explainer', film: 'event-film', live: 'presentation' };
  const reelPos = DECK.map((c) => reelKeys.indexOf(reelOrder[c.key]));
  if (reelPos.some((x) => x < 0) || reelPos.some((x, i) => i && x < reelPos[i - 1])) failures.push(`[events] V1.2: the hero's reel and the deck run the three chapters in one order (the reel has ${reelKeys.join(', ')})`);
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
      credit: one(ch.html, /<p class="evd__credit"[^>]*>([\s\S]*?)<\/p>/),
      participants: one(ch.html, /<p class="evd__credit evd__credit--with"[^>]*>([\s\S]*?)<\/p>/),
    };
    // (Apostrophes may be typographic.)
    const flat = (t) => (t || '').replace(/[‘’]/g, "'");
    for (const k of ['headline', 'context', 'outcome', 'credit', 'participants']) if (flat(got[k]) !== flat(want[k])) failures.push(`[events] chapter ${want.key}: its ${k} as the V1.5 and V1.6 briefs have it (found "${got[k]}")`);
    if (JSON.stringify(got.points.map(flat)) !== JSON.stringify(want.points.map(flat)) || got.points.length > 3) failures.push(`[events] chapter ${want.key}: up to three things John did, as the V1.5 brief has them`);
    // its media: the preview (a silent loop of 8 to 15 seconds), and, where the
    // chapter has one, the full film with sound and the way to it (V1.5: the
    // live presentation keeps its preview, with its pause control, and nothing else)
    const prev = evAsset(want.preview);
    if (!new RegExp(`<div class="evd__preview"[^>]*data-deck-preview[^>]*>\\s*<div class="ev-slot ev-slot--loop[^"]*"[^>]*data-asset="${want.preview}"[^>]*data-ev-loop`).test(ch.html) || !/data-ev-loop-toggle/.test(ch.html) || prev.permission !== 'approved' || prev.type !== 'video' || !(prev.duration >= 8 && prev.duration <= 15)) failures.push(`[events] chapter ${want.key}: a muted preview of 8 to 15 seconds with its pause control (${want.preview})`);
    if (want.full) {
      const full = evAsset(want.full);
      if (!new RegExp(`<div class="evd__full"[^>]*data-deck-full[^>]*>\\s*<figure class="evp[^"]*"[^>]*data-evp[^>]*id="ev-deck-player-${want.key}"`).test(ch.html) || full.permission !== 'approved' || !ch.html.includes(`/media/${full.file}`)) failures.push(`[events] chapter ${want.key}: the full film (${want.full}) waits behind its preview, to play with sound`);
      if (textOf(norm((ch.html.match(/<button\b[^>]*data-deck-watch[^>]*>([\s\S]*?)<\/button>/) || [, ''])[1])).replace(/\s*\d+:\d\d$/, '') !== 'Watch full video with sound') failures.push(`[events] chapter ${want.key}: "Watch full video with sound"`);
    } else if (/data-deck-full|data-deck-watch|data-evp\b|Watch full video|Play with sound|Sound on/.test(ch.html)) failures.push(`[events] chapter ${want.key}: no full film, no sound and no Watch full video with sound (V1.5; the event film since V1.6)`);
    if (/\bautoplay\b/.test(ch.html)) failures.push(`[events] chapter ${want.key}: nothing autoplays from the markup`);
  }
  // V1.4: one vertical stack at every width (never side by side), the open
  // chapter's height easing open on a curve without bounce; on wide screens a
  // substantial section (the media 56 to 60% of the two columns, the words 40
  // to 44%, the chapter about 65 to 75% of the screen's height); stacked on
  // narrow screens; compact headers with a number, a title and a chevron.
  if (evRules(/^(?:html\.js )?\.evd__(?:row|ch)$/).some((r) => /flex-direction:\s*row/.test(r.body)) || !evRules(/^\.evd__row$/).some((r) => !r.at && /flex-direction:\s*column/.test(r.body)) || evRules(/evd__/).some((r) => /writing-mode|flex-grow/.test(r.body))) failures.push('[events] the deck is one vertical stack at every width: no chapters side by side, no vertical rails');
  const bodyClosed = evRules(/^(?:html\.js )?\.evd__body$/).find((r) => !r.at && /grid-template-rows:\s*0fr/.test(r.body));
  const rowsDur = Number(((bodyClosed?.body || '').match(/grid-template-rows\s+(\d*\.?\d+)s/) || [])[1]);
  const deckEase = ((evRules(/^\.evd$/).map((r) => r.body).join(';').match(/--deck-ease:\s*([^;]+)/) || [])[1] || '').trim();
  const easeYs = ((deckEase.match(/cubic-bezier\(([^)]+)\)/) || [, ''])[1].split(',').map(Number));
  if (!bodyClosed || !(rowsDur >= 0.4 && rowsDur <= 0.7) || !/var\(--deck-ease\)/.test(bodyClosed.body) || easeYs.length !== 4 || easeYs[1] < 0 || easeYs[1] > 1 || easeYs[3] < 0 || easeYs[3] > 1) failures.push(`[events] the open chapter's height eases in 0.4 to 0.7s on a curve without bounce or overshoot (found ${rowsDur || 'none'}s, ${deckEase || 'none'})`);
  const deckWide = (re) => evRules(re).filter((r) => /@container\b[^@]*?(?:min-width:\s*[\d.]+rem|width\s*>=\s*[\d.]+rem)/.test(r.at) && !/@container\s+media\b/.test(r.at));
  const wideContent = deckWide(/^\.evd__content$/).map((r) => r.body).join(';');
  const split = (wideContent.match(/grid-template-columns:\s*minmax\(0(?:px)?,\s*(\d+)fr\)\s*minmax\(0(?:px)?,\s*(\d+)fr\)/) || []).slice(1).map(Number);
  const mediaShare = split.length === 2 ? split[0] / (split[0] + split[1]) : 0;
  if (!(mediaShare >= 0.56 && mediaShare <= 0.6)) failures.push(`[events] wide: the open chapter's media 56 to 60% and its words 40 to 44% (found ${split.join('/') || 'none'})`);
  // V1.6: the words in a natural top-to-bottom rhythm from the media's top line:
  // no minimum height for the chapter, nothing centered or stretched to the
  // media's height, the generous spacing V1.5 gave them kept as fixed gaps (up to
  // 1.5rem after the headline and 2.75rem between the others), and a measured
  // band between the header and the content.
  if (!/align-items:\s*start/.test(wideContent) || /align-items:\s*(?:center|stretch)|align-content:\s*stretch|min-height:/.test(wideContent) || !deckWide(/^\.evd__media$/).some((r) => /align-self:\s*start/.test(r.body)) || deckWide(/^\.evd__media$/).some((r) => /align-self:\s*center/.test(r.body))) failures.push('[events] wide: the media and the words start from one top line, nothing centered against the other and no minimum height (V1.6)');
  // Creator Marketing V1.0, Part I: on wide screens the live presentation's and the
  // event film's video (with its corner marks and timecode, which ride on its frame)
  // sits in the vertical center of the open card, the band above the content evened
  // out by a margin so there is as much room above the frame as below it; the words
  // keep the top line, and the production room keeps its Setup and Final up top.
  const mediaDivs = [...evPage.matchAll(/<div class="evd__media[^"]*"[^>]*>/g)].map((m) => m[0]);
  const centeredMedia = mediaDivs.filter((t) => /\bevd__media--centered\b/.test(t)).length;
  const roomMedia = (evPage.match(/<div class="(evd__media[^"]*)"[^>]*>\s*<div class="evd__sf\b/) || [, ''])[1];
  const centeredWide = deckWide(/^\.evd__media--centered$/).map((r) => r.body).join(';');
  if (mediaDivs.length !== 3 || centeredMedia !== 2 || !roomMedia || /evd__media--centered/.test(roomMedia) || !/align-self:\s*center/.test(centeredWide) || !/margin-top:\s*calc\(var\(--deck-pad\)\s*-\s*clamp\(/.test(centeredWide) || evRules(/^\.evd__media--centered$/).some((r) => !/@container/.test(r.at))) failures.push(`[events] Part I: the live presentation's and the event film's video in the vertical center of the open card on wide screens, the production room's media on the top line (found ${centeredMedia} centered of ${mediaDivs.length})`);
  const textBase = evRules(/^\.evd__text$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const textWide = deckWide(/^\.evd__text$/).map((r) => r.body).join(';');
  const gapAll = evRules(/^\.evd__gap(?:--lead)?$/).map((r) => r.body).join(';');
  const remIn = (v) => { const m = String(v || '').match(/([\d.]+)rem/); return m ? Number(m[1]) : NaN; };
  const clampOf = (body, name) => (body.match(new RegExp(`--${name}:\\s*clamp\\(([^,]+),\\s*([^,]+),\\s*([^)]+)\\)`)) || []).slice(1).map((x) => x.trim());
  const [gapLo, gapVh, gapHi] = clampOf(textWide, 'gap');
  const [leadLo, , leadHi] = clampOf(textWide, 'gap-lead');
  if (!/display:\s*flex/.test(textBase) || !/flex-direction:\s*column/.test(textBase) || /justify-content:\s*center/.test(textWide) || /flex:\s*1 1 0|flex-grow|max-height:\s*var\(--gap/.test(gapAll) || !/flex:\s*(?:none|0 0 auto)/.test(gapAll) || !(remIn(gapLo) >= 1.25) || remIn(gapHi) !== 2.75 || !/svh/.test(gapVh || '') || !(remIn(leadLo) >= 0.9) || remIn(leadHi) !== 1.5 || !(remIn((textBase.match(/--gap:\s*([^;]+)/) || [])[1]) >= 1.1)) failures.push(`[events] the words keep V1.5's generous spacing as fixed gaps, never stretched (V1.6: up to 1.5rem after the headline and 2.75rem between the others; found ${gapLo}, ${gapHi}, ${leadLo}, ${leadHi})`);
  const contentTop = (wideContent.match(/padding:\s*clamp\(([\d.]+)rem,\s*([\d.]+)svh,\s*([\d.]+)rem\)/) || []).slice(1).map(Number);
  if (!(contentTop[0] >= 1 && contentTop[2] <= 2.25 && contentTop[1] >= 2 && contentTop[1] <= 3.5)) failures.push(`[events] a measured band between a chapter's header and its content (V1.6, found ${contentTop.join(', ') || 'none'})`);
  for (const ch of deckChs) {
    const text = block(ch.html, '<div class="evd__text"');
    const order = [...text.matchAll(/class="(display evd__title|evd__context|evd__points|evd__outcome|evd__credits|evd__gap(?: evd__gap--lead)?)"/g)].map((m) => m[1].replace('display ', ''));
    const flatOrder = order.map((x) => (x === 'evd__gap evd__gap--lead' ? 'lead' : x === 'evd__gap' ? 'gap' : x.replace('evd__', ''))).join(' ');
    if (flatOrder !== 'title lead context gap points gap outcome gap credits' || (text.match(/<span class="evd__gap[^"]*"[^>]*>/g) || []).some((t) => !/aria-hidden="true"/.test(t))) failures.push(`[events] chapter ${ch.key}: the headline, the introduction, the things John did, the outcome and the credit, in order, a decorative spacer between each (found ${flatOrder})`);
  }
  const wideAt = Number(((deckWide(/^\.evd__content$/)[0]?.at || '').match(/([\d.]+)rem/) || [])[1]);
  if (!(wideAt >= 52 && wideAt <= 64) || evRules(/^\.evd__content$/).some((r) => !r.at && /grid-template-columns/.test(r.body))) failures.push(`[events] two columns only where the deck is wide (52 to 64rem, found ${wideAt || 'none'}); on narrow screens the media above the words`);
  if (!evRules(/^\.evd__rail$/).some((r) => !r.at && /min-height:\s*(?:3\.(?:2[5-9]|[3-9])\d*|[4-9](?:\.\d+)?)rem/.test(r.body))) failures.push('[events] the headers stay comfortable to tap (3.25rem or more)');
  for (const ch of deckChs) {
    const head = (ch.html.match(/<h3 class="evd__h"[^>]*>[\s\S]*?<\/h3>/) || [''])[0];
    if (/<(?:img|picture|video|p|svg|ul)\b/.test(head) || !/class="evd__chev"[^>]*aria-hidden="true"/.test(head) || !/class="evd__num"/.test(head)) failures.push(`[events] chapter ${ch.key}: its header carries its number, its title and a chevron, and no thumbnail or summary`);
  }
  if (!evRules(/^(?:html\.js )?\.evd__body$/).some((r) => !r.at && /grid-template-rows:\s*0fr/.test(r.body) && /visibility:\s*hidden/.test(r.body)) || !evRules(/^(?:html\.js )?\.evd__ch\.is-open \.evd__body$/).some((r) => !r.at && /grid-template-rows:\s*1fr/.test(r.body))) failures.push('[events] narrow: a vertical accordion, closed chapters hidden from everyone');
  if (evRules(/^\.evd__body$/).some((r) => !r.at && /grid-template-rows:\s*0fr|visibility:\s*hidden/.test(r.body))) failures.push('[events] without JavaScript every chapter is open (the accordion needs the script)');
  // V1.6: without JavaScript a chapter with a film shows the film alone (its native
  // controls); one without (the live presentation, the event film) keeps its
  // preview, standing still on its poster frame, so its media column is never empty.
  const noJsHidden = CSS_RULES.filter((r) => !r.at && /display:\s*none/.test(r.body)).flatMap((r) => r.sel.split(',').map((x) => bare(x).trim())).filter((s) => /^html:not\(\.js\)/.test(s) && /evd__preview$/.test(s));
  if (noJsHidden.includes('html:not(.js) .evd__preview') || !noJsHidden.includes('html:not(.js) .evd__frame--sf .evd__preview') || !noJsHidden.includes('html:not(.js) .evd__frame--full .evd__preview') || deckChs.some((c) => /data-deck-full/.test(c.html) && !/<div class="evd__frame evd__frame--(?:sf|full)\b[^"]*"[^>]*data-deck-frame/.test(c.html))) failures.push('[events] without JavaScript a chapter with a film shows the film alone, and one without keeps its preview on its poster (V1.6)');
  const deckReduce = evRules(/evd__ch|evd__body|evd__chev/).filter((r) => /prefers-reduced-motion:\s*reduce/.test(r.at));
  if (!deckReduce.some((r) => /transition:\s*none/.test(r.body)) || !deckReduce.some((r) => /transition:\s*opacity\s+0?\.[1-3]\d*s/.test(r.body)) || !deckReduce.some((r) => /evd__body/.test(bare(r.sel)) && /transition:\s*none/.test(r.body)) || deckReduce.some((r) => /transition:[^;]*(?:grid-template-rows|height|flex-grow|width)/.test(r.body))) failures.push('[events] with reduced motion a chapter changes through a short fade, nothing morphs');
  const deckScript = pageScripts(evPage);
  const deckKeys = deckScript.replace(/\s+/g, '');
  if (!/\[data-ev-deck\]/.test(deckScript) || !/classList\.toggle\(\s*[`'"]is-open[`'"],\s*\w+\s*\)/.test(deckScript) || !/aria-expanded/.test(deckScript) || !/aria-disabled/.test(deckScript) || !/scrollBy/.test(deckScript) || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].every((k) => deckScript.includes(k)) || !/ArrowDown:\w+\+1/.test(deckKeys) || !/ArrowUp:\w+-1/.test(deckKeys) || !/Home:0/.test(deckKeys) || !/End:\w+-1/.test(deckKeys) || !/\[data-deck-watch\]/.test(deckScript) || !/\.begin\(\)/.test(deckScript)) failures.push('[events] the deck opens a chapter on a click, a tap or the keyboard (arrows, Home, End), one at a time, and Watch plays the film with sound');
  if (/setInterval|requestIdleCallback/.test(deckScript.slice(deckScript.indexOf('[data-ev-deck]'), deckScript.indexOf('[data-ev-deck]') + 4000))) failures.push('[events] nothing advances the deck by itself');
  if (!evRules(/^\.evd__rail:focus-visible$/).some((r) => /outline:\s*2px solid/.test(r.body)) || !evRules(/^\.evd__watch:focus-visible$/).some((r) => /outline:\s*2px solid/.test(r.body))) failures.push('[events] the rails and the watch buttons show a strong focus ring');
  // V1.6: the hero's production vocabulary in the deck's media, quieter. Each
  // chapter's frame (the active media) has four corner marks just outside it
  // and a small timecode at its top right, smaller and fainter than the hero's,
  // shown only with JavaScript and only once the clip shown has played; the
  // timecode reads that clip's own playback. No label, tally, scan lines or
  // controls; the player's own marks give way inside the frame.
  for (const ch of deckChs) {
    const frames = [...ch.html.matchAll(/<div class="evd__frame[^"]*"[^>]*data-deck-frame[^>]*>/g)];
    const frame = frames.length ? block(ch.html, frames[0][0]) : '';
    const marks = [...frame.matchAll(/<span class="evd__mark evd__mark--(tl|tr|bl|br)"[^>]*aria-hidden="true"[^>]*><\/span>/g)].map((m) => m[1]);
    const tc = (frame.match(/<span class="evd__tc"[^>]*>[\s\S]*?<\/span>\s*<\/span>/) || [''])[0];
    if (frames.length !== 1 || JSON.stringify(marks) !== '["tl","tr","bl","br"]' || !/aria-hidden="true"/.test(tc) || !/<span class="evd__tc-key"[^>]*>TC<\/span>\s*<span data-deck-tc-value[^>]*>00:00:00:00<\/span>/.test(tc) || /evh__dot|Program|\bREC\b|scan|evd__(?:label|tally|scan)/i.test(frame.replace(/<video\b[\s\S]*?<\/video>/g, '').replace(/<figure class="evp[\s\S]*?<\/figure>/g, ''))) failures.push(`[events] chapter ${ch.key}: its media frame carries four quiet corner marks and a timecode, and nothing else (V1.6)`);
    if (/class="evd__text"[\s\S]*evd__mark|class="evd__h"[\s\S]*?evd__mark[\s\S]*?<\/h3>/.test(ch.html)) failures.push(`[events] chapter ${ch.key}: the marks belong to the media alone, not the card or the words`);
  }
  const markJs = evRules(/^html\.js \.evd__mark$/).map((r) => r.body).join(';');
  const markRem = remIn((markJs.match(/width:\s*([^;]+)/) || [])[1]);
  const markColor = ((markJs.match(/border(?:-color)?:[^;]*?(#[0-9a-f]{8}\b|rgba?\([^)]*\))/i) || [])[1] || '').trim();
  const deckMarkAlpha = /^#[0-9a-f]{8}$/i.test(markColor) ? parseInt(markColor.slice(7, 9), 16) / 255 : Number((markColor.match(/rgba?\([^)]*[,/]\s*(0?\.\d+)\)/) || [])[1]);
  const heroMarkRem = remIn((evRules(/^\.evh__crop$/).map((r) => r.body).join(';').match(/width:\s*([^;]+)/) || [])[1]);
  const tcJs = evRules(/^html\.js \.evd__tc$/).map((r) => r.body).join(';');
  const tcRem = remIn((tcJs.match(/font:\s*\d+\s+([\d.]+rem)/) || [])[1]);
  const heroTcRem = remIn((evRules(/^\.evh__reading,\s*\.evh__tc$/).map((r) => r.body).join(';').match(/font-size:\s*([^;]+)/) || [])[1]);
  if (!evRules(/^\.evd__mark,\s*\.evd__tc$/).some((r) => !r.at && /display:\s*none/.test(r.body)) || !(markRem > 0 && markRem < heroMarkRem) || !(deckMarkAlpha > 0 && deckMarkAlpha <= 0.25) || !(tcRem > 0 && tcRem < heroTcRem) || !/opacity:\s*0\b/.test(tcJs) || !evRules(/^html\.js \.evd__frame\.is-running \.evd__tc$/).some((r) => /opacity:\s*1\b/.test(r.body)) || !evRules(/^html\.js \.evd__frame \.evp__crop$/).some((r) => /display:\s*none/.test(r.body))) failures.push(`[events] the deck's marks and timecode are smaller and quieter than the hero's, only with JavaScript, the timecode once its clip has played (found marks ${markRem}rem at ${deckMarkAlpha}, timecode ${tcRem}rem against ${heroMarkRem} and ${heroTcRem})`);
  const tcScript = deckScript.includes('data-deck-tc-value') ? deckScript.slice(deckScript.indexOf('data-deck-tc-value') - 200, deckScript.indexOf('data-deck-tc-value') + 1400) : '';
  if (!tcScript || !/currentTime/.test(tcScript) || !/requestAnimationFrame/.test(tcScript) || !/is-running/.test(tcScript) || /Math\.random|Date\.now|performance\.now/.test(tcScript)) failures.push('[events] the deck\'s timecode reads the clip shown in the frame, frame by frame while it runs, and makes nothing up');
  // The live presentation and the event film play the hero's own edits (the same files); the presentation in its own wide frame.
  const chOf = (key) => deckChs.find((c) => c.key === key)?.html || '';
  const liveHtml = chOf('live');
  const filmHtml = chOf('film');
  if (!liveHtml.includes('/media/ev-hero-presentation.mp4') || !/data-asset="ev-hero-presentation"[^>]*>/.test(liveHtml) || !/class="ev-slot ev-slot--loop[^"]*"[^>]*style="aspect-ratio:\s*2\.157\s*\/\s*1"[^>]*data-asset="ev-hero-presentation"/.test(liveHtml) || !filmHtml.includes('/media/ev-hero-event-film.mp4') || !hero.includes('/media/ev-hero-presentation.mp4') || !hero.includes('/media/ev-hero-event-film.mp4') || /suifest-interview-loop|sui-summit-max-presentation-loop|suifest-interviews\.mp4/.test(deckSec)) failures.push('[events] the live presentation and the event film play the hero\'s own edits, the presentation in its own wide frame (V1.6)');
  // V1.6: the scroll-assisted deck. It pins below the site's header inside its
  // runway (the browser's own sticky positioning; a chapter taller than the room
  // scrolls into view before it holds) on wide screens with motion allowed and
  // room for a chapter; the reader's scrolling opens the next chapter after each
  // viewing interval (about six tenths of a screen), back up reverses it, a click
  // opens any chapter at once; nothing snaps, nothing takes the reader's input,
  // nothing advances by itself; reduced motion, narrow and short screens keep the
  // manual accordion.
  const pinDeck = evRules(/^\.evd\.is-pinned \.evd__deck$/).map((r) => r.body).join(';');
  if (!/position:\s*sticky/.test(pinDeck) || !/top:\s*var\(--pin-top/.test(pinDeck) || !/margin-top:\s*var\(--deck-lead/.test(pinDeck) || !evRules(/^\.evd__runway$/).some((r) => /display:\s*flow-root/.test(r.body)) || !/<div class="evd__runway"[^>]*data-deck-runway[^>]*>\s*<div class="evd__deck"[^>]*data-ev-deck/.test(deckSec)) failures.push('[events] the deck pins in its runway by the browser\'s own sticky positioning (V1.6)');
  if (evRules(/evd/).some((r) => /scroll-snap|overscroll-behavior/.test(r.body)) || CSS_RULES.some((r) => /scroll-snap-type/.test(r.body))) failures.push('[events] no scroll snapping');
  const pinScript = deckScript.includes('[data-deck-runway]') ? deckScript : '';
  // The deck's own module (the page's other scripts listen to the scroll too).
  const deckModule = [...evPage.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => path.join(dist, (m[1].startsWith(SITE_ORIGIN) ? m[1].slice(SITE_ORIGIN.length) : m[1]).replace(BASE, '').replace(/^\/+/, ''))).filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).find((js) => js.includes('[data-deck-runway]')) || '';
  const scrollListeners = [...deckModule.matchAll(/addEventListener\(\s*[`'"]scroll[`'"]\s*,\s*\w+\s*,\s*(\{[^}]*\})\s*\)/g)].map((m) => m[1].replace(/\s+/g, ''));
  if (!pinScript || !deckModule || !/prefers-reduced-motion: reduce/.test(pinScript) || !/56\s*\*\s*\w+\(\)/.test(pinScript) || !/innerHeight\s*>=\s*\w+/.test(pinScript) || !/innerHeight\s*\*\s*\.?0?\.6\b/.test(deckModule) || !scrollListeners.length || scrollListeners.some((o) => !/^\{passive:(?:!0|true)\}$/.test(o)) || /addEventListener\(\s*[`'"]scroll[`'"](?![^)]*passive:(?:\s*)(?:!0|true))/.test(deckModule) || /addEventListener\(\s*[`'"](?:wheel|touchmove|keydown)[`'"][^)]*passive:\s*(?:!1|false)/.test(pinScript) || /scroll-snap|setInterval/.test(pinScript)) failures.push('[events] the scroll-assisted deck follows the reader\'s own scrolling (passive), pins only on wide screens with motion allowed and room, gives each chapter a viewing interval, and never takes the reader\'s input (V1.6)');
  // The pin decided by the reduced-motion query itself, the deck's width (56rem)
  // and the screen's height together, and no wheel or touch listener of any kind
  // (the deck reads the scroll position, nothing else).
  const reduceVars = [...deckModule.matchAll(/(\w+)\s*=\s*window\.matchMedia\(\s*[`'"]\(prefers-reduced-motion: reduce\)[`'"]\s*\)/g)].map((m) => m[1]);
  const pinGate = deckModule.replace(/\s+/g, '').match(/!(\w+)\.matches&&\w+\.clientWidth>=56\*\w+\(\)&&window\.innerHeight>=(\w+)/);
  if (!pinGate || !reduceVars.includes(pinGate[1]) || /addEventListener\(\s*[`'"](?:wheel|mousewheel|DOMMouseScroll|touchstart|touchmove)[`'"]/.test(deckModule)) failures.push('[events] the deck pins only with motion allowed, on a wide deck and a tall enough screen, and listens to no wheel or touch to do it (V1.6)');
  // V1.4: the production room's Setup and Final, inside its chapter: two compact
  // tabs over one stage, never side by side, never switched by itself, the
  // stage the same size either way, at once with reduced motion. Since Creator
  // Marketing V1.2 (Part One) Final, the explainer's muted preview with its film
  // behind Watch, is the default whenever the chapter opens (it was Setup, the
  // photograph); Setup stays a crossfade away, and the reader's last choice
  // holds for the rest of the visit.
  const roomHtml = deckChs.find((c) => c.key === 'room')?.html || '';
  const sfBlock = block(roomHtml, '<div class="evd__sf"');
  const sfList = (sfBlock.match(/<div class="evd__sf-tabs"[^>]*>/) || [''])[0];
  const sfTabs = [...sfBlock.matchAll(/<button\b([^>]*role="tab"[^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: textOf(m[2]) }));
  const sfPanels = [...sfBlock.matchAll(/<div class="evd__sf-panel[^"]*"[^>]*>/g)].map((m) => m[0]);
  const sfSetupTag = sfPanels.find((x) => /id="ev-sf-setup"/.test(x)) || '';
  const sfFinalTag = sfPanels.find((x) => /id="ev-sf-final"/.test(x)) || '';
  if (deckChs.filter((c) => /data-sf\b/.test(c.html)).length !== 1 || evData.setupFinal?.chapter !== 'room' || !/role="tablist"/.test(sfList) || !/aria-label="[^"]+"/.test(sfList) || JSON.stringify(sfTabs.map((t) => t.text)) !== '["Setup","Final"]' || !/aria-selected="false"/.test(sfTabs[0]?.attrs || '') || !/tabindex="-1"/.test(sfTabs[0]?.attrs || '') || !/aria-selected="true"/.test(sfTabs[1]?.attrs || '') || /tabindex="-1"/.test(sfTabs[1]?.attrs || '') || sfPanels.length !== 2 || !sfPanels.every((x) => /role="tabpanel"/.test(x) && /aria-labelledby="ev-sf-tab-/.test(x)) || /is-shown/.test(sfSetupTag) || !/is-shown/.test(sfFinalTag)) failures.push('[events] the production room has two tabs, SETUP and FINAL (selected), each controlling its panel, Final shown to begin with (Creator Marketing V1.2)');
  const setupPanel = block(sfBlock, '<div class="evd__sf-panel" id="ev-sf-setup"');
  const finalPanel = block(sfBlock, '<div class="evd__sf-panel is-shown" id="ev-sf-final"');
  if (!new RegExp(`data-asset="${evData.setupFinal?.photo}"`).test(setupPanel) || !/<picture\b/.test(setupPanel) || !/class="ev-slot[^"]*"[^>]*style="aspect-ratio:\s*16\s*\/\s*9"/.test(setupPanel) || !/class="ev-slot[^"]*"[^>]*style="aspect-ratio:\s*16\s*\/\s*9"/.test(finalPanel) || /<figcaption|evd__sf-caption/.test(sfBlock) || /Two cameras, two tripods/.test(evPage) || 'caption' in (evData.setupFinal || {})) failures.push('[events] Setup shows the behind-the-scenes photograph, whole, with no caption (V1.5)');
  // Final's muted preview plays by itself once the chapter is open and in view (no data-loop-off on its panel); the
  // Setup panel waits (data-loop-off) while Final shows.
  if (!/data-asset="ev-room-final-loop"/.test(finalPanel) || !/data-ev-loop-toggle/.test(finalPanel) || !finalPanel.includes(`/media/${evAsset(evData.setupFinal?.final).file}`) || /data-loop-off/.test(sfFinalTag) || !/data-loop-off/.test(sfSetupTag) || !/<video\b[^>]*\bmuted\b[^>]*>/.test(finalPanel)) failures.push('[events] Final holds the finished explainer: its muted two-scene loop with its pause control, playing by itself while Final shows (Creator Marketing V1.2), and the film behind Watch');
  // V1.6: the Final loop is only its two scenes, cut from the film's own shots,
  // with nothing of "When things like slippage occur". (The homepage's events
  // montage, Full Site Iteration V1, opens on the same shot; checked below.)
  const finalLoop = evAsset('ev-room-final-loop');
  const finalSec = mp4Seconds(path.join(root, 'public/media', finalLoop.file || '-'));
  const finalFacts = mp4Facts(path.join(root, 'public/media', finalLoop.file || '-'));
  if (finalLoop.permission !== 'approved' || !/1:09\.111 to 1:17\.953/.test(finalLoop.source || '') || !/Bolt solves slippage by providing you a deterministic price/.test(finalLoop.source || '') || !/set execution price/.test(finalLoop.source || '') || !/When things like slippage occur/.test(finalLoop.source || '') || !(Math.abs(finalSec - 8.84) < 0.05) || Math.abs(finalLoop.duration - 8.84) > 0.01 || finalFacts.handlers.includes('soun') || finalFacts.width !== 1600 || finalFacts.top.indexOf('moov') > finalFacts.top.indexOf('mdat') || !fs.existsSync(path.join(root, 'src/assets', finalLoop.poster || '-'))) failures.push(`[events] the Final loop is the two scenes alone, 1:09.111 to 1:17.953 of the film, silent, 1600 wide, with its poster (found ${finalSec}s)`);
  // Full Site Iteration V1: the homepage's events card plays one montage in this order: the production room, Sui Fest
  // and its event film, a brief creator podcast, and the live presentation last, whose title slide dissolves back into
  // the explainer's yellow on dark (no jump in brightness). V1.1 (04): moving footage only; no still image, freeze
  // frame or move across a photograph, in this card or any other. V1.2 expanded it with more excerpts of the masters.
  // V1.3 (the final desktop correction): the montage is the Events page's four approved edits, each a locked module
  // played whole, at its own speed and in its own internal order, nothing taken from the raw masters: the production
  // room's Final loop, the Sui Fest event film, the Jungle Talk podcast (at the top 80% the card has always shown, so
  // its captions and corner marks stay out) and the live presentation (its whole frame letterboxed), in that order. The
  // record lists the four in playing order, each with its file and length, and names the joins: clean cuts between the
  // modules and one 0.4 second dissolve reset, the presentation into the explainer. So the loop runs the four lengths
  // less that dissolve, between 38 and 40 seconds.
  {
    const m = evAsset('ev-events-montage');
    const src = m.source || '';
    const MODULES = [['ev-room-final-loop', 'bolt-slippage-final-loop.mp4', 8.84], ['ev-hero-event-film', 'ev-hero-event-film.mp4', 11.97], ['ev-hero-podcast', 'ev-hero-podcast.mp4', 7.72], ['ev-hero-presentation', 'ev-hero-presentation.mp4', 10.22]];
    const listed = [...src.matchAll(/(?:^|[;:] )(\d+), [^,;()]+, (ev-[\w-]+) \(([\w.-]+\.mp4), ([\d.]+) s, whole: ([^;]*)/g)].map((x) => ({ n: Number(x[1]), id: x[2], file: x[3], sec: Number(x[4]), what: x[5] }));
    const listText = listed.map((x) => `${x.n}, ${x.id}`).join('; ');
    const inOrder = listed.length === MODULES.length && listed.every((x, i) => x.n === i + 1 && x.id === MODULES[i][0] && x.file === MODULES[i][1] && Math.abs(x.sec - MODULES[i][2]) < 0.005);
    if (m.file !== 'home-events-montage-fs13.mp4' || m.permission !== 'approved' || !inOrder) failures.push(`[events] V1.3: the homepage's events montage is the Events page's four approved edits, whole and in this order: the production room, Sui Fest, Jungle Talk and the live presentation, each listed in its record with its file and length (found ${listText || 'no modules'})`);
    for (const [id, file, sec] of MODULES) {
      const a = evAsset(id);
      const got = mp4Seconds(path.join(root, 'public/media', a.file || '-'));
      if (a.permission !== 'approved' || a.file !== file || Math.abs((a.duration || 0) - sec) > 0.005 || !(Math.abs(got - sec) < 0.05)) failures.push(`[events] V1.3: the montage's module ${id} is the approved ${file}, ${sec} s (found ${a.file || 'none'}, ${a.permission || 'no permission'}, recorded ${a.duration} s, playing ${Number.isFinite(got) ? got.toFixed(2) : '?'} s)`);
    }
    if (!/top 80%/.test(listed[2]?.what || '') || !/captions and corner marks fall outside/.test(listed[2]?.what || '') || !/letterboxed/.test(listed[3]?.what || '') || !/whole 2\.157:1 frame/.test(listed[3]?.what || '')) failures.push('[events] V1.3: Jungle Talk keeps its framing (its top 80%, its captions and corner marks outside) and the presentation its whole frame, letterboxed (no crop)');
    const sum = MODULES.reduce((s, x) => s + x[2], 0);
    const loop = LOOP_SECONDS['home-events-montage-fs13.mp4'];
    if (!(Math.abs(loop - (sum - 0.4)) <= 0.06) || !(loop >= 38 && loop <= 40) || !(Math.abs(loop - (m.duration || 0)) < 0.02)) failures.push(`[events] V1.3: the montage runs its four modules whole, less one 0.4 second dissolve, between 38 and 40 seconds (modules ${sum.toFixed(2)} s, loop ${loop} s, record ${m.duration} s)`);
    if (!/Joins: clean cuts from the production room into Sui Fest, Sui Fest into Jungle Talk and Jungle Talk into the presentation/.test(src) || !/0\.4 second dissolve reset, the presentation into the explainer/.test(src) || !/nothing added inside a module/.test(src)) failures.push('[events] V1.3: the record names the joins: clean cuts between the modules and one 0.4 second dissolve reset, the presentation into the explainer, nothing added inside a module');
    if (/(?:Slippage|SuiFest|Jungle Talk|Max Presentation)\.mp4 \d+:\d\d/.test(src)) failures.push('[events] V1.3: the montage takes nothing from the raw masters (no excerpt of a master is listed in its record)');
    const cardVideos = cardManifest.filter((a) => CARD_MEDIA.includes(a.file));
    for (const v of cardVideos) {
      const note = v.source || '';
      const listedNote = note.replace(/No still image, freeze frame or move across a photograph/g, '');
      if (/\.(?:jpe?g|png|webp|heic|tiff?)\b|Ken Burns|kenburns|freeze/i.test(listedNote) || (v.id === 'ev-events-montage' && !/No still image, freeze frame or move across a photograph/.test(note))) failures.push(`[claim] V1.1: ${v.id}: a homepage card video is moving footage only, no still image, freeze frame or move across a photograph`);
    }
  }
  const sfPanelRule = evRules(/^(?:html\.js )?\.evd__sf-panel$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const sfPanelOn = evRules(/^(?:html\.js )?\.evd__sf-panel\.is-shown$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const sfFrame = block(sfBlock, '<div class="evd__frame evd__frame--sf"');
  if (!/grid-area:\s*1\s*\/\s*1/.test(sfPanelRule) || (sfFrame.match(/<div class="evd__sf-panel/g) || []).length !== 2 || evRules(/^\.evd__sf$/).some((r) => /grid-template-columns/.test(r.body)) || !/visibility:\s*hidden/.test(sfPanelRule) || !/transition:\s*opacity\s+0?\.[2-5]\d*s/.test(sfPanelOn) || !evRules(/evd__sf-panel/).some((r) => /prefers-reduced-motion:\s*reduce/.test(r.at) && /transition:\s*none/.test(r.body))) failures.push('[events] Setup and Final share one stage, one framed cell (never side by side), cross-fading, and change at once with reduced motion');
  // V1.5: a clear segmented control with the media: two equal options in one
  // track, just above the stage (never laid over it), the selected one filled
  // in the page's accent with dark type on it, a hover and a strong focus ring,
  // no icons; there from the first paint with JavaScript, absent without it.
  // Watch full video with sound only under Final: under Setup it is out of
  // sight and reach (its line kept), and nothing switches the stage for it.
  const sfTabsRule = evRules(/^\.evd__sf-tabs$/).map((r) => r.body).join(';');
  if (!/grid-template-columns:\s*repeat\(2,\s*minmax\(0(?:px)?,\s*1fr\)\)/.test(sfTabsRule) || evRules(/evd__sf-tabs/).some((r) => /position:\s*absolute/.test(r.body)) || /<svg|<img/.test(sfList + (sfBlock.match(/<div class="evd__sf-tabs"[\s\S]*?<\/div>/) || [''])[0]) || /\bhidden\b/.test(sfList.replace(/class="[^"]*"/, '')) || !evRules(/^html:not\(\.js\) \.evd__sf-tabs$/).some((r) => /display:\s*none/.test(r.body))) failures.push('[events] Setup and Final: a clear segmented control of two equal options just above the stage, no icons, there from the first paint (V1.5)');
  const sfOn = evRules(/^\.evd__sf-tab\[aria-selected=['"]?true['"]?\]$/).map((r) => r.body).join(';');
  if (!/background:\s*var\(--accent\)/.test(sfOn) || !/color:\s*var\(--c-ink\)/.test(sfOn) || !evRules(/^\.evd__sf-tab:hover$/).some((r) => /background/.test(r.body)) || !evRules(/^\.evd__sf-tab:focus-visible$/).some((r) => /outline:\s*2px solid/.test(r.body)) || !evRules(/^\.evd__sf-tab$/).some((r) => /min-height:\s*2\.25rem/.test(r.body))) failures.push('[events] the selected option is filled in the accent, with a hover, a strong focus ring and a comfortable target (V1.5)');
  // (Creator Marketing V1.2: Final shows first, so Watch is there from the start; Setup sends it out of sight.)
  const roomWatch = (roomHtml.match(/<button\b[^>]*data-deck-watch[^>]*>/) || [''])[0];
  const watchHandler = deckScript.slice(deckScript.lastIndexOf('[data-deck-watch]'));
  if (!/class="evd__watch"/.test(roomWatch) || /is-away/.test(roomWatch) || !evRules(/^html\.js \.evd__watch\.is-away$/).some((r) => /visibility:\s*hidden/.test(r.body) && /opacity:\s*0/.test(r.body)) || !/classList\.toggle\(\s*[`'"]is-away[`'"],\s*\w+\s*!==\s*[`'"]final[`'"]\s*\)/.test(deckScript) || /views\.get|\(\s*[`'"]final[`'"]\s*\)/.test(watchHandler)) failures.push('[events] Watch full video with sound shows only under Final (there from the start, Final being the default), its line kept under Setup (V1.5)');
  // Final first, once, as the deck starts; after that only the reader switches (no reset when the chapter reopens, so
  // their last choice holds for the visit).
  const sfInit = [...deckScript.matchAll(/\b\w+\(\s*[`'"](final|setup)[`'"]\s*\)/g)].map((m) => m[1]);
  if (JSON.stringify(sfInit) !== '["final"]' || /sessionStorage|localStorage/.test(deckScript.slice(deckScript.indexOf('[data-sf]'), deckScript.indexOf('[data-sf]') + 2500))) failures.push(`[events] the production room selects Final once as it starts, and nothing selects for the reader after that, so their last choice holds for the visit (found ${sfInit.join(', ') || 'no initial selection'})`);
  if (!evRules(/^html:not\(\.js\) \.evd__sf-panel\[data-sf-panel=['"]?final['"]?\]$/).some((r) => /order:\s*-1/.test(r.body))) failures.push('[events] without JavaScript the production room shows its film first, then the photograph (Creator Marketing V1.2)');
  if (deckChs.filter((c) => c.key !== 'room').some((c) => /is-away|data-deck-watch/.test(c.html)) || (deckSec.match(/data-deck-watch/g) || []).length !== 1) failures.push('[events] only the production room offers a film with sound, and only under Final (V1.6)');
  const sfScript = deckScript.includes('[data-sf]') ? deckScript.slice(deckScript.indexOf('[data-sf]'), deckScript.indexOf('[data-sf]') + 2500) : '';
  if (!sfScript || !/aria-selected/.test(sfScript) || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].every((k) => sfScript.includes(k)) || !/ev:loop-sync/.test(deckScript) || /setTimeout|setInterval|requestIdleCallback/.test(sfScript)) failures.push('[events] the reader switches Setup and Final (a click, a tap or the arrow keys); nothing switches by itself');
  const setupPhoto = evAsset('ev-image-production-setup');
  const finalFilm = evAsset('ev-video-slippage-full');
  if (setupPhoto.permission !== 'approved' || !fs.existsSync(path.join(root, 'src/assets', setupPhoto.file || '-')) || evData.setupFinal?.photo !== 'ev-image-production-setup' || evData.setupFinal?.final !== 'ev-video-slippage-full' || finalFilm.permission !== 'approved' || !fs.existsSync(path.join(root, 'public/media', finalFilm.file || '-')) || !fs.existsSync(path.join(root, 'src/assets', finalFilm.poster || '-'))) failures.push('[events] the setup photograph and the finished explainer are in the project (setupFinal)');
  // Credits (V1.5): one fine-print line per chapter, the participating teams on a
  // second; Bob van der Meer's edit credited there and nowhere above it; titles
  // never invented. Names stay whole in the fine print.
  const creditOf = (key) => one(chOf(key), /<p class="evd__credit"[^>]*>([\s\S]*?)<\/p>/) || '';
  if (!creditOf('live').includes('Speaker Max McKendry') || !creditOf('live').includes('Deck design and video edit by Bob van der Meer') || !creditOf('room').includes('On-camera Max McKendry') || !creditOf('room').includes('Final edit Bob van der Meer') || !creditOf('film').includes('Final edit Bob van der Meer') || !/With Cetus, Bluefin, 7K DeFi, NAVI & Astros, FlowX Finance, DoubleUp, Claynosaurz and Talus/.test(one(chOf('film'), /<p class="evd__credit evd__credit--with"[^>]*>([\s\S]*?)<\/p>/))) failures.push('[events] each chapter credits its collaborators in the fine print: the speaker and on-camera subject, the deck design, the final edit, and the participating teams on a line of their own');
  for (const c of deckChs) {
    const above = textOf(norm(c.html.replace(/<div class="evd__credits"[\s\S]*?<\/div>/, ' ')));
    if (/Bob van der Meer|edited by/i.test(above)) failures.push(`[events] chapter ${c.key}: Bob van der Meer's credit only in the fine print`);
  }
  if (!/\u00a0/.test((chOf('film').match(/<div class="evd__credits"[\s\S]*?<\/div>/) || [''])[0]) || !evRules(/^\.evd__credit$/).some((r) => /text-wrap:\s*pretty/.test(r.body)) || !evRules(/^\.evd__keep$/).some((r) => /white-space:\s*nowrap/.test(r.body)) || !/<span class="evd__keep"[^>]*>On-camera Max McKendry<\/span>/.test(chOf('room')) || !/video edit by\u00a0Bob\u00a0van\u00a0der\u00a0Meer/.test(chOf('live'))) failures.push('[events] the fine print keeps names whole (V1.6: every name after "by")');
  // The event film's framing (V1.5): an ecosystem and distribution strategy, no
  // longer the angle of a company that was not a sponsor or did not own the
  // stage, and no rounded or estimated reach.
  const filmText = textOf(norm(chOf('film')));
  if (/sponsor|own the stage|opportunity had to be made/i.test(filmText) || /impressions|likes|tens of thousands|hundreds of/i.test(filmText)) failures.push('[events] the event film is framed as ecosystem positioning and distribution, with no sponsorship angle and no estimated reach');
  if (/Max McKendry,\s*(?:Head|Chief|Director|Founder|Co-founder|CEO|CTO|VP)/i.test(evText)) failures.push('[events] no titles are invented for the collaborators');

  // ---- media: posters, nothing loaded early, controls where sound matters
  const players = [...evPage.matchAll(/<figure class="evp\b[\s\S]*?<\/figure>/g)].map((m) => m[0]);
  if (players.length !== 1) failures.push(`[events] the one film with sound has a player: the production room's explainer (the live presentation's went in V1.5, the event film's in V1.6; found ${players.length})`);
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
  for (const token of ['[data-deck-runway]', 'is-pinned', '--deck-lead', '--pin-top', 'is-shifting', '[data-deck-frame]', 'ev:frame-sync', 'is-running', '[data-ev-reel]', '[data-reel-toggle]', 'is-waiting', 'IntersectionObserver', 'visibilitychange', 'prefers-reduced-motion: reduce', 'prefers-reduced-data: reduce', 'saveData', 'NotAllowedError', 'preload', '[data-evp]', 'muted', '[data-ev-deck]', '[data-deck-rail]', '[data-deck-watch]', 'aria-expanded', 'aria-disabled', '[data-sf]', 'aria-selected', 'ev:loop-sync', 'data-loop-off', '[data-reel-head]', 'ArrowRight', 'ArrowLeft', '[data-ev-transition]', '[data-ev-reveal]', '[data-ev-loop]', '[data-ev-loop-toggle]', '[data-ev-stage]', 'matrix3d', '(min-width: 48rem)', '[data-evp-sound]', 'ResizeObserver']) {
    if (!evScripts.includes(token)) failures.push(`[events] the page's script is missing ${token}`);
  }
  if (!/\.pause\(\)/.test(evScripts) || !/addEventListener\(\s*[`"']play[`"']/.test(evScripts) || !/addEventListener\(\s*[`"']volumechange[`"']/.test(evScripts)) failures.push('[events] starting one video with sound, or turning its sound on, pauses every other');
  if (!/addEventListener\(\s*[`"']ended[`"']/.test(evScripts)) failures.push('[events] at the end of a chapter the reel moves on to the next');
}

// ------------------------------------- Creator Marketing and Partnerships
// Version 1.3 (John's Creator Marketing and Partnerships V1.3 delta brief,
// October 2026, against the deployed Version 1.2): the first case study, on
// its own page, in a visual language of its own (open air and daylight,
// destination atmospheres, a waterline, closing credits). 05 Hero, one
// layered coastal composition (illustrative stock photography, credited once,
// in the credits, and never presented as the trips), its paragraph on John's
// ownership alone; 06 the program context, no kicker, its headline and
// paragraph and (V1.3) one quieter line on the roster; 07 the creator network
// is gone (V1.3), with nothing in its place, and the creators and their
// affiliations appear only in the credits; no testimonial transition; 09 the
// campaign atlas, one stage and three destinations whose names never clip,
// its section title for assistive technology only (V1.3: Singapore rebuilt
// around the city, the game show and high tea, Mykonos with the Lock In
// Podcast in production); 10 the Trezor Dare Ad, the film first, then the
// brief, three creator-account highlights (#2 by reach, never "most-viewed")
// at the scale and in the centered composition of the Technical Product
// Marketing results (V1.3), and the one quotation with four phrases set
// apart by type alone (V1.3), no collaboration block; 11 the selected-content
// library, seven formats (V1.3 adds Podcasts) behind editorial tabs, a
// selected format looping until another is chosen or the reader leaves, the
// section turning toward the water below; 12 the program ownership in three
// chapters of John's own work under a wave that flows again (V1.3); 13 the
// credits, the team first, the only place naming collaborators and the
// creators; 14 the conclusion, with the way on to the next case study, then
// Contact. Square and landscape media only; no follower counts, rankings,
// categories, testimonials, destinations or qualifiers on the creators; no
// raw totals and no vague metrics; John never framed as the sole operator,
// and nothing implies he edited, shot or designed the work, sourced the
// creators, handled the contracts or ran the logistics alone; no moment used
// twice; unresolved placeholders never reach a production build. Copy is
// checked word for word against the briefs and the approved page.
{
  const cmPage = creator;
  const cmData = JSON.parse(fs.readFileSync(path.join(root, 'src/data/creator.json'), 'utf8'));
  const cmAssets = JSON.parse(fs.readFileSync(path.join(root, 'src/data/assets.json'), 'utf8')).assets || [];
  const cmAsset = (id) => cmAssets.find((x) => x.id === id) || {};
  const cmNoCode = cmPage.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '');
  const cmText = textOf(norm(cmNoCode));
  // The page's words with a space wherever an element ends, so a word never runs into the next element's.
  const cmSpaced = spaced(norm(cmNoCode));
  const cmBlock = (html, start, from = 0) => {
    // the element that opens at `start`, with its nested elements of the same tag
    const at0 = html.indexOf(start, from);
    if (at0 < 0) return '';
    const tag = (start.match(/^<(\w+)/) || [])[1];
    const re = new RegExp(`<${tag}\\b|<\\/${tag}>`, 'g');
    re.lastIndex = at0;
    let depth = 0;
    for (let m; (m = re.exec(html)); ) {
      depth += m[0].startsWith('</') ? -1 : 1;
      if (depth === 0) return html.slice(at0, m.index + m[0].length);
    }
    return html.slice(at0);
  };
  const cmBlocks = (html, start) => {
    const out = [];
    for (let i = html.indexOf(start); i >= 0; i = html.indexOf(start, i + start.length)) out.push(cmBlock(html, start, i));
    return out;
  };
  const cmSec = (cls) => cmBlock(cmNoCode, `<section class="${cls}"`);
  const cmOne = (html, re) => textOf(norm(((html || '').match(re) || [, ''])[1] || ''));
  const cmRules = (re) => CSS_RULES.filter((r) => r.sel.split(',').some((x) => re.test(bare(x).trim())));
  const cmScripts = pageScripts(cmPage);
  const cmSource = fs.readFileSync(path.join(root, 'src/lib/cm-motion.ts'), 'utf8');
  const fnOf = (name) => {
    const i = cmSource.indexOf(`export function ${name}(`);
    const j = i < 0 ? -1 : cmSource.indexOf('export function ', i + 10);
    return i < 0 ? '' : cmSource.slice(i, j < 0 ? undefined : j);
  };
  const openTag = (html) => (html.match(/^<[^>]+>/) || [''])[0];
  const fileOf = (src) => path.join(dist, decodeURIComponent(src.split('?')[0]).replace(BASE, '').replace(/^\/+/, ''));
  const webpSize = (file) => {
    const b = fs.readFileSync(file);
    if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return null;
    const chunk = b.toString('latin1', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  };
  const sizeOf = (file) => (/\.webp$/i.test(file) ? webpSize(file) : imageSize(file));
  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const isEmptyAlt = (img) => /\salt(?:="")?(?=[\s>/])/.test(img) && !/\salt="[^"]+"/.test(img);
  const PLACES = { 'costa-rica': 'Costa Rica', singapore: 'Singapore', mykonos: 'Mykonos' };

  // ---- the page: its own structure, no shared hero, no other page's components
  // (V1.2: the ownership's own line begins "My role connected..."; the shared layout's "My role:" label stays out.)
  if (/class="cs-hero[\s"_]/.test(cmPage) || /My role:/.test(cmSpaced) || (cmSpaced.match(/\bMy role\b/g) || []).length > 1) failures.push('[creator] the page has its own hero and no shared "My role:" line: John\'s part is stated in the program context, the ownership section and the credits');
  const classTokens = [...cmNoCode.matchAll(/\sclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
  const borrowed = [...new Set(classTokens.filter((t) => /^(?:tpm[-_]|ev[a-z]?(?:__|--|$)|ev-|cs-)/.test(t)))];
  if (borrowed.length) failures.push(`[creator] the page shares no Technical Product Marketing, Events or shared case-study component: its own visual language (found ${borrowed.join(', ')})`);
  if ((cmPage.match(/<h1\b/g) || []).length !== 1) failures.push('[creator] the page has one h1, the hero headline');
  if (!/<title>[^<]*Creator Marketing and Partnerships[^<]*<\/title>/.test(cmPage)) failures.push('[creator] the page is titled Creator Marketing and Partnerships');
  const voicesAt = cmPage.indexOf('<section class="cmv"');
  const cmOrder = [['hero', '<section class="cmh"'], ['context', '<section class="cmx"'], ['atlas', '<section class="cma"'], ['trezor', '<section class="cmz"'], ['library', '<section class="cml"'], ['ownership', '<section class="cmo"'], ['credits', '<section class="cmc"'], ['conclusion', '<section class="cme"'], ['contact', 'id="contact"']].map(([n, s]) => [n, cmPage.indexOf(s)]);
  if (cmOrder.some(([, i]) => i < 0) || cmOrder.some(([, i], k) => k && i < cmOrder[k - 1][1])) failures.push(`[creator] the page runs hero, program context, campaign atlas, Trezor Dare Ad, selected-content library, ownership, credits, conclusion, Contact (${cmOrder.map(([n, i]) => `${n} at ${i}`).join(', ')})`);
  // V1.3: the creator network is gone with nothing in its place (no carousel, grid, logo wall, marquee or roster), and
  // (V1.2) there is no testimonial transition: the program context leads straight into the campaign atlas.
  const ctxEnd = cmOrder[1][1] < 0 ? -1 : cmOrder[1][1] + cmBlock(cmPage, '<section class="cmx"', cmOrder[1][1]).length;
  const betweenCtxAtlas = ctxEnd < 0 || cmOrder[2][1] < 0 ? 'missing' : cmPage.slice(ctxEnd, cmOrder[2][1]).replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|\s+/g, '');
  if (voicesAt >= 0 || /class="cmv[\s"_]|data-cm-voices/.test(cmPage) || betweenCtxAtlas !== '') failures.push(`[creator] V1.3: nothing stands between the program context and the campaign atlas: no creator network, carousel, grid, logo wall, marquee, roster or testimonial transition (found "${betweenCtxAtlas.slice(0, 60)}" between them)`);
  // Every section names itself.
  for (const s of cmBlocks(cmNoCode, '<section class="cm')) {
    const tag = openTag(s);
    const by = (tag.match(/aria-labelledby="([^"]+)"/) || [])[1];
    if (!(by ? new RegExp(`\\sid="${by}"`).test(s) || (by === 'cm-title' && /id="cm-title"/.test(s)) : /aria-label="[^"]+"/.test(tag))) failures.push(`[creator] ${tag.slice(0, 40)}...: every section is named by its heading or a label`);
  }

  // ---- 05 Hero: the approved words over one layered composition
  const CM = {
    label: '01 / Creator Marketing and Partnerships',
    headline: 'Creator campaigns, built to travel.',
    // V1.2: John's ownership alone; the collaborators are credited once, in the credits.
    copy: 'I helped lead creator programs across Costa Rica, Singapore, and Mykonos, owning campaign strategy, creative direction, sponsor coordination, on-site production, and distribution.',
  };
  const hero = cmSec('cmh');
  if (!/data-surface="image"/.test(openTag(hero)) || !/data-cm-hero/.test(openTag(hero))) failures.push('[creator] the hero is an image surface the header reads, marked for its motion');
  if (cmOne(hero, /<p class="cmh__label"[^>]*>([\s\S]*?)<\/p>/) !== CM.label) failures.push(`[creator] the hero label reads "${CM.label}"`);
  if (cmOne(hero, /<h1 id="cm-title"[^>]*>([\s\S]*?)<\/h1>/) !== CM.headline) failures.push(`[creator] the headline reads "${CM.headline}" (V1.1)`);
  if (cmOne(hero, /<p class="cmh__copy"[^>]*>([\s\S]*?)<\/p>/) !== CM.copy) failures.push('[creator] the hero carries the V1.2 paragraph, word for word');
  if (cmData.hero?.headline !== CM.headline || cmData.hero?.copy !== CM.copy || cmData.hero?.label !== CM.label || 'credit' in (cmData.hero || {})) failures.push('[creator] creator.json keeps the V1.2 hero words, and no hero credit');
  // The layers in depth: the sky (slowest), the headline, the estate, the fronds (nearest, against the scroll).
  const layerAt = ['cmh__plane--sky', '<h1 id="cm-title"', 'cmh__plane--estate', 'cmh__plane--left', 'cmh__plane--right', 'cmh__fade', 'cmh__foot'].map((n) => hero.indexOf(n));
  if (layerAt.some((i) => i < 0) || layerAt.some((i, k) => k && i < layerAt[k - 1])) failures.push('[creator] the hero layers run sky, headline, estate, fronds, then the fade and the words over it');
  const rateOf = (cls) => Number((hero.match(new RegExp(`class="cmh__(?:plane|title)[^"]*${cls}[^"]*"[^>]*style="--rate: (-?[\\d.]+)"`)) || [])[1]);
  const rates = { sky: rateOf('cmh__plane--sky'), title: Number((hero.match(/<h1 id="cm-title"[^>]*style="--rate: (-?[\d.]+)"/) || [])[1]), estate: rateOf('cmh__plane--estate'), left: rateOf('cmh__plane--left'), right: rateOf('cmh__plane--right') };
  if (!(rates.sky > rates.title && rates.title > rates.estate && rates.estate > 0 && rates.left < 0 && rates.right < 0)) failures.push(`[creator] the layers move at their own depths: the sky slowest, then the headline and the estate, the fronds nearest (found ${JSON.stringify(rates)})`);
  if ((hero.match(/<div class="cmh__stage[^"]*"[^>]*aria-hidden="true"/g) || []).length !== 2) failures.push('[creator] the hero\'s picture layers are hidden from assistive technology; the headline and words carry it');
  const heroImgs = [...hero.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  if (heroImgs.length !== 4 || heroImgs.some((im) => !isEmptyAlt(im) || !/loading="eager"/.test(im))) failures.push(`[creator] the hero's four layers are decorative and load at once (found ${heroImgs.length})`);
  if (!heroImgs.some((im) => /cm-hero-estate/.test(im) && /fetchpriority="high"/.test(im))) failures.push('[creator] the estate, the hero\'s largest layer, is fetched first');
  if (/\.png\b/.test(hero)) failures.push('[creator] the transparent layers fall back to WebP, never to a heavy PNG');
  for (const src of new Set([...hero.matchAll(/(?:src|srcset)="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().split(/\s+/)[0])))) {
    const f = fileOf(src);
    if (fs.existsSync(f) && fs.statSync(f).size > 700 * 1024) failures.push(`[creator] hero layer ${path.basename(f)} is ${(fs.statSync(f).size / 1024).toFixed(0)} KB; keep each under 700 KB`);
  }
  // V1.1: the shorter headline sits higher (its last line clears the gable), and on short, wide
  // screens the scene drops (at most a fifth of the hero) and the type eases down, so the two lines
  // keep clear sky under the header (the behavior run measures it).
  const heroRule = cmRules(/^\.cmh$/).find((r) => !r.at && /--title-lift/.test(r.body))?.body || '';
  const liftOf = (body) => Number((body.match(/--title-lift:\s*([\d.]+)/) || [])[1]);
  const phoneLift = liftOf(cmRules(/^\.cmh$/).find((r) => /width\s*<=\s*47\.99rem|max-width:\s*47\.99rem/.test(r.at))?.body || '');
  if (!(liftOf(heroRule) >= 0.5 && liftOf(heroRule) <= 0.8) || !(phoneLift >= 0.6 && phoneLift <= 1) || !/--title-max:/.test(heroRule) || !/--title-size:\s*min\(/.test(heroRule) || !/--drop:\s*clamp\(0(?:px)?,[^;]*\*\s*\.2\)\)/.test(heroRule) || !cmRules(/^\.cmh__canvas$/).some((r) => /bottom:\s*calc\(-1 \* var\(--drop\)\)/.test(r.body)) || !cmRules(/^\.cmh__title$/).some((r) => /bottom:\s*calc\(var\(--roof\) - var\(--drop\)/.test(r.body))) failures.push(`[creator] the V1.1 headline sits clear of the gable (lift ${liftOf(heroRule)}, phones ${phoneLift}) and keeps clear sky under the header on short screens (the scene drops at most a fifth, the type eases down)`);
  // Illustrative stock, credited once, in the credits (V1.1): never presented as the trips, never credited in the hero.
  if (/cmh__credit/.test(hero) || /Illustrative photography/.test(textOf(hero))) failures.push('[creator] V1.1: the hero carries no photo credit; its illustrative photography is credited once, in the credits');
  if ((cmSpaced.match(/Rosemary Media/g) || []).length !== 1 || (cmSpaced.match(/Abbie Bernet/g) || []).length !== 1) failures.push(`[creator] the hero photographers are credited exactly once on the page (found ${(cmSpaced.match(/Rosemary Media/g) || []).length})`);
  for (const id of Object.values(cmData.hero?.layers || {})) {
    const a = cmAsset(id);
    if (a.permission !== 'approved' || !/Unsplash/.test(a.credit || '') || !/^Illustrative stock/.test(a.source || '') || !/unsplash\.com\/photos\//.test(a.source || '')) failures.push(`[creator] ${id}: a hero layer is approved illustrative Unsplash stock, credited, with its source photograph`);
  }
  if (!/^Illustrative/.test(cmAsset(cmData.hero?.layers?.estate).alt || '')) failures.push('[creator] the estate\'s description calls it illustrative');
  // The parallax and the entrance are enhancements: the script writes nothing for reduced motion; the CSS animates only with motion allowed.
  const heroSrc = fnOf('mountHero');
  if (!/hero\.style\.setProperty\('--p', String\(q\)\)/.test(heroSrc) || !/if \(reduced\(\)\) \{\s*if \(last !== 0\) hero\.style\.setProperty\('--p', '0'\)/.test(heroSrc) || !/window\.addEventListener\('scroll', schedule, \{ passive: true \}\)/.test(heroSrc) || /preventDefault|'wheel'|mousemove|pointermove/.test(heroSrc)) failures.push('[creator] the hero follows the scroll through one passive listener, follows nothing else (not the cursor), and rests for reduced motion');
  if (!cmRules(/^\.cmh__plane$/).some((r) => /var\(--p\)/.test(r.body) && /var\(--rate\)/.test(r.body))) failures.push('[creator] each hero layer turns the scroll into its own movement (--p times its --rate)');
  if (cmRules(/(?:^|\s)\.cmh/).some((r) => /(?:^|;)\s*animation:/.test(r.body) && !/animation:\s*none/.test(r.body) && !MOTION_OK.test(r.at))) failures.push('[creator] the hero animates only with motion allowed');
  // The page's description follows the V1.2 hero.
  const cmDesc = (cmPage.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1];
  if (decode(cmDesc) !== 'John Cowin helped lead creator programs across Costa Rica, Singapore, and Mykonos, owning campaign strategy, creative direction, sponsor coordination, on-site production, and distribution.') failures.push(`[creator] the page's description follows the V1.2 hero (found "${decode(cmDesc)}")`);

  // ---- 06 The program context (V1.2): no kicker, John's headline and paragraph, naming no collaborators
  const ctx = cmSec('cmx');
  const CTX = {
    headline: 'Each destination became a campaign in motion.',
    accent: 'a campaign in motion.',
    copy: 'For Bolt Liquidity, each trip brought creators, sponsors, and a production plan together for a few focused days. I led campaign strategy with co-sponsors, sponsor coordination, creative direction, on-site shoot planning, approvals, distribution, and reporting, and helped plan the travel, logistics, and production that made each activation possible.',
  };
  if (/cmx__kicker/.test(ctx) || /\bThe program\b/.test(textOf(norm(ctx))) || 'kicker' in (cmData.context || {})) failures.push('[creator] V1.2: the program context has no kicker ("The program" is gone, with nothing in its place)');
  if (spaced(norm((ctx.match(/<h2 id="cm-context-title"[^>]*>([\s\S]*?)<\/h2>/) || [, ''])[1])) !== CTX.headline || cmOne(ctx, /<span class="cmx__accent"[^>]*>([\s\S]*?)<\/span>/) !== CTX.accent || cmData.context?.headline !== CTX.headline) failures.push(`[creator] the program context reads "${CTX.headline}", "${CTX.accent}" in the accent (V1.2)`);
  if (cmOne(ctx, /<p class="cmx__copy"[^>]*>([\s\S]*?)<\/p>/) !== CTX.copy || cmData.context?.copy !== CTX.copy) failures.push('[creator] the program context carries the V1.2 paragraph, word for word');
  // V1.3: beneath the paragraph, one supporting line on the roster, smaller and quieter (not a second paragraph of
  // equal weight), naming no one: no names, handles, pictures, follower counts, categories or travel histories.
  // (Full Site Iteration V1: the roster line gives no count; the paragraph's one emphasis is John's central claim.)
  const ROSTER_LINE = 'The roster brought together creators across streaming, crypto media, ecosystem leadership, entertainment, and community.';
  if (/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+creators\b/i.test(textOf(norm(ctx)))) failures.push('[creator] the program introduction gives no creator count (Full Site Iteration V1)');
  const ctxCopyHtml = (ctx.match(/<p class="cmx__copy"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1];
  const ctxMarks = [...ctxCopyHtml.matchAll(/<strong class="em-key"[^>]*>([\s\S]*?)<\/strong>/g)].map((m) => textOf(m[1]));
  if (ctxMarks.join(' | ') !== 'I led campaign strategy with co-sponsors' || (ctxCopyHtml.match(/<strong\b/g) || []).length !== 1 || /<(?:b|em|mark|u)[\s>]/.test(ctxCopyHtml) || /<strong\b|<em\b|<mark\b/.test((ctx.match(/<p class="cmx__roster"[\s\S]*?<\/p>/) || [''])[0])) {
    failures.push(`[creator] the program paragraph emphasizes "I led campaign strategy with co-sponsors" and nothing else, the roster line none (found ${ctxMarks.join(' | ') || 'none'})`);
  }
  const ctxWords = cmBlock(ctx, '<div class="cmx__words"');
  if (cmOne(ctx, /<p class="cmx__roster"[^>]*>([\s\S]*?)<\/p>/) !== ROSTER_LINE || cmData.context?.roster !== ROSTER_LINE || !/^<div class="cmx__words"[^>]*>\s*<p class="cmx__copy"[^>]*>[\s\S]*?<\/p>\s*<p class="cmx__roster"[^>]*>[\s\S]*?<\/p>\s*<\/div>$/.test(ctxWords) || /<img\b|<a\b|@/.test(ctxWords)) failures.push(`[creator] V1.3: beneath the program paragraph, one line on the roster, word for word ("${ROSTER_LINE}"), with no names, handles, pictures or links`);
  const rosterRule = cmRules(/^\.cmx__roster$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const copyRule = cmRules(/^\.cmx__copy$/).filter((r) => !r.at).map((r) => r.body).join(';');
  if (!/font-size:\s*var\(--text-(?:base|sm)\)/.test(rosterRule) || !/font-size:\s*var\(--text-lg\)/.test(copyRule) || !/color:\s*var\(--ink-3\)/.test(rosterRule) || !/color:\s*var\(--ink-2\)/.test(copyRule)) failures.push('[creator] V1.3: the roster line is smaller and quieter than the paragraph it supports');
  if (/<svg\b|cmx__route|data-cmx-route/.test(ctx) || cmRules(/\.cmx__route/).length) failures.push('[creator] V1.2: no drawn route leads out of the program context (the network is no longer a ring)');
  // V1.4 (08): one full-width, centered editorial composition in place of the split headline and paragraph: the
  // headline at the top center in a narrow, balanced measure (12ch to 16ch; this face sets it in three lines at 16ch),
  // the paragraph beneath it at a readable measure (Full Site Iteration V1: 54 to 60rem, at the same type size, so it
  // sets in fewer, longer lines), then a short centered rule (a 1px line no wider than
  // 3rem) and the roster line, smaller and quieter; no card, pill, badge or box, and no two-column grid at any width.
  // On phones (Mobile Optimization V1) all three stay centered, on a slightly wider measure (1rem at the sides). The
  // headline rises first, the paragraph follows with a short upward fade and the roster line comes last, only with
  // motion allowed; nothing in it takes focus.
  const ctxInner = cmRules(/^\.cmx__inner$/);
  const ctxTitle = cmRules(/^\.cmx__title$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const ctxWordsRule = cmRules(/^\.cmx__words$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const ctxTitleCh = Number((ctxTitle.match(/max-width:\s*([\d.]+)ch/) || [])[1]);
  const ctxWordsRem = Number((ctxWordsRule.match(/max-width:\s*([\d.]+)rem/) || [])[1]);
  const ctxRuleLine = cmRules(/^\.cmx__roster::?before$/).map((r) => r.body).join(';');
  const ctxPhone = (re) => cmRules(re).filter((r) => /max-width:\s*39\.99rem|width\s*<=\s*39\.99rem/.test(r.at)).map((r) => r.body).join(';');
  if (!ctxInner.some((r) => !r.at && /display:\s*grid/.test(r.body) && /justify-items:\s*center/.test(r.body) && /text-align:\s*center/.test(r.body)) || ctxInner.some((r) => /grid-template-columns|grid-template-areas/.test(r.body)) || cmRules(/^\.cmx__(?:title|words|copy|roster)$/).some((r) => /grid-column|grid-area/.test(r.body))) failures.push('[creator] V1.4: the program introduction is one centered composition, not a split layout, at every width');
  if (!(ctxTitleCh >= 12 && ctxTitleCh <= 16) || !/text-wrap:\s*balance/.test(ctxTitle) || !/margin:\s*0 auto/.test(ctxTitle) || !(ctxWordsRem >= 54 && ctxWordsRem <= 60)) failures.push(`[creator] V1.4: the headline sits at the top center in a narrow, balanced measure (12ch to 16ch, found ${ctxTitleCh}ch) and the paragraph beneath it at a wider one (Full Site Iteration V1: 54 to 60rem, found ${ctxWordsRem}rem)`);
  if (!/content:\s*(?:''|"")/.test(ctxRuleLine) || !/height:\s*1px/.test(ctxRuleLine) || !(Number((ctxRuleLine.match(/width:\s*([\d.]+)rem/) || [])[1]) <= 3) || !/background:\s*var\(--line(?:-strong)?\)/.test(ctxRuleLine) || cmRules(/^\.cmx(?:__inner|__words|__copy|__roster)?$/).some((r) => /box-shadow|border(?:-[\w-]+)?\s*:|border-radius|outline|background-color/.test(r.body) || (/background:/.test(r.body) && !/background:\s*var\(--bg\)/.test(r.body)))) failures.push('[creator] V1.4: a short centered rule sets the roster line apart, with no card, pill, badge or box');
  if (cmRules(/^\.cmx(?:__inner|__title|__words|__copy|__roster)$/).some((r) => /text-align:\s*(?:left|start)|justify-items:\s*(?:start|left)/.test(r.body)) || !/padding-inline:\s*1rem/.test(ctxPhone(/^\.cmx__inner$/))) failures.push('[mobile] on phones the campaign introduction stays centered, headline, paragraph and roster line alike, on a slightly wider measure (1rem at the sides)');
  // Mobile Optimization V1: on phones the hero's label and paragraph are centered under the centered headline (they
  // set left before), the paragraph at a readable measure held in from the gutters, in balanced lines; a hyphenated
  // compound never splits across two centered lines, and "I" never ends one.
  const cmPhone = (re) => cmRules(re).filter((r) => /max-width:\s*47\.99rem|width\s*<=\s*47\.99rem/.test(r.at)).map((r) => r.body).join(';');
  if (cmRules(/^\.cmh__(?:foot|label|copy)$/).some((r) => /text-align:\s*(?:left|start)|justify-items:\s*(?:start|left)/.test(r.body)) || !/max-width:\s*min\(22rem,\s*100%\s*-\s*1\.25rem\)/.test(cmPhone(/^\.cmh__copy$/)) || !/text-wrap:\s*balance/.test(cmPhone(/^\.cmh__copy$/))) failures.push('[mobile] on phones the creator hero\'s label and paragraph are centered, the paragraph a readable measure in from the gutters, in balanced lines');
  const cmCompounds = [...cmPage.matchAll(/<span class="(cmh|cmx)__compound"[^>]*>([^<]+)<\/span>/g)].map((m) => `${m[1]}:${m[2]}`);
  if (JSON.stringify(cmCompounds) !== JSON.stringify(['cmh:on-site', 'cmx:co-sponsors', 'cmx:on-site']) || !/white-space:\s*nowrap/.test(cmPhone(/^\.cmh__compound$/)) || !/white-space:\s*nowrap/.test(ctxPhone(/^\.cmx__compound$/))) failures.push(`[mobile] on phones no hyphenated compound splits across two centered lines (found ${cmCompounds.join(', ') || 'none'})`);
  if (!/<strong class="em-key"[^>]*>I(?:\u00a0|&nbsp;|&#160;)led campaign strategy with /.test(ctx)) failures.push('[mobile] "I" never ends a line of the centered campaign introduction (a no-break space binds it to "led")');
  const revealDelay = (re) => Number((cmRules(re).filter((r) => MOTION_OK.test(r.at)).map((r) => r.body).join(';').match(/transition:\s*opacity\s+[\d.]+m?s\s+(?:(?:ease(?:-in|-out|-in-out)?|linear)\s+)?([\d.]+)s/) || [])[1]);
  const copyDelay = revealDelay(/^html\.js \.cmx__copy$/);
  const rosterDelay = revealDelay(/^html\.js \.cmx__roster$/);
  if (!(copyDelay > 0 && rosterDelay > copyDelay) || !/<h2 id="cm-context-title"[^>]*data-cm-reveal/.test(ctx) || !/<p class="cmx__copy"[^>]*data-cm-reveal/.test(ctx) || !/<p class="cmx__roster"[^>]*data-cm-reveal/.test(ctx) || !CSS_RULES.some((r) => MOTION_OK.test(r.at) && /:is\(\.cmx__copy,\s*\.cmx__roster\):not\(\.is-in\)/.test(bare(r.sel)) && /opacity:\s*0/.test(r.body) && /translate/.test(r.body))) failures.push(`[creator] V1.4: the headline rises first, the paragraph follows with a short upward fade, the roster line last, only with motion allowed (delays ${copyDelay} s and ${rosterDelay} s)`);
  if (/<(?:a|button|input|select|textarea)\b|tabindex=/.test(ctx)) failures.push('[creator] V1.4: the program introduction is not interactive');
  // John's collaborators (V1.2): named only in the credits, there exactly; never "Manav", "Porwal" alone, or a capitalized "Van Der".
  for (const [re, want] of [[/\bMa+nav\b[^.,;]*?\b\w+/g, /^Maanav Porwal\b/], [/\bBob\s+\w+(?:\s+\w+){0,2}/g, /^Bob van der Meer\b/]]) {
    for (const m of cmSpaced.matchAll(re)) if (!want.test(m[0])) failures.push(`[creator] collaborators are named exactly ("Maanav Porwal", "Bob van der Meer"): found "${m[0]}"`);
  }
  if (/(?<!Maanav )\bPorwal\b|(?<!Bob )\bvan der Meer\b|Van Der Meer|Van der Meer|\bManav\b/.test(cmSpaced)) failures.push('[creator] collaborators are named in full and spelled exactly: Maanav Porwal, Bob van der Meer');
  const creditsAt = cmNoCode.indexOf('<section class="cmc"');
  const creditsHtml = cmSec('cmc');
  const rawOutsideCredits = creditsAt < 0 ? cmNoCode : cmNoCode.slice(0, creditsAt) + cmNoCode.slice(creditsAt + creditsHtml.length);
  const outsideCredits = spaced(norm(rawOutsideCredits));
  // (the words and every attribute: descriptions, labels and the page's metadata)
  const namedOutside = outsideCredits.match(/\bMa+nav\b|\bPorwal\b|\bBob\b|\bvan der Meer\b/i) || decode(rawOutsideCredits).match(/\bMa+nav\b|\bPorwal\b|\bBob van der Meer\b/i);
  if (namedOutside) failures.push(`[creator] V1.2: the collaborators are named only in the credits ("${namedOutside[0]}" appears elsewhere on the page)`);
  if (!/\bMaanav Porwal\b/.test(spaced(norm(creditsHtml))) || !/\bBob van der Meer\b/.test(spaced(norm(creditsHtml)))) failures.push('[creator] the credits name Maanav Porwal and Bob van der Meer');
  for (const key of ['hero', 'context', 'atlas', 'trezor', 'library', 'ownership', 'conclusion']) {
    if (/Maanav|Porwal|Bob van der Meer|\bBob\b/.test(JSON.stringify(cmData[key] || {}).replace(/"_\w+":\s*"(?:[^"\\]|\\.)*"/g, ''))) failures.push(`[creator] V1.2: creator.json names no collaborator in ${key} (they belong to the credits)`);
  }

  // ---- 07 The creator network (V1.3): gone, with nothing in its place (no carousel, grid, logo wall, marquee or
  // roster). V1.4: the eight creators appear only in the credits, by their public X handles and nothing else (checked
  // there): no names, employers, partnerships, affiliations, descriptors, follower counts or travel histories anywhere
  // on the page; their portraits stay in the repository but the page never asks for them. (The affiliations below are
  // the V1.3 roll's, kept here only so the check can prove none of them is left.)
  const ROSTER = [
    ['eva', 'Eva', '@evaedxn', ['Rainbet', 'Kick and Twitch streamer']],
    ['the-blonde-broker', 'The Blonde Broker', '@theblondebroker', ['VP of Financial Services at Corgi', 'Host of The Market Runup', 'Not Your Average Bros']],
    ['ashley', 'Ashley', '@AshleyDCan', ['Founder of Daily X News', 'Rainbet partner', 'AVAX Team 1 collaborator', 'Not Your Average Bros']],
    ['shiv', 'Shiv', '@shivst3r', ['Pudgy Penguins advisor', 'Bing Bong host']],
    ['raj', 'Raj', '@RajPatel', ['Head of Ecosystem at Abstract']],
    ['arcanic', 'Arcanic', '@Arcanic', ['Versus FNF team', 'Pump.fun partner']],
    ['caleb', 'Caleb', '@calebrebelo_', ['Sport.fun']],
    ['simon', 'Simon', '@simonrez_', ['Growth contributor at Pump.fun']],
  ];
  // The trips' creator counts, as the V1.0 roster counted them (the destinations are not shown on the creators).
  const perPlace = { 'costa-rica': 6, singapore: 7, mykonos: 4 };
  if ('network' in cmData) failures.push('[creator] V1.3: creator.json keeps no creator network (its words, its creators and their handles are gone; the credits carry the roster)');
  if (fs.existsSync(path.join(root, 'src/components/creator/CmNetwork.astro')) || /<section class="cmn"|data-cm-network|data-cmn-|\bcmn__/.test(cmPage) || CSS_RULES.some((r) => /\.cmn(?:__|\[|\s|\.|:|$)/.test(r.sel))) failures.push('[creator] V1.3: no creator network is left: no section, component, markup or styles');
  const pageAstro = fs.readFileSync(path.join(root, 'src/pages/work/creator-campaigns.astro'), 'utf8');
  if (/mountNetwork|STEP_SECONDS|S_MIN|EXIT_GONE|data-cmn|cm-network|keyFocused|setPointerCapture|pointerleave/.test(cmSource) || /data-cm-network|data-cmn-/.test(cmScripts) || /mountNetwork|CmNetwork/.test(pageAstro)) failures.push('[creator] V1.3: the network\'s script is gone: nothing initializes it, and no listener of its portrait field is left');
  if (/Creator network|The creators who made it travel|Select a creator for details|Eight creators spanning/i.test(cmSpaced) || /Creator network|made it travel|Select a creator/i.test(decode(cmNoCode))) failures.push('[creator] V1.3: none of the network\'s words remain (its kicker, headline, line or instruction)');
  for (const [, , handle] of ROSTER) {
    const onPage = decode(cmPage).split(handle).length - 1;
    const inCredits = decode(cmSec('cmc')).split(handle).length - 1;
    if (onPage !== 1 || inCredits !== 1) failures.push(`[creator] V1.4: each creator's public X handle appears once on the page, in the credits (${handle}: ${onPage} on the page, ${inCredits} in the credits)`);
  }
  const pfpRe = new RegExp(`/(?:${ROSTER.map(([id]) => id).join('|')})\\.[\\w-]+\\.(?:jpe?g|png|webp|avif)`, 'i');
  if (pfpRe.test(cmPage)) failures.push(`[creator] V1.3: the page never requests or preloads a creator's portrait (found ${cmPage.match(pfpRe)[0]})`);
  for (const [id, name] of ROSTER) {
    const a = cmAsset(`cm-creator-${id}`);
    if (a.permission !== 'approved' || !a.file || !fs.existsSync(path.join(root, 'src/assets', a.file)) || !/Not on the page since V1\.3/.test(a.source || '')) failures.push(`[creator] ${name}: the profile picture stays in the repository as John's file, recorded as no longer on the page (V1.3)`);
  }
  // V1.4: the creators' names and the V1.3 affiliations appear nowhere in the page's words, the credits included (the
  // descriptions of the footage may still say who is in a shot), and creator.json keeps none of them.
  const affOnPage = ROSTER.flatMap(([, , , affs]) => affs).find((x) => cmSpaced.includes(x) || decode(cmNoCode).includes(x));
  // (the handles set aside first: "@Arcanic" is a handle, not a name)
  const nameOnPage = ROSTER.reduce((t, [, , h]) => t.split(h).join(' '), cmSpaced).match(new RegExp(`\\b(?:${ROSTER.map(([, n]) => n).join('|')})\\b`));
  const cmJsonWords = JSON.stringify(cmData).replace(/"_\w+":\s*"(?:[^"\\]|\\.)*"/g, '');
  const affInData = ROSTER.flatMap(([, , , affs]) => affs).find((x) => cmJsonWords.includes(x));
  if (affOnPage || nameOnPage || affInData) failures.push(`[creator] V1.4: no creator's name, employer, partnership or affiliation is left on the page or in creator.json, the credits included ("${affOnPage || (nameOnPage && nameOnPage[0]) || affInData}")`);
  // Nothing that takes focus sits inside a part of the page hidden from assistive technology.
  for (const tag of ['div', 'span', 'p', 'figure', 'ul', 'li', 'section']) {
    for (const m of cmNoCode.matchAll(new RegExp(`<${tag}\\b[^>]*aria-hidden="true"[^>]*>`, 'g'))) {
      const hiddenBlock = cmBlock(cmNoCode, m[0], m.index);
      if (/<(?:button|a|input|select|textarea)\b|tabindex="0"/.test(hiddenBlock.slice(m[0].length))) failures.push(`[creator] a focusable control sits inside a part hidden from assistive technology (${m[0].slice(0, 70)})`);
    }
  }
  // The qualifiers the brief rules out, anywhere on the page (V1.4: with the affiliations gone, none may come back).
  const qualifier = cmSpaced.match(/user[- ]reported|self[- ]described|self[- ]reported|\binferred\b|\bapparent(?:ly)?\b|\bunverified\b|\breportedly\b|\ballegedly\b|claims? to be|said to be/i);
  if (qualifier) failures.push(`[creator] the affiliations are John's confirmed ones, stated plainly: no "${qualifier[0]}"`);
  if (/\bfollowers?\b|\bsubscribers?\b/i.test(cmSpaced)) failures.push('[creator] no follower or subscriber counts on the page');

  // ---- 08 Testimonials (V1.2): gone, with their placeholder data, until a complete approved set exists; the only
  // quotation on the page is Trezor's feedback, with its campaign.
  if ('voices' in cmData || fs.existsSync(path.join(root, 'src/components/creator/CmVoices.astro')) || cmAssets.some((a) => /^cm-testimonial-/.test(a.id))) failures.push('[creator] V1.2: no testimonial section, component or placeholder entries are left (creator.json voices, CmVoices.astro, cm-testimonial-*)');
  if ((cmNoCode.match(/<blockquote\b/g) || []).length !== 1 || !/<figure class="cmz__quote"[^>]*>\s*<blockquote/.test(cmNoCode)) failures.push('[creator] the only quotation on the page is Trezor\'s feedback, with its campaign');

  // ---- 09 The campaign atlas: one stage, three destinations
  const ATLAS = [
    { key: 'costa-rica', num: '01', type: 'Creator retreat', coords: '10.4° N, 85.8° W', copy: 'A creator house on the Pacific coast where shared moments became destination content, creator-led integrations, and bespoke campaigns produced for co-sponsors.', pieces: '40+', sponsors: ['Trezor', 'Bitrefill'], frags: ['cm-frag-costa-rica-villa', 'cm-frag-costa-rica-table'] },
    // (Full Site Iteration V1: John's Singapore line, the activation across the city, never a retail brand.)
    { key: 'singapore', num: '02', type: 'Conference activation', coords: '1.3° N, 103.8° E', copy: 'A city-wide conference activation spanning a crypto game show on a party bus, high tea above Singapore, and a creator shopping experience through the city.', pieces: '35+', sponsors: ['Rayls Labs'], frags: ['cm-frag-singapore-dinner', 'cm-frag-singapore-high-tea'] },
    { key: 'mykonos', num: '03', type: 'Creator retreat', coords: '37.4° N, 25.3° E', copy: 'A villa above the Aegean, a day on a catamaran, and long dinners into the evening, with four creators turning each moment into content.', pieces: '25+', sponsors: ['Phi Labs'], frags: ['cm-frag-mykonos-podcast', 'cm-frag-mykonos-terrace'] },
  ];
  const atlas = cmSec('cma');
  if (!/data-surface="dark"/.test(openTag(atlas)) || !/data-cm-atlas/.test(openTag(atlas)) || cmOne(atlas, /<h2 id="cm-atlas-title"[^>]*>([\s\S]*?)<\/h2>/) !== 'Campaign atlas') failures.push('[creator] the atlas is one dark stage, titled "Campaign atlas"');
  // V1.2: the small "CAMPAIGN ATLAS" kicker is gone from view, with nothing in its place; the heading names the
  // section for assistive technology only, and the index keeps its place at the right of the bar.
  if (!/<h2 id="cm-atlas-title" class="sr-only"[\s>]/.test(atlas) || /cma__kicker/.test(atlas) || cmRules(/\.cma__kicker/).length || 'kicker' in (cmData.atlas || {}) || 'title' in (cmData.atlas || {}) || cmData.atlas?.heading !== 'Campaign atlas') failures.push('[creator] V1.2: the atlas has no visible kicker and nothing in its place; its heading is for assistive technology only (creator.json atlas.heading)');
  if (!cmRules(/^\.cma__bar$/).some((r) => /justify-content:\s*flex-end/.test(r.body))) failures.push('[creator] V1.2: with the kicker gone, the destination index keeps its place at the right of the bar');
  const goes = [...atlas.matchAll(/<a href="#cm-place-([\w-]+)" class="cma__go" data-cma-go="(\d)"([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => [m[1], m[2], /aria-current="true"/.test(m[3]), textOf(m[4])]);
  // (none is marked current in the page: on the pinned stage the script marks the one on view)
  if (!/<nav class="cma__index" aria-label="Destinations"/.test(atlas) || JSON.stringify(goes) !== JSON.stringify(ATLAS.map((d, i) => [d.key, String(i), false, `${d.num}${PLACES[d.key]}`]))) failures.push(`[creator] the atlas index names the three destinations in order, none marked current until the stage is pinned (found ${goes.map((g) => `${g[3]}${g[2] ? ' (current)' : ''}`).join(', ')})`);
  const chapters = cmBlocks(atlas, '<article class="cma__chapter"');
  if (chapters.length !== 3) failures.push(`[creator] the atlas holds three destinations (found ${chapters.length})`);
  const dataDest = cmData.atlas?.destinations || [];
  ATLAS.forEach((d, i) => {
    const ch = chapters[i] || '';
    const name = PLACES[d.key];
    const src = dataDest[i] || {};
    const loopAsset = cmAsset(src.loop);
    if (!new RegExp(`^<article class="cma__chapter" id="cm-place-${d.key}" data-cma-chapter="${i}" data-place="${d.key}" data-state="${i === 0 ? 'active' : 'after'}" aria-labelledby="cm-place-${d.key}-name"`).test(ch)) failures.push(`[creator] destination ${d.num} is ${name}, in order, named by its heading`);
    const meta = [...((ch.match(/<p class="cma__meta"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1]).matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/g)].map((m) => textOf(m[1]));
    if (JSON.stringify(meta) !== JSON.stringify([d.num, d.type, d.coords])) failures.push(`[creator] ${name}: ${d.num}, ${d.type}, ${d.coords} (found ${meta.join(', ')})`);
    if (cmOne(ch, /<h3 id="cm-place-[\w-]+-name"[^>]*>([\s\S]*?)<\/h3>/) !== name || cmOne(ch, /<p class="cma__copy"[^>]*>([\s\S]*?)<\/p>/) !== norm(d.copy)) failures.push(`[creator] ${name}: the destination's name and its approved copy`);
    const facts = [...ch.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => [textOf(m[1]), m[2]]);
    const want = [['Creators', String(perPlace[d.key])], ['Content pieces', d.pieces]];
    if (JSON.stringify(facts.slice(0, 2).map(([k, v]) => [k, textOf(v)])) !== JSON.stringify(want) || String(src.creators) !== want[0][1] || String(src.pieces) !== d.pieces) failures.push(`[creator] ${name}: ${want.map((w) => `${w[0]} ${w[1]}`).join(', ')}, as John gave them`);
    const sponsorRow = facts.find(([k]) => k === 'Co-sponsors');
    const logos = sponsorRow ? [...sponsorRow[1].matchAll(/<img\b[^>]*alt="([^"]+)"/g)].map((m) => m[1]) : [];
    if (JSON.stringify(logos) !== JSON.stringify(d.sponsors)) failures.push(`[creator] ${name}: the co-sponsors ${d.sponsors.join(' and ')} (found ${logos.join(', ') || 'none'})`);
    // The loop: silent, inline, on its poster, loading nothing early, with its own pause control.
    const main = cmBlock(ch, '<div class="cma__main"');
    const v = (main.match(/<video\b[^>]*>/) || [''])[0];
    if (!new RegExp(`data-ev-loop[^>]*data-label="${name} loop"`).test(openTag(main)) || !/\bmuted\b/.test(v) || !/\bloop\b/.test(v) || !/\bplaysinline\b/.test(v) || !/preload="none"/.test(v) || !/\bposter="/.test(v) || /\b(?:autoplay|controls)\b/.test(v) || !/aria-label="[^"]{40,}"/.test(v) || !loopAsset.file || !main.includes(`<source src="${BASE}/media/${loopAsset.file}" type="video/mp4"`) || !new RegExp(`<button type="button" class="cma__toggle" data-ev-loop-toggle aria-label="Play: ${name} loop" hidden`).test(main)) failures.push(`[creator] ${name}: one silent loop, muted, looped, inline, on its poster, described, loading nothing early, with its own pause control`);
    const lf = path.join(root, 'public/media', loopAsset.file || 'missing');
    if (fs.existsSync(lf)) {
      const fx = mp4Facts(lf);
      const sec = mp4Seconds(lf);
      const mb = fs.statSync(lf).size / 1048576;
      if (!fx.avc || fx.handlers.includes('soun') || fx.top.indexOf('moov') > fx.top.indexOf('mdat') || !(fx.width > fx.height) || Math.abs(fx.width / fx.height - 16 / 9) > 0.01 || !(sec >= 5 && sec <= 10) || Math.abs(sec - (loopAsset.duration || 0)) > 0.05 || mb > 4) failures.push(`[creator] ${name}: the loop is silent H.264, index first, landscape 16:9, 5 to 10 seconds, under 4 MB (found ${fx.width}x${fx.height}, ${sec.toFixed(2)} s, ${mb.toFixed(2)} MB${fx.handlers.includes('soun') ? ', with sound' : ''})`);
    } else failures.push(`[creator] ${name}: public/media/${path.basename(lf)} is missing`);
    // Two landscape fragments, described, loaded when near: V1.1 replaced the party-bus still with the microphone (Singapore) and the catamaran (Mykonos, now the podcast recording).
    if (JSON.stringify(src.fragments) !== JSON.stringify(d.frags)) failures.push(`[creator] ${name}: the fragments are ${d.frags.join(' and ')} (found ${(src.fragments || []).join(', ')})`);
    const frags = cmBlocks(ch, '<figure class="cma__frag');
    const fragImgs = frags.map((f) => (f.match(/<img\b[^>]*>/) || [''])[0]);
    if (frags.length !== 2 || fragImgs.some((im) => !/\salt="[^"]{12,}"/.test(im) || !/loading="lazy"/.test(im) || !(Number((im.match(/\swidth="(\d+)"/) || [])[1]) > Number((im.match(/\sheight="(\d+)"/) || [])[1])))) failures.push(`[creator] ${name}: two landscape fragments beside the loop, each described, loaded when near`);
  });
  for (const gone of ['cm-frag-singapore-bus', 'cm-frag-mykonos-catamaran']) {
    if (cmAssets.some((a) => a.id === gone) || JSON.stringify(cmData).includes(gone)) failures.push(`[creator] V1.1 retired the ${gone} still`);
  }
  for (const f of ['creator-campaigns/atlas/cm-singapore-bus.jpg', 'creator-campaigns/atlas/cm-mykonos-catamaran.jpg']) if (fs.existsSync(path.join(root, 'src/assets', f))) failures.push(`[creator] V1.1 retired src/assets/${f}`);
  const podcast = cmAsset('cm-frag-mykonos-podcast');
  if (!/^Creator Videos\/Podcast Still\.jpeg/.test(podcast.source || '') || !/Max and Caleb/.test(podcast.alt || '')) failures.push('[creator] the Mykonos fragment is the Lock In Podcast recording with Max and Caleb, from Podcast Still.jpeg');
  // The large names never clip (V1.1): sized against their column, so the longest fits whole, and on the pinned
  // stage the box that hides them as they slide keeps room for the descenders (the behavior run measures the glyphs).
  if (!cmRules(/^\.cma__words$/).some((r) => /container-type:\s*inline-size/.test(r.body)) || !cmRules(/^\.cma__name$/).some((r) => /font-size:\s*min\([^;]*\b(?:2[0-3](?:\.\d+)?)cqi\)/.test(r.body))) failures.push('[creator] the destination names are sized against their column (cqi), so Singapore and Costa Rica fit whole at every width');
  const pinName = cmRules(/^\.cma\.is-pinned \.cma__name$/).map((r) => r.body).join(';');
  const padB = Number((pinName.match(/padding-bottom:\s*([\d.]+)em/) || [])[1]);
  if (!/overflow:\s*hidden/.test(pinName) || !(padB >= 0.14) || !/margin-bottom:\s*-[\d.]+em/.test(pinName) || !/padding-inline-end:\s*[\d.]+em/.test(pinName) || !cmRules(/\.cma\.is-pinned \.cma__chapter\[data-state=["']?after["']?\] \.cma__name-in$/).some((r) => /translate(?:3d)?Y?\((?:0,\s*)?12\d%/.test(r.body))) failures.push(`[creator] on the pinned stage a name's sliding box keeps room below the line for its descenders (at least 0.14em; found ${padB || 'none'}) and past its last letter, and a name set aside moves a whole box away`);
  // The co-sponsors' marks: one light silhouette on the dark ground (Phi Labs' artwork is black).
  if (!cmRules(/\.cma__sponsors \.cma__logo$/).some((r) => /filter:\s*brightness\(0\)\s*invert\(1?\)/.test(r.body))) failures.push('[creator] the co-sponsor marks read as one light silhouette on the atlas\'s dark ground');
  // The stage pins only on wide, tall enough screens with motion allowed; otherwise (and without JavaScript) the three read in turn.
  const atlasSrc = fnOf('mountAtlas');
  if (!/const canPin = \(\) => !reduced\(\) && window\.innerWidth >= 960 && window\.innerHeight >= 600;/.test(atlasSrc)) failures.push('[creator] the atlas pins only at 960 by 600 pixels and more, with motion allowed');
  if (!/window\.addEventListener\('scroll', schedule, \{ passive: true \}\)/.test(atlasSrc) || /'wheel'|touchmove|scroll-snap/.test(atlasSrc) || /scroll-snap/.test(cmRules(/\.cma/).map((r) => r.body).join(';'))) failures.push('[creator] the pinned stage follows the reader\'s own scrolling: one passive listener, no wheel hijack, no snapping');
  for (const token of ['[data-cma-runway]', '[data-cma-chapter]', '[data-cma-go]', "toggle('is-pinned', pinned)", '--chapter-progress', "setAttribute('data-loop-off', '')", "new Event('ev:loop-sync')"]) {
    if (!atlasSrc.includes(token)) failures.push(`[creator] the atlas's script is missing ${token}`);
  }
  const hiding = cmRules(/\.cma__(?:chapter|frag|meta|copy|facts)\b/).filter((r) => /opacity:\s*0(?![.\d])|visibility:\s*hidden/.test(r.body));
  if (!hiding.length || hiding.some((r) => !/\.cma\.is-pinned/.test(bare(r.sel)))) failures.push('[creator] a destination is set aside only on the pinned stage; unpinned, all three read in turn');
  if (!cmRules(/^\.cma\.is-pinned \.cma__runway$/).some((r) => /height:\s*calc\(var\(--view-h\)\s*\*\s*3\.\d+\)/.test(r.body))) failures.push('[creator] the pinned stage has a runway of a little over a screen per destination');

  // ---- 10 The Trezor Dare Ad: the film first, then the creator-account highlights (V1.1)
  const tz = cmSec('cmz');
  const TZ = {
    kicker: 'Featured campaign',
    title: 'Trezor Dare Ad',
    deck: 'A creator-led sponsor integration for Trezor, filmed at the creator house in Costa Rica.',
    quote: 'Overall, the campaign felt very aligned with what we were hoping to achieve. What stood out most was the level of care and creativity, the production quality, the attention to detail, and how involved everyone was in understanding our goals.',
    by: 'Trezor campaign feedback',
  };
  if (!/data-surface="light-return"/.test(openTag(tz)) || cmOne(tz, /<p class="cmz__kicker"[^>]*>([\s\S]*?)<\/p>/) !== TZ.kicker || cmOne(tz, /<h2 id="cm-trezor-title"[^>]*>([\s\S]*?)<\/h2>/) !== TZ.title || cmOne(tz, /<p class="cmz__deck"[^>]*>([\s\S]*?)<\/p>/) !== TZ.deck) failures.push(`[creator] the Trezor section reads "${TZ.kicker}", "${TZ.title}" and its deck, on the returning light ground`);
  if (cmData.trezor?.title !== TZ.title || cmData.trezor?.filmLabel !== TZ.title || /Trezor dare(?! Ad)/i.test(cmPage) || /Trezor dare(?! Ad)/i.test(JSON.stringify(cmData)) || cmAssets.filter((a) => /^cm-/.test(a.id)).some((a) => /Trezor dare(?! Ad)/i.test(`${a.label} ${a.alt}`))) failures.push('[creator] V1.1 renamed "The Trezor dare" to "Trezor Dare Ad" everywhere (heading, film, data and descriptions)');
  // Trezor is spelled one way.
  const trezors = [...new Set([...cmPage.matchAll(/\b[Tt][Rr][Ee][SsZz]{1,2}[Oo]?[Rr]\w*/g)].map((m) => m[0]))].filter((w) => !['Trezor', 'TREZOR', 'trezor'].includes(w));
  if (trezors.length) failures.push(`[creator] Trezor is spelled correctly everywhere (found ${trezors.join(', ')})`);
  const tzAt = ['data-evp', 'cmz__brief', 'cmz__results', 'cmz__quote'].map((n) => [n, tz.indexOf(n)]);
  if (tzAt.some(([, i]) => i < 0) || tzAt.some(([, i], k) => k && i < tzAt[k - 1][1])) failures.push(`[creator] the Trezor section runs the film first, then the assignment, objective and approach, the highlights and the feedback (found ${tzAt.filter(([, i]) => i >= 0).map((x) => x[0]).join(', ')})`);
  // V1.2: the collaboration block is gone entirely (the credits keep that record), and the section resolves on the quotation.
  if (/cmz__credits|>\s*Collaboration\s*</.test(tz) || 'credits' in (cmData.trezor || {}) || 'creditsLabel' in (cmData.trezor || {}) || cmRules(/\.cmz__credits?\b/).length) failures.push('[creator] V1.2: the Trezor section has no collaboration block, in the page, the data or the styles');
  if (tz.indexOf('</figure>', tz.indexOf('cmz__quote')) < 0 || textOf(norm(tz.slice(tz.indexOf('</figure>', tz.indexOf('cmz__quote'))))) !== '') failures.push('[creator] V1.2: the Trezor section ends on the quotation');
  const cmzPad = cmRules(/^\.cmz$/).map((r) => r.body).join(';');
  if (!/padding-block:\s*var\(--section-y\)\s+calc\(var\(--section-y\)\s*\*\s*\.5\)/.test(cmzPad)) failures.push('[creator] V1.2: with the collaboration block gone the section closes a little sooner (half the usual space below the quotation)');
  const film = cmBlock(tz, '<figure class="cmf"');
  const fv = (film.match(/<video\b[^>]*>/) || [''])[0];
  const filmAsset = cmAsset(cmData.trezor?.film);
  const filmLen = clock(filmAsset.duration || 0);
  if (!/data-evp id="cm-trezor-film" data-label="Trezor Dare Ad"/.test(film) || !/\bcontrols\b/.test(fv) || /\b(?:autoplay|muted|loop)\b/.test(fv) || !/preload="none"/.test(fv) || !/\bplaysinline\b/.test(fv) || !/\bposter="/.test(fv) || !/aria-label="Trezor Dare Ad: [^"]{40,}"/.test(fv)) failures.push('[creator] the Trezor Dare Ad film is a player with sound: its own controls until the script takes over, nothing loaded early, on its poster, described');
  const sources = [...film.matchAll(/<source src="([^"]+)" type="video\/mp4"([^>]*)>/g)].map((m) => [m[1], (m[2].match(/media="([^"]+)"/) || [])[1] || '']);
  if (JSON.stringify(sources) !== JSON.stringify([[`${BASE}/media/${filmAsset.fileSmall}`, '(max-width: 47.99rem)'], [`${BASE}/media/${filmAsset.file}`, '']])) failures.push(`[creator] the Trezor film offers phones a smaller file first, then the full one (found ${sources.map((x) => x.join(' ')).join(', ')})`);
  if (cmOne(film, /<span class="cmf__start-label"[^>]*>([\s\S]*?)<\/span>/) !== 'Play with sound' || cmOne(film, /<span class="cmf__len"[^>]*>([\s\S]*?)<\/span>/) !== filmLen || !new RegExp(`<input class="cmf__seek" type="range" min="0" max="${Math.floor(filmAsset.duration || 0)}"`).test(film) || !/role="group" aria-label="Video controls: Trezor Dare Ad"/.test(film) || !/data-evp-play aria-label="[^"]+"/.test(film) || !/data-evp-mute aria-label="[^"]+"/.test(film)) failures.push(`[creator] the Trezor film starts from "Play with sound" with its length (${filmLen}), then a labeled bar: play, seek, time and sound`);
  for (const [file, h, maxMb] of [[filmAsset.file, 1080, 20], [filmAsset.fileSmall, 720, 10.5]]) {
    const ff = path.join(root, 'public/media', file || 'missing');
    if (!file || !fs.existsSync(ff)) {
      failures.push(`[creator] the Trezor film file ${file} is missing`);
      continue;
    }
    const fx = mp4Facts(ff);
    const mb = fs.statSync(ff).size / 1048576;
    if (!fx.avc || !fx.handlers.includes('soun') || fx.top.indexOf('moov') > fx.top.indexOf('mdat') || fx.height !== h || Math.abs(fx.width / fx.height - 16 / 9) > 0.01 || Math.abs(mp4Seconds(ff) - filmAsset.duration) > 0.1 || mb > maxMb) failures.push(`[creator] ${file}: H.264 with its sound, index first, landscape 16:9 at ${h} lines, ${filmAsset.duration} seconds, under ${maxMb} MB (found ${fx.width}x${fx.height}, ${mb.toFixed(1)} MB)`);
  }
  // The assignment, the objective and the approach (V1.2), John's words, word for word.
  const brief = cmBlock(tz, '<dl class="cmz__brief"');
  const BRIEF = [
    ['Assignment', "Create a creator-led campaign that places Trezor's new device inside a culturally relevant, community-driven moment rather than a conventional product demonstration."],
    ['Objective', "Build affinity with crypto culture and community while highlighting the device's Bluetooth connectivity and refined, modern design."],
    ['Approach', 'Turn the product into the center of a playful dare filmed with creators at the Costa Rica house, using a real social setting to demonstrate wireless use, showcase the device\'s design, and make the integration feel native rather than ad-like.'],
  ];
  const shownBrief = [...brief.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => [textOf(m[1]), textOf(norm(m[2]))]);
  if (JSON.stringify(shownBrief) !== JSON.stringify(BRIEF.map(([l, t]) => [l, norm(t)])) || JSON.stringify((cmData.trezor?.brief || []).map((b) => [b.label, b.text])) !== JSON.stringify(BRIEF)) failures.push(`[creator] V1.2: the Trezor section states the assignment, the objective and the approach, word for word (found ${shownBrief.map((b) => b[0]).join(', ') || 'none'})`);
  // The three performance highlights (V1.1): the post's results on the creator's account, as a rate, a multiple and a
  // ranking with its percentile; never a raw total, and never presented as Trezor's complete campaign performance.
  // V1.4: measured against the account's preceding posts (V1.1 to V1.3 said three months); the multiple reads
  // "2.2x" (a screen reader hears "2.2 times"); the note is one sentence, the creator-account-results sentence gone.
  // Full Site Iteration V1: the sample is 60 posts everywhere (copy, labels, metadata, accessible text and source
  // notes), and the earlier 56-post sample appears nowhere; the figures themselves are unchanged.
  const HIGHLIGHTS = [
    ['524%', "above the account's average impressions", ''],
    ['2.2x', "the account's average total engagement", ''],
    // V1.2: by reach, never "most-viewed"; the 98th-percentile line kept.
    ['#2', 'by reach out of 60 posts', 'Ranked in the 98th percentile for reach during the sample period.'],
  ];
  // (the data's documentation notes, the keys that begin with "_", may say what is ruled out)
  const cmDataWords = JSON.stringify(cmData).replace(/"_\w+":\s*"(?:[^"\\]|\\.)*"/g, '');
  if (/most[- ]viewed/i.test(cmNoCode) || /most[- ]viewed/i.test(cmDataWords) || cmAssets.filter((a) => /^cm-/.test(a.id)).some((a) => /most[- ]viewed/i.test(JSON.stringify(a)))) failures.push('[creator] V1.2: the ranking is "#2 by reach", never "most-viewed", in the page, the data or the manifest');
  const HL_NOTE = "Measured on the creator's account against its preceding 60 posts.";
  {
    const m56 = /\b56[- ]posts?\b|\b56-post\b|preceding 56\b|out of 56\b/i;
    const where = [];
    if (m56.test(cmPage)) where.push('the page');
    if (m56.test(JSON.stringify(cmData))) where.push('creator.json');
    if (cmAssets.some((a) => m56.test(JSON.stringify(a)))) where.push('the manifest');
    if (m56.test(fs.readFileSync(path.join(root, 'src/components/creator/CmTrezor.astro'), 'utf8'))) where.push('CmTrezor.astro');
    if (where.length) failures.push(`[creator] the 56-post sample appears nowhere since Full Site Iteration V1 (found in ${where.join(', ')})`);
  }
  const results = cmBlock(tz, '<div class="cmz__results"');
  const shownMetrics = cmBlocks(tz, '<li class="cmz__metric');
  // The figure as it is seen (what a screen reader is given instead, in an sr-only span, set aside).
  const valueHtml = (m) => (m.match(/<strong class="cmz__value"[^>]*>([\s\S]*?)<\/strong>/) || [, ''])[1];
  const gotHl = shownMetrics.map((m) => [textOf(norm(valueHtml(m).replace(/<span class="sr-only"[^>]*>[\s\S]*?<\/span>/g, ''))), cmOne(m, /<span class="cmz__metric-label"[^>]*>([\s\S]*?)<\/span>/)]);
  const spokenHl = shownMetrics.map((m) => cmOne(valueHtml(m), /<span class="sr-only"[^>]*>([\s\S]*?)<\/span>/));
  if (JSON.stringify(spokenHl) !== JSON.stringify(['', '2.2 times', '']) || !/^<span aria-hidden="true"[^>]*>2\.2x<\/span><span class="sr-only"[^>]*>2\.2 times<\/span>$/.test(valueHtml(shownMetrics[1] || '').trim())) failures.push(`[creator] V1.4: the multiple reads "2.2x" and a screen reader hears "2.2 times"; the other figures are read as they are (found ${JSON.stringify(spokenHl)})`);
  if (/creator-account results|not Trezor's total campaign performance|preceding three months/.test(cmSpaced) || cmData.trezor?.metricsNote !== HL_NOTE) failures.push(`[creator] the note is one sentence, "${HL_NOTE}", with no creator-account-results sentence`);
  // V1.3: the ranking's percentile reads as a quieter line under the row, so the three columns stay even.
  const hlLines = [...results.matchAll(/<p class="cmz__results-line"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => textOf(norm(m[1])));
  if (JSON.stringify(gotHl) !== JSON.stringify(HIGHLIGHTS.map(([v, l]) => [v, l])) || JSON.stringify(hlLines) !== JSON.stringify(HIGHLIGHTS.map((h) => h[2]).filter(Boolean).map(norm)) || /cmz__metric-note/.test(results)) failures.push(`[creator] the Trezor section shows the three approved highlights, exactly, the percentile under the row (found ${gotHl.map((h) => h.join(' ')).join(' | ')}; ${hlLines.join(' | ')})`);
  const metricIds = cmData.trezor?.metrics || [];
  const hlAssets = metricIds.map((id) => cmAsset(id));
  if (hlAssets.length !== 3 || hlAssets.some((a, k) => a.permission !== 'approved' || a.type !== 'metric' || a.value !== HIGHLIGHTS[k][0] || a.metricLabel !== HIGHLIGHTS[k][1] || (a.metricNote || '') !== HIGHLIGHTS[k][2] || (a.metricSpoken || '') !== (k === 1 ? '2.2 times' : '') || !/measured on the creator's own account against its preceding 60 posts/.test(a.source || '') || !/never a raw total/.test(a.source || ''))) failures.push('[creator] the three highlights are approved metrics in the manifest, each recorded as measured on the creator\'s own account against its preceding 60 posts (Full Site Iteration V1), never a raw total; the multiple spoken as "2.2 times"');
  if (cmOne(results, /<p class="cmz__label"[^>]*>([\s\S]*?)<\/p>/) !== 'Performance highlights' || cmOne(results, /<p class="cmz__results-note"[^>]*>([\s\S]*?)<\/p>/) !== HL_NOTE) failures.push(`[creator] the highlights are labeled "Performance highlights" and framed: "${HL_NOTE}"`);
  // V1.3: the scale and centered composition of the results under the Technical Product Marketing film, in this page's
  // palette and type: the label centered over one balanced row of three equal columns on wide screens (stacked on
  // phones), display-scale figures over short captions, each centered and starting on one line, with generous space
  // and nothing around them (no cards, tiles, pills, shadows, lines or other dashboard chrome); the percentile and the
  // note on what the figures measure follow under the row, quieter.
  const hlRules = cmRules(/\.cmz__(?:metric|metrics|results|results-foot|results-line|results-note|value|metric-label)$/).filter((r) => !/cmz__pending/.test(r.sel)).map((r) => r.body).join(';');
  if (/background|box-shadow|border(?:-[\w-]+)?\s*:|border-radius|outline/.test(hlRules)) failures.push('[creator] V1.3: the highlights stand free: no cards, tiles, pills, shadows, lines or dashboard chrome');
  const resultsRule = cmRules(/^\.cmz__results$/).filter((r) => !r.at).map((r) => r.body).join(';');
  if (!/justify-items:\s*center/.test(resultsRule) || !/text-align:\s*center/.test(resultsRule) || !/margin-block:/.test(resultsRule)) failures.push('[creator] V1.3: the highlights are centered, the label over the row and the lines under it, with room around them');
  if (!cmRules(/^\.cmz__metrics$/).some((r) => /repeat\(3,\s*minmax\(0(?:px)?,\s*1fr\)\)/.test(r.body) && /min-width:\s*48rem|width\s*>=\s*48rem/.test(r.at)) || cmRules(/^\.cmz__metrics$/).some((r) => !r.at && /grid-template-columns/.test(r.body))) failures.push('[creator] V1.3: the three highlights share one row of equal columns on wide screens and stack on phones');
  if (!cmRules(/^\.cmz__metric$/).some((r) => !r.at && /justify-items:\s*center/.test(r.body) && /align-content:\s*start/.test(r.body))) failures.push('[creator] V1.3: each highlight is centered in its column, the figures on one line across the row');
  const tpmValue = (CSS_RULES.find((r) => bare(r.sel).trim() === '.tpm-results__value')?.body.match(/font-size:\s*(clamp\([^;]+?\))(?:;|$)/) || [])[1];
  const cmzValue = (cmRules(/^\.cmz__value$/).filter((r) => !r.at).map((r) => r.body).join(';').match(/font-size:\s*(clamp\([^;]+?\))(?:;|$)/) || [])[1];
  const valueMax = Number(((cmzValue || '').match(/,\s*([\d.]+)rem\)$/) || [])[1]);
  if (!cmzValue || cmzValue !== tpmValue || !(valueMax >= 3.5)) failures.push(`[creator] V1.3: the figures take the display scale of the Technical Product Marketing results (found ${cmzValue || 'none'} against ${tpmValue || 'none'})`);
  const labelRule = cmRules(/^\.cmz__metric-label$/).filter((r) => !r.at).map((r) => r.body).join(';');
  if (!/font-size:\s*var\(--text-(?:base|sm|md)\)/.test(labelRule) || !/max-width:\s*1[4-8]em/.test(labelRule) || !/color:\s*var\(--ink-2\)/.test(labelRule)) failures.push('[creator] V1.3: the captions under the figures are restrained and short');
  // No raw totals anywhere on the page: impressions, views, engagements, likes, comments or reposts as counts.
  const raw = cmSpaced.match(/\b\d[\d,.]*\s*(?:[KkMm]|thousand|million)?\+?\s*(?:total\s+)?(?:impressions|views|engagements?|likes|comments|reposts|retweets|shares)\b/i);
  if (raw) failures.push(`[creator] no raw impression, view, engagement, like, comment or repost totals ("${raw[0]}")`);
  if (/campaign (?:reached|generated|drove|delivered) /i.test(cmSpaced) || /Trezor(?:'s)? (?:total|overall|complete) (?:campaign )?(?:reach|impressions|performance) (?:was|of|reached)/i.test(cmSpaced)) failures.push('[creator] the creator-account highlights are never presented as Trezor\'s complete campaign performance');
  const vague = cmSpaced.match(/\b(?:significant(?:ly)?|massive(?:ly)?|huge|viral|skyrocket\w*|explosive|record[- ]breaking|incredible|exceptional|tons of|countless|thousands of|millions of|dramatic(?:ally)?|outstanding results|impressive results)\b/i);
  if (vague) failures.push(`[creator] no vague metrics or superlatives: "${vague[0]}"`);
  if (cmOne(tz, /<figure class="cmz__quote"[^>]*>\s*<blockquote[^>]*>([\s\S]*?)<\/blockquote>/) !== norm(TZ.quote) || cmOne(tz, /<figure class="cmz__quote"[\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>/) !== TZ.by) failures.push(`[creator] the Trezor section carries the approved feedback, attributed only to "${TZ.by}"`);
  const fb = cmAsset(cmData.trezor?.feedback);
  if (fb.permission !== 'approved' || fb.type !== 'testimonial' || norm(fb.quote || '').trim() !== norm(TZ.quote)) failures.push('[creator] the Trezor feedback is the approved testimonial, word for word');
  // V1.2: four phrases inside the one continuous quotation take the accent, in the quotation's order, each once; the
  // quotation is not broken up (one blockquote, one paragraph, no pull quotes or badges).
  const EMPHASIS = ['level of care and creativity', 'production quality', 'attention to detail', 'understanding our goals'];
  const quoteFig = cmBlock(tz, '<figure class="cmz__quote"');
  const ems = [...quoteFig.matchAll(/<em class="cmz__em"[^>]*style="--e: (\d)"[^>]*>([\s\S]*?)<\/em>/g)].map((m) => [Number(m[1]), textOf(norm(m[2]))]);
  if (JSON.stringify(ems) !== JSON.stringify(EMPHASIS.map((p, i) => [i, p])) || JSON.stringify(cmData.trezor?.emphasis) !== JSON.stringify(EMPHASIS) || (quoteFig.match(/<em\b/g) || []).length !== 4) failures.push(`[creator] V1.2: the quotation emphasizes exactly "${EMPHASIS.join('", "')}", in order (found ${ems.map((e) => e[1]).join(', ') || 'none'})`);
  if ((quoteFig.match(/<blockquote\b/g) || []).length !== 1 || (quoteFig.match(/<p\b/g) || []).length !== 1 || /<(?:strong|b|mark|span)\b/.test(quoteFig.replace(/<figcaption[\s\S]*?<\/figcaption>/, '')) || /cmz__pull|cmz__badge/.test(tz)) failures.push('[creator] V1.2: the quotation stays one continuous passage: one paragraph, no pull quotes, badges or other marks');
  // V1.3: the four phrases are set apart by type alone: the page's deep teal and a slightly heavier weight (one step
  // above the quotation's), the rest of the quotation in its dark ink; no marker, underlay, rectangle, underline,
  // shadow, pill or badge. With motion allowed the teal resolves once as the quotation arrives; nothing pulses, sweeps
  // or repeats; with reduced motion it is simply set.
  const emRules = cmRules(/\.cmz__em$/);
  const emBase = emRules.filter((r) => !r.at && !/:not\(\.is-in\)/.test(r.sel)).map((r) => r.body).join(';');
  const emWeight = Number((emBase.match(/font-weight:\s*(\d+)/) || [])[1]);
  if (!/font-style:\s*normal/.test(emBase) || !/color:\s*var\(--c-teal\)/.test(emBase) || !(emWeight > 700 && emWeight <= 800)) failures.push(`[creator] V1.3: each emphasized phrase takes the deep teal and one step more weight than the quotation (found ${emWeight || 'no weight'}), not italic`);
  if (/background|box-decoration-break|text-decoration|text-shadow|border|outline|box-shadow|padding|border-radius/.test(emRules.map((r) => r.body).join(';'))) failures.push('[creator] V1.3: no marker, underlay, underline, shadow, box, pill or badge on the emphasized phrases');
  if (!cmRules(/^\.cmz__quote p$/).some((r) => !r.at && /color:\s*var\(--heading\)/.test(r.body))) failures.push('[creator] V1.3: the rest of the quotation keeps its dark ink');
  if (emRules.some((r) => /animation/.test(r.body)) || emRules.some((r) => /:not\(\.is-in\)|transition/.test(r.body + bare(r.sel)) && !MOTION_OK.test(r.at)) || !emRules.some((r) => MOTION_OK.test(r.at) && /html\.js/.test(r.sel) && /\.cmz__quote:not\(\.is-in\)/.test(bare(r.sel)) && /^color:\s*inherit$/.test(r.body.trim())) || !emRules.some((r) => MOTION_OK.test(r.at) && /^transition:\s*color\s/.test(r.body.trim()) && !/background|transform|opacity|font-weight|infinite/.test(r.body))) failures.push('[creator] V1.3: the teal resolves once as the quotation arrives, only with motion allowed, and nothing pulses, sweeps or repeats');

  // Full Site Iteration V1 (11): the feedback centered, quotation, phrases and attribution together, at a readable
  // measure with balanced lines; its phrases are still set apart by type alone (above).
  {
    const quoteRule = cmRules(/^\.cmz__quote$/).filter((r) => !r.at).map((r) => r.body).join(';');
    const quoteRem = Number((quoteRule.match(/max-width:\s*([\d.]+)rem/) || [])[1]);
    if (!/text-align:\s*center/.test(quoteRule) || !/justify-self:\s*center/.test(quoteRule) || !(quoteRem >= 44 && quoteRem <= 56) || !cmRules(/^\.cmz__quote p$/).some((r) => !r.at && /text-wrap:\s*balance/.test(r.body)) || !cmRules(/^\.cmz__quote figcaption$/).some((r) => !r.at && /justify-items:\s*center/.test(r.body))) failures.push(`[creator] the Trezor feedback is centered with its attribution beneath it, at a readable measure (44 to 56rem, found ${quoteRem}rem) in balanced lines`);
    // (12): then a quiet transition into the library: one centered 1px rule, strongest at its middle and fading to
    // nothing at both ends, about two thirds of the width, with generous space; with motion allowed it draws out once
    // from its center. No illustration, card, icon or wave.
    const ruleEl = (tz.match(/<hr class="cmz__rule"[^>]*>/) || [''])[0];
    const ruleCss = cmRules(/^\.cmz__rule$/).filter((r) => !r.at).map((r) => r.body).join(';');
    const ruleW = Number((ruleCss.match(/width:\s*min\(([\d.]+)%/) || [])[1]);
    if (!ruleEl || !/linear-gradient\(to right,\s*transparent,[^;]*\b50%,\s*transparent\)/.test(ruleCss) || !/height:\s*1px/.test(ruleCss) || !/border:\s*0\b/.test(ruleCss) || !(ruleW >= 60 && ruleW <= 70) || !/justify-self:\s*center/.test(ruleCss) || !/margin:\s*clamp\(\s*3rem/.test(ruleCss)) failures.push(`[creator] a centered 1px rule follows the feedback, strongest at its middle and fading at both ends, 60 to 70% of the width (found ${ruleW}%), with generous space`);
    const ruleHidden = cmRules(/^html\.js \.cmz \.cmz__rule\[data-cm-reveal\]:not\(\.is-in\)$/);
    if (!ruleHidden.length || ruleHidden.some((r) => !MOTION_OK.test(r.at) || !/transform:\s*scaleX\(0\)/.test(r.body)) || cmRules(/\.cmz__rule/).some((r) => /animation|transform-origin/.test(r.body))) failures.push('[creator] the rule draws out once from its center, only with motion allowed');
    const afterQuote = tz.slice(tz.indexOf('</figure>', tz.indexOf('cmz__quote')));
    if (/<(?:svg|img|picture|canvas)\b|class="[^"]*(?:card|icon|wave)/.test(afterQuote)) failures.push('[creator] no illustration, card, icon or wave in the transition to the library');
  }

  // ---- 11 Selected content (V1.1; V1.2 its line, its loops and three recut edits; V1.3 Podcasts and the recut creator
  // ads): seven edits behind editorial tabs
  const lib = cmSec('cml');
  // (Full Site Iteration V1: the "Selected content" eyebrow is gone; the headline leads.)
  const LIB = { headline: 'One program, many formats.', copy: 'See the program move from destination films and creator ads to sponsor integrations and the moments behind the camera.' };
  if (/cml__kicker/.test(lib) || /SELECTED CONTENT|>\s*Selected content\s*</.test(lib) || 'kicker' in (cmData.library || {})) failures.push('[creator] the library opens on its headline: the "Selected content" eyebrow is gone (Full Site Iteration V1)');
  const FORMATS = [['destination', 'Destination films'], ['ads', 'Creator ads'], ['gameshow', 'Game show'], ['lifestyle', 'Lifestyle'], ['sponsor', 'Sponsor integrations'], ['bts', 'Behind the scenes'], ['podcasts', 'Podcasts']];
  if (!/data-surface="light-return"/.test(openTag(lib)) || !/data-cm-library/.test(openTag(lib)) || cmOne(lib, /<h2 id="cm-library-title"[^>]*>([\s\S]*?)<\/h2>/) !== LIB.headline || cmOne(lib, /<p class="cml__copy"[^>]*>([\s\S]*?)<\/p>/) !== LIB.copy) failures.push(`[creator] the library reads "${LIB.headline}" and "${LIB.copy}"`);
  // The montage, its pill list and its social clips are gone.
  if (/class="cmm|data-cm-montage|Social clips/.test(cmPage) || 'montage' in cmData || fs.existsSync(path.join(root, 'public/media/cm-montage.mp4')) || fs.existsSync(path.join(root, 'public/media/cm-montage-540.mp4')) || fs.existsSync(path.join(root, 'src/components/creator/CmMontage.astro'))) failures.push('[creator] V1.1 replaced the montage with the library: no montage, no format pills, no "Social clips"');
  // The tabs: one tablist, seven tabs in order (V1.3: Podcasts the seventh), the first selected and the only stop in the
  // tab order.
  if (!/<div class="cml__nav" role="tablist" aria-label="Formats" data-cml-tabs[\s>]/.test(lib)) failures.push('[creator] the formats are one labeled tablist');
  const tabs = [...lib.matchAll(/<button type="button" role="tab" class="cml__tab" id="cml-tab-([\w-]+)" aria-controls="cml-panel-([\w-]+)" aria-selected="(true|false)" tabindex="(0|-1)" data-cml-tab="([\w-]+)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({ key: m[1], controls: m[2], sel: m[3], ti: m[4], data: m[5], index: cmOne(m[6], /<span class="cml__tab-index"[^>]*>([\s\S]*?)<\/span>/), label: cmOne(m[6], /<span class="cml__tab-label"[^>]*>([\s\S]*?)<\/span>/), line: /<span class="cml__tab-line" aria-hidden="true"/.test(m[6]) }));
  if (JSON.stringify(tabs.map((t) => [t.key, t.label])) !== JSON.stringify(FORMATS) || tabs.some((t, i) => t.controls !== t.key || t.data !== t.key || t.index !== String(i + 1).padStart(2, '0') || t.sel !== (i ? 'false' : 'true') || t.ti !== (i ? '-1' : '0') || !t.line)) failures.push(`[creator] seven format tabs in order (${FORMATS.map((f) => f[1]).join(', ')}), each indexed and controlling its panel, the first selected and in the tab order (found ${tabs.map((t) => t.label).join(', ')})`);
  if (JSON.stringify((cmData.library?.formats || []).map((f) => [f.key, f.label])) !== JSON.stringify(FORMATS)) failures.push('[creator] creator.json lists the seven formats in order');
  // Two across on narrower screens, the seventh takes the whole last row (V1.3), so no line stops under an empty half.
  if (!CSS_RULES.some((r) => /^html\.js \.cml__tab:last-child:nth-child\(odd\)$/.test(bare(r.sel).trim()) && /grid-column:\s*1\s*\/\s*-1/.test(r.body))) failures.push('[creator] V1.3: with two formats across, the seventh spans the last row');
  // Editorial, not pills: plain text tabs, the active state a line under the label.
  const tabRules = cmRules(/\.cml__tab(?:\[[^\]]+\]|:[\w-]+)*$/).map((r) => r.body).join(';');
  if (/(?:^|;)\s*(?:background|box-shadow|border(?!-radius))(?:-[\w-]+)?\s*:/.test(tabRules) || /border-radius:\s*(?!2px\b)[^;]+/.test(tabRules) || /gradient\(/.test(cmRules(/\.cml__(?:nav|tab)/).map((r) => r.body).join(';'))) failures.push('[creator] the format tabs are plain text: no pill, capsule, fill, border, shadow or gradient');
  // V1.2, the blend: the section begins to turn toward the water of the program ownership before it ends (one broad
  // vertical gradient), the open air above the waterline takes the same color on, and the wave completes the turn:
  // no line, band, border or blur curtain between them.
  const libGround = cmRules(/^\.cml$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const blend = libGround.match(/background:\s*linear-gradient\((?:to bottom|180deg),\s*var\(--bg\)(?:\s+0%)?,\s*var\(--bg\)\s+(\d+)%,\s*(#[0-9a-f]{3,6})(?:\s+100%)?\)/i);
  const airTop = (cmRules(/^\.cmo$/).map((r) => r.body).join(';').match(/--air-top:\s*(#[0-9a-f]{3,6})/i) || [])[1];
  const airRule = cmRules(/^\.cmo__air$/).map((r) => r.body).join(';');
  if (!blend || !(Number(blend[1]) >= 30 && Number(blend[1]) <= 70) || !airTop || blend[2].toLowerCase() !== airTop.toLowerCase() || !/background:\s*linear-gradient\((?:to bottom|180deg),\s*var\(--air-top\)(?:\s+0%)?,\s*var\(--air-low\)(?:\s+100%)?\)/.test(airRule)) failures.push(`[creator] V1.2: the library turns toward the water before it ends (the gradient begins a third to two thirds of the way down) and the ownership's open air carries the same color on to the wave (found ${blend ? `${blend[1]}% to ${blend[2]}` : 'no gradient'}, air ${airTop || 'none'})`);
  if (cmRules(/^\.(?:cml|cmo|cmo__air)(?:::?(?:before|after))?$/).some((r) => /border-(?:top|bottom)|box-shadow|backdrop-filter|filter:\s*blur/.test(r.body))) failures.push('[creator] V1.2: no line, border, band or blur curtain where the library meets the ownership');
  if (!cmRules(/\.cml__tab\[aria-selected=["']?true["']?\] \.cml__tab-fill$/).some((r) => /scaleX\(var\(--fill/.test(r.body)) || !cmRules(/^\.cml__tab-line$/).some((r) => /height:\s*1px/.test(r.body))) failures.push('[creator] the selected format is marked by a restrained line that fills as its edit plays');
  // The panels: seven edits, each its own silent video with a poster, nothing loaded early, never autoplayed or looped in the markup.
  const panels = cmBlocks(lib, '<div class="cml__panel');
  const libFormats = cmData.library?.formats || [];
  if (panels.length !== 7) failures.push(`[creator] the library holds seven edits (found ${panels.length})`);
  panels.forEach((p, i) => {
    const [key, label] = FORMATS[i] || [];
    const f = libFormats[i] || {};
    const e = cmAsset(f.edit);
    const v = (p.match(/<video\b[^>]*>/) || [''])[0];
    const srcs = [...p.matchAll(/<source src="([^"]+)" type="video\/mp4"([^>]*)>/g)].map((m) => [m[1], (m[2].match(/media="([^"]+)"/) || [])[1] || '']);
    if (!new RegExp(`^<div class="cml__panel[^"]*" id="cml-panel-${key}" data-cml-panel="${key}" data-label="${label}"`).test(p) || /\shidden\b/.test(openTag(p)) || cmOne(p, /<h3 class="cml__panel-title"[^>]*>([\s\S]*?)<\/h3>/) !== label) failures.push(`[creator] ${label}: its panel, named by its heading, visible without the script`);
    if (!/\bmuted\b/.test(v) || !/\bplaysinline\b/.test(v) || !/\bcontrols\b/.test(v) || !/preload="none"/.test(v) || !/\bposter="/.test(v) || /\b(?:autoplay|loop)\b/.test(v) || !new RegExp(`aria-label="${label}: [^"]{40,}"`).test(v) || !/data-cml-video/.test(v)) failures.push(`[creator] ${label}: one silent edit, muted, inline, on its poster, described, loading nothing early, with native controls until the script takes over, never autoplayed or looped in the markup`);
    if (JSON.stringify(srcs) !== JSON.stringify([[`${BASE}/media/${e.fileSmall}`, '(max-width: 47.99rem)'], [`${BASE}/media/${e.file}`, '']])) failures.push(`[creator] ${label}: phones get the smaller edit first, then the full one`);
    // Full Site Iteration V1: no caption under the frame names the format or the place, so the edits carry no cues.
    if (/data-cues=/.test(openTag(p)) || 'cues' in f) failures.push(`[creator] ${label}: no place cues (the caption under the frame is gone)`);
    if (e.permission !== 'approved' || e.type !== 'video' || !/^Selected content: /.test(e.label || '') || !new RegExp(`^SELECTED CONTENT, ${label.toUpperCase()}`).test(e.source || '')) failures.push(`[creator] ${label}: an approved edit in the manifest, its excerpts on record`);
    // V1.2: every edit dissolves back into its own opening (its reset as long as the script's), and the recut media
    // carry new names, so no browser shows a cached older cut (V1.3: the creator ads are -v13; V1.4: Sponsor
    // integrations, Podcasts and Game show are -v14; Full Site Iteration V1: Destination films and Behind the scenes
    // are -fs1).
    const reset = Number((String(e.source || '').match(/([\d.]+) second dissolve reset/) || [])[1]);
    const libReset = Number((cmSource.match(/const LIB_RESET = ([\d.]+);/) || [])[1]);
    if (!(reset > 0) || reset !== libReset || !(libReset >= 0.25 && libReset <= 0.6)) failures.push(`[creator] ${label}: the edit's last moment dissolves into its own opening, ${libReset} seconds, as the script expects (found ${reset || 'none'} in the manifest)`);
    const ver = ['destination', 'bts'].includes(key) ? 'fs1' : ['sponsor', 'podcasts', 'gameshow'].includes(key) ? 'v14' : key === 'ads' ? 'v13' : 'v12';
    const olderFiles = [`cm-library-${key}.mp4`, `cm-library-${key}-540.mp4`, ...['v12', 'v13', 'v14'].filter((v) => ver === 'fs1' || v < ver).flatMap((v) => [`cm-library-${key}-${v}.mp4`, `cm-library-${key}-${v}-540.mp4`])];
    if (e.file !== `cm-library-${key}-${ver}.mp4` || e.fileSmall !== `cm-library-${key}-${ver}-540.mp4` || olderFiles.some((f) => fs.existsSync(path.join(root, 'public/media', f)))) failures.push(`[creator] ${label}: the edit carries its version in its name (-${ver}), and the older files are gone`);
    for (const [file, h, maxMb] of [[e.file, 720, 5], [e.fileSmall, 540, 2.5]]) {
      const ff = path.join(root, 'public/media', file || 'missing');
      if (!file || !fs.existsSync(ff)) {
        failures.push(`[creator] ${label}: the edit file ${file} is missing`);
        continue;
      }
      const fx = mp4Facts(ff);
      const sec = mp4Seconds(ff);
      const mb = fs.statSync(ff).size / 1048576;
      if (!fx.avc || fx.handlers.includes('soun') || fx.top.indexOf('moov') > fx.top.indexOf('mdat') || fx.height !== h || Math.abs(fx.width / fx.height - 16 / 9) > 0.01 || !(sec >= 7 && sec <= 14) || Math.abs(sec - (e.duration || 0)) > 0.05 || mb > maxMb) failures.push(`[creator] ${file}: silent H.264, index first, landscape 16:9 at ${h} lines, 7 to 14 seconds, under ${maxMb} MB (found ${fx.width}x${fx.height}, ${sec.toFixed(2)} s, ${mb.toFixed(2)} MB)`);
    }
  });
  // Full Site Iteration V1: under the frame only the pause and play control, at the lower right; the changing line
  // that named the format and the place (and its cue logic) is gone.
  if (/cml__now|data-cml-format|data-cml-place/.test(lib) || !/<div class="cml__bar"[^>]*>\s*<button type="button" class="cml__toggle" data-cml-toggle aria-label="Pause: Selected content" hidden/.test(lib) || !cmRules(/^html\.js \.cml__bar$/).some((r) => /justify-content:\s*flex-end/.test(r.body))) failures.push('[creator] under the frame: the pause and play control alone, at the lower right; no format or place caption');
  if (/nowPlace|nowFormat|data-cml-place|\bcues\b/.test(fnOf('mountLibrary'))) failures.push('[creator] the library script keeps no caption or cue logic (Full Site Iteration V1)');
  // Without JavaScript the six edits read in turn; the tabs and the bar need the script.
  if (!cmRules(/^\.cml__nav$/).some((r) => !r.at && /display:\s*none/.test(r.body)) || !cmRules(/^html\.js \.cml__nav$/).some((r) => /display:\s*grid/.test(r.body)) || !cmRules(/^html\.js \.cml__panel$/).some((r) => /position:\s*absolute/.test(r.body))) failures.push('[creator] the tabs and the stacked frame need the script; without it the six edits read in turn');
  // The behavior: selection plays from the start; until the reader chooses, the next format follows as each edit
  // begins to dissolve into its opening, only with motion allowed and focus out of the formats; a format the reader
  // selects is pinned and loops (V1.2), with no moving on; the reader's pause holds; reduced motion, saving data or a
  // refused autoplay start nothing (the edit plays through once on request).
  const libSrc = fnOf('mountLibrary');
  for (const [token, what] of [
    ['[data-cml-tabs]', 'the tabs'],
    ["addEventListener('ended'", 'an edit played on request waits when it ends'],
    ['let pinned = false;', 'a selected format is pinned (V1.2)'],
    ['// Leaving the section ends a selection (V1.3)', 'leaving the section ends a selection (V1.3)'],
    ['const loops = () => autoplay();', 'with motion allowed every edit repeats by itself, its last moment its first (V1.2)'],
    ['const movesOn = () => autoplay() && !pinned && !focusIn && !held;', 'the library moves on only until the reader selects a format, and never while focus is in the formats or it is paused (V1.2)'],
    ['v.loop = loops();', 'the edit on screen loops (V1.2)'],
    ['if (movesOn() && !cur.paused && (t >= d - LIB_RESET - 0.03 || wrapped))', 'the next format follows as the edit begins to dissolve into its opening (V1.2)'],
    ["root.toggleAttribute('data-pinned', pinned)", 'the library marks a pinned format (V1.2)'],
    ["setAttribute('aria-selected', String(on))", 'the selected tab says so'],
    ["'ArrowRight'", 'the arrow keys move between tabs'],
    ["'Home'", 'Home and End reach the first and last tabs'],
    ["addEventListener('focusin'", 'keyboard focus in the formats holds the library'],
    ["addEventListener('focusout'", 'and leaving them lets it go on'],
    ['const autoplay = () => !reduced() && !saving() && !blocked;', 'reduced motion, saving data and a refused autoplay start nothing'],
    ["document.addEventListener('visibilitychange', sync)", 'a hidden tab pauses it'],
    ['new IntersectionObserver(', 'off screen pauses it'],
    ['held = true;', "the reader's pause holds"],
    ["setProperty('--fill'", 'the line fills with the edit'],
    ["setAttribute('role', 'tabpanel')", 'the panels become tab panels'],
    ["removeAttribute('controls')", 'the script takes over from the native controls'],
  ]) {
    if (!libSrc.includes(token)) failures.push(`[creator] the library's script: ${what} (missing ${token})`);
  }
  if (/'wheel'|scroll-snap|scrollTo\(|scrollIntoView/.test(libSrc)) failures.push('[creator] the library takes no scrolling over');
  // V1.2: selecting a format (a click, or Enter or Space on a tab) pins it; nothing but another selection moves on from it.
  const tabClick = libSrc.slice(libSrc.indexOf("t.addEventListener('click'"), libSrc.indexOf("tablist.addEventListener('keydown'"));
  const focusOut = libSrc.slice(libSrc.indexOf("tablist.addEventListener('focusout'"), libSrc.indexOf("toggle?.addEventListener('click'"));
  // V1.3: or until the reader leaves the section: once it is entirely off screen the selection lets go (pinned, or an
  // edit played on request), and back on screen the library moves on again; the reader's own pause still holds.
  const leaveAt = libSrc.indexOf('// Leaving the section ends a selection (V1.3)');
  const leave = leaveAt < 0 ? '' : libSrc.slice(leaveAt, libSrc.indexOf("document.addEventListener('visibilitychange', sync)", leaveAt));
  if (!/pinned = true;/.test(tabClick) || /(?<!let )pinned = false/.test(libSrc.replace(leave, '')) || /next\(\)/.test(focusOut) || /next\(\)/.test(libSrc.slice(libSrc.indexOf('const ended = () =>'), libSrc.indexOf('const play = () =>')))) failures.push('[creator] V1.2: a format the reader selects stays pinned and loops until another is selected (or, V1.3, the reader leaves the section); leaving the formats or the end of an edit never moves it on');
  if (!/new IntersectionObserver\(\(\[entry\]\) => \{\s*if \(entry\.isIntersecting \|\| \(!pinned && !asked && !focusIn\)\) return;\s*pinned = false;\s*asked = false;\s*focusIn = false;\s*root\.toggleAttribute\('data-pinned', false\);\s*sync\(\);\s*\}\)\.observe\(root\);/.test(leave) || /held = false/.test(leave)) failures.push('[creator] V1.3: a selected format loops until the reader leaves the section entirely (the section, not the frame, out of view), then lets go; the reader\'s own pause is not undone');

  // ---- 12 The program ownership (V1.2): one headline across a waterline, John's role, three chapters of his own work
  const ow = cmSec('cmo');
  const OW = { kicker: 'Program ownership', above: 'The experience was visible.', below: 'The system behind it was not.', copy: 'My role connected the campaign from sponsor strategy and creative direction through on-site production, distribution, and reporting.' };
  const CHAPTERS = [
    ['01', 'Shape the campaign', 'Campaign strategy with co-sponsors, sponsor packages, creative concepts, briefs, scripts, schedules, and deliverable planning.'],
    ['02', 'Direct the production', 'Creator coordination, shot planning, on-site direction, production scheduling, approvals, and revision guidance.'],
    ['03', 'Carry it to market', 'Sponsor and creator liaison work, posting schedules, distribution, campaign tracking, reporting, and ongoing partner relationships.'],
  ];
  if (cmOne(ow, /<p class="cmo__kicker"[^>]*>([\s\S]*?)<\/p>/) !== OW.kicker || cmOne(ow, /<span class="cmo__above"[^>]*>([\s\S]*?)<\/span>/) !== OW.above || cmOne(ow, /<span class="cmo__below"[^>]*>([\s\S]*?)<\/span>/) !== OW.below || spaced(norm((ow.match(/<h2 id="cm-own-title"[^>]*>([\s\S]*?)<\/h2>/) || [, ''])[1])) !== `${OW.above} ${OW.below}`) failures.push(`[creator] the ownership headline reads "${OW.above} ${OW.below}", one sentence each side of the waterline`);
  if (cmOne(ow, /<p class="cmo__copy"[^>]*>([\s\S]*?)<\/p>/) !== OW.copy || cmData.ownership?.copy !== OW.copy) failures.push('[creator] the ownership section carries its V1.2 line on John\'s role, word for word');
  const owCh = cmBlocks(ow, '<li class="cmo__chapter"').map((li) => [cmOne(li, /<p class="cmo__index"[^>]*>([\s\S]*?)<\/p>/), cmOne(li, /<h3 class="display cmo__chapter-title"[^>]*>([\s\S]*?)<\/h3>/), cmOne(li, /<p class="cmo__chapter-text"[^>]*>([\s\S]*?)<\/p>/)]);
  if (JSON.stringify(owCh) !== JSON.stringify(CHAPTERS) || JSON.stringify((cmData.ownership?.chapters || []).map((c) => [c.index, c.title, c.text])) !== JSON.stringify(CHAPTERS) || !/<ol class="cmo__chapters" aria-label="How the program ran" data-cm-reveal[\s>]/.test(ow)) failures.push(`[creator] V1.2: the ownership is told in three chapters of John's work, word for word: Shape the campaign, Direct the production, Carry it to market (found ${owCh.map((c) => c[1]).join(', ')})`);
  // V1.2: no owner lines and no collaborators here (the credits name them), and nothing John did not do.
  if (/cmo__owner/.test(ow) || cmRules(/\.cmo__owner/).length || (cmData.ownership?.chapters || []).some((c) => 'owner' in c) || /Maanav|Porwal|Bob van der Meer|\bLed by\b|collaboration between/i.test(textOf(norm(ow)))) failures.push('[creator] V1.2: the ownership chapters carry no owner lines and name no collaborators');
  const notJohns = textOf(norm(ow)).match(/\b(?:creator|co-sponsor) sourcing\b|\bsourc(?:ed|ing) (?:the )?creators\b|\blegal\b|\bcontracts?\b|\bnegotiat\w*|\binterviews?\b|\bvillas?\b|\btravel\b|\blogistics\b|\bfilm(?:ed|ing)\b|\bedit(?:ed|ing)\b/i);
  if (notJohns) failures.push(`[creator] V1.2: the ownership names only John's own work: no creator sourcing, legal contracts, filming, editing or sole logistics ("${notJohns[0]}")`);
  // Not a list of areas, rings, pills or feature cards: restrained columns on a hairline.
  if (/cmo__areas|cmo__area\b|cmo__last/.test(ow) || 'areas' in (cmData.ownership || {})) failures.push('[creator] V1.1 retired the nine-area list and its rings');
  const owRules = cmRules(/\.cmo__(?:chapters|chapter|index|chapter-title|chapter-text)(?:::?[\w-]+)?$/).map((r) => r.body).join(';');
  if (/background(?:-color)?:\s*(?![cC]urrent[cC]olor)[^;]+|box-shadow|border-radius/.test(owRules) || /<svg\b|<input\b|<img\b/.test(ow)) failures.push('[creator] the chapters are editorial columns, not cards, pills or icons');
  if (!cmRules(/^\.cmo__chapter$/).some((r) => /grid-template-rows:\s*subgrid/.test(r.body) && DESKTOP.test(r.at)) || !cmRules(/^\.cmo__chapters$/).some((r) => /repeat\(3/.test(r.body) && DESKTOP.test(r.at))) failures.push('[creator] wide screens set the chapters as three columns whose parts line up');
  if (!/<div class="cmo__water" data-surface="dark" aria-hidden="true" data-cmo-water[\s>]/.test(ow) || !/<div class="cmo__air" aria-hidden="true"/.test(ow) || !/\sdata-cmo[\s>]/.test(openTag(ow))) failures.push('[creator] the chapters sit in the deep water below the waterline, the open air above it; the section and its water are marked for the wave\'s flow (V1.3)');
  // V1.2, the wave: more prominent (its crest-to-trough depth 40 to 60 percent greater than V1.1's at every width),
  // a soft organic curve, a lighter swell behind it and a light along its crest, in the page's palette.
  const waveRule = cmRules(/^\.cmo__wave$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const waveHeight = (waveRule.match(/height:\s*clamp\(([\d.]+)rem,\s*([\d.]+)vw,\s*([\d.]+)rem\)/) || []).slice(1).map(Number);
  const waveSvg = decodeURIComponent((waveRule.match(/url\("?data:image\/svg\+xml,([^")]+)"?\)/) || [, ''])[1].replace(/%(?![0-9a-f]{2})/gi, '%25'));
  const waveBox = Number((waveSvg.match(/viewBox='0 0 [\d.]+ ([\d.]+)'/) || [])[1]);
  const mainPath = [...waveSvg.matchAll(/<path d='M0 ([\d.]+) C [\d.]+ ([\d.]+) [\d.]+ [\d.]+ [\d.]+ [\d.]+ S [\d.]+ ([\d.]+) [\d.]+ [\d.]+ V [\d.]+ H 0 Z' fill='#1b4b4f'/g)][0];
  // A wave of this form crests at three quarters of the way to its first control point, and its trough mirrors it.
  const depthOf = (start, up, down, box) => (0.75 * (down - start) - 0.75 * (up - start)) / box;
  const v11 = depthOf(20, 6, 34, 40); // V1.1: viewBox 0 0 720 40, M0 20 C 120 6 240 6 360 20 S 600 34 720 20, height clamp(1rem, 2.4vw, 2.25rem)
  const v12 = mainPath ? depthOf(Number(mainPath[1]), Number(mainPath[2]), Number(mainPath[3]), waveBox) : 0;
  const ratios = waveHeight.length === 3 ? [(waveHeight[0] * v12) / (1 * v11), (waveHeight[1] * v12) / (2.4 * v11), (waveHeight[2] * v12) / (2.25 * v11)] : [];
  if (ratios.length !== 3 || ratios.some((r) => !(r >= 1.4 && r <= 1.6))) failures.push(`[creator] V1.2: the wave is 40 to 60 percent deeper than V1.1's at every width (found ${ratios.map((r) => r.toFixed(2)).join(', ') || 'no wave'})`);
  if (!/fill='#9fc9c3'/.test(waveSvg) || !cmRules(/^\.cmo__swell$/).some((r) => /data:image\/svg\+xml/.test(r.body) && /4f918a/i.test(r.body)) || /stroke=/.test(waveSvg)) failures.push('[creator] V1.2: a lighter swell behind the wave and a soft light along its crest (drawn as a shape, never as a line), in the page\'s palette');
  // V1.3: the wave flows again (V1.2's one movement is gone). Both layers travel one whole period (880 pixels) to the
  // left, at an even pace and without end, each cycle 14 to 22 seconds, the swell behind slower than the wave (so it
  // moves less); each layer is one period wider than the water, so a cycle lands exactly where the next begins (no
  // visible reset); no vertical movement; the crests offset. They run only with motion allowed and, through the script,
  // while the water is near the screen and the page is visible; with reduced motion they are still.
  const flowKf = keyframesOf('cmo-flow').replace(/\s+/g, '');
  if (!/^(?:from|0%)\{transform:translate(?:3d)?\(0(?:px)?(?:,0(?:px)?){0,2}\)\}(?:to|100%)\{transform:translate(?:3d)?\(-880px(?:,0(?:px)?){0,2}\)\}$/.test(flowKf)) failures.push(`[creator] V1.3: each layer of the wave travels exactly one period (880 pixels) to the left and lands where it began, with no vertical movement (found ${flowKf || 'no keyframes'})`);
  const flowOf = (cls) => {
    const body = cmRules(new RegExp(`^html\\.js \\.cmo__${cls}$`)).filter((r) => MOTION_OK.test(r.at)).map((r) => r.body).join(';');
    const m = body.match(/animation:\s*(?=[^;]*\bcmo-flow\b)(?=[^;]*\blinear\b)(?=[^;]*\binfinite\b)[^;]*?([\d.]+)s/);
    return m ? Number(m[1]) : NaN;
  };
  const waveFlow = flowOf('wave');
  const swellFlow = flowOf('swell');
  if (!(waveFlow >= 14 && waveFlow <= 22) || !(swellFlow >= 14 && swellFlow <= 22) || !(swellFlow > waveFlow)) failures.push(`[creator] V1.3: both layers flow without end, evenly, each cycle 14 to 22 seconds, the swell behind slower than the wave (found wave ${waveFlow}, swell ${swellFlow})`);
  const layerRules = cmRules(/^\.cmo__(?:wave|swell)$/).filter((r) => !r.at);
  if (!layerRules.some((r) => /width:\s*calc\(100%\s*\+\s*880px\)/.test(r.body) && /left:\s*0/.test(r.body)) || layerRules.some((r) => /(?:^|;)\s*right:/.test(r.body)) || ['wave', 'swell'].some((cls) => !cmRules(new RegExp(`^\\.cmo__${cls}$`)).some((r) => !r.at && /background-size:\s*880px\s+100%/.test(r.body)))) failures.push('[creator] V1.3: each layer is one 880-pixel period wider than the water, so its cycle has no seam');
  const posOf = (cls) => Number((cmRules(new RegExp(`^\\.cmo__${cls}$`)).filter((r) => !r.at).map((r) => r.body).join(';').match(/background-position:\s*(-?[\d.]+)px\s+100%/) || [])[1]);
  const crestOffset = (((posOf('swell') - posOf('wave')) % 880) + 880) % 880;
  if (!(crestOffset >= 220 && crestOffset <= 660)) failures.push(`[creator] V1.3: the swell's crests start well apart from the wave's (found ${crestOffset} pixels of 880)`);
  if (cmRules(/\.cmo__(?:wave|swell)$/).some((r) => /animation/.test(r.body) && !(MOTION_OK.test(r.at) && /html\.js/.test(r.sel))) || cmRules(/\.cmo__(?:wave|swell)$/).some((r) => /transition/.test(r.body)) || CSS_RULES.some((r) => /cmo__water[^,{]*:not\(\.is-in\)/.test(r.sel)) || keyframesOf('cmo-drift')) failures.push('[creator] V1.3: the wave flows only with motion allowed and the script running (still for reduced motion and without JavaScript); V1.2\'s one movement and its transitions are gone');
  if (!CSS_RULES.some((r) => MOTION_OK.test(r.at) && /\.cmo:not\(\[data-flow=["']?on["']?\]\)/.test(bare(r.sel)) && /cmo__wave/.test(r.sel) && /cmo__swell/.test(r.sel) && /cmo__light/.test(r.sel) && /animation-play-state:\s*paused/.test(r.body))) failures.push('[creator] V1.3: the wave, its swell and the light on the water rest unless the script lets them flow');
  const owSrc = fnOf('mountOwnership');
  if (!/if \(near && !document\.hidden\) root\.dataset\.flow = 'on';\s*else delete root\.dataset\.flow;/.test(owSrc) || !/near = entry\.isIntersecting;/.test(owSrc) || !/document\.addEventListener\('visibilitychange', set\)/.test(owSrc) || !/new IntersectionObserver\(/.test(owSrc) || !/\.observe\(water\)/.test(owSrc) || !/rootMargin: '50% 0px'/.test(owSrc)) failures.push('[creator] V1.3: the wave flows only while the water is near the screen (starting half a screen before it shows) and the page is visible');
  if (!cmScripts.includes('[data-cmo]') || !cmScripts.includes('[data-cmo-water]')) failures.push('[creator] V1.3: the page runs the wave\'s flow (mountOwnership)');
  if (cmRules(/(?:^|\s)\.cmo/).some((r) => /(?:^|;)\s*animation:/.test(r.body) && !/animation:\s*none/.test(r.body) && !MOTION_OK.test(r.at))) failures.push('[creator] the water\'s light moves only with motion allowed');
  // The words stand clear of the wave: room under the first sentence for its full height and its swell.
  const aboveRule = cmRules(/^\.cmo__above$/).map((r) => r.body).join(';');
  const swellRule = cmRules(/^\.cmo__swell$/).filter((r) => !r.at).map((r) => r.body).join(';');
  const room = (aboveRule.match(/padding-bottom:\s*clamp\(([\d.]+)rem,\s*([\d.]+)vw,\s*([\d.]+)rem\)/) || []).slice(1).map(Number);
  const swellH = (swellRule.match(/height:\s*clamp\(([\d.]+)rem,\s*([\d.]+)vw,\s*([\d.]+)rem\)/) || []).slice(1).map(Number);
  if (room.length !== 3 || swellH.length !== 3 || room.some((v, k) => !(v >= swellH[k] * 1.3))) failures.push(`[creator] V1.2: the first sentence keeps room below it for the taller wave and its swell at every width (found ${room.join('/')} against ${swellH.join('/')})`);

  // ---- 13 The credits (V1.1): the team, each with what they owned or collaborated on, then the roll (V1.4: the eight
  // creators by their public X handles only, the one place the roster appears)
  const cr = cmSec('cmc');
  // (Full Site Iteration V1: John and Maanav credited jointly for travel, villas and trip logistics; the line on
  // varying on-site ownership is gone.)
  const TEAM = [
    ['John Cowin', 'Co-led program planning, travel, villa, and trip logistics; led campaign strategy with co-sponsors, sponsor coordination, creative direction, on-site shoot management, approvals, distribution, campaign tracking, reporting, and ongoing creator and partner communication.'],
    ['Maanav Porwal', 'Collaborated on creator and co-sponsor sourcing, interviews, selection, negotiations, legal contracts, travel, villas, and trip logistics.'],
    ['Bob van der Meer', 'Collaborated on creative concepts and handled much of the filming, editing, and final production work.'],
  ];
  const ROLL = [
    ['Co-sponsors', 'Trezor, Bitrefill, Rayls Labs, and Phi Labs'],
    ['Brand', 'Bolt Liquidity'],
    ['Hero photography', 'Rosemary Media and Abbie Bernet, Unsplash (illustrative, not from the trips)'],
  ];
  if (cmOne(cr, /<p class="cmc__kicker"[^>]*>([\s\S]*?)<\/p>/) !== 'Credits' || cmOne(cr, /<h2 id="cm-credits-title"[^>]*>([\s\S]*?)<\/h2>/) !== 'Many hands, one program.') failures.push('[creator] the credits read "Credits", "Many hands, one program."');
  const team = [...cr.matchAll(/<div class="cmc__member"[^>]*>\s*<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => [textOf(norm(m[1])), textOf(norm(m[2]))]);
  if (JSON.stringify(team) !== JSON.stringify(TEAM)) failures.push(`[creator] the credits open with the team, word for word: John Cowin, Maanav Porwal, Bob van der Meer (found ${team.map((t) => t[0]).join(', ')})`);
  if (/level of on-site ownership|varying by activation/.test(cmSpaced) || /varying by activation/.test(JSON.stringify(cmData).replace(/"_\w+":\s*"(?:[^"\\]|\\.)*"/g, ''))) failures.push('[creator] the line on varying on-site ownership is gone (Full Site Iteration V1)');
  const rows = [...cr.matchAll(/<div class="cmc__row(?! cmc__row--handles)[^"]*"[^>]*>\s*<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => [textOf(norm(m[1])), textOf(norm(m[2]))]);
  if (JSON.stringify(rows) !== JSON.stringify(ROLL)) failures.push(`[creator] then the roll: the creators, the co-sponsors (Phi Labs among them), the brand and the hero's illustrative photography (found ${rows.map((r) => r[0]).join(', ')})`);
  // V1.4: the creators open the roll, in order, each by their public X handle and nothing else: no name, employer,
  // partnership, affiliation, descriptor, follower count or travel history, as plain text (no link, icon, picture or
  // card), one handle a line in the roll's type.
  const handleRow = cmBlock(cr, '<div class="cmc__row cmc__row--handles"');
  const handles = [...handleRow.matchAll(/<li class="cmc__handle"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  const firstRow = cr.indexOf('<div class="cmc__row');
  if (!handleRow || cr.indexOf('<div class="cmc__row cmc__row--handles"') !== firstRow || cmOne(handleRow, /<dt\b[^>]*>([\s\S]*?)<\/dt>/) !== 'Creators' || JSON.stringify(handles) !== JSON.stringify(ROSTER.map(([, , h]) => h)) || /<img\b|<a\b|<svg\b|<span\b|<p\b/.test(handleRow) || textOf(cmBlock(handleRow, '<dd')) !== ROSTER.map(([, , h]) => h).join('')) failures.push(`[creator] V1.4: the credits open their roll with the eight creators' public X handles, in order, as plain text and nothing else (found ${handles.join(', ') || 'none'})`);
  if (JSON.stringify(cmData.credits?.rows?.[0]) !== JSON.stringify({ role: 'Creators', handles: ROSTER.map(([, , h]) => h) })) failures.push('[creator] V1.4: creator.json keeps the roster in the credits as the eight handles, in order, and nothing else');
  if (/cmc__person|cmc__people|cmc__row--people/.test(cr) || cmRules(/\.cmc__(?:person|people)/).length) failures.push('[creator] V1.4: nothing is left of the V1.3 names-and-affiliations roll (markup or styles)');
  const handleRules = cmRules(/^\.cmc__handles?$/).map((r) => r.body).join(';');
  if (/background|border(?:-[\w-]+)?\s*:|box-shadow|border-radius|outline|text-decoration|::before/.test(handleRules) || !/list-style:\s*none/.test(handleRules)) failures.push('[creator] V1.4: the handles are plain text: no badges, pills, bullets, underlines or boxes');
  if (/Internal collaborators|design, editing, and legal teams|cmc__note/.test(cr) || 'note' in (cmData.credits || {})) failures.push('[creator] V1.1: no generic "internal collaborators" row and no closing note');
  const johnRole = (team.find((t) => t[0] === 'John Cowin') || [])[1] || '';
  if (/\b(?:edit(?:ed|ing|or)?|film(?:ed|ing)?|shot\b|camera|cinematograph|photograph|design(?:ed|er)?|animat)/i.test(johnRole)) failures.push('[creator] John\'s credit never claims editing, filming, photography or design');
  for (const [role, who] of rows) {
    if (/John Cowin/.test(who) && /edit|film|shoot|shot|camera|cinematograph|photograph|design|animat|illustrat/i.test(role)) failures.push(`[creator] the credits never put John's name to editing, filming, photography or design ("${role}")`);
  }
  const handsOn = cmSpaced.match(/\bI (?:edited|shot|filmed|designed|animated|photographed|cut the|built the (?:edit|cut|design))\b|\b(?:edited|shot|filmed|designed|photographed) by John\b/i);
  if (handsOn) failures.push(`[creator] nothing implies John edited, shot or designed the work ("${handsOn[0]}")`);
  // John is not the sole operator: the page says what he owned and credits the people he worked with.
  const sole = cmSpaced.match(/\bI (?:single-handedly|alone|solely)\b|\bon my own\b|\bI ran the program\b|\bI ran (?:everything|it all)\b/i);
  if (sole) failures.push(`[creator] the page never frames John as the sole operator ("${sole[0]}")`);

  // ---- 14 The conclusion, then the way on and Contact
  const ce = cmSec('cme');
  const CE = { headline: 'The trip ends. The program keeps working.', accent: 'The program keeps working.', copy: 'Each activation produced an immediate body of campaign content and strengthened the creator and partner relationships behind the next opportunity. The value continued through distribution, reporting, and ongoing collaboration after everyone went home.', next: 'Next, see how I turn technical complexity into a clear market narrative.' };
  if (spaced(norm((ce.match(/<h2 id="cm-conclusion-title"[^>]*>([\s\S]*?)<\/h2>/) || [, ''])[1])) !== CE.headline || cmOne(ce, /<span class="cme__accent"[^>]*>([\s\S]*?)<\/span>/) !== CE.accent || cmOne(ce, /<p class="cme__copy"[^>]*>([\s\S]*?)<\/p>/) !== CE.copy) failures.push(`[creator] the conclusion reads "${CE.headline}" and its V1.1 copy`);
  if (/paid off|pays off|pay off|\bROI\b|return on|\bprofit|revenue/i.test(textOf(ce)) || /paid off/i.test(cmSpaced)) failures.push('[creator] the conclusion makes no financial return claim (V1.1 retired "Every trip paid off twice.")');
  const orderOf = (slug) => Number((fs.readFileSync(path.join(root, `src/content/work/${slug}.mdx`), 'utf8').match(/^order:\s*(\d+)/m) || [])[1]);
  const slugs = fs.readdirSync(path.join(root, 'src/content/work')).filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, '')).sort((a, b) => orderOf(a) - orderOf(b));
  const nextSlug = slugs[(slugs.indexOf('creator-campaigns') + 1) % slugs.length];
  const ceLinks = [...ce.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  if (ceLinks.length !== 1 || ceLinks[0][1] !== `${BASE}/work/${nextSlug}/` || nextSlug !== 'technical-marketing' || cmData.conclusion?.next !== nextSlug || cmOne(ceLinks[0][2], /<span class="next-case__line"[^>]*>([\s\S]*?)<\/span>/) !== CE.next) failures.push(`[creator] the conclusion's one link leads to the next case study in order, Technical Product Marketing: "${CE.next}"`);
  if (!/<div class="chapter" data-surface="brand"[^>]*>\s*<section id="contact" class="[^"]*\bcontact--frame\b/.test(cmPage) || !/<footer class="site-footer" data-surface="brand"[\s>]/.test(cmPage)) failures.push('[creator] the page closes with the full Contact frame and the footer on the brand surface');

  // ---- 18 Obsolete V1.0 fields (V1.2): the case study's own record says what the page says, and nothing older
  const mdxRaw = fs.readFileSync(path.join(root, 'src/content/work/creator-campaigns.mdx'), 'utf8');
  const mdxFront = (mdxRaw.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
  const mdxBody = mdxRaw.replace(/^---\n[\s\S]*?\n---/, '');
  const fmString = (key) => {
    const m = mdxFront.match(new RegExp(`^${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'));
    return m ? m[1].replace(/\\"/g, '"') : null;
  };
  const mdxResults = [...((mdxFront.match(/^results:\n((?:\s+- .*\n?)+)/m) || [, ''])[1]).matchAll(/^\s+- "((?:[^"\\]|\\.)*)"/gm)].map((m) => m[1]);
  const RESULTS = ['Eight creators across three international activations', 'Campaign strategy, creative direction, production, and coordinated distribution', 'Co-sponsor campaigns with Trezor, Bitrefill, Rayls Labs, and Phi Labs'];
  if (JSON.stringify(mdxResults) !== JSON.stringify(RESULTS)) failures.push(`[creator] V1.2: the case study's results are the three current lines, Phi Labs among the co-sponsors (found ${mdxResults.join(' | ')})`);
  if (fmString('intro') !== CM.copy || fmString('description') !== `John Cowin ${CM.copy.replace(/^I /, '')}`) failures.push('[creator] V1.2: the case study\'s intro and description follow the hero, naming John\'s ownership alone');
  if (mdxBody.trim()) failures.push('[creator] V1.2: the case study keeps no MDX body (the page is built from creator.json; its V1.0 narrative is gone)');
  if (/Maanav|Porwal|Bob van der Meer|1\.25M|impressions|single-handed|\bsole(?:ly)?\b|\bI ran\b|\bI built\b|\bI owned\b/i.test(mdxFront.replace(/^\s*#.*$/gm, ''))) failures.push('[creator] V1.2: the case study\'s record carries no collaborator names, impressions claims or sole-ownership wording');
  // Full Site Iteration V1: the homepage card shows one video, the creator montage; its supporting panels, their
  // typographic stand-ins and fallbacks are gone (and with them any place a figure could appear).
  if (/^\s+(?:fallback|main|motion|side|fit):/m.test(mdxFront) || !/^\s+video: "cc-creator-montage"$/m.test(mdxFront)) failures.push('[creator] the homepage card shows one video, the creator montage, with no stand-in or fallback (Full Site Iteration V1)');
  const panelsSrc = fs.readFileSync(path.join(root, 'src/components/WorkPanels.astro'), 'utf8');
  if (/impressions|1\.25M|fb--metric|fb__metric|const cosponsors|data-card-secondary|card__panel|fallback/.test(panelsSrc)) failures.push('[creator] the card panels, their stand-ins and their fallbacks are gone (Full Site Iteration V1)');
  // creator.json: no placeholders, categories, testimonials, collaboration rows or people (V1.4: the credits' roster is
  // handles only); its notes speak for V1.4.
  if (/"text":\s*null|Placeholder|"category"|"voices"|"creditsLabel"|"owner"|"handle"|"people"|"affiliations"/.test(JSON.stringify(cmData)) || !/^Creator Marketing and Partnerships, Version 1\.4\b/.test(cmData._readme || '')) failures.push('[creator] V1.4: creator.json carries no placeholders, categories, testimonials, collaboration rows, names or affiliations, and its notes are for Version 1.4');

  // ---- the excerpts (V1.1): no moment twice across the loops, the edits and the fragments; the closing shot of a
  // creator running into the surf, the shot in a Bolt Liquidity shirt outside ION Orchard and the party-bus still with
  // the microphone stay out
  const tcOf = (s) => s.split(':').reduce((a, b) => a * 60 + Number(b), 0);
  const excerpts = [];
  for (const a of cmAssets.filter((x) => /^cm-(?:loop|library|frag)-/.test(x.id))) {
    const src = a.source || '';
    for (const m of src.matchAll(/([A-Z][\w ]*?\.mp4) (\d+:\d\d(?:\.\d+)?) to (\d+:\d\d(?:\.\d+)?)(?: and (\d+:\d\d(?:\.\d+)?) to (\d+:\d\d(?:\.\d+)?))?/g)) {
      excerpts.push({ id: a.id, file: m[1].trim(), a: tcOf(m[2]), b: tcOf(m[3]) });
      if (m[4]) excerpts.push({ id: a.id, file: m[1].trim(), a: tcOf(m[4]), b: tcOf(m[5]) });
    }
    for (const m of src.matchAll(/([A-Z][\w ]*?\.mp4) at (\d+:\d\d(?:\.\d+)?)/g)) excerpts.push({ id: a.id, file: m[1].trim(), a: tcOf(m[2]), b: tcOf(m[2]) });
  }
  if (excerpts.length < 50) failures.push(`[creator] the loops, edits and fragments record their excerpts (found ${excerpts.length})`);
  for (let i = 0; i < excerpts.length; i++) {
    for (let j = i + 1; j < excerpts.length; j++) {
      const x = excerpts[i];
      const y = excerpts[j];
      if (x.id === y.id || x.file !== y.file) continue;
      // Creator Retreat Videos (October 2026): the atlas loops now carry the production work, so a loop may share a
      // moment with the production tabs (behind the scenes, game show, podcasts); nothing else may repeat.
      const PROD_TABS = ['cm-library-bts', 'cm-library-gameshow', 'cm-library-podcasts'];
      if ((/^cm-loop-/.test(x.id) && PROD_TABS.includes(y.id)) || (/^cm-loop-/.test(y.id) && PROD_TABS.includes(x.id))) continue;
      if (Math.min(x.b, y.b) - Math.max(x.a, y.a) > 0.05 || (x.a === x.b && x.a > y.a && x.a < y.b) || (y.a === y.b && y.a > x.a && y.a < x.b)) failures.push(`[creator] no moment appears twice: ${x.id} and ${y.id} share ${x.file} ${clock(Math.max(x.a, y.a))}`);
    }
  }
  for (const [file, a, b, what] of [
    ['Ashley Costa Rica Vlog.mp4', 53.0, 54.6, "the closing shot of a creator running into the surf (V1.1 removed it from the Costa Rica loop)"],
    ['Singapore Spending Spree.mp4', 11.0, 13.6, 'the Bolt Liquidity shirt outside ION Orchard'],
    ['Singapore Spending Spree.mp4', 17.9, 27.7, 'the Bolt Liquidity shirt outside ION Orchard (V1.1 removed it from the Singapore loop)'],
    ['Bolt Bus Trailer.mp4', 16.4, 20.0, 'the party-bus still with the microphone (V1.1 replaced it)'],
    // V1.2: the creator ads lose the two Slippage lines; sponsor integrations lose the Bitrefill "cover your flight"
    // scene, the ClubZero credit-card moment and the "Bolt Liquidity or Sup Raj" moment.
    ['Singapore Slippage Ad.mp4', 23.9, 25.2, '"That slippage, baby" (V1.2 removed it from the creator ads)'],
    ['Singapore Slippage Ad.mp4', 29.9, 32.2, '"Don\'t let slippage take away your fancy high tea sushi" (V1.2 removed it from the creator ads)'],
    ['Costa Rica Aftermovie.mp4', 32.8, 36.0, 'the Bitrefill "cover your flight" scene (V1.2 removed it from sponsor integrations)'],
    ['Singapore Spending Spree.mp4', 120.6, 122.7, 'the ClubZero credit-card moment (V1.2 removed it from sponsor integrations)'],
    ['Mykonos Aftermovie.mp4', 23.8, 28.7, 'the "Bolt Liquidity or Sup Raj" moment (V1.2 removed it from sponsor integrations)'],
    // V1.3: the Singapore loop is no luxury-mall montage: the ION Orchard arrival and the Louis Vuitton and Prada
    // storefronts are out; and the aftermovie's Lock In operator wears another brand's print.
    ['Singapore Spending Spree.mp4', 27.6, 28.6, 'the arrival under the ION Orchard sign (V1.3 removed it from the Singapore loop)'],
    ['Singapore Spending Spree.mp4', 47.2, 48.8, 'the Louis Vuitton and Prada storefronts (V1.3 removed them from the Singapore loop)'],
    ['Mykonos Aftermovie.mp4', 78.56, 78.74, "the camera operator's printed shirt"],
    // V1.4: destination films lose both shots with Club Zero branding (nothing cropped or blurred: the shots are gone),
    // and sponsor integrations lose Shiv's quick Trezor-box sequence.
    ['Costa Rica Aftermovie.mp4', 49.6, 50.46, 'the villa pool from above with Club Zero branding (V1.4 removed it from destination films)'],
    ['Mykonos Aftermovie.mp4', 40.95, 42.92, 'the infinity pool with Club Zero branding (V1.4 removed it from destination films)'],
    ['Shiv Costa Rica Vlog.mp4', 6.8, 8.3, "Shiv's quick Trezor-box sequence (V1.4 removed it from sponsor integrations)"],
    // The aftermovie's Trezor sequence recaps the Trezor ads: its paper airplane and its Take Control card are the
    // creator ads' own moments (from the Trezor Paper Airplane ad), so they stay out of every other edit (V1.4).
    ['Costa Rica Aftermovie.mp4', 101.12, 102.88, "the aftermovie's paper airplane and Take Control card, which the creator ads show from the Trezor ad itself"],
  ]) {
    const hit = excerpts.find((x) => x.file === file && Math.min(x.b, b) - Math.max(x.a, a) >= 0 && !(x.a === x.b && (x.a < a || x.a > b)));
    if (hit) failures.push(`[creator] ${hit.id} uses ${file} ${clock(hit.a)}: ${what} stays out`);
  }
  // V1.2's new moments, where the brief placed them: Ashley with the Trezor device and Shiv with the Trezor box, from the
  // beginnings of their vlogs, in sponsor integrations; the Costa Rica crew around 1:49 to 1:50 of the aftermovie behind
  // the scenes. (V1.2 put Jungle Talk in the creator ads; V1.3 moves it to the podcasts.)
  const exOf = (id) => excerpts.filter((x) => x.id === id);
  // V1.3: the creator ads trade Jungle Talk for a concise Trezor Dare Ad excerpt (the dare, then the product), every
  // other clip as it was; the Dare Ad appears nowhere else among the loops, edits and fragments (its section shows it
  // in full).
  const adsEx = exOf('cm-library-ads');
  const dare = adsEx.filter((x) => x.file === 'Trezor Dare Ad.mp4');
  const dareTotal = dare.reduce((n, x) => n + x.b - x.a, 0);
  if (adsEx.some((x) => x.file === 'Jungle Talk.mp4') || dare.length !== 2 || !(dareTotal >= 2 && dareTotal <= 4) || !dare.some((x) => x.a <= 13.2 && x.b >= 13.9) || !dare.some((x) => x.a >= 24.4 && x.b <= 28.9) || excerpts.some((x) => x.file === 'Trezor Dare Ad.mp4' && x.id !== 'cm-library-ads')) failures.push(`[creator] V1.3: the creator ads carry a concise Trezor Dare Ad excerpt in place of Jungle Talk, the dare and then the device and its app, two to four seconds in all, and the Dare Ad appears in no other edit or loop (found ${dare.length} clip(s), ${dareTotal.toFixed(2)} s)`);
  const ADS_KEEP = [['Bitrefill Pool Ad.mp4', 16, 19.4], ['Trezor Paper Airplane.mp4', 2.75, 4.22], ['Trezor Paper Airplane.mp4', 16.9, 18.25], ['Singapore Slippage Ad.mp4', 0.4, 1.95]];
  if (ADS_KEEP.some(([f, a, b]) => !adsEx.some((x) => x.file === f && Math.abs(x.a - a) < 0.005 && Math.abs(x.b - b) < 0.005)) || adsEx.length !== ADS_KEEP.length + dare.length) failures.push('[creator] V1.3: the creator ads keep every other clip as it was');
  // V1.3, Podcasts: the four shows, each long enough to read, the Lock In Podcast never in an excerpt the Mykonos loop or
  // behind the scenes already shows (the general no-moment-twice rule). V1.4: it no longer opens on the Lock In Podcast
  // (behind the scenes, just before it, ends on it): Jungle Talk or Food Talk first, then the other, in a clearly
  // different setting, the Lock In Podcast in the middle and Pool Talk to close; each show a little longer (2.8 seconds
  // of footage or more).
  const podEx = exOf('cm-library-podcasts');
  const SHOWS = ['Lock In Podcast.mp4', 'Pool Talk.mp4', 'Jungle Talk.mp4', 'Food Talk.mp4'];
  const showTime = SHOWS.map((f) => podEx.filter((x) => x.file === f).reduce((n, x) => n + x.b - x.a, 0));
  if (podEx.some((x) => !SHOWS.includes(x.file)) || showTime.some((t) => !(t >= 2.8))) failures.push(`[creator] V1.4: Podcasts is the Lock In Podcast, Pool Talk, Jungle Talk and Food Talk, each long enough to read (found ${SHOWS.map((f, i) => `${f.replace('.mp4', '')} ${showTime[i].toFixed(1)} s`).join(', ')})`);
  const showOrder = podEx.map((x) => x.file).filter((f, i, all) => !i || f !== all[i - 1]);
  const OPENERS = ['Jungle Talk.mp4', 'Food Talk.mp4'];
  if (showOrder.length !== 4 || !OPENERS.includes(showOrder[0]) || !OPENERS.includes(showOrder[1]) || showOrder[0] === showOrder[1] || showOrder[2] !== 'Lock In Podcast.mp4' || showOrder[3] !== 'Pool Talk.mp4') failures.push(`[creator] V1.4: Podcasts opens with Jungle Talk or Food Talk, then the other, the Lock In Podcast in the middle and Pool Talk to close, each show once (found ${showOrder.map((f) => f.replace('.mp4', '')).join(', ')})`);
  // Creator Retreat Videos (October 2026): Pool Talk, the poolside podcast, also appears in the Mykonos loop.
  if (excerpts.some((x) => ['Pool Talk.mp4', 'Food Talk.mp4', 'Jungle Talk.mp4'].includes(x.file) && x.id !== 'cm-library-podcasts' && !(x.id === 'cm-loop-mykonos' && x.file === 'Pool Talk.mp4'))) failures.push('[creator] V1.3: Jungle Talk, Food Talk and Pool Talk appear only among the podcasts (Pool Talk also in the Mykonos loop)');
  const podSrc = cmAsset('cm-library-podcasts').source || '';
  if (!/framed above their burned-in subtitles/.test(podSrc) || !/crew's shadows/.test(podSrc) || !/microphone/.test(podSrc)) failures.push('[creator] V1.3: the podcasts are clear of their burned-in subtitles, show their microphones and give one production angle (the crew\'s shadows on the terrace)');
  // V1.3, the Singapore loop: the city, the party-bus game show and high tea on the 56th floor, with the girls
  // photographing the food long enough to read (nearly a second), one shopping moment and no retail signage. V1.4: the
  // shopping moment, the eyewear store, is two shots, Eva and Ashley at the display and then Eva trying on glasses, the
  // whole of her shot (its 17 frames, slowed and motion-interpolated, no frozen frame), fully visible for 0.8 to 1.2
  // seconds before it dissolves into Marina Bay, which opens the loop.
  const sgEx = exOf('cm-loop-singapore');
  const photo = sgEx.find((x) => x.file === 'Singapore Slippage Ad.mp4' && x.a <= 6.9 && x.b >= 7.75);
  const bus = sgEx.find((x) => x.file === 'Singapore Spending Spree.mp4' && x.a >= 15.95 && x.b <= 16.95);
  const tea = sgEx.filter((x) => x.file === 'Singapore Slippage Ad.mp4' || (x.file === 'Singapore Spending Spree.mp4' && x.a >= 80 && x.b <= 84));
  const shopping = sgEx.filter((x) => x.file === 'Singapore Spending Spree.mp4' && !(x.a >= 15.95 && x.b <= 16.95) && !(x.a >= 80 && x.b <= 84));
  if (!photo || !bus || tea.length < 4 || shopping.length !== 2 || shopping.some((x) => x.a < 75 || x.b > 76.5) || !sgEx.some((x) => x.file === 'Mykonos Aftermovie.mp4' && x.a >= 144.5)) failures.push(`[creator] V1.3: the Singapore loop is the city, the party bus and high tea (the girls photographing the food among it), with one shopping moment, the eyewear store (found ${sgEx.length} excerpts, ${tea.length} at high tea, ${shopping.length} at the store)`);
  const sgSrc = cmAsset('cm-loop-singapore').source || '';
  const evaHold = Number((sgSrc.match(/fully visible for ([\d.]+) seconds before a ([\d.]+) second dissolve into Marina Bay/) || [])[1]);
  const lastSg = sgEx[sgEx.length - 1] || {};
  if (lastSg.file !== 'Singapore Spending Spree.mp4' || Math.abs(lastSg.a - 75.7) > 0.005 || Math.abs(lastSg.b - 76.41) > 0.005 || !(evaHold >= 0.8 && evaHold <= 1.2) || !/motion-interpolated \(no frozen frame/.test(sgSrc) || !(sgEx[0]?.file === 'Mykonos Aftermovie.mp4' && sgEx[0].a >= 144.5)) failures.push(`[creator] V1.4: Eva's glasses shot, the whole of it, closes the Singapore loop just before Marina Bay, fully visible for 0.8 to 1.2 seconds before the dissolve (found ${evaHold || 'no'} seconds)`);
  // V1.3, the Mykonos loop: its water, villa and dinner as before, and the aftermovie's Lock In Podcast production moment.
  const mkEx = exOf('cm-loop-mykonos');
  // V1.4: the catamaran and the swimmers each end a frame earlier (114.96 and 120.88, not 114.98 and 120.90): each had
  // kept the first frame of the aftermovie's next shot, which flashed through the dissolve after it.
  // Creator Retreat Videos (October 2026): the ranges as measured against the published loop (each within a frame of
  // V1.4's record), the infinity pool two frames shorter; the production moment opens on the crew's camera and gains
  // Pool Talk, so three production excerpts sit among the five.
  const MK_KEEP = [[114.15, 114.96], [120.0, 120.9], [115.98, 117.27], [59.06, 61.18], [61.34, 63.09]];
  if (MK_KEEP.some(([a, b]) => !mkEx.some((x) => x.file === 'Mykonos Aftermovie.mp4' && Math.abs(x.a - a) < 0.005 && Math.abs(x.b - b) < 0.005)) || !mkEx.some((x) => x.file === 'Mykonos Aftermovie.mp4' && x.a >= 78.5 && x.b <= 79.5 && x.b - x.a >= 0.5) || !mkEx.some((x) => x.file === 'Mykonos Aftermovie.mp4' && x.a >= 77.8 && x.b <= 78.5) || !mkEx.some((x) => x.file === 'Pool Talk.mp4') || mkEx.length !== MK_KEEP.length + 3) failures.push('[creator] V1.3: the Mykonos loop keeps its water, villa and dinner and adds the aftermovie\'s Lock In Podcast production moment');
  // Creator Retreat Videos (October 2026): the Costa Rica loop gains the crew at work between the villa and the beach.
  const crEx = exOf('cm-loop-costa-rica');
  if (cmAsset('cm-loop-costa-rica').file !== 'cm-costa-rica-loop-v15.mp4' || !crEx.some((x) => x.file === 'Costa Rica Aftermovie.mp4' && x.a >= 100.2 && x.b <= 101.1) || !crEx.some((x) => x.file === 'Ashley Costa Rica Vlog.mp4' && x.a >= 25.48 && x.b <= 26.44)) failures.push('[creator] Creator Retreat Videos: the Costa Rica loop shows the crew filming between the villa and the beach');
  // V1.4: sponsor integrations without Shiv's quick Trezor-box sequence (no stacked microcuts, no speed effects): Ashley
  // holding her Trezor device at the full length of its shot, the Trezor integration as before (the device by the pool,
  // then the app) and the Bolt Liquidity invitation to Mykonos with time to read it, each on screen long enough for the
  // person and the product to register (every excerpt 1.5 seconds or more, the invitation 2.5 or more).
  const sponsorEx = exOf('cm-library-sponsor');
  const ashleyEx = sponsorEx.find((x) => x.file === 'Ashley Costa Rica Vlog.mp4' && x.a < 10);
  const trezorEx = sponsorEx.find((x) => x.file === 'Costa Rica Aftermovie.mp4' && Math.abs(x.a - 102.9) < 0.005 && Math.abs(x.b - 104.54) < 0.005);
  const inviteEx = sponsorEx.find((x) => x.file === 'Mykonos Aftermovie.mp4' && Math.abs(x.a - 15.3) < 0.005);
  if (sponsorEx.some((x) => x.file === 'Shiv Costa Rica Vlog.mp4') || !ashleyEx || !(ashleyEx.b - ashleyEx.a >= 1.8) || !trezorEx || !inviteEx || !(inviteEx.b - inviteEx.a >= 2.5) || inviteEx.b > 20 || sponsorEx.length !== 4 || sponsorEx.some((x) => x.b - x.a < 1.5)) failures.push(`[creator] V1.4: sponsor integrations drop Shiv's box sequence and give the calmer moments time: Ashley's Trezor, the Trezor integration and the invitation to Mykonos, every excerpt 1.5 seconds or more (found ${sponsorEx.map((x) => `${x.file.replace('.mp4', '')} ${(x.b - x.a).toFixed(2)} s`).join(', ')})`);
  // V1.4, destination films: the two Club Zero shots out (checked above), unbranded destination footage in their places:
  // the alternate aerial pool shot and a villa terrace above the sea.
  const destEx = exOf('cm-library-destination');
  if (destEx.length !== 5 || !destEx.some((x) => x.file === 'Costa Rica Aftermovie.mp4' && Math.abs(x.a - 89.16) < 0.005 && Math.abs(x.b - 89.95) < 0.005) || !destEx.some((x) => x.file === 'Mykonos Aftermovie.mp4' && Math.abs(x.a - 56.88) < 0.005 && Math.abs(x.b - 57.95) < 0.005) || !/Club Zero branding/.test(cmAsset('cm-library-destination').source || '') || /crop|blur/i.test((cmAsset('cm-library-destination').source || '').replace('nothing cropped or blurred', ''))) failures.push('[creator] V1.4: destination films replace the Club Zero shots with unbranded footage (the alternate aerial pool shot, a villa terrace above the sea), never cropping or blurring a mark');
  // V1.4, game show: the second trailer excerpt ends a frame earlier (9.42, not 9.43), clear of the trailer's next shot.
  if (!exOf('cm-library-gameshow').some((x) => x.file === 'Bolt Bus Trailer.mp4' && Math.abs(x.a - 8.47) < 0.005 && Math.abs(x.b - 9.42) < 0.005)) failures.push('[creator] V1.4: the game show\'s second trailer excerpt ends at 0:09.42, clear of the next shot');
  if (!exOf('cm-library-bts').some((x) => x.file === 'Costa Rica Aftermovie.mp4' && x.a <= 109.2 && x.b >= 110.2)) failures.push('[creator] V1.2: behind the scenes includes the Costa Rica crew around 1:49 to 1:50 of the aftermovie (the exterior setup and the bathroom crew laughing)');
  // Full Site Iteration V1 (14): destination films keep the cloud reveal into Mykonos and run on into John's moment in
  // the courtyard (readable, about two thirds of a second, live footage rather than a held frame) before the terrace.
  {
    const cloud = destEx.find((x) => x.file === 'Mykonos Aftermovie.mp4' && Math.abs(x.a - 28.95) < 0.005);
    const destSrc = cmAsset('cm-library-destination').source || '';
    const john = destSrc.match(/John's moment, (\d+:\d\d\.\d+) to (\d+:\d\d\.\d+)/);
    const johnSec = john ? tcOf(john[2]) - tcOf(john[1]) : 0;
    if (!cloud || !(Math.abs(cloud.b - 32.47) < 0.005) || !john || !(johnSec >= 0.6 && johnSec <= 1.0) || tcOf(john[2]) !== cloud.b || /freeze|frozen|held frame|slowed/i.test(destSrc)) failures.push(`[creator] destination films run the cloud reveal on into John's moment, 0.6 to 1.0 seconds of it, before the terrace (found ${johnSec.toFixed(2)} s)`);
  }
  // (17): behind the scenes keeps the Lock In Podcast brief, one camera on the set and one wide angle of the recording
  // (1.5 to 2.5 seconds in all), and gives the time to Costa Rica and Mykonos production; the bathroom laughter stays.
  {
    const btsEx = exOf('cm-library-bts');
    const lockSet = btsEx.filter((x) => x.file === 'Mykonos Aftermovie.mp4' && x.a >= 77.5 && x.b <= 78.56);
    const lockPod = btsEx.filter((x) => x.file === 'Lock In Podcast.mp4');
    const lockTime = [...lockSet, ...lockPod].reduce((n, x) => n + x.b - x.a, 0);
    const prodNew = btsEx.filter((x) => (x.file === 'Costa Rica Aftermovie.mp4' && x.b < 70) || (x.file === 'Mykonos Aftermovie.mp4' && (x.b < 75 || x.a > 100)));
    if (lockSet.length !== 1 || lockPod.length !== 1 || !(lockTime >= 1.5 && lockTime <= 2.5) || prodNew.length < 4) failures.push(`[creator] behind the scenes keeps the Lock In Podcast to one camera on set and one wide angle (1.5 to 2.5 s, found ${lockTime.toFixed(2)} s) and gives the time to Costa Rica and Mykonos production (found ${prodNew.length} new production moments)`);
  }
  // The changed media carry new names, so no browser shows a cached V1.0 cut.
  for (const [id, old] of [['cm-loop-costa-rica', 'cm-costa-rica-loop.mp4'], ['cm-loop-singapore', 'cm-singapore-loop.mp4'], ['cm-loop-singapore', 'cm-singapore-loop-v11.mp4'], ['cm-loop-singapore', 'cm-singapore-loop-v13.mp4'], ['cm-loop-mykonos', 'cm-mykonos-loop.mp4'], ['cm-loop-mykonos', 'cm-mykonos-loop-v13.mp4'], ['cm-loop-costa-rica', 'cm-costa-rica-loop-v11.mp4'], ['cm-loop-mykonos', 'cm-mykonos-loop-v14.mp4']]) {
    if (cmAsset(id).file === old || fs.existsSync(path.join(root, 'public/media', old))) failures.push(`[creator] ${id}: the recut loop has a new name (not ${old})`);
  }

  // ---- every medium on the page is square or landscape (the global media rule), and its excerpt is on record
  for (const a of cmAssets.filter((x) => /^cm-/.test(x.id))) {
    const [aw, ah] = String(a.aspect || '').split(':').map(Number);
    if (['image', 'video'].includes(a.type) && !(aw >= ah)) failures.push(`[creator] ${a.id}: square or landscape only (aspect ${a.aspect})`);
    const filesOf = [a.type === 'image' && a.file && path.join(root, 'src/assets', a.file), a.poster && path.join(root, 'src/assets', a.poster)].filter(Boolean);
    for (const f of filesOf) {
      const sz = fs.existsSync(f) ? sizeOf(f) : null;
      if (!sz || sz.width < sz.height) failures.push(`[creator] ${a.id}: ${path.basename(f)} is square or landscape (found ${sz ? `${sz.width}x${sz.height}` : 'unreadable'})`);
    }
    for (const file of [a.type === 'video' && a.file, a.fileSmall].filter(Boolean)) {
      const ff = path.join(root, 'public/media', file);
      if (!fs.existsSync(ff)) {
        failures.push(`[creator] ${a.id}: public/media/${file} is missing`);
        continue;
      }
      const fx = mp4Facts(ff);
      if (!(fx.width >= fx.height) || !fx.width) failures.push(`[creator] ${a.id}: ${file} is square or landscape (found ${fx.width}x${fx.height})`);
    }
    if (a.type === 'video' && (!/\.mp4/i.test(a.source || '') || !/\d:\d\d(?:\.\d+)?/.test(a.source || ''))) failures.push(`[creator] ${a.id}: the manifest records the source files and time ranges of its excerpts`);
  }
  const article = cmBlock(cmNoCode, '<article class="cm"');
  for (const img of article.matchAll(/<img\b[^>]*>/g)) {
    const w = Number((img[0].match(/\swidth="(\d+)"/) || [])[1]);
    const h = Number((img[0].match(/\sheight="(\d+)"/) || [])[1]);
    if (!(w >= h) && !/\.svg/.test(img[0])) failures.push(`[creator] an image on the page is portrait (${w}x${h}); square or landscape only`);
  }
  // ---- performance: only the hero loads at once; every video waits
  const eager = [...article.matchAll(/<img\b[^>]*>/g)].filter((m) => !/loading="lazy"/.test(m[0]));
  if (eager.length !== 4 || eager.some((m) => article.indexOf(m[0]) > article.indexOf('<section class="cmx"'))) failures.push(`[creator] only the hero's four layers load at once; every other image waits until near (found ${eager.length} eager)`);
  if ([...article.matchAll(/<video\b[^>]*>/g)].some((m) => !/preload="none"/.test(m[0]) || /\bautoplay\b/.test(m[0]))) failures.push('[creator] no video loads or plays before the script decides');
  // ---- no placeholders in a production build
  const ph = cmSpaced.match(/Placeholder|names to confirm|an exact, verified figure|goes here|to be confirmed|\bTBD\b|lorem ipsum/i);
  if (ph || /class="[^"]*(?:--pending|__pending)\b|data-pending\b/.test(cmNoCode)) failures.push(`[creator] unresolved placeholders stay out of a production build (found "${ph ? ph[0] : 'a pending class'}")`);
  // ---- reduced motion and no JavaScript: every animation waits for motion to be allowed; nothing is hidden unless the script will show it
  if (cmRules(/(?:^|\s)\.cm[a-z]?(?:__|\b)/).some((r) => /(?:^|;)\s*animation:/.test(r.body) && !/animation:\s*none/.test(r.body) && !MOTION_OK.test(r.at))) failures.push('[creator] every animation on the page waits for motion to be allowed');
  const hidden = cmRules(/(?:^|\s)\.cm[a-z]?(?:__|\b)|\.cm-cut/).filter((r) => /opacity:\s*0(?![.\d])/.test(r.body));
  const scriptGated = (r) => /html\.js|\.is-pinned|\[data-active\]|\[data-state=playing\]|:hover|:focus/.test(bare(r.sel)) || /hover:\s*hover/.test(r.at);
  const ungated = hidden.filter((r) => !scriptGated(r));
  if (ungated.length) failures.push(`[creator] nothing is hidden without the script that shows it (found ${ungated.map((r) => bare(r.sel)).join(', ')})`);
  if (hidden.some((r) => /html\.js/.test(r.sel) && /:not\(\.is-in\)/.test(r.sel) && !MOTION_OK.test(r.at))) failures.push('[creator] a reveal waits for motion to be allowed; with reduced motion everything is simply there');
  if (!/if \(!\('IntersectionObserver' in window\) \|\| reduced\(\)\) \{\s*for \(const el of els\) el\.classList\.add\('is-in'\);/.test(fnOf('mountReveals')) || !/const reduceMq = window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\);/.test(cmSource)) failures.push('[creator] with reduced motion (or no IntersectionObserver) everything is simply there');
  // The page runs it all: the hero, the atlas, the library, the ownership's wave and the reveals, with the shared players
  // and loops (V1.3: no network).
  for (const token of ['[data-cm-hero]', '[data-cm-atlas]', '[data-cm-library]', '[data-cmo]', '[data-cm-reveal]', '[data-ev-loop]', '[data-evp]']) {
    if (!cmScripts.includes(token)) failures.push(`[creator] the page's script is missing ${token}`);
  }
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

// Work (V1.5, global): a compact menu on the Work item of every page's
// header: the three case studies with the homepage's numbers and titles, in
// order, each a step away, the one you are on marked. It opens on hover (a
// moment's grace on the way in, a short delay on the way out so the pointer can
// travel into it), on keyboard focus and on a tap; never hover-only (without
// JavaScript, hover and focus still open it). Escape closes it, the arrow keys
// move through it, and closed it is out of reach. The phone menu lists the
// case studies under Work.
const WORK_MENU = [['01', 'Creator Marketing and Partnerships', '/work/creator-campaigns/'], ['02', 'Technical Product Marketing', '/work/technical-marketing/'], ['03', 'Events and Multimedia Production', '/work/events-video/']];
const workWant = WORK_MENU.map(([n, t, h]) => `${n} ${t} ${BASE}${h}`).join(' | ');
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  const rel = path.relative(dist, f);
  const headerHtml = (html.match(/<header class="site-header[\s\S]*?<\/header>/) || [''])[0];
  const item = (headerHtml.match(/<li class="nav__item"[^>]*data-workmenu[^>]*>[\s\S]*?<\/ul>\s*<\/div>\s*<\/li>/) || [''])[0];
  const trigger = item.match(/<a\b([^>]*data-workmenu-trigger[^>]*)>([\s\S]*?)<\/a>/) || [];
  const links = [...item.matchAll(/<a href="([^"]+)" class="workmenu__link"([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], attrs: m[2], num: textOf((m[3].match(/<span class="workmenu__num"[^>]*>([\s\S]*?)<\/span>/) || [, ''])[1]), title: textOf((m[3].match(/<span class="workmenu__title"[^>]*>([\s\S]*?)<\/span>/) || [, ''])[1]) }));
  const got = links.map((l) => `${l.num} ${l.title} ${l.href}`).join(' | ');
  if (!trigger[0] || textOf(trigger[2]) !== 'Work' || !new RegExp(`href="${BASE}/#work"`).test(trigger[1]) || !/<span class="nav__caret"[^>]*aria-hidden="true"/.test(trigger[2]) || got !== workWant || !/<div class="workmenu"[^>]*id="nav-work"[^>]*data-workmenu-panel/.test(item)) failures.push(`[nav] ${rel}: Work carries a compact menu of the three case studies, in order (found ${got || 'none'})`);
  if (/aria-expanded|aria-controls/.test(trigger[1] || '')) failures.push(`[nav] ${rel}: Work states aria-expanded and aria-controls only once its script runs`);
  const self = `${BASE}/${rel.replace(/index\.html$/, '')}`;
  if (links.some((l) => /aria-current="page"/.test(l.attrs) !== (l.href === self))) failures.push(`[nav] ${rel}: the menu marks the case study you are on, and only it`);
  const mob = (headerHtml.match(/<ul class="mobile__sub"[\s\S]*?<\/ul>/) || [''])[0];
  const mobGot = [...mob.matchAll(/<a href="([^"]+)" class="mobile__sublink"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => `${textOf(m[2]).replace(/^(\d\d)\s*/, '$1 ')} ${m[1]}`).join(' | ');
  if (mobGot !== workWant) failures.push(`[nav] ${rel}: the phone menu lists the case studies under Work (found ${mobGot || 'none'})`);
}
const navRules = (re) => CSS_RULES.filter((r) => r.sel.split(',').some((x) => re.test(bare(x).trim())));
const menuBase = navRules(/^\.workmenu$/).filter((r) => !r.at).map((r) => r.body).join(';');
const menuOpen = navRules(/^\.nav__item\.is-open \.workmenu$/).filter((r) => !r.at).map((r) => r.body).join(';');
if (!/visibility:\s*hidden/.test(menuBase) || !/opacity:\s*0/.test(menuBase) || !/position:\s*absolute/.test(menuBase) || !/visibility:\s*visible/.test(menuOpen) || !/opacity:\s*1/.test(menuOpen)) failures.push('[nav] the Work menu is out of sight until it opens');
if (!navRules(/^html:not\(\.js\) \.nav__item:hover \.workmenu$/).some((r) => /visibility:\s*visible/.test(r.body)) || !navRules(/^html:not\(\.js\) \.nav__item:focus-within \.workmenu$/).some((r) => /visibility:\s*visible/.test(r.body))) failures.push('[nav] without JavaScript, hover and focus still open the Work menu');
if (!navRules(/^\.workmenu::?before$/).some((r) => /content:/.test(r.body))) failures.push('[nav] the gap between Work and its menu belongs to the menu, so the pointer never leaves on its way down');
if (!CSS_RULES.some((r) => /prefers-reduced-motion:\s*reduce/.test(r.at) && r.sel.split(',').some((x) => /^\.workmenu$/.test(bare(x).trim())) && /transition:\s*none/.test(r.body))) failures.push('[nav] the Work menu opens without motion for reduced motion');
const navScriptAll = scriptsText.find((t) => t.includes('[data-workmenu]')) || '';
const navScript = navScriptAll.slice(navScriptAll.indexOf('[data-workmenu]'), navScriptAll.indexOf('[data-header]') > navScriptAll.indexOf('[data-workmenu]') ? navScriptAll.indexOf('[data-header]') : undefined);
const delays = [...navScript.matchAll(/setTimeout\(\s*\w+\s*,\s*(\d+)\s*\)/g)].map((m) => Number(m[1]));
// Touch: a press that is not a mouse's opens the menu on the first tap instead of following the link.
if (!/!==\s*[`'"]mouse[`'"]/.test(navScript) || !/===\s*[`'"]mouse[`'"]/.test(navScript)) failures.push('[nav] on a touch screen the first tap on Work opens its menu; hover is for a mouse');
for (const token of ['pointerenter', 'pointerleave', 'pointerType', 'focusin', 'focusout', ':focus-visible', 'Escape', 'ArrowDown', 'ArrowUp', 'preventDefault', 'aria-expanded', 'aria-controls', 'inert', 'pageshow']) if (!navScript.includes(token)) failures.push(`[nav] the Work menu's script is missing ${token}`);
if (!delays.some((d) => d > 0 && d <= 150) || !delays.some((d) => d >= 200 && d <= 500)) failures.push(`[nav] the Work menu opens after a moment on hover and closes after a short delay when the pointer leaves (found ${delays.join(', ') || 'none'})`);

// The opening sequence (V1.5, homepage only): a brisk, directional loader on
// the ink ground. Since the Creator Marketing V1.0 brief (Part I) it carries one
// line of words, the viewing note, exactly BEST EXPERIENCED ON DESKTOP, at one
// center, leaving to the right (the three phrases Product complexity. / Market
// clarity. / Strategy, executed. are gone, with no replacement); a small
// marker travelling a hairline from the left end of the screen to the right
// meanwhile, arriving as the note's hold ends; no loading percentage. Since
// Creator Marketing V1.4 (01) the note is coded into place, once: it resolves
// left to right, each position cycling for a moment through a small set of
// monospace code glyphs in the accent before its letter settles, the scramble
// only at the leading edge and a resolved letter never touched again; centered,
// restrained, in 0.45 to 0.8 seconds, then the whole line holds, legible, until
// the marker arrives (the sequence keeps its length); no cursor, caret,
// blinking, flash, tearing, color fringe, scan line or particle, nothing after
// the line has resolved, no change of spacing, and a fixed glyph sequence, not
// chance. Since V1.4 (02) the marker gathers speed: a controlled start, quicker
// through the middle, quickest over the last stretch, arriving with no
// overshoot, bounce or pause as the hero comes in. The note leaves in 0.12 to
// 0.16 seconds. The whole loader with the dissolve and the hero's layered
// entrance (0.6 to 0.8 in V1.5's brief) takes about 2.6 to 3.2 seconds; the
// layers in the brief's order (the ambient photograph, the name, the
// descriptor, the navigation, then the rule and the arrow), overlapping. The
// same on phones. Once per browsing session, decided before the first paint,
// never for a return from a case study, a visit that began inside the site or a
// link to a section; near-instant with reduced motion (no scramble and no
// travel); dismissed by any intent; hidden from assistive technology; the hero
// photograph and the faces preloaded.
const introRules = (re) => CSS_RULES.filter((r) => r.sel.split(',').some((x) => re.test(bare(x).trim())));
const introHeadOf = (html) => [...((html.match(/<head\b[^>]*>[\s\S]*?<\/head>/) || [''])[0]).matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((t) => t.includes('jc-intro')) || '';
const INTRO_MOMENTS = [];
const introAt = home.indexOf('<div class="intro"');
const introHtml = introAt < 0 ? '' : home.slice(introAt, home.indexOf('<section class="hero"', introAt));
const introNote = textOf((introHtml.match(/<p class="intro__note[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1]);
const introPhrases = [...introHtml.matchAll(/<p class="intro__phrase[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1]));
if (introNote !== 'BEST EXPERIENCED ON DESKTOP') failures.push(`[intro] the viewing note is exactly BEST EXPERIENCED ON DESKTOP (found "${introNote}")`);
// Creator Marketing V1.0, Part I: the three phrases are gone, with nothing in their place.
if (introPhrases.length || /intro__phrase|Product complexity\.|Market clarity\.|Strategy, executed\./.test(home)) failures.push(`[intro] the loader carries only the viewing note: Product complexity., Market clarity. and Strategy, executed. are gone, with no replacement (found ${introPhrases.join(' / ') || 'a phrase rule'})`);
if ((introHtml.match(/<p\b/g) || []).length !== 1) failures.push('[intro] one line of words in the loader: the viewing note');
if (/\d\s*%|percent|loading/i.test(textOf(introHtml))) failures.push('[intro] no loading percentage (the marker is a pace, not a measure)');
if (/Strategy into execution\.|Welcome\./.test(introHtml) || /intro__face|intro__drum/.test(home)) failures.push('[intro] the V1.2 drum and its phrases are gone');
if (!/<div class="intro"[^>]*aria-hidden="true"/.test(home)) failures.push('[intro] the opening sequence is decorative: aria-hidden');
if (!/class="intro__track"[\s\S]*class="intro__marker"/.test(introHtml)) failures.push('[intro] a small marker on a path');
// Creator Marketing V1.0, Part I: the note shows on phones too. No width decides
// whether the sequence runs, and no narrow-screen rule hides the note.
if (/innerWidth|matchMedia\(['"`]\((?:max|min)-width/.test(introHeadOf(home)) || introRules(/\.intro(?:__[\w-]+)?(?![\w-])/).some((r) => /(?:max|min)-width|width\s*[<>]/.test(r.at) && /display:\s*none|visibility:\s*hidden|opacity:\s*0(?![.\d])/.test(r.body))) failures.push('[intro] the note shows at every width, phones included');
const headHome = (home.match(/<head\b[^>]*>[\s\S]*?<\/head>/) || [''])[0];
const introHead = [...headHome.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((t) => t.includes('jc-intro')) || '';
for (const token of ['prefers-reduced-motion: reduce', 'sessionStorage', 'jc-intro', "classList.add('intro', 'intro-hold')", 'intro-still', 'document.referrer', 'location.hash', 'visibilityState', 'intro-wait']) if (!introHead.includes(token)) failures.push(`[intro] the head decision is missing "${token}"`);
// The session flag is set before any reason to skip, so it never plays later in a visit that began elsewhere on the site, or again on a return.
if (introHead.indexOf("setItem('jc-intro'") < 0 || introHead.indexOf("setItem('jc-intro'") > introHead.indexOf('location.hash') || introHead.indexOf("getItem('jc-intro')") < 0 || introHead.indexOf("getItem('jc-intro')") > introHead.indexOf("setItem('jc-intro'")) failures.push('[intro] once per browsing session: the flag is read, then set before the sequence decides to skip');
const ms = (v) => {
  const m = String(v).trim().match(/^(-?[\d.]+)(ms|s)$/);
  return m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : NaN;
};
const varsOf = (body) => Object.fromEntries([...body.matchAll(/--intro-([a-z0-9]+):\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]));
const holdVars = varsOf(rulesFor(/^html\.intro-hold$/).filter((r) => !r.at).map((r) => r.body).join(';'));
// Creator Marketing V1.0, Part I: the note held fully legible (hold), then the reveal; no phrases.
const T = Object.fromEntries(['lead', 'in', 'out', 'hold', 'go', 'clear'].map((k) => [k, ms(holdVars[k])]));
// An animation shorthand may list several animations, and the minifier may reorder each one's parts.
const splitTop = (v) => {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of v) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};
const stripCalls = (v) => {
  let out = '';
  let depth = 0;
  for (let i = 0; i < v.length; i += 1) {
    if (!depth) {
      const call = v.slice(i).match(/^(?:calc|var|cubic-bezier|steps)\(/);
      if (call) {
        depth = 1;
        i += call[0].length - 1;
        continue;
      }
    }
    if (depth) {
      if (v[i] === '(') depth += 1;
      else if (v[i] === ')') depth -= 1;
      continue;
    }
    out += v[i];
  }
  return out;
};
const handoff = (re) => {
  const rule = CSS_RULES.find((r) => MOTION_OK.test(r.at) && r.sel.split(',').some((x) => re.test(bare(x).trim())) && /animation:/.test(r.body));
  const v = rule ? (rule.body.match(/animation:\s*([^;]*)/) || [])[1] : '';
  const anims = splitTop(v).map((a) => ({
    name: (a.match(/\b((?:hero|header)-[a-z-]+)\b/) || [])[1],
    dur: ms((stripCalls(a).match(/(?:^|\s)(-?[\d.]+m?s)\b/) || [])[1] || ''),
    off: /var\(--intro-hero\)/.test(a) ? ms((a.match(/calc\(var\(--intro-hero\)\s*\+\s*([\d.]+m?s)\)/) || [])[1] || '0ms') : NaN,
  }));
  const off = anims.length ? Math.min(...anims.map((a) => a.off)) : NaN;
  const end = anims.length ? Math.max(...anims.map((a) => a.off + a.dur)) : NaN;
  return { v, anims, off, end, dur: end - off, name: anims[0]?.name };
};
const LAYERS = [
  ['the photograph', /^html\.intro-hold \.hero__photo$/],
  ['the subject', /^html\.intro-hold \.hero__subject$/],
  ['the name', /^html\.intro-hold \.hero__name$/],
  ['the descriptor', /^html\.intro-hold \.hero__descriptor$/],
  ['the navigation', /^html\.intro-hold \.site-header$/],
  ['the rule', /^html\.intro-hold \.hero__rule$/],
  ['the arrow', /^html\.intro-hold \.hero__arrow$/],
].map(([label, re]) => ({ label, ...handoff(re) }));
if (Object.values(T).some((x) => Number.isNaN(x)) || LAYERS.some((l) => Number.isNaN(l.off) || Number.isNaN(l.dur))) {
  failures.push(`[intro] every timing value is set, and every layer of the hero is timed from the handoff (${JSON.stringify(holdVars)}; ${LAYERS.filter((l) => Number.isNaN(l.off) || Number.isNaN(l.dur)).map((l) => l.label).join(', ')})`);
} else {
  // The reveal as the stylesheet composes it (it must be this calc, so the window
  // measured here is the one the browser runs), and the hero's handoff at it.
  if ((holdVars.reveal || '').replace(/\s+/g, ' ') !== 'calc(var(--intro-lead) + var(--intro-in) + var(--intro-hold))') failures.push(`[intro] --intro-reveal is the note's arrival plus its hold (found ${holdVars.reveal})`);
  if ((holdVars.hero || '').trim() !== 'var(--intro-reveal)') failures.push(`[intro] the hero's layers begin at the reveal (found ${holdVars.hero})`);
  for (const k of ['beat', 'show', 'step', 'p1', 'p2', 'p3']) if (holdVars[k]) failures.push(`[intro] --intro-${k} belonged to the retired phrases`);
  const reveal = T.lead + T.in + T.hold;
  const heroEnd = Math.max(...LAYERS.map((l) => l.end));
  const total = reveal + heroEnd;
  INTRO_MOMENTS.push(Math.round(T.lead + T.in + T.hold * 0.25), Math.round(T.lead + T.in + T.hold * 0.75));
  // Creator Marketing V1.4 (01): the note's coded resolve takes 0.45 to 0.8 seconds, each position's moment of code
  // glyphs a brief part of it (40 to 120 ms), then the whole line holds long enough to read comfortably (at least 1.5
  // seconds), the two together exactly as long as V1.1's arrival and hold (40 + 130 + 2100 ms to the reveal: the loader
  // keeps its length); it leaves in 0.12 to 0.16 seconds; the whole loader, the hero's layers included, runs about 2.6
  // to 3.2 seconds. (V1.2's letter rise and its --intro-letter are gone.)
  const glyphMs = ms(holdVars.glyph);
  if (!(T.in >= 450 && T.in <= 800) || !(glyphMs >= 40 && glyphMs <= 120) || holdVars.letter) failures.push(`[intro] V1.4: the note resolves in 0.45 to 0.8 seconds, each position scrambling for a brief moment (40 to 120 ms) before its letter (found ${T.in} ms, glyphs ${glyphMs} ms${holdVars.letter ? ', and a letter rise' : ''})`);
  // Full Site Iteration V1.1 (01): a little quicker, the reveal at about 2.10 to 2.15 seconds (2.27 before), the time
  // taken from the fully legible hold alone (the resolve keeps its 0.7 seconds), the hold still comfortably long.
  if (!(T.hold >= 1300 && T.hold < 1530) || !(reveal >= 2100 && reveal <= 2150) || T.in !== 700 || T.lead !== 40) failures.push(`[intro] V1.1: the reveal at about 2.10 to 2.15 seconds, the time taken from the hold alone (at least 1.3 seconds still), the note's resolve unhurried (found a ${T.hold} ms hold, the reveal at ${reveal} ms, the resolve ${T.in} ms after ${T.lead} ms)`);
  if (!(T.out >= 120 && T.out <= 160)) failures.push(`[intro] the note leaves in 0.12 to 0.16 seconds (found ${T.out} ms)`);
  // Full Site Iteration V1: the hero's staged entrance completes about 0.9 to 1.2 seconds after the loading screen
  // starts to clear; with V1.1's quicker reveal the whole sequence runs about 3.1 to 3.35 seconds.
  if (!(heroEnd >= 900 && heroEnd <= 1200)) failures.push(`[intro] the hero's staged entrance completes 0.9 to 1.2 seconds after the loader starts to clear (found ${heroEnd} ms)`);
  if (!(total >= 3100 && total <= 3350)) failures.push(`[intro] the whole sequence runs about 3.1 to 3.35 seconds, the hero's entrance included (found ${total} ms)`);
  const noteOut = (introRules(/^html\.intro \.intro__note$/).map((r) => r.body).join(';').match(/intro-word-out\s+var\(--intro-out\)\s+var\(--intro-leave\)\s+([^,;]+?)\s+forwards/) || [])[1];
  if (noteOut !== 'var(--intro-reveal)') failures.push(`[intro] the note holds its full time and leaves as the ground starts to clear (found ${noteOut})`);
  if (!(T.go > 0 && T.go < 200) || !(T.clear >= 300 && T.clear <= 500)) failures.push(`[intro] the marker sets off at once, and the ground dissolves in 0.3 to 0.5 seconds (found ${T.go} and ${T.clear} ms)`);
  // Full Site Iteration V1.1 (02), the staged entrance reordered so the name is never in front of John: (1) the
  // photograph and its grade settle; (2) the portrait (the cutout above the name) is in place from the first paint,
  // settling with the photograph on the same clock and nothing else: no opacity of its own, so never see-through;
  // (3) once the ground has gone (--intro-clear), the moving name and the rule behind the portrait, the name starting
  // as the rule draws; (4) the descriptor, the arrow and the navigation last, together.
  const L = Object.fromEntries(LAYERS.map((l) => [l.label, l]));
  const subjectAnims = L['the subject'].anims || [];
  const lastFour = ['the descriptor', 'the arrow', 'the navigation'].map((k) => L[k]);
  const stageOk =
    L['the photograph'].off === 0 &&
    subjectAnims.length === 1 && subjectAnims[0].off === 0 && subjectAnims[0].name === L['the photograph'].name &&
    L['the name'].off >= T.clear &&
    Math.abs(L['the rule'].off - L['the name'].off) <= 100 &&
    lastFour.every((l) => l.off > L['the name'].off && l.off < L['the name'].end + 120) &&
    Math.max(...lastFour.map((l) => l.off)) - Math.min(...lastFour.map((l) => l.off)) <= 120;
  if (!stageOk) failures.push(`[intro] V1.1: the hero arrives in stages: the photograph, the portrait in place above the rear layers from the first paint (its settle and nothing else), then, once the ground has gone, the name and its rule behind the portrait, then the descriptor, arrow and navigation (found ${LAYERS.map((l) => `${l.label} +${l.off}`).join(', ')}; the subject's ${subjectAnims.map((a) => a.name).join(', ')})`);
  // The portrait has no animation of its opacity anywhere, and sits above the name's layer.
  if (CSS_RULES.some((r) => /\.hero__subject\b/.test(r.sel) && (/opacity:\s*0(?![.\d])/.test(r.body) || /hero-resolve|hero-fade/.test(r.body)))) failures.push('[intro] V1.1: the portrait is never transparent: no opacity of its own and no fade');
  const zOf = (re) => Number((rulesFor(re).filter((r) => !r.at).map((r) => r.body).join(';').match(/z-index:\s*(\d+)/) || [])[1]);
  if (!(zOf(/^\.hero__subject(?:\[data-astro-cid-[\w-]+\])?$/) > zOf(/^\.hero__behind(?:\[data-astro-cid-[\w-]+\])?$/))) failures.push('[intro] the portrait sits above the moving name and the rule behind it');
  // And it waits for the portrait itself: until the cutout has loaded and decoded, the name's layer is hidden (an
  // image still on its way occludes nothing). An inline script in the hero, run as the page is parsed, marks the
  // section; without JavaScript nothing waits.
  const heroSec = (home.match(/<section class="hero"[\s\S]*?<\/section>/) || [''])[0];
  const gate = [...heroSec.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((t) => t.includes('data-subject')) || '';
  if (!gate || heroSec.indexOf(gate) < heroSec.indexOf('hero__subject') || !/\.decode\(/.test(gate) || !/naturalWidth/.test(gate) || !/addEventListener\(['"]load['"]/.test(gate) || !rulesFor(/^html\.js \.hero(?:\[data-astro-cid-[\w-]+\])?:not\(\[data-subject\]\) \.hero__behind(?:\[data-astro-cid-[\w-]+\])?$/).some((r) => /visibility:\s*hidden/.test(r.body))) failures.push('[intro] V1.1: the name waits for the portrait: hidden until the cutout has loaded and decoded (the section marked data-subject by an inline script after the portrait)');
  const trackDelay = introRules(/^html\.intro-hold \.stream__track$/).filter((r) => MOTION_OK.test(r.at)).map((r) => (r.body.match(/animation-delay:\s*calc\(var\(--intro-hero\)\s*\+\s*([\d.]+m?s)\)/) || [])[1]).find(Boolean);
  if (ms(trackDelay || '') !== L['the name'].off) failures.push(`[intro] the name's movement begins with the name's arrival, as the rule draws (found the stream at +${ms(trackDelay || '')} ms)`);
  // No bounce, no heavy blur, no large travel: opacity, a slight settle of the photograph, a short rise.
  for (const name of ['hero-ambient', 'hero-resolve', 'hero-rise-fade', 'hero-draw', 'hero-point', 'header-in']) {
    const k = keyframesOf(name);
    const moves = [...k.matchAll(/translate(?:3d|X|Y)?\(([^)]*)\)/g)].flatMap((m) => [...m[1].matchAll(/(-?[\d.]+)px/g)].map((x) => Number(x[1])));
    const blur = [...k.matchAll(/blur\(\s*([\d.]+)px\)/g)].map((m) => Number(m[1]));
    if (!k || moves.some((v) => Math.abs(v) > 8) || blur.some((v) => v > 4) || /scale\((?:1\.[1-9]|[2-9])/.test(k)) failures.push(`[intro] ${name}: no bounce, heavy blur or large travel in the hero's entrance`);
  }
  if (LAYERS.some((l) => /cubic-bezier\(\s*[\d.]+\s*,\s*(?:-|1\.[0-9]*[1-9])/.test(l.v) || /cubic-bezier\([^)]*,\s*(?:-|1\.[0-9]*[1-9])[\d.]*\s*\)/.test(l.v))) failures.push('[intro] the hero\'s entrance curves never overshoot (no bounce)');
}
// The path: the marker from the left end to the right, arriving at the reveal, on a curve with no overshoot.
const travel = keyframesOf('intro-travel');
const travelRule = CSS_RULES.find((r) => r.sel.split(',').some((x) => /^html\.intro \.intro__marker$/.test(bare(x).trim())) && /animation:/.test(r.body));
const travelVal = travelRule ? (travelRule.body.match(/animation:\s*([^;]*)/) || [])[1] : '';
if (!/(?:from|0%)\s*\{\s*transform:\s*translate(?:X)?\(0(?:px)?\)/.test(travel) || !/to\s*\{\s*transform:\s*translate(?:X)?\(100cqi\)/.test(travel) || !/^intro-travel calc\(var\(--intro-reveal\)\s*-\s*var\(--intro-go\)\)\s+var\(--intro-run\)\s+var\(--intro-go\)/.test(travelVal.trim())) failures.push('[intro] the marker travels the whole path, left to right, and arrives as the last phrase ends');
if (!introRules(/^\.intro__track$/).some((r) => /container-type:\s*inline-size/.test(r.body))) failures.push('[intro] the path is the measure of the marker\'s run (100cqi)');
// V1.4 (02): the marker gathers speed: a controlled, readable start (at most half its average pace), quicker through
// the middle and quickest over the last stretch (at least twice its average pace as it arrives), so it never eases into
// a pause at the end; no bounce or overshoot (both control points inside the box); a pace, not a measure of loading.
// Its streak lengthens with the speed, longest as the marker arrives.
const runEase = (introRules(/^html\.intro \.intro__stage$/).map((r) => r.body).join(';').match(/--intro-run:\s*cubic-bezier\(([^)]*)\)/) || [, ''])[1].split(',').map(Number);
const startPace = runEase[1] / runEase[0];
const endPace = (1 - runEase[3]) / (1 - runEase[2]);
if (runEase.length !== 4 || runEase.some((v) => !(v >= 0 && v <= 1)) || !(startPace <= 0.5) || !(endPace >= 2)) failures.push(`[intro] V1.4: the marker sets off at a controlled pace and gathers speed to the end, quickest as it arrives, with no bounce, overshoot or pause (found cubic-bezier(${runEase.join(', ')}): ${startPace.toFixed(2)}x its average pace at the start, ${endPace.toFixed(2)}x at the end)`);
const streakKf = keyframesOf('intro-streak');
const streakScales = [...streakKf.matchAll(/scaleX\(([\d.]+)\)/g)].map((m) => Number(m[1]));
const streakRule = introRules(/^html\.intro \.intro__trail$/).map((r) => r.body).join(';');
if (streakScales.length < 4 || streakScales.some((v, i) => i && !(v > streakScales[i - 1])) || streakScales[streakScales.length - 1] !== 1 || !(streakScales[0] <= 0.2) || !/intro-streak\s+calc\(var\(--intro-reveal\)\s*-\s*var\(--intro-go\)\)\s+linear\s+var\(--intro-go\)/.test(streakRule)) failures.push(`[intro] V1.4: the streak lengthens with the marker's speed, longest as it arrives (found ${streakScales.join(', ')})`);
const wordOut = keyframesOf('intro-word-out');
const stopsOf = (k) => [...k.matchAll(/(^|\})\s*([^{}]+)\{/g)].map((m) => m[2].trim());
// V1.6: the leaving note may be gone before its drift ends (an opacity-only stop), never overshooting.
const outStops = [...wordOut.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
const midOut = outStops.filter(([x]) => !/^(from|to|0%|100%)$/.test(x));
if (!/to\s*\{[^}]*translate(?:X)?\([\d.]+em\)/.test(wordOut) || midOut.length > 1 || midOut.some(([, b]) => !/^\s*opacity:\s*0;?\s*$/.test(b))) failures.push('[intro] the note leaves to the right, the way the marker runs, with no overshoot');
// Creator Marketing V1.4 (01): the note is coded into place, once, left to right. The line is set letter by letter
// in reading order (its four words kept whole), at its resting spacing from the start: each letter is held back (its
// color only, so nothing moves) until the leading edge has passed it, and in the moment before (--intro-glyph) the
// script puts a monospace code glyph in its place, in the accent, from a small fixed set; a resolved letter is never
// touched again, and nothing changes once the line has resolved. The glyphs are timed from the letters' own
// animation (its delay and its clock), so the two never drift; a fixed sequence, never chance; the script stops when
// the last letter has resolved, clears the glyphs if the visitor skips, and never runs with reduced motion.
const introSrc = fs.readFileSync(path.join(root, 'src/components/Intro.astro'), 'utf8');
const introBundle = scriptsText.find((t) => t.includes('intro-skip')) || '';
const introNoteHtml = (introHtml.match(/<p class="intro__note[^"]*"[^>]*>[\s\S]*?<\/p>/) || [''])[0];
const introLetters = [...introNoteHtml.matchAll(/<span class="intro__ch"[^>]*style="--c: (\d+)"[^>]*>([^<]*)<\/span>/g)].map((m) => [Number(m[1]), m[2].trim()]);
const introWords = (introNoteHtml.match(/<span class="intro__word"/g) || []).length;
const noteChars = 'BESTEXPERIENCEDONDESKTOP';
if (introLetters.map((l) => l[1]).join('') !== noteChars || introLetters.some((l, i) => l[0] !== i) || !new RegExp(`<p class="intro__note"[^>]*style="--letters: ${noteChars.length}"`).test(introNoteHtml) || introWords !== 4) failures.push(`[intro] the note is set letter by letter in reading order, its four words kept whole (found ${introLetters.length} letters in ${introWords} words)`);
const resolveKf = keyframesOf('intro-resolve');
if (!/^(?:from|0%)\s*\{\s*color:\s*(?:transparent|#0000|#00000000|rgba\(0,\s*0,\s*0,\s*0\));?\s*\}$/.test(resolveKf.trim()) || keyframesOf('intro-letter-in') || keyframesOf('intro-note-in')) failures.push(`[intro] V1.4: a letter waits for its moment by its color alone (nothing moves, blurs or changes spacing), and V1.2's letter rise and tracking are gone (found ${resolveKf.trim() || 'no intro-resolve'})`);
const noteAnim = introRules(/^html\.intro \.intro__note$/).filter((r) => !r.at).map((r) => r.body).join(';');
const chAnim = (introRules(/^html\.intro \.intro__ch$/).filter((r) => !r.at).map((r) => r.body).join(';').match(/animation:\s*([^;]+)/) || [, ''])[1];
if (!/animation:\s*intro-fade-in\s+1ms\s+linear\s+var\(--intro-lead\)\s+both,/.test(noteAnim) || /letter-spacing|filter|transform/.test(introRules(/^html\.intro \.intro__(?:note|ch|word)$/).map((r) => r.body).join(';')) || !/^intro-resolve\s+1ms\s+linear\s+calc\(var\(--intro-lead\)\s*\+\s*var\(--c\)\s*\*\s*\(var\(--intro-in\)\s*-\s*var\(--intro-glyph\)\)\s*\/\s*max\(1,\s*var\(--letters\)\s*-\s*1\)\s*\+\s*var\(--intro-glyph\)\)\s+both$/.test(chAnim.trim())) failures.push('[intro] V1.4: the line is there from the start at its resting spacing; each letter resolves in reading order, the last as the entrance ends, a glyph moment after the edge reaches it');
const glyphBox = introRules(/^\.intro__ch::?after$/).map((r) => r.body).join(';');
if (!/content:\s*attr\(data-g\)/.test(glyphBox) || !/position:\s*absolute/.test(glyphBox) || !/font-family:\s*ui-monospace/.test(glyphBox) || !/color:\s*var\(--c-aqua-light\)/.test(glyphBox) || !introRules(/^\.intro__ch$/).some((r) => /position:\s*relative/.test(r.body))) failures.push('[intro] V1.4: the code glyph sits in its letter\'s place (absolutely, so nothing shifts), monospace, in the accent');
// The glyph goes at its letter's moment, on the same clock (the same delay), so a glyph and its letter never show
// together, not even for the frame the script takes to catch up.
const glyphOut = (introRules(/^html\.intro \.intro__ch::?after$/).filter((r) => !r.at).map((r) => r.body).join(';').match(/animation:\s*([^;]+)/) || [, ''])[1];
const glyphOutKf = keyframesOf('intro-glyph-out');
if (glyphOut.trim().replace(/^intro-glyph-out/, 'intro-resolve') !== chAnim.trim() || !/(?:to|100%)\s*\{\s*opacity:\s*0;?\s*\}/.test(glyphOutKf)) failures.push('[intro] V1.4: each glyph goes at its letter\'s moment, on the letter\'s own clock, so the two never show together');
const glyphSet = (introSrc.match(/const GLYPHS = '([^']+)';/) || [, ''])[1];
if (!(glyphSet.length >= 6 && glyphSet.length <= 16) || /[A-Za-z]/.test(glyphSet) || !introBundle.includes(glyphSet) || !introBundle.includes('intro-resolve') || !/\.getAnimations\?\.\(\)\.find\(\(x\) => \(x as CSSAnimation\)\.animationName === 'intro-resolve'\)/.test(introSrc) || !/const at = Number\(a!\.effect\?\.getTiming\(\)\.delay\) \|\| 0;/.test(introSrc) || !/if \(t >= at - glyphMs && t < at\)/.test(introSrc) || !/if \(pending\) requestAnimationFrame\(tick\);/.test(introSrc) || !/root\.classList\.contains\('intro-skip'\)\) \{\s*for \(const \{ ch \} of slots\) delete ch\.dataset\.g;/.test(introSrc) || !/if \(!root\.classList\.contains\('intro-still'\)\) \{/.test(introSrc)) failures.push(`[intro] V1.4: a small fixed set of code glyphs (6 to 16, no letters; found "${glyphSet}"), timed from the letters' own animation, only at the leading edge, stopping when the line has resolved, cleared on a skip, never with reduced motion`);
if (/steps\(|caret|cursor|intro__cursor|Math\.random|text-shadow|mix-blend-mode|clip-path|hue-rotate|drop-shadow/.test(introRules(/\.intro/).map((r) => r.body).join(';') + introHtml + introHead) || /@keyframes intro-(?:blink|type|caret|scramble|glitch|flicker|flash|tear|scan|shake|jitter|particle)/.test(cssText) || /setInterval|Math\.random/.test(introBundle + introSrc)) failures.push('[intro] V1.4: no cursor, caret, blinking, flash, tearing, color fringe, scan line, particle or randomness in the note');
// Reduced motion never shows the note (the ground clears at once); were it shown, it would only fade, with no scramble.
if (!CSS_RULES.some((r) => /prefers-reduced-motion:\s*reduce/.test(r.at) && /^html\.intro \.intro__ch$/.test(bare(r.sel)) && /animation-name:\s*intro-fade-in/.test(r.body)) || /transform|filter/.test(keyframesOf('intro-fade-in'))) failures.push('[intro] with reduced motion the note\'s letters would only fade in, with no scramble');
const readout = introRules(/^\.intro__readout$/).map((r) => r.body).join(';');
if (!/place-items:\s*center/.test(readout) || !/white-space:\s*nowrap/.test(introRules(/^\.intro__readout\s*>\s*p$/).map((r) => r.body).join(';'))) failures.push('[intro] the note: one line at one center');
const noteRule = introRules(/^\.intro__note$/).map((r) => r.body).join(';');
if (!/font-family:\s*var\(--font-sans\)/.test(noteRule) || !/letter-spacing:\s*\.?\d/.test(noteRule) || /color:\s*(?:red|#f00|var\(--c-signal)/i.test(noteRule)) failures.push('[intro] the note is quiet: small tracked capitals, not a warning');
// Reduced motion: no travel and no words; the ground clears in a fifth of a second.
const stillVars = varsOf(rulesFor(/^html\.intro-still$/).filter((r) => !r.at).map((r) => r.body).join(';'));
if (ms(stillVars.reveal) !== 0 || !(ms(stillVars.clear) <= 250) || !introRules(/^html\.intro-still \.intro__stage$/).some((r) => /display:\s*none/.test(r.body)) || !CSS_RULES.some((r) => /prefers-reduced-motion:\s*reduce/.test(r.at) && /^html\.intro-still \.intro__ground$/.test(bare(r.sel)) && /animation-duration:\s*var\(--intro-clear\)/.test(r.body))) failures.push('[intro] reduced motion: near-instant, the ground clearing in a fifth of a second with no travel and no words');
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

// ------------------------------- Social Share Polish V1 and V1.1, Case Study Share Cards
// The homepage's link preview is its own, from site.json's homeShare, decoupled from the browser title (checked above,
// unchanged) and from the meta description: og:title and og:description, the same title and description for X with
// the large image, and the crop-safe portrait card (og-home: public/og/home.jpg, exactly 1200 by 630, a JPEG under
// 300 KB, which WhatsApp's previews are known to accept), its URL carrying the first ten hex digits of the file's
// SHA-1, so a new card always gets a new URL. Its alt text describes it. V1.1: every page's preview names the site
// John Cowin Portfolio, from a dedicated setting (ogSiteName), while the global name, the JSON-LD name and the hero's
// heading stay John Cowin; and every canonical and share URL is on the public domain (public/CNAME: johncowin.com),
// none on jtcowin.github.io, the sitemap and robots.txt included. The case studies keep their own previews: their title
// with "| John Cowin", their own description and card.
{
  const siteData = JSON.parse(fs.readFileSync(path.join(root, 'src/data/site.json'), 'utf8'));
  const share = siteData.homeShare || {};
  const ent = (v) => (v == null ? v : v.replace(/&amp;|&#38;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;|&#34;/g, '"'));
  const prop = (html, p) => ent((html.match(new RegExp(`<meta property="${p}" content="([^"]*)"`)) || [])[1]);
  const named = (html, n) => ent((html.match(new RegExp(`<meta name="${n}" content="([^"]*)"`)) || [])[1]);
  const sha1 = (file) => createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
  const ORIGIN = 'https://johncowin.com/';
  const SITE_NAME = 'John Cowin Portfolio';
  const WANT = { title: 'Web3 Marketing, Strategy & Production', description: 'Selected work across positioning, technical content, creator campaigns, events, and multimedia production.' };
  const ALT = 'Portrait of John Cowin for his Web3 marketing and production portfolio.';
  if (share.title !== WANT.title || share.description !== WANT.description) failures.push('[share] site.json homeShare holds the approved homepage share title and description');
  if (prop(home, 'og:title') !== WANT.title || prop(home, 'og:description') !== WANT.description) failures.push(`[share] the homepage's og:title and og:description are its share metadata, not its browser title (found ${prop(home, 'og:title')} | ${prop(home, 'og:description')})`);
  if (named(home, 'twitter:title') !== WANT.title || named(home, 'twitter:description') !== WANT.description || named(home, 'twitter:card') !== 'summary_large_image') failures.push('[share] X takes the same title and description, with the large image');
  if (named(home, 'description') !== siteData.description) failures.push('[share] the homepage meta description is unchanged (the share description is for link previews)');
  if (siteData.name !== 'John Cowin' || !/"@type":"Person","name":"John Cowin"/.test(home) || !/<h1 class="hero__name"/.test(home)) failures.push('[share] the global name, the JSON-LD name and the hero heading stay John Cowin');
  // V1.1: one site name for every preview, from its own setting.
  if (siteData.ogSiteName !== SITE_NAME || 'siteName' in share) failures.push('[share] V1.1: the previews\' site name is its own setting, site.json ogSiteName: John Cowin Portfolio (not a homepage override)');
  for (const f of htmlFiles) {
    const page = fs.readFileSync(f, 'utf8');
    if (prop(page, 'og:site_name') !== SITE_NAME) failures.push(`[share] V1.1: ${path.relative(dist, f)}: og:site_name is ${SITE_NAME} (found ${prop(page, 'og:site_name')})`);
  }
  // V1.1: the public domain everywhere a URL is written for others to follow.
  const cname = fs.existsSync(path.join(root, 'public/CNAME')) ? fs.readFileSync(path.join(root, 'public/CNAME'), 'utf8') : null;
  if (cname !== 'johncowin.com' || !fs.existsSync(path.join(dist, 'CNAME')) || fs.readFileSync(path.join(dist, 'CNAME'), 'utf8') !== 'johncowin.com' || SITE_ORIGIN !== 'https://johncowin.com') failures.push(`[share] V1.1: public/CNAME holds exactly johncowin.com and the site builds for https://johncowin.com (found ${JSON.stringify(cname)}, ${SITE_ORIGIN})`);
  for (const f of htmlFiles) {
    const page = fs.readFileSync(f, 'utf8');
    const rel = path.relative(dist, f);
    const head = (page.match(/<head\b[^>]*>[\s\S]*?<\/head>/) || [''])[0];
    const urls = {
      canonical: (head.match(/<link rel="canonical" href="([^"]*)"/) || [])[1],
      'og:url': prop(page, 'og:url'),
      'og:image': prop(page, 'og:image'),
      'twitter:image': named(page, 'twitter:image'),
    };
    const noindex = /<meta name="robots" content="noindex/.test(head);
    for (const [k, v] of Object.entries(urls)) {
      if (v == null && noindex && (k === 'canonical' || k === 'og:url')) continue;
      if (!v || !v.startsWith(ORIGIN)) failures.push(`[share] V1.1: ${rel}: ${k} begins with ${ORIGIN} (found ${v})`);
    }
    if (/jtcowin\.github\.io/.test(head)) failures.push(`[share] V1.1: ${rel}: no canonical or share URL uses jtcowin.github.io`);
  }
  const robots = fs.existsSync(path.join(dist, 'robots.txt')) ? fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8') : '';
  const maps = fs.readdirSync(dist).filter((n) => /^sitemap.*\.xml$/.test(n)).map((n) => fs.readFileSync(path.join(dist, n), 'utf8')).join('\n');
  const locs = [...maps.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  if (!/^Sitemap: https:\/\/johncowin\.com\/sitemap-index\.xml$/m.test(robots) || !locs.length || locs.some((u) => !u.startsWith(ORIGIN))) failures.push('[share] V1.1: robots.txt and the sitemap point at johncowin.com');
  // The homepage card.
  const ogHome = cardManifest.find((a) => a.id === 'og-home') || {};
  const card = path.join(root, 'public', ogHome.file || '-');
  const cardSize = fs.existsSync(card) ? imageSize(card) : null;
  const cardKb = cardSize ? fs.statSync(card).size / 1024 : 0;
  const isJpeg = cardSize ? fs.readFileSync(card).subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) : false;
  if (ogHome.file !== 'og/home.jpg' || siteData.ogDefault !== 'og-home' || !cardSize || cardSize.width !== 1200 || cardSize.height !== 630 || !isJpeg || !(cardKb < 300)) failures.push(`[share] the homepage card is public/og/home.jpg, a JPEG of exactly 1200 by 630 under 300 KB (found ${ogHome.file}, ${cardSize ? `${cardSize.width}x${cardSize.height}` : 'missing'}, ${Math.round(cardKb)} KB)`);
  const img = prop(home, 'og:image') || '';
  if (!cardSize || img !== `${ORIGIN}og/home.jpg?v=${sha1(card)}` || named(home, 'twitter:image') !== img || prop(home, 'og:image:width') !== '1200' || prop(home, 'og:image:height') !== '630') failures.push(`[share] the card's URL carries the hash of the file, so a new card gets a new URL, the same for X, at 1200 by 630 (found ${img})`);
  if (ogHome.alt !== ALT || prop(home, 'og:image:alt') !== ALT || named(home, 'twitter:image:alt') !== ALT) failures.push(`[share] the card carries its alt text: ${ALT}`);
  if (fs.existsSync(path.join(root, 'public/og/home.png')) || fs.existsSync(path.join(dist, 'og/home.png'))) failures.push('[hygiene] og/home.png was replaced by og/home.jpg in Social Share Polish V1 and must not ship');
  // Case Study Share Cards (October 2026): each case study keeps its own preview (its title with "| John Cowin", its
  // own description, its clean canonical address for og:url) and now its own designed card, John's approved file
  // byte for byte (pinned here by SHA-256), under a versioned name (og/<slug>-v<n>.jpg, so platforms that cached the
  // typographic PNGs fetch it fresh): a JPEG of exactly 1200 by 630 under 300 KB, its absolute URL on johncowin.com
  // carrying the first ten hex digits of its SHA-1, the same for X with the large image, at 1200 by 630, with the alt
  // text that describes it. Every page's card is its own: no case study falls back to the homepage card. public/og
  // holds exactly the four cards (the PNGs are retired), and scripts/og exactly the five sources og.mjs reads.
  const CASE_CARDS = {
    'creator-campaigns': {
      file: 'og/creator-campaigns-v2.jpg',
      sha256: 'eae517ed215aa6b1c681b80fdf35442fe603375a0aaa0778d154121b4665e867',
      alt: 'Share card for Creator Marketing and Partnerships: prints from Costa Rica, Singapore, and Mykonos around an illustrative coastal villa, under the headline Creator campaigns, built to travel.',
    },
    'technical-marketing': {
      file: 'og/technical-marketing-v2.jpg',
      sha256: 'd0fc1c6fbce6d8fcc9a71fb0bd1010f79c53c8434adea914a8dd1d840ddbc13f',
      alt: 'Share card for Technical Product Marketing: an isometric system in which interviews, research, and analysis feed a shared product language at its center, which carries through to the website, documentation, and campaigns, beside the headline Building the system behind the message.',
    },
    'events-video': {
      file: 'og/events-video-v2.jpg',
      sha256: 'ded11f5a65d493dc44c6dec5a519524f079feb5b4fe08da330b4d2637f878333',
      alt: 'Share card for Events and Multimedia Production: a program-monitor still from the Sui Fest event film, an entrance corridor in neon light, with the sequence Secure, Build, Capture, Cut, Amplify.',
    },
  };
  const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const caseImages = [];
  for (const [slug, want] of Object.entries(CASE_CARDS)) {
    const page = fs.readFileSync(path.join(dist, `work/${slug}/index.html`), 'utf8');
    const t = ent((page.match(/<title>([^<]*)<\/title>/) || [])[1]);
    const desc = named(page, 'description');
    const canonical = (page.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
    if (!/ \| John Cowin$/.test(t || '') || prop(page, 'og:title') !== t || named(page, 'twitter:title') !== t || prop(page, 'og:description') !== desc || named(page, 'twitter:description') !== desc) failures.push(`[share] ${slug}: the case study keeps its own preview (its title and description)`);
    if (canonical !== `${ORIGIN}work/${slug}/` || prop(page, 'og:url') !== canonical) failures.push(`[share] ${slug}: the canonical address and og:url stay the clean ${ORIGIN}work/${slug}/ (found ${canonical}, ${prop(page, 'og:url')})`);
    const own = cardManifest.find((a) => a.id === `og-${slug}`) || {};
    const fm = fs.readFileSync(path.join(root, 'src/content/work', `${slug}.mdx`), 'utf8').split('---')[1] || '';
    if ((fm.match(/^ogAsset:\s*"([^"]*)"\s*$/m) || [])[1] !== `og-${slug}` || own.type !== 'og') failures.push(`[share] ${slug}: its frontmatter names its own card (ogAsset: og-${slug})`);
    const file = path.join(root, 'public', own.file || '-');
    const size = fs.existsSync(file) ? imageSize(file) : null;
    const kb = size ? fs.statSync(file).size / 1024 : 0;
    const jpeg = size ? fs.readFileSync(file).subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) : false;
    if (own.file !== want.file || own.filename !== own.file || !new RegExp(`^og/${slug}-v\\d+\\.jpg$`).test(own.file || '') || !size || size.width !== 1200 || size.height !== 630 || !jpeg || !(kb < 300)) failures.push(`[share] ${slug}: its card is public/${want.file}, a versioned JPEG of exactly 1200 by 630 under 300 KB (found ${own.file}, ${size ? `${size.width}x${size.height}` : 'missing'}, ${jpeg ? 'JPEG' : 'not a JPEG'}, ${Math.round(kb)} KB)`);
    if (!size || sha256(file) !== want.sha256 || !fs.existsSync(path.join(dist, want.file)) || sha256(path.join(dist, want.file)) !== want.sha256) failures.push(`[share] ${slug}: ${want.file} is John's approved card, byte for byte, in public and in the build (SHA-256 ${want.sha256.slice(0, 12)}…); a new design needs a new versioned name and a new pin`);
    const img = prop(page, 'og:image') || '';
    caseImages.push(img);
    if (!size || img !== `${ORIGIN}${want.file}?v=${sha1(file)}` || named(page, 'twitter:image') !== img || prop(page, 'og:image:width') !== '1200' || prop(page, 'og:image:height') !== '630' || named(page, 'twitter:card') !== 'summary_large_image') failures.push(`[share] ${slug}: og:image and twitter:image are its own card's absolute URL with the file's hash, at 1200 by 630, with the large X card (found ${img})`);
    if (own.alt !== want.alt || prop(page, 'og:image:alt') !== want.alt || named(page, 'twitter:image:alt') !== want.alt) failures.push(`[share] ${slug}: the card carries its alt text: ${want.alt}`);
  }
  if (new Set(caseImages).size !== caseImages.length || caseImages.includes(prop(home, 'og:image'))) failures.push('[share] each case study shows its own card: no two share one, and none falls back to the homepage card');
  const ogHave = fs.readdirSync(path.join(root, 'public/og')).filter((f) => f !== '.DS_Store').sort();
  const ogWant = ['home.jpg', ...Object.values(CASE_CARDS).map((c) => path.basename(c.file))].sort();
  const ogBuilt = fs.existsSync(path.join(dist, 'og')) ? fs.readdirSync(path.join(dist, 'og')).filter((f) => f !== '.DS_Store').sort() : [];
  if (ogHave.join() !== ogWant.join() || ogBuilt.join() !== ogWant.join()) failures.push(`[hygiene] public/og and the build's og hold exactly the four cards, ${ogWant.join(', ')} (the typographic PNGs are retired; found ${ogHave.join(', ')} | ${ogBuilt.join(', ')})`);
  // The cards' sources sit beside their renderer, outside src/assets (whose every image the site's asset glob would
  // bundle into the build), and none of them ships.
  const OG_SOURCES = ['creator-print-costa-rica.jpg', 'creator-print-mykonos.jpg', 'creator-print-singapore.jpg', 'events-program.jpg', 'tpm-system.png'];
  const srcDir = path.join(root, 'scripts/og');
  const srcHave = fs.existsSync(srcDir) ? fs.readdirSync(srcDir).filter((f) => f !== '.DS_Store').sort() : [];
  const ogScript = fs.readFileSync(path.join(root, 'scripts/og.mjs'), 'utf8');
  if (srcHave.join() !== OG_SOURCES.join() || OG_SOURCES.some((f) => !ogScript.includes(`'${f}'`))) failures.push(`[share] scripts/og holds exactly the case-study cards' five sources, each read by scripts/og.mjs (found ${srcHave.join(', ') || 'none'})`);
  const stems = OG_SOURCES.map((f) => f.replace(/\.\w+$/, ''));
  const shipped = files.map((f) => path.basename(f)).filter((b) => stems.some((st) => b === st || b.startsWith(`${st}.`)));
  const strayDir = path.join(root, 'src/assets/og');
  const strays = fs.existsSync(strayDir) ? fs.readdirSync(strayDir).filter((f) => f !== '.DS_Store') : [];
  if (shipped.length || strays.length) failures.push(`[hygiene] the share cards' sources stay out of src/assets and out of the build (found ${[...shipped, ...strays.map((f) => `src/assets/og/${f}`)].join(', ')})`);
}

// ------------------------------------------------------------------------------------------------- GoatCounter
// Cleanup V1 (October 2026): one GoatCounter tag per page, in the shared layout's head, pointing at
// jtcowin.goatcounter.com, loaded async; no other analytics or tracking script.
for (const f of htmlFiles) {
  const page = fs.readFileSync(f, 'utf8');
  const rel = path.relative(dist, f);
  const head = (page.match(/<head>[\s\S]*?<\/head>/) || [''])[0];
  const tags = page.match(/<script\b[^>]*data-goatcounter=[^>]*>/g) || [];
  if (tags.length !== 1 || !head.includes(tags[0]) || !tags[0].includes('data-goatcounter="https://jtcowin.goatcounter.com/count"') || !/\basync\b/.test(tags[0]) || !tags[0].includes('src="https://gc.zgo.at/count.js"')) failures.push(`[analytics] ${rel}: exactly one async GoatCounter tag for jtcowin.goatcounter.com in the head (found ${tags.length})`);
  if (/googletagmanager|google-analytics\.com|gtag\(|plausible\.io|umami|clarity\.ms|hotjar|facebook\.net/i.test(page)) failures.push(`[analytics] ${rel}: no analytics or tracking service besides GoatCounter`);
}

// ------------------------------------------------------------------------------------------------- Footer LinkedIn
// John's brief (October 2026): one text link, LinkedIn, in the global footer's links, after Resume and before the
// email, to https://www.linkedin.com/in/johncowin/, opening in a new tab with the safe attributes (and saying so to
// assistive technology). Since Cleanup V1 (October 2026) Contact links it too, as a button beside the resume; those
// are its only two placements (not the header, the Work menu or the hero). Any link on the site that opens a new tab carries noopener and
// noreferrer. Below 30rem the five links take two rows, so the footer's height token adds that row there.
{
  const LINKEDIN = 'https://www.linkedin.com/in/johncowin/';
  const siteData = JSON.parse(fs.readFileSync(path.join(root, 'src/data/site.json'), 'utf8'));
  if (siteData.social?.linkedin !== LINKEDIN) failures.push(`[linkedin] site.json social.linkedin is ${LINKEDIN}`);
  for (const f of htmlFiles) {
    const page = fs.readFileSync(f, 'utf8');
    const rel = path.relative(dist, f);
    const footer = (page.match(/<footer class="site-footer"[\s\S]*?<\/footer>/) || [''])[0];
    const list = (footer.match(/<ul class="site-footer__links"[^>]*>([\s\S]*?)<\/ul>/) || [, ''])[1];
    const items = [...list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    const labels = items.map((li) => textOf(li.replace(/<span class="sr-only"[^>]*>[\s\S]*?<\/span>/g, '')));
    const li = items[3] || '';
    const tag = (li.match(/<a\b[^>]*>/) || [''])[0];
    if (labels.join(' | ') !== 'Work | About | Resume | LinkedIn | jtcowin@yahoo.com') failures.push(`[linkedin] ${rel}: the footer's links read Work, About, Resume, LinkedIn and the email, in that order (found ${labels.join(', ')})`);
    if (!tag.includes(`href="${LINKEDIN}"`) || !/\btarget="_blank"/.test(tag) || !/\brel="noopener noreferrer"/.test(tag) || !/<span class="sr-only"[^>]*>\s*\(opens in a new tab\)<\/span>/.test(li)) failures.push(`[linkedin] ${rel}: the footer's LinkedIn link goes to ${LINKEDIN} in a new tab (target _blank, rel noopener noreferrer) and says so to assistive technology`);
    const toLinkedin = /<a\b[^>]*\bhref="[^"]*linkedin\.com[^"]*"[^>]*>/gi;
    const anywhere = (page.match(toLinkedin) || []).length;
    const inFooter = (footer.match(toLinkedin) || []).length;
    const mentions = (page.match(/linkedin\.com/gi) || []).length;
    const contactSec = (page.match(/<section[^>]*\bid="contact"[\s\S]*?<\/section>/) || [''])[0];
    const contactLink = (contactSec.match(toLinkedin) || [''])[0];
    const inContact = (contactSec.match(toLinkedin) || []).length;
    const want = contactSec ? 2 : 1; // the 404 page has no Contact
    if (anywhere !== want || inFooter !== 1 || inContact !== want - 1 || mentions !== want) failures.push(`[linkedin] ${rel}: LinkedIn is linked once from the footer and once from Contact (where the page has one), nowhere else (found ${anywhere} links to it, ${inFooter} in the footer, ${inContact} in Contact, ${mentions} mentions of linkedin.com)`);
    if (contactSec && (!/\btarget="_blank"/.test(contactLink) || !/\brel="noopener noreferrer"/.test(contactLink) || !/\(opens in a new tab\)/.test(contactSec))) failures.push(`[linkedin] ${rel}: Contact's LinkedIn button opens a new tab safely and says so to assistive technology`);
    for (const a of page.match(/<a\b[^>]*\btarget="_blank"[^>]*>/g) || []) {
      if (!/\brel="[^"]*\bnoopener\b[^"]*"/.test(a) || !/\brel="[^"]*\bnoreferrer\b[^"]*"/.test(a)) failures.push(`[hygiene] ${rel}: a link that opens a new tab needs rel="noopener noreferrer" (${a.slice(0, 120)})`);
    }
  }
  // The footer's height token: four rows below 30rem (the descriptor, the links in two rows with their 0.5rem row
  // gap, the credit), three from 30rem, two from 48rem.
  const footerH = (at) => CSS_RULES.filter((r) => r.sel === ':root' && at(r.at || '')).map((r) => (r.body.match(/--footer-h:\s*([^;]*)/) || [])[1]).filter(Boolean).join(' | ');
  const hPhone = footerH((a) => a === '');
  const hWide = footerH((a) => /min-width:\s*30rem|width\s*>=\s*30rem/.test(a));
  const hDesk = footerH((a) => /min-width:\s*48rem|width\s*>=\s*48rem/.test(a));
  if (!/\b3\s*\*\s*var\(--text-sm\)\s*\*\s*var\(--leading-normal\)\s*\+\s*0?\.5rem\s*\+\s*2\s*\*\s*var\(--space-4\)/.test(hPhone) || !/\b2\s*\*\s*var\(--text-sm\)\s*\*\s*var\(--leading-normal\)\s*\+\s*2\s*\*\s*var\(--space-4\)/.test(hWide) || !/1px\s*\+\s*var\(--text-sm\)\s*\*\s*var\(--leading-normal\)\s*\+\s*var\(--space-4\)/.test(hDesk)) failures.push(`[linkedin] the footer's height token counts the links' second row below 30rem (four rows; three from 30rem, two from 48rem) (found ${hPhone} / ${hWide} / ${hDesk})`);
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
// Ids named by the creator page's data (its hero layers, creators, loops,
// fragments, film, library edits, testimonials and metrics).
for (const m of fs.readFileSync(path.join(root, 'src/data/creator.json'), 'utf8').matchAll(/"((?:cm|cc)-[a-z0-9-]+)"/g)) {
  if (ids.has(m[1])) idRefs.add(m[1]);
  else failures.push(`[manifest] creator.json names "${m[1]}", which is not in assets.json`);
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
      // Every page as it stands: the homepage's opening sequence (decorative and
      // passing) is held still and scanned on its own below, so the scan never
      // lands on a word halfway through a fade.
      await ctx.addInitScript(() => {
        try {
          sessionStorage.setItem('jc-intro', '1');
        } catch (e) {}
      });
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
      // The opening sequence, held at the note, early and late in its fully legible
      // time (from the timing above).
      for (const t of INTRO_MOMENTS.length === 2 ? INTRO_MOMENTS : [700, 1750]) {
        const ictx = await browser.newContext({ viewport });
        const ipage = await ictx.newPage();
        await ipage.goto(PREVIEW, { waitUntil: 'load' });
        await ipage.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }), t);
        const results = await new AxeBuilder({ page: ipage }).include('[data-intro]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
        for (const v of results.violations) {
          const targets = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ');
          failures.push(`[axe:${viewport.width}] / (the opening sequence at ${t} ms) ${v.id} (${v.impact}): ${v.help} -> ${targets}`);
        }
        await ictx.close();
      }
    }
    await browser.close();
    axeRan = true;
  }
} catch (e) {
  notes.push(`[axe] skipped: ${e.message}`);
}

// ----------------------------------------------------------------- report
console.log(`\nChecked ${htmlFiles.length} HTML pages, ${seen.size} internal URLs, ${manifest.assets.length} manifest entries${axeRan ? ', axe scan on 5 pages x 2 viewports and the opening sequence at 2 moments x 2' : ''}.`);
for (const n of notes) console.log('note ', n);
if (failures.length) {
  for (const f of failures) console.log('FAIL ', f);
  console.log(`\n${failures.length} failure(s).`);
  process.exit(1);
}
console.log('All checks passed.');
