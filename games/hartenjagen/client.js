let state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList;
function bind(api){({state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList}=api)}
export function render(api){bind(api);renderHartenjagen(api.room,api.game)}
export const playerStrip=true;

function renderHartenjagen(room,game) {
  const me=game.players.find(p=>p.id===room.meId);const suitOrder=new Map([['♣',0],['♦',1],['♠',2],['♥',3]]);const handCards=(me?.hand||[]).slice().sort((a,b)=>suitOrder.get(a.suit)-suitOrder.get(b.suit));let status='';if(game.phase==='passing')status=me?.passed?'Kaarten gekozen. Wachten op de anderen.':'Kies 3 kaarten.';else if(game.resolvingTrick)status='Slag compleet';else{const turn=game.players.find(p=>p.id===game.turnPlayerId);status=me?.id===game.turnPlayerId?'Jij bent aan de beurt.':`${turn?.name||''} is aan de beurt.`}els.gameStage.append(titlebar('Hartenjagen',`Ronde ${game.roundNumber} · ${status}`));const grid=E('div','hearts-table');const table=E('div','table-surface');const banner=E('div','turn-banner',`Slag ${game.trickNumber}/13 · ${game.heartsBroken?'Harten is gebroken':'Harten nog niet gebroken'} · passen: ${passDutch(game.passDirection)}`);table.append(banner);const trick=E('div','hearts-trick');const meIndex=Math.max(0,game.players.findIndex(p=>p.id===room.meId));const clockwise=game.players.map((_,i)=>game.players[(meIndex+i)%game.players.length]);const seats=clockwise.length===4?[clockwise[0],clockwise[1],clockwise[3],clockwise[2]]:clockwise;seats.forEach(p=>{const seat=E('div','trick-seat');seat.append(E('strong','',p.name));const play=game.trick.find(x=>x.playerId===p.id);if(play)seat.append(cardNode(play.card,{button:false}));else seat.append(E('div','player-note',''));trick.append(seat)});table.append(trick);grid.append(table);
  const hand=E('div',`table-surface hearts-hand ${game.phase==='passing'?'passing':'compact'}`);const row=E('div','card-fan hearts-fan');if(game.phase==='passing'){const selected=new Set(state.selection?.game==='hartenjagen'?state.selection.ids||[]:[]);handCards.forEach((c,index)=>{const available=!me?.passed&&!game.gameOver;const n=cardNode(c,{selected:selected.has(c.id)});n.style.setProperty('z-index',String(index+1),'important');n.setAttribute('aria-disabled',available?'false':'true');n.onclick=()=>{if(!available)return;if(selected.has(c.id))selected.delete(c.id);else if(selected.size<3)selected.add(c.id);state.selection={game:'hartenjagen',ids:[...selected]};renderGame(state.room)};row.append(n)});hand.append(E('span','eyebrow','JOUW HAND'),row);if(!me?.passed){const b=E('button','primary','Pas 3 kaarten');b.disabled=selected.size!==3;b.onclick=()=>{action('pass',{ids:[...selected]});state.selection=null};hand.append(b)}}else{const legal=new Set(game.legalIds||[]);handCards.forEach((c,index)=>{const canPlay=legal.has(c.id)&&!game.gameOver;const n=cardNode(c,{legal:canPlay});n.style.setProperty('z-index',String(index+1),'important');n.setAttribute('aria-disabled',canPlay?'false':'true');n.onclick=()=>{if(canPlay)action('play',{cardId:c.id})};row.append(n)});hand.append(E('span','eyebrow','JOUW HAND'),row)}grid.append(hand);els.gameStage.append(grid);
  const scoreButton=E('button','hearts-score-button','Score');scoreButton.type='button';scoreButton.onclick=()=>openScorePopup(game);els.gameStage.append(scoreButton);
}

function openScorePopup(game){
  els.gameStage.querySelector('.hearts-score-backdrop')?.remove();
  const backdrop=E('div','hearts-score-backdrop'),modal=E('section','hearts-score-modal');
  const heading=E('div','hearts-score-heading');
  heading.append(E('div','',undefined),E('h2','','Score'));
  const close=E('button','hearts-score-close','×');close.type='button';close.setAttribute('aria-label','Score sluiten');heading.append(close);
  const tbl=E('table','score-table'),head=E('tr');
  ['Speler','Ronde','Totaal'].forEach(label=>head.append(E('th','',label)));tbl.append(head);
  game.players.forEach(player=>{const row=E('tr');row.append(E('td','',player.name),E('td','',String(player.roundPoints)),E('td','',String(player.totalScore)));tbl.append(row)});
  modal.append(heading,tbl);
  if(game.lastRoundSummary)modal.append(E('p','player-note',game.lastRoundSummary));
  const dismiss=()=>backdrop.remove();close.onclick=dismiss;backdrop.onclick=(event)=>{if(event.target===backdrop)dismiss()};
  backdrop.append(modal);els.gameStage.append(backdrop);
}

function passDutch(dir){return ({left:'links',right:'rechts',across:'tegenover',hold:'niet'})[dir]||dir}

export function metric({player}){return {text:String(player.totalScore),score:Number(player.totalScore||0)}}
export function presentResult({game}){const low=Math.min(...game.players.map(p=>p.totalScore)),w=game.players.filter(p=>p.totalScore===low);return w.length===1?{title:w[0].name,copy:'is de winnaar.'}:{title:'Gelijkspel',copy:'Er is geen unieke winnaar.'}}
export function isWinner({game,myId}){const low=Math.min(...game.players.map(p=>p.totalScore));return game.players.filter(p=>p.totalScore===low).length===1&&game.players.find(p=>p.id===myId)?.totalScore===low}
