# John Cowin — Portfolio

Source for [johncowin.com](https://johncowin.com/), John Cowin's marketing portfolio. Built with
[Astro](https://astro.build) as a static site and published with GitHub Pages: no database, CMS,
authentication or server code. All copy lives in JSON and MDX, and every image, video, logo and metric
resolves through one asset manifest, so content changes rarely touch layout code.

## Documentation

| File | What it holds |
| --- | --- |
| `README.md` (this file) | How the site is built, edited, checked and published |
| [`PORTFOLIO_CONTEXT.md`](PORTFOLIO_CONTEXT.md) | Project overview, decisions, current status, open and deferred work: read this first |
| [`docs/SITE_SPEC.md`](docs/SITE_SPEC.md) | How each homepage section behaves today, and the content guardrails `verify.mjs` enforces |
| [`CHANGELOG.md`](CHANGELOG.md) | Every version since Draft 1, newest first, with the brief, the decisions and what was tested |

Comments in the code that say "see the README" refer to this set as a whole: implementation detail for a
given version is in the changelog under that version's name.

## Current state

- Pages: the homepage and three case studies (Creator Marketing and Partnerships, Technical Product
  Marketing, Events and Multimedia Production), plus the resume PDF and a 404 page.
- Analytics: GoatCounter, sitewide (see [Analytics](#analytics)).
- The latest release is listed at the top of [`CHANGELOG.md`](CHANGELOG.md).
- Placeholders render only in `npm run dev`; production builds hide any asset that is not both approved
  and present, so an unresolved entry never reaches the public site (see [Replacing
  placeholders](#replacing-placeholders)).

## Workflow

Requires Node 22.12 or newer.

```bash
npm ci             # install exactly what package-lock.json lists
npm run dev        # http://localhost:4321/ (placeholders visible)
npm run check      # TypeScript / Astro diagnostics: expect 0 errors, 0 warnings
npm run build      # production build into dist/
npm run preview    # serve dist/ at http://localhost:4321/ (leave it running for the next two)
npm run verify     # links, content guardrails, manifest, layout assertions, accessibility (axe)
npm run shots      # screenshots at 375 / 768 / 1280 px into .verify/
```

Other scripts:

```bash
npm run og         # regenerate social-preview images (`npm run og -- home` for one card)
python3 scripts/icons.py   # regenerate the browser icons from the favicon master (needs Pillow)
```

Playwright is used only by `og`, `verify` and `shots`. If it reports a missing browser, run
`npx playwright install chromium` once; without one, `verify` skips its accessibility pass and says so.

`verify.mjs` asserts much of the approved copy word for word. A deliberate copy or layout change
usually needs the matching assertion updated in the same commit.

### A change, start to finish

1. `git status` and `git pull`: start from a clean tree that matches `origin/main`.
2. Edit the data files (`src/data/*.json`, `src/content/work/*.mdx`) where possible; components only
   for layout or behavior.
3. `npm run check`, `npm run build`, then `npm run preview` and, in a second terminal, `npm run verify`.
4. Review `git diff` (and the built pages for anything visual).
5. Commit and `git push`. The deploy workflow publishes `main` in about a minute.
6. Confirm the change on https://johncowin.com/ (a hard refresh, or the page's `Last-Modified`).

Commits use the repository-local identity `John Cowin <213664443+jtcowin@users.noreply.github.com>`
(GitHub's private no-reply address for the jtcowin account), set with `git config --local`. Earlier
history is left as it is.

## Analytics

GoatCounter counts pageviews for the dashboard at https://jtcowin.goatcounter.com. The tag is in one
place, the `<head>` of `src/layouts/BaseLayout.astro`, which every page uses:

```html
<script is:inline data-goatcounter="https://jtcowin.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
```

- `is:inline` keeps Astro from bundling it; `async` keeps it off the critical path.
- Every page is a full page load (no view transitions or client-side routing), so each visit to a page
  sends exactly one pageview; nothing else needs to call GoatCounter.
- `count.js` ignores `localhost`, so `npm run dev` and `npm run preview` are not counted.
- GoatCounter sets no cookies and stores no personal data, so no consent banner is needed.
- `verify.mjs` (`[analytics]`) requires exactly one such tag in each page's head and no other analytics
  or tracking service.

## Routes

| Route | Source |
| --- | --- |
| `/` | `src/pages/index.astro` + `src/data/home.json` |
| `/work/creator-campaigns/` | `src/pages/work/creator-campaigns.astro` + `src/data/creator.json` (metadata and the Select Work card from `src/content/work/creator-campaigns.mdx`) |
| `/work/technical-marketing/` | `src/pages/work/technical-marketing.astro` + `src/data/tpm.json` (metadata and the Select Work card from `src/content/work/technical-marketing.mdx`) |
| `/work/events-video/` | `src/pages/work/events-video.astro` + `src/data/events.json` (metadata and the Select Work card from `src/content/work/events-video.mdx`) |
| `/resume/John-Cowin-Resume.pdf` | `public/resume/John-Cowin-Resume.pdf` |
| `/404.html` | `src/pages/404.astro` |
| `/robots.txt`, `/sitemap-index.xml`, `/site.webmanifest` | generated at build time |

## Publishing

Deployment is automated by `.github/workflows/deploy.yml`: every push to `main` builds the site and
publishes it to GitHub Pages.

One-time setup in the repository settings: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The site is live at `https://johncowin.com/` (the custom domain, below); `https://jtcowin.github.io/`
redirects there.

Because the repository is named `jtcowin.github.io`, GitHub treats it as a **user site** and serves it from
the root of the domain. The build reflects that: the base path is `/`, so pages are at `/work/...`, not
`/<repo>/work/...`. `site.config.mjs` derives this from the repository name, so renaming the repo to
something else (making it a project site) only requires updating `GITHUB_REPO` there.

### Custom domain

johncowin.com is set up: GitHub Pages serves it (its DNS points at GitHub Pages, and the domain is set
under **Settings → Pages → Custom domain**, with **Enforce HTTPS**), and `jtcowin.github.io` redirects to
it. Since Social Share V1.1, `public/CNAME` holds exactly `johncowin.com`, so the build knows it too:
`site.config.mjs` reads that file and builds for `https://johncowin.com/` at base `/`, and every canonical
URL, `og:url`, share image, the structured data's `url`, the sitemap and `robots.txt` use it. No links
change and nothing in `src/` names the domain. To change the domain, update DNS and the Pages setting,
then this file, together, so the canonical URLs and the served domain agree.

`site.config.mjs` holds this logic. `SITE_URL` and `BASE_PATH` environment variables override it if ever needed.

Pushing requires credentials for the `jtcowin` GitHub account on the machine that pushes (for example
Git Credential Manager, the GitHub CLI's `gh auth login`, or GitHub Desktop). A run's progress is under
the repository's **Actions** tab; a green "Deploy to GitHub Pages" run means the new build is live.

## Editing content

- **Site-wide** (name, email, nav, resume path, footer, and the LinkedIn profile that the footer and Contact link to,
  `social.linkedin`): `src/data/site.json`. The menu on Work (V1.5)
  lists the case studies itself, from `src/content/work/` in their `order`, numbered and titled as on
  the homepage (each one's `card.title`); `src/components/Header.astro`.
- **The homepage's opening sequence** (V1.5, retimed in Events V1.6, the note alone since Creator
  Marketing V1.0): its words are `intro.note` in `src/data/home.json` (the viewing note, exactly as
  approved); its timing is `src/components/Intro.astro` (`--intro-hold`, the note fully legible, with
  the beat before it and its transitions; the reveal and every turn after it are derived, so changing
  one moves the rest).
- **Homepage copy** (hero, About, the Select Work title and intro, the reel's pool, the combined
  section's headline, How I Work statement, capability groups and Stack, contact): `src/data/home.json`.
  Each Stack tool is `{ "name", "logo", "scale", "shape" }`: `logo` is an SVG under
  `src/assets/stack/`, `scale` (optional, around 0.84 to 1.04) nudges a mark that reads large or small
  so every tile looks the same size, and `"shape": "wide"` sets a horizontal wordmark (MDX) wide
  instead of squeezing it into a square. (Capability items no longer take a `tilt`: since Full Site
  Iteration V1 every icon makes one full turn on hover instead.) The paragraphs that carry one emphasized
  phrase name it beside their copy (`work.em`, `practice.how.em`, `contact.accent`); `emphasize()` in
  `src/lib/tpm-copy.ts` fails the build if the phrase is not in its copy exactly once.
- **Case studies**: `src/content/work/*.mdx`. Frontmatter holds the page metadata, hero copy, results,
  and the homepage card; the body holds the narrative sections using the components in
  `src/components/casestudy/`. Section ordering, headings, and copy are all editable in the MDX. The
  `card` block drives the Select Work card: `category`, `title`, a one-sentence `subline` (95 to 130
  characters), `linkLabel`, and `media` (since Full Site Iteration V1, `video`, the id of the card's one
  approved video in the manifest, and an optional `focus`, the part of the frame kept in view where the
  desktop band crops it). `role` (optional) is the one-line "My role:" summary
  under the intro (see Case-study roles below).
- **Technical Product Marketing** (Version 1.6): `src/data/tpm.json` holds the hero's section label,
  copy and scope line (`hero.break` is the phrase the headline's first line ends with), the isometric
  system's words (`hero.system`: the description assistive technology reads for the drawing, the seven
  labels keyed by component, and its control's two states, `toggle.show` and `toggle.hide`; its
  geometry and timeline are `src/lib/tpm-iso.ts`), the foundation's two headline lines and paragraph, the twelve documents in order (display
  number, title, subline, icon, accent name and color) and the number of blank covers, the statement
  and its highlighted clause (`highlight`), and for Website and Technical documentation their name,
  metadata (label and paragraphs; `**name**` sets a name in bold), contribution statement and
  walkthrough asset, with the website's live link (`live`) and the documentation's three chapters
  (start in seconds, title and note); `campaign` holds the flagship chapter's headline, metadata,
  contribution, film asset and results (the label, the four figures, each with an optional `spoken`
  form for screen readers, and the supporting lines); `conclusion` holds the closing headline and
  paragraph, the sentence that leads on (`nextLine`) and the case study it leads to (`next`, which must
  be the next in the collection's order, or the build stops). Beside a headline, `accent` names the one phrase
  set in the accent color, and beside a paragraph, `em` names the one phrase set a little heavier; each
  must appear in its text exactly once, or the build stops (`src/lib/tpm-copy.ts`). The page's metadata and its Select Work
  card still come from the case study's frontmatter; its older MDX body is no longer rendered.
- **Events and Multimedia Production** (Version 1.6): `src/data/events.json` holds every word on the
  page and its media configuration, section by section. `stages`: the five stages (Secure, Build,
  Capture, Cut, Amplify), read by the transition's phrase, the sections' tallies and the conclusion.
  `hero`: the kicker, the headline and its `accent`, the paragraph, the reel's `chapters` in their order
  (each with its `key`, its `title`, shown in capitals after its number, its asset id, `pos`, the crop
  of the wide frame as an object position, and `fitNarrow`, `contain` to show a video wider than 16:9
  whole on narrow screens), the pause control's words (`pause`, `play`, and `playShown`, the words on
  the control while the reel waits on its poster) and the program monitor's (`monitor`, V1.4: `program`
  beside the label and `timecode` before the counter). A chapter appears only when its asset is approved and
  present, and the chapters are numbered among those, so a pending chapter (the team interview) leaves
  no gap. `transition`: where the phrase breaks on small screens (the signal after AMPLIFY. is part of
  `EvTransition.astro`). `activation`: its headline, paragraph, rendering, screens, caption and kit
  slots. `deck` (V1.3): the words of "Watch full video with sound" (`watch`) and the three `chapters` in
  order, each with its `key`, `label` (on its rail), `headline`, its introduction (`context`), up to
  three `points`, the `outcome`, the fine-print `credit` (and, where a chapter has them, the
  `participants` on a line of their own), its muted `preview` (an approved loop, which may be a hero
  chapter's own file, as the live presentation's and the event film's are since V1.6; `previewFit:
  contain` shows a video wider than 16:9 whole in a 16:9 frame, and `native` shows it in its own frame),
  and, where the chapter has one, its `full` film with sound and that film's short name for the
  player's controls (`fullLabel`); a chapter without `full` (the live presentation since V1.5, the event
  film since V1.6) shows its preview alone, with no Watch. `setupFinal` (V1.4, its control since V1.5)
  puts the production room's Setup and Final in its chapter (`chapter`): the setup photograph's asset
  id (no caption since V1.5), the finished explainer's asset id, the control's two words (`tabs`) and
  their name for assistive technology (`label`); Final shows that chapter's own preview (since V1.6 its
  two-scene loop) and film, and Watch full video with sound only under it. `conclusion` holds the headline, its accent, the paragraph, the sentence that
  leads on (`nextLine`) and the case study it leads to (`next`, which must be the next in the
  collection's order, wrapping around to the first, or the build stops). The activation render's
  geometry, its screens' brightness over time and their luminance in the still are in
  `src/data/ev-activation.json`, written by `scripts/render/activation-composite.py`. The page's
  metadata and its Select Work card still come from the case study's frontmatter; its older MDX body is
  no longer rendered.
- **Creator Marketing and Partnerships** (Version 1.4): `src/data/creator.json` holds every word on the
  page and its media configuration, section by section (keys that begin with `_` are notes). `hero`:
  the label, the headline, the paragraph (John's ownership only) and its four layers (`layers`: `sky`,
  `estate`, `frondLeft`, `frondRight`, asset ids). `context`: the headline and its `accent`, the
  paragraph (no kicker since V1.2) and `roster`, the quieter line beneath it (V1.3; the build stops on
  a handle, link or follower count in it; since V1.4 `CmContext.astro` sets the three as one centered
  composition). There is no `network` since V1.3: the creators appear only in the credits, by their
  handles since V1.4. `atlas`: the section's `heading` (for assistive
  technology only since V1.2), the fact labels and the three `destinations` in order (`key`, `index`,
  `name`, `kind`, `coords`, `copy`, `creators` and `pieces`, the exact figures, `sponsors` as logo ids,
  the `loop` and two `fragments`). `trezor`: the kicker, title and deck, the `film` and its
  `filmLabel`, the `brief` (assignment, objective and approach, John's words), the `metrics`
  (`assets.json` metric entries) with their label and note, the `feedback` (the approved testimonial)
  and `emphasis`, the phrases of the quotation set in the accent (each must occur exactly once in it,
  or the build stops). `library`: the kicker, headline, copy and the tablist's `label`, and the seven
  `formats` (`key`, `label`, the `edit`'s asset id and its `cues`, the edit time in seconds where each
  destination takes over; any other number stops the build). `ownership`: the kicker, the headline as its two sentences (`above` and
  `below` the waterline, or the build stops), the line on John's role and the three `chapters` (`key`,
  `index`, `title`, `text`; no owner lines and no collaborators, or the build stops). `credits`: the
  kicker and title, the `team` (`name` and `role`) and the `rows` (`role` and `names`; the first row,
  Creators, holds `handles` instead since V1.4: the eight creators' public X handles in order, an @ and
  the handle and nothing else, or the build stops), the only place on the page that names
  collaborators and creators. `conclusion`: the headline, its `accent`, the paragraph,
  `nextLine` and `next` (the next case study in order, or the build stops). Motion is
  `src/lib/cm-motion.ts`; the players and silent loops are `src/lib/ev-media.ts`'s. The page's metadata
  and its Select Work card come from the case study's frontmatter, which has no body since V1.2.
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
   controls. The exceptions are the Select Work card videos (see Select Work below): since Full Site
   Iteration V1 each card has one (`card.media.video`), which plays muted, without controls, only while
   its card is active. Card videos are short, silent web loops cut from approved ranges (each under
   5 MiB and held to its length by `verify.mjs`), each with a poster cut from the loop at its own aspect
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
   shows its `fallback` stand-in (`activations`, `cosponsors` or `suifest`, drawn only from approved
   facts; the `impressions` stand-in was retired in Creator Marketing V1.2) or, for a `null` slot, a
   quiet empty tone, and the real image replaces it as soon as the manifest
   entry has a file. `focus` sets the `object-position` for each slot, in the order main, first side,
   second side, for an image or video its panel has to crop; `fit` (same order) set to `contain` shows
   an image or a video whole and uncropped, inset on the `plate` color from its manifest entry.
9. **Reel pieces**: the reel draws on `reel.pool` in `home.json`, 24 ids dealt into three rows of
   `reel.perRow` (8). To change a piece, put the optimized image under `src/assets/reel/` with a
   descriptive lower-case name, add a manifest entry with `"section": "reel"`, `"alt": ""`,
   `"decorative": true` and `"permission": "approved"`, and swap its id into the pool. Keep the pool at
   three times `perRow`. Stills only (no video), and the originals stay outside the repository.
   `verify.mjs` holds the approved list, so update `REEL_POOL` there when the approved set changes.
10. **Events slots**: every slot on the Events page names an `ev-` entry that already holds its final
    aspect ratio, so a placeholder and the asset that replaces it take the same room. A `pending`
    entry is a labeled placeholder in `npm run dev` and renders nothing in a production build; to fill
    it, add the file and set the entry's `file` (a video also takes its `poster` and its `duration` in
    seconds) and `permission: approved`, and it appears in its place with nothing else to change. A
    still, artifact or slide is served as a responsive picture; a video with sound gets the page's
    player ("Play with sound", pause, seek, mute); the activation kit's screen animation, a silent
    video, plays muted and looped while it is well in view, with its own pause control; and the kit
    appears as one package as soon as any of its pieces is approved. The two metric entries are
    reminders that become text: approving `ev-suifest-metrics` with a verified `value` and
    `metricLabel` sets the figure beneath the Sui Fest results, and approving `ev-after-integration`
    with the verified name and wording sets it beneath the outcome after the event; `verify.mjs` allows
    an exact figure or a named integration on the page only from such an approved entry. What is still
    pending is listed in [Events and Multimedia Production, Version
    1.0](CHANGELOG.md#events-and-multimedia-production-version-10).

11. **Creator slots** (`cm-` entries): none are left. Since V1.2 the Trezor brief is John's own words,
    the creator testimonials and their transition are gone (their placeholder entries,
    `cm-testimonial-1` to `-3`, the `voices` data and `CmVoices.astro` were removed; a complete approved
    set would come back as a new brief), the Trezor collaboration rows are gone with their block (the
    credits keep that record), and the creators carry no category. (Since V1.1 the three Trezor
    highlights, `cm-trezor-metric-1` to `-3`, are approved and checked word for word, and Mykonos's
    co-sponsor is Phi Labs.)

Set `permission` to `private-only` on anything that must never render even if a file is present.
The build will crop real media to the entry's aspect ratio with `object-fit: cover`.

Optional entries (`about-headshot`, `tm-website-before-after`) render only once a file is supplied.

### Resume

The PDF lives at exactly `public/resume/John-Cowin-Resume.pdf`, and every "Download resume" link points
there. To replace it, overwrite that file; to rename it, change `resumePath` in `src/data/site.json`.

### Social-preview images

`public/og/` holds the cards that link previews show (1200×630), generated from the site's own fonts,
tokens and photographs by `npm run og`: every card, or one with `npm run og -- home` (or a case
study's slug); `--out=<dir>` renders them somewhere else, to compare a fresh render with the committed
files. Each card is written under the file name its manifest entry gives (`og-home`,
`og-creator-campaigns`, …), and each page's preview URL carries a short hash of its card's file (`?v=`,
in `BaseLayout.astro`), so a regenerated card gets a fresh URL and platforms fetch it anew. The
homepage card is a crop-safe portrait and a JPEG (`og/home.jpg`; see [Social Share
V1.1](CHANGELOG.md#social-share-v11)). Each case study has its own designed card, John's approved file, under a
versioned name (`og/<slug>-v2.jpg`), drawn from its page's hero and five sources in `scripts/og` (see
[Footer LinkedIn and case-study share cards](CHANGELOG.md#footer-linkedin-and-case-study-share-cards)). The
renderer's output is not byte-for-byte stable across machines, so commit only the card that changed:
`verify.mjs` pins the three case-study cards, and a new design takes the next versioned name (in its
manifest entry) and a new pin.

### Browser icons

Every icon comes from one square photographic master at
`src/assets/favicon/john-cowin-favicon-master.png`, which stays out of `public/` so the
full-resolution file is never shipped to visitors. `python3 scripts/icons.py` masks it to the circle
that the portrait sits in, makes everything outside that circle transparent, and writes
`favicon-16/32/48.png`, `favicon.ico`, `apple-touch-icon.png`, and `icon-192/512.png`. The small sizes
crop tighter to the head and are lightly sharpened, because a full head and shoulders is unreadable at
16 pixels. To swap the portrait, replace the master and rerun the script; nothing else needs editing.

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
each pill matches the ground it sits on and the switch happens exactly at the boundary. When surfaces
nest (the Technical Product Marketing hero's dark screen grows over the header inside its light
section), the innermost one on the line wins, and the one around it takes over again when it leaves.

### Type

- Display: Archivo at 700 and 86% width. Archivo Black was tested first; fitted to one line it came out
  about three quarters the size and read as the loudest option.
- Everything read closely, including navigation and labels: Manrope.
- The hero name keeps its approved Archivo Medium 500 at normal width.
- The serif and the monospace face are retired, and their packages were removed. `scripts/og.mjs`
  renders the social-preview cards in Archivo and Manrope on the same palette: the home card (since
  Social Share V1.1) is the hero's own photograph as a crop-safe portrait with two small Manrope labels,
  and each case-study card is drawn from its page's hero, its words from the page's data, so a card is
  redrawn, under a new versioned name, when its headline or the case study's name changes.

## Project structure

```
astro.config.mjs        Astro config (site/base from site.config.mjs, MDX, sitemap)
site.config.mjs         Deployment target: user site, project site, or custom domain
PORTFOLIO_CONTEXT.md    Project overview, decisions, status and open work
CHANGELOG.md            Version history, newest first
docs/SITE_SPEC.md       Current behavior of each section and the content guardrails
public/                 Static files copied as-is (favicons, OG images, resume, CNAME)
scripts/                og.mjs (social previews), icons.py (browser icons), verify.mjs (checks),
                        shots.mjs (screenshots), render/ (the Events activation render: its
                        Blender scene, its compositing, the wordmark's textures)
reference/              Local reference material, kept out of Git and never published (the
                        activation render's spatial and lighting reference, the wordmark's SVG)
src/
  content.config.ts     Case-study collection schema
  content/work/*.mdx    Case studies
  data/                 site.json, home.json, logos.json, assets.json, tpm.json (Technical Product Marketing),
                        events.json (Events and Multimedia Production), creator.json (Creator
                        Marketing and Partnerships)
  assets/               images by page and section; reel/ (the 24 reel stills), stack/ (the 18 logos)
  lib/                  paths.ts (base-path helpers), assets.ts (manifest resolution),
                        tpm-motion.ts (the Technical Product Marketing page's stages,
                        walkthroughs and film), tpm-copy.ts (its emphasis), tpm-iso.ts (the
                        hero's isometric system: its drawing engine, scene and timeline),
                        ev-media.ts (the Events page's reel, players, loops and
                        reveals, shared with the creator page), ev-stage.ts (its activation
                        render's playing screens), ev-copy.ts (its time labels), cm-motion.ts
                        (the creator page's hero, atlas, library, wave and reveals)
  styles/global.css     Tokens, typography, buttons, motion
  layouts/              BaseLayout (metadata, header, footer), CaseStudyLayout
  components/           Intro (the homepage opening sequence), Hero, About, LogoBar, WorkPanels
                        (Select Work), WorkReel, Capabilities (From positioning to production),
                        Contact, NextCase (the case studies' way on to the next), Media, …
  components/tpm/       TpmHero, TpmFlow (02 Foundation and 03 the statement), TpmWebsite, TpmDocs,
                        TpmCampaign (06), TpmConclusion (07), TpmCase (a chapter's opening),
                        TpmWalkthrough (the walkthroughs' player), DocIcon
  components/events/    EvHero, EvTransition, EvActivation, EvDeck (the Expanding Production
                        Deck, with the production room's Setup and Final), EvConclusion,
                        EvPlayer (a video with sound), EvSlot (a media slot)
  components/creator/   CmHero, CmContext, CmAtlas, CmTrezor, CmFilm (a film with sound),
                        CmLibrary, CmOwnership, CmCredits, CmConclusion
  components/casestudy/ Section, Stats, MediaGrid, Gallery, Activation, Creators, … (the shared
                        case-study layout, which no page uses at present)
  pages/                index, work/creator-campaigns, work/technical-marketing,
                        work/events-video, work/[slug] (the shared layout, for a future case
                        study), 404, robots.txt, site.webmanifest
```


## Third-party notices

The Technical Product Marketing document icons (`src/components/tpm/DocIcon.astro`) and the HOME house
(`src/components/Header.astro`) are Phosphor Icons 2.1.1 (https://phosphoricons.com), used as published:

```
MIT License

Copyright (c) 2023 Phosphor Icons

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
