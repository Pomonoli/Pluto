const test = require('node:test');
const assert = require('node:assert/strict');
const blue = require('../games/the-blue/server');
const world = require('../games/the-blue/world');
const { NODE_TYPES } = require('../games/the-blue/data');

const players = () => [{ id: 'p1', name: 'Ada' }];
const twoPlayers = () => [{ id: 'p1', name: 'Ada' }, { id: 'p2', name: 'Bo' }];

function withMockedRandom(value, fn) {
  const original = Math.random;
  Math.random = typeof value === 'function' ? value : () => value;
  try { fn(); } finally { Math.random = original; }
}

test('createGame maakt een wereld met kamp, wildlife en spelers met basisuitrusting', () => {
  const game = blue.createGame(players());
  assert.equal(game.hostId, 'p1');
  assert.equal(game.players.length, 1);
  assert.equal(game.players[0].tools.axe.tier, 'hout');
  assert.equal(game.players[0].tools.weapon.tier, 'bare');
  assert.equal(game.players[0].hasRaft, false);
  assert.ok(game.world.nodes.length > 0);
  assert.ok(game.wildlife.length > 0);
  assert.equal(game.camp.hasKookvuur, false);
  assert.equal(game.gameOver, false);
});

test('handleAction weigert onbekende acties, onbekende spelers en acties na afloop', () => {
  const game = blue.createGame(players());
  assert.throws(() => blue.handleAction(game, 'p1', 'dance'), /Onbekende actie/);
  assert.throws(() => blue.handleAction(game, 'spook', 'move', { x: 0, y: 0 }), /Onbekende speler/);
  game.gameOver = true;
  assert.throws(() => blue.handleAction(game, 'p1', 'move', { x: 0, y: 0 }), /afgelopen/);
});

/* ---------------- wereld ---------------- */

test('classify herkent land, ondiep water, diep water en de rand van de wereld', () => {
  const shape = world.makeIslandShape(world.mulberry32(1));
  assert.equal(world.classify(shape, world.CENTER.x, world.CENTER.y), 'land');
  assert.equal(world.classify(shape, -5, -5), 'void');
});

/* ---------------- bewegen ---------------- */

test('move weigert de rand van de wereld', () => {
  const game = blue.createGame(players());
  assert.throws(() => blue.handleAction(game, 'p1', 'move', { x: -500, y: -500 }), /rand van de wereld/);
});

test('move naar diep water zonder vlot weigert', () => {
  const game = blue.createGame(players());
  const r = world.landRadiusAt(game.world.shape, 0) + world.SHALLOW_BAND + world.DEEP_BAND / 2;
  const deepPoint = { x: world.CENTER.x + r, y: world.CENTER.y };
  assert.equal(world.classify(game.world.shape, deepPoint.x, deepPoint.y), 'deep');
  assert.throws(() => blue.handleAction(game, 'p1', 'move', deepPoint), /vlot/);
});

test('move zet een bestemming en tick verplaatst de speler ernaartoe', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  const dest = { x: player.pos.x + 5, y: player.pos.y };
  blue.handleAction(game, 'p1', 'move', dest);
  assert.deepEqual(player.target, dest);
  const changed = blue.tick(game, game.lastTickAt + 2000);
  assert.equal(changed, true);
  assert.equal(player.target, null);
  assert.equal(Math.round(player.pos.x), Math.round(dest.x));
});

/* ---------------- verzamelen ---------------- */

test('gather buiten bereik geeft een foutmelding', () => {
  const game = blue.createGame(players());
  const node = game.world.nodes.find((n) => n.type === 'boom');
  node.x = game.players[0].pos.x + 100;
  node.y = game.players[0].pos.y;
  assert.throws(() => blue.handleAction(game, 'p1', 'gather', { nodeId: node.id }), /ver weg/);
});

test('een boom levert hout op tot hij uitgeput is, en weigert daarna', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  const node = game.world.nodes.find((n) => n.type === 'boom');
  node.x = player.pos.x; node.y = player.pos.y;
  for (let i = 0; i < NODE_TYPES.boom.uses; i += 1) blue.handleAction(game, 'p1', 'gather', { nodeId: node.id });
  assert.equal(player.inventory.hout, NODE_TYPES.boom.uses);
  assert.equal(node.usesLeft, 0);
  assert.throws(() => blue.handleAction(game, 'p1', 'gather', { nodeId: node.id }), /uitgeput/);
});

test('erts vereist minstens een stenen houweel', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  const node = game.world.nodes.find((n) => n.type === 'erts');
  node.x = player.pos.x; node.y = player.pos.y;
  assert.throws(() => blue.handleAction(game, 'p1', 'gather', { nodeId: node.id }), /Steen/);
  player.tools.pickaxe = { tier: 'steen', durability: 54, maxDurability: 54 };
  blue.handleAction(game, 'p1', 'gather', { nodeId: node.id });
  const gained = (player.inventory.koper || 0) + (player.inventory.tin || 0);
  assert.equal(gained, 2); // steen-tier bonus geeft +1 boven de basis van 1
});

test('een uitgeput knooppunt groeit na de opgegeven tijd weer aan', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  const node = game.world.nodes.find((n) => n.type === 'struik');
  node.x = player.pos.x; node.y = player.pos.y;
  for (let i = 0; i < NODE_TYPES.struik.uses; i += 1) blue.handleAction(game, 'p1', 'gather', { nodeId: node.id });
  assert.equal(node.usesLeft, 0);
  blue.tick(game, node.respawnAt + 1);
  assert.equal(node.usesLeft, null);
});

test('gereedschap breekt als de duurzaamheid op is', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  const node = game.world.nodes.find((n) => n.type === 'boom');
  node.x = player.pos.x; node.y = player.pos.y;
  player.tools.axe.durability = 1;
  blue.handleAction(game, 'p1', 'gather', { nodeId: node.id });
  assert.equal(player.tools.axe.tier, 'bare');
});

/* ---------------- vissen ---------------- */

test('castLine naar dieper water zonder vlot weigert', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  const spot = game.world.fishSpots.find((s) => s.zone === 2);
  spot.x = player.pos.x; spot.y = player.pos.y;
  assert.throws(() => blue.handleAction(game, 'p1', 'castLine', { spotId: spot.id }), /vlot/);
});

test('vissen: wachten, bijten en op tijd binnenhalen levert een vangst en codex-item op', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  const spot = game.world.fishSpots.find((s) => s.zone === 1);
  spot.x = player.pos.x; spot.y = player.pos.y;
  blue.handleAction(game, 'p1', 'castLine', { spotId: spot.id });
  assert.equal(player.fishing.state, 'waiting');
  blue.tick(game, player.fishing.biteAt + 1);
  assert.equal(player.fishing.state, 'biting');
  blue.handleAction(game, 'p1', 'reel');
  assert.equal(player.fishing, null);
  assert.ok(Object.keys(player.inventory).some((k) => k.startsWith('vis_')));
  assert.ok(Object.keys(player.codex).length === 1);
});

test('te vroeg binnenhalen breekt de lijn zonder vangst', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  const spot = game.world.fishSpots.find((s) => s.zone === 1);
  spot.x = player.pos.x; spot.y = player.pos.y;
  blue.handleAction(game, 'p1', 'castLine', { spotId: spot.id });
  blue.handleAction(game, 'p1', 'reel');
  assert.equal(player.fishing, null);
  assert.deepEqual(player.inventory, {});
});

test('een gemiste beet sluit zichzelf via tick, zonder vangst', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  const spot = game.world.fishSpots.find((s) => s.zone === 1);
  spot.x = player.pos.x; spot.y = player.pos.y;
  blue.handleAction(game, 'p1', 'castLine', { spotId: spot.id });
  blue.tick(game, player.fishing.biteAt + 1);
  blue.tick(game, player.fishing.expiresAt + 1);
  assert.equal(player.fishing, null);
  assert.deepEqual(player.inventory, {});
});

/* ---------------- gevecht ---------------- */

test('een dobbelgevecht met genoeg aanvallen verslaat een dier en levert buit op', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  const enemy = game.wildlife.find((w) => w.species === 'zwijn');
  enemy.x = player.pos.x; enemy.y = player.pos.y;
  withMockedRandom(0.99, () => {
    blue.handleAction(game, 'p1', 'attack', { enemyId: enemy.id });
    let guard = 0;
    while (player.combat && guard < 10) {
      blue.handleAction(game, 'p1', 'combatAct', { move: 'attack' });
      guard += 1;
    }
  });
  assert.equal(player.combat, null);
  assert.equal(enemy.alive, false);
  assert.ok(player.inventory.vlees > 0);
  assert.equal(player.codex.zwijn, true);
});

test('vluchten met succes beëindigt het gevecht zonder buit', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  const enemy = game.wildlife[0];
  enemy.x = player.pos.x; enemy.y = player.pos.y;
  withMockedRandom(0.01, () => {
    blue.handleAction(game, 'p1', 'attack', { enemyId: enemy.id });
    assert.ok(player.combat);
    blue.handleAction(game, 'p1', 'combatAct', { move: 'flee' });
  });
  assert.equal(player.combat, null);
  assert.equal(enemy.engagedBy, null);
  assert.equal(enemy.alive, true);
});

test('twee spelers kunnen niet hetzelfde dier tegelijk bevechten', () => {
  const game = blue.createGame(twoPlayers());
  const [p1, p2] = game.players;
  const enemy = game.wildlife[0];
  enemy.x = p1.pos.x; enemy.y = p1.pos.y;
  p2.pos = { x: enemy.x, y: enemy.y };
  blue.handleAction(game, 'p1', 'attack', { enemyId: enemy.id });
  assert.throws(() => blue.handleAction(game, 'p2', 'attack', { enemyId: enemy.id }), /anders vecht/);
});

/* ---------------- koken en maken ---------------- */

test('roosteren op het kampvuur verbruikt rauwe vis en levert na de kooktijd geroosterde vis op', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  player.inventory.vis_baars = 1;
  blue.handleAction(game, 'p1', 'cook', { station: 'kampvuur', recipeKey: 'roast_vis' });
  assert.equal(player.inventory.vis_baars, undefined);
  assert.ok(player.cook);
  blue.tick(game, player.cook.doneAt + 1);
  assert.equal(player.inventory.geroosterde_vis, 1);
  assert.equal(player.cook, null);
});

test('cook weigert buiten kampbereik', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  player.pos = { x: player.pos.x + 50, y: player.pos.y };
  player.inventory.vlees = 1;
  assert.throws(() => blue.handleAction(game, 'p1', 'cook', { station: 'kampvuur', recipeKey: 'roast_vlees' }), /kamp/);
});

test('kookvuur-recepten zijn geblokkeerd tot het kookvuur gebouwd is', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  player.inventory = { vlees: 1, bosbes: 2 };
  assert.throws(() => blue.handleAction(game, 'p1', 'cook', { station: 'kookvuur', recipeKey: 'stoofpot' }), /kookvuur/);
});

test('craft maakt een stenen bijl en verbruikt materiaal', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  player.inventory = { hout: 10, steen: 10 };
  blue.handleAction(game, 'p1', 'craft', { recipeKey: 'axe_steen' });
  assert.equal(player.tools.axe.tier, 'steen');
  assert.equal(player.inventory.hout, 4);
  assert.equal(player.inventory.steen, undefined);
});

test('craft weigert de smidse-recepten zonder gebouwde smidse', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  player.inventory = { hout: 10, koper: 10, tin: 10 };
  assert.throws(() => blue.handleAction(game, 'p1', 'craft', { recipeKey: 'axe_brons' }), /smidse/);
});

test('craft bouwt het kookvuur als gedeelde kampupgrade', () => {
  const game = blue.createGame(players());
  game.players[0].inventory = { steen: 20, hout: 10 };
  blue.handleAction(game, 'p1', 'craft', { recipeKey: 'kookvuur' });
  assert.equal(game.camp.hasKookvuur, true);
});

test('craft bouwt een vlot voor de speler die het maakt', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  player.inventory = { hout: 25, vezel: 10 };
  blue.handleAction(game, 'p1', 'craft', { recipeKey: 'vlot' });
  assert.equal(player.hasRaft, true);
});

test('repair herstelt de duurzaamheid maar verlaagt het maximum', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  player.tools.axe.durability = 10;
  player.inventory.hout = 10;
  const maxBefore = player.tools.axe.maxDurability;
  blue.handleAction(game, 'p1', 'repair', { slot: 'axe' });
  assert.equal(player.tools.axe.durability, player.tools.axe.maxDurability);
  assert.ok(player.tools.axe.maxDurability < maxBefore);
});

/* ---------------- expeditie & resultaat ---------------- */

test('endExpedition is voorbehouden aan de host', () => {
  const game = blue.createGame(twoPlayers());
  assert.throws(() => blue.handleAction(game, 'p2', 'endExpedition'), /host/);
  blue.handleAction(game, 'p1', 'endExpedition');
  assert.equal(game.gameOver, true);
  assert.ok(game.resultText.length > 0);
});

test('results rangschikt spelers op codex, buit en uitrusting', () => {
  const game = blue.createGame(twoPlayers());
  game.players[0].codex = { baars: true, snoek: true };
  const scored = blue.results(game, 1000);
  const ada = scored.find((r) => r.playerId === 'p1');
  const bo = scored.find((r) => r.playerId === 'p2');
  assert.ok(ada.score > bo.score);
  assert.equal(ada.won, true);
  assert.equal(bo.won, false);
});

/* ---------------- tijd & serialisatie ---------------- */

test('tick laat de klok lopen en regenereert energie', () => {
  const game = blue.createGame(players());
  const player = game.players[0];
  player.energy = 50;
  const before = game.clockMin;
  blue.tick(game, game.lastTickAt + 800 * 5);
  assert.notEqual(game.clockMin, before);
  assert.ok(player.energy >= 50);
});

test('serialize toont eigen details maar alleen positie en leven van anderen', () => {
  const game = blue.createGame(twoPlayers());
  const connected = new Map([['p1', true], ['p2', true]]);
  const view = blue.serialize(game, 'p1', connected);
  const me = view.players.find((p) => p.id === 'p1');
  const other = view.players.find((p) => p.id === 'p2');
  assert.equal(view.kind, 'the-blue');
  assert.ok('inventory' in me);
  assert.ok(!('inventory' in other));
  assert.ok('x' in other && 'hp' in other);
});
