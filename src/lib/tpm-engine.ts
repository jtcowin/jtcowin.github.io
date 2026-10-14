/**
 * The Narrative Engine (Technical Product Marketing hero, V1.5): geometry for
 * the hero's system visual, drawn at build time. Nothing here runs in the
 * browser.
 *
 * One central core, a nucleus inside a ring of short radial marks (a voice
 * print of the shared product language), with a sparse system of faint nodes
 * and connections around it. Engaged, the system expands: the marks lengthen
 * into their full pattern from the input side round to the output side, the
 * core's rings widen, the five named nodes move out to their places, and the
 * connections light in sequence, from the two inputs into the core and from
 * the core out to the three outputs.
 *
 * The geometry is radial and curved on purpose: the product architecture
 * diagram later on the page is boxes joined by right-angled connectors, top to
 * bottom; this one is a lens, read left to right. Units are the view box's
 * (600 by 470); every position the page needs as a share of the box is given
 * as a percentage.
 */

export type Pt = { x: number; y: number };

export interface EngineNode {
  key: string;
  side: 'in' | 'out';
  label: string;
  rest: Pt;
  open: Pt;
  /** The open position minus the rest position (units), for the CSS move. */
  dx: number;
  dy: number;
  /** Order of arrival (0 based) within its side, for the light's sequence. */
  order: number;
}

export interface Engine {
  w: number;
  h: number;
  c: Pt;
  core: {
    nucleus: number;
    inner: number;
    spark: number;
    /** Radius of the dotted ring at rest and of the solid one once open. */
    ring: number;
    ringOpen: number;
    /** The large faint orbit. */
    orbit: number;
    /** The marks of the voice print: drawn at full (open) length; `rest` is the share shown at rest. */
    marks: Array<{ x1: number; y1: number; x2: number; y2: number; rest: number; delay: number }>;
  };
  nodes: EngineNode[];
  /** The faint connections of the resting system, rest node to core ring. */
  restWires: Array<{ d: string }>;
  /** The lit connections of the open system (input to core, core to output). */
  wires: Array<{ key: string; side: 'in' | 'out'; d: string; order: number }>;
  /** Unnamed faint nodes and their hairlines (rest state only). */
  satellites: Array<{ x: number; y: number; r: number; link: string }>;
  /** Where the core's label sits once open (top center), units. */
  coreLabel: Pt;
  /** The resting system's reach from the center (units), for the pointer's area. */
  reach: number;
}

const f = (v: number) => Number(v.toFixed(2));
const W = 600;
const H = 470;
const C: Pt = { x: 300, y: 235 };

// The voice print: 48 marks round a radius of 56, short and even at rest,
// lengthening into a waveform once open.
const MARKS = 48;
const R0 = 56;
const wave = (t: number) => {
  const v = 0.55 * Math.sin(3 * t + 0.6) + 0.3 * Math.sin(7 * t + 1.9) + 0.15 * Math.sin(11 * t + 0.4);
  return 0.5 + 0.5 * v; // 0 to 1
};

export function narrativeEngine(inputs: string[], outputs: string[]): Engine {
  if (inputs.length !== 2 || outputs.length !== 3) {
    throw new Error('[tpm] the narrative engine is drawn for two inputs and three outputs');
  }

  const marks = Array.from({ length: MARKS }, (_, i) => {
    const t = (i / MARKS) * Math.PI * 2;
    const w = wave(t);
    const open = 10 + 21 * w;
    const rest = 6 + 3 * w;
    const dx = Math.cos(t);
    const dy = Math.sin(t);
    // The marks lengthen from the input side (left) round to the output side
    // (right): the delay grows as the angle comes round from pi to 0.
    const fromLeft = 1 - Math.abs(Math.atan2(dy, dx)) / Math.PI; // 0 at the left, 1 at the right
    return {
      x1: f(C.x + dx * R0),
      y1: f(C.y + dy * R0),
      x2: f(C.x + dx * (R0 + open)),
      y2: f(C.y + dy * (R0 + open)),
      rest: f(rest / open),
      delay: f(fromLeft * 0.42),
    };
  });

  const place = (rest: Pt, open: Pt) => ({ rest, open, dx: f(open.x - rest.x), dy: f(open.y - rest.y) });
  const nodes: EngineNode[] = [
    { key: 'in-1', side: 'in', label: inputs[0], order: 0, ...place({ x: 176, y: 148 }, { x: 104, y: 112 }) },
    { key: 'in-2', side: 'in', label: inputs[1], order: 1, ...place({ x: 176, y: 322 }, { x: 104, y: 358 }) },
    { key: 'out-1', side: 'out', label: outputs[0], order: 0, ...place({ x: 412, y: 138 }, { x: 466, y: 92 }) },
    { key: 'out-2', side: 'out', label: outputs[1], order: 1, ...place({ x: 452, y: 235 }, { x: 486, y: 235 }) },
    { key: 'out-3', side: 'out', label: outputs[2], order: 2, ...place({ x: 412, y: 332 }, { x: 466, y: 378 }) },
  ];

  // Resting connections: straight hairlines from each node to the dotted ring.
  const RING = 76;
  const restWires = nodes.map((n) => {
    const vx = n.rest.x - C.x;
    const vy = n.rest.y - C.y;
    const d = Math.hypot(vx, vy);
    const ax = C.x + (vx / d) * (RING + 3);
    const ay = C.y + (vy / d) * (RING + 3);
    const bx = n.rest.x - (vx / d) * 6;
    const by = n.rest.y - (vy / d) * 6;
    return { d: `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}` };
  });

  // Open connections: S-curves that converge on the core's left and leave
  // from its right, like light through a lens.
  const ENTER = 108;
  const wires = nodes.map((n) => {
    const p = n.open;
    if (n.side === 'in') {
      const ey = C.y + (n.order === 0 ? -34 : 34);
      const ex = C.x - Math.sqrt(ENTER * ENTER - (ey - C.y) ** 2);
      const d = `M${f(p.x + 6)} ${f(p.y)}C${f(p.x + 52)} ${f(p.y)} ${f(ex - 44)} ${f(ey)} ${f(ex)} ${f(ey)}`;
      return { key: n.key, side: n.side, d, order: n.order };
    }
    const off = n.order === 0 ? -34 : n.order === 2 ? 34 : 0;
    const sy = C.y + off;
    const sx = C.x + Math.sqrt(ENTER * ENTER - off * off);
    const d =
      off === 0
        ? `M${f(sx)} ${f(sy)}L${f(p.x - 6)} ${f(p.y)}`
        : `M${f(sx)} ${f(sy)}C${f(sx + 34)} ${f(sy)} ${f(p.x - 40)} ${f(p.y)} ${f(p.x - 6)} ${f(p.y)}`;
    return { key: n.key, side: n.side, d, order: n.order };
  });

  // Unnamed nodes, each tied to its nearest named node by a hairline.
  const sats: Array<[number, number, number, string]> = [
    [222, 50, 2, 'in-1'],
    [378, 40, 1.8, 'out-1'],
    [560, 170, 2, 'out-2'],
    [566, 304, 1.7, 'out-2'],
    [50, 238, 2, 'in-2'],
    [238, 428, 1.8, 'in-2'],
    [392, 434, 2, 'out-3'],
  ];
  const satellites = sats.map(([x, y, r, key]) => {
    const n = nodes.find((m) => m.key === key)!;
    const vx = n.rest.x - x;
    const vy = n.rest.y - y;
    const d = Math.hypot(vx, vy);
    const link = `M${f(x + (vx / d) * 4)} ${f(y + (vy / d) * 4)}L${f(n.rest.x - (vx / d) * 6)} ${f(n.rest.y - (vy / d) * 6)}`;
    return { x, y, r, link };
  });

  return {
    w: W,
    h: H,
    c: C,
    core: { nucleus: 44, inner: 27, spark: 4, ring: RING, ringOpen: 108, orbit: 196, marks },
    nodes,
    restWires,
    wires,
    satellites,
    coreLabel: { x: C.x, y: C.y + 124 },
    reach: 172,
  };
}

/** A position in units as a share of the view box, for CSS. */
export const pctX = (x: number) => `${f((x / W) * 100)}%`;
export const pctY = (y: number) => `${f((y / H) * 100)}%`;
