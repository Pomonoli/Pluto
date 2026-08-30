const test=require('node:test');
const assert=require('node:assert/strict');
const carcassonne=require('../games/carcassonne/server');

function tileOfType(type){
  const game=carcassonne.createGame([{id:'a',name:'A'},{id:'b',name:'B'}]);
  return [game.currentTile,...game.deck].find(tile=>tile?.type===type);
}
function firstPlacement(game){
  for(let turns=0;turns<4&&!game.validPlacements.length;turns+=1)carcassonne.handleAction(game,'a','rotate');
  assert.ok(game.validPlacements.length>0);
  return game.validPlacements[0];
}

test('Carcassonne T-punten en kruispunten bestaan uit aparte wegen',()=>{
  const roadT=tileOfType('roadT');
  const roadCross=tileOfType('roadCross');
  assert.ok(roadT);
  assert.ok(roadCross);
  assert.deepEqual(roadT.roads,[[1],[2],[3]]);
  assert.deepEqual(roadCross.roads,[[0],[1],[2],[3]]);
});

test('Carcassonne weg eindigt correct aan een T-punt',()=>{
  const roadT=tileOfType('roadT');
  const roadEnd=carcassonne.rotateTile(tileOfType('roadEnd'),3);
  const game={board:new Map([
    ['0,0',{x:0,y:0,tile:roadT}],
    ['1,0',{x:1,y:0,tile:roadEnd}]
  ])};
  const feature=carcassonne.feature(game,0,0,'road',0);
  assert.equal(feature.complete,true);
  assert.equal(feature.tileKeys.length,2);
});

test('rechte weg splitst een tegel in twee afzonderlijke akkers',()=>{
  const tile=tileOfType('roadStraight');
  assert.equal(tile.fields.length,2);
  const game={board:new Map([['0,0',{x:0,y:0,tile}]]),meeples:[]};
  const choices=carcassonne.meepleChoices(game,{x:0,y:0,tile}).filter(choice=>choice.kind==='field');
  assert.equal(choices.length,2);
  assert.notEqual(choices[0].label,choices[1].label);
});

test('landbouwer blokkeert alleen het verbonden akkersegment',()=>{
  const tile=tileOfType('roadStraight');
  const game={board:new Map([['0,0',{x:0,y:0,tile}]]),meeples:[{playerId:'a',x:0,y:0,kind:'field',group:0}]};
  const choices=carcassonne.meepleChoices(game,{x:0,y:0,tile}).filter(choice=>choice.kind==='field');
  assert.deepEqual(choices.map(choice=>choice.group),[1]);
});

test('klooster verdeelt het omliggende groene gebied niet',()=>{
  const tile=tileOfType('monastery');
  assert.equal(tile.fields.length,1);
  assert.deepEqual([...tile.fields[0]].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7]);
});

test('speler kan tijdens burgerkeuze terug naar tegelplaatsing',()=>{
  const game=carcassonne.createGame([{id:'a',name:'A',isNpc:false},{id:'b',name:'B',isNpc:false}]);
  const placement=firstPlacement(game);
  carcassonne.handleAction(game,'a','place',{x:placement.x,y:placement.y});
  const tileId=game.lastPlaced.tile.id;
  assert.equal(game.phase,'meeple');
  carcassonne.handleAction(game,'a','undoPlace');
  assert.equal(game.phase,'place');
  assert.equal(game.currentTile.id,tileId);
  assert.equal(game.board.has(`${placement.x},${placement.y}`),false);
  assert.ok(game.validPlacements.length>0);
});

test('laatst afgeronde tegel blijft gemarkeerd tijdens de volgende beurt',()=>{
  const game=carcassonne.createGame([{id:'a',name:'A',isNpc:false},{id:'b',name:'B',isNpc:false}]);
  const placement=firstPlacement(game);
  carcassonne.handleAction(game,'a','place',{x:placement.x,y:placement.y});
  carcassonne.handleAction(game,'a','skipMeeple');
  assert.deepEqual(game.lastPlayed,{x:placement.x,y:placement.y});
  assert.equal(game.turnIndex,1);
});

test('eindtelling bewaart punten per categorie en correct totaal',()=>{
  const road=tileOfType('roadStraight'),monastery=tileOfType('monastery');
  const game={
    players:[{id:'a',name:'A',score:5},{id:'b',name:'B',score:2}],
    board:new Map([
      ['0,0',{x:0,y:0,tile:road}],
      ['3,3',{x:3,y:3,tile:monastery}]
    ]),
    meeples:[
      {playerId:'a',x:0,y:0,kind:'road',group:0},
      {playerId:'a',x:0,y:0,kind:'field',group:0},
      {playerId:'b',x:3,y:3,kind:'monastery',group:0}
    ],
    scored:new Set(),log:[]
  };
  carcassonne.scoreEnd(game);
  const a=game.finalScoreBreakdown.find(row=>row.playerId==='a');
  const b=game.finalScoreBreakdown.find(row=>row.playerId==='b');
  assert.deepEqual(a,{playerId:'a',points:5,farmers:0,incompleteRoads:1,incompleteCities:0,incompleteMonasteries:0,total:6});
  assert.deepEqual(b,{playerId:'b',points:2,farmers:0,incompleteRoads:0,incompleteCities:0,incompleteMonasteries:1,total:3});
});

test('een kruispunt heeft vier afzonderlijke hoekakkers',()=>{
  const tile=tileOfType('roadCross');
  assert.deepEqual(tile.fields,[[7,0],[1,2],[3,4],[5,6]]);
  assert.deepEqual(tile.fields.map(carcassonne.fieldPosition),['top-left','top-right','bottom-right','bottom-left']);
  const game={board:new Map([['0,0',{x:0,y:0,tile}]]),meeples:[]};
  assert.deepEqual(carcassonne.meepleChoices(game,{x:0,y:0,tile}).filter(choice=>choice.kind==='field').map(choice=>choice.label),[
    'Landbouwer linksboven','Landbouwer rechtsboven','Landbouwer rechtsonder','Landbouwer linksonder'
  ]);
});

test('een T-kruispunt benoemt de open akker en twee hoekakkers duidelijk',()=>{
  const tile=tileOfType('roadT'),game={board:new Map([['0,0',{x:0,y:0,tile}]]),meeples:[]};
  const fields=carcassonne.meepleChoices(game,{x:0,y:0,tile}).filter(choice=>choice.kind==='field');
  assert.deepEqual(fields.map(choice=>choice.position),['top','bottom-right','bottom-left']);
  assert.deepEqual(fields.map(choice=>choice.label),['Landbouwer midden-boven','Landbouwer rechtsonder','Landbouwer linksonder']);
});

test('volgende speler ziet vooraf de tegel bovenaan de stapel',()=>{
  const game=carcassonne.createGame([{id:'a',name:'A',isNpc:false},{id:'b',name:'B',isNpc:false}]);
  const expected=game.deck.at(-1).id,connected=new Map([['a',true],['b',true]]);
  assert.equal(carcassonne.serialize(game,'a',connected).nextTile,null);
  assert.equal(carcassonne.serialize(game,'b',connected).nextTile.id,expected);
});

test('Carcassonne eindtabel gebruikt compacte pictogramkolommen zonder minimumbreedte',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const client=fs.readFileSync(path.join(__dirname,'../games/carcassonne/client.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../games/carcassonne/styles.css'),'utf8');
  assert.match(client,/\['♟','Landbouwers'\]/);
  assert.match(client,/\['═','Onafgewerkte wegen'\]/);
  assert.match(css,/\.carc-final-score\{[^}]*table-layout:fixed/);
  assert.doesNotMatch(css,/\.carc-final-score\{[^}]*min-width/);
});
