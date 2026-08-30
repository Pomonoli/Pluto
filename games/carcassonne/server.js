const { shuffle } = require('../../src/cards');

const meta = {
  key: 'carcassonne', name: 'Carcassonne',
  description: 'Bouw een landschap en scoor met steden, wegen, kloosters en weilanden.',
  minPlayers: 2, maxPlayers: 5, supportsNpc: true, realtime: false, solo: false
};

const DIRS = [[0,-1],[1,0],[0,1],[-1,0]];
const OPP = [2,3,0,1];
const COLORS = ['#e76f51','#4aa3df','#f2c14e','#70b77e','#9b6fd0'];
const ALL_FIELD_PORTS=[0,1,2,3,4,5,6,7];

const TEMPLATES = {
  monastery:{edges:'FFFF',monastery:true,fields:[ALL_FIELD_PORTS]}, monasteryRoad:{edges:'FFRF',monastery:true,roads:[[2]],fields:[ALL_FIELD_PORTS]},
  cityCap:{edges:'CFFF',cities:[[0]],fields:[ALL_FIELD_PORTS]}, cityCapRoad:{edges:'CRFR',cities:[[0]],roads:[[1,3]],fields:[[0,1,2,7],[3,4,5,6]]},
  cityCapFork:{edges:'CRRF',cities:[[0]],roads:[[1,2]],fields:[[0,1,2,5,6,7],[3,4]]}, cityStraight:{edges:'CFCF',cities:[[0,2]],fields:[[0,5,6,7],[1,2,3,4]]},
  doubleCity:{edges:'CFCF',cities:[[0],[2]],fields:[[0,5,6,7],[1,2,3,4]]}, cityCorner:{edges:'CCFF',cities:[[0,1]],fields:[ALL_FIELD_PORTS]},
  cityCornerRoad:{edges:'CCRF',cities:[[0,1]],roads:[[2]],fields:[[0,5,6,7],[1,2,3,4]]}, cityThree:{edges:'CCCF',cities:[[0,1,2]],fields:[[6,7]],shield:1},
  cityThreeRoad:{edges:'CCCR',cities:[[0,1,2]],roads:[[3]],fields:[[6],[7]],shield:1}, cityFull:{edges:'CCCC',cities:[[0,1,2,3]],fields:[],shield:1},
  roadStraight:{edges:'FRFR',roads:[[1,3]],fields:[[0,1,2,7],[3,4,5,6]]}, roadCurve:{edges:'FRRF',roads:[[1,2]],fields:[[0,1,2,5,6,7],[3,4]]},
  roadT:{edges:'FRRR',roads:[[1],[2],[3]],fields:[[7,0,1,2],[3,4],[5,6]]}, roadCross:{edges:'RRRR',roads:[[0],[1],[2],[3]],fields:[[7,0],[1,2],[3,4],[5,6]]},
  roadEnd:{edges:'RFFF',roads:[[0]],fields:[ALL_FIELD_PORTS]}, field:{edges:'FFFF',fields:[ALL_FIELD_PORTS]}
};

const DECK_SPEC = [
  ['monastery',4],['monasteryRoad',2],['cityCap',5],['cityCapRoad',4],['cityCapFork',3],
  ['cityStraight',4],['doubleCity',3],['cityCorner',4],['cityCornerRoad',4],['cityThree',3],
  ['cityThreeRoad',3],['cityFull',1],['roadStraight',8],['roadCurve',9],['roadT',4],
  ['roadCross',1],['roadEnd',5],['field',4]
];

function cloneTile(type,index){const t=TEMPLATES[type];return {id:`${type}-${index}`,type,edges:t.edges.split(''),cities:(t.cities||[]).map(g=>g.slice()),roads:(t.roads||[]).map(g=>g.slice()),fields:(t.fields||[]).map(g=>g.slice()),monastery:Boolean(t.monastery),shield:t.shield||0,rotation:0}}
function makeDeck(){const deck=[];let index=0;for(const [type,count] of DECK_SPEC)for(let i=0;i<count;i+=1)deck.push(cloneTile(type,index++));return shuffle(deck)}
function rotateTile(tile,turns=1){let result={...tile,edges:tile.edges.slice(),cities:tile.cities.map(g=>g.slice()),roads:tile.roads.map(g=>g.slice()),fields:(tile.fields||[]).map(g=>g.slice())};for(let n=0;n<((turns%4)+4)%4;n+=1){result.edges=[result.edges[3],result.edges[0],result.edges[1],result.edges[2]];result.cities=result.cities.map(g=>g.map(s=>(s+1)%4));result.roads=result.roads.map(g=>g.map(s=>(s+1)%4));result.fields=result.fields.map(g=>g.map(port=>(port+2)%8));result.rotation=(result.rotation+1)%4}return result}
function posKey(x,y){return `${x},${y}`}
function tileAt(game,x,y){return game.board.get(posKey(x,y))?.tile||null}
function groupForSide(tile,kind,side){const groups=kind==='city'?tile.cities:kind==='road'?tile.roads:[];return groups.findIndex(group=>group.includes(side))}
function canPlaceAt(game,tile,x,y){if(tileAt(game,x,y))return false;let adjacent=false;for(let side=0;side<4;side+=1){const [dx,dy]=DIRS[side],neighbor=tileAt(game,x+dx,y+dy);if(!neighbor)continue;adjacent=true;if(tile.edges[side]!==neighbor.edges[OPP[side]])return false}return adjacent}
function frontier(game){const found=new Map();for(const entry of game.board.values())for(const [dx,dy] of DIRS){const x=entry.x+dx,y=entry.y+dy,key=posKey(x,y);if(!game.board.has(key))found.set(key,{x,y})}return [...found.values()]}
function placementsFor(game,tile){const result=[];for(let rotation=0;rotation<4;rotation+=1){const rotated=rotateTile(tile,rotation);for(const p of frontier(game))if(canPlaceAt(game,rotated,p.x,p.y))result.push({...p,rotation})}return result}
function placementsForCurrentRotation(game,tile){return frontier(game).filter(p=>canPlaceAt(game,tile,p.x,p.y)).map(p=>({...p,rotation:0}))}
function nodeKey(x,y,kind,group){return `${x},${y}|${kind}|${group}`}
function feature(game,x,y,kind,group){
  const stack=[{x,y,kind,group}],seen=new Set(),nodes=[],open=[];
  while(stack.length){const node=stack.pop(),key=nodeKey(node.x,node.y,kind,node.group);if(seen.has(key))continue;seen.add(key);const tile=tileAt(game,node.x,node.y);if(!tile)continue;const groups=kind==='city'?tile.cities:tile.roads;const sides=groups[node.group]||[];nodes.push({...node,sides});for(const side of sides){const [dx,dy]=DIRS[side],nextTile=tileAt(game,node.x+dx,node.y+dy);if(!nextTile){open.push({x:node.x,y:node.y,side});continue}const nextGroup=groupForSide(nextTile,kind,OPP[side]);if(nextGroup>=0)stack.push({x:node.x+dx,y:node.y+dy,kind,group:nextGroup});else open.push({x:node.x,y:node.y,side})}
  }
  const tileKeys=[...new Set(nodes.map(n=>posKey(n.x,n.y)))];return {kind,nodes,tileKeys,complete:open.length===0,signature:nodes.map(n=>nodeKey(n.x,n.y,kind,n.group)).sort().join(';')}
}
const OPP_FIELD_PORT=[5,4,7,6,1,0,3,2];
function fieldGroupForPort(tile,port){return (tile.fields||[]).findIndex(group=>group.includes(port))}
function fieldFeature(game,x,y,group=0){
  const stack=[{x,y,group}],seen=new Set(),nodes=[];
  while(stack.length){
    const node=stack.pop(),nodeId=nodeKey(node.x,node.y,'field',node.group);if(seen.has(nodeId))continue;
    const tile=tileAt(game,node.x,node.y),ports=tile?.fields?.[node.group];if(!tile||!ports)continue;
    seen.add(nodeId);nodes.push({...node,ports:ports.slice()});
    for(const port of ports){
      const side=Math.floor(port/2);if(tile.edges[side]==='C')continue;
      const [dx,dy]=DIRS[side],nextTile=tileAt(game,node.x+dx,node.y+dy);if(!nextTile||nextTile.edges[OPP[side]]==='C')continue;
      const nextGroup=fieldGroupForPort(nextTile,OPP_FIELD_PORT[port]);
      if(nextGroup>=0)stack.push({x:node.x+dx,y:node.y+dy,group:nextGroup});
    }
  }
  const tileKeys=[...new Set(nodes.map(node=>posKey(node.x,node.y)))];
  return {kind:'field',nodes,tileKeys,signature:nodes.map(node=>nodeKey(node.x,node.y,'field',node.group)).sort().join(';')}
}
function meeplesOn(game,feat){
  if(feat.kind==='field')return game.meeples.filter(m=>m.kind==='field'&&feat.nodes.some(node=>node.x===m.x&&node.y===m.y&&node.group===m.group));
  return game.meeples.filter(m=>m.kind===feat.kind&&feat.nodes.some(n=>n.x===m.x&&n.y===m.y&&n.group===m.group))
}
function award(game,feat,points,returnMeeples=true){const ms=meeplesOn(game,feat);if(!ms.length)return[];const counts=new Map();for(const m of ms)counts.set(m.playerId,(counts.get(m.playerId)||0)+1);const high=Math.max(...counts.values());const winners=[...counts].filter(([,count])=>count===high).map(([id])=>id);for(const id of winners){const p=game.players.find(player=>player.id===id);p.score+=points;game.log.unshift(`${p.name} scoort ${points} punten.`)}if(returnMeeples){for(const m of ms){const p=game.players.find(player=>player.id===m.playerId);p.meeples+=1}game.meeples=game.meeples.filter(m=>!ms.includes(m))}return winners}
function cityPoints(game,feat,complete){let shields=0;for(const key of feat.tileKeys)shields+=game.board.get(key).tile.shield||0;return feat.tileKeys.length*(complete?2:1)+shields*(complete?2:1)}
function scoreCompleted(game,placed){
  for(const kind of ['city','road']){const groups=kind==='city'?placed.tile.cities:placed.tile.roads;for(let group=0;group<groups.length;group+=1){const feat=feature(game,placed.x,placed.y,kind,group);if(!feat.complete||game.scored.has(feat.signature))continue;game.scored.add(feat.signature);award(game,feat,kind==='city'?cityPoints(game,feat,true):feat.tileKeys.length)}}
  for(const entry of game.board.values()){if(!entry.tile.monastery)continue;const sig=`monastery:${entry.x},${entry.y}`;if(game.scored.has(sig))continue;let around=0;for(let dy=-1;dy<=1;dy+=1)for(let dx=-1;dx<=1;dx+=1)if((dx||dy)&&tileAt(game,entry.x+dx,entry.y+dy))around+=1;if(around===8){game.scored.add(sig);const feat={kind:'monastery',x:entry.x,y:entry.y};const ms=game.meeples.filter(m=>m.kind==='monastery'&&m.x===entry.x&&m.y===entry.y);if(ms.length){const p=game.players.find(player=>player.id===ms[0].playerId);p.score+=9;p.meeples+=1;game.meeples=game.meeples.filter(m=>!ms.includes(m));game.log.unshift(`${p.name} scoort 9 punten voor een klooster.`)}}}
}
function featureOccupied(game,x,y,kind,group){const feat=kind==='field'?fieldFeature(game,x,y,group):feature(game,x,y,kind,group);return meeplesOn(game,feat).length>0}
function fieldPosition(ports){
  const set=new Set(ports||[]),quarters=[
    {name:'top-left',ports:[7,0]},{name:'top-right',ports:[1,2]},
    {name:'bottom-right',ports:[3,4]},{name:'bottom-left',ports:[5,6]}
  ].filter(quarter=>quarter.ports.some(port=>set.has(port)));
  if(quarters.length===4||quarters.length===0)return'center';
  if(quarters.length===3){const present=new Set(quarters.map(q=>q.name)),opposite={'top-left':'bottom-right','top-right':'bottom-left','bottom-right':'top-left','bottom-left':'top-right'},missing=['top-left','top-right','bottom-right','bottom-left'].find(name=>!present.has(name));return opposite[missing]}
  if(quarters.length===1)return quarters[0].name;
  const names=new Set(quarters.map(q=>q.name));
  if(names.has('top-left')&&names.has('top-right'))return'top';
  if(names.has('bottom-left')&&names.has('bottom-right'))return'bottom';
  if(names.has('top-left')&&names.has('bottom-left'))return'left';
  if(names.has('top-right')&&names.has('bottom-right'))return'right';
  return'center'
}
function fieldLabel(tile,group){if((tile.fields||[]).length<=1)return'Landbouwer';const words={left:'links',right:'rechts',top:'midden-boven',bottom:'midden-onder',center:'midden','top-left':'linksboven','top-right':'rechtsboven','bottom-right':'rechtsonder','bottom-left':'linksonder'};return`Landbouwer ${words[fieldPosition(tile.fields[group])]}`}
function meepleChoices(game,entry){const choices=[];entry.tile.cities.forEach((_,group)=>{if(!featureOccupied(game,entry.x,entry.y,'city',group))choices.push({key:`city:${group}`,kind:'city',group,label:'Ridder op stad'})});entry.tile.roads.forEach((_,group)=>{if(!featureOccupied(game,entry.x,entry.y,'road',group))choices.push({key:`road:${group}`,kind:'road',group,label:'Struikrover op weg'})});if(entry.tile.monastery&&!game.meeples.some(m=>m.x===entry.x&&m.y===entry.y&&m.kind==='monastery'))choices.push({key:'monastery:0',kind:'monastery',group:0,label:'Monnik op klooster'});entry.tile.fields.forEach((ports,group)=>{if(!featureOccupied(game,entry.x,entry.y,'field',group))choices.push({key:`field:${group}`,kind:'field',group,label:fieldLabel(entry.tile,group),position:fieldPosition(ports)})});return choices}
function scoreEnd(game){
  const breakdown=new Map(game.players.map(player=>[player.id,{playerId:player.id,points:player.score,farmers:0,incompleteRoads:0,incompleteCities:0,incompleteMonasteries:0,total:0}]));
  const add=(playerIds,category,points)=>playerIds.forEach(id=>{breakdown.get(id)[category]+=points});
  const visited=new Set();
  for(const m of [...game.meeples]){
    if(m.kind==='monastery'){
      const sig=`monastery:${m.x},${m.y}`;if(visited.has(sig))continue;visited.add(sig);
      let around=1;for(let dy=-1;dy<=1;dy+=1)for(let dx=-1;dx<=1;dx+=1)if((dx||dy)&&tileAt(game,m.x+dx,m.y+dy))around+=1;
      const player=game.players.find(item=>item.id===m.playerId);player.score+=around;breakdown.get(player.id).incompleteMonasteries+=around;continue;
    }
    if(m.kind==='field')continue;
    const feat=feature(game,m.x,m.y,m.kind,m.group);if(visited.has(feat.signature))continue;visited.add(feat.signature);
    const points=m.kind==='city'?cityPoints(game,feat,false):feat.tileKeys.length;
    add(award(game,feat,points,false),m.kind==='city'?'incompleteCities':'incompleteRoads',points);
  }
  const fields=new Map();
  for(const m of game.meeples.filter(item=>item.kind==='field')){const feat=fieldFeature(game,m.x,m.y,m.group);if(!fields.has(feat.signature))fields.set(feat.signature,feat)}
  for(const feat of fields.values()){
    const cities=new Map();for(const node of feat.nodes){const tile=tileAt(game,node.x,node.y);tile.cities.forEach((_,group)=>{const city=feature(game,node.x,node.y,'city',group);if(city.complete)cities.set(city.signature,city)})}
    const points=cities.size*3;add(award(game,feat,points,false),'farmers',points);
  }
  for(const player of game.players)breakdown.get(player.id).total=player.score;
  game.finalScoreBreakdown=[...breakdown.values()];
  game.gameOver=true;game.nextNpcAt=0;const high=Math.max(...game.players.map(p=>p.score));const winners=game.players.filter(p=>p.score===high);game.resultText=winners.length===1?`${winners[0].name} wint met ${high} punten.`:`Gelijkspel met ${high} punten.`
}
function drawNext(game){game.currentTile=null;game.validPlacements=[];while(game.deck.length){const tile=game.deck.pop(),valid=placementsFor(game,tile);if(valid.length){game.currentTile=tile;game.validPlacements=placementsForCurrentRotation(game,tile);game.phase='place';return}game.discarded+=1;game.log.unshift('Een onlegbare tegel is uit het spel verwijderd.')}scoreEnd(game)}
function advance(game){game.turnIndex=(game.turnIndex+1)%game.players.length;game.lastPlaced=null;drawNext(game);scheduleNpc(game)}
function placeCurrent(game,x,y,rotation){const valid=game.validPlacements.some(p=>p.x===x&&p.y===y&&p.rotation===rotation);if(!valid)throw new Error('Daar past deze tegel niet.');const tile=rotateTile(game.currentTile,rotation),entry={x,y,tile};game.board.set(posKey(x,y),entry);game.lastPlaced=entry;game.phase='meeple';game.validPlacements=[];game.log.unshift(`${game.players[game.turnIndex].name} legt een tegel.`)}
function undoPlacement(game){if(game.phase!=='meeple'||!game.lastPlaced)throw new Error('Er is geen tegel om terug te nemen.');const entry=game.lastPlaced;game.board.delete(posKey(entry.x,entry.y));game.currentTile=entry.tile;game.lastPlaced=null;game.phase='place';game.validPlacements=placementsForCurrentRotation(game,game.currentTile);if(/ legt een tegel\.$/.test(game.log[0]||''))game.log.shift()}
function finishTurn(game,choiceKey){const player=game.players[game.turnIndex],entry=game.lastPlaced;if(choiceKey&&player.meeples>0){const choice=meepleChoices(game,entry).find(c=>c.key===choiceKey);if(!choice)throw new Error('Daar mag geen burger staan.');game.meeples.push({playerId:player.id,x:entry.x,y:entry.y,kind:choice.kind,group:choice.group,position:choice.position||null});player.meeples-=1}game.lastPlayed={x:entry.x,y:entry.y};scoreCompleted(game,entry);if(!game.deck.length)scoreEnd(game);else advance(game)}
function createGame(roomPlayers){
  const start=cloneTile('cityCapRoad','start');start.id='start';const board=new Map([[posKey(0,0),{x:0,y:0,tile:start}]]);const game={gameKey:meta.key,players:roomPlayers.map((p,i)=>({id:p.id,name:p.name,isNpc:p.isNpc,score:0,meeples:7,color:COLORS[i]})),board,deck:makeDeck(),currentTile:null,validPlacements:[],lastPlaced:null,lastPlayed:null,meeples:[],scored:new Set(),turnIndex:0,phase:'place',discarded:0,gameOver:false,resultText:'',log:[],nextNpcAt:0};drawNext(game);scheduleNpc(game,700);return game
}
function scheduleNpc(game,delay=800){const p=game.players[game.turnIndex];game.nextNpcAt=!game.gameOver&&p?.isNpc?Date.now()+delay:0}
function npcTurn(game){const player=game.players[game.turnIndex];if(game.phase==='place'){for(let i=0;i<4&&!game.validPlacements.length;i+=1){game.currentTile=rotateTile(game.currentTile,1);game.validPlacements=placementsForCurrentRotation(game,game.currentTile)}const pick=game.validPlacements[Math.floor(Math.random()*game.validPlacements.length)];placeCurrent(game,pick.x,pick.y,0)}if(game.phase==='meeple'){const choices=player.meeples?meepleChoices(game,game.lastPlaced):[];finishTurn(game,choices.length&&Math.random()<.55?choices[Math.floor(Math.random()*choices.length)].key:null)}}
function tick(game,now=Date.now()){if(game.gameOver)return false;const p=game.players[game.turnIndex];if(!p?.isNpc){game.nextNpcAt=0;return false}if(!game.nextNpcAt)game.nextNpcAt=now+800;if(now<game.nextNpcAt)return false;npcTurn(game);scheduleNpc(game);return true}
function handleAction(game,playerId,action,payload={}){if(game.gameOver)throw new Error('Het spel is afgelopen.');const player=game.players[game.turnIndex];if(!player||player.id!==playerId||player.isNpc)throw new Error('Je bent niet aan de beurt.');if(action==='rotate'&&game.phase==='place'){game.currentTile=rotateTile(game.currentTile,1);game.validPlacements=placementsForCurrentRotation(game,game.currentTile)}else if(action==='place'&&game.phase==='place')placeCurrent(game,Number(payload.x),Number(payload.y),0);else if(action==='undoPlace'&&game.phase==='meeple')undoPlacement(game);else if(action==='meeple'&&game.phase==='meeple')finishTurn(game,String(payload.choice||''));else if(action==='skipMeeple'&&game.phase==='meeple')finishTurn(game,null);else throw new Error('Ongeldige actie.');scheduleNpc(game)}
function serializeTile(tile){return {...tile,edges:tile.edges.slice(),cities:tile.cities.map(g=>g.slice()),roads:tile.roads.map(g=>g.slice()),fields:(tile.fields||[]).map(g=>g.slice())}}
function serialize(game,requesterId,connected){const current=game.players[game.turnIndex],mine=current?.id===requesterId,nextPlayer=game.players[(game.turnIndex+1)%game.players.length],nextTile=!game.gameOver&&!mine&&nextPlayer?.id===requesterId&&game.deck.length?serializeTile(game.deck[game.deck.length-1]):null;return {kind:meta.key,phase:game.phase,gameOver:game.gameOver,resultText:game.resultText,turnPlayerId:game.gameOver?null:current?.id,tilesRemaining:game.deck.length+(game.currentTile?1:0),discarded:game.discarded,currentTile:mine&&game.phase==='place'?serializeTile(game.currentTile):null,nextTile,validPlacements:mine&&game.phase==='place'?game.validPlacements:[],lastPlaced:game.lastPlaced?{x:game.lastPlaced.x,y:game.lastPlaced.y}:null,lastPlayed:game.lastPlayed?{...game.lastPlayed}:null,finalScoreBreakdown:game.gameOver?(game.finalScoreBreakdown||[]):undefined,meepleChoices:mine&&game.phase==='meeple'&&game.lastPlaced?meepleChoices(game,game.lastPlaced):[],board:[...game.board.values()].map(e=>({x:e.x,y:e.y,tile:serializeTile(e.tile)})),meeples:game.meeples,players:game.players.map(p=>({...p,connected:p.isNpc||connected.get(p.id)})),log:game.log.slice(0,20)}}

function results(game){const {competitionPlacements}=require('../../src/result-utils'),placements=competitionPlacements(game.players,p=>p.score,true),high=Math.max(...game.players.map(p=>p.score)),leaders=game.players.filter(p=>p.score===high);return game.players.map(p=>({playerId:p.id,placement:placements.get(p.id),score:p.score,won:leaders.length===1&&leaders[0].id===p.id,outcome:leaders.length>1&&p.score===high?'Gelijkspel':p.score===high?'Wint':'Verliest'}))}

module.exports={meta,createGame,handleAction,serialize,tick,rotateTile,canPlaceAt,placementsFor,feature,fieldFeature,fieldPosition,meepleChoices,scoreEnd,results};
