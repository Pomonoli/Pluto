'use strict';

// Procedureel gegenereerde, gestileerde Europakaart van 200x200 tegels.
// De kaart wordt één keer per serverproces opgebouwd (deterministisch seed)
// en gedeeld door alle games, net zoals de Minigolf-mappool los van de
// engine staat.

const WIDTH = 200;
const HEIGHT = 200;
const SEED = 424242;

const WALKABLE = new Set(['L', 'B']);
const WATER = new Set(['r', 'k', 'a', 'm', 'z']);
const BIOME_BY_TILE = { r: 'rivier', k: 'kust', a: 'atlantisch', m: 'middellandse-zee', z: null };
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) { return value < min ? min : value > max ? max : value; }

function buildRaw(seed) {
  const rng = mulberry32(seed);
  const tiles = new Array(WIDTH * HEIGHT).fill('L');
  const at = (x, y) => tiles[y * WIDTH + x];
  const set = (x, y, value) => { if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) tiles[y * WIDTH + x] = value; };

  // Noord (Arctische IJszee) en West (Atlantische Oceaan) als een grillige rand.
  const rowJitter = Array.from({ length: HEIGHT }, () => (rng() - 0.5) * 2);
  const colJitter = Array.from({ length: WIDTH }, () => (rng() - 0.5) * 2);
  for (let y = 0; y < HEIGHT; y += 1) {
    const arcticEdge = 20 + Math.sin(y * 0.08) * 5 + rowJitter[y] * 4;
    const atlanticEdge = 22 + Math.sin(y * 0.09 + 1.3) * 6 + Math.sin(y * 0.21) * 3 + rowJitter[(y + 40) % HEIGHT] * 4;
    for (let x = 0; x < WIDTH; x += 1) {
      if (y < arcticEdge) set(x, y, 'z');
      else if (x < atlanticEdge) set(x, y, 'a');
    }
  }

  // Zuid (Middellandse Zee), inclusief eilanden verderop.
  for (let x = 0; x < WIDTH; x += 1) {
    const medEdge = 178 + Math.sin(x * 0.07) * 5 + Math.sin(x * 0.19 + 0.6) * 3 + colJitter[x] * 4;
    for (let y = Math.floor(medEdge); y < HEIGHT; y += 1) {
      if (at(x, y) !== 'z') set(x, y, 'm');
    }
  }

  // Oost: een uitgestrekt binnenmeer richting Rusland (Wolga & Kaspische Zee).
  const seaCx = 176, seaCy = 108, seaBaseR = 17;
  for (let y = Math.max(0, seaCy - 30); y < Math.min(HEIGHT, seaCy + 30); y += 1) {
    for (let x = Math.max(0, seaCx - 30); x < Math.min(WIDTH, seaCx + 30); x += 1) {
      const tile = at(x, y);
      if (tile === 'z' || tile === 'a' || tile === 'm') continue;
      const dx = x - seaCx, dy = y - seaCy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const radius = seaBaseR * (1 + 0.28 * Math.sin(angle * 3 + 1.1) + 0.14 * Math.sin(angle * 5 + 2.4));
      if (dist < radius) set(x, y, 'k');
    }
  }

  // Eilanden en riffen in de Middellandse Zee.
  for (let i = 0; i < 7; i += 1) {
    const ix = 40 + Math.floor(rng() * 130);
    const iy = 182 + Math.floor(rng() * 14);
    const r = 2 + rng() * 3;
    for (let y = Math.floor(iy - r - 1); y <= iy + r + 1; y += 1) {
      for (let x = Math.floor(ix - r - 1); x <= ix + r + 1; x += 1) {
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || at(x, y) !== 'm') continue;
        if (Math.hypot(x - ix, y - iy) < r) set(x, y, 'L');
      }
    }
  }

  // Meren verspreid over het vasteland.
  for (let i = 0; i < 10; i += 1) {
    const lx = 30 + Math.floor(rng() * 150);
    const ly = 30 + Math.floor(rng() * 130);
    if (at(lx, ly) !== 'L') continue;
    const r = 1.5 + rng() * 2.5;
    for (let y = Math.floor(ly - r - 1); y <= ly + r + 1; y += 1) {
      for (let x = Math.floor(lx - r - 1); x <= lx + r + 1; x += 1) {
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || at(x, y) !== 'L') continue;
        if (Math.hypot(x - lx, y - ly) < r) set(x, y, 'r');
      }
    }
  }

  // Rivieren die van het binnenland naar zee of binnenmeer stromen.
  function carveRiver(startX, startY, dirX, dirY, steps) {
    let x = startX, y = startY;
    for (let i = 0; i < steps; i += 1) {
      const rx = Math.round(x), ry = Math.round(y);
      if (rx < 0 || rx >= WIDTH || ry < 0 || ry >= HEIGHT) return;
      const tile = at(rx, ry);
      if (i > 3 && tile !== 'L' && tile !== 'r') return;
      if (tile === 'L') {
        set(rx, ry, 'r');
        if (rng() < 0.35) set(rx + 1, ry, 'r');
      }
      x += dirX + (rng() - 0.5) * 1.4;
      y += dirY + (rng() - 0.5) * 1.4;
    }
  }
  carveRiver(140, 40, 0.9, 1.6, 90);
  carveRiver(90, 60, -0.4, 1.7, 80);
  carveRiver(70, 150, 1.3, 0.3, 60);

  // Strand/dokrand: land naast water wordt beloopbaar en aanlegbaar.
  const source = tiles.slice();
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (source[y * WIDTH + x] !== 'L') continue;
      const nearWater = DIRS4.some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT && WATER.has(source[ny * WIDTH + nx]);
      });
      if (nearWater) set(x, y, 'B');
    }
  }

  return tiles;
}

function floodFillSize(tiles, startX, startY) {
  const stack = [[startX, startY]];
  const seen = new Set([startY * WIDTH + startX]);
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= WIDTH || ny < 0 || ny >= HEIGHT) continue;
      const idx = ny * WIDTH + nx;
      if (seen.has(idx) || !WALKABLE.has(tiles[idx])) continue;
      seen.add(idx);
      stack.push([nx, ny]);
    }
  }
  return seen;
}

function findTownSpot(tiles) {
  const cx = 100, cy = 100;
  for (let r = 0; r < 90; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
        if (tiles[y * WIDTH + x] === 'B') return { x, y };
      }
    }
  }
  return null;
}

function placeNear(tiles, used, cx, cy, minR, maxR, rng) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = minR + rng() * (maxR - minR);
    const x = clamp(Math.round(cx + Math.cos(angle) * dist), 1, WIDTH - 2);
    const y = clamp(Math.round(cy + Math.sin(angle) * dist), 1, HEIGHT - 2);
    const key = y * WIDTH + x;
    if (used.has(key) || !WALKABLE.has(tiles[key])) continue;
    used.add(key);
    return { x, y };
  }
  return { x: cx, y: cy };
}

function buildWorld() {
  let tiles = null, spawn = null;
  for (let attempt = 0; attempt < 6 && !tiles; attempt += 1) {
    const candidate = buildRaw(SEED + attempt * 97);
    const spot = findTownSpot(candidate);
    if (!spot) continue;
    if (floodFillSize(candidate, spot.x, spot.y).size < 6000) continue;
    tiles = candidate;
    spawn = spot;
  }
  if (!tiles) { tiles = buildRaw(SEED); spawn = findTownSpot(tiles) || { x: 100, y: 100 }; }

  const rng = mulberry32(SEED + 777);
  const used = new Set([spawn.y * WIDTH + spawn.x]);
  const aquarium = placeNear(tiles, used, spawn.x, spawn.y, 3, 6, rng);
  const markt = placeNear(tiles, used, spawn.x, spawn.y, 3, 7, rng);
  const monument = placeNear(tiles, used, spawn.x, spawn.y, 4, 8, rng);

  const buildings = [
    { id: 'vishandel', type: 'vishandel', name: 'De Vishandel', icon: '🐟', x: spawn.x, y: spawn.y, active: true },
    { id: 'aquarium', type: 'aquarium', name: 'Aquarium-Museum', icon: '🏛️', x: aquarium.x, y: aquarium.y, active: false },
    { id: 'markt', type: 'markt', name: 'Handelsmarkt', icon: '⚖️', x: markt.x, y: markt.y, active: false },
    { id: 'monument', type: 'monument', name: 'Hall of Fame', icon: '🏆', x: monument.x, y: monument.y, active: false }
  ];

  return { width: WIDTH, height: HEIGHT, tiles, buildings, spawn, tileString: tiles.join('') };
}

let cached = null;
function getWorld() { if (!cached) cached = buildWorld(); return cached; }

function tileAt(world, x, y) {
  if (x < 0 || x >= world.width || y < 0 || y >= world.height) return null;
  return world.tiles[y * world.width + x];
}
function isWalkable(world, x, y) { const tile = tileAt(world, x, y); return Boolean(tile) && WALKABLE.has(tile); }
function isWater(world, x, y) { const tile = tileAt(world, x, y); return Boolean(tile) && WATER.has(tile); }
function biomeAt(world, x, y) { const tile = tileAt(world, x, y); return tile ? (BIOME_BY_TILE[tile] || null) : null; }

function nearestWalkable(world, tx, ty, maxRadius = 6) {
  if (isWalkable(world, tx, ty)) return { x: tx, y: ty };
  for (let r = 1; r <= maxRadius; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx, y = ty + dy;
        if (isWalkable(world, x, y)) return { x, y };
      }
    }
  }
  return null;
}

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = i * 2 + 2;
        let smallest = i;
        if (l < items.length && items[l].f < items[smallest].f) smallest = l;
        if (r < items.length && items[r].f < items[smallest].f) smallest = r;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

function reconstructPath(cameFrom, width, startIdx, goalIdx) {
  const path = [];
  let cur = goalIdx;
  while (cur !== startIdx && cur !== -1) {
    path.push({ x: cur % width, y: Math.floor(cur / width) });
    cur = cameFrom[cur];
  }
  path.reverse();
  return path;
}

function findPath(world, startX, startY, goalX, goalY, maxNodes = 20000) {
  const { width, height, tiles } = world;
  const startIdx = startY * width + startX, goalIdx = goalY * width + goalX;
  if (startIdx === goalIdx) return [];
  if (!WALKABLE.has(tiles[goalIdx])) return null;

  const heap = new MinHeap();
  const gScore = new Float64Array(width * height).fill(Infinity);
  const cameFrom = new Int32Array(width * height).fill(-1);
  const closed = new Uint8Array(width * height);
  const heuristic = (x, y) => Math.abs(x - goalX) + Math.abs(y - goalY);

  gScore[startIdx] = 0;
  heap.push({ idx: startIdx, f: heuristic(startX, startY) });
  let expanded = 0;

  while (heap.size) {
    const current = heap.pop();
    if (closed[current.idx]) continue;
    closed[current.idx] = 1;
    if (current.idx === goalIdx) return reconstructPath(cameFrom, width, startIdx, goalIdx);
    expanded += 1;
    if (expanded > maxNodes) return null;

    const cx = current.idx % width, cy = Math.floor(current.idx / width);
    for (const [dx, dy] of DIRS4) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (closed[nIdx] || !WALKABLE.has(tiles[nIdx])) continue;
      const tentative = gScore[current.idx] + 1;
      if (tentative < gScore[nIdx]) {
        gScore[nIdx] = tentative;
        cameFrom[nIdx] = current.idx;
        heap.push({ idx: nIdx, f: tentative + heuristic(nx, ny) });
      }
    }
  }
  return null;
}

module.exports = {
  WIDTH, HEIGHT, WALKABLE, WATER,
  getWorld, buildWorld, tileAt, isWalkable, isWater, biomeAt, nearestWalkable, findPath
};
