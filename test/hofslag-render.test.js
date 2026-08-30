const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=(game)=>fs.readFileSync(path.join(__dirname,'..','games',game,'client.js'),'utf8');
const shared=()=>fs.readFileSync(path.join(__dirname,'../public/js/game-ui.js'),'utf8');

test('Hofslag-plugin gebruikt zijn eigen renderpad zonder player-strip',()=>{
 assert.match(read('hofslag'),/function renderHofslag\(room, game\)/);
 assert.doesNotMatch(shared(),/renderHofslag/);
 assert.doesNotMatch(read('hofslag'),/export const playerStrip=true/);
});

test('Blackjack, Pesten en Presidenten verbergen de generieke player-strip',()=>{
 for(const game of ['blackjack','pesten','presidenten'])assert.doesNotMatch(read(game),/export const playerStrip=true/);
 assert.match(shared(),/if\(plugin\.playerStrip\)els\.gameStage\.append\(renderGamePlayerStrip/);
 assert.match(read('blackjack'),/titlebar\('Blackjack',status\)/);
 assert.doesNotMatch(shared(),/Blackjack/);
});

test('Hofslag eerste render dereferencet geen null animation',()=>{
 const client=read('hofslag');
 assert.match(client,/uiState\.animation\?\.active&&uiState\.animation\.round===game\.lastRound\?\.round/);
 assert.doesNotMatch(client,/state\.hofAnimation/);
});
