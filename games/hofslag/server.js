const { shuffle } = require('../../src/cards');

const meta = {
  key: 'hofslag',
  name: 'Hofslag',
  description: 'Tactisch kaartspel rond 12 beeldkaarten.',
  minPlayers: 2,
  maxPlayers: 4,
  exactPlayers: false,
  supportsNpc: true,
  realtime: false,
  solo: false
};

const SUITS = [
  { symbol: '♥', name: 'Harten', color: '#d9534f' },
  { symbol: '♠', name: 'Schoppen', color: '#4f70c8' },
  { symbol: '♦', name: 'Ruiten', color: '#d37b3f' },
  { symbol: '♣', name: 'Klaveren', color: '#4da56f' }
];
const FACE_POINTS = { J: 1, Q: 2, K: 3 };
const FACE_RANKS = ['J', 'Q', 'K'];

function getMoves(values) {
  const hasAce = values.some((value) => value === 1);
  if (hasAce) return values.map((value) => (value === 1 ? 1 : Math.max(1, value - 1)));
  const highest = Math.max(...values);
  return values.map((value) => (value === highest ? value : Math.max(1, value - 1)));
}

function makeFaceDeck() {
  const cards = [];
  for (const suit of SUITS) {
    for (const rank of FACE_RANKS) {
      cards.push({ kind: 'face', rank, suit: suit.symbol, suitName: suit.name, points: FACE_POINTS[rank] });
    }
  }
  return shuffle(cards);
}

function drawToFour(player) {
  while (player.hand.length < 4) {
    if (player.draw.length === 0) {
      if (player.discard.length === 0) break;
      player.draw = shuffle(player.discard);
      player.discard = [];
    }
    player.hand.push(player.draw.pop());
  }
  player.hand.sort((a, b) => a - b);
}

function createGame(roomPlayers) {
  const players = roomPlayers.map((roomPlayer, index) => {
    const suit = SUITS[index];
    const player = {
      id: roomPlayer.id,
      name: roomPlayer.name,
      isNpc: roomPlayer.isNpc,
      suit: suit.symbol,
      suitName: suit.name,
      color: suit.color,
      pos: 0,
      score: 0,
      draw: shuffle(Array.from({ length: 10 }, (_, i) => i + 1)),
      discard: [], hand: [], locked: []
    };
    drawToFour(player);
    return player;
  });

  return {
    gameKey: meta.key,
    round: 1,
    board: makeFaceDeck(),
    players,
    pending: new Map(),
    lastRound: null,
    log: ['Het spel is gestart. Iedereen begint op dezelfde positie.'],
    gameOver: false,
    resultText: ''
  };
}

function boardFacePointsAt(game, index) {
  const card = game.board[index];
  return card && card.kind === 'face' ? card.points : 0;
}

function chooseNpcCard(game, npc) {
  let bestCard = npc.hand[0];
  let bestScore = -Infinity;
  const myIndex = game.players.findIndex((player) => player.id === npc.id);

  for (const candidate of npc.hand) {
    let total = 0;
    for (let t = 0; t < 70; t += 1) {
      const sampled = game.players.map((player) => player.id === npc.id ? candidate : 1 + Math.floor(Math.random() * 10));
      const moves = getMoves(sampled);
      const positions = game.players.map((player, index) => (player.pos + moves[index]) % 12);
      const landing = positions[myIndex];
      const points = boardFacePointsAt(game, landing);
      let reward = 0;
      if (points > 0) {
        const contenders = positions.map((position, index) => ({ position, index, value: sampled[index] })).filter((x) => x.position === landing);
        if (contenders.length === 1) reward = points;
        else {
          const lowest = Math.min(...contenders.map((x) => x.value));
          const lows = contenders.filter((x) => x.value === lowest);
          if (lows.length === 1 && lows[0].index === myIndex) reward = points;
        }
      }
      total += reward * 5;
    }
    const score = total / 70 - (candidate >= 8 ? .06 : 0) + Math.random() * .01;
    if (score > bestScore) { bestScore = score; bestCard = candidate; }
  }
  return bestCard;
}

function getRemaining(game) {
  const faces = game.board.filter((card) => card.kind === 'face');
  return { facesLeft: faces.length, pointsLeft: faces.reduce((sum, card) => sum + card.points, 0) };
}

function resolveRound(game) {
  const played = game.players.map((player) => ({ player, value: game.pending.get(player.id) }));
  if (played.some((item) => !Number.isInteger(item.value))) throw new Error('Niet alle spelers hebben gekozen.');

  for (const item of played) {
    const index = item.player.hand.indexOf(item.value);
    if (index < 0) throw new Error('Ongeldige kaart.');
    item.player.hand.splice(index, 1);
  }

  const moves = getMoves(played.map((x) => x.value));
  const oldPositions = game.players.map((p) => p.pos);
  const newPositions = game.players.map((p, i) => (p.pos + moves[i]) % 12);
  const boardBefore = game.board.map((card) => ({ ...card }));
  const groups = new Map();
  newPositions.forEach((pos, index) => {
    if (!groups.has(pos)) groups.set(pos, []);
    groups.get(pos).push(index);
  });

  const wins = [];
  for (const [pos, indices] of groups.entries()) {
    const target = boardBefore[pos];
    if (!target || target.kind !== 'face') continue;
    let winnerIndex = null;
    if (indices.length === 1) winnerIndex = indices[0];
    else {
      const lowest = Math.min(...indices.map((i) => played[i].value));
      const lows = indices.filter((i) => played[i].value === lowest);
      if (lows.length === 1) winnerIndex = lows[0];
    }
    if (winnerIndex !== null) {
      wins.push({ player: game.players[winnerIndex], boardIndex: pos, faceCard: target, playedValue: played[winnerIndex].value });
    }
  }

  game.players.forEach((p, i) => { p.pos = newPositions[i]; });
  for (const win of wins) {
    win.player.score += win.faceCard.points;
    win.player.locked.push(win.playedValue);
    game.board[win.boardIndex] = {
      kind: 'number', value: win.playedValue, suit: win.player.suit,
      suitName: win.player.suitName, ownerId: win.player.id, ownerName: win.player.name
    };
  }

  for (const item of played) {
    if (!wins.some((win) => win.player.id === item.player.id)) item.player.discard.push(item.value);
  }
  game.players.forEach(drawToFour);

  game.lastRound = {
    round: game.round,
    boardBefore,
    plays: played.map((item, i) => ({ playerId: item.player.id, name: item.player.name, suit: item.player.suit, color: item.player.color, value: item.value, move: moves[i], from: oldPositions[i], to: newPositions[i] })),
    wins: wins.map((win) => ({ playerId: win.player.id, name: win.player.name, rank: win.faceCard.rank, suit: win.faceCard.suit, points: win.faceCard.points, playedValue: win.playedValue }))
  };

  game.log.unshift(`Ronde ${game.round}: ${game.lastRound.plays.map((p) => `${p.name} ${p.value === 1 ? 'A' : p.value}${p.suit} → ${p.move}`).join(' | ')}`);
  if (!wins.length) game.log.unshift('Geen beeldkaart gewonnen.');
  for (const win of wins) game.log.unshift(`${win.player.name} wint ${win.faceCard.rank}${win.faceCard.suit} (+${win.faceCard.points}).`);
  if (game.log.length > 80) game.log.length = 80;
  game.pending.clear();

  const { facesLeft, pointsLeft } = getRemaining(game);
  const reached13 = game.players.some((p) => p.score >= 13);
  let clinched = false;
  let clinchedLeader = null;
  if (game.players.length >= 3) {
    const sorted = game.players.slice().sort((a, b) => b.score - a.score);
    if (sorted[0].score > sorted[1].score && sorted[0].score - sorted[1].score > pointsLeft) {
      clinched = true; clinchedLeader = sorted[0];
    }
  }

  if (reached13 || facesLeft === 0 || clinched) {
    game.gameOver = true;
    if (clinched) game.resultText = `${clinchedLeader.name} is niet meer in te halen en wint.`;
    else {
      const high = Math.max(...game.players.map((p) => p.score));
      const leaders = game.players.filter((p) => p.score === high);
      game.resultText = leaders.length === 1 ? `${leaders[0].name} wint met ${high} punten.` : `Gelijkspel op ${high} punten.`;
    }
  } else game.round += 1;
}

function maybeAdvance(game) {
  for (const player of game.players) {
    if (player.isNpc && !game.pending.has(player.id)) game.pending.set(player.id, chooseNpcCard(game, player));
  }
  if (game.players.every((p) => game.pending.has(p.id))) resolveRound(game);
}

function handleAction(game, playerId, action, payload = {}) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  if (action !== 'playCard') throw new Error('Onbekende actie.');
  const player = game.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Speler niet gevonden.');
  if (game.pending.has(playerId)) throw new Error('Je hebt al gekozen.');
  const value = Number(payload.value);
  if (!Number.isInteger(value) || !player.hand.includes(value)) throw new Error('Die kaart zit niet in je hand.');
  game.pending.set(playerId, value);
  maybeAdvance(game);
}

function serialize(game, requesterId, connected) {
  const { facesLeft, pointsLeft } = getRemaining(game);
  return {
    kind: meta.key, round: game.round, board: game.board, facesLeft, pointsLeft,
    lastRound: game.lastRound, log: game.log, gameOver: game.gameOver, resultText: game.resultText,
    players: game.players.map((p) => ({
      id: p.id, name: p.name, isNpc: p.isNpc, suit: p.suit, suitName: p.suitName, color: p.color,
      pos: p.pos, score: p.score, connected: p.isNpc || connected.get(p.id),
      hand: p.id === requesterId ? p.hand : undefined, handCount: p.hand.length,
      drawCount: p.draw.length, discardCount: p.discard.length, lockedCount: p.locked.length,
      pending: game.pending.has(p.id)
    }))
  };
}

function results(game){const {competitionPlacements}=require('../../src/result-utils');const placements=competitionPlacements(game.players,p=>p.score,true),top=Math.max(...game.players.map(p=>p.score)),leaders=game.players.filter(p=>p.score===top);return game.players.map(p=>({playerId:p.id,placement:placements.get(p.id),score:p.score,won:leaders.length===1&&leaders[0].id===p.id,outcome:leaders.length>1&&p.score===top?'Gelijkspel':p.score===top?'Wint':'Verliest'}))}

module.exports = { meta, createGame, handleAction, serialize, maybeAdvance, getMoves, results };
