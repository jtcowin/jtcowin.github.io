/**
 * Client-side motion for the Technical Product Marketing page (Version 1).
 *
 * Scroll-linked stages. A stage is a tall container whose first child is
 * sticky; its progress runs from 0, when the container's top meets the top of
 * the screen, to 1, when its bottom meets the bottom of the screen. One
 * passive scroll listener and at most one animation frame per frame drive
 * every stage, and a stage far from the screen is skipped.
 *
 * The choreography is an enhancement for wide, tall-enough screens with
 * motion allowed. `live()` reports whether it applies, and each section adds
 * its own `is-live` class only then, so without JavaScript, with reduced
 * motion and on small or short screens every section reads in normal flow.
 *
 * Loops. A muted looping video sits on its poster and stays invisible until
 * its first frame is on screen, then fades in over it. It plays only while
 * its section wants it and it is in view; a hidden tab, reduced motion, a
 * data-saving preference or a refused autoplay leave the poster (the play
 * button still plays on request), and a video that cannot load keeps its
 * poster and loses its button.
 *
 * Walkthroughs. A muted recording that plays once: from its poster, the first
 * time its frame is well inside the viewport; paused whenever the frame
 * leaves the viewport and resumed when it returns; holding its last frame
 * once it ends. Its one control pauses, plays and, at the end, replays. The
 * same preferences and failures leave the poster, as for the loops.
 */

export const LIVE_QUERY = '(min-width: 60rem) and (min-height: 37.5rem) and (prefers-reduced-motion: no-preference)';

const liveMq = window.matchMedia(LIVE_QUERY);
const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
const lessDataMq = window.matchMedia('(prefers-reduced-data: reduce)');

export const live = () => liveMq.matches;
export const reducedMotion = () => reduceMq.matches;

export function onLiveChange(callback: () => void) {
  liveMq.addEventListener?.('change', callback);
}

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Progress through the window [a, b] of a larger progress, 0 to 1. */
export const span = (p: number, a: number, b: number) => (b <= a ? (p >= b ? 1 : 0) : clamp((p - a) / (b - a)));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);

// ---- Stages -----------------------------------------------------------------

type Update = (progress: number, rect: DOMRect, viewHeight: number) => void;
interface Stage {
  el: HTMLElement;
  update: Update;
  active: () => boolean;
}

const stages: Stage[] = [];
let raf = 0;

function tick() {
  raf = 0;
  const vh = window.innerHeight;
  for (const stage of stages) {
    if (!stage.active()) continue;
    const rect = stage.el.getBoundingClientRect();
    if (rect.bottom < -vh || rect.top > 2 * vh) continue;
    const run = rect.height - vh;
    const progress = run > 0 ? clamp(-rect.top / run) : rect.top <= 0 ? 1 : 0;
    stage.update(progress, rect, vh);
  }
}

export function schedule() {
  if (!raf) raf = requestAnimationFrame(tick);
}

export function addStage(el: HTMLElement, update: Update, active: () => boolean = live) {
  stages.push({ el, update, active });
  schedule();
}

window.addEventListener('scroll', schedule, { passive: true });
window.addEventListener('resize', schedule, { passive: true });

// ---- Loops ------------------------------------------------------------------

type Conn = { saveData?: boolean };
const saving = () => lessDataMq.matches || Boolean((navigator as Navigator & { connection?: Conn }).connection?.saveData);

export interface LoopOptions {
  /** Fetch the video at once (the page's hero) rather than as it nears the screen. */
  eager?: boolean;
  /** Share of the frame that must be on screen for it to count as in view. */
  threshold?: number;
}

export class Loop {
  readonly root: HTMLElement;
  readonly video: HTMLVideoElement;
  private toggle: HTMLButtonElement | null;
  private label: string;
  /** Paused by the reader: stays paused until they play it again. */
  private held = false;
  /** Started with its button: plays even where nothing autoplays. */
  private asked = false;
  /** The browser refused to start it on its own (a power-saving mode). */
  private blocked = false;
  private failed = false;
  private inView = false;
  /** Whether the section wants it playing now (its entrance is over, or its scene has come). */
  private wanted = false;

  constructor(root: HTMLElement, options: LoopOptions = {}) {
    this.root = root;
    this.video = root.querySelector('video') as HTMLVideoElement;
    this.toggle = root.querySelector<HTMLButtonElement>('[data-loop-toggle]');
    this.label = this.toggle?.dataset.label ?? 'video';
    const { video, toggle } = this;
    if (!video) return;

    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener('click', () => {
        if (video.paused) {
          this.held = false;
          this.asked = true;
          this.blocked = false;
          this.play();
        } else {
          this.held = true;
          this.asked = false;
          video.pause();
        }
      });
    }

    video.addEventListener('play', () => this.state());
    video.addEventListener('pause', () => this.state());
    video.addEventListener('playing', () => this.reveal());
    const fail = () => {
      this.failed = true;
      video.removeAttribute('data-shown');
      if (toggle) toggle.hidden = true;
    };
    video.addEventListener('error', fail);
    video.querySelector('source:last-of-type')?.addEventListener('error', fail);

    if (options.eager && this.autoplayAllowed()) {
      video.preload = 'auto';
      video.load();
    }

    if ('IntersectionObserver' in window) {
      const threshold = options.threshold ?? 0.3;
      new IntersectionObserver(
        ([entry]) => {
          this.inView = entry.isIntersecting && entry.intersectionRatio >= threshold - 0.001;
          this.sync();
        },
        { threshold: [0, threshold] },
      ).observe(root);
      // Fetch a lazy loop as it comes within a screen of view.
      if (!options.eager) {
        const near = new IntersectionObserver(
          ([entry]) => {
            if (!entry.isIntersecting) return;
            near.disconnect();
            if (this.autoplayAllowed() && video.preload === 'none') {
              video.preload = 'auto';
              video.load();
            }
          },
          { rootMargin: '100% 0px 100% 0px' },
        );
        near.observe(root);
      }
    } else {
      this.inView = true;
    }

    document.addEventListener('visibilitychange', () => this.sync());
    reduceMq.addEventListener?.('change', () => {
      if (reduceMq.matches && !this.asked) video.pause();
      this.sync();
    });
    this.state();
  }

  autoplayAllowed() {
    return !reduceMq.matches && !saving();
  }

  /** The section's wish: true once the loop should run (if nothing else stops it). */
  want(wanted: boolean) {
    if (wanted === this.wanted) return;
    this.wanted = wanted;
    this.sync();
  }

  private sync() {
    const { video } = this;
    if (!video || this.failed) return;
    const go =
      !document.hidden && this.inView && !this.held && (this.asked || (this.wanted && this.autoplayAllowed() && !this.blocked));
    if (go && video.paused) this.play();
    else if (!go && !video.paused) video.pause();
  }

  private play() {
    const { video } = this;
    if (this.failed) return;
    if (video.preload !== 'auto') video.preload = 'auto';
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch((error: unknown) => {
        // Refused by the browser's autoplay rules: not retried on every
        // scroll, and the button still plays it. (A play interrupted by a
        // pause is not a refusal.)
        if (!this.asked && error instanceof DOMException && error.name === 'NotAllowedError') this.blocked = true;
        this.state();
      });
    }
  }

  /** The video over its poster, from its first frame on screen. */
  private reveal() {
    const { video } = this;
    if (video.hasAttribute('data-shown')) return;
    const show = () => {
      if (!this.failed) video.setAttribute('data-shown', '');
    };
    const onFrame = (video as HTMLVideoElement & { requestVideoFrameCallback?: (callback: () => void) => number })
      .requestVideoFrameCallback;
    if (typeof onFrame === 'function') onFrame.call(video, show);
    else show();
  }

  private state() {
    const { toggle, video } = this;
    if (!toggle) return;
    const playing = !video.paused;
    toggle.dataset.state = playing ? 'playing' : 'paused';
    toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} video: ${this.label}`);
  }
}

// ---- Walkthroughs -----------------------------------------------------------

export interface WalkthroughOptions {
  /** Share of the frame that must be on screen for playback to start or resume. */
  threshold?: number;
}

type WalkState = 'playing' | 'paused' | 'ended';

export class Walkthrough {
  readonly root: HTMLElement;
  readonly video: HTMLVideoElement;
  private toggle: HTMLButtonElement | null;
  private label: string;
  /** Paused by the reader: stays paused until they play it again. */
  private held = false;
  /** Started (or replayed) with its control or a chapter. */
  private asked = false;
  /** The browser refused to start it on its own. */
  private blocked = false;
  private failed = false;
  /** Played to the end: it holds its last frame and waits for a replay. */
  private ended = false;
  private inView = false;
  private raf = 0;
  private listeners: Array<(time: number, state: WalkState) => void> = [];

  constructor(root: HTMLElement, options: WalkthroughOptions = {}) {
    this.root = root;
    this.video = root.querySelector('video') as HTMLVideoElement;
    this.toggle = root.querySelector<HTMLButtonElement>('[data-walk-toggle]');
    this.label = this.toggle?.dataset.label ?? 'video';
    const { video, toggle } = this;
    if (!video) return;

    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener('click', () => {
        if (this.ended) this.seek(0);
        else if (video.paused) {
          this.held = false;
          this.asked = true;
          this.blocked = false;
          this.play();
        } else {
          this.held = true;
          this.asked = false;
          video.pause();
        }
      });
    }

    video.addEventListener('play', () => this.state());
    video.addEventListener('pause', () => this.state());
    video.addEventListener('playing', () => {
      this.reveal();
      this.tick();
    });
    video.addEventListener('ended', () => {
      // The last frame stays on screen; nothing restarts it but a replay.
      this.ended = true;
      this.state();
    });
    video.addEventListener('seeked', () => this.emit());
    const fail = () => {
      this.failed = true;
      video.removeAttribute('data-shown');
      if (toggle) toggle.hidden = true;
      root.setAttribute('data-failed', '');
    };
    video.addEventListener('error', fail);
    video.querySelector('source:last-of-type')?.addEventListener('error', fail);

    const threshold = options.threshold ?? 0.55;
    if ('IntersectionObserver' in window) {
      // In view once most of the frame is on screen; out of view only once
      // little of it is left, so a small scroll does not stop and start it.
      new IntersectionObserver(
        ([entry]) => {
          const r = entry.isIntersecting ? entry.intersectionRatio : 0;
          if (r >= threshold - 0.001) this.inView = true;
          else if (r < 0.2) this.inView = false;
          this.sync();
        },
        { threshold: [0, 0.2, threshold] },
      ).observe(root);
      // Fetched as it comes within a screen of view.
      const near = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          near.disconnect();
          if (this.autoplayAllowed() && video.preload === 'none') {
            video.preload = 'auto';
            video.load();
          }
        },
        { rootMargin: '100% 0px 100% 0px' },
      );
      near.observe(root);
    } else {
      this.inView = true;
    }

    document.addEventListener('visibilitychange', () => this.sync());
    reduceMq.addEventListener?.('change', () => {
      if (reduceMq.matches && !this.asked) video.pause();
      this.sync();
    });
    this.state();
  }

  autoplayAllowed() {
    return !reduceMq.matches && !saving();
  }

  /** Called with the current time on every frame while it plays, and on seeks. */
  onTime(listener: (time: number, state: WalkState) => void) {
    this.listeners.push(listener);
    listener(this.video?.currentTime ?? 0, this.current());
  }

  /** Plays from a point (a chapter, or the start for a replay). */
  seek(time: number) {
    const { video } = this;
    if (!video || this.failed) return;
    this.ended = false;
    this.held = false;
    this.asked = true;
    this.blocked = false;
    try {
      video.currentTime = time;
    } catch {
      /* not seekable yet: plays from where it is */
    }
    this.play();
  }

  private current(): WalkState {
    if (this.ended) return 'ended';
    return this.video && !this.video.paused ? 'playing' : 'paused';
  }

  private emit() {
    const t = this.video.currentTime;
    const s = this.current();
    for (const l of this.listeners) l(t, s);
  }

  private tick() {
    if (this.raf) return;
    const step = () => {
      this.raf = 0;
      this.emit();
      if (!this.video.paused && !this.ended) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private sync() {
    const { video } = this;
    if (!video || this.failed || this.ended) return;
    const go =
      !document.hidden && this.inView && !this.held && (this.asked || (this.autoplayAllowed() && !this.blocked));
    if (go && video.paused) this.play();
    else if (!go && !video.paused) video.pause();
  }

  private play() {
    const { video } = this;
    if (this.failed) return;
    if (video.preload !== 'auto') video.preload = 'auto';
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch((error: unknown) => {
        if (!this.asked && error instanceof DOMException && error.name === 'NotAllowedError') this.blocked = true;
        this.state();
      });
    }
  }

  private reveal() {
    const { video } = this;
    if (video.hasAttribute('data-shown')) return;
    const show = () => {
      if (!this.failed) video.setAttribute('data-shown', '');
    };
    const onFrame = (video as HTMLVideoElement & { requestVideoFrameCallback?: (callback: () => void) => number })
      .requestVideoFrameCallback;
    if (typeof onFrame === 'function') onFrame.call(video, show);
    else show();
  }

  private state() {
    const s = this.current();
    this.root.dataset.walk = s;
    const { toggle } = this;
    if (toggle) {
      toggle.dataset.state = s;
      const verb = s === 'playing' ? 'Pause' : s === 'ended' ? 'Replay' : 'Play';
      toggle.setAttribute('aria-label', `${verb} video: ${this.label}`);
    }
    if (this.video) this.emit();
  }
}
