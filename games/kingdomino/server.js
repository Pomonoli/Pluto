const BOARD_LIMIT=5;
const ROW_SIZE=4;
const TERRAINS=['wheat','forest','water','grass','swamp','mine'];
const TERRAIN_COUNTS={wheat:26,forest:22,water:18,grass:14,swamp:10,mine:6};
const CROWN_PATTERNS={
  wheat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1],
  forest:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1],
  water:[0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1],
  grass:[0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  swamp:[0,0,0,0,0,0,0,0,1,1],
  mine:[0,1,1,2,2,3]
};
const DIRS=[{dx:1,dy:0},{dx:0,dy:1},{dx:-1,dy:0},{dx:0,dy:-1}];

function buildDominoes(){
  const cells=[];
  for(const terrain of TERRAINS){
    const count=TERRAIN_COUNTS[terrain];
    const crowns=CROWN_PATTERNS[terrain];
    for(let i=0;i<count;i++)cells.push({terrain,crowns:crowns[i]||0});
  }
  const rarity={wheat:0,forest:1,water:2,grass:3,swamp:4,mine:5};
  cells.sort((a,b)=>(a.crowns*10+rarity[a.terrain])-(b.crowns*10+rarity[b.terrain]));
  const dominoes=[];
  for(let i=0;i<48;i++)dominoes.push({id:`d${i+1}`,number:i+1,a:{...cells[i*2]},b:{...cells[i*2+1]}});
  return dominoes;
}
const DOMINOES=buildDominoes();
const DOMINO_BY_ID=new Map(DOMINOES.map(tile=>[tile.id,tile]));

function shuffled(items){
  const out=items.map(item=>typeof item==='object'?{...item}:item);
  for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
  return out;
}
function currentToken(game){return game.tokens.find(token=>token.id===game.activeTokenId)||null}
function playerById(game,id){return game.players.find(player=>player.id===id)}
function tileById(id){return DOMINO_BY_ID.get(id)||null}
function cellKey(x,y){return `${x},${y}`}
function addLog(game,text){game.log.unshift(text);game.log=game.log.slice(0,30)}
function totalRoundsFor(playerCount){return playerCount===2?6:12}

function makeDeck(playerCount){
  const all=shuffled(DOMINOES.map(tile=>tile.id));
  return playerCount===2?all.slice(0,24):all;
}
function drawRow(game){
  const ids=game.deck.splice(0,Math.min(ROW_SIZE,game.deck.length));
  return ids.sort((a,b)=>tileById(a).number-tileById(b).number);
}
function boardMap(player){return new Map(player.cells.map(cell=>[cellKey(cell.x,cell.y),cell]))}
function boundsFor(cells){
  const xs=cells.map(cell=>cell.x),ys=cells.map(cell=>cell.y);
  return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
}
function fitsFiveByFive(cells){
  const b=boundsFor(cells);
  return b.maxX-b.minX<BOARD_LIMIT&&b.maxY-b.minY<BOARD_LIMIT;
}
function hasMatchingNeighbour(map,x,y,terrain){
  for(const {dx,dy} of DIRS){
    const neighbour=map.get(cellKey(x+dx,y+dy));
    if(neighbour&&(neighbour.terrain==='castle'||neighbour.terrain===terrain))return true;
  }
  return false;
}
function legalPlacements(player,tile){
  if(!player||!tile)return[];
  const map=boardMap(player),placements=[];
  for(let x=-4;x<=4;x++)for(let y=-4;y<=4;y++)for(const {dx,dy} of DIRS){
    const x2=x+dx,y2=y+dy;
    if(x2<-4||x2>4||y2<-4||y2>4)continue;
    if(map.has(cellKey(x,y))||map.has(cellKey(x2,y2)))continue;
    const added=[...player.cells,{x,y,terrain:tile.a.terrain,crowns:tile.a.crowns},{x:x2,y:y2,terrain:tile.b.terrain,crowns:tile.b.crowns}];
    if(!fitsFiveByFive(added))continue;
    if(!hasMatchingNeighbour(map,x,y,tile.a.terrain)&&!hasMatchingNeighbour(map,x2,y2,tile.b.terrain))continue;
    placements.push({x,y,dx,dy});
  }
  return placements;
}

function scoreKingdom(player){
  const cells=player.cells.filter(cell=>cell.terrain!=='castle');
  const map=new Map(cells.map(cell=>[cellKey(cell.x,cell.y),cell]));
  const seen=new Set();
  let score=0,largest=0,totalCrowns=0;
  for(const cell of cells)totalCrowns+=cell.crowns||0;
  for(const cell of cells){
    const start=cellKey(cell.x,cell.y);
    if(seen.has(start))continue;
    seen.add(start);
    const queue=[cell];
    let size=0,crowns=0;
    while(queue.length){
      const cur=queue.shift();size++;crowns+=cur.crowns||0;
      for(const {dx,dy} of DIRS){
        const key=cellKey(cur.x+dx,cur.y+dy),next=map.get(key);
        if(next&&next.terrain===cell.terrain&&!seen.has(key)){seen.add(key);queue.push(next)}
      }
    }
    score+=size*crowns;
    largest=Math.max(largest,size);
  }
  return {score,largest,totalCrowns};
}
function refreshScores(game){for(const player of game.players)Object.assign(player,scoreKingdom(player))}

function createGame(roomPlayers){
  if(roomPlayers.length<2||roomPlayers.length>4)throw new Error('Kingdomino is voor 2 tot 4 spelers.');
  const players=roomPlayers.map((player,index)=>({
    id:player.id,name:player.name,isNpc:Boolean(player.isNpc),index,
    cells:[{x:0,y:0,terrain:'castle',crowns:0,dominoId:'castle',half:'castle'}],
    score:0,largest:0,totalCrowns:0,discarded:0
  }));
  const kingsPerPlayer=players.length===2?2:1;
  const tokens=players.flatMap(player=>Array.from({length:kingsPerPlayer},(_,index)=>({
    id:`${player.id}-k${index+1}`,playerId:player.id,currentDominoId:null,nextDominoId:null
  })));
  const game={
    gameKey:'kingdomino',players,tokens,kingsPerPlayer,deck:makeDeck(players.length),currentRow:[],nextRow:[],
    phase:'initial-draft',initialOrder:shuffled(tokens.map(token=>token.id)),initialCursor:0,activeTokenId:null,
    roundTokens:[],turnCursor:0,round:0,totalRounds:totalRoundsFor(players.length),
    gameOver:false,winnerId:null,winnerIds:[],resultText:'',log:['Kies slim: sterke domino’s geven je volgende ronde een latere beurt.'],nextNpcAt:0
  };
  game.currentRow=drawRow(game);
  game.activeTokenId=game.initialOrder[0];
  scheduleNpc(game);
  return game;
}

function claimInitial(game,token,dominoId){
  if(game.phase!=='initial-draft')throw new Error('De eerste draft is al voorbij.');
  if(!game.currentRow.includes(dominoId))throw new Error('Die domino ligt niet in de draft.');
  if(game.tokens.some(item=>item.currentDominoId===dominoId))throw new Error('Die domino is al gekozen.');
  token.currentDominoId=dominoId;
  addLog(game,`${playerById(game,token.playerId).name} kiest domino ${tileById(dominoId).number}.`);
  game.initialCursor++;
  if(game.initialCursor<game.initialOrder.length){game.activeTokenId=game.initialOrder[game.initialCursor];scheduleNpc(game);return}
  const unused=game.currentRow.filter(id=>!game.tokens.some(token=>token.currentDominoId===id));
  if(unused.length)addLog(game,`Domino ${unused.map(id=>tileById(id).number).join(', ')} wordt afgelegd.`);
  game.round=1;
  game.roundTokens=[...game.tokens].sort((a,b)=>tileById(a.currentDominoId).number-tileById(b.currentDominoId).number);
  game.turnCursor=0;
  game.activeTokenId=game.roundTokens[0]?.id||null;
  game.currentRow=[];
  game.nextRow=drawRow(game);
  game.phase='place';
  scheduleNpc(game);
}

function validateActiveHuman(game,playerId){
  if(game.gameOver)throw new Error('Het spel is afgelopen.');
  const token=currentToken(game),player=token&&playerById(game,token.playerId);
  if(!token||!player||player.id!==playerId||player.isNpc)throw new Error('Je bent niet aan de beurt.');
  return {token,player};
}
function placeDomino(game,token,payload={}){
  if(game.phase!=='place')throw new Error('Je moet nu geen domino plaatsen.');
  const player=playerById(game,token.playerId),tile=tileById(token.currentDominoId);
  const x=Number(payload.x),y=Number(payload.y),dx=Number(payload.dx),dy=Number(payload.dy);
  const legal=legalPlacements(player,tile).find(item=>item.x===x&&item.y===y&&item.dx===dx&&item.dy===dy);
  if(!legal)throw new Error('Die domino past daar niet.');
  player.cells.push(
    {x,y,terrain:tile.a.terrain,crowns:tile.a.crowns,dominoId:tile.id,half:'a'},
    {x:x+dx,y:y+dy,terrain:tile.b.terrain,crowns:tile.b.crowns,dominoId:tile.id,half:'b'}
  );
  Object.assign(player,scoreKingdom(player));
  addLog(game,`${player.name} plaatst domino ${tile.number}.`);
  afterPlacement(game,token);
}
function discardDomino(game,token){
  if(game.phase!=='place')throw new Error('Je moet nu geen domino afleggen.');
  const player=playerById(game,token.playerId),tile=tileById(token.currentDominoId);
  if(legalPlacements(player,tile).length)throw new Error('Deze domino kan nog geplaatst worden en mag niet worden afgelegd.');
  player.discarded++;
  addLog(game,`${player.name} kan domino ${tile.number} niet plaatsen en legt hem af.`);
  afterPlacement(game,token);
}
function afterPlacement(game,token){
  if(game.nextRow.length){game.phase='draft';scheduleNpc(game);return}
  finishTokenTurn(game);
}
function claimNext(game,token,dominoId){
  if(game.phase!=='draft')throw new Error('Je moet nu geen nieuwe domino kiezen.');
  if(!game.nextRow.includes(dominoId))throw new Error('Die domino ligt niet in de volgende rij.');
  if(game.tokens.some(item=>item.nextDominoId===dominoId))throw new Error('Die domino is al gekozen.');
  token.nextDominoId=dominoId;
  addLog(game,`${playerById(game,token.playerId).name} reserveert domino ${tileById(dominoId).number}.`);
  finishTokenTurn(game);
}
function finishTokenTurn(game){
  game.turnCursor++;
  if(game.turnCursor<game.roundTokens.length){
    game.activeTokenId=game.roundTokens[game.turnCursor].id;
    game.phase='place';
    scheduleNpc(game);
    return;
  }
  if(!game.nextRow.length){finishGame(game);return}
  const unclaimed=game.nextRow.filter(id=>!game.tokens.some(token=>token.nextDominoId===id));
  if(unclaimed.length)addLog(game,`Domino ${unclaimed.map(id=>tileById(id).number).join(', ')} wordt afgelegd.`);
  for(const token of game.tokens){token.currentDominoId=token.nextDominoId;token.nextDominoId=null}
  game.round++;
  game.roundTokens=[...game.tokens].sort((a,b)=>tileById(a.currentDominoId).number-tileById(b.currentDominoId).number);
  game.turnCursor=0;
  game.activeTokenId=game.roundTokens[0]?.id||null;
  game.nextRow=drawRow(game);
  game.phase='place';
  scheduleNpc(game);
}

function ranking(game){
  refreshScores(game);
  return [...game.players].sort((a,b)=>b.score-a.score||b.largest-a.largest||b.totalCrowns-a.totalCrowns);
}
function finishGame(game){
  const ranked=ranking(game),best=ranked[0];
  game.winnerIds=ranked.filter(player=>player.score===best.score&&player.largest===best.largest&&player.totalCrowns===best.totalCrowns).map(player=>player.id);
  game.winnerId=game.winnerIds[0]||null;
  game.gameOver=true;game.phase='over';game.activeTokenId=null;game.nextNpcAt=0;
  game.resultText=game.winnerIds.length>1?`Gelijkspel op ${best.score} punten.`:`${best.name} wint met ${best.score} punten.`;
  addLog(game,game.resultText);
}

function terrainPotential(player,tile){
  const stats={};
  for(const terrain of TERRAINS)stats[terrain]={squares:0,crowns:0};
  for(const cell of player.cells){if(stats[cell.terrain]){stats[cell.terrain].squares++;stats[cell.terrain].crowns+=cell.crowns||0}}
  let value=0;
  for(const half of [tile.a,tile.b]){
    const s=stats[half.terrain];
    value+=(half.crowns||0)*8+s.crowns*2+s.squares*.35;
    if(half.terrain==='mine')value+=1.5;
  }
  value-=tile.number*.035;
  return value;
}
function npcPlacement(game,token){
  const player=playerById(game,token.playerId),tile=tileById(token.currentDominoId),options=legalPlacements(player,tile);
  if(!options.length){discardDomino(game,token);return}
  const before=scoreKingdom(player).score;
  let best=[],bestValue=-Infinity;
  for(const option of options){
    const clone={...player,cells:player.cells.map(cell=>({...cell}))};
    clone.cells.push(
      {x:option.x,y:option.y,terrain:tile.a.terrain,crowns:tile.a.crowns},
      {x:option.x+option.dx,y:option.y+option.dy,terrain:tile.b.terrain,crowns:tile.b.crowns}
    );
    const after=scoreKingdom(clone).score;
    const b=boundsFor(clone.cells),compact=(BOARD_LIMIT-(b.maxX-b.minX+1))+(BOARD_LIMIT-(b.maxY-b.minY+1));
    const value=(after-before)*5+after*.05+compact*.18+Math.random()*.2;
    if(value>bestValue+.0001){bestValue=value;best=[option]}else if(Math.abs(value-bestValue)<.0001)best.push(option)
  }
  placeDomino(game,token,best[Math.floor(Math.random()*best.length)]);
}
function npcDraft(game,token,row){
  const player=playerById(game,token.playerId),claimed=new Set(game.tokens.map(item=>item.nextDominoId||item.currentDominoId).filter(Boolean));
  const available=row.filter(id=>!claimed.has(id));
  const scored=available.map(id=>({id,value:terrainPotential(player,tileById(id))+Math.random()*.4})).sort((a,b)=>b.value-a.value);
  const pick=scored[0]?.id||available[0];
  if(game.phase==='initial-draft')claimInitial(game,token,pick);else claimNext(game,token,pick);
}
function npcTurn(game,token){
  if(game.phase==='initial-draft')return npcDraft(game,token,game.currentRow);
  if(game.phase==='place')return npcPlacement(game,token);
  if(game.phase==='draft')return npcDraft(game,token,game.nextRow);
}
function scheduleNpc(game,delay=650){
  const token=currentToken(game),player=token&&playerById(game,token.playerId);
  game.nextNpcAt=!game.gameOver&&player?.isNpc?Date.now()+delay:0;
}
function tick(game,now=Date.now()){
  if(game.gameOver)return false;
  const token=currentToken(game),player=token&&playerById(game,token.playerId);
  if(!player?.isNpc){game.nextNpcAt=0;return false}
  if(!game.nextNpcAt)game.nextNpcAt=now+650;
  if(now<game.nextNpcAt)return false;
  npcTurn(game,token);scheduleNpc(game);return true;
}

function handleAction(game,playerId,action,payload={}){
  const {token}=validateActiveHuman(game,playerId);
  if(action==='draft'){
    if(game.phase==='initial-draft')return claimInitial(game,token,String(payload.dominoId||''));
    return claimNext(game,token,String(payload.dominoId||''));
  }
  if(action==='place')return placeDomino(game,token,payload);
  if(action==='discard')return discardDomino(game,token);
  throw new Error('Onbekende actie.');
}
function publicTile(id){
  const tile=tileById(id);return tile?{id:tile.id,number:tile.number,a:{...tile.a},b:{...tile.b}}:null;
}
function connectedValue(connected,id){return connected?.get?Boolean(connected.get(id)):true}
function serialize(game,requesterId,connected){
  refreshScores(game);
  const token=currentToken(game),turnPlayer=token&&playerById(game,token.playerId),me=playerById(game,requesterId);
  const myTurn=!game.gameOver&&turnPlayer?.id===requesterId&&!turnPlayer?.isNpc;
  const activeTile=token?.currentDominoId?publicTile(token.currentDominoId):null;
  const legal=myTurn&&game.phase==='place'?legalPlacements(me,tileById(token.currentDominoId)):[];
  const claimMap=new Map();
  for(const item of game.tokens){
    const id=game.phase==='initial-draft'?item.currentDominoId:item.nextDominoId;
    if(id)claimMap.set(id,item.playerId);
  }
  const draftIds=game.phase==='initial-draft'?game.currentRow:game.nextRow;
  return {
    kind:game.gameKey,phase:game.phase,round:game.round,totalRounds:game.totalRounds,kingsPerPlayer:game.kingsPerPlayer,
    gameOver:game.gameOver,winnerId:game.winnerId,winnerIds:game.winnerIds.slice(),resultText:game.resultText,
    turnPlayerId:game.gameOver?null:turnPlayer?.id||null,activeTokenId:token?.id||null,activeTile,
    players:game.players.map(player=>({
      id:player.id,name:player.name,isNpc:player.isNpc,index:player.index,score:player.score,largest:player.largest,totalCrowns:player.totalCrowns,
      discarded:player.discarded,cells:player.cells.map(cell=>({...cell})),connected:player.isNpc||connectedValue(connected,player.id)
    })),
    tokens:game.tokens.map(item=>({id:item.id,playerId:item.playerId,currentDominoId:item.currentDominoId,nextDominoId:item.nextDominoId})),
    draftRow:draftIds.map(id=>({...publicTile(id),claimedBy:claimMap.get(id)||null})),
    canDraft:myTurn&&(game.phase==='initial-draft'||game.phase==='draft'),
    canPlace:myTurn&&game.phase==='place'&&legal.length>0,
    canDiscard:myTurn&&game.phase==='place'&&legal.length===0,
    legalPlacements:legal,
    log:game.log.slice(0,24)
  };
}
function results(game){
  const ranked=ranking(game);
  return game.players.map(player=>{
    const better=ranked.filter(other=>other.score>player.score||(other.score===player.score&&other.largest>player.largest)||(other.score===player.score&&other.largest===player.largest&&other.totalCrowns>player.totalCrowns)).length;
    const tiedWinners=game.winnerIds.length>1&&game.winnerIds.includes(player.id);
    return {playerId:player.id,placement:better+1,score:player.score,won:game.winnerIds.length===1&&game.winnerId===player.id,outcome:game.winnerIds.includes(player.id)?(tiedWinners?'Gelijkspel':'Wint'):'Verliest'};
  });
}

module.exports={createGame,handleAction,serialize,tick,results,legalPlacements,scoreKingdom,DOMINOES};
