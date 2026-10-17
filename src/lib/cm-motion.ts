/**
 * Client-side motion for Creator Marketing and Partnerships (V1.0).
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
 * Montage: the format on screen is marked in the list beside the reel, from
 * the reel's own clock and the cut times in creator.json.
 *
 * Reveals: elements marked [data-cm-reveal] arrive once as they come into
 * view; with reduced motion they are simply there.
 */

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

// ---- montage ----------------------------------------------------------------------------------
type Cut = { at: number; format: string; place: string };

export function mountMontage() {
  const root = document.querySelector<HTMLElement>('[data-cm-montage]');
  const video = root?.querySelector<HTMLVideoElement>('[data-cmm-video]');
  if (!root || !video) return;
  let cuts: Cut[] = [];
  try {
    cuts = (JSON.parse(root.dataset.cuts ?? '[]') as Cut[]).sort((a, b) => a.at - b.at);
  } catch {
    return;
  }
  if (!cuts.length) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-format]'));
  const fmt = root.querySelector<HTMLElement>('[data-cmm-format]');
  const place = root.querySelector<HTMLElement>('[data-cmm-place]');
  const labels = new Map(items.map((el) => [el.dataset.format as string, el.textContent?.trim() ?? '']));
  let shown = -1;
  const mark = () => {
    const t = video.currentTime || 0;
    let k = 0;
    for (let i = 0; i < cuts.length; i++) if (t >= cuts[i].at) k = i;
    if (k === shown) return;
    shown = k;
    const c = cuts[k];
    for (const el of items) el.toggleAttribute('data-on', el.dataset.format === c.format);
    if (fmt) fmt.textContent = labels.get(c.format) ?? c.format;
    if (place) place.textContent = c.place;
  };
  video.addEventListener('timeupdate', mark);
  video.addEventListener('seeked', mark);
  mark();
}
