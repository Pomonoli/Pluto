'use strict';

/**
 * De Slag om Waas — bordgeometrie.
 *
 * Elke sector heeft één seed-punt in een 1000×1000 coördinatenruimte. De
 * sectorvlakken zijn de Voronoi-cellen van die seeds, geknipt op de
 * bordomtrek. Zo overlappen sectoren nooit en bedekken ze samen het hele bord.
 * De spelregels gebruiken deze geometrie NIET: adjacency staat expliciet in
 * board.js en wordt in de tests alleen tegen de geometrie gecontroleerd.
 */

const BOARD_SIZE = 1000;
const EPS = 1e-6;

// Afgeronde, licht onregelmatige bordomtrek (superellips met vaste wobble).
function boardOutline(points = 40) {
  const cx = BOARD_SIZE / 2, cy = BOARD_SIZE / 2, radius = 470, n = 3.2;
  const outline = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (Math.PI * 2 * i) / points;
    const c = Math.cos(angle), s = Math.sin(angle);
    const base = radius / Math.pow(Math.abs(c) ** n + Math.abs(s) ** n, 1 / n);
    const wobble = 1 + 0.035 * Math.sin(i * 2.7) + 0.02 * Math.cos(i * 5.1);
    outline.push([Math.round(cx + c * base * wobble), Math.round(cy + s * base * wobble)]);
  }
  return outline;
}

// Sutherland–Hodgman: houd het deel van `polygon` waar (p - m)·d <= 0.
function clipHalfPlane(polygon, m, d) {
  const inside = (p) => (p[0] - m[0]) * d[0] + (p[1] - m[1]) * d[1] <= EPS;
  const out = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const aIn = inside(a), bIn = inside(b);
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const va = (a[0] - m[0]) * d[0] + (a[1] - m[1]) * d[1];
      const vb = (b[0] - m[0]) * d[0] + (b[1] - m[1]) * d[1];
      const t = va / (va - vb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function distSq(a, b) { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; }

/**
 * Berekent per seed de Voronoi-cel en de geometrische buren (cellen die een
 * rand van betekenisvolle lengte delen).
 * @param {{id:string,x:number,y:number}[]} seeds
 * @returns {Map<string,{polygon:number[][],neighbors:string[]}>}
 */
function computeCells(seeds, outline = boardOutline()) {
  const cells = new Map();
  for (const seed of seeds) {
    let polygon = outline.map((p) => [p[0], p[1]]);
    for (const other of seeds) {
      if (other.id === seed.id) continue;
      const m = [(seed.x + other.x) / 2, (seed.y + other.y) / 2];
      const d = [other.x - seed.x, other.y - seed.y];
      polygon = clipHalfPlane(polygon, m, d);
    }
    cells.set(seed.id, { polygon, neighbors: [] });
  }
  // Buren: een polygonrand waarvan beide eindpunten (bijna) even ver van beide seeds liggen.
  for (const seed of seeds) {
    const cell = cells.get(seed.id);
    const poly = cell.polygon;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (distSq(a, b) < 36) continue; // randen korter dan 6 eenheden tellen niet als grens
      for (const other of seeds) {
        if (other.id === seed.id || cell.neighbors.includes(other.id)) continue;
        const sa = [seed.x, seed.y], sb = [other.x, other.y];
        const equidistant = (p) => Math.abs(distSq(p, sa) - distSq(p, sb)) < 1e-3 * distSq(p, sa);
        if (equidistant(a) && equidistant(b)) cell.neighbors.push(other.id);
      }
    }
    cell.polygon = poly.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
  }
  return cells;
}

function polygonCentroid(polygon) {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x0, y0] = polygon[i], [x1, y1] = polygon[(i + 1) % polygon.length];
    const f = x0 * y1 - x1 * y0;
    area += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  area *= 0.5;
  if (Math.abs(area) < EPS) return [polygon[0][0], polygon[0][1]];
  return [Math.round(cx / (6 * area)), Math.round(cy / (6 * area))];
}

module.exports = { BOARD_SIZE, boardOutline, computeCells, polygonCentroid };
