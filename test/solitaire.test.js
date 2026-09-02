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
