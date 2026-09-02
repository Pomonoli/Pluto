import { ERA_THEMES } from './themes.js';

const LEADER_ATTRIBUTES = {
  cleopatra: '👑', alexander: '🪖', einstein: '🌀', gandhi: '👓',
  bismarck: '⛑️', lincoln: '🎩', achilles: '⚔️', harald: '🛡️'
};

// Static hint shown on the tile before it has fired: the exact percentage
// depends on the Age it's bought in (10% per Age), so only the targeted
// stat is named here — the precise number appears in the confirm popup.
function civicPreviewText(civic) { return `+10%×Tijdperk ${civic.statLabel}`; }

function theme(age) { return ERA_THEMES[(age - 1) % ERA_THEMES.length]; }
function buildingTheme(age, type) { return theme(age).buildings[type] || { color: '#B8895A', icon: '' }; }

export function render(api){renderCivilization(api)}
function renderCivilization({game,state,els,E,action,titlebar,logBox,sound}) {
  if (game.phase === 'picking') {
    renderPicking(E, action, sound, game, els, titlebar, logBox);
    return;
  }

  const you=game.players.find((player)=>player.isYou);
  if(!you)return;

  const status=game.gameOver?'Spel afgelopen.':game.phase==='wave'
    ?`Tijdperk ${game.age}/${game.totalAges} · aanval`
    :you.acted?`Tijdperk ${game.age}/${game.totalAges} · beurt ${game.turnInAge}/${game.turnsPerAge} · wachten`:`Tijdperk ${game.age}/${game.totalAges} · beurt ${game.turnInAge}/${game.turnsPerAge} · kies een actie`;
  const root=E('div','civ-root');
  root.style.setProperty('--civ-accent',theme(game.age).palette.gold||'#B8895A');
  const openModal=(options)=>showCivModal(E,root,options);
  root.append(renderTopStrip(E,game),renderEraBanner(E,game),renderStats(E,you),renderCivicRow(E,action,sound,game,you,openModal),renderYourGrid(E,action,sound,game,you,openModal));

  if(game.phase==='draft'){
    if(!you.acted&&game.yourHand.length)root.append(renderDraft(E,action,sound,game,you,openModal));
    else if(!you.acted)root.append(E('div','civ-waiting','Geen kaarten of upgrades meer beschikbaar.'));
    else root.append(E('div','civ-waiting','Wachten op andere spelers…'));
  } else if(game.phase==='wave') root.append(renderWave(E,game));
  else root.append(renderGameOver(E,game,you));

  els.gameStage.append(titlebar('Age of Civilization',status),root,logBox(game.log||[]));
}

function renderPicking(E, action, sound, game, els, titlebar, logBox) {
  const root=E('div','civ-root civ-picking');
  const you=game.players.find((p)=>p.isYou);
  const picker=game.players.find((p)=>p.id===game.pickerId);
  root.append(E('div','civ-pick-title','Kies je leider'));
  root.append(E('div','civ-pick-sub', game.isYourPick ? 'Jij bent aan de beurt.' : `Wachten op ${picker?picker.name:'…'}…`));

  const list=E('div','civ-leader-list');
  game.leaders.forEach((leader)=>{
    const card=E('button',`civ-leader-card${leader.taken?' taken':''}`);
    card.type='button';
    const medallion=E('div','civ-medallion');
    medallion.append(E('div','civ-medallion-base','👤'),E('div','civ-medallion-attr',LEADER_ATTRIBUTES[leader.key]||''));
    card.append(medallion,E('div','civ-leader-name',leader.name),E('div','civ-leader-attribute',leader.attribute),E('div','civ-leader-bonus',leader.bonus));
    if(leader.taken){
      const owner=game.players.find((p)=>p.leaderKey===leader.key);
      card.append(E('div','civ-leader-owner',owner?`Gekozen door ${owner.name}`:'Al gekozen'));
      card.disabled=true;
    } else if(!game.isYourPick){
      card.disabled=true;
    } else {
      card.onclick=()=>{sound('score');action('pickLeader',{leaderKey:leader.key})};
    }
    list.append(card);
  });
  root.append(list);

  const strip=renderTopStrip(E,game);
  els.gameStage.append(titlebar('Age of Civilization','Leiderskeuze'),strip,root,logBox(game.log||[]));
}

function renderTopStrip(E,game){
  const strip=E('div','civ-top-strip');
  game.players.forEach((player)=>{
    const chip=E('div',`civ-player-chip${player.isYou?' you':''}${player.alive===false?' dead':''}${player.id===game.pickerId?' picking':''}`);
    const head=E('div','civ-chip-head');
    head.append(E('span','civ-chip-name',`${player.isYou?'Jij':player.name}`));
    if(player.leaderName)head.append(E('span','civ-chip-leader',`${LEADER_ATTRIBUTES[player.leaderKey]||''} ${player.leaderName}`));
    chip.append(head);
    if(player.hp!==undefined){
      const track=E('div','civ-chip-hp-track'),fill=E('div','civ-chip-hp-fill');
      fill.style.width=`${Math.max(0,player.hp)}%`;
      if(player.alive===false)fill.classList.add('dead');
      track.append(fill);
      chip.append(track,E('div','civ-chip-hp-label',player.alive===false?'Verslagen':`${player.hp}/100`));
    }
    if(game.phase==='draft'&&player.alive!==false){
      chip.append(E('div',`civ-chip-status ${player.acted?'ready':'waiting'}`,player.acted?'✓':'…'));
    }
    strip.append(chip);
    strip.append(E('div','civ-chip-arrow','→'));
  });
  if(strip.lastChild)strip.removeChild(strip.lastChild);
  return strip;
}

function renderEraBanner(E,game){const wrap=E('div','civ-era-banner');wrap.append(E('div','civ-era-num',`TIJDPERK ${game.age} / ${game.totalAges} · BEURT ${game.turnNumber}/${game.totalTurns}`),E('div','civ-era-name',game.eraName));return wrap;}

function renderStats(E,player){
  const wrap=E('div','civ-stats-row civ-you');
  const boxes=E('div','civ-stat-boxes');
  for(const [label,value] of [['Goud',player.gold],['Attack',player.attack],['Defence',player.defence],['Inkomen',`+${player.income}`]])boxes.append(statBox(E,label,value));
  const hp=statBox(E,'Toren',`${player.hp}/100`),track=E('div','civ-hp-track'),fill=E('div','civ-hp-fill');fill.style.width=`${Math.max(0,player.hp)}%`;track.append(fill);hp.append(track);boxes.append(hp);wrap.append(boxes);return wrap;
}
function statBox(E,label,value){const box=E('div','civ-stat-box');box.append(E('div','civ-stat-label',label),E('div','civ-stat-value',String(value)));return box;}

function renderCivicRow(E,action,sound,game,you,openModal){
  const wrap=E('div','civ-grid-block'),row=E('div','civ-civic-row');
  wrap.append(E('div','civ-grid-label','Vaste gebouwen'));
  const canAct=game.phase==='draft'&&!you.acted;
  for(const key of ['science','religion','culture']){
    const civic=you.civic[key];
    const bt=buildingTheme(game.age,key);
    const node=E('button','civ-tile civ-civic filled');node.type='button';
    node.style.setProperty('--tile-accent',bt.color);
    node.append(E('div','civ-tile-icon',bt.icon),E('div','civ-tile-name',civic.name),E('div','civ-tile-level',`Niv. ${civic.upgradeCount}`));
    node.append(E('div','civ-tile-perk',civic.eventsFired?`×${civic.eventsFired} gebeurtenis actief`:civicPreviewText(civic)));
    if(canAct){
      const afford=you.gold>=civic.upgradeCost;
      node.append(E('div',`civ-tile-upgrade${civic.isEventStep?' event':''}`,`${civic.isEventStep?'Ontketen':'Upgrade'} (${civic.upgradeCost}g)`));
      node.disabled=!afford;
      node.onclick=()=>openModal({
        eyebrow:'Vast gebouw',
        title:`${bt.icon} ${civic.name}`,
        body:civic.isEventStep
          ? `Niveau ${civic.upgradeCount} → ${civic.upgradeCount+1}. Deze upgrade ontketent: +${civic.eventBonusPct}% ${civic.statLabel} — eenmalig, blijvend toegepast op je huidige ${civic.statLabel}.`
          : `Niveau ${civic.upgradeCount} → ${civic.upgradeCount+1}. Deze stap bereidt de volgende gebeurtenis voor en geeft nog geen directe statbonus.`,
        cost:civic.upgradeCost,
        confirmLabel:civic.isEventStep?'Ontketen':'Upgrade',
        onConfirm:()=>{sound('score');action('upgrade',{civic:key})}
      });
    } else node.disabled=true;
    row.append(node);
  }
  wrap.append(row);
  return wrap;
}

function renderYourGrid(E,action,sound,game,you,openModal){
  const wrap=E('div','civ-grid-block'),grid=E('div','civ-grid');
  wrap.append(E('div','civ-grid-label','Jouw stad'));
  const canAct=game.phase==='draft'&&!you.acted;
  you.grid.forEach((tile,slot)=>{
    if(!tile){grid.append(E('div','civ-tile'));return}
    const bt=buildingTheme(game.age,tile.type);
    const node=E('button','civ-tile filled');node.type='button';
    node.style.setProperty('--tile-accent',bt.color);
    node.append(E('div','civ-tile-icon',bt.icon),E('div','civ-tile-name',tile.name),E('div','civ-tile-level',`Niv. ${tile.level}`));
    node.append(E('div','civ-tile-perk',tilePerkText(tile)));
    if(canAct&&!tile.maxed){
      const afford=you.gold>=tile.upgradeCost;
      node.append(E('div','civ-tile-upgrade',`Upgrade (${tile.upgradeCost}g)`));
      node.disabled=!afford;
      node.onclick=()=>openModal({
        eyebrow:'Jouw stad',
        title:`${bt.icon} ${tile.name}`,
        body:upgradeDeltaText(tile),
        cost:tile.upgradeCost,
        confirmLabel:'Upgrade',
        onConfirm:()=>{sound('score');action('upgrade',{slot})}
      });
    } else node.disabled=true;
    grid.append(node);
  });
  wrap.append(grid);
  return wrap;
}

function tilePerkText(t){
  const parts=[];
  if(t.attack)parts.push(`+${t.attack} ATK`);
  if(t.defence)parts.push(`+${t.defence} DEF`);
  if(t.income)parts.push(`+${t.income}g`);
  return parts.join(' · ');
}

function upgradeDeltaText(tile){
  const parts=[];
  if(tile.nextAttack!==tile.attack)parts.push(`ATK +${tile.nextAttack-tile.attack}`);
  if(tile.nextDefence!==tile.defence)parts.push(`DEF +${tile.nextDefence-tile.defence}`);
  if(tile.nextIncome!==tile.income)parts.push(`Inkomen +${tile.nextIncome-tile.income}`);
  return parts.length?parts.join(' · '):'Geen zichtbare statverhoging door afronding.';
}

function showCivModal(E,root,{eyebrow,title,body,cost=null,confirmLabel='',onConfirm=null,secondaryLabel='',onSecondary=null}){
  root.querySelector('.civ-modal-backdrop')?.remove();
  const backdrop=E('div','civ-modal-backdrop'),modal=E('div','civ-modal'),actions=E('div','civ-detail-actions civ-modal-actions');
  const close=()=>backdrop.remove();
  backdrop.onclick=(event)=>{if(event.target===backdrop)close()};
  modal.append(E('div','civ-modal-eyebrow',eyebrow),E('div','civ-detail-name',title),E('div','civ-detail-desc',body));
  if(cost!==null)modal.append(E('div','civ-modal-cost',`Kost ${cost} goud`));
  if(onSecondary){const secondary=E('button','civ-btn civ-btn-ghost civ-modal-secondary',secondaryLabel);secondary.onclick=()=>{close();onSecondary()};actions.append(secondary)}
  if(onConfirm){const confirm=E('button','civ-btn civ-btn-primary civ-modal-confirm',confirmLabel);confirm.onclick=()=>{close();onConfirm()};actions.append(confirm)}
  const back=E('button','civ-btn civ-btn-ghost civ-modal-back','Terug');back.onclick=close;actions.append(back);
  modal.append(actions);backdrop.append(modal);root.append(backdrop);
}

function renderDraft(E,action,sound,game,you,openModal){
  const wrap=E('div','civ-draft'),hand=E('div','civ-hand');
  wrap.append(E('div','civ-draft-label','Kies één kaart'));
  const showDetail=(card)=>{
    const bt=buildingTheme(game.age,card.type);
    openModal({
      eyebrow:'Kaart',title:`${bt.icon} ${card.name}`,body:card.desc,cost:card.cost,
      confirmLabel:'Bouw',onConfirm:you.gold>=card.cost&&you.grid.some((slot)=>slot===null)?()=>{sound('score');action('build',{handIndex:card.idx})}:null,
      secondaryLabel:'Gooi weg voor goud',onSecondary:()=>{sound('card');action('discard',{handIndex:card.idx})}
    });
  };
  for(const card of game.yourHand){
    const bt=buildingTheme(game.age,card.type);
    const node=E('button',`civ-card${card.type==='wonder'?' wonder':''}`);node.type='button';node.dataset.index=String(card.idx);
    node.style.setProperty('--tile-accent',bt.color);
    node.append(E('div','civ-card-icon',bt.icon),E('div','civ-card-name',card.name),E('div','civ-card-perk',tilePerkText(card)),E('div','civ-card-cost',`Kost ${card.cost}g`));
    node.onclick=()=>showDetail(card);hand.append(node)
  }
  wrap.append(hand);
  return wrap;
}

function renderWave(E,game){
  const wrap=E('div','civ-wave');
  wrap.append(E('div','civ-wave-title',`Tijdperk ${game.waveResult.age} — Aanvalsgolf`));
  const list=E('div','civ-wave-list');
  game.players.forEach((player)=>{
    const result=game.waveResult.results[player.id];
    if(!result)return;
    const attacker=game.players.find((p)=>p.id===result.attackerId);
    const row=E('div',`civ-wave-row${player.isYou?' you':''}`);
    row.append(E('div','civ-wave-name',`${player.isYou?'Jij':player.name}`));
    row.append(E('div','civ-wave-numbers',`Attack ${result.attack} · Defence ${result.defence} ← ${attacker?attacker.name:'?'} (${result.incoming})`));
    row.append(E('div',`civ-wave-result ${result.damage?'hit':'ok'}`,result.damage?`-${result.damage} HP`:'Afgeslagen'));
    list.append(row);
  });
  wrap.append(list);
  return wrap;
}

function renderGameOver(E,game,you){
  const wrap=E('div','civ-gameover');wrap.append(E('h2','civ-go-headline',game.resultText));
  const table=E('div','civ-final-table');
  const ranked=[...game.players].sort((a,b)=>(b.hp-a.hp)||(b.gold-a.gold));
  for(const player of ranked){
    const row=E('div',`civ-final-row${game.winnerId===player.id?' winner':''}`),info=E('div');
    info.append(E('div','civ-fname',`${player.isYou?'Jij · ':''}${player.name}${player.leaderName?` · ${player.leaderName}`:''}`),E('div','civ-breakdown',`Goud ${player.gold} · Attack ${player.attack} · Defence ${player.defence}`));
    row.append(info,E('div','civ-fscore',`${player.hp}/100`));
    table.append(row);
  }
  wrap.append(table);
  return wrap;
}

export function metric({game,player}){const score=Number(game.finalScores?.[player.id]??player.gold??0);return{text:`${score}g`,score};}
export function isWinner({game,myId}){return game.winnerId===myId;}
export function presentResult({game}){return game.resultText;}
