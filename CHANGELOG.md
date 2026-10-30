# Changelog

Every version of the portfolio since Draft 1, newest first. Each entry records the brief, the decisions,
what changed and how it was tested. Until October 2026 this history lived in the README; it moved here
unchanged in Cleanup V1. For how the site works today, see [`README.md`](README.md) and
[`docs/SITE_SPEC.md`](docs/SITE_SPEC.md); for decisions and status, [`PORTFOLIO_CONTEXT.md`](PORTFOLIO_CONTEXT.md).

## V1.6 Commercial Proof Copy Refinement

John's brief (29 October 2026): copy only. The three commercial-proof paragraphs were replaced with his approved
copy and bold phrases. No layout, label, metric, logo, spacing, color, divider, icon or responsive change.

- **Homepage (`home.json` `commercial.copy`):** "I joined Bolt before launch and helped turn **early ecosystem
  conversations into key integrations**. As its distribution expanded, the protocol grew from zero to **more
  than $300 million in processed volume**."
- **Technical Product Marketing (`tpm.json` `ecosystem.copy`):** the new paragraph, with **partner
  conversations, direct integrations, and downstream paths across Sui** and **more than $300 million in
  processed volume** in bold.
- **Events (`events.json`, live chapter `outcome`):** the new Commercial follow-through paragraph, with **direct
  integrations with key aggregators** and **strategic discussions with Sui Foundation and Mysten Labs** in
  bold. `EvDeck.astro` now sets `**bold**` in the card only, a step heavier (800) than its semibold text.
- **Checks (`verify.mjs`):** the three paragraphs and their bold phrases word for word; no other Events outcome
  carries bold. The one-emphasis-per-paragraph rule exempts these three approved paragraphs only.
- **Tested:** `astro check` (0 errors, 0 warnings); build; `verify.mjs` all checks passed. Screenshots at
  1440, 1024 and 390 wide: no horizontal scroll.

## V1.5 Commercial Proof Final Refinements

John's brief (29 October 2026): final visual refinements to the three commercial-proof areas. No approved copy
changed; resume, About and The Road Here unchanged.

- **Homepage (`CommercialProof.astro`):**
  - The section runs longer, and its foot fades from the teal-charcoal into Select Work's exact ink
    (`var(--c-ink)`) through eased stops, below all of the proof, finishing before the Select Work heading.
    Measured with no visible band: adjacent rows differ by at most one level.
  - "Commercial impact" sits higher, with clear space above `$0 → $300M+`.
  - The "Processed protocol volume" label under the figure is removed (John, during the build): the paragraph
    already says what it measures. A screen reader still hears "From $0 to more than $300 million".
  - The downstream tile is centered, "+ additional" over "downstream integrations", with no rule beside it.
- **Technical Product Marketing (`tpm/TpmEcosystem.astro`, `tpm.json`):** the divider moved from beneath the
  paragraph to the top of the section, centered at the narrative's width, separating it from the campaign
  results. The right column is one compact stack: "Direct aggregator integrations", the logos, then
  "+ Additional downstream integrations". "Downstream reach" and the rule inside the column are gone.
- **Events (`events/EvDeck.astro`, `Icon.astro`):** Commercial follow-through is a proof card: a thin teal
  outline, a 10px radius, a faint teal fill, and a decorative outlined flag (new `flag` icon, hidden from
  assistive technology) in a teal circle beside the label. The paragraph is unchanged; the credit stays below
  the card. The label never breaks at its hyphen.
- **Checks (`verify.mjs`):** the fade into ink, the centered tile, no label under the figure, the TPM column
  order and divider position, and the Events card and decorative icon.
- **Tested:** `astro check` (0 errors, 0 warnings); build; `verify.mjs` all checks passed. Screenshots at
  1440, 1280, 1024, 390 and 360 wide: no horizontal scroll.

## V1.4 Commercial Proof Polish

John's brief (29 October 2026): a surgical pass on the three V1.3 commercial-proof areas so they sit in the site
rather than on top of it. Resume, About and The Road Here unchanged.

- **Homepage commercial proof (`CommercialProof.astro`):**
  - One centered stack: "Commercial impact" above `$0 → $300M+` (in the restrained metadata style of the TPM
    page's "First 48 hours after launch"), "Processed protocol volume" beneath it.
  - The shorter approved paragraph, with "key integrations" and "more than $300 million in processed volume" in
    bold. It names no aggregator; the logos do.
  - "Direct aggregator integrations" centered over one row of four: Cetus, Aftermath, FlowX, then a two-line
    typographic tile, "+ additional / downstream integrations", set quieter than the marks. A 2 x 2 grid on
    phones (`IntegrationLogos` gained a slot and a `quad` option).
  - Its own surface, a deep teal-charcoal (`#0f1e1f`) a step off Select Work's ink, with full section padding,
    so the change of ground marks the boundary. The header reads it like any surface. Small text on it holds
    4.7:1 or better.
- **Technical Product Marketing (`tpm/TpmEcosystem.astro`):** the eyebrow is gone; the headline and the
  shorter approved paragraph (three bold phrases, no aggregator names) are centered, with a centered divider
  beneath. Two balanced centered columns: $300M+ over "Protocol volume processed", and one proof stack of the
  logos (one row from 1024px up), "Direct aggregator integrations", a divider, "Downstream reach" and
  "Additional downstream integrations". The "Cetus · Aftermath · FlowX" line is removed.
- **Events:** the Commercial follow-through paragraph is the revised approved copy ("key aggregators", unnamed;
  "I created the shared working group"; "cross-organizational"). Label, teal callout, placement and credit
  unchanged.
- **Checks (`verify.mjs`):** the new copy and bold phrases, no aggregator names in either paragraph, the
  four-item row with the tile last, the label placements, the centered TPM section, and the impact surface
  differing from ink. The one-emphasis-per-paragraph rule now exempts these two approved paragraphs only.
- **Tested:** `astro check` (0 errors, 0 warnings); build; `verify.mjs` all checks passed. Screenshots at
  1440, 1280, 1024, 390 and 360 wide: no horizontal scroll; homepage row on one line on desktop and 2 x 2 on
  phones; TPM logos on one row from 1024px up.

## V1.3 Commercial Proof and Case-Study Outcomes

John's brief (October 2026): put the commercial result of the Bolt work on the homepage, in the resume and in
two case studies, using his approved copy word for word.

- **Homepage About:** four approved paragraphs (the music project, Phi Labs Global, Bolt Liquidity, and the
  closing line). The closing line is set bold in the heading color (`flow__p--close`). Highlights are
  "global music project", "more than 200,000 people" and "more than $300 million in processed volume";
  as before, the period sits outside each highlight. On desktop screens up to 63rem (1008px) tall the frame
  unit follows height a little sooner (`min(1vw, 1.52svh)`), so the longer story and the trust bar still fit
  one frame from 1280x720 to 1600x900. Taller screens are unchanged.
- **Homepage commercial proof:** new `CommercialProof.astro` (`#impact`) after the trust bar and before
  Select Work, on the dark Select Work chapter. One figure, `$0 → $300M+`, labeled "processed protocol
  volume", the approved paragraph, and a "Direct aggregator integrations" row with the Cetus, Aftermath and
  FlowX logos in that order, followed by the downstream statement. No downstream count.
- **Integration logos:** John's SVGs, copied unchanged to `src/assets/integrations/`, listed in
  `src/data/integrations.json`, and drawn by `IntegrationLogos.astro` (one light tone, optically sized).
- **Technical Product Marketing:** new Ecosystem Distribution section (`tpm/TpmEcosystem.astro`, copy in
  `tpm.json` `ecosystem`) after the campaign results and before the conclusion: the approved headline and
  copy, the $300M+ figure, the three logos as direct aggregator integrations, and downstream reach.
- **Events and Multimedia Production:** the Live Presentation chapter's outcome is now a labeled callout,
  "Commercial follow-through", with the approved copy. The teal callout and the credit below it are kept.
  Sui Foundation and Mysten Labs appear only there, as strategic discussions and a potential pilot.
- **Resume:** John's updated PDF (his commit `a531823`) carries the two approved bullets: the Bolt
  integrations bullet (first under the Phi Labs Global role) and the Sui Foundation and Mysten Labs
  working-group bullet (after the Sui Summit bullet). Still two pages; Earlier Experience now starts page 2.
- **Checks (`verify.mjs`):** the approved copy for all of the above, placement and order, logo order, a
  single figure, no downstream count, the SVGs free of scripts and external references, and an exception
  that allows the Events callout's partner names while the rest of the page keeps its guardrails.
- **Tested:** `astro check` (0 errors, 0 warnings); production build (6 pages); `verify.mjs` all checks
  passed. Screenshots: the About frame fits at 1024x768, 1280x720, 1280x800, 1366x768, 1440x810,
  1440x900, 1536x864, 1600x900, 1680x1050, 1920x1080 and 2560x1440; no horizontal scroll on the homepage,
  Technical Product Marketing or Events pages at 1440x900 or 390x844.

## The Road Here (Phase 3A draft)

John's brief (October 2026): a first working draft of a standalone page about his career before Web3, in five
sections, built from the existing design system. It uses placeholder imagery, placeholder copy for a later
writing pass, and no homepage link yet.

- **Route:** `/the-road-here/` (`src/pages/the-road-here.astro`), on `BaseLayout`, so it gets the header,
  footer, metadata and GoatCounter. It is a draft:
  - `noindex, nofollow`, with no canonical link
  - left out of the sitemap (`astro.config.mjs`)
  - linked from no page or menu
- **Words:** all in `src/data/road.json`.
- **Photographs:** four pending manifest entries (`road-hero-portrait` 4:5, `road-live` 3:2,
  `road-artifact` 4:5, `road-backstage` 3:2), drawn by `src/components/road/RoadFrame.astro`. It shows a
  labeled hatch placeholder until an entry has a file and is approved, then the optimized photograph, so
  swapping one in needs no layout change.
- **Sections:**
  - 01 Hero (dark): the headline with its accent, the lede, a chapter index and the portrait.
  - 02 From music school to the road (light): the copy, the live photograph with the reserved artifact
    slot overlapping its corner, and four milestones.
  - 03 More than the drummer (soft): the intro, the backstage photograph and four capability cards.
  - 04 The 2020 pivot (dark): the copy and an understated timeline, the road to 2021.
  - 05 Where it led (fog): the headline, four then-to-now pairs, and the call to action to the selected
    work (`/#work`).
  - Then the compact Contact and the footer.
- **Motion:**
  - one rise-and-fade reveal per block as it comes into view
  - a gentle drift on real photographs
  - the timeline line drawing down once
  - all of it off with reduced motion or without scripts
- **Privacy:** the band is never named or linked here or in the metadata. There are no invented
  documents. The artifact slot is reserved for one genuine, privacy-checked piece.

**Tested:** `astro check` (0 errors, 0 warnings), the production build (6 pages) and `verify.mjs` (all checks
passed, the page included). Screenshots at 1440x900, 820x1180 and 390x844 show no horizontal scroll, no
script errors and every block revealed. The page has about 490 words.

## Creator Retreat Videos

John's brief (October 2026, Phase 2): the destination loops in the creator page's campaign atlas should show
the professional work behind each trip as well as its energy. Keep the existing edits and add a few genuine
production shots from the same destination, with no captions or overlays and no large change in length.
John approved Costa Rica and Mykonos. Singapore stays exactly as it was: its masters hold no behind-the-scenes
footage, and the game-show additions tried in review (the quiz on screen, the bus pulling up) did not earn
their place.

- **Costa Rica** (`cm-costa-rica-loop-v15.mp4`, 7.68 s, was 6.28). Between the villa and the beach, two
  production shots: the crew's gimbal rig on a creator in the lounge (Costa Rica Aftermovie 1:40.24 to 1:41.08,
  the shot the homepage card already uses), then a camera operator filming the creators' content session
  (Ashley Costa Rica Vlog 0:25.50 to 0:26.40, retimed to 25 fps). A dissolve leads in, a hard cut joins the two,
  and a dissolve leads out to the golden-hour beach.
- **Mykonos** (`cm-mykonos-loop-v15.mp4`, 8.34 s, was 6.72). The Lock In Podcast moment now opens on the crew's
  camera, its screen showing the guest (Mykonos Aftermovie 1:17.86 to 1:18.44). It then cuts straight to the
  recording under the arch, so the operator's printed shirt no longer crosses the frame. Pool Talk follows:
  four creators recording on beanbags by the pool, the crew's shadows on the stone (Pool Talk 17:12.00 to
  17:13.40, cropped to 1700x956 above its burned-in subtitles). The infinity pool is two frames shorter.
- **How they were built.** Each loop was rebuilt from its masters to the manifest's record, with the
  original dissolves and the seamless dissolve reset. The rebuild was checked against the published loop:
  every untouched shot lands within a frame of before (the measured in-points are now the recorded ones),
  and the Singapore bus shot's crop (1440x810 at 120,80) was confirmed by image matching. Both loops are
  H.264 High, 1600x900, silent, index first, with 2-second keyframes, under the 4 MiB cap (3.59 and
  3.57 MiB). Their first frames, and so their posters, are unchanged. The accessibility descriptions now
  name the production shots.
- **Rules changed in `verify.mjs`.**
  - An atlas loop may now share a moment with the production tabs (behind the scenes, game show,
    podcasts). The best production shots were already there, and the loops now carry that evidence. All
    other repeats are still refused.
  - Pool Talk may appear in the Mykonos loop.
  - The Costa Rica and Mykonos checks now expect the new shots.
  - The v11 and v14 file names are retired.

**Tested:** `verify.mjs` all checks passed; `astro check` clean. Neither loop has duplicated frames, and each
seam dissolves back into its opening. Both play in the atlas at 1440x900 and 390x844 with no horizontal
scroll. The previous loops remain in git history.

## Cleanup V1

John's brief (October 2026): a small, safe cleanup after the context-recovery audit, with no redesign.

- **Analytics.** GoatCounter (https://jtcowin.goatcounter.com), one async tag in the `<head>` of
  `BaseLayout.astro`, so every page sends one pageview per visit. No cookies, no other service. See the
  README's Analytics section.
- **LinkedIn in Contact.** A second outline button, "LinkedIn" with the external arrow, beside "Download
  resume" in Contact (`Contact.astro`), on the homepage and the case studies' compact Contact alike. It
  opens in a new tab (`noopener noreferrer`, with a visually hidden "(opens in a new tab)"). The two
  buttons share a row (`.contact__buttons`), right-aligned on desktop, left on phones, wrapping only if
  the room runs out. The footer link stays: the footer already repeats Resume and the email.
- **Documentation.** The README is now a concise guide; its version history moved here and its
  behavior specification to `docs/SITE_SPEC.md`, both unchanged apart from link targets.
  `PORTFOLIO_CONTEXT.md` added at the root.
- **Commit identity.** Repository-local `user.email` set to the account's GitHub no-reply address.

**Checks** (`verify.mjs`): `[analytics]`: exactly one GoatCounter tag per page, in the head, async, for
jtcowin.goatcounter.com, and no other analytics or tracking service. `[linkedin]`: LinkedIn linked once
from the footer and once from Contact where a page has one (the 404 page has none), nowhere else, with
the new-tab safeguards. `[claim]`: Contact keeps exactly the email, resume and LinkedIn actions, in that
order.

**Tested:** `astro check` (0 errors, 0 warnings), the production build, and `verify.mjs` (all checks
passed). Contact screenshotted at 1440x900 and 375x812 on the homepage and a case study, with no
horizontal scroll. `count.js` requested on every page, with no pageview sent from localhost.

## Release overview (as of Footer LinkedIn and case-study share cards, October 2026)

The summary the README carried at the top until Cleanup V1, kept as written.

**Status: Footer LinkedIn and case-study share cards.** Version 2.0, Technical Product Marketing Version 1.6,
Events and Multimedia Production Version 1.6, Creator Marketing and Partnerships Version 1.4, Full Site
Iteration V1 (John's brief of surgical refinements across the site: the hero's staged entrance, decided
copy and a restrained emphasis system, one landscape video per homepage card with two new montages, the
capability icons' single turn, the creator page's wider program paragraph, 60-post Trezor sample,
centered feedback and quiet transition, the library without its eyebrow and caption, destination films
with John's moment and a briefer Lock In moment behind the scenes, the credits' joint logistics, the
Technical Product Marketing documentation and conclusion copy, the Contact accent and the Events
activation's top alignment; see [Full Site Iteration V1](#full-site-iteration-v1)) and its deltas, Full
Site Iteration V1.1 (a slightly quicker loader, the hero's name kept behind the portrait throughout its
entrance, larger homepage cards that show each complete 16:9 video, the events montage with moving
footage only, and the Events activation's paragraph centered against its headline; see [Full Site
Iteration V1.1](#full-site-iteration-v11)), Full Site Iteration V1.2 (the homepage's events montage
expanded toward the creator card's length and substance, and the Events page's three chapters
reordered to lead with the production room; see [Full Site Iteration V1.2](#full-site-iteration-v12))
and Full Site Iteration V1.3 (the final desktop correction of the events montage: the Events page's
four approved edits, each played whole, one after another; see [Full Site Iteration
V1.3](#full-site-iteration-v13)), the approved two-page resume (October 2026) and Social Share Polish V1
(the homepage's link preview: its own title and description, decoupled from the browser title; see
[Social Share Polish V1](#social-share-polish-v1)) are published. Social Share V1.1 (a crop-safe portrait
card, John Cowin Portfolio as every preview's site name, and every canonical and share URL on
johncowin.com; see [Social Share V1.1](#social-share-v11)) follows them, and Mobile Optimization V1 (the
first pass made for phones: the homepage hero's name higher and its arrow and descriptor as one lockup, a
four-row work reel, the creator page's centered openings, the Technical Product Marketing system shown
complete, its Foundation as one stack of documents and "follows:" kept whole, the Events sequence numbered
in two columns, and the Stack read as a strict grid at every width; see [Mobile Optimization
V1](#mobile-optimization-v1)) follows that, and the About Copy delta (John's approved headline and
paragraphs for About, "Creative instincts. Operator discipline. Built for DeFi."; see [About Copy
delta](#about-copy-delta)) follows it, and Footer LinkedIn with the case-study share cards (a LinkedIn
link in the footer, its one placement, and each case study's own designed share card under a versioned
name; see [Footer LinkedIn and case-study share cards](#footer-linkedin-and-case-study-share-cards))
follows that. Placeholders render only in `npm run dev`;
production builds hide any asset that is not both approved and present, so an unresolved entry never
reaches the public site (see [Replacing placeholders](README.md#replacing-placeholders)).

Technical Product Marketing replaces the case study's page with its own, now at Version 1.6, built
through 01 Hero, 02 Foundation, 03 the transitional statement, 04 Website, 05 Technical documentation,
06 the flagship animation campaign and 07 the conclusion (see [Technical Product Marketing, Version
1.6](#technical-product-marketing-version-16)). The hero is a split: the section label, the headline and
the paragraph on the left and, on the right, an isometric system that assembles once as the page
opens (research and inputs on stone plinths, a shared product language built at the center as an
architectural foundation of blocks under a glass canopy, and the public-facing expressions, joined
by conduits in the floor), stays quietly alive (one signal at a time from an input through the
foundation to an expression) and, when the reader points at it, taps it or presses its control,
separates into its layers, lights its conduits and names its parts; the seven areas of scope run in
one line beneath it, and the Foundation's dark surface then rises over it. The foundation opens
centered, then from a compact stack into a library of twelve named documents, each with its own accent
and icon, moving right to left; one statement follows, revealed word by word, its key clause then
highlighted; then the website plays in an oversized desktop display and the documentation in a large
browser frame, both continuously, from their posters; then the complete one-minute film plays in a
nearly full-width frame on the dark ground, silently until the reader asks for sound, above its launch
results; then the conclusion, a full screen on a ground that carries the campaign's black on through a
deep charcoal teal into the Contact green, whose last sentence leads on to the next case study, with
Contact's grid rising out of its lower part. Contact and the footer close the page. Two site-wide
changes came with Version 1: inner pages
lead their header with a restrained HOME link in place of the name, and the homepage opens, once per
browsing session, with a short sequence; since Events Version 1.5 it is a brisk, directional loader (a
small marker travelling the screen from left to right while a viewing note, BEST EXPERIENCED ON
DESKTOP, is held long enough to be read), handing over to the hero in layers. Since Creator Marketing
and Partnerships Version 1.0 the note is its only line (the three phrases are gone, with nothing in
their place) and the whole sequence takes about 2.9 seconds (Events V1.6: 3.45); since its Version 1.4
the note is coded into place, left to right, each position cycling for a moment through a few code
glyphs before its letter settles, in 0.7 seconds, then holds while the marker gathers speed to the end
of its path, the whole sequence keeping its length. Since its Version 1.2 the page answers the first
movement of a trackpad: its pinned stages move from their first pixel, and its large frames rise with
the scroll itself rather than on a timed entrance; since its Version 1.4 the Foundation's stack, once
pinned, holds together for a short stretch of scrolling before it spreads.

Creator Marketing and Partnerships, the first case study, has its own page since its Version 1.0, now
at Version 1.4 (see [Creator Marketing and Partnerships, Version
1.4](#creator-marketing-and-partnerships-version-14)), in a visual language of its own: open air and
daylight, destination atmospheres, a waterline and closing credits. A
full-screen hero layers one coastal scene in depth (the sky, the headline "Creator campaigns, built to
travel." set in it, a white villa and its palm, and two palm fronds nearest, each moving at its own rate
as the page scrolls; illustrative stock photography, credited once, in the credits) over a paragraph on
John's part; the program context follows as one centered composition ("Each destination became a
campaign in motion.", its paragraph, then a short rule and one quieter line on the roster), leading straight into a campaign atlas that holds
still on wide screens while Costa Rica, Singapore and Mykonos take the stage in turn, each with its own
silent loop, two stills, its figures and its co-sponsors; the Trezor Dare Ad, its film first and with
sound, then its assignment, objective and approach, three creator-account highlights set large and
centered, and Trezor's feedback with four phrases in the teal; a library of seven edits, one per
format (Podcasts the seventh), chosen with editorial tabs, a selected format looping until the reader
chooses another or leaves, the section turning toward the water below; the program ownership in three
chapters of John's work across a waterline whose wave flows slowly; closing credits that open with the
team and name the eight creators by their X handles, the only place collaborators and creators
are named; and a conclusion that leads on to Technical Product Marketing before Contact. The page has
no placeholder left.

Events and Multimedia Production, the third and final case study, has its own page since its Version
1.0, now at Version 1.6 (see [Events and Multimedia Production, Version
1.6](#events-and-multimedia-production-version-16)): a hero whose headline and paragraph share one
header row above a full-width cinematic reel of four chapters (01 / TECHNICAL EXPLAINER, 02 / EVENT
FILM, 03 / CREATOR PODCAST, 04 / LIVE PRESENTATION; the team interview joins after the podcast once its
footage is approved), played through in order and crossfading from one to the next, under a restrained
program monitor (PROGRAM, TC and a sequence timeline); a transition, SECURE. BUILD. CAPTURE. CUT.
AMPLIFY., revealed word by word as the reader scrolls and closed by a broadcast signal that holds a
moment before the section lets go; then the activation (an original 3D concept rendering whose
television and projected wall play their loops), the Expanding Production Deck (the live presentation,
the production room and the event film in one vertical accordion, one chapter open at a time, each
card's media framed with the hero's production marks and a timecode, its words in a natural rhythm
beside it, the production room opening on its Final explainer (since Creator Marketing V1.2; its Setup
photograph a click away, the reader's choice kept for the visit); on wide
screens the reader's own scrolling opens the chapters in turn while the deck holds below the site's
header), and a conclusion that closes on the five stages and leads on to the next case study, Creator
Marketing and Partnerships, before Contact. Since Creator Marketing V1.0 the live presentation's and the
event film's video sits in the vertical center of its open card on wide screens. Each deck chapter carries its credits in one line of fine print, and every
media slot still waiting for its final asset is a placeholder at its final ratio in `npm run dev`
only.

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

## Footer LinkedIn and case-study share cards

John's brief (October 2026): a LinkedIn link in the footer, its one placement on the portfolio, and the
three approved thumbnails from his Desktop as the case studies' own share cards, then deploy. Two changes
from John came first: the events card drops the signal icon after AMPLIFY. and the blue line under the
five words (the Desktop held the earlier preview), and all three drop their case numbers (01, 02, 03,
and the "02 /" before EVENT FILM), which read on the site but not on a thumbnail. The final cards are on
John's Desktop and in `public/og`, byte for byte. Nothing else changes: no layout, copy, animation,
case-study content, resume or navigation beyond the footer link.

- **LinkedIn** (`Footer.astro`; `site.json` `social.linkedin`: https://www.linkedin.com/in/johncowin/).
  A plain text link like its neighbors, after Resume and before the email: Work, About, Resume,
  LinkedIn, the email. It opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`) and says
  so to assistive technology (a visually hidden "(opens in a new tab)"); its hover and keyboard focus
  are the other links' (the light-aqua hover, the site's focus ring). It is in every page's footer and
  nowhere else: not the header, the Work menu, the hero or Contact, and not the structured data.
- **Wrapping.** The five links take about 25.3rem in one row, so below about 27.8rem (445px) they wrap
  to two: Work, About, Resume, LinkedIn, then the email (on 375 to 440px phones; at 320 and 360px the
  four links already wrapped). `--footer-h`, the footer's height that the closing frame subtracts, now
  counts that second row below 30rem: four rows there (the descriptor, two rows of links with their
  0.5rem gap, the credit), three from 30rem, two from 48rem. So on phones Contact and the footer still
  fill exactly one screen (Contact gives up the 29.7px the footer gains) and the grid still runs to the
  foot of the page; this also corrects 320 and 360px, where the footer used to run 29.7px past the token
  and the grid stopped short of it. From 445 to 480px the links fit in one row and the footer's
  min-height leaves that much room at its foot. Tablets and desktops keep one row of links beside the
  descriptor.
- **The cards** (`public/og/creator-campaigns-v2.jpg`, `technical-marketing-v2.jpg`,
  `events-video-v2.jpg`: 157, 85 and 87 KB). New, versioned names, so platforms that cached the
  typographic PNGs (`og/<slug>.png`, now removed) fetch them fresh; the URL also keeps the file's hash
  (`?v=`). Each case study's frontmatter names its own card (`ogAsset`), so each page writes its own
  absolute johncowin.com URL in `og:image` and `twitter:image`, with `twitter:card`
  summary_large_image, 1200 by 630, its own title and description, its clean canonical address, and alt
  text that describes the card:
  - Creator Marketing and Partnerships: "Share card for Creator Marketing and Partnerships: prints from
    Costa Rica, Singapore, and Mykonos around an illustrative coastal villa, under the headline Creator
    campaigns, built to travel."
  - Technical Product Marketing: "Share card for Technical Product Marketing: an isometric system in
    which interviews, research, and analysis feed a shared product language at its center, which carries
    through to the website, documentation, and campaigns, beside the headline Building the system behind
    the message."
  - Events and Multimedia Production: "Share card for Events and Multimedia Production: a
    program-monitor still from the Sui Fest event film, an entrance corridor in neon light, with the
    sequence Secure, Build, Capture, Cut, Amplify."

  The homepage card, and the 404 page's (the same), are unchanged.
- **The designs.** Each card is its own, built from its page's hero: the creator card is the hero's
  layered scene (sky, headline, villa, fronds) with prints from the three trips and a dotted route
  between them; the Technical Product Marketing card is the hero's isometric system, opened and running,
  labeled as the hero labels it, beside the headline; the events card is the program monitor on the event
  floor, a still of the reel's event film under the monitor's marks (the tally, PROGRAM and the chapter's
  title, the timecode), with SECURE. BUILD. CAPTURE. CUT. AMPLIFY. as an even lower third. What they
  share: Archivo and Manrope, the teal accents, and each case study's name. Each is crop-safe for compact
  previews such as Slack's: every piece of text lies wholly inside the central 630 by 630 square or
  wholly outside it, so the square shows the headline over the villa, the system with its labels, and
  BUILD. CAPTURE. CUT. over the corridor. JPEG quality 88, full chroma.
- **The renderer** (`scripts/og.mjs`; `npm run og -- <slug>`) draws them from the pages' own data (the
  headlines, the case studies' names, the system's words, the stages, the monitor's words) and five
  sources in `scripts/og`, outside `src/assets` (whose every image the site's asset glob would bundle
  into the build), and writes each under its manifest entry's file name; in the cloud copy it reproduces
  the three approved files byte for byte. The sources: `creator-print-costa-rica.jpg`,
  `creator-print-singapore.jpg` and `creator-print-mykonos.jpg`, a frame each from the destination loops
  (`ffmpeg -ss 5.6 -i public/media/cm-costa-rica-loop-v11.mp4 -frames:v 1 -q:v 2 <file>`, and `-ss 0.2`
  and `-ss 1.35` for `cm-singapore-loop-v14.mp4` and `cm-mykonos-loop-v14.mp4`, with ffmpeg 6.1);
  `events-program.jpg`, the same at 4.4 s of `ev-hero-event-film.mp4` (frame 106); and `tpm-system.png`,
  the hero's system captured with Playwright at 2x from the built page in a 1440 by 900 window, its parts
  shown with its toggle, its labels, legend and toggle hidden and its grounds transparent, from a burst of
  frames 140 ms apart: one with pulses running in from the inputs and one with pulses running out to the
  outputs, joined at x 1030, where the two agree. A render on another machine differs from the approved
  files in its bytes, so commit a case-study card only when its design changes, under the next versioned
  name (in its manifest entry) and with its new pin in `verify.mjs`.

**Tested** (beyond `verify.mjs`): each built page's share tags, each case study's its own card and none
the homepage's; the footer at 17 widths from 320 to 1920px on the homepage and a case study: its height
equals `--footer-h` at every one (the links in two rows from 320 to 440px, in one from 460px), nothing
scrolls sideways, and the closing frame is exactly one screen at 360x780, 375x812, 390x844, 402x874,
430x932, 768x1024 and 1440x900, the grid running to the foot of the page; the link's hover and keyboard
focus; and, built side by side with the commit before, only the five pages' footers, the three case
studies' image tags, the stylesheet's footer token and the cards in `og/` change. The accessibility scan
finds nothing on all five pages at two widths, and `astro check` reports no errors.

**The checks** (`verify.mjs`, `[share]`, `[linkedin]` and `[hygiene]`): each case study's card is John's
approved file, byte for byte in `public` and in the build (SHA-256 pins), under its versioned name, a
JPEG of exactly 1200 by 630 under 300 KB, named by the page's own frontmatter; its `og:image` and
`twitter:image` are its own absolute URL with the file's hash, with the large X card, 1200 by 630 and its
alt text; no two case studies share a card and none falls back to the homepage's; the canonical address
and `og:url` stay clean; `public/og` and the build hold exactly the four cards, and `scripts/og` exactly
the five sources, none of which ships; the footer's links read Work, About, Resume, LinkedIn and the
email; the LinkedIn link has its address, the new tab, `noopener noreferrer` and its note, and it is the
page's only mention of linkedin.com; every link that opens a new tab has `noopener noreferrer`; and the
footer's height token counts the second row of links below 30rem. A mutation run broke each new check in
turn (36 mutations), and every one was caught.

## About Copy delta

John's delta brief (October 2026): the homepage About section ("Creative instincts") takes his approved
copy in full, word for word, and keeps its design, animation, spacing and responsive behavior, adjusting
only what the new copy needs. Nothing else on the site changes; the portfolio's other copy and the
resume are untouched.

- **The copy** (`home.json` `about`). The headline is "Creative instincts. Operator discipline. Built for
  DeFi." The paragraphs: "For a decade, I built audiences and ran the business side of a global music
  project. That work landed sponsorships, media appearances, and major bookings. In 2021, I brought those
  skills to DeFi." / "Phi Labs Global hired me in 2024 to lead social across a product portfolio with an
  audience of more than 200,000 people. As the company grew, so did my role. I took ownership of
  positioning and messaging, technical documentation and websites, partnerships and KOL management, and
  campaigns and distribution." / "Today, I turn complex products into stories people understand and
  connect with." "Built for DeFi.", "lead social", the audience framing and "understand and connect with"
  are kept exactly as the brief asks.
- **Emphasis.** The headline keeps its plain display treatment. The paragraphs keep three highlights,
  one each, in the same blue-teal at a slightly heavier weight and never with a background: "global
  music project", "more than 200,000 people" and "stories" (where "globally distributed music project",
  the same audience figure and "market narratives" were).
- **The headline** (`About.astro`). Its three sentences are pieces of their own and each stays whole:
  on phones and tablets one to a line (three lines where there were two), and from 60rem one line across
  the canvas, as before. The longer line (about 21.2 of its own ems, was 15.6) is set at 4.1 frame units
  (was 5), capped at 4rem (was 5.5rem) once the container stops growing, so it spans about 95% of the
  canvas; a wider fallback face could only break it between two sentences, never push the page sideways.
  Below 24rem it is sized to the canvas, so "Operator discipline." never breaks in two (it did at 360px
  before; 375px and wider are unchanged).
- **Line wrapping.** On desktop the paragraphs' measure grew with the headline (47.5em, was 44em, about
  the headline's width) and their type stops a step sooner (1.8rem, was 1.9rem, as the headline's did), so
  from about 1130px to 2560px they take two, three and two lines, the second paragraph's three lines even
  (below about 1130px, where the canvas is narrower than the measure, it takes four even lines). From
  37.5rem every paragraph is balanced (none runs past six lines there), so no line is left short; phones
  keep `text-wrap: pretty`. The closing line holds its last three words together, so it always ends on
  "and connect with." and never on a lone "connect with.": on desktop "Today, I turn complex products into
  stories / people understand and connect with."; on a 390px phone "Today, I turn complex products / into
  stories people understand / and connect with." Everything holds while the words flow in: they take
  the same lines and places before, during and after the flow.

**Tested** (beyond `verify.mjs`, in Chromium with phones emulated by touch): the headline's lines and
width, each paragraph's lines and how full each is, and the frame at 35 sizes from 320x568 to
2560x1440 (laptop windows such as 1440x790, 1536x730 and 1728x970 included): one sentence to a line on
every phone and tablet, one line from 960px, never wider than the canvas; every paragraph's last line
at least two thirds full on tablets and desktops (a third on phones); the whole section in one screen at
every desktop size; no page scrolling sideways. The flow at nine sizes: every word on the same line and at the same place before, during and
after it (a no-break space would not have held the closing words while they flow; a span that does not
wrap does). Built side by side with the commit before: only the homepage and its stylesheet change, and
outside About the homepage's HTML is identical.

**The checks** (`verify.mjs`, `[claim]` and `[about]`): the headline's text and its three pieces; the
paragraphs word for word, the retained wording, the three highlights and the held closing words; the
retired phrases; and the layout: a line for each sentence on phones and tablets, one line from 60rem at
4.1vw and 4.1 frame units capped at 4rem, never held whole as one run, the small-phone sizing, `pretty`
and then balanced paragraphs, the 47.5em measure with its 1.8rem cap, the held words never wrapping, and
no background behind a highlight. A mutation run broke each new check in turn (24 mutations), and every
one was caught.

## Mobile Optimization V1

John's brief (October 2026), from screenshots and a screen recording on his phone: the first pass made
for phones, improving hierarchy, spacing, density and the phone's own interactions without redesigning
what already works. Phones here means below 48rem (768px); tablets and desktops keep their layouts, and
the one change made at every width is the Stack's order. The Creative Instinct section and the
homepage's case-study cards are unchanged.

- **The homepage hero** (`Hero.astro`). The moving name runs higher, its letters starting 0.6rem under
  the header row, through the hair and above the brows, the way a masthead sits behind a cover portrait:
  more of the lettering shows beside the head, none of it crosses the face, and it still runs behind the
  portrait. It is a little smaller (15vw, was 17vw), so whole words pass through the open wall, and the
  grade's darker band moves up with it while the wall stays as dark as before down to the shoulders. The
  rule across the chest is gone. The arrow, 20px (was about 26px) and drawn as heavy as before, now leads
  the descriptor as one lockup at the lower right, the two lines set left against it. With reduced motion
  the still name starts in the open wall beside the head, so its first word reads whole. The portrait's
  crop, the menu and the dark treatment are unchanged.
- **The work reel** (`WorkReel.astro`, `home.json` `reel.phoneRows` and `reel.alike`). Four rows of six,
  moving right, left, right, left (the fourth at its own rate, 0.9), at the same row height (about
  104px), every tile large enough to make out. The same 24 pieces are dealt again rather than repeated:
  the squarer pieces first, one to a row in turn (so every row runs longer than the screen and never
  repeats on a phone), then the look-alikes (the two explainer stills, the two Ambur frames, the two
  orange Archway fields, the two yellow Bolt fields and the three white Archway announcements), by a
  short search that keeps every group out of neighboring rows (a group of three must share one row
  once, and then sits at that row's two ends), then the rest, each to the row with the most room. Each
  row keeps the visit's own order, so the deal stays put for the session; a turn of the screen across
  48rem deals again. Wider screens keep three rows of eight, and without JavaScript a phone keeps the
  HTML's three rows. A fifth row was not needed: four leave no empty space.
- **The Stack** (`Capabilities.astro`, every width). See [From positioning to
  production](docs/SITE_SPEC.md#from-positioning-to-production): a strict grid, short last rows starting under the first
  column. Full rows sit exactly where they were.
- **Creator Marketing and Partnerships** (`CmHero.astro`, `CmContext.astro`). The hero's label and
  paragraph are centered under the centered headline (they set left before), the paragraph held a little
  in from the gutters (at most 22rem) in balanced lines. The campaign introduction is centered whole,
  headline, paragraph and roster line, on a slightly wider measure (1rem at the sides, was 1.25rem). In
  both, a hyphenated compound ("on-site", "co-sponsors") never splits across two centered lines, and a
  no-break space keeps "I" from ending one ("I led campaign strategy"); wider screens set the same lines
  as before.
- **Technical Product Marketing.** The hero's system (`TpmHero.astro`) needs nothing done on a phone:
  once it has assembled it opens and stays open, complete (the layers apart, the conduits lit, the
  signals running, the parts named in the legend beneath it), and the Show the system's parts control
  is gone, with no room kept for it; with reduced motion it shows complete at once. Tablets keep their
  visible control, and a mouse still engages it on desktop. The Foundation (`TpmFlow.astro`,
  `tpm.json` `foundation.stack`) shows one composed stack of four documents in place of the whole
  library: the Strategic Foundation Brief, Target Buyer Analysis and Market Pain Points Research behind,
  each showing its number and title, and Competitor Analysis whole in front, each card a few pixels to
  one side and a degree or so off square; beneath it one line, "The work grew into a multi-document
  marketing foundation." No button opens the rest and nothing turns it into a carousel. The stack is a
  picture to assistive technology, which reads the full library, kept in the page out of sight. In the
  statement, "follows:" never breaks: outside the live stage the words are plain text, so the colon is
  part of the word to the line breaker (the live stage, wide screens only, keeps its boxes and sets the
  line on a fixed 20em measure where the colon falls mid-line); the type size is unchanged. The
  technical documentation (`TpmDocs.astro`) plays its walkthrough alone, without the selected views and
  their controls beneath it, or the room they took.
- **Events and Multimedia Production** (`EvTransition.astro`). SECURE. BUILD. CAPTURE. CUT. AMPLIFY. no
  longer pins or fills the screen on a phone: the five words are a compact sequence numbered 01 to 05
  (the page's small numerals, in the accent), two columns of two, AMPLIFY. and its broadcast signal
  across the last row, the whole section well within one screen (about 45%). The same face, case and
  color, and the same motion: as the sequence comes into view each number and word wipes in, in turn (a
  wipe alone, so every letter shows at full strength once uncovered) and the signal plays its sequence
  once after AMPLIFY.; after that it stays. With reduced motion it is simply there. The numbers are
  hidden from assistive technology with the words; the phrase is read once. The production room, event
  film and presentation cards are unchanged.

**Tested** (beyond `verify.mjs`, in Chromium with phones emulated by touch): no page scrolls sideways at
twelve widths from 320 to 1920, top to bottom; at 360, 375, 390, 402, 414 and 430 (and 402x720 and
375x640, about a phone browser's visible height) the hero's name starts under the menu and ends above
the brows (on the smallest phone, 320x568, it reaches them); the reel's four rows over 3,000 random
visit orders (no piece twice, no look-alikes in neighboring rows or side by side, rows of six, the
squarer pieces two, two, two and one) and its deal again across 48rem and back; the Stack's columns at nine widths (every full desktop row exactly where it
was); the creator openings centered at seven phone widths with nothing changed at 768, 1440 and 1920;
the system open by itself at every phone width (and a tap never closing it), at rest on a touch tablet
and engaged by a mouse on desktop; the stack's headings clear of the cards in front of them; "follows:"
together at 76 widths, every 7px from 320 to 767 and the live stage from 960 to 2560; the documentation
frame with nothing beneath it; the Events sequence in its grid, revealed and complete at every phone
width, still with reduced motion, and pinned exactly as before at 768, 1440 and 1920; no clipped or
offscreen headline, no line that opens on punctuation, no heading under the header and every link and
control at least 24 by 24px on a phone; the earlier full-site behavior suite (97 checks) unchanged.
Built side by side with the commit before, at 1440 and 1920 with reduced motion the pages match pixel
for pixel except the Stack's second rows (and, on the creator page, sub-pixel shifts in two lines where
the compounds and the no-break space sit); with motion, the Technical Product Marketing stage matches
at every sampled scroll position.

**The checks** (`verify.mjs`, `[mobile]`): the hero's name, rule, lockup, grade and still name on phones,
and its place wider; the reel's fourth row, marked for phones and shown only where the phone deal has
run, the HTML's three rows of eight, the deal's pieces (shape and look-alike group) and its data; the
Stack's strict grids and column counts; the creator openings centered, their compounds and the bound
"I"; the system's missing control and its opening by itself; the Foundation's stack (its four
documents in order, hidden from assistive technology, its line, no button, phones only) and the library
kept for assistive technology; "follows:" set directly together and the still layout's plain words;
the documentation without its selected views; the Events sequence's numbers, grid, wipe-only reveal and
48rem pin. The existing checks now expect four reel rows in the HTML (the fourth empty), centered phone
openings on the creator page, and the sequence numbers as the transition's one exception to "no
numbers". A mutation run broke each new check in turn (41 mutations), and every one was caught.

## Social Share V1.1

John's delta brief (October 2026): the wide card looked good, but Slack's compact unfurl crops it
around its center and showed fragments of JOHN COWIN beside the face. The card is now crop-safe, every
preview names the site the same way, and every address the build writes for others to follow is on
johncowin.com. The homepage's share title and description, the browser title, the visible copy, the
case-study cards' designs, the hashing and the 1200 by 630 size are as they were.

- **A crop-safe card** (`scripts/og.mjs`, `npm run og -- home`; `og/home.jpg`, 68 KB). No name or
  headline in the image: the preview's own text carries those. The hero's own photograph (the wall
  toned toward the slate) and its foreground layer over it, scaled 0.94, John's face on the card's
  vertical center line (x 600) with his head 44 px from the top; both layers fade out toward the sides
  (opaque from 420 to 780 px, gone by 250 and 950) and the wall fades in from the top, over a dark ground
  with a soft slate glow behind him. The central 630 by 630 square, about what Slack's compact thumbnail
  shows, is therefore a complete, vignetted head-and-shoulders portrait with no type in it at all. Outside
  it, two small notes that nothing depends on: PORTFOLIO / SELECTED WORK in teal at the upper left, on
  two lines, and the disciplines at the lower right, stacked (POSITIONING, CONTENT, CAMPAIGNS,
  PRODUCTION: one line would cross into the square), each 72 px from the edges and at least 24 px
  clear of the square; the renderer stops if either would enter it. JPEG quality 92 with full chroma,
  inside the brief's 65 to 150 KB. Alt text: Portrait of John Cowin for his Web3 marketing and
  production portfolio.
- **One site name** (`site.json` `ogSiteName`: John Cowin Portfolio) for every page's `og:site_name`,
  the homepage, the three case studies, the 404 page and any page to come; the homepage-only override is
  gone. `site.name`, the structured data's Person name and the visible name stay John Cowin.
- **The public domain** (`public/CNAME`: exactly `johncowin.com`). The build now resolves its site to
  `https://johncowin.com`, so every canonical URL, `og:url`, `og:image` and X image, the Person's `url`,
  the sitemap and `robots.txt` use it, and nothing in the build names `jtcowin.github.io`. The deployment
  workflow and the domain's behavior are unchanged (the domain was already set in GitHub; no DNS change).
- **Dependencies.** On the Mac, `npm ci` restored the pinned versions from `package-lock.json` (Astro
  7.3.1; 7.4.1 had been installed there, and its builds wrote the font preloads as file paths); nothing
  was upgraded and the lockfile is unchanged. The cards were rendered in the cloud copy, which runs the
  same pinned versions.

**Tested** (beyond `verify.mjs`): the whole card, the centered 630 by 630 crop, and both at the sizes
apps show them (the card at about 330 px across, the square at 75 and 150 px); every card regenerated
(the creator and events cards byte for byte, the technical-marketing card with sub-pixel differences in
its type only, so all three stay as committed); built side by side with the commit before, the only
differences are the share tags' domain and site name, the homepage card and its alt text, the Person's
`url`, the sitemap, `robots.txt` and the new `CNAME`.

**The checks** (`verify.mjs`): every page's `og:site_name` is John Cowin Portfolio, from `ogSiteName`;
`public/CNAME` and the built `CNAME` hold exactly `johncowin.com`; every page's canonical URL, `og:url`,
`og:image` and X image begin with `https://johncowin.com/` and no head names `jtcowin.github.io`;
`robots.txt` and the sitemap point at johncowin.com; and V1's checks stand, the card's new alt text
included. A mutation run broke each in turn (32 mutations), and every one was caught.

## Social Share Polish V1

John's brief (October 2026): the homepage's link preview, as WhatsApp and other apps show it, repeated
the same words in its site name, title, description and image, so the card read as text and the image
as another headline. The preview now has its own metadata and a portrait-led card; the browser title,
the meta description, the page and the case studies' previews are unchanged. (WhatsApp's own green
container, stripe and URL line are WhatsApp's.)

- **Metadata** (`site.json` `homeShare`; `BaseLayout.astro` takes an optional `share` override, which
  only the homepage passes, and every other page keeps its own values).

  | | Before | Now |
  | --- | --- | --- |
  | `og:site_name` | John Cowin | John Cowin Portfolio |
  | `og:title`, `twitter:title` | John Cowin - Web3 Marketing, Strategy, & Content | Web3 Marketing, Strategy & Production |
  | `og:description`, `twitter:description` | John Cowin is a Web3 marketer working across positioning, technical content, creator programs, events, and multimedia production. Selected work, resume, and contact. | Selected work across positioning, technical content, creator campaigns, events, and multimedia production. |
  | `og:image`, `twitter:image` | `og/home.png` (the name and the descriptor in type) | `og/home.jpg` (portrait-led), with its own hash |
  | `og:image:alt` | John Cowin. Web3 Marketing, Strategy, & Content. | John Cowin portfolio social preview featuring his portrait and selected Web3 marketing disciplines. |

  The browser tab still reads "John Cowin - Web3 Marketing, Strategy, & Content"; `site.name`, the
  JSON-LD `name` and the hero's heading are still John Cowin; the search description is unchanged. The
  new site name is the homepage's only, by an OG-specific field (`homeShare.siteName`): the case
  studies keep "John Cowin", as the brief keeps their previews. The 404 page shares the homepage card,
  as before.
- **The card** (`scripts/og.mjs`, `npm run og -- home`). On the dark slate-to-black ground of the
  palette, the hero's own photograph on the right (`hero-portrait`, its wall toned down toward the
  slate) with the hero's foreground layer over it at full strength (`hero-foreground`), so John stands
  out; both fade into the ground behind the type, and the right edge crops his far shoulder. The face
  is large enough to read at a phone's preview width (about 330 pixels across). On the left, in a
  column of its own inside the safe area (72 px from the edges, the copy ending before the portrait at
  600 px): a small teal eyebrow, PORTFOLIO / SELECTED WORK (Manrope, light aqua); the name in two
  lines of Archivo capitals, JOHN / COWIN, large but held to the left half; and one small line,
  POSITIONING • CONTENT • CAMPAIGNS • PRODUCTION (Manrope, its separators in aqua). No title, rule or
  arrow; no screenshots. The text comes from `homeShare.image` and `site.name`; the renderer stops if any
  of it would clip or leave its column. A JPEG (quality 88, full chroma), 65 KB: the photograph would
  make a PNG several times larger, and WhatsApp is known to skip preview images much over 300 KB.
- **Caches.** The card's URL is new (`home.jpg?v=` and the file's hash), so apps fetch it fresh, but
  WhatsApp and others also cache the page's own preview for a while: to see the new one at once, share
  the homepage with a throwaway query (for example `https://johncowin.com/?v=share1`).

**For John to confirm.** The new site name is on the homepage only; one line makes it site-wide if you
want the case studies' previews to say John Cowin Portfolio too. The canonical and `og:url` addresses
still use `jtcowin.github.io` (which redirects to johncowin.com); a `public/CNAME` would switch every
page to johncowin.com, a site-wide change left for its own pass. (Both were done in [Social Share
V1.1](#social-share-v11), which also replaced this card with a crop-safe one.)

**The checks** (`verify.mjs`): the homepage's site name, title and description for Open Graph and X
come from `homeShare`; the tab title, the search description, `site.name`, the JSON-LD name and the
hero heading are unchanged; the card is `og/home.jpg`, a JPEG of exactly 1200 by 630 under 300 KB,
whose URL carries the file's hash, the same for X, with its alt text; `og/home.png` is gone; and each
case study keeps its own preview (site name, title, description, card and hash). A mutation run broke
each of these in turn (20 mutations), and every one was caught. Built side by side with the commit
before, only the homepage's and the 404 page's share tags changed (the 404 page shares the homepage
card). The accessibility scan finds nothing on all five pages at two widths, and `astro check`
reports no errors.

## Full Site Iteration V1.3

John's final desktop correction of the events montage after Full Site Iteration V1.2 (October 2026), with
a reference recording (`Screen Recording 2026-10-19 at 12.20.22 PM.mov`: V1.2's montage on the homepage,
cut from excerpts of the raw masters). Only the events card's video, its poster and its record change;
everything approved in V1 through V1.2, the reordered Events chapters included, is as it was.

- **The montage, from the approved edits** (`home-events-montage-fs13.mp4`, 38.37 seconds, 8.9 MB, its
  manifest entry and poster). No new edit from the masters: the Events page's four approved edits are
  the montage, each a locked module played whole, at its own speed, with its own cuts, dissolves,
  pacing and framing, in this order:
  1. The production room: the Final loop (`ev-room-final-loop`, 8.84 s), both of the explainer's
     scenes with their kinetic type complete (Bolt solves slippage by providing you a deterministic
     price; you have a set execution price that will be filled). Moving footage only; the
     behind-the-scenes photograph stays out.
  2. Sui Fest: the event film (`ev-hero-event-film`, 11.97 s), its two-cut edit: we asked our favorite
     teams, the film's quick run of the event, and the interview it ends on. V1.2's boxing-game excerpt
     (from another part of the master) is gone.
  3. Jungle Talk: the podcast (`ev-hero-podcast`, 7.72 s), the wide, the medium and the closer shot,
     not shortened, at the top 80% of its frame as the card has always shown it, so its burned-in
     captions and corner marks stay out.
  4. The live presentation (`ev-hero-presentation`, 10.22 s), last: its three excerpts and their two
     restrained dissolves, the recording's whole 2.157:1 frame letterboxed onto its own dark ground as
     before (nothing cropped).
- **The joins.** At each of the three joins the picture changes clearly (the explainer's close-up to
  the Sui Fest floor, the dark interview to the bright podcast table, the palms to the dark title
  slide), so they are clean cuts, the kind of cut the V1.1 and V1.2 montages made between the same
  scenes. The presentation's yellow on dark returns to the production room with the one restrained
  dissolve (0.4 s, as before) into the explainer's title as it builds, and the loop is turned to start
  on the completed title (BOLT SOLVES SLIPPAGE, the module's frame 21), which is also the poster, so the
  last frame steps into the first like any other frame. No title card, separator or new type.
- **Integrity, frame by frame.** Every frame of the montage was decoded and compared with the Events
  page's own file for its module (Jungle Talk cropped and the presentation letterboxed as the montage
  shows them): each module's frames are all there, in their own order, at offset zero (none dropped,
  repeated, reordered or retimed; one frame either way fits far worse), apart from the frames the reset
  dissolve blends (the presentation's last nine and the explainer's first ten). The mean difference is
  0.4 to 1.9 levels in 255, the encode's own loss. The run is the four lengths less the dissolve: 929
  module frames, 920 in the loop, 38.37 seconds at 23.976 fps.
- **The encode.** The whole 16:9 frame at 1600 by 900, silent, H.264 High at CRF 27 (`-preset slower
  -tune film`), a 3.6 Mbps cap, a keyframe every two seconds, the index first: 8.9 MB, lighter than the
  four files it plays (10.7 MB on the Events page). Four whole modules run 38.4 seconds, so the file
  passes the 5 MiB the other cards keep, as the brief allows rather than fragmenting them. The cap was
  set by measuring each module against a lossless assembly (SSIM): Jungle Talk's palms are the most
  demanding, 0.948 at 3.6 Mbps (0.926 at 2.4 Mbps, a 7.5 MB file, where the fronds soften), the other
  three 0.989 to 0.995, which a higher cap barely moves. The card's playback is unchanged: silent
  autoplay as the card comes to rest, the play and pause button, the file loading only as the card
  comes near, the poster alone with reduced motion, data saving and on phones (a lighter file for
  phones can follow).

**For John to confirm.** The three joins are clean cuts; the largest change in brightness is the Sui
Fest interview (dark, magenta) into the bright podcast table, and a short dissolve (0.25 s) can go in
there or at any join if one reads too harsh. The file is 8.9 MB; at 7.5 MB the podcast's palms
soften. The montage runs 38.37 seconds, within the brief's 38 to 40.

**The checks** (`verify.mjs`): card 03 plays `home-events-montage-fs13.mp4`, 38.37 s and under 9 MiB
(the other cards under 5); its record lists the four modules in playing order, numbered, each with its
file and length, and each is that approved file at that length (as recorded and as it plays); the
montage runs their sum less the one dissolve, between 38 and 40 seconds; Jungle Talk's framing and the
presentation's letterbox are recorded; the record names the clean cuts, the one dissolve reset and
nothing added inside a module, and lists no excerpt of a raw master; no still; the V1.2 file gone. A
mutation run broke each of these and the earlier promises in turn (108 mutations), and every one was
caught. A browser pass (97 checks, V1.1's, V1.2's and V1.3's) confirmed the montage playing at 38.37 s
in its whole frame and coming round through its reset; played twice through in real time without
stopping (two passes of 38.34 and 38.35 s in 76.8 s, the longest gap between frames 70 ms, none of
1,841 dropped); loading only as its card comes near; and, with reduced motion or data saving, the
poster with no autoplay and the button playing it on request; with V1.2's deck order, the cards, the
hero and the rest unchanged, and no sideways scroll or page error from 360 to 2560 wide. Built side by
side with V1.2, the site differs only in card 03's video, its poster and its label: every other page,
stylesheet and script is identical. The accessibility scan finds nothing on all five pages at two
widths, and `astro check` reports no errors.

## Full Site Iteration V1.2

John's delta brief after Full Site Iteration V1.1 (October 2026): two changes; everything else is as
approved.

- **01 The events montage, expanded** (`home-events-montage-fs12.mp4`, 15.72 seconds, 4.8 MB, its
  manifest entry and poster). V1.1's 8.09 seconds felt short beside the creator card's 15.52. Now, in
  the brief's order:
  - The production room opens the loop with a developed sequence in place of one brief shot: the
    finished title (Bolt solves slippage, the loop's first frame and its poster), then three of the
    explainer's own camera angles, 1.1 to 1.4 seconds each: the side camera as the name super (Max
    McKendry, Bolt Foundation) builds, the wide on the set (the room, the light and the subject), and
    the front camera's medium. That is 4.3 seconds of the room before Sui Fest, and the title builds
    again as the loop closes. The room's cameras and light appear in no moving footage (only in the
    behind-the-scenes photograph, which stays out of the card), so the multi-camera setup reads through
    the cuts between its own angles.
  - Sui Fest gains two shots of the event, each a kind of moment it did not have: the Sui Cafe booth
    and its crowd, and an attendee at a boxing game (the film's own quick B-roll, about half a second
    each), among the title, the logo and neon entrance, the crew filming and the smiling guest: 4.8
    seconds in all (3.7 before). A third candidate, two attendees waving at the camera, says what the
    smiling guest already says, so it is left out.
  - Jungle Talk shows three angles in 4 seconds: the whole table, the film's own cut to the medium on
    the conversation, then the close angle on the speaker (its top 80%, as before, so its captions and
    corner marks stay out).
  - The live presentation still ends it (2.2 seconds), its title slide dissolving back into the
    explainer's title, and the loop starts on the completed title with no seam (the last frame steps
    into the first like any other frame).
  - Every trim is half a frame inside its range and the edit was scanned frame by frame (no stray
    frame from a neighboring shot); the whole 16:9 frame; H.264 at V1.1's settings (CRF 23, a 3 Mbps
    cap), silent, the index first.
- **02 The Events chapters reordered** (`events.json`; notes in `EvDeck.astro`, `EvHero.astro` and
  `events-video.astro`). The deck leads with its strongest visual work: 01 PRODUCTION ROOM, 02 EVENT
  FILM, 03 LIVE PRESENTATION (it opened on the live presentation before). The order is the data's, so
  everything that depends on it follows at once: the numbers and labels, the chapter open as the deck
  arrives (the production room, on Final, its Setup and Final control on the top line), each header's
  region, the assistive heading that names the three, the arrow keys, Home and End, the Tab order (each
  chapter's controls after its own header), the reading order, and the scroll-assisted turns: the
  reader's scrolling opens the event film, then the live presentation, and after the live
  presentation's interval the deck lets go into the conclusion (The room clears. The work keeps
  moving.). Phones and reduced motion keep the manual accordion, in the same order. The hero's reel
  already ran the three in this order (the explainer first, then the Sui Fest film, the creator podcast
  and the live presentation), and `verify.mjs` now holds the two to one order. The way in reads as one
  sequence: the activation's planning (The work starts before anyone enters the room.) hands on to the
  room where the explainer was made, and the live presentation hands on to the conclusion. Each
  chapter's words, media and inner layout are unchanged; no transition copy names the order, so none
  had to change.

**For John to confirm.** The production room's opening is the explainer's own three angles after its
title; the cameras and light themselves appear only in the behind-the-scenes photograph, which the card
cannot use. The title stays the loop's first frame and poster, so the reset still dissolves yellow into
yellow. The montage runs 15.72 seconds and weighs 4.8 MB (V1.1's 2.6 MB), within the 5 MiB a card is
allowed; it loads only as its card comes near. While the event film is open on a laptop screen it is
taller than the room on screen, so, as the scroll-assisted deck has done for any long chapter since
V1.6, the header above it passes under the site's header while the film's foot comes into view.

**The checks** (`verify.mjs`): the montage's file and length (15.72 s, within 1.5 s of the creator
card's), its record's excerpts in playing order (the explainer four times, the side, wide and front
angles after the title and at least 3 seconds of them; Sui Fest six times; Jungle Talk twice, with the
film's own cut and the close angle; the presentation last), no still; the V1.1 montage gone; the deck's
order in the data and on the page (production room, event film, live presentation), the production room
open first, the numbered labels, the hero's reel in the same order, and every chapter's words, credits
and media found by its key rather than its place. A mutation run broke each of these and the earlier
promises in turn (101 mutations), and every one was caught. A browser pass (90 checks, V1.1's and
V1.2's) confirmed the montage playing whole at 15.72 s and coming round through its reset, the deck's
order on screen, in the markup and in the assistive name with motion allowed, with reduced motion and on
a phone, the production room open first, the arrow keys, Tab and Enter, the scroll-assisted turns
forward and back and the release into the conclusion, and the hero's reel in the same order; and no
sideways scroll or page error from 360 to 2560 wide. The accessibility scan finds nothing on all five
pages at two widths, and `astro check` reports no errors.

## Full Site Iteration V1.1

John's delta brief after Full Site Iteration V1 (October 2026), with a reference recording (`Screen
Recording 2026-10-18 at 8.53.03 PM.mov`, in which the hero's moving name shows across John for about a
third of a second while the portrait resolves). Only these five changes; everything else is as approved.

- **01 A slightly quicker loader** (`Intro.astro`). The hero's reveal at 2.12 seconds (2.27 before): the
  0.15 seconds come from the fully legible hold alone (1.53 to 1.38 seconds), so the coded resolve keeps
  its 0.7 seconds and the note its legibility. The marker's run is the reveal less its start, so it keeps
  its accelerating curve and still arrives as the hold ends, a little quicker at the finish; the ground's
  0.4 second clear and the reduced-motion treatment are unchanged. With the hero's entrance the whole
  sequence takes about 3.26 seconds.
- **02 The name always behind the portrait** (`Hero.astro`, `Header.astro`). The entrance in the brief's
  order: the photograph and its grade; the portrait, in place above the rear layers from the first paint
  (fully opaque, settling with the photograph on one clock; V1's fade-in of the cutout, during which the
  name showed across John, is gone); once the ground has gone (0.4 s), the moving name and the rule behind
  the portrait (the name from 0.4 s, the rule from 0.44 s); then the descriptor, the navigation and the
  arrow (0.76 to 0.8 s), complete 1.14 s after the ground starts to clear. The name's layer also waits for
  the portrait image itself, hidden until the cutout has loaded and decoded (see [Hero photograph and
  layering](docs/SITE_SPEC.md#hero-photograph-and-layering)), so a slow connection never shows the name across John
  either. The final composition is unchanged.
- **03 Complete 16:9 videos in larger cards** (`WorkPanels.astro`, `index.astro`, `content.config.ts`).
  Each card's frame is an exact 16:9 at every width, at the card's full inner width, the video and its
  poster contained in it as a safeguard, so nothing is cropped and the Technical Product Marketing hero
  animation shows whole (V1's centered band is gone, and with it the card's `focus` option). The cards
  are taller (the head, then the complete frame); in the stack each is the widest that fits the screen
  below the header whole, centered, scaling down in proportion on shorter screens. The stacking
  interaction, its order and its hierarchy are as before, and the run between cards follows from the
  taller cards. Under 45rem of height the cards read in sequence. The pinned introduction needs 82rem of
  height now (a complete card under it, 2560x1440 for one); elsewhere it scrolls away before the stack.
  See [Select Work](docs/SITE_SPEC.md#select-work) for the sizes, measured from 1024x768 to 2560x1440.
- **04 The events montage, moving footage only** (`home-events-montage-fs11.mp4`, 8.09 seconds, its
  manifest entry). V1's still of the production room (a slow push across the behind-the-scenes
  photograph) is gone. The only moving footage of the production room is the finished explainer, already
  the montage's opening (its own opening, the empty set and Max walking in under What is slippage, is
  mostly full-frame kinetic type), so the setup beat is omitted rather than replaced, and the explainer's
  title is at its own framing again (V1's reframe served the cropped band). Sui Fest, the creator
  podcast and the live presentation, the dark-to-dark reset and the loop's start on the completed title
  are as before. No homepage card video holds a still image, freeze frame or move across a photograph.
- **05 The activation's paragraph centered** (`EvActivation.astro`). On wide screens the headline stays in
  the left column and the paragraph in the right, set left, and the paragraph block is centered against
  the headline's full height (`align-items: center` on the row; V1's cap-top margin is gone): measured
  within 0.01 px between their midpoints at 1024, 1280, 1440 and 1920. Small screens stack as before.

**For John to confirm.** The pinned introduction gives way on most desktop screens, since a complete card
needs the height. Narrower cards are centered under the left-aligned headline. The production room's
setup beat is omitted, as the brief allows when no moving footage of it exists. The explainer's title is
back at its own framing. If the portrait image cannot load at all, the name stays hidden.

**The checks** (`verify.mjs`): the reveal at 2.10 to 2.15 seconds, the time taken from the hold alone; the
portrait with no opacity of its own and above the name's layer, the name and its rule only once the
ground has gone, the stages in order and complete in 0.9 to 1.2 seconds; the load gate (an inline script
after the portrait that waits for it to decode, and the name's layer hidden until `data-subject`); the
cards' exact 16:9 frame at every width, contained, with no `focus`; the card's height worked out from its
width, its width in and out of the stack, no fixed height, the equalized heads and the playback reading
the stack from the stylesheet; the stack only from 45rem of height and the pinned introduction only from
82rem; the re-cut events montage, its order and its length, and no still in any card video's record; the
replaced montage gone; the activation centered with no offsetting margin. A mutation run broke each of
these and the earlier promises in turn (83 mutations), and every one was caught. A browser pass
(65 checks) confirmed the reveal at 2.12 seconds, the portrait fully opaque at every 20 ms of the
entrance, no pixel of the name or the rule on the portrait in eight frames through it, the name waiting
for a late portrait on a first visit and on a return visit, the cards whole and exactly 16:9 at ten
screen sizes, the hero animation shown whole, one video at a time, the pinned introduction only where it
fits, the activation's midpoints level at four widths, and no sideways scroll or page error from 360 to
2560 wide. The accessibility scan finds nothing on all five pages at two widths, and `astro check`
reports no errors.

## Full Site Iteration V1

John's Full Site Iteration V1 brief (October 2026) is a pass of surgical refinements across the
published site: copy, hierarchy, media editing, emphasis and alignment. The structure and the creative
direction are approved, so nothing is redesigned and no new system is introduced beyond what the brief
asks for; everything it does not name is as described elsewhere in this README. No visitor-facing copy
uses an em dash.

- **01 The hero's staged entrance** (`Hero.astro`, `Header.astro`, `Intro.astro`). Four overlapping
  stages after the loader: the photograph and its grade; the moving name and the rule behind it, the
  name starting to move as the rule draws; the foreground subject resolving above the name; then the
  descriptor, the navigation and the arrow. Complete 1.1 seconds after the loader's ground starts to
  clear (see [Hero photograph and layering](docs/SITE_SPEC.md#hero-photograph-and-layering)); no bounce, heavy blur or
  large travel; reduced motion keeps the simple fade.
- **02 Creative Instincts** (`home.json`). Paragraphs one and two word for word as decided ("...and major
  bookings along the way."; "...my role expanded into positioning and messaging, technical documentation
  and websites, partnerships and KOL management, and campaigns and distribution."), the third unchanged,
  and exactly the same three highlights. The paragraphs now take three, three and two lines (the first
  never ends on one word), and the section still fits one screen.
- **03 One video per card** (`WorkPanels.astro`, `content.config.ts`, the case studies' frontmatter,
  `assets.json`). The supporting panels, their hover previews, the three-panel grid and the typographic
  stand-ins are gone; each card plays one landscape video at its full media width in one shared frame:
  the new creator montage, the Technical Product Marketing hero animation alone, and the new events
  montage (see [Select Work](docs/SITE_SPEC.md#select-work) for the frame, the edits and their timings). The stack, the
  number and label, the title, the subline, the link, autoplay for the active card only, the pause
  control, the poster and the reduced-motion and data-saving behavior are as before. Retired with the
  panels: the Costa Rica, Trezor, Bolt Bus, architecture, slippage preview, Sui Fest and Sui Summit card
  loops, their posters and their manifest entries (`tm-website-motion` stays, since the Technical Product
  Marketing MDX's earlier narrative still lists it).
- **04 The practice paragraph** and **05 the capability icons** (`home.json`, `Capabilities.astro`): see
  [From positioning to production](docs/SITE_SPEC.md#from-positioning-to-production).
- **06 Emphasis** (`index.astro`, `Contact.astro`, `global.css`). Select Work's introduction emphasizes
  "strategy through execution"; Contact's "Its story shouldn't be." takes the accent color; nothing on
  the card sublines, the Stack or About beyond its three highlights. One rule, `.tpm-em, .em-key`: a
  slightly heavier weight (600) in the surrounding color.
- **07 and 08 The program introduction** (`CmContext.astro`, `creator.json`). The paragraph widens to
  56rem (54 to 60), centered at the same size, so it sets in fewer, longer lines; its one emphasis is "I
  led campaign strategy with co-sponsors". The rule and the roster line stay; the roster line reads "The
  roster brought together creators across streaming, crypto media, ecosystem leadership, entertainment,
  and community." (no count), and the build refuses a creator count there.
- **09 Singapore** (`creator.json`): "A city-wide conference activation spanning a crypto game show on a
  party bus, high tea above Singapore, and a creator shopping experience through the city."
- **10 The Trezor sample is 60 posts everywhere** (`creator.json`, `assets.json`, `CmTrezor.astro`): the
  third highlight reads "#2", "by reach out of 60 posts"; the note, "Measured on the creator's account
  against its preceding 60 posts."; the manifest's metric entries, their labels, their accessible text
  and their source notes say 60. The figures, the multiple, the ranking and the 98th-percentile line are
  unchanged, and the earlier sample appears nowhere (`verify.mjs` searches the page, the data, the
  manifest and the component).
- **11 The Trezor feedback, centered** (`CmTrezor.astro`). The quotation, its four teal phrases and the
  attribution as one centered block on a 52rem measure, the quotation's lines balanced, the attribution
  centered under a short hairline. No highlighter (the phrases are still type alone: the page's deep
  teal, one step heavier).
- **12 A quiet transition** (`CmTrezor.astro`). After the feedback, one centered 1px rule, strongest at
  its middle and fading to nothing at both ends (transparent, then the teal at 55%, then transparent),
  66% of the width up to 52rem, with generous space above (3 to 6rem) and below. With motion allowed it
  draws out once from its center (1.1 s) as it comes into view; with reduced motion it is simply there.
  No illustration, card, icon or wave.
- **13 and 15 The library's frame** (`CmLibrary.astro`, `cm-motion.ts`, `creator.json`). The SELECTED
  CONTENT eyebrow above "One program, many formats." is gone, and so is the changing caption at the
  frame's lower left (the format and the place) with its cue data and its script; the pause and play
  control stays at the lower right. The tabs still name the format on screen.
- **14 Destination films** (`cm-library-destination-fs1.mp4`, 9.47 seconds). The cloud zoom into Mykonos
  runs on into the courtyard and John's moment there, 0:31.82 to 0:32.47 of the Mykonos aftermovie,
  readable for about two thirds of a second, live footage (no freeze), ending on the last frame before
  his next caption word, then the villa terrace. The edit now runs at the aftermovie's own 23.976 fps,
  the Costa Rica aerials retimed 4% slower, so John's moment keeps its length. His shirt carries a
  small Club Zero mark, left as it is (nothing cropped or blurred).
- **16 Shiv's Trezor packing** (Shiv Costa Rica Vlog.mp4, 0:06.80 to 0:08.30): tested and left out. Its
  three clearest consecutive shots (0:07.52 to 0:08.88) at 70% speed run 1.96 seconds; optical-flow
  interpolation smeared the box's edges, and the frame-repeating version still read as hectic (its
  frame-to-frame motion about five times the sponsor edit's, the box legible for about half a second),
  so it stays excluded, as in V1.4.
- **17 Behind the scenes** (`cm-library-bts-fs1.mp4`, 11.0 seconds). The Lock In Podcast is one brief
  moment: a camera on the set (stopping before its operator steps into frame), then one wide angle of the
  recording, about two seconds in all; the two close-ups and the rest of the two-shot are gone. The time
  goes to production the Podcasts format does not show: a creator filming herself in the pool, the yoga
  class on a phone screen (Costa Rica), editing at laptops on the terrace, a pocket camera on the
  catamaran and dinner filmed on a phone (Mykonos). The bathroom laughter and every other approved
  moment stay.
- **18 The credits** (`creator.json`). John: "Co-led program planning, travel, villa, and trip logistics;
  led campaign strategy with co-sponsors, sponsor coordination, creative direction, on-site shoot
  management, approvals, distribution, campaign tracking, reporting, and ongoing creator and partner
  communication." Maanav: "Collaborated on creator and co-sponsor sourcing, interviews, selection,
  negotiations, legal contracts, travel, villas, and trip logistics." Bob's line, the handles, the
  co-sponsors, the brand and the hero photography credit are unchanged; the line on varying on-site
  ownership is gone.
- **19 to 22 Technical Product Marketing** (`tpm.json`). The emphasis system is unchanged and nothing new
  is emphasized. 05's goal: "Replace outdated documentation with a clear, structured system for technical
  audiences while controlling what product information could be made public." Its contribution: "I rebuilt
  the documentation from the ground up, moving it from an outdated GitBook into a purpose-built Mintlify
  documentation system. I owned the architecture, technical writing, cross-references, calls to action,
  MDX build, and GitHub publishing, working across engineering, growth, and design to make complex product
  information useful, accurate, and appropriate for public release." The overview's note: "One branded
  Mintlify system in place of outdated GitBook documentation, organized from product understanding to
  implementation." The interactive architecture's note: "I developed the early diagram with engineering,
  validated it with the liquidity team, refined its structure, filtered out internal-only information,
  briefed design, and wrote every pop-up explanation." (Bob van der Meer stays credited in 05's Credits.)
  The conclusion: "The work began with a shared product language and carried across the full
  public-facing system, from the website and technical documentation to campaigns, articles, content, and
  every expression built from the same strategic foundation." under the same headline.
- **23 Contact** (`Contact.astro`, every page): see [Contact and the closing frame](docs/SITE_SPEC.md#contact-and-the-closing-frame).
- **24 The Events activation** (`EvActivation.astro`). On wide screens the headline and the paragraph are
  top-aligned (V1.6 set them on the row's foot), the paragraph moved by the difference between where each
  face's capitals start in its line (Archivo 0.1365em at 0.98, Manrope 0.4986em at 1.7), so its first line
  stands level with the headline's cap top: measured 0 px apart at 1280, 1440 and 1920. The widths, the
  gap and the rendering are as before; small screens stack as before.
- **25 The guardrails**, site-wide: at most one emphasized phrase in a paragraph (the Trezor quotation
  keeps its approved phrases), only accent color, a slightly heavier weight, or both with restraint, and
  never a highlighter, background, pill or decorative underline.

**Media notes.** Masters stay outside the repository. The Sui Summit presentation's first seconds were
cut from `Max Presentation.mp4` on John's Mac (0:00 to 0:05.2) and read from that excerpt. The
library edits are 1280x720 and 960x540 (`-fs1` names, so no browser keeps an older cut; the V1.4 and
V1.2 files are gone): destination films 3.9 and 2.0 MB, behind the scenes 4.3 and 2.2 MB. Every new edit
was scanned frame by frame (no one-frame flash or stray frame from a neighboring shot anywhere, each
wrap as smooth as an ordinary frame step) and reviewed against the desktop bands.

**For John to confirm.** The hero's entrance completes 1.1 seconds after the loader's ground starts to
clear, 0.7 seconds after it has gone (read as "after the loading screen clears" from its start; a
0.3 second longer entrance is a one-line change). On desktop the cards show a centered band of each
16:9 edit (2.58:1 to 3.75:1 with the screen), so the montages were framed for it, and the hero
animation's outermost type can touch the frame at the widest bands. The events montage opens on the
explainer's title, reframed 10% smaller and lower with the plain wall extended, and its podcast shot is
Jungle Talk's top 80% (its captions and the corner marks, Club Zero's among them, fall outside). John's
moment in destination films shows the small Club Zero mark on his shirt. Shiv's packing stays out. The
creator montage is 4.7 MB (the check's limit is now 5 MB a card, as each card has one video).

**The checks** (`verify.mjs`, updated throughout for Full Site Iteration V1): the decided copy, word
for word, and its single emphases (Select Work, the practice statement, the program paragraph) as
`.em-key`, one rule with `.tpm-em`; one video per card, the right file, a 16:9 frame on phones and one
shared size on desktop, no panel, stand-in, fallback or hover-play left, each video under 5 MB, silent,
H.264, index first, at its length, with its poster; the retired card files, posters and manifest entries
gone; the capability icon's single 360 degree turn (450 to 650 ms, ease-out, once, only for a fine
pointer and with motion allowed), the completed state for hover and focus, focus never turning it,
color alone with reduced motion, no tilt; the Contact accent on every page; the hero's four overlapping
stages, the name moving as the rule draws, complete 0.9 to 1.2 seconds in, no bounce, blur or large
travel; the Technical Product Marketing goal, contribution, notes and conclusion, Bob's credit kept in
05's Credits; no creator count in the roster line; the 54 to 60rem paragraph; Singapore; 60 posts
everywhere and 56 nowhere; the centered feedback; the transition rule (gradient, 1px, 60 to 70%, its
center-out reveal only with motion); the library's eyebrow, caption and cues gone and the control at
the lower right; John's moment (0.6 to 1.0 seconds, live) and behind the scenes' brief Lock In moment;
the credits; the activation's top alignment; the events montage's order; and, site-wide, no paragraph
with two emphases and no highlighter or underline mark. A mutation run broke each of these promises in
turn (58 mutations) and every one was caught, and a browser pass (40 checks) confirmed the behavior: the
hero's stages and their timing in the running animations, the icon's single turn and its completed
state, one card video at a time as each card rests, the frames' shared size and 16:9 on phones, the
emphasis weights, the accent, the rule drawing out from its center, the library's bar, the activation's
cap tops level at three widths, and no sideways scroll on any page from 360 to 1920. The accessibility
scan finds nothing on all five pages at two widths, and `astro check` reports no errors.

## Creator Marketing and Partnerships, Version 1.4

John's Creator Marketing and Partnerships V1.4 brief (October 2026) is a delta against the deployed
Version 1.3: only what it names changed, and everything else is Version 1.3 as described below. No
visitor-facing copy uses an em dash.

- **01 and 02 The loader** (`Intro.astro`, the homepage). The note is still exactly BEST EXPERIENCED ON
  DESKTOP over the same path and marker; the three phrases stay gone. V1.2's soft letter rise is
  replaced by a short coded resolve, once: left to right, each position cycles for 80 ms through a
  fixed set of fourteen monospace code glyphs (`< > / _ { } [ ] = + * # 0 1`) in the accent, about
  every other frame, before its letter settles; only the two or three positions at the leading edge
  scramble, a resolved letter never changes again, and the whole line is legible 0.74 seconds in and
  held, still, for 1.53 seconds. The line keeps its resting spacing from the start (a waiting letter is
  only transparent, so nothing moves), and there is no cursor, caret, blinking, flash, tearing, color
  fringe, scan line or particle, and nothing after the line has resolved. The glyphs are timed from the
  letters' own CSS animation (its delay and its clock), so they never drift from it and pause with it
  in a background tab, and the stylesheet takes each glyph away at its letter's moment on that same
  clock, so a glyph and its letter never show together; the sequence is fixed, not chance. The marker now gathers speed on
  `cubic-bezier(0.4, 0.12, 0.82, 0.45)`: it sets off at about a third of its average pace, its speed
  nearly doubles through the middle third, it covers the last quarter of the path in the last tenth of
  the time and arrives at three times its average pace, with no overshoot, bounce or pause, as the note
  leaves and the ground clears into the hero; its streak lengthens with the speed. A pace, not a
  measure of loading. The length is unchanged (the reveal at 2.27 seconds, the hero in place at about
  2.9), and so are the skip on any intent and once per session. With reduced motion there is no
  scramble and no travel: the ground clears straight to the hero (were the note shown, it would only
  fade in).
- **03 The Foundation's hold** (`TpmFlow.astro`, Technical Product Marketing). A new first phase of the
  pinned stage, `stack` (0.15 of a screen, before `spread`): once the frame has pinned and the stack
  has settled (the dark surface's rise and the documents' fade-in still run before it, from the first
  pixel of the scroll), the whole stack stays together for that stretch, then spreads, eased in and out
  (it eased out from its first pixel before, which would have jolted after a hold). A phase of the
  scroll, not a timer: it lasts exactly as long as the reader scrolls through it, about half a second
  at an ordinary trackpad pace. Measured in the browser: 0.15 to 0.16 of a screen at 1920 by 1080,
  1440 by 900 and 1280 by 720. The rail, the exit, the statement and its 0.35-screen hold are as they
  were, so there is no second dead stretch at the release; the pin is 3.7 screens (3.55).
- **04 The walkthrough pauses** (`bolt-docs-walkthrough-v14.mp4` and `-v14-720.mp4`). Each of the four
  places the brief names was read frame by frame in the approved takes (both stay outside the
  repository, untouched), for whether the hesitation is only redundant still frames between two parts
  of the same movement:
  - Website, about 0:03 (2.83 to 3.16 seconds of the take): the page stops, but the hero's dotted arc
    is still fading out through the pause. Not redundant: left as it is.
  - Website, about 0:33, "Live infrastructure. Measurable proof." (32.65 to 33.02 seconds): the page
    stops between a short scroll and the next, but the Daily Capital Turnover gauge keeps animating and
    the Backed by logo rail keeps moving (about 12 pixels in the pause). Taking the pause out would
    make both jump: left as it is.
  - Documentation, about 0:04 to 0:05, Documentation Overview (4.39 to 4.73 seconds): the rotating
    headline is still resolving in the pause. Left as it is.
  - Documentation, about 0:42, Developer SDK (42.43 to 42.78 seconds of the take, 25.33 to 25.67 of the
    edit): 21 frames identical to the one before them (no pixel changed beyond encoding noise), between
    a short scroll that eases to a stop and the scroll that follows. Taken out: the page now eases and
    moves on without stopping; the step across the join is smaller than an ordinary frame of the scroll
    on either side of it, and nothing jumps. The edit is otherwise the same frame for frame, made from
    the same intermediate with the same encodes (which reproduce the deployed files bit for bit), and
    runs 32.85 seconds (33.2); the chapter starts (0, 10.45 and 22.95 seconds) are unchanged.
  The live page's timing, its scroll handling and `tpm-motion.ts` are unchanged. The brief's closing
  guardrail asks to treat the TPM hiccups as page-motion issues, not video-export issues, while item 04
  places them in the recordings; this follows item 04 (the page's own motion has no pause at either
  point).
- **05 Singapore, Eva's glasses** (`cm-singapore-loop-v14.mp4`, 7.67 seconds). The shot is only 17
  frames in the source (0.71 seconds, between two cuts), so it is used whole, slowed to 0.58x with
  motion interpolation (no frozen frame: nothing past its last real frame is shown) and cut in hard
  after Eva and Ashley at the display: fully visible for 0.96 seconds before a 0.24-second dissolve into
  Marina Bay, which opens the loop. The rest of V1.3's Singapore is as it was.
- **06 Mykonos, the two flashes** (`cm-mykonos-loop-v14.mp4`, 6.72 seconds). Each was the first frame of
  the aftermovie's next shot, kept at the end of an excerpt and showing through the dissolve after it:
  the catamaran ended at 1:54.98 and the swimmers at 2:00.90, each one frame into the next shot. Each
  now ends a frame earlier (1:54.96 and 2:00.88), so every cut and dissolve joins only the two intended
  shots; no fade or blur is added and the podcast and catamaran sequence is unchanged. Reviewed over
  three full cycles, end to start included: no one-frame flash anywhere, and the wrap is smoother than
  the loop's own median frame step. The same defect, found by the same scan, is fixed in the game show
  edit (`cm-library-gameshow-v14.mp4`: its second trailer excerpt ended at 0:09.43, a frame into the
  next shot; now 0:09.42).
- **07 The Trezor highlights** (`creator.json`, `assets.json`, `CmTrezor.astro`). The centered
  composition is unchanged. The middle figure reads `2.2x` (a screen reader hears "2.2 times"); the
  note is one sentence, "Measured on the creator's account against its preceding posts." (the sample
  given as 60 posts since Full Site Iteration V1), the creator-account-results sentence gone. `524%` above
  the account's average impressions, `2.2x` the account's average total engagement and `#2` by reach
  out of the sample's posts, with the 98th-percentile line; no raw totals.
- **08 The program introduction** (`CmContext.astro`). The split layout is replaced by one full-width,
  centered editorial composition: the headline at the top center in a narrow measure ("Each
  destination / became a campaign / in motion.", "a campaign in motion." in the teal; four lines on
  the narrowest phones), the paragraph beneath it at 46rem, then a short centered rule (a 40-pixel
  hairline) and the roster line, smaller and quieter, with no card, pill, badge or box. More room above
  and below it than V1.3, and an ordinary section end straight into Costa Rica (64 to 104 pixels after
  the roster line, no blank pause). The headline rises into place first, the paragraph follows a
  quarter second later with a short upward fade, and the roster line half a second later; with reduced
  motion they are simply there. On phones the headline stays centered and the paragraph and the roster
  line set left, in the same order. Nothing in it is interactive.
- **09 Destination films** (`cm-library-destination-v14.mp4`, 8.0 seconds). Both shots with Club Zero
  branding are gone (the Costa Rica aftermovie's villa pool from above and the Mykonos aftermovie's
  infinity pool); in their places the alternate aerial pool shot (the villa pool from above, a swimmer
  in it) and a villa terrace above the sea, both unbranded. Nothing is cropped or blurred.
- **10 Sponsor integrations** (`cm-library-sponsor-v14.mp4`, 7.56 seconds). Shiv's quick Trezor-box
  sequence (five cuts in a second and a half) is gone. Ashley holding up her Trezor runs the full length
  of its shot (1.87 seconds), the Trezor integration is as before (the device by the pool, then the app),
  and the Bolt Liquidity invitation to Mykonos now stays long enough to read (2.7 seconds, its reply
  beginning). The aftermovie's Take Control card, just before its Trezor integration, is left out: it is
  the creator ads' own moment (from the Trezor Paper Airplane ad), and no moment appears twice. Every
  excerpt is on screen 1.5 seconds or more, with no speed effects (the library's usual 25 fps conform
  aside).
- **11 Podcasts** (`cm-library-podcasts-v14.mp4`, 12.0 seconds). Jungle Talk first, Food Talk next (a
  hawker center in Singapore after the jungle), the Lock In Podcast in the middle and Pool Talk to
  close; each show 2.8 to 3.3 seconds on screen, two angles each (a wide shot, then a closer one), so no
  near-identical two-person microphone shots sit side by side. It no longer opens on the Lock In
  Podcast, which closes the behind the scenes edit before it. A selected format still loops until the
  reader selects another or leaves the section.
- **12 The credits** (`creator.json`, `CmCredits.astro`). The eight creators by their public X handles
  only, one a line, as plain text: @evaedxn, @theblondebroker, @AshleyDCan, @shivst3r, @RajPatel,
  @Arcanic, @calebrebelo_ and @simonrez_. No names, employers, partnerships, affiliations,
  descriptors, follower counts or travel histories anywhere on the page; the build stops on anything
  but eight handles. The team, the co-sponsors, the brand and the hero photography are as they were.
  (`verify.mjs` no longer excuses the one creator title V1.3 showed, so "Head of" anywhere fails.)

**Media and excerpts (V1.4).** New names (`-v14`) for every recut file, so no browser shows a cached
cut; `cm-singapore-loop-v13.mp4`, `cm-mykonos-loop-v13.mp4`, `cm-library-destination-v12*.mp4`,
`cm-library-sponsor-v12*.mp4`, `cm-library-podcasts-v13*.mp4`, `cm-library-gameshow-v12*.mp4`,
`bolt-docs-walkthrough.mp4` and `bolt-docs-walkthrough-720.mp4` are removed (they stay in the
history). Loops 1600 by 900, edits 1280 by 720 (960 by 540 for phones), silent H.264, the index first.
The changed placements (times in the source files, which stay outside the repository):

| Placement | Source file | Start | End | What |
| --- | --- | --- | --- | --- |
| Singapore loop (7.67 s) | Singapore Spending Spree.mp4 | 1:15.02 | 1:15.69 | Eva and Ashley at the eyewear display |
| | Singapore Spending Spree.mp4 | 1:15.70 | 1:16.41 | Eva trying on glasses, the whole shot, at 0.58x (new) |
| Mykonos loop (6.72 s) | Mykonos Aftermovie.mp4 | 1:54.15 | 1:54.96 | the catamaran (a frame shorter) |
| | Mykonos Aftermovie.mp4 | 1:59.98 | 2:00.88 | swimmers in the bay (a frame shorter) |
| Destination films (8.0 s) | Costa Rica Aftermovie.mp4 | 1:29.16 | 1:29.95 | the alternate aerial pool shot (new) |
| | Mykonos Aftermovie.mp4 | 0:56.88 | 0:57.95 | a villa terrace above the sea (new) |
| Sponsor integrations (7.56 s) | Ashley Costa Rica Vlog.mp4 | 0:02.50 | 0:04.37 | Ashley's Trezor, the whole shot |
| | Mykonos Aftermovie.mp4 | 0:15.30 | 0:18.00 | the Bolt Liquidity invitation to Mykonos, its reply beginning (longer) |
| Podcasts (12.0 s) | Jungle Talk.mp4 | 0:09.30 | 0:11.20 | the panel at its table in the jungle |
| | Jungle Talk.mp4 | 0:14.90 | 0:16.40 | three of the panel |
| | Food Talk.mp4 | 0:09.80 | 0:11.60 | the table at the hawker center |
| | Food Talk.mp4 | 2:36.20 | 2:37.70 | a creator speaking into a handheld microphone |
| | Lock In Podcast.mp4 | 3:47.30 | 3:49.40 | the two-shot under the stone arch |
| | Lock In Podcast.mp4 | 4:24.10 | 4:25.50 | Caleb's close-up |
| | Pool Talk.mp4 | 14:44.78 | 14:46.22 | the four on the terrace, the crew's shadows on the stone |
| | Pool Talk.mp4 | 5:55.90 | 5:57.50 | a close-up, his microphone clipped on |
| Game show (9.93 s) | Bolt Bus Trailer.mp4 | 0:08.47 | 0:09.42 | the bus on the road (a frame shorter) |
| Documentation walkthrough (32.85 s) | Tech Docs Screen Recording.mov | 0:42.43 | 0:42.78 | taken out: 21 identical still frames |

Removed: the Costa Rica aftermovie's villa pool with Club Zero branding (0:49.60 to 0:50.46) and the
Mykonos aftermovie's infinity pool with Club Zero branding (0:40.95 to 0:42.92) from destination films,
and Shiv's Trezor box (Shiv Costa Rica Vlog 0:06.80 to 0:08.30) from sponsor integrations. No moment
appears twice across the loops, edits and stills; the aftermovie's paper airplane and Take Control card
(1:41.12 to 1:42.88) stay out of every edit, since the creator ads show them from the Trezor ad itself.

**For John to confirm.** Eva's shot is 0.71 seconds in its source, so its readable hold comes from
slowing it to 0.58x (with motion interpolation, checked frame by frame at full size on her face, hand
and glasses: clean); removing it is the alternative the brief allows. The Foundation's hold brings back
a stretch like V1.6's (0.15 of a screen, which V1.2 took out because the first movement after the hero
seemed to do nothing); this one begins only once the frame has pinned, so the first movements still
visibly raise the surface and bring the documents in. Of the four recording pauses only the
documentation's SDK page pause was removable; the other three carry the site's own animation, so they
stay, as the brief prefers to a compromised walkthrough. The headline's measure is 16ch rather than the
brief's 12 to 14ch: in this face 12 to 14ch breaks "destination" onto its own line and sets the
headline in four or five lines, while 16ch gives three balanced ones. "2.2x" is read aloud as "2.2
times". Sponsor integrations' calmer moments are Ashley's Trezor (its whole shot) and a longer
Bolt Liquidity invitation; the Take Control card would have repeated the creator ads. Two things the
brief did not name, left as they are: sponsor integrations still opens on the aftermovie's title card,
which reads ClubZero Content House over the Bolt, Trezor and Bitrefill marks, and the creator ads carry
the Slippage ad's ClubZero In The Clouds title (the Club Zero item named destination films only); and
the Trezor integration's app shot is also in the creator ads (since V1.3, from the Trezor Dare Ad), as
the aftermovie's Trezor sequence recaps the ads. Each is a small change if they should go. The
destination replacements are the alternate aerial pool shot and the Mykonos terrace above the sea. Podcasts opens on Jungle Talk (Food Talk second). The loader's glyphs are the fourteen
code characters above, in the accent at 85 percent, two or three at a time.

**The checks** (`verify.mjs`, "Creator Marketing and Partnerships", now Version 1.4, with the loader and
Technical Product Marketing checks): the loader's coded resolve (0.45 to 0.8 seconds, each position
scrambling 40 to 120 ms first, the reveal still at 2.27 seconds, a letter waiting by its color alone,
in reading order, the glyph in its place in a monospace face in the accent, a small fixed set of code
characters timed from the letters' own animation and stopping when the line has resolved, each glyph
taken away at its letter's moment on the same clock, cleared on a skip, never with reduced motion; no cursor, caret, blinking, flash, tearing, color fringe, scan line,
particle or chance); the marker's accelerating curve (at most half its average pace at the start, at
least twice at the end, no overshoot) and its lengthening streak; the Foundation's 0.12 to 0.18-screen
hold before the spread, eased in and out, driven by the scroll alone, with the pin and its CSS fallback
in step; the documentation walkthrough's new cut (its names, its 32.85 seconds, the old files gone, the
pause on record); Eva's whole shot closing the Singapore loop, fully visible 0.8 to 1.2 seconds; the
Mykonos and game show excerpts a frame shorter; the highlights (2.2x heard as 2.2 times, the one-sentence
note, no creator-account-results sentence); the centered introduction (one composition at every width,
a 12 to 16ch balanced headline, a 44 to 50rem paragraph, a short hairline rule and no box, left-set words
on phones under a centered headline, the parts arriving in order, nothing interactive); destination films
without the Club Zero shots and with their replacements, nothing cropped or blurred; sponsor integrations
without Shiv's box and with Ashley's Trezor, the Trezor integration and a longer invitation, every
excerpt 1.5 seconds or more, the aftermovie's recap of the Trezor ads out of every edit; Podcasts opening on Jungle Talk or Food Talk, then the other, Lock In in the middle and Pool Talk
last, each show 2.8 seconds or more; the credits' eight handles in order as plain text, and no creator
name, employer, partnership or affiliation on the page or in the data; and the new files' names, the old
ones gone. A mutation run broke each of these promises in turn (85 mutations, with a sample of earlier
ones) and every one was caught, and a browser pass (73 checks) confirmed the behavior: the loader's
glyphs only at the leading edge and never over a resolved letter, the letters never moving, the line
complete about 0.7 seconds in, the marker quickening to the end and arriving as the hold ends, a skip
clearing the glyphs, reduced motion with none and once per session; the Foundation holding its whole
stack for 0.15 to 0.16 of a screen once pinned, then easing into the spread; the documentation
walkthrough's new cut playing through the SDK page; the new loops and edits playing their V1.4 files
(Podcasts opening in Costa Rica); the introduction centered at 1440, 1024 and 768 and set left on phones,
straight into Costa Rica, arriving headline, paragraph, roster line; 2.2x and its spoken form; and the
eight handles as plain text. The accessibility scan finds nothing on all five pages at two widths,
`astro check` reports no errors, no page scrolls sideways from 320 to 1440, and every new loop point is as
smooth as a frame of its own dissolve.

## Creator Marketing and Partnerships, Version 1.3

John's Creator Marketing and Partnerships V1.3 brief (October 2026) is a delta against the deployed
Version 1.2: only what it names changed, and everything else is Version 1.2 as described below. No
visitor-facing copy uses an em dash.

- **01 to 03 The creator network is gone** (`CmNetwork.astro` and `mountNetwork` removed; `creator.json`,
  `CmContext.astro`, `CmCredits.astro`). The kicker, the headline ("The creators who made it travel."),
  its line and instruction, the warped portrait field, the details area with names, handles and
  affiliations, the Pause control, the field's listeners and its styles are all removed, and nothing
  takes their place (no carousel, grid, logo wall, marquee or roster): the program context leads
  straight into the campaign atlas, ending in an ordinary section end, with no blank pause. Beneath the
  program paragraph, one smaller, quieter line (the body size in the page's secondary ink, under the
  paragraph's larger type): "The roster brought together eight creators across streaming, crypto media,
  ecosystem leadership, entertainment, and community." No names, handles, pictures, counts, categories
  or travel histories there. The eight creators now appear only in the credits, which open their roll
  with them, in order, each name followed by their confirmed affiliations in quieter type (no handles
  anywhere on the page). The eight profile pictures stay in the repository as John's files, recorded as
  no longer on the page, and the page never requests or preloads them.
- **04 to 06 The atlas loops** (`cm-singapore-loop-v13.mp4`, `cm-mykonos-loop-v13.mp4`). Costa Rica is
  unchanged. Singapore is rebuilt around the city, the party-bus game show and high tea on the 56th
  floor: Marina Bay Sands from the air, the creators laughing on the party bus with the game show's
  microphone, the high tea room above the city, the high tea set out, the girls photographing the food
  (the whole take, nearly a second), a dessert, the creators at the table and one shopping moment
  (trying on glasses); the ION Orchard arrival and the Louis Vuitton and Prada storefronts are out, and
  no retail sign remains. 6.76 seconds. Mykonos keeps its catamaran, swimmers, paddleboard jump,
  infinity pool and terrace dinner and adds the aftermovie's Lock In Podcast production moment between
  the water and the villa: the crew's camera moving past a crew member's shoulder to Max and Caleb
  recording under the stone arch, microphones on, its last half second at half speed (interpolated) so
  it reads. 6.76 seconds. Both are silent, landscape and looping with a dissolve reset, as before.
- **07 The Trezor highlights** (`CmTrezor.astro`). The scale and centered composition of the results
  under the Technical Product Marketing film, in this page's palette and type: the PERFORMANCE
  HIGHLIGHTS label centered above one row of three equal columns on wide screens (stacked and centered
  on phones), each figure at the same display size as those results (2.5 to 4.5 rem) over a short
  caption, the figures on one line, with generous space and nothing around them (the V1.2 hairlines
  are gone; no cards, tiles, pills, shadows or dashboard chrome). The metrics are exactly as before
  ("524%", "above the account's average impressions"; "2.2 times", "the account's average total
  engagement"; "#2", "by reach out of" the sample's posts, 60 since Full Site Iteration V1); the 98th-percentile line and the note on what they
  measure follow under the row as quieter centered lines, so the three columns stay even. No raw totals.
- **08 The quotation's emphasis** (`CmTrezor.astro`). The translucent underlay is gone. The four phrases
  are set apart by type alone: the page's deep teal and one step more weight (800 against the
  quotation's 700), the rest in its usual dark ink; no marker, rectangle, underline, shadow, pill or
  badge. With motion allowed the teal resolves once, phrase after phrase, as the quotation arrives, and
  stays; with reduced motion it is simply set.
- **09 The wave flows again** (`CmOwnership.astro`, `mountOwnership` in `cm-motion.ts`). V1.2's one
  movement is gone. Both layers travel to the left without end, at an even pace: the wave one 880-pixel
  period every 18 seconds, the swell behind it every 22 (slower, so it moves less), their crests half a
  period apart to begin with. Each layer is one period wider than the water and moves exactly one
  period per cycle, so a cycle lands where the next begins: no reset, jump or acceleration, and no
  vertical movement; V1.2's depth, colors and gradient are unchanged. They run only while the water is
  within half a screen of view and the page is visible (the light on the water with them); reduced
  motion and no JavaScript leave them still.
- **10 to 12 Selected content** (`CmLibrary.astro`, `mountLibrary`). Podcasts is the seventh format
  (`cm-library-podcasts-v13.mp4`, 10.08 seconds): Max and Caleb's Lock In Podcast (the two-shot under
  the arch, then Caleb's close-up), Pool Talk on the villa terrace (the wide shot with the crew's
  shadows on the stone, a production angle, then a close-up with his microphone), Jungle Talk's panel in
  the jungle (two angles) and Food Talk at a hawker center table in Singapore (the table, then a
  handheld microphone), each show 2.4 to 3 seconds, hard cuts within a show and dissolves between them;
  the subtitled shows are framed above their burned-in subtitles (Jungle Talk clear of its watermarks
  too), silent and understandable without dialogue. Creator ads (`cm-library-ads-v13.mp4`, 10.18
  seconds) trade Jungle Talk for a concise Trezor Dare Ad excerpt, the dare (a run and jump into the
  pool) and then the bet settled with the Trezor and its app, 3.1 seconds in all; every other clip is
  as it was. The other five edits are unchanged. A format the reader selects now loops until they
  select another or leave the section: once the section is entirely off screen the selection lets go
  (and the hold of the tab the click focused), so back on screen the library plays on and moves on at
  the end of the edit; the reader's own pause still holds. With two formats across on narrower screens
  the seventh takes the whole last row. Keyboard access (arrows, Home, End, Enter and Space), the Pause
  control, visibility-based playback, phones' lighter encodes and reduced motion (an edit plays once on
  request) work for Podcasts as for the others.

**Media and excerpts (V1.3).** New names (`-v13`) for the four recut or new files, so no browser shows a
cached cut; `cm-singapore-loop-v11.mp4`, `cm-mykonos-loop.mp4` and `cm-library-ads-v12*.mp4` are
removed. Loops 1600 by 900, edits 1280 by 720 (960 by 540 for phones), silent H.264, the index first.
The changed placements (times in the source files, which stay outside the repository):

| Placement | Source file | Start | End | What |
| --- | --- | --- | --- | --- |
| Singapore loop (6.76 s) | Mykonos Aftermovie.mp4 | 2:25.00 | 2:26.70 | Marina Bay Sands from the air |
| | Singapore Spending Spree.mp4 | 0:16.06 | 0:16.86 | creators laughing on the party bus (framed above the subtitle) |
| | Singapore Spending Spree.mp4 | 1:20.62 | 1:21.32 | the high tea room above the city |
| | Singapore Slippage Ad.mp4 | 0:02.42 | 0:03.10 | the high tea set out |
| | Singapore Slippage Ad.mp4 | 0:06.84 | 0:07.79 | the girls photographing the food |
| | Singapore Slippage Ad.mp4 | 0:08.72 | 0:09.84 | a dessert at high tea |
| | Singapore Slippage Ad.mp4 | 0:20.10 | 0:21.38 | the creators at the high tea table |
| | Singapore Spending Spree.mp4 | 1:15.02 | 1:16.18 | trying on glasses |
| Mykonos loop (6.76 s) | Mykonos Aftermovie.mp4 | 1:18.76 | 1:19.44 | the Lock In Podcast in production (new; the rest as before) |
| Creator ads (10.18 s) | Trezor Dare Ad.mp4 | 0:12.40 | 0:14.20 | the dare: a run and jump into the pool (new) |
| | Trezor Dare Ad.mp4 | 0:26.30 | 0:27.60 | the bet settled with the Trezor and its app (new) |
| Podcasts (10.08 s) | Lock In Podcast.mp4 | 3:47.40 | 3:49.40 | the two-shot under the stone arch |
| | Lock In Podcast.mp4 | 4:24.20 | 4:25.40 | Caleb's close-up |
| | Pool Talk.mp4 | 14:44.78 | 14:46.22 | the four on the terrace, the crew's shadows on the stone |
| | Pool Talk.mp4 | 5:56.00 | 5:57.15 | a close-up, his microphone clipped on |
| | Jungle Talk.mp4 | 0:09.60 | 0:11.10 | the panel at its table in the jungle |
| | Jungle Talk.mp4 | 0:15.00 | 0:16.20 | three of the panel |
| | Food Talk.mp4 | 0:10.00 | 0:11.45 | the table at the hawker center |
| | Food Talk.mp4 | 2:36.40 | 2:37.70 | a creator speaking into a handheld microphone |

Removed: the ION Orchard arrival (Singapore Spending Spree.mp4 0:27.76 to 0:28.43) and the Louis
Vuitton and Prada storefronts (0:47.36 to 0:48.70) from the Singapore loop, and Jungle Talk (0:00.10 to
0:02.20, 0:32.24 to 0:33.80) from the creator ads. No moment appears twice across the loops, edits and
stills, and none of the Podcasts' Lock In moments repeats the Mykonos loop's or behind the scenes'.

**For John to confirm.** The aftermovie holds one Lock In production move (1:17.79 to 1:19.44): its
opening, the camera and its monitor, has been in behind the scenes since V1.1 and its middle shows the
operator's NFL Films shirt, so the Mykonos loop takes its closing reveal of the recording as one
moment, slowed for its last half second; moving the camera shot from behind the scenes to the loop
would give it a second. The supplied Singapore files hold no conference-floor footage, so the city
(and the conference's setting) is the Marina Bay Sands aerial; the party-bus shot is the only clean
one, framed above its subtitle; the girls photographing the food is the whole take. In Podcasts, Pool
Talk's shadows are the production angle (the only other, the aftermovie's, belongs to the loop), the
order is Lock In, Pool Talk, Jungle Talk and Food Talk, and Jungle Talk's title card is left out. The
credits set each creator's affiliations after the name, separated by commas. The emphasis takes one
step of weight with the teal, since the teal alone sits close to the quotation's slate ink. "Leaves
the section" is read as the whole section off screen. The wave keeps V1.1's leftward direction, its
cycles are 18 and 22 seconds, and the swell's crests now start half a period from the wave's (V1.2
had them about a fifth apart).

**The checks** (`verify.mjs`, "Creator Marketing and Partnerships", now Version 1.3): every changed
word, word for word, in the page and in `creator.json`; the network gone without a trace (no section,
component, markup, styles, script, listeners, data or words, no handle anywhere on the page, no portrait
requested or preloaded, and nothing between the program context and the atlas) while the eight pictures
stay on record as John's files; the roster line under the paragraph, smaller and quieter, with no names,
handles, pictures or links; the eight creators, in order, with their confirmed affiliations, opening the
credits' roll and nowhere else; the highlights at the Technical Product Marketing results' display
scale, centered, one row of three equal columns on wide screens and stacked on phones, with short
captions and no cards, tiles, pills, shadows or lines; the quotation's teal with one step more weight,
nothing drawn around it, resolving once and only with motion allowed, the rest in its dark ink; the
wave's flow (exactly one period to the left with no vertical movement, even cycles of 14 to 22 seconds
with the swell slower, layers one period wider than the water, crests well apart, resting unless the
water is near and the page visible, still for reduced motion and without JavaScript); the seventh format
and its whole last row; a selection let go only once the section has left the screen; the new files'
names, the old ones gone; and the media against the brief (Singapore's city, party bus and high tea with
the girls photographing the food, one shopping moment at most and no storefront; Mykonos's five kept
moments and its new Lock In moment; Costa Rica unchanged; the ads' kept clips and the Dare Ad's dare and
product in two to four seconds, nowhere else, Jungle Talk out; the four shows, each long enough to read,
only in Podcasts; no moment twice). A mutation run broke each of these promises in turn (109 mutations,
with the Version 1.2 checks that still apply and a sample of earlier ones) and every one was caught, and
a browser pass (62 checks) confirmed the behavior: no portrait requested while the whole page is read;
the atlas beginning where the context ends; the roster line's size and ink; the new loops playing silent
and landscape; the highlights' equal columns, centering and scale at 1440, 1024, 768 and 390; the four
phrases resolving once to the teal and staying; the wave at rest far off, then flowing to the left at an
even pace, the swell slower, with no vertical movement, and held while the page is hidden; Podcasts
selected, looping, let go on leaving and moving on after returning; the reader's pause holding; End,
Enter and Home; phones' lighter edit and the seventh tab's full row; reduced motion and no JavaScript.
The accessibility scan finds nothing on all five pages at two widths, `astro check` reports no errors,
no page scrolls sideways from 320 to 2560, and every new loop point is as smooth as a frame of its own
dissolve.

## Creator Marketing and Partnerships, Version 1.2

John's Creator Marketing and Partnerships V1.2 brief (October 2026) is a delta against the deployed
Version 1.1: only what it names changed, and everything else is Version 1.1 as described below. Its
Part One reaches three other places on the site. No visitor-facing copy uses an em dash. The screen
recording the brief mentions (diagnostic only) was not among John's files, so the trackpad work below
is inferred from the code and measured in a browser.

- **01 The loader's note** (`Intro.astro`; Part One). The bar, its timing, the note's words, the
  once-per-session rule and reduced motion are unchanged, and no phrase comes back. The note no longer
  simply appears: its 24 letters come up one after another, left to right, each rising 0.42 em out of
  a 4-pixel blur into focus (380 ms each, staggered so the last arrives 600 ms after the first begins)
  while the line's tracking settles from 0.34 em to its resting 0.22 em; the complete line then holds
  for 1.63 seconds (was 2.1), so the reveal stays at 2.27 seconds and the loader at about 2.9 in all. No
  cursor, typewriter, bounce, overshoot, scrambling, particles or flash; the bar stays the primary
  motion. Reduced motion still clears the ground at once with no note (were the note ever shown there,
  its letters would only fade).
- **02 The production room opens on Final** (`EvDeck.astro`; Part One). FINAL is selected whenever the
  chapter opens, and its muted preview (the two-scene loop) plays by itself while the chapter is open
  and in view, with its pause control and Watch full video with sound beneath it; SETUP, the
  behind-the-scenes photograph, is a click away, and the reader's last choice holds for the rest of the
  visit (closing and reopening the chapter does not bring Final back over a chosen Setup). The controls
  are unchanged. Without JavaScript the film comes first, then the photograph.
- **03 Technical Product Marketing answers the first movement** (`tpm-motion.ts`, `TpmHero.astro`,
  `TpmFlow.astro`, `TpmWebsite.astro`, `TpmDocs.astro`, `TpmCampaign.astro`; Part One). The page
  already scrolled natively (one passive listener, no wheel handling, no snapping); what read as
  hiccups at the four places John named was motion that did not follow the gesture. Now: the hero's
  fade and lift answer from the first pixel (its layers promoted once for the stage, not toggled as the
  reader scrolls); the Foundation's stage has no still stretch at its entry (V1.6 held the compact
  stack for 0.15 of a screen) and holds the finished statement 0.35 of a screen (was 0.75) before it
  releases, so the pin is 3.55 screens (was 4.1), its stack and library moving from the first pixel;
  the website's display, the documentation's browser and the flagship film rise into place from the
  scroll position itself, every frame (a rise that follows the gesture and reverses exactly), instead of
  a timed transition set off by a threshold, which ran ahead of the trackpad's momentum and made the
  page seem to jump; and the recordings are fetched two screens ahead while the browser is idle, the
  walkthrough's poster decoded before each return to it, so no gesture lands on a long frame. Measured
  in a browser: the first wheel event moves the page at once and the full distance, with no step back,
  no programmatic scroll and no layout shift, in small and medium gestures, both ways, over repeated
  passes. Reduced motion: native scroll, the frames simply in place.
- **04 to 07 John's words, the collaborators in the credits** (`creator.json`, `CmHero.astro`,
  `CmContext.astro`, `CmOwnership.astro`). The hero paragraph ends at "on-site production, and
  distribution." (the page's description follows). The program context has no kicker; its headline is
  "Each destination became a campaign in motion." ("a campaign in motion." in the accent) and its
  paragraph says what John led and helped plan. The ownership keeps the wave, "The experience was
  visible." and "The system behind it was not.", then "My role connected the campaign from sponsor
  strategy and creative direction through on-site production, distribution, and reporting." and three
  chapters of John's own work, with no owner lines: 01 Shape the campaign, 02 Direct the production, 03
  Carry it to market (nothing on creator sourcing, legal contracts, solo filming or editing, or sole
  ownership of travel logistics). Maanav Porwal and Bob van der Meer are named once, in the credits,
  which are unchanged.
- **06 The wave** (`CmOwnership.astro`). About half again as deep as V1.1's at every width (crest to
  trough 1.5 times, its box 3.8vw high, from 1.6 to 3.5 rem), its curve still soft, with a lighter swell
  behind it, out of phase, and a light drawn along its crest as a shape (never a line), in the page's
  palette. It moves once, as the water comes into view (rising to its full depth over 2.4 seconds while
  it and its swell drift apart over 3.2), then stays still: the V1.1 drift is gone. The first sentence
  keeps room below it for the wave and its swell at every width. Reduced motion: still.
- **08 to 10 The creator network** (`CmNetwork.astro`, `mountNetwork` in `cm-motion.ts`). The ring, its
  ellipse and the route line into it are gone. The eight portraits move through one continuous field
  warped across a broad curve in depth: each enters from beyond the field's far edge, small, turned and
  a little soft, grows and sharpens as it comes down the curve to the focal zone, where it is largest
  and square to the reader, then drifts back and fades as the next arrives; after the eighth comes the
  first, with no seam. One creator every 5.2 seconds, constant. Each card is placed by its own
  perspective, turn, lean and scale; there is no frame, shell, route or destination. The creator in the
  focal zone (`aria-current`) is named in a details area of its own: display name, handle and confirmed
  affiliations, nothing else, every creator's details stacked in one cell so it never changes height,
  centered in the field's height beside it on wider screens (the field fading out before it) and in its
  own row under the field on phones, never under a portrait. Hovering or keyboard-focusing a creator
  eases the field to a stop and shows them (a teal ring); selecting one still approaching brings them
  forward to the focal zone, never back; a creator focused out of sight comes into view along the path;
  moving on lets the field set off again, the same way. Every creator is a button in the page's order.
  On touch screens a sideways swipe moves the field (a vertical one scrolls the page) and a tap holds a
  creator for six seconds. One Pause control under the details. Off screen or in a hidden tab it rests;
  reduced motion shows a still gallery, two rows of four, a creator shown by selecting them; without
  JavaScript every creator's details show with the portrait. The `category` field is gone. The
  testimonial transition is gone too, with its placeholder entries (`cm-testimonial-1` to `-3`), its
  data and its component: the network flows straight into the atlas.
- **11 to 14 The Trezor Dare Ad** (`CmTrezor.astro`). After the film: Assignment, Objective and
  Approach in John's words; the highlights with the third as "#2 by reach" out of the sample's posts (60 since Full Site Iteration V1) and its 98th
  percentile line (never "most-viewed", creator-account framing kept); then the one quotation, four of
  its phrases ("level of care and creativity", "production quality", "attention to detail",
  "understanding our goals") in the accent over a soft underlay that draws in once, in reading order,
  as the quotation arrives (simply set for reduced motion), never pulsing and never broken out of the
  passage. The collaboration block is gone, in the page, the data and the styles, and the section closes
  on the quotation with a little less room below.
- **15 The atlas** (`CmAtlas.astro`). The small CAMPAIGN ATLAS kicker is gone, with nothing in its
  place; the section's heading names it for assistive technology only, and the index keeps its place at
  the right of the bar.
- **15 to 17 Selected content** (`CmLibrary.astro`, `mountLibrary` in `cm-motion.ts`). "See the program
  move from destination films and creator ads to sponsor integrations and the moments behind the
  camera." Every edit's last 0.4 seconds now dissolve into its own opening (baked into the file), so it
  can repeat with no black frame, held frame or flash. Until the reader chooses, the library moves on to
  the next format as each edit begins that dissolve, as before; a format the reader selects is pinned:
  its edit plays from the start and loops until they select another, with no moving on (it pauses off
  screen and resumes, still pinned). Pause, keyboard, reduced motion (the edit plays once on request)
  and the silent-autoplay rules are unchanged. Three edits are recut (below); Destination films, Game
  show and Lifestyle keep their excerpts, retimed only for the reset. The section's ground begins to
  turn toward the water halfway down, the ownership's open air carries the same color on, and the wave
  completes it: no line, band, border or blur curtain between them, the text contrast unchanged.
- **18 Obsolete Version 1.0 fields** (`creator-campaigns.mdx`, `WorkPanels.astro`, `creator.json`).
  The case study's frontmatter keeps its metadata with the intro and description following the hero,
  the results "Eight creators across three international activations", "Campaign strategy, creative
  direction, production, and coordinated distribution" and "Co-sponsor campaigns with Trezor, Bitrefill,
  Rayls Labs, and Phi Labs", and no body (its V1.0 narrative is gone). The homepage card's middle slot
  falls back to nothing (`null`) instead of the impressions figure, whose branch and styles left
  `WorkPanels.astro` (after a search of the whole project), and the co-sponsor stand-in includes Phi
  Labs. The card's subline, drafted for John's confirmation because the old one claimed the logistics,
  reads "Helped lead international creator campaigns, from sponsor strategy and creative direction to
  production and distribution." `creator.json` lost its placeholders, `category`, `voices`, the Trezor
  collaboration rows, the context and atlas kickers and the atlas's unused title; its notes speak for
  V1.2. The schema validates and the build passes.

**Media and excerpts (V1.2).** The six edits carry new names (`cm-library-*-v12.mp4`, with
`-v12-540.mp4` for phones), so no browser shows a cached V1.1 cut; the V1.1 files are removed. 1280 by
720 (960 by 540), silent H.264, the index first, 0.2-second dissolves between excerpts and the
0.4-second reset. The changed placements (times in the source files, which stay outside the
repository):

| Placement | Source file | Start | End | What |
| --- | --- | --- | --- | --- |
| Creator ads (10.64 s) | Bitrefill Pool Ad.mp4 | 0:16.00 | 0:19.40 | the gift-card overlay by the pool |
| | Trezor Paper Airplane.mp4 | 0:02.75 | 0:04.22 | the paper airplane over the pool |
| | Trezor Paper Airplane.mp4 | 0:16.90 | 0:18.25 | a creator holding up the Trezor box |
| | Singapore Slippage Ad.mp4 | 0:00.40 | 0:01.95 | its title over the high tea room |
| | Jungle Talk.mp4 | 0:00.10 | 0:02.20 | the creator panel at its table in the jungle (new) |
| | Jungle Talk.mp4 | 0:32.24 | 0:33.80 | the Jungle Talk title card with its sponsors (new) |
| Sponsor integrations (7.76 s) | Costa Rica Aftermovie.mp4 | 0:10.00 | 0:12.55 | the creator house's title card with Bolt, Trezor and Bitrefill |
| | Shiv Costa Rica Vlog.mp4 | 0:06.80 | 0:08.30 | Shiv's Trezor box on his desk, then held up to the camera (new) |
| | Ashley Costa Rica Vlog.mp4 | 0:02.62 | 0:04.34 | Ashley holding up her Trezor device (new) |
| | Costa Rica Aftermovie.mp4 | 1:42.90 | 1:44.54 | the Trezor integration: the device by the pool, then the app |
| | Mykonos Aftermovie.mp4 | 0:15.30 | 0:17.00 | a Bolt Liquidity invitation to Mykonos |
| Behind the scenes (13.36 s) | Ashley Costa Rica Vlog.mp4 | 0:25.50 | 0:26.40 | the crew filming the creators |
| | Costa Rica Aftermovie.mp4 | 0:00.04 | 0:00.68 | a creator filming on a phone gimbal |
| | Ashley Costa Rica Vlog.mp4 | 0:38.07 | 0:38.90 | a camera rig and its monitor |
| | Costa Rica Aftermovie.mp4 | 1:18.90 | 1:20.40 | filming the sunset on a phone |
| | Costa Rica Aftermovie.mp4 | 1:40.28 | 1:41.10 | the crew with a gimbal |
| | Costa Rica Aftermovie.mp4 | 1:48.48 | 1:50.60 | the exterior setup, a take in the hallway, laughter, then the crew in the bathroom (new, its own cuts) |
| | Mykonos Aftermovie.mp4 | 1:17.88 | 1:18.52 | a camera on set |
| | Lock In Podcast.mp4 | 1:30.00 | 1:33.20 | the podcast, the two-shot |
| | Lock In Podcast.mp4 | 2:15.00 | 2:16.80 | the host's close-up |
| | Lock In Podcast.mp4 | 12:16.00 | 12:18.40 | the guest's close-up |

Removed: "That slippage, baby" (Singapore Slippage Ad.mp4 0:24.10 to 0:24.88) and "Don't let slippage
take away your fancy high tea sushi" (0:30.15 to 0:31.95) from the creator ads; the Bitrefill "cover
your flight" scene (Costa Rica Aftermovie.mp4 0:33.00 to 0:35.60), the ClubZero credit-card moment
(Singapore Spending Spree.mp4 2:00.76 to 2:02.40) and the "Bolt Liquidity or Sup Raj" moment (Mykonos
Aftermovie.mp4 0:24.55 to 0:26.15) from sponsor integrations. Destination films (8.72 s), Game show
(9.93 s) and Lifestyle (8.76 s) keep their V1.1 excerpts (below).

**For John to confirm.** The accent falls on "a campaign in motion."; the Sup Shiv invitation (a Bolt
Liquidity invitation, Mykonos Aftermovie.mp4 0:15.30) stays in sponsor integrations, since only the Sup
Raj moment was named; Jungle Talk is placed in Costa Rica for the place line; ClubZero's name remains
where it is part of a title card; behind the scenes keeps the aftermovie's own cuts from 1:48.5 to
1:50.6 (the exterior setup, two quick takes in the hallway, then the crew laughing in the bathroom);
sponsor integrations runs 7.76 seconds, a little under the others; a
selected format stays pinned when the reader leaves the section and returns (paused while away); a
swipe moves the field either way (only selection and the field's own motion are one-way), and a tap
holds a creator for six seconds; the network keeps its hint ("Select a creator for details.") and its
Pause control; the atlas heading stays for assistive technology; the loader shows no note with reduced
motion, as before; the card's subline is drafted; and the trackpad causes were inferred, since the
recording was not available.

**The checks** (`verify.mjs`, "Creator Marketing and Partnerships", now Version 1.2, with the loader,
the production room and the Technical Product Marketing scroll in their own sections): every changed
word, word for word, in the page and in `creator.json`; the collaborators named only in the credits (in
the words, the descriptions and the metadata); no kicker on the program context or the atlas; the
network's field (its eight buttons in order; the details area with only names, handles and
affiliations, in its own column or row, centered, one height for every creator; one way at a constant
pace, never backward; hover and keyboard focus easing it to a stop, a click let go when the pointer
leaves, a tap's hold running out; the swipe, the Pause control, reduced motion and no JavaScript) and no
ring, categories or testimonials; nothing focusable inside a part hidden from assistive technology;
the Trezor brief, "#2 by reach" (with "most-viewed" and the impressions aggregate refused anywhere on
the site), the four emphasized phrases drawn in once and no collaboration block; the library's line,
its pinned loops, its reset matching the edits, the recut edits' new names and new moments, and the
removed clips kept out; the blend's one color and no line; the ownership's chapters of John's own work,
the wave half again as deep, moving once, with the words clear of it; the case study's results, no MDX
body, the card's subline and its stand-ins; and, for Part One, the loader's letters, tracking, timing
and length, the production room's Final default and the reader's kept choice, and the Technical Product
Marketing page's native scroll, its stage phases, its hero and its rises (which fade in from nothing, so
nothing below the screen is half there). A mutation run broke each of these promises in turn (101
mutations, with a sample of earlier checks) and every one was caught, and a browser pass (90 checks)
confirmed the behavior: the loader frame by frame and with reduced motion; the production room's Final,
Setup and the kept choice; the field's pace and direction at four desktop sizes, its hover, selection,
keyboard order, Pause and rest off screen; a phone's swipe and tap hold; the quotation's emphasis; the
library moving on, then a selected format looping through leaving and returning; the blend's color
across the seam; the wave's one movement and its clearance at fifteen widths from 320 to 2560; reduced
motion and no JavaScript. On Technical Product Marketing, trackpad-like wheel gestures at the ten places
around the hiccups (the hero, the Foundation's entry, hold and release, the website at 0:30, the
documentation's overview and SDK chapter, and back up into the hero) moved the page on the first frame
(19 to 39 ms), the full distance, with no step back, no programmatic scroll, no layout shift and no long
frame, and the rises read the same on repeated passes. The accessibility scan finds nothing on all five
pages at two widths, `astro check` reports no errors, no page scrolls sideways from 320 to 2560, and every
edit's loop point is as smooth as a frame of its own dissolve.

## Creator Marketing and Partnerships, Version 1.1

John's Creator Marketing and Partnerships V1.1 brief (October 2026) is a delta against the deployed
Version 1.0: only what it changes changed, and everything else (the visual system, the network's ring,
the atlas's structure, the waterline, the colors, the navigation and Contact) is Version 1.0 as
described below. No visitor-facing copy uses an em dash.

- **01 to 03 The hero** (`CmHero.astro`, `creator.json`). The headline is "Creator campaigns, built to
  travel." (the brief's recommended line), and the paragraph reads "I helped lead creator programs
  across Costa Rica, Singapore, and Mykonos, owning campaign strategy, creative direction, sponsor
  coordination, on-site production, and distribution in close collaboration with Maanav Porwal and Bob
  van der Meer." The layered villa keeps its depth. The two-line headline sits higher than V1.0's three
  lines (its last line clears the gable; the palm's crown reaches the foot of its last word), and on
  short, wide screens (a laptop's browser window) the scene drops by up to a fifth of the hero, and past
  that the type eases down, so the headline always has clear sky under the header (measured from 960 by
  600 to 2560 by 1440 and on phones). The photo credit is gone from the hero: the illustrative
  photography is credited once, in the credits. The page's description follows the new paragraph.
- **04 The program context** (`CmContext.astro`). "A trip is the setting. A program connects
  everything around it." and one paragraph: John's primary ownership (campaign strategy with
  co-sponsors, sponsor coordination, creative direction, on-site shoot planning, approvals,
  distribution and reporting), Maanav Porwal's collaboration (creator and co-sponsor sourcing,
  negotiations, contracts, travel and logistics) and Bob van der Meer's (concepts, and much of the
  filming and editing).
- **05 and 06 The creator network** (`CmNetwork.astro`). "Eight creators spanning streaming, crypto
  media, ecosystem leadership, entertainment, and community." The participations line, every "Traveled
  to" label and every destination chip are gone (and the destinations are out of the data). Each creator
  shows a display name and handle, as plain text: Eva @evaedxn, The Blonde Broker @theblondebroker,
  Ashley @AshleyDCan, Shiv @shivst3r, Raj @RajPatel, Arcanic @Arcanic, Caleb @calebrebelo_, Simon
  @simonrez_, with the confirmed affiliations unchanged.
- **07 Names that never clip** (`CmAtlas.astro`). The destination names are sized against their words
  column (`22.5cqi`, the longest, Singapore, about 4.15 em wide), so the last letter is always inside it,
  and on the pinned stage the box that hides a name as it slides keeps 0.16 em below the line for the
  descenders (the g and p of Singapore, the y of Mykonos) and a little past the last letter; a name set
  aside moves a whole box away (125%). A browser pass renders each name with and without its clip at ten
  desktop sizes, 960 by 600 to 2560 by 1440: identical, pixel for pixel.
- **08 to 10 The destinations** (`creator.json`, `assets.json`). Costa Rica: "A creator house on the
  Pacific coast where shared moments became destination content, creator-led integrations, and bespoke
  campaigns produced for co-sponsors.", 40+ content pieces, and its loop recut without the closing shot
  of a creator running into the surf (a jet ski crossing the bay into the sun in its place, the rhythm
  and the dissolve reset kept). Singapore: "A crypto game show on a party bus, high tea on the 56th
  floor, and a shopping spree through the city's luxury malls, designed as a conference activation.",
  35+ pieces, a longer loop (the city from the air, the party bus pulling up at ION Orchard, Louis
  Vuitton and Prada, trying on glasses, the high tea room and a dessert) without the shot in a Bolt
  Liquidity shirt, and a dinner toast in place of the party-bus still with the microphone (the high tea
  still kept). Mykonos: 25+ pieces, Phi Labs as its co-sponsor (the approved logo, set like the others
  as one light silhouette on the dark ground, drawn a little taller so its letters match), and the Lock
  In Podcast recording with Max and Caleb (from `Podcast Still.jpeg`, cropped to 16:9) in place of the
  catamaran still; its water loop is unchanged.
- **11 and 12 The Trezor Dare Ad** (`CmTrezor.astro`). Renamed everywhere (heading, film, data and
  descriptions). After the film, "Performance highlights", framed in one line ("Measured on the
  creator's own account against that account's preceding three months. These are creator-account
  results, not Trezor's total campaign performance."), then three figures on a hairline, restrained (no
  cards, the figures at most 2.4 rem): 524% above the account's average impressions; 2.2 times the
  account's average total engagement; #2 most-viewed post out of 56, "Ranked in the 98th percentile for
  reach during the sample period." No raw totals anywhere. Trezor's feedback and its attribution stay.
- **13 to 15 Selected content** (`CmLibrary.astro`, `mountLibrary` in `cm-motion.ts`; the montage and its
  pill list are retired). Six formats, each with its own edit: Destination films, Creator ads, Game
  show, Lifestyle, Sponsor integrations and Behind the scenes, chosen with plain text tabs (an index and
  a label, a hairline under each; the selected one a little stronger, its line filling as the edit
  plays). The tabs are real controls (`role="tab"`): a click, or Enter or Space, plays that format's edit
  from the start; the arrow keys, Home and End move between them. With motion allowed, the next format
  follows when an edit ends, round and round, except while keyboard focus is in the formats; one Pause
  control under the frame holds it, and it pauses off screen and in a hidden tab. Reduced motion, a
  data-saving preference or a refused autoplay start nothing: the selected edit waits on its poster and
  plays once on request. Under the frame, the format and the destination on screen (from each edit's
  `cues`). Phones get the 960 by 540 edits, the formats two across; without JavaScript the six edits read
  two across, each with its own controls. The Mykonos podcast is no longer a split-second flash: it
  closes Behind the scenes with 7.4 seconds of the Lock In Podcast (the two-shot, then each close-up).
  No excerpt repeats another edit, an atlas loop or a still.
- **16 The program ownership** (`CmOwnership.astro`). The wave and the headline stay; the nine areas and
  their rings are gone. "Beneath every post was a collaborative program spanning sourcing, logistics,
  creative direction, production, distribution, and partner reporting." Then three editorial chapters,
  as restrained columns in the water (one after another on phones), each with its index, title, words
  and who owned it: 01 Build the program ("A collaboration between John Cowin and Maanav Porwal"), 02
  Direct the work ("Led by John Cowin, with Bob van der Meer collaborating on concepts and handling much
  of the filming and editing"), 03 Carry it to market ("Led by John Cowin as the liaison between creators
  and co-sponsors"). Their parts line up across the columns (`subgrid`).
- **17 The credits** (`CmCredits.astro`). The team first, each name with what they owned or
  collaborated on, word for word: John Cowin, Maanav Porwal, Bob van der Meer. Then the roll: the eight
  creators; Trezor, Bitrefill, Rayls Labs, and Phi Labs; Bolt Liquidity; and the hero photography
  (illustrative, not from the trips), its only credit on the page. No generic internal collaborators
  and no closing note.
- **18 The conclusion** (`CmConclusion.astro`). "The trip ends. The program keeps working." (one line
  each, the second in the accent) and "Each activation produced an immediate body of campaign content
  and strengthened the creator and partner relationships behind the next opportunity. The value
  continued through distribution, reporting, and ongoing collaboration after everyone went home." The
  layout and the way on to Technical Product Marketing are unchanged.

**Media and excerpts (V1.1).** The changed media carry new names (`cm-costa-rica-loop-v11.mp4`,
`cm-singapore-loop-v11.mp4`, `cm-library-*.mp4`), so no browser shows a cached Version 1.0 cut; the
montage files and the two replaced stills are removed. Loops are 1600 by 900, the edits 1280 by 720
(960 by 540 for phones), silent H.264 with the index first. Times are in the source files, which stay
outside the repository.

| Placement | Source file | Start | End | What |
| --- | --- | --- | --- | --- |
| Atlas, Costa Rica loop (`cm-costa-rica-loop-v11.mp4`, 6.28 s) | Shiv Costa Rica Vlog.mp4 | 0:09.88 | 0:11.88 | the villa pool from the drone |
| | Shiv Costa Rica Vlog.mp4 | 0:23.02 | 0:23.86 | the pool and palms |
| | Costa Rica Aftermovie.mp4 | 1:16.32 | 1:17.00 | the golden-hour beach |
| | Costa Rica Aftermovie.mp4 | 1:17.04 | 1:18.64 | the group at the water's edge (the original cut kept) |
| | Shiv Costa Rica Vlog.mp4 | 0:45.76 | 0:47.70 | a jet ski crossing the bay, then into the sun (new; replaces Ashley Costa Rica Vlog.mp4 0:53.25 to 0:54.45) |
| | Shiv Costa Rica Vlog.mp4 | 0:17.14 | 0:18.10 | palms against the sunset |
| Atlas, Singapore loop (`cm-singapore-loop-v11.mp4`, 6.30 s) | Mykonos Aftermovie.mp4 | 2:24.60 | 2:27.40 | Marina Bay Sands from the air |
| | Singapore Spending Spree.mp4 | 0:27.76 | 0:28.43 | the party bus pulling up at ION Orchard (replaces 0:18.00 to 0:19.95) |
| | Singapore Spending Spree.mp4 | 0:47.36 | 0:48.70 | Louis Vuitton, then Prada |
| | Singapore Spending Spree.mp4 | 1:15.02 | 1:16.18 | trying on glasses |
| | Singapore Spending Spree.mp4 | 1:20.62 | 1:21.32 | the high tea room above the city |
| | Singapore Slippage Ad.mp4 | 0:08.72 | 0:09.84 | a dessert at high tea |
| Atlas, Singapore still (new) | Singapore Spending Spree.mp4 | 1:41.16 | (frame) | the creators' dinner toast |
| Atlas, Mykonos still (new) | Creator Videos/Podcast Still.jpeg | | (photograph) | Max and Caleb recording the Lock In Podcast |
| Library, Destination films (9.12 s) | Costa Rica Aftermovie.mp4 | 0:06.60 | 0:09.62 | the coastline from the air, with its titles |
| | Costa Rica Aftermovie.mp4 | 0:49.60 | 0:50.46 | the villa pool from above |
| | Costa Rica Aftermovie.mp4 | 1:53.86 | 1:55.38 | the house from a drone |
| | Mykonos Aftermovie.mp4 | 0:28.95 | 0:31.45 | through the clouds down to the island |
| | Mykonos Aftermovie.mp4 | 0:40.95 | 0:42.92 | the infinity pool above the sea |
| Library, Creator ads (9.97 s) | Bitrefill Pool Ad.mp4 | 0:16.00 | 0:19.40 | the gift-card overlay by the pool |
| | Trezor Paper Airplane.mp4 | 0:02.75 | 0:04.22 | the paper airplane over the pool |
| | Trezor Paper Airplane.mp4 | 0:16.90 | 0:18.25 | a creator holding up the Trezor box |
| | Singapore Slippage Ad.mp4 | 0:00.40 | 0:01.95 | its title over the high tea room |
| | Singapore Slippage Ad.mp4 | 0:24.10 | 0:24.88 | a creator's line, in its caption |
| | Singapore Slippage Ad.mp4 | 0:30.15 | 0:31.95 | its closing line at the table |
| Library, Game show (10.30 s) | Bolt Bus Trailer.mp4 | 0:00.00 | 0:06.48 | the bus arrives; the seven creators introduced, the prize on the line |
| | Bolt Bus Trailer.mp4 | 0:08.47 | 0:09.43 | the bus on the road |
| | Singapore Spending Spree.mp4 | 0:14.33 | 0:15.95 | a quiz question, then a correct answer |
| | Bolt Bus Trailer.mp4 | 0:20.58 | 0:22.20 | the BOLT BUS title |
| Library, Lifestyle (9.16 s) | Shiv Costa Rica Vlog.mp4 | 0:19.50 | 0:20.95 | a run and jump into the pool |
| | Singapore Spending Spree.mp4 | 0:49.82 | 0:51.30 | a boutique |
| | Mykonos Aftermovie.mp4 | 1:46.40 | 1:47.24 | the catamaran's wake |
| | Costa Rica Aftermovie.mp4 | 0:59.86 | 1:01.50 | morning yoga |
| | Singapore Spending Spree.mp4 | 1:28.86 | 1:30.10 | an arcade |
| | Mykonos Aftermovie.mp4 | 1:29.60 | 1:30.38 | a toast on a night out |
| | Costa Rica Aftermovie.mp4 | 1:32.02 | 1:33.38 | the grill, then dinner at the house |
| | Costa Rica Aftermovie.mp4 | 1:36.78 | 1:37.54 | a creator at dinner |
| | Mykonos Aftermovie.mp4 | 1:09.24 | 1:10.45 | dinner on the terrace at sunset |
| Library, Sponsor integrations (10.16 s) | Costa Rica Aftermovie.mp4 | 0:10.40 | 0:12.40 | the creator house's title card with Bolt, Trezor and Bitrefill |
| | Costa Rica Aftermovie.mp4 | 0:33.00 | 0:35.60 | the Bitrefill integration, a video call |
| | Costa Rica Aftermovie.mp4 | 1:42.90 | 1:44.54 | the Trezor integration: the device by the pool, then the app |
| | Singapore Spending Spree.mp4 | 2:00.76 | 2:02.40 | paying with the ClubZero card |
| | Mykonos Aftermovie.mp4 | 0:15.30 | 0:16.95 | a Bolt Liquidity invitation to Mykonos |
| | Mykonos Aftermovie.mp4 | 0:24.55 | 0:26.15 | another invitation, read in a mirror |
| Library, Behind the scenes (11.64 s) | Ashley Costa Rica Vlog.mp4 | 0:25.50 | 0:26.40 | the crew filming the creators |
| | Costa Rica Aftermovie.mp4 | 0:00.04 | 0:00.68 | a creator filming on a phone gimbal |
| | Ashley Costa Rica Vlog.mp4 | 0:38.07 | 0:38.90 | a camera rig and its monitor |
| | Costa Rica Aftermovie.mp4 | 1:18.90 | 1:20.40 | filming the sunset on a phone |
| | Costa Rica Aftermovie.mp4 | 1:40.28 | 1:41.10 | the crew with a gimbal |
| | Mykonos Aftermovie.mp4 | 1:17.88 | 1:18.52 | a camera on set |
| | Lock In Podcast.mp4 | 1:30.00 | 1:33.20 | the podcast, the two-shot |
| | Lock In Podcast.mp4 | 2:15.00 | 2:16.80 | the host's close-up |
| | Lock In Podcast.mp4 | 12:16.00 | 12:18.40 | the guest's close-up |

The Mykonos loop, the other stills and the Trezor film are as in Version 1.0 (below).

**The checks** (`verify.mjs`, "Creator Marketing and Partnerships", now Version 1.1): every changed
word, word for word, in the page and in `creator.json`; the collaborators named exactly wherever they
appear; the hero's room under the header and no credit in it, the photographers credited exactly once;
the eight handles as plain text and no destinations on the network; the atlas's copy, counts and
co-sponsors, the names sized to their column and their clip leaving room for descenders; the recut
loops under new names; the Trezor Dare Ad's name everywhere and Trezor spelled one way; the three
highlights exactly, framed, restrained, and no raw totals; "524%" allowed only as that first highlight
with its exact label (the guardrail still fails it anywhere else); the library's tabs, panels, edits,
files, cues and script, and no pills; the ownership's chapters and owners, no areas or cards, and their
lining up; the team and the roll; the conclusion without a financial claim; no moment used twice across
the loops, edits and stills, and the removed shots kept out. A mutation run broke each of these
promises in turn (98 mutations, with a sample of earlier checks) and every one was caught, and a browser
pass (59 checks) confirmed the behavior: the headline's room at sixteen sizes, the network's names and
handles, the atlas's names pixel for pixel, the library's selection, keyboard, focus hold, pause, off
screen, line and places, the chapters lining up, reduced motion, phones and no JavaScript.

## Creator Marketing and Partnerships, Version 1.0

John's Creator Marketing and Partnerships V1.0 brief (October 17, 2026): Part I adjusts two published
pieces (the Events deck and the homepage's opening sequence), and the rest gives the first case study
its own page, sections 05 to 14. The page keeps the portfolio's type, palette, navigation, buttons and
Contact, and speaks its own visual language (open air and daylight, destination atmospheres, a curved
path, a waterline, closing credits), with nothing from the Technical Product Marketing systems or the
Events production monitor. No visitor-facing copy uses an em dash. The shared-layout page it replaces
(its "My role" line, its aggregate impressions, account benchmark and methodology note) is retired;
the MDX body stays in the repository, unrendered, and the Select Work card is unchanged.

**Part I**

- **01 The deck's video, centered** (`EvDeck.astro`). On wide screens the open Live Presentation and
  Event Film cards set their video, with its corner marks and timecode, in the vertical center of the
  card (`evd__media--centered`: `align-self: center`, and a top margin of the deck's padding less the
  band above the content, so the room above the frame matches the room below it; measured at 1440 by
  900, 131 and 131 pixels, 164 and 164). The words keep their top line, the Production Room keeps its
  Setup and Final on that line, and narrow screens are unchanged.
- **02 The loader, the note alone** (`Intro.astro`, `home.json`). "Product complexity.", "Market
  clarity." and "Strategy, executed." are gone, with nothing in their place. The marker, its path and
  BEST EXPERIENCED ON DESKTOP stay: after a 40ms beat the note arrives (130ms) and holds, fully
  legible, for 2.1 seconds; at 2.27 s (V1.6: 2.85 s) the marker reaches the end of its path, the note
  leaves, the ground starts to clear and the hero's layers begin, in place at about 2.9 seconds (V1.6:
  3.45). The same on phones, where the note matters most. As before: once per browsing session, never on
  a return from a case study, a visit that began inside the site or a link to a section; near-instant
  with reduced motion; dismissed by any intent.

**The page** (`src/pages/work/creator-campaigns.astro`; words and media configuration in
`src/data/creator.json`; components in `src/components/creator/`; motion in `src/lib/cm-motion.ts`,
with the players and silent loops of `src/lib/ev-media.ts`). The page pulls up under the header row, so
the header's links float over the hero's sky.

- **05 Hero** (`CmHero.astro`). One full-screen landscape scene, layered in depth: the sky, the
  headline set in it, a white villa in front (its roofline and a palm cross the headline's last line)
  and two palm fronds nearest, each a transparent layer on one 3200 by 2019 canvas. As the page scrolls
  each moves at its own rate (the sky 0.46, the headline 0.3, the villa 0.16 of the hero's height over a
  screen, the fronds against the scroll), written once a frame from one passive listener; nothing follows
  the cursor. The layers settle in as the page opens, then the sky breathes very slowly and the fronds
  sway a little, all only with motion allowed; with reduced motion the scene simply rests. Phones keep
  the depth, with smaller fronds behind the words. The label reads "01 / Creator Marketing and
  Partnerships", the headline "Bringing creator campaigns to life around the world." (the brief's V1
  headline), then the approved paragraph. The photography is illustrative stock, never presented as the
  trips: a small credit on the hero reads "Illustrative photography: Rosemary Media and Abbie Bernet,
  Unsplash", and the credits say "illustrative, not from the trips".
- **06 The program context** (`CmContext.astro`). "The program": "The trip was the setting. The
  program connected everything around it." (the second sentence in the accent) and one paragraph of
  what John ran around each trip, from finding the creators to distribution and reporting. On wide
  screens a thin route draws from the paragraph down into the network's path.
- **07 The creator network** (`CmNetwork.astro`). Exactly the eight creators John confirmed, each with
  their square profile picture (from his PFPs folder, never a profile screenshot), travelling one way,
  slowly (a turn in 80 seconds), round an ellipse seen from slightly above: the nearest card largest and
  on top, the farthest smaller and fainter, each with a small tilt. The heading sits at the center of the
  ring ("Creator network", "The creators who made it travel.", "Eight creators across 17
  participations in Costa Rica, Singapore, and Mykonos."). Hovering, keyboard focus or a tap puts that
  creator's name, confirmed affiliations and destinations (colored chips: Costa Rica green, Singapore
  gold, Mykonos blue) at the center and eases the ring to a stop; a tap holds them (stated with
  `aria-pressed`) until tapped again, and Escape lets go. It also rests off screen, in a hidden tab and
  with reduced motion. There is nothing to drag and no control to reverse it. On phones, and without
  JavaScript (four across on wider screens), the eight are a plain list with everything visible. No
  card carries a testimonial, a follower count or a ranking, and the affiliations are stated plainly.
- **08 Testimonials** (`CmVoices.astro`). Up to three short creator testimonials, one at a time as the
  page scrolls (lower left, lower right, lower left again into the atlas), set in the open with their
  attribution, never on the cards and never Trezor's. All three are placeholders, so a production build
  leaves the section out and the network leads straight into the atlas.
- **09 The campaign atlas** (`CmAtlas.astro`). One dark stage, titled "Campaign atlas", with an index of
  the three destinations. Each has its own atmosphere, its number, type and coordinates, its name set
  large, one line of copy, its figures (creators and content pieces: Costa Rica 6 and 34, Singapore 7 and
  29, Mykonos 4 and 17; the creators as the network's roster counts them), its co-sponsors' logos
  (Trezor and Bitrefill; Rayls Labs; Mykonos's are still to be confirmed), one silent loop with a
  dissolve at its reset (5.5, 5.7 and 5.3 seconds) and two stills. At 960 by 600 pixels and more, with
  motion allowed, the stage holds still through a runway of 3.4 screens while the destinations take it
  in turn (the words rise, the stills slide in, only the one on view plays its loop), and the index marks
  progress and jumps to a destination. Otherwise, and without JavaScript, the three read one after
  another, each loop playing only while it is well in view.
- **10 The Trezor dare** (`CmTrezor.astro`, `CmFilm.astro`). "Featured campaign", "The Trezor dare" and
  one line of context; then the film first: the whole 44-second ad with its sound, from "Play with
  sound" with its length to a bar of play, seek, time and sound (a 720p file for phones). The
  assignment, objective, approach and exact results follow it once John supplies them; then Trezor's
  approved feedback, attributed only to "Trezor campaign feedback"; then the collaboration credits, John's
  part first (program strategy and sponsor coordination).
- **11 Selected content** (`CmMontage.astro`). "One program, many formats.": one silent 18-second
  montage from across the three trips (smaller than the Trezor film), with the seven formats listed
  beside it and the one on screen marked as it plays, from the reel's own clock (`cuts` in
  `creator.json`), with its place.
- **12 Program ownership** (`CmOwnership.astro`). "The experience was visible." in the open air, a slow
  wave line, then "The system behind it was not." in deep water, one line of copy, and the nine areas
  John ran as one typographic field, larger and nearer at the top, smaller and fainter deeper down,
  separated by small rings (not a grid, a timeline or a checklist). The wave drifts and a faint light
  moves across the water only with motion allowed.
- **13 Credits** (`CmCredits.astro`). "Many hands, one program.": closing credits on the deep ink, roles
  to the left of a center line and names to the right (stacked on phones): John for the program
  strategy and management and for the creative direction and production coordination; the eight
  creators; the co-sponsors; the brand; Bolt Liquidity's design, editing, and legal teams; the hero's
  photographers. The closing note says who performed, published, built and edited the work, and that
  John's part was the strategy, the program management, and the direction and coordination of
  production. Nothing implies he edited, shot or designed it. The editing and filming rows wait for
  names.
- **14 Conclusion** (`CmConclusion.astro`). "Every trip paid off twice." and one paragraph, then the way
  on to Technical Product Marketing ("Next, see how I turn technical complexity into a clear market
  narrative."), on a ground that runs from the credits' ink to the Contact green, with Contact's grid
  rising out of it.

**Media and excerpts.** Every medium on the page is square or landscape. The video masters stay
outside the repository; each manifest entry records its sources.

| Placement | Source file | Start | End | What |
| --- | --- | --- | --- | --- |
| Atlas, Costa Rica loop (`cm-costa-rica-loop.mp4`, 5.48 s) | Shiv Costa Rica Vlog.mp4 | 0:09.88 | 0:11.88 | the villa pool from the drone |
| | Shiv Costa Rica Vlog.mp4 | 0:23.02 | 0:23.86 | the pool and palms |
| | Costa Rica Aftermovie.mp4 | 1:16.32 | 1:17.00 | the golden-hour beach |
| | Costa Rica Aftermovie.mp4 | 1:17.04 | 1:18.64 | the group at the water's edge (the original cut kept) |
| | Ashley Costa Rica Vlog.mp4 | 0:53.25 | 0:54.45 | running into the surf (retimed to 25 fps) |
| | Shiv Costa Rica Vlog.mp4 | 0:17.14 | 0:18.10 | palms against the sunset |
| Atlas, Singapore loop (`cm-singapore-loop.mp4`, 5.67 s) | Mykonos Aftermovie.mp4 | 2:24.55 | 2:28.62 | Marina Bay Sands from the air (the film's look ahead to Singapore) |
| | Singapore Spending Spree.mp4 | 0:18.00 | 0:19.95 | ION Orchard |
| | Singapore Spending Spree.mp4 | 1:20.60 | 1:21.34 | the high tea room above the city |
| Atlas, Mykonos loop (`cm-mykonos-loop.mp4`, 5.34 s) | Mykonos Aftermovie.mp4 | 1:54.15 | 1:54.98 | the catamaran from above |
| | Mykonos Aftermovie.mp4 | 1:59.98 | 2:00.90 | swimmers in the bay |
| | Mykonos Aftermovie.mp4 | 1:55.96 | 1:57.25 | a jump from a paddleboard |
| | Mykonos Aftermovie.mp4 | 0:58.96 | 1:01.16 | the infinity pool at sunset |
| | Mykonos Aftermovie.mp4 | 1:01.20 | 1:02.95 | dinner on the terrace |
| Atlas, Costa Rica stills | Costa Rica Aftermovie.mp4; Ashley Costa Rica Vlog.mp4 | 0:49.20; 0:45.30 | (frames) | the villa and pool; a group photo at lunch |
| Atlas, Singapore stills | Bolt Bus Trailer.mp4; Singapore Spending Spree.mp4 | 0:17.00; 1:23.70 | (frames) | inside the party bus; the high tea |
| Atlas, Mykonos stills | Mykonos Aftermovie.mp4 | 1:57.40; 1:13.10 | (frames) | the catamaran from the water; the terrace at dusk |
| Trezor film (`cm-trezor-dare-ad.mp4`, with sound) | Trezor Dare Ad.mp4 | 0:00 | 0:44.18 | the whole ad (poster at 0:00.20) |
| Montage (`cm-montage.mp4`, 17.92 s, silent) | Costa Rica Aftermovie.mp4 | 0:06.80 | 0:09.40 | destination film: the coastline from the air |
| | Shiv Costa Rica Vlog.mp4 | 0:19.12 | 0:20.60 | lifestyle: a run and jump into the pool |
| | Bitrefill Pool Ad.mp4 | 0:16.90 | 0:19.30 | sponsor integration: the gift-card overlay |
| | Costa Rica Aftermovie.mp4 | 1:40.30 | 1:41.12 | behind the scenes: the crew with a gimbal |
| | Costa Rica Aftermovie.mp4 | 1:18.72 | 1:20.46 | social clip: filming the sunset on a phone |
| | Bolt Bus Trailer.mp4 | 0:00.52 | 0:04.54 | game show: the creators introduced |
| | Singapore Slippage Ad.mp4 | 0:00.40 | 0:01.95 | creator ad: its title |
| | Singapore Slippage Ad.mp4 | 0:04.20 | 0:05.40 | creator ad: the high tea |
| | Mykonos Aftermovie.mp4 | 1:17.86 | 1:18.52 | behind the scenes: a camera on set |
| | Mykonos Aftermovie.mp4 | 1:26.78 | 1:27.58 | lifestyle: the night out |
| | Mykonos Aftermovie.mp4 | 1:27.62 | 1:28.58 | lifestyle: the night out |
| | Mykonos Aftermovie.mp4 | 1:57.60 | 1:59.94 | destination: under the water |

The loops are 1600 by 900, the montage 1280 by 720 (960 by 540 for phones) and the Trezor film 1920 by
1080 (1280 by 720 for phones), all H.264 with the index first; only the Trezor film has sound. No
moment is used twice between the atlas and the montage, and none comes from the Trezor films outside
their own section. The hero is illustrative Unsplash stock (Rosemary Media's white modern villa and
Abbie Bernet's palm leaves, each separated into its layers), and the eight profile pictures are John's
(`Creator Marketing/PFPs`).

**Still to come** (labeled placeholders in `npm run dev` only, absent from a production build): the
three creator testimonials, the Trezor assignment, objective, approach and exact results, the creators,
production and editing names on the Trezor credits, the editing and the filming and production partners
in the closing credits, the creators' categories and Mykonos's co-sponsors (see [Replacing
placeholders](README.md#replacing-placeholders), item 11).

**The checks** (`verify.mjs`, "Creator Marketing and Partnerships"): the page's own structure (no
shared hero, "My role" line or another page's components) and order; every heading and paragraph word
for word; the hero's layers in depth with their rates, decorative and loaded first, falling back to
WebP, each under 700 KB, credited as illustrative stock, and still for reduced motion; exactly the
eight creators with their confirmed affiliations and destinations (17 participations), square pictures,
named buttons, no testimonial, figure, ranking or qualifier, a slow one-way ring that rests for hover,
focus, a selection, off screen, a hidden tab and reduced motion, with nothing to drag, and the list for
phones and for no JavaScript; at most three testimonials, absent until approved; the atlas's three
destinations with their figures, co-sponsors, silent 5 to 10 second loops and landscape stills, pinned
only at 960 by 600 and more with motion allowed, through the reader's own scrolling; the Trezor film
first, with sound, its files, the brief and results only as confirmed and only exact, the approved
feedback and its attribution, and the credits; the montage's files, cut list and formats; the
ownership's headline and nine areas; credits that never put John's name to editing, filming,
photography or design; the conclusion's way on; square and landscape media only, each excerpt on
record; no placeholder in a build; nothing hidden without the script that shows it, and every
animation only with motion allowed. Part I's checks sit with the Events deck and the loader. A mutation
run broke each of these promises in turn (68 mutations, from the loader and the deck through every
section of the page to a sample of earlier checks) and every one was caught, and a browser pass
confirmed the behavior: the loader's timing on desktop and phone, the deck's centered video, the hero's
parallax, the ring's motion and its rests, the pinned atlas and its loops, the montage's marks, the
Trezor film's sound, reduced motion, phones and no JavaScript.

## Technical Product Marketing, Version 1.6

John's TPM briefs, Version 1.1 (October 12, 2026), Version 1.2 and its delta (October 13: the HOME
house, the hero without media, the Foundation's copy and icons, the statement, and the Website and
Technical documentation metadata, contributions and playback), Version 1.3, an incremental update
of the same page (the split hero and its object, the layered reveal into the Foundation, paragraph
widths, equal metadata columns, the live-site button, the documentation's loop, the emphasis system,
the campaign's amplification line, Selected Writing and the conclusion), Version 1.4, another
(the hero object as a two-state system, the field behind it, the scope line at the foot of the hero,
wider paragraphs, Selected Writing taken out, and the conclusion's way on as one sentence),
Version 1.5, the first part of the Combined Build Brief (October 14: the Narrative Engine in place of
the stacked object, a signal field in place of the contour lines, and the conclusion's spacing, type
and one continuous closing ground into Contact), and Version 1.6, the Hero Replacement Brief (October
14: the hero's visual replaced completely by an isometric system, its section label restored, and its
scope line drawn into the composition; the Foundation, the transition into it and everything after it
as they were), built through 01 Hero, 02 Foundation, 03 the transitional statement, 04 Website, 05
Technical documentation, 06 the flagship animation campaign and 07 the conclusion, then Contact and
the footer; 00, the homepage opening sequence, is site-wide. The page is
`src/pages/work/technical-marketing.astro` with `src/components/tpm/` (TpmHero; TpmFlow for 02 and 03;
TpmWebsite, TpmDocs and TpmCampaign, which share TpmCase for their opening; TpmWalkthrough, the
walkthroughs' player; DocIcon; TpmConclusion), its copy and library in `src/data/tpm.json`, its
emphasis helper in `src/lib/tpm-copy.ts`, the hero system's drawing engine, scene and timeline in
`src/lib/tpm-iso.ts` and the page's motion in `src/lib/tpm-motion.ts` (the V1.4 `tpm-system.ts` and
`tpm-field.ts` and the V1.5 `tpm-engine.ts` and `tpm-signal.ts` are gone); `src/pages/work/[slug].astro`
no longer builds this case study. The page runs up under the header row
(`--header-row`), so its opening screen is the whole viewport. The brief itself is kept and revised in
place outside the repository; this section follows it, revised in place with it.

**Companion pass (the Events V1.1 brief, October 14, 2026).** A narrow pass on this page; the hero's
copy, layout and illustration, the transitions, the Foundation's document system and everything after
it are as Version 1.6 left them. (1) The hero's idle life is a little more perceptible, still calm: a
signal every four seconds (the idle cycle is 12 seconds, three hand-offs; it was 15), the signals a
touch larger and brighter (engaged, larger and brighter again: the same system, amplified), the lights
at the plinths and blocks held a little longer (1.2 and 1.3 seconds), and the shared product language
breathing: its glass takes a faint teal light and lets it go over 6.4 seconds (an opacity of 0 to 0.34
on a layer of its own), and the canopy drifts 0.09 grid units (it was 0.07). Nothing floats, bobs,
turns or follows the pointer as a whole, the labels do not move, and reduced motion keeps it still.
(2) The third input's label reads ANALYSIS (it was DOCUMENTS); its node, icon, type, angle, spacing and
alignment are unchanged, and so is the drawing's description for assistive technology ("...foundational
marketing documents...", left for John to approve a new wording). (3) On large desktops (from 75rem wide
and 46rem tall) the scope line sits 24 to 32px lower (`translate: 0 clamp(1.5rem, 1.6vw, 2rem)`, moved
alone so the split keeps its place), still at least 90px clear of the foot of the first screen at
1536x864; smaller screens keep their balanced wrap and their room beneath. (4) The Foundation's
opening paragraph is two: "Before a product can be explained externally, it needs a shared internal
language." on its own, with "a shared internal language" still emphasized, then, after room of its
own (1.25 to 2rem), "For Bolt Liquidity, I built that language from stakeholder interviews and product
research, shaping the positioning, claims, proof points, and narrative architecture behind every
public-facing expression." Centered as before; the words are unchanged.

- **01 Hero** (light surface; V1.3 to V1.6): an asymmetrical split. The section label "02 / TECHNICAL
  PRODUCT MARKETING" (V1.6: the hero had carried no label since V1.2), the headline "Building the
  system behind the message." and the supporting paragraph sit together on the left (5fr of the
  width); on the right (7fr), in open space, the isometric system (V1.6). The headline never changes
  (no rotating or replaced words) and always sets in two lines, "Building the system" / "behind the
  message." (`hero.break`), each unbroken: its size is V1.5's (`clamp(2.5rem, 1rem + 3.6vw, 5rem)`) or
  less where its column is too narrow for the first line (10.9% of the column's width): 57px at
  1440px, 51px at 1280, 41px at 1024, 38px on a 390px phone. "the system" is in the accent and "a clear
  market narrative" carries the paragraph's emphasis. The label is set like the Events kicker (12px
  capitals, 0.14em tracking, in the accent) after a small aqua isometric tile, the system's own unit.
  No media and no canvas: the Bolt animation plays in full in 06. The copy, the system and the
  scope line are composed as one group in the middle of the first screen (V1.6: the scope line no
  longer stranded at the foot), the split's two halves centered on each other. Phones and tablets
  stack the copy above the system. The copy and the scope line rise in; the system assembles.
- **The scope line** (V1.4, drawn into the composition in V1.6): the seven areas (Research,
  Positioning, Messaging, Claims Governance, Technical Documentation, Web Content, Campaign Direction)
  in one centered line beneath the split, 2.25rem to 4.5rem below it (6% of the screen's height):
  small tracked capitals, 11px with 0.1em tracking and a 1.6em space between terms, and from 80rem
  12px with 0.12em and 2em, never shrinking to fit (one line from 60rem wide). From 88rem a fine rule
  runs out from either end of the line to the edges of the content, fading as it goes, the base line
  the copy and the system stand on. Below 60rem it wraps, every line centered on its terms (each term
  has half the space on either side), a term never breaking inside itself: two lines at 768px, four at
  390. Every term but the first has a middle dot, skipped by screen readers, which the script hides
  where a term opens a line.
- **The isometric system** (`TpmHero.astro`, drawn by `src/lib/tpm-iso.ts`; V1.6): the V1.5 engine,
  its radial core, its labeled curved branches and its "shared product language" hub, and the signal
  field behind the hero are gone completely, replaced by a small designed environment in true
  isometric projection, on a faint grid of its own that fades out within the drawing's box (no
  topographic background, nothing across the rest of the hero). On the left, research and inputs, each
  on a stone plinth with a fine aqua inlay: stakeholder interviews (two speech panels in conversation),
  product research (a data sheet with raised bars and a lens over it) and foundational marketing
  documents (three structured pages standing in file). At the center, with the greatest weight, the
  shared product language built as an architectural foundation of coordinated parts: a deep teal base
  and deck etched with a fine grid, a three-by-three matrix of modular blocks of different heights
  (bone and aqua, each with a groove below its cap and a small engraved mark on its top), four fine
  dashed guides rising from the deck's corners, and a glass canopy set on them, etched with rows of
  the shared language. No eye, target, circular core, brain, orb or hub. On the right, the
  public-facing expressions on their plinths: the website (a browser window on a stand: title bar,
  navigation, a teal hero, three cards), the technical documentation (an open page with its sidebar,
  heading, text and a block of code, a second page behind) and campaigns and content (a run of low
  content cards, a post, an image and the film with its play mark and progress). Conduits are set
  into the floor (a fine channel, a port at the input's end, a pad at each turn) from each input into
  the foundation and from it to each expression, square to the grid, never radial. The palette is the
  portfolio's: cream, deep teal, muted aqua, slate hairlines, coral and ochre in two or three small
  details. Depth comes from the faces' shading by their normals, soft contact shadows, the canopy's
  translucency and the light caught on front edges, never glow or gloss. The reference recordings
  informed the composition, the relationship of literal objects to an abstract system, the layer
  separation and the quality of motion only; nothing of their artwork is reproduced.
- **The assembly** (once, as the page opens; about 3.5 seconds and a settle): the grid fades in
  (0.1 to 0.8 seconds) and the base rises into it (from 0.2); the inputs' plinths and then their
  objects rise into place (0.4 to 1.65); the foundation's blocks are set down onto the deck in a wave
  from the back (from 0.95, 80ms apart), its guides grow from the deck's corners (1.4 to 2.2) and the
  canopy descends onto them (1.65 to 2.65); the conduits appear (from 1.9) and, once the foundation
  stands, the expressions emerge (2.2 to 3.45). Then the connections resolve: a light runs once along
  the conduits, from the inputs into the foundation (from 2.3, each run 0.6 seconds), passing through
  the blocks from the inputs' side to the expressions' (from 2.9) and out to the expressions (from
  3.1), each plinth's inlay lighting as the light leaves or reaches it; the light fades by 4.5
  seconds and the idle life begins at 4.7. Every part travels on a smooth ease-out (`cubic-bezier(0.2,
  0.8, 0.2, 1)`), fading in over its first quarter.
- **At rest** (the idle cycle, 15 seconds): three hand-offs, five seconds apart, each a single small
  point of light with a short trail that crosses one input's conduit into the foundation (1.3
  seconds; interviews, then research, then documents), a soft light that passes through three of the
  foundation's blocks (the one by the conduit, the tall aqua center, the one toward the expression;
  0.3 seconds apart), and a point of light that leaves for one expression (the website, then the
  documentation, then campaigns and content), whose plinth's inlay lights as it arrives. The canopy
  drifts by about 2px over seven seconds, as do the three expressions, out of step. Nothing spins,
  swells or follows the pointer.
- **Engaged** (the pointer over the system itself, a tap, or its control): the layers separate over
  about a second (0.95 seconds, ease-out): the canopy rises about 29px at 1440px on its guides, which
  stretch with it, the blocks lift by their height (7 to 12px), every object lifts off its plinth (11
  to 12px), the expressions a beat after the inputs; the conduits light; the signals run faster and
  together, all three inputs into the foundation, then all three expressions, every 3.4 seconds; the
  canopy's etched rows dim and "Shared product language" appears across the glass; and six concise
  labels arrive on the floor (Interviews, Research and Documents from 0.2 seconds, 70ms apart, along
  the front of each input's plinth, reading down to the right; Website, Documentation and Campaigns
  from 0.55 seconds, in front of each expression's plinth, reading up to the right, where no conduit
  arrives), set in small tracked capitals lying in the floor's plane. Leaving, the labels go first and
  the system settles back calmly (0.75 seconds). No labels at rest.
- **Its control**: only direct engagement opens it. A mouse or pen engages it by moving over the
  system's own outline (a polygon round its parts at rest; the whole box once it is open) and
  releases it by leaving; a layout change under a still pointer never opens it, a pointer anywhere
  else on the page never moves it, and the pointer engages it once the foundation stands (the
  canopy's arrival, or 3.2 seconds). A tap on it opens a quicker version (0.6 seconds); a second tap
  or a tap elsewhere closes it; on touch screens a visible control beneath it, "Show the system's
  parts" or, open, "Hide the system's parts", does the same. For a keyboard that control is a real
  button (`aria-expanded`, controlling the labels and the phone's legend), out of sight until it takes
  focus, then just below the system; Enter or Space toggles it, Escape closes it. Screen readers hear
  the drawing as one image described in `hero.system.description`, and the seven labels once it is
  open. Off screen, or once the Foundation starts to cover the hero, it rests closed.
- **Phones, reduced motion, no JavaScript**: below 37.5rem the floor labels would crowd a drawing
  this small, so they give way to a legend beneath it, the same seven words in three columns (the
  inputs, the foundation, the expressions), shown while the system is engaged, its room kept so
  nothing moves when it appears; all the components stay, and the assembly and the idle life tell the
  story without interaction. With reduced motion the system is shown complete and still, with no
  assembly, drift or signals; engaging it shows the labels and the lit conduits without moving
  anything. Without JavaScript it assembles and idles all the same (CSS) and opens on hover or focus
  within it; on a phone its legend is shown as a plain caption.
- **Performance**: every part is its own HTML box holding its own SVG drawing, so every movement
  (the assembly, the drift, the signals, the lights, the separation) is transform or opacity on an
  HTML box with one movement to an element, which the compositor runs by itself; the one exception is
  the light's single run along the conduits during the assembly. The signals' and lights' keyframes
  are generated with the geometry and sit in the page's head. Off screen everything pauses; under the
  rising Foundation the idle life stops altogether (the softening hero is then a few flat layers) and
  begins again a moment after the reader is back at the top. The grid is cut to the drawing's box. In
  headless Chromium at 1440x900 the system at rest costs the main thread about 30ms in five seconds
  (V1.5, about 20ms); engaging it, no frame took longer than 34ms; scrolling through the hold
  averaged 18.4ms a frame (V1.5, 17.5ms). The drawing is inline SVG: the page is 195KB, 34KB gzipped
  (V1.5, 73KB and 15KB).
- **01 Hero, into the Foundation** (wide, tall-enough screens with motion allowed): a layered reveal
  over one screen of scrolling. The live hero is two screens tall and gives its last screen to the
  Foundation (a negative bottom margin), so the Foundation's full-width dark surface rises over the
  held hero from the bottom of the screen, its leading corners rounded (28px) until it settles from
  55% of the way, a soft shadow cast up onto the hero only while it rises. Meanwhile the hero's copy,
  system and scope line fade to 20% (from 15% to 95% of the way), move up 26px, ease to 98% and soften
  (2px of blur at most); from halfway the Foundation's headline and paragraph fade up 32px into place,
  and its documents a beat after them (24px), so the surface arrives clean and the headline leads.
  Nothing travels from one section into the other: no fragments, strips or morphing; only opacity,
  transforms and the hero's slight blur are scrubbed (`TpmHero.astro` hands `--lead-r`,
  `--lead-shadow` and `--rise` to `TpmFlow.astro`). Everywhere else (reduced motion, phones, tablets,
  short windows) the hero reads in normal flow and the Foundation's opening crossfades in (0.7
  seconds) as its top passes four fifths of the way down the screen. The Pinterest reference informed
  the feeling only. V1.4 to V1.6 keep all of this; the system's idle life stops from the first moment
  of the rise and it rests closed once the rise is 15% of the way along.
- **02 Foundation** (dark surface): a centered opening, unlike the split hero: the headline on exactly
  two lines ("Before the message" / "comes the foundation.", each its own unbroken line, "the
  foundation." in the accent since V1.3), the approved paragraph beneath it at 52rem, about 830px (V1.4;
  46rem in V1.3), in three balanced lines on wide screens, with "a shared internal language" set a little heavier ("Before a product can be
  explained externally, it needs a shared internal language. For Bolt Liquidity, I built that language
  from stakeholder interviews and product research, shaping the positioning, claims, proof points, and
  narrative architecture behind every public-facing expression."), then a generous gap before the
  documents, which are lowered rather than
  the opening compressed. The four parts stay: the entry, the compact stack opening into the featured
  spread, the library moving right to left, and the exit, where the documents sink a little and fade,
  left to right, as the opening steps back. (Creator Marketing V1.4: once the frame has pinned and the
  stack has settled, the whole stack holds for 0.15 of a screen of scrolling before it spreads; see
  [Creator Marketing and Partnerships, Version 1.4](#creator-marketing-and-partnerships-version-14).) Twelve named documents in the brief's order, numbered 00 to
  11 for display (not their Linear numbers): 00 Stakeholder Interviews ("Cross-functional leadership
  input"; the interview count is not published), 01 Strategic Foundation Brief, 02 Target Buyer
  Analysis, 03 Market Pain Points Research, 04 Target Audience Psychology, 05 Competitor Analysis, 06
  Product Positioning, 07 Brand Archetype, 08 Claims Log, 09 Messaging Hierarchy, 10 Brand Tone of
  Voice and 11 Brand Lexicon, each with its subline from the brief. Invariants, Mission Statement,
  Category North Star, Brand Manifesto and Copy Bank are gone. Two unlabeled neutral covers follow 11,
  quieter with depth, with no number, title, subline or icon, hidden from screen readers.
- **The cards**: every named document has its own muted accent on its 4px strip and its faded icon
  (coral, mustard, teal, rust, lavender, blue, magenta, ochre, green, cyan, rose and violet, in order;
  side by side, no two closer than 24 in CIELAB), and its own icon (V1.2 delta) from one professional
  outline family, Phosphor Icons 2.1.1 in its Regular weight, used as published, with no other library
  and nothing drawn for the site (`DocIcon.astro`, which carries the MIT notice): 00 Chats Circle, 01
  Stack, 02 User Focus (a person in a focus frame, teal), 03 Warning Diamond (Phosphor has no magnifying
  glass with a warning signal, so its warning signal stands alone for the pain points), 04 Brain (a
  clean outline, no sparkles, lavender), 05 Binoculars, 06 Crosshair, 07 Fingerprint (an asymmetrical
  whorl, ochre), 08 Seal Check, 09 Tree Structure, 10 Waveform and 11 Book Open Text. Regular reads
  best at the icons' fade; one rule sets every icon's size, placement and fade. One internal grid for
  every card:
  the number in a fixed 1.25rem row (every number on one baseline), the title from the same height in an
  area two lines tall (a longer title wraps into the space below without moving anything), open space,
  and the subline in a fixed two-line area at the bottom. The icon keeps one zone, at the right between
  the title and the subline, faded to 17% through its fill (27% on hover, when the card also lifts 6px),
  so no layer edge ever shows around it.
- **03 The transitional statement** (dark, in the same stage; V1.2 delta): one large block of type and
  nothing else, one continuous statement: "Once the product language is clear, it guides every
  expression that follows: the website, technical documentation, articles, campaigns, and content that
  bring the product to market." It is revealed word by word as the page scrolls (each word fades in
  with a slight rise; no typewriter, no cursor, no arrow or diagram), over 0.85 of a screen for its
  length, and then held for three quarters of a screen so it can be read. Screen
  readers get the sentence whole (the word-by-word copy is `aria-hidden`); with reduced motion it is
  simply there. Once it is complete (V1.3), the page's one animated highlight sweeps a restrained
  translucent teal (the muted aqua at 34%, a band behind the type, not a marker) behind "it guides every
  expression that follows", early in the hold and with the scroll; in the still layout it sweeps in
  over 1.1 seconds once the statement is well in view, and with reduced motion it simply stands. The
  type keeps its weight and color.
- **04 Website** (soft surface, its own chapter, after FABRIC's restraint rather than its look):
  "Website", the metadata row (V1.2 delta: Goal, Services and Credits only, as 06 has them; "Visual
  design and development: **Bob van der Meer**."; no timeline, location or year), the contribution
  statement centered beneath it ("I mapped the experience from the opening section to the final CTA,
  ..."; Bob's name is in the credits only; "a complete rebuild and launch in two weeks" set a little
  heavier since V1.3), then one oversized thin-bezel desktop display built in CSS (a graphite body whose
  bezel is 0.85% of its width, a slim stand), min(84vw, 76rem) wide and centered in open space,
  entering with a short rise. Nothing sits over it. Beside it (V1.3), one quiet "Visit live site"
  button with the site's external-link arrow (the outlined secondary button): at the display's right
  edge, its bottom on the line of the stand's foot, outside the hardware; it opens boltliquidity.io in
  a new tab, and screen readers hear "(opens boltliquidity.io in a new tab)" (`ExternalLink`). Phones
  drop the hardware, run the recording edge to edge and set the button beneath it, at the right.
- **The website walkthrough**: the approved take (Website Screen Recording.mov, recorded at 3:49:15 PM
  on October 12, 2026; it stays outside the repository), whole and in its own sequence from the hero to
  the partnership form, 46.8 seconds, the form fully visible from about 43 seconds. Cropped by 48px at
  each side and 46px at the bottom of the 3456x1936 capture to an exact 16:9 (3360x1890): that removes
  the window's rounded corners, the scroll bar and the browser's link preview (39.1 to 40.8 seconds,
  bottom left) without touching the site's own framing. Cutting it to the brief's 16:10 would have
  taken about 5% off each side, through the left-aligned headlines, so the display is 16:9 instead. The
  pointer appears only for the call-to-action hover and the form. Silent H.264 with fast start:
  `bolt-website-walkthrough.mp4`, 1920x1080 at 60 fps, CRF 23, 7.6 MB, and
  `bolt-website-walkthrough-720.mp4`, 1280x720 at 30 fps, 3.0 MB, for phones. Poster: its first frame,
  the hero at rest. MP4 only: H.264 plays in every browser, and a WebM copy would be more files to keep
  for no visible gain (it is a source line to add later if wanted).
- **05 Technical documentation** (light-return surface, its own chapter): "Technical documentation",
  the metadata row (V1.2 delta: Goal, Services and Credits only; "Visual design and interactive
  implementation: **Bob van der Meer**."; no timeline), the contribution statement centered beneath it
  ("I rebuilt the documentation from the ground up, ..."; "useful, accurate, and appropriate for public
  release" set a little heavier since V1.3), then a large frameless browser frame (a slim bar with
  three dots, no device), up to 90rem wide, entering with a short rise. Under it, introduced (centered
  on the frame since V1.3) as "Selected views from a broader documentation system" (which also names the list for
  screen readers; no page count and no spotlight), the walkthrough's three chapters, 01 Documentation
  overview, 02 Interactive architecture and 03 Developer SDK, each with one line
  drafted from the brief's confirmed facts (the diagram's names John's process and credits Bob van der
  Meer for the final design and build; the SDK's says the existing SDK code was preserved). The chapter
  playing is marked, its hairline filling as it plays, and each chapter is a button that plays from its
  point. Nothing is laid over the documentation. Phones run the frame edge to edge.
- **The documentation walkthrough**: from the approved take (Tech Docs Screen Recording.mov, 4:05:41
  PM, 58.5 seconds), 33.2 seconds (32.85 since Creator Marketing V1.4, which takes out a 0.35-second
  still in the SDK page and renames the files `-v14`): 0:00 to 0:06.9 and 0:08.2 to 0:11.9 (the home page and a glimpse of
  Start here; 1.3 seconds of a still pause come out between identical frames, so the join cannot be
  seen), 0:15.8 to 0:28.6 (the whole diagram, then its Hedge / Rebalance Liquidity and Oracle
  explanations; the Position Engine and Hedge hovers are cut) and 0:39.9 to 0:50.3 (the SDK page from
  its title and quickstart to the getOracleConfig example, a still code frame), with 0.3-second
  cross-fades at the two page changes. Contact & Support and the partnership form are cut. The diagram
  is the longest moment (12.5 seconds); the pointer stays throughout. Silent H.264 with fast start:
  `bolt-docs-walkthrough.mp4`, 2560x1440 at 60 fps (sharp text at the frame's full width on Retina
  screens), CRF 22, 6.5 MB, and `bolt-docs-walkthrough-720.mp4`, 1280x720 at 30 fps, 1.9 MB. Poster:
  the documentation home. The chapter starts (0, 10.45 and 22.95 seconds, the middles of the
  cross-fades) are in `tpm.json`.
- **Playback** (`Walkthrough` in `tpm-motion.ts`): each walkthrough is fetched only as its frame comes
  within a screen of view; it plays silently when the frame is well inside the viewport (60% for the
  display, 55% for the browser), pauses whenever the frame leaves (under 20% visible) and resumes when
  it returns. Both play continuously, the website since the V1.2 delta and the documentation since
  V1.3: at the end the website holds the partnership form for one second and the documentation its
  final code frame for 1.2 seconds; each then fades over 0.7 seconds to its poster (the recording's
  first frame), rewinds under it and fades back in as it plays again, so the end never cuts to the
  start, and a walkthrough out of view stays paused through the turn. Their discreet controls pause
  and play (paused during the turn, a walkthrough keeps or fades back to its last frame; played again,
  it fades to the start and replays). The recordings are silent, so there is no sound to keep or lose
  between loops: nothing in the loop touches the mute state. Reduced motion, data saving or a refused
  autoplay leave the poster and the play control, and a recording played on request plays once through;
  a recording that cannot load keeps its poster and loses its control. No scroll scrubbing, and nothing
  depends on hover.
- **Pacing**: the Foundation rises over the hero in one screen (V1.3); one sticky stage then holds 02
  and 03 for 4.1 screens, in screen heights: the stack 0.15, the spread 0.5, the library 1.45, the exit
  0.4, the statement 0.85 and its hold 0.75 (`PHASES` in `TpmFlow.astro`; the hero's is its `.is-live`
  height in `TpmHero.astro`).
  The library now passes 14 cards (12 named and 2 covers) at the Version 1 speed; 02 takes about 2.5
  screens in all against the concept's 1.2 to 1.4. Each is one number to tune after the review.
- **Fallbacks**: the choreography needs the script's `is-live` class, a 60rem minimum width, a 37.5rem
  minimum height and no reduced motion. Without it (phones, tablets, short windows, reduced motion, no
  JavaScript) every section reads in normal flow: the hero's entry state, the library as a grid with the
  covers at its end, and the statement in full; the Website and Technical documentation chapters are the
  same everywhere, as are the flagship chapter and the conclusion. Reduced motion and
  data saving autoplay nothing (the controls still play on request, and Play with sound plays the film
  with sound); phones get the 720p encodes. V1.4 was checked at 1920x1080, 1440x900, 1280x800 and
  1024x768 with a mouse, at 768x1024 with a mouse and with touch, and at 390x844 and 320x640 with touch;
  with reduced motion and without JavaScript at 1440x900 and 390x844. V1.5 was checked at 1440x900,
  1280x800, 1024x768, 768x1024 and 390x844, with a mouse, touch and the keyboard, and with reduced
  motion and without JavaScript, for the hero, the conclusion and the closing ground into Contact.
  V1.6's hero was checked at 1920x1080, 1680x1050, 1536x864, 1440x900, 1366x768, 1280x800, 1024x768,
  768x1024 and 390x844, frame by frame through its assembly, idle cycle, engagement and the rise of
  the Foundation, with a mouse, touch and the keyboard, and with reduced motion and without
  JavaScript; 29 deliberate breakages of its promises were each caught by `verify.mjs`.
- **HOME** (every page but the homepage): the header leads with a HOME link to the homepage in place
  of the name, in the navigation's pill and padding and the small tracked capitals the site keeps for
  labels (the capitals are CSS, so it reads as "Home"). Since the V1.2 delta a small outlined house
  leads it: Phosphor's House Simple, at the label's optical size (1.25em) and in its Bold weight, whose
  stroke matches the label's bold capitals where the Regular reads lighter; it is decorative (the link's
  name stays "Home") and rises a pixel on hover beside the label's color change, with no movement for
  reduced motion. The header is shared, so every inner page has it; the navigation is otherwise
  unchanged.
- **06 Flagship animation campaign** (dark surface, its own chapter, after Technical documentation
  and, since V1.4, straight before the conclusion): the headline "One minute to make the product clear.", the metadata row
  (Goal, Services and Credits, Bob van der Meer in bold), and the contribution statement centered
  beneath it (Bob's name is in the credits only; "mapped the one-minute narrative from first frame to
  final CTA" set a little heavier since V1.3). Then the film in a large 16:9 frame with no device around it:
  nearly the full width (95% at 1440x900), held to the height of the screen below the header so the
  whole frame is in view at once (86% wide at 1366x768), never wider than 120rem, entering with a short
  rise, and edge to edge on phones. Beneath it, centered, the results under "First 48 hours after
  launch": ~14% engagement rate (read as "About 14%"), 84% of impressions from non-followers (a share
  of impressions, never of engagements), +140% website traffic and +153% technical-documentation
  traffic, four across on wide screens and two by two below 60rem; then "More than 16x typical post
  reach" and (V1.3) "Recognized and amplified by key ecosystem foundation accounts", which names no
  ecosystem or account; the figure and the accounts are in bold, and neither line takes a period, as a
  pair of results.
- **The film**: `bolt-in-60-seconds.mp4` from the Portfolio folder, the approved optimized cut (60.0
  seconds, 1920x1080 at 23.976 fps, H.264 with AAC stereo), complete and uncut, its music, voiceover and
  sound-effects mix untouched; the larger master (Hero animation.mp4) is not used (the hero's short loop
  is removed in the V1.2 delta), and no file under the master's name is tracked. Wide screens get `bolt-in-60-seconds-film.mp4`, a
  lossless remux (the same video and audio streams bit for bit, 16.2 MB, with the editing
  application's project metadata removed and the index moved to the front so playback starts while it
  downloads); phones get `bolt-in-60-seconds-film-720.mp4`, 1280x720, H.264 High at CRF 24 with
  animation tuning (SSIM 0.997 against the source), its audio stream copied unchanged, 6.1 MB. Poster:
  `hero-thumbnail.png` from the Portfolio folder, the film's own thumbnail, 1920x1080
  (`bolt-in-60-seconds-film-poster.png`). The copies in the repository also carry the content
  credentials (a signed C2PA manifest of about 6 KB) that the Claude app attaches to the files it
  delivers; the picture and sound are unchanged.
- **Sound and playback** (`Film` in `tpm-motion.ts`): fetched as the frame comes within a screen of
  view; muted autoplay once at least half the frame is in view (never for reduced motion, data saving or
  a browser that refuses), paused whenever the frame leaves (under 20% visible) and resumed when it
  returns; it plays once, holds its final frame (the Bolt Liquidity end card) and never loops. A white
  "Play with sound" button with a speaker icon and its text label stays on the film, at its lower left
  (beneath it on phones, where the film is small), for as long as it plays silently, with a small pause,
  play or replay beside it. Taking it up starts the film again from 00:00 with sound, and standard
  controls replace it: Mute or Unmute, Pause or Play, and Replay; once the film has ended, Replay alone
  remains. A keyboard reader's focus moves from the button to Pause. Without JavaScript the film keeps
  its poster and the browser's own controls.
- **Captions**: checked against the narration (transcribed and matched to the picture): every spoken
  line also appears on screen, as kinetic type ("Better pricing comes with a cost.", "Bigger pools",
  "More TVL", "More capital committed to liquidity", "That assumes one pool has to do two jobs",
  "Create the price" and "Settle the trade", "It doesn't", "It just provides the inventory", "The
  result", "100x daily capital turnover", "Launching an asset", "Building a market", "Expanding a DeFi
  product", "Liquidity, product, ecosystem, growth" and "That's how you build real onchain markets with
  far less capital.") or as a labeled diagram (the global market price passing through a smart contract
  to atomic settlement, while the narration says Bolt brings price discovery onchain, makes it
  executable and settles atomically; trades 1, 2 and 3 drawing on one pool for "the same capital can
  support one trade, then another, then another"). No essential information is carried by the voice
  alone, so, as the brief allows, no caption track ships and nothing is shown on screen. An optional CC
  track, off by default, is one `<track>` and a control to add if wanted.
- **Paragraphs and metadata** (V1.3 and V1.4, 02 and 04 to 06): V1.4 widens the narrative
  paragraphs to the brief's 800 to 860px. Each chapter's contribution is 53rem (848px; 47rem in V1.3):
  at its 24px it sets 65 to 77 characters a line, and the Website statement now reads in four lines
  (five before), Technical documentation in five (six) and the campaign in five (six); its lines run
  close to the measure rather than balanced shorter. The Foundation paragraph is 52rem (832px; 46rem in
  V1.3) and, on wide screens, balanced, so it reads in three even lines instead of four with a short
  last line. At its smaller 18px that is about 91 to 100 characters a line, longer than the brief's
  65 to 78: three lines and that measure, or four balanced lines of about 71 characters that would read
  narrower than V1.3's, was the choice, and the type stays as it is; its generous leading carries the
  longer line, and it is only three lines. Below 60rem it wraps as before. Goal, Services and
  Credits are three equal columns on screens 60rem and wider in every chapter (one column below, so no
  entry is left alone on a second row), their labels and first lines aligned, a long entry wrapping
  inside its column without widening it (`TpmCase.astro`).
- **Emphasis** (V1.3): at most one phrase of a paragraph is set a little heavier (weight 600, the
  surface's main ink): "a clear market narrative" (hero), "a shared internal language" (02), "a
  complete rebuild and launch in two weeks" (04), "useful, accurate, and appropriate for public
  release" (05) and "mapped the one-minute narrative from first frame to final CTA" (06). The accent
  color marks one phrase in three headlines only: "the system" (hero), "the foundation." (02) and
  "Every expression aligned." (07). The statement's highlight is the only animated emphasis. Bold,
  accent and highlight never meet on one phrase, and no headline carries an icon. Each phrase is named
  beside its text in `tpm.json` (`em`, `accent`), and the build stops if it is not there exactly once.
- **Selected Writing** (V1.3) was taken out in V1.4, completely: the section (its headline, the two
  editorial rows for The Missing Price Layer and DeFi's Billion-Dollar Problem, their excerpts and
  covers, and their entrance), `TpmWriting.astro`, its line in the page and the `writing` block of
  `tpm.json`; the two covers are deleted from `src/assets/technical-marketing/`, `tm-article-2` is
  gone from the manifest and `tm-article-1` is back to the pending placeholder it was before V1.3. No
  spacer, hidden markup, style or script is left, and the campaign leads straight into the conclusion.
  For a later Writing page or archive, the covers, their provenance notes and the excerpts are in the
  repository's history (the V1.3 commit, 083fb76).
- **07 The conclusion** (V1.3, renumbered in V1.4, rebuilt as the page's closing movement in V1.5):
  "One foundation. Every expression aligned." (each sentence on its own line where there is room, the
  second in the accent), then "The work began with a shared product language and carried through the
  website, technical documentation, and flagship campaign, giving every public-facing expression the
  same strategic foundation." Then (V1.4), in place of the "Next case study" label and title, one
  conversational sentence, the whole of it the link to the next case study, Events and Multimedia
  Production (`/work/events-video/`): "Next, see how I bring events and multimedia production from
  concept through execution." Since the Events V1.2 brief the sentence sits in the case studies' shared
  way on (`NextCase.astro`): one bordered, gently rounded container about as wide as the paragraph,
  the sentence at the left and the arrow in a small circle at the right (see [Events and Multimedia
  Production, Version 1.2](#events-and-multimedia-production-version-12)).
- **The closing ground** (V1.5): one continuous movement from the campaign into Contact, black, deep
  charcoal teal, the established Contact green. The campaign keeps its black; the conclusion begins on
  that same black (#0D0F10) and turns as it goes, through a deep charcoal teal (#141E1F at its middle),
  to exactly the Contact green (#1F4546) where Contact begins: eleven stops interpolated in OKLab, so
  the steps are even and each is a little lighter and a little more teal than the last, never a muddy
  grey. No cream band and no seam; nothing animates the gradient. The type is the warm cream of the
  green surface, the paragraph a step softer, the accent the green surface's light aqua: the paragraph
  keeps 14.6:1 on the black start and 8.4:1 on the green, the accent 13:1 and 7.2:1. Contact's grid
  rises out of the lower part of the conclusion, from nothing to its usual strength where Contact
  begins (see [Contact and the closing frame](docs/SITE_SPEC.md#contact-and-the-closing-frame)), and the conclusion's
  words sit above its lines.
- **Its spacing** (V1.5): on wide screens the conclusion is a full screen tall (`min-height: 100svh`,
  the header row reserved at its top), its beats centered in it: the headline; about 48 to 64px (53px
  at 1440 wide); the paragraph, as wide as the chapters' contributions (53rem, 848px, where it sets 70,
  70 and 55 characters a line at 1440); about 80 to 100px (95px at 1440); and the sentence, lower in
  the frame as the page's last forward movement. Tablets and phones keep the beats a little closer (40
  and 64px) and let the section take its natural height. The sentence is the paragraph's size, cream
  and a little heavier, set apart by space alone (no rule, card or box), and ends in a small arrow that
  never wraps alone. A quiet pale-aqua underline says it is a link; on hover and keyboard focus the
  sentence and its underline take the light aqua and the arrow moves a quarter of an em; focus keeps
  the site's outline. It is a navigation landmark named "Next case study" for screen readers.
  `TpmConclusion.astro` stops the build if the case study it names is missing or is no longer the next
  in the collection's order. No metrics, services, credits or roles are repeated.
- **00 The opening sequence** (homepage only; replaced in Events V1.5 by the directional loader, see
  [Events and Multimedia Production, Version 1.5](#events-and-multimedia-production-version-15); what
  follows is the V1.2 sequence, for the record): "Welcome." is gone; exactly three phrases, "Product
  complexity.", "Market clarity." and "Strategy into execution.", centered in the viewport on one
  shared center, in the portfolio's display face (Archivo) at weight 450 and full width rather than the
  headlines' 700, about 44px at 1440 wide (26px on phones), and sized so "Strategy into execution."
  (10.5em) always keeps to one line. They are consecutive faces of one restrained vertical cylinder
  (50 degrees between faces, an axis 1.2em behind the screen, a distant 22em perspective): each phrase
  turns forward from below, sharpening and coming to full strength, settles flat and sharp, and holds;
  then it turns upward and away, fading and softening a little, as the next arrives, on one smooth
  curve with no bounce or overshoot. Timing on wide screens: the first phrase turns in over 400ms,
  reading holds of 550ms from the moment a phrase settles, turns of 440ms, a final hold of 610ms; then
  "Strategy into execution." turns gently upward and dissolves (380ms), and 110ms later the ground
  clears (480ms) as the hero, already loaded beneath it, rises 14px from slight softness (6px blur, 102
  to 100% scale) into place over 640ms, its name, then the navigation, then its information fading in
  60, 120 and 180ms after it starts: 3.79 seconds in all. Phones run a little shorter (3.67 seconds,
  turns of 400ms, a final hold of 570ms). With reduced motion the final phrase stands still for 1.1
  seconds, then crossfades straight to the hero (450ms). The timing is a set of custom properties on
  the document (`--intro-*` in `Intro.astro`), which `Hero.astro` and `Header.astro` read for the
  handoff.
- **When it plays**: an inline script in the head decides before the first paint, once per browsing
  session (`sessionStorage`, `jc-intro`): never on a return to the homepage, never for a visit that
  began on another page of the site (a same-origin referrer) and never for a link to a section; a tab
  opened in the background holds it until it is shown. Nothing waits for it: the hero photograph (both
  layers, as AVIF, exactly as the hero's pictures request them) and the two faces of the first screen
  are preloaded, and the videos load as usual. Scrolling, a click, a tap or any key dismisses it at once
  (the overlay fades in 220ms over a hero already in place); once the ground has begun to clear, the
  handoff simply finishes. It is `aria-hidden`, and it ends by itself even if its script never runs.
- **Checks**: `verify.mjs` holds the approved copy word for word (the hero, the two-line foundation
  headline, the paragraph, the statement, the three chapters' metadata and contribution statements,
  the conclusion and its sentence); the hero's section label, headline (two unbroken lines, V1.5's size or less
  to fit its column), paragraph and seven scope terms with no media or canvas (the loop files, poster
  and manifest entry gone), the split (the label, headline and paragraph before the system, 5fr and
  7fr, centered on each other, the first screen tall), the scope line (its own row beneath the split,
  the two composed as one centered group, not in the copy column, centered, one line on wide screens
  with its fine rules from 88rem, no term broken, fixed type), the isometric system (V1.6: the V1.5
  engine and signal field, their modules and the V1.4 object and field gone; one image to assistive
  technology described in `tpm.json`'s words; its three inputs, its foundation with base, nine blocks,
  four guides and the canopy, and its three expressions, drawn back to front, the front guide over the
  blocks; no circles, orbs, radial glows or words drawn into the foundation; an assembly of 2.5 to 4
  seconds that settles before the idle life begins; an idle cycle of 12 seconds or more and drifts of
  a pixel or two; its keyframes present and its signals' and lights' keyframes, nine stretches each
  way, in the head; every movement only with motion allowed, on HTML boxes, one to an element, save
  the light's run along the conduits; paused off screen and its idle life stopped during the rise;
  engaged, the layers separating and settling by transitions, the guides stretching, the conduits lit
  and the signals faster; seven labels in order in the drawing and in the phone's legend, hidden at
  rest; the legend below 37.5rem with its room kept; the pointer's own outline, the whole box once
  open; one control, its two names from `tpm.json`, `aria-expanded` and `aria-controls`, out of sight
  for a mouse until focused and in view on touch screens; hover and focus for no JavaScript; a faint
  local grid, cut to the drawing; no WebGL or canvas in its script, which carries its pointer, tap,
  key, readiness and visibility guards), the V1.2 bands and rising ground gone, and the layered
  reveal (one screen of scrolling, the hero giving its last screen to the Foundation, the rounded
  leading edge, the headline's 24 to 40px rise); the twelve
  documents' numbers, titles and sublines in order, each card's strip, icon and nothing else, a
  distinct accent and icon for every document and no near-identical neighbors, the twelve Phosphor
  icons by name on their 256 grid with one rule for their size, place and fade, one or two blank
  covers, the shared card grid, the removed documents and the unpublished interview count, the 80-word
  ceiling; the statement word by word and its one highlight (its clause, a translucent teal band that
  sweeps, no bold or color); no arrow sequence left; the Website display and the browser frame, Goal,
  Services and Credits only, in three equal columns, the paragraph measures (800 to 860px, the
  Foundation's balanced on wide screens), the
  centered contributions with Bob only in the credits, the live-site button (its link, new tab, label,
  arrow, screen-reader note, place outside the display), the walkthroughs' markup (no loop attribute,
  autoplay or controls, phone encode first, a hidden labeled control, a lazy poster) and files (length,
  H.264, silent, fast start, dimensions, sizes), both walkthroughs' hold and fade back to the start, the
  chapters (titles, order, the diagram longest, their buttons, the centered introducing line that names
  them, no page count or spotlight), the `is-live`, width, height and motion guards on every sticky
  rule, no vertical text, the motion script's guards (including the hold on the last frame, the
  system's hit area, toggle, Escape, touch, quick, readiness and off-screen guards, the rise's
  stilling of the system, and no WebGL or canvas), the
  closing Contact frame, HOME with its
  house on every inner page (its size, the hover rise and none for reduced motion) and not on the
  homepage. For 06: its place after 05, its surface, headline, metadata and centered contribution (no
  second mention of Bob), the frame (no device, nearly full width at 16:9), the film's markup (muted,
  inline, no loop or autoplay, native controls for no script, phone encode first, no caption track, a
  lazy poster), the Play with sound button (text, speaker icon, prominence) and the standard controls,
  the files (60 seconds, H.264 with its audio, fast start, dimensions, sizes, no project metadata,
  never the master or the loop), and the results word for word, with the 84% only ever of impressions
  and no account named. Selected Writing gone without a trace: no section, rows, excerpts, covers,
  hidden markup or spacer on the page, no `writing` block, no `TpmWriting.astro`, no covers in the
  repository, the manifest (only the pending placeholder) or the build, no styles or script, and
  nothing but the campaign's own script between the campaign and the conclusion. For 07: the headline
  and its accent, the paragraph, then one link only, the whole sentence word for word, to the next
  case study by the collection's order (and naming it), ending in its decorative arrow that never
  wraps alone, a navigation landmark, no label or title block and nothing repeated; no border, fill,
  shadow or outline of its own, a quiet underline with a color transition, the accent on hover and
  focus, the arrow moving slightly, the site's focus outline kept; and since V1.5 a dark ground (read
  as dark by the header) from the campaign's black (#0D0F10) to the Contact green (#1F4546) in at
  least eight stops, each lighter than the last and on the teal side, with no cream band, the cream
  type, a full screen on wide screens, the paragraph exactly as wide as the chapters' contributions
  (800 to 860px), the beats (48 to 64px, then 80 to 100px), the words above the rising grid, and
  Contact's lead and its fade (and none on the homepage). Across the page: the order (hero,
  foundation, website, documentation, campaign, conclusion, Contact), one emphasis per paragraph at most, the
  accent in a few headlines only, never stacked with bold or the highlight, and no icons in headlines.
  For 00: the three phrases (no Welcome.), the display face lighter than the headlines, one line, one
  center, the drum (perspective, an axis behind the screen, rotations from and to only, curves that
  never overshoot), every hold and turn inside its range on wide screens and phones, 3.2 to 3.8
  seconds in all, phones no longer, the last phrase gone before the ground has cleared, the hero's 12
  to 16px rise, 102% and softness, the name, navigation and information in that order, the still
  crossfade for reduced motion, the head decision's guards, the preloads matching the hero's pictures
  and the stylesheet's faces, the dismissal events and the homepage-only placement.

## Events and Multimedia Production, Version 1.6

John's Events and Multimedia Production V1.6 brief (October 17, 2026, a delta against the V1.5 build on
the live site) in three parts: the homepage's opening sequence (Part I), the Events page's pieces
(Part II) and the production deck's layout and progression (Part III). Everything the brief does not
name is as V1.5 left it, and no visitor-facing copy uses an em dash. The brief's written
specifications are complete on their own; its frame references (screenshots on John's desktop) set
the hero's cut points.

- **01 The opening sequence's pacing** (`Intro.astro`; `Hero.astro` and `Header.astro` for the
  handoff). The viewing note is the message that has to be read: it arrives (130ms), settles and holds,
  fully legible, for 1.3 seconds (V1.5: 0.46 of a 0.64-second turn). The three phrases then come in
  quick succession, each fully visible for 0.3 seconds (V1.5: about 0.2 of a turn of about half a
  second), a three-beat impression rather than a read. Every change is one short, overlapping transition: the next word starts to arrive
  30ms after the last starts to leave, both in 130ms, and the leaving word is gone at about two thirds
  of its drift, so there is never a blank and never two words read at once. The marker still arrives as
  the last phrase ends (2.85 s) and the hero's layers, in V1.5's order and overlapping, now take 0.6
  seconds (the photograph and its subject over 0.6 s; the name from +70ms, the descriptor +140ms, the
  navigation +200ms, the rule +220ms, the arrow +300ms): the hero is in place at about 3.45 seconds.
  Every turn is derived from the two windows (`--intro-hold`, `--intro-show`) and the transitions, so
  changing one moves everything after it. As before: once per browsing session, never on a return from
  a case study, a visit that began inside the site or a link to a section; near-instant with reduced
  motion; dismissed by any intent; no percentage.
- **02 The Amplify hold** (`EvTransition.astro`). The first four words keep their pace. The signal after
  AMPLIFY. now begins within the word's own beat (the tile from 0.1 s, where it waited 0.3 s) and is
  complete about a second after it (1.06 s, from 1.26 s), with no new animation; from 0.42 of a screen
  past the word (`RESOLVE`) it is shown complete and still however fast the reader came, and the
  finished line then holds for 0.3 of a screen more (`HOLD`, about 0.6 to 0.9 seconds at an ordinary
  pace) before the section lets go. The section is 2.27 screens tall (1.78 in V1.5); the script sets it
  from the constants and the stylesheet's fallback repeats it.
- **03 The concept rendering's words** (`EvActivation.astro`; `events.json`, `activation`). The
  headline's second half, "before anyone enters the room.", is in the page's teal (`--accent-ink`), the
  color alone (no weight, underline, mark or motion), named by `accent` like the other headlines' (the
  build stops unless it appears in the headline once). The new paragraph: "Before the doors open, I
  shape the strategy and coordinate every part of the activation, from sponsorships, speaking
  opportunities, and merchandise to event assets, on-site content, and post-event distribution."
- **04 The production treatment** (`EvDeck.astro`). The hero's vocabulary on each card's active media,
  quieter: four corner marks just outside the frame (0.7rem, 1px, at 20% opacity; the hero's are 0.9rem) and,
  at its top right, a small timecode, TC and the clip's own time (hours, minutes, seconds and frames at
  24 a second, read from the video's current time, frame by frame while it plays and held where it
  stops; 0.625rem against the hero's 0.6875rem, on a faint shade). It appears once the clip shown has
  played (there is none over the setup photograph) and steps aside on the smallest frames; a closed
  card draws none of it, and the player's own corner marks give way to these inside the deck. No
  PROGRAM, tally, REC, scan lines, status lights or controls are added. Only with JavaScript.
- **05 Live presentation**: its preview is the hero's own Max Presentation edit (the same file,
  `ev-hero-presentation.mp4`), shown in the recording's own 2.157:1 frame (`previewFit: native`), muted,
  playing while its card is open and in view, looping, with its pause control; no full film and no
  sound. The outcome: "Event-led introductions and follow-through helped secure three aggregator
  integrations and opened strategic discussions with ecosystem leadership." (it names no integration
  and no organization). The credit: "Organized, directed, and captured by John Cowin · Speaker Max
  McKendry · Deck design and video edit by Bob van der Meer". (The V1.5 preview, `ev-max-loop`, stays on
  the homepage's Select Work card.)
- **06 One film with sound**: only the production room's finished explainer, under FINAL, has a film
  with sound (Watch full video with sound and its player); the event film's is gone (its file,
  `suifest-interviews.mp4`, stays in the project, unused, as the presentation's has since V1.5). FINAL's
  muted preview is now its two scenes alone (`ev-room-final-loop`, `bolt-slippage-final-loop.mp4`, 8.84
  s): 1:09.111 to 1:17.953 of the film, from the first frame of "Bolt solves slippage by providing you
  a deterministic price" to the last frame of "you have a set execution price that will be filled" (the
  brief's second scene, "What this means is that you have a set execution price that you will be
  filled."), each line's type complete, cut on the film's own shot boundaries and looping back
  to the first scene with a plain cut. Nothing of the shot before ("When things like slippage occur",
  whose last frame is at 1:09.069) is in it. 1600 by 900, silent, its poster at 1:13.41. The homepage
  keeps its own slippage preview.
- **07 Event film**: its card plays the hero's Sui Fest edit (the same file, `ev-hero-event-film.mp4`),
  muted, playing while its card is open and in view, looping, with its pause control; no Watch and no
  sound.
- **08 The hero's order and new cuts** (`events.json`, `hero.chapters`; `assets.json`): 01 / TECHNICAL
  EXPLAINER, 02 / EVENT FILM, 03 / CREATOR PODCAST, 04 / LIVE PRESENTATION (the team interview, still
  pending, joins after the podcast). The Sui Fest chapter is the brief's two cuts
  (`ev-hero-event-film.mp4`, 11.97 s): 0:02.711 to 0:11.386, in on the head of the shot that carries "And
  we asked our favorite teams", through the montage to the end of the shot on screen at 0:11; then
  2:36.615 to 2:39.909, from the first frame of "Like a lot of people" to the last before "a whale, like
  a". One editorial call: the first cut comes in on the head of that shot rather than on John's 0:04
  reference frame (0:03.670, inside it), because from there the line would be on screen for a third of a
  second before dissolving under the reel's 350ms crossfade. The Jungle Talk chapter is two cuts
  (`ev-hero-podcast.mp4`, 7.72 s): 0:00 to 0:04.421 and 0:24.566 to 0:27.861 ("PUSH FOR LONGER DEALS"),
  each ending on its shot's last frame. Both are 1600 by 900, silent, H.264 with the index first. Their
  crops moved (`pos` 50% 92% and 50% 86%) so the burned-in captions stay whole and clear of the rail at
  both of the frame's proportions.
- **09 The cards' headers and rhythm**: the labels are stable (01 LIVE PRESENTATION, 02 PRODUCTION
  ROOM, 03 EVENT FILM, whatever the state; since Full Site Iteration V1.2, 01 PRODUCTION ROOM, 02 EVENT
  FILM, 03 LIVE PRESENTATION). On wide screens an open card's media and words start from
  one top line, with no minimum height and nothing centered or stretched to the media's height; the
  words run top to bottom with fixed gaps (up to 1.5rem after the headline and 2.75rem between the
  others, a little less on shorter screens; 0.9 and 1.35rem on narrow ones). The band between a card's
  header and its content is a fifth smaller: at 1728 by 1000, 55px from the header's foot to the live
  presentation's headline where V1.5's centering left 71 (22.5% less), the media starting on the same
  line. On narrow screens the media keeps a little room above it for its marks.
- **10 The scroll-assisted deck**: on wide screens with motion allowed (the deck at least 56rem wide,
  the window at least 640px tall), the deck pins just below the site's header inside a runway as long as
  its scrolling. The live presentation is open as it arrives; the reader's own scrolling opens the
  production room, then the event film, each after a viewing interval of six tenths of the window's
  height (360 to 640px of scrolling); scrolling back up runs the same turns in reverse; after the event
  film's interval the deck lets go and the page goes on. A chapter that does not fit the room on screen
  first moves up with the scroll until its foot is in view, then holds; the header after the open
  chapter shows below it where there is room, and on shorter windows waits below the edge so the open
  chapter's own header stays clear of the site's header (only a chapter taller than the room passes its
  header under the site's header on the way to its foot, as any long section does). A change of chapter
  eases the deck to its new place (0.55 s) rather than jumping. A click, a tap or the keyboard opens any
  chapter at once; while the deck is pinned, the page moves, unseen (the deck stays where the reader is
  looking), to the start of that chapter's turn, so scrolling carries on from it. Nothing snaps, the
  deck's scroll listener is passive and it handles no wheel or touch, nothing advances by itself and no
  video has to finish. Reduced motion, narrow screens and short windows keep V1.5's manual accordion.
  Without JavaScript every chapter is open; the live presentation and the event film show their
  previews still, on their posters (V1.5 left the live presentation's media column empty), and the
  production room its photograph, then its film with native controls.
- **Checks** (`verify.mjs`): the opening sequence (the note held fully legible for 1.25 to 1.5 s, each
  phrase fully visible for 0.28 to 0.38 s, transitions of 0.12 to 0.16 s with the next word arriving
  before the last has gone, every turn derived from them, the hero's layers 0.6 to 0.8 s and in order,
  3 to 3.5 s in all, the last phrase leaving at the reveal, a leaving word gone early only by its
  opacity and never overshooting); the Amplify hold (the section 2.1 to 2.4 screens and its fallback
  equal to the script's, RESOLVE and HOLD in range, the signal complete and still from RESOLVE, its
  complete frame, the tile in before 0.3 s, the sequence over by 1.15 s); the activation's paragraph and
  its one accent, the color alone; the hero's order, its four chapters until the interview arrives, the
  Sui Fest and Jungle Talk cuts, lengths and files; the deck (the live presentation's outcome and
  credit; its preview and the event film's the hero's own files, the presentation in its own frame;
  the Final loop's range, the shot it leaves out, its length, silence, size, index and poster, and the
  homepage's preview untouched; Watch and a player only in the production room; names whole after
  every "by"; each card's frame with four marks, a timecode and nothing else, smaller and fainter than
  the hero's, only with JavaScript, the timecode only once its clip has played and read from the clip's
  own time, the player's marks giving way; one top line, no minimum height or centering, fixed gaps
  within bounds, the band below the header; the pinned deck sticky in its flow-root runway, no snapping,
  a passive scroll listener of its own and no wheel or touch listener, the pin gated by the
  reduced-motion query, the deck's width and the window's height together, the six-tenths interval,
  nothing on a timer; without JavaScript, previews hidden only where a film replaces them). Each new
  check was shown to catch what it guards: on a scratch copy of the repository, 86 deliberate
  breaks, one at a time (V1.6's and a sample of earlier ones), each failed the check meant for it. That
  run also found two checks that could not fail (the leaving word's stops, read past one keyframe, and
  a scroll listener check that another script on the page could satisfy); both now read what they
  guard.
- **Verified** in the browser (Chromium, the videos as VP9 twins since it has no H.264): 114 behavior
  checks (38 on the homepage: the sequence frame by frame on its own clock, its windows and overlaps,
  never blank, the marker, the dissolve, the layers and the total, once per session, reduced motion,
  dismissal; 76 on the Events page: the reel's order, cuts and labels, the Amplify hold, the accent, the
  deck's marks and a timecode that follows its clip, the cards' media and Watch, the rhythm and the
  band, and the pinned deck's entry, turns, intervals, reverse, clicks, release and its manual accordion
  for reduced motion, narrow and short windows); every page from 320 to 2,560px wide with no horizontal
  overflow and the Work menu open; at every wide size the deck pinned where it should be, its turns in
  order with their intervals, the open chapter's foot in view and its header clear of the site's header
  except where the chapter is taller than the room; without JavaScript at 1440 by 900 and 390 by 844;
  `astro check`; and the full check with the accessibility scan.

## Events and Multimedia Production, Version 1.5

John's Events and Multimedia Production V1.5 brief (October 16, 2026, on the live site after the V1.4
deployment): a delta in two parts, the changes approved for this build (the homepage's opening
sequence and hero entrance, a menu of the case studies on Work, and the production deck's layout,
copy and controls) and one item deferred (an outcomes band after the deck, to be considered only once
this version is live; nothing of it is built, and no networking or relationships section is added).
Everything the brief does not name is as before. No visitor-facing copy uses an em dash.

- **00A The opening sequence: faster and directional** (`Intro.astro`; its words in `home.json`,
  `intro`). It replaces V1.2's turning cylinder. On the ink ground, a small marker in the light accent
  (a 7px square) travels a faint hairline drawn from gutter to gutter, from its left end to its right
  (a sine ease, no overshoot), a short streak behind it that grows with its speed and is gone at rest,
  while the words come in quick succession at one center: the viewing note, BEST EXPERIENCED ON
  DESKTOP, small and quiet in the site's tracked capitals (a recommendation, not a warning), for about
  0.7 seconds; then "Product complexity.", "Market clarity." and "Strategy, executed.", in the display
  face at weight 450, about half a second each (0.48, 0.48 and 0.5). Each word arrives from the left in
  180ms and leaves to the right in 130ms, the way the marker runs, the next arriving 100ms after the
  last starts to go, so the cadence is brisk but never a flicker or a cut to black. The marker arrives
  as the last phrase ends (2.16 s); the words and the path leave just before, and the ground dissolves
  (0.4 s). No percentage: the marker is a pace, not a measure. The reference recording (a Sui loader)
  was used for its pacing and structure only. Timings are custom properties on the document
  (`--intro-*`), the same on phones, where every word keeps to one line.
- **00B The layered hero entrance** (`Hero.astro`, `Header.astro`): as the ground dissolves, the hero
  comes up in layers, overlapping, in the brief's order for the layers this hero has (it has no eyebrow
  and no buttons of its own): the ambient layer, the photograph with its subject (registered, from 45%
  brightness and 103% scale to their own over 0.7 s); the name, rising 10px as it fades in (+90ms); the
  descriptor, the same way (+170ms); the navigation, its actions (+240ms); then the supporting details,
  the rule drawing from left to right as the marker ran (+300ms) and the arrow settling into its corner
  (+380ms). The entrance takes 0.74 seconds from the reveal, and the whole sequence about 2.9 seconds;
  the hero ends exactly where it stands without the sequence.
- **When it plays**: as before, decided in the head before the first paint, once per browsing session
  (`sessionStorage`, `jc-intro`): never on a return to the homepage (from a case study, by a link or the
  back button), never for a visit that began on another page of the site, never for a link to a
  section; a tab opened in the background waits until it is shown; scrolling, a click, a tap or a key
  ends it at once over a hero already in place. **Reduced motion**: no travel and no words, the ground
  clearing straight to the hero in a fifth of a second. Hidden from assistive technology; without
  JavaScript it never appears.
- **00C Work: a menu of the case studies** (`Header.astro`, every page). A small chevron on Work, and a
  compact panel in the header's own colors beneath it: 01 Creator Marketing and Partnerships, 02
  Technical Product Marketing, 03 Events and Multimedia Production (numbered and titled as on the
  homepage, drawn from the collection), the one you are on marked (`aria-current`). On a desktop it
  opens on hover (60ms on the way in) and when the keyboard focus reaches Work, and closes 280ms after
  the pointer leaves (the gap beneath Work belongs to the panel, so the pointer can travel into it),
  when the focus leaves, or on Escape (back to Work; Tab then moves on to About); Tab walks through it
  and the arrow keys, Home and End move within it, with the site's focus ring. On a touch screen the
  first tap on Work opens it and a second follows the link; a tap elsewhere closes it. Closed, its
  links are out of reach (`inert`); Work states `aria-expanded` once the script runs. Without
  JavaScript, hover and focus still open it. In the phone menu the three case studies are listed under
  Work. It opens with a 160ms fade and a 4px settle (none with reduced motion).
- **01 The deck's words given room** (all three chapters). On wide screens the words now fill the
  column's height beside the media (which stays centered): the headline near the top, the fine-print
  credit toward the bottom, and decorative spacers between the five groups (the headline, the
  introduction, the things John did, the outcome, the credit). The chapter sizes itself with the
  spacers at their minimum (at least 1 to 1.25rem after the headline and 1.25 to 2rem between the
  others, more on taller screens; V1.4 kept 0.85rem between everything), and they grow with the room
  the chapter has, equally, up to 1.5rem and 2.75rem; anything left over is shared above and below, so
  nothing drifts apart. On narrow screens they stay at 0.9 and 1.35rem. Paragraph width and line
  heights are as before; no new rules or line animations. The chapters keep V1.4's size (about 70% of
  the screen) where their words fit; the event film's longer words make it taller (79% at 1440 by 900,
  96% at 1280 by 720).
- **02 Live presentation**: no Watch full video with sound and no full film; the edited sequence stays
  as its muted preview, with its pause control. New approved headline, introduction, three points and
  outcome; the credit as before, with the serial comma: "Organized, directed, and captured by John
  Cowin · Speaker Max McKendry · Deck design Bob van der Meer". (Its film, `ev-room-presentation`,
  stays in the project, unused, in case it is wanted again.)
- **03 Production room**: a clear segmented control just above the stage at every width (never laid
  over it): two equal options, SETUP and FINAL, in one track, the selected one filled in the page's
  accent with dark type on it (5.3:1), the other quiet until hovered, a strong focus ring, no icons,
  2.75rem tall; there from the first paint with JavaScript, absent without it. Switching still
  crossfades the stage (0.35 s; at once with reduced motion). The setup caption is gone. Watch full
  video with sound shows only under FINAL: under SETUP it is out of sight and out of reach, its line
  kept so nothing below moves, and it fades in with FINAL. New approved copy; the credit "Concept,
  questions, direction, capture, and edit briefs by John Cowin · On-camera Max McKendry · Final edit
  Bob van der Meer", and Bob van der Meer's edit is credited nowhere above it.
- **04 Event film**: reframed as ecosystem positioning and distribution; the angle of not being a
  sponsor or not owning the stage is gone, and so is the reach figure (no estimate replaces it). New
  approved headline, introduction, points and outcome. The credit: "Concept, interviews, coordination,
  and distribution by John Cowin · Final edit Bob van der Meer", the participating teams on a second
  fine-print line ("With Cetus, Bluefin, 7K DeFi, NAVI & Astros, FlowX Finance, DoubleUp, Claynosaurz
  and Talus"). In the fine print, names stay whole (no break inside a name or a team) and lines avoid
  a lone last word.
- **Checks** (`verify.mjs`): the opening sequence (its words exactly and in order, no percentage, the
  marker on its path from end to end and arriving as the last phrase ends, without bounce; the note
  about 0.7 s, each phrase 0.4 to 0.55 s, the dissolve and the layered entrance 0.6 to 0.8 s, the whole
  2.4 to 3 s; words arriving from the left and leaving to the right; the hero's layers in order and
  overlapping; reduced motion near-instant; once per session; dismissal; homepage only), the Work menu
  (on every page, the three case studies in order with their numbers and titles, the current one marked,
  `aria-expanded` only from the script, hidden until it opens, hover and focus without JavaScript, the
  bridge under Work, the opening and closing delays, the keyboard, touch and Escape, no motion for
  reduced motion, the phone menu), and the deck (every chapter's words as approved, the live
  presentation's preview only, Watch and the film where a chapter has one, two players on the page;
  the words filling the column with their spacers and bounded gaps; the control's two equal options, in
  the accent, above the stage, without icons, from the first paint; no caption; Watch only under Final
  with its line kept; Bob van der Meer's edit only in the fine print; names kept whole; the event film
  with no sponsorship angle and no reach figure). The page-wide rule against YouTube now forbids links
  only, since the approved outcome names the YouTube channel. Each new check was shown to catch what it
  guards: on a scratch copy of the repository, 68 deliberate breaks, one at a time, each
  failed the check meant for it.
- **Verified** in the browser: 94 behavior checks (the sequence frame by frame on its own
  clock, its words and timing, the marker's run and streak, the dissolve, the hero's layers and its
  final place, once per session, the return from a case study and by the back button, a visit that
  began on a case study, reduced motion, dismissal by a key, a phone; the Work menu by hover with its
  grace, keyboard, Escape and Tab, touch, a click through, the phone menu and the narrowest desktop; the
  Events page's V1.4 checks that still apply, the live presentation's preview and pause, the words'
  layout, the control and its states, Watch only under Final with nothing moving, Watch playing the
  film, the event film's Watch, reduced motion and a phone); no horizontal overflow on any page from
  320 to 2,560px wide, with the Work menu open; without JavaScript; and with the full check and the
  accessibility scan.

## Events and Multimedia Production, Version 1.4

John's Events and Multimedia Production V1.4 brief (October 14, 2026, on the live page after the V1.3
deployment): a delta again. Everything it does not name is as Version 1.3 left it: the hero's
headline, paragraph, reel, order, timing, labels, corner brackets and pause control; the activation's
words, rendering (at its approved V1.3 scale), caption and loops; the transition's words; the deck's
chapter copy, outcomes, credits, films and Watch actions; the conclusion, the way on and Contact; every
other page. No visitor-facing copy in the delta uses an em dash. The Singapore team interview is still
pending, with no placeholder.

- **02 The signal after AMPLIFY.: its motion inside the tile.** The approved Option A, Broadcast, solid
  tile, in its place after the word. The ring that left the tile is gone. Once the tile has wiped in
  (as before, a moment after the last word), a short sequence plays inside it, once, in 560
  milliseconds: the point, revealed at a low glow, brightens (0.70 to 0.86 s after the last word
  arrives); the inner arcs draw outward from their middles (0.78 to 1.02 s); the outer arcs follow
  (0.90 to 1.16 s); and the tile lifts very slightly in brightness, a wash of the light fog at no more
  than 10%, and settles (0.98 to 1.26 s). Each arc is its own stroke, drawn by its dash from nothing
  at its middle to its whole length, so it opens both ways at once; the tile clips its contents, so
  nothing reaches past its edge. No halo, ring, bloom, bounce, scaling or repeat; still not a button;
  with reduced motion (or without JavaScript) the complete icon is simply there.
- **04 The Expanding Production Deck: one full-width vertical accordion at every width.** The
  horizontal deck is gone. The three chapters stack, every header always visible (its number, its
  title and a chevron, nothing more; 4.25rem tall on wide screens, 3.5rem on narrow ones, comfortable
  to tap), and one chapter is open at a time, the live presentation to begin with. A click or a tap on
  a header opens its chapter and closes the other; the open one cannot be closed into nothing and says
  so (`aria-disabled`); the arrow keys, Home and End move between the headers, and a strong focus ring
  shows where the reader is. Nothing advances by itself. The heights ease over 0.55 seconds on a
  standard curve (no bounce); the chosen header moves up as a chapter above it closes but never under
  the site's header (if it would, the page follows it), and once the heights have settled the opened
  chapter is brought into view if it is not (the least scrolling that shows it, or its header just
  below the site's header when it is taller than the screen).
  - **Wide** (the deck 56rem or more, from about 990px wide): the open chapter is a substantial section,
    its media and its words side by side (the media 58% of the two columns, the words 42%), the chapter
    about 70% of the screen's height (its header included; more when its words need it, and never more
    than 48rem of content on very tall screens), its content centered with generous padding. The media
    is half as large again as V1.3's: 604, 680 and 720px wide at 1280, 1440 and 1920 (379, 438 and 469
    before), never past its sources' own width. The headline scales a little with the deck's width.
  - **Narrow**: the media above the words.
  - **Reduced motion**: a chapter changes through a short fade (0.2 s), its height set at once, with no
    scroll pinning. **Without JavaScript**: all three chapters open, each film with its native controls.
- **04 Setup and Final, inside the production room** (`setupFinal`). The chapter opens on SETUP: the
  behind-the-scenes photograph, whole at 16:9, with its equipment caption beneath ("Two cameras, two
  tripods, a clip-on mic, a laptop, and the venue's existing lighting."). Two compact tabs, SETUP and
  FINAL (a dark chip, the selected one filled), sit over the stage's top left where the media is at
  least 34rem wide, clear of the cameras, and just above it where it is narrower. FINAL crossfades
  (0.35 s) to the finished explainer within the same stage: the chapter's muted preview, with its pause
  control (it waits, `data-loop-off`, while Setup shows), and Watch full video with sound, which from
  Setup switches to Final and plays the film. The reader makes every switch; the stage is one grid cell
  as tall as the taller state, so nothing moves; a tab is a real tab (`aria-selected`, its panel named,
  the arrow keys, Home and End), and with reduced motion the change is immediate. Never side by side.
  Without JavaScript the photograph comes first, then the film. The state holds when the chapter is
  closed and opened again.
- **01 Hero: a restrained program monitor.** Beside the label at the top left, a small steady tally dot
  (lit in the light accent while the reel plays, unlit while it is paused or waiting; it never blinks)
  and the word PROGRAM: "● PROGRAM · 01 / LIVE PRESENTATION", the number and title changing with the
  chapter as before. TC before the running counter at the top right ("TC 00:00:04:22"), its counting and
  size unchanged. On smaller frames the timecode steps aside first (under 31rem), then the word
  PROGRAM (under 21.5rem), so the label never meets the pause control. The rail along the bottom inside
  edge is now a sequence timeline: a segment to each chapter, each as long as its chapter (so the team
  interview takes its place on its own when its footage arrives), the completed ones at 42% opacity, the
  active one at 68%, the upcoming ones at 20%, and one thin playhead in the light accent moving through
  the active segment. It is information, not a scrubber: nothing to drag and no words. On hover with a
  fine pointer, or with keyboard focus inside the frame, four faint corner marks (10% opacity) show the
  classic title-safe area, 80% of the frame, fading in and out over 0.4 s (at once with reduced motion);
  never on touch-only screens. No REC, meters, waveforms, grain, lens markings, crosshair, flicker,
  glitch or extra controls.
- **Checks** (`verify.mjs`, the Events block updated for V1.4): the signal's contained motion (no ring,
  halo, scaling or repeat; the tile clipping its contents; the sequence after the tile's reveal, in 450
  to 600 milliseconds, point, inner arcs, outer arcs and lift in that order; each arc drawn outward from
  its middle; a very slight lift that settles; nothing hidden for reduced motion), the monitor (PROGRAM
  and its steady dot, TC, the monitor's only words, the timeline's segments at their chapters' lengths,
  their quiet opacities, one playhead that the script moves and nothing to drag, the title-safe marks:
  corners only, 8 to 12%, hidden at rest, only for a fine pointer or keyboard focus, at once with reduced
  motion; no production clichés), the deck as one vertical stack (no rows, no vertical rails; the height
  easing in 0.4 to 0.7 s on a curve without bounce; wide: the media 56 to 60% and the chapter 65 to 75%
  of the screen; two columns only from 52 to 64rem; headers comfortable to tap, with a number, a title
  and a chevron, and no thumbnail; the open header disabled; the page placing the chosen header), and Setup
  and Final (one chapter, two tabs with Setup selected, each controlling its panel; the photograph whole
  at 16:9 with its caption; Final's preview, pause control and film, the preview waiting while Setup
  shows; one stage, cross-fading, at once with reduced motion; switched only by the reader). Each new
  check was shown to catch what it guards: on a scratch copy of the repository, 79 deliberate
  breaks, one at a time, each failed the check meant for it.
- **Verified** in the browser: a behavior run of 48 checks (the reel and its timeline chapter by
  chapter, the playhead in the active segment, the tally lit while playing and out while paused, never
  animated; the title-safe marks on hover, on leaving and with keyboard focus, never on a touch-only
  screen; the signal's sequence inside the tile after the reveal, settling complete; the deck's stack,
  one chapter open, its size and proportions, the chosen header never under the site's header, Setup to begin with,
  the crossfade to Final at the same size, the preview pausing back on Setup, the tabs' arrow keys, Watch
  from Setup, nothing advancing in twelve seconds; reduced motion, a phone and the unchanged desktop
  hero); no horizontal overflow from 320 to 2,560px wide; without JavaScript; and with the full check
  and the accessibility scan.

## Events and Multimedia Production, Version 1.3

John's Events and Multimedia Production V1.3 brief (October 14, 2026, on the live page after the V1.2
deployment): a delta, not a rebuild. It implements only what the brief lists; everything else, the
hero, its reel and labels, the conclusion, the way on, the television's and the projection's loops,
the rendering itself and the Technical Product Marketing page outside Contact, is as Version 1.2 left
it. The page now runs: 01 Hero, 02 the transition, 03 Build the activation, 04 the Expanding Production
Deck, 05 the conclusion (with the way on to the next case study), Contact. No visitor-facing copy uses
an em dash.

- **02 The transition: the broadcast signal after AMPLIFY.** The approved Option A, Broadcast, in the
  solid tile treatment of John's reference (the reference's treatment only, not its bell; kept with the
  project as `reference/events-video/amplify-icon-treatment.png`, out of Git, and the page never points
  at a desktop file). The words are unchanged; the signal follows AMPLIFY. on its line, the two set
  so they never split: a square tile in the accent (0.9em, a little taller than the capitals, sitting
  on the line like the words) with a point and two pairs of arcs inside in outline weight, in the
  heading color. It is punctuation, not a button, and it is hidden from assistive technology with its
  line (the phrase reads as before). As the reader scrolls, it arrives only once the last word is in:
  0.3 seconds later the tile wipes in as the words do, the point and then the arcs open outward, and at
  1.2 seconds one restrained pulse (a ring in the light accent) leaves the tile and fades, and it
  settles. Nothing loops. Scrolled back above the last word, it steps away and arrives again when the
  phrase completes. With reduced motion (or without JavaScript) it is simply there with the phrase. The
  phrase's size is unchanged: with the tile it still fits one line from 48rem up, and on phones the tile
  closes the second line.
- **03 The activation: event-agnostic words, the same rendering.** The headline is kept. The paragraph
  now reads "Before the doors open, I negotiate sponsorships and pricing, coordinate with event hosts,
  source and price merchandise, and work with design on screen animations and physical assets. I plan
  how those pieces come together on site and how the activation continues through content and
  distribution afterward." (it names no one event; the Sui Summit story lives in the deck's live
  presentation chapter), and the caption beneath the rendering "Concept rendering combining the
  activation elements I plan and coordinate across events." The rendering itself, its loops and its
  behavior are unchanged. On large desktops it is about 8% narrower than the content at its widest (a
  cap of 79.5rem, centered, from the content's 86.5rem), and the copy row sits about 12% closer to it
  (the gap clamp(2.2rem, 4.4vw, 3.5rem), from clamp(2.5rem, 5vw, 4rem)); it is always whole, nothing of
  it cropped, and below about 1,400px wide it spans the content as before.
- **04 The Expanding Production Deck** (`EvDeck.astro`, `deck` in `events.json`), deployed from the
  V1.2 review checkpoint as approved, in place of three sections: Command the room (the Sui Summit
  session), From setup to final output (the production room) and Sui Fest. Three chapters, LIVE
  PRESENTATION, PRODUCTION ROOM and EVENT FILM, on the dark ground of the screens. Every chapter's rail
  is always visible and only one chapter is open at a time (the live presentation to begin with); a
  click or a tap on a rail opens its chapter, and nothing advances by itself. Each rail is a button in a
  heading (its number and label, announced as expanded or collapsed, controlling its chapter's region):
  Tab reaches it, Enter or Space opens it, the arrow keys, Home and End move between the rails, and the
  rails and the watch buttons show a strong focus ring. An open chapter holds its headline, one line of
  context, three things John did, the outcome, one credit line, and its media at about 43% of the width:
  a muted preview, the approved Select Work loop for that work (the presentation's opening, 11 s, shown
  whole; the slippage explainer, 9.7 s; the Sui Fest interview, 12 s), which plays only while its
  chapter is open and well in view, never for reduced motion or a data-saving preference, with its own
  pause control; and "Watch full video with sound" (with the film's length), which sets the preview
  aside and plays the full film in place, with its sound and its controls (the presentation, 1:15;
  Slippage Explained, 1:37; the Sui Fest film, 3:31; one sound at a time, as everywhere on the page).
  Closing a chapter stops whatever plays in it; a film keeps its place. The words are the checkpoint's
  (the live presentation's outcome is the brief's line, "Event-led relationships contribute to ongoing
  conversations and integrations with key partners.").
  - **Wide** (the deck 68rem or more, from about 1,200px wide): the chapters side by side, the closed ones
    narrowed to their 3.75rem rails, labeled vertically from the foot; the open chapter's width eases
    over 0.55 seconds, its content fixed at the open width so it is revealed rather than reflowed, and
    the deck keeps the height of its longest chapter, so nothing below it moves. **Narrow**: a vertical
    accordion; a chapter that closes above the one being opened can carry it up out of view, so once it
    has, the opened chapter's rail is brought back into view below the header. **Reduced motion**: a
    chapter changes through a short fade (0.2 s), with no change of width or height in motion and no
    scroll pinning. **Without JavaScript**: all three chapters open, one after another, each with its
    film's native controls and no preview.
  - **Credits**: one credit line per chapter (the consolidated blocks went with the sections): the live
    presentation (John Cowin, speaker Max McKendry, deck design Bob van der Meer), the production room
    (John Cowin, on camera Max McKendry, final edit Bob van der Meer) and the event film (John Cowin,
    with the participating teams).
  - **To review live, not solved here** (as the brief asks): the supporting video may need to be
    larger, and the production room should recover the contrast between the behind-the-scenes setup
    photograph and the finished explainer. For that next revision the setup photograph
    (`ev-image-production-setup`, `src/assets/events-video/sui-summit-bts.jpg`), its caption and the
    finished explainer (`ev-video-slippage-full` and its poster, also the production room's full film
    here) all stay in the project; `setupFinal` in `events.json` names them, and the Setup and Final
    comparison as it was built is in the repository's history at 44b1e42 (`EvSetup.astro`). The
    session's, the production room's and Sui Fest's other words, their pending slots and the three Sui
    Fest stills stay in the manifest or the history, off the page. The replaced components (EvRoom,
    EvSetup, EvSuiFest, and EvCue, EvExtras and EvCredits, which only they used) are deleted.
- **Contact, across the site**: the headline is kept and the subline now reads "If you need someone who
  can bring clarity from positioning through execution, let's talk." on the homepage and every case
  study (`contact.copy` in `src/data/home.json`).
- **Checks** (`verify.mjs`, the Events block updated for V1.3): the page's order with the deck fourth
  and none of the three replaced sections, tallies or credit blocks; the signal (one, immediately after
  AMPLIFY. on its line and never split from it; not a button; Option A's point and two pairs of arcs
  and nothing else; a solid tile in the accent with the glyph in outline weight; about the capitals'
  height; called only once the last word is in, the tile waiting a moment after it; one pulse that
  ends transparent, and nothing in the transition repeating; hidden states only with motion allowed),
  with the transition otherwise only its phrase; the activation's new paragraph and caption, no event
  or booth named, the rendering about 8% narrower than the content on large desktops and centered, the
  copy row 10 to 15% closer; the deck's three chapters in order, the first open, each rail a labeled
  button controlling its region, the checkpoint's words, a muted preview of 8 to 15 seconds, the full
  film waiting behind it, "Watch full video with sound", nothing autoplayed; side by side on wide
  screens and an accordion on narrow ones, all open without JavaScript, a short fade with reduced
  motion; the script's one-at-a-time opening, keyboard and watch, and nothing advancing by itself;
  strong focus rings; the setup photograph, its caption and the finished explainer kept; the credit
  lines and no invented titles; three films with sound, one per chapter; and the new Contact subline on
  every page. Each new check was shown to catch what it guards: on a scratch copy of the repository, 53
  deliberate breaks (the signal in place of the word or wrapping alone, a button, a different symbol, an
  outline tile, a looping pulse, the old paragraph or caption, the rendering at full width, two chapters
  open, a deck that advances itself, no focus ring, morphing with reduced motion, the setup photograph
  removed, the old Contact subline, an em dash, and so on), one at a time, each failed the check meant
  for it.
- **Verified** in the browser: no horizontal overflow from 320 to 2,560px wide; the deck side by side
  from about 1,200px (the media 379 to 469px wide at 1,280 to 2,560px) and an accordion below; the watch button on one line down
  to 320px; a behavior run of 43 checks (the reel as in V1.2; the signal waiting for the last word,
  arriving after it, pulsing once, settling beside AMPLIFY. and stepping away when scrolled back; the
  activation's screens; the deck's rails, one open chapter, its preview, a click, the arrow keys, Enter,
  Home and End, the focus ring, Watch playing the film with sound and focus moving to its controls,
  another chapter stopping it, and nothing advancing in twelve seconds; the way on; the new Contact
  subline; no page errors; with reduced motion the static signal, the fade without morphing and the
  previews on their posters; on a phone the accordion keeping the opened chapter in view with its
  preview playing; the desktop proportions); without JavaScript (all three chapters open with native
  controls); and with the full check and the accessibility scan.

## Events and Multimedia Production, Version 1.2

John's Events and Multimedia Production V1.2 Draft Brief (October 14, 2026, on the live page after
Version 1.1): again a delta, not a rebuild. It implements only the changes the brief locks, and
everything else stays as Version 1.1 left it (the sections below describe the page as it was; where they
differ, this section is the current one). Three directions the brief proposes wait for John's
confirmation and are not built: the custom signal icon after AMPLIFY., the Expanding Production Deck
(LIVE PRESENTATION, PRODUCTION ROOM, EVENT FILM) and the shortened copy inside its chapters; until then
04, 05 and 06 stay as they were. The hero's new composition is built, as the brief asks, as a trial to
be judged in the deployed preview. The page now runs: 01 Hero, 02 the transition, 03 Build the
activation, 04 Command the room, 05 From setup to final output, 06 Sui Fest, 07 the conclusion (with
the way on to the next case study), Contact.

- **01 Hero: one editorial reel.** The kicker, the headline, the paragraph, the tally light and the
  palette are as they were. V1.1's three programs and their control (Q01 LIVE, Q02 CONVERSATIONS, Q03
  PRODUCED, with their buttons) are gone; in their place one reel plays its chapters in a fixed order,
  each played through once and crossfaded (350ms) into the next, and after the last it begins again.
  The label at the frame's top left reads the chapter's number and title in capitals, "01 / LIVE
  PRESENTATION", and stays the same through every cut inside the chapter; nowhere in the hero is there
  a file name, an event, a place, a date or a subline. The production accents stay: the corner
  brackets outside the frame, the label, the running timecode at the top right (the reel's own clock,
  carried through the chapters), a small pause control beside it (the reel's only control: no next,
  previous or category buttons), and one small segmented progress rail along the frame's bottom edge,
  a segment to a chapter, filling in the accent as its chapter plays, with no words beneath it (a faint
  shade along that edge keeps it legible on any picture). Only the chapter on air plays, muted; the
  next starts to load three seconds before the end. The reel pauses off screen and in a hidden tab;
  with reduced motion, a data-saving preference or a refused autoplay it rests on the first chapter's
  poster with an explicit "Play reel" control at the middle of the frame (played on request, it runs as
  usual and the control becomes its pause); without JavaScript, the first chapter with its native
  controls and none of the readings.
- **The chapters**, in this order (`hero.chapters` in `events.json`; `public/media/`, cut from the
  masters in the Portfolio folder, which stay outside the repository; 23.976 fps, H.264 High with its
  index first, no audio). A chapter appears only once its video is approved and present, and the
  chapters are numbered among those, so until the team interview arrives the reel runs four chapters and
  the explainer and the event film carry 03 and 04, with no gap, placeholder or "coming soon":

  | Label | File | Cut from | Length | Size |
  | --- | --- | --- | --- | --- |
  | 01 / LIVE PRESENTATION | `ev-hero-presentation.mp4`, 1600x742 (the recording's own 2.157:1) | Max Presentation, three passages joined by two restrained dissolves of 0.334 s (8 frames), with no title card or black: A, 0:00 to 0:04.2 (the opening, "I'm Max, I am one of the core contributors to Bolt"); B, 6:03.154 to 6:05.78 ("which are the pools that are actually sitting on chain."); C, 20:16 to 20:20 ("It's a fairly simple integration. Primarily we've seen people") | 10.2 s | 1.1 MB |
  | 02 / CREATOR PODCAST | `ev-hero-podcast.mp4`, 1600x900 | Jungle Talk 0:00 to 0:04 only, a light denoise | 4.0 s | 2.0 MB |
  | 03 / TEAM INTERVIEW (pending) | `ev-hero-team-interview.mp4` | the Singapore team interview; its file and usable range come from John, never selected here from the full recording | | |
  | 03 / TECHNICAL EXPLAINER (04 once the interview is in) | `ev-hero-explainer.mp4`, 1600x900 | Bolt Explainers, Slippage 0:15.18 to 0:24 | 8.8 s | 1.2 MB |
  | 04 / EVENT FILM (05 once the interview is in) | `ev-hero-event-film.mp4`, 1600x900 | Sui Fest, back to back with clean cuts: the opening 0:03 to 0:06; the B-roll 0:07.007 to 0:10.877 (on the montage's own cuts inside 0:07 to 0:11); the interview 2:36.32 to 2:40 (in on the cut that opens it) | 10.6 s | 3.4 MB |

  The cue points were found in the source audio (word timings from a speech-recognition pass and the
  audio's own onsets) and checked against the burned-in captions. Passage B ends before its caption
  clears. Passage C keeps to its range, which ends on "Primarily we've seen people": the sentence's last
  words, "use our TypeScript SDK.", run from 20:20.05 to about 20:21.0, just past it. The explainer
  begins on the first frame of the spoken "One is related to just" (the voice begins at 0:15.20; the
  caption and the wide shot arrive earlier, at 0:15.06), frame 364 at 0:15.182, so the phrase before it,
  "There's a few different components that can cause slippage", is left out; it ends on the approved
  0:24. Food Talk is not used anywhere: the range once logged as Jungle Talk 12:48 to 12:52 belonged to
  it, and it left with V1.1's Q02. Posters are each chapter's first frame (the presentation's at
  0:00.2, its title slide). To add the team interview, cut its approved range to
  `public/media/ev-hero-team-interview.mp4` with a poster, and approve its entry in `assets.json`
  (with its duration, poster and source): the reel places it third and renumbers to five chapters with no
  other change. V1.1's reels (`ev-hero-live.mp4`, `ev-hero-conversations.mp4`, `ev-hero-produced.mp4`)
  and their posters are gone.
- **The hero's composition, an implementation trial.** The kicker above; one header row with the
  headline at the left (63 parts of the width) and the paragraph at the right (33 parts, 4% apart), set
  against the headline's lower lines (its last line on the headline's last line, never taller than the
  headline); then the reel beneath, the content's full width, in a wide cinematic frame of 2.2:1. On
  shorter wide screens, which is most laptops (960px tall or less and wider than 3:2), the frame widens
  a little, to 2.4:1, still full width, and the header tightens (less room above the kicker and between
  the rows, the headline at 7.6% of the screen's height and never under 3.75rem), so the whole reel, its
  rail included, stays within the first screen. Each chapter sets its own crop of the frame (`pos`),
  chosen so the burned-in captions stay whole and clear of the rail and heads stay in at both
  proportions (the presentation 50% 92%, the podcast 50% 75%, the explainer 50% 62%, the event film 50%
  83%). Under 60rem the kicker, the headline, the paragraph and the reel simply stack; under 40rem the
  frame is 16:9, and the presentation, whose own frame is wider, shows whole, letterboxed and set a
  little low, so the label rides on the band above the picture and the rail on the band beneath its
  captions; under 24rem the timecode steps aside (the label and the control stay).
- **03 The activation.** The section's eyebrow (the stages Secure and Build) is gone; the other sections
  keep their tallies. The paragraph's first sentence now reads "Bolt Liquidity sponsored the Sui Summit
  side event at ETHDenver in 2025 and 2026."; the rest is as it was. The television now plays only the
  charger card: `TV Loop.mp4` 0:29.20 to 0:34.90 (`ev-activation-tv.mp4`, 960x540, 5.8 s, 0.27 MB),
  from the first frame of the yellow ground as "Want a wireless Bolt charger?" animates into view,
  through the three steps appearing (complete at 0:33.9), to about a second's hold on the completed card,
  muted, with nothing added. It restarts with a plain cut: the card's last frame and the loop's first are
  the same yellow, so the restrained fade the brief allows was not needed. The brief's 0:30 to 0:36 moved
  0.8 s earlier, because at 0:30 the headline has already finished arriving and 0:36 would hold the card
  for two seconds. Its poster is 0:34.5, the completed card; the render's still and the light it throws
  on the room were remade from the new loop. The projection keeps `Big Screen Loop.mp4` 0:07 to 0:15; its
  soft edge is a third narrower (the mask's feather 0.093 of the frame, from V1.1's 0.14), keeping its
  softness, its light on the room and the wall's texture, never hard-edged, and it stays lower in
  luminance than the television (in the still the wall's surface averages 0.20 and the television's
  0.75, written to `ev-activation.json` as `surface`; the projection's strength is still 0.34).
- **07 The conclusion, with Amplify folded in.** The standalone Amplify section ("Every event opens a
  longer conversation.", its paragraph, its five-step trail, its outcome line, its pending slots and its
  credit block) is gone, with `EvAfter.astro` and its two pending manifest entries (a named integration
  and partner logos, never published). The conclusion keeps its centered composition, its generous
  negative space and its ground, black turning to exactly the Contact green: the static row of square
  markers, SECURE · BUILD · CAPTURE · CUT · AMPLIFY, all lit, a quiet callback never animated a second
  time; "The room clears. The work keeps moving." (the second sentence in the accent); then "An event is
  only the starting point. I turn live moments into content, extend their reach through partner and
  ecosystem distribution, and carry that momentum into strategic relationships and new opportunities."
  No evidence rail, metrics, cards or line-and-node sequence, and no partner or integration named. Then
  the way on to the next case study, and Contact rises out of its lower part as before. The page now has
  two credit blocks: the Sui Summit work at ETHDenver, closing the production room, and Sui Fest.
- **The way on to the next case study, on both case studies** (`src/components/NextCase.astro`): one
  wide container, about as wide as the conclusion's paragraph (46rem here, 53rem on Technical Product
  Marketing), bordered and gently rounded (14px, not a pill), the whole of it the link, with generous
  room above it; the sentence at the left and the arrow in a small circle (2.5rem) at the right. On hover
  or keyboard focus a light accent wash comes in and the arrow moves 4px to the right; keyboard focus
  adds a strong 2px ring; with reduced motion the arrow stays put. It is a navigation landmark named
  "Next case study"; the sentence names where it leads, and the arrow is hidden from assistive
  technology. Here: "Next, see how I build creator partnerships into campaigns designed to travel."
  (Creator Campaigns: the collection wraps around, and the build stops if `conclusion.next` is missing
  or out of order). On Technical Product Marketing the sentence it already had, "Next, see how I bring
  events and multimedia production from concept through execution.", moved from a linked line of text
  into the same container; nothing else on that page changed.
- **Kept as they were**: the transition (the phrase itself is locked; the proposed icon after AMPLIFY. is
  not built), the Sui Summit session, the production room, Sui Fest and Contact. The brief's treatment
  reference for the icon is kept with the project, outside Git, as
  `reference/events-video/amplify-icon-treatment.png`; nothing on the site points at a desktop file.
- **Checks** (`verify.mjs`, the Events block updated for V1.2): the page's order with the conclusion
  last before Contact; the hero's words; no LIVE, CONVERSATIONS or PRODUCED control and no Q cues; one
  button in the hero, the labeled pause control; `events.json` ordering the five chapters; the chapters
  shown being exactly the approved and present ones, numbered in order (four, with these labels, while
  the interview is pending; five, the interview third, once it is in), and no placeholder, "TBD" or
  "coming soon"; the label reading the first chapter in capitals; no file, event, place or date name in
  the hero's readings, chapter titles or descriptions; one muted, inline, unlooped video per chapter
  with a poster that loads nothing early, each an approved chapter of 3 to 15 seconds; Food Talk
  nowhere; the presentation's three passages and their 0.334 s dissolves; the explainer's first frame on
  "One is related to just", found in the source audio, and its approved end; the 2.2:1 frame (16:9 on
  narrow screens, and only a little wider, 2.3 to 2.45:1, on shorter wide screens), the presentation
  whole on narrow screens, each chapter's own crop, a 300 to 400ms crossfade and one chapter on at a
  time; the brackets, the label and the timecode; one segmented rail, a segment to a chapter, with no
  words, and no text beneath the reel; the explicit Play control while the reel waits; the trial's
  order and proportions (the headline 60 to 65%, the paragraph 30 to 35%, set to the headline's lower
  lines, a simple stack on narrow screens); the activation without its eyebrow, the sponsorship
  attributed to Bolt Liquidity, the television on the charger card (5 to 7 seconds), the projection
  below the television's luminance and its feather a third narrower; the Amplify section and its
  component gone; the conclusion's copy, its static row of the five stages (hidden from assistive
  technology, never animated or revealed) and nothing else in it; on both case studies the one way on,
  to the next case study in order, its sentence word for word, its shape (bordered, gently rounded,
  the sentence left, the arrow in a circle), its hover and focus (a light wash, a small arrow movement,
  a strong ring, the arrow still with reduced motion), its landmark and its width about the paragraph's;
  two credit blocks; and V1.1's reels gone. Each of these was shown to catch what it guards: on a
  scratch copy of the repository, 70 deliberate breaks (a category control back, a chapter out of order,
  a pending chapter counted, a file name in the label, the explainer starting early, a pill or an
  unfocusable way on, the Amplify section or a V1.1 reel left behind, and so on), one at a time, each
  failed the check meant for it or stopped the build.
- **Verified** in the browser: the whole reel within the first screen at 2560x1440, 2560x1310,
  1920x1080, 1920x950, 1728x990, 1680x1050, 1600x900, 1536x864, 1512x857, 1470x830, 1440x900,
  1366x768, 1280x800, 1180x820, 1024x768, 768x1024, 390x844 and 320x640 (at 1440x790 only the lower crop
  marks fall just below it; in the shortest laptop windows, 1536x730 and 1366x657, the reel's lower edge
  runs below the first screen), with no horizontal overflow at any of them; every chapter's captions
  whole and clear of the rail at 2.2:1, 2.4:1 and on a phone; with reduced motion and without
  JavaScript; in a behavior run of 29 checks (the four chapters in order, each crossfading into the next
  with its label, the rail filling and the earlier segments full, the timecode carrying on, the reel
  beginning again after the last, the pause control, pausing off screen and resuming, the activation's
  screens playing in view, the television's loop under six seconds and looping, Sui Fest's silent play,
  the way on's target, width and focus ring, no page errors, the waiting state and play on request with
  reduced motion, the phone's 16:9 frame with the presentation whole, and the desktop's proportions);
  and with the full check and the accessibility scan.

## Events and Multimedia Production, Version 1.1

John's Events and Multimedia Production V1.1 Delta Brief (October 14, 2026, on the live page of that
day): a delta, not a rebuild. It changes only what the brief lists, and everything else on the page
stays as Version 1.0 left it (the next section describes the page as it was; where the two differ, this
section is the current one). The page now runs: 01 Hero, 02 the transition, 03 Build the activation,
04 Command the room, 05 From setup to final output, 06 Sui Fest, 07 What continued after, 08 the
conclusion, Contact.

- **01 Hero: the program system.** The kicker, the headline, the paragraph, the corner framing, the
  timecode at the upper right, the tally light and the palette are as they were. The three sources
  became three reels, each cut from the brief's ranges: **Q01 LIVE** (presentations and event
  environments), **Q02 CONVERSATIONS** (interviews, podcasts and exchanges) and **Q03 PRODUCED**
  (polished explainers and finished multimedia). The control under the monitor shows only "Q01 —
  LIVE", "Q02 — CONVERSATIONS" and "Q03 — PRODUCED" (the dash is a drawn rule, so the site's text
  keeps its no-em-dash rule): no event, project, date, place or source names and no sublines; what
  each reel holds is part of its button's name for assistive technology only. On wide screens the
  control is one compact row of three equal cells beneath the monitor (the paragraph alone in the
  right-hand column); under 40rem it stacks into three compact rows. The active cell carries the thin
  teal progress line and the others stay muted gray; the monitor's own reading says "Q01 — LIVE" and
  so on. Q01 is on first. A reel plays through once and the program crossfades (350ms: the incoming
  reel fades in over the outgoing one, which pauses once it is covered) to the next, round and round; a
  reel the reader picks starts from its beginning, plays through, and then the program carries on from
  it. Only the reel on air plays (muted); the next one starts loading three seconds before its end. It
  pauses off screen and in a hidden tab, never starts for reduced motion or a data-saving preference
  (posters only; a pick changes the poster, and the pause control plays it on request), and without
  JavaScript shows Q01 with its native controls and no control row.
- **The reels** (`public/media/`, from the masters in the Portfolio folder, which stay outside the
  repository; 1600x900, 23.976 fps, H.264 High with its index first, no audio; ranges as the brief set
  them, with in and out points moved only inside a range, and only to a cut):

  | Reel | File | Cut from | Length | Size |
  | --- | --- | --- | --- | --- |
  | Q01 LIVE | `ev-hero-live.mp4` | Max Presentation 0:00 to 0:04, a 0.4 s dissolve into 6:03 to 6:07 (both letterboxed into 16:9); a cut to Sui Fest 0:07.007 to 0:10.886 (the montage's own cuts inside 0:07 to 0:11) | 11.6 s | 2.2 MB |
  | Q02 CONVERSATIONS | `ev-hero-conversations.mp4` | Jungle Talk 0:00 to 0:04; Sui Fest 2:36.32 to 2:40 (from the cut that opens the interview); Food Talk 12:48 to 12:52 (see below); clean cuts, a light denoise | 11.7 s | 3.6 MB |
  | Q03 PRODUCED | `ev-hero-produced.mp4` | Bolt Explainers, Slippage 0:13 to 0:24; a cut to Sui Fest 0:03 to 0:06 (the direct-to-camera opening) | 14.0 s | 2.5 MB |

  The brief names Jungle Talk for Creator Podcast 02 at 12:48 to 12:52, but `Jungle Talk.mp4` runs 34.7
  seconds; that range was taken from `Food Talk.mp4` (25:50, added to the Portfolio folder the same
  day, a different composition at a hawker center table), pending John's confirmation. The Singapore
  team interview's slot in Q02 stays open and unshown until its footage is approved (a file with that
  name sits on the Desktop, unused). Sui Fest appears in all three reels in a different role each time
  (B-roll, an interview, the polished opening), as the brief intends. Posters are each reel's first
  frame; the Version 1.0 sources `ev-hero-present.mp4` and `ev-hero-engage.mp4` are gone.
- **02 The transition** (dark, `EvTransition.astro`, replacing the run of show, whose headline, copy,
  line, nodes and layout are gone): the phrase "SECURE. BUILD. CAPTURE. CUT. AMPLIFY." on the hero's
  dark ground, one centered line from 48rem (two deliberate lines on smaller screens, after CAPTURE.).
  As the reader leaves the hero the phrase settles at the middle of the screen and holds there
  (sticky) while its words arrive one after another, each with a short wipe and fade, over 0.7 of a
  screen of scrolling (the first just before the phrase settles at the middle, the last 0.7 of a
  screen later); the words already there stay, nothing else moves. A short hold to read it (about a
  quarter of a screen), then the section moves on and the phrase fades as it rises out, straight into
  "The work starts before anyone enters the room." No icons, lines, nodes, definitions, chapter
  numbers or paragraphs, no cursor and no tunnel. Reduced motion shows the whole phrase in a calm band
  (no pinned scroll) and the same fade on leaving; without JavaScript, the whole phrase. The sections'
  tallies and the conclusion's row of cues read the same five stages from `events.json`.
- **03 The activation: an original 3D render.** The headline and paragraph are as they were (side by
  side on wide screens); the flat schematic, its numbered pins and its six-line legend gave way to one
  2:1 render, full width, captioned "A representative rendering of the activation, made for this
  page.": a dark exhibition room after the reference's layout and light, with a large projection on
  the wall at left (where the reference's figure stands), the booth at the center (a wood-slat
  counter, a white panel with the television, a dark fascia lit with the Bolt Liquidity wordmark from
  its own SVG, proportions untouched), two neat stacks of black hoodies (the top one angled to show the
  mark, subtly) and a small charger on the counter, clear of the screen, and a restrained conversation
  area at right (two upholstered bar chairs at a round table on a rounded carpet); colored wall washers
  and a warm line of light under the counter. No standalone banner (the projection takes its place),
  no person, no vendor text, labels, crop marks or slide furniture, no hotspots and nothing that follows
  the pointer. The reference (`reference/events-video/booth-render.png`, a vendor's slide) and the
  wordmark's source SVG stay in the project folder, out of Git (`.gitignore`) and out of the site.
  - **How it is made.** `scripts/render/activation-booth.py` builds the scene in Blender 5.2 (Cycles,
    as a Python module) from code and renders four passes: the room with both screens dark (the
    plate, 2560x1280, 96 samples, denoised), the television's light alone, the projection's light
    alone (an emitter over its rectangle the camera never sees) and the wall alone, evenly lit (for the
    projection's mask); it writes each screen's corners in the frame. `activation-composite.py` turns
    them into the page's layers in `src/assets/events-video/activation/` (the plate, the two spills, the
    wall's mask: its texture, a soft edge 14% of the frame wide, and nothing where the booth stands in
    front of it) and the static render, both screens on their poster frames, composed exactly as CSS
    composes them; it also writes `src/data/ev-activation.json` (the corners, the layer strengths and the
    loops' brightness over time).
  - **The screens.** The television plays `TV Loop.mp4` 0:06 to 0:40 (`ev-activation-tv.mp4`, 960x540,
    33.6 s, 0.95 MB); the opening timestamp was kept (the alternative 0:11 start would have cut from the
    yellow closing card to a dark frame), and its restart is a restrained 0.5 s crossfade from the
    closing card into the opening, baked into the file, because a plain cut flashed dark between two
    yellow frames. The projected wall plays `Big Screen Loop.mp4` 0:07 to 0:15 (`ev-activation-wall.mp4`,
    960x640, 7.5 s, 0.27 MB), restarting at 0:07 through the same restrained seam. Posters: the TV at
    0:07.4 (the Zero Slippage card), the wall at 0:14.2 (the coins). The television is the primary,
    bright and legible surface; the projection is screened onto the wall through its mask at 0.34
    opacity (about a third of the television's intensity), its texture showing through. The light each
    screen throws on the room (`mix-blend-mode: screen` layers rendered from the scene) rises and falls
    with what it shows, from the loops' brightness measured when the render was made, so nothing reads
    from the video while it plays.
  - **Playback** (`src/lib/ev-stage.ts`): from 48rem wide, with motion allowed and no data-saving
    preference, the live layers load when the frame comes within about half a screen, each video is
    mapped onto its corners in the render with a perspective transform (`matrix3d`, recomputed when the
    frame resizes), and the layers fade in over the still render, the same composition. Both loops play
    muted and inline only while the frame is well in view (40%; they pause under 15% or in a hidden
    tab), with one pause control at the frame's lower right. Reduced motion, a data-saving preference,
    a phone-width screen or no JavaScript keep the still render (both screens on their posters) and load
    nothing else.
- **05 The production room.** The Setup and Final comparison is as it was. The photograph's five
  numbered marks, their leaders and the legend are gone; one caption sits beneath it: "Two cameras, two
  tripods, a clip-on mic, a laptop, and the venue's existing lighting." Only one finished video remains,
  Slippage Explained; Bolt vs AMM and its file are gone. The section closes with the one consolidated
  credit block for the Sui Summit work at ETHDenver.
- **06 Sui Fest.** The story paragraph (why the piece was made and how it placed Bolt) is as it was. The
  chapter list of teams and its timestamps are gone, with no list in their place; the video runs at
  the full measure, muted by default: while it is well in view, with motion allowed, it plays silently
  (captions burned in) with a clear "Sound on" and its own pause, and "Sound on" hands it to the reader,
  from where it is, with sound and the full controls (reduced motion or saving data: its poster and
  "Play with sound"). Three stills, each a different idea (the interviewer at a team's booth, Bolt as
  one voice among many, the color of the floor), without timecodes. The line-and-node path is gone; how
  it traveled and what it did are one compact block, in the brief's qualitative words: "Tens of
  thousands of impressions. Hundreds of likes." and "Published with every team tagged and then shared by
  the teams themselves, it drew engagement from ecosystem teams and developers." The FlowX still left
  the page and the manifest.
- **Credits and density.** One consolidated credit block per major chapter, never one per media item:
  the Sui Summit work at ETHDenver (the activation, the session and the production room: John Cowin's
  sponsorship negotiation and pricing, logistics, merchandise sourcing, production planning, the speaking
  slot, session strategy, deck direction, live production, the production room and equipment, interview
  questions, direction, camera capture, footage review, transcript-based edit briefs and distribution;
  Phi Labs design, the screen animations and table assets; Bob van der Meer, deck design, final video
  editing and visual production; Max McKendry, speaker and on-camera subject), labeled "Credits · Sui
  Summit at ETHDenver" at the end of the production room; Sui Fest; and what continued after. The
  activation and the session no longer carry their own. Section gaps grew where material left; nothing
  decorative took its place, and the run of show's line motif is not reused.
- **Kept for later review**: the Sui Summit presentation section (its chapters, line and outcome), the
  relationship and longer-term outcome material, the conclusion and its copy, and Contact.
- **Checks** (`verify.mjs`, the Events block rewritten for V1.1): the page's order with the transition
  second; the hero's words; the control showing only Q01 LIVE, Q02 CONVERSATIONS and Q03 PRODUCED, in one
  named group beneath the monitor, one row of equal cells (three rows on a narrow screen), the teal
  progress line on the active cell only, no sublines, and no event, project, date, place, file or source
  name in the control or in the reels' descriptions; Q01 the default; three muted, inline, unlooped
  videos with posters that load nothing early, each reel an approved 16:9 file of 10 to 15 seconds; a 300
  to 400ms crossfade; the corner framing, the reading, the timecode and the pause control; no Singapore
  placeholder; the run of show gone; the transition's phrase (and its words), its dark ground, two lines
  on small screens and one centered line where it fits, its pinned hold of about 1.6 to 2 screens, its
  words arriving only with motion allowed over 0.6 to 0.8 of a screen (the first at its start, the last
  at its end) and a short hold after the last (0.1 to 0.4 of a screen), and nothing else in it; the
  activation's paragraph, no schematic, one described 2:1 render with its caption, two muted looped
  screens on their approved loops, live layers hidden until needed, one pause control, the projection
  screened through its mask at a quarter to two fifths of the television's intensity, the corners and
  brightness data, the render's sources in the repository and its reference kept out of Git, neither in
  the build; the room kept as it was; the production room's comparison, no marks, the caption word for
  word, one explainer; Sui Fest's story, no teams list or timestamps or path, at most three stills, the
  one outcome block, and the muted video with "Sound on" and its pause; three credit blocks, the first
  for the Sui Summit work at ETHDenver closing the production room, with every role kept; three players
  with sound; the retired files gone; and the scripts' guards (the program's end of reel, the stage's
  transform and its 48rem gate, "Sound on", one sound at a time).
- **Verified** at 1440x900, 1920x1080, 1366x768, 1280x800, 1024x768, 768x1024, 390x844 and 320x640
  (no horizontal overflow; the hero and its control within the first screen on every desktop size),
  with reduced motion and without JavaScript, in a behavior run (the reels advancing, a picked reel
  playing through and the program carrying on, the pause control, pausing off screen, the activation's
  screens playing in view and holding on pause, Sui Fest's silent play and "Sound on") and with the full
  check and the accessibility scan.

## Events and Multimedia Production, Version 1.0

John's Combined Build Brief (October 14, 2026), Part Two: the first full build of the third and final
case study, on its own page. The page is `src/pages/work/events-video.astro` with
`src/components/events/` (EvHero, EvRun, EvActivation, EvRoom, EvSetup, EvSuiFest, EvAfter and
EvConclusion; EvCue, a section's tally; EvCredits, the credits under each piece of work; EvPlayer,
the player for a video with sound; EvSlot, a media slot; EvExtras, a section's slots still to come),
its words and media configuration in `src/data/events.json`, its media in `assets.json`, and its
behavior in `src/lib/ev-media.ts` (the program, the players, silent loops and the reveals) with
`src/lib/ev-copy.ts` (its time labels); `src/pages/work/[slug].astro` no longer builds this case
study. It keeps the portfolio's type, palette, navigation, buttons, radii and Contact, and shares no
component with the Technical Product Marketing page: its structure and motion are its own. The
production layer is restrained: a tally of five small squares above each headline (the stages of the
run of show, the ones the section covers lit), cue readings, a running timecode, crop marks at the
corners of frames, progress lines and frame numbers on stills; no imitation editing interface and no
glitching. The ground cuts between the dark of the screens (the hero, the run of show, the room, Sui
Fest) and the warm light of the planning (the activation, the production room, what continued after),
and at the end cuts to black and turns into the Contact green.

- **01 Hero** (dark): the kicker "03 / Events and Multimedia Production" and the headline "From live
  experience to lasting momentum." ("lasting momentum." in the accent) across the top like a title
  card; below, one dominant program monitor (16:9, 8fr of the width) beside the paragraph and three
  restrained cues (4fr): 01 PRESENT (the Sui Summit session), 02 PRODUCE (the production room, the
  default) and 03 ENGAGE (Sui Fest), each with a line saying where it was shot and a progress line
  that fills as its source plays. On the monitor: a cue reading ("Cue 02 · Produce") with a tally
  light that glows slowly while the program plays, a running timecode (hours, minutes, seconds and
  frames at 24), a pause control and crop marks. A full screen tall on wide screens; phones and
  tablets stack the title, the monitor, the paragraph and the cues.
- **The program** (`Program` in `ev-media.ts`): only one source is loaded and playing at a time,
  muted and inline. It plays through once and the program cuts to the next, like a live switcher (a
  180ms dissolve, nothing more), until the reader picks a source, which then loops and holds; the next
  source starts loading three seconds before its cut. The program pauses when less than 15% of the
  monitor is in view and resumes once 35% is, pauses with a hidden tab, and never starts for reduced
  motion or a data-saving preference (the poster stays, and its control plays it on request). The
  cues are one named group of buttons with `aria-pressed`, the same for keyboard, touch and mouse;
  nothing depends on hover. Without JavaScript each source keeps its poster and native controls. A
  source whose video is not approved has no cue in a production build (a labeled placeholder in
  development), so the program never cuts to an empty monitor.
- **02 Run of show** (dark): "Run of show" and "The event is only the middle of the work.", then the
  page's table of contents and thesis on one timeline: Secure, Build, Capture, Cut and Amplify, each
  with its line from the brief and a link to the section that shows it, under three spans, Before the
  event, In the room and After the room clears. No cards: a ruler with ticks, five cue marks and type.
  As the timeline crosses the screen a line of light runs along the ruler with the scroll, and each
  stage arrives as the line reaches it: its mark lights, and its words brighten from the muted ink
  (which stays readable, above 4.5:1) and settle 6px. Once complete it stays complete. Wide screens
  read it left to right, narrow ones top to bottom; reduced motion and no JavaScript show every stage
  at once.
- **03 Build the activation** (light; Secure and Build): "The work starts before anyone enters the
  room.", one paragraph (Phi Labs' sponsorship of the Sui Summit side event at ETHDenver in 2025 and
  2026: the sponsorship and its pricing, the host, the merchandise, the screen animations and table
  assets made with design, and how it all reached the room), six short numbered annotations, and a
  drawing: a schematic of the activation package in elevation, numbered against the annotations,
  captioned "Schematic of the activation package, drawn for this page" and drawn in line once as it
  arrives. It is a designed visualization, never presented as documentary photography; on wide
  screens it holds beside the annotations as they pass. The activation kit (event banner, social
  flyer, merchandise designs, the screen animation, the table or booth plan, a credential or schedule,
  networking imagery) follows as one coordinated package as soon as any genuine piece is approved.
- **04 Command the room** (dark; Secure, Capture and Amplify): "Build the session. Fill the room.
  Extend its life." in three beats, the second in the accent, with one line of context (Bolt
  Liquidity's presentation at Sui Summit in 2025 and 2026, this recording from 2026), then the
  presentation as the dominant visual, at full width with sound. Then three chapters, Fill, Run and
  Extend, with the brief's points, arriving in turn along one line (0.28 seconds apart), and the
  public-safe outcome, "The presentation attracted ecosystem attention and opened conversations that
  continued beyond the event."
- **05 From setup to final output** (light; Capture and Cut): "A compact setup. A full content
  system." One paragraph (the production room booked at the venue; the DJI camera and the iPhone on two
  tripods, the clip-on microphone, the laptop, the venue's lighting and props; about 20 interview
  questions; Max McKendry directed through multiple takes; the footage review, the chosen takes and
  the edit direction for Bob van der Meer) and four beats, Prepare, Direct, Select and Brief, the last
  two set forward because they carry the editorial work. Then one frame with two labeled tabs: A,
  Setup, the behind-the-scenes photograph with five numbered points on short offset leaders (read from
  the legend beneath), and B, Final, the finished Slippage Explained with sound. The tabs follow the
  ARIA tabs pattern (arrow keys, Home and End), switching away from Final pauses it, and without
  JavaScript both views are shown, one after the other; no draggable comparison. Then a second
  finished explainer from the same session, Bolt vs AMM.
- **06 Sui Fest** (dark; Capture and Amplify): "If you cannot own the stage, create the moment
  everyone shares." One paragraph (Bolt was not a sponsor, so the moment had to be made: an interview
  concept, John as the interviewer, established teams across the ecosystem with Bolt as one voice
  among many, every team tagged and given a reason to share it). The video with sound beside the teams
  in the piece, each name a chapter that starts the video at that team's interview, with sound:
  Cetus, Bluefin, 7K DeFi, NAVI & Astros, Bolt Liquidity, FlowX Finance, DoubleUp, Claynosaurz and
  Talus. Then four stills in a strip, each with its frame number and moment; the path the piece took
  (Interview, Edit and review, Publish, Tag every team, Teams share, Ecosystem reach); and what it
  did, in the brief's words only: tens of thousands of impressions, hundreds of likes, engagement from
  ecosystem teams and developers, broader distribution through participant sharing. No feed, and no
  engagement count as the centerpiece.
- **07 What continued after the event** (light; Amplify): "Every event opens a longer conversation."
  (the brief suggested "The room clears. The relationships continue."; the page keeps "The room
  clears" for the conclusion alone, so the two headlines do not repeat each other). One paragraph,
  then a trail that leaves the room and keeps going, On site, Capture, Follow-up, Ecosystem and
  Integrations, its line running on past the edge of the frame, and the public-safe outcome:
  "Event-led relationship development contributed to subsequent conversations and integrations with
  ecosystem partners." No single event or person is credited with an integration; the Sui DEX
  aggregator integration appears by name only once its public record and wording are verified.
- **08 The conclusion** (dark): the five cue marks return in one row, all lit, as the program's last
  reading; then "The room clears. The work keeps moving." (the second sentence in the accent) and "The
  strongest events do more than fill a room. They create content, relationships, conversations, and
  opportunities that continue long after the final session ends." No next case study: this is the
  third and last, and the page runs straight into the full Contact frame and the brand footer. On
  wide screens it is a full screen tall; its ground is the same closing movement as the Technical
  Product Marketing conclusion's (black to the Contact green in the same eleven OKLab stops), and
  Contact's grid rises out of its lower part.
- **Credits** sit beneath the work they describe, never in one large section, and keep strategy,
  production direction, design, editing and on-camera roles distinct, with no titles: the activation
  (John Cowin; Phi Labs design for the screen animations and table assets), the room (John Cowin; Bob
  van der Meer, deck design; Max McKendry, speaker), the production room (John Cowin; Bob van der Meer,
  final video editing and visual production; Max McKendry, on-camera subject), Sui Fest (John Cowin;
  the participating teams) and what continued after (John Cowin). The page carries no "My role:" line.
- **Players** (`EvPlayer.astro`, `Player` in `ev-media.ts`): every video with sound sits on its poster
  with one "Play with sound" button that shows its length; nothing but the poster loads until it is
  pressed (the file's index is read once the frame is within a screen, for its length). Playing, one
  bar along the foot of the frame holds pause or play (replay at the end), a seek bar in whole seconds
  that answers to the arrow keys, the time, and mute or unmute, each labeled for screen readers.
  Starting one player pauses any other, so two never sound at once, and a player pauses when it
  leaves the screen (under a fifth in view) or the tab is hidden, then waits for the reader. Without
  JavaScript the native controls remain. Every frame holds its ratio before anything loads, so
  nothing shifts.
- **Reveals**: headlines rise once into place from behind their own edge as they arrive (0.75
  seconds, their beats 0.12 seconds apart); with reduced motion or without JavaScript they are simply
  there.
- **Media**: H.264 (High) with fast start at 23.976 fps, from the masters in the Portfolio folder,
  which stay outside the repository; sizes are decimal megabytes.

  | Slot | File | Range | Length | Size |
  | --- | --- | --- | --- | --- |
  | Hero, PRESENT | `ev-hero-present.mp4`, 1600x742, silent | Sui Summit 0:00 to 0:11 (the homepage loop's range) | 11.0 s | 0.9 MB |
  | Hero, PRODUCE | `bolt-slippage-explainer-preview.mp4`, the homepage card's preview | Slippage Explained from 1:08.25 | 9.7 s | 1.2 MB |
  | Hero, ENGAGE | `ev-hero-engage.mp4`, 1600x900, silent | Sui Fest 0:22.4 to 0:31.9 | 9.5 s | 2.1 MB |
  | 04, the room | `sui-summit-presentation-excerpt.mp4`, 1280x594, AAC | Sui Summit 0:00 to 1:15 | 75.0 s | 3.9 MB |
  | 05, Final | `bolt-slippage-explained.mp4`, 1280x720, AAC | complete | 97.5 s | 7.8 MB |
  | 05, second explainer | `bolt-vs-amm-explainer.mp4`, 1280x720, AAC | complete | 63.7 s | 5.2 MB |
  | 06, Sui Fest | `suifest-interviews.mp4`, 960x540, AAC | complete | 211.7 s | 23.6 MB |

  PRESENT keeps the recording's own wide frame, its slides beside the speaker, letterboxed into the
  16:9 monitor (`fit: contain`); ENGAGE runs from the first interview's opening cut to just before the
  guest's name card. Posters: the first frames of the two hero sources, the presentation at 0:01.92
  (the frame approved for the homepage loop), Slippage Explained at 0:04.6, Bolt vs AMM at 0:36.6 and
  Sui Fest at 0:22.8; the four Sui Fest stills are frames at 0:50.3 (7K DeFi), 1:04.0 (Bolt
  Liquidity), 1:08.1 (FlowX Finance) and 1:19.6 (Claynosaurz); the behind-the-scenes photograph is the
  supplied `sui-summit-bts.jpg`. The Sui Fest file is the largest on the site and stays under the 25 MB
  ceiling `verify.mjs` holds.
- **Placeholders still waiting for final assets** (every one at its final ratio, labeled in
  `npm run dev` only, absent from the production build until approved; see [Replacing
  placeholders](README.md#replacing-placeholders)): the activation kit, `ev-kit-banner` (3:1), `ev-kit-flyer`
  (4:5), `ev-kit-merch` (1:1), `ev-kit-screen` (16:9, a silent loop), `ev-kit-plan` (4:3),
  `ev-kit-credential` (3:4) and `ev-kit-networking` (3:2); the presentation, `ev-room-full` (the full
  recording, at the excerpt's ratio, waiting on a hosting decision: thirty minutes will not fit the
  site's 25 MB ceiling at a watchable quality), `ev-room-deck` (16:9), `ev-room-promo` (4:5) and
  `ev-room-clip` (9:16, a video with sound); the production room, `ev-setup-questions` (4:3, a question
  sheet or transcript fragment); Sui Fest, `ev-suifest-metrics` (verified figures); and the outcomes,
  `ev-after-integration` (the verified named integration) and `ev-after-logos` (4:1, public partner or
  integration logos).
- **Checks** (`verify.mjs`): the page's order (hero, run of show, activation, room, setup to final,
  Sui Fest, after, conclusion, Contact), its own hero and no "My role" line, and no Technical Product
  Marketing component; the hero on the dark ground, its kicker, headline and paragraph word for word,
  three cues PRESENT, PRODUCE and ENGAGE in one named group, PRODUCE pressed and the default (in the
  page and in `events.json`), one video per source, each muted, inline, with a poster, loading nothing
  and never autoplaying from the markup, one source on the monitor, a 16:9 monitor with its cue
  reading, timecode and pause control, and no autoplay anywhere on the page; the run of show's five
  stages and lines in order, each linking to a section that exists, a named navigation, and no faded
  text while a stage waits; the five headlines word for word, a headline of its own after the event
  that does not say "The room clears", the conclusion's copy, no link and no next case study, and the
  full Contact frame with its lead and the brand footer after it; the conclusion's ground from black to
  exactly the Contact green; the room's three chapters and their points, its outcome and the outcome
  after the event in the public-safe wording, and the presentation as the room's dominant visual;
  nothing about a pilot, contracts, diligence, data rooms, fundraising, Foundation discussions,
  YouTube or Sui Network, no named integration and no exact engagement figure except from an approved
  metric entry (and any such figure on the page has one), and Sui Fest's results in the brief's words;
  the story saying the team was not a sponsor; at least six teams, Bolt among them, each starting the
  video at their moment, in order; credits under at least five pieces of work, no collaboration-credit
  section, Bob van der Meer credited with the deck design and the final video editing, and Max
  McKendry as the speaker and the on-camera subject, without a title; at least four players, each
  loading nothing before it is asked, with a poster, native controls without JavaScript, "Play with
  sound" and labeled play or pause, mute or unmute and seek controls; every video file present and
  under 25 MB; no placeholder in the production build; any silent loop muted, looped, inline, on its
  poster, loading nothing early and carrying its own labeled pause control; the section tallies and
  the crop marks; no glitch or flicker, and looping motion only with motion allowed; and the page's
  script holding its program, source, view, tab, motion, data-saving, refusal, player, tabs, run,
  reveal and loop guards, with one video with sound at a time. Every `ev-` id in `events.json` must be
  in the manifest.
- **Verified** at 1440x900, 1280x800, 1024x768, 768x1024 and 390x844 (no horizontal overflow at any of
  them), with a mouse, touch and the keyboard, with reduced motion and without JavaScript; and, in a
  copy with every kind of pending slot approved with stand-in files (the kit's banner and screen loop,
  the deck, the extracted clip, the question sheet, the logos and both metrics), the slots appear in
  place with no overflow, the loop plays only in view and holds the reader's pause, and the full check
  and the accessibility scan still pass.
