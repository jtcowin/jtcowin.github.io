# John Cowin — Portfolio

Marketing portfolio for John Cowin, built with [Astro](https://astro.build) and published with GitHub Pages.
Static output only: no database, CMS, authentication, or server code. All copy lives in JSON and MDX,
and every image, video still, logo, and metric on the site resolves through one asset manifest, so
content and media can be updated through GitHub without touching layout code.

**Status: Draft 1.** Layout, copy, motion, metadata, and deployment are complete. Media are labeled
placeholders until real assets are approved and added (see [Replacing placeholders](#replacing-placeholders)).

## Routes

| Route | Source |
| --- | --- |
| `/` | `src/pages/index.astro` + `src/data/home.json` |
| `/work/creator-campaigns/` | `src/content/work/creator-campaigns.mdx` |
| `/work/technical-marketing/` | `src/content/work/technical-marketing.mdx` |
| `/work/events-video/` | `src/content/work/events-video.mdx` |
| `/resume/John-Cowin-Resume.pdf` | `public/resume/John-Cowin-Resume.pdf` (**not yet added**, see below) |
| `/404.html` | `src/pages/404.astro` |
| `/robots.txt`, `/sitemap-index.xml`, `/site.webmanifest` | generated at build time |

## Local preview

Requires Node 22.12 or newer.

```bash
npm install
npm run dev        # http://localhost:4321/
```

Other scripts:

```bash
npm run build      # production build into dist/
npm run preview    # serve dist/ locally (same base path as production)
npm run check      # TypeScript / Astro diagnostics
npm run og         # regenerate social-preview images and PNG icons (needs Playwright's Chromium)
npm run verify     # link, guardrail, manifest, and accessibility checks against dist/ (run preview first)
npm run shots      # screenshots at 375 / 768 / 1280 px into .verify/ (run preview first)
```

Playwright is only used by the `og`, `verify`, and `shots` scripts. If it complains about a missing
browser, run `npx playwright install chromium` once.

## Publishing

Deployment is automated by `.github/workflows/deploy.yml`: every push to `main` builds the site and
publishes it to GitHub Pages.

One-time setup in the repository settings: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
After the first successful run the site is live at `https://jtcowin.github.io/`.

Because the repository is named `jtcowin.github.io`, GitHub treats it as a **user site** and serves it from
the root of the domain. The build reflects that: the base path is `/`, so pages are at `/work/...`, not
`/<repo>/work/...`. `site.config.mjs` derives this from the repository name, so renaming the repo to
something else (making it a project site) only requires updating `GITHUB_REPO` there.

### Custom domain (later)

1. Point the domain's DNS at GitHub Pages: four `A` records for the apex domain
   (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and a `CNAME`
   record for `www` pointing at `jtcowin.github.io`.
2. In the repository: **Settings → Pages → Custom domain**, enter the domain, save, and tick
   **Enforce HTTPS** once GitHub finishes verifying DNS.
3. Create `public/CNAME` containing the bare domain, e.g. `johncowin.com`, and push. The build detects
   that file and switches the canonical site URL to `https://<domain>/`. The base path is already `/`,
   so no links change. Nothing in `src/` needs editing.

Steps 2 and 3 should happen close together so the canonical URLs and the served domain agree.

`site.config.mjs` holds this logic. `SITE_URL` and `BASE_PATH` environment variables override it if ever needed.

## Editing content

- **Site-wide** (name, email, nav, resume path, footer): `src/data/site.json`
- **Homepage copy** (hero, proof strip, capabilities, about, career snapshot, contact): `src/data/home.json`
- **Case studies**: `src/content/work/*.mdx`. Frontmatter holds the page metadata, hero copy, results,
  and the homepage card; the body holds the narrative sections using the components in
  `src/components/casestudy/`. Section ordering, headings, and copy are all editable in the MDX.
- **Credibility bar logos**: `src/data/logos.json`
- **Accent color and design tokens**: `src/styles/global.css` (`--accent` is a single token)

## Replacing placeholders

Everything visual goes through `src/data/assets.json`. Each entry has an `id`, the page and section it
belongs to, its `type`, `aspect` ratio, a suggested `filename`, `alt` text, `source`, `permission`
status (`pending`, `approved`, `redacted`, or `private-only`), and a `credit` line.

To replace a placeholder with a real asset:

1. **Images, stills, artifacts, slides, analytics, article cards** — save the file under `src/assets/`
   using the suggested `filename` (for example `src/assets/hero/documentation-panel.png`), then set the
   entry's `file` to that relative path. The image is optimized and served responsively at build time.
2. **Video** — put the video file in `public/media/` and set `file` to its name; put a poster image
   under `src/assets/` and set `poster`. Videos never autoplay and start muted with controls.
3. **Galleries** (`type: gallery`) — add objects to `items`: `{ "file": "work/creator-campaigns/mykonos-1.jpg", "alt": "…", "credit": null }`.
   Any unfilled `slots` keep rendering as placeholders.
4. **Logos** — add a monochrome SVG or PNG to `src/assets/logos/`, set `file` in `logos.json`, and set
   `permission` to `approved`. Logos render as text wordmarks until approved.
5. **Testimonial** — set `quote` and change `permission` to `approved`. Nothing is shown until then.
6. **Live link** (`tm-link-docs`) — set `permission` to `approved` to make it clickable.
7. **Metrics** (`hero-metric`) — edit `value` and `metricLabel`.

Set `permission` to `private-only` on anything that must never render even if a file is present.
The build will crop real media to the entry's aspect ratio with `object-fit: cover`.

Optional entries (`about-headshot`, `tm-website-before-after`) render only once a file is supplied.

### Resume

Add the PDF at exactly `public/resume/John-Cowin-Resume.pdf`. All "Download resume" links already point
there; until the file exists they return a 404. To rename it, change `resumePath` in `src/data/site.json`.

### Social-preview images

`public/og/*.png` are typographic cards generated from the site's own fonts and tokens by
`npm run og`. Replace them with custom artwork at 1200×630 if preferred; the manifest entries
(`og-home`, `og-creator-campaigns`, …) point at them.

## Content guardrails

The verify script fails the build check if any of these appear in the output: the `@johnboycrypto`
handle, the unverified 524% Trezor lift claim, any mention of Sui Network negotiations, "17 unique
creators," invented senior titles, raw internal links, or the word "client" (logo-bar organizations are
employers, products, co-sponsors, and events, not clients). It also confirms the official title
"Social Media Manager" and the word "approximate" on the 1.22M figure are present.

Before publishing new media, confirm permission for: Trezor testimonial and comparison, all logos,
creator likenesses (names and handles only until approved), and any internal document recreations
(redacted only).

## Project structure

```
astro.config.mjs        Astro config (site/base from site.config.mjs, MDX, sitemap)
site.config.mjs         Deployment target: user site, project site, or custom domain
public/                 Static files copied as-is (favicons, OG images, resume, CNAME)
scripts/                og.mjs (previews/icons), verify.mjs (checks), shots.mjs (screenshots)
src/
  content.config.ts     Case-study collection schema
  content/work/*.mdx    Case studies
  data/                 site.json, home.json, logos.json, assets.json
  lib/                  paths.ts (base-path helpers), assets.ts (manifest resolution)
  styles/global.css     Tokens, typography, buttons, motion
  layouts/              BaseLayout (metadata, header, footer), CaseStudyLayout
  components/           Hero, Media (placeholder/real media), LogoBar, WorkCard, …
  components/casestudy/ Section, Stats, MediaGrid, Gallery, Activation, Creators, …
  pages/                index, work/[slug], 404, robots.txt, site.webmanifest
```
