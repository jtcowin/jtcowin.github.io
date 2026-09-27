# John Cowin — Portfolio

Marketing portfolio for John Cowin, built with [Astro](https://astro.build) and published with GitHub Pages.
Static output only: no database, CMS, authentication, or server code. All copy lives in JSON and MDX,
and every image, video still, logo, and metric on the site resolves through one asset manifest, so
content and media can be updated through GitHub without touching layout code.

**Status: Version 1.7, in review.** Version 1.7 is committed locally and not pushed: the About
spacing, the Select Work card template, the reel's behavior and the combined section are to be
reviewed together first, and the reel still shows placeholder frames (`npm run verify -- --release`
fails until they are replaced). Otherwise placeholders render only in `npm run dev`; production builds
hide any asset that is not both approved and present, so an unresolved entry never reaches the public
site (see [Replacing placeholders](#replacing-placeholders)).

Version 1.7 orders the homepage as hero, About with the trust bar, Select Work, a wordless three-row
work reel, From positioning to production (What I Do and How I Work in one frame), and Contact. About
takes the revised copy with more negative space: the body copy is 5% smaller, the measure is about the
headline's width so the paragraphs take two, three and two lines, and the headline sits about 20px
higher than in Version 1.6. Select Work is an equal-size visual catalog in one card template that
stacks as you scroll, with a muted loop in a dominant panel that plays only while its card is active.
The separate How I Work section and its AI-centered treatment are gone; AI now appears only in a short
working-style statement.

Version 1.5 introduced a visual system drawn from the hero portrait: a small palette of charcoal,
cool stone, slate, bone and blue-teal; six numbered surfaces handed out by page position; a heavy
semi-condensed display face with Manrope for everything read closely; and a wide editorial canvas.
At that point the homepage ran hero, About (the narrative and the trust bar), Selected Work, What I
Do, How I Work, Contact. The About section was then finalized as one desktop frame: the static headline,
three paragraphs (the music and business foundation, the move to Phi Labs Global, and a larger
concluding line) with three blue-teal highlights, the resume button on the closing row, a thin rule,
and the trust bar in one centered row. Its words flow in once, in reading order, as About comes into
view. The career timeline, the three-column layout, the separate trust band and the type-on caret are
gone. Version 1.4 layered the hero so the moving name runs behind the subject, and Version 1.3
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
- **Homepage copy** (hero, About, the Select Work title and intro, the reel's frames, the combined
  section's headline, How I Work statement, capability groups and Stack, contact): `src/data/home.json`.
  The Stack's tool marks: `src/data/stack-icons.json`.
- **Case studies**: `src/content/work/*.mdx`. Frontmatter holds the page metadata, hero copy, results,
  and the homepage card; the body holds the narrative sections using the components in
  `src/components/casestudy/`. Section ordering, headings, and copy are all editable in the MDX. The
  `card` block drives the Select Work card: `category`, `title`, a one-sentence `subline` (95 to 130
  characters), `linkLabel`, and `media` (`main`, an optional `motion` loop, two `side` ids, optional
  `fallback` stand-ins, and optional `focus`).
- **Credibility bar logos**: `src/data/logos.json`
- **Accent color and design tokens**: `src/styles/global.css` (`--accent` is a single token)

## Replacing placeholders

Everything visual goes through `src/data/assets.json`. Each entry has an `id`, the page and section it
belongs to, its `type`, `aspect` ratio, a suggested `filename`, `alt` text, `source`, `permission`
status (`pending`, `approved`, `redacted`, or `private-only`), and a `credit` line.

To replace a placeholder with a real asset:

1. **Images, stills, artifacts, slides, analytics, article cards**: save the file under `src/assets/`
   using the suggested `filename` (for example `src/assets/hero/documentation-panel.png`), then set the
   entry's `file` to that relative path. The image is optimized and served responsively at build time.
2. **Video**: put the video file in `public/media/` and set `file` to its name; put a poster image
   under `src/assets/` and set `poster`. Case-study videos never autoplay and start muted with
   controls. The one exception is a Select Work card's dominant-panel loop (`card.media.motion`),
   which plays muted, without controls, only while its card is active (see Select Work below).
3. **Galleries** (`type: gallery`): add objects to `items`: `{ "file": "work/creator-campaigns/mykonos-1.jpg", "alt": "…", "credit": null }`.
   Any unfilled `slots` keep rendering as placeholders.
4. **Logos**: add a monochrome SVG or PNG to `src/assets/logos/`, set `file` in `logos.json`, and set
   `permission` to `approved`. Logos render as text wordmarks until approved.
5. **Testimonial**: set `quote` and change `permission` to `approved`. Nothing is shown until then.
6. **Live link** (`tm-link-docs`): set `permission` to `approved` to make it clickable.
7. **Metrics** (`hero-metric`): edit `value` and `metricLabel`.
8. **Select Work card visuals**: set asset ids in the case study's `card.media`. A slot whose asset is
   not approved and present shows its `fallback` stand-in (`activations`, `impressions` or
   `cosponsors`, drawn only from approved facts) or a quiet empty tone, and the real image replaces
   it as soon as the manifest entry has a file. `focus` sets the `object-position` for each slot, in
   the order main, first side, second side, for an image its panel has to crop.
9. **Reel frames**: in `home.json` under `reel.rows[].frames`, replace a `{ "ratio": "16:9" }` or
   `{ "ratio": "1:1" }` placeholder with `{ "asset": "<id>" }` for an approved still of that shape.
   Keep each row's pattern of wide and square frames so the rows stay balanced.
   `npm run verify -- --release` fails while any placeholder frame remains.

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
| 02 | Light (warm bone) | About: the narrative and the trust bar |
| 03 | Dark (ink) | Select Work and the work reel |
| 04 | Soft (pale slate) | From positioning to production |
| 05 | Brand (blue-teal) | Contact and the footer |
| 06 | Light return (fog) | Not used since Version 1.7 |

Past six, the sequence continues from dark, soft and light rather than starting another photograph.

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
  its Select Work card. Card titles come from the current page titles, so rerun `npm run og`
  whenever a title changes.

## Content guardrails

The verify script fails the build check if any of these appear in the output: the `@johnboycrypto`
handle, the unverified 524% Trezor lift claim, any mention of Sui Network negotiations, "17 unique
creators," invented senior titles, raw internal links, the word "client" (logo-bar organizations are
employers, products, co-sponsors, and events, not clients), em dashes, a location-level impressions
figure, a published count of active workflows, or "community strategy" (John did not lead a community
function in this B2B role, so the portfolio does not imply one). (Since Version 1.6 the homepage states
no formal title; the only formal title for the Phi Labs role is still "Social Media Manager", on the
resume.) It also confirms the approved creator-page claims and the approved contact, trust-bar and
footer lines.

The Version 1.7 checks: the homepage order (hero, About, Select Work, the reel, the combined section,
Contact) and its four surfaces; "Select Work" and its intro; three cards in the approved order, each
with its number and category, the approved title and subline (one sentence, 95 to 130 characters, 12
to 16 words), one dominant and two supporting panels, exactly one link, and no metric other than the
creator stand-in's "Approximately 1.25M impressions"; a card loop that is muted, inline, looping, has
a poster, loads nothing up front and carries its pause control; a reel with no visible text, a hidden
heading, and rows moving right, left, right (placeholder frames are noted, and fail with `--release`);
and the combined section's headline, labels, four capability groups, three Stack groups, 12 to 15
tools, no certificate column, a How I Work statement of 60 words at most, and none of the retired
AI-centered copy.

The About checks: three paragraphs in the approved copy, every word in its own span; exactly three
highlights, in order ("globally distributed music project", "more than 200,000 people", "market
narratives") and nothing else emphasized or bold, Phi Labs Global included; no individual product named
in the narrative; the resume button on the closing row after the third paragraph; none of the earlier
About copy or its music metrics (80+ countries, 140+ shows, "professionally managed"); no em dash; the
lower rule and then the trust bar inside About with no surface of their own; the trust-bar heading
"Select Companies, Products, and Partners"; and no class or attribute left over from the retired
timeline, columns, band or type-on caret. The homepage no longer states a formal title; the only
formal title for the Phi Labs role is still "Social Media Manager", on the resume.

### About narrative and motion

- One frame: from 64rem the complete section (headline, three paragraphs, resume button, trust-bar
  title and every logo and label) fits one screen when About is aligned to the top, as it is after a
  click on the About link. Type and spacing scale with the smaller of the viewport's width and its
  height read as a 16:9 frame (`--fit`), the section is one screen tall, and its top padding reserves
  the floating header's height (`--nav-h`, shared with the header). Spare height is shared evenly
  above and below the content, which is then drawn up by `--about-lift`, so the headline sits about
  20px higher than in Version 1.6's centered frame wherever there is room (at 1280x720 and 1366x768 it
  already sat directly under the header, and stays there). About
  cancels the usual in-page link offset (`--scroll-pad`) so it lands flush with the top. Checked at
  1280x720, 1440x900 and 1920x1080, and at common laptop windows such as 1366x768, 1536x730 and
  1440x790. Phones and tablets stack and scroll naturally.
- Type: paragraphs are Archivo at 440 on a 44em desktop measure, about the headline's width, so they
  take two, three and two lines with the same breaks at every desktop size (36em below 64rem);
  the concluding paragraph is a step larger at 560 in the heading color, with the resume button at the
  right edge of its row; the highlights are blue-teal at 600, 9.2:1 on the light surface. The trust bar
  keeps its contents, order, labels and monochrome marks, with its rhythm tightened through
  `--logobar-slot`, `--logobar-label-gap` and `--logobar-head-gap`, and holds one row from 72rem.
- Motion, once: shortly after the story is well in view, its words flow in, in reading order. Each word
  fades from 0 to 1 while it rises 8px and sharpens from a 3px blur (380ms, ease-out), starting before
  the word ahead of it has settled; the pace eases in and out over the whole copy, with a breath of
  about 140ms between paragraphs, and the copy is complete in 2.3 seconds. The resume button and the
  trust bar fade in as the last paragraph resolves. No caret. When the story is taller than the screen
  (small phones, short windows) each paragraph flows in as it is reached.
- Nothing moves while it plays: every word is its own span in the HTML from the start, laid out in its
  final place; while a paragraph flows its words take their own boxes, which fall exactly where the
  words already sit (each word is shaped on its own, so no kern can shift a line when the flow ends).
  The text is never rewritten, so screen readers, selection and search always see the plain copy. A
  keyboard focus inside About, the start of a text selection, a width change, or switching on reduced
  motion shows everything at once.
- The complete text is in the HTML throughout. Without JavaScript, with reduced motion, without
  IntersectionObserver, or in print, everything is shown immediately.

### Select Work

- One template and one size for every card: number and category, title, a one-sentence subline, one
  dominant panel, two supporting panels, and one case-study link (the title is the link and the whole
  card is its target; "View case study" is its visible label, beside the head on desktop and last on
  phones). Metrics live on the case-study pages; while the creator photographs are pending, that
  card's typographic stand-ins carry the one approved aggregate.
- From 60rem the cards stack as you scroll with plain `position: sticky`: each parks `--peek` (14px)
  lower than the one before, so the earlier cards' top edges stay in view and none is ever fully
  covered. A covered card recedes 4% and its pictures dim; its text keeps full contrast. The parked
  stack sits centered in the screen below the header, and every card is one height: the screen less
  the header and the stack's edges, capped at 52% of the canvas width so the dominant panel stays near
  16:9. Phones, tablets and reduced motion read as an ordinary sequence.
- Motion: a dominant panel may carry a muted loop (`card.media.motion`; currently the Bolt website
  hero). It is `muted`, `playsinline` and `loop`, shows its poster, and loads nothing until its card
  first becomes active (`preload="none"`). Only the active card plays; a loop pauses when its card is
  covered or leaves the screen. Reduced motion, data saving and phones get the poster only. A pause
  and play button sits in the panel's corner (the loop runs longer than five seconds), and the
  reader's choice holds from then on. Supporting panels stay still.

### Work reel

- A wordless transition between Select Work and the combined section: three rows of frames that move
  sideways with the scroll, right, left, right, at related speeds (1, 0.8 and 1.2). The travel is
  short (16% of the width across the whole pass, 10% on phones, where the frames are also larger
  relative to the screen) and nothing moves on its own; each row is laid out twice end to end, so no
  track edge ever shows. A visually hidden heading names it; there is no visible title or text.
- Frames keep one height and a fixed ratio (16:9 or 1:1), so nothing shifts as images load. Reduced
  motion and no JavaScript show the same rows as a still collage. The frames are placeholders until
  the asset mix is approved (see [Replacing placeholders](#replacing-placeholders)).

### From positioning to production

- What I Do and How I Work in one desktop frame: the headline and the How I Work statement on the
  left, the four capability groups on the right, level with the foot of the statement, and the Stack
  full width below it. The Stack shows 14 tools in three groups, each with its name and, where an
  authentic single-color mark is available (from Simple Icons, CC0; the marks remain their owners'
  trademarks), that mark. Tools without one (ChatGPT, Photoshop, Descript, Typefully) show their
  names only, never a generic icon.
- From 64rem the section scales with `--fit`, as About does, is one screen tall, and keeps its spare
  height mostly below the content. Checked from 1024x768 to 2560x1440; phones and tablets stack.

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
  data/                 site.json, home.json, logos.json, assets.json, stack-icons.json
  lib/                  paths.ts (base-path helpers), assets.ts (manifest resolution)
  styles/global.css     Tokens, typography, buttons, motion
  layouts/              BaseLayout (metadata, header, footer), CaseStudyLayout
  components/           Hero, About, LogoBar, WorkPanels (Select Work), WorkReel,
                        Capabilities (From positioning to production), Contact, Media, …
  components/casestudy/ Section, Stats, MediaGrid, Gallery, Activation, Creators, …
  pages/                index, work/[slug], 404, robots.txt, site.webmanifest
```
