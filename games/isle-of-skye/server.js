'use strict';
const engine = require('./engine');

const STARTING_GOLD = 10;
const TOTAL_ROUNDS = 6;
const SCORING_ROUNDS = [2, 4, 6];
const SCORING_CATEGORIES = ['SCORING_WHISKY', 'SCORING_SHEEP', 'SCORING_CATTLE', 'SCORING_SHIPS'];
const CATEGORY_LABELS = { SCORING_WHISKY: 'Whisky', SCORING_SHEEP: 'Schapen', SCORING_CATTLE: 'Vee', SCORING_SHIPS: 'Schepen' };

function shuffled(items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function randomEdge() {
  const r = Math.random();
  if (r < 0.5) return 'pasture';
  if (r < 0.78) return 'mountain';
  return 'water';
}
function buildTile(id) {
  const edges = { top: randomEdge(), right: randomEdge(), bottom: randomEdge(), left: randomEdge() };
  const hasRoad = Math.random() < 0.45;
  const pastureEdges = Object.values(edges).filter((e) => e === 'pasture').length;
  const waterEdges = Object.values(edges).filter((e) => e === 'water').length;
  const features = [];
  const roll = Math.random();
  if (waterEdges > 0 && roll < 0.22) features.push({ type: 'ship', count: 1 });
  else if (pastureEdges > 0 && roll < 0.45) features.push({ type: 'sheep', count: 1 + Math.floor(Math.random() * 2) });
  else if (pastureEdges > 0 && roll < 0.62) features.push({ type: 'cattle', count: 1 });
  else if (roll < 0.74) features.push({ type: 'whisky', count: 1 + Math.floor(Math.random() * 2) });
  return { id, edges, features, hasRoad, rotation: 0 };
}
function castleTile() {
  return { id: 'castle', edges: { top: 'pasture', right: 'pasture', bottom: 'pasture', left: 'pasture' }, features: [], hasRoad: true, rotation: 0 };
}
function playerById(game, id) { return game.players.find((p) => p.id === id); }
function addLog(game, text) { game.log.unshift(text); game.log = game.log.slice(0, 30); }
function tileValue(tile) {
  return tile.features.reduce((sum, f) => sum + f.count * (f.type === 'whisky' ? 2 : f.type === 'ship' ? 4 : 1), 0);
}

function createGame(roomPlayers) {
  if (roomPlayers.length < 2 || roomPlayers.length > 4) throw new Error('Isle of Skye is voor 2 tot 4 spelers.');
  const players = roomPlayers.map((player, index) => ({
    id: player.id, name: player.name, isNpc: Boolean(player.isNpc), index,
    gold: STARTING_GOLD, score: 0,
    board: new Map([[engine.getCoordKey(0, 0), { tile: castleTile(), x: 0, y: 0 }]])
  }));
  const marketSize = players.length + 1;
  const bagSize = TOTAL_ROUNDS * players.length * marketSize;
  const bag = shuffled(Array.from({ length: bagSize }, (_, i) => buildTile(`t${i + 1}`)));
  const categories = shuffled(SCORING_CATEGORIES).slice(0, 3);
  const game = {
    gameKey: 'isle-of-skye', players, bag, marketSize,
    round: 1, totalRounds: TOTAL_ROUNDS, scoringCategories: categories,
    sellerOrderStart: 0, sellerOrder: [], sellerCursor: 0, sellerId: null,
    phase: 'price', market: [], prices: [], takenBy: [],
    buyerOrder: [], buyerCursor: 0,
    gameOver: false, winnerIds: [], resultText: '', nextNpcAt: 0,
    log: [`Actieve scoretegels dit spel: ${categories.map((c) => CATEGORY_LABELS[c]).join(', ')}.`]
  };
  startRound(game);
  return game;
}

function startRound(game) {
  game.sellerOrder = Array.from({ length: game.players.length }, (_, i) => (game.sellerOrderStart + i) % game.players.length);
  game.sellerCursor = 0;
  startSellerTurn(game);
}
function startSellerTurn(game) {
  const seller = game.players[game.sellerOrder[game.sellerCursor]];
  const draw = game.bag.splice(0, Math.min(game.marketSize, game.bag.length));
  game.market = draw;
  game.prices = new Array(draw.length).fill(null);
  game.takenBy = new Array(draw.length).fill(null);
  game.sellerId = seller.id;
  game.buyerOrder = [];
  game.buyerCursor = 0;
  if (!draw.length) { finishSellerTurn(game); return; }
  game.phase = 'price';
  addLog(game, `${seller.name} legt de markt open.`);
  scheduleNpc(game);
}
function finishSellerTurn(game) {
  game.market = []; game.prices = []; game.takenBy = [];
  game.sellerCursor++;
  if (game.sellerCursor < game.sellerOrder.length) { startSellerTurn(game); return; }
  if (SCORING_ROUNDS.includes(game.round)) runScoring(game);
  if (game.round >= game.totalRounds) { finishGame(game); return; }
  game.round++;
  game.sellerOrderStart = (game.sellerOrderStart + 1) % game.players.length;
  startRound(game);
}
function runScoring(game) {
  const isFinal = game.round === game.totalRounds;
  for (const player of game.players) {
    let gained = 0;
    for (const category of game.scoringCategories) gained += engine.calculateRoundScore(player.board, category);
    if (isFinal) gained += Math.floor(player.gold / 4);
    player.score += gained;
  }
  addLog(game, `Score-checkpoint na ronde ${game.round}${isFinal ? ' (incl. goudbonus)' : ''}.`);
}
function finishGame(game) {
  const high = Math.max(...game.players.map((p) => p.score));
  const winners = game.players.filter((p) => p.score === high);
  game.gameOver = true; game.phase = 'over'; game.nextNpcAt = 0;
  game.winnerIds = winners.map((p) => p.id);
  game.resultText = winners.length > 1 ? `Gelijkspel op ${high} punten.` : `${winners[0].name} wint met ${high} punten.`;
  addLog(game, game.resultText);
}

function currentBuyer(game) {
  if (game.phase !== 'buy') return null;
  const idx = game.buyerOrder[game.buyerCursor];
  return idx === undefined ? null : game.players[idx];
}
function activeActor(game) {
  if (game.gameOver) return null;
  if (game.phase === 'price' || game.phase === 'sellerPlace') return playerById(game, game.sellerId);
  if (game.phase === 'buy') return currentBuyer(game);
  return null;
}
function advanceBuyerOrSeller(game) {
  if (game.buyerCursor < game.buyerOrder.length) { scheduleNpc(game); return; }
  game.phase = 'sellerPlace';
  scheduleNpc(game);
}

function setPrices(game, playerId, prices) {
  if (game.phase !== 'price') throw new Error('Nu geen prijzen instellen.');
  if (game.sellerId !== playerId) throw new Error('Je bent niet de verkoper.');
  if (!Array.isArray(prices) || prices.length !== game.market.length) throw new Error('Ongeldige prijzen.');
  for (const price of prices) if (!Number.isInteger(price) || price < 0 || price > 3) throw new Error('Prijzen moeten 0-3 goud zijn.');
  game.prices = prices.slice();
  const sellerIdx = game.players.findIndex((p) => p.id === playerId);
  game.buyerOrder = Array.from({ length: game.players.length - 1 }, (_, i) => (sellerIdx + 1 + i) % game.players.length);
  game.buyerCursor = 0;
  game.phase = 'buy';
  addLog(game, `${playerById(game, playerId).name} bepaalt de prijzen.`);
  advanceBuyerOrSeller(game);
}
function validatePlacementPayload(payload) {
  const x = Number(payload.x), y = Number(payload.y), rotation = Number(payload.rotation);
  if (!engine.ROTATIONS.includes(rotation)) throw new Error('Ongeldige rotatie.');
  return { x, y, rotation };
}
function buyTile(game, playerId, payload = {}) {
  const buyer = currentBuyer(game);
  if (!buyer || buyer.id !== playerId) throw new Error('Je bent nu niet aan de beurt om te kopen.');
  const idx = Number(payload.tileIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= game.market.length) throw new Error('Ongeldige tegel.');
  if (game.takenBy[idx]) throw new Error('Die tegel is al verkocht.');
  const price = game.prices[idx];
  if (buyer.gold < price) throw new Error('Niet genoeg goud.');
  const tile = game.market[idx];
  const { x, y, rotation } = validatePlacementPayload(payload);
  if (!engine.isValidPlacement(buyer.board, tile, x, y, rotation)) throw new Error('Die tegel past daar niet.');
  buyer.gold -= price;
  playerById(game, game.sellerId).gold += price;
  buyer.board.set(engine.getCoordKey(x, y), { tile: { ...tile, rotation }, x, y });
  game.takenBy[idx] = buyer.id;
  addLog(game, `${buyer.name} koopt een tegel voor ${price} goud.`);
  game.buyerCursor++;
  advanceBuyerOrSeller(game);
}
function passBuy(game, playerId) {
  const buyer = currentBuyer(game);
  if (!buyer || buyer.id !== playerId) throw new Error('Je bent nu niet aan de beurt.');
  addLog(game, `${buyer.name} koopt niets.`);
  game.buyerCursor++;
  advanceBuyerOrSeller(game);
}
function sellerPlaceTile(game, playerId, payload = {}) {
  if (game.phase !== 'sellerPlace') throw new Error('Nu niet plaatsen.');
  if (game.sellerId !== playerId) throw new Error('Je bent niet de verkoper.');
  const idx = Number(payload.tileIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= game.market.length) throw new Error('Ongeldige tegel.');
  if (game.takenBy[idx]) throw new Error('Die tegel is al verkocht.');
  const seller = playerById(game, playerId);
  const tile = game.market[idx];
  const { x, y, rotation } = validatePlacementPayload(payload);
  if (!engine.isValidPlacement(seller.board, tile, x, y, rotation)) throw new Error('Die tegel past daar niet.');
  seller.board.set(engine.getCoordKey(x, y), { tile: { ...tile, rotation }, x, y });
  game.takenBy[idx] = seller.id;
  addLog(game, `${seller.name} plaatst gratis een tegel.`);
  finishSellerTurn(game);
}
function sellerSkip(game, playerId) {
  if (game.phase !== 'sellerPlace') throw new Error('Nu niet overslaan.');
  if (game.sellerId !== playerId) throw new Error('Je bent niet de verkoper.');
  addLog(game, `${playerById(game, playerId).name} slaat de gratis tegel over.`);
  finishSellerTurn(game);
}

function bestPlacement(board, tile) {
  const options = engine.legalPlacements(board, tile);
  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)];
}
function npcAct(game, actor) {
  if (game.phase === 'price') {
    const prices = game.market.map((tile) => Math.max(0, Math.min(3, Math.round(tileValue(tile) / 2))));
    setPrices(game, actor.id, prices);
    return;
  }
  if (game.phase === 'buy') {
    let bestIdx = -1, bestScore = 0.3, bestSpot = null;
    game.market.forEach((tile, idx) => {
      if (game.takenBy[idx]) return;
      const price = game.prices[idx];
      if (price > actor.gold) return;
      const spot = bestPlacement(actor.board, tile);
      if (!spot) return;
      const value = tileValue(tile) - price * 0.5 + Math.random() * 0.3;
      if (value > bestScore) { bestScore = value; bestIdx = idx; bestSpot = spot; }
    });
    if (bestIdx >= 0) buyTile(game, actor.id, { tileIndex: bestIdx, ...bestSpot });
    else passBuy(game, actor.id);
    return;
  }
  if (game.phase === 'sellerPlace') {
    let bestIdx = -1, bestScore = -Infinity, bestSpot = null;
    game.market.forEach((tile, idx) => {
      if (game.takenBy[idx]) return;
      const spot = bestPlacement(actor.board, tile);
      if (!spot) return;
      const value = tileValue(tile) + Math.random() * 0.3;
      if (value > bestScore) { bestScore = value; bestIdx = idx; bestSpot = spot; }
    });
    if (bestIdx >= 0) sellerPlaceTile(game, actor.id, { tileIndex: bestIdx, ...bestSpot });
    else sellerSkip(game, actor.id);
    return;
  }
}
function scheduleNpc(game, delay = 700) {
  const actor = activeActor(game);
  game.nextNpcAt = actor && actor.isNpc ? Date.now() + delay : 0;
}
function tick(game, now = Date.now()) {
  if (game.gameOver) return false;
  const actor = activeActor(game);
  if (!actor || !actor.isNpc) { game.nextNpcAt = 0; return false; }
  if (!game.nextNpcAt) game.nextNpcAt = now + 700;
  if (now < game.nextNpcAt) return false;
  npcAct(game, actor);
  scheduleNpc(game);
  return true;
}

function handleAction(game, playerId, action, payload = {}) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  if (action === 'setPrices') return setPrices(game, playerId, payload.prices);
  if (action === 'buy') return buyTile(game, playerId, payload);
  if (action === 'pass') return passBuy(game, playerId);
  if (action === 'sellerPlace') return sellerPlaceTile(game, playerId, payload);
  if (action === 'sellerSkip') return sellerSkip(game, playerId);
  throw new Error('Onbekende actie.');
}

function boardArray(board) { return Array.from(board.values()).map((pt) => ({ x: pt.x, y: pt.y, tile: pt.tile })); }
function connectedValue(connected, id) { return connected?.get ? Boolean(connected.get(id)) : true; }
function serialize(game, requesterId, connected) {
  const seller = playerById(game, game.sellerId);
  const buyer = currentBuyer(game);
  const me = playerById(game, requesterId);
  const myTurnBuy = game.phase === 'buy' && buyer?.id === requesterId && !buyer.isNpc;
  const myTurnPrice = game.phase === 'price' && seller?.id === requesterId && !seller.isNpc;
  const myTurnSellerPlace = game.phase === 'sellerPlace' && seller?.id === requesterId && !seller.isNpc;
  const legal = {};
  if ((myTurnBuy || myTurnSellerPlace) && me) {
    game.market.forEach((tile, idx) => {
      if (game.takenBy[idx]) return;
      if (myTurnBuy && game.prices[idx] > me.gold) return;
      legal[idx] = engine.legalPlacements(me.board, tile);
    });
  }
  return {
    kind: game.gameKey, phase: game.gameOver ? 'over' : game.phase,
    round: Math.min(game.round, game.totalRounds), totalRounds: game.totalRounds,
    scoringCategories: game.scoringCategories, scoringRounds: SCORING_ROUNDS,
    gameOver: game.gameOver, resultText: game.resultText, winnerIds: game.winnerIds.slice(),
    sellerId: game.sellerId,
    turnPlayerId: game.gameOver ? null : (game.phase === 'buy' ? buyer?.id || null : seller?.id || null),
    market: game.market.map((tile, idx) => ({ ...tile, price: game.prices[idx], takenBy: game.takenBy[idx] || null })),
    players: game.players.map((player) => ({
      id: player.id, name: player.name, isNpc: player.isNpc, index: player.index,
      gold: player.gold, score: player.score, board: boardArray(player.board),
      connected: player.isNpc || connectedValue(connected, player.id)
    })),
    canSetPrices: myTurnPrice,
    canBuy: myTurnBuy,
    canSellerPlace: myTurnSellerPlace,
    legalPlacements: legal,
    log: game.log.slice(0, 24)
  };
}
function results(game) {
  const high = Math.max(...game.players.map((p) => p.score));
  const winners = game.players.filter((p) => p.score === high);
  return game.players.map((player) => ({
    playerId: player.id,
    placement: game.players.filter((other) => other.score > player.score).length + 1,
    score: player.score,
    won: winners.length === 1 && winners[0].id === player.id,
    outcome: player.score === high ? (winners.length === 1 ? 'Wint' : 'Gelijkspel') : 'Verliest'
  }));
}

module.exports = { createGame, handleAction, serialize, tick, results, engine, CATEGORY_LABELS, TOTAL_ROUNDS, SCORING_ROUNDS };
