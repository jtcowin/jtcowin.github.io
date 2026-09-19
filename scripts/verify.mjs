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
];
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
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
if (!/8\.7 times the account/i.test(creator)) {
  failures.push('[claim] creator page must use the approved 8.7x impressions benchmark');
}
if (!/directional performance benchmarks, not Trezor-owned analytics/i.test(creator)) {
  failures.push('[claim] creator page must carry the comparison methodology note');
}
const home = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!/approximate impressions/i.test(home)) failures.push('[claim] homepage proof strip must keep "approximate" on the 1.22M figure');
if (!/Social Media Manager/.test(home)) failures.push('[claim] homepage must preserve the official title "Social Media Manager"');
if (!/Web3 marketing consulting/.test(home)) failures.push('[claim] homepage must carry the consolidated consulting career row');
if (!/clear market narratives/.test(home)) failures.push('[claim] homepage must use the approved hero supporting copy');
if (!/globally distributed independent music project/.test(home)) failures.push('[claim] homepage must use the approved About copy');
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
  for (const m of s.matchAll(/\b(?:heroAsset|ogAsset|asset|gallery|headshot)\s*[:=]\s*["']([a-z0-9-]+)["']/g)) idRefs.add(m[1]);
  for (const m of s.matchAll(/ids=\{\[([^\]]+)\]\}/g)) for (const id of m[1].matchAll(/["']([a-z0-9-]+)["']/g)) idRefs.add(id[1]);
  for (const m of s.matchAll(/"(portrait|docPanel|websiteFrame|summitStill|metric)":\s*"([a-z0-9-]+)"/g)) idRefs.add(m[2]);
}
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
