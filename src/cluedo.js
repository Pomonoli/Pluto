const { shuffle } = require('./cards');

const meta = {
  key: 'cluedo',
  name: 'Cluedo',
  description: 'Deduceer de dader, het wapen en de kamer zonder speelbord.',
  minPlayers: 2,
  maxPlayers: 6,
  supportsNpc: true,
  realtime: false,
  solo: false
};

const NPC_DELAY = 900;

const CATEGORIES = {
  suspect: ['De Butler', 'De Dokter', 'De Professor', 'De Kolonel', 'De Baron', 'De Kunstenaar'],
  weapon: ['Kandelaar', 'Mes', 'Touw', 'Revolver', 'Moersleutel', 'Gif'],
  room: ['Bibliotheek', 'Keuken', 'Salon', 'Serre', 'Eetkamer', 'Studiekamer']
};

function makeClueCard(category, name) {
  return { id: `${category}:${name}`, category, name };
}

function allCards() {
  return Object.entries(CATEGORIES).flatMap(([category, names]) =>
    names.map((name) => makeClueCard(category, name))
  );
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createGame(roomPlayers) {
  const solution = {
    suspect: randomChoice(CATEGORIES.suspect),
    weapon: randomChoice(CATEGORIES.weapon),
    room: randomChoice(CATEGORIES.room)
  };

  const solutionIds = new Set([
    `suspect:${solution.suspect}`,
    `weapon:${solution.weapon}`,
    `room:${solution.room}`
  ]);

  const deck = shuffle(allCards().filter((card) => !solutionIds.has(card.id)));

  const players = roomPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    isNpc: p.isNpc,
    hand: [],
    canAccuse: true,
    knowledge: new Set(),
    lastReveal: null
  }));

  let dealIndex = 0;
  while (deck.length) {
    players[dealIndex % players.length].hand.push(deck.pop());
    dealIndex += 1;
  }

  for (const p of players) {
    for (const card of p.hand) p.knowledge.add(card.id);
  }

  const game = {
    gameKey: meta.key,
    players,
    solution,
    turnIndex: 0,
    lastSuggestion: null,
    nextNpcAt: 0,
    winnerId: null,
    gameOver: false,
    resultText: '',
    log: []
  };

  scheduleNpc(game, 700);
  return game;
}

function activeAccusers(game) {
  return game.players.filter((p) => p.canAccuse);
}

function currentPlayer(game) {
  return game.players[game.turnIndex];
}

function nextEligibleIndex(game, start = game.turnIndex) {
  for (let step = 1; step <= game.players.length; step += 1) {
    const idx = (start + step) % game.players.length;
    if (game.players[idx].canAccuse) return idx;
  }
  return start;
}

function validateTriplet(payload) {
  const suspect = String(payload.suspect || '');
  const weapon = String(payload.weapon || '');
  const room = String(payload.room || '');

  if (!CATEGORIES.suspect.includes(suspect)) throw new Error('Ongeldige verdachte.');
  if (!CATEGORIES.weapon.includes(weapon)) throw new Error('Ongeldig wapen.');
  if (!CATEGORIES.room.includes(room)) throw new Error('Ongeldige kamer.');

  return { suspect, weapon, room };
}

function matchingCards(player, triplet) {
  const ids = new Set([
    `suspect:${triplet.suspect}`,
    `weapon:${triplet.weapon}`,
    `room:${triplet.room}`
  ]);
  return player.hand.filter((card) => ids.has(card.id));
}

function findDisprover(game, requesterIndex, triplet) {
  for (let step = 1; step < game.players.length; step += 1) {
    const idx = (requesterIndex + step) % game.players.length;
    const player = game.players[idx];
    const matches = matchingCards(player, triplet);
    if (matches.length) return { player, matches };
  }
  return null;
}

function checkAutoWin(game) {
  const remaining = activeAccusers(game);
  if (remaining.length === 1) {
    game.winnerId = remaining[0].id;
    game.gameOver = true;
    game.nextNpcAt = 0;
    game.resultText = `${remaining[0].name} is de enige speler die nog kan beschuldigen en wint.`;
    game.log.unshift(game.resultText);
    return true;
  }
  return false;
}

function advanceTurn(game) {
  if (game.gameOver) return;
  game.turnIndex = nextEligibleIndex(game);
  scheduleNpc(game);
}

function suggest(game, player, triplet) {
  const requesterIndex = game.players.findIndex((p) => p.id === player.id);
  const disprover = findDisprover(game, requesterIndex, triplet);

  player.lastReveal = null;

  game.lastSuggestion = {
    playerId: player.id,
    playerName: player.name,
    ...triplet,
    disprovedByName: disprover?.player.name || null
  };

  game.log.unshift(
    `${player.name} vermoedt ${triplet.suspect} met ${triplet.weapon} in ${triplet.room}.`
  );

  if (disprover) {
    const reveal = randomChoice(disprover.matches);
    player.knowledge.add(reveal.id);
    player.lastReveal = {
      byPlayerId: disprover.player.id,
      byName: disprover.player.name,
      card: reveal
    };
    game.log.unshift(`${disprover.player.name} kan de suggestie weerleggen.`);
  } else {
    game.log.unshift('Niemand kan deze suggestie weerleggen.');
  }

  advanceTurn(game);
}

function accuse(game, player, triplet) {
  if (!player.canAccuse) throw new Error('Je mag niet meer beschuldigen.');

  const correct =
    triplet.suspect === game.solution.suspect &&
    triplet.weapon === game.solution.weapon &&
    triplet.room === game.solution.room;

  if (correct) {
    game.winnerId = player.id;
    game.gameOver = true;
    game.nextNpcAt = 0;
    game.resultText =
      `${player.name} heeft het opgelost: ${triplet.suspect}, ${triplet.weapon}, ${triplet.room}.`;
    game.log.unshift(game.resultText);
    return;
  }

  player.canAccuse = false;
  game.log.unshift(`${player.name} beschuldigt fout en mag niet meer beschuldigen.`);

  if (!checkAutoWin(game)) {
    game.turnIndex = nextEligibleIndex(game);
    scheduleNpc(game);
  }
}

function unknownCandidates(player, category) {
  return CATEGORIES[category].filter(
    (name) => !player.knowledge.has(`${category}:${name}`)
  );
}

function npcTurn(game, player) {
  const suspects = unknownCandidates(player, 'suspect');
  const weapons = unknownCandidates(player, 'weapon');
  const rooms = unknownCandidates(player, 'room');

  if (
    player.canAccuse &&
    suspects.length === 1 &&
    weapons.length === 1 &&
    rooms.length === 1
  ) {
    accuse(game, player, {
      suspect: suspects[0],
      weapon: weapons[0],
      room: rooms[0]
    });
    return;
  }

  suggest(game, player, {
    suspect: randomChoice(suspects.length ? suspects : CATEGORIES.suspect),
    weapon: randomChoice(weapons.length ? weapons : CATEGORIES.weapon),
    room: randomChoice(rooms.length ? rooms : CATEGORIES.room)
  });
}

function scheduleNpc(game, delay = NPC_DELAY) {
  const player = currentPlayer(game);
  game.nextNpcAt =
    !game.gameOver && player?.isNpc && player.canAccuse
      ? Date.now() + delay
      : 0;
}

function tick(game, now = Date.now()) {
  if (game.gameOver) return false;
  const player = currentPlayer(game);
  if (!player?.isNpc || !player.canAccuse) {
    game.nextNpcAt = 0;
    return false;
  }

  if (!game.nextNpcAt) game.nextNpcAt = now + NPC_DELAY;
  if (now < game.nextNpcAt) return false;

  npcTurn(game, player);
  if (!game.gameOver) scheduleNpc(game);
  return true;
}

function handleAction(game, playerId, action, payload = {}) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');

  const player = currentPlayer(game);
  if (!player || player.id !== playerId || player.isNpc) {
    throw new Error('Je bent niet aan de beurt.');
  }

  if (!player.canAccuse) throw new Error('Je bent uitgeschakeld.');

  const triplet = validateTriplet(payload);

  if (action === 'suggest') suggest(game, player, triplet);
  else if (action === 'accuse') accuse(game, player, triplet);
  else throw new Error('Onbekende actie.');
}

function serialize(game, requesterId, connected) {
  const me = game.players.find((p) => p.id === requesterId);

  return {
    kind: meta.key,
    categories: CATEGORIES,
    turnPlayerId: game.gameOver ? null : currentPlayer(game)?.id,
    lastSuggestion: game.lastSuggestion,
    privateReveal: me?.lastReveal || null,
    gameOver: game.gameOver,
    resultText: game.resultText,
    winnerId: game.winnerId,
    log: game.log,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      isNpc: p.isNpc,
      connected: p.isNpc || connected.get(p.id),
      hand: p.id === requesterId ? p.hand : undefined,
      handCount: p.hand.length,
      canAccuse: p.canAccuse
    }))
  };
}

module.exports = {
  meta, CATEGORIES, createGame, handleAction, serialize, tick, validateTriplet
};
