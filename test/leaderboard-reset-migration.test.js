const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

test('leaderboard reset wist alleen match history en gebeurt maar één keer',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mg-reset-'));
  const dbPath=path.join(dir,'minigames.db');

  const seed=`
    const {DatabaseSync}=require('node:sqlite');
    const db=new DatabaseSync(${JSON.stringify(dbPath)});
    db.exec(\`PRAGMA foreign_keys=ON;
      CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL,username_key TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE matches(id INTEGER PRIMARY KEY AUTOINCREMENT,game_key TEXT NOT NULL,room_id TEXT,started_at INTEGER,ended_at INTEGER NOT NULL);
      CREATE TABLE match_players(id INTEGER PRIMARY KEY AUTOINCREMENT,match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,display_name TEXT NOT NULL,placement INTEGER,score REAL,won INTEGER NOT NULL DEFAULT 0,outcome TEXT,duration_ms INTEGER,moves INTEGER);
      CREATE TABLE minigolf_maps(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,map_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
      INSERT INTO users(username,username_key,password_hash,created_at) VALUES('Tester','tester','x',1);
      INSERT INTO matches(game_key,ended_at) VALUES('hofslag',2);
      INSERT INTO match_players(match_id,user_id,display_name,won) VALUES(1,1,'Tester',1);
      INSERT INTO minigolf_maps(owner_user_id,name,map_json,created_at,updated_at) VALUES(1,'Map','{}',1,1);
    \`);
  `;
  let r=spawnSync(process.execPath,['-e',seed],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);

  const load=`process.env.DATA_DIR=${JSON.stringify(dir)};const d=require(${JSON.stringify(path.join(__dirname,'../src/db.js'))});console.log(JSON.stringify({matches:d.db.prepare('select count(*) n from matches').get().n,players:d.db.prepare('select count(*) n from match_players').get().n,users:d.db.prepare('select count(*) n from users').get().n,maps:d.db.prepare('select count(*) n from minigolf_maps').get().n,migrations:d.db.prepare('select count(*) n from app_migrations').get().n}));`;
  r=spawnSync(process.execPath,['-e',load],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const first=JSON.parse(r.stdout.trim().split('\n').at(-1));
  assert.deepEqual(first,{matches:0,players:0,users:1,maps:1,migrations:2});

  // Add a new post-migration match. Reloading db.js must NOT erase it.
  const add=`process.env.DATA_DIR=${JSON.stringify(dir)};const d=require(${JSON.stringify(path.join(__dirname,'../src/db.js'))});d.db.prepare("insert into matches(game_key,ended_at) values('hofslag',3)").run();`;
  r=spawnSync(process.execPath,['-e',add],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  r=spawnSync(process.execPath,['-e',load],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const second=JSON.parse(r.stdout.trim().split('\n').at(-1));
  assert.equal(second.matches,1);
  assert.equal(second.users,1);
  assert.equal(second.maps,1);
  assert.equal(second.migrations,2);

  fs.rmSync(dir,{recursive:true,force:true});
});
