const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lutro = require('../games/lutro/server');

function withRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = original; }
}
function players(count = 4, npcFrom = count) {
  return Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `Speler ${index}`, isNpc: index >= npcFrom }));
}
function readyPawn(player, type, progress, hp) {
  const pawn = player.pawns.find((item) => item.type === type);
  pawn.progress = progress;
  pawn.hp = hp ?? pawn.maxHp;
  return pawn;
}
function forceAction(game, playerId, roll = 1) {
  game.turnIndex = game.players.findIndex((player) => player.id === playerId);
  game.phase = 'action';
  game.lastRoll = roll;
}

test('ieder rijk start met een kasteel van 100 HP, nul coins en vier vaste troepentypes', () => {
  const game = lutro.createGame(players(4));
  assert.deepEqual(game.players.map((player) => player.camp), ['red', 'green', 'yellow', 'blue']);
  assert.deepEqual(lutro.CAMPS.map((camp) => camp.name), ['Sauron', 'Elven', 'Dwergen', 'Mensen']);
  game.players.forEach((player) => {
    assert.equal(player.castleHp, 100);
    assert.equal(player.coins, 0);
    assert.deepEqual(player.pawns.map((pawn) => pawn.type), ['normal', 'fast', 'strong', 'hero']);
  });
});

test('de lobbykeuze bepaalt de startfactie en bijbehorende held', () => {
  assert.deepEqual(lutro.normalizeRoomOptions({ startingFaction: 'green' }), { startingFaction: 'green' });
  assert.deepEqual(lutro.normalizeRoomOptions({ startingFaction: 'onbekend' }), { startingFaction: 'red' });
  const game = lutro.createGame(players(4), { startingFaction: 'green' });
  assert.deepEqual(game.players.map((player) => player.camp), ['green', 'yellow', 'blue', 'red']);
  assert.deepEqual(game.players.map((player) => player.pawns.find((pawn) => pawn.type === 'hero').hero.name), ['Legolas', 'Gimli', 'Aragorn', 'Sauron']);
  assert.match(game.log[0], /begint voor Elven/);
});

test('iedere factie gebruikt vier eigen thematische troepen', () => {
  assert.deepEqual(lutro.FACTION_UNITS, [
    { normal: 'Orc', fast: 'Nazgûl', strong: 'Trol', hero: 'Sauron' },
    { normal: 'Elf met boog', fast: 'Adelaar', strong: 'Elf met zwaard', hero: 'Legolas' },
    { normal: 'Lonely Mountain-dwerg', fast: 'Dwerg op pony', strong: 'Iron Hills-dwerg', hero: 'Gimli' },
    { normal: 'Minas Tirith-soldaat', fast: 'Rohirrim', strong: 'Númenóreaan', hero: 'Aragorn' }
  ]);
  const game = lutro.createGame(players(4));
  game.players.forEach((player, seat) => {
    assert.deepEqual(player.pawns.map((pawn) => pawn.label), ['normal', 'fast', 'strong', 'hero'].map((type) => lutro.FACTION_UNITS[seat][type]));
  });
});

test('troepenstats en kostprijzen volgen de afgesproken waarden', () => {
  assert.deepEqual(lutro.UNIT_TYPES.normal, { label: 'Soldaat', cost: 20, damage: 10, maxHp: 10, speed: 10, movementBonus: 2, castleDamageOnDefeat: 10 });
  assert.deepEqual(lutro.UNIT_TYPES.fast, { label: 'Snelle soldaat', cost: 60, damage: 5, maxHp: 5, speed: 20, movementBonus: 4, castleDamageOnDefeat: 15 });
  assert.deepEqual(lutro.UNIT_TYPES.strong, { label: 'Sterke soldaat', cost: 40, damage: 15, maxHp: 15, speed: 5, movementBonus: 1, castleDamageOnDefeat: 15 });
  assert.deepEqual(lutro.UNIT_TYPES.hero, { label: 'Held', cost: 100, damage: 20, maxHp: 20, speed: 20, movementBonus: 3, castleDamageOnDefeat: 25 });
});

test('ieder oog levert tien coins en opent één actiefase', () => {
  const game = lutro.createGame(players(2));
  withRandom(0.5, () => lutro.handleAction(game, 'p0', 'roll')); // 4
  assert.equal(game.lastRoll, 4);
  assert.equal(game.lastCoinGain, 40);
  assert.equal(game.players[0].coins, 40);
  assert.equal(game.phase, 'action');
  assert.throws(() => lutro.handleAction(game, 'p0', 'roll'), /kies eerst/i);
});

test('een troep wordt met coins gekocht zonder zes en start op het eigen startvak', () => {
  const game = lutro.createGame(players(2));
  withRandom(0.2, () => lutro.handleAction(game, 'p0', 'roll')); // 2 = 20 coins
  lutro.handleAction(game, 'p0', 'buy', { type: 'normal' });
  const pawn = game.players[0].pawns[0];
  assert.equal(pawn.progress, 0);
  assert.equal(pawn.hp, 10);
  assert.equal(game.players[0].coins, 0);
  assert.equal(game.turnIndex, 1);
});

test('kopen controleert prijs en beschikbaarheid', () => {
  const game = lutro.createGame(players(2));
  forceAction(game, 'p0', 1);
  assert.throws(() => lutro.handleAction(game, 'p0', 'buy', { type: 'hero' }), /onvoldoende coins/i);
  game.players[0].coins = 100;
  lutro.handleAction(game, 'p0', 'buy', { type: 'hero' });
  forceAction(game, 'p0', 1);
  assert.throws(() => lutro.handleAction(game, 'p0', 'buy', { type: 'hero' }), /al ingezet/i);
});

test('iedere troepenklasse telt een vaste bonus bij de worp', () => {
  const game = lutro.createGame(players(2));
  const player = game.players[0];
  assert.deepEqual(player.pawns.map((pawn) => lutro.movementSteps(pawn, 3)), [5, 7, 4, 6]);
});

test('de worp geeft coins maar verplaatst geen troepen automatisch', () => {
  const game = lutro.createGame(players(2));
  const player = game.players[0];
  player.pawns.forEach((pawn) => readyPawn(player, pawn.type, 0));
  withRandom(0.5, () => lutro.handleAction(game, player.id, 'roll')); // 4
  assert.equal(player.coins, 40);
  assert.equal(game.lastCoinGain, 40);
  assert.deepEqual(player.pawns.map((pawn) => pawn.progress), [0, 0, 0, 0]);
  assert.equal(game.phase, 'action');
});

test('alleen de gekozen troep beweegt met de worp plus zijn bonus', () => {
  const game = lutro.createGame(players(2));
  const player = game.players[0];
  const stationary = readyPawn(player, 'normal', 0);
  const pawn = readyPawn(player, 'strong', 0);
  withRandom(0.5, () => lutro.handleAction(game, player.id, 'roll')); // 4 + 1 bonus
  lutro.handleAction(game, player.id, 'move', { pawnId: pawn.id });
  assert.equal(pawn.progress, 5);
  assert.equal(stationary.progress, 0);
});

test('landen op een vijand beschadigt de troep en een uitschakeling beschadigt het kasteel', () => {
  const game = lutro.createGame(players(2));
  const red = game.players[0], green = game.players[1];
  const attacker = readyPawn(red, 'strong', 18);
  const defender = readyPawn(green, 'normal', 7); // absoluut routevak 20
  forceAction(game, red.id, 1);
  lutro.handleAction(game, red.id, 'move', { pawnId: attacker.id });
  assert.equal(defender.progress, -1);
  assert.equal(defender.hp, 0);
  assert.equal(green.castleHp, 90);
  assert.equal(attacker.hp, 15);
});

test('een overlevende verdediger slaat terug en HP blijft bewaard', () => {
  const game = lutro.createGame(players(2));
  const red = game.players[0], green = game.players[1];
  const attacker = readyPawn(red, 'fast', 14);
  const defender = readyPawn(green, 'strong', 7); // absoluut routevak 20
  forceAction(game, red.id, 2);
  lutro.handleAction(game, red.id, 'move', { pawnId: attacker.id });
  assert.equal(defender.hp, 10, 'snelle soldaat doet 5 damage');
  assert.equal(attacker.progress, -1, 'de tegenaanval schakelt de snelle soldaat uit');
  assert.equal(red.castleHp, 85, 'verlies van een snelle soldaat doet 15 kasteelschade');
});

test('een gevecht tussen troepen levert een lastCombat-samenvatting voor de pop-up', () => {
  const game = lutro.createGame(players(2));
  const red = game.players[0], green = game.players[1];
  const attacker = readyPawn(red, 'strong', 18);
  readyPawn(green, 'normal', 7); // absoluut routevak 20
  forceAction(game, red.id, 1);
  lutro.handleAction(game, red.id, 'move', { pawnId: attacker.id });
  assert.equal(game.lastCombat.attackerName, red.name);
  assert.equal(game.lastCombat.defenderName, green.name);
  assert.equal(game.lastCombat.defenderDefeated, true);
  assert.equal(game.lastCombat.defenderCastleDamage, 10);
  const view = lutro.serialize(game, red.id);
  assert.equal(view.lastCombat.seq, game.lastCombat.seq);
});

test('passen mag alleen als geen enkele troep kan bewegen, kopen of aanvallen', () => {
  const game = lutro.createGame(players(2));
  const red = game.players[0];
  const movablePawn = readyPawn(red, 'normal', 5);
  forceAction(game, red.id, 1);
  assert.equal(lutro.serialize(game, red.id).canPass, false);
  assert.throws(() => lutro.handleAction(game, red.id, 'pass'), /geldige actie/i);
  movablePawn.progress = lutro.FINISH_PROGRESS; // geen beweegbare troep meer
  red.coins = 0; // niets meer te kopen
  forceAction(game, red.id, 1);
  assert.equal(lutro.serialize(game, red.id).canPass, true);
  lutro.handleAction(game, red.id, 'pass');
  assert.match(game.log[0], /past/);
});

test('het midden doet alle andere kastelen 25 damage', () => {
  const game = lutro.createGame(players(4));
  const red = game.players[0];
  const pawn = readyPawn(red, 'normal', lutro.FINISH_PROGRESS - 3);
  forceAction(game, red.id, 1);
  lutro.handleAction(game, red.id, 'move', { pawnId: pawn.id });
  assert.equal(pawn.progress, lutro.FINISH_PROGRESS);
  assert.deepEqual(game.players.slice(1).map((player) => player.castleHp), [75, 75, 75]);
  assert.equal(red.castleHp, 100);
});

test('een kasteelzone kan vanaf hetzelfde vak maar één keer worden aangevallen', () => {
  const game = lutro.createGame(players(2));
  const red = game.players[0], green = game.players[1];
  const pawn = readyPawn(red, 'normal', 13); // rood aanvalsvak bij het Elvenkasteel
  forceAction(game, red.id, 3);
  const option = lutro.attackOptions(game, red)[0];
  assert.deepEqual({ pawnId: option.pawnId, targetPlayerId: option.targetPlayerId }, { pawnId: pawn.id, targetPlayerId: green.id });
  lutro.handleAction(game, red.id, 'castleAttack', option);
  assert.equal(green.castleHp, 90);
  forceAction(game, red.id, 3);
  assert.equal(lutro.attackOptions(game, red).length, 0);
});

test('alleen de acht rood gemarkeerde vakken zijn gewone kasteelaanvalsvakken', () => {
  assert.deepEqual(lutro.ATTACK_SITES, [[0, 9], [13, 22], [26, 35], [39, 48]]);
  const game = lutro.createGame(players(2));
  const red = game.players[0];
  readyPawn(red, 'normal', 12); // naast, maar niet op, Elven-aanvalsvak 13
  forceAction(game, red.id, 1);
  assert.equal(lutro.attackOptions(game, red).length, 0);
});

test('Legolas valt van extra afstand aan en Gimli vermindert inkomende schade', () => {
  const game = lutro.createGame(players(3));
  const red = game.players[0], green = game.players[1], dwarves = game.players[2];
  const legolas = readyPawn(green, 'hero', 12); // absoluut 25, naast aanvalsvak 26 van de Dwergen
  forceAction(game, green.id, 1);
  assert.ok(lutro.attackOptions(game, green).some((option) => option.pawnId === legolas.id && option.targetPlayerId === dwarves.id));

  const attacker = readyPawn(red, 'normal', 17);
  const gimli = readyPawn(dwarves, 'hero', 46); // absoluut routevak 20
  forceAction(game, red.id, 1);
  lutro.handleAction(game, red.id, 'move', { pawnId: attacker.id });
  assert.equal(gimli.hp, 15, 'Mithrilpantser vermindert 10 damage naar 5');
});

test('Sauron overleeft één dodelijke treffer dankzij de Ring', () => {
  const game = lutro.createGame(players(2));
  const red = game.players[0], green = game.players[1];
  const sauron = readyPawn(red, 'hero', 20);
  const legolas = readyPawn(green, 'hero', 2); // absoluut 15; worp 2 + bonus 3 landt op 20
  forceAction(game, green.id, 2);
  lutro.handleAction(game, green.id, 'move', { pawnId: legolas.id });
  assert.equal(sauron.hp, 1);
  assert.equal(sauron.progress, 20);
  assert.equal(sauron.ringUsed, true);
});

test('Aragorn herstelt 5 HP na een overleefd gevecht', () => {
  const game = lutro.createGame(players(4));
  const green = game.players[1], men = game.players[3];
  const aragorn = readyPawn(men, 'hero', 28, 10); // absoluut 15; worp 2 + bonus 3 beweegt naar 20
  readyPawn(green, 'fast', 7); // absoluut routevak 20
  forceAction(game, men.id, 2);
  lutro.handleAction(game, men.id, 'move', { pawnId: aragorn.id });
  assert.equal(aragorn.hp, 15);
});

test('het laatste overgebleven kasteel wint', () => {
  const game = lutro.createGame(players(2));
  const red = game.players[0], green = game.players[1];
  green.castleHp = 10;
  const pawn = readyPawn(red, 'normal', 13);
  forceAction(game, red.id, 1);
  const option = lutro.attackOptions(game, red)[0];
  lutro.handleAction(game, red.id, 'castleAttack', option);
  assert.equal(green.eliminated, true);
  assert.equal(game.gameOver, true);
  assert.equal(game.winnerId, red.id);
});

test('serialize levert coins, kasteel-HP, troepenstats en geldige acties', () => {
  const game = lutro.createGame(players(2));
  game.players[0].coins = 80;
  readyPawn(game.players[0], 'normal', 4);
  forceAction(game, 'p0', 3);
  const view = lutro.serialize(game, 'p0', new Map([['p0', true], ['p1', true]]));
  assert.equal(view.schemaVersion, 8);
  assert.equal(view.canAct, true);
  assert.equal(view.players[0].castleMaxHp, 100);
  assert.equal(view.players[0].coins, 80);
  assert.equal(view.players[0].pawns[0].damage, 10);
  assert.equal(view.players[0].pawns[0].movementBonus, 2);
  assert.deepEqual(view.movablePawnIds, [game.players[0].pawns[0].id]);
});

test('NPC verdient coins en voert koop- of bewegingsacties uit', () => {
  const game = lutro.createGame(players(2, 0));
  let now = Date.now();
  for (let index = 0; index < 40 && !game.gameOver; index += 1) {
    now += 1000;
    assert.doesNotThrow(() => lutro.tick(game, now));
  }
  assert.ok(game.log.length > 4);
  assert.ok(game.players.some((player) => player.coins > 0 || player.pawns.some((pawn) => pawn.progress >= 0)));
});

test('de client toont de thematische kasteelstrijd, shop en HP-balken fullscreen', () => {
  const client = fs.readFileSync(path.join(__dirname, '../games/lutro/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../games/lutro/styles.css'), 'utf8');
  const boardArt = path.join(__dirname, '../games/lutro/assets/four-realms-board.png');
  const unitAtlases = ['units-mordor.png', 'units-elven.png', 'units-dwarves.png', 'units-men.png']
    .map((name) => path.join(__dirname, '../games/lutro/assets', name));
  assert.match(client, /buildShop/);
  assert.match(client, /export function renderLobbyOptions/);
  assert.match(client, /Sauron.*Legolas.*Gimli.*Aragorn/s);
  assert.match(client, /unitSprite/);
  assert.match(client, /castleAttack/);
  assert.match(client, /ATTACK_SITES/);
  assert.match(client, /lutro-unit-hp/);
  assert.match(css, /four-realms-board\.png/);
  assert.match(css, /lutro-castle-hp/);
  assert.match(css, /lutro-cell\.attack-site/);
  assert.match(css, /lutro-faction-choices/);
  assert.match(css, /units-mordor\.png/);
  assert.match(css, /#gameStage:has\(\.lutro-root\)/);
  assert.ok(fs.statSync(boardArt).size > 100000);
  unitAtlases.forEach((atlas) => assert.ok(fs.statSync(atlas).size > 500000));
  assert.doesNotMatch(client, /isoX|turret/i);
});
