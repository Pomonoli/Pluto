let selectedWorkerId=null;

function key(row,col){return `${row},${col}`}
function cellHeight(game,row,col){return Number(game.board[row*game.boardSize+col]||0)}
function workerMap(game){return new Map((game.workers||[]).map(worker=>[key(worker.row,worker.col),worker]))}
function adjacent(game,row,col){
  const out=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    const r=row+dr,c=col+dc;
    if((dr||dc)&&r>=0&&r<game.boardSize&&c>=0&&c<game.boardSize)out.push({row:r,col:c});
  }
  return out;
}
function legalMoves(game,worker){
  if(!worker)return[];
  const occupied=workerMap(game);
  const from=cellHeight(game,worker.row,worker.col);
  return adjacent(game,worker.row,worker.col).filter(({row,col})=>
    !occupied.has(key(row,col))&&cellHeight(game,row,col)<4&&cellHeight(game,row,col)<=from+1
  );
}
function legalBuilds(game,worker){
  if(!worker)return[];
  const occupied=workerMap(game);
  return adjacent(game,worker.row,worker.col).filter(({row,col})=>
    !occupied.has(key(row,col))&&cellHeight(game,row,col)<4
  );
}
function building(E,height){
  const node=E('span',`santorini-building level-${height}`);
  for(let level=1;level<=Math.min(height,3);level++)node.append(E('i',`santorini-tier tier-${level}`));
  if(height===4)node.append(E('i','santorini-dome'));
  return node;
}
function workerNode(E,worker,player,selected,moved){
  const node=E('span',`santorini-worker player-${player?.index??0} ${selected?'selected':''} ${moved?'moved':''}`);
  node.append(E('i','santorini-head'),E('i','santorini-body'));
  return node;
}

export function render(api){renderSantorini(api)}

function renderSantorini({room,game,els,E,action,titlebar,logBox,renderGame}){
  const turn=game.players.find(player=>player.id===game.turnPlayerId);
  const status=game.gameOver?game.resultText:
    game.phase==='setup'?(game.canPlace?'Plaats je volgende worker.':`${turn?.name||''} plaatst een worker.`):
    game.phase==='move'?(game.canMove?'Kies een worker en verplaats hem.':`${turn?.name||''} is aan zet.`):
    game.canBuild?'Bouw één niveau naast je verplaatste worker.':`${turn?.name||''} bouwt.`;
  els.gameStage.append(titlebar('Santorini',status));

  const players=E('div',`santorini-players count-${game.players.length}`);
  game.players.forEach(player=>{
    const row=E('div',`santorini-player player-${player.index} ${player.id===game.turnPlayerId?'active':''} ${player.active?'':'eliminated'}`);
    row.append(E('span','santorini-color'),E('strong','',player.name));
    const state=game.phase==='setup'?`${player.workersPlaced}/${game.workersPerPlayer} geplaatst`:(player.active?'Actief':'Uitgeschakeld');
    row.append(E('small','',state));
    players.append(row);
  });
  els.gameStage.append(players);

  const workers=workerMap(game);
  const selected=(game.workers||[]).find(worker=>worker.id===selectedWorkerId&&worker.ownerId===room.meId);
  if(!selected||!game.canMove)selectedWorkerId=null;
  const moveTargets=new Set(game.canMove&&selected?legalMoves(game,selected).map(pos=>key(pos.row,pos.col)):[]);
  const moved=(game.workers||[]).find(worker=>worker.id===game.movedWorkerId);
  const buildTargets=new Set(game.canBuild&&moved?legalBuilds(game,moved).map(pos=>key(pos.row,pos.col)):[]);

  const board=E('div','santorini-board');
  board.style.setProperty('--board-size',String(game.boardSize));
  for(let row=0;row<game.boardSize;row++)for(let col=0;col<game.boardSize;col++){
    const position=key(row,col);
    const worker=workers.get(position);
    const owner=worker?game.players.find(player=>player.id===worker.ownerId):null;
    const height=cellHeight(game,row,col);
    const target=moveTargets.has(position)||buildTargets.has(position);
    const cell=E('button',`santorini-cell height-${height} ${target?'target':''}`);
    cell.type='button';
    cell.setAttribute('aria-label',`Vak ${row+1}, ${col+1}, niveau ${height}${worker?`, ${owner?.name||'worker'}`:''}`);
    cell.append(building(E,height));
    if(worker)cell.append(workerNode(E,worker,owner,worker.id===selectedWorkerId,worker.id===game.movedWorkerId));
    cell.onclick=()=>{
      if(game.canPlace&&!worker){action('place',{row,col});return}
      if(game.canMove){
        if(worker?.ownerId===room.meId){selectedWorkerId=worker.id;renderGame(room);return}
        if(selectedWorkerId&&moveTargets.has(position)){action('move',{workerId:selectedWorkerId,row,col});selectedWorkerId=null}
        return;
      }
      if(game.canBuild&&buildTargets.has(position))action('build',{row,col});
    };
    board.append(cell);
  }
  els.gameStage.append(board);

  const help=E('div','santorini-help');
  if(game.phase==='setup')help.textContent=`${game.players.length===4?'Iedere speler heeft 1 worker.':'Iedere speler heeft 2 workers.'} Plaats ze om beurten op vrije vakken.`;
  else help.textContent='Beweeg maximaal één niveau omhoog. Na je zet bouw je op een aangrenzend vrij vak. Niveau 4 is een koepel en is geblokkeerd.';
  els.gameStage.append(help,logBox(game.log));
}

export function metric({player,game}){
  return {text:game?.winnerId===player.id?'Win':(player.active?'Actief':'Uit'),score:game?.winnerId===player.id?1:0};
}
export function presentResult({game}){
  const winner=game.players.find(player=>player.id===game.winnerId);
  return {title:winner?.name||'Santorini',copy:game.resultText||'Spel afgelopen.'};
}
export function isWinner({game,myId}){return game.winnerId===myId}
