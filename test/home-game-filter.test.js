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
