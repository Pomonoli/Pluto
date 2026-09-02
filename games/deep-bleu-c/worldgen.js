'use strict';

// Procedureel gegenereerde, gestileerde Europakaart van hex-tegels. De kaart
// wordt één keer per serverproces opgebouwd (deterministisch seed) en
// gedeeld door alle games, net zoals de Minigolf-mappool los van de engine
// staat. Tegels blijven opgeslagen in een plat row-major array
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

const WALKABLE = new Set(['L', 'B', 'f', 'h']);
const WATER = new Set(['r', 'k', 'a', 'm', 'z']);
const BIOME_BY_TILE = { r: 'rivier', k: 'kust', a: 'atlantisch', m: 'middellandse-zee', z: 'atlantisch' };

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
  // Frequenties (die tegen absolute x/y draaien) schalen omgekeerd mee zodat
  // hetzelfde aantal golven/eilanden/rivieren ontstaat, ongeacht kaartgrootte.
  const freq = (value) => value / SCALE;

  // --- Silhouet op basis van de standaardkaart van Europa ----------------
  // Werkwijze: eerst de grote zeeën (Arctisch, Atlantisch, Middellandse Zee,
  // Oostzee, Zwarte Zee, Noordzee) over het hele vasteland "snijden", en
  // daarna de karakteristieke schiereilanden/eilanden (Scandinavië, de
  // Britse eilanden, het Iberisch Schiereiland, Italië + Sicilië, de Balkan)
  // als land terugzetten — dezelfde volgorde als een echte atlaskaart.
  const rowJitter = Array.from({ length: HEIGHT }, () => (rng() - 0.5) * 2);
  const colJitter = Array.from({ length: WIDTH }, () => (rng() - 0.5) * 2);

  // Eén punt is binnen een "keten" van cirkels (basis → punt) als het dicht
  // genoeg bij het geïnterpoleerde middelpunt/straal van een van de
  // segmenten ligt — een simpele, natuurlijk taps toelopende schiereiland-vorm.
  function inChain(fx, fy, stops) {
    for (let i = 0; i < stops.length - 1; i += 1) {
      const [, x0, y0, r0] = stops[i];
      const [, x1, y1, r1] = stops[i + 1];
      const segX = x1 - x0, segY = y1 - y0;
      const len2 = segX * segX + segY * segY || 1;
      let t = ((fx - x0) * segX + (fy - y0) * segY) / len2;
      t = clamp(t, 0, 1);
      const px = x0 + segX * t, py = y0 + segY * t;
      const r = r0 + (r1 - r0) * t;
      const dx = fx - px, dy = fy - py;
      if (dx * dx + dy * dy <= r * r) return true;
    }
    return false;
  }

  // Ellips met een golvende, onregelmatige rand (voor zeeën/gebergtes).
  function inWobblyEllipse(fx, fy, cx, cy, rx, ry, phase, freqMul = 1) {
    const dx = (fx - cx) / rx, dy = (fy - cy) / ry;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const wobble = 1 + 0.24 * Math.sin(angle * 3 * freqMul + phase) + 0.12 * Math.sin(angle * 5 * freqMul + phase * 1.7);
    return dist < wobble;
  }

  // Ellips (voor bredere, ronde schiereilanden/eilanden).
  function inEllipse(fx, fy, cx, cy, rx, ry) {
    const dx = (fx - cx) / rx, dy = (fy - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  const seaPhase = rng() * Math.PI * 2;

  // Vloeiende "bult" (smoothstep), voor een landtong die een rechte zeegrens
  // lokaal laat uitstulpen — betrouwbaarder zichtbaar dan een los vormpje
  // dat over een rechte grenslijn heen moet concurreren.
  function bump(t, center, halfWidth, height) {
    const d = Math.abs(t - center);
    if (d >= halfWidth) return 0;
    const s = 1 - d / halfWidth;
    return height * s * s * (3 - 2 * s);
  }

  // Het Iberisch Schiereiland duwt de Atlantische grens plaatselijk naar het
  // westen; Italië en de Balkan duwen de Middellandse Zee-grens naar het
  // zuiden. Dit zijn de twee meest herkenbare "inkepingen" van Europa.
  const atlanticEdge = (fy) => 0.095 - bump(fy, 0.85, 0.16, 0.075);
  const medEdge = (fx) => 0.80 + bump(fx, 0.495, 0.07, 0.20) + bump(fx, 0.635, 0.075, 0.16);

  // Herbruikbaar silhouet van de kleinere eilanden/schiereilanden (ook nodig
  // na de rivieren/meren hieronder, zodat die de kustlijn niet "opeten").
  function isLandmark(fx, fy) {
    const scandinavia = inChain(fx, fy, [
      [0, 0.36, 0.34, 0.09], [0.4, 0.375, 0.19, 0.075], [1, 0.40, 0.02, 0.045]
    ]);
    const jutland = inChain(fx, fy, [[0, 0.345, 0.315, 0.035], [1, 0.365, 0.22, 0.024]]);
    const greatBritain = inEllipse(fx, fy, 0.06, 0.22, 0.045, 0.075);
    const ireland = inEllipse(fx, fy, 0.012, 0.30, 0.028, 0.05);
    const sicily = inEllipse(fx, fy, 0.505, 0.975, 0.03, 0.022);
    const crete = inEllipse(fx, fy, 0.66, 0.95, 0.03, 0.018);
    return scandinavia || jutland || greatBritain || ireland || sicily || crete;
  }

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const fx = x / WIDTH, fy = y / HEIGHT;
      const jx = colJitter[x] * 0.012, jy = rowJitter[y] * 0.012;

      // Schiereilanden en eilanden winnen altijd van de zeeën hieronder.
      if (isLandmark(fx, fy)) { set(x, y, 'L'); continue; }

      // Zeeën: Arctisch (noord), Atlantisch (west, met Iberië-inkeping),
      // Middellandse Zee (zuid, met Italië/Balkan-inkeping), en twee
      // ingesloten zeeën (Oostzee, Zwarte Zee).
      let sea = null;
      if (fy + jy < 0.10) sea = 'z';
      else if (fx + jx < atlanticEdge(fy)) sea = 'a';
      else if (fy + jy > medEdge(fx)) sea = 'm';
      else if (inWobblyEllipse(fx, fy, 0.44, 0.235, 0.105, 0.095, seaPhase)) sea = 'k';
      else if (inWobblyEllipse(fx, fy, 0.735, 0.735, 0.085, 0.075, seaPhase * 1.4)) sea = 'k';

      if (sea) set(x, y, sea);
      // anders: blijft 'L' (Europees vasteland).
    }
  }

  // Meren verspreid over het vasteland.
  const lakeCount = Math.max(8, Math.round(22 * Math.sqrt(SCALE)));
  for (let i = 0; i < lakeCount; i += 1) {
    const lx = Math.round(30 * SCALE) + Math.floor(rng() * 150 * SCALE);
    const ly = Math.round(30 * SCALE) + Math.floor(rng() * 130 * SCALE);
    if (at(lx, ly) !== 'L') continue;
    const r = Math.max(1, (2.5 + rng() * 4.5) * SCALE);
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
        if (rng() < 0.45) set(rx + 1, ry, 'r');
      }
      x += dirX + (rng() - 0.5) * 1.4;
      y += dirY + (rng() - 0.5) * 1.4;
    }
  }
  const riverStart = (x, y) => [Math.round(x * SCALE), Math.round(y * SCALE)];
  const riverSteps = (steps) => Math.max(10, Math.round(steps * SCALE));
  for (const [sx, sy, dx, dy, steps] of [
    [140, 40, 0.9, 1.6, 90],
    [90, 60, -0.4, 1.7, 80],
    [70, 150, 1.3, 0.3, 60],
    [150, 130, -1.1, 0.8, 70],
    [45, 90, 1.2, -0.3, 65],
    [120, 170, -0.6, -1.4, 55]
  ]) {
    const [startX, startY] = riverStart(sx, sy);
    carveRiver(startX, startY, dx, dy, riverSteps(steps));
  }

  // De schiereilanden/eilanden opnieuw als land bevestigen: een rivier of
  // meer dat toevallig over Italië of Iberië liep, mag die kustlijn niet
  // "doorprikken" — hun silhouet moet herkenbaar blijven.
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (isLandmark(x / WIDTH, y / HEIGHT)) set(x, y, 'L');
    }
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

  // Ruwe locaties van de bekendste Europese gebergtes, als golvende ellipsen.
  const mountainRanges = [
    { cx: 0.445, cy: 0.635, rx: 0.115, ry: 0.05, freqMul: 1.0 }, // Alpen
    { cx: 0.235, cy: 0.635, rx: 0.05, ry: 0.026, freqMul: 1.4 }, // Pyreneeën
    { cx: 0.63, cy: 0.575, rx: 0.11, ry: 0.042, freqMul: 0.8 }, // Karpaten
    { cx: 0.80, cy: 0.705, rx: 0.055, ry: 0.03, freqMul: 1.6 }, // Kaukasus
    { cx: 0.365, cy: 0.16, rx: 0.045, ry: 0.11, freqMul: 1.1 } // Scandinavisch gebergte
  ];

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (at(x, y) !== 'L') continue;
      const fx = x / WIDTH, fy = y / HEIGHT;

      const inMountains = mountainRanges.some((range) => (
        inWobblyEllipse(fx, fy, range.cx, range.cy, range.rx, range.ry, mountainPhase, range.freqMul)
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

      // Bebossing: vlekkerige ruis (som van gefaseerde sinussen), dichter in
      // het noorden (naaldwoud), matig gemiddeld, nog aanwezig richting het zuiden.
      const noise = Math.sin(x * freq(0.13) + forestPhase) * Math.cos(y * freq(0.11) + forestPhase)
        + Math.sin((x + y) * freq(0.08) + forestPhase2) * 0.6;
      const latitude = y / HEIGHT;
      const forestThreshold = 0.32 - latitude * 0.55;
      if (noise > forestThreshold) set(x, y, 'f');
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
function isWalkable(world, x, y, extra = null) {
  const tile = tileAt(world, x, y);
  return Boolean(tile) && (WALKABLE.has(tile) || Boolean(extra && extra.has(tile)));
}
function isWater(world, x, y) { const tile = tileAt(world, x, y); return Boolean(tile) && WATER.has(tile); }
function biomeAt(world, x, y) { const tile = tileAt(world, x, y); return tile ? (BIOME_BY_TILE[tile] || null) : null; }

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
  getWorld, buildWorld, tileAt, isWalkable, isWater, biomeAt, nearestWalkable, findPath, hexDistance
};
