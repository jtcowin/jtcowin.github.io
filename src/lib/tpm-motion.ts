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
 * Walkthroughs. A muted recording that sits on its poster, invisible until
 * its first frame is on screen, and plays from there the first time its frame
 * is well inside the viewport; paused whenever the frame leaves the viewport
 * and resumed when it returns. By default it plays once and holds its last
 * frame, and its one control pauses, plays and, at the end, replays. With a
 * cycle (Version 1.2, the website) it plays continuously instead: at the end
 * it holds its last frame for a moment, fades back to its poster (the
 * recording's first frame) and plays again, never cutting from the end to
 * the start, and its control only pauses and plays. A hidden tab, reduced
 * motion, a data-saving preference or a refused autoplay leave the poster
 * (the control still plays it on request, once through), and a recording
 * that cannot load keeps its poster and loses its control.
 *
 * Films (Version 1.2). A film with sound that plays the same way, silently at
 * first; a "Play with sound" button stays on it until the reader takes it up,
 * then starts it again from the beginning with sound, and standard controls
 * (mute or unmute, pause or play, replay) take its place.
 *
 * Rises (Creator Marketing V1.2, Part One: no scroll hiccups). The large
 * frames (the website's display, the documentation's browser frame, the
 * flagship film) still rise a little into place as they come up the screen,
 * but the rise is now read from the scroll position itself, every frame,
 * instead of a timed transition set off by a threshold: it starts with the
 * reader's first movement, never runs ahead of the gesture (a timed rise made
 * the page seem to jump as it crossed the threshold), and reverses exactly on
 * the way back up. Nothing here listens to the wheel or touches the scroll
 * position; the page always scrolls natively. Recordings are fetched while
 * the browser is idle, well before they are reached, never in the middle of a
 * gesture.
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

interface Rise {
  el: HTMLElement;
  /** Its top in the document, from layout (never from its own transform). */
  top: number;
  distance: number;
  scale: number;
  last: string;
}
const rises: Rise[] = [];

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
  if (rises.length) {
    const still = reduceMq.matches;
    const y = window.scrollY;
    for (const r of rises) {
      // 0 while its top is still at the foot of the screen, 1 once it is two fifths
      // of the way up; eased so it moves from the very first pixel of scrolling. It
      // fades in from nothing, as V1.6's entrance did, so below the screen it is
      // simply not there yet (never half there, with its words at half contrast).
      const t = still ? 1 : clamp((y + vh - r.top) / (vh * 0.4));
      const e = 1 - (1 - t) * (1 - t);
      const key = t >= 1 ? '' : `${(r.distance * (1 - e)).toFixed(1)}|${(1 - r.scale * (1 - e)).toFixed(4)}|${e.toFixed(3)}`;
      if (key === r.last) continue;
      r.last = key;
      if (!key) {
        r.el.style.transform = '';
        r.el.style.opacity = '';
        continue;
      }
      const [d, k, o] = key.split('|');
      r.el.style.transform = `translate3d(0, ${d}px, 0)${r.scale ? ` scale(${k})` : ''}`;
      r.el.style.opacity = o;
    }
  }
}

/** Where each rise stands in the document (layout offsets, unaffected by its own transform). */
function measureRises() {
  for (const r of rises) {
    let top = 0;
    for (let n: HTMLElement | null = r.el; n; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
    r.top = top;
    r.last = '-';
  }
  schedule();
}

/**
 * A frame that rises into place as it comes up the screen, `distance` pixels (and
 * `scale` of its size) below its place at the foot of the screen, read from the
 * scroll position every frame. Reduced motion leaves it in place.
 */
export function addRise(el: HTMLElement, { distance = 40, scale = 0 } = {}) {
  rises.push({ el, top: 0, distance, scale, last: '-' });
  measureRises();
}

let riseTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(riseTimer);
  riseTimer = window.setTimeout(measureRises, 120);
});
window.addEventListener('load', measureRises);
document.fonts?.ready.then(measureRises);
if ('ResizeObserver' in window) new ResizeObserver(() => measureRises()).observe(document.body);

/** Work for a quiet moment (a recording's fetch), never in the middle of a gesture. */
export function whenIdle(fn: () => void) {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === 'function') ric(fn, { timeout: 1200 });
  else window.setTimeout(fn, 200);
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

// ---- Media preferences ------------------------------------------------------

type Conn = { saveData?: boolean };
const saving = () => lessDataMq.matches || Boolean((navigator as Navigator & { connection?: Conn }).connection?.saveData);

// ---- Walkthroughs -----------------------------------------------------------

export interface WalkthroughOptions {
  /** Share of the frame that must be on screen for playback to start or resume. */
  threshold?: number;
  /**
   * Play continuously (Version 1.2): at the end, hold the last frame for
   * `hold` milliseconds, fade back to the poster (the first frame) over `fade`
   * milliseconds, then play again from the start. Only while autoplay is
   * allowed and has not been refused; otherwise it plays once through.
   */
  cycle?: { hold: number; fade: number };
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
  private cycle: { hold: number; fade: number } | null;
  /**
   * A cycle's turn from the last frame back to the first: holding the last
   * frame, fading to the poster, then rewinding under it.
   */
  private phase: '' | 'hold' | 'fade' | 'rewind' = '';
  private timer = 0;
  /** The poster image under the recording, decoded ahead of each turn (V1.2, Part One). */
  private posterImg: HTMLImageElement | null = null;

  constructor(root: HTMLElement, options: WalkthroughOptions = {}) {
    this.root = root;
    this.video = root.querySelector('video') as HTMLVideoElement;
    this.toggle = root.querySelector<HTMLButtonElement>('[data-walk-toggle]');
    this.posterImg = root.querySelector<HTMLImageElement>('img');
    this.label = this.toggle?.dataset.label ?? 'video';
    this.cycle = options.cycle ?? null;
    const { video, toggle } = this;
    if (!video) return;

    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener('click', () => {
        if (this.ended) this.seek(0);
        else if (this.phase) {
          // During the turn: pausing keeps (or brings back) the last frame;
          // playing again fades from it to the start and plays.
          if (this.held) {
            this.held = false;
            this.asked = true;
            this.turn(0);
          } else {
            this.held = true;
            this.asked = false;
            this.stay();
          }
        } else if (video.paused) {
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
      if (this.cycle && this.autoplayAllowed() && !this.blocked) {
        // Continuous: a moment on the last frame, a fade back to the first,
        // and it plays again.
        this.turn(this.cycle.hold);
        return;
      }
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
      // Fetched as it comes within two screens of view, while the browser is idle
      // (not in the middle of a gesture).
      const near = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          near.disconnect();
          whenIdle(() => {
            if (this.autoplayAllowed() && video.preload === 'none') {
              video.preload = 'auto';
              video.load();
            }
          });
        },
        { rootMargin: '200% 0px 200% 0px' },
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
    this.cancel();
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
    // The turn is part of continuous playback.
    if (this.phase) return this.held ? 'paused' : 'playing';
    return this.video && !this.video.paused ? 'playing' : 'paused';
  }

  /** A cycle's turn, from the last frame (held for `hold` ms) back to the start. */
  private turn(hold: number) {
    const { cycle, root } = this;
    if (!cycle) return;
    window.clearTimeout(this.timer);
    this.phase = 'hold';
    this.state();
    // The poster comes back into view during the fade: decode it now, during the
    // hold, so the fade never waits on it (a long frame there felt like a hitch).
    this.posterImg?.decode?.().catch(() => {});
    root.style.setProperty('--walk-fade', `${cycle.fade}ms`);
    this.timer = window.setTimeout(() => {
      this.phase = 'fade';
      root.dataset.turn = 'fade';
      this.timer = window.setTimeout(() => this.rewind(), cycle.fade);
    }, Math.max(0, hold));
  }

  /** Under the poster, back to the first frame; then the recording over it again. */
  private rewind() {
    const { video, root } = this;
    this.phase = 'rewind';
    this.timer = 0;
    let done = false;
    const back = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', back);
      requestAnimationFrame(() => {
        if (this.phase !== 'rewind') return;
        this.phase = '';
        delete root.dataset.turn;
        this.sync();
        this.state();
      });
    };
    video.addEventListener('seeked', back);
    try {
      video.currentTime = 0;
    } catch {
      back();
    }
  }

  /** Paused during the turn: the last frame stays (a rewind under way finishes first, paused). */
  private stay() {
    if (this.phase === 'hold' || this.phase === 'fade') {
      window.clearTimeout(this.timer);
      this.timer = 0;
      this.phase = 'hold';
      delete this.root.dataset.turn;
    }
    this.state();
  }

  /** Abandons a turn (a seek or a replay takes over). */
  private cancel() {
    window.clearTimeout(this.timer);
    this.timer = 0;
    this.phase = '';
    delete this.root.dataset.turn;
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
    if (!video || this.failed || this.ended || this.phase) return;
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

// ---- Films ------------------------------------------------------------------

export interface FilmOptions {
  /** Share of the frame that must be on screen for it to count as in view. */
  threshold?: number;
}

/** Silent until the reader asks for sound; from then on, with sound. */
type FilmMode = 'muted' | 'sound';
export type FilmState = 'idle' | 'playing' | 'paused' | 'ended';

/**
 * The flagship film (06). It plays once, silently, from its poster when its
 * frame is well inside the viewport (never for reduced motion, a data-saving
 * preference or a browser that refuses), pauses whenever the frame leaves the
 * viewport and resumes when it returns, and holds its last frame at the end;
 * it never loops. While it is silent, "Play with sound" stays on it, with a
 * small pause, play or replay beside it; taking it up starts the film again
 * from 00:00 with sound, and the standard controls replace it: mute or unmute,
 * pause or play, and replay, the last alone once the film has ended. The
 * native controls in the markup serve readers without JavaScript and are
 * removed here.
 */
export class Film {
  readonly root: HTMLElement;
  readonly video: HTMLVideoElement;
  private mode: FilmMode = 'muted';
  /** Paused by the reader: stays paused until they play it again. */
  private held = false;
  /** Started by the reader: with sound, with a play, or with a replay. */
  private asked = false;
  /** The browser refused to start it on its own. */
  private blocked = false;
  private failed = false;
  private started = false;
  /** Played to the end: it holds its last frame and waits for a replay. */
  private ended = false;
  private inView = false;
  private label: string;
  private sound: HTMLButtonElement | null;
  private quiet: HTMLButtonElement | null;
  private controls: HTMLElement | null;
  private mute: HTMLButtonElement | null;
  private toggle: HTMLButtonElement | null;
  private replay: HTMLButtonElement | null;

  constructor(root: HTMLElement, options: FilmOptions = {}) {
    this.root = root;
    this.video = root.querySelector('video') as HTMLVideoElement;
    const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
    this.sound = q<HTMLButtonElement>('[data-film-sound]');
    this.quiet = q<HTMLButtonElement>('[data-film-quiet]');
    this.controls = q<HTMLElement>('[data-film-controls]');
    this.mute = q<HTMLButtonElement>('[data-film-mute]');
    this.toggle = q<HTMLButtonElement>('[data-film-play]');
    this.replay = q<HTMLButtonElement>('[data-film-replay]');
    this.label = root.dataset.label ?? 'film';
    const { video } = this;
    if (!video) return;

    // The custom controls replace the native ones from here on.
    video.removeAttribute('controls');
    video.muted = true;

    this.sound?.addEventListener('click', () => this.withSound());
    this.quiet?.addEventListener('click', () => {
      if (this.ended) this.restart();
      else if (video.paused) this.resume();
      else this.hold();
    });
    this.toggle?.addEventListener('click', () => (video.paused ? this.resume() : this.hold()));
    this.mute?.addEventListener('click', () => {
      video.muted = !video.muted;
      this.render();
    });
    this.replay?.addEventListener('click', () => this.restart());

    for (const type of ['play', 'pause', 'volumechange'] as const) video.addEventListener(type, () => this.render());
    video.addEventListener('playing', () => {
      this.started = true;
      this.reveal();
      this.render();
    });
    video.addEventListener('ended', () => {
      // The last frame stays on screen; nothing restarts it but a replay.
      this.ended = true;
      this.render();
    });
    const fail = () => {
      this.failed = true;
      video.removeAttribute('data-shown');
      root.setAttribute('data-failed', '');
      this.render();
    };
    video.addEventListener('error', fail);
    video.querySelector('source:last-of-type')?.addEventListener('error', fail);

    const threshold = options.threshold ?? 0.5;
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
      // Fetched as it comes within two screens of view, if it may start itself,
      // while the browser is idle (not in the middle of a gesture).
      const near = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          near.disconnect();
          whenIdle(() => {
            if (this.autoplayAllowed() && video.preload === 'none') {
              video.preload = 'auto';
              video.load();
            }
          });
        },
        { rootMargin: '200% 0px 200% 0px' },
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
    this.render();
  }

  autoplayAllowed() {
    return !reduceMq.matches && !saving();
  }

  /** From 00:00, with sound: the reader's gesture allows it. */
  private withSound() {
    const { video } = this;
    if (this.failed) return;
    const focused = document.activeElement === this.sound;
    this.mode = 'sound';
    video.muted = false;
    video.volume = 1;
    this.restart();
    this.render();
    // The button is gone; a keyboard reader's place moves to the pause control.
    if (focused) this.toggle?.focus({ preventScroll: true });
  }

  private restart() {
    const { video } = this;
    if (this.failed) return;
    this.ended = false;
    try {
      video.currentTime = 0;
    } catch {
      /* not seekable yet: it starts from the beginning anyway */
    }
    this.resume();
  }

  private resume() {
    this.held = false;
    this.asked = true;
    this.blocked = false;
    // The reader is looking at it, whatever share of it is on screen.
    this.inView = true;
    this.play();
  }

  private hold() {
    this.held = true;
    this.video.pause();
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
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          // Refused on its own: the poster and the button stay. Refused with
          // sound on a return to view: it waits, paused, for the reader.
          if (this.asked) this.held = true;
          else this.blocked = true;
        }
        this.render();
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

  private current(): FilmState {
    if (this.ended) return 'ended';
    if (!this.video.paused) return 'playing';
    return this.started ? 'paused' : 'idle';
  }

  private render() {
    const state = this.current();
    const { root, video, mode, failed } = this;
    root.dataset.mode = mode;
    root.dataset.state = state;
    const show = (el: HTMLElement | null, on: boolean) => {
      if (el && el.hidden === on) el.hidden = !on;
    };
    // Silent: the call to play with sound, and a small pause, play or replay
    // once the film has started.
    show(this.sound, !failed && mode === 'muted');
    show(this.quiet, !failed && mode === 'muted' && state !== 'idle');
    if (this.quiet) {
      this.quiet.dataset.state = state;
      const verb = state === 'playing' ? 'Pause video' : state === 'ended' ? 'Replay video without sound' : 'Play video without sound';
      this.quiet.setAttribute('aria-label', `${verb}: ${this.label}`);
    }
    // With sound: the standard controls, and only the replay once it has ended.
    show(this.controls, !failed && mode === 'sound');
    const ended = state === 'ended';
    const focused = document.activeElement;
    show(this.mute, !ended);
    show(this.toggle, !ended);
    if (ended && (focused === this.mute || focused === this.toggle)) this.replay?.focus({ preventScroll: true });
    if (this.mute) {
      this.mute.dataset.muted = String(video.muted);
      const text = this.mute.querySelector('[data-text]');
      if (text) text.textContent = video.muted ? 'Unmute' : 'Mute';
    }
    if (this.toggle) {
      this.toggle.dataset.state = state;
      const text = this.toggle.querySelector('[data-text]');
      if (text) text.textContent = state === 'playing' ? 'Pause' : 'Play';
    }
  }
}
