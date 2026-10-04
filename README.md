# John Cowin — Portfolio

Marketing portfolio for John Cowin, built with [Astro](https://astro.build) and published with GitHub Pages.
Static output only: no database, CMS, authentication, or server code. All copy lives in JSON and MDX,
and every image, video still, logo, and metric on the site resolves through one asset manifest, so
content and media can be updated through GitHub without touching layout code.

**Status: Version 2.0, in review.** Version 1.9 and its update are published; Version 2.0 is committed
locally and not pushed until it has been reviewed. Placeholders render only in `npm run dev`; production
builds hide any asset that is not both approved and present, so an unresolved entry never reaches the
public site (see [Replacing placeholders](#replacing-placeholders)).

Version 2.0 puts John's approved video loops on every Select Work tile and gives the trust bar the
Ambur logo. Case Study 01 leads with the Costa Rica aftermovie (13.6 seconds: two approved ranges
joined, from the overhead pool shot to the sky), with the Trezor paper airplane and the Bolt Bus trailer
as secondary tiles. Case Study 02 leads with a new loop of the hero animation, keeps the website hero
motion, and replaces the architecture still with the architecture diagram video, shown whole on its own
plate at the still's scale. Case Study 03 keeps the slippage preview and replaces the Sui Fest stand-in
and the presentation still with loops of the Sui Fest interview and the opening of the Sui Summit
presentation. Every video now sits on a poster cut from its own loop at the loop's exact crop, shown
until the loop plays and again whenever it stops, so a tile is never blank: not before the video loads,
not without JavaScript, and not if a video fails. A primary starts only once its card has reached its
resting place in the stack. The trust bar's Ambur Marketplace entry is now the supplied SVG, unaltered,
sized optically so its capitals share the cap height and baseline of Bolt Liquidity.

Version 1.9 tightens Select Work and closes the page with a full frame. Select Work now starts just
below the header, so its opening view holds the headline, the introduction and the whole first card,
and on tall desktop screens the headline and introduction stay pinned while the cards arrive beneath
them; the complete stack then leaves with them, every card's edge still in view. The How I Work eyebrow
is gone, and each Stack group centers its heading and its tiles. Each case study states John's part in
one "My role:" line under its intro, and the reel stays wordless. Contact and the footer fill the last
screen over a quiet teal grid that brightens slightly around a fine pointer, and the footer credit reads
"© 2026 John Cowin — Built end to end.", whose em dash is the one approved exception besides the hero's
name stream.

The Version 1.9 update gives Select Work its approved media and a stricter playback model, and carries
the Contact grid behind everything. Case Study 02 leads with a 10-second preview of the Bolt hero
animation, with the website hero motion as a secondary tile and the architecture still shown whole on
its own dark plate. Case Study 03 leads with a 9.7-second passage of the slippage explainer, beside a
Sui Fest stand-in and the Sui Summit presentation still, and Case Study 01 keeps its typographic
stand-ins. Only the active card's primary video plays on its own; secondary tiles play only when asked.
The Contact grid now runs as one even field behind the headline, the actions, the navigation and the
footer, and its pointer reveal is five points stronger (17% light aqua instead of 12%), with the brand
surface's small text set a touch lighter so it keeps 4.5:1 beside a lit line.

Version 1.8 refines spacing and interaction and fills the reel and the Stack with approved work. About
reads as three vertical zones: the headline at the top, the story and resume action centered in the
room below it, and the trust bar anchored at the foot with room around its rule. In the combined
section the How I Work statement sets in four even lines and the Stack sits lower, clearly separated
from the upper composition, with 18 tools shown in their own brand artwork on neutral tiles. The
capability icons lift slightly when their row is hovered or focused. Contact takes the approved
headline and subline, and the footer carries the hero's descriptor and one compact credit. The reel
shows 24 approved pieces in three rows of eight, shuffled once per visit and kept for the session.

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
| `/resume/John-Cowin-Resume.pdf` | `public/resume/John-Cowin-Resume.pdf` |
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
- **Homepage copy** (hero, About, the Select Work title and intro, the reel's pool, the combined
  section's headline, How I Work statement, capability groups and Stack, contact): `src/data/home.json`.
  Each Stack tool is `{ "name", "logo", "scale", "shape" }`: `logo` is an SVG under
  `src/assets/stack/`, `scale` (optional, around 0.84 to 1.04) nudges a mark that reads large or small
  so every tile looks the same size, and `"shape": "wide"` sets a horizontal wordmark (MDX) wide
  instead of squeezing it into a square. Capability items take an optional `tilt` in degrees (2 at
  most) for the icon's hover and focus state.
- **Case studies**: `src/content/work/*.mdx`. Frontmatter holds the page metadata, hero copy, results,
  and the homepage card; the body holds the narrative sections using the components in
  `src/components/casestudy/`. Section ordering, headings, and copy are all editable in the MDX. The
  `card` block drives the Select Work card: `category`, `title`, a one-sentence `subline` (95 to 130
  characters), `linkLabel`, and `media` (`main`, an optional `motion` loop, two `side` ids, optional
  `fallback` stand-ins, and optional `focus`). `role` (optional) is the one-line "My role:" summary
  under the intro (see Case-study roles below).
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
   controls. The exceptions are the Select Work card videos (see Select Work below): a card's primary
   (`card.media.motion`) plays muted, without controls, only while its card is active, and a
   secondary tile (a video id in `card.media.side`) plays only when asked. Card videos are short,
   silent web loops cut from approved ranges (a primary under 4 MiB, a secondary under 2 MiB, each held
   to its approved length by `verify.mjs`), each with a poster cut from the loop at its own aspect
   ratio; the original masters stay outside the repository.
3. **Galleries** (`type: gallery`): add objects to `items`: `{ "file": "work/creator-campaigns/mykonos-1.jpg", "alt": "…", "credit": null }`.
   Any unfilled `slots` keep rendering as placeholders.
4. **Logos**: add a monochrome SVG or PNG to `src/assets/logos/`, set `file` in `logos.json`, and set
   `permission` to `approved`. Logos render as text wordmarks until approved. A logo whose drawing
   sits differently in its frame from its neighbors' takes an `optical` entry (`scale` of the bar's
   logo height, `shift` as a fraction of it, negative up), applied in CSS, never to the file.
5. **Testimonial**: set `quote` and change `permission` to `approved`. Nothing is shown until then.
6. **Live link** (`tm-link-docs`): set `permission` to `approved` to make it clickable.
7. **Metrics** (`hero-metric`): edit `value` and `metricLabel`.
8. **Select Work card visuals**: set asset ids in the case study's `card.media`: `main` (the dominant
   still, or the primary video's entry, whose poster stands in if the video is absent), `motion` (the
   primary video) and `side` (two ids; a video id there becomes a secondary motion tile). A slot whose asset is not approved and present
   shows its `fallback` stand-in (`activations`, `impressions`, `cosponsors` or `suifest`, drawn only
   from approved facts) or a quiet empty tone, and the real image replaces it as soon as the manifest
   entry has a file. `focus` sets the `object-position` for each slot, in the order main, first side,
   second side, for an image or video its panel has to crop; `fit` (same order) set to `contain` shows
   an image or a video whole and uncropped, inset on the `plate` color from its manifest entry.
9. **Reel pieces**: the reel draws on `reel.pool` in `home.json`, 24 ids dealt into three rows of
   `reel.perRow` (8). To change a piece, put the optimized image under `src/assets/reel/` with a
   descriptive lower-case name, add a manifest entry with `"section": "reel"`, `"alt": ""`,
   `"decorative": true` and `"permission": "approved"`, and swap its id into the pool. Keep the pool at
   three times `perRow`. Stills only (no video), and the originals stay outside the repository.
   `verify.mjs` holds the approved list, so update `REEL_POOL` there when the approved set changes.

Set `permission` to `private-only` on anything that must never render even if a file is present.
The build will crop real media to the entry's aspect ratio with `object-fit: cover`.

Optional entries (`about-headshot`, `tm-website-before-after`) render only once a file is supplied.

### Resume

The PDF lives at exactly `public/resume/John-Cowin-Resume.pdf`, and every "Download resume" link points
there. To replace it, overwrite that file; to rename it, change `resumePath` in `src/data/site.json`.

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

Six pairings the palette suggests fail WCAG, so the site routes around them rather than shipping them:

| Pairing | Ratio | Instead |
| --- | --- | --- |
| Steel text on warm bone | 3.1:1 | Deepened steel `#4E5862`, 6.3:1 |
| Muted aqua text on warm bone | 3.2:1 | Blue-teal for links, 9.2:1 |
| Muted aqua focus ring on pale slate | 2.8:1 | Blue-teal focus on all light surfaces |
| Steel text on blue-teal | 3.0:1 | Light slate `#C3CACB`, 6.3:1 (lifted to `#C7CECF` in the Version 1.9 update, below) |
| Muted aqua focus ring on blue-teal | 2.9:1 | Light aqua `#9FC9C3`, 5.8:1 |
| Light slate and light aqua text beside a lit Contact grid line | 4.45:1 and 4.10:1 | `#C7CECF` and `#AAD5CF` on the brand surface, 4.6:1 (6.6:1 on the plain teal) |

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
employers, products, co-sponsors, and events, not clients), em dashes (other than the hero's name
stream and the approved footer credit), a location-level impressions
figure, a published count of active workflows, or "community strategy" (John did not lead a community
function in this B2B role, so the portfolio does not imply one). (Since Version 1.6 the homepage states
no formal title; the only formal title for the Phi Labs role is still "Social Media Manager", on the
resume.) It also confirms the approved creator-page claims and the approved contact, trust-bar and
footer lines, and it fails if a `.DS_Store` file ships in `dist/` or is tracked by git, or if any file
in `dist/` is larger than 25 MB (the full-length explainer video never belongs on the site).

The Version 1.7 checks: the homepage order (hero, About, Select Work, the reel, the combined section,
Contact) and its four surfaces; "Select Work" and its intro; three cards in the approved order, each
with its number and category, the approved title and subline (one sentence, 95 to 130 characters, 12
to 16 words), one dominant and two supporting panels, exactly one link, and no metric other than the
creator stand-in's "Approximately 1.25M impressions"; a card loop that is muted, inline, looping, has
a poster, loads nothing up front and carries its pause control; and the combined section's headline,
labels, four capability groups, three Stack groups, no certificate column, a How I Work statement of
60 words at most, and none of the retired AI-centered copy.

The Version 1.8 checks: the reel is hidden from assistive technology and carries no heading, label,
caption, tooltip, video or text of any kind, every reel image has empty alt text, its rows move right,
left, right and hold three rows of eight dealt from the approved 24-piece pool (each piece once, in a
mixed order in the HTML, with the per-visit shuffle present), `src/assets/reel/` holds exactly those 24
files and none of the four excluded ones, and every reel manifest entry is an approved, decorative
image; the Stack shows the approved 18 tools in their groups and order, ChatGPT once, each with its logo
(empty alt text, since the name is set beside it), and `src/assets/stack/` holds exactly the 18
approved SVGs with nothing in them that could run a script or load another file; the four capability
rows are keyboard reachable and no icon tilts more than 2 degrees; Contact reads "Your product is
complex. Its story shouldn't be." with the approved subline and keeps exactly the email and resume
actions; the hero and footer descriptor is exactly "Web3 Marketing, Strategy, & Content"; and John's
name appears once in the footer.

The Version 1.9 checks: the footer credit reads "© <year> John Cowin — Built end to end." with John's
name once, and that exact line is the only em dash allowed besides the hero's name stream; the combined
section's labels are Capabilities and Stack, with no How I Work eyebrow; each Stack group's heading and
tiles are centered and the tiles never stretch; Select Work holds its title and intro in the pinned head,
every page's head marks it with `.js`, and every sticky rule for the intro or the cards needs `.js`, a
60rem minimum width and no reduced motion (the pinned intro also a minimum height); the stack script
brings a covered card into view on keyboard focus; nothing but the reel sits between Select Work and the
combined section; the homepage Contact is the full-height frame with a min-height based on `100svh`, its
grid is decorative, text-free, drawn in CSS alone and never animates, its pointer layer shows only for a
fine pointer that can hover without reduced motion, and nothing uses canvas or WebGL; and each case study
carries one compact "My role:" line after its intro that names strategy, briefing, approval, and
distribution or publishing, without implying hands-on design.

The Version 2.0 checks: every card video sits in its frame on a lazy, responsive poster picture with
empty alt text and no `poster` attribute, stays invisible until it plays, and each card plays its
approved loops in order, with no typographic stand-in rendered; the architecture loop is contained on
its plate at its own aspect ratio, and the presentation loop keeps its 30% 50% framing on poster and
video alike; each loop runs its approved length (within 0.06 seconds), is H.264 with its index first and
no audio track, stays under 4 MiB as a primary and 2 MiB as a secondary, and has a poster at its own
aspect ratio; the playback script keeps its poster, failure, frame, tab, motion and pointer guards; the
retired hero preview ships nowhere, and no file under a master's name (the Version 2.0 sources
included) is tracked or shipped; and the trust bar shows seven logo files, Ambur Marketplace as the
supplied SVG byte for byte, carrying its optical sizing.

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

- One frame, three zones: from 64rem the complete section (headline, three paragraphs, resume
  button, trust-bar title and every logo and label) fits one screen when About is aligned to the top,
  as it is after a click on the About link. The headline holds the upper zone, the story and the resume
  action sit centered in the room between it and the trust bar (`margin-block: auto` in a full-height
  column), and the rule and trust bar close the foot of the frame, with `clamp()` spacing above and
  below the rule so the trust bar reads as a quiet closing element. Type and spacing scale with the
  smaller of the viewport's width and its height read as a 16:9 frame (`--fit`), and the top padding
  reserves the floating header's height (`--nav-h`, shared with the header). About cancels the usual
  in-page link offset (`--scroll-pad`) so it lands flush with the top. Checked from 1024x768 to
  2560x1440, including 1280x720, 1366x768, 1536x864, 1728x970 and common laptop windows such as
  1536x730 and 1440x790. Phones and tablets stack and scroll naturally, with no forced full height.
- Type: paragraphs are Archivo at 440 on a 44em desktop measure, about the headline's width, so they
  take two, three and two lines with the same breaks at every desktop size (36em below 64rem);
  the concluding paragraph is a step larger at 560 in the heading color, with the resume button at the
  right edge of its row; the highlights are blue-teal at 600, 9.2:1 on the light surface. The trust bar
  keeps its contents, order, labels and monochrome marks, with its rhythm tightened through
  `--logobar-slot`, `--logobar-label-gap` and `--logobar-head-gap`, and holds one row from 72rem.
  Since Version 2.0 every entry is a logo file: Ambur Marketplace is the supplied SVG
  (`src/assets/logos/ambur-marketplace.svg`, byte for byte), drawn at 86.5% of the bar's logo height
  and raised by 5.5% of it (`optical` in `logos.json`), so its capitals share the cap height and
  baseline of Bolt Liquidity beside Archway and its ink weighs about the same as theirs.
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
  phones). Metrics live on the case-study pages. The creator card's typographic stand-ins, which carry
  the one approved aggregate, remain only as a fallback: they show if its videos lose their files.
- The opening frame (Version 1.9): from 60rem the section starts just below the floating header
  (`--work-top`, the header's height and a little more), and the Work link lands with the section flush
  at the top, so the first view holds the headline, the introduction and the complete first card. At
  1728x968, the review frame, the headline starts at 100px and the first card spans 284 to 914px (630px
  tall), with the second card waiting just below the frame.
- The stack: from 60rem the cards stack as you scroll with `position: sticky`: each parks `--peek`
  (14px) lower than the one before, so the earlier cards' top edges stay in view and none is ever fully
  covered. A covered card recedes 4% and its pictures dim; its text keeps full contrast. Every card is
  one height, capped at 52% of the canvas width so the dominant panel stays near 16:9. Each card's
  margin box ends where the last card's does (a `margin-bottom` of one `--peek` for every card after
  it), so when the section runs out the complete stack rests for a moment and then leaves as one,
  instead of the last card sliding over the others.
- The pinned introduction: on screens at least 56rem tall and no wider than 2:1 (1440x900, 1512x945,
  1728x968, 1920x1080, 2560x1440), the headline and introduction stay pinned just below the header while
  the cards park beneath them, and nothing ever covers them. The cards take the room left under the
  introduction, and the run between cards is short, so the pinned sequence lasts about one and a half
  screens of scrolling (1,490px at 1728x968). The head's margin box ends exactly where the stack's margin
  boxes end, so the head and the complete stack release together. A script measures the head's height
  (`--head-h`); the CSS estimate it replaces matches it, so nothing shifts when the script runs. On a
  screen much taller than the width-capped card (2560x1440) the second card shows below the first from
  the start. On shorter or very wide desktop screens (1280x720, 1366x768, 1536x864, 2560x1080) the
  introduction scrolls away as before and the parked stack sits centered in the screen below the header.
- Enhancement only: the sticky rules apply once an inline script in the head has marked the page with
  `.js`, and only without reduced motion. Without JavaScript, with reduced motion, and on phones and
  tablets the section reads as an ordinary sequence: the headline, the introduction, then the three
  cards.
- Keyboard: going backwards through the stack (Shift+Tab) reaches cards that later ones cover. When a
  control in a covered card takes keyboard focus, the page scrolls back to where that card has just
  parked, so focus is never hidden under another card.
- Media (Version 2.0): every tile plays one of John's approved loops, cut to the frame from his time
  ranges. Each manifest entry's `source` note records its range, any frames trimmed from an edge, and
  its poster frame.

  | Card | Tile | Loop | Approved range | Length | File |
  | --- | --- | --- | --- | --- | --- |
  | 01 | Primary | Costa Rica aftermovie | 1:29 to 1:30, then 1:40 to 1:53 | 13.56 s | 1280x720, 25 fps, 3.6 MB |
  | 01 | Secondary | Trezor paper airplane | 0:00 to 0:12 | 12.01 s | 960x540, 1.9 MB |
  | 01 | Secondary | Bolt Bus trailer | 0:01 to 0:12 | 10.93 s | 960x540, 2.0 MB |
  | 02 | Primary | Hero animation | 0:10 to 0:22 | 11.68 s | 1600x900, 1.4 MB |
  | 02 | Secondary | Website hero motion | unchanged | 13.50 s | 1280x718, 0.7 MB |
  | 02 | Secondary | Architecture diagram | 0:03 to 0:14 | 11.00 s | 720x618, 30 fps, 0.3 MB |
  | 03 | Primary | Slippage explainer | unchanged | 9.72 s | 1600x900, 1.2 MB |
  | 03 | Secondary | Sui Fest interview | 0:20 to 0:32 | 12.01 s | 960x540, 1.6 MB |
  | 03 | Secondary | Sui Summit presentation | 0:00 to 0:11 | 11.01 s | 960x446, 0.5 MB |

  Four edges are trimmed, each by the fewest frames that remove a neighboring shot or a transition:
  the first four frames and the last frame of the Costa Rica opening range and the first six of its
  second range (neighboring shots), the first two frames of the Bolt Bus range (a flash of the previous
  title card), and the last eight frames of the hero range (the start of the slide into the next
  scene, so the loop now ends on the settled panel). Nothing is extended or substituted. The Costa Rica
  loop joins its two ranges with a cut, opens on the overhead pool shot, runs through the crew and the
  creators to the sky, and loops back to the pool. The loops are H.264 (High profile) at CRF 22 to 29,
  with x264's film or animation tuning, a keyframe every two seconds, no audio track, fast start and
  no metadata, at the source's own frame rate (the variable-rate architecture recording at a steady
  30). The Costa Rica primary is above the 3 MB working target at 3.6 MB because its water and foliage
  soften visibly any lower (CRF 30 would save 0.4 MB). Sizes here are decimal megabytes, as Finder
  shows them; `verify.mjs` holds primaries under 4 MiB and secondaries under 2 MiB. The masters stay
  outside the repository, and `verify.mjs` fails on any tracked or shipped file over 25 MB or under a
  master's name.
- Posters: each loop's poster is one frame extracted from the source at the loop's own crop and aspect
  ratio (1600 px wide for the primaries, 960 for the secondaries, 720 for the architecture), served as a
  lazy AVIF or WebP picture under the video, with the same fit and focus, so poster and loop fill the
  tile identically: Costa Rica 1:29.32, the first sharp frame of the opening pool shot (its first
  frames are motion blurred); Trezor 0:00.38, John signaling to the camera as the opening reveal widens;
  Bolt Bus 0:11.55, the bus under its caption; Sui Fest 0:27.49, the captioned question; the Sui Summit
  presentation 0:01.92, the speaker facing the room rather than turned toward the slide; and the first
  frame of the hero and architecture loops. The website hero motion and the slippage preview keep their
  approved posters. No video carries a `poster` attribute, which browsers fetch at once.
- The architecture loop is contained like the still it replaced: the whole frame, as tall as the panel
  less a little room, centered on its own plate (`#0D1012`, the recording's background) with the same
  hairline. The recording's framing matches the still's within a few pixels, so the diagram keeps its
  scale and position and its labels read as before at every width. The presentation loop keeps the
  still's framing (`focus` 30% 50%), so the slide's title stays whole where a narrower panel crops it.
- Playback: every video sits on its poster in a frame of its own (`.card__frame`), invisible until its
  first frame is on screen (`requestVideoFrameCallback`, else the `playing` event), when it fades in
  over 0.18 seconds; whenever it stops it disappears again and returns to its first frame. Only the
  active card's primary plays on its own, muted, looping and inline: on desktop, once its card has
  reached its resting place in the stack (its sticky top) with at least 60% of its dominant panel in
  view and clear of the next card; on tablets, once 60% of that panel is in view. Never two play at
  once. A primary stops, back on its poster, when its card stops being the active one, and the reader's
  pause holds. Secondary tiles show their poster and play only when asked: a mouse or pen resting on
  the tile plays a silent preview from the loop's start, and the play button in its corner starts and
  stops it from the keyboard or by touch. The card's primary waits on its current frame while a
  secondary plays and resumes afterwards if its card is still active. A secondary stops, back on its
  poster and first frame, when the pointer leaves, when most of it leaves the screen, when another
  video starts or when the tab is hidden; a hidden tab pauses the primary too. A video that cannot load
  keeps its poster, and its button goes. Data: a primary's video loads only as its card comes within a
  screen of view; a secondary fetches its metadata once a request is likely (a mouse settling on its
  card, rather than one carried across it by the scroll, or keyboard focus on its button) and the rest
  only when it plays. Reduced motion, data saving and phones get posters only, with no autoplay and no
  hover preview; the buttons still play a video on request.

### Work reel

- A purely visual transition between Select Work and the combined section: three rows of John's
  creative work that move sideways with the scroll, right, left, right, at related speeds (1, 0.8 and
  1.2). The travel is short (16% of the width across the whole pass, 10% on phones) and nothing moves
  on its own. There is no title, caption, label, badge, tooltip or text of any kind, and no hidden
  heading either (none is needed for the document outline): the reel is `aria-hidden`, and every image
  is decorative with empty alt text, so screen readers pass over it rather than announcing 24
  unrelated pictures.
- The pieces: 24 approved stills in `src/assets/reel/` (Ambur 1 and 2, Archway 1 to 7, Bolt 1 to 11,
  and four screenshots renamed for what they show: `bolt-explainer-opaque-logic`,
  `bolt-explainer-composition`, `archway-under-the-arch` and `archway-jackal-outpost`), including the
  meme, billboard and gallery concepts. The 2:53 PM and 2:59 PM screenshots, `Discord.jpeg` and
  `Educational.jpeg` are excluded, and the originals stay in the source folder outside the repository.
  The screenshots were converted from their display profile to sRGB and saved as 1600px JPEGs; the
  build serves every piece as responsive AVIF and WebP.
- Order: on each fresh visit an inline script shuffles all 24 (Fisher-Yates on
  `crypto.getRandomValues`) and deals them into three rows of eight before the reel is ever on
  screen. The order is kept in `sessionStorage` (`jc-reel-order`), so reloads, resizes, scrolling,
  reduced motion and returning from a case study never reshuffle it; a new visit may bring a new
  order, and occasional clusters are left as they fall. Without JavaScript the HTML's own fixed,
  seeded shuffle is shown.
- Repeats: a row repeats its complete eight-piece sequence only as many times as it takes to cover the
  screen at every point of its travel (at most desktop widths, not at all), recalculated on resize.
- Frames keep each image's own proportions at one row height, so nothing is cropped and nothing shifts
  as images load. Reduced motion and no JavaScript show the same rows, in the same order, as a still
  collage.
- Capacity: the reel stays at three rows of eight until eight more approved pieces are supplied (32 in
  all), and only then gains a fourth row. Excluded pieces never return, and no piece repeats to fill a
  row.

### From positioning to production

- What I Do and How I Work in one desktop frame: the headline and the working-style statement on the
  left (with no eyebrow since Version 1.9), set in four even lines on a 36em measure, the four capability groups on the right, level with
  the foot of the statement, and then, clearly separated, the Stack full width below.
- The Stack: 18 tools in three compact groups (AI and building; Systems and measurement; Creative and
  distribution). Each shows its own brand artwork and colors in the same neutral tile, with its name
  beneath. The artwork is about 42px on a 1280x720 frame, 48px at 1440x900 and 56px on large screens
  (`--mark`), with per-logo `scale` for optical balance; the MDX wordmark is sized across the tile
  rather than cropped square, and GitBook uses its mark in dark ink so it stays legible on the light
  tile. ChatGPT uses the normalized `chatgpt.svg`, and Claude Cowork and Claude Code stay separate. The
  logos are the approved SVGs in `src/assets/stack/`, served as images so each keeps its own colors
  and internal ids; the marks remain their owners' trademarks. Phones and tablets wrap the tiles into
  a grid of comfortable touch targets, and a long name wraps onto two balanced lines rather than
  shrinking. Since Version 1.9 each group centers its heading and its tiles, and a short last row sits
  centered too; the tiles keep one width (a third of the row on phones, 6.25rem on tablets, about 8.4
  times the label size on desktop) rather than stretching to fill a row.
- The capability rows respond to hover and keyboard focus alike: the icon lifts 3.5px, grows 6% and,
  where the symbol suits it, tilts a degree or two (`tilt`), while its circle takes a little more teal
  and a faint ring, over 220ms with an ease-out curve. Only the icon moves; the text never shifts, and
  focus also draws the site's focus ring. Hover applies only where a fine pointer can hover, so a tap
  never leaves an icon raised, and with reduced motion the state is shown by color alone. Nothing moves
  without interaction.
- From 64rem the section scales with `--fit`, as About does, and is one screen tall. Spare height is
  shared out: one part above the content, one part between the upper composition and the Stack (up to
  2rem more than its own margin), and two parts below, so the Stack sits lower wherever there is room
  and never rests against the lower edge. Checked from 1024x768 to 2560x1440, including 16:9 laptop
  frames and windows such as 1536x730 and 1440x790; phones and tablets stack.

### Contact and the closing frame

- One closing frame: on the homepage, Contact and the footer together are at least one screen tall
  (`min-height: calc(100svh - var(--footer-h))`, with `100vh` where small-viewport units are not
  supported), so at the end of the page nothing of the section before remains above Contact.
  `--footer-h` in `global.css` is the footer's height worked out from its own spacing tokens, so it
  follows any change to them. The headline and subline hold the left and the email and resume actions
  the right, with the spare height shared out above and below (1 to 1.25), and the footer rests at the
  bottom as a quiet anchor. The top padding reserves the header's height, so the navigation never meets
  the headline. Phones and short windows let the frame grow past one screen rather than compressing
  it, and there is no scroll snapping. The case-study pages keep the compact Contact, without the grid.
- The grid: one-pixel lines in the surface color mixed with 8% of its light aqua, in square cells about
  110 to 140px across at common screen sizes (3, 6, 8 and 10 columns of the content width from phones
  up), aligned with the page's gutters and snapped to whole pixels. Since the Version 1.9 update it is
  one even field, a line about 4.6 points lighter than the surface in perceived lightness (CIE L*,
  about 5% contrast), that runs behind the headline, the subline, the actions and the navigation and
  on beneath the footer, with no calm field around the text. It eases in only at its outer edges:
  where Contact begins, toward the sides of the screen and at the foot of the page. The rows are
  counted up from the footer's top edge, so a row meets the footer's rule instead of running just
  beside it, and the grid leaves a two-pixel band around the rule to the rule itself, which keeps its
  own color edge to edge. The grid layer reaches below Contact by exactly `--footer-h`; the footer is
  at least that tall and its content paints above the lines, and nothing clips the frame. The grid is CSS gradients
  only (no image, canvas, WebGL or library), and nothing in it moves on its own.
- The pointer response: where a fine pointer can hover, a second copy of the lines at 17% light aqua,
  five points more than the reviewed build's 12%, shows through a broad, feathered circle around the
  pointer (18rem to 30rem), anywhere over Contact and the footer. A line at the pointer is about 9.3
  points lighter than the surface, against 4.6 at rest (6.7 in the reviewed build). It fades in and
  out over 450ms. The pointer position is written to two custom properties at most once per frame, by
  listeners that run only while the grid is near the screen, and nothing is moved or distorted. On
  touch screens and with reduced motion that layer is not rendered and the grid stays still.
- Contrast: with the grid behind the text, every text color on the surface keeps 4.5:1 against the
  lightest line it can sit beside, a fully lit one included. That is why the brand surface's secondary
  text and accent are a touch lighter than light slate and light aqua (see Palette); `verify.mjs`
  recomputes it from the built CSS.
- The footer carries the hero's descriptor, the links and one credit: "© 2026 John Cowin — Built end to
  end." The year follows the build date. Its em dash is intentional, the one exception besides the
  hero's name stream, and `verify.mjs` excuses that exact line only. John's name appears once in the
  footer.

### Case-study roles

- Each case study states John's part in one compact line under its intro: "My role:" in bold, then the
  responsibilities that apply to that project, from the `role` field in its frontmatter. The lines name
  the strategy, the briefs, the review and approval, and the distribution or publishing, the ways John
  commissioned and shaped the visual work with designers, editors and creators, without implying he
  built every graphic himself; each page's closing credit still says who produced the final visuals.
  The creator campaigns intro keeps only its first sentence, and its section 02 is now "Program
  management", so "My role" appears once on that page. The reel stays wordless.

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
  assets/               images by page and section; reel/ (the 24 reel stills), stack/ (the 18 logos)
  lib/                  paths.ts (base-path helpers), assets.ts (manifest resolution)
  styles/global.css     Tokens, typography, buttons, motion
  layouts/              BaseLayout (metadata, header, footer), CaseStudyLayout
  components/           Hero, About, LogoBar, WorkPanels (Select Work), WorkReel,
                        Capabilities (From positioning to production), Contact, Media, …
  components/casestudy/ Section, Stats, MediaGrid, Gallery, Activation, Creators, …
  pages/                index, work/[slug], 404, robots.txt, site.webmanifest
```
