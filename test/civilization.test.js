const test=require('node:test');
const assert=require('node:assert/strict');
const civilization=require('../games/civilization/server');

const players=(npc=false)=>[
  {id:'a',name:'Ada',isNpc:false},
  {id:'b',name:'Bot',isNpc:npc}
];

// Leaders that don't skew build costs or base stats, safe defaults for
// tests that aren't specifically about leader bonuses.
function pickLeaders(game,keys=['lincoln','gandhi']){
  keys.forEach((key,i)=>civilization.handleAction(game,game.order[i],'pickLeader',{leaderKey:key}));
}

function buildFirstAffordable(game,playerId){
  const p=game.players[playerId];
  const idx=p.hand.findIndex((card)=>card.cost<=p.gold);
  civilization.handleAction(game,playerId,'build',{handIndex:idx});
  return idx;
}

test('nieuw spel start in de leiderskeuzefase',()=>{
  const game=civilization.createGame(players());
  assert.equal(game.phase,'picking');
  const view=civilization.serialize(game,'a',new Map([['a',true],['b',true]]));
  assert.equal(view.phase,'picking');
  assert.equal(view.leaders.length,7);
  assert.equal(view.pickerId,'a');
  assert.equal(view.isYourPick,true);
});

test('leiders kiezen: op volgorde, uniek, en spel start pas als iedereen gekozen heeft',()=>{
  const game=civilization.createGame(players());
  assert.throws(()=>civilization.handleAction(game,'b','pickLeader',{leaderKey:'alexander'}),/beurt/);
  civilization.handleAction(game,'a','pickLeader',{leaderKey:'alexander'});
  assert.throws(()=>civilization.handleAction(game,'b','pickLeader',{leaderKey:'alexander'}),/al gekozen/);
  assert.equal(game.phase,'picking');
  civilization.handleAction(game,'b','pickLeader',{leaderKey:'bismarck'});
  assert.equal(game.phase,'draft');
  assert.equal(game.players.a.leaderKey,'alexander');
  assert.equal(game.players.b.leaderKey,'bismarck');
});

test('NPC kiest zelfstandig een leider tijdens de leiderskeuzefase',()=>{
  const game=civilization.createGame(players(true));
  assert.equal(civilization.tick(game,Date.now()),false); // waiting on human 'a'
  civilization.handleAction(game,'a','pickLeader',{leaderKey:'cleopatra'});
  assert.equal(civilization.tick(game,Date.now()),true);
  assert.ok(game.players.b.leaderKey);
  assert.notEqual(game.players.b.leaderKey,'cleopatra');
  assert.equal(game.phase,'draft');
});

test('Age of Civilization start met twee geheime handen, 21 beurten en drie vaste gebouwen',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
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
  pickLeaders(game);
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

test('civiele gebouwen zijn altijd upgradebaar (geen tijdperk-limiet)',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
  const p=game.players.a;
  p.gold=999;
  civilization.handleAction(game,'a','upgrade',{civic:'science'});
  assert.equal(p.civic.science.upgradeCount,1);
  civilization.handleAction(game,'b','discard',{handIndex:0});
  // still Age 1, but civic upgrades are never blocked by the Age
  civilization.handleAction(game,'a','upgrade',{civic:'science'});
  assert.equal(p.civic.science.upgradeCount,2);
});

test('vrije gebouwen kunnen pas het volgende tijdperk upgraden, en krijgen dan +25% van hun basiswaarde',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
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
  const upgradeCostAtAge2=Math.round((2+1)*1.75); // flexible upgrade cost = fresh build cost at current age, x1.75
  civilization.handleAction(game,'a','upgrade',{slot});
  assert.equal(goldBefore-p.gold,upgradeCostAtAge2);
  const view=civilization.serialize(game,'a',new Map([['a',true],['b',true]]));
  const tile=view.players.find((player)=>player.isYou).grid[slot];
  assert.equal(tile.level,2);
  assert.equal(tile.attack,Math.round(baseAttack*1.25));
});

test('een vast gebouw upgraden doet niets tot de derde upgrade, die een duurdere stapelbare gebeurtenis ontketent',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
  const p=game.players.a;
  p.gold=999;
  game.age=3;

  civilization.handleAction(game,'a','upgrade',{civic:'science'});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(p.civic.science.upgradeCount,1);
  assert.equal(p.eventMultipliers.attack,1);

  const goldBeforeStep2=p.gold;
  civilization.handleAction(game,'a','upgrade',{civic:'science'});
  const step2Cost=goldBeforeStep2-p.gold;
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(p.civic.science.upgradeCount,2);
  assert.equal(p.eventMultipliers.attack,1);

  const goldBeforeStep3=p.gold;
  civilization.handleAction(game,'a','upgrade',{civic:'science'});
  const step3Cost=goldBeforeStep3-p.gold;
  assert.equal(p.civic.science.upgradeCount,3);
  assert.equal(p.civic.science.eventsFired,1);
  assert.equal(step3Cost,step2Cost*2); // the event step costs 2x a normal step
  assert.ok(Math.abs(p.eventMultipliers.attack-1.3)<1e-9);
  assert.ok(Math.abs(p.eventMultipliers.income-1.2)<1e-9);
  assert.ok(Math.abs(p.eventMultipliers.defence-1.1)<1e-9);
});

test('gebouwen zijn uniek: dezelfde kaart wordt niet opnieuw aangeboden in hetzelfde tijdperk',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
  const p=game.players.a;
  p.hand[0]={type:'attack',name:'Sharpened Spear',cost:2,attack:4,defence:0,income:0};
  civilization.handleAction(game,'a','build',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.turnInAge,2);
  assert.equal(p.hand.some((card)=>card.type==='attack'),false);
});

test('Age of Civilization NPC kiest zelfstandig een actie',()=>{
  const game=civilization.createGame(players(true));
  pickLeaders(game);
  assert.equal(civilization.tick(game,Date.now()),true);
  assert.equal(game.players.b.acted,true);
});

test('een ingestorte toren bepaalt ook het opgeslagen wedstrijdresultaat',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
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
  pickLeaders(game);
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
  pickLeaders(game);
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

test('4 spelers vechten in een kloksgewijze ring: een tussentijdse dood eindigt het spel niet meteen',()=>{
  const four=[
    {id:'a',name:'A',isNpc:false},{id:'b',name:'B',isNpc:false},
    {id:'c',name:'C',isNpc:false},{id:'d',name:'D',isNpc:false}
  ];
  const game=civilization.createGame(four);
  pickLeaders(game,['lincoln','gandhi','bismarck','einstein']);
  // b attacks c (clockwise a->b->c->d->a); give b a lethal attack vs c's 100 hp
  game.players.b.hand[0]={type:'attack',name:'Sharpened Spear',cost:2,attack:150,defence:0,income:0};
  civilization.handleAction(game,'b','build',{handIndex:0});
  ['a','c','d'].forEach((id)=>civilization.handleAction(game,id,'discard',{handIndex:0}));
  ['a','b','c','d'].forEach((id)=>civilization.handleAction(game,id,'discard',{handIndex:0}));
  ['a','b','c','d'].forEach((id)=>civilization.handleAction(game,id,'discard',{handIndex:0}));
  assert.equal(game.phase,'wave');
  assert.equal(game.players.c.hp,0);
  assert.equal(game.gameOver,false); // 3 of 4 still alive, match continues
  assert.equal(game.players.a.hp,100);
  assert.equal(game.players.b.hp,100);
  assert.equal(game.players.d.hp,100);
});
