const test=require('node:test');
const assert=require('node:assert/strict');
const gameModule=require('../games/isle-of-skye/server');
const engine=require('../games/isle-of-skye/engine');

function humans(count){
  return Array.from({length:count},(_,index)=>({
    id:String.fromCharCode(97+index),
    name:String.fromCharCode(65+index),
    isNpc:false
  }));
}
function npcs(count){
  return Array.from({length:count},(_,index)=>({id:`b${index}`,name:`NPC ${index+1}`,isNpc:true}));
}

test('Isle of Skye roteert randen 90 graden met de klok mee',()=>{
  const edges={top:'pasture',right:'mountain',bottom:'water',left:'pasture'};
  const rotated=engine.getRotatedEdges(edges,90);
  assert.deepEqual(rotated,{top:'pasture',right:'pasture',bottom:'mountain',left:'water'});
});

test('Isle of Skye weigert plaatsing zonder buur en zonder randmatch',()=>{
  const board=new Map([[engine.getCoordKey(0,0),{tile:{edges:{top:'pasture',right:'pasture',bottom:'pasture',left:'pasture'},rotation:0,hasRoad:true,features:[]},x:0,y:0}]]);
  const farTile={edges:{top:'water',right:'water',bottom:'water',left:'water'},rotation:0,hasRoad:false,features:[]};
  assert.equal(engine.isValidPlacement(board,farTile,5,5,0),false);
  const mismatchTile={edges:{top:'mountain',right:'mountain',bottom:'mountain',left:'mountain'},rotation:0,hasRoad:false,features:[]};
  assert.equal(engine.isValidPlacement(board,mismatchTile,0,-1,0),false);
  const matchTile={edges:{top:'mountain',right:'mountain',bottom:'pasture',left:'mountain'},rotation:0,hasRoad:false,features:[]};
  assert.equal(engine.isValidPlacement(board,matchTile,0,-1,0),true);
});

test('Isle of Skye scoort whisky alleen via wegverbinding met het kasteel',()=>{
  const board=new Map();
  board.set(engine.getCoordKey(0,0),{tile:{edges:{top:'pasture',right:'pasture',bottom:'pasture',left:'pasture'},rotation:0,hasRoad:true,features:[]},x:0,y:0});
  board.set(engine.getCoordKey(1,0),{tile:{edges:{top:'pasture',right:'pasture',bottom:'pasture',left:'pasture'},rotation:0,hasRoad:true,features:[{type:'whisky',count:2}]},x:1,y:0});
  board.set(engine.getCoordKey(-1,0),{tile:{edges:{top:'pasture',right:'pasture',bottom:'pasture',left:'pasture'},rotation:0,hasRoad:false,features:[{type:'whisky',count:3}]},x:-1,y:0});
  assert.equal(engine.calculateRoundScore(board,'SCORING_WHISKY'),4);
});

test('Isle of Skye scoort vee alleen als het niet naast ander vee ligt',()=>{
  const board=new Map();
  board.set(engine.getCoordKey(0,0),{tile:{edges:{top:'pasture',right:'pasture',bottom:'pasture',left:'pasture'},rotation:0,hasRoad:false,features:[{type:'cattle',count:1}]},x:0,y:0});
  board.set(engine.getCoordKey(1,0),{tile:{edges:{top:'pasture',right:'pasture',bottom:'pasture',left:'pasture'},rotation:0,hasRoad:false,features:[{type:'cattle',count:1}]},x:1,y:0});
  board.set(engine.getCoordKey(5,5),{tile:{edges:{top:'pasture',right:'pasture',bottom:'pasture',left:'pasture'},rotation:0,hasRoad:false,features:[{type:'cattle',count:2}]},x:5,y:5});
  assert.equal(engine.calculateRoundScore(board,'SCORING_CATTLE'),2);
});

test('Isle of Skye scoort een gesloten wateroppervlak met schip',()=>{
  const board=new Map();
  board.set(engine.getCoordKey(0,0),{tile:{edges:{top:'mountain',right:'water',bottom:'mountain',left:'mountain'},rotation:0,hasRoad:false,features:[{type:'ship',count:1}]},x:0,y:0});
  board.set(engine.getCoordKey(1,0),{tile:{edges:{top:'mountain',right:'mountain',bottom:'mountain',left:'water'},rotation:0,hasRoad:false,features:[]},x:1,y:0});
  assert.equal(engine.calculateRoundScore(board,'SCORING_SHIPS'),5);
});

test('Isle of Skye telt een open wateroppervlak niet',()=>{
  const board=new Map();
  board.set(engine.getCoordKey(0,0),{tile:{edges:{top:'water',right:'mountain',bottom:'mountain',left:'mountain'},rotation:0,hasRoad:false,features:[{type:'ship',count:1}]},x:0,y:0});
  assert.equal(engine.calculateRoundScore(board,'SCORING_SHIPS'),0);
});

test('Isle of Skye start met kasteel, goud en markt van spelers+1 tegels',()=>{
  const game=gameModule.createGame(humans(3));
  assert.equal(game.players.length,3);
  assert.ok(game.players.every(player=>player.gold===10));
  assert.ok(game.players.every(player=>player.board.size===1));
  assert.equal(game.market.length,4);
  assert.equal(game.scoringCategories.length,3);
  assert.equal(game.phase,'price');
});

test('Isle of Skye valideert prijzen en verkoopregels',()=>{
  const game=gameModule.createGame(humans(2));
  const seller=game.players.find(player=>player.id===game.sellerId);
  const other=game.players.find(player=>player.id!==seller.id);
  assert.throws(()=>gameModule.handleAction(game,other.id,'setPrices',{prices:[0,0,0]}));
  assert.throws(()=>gameModule.handleAction(game,seller.id,'setPrices',{prices:[0,0]}));
  gameModule.handleAction(game,seller.id,'setPrices',{prices:[1,2,0]});
  assert.equal(game.phase,'buy');
  const state=gameModule.serialize(game,other.id,new Map());
  assert.equal(state.canBuy,true);
});

for(const count of [2,3,4])test(`Isle of Skye: ${count} NPC's spelen een volledige match uit`,()=>{
  const game=gameModule.createGame(npcs(count));
  let steps=0;
  while(!game.gameOver&&steps<2000){
    game.nextNpcAt=1;
    gameModule.tick(game,Date.now());
    steps++;
  }
  assert.equal(game.gameOver,true,`niet klaar na ${steps} stappen, fase ${game.phase}`);
  assert.ok(game.players.every(player=>Number.isFinite(player.score)));
  assert.ok(game.winnerIds.length>=1);
  const results=gameModule.results(game);
  assert.equal(results.length,count);
});
