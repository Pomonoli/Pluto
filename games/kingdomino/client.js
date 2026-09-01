let directionIndex=0;
const DIRECTIONS=[
  {dx:1,dy:0,label:'→',name:'rechts'},
  {dx:0,dy:1,label:'↓',name:'onder'},
  {dx:-1,dy:0,label:'←',name:'links'},
  {dx:0,dy:-1,label:'↑',name:'boven'}
];
const TERRAIN_META={
  wheat:{label:'Veld',icon:'🌾'},forest:{label:'Bos',icon:'🌲'},water:{label:'Water',icon:'🌊'},
  grass:{label:'Weide',icon:'🌿'},swamp:{label:'Moeras',icon:'🪷'},mine:{label:'Mijn',icon:'⛰️'},castle:{label:'Kasteel',icon:'♛'}
};
function key(x,y){return `${x},${y}`}
function terrainMeta(terrain){return TERRAIN_META[terrain]||{label:terrain,icon:'•'}}
function playerById(game,id){return game.players.find(player=>player.id===id)}
function crowns(E,count){
  const wrap=E('span','kingdomino-crowns');
  for(let i=0;i<(count||0);i++)wrap.append(E('span','kingdomino-crown','♛'));
  return wrap;
}
function halfNode(E,half,small=false){
  const meta=terrainMeta(half?.terrain);
  const node=E('span',`kingdomino-half terrain-${half?.terrain||'unknown'}${small?' small':''}`);
  node.append(E('span','kingdomino-terrain-icon',meta.icon));
  if(!small)node.append(E('span','kingdomino-terrain-name',meta.label));
  if(half?.crowns)node.append(crowns(E,half.crowns));
  return node;
}
function dominoNode(E,tile,{button=false,selected=false,claimed=false}={}){
  const node=E(button?'button':'div',`kingdomino-domino${selected?' selected':''}${claimed?' claimed':''}`);
  if(button)node.type='button';
  if(!tile)return node;
  node.append(halfNode(E,tile.a),halfNode(E,tile.b));
  node.append(E('span','kingdomino-number',String(tile.number)));
  node.setAttribute('aria-label',`Domino ${tile.number}: ${terrainMeta(tile.a.terrain).label} en ${terrainMeta(tile.b.terrain).label}`);
  return node;
}
function cellNode(E,cell,extra=''){
  if(!cell)return E('span',`kingdomino-cell empty ${extra}`);
  const meta=terrainMeta(cell.terrain);
  const node=E('span',`kingdomino-cell terrain-${cell.terrain} ${extra}`);
  node.append(E('span','kingdomino-cell-icon',meta.icon));
  if(cell.crowns)node.append(crowns(E,cell.crowns));
  return node;
}
function statusText(game,turn){
  if(game.gameOver)return game.resultText;
  if(game.phase==='initial-draft')return game.canDraft?'Kies je eerste domino.':`${turn?.name||'Speler'} kiest een eerste domino.`;
  if(game.phase==='place'){
    if(game.canDiscard)return 'Deze domino past nergens meer. Leg hem af.';
    return game.canPlace?'Plaats je domino in je koninkrijk.':`${turn?.name||'Speler'} bouwt aan het koninkrijk.`;
  }
  if(game.phase==='draft')return game.canDraft?'Kies je domino voor de volgende ronde.':`${turn?.name||'Speler'} kiest voor de volgende ronde.`;
  return `${turn?.name||'Speler'} is aan zet.`;
}
function renderPlayerStrip(E,game){
  const strip=E('div',`kingdomino-players count-${game.players.length}`);
  for(const player of game.players){
    const item=E('div',`kingdomino-player player-${player.index}${player.id===game.turnPlayerId?' active':''}`);
    item.append(E('span','kingdomino-player-dot'),E('strong','',player.name));
    item.append(E('span','kingdomino-player-score',`${player.score} pt`));
    if(player.discarded)item.append(E('small','',`${player.discarded} afgelegd`));
    strip.append(item);
  }
  return strip;
}
function renderDraft(E,game,action){
  const wrap=E('section','kingdomino-draft');
  const head=E('div','kingdomino-section-head');
  head.append(E('strong','',game.phase==='initial-draft'?'Eerste keuze':'Volgende rij'));
  head.append(E('small','',game.phase==='initial-draft'?'Laag nummer = vroeger aan de beurt.':'Kies pas nadat je je huidige domino hebt geplaatst.'));
  wrap.append(head);
  const row=E('div','kingdomino-draft-row');
  for(const tile of game.draftRow||[]){
    const owner=tile.claimedBy?playerById(game,tile.claimedBy):null;
    const canChoose=game.canDraft&&!tile.claimedBy;
    const card=dominoNode(E,tile,{button:canChoose,claimed:Boolean(owner)});
    if(owner){
      const claim=E('span',`kingdomino-claim player-${owner.index}`,owner.name);
      card.append(claim);
    }
    if(canChoose)card.addEventListener('click',()=>action('draft',{dominoId:tile.id}));
    row.append(card);
  }
  wrap.append(row);
  return wrap;
}
function legalSet(game,dir){
  return new Set((game.legalPlacements||[]).filter(p=>p.dx===dir.dx&&p.dy===dir.dy).map(p=>key(p.x,p.y)));
}
function renderMainBoard(E,game,me,action,rerender){
  const section=E('section','kingdomino-board-section');
  const heading=E('div','kingdomino-section-head');
  heading.append(E('strong','',me?'Jouw koninkrijk':'Koninkrijk'));
  heading.append(E('small','',me?`${me.score} punten · grootste gebied ${me.largest}`:''));
  section.append(heading);

  if(game.activeTile&&game.turnPlayerId===me?.id){
    const turnTools=E('div','kingdomino-turn-tools');
    const current=E('div','kingdomino-current-tile');
    current.append(E('small','',game.phase==='place'?'Te plaatsen':'Huidige domino'),dominoNode(E,game.activeTile));
    turnTools.append(current);
    if(game.canPlace){
      const rotate=E('div','kingdomino-directions');
      rotate.append(E('small','',`Richting tweede helft: ${DIRECTIONS[directionIndex].name}`));
      const buttons=E('div','kingdomino-direction-buttons');
      DIRECTIONS.forEach((dir,index)=>{
        const button=E('button',`kingdomino-direction${index===directionIndex?' active':''}`,dir.label);
        button.type='button';button.setAttribute('aria-label',`Tweede helft ${dir.name}`);
        button.addEventListener('click',()=>{directionIndex=index;rerender()});
        buttons.append(button);
      });
      rotate.append(buttons);turnTools.append(rotate);
    }
    section.append(turnTools);
  }

  const map=new Map((me?.cells||[]).map(cell=>[key(cell.x,cell.y),cell]));
  const dir=DIRECTIONS[directionIndex];
  const legal=legalSet(game,dir);
  const targetSecond=new Set([...legal].map(k=>{const [x,y]=k.split(',').map(Number);return key(x+dir.dx,y+dir.dy)}));
  const board=E('div','kingdomino-board');
  board.setAttribute('role','grid');
  for(let y=-4;y<=4;y++)for(let x=-4;x<=4;x++){
    const cell=map.get(key(x,y));
    const isAnchor=game.canPlace&&legal.has(key(x,y));
    const isSecond=game.canPlace&&targetSecond.has(key(x,y))&&!cell;
    const button=E('button',`kingdomino-board-cell${cell?' occupied':''}${isAnchor?' legal':''}${isSecond?' preview':''}`);
    button.type='button';button.disabled=!isAnchor;
    button.setAttribute('aria-label',cell?`${terrainMeta(cell.terrain).label}${cell.crowns?`, ${cell.crowns} kroon${cell.crowns===1?'':'en'}`:''}`:isAnchor?'Geldige plaats':'Leeg vak');
    if(cell)button.append(cellNode(E,cell));
    else if(isAnchor)button.append(E('span','kingdomino-placement-mark','+'));
    else if(isSecond)button.append(E('span','kingdomino-placement-ghost','·'));
    if(isAnchor)button.addEventListener('click',()=>action('place',{x,y,dx:dir.dx,dy:dir.dy}));
    board.append(button);
  }
  section.append(board);
  if(game.canDiscard){
    const discard=E('button','secondary kingdomino-discard','Domino afleggen');
    discard.type='button';discard.addEventListener('click',()=>action('discard'));
    section.append(discard);
  }else if(game.canPlace){
    section.append(E('p','kingdomino-hint','Kies de richting en tik daarna op een gemarkeerd vak voor de eerste helft.'));
  }
  return section;
}
function miniBoard(E,player){
  const card=E('div',`kingdomino-mini-card player-${player.index}`);
  const head=E('div','kingdomino-mini-head');head.append(E('strong','',player.name),E('span','',`${player.score} pt`));card.append(head);
  const cells=player.cells||[];
  const xs=cells.map(c=>c.x),ys=cells.map(c=>c.y);
  let minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  while(maxX-minX<4){if(Math.abs(minX)<=Math.abs(maxX))minX--;else maxX++}
  while(maxY-minY<4){if(Math.abs(minY)<=Math.abs(maxY))minY--;else maxY++}
  const map=new Map(cells.map(cell=>[key(cell.x,cell.y),cell]));
  const board=E('div','kingdomino-mini-board');
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)board.append(cellNode(E,map.get(key(x,y)),''));
  card.append(board);
  return card;
}
export function render(api){
  const {room,game,els,E,action,titlebar,renderGame}=api;
  const turn=playerById(game,game.turnPlayerId);
  const me=playerById(game,room.meId);
  els.gameStage.append(titlebar('Kingdomino',statusText(game,turn)));
  const meta=E('div','kingdomino-meta');
  meta.append(E('span','badge',game.phase==='initial-draft'?'Start':`Ronde ${Math.min(game.round,game.totalRounds)}/${game.totalRounds}`));
  if(game.kingsPerPlayer===2)meta.append(E('span','kingdomino-mode','2 koningen per speler'));
  els.gameStage.append(meta,renderPlayerStrip(E,game));

  const layout=E('div','kingdomino-layout');
  const left=E('div','kingdomino-main');
  if((game.draftRow||[]).length)left.append(renderDraft(E,game,action));
  left.append(renderMainBoard(E,game,me,action,()=>renderGame(room)));
  layout.append(left);

  const overview=E('aside','kingdomino-overview');
  const overviewHead=E('div','kingdomino-section-head');overviewHead.append(E('strong','','Alle koninkrijken'),E('small','','Live score zonder bonusregels'));overview.append(overviewHead);
  const minis=E('div','kingdomino-mini-grid');
  game.players.forEach(player=>minis.append(miniBoard(E,player)));
  overview.append(minis);layout.append(overview);
  els.gameStage.append(layout);
}

export function metric({player}){return {text:`${player.score||0} pt`,score:player.score||0}}
export function presentResult({game}){
  const winners=game.players.filter(player=>(game.winnerIds||[]).includes(player.id));
  return {title:winners.length>1?'Gelijkspel':(winners[0]?.name||'Kingdomino'),copy:game.resultText||'Spel afgelopen.'};
}
export function isWinner({game,myId}){return (game.winnerIds||[]).length===1&&game.winnerId===myId}
