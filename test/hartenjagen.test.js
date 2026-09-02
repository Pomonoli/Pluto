const test = require('node:test');
const assert = require('node:assert/strict');
const { cardPoints } = require('../games/hartenjagen/server');

test('Hartenjagen puntentelling', () => {
  assert.equal(cardPoints({id:'5♥',suit:'♥'}), 1);
  assert.equal(cardPoints({id:'Q♠',suit:'♠'}), 13);
  assert.equal(cardPoints({id:'K♣',suit:'♣'}), 0);
});
