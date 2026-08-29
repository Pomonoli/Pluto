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

  const backup = db.backupDatabase();
  const target = path.join(dir, 'backups', backup.filename);
  assert.equal(fs.existsSync(target), true);
  assert.ok(fs.statSync(target).size > 0);
});
