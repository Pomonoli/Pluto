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
  assert.equal(g.sectors.south_temse.troops, 3);
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

test('belasting, inkomsten en onderhoud vormen samen de beurtbalans', () => {
  const g = game.createGame(players(2));
  game.handleAction(g, 'a', 'setTax', { policy: 'low' });
  game.handleAction(g, 'a', 'recruit', { sectorId: 'south_temse', unit: 'militia' });
  assert.equal(g.players[0].treasury, 7);
  game.handleAction(g, 'a', 'endTurn');
  game.handleAction(g, 'b', 'endTurn');
  assert.equal(g.players[0].support, 8);
  assert.equal(g.players[0].treasury, 12, 'lage belasting op 13 inkomen minus 4 onderhoud');
});

test('gebouwen ontsluiten specialisatie en legers kunnen een buur veroveren', () => {
  const g = game.createGame(players(2));
  assert.throws(() => game.handleAction(g, 'a', 'recruit', { sectorId: 'south_temse', unit: 'armored' }), /kazerne/);
  game.handleAction(g, 'a', 'build', { sectorId: 'south_temse', building: 'barracks' });
  game.handleAction(g, 'a', 'recruit', { sectorId: 'south_temse', unit: 'armored' });
  assert.equal(g.sectors.south_temse.units.armored, 1);
  const target = board.sectors.get('south_temse').connections.find((c) => g.sectors[c.to].controller === 'south').to;
  game.handleAction(g, 'a', 'move', { from: 'south_temse', to: target });
  assert.equal(g.sectors.south_temse.troops, 0);
  assert.equal(g.sectors[target].troops, 4);
});

test('een NPC beëindigt zijn beurt via tick', () => {
  const g = game.createGame(players(2, true));
  game.handleAction(g, 'a', 'endTurn');
  assert.equal(g.turnIndex, 1);
  assert.equal(game.tick(g, Date.now()), false);
  assert.equal(game.tick(g, Date.now() + game.CONFIG.npcTurnDelayMs + 1), true);
  assert.equal(g.turnIndex, 0);
  assert.equal(game.results(g).length, 2);
  assert.ok(g.log.some((line) => line.includes('Bob werft')));
});

test('oude bordstate krijgt belastingkeuzes, startlegers en eindige economie', () => {
  const g = game.createGame(players()); delete g.rulesVersion;
  for (const p of g.players) delete p.taxPolicy;
  for (const s of Object.values(g.sectors)) { delete s.units; delete s.movement; delete s.population; if (s.controller) s.troops = 0; }
  const v = game.serialize(g, 'a', new Map());
  assert.equal(Object.keys(v.config.taxPolicies).length, 3);
  assert.equal(v.players[0].army, 3); assert.equal(v.players[0].upkeep, 3);
  game.handleAction(g, 'a', 'endTurn'); game.handleAction(g, 'b', 'endTurn');
  assert.ok(g.players.every((p) => Number.isFinite(p.treasury)));
  game.serialize(g, 'a', new Map()); assert.equal(g.sectors.south_temse.troops, 3);
});

test('uitgeputte legers kunnen niet opnieuw marcheren of aanvallen', () => {
  const g = game.createGame(players());
  const from = 'south_temse';
  const to = board.sectors.get(from).connections.find((c) => g.sectors[c.to].controller === 'south' && !c.kinds.includes('road')).to;
  game.handleAction(g, 'a', 'move', { from, to });
  assert.equal(g.sectors[to].movement, 0);
  assert.throws(() => game.handleAction(g, 'a', 'move', { from: to, to: from }), /beweging/);
  game.handleAction(g, 'a', 'endTurn'); game.handleAction(g, 'b', 'endTurn');
  game.handleAction(g, 'a', 'move', { from: to, to: from });
  assert.equal(g.sectors[from].troops, 3);
});

test('verovering bewaart colonnes en blokkeert doorvechten', () => {
  const g = game.createGame(players());
  const from = 'south_temse', to = board.sectors.get(from).connections[0].to;
  g.sectors[from].units = { militia: 0, armored: 4 }; g.sectors[from].troops = 4;
  g.sectors[to].controller = null; g.sectors[to].units = { militia: 2, armored: 0 }; g.sectors[to].troops = 2;
  game.handleAction(g, 'a', 'move', { from, to });
  assert.equal(g.sectors[to].controller, 'south'); assert.equal(g.sectors[to].units.armored, 3);
  assert.equal(g.sectors[to].movement, 0);
});

test('werving verbruikt bevolking en weigert vervalste types', () => {
  const g = game.createGame(players()); g.players[0].treasury = 100;
  g.sectors.south_temse.population = 2;
  game.handleAction(g, 'a', 'recruit', { sectorId: 'south_temse' });
  assert.throws(() => game.handleAction(g, 'a', 'recruit', { sectorId: 'south_temse' }), /bevolking/);
  assert.throws(() => game.handleAction(g, 'a', 'setTax', { policy: '__proto__' }), /Ongeldig/);
  assert.throws(() => game.handleAction(g, 'a', 'build', { sectorId: 'south_temse', building: 'constructor' }), /Onbekend/);
});

test('Sint-Niklaas met voldoende vermogen sluit de partij en rangschikking af', () => {
  const g = game.createGame(players());
  g.sectors.center_sint_niklaas.controller = 'south'; g.players[0].treasury = 50;
  game.handleAction(g, 'a', 'endTurn');
  assert.equal(g.gameOver, true); assert.equal(g.winnerId, 'a');
  assert.equal(game.serialize(g, 'a').canEndTurn, false);
  assert.ok(game.results(g).find((p) => p.playerId === 'a').won);
  assert.throws(() => game.handleAction(g, 'a', 'endTurn'), /afgelopen/);
});
