/**
 * The hero's narrative-system object (Technical Product Marketing, V1.4):
 * geometry for six stacked layers in isometric projection, drawn at build
 * time. Bottom to top: the foundation (research and interviews, the shared
 * internal language, positioning and claims) and the market expressions it
 * carries (the website, technical documentation, campaigns and content).
 *
 * Every polygon is in the object's own units, in its compact (rest) position.
 * The exploded (open) state is a translation per layer, applied by CSS; the
 * posts that join the layers and the label anchors are drawn for the open
 * state. Nothing here runs in the browser.
 */

export type Pt = [number, number];

export interface LayerSpec {
  label: string;
  name: string;
}

export interface Layer {
  index: number;
  group: 0 | 1;
  label: string;
  name: string;
  tone: 'deep' | 'core' | 'mid' | 'paper' | 'fog';
  top: string;
  left: string;
  right: string;
  marks: Array<{ kind: 'line'; x1: number; y1: number; x2: number; y2: number } | { kind: 'dot'; cx: number; cy: number; r: number } | { kind: 'ring'; cx: number; cy: number; rx: number; ry: number } | { kind: 'block'; points: string }>;
  /** The open state's translation, in units (CSS px inside the SVG). */
  dx: number;
  dy: number;
  /** Posts down to the layer below, in this layer's own (untranslated) frame. */
  posts: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  /** Where its label's leader meets it in the open state, as a share of the view box. */
  anchor: { x: number; y: number };
}

export interface System {
  viewBox: { x: number; y: number; w: number; h: number };
  layers: Layer[];
  /** Silhouettes (convex hulls) of the compact and the open stack, in units. */
  hull: { rest: Pt[]; open: Pt[] };
  /** The same, pushed outward, for the focus ring. */
  ring: { rest: string; open: string };
  /** Where each group's heading sits in the open state (the middle of the gap above its first label), as a share of the view box height. */
  groupTop: [number, number];
}

const C = Math.cos(Math.PI / 6);
const iso = (x: number, y: number, z: number): Pt => [(x - y) * C, (x + y) * 0.5 - z];
const f = (v: number) => Number(v.toFixed(2));
const poly = (pts: Pt[]) => pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

// Half-widths and thicknesses, bottom to top; the gaps of the compact stack
// and of the open one (within the foundation, between the two groups, within
// the expressions); and the slight fan of the three expressions.
const HALF = [116, 104, 92, 78, 68, 58];
const THICK = [9, 9, 9, 7, 7, 7];
const TONES: Layer['tone'][] = ['deep', 'core', 'mid', 'paper', 'fog', 'paper'];
const REST_GAP = 2.5;
const OPEN_GAPS = [26, 26, 66, 34, 34];
const FAN = [0, 0, 0, -16, 0, 16];

function hull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** A convex polygon pushed outward by d (each edge moved out, corners rejoined). */
function grow(poly: Pt[], d: number): Pt[] {
  const n = poly.length;
  const lines = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const ex = q[0] - p[0];
    const ey = q[1] - p[1];
    const len = Math.hypot(ex, ey) || 1;
    // outward normal for a clockwise-on-screen hull (y down): (ey, -ex)
    const nx = ey / len;
    const ny = -ex / len;
    return { p: [p[0] + nx * d, p[1] + ny * d] as Pt, e: [ex, ey] as Pt };
  });
  return lines.map((l, i) => {
    const m = lines[(i + n - 1) % n];
    // intersect m (through m.p along m.e) with l (through l.p along l.e)
    const det = m.e[0] * l.e[1] - m.e[1] * l.e[0];
    if (Math.abs(det) < 1e-6) return l.p;
    const t = ((l.p[0] - m.p[0]) * l.e[1] - (l.p[1] - m.p[1]) * l.e[0]) / det;
    return [m.p[0] + m.e[0] * t, m.p[1] + m.e[1] * t] as Pt;
  });
}

function signedArea(p: Pt[]) {
  let a = 0;
  p.forEach((pt, i) => {
    const q = p[(i + 1) % p.length];
    a += pt[0] * q[1] - q[0] * pt[1];
  });
  return a / 2;
}

export function narrativeSystem(specs: LayerSpec[][]): System {
  const flat = specs.flatMap((group, g) => group.map((spec) => ({ ...spec, group: g as 0 | 1 })));
  if (flat.length !== HALF.length) throw new Error(`[tpm] the narrative system draws ${HALF.length} layers; tpm.json lists ${flat.length}`);

  // Heights: the base of each layer, compact and open.
  const rest: number[] = [];
  const open: number[] = [];
  HALF.forEach((_, i) => {
    rest.push(i ? rest[i - 1] + THICK[i - 1] + REST_GAP : 0);
    open.push(i ? open[i - 1] + THICK[i - 1] + OPEN_GAPS[i - 1] : 0);
  });

  // The projected points of a layer (its top face and the feet of its sides).
  const outline = (i: number, z: number, dx = 0): Pt[] => {
    const h = HALF[i];
    const top = z + THICK[i];
    return [iso(-h, -h, top), iso(h, -h, top), iso(h, h, top), iso(-h, h, top), iso(h, -h, z), iso(h, h, z), iso(-h, h, z)].map(([x, y]) => [x + dx, y] as Pt);
  };

  // Open the stack about the compact stack's middle, so it grows both ways.
  const restPts = HALF.flatMap((_, i) => outline(i, rest[i]));
  const openPtsRaw = HALF.flatMap((_, i) => outline(i, open[i], FAN[i]));
  const midY = (pts: Pt[]) => (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
  const shift = midY(restPts) - midY(openPtsRaw);
  const openPts = openPtsRaw.map(([x, y]) => [x, y + shift] as Pt);

  const layers: Layer[] = flat.map((spec, i) => {
    const h = HALF[i];
    const z = rest[i];
    const top = z + THICK[i];
    const on = (x: number, y: number) => iso(x, y, top);
    const line = (y: number, x0: number, x1: number) => {
      const [a, b] = [on(x0, y), on(x1, y)];
      return { kind: 'line' as const, x1: f(a[0]), y1: f(a[1]), x2: f(b[0]), y2: f(b[1]) };
    };
    const marks: Layer['marks'] = [];
    if (i === 0) {
      // Research: scattered points of input, toward the front
      for (const [x, y, r] of [[0.52, 0.3, 2.6], [0.66, 0.55, 2.2], [0.38, 0.62, 2.4], [0.74, 0.22, 1.9], [0.55, 0.78, 2], [0.24, 0.8, 1.8], [0.8, 0.72, 2.2]]) {
        const [cx, cy] = on(x * h, y * h);
        marks.push({ kind: 'dot', cx: f(cx), cy: f(cy), r });
      }
    } else if (i === 1) {
      // The shared language: a few lines of a lexicon
      marks.push(line(h * 0.46, h * 0.08, h * 0.78), line(h * 0.64, h * 0.08, h * 0.58), line(h * 0.82, h * 0.08, h * 0.7));
    } else if (i === 2) {
      // Positioning: a target
      const [cx, cy] = on(h * 0.52, h * 0.52);
      marks.push({ kind: 'ring', cx: f(cx), cy: f(cy), rx: f(h * 0.3 * Math.SQRT2 * C), ry: f(h * 0.3 * Math.SQRT1_2) });
    } else if (i === 3) {
      // The website: a page, a block and lines
      marks.push({ kind: 'block', points: poly([on(-h * 0.62, -h * 0.62), on(h * 0.1, -h * 0.62), on(h * 0.1, h * 0.06), on(-h * 0.62, h * 0.06)]) });
      marks.push(line(h * 0.36, -h * 0.62, h * 0.5), line(h * 0.58, -h * 0.62, h * 0.24));
    } else if (i === 4) {
      // Documentation: running text
      marks.push(line(-h * 0.5, -h * 0.62, h * 0.55), line(-h * 0.22, -h * 0.62, h * 0.3), line(h * 0.06, -h * 0.62, h * 0.48), line(h * 0.34, -h * 0.62, h * 0.12));
    } else {
      // Campaigns and content: a signal
      const [cx, cy] = on(0, 0);
      marks.push({ kind: 'ring', cx: f(cx), cy: f(cy), rx: f(h * 0.42 * Math.SQRT2 * C), ry: f(h * 0.42 * Math.SQRT1_2) });
      marks.push({ kind: 'dot', cx: f(cx), cy: f(cy), r: 3.4 });
    }

    // The open translation: up by the opened height, the fan sideways.
    const dx = FAN[i];
    const dy = -(open[i] - rest[i]) + shift;

    // Posts from this layer's side corners down to the layer below (open
    // state), expressed in this layer's own frame (so subtract its offset).
    const posts: Layer['posts'] = [];
    if (i > 0) {
      const below = open[i - 1] + THICK[i - 1];
      for (const [x, y] of [[-h, h], [h, -h]] as Pt[]) {
        const [px] = iso(x, y, 0);
        const headY = iso(x, y, open[i])[1] + shift;
        const footY = iso(x, y, below)[1] + shift;
        const headX = px + FAN[i];
        const footX = px + FAN[i - 1];
        posts.push({ x1: f(headX - dx), y1: f(headY - dy), x2: f(footX - dx), y2: f(footY - dy) });
      }
    }

    // The label anchor: the left corner of the layer, halfway down its edge.
    const [ax] = iso(-h, h, 0);
    const ay = iso(-h, h, open[i] + THICK[i] / 2)[1] + shift;
    return {
      index: i,
      group: spec.group,
      label: spec.label,
      name: spec.name,
      tone: TONES[i],
      top: poly([on(-h, -h), on(h, -h), on(h, h), on(-h, h)]),
      right: poly([on(h, -h), on(h, h), iso(h, h, z), iso(h, -h, z)]),
      left: poly([on(-h, h), on(h, h), iso(h, h, z), iso(-h, h, z)]),
      marks,
      dx: f(dx),
      dy: f(dy),
      posts,
      anchor: { x: ax + FAN[i], y: ay },
    };
  });

  let restHull = hull(restPts);
  let openHull = hull(openPts);
  if (signedArea(restHull) < 0) restHull = restHull.reverse();
  if (signedArea(openHull) < 0) openHull = openHull.reverse();
  const ringRest = grow(restHull, 10);
  const ringOpen = grow(openHull, 10);

  const all = [...ringRest, ...ringOpen];
  const minX = Math.min(...all.map((p) => p[0])) - 4;
  const maxX = Math.max(...all.map((p) => p[0])) + 4;
  const minY = Math.min(...all.map((p) => p[1])) - 4;
  const maxY = Math.max(...all.map((p) => p[1])) + 4;
  const viewBox = { x: f(minX), y: f(minY), w: f(maxX - minX), h: f(maxY - minY) };

  for (const l of layers) l.anchor = { x: f((l.anchor.x - viewBox.x) / viewBox.w), y: f((l.anchor.y - viewBox.y) / viewBox.h) };
  // Each group's heading sits in the middle of the gap above its first label:
  // the foundation's between the two groups, the expressions' as far above.
  const ys = (g: 0 | 1) => layers.filter((l) => l.group === g).map((l) => l.anchor.y);
  const half = (Math.min(...ys(0)) - Math.max(...ys(1))) / 2;
  const groupTop: [number, number] = [f(Math.min(...ys(0)) - half), f(Math.min(...ys(1)) - half)];

  return {
    viewBox,
    layers,
    hull: { rest: restHull, open: openHull },
    ring: { rest: poly(ringRest), open: poly(ringOpen) },
    groupTop,
  };
}
