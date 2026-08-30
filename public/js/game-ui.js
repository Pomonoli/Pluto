export function createGameUi(ctx) {
  const { state, els, E, action, profileButton, sound, socket, handleAck, cardNode, valueLabel, requestRematch } = ctx;

function resultPresentation(room,game){
  let winners=[];
  if(game.kind==='blackjack')winners=(game.players||[]).filter(player=>['Wint','Blackjack'].includes(player.result));
  else if(game.kind==='cluedo')winners=(game.players||[]).filter(player=>player.id===game.winnerId);
  else if(game.kind==='presidenten')winners=(game.players||[]).filter(player=>player.place===1);
  else if(game.kind==='pesten')winners=(game.players||[]).filter(player=>player.handCount===0);
  else if(game.kind==='hofslag'&&game.players?.length){const best=Math.max(...game.players.map(player=>player.score));winners=game.players.filter(player=>player.score===best)}
  else if(game.kind==='hartenjagen'&&game.players?.length){const best=Math.min(...game.players.map(player=>player.totalScore));winners=game.players.filter(player=>player.totalScore===best)}
  else if(game.kind==='carcassonne'&&game.players?.length){const best=Math.max(...game.players.map(player=>player.score));winners=game.players.filter(player=>player.score===best)}
  else if(game.kind==='minigolf'&&game.players?.length){const best=Math.max(...game.players.map(player=>player.totalPoints));winners=game.players.filter(player=>player.totalPoints===best)}
  else if(game.kind==='solitaire')winners=(game.players||room.players||[]).filter(player=>player.id===room.meId).slice(0,1);
  if(!winners.length){
    const text=String(game.resultText||'');
    if(/dealer wint/i.test(text))return {title:'Dealer',copy:'is de winnaar.'};
    winners=(room.players||[]).filter(player=>text.includes(player.name));
  }
  if(winners.length===1)return {title:winners[0].name,copy:'is de winnaar.'};
  return {title:'Gelijkspel',copy:'Er is geen unieke winnaar.'};
}

function renderGame(room) {
  const game = room.gameState; if (!game) return; state.selection = normalizeSelection(state.selection, game);
  if (game.kind === 'hofslag' && state.hofAnimation?.active && state.hofAnimation.round === game.lastRound?.round) return;
  const showGameResult=Boolean(game.gameOver&&game.kind!=='blackjack');
  els.gameStage.replaceChildren(); els.gameResult.replaceChildren(); els.gameResult.classList.toggle('hidden', !showGameResult); els.gameResult.classList.remove('result-pop');
  if (showGameResult) {
    els.gameResult.classList.add('result-pop');
    const presentation=resultPresentation(room,game);
    const resultCard = E('div','result-modal-card');
    resultCard.append(E('span','eyebrow','SPEL AFGELOPEN'));
    resultCard.append(E('h2','result-modal-title',presentation.title));
    resultCard.append(E('p','result-modal-copy',presentation.copy));
    const actions = E('div','result-modal-actions');
    if (room.isHost) {
      const rematch = E('button','primary','Rematch');
      rematch.onclick=()=>requestRematch(rematch);
      actions.append(rematch);
    }
    const close = E('button','secondary','Sluiten');
    close.onclick=()=>{els.gameResult.classList.add('hidden');els.gameResult.setAttribute('aria-hidden','true')};
    actions.append(close);resultCard.append(actions);els.gameResult.append(resultCard);
    els.gameResult.setAttribute('aria-hidden','false');
  }
  // Hofslag gebruikt bewust opnieuw zijn eigen v0.4 renderpad.
  // Geen generieke player-strip of andere wrapper vóór de Hofslag-renderer.
  if (game.kind === 'hofslag') {
    renderHofslag(room, game);
    return;
  }

  if(!['minigolf','blackjack','pesten','presidenten','carcassonne'].includes(game.kind))els.gameStage.append(renderGamePlayerStrip(room,game));
  const renderer = { blackjack:renderBlackjack, solitaire:renderSolitaire, presidenten:renderPresidenten, pesten:renderPesten, hartenjagen:renderHartenjagen, cluedo:renderCluedo, carcassonne:renderCarcassonne, minigolf:renderMinigolf }[game.kind];
  if (renderer) renderer(room, game); else els.gameStage.textContent = 'Renderer ontbreekt.';
}

function gameMetric(game,p) {
  if(game.kind==='hofslag')return {text:`${p.score} pt`,score:Number(p.score||0)};
  if(game.kind==='hartenjagen')return {text:String(p.totalScore),score:Number(p.totalScore||0)};
  if(game.kind==='blackjack')return {text:p.result||`${p.value ?? ''}`,score:null};
  if(game.kind==='presidenten')return {text:p.place?`#${p.place}`:`${p.handCount} kaarten`,score:null};
  if(game.kind==='pesten')return {text:`${p.handCount} kaarten`,score:null};
  if(game.kind==='cluedo')return {text:p.canAccuse?`${p.handCount} kaarten`:'uit',score:null};
  if(game.kind==='carcassonne')return {text:`${p.score} pt · ${p.meeples} horigen`,score:Number(p.score||0)};
  if(game.kind==='minigolf')return {text:`${p.totalPoints} pt`,score:Number(p.totalPoints||0)};
  if(game.kind==='solitaire')return {text:'solo',score:null};
  return {text:'',score:null};
}
function renderGamePlayerStrip(room,game) {
  const wrap=E('div','game-player-strip');
  const roomById=new Map(room.players.map(p=>[p.id,p]));
  let anyScoreChange=false;
  (game.players||[]).forEach(p=>{
    const rp=roomById.get(p.id)||{};
    const metric=gameMetric(game,p);
    const active=p.id===game.turnPlayerId || (game.kind==='hofslag'&&!p.pending&&!game.gameOver);
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

function titlebar(name,status) {const wrap=E('div','game-titlebar');const left=E('div');left.append(E('span','eyebrow',name.toUpperCase()));wrap.append(left,E('div','game-status',status));return wrap}
function logBox(lines) { const box=E('div','log-box'); (lines||[]).slice(0,18).forEach(line=>box.append(E('div','log-line',line))); return box; }

function renderHofslag(room, game) {
  const me = game.players.find(p=>p.id===room.meId);
  const offline = game.players.find(p=>!p.isNpc&&!p.connected);
  const shouldAnimate =
    game.lastRound &&
    game.lastRound.boardBefore &&
    game.lastRound.round > state.hofAnimatedRound &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const animating = shouldAnimate || Boolean(state.hofAnimation?.active);
  const status = game.gameOver
    ? 'Spel afgelopen.'
    : animating
      ? `Ronde ${game.lastRound?.round || game.round}: pionnen bewegen…`
      : offline
        ? `Gepauzeerd: ${offline.name} offline.`
        : me?.pending
          ? 'Kaart gekozen. Wachten op de anderen.'
          : 'Kies één kaart.';

  els.gameStage.append(titlebar('Hofslag',status));

  const board = E('div','hof-board');
  const center = E('div','hof-center');
  center.append(E('span','eyebrow','RONDE'),E('div','round-number',String(game.round)));
  const stats = E('div','stat-grid');
  [['Beeldkaarten',game.facesLeft],['Resterende punten',game.pointsLeft]].forEach(([l,v])=>{
    const d=E('div');d.append(E('span','',l),E('strong','',String(v)));stats.append(d)
  });
  center.append(stats); board.append(center);
  els.gameStage.append(board);

  const handArea=E('div','hand-area');
  const row=E('div','card-row');
  (me?.hand||[]).forEach(v=>{
    const c=cardNode({rank:valueLabel(v),suit:me.suit},{legal:!me.pending&&!game.gameOver&&!offline&&!animating});
    c.disabled=me.pending||game.gameOver||Boolean(offline)||animating;
    c.onclick=()=>action('playCard',{value:v});
    row.append(c);
  });
  handArea.append(E('span','eyebrow','JOUW HAND'),row);
  els.gameStage.append(handArea, scoreList(game.players,p=>`${p.score} pt`), logBox(game.log));

  if (shouldAnimate) startHofAnimation(board, game);
  else requestAnimationFrame(()=>renderHofBoard(board,game));
}

function startHofAnimation(board, game) {
  const round = game.lastRound.round;
  if (state.hofAnimation?.active && state.hofAnimation.round === round) return;

  const plays = game.lastRound.plays || [];
  const maxMove = Math.max(0,...plays.map(p=>p.move||0));
  const animation = { round, active:true, step:0, timer:null };
  state.hofAnimation = animation;

  const frame = () => {
    if (!animation.active || !board.isConnected) return;
    const positions = {};
    for (const play of plays) {
      positions[play.playerId] = (play.from + Math.min(animation.step, play.move)) % 12;
    }

    const useFinalBoard = animation.step >= maxMove;
    renderHofBoard(board, game, {
      positions,
      boardOverride: useFinalBoard ? game.board : game.lastRound.boardBefore
    });

    if (animation.step < maxMove) {
      animation.step += 1;
      animation.timer = setTimeout(frame, 220);
    } else {
      animation.timer = setTimeout(()=>{
        animation.active = false;
        state.hofAnimatedRound = Math.max(state.hofAnimatedRound, round);
        state.hofAnimation = null;
        if (state.room?.gameState?.kind === 'hofslag') renderGame(state.room);
      }, 420);
    }
  };

  frame();
}

function renderHofBoard(board,game,opts={}) {
  if (!board.isConnected) return;
  board.querySelectorAll('.hof-card').forEach(n=>n.remove());

  const cards = opts.boardOverride || game.board;
  const positions = opts.positions || Object.fromEntries(game.players.map(p=>[p.id,p.pos]));
  const w=board.clientWidth||700,h=board.clientHeight||590,cx=w/2,cy=h/2;
  let rx=Math.min(w*.40,390),ry=Math.min(h*.39,230);
  if(w<520){rx=Math.max(112,w*.39);ry=Math.max(150,h*.39)}

  cards.forEach((card,i)=>{
    const a=(-90+i*30)*Math.PI/180,x=cx+rx*Math.cos(a),y=cy+ry*Math.sin(a);
    const el=E('div',`hof-card ${card.kind==='face'?'face':'replaced'}`);
    el.style.left=`${x}px`;el.style.top=`${y}px`;
    const tokens=E('div','tokens');

    game.players.filter(p=>positions[p.id]===i).forEach(p=>{
      const t=E('div','token',p.name[0].toUpperCase());
      t.style.background=p.color;t.title=p.name;tokens.append(t)
    });

    const cont=E('div','hof-content');
    const red=card.suit==='♥'||card.suit==='♦';
    cont.append(
      E('div',`hof-rank ${red?'red':'black'}`,card.kind==='face'?card.rank:valueLabel(card.value)),
      E('div',`hof-suit ${red?'red':'black'}`,card.suit),
      E('div','hof-meta',card.kind==='face'?`${card.points} pt${card.points===1?'':'n'}`:card.ownerName)
    );
    el.append(tokens,cont);board.append(el)
  });
}

function scoreList(players, valueFn) { const box=E('div','score-list'); players.forEach(p=>{const r=E('div','score-row');r.append(E('span',`player-dot ${p.connected?'connected':''}`),E('div','player-name',`${p.name}${p.isNpc?' · NPC':''}`),E('strong','',valueFn(p)));box.append(r)});return box; }

function renderCardOpponents(room,game){
  const opponents=E('div','pesten-opponents');
  game.players.filter(p=>p.id!==room.meId).forEach(p=>{
    const seat=E('div',`pesten-opponent ${p.id===game.turnPlayerId?'active':''}`);
    seat.append(E('strong','',`${p.name}${p.isNpc?' · NPC':''}`));
    const backs=E('div','pesten-card-backs');
    const visible=Math.min(p.handCount,12);
    for(let i=0;i<visible;i+=1)backs.append(E('span','pesten-card-back'));
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

function renderSolitaire(room,game) {
  els.gameStage.append(titlebar('Solitaire',`${game.moves} zetten`)); const board=E('div','solitaire-board table-surface'); const top=E('div','sol-top'); const left=E('div','sol-stock-zone');
  const stock=E('button','sol-pile');stock.type='button';stock.title='Trek kaart';if(game.stockCount)stock.append(cardNode({hidden:true},{button:false}));else stock.textContent='↻';stock.onclick=()=>{state.selection=null;action('draw')};left.append(stock);
  const waste=E('div','sol-pile');const wc=game.waste[game.waste.length-1];if(wc){const n=cardNode(wc,{selected:state.selection?.type==='waste'});n.onclick=(e)=>{e.stopPropagation();if(e.detail>=2){state.selection=null;action('wasteToFoundation');return}state.selection={game:'solitaire',type:'waste'};renderGame(state.room)};waste.append(n)}left.append(waste);top.append(left);
  const foundations=E('div','sol-foundations');['♣','♦','♥','♠'].forEach(suit=>{const pile=E('div','sol-pile');pile.dataset.suit=suit;const fc=game.foundations[suit][game.foundations[suit].length-1];if(fc){const n=cardNode(fc,{selected:state.selection?.type==='foundation'&&state.selection.suit===suit});n.onclick=(e)=>{e.stopPropagation();if(state.selection&&state.selection.type!=='foundation'){moveSolitaireToFoundation(suit)}else{state.selection={game:'solitaire',type:'foundation',suit};renderGame(state.room)}};pile.append(n)}else pile.textContent=suit;pile.onclick=()=>moveSolitaireToFoundation(suit);foundations.append(pile)});top.append(foundations);board.append(top);
  const tableau=E('div','sol-tableau');game.tableau.forEach((col,ci)=>{const c=E('div','sol-column');c.onclick=()=>moveSolitaireToTableau(ci);col.forEach((card,i)=>{const n=cardNode(card.faceUp?card:{hidden:true},{selected:state.selection?.type==='tableau'&&state.selection.src===ci&&state.selection.index===i});n.style.top=`${i*25}px`;n.style.zIndex=String(i+1);n.onclick=(e)=>{e.stopPropagation();if(!card.faceUp)return;if(e.detail>=2&&i===col.length-1){state.selection=null;action('tableauToFoundation',{src:ci});return}if(state.selection&&!(state.selection.type==='tableau'&&state.selection.src===ci)){moveSolitaireToTableau(ci)}else{state.selection={game:'solitaire',type:'tableau',src:ci,index:i};renderGame(state.room)}};c.append(n)});tableau.append(c)});board.append(tableau);els.gameStage.append(board);
}
function moveSolitaireToFoundation(suit) { const s=state.selection;if(!s)return;if(s.type==='waste')action('wasteToFoundation');else if(s.type==='tableau')action('tableauToFoundation',{src:s.src});else return;state.selection=null; }
function moveSolitaireToTableau(dest) { const s=state.selection;if(!s)return;if(s.type==='waste')action('wasteToTableau',{dest});else if(s.type==='tableau'&&s.src!==dest)action('tableauMove',{src:s.src,index:s.index,dest});else if(s.type==='foundation')action('foundationToTableau',{suit:s.suit,dest});else return;state.selection=null; }

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

function renderPesten(room,game) {
  const me=game.players.find(p=>p.id===room.meId),turn=game.players.find(p=>p.id===game.turnPlayerId),mine=me?.id===game.turnPlayerId;els.gameStage.append(titlebar('Pesten',game.gameOver?'Spel afgelopen.':mine?'Jouw beurt.':`${turn?.name||''} is aan de beurt.`));const table=E('div','table-surface');table.append(E('div','turn-banner',`${game.rulesNote} ${game.drawPenalty?`Openstaande straf: +${game.drawPenalty}.`:''}`));
  const opponents=renderCardOpponents(room,game);if(opponents.childElementCount)table.append(opponents);
  const top=E('div','pest-top');top.append(E('div','pest-direction',game.direction===1?'↻':'↺'));top.append(renderDiscardStack(game.previousCard?[game.previousCard]:[],[game.topCard]));const suit=E('div','pesten-current-suit',`Huidige suit: ${game.currentSuit}`);top.append(suit);table.append(top);
  const hand=E('div','hand-area');const row=E('div','card-fan pesten-fan');const playable=new Set(game.playableIds||[]);(me?.hand||[]).forEach((c,index)=>{const legal=mine&&playable.has(c.id);const n=cardNode(c,{legal,selected:state.selection?.game==='pesten'&&state.selection.cardId===c.id});n.style.setProperty('z-index',String(index+1),'important');n.setAttribute('aria-disabled',legal?'false':'true');n.onclick=()=>{if(!legal)return;if(c.rank==='J'){state.selection={game:'pesten',cardId:c.id};renderGame(state.room)}else action('play',{cardId:c.id})};row.append(n)});hand.append(E('span','eyebrow','JOUW HAND'),row);
  if(mine&&!game.gameOver){const ar=E('div','action-row');const draw=E('button','secondary',game.drawPenalty?`Neem +${game.drawPenalty}`:'Trek kaart');draw.onclick=()=>action('draw');ar.append(draw);hand.append(ar)}
  if(state.selection?.game==='pesten'&&state.selection.cardId&&mine){const picker=E('div','suit-picker');['♣','♦','♥','♠'].forEach(s=>{const b=E('button','secondary',s);b.onclick=()=>{action('play',{cardId:state.selection.cardId,suit:s});state.selection=null};picker.append(b)});hand.append(E('div','player-note','Kies een suit voor de Boer:'),picker)}table.append(hand,logBox(game.log));els.gameStage.append(table);
}

function renderHartenjagen(room,game) {
  const me=game.players.find(p=>p.id===room.meId);const suitOrder=new Map([['♣',0],['♦',1],['♠',2],['♥',3]]);const handCards=(me?.hand||[]).slice().sort((a,b)=>suitOrder.get(a.suit)-suitOrder.get(b.suit));let status='';if(game.phase==='passing')status=me?.passed?'Kaarten gekozen. Wachten op de anderen.':'Kies 3 kaarten.';else if(game.resolvingTrick)status='Slag compleet';else{const turn=game.players.find(p=>p.id===game.turnPlayerId);status=me?.id===game.turnPlayerId?'Jij bent aan de beurt.':`${turn?.name||''} is aan de beurt.`}els.gameStage.append(titlebar('Hartenjagen',`Ronde ${game.roundNumber} · ${status}`));const grid=E('div','hearts-table');const table=E('div','table-surface');const banner=E('div','turn-banner',`Slag ${game.trickNumber}/13 · ${game.heartsBroken?'Harten is gebroken':'Harten nog niet gebroken'} · passen: ${passDutch(game.passDirection)}`);table.append(banner);const trick=E('div','hearts-trick');const meIndex=Math.max(0,game.players.findIndex(p=>p.id===room.meId));const clockwise=game.players.map((_,i)=>game.players[(meIndex+i)%game.players.length]);const seats=clockwise.length===4?[clockwise[0],clockwise[1],clockwise[3],clockwise[2]]:clockwise;seats.forEach(p=>{const seat=E('div','trick-seat');seat.append(E('strong','',p.name));const play=game.trick.find(x=>x.playerId===p.id);if(play)seat.append(cardNode(play.card,{button:false}));else seat.append(E('div','player-note',''));trick.append(seat)});table.append(trick);grid.append(table);
  const hand=E('div',`table-surface hearts-hand ${game.phase==='passing'?'passing':'compact'}`);const row=E('div','card-fan hearts-fan');if(game.phase==='passing'){const selected=new Set(state.selection?.game==='hartenjagen'?state.selection.ids||[]:[]);handCards.forEach((c,index)=>{const available=!me?.passed&&!game.gameOver;const n=cardNode(c,{selected:selected.has(c.id)});n.style.setProperty('z-index',String(index+1),'important');n.setAttribute('aria-disabled',available?'false':'true');n.onclick=()=>{if(!available)return;if(selected.has(c.id))selected.delete(c.id);else if(selected.size<3)selected.add(c.id);state.selection={game:'hartenjagen',ids:[...selected]};renderGame(state.room)};row.append(n)});hand.append(E('span','eyebrow','JOUW HAND'),row);if(!me?.passed){const b=E('button','primary','Pas 3 kaarten');b.disabled=selected.size!==3;b.onclick=()=>{action('pass',{ids:[...selected]});state.selection=null};hand.append(b)}}else{const legal=new Set(game.legalIds||[]);handCards.forEach((c,index)=>{const canPlay=legal.has(c.id)&&!game.gameOver;const n=cardNode(c,{legal:canPlay});n.style.setProperty('z-index',String(index+1),'important');n.setAttribute('aria-disabled',canPlay?'false':'true');n.onclick=()=>{if(canPlay)action('play',{cardId:c.id})};row.append(n)});hand.append(E('span','eyebrow','JOUW HAND'),row)}grid.append(hand);els.gameStage.append(grid);
  const scores=E('div','table-surface hearts-scores');const tbl=E('table','score-table');const head=E('tr');['Speler','Ronde','Totaal'].forEach(x=>head.append(E('th','',x)));tbl.append(head);game.players.forEach(p=>{const r=E('tr');r.append(E('td','',p.name),E('td','',String(p.roundPoints)),E('td','',String(p.totalScore)));tbl.append(r)});scores.append(tbl);if(game.lastRoundSummary)scores.append(E('p','player-note',game.lastRoundSummary));els.gameStage.append(scores,logBox(game.log));
}
function passDutch(dir){return ({left:'links',right:'rechts',across:'tegenover',hold:'niet'})[dir]||dir}


function cluedoNoteKey(roomId, cardId){return `${roomId}|${cardId}`}
function getCluedoNote(roomId, cardId){return state.cluedoNotes[cluedoNoteKey(roomId,cardId)]||0}
function cycleCluedoNote(roomId, cardId){
  const key=cluedoNoteKey(roomId,cardId);
  state.cluedoNotes[key]=(getCluedoNote(roomId,cardId)+1)%3;
  return state.cluedoNotes[key];
}
function clueLabel(card){return ({suspect:'Verdachte',weapon:'Wapen',room:'Kamer'})[card.category]||card.category}

function renderCluedo(room,game) {
  const me=game.players.find(p=>p.id===room.meId);
  const turn=game.players.find(p=>p.id===game.turnPlayerId);
  const mine=me?.id===game.turnPlayerId;
  const own=new Set((me?.hand||[]).map(c=>c.id));

  els.gameStage.append(titlebar(
    'Cluedo',
    game.gameOver?'Mysterie opgelost.':mine?'Jouw beurt: maak een suggestie of beschuldiging.':`${turn?.name||''} denkt na…`
  ));

  const layout=E('div','cluedo-layout');
  const main=E('div','table-surface');

  if(game.lastSuggestion){
    const s=game.lastSuggestion;
    const box=E('div','cluedo-last');
    box.append(
      E('span','eyebrow','LAATSTE SUGGESTIE'),
      E('strong','',`${s.playerName}: ${s.suspect} · ${s.weapon} · ${s.room}`),
      E('div','player-note',s.disprovedByName?`${s.disprovedByName} kon één kaart tonen.`:'Niemand kon dit weerleggen.')
    );
    main.append(box);
  }

  if(game.privateReveal){
    const reveal=E('div','cluedo-reveal');
    reveal.append(
      E('span','eyebrow','ALLEEN VOOR JOU'),
      E('strong','',`${game.privateReveal.byName} toonde: ${game.privateReveal.card.name}`),
      E('div','player-note',clueLabel(game.privateReveal.card))
    );
    main.append(reveal);
  }

  const form=E('div','cluedo-form');
  const selects={};
  const savedSelections=state.cluedoSelections?.[room.id]||{};
  [['suspect','Verdachte'],['weapon','Wapen'],['room','Kamer']].forEach(([key,label])=>{
    const wrap=E('label','cluedo-field');
    wrap.append(E('span','',label));
    const sel=document.createElement('select');
    (game.categories[key]||[]).forEach(name=>{
      const id=`${key}:${name}`;const note=getCluedoNote(room.id,id);const isOwned=own.has(id);const o=document.createElement('option');o.value=name;o.textContent=isOwned?`● ${name} (in hand)`:note===1?`✕ ${name}`:note===2?`★ ${name}`:`? ${name}`;o.className=isOwned?'cluedo-option-owned':note===1?'cluedo-option-excluded':note===2?'cluedo-option-suspect':'';o.selected=savedSelections[key]===name;sel.append(o)
    });
    sel.onchange=()=>{state.cluedoSelections[room.id]={...(state.cluedoSelections[room.id]||{}),[key]:sel.value}};
    selects[key]=sel;wrap.append(sel);form.append(wrap)
  });

  const rememberCluedoSelections=()=>{state.cluedoSelections[room.id]={suspect:selects.suspect.value,weapon:selects.weapon.value,room:selects.room.value};return state.cluedoSelections[room.id]};

  const ar=E('div','action-row');
  const suggest=E('button','primary','Doe suggestie');
  suggest.disabled=!mine||game.gameOver||!me?.canAccuse;
  suggest.onclick=()=>action('suggest',rememberCluedoSelections());

  const accuse=E('button','danger-button','Beschuldig definitief');
  accuse.disabled=!mine||game.gameOver||!me?.canAccuse;
  accuse.onclick=()=>{
    if(confirm('Dit is definitief. Bij een foute beschuldiging kan je niet meer winnen.')){
      action('accuse',rememberCluedoSelections())
    }
  };
  ar.append(suggest,accuse);form.append(ar);

  if(me && !me.canAccuse) form.append(E('div','cluedo-eliminated','Je beschuldiging was fout. Je blijft kaarten tonen, maar kan niet meer winnen.'));
  main.append(form);

  const hand=E('div','hand-area');
  const handRow=E('div','clue-hand');
  const categoryOrder={suspect:0,weapon:1,room:2};const knownCards=(me?.hand||[]).slice().sort((a,b)=>categoryOrder[a.category]-categoryOrder[b.category]||a.name.localeCompare(b.name,'nl'));knownCards.forEach(card=>{
    const c=E('div',`clue-card ${card.category}`);
    c.append(E('span','clue-category',clueLabel(card)),E('strong','',card.name));
    handRow.append(c)
  });
  hand.append(E('span','eyebrow','JOUW GEKENDE KAARTEN'),handRow);
  main.append(hand);
  layout.append(main);

  const notes=E('aside','cluedo-notes');
  notes.append(E('span','eyebrow','NOTITIEBLOK'));
  [['suspect','Verdachten'],['weapon','Wapens'],['room','Kamers']].forEach(([key,title])=>{
    const section=E('section','cluedo-note-section');
    section.append(E('h3','',title));
    (game.categories[key]||[]).forEach(name=>{
      const id=`${key}:${name}`;
      const note=getCluedoNote(room.id,id);const row=E('button',`cluedo-note ${own.has(id)?'owned':note===1?'note-excluded':note===2?'note-suspect':''}`);
      row.type='button';
      row.append(E('span','',name),E('strong','',own.has(id)?'IN HAND':note===1?'✕':note===2?'★':'?'));
      row.disabled=own.has(id);
      if(!own.has(id))row.onclick=()=>{const next=cycleCluedoNote(room.id,id);row.classList.toggle('note-excluded',next===1);row.classList.toggle('note-suspect',next===2);row.querySelector('strong').textContent=next===1?'✕':next===2?'★':'?';const option=[...selects[key].options].find(item=>item.value===name);if(option){option.textContent=next===1?`✕ ${name}`:next===2?`★ ${name}`:`? ${name}`;option.className=next===1?'cluedo-option-excluded':next===2?'cluedo-option-suspect':''}};
      section.append(row)
    });
    notes.append(section)
  });

  layout.append(notes);
  els.gameStage.append(layout);
}

function carcassonneTileNode(tile,{preview=false}={}){
  const node=E('div',`carc-tile ${preview?'preview':''}`);node.setAttribute('aria-label',`Landschapstegel ${tile.type||''}`);
  ['north','east','south','west'].forEach((side,index)=>{const edge=E('span',`carc-edge ${side} type-${tile.edges[index]}`);node.append(edge)});
  if((tile.roads||[]).length)node.append(E('span','carc-road-center'));
  if(tile.monastery)node.append(E('span','carc-monastery','⌂'));
  if(tile.shield)node.append(E('span','carc-shield','◆'));
  return node
}

function attachCarcassonneViewport(viewport,board,view){
  const pointers=new Map();let drag=null,pinch=null;
  const apply=()=>{board.style.transform=`translate(calc(-50% + ${view.x}px),calc(-50% + ${view.y}px)) scale(${view.scale})`};apply();
  viewport.addEventListener('pointerdown',event=>{if(event.target.closest('button'))return;viewport.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===1)drag={x:event.clientX,y:event.clientY,ox:view.x,oy:view.y};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:view.scale};drag=null}event.preventDefault()});
  viewport.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()];view.scale=Math.max(.45,Math.min(2.2,pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)))}else if(drag){view.x=drag.ox+event.clientX-drag.x;view.y=drag.oy+event.clientY-drag.y}apply();event.preventDefault()});
  const end=event=>{pointers.delete(event.pointerId);drag=null;pinch=null};viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
  viewport.addEventListener('wheel',event=>{view.scale=Math.max(.45,Math.min(2.2,view.scale*(event.deltaY>0?.9:1.1)));apply();event.preventDefault()},{passive:false})
}

function renderCarcassonne(room,game){
  const me=game.players.find(p=>p.id===room.meId),turn=game.players.find(p=>p.id===game.turnPlayerId),mine=turn?.id===room.meId;
  const status=game.gameOver?'Landschap voltooid.':mine?(game.phase==='place'?'Leg je tegel.':'Plaats eventueel een horige.'):`${turn?.name||''} is aan de beurt.`;
  els.gameStage.append(titlebar('Carcassonne',status));
  const dashboard=E('div','carc-dashboard');game.players.forEach(p=>{const item=E('div',`carc-player ${p.id===game.turnPlayerId?'active':''}`);item.style.setProperty('--player-color',p.color);item.append(E('span','carc-player-dot'),E('strong','',p.name),E('b','',String(p.score)),E('small','',`${p.meeples} horigen`));dashboard.append(item)});els.gameStage.append(dashboard);
  const controls=E('div','carc-controls');controls.append(E('span','eyebrow',`${game.tilesRemaining} TEGELS OVER`));
  if(mine&&game.phase==='place'&&game.currentTile){const drawn=E('div','carc-drawn');drawn.append(carcassonneTileNode(game.currentTile,{preview:true}));const rotate=E('button','secondary','↻ Roteer');rotate.onclick=()=>action('rotate');drawn.append(rotate);controls.append(drawn);if(!game.validPlacements.length)controls.append(E('div','player-note','Geen plek in deze stand — roteer de tegel.'))}
  if(mine&&game.phase==='meeple'){const picker=E('div','carc-meeple-picker');picker.append(E('strong','','Horige plaatsen?'));(game.meepleChoices||[]).forEach(choice=>{const b=E('button','secondary',choice.label);b.onclick=()=>action('meeple',{choice:choice.key});picker.append(b)});const skip=E('button','ghost','Geen horige');skip.onclick=()=>action('skipMeeple');picker.append(skip);controls.append(picker)}els.gameStage.append(controls);
  const viewport=E('div','carc-viewport');const board=E('div','carc-board');const size=72,world=160,origin=(world-1)/2;board.style.width=`${world*size}px`;board.style.height=`${world*size}px`;
  (game.board||[]).forEach(entry=>{const tile=carcassonneTileNode(entry.tile);tile.style.left=`${(entry.x+origin)*size}px`;tile.style.top=`${(entry.y+origin)*size}px`;if(game.lastPlaced?.x===entry.x&&game.lastPlaced?.y===entry.y)tile.classList.add('last-placed');(game.meeples||[]).filter(m=>m.x===entry.x&&m.y===entry.y).forEach(m=>{const player=game.players.find(p=>p.id===m.playerId),meeple=E('span',`carc-meeple ${m.kind}`,m.kind==='field'?'♟':'●');meeple.style.background=player?.color||'#fff';meeple.title=`${player?.name||''} · ${m.kind}`;tile.append(meeple)});board.append(tile)});
  if(mine&&game.phase==='place')(game.validPlacements||[]).forEach(place=>{const spot=E('button','carc-valid','+');spot.type='button';spot.style.left=`${(place.x+origin)*size}px`;spot.style.top=`${(place.y+origin)*size}px`;spot.setAttribute('aria-label',`Leg tegel op ${place.x}, ${place.y}`);spot.onclick=()=>{sound('card');action('place',{x:place.x,y:place.y})};board.append(spot)});
  viewport.append(board);els.gameStage.append(viewport);const view=state.carcassonneViews[room.id]||(state.carcassonneViews[room.id]={x:0,y:0,scale:.9});attachCarcassonneViewport(viewport,board,view);els.gameStage.append(logBox(game.log));
}


function svgEl(tag, attrs={}) {
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));
  return node;
}
function minigolfPathPoint(path, t) {
  if(!path?.length)return null;
  if(path.length===1)return path[0];
  const scaled=Math.max(0,Math.min(1,t))*(path.length-1);
  const index=Math.min(path.length-2,Math.floor(scaled));
  const f=scaled-index,a=path[index],b=path[index+1];
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
}
function golfScoreLabel(strokes,par){const d=strokes-par;return d===0?'E':d>0?`+${d}`:String(d)}
function minigolfTerrainNode(zone) {
  if(zone.shape==='ellipse') return svgEl('ellipse',{
    cx:zone.cx,cy:zone.cy,rx:zone.rx,ry:zone.ry,
    class:`golf-terrain golf-${zone.type}`
  });
  return svgEl('rect',{
    x:zone.x,y:zone.y,width:zone.w,height:zone.h,rx:zone.r||0,
    class:`golf-terrain golf-${zone.type}`
  });
}

function minigolfPropNode(prop) {
  const g=svgEl('g',{class:`golf-prop golf-prop-${prop.kind}`,'data-prop-id':prop.id});
  const asset=`/assets/minigolf/${prop.kind}.svg`;
  if(prop.shape==='circle'){
    const size=Math.max(44,(prop.r||28)*2.5);
    g.append(svgEl('image',{href:asset,x:prop.cx-size/2,y:prop.cy-size/2,width:size,height:size,preserveAspectRatio:'xMidYMid meet'}));
  }else{
    const pad=prop.kind==='windmill'?12:6;
    g.append(svgEl('image',{href:asset,x:prop.x-pad,y:prop.y-pad,width:prop.w+pad*2,height:prop.h+pad*2,preserveAspectRatio:'xMidYMid meet'}));
  }
  return g;
}

function minigolfBoostNode(boost) {
  const g=svgEl('g',{class:'golf-boost',transform:`translate(${boost.x} ${boost.y})`});
  g.append(svgEl('rect',{x:0,y:0,width:boost.w,height:boost.h,rx:8,class:'golf-boost-bg'}));
  const cx=boost.w/2,cy=boost.h/2;
  for(let i=-1;i<=1;i+=1){
    const ox=i*22;
    const arrow=svgEl('path',{
      d:`M ${cx-16+ox} ${cy-9} L ${cx+2+ox} ${cy} L ${cx-16+ox} ${cy+9}`,
      class:'golf-boost-arrow',
      transform:`rotate(${boost.angle*180/Math.PI} ${cx+ox} ${cy})`
    });
    g.append(arrow)
  }
  return g;
}

function renderMinigolf(room,game) {
  const me=game.players.find(p=>p.id===room.meId);
  const turn=game.players.find(p=>p.id===game.turnPlayerId);

  const screen=E('div','golf-game-screen');
  const hud=E('div','golf-hud');

  const playerHud=E('div','golf-player-hud');
  game.players.forEach((p,index)=>{
    const chip=E('div',`golf-player-card ${p.id===room.meId?'me':''} ${p.id===game.turnPlayerId?'active':''}`);
    const avatar=E('span','golf-avatar',p.name.slice(0,1).toUpperCase());
    avatar.style.background=p.color;
    const info=E('span','golf-player-info');
    info.append(E('strong','',p.name),E('small','',p.placed?`SHOT: ${p.holeStrokes+1}`:'START'));
    const score=E('b','golf-point-badge',String(p.totalPoints));
    chip.append(avatar,info,score);
    playerHud.append(chip)
  });

  const holeHud=E('div','golf-hole-hud');
  holeHud.append(
    E('strong','',`HOLE ${game.hole.number}/5`),
    E('span','',`${game.hole.name}${game.hole.gimmick ? ` · ${game.hole.gimmick}` : ''}`),
    E('b','',`MAX SHOTS: ${game.hole.maxStrokes}`)
  );
  hud.append(playerHud,holeHud);
  screen.append(hud);

  const courseWrap=E('div','golf-full-course-wrap');
  const svg=svgEl('svg',{
    viewBox:`0 0 ${game.course.width} ${game.course.height}`,
    class:'minigolf-course golf-full-course',
    role:'img',
    'aria-label':`Minigolf hole ${game.hole.number}: ${game.hole.name}`
  });

  svg.append(svgEl('rect',{x:0,y:0,width:game.course.width,height:game.course.height,rx:16,class:'golf-world'}));
  svg.append(svgEl('rect',{x:8,y:8,width:game.course.width-16,height:game.course.height-16,rx:12,class:'golf-border'}));
  (game.hole.terrain||[]).forEach(zone=>svg.append(minigolfTerrainNode(zone)));

  const sz=game.hole.startZone;
  svg.append(svgEl('rect',{x:sz.x,y:sz.y,width:sz.w,height:sz.h,rx:sz.r||12,class:`golf-start-zone ${game.canPlace?'placing':''}`}));
  const startText=svgEl('text',{x:sz.x+sz.w/2,y:sz.y+18,class:'golf-start-label'});
  startText.textContent='START';
  svg.append(startText);

  (game.hole.boosts||[]).forEach(boost=>svg.append(minigolfBoostNode(boost)));
  (game.hole.walls||[]).forEach(o=>svg.append(svgEl('rect',{x:o.x,y:o.y,width:o.w,height:o.h,rx:7,class:'golf-wall'})));
  (game.hole.props||[]).forEach(prop=>svg.append(minigolfPropNode(prop)));

  svg.append(svgEl('circle',{cx:game.hole.cup.x,cy:game.hole.cup.y,r:25,class:'golf-cup-shadow'}));
  svg.append(svgEl('circle',{cx:game.hole.cup.x,cy:game.hole.cup.y,r:18,class:'golf-cup'}));
  const flag=svgEl('g',{class:'golf-flag'});
  flag.append(svgEl('line',{x1:game.hole.cup.x,y1:game.hole.cup.y,x2:game.hole.cup.x,y2:game.hole.cup.y-62}));
  flag.append(svgEl('path',{d:`M ${game.hole.cup.x} ${game.hole.cup.y-62} l 38 13 l -38 13 z`}));
  svg.append(flag);

  const ballNodes=new Map();
  const pendingIds=new Set(Object.keys(game.pendingShot?.paths||{}));
  [...game.players].sort((a,b)=>(a.id===room.meId?1:0)-(b.id===room.meId?1:0)).forEach((p)=>{
    if(!p.ball)return;
    if(p.holeDone&&!pendingIds.has(p.id))return;
    const index=game.players.findIndex(x=>x.id===p.id);
    const group=svgEl('g',{class:`golf-ball-group ${p.id===room.meId?'me':''}`});
    const shadow=svgEl('circle',{cx:p.ball.x+3,cy:p.ball.y+5,r:12,class:'golf-ball-shadow'});
    const ball=svgEl('circle',{cx:p.ball.x,cy:p.ball.y,r:11,class:'golf-ball',fill:p.color,'data-player-id':p.id});
    const mark=svgEl('text',{x:p.ball.x,y:p.ball.y+4,class:'golf-ball-mark'});
    mark.textContent=String(index+1);
    group.append(shadow,ball,mark);svg.append(group);
    ballNodes.set(p.id,{group,ball,shadow,mark})
  });

  const aim=svgEl('g',{class:'golf-aim hidden'});
  const aimLine=svgEl('line',{class:'golf-aim-line'});
  const aimHead=svgEl('circle',{r:6,class:'golf-aim-head'});
  const pullLine=svgEl('line',{class:'golf-pull-line'});
  const powerBg=svgEl('rect',{rx:8,class:'golf-power-label-bg'});
  const powerText=svgEl('text',{class:'golf-power-label'});
  aim.append(aimLine,aimHead,pullLine,powerBg,powerText);
  svg.append(aim);

  courseWrap.append(svg);
  screen.append(courseWrap);

  let status='';
  if(game.gameOver)status='Match afgelopen.';
  else if(game.phase==='between')status='Punten verdeeld. Volgende hole…';
  else if(game.phase==='placing')status=game.canPlace?'Tik in het startvak om je bal te plaatsen.':'Wachten tot iedereen zijn bal geplaatst heeft…';
  else if(game.pendingShot)status=`${game.pendingShot.playerName} slaat…`;
  else if(game.canShoot)status='Jouw beurt. Sleep eender waar op de baan om te mikken.';
  else status=`${turn?.name||'Speler'} is aan de beurt.`;

  const footer=E('div','golf-game-footer');
  const statusBox=E('div','golf-status-line',status);
  const miniScores=E('div','golf-mini-scores');
  game.players.forEach(p=>miniScores.append(E('span','',`${p.name}: ${p.totalPoints} pt · ${p.potted?'✓':p.failed?'DNF':`${p.holeStrokes}/${game.hole.maxStrokes}`}`)));
  footer.append(statusBox,miniScores);
  if(game.lastHoleSummary)footer.append(E('div','minigolf-hole-summary',game.lastHoleSummary));
  screen.append(footer);
  els.gameStage.append(screen);

  const setBallPosition=(playerId,point)=>{
    const n=ballNodes.get(playerId);
    if(!n||!point)return;
    n.ball.setAttribute('cx',point.x);n.ball.setAttribute('cy',point.y);
    n.shadow.setAttribute('cx',point.x+3);n.shadow.setAttribute('cy',point.y+5);
    n.mark.setAttribute('x',point.x);n.mark.setAttribute('y',point.y+4)
  };

  const shot=game.pendingShot;
  if(shot){
    (shot.removedPropIds||[]).forEach(id=>{
      const prop=svg.querySelector(`[data-prop-id="${CSS.escape(id)}"]`);
      if(prop)prop.classList.add('golf-prop-disappearing')
    });
    if(!state.minigolfShotAnimation||state.minigolfShotAnimation.id!==shot.id){
      state.minigolfShotAnimation={id:shot.id,start:performance.now()}
    }
    const animation=state.minigolfShotAnimation;
    const frame=(now)=>{
      if(!svg.isConnected||state.room?.gameState?.pendingShot?.id!==shot.id)return;
      const t=Math.min(1,(now-animation.start)/Math.max(1,shot.durationMs));
      Object.entries(shot.paths||{}).forEach(([playerId,path])=>setBallPosition(playerId,minigolfPathPoint(path,t)));
      if(t<1)requestAnimationFrame(frame)
    };
    requestAnimationFrame(frame)
  }else state.minigolfShotAnimation=null;

  const logicalPoint=(event)=>{
    const r=svg.getBoundingClientRect();
    return{
      x:Math.max(0,Math.min(game.course.width,(event.clientX-r.left)/r.width*game.course.width)),
      y:Math.max(0,Math.min(game.course.height,(event.clientY-r.top)/r.height*game.course.height))
    }
  };

  if(game.canPlace&&me&&!me.placed){
    svg.classList.add('golf-placement-mode');
    svg.addEventListener('pointerdown',(event)=>{
      const point=logicalPoint(event);
      if(point.x<sz.x||point.x>sz.x+sz.w||point.y<sz.y||point.y>sz.y+sz.h)return;
      action('placeBall',point);
      event.preventDefault()
    })
  }

  if(game.canShoot&&me&&!game.pendingShot&&!game.gameOver&&!me.holeDone&&me.ball){
    let dragging=false,pointerId=null,dragStart=null;
    const origin={...me.ball};

    const updateAim=(point)=>{
      if(!dragStart)return null;
      let dx=dragStart.x-point.x,dy=dragStart.y-point.y;
      const d=Math.hypot(dx,dy);
      if(d<2){aim.classList.add('hidden');return null}
      const max=180,clamped=Math.min(max,d),ux=dx/d,uy=dy/d,power=Math.min(1,clamped/max);
      const end={x:origin.x+ux*(60+power*145),y:origin.y+uy*(60+power*145)};
      aim.classList.remove('hidden');
      aimLine.setAttribute('x1',origin.x);aimLine.setAttribute('y1',origin.y);
      aimLine.setAttribute('x2',end.x);aimLine.setAttribute('y2',end.y);
      aimHead.setAttribute('cx',end.x);aimHead.setAttribute('cy',end.y);
      pullLine.setAttribute('x1',dragStart.x);pullLine.setAttribute('y1',dragStart.y);
      pullLine.setAttribute('x2',point.x);pullLine.setAttribute('y2',point.y);

      const pct=Math.round(power*100);
      powerText.textContent=`${pct}%`;
      const tx=Math.max(42,Math.min(game.course.width-42,point.x));
      const ty=Math.max(28,Math.min(game.course.height-18,point.y-18));
      powerText.setAttribute('x',tx);powerText.setAttribute('y',ty+4);
      powerBg.setAttribute('x',tx-31);powerBg.setAttribute('y',ty-15);
      powerBg.setAttribute('width',62);powerBg.setAttribute('height',27);
      return{angle:Math.atan2(uy,ux),power}
    };

    svg.addEventListener('pointerdown',(event)=>{
      dragging=true;pointerId=event.pointerId;dragStart=logicalPoint(event);
      svg.setPointerCapture?.(pointerId);
      event.preventDefault()
    });
    svg.addEventListener('pointermove',(event)=>{
      if(!dragging||event.pointerId!==pointerId)return;
      updateAim(logicalPoint(event));event.preventDefault()
    });
    const finish=(event)=>{
      if(!dragging||event.pointerId!==pointerId)return;
      const shotData=updateAim(logicalPoint(event));
      dragging=false;dragStart=null;aim.classList.add('hidden');
      if(shotData&&shotData.power>=.06){sound('card');action('shoot',shotData)}
      event.preventDefault()
    };
    svg.addEventListener('pointerup',finish);
    svg.addEventListener('pointercancel',()=>{dragging=false;dragStart=null;aim.classList.add('hidden')})
  }
}


  return {
    renderGame,
    gameMetric,
    renderHofBoard,
    svgEl,
    minigolfPathPoint,
    minigolfTerrainNode,
    minigolfPropNode,
    minigolfBoostNode
  };
}
