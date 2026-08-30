const { makeDeck, shuffle, cardLabel } = require('../../src/cards');

const meta = {
  key: 'presidenten', name: 'Presidenten', description: 'Speel hogere combinaties en raak als eerste je kaarten kwijt.',
  minPlayers: 3, maxPlayers: 4, supportsNpc: true, realtime: false, solo: false
};

const NPC_DELAY = 820;

function presidentRank(card) {
  if (card.rank === '2') return 15;
  if (card.rank === 'A') return 14;
  return card.value;
}

function sortPresidentCards(cards) {
  const suitOrder = new Map([['♣',0],['♦',1],['♥',2],['♠',3]]);
  return cards.slice().sort((a,b) => {
    const rankDiff = presidentRank(a) - presidentRank(b);
    if (rankDiff !== 0) return rankDiff;
    return (suitOrder.get(a.suit) ?? 9) - (suitOrder.get(b.suit) ?? 9);
  });
}

function groupByRank(hand) {
  const map = new Map();
  for (const card of hand) {
    const key = presidentRank(card);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(card);
  }
  return map;
}

function createGame(roomPlayers) {
  const deck = shuffle(makeDeck());
  const players = roomPlayers.map((p) => ({ id: p.id, name: p.name, isNpc: p.isNpc, hand: [], place: null, passed: false }));
  let i = 0;
  while (deck.length) { players[i % players.length].hand.push(deck.pop()); i += 1; }
  players.forEach((p) => { p.hand = sortPresidentCards(p.hand); });
  const starter = players.findIndex((p) => p.hand.some((c) => c.id === '3♣'));
  const game = {
    gameKey: meta.key, players, turnIndex: starter >= 0 ? starter : 0, lead: null, lastPlay: null, previousPlay: null, lastPlayerId: null,
    finished: [], firstLead: true, gameOver: false, resultText: '', log: ['De speler met 3♣ begint.'],
    nextNpcAt: 0
  };
  scheduleNpc(game, 650);
  return game;
}

function activePlayers(game) { return game.players.filter((p) => p.place === null); }
function currentPlayer(game) { return game.players[game.turnIndex]; }

function nextActiveIndex(game, start) {
  for (let step = 1; step <= game.players.length; step += 1) {
    const idx = (start + step) % game.players.length;
    if (game.players[idx].place === null) return idx;
  }
  return start;
}

function isValidSelection(game, player, ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 4) return false;
  const selected = ids.map((id) => player.hand.find((c) => c.id === id));
  if (selected.some((c) => !c)) return false;
  const rank = presidentRank(selected[0]);
  if (!selected.every((c) => presidentRank(c) === rank)) return false;
  if (game.firstLead && !selected.some((c) => c.id === '3♣')) return false;
  if (!game.lead) return true;
  return selected.length === game.lead.count && rank > game.lead.rank;
}

function canPlayAnything(game, player) {
  const groups = groupByRank(player.hand);
  if (!game.lead) return player.hand.length > 0;
  for (const [rank, cards] of groups) {
    if (cards.length >= game.lead.count && rank > game.lead.rank) return true;
  }
  return false;
}

function playableCardIds(game, player) {
  if (!player || player.place !== null) return [];
  const groups = groupByRank(player.hand);
  if (game.firstLead) return (groups.get(3) || []).map((card) => card.id);
  if (!game.lead) return player.hand.map((card) => card.id);
  const ids = [];
  for (const [rank, cards] of groups) {
    if (rank > game.lead.rank && cards.length >= game.lead.count) ids.push(...cards.map((card) => card.id));
  }
  return ids;
}

function finishPlayerIfNeeded(game, player) {
  if (player.hand.length || player.place !== null) return;
  player.place = game.finished.length + 1;
  game.finished.push(player.id);
  game.log.unshift(`${player.name} is ${player.place === 1 ? 'President' : `#${player.place}`}.`);
}

function resetTrick(game, leaderId) {
  game.lead = null;
  game.players.forEach((p) => { p.passed = false; });
  let idx = game.players.findIndex((p) => p.id === leaderId && p.place === null);
  if (idx < 0) {
    const old = game.players.findIndex((p) => p.id === leaderId);
    idx = nextActiveIndex(game, old < 0 ? 0 : old);
  }
  game.turnIndex = idx;
  game.lastPlayerId = null;
  game.log.unshift(`${game.players[idx].name} mag uitkomen.`);
}

function afterTurn(game) {
  const alive = activePlayers(game);
  if (alive.length <= 1) {
    if (alive.length === 1) {
      alive[0].place = game.finished.length + 1;
      game.finished.push(alive[0].id);
    }
    game.gameOver = true;
    game.nextNpcAt = 0;
    const ordered = game.finished.map((id) => game.players.find((p) => p.id === id)?.name).filter(Boolean);
    game.resultText = `${ordered[0]} is President. ${ordered[ordered.length - 1]} is Klootzak.`;
    return;
  }

  if (game.lead && game.lastPlayerId) {
    const eligible = activePlayers(game).filter((p) => p.id !== game.lastPlayerId);
    if (eligible.every((p) => p.passed)) {
      resetTrick(game, game.lastPlayerId);
      return;
    }
  }

  game.turnIndex = nextActiveIndex(game, game.turnIndex);
  const p = currentPlayer(game);
  if (p.passed && game.lead) afterTurn(game);
}

function playCards(game, player, ids) {
  if (!isValidSelection(game, player, ids)) throw new Error('Die combinatie mag je niet spelen.');
  const cards = ids.map((id) => player.hand.find((c) => c.id === id));
  const rank = presidentRank(cards[0]);
  player.hand = player.hand.filter((c) => !ids.includes(c.id));
  player.passed = false;
  game.previousPlay = game.lastPlay;
  game.lastPlay = { count: cards.length, rank, cards, playerId: player.id, playerName: player.name };
  game.lead = game.lastPlay;
  game.lastPlayerId = player.id;
  game.firstLead = false;
  game.log.unshift(`${player.name}: ${cards.map(cardLabel).join(' ')}.`);
  finishPlayerIfNeeded(game, player);
  afterTurn(game);
}

function npcTurn(game, player) {
  const groups = [...groupByRank(player.hand).entries()].sort((a, b) => a[0] - b[0]);
  let choice = null;

  if (!game.lead) {
    if (game.firstLead) {
      const threes = groups.find(([rank]) => rank === 3)?.[1] || [];
      choice = [threes.find((c) => c.id === '3♣') || threes[0]];
    } else {
      const cards = groups[0]?.[1] || [];
      const count = Math.min(cards.length, Math.random() < .25 ? 2 : 1);
      choice = cards.slice(0, count);
    }
  } else {
    for (const [rank, cards] of groups) {
      if (rank > game.lead.rank && cards.length >= game.lead.count) {
        choice = cards.slice(0, game.lead.count);
        break;
      }
    }
  }

  if (!choice?.length) {
    player.passed = true;
    game.log.unshift(`${player.name} past.`);
    afterTurn(game);
    return;
  }

  playCards(game, player, choice.map((c) => c.id));
}

function scheduleNpc(game, delay = NPC_DELAY) {
  const player = currentPlayer(game);
  game.nextNpcAt = !game.gameOver && player?.isNpc ? Date.now() + delay : 0;
}

function tick(game, now = Date.now()) {
  if (game.gameOver) return false;
  const player = currentPlayer(game);
  if (!player?.isNpc) { game.nextNpcAt = 0; return false; }
  if (!game.nextNpcAt) game.nextNpcAt = now + NPC_DELAY;
  if (now < game.nextNpcAt) return false;

  npcTurn(game, player);
  scheduleNpc(game);
  return true;
}

function handleAction(game, playerId, action, payload = {}) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  const player = currentPlayer(game);
  if (!player || player.id !== playerId || player.isNpc) throw new Error('Je bent niet aan de beurt.');

  if (action === 'play') playCards(game, player, payload.ids || []);
  else if (action === 'pass') {
    if (!game.lead) throw new Error('Je mag niet passen wanneer je uitkomt.');
    player.passed = true;
    game.log.unshift(`${player.name} past.`);
    afterTurn(game);
  } else throw new Error('Onbekende actie.');

  scheduleNpc(game);
}

function serialize(game, requesterId, connected) {
  const me = game.players.find((p) => p.id === requesterId);
  return {
    kind: meta.key, gameOver: game.gameOver, resultText: game.resultText,
    turnPlayerId: game.gameOver ? null : currentPlayer(game)?.id,
    lead: game.lead, previousPlay: game.previousPlay, firstLead: game.firstLead, log: game.log,
    players: game.players.map((p) => ({
      id: p.id, name: p.name, isNpc: p.isNpc, connected: p.isNpc || connected.get(p.id),
      hand: p.id === requesterId ? p.hand : undefined, handCount: p.hand.length,
      place: p.place, passed: p.passed
    })),
    playableIds: currentPlayer(game)?.id === requesterId ? playableCardIds(game, me) : [],
    canPass: Boolean(me && currentPlayer(game)?.id === requesterId && game.lead),
    mustInclude3Clubs: Boolean(game.firstLead && currentPlayer(game)?.id === requesterId)
  };
}

module.exports = {
  meta, createGame, handleAction, serialize, tick, presidentRank, sortPresidentCards, isValidSelection, canPlayAnything, playableCardIds,
  results:(game)=>game.players.map(p=>({playerId:p.id,placement:p.place,score:p.place,won:p.place===1,outcome:p.place===1?'President':p.place===game.players.length?'Klootzak':`#${p.place}`}))
};
