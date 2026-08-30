const test=require('node:test');
const assert=require('node:assert/strict');
const carcassonne=require('../games/carcassonne/server');

function tileOfType(type){
  const game=carcassonne.createGame([{id:'a',name:'A'},{id:'b',name:'B'}]);
  return [game.currentTile,...game.deck].find(tile=>tile?.type===type);
}

test('Carcassonne T-punten en kruispunten bestaan uit aparte wegen',()=>{
  const roadT=tileOfType('roadT');
  const roadCross=tileOfType('roadCross');
  assert.ok(roadT);
  assert.ok(roadCross);
  assert.deepEqual(roadT.roads,[[1],[2],[3]]);
  assert.deepEqual(roadCross.roads,[[0],[1],[2],[3]]);
});

test('Carcassonne weg eindigt correct aan een T-punt',()=>{
  const roadT=tileOfType('roadT');
  const roadEnd=carcassonne.rotateTile(tileOfType('roadEnd'),3);
  const game={board:new Map([
    ['0,0',{x:0,y:0,tile:roadT}],
    ['1,0',{x:1,y:0,tile:roadEnd}]
  ])};
  const feature=carcassonne.feature(game,0,0,'road',0);
  assert.equal(feature.complete,true);
  assert.equal(feature.tileKeys.length,2);
});
