let state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList;
const views={};
export const roomOptions={bodyClass:'carcassonne-active'};
function bind(api){({state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList}=api)}
export function render(api){bind(api);renderCarcassonne(api.room,api.game)}

const SIDE_NAMES=['north','east','south','west'];
function burgerLabel(count){return `${count} ${count===1?'burger':'burgers'}`}
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
  const controls=E('div','carc-controls');controls.append(E('span','eyebrow',`${game.tilesRemaining} TEGELS OVER`));
  if(mine&&game.phase==='place'&&game.currentTile){const drawn=E('div','carc-drawn');drawn.append(carcassonneTileNode(game.currentTile,{preview:true}));const rotate=E('button','secondary','↻ Roteer');rotate.onclick=()=>action('rotate');drawn.append(rotate);controls.append(drawn);if(!game.validPlacements.length)controls.append(E('div','player-note','Geen plek in deze stand — roteer de tegel.'))}
  if(mine&&game.phase==='meeple'){const picker=E('div','carc-meeple-picker');picker.append(E('strong','','Burger plaatsen?'));(game.meepleChoices||[]).forEach(choice=>{const b=E('button','secondary',choice.label);b.onclick=()=>action('meeple',{choice:choice.key});picker.append(b)});const skip=E('button','ghost','Geen burger');skip.onclick=()=>action('skipMeeple');picker.append(skip);controls.append(picker)}els.gameStage.append(controls);
  const viewport=E('div','carc-viewport');const board=E('div','carc-board');const size=72,world=160,origin=(world-1)/2;board.style.width=`${world*size}px`;board.style.height=`${world*size}px`;
  (game.board||[]).forEach(entry=>{const tile=carcassonneTileNode(entry.tile);tile.style.left=`${(entry.x+origin)*size}px`;tile.style.top=`${(entry.y+origin)*size}px`;if(game.lastPlaced?.x===entry.x&&game.lastPlaced?.y===entry.y)tile.classList.add('last-placed');(game.meeples||[]).filter(m=>m.x===entry.x&&m.y===entry.y).forEach(m=>{const player=game.players.find(p=>p.id===m.playerId),meeple=E('span',`carc-meeple ${m.kind}`,m.kind==='field'?'♟':'●');meeple.style.background=player?.color||'#fff';meeple.title=`${player?.name||''} · ${m.kind}`;tile.append(meeple)});board.append(tile)});
  if(mine&&game.phase==='place')(game.validPlacements||[]).forEach(place=>{const spot=E('button','carc-valid','+');spot.type='button';spot.style.left=`${(place.x+origin)*size}px`;spot.style.top=`${(place.y+origin)*size}px`;spot.setAttribute('aria-label',`Leg tegel op ${place.x}, ${place.y}`);spot.onclick=()=>{sound('card');action('place',{x:place.x,y:place.y})};board.append(spot)});
  viewport.append(board);els.gameStage.append(viewport);const view=views[room.id]||(views[room.id]={x:0,y:0,scale:.9});attachCarcassonneViewport(viewport,board,view);els.gameStage.append(logBox(game.log));
}

export function metric({player}){return {text:`${player.score} pt · ${burgerLabel(player.meeples)}`,score:Number(player.score||0)}}
export function presentResult({game}){const high=Math.max(...game.players.map(p=>p.score)),w=game.players.filter(p=>p.score===high);return w.length===1?{title:w[0].name,copy:'is de winnaar.'}:{title:'Gelijkspel',copy:'Er is geen unieke winnaar.'}}
export function isWinner({game,myId}){const high=Math.max(...game.players.map(p=>p.score));return game.players.filter(p=>p.score===high).length===1&&game.players.find(p=>p.id===myId)?.score===high}