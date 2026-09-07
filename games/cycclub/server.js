const meta = {
  key:'cycclub', name:'CycClub',
  description:'Bouw een eigen wielerploeg, koop en train renners en race voor prijzengeld en een plek op het leaderboard.',
  minPlayers:1, maxPlayers:6, supportsNpc:true, realtime:false, solo:false
};

const STAT_KEYS = ['flat','mountain','cobbles','timeTrial','sprint','stamina'];
const SHOP_KEYS = ['bikes','nutrition','trainers','medical'];
const SHOP_COSTS = [4000,8500,15000,26000,42000];
const SHOP_MAX_LEVEL = SHOP_COSTS.length;
const STARTING_WALLET = 100000;
const STARTER_RIDERS = 0;
const NPC_STARTER_RIDERS = 6;
const SCOUT_MARKET_SIZE = 10;
const MARKET_PRICE_MULTIPLIER = 3.5;
const MAX_RIDERS = 10;
const SQUAD_SIZE = 3;
const SEGMENTS_PER_RACE = 8;
const REST_COST = 600;
const REST_RECOVERY = 25;
const SELL_RATE = 0.55;
const NPC_DELAY = 900;
const RACE_FIELD_SIZE = 30;
const RACE_NPC_ID = '__race_npcs__';

const RIDER_DATA = require('./data/riders.json');
const SPECIALISM_BY_CODE = RIDER_DATA.specialisms;
const CATALOG_TEAMS = RIDER_DATA.teams.map((name,index) => ({id:`catalog-${index}`,name}));
const RIDER_CATALOG = RIDER_DATA.shards.flatMap(({file}) => require(`./data/${file}`).riders).map((row) => ({
  id:row[0], name:row[1], teamId:`catalog-${row[2]}`, age:row[3], specialism:SPECIALISM_BY_CODE[row[4]],
  stats:{flat:row[5],mountain:row[6],cobbles:row[7],timeTrial:row[8],sprint:row[9],stamina:row[10]},
  retired:Boolean(row[12])
}));
const RIDER_BY_ID = new Map(RIDER_CATALOG.map((rider) => [rider.id,rider]));

const SPECIALISMS = {
  sprinter:['sprint','flat'],
  climber:['mountain','stamina'],
  classics:['cobbles','flat'],
  allrounder:['timeTrial','stamina'],
  puncheur:['mountain','sprint']
};

// Individuele renner-tactieken per segment: elke renner in de opstelling kiest elk
// segment een houding, die samen met terrein en vermoeidheid zijn personalMultiplier bepaalt.
const RIDER_TACTICS = ['recover','follow','leadout','attack','fetch_bidons'];
const TACTIC_LABELS = {recover:'Herstel', follow:'Volg', leadout:'Kop', attack:'Val aan', fetch_bidons:'Bidons'};
const TACTIC_EFFECTS = {
  recover:{rollBonus:0, fatigueDelta:-10},
  follow:{rollBonus:2, fatigueDelta:5},
  leadout:{rollBonus:3, fatigueDelta:20},
  attack:{rollBonus:5, fatigueDelta:35},
  fetch_bidons:{rollBonus:0, fatigueDelta:15}
};
const LEADOUT_DRAFT_BONUS = 1.5;
const FETCH_BIDONS_RELIEF = 15;
const GEL_FATIGUE_RELIEF = 25;
const GELS_PER_RACE = 2;
const BONK_THRESHOLD = 91;

const ROLE_BY_SPECIALISM = {sprinter:'sprinter', climber:'climber', allrounder:'allrounder', classics:'allrounder', puncheur:'allrounder'};
function riderRole(rider){return ROLE_BY_SPECIALISM[rider.specialism]||'allrounder'}

function terrainFactorFor(role,terrainType){
  if(role==='climber')return terrainType==='mountain'?0.25:(terrainType==='flat'?-0.05:0);
  if(role==='sprinter')return terrainType==='flat'?0.20:(terrainType==='mountain'?-0.25:0);
  if(role==='allrounder')return (terrainType==='hills'||terrainType==='cobbles')?0.10:0;
  return 0; // domestique: geen terreinbonus
}

function fatiguePenaltyFor(fatigue){
  if(fatigue<=40)return 0;
  if(fatigue<=70)return 0.10;
  if(fatigue<=90)return 0.25;
  return 0.5; // Hongerklop: apart afgekapt op ×0.5 in calculateSegmentStep
}

// Zuivere rekenfunctie: past gel- en bidon-effecten toe (muteert fatigue/gelsRemaining op de
// meegegeven renners) en berekent daarna elke renner z'n personalMultiplier voor dit segment.
function calculateSegmentStep(riders,tacticsByRiderId,gelsByRiderId,segment,baseDiceRoll,team){
  const bikeBonus=(team?.shop?.bikes||0)*0.02;
  for(const rider of riders){
    if(gelsByRiderId[rider.id]&&rider.gelsRemaining>0){
      rider.fatigue=clamp(rider.fatigue-GEL_FATIGUE_RELIEF,0,100);
      rider.gelsRemaining-=1;
    }
  }
  const fetchingBidons=riders.some((rider) => tacticsByRiderId[rider.id]==='fetch_bidons');
  if(fetchingBidons){
    for(const rider of riders){
      if(tacticsByRiderId[rider.id]==='fetch_bidons')continue;
      rider.fatigue=clamp(rider.fatigue-FETCH_BIDONS_RELIEF,0,100);
    }
  }
  const hasLeadout=riders.some((rider) => tacticsByRiderId[rider.id]==='leadout');

  const results={};
  for(const rider of riders){
    let tactic=RIDER_TACTICS.includes(tacticsByRiderId[rider.id])?tacticsByRiderId[rider.id]:'follow';
    const bonked=rider.fatigue>=BONK_THRESHOLD;
    if(bonked&&(tactic==='attack'||tactic==='leadout'))tactic='follow';
    const effects=TACTIC_EFFECTS[tactic];
    const role=riderRole(rider);
    const terrain=terrainFactorFor(role,segment.terrainType);
    const tacticRollBonus=effects.rollBonus+((tactic==='follow'&&hasLeadout)?LEADOUT_DRAFT_BONUS:0);
    const effectiveFatigue=rider.fatigue*(1-(team?.shop?.nutrition||0)*0.08);
    const fatiguePenalty=bonked?0.5:fatiguePenaltyFor(effectiveFatigue);
    const statFactor=team?statFactorFor(rider,team,segment):0;
    // Alle effecten worden als punten bij de worp opgeteld of ervan afgetrokken.
    // Delen door tien bewaart het bestaande multiplierformaat voor scoring en klassementen.
    const effectiveRoll=baseDiceRoll+tacticRollBonus+(terrain*10)+(bikeBonus*10)+(statFactor*10)-(fatiguePenalty*10);
    let personalMultiplier=effectiveRoll/10;
    if(bonked)personalMultiplier=Math.min(personalMultiplier,0.5);
    personalMultiplier=Math.round(personalMultiplier*1000)/1000;
    rider.fatigue=clamp(rider.fatigue+effects.fatigueDelta,0,100);
    results[rider.id]={personalMultiplier, tactic, role, bonked};
  }
  return results;
}

function scoreFromMultiplier(personalMultiplier){return Math.round((personalMultiplier-1)*20)}
function timeDeltaFromMultiplier(personalMultiplier,fieldAverage){return Math.round((fieldAverage-personalMultiplier)*30)}

function raceGroupForGap(gapSeconds){
  if(gapSeconds<=5)return 'breakaway';
  if(gapSeconds<=20)return 'chasers';
  if(gapSeconds<=60)return 'peloton';
  return 'tail';
}

function buildRaceSituation(game){
  if(!game.race?.progress)return {leader:null,byEntry:{}};
  const entries=[];
  for(const player of raceActors(game)){
    const prog=game.race.progress[player.id];
    if(!prog)continue;
    for(const [riderId,state] of Object.entries(prog.riders)){
      if(state.dnf)continue;
      const rider=player.team.riders.find((candidate) => candidate.id===riderId);
      entries.push({playerId:player.id,playerName:player.name,riderId,riderName:rider?.name||'Renner',timeAccumulated:state.timeAccumulated});
    }
  }
  entries.sort((a,b) => a.timeAccumulated-b.timeAccumulated||a.riderName.localeCompare(b.riderName));
  if(!entries.length)return {leader:null,byEntry:{}};
  const leaderTime=entries[0].timeAccumulated;
  const byEntry={};
  for(const entry of entries){
    const gapToLeader=Math.max(0,entry.timeAccumulated-leaderTime);
    byEntry[`${entry.playerId}:${entry.riderId}`]={gapToLeader,raceGroup:raceGroupForGap(gapToLeader)};
  }
  return {leader:{...entries[0],gapToLeader:0,raceGroup:'breakaway'},byEntry};
}

const TERRAIN_TYPE_LABELS = {flat:'Vlak',hills:'Heuvels',mountain:'Berg',cobbles:'Kasseien',timeTrial:'Tijdrit'};
const MOUNTAIN_POINTS = {1:15,2:10,3:6,4:3};
const SPRINT_POINTS = [15,10,5];

function terrainTypeForStatKey(key){
  if(key==='mountain')return Math.random()<0.45?'mountain':'hills';
  if(key==='cobbles')return 'cobbles';
  if(key==='timeTrial')return 'timeTrial';
  return 'flat';
}

function elevationGainFor(terrainType){
  if(terrainType==='mountain')return randInt(600,1200);
  if(terrainType==='hills')return randInt(200,500);
  if(terrainType==='cobbles')return randInt(20,80);
  if(terrainType==='timeTrial')return randInt(10,60);
  return randInt(10,100);
}

// Bouwt eenmalig, bij de start van een rit, een lijst van SEGMENTS_PER_RACE segmentconfigs
// (terrein, hoogtemeters, tussensprint, bergcategorie) op basis van het terreinprofiel van de rit.
function buildSegmentPlan(catalogRace){
  const weighted=Object.entries(catalogRace.terrain||{});
  const total=weighted.reduce((sum,[,weight]) => sum+weight,0)||1;
  const segments=[];
  for(let i=0;i<SEGMENTS_PER_RACE;i+=1){
    let roll=Math.random()*total;
    let chosenKey=weighted[0]?.[0]||'flat';
    for(const [key,weight] of weighted){
      if(roll<weight){chosenKey=key;break}
      roll-=weight;
    }
    const terrainType=terrainTypeForStatKey(chosenKey);
    segments.push({segmentIndex:i, totalSegments:SEGMENTS_PER_RACE, terrainType, elevationGain:elevationGainFor(terrainType), hasIntermediateSprint:false, mountainCategory:0});
  }
  const sprintCandidates=segments.filter((segment,index) => index<SEGMENTS_PER_RACE-1&&(segment.terrainType==='flat'||segment.terrainType==='hills'));
  if(sprintCandidates.length)pick(sprintCandidates).hasIntermediateSprint=true;
  const mountainSegments=segments.filter((segment) => segment.terrainType==='mountain').sort((a,b) => b.elevationGain-a.elevationGain);
  mountainSegments.forEach((segment,index) => {segment.mountainCategory=Math.min(4,index+1)});
  return segments;
}

// 2026-seizoen: de 10 grootste WorldTour-ploegen met hun actuele kernrenners.
const LEGACY_TEAMS = [
  {id:'uae', name:'UAE Team Emirates XRG'},
  {id:'visma', name:'Visma-Lease a Bike'},
  {id:'bora', name:'Red Bull-BORA-hansgrohe'},
  {id:'soudal-qs', name:'Soudal Quick-Step'},
  {id:'ineos', name:'Netcompany INEOS'},
  {id:'alpecin', name:'Alpecin-Premier Tech'},
  {id:'lidl-trek', name:'Lidl-Trek'},
  {id:'ef', name:'EF Education-EasyPost'},
  {id:'movistar', name:'Movistar Team'},
  {id:'fdj', name:'Groupama-FDJ United'}
];
const TEAMS = CATALOG_TEAMS;
const TEAM_BY_ID = new Map([...LEGACY_TEAMS,...TEAMS].map((team) => [team.id, team]));


const DIFFICULTY_PRIZE_STEP = 3000;
function prizeForDifficulty(difficulty){return Math.round(difficulty*DIFFICULTY_PRIZE_STEP/500)*500}

const RACE_CATALOG = [
  {id:'ronde-van-vlaanderen', name:'Ronde van Vlaanderen', category:'monument', difficulty:9, terrain:{cobbles:0.4,flat:0.2,mountain:0.1,stamina:0.3}},
  {id:'parijs-roubaix', name:'Parijs-Roubaix', category:'monument', difficulty:9, terrain:{cobbles:0.6,flat:0.15,stamina:0.25}},
  {id:'milaan-sanremo', name:'Milaan-San Remo', category:'monument', difficulty:8, terrain:{flat:0.4,sprint:0.3,stamina:0.3}},
  {id:'luik-bastenaken-luik', name:'Luik-Bastenaken-Luik', category:'monument', difficulty:9, terrain:{mountain:0.5,stamina:0.3,flat:0.2}},
  {id:'lombardije', name:'Il Lombardia', category:'monument', difficulty:8, terrain:{mountain:0.6,stamina:0.4}},
  {id:'e3-saxo-classic', name:'E3 Saxo Classic', category:'classic', difficulty:5, terrain:{cobbles:0.5,flat:0.3,stamina:0.2}},
  {id:'gent-wevelgem', name:'Gent-Wevelgem', category:'classic', difficulty:5, terrain:{flat:0.4,cobbles:0.3,sprint:0.3}},
  {id:'dwars-door-vlaanderen', name:'Dwars door Vlaanderen', category:'classic', difficulty:5, terrain:{cobbles:0.4,flat:0.3,stamina:0.3}},
  {id:'omloop-het-nieuwsblad', name:'Omloop Het Nieuwsblad', category:'classic', difficulty:5, terrain:{cobbles:0.45,flat:0.25,stamina:0.3}}
].map((race) => ({...race, basePrize:prizeForDifficulty(race.difficulty)}));
const RACE_BY_ID = new Map(RACE_CATALOG.map((race) => [race.id, race]));
const PAYOUT_TABLE = [0.40,0.22,0.14,0.09,0.06,0.04,0.025,0.015,0.01,0.005];

const STAGES_PER_GRAND_TOUR = 21;
const STAGE_ID_SEP = '::stage:';
const STAGE_TERRAIN = {
  flat:{flat:0.5,sprint:0.35,stamina:0.15},
  hilly:{mountain:0.35,flat:0.35,stamina:0.3},
  mountain:{mountain:0.65,stamina:0.35},
  timeTrial:{timeTrial:0.8,stamina:0.2}
};
const STAGE_TYPE_LABELS = {flat:'Vlak',hilly:'Heuvelachtig',mountain:'Bergrit',timeTrial:'Tijdrit'};
const STAGE_DIFFICULTY = {flat:6,hilly:7,mountain:9,timeTrial:8};

function aggregateTerrain(route){
  const totals={};
  for(const stageType of route){
    const terrain=STAGE_TERRAIN[stageType];
    for(const key of Object.keys(terrain)) totals[key]=(totals[key]||0)+terrain[key];
  }
  const sum=Object.values(totals).reduce((a,b) => a+b,0);
  const normalized={};
  for(const key of Object.keys(totals)) normalized[key]=totals[key]/sum;
  return normalized;
}

function grandTour(id,name,route,overallPrize){
  return {id, name, category:'grand_tour', stages:STAGES_PER_GRAND_TOUR, route, overallPrize, terrain:aggregateTerrain(route)};
}

const GRAND_TOUR_CATALOG = [
  grandTour('tour-de-france','Tour de France',
    ['flat','hilly','flat','flat','mountain','flat','hilly','mountain','flat','flat','mountain','hilly','timeTrial','mountain','mountain','flat','hilly','mountain','flat','timeTrial','flat'],
    180000),
  grandTour('giro-ditalia','Giro d’Italia',
    ['flat','flat','hilly','mountain','flat','mountain','hilly','mountain','flat','timeTrial','mountain','flat','hilly','mountain','mountain','flat','hilly','mountain','mountain','timeTrial','flat'],
    140000),
  grandTour('vuelta-a-espana','Vuelta a España',
    ['flat','hilly','flat','mountain','flat','hilly','mountain','flat','mountain','hilly','timeTrial','mountain','flat','mountain','hilly','mountain','flat','mountain','hilly','timeTrial','flat'],
    140000)
];
const GRAND_TOUR_BY_ID = new Map(GRAND_TOUR_CATALOG.map((tour) => [tour.id, tour]));
const RACE_POOLS = new Map([...RACE_CATALOG,...GRAND_TOUR_CATALOG].map((race) => {
  const data=require(`./data/races/${race.id}.json`);
  if(!Array.isArray(data.riderIds)||data.riderIds.length!==50||new Set(data.riderIds).size!==50){
    throw new Error(`CycClub-racepool ${race.id} moet exact 50 unieke riderIds bevatten.`);
  }
  for(const riderId of data.riderIds)if(!RIDER_BY_ID.has(riderId))throw new Error(`Onbekende riderId ${riderId} in racepool ${race.id}.`);
  return [race.id,data.riderIds];
}));

function buildStageRaceId(tourId,stageNumber){return `${tourId}${STAGE_ID_SEP}${stageNumber}`}
function parseStageRaceId(raceId){
  const index=String(raceId||'').indexOf(STAGE_ID_SEP);
  if(index<0)return null;
  return {tourId:raceId.slice(0,index), stageNumber:Number(raceId.slice(index+STAGE_ID_SEP.length))};
}

function currentCatalogRace(raceId){
  const parsed=parseStageRaceId(raceId);
  if(!parsed)return RACE_BY_ID.get(raceId);
  const tour=GRAND_TOUR_BY_ID.get(parsed.tourId);
  if(!tour)return null;
  const stageType=tour.route[parsed.stageNumber-1];
  return {
    id:raceId, name:`${tour.name} — Rit ${parsed.stageNumber}/${tour.stages} · ${STAGE_TYPE_LABELS[stageType]}`,
    category:'grand_tour', terrain:STAGE_TERRAIN[stageType], stageType,
    basePrize:prizeForDifficulty(STAGE_DIFFICULTY[stageType]),
    tourId:tour.id, tourName:tour.name, stageNumber:parsed.stageNumber, totalStages:tour.stages
  };
}

function rand(min,max){return min+Math.random()*(max-min)}
function randInt(min,max){return Math.floor(rand(min,max+1))}
function pick(list){return list[Math.floor(Math.random()*list.length)]}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function makeId(prefix){return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`}

function marketValueFor(stats,age){
  const avg=STAT_KEYS.reduce((sum,key)=>sum+stats[key],0)/STAT_KEYS.length;
  const primeFactor=age>=24&&age<=30?1.15:(age<22||age>33?0.85:1);
  const baseValue=Math.round((avg*avg*4*primeFactor)/50)*50;
  return Math.round((baseValue*MARKET_PRICE_MULTIPLIER)/50)*50;
}

function makeRealRider(entry){
  const stats={...entry.stats};
  return {
    id:entry.id, name:entry.name, age:entry.age, teamId:entry.teamId,
    marketValue:marketValueFor(stats,entry.age), stats,
    status:'active', statusUntil:0, fatigue:0, gelsRemaining:GELS_PER_RACE, specialism:entry.specialism
  };
}

function ridersExcluding(excludeIds){
  const exclude=excludeIds instanceof Set?excludeIds:new Set(excludeIds||[]);
  return RIDER_CATALOG.filter((entry) => !entry.retired&&!exclude.has(entry.id));
}

function racePoolFor(raceId){
  const parsed=parseStageRaceId(raceId);
  return RACE_POOLS.get(parsed?.tourId||raceId)||[];
}

function starterRiders(count,excludeIds){
  const pool=[...ridersExcluding(excludeIds)].sort(() => Math.random()-0.5);
  return pool.slice(0,count).map(makeRealRider);
}

function scoutCandidates(excludeIds){
  const source=ridersExcluding(excludeIds);
  const picks=[];
  const used=new Set();
  while(picks.length<SCOUT_MARKET_SIZE&&used.size<source.length){
    const entry=pick(source);
    if(used.has(entry.id))continue;
    used.add(entry.id);
    picks.push(makeRealRider(entry));
  }
  return picks;
}

function defaultShop(){return {bikes:0,nutrition:0,trainers:0,medical:0}}

function describeShopEffects(shop){
  const injuryReduction=Math.min(5,Math.floor(shop.medical*0.6));
  const crashChancePct=Math.round(clamp(0.30-shop.medical*0.06,0.04,0.30)*100);
  const illnessChancePct=Math.round(clamp(0.06-shop.medical*0.01,0.01,0.06)*100);
  return {
    bikes:shop.bikes?`+${Math.round(shop.bikes*0.02*1000)/10}% op de personalMultiplier van elke renner`:'Geen bonus',
    nutrition:shop.nutrition?`-${shop.nutrition*8}% impact vermoeidheid · +${shop.nutrition*3} sneller herstel`:'Geen bonus',
    trainers:shop.trainers?`+${shop.trainers*3} op de 3 beste statistieken per renner`:'Geen bonus',
    medical:shop.medical?`-${injuryReduction} races uitvaltijd · ${crashChancePct}% valkans · ${illnessChancePct}% ziektekans`:'Geen bonus'
  };
}
function defaultCareer(){return {victories:0,podiums:0,monumentsWon:0,grandToursWon:0,gtStagesWon:0,prizeMoney:0,racesEntered:0}}

function sanitizeRider(rider){
  const catalog=RIDER_BY_ID.get(String(rider?.id))||RIDER_CATALOG.find((entry) => entry.name===rider?.name);
  const stats={};
  for(const key of STAT_KEYS) stats[key]=clamp(Number(catalog?.stats?.[key]??rider?.stats?.[key])||40,1,99);
  return {
    id:String(catalog?.id||rider?.id||makeId('r')), name:String(catalog?.name||rider?.name||'Onbekende renner'), age:Number(catalog?.age??rider?.age)||24,
    teamId:catalog?.teamId||(rider?.teamId?String(rider.teamId):null),
    marketValue:Math.max(0,Number(rider?.marketValue)||marketValueFor(stats,Number(rider?.age)||24)),
    stats, status:['active','injured','sick'].includes(rider?.status)?rider.status:'active',
    statusUntil:Number(rider?.statusUntil)||0, fatigue:clamp(Number(rider?.fatigue)||0,0,100),
    gelsRemaining:clamp(Number.isFinite(Number(rider?.gelsRemaining))?Number(rider.gelsRemaining):GELS_PER_RACE,0,GELS_PER_RACE),
    specialism:catalog?.specialism||(SPECIALISMS[rider?.specialism]?rider.specialism:'allrounder')
  };
}

function hydrateTeam(saved){
  const riders=Array.isArray(saved?.riders)&&saved.riders.length?saved.riders.map(sanitizeRider):starterRiders(STARTER_RIDERS);
  return {
    wallet:Math.max(0,Number(saved?.wallet??STARTING_WALLET)),
    riders,
    shop:{...defaultShop(),...(saved?.shop||{})},
    career:{...defaultCareer(),...(saved?.career||{})},
    raceCount:Math.max(0,Number(saved?.raceCount)||0)
  };
}

function defaultTeam(isNpc){
  return {
    wallet:STARTING_WALLET, riders:starterRiders(isNpc?0:STARTER_RIDERS), shop:defaultShop(),
    career:defaultCareer(), raceCount:0
  };
}

function humanPlayers(game){return game.players.filter((player) => !player.isNpc)}
function ownedRiderIds(game,exceptPlayerId=null){
  return new Set(humanPlayers(game).filter((player) => player.id!==exceptPlayerId)
    .flatMap((player) => player.team.riders.map((rider) => rider.id)));
}
function refreshScoutMarkets(game){
  const owned=ownedRiderIds(game);
  for(const player of humanPlayers(game)){
    const exclude=new Set([...owned,...player.team.riders.map((rider) => rider.id)]);
    game.scoutMarkets[player.id]=scoutCandidates(exclude);
  }
}
function reconcileHumanOwnership(game){
  const claimed=new Set();
  for(const player of humanPlayers(game)){
    player.team.riders=player.team.riders.filter((rider) => {
      if(claimed.has(rider.id))return false;
      claimed.add(rider.id);
      return true;
    });
  }
}

function weightedStat(stats,terrain){
  let score=0,weightSum=0;
  for(const key of Object.keys(terrain)){score+=stats[key]*terrain[key];weightSum+=terrain[key]}
  return weightSum?score/weightSum:0;
}

function refreshRiderStatus(team){
  for(const rider of team.riders){
    if(rider.status!=='active'&&team.raceCount>=rider.statusUntil){rider.status='active';rider.statusUntil=0}
  }
}

function recoverTeam(team){
  const recovery=8+team.shop.nutrition*3+team.shop.medical;
  const illnessChance=clamp(0.06-team.shop.medical*0.01,0.01,0.06);
  for(const rider of team.riders){
    if(rider.status!=='active')continue;
    rider.fatigue=clamp(rider.fatigue-recovery,0,100);
    if(Math.random()<illnessChance) applyUnavailable(rider,team,randInt(1,3),'sick');
  }
}

function enterClubPhase(game,{recover=false}={}){
  game.phase='club';
  game.race=null;
  for(const player of raceActors(game)){
    refreshRiderStatus(player.team);
    if(recover) recoverTeam(player.team);
    if(!player.isNpc) game.scoutMarkets[player.id]=scoutCandidates(ownedRiderIds(game));
  }
}

function scoreRiderForRace(rider,catalogRace,team){
  let score=weightedStat(trainerBoostedStats(rider.stats,team.shop.trainers),catalogRace.terrain);
  score+=team.shop.bikes*1.4;
  score-=rider.fatigue*0.3;
  return score;
}

function availableRiders(team){
  return team.riders.filter((rider) => rider.status==='active');
}

function startStageLineup(game,raceId){
  game.phase='lineup';
  const catalogRace=currentCatalogRace(raceId);
  game.race={raceId, lineups:{}, npcTimers:{}, startedAt:Date.now(), segments:buildSegmentPlan(catalogRace)};
  for(const player of game.players) for(const rider of player.team.riders) rider.gelsRemaining=GELS_PER_RACE;
  for(const candidate of game.players) if(candidate.isNpc) autoLineup(game,candidate);
}

function autoLineup(game,player){
  const catalogRace=currentCatalogRace(game.race.raceId);
  const ranked=availableRiders(player.team).sort((a,b) => scoreRiderForRace(b,catalogRace,player.team)-scoreRiderForRace(a,catalogRace,player.team));
  game.race.lineups[player.id]=ranked.slice(0,SQUAD_SIZE).map((rider) => rider.id);
}

// Eenvoudige NPC-tactiekkeuze: herstel bij hoge vermoeidheid, val anders aan op terrein
// dat bij de renner past, gebruik af en toe een gel als de vermoeidheid oploopt.
function autoTacticsFor(player,prog,segment){
  const tactics={},gels={};
  for(const riderId of activeRiderIds(prog)){
    const rider=player.team.riders.find((candidate) => candidate.id===riderId);
    if(!rider)continue;
    if(rider.fatigue>=BONK_THRESHOLD)tactics[riderId]='recover';
    else if(rider.fatigue>70)tactics[riderId]=Math.random()<0.5?'recover':'follow';
    else if(terrainFactorFor(riderRole(rider),segment.terrainType)>0&&Math.random()<0.5)tactics[riderId]='attack';
    else tactics[riderId]='follow';
    if(rider.fatigue>60&&rider.gelsRemaining>0&&Math.random()<0.6)gels[riderId]=true;
  }
  return {tactics,gels};
}

function applyUnavailable(rider,team,races,status){
  rider.status=status;
  rider.statusUntil=team.raceCount+races;
}

function trainerBoostedStats(stats,trainers){
  if(!trainers)return stats;
  const boosted={...stats};
  const topKeys=STAT_KEYS.slice().sort((a,b) => stats[b]-stats[a]).slice(0,3);
  for(const key of topKeys) boosted[key]=clamp(boosted[key]+trainers*3,1,99);
  return boosted;
}

const SEGMENT_STAT_WEIGHTS = {
  flat:{flat:0.5,sprint:0.35,stamina:0.15},
  hills:{mountain:0.35,flat:0.35,stamina:0.3},
  mountain:{mountain:0.65,stamina:0.35},
  cobbles:{cobbles:0.6,flat:0.15,stamina:0.25},
  timeTrial:{timeTrial:0.8,stamina:0.2}
};

// Extra bijdrage van renner-statistieken en de Trainers-upgrade, bovenop de rol-gebaseerde
// terreinbonus uit de spec — houdt scouting/training relevant zonder de kernformule te breken.
function statFactorFor(rider,team,segment){
  const trained=trainerBoostedStats(rider.stats,team.shop.trainers);
  const weighted=weightedStat(trained,SEGMENT_STAT_WEIGHTS[segment.terrainType]||SEGMENT_STAT_WEIGHTS.flat);
  return clamp((weighted-50)/250,-0.2,0.3);
}

function startRacing(game){
  const humanEntryIds=humanPlayers(game).flatMap((player) => game.race.lineups[player.id]||[]);
  const humanEntrySet=new Set(humanEntryIds);
  if(humanEntrySet.size!==humanEntryIds.length)throw new Error('Een renner kan maar één keer aan een koers deelnemen.');
  const npcCount=RACE_FIELD_SIZE-humanEntryIds.length;
  if(npcCount<0)throw new Error(`Een koers kan maximaal ${RACE_FIELD_SIZE} renners bevatten.`);
  const owned=ownedRiderIds(game);
  const npcEntries=racePoolFor(game.race.raceId).filter((riderId) => !owned.has(riderId)&&!humanEntrySet.has(riderId)).slice(0,npcCount);
  if(npcEntries.length!==npcCount)throw new Error('De racepool bevat onvoldoende beschikbare NPC-renners voor een veld van 30.');
  game.race.npcPlayer={
    id:RACE_NPC_ID,name:'NPC-peloton',isNpc:true,
    team:{riders:npcEntries.map((riderId) => makeRealRider(RIDER_BY_ID.get(riderId))),shop:defaultShop(),raceCount:0}
  };
  game.race.lineups[RACE_NPC_ID]=npcEntries;
  game.phase='racing';
  game.race.npcTimers={};
  game.race.segmentIndex=0;
  game.race.progress={};
  for(const player of raceActors(game)){
    const riderIds=game.race.lineups[player.id]||[];
    const riders={};
    for(const riderId of riderIds) riders[riderId]={pr:0,timeAccumulated:0,pointsGreen:0,pointsPolka:0,segments:[],dnf:false};
    game.race.progress[player.id]={pendingRoll:null, confirmed:false, riders};
  }
}

function raceActors(game){return game.race?.npcPlayer?[...game.players,game.race.npcPlayer]:game.players}

function maybeStartRacing(game){
  if(allSubmitted(game)){startRacing(game);return true}
  return false;
}

function activeRiderIds(prog){
  return Object.keys(prog.riders).filter((riderId) => !prog.riders[riderId].dnf);
}

function playerAwaitsConfirmation(prog){
  return activeRiderIds(prog).length>0&&!prog.confirmed;
}

// Kanshalvering op een val bij de slechtst mogelijke worp (1 op een 1-10 dobbelsteen),
// net als voorheen verminderd door de Medische Staf-upgrade.
function maybeCrash(rider,team,roll){
  if(roll!==1)return false;
  const crashChance=clamp(0.30-team.shop.medical*0.06,0.04,0.30);
  if(Math.random()>=crashChance)return false;
  const duration=Math.max(1,randInt(3,6)-Math.floor(team.shop.medical*0.6));
  applyUnavailable(rider,team,duration,'injured');
  return true;
}

function resolveSegmentFor(game,player){
  const race=game.race;
  const prog=race.progress[player.id];
  if(!prog||prog.confirmed||!prog.pendingRoll)return;
  const {roll,tactics,gels}=prog.pendingRoll;
  const activeIds=activeRiderIds(prog);
  const riders=activeIds.map((riderId) => player.team.riders.find((candidate) => candidate.id===riderId)).filter(Boolean);
  const segment=race.segments[race.segmentIndex];
  const steps=calculateSegmentStep(riders,tactics,gels,segment,roll,player.team);
  for(const rider of riders){
    const state=prog.riders[rider.id];
    const step=steps[rider.id];
    if(!state||!step)continue;
    if(maybeCrash(rider,player.team,roll)){
      state.dnf=true;
      state.segments.push({n:race.segmentIndex+1, roll, tactic:step.tactic, multiplier:step.personalMultiplier, outcome:'valt'});
      continue;
    }
    const score=scoreFromMultiplier(step.personalMultiplier);
    state.pr+=score;
    state.segments.push({n:race.segmentIndex+1, roll, tactic:step.tactic, multiplier:step.personalMultiplier, outcome:score>=6?'topdag':score<=-4?'pech':'normaal'});
  }
  prog.pendingRoll=null;
  prog.confirmed=true;
}

// Sluit een segment af zodra iedereen bevestigd heeft: berekent het veldgemiddelde
// (voor het tijdsverschil in het algemeen klassement) en kent tussensprint-/bergpunten toe.
function closeSegment(game){
  const race=game.race;
  const segment=race.segments[race.segmentIndex];
  const fieldMultipliers=[];
  const segmentResults=[];
  for(const player of raceActors(game)){
    const prog=race.progress[player.id];
    if(!prog)continue;
    for(const riderId of Object.keys(prog.riders)){
      const state=prog.riders[riderId];
      const entrySegment=state.segments.find((candidate) => candidate.n===race.segmentIndex+1);
      if(!entrySegment||entrySegment.outcome==='valt')continue;
      fieldMultipliers.push(entrySegment.multiplier);
      segmentResults.push({playerId:player.id, riderId, state, multiplier:entrySegment.multiplier});
    }
  }
  if(!segmentResults.length)return;
  const fieldAverage=fieldMultipliers.reduce((sum,value) => sum+value,0)/fieldMultipliers.length;
  for(const result of segmentResults) result.state.timeAccumulated+=timeDeltaFromMultiplier(result.multiplier,fieldAverage);

  if(game.grandTour&&segment.hasIntermediateSprint){
    segmentResults.slice().sort((a,b) => b.multiplier-a.multiplier).slice(0,SPRINT_POINTS.length)
      .forEach((result,index) => {result.state.pointsGreen+=SPRINT_POINTS[index]});
  }
  if(game.grandTour&&segment.mountainCategory>0){
    const points=MOUNTAIN_POINTS[segment.mountainCategory]||0;
    if(points)segmentResults.slice().sort((a,b) => b.multiplier-a.multiplier).slice(0,3)
      .forEach((result,index) => {result.state.pointsPolka+=Math.round(points/(index+1))});
  }
}

function maybeAdvanceSegment(game){
  if(game.phase!=='racing'||!game.race)return false;
  const race=game.race;
  const stillWaiting=raceActors(game).some((player) => playerAwaitsConfirmation(race.progress[player.id]||{riders:{},confirmed:true}));
  if(stillWaiting)return false;
  closeSegment(game);
  race.segmentIndex+=1;
  const finished=race.segmentIndex>=SEGMENTS_PER_RACE||raceActors(game).every((player) => activeRiderIds(race.progress[player.id]).length===0);
  if(finished){
    for(const player of raceActors(game)){
      const prog=race.progress[player.id];
      if(!prog)continue;
      for(const riderId of Object.keys(prog.riders)){
        if(prog.riders[riderId].dnf)continue;
        const rider=player.team.riders.find((candidate) => candidate.id===riderId);
        if(rider)rider.fatigue=clamp(rider.fatigue+Math.max(6,22-player.team.shop.nutrition*3),0,100);
      }
    }
    finalizeRace(game);
    return true;
  }
  for(const player of raceActors(game)){
    const prog=race.progress[player.id];
    if(prog)prog.confirmed=false;
  }
  return true;
}

function finalizeRace(game){
  const race=game.race;
  const catalogRace=currentCatalogRace(race.raceId);
  for(const player of game.players) player.team.raceCount+=1;

  const entries=[];
  for(const player of raceActors(game)){
    const prog=race.progress[player.id];
    if(!prog)continue;
    for(const riderId of Object.keys(prog.riders)){
      const rider=player.team.riders.find((candidate) => candidate.id===riderId);
      const state=prog.riders[riderId];
      if(!rider||!state)continue;
      const event=state.dnf?'valt'
        :state.segments.some((segment) => segment.outcome==='topdag')?'topdag'
        :state.segments.some((segment) => segment.outcome==='pech')?'pech'
        :'normaal';
      entries.push({
        playerId:player.id, playerName:player.name, riderId, riderName:rider.name, rider,
        pr:Math.round(state.pr*10)/10, timeAccumulated:state.timeAccumulated, pointsGreen:state.pointsGreen, pointsPolka:state.pointsPolka,
        event, dnf:state.dnf, segments:state.segments
      });
    }
  }

  const finishers=entries.filter((entry) => !entry.dnf).sort((a,b) => b.pr-a.pr);
  finishers.forEach((entry,index) => {entry.place=index+1});
  const dnfs=entries.filter((entry) => entry.dnf);

  if(game.grandTour&&catalogRace.category==='grand_tour'){
    finalizeGrandTourStage(game,race,catalogRace,finishers,dnfs);
  } else {
    finalizeStandaloneRace(game,race,catalogRace,finishers,dnfs);
  }
}

function finalizeStandaloneRace(game,race,catalogRace,finishers,dnfs){
  const payouts=[];
  for(const player of game.players){
    let prizeWon=0,best=null;
    for(const entry of finishers){
      if(entry.playerId!==player.id)continue;
      if(!best||entry.place<best.place)best=entry;
      if(entry.place<=PAYOUT_TABLE.length){
        entry.prize=Math.round(catalogRace.basePrize*PAYOUT_TABLE[entry.place-1]);
        prizeWon+=entry.prize;
      } else entry.prize=0;
    }
    if(best&&best.place===1)bumpMarketValue(best.rider,0.08);
    else if(best&&best.place<=3)bumpMarketValue(best.rider,0.03);
    player.team.wallet+=prizeWon;
    if(best&&best.place===1){
      player.team.career.victories+=1;
      if(catalogRace.category==='monument')player.team.career.monumentsWon+=1;
    }
    if(best&&best.place<=3)player.team.career.podiums+=1;
    if((race.lineups[player.id]||[]).length)player.team.career.racesEntered+=1;
    player.team.career.prizeMoney+=prizeWon;
    payouts.push({playerId:player.id, prizeWon, bestPlace:best?best.place:null});
  }

  game.lastResult={
    type:'one_day', raceId:race.raceId, raceName:catalogRace.name, category:catalogRace.category,
    classification:finishers.map((entry) => ({place:entry.place, playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName, event:entry.event, segments:entry.segments, prize:entry.prize||0})),
    dnfs:dnfs.map((entry) => ({playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName, event:entry.event, segments:entry.segments})),
    payouts
  };

  game.log.unshift(finishers.length?`${catalogRace.name}: ${finishers[0].riderName} (${finishers[0].playerName}) wint.`:`${catalogRace.name}: geen enkele renner haalt de finish.`);

  game.pendingRoundRecord={
    startedAt:race.startedAt||Date.now(), endedAt:Date.now(),
    players:game.players.map((player) => {
      const summary=payouts.find((entry) => entry.playerId===player.id);
      return {
        playerId:player.id,
        placement:summary?.bestPlace??null,
        score:summary?.prizeWon??0,
        won:summary?.bestPlace===1,
        outcome:summary?.bestPlace?`#${summary.bestPlace}`:'Geen resultaat'
      };
    })
  };

  game.phase='result';
  game.race=null;
}

// Berekent alle vijf klassementen (geel/groen/bolletjes/wit/ploegen) uit de gc-boekhouding
// van een Grote Ronde. GC/wit/ploegen sorteren oplopend op tijd (lager = sneller/beter).
function classificationStandings(gc){
  const entries=Object.values(gc);
  const rank=(list,key,ascending) => list.slice().sort((a,b) => ascending?a[key]-b[key]:b[key]-a[key])
    .map((entry,index) => ({place:index+1, playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName, value:entry[key], stageWins:entry.stageWins}));
  const byPlayer=new Map();
  for(const entry of entries){
    if(!byPlayer.has(entry.playerId))byPlayer.set(entry.playerId,{playerId:entry.playerId, playerName:entry.playerName, riders:[]});
    byPlayer.get(entry.playerId).riders.push(entry);
  }
  const team=[...byPlayer.values()].map((squad) => {
    const top=squad.riders.slice().sort((a,b) => a.timeAccumulated-b.timeAccumulated).slice(0,3);
    return {playerId:squad.playerId, playerName:squad.playerName, value:top.reduce((sum,entry) => sum+entry.timeAccumulated,0)};
  }).sort((a,b) => a.value-b.value).map((entry,index) => ({...entry,place:index+1}));
  return {
    gc:rank(entries,'timeAccumulated',true),
    green:rank(entries,'pointsGreen',false),
    polka:rank(entries,'pointsPolka',false),
    youth:rank(entries.filter((entry) => entry.age<=25),'timeAccumulated',true),
    team
  };
}

function finalizeGrandTourStage(game,race,catalogRace,finishers,dnfs){
  const tour=GRAND_TOUR_BY_ID.get(catalogRace.tourId);
  const stageNumber=catalogRace.stageNumber;

  const payouts=[];
  for(const player of game.players){
    let prizeWon=0,best=null;
    for(const entry of finishers){
      if(entry.playerId!==player.id)continue;
      if(!best||entry.place<best.place)best=entry;
      if(entry.place<=PAYOUT_TABLE.length){
        entry.prize=Math.round(catalogRace.basePrize*PAYOUT_TABLE[entry.place-1]);
        prizeWon+=entry.prize;
      } else entry.prize=0;
    }
    if(best&&best.place===1)bumpMarketValue(best.rider,0.05);
    player.team.wallet+=prizeWon;
    player.team.career.prizeMoney+=prizeWon;
    if(best&&best.place===1)player.team.career.gtStagesWon+=1;
    payouts.push({playerId:player.id, prizeWon, bestPlace:best?best.place:null});
  }

  for(const entry of finishers){
    const key=`${entry.playerId}:${entry.riderId}`;
    if(!game.grandTour.gc[key]){
      game.grandTour.gc[key]={
        playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName,
        rider:entry.rider, age:entry.rider.age, totalPr:0, stageWins:0, timeAccumulated:0, pointsGreen:0, pointsPolka:0
      };
    }
    const gc=game.grandTour.gc[key];
    gc.totalPr+=entry.pr;
    gc.timeAccumulated+=entry.timeAccumulated;
    gc.pointsGreen+=entry.pointsGreen;
    gc.pointsPolka+=entry.pointsPolka;
    if(entry.place===1)gc.stageWins+=1;
  }

  game.grandTour.stageLog.push({
    stageNumber, type:catalogRace.stageType, typeLabel:STAGE_TYPE_LABELS[catalogRace.stageType],
    winner:finishers[0]?{riderName:finishers[0].riderName,playerName:finishers[0].playerName}:null,
    dnfCount:dnfs.length
  });

  game.log.unshift(`${tour.name} rit ${stageNumber}/${tour.stages}: ${finishers.length?`${finishers[0].riderName} (${finishers[0].playerName}) wint de rit.`:'geen enkele renner haalt de finish.'}`);

  if(stageNumber>=tour.stages){
    finalizeGrandTourOverall(game,tour);
    return;
  }

  game.lastResult={
    type:'grand_tour_stage', tourId:tour.id, raceName:catalogRace.name, stageNumber, totalStages:tour.stages,
    classification:finishers.map((entry) => ({place:entry.place, playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName, event:entry.event, segments:entry.segments, prize:entry.prize||0})),
    dnfs:dnfs.map((entry) => ({playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName, event:entry.event, segments:entry.segments})),
    classifications:classificationStandings(game.grandTour.gc)
  };
  game.phase='stageResult';
  game.race=null;
}

function finalizeGrandTourOverall(game,tour){
  const gcEntries=Object.values(game.grandTour.gc).sort((a,b) => a.timeAccumulated-b.timeAccumulated);
  gcEntries.forEach((entry,index) => {entry.gcPlace=index+1});

  const payouts=[];
  for(const player of game.players){
    let gcPrize=0,best=null;
    for(const entry of gcEntries){
      if(entry.playerId!==player.id)continue;
      if(!best||entry.gcPlace<best.gcPlace)best=entry;
      if(entry.gcPlace<=PAYOUT_TABLE.length)gcPrize+=Math.round(tour.overallPrize*PAYOUT_TABLE[entry.gcPlace-1]);
    }
    if(best&&best.gcPlace===1)bumpMarketValue(best.rider,0.15);
    else if(best&&best.gcPlace<=3)bumpMarketValue(best.rider,0.06);
    player.team.wallet+=gcPrize;
    player.team.career.prizeMoney+=gcPrize;
    if(best&&best.gcPlace===1){
      player.team.career.victories+=1;
      player.team.career.grandToursWon+=1;
    }
    if(best&&best.gcPlace<=3)player.team.career.podiums+=1;
    if(gcEntries.some((entry) => entry.playerId===player.id))player.team.career.racesEntered+=1;
    payouts.push({playerId:player.id, gcPrize, gcPlace:best?best.gcPlace:null});
  }

  game.lastResult={
    type:'grand_tour_final', tourId:tour.id, raceName:tour.name, totalStages:tour.stages,
    stages:game.grandTour.stageLog,
    gc:gcEntries.slice(0,10).map((entry) => ({place:entry.gcPlace, playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName, stageWins:entry.stageWins})),
    classifications:classificationStandings(game.grandTour.gc),
    payouts
  };

  game.log.unshift(`${tour.name}: ${gcEntries.length?`${gcEntries[0].riderName} (${gcEntries[0].playerName}) wint het eindklassement.`:'niemand haalt de eindstreep.'}`);

  game.pendingRoundRecord={
    startedAt:game.grandTour.startedAt||Date.now(), endedAt:Date.now(),
    players:game.players.map((player) => {
      const summary=payouts.find((entry) => entry.playerId===player.id);
      return {
        playerId:player.id,
        placement:summary?.gcPlace??null,
        score:summary?.gcPrize??0,
        won:summary?.gcPlace===1,
        outcome:summary?.gcPlace?`GC #${summary.gcPlace}`:'Geen resultaat'
      };
    })
  };

  game.phase='result';
  game.race=null;
  game.grandTour=null;
}

function bumpMarketValue(rider,factor){
  rider.marketValue=Math.round(rider.marketValue*(1+factor)/50)*50;
}

function allSubmitted(game){
  return Boolean(game.race)&&game.players.every((player) => game.race.lineups[player.id]!==undefined);
}

function createGame(roomPlayers){
  const game={
    gameKey:meta.key,
    phase:'club',
    hostId:roomPlayers.find((player) => !player.isNpc)?.id||roomPlayers[0]?.id,
    players:roomPlayers.map((player) => ({
      id:player.id, name:player.name, isNpc:player.isNpc,
      team:player.cycclubTeam?hydrateTeam(player.cycclubTeam):defaultTeam(player.isNpc)
    })),
    race:null, grandTour:null, lastResult:null, log:[], scoutMarkets:{}, pendingRoundRecord:null
  };
  reconcileHumanOwnership(game);
  refreshScoutMarkets(game);
  return game;
}

function findPlayer(game,playerId){
  const player=game.players.find((candidate) => candidate.id===playerId);
  if(!player)throw new Error('Speler niet gevonden.');
  return player;
}

function handleAction(game,playerId,action,payload={}){
  const player=findPlayer(game,playerId);

  if(action==='buyRider'){
    if(game.phase!=='club')throw new Error('Dit kan alleen in de club.');
    const market=game.scoutMarkets[playerId]||[];
    const index=market.findIndex((candidate) => candidate.id===payload.candidateId);
    if(index<0)throw new Error('Deze renner is niet meer beschikbaar.');
    if(player.team.riders.length>=MAX_RIDERS)throw new Error(`Je ploeg heeft maximaal ${MAX_RIDERS} renners.`);
    const candidate=market[index];
    if(ownedRiderIds(game,playerId).has(candidate.id))throw new Error('Deze renner is al eigendom van een andere ploeg.');
    if(player.team.wallet<candidate.marketValue)throw new Error('Onvoldoende budget.');
    player.team.wallet-=candidate.marketValue;
    player.team.riders.push(candidate);
    refreshScoutMarkets(game);
    return;
  }

  if(action==='refreshScoutMarket'){
    if(game.phase!=='club')throw new Error('Dit kan alleen in de club.');
    if(player.isNpc)throw new Error('NPC-ploegen scouten niet zelf.');
    game.scoutMarkets[playerId]=scoutCandidates(ownedRiderIds(game));
    return;
  }

  if(action==='sellRider'){
    if(game.phase!=='club')throw new Error('Dit kan alleen in de club.');
    const rider=player.team.riders.find((candidate) => candidate.id===payload.riderId);
    if(!rider)throw new Error('Renner niet gevonden.');
    player.team.riders=player.team.riders.filter((candidate) => candidate.id!==rider.id);
    player.team.wallet+=Math.round(rider.marketValue*SELL_RATE/50)*50;
    refreshScoutMarkets(game);
    return;
  }

  if(action==='buyUpgrade'){
    if(game.phase!=='club')throw new Error('Dit kan alleen in de club.');
    if(!SHOP_KEYS.includes(payload.category))throw new Error('Onbekende upgrade.');
    const level=player.team.shop[payload.category];
    if(level>=SHOP_MAX_LEVEL)throw new Error('Deze upgrade zit al op het maximum.');
    const cost=SHOP_COSTS[level];
    if(player.team.wallet<cost)throw new Error('Onvoldoende budget.');
    player.team.wallet-=cost;
    player.team.shop[payload.category]+=1;
    return;
  }

  if(action==='restRider'){
    if(game.phase!=='club')throw new Error('Dit kan alleen in de club.');
    const rider=player.team.riders.find((candidate) => candidate.id===payload.riderId);
    if(!rider||rider.status!=='active')throw new Error('Deze renner kan nu niet rusten.');
    if(player.team.wallet<REST_COST)throw new Error('Onvoldoende budget.');
    player.team.wallet-=REST_COST;
    rider.fatigue=clamp(rider.fatigue-REST_RECOVERY,0,100);
    return;
  }

  if(action==='resetTeam'){
    if(game.phase!=='club')throw new Error('Dit kan alleen in de club.');
    player.team=defaultTeam(player.isNpc);
    reconcileHumanOwnership(game);
    refreshScoutMarkets(game);
    return;
  }

  if(action==='selectRace'){
    if(game.phase!=='club')throw new Error('Er loopt al een koers.');
    if(playerId!==game.hostId)throw new Error('Alleen de host kiest een koers.');
    const oneDayRace=RACE_BY_ID.get(payload.raceId);
    const tour=GRAND_TOUR_BY_ID.get(payload.raceId);
    if(!oneDayRace&&!tour)throw new Error('Onbekende koers.');
    if(tour){
      game.grandTour={tourId:tour.id, stageNumber:1, gc:{}, stageLog:[], startedAt:Date.now()};
      startStageLineup(game,buildStageRaceId(tour.id,1));
    } else {
      game.grandTour=null;
      startStageLineup(game,oneDayRace.id);
    }
    return;
  }

  if(action==='nextStage'){
    if(game.phase!=='stageResult')throw new Error('Er is geen volgende rit klaar.');
    if(playerId!==game.hostId)throw new Error('Alleen de host start de volgende rit.');
    if(!game.grandTour)throw new Error('Er loopt geen Grote Ronde.');
    game.grandTour.stageNumber+=1;
    startStageLineup(game,buildStageRaceId(game.grandTour.tourId,game.grandTour.stageNumber));
    return;
  }

  if(action==='submitLineup'){
    if(game.phase!=='lineup'||!game.race)throw new Error('Er is geen koers om je op te geven.');
    const riderIds=Array.isArray(payload.riderIds)?[...new Set(payload.riderIds)].slice(0,SQUAD_SIZE):[];
    for(const riderId of riderIds){
      const rider=player.team.riders.find((candidate) => candidate.id===riderId);
      if(!rider||rider.status!=='active')throw new Error('Selecteer alleen beschikbare renners.');
    }
    game.race.lineups[playerId]=riderIds;
    maybeStartRacing(game);
    return;
  }

  if(action==='rollSegment'){
    if(game.phase!=='racing'||!game.race)throw new Error('Er is geen actieve rit.');
    const prog=game.race.progress[playerId];
    if(!prog||!playerAwaitsConfirmation(prog))throw new Error('Er valt voor jou niets te rollen in dit segment.');
    if(prog.pendingRoll)throw new Error('Verwerk eerst je vorige worp.');
    const activeIds=activeRiderIds(prog);
    const tactics=payload.tactics&&typeof payload.tactics==='object'?payload.tactics:{};
    const gels=payload.gels&&typeof payload.gels==='object'?payload.gels:{};
    for(const riderId of activeIds){
      if(!RIDER_TACTICS.includes(tactics[riderId]))throw new Error('Ken elke renner een tactiek toe voor je rolt.');
    }
    prog.pendingRoll={roll:randInt(1,10), tactics, gels};
    resolveSegmentFor(game,player);
    maybeAdvanceSegment(game);
    return;
  }

  if(action==='cancelRace'){
    if(!['lineup','racing','stageResult'].includes(game.phase))throw new Error('Er is geen koers om te annuleren.');
    if(playerId!==game.hostId)throw new Error('Alleen de host kan annuleren.');
    game.phase='club';
    game.race=null;
    game.grandTour=null;
    return;
  }

  if(action==='backToClub'){
    if(game.phase!=='result')throw new Error('Er is geen koersresultaat om te sluiten.');
    enterClubPhase(game,{recover:true});
    return;
  }

  throw new Error('Onbekende actie.');
}

function tick(game,now=Date.now()){
  if(!game.race)return false;
  let changed=false;

  if(game.phase==='lineup'){
    for(const player of game.players){
      if(!player.isNpc||game.race.lineups[player.id]!==undefined)continue;
      if(!game.race.npcTimers[player.id])game.race.npcTimers[player.id]=now+NPC_DELAY;
      if(now<game.race.npcTimers[player.id])continue;
      autoLineup(game,player);
      changed=true;
    }
    if(changed&&maybeStartRacing(game))changed=true;
    return changed;
  }

  if(game.phase==='racing'){
    const segment=game.race.segments[game.race.segmentIndex];
    for(const player of raceActors(game)){
      if(!player.isNpc)continue;
      const prog=game.race.progress[player.id];
      if(!prog||!playerAwaitsConfirmation(prog))continue;
      if(!game.race.npcTimers[player.id])game.race.npcTimers[player.id]=now+NPC_DELAY;
      if(now<game.race.npcTimers[player.id])continue;
      const {tactics,gels}=autoTacticsFor(player,prog,segment);
      prog.pendingRoll={roll:randInt(1,10), tactics, gels};
      resolveSegmentFor(game,player);
      game.race.npcTimers[player.id]=now+NPC_DELAY;
      changed=true;
    }
    if(maybeAdvanceSegment(game))changed=true;
    return changed;
  }

  return false;
}

function serialize(game,requesterId,connected){
  const catalogRace=game.race?currentCatalogRace(game.race.raceId):null;
  return {
    kind:meta.key, gameOver:false, phase:game.phase, hostId:game.hostId, squadSize:SQUAD_SIZE, maxRiders:MAX_RIDERS,
    raceCatalog:[
      ...RACE_CATALOG.map((race) => ({id:race.id, name:race.name, category:race.category, difficulty:race.difficulty, basePrize:race.basePrize, terrain:race.terrain})),
      ...GRAND_TOUR_CATALOG.map((tour) => ({id:tour.id, name:tour.name, category:tour.category, stages:tour.stages, overallPrize:tour.overallPrize, terrain:tour.terrain}))
    ],
    race:game.race?serializeRace(game,requesterId,catalogRace):null,
    grandTour:game.grandTour?serializeGrandTour(game):null,
    lastResult:game.lastResult,
    log:game.log.slice(0,20),
    myScoutMarket:(game.scoutMarkets[requesterId]||[]).map(serializeRider),
    players:game.players.map((player) => ({
      id:player.id, name:player.name, isNpc:player.isNpc, connected:player.isNpc||connected.get(player.id),
      wallet:player.team.wallet, shop:player.team.shop, shopEffects:describeShopEffects(player.team.shop), career:player.team.career,
      riders:player.team.riders.map(serializeRider)
    }))
  };
}

function serializeGrandTour(game){
  const tour=GRAND_TOUR_BY_ID.get(game.grandTour.tourId);
  return {
    tourId:tour?.id, tourName:tour?.name||'', stageNumber:game.grandTour.stageNumber,
    totalStages:tour?.stages||STAGES_PER_GRAND_TOUR,
    classifications:classificationStandings(game.grandTour.gc)
  };
}

function serializeRace(game,requesterId,catalogRace){
  const base={
    raceId:game.race.raceId, raceName:catalogRace?.name||'', category:catalogRace?.category||'',
    terrain:catalogRace?.terrain||{}, squadSize:SQUAD_SIZE,
    readyIds:Object.keys(game.race.lineups), myLineup:game.race.lineups[requesterId]??null
  };
  if(game.phase!=='racing'||!game.race.progress)return base;
  base.segmentIndex=game.race.segmentIndex;
  base.segment=game.race.segments[game.race.segmentIndex];
  base.tacticLabels=TACTIC_LABELS;
  const situation=buildRaceSituation(game);
  if(game.race.segmentIndex>0)base.leader=situation.leader;
  const myProg=game.race.progress[requesterId];
  const requester=game.players.find((candidate) => candidate.id===requesterId);
  base.myProgress=myProg?{
    awaitingConfirmation:playerAwaitsConfirmation(myProg),
    riders:Object.fromEntries(Object.entries(myProg.riders).map(([riderId,state]) => {
      const rider=requester?.team.riders.find((candidate) => candidate.id===riderId);
      const position=situation.byEntry[`${requesterId}:${riderId}`]||{};
      return [riderId,{
        name:rider?.name||'Renner', role:rider?riderRole(rider):'allrounder',
        fatigue:rider?.fatigue??0, gelsRemaining:rider?.gelsRemaining??0,
        pr:Math.round(state.pr*10)/10, segments:state.segments, dnf:state.dnf,
        gapToLeader:position.gapToLeader??null, raceGroup:position.raceGroup||null
      }];
    }))
  }:null;
  base.allProgress=game.players.map((player) => {
    const prog=game.race.progress[player.id];
    return {
      playerId:player.id, playerName:player.name, isNpc:player.isNpc,
      awaitingConfirmation:prog?playerAwaitsConfirmation(prog):false
    };
  });
  return base;
}

function serializeRider(rider){
  return {
    id:rider.id, name:rider.name, age:rider.age, team:TEAM_BY_ID.get(rider.teamId)?.name||null,
    marketValue:rider.marketValue, sellValue:Math.round(rider.marketValue*SELL_RATE/50)*50, stats:rider.stats,
    status:rider.status, statusUntil:rider.statusUntil, fatigue:rider.fatigue, gelsRemaining:rider.gelsRemaining,
    specialism:rider.specialism, role:riderRole(rider), available:rider.status==='active'
  };
}

function preparePlayers(players,{db}){
  return players.map((player) => ({...player, cycclubTeam:player.userId?db.getCycClubTeam(player.userId):null}));
}

function afterStateChange(room,{db}){
  const game=room.gameState;
  if(!game)return;
  for(const player of game.players){
    const roomPlayer=room.players.find((candidate) => candidate.id===player.id);
    if(!roomPlayer?.userId)continue;
    db.saveCycClubTeam(roomPlayer.userId,player.team);
  }
  const round=game.pendingRoundRecord;
  if(!round)return;
  game.pendingRoundRecord=null;
  if(room.players.filter((player) => !player.isNpc).length<2)return;
  const resultByPlayer=new Map(round.players.map((result) => [result.playerId,result]));
  db.recordMatch({
    gameKey:meta.key, roomId:room.id, startedAt:round.startedAt, endedAt:round.endedAt,
    players:room.players.map((player) => {
      const result=resultByPlayer.get(player.id)||{};
      return {
        userId:player.userId||null, displayName:player.name, placement:result.placement??null,
        score:result.score??null, won:Boolean(result.won), outcome:result.outcome||null,
        durationMs:Math.max(0,round.endedAt-round.startedAt), moves:null
      };
    })
  });
}

module.exports={
  meta, createGame, handleAction, serialize, tick, preparePlayers, afterStateChange,
  RACE_CATALOG, GRAND_TOUR_CATALOG, RACE_POOLS, RIDER_CATALOG, RIDER_BY_ID, SHOP_COSTS, STAT_KEYS, SQUAD_SIZE, MAX_RIDERS, RACE_FIELD_SIZE, MARKET_PRICE_MULTIPLIER, TEAMS, REAL_RIDERS:RIDER_CATALOG,
  STAGES_PER_GRAND_TOUR, SEGMENTS_PER_RACE, RIDER_TACTICS, TACTIC_LABELS, TACTIC_EFFECTS, GELS_PER_RACE,
  calculateSegmentStep, buildSegmentPlan, raceGroupForGap, buildRaceSituation
};
