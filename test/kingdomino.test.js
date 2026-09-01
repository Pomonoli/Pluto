const test=require('node:test');
const assert=require('node:assert/strict');
const gameModule=require('../games/kingdomino/server');

function humans(count){
  return Array.from({length:count},(_,index)=>({
    id:String.fromCharCode(97+index),
    name:String.fromCharCode(65+index),
    isNpc:false
  }));
}

test('Kingdomino gebruikt in 2p vier koningen en 24 dominoes',()=>{
  const game=gameModule.createGame(humans(2));
  assert.equal(game.tokens.length,4);
  assert.equal(game.currentRow.length,4);
  assert.equal(game.deck.length,20);
  assert.equal(game.totalRounds,6);
});

test('Kingdomino laat 3p uit vier dominoes draften',()=>{
  const game=gameModule.createGame(humans(3));
  assert.equal(game.tokens.length,3);
  assert.equal(game.currentRow.length,4);
  assert.equal(game.deck.length,44);
  assert.equal(game.totalRounds,12);
});

test('Kingdomino laat de eerste domino aan het kasteel aansluiten',()=>{
  const game=gameModule.createGame(humans(2));
  const legal=gameModule.legalPlacements(game.players[0],gameModule.DOMINOES[0]);
  assert.ok(legal.length>0);
});

test('Kingdomino scoort gebiedsgrootte maal kronen',()=>{
  const player={cells:[
    {x:0,y:0,terrain:'castle',crowns:0},
    {x:1,y:0,terrain:'forest',crowns:1},
    {x:2,y:0,terrain:'forest',crowns:0},
    {x:3,y:0,terrain:'forest',crowns:2},
    {x:0,y:1,terrain:'water',crowns:1}
  ]};
  const score=gameModule.scoreKingdom(player);
  assert.equal(score.score,10);
  assert.equal(score.largest,3);
  assert.equal(score.totalCrowns,4);
});

for(const count of [2,3,4])test(`Kingdomino: ${count} NPC's spelen een volledige match uit`,()=>{
  const players=Array.from({length:count},(_,index)=>({id:`b${index}`,name:`NPC ${index+1}`,isNpc:true}));
  const game=gameModule.createGame(players);
  let steps=0;
  while(!game.gameOver&&steps<300){
    game.nextNpcAt=1;
    gameModule.tick(game,Date.now());
    steps++;
  }
  assert.equal(game.gameOver,true,`niet klaar na ${steps} stappen, fase ${game.phase}`);
  assert.ok(game.players.every(player=>Number.isFinite(player.score)));
  assert.ok(game.winnerIds.length>=1);
});
