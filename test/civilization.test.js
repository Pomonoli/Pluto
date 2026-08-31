const test=require('node:test');
const assert=require('node:assert/strict');
const civilization=require('../games/civilization/server');

const players=(npc=false)=>[
  {id:'a',name:'Ada',isNpc:false},
  {id:'b',name:'Bot',isNpc:npc}
];

function buildFirstAffordable(game,playerId){
  const p=game.players[playerId];
  const idx=p.hand.findIndex((card)=>card.cost<=p.gold);
  civilization.handleAction(game,playerId,'build',{handIndex:idx});
  return idx;
}

test('Age of Civilization start met twee geheime handen en 21 beurten',()=>{
  const game=civilization.createGame(players());
  const view=civilization.serialize(game,'a',new Map([['a',true],['b',true]]));
  assert.equal(view.kind,'civilization');
  assert.equal(view.players.length,2);
  assert.equal(view.yourHand.length,3);
  assert.equal(view.totalTurns,21);
  assert.equal(view.turnInAge,1);
  assert.equal(view.players.some((player)=>Object.hasOwn(player,'hand')),false);
  assert.equal(view.players.some((player)=>Object.hasOwn(player,'vp')),false);
});

test('bouwen en weggooien blijven in draft totdat de derde beurt de aanval verwerkt',()=>{
  const game=civilization.createGame(players());
  buildFirstAffordable(game,'a');
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.phase,'draft');
  assert.equal(game.turnInAge,2);
  assert.ok(game.players.a.grid.some(Boolean));

  civilization.handleAction(game,'a','discard',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.phase,'draft');
  assert.equal(game.turnInAge,3);

  civilization.handleAction(game,'a','discard',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.phase,'wave');
  assert.ok(game.waveResult);
  assert.ok(Object.hasOwn(game.waveResult.results.a,'attack'));
  assert.ok(Object.hasOwn(game.waveResult.results.a,'defence'));
});

test('upgraden schaalt stats met 1,5x, behalve de uitzondering dat 1 altijd 2 wordt',()=>{
  const game=civilization.createGame(players());
  const p=game.players.a;
  const idx=buildFirstAffordable(game,'a');
  const tile=p.grid.find(Boolean);
  const before={attack:tile.attack,defence:tile.defence,income:tile.income};
  p.gold=99;
  civilization.handleAction(game,'b','discard',{handIndex:0});
  civilization.handleAction(game,'a','upgrade',{slot:p.grid.indexOf(tile)});
  if(before.attack)assert.equal(tile.attack,before.attack===1?2:Math.floor(before.attack*1.5));
  if(before.defence)assert.equal(tile.defence,before.defence===1?2:Math.floor(before.defence*1.5));
  if(before.income)assert.equal(tile.income,before.income===1?2:Math.floor(before.income*1.5));
  assert.equal(tile.level,2);
});

test('gebouwen zijn uniek: dezelfde kaart wordt niet opnieuw aangeboden in hetzelfde tijdperk',()=>{
  const game=civilization.createGame(players());
  const p=game.players.a;
  p.hand[0]={type:'attack',name:'Sharpened Spear',cost:2,attack:4,defence:0,income:0};
  civilization.handleAction(game,'a','build',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.turnInAge,2);
  assert.equal(p.hand.some((card)=>card.type==='attack'),false);
});

test('Age of Civilization NPC kiest zelfstandig een actie',()=>{
  const game=civilization.createGame(players(true));
  assert.equal(civilization.tick(game,Date.now()),true);
  assert.equal(game.players.b.acted,true);
});

test('een ingestorte toren bepaalt ook het opgeslagen wedstrijdresultaat',()=>{
  const game=civilization.createGame(players());
  game.players.a.hp=1;
  game.players.b.hand[0]={type:'attack',name:'Sharpened Spear',cost:2,attack:4,defence:0,income:0};
  civilization.handleAction(game,'b','build',{handIndex:0});
  civilization.handleAction(game,'a','discard',{handIndex:0});
  civilization.handleAction(game,'a','discard',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  civilization.handleAction(game,'a','discard',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.gameOver,true);
  assert.equal(game.winnerId,'b');
  const result=civilization.results(game,1000);
  assert.equal(result.find((row)=>row.playerId==='b').won,true);
});

test('overleven beide torens alle tijdperken, dan wint het meeste goud',()=>{
  const game=civilization.createGame(players());
  game.age=7;
  game.turnInAge=3;
  game.players.a.gold=50;
  game.players.b.gold=10;
  civilization.handleAction(game,'a','discard',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.phase,'wave');
  assert.equal(game.gameOver,false);
  civilization.tick(game,game.waveShownUntil+1);
  assert.equal(game.gameOver,true);
  assert.equal(game.endedSuddenDeath,false);
  assert.equal(game.winnerId,'a');
  assert.equal(game.finalScores.a,game.players.a.gold);
});
