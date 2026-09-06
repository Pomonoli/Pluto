const test = require('node:test');
const assert = require('node:assert/strict');
const solitaire = require('../games/solitaire/server');

test('Solitaire trekt maximaal drie kaarten per draw', () => {
  const game=solitaire.createGame([{id:'solo'}]);
  game.stock=[
    {id:'A♣',faceUp:false},
    {id:'2♣',faceUp:false},
    {id:'3♣',faceUp:false},
    {id:'4♣',faceUp:false}
  ];
  game.waste=[];
  solitaire.handleAction(game,'solo','draw');
  assert.equal(game.stock.length,1);
  assert.deepEqual(game.waste.map(card=>card.id),['4♣','3♣','2♣']);
  assert.ok(game.waste.every(card=>card.faceUp));
  solitaire.handleAction(game,'solo','draw');
  assert.equal(game.stock.length,0);
  assert.equal(game.waste.at(-1).id,'A♣');
});

test('Solitaire kan direct met een vers bord opnieuw beginnen', () => {
  const game=solitaire.createGame([{id:'solo'}]);
  solitaire.handleAction(game,'solo','draw');
  assert.equal(game.moves,1);
  solitaire.handleAction(game,'solo','restart');
  assert.equal(game.playerId,'solo');
  assert.equal(game.moves,0);
  assert.equal(game.stock.length,24);
  assert.equal(game.waste.length,0);
  assert.deepEqual(game.tableau.map(pile=>pile.length),[1,2,3,4,5,6,7]);
});
