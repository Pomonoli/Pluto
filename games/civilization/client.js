import { ERA_THEMES } from './themes.js';

const LEADER_ATTRIBUTES = {
  cleopatra: '👑', alexander: '🪖', einstein: '🌀', gandhi: '👓',
  bismarck: '⛑️', lincoln: '🎩', achilles: '⚔️', harald: '🛡️'
};

// Hint shown on the tile before it's designated: the exact bonus for the
// current Age (10% per Age), applied the instant the building is picked.
function civicPreviewText(civic) { return `+${civic.eventBonusPct}% ${civic.statLabel} bij aanduiden`; }

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
  } else if(game.phase==='wave') {
    root.append(renderWave(E,game));
    if(!game.hasAcknowledgedWave)showCombatModal(E,root,game,you,action,sound);
  }
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
    const name=E('button','civ-chip-name',`${player.isYou?'Jij':player.name}`);
    name.type='button';
    name.title=player.isYou?'Jouw spelerdetails':`${player.name} bekijken`;
    name.onclick=()=>showCivModal(E,strip.parentElement||strip,{eyebrow:'Speler',title:player.isYou?'Jij':player.name,body:`Held: ${player.leaderName||'Nog niet gekozen'} · Heldenkracht: ${player.leaderKey?heroPower(player.leaderKey):'Nog niet gekozen'}`,health:player.hp,confirmLabel:'Sluiten'});
    head.append(name);
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
  for(const [label,value] of [['Goud',player.gold],['Inkomen',`+${player.income}`]])boxes.append(statBox(E,label,value));
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
    node.append(E('div','civ-tile-icon',bt.icon),E('div','civ-tile-name',civic.name));
    node.append(E('div','civ-tile-perk',civic.used?'Gebeurtenis actief':civicPreviewText(civic)));
    if(canAct&&!civic.used){
      const afford=you.gold>=civic.upgradeCost;
      node.append(E('div','civ-tile-upgrade event',`Ontketen (${civic.upgradeCost}g)`));
      if(!afford)node.classList.add('unaffordable');
      node.onclick=()=>{
        openModal({
          eyebrow:'Vast gebouw',
          title:`${bt.icon} ${civic.name}`,
          body:'Aanduiden ontketent meteen een eenmalige, permanente gebeurtenis. Dit kan maar 1x per spel.',
          cost:civic.upgradeCost,
          confirmLabel:'Ontketen',
          confirmDisabled:!afford,
          onConfirm:()=>{sound('score');action('upgrade',{civic:key})}
        });
      };
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
      if(!afford)node.classList.add('unaffordable');
      node.onclick=()=>openModal({
        eyebrow:'Jouw stad',
        title:`${bt.icon} ${tile.name}`,
        body:upgradeDeltaText(tile),
        cost:tile.upgradeCost,
        confirmLabel:'Upgrade',
        confirmDisabled:!afford,
        onConfirm:()=>{sound('score');action('upgrade',{slot})}
      });
    } else node.disabled=true;
    grid.append(node);
  });
  wrap.append(grid);
  return wrap;
}

function tilePerkText(t){
  return t.type==='wonder'?'Wonderbonus':'Bouwbonus';
}

function upgradeDeltaText(tile){
  return `Verbetert dit gebouw naar niveau ${tile.level+1}.`;
}

function showCivModal(E,root,{eyebrow,title,body,health=null,cost=null,confirmLabel='',confirmDisabled=false,onConfirm=null,secondaryLabel='',onSecondary=null,required=false}){
  root.querySelector('.civ-modal-backdrop')?.remove();
  const backdrop=E('div','civ-modal-backdrop'),modal=E('div','civ-modal'),actions=E('div','civ-detail-actions civ-modal-actions');
  const close=()=>backdrop.remove();
  if(!required)backdrop.onclick=(event)=>{if(event.target===backdrop)close()};
  modal.append(E('div','civ-modal-eyebrow',eyebrow),E('div','civ-detail-name',title),E('div','civ-detail-desc',body));
  if(health!==null){const tower=E('div','civ-modal-tower',`Toren ${health}/100`),track=E('div','civ-hp-track'),fill=E('div','civ-hp-fill');fill.style.width=`${Math.max(0,health)}%`;track.append(fill);tower.append(track);modal.append(tower)}
  if(cost!==null)modal.append(E('div','civ-modal-cost',`Kost ${cost} goud`));
  if(onSecondary){const secondary=E('button','civ-btn civ-btn-ghost civ-modal-secondary',secondaryLabel);secondary.onclick=()=>{close();onSecondary()};actions.append(secondary)}
  if(onConfirm||confirmDisabled){const confirm=E('button','civ-btn civ-btn-primary civ-modal-confirm',confirmLabel);confirm.disabled=confirmDisabled;confirm.onclick=()=>{close();onConfirm()};actions.append(confirm)}
  if(!required){const back=E('button','civ-btn civ-btn-ghost civ-modal-back','Terug');back.onclick=close;actions.append(back)}
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
    if(card.cost>you.gold)node.classList.add('unaffordable');
    node.append(E('div','civ-card-icon',bt.icon),E('div','civ-card-name',card.name),E('div','civ-card-perk',tilePerkText(card)),E('div','civ-card-cost',`Kost ${card.cost}g`));
    node.onclick=()=>showDetail(card);hand.append(node)
  }
  wrap.append(hand);
  return wrap;
}

function renderWave(E,game){
  const wrap=E('div','civ-wave');
  wrap.append(E('div','civ-wave-title',`Tijdperk ${game.waveResult.age} — Aanvalsgolf`),E('div','civ-waiting','Bekijk de schadeberekening en kies Doorgaan.'));
  return wrap;
}

function renderGameOver(E,game,you){
  const wrap=E('div','civ-gameover');wrap.append(E('h2','civ-go-headline',game.resultText));
  const table=E('div','civ-final-table');
  const ranked=[...game.players].sort((a,b)=>(b.hp-a.hp)||(b.gold-a.gold));
  for(const player of ranked){
    const row=E('div',`civ-final-row${game.winnerId===player.id?' winner':''}`),info=E('div');
    info.append(E('div','civ-fname',`${player.isYou?'Jij · ':''}${player.name}${player.leaderName?` · ${player.leaderName}`:''}`),E('div','civ-breakdown',`Goud ${player.gold}`));
    row.append(info,E('div','civ-fscore',`${player.hp}/100`));
    table.append(row);
  }
  wrap.append(table);
  return wrap;
}

function heroPower(key){
  return {
    cleopatra:'Gouden start en gratis aanduidingen.',
    alexander:'Versterkt strijdgebouwen.',
    einstein:'Versterkt het Observatorium.',
    gandhi:'Beperkt inkomende schade.',
    bismarck:'Maakt upgrades goedkoper.',
    lincoln:'Herstelt een zwaar beschadigde toren.',
    achilles:'Sterker offensief, maar kwetsbaarder.',
    harald:'Plundert goud bij een aanval.'
  }[key]||'';
}

function showCombatModal(E,root,game,you,action,sound){
  const result=game.waveResult.results[you.id];
  const attacker=game.players.find((player)=>player.id===result.attackerId);
  showCivModal(E,root,{
    eyebrow:'Schadeberekening',
    title:`${attacker?.name||'Tegenstander'} valt jouw toren aan`,
    body:`ATK ${result.incoming} − DEF ${result.defence} = ${result.damage} schade.`,
    confirmLabel:'Doorgaan',required:true,
    onConfirm:()=>{sound('score');action('continueWave',{})}
  });
}

export function metric({game,player}){const score=Number(game.finalScores?.[player.id]??player.gold??0);return{text:`${score}g`,score};}
export function isWinner({game,myId}){return game.winnerId===myId;}
export function presentResult({game}){return game.resultText;}
