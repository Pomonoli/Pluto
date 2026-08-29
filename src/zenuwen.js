const { makeDeck, shuffle, sortCards, cardLabel } = require('./cards');

const meta = {
  key: 'zenuwen', name: 'Zenuwen', description: 'Realtime: speel één hoger of lager op de centrale stapels.',
  minPlayers: 2, maxPlayers: 2, supportsNpc: true, realtime: true, solo: false
};

function adjacent(a, b) {
  return Math.abs(a.value - b.value) === 1;
}

function createGame(roomPlayers) {
  const deck = shuffle(makeDeck());
  const players = roomPlayers.map((p) => ({
    id: p.id, name: p.name, isNpc: p.isNpc,
    stock: [], hand: []
  }));

  for (const p of players) {
    for (let i = 0; i < 20; i += 1) p.stock.push(deck.pop());
    for (let i = 0; i < 5; i += 1) p.hand.push(p.stock.pop());
    p.hand = sortCards(p.hand);
  }

  const leftReserve = deck.splice(0, 5);
  const leftCenter = [deck.pop()];
  const rightCenter = [deck.pop()];
  const rightReserve = deck.splice(0, 5);

  return {
    gameKey: meta.key,
    players,
    leftReserve,
    rightReserve,
    centers: [leftCenter, rightCenter],
    gameOver: false,
    resultText: '',
    log: ['Speel zo snel mogelijk een kaart die exact 1 hoger of lager is.'],
    lastNpcAt: 0
  };
}

function refillHand(player) {
  while (player.hand.length < 5 && player.stock.length) player.hand.push(player.stock.pop());
  player.hand = sortCards(player.hand);
}

function legalPiles(game, card) {
  const result = [];
  for (let i = 0; i < 2; i += 1) {
    const top = game.centers[i][game.centers[i].length - 1];
    if (top && adjacent(card, top)) result.push(i);
  }
  return result;
}

function hasAnyMove(game, player) {
  return player.hand.some((card) => legalPiles(game, card).length > 0);
}

function rebuildReserves(game) {
  const pool = [];
  for (let i = 0; i < 2; i += 1) {
    const pile = game.centers[i];
    const top = pile.pop();
    pool.push(...pile);
    game.centers[i] = [top];
  }
  if (!pool.length) return false;
  const shuffled = shuffle(pool);
  const half = Math.floor(shuffled.length / 2);
  game.leftReserve = shuffled.slice(0, half);
  game.rightReserve = shuffled.slice(half);
  return true;
}

function refreshCentersIfStuck(game) {
  if (game.players.some((p) => hasAnyMove(game, p))) return false;

  if (!game.leftReserve.length && !game.rightReserve.length) rebuildReserves(game);
  let changed = false;
  if (game.leftReserve.length) { game.centers[0].push(game.leftReserve.pop()); changed = true; }
  if (game.rightReserve.length) { game.centers[1].push(game.rightReserve.pop()); changed = true; }

  if (changed) game.log.unshift('Geen zetten: twee nieuwe middenkaarten.');
  return changed;
}

function checkWin(game, player) {
  if (player.stock.length === 0 && player.hand.length === 0) {
    game.gameOver = true;
    game.resultText = `${player.name} heeft alle kaarten weggespeeld en wint.`;
    game.log.unshift(game.resultText);
    return true;
  }
  return false;
}

function play(game, player, cardId, pileIndex) {
  const handIndex = player.hand.findIndex((c) => c.id === cardId);
  const card = player.hand[handIndex];
  const target = Number(pileIndex);
  if (!card || ![0, 1].includes(target) || !legalPiles(game, card).includes(target)) throw new Error('Die kaart kan daar niet op.');
  player.hand.splice(handIndex, 1);
  game.centers[target].push(card);
  game.log.unshift(`${player.name}: ${cardLabel(card)}.`);
  refillHand(player);
  if (!checkWin(game, player)) refreshCentersIfStuck(game);
}

function npcMove(game, player) {
  const options = [];
  for (const card of player.hand) for (const pile of legalPiles(game, card)) options.push({ card, pile });
  if (!options.length) return false;
  const choice = options[Math.floor(Math.random() * options.length)];
  play(game, player, choice.card.id, choice.pile);
  return true;
}

function tick(game, now = Date.now()) {
  if (game.gameOver) return false;
  refreshCentersIfStuck(game);
  if (now - game.lastNpcAt < 420) return false;
  const npc = game.players.find((p) => p.isNpc && hasAnyMove(game, p));
  if (!npc) return false;
  game.lastNpcAt = now;
  return npcMove(game, npc);
}

function handleAction(game, playerId, action, payload = {}) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  const player = game.players.find((p) => p.id === playerId);
  if (!player || player.isNpc) throw new Error('Speler niet gevonden.');
  if (action !== 'play') throw new Error('Onbekende actie.');
  play(game, player, String(payload.cardId || ''), Number(payload.pile));
}

function serialize(game, requesterId, connected) {
  return {
    kind: meta.key,
    gameOver: game.gameOver,
    resultText: game.resultText,
    centers: game.centers.map((pile) => pile[pile.length - 1]),
    reserveCounts: [game.leftReserve.length, game.rightReserve.length],
    log: game.log,
    players: game.players.map((p) => ({
      id: p.id, name: p.name, isNpc: p.isNpc, connected: p.isNpc || connected.get(p.id),
      hand: p.id === requesterId ? p.hand : undefined,
      handCount: p.hand.length,
      stockCount: p.stock.length
    })),
    legal: (() => {
      const p = game.players.find((x) => x.id === requesterId);
      if (!p) return {};
      const out = {};
      for (const card of p.hand) out[card.id] = legalPiles(game, card);
      return out;
    })()
  };
}

module.exports = { meta, createGame, handleAction, serialize, tick, adjacent, legalPiles, refreshCentersIfStuck };
