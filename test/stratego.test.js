const test=require('node:test');
const assert=require('node:assert/strict');
const stratego=require('../games/stratego/server');

const roomPlayers=[
  {id:'a',name:'A',isNpc:false},
  {id:'b',name:'B',isNpc:false}
];
const connected=new Map([['a',true],['b',true]]);

function startedGame(){
  const game=stratego.createGame(roomPlayers);
  stratego.handleAction(game,'a','ready');
  stratego.handleAction(game,'b','ready');
  return game;
}

function addPiece(game,{id,ownerId,type,rank,movable,row,col}){
  const piece={id,ownerId,type,name:type,rank,movable,row,col,alive:true,revealedTo:[ownerId]};
  game.pieces.push(piece);
  return piece;
}

test('Stratego verbergt vijandelijke stukken per speler',()=>{
  const game=stratego.createGame(roomPlayers);
  const viewA=stratego.serialize(game,'a',connected);
  const viewB=stratego.serialize(game,'b',connected);
  assert.ok(viewA.pieces.filter(piece=>piece.ownerId==='b').every(piece=>piece.type===null));
  assert.ok(viewB.pieces.filter(piece=>piece.ownerId==='a').every(piece=>piece.type===null));
});

test('Verkenner schakelt een bom uit',()=>{
  const game=startedGame();
  game.turnIndex=0;
  game.pieces=[];
  addPiece(game,{id:'scout',ownerId:'a',type:'scout',rank:2,movable:true,row:3,col:0});
  addPiece(game,{id:'bomb',ownerId:'b',type:'bomb',rank:0,movable:false,row:2,col:0});
  addPiece(game,{id:'flag',ownerId:'b',type:'flag',rank:-1,movable:false,row:0,col:0});
  addPiece(game,{id:'general',ownerId:'a',type:'general',rank:5,movable:true,row:5,col:5});
  stratego.handleAction(game,'a','move',{pieceId:'scout',row:2,col:0});
  assert.equal(game.pieces.find(piece=>piece.id==='bomb').alive,false);
  assert.equal(game.pieces.find(piece=>piece.id==='scout').alive,true);
});

test('Spion verslaat Generaal wanneer de Spion aanvalt',()=>{
  const game=startedGame();
  game.turnIndex=0;
  game.pieces=[];
  addPiece(game,{id:'spy',ownerId:'a',type:'spy',rank:1,movable:true,row:3,col:0});
  addPiece(game,{id:'enemy-general',ownerId:'b',type:'general',rank:5,movable:true,row:2,col:0});
  addPiece(game,{id:'flag',ownerId:'b',type:'flag',rank:-1,movable:false,row:0,col:0});
  addPiece(game,{id:'general',ownerId:'a',type:'general',rank:5,movable:true,row:5,col:5});
  stratego.handleAction(game,'a','move',{pieceId:'spy',row:2,col:0});
  assert.equal(game.pieces.find(piece=>piece.id==='enemy-general').alive,false);
  assert.equal(game.pieces.find(piece=>piece.id==='spy').alive,true);
});

test('Vlag veroveren beëindigt het spel',()=>{
  const game=startedGame();
  game.turnIndex=0;
  game.pieces=[];
  addPiece(game,{id:'soldier',ownerId:'a',type:'soldier',rank:3,movable:true,row:1,col:0});
  addPiece(game,{id:'flag',ownerId:'b',type:'flag',rank:-1,movable:false,row:0,col:0});
  addPiece(game,{id:'general',ownerId:'a',type:'general',rank:5,movable:true,row:5,col:5});
  stratego.handleAction(game,'a','move',{pieceId:'soldier',row:0,col:0});
  assert.equal(game.gameOver,true);
  assert.equal(game.winnerId,'a');
});
