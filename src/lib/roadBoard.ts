/**
 * The Road Here, Section 2 memorabilia board (V1.14): generated geometry for the
 * designed artifacts. Nothing here is a reproduction of a real document.
 *
 * - eastCoast(): a simplified outline of the US East and Gulf coasts (public
 *   geography, hand-simplified) and the touring cities John names, projected
 *   into one SVG viewBox. The dotted route joins the cities in a plausible
 *   north-to-south order; it is a footprint, not an itinerary.
 * - scribbles(): the setlist's lines as illegible, handwriting-like strokes
 *   (seeded, so every build draws the same sheet); some are crossed out. No
 *   letters or song titles are ever drawn.
 * - tornEdge(): a ragged top edge for the torn setlist sheet, as a CSS polygon.
 */

// A small seeded generator, so the drawing is the same on every build.
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

// Coast and frame, as [lat, lon]: Maine down the Atlantic coast, round the
// Florida peninsula and along the Gulf, then closed through the map's frame.
const COAST: Array<[number, number]> = [
  [47.5, -67.8], [44.8, -66.9], [44.4, -68.2], [43.9, -69.5], [43.6, -70.2], [43.0, -70.7], [42.6, -70.7],
  [42.3, -71.0], [42.0, -70.6], [41.75, -70.0], [41.55, -70.65], [41.5, -71.3], [41.3, -72.1], [41.05, -73.0],
  [40.85, -73.8], [40.58, -74.0], [40.4, -73.98], [39.95, -74.08], [39.4, -74.4], [38.95, -74.88], [39.2, -75.3],
  [38.78, -75.08], [38.3, -75.1], [37.9, -75.4], [37.4, -75.75], [37.0, -76.0], [36.75, -75.95], [36.2, -75.75],
  [35.55, -75.47], [35.2, -75.55], [34.95, -76.25], [34.65, -76.75], [34.2, -77.8], [33.85, -78.6], [33.2, -79.2],
  [32.75, -79.85], [32.05, -80.85], [31.4, -81.25], [30.7, -81.45], [30.0, -81.3], [29.2, -81.0], [28.5, -80.6],
  [27.8, -80.4], [27.0, -80.1], [26.4, -80.05], [25.75, -80.15], [25.35, -80.35], [25.15, -80.85], [25.2, -81.15],
  [25.85, -81.7], [26.45, -82.05], [26.95, -82.35], [27.6, -82.7], [28.15, -82.8], [28.75, -82.7], [29.15, -83.05],
  [29.7, -83.45], [30.05, -83.95], [30.05, -84.4], [29.85, -84.75], [29.65, -85.3], [30.05, -85.75], [30.35, -86.5],
  [30.4, -87.3], [30.35, -88.0], [30.4, -88.9], [30.3, -89.6], [30.15, -90.5], [47.5, -90.5],
];

// The Florida Keys, as a short chain of islets toward Key West.
const KEYS: Array<[number, number]> = [[25.05, -80.45], [24.9, -80.7], [24.78, -80.92], [24.7, -81.12], [24.66, -81.38], [24.6, -81.6]];

// The frame: longitudes and latitudes the card shows.
const VIEW = { lonMin: -88.2, lonMax: -68.6, latMin: 24.1, latMax: 44.0 };
const K = Math.cos((35 * Math.PI) / 180);

export const MAP_W = 300;
export const MAP_H = Math.round(((VIEW.latMax - VIEW.latMin) / ((VIEW.lonMax - VIEW.lonMin) * K)) * MAP_W);

const project = ([lat, lon]: [number, number]): [number, number] => [
  +(((lon - VIEW.lonMin) * K * MAP_W) / ((VIEW.lonMax - VIEW.lonMin) * K)).toFixed(1),
  +(((VIEW.latMax - lat) * MAP_H) / (VIEW.latMax - VIEW.latMin)).toFixed(1),
];

/** Land outline, Keys, the route and the city points, in a MAP_W x MAP_H viewBox. */
export type City = { name: string; lat: number; lon: number };
export const eastCoast = (cities: City[]) => {
  const land = `M${COAST.map((p) => project(p).join(' ')).join(' L')} Z`;
  const keys = KEYS.map((p) => project(p));
  const points = cities.map((c) => ({ name: c.name, at: project([c.lat, c.lon]) }));
  // A gently curved dotted route through the cities in order.
  let route = `M${points[0].at.join(' ')}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1].at;
    const [x1, y1] = points[i].at;
    const mx = (x0 + x1) / 2 + (y1 - y0) * 0.12;
    const my = (y0 + y1) / 2 - (x1 - x0) * 0.12;
    route += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1} ${y1}`;
  }
  return { w: MAP_W, h: MAP_H, land, keys, points, route };
};

/** Illegible handwriting-like lines for the setlist: [{ d, struck }] in a 200-wide viewBox. */
export const scribbles = (count = 9, seed = 7) => {
  const r = rng(seed);
  const lines: Array<{ d: string; struck: boolean; strike: string }> = [];
  for (let i = 0; i < count; i++) {
    const y = 18 + i * 21;
    const len = 70 + r() * 95;
    let x = 26;
    let d = `M8 ${y + 1} h9 M${x} ${y + 3}`;
    // Joined loops and humps of varying height: the rhythm of handwriting, never letters.
    while (x < 26 + len) {
      const w = 4 + r() * 6;
      const h = 4 + r() * 8;
      const up = r() < 0.18 ? h + 5 + r() * 5 : h;
      d += ` c${(w * 0.2).toFixed(1)} ${(-up).toFixed(1)} ${(w * 0.9).toFixed(1)} ${(-up).toFixed(1)} ${w.toFixed(1)} ${(-up * 0.15).toFixed(1)}`;
      d += ` s${(-w * 0.35).toFixed(1)} ${(up * 0.95).toFixed(1)} ${(w * 0.35).toFixed(1)} ${(up * 0.15).toFixed(1)}`;
      x += w * 1.35;
      if (r() < 0.16) {
        x += 5 + r() * 4; // a word gap
        d += ` M${x.toFixed(1)} ${y + 3}`;
      }
    }
    const struck = r() < 0.3;
    lines.push({ d, struck, strike: struck ? `M${22 + r() * 6} ${y - 2 + r() * 3} L${(x + 4).toFixed(1)} ${y - 4 + r() * 4}` : '' });
  }
  return { w: 200, h: 18 + count * 21, lines };
};

/** A ragged torn top edge as a CSS polygon(). */
export const tornEdge = (seed = 3, steps = 26) => {
  const r = rng(seed);
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) pts.push(`${((i / steps) * 100).toFixed(1)}% ${(r() * 2.6).toFixed(2)}%`);
  return `polygon(${pts.join(', ')}, 100% 100%, 0% 100%)`;
};
