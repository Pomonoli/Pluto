const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getGame, listGames } = require('../src/games');

test('alle gamemappen laden met een geldig manifest en servercontract', () => {
  const directory = path.join(__dirname, '../games');
  const expected = fs.readdirSync(directory, {withFileTypes:true})
    .filter(entry => entry.isDirectory() && !/^[_.]/.test(entry.name)
      && ['manifest.json', 'server.js'].some(file => fs.existsSync(path.join(directory, entry.name, file))))
    .map(entry => entry.name).sort();
  assert.ok(expected.length > 0);
  assert.deepEqual(listGames().map(game => game.key).sort(), expected);
  for (const key of expected) {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, key, 'manifest.json'), 'utf8'));
    assert.equal(manifest.key, key);
    assert.ok(typeof manifest.name === 'string' && manifest.name.trim(), `${key}: naam ontbreekt`);
    assert.ok(Number.isInteger(manifest.minPlayers) && manifest.minPlayers >= 1, `${key}: minPlayers`);
    assert.ok(Number.isInteger(manifest.maxPlayers) && manifest.maxPlayers >= manifest.minPlayers, `${key}: maxPlayers`);
    for (const method of ['createGame', 'handleAction', 'serialize']) assert.equal(typeof getGame(key)[method], 'function', `${key}: ${method}`);
  }
});

test('game registry geeft metadata terug', () => {
  assert.equal(getGame('solitaire').meta.maxPlayers, 1);
  assert.equal(getGame('hartenjagen').meta.minPlayers, 4);
});
