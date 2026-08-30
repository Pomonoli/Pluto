let selectedPieceId=null;

function pieceLabel(piece){
  if(!piece.type)return '?';
  const labels={general:'G',captain:'K',soldier:'S',scout:'V',spy:'Sp',bomb:'B',flag:'⚑'};
  return labels[piece.type]||'?';
}

function pieceName(piece){return piece.name||'Onbekend stuk'}

function legalTargets(game,piece){
  if(!piece||piece.ownerId!==game.meId||piece.movable===false)return[];
  const occupied=new Map((game.pieces||[]).map(p=>[`${p.row},${p.col}`,p]));
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]],out=[];
  const max=piece.type==='scout'?game.boardSize-1:1;
  for(const[dr,dc]of dirs){
    for(let step=1;step<=max;step++){
      const row=piece.row+dr*step,col=piece.col+dc*step;
      if(row<0||row>=game.boardSize||col<0||col>=game.boardSize)break;
      const target=occupied.get(`${row},${col}`);
      if(target){
        if(target.ownerId!==piece.ownerId)out.push(`${row},${col}`);
        break;
      }
      out.push(`${row},${col}`);
      if(piece.type!=='scout')break;
    }
  }
  return out;
}

function renderPiece(E,piece,isMine,selected){
  const node=E('span',`stratego-piece ${isMine?'mine':'enemy'} ${selected?'selected':''} ${piece.known?'known':'concealed'}`);
  node.append(E('b','stratego-piece-rank',pieceLabel(piece)));
  node.title=piece.known?pieceName(piece):'Verborgen vijandelijk stuk';
  return node;
}

export function render(api){renderStratego(api)}

function renderStratego({room,game,els,E,action,titlebar,logBox,renderGame}){
  const me=game.players.find(player=>player.id===room.meId);
  const turn=game.players.find(player=>player.id===game.turnPlayerId);
  game.meId=room.meId;
  const status=game.gameOver?game.resultText:
    game.phase==='setup'?(me?.ready?'Wachten tot je tegenstander klaar is.':'Stel je leger op in je twee rijen.'):
    game.canMove?'Jij bent aan zet.':`${turn?.name||''} is aan zet.`;
  els.gameStage.append(titlebar('Stratego',status));

  const score=E('div','stratego-score');
  game.players.forEach(player=>{
    const row=E('div',`stratego-player ${player.id===game.turnPlayerId?'active':''}`);
    row.append(E('strong','',player.name),E('span','',`${player.piecesRemaining} stukken`),E('b','',`${player.captures} buit`));
    if(game.phase==='setup')row.append(E('small',player.ready?'ready':'',player.ready?'Klaar':'Opstellen'));
    score.append(row);
  });
  els.gameStage.append(score);

  if(game.phase==='setup'&&!me?.ready){
    els.gameStage.append(E('div','stratego-help','Tik een eigen stuk aan en daarna een vrij vak. Tik een tweede eigen stuk aan om beide te wisselen.'));
  }

  const piecesByCell=new Map((game.pieces||[]).map(piece=>[`${piece.row},${piece.col}`,piece]));
  const selected=(game.pieces||[]).find(piece=>piece.id===selectedPieceId&&piece.ownerId===room.meId);
  if(!selected)selectedPieceId=null;
  const targets=new Set(game.canMove&&selected?legalTargets(game,selected):[]);
  const rows=[...Array(game.boardSize).keys()];
  const cols=[...Array(game.boardSize).keys()];
  if(game.myPlayerIndex===1){rows.reverse();cols.reverse()}

  const board=E('div','stratego-board');
  board.style.setProperty('--board-size',String(game.boardSize));
  rows.forEach(row=>cols.forEach(col=>{
    const piece=piecesByCell.get(`${row},${col}`);
    const isMine=piece?.ownerId===room.meId;
    const cell=E('button',`stratego-cell ${targets.has(`${row},${col}`)?'target':''}`);
    cell.type='button';
    cell.setAttribute('aria-label',piece?(isMine?pieceName(piece):piece.known?`Vijandelijke ${pieceName(piece)}`:'Verborgen vijandelijk stuk'):`Vak ${row+1}, ${col+1}`);
    if(piece)cell.append(renderPiece(E,piece,isMine,piece.id===selectedPieceId));
    cell.onclick=()=>{
      if(game.phase==='setup'&&!me?.ready){
        if(isMine){
          if(selectedPieceId&&selectedPieceId!==piece.id){
            action('setupMove',{pieceId:selectedPieceId,row,col});
            selectedPieceId=null;
          }else{
            selectedPieceId=piece.id;
            renderGame(room);
          }
          return;
        }
        if(selectedPieceId){action('setupMove',{pieceId:selectedPieceId,row,col});selectedPieceId=null}
        return;
      }
      if(!game.canMove)return;
      if(isMine&&piece?.movable!==false){selectedPieceId=piece.id;renderGame(room);return}
      if(selectedPieceId&&targets.has(`${row},${col}`)){action('move',{pieceId:selectedPieceId,row,col});selectedPieceId=null}
    };
    board.append(cell);
  }));
  els.gameStage.append(board);

  if(game.phase==='setup'&&!me?.ready){
    const ready=E('button','primary stratego-ready','Klaar met opstelling');
    ready.type='button';
    ready.onclick=()=>{selectedPieceId=null;action('ready')};
    els.gameStage.append(ready);
  }

  const legend=E('div','stratego-legend');
  [
    ['5','Generaal'],['4','Kapitein'],['3','Soldaat ×2'],['2','Verkenner'],['1','Spion'],['B','Bom'],['⚑','Vlag']
  ].forEach(([rank,name])=>{
    const item=E('span','');
    item.append(E('b','',rank),E('span','',` ${name}`));
    legend.append(item);
  });
  els.gameStage.append(legend,logBox(game.log));
}

export function metric({player}){return {text:`${player.piecesRemaining} over`,score:Number(player.piecesRemaining||0)}}
export function presentResult({game}){
  const winner=game.players.find(player=>player.id===game.winnerId);
  if(!winner)return {title:'Stratego',copy:game.resultText||'Spel afgelopen.'};
  const noMoves=/niet meer bewegen/i.test(game.resultText||'');
  return {title:winner.name,copy:noMoves?'wint omdat de tegenstander geen geldige zet meer heeft.':'verovert de vlag en wint Stratego.'};
}
export function isWinner({game,myId}){return game.winnerId===myId}
