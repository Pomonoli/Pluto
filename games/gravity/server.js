'use strict';

const crypto = require('node:crypto');
const { generatePuzzle, normalizeDifficulty, manhattan } = require('./generator');

const meta = {
  key: 'gravity',
  name: 'Gravity',
  description: 'Teken routes en breng elke asteroïde naar een planeet.',
  minPlayers: 1,
  maxPlayers: 1,
  supportsNpc: false,
  realtime: false,
  solo: true
};

function normalizeRoomOptions(options = {}) {
  return { difficulty: normalizeDifficulty(options.difficulty) };
}

function coordKey(cell) { return `${cell.r},${cell.c}`; }
function sameCell(a, b) { return a.r === b.r && a.c === b.c; }
function isIntegerCell(cell) {
  return cell && Number.isInteger(cell.r) && Number.isInteger(cell.c);
}

function randomSeed() {
  return crypto.randomBytes(4).readUInt32LE(0);
}

function createGame(roomPlayers, options = {}) {
  const player = roomPlayers[0];
  if (!player) throw new Error('Gravity vereist één speler.');
  const { difficulty } = normalizeRoomOptions(options);
  const puzzle = generatePuzzle({ difficulty, seed: randomSeed() });
  return createGameFromPuzzle(player.id, puzzle);
}

function createGameFromPuzzle(playerId, puzzle) {
  return {
    gameKey: meta.key,
    playerId,
    difficulty: puzzle.difficulty,
    seed: puzzle.seed,
    size: puzzle.size,
    planets: structuredClone(puzzle.planets),
    asteroids: structuredClone(puzzle.asteroids),
    obstacles: structuredClone(puzzle.obstacles),
    solution: structuredClone(puzzle.solution),
    paths: {},
    pathOrder: [],
    moves: 0,
    hints: 0,
    hint: null,
    gameOver: false,
    resultText: ''
  };
}

function planetForCell(game, cell) {
  return game.planets.find((planet) => sameCell(planet, cell)) || null;
}

function asteroidForId(game, asteroidId) {
  return game.asteroids.find((asteroid) => asteroid.id === asteroidId) || null;
}

function obstacleSet(game) {
  return new Set(game.obstacles.map(coordKey));
}

function asteroidCellMap(game) {
  return new Map(game.asteroids.map((asteroid) => [coordKey(asteroid), asteroid.id]));
}

function validatePath(game, asteroidId, cells) {
  const asteroid = asteroidForId(game, asteroidId);
  if (!asteroid) throw new Error('Onbekende asteroïde.');
  if (!Array.isArray(cells) || cells.length < 2 || cells.length > game.size * 2 + 1) {
    throw new Error('Ongeldig pad.');
  }
  if (!cells.every(isIntegerCell)) throw new Error('Ongeldig pad.');
  for (const cell of cells) {
    if (cell.r < 0 || cell.c < 0 || cell.r >= game.size || cell.c >= game.size) {
      throw new Error('Het pad verlaat het speelveld.');
    }
  }
  if (!sameCell(cells[0], asteroid)) throw new Error('Start bij de gekozen asteroïde.');

  const target = planetForCell(game, cells[cells.length - 1]);
  if (!target) throw new Error('Het pad moet eindigen op een planeet.');

  const obstacles = obstacleSet(game);
  const asteroidCells = asteroidCellMap(game);
  const seen = new Set();

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    const cellKey = coordKey(cell);
    if (seen.has(cellKey)) throw new Error('Een pad mag zichzelf niet kruisen.');
    seen.add(cellKey);

    if (obstacles.has(cellKey)) throw new Error('Een obstakel blokkeert dit pad.');
    const otherAsteroid = asteroidCells.get(cellKey);
    if (otherAsteroid && !(i === 0 && otherAsteroid === asteroidId)) {
      throw new Error('Een pad mag niet door een andere asteroïde lopen.');
    }
    const planet = planetForCell(game, cell);
    if (planet && i !== cells.length - 1) throw new Error('Een planeet kan alleen het eindpunt zijn.');

    if (i > 0) {
      const previous = cells[i - 1];
      if (manhattan(previous, cell) !== 1) throw new Error('Teken alleen horizontaal of verticaal.');
      if (manhattan(cell, target) !== manhattan(previous, target) - 1) {
        throw new Error('Elke stap moet dichter bij de doelplaneet komen.');
      }
    }
  }

  const otherPaths = Object.entries(game.paths).filter(([id]) => id !== asteroidId);
  for (const [, path] of otherPaths) {
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = 0; j < path.cells.length; j += 1) {
        if (!sameCell(cells[i], path.cells[j])) continue;
        const sharedDestination = i === cells.length - 1
          && j === path.cells.length - 1
          && path.planetId === target.id;
        if (!sharedDestination) throw new Error('Paden mogen elkaar niet kruisen of delen.');
      }
    }
  }

  const alreadyFeedingTarget = otherPaths.filter(([, path]) => path.planetId === target.id).length;
  if (alreadyFeedingTarget >= target.required) throw new Error('Deze planeet is al volledig gevoed.');

  return {
    asteroidId,
    planetId: target.id,
    cells: cells.map((cell) => ({ r: cell.r, c: cell.c }))
  };
}

function checkWin(game) {
  if (Object.keys(game.paths).length !== game.asteroids.length) return false;
  const counts = new Map(game.planets.map((planet) => [planet.id, 0]));
  for (const path of Object.values(game.paths)) counts.set(path.planetId, (counts.get(path.planetId) || 0) + 1);
  if (!game.planets.every((planet) => counts.get(planet.id) === planet.required)) return false;
  game.gameOver = true;
  game.hint = null;
  game.resultText = `Gravity opgelost in ${game.moves} ${game.moves === 1 ? 'zet' : 'zetten'}.`;
  return true;
}

function setPath(game, asteroidId, cells) {
  const path = validatePath(game, asteroidId, cells);
  game.paths[asteroidId] = path;
  game.pathOrder = game.pathOrder.filter((id) => id !== asteroidId);
  game.pathOrder.push(asteroidId);
  game.moves += 1;
  if (game.hint?.asteroidId === asteroidId) game.hint = null;
  checkWin(game);
}

function undo(game) {
  const asteroidId = game.pathOrder.pop();
  if (!asteroidId) return;
  delete game.paths[asteroidId];
  game.hint = null;
}

function reset(game) {
  game.paths = {};
  game.pathOrder = [];
  game.hint = null;
}

function revealHint(game) {
  const asteroid = game.asteroids.find((item) => !game.paths[item.id]);
  if (!asteroid) return;
  const answer = game.solution[asteroid.id];
  if (!answer) return;
  game.hint = { asteroidId: asteroid.id, planetId: answer.planetId };
  game.hints += 1;
}

function handleAction(game, playerId, action, payload = {}) {
  if (playerId !== game.playerId) throw new Error('Niet jouw puzzel.');
  if (game.gameOver) throw new Error('De puzzel is al opgelost.');

  if (action === 'setPath') {
    setPath(game, String(payload.asteroidId || ''), payload.cells);
  } else if (action === 'undo') {
    undo(game);
  } else if (action === 'reset') {
    reset(game);
  } else if (action === 'hint') {
    revealHint(game);
  } else {
    throw new Error('Onbekende actie.');
  }
}

function serialize(game) {
  return {
    kind: meta.key,
    difficulty: game.difficulty,
    size: game.size,
    planets: game.planets,
    asteroids: game.asteroids,
    obstacles: game.obstacles,
    paths: game.paths,
    moves: game.moves,
    hints: game.hints,
    hint: game.hint,
    gameOver: game.gameOver,
    resultText: game.resultText
  };
}

function results(game, durationMs) {
  return [{
    playerId: game.playerId,
    placement: 1,
    score: game.moves,
    won: Boolean(game.gameOver),
    outcome: game.gameOver ? 'Opgelost' : 'Niet opgelost',
    durationMs,
    moves: game.moves
  }];
}

module.exports = {
  meta,
  normalizeRoomOptions,
  createGame,
  createGameFromPuzzle,
  handleAction,
  serialize,
  results,
  validatePath,
  checkWin
};
