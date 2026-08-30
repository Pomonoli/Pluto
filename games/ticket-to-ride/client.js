let selectedRouteId=null;
let selectedTicketIds=new Set();
const SVG='http://www.w3.org/2000/svg';
const COLOR_LABELS={red:'Rood',blue:'Blauw',green:'Groen',yellow:'Geel',purple:'Paars',wild:'Joker'};

function svg(tag,attrs={}){
  const node=document.createElementNS(SVG,tag);
  Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));
  return node;
}
function cityMap(game){return new Map((game.cities||[]).map(city=>[city.id,city]))}
function handCount(game,color){return Number(game.handCounts?.[color]||0)}
function routeAffordable(game,route){return handCount(game,route.color)+handCount(game,'wild')>=route.length}
function routeName(cities,route){return `${cities.get(route.a)?.name||route.a} – ${cities.get(route.b)?.name||route.b}`}

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
    row.append(E('strong','',player.name),E('span','','🚂 '+player.trains),E('b','',`${player.totalScore} p`));
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
    const group=svg('g',{class:`ttr-route ${route.ownerId?'owned':'free'} ${route.ownerId?`owner-${game.players.find(p=>p.id===route.ownerId)?.index??0}`:`color-${route.color}`} ${selectedRouteId===route.id?'selected':''}`});
    const hit=svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'ttr-route-hit'});
    const line=svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'ttr-route-line'});
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    const badge=svg('g',{class:'ttr-route-badge'});
    badge.append(svg('circle',{cx:mx,cy:my,r:13}),svg('text',{x:mx,y:my+5,'text-anchor':'middle'}));
    badge.lastChild.textContent=String(route.length);
    group.append(hit,line,badge);
    const owner=game.players.find(player=>player.id===route.ownerId);
    const title=svg('title');title.textContent=route.ownerId?`${routeName(cities,route)} · ${owner?.name||'bezet'}`:`${routeName(cities,route)} · ${route.length} ${COLOR_LABELS[route.color]}`;group.append(title);
    if(!route.ownerId){group.style.cursor='pointer';group.onclick=()=>{selectedRouteId=route.id;renderGame(room)}}
    board.append(group);
  }

  for(const city of game.cities){
    const group=svg('g',{class:'ttr-city'});
    group.append(svg('circle',{cx:city.x,cy:city.y,r:10}));
    const label=svg('text',{x:city.x+13,y:city.y-13});label.textContent=city.name;group.append(label);board.append(group);
  }
  mapWrap.append(board);els.gameStage.append(mapWrap);

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
