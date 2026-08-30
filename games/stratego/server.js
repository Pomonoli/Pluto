const BOARD_SIZE=6;
const PIECE_DEFS=[
  {type:'general',name:'Generaal',rank:5,movable:true},
  {type:'captain',name:'Kapitein',rank:4,movable:true},
  {type:'soldier',name:'Soldaat',rank:3,movable:true},
  {type:'soldier',name:'Soldaat',rank:3,movable:true},
  {type:'scout',name:'Verkenner',rank:2,movable:true},
  {type:'spy',name:'Spion',rank:1,movable:true},
  {type:'bomb',name:'Bom',rank:0,movable:false},
  {type:'flag',name:'Vlag',rank:-1,movable:false}
];

function homeRows(playerIndex){return playerIndex===0?[4,5]:[0,1]}
function inside(row,col){return row>=0&&row<BOARD_SIZE&&col>=0&&col<BOARD_SIZE}
function pieceAt(game,row,col){return game.pieces.find(piece=>piece.alive&&piece.row===row&&piece.col===col)}
function playerById(game,id){return game.players.find(player=>player.id===id)}
function currentPlayer(game){return game.players[game.turnIndex]}
function reveal(piece,...playerIds){for(const id of playerIds)if(id&&!piece.revealedTo.includes(id))piece.revealedTo.push(id)}

function createPieces(playerId,playerIndex){
  const rows=homeRows(playerIndex);
  const cells=[];
  for(const row of rows)for(let col=0;col<BOARD_SIZE;col++)cells.push([row,col]);
  return PIECE_DEFS.map((def,index)=>({
    id:`${playerId}-${index}`,
    ownerId:playerId,
    type:def.type,
    name:def.name,
    rank:def.rank,
    movable:def.movable,
    row:cells[index][0],
    col:cells[index][1],
    alive:true,
    revealedTo:[playerId]
  }));
}

function createGame(roomPlayers){
  if(roomPlayers.length!==2)throw new Error('Stratego is voor exact 2 spelers.');
  const players=roomPlayers.map((player,index)=>({
    id:player.id,name:player.name,isNpc:player.isNpc,index,ready:false,captures:0
  }));
  return {
    gameKey:'stratego',
    players,
    pieces:players.flatMap(player=>createPieces(player.id,player.index)),
    phase:'setup',
    turnIndex:Math.random()<0.5?0:1,
    gameOver:false,
    winnerId:null,
    resultText:'',
    log:['Plaats je leger en druk daarna op Klaar.'],
    nextNpcAt:0
  };
}

function assertHumanPlayer(game,playerId){
  const player=playerById(game,playerId);
  if(!player||player.isNpc)throw new Error('Ongeldige speler.');
  return player;
}

function setupMove(game,playerId,payload={}){
  const player=assertHumanPlayer(game,playerId);
  if(game.phase!=='setup')throw new Error('De opstelling is al voorbij.');
  if(player.ready)throw new Error('Je opstelling staat al vast.');
  const piece=game.pieces.find(p=>p.id===payload.pieceId&&p.ownerId===playerId&&p.alive);
  const row=Number(payload.row),col=Number(payload.col);
  if(!piece)throw new Error('Onbekend stuk.');
  if(!inside(row,col)||!homeRows(player.index).includes(row))throw new Error('Plaats je stukken in je eigen twee rijen.');
  const target=pieceAt(game,row,col);
  if(target&&target.ownerId!==playerId)throw new Error('Dat vak is bezet.');
  if(target&&target.id!==piece.id){
    const oldRow=piece.row,oldCol=piece.col;
    piece.row=row;piece.col=col;
    target.row=oldRow;target.col=oldCol;
  }else{
    piece.row=row;piece.col=col;
  }
}

function ready(game,playerId){
  const player=assertHumanPlayer(game,playerId);
  if(game.phase!=='setup')throw new Error('De opstelling is al voorbij.');
  player.ready=true;
  game.log.unshift(`${player.name} is klaar.`);
  if(game.players.every(p=>p.ready)){
    game.phase='play';
    game.log.unshift(`${currentPlayer(game).name} begint.`);
  }
}

function npcReady(game,player){
  const own=game.pieces.filter(piece=>piece.ownerId===player.id);
  const cells=[];
  for(const row of homeRows(player.index))for(let col=0;col<BOARD_SIZE;col++)cells.push([row,col]);
  for(let i=cells.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]]}
  own.forEach((piece,index)=>{piece.row=cells[index][0];piece.col=cells[index][1]});
  player.ready=true;
  game.log.unshift(`${player.name} is klaar.`);
  if(game.players.every(item=>item.ready)){game.phase='play';game.log.unshift(`${currentPlayer(game).name} begint.`)}
}

function legalTargets(game,piece){
  if(!piece?.alive||!piece.movable)return[];
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  const out=[];
  const max=piece.type==='scout'?BOARD_SIZE-1:1;
  for(const[dr,dc]of dirs){
    for(let step=1;step<=max;step++){
      const row=piece.row+dr*step,col=piece.col+dc*step;
      if(!inside(row,col))break;
      const target=pieceAt(game,row,col);
      if(target){
        if(target.ownerId!==piece.ownerId)out.push({row,col});
        break;
      }
      out.push({row,col});
      if(piece.type!=='scout')break;
    }
  }
  return out;
}

function resolveCombat(game,attacker,defender){
  reveal(attacker,defender.ownerId);
  reveal(defender,attacker.ownerId);
  const attackerOwner=playerById(game,attacker.ownerId);
  const defenderOwner=playerById(game,defender.ownerId);

  if(defender.type==='flag'){
    defender.alive=false;
    attacker.row=defender.row;attacker.col=defender.col;
    attackerOwner.captures+=1;
    game.gameOver=true;
    game.phase='over';
    game.winnerId=attacker.ownerId;
    game.resultText=`${attackerOwner.name} verovert de vlag en wint.`;
    game.log.unshift(`${attackerOwner.name} verovert de vlag van ${defenderOwner.name}.`);
    return;
  }

  let attackerWins;
  if(attacker.type==='spy'&&defender.type==='general')attackerWins=true;
  else if(defender.type==='bomb')attackerWins=attacker.type==='scout';
  else attackerWins=attacker.rank>defender.rank;

  const equal=attacker.rank===defender.rank&&defender.type!=='bomb';
  if(equal){
    attacker.alive=false;defender.alive=false;
    game.log.unshift(`${attacker.name} en ${defender.name} schakelen elkaar uit.`);
    return;
  }
  if(attackerWins){
    defender.alive=false;
    attacker.row=defender.row;attacker.col=defender.col;
    attackerOwner.captures+=1;
    game.log.unshift(`${attacker.name} verslaat ${defender.name}.`);
  }else{
    attacker.alive=false;
    defenderOwner.captures+=1;
    game.log.unshift(`${defender.name} verslaat ${attacker.name}.`);
  }
}

function hasMove(game,playerId){
  return game.pieces.some(piece=>piece.ownerId===playerId&&piece.alive&&legalTargets(game,piece).length);
}

function move(game,playerId,payload={}){
  if(game.phase!=='play')throw new Error('Het spel is nog niet begonnen.');
  const player=currentPlayer(game);
  if(!player||player.id!==playerId||player.isNpc)throw new Error('Je bent niet aan de beurt.');
  const piece=game.pieces.find(p=>p.id===payload.pieceId&&p.ownerId===playerId&&p.alive);
  if(!piece||!piece.movable)throw new Error('Dat stuk kan niet bewegen.');
  const row=Number(payload.row),col=Number(payload.col);
  if(!legalTargets(game,piece).some(target=>target.row===row&&target.col===col))throw new Error('Ongeldige zet.');
  const defender=pieceAt(game,row,col);
  if(defender)resolveCombat(game,piece,defender);
  else{piece.row=row;piece.col=col;game.log.unshift(`${player.name} verplaatst een stuk.`)}
  if(game.gameOver)return;

  game.turnIndex=(game.turnIndex+1)%game.players.length;
  const next=currentPlayer(game);
  if(!hasMove(game,next.id)){
    game.gameOver=true;
    game.phase='over';
    game.winnerId=playerId;
    game.resultText=`${player.name} wint: ${next.name} kan niet meer bewegen.`;
    game.log.unshift(`${next.name} heeft geen geldige zetten meer.`);
  }
}

function npcMove(game,player){
  const options=[];
  for(const piece of game.pieces.filter(item=>item.ownerId===player.id&&item.alive&&item.movable)){
    for(const target of legalTargets(game,piece))options.push({piece,target,attack:Boolean(pieceAt(game,target.row,target.col))});
  }
  if(!options.length)return;
  const attacks=options.filter(option=>option.attack);
  const choice=(attacks.length?attacks:options)[Math.floor(Math.random()*(attacks.length||options.length))];
  const defender=pieceAt(game,choice.target.row,choice.target.col);
  if(defender)resolveCombat(game,choice.piece,defender);
  else{choice.piece.row=choice.target.row;choice.piece.col=choice.target.col;game.log.unshift(`${player.name} verplaatst een stuk.`)}
  if(game.gameOver)return;
  game.turnIndex=(game.turnIndex+1)%game.players.length;
  const next=currentPlayer(game);
  if(!hasMove(game,next.id)){game.gameOver=true;game.phase='over';game.winnerId=player.id;game.resultText=`${player.name} wint: ${next.name} kan niet meer bewegen.`}
}

function scheduleNpc(game,delay=700){
  const npc=game.phase==='setup'?game.players.find(player=>player.isNpc&&!player.ready):currentPlayer(game);
  game.nextNpcAt=!game.gameOver&&npc?.isNpc?Date.now()+delay:0;
}
function tick(game,now=Date.now()){
  if(game.gameOver)return false;
  const npc=game.phase==='setup'?game.players.find(player=>player.isNpc&&!player.ready):currentPlayer(game);
  if(!npc?.isNpc){game.nextNpcAt=0;return false}
  if(!game.nextNpcAt)game.nextNpcAt=now+700;
  if(now<game.nextNpcAt)return false;
  if(game.phase==='setup')npcReady(game,npc);else npcMove(game,npc);
  scheduleNpc(game);return true;
}

function handleAction(game,playerId,action,payload){
  if(game.gameOver)throw new Error('Het spel is afgelopen.');
  if(action==='setupMove')return setupMove(game,playerId,payload);
  if(action==='ready')return ready(game,playerId);
  if(action==='move')return move(game,playerId,payload);
  throw new Error('Onbekende actie.');
}

function publicPiece(piece,requesterId,gameOver){
  const own=piece.ownerId===requesterId;
  const known=own||gameOver||piece.revealedTo.includes(requesterId);
  return {
    id:piece.id,ownerId:piece.ownerId,row:piece.row,col:piece.col,alive:piece.alive,
    type:known?piece.type:null,
    name:known?piece.name:null,
    rank:known?piece.rank:null,
    movable:known?piece.movable:null,
    known
  };
}

function serialize(game,requesterId,connected){
  const me=playerById(game,requesterId);
  return {
    kind:game.gameKey,
    phase:game.phase,
    gameOver:game.gameOver,
    winnerId:game.winnerId,
    resultText:game.resultText,
    turnPlayerId:game.phase==='play'&&!game.gameOver?currentPlayer(game)?.id:null,
    boardSize:BOARD_SIZE,
    players:game.players.map(player=>({
      id:player.id,name:player.name,isNpc:player.isNpc,index:player.index,ready:player.ready,captures:player.captures,
      connected:player.isNpc||connected.get(player.id),
      piecesRemaining:game.pieces.filter(piece=>piece.ownerId===player.id&&piece.alive).length
    })),
    pieces:game.pieces.filter(piece=>piece.alive).map(piece=>publicPiece(piece,requesterId,game.gameOver)),
    myPlayerIndex:me?.index??0,
    canSetup:game.phase==='setup'&&!me?.ready,
    canReady:game.phase==='setup'&&!me?.ready,
    canMove:game.phase==='play'&&currentPlayer(game)?.id===requesterId,
    log:game.log.slice(0,24)
  };
}

function results(game){
  return game.players.map(player=>({
    playerId:player.id,
    placement:game.winnerId===player.id?1:2,
    score:game.pieces.filter(piece=>piece.ownerId===player.id&&piece.alive).length,
    won:game.winnerId===player.id,
    outcome:game.winnerId===player.id?'Wint':'Verliest'
  }));
}

module.exports={createGame,handleAction,serialize,results,legalTargets,tick};
