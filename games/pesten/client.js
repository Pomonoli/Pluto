let state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList;
function bind(api){({state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList}=api)}
export function render(api){bind(api);renderPesten(api.room,api.game)}

function renderPesten(room,game) {
  const me=game.players.find(p=>p.id===room.meId),turn=game.players.find(p=>p.id===game.turnPlayerId),mine=me?.id===game.turnPlayerId;els.gameStage.append(titlebar('Pesten',game.gameOver?'Spel afgelopen.':mine?'Jouw beurt.':`${turn?.name||''} is aan de beurt.`));const table=E('div','table-surface');table.append(E('div','turn-banner',`${game.rulesNote} ${game.drawPenalty?`Openstaande straf: +${game.drawPenalty}.`:''}`));
  const opponents=renderCardOpponents(room,game);if(opponents.childElementCount)table.append(opponents);
  const top=E('div','pest-top');top.append(E('div','pest-direction',game.direction===1?'↻':'↺'));top.append(renderDiscardStack(game.previousCard?[game.previousCard]:[],[game.topCard]));const suit=E('div','pesten-current-suit',`Huidige suit: ${game.currentSuit}`);top.append(suit);table.append(top);
  const hand=E('div','hand-area');const row=E('div','card-fan pesten-fan');const playable=new Set(game.playableIds||[]);(me?.hand||[]).forEach((c,index)=>{const legal=mine&&playable.has(c.id);const n=cardNode(c,{legal,selected:state.selection?.game==='pesten'&&state.selection.cardId===c.id});n.style.setProperty('z-index',String(index+1),'important');n.setAttribute('aria-disabled',legal?'false':'true');n.onclick=()=>{if(!legal)return;if(c.rank==='J'){state.selection={game:'pesten',cardId:c.id};renderGame(state.room)}else action('play',{cardId:c.id})};row.append(n)});hand.append(E('span','eyebrow','JOUW HAND'),row);
  if(mine&&!game.gameOver){const ar=E('div','action-row');const draw=E('button','secondary',game.drawPenalty?`Neem +${game.drawPenalty}`:'Trek kaart');draw.onclick=()=>action('draw');ar.append(draw);hand.append(ar)}
  if(state.selection?.game==='pesten'&&state.selection.cardId&&mine){const picker=E('div','suit-picker');['♣','♦','♥','♠'].forEach(s=>{const b=E('button','secondary',s);b.onclick=()=>{action('play',{cardId:state.selection.cardId,suit:s});state.selection=null};picker.append(b)});hand.append(E('div','player-note','Kies een suit voor de Boer:'),picker)}table.append(hand,logBox(game.log));els.gameStage.append(table);
}

export function metric({player}){return {text:`${player.handCount} kaarten`,score:null}}
export function presentResult({game}){const winner=game.players.find(p=>p.handCount===0);return {title:winner?.name||'Winnaar',copy:'is de winnaar.'}}
export function isWinner({player}){return player?.handCount===0}
