const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('Big Blue C rangschikt ontdekkingen zonder ze als algemene wins te tellen', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluto-leaderboard-'));
  process.env.DATA_DIR = dir;
  const db = require('../src/db');
  const alice = db.register('SpeciesAlice', 'password123').user;
  const bob = db.register('SpeciesBob', 'password123').user;

  db.saveDeepBleuCPlayer(alice.id, { cash: 10, discovered: ['a', 'b'], woodDiscovered: ['c'], skills: { fishing: 101 } });
  db.saveDeepBleuCPlayer(bob.id, { cash: 999, discovered: ['a'] });

  const leaders = db.leaderboard('deep-bleu-c');
  assert.deepEqual(leaders.map((row) => [row.username, row.discovered]), [
    ['SpeciesAlice', 3],
    ['SpeciesBob', 1]
  ]);
  assert.deepEqual(leaders.map((row) => [row.username, row.totalLevel]), [
    ['SpeciesAlice', 7],
    ['SpeciesBob', 6]
  ]);
  assert.deepEqual(db.leaderboard(), []);
  assert.equal(db.getOwnStats(alice.id).wins, 0);
});

test('Bakkermans Jones rangschikt spelers op hun recordaantal overleefde dagen', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluto-bakkermans-leaderboard-'));
  process.env.DATA_DIR = dir;
  delete require.cache[require.resolve('../src/db')];
  const db = require('../src/db');
  const alice = db.register('BakkerAlice', 'password123').user;
  const bob = db.register('BakkerBob', 'password123').user;
  const record = (user, score, roomId) => db.recordMatch({
    gameKey: 'bakkermansjones', roomId, players: [{
      userId: user.id, displayName: user.username, placement: 1,
      score, won: false, draw: false
    }]
  });

  record(alice, 4, 'bakker-1');
  record(alice, 9, 'bakker-2');
  record(bob, 6, 'bakker-3');

  assert.deepEqual(db.leaderboard('bakkermansjones').map((row) => [row.username, row.recordDays]), [
    ['BakkerAlice', 9],
    ['BakkerBob', 6]
  ]);
});
