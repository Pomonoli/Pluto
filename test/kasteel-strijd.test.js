const test = require('node:test');
const assert = require('node:assert/strict');
const ks = require('../games/kasteel-strijd/server');
const { simulation } = require('../games/kasteel-strijd/simulation');
const players = (npc = false) => [{ id: 'p1', name: 'Ada' }, { id: 'p2', name: 'Bob', isNpc: npc }];
const T0 = 1_000_000;
function advance(game, seconds) {
  for (let i = 0; i < Math.round(seconds * 10); i++) ks.tick(game, game.lastTickAt + 100);
}

test('createGame vereist twee spelers en start beide legers gelijk in de Prehistorie', () => {
  assert.throws(() => ks.createGame(players().slice(0, 1)), /precies twee/);
  assert.throws(() => ks.createGame([...players(), { id: 'p3' }]), /precies twee/);
  const game = ks.createGame(players(), T0);
  assert.equal(ks.meta.solo, false);
  assert.equal(ks.meta.supportsNpc, true);
  assert.equal(game.startedAt, T0);
  assert.equal(game.gameOver, false);
  assert.ok(game.matchId);
  assert.deepEqual(game.battle.player, game.battle.enemy);
  assert.equal(game.battle.player.era, 0);
});

test('serialize hervat dezelfde simulatie en spiegelt het slagveld voor speler twee', () => {
  const game = ks.createGame(players(), T0);
  advance(game, 4.2);
  const a = ks.serialize(game, 'p1');
  const b = ks.serialize(game, 'p2');
  assert.equal(a.kind, 'kasteel-strijd');
  assert.equal(a.elapsedServerMs, 4200);
  assert.equal(a.matchId, b.matchId);
  assert.deepEqual(a.battle.player, b.battle.enemy);
  assert.ok(a.battle.units.length > 0);
  assert.equal(a.battle.units[0].x + b.battle.units[0].x, 1400);
  assert.notEqual(a.battle.units[0].side, b.battle.units[0].side);
  assert.equal(a.battle.units[0].dir, -b.battle.units[0].dir);
  a.battle.player.gold = -1;
  assert.ok(game.battle.player.gold >= 50);
  assert.equal(ks.serialize(game, 'spectator').canAct, false);
  assert.doesNotThrow(() => JSON.stringify(game));
});

test('goud groeit voor beide spelers; upgrades raken alleen het eigen leger', () => {
  const game = ks.createGame(players(), T0);
  advance(game, 5);
  assert.ok(game.battle.player.gold > 50);
  assert.equal(game.battle.player.gold, game.battle.enemy.gold);
  const before = game.battle.enemy.gold;
  ks.handleAction(game, 'p2', 'upgrade', { key: 'attack' });
  assert.equal(game.battle.enemy.attackLevel, 2);
  assert.equal(game.battle.enemy.gold, before - 35);
  assert.equal(game.battle.player.attackLevel, 1);
  assert.throws(() => ks.handleAction(game, 'p2', 'upgrade', { key: 'attack' }), /nog niet/);
});

test('evolueren kost goud, gaat een tijdperk vooruit en herstelt alleen de eigen basis', () => {
  const game = ks.createGame(players(), T0);
  assert.throws(() => ks.handleAction(game, 'p1', 'evolve', { era: 6 }), /nog niet/);
  game.battle.player.gold = 350;
  game.battle.player.castleHp = 10;
  game.battle.enemy.castleHp = 123;
  ks.handleAction(game, 'p1', 'evolve', { era: 6 });
  assert.equal(game.battle.player.era, 1);
  assert.equal(game.battle.player.gold, 0);
  assert.equal(game.battle.player.castleHp, game.battle.player.castleMaxHp);
  assert.equal(game.battle.enemy.era, 0);
  assert.equal(game.battle.enemy.castleHp, 123);
  advance(game, 2);
  assert.equal(game.battle.units.find(u => u.side === 'player').era, 1);
  assert.equal(game.battle.units.find(u => u.side === 'enemy').era, 0);
});

test('alleen deelnemers kunnen acties sturen; clients kunnen geen uitslag of restart claimen', () => {
  const game = ks.createGame(players(true), T0);
  for (const id of ['stranger', 'p2']) assert.throws(() => ks.handleAction(game, id, 'evolve'), /Niet jouw spel/);
  for (const action of ['finish', 'restart']) assert.throws(() => ks.handleAction(game, 'p1', action, { won: true, elapsedMs: 999999 }), /Onbekende actie/);
  assert.throws(() => ks.handleAction(game, 'p1', 'upgrade', { key: '__proto__' }), /Onbekende upgrade/);
});

test('vaardigheden kosten goud en respecteren de cooldown voor beide kanten', () => {
  for (const side of ['player', 'enemy']) {
    const game = ks.createGame(players(), T0);
    const id = side === 'player' ? 'p1' : 'p2';
    game.battle[side].gold = 1000;
    ks.handleAction(game, id, 'ability', { key: 'reinforce' });
    assert.equal(game.battle.units.filter(u => u.side === side).length, 5);
    assert.equal(game.battle[side].gold, 930);
    assert.throws(() => ks.handleAction(game, id, 'ability', { key: 'reinforce' }), /beschikbaar/);
    advance(game, 1);
    assert.ok(game.battle[side].cooldowns.reinforce < 25);
  }
});

test('gevechten leveren goud aan de winnaar van een duel tussen troepen en blijven serialiseerbaar', () => {
  const game = ks.createGame(players(), T0);
  advance(game, 8);
  const b = game.battle;
  const attacker = b.units.find(u => u.side === 'enemy');
  const victim = b.units.find(u => u.side === 'player');
  b.units = [attacker, victim]; attacker.x = 700; victim.x = 701;
  attacker.atkCd = 0; victim.hp = 1; victim.atkCd = 1;
  const gold = b.enemy.gold;
  simulation(b).update(0.01);
  assert.ok(victim.dead);
  assert.ok(b.enemy.gold >= gold + 5);
  assert.doesNotThrow(() => JSON.stringify(game));
});

test('gevallen basis sluit precies eenmaal af met tegengestelde uitslagen en serverduur', () => {
  const game = ks.createGame(players(), T0);
  advance(game, 90);
  game.battle.player.castleHp = 0;
  ks.tick(game, game.lastTickAt + 100);
  assert.equal(game.gameOver, true);
  assert.equal(game.winnerId, 'p2');
  const duration = game.survivedMs;
  assert.equal(ks.tick(game, game.lastTickAt + 5000), false);
  assert.equal(game.survivedMs, duration);
  assert.equal(ks.serialize(game, 'p1').won, false);
  assert.equal(ks.serialize(game, 'p2').won, true);
  assert.throws(() => ks.handleAction(game, 'p1', 'evolve'), /afgelopen/);
  const [a, b] = ks.results(game);
  assert.equal(a.placement, 2); assert.equal(b.placement, 1);
  assert.equal(b.durationMs, duration); assert.equal(b.score, Math.round(duration / 1000));
  assert.equal(a.won, false); assert.equal(b.won, true);
});

test('bonusaanval beslist onmiddellijk en een gevallen basis kan niet meer evolueren', () => {
  const game = ks.createGame(players(), T0);
  game.battle.player.gold = 80;
  game.battle.enemy.castleHp = 1;
  ks.handleAction(game, 'p1', 'ability', { key: 'burst' });
  assert.equal(game.winnerId, 'p1');
  assert.throws(() => ks.handleAction(game, 'p2', 'evolve'), /afgelopen/);
});

test('NPC investeert legaal, evolueert zelfstandig en kan het duel winnen', () => {
  const game = ks.createGame(players(true), T0);
  advance(game, 4);
  assert.equal(game.battle.enemy.attackLevel, 2);
  assert.ok(game.battle.enemy.gold >= 0);
  let evolved = false;
  for (let i = 0; i < 12000 && !game.gameOver; i++) {
    ks.tick(game, game.lastTickAt + 100);
    evolved ||= game.battle.enemy.era > 0;
    assert.ok(game.battle.enemy.gold >= 0);
  }
  assert.ok(evolved, 'NPC spaart voor een volgend tijdperk');
  assert.equal(game.gameOver, true);
  assert.equal(game.winnerId, 'p2');
});

test('engine tekent snapshots zonder de serverstaat lokaal te simuleren', async () => {
  const { pathToFileURL } = require('node:url');
  const path = require('node:path');
  const { createBattle } = await import(pathToFileURL(path.join(__dirname, '../games/kasteel-strijd/engine.js')).href);
  const ctx = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
  const frames = [];
  const previous = global.requestAnimationFrame;
  global.requestAnimationFrame = cb => frames.push(cb);
  try {
    const game = ks.createGame(players(), T0);
    advance(game, 4);
    const snapshot = ks.serialize(game, 'p2').battle;
    const before = JSON.stringify(snapshot);
    const battle = createBattle({ canvas: { isConnected: true, getContext: () => ctx } });
    battle.setState(snapshot); battle.start();
    frames.shift()(0); frames.shift()(1000);
    assert.equal(JSON.stringify(snapshot), before);
    battle.stop();
  } finally { global.requestAnimationFrame = previous; }
});
