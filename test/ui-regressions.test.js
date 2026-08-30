const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('informatieknoppen op home openen de volledige spelregels',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.doesNotMatch(html,/<details class="game-info">/);
 assert.equal((html.match(/data-rules-game=/g)||[]).length,9);
 assert.match(app,/openRules\(info\.dataset\.rulesGame\)/);
});

test('Cluedo notitieblok wisselt vanaf de huidige status',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../public/js/game-ui.js'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../public/styles.css'),'utf8');
 assert.match(ui,/state\.cluedoNotes\[key\]=\(getCluedoNote\(roomId,cardId\)\+1\)%3/);
 assert.doesNotMatch(ui,/state\.cluedoNotes\[key\]=\(state\.cluedoNotes\[key\]\+1\)%3/);
 assert.match(ui,/return state\.cluedoNotes\[key\]/);
 assert.match(app,/cluedoSelections: \{\}/);
 assert.match(ui,/rememberCluedoSelections/);
 assert.match(ui,/categoryOrder=\{suspect:0,weapon:1,room:2\}/);
 assert.match(css,/cluedo-note\.owned strong\{color:#e97575/);
 assert.match(css,/cluedo-note\.note-suspect strong\{color:#efc866/);
});

test('room state guard negeert stale room states tijdens roomwissels',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.match(app,/roomStateBlocked/);
 assert.match(app,/room\.id !== expected/);
 assert.match(app,/history\.replaceState\(\{\},'', '\/'\)/);
});
