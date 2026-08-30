const BOARD_SIZE=9;
const DIRECTIONS=[[-1,0],[1,0],[0,-1],[0,1]];
const STARTS=[
  {row:8,col:4,goalAxis:'row',goalValue:0,goalLabel:'boven'},
  {row:0,col:4,goalAxis:'row',goalValue:8,goalLabel:'onder'},
  {row:4,col:0,goalAxis:'col',goalValue:8,goalLabel:'rechts'},
  {row:4,col:8,goalAxis:'col',goalValue:0,goalLabel:'links'}
];

function wallsPerPlayer(count){
  if(count===2)return 10;
  if(count===3)return 6;
  return 5;
}

function createGame(roomPlayers){
  if(!Array.isArray(roomPlayers)||roomPlayers.length<2||roomPlayers.length>4)throw new Error('Quoridor is voor 2 tot 4 spelers.');
  const walls=wallsPerPlayer(roomPlayers.length);
  const players=roomPlayers.map((player,index)=>({
    id:player.id,
    name:player.name,
    isNpc:Boolean(player.isNpc),
    seat:index,
    row:STARTS[index].row,
    col:STARTS[index].col,
    goalAxis:STARTS[index].goalAxis,
    goalValue:STARTS[index].goalValue,
    goalLabel:STARTS[index].goalLabel,
    walls
  }));
  if(players.some(player=>player.isNpc))throw new Error('Quoridor ondersteunt voorlopig geen NPCs.');
  return {
    gameKey:'quoridor',
    boardSize:BOARD_SIZE,
    players,
    walls:[],
    turnIndex:0,
    gameOver:false,
    winnerId:null,
    resultText:'',
    log:[`${players[0].name} begint.`]
  };
}

function currentPlayer(game){return game.players[game.turnIndex]||null}
function key(row,col){return `${row},${col}`}
function inBounds(row,col){return row>=0&&row<BOARD_SIZE&&col>=0&&col<BOARD_SIZE}
function playerAt(game,row,col){return game.players.find(player=>player.row===row&&player.col===col)||null}

function edgeBlockedByWalls(a,b,walls){
  const rowDiff=b.row-a.row,colDiff=b.col-a.col;
  if(Math.abs(rowDiff)+Math.abs(colDiff)!==1)return true;
  if(rowDiff!==0){
    const boundaryRow=Math.min(a.row,b.row);
    return walls.some(wall=>wall.orientation==='h'&&wall.row===boundaryRow&&(wall.col===a.col||wall.col===a.col-1));
  }
  const boundaryCol=Math.min(a.col,b.col);
  return walls.some(wall=>wall.orientation==='v'&&wall.col===boundaryCol&&(wall.row===a.row||wall.row===a.row-1));
}

function edgeBlocked(game,a,b,walls=game.walls){return edgeBlockedByWalls(a,b,walls)}

function goalReached(player,row,col){return player.goalAxis==='row'?row===player.goalValue:col===player.goalValue}

function hasPath(game,player,walls){
  const queue=[{row:player.row,col:player.col}];
  const seen=new Set([key(player.row,player.col)]);
  for(let index=0;index<queue.length;index+=1){
    const pos=queue[index];
    if(goalReached(player,pos.row,pos.col))return true;
    for(const[dr,dc]of DIRECTIONS){
      const next={row:pos.row+dr,col:pos.col+dc};
      const nextKey=key(next.row,next.col);
      if(!inBounds(next.row,next.col)||seen.has(nextKey)||edgeBlockedByWalls(pos,next,walls))continue;
      seen.add(nextKey);
      queue.push(next);
    }
  }
  return false;
}

function wallConflicts(existing,candidate){
  if(existing.orientation===candidate.orientation){
    if(candidate.orientation==='h')return existing.row===candidate.row&&Math.abs(existing.col-candidate.col)<=1;
    return existing.col===candidate.col&&Math.abs(existing.row-candidate.row)<=1;
  }
  return existing.row===candidate.row&&existing.col===candidate.col;
}

function normalizeWall(payload){
  const row=Number(payload?.row),col=Number(payload?.col);
  const orientation=payload?.orientation==='v'?'v':payload?.orientation==='h'?'h':null;
  if(!Number.isInteger(row)||!Number.isInteger(col)||row<0||row>=BOARD_SIZE-1||col<0||col>=BOARD_SIZE-1||!orientation)return null;
  return {row,col,orientation};
}

function isValidWall(game,candidate){
  if(!candidate)return false;
  if(game.walls.some(wall=>wallConflicts(wall,candidate)))return false;
  const walls=[...game.walls,candidate];
  return game.players.every(player=>hasPath(game,player,walls));
}

function validWalls(game){
  const result=[];
  for(let row=0;row<BOARD_SIZE-1;row+=1){
    for(let col=0;col<BOARD_SIZE-1;col+=1){
      for(const orientation of ['h','v']){
        const candidate={row,col,orientation};
        if(isValidWall(game,candidate))result.push(candidate);
      }
    }
  }
  return result;
}

function legalMoves(game,player){
  const moves=new Map();
  const add=(row,col)=>moves.set(key(row,col),{row,col});
  const occupied=(row,col)=>playerAt(game,row,col);
  for(const[dr,dc]of DIRECTIONS){
    const adjacent={row:player.row+dr,col:player.col+dc};
    if(!inBounds(adjacent.row,adjacent.col)||edgeBlocked(game,{row:player.row,col:player.col},adjacent))continue;
    const neighbor=occupied(adjacent.row,adjacent.col);
    if(!neighbor){
      add(adjacent.row,adjacent.col);
      continue;
    }
    const behind={row:adjacent.row+dr,col:adjacent.col+dc};
    const canJump=inBounds(behind.row,behind.col)&&!edgeBlocked(game,adjacent,behind)&&!occupied(behind.row,behind.col);
    if(canJump){
      add(behind.row,behind.col);
      continue;
    }
    const sideDirections=dr!==0?[[0,-1],[0,1]]:[[-1,0],[1,0]];
    for(const[sr,sc]of sideDirections){
      const diagonal={row:adjacent.row+sr,col:adjacent.col+sc};
      if(!inBounds(diagonal.row,diagonal.col)||edgeBlocked(game,adjacent,diagonal)||occupied(diagonal.row,diagonal.col))continue;
      add(diagonal.row,diagonal.col);
    }
  }
  return [...moves.values()];
}

function endTurn(game){game.turnIndex=(game.turnIndex+1)%game.players.length}

function handleAction(game,playerId,action,payload){
  if(game.gameOver)throw new Error('Het spel is afgelopen.');
  const player=currentPlayer(game);
  if(!player||player.id!==playerId||player.isNpc)throw new Error('Je bent niet aan de beurt.');

  if(action==='move'){
    const row=Number(payload?.row),col=Number(payload?.col);
    if(!Number.isInteger(row)||!Number.isInteger(col)||!legalMoves(game,player).some(move=>move.row===row&&move.col===col))throw new Error('Ongeldige zet.');
    player.row=row;player.col=col;
    game.log.unshift(`${player.name} verplaatst zijn pion.`);
    if(goalReached(player,row,col)){
      game.gameOver=true;
      game.winnerId=player.id;
      game.resultText=`${player.name} bereikt de overkant en wint.`;
      game.log.unshift(game.resultText);
      return;
    }
    endTurn(game);
    return;
  }

  if(action==='wall'){
    if(player.walls<=0)throw new Error('Je hebt geen muren meer.');
    const candidate=normalizeWall(payload);
    if(!isValidWall(game,candidate))throw new Error('Deze muur mag hier niet staan. Iedere speler moet een route naar zijn doel houden.');
    game.walls.push(candidate);
    player.walls-=1;
    game.log.unshift(`${player.name} plaatst een ${candidate.orientation==='h'?'horizontale':'verticale'} muur.`);
    endTurn(game);
    return;
  }

  throw new Error('Onbekende actie.');
}

function serialize(game,requesterId,connected){
  const active=currentPlayer(game);
  const canAct=!game.gameOver&&active?.id===requesterId&&!active?.isNpc;
  return {
    kind:game.gameKey,
    boardSize:BOARD_SIZE,
    gameOver:game.gameOver,
    winnerId:game.winnerId,
    resultText:game.resultText,
    turnPlayerId:game.gameOver?null:active?.id||null,
    players:game.players.map(player=>({
      id:player.id,name:player.name,isNpc:player.isNpc,seat:player.seat,
      row:player.row,col:player.col,goalLabel:player.goalLabel,walls:player.walls,
      connected:player.isNpc||Boolean(connected?.get?.(player.id))
    })),
    walls:game.walls.map(wall=>({...wall})),
    canAct,
    legalMoves:canAct?legalMoves(game,active):[],
    validWalls:canAct&&active.walls>0?validWalls(game):[],
    log:game.log.slice(0,24)
  };
}

function results(game){
  return game.players.map(player=>({
    playerId:player.id,
    placement:player.id===game.winnerId?1:2,
    score:player.id===game.winnerId?1:0,
    won:player.id===game.winnerId,
    outcome:player.id===game.winnerId?'Wint':'Verliest'
  }));
}

module.exports={createGame,handleAction,serialize,results,legalMoves,isValidWall,hasPath};
