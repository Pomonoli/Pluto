let state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList;
function bind(api){({state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList}=api)}
export function render(api){bind(api);renderSolitaire(api.room,api.game)}
export const playerStrip=true;
export const roomOptions={};
export const leaderboardColumns=['#','Speler','Wins','Beste','Snelste'];
export function renderLeaderboardCells({row,E}){return [E('td','',String(row.wins)),E('td','',row.bestSolitaireMoves?String(row.bestSolitaireMoves):'—'),E('td','',formatSolitaireTime(row.bestSolitaireMs))]}
export function profileExtra({stat,formatDuration}){return stat.bestTimeMs?`Beste: ${formatDuration(stat.bestTimeMs)} · ${stat.bestMoves} zetten`:'—'}

function renderSolitaire(room,game) {
  const heading=titlebar('Solitaire',`${game.moves} zetten`);const restart=E('button','secondary sol-restart','Opnieuw beginnen');restart.type='button';restart.onclick=()=>{state.selection=null;action('restart')};heading.append(restart);els.gameStage.append(heading); const board=E('div','solitaire-board table-surface'); const top=E('div','sol-top'); const left=E('div','sol-stock-zone');
  const stock=E('button','sol-pile');stock.type='button';stock.title='Trek kaart';if(game.stockCount)stock.append(cardNode({hidden:true},{button:false}));else stock.textContent='↻';stock.onclick=()=>{state.selection=null;action('draw')};left.append(stock);
  const waste=E('div','sol-pile sol-waste');const visibleCount=Math.min(game.wasteVisibleCount??(game.waste.length?1:0),game.waste.length);const visibleCards=game.waste.slice(-visibleCount);visibleCards.forEach((card,i)=>{const isTop=i===visibleCards.length-1;const n=cardNode(card,{selected:isTop&&state.selection?.type==='waste'});n.style.setProperty('--waste-index',String(i));n.style.zIndex=String(i+1);if(isTop)n.onclick=(e)=>{e.stopPropagation();if(e.detail>=2){state.selection=null;action('wasteToFoundation');return}state.selection={game:'solitaire',type:'waste'};renderGame(state.room)};waste.append(n)});left.append(waste);top.append(left);
  const foundations=E('div','sol-foundations');['♣','♦','♥','♠'].forEach(suit=>{const pile=E('div','sol-pile');pile.dataset.suit=suit;const fc=game.foundations[suit][game.foundations[suit].length-1];if(fc){const n=cardNode(fc,{selected:state.selection?.type==='foundation'&&state.selection.suit===suit});n.onclick=(e)=>{e.stopPropagation();if(state.selection&&state.selection.type!=='foundation'){moveSolitaireToFoundation(suit)}else{state.selection={game:'solitaire',type:'foundation',suit};renderGame(state.room)}};pile.append(n)}else pile.textContent=suit;pile.onclick=()=>moveSolitaireToFoundation(suit);foundations.append(pile)});top.append(foundations);board.append(top);
  const tableau=E('div','sol-tableau');game.tableau.forEach((col,ci)=>{const c=E('div','sol-column');c.onclick=()=>moveSolitaireToTableau(ci);col.forEach((card,i)=>{const n=cardNode(card.faceUp?card:{hidden:true},{selected:state.selection?.type==='tableau'&&state.selection.src===ci&&state.selection.index===i});n.style.top=`calc(${i} * var(--sol-card-step, 25px))`;n.style.zIndex=String(i+1);n.onclick=(e)=>{e.stopPropagation();if(!card.faceUp)return;if(e.detail>=2&&i===col.length-1){state.selection=null;action('tableauToFoundation',{src:ci});return}if(state.selection&&!(state.selection.type==='tableau'&&state.selection.src===ci)){moveSolitaireToTableau(ci)}else{state.selection={game:'solitaire',type:'tableau',src:ci,index:i};renderGame(state.room)}};c.append(n)});tableau.append(c)});board.append(tableau);els.gameStage.append(board);
}

function formatSolitaireTime(ms){if(!ms)return '—';const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}

function moveSolitaireToFoundation(suit) { const s=state.selection;if(!s)return;if(s.type==='waste')action('wasteToFoundation');else if(s.type==='tableau')action('tableauToFoundation',{src:s.src});else return;state.selection=null; }

function moveSolitaireToTableau(dest) { const s=state.selection;if(!s)return;if(s.type==='waste')action('wasteToTableau',{dest});else if(s.type==='tableau'&&s.src!==dest)action('tableauMove',{src:s.src,index:s.index,dest});else if(s.type==='foundation')action('foundationToTableau',{suit:s.suit,dest});else return;state.selection=null; }

export function metric(){return {text:'solo',score:null}}
export function presentResult({room}){const winner=room.players.find(p=>p.id===room.meId);return {title:winner?.name||'Uitgespeeld',copy:'is de winnaar.'}}
export function isWinner({game}){return Boolean(game.gameOver)}
