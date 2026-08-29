const { makeDeck, shuffle } = require('./cards');

const meta = {
  key: 'solitaire', name: 'Solitaire', description: 'Klondike draw-3.',
  minPlayers: 1, maxPlayers: 1, supportsNpc: false, realtime: false, solo: true
};

function createGame(roomPlayers) {
  const deck = shuffle(makeDeck());
  const tableau = [];
  for (let col = 0; col < 7; col += 1) {
    const cards = [];
    for (let row = 0; row <= col; row += 1) {
      cards.push({ ...deck.pop(), faceUp: row === col });
    }
    tableau.push(cards);
  }
  return {
    gameKey: meta.key,
    playerId: roomPlayers[0].id,
    stock: deck.map((c) => ({ ...c, faceUp: false })),
    waste: [], tableau,
    foundations: { '♣': [], '♦': [], '♥': [], '♠': [] },
    moves: 0, gameOver: false, resultText: ''
  };
}

function oppositeColor(a, b) { return a.color !== b.color; }
function foundationAccepts(card, pile) {
  if (!pile.length) return card.rank === 'A';
  return pile[pile.length - 1].value + 1 === card.value;
}
function tableauAccepts(card, pile) {
  if (!pile.length) return card.rank === 'K';
  const top = pile[pile.length - 1];
  return top.faceUp && oppositeColor(card, top) && card.value + 1 === top.value;
}
function revealTop(pile) {
  if (pile.length && !pile[pile.length - 1].faceUp) pile[pile.length - 1].faceUp = true;
}
function checkWin(game) {
  if (Object.values(game.foundations).every((pile) => pile.length === 13)) {
    game.gameOver = true;
    game.resultText = `Solitaire uitgespeeld in ${game.moves} zetten.`;
  }
}

function handleAction(game, playerId, action, payload = {}) {
  if (playerId !== game.playerId) throw new Error('Niet jouw spel.');
  if (game.gameOver) throw new Error('Het spel is afgelopen.');

  if (action === 'draw') {
    if (game.stock.length) {
      for (let i = 0; i < 3 && game.stock.length; i += 1) {
        const card = game.stock.pop(); card.faceUp = true; game.waste.push(card);
      }
    } else if (game.waste.length) {
      game.stock = game.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      game.waste = [];
    } else throw new Error('Geen kaarten meer.');
    game.moves += 1;
  } else if (action === 'wasteToFoundation') {
    const card = game.waste[game.waste.length - 1];
    if (!card || !foundationAccepts(card, game.foundations[card.suit])) throw new Error('Die kaart kan daar niet naartoe.');
    game.foundations[card.suit].push(game.waste.pop()); game.moves += 1;
  } else if (action === 'wasteToTableau') {
    const dest = Number(payload.dest);
    const card = game.waste[game.waste.length - 1];
    if (!Number.isInteger(dest) || !game.tableau[dest] || !card || !tableauAccepts(card, game.tableau[dest])) throw new Error('Ongeldige zet.');
    game.tableau[dest].push(game.waste.pop()); game.moves += 1;
  } else if (action === 'tableauToFoundation') {
    const src = Number(payload.src);
    const pile = game.tableau[src];
    const card = pile?.[pile.length - 1];
    if (!card?.faceUp || !foundationAccepts(card, game.foundations[card.suit])) throw new Error('Ongeldige zet.');
    game.foundations[card.suit].push(pile.pop()); revealTop(pile); game.moves += 1;
  } else if (action === 'tableauMove') {
    const src = Number(payload.src), index = Number(payload.index), dest = Number(payload.dest);
    const source = game.tableau[src], target = game.tableau[dest];
    if (!source || !target || src === dest || !Number.isInteger(index) || index < 0 || index >= source.length) throw new Error('Ongeldige zet.');
    const moving = source.slice(index);
    if (!moving[0]?.faceUp || !tableauAccepts(moving[0], target)) throw new Error('Ongeldige zet.');
    for (let i = 0; i < moving.length - 1; i += 1) {
      if (!oppositeColor(moving[i], moving[i+1]) || moving[i].value !== moving[i+1].value + 1 || !moving[i+1].faceUp) throw new Error('Ongeldige reeks.');
    }
    source.splice(index); target.push(...moving); revealTop(source); game.moves += 1;
  } else if (action === 'foundationToTableau') {
    const suit = String(payload.suit || '');
    const dest = Number(payload.dest);
    const pile = game.foundations[suit], target = game.tableau[dest];
    const card = pile?.[pile.length - 1];
    if (!card || !target || !tableauAccepts(card, target)) throw new Error('Ongeldige zet.');
    target.push(pile.pop()); game.moves += 1;
  } else throw new Error('Onbekende actie.');

  checkWin(game);
}

function serialize(game) {
  return {
    kind: meta.key, stockCount: game.stock.length, waste: game.waste, tableau: game.tableau,
    foundations: game.foundations, moves: game.moves, gameOver: game.gameOver, resultText: game.resultText
  };
}

module.exports = { meta, createGame, handleAction, serialize, foundationAccepts, tableauAccepts };
