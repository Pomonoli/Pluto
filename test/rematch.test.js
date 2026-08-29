const test = require('node:test');
const assert = require('node:assert/strict');
const { getGame, listGames } = require('../src/games');

function playersFor(meta) {
  const count = Math.max(meta.minPlayers, 1);
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Speler ${i + 1}`,
    isNpc: i > 0
  }));
}

test('elk spel kan direct opnieuw gestart worden met dezelfde spelers', () => {
  for (const meta of listGames()) {
    const mod = getGame(meta.key);
    const roster = playersFor(meta);

    const first = mod.createGame(roster);
    const second = mod.createGame(roster);

    assert.ok(first, `${meta.name}: eerste game ontbreekt`);
    assert.ok(second, `${meta.name}: rematch ontbreekt`);
    assert.equal(second.gameKey, meta.key);
  }
});
