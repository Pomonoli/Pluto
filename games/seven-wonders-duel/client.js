const RESOURCE_LABELS={wood:'Hout',clay:'Klei',stone:'Steen',glass:'Glas',papyrus:'Papyrus',wildRaw:'Vrij ruw',wildGray:'Vrij grijs'};
const RESOURCE_ICONS={wood:'🌲',clay:'🧱',stone:'🪨',glass:'◈',papyrus:'▤',wildRaw:'◆',wildGray:'◇'};
const SCIENCE_ICONS={wheel:'⚙',mortar:'⚗',tablet:'▣',compass:'⌖',astrolabe:'✦',law:'§'};
const COLOR_LABELS={brown:'Grondstof',gray:'Manufactuur',yellow:'Handel',blue:'Burgerlijk',red:'Militair',green:'Wetenschap',purple:'Gilde'};

function sumResources(production){
  return Object.entries(production||{}).filter(([,amount])=>amount>0).map(([key,amount])=>`${RESOURCE_ICONS[key]||key} ${amount}`).join('  ')||'geen productie';
}
function scienceLine(sciences){
  return Object.entries(sciences||{}).filter(([,count])=>count>0).map(([key,count])=>`${SCIENCE_ICONS[key]||key}${count>1?`×${count}`:''}`).join(' ')||'geen';
}
function cardCostText(card){
  if(card.costCoins!=null)return card.costCoins===0?'Gratis':`${card.costCoins} munt${card.costCoins===1?'':'en'}`;
  const parts=[];
  if(card.cost?.coins)parts.push(`${card.cost.coins} munt${card.cost.coins===1?'':'en'}`);
  Object.entries(card.cost?.resources||{}).forEach(([resource,count])=>parts.push(`${RESOURCE_ICONS[resource]||resource}${count}`));
  return parts.join(' ')||'Gratis';
}
function cardEffectText(card){
  const parts=[];
  if(card.produces)parts.push(sumResources(card.produces));
  if(card.coins)parts.push(`+${card.coins} munten`);
  if(card.vp)parts.push(`+${card.vp} VP`);
  if(card.shields)parts.push(`+${card.shields} schild${card.shields===1?'':'en'}`);
  if(card.science)parts.push(`${SCIENCE_ICONS[card.science]||''} wetenschap`);
  if(card.guild)parts.push(`gilde: ${COLOR_LABELS[card.guild]||card.guild}`);
  if(card.effect==='rawTrade')parts.push('ruwe grondstoffen kopen voor 1');
  if(card.effect==='grayTrade')parts.push('glas/papyrus kopen voor 1');
  return parts.join(' · ')||'Geen direct effect';
}
function wonderEffectText(wonder){
  const parts=[];
  if(wonder.vp)parts.push(`+${wonder.vp} VP`);
  if(wonder.coins)parts.push(`+${wonder.coins} munten`);
  if(wonder.shields)parts.push(`+${wonder.shields} schild${wonder.shields===1?'':'en'}`);
  if(wonder.produces)parts.push(sumResources(wonder.produces));
  if(wonder.extraTurn)parts.push('extra beurt');
  if(wonder.progress)parts.push('vooruitgangstoken');
  return parts.join(' · ');
}

export function render(api){renderDuel(api)}

function renderDuel({room,game,state,els,E,action,titlebar}){
  const me=game.players.find(player=>player.id===room.meId);
  const turn=game.players.find(player=>player.id===game.turnPlayerId);
  let status=game.gameOver?game.resultText:game.canChooseProgress?'Kies een vooruitgangstoken.':game.canAct?'Jij bent aan zet. Kies een vrije kaart.':`${turn?.name||'Tegenstander'} is aan zet.`;
  els.gameStage.append(titlebar('7 Wonders Duel',status));

  const shell=E('div','duel-shell');
  const header=E('div','duel-header');
  game.players.forEach(player=>header.append(playerPanel(E,player,game)));
  shell.append(header);

  shell.append(militaryTrack(E,game));

  const selectedTab=game.canChooseProgress?'realm':(state.duelTab==='realm'?'realm':'cards');
  state.duelTab=selectedTab;
  const content=E('div','duel-tab-content');
  const cardsPanel=E('section',`duel-tab-panel duel-cards-panel${selectedTab==='cards'?' active':''}`);
  const realmPanel=E('section',`duel-tab-panel duel-realm-panel${selectedTab==='realm'?' active':''}`);

  const boardWrap=E('div','duel-board-wrap');
  const boardHead=E('div','duel-board-head');
  boardHead.append(E('div','duel-age',`Leeftijd ${game.age}/3`),E('div','duel-wonder-limit',`${game.builtWonderCount}/7 wonders gebouwd`));
  boardWrap.append(boardHead);

  const board=E('div','duel-board');
  (game.cards||[]).filter(card=>!card.removed).forEach(card=>{
    const node=E('button',`duel-card ${card.revealed?`color-${card.color||'hidden'}`:'face-down'} ${card.available?'available':''}`);
    node.type='button';
    node.style.gridRow=String(card.row+1);
    node.style.gridColumn=`${card.col} / span 2`;
    node.disabled=!(game.canAct&&card.available&&!game.pendingProgressFor);
    if(card.revealed){
      node.append(E('span','duel-card-type',COLOR_LABELS[card.color]||''),E('strong','duel-card-name',card.name),E('span','duel-card-cost',cardCostText(card)),E('small','duel-card-effect',cardEffectText(card)));
      if(node.disabled&&card.available)node.title='Beschikbaar zodra jij aan de beurt bent.';
    }else{
      node.append(E('span','duel-card-back-mark','VII'),E('small','duel-card-back-age',`Leeftijd ${game.age}`));
    }
    if(game.canAct&&card.available&&!game.pendingProgressFor)node.onclick=()=>openCardChoice({E,boardWrap,game,card,me,action});
    board.append(node);
  });
  boardWrap.append(board);
  cardsPanel.append(boardWrap);

  if(game.canChooseProgress)realmPanel.append(progressPicker(E,game,action));
  const lower=E('div','duel-lower');
  lower.append(wondersPanel(E,me,game));
  lower.append(progressOverview(E,game));
  realmPanel.append(lower);
  content.append(cardsPanel,realmPanel);
  shell.append(content);

  const tabs=E('nav','duel-tabs');
  const cardsTab=E('button',`duel-tab${selectedTab==='cards'?' active':''}`);
  cardsTab.type='button';cardsTab.append(E('strong','','Kaarten'),E('small','',`Leeftijd ${game.age}/3`));
  const realmTab=E('button',`duel-tab${selectedTab==='realm'?' active':''}`);
  realmTab.type='button';realmTab.append(E('strong','','Jouw wonders'),E('small','','Vooruitgang'));
  const selectTab=(name)=>{
    state.duelTab=name;
    cardsPanel.classList.toggle('active',name==='cards');realmPanel.classList.toggle('active',name==='realm');
    cardsTab.classList.toggle('active',name==='cards');realmTab.classList.toggle('active',name==='realm');
  };
  cardsTab.onclick=()=>selectTab('cards');realmTab.onclick=()=>selectTab('realm');
  tabs.append(cardsTab,realmTab);shell.append(tabs);

  els.gameStage.append(shell);
}

function playerPanel(E,player,game){
  const active=player.id===game.turnPlayerId;
  const panel=E('section',`duel-player seat-${player.seat} ${active?'active':''} ${player.connected===false?'offline':''}`);
  const title=E('div','duel-player-title');
  title.append(E('strong','',player.name),E('span','duel-player-coins',`● ${player.coins}`));
  panel.append(title);
  panel.append(E('div','duel-player-meta',`${sumResources(player.production)} · wetenschap ${player.distinctScience}/6`));
  panel.append(E('div','duel-science-line',scienceLine(player.sciences)));
  const built=E('div','duel-built-line');
  ['brown','gray','yellow','blue','red','green','purple'].forEach(color=>{
    const count=(player.built||[]).filter(card=>card.color===color).length;
    if(count)built.append(E('span',`duel-mini color-${color}`,`${count}`));
  });
  if(player.score!=null)built.append(E('b','duel-final-score',`${player.score} VP`));
  panel.append(built);
  return panel;
}

function militaryTrack(E,game){
  const wrap=E('div','duel-military');
  const labels=E('div','duel-military-labels');
  labels.append(E('span','',game.players[1]?.name||''),E('strong','','Militair'),E('span','',game.players[0]?.name||''));
  const track=E('div','duel-military-track');
  for(let value=-9;value<=9;value+=1){
    const cell=E('span',`duel-military-cell ${Math.abs(value)>=9?'supremacy':Math.abs(value)>=6?'danger':Math.abs(value)>=3?'pressure':''} ${value===0?'center':''}`);
    if(value===game.military)cell.append(E('i','duel-conflict','⚔'));
    track.append(cell);
  }
  wrap.append(labels,track);
  return wrap;
}

function openCardChoice({E,boardWrap,game,card,me,action}){
  boardWrap.querySelector('.duel-choice')?.remove();
  const choice=E('div',`duel-choice color-${card.color}`);
  const head=E('div','duel-choice-head');
  head.append(E('div','',`${card.name} · ${cardCostText(card)}`),E('small','',cardEffectText(card)));
  const close=E('button','duel-choice-close','×');close.type='button';close.onclick=()=>choice.remove();head.append(close);
  choice.append(head);
  const actions=E('div','duel-choice-actions');
  const build=E('button','primary duel-action',card.affordable?`Bouw (${cardCostText(card)})`:`Niet betaalbaar (${cardCostText(card)})`);
  build.type='button';build.disabled=!card.affordable;build.onclick=()=>action('build',{cardId:card.id});
  const discard=E('button','secondary duel-action',`Afleggen (+${game.discardCoins} munten)`);
  discard.type='button';discard.onclick=()=>action('discard',{cardId:card.id});
  actions.append(build,discard);
  choice.append(actions);

  const wonders=(me?.wonders||[]).filter(wonder=>!wonder.built);
  if(wonders.length&&game.builtWonderCount<7){
    choice.append(E('div','duel-choice-subtitle','Of gebruik deze kaart om een wonder te bouwen'));
    const grid=E('div','duel-choice-wonders');
    wonders.forEach(wonder=>{
      const button=E('button',`duel-wonder-choice ${wonder.affordable?'':'disabled'}`);
      button.type='button';button.disabled=!wonder.affordable;
      button.append(E('strong','',wonder.name),E('span','',wonder.costCoins===0?'Gratis':`${wonder.costCoins} munten`),E('small','',wonderEffectText(wonder)));
      button.onclick=()=>action('wonder',{cardId:card.id,wonderIndex:wonder.index});
      grid.append(button);
    });
    choice.append(grid);
  }
  boardWrap.prepend(choice);
  choice.scrollIntoView({block:'nearest',behavior:'smooth'});
}

function wondersPanel(E,me,game){
  const panel=E('section','duel-side-panel');
  panel.append(E('h3','','Jouw wonders'));
  const grid=E('div','duel-wonders');
  (me?.wonders||[]).forEach(wonder=>{
    const card=E('div',`duel-wonder ${wonder.built?'built':''}`);
    card.append(E('strong','',wonder.name),E('span','',wonder.built?'Gebouwd':cardCostText(wonder)),E('small','',wonderEffectText(wonder)));
    grid.append(card);
  });
  panel.append(grid);
  return panel;
}

function progressOverview(E,game){
  const panel=E('section','duel-side-panel');
  panel.append(E('h3','','Vooruitgang'));
  const row=E('div','duel-progress-row');
  (game.progressAvailable||[]).forEach(token=>{
    const chip=E('div','duel-progress-chip');chip.title=token.text;
    chip.append(E('strong','',token.name),E('small','',token.text));row.append(chip);
  });
  panel.append(row);
  return panel;
}

function progressPicker(E,game,action){
  const panel=E('div','duel-progress-picker');
  panel.append(E('strong','','Je hebt een wetenschappelijk paar. Kies één vooruitgangstoken:'));
  const row=E('div','duel-progress-picker-row');
  (game.progressAvailable||[]).forEach(token=>{
    const button=E('button','duel-progress-option');button.type='button';
    button.append(E('b','',token.name),E('small','',token.text));
    button.onclick=()=>action('progress',{tokenId:token.id});row.append(button);
  });
  panel.append(row);return panel;
}

export function metric({player}){return {text:player.score!=null?`${player.score} VP`:`${player.coins||0} munten`,score:Number(player.score||player.coins||0)}}
export function isWinner({game,myId}){return game.winnerId===myId}
export function presentResult({game}){
  const winner=game.players.find(player=>player.id===game.winnerId);
  const reason=game.winType==='military'?'militaire suprematie':game.winType==='science'?'wetenschappelijke suprematie':'de meeste overwinningspunten';
  return winner?{title:winner.name,copy:`wint 7 Wonders Duel via ${reason}.`}:{title:'Gelijkspel',copy:game.resultText||'Niemand wint.'};
}
