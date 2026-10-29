# Site specification

How the homepage and its shared parts behave today, and the content guardrails `scripts/verify.mjs`
enforces. Moved from the README in Cleanup V1 (October 2026), unchanged apart from link targets and the
Contact and LinkedIn notes that Cleanup V1 itself changed. Each case-study page's specification is in
[`CHANGELOG.md`](../CHANGELOG.md) under its latest version; how to edit the site is in the
[`README`](../README.md).

## Hero photograph and layering

The homepage hero is the full frame at `src/assets/hero/john-cowin-portrait.png`, used full bleed with
its own setting rather than cut out.

`src/assets/hero/john-cowin-foreground.png` is the same frame with its background removed, layered in
front of the moving name and the rule so the subject occludes them. The two files must stay the same
pixel dimensions and carry identical `object-fit` and `object-position` rules, or the subject will not
register with the frame behind him. To change the photograph, replace both and re-derive the cutout.
The moving name loops by duplicating its own track and translating it by exactly half, so the restart
lands on identical pixels; changing the number of repeats per group keeps that true automatically.

The staged entrance (Full Site Iteration V1, reordered in V1.1 so the name is never in front of John):
after the loader the hero arrives in stages, timed from the moment the loader's ground starts to clear
(`--intro-hero`, 2.12 seconds in since V1.1; the ground dissolves over 0.4 s). 1, the photograph and
its grade settle (a 3% scale and a dimmed grade easing out over 0.7 s). 2, the portrait: the cutout is
in place above the rear layers from the first paint, fully opaque, settling with the photograph on the
same clock so the two register (it has no opacity of its own, so no frame shows it see-through). 3,
once the ground has gone, the moving name and the rule behind the portrait: the name fades in from
0.4 s and starts to move at that same moment, as the rule draws from the left from 0.44 s (0.5 s,
eased in and out). 4, the descriptor (a 6 px rise, from 0.76 s), the navigation (0.78 s) and the arrow
(0.8 s) last. Everything is complete 1.14 s after the ground starts to clear; no bounce, no blur beyond
the grade, no travel over 6 px. With reduced motion, or when the sequence does not run, the hero keeps
its simple fade.

An image still on its way occludes nothing, so the name also waits for the portrait itself (V1.1): an
inline script right after the portrait, run as the page is parsed, marks the hero `data-subject` once
the cutout has loaded and decoded, and until then the name's layer (the name and the rule behind it)
is hidden. A cached portrait is ready before the first paint, so nothing changes on an ordinary visit;
on a slow connection the name comes in with the portrait, never across John. A portrait that cannot
load keeps them hidden (the heading is still read out); without JavaScript nothing waits.

Below 75rem the subject spans the full width at the rule's height, so a rule behind him would be
invisible end to end. At those widths the same rule is drawn in front instead. This is the one place
the layering is relaxed, and it is a deliberate legibility decision. Responsive derivatives stop at the source's own 1536px width
rather than upscaling. `object-position` is set per breakpoint: tall viewports crop horizontally and
hold the face at 34% across, wide viewports crop vertically and hold the frame high. Three gradients,
not panels, carry the contrast for the name, the header, and the descriptor; their stops are tuned
against measured contrast on the photograph itself, so changing the photograph means re-measuring
them.

## Content guardrails

The verify script fails the build check if any of these appear in the output: the `@johnboycrypto`
handle, the unverified 524% Trezor lift claim, any mention of Sui Network negotiations, "17 unique
creators," invented senior titles, raw internal links, the word "client" (logo-bar organizations are
employers, products, co-sponsors, and events, not clients), em dashes (other than the hero's name
stream and the approved footer credit), a location-level impressions
figure, a published count of active workflows, or "community strategy" (John did not lead a community
function in this B2B role, so the portfolio does not imply one). (Since Version 1.6 the homepage states
no formal title; the only formal title for the Phi Labs role is still "Social Media Manager", on the
resume.) "Head of" is allowed nowhere since Creator Marketing and Partnerships V1.4 (V1.3 showed one
creator's confirmed affiliation, Raj's, in the credits; they now carry handles only). It also confirms the approved
contact, trust-bar and footer lines, and it fails if a `.DS_Store` file ships in `dist/` or is tracked
by git, or if any file in `dist/` is larger than 25 MB (the full-length explainer video never belongs on
the site). The creator page's own guardrails (no follower counts, rankings or qualifiers on the
creators, no testimonial on a card, no vague metric, nothing that implies John edited, shot or designed
the work, the hero's stock photography never presented as the trips, square and landscape media only)
are listed with the page (see [Creator Marketing and Partnerships, Version
1.0](../CHANGELOG.md#creator-marketing-and-partnerships-version-10)).

The Version 1.7 checks: the homepage order (hero, About, Select Work, the reel, the combined section,
Contact) and its four surfaces; "Select Work" and its intro; three cards in the approved order, each
with its number and category, the approved title and subline (one sentence, 95 to 130 characters, 12
to 16 words), one dominant and two supporting panels, exactly one link, and no metric (since Creator
Marketing V1.2 not even the creator stand-in's retired "Approximately 1.25M impressions", which the
guardrails now refuse anywhere, with "most-viewed"); a card loop that is muted, inline, looping, has
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
rows are keyboard reachable and (since Full Site Iteration V1) each icon turns once, 360 degrees in 450
to 650 ms with an ease-out, only on a fine pointer's arrival and only with motion allowed; Contact reads "Your product is
complex. Its story shouldn't be." (its second sentence in the accent since Full Site Iteration V1) with the approved subline (since the Events V1.3 brief: "If you need
someone who can bring clarity from positioning through execution, let's talk.") and keeps exactly the
email, resume and (since Cleanup V1) LinkedIn actions; the hero and footer descriptor is exactly "Web3 Marketing, Strategy, & Content"; and John's
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

The Technical Product Marketing checks are listed with the page (see [Technical Product Marketing,
Version 1.6](../CHANGELOG.md#technical-product-marketing-version-16)), and so are the Events checks (see [Events and
Multimedia Production, Version 1.1](../CHANGELOG.md#events-and-multimedia-production-version-11)). The Events page
also has guardrails of its own: it never mentions an unannounced pilot, contract discussions,
confidential Foundation discussions, investor diligence, data rooms or fundraising; it gives no exact
engagement figure and names no integration except from an approved, verified metric entry; and its
outcomes keep the brief's public-safe wording word for word.

The About checks: the approved headline, its three sentences each a piece of their own; three
paragraphs in the approved copy, every word in its own span, with the brief's retained wording named
("Built for DeFi.", "lead social", "a product portfolio with an audience of more than 200,000 people",
"understand and connect with."); exactly three highlights, in order ("global music project", "more than
200,000 people", "stories"), never with a background, and nothing else emphasized or bold, Phi Labs
Global included; the closing line's last three words held together, and nothing else; no individual
product named
in the narrative; the resume button on the closing row after the third paragraph; none of the earlier
About copy (the About Copy delta retired the October copy's distinctive phrases) or its music metrics
(80+ countries, 140+ shows, "professionally managed"); no em dash; the
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
- Type: the headline (About Copy delta) is three short sentences, one to a line on phones and tablets
  and one line across the canvas from 60rem, at 4.1 frame units capped at 4rem (it was 5 and 5.5rem
  before "Built for DeFi." joined the line). Paragraphs are Archivo at 440 on a 47.5em desktop measure,
  about the headline's width, with their type capped at 1.8rem, so they take two, three and two lines
  with the same breaks from about 1130px wide to 2560px (the second paragraph takes four even lines
  below that); 36em below 64rem; `text-wrap: pretty` on phones and balanced lines from 37.5rem; and the
  whole section still fits one screen from 1024x768 to 2560x1440;
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
  landscape video at the card's full media width (Full Site Iteration V1, in place of the dominant
  panel and its two supporting panels), and one case-study link (the title is the link and the whole
  card is its target; "View case study" is its visible label, beside the head on desktop and last on
  phones). Metrics live on the case-study pages; nothing on a card is emphasized. The introduction above
  the cards carries one emphasis, "strategy through execution", a slightly heavier weight in the
  surrounding color.
- The opening frame (Version 1.9): from 60rem the section starts just below the floating header
  (`--work-top`, the header's height and a little more), and the Work link lands with the section flush
  at the top. Since Full Site Iteration V1.1 the cards are taller (each shows its complete 16:9 video), so
  the first view holds the headline, the introduction and most of the first card, which is whole once it
  has parked, a short scroll on (at 1440x900 the headline starts at 92px and the first card at 270px;
  parked, the card spans 97 to 857px).
- The card (Full Site Iteration V1.1): its head (number and label, title, subline, link), then the
  complete video in an exact 16:9 frame at its full inner width, so its height follows from its width.
  Every head keeps the tallest head's height (a script measures the heads as set, `--card-head`), so
  the three cards share one size. On desktop a card is as wide as the content, but never so wide that
  its frame is taller than the screen below the header; in the stack it is the widest whose head and
  complete frame fit that screen, and is centered, scaling down in proportion on shorter screens rather
  than cropping the video. Measured: 1045x760 at 1440x900 (its frame 986x555), 891x668 at 1280x800,
  749x588 at 1280x720, 829x636 at 1366x768, 982x726 at 1536x864, 1147x821 at 1728x968, 1331x924 at
  1920x1080 and the content's full 1384x954 at 2560x1440. The sizes are worked out in `index.astro` from
  the card's padding, border, gap and type, which it shares with `WorkPanels.astro`.
- The stack: on screens at least 60rem wide and 45rem tall the cards stack as you scroll with
  `position: sticky`: each parks `--peek` (14px) lower than the one before, so the earlier cards' top
  edges stay in view and none is ever fully covered, and each card is whole once it has parked (the
  third, two peeks lower, still ends above the screen's foot). A covered card recedes 4% and its video
  dims; its text keeps full contrast. The parked stack sits centered in the screen below the header. The
  run between cards follows from the card's height (each next card arrives after about a screen of
  scrolling at 1440x900). Each card's margin box ends where the last card's does (a `margin-bottom` of
  one `--peek` for every card after it), so when the section runs out the complete stack rests for a
  moment and then leaves as one, instead of the last card sliding over the others.
- The pinned introduction: on screens at least 82rem tall and no wider than 2:1 (2560x1440, 2560x1600),
  where a complete card at the content's width fits beneath it, the headline and introduction stay
  pinned just below the header while the cards park beneath them, and nothing ever covers them; the run
  between cards is short there, and the head's margin box ends exactly where the stack's margin boxes
  end, so the head and the complete stack release together. A script measures the head's height
  (`--head-h`). On every other desktop screen (Full Site Iteration V1.1; 56rem was enough for the
  earlier, shorter cards) the introduction scrolls away before the stack.
- Enhancement only: the sticky rules apply once an inline script in the head has marked the page with
  `.js`, and only without reduced motion. Without JavaScript, with reduced motion, on screens under 45rem
  tall (1366x650, say), and on phones and tablets the section reads as an ordinary sequence: the
  headline, the introduction, then the three cards, each at the content's width or, on a short screen,
  as wide as keeps its frame within the screen (1028px wide at 1366x650, its frame 546px tall).
- Keyboard: going backwards through the stack (Shift+Tab) reaches cards that later ones cover. When a
  control in a covered card takes keyboard focus, the page scrolls back to where that card has just
  parked, so focus is never hidden under another card.
- The frame (Full Site Iteration V1, corrected in V1.1): one frame and treatment on every card, an exact
  16:9 at every width, phones to wide screens, so every card shows its complete video: nothing of the
  top, bottom or sides is cropped, and the Technical Product Marketing hero animation shows as designed.
  The video and its poster are contained in it (`object-fit: contain`) as a safeguard; the edits are
  16:9, so they fill it exactly and nothing letterboxes. (Full Site Iteration V1 showed a centered band
  of each edit on desktop, 2.6:1 to 3.75:1 with the screen, and the montages were cut to keep faces and
  words near the frame's center, so they read the same in the whole frame.) The card's `focus` option,
  which steered that crop, is gone.
- Media (Full Site Iteration V1): each card plays one edit. Each manifest entry's `source` note records
  every excerpt, its range and its order.

  | Card | Video | Length | File |
  | --- | --- | --- | --- |
  | 01 | The creator montage (`cc-creator-montage`) | 15.52 s | `home-creator-montage.mp4`, 1600x900, 25 fps, 4.7 MB |
  | 02 | The hero animation (`tm-hero-animation`), unchanged | 11.68 s | `bolt-hero-animation-loop.mp4`, 1600x900, 1.4 MB |
  | 03 | The events montage (`ev-events-montage`), the Events page's four edits whole since V1.3 | 38.37 s | `home-events-montage-fs13.mp4`, 1600x900, 23.976 fps, 8.9 MB |

  The creator montage keeps the Costa Rica aftermovie's crescendo (1:44.56 to 1:53.20, its own cuts and
  acceleration) as its foundation, opened by slower destination imagery (Marina Bay from the air in golden
  light, dissolving into the villa pool from above, then the crew with a gimbal) and with three new
  subjects given 0.5 to 0.9 seconds each before the cutting quickens: the Trezor paper airplane (launched,
  its flight, the Take Control card), the game show on wheels (the party bus under its caption) and
  podcast production (a camera on the Lock In Podcast set, then the recording under the stone arch, cut
  to stay clear of the operator stepping into frame and of the logo on his shirt). The events montage
  (moving footage only since Full Site Iteration V1.1: no still image, freeze frame or move across a
  photograph, in this card or any other; since Full Site Iteration V1.3 the Events page's four approved
  edits, each a locked module played whole, at its own speed and in its own internal order, nothing
  taken from the raw masters) runs the production room (the Final loop, `bolt-slippage-final-loop.mp4`,
  8.84 s: the finished explainer's two scenes, Bolt solves slippage by providing you a deterministic
  price, then you have a set execution price that will be filled), Sui Fest (the event film,
  `ev-hero-event-film.mp4`, 11.97 s: we asked our favorite teams, the film's quick run of the event, then
  the interview it ends on), the creator podcast (Jungle Talk, `ev-hero-podcast.mp4`, 7.72 s: the wide,
  the medium and the closer shot, at the top 80% of its frame as the card has always shown it, so its
  burned-in captions and corner marks fall outside) and the live presentation last
  (`ev-hero-presentation.mp4`, 10.22 s: its three excerpts and their two dissolves, the recording's whole
  frame letterboxed onto its own dark ground), whose yellow on dark dissolves back into the explainer's
  title as it builds, so the reset is one gesture with no jump in brightness. The joins between modules
  are clean cuts. The loop is turned to start on the title's completed frame, which is also its poster.
  (V1 set the explainer's title at 90% and 98 px lower, the studio wall mirrored into the margins, to
  fit the cropped band; V1.1's whole frame needs no reframe.) Both montages reset with a 0.4 second
  dissolve into their own opening (the creator montage also dissolves, 0.3 s, from Marina Bay into the
  pool); everything else is hard cuts (in the creator montage every trim is half a frame inside its
  range, so no frame of a neighboring shot comes along). H.264 High, `-preset slower`, CRF 26 (creator,
  2.3 Mbps cap) and 27 (events, `-tune film`, 3.6 Mbps cap), a keyframe every two seconds, no audio,
  fast start. `verify.mjs` holds each card's one video under 5 MiB and, since V1.3, the events montage
  under 9 MiB (its four edits whole run 38.4 seconds, and the brief lets it pass the 5 MiB rather than
  fragment them); the three together weigh 15.0 MB (each loads only as its card comes near), against
  about 13 MB for Version 2.0's nine.
- Posters: each video's first frame (Marina Bay; the hero animation's first frame; the explainer's
  complete title), served as a lazy AVIF or WebP picture under the video and contained in the same
  frame, so poster and video match exactly. No video carries a `poster` attribute, which browsers fetch
  at once.
- Playback: every video sits on its poster in a frame of its own (`.card__frame`), invisible until its
  first frame is on screen (`requestVideoFrameCallback`, else the `playing` event), when it fades in
  over 0.18 seconds; whenever it stops it disappears again and returns to its first frame. Only the
  active card's video plays on its own, muted, looping and inline: where the cards stack, once its card
  has reached its resting place with at least 60% of its frame in view and clear of the next card (the
  script reads whether they are stacking from the stylesheet); elsewhere (tablets, short desktop
  screens), once 60% of the frame is in view. Never two play at once, and nothing plays on hover (the
  supporting panels' hover previews went with them). The play button in the frame's corner starts and
  stops the video from the keyboard or by touch, and the reader's pause holds. A hidden tab pauses it; a
  video that cannot load keeps its poster, and its button goes. A card's video loads only as the card
  comes within a screen of view. Reduced motion, data saving and phones get posters only, with no
  autoplay; the button still plays a video on request.

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
  `crypto.getRandomValues`) and deals them into three rows of eight (four rows of six on phones, since
  Mobile Optimization V1) before the reel is ever on screen. The order is kept in `sessionStorage` (`jc-reel-order`), so reloads, resizes, scrolling,
  reduced motion and returning from a case study never reshuffle it; a new visit may bring a new
  order, and occasional clusters are left as they fall. Without JavaScript the HTML's own fixed,
  seeded shuffle is shown.
- Repeats: a row repeats its complete eight-piece sequence only as many times as it takes to cover the
  screen at every point of its travel (at most desktop widths, not at all), recalculated on resize.
- Frames keep each image's own proportions at one row height, so nothing is cropped and nothing shifts
  as images load. Reduced motion and no JavaScript show the same rows, in the same order, as a still
  collage.
- Capacity: wider screens stay at three rows of eight until eight more approved pieces are supplied (32
  in all), and only then gain a fourth row. Phones deal the same 24 into four rows of six instead (Mobile
  Optimization V1), so their fourth row repeats nothing. Excluded pieces never return, and no piece
  repeats to fill a row.

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
  shrinking. Since Version 1.9 each group centers its heading and its tiles. Since Mobile Optimization V1
  each collection is a strict grid, read left to right and top to bottom, so a short last row starts
  under the first column rather than centering: Google Analytics under Linear, Slack under Mintlify and
  Microsoft Teams under GitBook in the four columns of Systems and measurement, Typefully under Figma
  and Grammarly under Photoshop (on phones, three across, Microsoft Teams under Grafana). From 40rem a
  group keeps its own column count, half its tools rounded up. The cells keep one width (a third of the
  row on phones, 6.25rem on tablets, about 8.4 times the label size on desktop) rather than stretching
  to fill a row.
- The capability rows respond to hover and keyboard focus alike (Full Site Iteration V1): when a fine
  pointer arrives on a row, its icon makes one full turn (360 degrees in 560 ms, easing out), once; it
  never loops while the pointer stays, and leaving resets it without turning backwards (the class that
  turns it comes off when the turn ends, `rotate` back at 0). Hover and keyboard focus both show the
  completed state, a lift of 2px and a 3% scale, while the circle takes a little more teal and a faint
  ring; focus never turns the icon, and also draws the site's focus ring. Only the icon moves (with the
  individual `rotate`, `translate` and `scale` properties, so nothing in the layout shifts). Touch never
  turns it, and with reduced motion the state is shown by color alone. The old resting tilt is gone.
- The working-style statement (Full Site Iteration V1): "I move between strategy and execution, building
  clear systems and working closely with the people responsible for shipping. AI accelerates research,
  organization, production, and analysis, while judgment, verification, brand fit, and final approval
  remain mine." Its one emphasis is "strategy and execution", a slightly heavier weight (`.em-key`, the
  same rule as Technical Product Marketing's `.tpm-em`).
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
  follows any change to them: four rows below 30rem, where its links take two, three to 48rem and two
  above. The headline and subline hold the left and the email and resume actions
  the right, with the spare height shared out above and below (1 to 1.25), and the footer rests at the
  bottom as a quiet anchor. The top padding reserves the header's height, so the navigation never meets
  the headline. Phones and short windows let the frame grow past one screen rather than compressing
  it, and there is no scroll snapping. The creator case study keeps the compact Contact, without the
  grid; the Technical Product Marketing page (since its Version 1 redesign) and the Events page (since
  its Version 1.0) close with the full frame and its grid, as the homepage does.
- The grid's lead (Technical Product Marketing V1.5, Events V1.0): on those two pages the conclusion
  before Contact is a dark ground that turns, step by step, into exactly the Contact green, so there
  is no seam between them, and Contact's grid rises out of the conclusion instead of starting at
  Contact's edge. `<Contact lead="clamp(10rem, 40svh, 26rem)" />` starts the grid that far above
  Contact, invisible there, about 5% of its strength at four tenths of the way down, 22% at seven
  tenths and 60% at nine tenths, and at full strength exactly where Contact begins (`--grid-fade`);
  the rows are still counted up from the footer's rule, so they line up as on the homepage, and the
  conclusion's words sit above the lines. The pointer response is unchanged and nothing animates the
  gradient. The homepage passes no lead and keeps its own start.
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
- The accent (Full Site Iteration V1): "Its story shouldn't be." takes the section's accent color at the
  headline's own display weight and size, inside the one heading (so it is read as one sentence) and
  inline, so the headline wraps as before; on every page, the case studies' compact Contact included.
- The footer carries the hero's descriptor, the links (Work, About, Resume, LinkedIn and the email) and
  one credit: "© 2026 John Cowin — Built end to end." The year follows the build date. Its em dash is
  intentional, the one exception besides the hero's name stream, and `verify.mjs` excuses that exact
  line only. John's name appears once in the footer.

## Case-study roles

- Since its Version 1 redesign Technical Product Marketing states John's part in its own hero copy and
  scope line, without a "My role:" line; since its Version 1.0 Events and Multimedia Production states
  it in the credits beneath each piece of work, also without one; and since its Version 1.0 Creator
  Marketing and Partnerships states it in its program context, its ownership section and its closing
  credits. No page carries the line any longer; the description below is kept for its history.
- Each case study states John's part in one compact line under its intro: "My role:" in bold, then the
  responsibilities that apply to that project, from the `role` field in its frontmatter. The lines name
  the strategy, the briefs, the review and approval, and the distribution or publishing, the ways John
  commissioned and shaped the visual work with designers, editors and creators, without implying he
  built every graphic himself; each page's closing credit still says who produced the final visuals.
  The creator campaigns intro keeps only its first sentence, and its section 02 is now "Program
  management", so "My role" appears once on that page. The reel stays wordless.

