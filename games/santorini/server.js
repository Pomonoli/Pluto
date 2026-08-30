const BOARD_SIZE=5;
const DOME_LEVEL=4;

function workersPerPlayer(playerCount){return playerCount===4?1:2}
function inside(row,col){return row>=0&&row<BOARD_SIZE&&col>=0&&col<BOARD_SIZE}
function cellIndex(row,col){return row*BOARD_SIZE+col}
function cellHeight(game,row,col){return game.board[cellIndex(row,col)]}
function currentPlayer(game){return game.players[game.turnIndex]}
function playerById(game,id){return game.players.find(player=>player.id===id)}
function workerAt(game,row,col){return game.workers.find(worker=>worker.row===row&&worker.col===col)}
function workerById(game,id){return game.workers.find(worker=>worker.id===id)}
function activePlayers(game){return game.players.filter(player=>player.active)}
function adjacent(row,col){
  const out=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    if((dr||dc)&&inside(row+dr,col+dc))out.push({row:row+dr,col:col+dc});
  }
  return out;
}

function createGame(roomPlayers){
  if(roomPlayers.length<2||roomPlayers.length>4)throw new Error('Santorini is voor 2 tot 4 spelers.');
  if(roomPlayers.some(player=>player.isNpc))throw new Error('Santorini ondersteunt nog geen NPC-spelers.');
  const required=workersPerPlayer(roomPlayers.length);
  const players=roomPlayers.map((player,index)=>({
    id:player.id,name:player.name,isNpc:false,index,active:true,workersPlaced:0
  }));
  return {
    gameKey:'santorini',
    board:Array(BOARD_SIZE*BOARD_SIZE).fill(0),
    players,
    workers:players.flatMap(player=>Array.from({length:required},(_,index)=>({
      id:`${player.id}-${index}`,ownerId:player.id,row:null,col:null
    }))),
    workersPerPlayer:required,
    phase:'setup',
    turnIndex:0,
    movedWorkerId:null,
    gameOver:false,
    winnerId:null,
    resultText:'',
    log:[`Plaats om beurten ${required===1?'je worker':'je workers'} op het bord.`]
  };
}

function legalMoves(game,worker){
  if(!worker||worker.row===null||worker.col===null)return[];
  const fromHeight=cellHeight(game,worker.row,worker.col);
  return adjacent(worker.row,worker.col).filter(({row,col})=>
    !workerAt(game,row,col)&&
    cellHeight(game,row,col)<DOME_LEVEL&&
    cellHeight(game,row,col)<=fromHeight+1
  );
}

function legalBuilds(game,worker){
  if(!worker||worker.row===null||worker.col===null)return[];
  return adjacent(worker.row,worker.col).filter(({row,col})=>
    !workerAt(game,row,col)&&cellHeight(game,row,col)<DOME_LEVEL
  );
}

function hasMove(game,playerId){
  return game.workers.some(worker=>worker.ownerId===playerId&&legalMoves(game,worker).length>0);
}

function endWithWinner(game,playerId,reason){
  const winner=playerById(game,playerId);
  game.gameOver=true;
  game.phase='over';
  game.winnerId=playerId;
  game.movedWorkerId=null;
  game.resultText=reason||`${winner?.name||'Een speler'} wint Santorini.`;
}

function removePlayer(game,player){
  player.active=false;
  for(const worker of game.workers){
    if(worker.ownerId===player.id){worker.row=null;worker.col=null}
  }
  game.log.unshift(`${player.name} kan niet meer bewegen en valt af.`);
}

function advanceTurn(game){
  const alive=activePlayers(game);
  if(alive.length<=1){
    if(alive[0])endWithWinner(game,alive[0].id,`${alive[0].name} is de laatste overgebleven speler en wint.`);
    return;
  }

  let checked=0;
  while(checked<game.players.length){
    game.turnIndex=(game.turnIndex+1)%game.players.length;
    const next=currentPlayer(game);
    checked++;
    if(!next.active)continue;
    if(hasMove(game,next.id))return;
    removePlayer(game,next);
    if(activePlayers(game).length===1){
      const winner=activePlayers(game)[0];
      endWithWinner(game,winner.id,`${winner.name} is de laatste overgebleven speler en wint.`);
      return;
    }
  }
}

function place(game,playerId,payload={}){
  if(game.phase!=='setup')throw new Error('De startopstelling is al voorbij.');
  const player=currentPlayer(game);
  if(!player||player.id!==playerId)throw new Error('Je bent niet aan de beurt.');
  const row=Number(payload.row),col=Number(payload.col);
  if(!inside(row,col))throw new Error('Ongeldig vak.');
  if(workerAt(game,row,col))throw new Error('Dat vak is bezet.');

  const worker=game.workers.find(item=>item.ownerId===playerId&&item.row===null);
  if(!worker)throw new Error('Al je workers zijn al geplaatst.');
  worker.row=row;worker.col=col;
  player.workersPlaced+=1;
  game.log.unshift(`${player.name} plaatst een worker.`);

  const allPlaced=game.players.every(item=>item.workersPlaced>=game.workersPerPlayer);
  if(allPlaced){
    game.phase='move';
    game.turnIndex=0;
    game.log.unshift(`${currentPlayer(game).name} begint.`);
    return;
  }

  for(let offset=1;offset<=game.players.length;offset++){
    const index=(game.turnIndex+offset)%game.players.length;
    if(game.players[index].workersPlaced<game.workersPerPlayer){
      game.turnIndex=index;
      break;
    }
  }
}

function move(game,playerId,payload={}){
  if(game.phase!=='move')throw new Error('Je moet nu niet verplaatsen.');
  const player=currentPlayer(game);
  if(!player||player.id!==playerId||!player.active)throw new Error('Je bent niet aan de beurt.');
  const worker=workerById(game,payload.workerId);
  if(!worker||worker.ownerId!==playerId)throw new Error('Kies een eigen worker.');
  const row=Number(payload.row),col=Number(payload.col);
  if(!legalMoves(game,worker).some(target=>target.row===row&&target.col===col))throw new Error('Ongeldige zet.');

  worker.row=row;worker.col=col;
  game.movedWorkerId=worker.id;
  game.log.unshift(`${player.name} verplaatst een worker.`);

  if(cellHeight(game,row,col)===3){
    endWithWinner(game,playerId,`${player.name} bereikt niveau 3 en wint.`);
    game.log.unshift(`${player.name} bereikt niveau 3.`);
    return;
  }
  game.phase='build';
}

function build(game,playerId,payload={}){
  if(game.phase!=='build')throw new Error('Je moet nu niet bouwen.');
  const player=currentPlayer(game);
  if(!player||player.id!==playerId||!player.active)throw new Error('Je bent niet aan de beurt.');
  const worker=workerById(game,game.movedWorkerId);
  if(!worker||worker.ownerId!==playerId)throw new Error('Geen geldige worker om mee te bouwen.');
  const row=Number(payload.row),col=Number(payload.col);
  if(!legalBuilds(game,worker).some(target=>target.row===row&&target.col===col))throw new Error('Daar kan je niet bouwen.');

  const index=cellIndex(row,col);
  game.board[index]+=1;
  const label=game.board[index]===DOME_LEVEL?'een koepel':`niveau ${game.board[index]}`;
  game.log.unshift(`${player.name} bouwt ${label}.`);
  game.phase='move';
  game.movedWorkerId=null;
  advanceTurn(game);
}

function handleAction(game,playerId,action,payload){
  if(game.gameOver)throw new Error('Het spel is afgelopen.');
  if(action==='place')return place(game,playerId,payload);
  if(action==='move')return move(game,playerId,payload);
  if(action==='build')return build(game,playerId,payload);
  throw new Error('Onbekende actie.');
}

function serialize(game,requesterId,connected){
  const me=playerById(game,requesterId);
  const moved=workerById(game,game.movedWorkerId);
  return {
    kind:game.gameKey,
    boardSize:BOARD_SIZE,
    board:game.board.slice(),
    phase:game.phase,
    workersPerPlayer:game.workersPerPlayer,
    gameOver:game.gameOver,
    winnerId:game.winnerId,
    resultText:game.resultText,
    turnPlayerId:game.gameOver?null:currentPlayer(game)?.id,
    movedWorkerId:game.movedWorkerId,
    players:game.players.map(player=>({
      id:player.id,name:player.name,isNpc:false,index:player.index,active:player.active,
      workersPlaced:player.workersPlaced,
      connected:connected?.get?Boolean(connected.get(player.id)):true
    })),
    workers:game.workers.filter(worker=>worker.row!==null).map(worker=>({...worker})),
    canPlace:game.phase==='setup'&&currentPlayer(game)?.id===requesterId,
    canMove:game.phase==='move'&&currentPlayer(game)?.id===requesterId&&me?.active,
    canBuild:game.phase==='build'&&currentPlayer(game)?.id===requesterId&&moved?.ownerId===requesterId,
    log:game.log.slice(0,24)
  };
}

function results(game){
  return game.players.map(player=>({
    playerId:player.id,
    placement:game.winnerId===player.id?1:2,
    score:game.winnerId===player.id?1:0,
    won:game.winnerId===player.id,
    outcome:game.winnerId===player.id?'Wint':'Verliest'
  }));
}

module.exports={createGame,handleAction,serialize,results,legalMoves,legalBuilds};
