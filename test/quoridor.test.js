const test=require('node:test');
const assert=require('node:assert/strict');
const quoridor=require('../games/quoridor/server');

function players(count=2){
  return Array.from({length:count},(_,index)=>({id:String.fromCharCode(97+index),name:String.fromCharCode(65+index),isNpc:false}));
}

test('Quoridor start op een 9x9-bord met correcte muren',()=>{
  const game=quoridor.createGame(players(2));
  assert.equal(game.boardSize,9);
  assert.deepEqual(game.players.map(player=>[player.row,player.col,player.walls]),[[8,4,10],[0,4,10]]);
});

test('Quoridor laat springen en schuin passeren toe',()=>{
  const game=quoridor.createGame(players(2));
  game.players[0].row=5;game.players[0].col=4;
  game.players[1].row=4;game.players[1].col=4;
  let moves=quoridor.legalMoves(game,game.players[0]);
  assert.ok(moves.some(move=>move.row===3&&move.col===4));
  game.walls=[{row:3,col:4,orientation:'h'}];
  moves=quoridor.legalMoves(game,game.players[0]);
  assert.ok(!moves.some(move=>move.row===3&&move.col===4));
  assert.ok(moves.some(move=>move.row===4&&move.col===3));
  assert.ok(moves.some(move=>move.row===4&&move.col===5));
});

test('Quoridor weigert een muur die de laatste route afsluit',()=>{
  const game=quoridor.createGame(players(2));
  game.walls=[{row:7,col:4,orientation:'h'},{row:7,col:3,orientation:'v'}];
  assert.equal(quoridor.hasPath(game,game.players[0],game.walls),true);
  assert.equal(quoridor.isValidWall(game,{row:7,col:5,orientation:'v'}),false);
});

test('Quoridor eindigt zodra een pion de overkant bereikt',()=>{
  const game=quoridor.createGame(players(2));
  game.players[0].row=1;game.players[0].col=3;
  game.turnIndex=0;
  quoridor.handleAction(game,'a','move',{row:0,col:3});
  assert.equal(game.gameOver,true);
  assert.equal(game.winnerId,'a');
});

test('Quoridor NPC speelt zelfstandig een geldige beurt',()=>{
  const game=quoridor.createGame([players(2)[0],{...players(2)[1],isNpc:true}]);
  game.turnIndex=1;
  game.players[1].walls=0;
  const before={row:game.players[1].row,col:game.players[1].col};
  game.nextNpcAt=1;
  assert.equal(quoridor.tick(game,Date.now()),true);
  assert.equal(game.turnIndex,0);
  assert.notDeepEqual({row:game.players[1].row,col:game.players[1].col},before);
});
