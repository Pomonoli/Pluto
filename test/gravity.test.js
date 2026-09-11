'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePuzzle } = require('../games/gravity/generator');
const gravity = require('../games/gravity/server');

function gameFor(seed = 1, difficulty = 'medium') {
  const puzzle = generatePuzzle({ seed, difficulty });
  return { puzzle, game: gravity.createGameFromPuzzle('player-1', puzzle) };
}

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`Gravity generator maakt geldige ${difficulty}-puzzels`, () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { puzzle, game } = gameFor(seed, difficulty);
      assert.equal(puzzle.asteroids.length, puzzle.planets.reduce((sum, p) => sum + p.required, 0));
      for (const asteroid of puzzle.asteroids) {
        const answer = puzzle.solution[asteroid.id];
        assert.ok(answer, `${difficulty}/${seed}: oplossing ontbreekt voor ${asteroid.id}`);
        const validated = gravity.validatePath(game, asteroid.id, answer.cells);
        game.paths[asteroid.id] = validated;
      }
      assert.equal(gravity.checkWin(game), true, `${difficulty}/${seed}: oplossing wint niet`);
    }
  });
}

test('Gravity verwerpt een stap die niet dichter bij de planeet komt', () => {
  const puzzle = {
    difficulty: 'easy', seed: 1, size: 4,
    planets: [{ id: 'p1', r: 0, c: 3, required: 1, color: 'blue' }],
    asteroids: [{ id: 'a1', r: 0, c: 0 }], obstacles: [],
    solution: { a1: { planetId: 'p1', cells: [{r:0,c:0},{r:0,c:1},{r:0,c:2},{r:0,c:3}] } }
  };
  const game = gravity.createGameFromPuzzle('p', puzzle);
  assert.throws(() => gravity.validatePath(game, 'a1', [
    {r:0,c:0},{r:1,c:0},{r:1,c:1},{r:0,c:1},{r:0,c:2},{r:0,c:3}
  ]), /dichter/);
});

test('Gravity laat paden dezelfde doelplaneet delen maar niet dezelfde routecel', () => {
  const puzzle = {
    difficulty: 'easy', seed: 2, size: 4,
    planets: [{ id: 'p1', r: 1, c: 3, required: 2, color: 'blue' }],
    asteroids: [{ id: 'a1', r: 0, c: 0 }, { id: 'a2', r: 2, c: 0 }], obstacles: [],
    solution: {
      a1: { planetId:'p1', cells:[{r:0,c:0},{r:0,c:1},{r:0,c:2},{r:0,c:3},{r:1,c:3}] },
      a2: { planetId:'p1', cells:[{r:2,c:0},{r:2,c:1},{r:2,c:2},{r:2,c:3},{r:1,c:3}] }
    }
  };
  const game = gravity.createGameFromPuzzle('p', puzzle);
  game.paths.a1 = gravity.validatePath(game, 'a1', puzzle.solution.a1.cells);
  assert.doesNotThrow(() => gravity.validatePath(game, 'a2', puzzle.solution.a2.cells));

  assert.throws(() => gravity.validatePath(game, 'a2', [
    {r:2,c:0},{r:1,c:0},{r:0,c:0},{r:0,c:1},{r:0,c:2},{r:0,c:3},{r:1,c:3}
  ]), /kruisen|delen|andere asteroïde/);
});

test('Gravity bewaakt planeetcapaciteit', () => {
  const puzzle = {
    difficulty: 'easy', seed: 3, size: 3,
    planets: [
      { id:'p1', r:0, c:2, required:1, color:'blue' },
      { id:'p2', r:2, c:0, required:1, color:'mint' }
    ],
    asteroids: [{id:'a1',r:0,c:0},{id:'a2',r:2,c:2}], obstacles: [],
    solution: {
      a1:{planetId:'p1',cells:[{r:0,c:0},{r:0,c:1},{r:0,c:2}]},
      a2:{planetId:'p2',cells:[{r:2,c:2},{r:2,c:1},{r:2,c:0}]}
    }
  };
  const game = gravity.createGameFromPuzzle('p', puzzle);
  game.paths.a1 = gravity.validatePath(game, 'a1', puzzle.solution.a1.cells);
  assert.throws(() => gravity.validatePath(game, 'a2', [
    {r:2,c:2},{r:1,c:2},{r:0,c:2}
  ]), /volledig gevoed|dichter/);
});

test('Gravity acties kunnen een puzzel oplossen en serialize lekt de oplossing niet', () => {
  const { puzzle, game } = gameFor(77, 'medium');
  for (const asteroid of puzzle.asteroids) {
    gravity.handleAction(game, 'player-1', 'setPath', {
      asteroidId: asteroid.id,
      cells: puzzle.solution[asteroid.id].cells
    });
  }
  assert.equal(game.gameOver, true);
  assert.match(game.resultText, /opgelost/);
  const publicState = gravity.serialize(game);
  assert.equal(Object.hasOwn(publicState, 'solution'), false);
  assert.equal(Object.keys(publicState.paths).length, puzzle.asteroids.length);
});

test('Gravity hint onthult alleen asteroïde en doelplaneet', () => {
  const { puzzle, game } = gameFor(88, 'medium');
  gravity.handleAction(game, 'player-1', 'hint');
  assert.ok(game.hint?.asteroidId);
  assert.ok(game.hint?.planetId);
  assert.equal(Object.hasOwn(game.hint, 'cells'), false);
  const answer = puzzle.solution[game.hint.asteroidId];
  assert.equal(game.hint.planetId, answer.planetId);
});

test('Gravity normaliseert ongeldige difficulty naar medium', () => {
  assert.deepEqual(gravity.normalizeRoomOptions({difficulty:'hard'}), {difficulty:'hard'});
  assert.deepEqual(gravity.normalizeRoomOptions({difficulty:'nope'}), {difficulty:'medium'});
});
