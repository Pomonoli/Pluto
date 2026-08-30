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

test('Cluedo notitieblok wisselt vanaf de huidige status',()=>{
 const client=fs.readFileSync(path.join(__dirname,'../games/cluedo/client.js'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../games/cluedo/styles.css'),'utf8');
 assert.match(client,/notes\[key\]=\(getCluedoNote\(roomId,cardId\)\+1\)%3/);
 assert.doesNotMatch(client,/notes\[key\]=\(notes\[key\]\+1\)%3/);
 assert.match(client,/return notes\[key\]/);
 assert.doesNotMatch(app,/cluedoSelections/);
 assert.match(client,/rememberCluedoSelections/);
 assert.match(client,/categoryOrder=\{suspect:0,weapon:1,room:2\}/);
 assert.match(css,/cluedo-note\.owned strong\{color:#e97575/);
 assert.match(css,/cluedo-note\.note-suspect strong\{color:#efc866/);
});

test('room state guard negeert stale room states tijdens roomwissels',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.match(app,/roomStateBlocked/);
 assert.match(app,/room\.id !== expected/);
 assert.match(app,/history\.replaceState\(\{\},'', '\/'\)/);
});
