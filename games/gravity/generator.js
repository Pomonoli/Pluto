'use strict';

const PROFILES = {
  easy: { size: 5, capacities: [1, 1, 1], obstacles: 2, minDistance: 2, maxDistance: 4 },
  medium: { size: 6, capacities: [2, 1, 1, 1], obstacles: 4, minDistance: 2, maxDistance: 5 },
  hard: { size: 7, capacities: [2, 2, 1, 1], obstacles: 7, minDistance: 3, maxDistance: 7 }
};

const PLANET_COLORS = ['blue', 'mint', 'orange', 'purple', 'coral', 'yellow'];

function normalizeDifficulty(value) {
  return Object.hasOwn(PROFILES, value) ? value : 'medium';
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function key(cell) { return `${cell.r},${cell.c}`; }
function manhattan(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c); }
function sameCell(a, b) { return a.r === b.r && a.c === b.c; }

function allCells(size) {
  const cells = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) cells.push({ r, c });
  }
  return cells;
}

function placePlanets(profile, random) {
  const cells = shuffle(allCells(profile.size), random);
  const planets = [];
  for (const cell of cells) {
    if (planets.some((planet) => manhattan(planet, cell) < 2)) continue;
    const index = planets.length;
    planets.push({
      id: `p${index + 1}`,
      r: cell.r,
      c: cell.c,
      required: profile.capacities[index],
      color: PLANET_COLORS[index % PLANET_COLORS.length]
    });
    if (planets.length === profile.capacities.length) return planets;
  }
  return null;
}

function findMonotonePath(start, target, size, blocked, planetKeys, random) {
  const targetKey = key(target);
  const seen = new Set([key(start)]);
  const path = [{ ...start }];

  function walk(cell) {
    if (sameCell(cell, target)) return true;
    const distance = manhattan(cell, target);
    const nextCells = shuffle([
      { r: cell.r - 1, c: cell.c },
      { r: cell.r + 1, c: cell.c },
      { r: cell.r, c: cell.c - 1 },
      { r: cell.r, c: cell.c + 1 }
    ], random).filter((next) => {
      if (next.r < 0 || next.c < 0) return false;
      if (next.r >= size || next.c >= size) return false;
      if (manhattan(next, target) !== distance - 1) return false;
      const nextKey = key(next);
      if (seen.has(nextKey)) return false;
      if (nextKey !== targetKey && (blocked.has(nextKey) || planetKeys.has(nextKey))) return false;
      return true;
    });

    for (const next of nextCells) {
      seen.add(key(next));
      path.push(next);
      if (walk(next)) return true;
      path.pop();
    }
    return false;
  }

  return walk(start) ? path : null;
}

function buildAttempt(difficulty, seed, attempt) {
  const profile = PROFILES[difficulty];
  const random = mulberry32((seed + Math.imul(attempt + 1, 0x9E3779B1)) >>> 0);
  const planets = placePlanets(profile, random);
  if (!planets) return null;

  const planetKeys = new Set(planets.map(key));
  const reserved = new Set();
  const asteroids = [];
  const solution = {};
  let asteroidNumber = 1;

  for (const planet of planets) {
    for (let slot = 0; slot < planet.required; slot += 1) {
      const candidates = shuffle(allCells(profile.size), random).filter((cell) => {
        const cellKey = key(cell);
        const distance = manhattan(cell, planet);
        return !planetKeys.has(cellKey)
          && !reserved.has(cellKey)
          && distance >= profile.minDistance
          && distance <= profile.maxDistance;
      });

      let chosen = null;
      for (const start of candidates) {
        const path = findMonotonePath(start, planet, profile.size, reserved, planetKeys, random);
        if (!path) continue;
        chosen = { start, path };
        break;
      }
      if (!chosen) return null;

      const asteroid = { id: `a${asteroidNumber}`, r: chosen.start.r, c: chosen.start.c };
      asteroidNumber += 1;
      asteroids.push(asteroid);
      solution[asteroid.id] = {
        planetId: planet.id,
        cells: chosen.path.map((cell) => ({ r: cell.r, c: cell.c }))
      };
      for (const cell of chosen.path) {
        if (!sameCell(cell, planet)) reserved.add(key(cell));
      }
    }
  }

  const obstacleCandidates = shuffle(allCells(profile.size), random).filter((cell) => {
    const cellKey = key(cell);
    return !planetKeys.has(cellKey) && !reserved.has(cellKey);
  });
  if (obstacleCandidates.length < profile.obstacles) return null;
  const obstacles = obstacleCandidates.slice(0, profile.obstacles).map((cell) => ({ ...cell }));

  return {
    size: profile.size,
    difficulty,
    seed: seed >>> 0,
    planets,
    asteroids,
    obstacles,
    solution
  };
}

function generatePuzzle({ difficulty = 'medium', seed = Date.now() } = {}) {
  const normalized = normalizeDifficulty(difficulty);
  const numericSeed = Number(seed) >>> 0;
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const puzzle = buildAttempt(normalized, numericSeed, attempt);
    if (puzzle) return puzzle;
  }
  throw new Error('Kon geen geldige Gravity-puzzel genereren.');
}

module.exports = {
  PROFILES,
  generatePuzzle,
  normalizeDifficulty,
  manhattan
};
