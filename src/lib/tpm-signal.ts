/**
 * The hero's signal field (Technical Product Marketing, V1.5).
 *
 * A faint field of short marks behind the hero, on a staggered (triangular)
 * lattice with a little jitter, never a square grid. At rest the marks barely
 * show: slate at about a tenth of full strength, leaning a few degrees with a
 * slow drift of direction across the field, and quieter still behind the copy,
 * the scope line, the core of the engine and toward the edges (the shelters,
 * measured on resize and drawn into each mark's own strength, so nothing on
 * the page is masked).
 *
 * While a fine pointer moves over the hero, the marks within about 190px of it
 * turn to run round it, lengthen a little, draw back from it a few pixels and
 * take on the page's teal; soft rings of that light travel outward as the
 * pointer travels, so the field reads the direction it is moved in. Once the
 * pointer rests the response settles to under half its strength, and it fades
 * away when the pointer leaves or the page scrolls.
 *
 * One 2D canvas, drawn once in full on resize. While the pointer acts, each
 * frame clears and redraws only the box the response covers now and covered a
 * frame ago (a few hundred marks), clipped to that box; the loop stops as soon
 * as the field has settled, and does nothing while the hero is off screen.
 * Touch screens and reduced motion get the still field alone.
 */

export interface Shelter {
  /** A box (x, y, w, h) or a circle (cx, cy, r), in the canvas's CSS pixels. */
  box?: { x: number; y: number; w: number; h: number };
  circle?: { cx: number; cy: number; r: number };
  /** The marks' strength inside it, 0 to 1. */
  level: number;
  /** How far outside it the strength comes back to full, in px. */
  feather: number;
}

const REST_ALPHA = 0.095;
const LIT_ALPHA = 0.5;
const RADIUS = 190;
const SETTLE_AFTER = 1300; // ms of stillness before the response settles
const SETTLED_LEVEL = 0.42;
const SLATE = [37, 49, 58];
const TEAL = [30, 100, 96];
const STEPS = 8;
const LEVELS = 40;
const MAX_ALPHA = 0.62;
const COLORS = Array.from({ length: STEPS + 1 }, (_, i) => {
  const t = i / STEPS;
  const c = SLATE.map((v, k) => Math.round(v + (TEAL[k] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
});

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A small seeded generator, so the field is the same on every visit.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SignalField {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  // marks
  private n = 0;
  private mx = new Float32Array(0);
  private my = new Float32Array(0);
  private ma = new Float32Array(0); // rest angle
  private ml = new Float32Array(0); // half length
  private mm = new Float32Array(0); // strength after shelters, 0 to 1
  private cell = 64;
  private cols = 0;
  private rows = 0;
  private buckets: Int32Array[] = [];
  // response
  private px = 0;
  private py = 0;
  private tx = 0;
  private ty = 0;
  private e = 0; // strength of the response
  private et = 0; // its target
  private travel = 0;
  private lastMove = 0;
  private has = false;
  private damp = 1;
  private raf = 0;
  private then = 0;
  private prev: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private awake = true;
  private batches: number[][] = Array.from({ length: (STEPS + 1) * (LEVELS + 1) }, () => []);
  private drawn = { px: Number.NaN, py: Number.NaN, e: 0, damp: 1 };
  private restTimer = 0;
  shelters: () => Shelter[] = () => [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
  }

  /** Lay the field out for the canvas's current box and draw it in full. */
  layout() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (!w || !h) return;
    this.w = w;
    this.h = h;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.build();
    this.prev = null;
    this.drawAll();
  }

  private build() {
    const { w, h } = this;
    const s = w < 700 ? 22 : 25;
    const dy = s * 0.866;
    const rand = rng(1543);
    const xs: number[] = [];
    const ys: number[] = [];
    const as: number[] = [];
    const ls: number[] = [];
    for (let row = 0, y = dy * 0.5; y < h + s; row++, y += dy) {
      const off = row % 2 ? s / 2 : 0;
      for (let x = off - s / 2; x < w + s; x += s) {
        const jx = (rand() - 0.5) * s * 0.26;
        const jy = (rand() - 0.5) * s * 0.26;
        const X = x + jx;
        const Y = y + jy;
        // A slow drift of direction across the field, and a slow swell of length.
        const drift = Math.sin(X * 0.0058 + 1.3) * Math.cos(Y * 0.0046 - 0.4) + 0.5 * Math.sin((X + Y) * 0.0027 + 2.1);
        xs.push(X);
        ys.push(Y);
        as.push(-Math.PI / 2 + 0.17 * drift + (rand() - 0.5) * 0.08);
        ls.push(3 + 1.25 * (0.5 + 0.5 * Math.sin(X * 0.004 + Y * 0.0063 + 0.7)));
      }
    }
    const n = xs.length;
    this.n = n;
    this.mx = Float32Array.from(xs);
    this.my = Float32Array.from(ys);
    this.ma = Float32Array.from(as);
    this.ml = Float32Array.from(ls);
    this.mm = new Float32Array(n);
    this.shade();
    // Buckets for the partial redraws.
    this.cols = Math.ceil(w / this.cell) + 1;
    this.rows = Math.ceil(h / this.cell) + 1;
    const lists: number[][] = Array.from({ length: this.cols * this.rows }, () => []);
    for (let i = 0; i < n; i++) {
      const c = Math.min(this.cols - 1, Math.max(0, Math.floor(this.mx[i] / this.cell)));
      const r = Math.min(this.rows - 1, Math.max(0, Math.floor(this.my[i] / this.cell)));
      lists[r * this.cols + c].push(i);
    }
    this.buckets = lists.map((l) => Int32Array.from(l));
  }

  /** Each mark's strength from the shelters and the edges. */
  private shade() {
    const { w, h, n, mx, my, mm } = this;
    const shelters = this.shelters();
    for (let i = 0; i < n; i++) {
      const x = mx[i];
      const y = my[i];
      let m = smoothstep(0, 56, x) * smoothstep(0, 56, w - x) * smoothstep(0, 40, h - y);
      for (const s of shelters) {
        let out = 0;
        if (s.box) {
          const dx = Math.max(s.box.x - x, 0, x - (s.box.x + s.box.w));
          const dy = Math.max(s.box.y - y, 0, y - (s.box.y + s.box.h));
          out = Math.hypot(dx, dy);
        } else if (s.circle) {
          out = Math.max(0, Math.hypot(x - s.circle.cx, y - s.circle.cy) - s.circle.r);
        }
        m *= s.level + (1 - s.level) * smoothstep(0, s.feather, out);
      }
      mm[i] = m;
    }
  }

  /** Recompute the shelters (after a layout change in the hero) and redraw. */
  reshade() {
    if (!this.n) return;
    this.shade();
    this.prev = null;
    this.drawAll();
  }

  private drawAll() {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.drawRange(-1e9, -1e9, 1e9, 1e9);
  }

  /** Draw every mark whose center lies in the box (CSS px), batched by tone and strength. */
  private drawRange(x0: number, y0: number, x1: number, y1: number) {
    const { ctx, cell, cols, rows, buckets, mx, my, ma, ml, mm } = this;
    const c0 = Math.max(0, Math.floor(x0 / cell));
    const c1 = Math.min(cols - 1, Math.floor(x1 / cell));
    const r0 = Math.max(0, Math.floor(y0 / cell));
    const r1 = Math.min(rows - 1, Math.floor(y1 / cell));
    const live = this.e * this.damp > 0.002;
    const R = RADIUS;
    const R2 = R * R;
    const { px, py } = this;
    const lambda = 44;
    const phase = this.travel;
    const batches = this.batches;
    for (const b of batches) b.length = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const list = buckets[r * cols + c];
        for (let k = 0; k < list.length; k++) {
          const i = list[k];
          let x = mx[i];
          let y = my[i];
          if (x < x0 || x > x1 || y < y0 || y > y1) continue;
          const m = mm[i];
          if (m < 0.02) continue;
          let a = ma[i];
          let l = ml[i];
          let alpha = REST_ALPHA * m;
          let tone = 0;
          if (live) {
            const vx = x - px;
            const vy = y - py;
            const d2 = vx * vx + vy * vy;
            if (d2 < R2) {
              const d = Math.sqrt(d2);
              const u = d / R;
              const g = (1 - u * u) * (1 - u * u);
              const f = this.e * this.damp * g;
              // Turn to run round the pointer (marks are lines: compare mod pi).
              const around = Math.atan2(vy, vx) + Math.PI / 2;
              let delta = around - a;
              delta = ((((delta + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI) - Math.PI / 2;
              a += delta * Math.min(1, f * 1.15);
              l *= 1 + 0.4 * f;
              // Draw back from the pointer a few pixels.
              if (d > 0.001) {
                x += (vx / d) * 4.5 * f;
                y += (vy / d) * 4.5 * f;
              }
              // Rings of light that travel outward as the pointer travels.
              const ring = 0.7 + 0.3 * Math.cos(((d - phase) / lambda) * Math.PI * 2);
              alpha += LIT_ALPHA * Math.max(m, 0.32) * f * ring;
              tone = Math.min(STEPS, Math.round(f * 1.4 * STEPS));
            }
          }
          // Strength in 40 steps on a square-root scale (finer where faint).
          const level = Math.min(LEVELS, Math.round(Math.sqrt(Math.min(1, alpha / MAX_ALPHA)) * LEVELS));
          if (!level) continue;
          const cx = Math.cos(a) * l;
          const cy = Math.sin(a) * l;
          batches[tone * (LEVELS + 1) + level].push(x - cx, y - cy, x + cx, y + cy);
        }
      }
    }
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    for (let key = 0; key < batches.length; key++) {
      const b = batches[key];
      if (!b.length) continue;
      const tone = Math.floor(key / (LEVELS + 1));
      const level = key % (LEVELS + 1);
      const v = level / LEVELS;
      ctx.strokeStyle = COLORS[tone];
      ctx.globalAlpha = v * v * MAX_ALPHA;
      ctx.beginPath();
      for (let j = 0; j < b.length; j += 4) {
        ctx.moveTo(b[j], b[j + 1]);
        ctx.lineTo(b[j + 2], b[j + 3]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Redraw the box the response covers now and covered a frame ago. */
  private drawResponse() {
    const { ctx, dpr } = this;
    const reach = RADIUS + 14;
    const now = { x0: this.px - reach, y0: this.py - reach, x1: this.px + reach, y1: this.py + reach };
    const box = this.prev
      ? { x0: Math.min(now.x0, this.prev.x0), y0: Math.min(now.y0, this.prev.y0), x1: Math.max(now.x1, this.prev.x1), y1: Math.max(now.y1, this.prev.y1) }
      : now;
    const x0 = Math.max(0, Math.floor(box.x0));
    const y0 = Math.max(0, Math.floor(box.y0));
    const x1 = Math.min(this.w, Math.ceil(box.x1));
    const y1 = Math.min(this.h, Math.ceil(box.y1));
    this.prev = this.e * this.damp > 0.002 ? now : null;
    if (x1 <= x0 || y1 <= y0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
    // Marks just outside the box can reach into it.
    this.drawRange(x0 - 12, y0 - 12, x1 + 12, y1 + 12);
    ctx.restore();
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = Math.min(0.05, Math.max(0.001, (now - (this.then || now)) / 1000));
    this.then = now;
    const kp = 1 - Math.exp(-dt / 0.085);
    const ke = 1 - Math.exp(-dt / (this.et > this.e ? 0.16 : 0.3));
    const ox = this.px;
    const oy = this.py;
    this.px += (this.tx - this.px) * kp;
    this.py += (this.ty - this.py) * kp;
    this.e += (this.et - this.e) * ke;
    this.travel += Math.hypot(this.px - ox, this.py - oy) * 0.55;
    const settled = Math.abs(this.tx - this.px) < 0.3 && Math.abs(this.ty - this.py) < 0.3 && Math.abs(this.et - this.e) < 0.008;
    if (settled) {
      this.px = this.tx;
      this.py = this.ty;
      this.e = this.et;
    }
    // Draw only what changed since the last frame drawn.
    const d = this.drawn;
    if (Math.abs(this.px - d.px) > 0.05 || Math.abs(this.py - d.py) > 0.05 || Math.abs(this.e - d.e) > 0.001 || this.damp !== d.damp) {
      this.drawResponse();
      d.px = this.px;
      d.py = this.py;
      d.e = this.e;
      d.damp = this.damp;
    }
    if (!settled) {
      this.run();
      return;
    }
    this.then = 0;
    // At full strength and still: wait (without drawing) until the pointer has
    // rested long enough, then settle to the quieter level.
    if (this.has && this.et > SETTLED_LEVEL) {
      window.clearTimeout(this.restTimer);
      const wait = Math.max(0, SETTLE_AFTER - (performance.now() - this.lastMove));
      this.restTimer = window.setTimeout(() => {
        if (this.has && performance.now() - this.lastMove >= SETTLE_AFTER - 30) {
          this.et = SETTLED_LEVEL;
          this.run();
        }
      }, wait + 10);
    }
  };

  private run() {
    if (!this.raf && this.awake) this.raf = requestAnimationFrame(this.frame);
  }

  /** A fine pointer moved to (x, y), in the canvas's CSS pixels. */
  point(x: number, y: number) {
    if (!this.has || this.e < 0.01) {
      // From nothing, the response starts where the pointer is.
      this.px = x;
      this.py = y;
    }
    this.tx = x;
    this.ty = y;
    this.has = true;
    this.et = 1;
    this.lastMove = performance.now();
    window.clearTimeout(this.restTimer);
    this.run();
  }

  /**
   * The pointer left: the response fades away. With `now` (the page
   * scrolled), it is gone at once, so nothing is drawn while the page moves.
   */
  release(now = false) {
    this.has = false;
    this.et = 0;
    if (now && this.e > 0) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.then = 0;
      this.e = 0;
      this.drawResponse();
      this.drawn.e = 0;
      return;
    }
    this.run();
  }

  /** Quieter while the pointer is over the engine itself. */
  setDamp(v: number) {
    if (this.damp === v) return;
    this.damp = v;
    this.run();
  }

  sleep() {
    this.awake = false;
    window.clearTimeout(this.restTimer);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.then = 0;
    // Leave the field at rest.
    if (this.e > 0) {
      this.e = 0;
      this.et = 0;
      this.has = false;
      this.prev = null;
      this.drawAll();
    }
  }

  wake() {
    this.awake = true;
  }
}
