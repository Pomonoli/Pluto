let state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList;
function bind(api){({state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList}=api)}
export function render(api){bind(api);renderBlackjack(api.room,api.game)}
export const showResult=false;
export const roomOptions={allowRematch:false};
export const leaderboardColumns=['#','Speler','Chips'];
export function renderLeaderboardCells({row,E}){return [E('td','',String(row.chips))]}

function renderBlackjack(room,game) {
  const me=game.players.find(p=>p.id===room.meId); const turn=game.players.find(p=>p.id===game.turnPlayerId); const status=game.phase==='round_end'?'Ronde afgelopen':game.phase==='dealer'?'Dealer speelt stap voor stap…':turn?`${turn.name} is aan de beurt.`:'Dealer speelt.';const heading=titlebar('Blackjack',status);heading.classList.add('blackjack-titlebar');els.gameStage.append(heading);
  if(me){const wallet=E('div','blackjack-wallet');wallet.append(E('span','','Jouw chips'),E('strong','',String(me.chips??100)),E('small','',`Inzet: ${me.bet??10}`));els.gameStage.append(wallet)}
  const table=E('div','blackjack-table'); const dealer=E('div','blackjack-player');dealer.append(E('div','blackjack-meta','Dealer'));const dealerHand=E('div','blackjack-hand');const cards=E('div','card-row');game.dealer.hand.forEach(c=>cards.append(cardNode(c,{button:false})));dealerHand.append(cards,E('strong','blackjack-total',game.dealer.value===null?'?':String(game.dealer.value)));dealer.append(dealerHand);table.append(dealer);
  const zone=E('div','players-zone'); game.players.forEach(p=>{const chips=p.chips??100;const b=E('div',`blackjack-player ${p.id===game.turnPlayerId?'active':''}`);const m=E('div','blackjack-meta');m.append(E('strong','',p.name),E('span','',`${chips} chips`));b.append(m);(p.hands||[{cards:p.hand,value:p.value,bet:p.bet,result:p.result,chipDelta:p.chipDelta}]).forEach((h,index)=>{const handBox=E('div',`blackjack-split-hand ${p.id===game.turnPlayerId&&index===p.activeHandIndex?'active':''}`);if((p.hands||[]).length>1)handBox.append(E('small','',`Hand ${index+1} · inzet ${h.bet}`));const hand=E('div','blackjack-hand');const row=E('div','card-row');h.cards.forEach(c=>row.append(cardNode(c,{button:false})));hand.append(row,E('strong','blackjack-total',String(h.value)));handBox.append(hand);b.append(handBox)});if(p.resetChips)b.append(E('div','player-note','Reset naar 100 chips'));zone.append(b)});table.append(zone);
  if(game.phase==='round_end'&&me){const results=(me.hands||[]).filter(h=>h.result).map((h,index)=>`${(me.hands||[]).length>1?`Hand ${index+1}: `:''}${h.result} (${h.chipDelta>0?'+':''}${h.chipDelta})`);if(results.length)table.append(E('div','blackjack-round-result',results.join(' · ')))}
  if(me?.id===game.turnPlayerId&&game.phase==='players'){const ar=E('div','blackjack-actions');const hit=E('button','primary','Hit');hit.onclick=()=>action('hit');const stand=E('button','secondary','Stand');stand.onclick=()=>action('stand');ar.append(hit,stand);if(me.canDouble){const double=E('button','secondary','Double');double.onclick=()=>action('double');ar.append(double)}if(me.canSplit){const split=E('button','secondary','Split');split.onclick=()=>action('split');ar.append(split)}table.append(ar)}
  if(game.phase==='round_end'){const ar=E('div','blackjack-actions');const again=E('button','primary','Opnieuw');again.onclick=()=>action('newRound');ar.append(again);table.append(ar)}
  els.gameStage.append(table,logBox(game.log));
}

export function metric({player}){return {text:player.result||`${player.value??''}`,score:null}}
export function isWinner({player}){return player?.result==='Wint'}
