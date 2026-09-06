'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const duel = require('../games/seven-wonders-duel/server');

function player(id, isNpc = false) {
  return { id, name:id, isNpc };
}

test('7 Wonders Duel vereist exact twee spelers en maakt een speelbare leeftijd', () => {
  assert.throws(() => duel.createGame([player('A')]), /precies 2 spelers/i);
  assert.throws(() => duel.createGame([player('A'), player('B'), player('C')]), /precies 2 spelers/i);

  const game = duel.createGame([player('A'), player('B')]);
  assert.equal(game.players.length, 2);
  assert.equal(game.age, 1);
  assert.equal(game.ageCards.length, 20);
  assert.equal(duel.availableCards(game).length, 6);
  assert.equal(game.players[0].wonders.length, 4);
  assert.equal(game.players[1].wonders.length, 4);
});

test('beschikbare kaarten kunnen server-side gebouwd of afgelegd worden', () => {
  const game = duel.createGame([player('A'), player('B')]);
  const current = game.players[game.turnIndex];
  const state = duel.serialize(game, current.id, new Map([[current.id, true]]));
  const available = state.cards.filter((card) => card.available);
  assert.ok(available.length > 0);

  const affordable = available.find((card) => card.affordable);
  if (affordable) {
    const before = current.built.length;
    duel.handleAction(game, current.id, 'build', { cardId:affordable.id });
    assert.equal(current.built.length, before + 1);
  } else {
    const before = current.coins;
    duel.handleAction(game, current.id, 'discard', { cardId:available[0].id });
    assert.ok(current.coins > before);
  }
});

test('bouwkosten tonen grondstoftekorten en berekenen directe handel volgens de bestaande regels', () => {
  const game = duel.createGame([player('A'), player('B')]);
  const [buyer, opponent] = game.players;
  buyer.coins = 7;
  buyer.built = [{ produces:{wood:1} }, { produces:{wildRaw:1} }];
  opponent.built = [{ produces:{clay:2} }];
  const item = { color:'blue', cost:{coins:2,resources:{wood:2,clay:1,glass:1}} };

  const cost = duel.costInfo(game, buyer, item);
  assert.deepEqual(cost.purchases, {clay:{count:1,unitPrice:4},glass:{count:1,unitPrice:2}});
  assert.equal(cost.baseCoins, 2);
  assert.equal(cost.tradeCoins, 6);
  assert.equal(cost.coins, 8);
  assert.equal(cost.affordable, false);

  game.turnIndex = buyer.seat;
  const available = duel.availableCards(game)[0];
  available.color = item.color;
  available.cost = item.cost;
  const publicCard = duel.serialize(game, buyer.id, new Map([[buyer.id, true]])).cards.find((card) => card.id === available.id);
  assert.deepEqual(publicCard.cost, item.cost);
  assert.deepEqual(publicCard.trade.purchases, cost.purchases);

  buyer.effects.push('rawTrade');
  const discounted = duel.costInfo(game, buyer, item);
  assert.equal(discounted.tradeCoins, 3);
  assert.equal(discounted.coins, 5);
  assert.equal(discounted.affordable, true);
});

test('NPCs kunnen zelfstandig een volledige partij uitspelen', () => {
  const game = duel.createGame([player('NPC 1', true), player('NPC 2', true)]);
  let now = Date.now() + 10_000;
  for (let step = 0; step < 250 && !game.gameOver; step += 1) {
    duel.tick(game, now);
    now += 1_000;
  }

  assert.equal(game.gameOver, true);
  assert.ok(['military', 'science', 'civilian'].includes(game.winType));
  const results = duel.results(game);
  assert.equal(results.length, 2);
  assert.ok(results.every((result) => Number.isFinite(result.score)));
});
