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
  assert.equal(view.leaders.length,8);
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
  const before=structuredClone(game);
  assert.equal(civilization.tick(game,Date.now()+86400000),false); // still waiting on human 'a'
  assert.deepEqual(game,before);
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
  assert.equal(you.civic.science.used,false);
  assert.equal(you.civic.religion.used,false);
  assert.equal(you.civic.culture.used,false);
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

test('civiele gebouwen zijn niet aan een tijdperk-limiet gebonden',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
  const p=game.players.a;
  p.gold=999;
  // still Age 1, but civic buildings can be designated regardless of Age
  civilization.handleAction(game,'a','upgrade',{civic:'science'});
  assert.equal(p.civic.science.used,true);
});

test('vrije gebouwen kunnen pas het volgende tijdperk upgraden, en krijgen dan x1.5 van hun basiswaarde per niveau',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
  const p=game.players.a;
  // Injected directly (rather than drawn) so the test doesn't depend on
  // which of the two Attack variants a random hand happens to deal.
  const baseAttack=4;
  p.hand[0]={type:'attack',name:'Test Spear',variantIndex:0,cost:2,attack:baseAttack,defence:0,income:0};
  civilization.handleAction(game,'a','build',{handIndex:0});
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
  assert.equal(tile.attack,Math.round(baseAttack*1.5)); // level 2 = base * 1.5^(2-1)
  assert.equal(tile.nextAttack,Math.round(baseAttack*2.25)); // level 3 = base * 1.5^(3-1)
  assert.equal(tile.nextDefence,0);
  assert.equal(tile.nextIncome,0);
});

test('een vast gebouw aanduiden ontketent meteen zijn gebeurtenis, en kan daarna nooit meer',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
  const p=game.players.a;
  p.gold=999;
  game.age=3;

  const goldBefore=p.gold;
  civilization.handleAction(game,'a','upgrade',{civic:'science'});
  const cost=goldBefore-p.gold;
  assert.equal(cost,Math.round((3+1)*2.5)*2); // one-time cost: base civic price x2
  assert.equal(p.civic.science.used,true);

  const view=civilization.serialize(game,'a',new Map([['a',true],['b',true]]));
  assert.equal(view.players.find((player)=>player.isYou).civic.science.maxed,true);

  // Designating it again — even in a later Age — is blocked forever.
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.throws(()=>civilization.handleAction(game,'a','upgrade',{civic:'science'}),/al aangeduid/);
});

test('een vast gebouw geeft een eenmalige vlakke bonus (Tijdperk x 10% van je huidige stat), die daarna permanent blijft staan',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
  const p=game.players.a;
  p.gold=999;
  game.age=4;

  p.hand[0]={type:'attack',name:'Test Spear',cost:2,attack:10,defence:0,income:0};
  civilization.handleAction(game,'a','build',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  const before=civilization.serialize(game,'a',new Map([['a',true],['b',true]])).players.find((pl)=>pl.isYou);
  assert.equal(before.attack,10);

  // Age 4 => 40% of the current 10 Attack = +4, applied once as a permanent flat bonus.
  civilization.handleAction(game,'a','upgrade',{civic:'science'});
  const afterEvent=civilization.serialize(game,'a',new Map([['a',true],['b',true]])).players.find((pl)=>pl.isYou);
  assert.equal(afterEvent.attack,14);

  // Building more Attack afterwards doesn't get re-multiplied — the +4 stays frozen.
  civilization.handleAction(game,'b','discard',{handIndex:0});
  p.hand[0]={type:'attack',name:'Test Spear 2',cost:2,attack:6,defence:0,income:0};
  civilization.handleAction(game,'a','build',{handIndex:0});
  const afterMoreBuilding=civilization.serialize(game,'a',new Map([['a',true],['b',true]])).players.find((pl)=>pl.isYou);
  assert.equal(afterMoreBuilding.attack,20); // 10+6 base, plus the frozen +4
});

test('gebouwen zijn uniek: dezelfde kaart wordt niet opnieuw aangeboden in hetzelfde tijdperk',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
  const p=game.players.a;
  p.hand[0]={type:'attack',name:'Sharpened Spear',variantIndex:0,cost:2,attack:4,defence:0,income:0};
  civilization.handleAction(game,'a','build',{handIndex:0});
  civilization.handleAction(game,'b','discard',{handIndex:0});
  assert.equal(game.turnInAge,2);
  // The sibling Attack variant ("Bone-tipped Arrow") can still legitimately
  // appear — only this exact, already-built card is barred from the pool.
  assert.equal(p.hand.some((card)=>card.name==='Sharpened Spear'),false);
});

test('elke categorie heeft twee varianten, en een gebouwde tegel blijft zijn eigen variant volgen bij upgraden',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
  const p=game.players.a;
  p.hand[0]={type:'attack',name:'Bone-tipped Arrow',variantIndex:1,cost:2,attack:4,defence:0,income:0};
  civilization.handleAction(game,'a','build',{handIndex:0});
  const slot=p.grid.findIndex(Boolean);
  assert.equal(p.grid[slot].variantIndex,1);
  civilization.handleAction(game,'b','discard',{handIndex:0});

  for(let round=0;round<2;round++){
    civilization.handleAction(game,'a','discard',{handIndex:0});
    civilization.handleAction(game,'b','discard',{handIndex:0});
  }
  assert.equal(game.phase,'wave');
  civilization.tick(game,game.waveShownUntil+1);
  assert.equal(game.age,2);

  p.gold=999;
  civilization.handleAction(game,'a','upgrade',{slot});
  assert.equal(p.grid[slot].level,2);
  // Age-2 name of variant 1 ("Ballista Corps"), never variant 0's
  // ("Phalanx Legion") even though the tile is now built in a fresh Age.
  assert.equal(p.grid[slot].name,'Ballista Corps');
});

test('Age of Civilization NPC kiest zelfstandig een actie',()=>{
  const game=civilization.createGame(players(true));
  pickLeaders(game);
  assert.equal(civilization.tick(game,Date.now()),true);
  assert.equal(game.players.b.acted,true);
});

test('human draft wacht onbeperkt zonder automatische acties of deadline',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
  const before=structuredClone(game);
  const now=Date.now();
  for(const elapsed of [40001,120000,86400000]){
    assert.equal(civilization.tick(game,now+elapsed),false);
    assert.deepEqual(game,before);
  }
  const view=civilization.serialize(game,'a',new Map([['a',false],['b',true]]));
  assert.equal(view.deadline,null);
  assert.equal(view.yourHand.length,game.players.a.hand.length);
  assert.equal(view.players.find(p=>p.id==='a').acted,false);
});

for(const action of ['build','discard','upgrade']){
  test(`een oude deadline overschrijden blokkeert de eigen human-actie ${action} niet`,()=>{
    const game=civilization.createGame(players());
    pickLeaders(game);
    game.players.a.gold=100;
    civilization.handleAction(game,'b','discard',{handIndex:0});
    // Even an existing state with an expired legacy deadline must wait.
    game.turnDeadline=1;
    const before=structuredClone(game);
    assert.equal(civilization.tick(game,Date.now()+86400000),false);
    assert.deepEqual(game,before);
    assert.equal(civilization.serialize(game,'a').deadline,null);

    civilization.handleAction(game,'a',action,action==='upgrade'?{civic:'science'}:{handIndex:0});
    assert.equal(game.phase,'draft');
    assert.equal(game.turnInAge,2);
    if(action==='build') assert.ok(game.players.a.grid.some(Boolean));
    if(action==='discard') assert.equal(game.players.a.gold,103);
    if(action==='upgrade') assert.equal(game.players.a.civic.science.used,true);
  });
}

for(const action of ['build','discard','upgrade']){
  test(`NPC blijft via tick ${action} uitvoeren terwijl human wacht`,()=>{
    const game=civilization.createGame(players(true));
    pickLeaders(game);
    const npc=game.players.b;
    if(action==='discard') npc.gold=0;
    if(action==='upgrade') { npc.hand=[]; npc.gold=100; }
    const humanBefore=structuredClone(game.players.a);
    const now=Date.now()+86400000;
    assert.equal(civilization.tick(game,now),true);
    assert.equal(npc.acted,true);
    assert.deepEqual(game.players.a,humanBefore);
    assert.equal(game.turnInAge,1);
    if(action==='build') assert.ok(npc.grid.some(Boolean));
    if(action==='discard') assert.equal(npc.gold,3);
    if(action==='upgrade') assert.equal(Object.values(npc.civic).filter((c)=>c.used).length,1);
    const afterNpc=structuredClone(game);
    assert.equal(civilization.tick(game,now+86400000),false);
    assert.deepEqual(game,afterNpc);
    civilization.handleAction(game,'a','discard',{handIndex:0});
    assert.equal(game.turnInAge,2);
  });
}

test('laatste NPC-actie voltooit de beurt, maar neemt de volgende human-beurt niet over',()=>{
  const game=civilization.createGame(players(true));
  pickLeaders(game);
  civilization.handleAction(game,'a','discard',{handIndex:0});
  const now=Date.now()+86400000;
  assert.equal(civilization.tick(game,now),true);
  assert.equal(game.turnInAge,2);
  assert.equal(game.players.a.acted,false);
  const humanBefore=structuredClone(game.players.a);
  assert.equal(civilization.tick(game,now+1),true);
  assert.deepEqual(game.players.a,humanBefore);
  const afterNpc=structuredClone(game);
  assert.equal(civilization.tick(game,now+86400000),false);
  assert.deepEqual(game,afterNpc);
});

test('wave-weergave gaat automatisch verder en wacht daarna opnieuw op human input',()=>{
  const game=civilization.createGame(players());
  pickLeaders(game);
  for(let turn=0;turn<3;turn++){
    for(const id of game.order) civilization.handleAction(game,id,'discard',{handIndex:0});
  }
  assert.equal(game.phase,'wave');
  const until=game.waveShownUntil;
  assert.equal(civilization.serialize(game,'a').deadline,until);
  const before=structuredClone(game);
  assert.equal(civilization.tick(game,until-1),false);
  assert.deepEqual(game,before);
  assert.equal(civilization.tick(game,until),true);
  assert.equal(game.phase,'draft');
  assert.equal(game.age,2);
  assert.equal(game.turnInAge,1);
  assert.equal(civilization.serialize(game,'a').deadline,null);
  const nextDraft=structuredClone(game);
  assert.equal(civilization.tick(game,until+86400000),false);
  assert.deepEqual(game,nextDraft);
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
