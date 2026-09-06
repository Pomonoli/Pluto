const test = require('node:test');
const assert = require('node:assert/strict');
const ragnarok = require('../games/ragnarok/server');

const players = (npc = false) => [
  { id: 'a', name: 'Ada', isNpc: false },
  { id: 'b', name: 'Bot', isNpc: npc }
];

function firstExpandTarget(game, playerId) {
  const p = game.players[playerId];
  for (const key of p.tiles) {
    const t = game.tiles.get(key);
    for (const [dq, dr] of [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]) {
      const nk = `${t.q + dq},${t.r + dr}`;
      const nt = game.tiles.get(nk);
      if (nt && nt.owner === null) return nk;
    }
  }
  return null;
}

test('Ragnarok start met een thuisbasis, een arbeider en verborgen grondstoffen', () => {
  const game = ragnarok.createGame(players());
  const view = ragnarok.serialize(game, 'a', new Map([['a', true], ['b', true]]));
  assert.equal(view.kind, 'ragnarok');
  assert.equal(view.players.length, 2);
  const you = view.players.find((p) => p.isYou);
  const opp = view.players.find((p) => !p.isYou);
  assert.equal(you.tiles, 2);
  assert.ok(you.resources);
  assert.equal(opp.resources, undefined);
  assert.equal(view.tiles.length, game.tiles.size);
});

test('uitbreiden claimt een lege tegel en kost erts', () => {
  const game = ragnarok.createGame(players());
  const p = game.players.a;
  const before = p.resources.erts;
  const target = firstExpandTarget(game, 'a');
  ragnarok.handleAction(game, 'a', 'uitbreiden', { targetKey: target });
  assert.ok(p.tiles.has(target));
  assert.equal(game.tiles.get(target).pawn, 'arbeider');
  assert.equal(p.resources.erts, before - ragnarok.costExpand({ tiles: { size: 2 } }));
});

test('uitbreiden naar een tegel buiten bereik faalt', () => {
  const game = ragnarok.createGame(players());
  assert.throws(() => ragnarok.handleAction(game, 'a', 'uitbreiden', { targetKey: '999,999' }));
});

test('upgraden gaat van arbeider naar krijger en dan naar graaf of boot', () => {
  const game = ragnarok.createGame(players());
  const p = game.players.a;
  p.resources.ijzer = 20;
  const workerKey = [...p.tiles].find((k) => game.tiles.get(k).pawn === 'arbeider');
  ragnarok.handleAction(game, 'a', 'upgraden', { targetKey: workerKey });
  assert.equal(game.tiles.get(workerKey).pawn, 'krijger');
  ragnarok.handleAction(game, 'a', 'upgraden', { targetKey: workerKey, choice: 'graaf' });
  assert.equal(game.tiles.get(workerKey).pawn, 'graaf');
  assert.throws(() => ragnarok.handleAction(game, 'a', 'upgraden', { targetKey: workerKey }));
});

test('thuisbasis versterken heeft een maximumniveau', () => {
  const game = ragnarok.createGame(players());
  const p = game.players.a;
  p.resources.erts = 100000;
  const homeKey = [...p.tiles].find((k) => game.tiles.get(k).isHome);
  for (let i = 0; i < 5; i += 1) ragnarok.handleAction(game, 'a', 'uitbreiden', { home: true, targetKey: homeKey });
  assert.equal(p.homeLevel, 6);
  assert.throws(() => ragnarok.handleAction(game, 'a', 'uitbreiden', { home: true, targetKey: homeKey }));
});

test('aanvallen kan een tegel veroveren of afgeslagen worden, nooit allebei', () => {
  const game = ragnarok.createGame(players());
  const a = game.players.a, b = game.players.b;
  // Bring the two civilizations adjacent to each other so an attack is legal.
  const aTile = [...a.tiles].map((k) => game.tiles.get(k))[0];
  let target = null;
  for (const [dq, dr] of [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]) {
    const nk = `${aTile.q + dq},${aTile.r + dr}`;
    const nt = game.tiles.get(nk);
    if (nt && nt.owner === null) { target = nt; break; }
  }
  assert.ok(target);
  target.owner = 'b';
  target.pawn = 'arbeider';
  b.tiles.add(target.key);

  ragnarok.handleAction(game, 'a', 'aanvallen', { targetKey: target.key });
  const captured = a.tiles.has(target.key);
  const stillB = b.tiles.has(target.key);
  assert.notEqual(captured, stillB);
});

test('offeren voor bescherming zet protectedNext en kost grondstoffen', () => {
  const game = ragnarok.createGame(players());
  const p = game.players.a;
  const erts = p.resources.erts, ijzer = p.resources.ijzer;
  ragnarok.handleAction(game, 'a', 'offeren', { choice: 'protect' });
  assert.equal(p.protectedNext, true);
  assert.equal(p.resources.erts, erts - 2);
  assert.equal(p.resources.ijzer, ijzer - 2);
  assert.equal(p.resources.gunst, 2);
});

test('een uitgeschakelde speler kan niet meer handelen', () => {
  const game = ragnarok.createGame(players());
  const p = game.players.a;
  p.tiles.forEach((k) => { const t = game.tiles.get(k); t.owner = null; t.pawn = null; t.isHome = false; });
  p.tiles.clear();
  p.eliminated = true;
  assert.throws(() => ragnarok.handleAction(game, 'a', 'offeren', { choice: 'protect' }));
});

test('tick laat NPCs zelfstandig spelen en grondstoffen aangroeien', () => {
  const game = ragnarok.createGame(players(true));
  const bot = game.players.b;
  bot.nextThinkAt = 0;
  const startErts = game.players.a.resources.erts;
  const changed = ragnarok.tick(game, game.startedAt + 5000);
  assert.equal(changed, true);
  assert.ok(game.players.a.resources.erts >= startErts);
});

test('tick eindigt het spel als er nog maar 1 speler over is', () => {
  const game = ragnarok.createGame(players());
  const b = game.players.b;
  b.tiles.forEach((k) => { const t = game.tiles.get(k); t.owner = null; t.pawn = null; t.isHome = false; });
  b.tiles.clear();
  ragnarok.tick(game, game.startedAt + 1000);
  assert.equal(game.gameOver, true);
  assert.equal(game.winnerId, 'a');
});

test('tick sluit een uitgesponnen expeditie af op score', () => {
  const game = ragnarok.createGame(players());
  game.players.a.resources.erts = 999;
  game.startedAt = Date.now() - 13 * 60 * 1000;
  ragnarok.tick(game, Date.now());
  assert.equal(game.gameOver, true);
  assert.equal(game.winnerId, 'a');
});

test('results() geeft een aaneengesloten 1..N ranking en precies één winnaar', () => {
  const game = ragnarok.createGame(players());
  const b = game.players.b;
  b.tiles.forEach((k) => { const t = game.tiles.get(k); t.owner = null; t.pawn = null; t.isHome = false; });
  b.tiles.clear();
  b.eliminated = true;
  b.eliminatedAt = Date.now();
  game.gameOver = true;
  game.winnerId = 'a';
  const res = ragnarok.results(game, 60000);
  assert.deepEqual(res.map((r) => r.placement).sort(), [1, 2]);
  assert.equal(res.filter((r) => r.won).length, 1);
});
