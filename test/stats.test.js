const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

test('results helper ranks score games correctly', () => {
  const { resultsForGame } = require('../src/results');
  const result = resultsForGame('hofslag', {
    gameOver: true,
    players: [
      { id: 'a', score: 9 },
      { id: 'b', score: 6 },
      { id: 'c', score: 3 }
    ]
  }, 1000);
  assert.equal(result.find(x => x.playerId === 'a').won, true);
  assert.equal(result.find(x => x.playerId === 'a').placement, 1);
  assert.equal(result.find(x => x.playerId === 'b').placement, 2);
});

test('a tied Hofslag result does not count as a win', () => {
  const { resultsForGame } = require('../src/results');
  const result = resultsForGame('hofslag', {
    gameOver: true,
    players: [{ id: 'a', score: 7 }, { id: 'b', score: 7 }]
  }, 1000);
  assert.equal(result[0].won, false);
  assert.equal(result[1].won, false);
  assert.ok(result.every(x=>x.draw));
});


test('Cluedo winnaar telt als win', () => {
  const { resultsForGame } = require('../src/results');
  const result = resultsForGame('cluedo', {
    gameOver: true,
    winnerId: 'a',
    players: [{id:'a'},{id:'b'}]
  }, 1000);
  assert.equal(result.find(x=>x.playerId==='a').won, true);
  assert.equal(result.find(x=>x.playerId==='b').won, false);
});


test('Minigolf hoogste totaalpunten wint', () => {
  const { resultsForGame } = require('../src/results');
  const result = resultsForGame('minigolf', {
    gameOver: true,
    players: [{id:'a',totalPoints:15},{id:'b',totalPoints:17},{id:'c',totalPoints:10}]
  }, 1000);
  assert.equal(result.find(x=>x.playerId==='b').won, true);
  assert.equal(result.find(x=>x.playerId==='b').placement, 1);
});

test('Minigolf gelijk hoogste punten geeft geen leaderboard-win', () => {
  const { resultsForGame } = require('../src/results');
  const result = resultsForGame('minigolf', {
    gameOver: true,
    players: [{id:'a',totalPoints:15},{id:'b',totalPoints:15}]
  }, 1000);
  assert.equal(result[0].won, false);
  assert.equal(result[1].won, false);
  assert.ok(result.every(x=>x.draw));
});

test('Carcassonne hoogste unieke score wint', () => {
  const { resultsForGame } = require('../src/results');
  const results=resultsForGame('carcassonne',{gameOver:true,players:[{id:'a',score:42},{id:'b',score:31}]},1000);
  assert.equal(results.find(x=>x.playerId==='a').won,true);
  assert.equal(results.find(x=>x.playerId==='a').placement,1);
  assert.equal(results.find(x=>x.playerId==='b').placement,2);
});
