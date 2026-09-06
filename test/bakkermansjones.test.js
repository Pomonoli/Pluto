const test = require('node:test');
const assert = require('node:assert/strict');
const bj = require('../games/bakkermansjones/server');

const players = () => [{ id: 'p1', name: 'Ada' }];

test('createGame start in de voorbereidingsfase met volle voorraad en een startbudget', () => {
  const game = bj.createGame(players());
  assert.equal(game.playerId, 'p1');
  assert.equal(game.day, 1);
  assert.equal(game.phase, 'prep');
  assert.equal(game.clockMin, bj.DAY_START);
  assert.equal(game.money, 150);
  assert.deepEqual(game.ovens, [null, null, null]);
  assert.ok(game.orders.length >= 1 && game.orders.length <= 2);
  assert.equal(game.gameOver, false);
});

test('bake start een oven en verbruikt ingrediënten tijdens de voorbereiding', () => {
  const game = bj.createGame(players());
  const before = { ...game.ingredients };
  bj.handleAction(game, 'p1', 'bake', { key: 'stokbrood' });
  assert.ok(game.ovens.some((o) => o && o.recipeKey === 'stokbrood'));
  const kost = bj.RECIPES.stokbrood.kost;
  Object.entries(kost).forEach(([ing, amt]) => {
    assert.equal(game.ingredients[ing], before[ing] - amt);
  });
});

test('bake weigert buiten de voorbereidingsfase', () => {
  const game = bj.createGame(players());
  game.phase = 'shop';
  assert.throws(() => bj.handleAction(game, 'p1', 'bake', { key: 'stokbrood' }), /voorbereiding/);
});

test('bake weigert zonder genoeg ingrediënten', () => {
  const game = bj.createGame(players());
  game.ingredients.bloem = 0;
  assert.throws(() => bj.handleAction(game, 'p1', 'bake', { key: 'stokbrood' }), /ingrediënten/);
});

test('bake weigert zonder vrije oven', () => {
  const game = bj.createGame(players());
  game.ovens = [{ recipeKey: 'stokbrood', startMin: 0, endMin: 18 }, { recipeKey: 'stokbrood', startMin: 0, endMin: 18 }, { recipeKey: 'stokbrood', startMin: 0, endMin: 18 }];
  assert.throws(() => bj.handleAction(game, 'p1', 'bake', { key: 'pistolet' }), /oven/);
});

test('bake weigert taart als de koeling stuk is', () => {
  const game = bj.createGame(players());
  game.koelingBroken = true;
  assert.throws(() => bj.handleAction(game, 'p1', 'bake', { key: 'taart' }), /[Kk]oeling/);
});

test('tick voltooit een oven na de baktijd en legt het resultaat op de plank', () => {
  const game = bj.createGame(players());
  game.ovens[0] = { recipeKey: 'stokbrood', startMin: game.clockMin, endMin: game.clockMin + 18 };
  const shelfBefore = game.shelf.stokbrood;
  // speed=2 => 125ms per speltijd-minuut; 18 minuten vergt >=2250ms.
  const changed = bj.tick(game, game.lastTickAt + 2300);
  assert.equal(changed, true);
  assert.equal(game.ovens[0], null);
  assert.equal(game.shelf.stokbrood, shelfBefore + bj.RECIPES.stokbrood.batch);
  assert.equal(game.clockMin, 18);
  assert.equal(game.phase, 'prep');
});

test('tick doet niets terwijl het spel gepauzeerd staat', () => {
  const game = bj.createGame(players());
  game.paused = true;
  const clockBefore = game.clockMin;
  const changed = bj.tick(game, game.lastTickAt + 5000);
  assert.equal(changed, false);
  assert.equal(game.clockMin, clockBefore);
});

test('de voorbereiding eindigt met een pop-up om de winkel te openen', () => {
  const game = bj.createGame(players());
  game.clockMin = bj.SHOP_START - 1;
  const changed = bj.tick(game, game.lastTickAt + 300);
  assert.equal(changed, true);
  assert.equal(game.clockMin, bj.SHOP_START);
  assert.equal(game.phase, 'shopPrompt');
  assert.equal(game.paused, true);
});

test('openShop opent de winkel en hervat de klok', () => {
  const game = bj.createGame(players());
  game.phase = 'shopPrompt';
  game.paused = true;
  bj.handleAction(game, 'p1', 'openShop');
  assert.equal(game.phase, 'shop');
  assert.equal(game.paused, false);
});

test('openShop weigert buiten de shopPrompt-fase', () => {
  const game = bj.createGame(players());
  assert.throws(() => bj.handleAction(game, 'p1', 'openShop'), /geopend/);
});

test('serveCustomer weigert buiten de winkelfase', () => {
  const game = bj.createGame(players());
  game.shelf.stokbrood = 2;
  game.customerQueue = [{ id: 'c1', wants: { key: 'stokbrood', qty: 2 }, bornAt: game.clockMin, patience: 15 }];
  assert.throws(() => bj.handleAction(game, 'p1', 'serveCustomer', { id: 'c1' }), /winkel/);
});

test('serveCustomer verkoopt van de plank en verhoogt geld en reputatie', () => {
  const game = bj.createGame(players());
  game.phase = 'shop';
  game.clockMin = bj.SHOP_START;
  game.shelf.stokbrood = 2;
  game.customerQueue = [{ id: 'c1', wants: { key: 'stokbrood', qty: 2 }, bornAt: game.clockMin, patience: 15 }];
  const moneyBefore = game.money;
  bj.handleAction(game, 'p1', 'serveCustomer', { id: 'c1' });
  assert.equal(game.shelf.stokbrood, 0);
  assert.equal(game.customerQueue.length, 0);
  assert.equal(game.money, moneyBefore + 2 * bj.RECIPES.stokbrood.prijs);
  assert.equal(game.stats.served, 1);
});

test('serveCustomer weigert met te weinig voorraad', () => {
  const game = bj.createGame(players());
  game.phase = 'shop';
  game.shelf.stokbrood = 0;
  game.customerQueue = [{ id: 'c1', wants: { key: 'stokbrood', qty: 1 }, bornAt: game.clockMin, patience: 15 }];
  assert.throws(() => bj.handleAction(game, 'p1', 'serveCustomer', { id: 'c1' }), /plank/);
});

test('deliverOrder levert een bestelling en betaalt de beloning', () => {
  const game = bj.createGame(players());
  game.phase = 'shop';
  game.shelf.taart = 1;
  game.orders = [{ id: 'o1', product: 'taart', qty: 1, due: 600, reward: 20, repBonus: 3, status: 'open' }];
  const moneyBefore = game.money;
  bj.handleAction(game, 'p1', 'deliverOrder', { id: 'o1' });
  assert.equal(game.orders[0].status, 'done');
  assert.equal(game.shelf.taart, 0);
  assert.equal(game.money, moneyBefore + 20);
});

test('de winkel sluit op tijd, resterende klanten gaan weg en de fase wordt closePrompt', () => {
  const game = bj.createGame(players());
  game.phase = 'shop';
  game.clockMin = bj.SHOP_END - 1;
  game.customerQueue = [{ id: 'c1', wants: { key: 'stokbrood', qty: 1 }, bornAt: game.clockMin, patience: 99 }];
  game.nextCustomerAt = bj.SHOP_END + 999; // geen extra klant in de laatste minuut
  const missedBefore = game.stats.missed;
  const changed = bj.tick(game, game.lastTickAt + 300);
  assert.equal(changed, true);
  assert.equal(game.clockMin, bj.SHOP_END);
  assert.equal(game.phase, 'closePrompt');
  assert.equal(game.paused, true);
  assert.equal(game.customerQueue.length, 0);
  assert.equal(game.stats.missed, missedBefore + 1);
});

test('goToSupermarket opent de inkoopfase en hervat de klok', () => {
  const game = bj.createGame(players());
  game.phase = 'closePrompt';
  game.paused = true;
  bj.handleAction(game, 'p1', 'goToSupermarket');
  assert.equal(game.phase, 'supermarket');
  assert.equal(game.paused, false);
});

test('goToSupermarket weigert buiten de closePrompt-fase', () => {
  const game = bj.createGame(players());
  assert.throws(() => bj.handleAction(game, 'p1', 'goToSupermarket'), /supermarkt/);
});

test('buyIngredient koopt een batch in en trekt het bedrag af', () => {
  const game = bj.createGame(players());
  game.phase = 'supermarket';
  const before = game.ingredients.bloem;
  const moneyBefore = game.money;
  bj.handleAction(game, 'p1', 'buyIngredient', { key: 'bloem' });
  assert.equal(game.ingredients.bloem, before + bj.BUY_BATCH);
  assert.equal(game.money, moneyBefore - bj.INGREDIENT_PRICES.bloem * bj.BUY_BATCH);
});

test('buyIngredient weigert buiten de supermarktfase', () => {
  const game = bj.createGame(players());
  assert.throws(() => bj.handleAction(game, 'p1', 'buyIngredient', { key: 'bloem' }), /inkopen/);
});

test('buyIngredient weigert met te weinig geld', () => {
  const game = bj.createGame(players());
  game.phase = 'supermarket';
  game.money = 0;
  assert.throws(() => bj.handleAction(game, 'p1', 'buyIngredient', { key: 'bloem' }), /geld/);
});

test('de supermarkt sluit op tijd, verrekent vaste kosten en toont het dagoverzicht', () => {
  const game = bj.createGame(players());
  game.phase = 'supermarket';
  game.clockMin = bj.SUPERMARKET_END - 1;
  const moneyBefore = game.money;
  const changed = bj.tick(game, game.lastTickAt + 300);
  assert.equal(changed, true);
  assert.equal(game.phase, 'dayEnd');
  assert.equal(game.paused, true);
  assert.equal(game.money, moneyBefore - bj.DAILY_COST);
  assert.equal(game.gameOver, false);
});

test('failliet gaan aan het einde van de dag beëindigt het spel', () => {
  const game = bj.createGame(players());
  game.phase = 'supermarket';
  game.clockMin = bj.SUPERMARKET_END - 1;
  game.money = 10;
  bj.tick(game, game.lastTickAt + 300);
  assert.equal(game.gameOver, true);
  assert.ok(game.resultText.includes('failliet'));
  const results = bj.results(game, 1000);
  assert.equal(results[0].placement, 1);
  assert.equal(results[0].won, false);
  assert.equal(results[0].score, Math.round(game.money));
});

test('nextDay reset de dagstaat, telt de dag op en behoudt overgebleven voorraad', () => {
  const game = bj.createGame(players());
  game.phase = 'dayEnd';
  game.shelf.stokbrood = 3;
  game.ingredients.bloem = 12;
  bj.handleAction(game, 'p1', 'nextDay');
  assert.equal(game.day, 2);
  assert.equal(game.clockMin, bj.DAY_START);
  assert.equal(game.phase, 'prep');
  assert.equal(game.shelf.stokbrood, 0);
  assert.equal(game.ingredients.bloem, 12);
  assert.equal(game.paused, false);
});

test('nextDay weigert zolang de dag niet voorbij is', () => {
  const game = bj.createGame(players());
  assert.throws(() => bj.handleAction(game, 'p1', 'nextDay'), /voorbij/);
});

test('togglePause weigert tijdens een pop-upfase', () => {
  const game = bj.createGame(players());
  game.phase = 'shopPrompt';
  assert.throws(() => bj.handleAction(game, 'p1', 'togglePause'), /even niet/);
});

test('repairKoeling weigert zonder geld en werkt met genoeg geld', () => {
  const game = bj.createGame(players());
  game.koelingBroken = true;
  game.money = 50;
  assert.throws(() => bj.handleAction(game, 'p1', 'repairKoeling'), /geld/);
  game.money = 200;
  bj.handleAction(game, 'p1', 'repairKoeling');
  assert.equal(game.koelingBroken, false);
  assert.equal(game.money, 120);
});

test('setSpeed staat alleen 1, 2 of 4 toe', () => {
  const game = bj.createGame(players());
  assert.throws(() => bj.handleAction(game, 'p1', 'setSpeed', { value: 3 }), /snelheid/);
  bj.handleAction(game, 'p1', 'setSpeed', { value: 4 });
  assert.equal(game.speed, 4);
});

test('handleAction weigert acties van een andere speler en na afloop', () => {
  const game = bj.createGame(players());
  assert.throws(() => bj.handleAction(game, 'iemand-anders', 'togglePause'), /Niet jouw spel/);
  game.gameOver = true;
  assert.throws(() => bj.handleAction(game, 'p1', 'togglePause'), /afgelopen/);
});

test('serialize geeft de fase en supermarktgegevens mee', () => {
  const game = bj.createGame(players());
  const view = bj.serialize(game);
  assert.equal(view.kind, 'bakkermansjones');
  assert.equal(view.phase, 'prep');
  assert.equal(view.day, 1);
  assert.ok(view.recipes.stokbrood);
  assert.ok(view.ingredientPrices.bloem > 0);
  assert.equal(view.buyBatch, bj.BUY_BATCH);
  assert.equal(view.shopEnd, bj.SHOP_END);
  assert.equal(view.supermarketEnd, bj.SUPERMARKET_END);
});
