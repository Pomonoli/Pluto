'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dbc = require('../games/deep-bleu-c/server');
const worldgen = require('../games/deep-bleu-c/worldgen');
const resources = require('../games/deep-bleu-c/resources');
const source = fs.readFileSync(path.join(__dirname, '../games/deep-bleu-c/tree-visuals.js'), 'utf8');
const visuals = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function atlas() {
  let route, result;
  dbc.configureHttp({ app: { get(_url, handler) { route = handler; } } });
  route({}, { setHeader() {}, json(value) { result = value; } });
  return result;
}

test('every tree has stable set artwork and requirements matching the harvest action', () => {
  const data = atlas(), world = worldgen.getWorld();
  assert.equal(Object.keys(data.trees).length, world.tiles.filter((tile) => tile === 'f').length);
  const game = dbc.createGame([{ id: 'a', name: 'Ada' }]);
  const player = game.players[0];
  for (const tree of Object.values(data.trees)) {
    assert.equal(worldgen.resourceAt(world, tree.x, tree.y), 'wood');
    assert.equal(resources.getItem('wood', tree.speciesId).setId, tree.setId);
    assert.ok(fs.existsSync(path.join(__dirname, '../games/deep-bleu-c/assets/trees', `${tree.setId}.svg`)));
    player.x = tree.x; player.y = tree.y;
    player.gear.axe = tree.requiredToolLevel - 1;
    player.skills.woodcutting = 1000000000;
    player.gathering = null;
    dbc.handleAction(game, 'a', 'gatherStart', { kind: 'wood', ...tree });
    assert.equal(player.gathering.profileId, tree.speciesId);
    if (tree.requiredToolLevel > 1) {
      player.gathering = null;
      player.gear.axe = tree.requiredToolLevel - 2;
      assert.throws(() => dbc.handleAction(game, 'a', 'gatherStart', { kind: 'wood', ...tree }), /vraagt/);
    }
  }
  assert.deepEqual(atlas().trees, data.trees);
});

test('tree indicators react independently to axe level, XP and recovery time', async () => {
  const { treeStatus } = await visuals;
  const tree = { x: 10, y: 20, name: 'Eik', requiredToolLevel: 2, requiredSkillLevel: 8 };
  const you = { gear: { axe: 0 }, skills: { woodcutting: { level: 8 } }, personalNodes: {} };
  assert.equal(treeStatus(tree, you, 1000).state, 'locked');
  you.gear.axe = 1;
  you.skills.woodcutting.level = 7;
  assert.equal(treeStatus(tree, you, 1000).state, 'locked');
  you.skills.woodcutting.level = 8;
  assert.equal(treeStatus(tree, you, 1000).state, 'ready');
  you.personalNodes['wood:10:20'] = { depletedUntil: 21000 };
  assert.equal(treeStatus(tree, you, 1000).state, 'recovering');
  assert.equal(treeStatus(tree, you, 1000).remaining, 20);
  assert.equal(treeStatus(tree, you, 21000).state, 'ready');
  assert.match(treeStatus(tree, you, 21000).description, /Bijl 2.*Kappen 8.*Kapbaar/);
});
