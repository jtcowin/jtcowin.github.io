/**
 * Client-side motion for Creator Marketing and Partnerships (V1.2).
 *
 * Hero: while the hero is on screen, the share of it scrolled past (0 to 1)
 * is written to --p on the section, once a frame at most, and each layer
 * turns that into its own movement in CSS (its --rate). The listener is
 * passive and reads only the scroll position; nothing is written for reduced
 * motion, so the layers rest in place.
 *
 * Creator network (V1.2): the eight portraits in one field warped across a
 * broad curve in depth, moving one way at a slow, constant pace (one creator
 * every few seconds): each enters from beyond the frame, grows as it nears the
 * focal zone and drifts back past it, and the eighth leads into the first with
 * no seam. The creator in the focal zone is shown in the details area. The
 * field eases to a stop while a creator is hovered or keyboard-focused (and
 * shows them), selecting a creator still approaching brings them forward to
 * the focal zone (never backward), a creator focused out of sight comes into
 * view along the path, a swipe moves it by hand, a tap holds a creator for a
 * few seconds, and one control pauses it; it rests off screen and in a hidden
 * tab. Reduced motion: a still gallery, a creator shown by selecting them.
 *
 * Campaign atlas: on wide, tall enough screens with motion allowed the stage
 * holds still while the reader scrolls through its runway, and the
 * destination whose part of the runway is under the middle of the screen is
 * shown (its loop plays, the others wait); the index jumps to a destination.
 * Otherwise (and without JavaScript) the three destinations read one after
 * another, each loop playing only while it is well in view.
 *
 * Selected-content library (V1.2): six formats, one edit each, chosen with
 * tabs. Every edit's last moment dissolves into its own opening, so it can
 * repeat with no seam. Until the reader chooses, with motion allowed, the
 * library moves on to the next format as each edit ends, round and round
 * (holding, the edit repeating, while keyboard focus is in the formats); a
 * format the reader selects is pinned: its edit plays from the start and
 * loops until they select another. The reader's pause holds until they play
 * again; off screen or in a hidden tab it pauses. Reduced motion, a
 * data-saving preference or a refused autoplay start nothing: the selected
 * edit waits on its poster and plays through once on request.
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

// ---- creator network (V1.2: the warped portrait field) --------------------------------------
/** Seconds the field takes to move one creator along. */
const STEP_SECONDS = 5.2;
/** Where a card's place on the path wraps (in creators from the focal zone): out of sight on both sides. */
const S_MIN = -2.45;
const EXIT_GONE = 1.45; // a card has faded out this far past the focal zone
const ease3 = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function mountNetwork() {
  const root = document.querySelector<HTMLElement>('[data-cm-network]');
  const field = root?.querySelector<HTMLElement>('[data-cmn-field]');
  const track = root?.querySelector<HTMLElement>('[data-cmn-track]');
  if (!root || !field || !track) return;
  const items = Array.from(track.querySelectorAll<HTMLElement>('[data-cmn-item]'));
  const cards = items.map((li) => li.querySelector<HTMLButtonElement>('[data-cmn-card]') as HTMLButtonElement);
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-cmn-detail]'));
  const toggle = root.querySelector<HTMLButtonElement>('[data-cmn-toggle]');
  const toggleText = root.querySelector<HTMLElement>('[data-cmn-toggle-text]');
  const N = items.length;
  if (N < 2 || cards.some((c) => !c)) return;
  const wideMq = window.matchMedia('(min-width: 48rem)');

  // ---- geometry: the path, in the field's own pixels -------------------------------------
  // A card at s (creators from the focal zone; s > 0 still approaching, s < 0 leaving)
  // has a scale, a place, a turn and a strength. Approaching cards come from beyond the
  // field's far edge, up and to the right, small and turned toward the reader; at s = 0
  // a card is largest and square to the reader; past it a card drifts back, down and to
  // the left, and fades. The path is drawn once per size and read every frame.
  const G = { W: 0, H: 0, S: 0, fx: 0, fy: 0, unit: 0, stretch: 1, rise: 0, visMax: 3, wide: false, a: 0.75, table: [] as number[] };
  const STEP = 0.02;
  // Scale with distance along the path: a perspective's falloff ahead, a gentle recession behind.
  const kOf = (s: number) => (s >= 0 ? 1 / (1 + G.a * s) : 1 - 0.3 * Math.min(1.6, -s));
  const measure = () => {
    const W = field.clientWidth;
    const H = field.clientHeight;
    const wide = wideMq.matches;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const S = wide ? clamp(Math.min(H * 0.6, W * 0.38), 11 * rem, 22 * rem) : Math.min(W * 0.56, H * 0.62, 15 * rem);
    const fx = wide ? clamp(W * 0.06, 1.5 * rem, 3.5 * rem) + S * 0.86 : W * 0.37;
    const fy = H * (wide ? 0.58 : 0.6);
    const sEnter = S_MIN + N - 0.3;
    // x along the approach: each step as wide as the cards there, packed a little closer
    // as they turn. The falloff eases on a wider field, so the cards stay close together
    // and the path still starts beyond the far edge; only past that are they spaced out.
    const build = () => {
      const table: number[] = [0];
      let x = 0;
      for (let s = STEP; s <= -S_MIN + 8 + STEP; s += STEP) {
        const c = 1.04 - 0.16 * Math.min(1, s / 4);
        x += S * kOf(s - STEP / 2) * c * STEP;
        table.push(x);
      }
      return table;
    };
    const at = (t: number[], s: number) => t[Math.min(t.length - 1, Math.round(s / STEP))];
    const need = () => W - fx + S * kOf(sEnter) * 0.6 + 8;
    G.S = S;
    G.a = wide ? 0.75 : 0.9;
    let table = build();
    while (G.a > 0.3 && at(table, sEnter) < need()) {
      G.a -= 0.025;
      table = build();
    }
    const stretch = Math.max(1, need() / Math.max(1, at(table, sEnter)));
    let visMax = 0;
    for (let s = 0; s < sEnter; s += 0.05) {
      if (fx + at(table, s) * stretch + (S * kOf(s)) / 2 <= W) visMax = s;
    }
    Object.assign(G, { W, H, S, fx, fy, unit: S * 0.9, stretch, rise: wide ? Math.min(1.5, (fy - S * 0.2) / (S * 0.72)) : 0.55, visMax, wide, table });
    root.style.setProperty('--card', `${S.toFixed(1)}px`);
  };
  const xAt = (s: number) => {
    if (s >= 0) return G.fx + G.table[Math.min(G.table.length - 1, Math.round(s / STEP))] * G.stretch;
    return G.fx + s * G.S * 0.6;
  };

  // ---- state ----------------------------------------------------------------------------------
  let still = reduced(); // reduced motion: a still gallery, selected by hand
  let offset = 0; // how far the field has moved, in creators (card i sits at s = i - offset, wrapped)
  let speed = 0; // creators a second, eased toward its target
  let raf = 0;
  let lastT = 0;
  let inView = false;
  let userPaused = false;
  let hoverI = -1; // a fine pointer over a creator
  let focusI = -1; // keyboard focus on a creator
  let pinI = -1; // a creator the reader selected
  let holdUntil = 0; // a tap or a swipe holds the field for a moment
  let selected = 0; // the creator shown in the still gallery
  let glide: { from: number; to: number; t0: number; dur: number; target: number } | null = null;
  let drag: { id: number; x0: number; y0: number; off0: number; moved: boolean; lastX: number; lastT: number; v: number } | null = null;
  let inertia = 0; // creators a second, after a swipe
  let quietClick = 0; // a swipe's own click is not a selection
  let activeI = -1;
  let shownI = -1;
  let ringI = -1;

  /** A creator holding keyboard focus (a click or a tap focuses the button too, but only the keyboard holds the field). */
  const keyFocused = (i: number) => document.activeElement === cards[i] && cards[i].matches(':focus-visible');
  const sOf = (i: number) => {
    const raw = i - offset;
    return ((((raw - S_MIN) % N) + N) % N) + S_MIN;
  };
  const visible = (s: number) => s > -EXIT_GONE + 0.1 && s < G.visMax + 0.02;

  // ---- drawing -----------------------------------------------------------------------------
  const last: string[] = [];
  const place = () => {
    if (still) return;
    const { S, fy, rise, wide } = G;
    for (let i = 0; i < N; i++) {
      const s = sOf(i);
      const k = kOf(s);
      const x = xAt(s);
      let y: number;
      let turn: number;
      let skew: number;
      let o: number;
      let blur: number;
      let z: number;
      if (s >= 0) {
        const far = 1 - k; // 0 at the focal zone, toward 1 far away
        // The field bends upward into the distance: level near the focal zone, rising
        // faster as it recedes, each card turned toward the reader and leaning with it.
        y = fy - S * rise * Math.pow(far, 1.6);
        turn = 38 * Math.min(1, far / 0.72);
        skew = -6 * Math.pow(far, 1.2);
        o = Math.max(0.5, 1 - 0.085 * s);
        blur = Math.min(2.2, 0.8 * s);
        z = 100 - Math.round(s * 10);
      } else {
        const back = Math.min(1, -s);
        y = fy + S * 0.09 * back;
        turn = -24 * back;
        skew = 2 * back;
        o = Math.max(0, 1 + s / EXIT_GONE);
        blur = Math.min(2.4, -1.8 * s);
        z = 92 + Math.round(s * 10);
      }
      if (i === ringI && s > -EXIT_GONE) {
        o = Math.max(o, 0.95);
        blur = 0;
        z = 120;
      }
      const tx = (x - S / 2).toFixed(1);
      const ty = (y - S / 2).toFixed(1);
      const tf = `translate3d(${tx}px, ${ty}px, 0) perspective(${Math.round(S * 4)}px) rotateY(${turn.toFixed(2)}deg) skewY(${skew.toFixed(2)}deg) scale(${k.toFixed(4)})`;
      const key = `${tf}|${o.toFixed(3)}|${wide ? blur.toFixed(2) : 0}|${z}`;
      if (last[i] === key) continue;
      last[i] = key;
      const el = items[i];
      el.style.transform = tf;
      el.style.opacity = o.toFixed(3);
      el.style.filter = wide && blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
      el.style.zIndex = String(z);
      el.style.visibility = o <= 0.001 ? 'hidden' : '';
    }
  };

  // ---- who is shown -------------------------------------------------------------------------
  const nearest = () => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const d = Math.abs(sOf(i));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  const show = () => {
    const a = still ? selected : nearest();
    if (a !== activeI) {
      if (activeI >= 0) items[activeI].removeAttribute('data-active');
      activeI = a;
      items[a].setAttribute('data-active', '');
      for (let i = 0; i < N; i++) cards[i].setAttribute('aria-current', String(i === a));
    }
    const ring = still ? selected : pinI >= 0 ? pinI : focusI >= 0 ? focusI : hoverI;
    if (ring !== ringI) {
      if (ringI >= 0) items[ringI].removeAttribute('data-shown');
      ringI = ring;
      if (ring >= 0) items[ring].setAttribute('data-shown', '');
      for (let i = 0; i < N; i++) last[i] = '';
    }
    const sh = still ? selected : ring >= 0 ? ring : glide ? glide.target : a;
    if (sh !== shownI) {
      shownI = sh;
      blocks.forEach((b, i) => b.classList.toggle('is-on', i === sh));
      root.dataset.shown = String(sh);
    }
  };

  // ---- the clock ----------------------------------------------------------------------------
  const running = () =>
    !still && inView && !document.hidden && !userPaused && hoverI < 0 && focusI < 0 && pinI < 0 && !drag && !glide && performance.now() >= holdUntil;
  const tick = (t: number) => {
    raf = 0;
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0;
    lastT = t;
    if (pinI >= 0 && holdUntil && t >= holdUntil && !keyFocused(pinI)) {
      // A tap's hold has run out (a creator that has keyboard focus stays shown).
      pinI = -1;
      holdUntil = 0;
    }
    if (glide) {
      const p = Math.min(1, (t - glide.t0) / glide.dur);
      offset = glide.from + (glide.to - glide.from) * ease3(p);
      speed = 0;
      if (p >= 1) glide = null;
    } else if (Math.abs(inertia) > 0.01 && !drag) {
      offset += inertia * dt;
      inertia *= Math.exp(-dt * 3.2);
      if (Math.abs(inertia) <= 0.01) inertia = 0;
    } else if (!drag) {
      const target = running() ? 1 / STEP_SECONDS : 0;
      // Eases to a stop, or sets off again, over about half a second.
      speed += (target - speed) * Math.min(1, dt * 3.5);
      if (target === 0 && speed < 1e-4) speed = 0;
      offset += speed * dt;
    }
    place();
    show();
    render();
    const waiting = holdUntil > t && inView && !document.hidden;
    if (glide || drag || inertia || speed > 0 || running() || waiting) raf = requestAnimationFrame(tick);
    else lastT = 0;
  };
  const run = () => {
    if (!raf && !still) {
      lastT = 0;
      raf = requestAnimationFrame(tick);
    }
  };

  /** Forward only: the field moves on until creator i is d creators further along. */
  const glideBy = (i: number, d: number) => {
    if (d <= 0.02) return;
    glide = { from: offset, to: offset + d, t0: performance.now(), dur: clamp(500 + 300 * d, 650, 2200), target: i };
    run();
  };
  /** Selecting a creator still approaching brings them forward to the focal zone. */
  const bringForward = (i: number) => {
    const s = sOf(i);
    if (s > 0.2) glideBy(i, s);
  };
  /** A creator focused out of sight comes into view along the path (never backward). */
  const reveal = (i: number) => {
    const s = sOf(i);
    if (visible(s)) return;
    const ahead = s < 0 ? s + N : s;
    glideBy(i, ahead - Math.min(2.5, Math.max(0.5, G.visMax - 0.6)));
  };

  // ---- the reader -----------------------------------------------------------------------------
  const select = (i: number, touch: boolean) => {
    if (still) {
      selected = i;
      show();
      return;
    }
    pinI = i;
    holdUntil = touch ? performance.now() + 6000 : 0;
    bringForward(i);
    show();
    run();
  };
  cards.forEach((card, i) => {
    card.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch' || still) return;
      hoverI = i;
      show();
      run();
    });
    // Only a creator under the pointer holds the field: off the portrait (even within the field) it sets off again.
    card.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'touch' || hoverI !== i) return;
      hoverI = -1;
      show();
      run();
    });
    card.addEventListener('click', (e) => {
      if (performance.now() < quietClick) {
        e.preventDefault();
        return;
      }
      const touch = (e as PointerEvent).pointerType === 'touch' || (e.detail > 0 && !window.matchMedia('(hover: hover)').matches);
      select(i, touch);
    });
    card.addEventListener('focus', () => {
      if (!card.matches(':focus-visible')) return;
      if (still) {
        selected = i;
        show();
        return;
      }
      focusI = i;
      // Keyboard focus on another creator takes over from an earlier selection.
      if (pinI >= 0 && pinI !== i) {
        pinI = -1;
        holdUntil = 0;
      }
      reveal(i);
      show();
      run();
    });
  });
  field.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    hoverI = -1;
    if (pinI >= 0 && !keyFocused(pinI)) pinI = -1;
    show();
    run();
  });
  track.addEventListener('focusout', (e) => {
    if (track.contains(e.relatedTarget as Node | null)) return;
    focusI = -1;
    if (pinI >= 0 && !holdUntil) pinI = -1;
    show();
    run();
  });

  // Touch: the field follows a sideways swipe, then carries on a little and sets off again.
  field.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || still) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, off0: offset, moved: false, lastX: e.clientX, lastT: performance.now(), v: 0 };
  });
  field.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.moved) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        drag.moved = true;
        glide = null;
        inertia = 0;
        pinI = -1;
        try {
          field.setPointerCapture(e.pointerId);
        } catch {
          /* not capturable */
        }
      } else if (Math.abs(dy) > 10) {
        drag = null;
        return;
      } else return;
    }
    const now = performance.now();
    const unit = Math.max(1, G.unit);
    offset = drag.off0 - dx / unit;
    const dtm = Math.max(1, now - drag.lastT);
    drag.v = 0.7 * drag.v + 0.3 * ((-(e.clientX - drag.lastX) / unit) * (1000 / dtm));
    drag.lastX = e.clientX;
    drag.lastT = now;
    run();
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) {
      inertia = clamp(drag.v, -3, 3);
      holdUntil = performance.now() + 1500;
      quietClick = performance.now() + 350;
    }
    drag = null;
    run();
  };
  field.addEventListener('pointerup', endDrag);
  field.addEventListener('pointercancel', endDrag);

  // ---- the pause control ----------------------------------------------------------------------
  const render = () => {
    if (!toggle) return;
    const playing = !still && !userPaused;
    const state = playing ? 'playing' : 'paused';
    if (toggle.dataset.state === state) return;
    toggle.dataset.state = state;
    toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'}: creator network`);
    if (toggleText) toggleText.textContent = playing ? 'Pause' : 'Play';
  };
  toggle?.addEventListener('click', () => {
    userPaused = !userPaused;
    render();
    run();
  });

  // ---- modes and observers ----------------------------------------------------------------------
  const setMode = () => {
    still = reduced();
    root.classList.toggle('is-still', still);
    if (toggle) toggle.hidden = still;
    for (let i = 0; i < N; i++) {
      last[i] = '';
      if (still) {
        const el = items[i];
        el.style.transform = '';
        el.style.opacity = '';
        el.style.filter = '';
        el.style.zIndex = '';
        el.style.visibility = '';
      }
    }
    if (still) {
      glide = null;
      inertia = 0;
      speed = 0;
      // The gallery starts on the creator the field was showing.
      selected = shownI >= 0 ? shownI : 0;
      hoverI = focusI = pinI = -1;
    } else {
      measure();
    }
    activeI = -1;
    shownI = -1;
    place();
    show();
    render();
    run();
  };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      run();
    }).observe(field);
  } else {
    inView = true;
  }
  document.addEventListener('visibilitychange', run);
  onMotionChange(setMode);
  let rt = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(() => {
      if (still) return;
      measure();
      for (let i = 0; i < N; i++) last[i] = '';
      place();
    }, 100);
  });
  wideMq.addEventListener?.('change', () => {
    if (!still) {
      measure();
      for (let i = 0; i < N; i++) last[i] = '';
      place();
    }
  });
  root.dataset.ready = '';
  setMode();
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
  document.addEventListener('visibilitychange', sync);
  onMotionChange(sync);
  for (const v of videos.values()) v.addEventListener('timeupdate', mark);
  root.dataset.ready = '';
  select(active);
  render();
}
