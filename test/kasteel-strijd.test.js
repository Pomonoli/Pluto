const test = require('node:test');
const assert = require('node:assert/strict');
const ks = require('../games/kasteel-strijd/server');

const players = () => [{ id: 'p1', name: 'Ada' }];
const T0 = 1_000_000;

test('createGame start in de Prehistorie met een lopend potje', () => {
  const game = ks.createGame(players(), T0);
  assert.equal(game.playerId, 'p1');
  assert.equal(game.era, 0);
  assert.equal(game.startedAt, T0);
  assert.equal(game.gameOver, false);
  assert.ok(game.matchId);
});

test('serialize geeft de servertijd sinds de start mee', () => {
  const game = ks.createGame(players(), T0);
  const view = ks.serialize(game, 'p1', new Map(), T0 + 4200);
  assert.equal(view.kind, 'kasteel-strijd');
  assert.equal(view.elapsedServerMs, 4200);
  assert.equal(view.eraName, 'Prehistorie');
});

test('evolve gaat één tijdperk per keer vooruit en nooit terug', () => {
  const game = ks.createGame(players(), T0);
  ks.handleAction(game, 'p1', 'evolve', { era: 1 });
  assert.equal(game.era, 1);
  assert.throws(() => ks.handleAction(game, 'p1', 'evolve', { era: 3 }), /één voor één/);
  assert.throws(() => ks.handleAction(game, 'p1', 'evolve', { era: 0 }), /terug/);
  assert.throws(() => ks.handleAction(game, 'p1', 'evolve', { era: 99 }), /Ongeldig tijdperk/);
});

test('alleen de eigenaar mag acties sturen', () => {
  const game = ks.createGame(players(), T0);
  assert.throws(() => ks.handleAction(game, 'p2', 'evolve', { era: 1 }), /Niet jouw spel/);
});

test('finish sluit het potje af met de gemelde tijd wanneer die binnen de servertijd valt', () => {
  const game = ks.createGame(players(), T0);
  ks.handleAction(game, 'p1', 'finish', { won: false, era: 0, elapsedMs: 90_000 }, T0 + 95_000);
  assert.equal(game.gameOver, true);
  assert.equal(game.won, false);
  assert.equal(game.survivedMs, 90_000);
  assert.match(game.resultText, /Basis gevallen in de Prehistorie na 01:30/);
});

test('finish begrenst een te hoge gemelde tijd tot de werkelijk verstreken tijd', () => {
  const game = ks.createGame(players(), T0);
  ks.handleAction(game, 'p1', 'finish', { won: true, era: 1, elapsedMs: 3_600_000 }, T0 + 60_000);
  assert.equal(game.survivedMs, 60_000 + ks.FINISH_SLACK_MS);
  assert.equal(game.won, true);
  assert.equal(game.era, 1);
  assert.match(game.resultText, /Vijand verslagen in de Oude Nabije Oosten/);
});

test('finish weigert een tijdperk dat niet bereikbaar is', () => {
  const game = ks.createGame(players(), T0);
  assert.throws(() => ks.handleAction(game, 'p1', 'finish', { won: false, era: 4, elapsedMs: 1000 }), /Ongeldig tijdperk/);
});

test('acties na het einde worden geweigerd, behalve restart', () => {
  const game = ks.createGame(players(), T0);
  ks.handleAction(game, 'p1', 'finish', { won: false, era: 0, elapsedMs: 1000 }, T0 + 2000);
  assert.throws(() => ks.handleAction(game, 'p1', 'evolve', { era: 1 }), /afgelopen/);
  const oldMatch = game.matchId;
  ks.handleAction(game, 'p1', 'restart', {}, T0 + 5000);
  assert.equal(game.gameOver, false);
  assert.equal(game.startedAt, T0 + 5000);
  assert.notEqual(game.matchId, oldMatch);
});

test('results levert overlevingstijd als score en het tijdperk als moves', () => {
  const game = ks.createGame(players(), T0);
  ks.handleAction(game, 'p1', 'evolve', { era: 1 });
  ks.handleAction(game, 'p1', 'evolve', { era: 2 });
  ks.handleAction(game, 'p1', 'finish', { won: true, era: 2, elapsedMs: 125_400 }, T0 + 130_000);
  const [result] = ks.results(game, 130_000);
  assert.equal(result.playerId, 'p1');
  assert.equal(result.score, 125);
  assert.equal(result.durationMs, 125_400);
  assert.equal(result.moves, 2);
  assert.equal(result.won, true);
});

// ---------- Engine (browser-simulatie) headless ----------
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const engineModule = import(pathToFileURL(path.join(__dirname, '../games/kasteel-strijd/engine.js')).href);

// Canvas-stub: elke 2D-context-aanroep is een no-op, zodat de simulatie zonder browser draait.
function fakeCanvas() {
  const ctx = new Proxy({}, { get: (target, key) => (key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  return { isConnected: true, getContext: () => ctx };
}

async function headlessBattle(hooks = {}) {
  const engine = await engineModule;
  const frames = [];
  const previous = global.requestAnimationFrame;
  global.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  const battle = engine.createBattle({ canvas: fakeCanvas(), ...hooks });
  let clock = 0;
  battle.start();
  const step = (seconds, dt = 0.05) => {
    for (let t = 0; t < seconds; t += dt) {
      const cb = frames.shift();
      if (!cb) break;
      clock += dt * 1000;
      cb(clock);
    }
  };
  step(0, 0);
  const done = () => { global.requestAnimationFrame = previous; };
  return { engine, battle, step, done };
}

test('engine: goud loopt op, upgrade trekt goud af en verhoogt het niveau', async () => {
  const { engine, battle, step, done } = await headlessBattle();
  step(0.05);
  const before = battle.state.gold;
  step(5);
  assert.ok(battle.state.gold > before, 'goud groeit met de tijd');
  assert.ok(battle.state.units.length > 0, 'troepen spawnen automatisch');
  battle.state.gold = 1000;
  battle.upgrade('attack');
  assert.equal(battle.state.player.attackLevel, 2);
  assert.equal(Math.round(battle.state.gold), 1000 - engine.costAttack(1, 0));
  done();
});

test('engine: evolueren meldt het nieuwe tijdperk en herstelt beide basissen', async () => {
  const evolved = [];
  const { engine, battle, step, done } = await headlessBattle({ onEvolve: (era) => evolved.push(era) });
  step(1);
  battle.state.gold = engine.evolveCost(0) - 1;
  battle.evolve();
  assert.deepEqual(evolved, [], 'te weinig goud: geen evolutie');
  battle.state.gold = engine.evolveCost(0);
  battle.state.player.castleHp = 10;
  battle.evolve();
  assert.deepEqual(evolved, [1]);
  assert.equal(battle.state.player.era, 1);
  assert.equal(battle.state.player.castleHp, engine.castleMaxHp(1, 1));
  assert.equal(battle.state.enemy.castleHp, engine.enemyCastleMaxHp(1));
  done();
});

test('engine: een gevallen basis beëindigt het potje precies één keer', async () => {
  const ended = [];
  const { battle, step, done } = await headlessBattle({ onEnd: (won) => ended.push(won) });
  step(1);
  battle.state.enemy.castleHp = 0;
  step(0.5);
  assert.deepEqual(ended, [true]);
  assert.equal(battle.state.running, false);
  battle.state.player.castleHp = 0;
  step(0.5);
  assert.deepEqual(ended, [true], 'na het einde volgt geen tweede melding');
  done();
});
