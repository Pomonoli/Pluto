const test = require('node:test');
const assert = require('node:assert/strict');
const ludo = require('../games/ludo-middle-earth/server');

function withRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = original; }
}

function players(count = 4, npcFrom = 1) {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Speler ${i}`, isNpc: i >= npcFrom }));
}

test('createGame wijst rijken toe volgens de vaste zitorde en start met volle middelen', () => {
  const game = ludo.createGame(players(4));
  assert.equal(game.players.p0.faction, 'minastirith');
  assert.equal(game.players.p1.faction, 'baraddur');
  assert.equal(game.players.p2.faction, 'erebor');
  assert.equal(game.players.p3.faction, 'rivendell');
  game.order.forEach((id) => {
    const p = game.players[id];
    assert.equal(p.castleHp, ludo.CASTLE_MAX_HP);
    assert.equal(p.gold, 350);
    assert.equal(p.units.length, 0);
    assert.ok(p.targetFaction);
  });
});

test('serialize geeft een consistente publieke weergave', () => {
  const game = ludo.createGame(players(2));
  const view = ludo.serialize(game, 'p0', new Map([['p0', true], ['p1', true]]));
  assert.equal(view.kind, 'ludo-middle-earth');
  assert.equal(view.players.length, 2);
  const you = view.players.find((p) => p.isYou);
  assert.equal(you.id, 'p0');
  assert.equal(typeof you.castleHp, 'number');
});

test('een worp van 6 ontgrendelt inzetten; goud wordt afgeschreven en de eenheid start bij de vertrekplaats', () => {
  const game = ludo.createGame(players(2));
  withRandom(0.999, () => ludo.handleAction(game, 'p0', 'roll'));
  const p = game.players.p0;
  assert.equal(p.lastRoll, 6);
  ludo.handleAction(game, 'p0', 'deploy', { cls: 'scout' });
  assert.equal(p.gold, 350 - ludo.UNIT_CLASSES.scout.cost);
  assert.equal(p.units.length, 1);
  assert.equal(p.units[0].pos, ludo.startTileIndex(3)); // p0 zit op minastirith, faction-index 3
});

test('inzetten zonder een 6 faalt', () => {
  const game = ludo.createGame(players(2));
  withRandom(0, () => ludo.handleAction(game, 'p0', 'roll'));
  assert.equal(game.players.p0.lastRoll, 1);
  assert.throws(() => ludo.handleAction(game, 'p0', 'deploy', { cls: 'scout' }), /geen 6/i);
});

test('verplaatsen zonder geldige worp faalt, met worp beweegt de eenheid het juiste aantal tegels', () => {
  const game = ludo.createGame(players(2));
  const p = game.players.p0;
  withRandom(0.999, () => ludo.handleAction(game, 'p0', 'roll'));
  ludo.handleAction(game, 'p0', 'deploy', { cls: 'scout' });
  const unit = p.units[0];
  const startPos = unit.pos;
  p.nextRollAt = Date.now(); // omzeil de persoonlijke worp-cooldown voor de test
  withRandom(0.2, () => ludo.handleAction(game, 'p0', 'roll')); // 1 + floor(0.2*6) = 2
  assert.equal(p.lastRoll, 2);
  ludo.handleAction(game, 'p0', 'move', { unitId: unit.id });
  assert.equal(unit.pos, (startPos + 2) % ludo.PATH_LENGTH);
  assert.equal(p.rollPending, false);
});

test('landen op een vijandelijke tegel lost een botsing op', () => {
  const game = ludo.createGame(players(2));
  const attackerP = game.players.p0; // minastirith
  const defenderP = game.players.p1; // baraddur
  const targetPos = 20;
  attackerP.units.push({ id: 'u1', cls: 'siege', hp: 260, maxHp: 260, zone: 'path', pos: (targetPos - 1 + ludo.PATH_LENGTH) % ludo.PATH_LENGTH, homeStep: 0, shieldUntil: 0, tileCooldownUntil: 0 });
  defenderP.units.push({ id: 'u2', cls: 'scout', hp: 10, maxHp: 60, zone: 'path', pos: targetPos, homeStep: 0, shieldUntil: 0, tileCooldownUntil: 0 });
  attackerP.rollPending = true;
  attackerP.lastRoll = 1;
  ludo.handleAction(game, 'p0', 'move', { unitId: 'u1' });
  assert.equal(defenderP.units.length, 0, 'de zwakke verdediger sneuvelt tegen een belegeringseenheid');
  assert.equal(attackerP.units.length, 1);
});

test('een volledige omloop leidt via de kleurbaan naar een aanval op de Belegeringsplaats', () => {
  const game = ludo.createGame(players(2));
  const p = game.players.p0; // minastirith, faction index 3
  const target = game.players.p1;
  p.targetFaction = target.faction;
  const entrance = ludo.entranceTileIndex(3);
  p.units.push({ id: 'u1', cls: 'infantry', hp: 130, maxHp: 130, zone: 'path', pos: entrance, homeStep: 0, shieldUntil: 0, tileCooldownUntil: 0 });
  p.rollPending = true;
  p.lastRoll = ludo.HOME_STEPS + 1;
  const beforeHp = target.castleHp;
  ludo.handleAction(game, 'p0', 'move', { unitId: 'u1' });
  assert.equal(p.units.length, 0, 'de eenheid verdwijnt na de belegeringsaanval');
  assert.equal(target.castleHp, beforeHp - ludo.UNIT_CLASSES.infantry.siegeDamage);
});

test('torens beschieten vijandelijke eenheden binnen bereik en vernietigen ze', () => {
  const game = ludo.createGame(players(2));
  const defenderCastleOwner = game.players.p1; // baraddur, faction-index 2
  const attackerP = game.players.p0;
  const corner = ludo.cornerIndex(2);
  attackerP.units.push({ id: 'u1', cls: 'scout', hp: 60, maxHp: 60, zone: 'path', pos: corner, homeStep: 0, shieldUntil: 0, tileCooldownUntil: 0 });
  defenderCastleOwner.turretNextFireAt = Date.now() - 1;
  let destroyed = false;
  for (let i = 0; i < 10 && !destroyed; i += 1) {
    ludo.tick(game, Date.now() + i * 3000);
    destroyed = attackerP.units.length === 0;
  }
  assert.ok(destroyed, 'de toren moet de eenheid binnen enkele salvo\'s vernietigen');
});

test('een gevallen kasteel schakelt de speler uit en het spel eindigt met één overlevende', () => {
  const game = ludo.createGame(players(2));
  game.players.p1.castleHp = 0;
  const changed = ludo.tick(game, Date.now());
  assert.ok(changed);
  assert.ok(game.players.p1.eliminated);
  assert.equal(game.gameOver, true);
  assert.equal(game.winnerId, 'p0');
});

test('NPC-tick voert acties uit zonder te crashen', () => {
  const game = ludo.createGame(players(4, 0));
  let now = Date.now();
  for (let i = 0; i < 30; i += 1) {
    now += 2200;
    assert.doesNotThrow(() => ludo.tick(game, now));
  }
  const anyGoldSpent = game.order.some((id) => game.players[id].gold !== 350 || game.players[id].units.length > 0 || game.players[id].castleHp !== ludo.CASTLE_MAX_HP);
  assert.ok(anyGoldSpent, 'na verloop van tijd moet minstens één NPC iets hebben ondernomen');
});

test('results rangschikt overlevenden voor uitgeschakelde spelers', () => {
  const game = ludo.createGame(players(2));
  game.players.p1.castleHp = 0;
  ludo.tick(game, Date.now());
  const res = ludo.results(game, 1000);
  const winner = res.find((r) => r.playerId === 'p0');
  const loser = res.find((r) => r.playerId === 'p1');
  assert.equal(winner.placement, 1);
  assert.equal(winner.won, true);
  assert.equal(loser.outcome, 'Kasteel gevallen');
});
