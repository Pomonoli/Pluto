const test = require('node:test');
const assert = require('node:assert/strict');
const blackjack = require('../games/blackjack/server');
const { handValue } = blackjack;
const solitaire = require('../games/solitaire/server');
const { presidentRank, playableCardIds } = require('../games/presidenten/server');
const { cardPoints } = require('../games/hartenjagen/server');
const carcassonne = require('../games/carcassonne/server');
const { getGame, listGames } = require('../src/games');

test('alle 18 games zijn geregistreerd', () => {
  assert.deepEqual(listGames().map(g => g.key).sort(), ['blackjack','carcassonne','cascadia','civilization','cluedo','hartenjagen','hofslag','isle-of-skye','kingdomino','minigolf','pesten','presidenten','quoridor','santorini','seven-wonders-duel','solitaire','stratego','ticket-to-ride'].sort());
});

test('Blackjack Aas telt als 1 wanneer nodig', () => {
  assert.equal(handValue([{rank:'A'},{rank:'9'},{rank:'5'}]), 15);
  assert.equal(handValue([{rank:'A'},{rank:'K'}]), 21);
});

test('Solitaire trekt maximaal drie kaarten per draw', () => {
  const game=solitaire.createGame([{id:'solo'}]);
  game.stock=[
    {id:'A♣',faceUp:false},
    {id:'2♣',faceUp:false},
    {id:'3♣',faceUp:false},
    {id:'4♣',faceUp:false}
  ];
  game.waste=[];
  solitaire.handleAction(game,'solo','draw');
  assert.equal(game.stock.length,1);
  assert.deepEqual(game.waste.map(card=>card.id),['4♣','3♣','2♣']);
  assert.ok(game.waste.every(card=>card.faceUp));
  solitaire.handleAction(game,'solo','draw');
  assert.equal(game.stock.length,0);
  assert.equal(game.waste.at(-1).id,'A♣');
});

test('Blackjack natural betaalt 3 op 2 en nul chips reset naar 100', () => {
  const natural={id:'a',name:'A',isNpc:false,hand:[{rank:'A'},{rank:'K'}],chips:100,bet:10,betCommitted:true};
  const broke={id:'b',name:'B',isNpc:false,hand:[{rank:'10'},{rank:'8'}],chips:10,bet:10,betCommitted:true};
  const loser={id:'c',name:'C',isNpc:false,hand:[{rank:'10'},{rank:'8'}],chips:100,bet:10,betCommitted:true};
  const game={players:[natural,broke,loser],dealer:{hand:[{rank:'10'},{rank:'Q'}]},pendingChipUpdates:[],log:[],roundNumber:1};
  blackjack.settleFinal(game,1000);
  assert.equal(natural.result,'Blackjack');
  assert.equal(natural.chipDelta,15);
  assert.equal(natural.chips,115);
  assert.equal(broke.chipDelta,-10);
  assert.equal(broke.chips,100);
  assert.equal(broke.resetChips,true);
  assert.equal(loser.chips,90);
  blackjack.tick(game,2000);
  assert.equal(natural.chips,115);
  assert.equal(broke.chips,100);
  assert.equal(loser.chips,90);
});

test('Blackjack Double verdubbelt inzet en geeft exact één kaart', () => {
  const player={id:'a',name:'A',isNpc:false,hand:[{rank:'5'},{rank:'6'}],chips:100,bet:10,doubled:false,status:'playing'};
  const game={players:[player],dealer:{hand:[{rank:'9'},{rank:'7'}]},deck:[{rank:'10'}],phase:'players',turnIndex:0,nextNpcAt:0,log:[]};
  blackjack.handleAction(game,'a','double');
  assert.equal(player.bet,20);
  assert.equal(player.hand.length,3);
  assert.equal(player.status,'stand');
  assert.equal(game.phase,'dealer');
});

test('Blackjack kan twee heren splitsen', () => {
  const player={id:'a',name:'A',isNpc:false,hand:[{rank:'K'},{rank:'K'}],chips:100,bet:10,status:'playing'};
  const game={players:[player],dealer:{hand:[{rank:'10'},{rank:'8'}]},deck:[{rank:'9'},{rank:'Q'}],phase:'players',turnIndex:0,nextNpcAt:0,log:[],lastRoundText:'',pendingChipUpdates:[]};
  blackjack.handleAction(game,'a','split');
  assert.equal(player.hands.length,2);
  assert.deepEqual(player.hands.map(hand=>hand.cards.length),[2,2]);
  assert.deepEqual(player.hands.map(hand=>hand.bet),[10,10]);
});

test('Blackjack wacht na afrekening op Opnieuw', () => {
  const player={id:'a',name:'A',isNpc:false,hand:[{rank:'10'},{rank:'8'}],chips:100,bet:10,betCommitted:true,status:'stand'};
  const game={players:[player],dealer:{hand:[{rank:'10'},{rank:'Q'}]},deck:[],phase:'dealer',turnIndex:-1,nextNpcAt:0,log:[],roundNumber:1,pendingChipUpdates:[]};
  blackjack.settleFinal(game,1000);
  assert.equal(blackjack.tick(game,5000),false);
  assert.equal(game.phase,'round_end');
});

test('Presidenten: 2 is hoger dan Aas', () => {
  assert.ok(presidentRank({rank:'2',value:2}) > presidentRank({rank:'A',value:1}));
});

test('Presidenten markeert alleen voldoende hoge en complete combinaties als speelbaar', () => {
  const player={place:null,hand:[{id:'5♣',rank:'5',value:5},{id:'8♣',rank:'8',value:8},{id:'8♦',rank:'8',value:8},{id:'K♣',rank:'K',value:13}]};
  const game={firstLead:false,lead:{rank:7,count:2}};
  assert.deepEqual(playableCardIds(game,player),['8♣','8♦']);
});

test('Hartenjagen puntentelling', () => {
  assert.equal(cardPoints({id:'5♥',suit:'♥'}), 1);
  assert.equal(cardPoints({id:'Q♠',suit:'♠'}), 13);
  assert.equal(cardPoints({id:'K♣',suit:'♣'}), 0);
});

test('game registry geeft metadata terug', () => {
  assert.equal(getGame('solitaire').meta.maxPlayers, 1);
  assert.equal(getGame('hartenjagen').meta.minPlayers, 4);
});


test('Cluedo valideert een geldige suggestie', () => {
  const { validateTriplet, CATEGORIES } = require('../games/cluedo/server');
  const triplet = validateTriplet({
    suspect: CATEGORIES.suspect[0],
    weapon: CATEGORIES.weapon[0],
    room: CATEGORIES.room[0]
  });
  assert.equal(triplet.suspect, CATEGORIES.suspect[0]);
});

test('Cluedo verdeelt 15 kaarten bij twee spelers als 8 en 7', () => {
  const { createGame } = require('../games/cluedo/server');
  const game=createGame([{id:'a',name:'A'},{id:'b',name:'B'}]);
  assert.deepEqual(game.players.map(player=>player.hand.length).sort((a,b)=>a-b),[7,8]);
});

test('Carcassonne start met 72 landschapstegels en 7 horigen', () => {
  const game=carcassonne.createGame([{id:'a',name:'A'},{id:'b',name:'B'}]);
  assert.equal(game.board.size,1);
  assert.equal(game.deck.length,70);
  assert.ok(game.currentTile);
  assert.deepEqual(game.players.map(player=>player.meeples),[7,7]);
});

test('Carcassonne roteert alle tegelranden met de klok mee', () => {
  const tile={edges:['C','R','F','F'],cities:[[0]],roads:[[1]],rotation:0};
  const rotated=carcassonne.rotateTile(tile,1);
  assert.deepEqual(rotated.edges,['F','C','R','F']);
  assert.deepEqual(rotated.cities,[[1]]);
  assert.deepEqual(rotated.roads,[[2]]);
});

test('Carcassonne doorloopt leggen en horige overslaan', () => {
  const game=carcassonne.createGame([{id:'a',name:'A'},{id:'b',name:'B'}]);
  for(let i=0;i<4&&!game.validPlacements.length;i+=1)carcassonne.handleAction(game,'a','rotate');
  const placement=game.validPlacements[0];
  assert.ok(placement);
  carcassonne.handleAction(game,'a','place',placement);
  assert.equal(game.phase,'meeple');
  carcassonne.handleAction(game,'a','skipMeeple');
  assert.equal(game.turnIndex,1);
  assert.equal(game.board.size,2);
});


test('Minigolf genereert een slimme pool van 20 speelbare maps en kiest 5 unieke', () => {
  const golf = require('../games/minigolf/server');
  const pool = golf.buildSmartPool(20);
  assert.equal(pool.length, 20);
  assert.equal(new Set(pool.map(h => h.id)).size, 20);
  assert.ok(pool.every(h => golf.validateMapPlayability(h).ok));
  assert.ok(new Set(pool.map(h => h.theme)).size >= 8);
  const game = golf.createGame([{id:'a',name:'A',isNpc:false},{id:'b',name:'B',isNpc:true}]);
  assert.equal(game.course.length, 5);
  assert.equal(new Set(game.course.map(h => h.id)).size, 5);
  assert.equal(game.phase, 'playing');
  assert.equal(game.players.every(p => p.placed === false), true);
});

test('Minigolf punten gebruiken dense ranking en ex aequo', () => {
  const { scoreHole } = require('../games/minigolf/server');
  const scored = scoreHole([
    {id:'a',potted:true,holeStrokes:2},
    {id:'b',potted:true,holeStrokes:2},
    {id:'c',potted:true,holeStrokes:3},
    {id:'d',potted:false,holeStrokes:5}
  ]);
  const byId = Object.fromEntries(scored.map(x => [x.playerId,x.points]));
  assert.deepEqual(byId, {a:3,b:3,c:2,d:0});
});

test('Minigolf roze cement remt sterker dan zand', () => {
  const { simulateShot } = require('../games/minigolf/server');
  const base = {
    name:'test', maxStrokes:5, cup:{x:880,y:500}, walls:[], props:[],
    terrain:[]
  };
  const cement = {...base, terrain:[{id:'c',type:'cement',shape:'rect',x:0,y:0,w:900,h:520}]};
  const sand = {...base, terrain:[{id:'s',type:'sand',shape:'rect',x:0,y:0,w:900,h:520}]};
  const start = {x:100,y:260};
  const c = simulateShot(cement,start,0,0.45);
  const s = simulateShot(sand,start,0,0.45);
  assert.ok(c.end.x + 70 < s.end.x);
});

test('Minigolf custom maps worden alleen toegevoegd als ze speelbaar zijn', () => {
  const golf = require('../games/minigolf/server');
  const custom = golf.sanitizeMapDefinition({
    name:'Test custom',difficulty:'Moeilijk',maxStrokes:6,
    startZone:{x:50,y:360,w:140,h:100},cup:{x:800,y:100},
    terrain:[{type:'cement',shape:'rect',x:300,y:200,w:180,h:100}],
    walls:[{x:500,y:80,w:40,h:140}],
    props:[{kind:'tree',shape:'circle',cx:650,cy:320,r:30}],
    boosts:[{x:350,y:330,w:100,h:40,angle:0,strength:1}]
  });
  custom.id='custom-test';
  golf.setCustomMapProvider(() => [custom]);
  assert.ok(golf.combinedMapPool().some(m => m.id === 'custom-test'));
  golf.setCustomMapProvider(() => []);
});

test('Minigolf map sanitizer ondersteunt startvak en boosts', () => {
  const { sanitizeMapDefinition } = require('../games/minigolf/server');
  const map = sanitizeMapDefinition({
    name:'  Mijn Map  ',maxStrokes:99,difficulty:'Expert',
    startZone:{x:40,y:350,w:140,h:100},cup:{x:800,y:100},
    terrain:[],
    props:[{kind:'windmill',x:400,y:200,w:90,h:120}],
    boosts:[{x:250,y:300,w:100,h:40,angle:0.4,strength:1.3}]
  });
  assert.equal(map.name,'Mijn Map');
  assert.equal(map.maxStrokes,10);
  assert.equal(map.props[0].kind,'windmill');
  assert.equal(map.boosts.length,1);
  assert.ok(map.startZone.w >= 52);
});


test('Minigolf weigert een hole die volledig door water is afgesloten', () => {
  const golf = require('../games/minigolf/server');
  const map = golf.sanitizeMapDefinition({
    name:'Onmogelijk',difficulty:'Normaal',maxStrokes:5,
    startZone:{x:40,y:350,w:140,h:100},
    cup:{x:700,y:260},
    terrain:[
      {type:'water',shape:'rect',x:610,y:170,w:180,h:24},
      {type:'water',shape:'rect',x:610,y:326,w:180,h:24},
      {type:'water',shape:'rect',x:610,y:170,w:24,h:180},
      {type:'water',shape:'rect',x:766,y:170,w:24,h:180}
    ],
    walls:[],props:[],boosts:[]
  }, {validate:false});
  const check = golf.validateMapPlayability(map);
  assert.equal(check.ok,false);
  assert.ok(check.errors.some(e => e.includes('niet bereikbaar')));
});

test('Minigolf boost geeft extra snelheid in de pijlrichting', () => {
  const golf = require('../games/minigolf/server');
  const base = golf.sanitizeMapDefinition({
    name:'Boost test',startZone:{x:40,y:220,w:120,h:80},cup:{x:850,y:480},
    terrain:[],walls:[],props:[],boosts:[]
  }, {validate:false});
  const boosted = {...base, boosts:[{id:'b',x:180,y:235,w:130,h:50,angle:0,strength:1.4}]};
  const start = {x:100,y:260};
  const normal = golf.simulateShot(base,start,0,0.24);
  const fast = golf.simulateShot(boosted,start,0,0.24);
  assert.ok(fast.end.x > normal.end.x + 40);
});

test('Presidenten sorteert kaarten primair op rang, niet op suit', () => {
  const { sortPresidentCards } = require('../games/presidenten/server');
  const hand = [
    {id:'9♣',rank:'9',value:9,suit:'♣'},
    {id:'3♠',rank:'3',value:3,suit:'♠'},
    {id:'9♥',rank:'9',value:9,suit:'♥'},
    {id:'4♦',rank:'4',value:4,suit:'♦'},
    {id:'2♣',rank:'2',value:2,suit:'♣'},
    {id:'A♠',rank:'A',value:1,suit:'♠'}
  ];
  assert.deepEqual(sortPresidentCards(hand).map(c=>c.rank), ['3','4','9','9','A','2']);
});


test('Minigolf met 2 spelers geeft maximaal 1 punt per hole', () => {
  const { scoreHole } = require('../games/minigolf/server');
  const result = scoreHole([{id:'a',potted:true,holeStrokes:2},{id:'b',potted:true,holeStrokes:4}]);
  assert.deepEqual(Object.fromEntries(result.map(r=>[r.playerId,r.points])), {a:1,b:0});
});

test('Minigolf startpositie vereist alleen dat het middelpunt in het startvak ligt', () => {
  const golf = require('../games/minigolf/server');
  const game = golf.createGame([{id:'a',name:'A',isNpc:false},{id:'b',name:'B',isNpc:false}]);
  const z=game.course[0].startZone;
  const point={x:z.x+1,y:z.y+z.h/2};
  assert.equal(golf.isPlacementValid(game,'a',point),true);
});

test('Minigolf laatste speler krijgt maximaal één extra poging', () => {
  const golf = require('../games/minigolf/server');
  const game = golf.createGame([{id:'a',name:'A',isNpc:false},{id:'b',name:'B',isNpc:false}]);
  game.players[0].potted=true;game.players[0].holeDone=true;game.players[0].holeStrokes=3;
  game.players[1].placed=true;game.players[1].ball={...game.course[0].start};game.players[1].holeStrokes=2;
  golf.activateLastPlayerRule(game,3);
  assert.deepEqual(game.lastChance,{playerId:'b',targetStrokes:3});
});

test('Minigolf destructible object botst eerst en verdwijnt daarna', () => {
  const golf = require('../games/minigolf/server');
  const map = golf.sanitizeMapDefinition({
    name:'Collider',startZone:{x:40,y:220,w:120,h:80},cup:{x:850,y:480},terrain:[],walls:[],boosts:[],
    props:[{kind:'tractor',shape:'rect',x:250,y:235,w:76,h:46}]
  },{validate:false});
  const withProp=golf.simulateShot(map,{x:100,y:260},0,0.36);
  const without=golf.simulateShot({...map,props:[]},{x:100,y:260},0,0.36);
  assert.ok(withProp.newlyRemovedPropIds.includes('prop1'));
  assert.ok(withProp.end.x < without.end.x - 30);
});


test('Minigolf speler kiest startpositie en kan onmiddellijk slag 1 spelen', () => {
  const golf = require('../games/minigolf/server');
  const game = golf.createGame([{id:'a',name:'A',isNpc:false},{id:'b',name:'B',isNpc:false}]);
  const z=game.course[0].startZone;
  const point={x:z.x+12,y:z.y+z.h/2};
  const connected=new Map([['a',true],['b',true]]);
  let view=golf.serialize(game,'a',connected);
  assert.equal(view.canPlace,true);
  assert.equal(view.canShoot,false);
  golf.handleAction(game,'a','placeBall',point);
  view=golf.serialize(game,'a',connected);
  assert.equal(view.canPlace,false);
  assert.equal(view.canShoot,true);
  assert.equal(game.players[1].placed,false);
});

test('Minigolf laatste-kans speler is DNF na zijn ene misser', () => {
  const golf = require('../games/minigolf/server');
  const game = golf.createGame([{id:'a',name:'A',isNpc:false},{id:'b',name:'B',isNpc:false}]);
  const simple=golf.sanitizeMapDefinition({
    name:'Last chance',difficulty:'Normaal',maxStrokes:6,
    startZone:{x:40,y:220,w:140,h:90},cup:{x:820,y:260},terrain:[],walls:[],props:[],boosts:[]
  });
  simple.id='last-chance';game.course=[simple];game.holeIndex=0;game.turnIndex=1;game.phase='playing';
  const a=game.players[0],b=game.players[1];
  a.potted=true;a.holeDone=true;a.holeStrokes=3;a.placed=true;a.ball={x:820,y:260};
  b.placed=true;b.ball={x:100,y:260};b.holeStrokes=2;b.holeDone=false;b.potted=false;b.failed=false;
  game.lastFinisherStrokes=3;golf.activateLastPlayerRule(game,3);
  golf.handleAction(game,'b','shoot',{angle:Math.PI,power:.06});
  golf.tick(game,Date.now()+10000);
  assert.equal(b.failed,true);
  assert.equal(b.holeDone,true);
  assert.equal(b.holeStrokes,3);
});
