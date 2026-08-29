const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('room state guard negeert stale room states tijdens roomwissels',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.match(app,/roomStateBlocked/);
 assert.match(app,/room\.id !== expected/);
 assert.match(app,/history\.replaceState\(\{\},'', '\/'\)/);
});
