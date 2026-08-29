const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const gameUiPath=path.join(__dirname,'../public/js/game-ui.js');

test('Hofslag gebruikt eigen renderpad vóór generieke player-strip',()=>{
 const app=fs.readFileSync(gameUiPath,'utf8');
 const special=app.indexOf("if (game.kind === 'hofslag')");
 const strip=app.indexOf("if(!['minigolf','blackjack','pesten'].includes(game.kind))els.gameStage.append(renderGamePlayerStrip(room,game));");
 assert.ok(special>0);
 assert.ok(strip>special);
 assert.match(app.slice(special,strip),/renderHofslag\(room, game\);/);
});

test('Blackjack en Pesten verbergen de generieke player-strip',()=>{
 const app=fs.readFileSync(gameUiPath,'utf8');
 assert.match(app,/!\['minigolf','blackjack','pesten'\]\.includes\(game\.kind\)/);
 assert.match(app,/titlebar\(`Blackjack · ronde \$\{game\.roundNumber\?\?1\}`,status,\{hideEyebrow:true\}\)/);
});

test('Hofslag eerste render dereferencet geen null animation',()=>{
 const app=fs.readFileSync(gameUiPath,'utf8');
 assert.doesNotMatch(app,/state\.hofAnimation\?\.round === game\.lastRound\?\.round && state\.hofAnimation\.active/);
 assert.match(app,/state\.hofAnimation\?\.active && state\.hofAnimation\.round === game\.lastRound\?\.round/);
});
