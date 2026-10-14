/**
 * Client-side media and motion for Events and Multimedia Production (V1.0).
 *
 * The program (the hero's monitor): one video per source, only the active one
 * loaded and playing, muted. A source plays through once and the program cuts
 * to the next, like a live switcher, until the reader picks a source; from
 * then on that source loops and the program stays on it. The program pauses
 * whenever the monitor leaves the screen or the tab is hidden, never starts
 * for reduced motion or a data-saving preference (the posters stay, and its
 * control plays it on request), and its control pauses and plays it.
 *
 * Players (every video with sound): the poster and one "Play with sound"
 * button; nothing but the poster loads until the button is pressed (or the
 * frame comes near the screen, when only the file's index is read for its
 * length). Once started: pause or play, mute or unmute, a seek bar that works
 * with arrow keys, and the time. Only one player sounds at a time: starting
 * one pauses every other, and a player that leaves the screen pauses and
 * waits for the reader. The native controls in the markup serve readers
 * without JavaScript and are removed here.
 *
 * Silent loops (a media slot's video, such as the activation kit's screen
 * animation once it is approved): muted and looped only while well in view,
 * never for reduced motion or a data-saving preference, with a pause control.
 *
 * Reveals: elements marked [data-ev-reveal] arrive once as they come into
 * view (a short cut up into place); with reduced motion they are simply there.
 */

const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
const lessDataMq = window.matchMedia('(prefers-reduced-data: reduce)');
type NetworkInformation = { saveData?: boolean };
const saving = () => lessDataMq.matches || Boolean((navigator as Navigator & { connection?: NetworkInformation }).connection?.saveData);
export const reducedMotion = () => reduceMq.matches;

const pad = (n: number, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, '0');
/** 83.4 -> "1:23" */
export const clock = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${pad(s % 60)}` : '0:00');
/** Broadcast timecode at 24 frames a second: "00:01:23:10". */
export const timecode = (s: number) => {
  const t = Math.max(0, s || 0);
  return `${pad(t / 3600)}:${pad((t / 60) % 60)}:${pad(t % 60)}:${pad((t % 1) * 24)}`;
};

// ---- one sound at a time -----------------------------------------------------------------
const sounding = new Set<HTMLVideoElement>();
export function exclusive(video: HTMLVideoElement) {
  sounding.add(video);
  video.addEventListener('play', () => {
    for (const other of sounding) if (other !== video && !other.paused) other.pause();
  });
}

// ---- the program -------------------------------------------------------------------------
export class Program {
  private root: HTMLElement;
  private sources = new Map<string, HTMLVideoElement>();
  private buttons = new Map<string, HTMLButtonElement>();
  private order: string[] = [];
  private active: string;
  private chosen = false; // the reader picked a source: it loops, no more cuts
  private held = false; // the reader paused the program
  private blocked = false; // the browser refused to start it
  private asked = false; // the reader pressed play: it plays even for reduced motion
  private inView = false;
  private raf = 0;
  private toggle: HTMLButtonElement | null;
  private cueText: HTMLElement | null;
  private tc: HTMLElement | null;
  private lastTc = '';

  constructor(root: HTMLElement) {
    this.root = root;
    for (const v of Array.from(root.querySelectorAll<HTMLVideoElement>('video[data-cue]'))) {
      const key = v.dataset.cue as string;
      this.sources.set(key, v);
      this.order.push(key);
      v.removeAttribute('controls');
      v.muted = true;
      v.addEventListener('ended', () => this.next());
      v.addEventListener('playing', () => this.render());
      v.addEventListener('pause', () => this.render());
      v.addEventListener('error', () => v.closest('[data-cue-layer]')?.setAttribute('data-failed', ''));
    }
    for (const b of Array.from(root.querySelectorAll<HTMLButtonElement>('[data-cue-btn]'))) {
      const key = b.dataset.cueBtn as string;
      this.buttons.set(key, b);
      b.addEventListener('click', () => {
        this.chosen = true;
        this.held = false;
        this.blocked = false;
        this.select(key);
      });
    }
    this.toggle = root.querySelector('[data-program-toggle]');
    this.cueText = root.querySelector('[data-program-cue]');
    this.tc = root.querySelector('[data-program-tc]');
    this.toggle?.addEventListener('click', () => {
      const v = this.video();
      if (!v) return;
      if (v.paused) {
        this.held = false;
        this.blocked = false;
        this.asked = true;
        this.inView = true;
        this.play();
      } else {
        this.held = true;
        v.pause();
      }
      this.render();
    });
    this.active = root.dataset.default && this.sources.has(root.dataset.default) ? root.dataset.default : this.order[0];
    this.select(this.active, true);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        ([entry]) => {
          const r = entry.isIntersecting ? entry.intersectionRatio : 0;
          if (r >= 0.35) this.inView = true;
          else if (r < 0.15) this.inView = false;
          this.sync();
        },
        { threshold: [0, 0.15, 0.35] },
      ).observe(root);
    } else {
      this.inView = true;
    }
    document.addEventListener('visibilitychange', () => this.sync());
    reduceMq.addEventListener?.('change', () => this.sync());
  }

  private video() {
    return this.sources.get(this.active) ?? null;
  }

  private autoplay() {
    return !reduceMq.matches && !saving() && !this.blocked;
  }

  /** Cut to a source. */
  select(key: string, first = false) {
    const prev = this.active;
    this.active = key;
    const index = this.order.indexOf(key);
    this.root.dataset.active = key;
    for (const [k, v] of this.sources) {
      const layer = v.closest<HTMLElement>('[data-cue-layer]');
      layer?.classList.toggle('is-on', k === key);
      if (k === key) {
        v.loop = this.chosen;
        if (v.preload !== 'auto' && (this.autoplay() || this.asked)) v.preload = 'auto';
      } else if (!v.paused) v.pause();
    }
    for (const [k, b] of this.buttons) b.setAttribute('aria-pressed', String(k === key));
    if (this.cueText) {
      const b = this.buttons.get(key);
      this.cueText.textContent = `Cue ${pad(index + 1)} · ${b?.dataset.label ?? key}`;
    }
    // The source left behind starts from its beginning next time.
    if (!first && prev !== key) {
      const old = this.sources.get(prev);
      if (old) {
        window.setTimeout(() => {
          if (this.active !== prev) {
            try {
              old.currentTime = 0;
            } catch {
              /* not seekable yet */
            }
            this.progress(prev, 0);
          }
        }, 260);
      }
    }
    const v = this.video();
    if (v && !first) {
      try {
        v.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
    }
    this.sync();
    this.render();
  }

  /** At the end of a source: the next one, unless the reader chose this one. */
  private next() {
    if (this.chosen) return;
    const i = this.order.indexOf(this.active);
    this.select(this.order[(i + 1) % this.order.length]);
  }

  private play() {
    const v = this.video();
    if (!v) return;
    const p = v.play();
    if (p && typeof p.catch === 'function') {
      p.catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'NotAllowedError') this.blocked = true;
        this.render();
      });
    }
  }

  private sync() {
    const v = this.video();
    if (!v) return;
    const go = !document.hidden && this.inView && !this.held && (this.autoplay() || this.asked);
    if (go && v.paused) this.play();
    else if (!go && !v.paused) v.pause();
    this.loop();
  }

  private progress(key: string, share: number) {
    const b = this.buttons.get(key);
    const bar = b?.querySelector<HTMLElement>('[data-cue-progress]');
    if (bar) bar.style.transform = `scaleX(${share.toFixed(4)})`;
  }

  /** The active source's progress line and the timecode, while it plays. */
  private loop() {
    const v = this.video();
    const playing = v && !v.paused;
    if (playing && !this.raf) {
      const tick = () => {
        this.raf = 0;
        const cur = this.video();
        if (!cur || cur.paused) return;
        const d = cur.duration;
        if (d > 0) {
          this.progress(this.active, cur.currentTime / d);
          // A few seconds before the cut, the next source starts to load.
          if (!this.chosen && d - cur.currentTime < 3) {
            const nextKey = this.order[(this.order.indexOf(this.active) + 1) % this.order.length];
            const nv = this.sources.get(nextKey);
            if (nv && nv.preload !== 'auto') nv.preload = 'auto';
          }
        }
        const t = timecode(cur.currentTime);
        if (this.tc && t !== this.lastTc) {
          this.tc.textContent = t;
          this.lastTc = t;
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
  }

  private render() {
    const v = this.video();
    const playing = Boolean(v && !v.paused);
    this.root.classList.toggle('is-playing', playing);
    if (this.toggle) {
      this.toggle.setAttribute('aria-label', playing ? this.toggle.dataset.pause ?? 'Pause' : this.toggle.dataset.play ?? 'Play');
      this.toggle.dataset.state = playing ? 'playing' : 'paused';
    }
    if (playing) this.loop();
  }
}

// ---- players with sound --------------------------------------------------------------------
export class Player {
  readonly root: HTMLElement;
  readonly video: HTMLVideoElement;
  private start: HTMLButtonElement | null;
  private bar: HTMLElement | null;
  private toggle: HTMLButtonElement | null;
  private mute: HTMLButtonElement | null;
  private seek: HTMLInputElement | null;
  private time: HTMLElement | null;
  private started = false;
  private seeking = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.video = root.querySelector('video') as HTMLVideoElement;
    const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
    this.start = q<HTMLButtonElement>('[data-evp-start]');
    this.bar = q<HTMLElement>('[data-evp-bar]');
    this.toggle = q<HTMLButtonElement>('[data-evp-play]');
    this.mute = q<HTMLButtonElement>('[data-evp-mute]');
    this.seek = q<HTMLInputElement>('[data-evp-seek]');
    this.time = q<HTMLElement>('[data-evp-time]');
    const { video } = this;
    if (!video) return;
    video.removeAttribute('controls');
    root.classList.add('is-enhanced');
    exclusive(video);

    this.start?.addEventListener('click', () => this.begin());
    // The poster itself starts it too, for a pointer.
    q<HTMLElement>('[data-evp-surface]')?.addEventListener('click', () => {
      if (!this.started) this.begin();
      else this.flip();
    });
    this.toggle?.addEventListener('click', () => this.flip());
    this.mute?.addEventListener('click', () => {
      video.muted = !video.muted;
      this.render();
    });
    // The seek bar counts whole seconds: an arrow key moves one, Page Up and
    // Page Down a tenth of the film.
    this.seek?.addEventListener('input', () => {
      if (!this.seek) return;
      this.seeking = true;
      const d = video.duration;
      const t = Number(this.seek.value);
      video.currentTime = d > 0 ? Math.min(d, t) : t;
      this.render();
    });
    this.seek?.addEventListener('change', () => (this.seeking = false));
    for (const type of ['play', 'pause', 'volumechange', 'ended', 'loadedmetadata', 'durationchange'] as const) video.addEventListener(type, () => this.render());
    video.addEventListener('timeupdate', () => this.render());
    video.addEventListener('error', () => {
      root.setAttribute('data-failed', '');
      this.render();
    });

    if ('IntersectionObserver' in window) {
      // Read the file's index (for its length) once it is within a screen.
      const near = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          near.disconnect();
          if (video.preload === 'none' && !saving()) video.preload = 'metadata';
        },
        { rootMargin: '100% 0px' },
      );
      near.observe(root);
      // Off screen, it pauses and waits for the reader.
      new IntersectionObserver(
        ([entry]) => {
          if ((!entry.isIntersecting || entry.intersectionRatio < 0.2) && !video.paused) video.pause();
        },
        { threshold: [0, 0.2] },
      ).observe(root);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !video.paused) video.pause();
    });
    this.render();
  }

  /** Start with sound (the reader's gesture allows it). */
  begin(at?: number) {
    const { video } = this;
    const focused = document.activeElement === this.start;
    this.started = true;
    this.root.classList.add('is-started');
    video.muted = false;
    video.preload = 'auto';
    if (at !== undefined) {
      const go = () => {
        try {
          video.currentTime = at;
        } catch {
          /* not seekable yet */
        }
      };
      if (video.readyState >= 1) go();
      else video.addEventListener('loadedmetadata', go, { once: true });
    }
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => this.render());
    this.render();
    if (focused) this.toggle?.focus({ preventScroll: true });
  }

  private flip() {
    const { video } = this;
    if (video.ended) {
      video.currentTime = 0;
      void video.play();
    } else if (video.paused) void video.play();
    else video.pause();
  }

  private render() {
    const { video, root } = this;
    const state = video.ended ? 'ended' : video.paused ? (this.started ? 'paused' : 'idle') : 'playing';
    root.dataset.state = state;
    if (this.start) this.start.hidden = this.started;
    if (this.bar) this.bar.hidden = !this.started;
    if (this.toggle) {
      const label = state === 'playing' ? 'Pause' : state === 'ended' ? 'Replay' : 'Play';
      this.toggle.setAttribute('aria-label', `${label}: ${root.dataset.label ?? 'video'}`);
      this.toggle.dataset.state = state;
    }
    if (this.mute) {
      this.mute.setAttribute('aria-label', `${video.muted ? 'Unmute' : 'Mute'}: ${root.dataset.label ?? 'video'}`);
      this.mute.dataset.muted = String(video.muted);
    }
    const d = video.duration;
    if (this.seek && d > 0) {
      const max = String(Math.max(1, Math.floor(d)));
      if (this.seek.max !== max) this.seek.max = max;
      if (!this.seeking) this.seek.value = String(Math.floor(video.currentTime));
    }
    if (this.seek) this.seek.setAttribute('aria-valuetext', `${clock(video.currentTime)} of ${clock(d)}`);
    if (this.time) this.time.textContent = `${clock(video.currentTime)} / ${clock(d)}`;
  }
}

/** Every player on the page, by its root's id. */
export const players = new Map<string, Player>();
export function mountPlayers(scope: ParentNode = document) {
  for (const root of Array.from(scope.querySelectorAll<HTMLElement>('[data-evp]'))) {
    if (root.dataset.mounted) continue;
    root.dataset.mounted = '1';
    const p = new Player(root);
    if (root.id) players.set(root.id, p);
  }
}

// ---- silent loops ----------------------------------------------------------------------------
/**
 * A silent loop in a media slot (EvSlot.astro: the activation kit's screen
 * animation, once approved). It sits on its poster and loads nothing until it
 * is well in view (half of it), then plays muted and looped; it pauses as it
 * leaves (under a fifth in view) or when the tab is hidden. Reduced motion
 * and a data-saving preference keep the poster, and its control plays it on
 * request; the reader's pause holds until they play it again.
 */
export function mountLoops(scope: ParentNode = document) {
  for (const root of Array.from(scope.querySelectorAll<HTMLElement>('[data-ev-loop]'))) {
    if (root.dataset.mounted) continue;
    root.dataset.mounted = '1';
    const video = root.querySelector('video');
    if (!video) continue;
    const toggle = root.querySelector<HTMLButtonElement>('[data-ev-loop-toggle]');
    const label = root.dataset.label ?? 'animation';
    let held = false; // the reader paused it
    let asked = false; // the reader played it: it plays even for reduced motion
    let inView = !('IntersectionObserver' in window);
    const render = () => {
      const playing = !video.paused;
      root.classList.toggle('is-playing', playing);
      if (toggle) {
        toggle.dataset.state = playing ? 'playing' : 'paused';
        toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'}: ${label}`);
      }
    };
    const sync = () => {
      const go = inView && !held && !document.hidden && (asked || (!reduceMq.matches && !saving()));
      if (go && video.paused) {
        if (video.preload !== 'auto') video.preload = 'auto';
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => render());
      } else if (!go && !video.paused) video.pause();
    };
    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener('click', () => {
        if (video.paused) {
          held = false;
          asked = true;
          inView = true;
          sync();
        } else {
          held = true;
          video.pause();
        }
      });
    }
    video.addEventListener('play', render);
    video.addEventListener('pause', render);
    video.addEventListener('error', () => root.setAttribute('data-failed', ''));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        ([entry]) => {
          const r = entry.isIntersecting ? entry.intersectionRatio : 0;
          if (r >= 0.5) inView = true;
          else if (r < 0.2) inView = false;
          sync();
        },
        { threshold: [0, 0.2, 0.5] },
      ).observe(root);
    }
    document.addEventListener('visibilitychange', sync);
    reduceMq.addEventListener?.('change', sync);
    render();
  }
}

// ---- reveals ------------------------------------------------------------------------------------
export function mountReveals(scope: ParentNode = document) {
  const els = Array.from(scope.querySelectorAll<HTMLElement>('[data-ev-reveal]'));
  if (!els.length) return;
  if (!('IntersectionObserver' in window) || reduceMq.matches) {
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
    { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
  );
  for (const el of els) io.observe(el);
}
