/**
 * The activation render's two screens (Events, V1.1).
 *
 * The figure shows the static render (both screens on their poster frames)
 * until a screen that can play its loops brings it near: from 48rem wide,
 * with motion allowed and no data-saving preference. Then the live layers
 * load (the room with its screens dark, the projection's mask, the screens'
 * light on the room, the two videos), each video is mapped onto its corners
 * in the render with a perspective transform, and the layers fade in over the
 * still: the same composition, now moving. The loops play, muted and inline,
 * only while the frame is well in view and the tab is visible; the pause
 * control holds them. The light each screen throws on the room follows the
 * brightness of what it shows (measured from the loops when the render was
 * made, so nothing is read from the video while it plays).
 */
import { reducedMotion, saving, onMotionChange } from './ev-media';

type Pt = [number, number];
type Quads = { tv: Pt[]; wall: Pt[] };
type Glow = { rate: number; spill: { tv: number; wall: number; floor: number }; lum: { tv: number[]; wall: number[] } };

/**
 * A CSS matrix3d mapping an element of w by h (its origin at its top-left
 * corner) onto the quad (top-left, top-right, bottom-right, bottom-left).
 */
export function quadMatrix(w: number, h: number, q: Pt[]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = den ? (dx3 * dy2 - dx2 * dy3) / den : 0;
  const k = den ? (dx1 * dy3 - dx3 * dy1) / den : 0;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + k * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + k * y3;
  // unit square to quad, after the element's own box to the unit square
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(9)).join(',')})`;
}

export function mountActivation(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('[data-ev-stage]');
  const live = root.querySelector<HTMLElement>('[data-ev-live]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-ev-stage-toggle]');
  if (!stage || !live) return;
  const quads = JSON.parse(stage.dataset.quads ?? '{}') as Quads;
  const glow = JSON.parse(stage.dataset.glow ?? '{}') as Glow;
  const screens = {
    tv: live.querySelector<HTMLVideoElement>('[data-screen="tv"]'),
    wall: live.querySelector<HTMLVideoElement>('[data-screen="wall"]'),
  };
  const spills = {
    tv: live.querySelector<HTMLElement>('[data-spill="tv"]'),
    wall: live.querySelector<HTMLElement>('[data-spill="wall"]'),
  };
  const videos = [screens.tv, screens.wall].filter(Boolean) as HTMLVideoElement[];
  const wide = window.matchMedia('(min-width: 48rem)');
  const able = () => wide.matches && !reducedMotion() && !saving();

  let on = false; // the live layers are in place
  let near = false;
  let inView = false;
  let held = false; // the reader paused the screens
  let raf = 0;

  const place = () => {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    for (const key of ['tv', 'wall'] as const) {
      const v = screens[key];
      const q = quads[key];
      if (!v || !q) continue;
      const w = v.offsetWidth || 960;
      const h = v.offsetHeight || (key === 'tv' ? 540 : 640);
      v.style.transform = quadMatrix(w, h, q.map(([x, y]) => [x * W, y * H] as Pt));
    }
  };

  const lumAt = (key: 'tv' | 'wall', t: number) => {
    const s = glow.lum?.[key];
    if (!s || !s.length) return 1;
    return s[Math.min(s.length - 1, Math.max(0, Math.floor(t * glow.rate)))];
  };
  const shine = () => {
    for (const key of ['tv', 'wall'] as const) {
      const v = screens[key];
      const el = spills[key];
      if (!v || !el) continue;
      const l = lumAt(key, v.currentTime || 0);
      el.style.opacity = (glow.spill[key] * (glow.spill.floor + (1 - glow.spill.floor) * l)).toFixed(3);
    }
  };
  const tick = () => {
    raf = 0;
    shine();
    if (videos.some((v) => !v.paused)) raf = requestAnimationFrame(tick);
  };

  const render = () => {
    const playing = videos.some((v) => !v.paused);
    stage.classList.toggle('is-playing', playing);
    if (toggle) {
      toggle.dataset.state = playing ? 'playing' : 'paused';
      toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'}: the activation’s screens`);
    }
    if (playing && !raf) raf = requestAnimationFrame(tick);
  };

  const sync = () => {
    if (!on) return;
    const go = inView && !held && !document.hidden && able();
    for (const v of videos) {
      if (go && v.paused) {
        if (v.preload !== 'auto') v.preload = 'auto';
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => render());
      } else if (!go && !v.paused) v.pause();
    }
    render();
  };

  const activate = async () => {
    if (on || !able()) return;
    on = true;
    live.hidden = false;
    place();
    shine();
    const imgs = Array.from(live.querySelectorAll<HTMLImageElement>('img'));
    await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));
    if (!on) return;
    stage.classList.add('is-live');
    if (toggle) toggle.hidden = false;
    sync();
  };

  const deactivate = () => {
    if (!on) return;
    on = false;
    for (const v of videos) if (!v.paused) v.pause();
    stage.classList.remove('is-live', 'is-playing');
    live.hidden = true;
    if (toggle) toggle.hidden = true;
  };

  const review = () => {
    if (!able()) deactivate();
    else if (near) void activate();
    sync();
  };

  toggle?.addEventListener('click', () => {
    held = videos.some((v) => !v.paused);
    if (!held) inView = true;
    sync();
  });
  for (const v of videos) {
    v.addEventListener('play', render);
    v.addEventListener('pause', render);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting;
        if (near) void activate();
      },
      { rootMargin: '60% 0px' },
    ).observe(stage);
    new IntersectionObserver(
      ([entry]) => {
        const r = entry.isIntersecting ? entry.intersectionRatio : 0;
        if (r >= 0.4) inView = true;
        else if (r < 0.15) inView = false;
        sync();
      },
      { threshold: [0, 0.15, 0.4] },
    ).observe(stage);
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => on && place()).observe(stage);
  else addEventListener('resize', () => on && place(), { passive: true });
  document.addEventListener('visibilitychange', sync);
  wide.addEventListener?.('change', review);
  onMotionChange(review);
}
