# PORTFOLIO_CONTEXT.md

The quick-start reference for this portfolio. Read it before changing anything. It records what the
site is, how it is built and published, the decisions already made, and what is open or deferred.

- **Companion docs:** [`README.md`](README.md) (how to build, edit, check and publish),
  [`docs/SITE_SPEC.md`](docs/SITE_SPEC.md) (how each section behaves and the content guardrails),
  [`CHANGELOG.md`](CHANGELOG.md) (every version, newest first).
- **History:** the site was built across many sessions from September to October 2026. Those working
  conversations are no longer available. Everything here about past decisions comes from the
  changelog, the commit history, the code and the data files, not from memory.
- **Last updated:** V1.8 The Road Here visual refinement, October 2026.

Sections are kept separate on purpose: **Confirmed decisions** (settled), **Completed** (done and
verified) and **Deferred** (needs discussion before any work). No approved work is outstanding.

---

## 1. Project overview

johncowin.com is John Cowin's marketing portfolio. Its job is to get hiring conversations started with
hiring managers, recruiters, marketing executives, startup and Web3 founders, and potential consulting
clients.

| Route | Content |
| --- | --- |
| `/` | Hero, About and logo bar, Commercial impact ($0 → $300M+ and the direct integrations), Select Work (3 stacked cards), work reel, "From positioning to production" (capabilities and stack), Contact |
| `/work/creator-campaigns/` | 01 Creator Marketing and Partnerships |
| `/work/technical-marketing/` | 02 Technical Product Marketing |
| `/work/events-video/` | 03 Events and Multimedia Production |
| `/resume/John-Cowin-Resume.pdf` | Resume download (the master resume, see section 7) |
| `/404.html` | Not-found page |
| `/the-road-here/` | **Draft (Phase 3A):** The Road Here, the career before Web3. Unlisted, noindex, not in the sitemap |

## 2. Technical architecture

- **Framework:** Astro 7 with static output, `trailingSlash: 'always'`. MDX and sitemap integrations;
  self-hosted Archivo and Manrope. There is no server, CMS or client-side routing.
- **Content model:** copy lives in `src/data/*.json` and `src/content/work/*.mdx`. Every image, video,
  logo and metric resolves through `src/data/assets.json` (129 entries, each `approved`, `pending`,
  `redacted` or `private-only`). Production builds render only approved assets that are present.
- **Layouts:** `BaseLayout.astro` holds the head, metadata, analytics, header and footer for every page.
  `CaseStudyLayout.astro` wraps it.
- **Components:** the homepage parts live in `src/components/`. Each case study has its own family:
  `creator/Cm*`, `tpm/Tpm*` and `events/Ev*`. Motion and media logic is in `src/lib/`.
- **Media:** web videos are in `public/media/` (about 180 MB, H.264). Images are optimized at build
  time. The original masters are kept outside the repository.
- **Checks:** `scripts/verify.mjs` has more than 4,300 lines of assertions: links, approved copy word
  for word, layout rules, file sizes, share-card pins, analytics and axe accessibility.

## 3. Design system (summary; tokens in `src/styles/global.css`, detail in the README)

- **Palette (from the hero portrait):** ink `#0D0F10`, warm bone `#F3EFE8`, fog `#EDF0EF`, deep slate
  `#25313A`, steel `#7E8995`, pale slate `#DDE2E3`, blue-teal `#1F4546`, muted aqua `#4F918A`.
  Contrast pairs are measured and documented.
- **Surfaces:** a section's color comes from its position on the page. The header takes on the
  surface beneath it.
- **Type:** Archivo 700 at 86% width for display, Manrope for everything read closely.
- **Visual language:** each case study has its own. The creator page uses daylight and destinations,
  the technical page an isometric system and a document library, the events page a broadcast program
  monitor.
- **Copy conventions the build enforces:** no em dashes outside two approved places, no "client", no
  invented titles, at most one emphasized phrase per paragraph.

## 4. Content architecture and positioning (as published)

- **Homepage descriptor:** "Web3 Marketing, Strategy, & Content".
- **About headline:** "Creative instincts. Operator discipline. Built for DeFi."
- **Contact:** "Your product is complex. Its story shouldn't be." It offers the email, the resume and
  LinkedIn.
- **About:** three paragraphs (the music project, Phi Labs Global) closing on "Today, I turn complex products
  into stories people understand and connect with." The Bolt Liquidity paragraph added in V1.3 was removed on
  29 October 2026 by John's decision; the commercial proof below About tells that story.
- **Commercial proof:** $0 → $300M+ in processed protocol volume, with direct aggregator integrations with
  Cetus, Aftermath and FlowX (named by their logos, not in the copy) and downstream integrations, never
  counted. It appears on the homepage, the Technical Product Marketing case study (after the campaign
  results) and the resume. Sui
  Foundation and Mysten Labs appear only as strategic discussions and a potential pilot (Events case study
  and resume), never as a completed partnership.
- **Case studies:** all three cover Bolt Liquidity work at Phi Labs Global. Each credits its
  collaborators by name and states John's part precisely.
- **Pending manifest entries:** 24 entries, which do not render in production. They include creator
  galleries, a Trezor analytics chart, an article cover, a docs live link, a team interview chapter,
  Sui Summit deck, promo and clip, Sui Fest metrics, and the activation kit.

## 5. GitHub and deployment

- **Repository:** `jtcowin/jtcowin.github.io`, public, single branch `main`.
- **Deploy:** `.github/workflows/deploy.yml` runs on every push to `main`. It runs `npm ci`, then
  `npm run build`, then uploads `dist` and publishes it with `actions/deploy-pages`. Pages source is
  GitHub Actions. A deploy takes about a minute after the push.
- **Domain:** `public/CNAME` is `johncowin.com`, and `site.config.mjs` builds canonical URLs for it.
  `jtcowin.github.io` redirects to johncowin.com.
- **Commit identity:** the repository-local config is
  `John Cowin <213664443+jtcowin@users.noreply.github.com>`, the jtcowin account's GitHub no-reply
  address. It is set with `git config --local`, so other repositories are unaffected. Earlier commits
  keep their original author email. That was a deliberate decision: no history rewrite and no
  force-push.
- **Pushing:** requires the jtcowin account's credentials on the machine that pushes.

## 6. Workflow for future changes

1. Run `git status` and `git pull`. Start clean and level with `origin/main`.
2. Edit the data files where possible. Change components only for layout or behavior.
3. Run `npm run check`, then `npm run build`, then `npm run preview`. With the preview running, run
   `npm run verify`.
4. Update the `verify.mjs` assertions in the same commit when approved copy or layout changes on
   purpose.
5. Review the diff, commit, push, and watch the "Deploy to GitHub Pages" run.
6. Verify on johncowin.com before calling anything deployed.
7. Record significant decisions here and add a `CHANGELOG.md` entry.

## 7. Confirmed decisions

These are settled. Do not reopen them without a new instruction.

- **Master resume:** the PDF at `public/resume/John-Cowin-Resume.pdf` is the authoritative version. It
  is the V1.3 edition (29 October 2026): the 24 October layout with the LinkedIn link, plus the two
  approved Bolt and Sui bullets. Older copies elsewhere are superseded. Do not
  change employment details, messaging or formatting without explicit authorization.
- **Employment details:** dates, titles, status and related resume language change only on John's
  explicit instruction.
- **Mobile hero:** tested by John on his phone and accepted as it is. The audit finding is closed. Do
  not change the mobile hero layout.
- **Loading screen:** "BEST EXPERIENCED ON DESKTOP" is intentional on every device, phones included.
  Keep it and its wording.
- **Git history:** leave it as it is. The commit identity policy is in section 5.
- **Original video masters:** John keeps them locally and confirms they are backed up. They have not
  been independently verified. Do not upload, move, compress, remove or reorganize them in cleanup
  work.
- **Analytics:** GoatCounter only. No cookie banner, no other services.

## 8. Completed

### Cleanup V1 (October 2026)

- **GoatCounter analytics:**
  - The tag sits in the `<head>` of `BaseLayout.astro`: one async tag, `is:inline`, endpoint
    `https://jtcowin.goatcounter.com/count`, script `https://gc.zgo.at/count.js`.
  - Each page load sends exactly one pageview, and there are no route changes to handle.
  - `count.js` ignores localhost.
  - `verify.mjs` `[analytics]` guards it: exactly one tag per page, in the head, and no other
    trackers.
  - Dashboard: https://jtcowin.goatcounter.com.
- **LinkedIn in Contact:**
  - An outline button beside "Download resume", matching it, on the homepage and the case studies'
    compact Contact.
  - It opens in a new tab with `noopener noreferrer` and a screen-reader note.
  - The footer link remains.
  - `verify.mjs` `[linkedin]` and `[claim]` were updated: LinkedIn appears once in the footer and once
    in Contact, nowhere else.
- **Documentation:**
  - The README is now a concise guide.
  - The version history moved verbatim to `CHANGELOG.md`, and the behavior spec and guardrails to
    `docs/SITE_SPEC.md`. Cross-links were rewritten. A line-by-line comparison found no content lost.
  - This file was added.
- **Commit identity:** set as described in section 5.
- **Checks run before commit:** `astro check` (0 errors, 0 warnings); production build; `verify.mjs`
  (all checks passed; its axe pass needs a local Playwright browser). Contact was screenshotted at
  1440x900 and 375x812 with no horizontal scroll. `count.js` was confirmed to load on every page.
- **Deployment and live status:** recorded in the changelog and confirmed on johncowin.com after the
  push.

### V1.6 Commercial Proof Copy Refinement (October 2026)

- The homepage, Technical Product Marketing and Events commercial-proof paragraphs carry John's revised copy
  and bold phrases. Copy only; no layout changes. Detail in the changelog.

### V1.5 Commercial Proof Final Refinements (October 2026)

- **Homepage:** the commercial proof fades into Select Work's ink; more room around the figure, which no longer
  has a label of its own; the downstream tile is centered.
- **Technical Product Marketing:** the divider sits at the top of the section; the right column is the label,
  the logos and "+ Additional downstream integrations".
- **Events:** Commercial follow-through is an outlined proof card with a decorative flag icon.
- **Detail and tests:** see the changelog.

### V1.4 Commercial Proof Polish (October 2026)

- **Homepage:** the commercial proof is centered, with a shorter paragraph, a four-item integrations row (three
  marks and a downstream tile) and its own deep teal-charcoal surface before Select Work.
- **Technical Product Marketing:** the commercial-proof section is centered, without its eyebrow or the line of
  aggregator names.
- **Events:** the Commercial follow-through copy refers to "key aggregators" without naming them.
- **Detail and tests:** see the changelog.

### V1.3 Commercial Proof and Case-Study Outcomes (October 2026)

- **Homepage:** the four-paragraph About and the new commercial-impact module after the trust bar.
- **Technical Product Marketing:** the Ecosystem Distribution section before the conclusion.
- **Events:** the Live Presentation chapter's Commercial follow-through callout.
- **Resume:** the two approved bullets; still two pages.
- **Detail and tests:** see the changelog.

### The Road Here, draft (Phase 3A, built out in V1.7 and V1.8, October 2026)

- **What it is:** a standalone page at `/the-road-here/` in five sections: hero (a transparent cutout of John
  with a cymbal), music school to the road (the live performance with the television and festival cards
  layered on it), more than the drummer (four capability cards with icons), the 2020 pivot (a living
  timeline), and where it led (call to action to the selected work). Then the shared Contact, as on the
  homepage.
- **Status:** private draft. Unlinked, `noindex`, out of the sitemap, until John approves launch.
- **Copy and photos:** John's approved copy (`src/data/road.json`) and five of his photographs as
  privacy-checked derivatives in `src/assets/road/` (manifest `road-*`). The festival poster is cropped above
  its lower-tier names.
- **Privacy rule:** the band is never named, linked or identifiable on this page, in its images or in its
  metadata.
- **Milestones:** removed in V1.8 by John's decision.
- **Photo credits:** none published, by John's decision.
- **Pending John's decision:** homepage placement and launch.

### Creator Retreat Videos (Phase 2, October 2026)

- **Costa Rica and Mykonos atlas loops:** now show production work alongside the trip. Costa Rica adds the
  crew's gimbal rig and a camera operator filming a content session. Mykonos opens its Lock In moment on the
  crew's camera and adds Pool Talk, the poolside podcast. The new files are `cm-costa-rica-loop-v15.mp4` and
  `cm-mykonos-loop-v15.mp4`.
- **Singapore:** kept as it was, by John's decision. Its footage holds no behind-the-scenes material, and the
  game-show additions tried in review were not worth the change.
- **Rule change:** `verify.mjs` now lets an atlas loop share moments with the Behind the scenes, Game show and
  Podcasts tabs. Every other repeat is still refused.
- **Detail:** see the changelog. The build tooling (rebuilding a loop from its masters, with measured
  alignment) was kept outside the repository.

### Earlier

The site's full history is in [`CHANGELOG.md`](CHANGELOG.md), from Draft 1 (11 Sep 2026) to Footer
LinkedIn and case-study share cards (24 Oct 2026).

## 9. Deferred (discuss before any work)

1. **Headline and positioning.** One headline across the site, link previews and resume. It must
   cover Web3 marketing expertise, strategic marketing, product marketing and GTM, creative
   direction, versatility and leadership potential. It must not reduce John to community management,
   social media or a single employer.
2. **Earlier work.** Present the music career, entrepreneurship, consulting, event production and
   other marketing work. The direction to explore is a short homepage feature plus a dedicated page
   with professional photography, work examples, responsibilities and evidence. The open decisions
   are the title, narrative structure, which work to feature, photos, evidence, and where it sits in
   the site's structure. Let the work speak for itself, with no motivational "lessons" framing.
3. **Articles.** Review the published long-form articles, pick the strongest, and decide how and
   where to feature them. Nothing gets added without reviewing the actual content.
4. **Production tabs and Singapore (optional follow-up).**
   - The Behind the scenes, Game show and Podcasts tabs could be recut so they no longer repeat the moments
     the Costa Rica and Mykonos loops now use.
   - Singapore needs new behind-the-scenes footage before its loop can change.

## 10. Open items and maintenance notes

- **$300M figure:** stated as approved by John. No public source confirms the dollar volume yet; Bolt's
  own site confirms routing through Cetus, Aftermath and FlowX and further downstream apps. If a public
  figure appears (for example a DefiLlama listing), cite or re-check it.
- `npm outdated` has not been reviewed recently. Check dependency updates in a separate, deliberate
  pass.
- The repository grows with every committed video version. Consider Git LFS or external hosting
  before adding much more video. GitHub warns at 50 MB per file and blocks at 100 MB.
- The manifest holds 24 pending entries and a list of unreferenced ids (`verify.mjs` prints them).
  Tidy them up or schedule them when the related content is decided.

## 11. Verified vs. inferred

- **Verified at Cleanup V1:**
  - Before the change, the local tree, GitHub `main` (`b4df875`) and johncowin.com were identical,
    byte for byte.
  - The deploy workflow ran successfully for the recent commits.
  - The check and build results above.
- **Inferred:**
  - Pages settings (Actions as the source, custom domain, enforced HTTPS) are inferred from the
    workflow, the redirect and HTTPS. The settings page itself was not inspected.
  - The changelog's per-version "Tested" notes were true when written; only the current state has
    been re-tested.
