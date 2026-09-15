const test = require('node:test');
const assert = require('node:assert/strict');
const combat = require('../games/slag-om-waas/combat');
const engine = require('../games/slag-om-waas/server');
const create = () => engine.createGame([{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bob' }]);
const roll = (input, dice) => combat.rollRound(input, () => dice.shift());
function battlefield() {
  const g = create(), from = 'south_temse', to = engine.BOARD.sectors.get(from).connections[0].to;
  g.sectors[from].units = { militia: 5, armored: 0 };
  Object.assign(g.sectors[to], { controller: 'west', units: { militia: 2, armored: 0 } });
  return { g, from, to };
}
function fixed(t, dice) {
  const original = combat.rollRound;
  t.mock.method(combat, 'rollRound', input => original(input, () => dice.shift()));
}

test('Risk vergelijkt hoogste paren en verdediger wint gelijkspel', () => {
  const r = roll({ attackers: 4, defenders: 2 }, [2, 6, 4, 4, 5]);
  assert.deepEqual(r.attackDice, [6, 4, 2]); assert.deepEqual(r.defenseDice, [5, 4]);
  assert.equal(r.attackerLosses, 1); assert.equal(r.defenderLosses, 1);
  const tie = roll({ attackers: 4, defenders: 2 }, [6, 6, 6, 6, 6]);
  assert.equal(tie.attackerLosses, 2); assert.equal(tie.defenderLosses, 0);
});

test('dobbelstenen volgen legergrootte met één achterblijver en maximaal 3 tegen 2', () => {
  for (const attackers of [2, 3, 4, 30]) for (const defenders of [1, 2, 20]) {
    const r = combat.rollRound({ attackers, defenders }, () => 3);
    assert.equal(r.attackDice.length, Math.min(3, attackers - 1));
    assert.equal(r.defenseDice.length, Math.min(2, defenders));
    assert.equal(r.attackerLosses + r.defenderLosses, Math.min(r.attackDice.length, r.defenseDice.length));
  }
});

test('fort, hoofdstad, brug en colonnes versterken worpen zonder boven 6 te komen', () => {
  const r = roll({ attackers: 4, defenders: 2, attackArmor: 1, defenseArmor: 1, fort: 2, castle: 1, bridge: 1 }, [3, 6, 4, 2, 4]);
  assert.deepEqual(r.attackScores, [6, 4, 3]);
  assert.deepEqual(r.defenseScores, [6, 2]);
  assert.equal(r.attackerLosses, 1); assert.equal(r.defenderLosses, 1);
  const siege = roll({ attackers: 2, defenders: 1, defenseArmor: 1, fort: 3, castle: 3, bridge: 1 }, [6, 1]);
  assert.deepEqual(siege.defenseScores, [5]);
  assert.equal(siege.defenderLosses, 1, 'een maximaal versterkte hoofdstad blijft veroverbaar');
});

test('actief gevecht blokkeert andere acties en alleen aanvaller mag gooien', () => {
  const { g, from, to } = battlefield();
  engine.handleAction(g, 'a', 'move', { from, to });
  for (const action of ['endTurn', 'move', 'build', 'recruit', 'upgrade', 'playCard', 'setTax']) assert.throws(() => engine.handleAction(g, 'a', action), /gevecht/);
  assert.throws(() => engine.handleAction(g, 'b', 'rollBattle'), /niet aan de beurt/);
  engine.handleAction(g, 'a', 'retreat');
  assert.equal(g.battle, null); assert.equal(g.lastBattle.outcome, 'retreated');
  assert.equal(g.sectors[from].troops, 5); assert.equal(g.sectors[from].movement, 0);
  assert.equal(g.players[0].cards.length, 0);
});

test('verloren worpen laten één achter en geven geen kaart; client bepaalt geen dobbeluitslag', (t) => {
  const { g, from, to } = battlefield(); fixed(t, [1, 1, 1, 6, 6, 1, 1, 6, 6]);
  engine.handleAction(g, 'a', 'move', { from, to });
  engine.handleAction(g, 'a', 'rollBattle', { attackDice: [6, 6, 6] });
  assert.equal(g.sectors[from].troops, 3);
  engine.handleAction(g, 'a', 'rollBattle');
  assert.equal(g.sectors[from].troops, 1); assert.equal(g.lastBattle.outcome, 'defeated');
  assert.equal(g.players[0].cards.length, 0);
  assert.throws(() => engine.handleAction(g, 'a', 'rollBattle'), /Geen actieve/);
});

test('veroveringen geven maximaal één privékaart per beurt, opnieuw na de beurtwisseling', (t) => {
  const { g, from, to } = battlefield(); fixed(t, [6, 6, 6, 1, 1]);
  engine.handleAction(g, 'a', 'move', { from, to }); engine.handleAction(g, 'a', 'rollBattle');
  assert.equal(g.players[0].cards.length, 1); assert.equal(g.lastBattle.outcome, 'conquered');
  const captureEmpty = () => {
    g.sectors[from].movement = 2; g.sectors[from].units.militia = 3;
    g.sectors[to].controller = 'west'; g.sectors[to].units = { militia: 0, armored: 0 };
    engine.handleAction(g, 'a', 'move', { from, to });
  };
  captureEmpty(); assert.equal(g.players[0].cards.length, 1);
  for (const id of ['b', 'spectator']) assert.equal(Object.hasOwn(engine.serialize(g, id).players[0], 'cards'), false);
  assert.equal(engine.serialize(g, 'a').players[0].cards.length, 1);
  engine.handleAction(g, 'a', 'endTurn'); engine.handleAction(g, 'b', 'endTurn');
  captureEmpty(); assert.equal(g.players[0].cards.length, 2);
});

test('kaarten passen hun bonus één keer toe en valideren eigendom vóór verbruik', () => {
  const g = create();
  g.players[0].cards = [{ id: 'x', type: 'reinforcements' }, { id: 'y', type: 'treasury' }, { id: 'z', type: 'support' }];
  assert.throws(() => engine.handleAction(g, 'a', 'playCard', { cardId: 'x', sectorId: 'west_lokeren' }), /niet van jou/);
  assert.equal(g.players[0].cards.length, 3);
  engine.handleAction(g, 'a', 'playCard', { cardId: 'x', sectorId: 'south_temse' });
  assert.equal(g.sectors.south_temse.troops, 6);
  assert.throws(() => engine.handleAction(g, 'a', 'playCard', { cardId: 'x', sectorId: 'south_temse' }), /bezit/);
  engine.handleAction(g, 'a', 'playCard', { cardId: 'y' }); assert.equal(g.players[0].treasury, 15);
  g.players[0].support = 9;
  engine.handleAction(g, 'a', 'playCard', { cardId: 'z' }); assert.equal(g.players[0].support, 10);
  assert.equal(g.players[0].cards.length, 0);
});

test('migratie van versie 3 herstelt hoofdsteden zonder verslagen legers terug te brengen', () => {
  const g = create(); g.rulesVersion = 3;
  for (const s of Object.values(g.sectors)) { if (s.controller === 'south') { s.units.militia = 0; s.troops = 0; } delete s.capitalLevel; }
  delete g.players[0].cards;
  const view = engine.serialize(g, 'a');
  assert.equal(view.sectors.south_temse.capitalLevel, 1); assert.equal(view.players[0].army, 0);
  assert.deepEqual(view.players[0].cards, []); assert.equal(view.rulesVersion, 4);
});

test('NPC speelt kaarten, rondt een dobbelgevecht af en beëindigt zijn beurt', (t) => {
  const g = create(); g.players[1].isNpc = true; g.players[1].treasury = 100;
  g.players[1].cards = [{ id: 'old', type: 'treasury' }];
  for (const [id, state] of Object.entries(g.sectors)) {
    if (state.controller === 'west' && id !== 'west_lokeren') state.controller = 'south';
  }
  g.sectors.west_lokeren.units.militia = 8;
  for (const c of engine.BOARD.sectors.get('west_lokeren').connections) {
    Object.assign(g.sectors[c.to], { controller: 'south', units: { militia: 2, armored: 0 }, buildings: [] });
  }
  fixed(t, [6, 6, 6, 1, 1]);
  engine.handleAction(g, 'a', 'endTurn');
  assert.equal(engine.tick(g, Date.now() + 2000), true);
  assert.equal(g.turnIndex, 0); assert.equal(g.battle, null);
  assert.equal(g.lastBattle.outcome, 'conquered');
  assert.ok(!g.players[1].cards.some(card => card.id === 'old'));
  assert.equal(g.players[1].cards.length, 1);
});
