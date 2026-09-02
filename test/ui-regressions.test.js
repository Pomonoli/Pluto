const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('informatieknoppen op home openen dynamisch de volledige spelregels',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.doesNotMatch(html,/<details class="game-info">/);
 assert.equal((html.match(/data-rules-game=/g)||[]).length,0);
 assert.match(app,/info\.dataset\.rulesGame=game\.key/);
 assert.match(app,/openRules\(info\.dataset\.rulesGame\)/);
});

test('room state guard negeert stale room states tijdens roomwissels',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.match(app,/roomStateBlocked/);
 assert.match(app,/room\.id !== expected/);
 assert.match(app,/history\.replaceState\(\{\},'', '\/'\)/);
});
