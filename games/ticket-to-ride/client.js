let selectedRouteId=null;
let selectedTicketIds=new Set();
const mapViews={};
const SVG='http://www.w3.org/2000/svg';
const COLOR_LABELS={red:'Rood',blue:'Blauw',green:'Groen',yellow:'Geel',purple:'Paars',wild:'Joker'};
const CITY_LABELS={
  lisbon:[16,-16,'start'],madrid:[16,30,'start'],paris:[-16,30,'end'],london:[-16,-16,'end'],
  brussels:[16,31,'start'],amsterdam:[16,-17,'start'],berlin:[16,-17,'start'],copenhagen:[16,-17,'start'],
  warsaw:[16,-17,'start'],prague:[16,31,'start'],vienna:[-16,31,'end'],zurich:[-16,-18,'end'],
  milan:[-16,31,'end'],rome:[-16,31,'end'],venice:[16,-18,'start'],budapest:[16,-18,'start'],
  zagreb:[-16,32,'end'],belgrade:[16,-18,'start'],athens:[-16,31,'end'],istanbul:[-16,31,'end']
};

function svg(tag,attrs={}){
  const node=document.createElementNS(SVG,tag);
  Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));
  return node;
}
function cityMap(game){return new Map((game.cities||[]).map(city=>[city.id,city]))}
function handCount(game,color){return Number(game.handCounts?.[color]||0)}
function routeAffordable(game,route){return handCount(game,route.color)+handCount(game,'wild')>=route.length}
function routeName(cities,route){return `${cities.get(route.a)?.name||route.a} – ${cities.get(route.b)?.name||route.b}`}
function routeBadgePoint(a,b,route){
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.max(1,Math.hypot(dx,dy));
  const direction=Number(String(route.id).replace(/\D/g,''))%2===0?-1:1;
  const offset=(route.ownerId?16:18)*direction;
  return {x:(a.x+b.x)/2+(-dy/length)*offset,y:(a.y+b.y)/2+(dx/length)*offset};
}
function cityLabelSpec(city){
  const [dx,dy,anchor]=CITY_LABELS[city.id]||[city.x>475?-16:16,city.y>430?30:-17,city.x>475?'end':'start'];
  return {x:city.x+dx,y:city.y+dy,anchor};
}
function attachTicketViewport(viewport,board,view){
  const pointers=new Map();let drag=null,pinch=null,blockClick=false;
  const apply=()=>{board.style.transform=`translate(calc(-50% + ${view.x}px),calc(-50% + ${view.y}px)) scale(${view.scale})`};apply();
  viewport.addEventListener('pointerdown',event=>{
    viewport.setPointerCapture?.(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1){drag={x:event.clientX,y:event.clientY,ox:view.x,oy:view.y};blockClick=false}
    if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:view.scale};drag=null;blockClick=true}
  });
  viewport.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2&&pinch){
      const [a,b]=[...pointers.values()];
      view.scale=Math.max(.38,Math.min(2.2,pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)));blockClick=true;
    }else if(drag){
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(Math.hypot(dx,dy)>4)blockClick=true;
      view.x=drag.ox+dx;view.y=drag.oy+dy;
    }
    apply();event.preventDefault();
  });
  const end=event=>{pointers.delete(event.pointerId);drag=null;pinch=null};
  viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
  viewport.addEventListener('click',event=>{if(!blockClick)return;event.preventDefault();event.stopPropagation();blockClick=false},true);
  viewport.addEventListener('wheel',event=>{view.scale=Math.max(.38,Math.min(2.2,view.scale*(event.deltaY>0?.9:1.1)));apply();event.preventDefault()},{passive:false});
}

export function render(api){renderTicketToRide(api)}

function renderTicketToRide({room,game,els,E,action,titlebar,logBox,renderGame}){
  const me=game.players.find(player=>player.id===room.meId);
  const turn=game.players.find(player=>player.id===game.turnPlayerId);
  const pending=game.pendingTickets||[];
  const status=game.gameOver?game.resultText:
    pending.length?'Kies minstens één bestemming om te houden.':
    game.canAct?(game.drawsRemaining<2?`Trek nog ${game.drawsRemaining} treinkaart.`:'Jij bent aan de beurt.'):`${turn?.name||''} is aan de beurt.`;
  els.gameStage.append(titlebar('Ticket to Ride',status));

  const scores=E('div','ttr-scoreboard');
  game.players.forEach(player=>{
    const row=E('div',`ttr-player p${player.index} ${player.id===game.turnPlayerId?'active':''}`);
    row.append(E('strong','',`${player.name}${player.id===room.meId?' · jij':''}`),E('span','','🚂 '+player.trains),E('b','',`${player.totalScore} p`));
    if(game.gameOver)row.append(E('small','',`${player.completedTickets}/${player.ticketCount} tickets`));
    scores.append(row);
  });
  els.gameStage.append(scores);

  if(game.finalTurnsLeft!==null&&!game.gameOver){
    els.gameStage.append(E('div','ttr-final',`Laatste ronde: nog ${game.finalTurnsLeft} beurt${game.finalTurnsLeft===1?'':'en'} na deze.`));
  }

  const cities=cityMap(game);
  const selected=game.routes.find(route=>route.id===selectedRouteId&&!route.ownerId);
  if(!selected)selectedRouteId=null;
  const mapWrap=E('div','ttr-map-wrap');
  const board=svg('svg',{class:'ttr-map',viewBox:'0 0 950 640','aria-label':'Kaart van Europa',role:'img'});
  const bg=svg('rect',{x:0,y:0,width:950,height:640,rx:30,class:'ttr-map-bg'});board.append(bg);

  for(const route of game.routes){
    const a=cities.get(route.a),b=cities.get(route.b);if(!a||!b)continue;
    const owner=game.players.find(player=>player.id===route.ownerId);
    const isMine=route.ownerId===room.meId;
    const group=svg('g',{class:`ttr-route ${route.ownerId?'owned':'free'} ${isMine?'mine':''} ${route.ownerId?`owner-${owner?.index??0}`:`color-${route.color}`} ${selectedRouteId===route.id?'selected':''}`});
    const hit=svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'ttr-route-hit'});
    const line=svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'ttr-route-line'});
    const point=routeBadgePoint(a,b,route),mx=point.x,my=point.y;
    const badge=svg('g',{class:'ttr-route-badge'});
    if(route.ownerId)badge.append(svg('circle',{cx:mx,cy:my,r:21,class:'ttr-route-owner-ring'}));
    badge.append(svg('circle',{cx:mx,cy:my,r:route.ownerId?16:13,class:'ttr-route-badge-fill'}),svg('text',{x:mx,y:my+(route.ownerId?4:5),'text-anchor':'middle'}));
    badge.lastChild.textContent=route.ownerId?(isMine?'JIJ':String(owner?.name||'?').trim().charAt(0).toUpperCase()):String(route.length);
    group.append(hit,line,badge);
    const title=svg('title');title.textContent=route.ownerId?`${routeName(cities,route)} · ${isMine?'jouw route':owner?.name||'bezet'}`:`${routeName(cities,route)} · ${route.length} ${COLOR_LABELS[route.color]}`;group.append(title);
    if(!route.ownerId){group.style.cursor='pointer';group.onclick=()=>{selectedRouteId=route.id;renderGame(room)}}
    board.append(group);
  }

  for(const city of game.cities){
    const group=svg('g',{class:'ttr-city'}),spec=cityLabelSpec(city);
    group.append(svg('circle',{cx:city.x,cy:city.y,r:10}));
    const labelGroup=svg('g',{class:'ttr-city-label'}),width=Math.max(48,city.name.length*8.4+14),height=24;
    const rectX=spec.anchor==='end'?spec.x-width+5:spec.x-5;
    labelGroup.append(svg('rect',{x:rectX,y:spec.y-height+6,width,height,rx:7}),svg('text',{x:spec.x,y:spec.y,'text-anchor':spec.anchor}));
    labelGroup.lastChild.textContent=city.name;group.append(labelGroup);board.append(group);
  }
  mapWrap.append(board);els.gameStage.append(mapWrap);
  const initialScale=Math.max(.46,Math.min(.82,((mapWrap.clientWidth||760)-20)/950));
  const view=mapViews[room.id]||(mapViews[room.id]={x:0,y:0,scale:initialScale});attachTicketViewport(mapWrap,board,view);

  if(selectedRouteId){
    const route=game.routes.find(item=>item.id===selectedRouteId);
    if(route&&!route.ownerId){
      const detail=E('div','ttr-route-detail');
      detail.append(E('div','',`${routeName(cities,route)} · ${route.length} ${COLOR_LABELS[route.color]}`));
      const have=handCount(game,route.color),wild=handCount(game,'wild');
      detail.append(E('small','',`Je hebt ${have} ${COLOR_LABELS[route.color].toLowerCase()} + ${wild} joker${wild===1?'':'s'}.`));
      const claim=E('button','primary',routeAffordable(game,route)?'Bouw route':'Niet genoeg kaarten');
      claim.type='button';claim.disabled=!game.canClaim||!routeAffordable(game,route)||Number(me?.trains||0)<route.length;
      claim.onclick=()=>{action('claimRoute',{routeId:route.id});selectedRouteId=null};
      detail.append(claim);els.gameStage.append(detail);
    }
  }

  if(pending.length){
    const liveIds=new Set(pending.map(ticket=>ticket.id));
    if(!selectedTicketIds.size||[...selectedTicketIds].some(id=>!liveIds.has(id)))selectedTicketIds=new Set(pending.map(ticket=>ticket.id));
    const chooser=E('section','ttr-panel ttr-ticket-chooser');
    chooser.append(E('h3','','Nieuwe bestemmingen'));
    pending.forEach(ticket=>{
      const label=E('label','ttr-ticket');
      const input=E('input');input.type='checkbox';input.checked=selectedTicketIds.has(ticket.id);
      input.onchange=()=>{if(input.checked)selectedTicketIds.add(ticket.id);else selectedTicketIds.delete(ticket.id)};
      label.append(input,E('span','',`${ticket.from} → ${ticket.to}`),E('b','',`${ticket.value} p`));chooser.append(label);
    });
    const keep=E('button','primary','Houd geselecteerde');keep.type='button';
    keep.onclick=()=>{if(!selectedTicketIds.size)return;action('keepTickets',{ticketIds:[...selectedTicketIds]});selectedTicketIds=new Set()};
    chooser.append(keep);els.gameStage.append(chooser);
  }else{
    selectedTicketIds=new Set();
    const controls=E('div','ttr-controls');
    const market=E('section','ttr-panel');market.append(E('h3','','Treinkaarten'));
    const cards=E('div','ttr-market');
    game.market.forEach((color,index)=>{
      const card=E('button',`ttr-card color-${color}`,COLOR_LABELS[color]);card.type='button';
      card.disabled=!game.canAct||game.drawsRemaining<=0;card.onclick=()=>action('drawTrain',{source:'market',index});cards.append(card);
    });
    const deck=E('button','ttr-card ttr-deck',`Stapel\n${game.deckCount}`);deck.type='button';deck.disabled=!game.canAct||game.drawsRemaining<=0;deck.onclick=()=>action('drawTrain',{source:'deck'});cards.append(deck);
    market.append(cards);
    if(game.canAct&&game.drawsRemaining<2)market.append(E('small','ttr-hint',`Nog ${game.drawsRemaining} kaart te trekken.`));
    controls.append(market);

    const hand=E('section','ttr-panel');hand.append(E('h3','','Jouw hand'));
    const handRow=E('div','ttr-hand');
    ['red','blue','green','yellow','purple','wild'].forEach(color=>handRow.append(E('span',`ttr-hand-chip color-${color}`,`${COLOR_LABELS[color]} ${handCount(game,color)}`)));
    hand.append(handRow);controls.append(hand);
    els.gameStage.append(controls);
  }

  const tickets=E('section','ttr-panel ttr-my-tickets');
  const head=E('div','ttr-panel-head');head.append(E('h3','','Jouw bestemmingen'));
  if(!game.gameOver){
    const more=E('button','secondary','Nieuwe bestemmingen');more.type='button';more.disabled=!game.canDrawTickets;more.onclick=()=>action('drawTickets');head.append(more);
  }
  tickets.append(head);
  const myTickets=me?.tickets||[];
  if(!myTickets.length)tickets.append(E('small','','Geen bestemmingen.'));
  myTickets.forEach(ticket=>{
    const row=E('div',`ttr-ticket-row ${ticket.connected?'done':''}`);
    row.append(E('span','',`${ticket.connected?'✓':'○'} ${ticket.from} → ${ticket.to}`),E('b','',`${ticket.value} p`));tickets.append(row);
  });
  els.gameStage.append(tickets,logBox(game.log));
}

export function metric({player}){return {text:`${player.totalScore} p`,score:Number(player.totalScore||0)}}
export function presentResult({game}){
  const winners=game.players.filter(player=>(game.winnerIds||[]).includes(player.id));
  return winners.length>1?{title:'Gelijkspel',copy:game.resultText}:{title:winners[0]?.name||'Ticket to Ride',copy:game.resultText||'Spel afgelopen.'};
}
export function isWinner({game,myId}){return (game.winnerIds||[]).includes(myId)||game.winnerId===myId}
