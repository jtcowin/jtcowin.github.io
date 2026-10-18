/**
 * Client-side motion for Creator Marketing and Partnerships (V1.1).
 *
 * Hero: while the hero is on screen, the share of it scrolled past (0 to 1)
 * is written to --p on the section, once a frame at most, and each layer
 * turns that into its own movement in CSS (its --rate). The listener is
 * passive and reads only the scroll position; nothing is written for reduced
 * motion, so the layers rest in place.
 *
 * Creator network: the eight cards travel one way around a curved path in
 * depth (an ellipse seen from slightly above): the nearest card largest and
 * on top, the farthest smaller and fainter, each with a small tilt of its
 * own. One revolution takes about 80 seconds. The ring eases to a stop while
 * a card is hovered, focused or selected (its details at the center), while
 * the section is off screen and while the tab is hidden, and never moves for
 * reduced motion (a still arrangement, the details still there on hover,
 * focus or a tap). There is nothing to drag and no control to reverse it.
 *
 * Campaign atlas: on wide, tall enough screens with motion allowed the stage
 * holds still while the reader scrolls through its runway, and the
 * destination whose part of the runway is under the middle of the screen is
 * shown (its loop plays, the others wait); the index jumps to a destination.
 * Otherwise (and without JavaScript) the three destinations read one after
 * another, each loop playing only while it is well in view.
 *
 * Selected-content library (V1.1): six formats, one edit each, chosen with
 * tabs. Selecting a format plays its edit from the start; with motion allowed
 * the library moves on to the next format when an edit ends, round and round,
 * and holds while keyboard focus is in the formats; the reader's pause holds
 * until they play again. Off screen or in a hidden tab it pauses. Reduced
 * motion, a data-saving preference or a refused autoplay start nothing: the
 * selected edit waits on its poster and plays once on request.
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

// ---- creator network --------------------------------------------------------------------------
const TURN_SECONDS = 80;

export function mountNetwork() {
  const root = document.querySelector<HTMLElement>('[data-cm-network]');
  if (!root) return;
  const ringMq = window.matchMedia('(min-width: 48rem)');
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-cmn-item]'));
  const detail = root.querySelector<HTMLElement>('[data-cmn-detail]');
  const N = items.length;
  if (!N || !detail) return;
  const tilts = items.map((el) => parseFloat(getComputedStyle(el).getPropertyValue('--tilt')) || 0);

  let angle = 0; // the ring's turn, in radians
  let speed = 0; // radians a second, eased toward its target
  let raf = 0;
  let lastT = 0;
  let inView = false;
  let hovered: HTMLElement | null = null;
  let focused: HTMLElement | null = null;
  let pinned: HTMLElement | null = null;
  let shown: HTMLElement | null = null;

  const place = () => {
    for (let i = 0; i < N; i++) {
      const a = angle + (i / N) * Math.PI * 2;
      const depth = (1 + Math.cos(a)) / 2;
      const el = items[i];
      el.style.setProperty('--x', (Math.sin(a) * 50).toFixed(3));
      el.style.setProperty('--y', (Math.cos(a) * 50).toFixed(3));
      el.style.setProperty('--s', (0.6 + 0.4 * depth).toFixed(4));
      el.style.setProperty('--o', (0.55 + 0.45 * depth).toFixed(3));
      el.style.setProperty('--z', String(Math.round(depth * 100)));
      el.style.setProperty('--tilt', `${(tilts[i] + 3 * Math.sin(a)).toFixed(2)}deg`);
    }
  };

  const active = () => pinned ?? focused ?? hovered;
  const show = () => {
    const el = active();
    if (el === shown) return;
    shown = el;
    if (el) {
      const info = el.querySelector<HTMLElement>('[data-cmn-info]');
      detail.innerHTML = info ? info.innerHTML : '';
      root.dataset.active = el.dataset.i ?? '';
    } else {
      delete root.dataset.active;
    }
    run();
  };

  const moving = () => ringMq.matches && !reduced() && inView && !document.hidden && !active();
  const tick = (t: number) => {
    raf = 0;
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0;
    lastT = t;
    const target = moving() ? (Math.PI * 2) / TURN_SECONDS : 0;
    // Ease toward the target (about half a second to stop or to set off again).
    speed += (target - speed) * Math.min(1, dt * 4);
    if (Math.abs(speed) < 1e-4 && target === 0) speed = 0;
    angle -= speed * dt;
    place();
    if (speed !== 0 || target !== 0) raf = requestAnimationFrame(tick);
    else lastT = 0;
  };
  const run = () => {
    if (!raf && ringMq.matches) {
      lastT = 0;
      raf = requestAnimationFrame(tick);
    }
  };

  for (const el of items) {
    const card = el.querySelector<HTMLButtonElement>('[data-cmn-card]');
    if (!card) continue;
    card.addEventListener('pointerenter', (e) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      hovered = el;
      show();
    });
    card.addEventListener('pointerleave', () => {
      if (hovered === el) hovered = null;
      show();
    });
    // Keyboard focus shows a creator (a click's focus does not hold the ring; selecting does).
    card.addEventListener('focus', () => {
      if (!card.matches(':focus-visible')) return;
      focused = el;
      show();
    });
    card.addEventListener('blur', () => {
      if (focused === el) focused = null;
      show();
    });
    // Selecting a creator holds their details (and the ring) until it is selected again or another is.
    card.addEventListener('click', () => {
      pinned = pinned === el ? null : el;
      for (const other of items) other.querySelector('[data-cmn-card]')?.setAttribute('aria-pressed', String(other === pinned));
      show();
    });
  }
  // Escape lets go of a held creator.
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !pinned) return;
    pinned.querySelector('[data-cmn-card]')?.setAttribute('aria-pressed', 'false');
    pinned = null;
    show();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      run();
    }).observe(root);
  } else {
    inView = true;
  }
  document.addEventListener('visibilitychange', run);
  onMotionChange(run);
  ringMq.addEventListener?.('change', () => {
    place();
    run();
  });
  root.dataset.ready = '';
  place();
  run();
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
  let pending = false; // an edit ended while focus was in the formats
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

  /** The selected tab, and the roving tab stop on it while focus is elsewhere. */
  const select = (key: string) => {
    for (const t of tabs) {
      const on = t.dataset.cmlTab === key;
      t.setAttribute('aria-selected', String(on));
      if (!focusIn) t.tabIndex = on ? 0 : -1;
      if (!on) t.style.removeProperty('--fill');
    }
    if (nowFormat) nowFormat.textContent = panels.get(key)?.dataset.label ?? '';
    shownPlace = '';
    mark();
  };

  /** Put a format on screen: its panel fades in over the one before, which leaves once covered. */
  const show = (key: string) => {
    if (key === active) return;
    const prev = active;
    active = key;
    pending = false;
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
      try {
        v.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
    }
  };

  const next = () => show(order[(order.indexOf(active) + 1) % order.length]);

  /**
   * An edit has played through. With motion allowed the next format follows,
   * unless keyboard focus is in the formats (then it waits until focus leaves
   * them). Played on request (reduced motion, saving data, a refused
   * autoplay), an edit plays once and waits on its last frame.
   */
  const ended = () => {
    if (!autoplay()) {
      asked = false;
      render();
      return;
    }
    if (held) {
      render();
      return;
    }
    if (focusIn) {
      pending = true;
      render();
      return;
    }
    next();
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
        render();
      });
    }
  };

  const sync = () => {
    const v = video();
    if (!v) return;
    const go = !document.hidden && inView && !held && !pending && (autoplay() || asked);
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

  /** The line under the selected format fills with its edit's progress; the next edit loads near the end. */
  const loop = () => {
    const v = video();
    if (!v || v.paused || raf) return;
    const tick = () => {
      raf = 0;
      const cur = video();
      if (!cur) return;
      const d = cur.duration;
      if (d > 0) {
        tabOf(active)?.style.setProperty('--fill', Math.min(1, cur.currentTime / d).toFixed(4));
        if (d - cur.currentTime < 3) {
          const nv = videos.get(order[(order.indexOf(active) + 1) % order.length]);
          if (nv && nv.preload !== 'auto' && autoplay()) nv.preload = 'auto';
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

  // Selecting a format (a click, or Enter or Space on a focused tab) plays its edit from the start.
  for (const t of tabs) {
    t.addEventListener('click', () => {
      const key = t.dataset.cmlTab as string;
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
        pending = false;
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
  // While keyboard focus is in the formats the library does not move on; leaving them, the tab stop returns to the selected format.
  tablist.addEventListener('focusin', () => {
    focusIn = true;
  });
  tablist.addEventListener('focusout', (e) => {
    if (tablist.contains(e.relatedTarget as Node | null)) return;
    focusIn = false;
    for (const t of tabs) t.tabIndex = t.dataset.cmlTab === active ? 0 : -1;
    if (pending) {
      pending = false;
      if (autoplay() && !held) next();
    }
  });

  toggle?.addEventListener('click', () => {
    const v = video();
    if (!v) return;
    if (v.paused || v.ended) {
      held = false;
      blocked = false;
      asked = true;
      inView = true;
      pending = false;
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
  document.addEventListener('visibilitychange', sync);
  onMotionChange(sync);
  for (const v of videos.values()) v.addEventListener('timeupdate', mark);
  root.dataset.ready = '';
  select(active);
  render();
}
