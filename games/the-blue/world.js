'use strict';

/**
 * The Blue — procedurele eilandgeneratie en terreinclassificatie.
 * Geen zichtbaar raster: alles is vrije (x,y) in wereldeenheden. Het eiland
 * is een ruw cirkelvormige vorm met wat harmonische ruis op de rand, omringd
 * door een ondiepe ring (zone 1, wadbaar) en een diepe ring (zone 2, vlot
 * nodig). Daarbuiten is de rand van de platte wereld: niets, geen invoer.
 */

const WORLD_SIZE = 80;
const CENTER = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 };
const BASE_RADIUS = 20;
const SHALLOW_BAND = 9;
const DEEP_BAND = 11;
const CAMP_POS = { x: CENTER.x, y: CENTER.y };

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeIslandShape(rng) {
  const harmonics = [
    { amp: 3 + rng() * 2, freq: 2, phase: rng() * Math.PI * 2 },
    { amp: 1.5 + rng() * 1.5, freq: 3, phase: rng() * Math.PI * 2 },
    { amp: 1 + rng() * 1, freq: 5, phase: rng() * Math.PI * 2 }
  ];
  return { base: BASE_RADIUS, harmonics };
}

function landRadiusAt(shape, angle) {
  let r = shape.base;
  for (const h of shape.harmonics) r += h.amp * Math.cos(h.freq * angle + h.phase);
  return r;
}

function angleAndDist(x, y) {
  const dx = x - CENTER.x, dy = y - CENTER.y;
  return { angle: Math.atan2(dy, dx), dist: Math.sqrt(dx * dx + dy * dy) };
}

/** Classificeert een punt: 'land' | 'shallow' | 'deep' | 'void'. */
function classify(shape, x, y) {
  const { angle, dist } = angleAndDist(x, y);
  const land = landRadiusAt(shape, angle);
  if (dist <= land) return 'land';
  if (dist <= land + SHALLOW_BAND) return 'shallow';
  if (dist <= land + SHALLOW_BAND + DEEP_BAND) return 'deep';
  return 'void';
}

function isWalkable(shape, x, y, hasRaft) {
  const terrain = classify(shape, x, y);
  if (terrain === 'land' || terrain === 'shallow') return true;
  if (terrain === 'deep') return Boolean(hasRaft);
  return false;
}

function clampToWorld(x, y) {
  return { x: Math.max(0, Math.min(WORLD_SIZE, x)), y: Math.max(0, Math.min(WORLD_SIZE, y)) };
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function pickLandPoint(shape, rng, opts = {}) {
  const minFromCenter = opts.minFromCenter || 3;
  const marginFromEdge = opts.marginFromEdge || 0.82;
  for (let i = 0; i < 60; i += 1) {
    const angle = rng() * Math.PI * 2;
    const maxR = landRadiusAt(shape, angle) * marginFromEdge;
    const r = minFromCenter + rng() * Math.max(0.1, maxR - minFromCenter);
    const x = CENTER.x + Math.cos(angle) * r;
    const y = CENTER.y + Math.sin(angle) * r;
    if (opts.avoid && opts.avoid.some((p) => dist(p, { x, y }) < (opts.minSpacing || 3))) continue;
    return { x, y };
  }
  return { x: CENTER.x + rng() * 6 - 3, y: CENTER.y + rng() * 6 - 3 };
}

function pickWaterPoint(shape, rng, band, avoid, minSpacing) {
  for (let i = 0; i < 60; i += 1) {
    const angle = rng() * Math.PI * 2;
    const land = landRadiusAt(shape, angle);
    const inner = band === 'shallow' ? land + 1.5 : land + SHALLOW_BAND + 1.5;
    const outer = band === 'shallow' ? land + SHALLOW_BAND - 1.5 : land + SHALLOW_BAND + DEEP_BAND - 1.5;
    const r = inner + rng() * Math.max(0.1, outer - inner);
    const x = CENTER.x + Math.cos(angle) * r;
    const y = CENTER.y + Math.sin(angle) * r;
    if (avoid && avoid.some((p) => dist(p, { x, y }) < (minSpacing || 6))) continue;
    return { x, y };
  }
  const angle = rng() * Math.PI * 2;
  const land = landRadiusAt(shape, angle);
  const r = band === 'shallow' ? land + SHALLOW_BAND / 2 : land + SHALLOW_BAND + DEEP_BAND / 2;
  return { x: CENTER.x + Math.cos(angle) * r, y: CENTER.y + Math.sin(angle) * r };
}

const NODE_COUNTS = { boom: 15, rots: 8, erts: 4, struik: 10 };

function generateWorld(seed) {
  const rng = mulberry32(seed >>> 0);
  const shape = makeIslandShape(rng);
  const camp = { ...CAMP_POS };
  const nodes = [];
  const placed = [camp];
  let nid = 1;
  for (const [type, count] of Object.entries(NODE_COUNTS)) {
    for (let i = 0; i < count; i += 1) {
      const p = pickLandPoint(shape, rng, { minFromCenter: 6, avoid: placed, minSpacing: 3.2 });
      placed.push(p);
      nodes.push({ id: `n${nid++}`, type, x: p.x, y: p.y, usesLeft: null, respawnAt: 0 });
    }
  }

  const fishSpots = [];
  const spotAvoid = [];
  for (let i = 0; i < 3; i += 1) {
    const p = pickWaterPoint(shape, rng, 'shallow', spotAvoid, 8);
    spotAvoid.push(p);
    fishSpots.push({ id: `f${i + 1}`, zone: 1, x: p.x, y: p.y });
  }
  for (let i = 0; i < 2; i += 1) {
    const p = pickWaterPoint(shape, rng, 'deep', spotAvoid, 8);
    spotAvoid.push(p);
    fishSpots.push({ id: `f${i + 4}`, zone: 2, x: p.x, y: p.y });
  }

  const wildlifeAnchors = [];
  for (let i = 0; i < 5; i += 1) {
    const p = pickLandPoint(shape, rng, { minFromCenter: 8, avoid: [...placed, ...wildlifeAnchors], minSpacing: 6 });
    wildlifeAnchors.push({ id: `w${i + 1}`, x: p.x, y: p.y });
  }

  return { seed: seed >>> 0, shape, camp, nodes, fishSpots, wildlifeAnchors };
}

module.exports = {
  WORLD_SIZE, CENTER, SHALLOW_BAND, DEEP_BAND, CAMP_POS,
  mulberry32, makeIslandShape, landRadiusAt, classify, isWalkable, clampToWorld, dist,
  pickLandPoint, pickWaterPoint, generateWorld
};
