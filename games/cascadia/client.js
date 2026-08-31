let viewedPlayerId=null;
let draftTileIndex=null;
let draftWildlifeIndex=null;
let tileRotation=0;
let refreshSelection=new Set();

const LABELS={
  mountain:'Berg',forest:'Bos',prairie:'Prairie',wetland:'Moeras',river:'Rivier',
  bear:'Beer',elk:'Wapiti',salmon:'Zalm',hawk:'Havik',fox:'Vos'
};
const ICONS={mountain:'▲',forest:'♣',prairie:'✦',wetland:'≈',river:'∿',bear:'🐻',elk:'🦌',salmon:'🐟',hawk:'🦅',fox:'🦊'};
const HABITAT_CLASS={mountain:'mountain',forest:'forest',prairie:'prairie',wetland:'wetland',river:'river'};
const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];

function coordKey(q,r){return `${q},${r}`}
function neighbors(q,r){return DIRS.map(([dq,dr])=>({q:q+dq,r:r+dr}))}
function legalPositions(board){
  const occupied=new Set(board.map(tile=>coordKey(tile.q,tile.r))),result=new Map();
  for(const tile of board)for(const pos of neighbors(tile.q,tile.r)){
    const key=coordKey(pos.q,pos.r);if(!occupied.has(key))result.set(key,pos);
  }
  return [...result.values()];
}
function legalWildlife(board,type){return board.filter(tile=>!tile.animal&&tile.wildlife.includes(type))}
function terrainStyle(tile){
  const habitats=tile.habitats||[];
  if(habitats.length<2)return '';
  return `--tile-rotation:${Number(tile.rotation||0)*60}deg`;
}
function scoreHint(type){
  if(type==='bear')return 'Exacte paren: 4 / 11 / 19 / 27';
  if(type==='elk')return 'Rechte lijnen: 2 / 5 / 9 / 13';
  if(type==='salmon')return 'Runs: 2 / 5 / 8 / 12 / 16 / 20 / 25';
  if(type==='hawk')return 'Niet-aangrenzend: 2 / 5 / 8 / 11 / 14 / 18 / 22 / 26';
  return 'Per vos: verschillende aangrenzende diersoorten';
}
function ensureView(room,game){
  if(!viewedPlayerId||!game.players.some(player=>player.id===viewedPlayerId))viewedPlayerId=room.meId||game.players[0]?.id;
  if((game.canPlaceTile||game.canPlaceWildlife)&&room.meId)viewedPlayerId=room.meId;
}
function resetDraftState(){draftTileIndex=null;draftWildlifeIndex=null;refreshSelection=new Set()}

function tileVisual(E,tile,{ghost=false,pendingAnimal=null}={}){
  const node=E('span',`cascadia-hex ${ghost?'ghost':''} ${tile.keystone?'keystone':''}`);
  const terrain=E('span',`cascadia-terrain ${(tile.habitats||[]).length===1?`single ${HABITAT_CLASS[tile.habitats[0]]}`:'split'}`);
  if((tile.habitats||[]).length>1){
    terrain.classList.add(HABITAT_CLASS[tile.habitats[0]],`${HABITAT_CLASS[tile.habitats[1]]}-secondary`);
    terrain.style.cssText=terrainStyle(tile);
  }
  const center=E('span','cascadia-hex-center');
  if(tile.animal)center.append(E('span','cascadia-animal-token',ICONS[tile.animal]||'?'));
  else if(pendingAnimal)center.append(E('span','cascadia-animal-token preview',ICONS[pendingAnimal]||'?'));
  const options=E('span','cascadia-wildlife-options');
  (tile.wildlife||[]).forEach(type=>options.append(E('span','',ICONS[type]||'?')));
  if(tile.keystone)node.append(E('span','cascadia-cone','◆'));
  node.append(terrain,center,options);
  return node;
}

function renderPlayers(E,game,room,renderGame){
  const wrap=E('div','cascadia-players');
  game.players.forEach(player=>{
    const item=E('button',`cascadia-player ${player.id===game.turnPlayerId?'active':''} ${player.id===viewedPlayerId?'viewing':''}`);
    item.type='button';
    const top=E('span','cascadia-player-top');top.append(E('strong','',player.name),E('span','cascadia-nature',`◆ ${player.nature}`));
    const score=player.finalScore!=null?`${player.finalScore} pt`:`± ${player.preview?.total||0} pt`;
    item.append(top,E('small','',`${player.turns}/${game.turnsPerPlayer} beurten · ${score}`));
    item.onclick=()=>{viewedPlayerId=player.id;renderGame(room)};
    wrap.append(item);
  });
  return wrap;
}

function marketTileButton(E,tile,index,selected,onClick){
  const button=E('button',`cascadia-market-tile ${selected?'selected':''}`);button.type='button';
  button.append(tileVisual(E,tile),E('span','cascadia-market-label',tile.keystone?'Keystone':'Habitat'));
  button.setAttribute('aria-label',`Habitattegel ${index+1}: ${(tile.habitats||[]).map(type=>LABELS[type]).join(' en ')}`);
  button.onclick=onClick;return button;
}
function wildlifeButton(E,type,index,selected,onClick){
  const button=E('button',`cascadia-market-animal ${selected?'selected':''}`);button.type='button';
  button.append(E('span','cascadia-market-animal-icon',ICONS[type]||'?'),E('small','',LABELS[type]||type));
  button.setAttribute('aria-label',`Dier ${index+1}: ${LABELS[type]||type}`);button.onclick=onClick;return button;
}
function refreshToggle(E,index,selected,onClick){
  const button=E('button',`cascadia-refresh-toggle ${selected?'selected':''}`,selected?'✓ Verversen':'↻ Verversen');
  button.type='button';button.setAttribute('aria-pressed',String(selected));button.onclick=onClick;return button;
}
function renderMarket({game,E,action,renderGame,room}){
  const section=E('section','cascadia-market');
  const me=game.players.find(player=>player.id===room.meId);
  const heading=E('div','cascadia-section-heading');
  const left=E('div','');left.append(E('span','eyebrow','MARKT'),E('span','muted',game.canDraft?'Kies een gekoppeld paar.':'Wacht op de actieve speler.'));
  heading.append(left,E('strong','',`Markt · ${game.tilesRemaining} tegels over`));
  section.append(heading);
  const grid=E('div','cascadia-market-grid');
  game.marketTiles.forEach((tile,index)=>{
    const card=E('div','cascadia-market-card');
    if(tile)card.append(marketTileButton(E,tile,index,draftTileIndex===index,()=>{
      if(!game.canDraft)return;
      draftTileIndex=index;
      if(draftWildlifeIndex===null)draftWildlifeIndex=index;
      renderGame(room);
    }));
    const animal=game.marketWildlife[index];
    if(animal)card.append(wildlifeButton(E,animal,index,draftWildlifeIndex===index,()=>{
      if(!game.canDraft)return;
      draftWildlifeIndex=index;
      if(draftTileIndex===null)draftTileIndex=index;
      renderGame(room);
    }));
    if(game.canDraft&&animal&&(me?.nature||0)>0)card.append(refreshToggle(E,index,refreshSelection.has(index),()=>{
      if(refreshSelection.has(index))refreshSelection.delete(index);else refreshSelection.add(index);
      renderGame(room);
    }));
    if(game.canDraft&&tile&&animal){
      const take=E('button','cascadia-pair-button','Neem paar');take.type='button';
      take.onclick=()=>{resetDraftState();action('draft',{tileIndex:index,wildlifeIndex:index})};card.append(take);
    }
    grid.append(card);
  });
  section.append(grid);

  if(game.canDraft){
    const controls=E('div','cascadia-market-controls');
    if(game.overpopulationType&&!game.overpopUsed){
      const refresh=E('button','secondary',`Ververs 3 × ${ICONS[game.overpopulationType]} gratis`);refresh.type='button';
      refresh.onclick=()=>action('refreshThree');controls.append(refresh);
    }
    if((me?.nature||0)>0){
      const mix=E('button','secondary','◆ Mix tegel + dier');mix.type='button';
      mix.disabled=draftTileIndex===null||draftWildlifeIndex===null||draftTileIndex===draftWildlifeIndex;
      if(!mix.disabled)mix.textContent='◆ Mix nemen';
      mix.onclick=()=>{const ti=draftTileIndex,wi=draftWildlifeIndex;resetDraftState();action('draft',{tileIndex:ti,wildlifeIndex:wi})};
      controls.append(mix);
      const reroll=E('button','ghost',`◆ Ververs selectie${refreshSelection.size?` (${refreshSelection.size})`:''}`);reroll.type='button';
      reroll.disabled=!refreshSelection.size;
      reroll.onclick=()=>{const indices=[...refreshSelection];refreshSelection=new Set();action('refreshWithNature',{indices})};
      controls.append(reroll);
    }
    section.append(controls);
    if((me?.nature||0)>0)section.append(E('p','cascadia-market-note','Met 1 natuurfiche mag je een tegel en dier uit verschillende kolommen nemen, of gemarkeerde dieren verversen.'));
  }
  return section;
}

function boardBounds(board,ghosts=[]){
  const all=[...board,...ghosts];
  const qs=all.map(tile=>tile.q),rs=all.map(tile=>tile.r);
  return {minQ:Math.min(...qs),maxQ:Math.max(...qs),minR:Math.min(...rs),maxR:Math.max(...rs)};
}
function renderBoard({room,game,E,action,renderGame}){
  const owner=game.players.find(player=>player.id===viewedPlayerId)||game.players[0];
  const board=game.boards[owner.id]||[];
  const isOwn=owner.id===room.meId;
  const pending=game.pending;
  const placementGhosts=isOwn&&game.canPlaceTile?legalPositions(board):[];
  const bounds=boardBounds(board,placementGhosts);
  const unitX=68,unitY=59;
  const width=(bounds.maxQ-bounds.minQ+1)*unitX+Math.max(0,bounds.maxR-bounds.minR)*34+76;
  const height=(bounds.maxR-bounds.minR+1)*unitY+76;
  const viewport=E('div','cascadia-board-scroll');
  const canvas=E('div','cascadia-board');
  canvas.style.width=`${Math.max(320,width)}px`;canvas.style.height=`${Math.max(260,height)}px`;
  const leftFor=(q,r)=>(q-bounds.minQ)*unitX+(r-bounds.minR)*34+38;
  const topFor=r=>(r-bounds.minR)*unitY+38;
  const wildlifeTargets=new Set(isOwn&&game.canPlaceWildlife?legalWildlife(board,pending?.animal).map(tile=>coordKey(tile.q,tile.r)):[]);

  for(const tile of board){
    const button=E('button',`cascadia-board-cell ${wildlifeTargets.has(coordKey(tile.q,tile.r))?'target':''}`);button.type='button';
    button.style.left=`${leftFor(tile.q,tile.r)}px`;button.style.top=`${topFor(tile.r)}px`;
    button.append(tileVisual(E,tile));
    button.setAttribute('aria-label',`${(tile.habitats||[]).map(type=>LABELS[type]).join(' / ')}${tile.animal?`, ${LABELS[tile.animal]}`:''}`);
    if(wildlifeTargets.has(coordKey(tile.q,tile.r)))button.onclick=()=>action('placeWildlife',{q:tile.q,r:tile.r});
    else button.disabled=true;
    canvas.append(button);
  }
  for(const pos of placementGhosts){
    const preview={...pending.tile,q:pos.q,r:pos.r,rotation:tileRotation};
    const button=E('button','cascadia-board-cell placement');button.type='button';
    button.style.left=`${leftFor(pos.q,pos.r)}px`;button.style.top=`${topFor(pos.r)}px`;
    button.append(tileVisual(E,preview,{ghost:true}));
    button.setAttribute('aria-label',`Plaats tegel op ${pos.q}, ${pos.r}`);
    button.onclick=()=>{const rotation=tileRotation;tileRotation=0;action('placeTile',{q:pos.q,r:pos.r,rotation})};
    canvas.append(button);
  }
  viewport.append(canvas);

  const section=E('section','cascadia-board-section');
  const heading=E('div','cascadia-section-heading');
  const title=E('div','');title.append(E('span','eyebrow','LANDSCHAP'),E('strong','',owner.name));
  const stats=owner.finalScore!=null?`${owner.finalScore} pt`:`± ${owner.preview?.total||0} pt`;
  heading.append(title,E('span','cascadia-score-pill',stats));section.append(heading);
  if(isOwn&&game.canPlaceTile){
    const toolbar=E('div','cascadia-placement-toolbar');
    toolbar.append(E('span','',`Draai tegel: ${tileRotation*60}°`));
    const left=E('button','ghost','↺');left.type='button';left.onclick=()=>{tileRotation=(tileRotation+5)%6;renderGame(room)};
    const right=E('button','ghost','↻');right.type='button';right.onclick=()=>{tileRotation=(tileRotation+1)%6;renderGame(room)};
    toolbar.append(left,right);section.append(toolbar);
  }
  if(isOwn&&game.canPlaceWildlife){
    const prompt=E('div','cascadia-animal-prompt');
    prompt.append(E('span','cascadia-big-animal',ICONS[pending?.animal]||'?'),E('span','',`Plaats ${LABELS[pending?.animal]||pending?.animal} op een gemarkeerde tegel.`));
    const discard=E('button','ghost','Dier terugleggen');discard.type='button';discard.onclick=()=>action('discardWildlife');prompt.append(discard);section.append(prompt);
  }
  section.append(viewport);
  return section;
}

function renderObjectives(E){
  const section=E('section','cascadia-objectives');
  section.append(E('span','eyebrow','DIERSCORES · KAART A'));
  const row=E('div','cascadia-objective-row');
  ['bear','elk','salmon','hawk','fox'].forEach(type=>{
    const item=E('div','cascadia-objective');item.append(E('span','cascadia-objective-icon',ICONS[type]),E('strong','',LABELS[type]),E('small','',scoreHint(type)));row.append(item);
  });
  section.append(row);return section;
}
function renderFinalScores(E,game){
  if(!game.gameOver||!game.scores)return null;
  const section=E('section','cascadia-final');section.append(E('span','eyebrow','EINDSCORE'));
  const table=E('div','cascadia-final-grid');
  game.players.slice().sort((a,b)=>(b.finalScore||0)-(a.finalScore||0)).forEach(player=>{
    const score=game.scores[player.id];
    const card=E('div',`cascadia-final-card ${game.winnerIds.includes(player.id)?'winner':''}`);
    card.append(E('strong','',player.name),E('b','',`${score.total} pt`));
    card.append(E('small','',`Dieren ${score.wildlifeTotal} · Habitats ${score.habitatTotal} · Natuur ${score.nature}`));
    card.append(E('small','cascadia-final-habitats',Object.entries(score.habitats).map(([type,value])=>`${ICONS[type]} ${value.corridor}+${value.bonus}`).join('  ')));
    table.append(card);
  });section.append(table);return section;
}

export function render(api){renderCascadia(api)}

function renderCascadia({room,game,els,E,action,titlebar,renderGame}){
  ensureView(room,game);
  const turn=game.players.find(player=>player.id===game.turnPlayerId);
  const status=game.gameOver?game.resultText:
    game.canDraft?'Kies een habitattegel en dier.':
    game.canPlaceTile?'Plaats je habitattegel.':
    game.canPlaceWildlife?`Plaats ${LABELS[game.pending?.animal]||'je dier'}.`:
    `${turn?.name||''} is aan de beurt.`;
  els.gameStage.append(titlebar('Cascadia',status));
  els.gameStage.append(renderPlayers(E,game,room,renderGame));
  if(!game.gameOver)els.gameStage.append(renderMarket({game,E,action,renderGame,room}));
  els.gameStage.append(renderBoard({room,game,E,action,renderGame}));
  els.gameStage.append(renderObjectives(E));
  const final=renderFinalScores(E,game);if(final)els.gameStage.append(final);
}

export function metric({player}){
  const score=Number(player.finalScore??player.preview?.total??0);
  return {text:`${score} pt`,score};
}
export function presentResult({game}){
  return {title:game.winnerIds?.length===1?(game.players.find(player=>player.id===game.winnerIds[0])?.name||'Cascadia'):'Gelijkspel',copy:game.resultText||'Cascadia afgelopen.'};
}
export function isWinner({game,myId}){return game.winnerIds?.length===1&&game.winnerIds[0]===myId}
