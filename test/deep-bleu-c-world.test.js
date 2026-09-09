'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const worldgen = require('../games/deep-bleu-c/worldgen');
const starter = require('../games/deep-bleu-c/starter-world');
const dbc = require('../games/deep-bleu-c/server');
const { hexNeighbors } = require('../games/deep-bleu-c/hexmath');

test('expanded atlas preserves original terrain, landmarks and hex adjacency', () => {
  const old = starter.getWorld(), world = worldgen.getWorld();
  const offset = worldgen.STARTER_OFFSET;
  assert.ok(world.tiles.length > old.tiles.length * 10);
  assert.equal(offset.y % 2, 0);
  for (let y = 0; y < old.height; y += 1) {
    for (let x = 0; x < old.width; x += 1) {
      const tile = starter.tileAt(old, x, y);
      if (tile !== 'w') assert.equal(worldgen.tileAt(world, x + offset.x, y + offset.y), tile);
    }
  }
  assert.deepEqual(world.spawn, { x: old.spawn.x + offset.x, y: old.spawn.y + offset.y });
  assert.deepEqual(world.buildings, old.buildings.map((b) => ({ ...b, x: b.x + offset.x, y: b.y + offset.y })));
  assert.equal(worldgen.resourceAt(world, world.kelpIsland.x, world.kelpIsland.y), 'kelp');
  assert.equal(worldgen.buildWorld().tileString, world.tileString);
});

test('outer islands have reachable landing beaches, resources and an intact waterfall boundary', () => {
  const world = worldgen.getWorld();
  const seen = new Set();
  const reachable = new Set();
  const stack = [world.spawn];
  while (stack.length) {
    const { x, y } = stack.pop();
    const key = y * world.width + x;
    if (reachable.has(key)) continue;
    reachable.add(key);
    for (const [nx, ny] of hexNeighbors(x, y)) {
      if (worldgen.isWalkable(world, nx, ny, worldgen.WATER) && !reachable.has(ny * world.width + nx)) stack.push({ x: nx, y: ny });
    }
  }
  let islands = 0;
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const tile = worldgen.tileAt(world, x, y);
      if (x < 2 || y < 2 || x >= world.width - 2 || y >= world.height - 2) {
        assert.equal(tile, 'w');
        assert.equal(worldgen.isWalkable(world, x, y, worldgen.WATER), false);
        continue;
      }
      assert.notEqual(tile, 'w');
      if (seen.has(y * world.width + x) || (!worldgen.WALKABLE.has(tile) && tile !== 'p')) continue;
      const land = [{ x, y }];
      let landing = false;
      while (land.length) {
        const spot = land.pop(), key = spot.y * world.width + spot.x;
        if (seen.has(key)) continue;
        seen.add(key);
        if (worldgen.tileAt(world, spot.x, spot.y) === 'B' && reachable.has(key)) landing = true;
        for (const [nx, ny] of hexNeighbors(spot.x, spot.y)) {
          const next = worldgen.tileAt(world, nx, ny);
          if ((worldgen.WALKABLE.has(next) || next === 'p') && !seen.has(ny * world.width + nx)) land.push({ x: nx, y: ny });
        }
      }
      // Wierlicht deliberately uses its own K coast instead of beach tiles.
      assert.ok(landing || seen.has(world.kelpIsland.y * world.width + world.kelpIsland.x) && tile === 'K');
      islands += 1;
    }
  }
  assert.ok(islands >= 25, `${islands} separate islands`);
  for (const [x, y] of [[40,44], [118,44], [15,82], [133,78], [42,116], [99,128], [16,147], [53,148]]) {
    const beach = worldgen.nearestWalkable(world, x, y);
    assert.ok(beach);
    assert.ok(worldgen.findPath(world, world.spawn.x, world.spawn.y, beach.x, beach.y, worldgen.WATER));
  }
  assert.ok(world.wildlife.some((spot) => spot.x < 40));
  assert.ok(world.tiles.slice(0, world.width * 56).includes('f'));
  assert.ok(world.tiles.slice(0, world.width * 56).includes('p'));
});

test('legacy saves move player, boat and depleted nodes once while preserving progress', () => {
  const old = starter.getWorld();
  const legacy = {
    ...old.spawn, cash: 123, skills: { fishing: 250 },
    boat: { ...old.boats[0], stations: ['workbench'] },
    personalNodes: { 'wood:20:21': { depletedUntil: 123456, harvestCount: 4 } }
  };
  const before = structuredClone(legacy);
  const game = dbc.createGame([{ id: 'a', name: 'Ada', dbcState: legacy }]);
  const player = game.players[0];
  assert.deepEqual({ x: player.x, y: player.y }, worldgen.getWorld().spawn);
  assert.equal(player.boat.x, legacy.boat.x + 56);
  assert.equal(player.boat.y, legacy.boat.y + 56);
  assert.deepEqual(player.personalNodes['wood:76:77'], legacy.personalNodes['wood:20:21']);
  assert.equal(player.cash, 123);
  assert.equal(player.skills.fishing, 250);
  assert.deepEqual(legacy, before);
  let saved;
  dbc.afterStateChange({ gameState: game, players: [{ id: 'a', userId: 'u' }] }, {
    db: { saveDeepBleuCPlayer(_id, value) { saved = value; } }
  });
  assert.equal(saved.worldVersion, worldgen.WORLD_VERSION);
  const restored = dbc.createGame([{ id: 'b', name: 'Ada', dbcState: saved }]).players[0];
  assert.equal(restored.x, player.x);
  assert.equal(restored.y, player.y);
  assert.deepEqual(restored.boat, player.boat);
  assert.deepEqual(restored.personalNodes, player.personalNodes);
});
