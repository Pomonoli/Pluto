let state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList;
const views={};
export const roomOptions={bodyClass:'carcassonne-active'};
function bind(api){({state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList}=api)}
export function render(api){bind(api);renderCarcassonne(api.room,api.game)}
export function renderLobbyOptions({room,container,E,socket,handleAck}){
  const wrap=E('section','carc-lobby-options'),head=E('div','carc-lobby-options-head'),choices=E('div','carc-tile-count-options'),selected=Number(room.gameOptions?.tileCount||72);
  head.append(E('strong','','Aantal tegels'),E('small','',room.isHost?'Kies de spelduur':'De host kiest de spelduur'));
  [[72,'Standaard'],[36,'Short'],[18,'Blitz']].forEach(([value,label])=>{const button=E('button',`carc-tile-count-option ${selected===value?'active':''}`.trim());button.type='button';button.disabled=!room.isHost;button.setAttribute('aria-pressed',selected===value?'true':'false');button.append(E('b','',String(value)),E('span','',label));button.onclick=()=>socket.emit('room:setOptions',{tileCount:value},handleAck);choices.append(button)});
  const meepleRow=E('div','carc-meeple-count-option'),meepleCopy=E('label','carc-meeple-count-copy'),meepleValue=E('output','carc-meeple-count-value'),slider=E('input','carc-meeple-count-slider'),meepleCount=Number(room.gameOptions?.meepleCount||7);
  meepleCopy.htmlFor='carcMeepleCount';meepleCopy.append(E('strong','','Aantal burgers'),E('small','',room.isHost?'Per speler':'Gekozen door de host'));
  meepleValue.htmlFor='carcMeepleCount';meepleValue.textContent=String(meepleCount);
  slider.id='carcMeepleCount';slider.type='range';slider.min='1';slider.max='12';slider.step='1';slider.value=String(meepleCount);slider.disabled=!room.isHost;slider.setAttribute('aria-label','Aantal burgers per speler');
  slider.oninput=()=>{meepleValue.textContent=slider.value};
  slider.onchange=()=>socket.emit('room:setOptions',{meepleCount:Number(slider.value)},handleAck);
  meepleRow.append(meepleCopy,slider,meepleValue);wrap.append(head,choices,meepleRow);container.append(wrap)
}

const SIDE_NAMES=['north','east','south','west'];
const SIDE_WORDS=['boven','rechts','onder','links'];
function burgerLabel(count){return `${count} ${count===1?'burger':'burgers'}`}
function featurePositionClass(group){
  const sides=[...new Set(group||[])].sort((a,b)=>a-b);
  if(sides.length===1)return `side-${SIDE_NAMES[sides[0]]}`;
  if(sides.length===2){
    const corners={'0,1':'corner-ne','1,2':'corner-se','2,3':'corner-sw','0,3':'corner-nw'};
    return corners[sides.join(',')]||'center';
  }
  return 'center';
}
function fieldPositionClass(ports){
  const set=new Set(ports||[]);
  const quarters=[
    {name:'top-left',ports:[7,0]},
    {name:'top-right',ports:[1,2]},
    {name:'bottom-right',ports:[3,4]},
    {name:'bottom-left',ports:[5,6]}
  ].filter(quarter=>quarter.ports.some(port=>set.has(port)));
  if(quarters.length===4||quarters.length===0)return'center';
  if(quarters.length===3){
    const present=new Set(quarters.map(quarter=>quarter.name));
    const opposite={
      'top-left':'bottom-right','top-right':'bottom-left',
      'bottom-right':'top-left','bottom-left':'top-right'
    };
    const missing=['top-left','top-right','bottom-right','bottom-left'].find(name=>!present.has(name));
    return opposite[missing];
  }
  if(quarters.length===1)return quarters[0].name;
  const names=new Set(quarters.map(quarter=>quarter.name));
  if(names.has('top-left')&&names.has('top-right'))return'top';
  if(names.has('bottom-left')&&names.has('bottom-right'))return'bottom';
  if(names.has('top-left')&&names.has('bottom-left'))return'left';
  if(names.has('top-right')&&names.has('bottom-right'))return'right';
  return'center';
}
function meepleVisual(kind){
  if(kind==='city')return {text:'♞',role:'Ridder'};
  if(kind==='road')return {text:'●',role:'Struikrover'};
  if(kind==='field')return {text:'♟',role:'Landbouwer'};
  if(kind==='monastery')return {text:'†',role:'Monnik'};
  return {text:'●',role:'Burger'};
}
function meepleChoiceLabel(choice,tile){
  if(choice.kind==='road'){
    const roads=tile?.roads||[];
    if(roads.length<=1)return 'Struikrover';
    const sides=roads[choice.group]||[];
    if(sides.length===1)return `Struikrover ${SIDE_WORDS[sides[0]]}`;
    return 'Struikrover';
  }
  if(choice.kind==='city'){
    const cities=tile?.cities||[];
    if(cities.length<=1)return 'Ridder';
    const sides=cities[choice.group]||[];
    if(sides.length===1)return `Ridder ${SIDE_WORDS[sides[0]]}`;
    return 'Ridder';
  }
  if(choice.kind==='monastery')return 'Monnik';
  if(choice.kind==='field')return choice.label||'Landbouwer';
  return choice.label||'Burger';
}
function cityHallPosition(group){
  const sides=[...new Set(group)].sort((a,b)=>a-b);
  if(sides.length===1)return `side-${SIDE_NAMES[sides[0]]}`;
  if(sides.length===2){
    const corners={'0,1':'corner-ne','1,2':'corner-se','2,3':'corner-sw','0,3':'corner-nw'};
    return corners[sides.join(',')]||'center';
  }
  return 'center';
}
function cityConnector(group){
  const sides=[...new Set(group)].sort((a,b)=>a-b);
  if(sides.length>=3)return 'center';
  if(sides.join(',')==='0,2')return 'vertical';
  if(sides.join(',')==='1,3')return 'horizontal';
  return '';
}

function carcassonneTileNode(tile,{preview=false}={}){
  const node=E('div',`carc-tile tile-${tile.type||'unknown'} ${preview?'preview':''}`.trim());
  node.setAttribute('aria-label',`Landschapstegel ${tile.type||''}`);
  SIDE_NAMES.forEach((side,index)=>{const edge=E('span',`carc-edge ${side} type-${tile.edges[index]}`);node.append(edge)});

  const roads=tile.roads||[];
  if(roads.length){
    const hasThroughRoad=roads.some(group=>group.length>1);
    if(hasThroughRoad)node.append(E('span','carc-road-center connected'));
    if(!hasThroughRoad&&!tile.monastery){
      const stopType=(tile.cities||[]).length?'city-gate':'village';
      node.append(E('span',`carc-road-stop ${stopType}`));
    }
  }

  (tile.cities||[]).forEach(group=>{
    const connector=cityConnector(group);
    if(connector)node.append(E('span',`carc-city-link ${connector}`));
    node.append(E('span',`carc-city-hall ${cityHallPosition(group)}`));
  });

  if(tile.monastery)node.append(E('span','carc-monastery','†'));
  if(tile.shield)node.append(E('span','carc-shield','◆'));
  return node
}

function renderBurgerPopup(game,placedTile,me){
  const backdrop=E('div','carc-burger-backdrop');
  const modal=E('div','carc-burger-modal');
  modal.append(E('span','eyebrow','BURGER PLAATSEN'),E('h3','','Kies een rol'));
  const copy=me?.meeples>0?'Je mag één burger op de zojuist gelegde tegel plaatsen.':'Je hebt geen burgers meer beschikbaar.';
  modal.append(E('p','carc-burger-copy',copy));
  const choices=E('div','carc-burger-choices');
  if(me?.meeples>0)(game.meepleChoices||[]).forEach(choice=>{
    const visual=meepleVisual(choice.kind),button=E('button','secondary carc-burger-choice');
    button.type='button';button.append(E('span','carc-choice-icon',visual.text),E('span','',meepleChoiceLabel(choice,placedTile)));
    button.onclick=()=>action('meeple',{choice:choice.key});choices.append(button)
  });
  const skip=E('button','ghost carc-burger-skip',me?.meeples>0?'Geen burger':'Verder');skip.type='button';skip.onclick=()=>action('skipMeeple');choices.append(skip);
  const back=E('button','ghost carc-burger-back','← Tegel anders leggen');back.type='button';back.onclick=()=>action('undoPlace');choices.append(back);
  modal.append(choices);backdrop.append(modal);return backdrop
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
  const status=game.gameOver?'Landschap voltooid.':mine?(game.phase==='place'?'Leg je tegel.':'Plaats eventueel een burger.'):`${turn?.name||''} is aan de beurt.`;
  els.gameStage.append(titlebar('Carcassonne',status));
  const dashboard=E('div','carc-dashboard');game.players.forEach(p=>{const item=E('div',`carc-player ${p.id===game.turnPlayerId?'active':''}`);item.style.setProperty('--player-color',p.color);item.append(E('span','carc-player-dot'),E('strong','',p.name),E('b','',String(p.score)),E('small','',burgerLabel(p.meeples)));dashboard.append(item)});els.gameStage.append(dashboard);
  const controls=E('div',`carc-controls ${mine&&game.phase==='meeple'?'waiting-choice':''}`);controls.append(E('span','eyebrow',`${game.tilesRemaining} TEGELS OVER`));
  if(mine&&game.phase==='place'&&game.currentTile){const drawn=E('div','carc-drawn');drawn.append(carcassonneTileNode(game.currentTile,{preview:true}));const rotate=E('button','secondary','↻ Roteer');rotate.onclick=()=>action('rotate');drawn.append(rotate);controls.append(drawn);if(!game.validPlacements.length)controls.append(E('div','player-note','Geen plek in deze stand — roteer de tegel.'))}
  else if(game.nextTile){const drawn=E('div','carc-drawn carc-next-drawn'),count=Number(game.nextTilePlayersBefore||1);drawn.append(E('span','carc-next-label','JOUW VOLGENDE TEGEL'),carcassonneTileNode(game.nextTile,{preview:true}),E('span','carc-next-wait',`Nog ${count} speler${count===1?'':'s'} voor je`));controls.append(drawn)}
  els.gameStage.append(controls);
  const viewport=E('div','carc-viewport');const board=E('div','carc-board');const size=72,world=160,origin=(world-1)/2;board.style.width=`${world*size}px`;board.style.height=`${world*size}px`;
  (game.board||[]).forEach(entry=>{
    const tile=carcassonneTileNode(entry.tile);tile.style.left=`${(entry.x+origin)*size}px`;tile.style.top=`${(entry.y+origin)*size}px`;const marker=game.lastPlaced||game.lastPlayed;if(marker?.x===entry.x&&marker?.y===entry.y)tile.classList.add('last-placed');
    (game.meeples||[]).filter(m=>m.x===entry.x&&m.y===entry.y).forEach(m=>{
      const player=game.players.find(p=>p.id===m.playerId),visual=meepleVisual(m.kind);
      const group=m.kind==='city'?entry.tile.cities?.[m.group]:m.kind==='road'?entry.tile.roads?.[m.group]:null;
      const fieldPosition=m.kind==='field'?`field-${m.position||fieldPositionClass(entry.tile.fields?.[m.group]||[])}`:'';
      const position=group?featurePositionClass(group):fieldPosition;
      const meeple=E('span',`carc-meeple ${m.kind} ${position}`.trim(),visual.text);meeple.style.background=player?.color||'#fff';meeple.title=`${player?.name||''} · ${visual.role}`;
      if(Array.isArray(m.anchor)&&m.anchor.length===2){meeple.classList.add('feature-anchor');meeple.style.setProperty('--anchor-x',`${m.anchor[0]}px`);meeple.style.setProperty('--anchor-y',`${m.anchor[1]}px`)}
      tile.append(meeple)
    });
    board.append(tile)
  });
  if(mine&&game.phase==='place')(game.validPlacements||[]).forEach(place=>{const spot=E('button','carc-valid','+');spot.type='button';spot.style.left=`${(place.x+origin)*size}px`;spot.style.top=`${(place.y+origin)*size}px`;spot.setAttribute('aria-label',`Leg tegel op ${place.x}, ${place.y}`);spot.onclick=()=>{sound('card');action('place',{x:place.x,y:place.y})};board.append(spot)});
  viewport.append(board);els.gameStage.append(viewport);const view=views[room.id]||(views[room.id]={x:0,y:0,scale:.9});attachCarcassonneViewport(viewport,board,view);els.gameStage.append(logBox(game.log));
  if(mine&&game.phase==='meeple'&&game.lastPlaced){const placedTile=(game.board||[]).find(entry=>entry.x===game.lastPlaced.x&&entry.y===game.lastPlaced.y)?.tile;els.gameStage.append(renderBurgerPopup(game,placedTile,me))}
}

export function metric({player}){return {text:`${player.score} pt · ${burgerLabel(player.meeples)}`,score:Number(player.score||0)}}
export function presentResult({game}){const high=Math.max(...game.players.map(p=>p.score)),w=game.players.filter(p=>p.score===high);return w.length===1?{title:w[0].name,copy:'is de winnaar.'}:{title:'Gelijkspel',copy:'Er is geen unieke winnaar.'}}
export function renderResultDetails({game,E}){
  const playerById=new Map(game.players.map(player=>[player.id,player]));
  const rows=[...(game.finalScoreBreakdown||[])].sort((a,b)=>b.total-a.total);
  if(!rows.length)return null;
  const wrap=E('div','carc-final-score-wrap'),table=E('table','carc-final-score');
  const head=E('thead'),headRow=E('tr');
  const headings=[['Speler','Speler'],['●','Punten tijdens het spel'],['♟','Landbouwers'],['═','Onafgewerkte wegen'],['♜','Onafgewerkte steden'],['†','Onafgewerkte kloosters'],['Σ','Totaal']];
  headings.forEach(([icon,label],index)=>{const cell=E('th',index?'carc-score-icon':'',icon);cell.title=label;cell.setAttribute('aria-label',label);headRow.append(cell)});
  head.append(headRow);table.append(head);
  const body=E('tbody');
  rows.forEach((score,index)=>{
    const player=playerById.get(score.playerId),row=E('tr',index===0?'leader':'');
    row.append(E('th','',`${index+1}. ${player?.name||'Speler'}`));
    [score.points,score.farmers,score.incompleteRoads,score.incompleteCities,score.incompleteMonasteries,score.total].forEach((value,column)=>row.append(E('td',column===5?'total':'',String(value||0))));
    body.append(row);
  });
  table.append(body);wrap.append(E('div','carc-final-score-title','Puntenverdeling'),table);return wrap;
}
export function isWinner({game,myId}){const high=Math.max(...game.players.map(p=>p.score));return game.players.filter(p=>p.score===high).length===1&&game.players.find(p=>p.id===myId)?.score===high}
