'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('spelersfilter veroorzaakt geen oneindige heading-observerlus',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../public/js/home-game-filter.js'),'utf8');
  assert.match(source,/grid\.querySelector\('\.game-card'\) && heading\.classList\.contains\('hidden'\)/);
  assert.match(source,/new MutationObserver\(keepHeadingVisible\)/);
});

test('gamefilter sorteert alfabetisch of op persoonlijk meest gespeeld',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../public/js/home-game-filter.js'),'utf8');
  const db=fs.readFileSync(path.join(__dirname,'../src/db.js'),'utf8');
  assert.match(source,/Meest gespeeld/);
  assert.match(source,/rightMeta\?\.playCount/);
  assert.match(source,/api\/preferences\/game-sort/);
  assert.match(db,/WHERE mp\.user_id = \?/);
  assert.match(db,/game_sort TEXT NOT NULL DEFAULT 'alphabetical'/);
});
