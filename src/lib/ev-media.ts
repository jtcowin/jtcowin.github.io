/**
 * Client-side media and motion for Events and Multimedia Production (V1.1).
 *
 * The program (the hero's monitor): three reels, one video each, only the
 * active one loaded and playing, muted. Q01 is on first; a reel plays through
 * once and the program crossfades (350ms) to the next, round and round; a reel
 * the reader picks starts from its beginning, plays through, and then the
 * program carries on from it. Only the active reel plays: the one left behind
 * pauses once it is covered. The program pauses whenever the monitor leaves
 * the screen or the tab is hidden, never starts for reduced motion or a
 * data-saving preference (the posters stay, and its control plays it on
 * request), and its control pauses and plays it.
 *
 * Players (every video with sound): the poster and one "Play with sound"
 * button; nothing but the poster loads until the button is pressed (or the
 * frame comes near the screen, when only the file's index is read for its
 * length). Once started: pause or play, mute or unmute, a seek bar that works
 * with arrow keys, and the time. Only one player sounds at a time: starting
 * one with sound pauses every other, and a player that leaves the screen
 * pauses and waits for the reader. An ambient player (V1.1, Sui Fest) is muted
 * by default: it plays silently while well in view, with motion allowed, and
 * offers "Sound on" and its own pause; turning the sound on hands it to the
 * reader with the full controls. The native controls in the markup serve
 * readers without JavaScript and are removed here.
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
export const saving = () => lessDataMq.matches || Boolean((navigator as Navigator & { connection?: NetworkInformation }).connection?.saveData);
export const reducedMotion = () => reduceMq.matches;
export const onMotionChange = (fn: () => void) => reduceMq.addEventListener?.('change', fn);

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
const quietOthers = (video: HTMLVideoElement) => {
  for (const other of sounding) if (other !== video && !other.paused && !other.muted) other.pause();
};
export function exclusive(video: HTMLVideoElement) {
  sounding.add(video);
  // A video that starts with sound, or turns its sound on while playing, pauses every other one with sound.
  video.addEventListener('play', () => {
    if (!video.muted) quietOthers(video);
  });
  video.addEventListener('volumechange', () => {
    if (!video.muted && !video.paused) quietOthers(video);
  });
}

// ---- the program -------------------------------------------------------------------------
const FADE = 350;

export class Program {
  private root: HTMLElement;
  private sources = new Map<string, HTMLVideoElement>();
  private layers = new Map<string, HTMLElement>();
  private buttons = new Map<string, HTMLButtonElement>();
  private order: string[] = [];
  private active: string;
  private held = false; // the reader paused the program
  private blocked = false; // the browser refused to start it
  private asked = false; // the reader pressed play: it plays even for reduced motion
  private inView = false;
  private raf = 0;
  private fade = 0;
  private leaving = '';
  private toggle: HTMLButtonElement | null;
  private cueQ: HTMLElement | null;
  private cueLabel: HTMLElement | null;
  private tc: HTMLElement | null;
  private lastTc = '';

  constructor(root: HTMLElement) {
    this.root = root;
    for (const v of Array.from(root.querySelectorAll<HTMLVideoElement>('video[data-cue]'))) {
      const key = v.dataset.cue as string;
      this.sources.set(key, v);
      const layer = v.closest<HTMLElement>('[data-cue-layer]');
      if (layer) this.layers.set(key, layer);
      this.order.push(key);
      v.removeAttribute('controls');
      v.muted = true;
      v.loop = false;
      // At the end of a reel the program moves on, whether the reel was the program's or the reader's.
      v.addEventListener('ended', () => {
        if (key === this.active) this.next();
      });
      v.addEventListener('playing', () => this.render());
      v.addEventListener('pause', () => this.render());
      v.addEventListener('error', () => layer?.setAttribute('data-failed', ''));
    }
    for (const b of Array.from(root.querySelectorAll<HTMLButtonElement>('[data-cue-btn]'))) {
      const key = b.dataset.cueBtn as string;
      this.buttons.set(key, b);
      b.addEventListener('click', () => this.pick(key));
    }
    this.toggle = root.querySelector('[data-program-toggle]');
    this.cueQ = root.querySelector('[data-program-q]');
    this.cueLabel = root.querySelector('[data-program-label]');
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
    this.show(this.active, true);

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
    onMotionChange(() => this.sync());
  }

  private video() {
    return this.sources.get(this.active) ?? null;
  }

  private autoplay() {
    return !reduceMq.matches && !saving() && !this.blocked;
  }

  /** The reader picks a reel: it starts from its beginning (the one on air simply plays on). */
  pick(key: string) {
    this.held = false;
    this.blocked = false;
    if (key === this.active) {
      this.sync();
      this.render();
      return;
    }
    this.show(key);
  }

  /** Put a reel on air: the incoming reel crossfades in over the outgoing one. */
  private show(key: string, first = false) {
    const prev = this.active;
    this.active = key;
    this.root.dataset.active = key;
    const into = this.layers.get(key);
    // An earlier crossfade still running finishes at once.
    window.clearTimeout(this.fade);
    if (this.leaving && this.leaving !== key) this.retire(this.leaving);
    this.leaving = '';
    // The reel on air is on top (is-in); the one it replaces stays visible
    // beneath it until the fade has covered it.
    for (const [k, l] of this.layers) {
      l.classList.toggle('is-in', k === key);
      if (k !== key && k !== prev) l.classList.remove('is-on');
    }
    into?.classList.add('is-on');
    if (!first && prev !== key) {
      this.leaving = prev;
      this.fade = window.setTimeout(() => {
        if (this.leaving === prev) this.retire(prev);
        this.leaving = '';
      }, FADE + 20);
    }
    const v = this.video();
    if (v && !first) {
      try {
        v.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
    }
    for (const [k, b] of this.buttons) b.setAttribute('aria-pressed', String(k === key));
    const b = this.buttons.get(key);
    if (this.cueQ) this.cueQ.textContent = b?.dataset.q ?? '';
    if (this.cueLabel) this.cueLabel.textContent = b?.dataset.label ?? key;
    this.progress(key, 0);
    this.sync();
    this.render();
  }

  /** The reel left behind: hidden beneath, paused, and back to its beginning for next time. */
  private retire(key: string) {
    if (key === this.active) return;
    this.layers.get(key)?.classList.remove('is-on');
    const old = this.sources.get(key);
    if (old) {
      if (!old.paused) old.pause();
      try {
        old.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
    }
    this.progress(key, 0);
  }

  /** At the end of a reel: the next one. */
  private next() {
    const i = this.order.indexOf(this.active);
    this.show(this.order[(i + 1) % this.order.length]);
  }

  private play() {
    const v = this.video();
    if (!v) return;
    if (v.preload !== 'auto') v.preload = 'auto';
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
    // Only the reel on air plays (the outgoing one only until it is covered).
    for (const [k, other] of this.sources) if (k !== this.active && k !== this.leaving && !other.paused) other.pause();
    if (!go && this.leaving) {
      const left = this.sources.get(this.leaving);
      if (left && !left.paused) left.pause();
    }
    this.loop();
  }

  private progress(key: string, share: number) {
    const b = this.buttons.get(key);
    const bar = b?.querySelector<HTMLElement>('[data-cue-progress]');
    if (bar) bar.style.transform = `scaleX(${share.toFixed(4)})`;
  }

  /** The active reel's progress line and the timecode, while it plays. */
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
          // A few seconds before the end, the next reel starts to load.
          if (d - cur.currentTime < 3) {
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
      this.toggle.setAttribute('aria-label', playing ? (this.toggle.dataset.pause ?? 'Pause') : (this.toggle.dataset.play ?? 'Play'));
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
  private sound: HTMLButtonElement | null;
  private hold: HTMLButtonElement | null;
  private ambient: boolean;
  private started = false;
  private seeking = false;
  private heldAmbient = false; // the reader paused the silent play
  private inView = false;

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
    this.sound = q<HTMLButtonElement>('[data-evp-sound]');
    this.hold = q<HTMLButtonElement>('[data-evp-hold]');
    this.ambient = root.hasAttribute('data-ambient');
    const { video } = this;
    if (!video) return;
    video.removeAttribute('controls');
    root.classList.add('is-enhanced');
    exclusive(video);

    this.start?.addEventListener('click', () => this.begin());
    // The poster itself starts it too, for a pointer.
    q<HTMLElement>('[data-evp-surface]')?.addEventListener('click', () => {
      if (this.started) this.flip();
      else if (this.ambient && !video.paused) this.holdAmbient(true);
      else if (this.ambient && this.heldAmbient) this.holdAmbient(false);
      else this.begin();
    });
    this.toggle?.addEventListener('click', () => this.flip());
    this.mute?.addEventListener('click', () => {
      video.muted = !video.muted;
      this.render();
    });
    // Sound on: the reader takes it over, from where it is, with sound.
    this.sound?.addEventListener('click', () => this.begin());
    this.hold?.addEventListener('click', () => this.holdAmbient(!video.paused));
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

    if (this.ambient) {
      video.muted = true;
      video.loop = true;
    }

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
      // Off screen, it pauses and waits for the reader; an ambient player plays
      // silently again once it is well in view.
      new IntersectionObserver(
        ([entry]) => {
          const r = entry.isIntersecting ? entry.intersectionRatio : 0;
          if (r >= 0.5) this.inView = true;
          else if (r < 0.2) this.inView = false;
          if (r < 0.2 && !video.paused) video.pause();
          this.ambientSync();
        },
        { threshold: [0, 0.2, 0.5] },
      ).observe(root);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !video.paused) video.pause();
      else this.ambientSync();
    });
    onMotionChange(() => this.ambientSync());
    this.render();
  }

  /** An ambient player plays, muted, while well in view, until the reader takes it over or pauses it. */
  private ambientSync() {
    if (!this.ambient || this.started) return;
    const { video } = this;
    const go = this.inView && !document.hidden && !this.heldAmbient && !reduceMq.matches && !saving();
    if (go && video.paused) {
      video.muted = true;
      if (video.preload !== 'auto') video.preload = 'auto';
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => this.render());
    } else if (!go && !video.paused) video.pause();
  }

  private holdAmbient(hold: boolean) {
    this.heldAmbient = hold;
    if (hold) this.video.pause();
    else {
      this.inView = true;
      const p = this.video.play();
      if (p && typeof p.catch === 'function') p.catch(() => this.render());
    }
    this.render();
  }

  /** Start with sound (the reader's gesture allows it), from where it is unless a moment is given. */
  begin(at?: number) {
    const { video } = this;
    const focused = document.activeElement === this.start || document.activeElement === this.sound;
    this.started = true;
    this.root.classList.add('is-started');
    video.muted = false;
    video.loop = false;
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
    if (video.paused) {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => this.render());
    }
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
    const quiet = this.ambient && !this.started;
    const state = video.ended ? 'ended' : quiet ? (video.paused ? (this.heldAmbient ? 'held' : 'idle') : 'ambient') : video.paused ? (this.started ? 'paused' : 'idle') : 'playing';
    root.dataset.state = state;
    const silent = quiet && (state === 'ambient' || state === 'held');
    if (this.start) this.start.hidden = this.started || silent;
    if (this.sound) this.sound.hidden = !silent;
    if (this.hold) {
      this.hold.hidden = !silent;
      this.hold.dataset.state = state === 'ambient' ? 'playing' : 'paused';
      this.hold.setAttribute('aria-label', `${state === 'ambient' ? 'Pause' : 'Play'}: ${root.dataset.label ?? 'video'}`);
    }
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
    onMotionChange(sync);
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
