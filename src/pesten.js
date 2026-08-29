const { makeDeck, shuffle, sortCards, cardLabel, SUITS } = require('./cards');

const meta = {
  key: 'pesten', name: 'Pesten', description: 'Leg dezelfde kleur of waarde. Pestkaarten veranderen het spel.',
  minPlayers: 2, maxPlayers: 4, supportsNpc: true, realtime: false, solo: false
};

const specialRanks = new Set(['2', '7', '8', 'J', 'A']);

function createGame(roomPlayers) {
  const deck = shuffle(makeDeck());
  const players = roomPlayers.map((p) => ({ id: p.id, name: p.name, isNpc: p.isNpc, hand: [] }));
  for (let r = 0; r < 7; r += 1) for (const p of players) p.hand.push(deck.pop());
  players.forEach((p) => { p.hand = sortCards(p.hand); });
  let starterIndex = deck.findIndex((c) => !specialRanks.has(c.rank));
  if (starterIndex < 0) starterIndex = deck.length - 1;
  const [starter] = deck.splice(starterIndex, 1);
  const game = {
    gameKey: meta.key, players, drawPile: deck, discard: [starter], currentSuit: starter.suit,
    turnIndex: 0, direction: 1, drawPenalty: 0, gameOver: false, resultText: '', log: [`Startkaart: ${cardLabel(starter)}.`],
    nextNpcAt: 0
  };
  scheduleNpc(game, 650);
  return game;
}

function nextIndex(game, index = game.turnIndex, steps = 1) {
  let current = index;
  for (let i = 0; i < steps; i += 1) current = (current + game.direction + game.players.length) % game.players.length;
  return current;
}

function refill(game) {
  if (game.drawPile.length) return;
  if (game.discard.length <= 1) return;
  const top = game.discard.pop();
  game.drawPile = shuffle(game.discard);
  game.discard = [top];
}

function drawCards(game, player, count) {
  for (let i = 0; i < count; i += 1) {
    refill(game);
    if (!game.drawPile.length) break;
    player.hand.push(game.drawPile.pop());
  }
  player.hand = sortCards(player.hand);
}

function canPlay(game, card) {
  const top = game.discard[game.discard.length - 1];
  if (game.drawPenalty > 0) return card.rank === '2';
  if (card.rank === 'J') return true;
  return card.suit === game.currentSuit || card.rank === top.rank;
}

function chooseSuit(player) {
  const counts = new Map(SUITS.map((s) => [s.symbol, 0]));
  for (const card of player.hand) counts.set(card.suit, (counts.get(card.suit) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function advanceTurn(game, steps = 1) {
  game.turnIndex = nextIndex(game, game.turnIndex, steps);
}

function playCard(game, player, cardId, chosenSuit) {
  const index = player.hand.findIndex((c) => c.id === cardId);
  const card = player.hand[index];
  if (!card || !canPlay(game, card)) throw new Error('Die kaart mag je niet spelen.');
  player.hand.splice(index, 1);
  game.discard.push(card);
  game.currentSuit = card.suit;
  game.log.unshift(`${player.name} speelt ${cardLabel(card)}.`);

  if (card.rank === '2') {
    game.drawPenalty += 2;
    advanceTurn(game, 1);
  } else if (card.rank === '7') {
    game.log.unshift(`${player.name} mag nog eens.`);
  } else if (card.rank === '8') {
    const skipped = game.players[nextIndex(game)].name;
    game.log.unshift(`${skipped} slaat een beurt over.`);
    advanceTurn(game, 2);
  } else if (card.rank === 'J') {
    const suit = SUITS.some((s) => s.symbol === chosenSuit) ? chosenSuit : chooseSuit(player);
    game.currentSuit = suit;
    game.log.unshift(`${player.name} kiest ${suit}.`);
    advanceTurn(game, 1);
  } else if (card.rank === 'A') {
    if (game.players.length > 2) game.direction *= -1;
    game.log.unshift('Speelrichting draait om.');
    advanceTurn(game, 1);
  } else advanceTurn(game, 1);

  if (player.hand.length === 0) {
    game.gameOver = true;
    game.resultText = `${player.name} heeft geen kaarten meer en wint.`;
  }
}

function npcTurn(game, player) {
  const playable = player.hand.filter((c) => canPlay(game, c));
  if (!playable.length) {
    if (game.drawPenalty > 0) {
      const count = game.drawPenalty; drawCards(game, player, count); game.drawPenalty = 0;
      game.log.unshift(`${player.name} trekt ${count} kaarten.`);
    } else {
      drawCards(game, player, 1); game.log.unshift(`${player.name} trekt een kaart.`);
    }
    advanceTurn(game, 1);
    return;
  }
  const card = playable.sort((a, b) => (specialRanks.has(a.rank) ? 1 : 0) - (specialRanks.has(b.rank) ? 1 : 0) || a.value - b.value)[0];
  playCard(game, player, card.id, card.rank === 'J' ? chooseSuit(player) : null);
}

function scheduleNpc(game, delay = 820) {
  const player = game.players[game.turnIndex];
  game.nextNpcAt = !game.gameOver && player?.isNpc ? Date.now() + delay : 0;
}

function tick(game, now = Date.now()) {
  if (game.gameOver) return false;
  const player = game.players[game.turnIndex];
  if (!player?.isNpc) { game.nextNpcAt = 0; return false; }
  if (!game.nextNpcAt) game.nextNpcAt = now + 820;
  if (now < game.nextNpcAt) return false;
  npcTurn(game, player);
  scheduleNpc(game);
  return true;
}

function handleAction(game, playerId, action, payload = {}) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  const player = game.players[game.turnIndex];
  if (!player || player.id !== playerId || player.isNpc) throw new Error('Je bent niet aan de beurt.');
  if (action === 'play') playCard(game, player, String(payload.cardId || ''), payload.suit);
  else if (action === 'draw') {
    if (game.drawPenalty > 0) {
      const count = game.drawPenalty; drawCards(game, player, count); game.drawPenalty = 0;
      game.log.unshift(`${player.name} trekt ${count} kaarten.`);
    } else {
      drawCards(game, player, 1); game.log.unshift(`${player.name} trekt een kaart.`);
    }
    advanceTurn(game, 1);
  } else throw new Error('Onbekende actie.');
  scheduleNpc(game);
}

function serialize(game, requesterId, connected) {
  return {
    kind: meta.key, gameOver: game.gameOver, resultText: game.resultText,
    topCard: game.discard[game.discard.length - 1], currentSuit: game.currentSuit,
    drawPileCount: game.drawPile.length, drawPenalty: game.drawPenalty, direction: game.direction,
    turnPlayerId: game.gameOver ? null : game.players[game.turnIndex]?.id, log: game.log,
    rulesNote: '2 = +2 (alleen stapelen met 2), 7 = nog eens, 8 = beurt overslaan, Boer = kleur kiezen, Aas = richting om.',
    players: game.players.map((p) => ({ id: p.id, name: p.name, isNpc: p.isNpc, connected: p.isNpc || connected.get(p.id), hand: p.id === requesterId ? p.hand : undefined, handCount: p.hand.length })),
    playableIds: game.players[game.turnIndex]?.id === requesterId ? game.players[game.turnIndex].hand.filter((c) => canPlay(game, c)).map((c) => c.id) : []
  };
}

module.exports = { meta, createGame, handleAction, serialize, tick, canPlay };
