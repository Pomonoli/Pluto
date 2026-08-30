const test=require('node:test');
const assert=require('node:assert/strict');
const santorini=require('../games/santorini/server');

function players(count){
  return Array.from({length:count},(_,index)=>({id:`p${index}`,name:`P${index+1}`,isNpc:false}));
}
function connected(count){return new Map(players(count).map(player=>[player.id,true]))}
function placeAll(game){
  const positions=[[0,0],[4,4],[0,4],[4,0],[1,0],[3,4]];
  let cursor=0;
  while(game.phase==='setup'){
    const player=game.players[game.turnIndex];
    santorini.handleAction(game,player.id,'place',{row:positions[cursor][0],col:positions[cursor][1]});
    cursor++;
  }
}

test('Santorini geeft 2 workers bij 2-3 spelers en 1 bij 4 spelers',()=>{
  assert.equal(santorini.createGame(players(2)).workersPerPlayer,2);
  assert.equal(santorini.createGame(players(3)).workersPerPlayer,2);
  assert.equal(santorini.createGame(players(4)).workersPerPlayer,1);
});

test('setup plaatst workers beurtelings en start daarna de move-fase',()=>{
  const game=santorini.createGame(players(2));
  placeAll(game);
  assert.equal(game.phase,'move');
  assert.equal(game.workers.filter(worker=>worker.row!==null).length,4);
  assert.equal(game.turnIndex,0);
});

test('een worker mag maximaal één niveau omhoog',()=>{
  const game=santorini.createGame(players(2));
  placeAll(game);
  const worker=game.workers.find(item=>item.ownerId==='p0');
  worker.row=2;worker.col=2;
  game.board[2*5+3]=2;
  assert.equal(santorini.legalMoves(game,worker).some(pos=>pos.row===2&&pos.col===3),false);
  game.board[2*5+3]=1;
  assert.equal(santorini.legalMoves(game,worker).some(pos=>pos.row===2&&pos.col===3),true);
});

test('na verplaatsen bouwt dezelfde speler één niveau',()=>{
  const game=santorini.createGame(players(2));
  placeAll(game);
  const worker=game.workers.find(item=>item.ownerId==='p0');
  worker.row=2;worker.col=2;
  santorini.handleAction(game,'p0','move',{workerId:worker.id,row:2,col:3});
  assert.equal(game.phase,'build');
  santorini.handleAction(game,'p0','build',{row:2,col:2});
  assert.equal(game.board[2*5+2],1);
  assert.equal(game.phase,'move');
  assert.equal(game.turnIndex,1);
});

test('niveau 3 bereiken wint onmiddellijk',()=>{
  const game=santorini.createGame(players(2));
  placeAll(game);
  const worker=game.workers.find(item=>item.ownerId==='p0');
  worker.row=2;worker.col=2;
  game.board[2*5+2]=2;
  game.board[2*5+3]=3;
  santorini.handleAction(game,'p0','move',{workerId:worker.id,row:2,col:3});
  assert.equal(game.gameOver,true);
  assert.equal(game.winnerId,'p0');
  assert.match(game.resultText,/niveau 3/i);
});

test('serialize toont 5x5 bord en juiste actie voor de huidige speler',()=>{
  const game=santorini.createGame(players(4));
  for(const [row,col] of [[0,0],[0,4],[4,4],[4,0]]){
    const player=game.players[game.turnIndex];
    santorini.handleAction(game,player.id,'place',{row,col});
  }
  const view=santorini.serialize(game,'p0',connected(4));
  assert.equal(view.board.length,25);
  assert.equal(view.canMove,true);
  assert.equal(view.workers.length,4);
});
