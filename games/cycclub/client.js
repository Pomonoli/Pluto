let els,E,action,titlebar,logBox;
function bind(api){({els,E,action,titlebar,logBox}=api)}

export function render(api){bind(api);renderCycClub(api.room,api.game)}
export const showResult=false;
export const roomOptions={allowRematch:false,bodyClass:'cycclub-active'};
export const playerStrip=false;
export const leaderboardConfig={columns:[
  {key:'rank',label:'#',short:'#',width:'rank'},
  {key:'username',label:'Speler',short:'Speler',width:'player'},
  {key:'netWorth',label:'Netto waarde',short:'NW',width:'wide',format:'currency'},
  {key:'victories',label:'Zeges',short:'Z'},
  {key:'prizeMoney',label:'Prijzengeld',short:'€P',width:'wide',format:'currency'}
]};
export function profileExtra({stat}){return stat.games?`${stat.wins} zeges`:'—'}
export function metric({player}){return {text:euro(player.wallet), score:player.career.victories}}

const STAT_LABELS={flat:'Vlak',mountain:'Berg',cobbles:'Kasseien',timeTrial:'Tijdrit',sprint:'Sprint',stamina:'Uithouding'};
const STAT_SHORT={flat:'VLK',mountain:'BRG',cobbles:'KSW',timeTrial:'TT',sprint:'SPR',stamina:'UIT'};
const SHOP_LABELS={bikes:'Fietsen & Materiaal',nutrition:'Voeding & Supplementen',trainers:'Trainers & Analyse',medical:'Medische Staf'};
const SHOP_ICONS={bikes:'BIKE',nutrition:'FUEL',trainers:'DATA',medical:'MED'};
const CATEGORY_ORDER=['monument','classic','grand_tour'];
const CATEGORY_LABELS={monument:'Monumenten',classic:'Vlaamse Klassiekers',grand_tour:'Grote Rondes'};
const STATUS_LABELS={active:'Fit',injured:'Geblesseerd',sick:'Ziek'};
const SPECIALISM_LABELS={sprinter:'Sprinter',climber:'Klimmer',classics:'Klassieker',allrounder:'Allrounder',puncheur:'Puncheur'};
const ROLE_LABELS={climber:'Klimmer',sprinter:'Sprinter',allrounder:'Allrounder',domestique:'Meesterknecht'};
const TACTIC_LABELS={recover:'Herstel',follow:'Volg',leadout:'Kop',attack:'Val aan',fetch_bidons:'Bidons'};
const EVENT_LABELS={topdag:'Topdag',normaal:'Normale rit',pech:'Pech',valt:'Val'};
const SEGMENT_OUTCOME_LABELS={topdag:'Topdag',normaal:'Normaal segment',pech:'Pech',valt:'Val'};
const RACE_GROUP_LABELS={breakaway:'Kopgroep',chasers:'Volgers',peloton:'Peloton',tail:'Staart'};
const TERRAIN_TYPE_LABELS={flat:'Vlak',hills:'Heuvels',mountain:'Berg',cobbles:'Kasseien',timeTrial:'Tijdrit'};
const CLASSIFICATION_TABS=[
  {key:'gc', label:'Algemeen (Geel)', valueLabel:'Tijd', formatValue:(v) => `${v>0?'+':''}${v}s`},
  {key:'green', label:'Punten (Groen)', valueLabel:'Punten', formatValue:(v) => String(v)},
  {key:'polka', label:'Bergen (Bolletjes)', valueLabel:'Punten', formatValue:(v) => String(v)},
  {key:'youth', label:'Jongeren (Wit)', valueLabel:'Tijd', formatValue:(v) => `${v>0?'+':''}${v}s`},
  {key:'team', label:'Ploegen', valueLabel:'Tijd', formatValue:(v) => `${v>0?'+':''}${v}s`}
];
const TACTIC_STORAGE_KEY='pluto.cycclub.riderTactics';

function loadRememberedTactics(){
  try{
    const saved=JSON.parse(localStorage.getItem(TACTIC_STORAGE_KEY)||'{}');
    return new Map(Object.entries(saved).filter(([,tactic]) => Object.hasOwn(TACTIC_LABELS,tactic)));
  }catch{
    return new Map();
  }
}

function rememberTactics(tactics){
  try{localStorage.setItem(TACTIC_STORAGE_KEY,JSON.stringify(Object.fromEntries(tactics)))}catch{}
}

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
  const strong=E('strong','');
  if(value instanceof Node)strong.append(value);
  else strong.textContent=value;
  item.append(E('span','',label),strong);
  return item;
}

function sellPrice(rider){return rider.sellValue??Math.round(rider.marketValue*0.55/50)*50}
function cancelButtonLabel(game){return game.grandTour?'✕ Stop de ronde':'✕ Annuleer koers'}

function renderGameBanner(me){
  const banner=E('header','cc-game-banner');
  const leave=E('button','cc-banner-icon','←');
  leave.type='button';leave.setAttribute('aria-label','Spel verlaten');
  leave.onclick=() => document.getElementById('mobileGameLeaveButton')?.click();
  const copy=E('div','cc-banner-copy');
  copy.append(E('strong','','CycClub'));
  const budget=E('div','cc-banner-budget');
  budget.append(E('small','','Budget'),E('strong','',euro(me.wallet)));
  const menuButton=E('button','cc-banner-icon','•••');
  menuButton.type='button';menuButton.setAttribute('aria-label','Spelmenu');menuButton.setAttribute('aria-expanded','false');
  const menu=E('div','cc-banner-menu hidden');
  const rules=E('button','','Spelregels');rules.type='button';rules.onclick=() => document.getElementById('mobileGameRulesButton')?.click();
  const sound=E('button','','Geluid');sound.type='button';sound.onclick=() => document.getElementById('mobileGameSoundButton')?.click();
  const leaveMenu=E('button','danger','Spel verlaten');leaveMenu.type='button';leaveMenu.onclick=() => document.getElementById('mobileGameLeaveMenuButton')?.click();
  menu.append(rules,sound,leaveMenu);
  menuButton.onclick=() => {const open=menu.classList.toggle('hidden')===false;menuButton.setAttribute('aria-expanded',open?'true':'false');};
  const actions=E('div','cc-banner-actions');actions.append(budget,menuButton,menu);
  banner.append(leave,copy,actions);
  return banner;
}

function navIcon(type){
  const icon=E('span','cc-nav-icon');
  const paths={
    roster:'<circle cx="12" cy="8" r="3"/><path d="M5.5 19c.5-4 2.7-6 6.5-6s6 2 6.5 6"/>',
    races:'<path d="M5 18 10 6l4 7 2-4 3 9Z"/><path d="M4 18h16"/>',
    scout:'<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4.5 4.5"/>',
    shop:'<path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"/>'
  };
  icon.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type]}</svg>`;
  return icon;
}

function addNavIcon(button,type){button.prepend(navIcon(type));return button}

let selectedLineup=new Set();
let lastRaceKey=null;
let riderTactics=new Map();
let riderGels=new Set();
let lastSegmentKey=null;
let clubTab='roster';
let scoutFilterStat='';
let scoutFilterMinStat='';
let scoutFilterMaxPrice='';

function renderCycClub(room,game){
  const me=game.players.find((player) => player.id===room.meId);
  if(!me){els.gameStage.append(E('p','muted','Je bent geen actieve speler in deze club.'));return}
  els.gameStage.append(renderGameBanner(me));

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
  const wrap=E('div','cc-card-list');
  me.riders.slice().sort((a,b) => b.marketValue-a.marketValue).forEach((rider) => {
    let rest;
    if(rider.status==='active'&&rider.fatigue>0){
      rest=E('button','secondary',`Rust · ${euro(600)}`);
      rest.onclick=() => action('restRider',{riderId:rider.id});
    } else rest=E('span','muted','—');
    const sell=E('button','cc-overflow-btn',`Verkoop · ${euro(sellPrice(rider))}`);
    sell.onclick=() => action('sellRider',{riderId:rider.id});

    const card=E('article','cc-manager-card cc-roster-card');
    const head=E('div','cc-card-head');
    const identity=E('div','cc-card-identity');
    identity.append(E('strong','',rider.name),E('small','',`${rider.team||'—'} · ${SPECIALISM_LABELS[rider.specialism]||rider.specialism} · ${rider.age}j`));
    head.append(identity,riderStatusBadge(rider));
    card.append(head,statLine(rider.stats),fatigueMeter(rider.fatigue));
    const actions=E('div','cc-card-actions');
    actions.append(rest,sell);
    card.append(actions);
    wrap.append(card);
  });
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
    box.append(E('span','cc-upgrade-icon',SHOP_ICONS[category]),E('strong','',SHOP_LABELS[category]));
    const progress=E('div','cc-progress');
    const fill=E('div','cc-progress-fill');
    fill.style.width=`${(level/SHOP_MAX_LEVEL)*100}%`;
    progress.append(fill);
    box.append(progress);
    box.append(E('span','cc-shop-level',`Niveau ${level}/${SHOP_MAX_LEVEL}`));
    box.append(E('p','cc-shop-effect',effects[category]||'Geen bonus'));
    if(level<SHOP_MAX_LEVEL){
      const cost=SHOP_COSTS[level];
      const buy=E('button','primary',`Upgrade · ${euro(cost)}`);
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
  const panel=E('div','panel cc-panel cc-scout-panel');
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

  const wrap=E('div','cc-card-list cc-market-list');
  const blocks=[];
  market.forEach((candidate) => {
    const buy=E('button','primary',`Koop · ${euro(candidate.marketValue)}`);
    buy.disabled=me.wallet<candidate.marketValue||me.riders.length>=maxRiders;
    buy.onclick=() => action('buyRider',{candidateId:candidate.id});

    const card=E('article','cc-manager-card cc-market-card');
    const head=E('div','cc-card-head');
    const identity=E('div','cc-card-identity');
    identity.append(E('strong','',candidate.name),E('small','',`${candidate.team||'—'} · ${SPECIALISM_LABELS[candidate.specialism]||candidate.specialism} · ${candidate.age}j`));
    head.append(identity,E('b','cc-market-price',euro(candidate.marketValue)));
    card.append(head,statLine(candidate.stats),buy);
    wrap.append(card);
    blocks.push({candidate,card});
  });
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
      block.card.classList.toggle('hidden',!match);
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
  panel.append(panelHeading('Koersen'));
  if(!room.isHost)panel.append(E('p','muted','Alleen de host kan een koers starten.'));
  const groups=new Map();
  for(const race of game.raceCatalog){
    if(!groups.has(race.category))groups.set(race.category,[]);
    groups.get(race.category).push(race);
  }
  const categorySelect=document.createElement('select');
  categorySelect.className='cc-category-select';
  categorySelect.append(new Option('Alle categorieën',''));
  for(const category of CATEGORY_ORDER)if(groups.has(category))categorySelect.append(new Option(CATEGORY_LABELS[category]||category,category));
  panel.append(categorySelect);
  const categorySections=[];
  for(const category of CATEGORY_ORDER){
    const races=groups.get(category);
    if(!races||!races.length)continue;
    const section=E('section','cc-race-category');
    section.dataset.category=category;
    section.append(E('h4','cc-category-title',CATEGORY_LABELS[category]||category));
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
        const start=E('button','primary','Start koers');
        start.onclick=() => action('selectRace',{raceId:race.id});
        card.append(start);
      }
      grid.append(card);
    });
    section.append(grid);
    panel.append(section);
    categorySections.push(section);
  }
  categorySelect.onchange=() => categorySections.forEach((section) => section.classList.toggle('hidden',categorySelect.value&&section.dataset.category!==categorySelect.value));
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
  const manager=E('div','cc-manager-shell');
  const content=E('main','cc-manager-content');
  const summary=E('div','cc-summary');
  summary.append(summaryItem('Budget',euro(me.wallet)));
  summary.append(summaryItem('Zeges',String(me.career.victories)));
  summary.append(summaryItem('Podiums',String(me.career.podiums)));
  summary.append(summaryItem('Monumenten',String(me.career.monumentsWon)));
  summary.append(summaryItem('Grote Rondes',String(me.career.grandToursWon)));
  summary.append(summaryItem('Grote Ritten',String(me.career.gtStagesWon)));
  summary.append(summaryItem('Totaal prijzengeld',euro(me.career.prizeMoney)));
  content.append(summary);

  const rosterSection=E('div','cc-tab-section');
  rosterSection.append(renderRosterPanel(me,game.maxRiders||10));

  const scoutSection=E('div','cc-tab-section');
  scoutSection.append(renderScoutPanel(room,game,me));

  const shopSection=E('div','cc-tab-section');
  shopSection.append(renderShopPanel(me));

  const racesSection=E('div','cc-tab-section');
  racesSection.append(renderRaceCatalogPanel(room,game,me));

  const sections={roster:rosterSection,scout:scoutSection,shop:shopSection,races:racesSection};
  const tabButtons={};
  const applyTab=(tab) => {
    clubTab=tab;
    for(const key of Object.keys(sections))sections[key].classList.toggle('hidden',key!==tab);
    for(const key of Object.keys(tabButtons)){
      const active=key===tab;
      tabButtons[key].classList.toggle('active',active);
      tabButtons[key].setAttribute('aria-selected',active?'true':'false');
    }
  };

  const topBar=E('nav','cc-club-tabs');
  topBar.setAttribute('role','tablist');
  const rosterTab=E('button','cc-club-tab','Ploeg');
  addNavIcon(rosterTab,'roster');
  rosterTab.type='button';
  rosterTab.onclick=() => applyTab('roster');
  tabButtons.roster=rosterTab;
  const shopTab=E('button','cc-club-tab','Upgrades');
  addNavIcon(shopTab,'shop');
  shopTab.type='button';
  shopTab.onclick=() => applyTab('shop');
  tabButtons.shop=shopTab;
  const scoutOpenBtn=E('button','cc-tab-open-btn',`🔍 Scoutingmarkt (${(game.myScoutMarket||[]).length})`);
  scoutOpenBtn.textContent='Markt';
  addNavIcon(scoutOpenBtn,'scout');
  scoutOpenBtn.className='cc-club-tab';
  scoutOpenBtn.type='button';
  scoutOpenBtn.onclick=() => applyTab('scout');
  tabButtons.scout=scoutOpenBtn;
  const racesOpenBtn=E('button','cc-tab-open-btn',`📅 Koerskalender (${game.raceCatalog.length})`);
  racesOpenBtn.textContent='Koersen';
  addNavIcon(racesOpenBtn,'races');
  racesOpenBtn.className='cc-club-tab';
  racesOpenBtn.type='button';
  racesOpenBtn.onclick=() => applyTab('races');
  tabButtons.races=racesOpenBtn;
  topBar.append(rosterTab,racesOpenBtn,scoutOpenBtn,shopTab);
  for(const button of Object.values(tabButtons))button.setAttribute('role','tab');

  const resetBtn=E('button','cc-danger-btn','Opnieuw beginnen');
  resetBtn.type='button';
  resetBtn.onclick=() => {
    if(confirm('Weet je zeker dat je opnieuw wilt beginnen? Je budget, renners, upgrades en carrièrestats worden definitief gewist.')){
      clubTab='roster';
      action('resetTeam');
    }
  };
  rosterSection.append(resetBtn);
  content.append(rosterSection,scoutSection,shopSection,racesSection);
  manager.append(content,topBar);
  els.gameStage.append(manager);
  applyTab(clubTab);
}

function renderLineup(room,game,me){
  const race=game.race;
  if(lastRaceKey!==race.raceId){
    selectedLineup=new Set(race.myLineup||[]);
    lastRaceKey=race.raceId;
  }
  const catalogRace=game.raceCatalog.find((candidate) => candidate.id===race.raceId);
  const panel=E('div','panel cc-panel cc-lineup-panel');
  panel.append(panelHeading(race.raceName));
  if(catalogRace){
    const terrain=Object.entries(catalogRace.terrain).sort((a,b) => b[1]-a[1]).map(([key,weight]) => `${STAT_LABELS[key]} ${Math.round(weight*100)}%`).join(' · ');
    panel.append(E('p','muted',terrain));
  }

  const available=me.riders;
  const submitted=(race.readyIds||[]).includes(me.id);
  let submitButton;
  if(!available.length){
    panel.append(E('p','muted','Geen beschikbare renners.'));
  } else {
    const grid=E('div','cc-rider-grid cc-active-rider-grid');
    available.forEach((rider) => {
      const card=E('button','cc-rider-card cc-selectable');
      card.type='button';
      card.disabled=submitted||rider.status!=='active';
      const updateSelectedState=() => {
        const selected=selectedLineup.has(rider.id);
        card.classList.toggle('selected',selected);
        card.setAttribute('aria-pressed',selected?'true':'false');
        if(submitButton)submitButton.textContent=`Klaar · ${selectedLineup.size} / ${game.squadSize}`;
      };
      updateSelectedState();
      card.onclick=() => {
        if(selectedLineup.has(rider.id))selectedLineup.delete(rider.id);
        else{
          if(selectedLineup.size>=game.squadSize)return;
          selectedLineup.add(rider.id);
        }
        updateSelectedState();
      };
      const head=E('div','cc-rider-head');
      head.append(E('strong','',rider.name),E('span','muted',`${STATUS_LABELS[rider.status]} · ${rider.fatigue}% moe · ${SPECIALISM_LABELS[rider.specialism]||rider.specialism}`));
      card.append(head);
      card.append(statLine(rider.stats));
      card.append(labelValue('Vermoeidheid',`${rider.fatigue}%`));
      grid.append(card);
    });
    panel.append(grid);
  }

  const actionsRow=E('div','cc-rider-actions');
  if(!submitted){
    const submit=E('button','primary',`Klaar · ${selectedLineup.size} / ${game.squadSize}`);
    submitButton=submit;
    submit.onclick=() => {action('submitLineup',{riderIds:[...selectedLineup]});};
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
  if(race.leader){
    const leader=E('div','cc-race-leader');
    leader.append(E('span','','🚴 Op kop'),E('strong','',race.leader.riderName),E('small','',race.leader.playerName));
    wrap.append(leader);
  }
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

const TACTIC_ROLL_BONUS={recover:0,follow:2,leadout:3,attack:5,fetch_bidons:0};
function previewTerrainFactor(role,terrainType){
  if(role==='climber')return terrainType==='mountain'?0.25:(terrainType==='flat'?-0.05:0);
  if(role==='sprinter')return terrainType==='flat'?0.20:(terrainType==='mountain'?-0.25:0);
  if(role==='allrounder')return (terrainType==='hills'||terrainType==='cobbles')?0.10:0;
  return 0;
}
function previewFatiguePenalty(fatigue){
  if(fatigue<=40)return 0;
  if(fatigue<=70)return 0.10;
  if(fatigue<=90)return 0.25;
  return 0.5;
}
function previewRollAdjustment(riderState,tactic,segment,hasLeadout){
  const bonked=riderState.fatigue>=91;
  const effectiveTactic=bonked&&(tactic==='attack'||tactic==='leadout')?'follow':tactic;
  const terrain=previewTerrainFactor(riderState.role,segment.terrainType);
  const tacticBonus=TACTIC_ROLL_BONUS[effectiveTactic]+((effectiveTactic==='follow'&&hasLeadout)?1.5:0);
  const fatiguePenalty=bonked?0.5:previewFatiguePenalty(riderState.fatigue);
  return Math.round((tacticBonus+(terrain*10)-(fatiguePenalty*10))*10)/10;
}

function fatigueMeter(fatigue){
  const wrap=E('div','cc-fatigue-meter');
  const bar=E('div','cc-fatigue-bar');
  const fill=E('div',`cc-fatigue-fill${fatigue>=91?' cc-fatigue-bonk':fatigue>70?' cc-fatigue-high':fatigue>40?' cc-fatigue-mid':''}`);
  fill.style.width=`${fatigue}%`;
  bar.append(fill);
  wrap.append(bar,E('span','cc-fatigue-label',`${fatigue}%`));
  return wrap;
}

function roleImpactLegend(){
  const legend=E('div','cc-role-legend');
  legend.append(E('strong','cc-role-legend-title','Rollen & terreinimpact'));
  [
    ['climber','Klimmer','+25% berg · −5% vlak'],
    ['sprinter','Sprinter','+20% vlak · −25% berg'],
    ['allrounder','Allrounder','+10% heuvels en kasseien'],
    ['domestique','Meesterknecht','Geen terreinbonus']
  ].forEach(([role,label,impact]) => {
    const item=E('span','cc-role-legend-item');
    item.append(E('i',`cc-role-color cc-role-${role}`),E('b','',label),document.createTextNode(impact));
    legend.append(item);
  });
  return legend;
}

function segmentProgressLegend(){
  const legend=E('div','cc-segment-legend');
  legend.append(E('strong','cc-segment-legend-title','Segmentverloop'));
  [
    ['topdag','Topdag'],
    ['normaal','Normaal'],
    ['pech','Pech'],
    ['valt','Val'],
    ['pending','Nog te rijden']
  ].forEach(([outcome,label]) => {
    const item=E('span','cc-segment-legend-item');
    item.append(E('i',`cc-segment-dot cc-segment-${outcome}`),document.createTextNode(label));
    legend.append(item);
  });
  return legend;
}

function raceGroupLegend(){
  const legend=E('div','cc-group-legend');
  legend.append(E('strong','cc-group-legend-title','Positie in koers'));
  [
    ['breakaway','Kopgroep','0–5 sec'],
    ['chasers','Volgers','6–20 sec'],
    ['peloton','Peloton','21–60 sec'],
    ['tail','Staart','meer dan 60 sec']
  ].forEach(([group,label,range]) => {
    const item=E('span','cc-group-legend-item');
    item.append(E('i',`cc-group-color cc-group-${group}`),E('b','',label),document.createTextNode(range));
    legend.append(item);
  });
  return legend;
}

function renderRacing(room,game,me){
  const race=game.race;
  if(!race){els.gameStage.append(E('p','muted','Geen actieve rit.'));return}
  const segment=race.segment;
  const tacticLabels=race.tacticLabels||{};
  const segmentKey=`${race.raceId}:${race.segmentIndex}`;
  if(lastSegmentKey!==segmentKey){
    riderTactics=loadRememberedTactics();
    riderGels=new Set();
    lastSegmentKey=segmentKey;
  }

  const panel=E('div','panel cc-panel cc-racing-panel');
  panel.append(panelHeading(race.raceName));

  panel.append(buildProfileChart(race));

  const myProgress=race.myProgress;
  const statusRow=E('div','cc-lv-row');
  statusRow.append(labelValue('Segment',`${Math.min((race.segmentIndex||0)+1,SEGMENTS_PER_RACE)} / ${SEGMENTS_PER_RACE}`));
  if(segment){
    statusRow.append(labelValue('Terrein',TERRAIN_TYPE_LABELS[segment.terrainType]||segment.terrainType));
    if(segment.mountainCategory>0)statusRow.append(labelValue('Beklimming',`Cat. ${segment.mountainCategory}`));
    if(segment.hasIntermediateSprint)statusRow.append(labelValue('Tussensprint','Ja'));
  }
  const latestSegment=myProgress&&Object.values(myProgress.riders||{}).flatMap((rider) => rider.segments||[]).sort((a,b) => b.n-a.n)[0];
  if(latestSegment){
    const rollValue=E('span','cc-roll-result',`🎲 ${latestSegment.roll}`);
    statusRow.append(labelValue('Laatste worp',rollValue));
  }
  panel.append(statusRow);

  if(!myProgress){
    panel.append(E('p','muted','Je hebt geen renners in deze rit.'));
  } else if(!myProgress.awaitingConfirmation){
    panel.append(E('p','muted','Bevestigd. Wachten tot de rest van het peloton dit segment heeft gereden…'));
  } else {
    const activeEntries=Object.entries(myProgress.riders).filter(([,riderState]) => !riderState.dnf);
    const grid=E('div','cc-rider-grid');
    const cardRefs=[];
    const rollBtn=E('button','primary','Werp segment');

    const refreshTacticUI=() => {
      const hasLeadout=activeEntries.some(([riderId]) => riderTactics.get(riderId)==='leadout');
      for(const ref of cardRefs){
        const tactic=riderTactics.get(ref.riderId);
        ref.gelBtn.classList.toggle('active',riderGels.has(ref.riderId));
        if(tactic&&segment){
          const adjustment=previewRollAdjustment(ref.riderState,tactic,segment,hasLeadout);
          ref.preview.textContent=`Aanpassing worp ${adjustment>=0?'+':''}${adjustment}`;
        } else ref.preview.textContent='';
      }
      rollBtn.disabled=activeEntries.some(([riderId]) => !riderTactics.has(riderId));
    };

    activeEntries.forEach(([riderId,riderState]) => {
      const card=E('div','cc-rider-card cc-rider-tactic-card');
      const head=E('div','cc-rider-head');
      head.append(E('strong','',riderState.name),E('span',`cc-rider-role cc-role-${riderState.role}`,ROLE_LABELS[riderState.role]||riderState.role));
      card.append(head);
      card.append(fatigueMeter(riderState.fatigue));
      card.append(segmentDots(riderState.segments,SEGMENTS_PER_RACE));
      const groupLabel=riderState.dnf?'Uitgevallen':RACE_GROUP_LABELS[riderState.raceGroup]||'Startveld';
      const gapLabel=riderState.gapToLeader===0?'op kop':riderState.gapToLeader==null?'nog geen tijd':`+${riderState.gapToLeader}s`;
      card.append(E('span',`cc-race-position cc-group-${riderState.raceGroup||'pending'}`,`${groupLabel} · ${gapLabel}`));

      const preview=E('span','cc-tactic-preview','');
      card.append(preview);

      const tacticButtons=E('div','cc-tactic-buttons');
      tacticButtons.setAttribute('role','group');
      tacticButtons.setAttribute('aria-label',`Tactiek voor ${riderState.name}`);
      for(const key of Object.keys(tacticLabels)){
        const tacticBtn=E('button','cc-tactic-btn',tacticLabels[key]);
        tacticBtn.type='button';
        const selected=riderTactics.get(riderId)===key;
        tacticBtn.classList.toggle('active',selected);
        tacticBtn.setAttribute('aria-pressed',selected?'true':'false');
        tacticBtn.onclick=() => {
          riderTactics.set(riderId,key);
          rememberTactics(riderTactics);
          for(const button of tacticButtons.children){
            const active=button===tacticBtn;
            button.classList.toggle('active',active);
            button.setAttribute('aria-pressed',active?'true':'false');
          }
          refreshTacticUI();
        };
        tacticButtons.append(tacticBtn);
      }
      card.append(tacticButtons);

      const gelBtn=E('button','secondary cc-gel-btn',`Gel ${riderState.gelsRemaining}`);
      gelBtn.type='button';
      gelBtn.disabled=riderState.gelsRemaining<=0;
      gelBtn.onclick=() => {
        if(riderGels.has(riderId))riderGels.delete(riderId);
        else riderGels.add(riderId);
        refreshTacticUI();
      };
      card.append(gelBtn);

      cardRefs.push({riderId,riderState,gelBtn,preview});
      grid.append(card);
    });
    panel.append(grid);
    refreshTacticUI();

    const actionsRow=E('div','cc-rider-actions');
    rollBtn.onclick=() => {
      const tactics=Object.fromEntries(riderTactics);
      const gels=Object.fromEntries([...riderGels].map((riderId) => [riderId,true]));
      action('rollSegment',{tactics,gels});
    };
    actionsRow.append(rollBtn);
    if(rollBtn.disabled)actionsRow.append(E('span','muted','Ken elke renner een tactiek toe.'));
    panel.append(actionsRow);
  }

  if(myProgress?.riders&&!myProgress.awaitingConfirmation){
    const historyGrid=E('div','cc-rider-grid cc-history-grid');
    Object.values(myProgress.riders).forEach((riderState) => {
      const card=E('div','cc-rider-card');
      const head=E('div','cc-rider-head');
      head.append(E('strong','',riderState.name),E('span','muted',riderState.dnf?'Uitgevallen':`${riderState.pr} pt`));
      card.append(head);
      card.append(segmentDots(riderState.segments,SEGMENTS_PER_RACE));
      if(!riderState.dnf){
        const groupLabel=RACE_GROUP_LABELS[riderState.raceGroup]||'Startveld';
        const gapLabel=riderState.gapToLeader===0?'op kop':riderState.gapToLeader==null?'nog geen tijd':`+${riderState.gapToLeader}s`;
        card.append(E('span',`cc-race-position cc-group-${riderState.raceGroup||'pending'}`,`${groupLabel} · ${gapLabel}`));
      }
      historyGrid.append(card);
    });
    panel.append(historyGrid);
  }

  panel.append(segmentProgressLegend(),raceGroupLegend(),roleImpactLegend());

  const readyList=E('div','cc-ready-list');
  (race.allProgress||[]).forEach((entry) => {
    readyList.append(E('span',`cc-ready-chip ${entry.awaitingConfirmation?'':'ready'}`,`${entry.playerName}${entry.isNpc?' · NPC':''} · ${entry.awaitingConfirmation?'aan het rollen':'bevestigd'}`));
  });
  panel.append(readyList);

  if(game.grandTour?.classifications)panel.append(renderClassificationTabs(game.grandTour.classifications));

  if(room.isHost){
    const actionsRow2=E('div','cc-rider-actions');
    const cancel=E('button','secondary',cancelButtonLabel(game));
    cancel.onclick=() => action('cancelRace');
    actionsRow2.append(cancel);
    panel.append(actionsRow2);
  }

  els.gameStage.append(panel);
}

function segmentDots(segments,totalSegments=0){
  const row=E('div','cc-segment-dots');
  row.setAttribute('aria-label','Segmentverloop');
  (segments||[]).forEach((segment) => {
    const dot=E('span',`cc-segment-dot cc-segment-${segment.outcome}`);
    const tacticLabel=TACTIC_LABELS[segment.tactic]||segment.tactic||'';
    dot.title=`Segment ${segment.n}: worp ${segment.roll} · ${tacticLabel} (×${segment.multiplier?.toFixed?.(2)??segment.multiplier}) — ${SEGMENT_OUTCOME_LABELS[segment.outcome]||segment.outcome}`;
    row.append(dot);
  });
  for(let n=(segments||[]).length+1;n<=totalSegments;n++){
    const dot=E('span','cc-segment-dot cc-segment-pending');
    dot.title=`Segment ${n}: nog te rijden`;
    row.append(dot);
  }
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

let classificationTab='gc';

function renderClassificationTabs(classifications){
  if(!classifications)return E('div');
  const wrap=E('div','cc-classification-wrap');
  const selector=document.createElement('select');
  selector.className='cc-classification-select';
  const body=E('div','cc-classification-body');
  const renderTab=(tabKey) => {
    body.replaceChildren();
    const tab=CLASSIFICATION_TABS.find((candidate) => candidate.key===tabKey)||CLASSIFICATION_TABS[0];
    const rows=classifications[tab.key]||[];
    if(!rows.length){body.append(E('p','muted','Nog geen klassement.'));return}
    const table=E('table','stats-table');
    const head=E('tr');
    const isTeam=tab.key==='team';
    (isTeam?['#','Speler',tab.valueLabel]:['#','Renner','Speler',tab.valueLabel,'Ritzeges']).forEach((label) => head.append(E('th','',label)));
    table.append(head);
    rows.slice(0,10).forEach((entry) => {
      const tr=E('tr');
      if(isTeam)tr.append(E('td','',String(entry.place)),E('td','',entry.playerName),E('td','',tab.formatValue(entry.value)));
      else tr.append(E('td','',String(entry.place)),E('td','',entry.riderName),E('td','',entry.playerName),E('td','',tab.formatValue(entry.value)),E('td','',String(entry.stageWins||0)));
      table.append(tr);
    });
    const tableWrap=E('div','stats-table-wrap');
    tableWrap.append(table);
    body.append(tableWrap);
  };
  CLASSIFICATION_TABS.forEach((tab) => selector.append(new Option(tab.label,tab.key)));
  selector.value=classificationTab;
  selector.onchange=() => {classificationTab=selector.value;renderTab(classificationTab);};
  wrap.append(selector,body);
  renderTab(classificationTab);
  return wrap;
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
  const panel=E('div','panel cc-panel cc-result-panel');
  panel.append(panelHeading(result.raceName));
  renderClassificationPanel(panel,result);
  panel.append(backToClubButton());
  els.gameStage.append(panel);
}

function renderStageResult(room,game,me){
  const result=game.lastResult;
  if(!result){els.gameStage.append(E('p','muted','Geen ritresultaat beschikbaar.'));return}
  const panel=E('div','panel cc-panel cc-result-panel');
  panel.append(panelHeading(`${result.raceName} · Rit ${result.stageNumber}/${result.totalStages}`));
  renderClassificationPanel(panel,result);

  if(result.classifications){
    panel.append(E('h4','cc-category-title','Tussenstand klassementen'));
    panel.append(renderClassificationTabs(result.classifications));
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
  const panel=E('div','panel cc-panel cc-result-panel');
  panel.append(panelHeading(`${result.raceName} · Eindklassement`));

  panel.append(renderClassificationTabs(result.classifications));

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
