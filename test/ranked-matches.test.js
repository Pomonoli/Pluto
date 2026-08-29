const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('één mens plus NPCs wordt niet als ranked match opgeslagen',()=>{
  const realtime=fs.readFileSync(path.join(__dirname,'../src/server/realtime.js'),'utf8');
  assert.match(realtime,/humanCount = room\.players\.filter\(\(player\) => !player\.isNpc\)\.length/);
  assert.match(realtime,/if \(humanCount < 2\)/);
  assert.match(realtime,/room\.matchRecorded = true/);
});

test('v0.10.3 bevat een eenmalige leaderboard reset migration',()=>{
  const db=fs.readFileSync(path.join(__dirname,'../src/db.js'),'utf8');
  assert.match(db,/v0\.10\.3-reset-leaderboards/);
  assert.match(db,/DELETE FROM match_players; DELETE FROM matches;/);
  assert.match(db,/CREATE TABLE IF NOT EXISTS app_migrations/);
});
