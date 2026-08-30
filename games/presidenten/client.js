let state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList;
function bind(api){({state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList}=api)}
export function render(api){bind(api);renderPresidenten(api.room,api.game)}

function renderPresidenten(room,game) {
  const me=game.players.find(p=>p.id===room.meId);
  const turn=game.players.find(p=>p.id===game.turnPlayerId);
  const mine=me?.id===game.turnPlayerId;
  els.gameStage.append(titlebar('Presidenten',game.gameOver?'Spel afgelopen.':mine?'Jij bent aan de beurt.':`${turn?.name||''} is aan de beurt.`));

  const table=E('div','table-surface presidenten-surface');
  const banner=E('div',`turn-banner ${mine?'active':''}`,game.lead?`${game.lead.playerName}: ${game.lead.cards.map(c=>c.rank+c.suit).join(' ')} · speel ${game.lead.count} hoger`:'Vrij uitkomen');
  table.append(banner);

  const opponents=renderCardOpponents(room,game);if(opponents.childElementCount)table.append(opponents);
  const playArea=E('div','presidenten-play-area');
  if(game.previousPlay?.cards?.length){const previous=E('div','previous-play-panel');const cards=E('div','card-row');game.previousPlay.cards.forEach(c=>cards.append(cardNode(c,{button:false})));previous.append(E('span','eyebrow','VORIGE'),cards);playArea.append(previous)}
  const center=E('div','center-combo presidenten-center');
  (game.lead?.cards||[]).forEach(c=>center.append(cardNode(c,{button:false})));
  playArea.append(center);table.append(playArea);

  const hand=E('div','hand-area presidenten-hand');
  const row=E('div','card-fan presidenten-fan');
  const selected=new Set(state.selection?.game==='presidenten'?state.selection.ids||[]:[]);
  const playable=new Set(game.playableIds||[]);
  const selectedCards=(me?.hand||[]).filter(c=>selected.has(c.id));
  const selectedRank=selectedCards[0]?.rank;
  const requiredCount=game.lead?.count||null;
  (me?.hand||[]).forEach((c,index)=>{
    const canAdd=!selected.size||(c.rank===selectedRank&&(!requiredCount||selected.size<requiredCount)&&selected.size<4);
    const legal=mine&&!game.gameOver&&playable.has(c.id)&&(selected.has(c.id)||canAdd);
    const n=cardNode(c,{legal,selected:selected.has(c.id)});
    n.style.setProperty('z-index',String(index+1),'important');
    n.setAttribute('aria-disabled',legal?'false':'true');
    n.onclick=()=>{
      if(!legal)return;
      selected.has(c.id)?selected.delete(c.id):selected.add(c.id);
      state.selection={game:'presidenten',ids:[...selected]};
      renderGame(state.room)
    };
    row.append(n)
  });
  hand.append(E('span','eyebrow','JOUW HAND'),row);

  if(mine&&!game.gameOver){
    const ar=E('div','action-row presidenten-actions');
    const play=E('button','primary','Speel selectie');
    const sameRank=selectedCards.every(c=>c.rank===selectedRank);
    const validCount=requiredCount?selected.size===requiredCount:selected.size>0;
    play.disabled=!selected.size||!sameRank||!validCount||(game.firstLead&&!selected.has('3♣'));
    play.onclick=()=>{action('play',{ids:[...selected]});state.selection=null};
    const pass=E('button','secondary','Pas');
    pass.disabled=!game.canPass;
    pass.onclick=()=>{action('pass');state.selection=null};
    ar.append(play,pass);hand.append(ar)
  }
  table.append(hand,logBox(game.log));
  els.gameStage.append(table);
}

export function metric({player}){return {text:player.place?`#${player.place}`:`${player.handCount} kaarten`,score:null}}
export function presentResult({game}){const winner=game.players.find(p=>p.place===1);return {title:winner?.name||'President',copy:'is de winnaar.'}}
export function isWinner({player}){return player?.place===1}
