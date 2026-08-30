const test=require('node:test');
const assert=require('node:assert/strict');
const civilization=require('../games/civilization/server');

const players=(npc=false)=>[
  {id:'a',name:'Ada',isNpc:false},
  {id:'b',name:'Bot',isNpc:npc}
];

test('Age of Civilization start met twee geheime handen',()=>{
  const game=civilization.createGame(players());
  const view=civilization.serialize(game,'a',new Map([['a',true],['b',true]]));
  assert.equal(view.kind,'civilization');
  assert.equal(view.players.length,2);
  assert.equal(view.yourHand.length,3);
  assert.equal(view.players.some((player)=>Object.hasOwn(player,'hand')),false);
});

test('bouwen en weggooien verwerken daarna de aanval',()=>{
  const game=civilization.createGame(players());
  const affordableIndex=game.players.a.hand.findIndex((card)=>card.cost<=game.players.a.gold);
  civilization.handleAction(game,'a','build',{handIndex:affordableIndex});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.phase,'wave');
  assert.ok(game.players.a.grid.some(Boolean));
  assert.ok(game.waveResult);
});

test('Age of Civilization NPC kiest zelfstandig een kaart',()=>{
  const game=civilization.createGame(players(true));
  assert.equal(civilization.tick(game,Date.now()),true);
  assert.equal(game.players.b.acted,true);
});

test('een ingestorte toren bepaalt ook het opgeslagen wedstrijdresultaat',()=>{
  const game=civilization.createGame(players());
  game.players.a.hp=1;
  civilization.handleAction(game,'a','discard',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.gameOver,true);
  assert.equal(game.winnerId,'b');
  const result=civilization.results(game,1000);
  assert.equal(result.find((row)=>row.playerId==='b').won,true);
});
