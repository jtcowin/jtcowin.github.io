# John Cowin — Portfolio

Marketing portfolio for John Cowin, built with [Astro](https://astro.build) and published with GitHub Pages.
Static output only: no database, CMS, authentication, or server code. All copy lives in JSON and MDX,
and every image, video still, logo, and metric on the site resolves through one asset manifest, so
content and media can be updated through GitHub without touching layout code.

**Status: Version 1.5.** Layout, copy, motion, metadata, approved media, and deployment are
complete. Placeholders render only in `npm run dev`; production builds hide any asset that is not both
approved and present, so an unresolved entry never reaches the public site (see
[Replacing placeholders](#replacing-placeholders)).

Version 1.5 introduced a visual system drawn from the hero portrait: a small palette of charcoal,
cool stone, slate, bone and blue-teal; six numbered surfaces handed out by page position; a heavy
semi-condensed display face with Manrope for everything read closely; and a wide editorial canvas.
The homepage is now hero, About (with the career timeline), the trust band, Selected Work, What I Do, How I
Work, Contact. Version 1.6 reworked About: the narrative names the company but no individual products,
the resume button sits beneath the thesis, the career snapshot became a horizontal timeline of three
chapters whose descriptions open on demand, and the trust bar became its own centered band between
About and Selected Work. Version 1.4 layered the hero so the moving name runs behind the subject, and Version 1.3
introduced the full-viewport photograph and the photographic favicon.

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
npm run og         # regenerate social-preview images (needs Playwright's Chromium)
npm run verify     # link, guardrail, manifest, and accessibility checks against dist/ (run preview first)
npm run shots      # screenshots at 375 / 768 / 1280 px into .verify/ (run preview first)
python3 scripts/icons.py   # regenerate the browser icons from the favicon master (needs Pillow)
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
- **Homepage copy** (hero, about, career snapshot, capabilities, how I work, contact): `src/data/home.json`
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

### Browser icons

Every icon comes from one square photographic master at
`src/assets/favicon/john-cowin-favicon-master.png`, which stays out of `public/` so the
full-resolution file is never shipped to visitors. `python3 scripts/icons.py` masks it to the circle
that the portrait sits in, makes everything outside that circle transparent, and writes
`favicon-16/32/48.png`, `favicon.ico`, `apple-touch-icon.png`, and `icon-192/512.png`. The small sizes
crop tighter to the head and are lightly sharpened, because a full head and shoulders is unreadable at
16 pixels. To swap the portrait, replace the master and rerun the script; nothing else needs editing.

### Hero photograph and layering

The homepage hero is the full frame at `src/assets/hero/john-cowin-portrait.png`, used full bleed with
its own setting rather than cut out.

`src/assets/hero/john-cowin-foreground.png` is the same frame with its background removed, layered in
front of the moving name and the rule so the subject occludes them. The two files must stay the same
pixel dimensions and carry identical `object-fit` and `object-position` rules, or the subject will not
register with the frame behind him. To change the photograph, replace both and re-derive the cutout.
The moving name loops by duplicating its own track and translating it by exactly half, so the restart
lands on identical pixels; changing the number of repeats per group keeps that true automatically.

Below 75rem the subject spans the full width at the rule's height, so a rule behind him would be
invisible end to end. At those widths the same rule is drawn in front instead. This is the one place
the layering is relaxed, and it is a deliberate legibility decision. Responsive derivatives stop at the source's own 1536px width
rather than upscaling. `object-position` is set per breakpoint: tall viewports crop horizontally and
hold the face at 34% across, wide viewports crop vertically and hold the frame high. Three gradients,
not panels, carry the contrast for the name, the header, and the descriptor; their stops are tuned
against measured contrast on the photograph itself, so changing the photograph means re-measuring
them.

## Visual system

### Palette

Built from the hero portrait, not an external reference. Components never use these values directly;
they use semantic tokens (`--bg`, `--ink`, `--ink-2`, `--ink-3`, `--heading`, `--accent`, `--focus`,
`--line`) that each surface redefines.

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#0D0F10` | Dark surface, primary text on light |
| Warm bone | `#F3EFE8` | Main light surface |
| Fog | `#EDF0EF` | Cool light surface, text on dark |
| Deep slate | `#25313A` | Headings on light surfaces |
| Steel | `#7E8995` | Secondary text on dark surfaces only |
| Pale slate | `#DDE2E3` | Soft surface |
| Blue-teal | `#1F4546` | Brand surface, links and details on light |
| Muted aqua | `#4F918A` | Focus and accents on dark surfaces |

Five pairings the palette suggests fail WCAG, so the site routes around them rather than shipping them:

| Pairing | Ratio | Instead |
| --- | --- | --- |
| Steel text on warm bone | 3.1:1 | Deepened steel `#4E5862`, 6.3:1 |
| Muted aqua text on warm bone | 3.2:1 | Blue-teal for links, 9.2:1 |
| Muted aqua focus ring on pale slate | 2.8:1 | Blue-teal focus on all light surfaces |
| Steel text on blue-teal | 3.0:1 | Light slate `#C3CACB`, 6.3:1 |
| Muted aqua focus ring on blue-teal | 2.9:1 | Light aqua `#9FC9C3`, 5.8:1 |

Every other text and control pairing clears 4.5:1 for text and 3:1 for focus and control borders on
every surface and on all three work cards.

### Numbered surfaces

A section's color comes from its position, not its identity. `src/pages/index.astro` hands each
chapter the next surface from one ordered list; reorder the chapters and their colors follow.

| # | Surface | Currently |
| --- | --- | --- |
| 01 | Image | Hero |
| 02 | Light (warm bone) | About and the career timeline |
| 03 | Dark (ink) | Selected Work and the visual rail |
| 04 | Soft (pale slate) | What I Do |
| 05 | Brand (blue-teal) | How I Work |
| 06 | Light return (fog) | Contact and the footer |

Past six, the sequence continues from dark, soft and light rather than starting another photograph.

The trust bar between About and Selected Work is a transition band rather than a chapter. It keeps its
own `band` surface (the pale slate tokens), so it reads apart from the warm About above it and the ink
work chapter below it, and it is not counted in the sequence.

The header has no surface of its own. A script watches a one-pixel line through its middle, and
whichever surface crosses that line lends the header its background, text, rule and focus tokens, so
each pill matches the ground it sits on and the switch happens exactly at the boundary.

### Type

- Display: Archivo at 700 and 86% width. Archivo Black was tested first; fitted to one line it came out
  about three quarters the size and read as the loudest option.
- Everything read closely, including navigation and labels: Manrope.
- The hero name keeps its approved Archivo Medium 500 at normal width.
- The serif and the monospace face are retired, and their packages were removed. `scripts/og.mjs`
  renders the social-preview cards in Archivo and Manrope on the same palette: the home card echoes the
  hero (name, rule, arrow and descriptor on the dark ground), and each case-study card uses the tone of
  its panel in the work rail. Card titles come from the current page titles, so rerun `npm run og`
  whenever a title changes.

## Content guardrails

The verify script fails the build check if any of these appear in the output: the `@johnboycrypto`
handle, the unverified 524% Trezor lift claim, any mention of Sui Network negotiations, "17 unique
creators," invented senior titles, raw internal links, the word "client" (logo-bar organizations are
employers, products, co-sponsors, and events, not clients), em dashes, a location-level impressions
figure, or a published count of active workflows. (Since Version 1.6 the homepage states no formal
title; the only formal title for the Phi Labs role is still "Social Media Manager", on the resume.) It
also confirms the word "approximate" on the aggregate impressions figure, the 1.25M aggregate,
and the approved How I Work, contact, trust-bar, and footer lines are present.

The About checks (Version 1.6): the narrative columns name Phi Labs Global, in plain text, and no
individual product, and the resume button sits in the third column beneath the thesis. The career
timeline has three chapters and three nodes, NOW to EARLIER, numbered 01 to 03: Phi Labs Global (one
heading, marked current and spanning two columns, holding Current scope and Original mandate), Web3
Marketing Consulting (Select DeFi Projects), and Independent Music and Business Operator (Global Music
Project). Every label sits beneath its heading, every description matches the approved copy and has an
id for its toggle, Original mandate opens with the official title, Current scope does not say
"production", the music entry does not say "independent", and nothing says "publishing calendars". The
trust bar is its own band after About and reads "Select Companies, Products, and Partners".

### Career timeline

- Three chapters, NOW to EARLIER. Wide screens (72rem and up) draw one horizontal rule with a node and
  a stem for each chapter over four equal columns: Phi Labs Global spans the first two, with a rule under
  its heading across both of its phases and a hairline between them; the other chapters take one column
  each. The chapters, phases and list share rows (nested subgrid), so markers, headings, labels and
  descriptions line up even when a heading wraps. Narrower screens stack the same order on a vertical
  rule.
- The current node is filled blue-teal with a narrow halo. Earlier nodes are outlined and recede from
  deep slate to steel; marker tones stay at or above 4.5:1 on the light surface and outlines at or above
  3:1. The rule fades from blue-teal to pale slate. Markers are the typographic 01 to 03, never icons or
  logos. Labels are flat tinted pills.
- Progressive disclosure. The HTML carries every description, so without JavaScript all of them are
  visible. The inline script then turns each label into a button (`aria-expanded`, `aria-controls`, a
  ringed plus as the cue, and an accessible name that includes the chapter) and closes the descriptions:
  - Wide screens keep the description row's height at rest, so hovering an entry or reaching its button
    by keyboard previews the description in place (a clip from the top and a fade) without moving
    anything. Clicking or tapping the entry, or pressing Enter or Space, pins it open; the cue turns to a
    minus and the tint firms up. Clicking the label again, or Escape, closes it.
  - Below 72rem each phase is an accordion: tap, click, Enter or Space opens and closes it. Only the
    content after the tapped label moves; entries open independently, so nothing above ever collapses.
  - Open entries sit on a light tint drawn by a pseudo-element, outside the layout. With reduced motion
    every change is immediate. In print every description is shown.
- Motion runs once: the first time the timeline enters the viewport the rule draws, then the chapters
  appear from current to earliest. It is armed only when IntersectionObserver exists and reduced motion
  is off, so without JavaScript, with reduced motion, or in print the timeline is complete and static.

## Project structure

```
astro.config.mjs        Astro config (site/base from site.config.mjs, MDX, sitemap)
site.config.mjs         Deployment target: user site, project site, or custom domain
public/                 Static files copied as-is (favicons, OG images, resume, CNAME)
scripts/                og.mjs (social previews), icons.py (browser icons), verify.mjs (checks),
                        shots.mjs (screenshots)
src/
  content.config.ts     Case-study collection schema
  content/work/*.mdx    Case studies
  data/                 site.json, home.json, logos.json, assets.json
  lib/                  paths.ts (base-path helpers), assets.ts (manifest resolution)
  styles/global.css     Tokens, typography, buttons, motion
  layouts/              BaseLayout (metadata, header, footer), CaseStudyLayout
  components/           Hero, Media, LogoBar, ProofStrip, WorkPanels, WorkRail, Capabilities,
                        HowIWork, About, Contact, …
  components/casestudy/ Section, Stats, MediaGrid, Gallery, Activation, Creators, …
  pages/                index, work/[slug], 404, robots.txt, site.webmanifest
```
