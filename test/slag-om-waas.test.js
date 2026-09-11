const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../games/slag-om-waas/server');
const { FACTIONS, PLAYABLE_FACTIONS, CONNECTIONS, ROADS, buildBoard, pairKey } = require('../games/slag-om-waas/board');

const players = (count = 2, npc = false) => [
  { id: 'a', name: 'Ada', isNpc: false },
  { id: 'b', name: 'Bob', isNpc: npc },
  { id: 'c', name: 'Cas', isNpc: false },
  { id: 'd', name: 'Dua', isNpc: false }
].slice(0, count);

const board = buildBoard();

test('elke provincie heeft een geldige regio, terrein en unieke id; de facties zijn economisch in balans', () => {
  const ids = new Set();
  for (const sector of board.sectors.values()) {
    assert.ok(!ids.has(sector.id), `dubbele id ${sector.id}`);
    ids.add(sector.id);
    assert.ok(FACTIONS[sector.factionHome], `${sector.id}: onbekende factie`);
    assert.ok(sector.polygon.length >= 3, `${sector.id}: geen polygon`);
    assert.ok(sector.buildSlots >= 1 && sector.economicValue >= 0);
  }
  assert.equal(board.sectors.size, 45);
  assert.equal([...board.sectors.values()].filter((s) => s.factionHome === 'center').length, 4);
  for (const faction of PLAYABLE_FACTIONS) {
    const own = [...board.sectors.values()].filter((s) => s.factionHome === faction);
    assert.ok(own.length >= 9, `${faction} heeft ${own.length} provincies`);
    assert.equal(own.filter((s) => s.isCapital).length, 1, `${faction}: precies één hoofdstad`);
    const income = own.reduce((sum, s) => sum + s.economicValue, 0);
    assert.ok(income >= 12 && income <= 14, `${faction}: inkomen ${income} buiten balans`);
  }
});

test('verbindingen zijn symmetrisch en komen overeen met echte gedeelde grenzen', () => {
  for (const [a, b] of CONNECTIONS) {
    assert.ok(game.isConnected(a, b) && game.isConnected(b, a), `${a}-${b} niet symmetrisch`);
    assert.ok(board.geometricNeighbors.get(a).includes(b), `${a}-${b} deelt geen grens op het bord`);
  }
  // Elke geometrische grens is ofwel een verbinding, ofwel een Moervaart-barrière tussen Noord en West.
  const declared = new Set(CONNECTIONS.map(([a, b]) => pairKey(a, b)));
  for (const [id, neighbors] of board.geometricNeighbors) {
    for (const other of neighbors) {
      if (declared.has(pairKey(id, other))) continue;
      const homes = [board.sectors.get(id).factionHome, board.sectors.get(other).factionHome].sort();
      assert.deepEqual(homes, ['north', 'west'], `${id}-${other} grenst op het bord maar is niet verbonden`);
    }
  }
});

test('Sint-Niklaas ligt centraal en grenst rechtstreeks aan alle vier de facties', () => {
  const center = board.sectors.get('center_sint_niklaas');
  assert.equal(center.factionHome, 'center');
  const neighborFactions = new Set(center.connections.map((c) => board.sectors.get(c.to).factionHome));
  for (const faction of PLAYABLE_FACTIONS) assert.ok(neighborFactions.has(faction), `${faction} grenst niet aan Sint-Niklaas`);
  assert.ok(ROADS.filter((road) => road.path.includes('center_sint_niklaas')).length >= 3, 'hoofdwegen door Sint-Niklaas');
});

test('de Moervaart scheidt Noord en West en is enkel via bruggen over te steken', () => {
  assert.ok(board.moervaart.length >= 5);
  const bridges = CONNECTIONS.filter(([, , kinds]) => kinds.includes('bridge'));
  assert.equal(bridges.length, 2);
  for (const [a, b] of bridges) {
    const homes = [board.sectors.get(a).factionHome, board.sectors.get(b).factionHome].sort();
    assert.deepEqual(homes, ['north', 'west']);
  }
  assert.ok(!game.isConnected('west_moerbeke', 'north_klein_sinaai'), 'zonder brug geen oversteek');
  assert.ok(game.landNeighbors('west_koewacht').includes('north_stekene'), 'brug telt als landbeweging');
});

test('hoofdwegen volgen enkel bestaande road-verbindingen', () => {
  for (const road of ROADS) {
    for (let i = 0; i < road.path.length - 1; i += 1) {
      assert.ok(game.isConnected(road.path[i], road.path[i + 1], ['road']), `${road.name}: ${road.path[i]} → ${road.path[i + 1]}`);
    }
  }
});

test('createGame wijst facties toe; niet-gekozen facties en Sint-Niklaas blijven neutraal met rebellen', () => {
  const g = game.createGame(players(2));
  assert.deepEqual(g.players.map((p) => p.faction), ['south', 'west']);
  assert.equal(g.sectors.south_temse.controller, 'south');
  assert.equal(g.sectors.south_temse.troops, 0);
  assert.equal(g.sectors.west_lokeren.controller, 'west');
  assert.equal(g.sectors.north_stekene.controller, null);
  assert.equal(g.sectors.north_stekene.troops, game.CONFIG.rebelGarrison);
  assert.equal(g.sectors.east_beveren.controller, null);
  assert.equal(g.sectors.center_sint_niklaas.controller, null);
  assert.equal(g.sectors.center_sint_niklaas.troops, game.CONFIG.neutralGarrison);
  assert.equal(g.sectors.center_belsele.controller, null);
  assert.equal(g.sectors.center_belsele.troops, game.CONFIG.rebelGarrison);
  assert.equal(g.players[0].support, game.CONFIG.startSupport);
  assert.ok(JSON.stringify(g), 'state is serialiseerbaar');
});

test('serialize stuurt het bord, eigenaarschap en spelersstatistieken mee', () => {
  const g = game.createGame(players(4));
  const view = game.serialize(g, 'a', new Map([['a', true], ['b', false], ['c', true], ['d', true]]));
  assert.equal(view.kind, 'slag-om-waas');
  assert.equal(view.board.sectors.length, 45);
  assert.ok(view.board.schelde.length > 5 && view.board.moervaart.length > 3);
  assert.ok(view.board.sectors.every((s) => Array.isArray(s.polygon) && Array.isArray(s.connections)));
  assert.equal(view.turnPlayerId, 'a');
  assert.equal(view.canEndTurn, true);
  const you = view.players.find((p) => p.isYou);
  assert.equal(you.faction, 'south');
  assert.equal(you.sectors, 10);
  assert.equal(you.income, 13);
  assert.equal(view.players.find((p) => p.id === 'b').connected, false);
  assert.equal(game.serialize(g, 'b', new Map()).canEndTurn, false);
});

test('beurten wisselen en na een volledige ronde begint een nieuwe ronde', () => {
  const g = game.createGame(players(3));
  assert.throws(() => game.handleAction(g, 'b', 'endTurn'), /niet aan de beurt/);
  assert.throws(() => game.handleAction(g, 'a', 'aanvallen'), /Onbekende actie/);
  game.handleAction(g, 'a', 'endTurn');
  assert.equal(g.turnIndex, 1);
  game.handleAction(g, 'b', 'endTurn');
  game.handleAction(g, 'c', 'endTurn');
  assert.equal(g.turnIndex, 0);
  assert.equal(g.round, 2);
});

test('een NPC beëindigt zijn beurt via tick', () => {
  const g = game.createGame(players(2, true));
  game.handleAction(g, 'a', 'endTurn');
  assert.equal(g.turnIndex, 1);
  assert.equal(game.tick(g, Date.now()), false);
  assert.equal(game.tick(g, Date.now() + game.CONFIG.npcTurnDelayMs + 1), true);
  assert.equal(g.turnIndex, 0);
  assert.equal(game.results(g).length, 2);
});
