const HABITATS=['mountain','forest','prairie','wetland','river'];
const WILDLIFE=['bear','elk','salmon','hawk','fox'];
const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const TURNS_PER_PLAYER=20;
const WILDLIFE_BY_HABITAT={
  mountain:['bear','elk','hawk'],
  forest:['bear','elk','fox'],
  prairie:['elk','hawk','fox'],
  wetland:['salmon','hawk','fox'],
  river:['salmon','bear','fox']
};
const STARTERS=[
  [['forest','river'],['mountain','forest'],['prairie','wetland']],
  [['mountain','prairie'],['river','wetland'],['forest','prairie']],
  [['wetland','forest'],['mountain','river'],['prairie','river']],
  [['river','forest'],['wetland','prairie'],['mountain','wetland']]
];

function key(q,r){return `${q},${r}`}
function neighbor(q,r,dir){const [dq,dr]=DIRS[dir];return {q:q+dq,r:r+dr}}
function currentPlayer(game){return game.players[game.turnIndex]}
function boardOf(game,id){return game.boards[id]||[]}
function tileAt(board,q,r){return board.find(tile=>tile.q===q&&tile.r===r)}
function randIndex(length){return Math.floor(Math.random()*length)}
function shuffle(items){
  const out=items.slice();
  for(let i=out.length-1;i>0;i--){const j=randIndex(i+1);[out[i],out[j]]=[out[j],out[i]]}
  return out;
}
function rotatedEdge(tile,dir){
  const rotation=((Number(tile.rotation)||0)%6+6)%6;
  return tile.edges[(dir-rotation+6)%6];
}
function unique(items){return [...new Set(items)]}

function makeTile(id,index){
  const primary=HABITATS[index%HABITATS.length];
  const secondary=HABITATS[(index*2+1)%HABITATS.length];
  const keystone=index%5===0;
  const dual=!keystone&&index%3!==0&&primary!==secondary;
  const habitats=dual?[primary,secondary]:[primary];
  const edges=dual?[primary,primary,primary,secondary,secondary,secondary]:Array(6).fill(primary);
  let options=unique(habitats.flatMap(habitat=>WILDLIFE_BY_HABITAT[habitat]));
  options=shuffle(options).slice(0,keystone?1:(index%4===0?3:2));
  return {id:`h${id}`,habitats,edges,wildlife:options,keystone,rotation:0};
}
function makeDeck(playerCount){
  const count=playerCount*TURNS_PER_PLAYER+3;
  return shuffle(Array.from({length:count},(_,index)=>makeTile(index,index)));
}
function makeWildlifeBag(){return shuffle(WILDLIFE.flatMap(type=>Array(20).fill(type)))}
function drawWildlife(game){
  if(!game.wildlifeBag.length)return WILDLIFE[randIndex(WILDLIFE.length)];
  const index=randIndex(game.wildlifeBag.length);
  return game.wildlifeBag.splice(index,1)[0];
}
function returnWildlife(game,type){if(type)game.wildlifeBag.push(type)}
function starterBoard(playerIndex){
  const patterns=STARTERS[playerIndex%STARTERS.length];
  const coords=[{q:0,r:0},{q:1,r:0},{q:0,r:1}];
  return patterns.map((habitats,index)=>{
    const [a,b]=habitats;
    const options=unique([...WILDLIFE_BY_HABITAT[a],...WILDLIFE_BY_HABITAT[b]]).slice(index,index+3);
    return {
      id:`starter-${playerIndex}-${index}`,
      q:coords[index].q,r:coords[index].r,
      habitats:[a,b],edges:[a,a,a,b,b,b],wildlife:options.length?options:[WILDLIFE[index]],
      keystone:false,rotation:(playerIndex+index*2)%6,animal:null,starter:true
    };
  });
}
function drawHabitat(game){return game.tileDeck.shift()||null}
function refillMarket(game){
  for(let i=0;i<4;i++){
    if(!game.marketTiles[i])game.marketTiles[i]=drawHabitat(game);
    if(!game.marketWildlife[i])game.marketWildlife[i]=drawWildlife(game);
  }
}
function automaticOverpopulation(game){
  let changed=false;
  while(game.marketWildlife.filter(Boolean).length===4&&new Set(game.marketWildlife).size===1){
    const old=game.marketWildlife.slice();
    game.marketWildlife=game.marketWildlife.map(()=>drawWildlife(game));
    old.forEach(type=>returnWildlife(game,type));
    changed=true;
  }
  return changed;
}
function overpopulationType(game){
  const counts={};
  game.marketWildlife.forEach(type=>{if(type)counts[type]=(counts[type]||0)+1});
  return Object.entries(counts).find(([,count])=>count===3)?.[0]||null;
}
function legalTilePositions(board){
  const occupied=new Set(board.map(tile=>key(tile.q,tile.r)));
  const result=new Map();
  for(const tile of board){
    for(let dir=0;dir<6;dir++){
      const pos=neighbor(tile.q,tile.r,dir);
      const k=key(pos.q,pos.r);
      if(!occupied.has(k))result.set(k,pos);
    }
  }
  return [...result.values()];
}
function legalWildlifeTiles(board,type){return board.filter(tile=>!tile.animal&&tile.wildlife.includes(type))}

function createGame(roomPlayers){
  if(roomPlayers.length<2||roomPlayers.length>4)throw new Error('Cascadia is voor 2 tot 4 spelers.');
  const players=roomPlayers.map((player,index)=>({
    id:player.id,name:player.name,isNpc:player.isNpc,index,nature:0,turns:0,finalScore:null,scoreBreakdown:null
  }));
  const game={
    gameKey:'cascadia',players,boards:{},turnIndex:0,phase:'draft',pending:null,
    tileDeck:makeDeck(players.length),wildlifeBag:makeWildlifeBag(),marketTiles:Array(4).fill(null),marketWildlife:Array(4).fill(null),
    overpopUsed:false,gameOver:false,winnerIds:[],resultText:'',log:[],nextNpcAt:0
  };
  players.forEach(player=>{game.boards[player.id]=starterBoard(player.index)});
  refillMarket(game);
  automaticOverpopulation(game);
  scheduleNpc(game);
  return game;
}

function assertTurn(game,playerId){
  const player=currentPlayer(game);
  if(!player||player.id!==playerId)throw new Error('Je bent niet aan de beurt.');
  return player;
}
function draft(game,playerId,payload={}){
  if(game.phase!=='draft')throw new Error('Je moet eerst je huidige beurt afwerken.');
  const player=assertTurn(game,playerId);
  const tileIndex=Number(payload.tileIndex),wildlifeIndex=Number(payload.wildlifeIndex);
  if(!Number.isInteger(tileIndex)||tileIndex<0||tileIndex>3||!game.marketTiles[tileIndex])throw new Error('Kies een geldige habitattegel.');
  if(!Number.isInteger(wildlifeIndex)||wildlifeIndex<0||wildlifeIndex>3||!game.marketWildlife[wildlifeIndex])throw new Error('Kies een geldig dier.');
  const useNature=tileIndex!==wildlifeIndex;
  if(useNature){
    if(player.nature<1)throw new Error('Je hebt een natuurfiche nodig om te mixen.');
    player.nature-=1;
  }
  const tile=game.marketTiles[tileIndex];
  const animal=game.marketWildlife[wildlifeIndex];
  game.marketTiles[tileIndex]=null;
  game.marketWildlife[wildlifeIndex]=null;
  game.pending={playerId,tile:{...tile,edges:tile.edges.slice(),habitats:tile.habitats.slice(),wildlife:tile.wildlife.slice(),rotation:0},animal};
  game.phase='placeTile';
  game.log.unshift(`${player.name} kiest ${useNature?'een gemixte combinatie met een natuurfiche':'een tegel-diercombinatie'}.`);
}
function refreshThree(game,playerId){
  if(game.phase!=='draft')throw new Error('Je kan de markt nu niet verversen.');
  assertTurn(game,playerId);
  if(game.overpopUsed)throw new Error('Je hebt de vrije overpopulatieverversing al gebruikt.');
  const type=overpopulationType(game);
  if(!type)throw new Error('Er liggen geen drie gelijke dieren.');
  const indices=game.marketWildlife.map((value,index)=>value===type?index:-1).filter(index=>index>=0);
  const old=indices.map(index=>game.marketWildlife[index]);
  indices.forEach(index=>{game.marketWildlife[index]=drawWildlife(game)});
  old.forEach(value=>returnWildlife(game,value));
  game.overpopUsed=true;
  game.log.unshift(`${currentPlayer(game).name} ververst drie overbevolkte ${type}.`);
  automaticOverpopulation(game);
}
function refreshWithNature(game,playerId,payload={}){
  if(game.phase!=='draft')throw new Error('Je kan de markt nu niet verversen.');
  const player=assertTurn(game,playerId);
  if(player.nature<1)throw new Error('Je hebt geen natuurfiche.');
  const indices=unique((Array.isArray(payload.indices)?payload.indices:[]).map(Number)).filter(index=>Number.isInteger(index)&&index>=0&&index<4&&game.marketWildlife[index]);
  if(!indices.length)throw new Error('Kies minstens één dier om te verversen.');
  player.nature-=1;
  const old=indices.map(index=>game.marketWildlife[index]);
  indices.forEach(index=>{game.marketWildlife[index]=drawWildlife(game)});
  old.forEach(value=>returnWildlife(game,value));
  game.log.unshift(`${player.name} gebruikt een natuurfiche om ${indices.length} ${indices.length===1?'dier':'dieren'} te verversen.`);
  automaticOverpopulation(game);
}
function placeTile(game,playerId,payload={}){
  if(game.phase!=='placeTile'||game.pending?.playerId!==playerId)throw new Error('Je moet nu geen habitattegel plaatsen.');
  const player=assertTurn(game,playerId);
  const q=Number(payload.q),r=Number(payload.r),rotation=Number(payload.rotation);
  if(!Number.isInteger(q)||!Number.isInteger(r)||!Number.isInteger(rotation))throw new Error('Ongeldige plaatsing.');
  const board=boardOf(game,playerId);
  if(!legalTilePositions(board).some(pos=>pos.q===q&&pos.r===r))throw new Error('De tegel moet aan je landschap grenzen.');
  const tile={...game.pending.tile,q,r,rotation:((rotation%6)+6)%6,animal:null,starter:false};
  board.push(tile);
  game.pending.placedTileId=tile.id;
  game.phase='placeWildlife';
  game.log.unshift(`${player.name} legt een habitattegel.`);
}
function placeWildlife(game,playerId,payload={}){
  if(game.phase!=='placeWildlife'||game.pending?.playerId!==playerId)throw new Error('Je moet nu geen dier plaatsen.');
  const player=assertTurn(game,playerId);
  const board=boardOf(game,playerId);
  const q=Number(payload.q),r=Number(payload.r);
  const tile=tileAt(board,q,r);
  if(!tile||tile.animal||!tile.wildlife.includes(game.pending.animal))throw new Error('Dat dier kan niet op deze tegel.');
  tile.animal=game.pending.animal;
  if(tile.keystone){player.nature+=1;game.log.unshift(`${player.name} verdient een natuurfiche.`)}
  game.log.unshift(`${player.name} plaatst ${game.pending.animal}.`);
  completeTurn(game,player);
}
function discardWildlife(game,playerId){
  if(game.phase!=='placeWildlife'||game.pending?.playerId!==playerId)throw new Error('Je kan nu geen dier terugleggen.');
  const player=assertTurn(game,playerId);
  returnWildlife(game,game.pending.animal);
  game.log.unshift(`${player.name} legt het dier terug in de zak.`);
  completeTurn(game,player);
}
function completeTurn(game,player){
  player.turns+=1;
  game.pending=null;
  if(game.players.every(item=>item.turns>=TURNS_PER_PLAYER)){
    finishGame(game);
    return;
  }
  refillMarket(game);
  automaticOverpopulation(game);
  game.turnIndex=(game.turnIndex+1)%game.players.length;
  while(currentPlayer(game).turns>=TURNS_PER_PLAYER)game.turnIndex=(game.turnIndex+1)%game.players.length;
  game.phase='draft';
  game.overpopUsed=false;
  scheduleNpc(game);
}

function adjacentAnimals(board,tile){
  const result=[];
  for(let dir=0;dir<6;dir++){
    const pos=neighbor(tile.q,tile.r,dir);
    const other=tileAt(board,pos.q,pos.r);
    if(other?.animal)result.push(other.animal);
  }
  return result;
}
function animalComponents(board,type){
  const animals=board.filter(tile=>tile.animal===type);
  const map=new Map(animals.map(tile=>[key(tile.q,tile.r),tile]));
  const seen=new Set(),components=[];
  for(const tile of animals){
    const start=key(tile.q,tile.r);if(seen.has(start))continue;
    const stack=[tile],component=[];seen.add(start);
    while(stack.length){
      const current=stack.pop();component.push(current);
      for(let dir=0;dir<6;dir++){
        const pos=neighbor(current.q,current.r,dir),k=key(pos.q,pos.r),next=map.get(k);
        if(next&&!seen.has(k)){seen.add(k);stack.push(next)}
      }
    }
    components.push(component);
  }
  return components;
}
function scoreBears(board){
  const pairs=animalComponents(board,'bear').filter(group=>group.length===2).length;
  const table=[0,4,11,19,27];
  return table[Math.min(pairs,4)];
}
function scoreElk(board){
  const elk=board.filter(tile=>tile.animal==='elk');
  if(!elk.length)return 0;
  const elkSet=new Set(elk.map(tile=>key(tile.q,tile.r)));
  const candidates=[];
  const axes=[[1,0],[0,1],[1,-1]];
  for(const tile of elk){
    for(const [dq,dr] of axes){
      const prev=key(tile.q-dq,tile.r-dr);
      if(elkSet.has(prev))continue;
      const line=[];let q=tile.q,r=tile.r;
      while(elkSet.has(key(q,r))){line.push(key(q,r));q+=dq;r+=dr}
      for(let offset=0;offset<line.length;offset++){
        for(let length=1;length<=4&&offset+length<=line.length;length++){
          candidates.push({cells:line.slice(offset,offset+length),length,points:[0,2,5,9,13][length]});
        }
      }
    }
  }
  candidates.sort((a,b)=>b.points-a.points||b.length-a.length);
  const used=new Set();let score=0;
  for(const candidate of candidates){
    if(candidate.cells.some(cell=>used.has(cell)))continue;
    candidate.cells.forEach(cell=>used.add(cell));score+=candidate.points;
  }
  return score;
}
function scoreSalmon(board){
  const table=[0,2,5,8,12,16,20,25];
  let score=0;
  for(const group of animalComponents(board,'salmon')){
    const keys=new Set(group.map(tile=>key(tile.q,tile.r)));
    const valid=group.every(tile=>{
      let degree=0;
      for(let dir=0;dir<6;dir++){const pos=neighbor(tile.q,tile.r,dir);if(keys.has(key(pos.q,pos.r)))degree++}
      return degree<=2;
    });
    if(valid)score+=table[Math.min(group.length,7)];
  }
  return score;
}
function scoreHawks(board){
  const hawks=board.filter(tile=>tile.animal==='hawk');
  const isolated=hawks.filter(tile=>!adjacentAnimals(board,tile).includes('hawk')).length;
  const table=[0,2,5,8,11,14,18,22,26];
  return table[Math.min(isolated,8)];
}
function scoreFoxes(board){
  return board.filter(tile=>tile.animal==='fox').reduce((sum,tile)=>sum+new Set(adjacentAnimals(board,tile)).size,0);
}
function scoreWildlife(board){
  const detail={bear:scoreBears(board),elk:scoreElk(board),salmon:scoreSalmon(board),hawk:scoreHawks(board),fox:scoreFoxes(board)};
  return {detail,total:Object.values(detail).reduce((a,b)=>a+b,0)};
}
function largestHabitatCorridor(board,habitat){
  const candidates=board.filter(tile=>tile.habitats.includes(habitat));
  const map=new Map(candidates.map(tile=>[key(tile.q,tile.r),tile]));
  const seen=new Set();let best=0;
  for(const tile of candidates){
    const start=key(tile.q,tile.r);if(seen.has(start))continue;
    let size=0;const stack=[tile];seen.add(start);
    while(stack.length){
      const current=stack.pop();size++;
      for(let dir=0;dir<6;dir++){
        if(rotatedEdge(current,dir)!==habitat)continue;
        const pos=neighbor(current.q,current.r,dir),k=key(pos.q,pos.r),other=map.get(k);
        if(other&&!seen.has(k)&&rotatedEdge(other,(dir+3)%6)===habitat){seen.add(k);stack.push(other)}
      }
    }
    best=Math.max(best,size);
  }
  return best;
}
function habitatScores(game){
  const byPlayer={};
  game.players.forEach(player=>{
    const board=boardOf(game,player.id);
    byPlayer[player.id]={};
    HABITATS.forEach(habitat=>{byPlayer[player.id][habitat]={corridor:largestHabitatCorridor(board,habitat),bonus:0}});
  });
  for(const habitat of HABITATS){
    const ranked=game.players.map(player=>({player,value:byPlayer[player.id][habitat].corridor})).sort((a,b)=>b.value-a.value);
    const max=ranked[0]?.value||0;
    const leaders=ranked.filter(item=>item.value===max);
    if(game.players.length===2){
      if(leaders.length===2)leaders.forEach(item=>{byPlayer[item.player.id][habitat].bonus=1});
      else if(leaders[0])byPlayer[leaders[0].player.id][habitat].bonus=2;
    }else if(leaders.length===1){
      byPlayer[leaders[0].player.id][habitat].bonus=3;
      const second=ranked.find(item=>item.value<max);
      if(second){
        const tiedSecond=ranked.filter(item=>item.value===second.value);
        if(tiedSecond.length===1)byPlayer[second.player.id][habitat].bonus=1;
      }
    }else if(leaders.length===2){leaders.forEach(item=>{byPlayer[item.player.id][habitat].bonus=2})}
    else leaders.forEach(item=>{byPlayer[item.player.id][habitat].bonus=1});
  }
  return byPlayer;
}
function scoreAll(game){
  const habitats=habitatScores(game),scores={};
  for(const player of game.players){
    const wildlife=scoreWildlife(boardOf(game,player.id));
    const habitatDetail=habitats[player.id];
    const habitatTotal=HABITATS.reduce((sum,type)=>sum+habitatDetail[type].corridor+habitatDetail[type].bonus,0);
    scores[player.id]={wildlife:wildlife.detail,wildlifeTotal:wildlife.total,habitats:habitatDetail,habitatTotal,nature:player.nature,total:wildlife.total+habitatTotal+player.nature};
  }
  return scores;
}
function finishGame(game){
  const scores=scoreAll(game);
  game.players.forEach(player=>{player.finalScore=scores[player.id].total;player.scoreBreakdown=scores[player.id]});
  const best=Math.max(...game.players.map(player=>player.finalScore));
  let leaders=game.players.filter(player=>player.finalScore===best);
  if(leaders.length>1){
    const mostNature=Math.max(...leaders.map(player=>player.nature));
    leaders=leaders.filter(player=>player.nature===mostNature);
  }
  game.winnerIds=leaders.map(player=>player.id);
  game.gameOver=true;game.phase='over';game.nextNpcAt=0;
  game.resultText=leaders.length===1?`${leaders[0].name} wint Cascadia met ${best} punten.`:`${leaders.map(player=>player.name).join(' en ')} delen de winst met ${best} punten.`;
  game.log.unshift(game.resultText);
}

function tilePlacementScore(board,tile,pos,rotation){
  const placed={...tile,q:pos.q,r:pos.r,rotation};
  let score=0;
  for(let dir=0;dir<6;dir++){
    const n=neighbor(pos.q,pos.r,dir),other=tileAt(board,n.q,n.r);
    if(!other)continue;
    const a=rotatedEdge(placed,dir),b=rotatedEdge(other,(dir+3)%6);
    if(a===b)score+=3;
    if(tile.wildlife.some(type=>other.wildlife.includes(type)))score+=0.2;
  }
  return score+Math.random()*0.25;
}
function wildlifePlacementScore(board,type,tile){
  const neighbors=adjacentAnimals(board,tile);
  if(type==='bear'){
    const bears=neighbors.filter(animal=>animal==='bear').length;
    return bears===1?6:bears===0?2:-8;
  }
  if(type==='elk')return neighbors.filter(animal=>animal==='elk').length*3+1;
  if(type==='salmon'){
    const salmon=neighbors.filter(animal=>animal==='salmon').length;
    return salmon===1?5:salmon===2?3:salmon>2?-10:1;
  }
  if(type==='hawk')return neighbors.includes('hawk')?-8:4;
  if(type==='fox')return new Set(neighbors).size*3+1;
  return 0;
}
function pairValue(game,player,tileIndex,wildlifeIndex){
  const board=boardOf(game,player.id),tile=game.marketTiles[tileIndex],animal=game.marketWildlife[wildlifeIndex];
  if(!tile||!animal)return -999;
  const positions=legalTilePositions(board);
  let tileScore=0;
  for(const pos of positions.slice(0,30))for(let rotation=0;rotation<6;rotation++)tileScore=Math.max(tileScore,tilePlacementScore(board,tile,pos,rotation));
  let animalScore=0;
  for(const target of legalWildlifeTiles(board,animal))animalScore=Math.max(animalScore,wildlifePlacementScore(board,animal,target));
  if(tile.wildlife.includes(animal))animalScore+=1;
  return tileScore+animalScore+(tile.keystone&&tile.wildlife.includes(animal)?2:0);
}
function npcTurn(game,player){
  if(game.phase==='draft'){
    const over=overpopulationType(game);
    if(over&&!game.overpopUsed&&Math.random()<0.55){refreshThree(game,player.id);return}
    let choice={tileIndex:0,wildlifeIndex:0,value:-Infinity};
    for(let i=0;i<4;i++){
      const value=pairValue(game,player,i,i);if(value>choice.value)choice={tileIndex:i,wildlifeIndex:i,value};
    }
    if(player.nature>0){
      for(let ti=0;ti<4;ti++)for(let wi=0;wi<4;wi++){
        if(ti===wi)continue;const value=pairValue(game,player,ti,wi)-1.5;
        if(value>choice.value+1.5)choice={tileIndex:ti,wildlifeIndex:wi,value};
      }
    }
    draft(game,player.id,choice);return;
  }
  if(game.phase==='placeTile'){
    const board=boardOf(game,player.id),options=legalTilePositions(board);let best=null;
    for(const pos of options)for(let rotation=0;rotation<6;rotation++){
      const value=tilePlacementScore(board,game.pending.tile,pos,rotation);
      if(!best||value>best.value)best={...pos,rotation,value};
    }
    if(best)placeTile(game,player.id,best);return;
  }
  if(game.phase==='placeWildlife'){
    const board=boardOf(game,player.id),options=legalWildlifeTiles(board,game.pending.animal);
    if(!options.length||Math.random()<0.02){discardWildlife(game,player.id);return}
    options.sort((a,b)=>wildlifePlacementScore(board,game.pending.animal,b)-wildlifePlacementScore(board,game.pending.animal,a));
    placeWildlife(game,player.id,{q:options[0].q,r:options[0].r});
  }
}
function scheduleNpc(game,delay=550){game.nextNpcAt=!game.gameOver&&currentPlayer(game)?.isNpc?Date.now()+delay:0}
function tick(game,now=Date.now()){
  if(game.gameOver)return false;
  const player=currentPlayer(game);
  if(!player?.isNpc){game.nextNpcAt=0;return false}
  if(!game.nextNpcAt)game.nextNpcAt=now+550;
  if(now<game.nextNpcAt)return false;
  npcTurn(game,player);scheduleNpc(game);return true;
}

function handleAction(game,playerId,action,payload){
  if(game.gameOver)throw new Error('Het spel is afgelopen.');
  if(action==='draft')return draft(game,playerId,payload);
  if(action==='refreshThree')return refreshThree(game,playerId);
  if(action==='refreshWithNature')return refreshWithNature(game,playerId,payload);
  if(action==='placeTile')return placeTile(game,playerId,payload);
  if(action==='placeWildlife')return placeWildlife(game,playerId,payload);
  if(action==='discardWildlife')return discardWildlife(game,playerId);
  throw new Error('Onbekende actie.');
}

function serializeTile(tile){
  if(!tile)return null;
  return {id:tile.id,q:tile.q,r:tile.r,habitats:tile.habitats.slice(),edges:tile.edges.slice(),wildlife:tile.wildlife.slice(),keystone:tile.keystone,rotation:tile.rotation||0,animal:tile.animal||null,starter:Boolean(tile.starter)};
}
function previewFor(game,player){
  const wildlife=scoreWildlife(boardOf(game,player.id));
  const corridors={};HABITATS.forEach(type=>{corridors[type]=largestHabitatCorridor(boardOf(game,player.id),type)});
  return {wildlife:wildlife.total,corridors,nature:player.nature,total:wildlife.total+Object.values(corridors).reduce((a,b)=>a+b,0)+player.nature};
}
function serialize(game,requesterId,connected){
  const player=currentPlayer(game),scores=game.gameOver?Object.fromEntries(game.players.map(item=>[item.id,item.scoreBreakdown])):null;
  return {
    kind:game.gameKey,phase:game.phase,gameOver:game.gameOver,resultText:game.resultText,winnerIds:game.winnerIds.slice(),
    turnPlayerId:game.gameOver?null:player?.id,pending:game.pending?{playerId:game.pending.playerId,tile:serializeTile(game.pending.tile),animal:game.pending.animal,placedTileId:game.pending.placedTileId||null}:null,
    marketTiles:game.marketTiles.map(serializeTile),marketWildlife:game.marketWildlife.slice(),tilesRemaining:game.tileDeck.length,
    overpopulationType:game.phase==='draft'?overpopulationType(game):null,overpopUsed:game.overpopUsed,
    habitats:HABITATS.slice(),wildlifeTypes:WILDLIFE.slice(),turnsPerPlayer:TURNS_PER_PLAYER,
    players:game.players.map(item=>({
      id:item.id,name:item.name,isNpc:item.isNpc,index:item.index,nature:item.nature,turns:item.turns,finalScore:item.finalScore,
      connected:item.isNpc||(connected?.get?Boolean(connected.get(item.id)):true),preview:game.gameOver?null:previewFor(game,item)
    })),
    boards:Object.fromEntries(game.players.map(item=>[item.id,boardOf(game,item.id).map(serializeTile)])),
    canAct:!game.gameOver&&player?.id===requesterId,
    canDraft:!game.gameOver&&game.phase==='draft'&&player?.id===requesterId,
    canPlaceTile:game.phase==='placeTile'&&game.pending?.playerId===requesterId,
    canPlaceWildlife:game.phase==='placeWildlife'&&game.pending?.playerId===requesterId,
    scores,log:game.log.slice(0,24)
  };
}
function results(game){
  const ordered=game.players.slice().sort((a,b)=>b.finalScore-a.finalScore||b.nature-a.nature);
  const rankById=new Map();let lastScore=null,lastNature=null,rank=0;
  ordered.forEach((player,index)=>{
    if(player.finalScore!==lastScore||player.nature!==lastNature)rank=index+1;
    rankById.set(player.id,rank);lastScore=player.finalScore;lastNature=player.nature;
  });
  const uniqueWinner=game.winnerIds.length===1?game.winnerIds[0]:null;
  return game.players.map(player=>({
    playerId:player.id,placement:rankById.get(player.id)||game.players.length,score:Number(player.finalScore||0),
    won:uniqueWinner===player.id,outcome:game.winnerIds.includes(player.id)?(uniqueWinner?'Wint':'Gelijkspel'):'Verliest'
  }));
}

module.exports={
  createGame,handleAction,serialize,tick,results,
  legalTilePositions,legalWildlifeTiles,scoreWildlife,largestHabitatCorridor,scoreAll,rotatedEdge
};
