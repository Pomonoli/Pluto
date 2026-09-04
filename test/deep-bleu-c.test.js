const test = require('node:test');
const assert = require('node:assert/strict');
const dbc = require('../games/deep-bleu-c/server');

function makeGame() {
  return dbc.createGame([
    { id: 'a', name: 'Ada' },
    { id: 'b', name: 'Bo' }
  ]);
}

function playerOf(game, id) { return game.players.find((p) => p.id === id); }

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
