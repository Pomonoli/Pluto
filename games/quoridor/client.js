function wallGridPosition(node,wall){
  if(wall.orientation==='h'){
    node.style.gridRow=String(wall.row*2+2);
    node.style.gridColumn=String(wall.col*2+1);
    node.style.gridColumnEnd='span 3';
  }else{
    node.style.gridColumn=String(wall.col*2+2);
    node.style.gridRow=String(wall.row*2+1);
    node.style.gridRowEnd='span 3';
  }
}

export function render(api){renderQuoridor(api)}

function renderQuoridor({room,game,els,E,action,titlebar,logBox}){
  const me=game.players.find(player=>player.id===room.meId);
  const turn=game.players.find(player=>player.id===game.turnPlayerId);
  const status=game.gameOver?game.resultText:game.canAct?'Jij bent aan zet.':`${turn?.name||''} is aan zet.`;
  els.gameStage.append(titlebar('Quoridor',status));

  const shell=E('div','quoridor-shell');
  const players=E('div','quoridor-players');
  game.players.forEach(player=>{
    const card=E('div',`quoridor-player seat-${player.seat} ${player.id===game.turnPlayerId?'active':''} ${player.connected===false?'offline':''}`);
    const identity=E('div','quoridor-player-name');
    identity.append(E('span','quoridor-player-dot'),E('strong','',player.name));
    card.append(identity,E('span','quoridor-player-goal',`doel: ${player.goalLabel}`),E('b','quoridor-player-walls',`${player.walls} muren`));
    players.append(card);
  });
  shell.append(players);

  const help=E('div','quoridor-help',game.canAct?'Tik op een gemarkeerd vak om te bewegen, of kies hieronder een muurrichting.':game.gameOver?'':`Wachten op ${turn?.name||'de andere speler'}.`);
  if(help.textContent)shell.append(help);

  const boardWrap=E('div','quoridor-board-wrap');
  const board=E('div','quoridor-board');
  board.setAttribute('role','grid');
  board.setAttribute('aria-label','Quoridor speelbord');
  const legal=new Set((game.legalMoves||[]).map(move=>`${move.row},${move.col}`));
  const pawns=new Map(game.players.map(player=>[`${player.row},${player.col}`,player]));

  for(let row=0;row<game.boardSize;row+=1){
    for(let col=0;col<game.boardSize;col+=1){
      const canMove=game.canAct&&legal.has(`${row},${col}`);
      const cell=E('button',`quoridor-cell ${canMove?'legal':''}`);
      cell.type='button';
      cell.style.gridRow=String(row*2+1);
      cell.style.gridColumn=String(col*2+1);
      cell.disabled=!canMove;
      cell.setAttribute('aria-label',canMove?`Verplaats naar rij ${row+1}, kolom ${col+1}`:`Rij ${row+1}, kolom ${col+1}`);
      if(canMove)cell.onclick=()=>action('move',{row,col});
      const pawn=pawns.get(`${row},${col}`);
      if(pawn){
        const token=E('span',`quoridor-pawn seat-${pawn.seat}`);
        token.title=pawn.name;
        token.setAttribute('aria-label',pawn.name);
        cell.append(token);
      }
      board.append(cell);
    }
  }

  (game.walls||[]).forEach(wall=>{
    const node=E('div',`quoridor-wall ${wall.orientation==='h'?'horizontal':'vertical'}`);
    wallGridPosition(node,wall);
    board.append(node);
  });

  boardWrap.append(board);
  shell.append(boardWrap);

  if(game.canAct){
    const controls=E('div','quoridor-controls');
    if(me?.walls>0){
      const label=E('span','quoridor-control-label','Muur plaatsen');
      const horizontal=E('button','quoridor-orientation','↔ Horizontaal');
      const vertical=E('button','quoridor-orientation','↕ Verticaal');
      horizontal.type='button';vertical.type='button';
      const clearSlots=()=>board.querySelectorAll('.quoridor-wall-slot').forEach(node=>node.remove());
      const showSlots=(orientation,button)=>{
        clearSlots();
        horizontal.classList.toggle('selected',orientation==='h');
        vertical.classList.toggle('selected',orientation==='v');
        help.textContent='Tik op een licht merkteken tussen vier vakjes om de muur te plaatsen.';
        (game.validWalls||[]).filter(wall=>wall.orientation===orientation).forEach(wall=>{
          const slot=E('button',`quoridor-wall-slot ${orientation==='h'?'horizontal':'vertical'}`);
          slot.type='button';
          slot.style.gridRow=String(wall.row*2+2);
          slot.style.gridColumn=String(wall.col*2+2);
          slot.title=`${orientation==='h'?'Horizontale':'Verticale'} muur plaatsen`;
          slot.setAttribute('aria-label',slot.title);
          slot.onclick=()=>action('wall',{row:wall.row,col:wall.col,orientation});
          board.append(slot);
        });
        button.blur();
      };
      horizontal.onclick=()=>showSlots('h',horizontal);
      vertical.onclick=()=>showSlots('v',vertical);
      controls.append(label,horizontal,vertical);
    }else{
      controls.append(E('span','quoridor-no-walls','Geen muren meer. Je kunt alleen nog bewegen.'));
    }
    shell.append(controls);
  }

  els.gameStage.append(shell,logBox(game.log));
}

export function metric({player}){
  return {text:`${Number(player.walls||0)} muren`,score:Number(player.walls||0)};
}

export function isWinner({game,myId}){return game.winnerId===myId}

export function presentResult({game}){
  const winner=game.players.find(player=>player.id===game.winnerId);
  return winner?{title:winner.name,copy:'bereikt als eerste de overkant en wint Quoridor.'}:{title:'Quoridor',copy:game.resultText||'Spel afgelopen.'};
}
