/**
 * Client-side motion for Creator Marketing and Partnerships (V1.3).
 *
 * Hero: while the hero is on screen, the share of it scrolled past (0 to 1)
 * is written to --p on the section, once a frame at most, and each layer
 * turns that into its own movement in CSS (its --rate). The listener is
 * passive and reads only the scroll position; nothing is written for reduced
 * motion, so the layers rest in place.
 *
 * (V1.3: the creator network and its portrait field are gone, and with them
 * every listener they set; the creators are named in the credits.)
 *
 * Campaign atlas: on wide, tall enough screens with motion allowed the stage
 * holds still while the reader scrolls through its runway, and the
 * destination whose part of the runway is under the middle of the screen is
 * shown (its loop plays, the others wait); the index jumps to a destination.
 * Otherwise (and without JavaScript) the three destinations read one after
 * another, each loop playing only while it is well in view.
 *
 * Selected-content library (V1.3): seven formats, one edit each, chosen with
 * tabs. Every edit's last moment dissolves into its own opening, so it can
 * repeat with no seam. Until the reader chooses, with motion allowed, the
 * library moves on to the next format as each edit ends, round and round
 * (holding, the edit repeating, while keyboard focus is in the formats); a
 * format the reader selects is pinned: its edit plays from the start and
 * loops until they select another or leave the section (V1.3), after which
 * the library moves on again as before. The reader's pause holds until they
 * play again; off screen or in a hidden tab it pauses. Reduced motion, a
 * data-saving preference or a refused autoplay start nothing: the selected
 * edit waits on its poster and plays through once on request.
 *
 * Program ownership (V1.3): the wave's two layers flow on their own, slowly
 * and without end (CSS); this only lets them run while the water is near the
 * screen and the page is visible, and holds them otherwise. With reduced
 * motion the CSS never sets them moving.
 *
 * Reveals: elements marked [data-cm-reveal] arrive once as they come into
 * view; with reduced motion they are simply there.
 */

import { saving } from './ev-media';

const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => reduceMq.matches;
const onMotionChange = (fn: () => void) => reduceMq.addEventListener?.('change', fn);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// ---- hero -------------------------------------------------------------------------------------
export function mountHero() {
  const hero = document.querySelector<HTMLElement>('[data-cm-hero]');
  if (!hero) return;
  let raf = 0;
  let inView = true;
  let last = -1;
  const write = () => {
    raf = 0;
    if (reduced()) {
      if (last !== 0) hero.style.setProperty('--p', '0');
      last = 0;
      return;
    }
    const h = hero.offsetHeight || 1;
    const p = clamp(window.scrollY / h);
    const q = Math.round(p * 1000) / 1000;
    if (q !== last) {
      hero.style.setProperty('--p', String(q));
      last = q;
    }
  };
  const schedule = () => {
    if (!raf && inView) raf = requestAnimationFrame(write);
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) schedule();
    }).observe(hero);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  onMotionChange(schedule);
  schedule();
}

// ---- reveals ----------------------------------------------------------------------------------
export function mountReveals(scope: ParentNode = document) {
  const els = Array.from(scope.querySelectorAll<HTMLElement>('[data-cm-reveal]'));
  if (!els.length) return;
  if (!('IntersectionObserver' in window) || reduced()) {
    for (const el of els) el.classList.add('is-in');
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -14% 0px', threshold: 0.01 },
  );
  for (const el of els) io.observe(el);
}

// ---- campaign atlas ---------------------------------------------------------------------------
export function mountAtlas() {
  const root = document.querySelector<HTMLElement>('[data-cm-atlas]');
  const runway = root?.querySelector<HTMLElement>('[data-cma-runway]');
  if (!root || !runway) return;
  const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-cma-chapter]'));
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-cma-go]'));
  const loops = chapters.map((ch) => ch.querySelector<HTMLElement>('[data-ev-loop]'));
  const N = chapters.length;
  let pinned = false;
  let active = -1;
  let raf = 0;

  // Pinned only on a wide enough screen, tall enough to hold a destination, with motion allowed.
  const canPin = () => !reduced() && window.innerWidth >= 960 && window.innerHeight >= 600;
  const geometry = () => {
    const top = runway.getBoundingClientRect().top + window.scrollY;
    const span = Math.max(1, runway.offsetHeight - window.innerHeight);
    return { top, span };
  };

  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    chapters.forEach((ch, j) => {
      ch.dataset.state = j === i ? 'active' : j < i ? 'before' : 'after';
      // A destination set aside keeps its loop waiting (ev-media.ts reads [data-loop-off]).
      if (pinned && j !== i) ch.setAttribute('data-loop-off', '');
      else ch.removeAttribute('data-loop-off');
    });
    links.forEach((a, j) => (j === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    for (const l of loops) l?.dispatchEvent(new Event('ev:loop-sync'));
  };

  const update = () => {
    raf = 0;
    if (!pinned) return;
    const { top, span } = geometry();
    const p = clamp((window.scrollY - top) / span);
    const x = p * N;
    const i = Math.min(N - 1, Math.floor(x));
    setActive(i);
    root.style.setProperty('--chapter-progress', clamp(x - i).toFixed(3));
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  const mode = () => {
    const next = canPin();
    if (next !== pinned) {
      pinned = next;
      root.classList.toggle('is-pinned', pinned);
      if (!pinned) {
        root.style.removeProperty('--chapter-progress');
        chapters.forEach((ch) => {
          ch.dataset.state = 'active';
          ch.removeAttribute('data-loop-off');
        });
        links.forEach((a) => a.removeAttribute('aria-current'));
        active = -1;
        for (const l of loops) l?.dispatchEvent(new Event('ev:loop-sync'));
      } else {
        active = -1;
      }
    }
    if (pinned) update();
  };

  // The index: on the held stage, it scrolls to that destination's part of the runway.
  links.forEach((a, i) =>
    a.addEventListener('click', (e) => {
      if (!pinned) return;
      e.preventDefault();
      const { top, span } = geometry();
      window.scrollTo({ top: Math.round(top + ((i + 0.12) / N) * span), behavior: reduced() ? 'auto' : 'smooth' });
    }),
  );

  window.addEventListener('scroll', schedule, { passive: true });
  let rt = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(mode, 120);
  });
  onMotionChange(mode);
  mode();
  if (!pinned) chapters.forEach((ch) => (ch.dataset.state = 'active'));
}

// ---- selected-content library -------------------------------------------------------------
type Cue = { at: number; place: string };
const LIB_FADE = 350;
/** Each edit's last moment dissolves back into its own opening (V1.2), this long. */
const LIB_RESET = 0.4;

export function mountLibrary() {
  const root = document.querySelector<HTMLElement>('[data-cm-library]');
  const tablist = root?.querySelector<HTMLElement>('[data-cml-tabs]');
  const stage = root?.querySelector<HTMLElement>('[data-cml-stage]');
  if (!root || !tablist || !stage) return;
  const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>('[data-cml-tab]'));
  const panels = new Map<string, HTMLElement>();
  const videos = new Map<string, HTMLVideoElement>();
  const cues = new Map<string, Cue[]>();
  for (const panel of Array.from(root.querySelectorAll<HTMLElement>('[data-cml-panel]'))) {
    const key = panel.dataset.cmlPanel as string;
    const video = panel.querySelector<HTMLVideoElement>('[data-cml-video]');
    if (!video) continue;
    panels.set(key, panel);
    videos.set(key, video);
    try {
      cues.set(key, (JSON.parse(panel.dataset.cues ?? '[]') as Cue[]).sort((x, y) => x.at - y.at));
    } catch {
      cues.set(key, []);
    }
  }
  const order = tabs.map((t) => t.dataset.cmlTab as string).filter((k) => videos.has(k));
  if (!order.length) return;
  const toggle = root.querySelector<HTMLButtonElement>('[data-cml-toggle]');
  const toggleText = root.querySelector<HTMLElement>('[data-cml-toggle-text]');
  const nowFormat = root.querySelector<HTMLElement>('[data-cml-format]');
  const nowPlace = root.querySelector<HTMLElement>('[data-cml-place]');
  const tabOf = (key: string) => tabs.find((t) => t.dataset.cmlTab === key) ?? null;

  let active = order[0];
  let leaving = '';
  let fade = 0;
  let raf = 0;
  let held = false; // the reader paused the library
  let asked = false; // the reader asked for playback: it plays even for reduced motion
  let blocked = false; // the browser refused to start it
  let inView = false;
  let focusIn = false; // keyboard focus is in the formats: no moving on meanwhile
  let pinned = false; // the reader selected this format: it loops until they select another (V1.2)
  let lastTime = 0;
  let shownPlace = '';

  // The script takes over: the panels become tab panels, the native controls go.
  for (const key of order) {
    const panel = panels.get(key) as HTMLElement;
    const video = videos.get(key) as HTMLVideoElement;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `cml-tab-${key}`);
    panel.tabIndex = 0;
    if (key !== active) panel.hidden = true;
    video.removeAttribute('controls');
    video.muted = true;
    video.loop = false;
    video.addEventListener('ended', () => {
      if (key === active) ended();
    });
    video.addEventListener('playing', () => render());
    video.addEventListener('pause', () => render());
    video.addEventListener('error', () => panel.setAttribute('data-failed', ''));
  }

  const autoplay = () => !reduced() && !saving() && !blocked;
  const video = () => videos.get(active) ?? null;
  /**
   * With motion allowed every edit repeats by itself (its last moment is its first),
   * and the library moves on just before the repeat unless it is pinned or held;
   * played on request (reduced motion, saving data, a refused autoplay), it plays
   * through once.
   */
  const loops = () => autoplay();
  /** Whether the library may move on to the next format at the end of this edit. */
  const movesOn = () => autoplay() && !pinned && !focusIn && !held;

  /** The selected tab, and the roving tab stop on it while focus is elsewhere. */
  const select = (key: string) => {
    for (const t of tabs) {
      const on = t.dataset.cmlTab === key;
      t.setAttribute('aria-selected', String(on));
      if (!focusIn) t.tabIndex = on ? 0 : -1;
      if (!on) t.style.removeProperty('--fill');
    }
    if (nowFormat) nowFormat.textContent = panels.get(key)?.dataset.label ?? '';
    root.toggleAttribute('data-pinned', pinned);
    shownPlace = '';
    mark();
  };

  /** Put a format on screen: its panel fades in over the one before, which leaves once covered. */
  const show = (key: string) => {
    if (key === active) return;
    const prev = active;
    active = key;
    lastTime = 0;
    window.clearTimeout(fade);
    if (leaving && leaving !== key) retire(leaving);
    const into = panels.get(key) as HTMLElement;
    into.hidden = false;
    // (the hidden attribute comes off first, so the fade in can run)
    void into.offsetWidth;
    for (const [k, p] of panels) {
      p.classList.toggle('is-in', k === key);
      if (k !== key && k !== prev) p.classList.remove('is-on');
    }
    into.classList.add('is-on');
    const out = panels.get(prev);
    if (out) {
      out.setAttribute('aria-hidden', 'true');
      out.inert = true;
    }
    leaving = prev;
    fade = window.setTimeout(() => {
      if (leaving === prev) retire(prev);
      leaving = '';
    }, reduced() ? 0 : LIB_FADE + 30);
    const v = video();
    if (v) {
      try {
        v.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
    }
    select(key);
    sync();
  };

  /** The format left behind: hidden, paused, back to its beginning for next time. */
  const retire = (key: string) => {
    if (key === active) return;
    const p = panels.get(key);
    if (p) {
      p.classList.remove('is-on', 'is-in');
      p.hidden = true;
      p.removeAttribute('aria-hidden');
      p.inert = false;
    }
    const v = videos.get(key);
    if (v) {
      if (!v.paused) v.pause();
      v.loop = false;
      try {
        v.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
    }
  };

  const next = () => show(order[(order.indexOf(active) + 1) % order.length]);

  /** Played through once on request (reduced motion, saving data, a refused autoplay): it waits. */
  const ended = () => {
    asked = false;
    render();
  };

  const play = () => {
    const v = video();
    if (!v) return;
    if (v.preload !== 'auto') v.preload = 'auto';
    if (v.ended) {
      try {
        v.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
    }
    const p = v.play();
    if (p && typeof p.catch === 'function') {
      p.catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'NotAllowedError') blocked = true;
        sync();
      });
    }
  };

  const sync = () => {
    const v = video();
    if (!v) return;
    v.loop = loops();
    const go = !document.hidden && inView && !held && (autoplay() || asked);
    if (go && v.paused) play();
    else if (!go && !v.paused) v.pause();
    // Only the format on screen plays (the one leaving only until it is covered).
    for (const [k, other] of videos) if (k !== active && k !== leaving && !other.paused) other.pause();
    loop();
    render();
  };

  /** The place on screen, from the edit's cue times. */
  const mark = () => {
    const v = video();
    const list = cues.get(active) ?? [];
    if (!v || !list.length || !nowPlace) return;
    const t = v.currentTime || 0;
    let place = list[0].place;
    for (const c of list) if (t >= c.at) place = c.place;
    if (place !== shownPlace) {
      nowPlace.textContent = place;
      shownPlace = place;
    }
  };

  /**
   * Every frame while an edit plays: the line under its format fills; the next edit
   * loads near the end; and, unless the reader has pinned or is holding this format,
   * the library moves on as the edit begins to dissolve back into its opening.
   */
  const loop = () => {
    const v = video();
    if (!v || v.paused || raf) return;
    const tick = () => {
      raf = 0;
      const cur = video();
      if (!cur) return;
      const d = cur.duration;
      const t = cur.currentTime;
      if (d > 0) {
        const end = movesOn() ? d - LIB_RESET : d;
        tabOf(active)?.style.setProperty('--fill', Math.min(1, t / end).toFixed(4));
        if (d - t < 3) {
          const nv = videos.get(order[(order.indexOf(active) + 1) % order.length]);
          if (nv && nv.preload !== 'auto' && autoplay()) nv.preload = 'auto';
        }
        const wrapped = t + 0.5 < lastTime;
        lastTime = t;
        if (movesOn() && !cur.paused && (t >= d - LIB_RESET - 0.03 || wrapped)) {
          next();
          return;
        }
      }
      mark();
      if (!cur.paused) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  const render = () => {
    const v = video();
    const playing = Boolean(v && !v.paused && !v.ended);
    root.classList.toggle('is-playing', playing);
    if (toggle) {
      toggle.dataset.state = playing ? 'playing' : 'paused';
      toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'}: Selected content`);
      if (toggleText) toggleText.textContent = playing ? 'Pause' : 'Play';
    }
    if (v && v.ended) tabOf(active)?.style.setProperty('--fill', '1');
  };

  // Selecting a format (a click, or Enter or Space on a focused tab) pins it (V1.2): its
  // edit plays from the start and loops until the reader selects another.
  for (const t of tabs) {
    t.addEventListener('click', () => {
      const key = t.dataset.cmlTab as string;
      pinned = true;
      held = false;
      blocked = false;
      asked = true;
      inView = true;
      if (key === active) {
        const v = video();
        if (v) {
          try {
            v.currentTime = 0;
          } catch {
            /* not seekable yet */
          }
        }
        lastTime = 0;
        select(key);
        sync();
      } else show(key);
    });
  }
  // The arrow keys, Home and End move between the formats (activation stays with Enter or Space).
  tablist.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j < 0) return;
    e.preventDefault();
    tabs.forEach((t, k) => (t.tabIndex = k === j ? 0 : -1));
    tabs[j].focus();
  });
  // While keyboard focus is in the formats the library does not move on (the edit
  // repeats meanwhile); leaving them, the tab stop returns to the selected format.
  tablist.addEventListener('focusin', () => {
    focusIn = true;
  });
  tablist.addEventListener('focusout', (e) => {
    if (tablist.contains(e.relatedTarget as Node | null)) return;
    focusIn = false;
    for (const t of tabs) t.tabIndex = t.dataset.cmlTab === active ? 0 : -1;
  });

  toggle?.addEventListener('click', () => {
    const v = video();
    if (!v) return;
    if (v.paused || v.ended) {
      held = false;
      blocked = false;
      asked = true;
      inView = true;
      sync();
    } else {
      held = true;
      v.pause();
    }
    render();
  });
  if (toggle) toggle.hidden = false;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        const r = entry.isIntersecting ? entry.intersectionRatio : 0;
        if (r >= 0.35) inView = true;
        else if (r < 0.15) inView = false;
        sync();
      },
      { threshold: [0, 0.15, 0.35] },
    ).observe(stage);
  } else {
    inView = true;
  }
  // Leaving the section ends a selection (V1.3): the pinned format, or an edit played on
  // request, lets go once the section is entirely off screen (and so does the hold of a
  // focused format, the click that chose it having focused its tab), and back on screen
  // the library moves on again as each edit ends (the reader's own pause still holds).
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting || (!pinned && !asked && !focusIn)) return;
      pinned = false;
      asked = false;
      focusIn = false;
      root.toggleAttribute('data-pinned', false);
      sync();
    }).observe(root);
  }
  document.addEventListener('visibilitychange', sync);
  onMotionChange(sync);
  for (const v of videos.values()) v.addEventListener('timeupdate', mark);
  root.dataset.ready = '';
  select(active);
  render();
}

// ---- program ownership: the wave's flow (V1.3) -----------------------------------------------
/**
 * The two layers of the wave flow on their own in CSS (CmOwnership.astro); they run only
 * while the water is near the screen and the page is visible, and hold where they are
 * otherwise, so nothing moves off screen or in a hidden tab. With reduced motion the CSS
 * sets nothing moving, so there is nothing to hold.
 */
export function mountOwnership() {
  const root = document.querySelector<HTMLElement>('[data-cmo]');
  const water = root?.querySelector<HTMLElement>('[data-cmo-water]');
  if (!root || !water) return;
  let near = !('IntersectionObserver' in window);
  const set = () => {
    if (near && !document.hidden) root.dataset.flow = 'on';
    else delete root.dataset.flow;
  };
  if ('IntersectionObserver' in window) {
    // The margin starts the flow half a screen before the wave arrives, so it is not seen
    // starting.
    new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting;
        set();
      },
      { rootMargin: '50% 0px' },
    ).observe(water);
  }
  document.addEventListener('visibilitychange', set);
  set();
}
