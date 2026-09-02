const test = require('node:test');
const assert = require('node:assert/strict');

test('Cluedo valideert een geldige suggestie', () => {
  const { validateTriplet, CATEGORIES } = require('../games/cluedo/server');
  const triplet = validateTriplet({
    suspect: CATEGORIES.suspect[0],
    weapon: CATEGORIES.weapon[0],
    room: CATEGORIES.room[0]
  });
  assert.equal(triplet.suspect, CATEGORIES.suspect[0]);
});

test('Cluedo verdeelt 15 kaarten bij twee spelers als 8 en 7', () => {
  const { createGame } = require('../games/cluedo/server');
  const game=createGame([{id:'a',name:'A'},{id:'b',name:'B'}]);
  assert.deepEqual(game.players.map(player=>player.hand.length).sort((a,b)=>a-b),[7,8]);
});
