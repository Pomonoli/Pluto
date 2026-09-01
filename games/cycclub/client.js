let els,E,action,titlebar,logBox;
function bind(api){({els,E,action,titlebar,logBox}=api)}

export function render(api){bind(api);renderCycClub(api.room,api.game)}
export const showResult=false;
export const roomOptions={allowRematch:false};
export const playerStrip=true;
export const leaderboardColumns=['#','Speler','Netto waarde','Zeges','Prijzengeld'];
export function renderLeaderboardCells({row,E:e}){
  return [e('td','',euro(row.netWorth)),e('td','',String(row.victories)),e('td','',euro(row.prizeMoney))];
}
export function profileExtra({stat}){return stat.games?`${stat.wins} zeges`:'—'}
export function metric({player}){return {text:euro(player.wallet), score:player.career.victories}}

const STAT_LABELS={flat:'Vlak',mountain:'Berg',cobbles:'Kasseien',timeTrial:'Tijdrit',sprint:'Sprint',stamina:'Uithouding'};
const STAT_SHORT={flat:'VLK',mountain:'BRG',cobbles:'KSW',timeTrial:'TT',sprint:'SPR',stamina:'UIT'};
const SHOP_LABELS={bikes:'Fietsen & Materiaal',nutrition:'Voeding & Supplementen',trainers:'Trainers & Analyse',medical:'Medische Staf'};
const CATEGORY_LABELS={monument:'Monumenten',classic:'Vlaamse Klassiekers',championship:'Kampioenschappen',stage_race:'Rittenkoersen',gt_stage:'Grote Rondrit-ritten'};
const STATUS_LABELS={active:'Fit',injured:'Geblesseerd',sick:'Ziek'};
const EVENT_LABELS={super:'Topdag',normal:'Normale dag',bad:'Offday',mechanical:'Mechanisch defect',illness:'Ziekte',crash:'Val'};

function euro(n){return `€${Math.round(n||0).toLocaleString('nl-BE')}`}

function panelHeading(title){
  const heading=E('div','panel-heading');
  heading.append(E('h3','',title));
  return heading;
}

function summaryItem(label,value){
  const item=E('div','cc-summary-item');
  item.append(E('span','',label),E('strong','',value));
  return item;
}

let selectedLineup=new Set();
let lastRaceKey=null;

function renderCycClub(room,game){
  const me=game.players.find((player) => player.id===room.meId);
  const status=game.phase==='club'?'In de ploegleiding.':game.phase==='lineup'?`Opstelling voor ${game.race?.raceName||'koers'}.`:'Koersresultaat.';
  els.gameStage.append(titlebar('CycClub',status));

  if(!me){els.gameStage.append(E('p','muted','Je bent geen actieve speler in deze club.'));return}

  if(game.phase==='club')renderClub(room,game,me);
  else if(game.phase==='lineup')renderLineup(room,game,me);
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

function renderRosterPanel(me){
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading('Ploeg'));
  const list=E('div','cc-rider-list');
  me.riders.slice().sort((a,b) => b.marketValue-a.marketValue).forEach((rider) => {
    const row=E('div','cc-rider-row');
    const head=E('div','cc-rider-head');
    head.append(E('strong','',rider.name),E('span','muted',`${rider.age}j · ${rider.specialism}`));
    row.append(head);
    row.append(statLine(rider.stats));
    const meta=E('div','cc-rider-meta');
    meta.append(riderStatusBadge(rider),E('span','',euro(rider.marketValue)),E('span','',`Vermoeidheid ${rider.fatigue}%`));
    row.append(meta);
    const actions=E('div','cc-rider-actions');
    if(rider.status==='active'&&rider.fatigue>0){
      const rest=E('button','secondary',`Rust (${euro(600)})`);
      rest.onclick=() => action('restRider',{riderId:rider.id});
      actions.append(rest);
    }
    const sell=E('button','secondary',`Verkoop (${euro(Math.round(rider.marketValue*0.55/50)*50)})`);
    sell.onclick=() => action('sellRider',{riderId:rider.id});
    actions.append(sell);
    row.append(actions);
    list.append(row);
  });
  panel.append(list);
  return panel;
}

function renderShopPanel(me){
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading('Shop & Upgrades'));
  const grid=E('div','cc-shop-grid');
  for(const category of Object.keys(SHOP_LABELS)){
    const level=me.shop[category];
    const box=E('div','cc-shop-item');
    box.append(E('strong','',SHOP_LABELS[category]));
    const bar=E('div','cc-level-dots');
    for(let i=0;i<5;i+=1)bar.append(E('span',i<level?'cc-dot filled':'cc-dot'));
    box.append(bar);
    if(level<5){
      const cost=[4000,8500,15000,26000,42000][level];
      const buy=E('button','primary',`Upgrade (${euro(cost)})`);
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
  panel.append(panelHeading('Scoutingmarkt'));
  const market=game.myScoutMarket||[];
  if(!market.length){panel.append(E('p','muted','Geen kandidaten beschikbaar.'));return panel}
  const list=E('div','cc-rider-list');
  market.forEach((candidate) => {
    const row=E('div','cc-rider-row');
    const head=E('div','cc-rider-head');
    head.append(E('strong','',candidate.name),E('span','muted',`${candidate.age}j · ${candidate.specialism}`));
    row.append(head);
    row.append(statLine(candidate.stats));
    const actions=E('div','cc-rider-actions');
    const buy=E('button','primary',`Koop (${euro(candidate.marketValue)})`);
    buy.disabled=me.wallet<candidate.marketValue||me.riders.length>=14;
    buy.onclick=() => action('buyRider',{candidateId:candidate.id});
    actions.append(buy);
    row.append(actions);
    list.append(row);
  });
  panel.append(list);
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
  for(const [category,races] of groups){
    panel.append(E('h4','cc-category-title',CATEGORY_LABELS[category]||category));
    const grid=E('div','cc-race-grid');
    races.forEach((race) => {
      const card=E('div','cc-race-card');
      card.append(E('strong','',race.name),E('span','muted',euro(race.basePrize)));
      const terrain=Object.entries(race.terrain).sort((a,b) => b[1]-a[1]).map(([key]) => STAT_LABELS[key]).slice(0,2).join(' · ');
      card.append(E('small','',terrain));
      if(room.isHost){
        const start=E('button','primary','Start koers');
        start.onclick=() => action('selectRace',{raceId:race.id});
        card.append(start);
      }
      grid.append(card);
    });
    panel.append(grid);
  }
  return panel;
}

function renderClub(room,game,me){
  const summary=E('div','cc-summary');
  summary.append(summaryItem('Budget',euro(me.wallet)));
  summary.append(summaryItem('Zeges',String(me.career.victories)));
  summary.append(summaryItem('Podiums',String(me.career.podiums)));
  summary.append(summaryItem('Monumenten',String(me.career.monumentsWon)));
  summary.append(summaryItem('GT-ritten',String(me.career.gtStagesWon)));
  summary.append(summaryItem('Totaal prijzengeld',euro(me.career.prizeMoney)));
  els.gameStage.append(summary);
  els.gameStage.append(renderRosterPanel(me));
  els.gameStage.append(renderShopPanel(me));
  els.gameStage.append(renderScoutPanel(room,game,me));
  els.gameStage.append(renderRaceCatalogPanel(room,game,me));
}

function renderLineup(room,game,me){
  const race=game.race;
  if(lastRaceKey!==race.raceId){
    selectedLineup=new Set(race.myLineup||[]);
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
    const list=E('div','cc-rider-list');
    available.forEach((rider) => {
      const row=E('label','cc-rider-row cc-selectable');
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
      row.append(checkbox);
      const head=E('div','cc-rider-head');
      head.append(E('strong','',rider.name),E('span','muted',`${rider.age}j · ${rider.specialism}`));
      row.append(head);
      row.append(statLine(rider.stats));
      list.append(row);
    });
    panel.append(list);
  }

  const actionsRow=E('div','cc-rider-actions');
  if(!submitted){
    const submit=E('button','primary',`Opstelling bevestigen (max ${game.squadSize})`);
    submit.onclick=() => {action('submitLineup',{riderIds:[...selectedLineup]});};
    actionsRow.append(submit);
  } else actionsRow.append(E('span','muted','Wachten op de rest van het peloton…'));
  if(room.isHost){
    const cancel=E('button','secondary','Annuleer koers');
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

function renderResult(room,game,me){
  const result=game.lastResult;
  if(!result){els.gameStage.append(E('p','muted','Geen resultaat beschikbaar.'));return}
  const panel=E('div','panel cc-panel');
  panel.append(panelHeading(result.raceName));

  const table=E('table','stats-table');
  const head=E('tr');
  ['#','Renner','Speler','Gebeurtenis','Prijs'].forEach((label) => head.append(E('th','',label)));
  table.append(head);
  result.classification.slice(0,10).forEach((entry) => {
    const tr=E('tr');
    tr.append(E('td','',String(entry.place)),E('td','',entry.riderName),E('td','',entry.playerName),E('td','',EVENT_LABELS[entry.event]||entry.event),E('td','',euro(entry.prize)));
    table.append(tr);
  });
  const wrap=E('div','stats-table-wrap');
  wrap.append(table);
  panel.append(wrap);

  if(result.dnfs.length){
    panel.append(E('h4','cc-category-title','Uitgevallen'));
    const dnfList=E('div','cc-ready-list');
    result.dnfs.forEach((entry) => dnfList.append(E('span','cc-ready-chip',`${entry.riderName} (${entry.playerName}) · ${EVENT_LABELS[entry.event]||entry.event}`)));
    panel.append(dnfList);
  }

  const actionsRow=E('div','cc-rider-actions');
  const back=E('button','primary','Terug naar club');
  back.onclick=() => action('backToClub');
  actionsRow.append(back);
  panel.append(actionsRow);

  els.gameStage.append(panel);
}
