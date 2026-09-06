let els,E,action,titlebar,logBox;
function bind(api){({els,E,action,titlebar,logBox}=api)}

export function render(api){bind(api);renderCycClub(api.room,api.game)}
export const showResult=false;
export const roomOptions={allowRematch:false,bodyClass:'cycclub-active'};
export const playerStrip=true;
export const leaderboardColumns=['#','Speler','Draw','Netto waarde','Zeges','Prijzengeld'];
export function renderLeaderboardCells({row,E:e}){
  return [e('td','',String(row.draws||0)),e('td','',euro(row.netWorth)),e('td','',String(row.victories)),e('td','',euro(row.prizeMoney))];
}
export function profileExtra({stat}){return stat.games?`${stat.wins} zeges`:'—'}
export function metric({player}){return {text:euro(player.wallet), score:player.career.victories}}

const STAT_LABELS={flat:'Vlak',mountain:'Berg',cobbles:'Kasseien',timeTrial:'Tijdrit',sprint:'Sprint',stamina:'Uithouding'};
const STAT_SHORT={flat:'VLK',mountain:'BRG',cobbles:'KSW',timeTrial:'TT',sprint:'SPR',stamina:'UIT'};
const SHOP_LABELS={bikes:'Fietsen & Materiaal',nutrition:'Voeding & Supplementen',trainers:'Trainers & Analyse',medical:'Medische Staf'};
const SHOP_ICONS={bikes:'🚲',nutrition:'🍎',trainers:'📈',medical:'⚕️'};
const CATEGORY_ORDER=['monument','classic','grand_tour'];
const CATEGORY_LABELS={monument:'Monumenten',classic:'Vlaamse Klassiekers',grand_tour:'Grote Rondes'};
const STATUS_LABELS={active:'Fit',injured:'Geblesseerd',sick:'Ziek'};
const SPECIALISM_LABELS={sprinter:'Sprinter',climber:'Klimmer',classics:'Klassieker',allrounder:'Allrounder',puncheur:'Puncheur'};
const EVENT_LABELS={topdag:'Topdag',opportuniteit:'Voorsprong genomen',normaal:'Normale rit',pech:'Pech',valt:'Val'};
const SEGMENT_OUTCOME_LABELS={topdag:'Topdag',opportuniteit:'Voorsprong genomen',normaal:'Normaal segment',pech:'Pech',valt:'Val'};

function euro(n){return `€${Math.round(n||0).toLocaleString('nl-BE')}`}

function panelHeading(title,actionsNode){
  const heading=E('div','panel-heading');
  heading.append(E('h3','',title));
  if(actionsNode)heading.append(actionsNode);
  return heading;
}

function tableCell(label,content){
  const td=E('td','cc-cell');
  td.append(E('span','cc-cell-label',label));
  const value=E('div','cc-cell-value');
  if(content instanceof Node)value.append(content);
  else value.textContent=content;
  td.append(value);
  return td;
}

function summaryItem(label,value){
  const item=E('div','cc-summary-item');
  item.append(E('span','',label),E('strong','',value));
  return item;
}

function labelValue(label,value){
  const item=E('div','cc-lv-item');
  item.append(E('span','',label),E('strong','',value));
  return item;
}

function sellPrice(rider){return rider.sellValue??Math.round(rider.marketValue*0.55/50)*50}
function cancelButtonLabel(game){return game.grandTour?'✕ Stop de ronde':'✕ Annuleer koers'}

let selectedLineup=new Set();
let selectedTactic=null;
let lastRaceKey=null;
let clubTab='roster';
let scoutFilterStat='';
let scoutFilterMinStat='';
let scoutFilterMaxPrice='';

function renderCycClub(room,game){
  const me=game.players.find((player) => player.id===room.meId);
  const status=game.phase==='club'?'In de ploegleiding.'
    :game.phase==='lineup'?`Opstelling voor ${game.race?.raceName||'koers'}.`
    :game.phase==='racing'?`Onderweg in ${game.race?.raceName||'de koers'}.`
    :game.phase==='stageResult'?`Ritresultaat — ${game.grandTour?.tourName||''}.`
    :'Koersresultaat.';
  els.gameStage.append(titlebar('CycClub',status));

  if(!me){els.gameStage.append(E('p','muted','Je bent geen actieve speler in deze club.'));return}

  if(game.phase==='club')renderClub(room,game,me);
  else if(game.phase==='lineup')renderLineup(room,game,me);
  else if(game.phase==='racing')renderRacing(room,game,me);
  else if(game.phase==='stageResult')renderStageResult(room,game,me);
  else if(game.phase==='result')renderResult(room,game,me);

  els.gameStage.append(logBox(game.log));
}

function statLine(stats){
  const row=E('div','cc-stat-row');
  for(const key of Object.keys(STAT_SHORT)){
    const chip=E('span','cc-stat-chip');
    chip.append(E('b','',STAT_SHORT[key]),E('small','',String(stats[key])));
    row.append(chip);
  }
  return row;
}

function riderStatusBadge(rider){
  const badge=E('span',`cc-status cc-status-${rider.status}`,STATUS_LABELS[rider.status]);
  if(rider.status!=='active')badge.append(E('small','',` · nog ${Math.max(0,rider.statusUntil)} koersen`));
  return badge;
}

function renderRosterPanel(me,maxRiders){
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading(`Ploeg (${me.riders.length}/${maxRiders})`));
  if(!me.riders.length){
    panel.append(E('p','muted','Je hebt nog geen renners. Koop je eerste renner in de Scoutingmarkt.'));
    return panel;
  }
  const wrap=E('div','stats-table-wrap');
  const table=E('table','cc-roster-table cc-block-table');
  me.riders.slice().sort((a,b) => b.marketValue-a.marketValue).forEach((rider) => {
    let rest;
    if(rider.status==='active'&&rider.fatigue>0){
      rest=E('button','secondary',`💤 Rust (${euro(600)})`);
      rest.onclick=() => action('restRider',{riderId:rider.id});
    } else rest=E('span','muted','—');
    const sell=E('button','secondary',`💰 ${euro(sellPrice(rider))}`);
    sell.onclick=() => action('sellRider',{riderId:rider.id});

    const row1=E('tr','cc-block-start');
    row1.append(
      tableCell('Naam',rider.name),
      tableCell('Team',rider.team||'—'),
      tableCell('Leeftijd',`${rider.age}j`),
      tableCell('Specialisme',SPECIALISM_LABELS[rider.specialism]||rider.specialism),
      tableCell('Status',riderStatusBadge(rider))
    );
    const row2=E('tr');
    row2.append(
      tableCell('VLK',String(rider.stats.flat)),
      tableCell('BRG',String(rider.stats.mountain)),
      tableCell('KSW',String(rider.stats.cobbles)),
      tableCell('TT',String(rider.stats.timeTrial)),
      tableCell('SPR',String(rider.stats.sprint))
    );
    const row3=E('tr','cc-block-end');
    row3.append(
      tableCell('UIT',String(rider.stats.stamina)),
      tableCell('Kostprijs',euro(rider.marketValue)),
      tableCell('Vermoeidheid',`${rider.fatigue}%`),
      tableCell('Rust',rest),
      tableCell('Verkoop',sell)
    );
    table.append(row1,row2,row3);
  });
  wrap.append(table);
  panel.append(wrap);
  return panel;
}

const SHOP_COSTS=[4000,8500,15000,26000,42000];
const SHOP_MAX_LEVEL=SHOP_COSTS.length;

function renderShopPanel(me){
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading('Shop & Upgrades'));
  const grid=E('div','cc-shop-grid');
  const effects=me.shopEffects||{};
  for(const category of Object.keys(SHOP_LABELS)){
    const level=me.shop[category];
    const box=E('div','cc-shop-item');
    box.append(E('strong','',`${SHOP_ICONS[category]} ${SHOP_LABELS[category]}`));
    const progress=E('div','cc-progress');
    const fill=E('div','cc-progress-fill');
    fill.style.width=`${(level/SHOP_MAX_LEVEL)*100}%`;
    progress.append(fill);
    box.append(progress);
    box.append(E('span','cc-shop-level',`Niveau ${level}/${SHOP_MAX_LEVEL}`));
    box.append(E('p','cc-shop-effect',effects[category]||'Geen bonus'));
    if(level<SHOP_MAX_LEVEL){
      const cost=SHOP_COSTS[level];
      const buy=E('button','primary',`⬆️ Upgrade (${euro(cost)})`);
      buy.disabled=me.wallet<cost;
      buy.onclick=() => action('buyUpgrade',{category});
      box.append(buy);
    } else box.append(E('span','muted','Maximum niveau'));
    grid.append(box);
  }
  panel.append(grid);
  return panel;
}

function renderScoutPanel(room,game,me){
  const panel=E('div','panel cc-panel');
  const refresh=E('button','secondary','↻ Ververs');
  refresh.type='button';
  refresh.onclick=() => action('refreshScoutMarket');
  panel.append(panelHeading(`Scoutingmarkt (${(game.myScoutMarket||[]).length})`,refresh));
  const market=game.myScoutMarket||[];
  if(!market.length){panel.append(E('p','muted','Geen kandidaten beschikbaar.'));return panel}
  const maxRiders=game.maxRiders||10;

  const filterBar=E('div','cc-filter-bar');
  const statSelect=document.createElement('select');
  statSelect.className='cc-filter-select';
  statSelect.append(new Option('Filter op statistiek…',''));
  for(const key of Object.keys(STAT_SHORT))statSelect.append(new Option(STAT_LABELS[key],key));
  statSelect.value=scoutFilterStat;
  const minStatInput=document.createElement('input');
  minStatInput.type='number';
  minStatInput.placeholder='Min. waarde';
  minStatInput.min='1';
  minStatInput.max='99';
  minStatInput.value=scoutFilterMinStat;
  const maxPriceInput=document.createElement('input');
  maxPriceInput.type='number';
  maxPriceInput.placeholder='Max. kostprijs';
  maxPriceInput.min='0';
  maxPriceInput.value=scoutFilterMaxPrice;
  const resetFilter=E('button','secondary','✕ Wis filters');
  resetFilter.type='button';
  filterBar.append(statSelect,minStatInput,maxPriceInput,resetFilter);
  panel.append(filterBar);

  const wrap=E('div','stats-table-wrap');
  const table=E('table','cc-roster-table cc-block-table');
  const blocks=[];
  market.forEach((candidate) => {
    const buy=E('button','primary',`🛒 ${euro(candidate.marketValue)}`);
    buy.disabled=me.wallet<candidate.marketValue||me.riders.length>=maxRiders;
    buy.onclick=() => action('buyRider',{candidateId:candidate.id});

    const row1=E('tr','cc-block-start');
    row1.append(
      tableCell('Naam',candidate.name),
      tableCell('Team',candidate.team||'—'),
      tableCell('Leeftijd',`${candidate.age}j`),
      tableCell('Specialisme',SPECIALISM_LABELS[candidate.specialism]||candidate.specialism)
    );
    const row2=E('tr');
    row2.append(
      tableCell('VLK',String(candidate.stats.flat)),
      tableCell('BRG',String(candidate.stats.mountain)),
      tableCell('KSW',String(candidate.stats.cobbles)),
      tableCell('TT',String(candidate.stats.timeTrial))
    );
    const row3=E('tr','cc-block-end');
    row3.append(
      tableCell('SPR',String(candidate.stats.sprint)),
      tableCell('UIT',String(candidate.stats.stamina)),
      tableCell('Kostprijs',euro(candidate.marketValue)),
      tableCell('Koop',buy)
    );
    table.append(row1,row2,row3);
    blocks.push({candidate,rows:[row1,row2,row3]});
  });
  wrap.append(table);
  panel.append(wrap);

  const emptyMsg=E('p','muted cc-filter-empty','Geen renners voldoen aan deze filters.');
  emptyMsg.hidden=true;
  panel.append(emptyMsg);

  const applyFilter=() => {
    scoutFilterStat=statSelect.value;
    scoutFilterMinStat=minStatInput.value;
    scoutFilterMaxPrice=maxPriceInput.value;
    const minStat=scoutFilterMinStat===''?null:Number(scoutFilterMinStat);
    const maxPrice=scoutFilterMaxPrice===''?null:Number(scoutFilterMaxPrice);
    let visibleCount=0;
    for(const block of blocks){
      let match=true;
      if(scoutFilterStat&&minStat!==null&&block.candidate.stats[scoutFilterStat]<minStat)match=false;
      if(maxPrice!==null&&block.candidate.marketValue>maxPrice)match=false;
      for(const row of block.rows)row.classList.toggle('hidden',!match);
      if(match)visibleCount+=1;
    }
    emptyMsg.hidden=visibleCount>0;
  };
  statSelect.onchange=applyFilter;
  minStatInput.oninput=applyFilter;
  maxPriceInput.oninput=applyFilter;
  resetFilter.onclick=() => {
    statSelect.value='';minStatInput.value='';maxPriceInput.value='';
    applyFilter();
  };
  applyFilter();

  return panel;
}

function renderRaceCatalogPanel(room,game,me){
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading('Koerskalender'));
  if(!room.isHost)panel.append(E('p','muted','Alleen de host kan een koers starten.'));
  const groups=new Map();
  for(const race of game.raceCatalog){
    if(!groups.has(race.category))groups.set(race.category,[]);
    groups.get(race.category).push(race);
  }
  for(const category of CATEGORY_ORDER){
    const races=groups.get(category);
    if(!races||!races.length)continue;
    panel.append(E('h4','cc-category-title',CATEGORY_LABELS[category]||category));
    const grid=E('div','cc-race-grid');
    races.forEach((race) => {
      const card=E('div','cc-race-card');
      if(race.category==='grand_tour'){
        card.append(E('strong','',race.name),E('span','muted',`${race.stages} ritten · ${euro(race.overallPrize)} eindklassement`));
      } else {
        card.append(E('strong','',race.name),E('span','muted',euro(race.basePrize)));
        if(race.difficulty)card.append(E('small','muted',`Moeilijkheidsgraad ${race.difficulty}/10`));
      }
      const terrain=Object.entries(race.terrain).sort((a,b) => b[1]-a[1]).map(([key]) => STAT_LABELS[key]).slice(0,2).join(' · ');
      card.append(E('small','',terrain));
      if(room.isHost){
        const start=E('button','primary','🏁 Start koers');
        start.onclick=() => action('selectRace',{raceId:race.id});
        card.append(start);
      }
      grid.append(card);
    });
    panel.append(grid);
  }
  return panel;
}

function terrainKeyLabel(terrainKey){return terrainKey===null?'Universeel':STAT_LABELS[terrainKey]||terrainKey}

function renderTacticsPanel(room,game,me){
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading(`Tactieken (${me.tacticCards.length}/${(game.tacticCatalog||[]).length})`));
  panel.append(E('p','muted','Koop tactiekkaarten om ze permanent in bezit te hebben. Voor elke rit krijg je een keuze uit maximaal drie kaarten uit je bezit om eenmalig in te zetten.'));
  const grid=E('div','cc-tactic-grid');
  (game.tacticCatalog||[]).forEach((card) => {
    const owned=me.tacticCards.includes(card.id);
    const box=E('div',`cc-tactic-card${owned?' cc-tactic-owned':''}`);
    box.append(E('strong','',card.name));
    box.append(E('p','cc-tactic-desc',card.description));
    box.append(E('span','cc-tactic-terrain',terrainKeyLabel(card.terrainKey)));
    box.append(E('span','cc-tactic-mult',`×${card.multiplier}`));
    if(owned){
      box.append(E('span','cc-tactic-owned-badge','✔ In bezit'));
    } else {
      const buy=E('button','primary',`🛒 ${euro(card.cost)}`);
      buy.disabled=me.wallet<card.cost;
      buy.onclick=() => action('buyTacticCard',{cardId:card.id});
      box.append(buy);
    }
    grid.append(box);
  });
  panel.append(grid);
  return panel;
}

function renderShopStatusBar(me,onOpen){
  const bar=E('div','cc-shop-status-bar');
  for(const category of Object.keys(SHOP_LABELS)){
    const level=me.shop[category];
    const btn=E('button','cc-shop-status-btn');
    btn.type='button';
    btn.append(E('span','cc-shop-status-label',`${SHOP_ICONS[category]} ${SHOP_LABELS[category]}`));
    const dots=E('span','cc-shop-status-dots');
    for(let i=0;i<5;i+=1)dots.append(E('i',i<level?'cc-mini-dot filled':'cc-mini-dot'));
    btn.append(dots);
    btn.onclick=onOpen;
    bar.append(btn);
  }
  return bar;
}

function tabBackButton(){
  const back=E('button','secondary cc-tab-back','← Terug naar ploeg');
  back.type='button';
  return back;
}

function renderClub(room,game,me){
  const summary=E('div','cc-summary');
  summary.append(summaryItem('Budget',euro(me.wallet)));
  summary.append(summaryItem('Zeges',String(me.career.victories)));
  summary.append(summaryItem('Podiums',String(me.career.podiums)));
  summary.append(summaryItem('Monumenten',String(me.career.monumentsWon)));
  summary.append(summaryItem('Grote Rondes',String(me.career.grandToursWon)));
  summary.append(summaryItem('Grote Ritten',String(me.career.gtStagesWon)));
  summary.append(summaryItem('Totaal prijzengeld',euro(me.career.prizeMoney)));
  els.gameStage.append(summary);

  const rosterSection=E('div','cc-tab-section');
  rosterSection.append(renderRosterPanel(me,game.maxRiders||10));

  const scoutSection=E('div','cc-tab-section');
  const scoutBack=tabBackButton();
  scoutSection.append(scoutBack,renderScoutPanel(room,game,me));

  const shopSection=E('div','cc-tab-section');
  const shopBack=tabBackButton();
  shopSection.append(shopBack,renderShopPanel(me));

  const racesSection=E('div','cc-tab-section');
  const racesBack=tabBackButton();
  racesSection.append(racesBack,renderRaceCatalogPanel(room,game,me));

  const tacticsSection=E('div','cc-tab-section');
  const tacticsBack=tabBackButton();
  tacticsSection.append(tacticsBack,renderTacticsPanel(room,game,me));

  const sections={roster:rosterSection,scout:scoutSection,shop:shopSection,races:racesSection,tactics:tacticsSection};
  const applyTab=(tab) => {
    clubTab=tab;
    for(const key of Object.keys(sections))sections[key].classList.toggle('hidden',key!==tab);
  };
  scoutBack.onclick=() => applyTab('roster');
  shopBack.onclick=() => applyTab('roster');
  racesBack.onclick=() => applyTab('roster');
  tacticsBack.onclick=() => applyTab('roster');

  const topBar=E('div','cc-top-tabs');
  topBar.append(renderShopStatusBar(me,() => applyTab('shop')));
  const scoutOpenBtn=E('button','cc-tab-open-btn',`🔍 Scoutingmarkt (${(game.myScoutMarket||[]).length})`);
  scoutOpenBtn.type='button';
  scoutOpenBtn.onclick=() => applyTab('scout');
  topBar.append(scoutOpenBtn);
  const tacticsOpenBtn=E('button','cc-tab-open-btn',`🎯 Tactieken (${me.tacticCards.length})`);
  tacticsOpenBtn.type='button';
  tacticsOpenBtn.onclick=() => applyTab('tactics');
  topBar.append(tacticsOpenBtn);
  const racesOpenBtn=E('button','cc-tab-open-btn',`📅 Koerskalender (${game.raceCatalog.length})`);
  racesOpenBtn.type='button';
  racesOpenBtn.onclick=() => applyTab('races');
  topBar.append(racesOpenBtn);

  const resetBtn=E('button','cc-danger-btn','♻️ Opnieuw beginnen');
  resetBtn.type='button';
  resetBtn.onclick=() => {
    if(confirm('Weet je zeker dat je opnieuw wilt beginnen? Je budget, renners, upgrades en carrièrestats worden definitief gewist.')){
      clubTab='roster';
      action('resetTeam');
    }
  };
  topBar.append(resetBtn);
  els.gameStage.append(topBar);

  els.gameStage.append(rosterSection,scoutSection,shopSection,racesSection,tacticsSection);
  applyTab(clubTab);
}

function renderLineup(room,game,me){
  const race=game.race;
  if(lastRaceKey!==race.raceId){
    selectedLineup=new Set(race.myLineup||[]);
    selectedTactic=race.myTacticChoice?.id||null;
    lastRaceKey=race.raceId;
  }
  const catalogRace=game.raceCatalog.find((candidate) => candidate.id===race.raceId);
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading(race.raceName));
  if(catalogRace){
    const terrain=Object.entries(catalogRace.terrain).sort((a,b) => b[1]-a[1]).map(([key,weight]) => `${STAT_LABELS[key]} ${Math.round(weight*100)}%`).join(' · ');
    panel.append(E('p','muted',terrain));
  }

  const available=me.riders.filter((rider) => rider.status==='active');
  const submitted=(race.readyIds||[]).includes(me.id);
  if(!available.length){
    panel.append(E('p','muted','Geen beschikbare renners.'));
  } else {
    const grid=E('div','cc-rider-grid');
    available.forEach((rider) => {
      const card=E('label','cc-rider-card cc-selectable');
      const checkbox=document.createElement('input');
      checkbox.type='checkbox';
      checkbox.checked=selectedLineup.has(rider.id);
      checkbox.disabled=submitted;
      checkbox.onchange=() => {
        if(checkbox.checked){
          if(selectedLineup.size>=game.squadSize){checkbox.checked=false;return}
          selectedLineup.add(rider.id);
        } else selectedLineup.delete(rider.id);
      };
      card.append(checkbox);
      const head=E('div','cc-rider-head');
      head.append(E('strong','',rider.name),E('span','muted',`${rider.age}j · ${rider.specialism}`));
      card.append(head);
      card.append(statLine(rider.stats));
      card.append(labelValue('Vermoeidheid',`${rider.fatigue}%`));
      grid.append(card);
    });
    panel.append(grid);
  }

  const offeredTactics=race.myTacticOffers||[];
  if(offeredTactics.length||race.myTacticChoice){
    panel.append(E('h4','cc-category-title','Tactiek voor deze rit'));
    if(submitted){
      const chosen=race.myTacticChoice;
      panel.append(E('p','muted',chosen?`Ingezet: ${chosen.name} (×${chosen.multiplier}, ${chosen.matches?'actief':'geen effect deze rit'})`:'Geen tactiek ingezet.'));
    } else {
      const tacticGrid=E('div','cc-tactic-grid');
      const noneCard=E('label','cc-tactic-card cc-tactic-selectable');
      const noneRadio=document.createElement('input');
      noneRadio.type='radio';
      noneRadio.name='cc-tactic-choice';
      noneRadio.checked=!selectedTactic;
      noneRadio.onchange=() => {selectedTactic=null};
      noneCard.append(noneRadio,E('strong','','Geen tactiek'));
      tacticGrid.append(noneCard);
      offeredTactics.forEach((card) => {
        const box=E('label',`cc-tactic-card cc-tactic-selectable${card.matches?' cc-tactic-matches':''}`);
        const radio=document.createElement('input');
        radio.type='radio';
        radio.name='cc-tactic-choice';
        radio.checked=selectedTactic===card.id;
        radio.onchange=() => {selectedTactic=card.id};
        box.append(radio,E('strong','',card.name));
        box.append(E('p','cc-tactic-desc',card.description));
        box.append(E('span','cc-tactic-terrain',terrainKeyLabel(card.terrainKey)));
        box.append(E('span','cc-tactic-mult',`×${card.multiplier}`));
        box.append(E('span','cc-tactic-match-tag',card.matches?'Past bij deze rit':'Geen effect hier'));
        tacticGrid.append(box);
      });
      panel.append(tacticGrid);
    }
  }

  const actionsRow=E('div','cc-rider-actions');
  if(!submitted){
    const submit=E('button','primary',`✅ Opstelling bevestigen (max ${game.squadSize})`);
    submit.onclick=() => {action('submitLineup',{riderIds:[...selectedLineup],tacticCardId:selectedTactic||undefined});};
    actionsRow.append(submit);
  } else actionsRow.append(E('span','muted','Wachten op de rest van het peloton…'));
  if(room.isHost){
    const cancel=E('button','secondary',cancelButtonLabel(game));
    cancel.onclick=() => action('cancelRace');
    actionsRow.append(cancel);
  }
  panel.append(actionsRow);

  const readyList=E('div','cc-ready-list');
  game.players.forEach((player) => {
    const ready=(race.readyIds||[]).includes(player.id);
    readyList.append(E('span',`cc-ready-chip ${ready?'ready':''}`,`${player.name}${player.isNpc?' · NPC':''}`));
  });
  panel.append(readyList);

  els.gameStage.append(panel);
}

const SEGMENTS_PER_RACE=8;
const SVG_NS='http://www.w3.org/2000/svg';

function SVGEl(tag,attrs){
  const el=document.createElementNS(SVG_NS,tag);
  if(attrs)for(const key of Object.keys(attrs))el.setAttribute(key,attrs[key]);
  return el;
}

function hashString(str){
  let h=2166136261;
  for(let i=0;i<str.length;i+=1){h=(h^str.charCodeAt(i))>>>0;h=Math.imul(h,16777619)>>>0}
  return h>>>0;
}

function seededRandom(seed){
  let s=seed>>>0;
  return function(){
    s=(s+0x6D2B79F5)|0;
    let t=Math.imul(s^(s>>>15),1|s);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

function clampNum(v,min,max){return Math.max(min,Math.min(max,v))}

function bikeIcon(cx,cy,cls){
  const g=SVGEl('g',{class:cls,transform:`translate(${cx},${cy})`,fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round'});
  g.append(SVGEl('circle',{cx:-6,cy:4,r:4}));
  g.append(SVGEl('circle',{cx:6,cy:4,r:4}));
  g.append(SVGEl('path',{d:'M-6,4 L-4,-5 L0,4 L6,4 M0,4 L4,-5 M-6,-5 L-2,-5 M4,-5 L6,-6'}));
  return g;
}

const PROFILE_RESOLUTION=90;
const PROFILE_ALT_MIN=150,PROFILE_ALT_MAX=1900;
const TERRAIN_DISTANCE_KM={flat:195,sprint:180,hilly:175,cobbles:230,mountain:155,timeTrial:38,stamina:190};
const GRADIENT_BANDS=[
  {max:0,color:'#f8e2b8'},
  {max:3,color:'#f3c274'},
  {max:6,color:'#ee9b48'},
  {max:9,color:'#e0652f'},
  {max:12,color:'#c62f28'},
  {max:Infinity,color:'#7a1620'}
];

function altitudeM(h){return Math.round(PROFILE_ALT_MIN+(h/100)*(PROFILE_ALT_MAX-PROFILE_ALT_MIN))}
function gradientColor(slopePct){return (GRADIENT_BANDS.find((band) => slopePct<=band.max)||GRADIENT_BANDS.at(-1)).color}
function dominantTerrainKeyClient(terrain){return Object.entries(terrain||{}).sort((a,b) => b[1]-a[1])[0]?.[0]||'flat'}

function buildProfilePoints(raceId,terrain){
  const rng=seededRandom(hashString(raceId||''));
  const ruggedness=(terrain?.mountain||0)+(terrain?.cobbles||0)*0.6+0.15;
  const shapePoints=[35+rng()*15];
  for(let i=1;i<=SEGMENTS_PER_RACE;i+=1){
    const delta=(rng()-0.45)*80*ruggedness;
    shapePoints.push(clampNum(shapePoints[i-1]+delta,6,94));
  }
  const points=[];
  for(let i=0;i<PROFILE_RESOLUTION;i+=1){
    const t=(i/(PROFILE_RESOLUTION-1))*SEGMENTS_PER_RACE;
    const seg=Math.min(Math.floor(t),SEGMENTS_PER_RACE-1);
    const localT=t-seg;
    const base=shapePoints[seg]+(shapePoints[seg+1]-shapePoints[seg])*localT;
    const jitter=(rng()-0.5)*9*ruggedness;
    points.push(clampNum(base+jitter,4,97));
  }
  return {shapePoints,points};
}

function detectClimbs(points,maxClimbs=2){
  const candidates=[];
  for(let i=2;i<points.length-2;i+=1){
    if(points[i]>=points[i-1]&&points[i]>=points[i+1]&&points[i]>points[i-2]&&points[i]>points[i+2]&&points[i]>=55){
      candidates.push({index:i,height:points[i]});
    }
  }
  const selected=[];
  for(const climb of candidates.sort((a,b) => b.height-a.height)){
    if(selected.length>=maxClimbs)break;
    if(selected.some((s) => Math.abs(s.index-climb.index)<points.length*0.15))continue;
    selected.push(climb);
  }
  return selected.sort((a,b) => a.index-b.index);
}

function buildProfileChart(race){
  const width=680,height=200;
  const marginLeft=38,marginRight=10,marginTop=34,marginBottom=22;
  const plotWidth=width-marginLeft-marginRight,plotHeight=height-marginTop-marginBottom;
  const {shapePoints,points}=buildProfilePoints(race.raceId,race.terrain);
  const segs=shapePoints.length-1;
  const totalKm=TERRAIN_DISTANCE_KM[dominantTerrainKeyClient(race.terrain)]||180;
  const kmPerStep=totalKm/(points.length-1);

  const toX=(fraction) => marginLeft+fraction*plotWidth;
  const toY=(h) => marginTop+plotHeight-(h/100)*plotHeight;
  const xyAt=(index) => [toX(index/(points.length-1)),toY(points[index])];

  const wrap=E('div','cc-profile-chart');
  const svg=SVGEl('svg',{viewBox:`0 0 ${width} ${height}`,preserveAspectRatio:'none',class:'cc-profile-svg'});

  const baseline=marginTop+plotHeight;
  const smoothWindow=6;
  const smoothed=points.map((_,i) => {
    const from=Math.max(0,i-smoothWindow),to=Math.min(points.length-1,i+smoothWindow);
    let sum=0;for(let j=from;j<=to;j+=1)sum+=points[j];
    return sum/(to-from+1);
  });
  for(let i=0;i<points.length-1;i+=1){
    const [x1,y1]=xyAt(i),[x2,y2]=xyAt(i+1);
    const deltaAltM=altitudeM(smoothed[i+1])-altitudeM(smoothed[i]);
    const slopePct=(deltaAltM/(kmPerStep*1000))*100;
    const quad=SVGEl('polygon',{points:`${x1},${baseline} ${x1},${y1} ${x2},${y2} ${x2},${baseline}`,fill:gradientColor(slopePct),stroke:'none'});
    svg.append(quad);
  }
  const linePath=points.map((h,i) => {const [x,y]=xyAt(i);return `${i===0?'M':'L'}${x},${y}`}).join(' ');
  svg.append(SVGEl('path',{d:linePath,class:'cc-profile-line'}));

  const axis=SVGEl('g',{class:'cc-profile-axis'});
  [0,0.33,0.66,1].forEach((fraction) => {
    const y=marginTop+plotHeight-fraction*plotHeight;
    axis.append(SVGEl('line',{x1:marginLeft,x2:width-marginRight,y1:y,y2:y,class:'cc-profile-grid'}));
    const label=SVGEl('text',{x:marginLeft-6,y:y+3,class:'cc-profile-axis-label','text-anchor':'end'});
    label.textContent=`${altitudeM(fraction*100)}m`;
    axis.append(label);
  });
  shapePoints.forEach((_,i) => {
    const x=toX(i/segs);
    const label=SVGEl('text',{x,y:height-4,class:'cc-profile-axis-label','text-anchor':'middle'});
    label.textContent=`${Math.round((i/segs)*totalKm*10)/10}`;
    axis.append(label);
  });
  svg.append(axis);

  const startFlag=SVGEl('g',{class:'cc-profile-flag cc-profile-flag-start',transform:`translate(${toX(0)},${baseline})`});
  startFlag.append(SVGEl('circle',{r:8}),SVGEl('text',{y:3,'text-anchor':'middle'}));
  startFlag.lastChild.textContent='S';
  svg.append(startFlag);
  const [finishX,finishY]=xyAt(points.length-1);
  const finishFlag=SVGEl('g',{class:'cc-profile-flag cc-profile-flag-finish',transform:`translate(${finishX},${Math.max(marginTop+8,finishY-14)})`});
  finishFlag.append(SVGEl('circle',{r:8}),SVGEl('text',{y:3,'text-anchor':'middle'}));
  finishFlag.lastChild.textContent='M';
  svg.append(finishFlag);

  detectClimbs(points).forEach((climb,order) => {
    const [x,y]=xyAt(climb.index);
    const category=climb.height>=80?{label:'1',cls:'cc-profile-cat-1'}:{label:'2',cls:'cc-profile-cat-2'};
    const guide=SVGEl('line',{x1:x,x2:x,y1:marginTop+10,y2:y,class:'cc-profile-guide'});
    svg.append(guide);
    const marker=SVGEl('g',{class:`cc-profile-climb-marker ${category.cls}`,transform:`translate(${x},${marginTop-2})`});
    marker.append(SVGEl('circle',{r:7}),SVGEl('text',{y:3,'text-anchor':'middle'}));
    marker.lastChild.textContent=category.label;
    svg.append(marker);
    const label=SVGEl('text',{x,y:marginTop-12,class:'cc-profile-climb-label','text-anchor':order%2?'end':'start'});
    label.textContent=`${altitudeM(climb.height)} m`;
    svg.append(label);
  });

  const progressList=race.allProgress||[];
  const currentFraction=Math.min((race.segmentIndex||0)/segs,1);
  const baseX=toX(currentFraction);
  const currentPointIndex=Math.min(Math.round(currentFraction*(points.length-1)),points.length-1);
  const baseY=toY(points[currentPointIndex]);
  progressList.forEach((entry,index) => {
    const offset=(index-(progressList.length-1)/2)*18;
    const waiting=entry.awaitingConfirmation;
    const cls=`cc-profile-rider cc-profile-rider-${index%6}${waiting?'':' cc-profile-rider-confirmed'}`;
    const bike=bikeIcon(baseX+offset,Math.max(marginTop+10,baseY-10),cls);
    const title=SVGEl('title');
    title.textContent=`${entry.playerName}${entry.isNpc?' (NPC)':''} — segment ${race.segmentIndex||0}/${segs} · ${waiting?'moet nog rollen':'bevestigd'}`;
    bike.append(title);
    svg.append(bike);
  });

  wrap.append(svg);

  const legend=E('div','cc-profile-legend');
  progressList.forEach((entry,index) => {
    const item=E('span',`cc-profile-legend-item cc-profile-rider-${index%6}`);
    item.append(E('i',''),document.createTextNode(`${entry.playerName}${entry.awaitingConfirmation?'':' ✓'}`));
    legend.append(item);
  });
  wrap.append(legend);
  return wrap;
}

function renderRacing(room,game,me){
  const race=game.race;
  if(!race){els.gameStage.append(E('p','muted','Geen actieve rit.'));return}
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading(race.raceName));

  panel.append(buildProfileChart(race));

  const myProgress=race.myProgress;
  const statusRow=E('div','cc-lv-row');
  statusRow.append(labelValue('Segment',`${Math.min((race.segmentIndex||0)+1,SEGMENTS_PER_RACE)} / ${SEGMENTS_PER_RACE}`));
  if(myProgress){
    statusRow.append(labelValue('Multiplier',`×${myProgress.multiplier.toFixed(3)}`));
    if(myProgress.bankStreak>0)statusRow.append(labelValue('Opgespaard',`${myProgress.bankStreak}×`));
  }
  if(race.myTacticChoice){
    statusRow.append(labelValue('Tactiek',`${race.myTacticChoice.name}${race.myTacticChoice.matches?` (×${race.myTacticChoice.multiplier})`:' (geen effect)'}`));
  }
  panel.append(statusRow);

  if(!myProgress){
    panel.append(E('p','muted','Je hebt geen renners in deze rit.'));
  } else if(!myProgress.awaitingConfirmation){
    panel.append(E('p','muted','Bevestigd. Wachten tot de rest van het peloton dit segment heeft gereden…'));
  } else {
    const actionsRow=E('div','cc-rider-actions');
    if(!myProgress.pendingRoll){
      const rollBtn=E('button','primary','🎲 Rol de dobbelsteen');
      rollBtn.onclick=() => action('rollSegment');
      actionsRow.append(rollBtn);
    } else {
      actionsRow.append(E('span','cc-roll-result',`Worp: ${myProgress.pendingRoll.roll}`));
      const applyBtn=E('button','primary',`✅ Toepassen (×${myProgress.multiplier.toFixed(3)})`);
      applyBtn.onclick=() => action('resolveSegment',{apply:true});
      const bankBtn=E('button','secondary','🏦 Opsparen (+12,5%)');
      bankBtn.onclick=() => action('resolveSegment',{apply:false});
      actionsRow.append(applyBtn,bankBtn);
    }
    panel.append(actionsRow);
  }

  if(myProgress?.riders){
    const grid=E('div','cc-rider-grid');
    Object.values(myProgress.riders).forEach((riderState) => {
      const card=E('div','cc-rider-card');
      const head=E('div','cc-rider-head');
      head.append(E('strong','',riderState.name),E('span','muted',riderState.dnf?'Uitgevallen':`${riderState.pr} pt`));
      card.append(head);
      card.append(segmentDots(riderState.segments));
      grid.append(card);
    });
    panel.append(grid);
  }

  const readyList=E('div','cc-ready-list');
  (race.allProgress||[]).forEach((entry) => {
    readyList.append(E('span',`cc-ready-chip ${entry.awaitingConfirmation?'':'ready'}`,`${entry.playerName}${entry.isNpc?' · NPC':''} · ${entry.awaitingConfirmation?'aan het rollen':'bevestigd'}`));
  });
  panel.append(readyList);

  if(room.isHost){
    const actionsRow2=E('div','cc-rider-actions');
    const cancel=E('button','secondary',cancelButtonLabel(game));
    cancel.onclick=() => action('cancelRace');
    actionsRow2.append(cancel);
    panel.append(actionsRow2);
  }

  els.gameStage.append(panel);
}

function segmentDots(segments){
  const row=E('div','cc-segment-dots');
  (segments||[]).forEach((segment) => {
    const dot=E('span',`cc-segment-dot cc-segment-${segment.outcome}`);
    dot.title=`Segment ${segment.n}: worp ${segment.roll} (totaal ${segment.total}) — ${SEGMENT_OUTCOME_LABELS[segment.outcome]||segment.outcome}`;
    row.append(dot);
  });
  return row;
}

function renderClassificationPanel(panel,result){
  const table=E('table','stats-table');
  const head=E('tr');
  ['#','Renner','Speler','Segmenten','Gebeurtenis','Prijs'].forEach((label) => head.append(E('th','',label)));
  table.append(head);
  result.classification.slice(0,10).forEach((entry) => {
    const tr=E('tr');
    const segmentsTd=E('td','');
    segmentsTd.append(segmentDots(entry.segments));
    tr.append(E('td','',String(entry.place)),E('td','',entry.riderName),E('td','',entry.playerName),segmentsTd,E('td','',EVENT_LABELS[entry.event]||entry.event),E('td','',euro(entry.prize)));
    table.append(tr);
  });
  const wrap=E('div','stats-table-wrap');
  wrap.append(table);
  panel.append(wrap);

  if(result.dnfs.length){
    panel.append(E('h4','cc-category-title','Uitgevallen'));
    const dnfList=E('div','cc-rider-grid');
    result.dnfs.forEach((entry) => {
      const card=E('div','cc-rider-card');
      const head2=E('div','cc-rider-head');
      head2.append(E('strong','',entry.riderName),E('span','muted',`${entry.playerName} · ${EVENT_LABELS[entry.event]||entry.event}`));
      card.append(head2);
      card.append(segmentDots(entry.segments));
      dnfList.append(card);
    });
    panel.append(dnfList);
  }
}

function backToClubButton(){
  const actionsRow=E('div','cc-rider-actions');
  const back=E('button','primary','← Terug naar club');
  back.onclick=() => action('backToClub');
  actionsRow.append(back);
  return actionsRow;
}

function renderResult(room,game,me){
  const result=game.lastResult;
  if(!result){els.gameStage.append(E('p','muted','Geen resultaat beschikbaar.'));return}
  if(result.type==='grand_tour_final')renderGrandTourFinalResult(room,game,result);
  else renderOneDayResult(result);
}

function renderOneDayResult(result){
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading(result.raceName));
  renderClassificationPanel(panel,result);
  panel.append(backToClubButton());
  els.gameStage.append(panel);
}

function renderStageResult(room,game,me){
  const result=game.lastResult;
  if(!result){els.gameStage.append(E('p','muted','Geen ritresultaat beschikbaar.'));return}
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading(`${result.raceName} · Rit ${result.stageNumber}/${result.totalStages}`));
  renderClassificationPanel(panel,result);

  const standings=game.grandTour?.standings||[];
  if(standings.length){
    panel.append(E('h4','cc-category-title','Tussenstand eindklassement'));
    const gcTable=E('table','stats-table');
    const gcHead=E('tr');
    ['#','Renner','Speler','Ritzeges'].forEach((label) => gcHead.append(E('th','',label)));
    gcTable.append(gcHead);
    standings.forEach((entry) => {
      const tr=E('tr');
      tr.append(E('td','',String(entry.place)),E('td','',entry.riderName),E('td','',entry.playerName),E('td','',String(entry.stageWins)));
      gcTable.append(tr);
    });
    const gcWrap=E('div','stats-table-wrap');
    gcWrap.append(gcTable);
    panel.append(gcWrap);
  }

  const actionsRow=E('div','cc-rider-actions');
  if(room.isHost){
    const next=E('button','primary',`➡️ Volgende rit (${result.stageNumber+1}/${result.totalStages})`);
    next.onclick=() => action('nextStage');
    actionsRow.append(next);
    const cancel=E('button','secondary',cancelButtonLabel(game));
    cancel.onclick=() => action('cancelRace');
    actionsRow.append(cancel);
  } else actionsRow.append(E('span','muted','Wachten tot de host de volgende rit start…'));
  panel.append(actionsRow);

  els.gameStage.append(panel);
}

function renderGrandTourFinalResult(room,game,result){
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading(`${result.raceName} · Eindklassement`));

  const gcTable=E('table','stats-table');
  const gcHead=E('tr');
  ['#','Renner','Speler','Ritzeges'].forEach((label) => gcHead.append(E('th','',label)));
  gcTable.append(gcHead);
  result.gc.forEach((entry) => {
    const tr=E('tr');
    tr.append(E('td','',String(entry.place)),E('td','',entry.riderName),E('td','',entry.playerName),E('td','',String(entry.stageWins)));
    gcTable.append(tr);
  });
  const gcWrap=E('div','stats-table-wrap');
  gcWrap.append(gcTable);
  panel.append(gcWrap);

  if(result.payouts?.some((entry) => entry.gcPrize>0)){
    panel.append(E('h4','cc-category-title','Eindklassementsprijzengeld'));
    const list=E('div','cc-ready-list');
    const nameById=new Map(game.players.map((player) => [player.id,player.name]));
    result.payouts.filter((entry) => entry.gcPrize>0).forEach((entry) => {
      list.append(E('span','cc-ready-chip',`${nameById.get(entry.playerId)||'Onbekend'} · ${euro(entry.gcPrize)}`));
    });
    panel.append(list);
  }

  panel.append(E('h4','cc-category-title','Ritverloop'));
  const stageList=E('div','cc-stage-list');
  result.stages.forEach((stage) => {
    const row=E('div','cc-stage-row');
    row.append(E('span','cc-stage-number',`Rit ${stage.stageNumber}`));
    row.append(E('span','muted',stage.typeLabel));
    row.append(E('span','',stage.winner?`${stage.winner.riderName} (${stage.winner.playerName})`:'Geen winnaar'));
    if(stage.dnfCount)row.append(E('small','',`${stage.dnfCount} opgave(n)`));
    stageList.append(row);
  });
  panel.append(stageList);

  panel.append(backToClubButton());
  els.gameStage.append(panel);
}
