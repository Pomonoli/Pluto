const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const gameUiPath=path.join(__dirname,'../public/js/game-ui.js');

test('Hofslag-plugin gebruikt zijn eigen renderpad zonder player-strip',()=>{
 const app=fs.readFileSync(gameUiPath,'utf8');
 const client=fs.readFileSync(path.join(__dirname,'../games/hofslag/client.js'),'utf8');
 assert.match(client,/renderBuiltin\('hofslag'/);
 assert.match(app,/if\(kind==='hofslag'\)\{renderHofslag\(room,game\);return\}/);
});

test('Blackjack, Pesten en Presidenten verbergen de generieke player-strip',()=>{
 const app=fs.readFileSync(gameUiPath,'utf8');
 for(const game of ['blackjack','pesten','presidenten']){
  const client=fs.readFileSync(path.join(__dirname,'..','games',game,'client.js'),'utf8');
  assert.match(client,/playerStrip:false/);
 }
 assert.match(app,/if\(playerStrip\)els\.gameStage\.append\(renderGamePlayerStrip/);
 assert.match(app,/titlebar\('Blackjack',status\)/);
 assert.doesNotMatch(app,/Blackjack · ronde/);
});

test('Hofslag eerste render dereferencet geen null animation',()=>{
 const app=fs.readFileSync(gameUiPath,'utf8');
 assert.doesNotMatch(app,/state\.hofAnimation\?\.round === game\.lastRound\?\.round && state\.hofAnimation\.active/);
 assert.match(app,/state\.hofAnimation\?\.active && state\.hofAnimation\.round === game\.lastRound\?\.round/);
});
