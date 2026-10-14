/**
 * The hero's background field (Technical Product Marketing, V1.4): thin,
 * irregular contour lines, like a topographic map, drawn once at build time.
 *
 * A smooth height field (a broad rise centered under the hero object, two
 * smaller ones and a little low-frequency waviness) is sampled on a grid, its
 * contours traced with marching squares, joined into lines and softened, and
 * returned as SVG path data in the field's own pixel space. Deterministic:
 * the same build always draws the same map, so it never shifts between
 * deploys.
 *
 * The lines fade out toward the field's edges and toward the copy on the
 * left. That fade is drawn into the lines themselves (each stretch of line
 * carries its own opacity, in tenths) rather than laid over them as a CSS
 * mask, so the browser never has to composite a mask while the page scrolls.
 */

export interface Field {
  width: number;
  height: number;
  /** One path per opacity step (0.1 to 1), each a set of line stretches. */
  paths: Array<{ d: string; w: number }>;
}

type Pt = [number, number];

const W = 1400;
const H = 1000;
const CELL = 10;

// The map's center (the object) sits at (700, 500).
function height(x: number, y: number): number {
  const bump = (cx: number, cy: number, s: number, a: number) => a * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s));
  return (
    bump(712, 512, 250, 1) +
    bump(1040, 260, 170, 0.5) +
    bump(400, 790, 190, 0.42) +
    bump(1180, 840, 140, 0.28) +
    0.09 * Math.sin(x / 97 + y / 151) +
    0.065 * Math.sin(x / 61 - y / 89 + 1.3) +
    0.05 * Math.cos((x + y) / 131 + 0.7) +
    0.035 * Math.sin(y / 47 - x / 173 + 2.1) +
    0.025 * Math.cos(x / 29 + y / 211 + 0.4)
  );
}

const LEVELS = [0.14, 0.21, 0.28, 0.35, 0.42, 0.49, 0.56, 0.63, 0.7, 0.77];

const key = ([x, y]: Pt) => `${x.toFixed(2)},${y.toFixed(2)}`;

/** Marching squares on the grid: the segments of one level. */
function segments(grid: number[][], level: number): Array<[Pt, Pt]> {
  const out: Array<[Pt, Pt]> = [];
  const rows = grid.length - 1;
  const cols = grid[0].length - 1;
  const lerp = (a: number, b: number) => (level - a) / (b - a);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = grid[j][i]; // top left
      const b = grid[j][i + 1]; // top right
      const c = grid[j + 1][i + 1]; // bottom right
      const d = grid[j + 1][i]; // bottom left
      const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = i * CELL;
      const y = j * CELL;
      const top: Pt = [x + lerp(a, b) * CELL, y];
      const right: Pt = [x + CELL, y + lerp(b, c) * CELL];
      const bottom: Pt = [x + lerp(d, c) * CELL, y + CELL];
      const left: Pt = [x, y + lerp(a, d) * CELL];
      const center = (a + b + c + d) / 4;
      switch (idx) {
        case 1: case 14: out.push([left, bottom]); break;
        case 2: case 13: out.push([bottom, right]); break;
        case 3: case 12: out.push([left, right]); break;
        case 4: case 11: out.push([top, right]); break;
        case 6: case 9: out.push([top, bottom]); break;
        case 7: case 8: out.push([left, top]); break;
        case 5: // saddles: resolve by the cell's center
          if (center > level) { out.push([left, top]); out.push([bottom, right]); } else { out.push([left, bottom]); out.push([top, right]); }
          break;
        case 10:
          if (center > level) { out.push([left, bottom]); out.push([top, right]); } else { out.push([left, top]); out.push([bottom, right]); }
          break;
      }
    }
  }
  return out;
}

/** Joins segments that share endpoints into polylines. */
function chain(segs: Array<[Pt, Pt]>): Pt[][] {
  const ends = new Map<string, number[]>();
  const used = new Uint8Array(segs.length);
  segs.forEach(([p, q], n) => {
    for (const pt of [p, q]) {
      const k = key(pt);
      const list = ends.get(k);
      if (list) list.push(n);
      else ends.set(k, [n]);
    }
  });
  const lines: Pt[][] = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const line: Pt[] = [segs[s][0], segs[s][1]];
    // extend at the tail, then at the head
    for (const atEnd of [true, false]) {
      for (;;) {
        const tip = atEnd ? line[line.length - 1] : line[0];
        const next = (ends.get(key(tip)) || []).find((n) => !used[n]);
        if (next === undefined) break;
        used[next] = 1;
        const [p, q] = segs[next];
        const other = key(p) === key(tip) ? q : p;
        if (atEnd) line.push(other);
        else line.unshift(other);
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Chaikin's corner cutting, twice, for soft irregular curves. */
function soften(line: Pt[], closed: boolean): Pt[] {
  let pts = line;
  for (let pass = 0; pass < 2; pass++) {
    const out: Pt[] = closed ? [] : [pts[0]];
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25]);
      out.push([p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
    }
    if (!closed) out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/** Drops points closer than `min` to the last kept one. */
function thin(line: Pt[], min: number): Pt[] {
  const out: Pt[] = [line[0]];
  for (let i = 1; i < line.length - 1; i++) {
    const [x, y] = line[i];
    const [lx, ly] = out[out.length - 1];
    if (Math.hypot(x - lx, y - ly) >= min) out.push(line[i]);
  }
  out.push(line[line.length - 1]);
  return out;
}

// How strongly the lines show at a point: full around the object, fading to
// nothing at the field's elliptical edge (from 52% of the way out) and toward
// the copy (from 44% of the width back to 22%).
function fade(x: number, y: number): number {
  const d = Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2));
  const edge = d <= 0.52 ? 1 : d >= 1 ? 0 : 1 - (d - 0.52) / 0.48;
  const veil = Math.min(1, Math.max(0, (x / W - 0.22) / 0.22));
  return edge * veil;
}

let cache: Field | null = null;

export function contourField(): Field {
  if (cache) return cache;
  const grid: number[][] = [];
  for (let j = 0; j <= H / CELL; j++) {
    const row: number[] = [];
    for (let i = 0; i <= W / CELL; i++) row.push(height(i * CELL, j * CELL));
    grid.push(row);
  }
  // Stretches of line by opacity step: consecutive segments in the same step
  // run together, so each step is one path of a few stretches.
  const steps = new Map<number, string[]>();
  const emit = (run: Pt[], step: number) => {
    if (run.length < 2 || !step) return;
    const d = run.map(([x, y], n) => (n ? `l${x - run[n - 1][0]} ${y - run[n - 1][1]}` : `M${x} ${y}`)).join('').replace(/ -/g, '-');
    const list = steps.get(step) || [];
    list.push(d);
    steps.set(step, list);
  };
  for (const level of LEVELS) {
    for (const line of chain(segments(grid, level)).filter((l) => l.length > 6)) {
      const closed = key(line[0]) === key(line[line.length - 1]);
      const pts = thin(soften(closed ? line.slice(0, -1) : line, closed), 9).map(([x, y]): Pt => [Math.round(x), Math.round(y)]);
      if (closed) pts.push(pts[0]);
      let run: Pt[] = [pts[0]];
      let step = -1;
      for (let n = 1; n < pts.length; n++) {
        const [ax, ay] = pts[n - 1];
        const [bx, by] = pts[n];
        const s = Math.round(fade((ax + bx) / 2, (ay + by) / 2) * 10);
        if (s !== step && run.length > 1) {
          emit(run, step);
          run = [pts[n - 1]];
        }
        step = s;
        run.push(pts[n]);
      }
      emit(run, step);
    }
  }
  const paths = [...steps.entries()].sort((a, b) => a[0] - b[0]).map(([step, list]) => ({ d: list.join(''), w: step / 10 }));
  cache = { width: W, height: H, paths };
  return cache;
}
