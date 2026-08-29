const { makeDeck, shuffle, sortCards, rankValueAceHigh, cardLabel } = require('./cards');

const meta = {
  key: 'hartenjagen', name: 'Hartenjagen', description: 'Vermijd harten en vooral de Schoppenvrouw.',
  minPlayers: 4, maxPlayers: 4, supportsNpc: true, realtime: false, solo: false
};

const NPC_DELAY = 720;
const TRICK_HOLD = 1050;

function cardPoints(card) {
  if (card.suit === '♥') return 1;
  if (card.id === 'Q♠') return 13;
  return 0;
}

function createGame(roomPlayers) {
  const players = roomPlayers.map((p) => ({
    id: p.id, name: p.name, isNpc: p.isNpc,
    hand: [], totalScore: 0, roundCards: []
  }));

  const game = {
    gameKey: meta.key, players, roundNumber: 0, passDirection: 'left',
    phase: 'passing', pendingPasses: new Map(), trick: [], heartsBroken: false,
    leaderIndex: 0, turnIndex: 0, trickNumber: 0,
    trickResolveAt: 0, nextNpcAt: 0,
    gameOver: false, resultText: '', lastRoundSummary: null, log: []
  };

  startRound(game);
  return game;
}

function scheduleNpc(game, delay = NPC_DELAY) {
  const p = game.players[game.turnIndex];
  game.nextNpcAt =
    !game.gameOver &&
    game.phase === 'playing' &&
    !game.trickResolveAt &&
    p?.isNpc
      ? Date.now() + delay
      : 0;
}

function startRound(game) {
  game.roundNumber += 1;
  const dirs = ['left', 'right', 'across', 'hold'];
  game.passDirection = dirs[(game.roundNumber - 1) % 4];
  game.pendingPasses.clear();
  game.trick = [];
  game.heartsBroken = false;
  game.trickNumber = 0;
  game.trickResolveAt = 0;
  game.nextNpcAt = 0;

  for (const p of game.players) {
    p.hand = [];
    p.roundCards = [];
  }

  const deck = shuffle(makeDeck());
  for (let i = 0; i < 13; i += 1) {
    for (const p of game.players) p.hand.push(deck.pop());
  }
  game.players.forEach((p) => { p.hand = sortCards(p.hand); });

  const starter = game.players.findIndex((p) => p.hand.some((c) => c.id === '2♣'));
  game.leaderIndex = starter;
  game.turnIndex = starter;
  game.phase = game.passDirection === 'hold' ? 'playing' : 'passing';

  game.log.unshift(
    `Ronde ${game.roundNumber}: ${game.passDirection === 'hold' ? 'niet passen' : `3 kaarten passen naar ${game.passDirection}`}.`
  );

  if (game.phase === 'passing') autoNpcPasses(game);
  else scheduleNpc(game, 650);
}

function passTargetIndex(game, index) {
  if (game.passDirection === 'left') return (index + 1) % 4;
  if (game.passDirection === 'right') return (index + 3) % 4;
  if (game.passDirection === 'across') return (index + 2) % 4;
  return index;
}

function npcPassChoice(player) {
  return player.hand.slice().sort((a, b) => {
    const danger = (card) => {
      if (card.id === 'Q♠') return 100;
      if (card.suit === '♥') return 40 + rankValueAceHigh(card);
      if (card.suit === '♠' && rankValueAceHigh(card) >= 13) return 30 + rankValueAceHigh(card);
      return rankValueAceHigh(card);
    };
    return danger(b) - danger(a);
  }).slice(0, 3).map((c) => c.id);
}

function autoNpcPasses(game) {
  for (const p of game.players) {
    if (p.isNpc && !game.pendingPasses.has(p.id)) {
      game.pendingPasses.set(p.id, npcPassChoice(p));
    }
  }
  if (game.pendingPasses.size === 4) applyPasses(game);
}

function applyPasses(game) {
  const outgoing = game.players.map((p) => {
    const ids = game.pendingPasses.get(p.id) || [];
    if (ids.length !== 3) throw new Error('Iedere speler moet 3 kaarten passen.');
    const cards = ids.map((id) => p.hand.find((c) => c.id === id));
    if (cards.some((c) => !c)) throw new Error('Ongeldige passelectie.');
    return cards;
  });

  for (let i = 0; i < 4; i += 1) {
    const ids = new Set(outgoing[i].map((c) => c.id));
    game.players[i].hand = game.players[i].hand.filter((c) => !ids.has(c.id));
  }

  for (let i = 0; i < 4; i += 1) {
    const target = passTargetIndex(game, i);
    game.players[target].hand.push(...outgoing[i]);
  }

  game.players.forEach((p) => { p.hand = sortCards(p.hand); });
  game.pendingPasses.clear();
  game.phase = 'playing';
  game.turnIndex = game.players.findIndex((p) => p.hand.some((c) => c.id === '2♣'));
  game.leaderIndex = game.turnIndex;
  game.log.unshift('Passen voltooid. 2♣ komt uit.');
  scheduleNpc(game, 650);
}

function legalCards(game, player) {
  if (game.phase !== 'playing' || game.trickResolveAt) return [];
  const isFirstTrick = game.trickNumber === 0;

  if (game.trick.length === 0) {
    if (isFirstTrick) return player.hand.filter((c) => c.id === '2♣');
    const nonHearts = player.hand.filter((c) => c.suit !== '♥');
    if (!game.heartsBroken && nonHearts.length) return nonHearts;
    return player.hand;
  }

  const ledSuit = game.trick[0].card.suit;
  const following = player.hand.filter((c) => c.suit === ledSuit);
  let legal = following.length ? following : player.hand.slice();

  if (isFirstTrick && !following.length) {
    const nonPoints = legal.filter((c) => cardPoints(c) === 0);
    if (nonPoints.length) legal = nonPoints;
  }

  return legal;
}

function trickWinner(game) {
  const ledSuit = game.trick[0].card.suit;
  let best = game.trick[0];
  for (const play of game.trick.slice(1)) {
    if (play.card.suit === ledSuit && rankValueAceHigh(play.card) > rankValueAceHigh(best.card)) {
      best = play;
    }
  }
  return best;
}

function endRound(game) {
  const roundPoints = game.players.map(
    (p) => p.roundCards.reduce((sum, c) => sum + cardPoints(c), 0)
  );

  const moonIndex = roundPoints.findIndex((score) => score === 26);

  if (moonIndex >= 0) {
    game.players.forEach((p, i) => { if (i !== moonIndex) p.totalScore += 26; });
    game.lastRoundSummary =
      `${game.players[moonIndex].name} schiet de maan: de anderen krijgen 26 strafpunten.`;
  } else {
    game.players.forEach((p, i) => { p.totalScore += roundPoints[i]; });
    game.lastRoundSummary =
      game.players.map((p, i) => `${p.name} +${roundPoints[i]}`).join(' · ');
  }

  game.log.unshift(`Ronde ${game.roundNumber} klaar: ${game.lastRoundSummary}`);

  if (game.players.some((p) => p.totalScore >= 100)) {
    game.gameOver = true;
    game.phase = 'done';
    game.nextNpcAt = 0;
    const low = Math.min(...game.players.map((p) => p.totalScore));
    const winners = game.players.filter((p) => p.totalScore === low);
    game.resultText =
      winners.length === 1
        ? `${winners[0].name} wint met ${low} strafpunten.`
        : `Gelijkspel op ${low} strafpunten.`;
  } else {
    startRound(game);
  }
}

function completeTrick(game) {
  if (game.trick.length !== 4) return;

  const winner = trickWinner(game);
  const player = game.players.find((p) => p.id === winner.playerId);
  const points = game.trick.reduce((sum, x) => sum + cardPoints(x.card), 0);

  player.roundCards.push(...game.trick.map((x) => x.card));
  const winnerIndex = game.players.findIndex((p) => p.id === winner.playerId);

  game.log.unshift(
    `${player.name} wint de slag${points ? ` en pakt ${points} strafpunt${points === 1 ? '' : 'en'}` : ''}.`
  );

  game.trick = [];
  game.trickResolveAt = 0;
  game.trickNumber += 1;

  if (game.trickNumber >= 13) {
    endRound(game);
    return;
  }

  game.leaderIndex = winnerIndex;
  game.turnIndex = winnerIndex;
  scheduleNpc(game);
}

function playCard(game, player, cardId) {
  const legal = legalCards(game, player);
  const card = legal.find((c) => c.id === cardId);
  if (!card) throw new Error('Die kaart mag je nu niet spelen.');

  player.hand = player.hand.filter((c) => c.id !== card.id);
  if (card.suit === '♥') game.heartsBroken = true;

  game.trick.push({ playerId: player.id, name: player.name, card });
  game.log.unshift(`${player.name}: ${cardLabel(card)}.`);

  if (game.trick.length === 4) {
    game.trickResolveAt = Date.now() + TRICK_HOLD;
    game.nextNpcAt = 0;
  } else {
    game.turnIndex = (game.turnIndex + 1) % 4;
    scheduleNpc(game);
  }
}

function npcPlay(game, player) {
  const legal = legalCards(game, player);
  if (!legal.length) return;

  let choice;
  if (game.trick.length === 0) {
    choice = legal.slice().sort((a,b) => rankValueAceHigh(a) - rankValueAceHigh(b))[0];
  } else {
    choice = legal.slice().sort((a,b) => {
      const score = (c) => cardPoints(c) * 100 + rankValueAceHigh(c);
      return score(a) - score(b);
    })[0];
  }

  playCard(game, player, choice.id);
}

function tick(game, now = Date.now()) {
  if (game.gameOver) return false;

  if (game.trickResolveAt) {
    if (now < game.trickResolveAt) return false;
    completeTrick(game);
    return true;
  }

  if (game.phase !== 'playing') return false;
  const player = game.players[game.turnIndex];
  if (!player?.isNpc) { game.nextNpcAt = 0; return false; }

  if (!game.nextNpcAt) game.nextNpcAt = now + NPC_DELAY;
  if (now < game.nextNpcAt) return false;

  npcPlay(game, player);
  if (!game.trickResolveAt) scheduleNpc(game);
  return true;
}

function handleAction(game, playerId, action, payload = {}) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  const player = game.players.find((p) => p.id === playerId);
  if (!player || player.isNpc) throw new Error('Speler niet gevonden.');

  if (game.phase === 'passing') {
    if (action !== 'pass') throw new Error('Je moet eerst 3 kaarten passen.');
    const ids = Array.isArray(payload.ids) ? [...new Set(payload.ids.map(String))] : [];
    if (ids.length !== 3 || ids.some((id) => !player.hand.some((c) => c.id === id))) {
      throw new Error('Selecteer exact 3 kaarten.');
    }
    game.pendingPasses.set(playerId, ids);
    autoNpcPasses(game);
    if (game.pendingPasses.size === 4) applyPasses(game);
    return;
  }

  if (game.trickResolveAt) throw new Error('De slag wordt eerst toegekend.');
  if (action !== 'play') throw new Error('Onbekende actie.');
  if (game.players[game.turnIndex]?.id !== playerId) throw new Error('Je bent niet aan de beurt.');

  playCard(game, player, String(payload.cardId || ''));
}

function serialize(game, requesterId, connected) {
  const me = game.players.find((p) => p.id === requesterId);
  return {
    kind: meta.key, roundNumber: game.roundNumber, passDirection: game.passDirection,
    phase: game.phase, heartsBroken: game.heartsBroken, trickNumber: game.trickNumber + 1,
    trick: game.trick, resolvingTrick: Boolean(game.trickResolveAt),
    turnPlayerId:
      game.phase === 'playing' && !game.trickResolveAt
        ? game.players[game.turnIndex]?.id
        : null,
    gameOver: game.gameOver, resultText: game.resultText,
    lastRoundSummary: game.lastRoundSummary, log: game.log,
    players: game.players.map((p) => ({
      id: p.id, name: p.name, isNpc: p.isNpc,
      connected: p.isNpc || connected.get(p.id),
      hand: p.id === requesterId ? p.hand : undefined,
      handCount: p.hand.length, totalScore: p.totalScore,
      roundPoints: p.roundCards.reduce((sum,c) => sum + cardPoints(c), 0),
      passed: game.pendingPasses.has(p.id)
    })),
    legalIds:
      me &&
      game.phase === 'playing' &&
      !game.trickResolveAt &&
      game.players[game.turnIndex]?.id === requesterId
        ? legalCards(game, me).map((c) => c.id)
        : []
  };
}

module.exports = {
  meta, createGame, handleAction, serialize, tick, cardPoints, legalCards
};
