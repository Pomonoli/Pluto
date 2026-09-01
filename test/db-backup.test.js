const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('SQLite backup maakt een bruikbare snapshot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'minigames-db-'));
  process.env.DATA_DIR = dir;

  const db = require('../src/db');
  const user = db.register('BackupUser', 'password123');
  assert.equal(user.ok, true);
  db.setBlackjackChips(user.user.id, 140);
  const blackjackLeaders=db.leaderboard('blackjack',1);
  assert.equal(blackjackLeaders[0].username,'BackupUser');
  assert.equal(blackjackLeaders[0].chips,140);
  const solitaireLeaders=db.leaderboard('solitaire',1);
  assert.equal(solitaireLeaders[0].username,'BackupUser');
  assert.equal(solitaireLeaders[0].wins,0);

  db.recordMatch({
    gameKey: 'hofslag',
    roomId: 'ABCDE',
    startedAt: 1,
    endedAt: 2,
    players: [{
      userId: user.user.id,
      displayName: 'BackupUser',
      placement: 1,
      score: 10,
      won: true,
      outcome: 'Wint'
    }]
  });

  const popularity=db.gamePopularity(user.user.id);
  assert.equal(popularity.length,1);
  assert.equal(popularity[0].gameKey,'hofslag');
  assert.equal(popularity[0].games,1);
  assert.equal(db.setGameSort(user.user.id,'popular'),'popular');
  const refreshed=db.getUserFromCookieHeader(`${db.SESSION_COOKIE}=${user.session.token}`);
  assert.equal(refreshed.gameSort,'popular');

  const backup = db.backupDatabase();
  const target = path.join(dir, 'backups', backup.filename);
  assert.equal(fs.existsSync(target), true);
  assert.ok(fs.statSync(target).size > 0);
});
