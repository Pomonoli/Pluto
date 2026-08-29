const SUITS = [
  { symbol: '♣', name: 'Klaveren', color: 'black' },
  { symbol: '♦', name: 'Ruiten', color: 'red' },
  { symbol: '♥', name: 'Harten', color: 'red' },
  { symbol: '♠', name: 'Schoppen', color: 'black' }
];

const RANKS = [
  { rank: 'A', value: 1 },
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 11 },
  { rank: 'Q', value: 12 },
  { rank: 'K', value: 13 }
];

function shuffle(items, rng = Math.random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank.rank}${suit.symbol}`,
        rank: rank.rank,
        value: rank.value,
        suit: suit.symbol,
        color: suit.color
      });
    }
  }
  return deck;
}

function cardLabel(card) {
  return `${card.rank}${card.suit}`;
}

function rankValueAceHigh(card) {
  return card.rank === 'A' ? 14 : card.value;
}

function sortCards(cards) {
  const suitOrder = new Map(SUITS.map((suit, index) => [suit.symbol, index]));
  return cards.slice().sort((a, b) => {
    const suitDiff = suitOrder.get(a.suit) - suitOrder.get(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return rankValueAceHigh(a) - rankValueAceHigh(b);
  });
}

module.exports = {
  SUITS,
  RANKS,
  shuffle,
  makeDeck,
  cardLabel,
  rankValueAceHigh,
  sortCards
};
