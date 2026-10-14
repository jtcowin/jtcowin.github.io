/**
 * The Technical Product Marketing hero's isometric system (V1.6).
 *
 * A small isometric drawing engine and the scene built with it, computed at
 * build time: research and inputs on the left (interviews, product research,
 * foundation documents), the strategic foundation at the center (a deep teal
 * base and deck, a matrix of modular blocks, four fine guides and a glass
 * canopy etched with the shared language), and the public-facing expressions
 * on the right (the website, the technical documentation, campaigns and
 * content), on a faint local grid with conduits set into the floor.
 *
 * Every part is its own drawing (an SVG cropped to the part's bounds), so the
 * page can move parts as HTML boxes, which the compositor animates by itself:
 * the one-time assembly, the slow idle life and the hover separation never lay
 * out or repaint the drawing. Positions and travel are returned in design
 * units and in percentages of the stage, so the scene scales with its box.
 * The timeline (the assembly, the idle cycle and the faster cycle while the
 * system is engaged) is defined here too, with the keyframes it needs, since
 * every time in it follows from the layout: which conduit feeds which block,
 * how long each stretch of conduit is.
 *
 * Projection: true isometric. A point (x, y, z) on the grid lands at
 * ((x - y) cos 30, (x + y) sin 30 - z), times the unit. +x runs to the lower
 * right, +y to the lower left, +z up; the viewer looks along (-1, -1, -1), so
 * the faces turned toward +x, +y and +z are the ones drawn.
 */

type V3 = readonly [number, number, number];
type P2 = readonly [number, number];

const U = 20; // design units (px at scale 1) per grid unit
const C30 = Math.cos(Math.PI / 6);
const S30 = 0.5;
const VIEW: V3 = [1, 1, 1];

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Grid point to raw screen point (design units, origin at the grid origin). */
export const iso = (p: V3): P2 => [(p[0] - p[1]) * U * C30, (p[0] + p[1]) * U * S30 - p[2] * U];

// ---- colors -------------------------------------------------------------------------------
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const css = (c: RGB) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** A material's three tones: the top, the face toward +y (lower left) and toward +x (lower right). */
export interface Material {
  top: string;
  left: string;
  right: string;
  /** Opacity of every face (glass). */
  alpha?: number;
  /** The hairline round its silhouette. */
  edge?: string;
  /** The light caught along its front edges. */
  shine?: string;
}

const MAT = {
  stone: { top: '#faf8f3', left: '#e4e9e5', right: '#d1dcd8', edge: 'rgba(37,49,58,0.16)', shine: 'rgba(255,255,255,0.9)' },
  teal: { top: '#2a5a58', left: '#1f4546', right: '#163536', edge: 'rgba(13,15,16,0.35)', shine: 'rgba(159,201,195,0.55)' },
  deck: { top: '#2f6562', left: '#24504f', right: '#1c4142', edge: 'rgba(13,15,16,0.25)', shine: 'rgba(159,201,195,0.45)' },
  bone: { top: '#f7f4ee', left: '#dfe6e2', right: '#c6d5d1', edge: 'rgba(37,49,58,0.18)', shine: 'rgba(255,255,255,0.95)' },
  aqua: { top: '#b3d8d2', left: '#8bbcb5', right: '#73a69f', edge: 'rgba(31,69,70,0.3)', shine: 'rgba(255,255,255,0.7)' },
  slate: { top: '#46555f', left: '#2b3842', right: '#1e2830', edge: 'rgba(13,15,16,0.3)', shine: 'rgba(255,255,255,0.25)' },
  glass: { top: '#cfe7e3', left: '#8fbdb6', right: '#6f9f98', alpha: 0.5, edge: 'rgba(31,69,70,0.38)', shine: 'rgba(255,255,255,0.95)' },
  paper: { top: '#fdfcf9', left: '#fdfcf9', right: '#e6e1d7', edge: 'rgba(37,49,58,0.2)', shine: 'rgba(255,255,255,0.9)' },
  sheet: { top: '#f9f7f2', left: '#f6f3ec', right: '#e2ddd2', edge: 'rgba(37,49,58,0.2)', shine: 'rgba(255,255,255,0.9)' },
  mint: { top: '#e3f0ed', left: '#dcebe7', right: '#bfd6d1', edge: 'rgba(31,69,70,0.25)', shine: 'rgba(255,255,255,0.9)' },
} satisfies Record<string, Material>;

const INK = 'rgba(37,49,58,0.42)';
const INK_SOFT = 'rgba(37,49,58,0.22)';
const TEAL = '#1f4546';
const AQUA = '#4f918a';
const AQUA_LIGHT = '#9fc9c3';
const CORAL = '#d4846a';
const OCHRE = '#c99b45';

// ---- shapes -------------------------------------------------------------------------------
interface Shape {
  pts: P2[];
  fill?: string;
  stroke?: string;
  sw?: number;
  op?: number;
  /** A polyline rather than a closed shape. */
  open?: boolean;
  /** Even-odd rings (a hole as a second loop). */
  hole?: P2[];
  /** Extra attributes, verbatim (filters, classes). */
  attrs?: string;
}

/** A rounded rectangle in its own plane, counter-clockwise, corners in `seg` steps. */
function rrect(w: number, h: number, r: number, seg = 4): P2[] {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  // (a rounding too small to see at this scale is left out)
  if (rr < 0.06) {
    return [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ];
  }
  const out: P2[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
  };
  corner(w - rr, rr, -Math.PI / 2);
  corner(w - rr, h - rr, 0);
  corner(rr, h - rr, Math.PI / 2);
  corner(rr, rr, Math.PI);
  return out;
}

function circle(r: number, seg = 28): P2[] {
  return Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return [r * Math.cos(a), r * Math.sin(a)] as P2;
  });
}

const area2 = (pts: readonly P2[]) => pts.reduce((s, p, i) => {
  const q = pts[(i + 1) % pts.length];
  return s + p[0] * q[1] - q[0] * p[1];
}, 0);

/** A plane in the grid: origin o, in-plane axes a and b (unit vectors). */
interface Plane {
  o: V3;
  a: V3;
  b: V3;
}
const at = (pl: Plane, u: number, v: number): V3 => add(add(pl.o, mul(pl.a, u)), mul(pl.b, v));
const proj = (pl: Plane, pts: readonly P2[], du = 0, dv = 0): P2[] => pts.map(([u, v]) => iso(at(pl, u + du, v + dv)));

function mixRGB(cols: [RGB, number][]): string {
  const total = cols.reduce((s, [, w]) => s + w, 0) || 1;
  return css([0, 1, 2].map((k) => cols.reduce((s, [c, w]) => s + c[k] * w, 0) / total) as RGB);
}

/** The tone of a face by its outward normal, between the material's three tones. */
function tone(m: Material, n: V3): string {
  const wx = Math.max(0, n[0]);
  const wy = Math.max(0, n[1]);
  const wz = Math.max(0, n[2]);
  return mixRGB([
    [hex(m.right), wx],
    [hex(m.left), wy],
    [hex(m.top), wz],
  ]);
}

/**
 * A prism: an outline in a plane, extruded along `c` (a unit axis) by `t`.
 * Draws the side faces turned toward the viewer, each shaded by its normal,
 * then the cap at the far end, its silhouette hairline and the light on its
 * front edges. Returns the shapes and the cap's plane, for detail.
 */
function prism(outline: P2[], pl: Plane, c: V3, t: number, m: Material, capFill?: string) {
  const pts = area2(outline) < 0 ? [...outline].reverse() : outline;
  // Counter-clockwise in (a, b); the plane's own normal decides which way is out.
  const planeN = cross(pl.a, pl.b);
  const flip = dot(planeN, c) < 0 ? -1 : 1;
  const base = pts.map(([u, v]) => at(pl, u, v));
  const top = base.map((p) => add(p, mul(c, t)));
  const shapes: Shape[] = [];
  const front: boolean[] = [];
  const n = pts.length;
  const alpha = m.alpha ?? 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const e: V3 = [base[j][0] - base[i][0], base[j][1] - base[i][1], base[j][2] - base[i][2]];
    const out = unit(mul(cross(e, c), flip));
    const vis = dot(out, VIEW) > 1e-6;
    front.push(vis);
    if (!vis || t <= 0) continue;
    const fill = tone(m, out);
    shapes.push({ pts: [iso(base[i]), iso(base[j]), iso(top[j]), iso(top[i])], fill, stroke: fill, sw: 0.6, op: alpha < 1 ? alpha : undefined });
  }
  const capPts = top.map(iso);
  const capN = c;
  shapes.push({ pts: capPts, fill: capFill ?? tone(m, capN), op: alpha < 1 ? alpha : undefined });
  // The silhouette, edge by edge in runs: the bottom of the visible sides and
  // the light caught on the cap's front edges, then the hairline round the
  // cap's back edges. (A run starts where the edges turn from front to back,
  // so none wraps round the end of the outline.)
  const edge = m.edge ?? INK_SOFT;
  const shine = m.shine ?? 'rgba(255,255,255,0.8)';
  const s0 = Math.max(0, front.findIndex((f, i) => f !== front[(i + n - 1) % n]));
  let run: number[] = [];
  const flush = () => {
    if (!run.length) return;
    const idx = [...run, (run[run.length - 1] + 1) % n];
    if (front[run[0]]) {
      shapes.push({ pts: idx.map((k) => iso(base[k])), stroke: edge, sw: 0.7, open: true });
      shapes.push({ pts: idx.map((k) => capPts[k]), stroke: shine, sw: 0.9, open: true });
    } else shapes.push({ pts: idx.map((k) => capPts[k]), stroke: edge, sw: 0.7, open: true });
    run = [];
  };
  for (let q = 0; q < n; q++) {
    const i = (s0 + q) % n;
    if (run.length && front[run[0]] !== front[i]) flush();
    run.push(i);
  }
  flush();
  const capPlane: Plane = { o: add(pl.o, mul(c, t)), a: pl.a, b: pl.b };
  return { shapes, cap: capPlane };
}

/** A rounded slab lying flat: footprint (x, y) to (x + w, y + d), from z up by h. */
function slab(x: number, y: number, z: number, w: number, d: number, h: number, r: number, m: Material, capFill?: string) {
  return prism(rrect(w, d, r), { o: [x, y, z], a: [1, 0, 0], b: [0, 1, 0] }, [0, 0, 1], h, m, capFill);
}

/**
 * An upright panel facing +y (toward the lower left): its face spans x from
 * x0 to x0 + w and z from z0 to z0 + h, its back at y0, its thickness t.
 * Returns the face's plane in reading order: u to the right, v down.
 */
function panelY(x0: number, y0: number, z0: number, w: number, h: number, t: number, r: number, m: Material, capFill?: string) {
  const res = prism(rrect(w, h, r), { o: [x0, y0, z0 + h], a: [1, 0, 0], b: [0, 0, -1] }, [0, 1, 0], t, m, capFill);
  return res;
}

/** An upright panel facing +x (toward the lower right): u runs along -y (to the right on screen), v down. */
function panelX(x0: number, y0: number, z0: number, w: number, h: number, t: number, r: number, m: Material, capFill?: string) {
  return prism(rrect(w, h, r), { o: [x0, y0, z0 + h], a: [0, -1, 0], b: [0, 0, -1] }, [1, 0, 0], t, m, capFill);
}

/** A rounded rectangle drawn on a plane (detail on a face). */
const onRect = (pl: Plane, u: number, v: number, w: number, h: number, r: number, s: Omit<Shape, 'pts'>): Shape => ({ ...s, pts: proj(pl, rrect(w, h, r, 3), u, v) });
const onCircle = (pl: Plane, u: number, v: number, r: number, s: Omit<Shape, 'pts'>, seg = 24): Shape => ({ ...s, pts: proj(pl, circle(r, seg), u, v) });
const onLine = (pl: Plane, pts: P2[], s: Omit<Shape, 'pts' | 'open'>): Shape => ({ ...s, open: true, pts: proj(pl, pts) });
/** Lines of text: rows of rounded bars of the given lengths. */
function textRows(pl: Plane, u: number, v: number, lens: number[], gap: number, th: number, fill: string): Shape[] {
  return lens.map((len, i) => onRect(pl, u, v + i * gap, len, th, th / 2, { fill }));
}

// ---- parts ---------------------------------------------------------------------------------
export type Group = 'floor' | 'in' | 'core' | 'out';

interface PartDef {
  id: string;
  group: Group;
  /** Assembly: start and length in seconds, travel in grid units (+ from below, - from above, 0 fades in place). */
  delay: number;
  dur: number;
  from: number;
  /** Hover: rise in grid units. */
  lift?: number;
  /** Idle: float amplitude in grid units and phase (s). */
  float?: number;
  phase?: number;
  /** Idle illumination overlay shapes (drawn above, faded in and out). */
  glow?: Shape[];
  /** The canopy's etched rows, a layer of their own. */
  etch?: Shape[];
  /** The canopy's glass, lit, for its slow breath at idle (a layer of its own). */
  breath?: Shape[];
  /** A scale-from-the-ground assembly (the guides) instead of travel. */
  grow?: boolean;
  shapes: Shape[];
}

interface Spot {
  key: string;
  x: number;
  y: number;
}

function plinth(cx: number, cy: number): { shapes: Shape[]; glow: Shape[] } {
  const s = 2.8;
  const { shapes } = slab(cx - s / 2, cy - s / 2, 0, s, s, 0.38, 0.32, MAT.stone);
  // A fine inlay round the top, the plinth's one accent; lit, it marks a
  // signal leaving an input or reaching an expression.
  const top: Plane = { o: [cx - s / 2, cy - s / 2, 0.38], a: [1, 0, 0], b: [0, 1, 0] };
  const ring = proj(top, rrect(s - 0.36, s - 0.36, 0.2), 0.18, 0.18);
  shapes.push({ pts: ring, stroke: 'rgba(79,145,138,0.38)', sw: 0.7 });
  const glow: Shape[] = [{ pts: ring, fill: 'rgba(159,201,195,0.22)', stroke: AQUA, sw: 1.3 }];
  return { shapes, glow };
}

// The layout on the grid.
const IN = [
  { key: 'interviews', x: -11.25, y: 1.25 },
  { key: 'research', x: -6.25, y: 6.25 },
  { key: 'documents', x: -1.25, y: 11.25 },
] satisfies Spot[];
const OUT = [
  { key: 'website', x: 1.25, y: -11.25 },
  { key: 'documentation', x: 6.25, y: -6.25 },
  { key: 'campaigns', x: 11.25, y: -1.25 },
] satisfies Spot[];
const CORE = { half: 3.7, deck: 3.3, top: 0.8 };

function interviews(cx: number, cy: number): Shape[] {
  const out: Shape[] = [];
  // Bubble one: white, behind and higher, its tail low on the left.
  const a = panelX(cx - 0.55, cy + 1.0, 0.95, 1.75, 1.05, 0.1, 0.22, MAT.paper);
  out.push(...a.shapes);
  out.push(...textRows(a.cap, 0.28, 0.27, [1.15, 0.95, 0.6], 0.2, 0.08, INK));
  // its tail
  out.push({ pts: proj(a.cap, [[0.25, 1.05], [0.55, 1.05], [0.18, 1.32]]), fill: MAT.paper.left, stroke: 'rgba(37,49,58,0.2)', sw: 0.6 });
  // Bubble two: aqua, in front and lower, its tail low on the right.
  const b = panelX(cx + 0.35, cy + 0.45, 0.62, 1.55, 0.92, 0.1, 0.22, MAT.mint, '#cfe6e1');
  out.push(...b.shapes);
  out.push(...textRows(b.cap, 0.25, 0.25, [0.95, 0.7], 0.2, 0.08, 'rgba(31,69,70,0.55)'));
  for (let i = 0; i < 3; i++) out.push(onCircle(b.cap, 0.32 + i * 0.2, 0.7, 0.055, { fill: i === 0 ? CORAL : 'rgba(31,69,70,0.45)' }, 14));
  out.push({ pts: proj(b.cap, [[1.0, 0.92], [1.3, 0.92], [1.38, 1.18]]), fill: '#cfe6e1', stroke: 'rgba(31,69,70,0.25)', sw: 0.6 });
  return out;
}

function research(cx: number, cy: number): Shape[] {
  const out: Shape[] = [];
  // A data sheet lying on the plinth, its bars raised from it.
  const t = slab(cx - 1.05, cy - 1.05, 0.46, 2.1, 2.1, 0.1, 0.16, MAT.sheet);
  out.push(...t.shapes);
  out.push(...textRows(t.cap, 0.22, 0.24, [1.1, 0.75], 0.2, 0.08, INK));
  out.push(onRect(t.cap, 0.18, 1.86, 1.74, 0.03, 0.01, { fill: INK_SOFT }));
  const bars = [0.42, 0.7, 0.55, 1.0];
  bars.forEach((h, i) => {
    const m = i === 3 ? MAT.teal : MAT.aqua;
    out.push(...slab(cx - 1.05 + 0.28 + i * 0.4, cy - 1.05 + 1.48, 0.56, 0.26, 0.26, h, 0.04, m).shapes);
  });
  // A lens resting above the sheet: discovery.
  const lz = 1.25;
  const lens: Plane = { o: [cx + 0.25, cy - 0.2, lz], a: [1, 0, 0], b: [0, 1, 0] };
  out.push({ pts: proj({ o: [cx + 0.32, cy - 0.12, 0.57], a: [1, 0, 0], b: [0, 1, 0] }, circle(0.5)), fill: 'rgba(37,49,58,0.1)' });
  out.push({ pts: proj(lens, circle(0.5)), hole: proj(lens, circle(0.38)), fill: '#2b3842' });
  out.push({ pts: proj(lens, circle(0.38)), fill: 'rgba(191,224,219,0.45)', stroke: 'rgba(255,255,255,0.85)', sw: 0.6 });
  out.push({ pts: proj(lens, [[0.47, -0.07], [1.15, -0.07], [1.15, 0.07], [0.47, 0.07]]), fill: '#2b3842' });
  return out;
}

function documents(cx: number, cy: number): Shape[] {
  const out: Shape[] = [];
  // Three structured pages standing in file, facing the foundation, kept
  // low (the research label passes just above them).
  const pages = [
    { dx: -0.62, dy: 0.18, dz: 0.1, m: MAT.sheet },
    { dx: -0.12, dy: 0.06, dz: 0.05, m: MAT.sheet },
    { dx: 0.38, dy: -0.06, dz: 0, m: MAT.paper },
  ];
  pages.forEach((p, i) => {
    const pg = panelX(cx + p.dx, cy + 0.85 + p.dy, 0.5 + p.dz, 1.6, 1.62, 0.07, 0.1, p.m);
    out.push(...pg.shapes);
    const f = pg.cap;
    if (i < 2) {
      out.push(onRect(f, 0.18, 0.18, 0.7, 0.12, 0.05, { fill: 'rgba(37,49,58,0.28)' }));
      return;
    }
    out.push(onRect(f, 0.18, 0.18, 1.24, 0.28, 0.06, { fill: TEAL }));
    out.push(onRect(f, 0.3, 0.285, 0.62, 0.07, 0.035, { fill: 'rgba(243,239,232,0.85)' }));
    out.push(...textRows(f, 0.18, 0.6, [1.2, 1.05, 1.2, 0.8], 0.16, 0.065, INK));
    out.push(onRect(f, 0.18, 1.26, 0.5, 0.18, 0.05, { fill: 'rgba(79,145,138,0.35)' }));
    out.push(onCircle(f, 1.22, 1.35, 0.11, { fill: CORAL }, 18));
  });
  return out;
}

function website(cx: number, cy: number): Shape[] {
  const out: Shape[] = [];
  // A stand, then the browser window facing the room.
  out.push(...slab(cx - 0.32, cy - 0.12, 0.38, 0.64, 0.4, 0.06, 0.08, MAT.slate).shapes);
  out.push(...slab(cx - 0.08, cy + 0.04, 0.44, 0.16, 0.08, 0.5, 0.02, MAT.slate).shapes);
  const w = 2.7;
  const h = 1.95;
  const p = panelY(cx - w / 2, cy - 0.02, 0.86, w, h, 0.1, 0.14, MAT.paper);
  out.push(...p.shapes);
  const f = p.cap;
  // the title bar and its three dots
  out.push(onRect(f, 0, 0, w, 0.26, 0.12, { fill: '#eae5db' }));
  [CORAL, OCHRE, AQUA].forEach((c, i) => out.push(onCircle(f, 0.18 + i * 0.16, 0.13, 0.045, { fill: c }, 12)));
  out.push(onRect(f, 0.75, 0.08, 1.4, 0.1, 0.05, { fill: '#fdfcf9' }));
  // the navigation
  out.push(onRect(f, 0.2, 0.4, 0.22, 0.12, 0.03, { fill: TEAL }));
  [0.95, 1.3, 1.65].forEach((u) => out.push(onRect(f, u, 0.43, 0.24, 0.06, 0.03, { fill: INK_SOFT })));
  out.push(onRect(f, 2.08, 0.4, 0.42, 0.12, 0.06, { fill: AQUA }));
  // the hero
  out.push(onRect(f, 0.2, 0.66, 2.3, 0.62, 0.06, { fill: TEAL }));
  out.push(onRect(f, 0.36, 0.8, 1.05, 0.11, 0.05, { fill: 'rgba(243,239,232,0.92)' }));
  out.push(onRect(f, 0.36, 0.98, 0.75, 0.07, 0.035, { fill: 'rgba(159,201,195,0.8)' }));
  out.push(onRect(f, 0.36, 1.11, 0.36, 0.09, 0.045, { fill: AQUA_LIGHT }));
  out.push({ pts: proj(f, [[1.78, 1.18], [2.3, 0.78], [2.3, 1.18]]), fill: 'rgba(79,145,138,0.55)' });
  // three cards
  [0.2, 0.98, 1.76].forEach((u) => {
    out.push(onRect(f, u, 1.42, 0.7, 0.4, 0.05, { fill: '#f1ede5' }));
    out.push(onRect(f, u + 0.08, 1.5, 0.3, 0.06, 0.03, { fill: INK_SOFT }));
    out.push(onRect(f, u + 0.08, 1.62, 0.48, 0.05, 0.025, { fill: INK_SOFT }));
  });
  return out;
}

function documentation(cx: number, cy: number): Shape[] {
  const out: Shape[] = [];
  // A page behind, then the open documentation page.
  const back = panelY(cx - 0.95, cy - 0.5, 0.62, 2.2, 1.95, 0.07, 0.1, MAT.sheet);
  out.push(...back.shapes);
  out.push(onRect(back.cap, 1.4, 0.2, 0.6, 0.1, 0.05, { fill: INK_SOFT }));
  const w = 2.3;
  const h = 2.0;
  const p = panelY(cx - 1.3, cy - 0.12, 0.45, w, h, 0.08, 0.1, MAT.paper);
  out.push(...p.shapes);
  const f = p.cap;
  // the sidebar
  out.push(onRect(f, 0, 0, 0.62, h, 0.1, { fill: '#f0ebe2' }));
  out.push(onRect(f, 0.12, 0.16, 0.28, 0.1, 0.03, { fill: TEAL }));
  [0.44, 0.62, 0.8, 0.98, 1.16, 1.34].forEach((v, i) => out.push(onRect(f, 0.12, v, i === 2 ? 0.4 : 0.32, 0.055, 0.025, { fill: i === 2 ? AQUA : INK_SOFT })));
  // the article: a heading, text, and a block of code
  out.push(onRect(f, 0.8, 0.16, 1.0, 0.13, 0.05, { fill: 'rgba(37,49,58,0.75)' }));
  out.push(...textRows(f, 0.8, 0.42, [1.3, 1.15, 1.3], 0.16, 0.055, INK));
  out.push(onRect(f, 0.8, 0.94, 1.36, 0.78, 0.07, { fill: TEAL }));
  [
    [0.92, 1.06, 0.55, AQUA_LIGHT],
    [1.05, 1.2, 0.85, 'rgba(243,239,232,0.75)'],
    [1.05, 1.34, 0.62, 'rgba(243,239,232,0.75)'],
    [0.92, 1.48, 0.4, AQUA_LIGHT],
  ].forEach(([u, v, len, c]) => out.push(onRect(f, u as number, v as number, len as number, 0.05, 0.025, { fill: c as string })));
  return out;
}

function campaigns(cx: number, cy: number): Shape[] {
  const out: Shape[] = [];
  // A run of content cards, low and toward the front of the plinth (the
  // documentation's label passes just above them), the film at the front.
  const cards = [
    { dx: 0.55, dy: -0.45, dz: 0.16, kind: 'post' },
    { dx: 0.2, dy: -0.08, dz: 0.08, kind: 'image' },
    { dx: -0.15, dy: 0.3, dz: 0, kind: 'film' },
  ];
  cards.forEach((c) => {
    const w = 1.5;
    const h = 1.6;
    const p = panelY(cx - 0.9 + c.dx, cy + c.dy - 0.05, 0.5 + c.dz, w, h, 0.07, 0.12, c.kind === 'film' ? MAT.teal : MAT.paper, c.kind === 'film' ? '#24504f' : undefined);
    out.push(...p.shapes);
    const f = p.cap;
    if (c.kind === 'post') {
      out.push(onRect(f, 0.15, 0.15, 1.2, 0.7, 0.06, { fill: '#ece7dd' }));
      out.push(...textRows(f, 0.15, 1.0, [1.1, 0.8], 0.16, 0.06, INK_SOFT));
    } else if (c.kind === 'image') {
      out.push(onRect(f, 0.15, 0.15, 1.2, 0.86, 0.06, { fill: '#cfe6e1' }));
      out.push(onCircle(f, 1.0, 0.4, 0.12, { fill: OCHRE }, 16));
      out.push({ pts: proj(f, [[0.15, 1.01], [0.55, 0.55], [0.82, 0.8], [1.02, 0.64], [1.35, 1.01]]), fill: AQUA });
      out.push(...textRows(f, 0.15, 1.16, [1.0, 0.7], 0.16, 0.06, INK_SOFT));
    } else {
      out.push({ pts: proj(f, [[0.58, 0.48], [0.58, 0.96], [0.99, 0.72]]), fill: '#f3efe8' });
      out.push(onRect(f, 0.15, 1.3, 1.2, 0.05, 0.025, { fill: 'rgba(243,239,232,0.3)' }));
      out.push(onRect(f, 0.15, 1.3, 0.48, 0.05, 0.025, { fill: CORAL }));
      out.push(onCircle(f, 0.63, 1.325, 0.06, { fill: '#f3efe8' }, 12));
    }
  });
  return out;
}

// ---- the foundation ---------------------------------------------------------------------------
const BLOCK = { size: 1.5, gap: 0.5 };
const HEIGHTS = [
  [2.0, 1.5, 1.05],
  [1.6, 2.55, 1.3],
  [1.2, 1.4, 0.8],
];
const AQUA_BLOCKS = new Set(['1,1', '0,0']);

function coreBase(): Shape[] {
  const { half, deck, top } = CORE;
  const out: Shape[] = [];
  out.push(...slab(-half, -half, 0, half * 2, half * 2, 0.7, 0.42, MAT.teal).shapes);
  const d = slab(-deck, -deck, 0.7, deck * 2, deck * 2, top - 0.7, 0.3, MAT.deck);
  out.push(...d.shapes);
  // the deck's etched grid
  for (let k = 1; k < 6; k++) {
    const s = (k / 6) * deck * 2;
    out.push(onLine(d.cap, [[s, 0.25], [s, deck * 2 - 0.25]], { stroke: 'rgba(159,201,195,0.18)', sw: 0.6 }));
    out.push(onLine(d.cap, [[0.25, s], [deck * 2 - 0.25, s]], { stroke: 'rgba(159,201,195,0.18)', sw: 0.6 }));
  }
  // the four ports where the conduits arrive
  return out;
}

function blockPos(i: number, j: number) {
  const start = -(BLOCK.size * 3 + BLOCK.gap * 2) / 2;
  return { x: start + i * (BLOCK.size + BLOCK.gap), y: start + j * (BLOCK.size + BLOCK.gap) };
}

function block(i: number, j: number): { shapes: Shape[]; glow: Shape[] } {
  const { x, y } = blockPos(i, j);
  const h = HEIGHTS[i][j];
  const m = AQUA_BLOCKS.has(`${i},${j}`) ? MAT.aqua : MAT.bone;
  const b = slab(x, y, CORE.top, BLOCK.size, BLOCK.size, h, 0.14, m);
  const shapes = [...b.shapes];
  // a fine groove round its two visible faces, just below the cap: every
  // block is a module of one engineered set
  const gz = CORE.top + h - 0.2;
  const s1 = BLOCK.size;
  const r = 0.14;
  const groove = m === MAT.aqua ? 'rgba(31,69,70,0.28)' : 'rgba(37,49,58,0.15)';
  for (const [a2, b2] of [
    [[x + s1, y + r, gz], [x + s1, y + s1 - r, gz]],
    [[x + r, y + s1, gz], [x + s1 - r, y + s1, gz]],
  ] as [V3, V3][]) {
    shapes.push({ pts: [iso(a2), iso(b2)], stroke: groove, sw: 0.7, open: true });
    shapes.push({ pts: [iso([a2[0], a2[1], gz - 0.04]), iso([b2[0], b2[1], gz - 0.04])], stroke: 'rgba(255,255,255,0.55)', sw: 0.6, open: true });
  }
  // a small engraved mark on each top: the parts of the language
  const mark = (i * 3 + j) % 3;
  if (mark === 0) shapes.push(...textRows(b.cap, 0.3, 0.42, [0.9, 0.6], 0.24, 0.09, m === MAT.aqua ? 'rgba(31,69,70,0.5)' : INK_SOFT));
  else if (mark === 1) shapes.push(onRect(b.cap, 0.45, 0.45, 0.6, 0.6, 0.08, { fill: 'none', stroke: m === MAT.aqua ? 'rgba(31,69,70,0.45)' : 'rgba(79,145,138,0.5)', sw: 0.8 }));
  else shapes.push(onRect(b.cap, 0.3, 0.3, 0.42, 0.42, 0.05, { fill: m === MAT.aqua ? 'rgba(31,69,70,0.35)' : 'rgba(79,145,138,0.35)' }), onRect(b.cap, 0.82, 0.3, 0.38, 0.09, 0.045, { fill: INK_SOFT }), onRect(b.cap, 0.82, 0.5, 0.26, 0.09, 0.045, { fill: INK_SOFT }));
  // its top, lit, for the occasional illumination: a cool light on the bone
  // blocks, a brighter aqua on the aqua ones
  const glow: Shape[] = [{ pts: proj(b.cap, rrect(BLOCK.size, BLOCK.size, 0.14)), fill: m === MAT.aqua ? '#d6efea' : '#e3f3ef' }];
  return { shapes, glow };
}

const CANOPY_Z = 4.35;

/**
 * The four fine guides from the deck's corners up to the canopy's corners,
 * the framework the canopy is set on: back, left, right and front. Each is
 * its own part, so the front one is drawn over the blocks it stands before
 * and each can stretch from its own foot as the canopy rises.
 */
function guide(gx: number, gy: number): Shape[] {
  // the one at the back, seen through the glass, is fainter
  const alpha = gx < 0 && gy < 0 ? 0.24 : 0.42;
  return [{ pts: [iso([gx, gy, CORE.top]), iso([gx, gy, CANOPY_Z])], stroke: `rgba(31,69,70,${alpha})`, sw: 0.8, open: true, attrs: 'stroke-dasharray="2 3"' }];
}
const GUIDE_C = CORE.deck - 0.25;
const GUIDES = {
  back: [-GUIDE_C, -GUIDE_C],
  left: [-GUIDE_C, GUIDE_C],
  right: [GUIDE_C, -GUIDE_C],
  front: [GUIDE_C, GUIDE_C],
} as const;

const CANOPY = { s: 3.2, u: 0.9, v: 1.1, gap: 0.78 };

/** The glass canopy; its etched rows (the shared language) are a layer of their own, `etch`. */
function canopy(): { shapes: Shape[]; etch: Shape[]; breath: Shape[] } {
  const s = CANOPY.s;
  const c = slab(-s, -s, CANOPY_Z, s * 2, s * 2, 0.12, 0.38, MAT.glass, 'url(#iso-glass)');
  const shapes = [...c.shapes];
  const f = c.cap;
  // an inner border, then the shared language, etched in rows
  shapes.push({ pts: proj(f, rrect(s * 2 - 0.7, s * 2 - 0.7, 0.24), 0.35, 0.35), stroke: 'rgba(255,255,255,0.8)', sw: 0.8 });
  const rows = [
    [2.3, 1.0, 1.1],
    [1.5, 2.3],
    [3.0, 1.1],
    [1.1, 1.8, 1.0],
    [2.2, 1.4],
    [1.7, 1.0],
  ];
  const etch: Shape[] = [];
  rows.forEach((r, k) => {
    let u = CANOPY.u;
    r.forEach((len, n) => {
      const key = k === 2 && n === 0;
      etch.push(onRect(f, u, CANOPY.v + k * CANOPY.gap, len, 0.1, 0.05, { fill: key ? 'rgba(31,69,70,0.55)' : 'rgba(31,69,70,0.2)' }));
      u += len + 0.2;
    });
  });
  // its glass, lit from within by the foundation's teal, for the
  // structure's slow breath at idle (on the pale glass a lighter tint would
  // not show; a soft teal does, faintly)
  const breath: Shape[] = [{ pts: proj(f, rrect(s * 2, s * 2, 0.38)), fill: '#a9d8d0' }];
  return { shapes, etch, breath };
}

// ---- the floor ------------------------------------------------------------------------------
/** A soft contact shadow under a footprint, toward the lower right (a part of its own, so it arrives with its object). */
function shadow(cx: number, cy: number, s: number, r: number, k = 1): Shape[] {
  return [{ pts: proj({ o: [cx - s / 2 + 0.35 * k, cy - s / 2 + 0.12 * k, 0], a: [1, 0, 0], b: [0, 1, 0] }, rrect(s + 0.3, s + 0.3, r)), fill: 'rgba(37,49,58,0.12)', attrs: 'filter="url(#iso-soft)"' }];
}

interface Conduit {
  key: string;
  /** Points on the floor, in order of flow. */
  pts: [number, number][];
}

const CONDUITS: Conduit[] = [
  { key: 'interviews', pts: [[-9.85, 1.25], [-3.7, 1.25]] },
  { key: 'research', pts: [[-4.85, 5.6], [-1.8, 5.6], [-1.8, 3.7]] },
  { key: 'documents', pts: [[0.15, 10.4], [1.3, 10.4], [1.3, 3.7]] },
  { key: 'website', pts: [[1.25, -3.7], [1.25, -9.85]] },
  { key: 'documentation', pts: [[3.7, -1.5], [5.6, -1.5], [5.6, -4.85]] },
  { key: 'campaigns', pts: [[3.7, -0.4], [9.85, -0.4]] },
];

function floor(): { shapes: Shape[]; conduits: Shape[]; lit: Shape[] } {
  const shapes: Shape[] = [];
  // the grid, local to the system, fading out toward its edges (the stroke's gradient)
  const x0 = -12;
  const x1 = 14;
  const y0 = -13;
  const y1 = 13;
  for (let x = x0; x <= x1; x++) shapes.push({ pts: [iso([x, y0, 0]), iso([x, y1, 0])], stroke: 'url(#iso-grid-fade)', sw: 0.7, open: true });
  for (let y = y0; y <= y1; y++) shapes.push({ pts: [iso([x0, y, 0]), iso([x1, y, 0])], stroke: 'url(#iso-grid-fade)', sw: 0.7, open: true });
  // conduits: a channel set into the floor (a fine strip with a line down its middle), a port at each end
  const conduits: Shape[] = [];
  const lit: Shape[] = [];
  const W = 0.16;
  for (const c of CONDUITS) {
    const pts = c.pts.map(([x, y]) => iso([x, y, 0]));
    // the strip, one rectangle a stretch
    c.pts.slice(1).forEach(([x2, y2], i) => {
      const [x1, y1] = c.pts[i];
      const ax = x2 === x1 ? 0 : 1;
      const lo = [Math.min(x1, x2) - (ax ? 0 : W), Math.min(y1, y2) - (ax ? W : 0)];
      const hi = [Math.max(x1, x2) + (ax ? 0 : W), Math.max(y1, y2) + (ax ? W : 0)];
      conduits.push({ pts: [iso([lo[0], lo[1], 0]), iso([hi[0], lo[1], 0]), iso([hi[0], hi[1], 0]), iso([lo[0], hi[1], 0])], fill: 'rgba(37,49,58,0.07)' });
    });
    conduits.push({ pts, stroke: 'rgba(37,49,58,0.32)', sw: 0.8, open: true, attrs: 'stroke-linejoin="round"' });
    lit.push({ pts, stroke: AQUA, sw: 1.4, open: true, attrs: 'stroke-linejoin="round" stroke-linecap="round"' });
    const [sx, sy] = c.pts[0];
    conduits.push({ pts: proj({ o: [sx - 0.2, sy - 0.2, 0], a: [1, 0, 0], b: [0, 1, 0] }, rrect(0.4, 0.4, 0.08)), fill: '#f6f3ed', stroke: 'rgba(37,49,58,0.38)', sw: 0.7 });
    for (const [x, y] of c.pts.slice(1, -1)) {
      conduits.push({ pts: proj({ o: [x - 0.12, y - 0.12, 0], a: [1, 0, 0], b: [0, 1, 0] }, rrect(0.24, 0.24, 0.05)), fill: 'rgba(37,49,58,0.28)' });
    }
  }
  return { shapes, conduits, lit };
}

// ---- serializing ----------------------------------------------------------------------------
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const d = (pts: readonly P2[], close: boolean) => `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}${close ? 'Z' : ''}`;

function svg(shapes: Shape[], dx: number, dy: number): string {
  const move = (pts: readonly P2[]): P2[] => pts.map(([x, y]) => [x + dx, y + dy]);
  return shapes
    .map((s) => {
      const path = s.hole ? `${d(move(s.pts), true)}${d(move(s.hole), true)}` : d(move(s.pts), !s.open);
      const attrs = [
        `d="${path}"`,
        s.hole ? 'fill-rule="evenodd"' : '',
        `fill="${s.open ? 'none' : (s.fill ?? 'none')}"`,
        s.stroke ? `stroke="${s.stroke}" stroke-width="${s.sw ?? 1}"` : '',
        s.op !== undefined ? `opacity="${s.op}"` : '',
        s.attrs ?? '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<path ${attrs}/>`;
    })
    .join('');
}

function bounds(shapes: Shape[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of shapes) {
    for (const [x, y] of s.pts) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

// ---- the timeline ----------------------------------------------------------------------------
/**
 * The assembly, in seconds from the page's first paint: the floor, the base
 * rising, the inputs rising onto their plinths, the foundation's blocks set
 * down in a wave, its guides and its canopy, the expressions emerging once the
 * foundation stands, then the connections resolving (the light runs once from
 * the inputs through the foundation to the expressions) before the idle cycle.
 */
const TL = {
  floor: { at: 0.1, dur: 0.7 },
  base: { at: 0.2, dur: 0.9, from: 0.6 },
  inPlinth: { at: 0.4, step: 0.1, dur: 0.85, from: 0.9 },
  inObj: { at: 0.55, step: 0.1, dur: 0.9, from: 1.4 },
  block: { at: 0.95, step: 0.08, dur: 0.8, from: -0.9 },
  guide: { at: 1.4, step: 0.05, dur: 0.7 },
  canopy: { at: 1.65, dur: 1.0, from: -2.6 },
  conduits: { at: 1.9, dur: 0.6 },
  outPlinth: { at: 2.2, step: 0.1, dur: 0.85, from: 0.9 },
  outObj: { at: 2.35, step: 0.1, dur: 0.9, from: 1.4 },
  lit: { in: 2.3, out: 3.1, step: 0.08, run: 0.6, hold: 3.9, fade: 0.6 },
  flash: { at: 2.9, step: 0.07, dur: 0.9 },
  idle: 4.7,
};

/**
 * The idle cycle: three hand-offs, one after another, each a single signal
 * from an input along its conduit into the foundation, a soft light passing
 * through three of its blocks, and a signal out to one expression. The Events
 * V1.1 brief's companion pass made this a little more perceptible: a signal
 * every four seconds (it was five) and the lights at the nodes held longer;
 * the canopy breathes slowly (BREATH) and floats a touch more.
 */
const IDLE = { cycle: 12, run: 1.3, glow: 1.3, node: 1.2 };
const BREATH = 6.4;
const HANDOFFS = [
  { from: 'interviews', to: 'website', blocks: ['0,1', '1,1', '1,0'] },
  { from: 'research', to: 'documentation', blocks: ['0,2', '1,1', '2,0'] },
  { from: 'documents', to: 'campaigns', blocks: ['1,2', '1,1', '2,1'] },
];
/** Engaged: every input at once into the foundation, then every expression at once, more often. */
const HOVER = { cycle: 3.4, in: [0, 1.0], out: [1.25, 2.25] };
const FLOAT = 7;

const pc = (f: number) => `${+(Math.min(1, Math.max(0, f)) * 100).toFixed(3)}%`;

/** A keyframes rule from (offset, declarations) pairs; equal offsets merge. */
function keyframes(name: string, frames: [number, string][]): string {
  const at = new Map<string, string[]>();
  for (const [f, decl] of [...frames].sort((a, b) => a[0] - b[0])) {
    const k = pc(f);
    at.set(k, [...(at.get(k) ?? []), decl]);
  }
  return `@keyframes ${name}{${[...at].map(([k, decls]) => `${k}{${decls.join(';')}}`).join('')}}`;
}

/**
 * A signal crossing one stretch of a conduit between s0 and s1 (fractions of
 * its cycle): it fades in on the first stretch, out on the last, and hands
 * over at each turn to the next stretch's.
 */
function sparkFrames(name: string, s0: number, s1: number, first: boolean, last: boolean, cycle: number): string {
  const eps = 0.0001;
  const fi = Math.min(0.15, 0.6 * (s1 - s0) * cycle) / cycle;
  const fo = Math.min(0.25, 0.6 * (s1 - s0) * cycle) / cycle;
  const frames: [number, string][] = [
    [0, 'opacity:0;transform:translateX(0)'],
    [s0, 'opacity:0;transform:translateX(0)'],
    [first ? s0 + fi : s0 + eps, 'opacity:1'],
  ];
  if (last) frames.push([s1 - fo, 'opacity:1'], [s1, 'opacity:0;transform:translateX(100%)']);
  else frames.push([s1, 'opacity:1;transform:translateX(100%)'], [s1 + eps, 'opacity:0']);
  frames.push([1, 'opacity:0;transform:translateX(100%)']);
  return keyframes(name, frames);
}

/** A light rising and fading in each of its windows (seconds within the idle cycle). */
function glowFrames(name: string, windows: [number, number][]): string {
  const frames: [number, string][] = [
    [0, 'opacity:0'],
    [1, 'opacity:0'],
  ];
  for (const [a, b] of windows) {
    frames.push([a / IDLE.cycle, 'opacity:0'], [(a + (b - a) * 0.35) / IDLE.cycle, 'opacity:1'], [b / IDLE.cycle, 'opacity:0']);
  }
  return keyframes(name, frames);
}

// ---- the scene ------------------------------------------------------------------------------
export interface IsoPart {
  id: string;
  group: Group;
  /** Box in design units, relative to the stage. */
  x: number;
  y: number;
  w: number;
  h: number;
  svg: string;
  /** Its light (a block's top, a plinth's inlay), drawn above it and faded in and out. */
  glow?: string;
  /** The canopy's etched rows, which give way to the words while engaged. */
  etch?: string;
  /** The canopy's lit glass, for its slow breath at idle. */
  breath?: string;
  /** Assembly: start and length (s) and travel (cqw, + from below); a guide grows from its foot instead. */
  delay: number;
  dur: number;
  from: number;
  grow: boolean;
  /** A guide's foot, as a fraction of the part's height. */
  foot?: number;
  /** Engaged: rise (cqw) and its lag (s); a guide stretches (scale) with the canopy instead. */
  lift: number;
  lag: number;
  stretch?: number;
  /** Idle: float amplitude (cqw) and phase (s). */
  float: number;
  phase: number;
  /** The keyframes of its light in the idle cycle, and the one-time flash's start (s). */
  glowAnim?: string;
  flash?: number;
}

export interface IsoPulse {
  key: string;
  conduit: string;
  dir: 'in' | 'out';
  /** Start in design units, length and angle on screen. */
  x: number;
  y: number;
  len: number;
  angle: number;
  /** Keyframes in the idle cycle and in the engaged one. */
  idle: string;
  hover: string;
}

export interface IsoLabel {
  key: string;
  /** Anchor in design units, relative to the stage. */
  x: number;
  y: number;
  /**
   * How it lies on the floor (or the glass): along +x, reading down to the
   * right, or along -y, reading up to the right; it starts at the anchor, or
   * is centered on it.
   */
  dir: 'x' | '-y';
  align: 'start' | 'center';
  group: 'in' | 'core' | 'out';
  order: number;
  /** The core's rides on the canopy: its rise, lag and float. */
  lift?: number;
  lag?: number;
  float?: number;
  phase?: number;
}

export interface IsoScene {
  w: number;
  h: number;
  parts: IsoPart[];
  pulses: IsoPulse[];
  labels: IsoLabel[];
  /** The floor's markup (static) and its conduits; the conduits' light, path by path. */
  floor: { svg: string; conduits: string; lit: { key: string; d: string; delay: number }[] };
  /** A polygon round the system, for the pointer's area (CSS percentages). */
  hit: string;
  defs: string;
  /** Every keyframes rule the scene's timeline needs (signals, lights, the light's one run). */
  keyframes: string;
  timing: {
    floor: { at: number; dur: number };
    conduits: { at: number; dur: number };
    lit: { at: number; dur: number; run: number };
    idle: number;
    idleCycle: number;
    hoverCycle: number;
    float: number;
    breath: number;
  };
}

let built: IsoScene | null = null;

/** The scene, built once per build (the hero and the page's head both read it). */
export function isoScene(): IsoScene {
  built ??= buildScene();
  return built;
}

function buildScene(): IsoScene {
  const defs: PartDef[] = [];
  const flashAt = new Map<string, number>();
  // the contact shadows first, under everything, each arriving with its object
  const shade = (id: string, group: Group, delay: number, shapes: Shape[]): PartDef => ({ id, group, delay: +(delay + 0.15).toFixed(3), dur: 0.8, from: 0, shapes });
  IN.forEach((p, k) => defs.push(shade(`in-${p.key}-shadow`, 'in', TL.inPlinth.at + k * TL.inPlinth.step, shadow(p.x, p.y, 2.8, 0.4))));
  defs.push(shade('core-shadow', 'core', TL.base.at, shadow(0, 0, CORE.half * 2, 0.6, 1.6)));
  OUT.forEach((q, k) => defs.push(shade(`out-${q.key}-shadow`, 'out', TL.outPlinth.at + k * TL.outPlinth.step, shadow(q.x, q.y, 2.8, 0.4))));
  // inputs: plinth, then the object on it
  const inObj = [interviews, research, documents];
  IN.forEach((p, k) => {
    const pl = plinth(p.x, p.y);
    defs.push({ id: `in-${p.key}-plinth`, group: 'in', delay: TL.inPlinth.at + k * TL.inPlinth.step, dur: TL.inPlinth.dur, from: TL.inPlinth.from, glow: pl.glow, shapes: pl.shapes });
    flashAt.set(`in-${p.key}-plinth`, TL.lit.in + k * TL.lit.step - 0.1);
    defs.push({ id: `in-${p.key}`, group: 'in', delay: TL.inObj.at + k * TL.inObj.step, dur: TL.inObj.dur, from: TL.inObj.from, lift: 0.45, shapes: inObj[k](p.x, p.y) });
  });
  // the foundation: base and deck; the back guide, the blocks in depth order
  // and the side guides; the front guide over the blocks; the canopy
  defs.push({ id: 'core-base', group: 'core', delay: TL.base.at, dur: TL.base.dur, from: TL.base.from, shapes: coreBase() });
  const blocks: { key: number; def: PartDef }[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const { x, y } = blockPos(i, j);
      const b = block(i, j);
      const order = i + j;
      blocks.push({
        key: x + y + BLOCK.size,
        def: { id: `core-block-${i}${j}`, group: 'core', delay: TL.block.at + order * TL.block.step, dur: TL.block.dur, from: TL.block.from, lift: 0.16 + 0.12 * HEIGHTS[i][j], glow: b.glow, shapes: b.shapes },
      });
      // the light passes through the foundation from the inputs' side to the expressions'
      flashAt.set(`core-block-${i}${j}`, TL.flash.at + (i - j + 2) * TL.flash.step);
    }
  }
  blocks.sort((a, b) => a.key - b.key);
  const guideDef = (side: keyof typeof GUIDES, k: number): PartDef => ({
    id: `core-guide-${side}`,
    group: 'core',
    delay: TL.guide.at + k * TL.guide.step,
    dur: TL.guide.dur,
    from: 0,
    grow: true,
    shapes: guide(GUIDES[side][0], GUIDES[side][1]),
  });
  defs.push(guideDef('back', 0), guideDef('left', 1), guideDef('right', 1));
  defs.push(...blocks.map((c) => c.def));
  defs.push(guideDef('front', 2));
  const can = canopy();
  defs.push({ id: 'core-canopy', group: 'core', delay: TL.canopy.at, dur: TL.canopy.dur, from: TL.canopy.from, lift: 1.1, float: 0.09, phase: 0, shapes: can.shapes, etch: can.etch, breath: can.breath });
  // the expressions
  const outObj = [website, documentation, campaigns];
  OUT.forEach((q, k) => {
    const pl = plinth(q.x, q.y);
    defs.push({ id: `out-${q.key}-plinth`, group: 'out', delay: TL.outPlinth.at + k * TL.outPlinth.step, dur: TL.outPlinth.dur, from: TL.outPlinth.from, glow: pl.glow, shapes: pl.shapes });
    flashAt.set(`out-${q.key}-plinth`, TL.lit.out + k * TL.lit.step + TL.lit.run - 0.05);
    defs.push({ id: `out-${q.key}`, group: 'out', delay: TL.outObj.at + k * TL.outObj.step, dur: TL.outObj.dur, from: TL.outObj.from, lift: 0.4, float: 0.08, phase: 1.9 * k + 1, shapes: outObj[k](q.x, q.y) });
  });

  const fl = floor();

  // The stage: everything, the canopy's raised position included, with room
  // round it (the soft shadows may spill into that room). The labels, shown
  // only while the system is engaged, may reach a little past it, into the
  // margin beside it.
  const all: Shape[] = [...fl.conduits, ...defs.filter((x) => !x.id.endsWith('shadow')).flatMap((x) => x.shapes)];
  const raw = bounds(all);
  const canopyLift = iso([0, 0, 1.1])[1] - iso([0, 0, 0])[1];
  const pad = 14;
  const minX = raw.minX - pad;
  const minY = raw.minY + canopyLift - pad;
  const w = raw.maxX - raw.minX + pad * 2;
  const h = raw.maxY + pad - minY;
  const dx = -minX;
  const dy = -minY;
  const cq = (gridUnits: number) => +((gridUnits * U * 100) / w).toFixed(3); // grid units of height to cqw
  const move = (p: P2): P2 => [p[0] + dx, p[1] + dy];

  // The idle cycle's lights: which windows each block and plinth is lit in.
  const lights = new Map<string, [number, number][]>();
  const light = (id: string, a: number, b: number) => lights.set(id, [...(lights.get(id) ?? []), [a, b]]);
  const span = IDLE.cycle / HANDOFFS.length;
  HANDOFFS.forEach((hnd, k) => {
    const b0 = k * span;
    light(`in-${hnd.from}-plinth`, b0, b0 + IDLE.node);
    hnd.blocks.forEach((key, n) => light(`core-block-${key.replace(',', '')}`, b0 + IDLE.run - 0.1 + n * 0.3, b0 + IDLE.run - 0.1 + n * 0.3 + IDLE.glow));
    light(`out-${hnd.to}-plinth`, b0 + IDLE.run + 0.7 + IDLE.run - 0.15, b0 + IDLE.run + 0.7 + IDLE.run + IDLE.node);
  });
  const css: string[] = [];

  const guideLen = CANOPY_Z - CORE.top;
  const parts: IsoPart[] = defs.map((p) => {
    const b = bounds(p.shapes);
    const m = 3;
    const x = Math.floor(b.minX + dx - m);
    const y = Math.floor(b.minY + dy - m);
    const pw = Math.ceil(b.maxX + dx + m) - x;
    const ph = Math.ceil(b.maxY + dy + m) - y;
    const windows = lights.get(p.id);
    const glowAnim = windows ? `iso-g-${p.id}` : undefined;
    if (glowAnim && windows) css.push(glowFrames(glowAnim, windows));
    const group = p.group;
    const order = p.id.startsWith('core-block-') ? Number(p.id[11]) + Number(p.id[12]) : 0;
    return {
      id: p.id,
      group,
      x,
      y,
      w: pw,
      h: ph,
      svg: svg(p.shapes, dx, dy),
      glow: p.glow ? svg(p.glow, dx, dy) : undefined,
      etch: p.etch ? svg(p.etch, dx, dy) : undefined,
      breath: p.breath ? svg(p.breath, dx, dy) : undefined,
      delay: +p.delay.toFixed(3),
      dur: p.dur,
      from: cq(p.from),
      grow: Boolean(p.grow),
      foot: p.grow ? +((b.maxY + dy - y) / ph).toFixed(4) : undefined,
      lift: cq(p.lift ?? 0),
      lag: group === 'out' ? 0.1 : p.id === 'core-canopy' || p.grow ? 0.06 : p.id.startsWith('core-block-') ? +(0.03 + 0.025 * order).toFixed(3) : 0,
      stretch: p.grow ? +((guideLen + 1.1) / guideLen).toFixed(4) : undefined,
      float: cq(p.float ?? 0),
      phase: p.phase ?? 0,
      glowAnim,
      flash: flashAt.get(p.id),
    };
  });

  // Signals: each conduit's stretches, crossed in turn within its window of the cycle.
  const pulses: IsoPulse[] = [];
  for (const c of CONDUITS) {
    const pts = c.pts.map(([x, y]) => iso([x, y, 0]));
    const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
    const total = lens.reduce((s, l) => s + l, 0);
    const dir = IN.some((s) => s.key === c.key) ? 'in' : 'out';
    const k = HANDOFFS.findIndex((hnd) => hnd.from === c.key || hnd.to === c.key);
    const i0 = k * span + (dir === 'in' ? 0 : IDLE.run + 0.7);
    const idleWin: [number, number] = [i0 / IDLE.cycle, (i0 + IDLE.run) / IDLE.cycle];
    const hoverWin = (dir === 'in' ? HOVER.in : HOVER.out).map((t) => t / HOVER.cycle) as [number, number];
    let acc = 0;
    pts.slice(1).forEach((q, i) => {
      const a = pts[i];
      const f0 = acc / total;
      acc += lens[i];
      const f1 = acc / total;
      const at = (win: [number, number], f: number) => win[0] + (win[1] - win[0]) * f;
      const first = i === 0;
      const last = i === lens.length - 1;
      const idle = `iso-s-${c.key}-${i}`;
      const hover = `iso-h-${c.key}-${i}`;
      css.push(sparkFrames(idle, at(idleWin, f0), at(idleWin, f1), first, last, IDLE.cycle));
      css.push(sparkFrames(hover, at(hoverWin, f0), at(hoverWin, f1), first, last, HOVER.cycle));
      pulses.push({
        key: `${c.key}-${i}`,
        conduit: c.key,
        dir,
        x: +(a[0] + dx).toFixed(2),
        y: +(a[1] + dy).toFixed(2),
        len: +lens[i].toFixed(2),
        angle: +((Math.atan2(q[1] - a[1], q[0] - a[0]) * 180) / Math.PI).toFixed(2),
        idle,
        hover,
      });
    });
  }

  // The light's one run along the conduits as the system resolves.
  const lit = CONDUITS.map((c) => {
    const dir = IN.some((s) => s.key === c.key) ? 'in' : 'out';
    const k = (dir === 'in' ? IN : OUT).findIndex((s) => s.key === c.key);
    const pts = c.pts.map(([x, y]) => move(iso([x, y, 0])));
    return { key: c.key, d: d(pts, false), delay: +((dir === 'in' ? TL.lit.in : TL.lit.out) + k * TL.lit.step).toFixed(3) };
  });
  const litDur = TL.lit.hold + TL.lit.fade - TL.lit.in;
  css.push(keyframes('iso-lit-run', [
    [0, 'opacity:1'],
    [(TL.lit.hold - TL.lit.in) / litDur, 'opacity:1'],
    [1, 'opacity:0'],
  ]));

  // Labels, on the floor in front of the plinth face that looks out of the
  // composition, where no conduit arrives: an input's lower-left face (the
  // words run down to the right from its left corner), an expression's
  // lower-right face (the words run up to the right from its front corner).
  // The foundation's is centered across its glass, toward the back, and rides
  // with it.
  const lab = (key: string, g: V3, dir: 'x' | '-y', align: 'start' | 'center', group: 'in' | 'core' | 'out', order: number): IsoLabel => {
    const [x, y] = move(iso(g));
    return { key, x: +x.toFixed(2), y: +y.toFixed(2), dir, align, group, order };
  };
  const edge = 1.4 + 0.5;
  const canopyPart = parts.find((p) => p.id === 'core-canopy') as IsoPart;
  const labels: IsoLabel[] = [
    ...IN.map((q, k) => lab(q.key, [q.x - 1.4, q.y + edge, 0], 'x', 'start', 'in', k)),
    {
      // toward the back of the glass, clear of the tallest block beneath it
      ...lab('core', [-1.2, -1.2, CANOPY_Z + 0.12], 'x', 'center', 'core', 0),
      lift: canopyPart.lift,
      lag: canopyPart.lag,
      float: canopyPart.float,
      phase: canopyPart.phase,
    },
    ...OUT.map((q, k) => lab(q.key, [q.x + edge, q.y + 1.4, 0], '-y', 'start', 'out', k)),
  ];

  // The pointer's area: the hull of the parts' boxes, as CSS percentages.
  const corners: P2[] = parts.flatMap((p) => [
    [p.x, p.y],
    [p.x + p.w, p.y],
    [p.x + p.w, p.y + p.h],
    [p.x, p.y + p.h],
  ]);
  const hull = convexHull(corners);
  const hit = hull.map(([x, y]) => `${((x / w) * 100).toFixed(2)}% ${((y / h) * 100).toFixed(2)}%`).join(', ');

  const gc = iso([1, -1, 0]);
  const defsSvg =
    `<radialGradient id="iso-grid-fade" gradientUnits="userSpaceOnUse" cx="${f1(gc[0] + dx)}" cy="${f1(gc[1] + dy)}" r="${f1(w * 0.5)}" gradientTransform="translate(${f1(gc[0] + dx)} ${f1(gc[1] + dy)}) scale(1 0.62) translate(${f1(-(gc[0] + dx))} ${f1(-(gc[1] + dy))})">` +
    '<stop offset="0" stop-color="#25313a" stop-opacity="0.13"/><stop offset="0.55" stop-color="#25313a" stop-opacity="0.08"/><stop offset="1" stop-color="#25313a" stop-opacity="0"/></radialGradient>' +
    '<filter id="iso-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>' +
    '<linearGradient id="iso-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.8"/><stop offset="0.55" stop-color="#dcefeb" stop-opacity="0.55"/><stop offset="1" stop-color="#a9d0ca" stop-opacity="0.65"/></linearGradient>';

  return {
    w: Math.ceil(w),
    h: Math.ceil(h),
    parts,
    pulses,
    labels,
    floor: { svg: svg(clipLines(fl.shapes, -dx, -dy, w - dx, h - dy), dx, dy), conduits: svg(fl.conduits, dx, dy), lit },
    hit,
    defs: defsSvg,
    keyframes: css.join(''),
    timing: {
      floor: TL.floor,
      conduits: TL.conduits,
      lit: { at: TL.lit.in, dur: +litDur.toFixed(3), run: TL.lit.run },
      idle: TL.idle,
      idleCycle: IDLE.cycle,
      hoverCycle: HOVER.cycle,
      float: FLOAT,
      breath: BREATH,
    },
  };
}

/**
 * The grid's lines cut to the stage (Liang-Barsky): beyond it they are faded
 * out anyway, and a floor no larger than the stage keeps the hero's fade and
 * blur, as the Foundation rises over it, as cheap as the drawing allows.
 */
function clipLines(shapes: Shape[], x0: number, y0: number, x1: number, y1: number): Shape[] {
  const out: Shape[] = [];
  for (const sh of shapes) {
    if (!sh.open || sh.pts.length !== 2) {
      out.push(sh);
      continue;
    }
    const [[ax, ay], [bx, by]] = sh.pts;
    const ddx = bx - ax;
    const ddy = by - ay;
    let t0 = 0;
    let t1 = 1;
    let keep = true;
    for (const [pp, qq] of [
      [-ddx, ax - x0],
      [ddx, x1 - ax],
      [-ddy, ay - y0],
      [ddy, y1 - ay],
    ] as [number, number][]) {
      if (pp === 0) {
        if (qq < 0) keep = false;
        continue;
      }
      const r = qq / pp;
      if (pp < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
    if (!keep || t0 >= t1) continue;
    out.push({ ...sh, pts: [[ax + ddx * t0, ay + ddy * t0], [ax + ddx * t1, ay + ddy * t1]] });
  }
  return out;
}

function convexHull(points: P2[]): P2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const crossZ = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P2[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
