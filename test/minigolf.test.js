const test = require('node:test');
const assert = require('node:assert/strict');

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
