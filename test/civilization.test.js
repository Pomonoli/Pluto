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

test('Age of Civilization start met twee geheime handen, 21 beurten en drie vaste gebouwen',()=>{
  const game=civilization.createGame(players());
  const view=civilization.serialize(game,'a',new Map([['a',true],['b',true]]));
  assert.equal(view.kind,'civilization');
  assert.equal(view.players.length,2);
  assert.equal(view.yourHand.length,3);
  assert.equal(view.totalTurns,21);
  assert.equal(view.turnInAge,1);
  assert.equal(view.players.some((player)=>Object.hasOwn(player,'hand')),false);
  assert.equal(view.players.some((player)=>Object.hasOwn(player,'vp')),false);
  const you=view.players.find((player)=>player.isYou);
  assert.equal(you.grid.length,6);
  assert.equal(you.civic.science.upgradeCount,0);
  assert.equal(you.civic.religion.upgradeCount,0);
  assert.equal(you.civic.culture.upgradeCount,0);
  assert.ok(view.yourHand.every((card)=>['attack','defence','economy','wonder'].includes(card.type)));
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

test('vrije gebouwen kunnen pas het volgende tijdperk upgraden, en krijgen dan +25% van hun basiswaarde',()=>{
  const game=civilization.createGame(players());
  const p=game.players.a;
  const attackIdx=p.hand.findIndex((card)=>card.type==='attack');
  const baseAttack=p.hand[attackIdx].attack;
  civilization.handleAction(game,'a','build',{handIndex:attackIdx});
  const slot=p.grid.findIndex(Boolean);

  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.age,1);
  assert.throws(()=>civilization.handleAction(game,'a','upgrade',{slot}),/tijdperk/);

  civilization.handleAction(game,'a','discard',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  civilization.handleAction(game,'a','discard',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.phase,'wave');
  civilization.tick(game,game.waveShownUntil+1);
  assert.equal(game.age,2);
  assert.equal(game.phase,'draft');

  p.gold=999;
  const goldBefore=p.gold;
  const upgradeCostAtAge2=(2+1)*2; // flexible upgrade cost = fresh build cost at current age, x2
  civilization.handleAction(game,'a','upgrade',{slot});
  assert.equal(goldBefore-p.gold,upgradeCostAtAge2);
  const view=civilization.serialize(game,'a',new Map([['a',true],['b',true]]));
  const tile=view.players.find((player)=>player.isYou).grid[slot];
  assert.equal(tile.level,2);
  assert.equal(tile.attack,Math.round(baseAttack*1.25));
});

test('een vast gebouw upgraden doet niets tot de derde upgrade, die een stapelbare gebeurtenis ontketent',()=>{
  const game=civilization.createGame(players());
  const p=game.players.a;
  p.gold=999;
  game.age=3;

  civilization.handleAction(game,'a','upgrade',{civic:'science'});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(p.civic.science.upgradeCount,1);
  assert.equal(p.eventMultipliers.attack,1);

  civilization.handleAction(game,'a','upgrade',{civic:'science'});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(p.civic.science.upgradeCount,2);
  assert.equal(p.eventMultipliers.attack,1);

  civilization.handleAction(game,'a','upgrade',{civic:'science'});
  assert.equal(p.civic.science.upgradeCount,3);
  assert.equal(p.civic.science.eventsFired,1);
  assert.ok(Math.abs(p.eventMultipliers.attack-1.3)<1e-9);
  assert.ok(Math.abs(p.eventMultipliers.income-1.2)<1e-9);
  assert.ok(Math.abs(p.eventMultipliers.defence-1.1)<1e-9);
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

test('overleven beide torens alle tijdperken, dan wint de meeste levenspunten (goud telt niet mee)',()=>{
  const game=civilization.createGame(players());
  game.age=7;
  game.turnInAge=3;
  game.players.a.hp=80;
  game.players.b.hp=40;
  game.players.a.gold=10;
  game.players.b.gold=999;
  civilization.handleAction(game,'a','discard',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.phase,'wave');
  assert.equal(game.gameOver,false);
  civilization.tick(game,game.waveShownUntil+1);
  assert.equal(game.gameOver,true);
  assert.equal(game.endedSuddenDeath,false);
  assert.equal(game.winnerId,'a');
  const result=civilization.results(game,1000);
  assert.equal(result.find((row)=>row.playerId==='a').won,true);
  assert.equal(result.find((row)=>row.playerId==='b').won,false);
});

test('bij gelijke levenspunten na alle tijdperken beslist het goud',()=>{
  const game=civilization.createGame(players());
  game.age=7;
  game.turnInAge=3;
  game.players.a.hp=60;
  game.players.b.hp=60;
  game.players.a.gold=50;
  game.players.b.gold=10;
  civilization.handleAction(game,'a','discard',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  civilization.tick(game,game.waveShownUntil+1);
  assert.equal(game.gameOver,true);
  assert.equal(game.winnerId,'a');
  assert.equal(game.finalScores.a,game.players.a.gold);
});
