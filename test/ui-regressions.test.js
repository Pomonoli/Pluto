const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('Zenuwen maakt niet-speelbare kaarten niet disabled of transparant',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../public/js/game-ui.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../public/styles.css'),'utf8');
 assert.doesNotMatch(ui,/n\.disabled=!piles\.length\|\|game\.gameOver/);
 assert.match(ui,/aria-disabled',piles\.length\?'false':'true'/);
 assert.match(css,/zenuwen-card\[aria-disabled="true"\]\{opacity:1;filter:none/);
});

test('room state guard negeert stale room states tijdens roomwissels',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.match(app,/roomStateBlocked/);
 assert.match(app,/room\.id !== expected/);
 assert.match(app,/history\.replaceState\(\{\},'', '\/'\)/);
});
