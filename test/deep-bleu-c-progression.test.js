'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const dbc = require('../games/deep-bleu-c/server');
const fish = require('../games/deep-bleu-c/fish');
const resources = require('../games/deep-bleu-c/resources');
const worldgen = require('../games/deep-bleu-c/worldgen');
const { hexNeighbors } = require('../games/deep-bleu-c/hexmath');

test('fish pools unlock at the exact rod level and retain biome and night restrictions', () => {
  for (const set of fish.SETS) {
    assert.ok(set.requiredToolLevel >= 1 && set.requiredToolLevel <= 10);
    const below = fish.fishForBiome(set.biome, true, set.requiredToolLevel - 1);
    const unlocked = fish.fishForBiome(set.biome, true, set.requiredToolLevel);
    for (const entry of set.fish) {
      assert.ok(!below.some((item) => item.id === entry.id));
      assert.ok(unlocked.some((item) => item.id === entry.id));
      if (set.nightOnly) assert.ok(!fish.fishForBiome(set.biome, false, 10).some((item) => item.id === entry.id));
    }
  }
  for (let level = 1; level <= 10; level += 1) {
    for (const biome of ['rivier', 'kust', 'atlantisch', 'middellandse-zee']) {
      assert.ok(fish.fishForBiome(biome, true, level).every((entry) => entry.requiredToolLevel <= level));
    }
  }
});

test('casting locked waters fails before starting an action, and hook/reel enforce rod level', () => {
  const world = worldgen.getWorld();
  const game = dbc.createGame([{ id: 'a', name: 'Ada' }]);
  const player = game.players[0];
  const index = world.tiles.indexOf('a');
  player.x = index % world.width; player.y = Math.floor(index / world.width);
  const energy = player.stats.energy;
  assert.throws(() => dbc.handleAction(game, 'a', 'cast', player), /Hengel niveau 4/);
  assert.equal(player.fishing, null);
  assert.equal(player.stats.energy, energy);
  player.gear.rod = 3;
  dbc.handleAction(game, 'a', 'cast', player);
  for (let i = 0; i < 80; i += 1) {
    player.fishing = { phase: 'bite', biome: 'atlantisch', hookDeadline: Date.now() + 10000 };
    dbc.handleAction(game, 'a', 'hook');
    assert.ok(fish.getFish(player.fishing.speciesId).requiredToolLevel <= 4);
  }
  player.gear.rod = 0;
  assert.throws(() => dbc.handleAction(game, 'a', 'reel'), /Hengel niveau/);
  assert.equal(player.inventory.length, 0);
});

test('wood and rock nodes expose every set and block harvesting below its tool level', () => {
  const world = worldgen.getWorld();
  const game = dbc.createGame([{ id: 'a', name: 'Ada' }]);
  const player = game.players[0];
  player.skills.woodcutting = 1000000000;
  player.skills.mining = 1000000000;
  for (const [kind, key] of [['wood', 'axe'], ['rock', 'pickaxe']]) {
    const foundSets = new Set();
    const foundSpecies = new Set();
    let blocked = 0;
    for (let y = 0; y < world.height; y += 1) {
      for (let x = 0; x < world.width; x += 1) {
        if (worldgen.resourceAt(world, x, y) !== kind) continue;
        const neighbor = hexNeighbors(x, y).find(([nx, ny]) => worldgen.isWalkable(world, nx, ny));
        if (!neighbor) continue;
        [player.x, player.y] = neighbor;
        player.gear[key] = 9;
        player.gathering = null;
        dbc.handleAction(game, 'a', 'gatherStart', { kind, x, y });
        const entry = resources.getItem(kind, player.gathering.profileId);
        assert.ok(entry);
        foundSets.add(entry.setId);
        foundSpecies.add(entry.id);
        if (entry.requiredToolLevel > 1) {
          player.gathering = null;
          player.gear[key] = entry.requiredToolLevel - 2;
          assert.throws(() => dbc.handleAction(game, 'a', 'gatherStart', { kind, x, y }), /vraagt/);
          assert.equal(player.gathering, null);
          blocked += 1;
        }
        player.gear[key] = entry.requiredToolLevel - 1;
        player.gathering = null;
        dbc.handleAction(game, 'a', 'gatherStart', { kind, x, y });
        player.gathering.phase = 'bite';
        player.gathering.hookDeadline = Date.now() + 10000;
        dbc.handleAction(game, 'a', 'gatherStrike');
        assert.equal(player.gathering.speciesId, entry.id);
        if (entry.requiredToolLevel > 1) {
          player.gear[key] = entry.requiredToolLevel - 2;
          assert.throws(() => dbc.handleAction(game, 'a', 'gatherHaul'), /vraagt/);
        }
      }
    }
    assert.ok(blocked > 0);
    assert.equal(foundSets.size, resources.setsFor(kind).length);
    assert.equal(foundSpecies.size, resources.poolFor(kind).length, 'every species has an accessible node');
  }
  assert.deepEqual(player.personalNodes, {});
  assert.equal(player.woodInventory.length, 0);
  assert.equal(player.rockInventory.length, 0);
});

test('set requirements preserve earlier discoveries while reporting locked sets', () => {
  const game = dbc.createGame([{ id: 'a', name: 'Ada', dbcState: { rockDiscovered: ['diamant'] } }]);
  const you = dbc.serialize(game, 'a').you;
  assert.ok(you.rockSets.flatMap((set) => set.items).find((item) => item.id === 'diamant').discovered);
  assert.ok(you.sets.every((set) => set.unlocked === (set.requiredToolLevel <= 1)));
  assert.ok(you.woodSets.every((set) => set.toolLabel === 'Bijl'));
  assert.ok(you.rockSets.every((set) => set.toolLabel === 'Houweel'));
});
