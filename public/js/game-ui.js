function scrollNodes(root){return root?[root,...(root.querySelectorAll?.('*')||[])]:[]}
function scrollNodeKey(node){
  if(node.id)return `id:${node.id}`;
  const explicit=node.dataset?.scrollKey;if(explicit)return `data:${explicit}`;
  const classes=node.classList?.[Symbol.iterator]
    ?[...node.classList].sort().join('.')
    :String(node.className||'').trim().split(/\s+/).filter(Boolean).sort().join('.');
  return `${String(node.tagName||node.tag||'node').toLowerCase()}.${classes}`;
}
export function captureScrollState(root,viewport=typeof window==='undefined'?null:window){
  const occurrences=new Map(),positions=[];
  for(const node of scrollNodes(root)){
    const key=scrollNodeKey(node),index=occurrences.get(key)||0;occurrences.set(key,index+1);
    const top=Number(node.scrollTop)||0,left=Number(node.scrollLeft)||0;
    if(top||left)positions.push({key,index,top,left});
  }
  return{positions,viewport:{top:Number(viewport?.scrollY)||0,left:Number(viewport?.scrollX)||0}};
}
export function restoreScrollState(root,snapshot,viewport=typeof window==='undefined'?null:window){
  if(!snapshot)return;
  const buckets=new Map();
  for(const node of scrollNodes(root)){
    const key=scrollNodeKey(node);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(node);
  }
  for(const position of snapshot.positions||[]){
    const node=buckets.get(position.key)?.[position.index];
    if(node){node.scrollTop=position.top;node.scrollLeft=position.left}
  }
  viewport?.scrollTo?.(snapshot.viewport?.left||0,snapshot.viewport?.top||0);
}

export function createGameUi(ctx) {
  const { state, els, E, action, profileButton, sound, socket, handleAck, cardNode, valueLabel, requestRematch, requestReturnToLobby, requestLeaveFinishedRoom } = ctx;
  const pluginRenderers=new Map();
  let renderedStageKey=null;

function dismissResult(){els.gameResult.classList.add('hidden');els.gameResult.setAttribute('aria-hidden','true')}
function resultActions(room){
  const actions=E('div','result-modal-actions');
  if(room.isHost){
    const rematch=E('button','primary','Rematch');rematch.onclick=()=>requestRematch(rematch);
    const lobby=E('button','secondary','Naar lobby');lobby.onclick=()=>requestReturnToLobby(lobby);
    const close=E('button','secondary','Sluiten');close.onclick=dismissResult;
    actions.append(rematch,lobby,close);
  }else{
    const rematch=E('button','primary','Rematch');rematch.onclick=dismissResult;
    const leave=E('button','danger-button','Verlaten');leave.onclick=()=>requestLeaveFinishedRoom(leave);
    actions.append(rematch,leave);
  }
  return actions;
}

function resultPresentation(room,game){
  const plugin=pluginRenderers.get(game.kind);if(plugin?.presentResult){const result=plugin.presentResult({room,game});if(result)return result}
  let winners=[];
  if(!winners.length){
    const text=String(game.resultText||'');
    if(/dealer wint/i.test(text))return {title:'Dealer',copy:'is de winnaar.'};
    winners=(room.players||[]).filter(player=>text.includes(player.name));
  }
  if(winners.length===1)return {title:winners[0].name,copy:'is de winnaar.'};
  return {title:'Gelijkspel',copy:'Er is geen unieke winnaar.'};
}

function renderGame(room) {
  const game=room.gameState;if(!game)return;state.selection=normalizeSelection(state.selection,game);
  const plugin=pluginRenderers.get(game.kind);
  if(plugin?.shouldSkipRender?.({room,game,state}))return;
  const scrollState=captureScrollState(els.gameStage);
  const showGameResult=Boolean(game.gameOver&&plugin?.showResult!==false);
  const stageKey=JSON.stringify([room.id,game.kind]);
  if(!plugin?.preserveStage || renderedStageKey!==stageKey)els.gameStage.replaceChildren();
  renderedStageKey=stageKey;
  els.gameResult.replaceChildren();els.gameResult.classList.toggle('hidden',!showGameResult);els.gameResult.classList.remove('result-pop');
  if(showGameResult){
    els.gameResult.classList.add('result-pop');const presentation=resultPresentation(room,game),resultCard=E('div','result-modal-card');
    resultCard.append(E('span','eyebrow','SPEL AFGELOPEN'),E('h2','result-modal-title',presentation.title),E('p','result-modal-copy',presentation.copy));
    const details=plugin?.renderResultDetails?.({room,game,E});if(details){resultCard.classList.add('has-details');resultCard.append(details)}
    resultCard.append(resultActions(room));els.gameResult.append(resultCard);els.gameResult.setAttribute('aria-hidden','false');
  }
  if(!plugin?.render){els.gameStage.append(pluginError(game.kind,'Renderer wordt geladen…'));return}
  try{if(plugin.playerStrip)els.gameStage.append(renderGamePlayerStrip(room,game));plugin.render(pluginApi(room,game));restoreScrollState(els.gameStage,scrollState)}
  catch(error){console.error(`Renderer van ${game.kind} faalde:`,error);els.gameStage.replaceChildren(pluginError(game.kind,'Deze game kon niet worden weergegeven.'))}
}

function pluginApi(room,game){return {room,game,state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList,resultActions:()=>resultActions(room)}}
function pluginError(key,message){const box=E('div','plugin-error');box.append(E('strong','',`Game “${key}” kon niet laden.`),E('p','',message));return box}

function gameMetric(game,p) {
  const plugin=pluginRenderers.get(game.kind);if(plugin?.metric){const metric=plugin.metric({game,player:p});if(metric)return metric}
  return {text:'',score:null};
}

function renderGamePlayerStrip(room,game) {
  const wrap=E('div','game-player-strip');
  const roomById=new Map(room.players.map(p=>[p.id,p]));
  let anyScoreChange=false;
  (game.players||[]).forEach(p=>{
    const rp=roomById.get(p.id)||{};
    const metric=gameMetric(game,p);
    const plugin=pluginRenderers.get(game.kind),active=plugin?.isPlayerActive?plugin.isPlayerActive({game,player:p}):p.id===game.turnPlayerId;
    const item=E('div',`game-player-chip ${active?'active':''} ${p.id===room.meId?'me':''}`);
    const head=E('div','game-player-name');
    head.append(profileButton(p.name,Boolean(rp.registered),'profile-chip-link'));
    if(p.id===room.meId)head.append(document.createTextNode(' · jij'));
    const metricRow=E('div','game-player-metric',metric.text);
    if(metric.score!==null){
      const key=`${room.id}|${game.kind}|${p.id}`;
      const old=state.scoreMemory[key];
      if(old!==undefined && metric.score>old){
        const d=E('span','score-delta',`+${metric.score-old}`);metricRow.append(d);anyScoreChange=true;
      }
      state.scoreMemory[key]=metric.score;
    }
    item.append(head,metricRow);wrap.append(item);
  });
  if(anyScoreChange)sound('score');
  return wrap;
}

function normalizeSelection(sel, game) { if (!sel || sel.game !== game.kind) return null; return sel; }

// The shared in-game header already owns the game name. Keep this helper for
// game-specific status and actions without rendering a duplicate title.
function titlebar(_name,status) {const wrap=E('div','game-titlebar');wrap.append(E('div','game-status',status));return wrap}
function logBox(lines) { const box=E('div','log-box'); (lines||[]).slice(0,18).forEach(line=>box.append(E('div','log-line',line))); return box; }




function scoreList(players, valueFn) { const box=E('div','score-list'); players.forEach(p=>{const r=E('div','score-row');r.append(E('span',`player-dot ${p.connected?'connected':''}`),E('div','player-name',`${p.name}${p.isNpc?' · NPC':''}`),E('strong','',valueFn(p)));box.append(r)});return box; }

function renderCardOpponents(room,game){
  const opponents=E('div','card-opponents');
  game.players.filter(p=>p.id!==room.meId).forEach(p=>{
    const seat=E('div',`card-opponent ${p.id===game.turnPlayerId?'active':''}`);
    seat.append(E('strong','',`${p.name}${p.isNpc?' · NPC':''}`));
    const backs=E('div','card-backs');
    const visible=Math.min(p.handCount,12);
    for(let i=0;i<visible;i+=1)backs.append(E('span','card-back-mini'));
    if(p.handCount>visible)backs.append(E('small','',`+${p.handCount-visible}`));
    if(p.place)backs.append(E('small','',`#${p.place}`));
    seat.append(backs);opponents.append(seat)
  });
  return opponents;
}

function renderDiscardStack(previousCards,currentCards){
  const stack=E('div','discard-stack');
  if(previousCards?.length){const previous=E('div','discard-layer previous');previousCards.forEach(c=>previous.append(cardNode(c,{button:false})));stack.append(previous)}
  const current=E('div','discard-layer current');(currentCards||[]).forEach(c=>current.append(cardNode(c,{button:false})));stack.append(current);
  return stack;
}

























  return {
    renderGame,
    gameMetric,
    registerPlugin(key,plugin){if(!key||typeof plugin?.render!=='function')throw new Error('Game-plugin mist render().');pluginRenderers.set(key,plugin)},
    onResize(){const room=state.room,game=room?.gameState,plugin=game&&pluginRenderers.get(game.kind);plugin?.onResize?.(pluginApi(room,game))},
    resetRoom(){renderedStageKey=null;for(const plugin of pluginRenderers.values())plugin.onRoomReset?.()},
  };
}
