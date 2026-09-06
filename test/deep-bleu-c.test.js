const test = require('node:test');
const assert = require('node:assert/strict');
const dbc = require('../games/deep-bleu-c/server');
const worldgen = require('../games/deep-bleu-c/worldgen');

function makeGame() {
  return dbc.createGame([
    { id: 'a', name: 'Ada' },
    { id: 'b', name: 'Bo' }
  ]);
}

function playerOf(game, id) { return game.players.find((p) => p.id === id); }

function moveOntoWildlife(player) {
  const world = worldgen.getWorld();
  const spot = world.wildlife[0];
  player.x = spot.x;
  player.y = spot.y;
  return spot;
}

test('ruilen werkt over vis, hout en steen heen', () => {
  const game = makeGame();
  const a = playerOf(game, 'a');
  const b = playerOf(game, 'b');
  a.inventory.push({ uid: 'a-1', speciesId: 'baars', weightKg: 1 });
  a.woodInventory.push({ uid: 'a-2', speciesId: 'berk', weightKg: 2 });
  b.rockInventory.push({ uid: 'b-1', speciesId: 'kalksteen', weightKg: 3 });

  dbc.handleAction(game, 'a', 'proposeTrade', {
    toId: 'b',
    offerUids: ['a-1', 'a-2'],
    requestUids: ['b-1']
  });
  assert.equal(game.trades.length, 1);
  assert.deepEqual(game.trades[0].offerSnapshot.map((item) => item.kind).sort(), ['fish', 'wood']);
  assert.equal(game.trades[0].requestSnapshot[0].kind, 'rock');

  dbc.handleAction(game, 'b', 'respondTrade', { tradeId: game.trades[0].id, decision: 'accept' });

  assert.equal(a.inventory.length, 0);
  assert.equal(a.woodInventory.length, 0);
  assert.equal(a.rockInventory.length, 1);
  assert.equal(a.rockInventory[0].uid, 'b-1');
  assert.equal(b.inventory.length, 1);
  assert.equal(b.woodInventory.length, 1);
  assert.equal(b.rockInventory.length, 0);

  const view = dbc.serialize(game, 'a');
  const accepted = view.you.trades;
  assert.equal(accepted.length, 0);
});

test('ruilvoorstel accepteren faalt als een item intussen verdwenen is', () => {
  const game = makeGame();
  const a = playerOf(game, 'a');
  const b = playerOf(game, 'b');
  a.woodInventory.push({ uid: 'a-1', speciesId: 'berk', weightKg: 2 });

  dbc.handleAction(game, 'a', 'proposeTrade', { toId: 'b', offerUids: ['a-1'] });
  a.woodInventory.length = 0; // item verkocht/verdwenen na het voorstel

  assert.throws(() => dbc.handleAction(game, 'b', 'respondTrade', { tradeId: game.trades[0].id, decision: 'accept' }));
  assert.equal(game.trades.length, 0);
});

test('jacht via dobbelgevecht levert buit op en verlaagt de slijtage van uitgeruste wapens', () => {
  const game = makeGame();
  const a = playerOf(game, 'a');
  a.cash = 1000;
  moveOntoWildlife(a);
  dbc.handleAction(game, 'a', 'buyGear', { category: 'weapons', id: 'houten-speer' });
  dbc.handleAction(game, 'a', 'equipGear', { category: 'weapons', id: 'houten-speer' });
  const spot = moveOntoWildlife(a);
  dbc.handleAction(game, 'a', 'huntStart', { x: spot.x, y: spot.y });
  assert.ok(a.combat);
  const durabilityBefore = a.gearDurability.weapons['houten-speer'].durability;

  // Elke aanval doet minstens 1 schade (server clamt op Math.max(1, ...)),
  // dus dit garandeert een overwinning zonder van willekeur af te hangen.
  a.combat.enemyHp = 1;
  dbc.handleAction(game, 'a', 'huntAction', { choice: 'attack' });

  assert.equal(a.combat, null);
  assert.equal(a.meatInventory.length, 1);
  assert.equal(a.meatInventory[0].quality, 'raw');
  assert.equal(a.gearDurability.weapons['houten-speer'].durability, durabilityBefore - 3);
});

test('vluchten tijdens de jacht beëindigt het gevecht zonder buit', () => {
  const game = makeGame();
  const a = playerOf(game, 'a');
  const spot = moveOntoWildlife(a);
  dbc.handleAction(game, 'a', 'huntStart', { x: spot.x, y: spot.y });
  assert.ok(a.combat);

  const originalRandom = Math.random;
  Math.random = () => 0; // altijd < elke FLEE_CHANCE, dus gegarandeerd ontsnappen
  try {
    dbc.handleAction(game, 'a', 'huntAction', { choice: 'flee' });
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(a.combat, null);
  assert.equal(a.meatInventory.length, 0);
});

test('koken verhoogt de kwaliteit en hangt een buff aan het gerecht, die bij het eten wordt toegepast', () => {
  const game = makeGame();
  const a = playerOf(game, 'a');
  a.cash = 100;
  a.meatInventory.push({ uid: 'meat-1', speciesId: 'konijn', weightKg: 1, caughtAt: Date.now(), quality: 'raw' });

  dbc.handleAction(game, 'a', 'cook', { station: 'kampvuur', uid: 'meat-1' });
  assert.equal(a.meatInventory[0].quality, 'roasted');

  dbc.handleAction(game, 'a', 'cook', { station: 'kookvuur', recipeId: 'jagerspot' });
  assert.equal(a.meatInventory[0].quality, 'dish');
  assert.equal(a.meatInventory[0].buffId, 'extraDie');

  a.stats.energy = 0;
  dbc.handleAction(game, 'a', 'eat', { uid: 'meat-1' });
  // konijn.energy = 8, dish-multiplier = 2.5 -> 20
  assert.equal(a.stats.energy, 20);
  assert.ok(a.buffs.some((b) => b.id === 'extraDie'));
});

test('gereedschap repareren herstelt de slijtage maar verlaagt het maximum', () => {
  const game = makeGame();
  const a = playerOf(game, 'a');
  a.cash = 1000;
  dbc.handleAction(game, 'a', 'buyGear', { category: 'shields', id: 'houten-schild' });
  const state = a.gearDurability.shields['houten-schild'];
  const originalMax = state.maxDurability;
  state.durability = 5;

  dbc.handleAction(game, 'a', 'repairGear', { category: 'shields', id: 'houten-schild' });

  assert.ok(state.maxDurability < originalMax);
  assert.equal(state.durability, state.maxDurability);
});

test('een aanlegsteiger bouwen lukt op een strandtegel en kan maar één keer per speler', () => {
  const game = makeGame();
  const a = playerOf(game, 'a');
  a.cash = 1000;
  const world = worldgen.getWorld();
  a.x = world.spawn.x;
  a.y = world.spawn.y;

  dbc.handleAction(game, 'a', 'buildHarbor', { x: world.spawn.x, y: world.spawn.y });
  assert.equal(game.harbors.length, 1);
  assert.equal(game.harbors[0].ownerId, 'a');

  assert.throws(() => dbc.handleAction(game, 'a', 'buildHarbor', { x: world.spawn.x, y: world.spawn.y }));
  assert.equal(game.harbors.length, 1);
});
