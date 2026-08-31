const test=require('node:test');
const assert=require('node:assert/strict');
const gameModule=require('../games/cascadia/server');

function players(n=2,{npcFirst=false}={}){
  return Array.from({length:n},(_,index)=>({id:`p${index+1}`,name:`P${index+1}`,isNpc:npcFirst&&index===0}));
}

test('Cascadia start met vier marktparen en drie starttegels per speler',()=>{
  const game=gameModule.createGame(players(2));
  assert.equal(game.gameKey,'cascadia');
  assert.equal(game.marketTiles.length,4);
  assert.equal(game.marketWildlife.length,4);
  assert.equal(game.boards.p1.length,3);
  assert.equal(game.boards.p2.length,3);
});

test('een gewone beurt draft een paar, plaatst een tegel en rondt af met dier of discard',()=>{
  const game=gameModule.createGame(players(2));
  gameModule.handleAction(game,'p1','draft',{tileIndex:0,wildlifeIndex:0});
  assert.equal(game.phase,'placeTile');
  const [position]=gameModule.legalTilePositions(game.boards.p1);
  gameModule.handleAction(game,'p1','placeTile',{...position,rotation:2});
  assert.equal(game.phase,'placeWildlife');
  const options=gameModule.legalWildlifeTiles(game.boards.p1,game.pending.animal);
  if(options.length)gameModule.handleAction(game,'p1','placeWildlife',{q:options[0].q,r:options[0].r});
  else gameModule.handleAction(game,'p1','discardWildlife');
  assert.equal(game.players[0].turns,1);
  assert.equal(game.turnIndex,1);
  assert.equal(game.phase,'draft');
});

test('natuurfiche laat een tegel en dier uit verschillende marktposities combineren',()=>{
  const game=gameModule.createGame(players(2));
  game.players[0].nature=1;
  gameModule.handleAction(game,'p1','draft',{tileIndex:0,wildlifeIndex:1});
  assert.equal(game.players[0].nature,0);
  assert.equal(game.pending.playerId,'p1');
  assert.equal(game.phase,'placeTile');
});

test('NPC verwerkt zijn volledige beurt via tick',()=>{
  const game=gameModule.createGame(players(2,{npcFirst:true}));
  for(let i=0;i<4&&game.players[0].turns===0;i++){
    game.nextNpcAt=1;
    assert.equal(gameModule.tick(game,Date.now()+10000),true);
  }
  assert.equal(game.players[0].turns,1);
  assert.equal(game.turnIndex,1);
});

test('scorekaart A scoort berenparen en geïsoleerde haviken correct',()=>{
  const base=(q,r,animal)=>({q,r,animal,habitats:['forest'],edges:Array(6).fill('forest'),wildlife:[animal],rotation:0});
  const bears=[base(0,0,'bear'),base(1,0,'bear')];
  assert.equal(gameModule.scoreWildlife(bears).detail.bear,4);
  const hawks=[base(0,0,'hawk'),base(2,0,'hawk')];
  assert.equal(gameModule.scoreWildlife(hawks).detail.hawk,5);
});
