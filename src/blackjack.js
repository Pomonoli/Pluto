const { makeDeck, shuffle, cardLabel } = require('./cards');

const meta = {
  key: 'blackjack', name: 'Blackjack', description: 'Versla de dealer zonder boven 21 te gaan.',
  minPlayers: 1, maxPlayers: 4, supportsNpc: true, realtime: false, solo: false
};

const NPC_DELAY = 760;

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 'A') { total += 11; aces += 1; }
    else if (['K','Q','J'].includes(card.rank)) total += 10;
    else total += Number(card.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

function createGame(roomPlayers) {
  const deck = shuffle(makeDeck());
  const players = roomPlayers.map((p) => ({
    id: p.id, name: p.name, isNpc: p.isNpc,
    hand: [deck.pop(), deck.pop()], status: 'playing', result: '', score: 0
  }));
  const dealer = { hand: [deck.pop(), deck.pop()] };

  for (const p of players) {
    if (handValue(p.hand) === 21) p.status = 'stand';
  }

  const game = {
    gameKey: meta.key, deck, players, dealer, turnIndex: 0,
    phase: 'players', nextNpcAt: 0, gameOver: false, resultText: '', log: []
  };

  prepareNext(game, 650);
  return game;
}

function allPlayersDone(game) {
  return game.players.every((p) => p.status !== 'playing');
}

function settleFinal(game) {
  const dealerValue = handValue(game.dealer.hand);
  const dealerBust = dealerValue > 21;

  for (const p of game.players) {
    const value = handValue(p.hand);
    if (value > 21) p.result = 'Bust';
    else if (dealerBust || value > dealerValue) { p.result = 'Wint'; p.score = 1; }
    else if (value === dealerValue) p.result = 'Push';
    else p.result = 'Verliest';
  }

  game.phase = 'done';
  game.gameOver = true;
  game.nextNpcAt = 0;

  const winners = game.players.filter((p) => p.result === 'Wint').map((p) => p.name);
  game.resultText = winners.length
    ? `${winners.join(', ')} wint${winners.length > 1 ? 'en' : ''} van de dealer.`
    : 'De dealer wint deze ronde.';
  game.log.unshift(`Dealer eindigt op ${dealerValue}${dealerBust ? ' (bust)' : ''}.`);
}

function prepareNext(game, delay = NPC_DELAY) {
  if (game.gameOver) return;

  if (allPlayersDone(game)) {
    game.phase = 'dealer';
    game.turnIndex = -1;
    game.nextNpcAt = Date.now() + delay;
    return;
  }

  game.phase = 'players';

  let guard = 0;
  while (guard++ < game.players.length && game.players[game.turnIndex]?.status !== 'playing') {
    game.turnIndex = (game.turnIndex + 1) % game.players.length;
  }

  const player = game.players[game.turnIndex];
  game.nextNpcAt = player?.isNpc ? Date.now() + delay : 0;
}

function npcStep(game, player) {
  const value = handValue(player.hand);

  if (value < 17) {
    const card = game.deck.pop();
    player.hand.push(card);
    game.log.unshift(`${player.name} trekt ${cardLabel(card)}.`);

    if (handValue(player.hand) > 21) {
      player.status = 'bust';
      game.turnIndex = (game.turnIndex + 1) % game.players.length;
    }
  } else {
    player.status = 'stand';
    game.log.unshift(`${player.name} past.`);
    game.turnIndex = (game.turnIndex + 1) % game.players.length;
  }

  prepareNext(game);
}

function dealerStep(game) {
  const value = handValue(game.dealer.hand);

  if (value < 17) {
    const card = game.deck.pop();
    game.dealer.hand.push(card);
    game.log.unshift(`Dealer trekt ${cardLabel(card)}.`);
    game.nextNpcAt = Date.now() + NPC_DELAY;
  } else {
    settleFinal(game);
  }
}

function tick(game, now = Date.now()) {
  if (game.gameOver) return false;

  if (game.phase === 'dealer') {
    if (!game.nextNpcAt) game.nextNpcAt = now + NPC_DELAY;
    if (now < game.nextNpcAt) return false;
    dealerStep(game);
    return true;
  }

  const player = game.players[game.turnIndex];
  if (!player?.isNpc) { game.nextNpcAt = 0; return false; }
  if (!game.nextNpcAt) game.nextNpcAt = now + NPC_DELAY;
  if (now < game.nextNpcAt) return false;

  npcStep(game, player);
  return true;
}

function handleAction(game, playerId, action) {
  if (game.gameOver) throw new Error('De ronde is afgelopen.');
  if (game.phase !== 'players') throw new Error('De dealer is bezig.');

  const p = game.players[game.turnIndex];
  if (!p || p.id !== playerId || p.isNpc) throw new Error('Je bent niet aan de beurt.');

  if (action === 'hit') {
    const card = game.deck.pop();
    p.hand.push(card);
    game.log.unshift(`${p.name} trekt ${cardLabel(card)}.`);
    if (handValue(p.hand) > 21) {
      p.status = 'bust';
      game.turnIndex = (game.turnIndex + 1) % game.players.length;
      prepareNext(game);
    }
  } else if (action === 'stand') {
    p.status = 'stand';
    game.log.unshift(`${p.name} past.`);
    game.turnIndex = (game.turnIndex + 1) % game.players.length;
    prepareNext(game);
  } else {
    throw new Error('Onbekende actie.');
  }
}

function serialize(game, requesterId, connected) {
  const revealDealer = game.phase !== 'players' || game.gameOver;
  const dealerVisible = revealDealer ? game.dealer.hand : [game.dealer.hand[0], { hidden: true }];

  return {
    kind: meta.key, phase: game.phase, gameOver: game.gameOver, resultText: game.resultText,
    turnPlayerId: game.phase === 'players' && !game.gameOver ? game.players[game.turnIndex]?.id : null,
    dealer: { hand: dealerVisible, value: revealDealer ? handValue(game.dealer.hand) : null },
    log: game.log,
    players: game.players.map((p) => ({
      id: p.id, name: p.name, isNpc: p.isNpc, connected: p.isNpc || connected.get(p.id),
      hand: p.hand, value: handValue(p.hand), status: p.status, result: p.result
    }))
  };
}

module.exports = { meta, createGame, handleAction, serialize, tick, handValue };
