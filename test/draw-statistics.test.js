'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

test('draw-migratie bewaart oude statistieken en telt nieuwe gelijke spelen',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pluto-draws-'));
  const dbPath=path.join(dir,'minigames.db');
  const seed=`
    const {DatabaseSync}=require('node:sqlite');
    const db=new DatabaseSync(${JSON.stringify(dbPath)});
    db.exec(\`PRAGMA foreign_keys=ON;
      CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL,username_key TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE matches(id INTEGER PRIMARY KEY AUTOINCREMENT,game_key TEXT NOT NULL,room_id TEXT,started_at INTEGER,ended_at INTEGER NOT NULL);
      CREATE TABLE match_players(id INTEGER PRIMARY KEY AUTOINCREMENT,match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,display_name TEXT NOT NULL,placement INTEGER,score REAL,won INTEGER NOT NULL DEFAULT 0,outcome TEXT,duration_ms INTEGER,moves INTEGER);
      CREATE TABLE app_migrations(migration_key TEXT PRIMARY KEY,applied_at INTEGER NOT NULL);
      INSERT INTO app_migrations VALUES('v0.10.3-reset-leaderboards',1);
      INSERT INTO users(username,username_key,password_hash,created_at) VALUES('Oud','oud','x',1);
      INSERT INTO users(username,username_key,password_hash,created_at) VALUES('OudeGelijkspel','oudegelijkspel','x',1);
      INSERT INTO users(username,username_key,password_hash,created_at) VALUES('AndereOudeGelijkspel','andereoudegelijkspel','x',1);
      INSERT INTO matches(game_key,ended_at) VALUES('hofslag',1);
      INSERT INTO match_players(match_id,user_id,display_name,won) VALUES(1,1,'Oud',0);
      INSERT INTO matches(game_key,ended_at) VALUES('hofslag',2);
      INSERT INTO match_players(match_id,user_id,display_name,won,outcome) VALUES(2,2,'OudeGelijkspel',0,'Gelijkspel');
      INSERT INTO match_players(match_id,user_id,display_name,won,outcome) VALUES(2,3,'AndereOudeGelijkspel',0,'Gelijkspel');
    \`);
  `;
  const seeded=spawnSync(process.execPath,['-e',seed],{encoding:'utf8'});
  assert.equal(seeded.status,0,seeded.stderr);

  process.env.DATA_DIR=dir;
  const db=require('../src/db');
  assert.ok(db.db.prepare("PRAGMA table_info(match_players)").all().some(column=>column.name==='drawn'));
  assert.equal(db.leaderboard('hofslag').find(row=>row.username==='Oud').draws,0);
  assert.equal(db.leaderboard('hofslag').find(row=>row.username==='OudeGelijkspel').draws,1);

  const first=db.register('GelijkEen','password123').user;
  const second=db.register('GelijkTwee','password123').user;
  db.recordMatch({gameKey:'hofslag',players:[
    {userId:first.id,displayName:first.username,won:false,draw:true,outcome:'Gelijkspel'},
    {userId:second.id,displayName:second.username,won:false,draw:true,outcome:'Gelijkspel'}
  ]});
  assert.equal(db.leaderboard('hofslag').find(row=>row.username===first.username).draws,1);
  assert.equal(db.getProfile(first.username).totals.draws,1);
  assert.equal(db.getProfile(first.username).perGame[0].draws,1);
  db.db.close();
  fs.rmSync(dir,{recursive:true,force:true});
});
