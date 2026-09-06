'use strict';

// Procedureel gegenereerde eilandkaart van hex-tegels: één centraal eiland vol
// meren, volledig omringd door zee en oceaan, met een "wereldrand" (platte-
// aarde-thema — een waterval die in het niets stort) op de buitenste ring van
// de kaart. De kaart wordt één keer per serverproces opgebouwd (deterministisch
// seed) en gedeeld door alle games, net zoals de Minigolf-mappool los van de
// engine staat. Tegels blijven opgeslagen in een plat row-major array
// (tiles[y*WIDTH+x]); alleen buur-/afstandslogica is hexagonaal (pointy-top,
// "odd-r" offset) via hexmath.js.
//
// Alle generatieparameters hieronder zijn geschreven als fracties van
// WIDTH/HEIGHT (t.o.v. REF_SIZE, de afmeting waarop de vormgeving oorspronkelijk
// is afgestemd), zodat de kaart bij elke afmeting dezelfde verhoudingen en
// dezelfde dichtheid aan bereikbaar water oplevert.

const { hexNeighbors, hexDistance, hexRing } = require('./hexmath');

const WIDTH = 48;
const HEIGHT = 48;
const SEED = 424242;
const REF_SIZE = 200;
const SCALE = HEIGHT / REF_SIZE;

// 'w' = wereldrand: de waterval aan de rand van de platte wereld. Puur een
// grens — niet beloopbaar, niet bevaarbaar, niet bevisbaar (geen biome).
const EDGE_MARGIN = 2;
const WALKABLE = new Set(['L', 'B', 'f', 'h']);
const WATER = new Set(['r', 'k', 'a', 'm']);
const BIOME_BY_TILE = { r: 'rivier', k: 'kust', a: 'atlantisch', m: 'middellandse-zee' };

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
  const tiles = new Array(WIDTH * HEIGHT).fill('a');
  const at = (x, y) => tiles[y * WIDTH + x];
  const set = (x, y, value) => { if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) tiles[y * WIDTH + x] = value; };
  // Frequenties (die tegen absolute x/y draaien) schalen omgekeerd mee zodat
  // hetzelfde aantal golven/eilanden/rivieren ontstaat, ongeacht kaartgrootte.
  const freq = (value) => value / SCALE;

  // --- Eén centraal eiland, volledig omringd door zee -------------------
  // Werkwijze: een enkele, grillig-golvende ellips als eilandsilhouet
  // (i.p.v. een vaste atlaskaart), met daarbuiten drie concentrische
  // zeeringen (kust → atlantisch → diepzee) die overal — ook in de hoeken —
  // ruim binnen de kaartranden blijven. De buitenste rand van de kaart wordt
  // achteraf altijd hard overschreven met de wereldrand-waterval, ongeacht
  // waar de golvende kustlijn toevallig uitkomt.
  function inWobblyEllipse(fx, fy, cx, cy, rx, ry, phase, freqMul = 1) {
    const dx = (fx - cx) / rx, dy = (fy - cy) / ry;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const wobble = 1 + 0.24 * Math.sin(angle * 3 * freqMul + phase) + 0.12 * Math.sin(angle * 5 * freqMul + phase * 1.7);
    return dist / wobble;
  }

  const islandPhase = rng() * Math.PI * 2;
  const ISLAND_CX = 0.5, ISLAND_CY = 0.5, ISLAND_RX = 0.30, ISLAND_RY = 0.28;
  const islandRatio = (fx, fy) => inWobblyEllipse(fx, fy, ISLAND_CX, ISLAND_CY, ISLAND_RX, ISLAND_RY, islandPhase);

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const fx = x / WIDTH, fy = y / HEIGHT;
      const ratio = islandRatio(fx, fy);
      if (ratio < 1) set(x, y, 'L');
      else if (ratio < 1.22) set(x, y, 'k');
      else if (ratio < 1.55) set(x, y, 'a');
      else set(x, y, 'm');
    }
  }

  // Meren: heel wat meer dan vroeger, verspreid over het hele eiland.
  const lakeCount = Math.max(24, Math.round(46 * Math.sqrt(SCALE)));
  for (let i = 0; i < lakeCount; i += 1) {
    const lx = Math.floor(rng() * WIDTH);
    const ly = Math.floor(rng() * HEIGHT);
    if (at(lx, ly) !== 'L') continue;
    const r = Math.max(1, (1.6 + rng() * 3.2) * SCALE);
    for (let y = Math.floor(ly - r - 1); y <= ly + r + 1; y += 1) {
      for (let x = Math.floor(lx - r - 1); x <= lx + r + 1; x += 1) {
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || at(x, y) !== 'L') continue;
        if (Math.hypot(x - lx, y - ly) < r) set(x, y, 'r');
      }
    }
  }

  // Rivieren die van het binnenland naar de kust of naar een binnenmeer
  // stromen — nu vertrekkend vanuit het eilandcentrum in willekeurige
  // richtingen, i.p.v. vaste Europa-coördinaten.
  function carveRiver(startX, startY, dirX, dirY, steps) {
    let x = startX, y = startY;
    for (let i = 0; i < steps; i += 1) {
      const rx = Math.round(x), ry = Math.round(y);
      if (rx < 0 || rx >= WIDTH || ry < 0 || ry >= HEIGHT) return;
      const tile = at(rx, ry);
      if (i > 3 && tile !== 'L' && tile !== 'r') return;
      if (tile === 'L') {
        set(rx, ry, 'r');
        if (rng() < 0.45) set(rx + 1, ry, 'r');
      }
      x += dirX + (rng() - 0.5) * 1.4;
      y += dirY + (rng() - 0.5) * 1.4;
    }
  }
  const riverCount = 7;
  for (let i = 0; i < riverCount; i += 1) {
    const angle = (i / riverCount) * Math.PI * 2 + rng() * 0.6;
    const startDist = (0.05 + rng() * 0.08) * WIDTH;
    const startX = Math.round(WIDTH * ISLAND_CX + Math.cos(angle) * startDist);
    const startY = Math.round(HEIGHT * ISLAND_CY + Math.sin(angle) * startDist);
    const steps = Math.max(10, Math.round(60 * SCALE));
    carveRiver(startX, startY, Math.cos(angle) * 1.3, Math.sin(angle) * 1.3, steps);
  }

  // Strand/dokrand: land naast water wordt beloopbaar en aanlegbaar.
  const source = tiles.slice();
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (source[y * WIDTH + x] !== 'L') continue;
      const nearWater = hexNeighbors(x, y).some(([nx, ny]) => (
        nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT && WATER.has(source[ny * WIDTH + nx])
      ));
      if (nearWater) set(x, y, 'B');
    }
  }

  // Reliëf en bebossing als sfeerachtergrond, toegepast op resterende
  // 'L'-tegels zodat kustlijnen, rivieren en meren onaangeroerd blijven.
  // 'f' (bos) en 'h' (heuvels) zijn gewoon land (WALKABLE); 'p' (bergpieken)
  // is bewust NIET beloopbaar — dat geeft de gebergtes echte diepte: je moet
  // er omheen routeren in plaats van er zomaar doorheen te wandelen.
  const mountainPhase = rng() * Math.PI * 2;
  const forestPhase = rng() * Math.PI * 2;
  const forestPhase2 = rng() * Math.PI * 2;

  // Een handvol bergketens verspreid over het eiland, in plaats van vaste
  // Europese gebergtes.
  const mountainRanges = Array.from({ length: 4 }, () => {
    const angle = rng() * Math.PI * 2;
    const dist = 0.05 + rng() * 0.13;
    return {
      cx: ISLAND_CX + Math.cos(angle) * dist,
      cy: ISLAND_CY + Math.sin(angle) * dist,
      rx: 0.045 + rng() * 0.05,
      ry: 0.03 + rng() * 0.035,
      freqMul: 0.8 + rng() * 0.8
    };
  });

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (at(x, y) !== 'L') continue;
      const fx = x / WIDTH, fy = y / HEIGHT;

      const inMountains = mountainRanges.some((range) => (
        inWobblyEllipse(fx, fy, range.cx, range.cy, range.rx, range.ry, mountainPhase, range.freqMul) < 1
      ));
      if (inMountains) {
        // Grillig, kleinschalig ruispatroon bepaalt piek (onbegaanbaar) vs.
        // heuvel (begaanbaar) — geen gladde grens, dus altijd doorwaadbare
        // routes tussen de pieken door.
        const relief = Math.sin(x * freq(0.22) + mountainPhase * 2) * Math.cos(y * freq(0.19) + mountainPhase)
          + Math.sin((x - y) * freq(0.16) + mountainPhase * 3.1) * 0.5;
        set(x, y, relief > 0.15 ? 'p' : 'h');
        continue;
      }

      // Bebossing: vlekkerige ruis (som van gefaseerde sinussen).
      const noise = Math.sin(x * freq(0.13) + forestPhase) * Math.cos(y * freq(0.11) + forestPhase)
        + Math.sin((x + y) * freq(0.08) + forestPhase2) * 0.6;
      if (noise > 0.05) set(x, y, 'f');
    }
  }

  // Wereldrand: de buitenste ring van de kaart is altijd de waterval die in
  // het niets stort — een platte-aarde-grens die nooit door land of een
  // golvende kustlijn doorbroken kan worden.
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (x < EDGE_MARGIN || x >= WIDTH - EDGE_MARGIN || y < EDGE_MARGIN || y >= HEIGHT - EDGE_MARGIN) set(x, y, 'w');
    }
  }

  return tiles;
}

function floodFillSize(tiles, startX, startY) {
  const stack = [[startX, startY]];
  const seen = new Set([startY * WIDTH + startX]);
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [nx, ny] of hexNeighbors(x, y)) {
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
  const cx = Math.floor(WIDTH / 2), cy = Math.floor(HEIGHT / 2);
  for (let r = 0; r < WIDTH + HEIGHT; r += 1) {
    for (const [x, y] of hexRing(cx, cy, r)) {
      if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
      if (tiles[y * WIDTH + x] === 'B') return { x, y };
    }
  }
  return null;
}

// Zoekt een dokrand die daadwerkelijk aan de opgegeven zee grenst, vanaf een
// gekozen startpunt naar buiten toe — gebruikt om de haven specifiek aan de
// Middellandse Zee (zuiden) te plaatsen in plaats van een willekeurige kust.
function findCoastalSpot(tiles, seaChar, startX, startY) {
  const cx = clamp(Math.round(startX), 0, WIDTH - 1), cy = clamp(Math.round(startY), 0, HEIGHT - 1);
  for (let r = 0; r < WIDTH + HEIGHT; r += 1) {
    for (const [x, y] of hexRing(cx, cy, r)) {
      if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
      if (tiles[y * WIDTH + x] !== 'B') continue;
      const nearSea = hexNeighbors(x, y).some(([nx, ny]) => (
        nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT && tiles[ny * WIDTH + nx] === seaChar
      ));
      if (nearSea) return { x, y };
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

const MIN_WALKABLE_REGION = Math.round(WIDTH * HEIGHT * 0.12);

function buildWorld() {
  let tiles = null, spawn = null;
  for (let attempt = 0; attempt < 20 && !tiles; attempt += 1) {
    const candidate = buildRaw(SEED + attempt * 97);
    const spot = findTownSpot(candidate);
    if (!spot) continue;
    if (floodFillSize(candidate, spot.x, spot.y).size < MIN_WALKABLE_REGION) continue;
    tiles = candidate;
    spawn = spot;
  }
  if (!tiles) {
    tiles = buildRaw(SEED);
    spawn = findTownSpot(tiles) || { x: Math.floor(WIDTH / 2), y: Math.floor(HEIGHT / 2) };
  }

  const rng = mulberry32(SEED + 777);
  const used = new Set([spawn.y * WIDTH + spawn.x]);
  const aquarium = placeNear(tiles, used, spawn.x, spawn.y, 3, 6, rng);
  const markt = placeNear(tiles, used, spawn.x, spawn.y, 3, 7, rng);
  const monument = placeNear(tiles, used, spawn.x, spawn.y, 4, 8, rng);
  // Werkplaatsen horen thematisch bij het Aquarium-Museum: hout en steen
  // worden net als visvangst daar tentoongesteld.
  const lumberyard = placeNear(tiles, used, aquarium.x, aquarium.y, 2, 5, rng);
  const quarry = placeNear(tiles, used, aquarium.x, aquarium.y, 2, 5, rng);

  // De haven zoekt de dichtstbijzijnde dokrand aan de kustring rond het eiland.
  const harborSpot = findCoastalSpot(tiles, 'k', spawn.x, spawn.y)
    || placeNear(tiles, used, spawn.x, spawn.y, 10, 18, rng);
  used.add(harborSpot.y * WIDTH + harborSpot.x);

  // Een handvol bootjes die letterlijk in het water bij de haven liggen —
  // puur decoratief, de bootupgrade zelf koop je op de Handelsmarkt.
  const boats = hexNeighbors(harborSpot.x, harborSpot.y)
    .filter(([x, y]) => x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && tiles[y * WIDTH + x] === 'k')
    .slice(0, 3)
    .map(([x, y]) => ({ x, y }));

  const buildings = [
    { id: 'vishandel', type: 'vishandel', name: 'De Vishandel', icon: '🐟', x: spawn.x, y: spawn.y, active: true },
    { id: 'aquarium', type: 'aquarium', name: 'Aquarium-Museum', icon: '🏛️', x: aquarium.x, y: aquarium.y, active: true },
    { id: 'markt', type: 'markt', name: 'Handelsmarkt', icon: '⚖️', x: markt.x, y: markt.y, active: true },
    { id: 'monument', type: 'monument', name: 'Hall of Fame', icon: '🏆', x: monument.x, y: monument.y, active: true },
    { id: 'lumberyard', type: 'lumberyard', name: 'Houthakkerij', icon: '🪵', x: lumberyard.x, y: lumberyard.y, active: true },
    { id: 'quarry', type: 'quarry', name: 'Steengroeve', icon: '⛏️', x: quarry.x, y: quarry.y, active: true },
    { id: 'haven', type: 'haven', name: 'De Haven', icon: '⚓', x: harborSpot.x, y: harborSpot.y, active: true }
  ];

  // Wilde dieren: verspreid over gewone graslandtegels ('L', niet bos/rots —
  // die zijn al voor hout/steen), deterministisch per tegel zodat de kaart
  // niet "flikkert" en de server dezelfde plekken kent als de client.
  const wildlife = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (tiles[y * WIDTH + x] !== 'L') continue;
      if (used.has(y * WIDTH + x)) continue;
      if (rng() < 0.11) wildlife.push({ x, y });
    }
  }

  return { width: WIDTH, height: HEIGHT, tiles, buildings, boats, wildlife, spawn, tileString: tiles.join('') };
}

let cached = null;
function getWorld() { if (!cached) cached = buildWorld(); return cached; }

function tileAt(world, x, y) {
  if (x < 0 || x >= world.width || y < 0 || y >= world.height) return null;
  return world.tiles[y * world.width + x];
}
function isWalkable(world, x, y, extra = null) {
  const tile = tileAt(world, x, y);
  return Boolean(tile) && (WALKABLE.has(tile) || Boolean(extra && extra.has(tile)));
}
function isWater(world, x, y) { const tile = tileAt(world, x, y); return Boolean(tile) && WATER.has(tile); }
function biomeAt(world, x, y) { const tile = tileAt(world, x, y); return tile ? (BIOME_BY_TILE[tile] || null) : null; }

// Hout groeit op bostegels ('f' — ook gewoon beloopbaar). Steen zit in de
// onbeloopbare bergpieken ('p'): je verzamelt 'm vanaf een aangrenzende
// heuvel of stuk land, net zoals vissen vanaf de kant. Wilde dieren staan op
// vaste, vooraf bepaalde graslandplekken (world.wildlife).
function wildlifeSetFor(world) {
  if (!world.wildlifeSet) world.wildlifeSet = new Set(world.wildlife.map((spot) => spot.y * world.width + spot.x));
  return world.wildlifeSet;
}
function resourceAt(world, x, y) {
  const tile = tileAt(world, x, y);
  if (tile === 'f') return 'wood';
  if (tile === 'p') return 'rock';
  if (tile === 'L' && wildlifeSetFor(world).has(y * world.width + x)) return 'animal';
  return null;
}

function nearestWalkable(world, tx, ty, extra = null, maxRadius = 8) {
  if (isWalkable(world, tx, ty, extra)) return { x: tx, y: ty };
  for (let r = 1; r <= maxRadius; r += 1) {
    for (const [x, y] of hexRing(tx, ty, r)) {
      if (isWalkable(world, x, y, extra)) return { x, y };
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

function findPath(world, startX, startY, goalX, goalY, extra = null, maxNodes = 30000) {
  const { width, height, tiles } = world;
  const startIdx = startY * width + startX, goalIdx = goalY * width + goalX;
  if (startIdx === goalIdx) return [];
  const passable = (idx) => WALKABLE.has(tiles[idx]) || Boolean(extra && extra.has(tiles[idx]));
  if (!passable(goalIdx)) return null;

  const heap = new MinHeap();
  const gScore = new Float64Array(width * height).fill(Infinity);
  const cameFrom = new Int32Array(width * height).fill(-1);
  const closed = new Uint8Array(width * height);
  const heuristic = (x, y) => hexDistance(x, y, goalX, goalY);

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
    for (const [nx, ny] of hexNeighbors(cx, cy)) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (closed[nIdx] || !passable(nIdx)) continue;
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
  getWorld, buildWorld, tileAt, isWalkable, isWater, biomeAt, resourceAt, nearestWalkable, findPath, hexDistance
};
