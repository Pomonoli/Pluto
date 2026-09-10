const test = require('node:test');
const assert = require('node:assert/strict');
const dbc = require('../games/deep-bleu-c/server');
const worldgen = require('../games/deep-bleu-c/worldgen');
const sliceContent = require('../games/deep-bleu-c/slice-content');
const { hexNeighbors } = require('../games/deep-bleu-c/hexmath');

function makeGame() {
  return dbc.createGame([
    { id: 'a', name: 'Ada' },
    { id: 'b', name: 'Bo' }
  ]);
}

function playerOf(game, id) { return game.players.find((p) => p.id === id); }

test('een bronklik op afstand stopt naast de bron zonder de actie te starten', () => {
  const game = makeGame();
  const player = playerOf(game, 'a');
  const world = worldgen.getWorld();
  const targets = [];
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (['wood', 'rock', 'animal'].includes(worldgen.resourceAt(world, x, y))) targets.push({ x, y });
    }
  }
  const target = targets.find((spot) => worldgen.hexDistance(player.x, player.y, spot.x, spot.y) > 2
    && hexNeighbors(spot.x, spot.y).some(([x, y]) => worldgen.findPath(world, player.x, player.y, x, y)));
  assert.ok(target);

  dbc.handleAction(game, 'a', 'move', { ...target, stopAdjacent: true });

  assert.ok(player.path.length);
  const destination = player.path.at(-1);
  assert.equal(worldgen.hexDistance(destination.x, destination.y, target.x, target.y), 1);
  assert.notDeepEqual(destination, target);
  assert.equal(player.gathering, null);
  assert.equal(player.combat, null);
});

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

test('toolcontent valideert vier volledige upgradepaden en bootstations', () => {
  assert.deepEqual(Object.keys(sliceContent.tools), ['rod', 'boat', 'axe', 'pickaxe']);
  for (const tool of Object.values(sliceContent.tools)) assert.equal(tool.tiers.length, 10);
  assert.equal(sliceContent.tools.axe.tiers[1].requires.station, 'workbench');
  assert.doesNotThrow(() => sliceContent.validateSliceContent(sliceContent));
  assert.deepEqual(sliceContent.tools.boat.tiers.map((tier) => tier.name), [
    'Vlot', 'Kano', 'Roeiboot', 'Zeilboot', 'Kustboot', 'Langschip',
    'Vrachtschip', 'Oorlogsschip', 'Drakkar', 'Koningsschip'
  ]);
});

test('alle vier upgradepaden vragen werkbank, materiaal, geld en gekoppeld skillniveau', () => {
  const materialBefore = {
    rod: 200,
    boat: 200,
    axe: 200,
    pickaxe: 200
  };
  const skillFor = { rod: 'fishing', boat: 'collecting', axe: 'woodcutting', pickaxe: 'mining' };

  for (const key of Object.keys(sliceContent.tools)) {
    const game = makeGame();
    const player = playerOf(game, 'a');
    const requirements = sliceContent.tools[key].tiers[1].requires;
    player.cash = 10000;
    player.skills[skillFor[key]] = 1000000000;
    player.boat.stations = ['workbench'];
    player.woodInventory.push({ uid: `${key}-wood`, speciesId: 'berk', weightKg: 200, caughtAt: Date.now() });
    player.rockInventory.push({ uid: `${key}-rock`, speciesId: 'kalksteen', weightKg: 200, caughtAt: Date.now() });
    player.materials.kelpFiber = 20;

    dbc.handleAction(game, 'a', 'buyUpgrade', { category: key });

    assert.equal(player.gear[key], 1, `${key} werd niet geüpgraded`);
    assert.equal(player.cash, 10000 - requirements.cash);
    if (requirements.softWoodKg) assert.equal(player.woodInventory[0].weightKg, materialBefore[key] - requirements.softWoodKg);
    if (requirements.rockKg) assert.equal(player.rockInventory[0].weightKg, materialBefore[key] - requirements.rockKg);
    if (requirements.kelpFiber) assert.equal(player.materials.kelpFiber, materialBefore[key] - requirements.kelpFiber);

    const serialized = dbc.serialize(game, 'a').you.toolUpgrades.find((tool) => tool.key === key);
    assert.equal(serialized.level, 1);
    assert.equal(serialized.current.name, sliceContent.tools[key].tiers[1].name);
  }
});

test('alle upgradepaden bereiken niveau 10 en weigeren daarna verdere kosten', () => {
  for (const [key, tool] of Object.entries(sliceContent.tools)) {
    const game = makeGame();
    const player = playerOf(game, 'a');
    player.cash = 1000000;
    player.skills[tool.skill] = 1000000000;
    player.boat.stations = ['workbench'];
    player.woodInventory.push({ uid: 'wood', speciesId: 'berk', weightKg: 100000 });
    player.rockInventory.push({ uid: 'rock', speciesId: 'kalksteen', weightKg: 100000 });
    for (let level = 1; level < 10; level += 1) {
      const before = player.cash;
      dbc.handleAction(game, 'a', 'buyUpgrade', { category: key });
      assert.equal(player.cash, before - tool.tiers[level].requires.cash);
      assert.equal(player.gear[key], level);
    }
    const upgrade = dbc.serialize(game, 'a').you.toolUpgrades.find((entry) => entry.key === key);
    assert.equal(upgrade.current.tier, 10);
    assert.equal(upgrade.next, null);
    const before = structuredClone(player);
    assert.throws(() => dbc.handleAction(game, 'a', 'buyUpgrade', { category: key }), /maximum/);
    assert.deepEqual(player, before);
    let saved;
    dbc.afterStateChange({ gameState: game, players: [{ id: 'a', userId: 'u' }] }, {
      db: { saveDeepBleuCPlayer(_id, value) { saved = value; } }
    });
    const restored = dbc.createGame([{ id: 'c', name: 'Ada', dbcState: saved }]).players[0];
    assert.equal(restored.gear[key], 9);
  }
});

test('aas verdwijnt uit oude saves, upgrades en setbeloningen', () => {
  const game = dbc.createGame([{ id: 'a', name: 'Ada', dbcState: { gear: { rod: 3, bait: 4, boat: 2, axe: 1, pickaxe: 2 } } }]);
  assert.deepEqual(game.players[0].gear, { rod: 3, boat: 2, axe: 1, pickaxe: 2 });
  assert.throws(() => dbc.handleAction(game, 'a', 'buyUpgrade', { category: 'bait' }), /Onbekende upgrade/);
  assert.ok(dbc.serialize(game, 'a').you.toolUpgrades.every((entry) => entry.key !== 'bait'));
  assert.ok(require('../games/deep-bleu-c/fish').SETS.every((set) => set.rewardGear !== 'bait'));
});

test('hogere vaartuigen varen sneller zonder wandelen te versnellen', () => {
  const game = makeGame(), player = playerOf(game, 'a');
  const world = worldgen.getWorld();
  const water = world.boats[0];
  player.gear.boat = 9;
  player.path = [water];
  player.nextStepAt = 0;
  dbc.tick(game, 1000);
  assert.equal(player.mode, 'sea');
  assert.equal(player.nextStepAt, 1120);
  player.path = [world.spawn];
  dbc.tick(game, 2000);
  assert.equal(player.mode, 'land');
  assert.equal(player.nextStepAt, 2170);
});

test('gereedschapsupgrade weigert iedere ontbrekende vereiste afzonderlijk', () => {
  const game = makeGame();
  const player = playerOf(game, 'a');
  player.cash = 10000;

  assert.throws(() => dbc.handleAction(game, 'a', 'buyUpgrade', { category: 'rod' }), /Werkbank/);
  player.boat.stations = ['workbench'];
  assert.throws(() => dbc.handleAction(game, 'a', 'buyUpgrade', { category: 'rod' }), /Vissen 3/);
  player.skills.fishing = 100000;
  assert.throws(() => dbc.handleAction(game, 'a', 'buyUpgrade', { category: 'rod' }), /8 kg zacht hout/);
  player.woodInventory.push({ uid: 'rod-wood', speciesId: 'berk', weightKg: 8, caughtAt: Date.now() });
  player.cash = 0;
  assert.throws(() => dbc.handleAction(game, 'a', 'buyUpgrade', { category: 'rod' }), /150/);
  player.cash = 150;
  dbc.handleAction(game, 'a', 'buyUpgrade', { category: 'rod' });
  assert.equal(player.gear.rod, 1);
});

test('een eik verbruikt niets en benoemt exact de ontbrekende tool en skill', () => {
  const game = makeGame();
  const player = playerOf(game, 'a');
  const world = worldgen.getWorld();
  let oak = null;
  for (let y = 0; y < world.height && !oak; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (worldgen.resourceAt(world, x, y) === 'wood' && Math.abs((x * 31 + y * 17) % 7) === 0) { oak = { x, y }; break; }
    }
  }
  assert.ok(oak);
  player.x = oak.x;
  player.y = oak.y;
  assert.throws(
    () => dbc.handleAction(game, 'a', 'gatherStart', { kind: 'wood', ...oak }),
    /Deze eik vraagt Bijl II en Kappen 8\./
  );
  assert.equal(player.gathering, null);
  assert.deepEqual(player.personalNodes, {});
});

test('Bijl II vereist materiaal, munten, Kappen 8 en een geplaatste werkbank', () => {
  const game = makeGame();
  const player = playerOf(game, 'a');
  player.cash = 120;
  player.skills.woodcutting = 2000;
  player.woodInventory.push({ uid: 'soft-1', speciesId: 'berk', weightKg: 40, caughtAt: Date.now() });

  assert.throws(() => dbc.handleAction(game, 'a', 'buyUpgrade', { category: 'axe' }), /Werkbank/);
  dbc.handleAction(game, 'a', 'placeBoatStation', { stationId: 'workbench' });
  assert.equal(player.boat.stations[0], 'workbench');
  dbc.handleAction(game, 'a', 'buyUpgrade', { category: 'axe' });

  assert.equal(player.gear.axe, 1);
  assert.equal(player.cash, 0);
  assert.equal(Math.round(player.woodInventory.reduce((sum, item) => sum + item.weightKg, 0)), 4);
});

test('de kano vaart naar Wierlicht en de Catch Cook Create-keten maakt een rantsoen', () => {
  const game = makeGame();
  const player = playerOf(game, 'a');
  const world = worldgen.getWorld();
  player.woodInventory.push({ uid: 'soft-1', speciesId: 'grove-den', weightKg: 12, caughtAt: Date.now() });
  dbc.handleAction(game, 'a', 'placeBoatStation', { stationId: 'workbench' });
  dbc.handleAction(game, 'a', 'placeBoatStation', { stationId: 'cookingTable' });

  dbc.handleAction(game, 'a', 'move', world.kelpIsland);
  let now = Date.now();
  for (let step = 0; step < 250 && player.path.length; step += 1) dbc.tick(game, now += 200);
  assert.equal(player.mode, 'land');
  assert.ok(player.discoveries.includes('kelp-island'));

  dbc.handleAction(game, 'a', 'gatherStart', { kind: 'kelp', x: world.kelpIsland.x, y: world.kelpIsland.y });
  player.gathering.phase = 'bite';
  player.gathering.hookDeadline = Date.now() + 1000;
  dbc.handleAction(game, 'a', 'gatherStrike');
  player.gathering.reelDeadline = Date.now() + 1000;
  dbc.handleAction(game, 'a', 'gatherHaul');
  assert.ok(player.materials.kelpFiber >= 1);

  player.inventory.push({ uid: 'fish-1', speciesId: 'baars', weightKg: 1, quality: 'raw', caughtAt: Date.now() });
  dbc.handleAction(game, 'a', 'cookCatch', { uid: 'fish-1' });
  dbc.handleAction(game, 'a', 'createSupply');
  assert.equal(player.createdSupplies, 1);
  assert.equal(player.inventory.some((item) => item.uid === 'fish-1'), false);
});

test('save en reload bewaart tooltier, skills, bootstations, nodes en ontdekkingen', () => {
  const game = makeGame();
  const player = playerOf(game, 'a');
  player.gear.axe = 1;
  player.skills.woodcutting = 1234;
  player.boat.stations = ['workbench', 'cookingTable'];
  player.personalNodes['wood:1:2'] = { depletedUntil: Date.now() + 1000, harvestCount: 2 };
  player.discoveries.push('kelp-island');
  player.materials.kelpFiber = 3;
  let saved;
  dbc.afterStateChange({ gameState: game, players: [{ id: 'a', userId: 'user-a' }] }, {
    db: { saveDeepBleuCPlayer(_userId, state) { saved = state; } }
  });
  const restored = dbc.createGame([{ id: 'a2', name: 'Ada', dbcState: saved }]).players[0];
  assert.equal(restored.gear.axe, 1);
  assert.equal(restored.skills.woodcutting, 1234);
  assert.deepEqual(restored.boat.stations, ['workbench', 'cookingTable']);
  assert.equal(restored.personalNodes['wood:1:2'].harvestCount, 2);
  assert.ok(restored.discoveries.includes('kelp-island'));
  assert.equal(restored.materials.kelpFiber, 3);
});
