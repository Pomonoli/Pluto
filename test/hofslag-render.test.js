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

test('Hofslag centreert de kaarten in jouw hand',()=>{
 const client=read('hofslag');
 const css=fs.readFileSync(path.join(__dirname,'..','games','hofslag','styles.css'),'utf8');
 assert.match(client,/hand-area hof-hand/);
 assert.match(css,/\.hof-hand \.card-row\{justify-content:center\}/);
});

test('Hofslag blijft fixed en toont vier spelers in een raster van twee bij twee',()=>{
 const client=read('hofslag');
 const css=fs.readFileSync(path.join(__dirname,'..','games','hofslag','styles.css'),'utf8');
 assert.match(client,/hof-score-list-\$\{game\.players\.length\}/);
 assert.match(css,/#gameStage:has\(\.hof-board\)\{[^}]*display:flex;[^}]*overflow:hidden!important/);
 assert.match(css,/#gameStage:has\(\.hof-board\)>\.hof-board\{[^}]*flex:1;[^}]*height:auto/);
 assert.match(css,/\.hof-score-list-4\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
});
