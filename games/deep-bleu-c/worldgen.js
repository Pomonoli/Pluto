'use strict';

// Embed the original terrain. An even offset preserves odd-r hex adjacency.
const starter = require('./starter-world');
const { hexNeighbors } = require('./hexmath');
const WIDTH = 160;
const HEIGHT = 160;
const WORLD_VERSION = 9;
const STARTER_OFFSET = { x: 56, y: 56 };
const { WATER } = starter;

// Island outlines follow the player's sketch, in percentages of the atlas.
// Gaps in the outer ring leave shipping passages into the central basin.
const ISLANDS = [
  [[21,32],[23,26],[28,22],[34,22],[38,20],[43,22],[46,25],[42,27],[36,27],[31,30],[28,34],[26,39],[23,37]],
  [[56,24],[59,22],[65,21],[69,23],[74,21],[78,23],[79,28],[77,32],[77,36],[74,37],[72,32],[68,29],[62,28],[57,26]],
  [[86,28],[89,25],[94,23],[96,26],[96,31],[97,35],[95,39],[92,37],[90,33],[90,30]],
  [[5,43],[8,44],[10,46],[14,43],[16,45],[14,48],[12,50],[16,53],[17,57],[14,58],[9,57],[6,53],[6,48]],
  [[80,42],[83,43],[86,46],[86,51],[88,55],[86,57],[82,58],[80,56],[81,51],[80,47],[79,44]],
  [[74,63],[77,61],[80,63],[80,66],[77,69],[73,70],[73,67]],
  [[24,62],[26,65],[27,69],[30,71],[35,72],[34,75],[30,77],[25,77],[22,74],[21,70],[21,66]],
  [[50,73],[53,73],[56,74],[61,72],[65,73],[67,76],[66,79],[68,82],[67,85],[64,87],[60,85],[56,87],[53,85],[54,82],[56,79],[53,77]],
  [[5,85],[8,83],[11,85],[14,85],[16,88],[16,92],[18,95],[16,97],[10,97],[5,95],[4,91]],
  [[24,93],[29,91],[32,89],[33,86],[36,85],[37,88],[36,91],[38,93],[38,96],[35,97],[32,96],[28,97],[24,96]]
];

function oval(cx, cy, rx, ry, phase) {
  return Array.from({ length: 18 }, (_, i) => {
    const a = i / 18 * Math.PI * 2;
    const r = 1 + Math.sin(a * 3 + phase) * 0.18;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  });
}
// Northern archipelago and detached islets in the corners.
[
  [44,3.6,2,1.3], [47.5,4.8,0.9,0.8], [45,7,1.2,0.9],
  [55.5,4.8,3,2.8], [36,9.3,1.6,1], [49,10,0.8,0.9],
  [54.5,13.2,2.2,1.4], [65,13.3,1.4,1.6], [67.5,9.3,0.7,0.5],
  [71,7,1,0.8], [73,12.4,2.7,1.5], [6,6.5,0.8,1.2],
  [17,15,0.7,1.1], [7.5,27.5,0.6,0.9], [16.5,84,1,0.8],
  [42,94.5,1.5,1.8], [87.5,31.5,0.6,0.8]
].forEach((args, i) => ISLANDS.push(oval(...args, i)));

// Signed distance gives each island a beach and continuous sea shelves.
function coastDistance(x, y, polygon) {
  let inside = false;
  let distance = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j], [bx, by] = polygon[i];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return inside ? -distance : distance;
}

const MOUNTAINS = [[28,26,4,3], [73,25,4.4,3], [8.5,52,2,3], [63,77,3.5,4], [55.5,83.5,2,1.6], [86,54,1.6,1.8], [12.5,87,1.7,1]];
const FORESTS = [[37,24,6,2.3], [24,34,2,3], [62,24,3,1.5], [75,33,2,3], [93,28,3,3.5], [83,47,2.5,4], [14,55,2.5,2.5], [25,70,3,5], [29,73,4,2], [76,65,2.5,3], [65,84,2.5,2.5], [8,93,4,3], [36,92,2,1.8], [55,4,2,1.5], [73,12,1.8,0.8]];
const inPatch = (x, y, patches) => patches.some(([cx, cy, rx, ry]) =>
  Math.hypot((x - cx) / rx, (y - cy) / ry) < 1 + 0.12 * Math.sin(x * 2 + y));

function translate(spot) { return { ...spot, x: spot.x + STARTER_OFFSET.x, y: spot.y + STARTER_OFFSET.y }; }

function buildWorld() {
  const old = starter.getWorld();
  const tiles = new Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const fx = x / WIDTH * 100, fy = y / HEIGHT * 100;
      const distance = Math.min(...ISLANDS.map((outline) => coastDistance(fx, fy, outline)));
      let tile = 'm';
      const ring = Math.hypot((fx - 50) / 29, (fy - 49) / 28);
      if (Math.abs(ring - 1) < 0.19) tile = 'a';
      if (Math.abs(ring - 1) < 0.09) tile = 'k';
      if (distance < 4.2 && tile === 'm') tile = 'a';
      if (distance < 2.2) tile = 'k';
      if (distance < 0) {
        tile = distance > -0.85 ? 'B' : 'L';
        if (tile === 'L' && inPatch(fx, fy, MOUNTAINS)) tile = Math.sin(x * 1.7 + y * 0.8) > -0.3 ? 'p' : 'h';
        else if (tile === 'L' && inPatch(fx, fy, FORESTS)) tile = 'f';
      }
      tiles[y * WIDTH + x] = tile;
    }
  }
  // Preserve original playable tiles, including inland waters and Wierlicht.
  // The old waterfall opens into the expanded sea.
  for (let y = 0; y < old.height; y += 1) {
    for (let x = 0; x < old.width; x += 1) {
      const tile = old.tiles[y * old.width + x];
      if (tile !== 'w') tiles[(y + STARTER_OFFSET.y) * WIDTH + x + STARTER_OFFSET.x] = tile;
    }
  }
  const inStarter = (x, y) => x >= STARTER_OFFSET.x && x < STARTER_OFFSET.x + old.width && y >= STARTER_OFFSET.y && y < STARTER_OFFSET.y + old.height;
  // Even the small rocky islands need a usable landing shore.
  const source = tiles.slice();
  for (let y = 2; y < HEIGHT - 2; y += 1) {
    for (let x = 2; x < WIDTH - 2; x += 1) {
      if (inStarter(x, y) || !['L', 'f', 'h', 'p'].includes(source[y * WIDTH + x])) continue;
      if (hexNeighbors(x, y).some(([nx, ny]) => WATER.has(source[ny * WIDTH + nx]))) tiles[y * WIDTH + x] = 'B';
    }
  }
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (x < 2 || y < 2 || x >= WIDTH - 2 || y >= HEIGHT - 2) tiles[y * WIDTH + x] = 'w';
    }
  }
  const wildlife = old.wildlife.map(translate);
  for (let y = 2; y < HEIGHT - 2; y += 1) {
    for (let x = 2; x < WIDTH - 2; x += 1) {
      if (!inStarter(x, y) && tiles[y * WIDTH + x] === 'L' && ((x * 73856093 ^ y * 19349663) >>> 0) % 11 === 0) wildlife.push({ x, y });
    }
  }
  return {
    width: WIDTH, height: HEIGHT, version: WORLD_VERSION, tiles, tileString: tiles.join(''),
    spawn: translate(old.spawn), kelpIsland: translate(old.kelpIsland),
    buildings: old.buildings.map(translate), boats: old.boats.map(translate), wildlife
  };
}

// Saves without a version belong to the original coordinate system.
function migrateSavedWorld(saved) {
  if (!saved || saved.worldVersion >= WORLD_VERSION) return saved;
  const move = (spot) => {
    if (!spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.y)) return spot;
    return translate(spot);
  };
  const personalNodes = Object.fromEntries(Object.entries(saved.personalNodes || {}).map(([key, value]) => {
    const match = /^(\w+):(\d+):(\d+)$/.exec(key);
    return [match ? `${match[1]}:${Number(match[2]) + STARTER_OFFSET.x}:${Number(match[3]) + STARTER_OFFSET.y}` : key, value];
  }));
  return { ...move(saved), boat: move(saved.boat), personalNodes, worldVersion: WORLD_VERSION };
}

let cached;
function getWorld() { if (!cached) cached = buildWorld(); return cached; }

module.exports = {
  ...starter, WIDTH, HEIGHT, WORLD_VERSION, STARTER_OFFSET,
  buildWorld, getWorld, migrateSavedWorld
};
