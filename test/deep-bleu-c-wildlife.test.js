const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dbc = require('../games/deep-bleu-c/server');
const resources = require('../games/deep-bleu-c/resources');

function atlas() {
  let route, result;
  dbc.configureHttp({ app: { get(_url, handler) { route = handler; } } });
  route({}, { setHeader() {}, json(value) { result = value; } });
  return result;
}

test('wildlife artwork and hunt encounters identify the same stable animal', () => {
  const spots = atlas().wildlife;
  assert.deepEqual(atlas().wildlife, spots);
  assert.equal(new Set(spots.map((spot) => spot.setId)).size, 3);
  const game = dbc.createGame([{ id: 'a', name: 'Ada' }]);
  game.clock.startedAt = Date.now() - 20 * 60 * 1000;
  const player = game.players[0];
  for (const spot of spots) {
    assert.equal(resources.getItem('meat', spot.speciesId).setId, spot.setId);
    assert.ok(fs.existsSync(path.join(__dirname, '../games/deep-bleu-c/assets/wildlife', spot.setId + '.svg')));
    player.x = spot.x; player.y = spot.y; player.combat = null;
    dbc.handleAction(game, 'a', 'huntStart', spot);
    assert.equal(player.combat.speciesId, spot.speciesId);
  }
});

test('night wildlife locks match the server and react to available energy', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../games/deep-bleu-c/wildlife-visuals.js'), 'utf8');
  const { wildlifeStatus } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const spot = atlas().wildlife.find((entry) => entry.nightOnly);
  const game = dbc.createGame([{ id: 'a', name: 'Ada' }]);
  const player = game.players[0];
  player.x = spot.x; player.y = spot.y;
  assert.equal(wildlifeStatus(spot, player, 'day').state, 'locked');
  assert.throws(() => dbc.handleAction(game, 'a', 'huntStart', spot), /nachts/);
  assert.equal(wildlifeStatus(spot, player, 'night').state, 'ready');
  player.stats.energy = 0;
  assert.equal(wildlifeStatus(spot, player, 'night').state, 'locked');
});
