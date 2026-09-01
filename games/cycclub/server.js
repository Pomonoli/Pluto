const meta = {
  key:'cycclub', name:'CycClub',
  description:'Bouw een eigen wielerploeg, koop en train renners en race voor prijzengeld en een plek op het leaderboard.',
  minPlayers:1, maxPlayers:6, supportsNpc:true, realtime:false, solo:false
};

const STAT_KEYS = ['flat','mountain','cobbles','timeTrial','sprint','stamina'];
const SHOP_KEYS = ['bikes','nutrition','trainers','medical'];
const SHOP_COSTS = [4000,8500,15000,26000,42000];
const SHOP_MAX_LEVEL = SHOP_COSTS.length;
const STARTING_WALLET = 45000;
const STARTER_RIDERS = 6;
const SCOUT_MARKET_SIZE = 3;
const MAX_RIDERS = 14;
const SQUAD_SIZE = 3;
const REST_COST = 600;
const REST_RECOVERY = 25;
const SELL_RATE = 0.55;
const NPC_DELAY = 900;

const SPECIALISMS = {
  sprinter:['sprint','flat'],
  climber:['mountain','stamina'],
  classics:['cobbles','flat'],
  allrounder:['timeTrial','stamina'],
  puncheur:['mountain','sprint']
};

const FIRST_NAMES = ['Mathieu','Wout','Tadej','Jonas','Remco','Julian','Primoz','Mads','Tom','Fabio','Jasper','Arnaud','Sepp','Michael','Egan','Adam','Simon','Thibaut','Victor','Bart','Dylan','Rémi','Kasper','Filippo','Alberto','Alexander','Stefan','Pieter','Ben','Louis','Yves','Nils','Xander','Gianni','Enric','Joris'];
const LAST_NAMES = ['Van der Poel','Van Aert','Pogačar','Vingegaard','Evenepoel','Alaphilippe','Roglič','Pedersen','Pidcock','Cavendish','Philipsen','Démare','Kuss','Woods','Bernal','Yates','Yates','Pinot','Campenaerts','Lampaert','Groenewegen','Cavagna','Asgreen','Ganna','Bettiol','Kristoff','Küng','Serry','Healy','Meintjes','Lampaert','Politt','Declercq','Vansevenant','Van Gils','Naesen'];

const RACE_CATALOG = [
  {id:'ronde-van-vlaanderen', name:'Ronde van Vlaanderen', category:'monument', basePrize:26000, terrain:{cobbles:0.4,flat:0.2,mountain:0.1,stamina:0.3}},
  {id:'parijs-roubaix', name:'Parijs-Roubaix', category:'monument', basePrize:26000, terrain:{cobbles:0.6,flat:0.15,stamina:0.25}},
  {id:'milaan-sanremo', name:'Milaan-San Remo', category:'monument', basePrize:24000, terrain:{flat:0.4,sprint:0.3,stamina:0.3}},
  {id:'luik-bastenaken-luik', name:'Luik-Bastenaken-Luik', category:'monument', basePrize:24000, terrain:{mountain:0.5,stamina:0.3,flat:0.2}},
  {id:'lombardije', name:'Il Lombardia', category:'monument', basePrize:24000, terrain:{mountain:0.6,stamina:0.4}},
  {id:'e3-saxo-classic', name:'E3 Saxo Classic', category:'classic', basePrize:9000, terrain:{cobbles:0.5,flat:0.3,stamina:0.2}},
  {id:'gent-wevelgem', name:'Gent-Wevelgem', category:'classic', basePrize:9000, terrain:{flat:0.4,cobbles:0.3,sprint:0.3}},
  {id:'dwars-door-vlaanderen', name:'Dwars door Vlaanderen', category:'classic', basePrize:9000, terrain:{cobbles:0.4,flat:0.3,stamina:0.3}},
  {id:'amstel-gold-race', name:'Amstel Gold Race', category:'classic', basePrize:10000, terrain:{mountain:0.5,stamina:0.3,sprint:0.2}},
  {id:'wk-wielrennen', name:'WK Wielrennen — Wegrit', category:'championship', basePrize:15000, terrain:{flat:0.25,mountain:0.3,sprint:0.2,stamina:0.25}},
  {id:'ek-wielrennen', name:'EK Wielrennen — Wegrit', category:'championship', basePrize:11000, terrain:{flat:0.25,mountain:0.3,sprint:0.2,stamina:0.25}},
  {id:'parijs-nice', name:'Parijs-Nice', category:'stage_race', basePrize:12000, terrain:{flat:0.3,mountain:0.3,timeTrial:0.2,stamina:0.2}},
  {id:'dauphine', name:'Critérium du Dauphiné', category:'stage_race', basePrize:12000, terrain:{mountain:0.4,timeTrial:0.2,stamina:0.4}},
  {id:'tour-vlakke-rit', name:'Tour de France — Vlakke Rit', category:'gt_stage', basePrize:22000, terrain:{flat:0.5,sprint:0.4,stamina:0.1}},
  {id:'tour-bergrit', name:'Tour de France — Bergrit', category:'gt_stage', basePrize:22000, terrain:{mountain:0.7,stamina:0.3}},
  {id:'tour-tijdrit', name:'Tour de France — Tijdrit', category:'gt_stage', basePrize:22000, terrain:{timeTrial:0.8,stamina:0.2}},
  {id:'giro-bergrit', name:'Giro d’Italia — Bergrit', category:'gt_stage', basePrize:20000, terrain:{mountain:0.5,stamina:0.5}},
  {id:'vuelta-rit', name:'Vuelta a España — Rit', category:'gt_stage', basePrize:20000, terrain:{mountain:0.5,flat:0.3,stamina:0.2}}
];
const RACE_BY_ID = new Map(RACE_CATALOG.map((race) => [race.id, race]));
const PAYOUT_TABLE = [0.40,0.22,0.14,0.09,0.06,0.04,0.025,0.015,0.01,0.005];

function rand(min,max){return min+Math.random()*(max-min)}
function randInt(min,max){return Math.floor(rand(min,max+1))}
function pick(list){return list[Math.floor(Math.random()*list.length)]}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function makeId(prefix){return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`}

function riderName(){return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`}

function makeStats(specialism){
  const stats={};
  for(const key of STAT_KEYS) stats[key]=randInt(38,58);
  for(const key of SPECIALISMS[specialism]) stats[key]=clamp(stats[key]+randInt(18,32),1,99);
  return stats;
}

function marketValueFor(stats,age){
  const avg=STAT_KEYS.reduce((sum,key)=>sum+stats[key],0)/STAT_KEYS.length;
  const primeFactor=age>=24&&age<=30?1.15:(age<22||age>33?0.85:1);
  return Math.round((avg*avg*3*primeFactor)/50)*50;
}

function makeRider(){
  const specialism=pick(Object.keys(SPECIALISMS));
  const age=randInt(19,36);
  const stats=makeStats(specialism);
  return {
    id:makeId('r'), name:riderName(), age, marketValue:marketValueFor(stats,age),
    stats, status:'active', statusUntil:0, fatigue:0, specialism
  };
}

function starterRiders(){
  return Array.from({length:STARTER_RIDERS},() => makeRider());
}

function scoutCandidates(){
  return Array.from({length:SCOUT_MARKET_SIZE},() => makeRider());
}

function defaultShop(){return {bikes:0,nutrition:0,trainers:0,medical:0}}
function defaultCareer(){return {victories:0,podiums:0,monumentsWon:0,gtStagesWon:0,prizeMoney:0,racesEntered:0}}

function sanitizeRider(rider){
  const stats={};
  for(const key of STAT_KEYS) stats[key]=clamp(Number(rider?.stats?.[key])||40,1,99);
  return {
    id:String(rider?.id||makeId('r')), name:String(rider?.name||riderName()), age:Number(rider?.age)||24,
    marketValue:Math.max(0,Number(rider?.marketValue)||marketValueFor(stats,Number(rider?.age)||24)),
    stats, status:['active','injured','sick'].includes(rider?.status)?rider.status:'active',
    statusUntil:Number(rider?.statusUntil)||0, fatigue:clamp(Number(rider?.fatigue)||0,0,100),
    specialism:SPECIALISMS[rider?.specialism]?rider.specialism:'allrounder'
  };
}

function hydrateTeam(saved){
  const riders=Array.isArray(saved?.riders)&&saved.riders.length?saved.riders.map(sanitizeRider):starterRiders();
  return {
    wallet:Math.max(0,Number(saved?.wallet??STARTING_WALLET)),
    riders,
    shop:{...defaultShop(),...(saved?.shop||{})},
    career:{...defaultCareer(),...(saved?.career||{})},
    raceCount:Math.max(0,Number(saved?.raceCount)||0)
  };
}

function defaultTeam(){
  return {wallet:STARTING_WALLET, riders:starterRiders(), shop:defaultShop(), career:defaultCareer(), raceCount:0};
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
  for(const rider of team.riders) if(rider.status==='active') rider.fatigue=clamp(rider.fatigue-recovery,0,100);
}

function enterClubPhase(game,{recover=false}={}){
  game.phase='club';
  game.race=null;
  for(const player of game.players){
    refreshRiderStatus(player.team);
    if(recover) recoverTeam(player.team);
    if(!player.isNpc) game.scoutMarkets[player.id]=scoutCandidates();
  }
}

function scoreRiderForRace(rider,catalogRace,team){
  let score=weightedStat(rider.stats,catalogRace.terrain);
  score+=team.shop.trainers*2;
  score-=rider.fatigue*0.3;
  return score;
}

function availableRiders(team){
  return team.riders.filter((rider) => rider.status==='active');
}

function autoLineup(game,player){
  const catalogRace=RACE_BY_ID.get(game.race.raceId);
  const ranked=availableRiders(player.team).sort((a,b) => scoreRiderForRace(b,catalogRace,player.team)-scoreRiderForRace(a,catalogRace,player.team));
  game.race.lineups[player.id]=ranked.slice(0,SQUAD_SIZE).map((rider) => rider.id);
}

function rollEvent(team){
  const weights={
    super:0.10+team.shop.trainers*0.01,
    bad:Math.max(0.03,0.15-team.shop.nutrition*0.012-team.shop.trainers*0.01),
    mechanical:Math.max(0.01,0.08-team.shop.bikes*0.011),
    illness:Math.max(0.005,0.05-team.shop.medical*0.007),
    crash:Math.max(0.005,0.07-team.shop.medical*0.008-team.shop.trainers*0.003)
  };
  weights.normal=Math.max(0.05,1-weights.super-weights.bad-weights.mechanical-weights.illness-weights.crash);
  const total=Object.values(weights).reduce((sum,value) => sum+value,0);
  let roll=Math.random()*total;
  for(const key of Object.keys(weights)){roll-=weights[key];if(roll<=0)return key}
  return 'normal';
}

function applyUnavailable(rider,team,races,status){
  rider.status=status;
  rider.statusUntil=team.raceCount+races;
}

function simulateRider(rider,catalogRace,team){
  const baseStat=weightedStat(rider.stats,catalogRace.terrain);
  const equipmentBonus=team.shop.bikes*2.5+team.shop.trainers*2;
  const fatiguePenalty=clamp((rider.fatigue/100)*(1-team.shop.nutrition*0.08),0,0.6);
  const event=rollEvent(team);
  let pr=(baseStat+equipmentBonus)*(1-fatiguePenalty);
  let dnf=false;
  if(event==='super')pr*=1.20;
  else if(event==='bad')pr*=0.85;
  else if(event==='mechanical')pr-=randInt(15,45);
  else if(event==='illness'){dnf=true;applyUnavailable(rider,team,randInt(2,4),'sick')}
  else if(event==='crash'){dnf=true;applyUnavailable(rider,team,randInt(3,6),'injured')}
  pr+=rand(-4,4);
  if(!dnf) rider.fatigue=clamp(rider.fatigue+Math.max(6,22-team.shop.nutrition*3),0,100);
  return {pr:Math.round(pr*10)/10, event, dnf};
}

function simulateRace(game){
  const race=game.race;
  const catalogRace=RACE_BY_ID.get(race.raceId);
  for(const player of game.players) player.team.raceCount+=1;

  const entries=[];
  for(const player of game.players){
    const riderIds=race.lineups[player.id]||[];
    for(const riderId of riderIds){
      const rider=player.team.riders.find((candidate) => candidate.id===riderId);
      if(!rider||rider.status!=='active')continue;
      const outcome=simulateRider(rider,catalogRace,player.team);
      entries.push({playerId:player.id, playerName:player.name, riderId, riderName:rider.name, rider, ...outcome});
    }
  }

  const finishers=entries.filter((entry) => !entry.dnf).sort((a,b) => b.pr-a.pr);
  finishers.forEach((entry,index) => {entry.place=index+1});
  const dnfs=entries.filter((entry) => entry.dnf);

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
      if(catalogRace.category==='gt_stage')player.team.career.gtStagesWon+=1;
    }
    if(best&&best.place<=3)player.team.career.podiums+=1;
    if((race.lineups[player.id]||[]).length)player.team.career.racesEntered+=1;
    player.team.career.prizeMoney+=prizeWon;
    payouts.push({playerId:player.id, prizeWon, bestPlace:best?best.place:null});
  }

  game.lastResult={
    raceId:race.raceId, raceName:catalogRace.name, category:catalogRace.category,
    classification:finishers.map((entry) => ({place:entry.place, playerId:entry.playerId, playerName:entry.playerName, riderName:entry.riderName, event:entry.event, prize:entry.prize||0})),
    dnfs:dnfs.map((entry) => ({playerId:entry.playerId, playerName:entry.playerName, riderName:entry.riderName, event:entry.event})),
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

function bumpMarketValue(rider,factor){
  rider.marketValue=Math.round(rider.marketValue*(1+factor)/50)*50;
}

function allSubmitted(game){
  return Boolean(game.race)&&game.players.every((player) => game.race.lineups[player.id]!==undefined);
}

function maybeSimulate(game){
  if(allSubmitted(game)){simulateRace(game);return true}
  return false;
}

function createGame(roomPlayers){
  const game={
    gameKey:meta.key,
    phase:'club',
    hostId:roomPlayers.find((player) => !player.isNpc)?.id||roomPlayers[0]?.id,
    players:roomPlayers.map((player) => ({
      id:player.id, name:player.name, isNpc:player.isNpc,
      team:player.cycclubTeam?hydrateTeam(player.cycclubTeam):defaultTeam()
    })),
    race:null, lastResult:null, log:[], scoutMarkets:{}, pendingRoundRecord:null
  };
  for(const player of game.players) if(!player.isNpc) game.scoutMarkets[player.id]=scoutCandidates();
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
    if(player.team.wallet<candidate.marketValue)throw new Error('Onvoldoende budget.');
    player.team.wallet-=candidate.marketValue;
    player.team.riders.push(candidate);
    market.splice(index,1);
    return;
  }

  if(action==='sellRider'){
    if(game.phase!=='club')throw new Error('Dit kan alleen in de club.');
    if(player.team.riders.length<=1)throw new Error('Je hebt minstens één renner nodig.');
    const rider=player.team.riders.find((candidate) => candidate.id===payload.riderId);
    if(!rider)throw new Error('Renner niet gevonden.');
    player.team.riders=player.team.riders.filter((candidate) => candidate.id!==rider.id);
    player.team.wallet+=Math.round(rider.marketValue*SELL_RATE/50)*50;
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

  if(action==='selectRace'){
    if(game.phase!=='club')throw new Error('Er loopt al een koers.');
    if(playerId!==game.hostId)throw new Error('Alleen de host kiest een koers.');
    const catalogRace=RACE_BY_ID.get(payload.raceId);
    if(!catalogRace)throw new Error('Onbekende koers.');
    game.phase='lineup';
    game.race={raceId:catalogRace.id, lineups:{}, npcTimers:{}, startedAt:Date.now()};
    for(const candidate of game.players) if(candidate.isNpc) autoLineup(game,candidate);
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
    maybeSimulate(game);
    return;
  }

  if(action==='cancelRace'){
    if(game.phase!=='lineup')throw new Error('Er is geen koers om te annuleren.');
    if(playerId!==game.hostId)throw new Error('Alleen de host kan annuleren.');
    game.phase='club';
    game.race=null;
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
  if(game.phase!=='lineup'||!game.race)return false;
  let changed=false;
  for(const player of game.players){
    if(!player.isNpc||game.race.lineups[player.id]!==undefined)continue;
    if(!game.race.npcTimers[player.id])game.race.npcTimers[player.id]=now+NPC_DELAY;
    if(now<game.race.npcTimers[player.id])continue;
    autoLineup(game,player);
    changed=true;
  }
  if(changed&&maybeSimulate(game))changed=true;
  return changed;
}

function serialize(game,requesterId,connected){
  const catalogRace=game.race?RACE_BY_ID.get(game.race.raceId):null;
  return {
    kind:meta.key, gameOver:false, phase:game.phase, hostId:game.hostId, squadSize:SQUAD_SIZE,
    raceCatalog:RACE_CATALOG.map((race) => ({id:race.id, name:race.name, category:race.category, basePrize:race.basePrize, terrain:race.terrain})),
    race:game.race?{
      raceId:game.race.raceId, raceName:catalogRace?.name||'', category:catalogRace?.category||'',
      readyIds:Object.keys(game.race.lineups), myLineup:game.race.lineups[requesterId]??null
    }:null,
    lastResult:game.lastResult,
    log:game.log.slice(0,20),
    myScoutMarket:game.scoutMarkets[requesterId]||[],
    players:game.players.map((player) => ({
      id:player.id, name:player.name, isNpc:player.isNpc, connected:player.isNpc||connected.get(player.id),
      wallet:player.team.wallet, shop:player.team.shop, career:player.team.career,
      riders:player.team.riders.map((rider) => ({
        id:rider.id, name:rider.name, age:rider.age, marketValue:rider.marketValue, stats:rider.stats,
        status:rider.status, statusUntil:rider.statusUntil, fatigue:rider.fatigue, specialism:rider.specialism,
        available:rider.status==='active'
      }))
    }))
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
  RACE_CATALOG, SHOP_COSTS, STAT_KEYS, SQUAD_SIZE, MAX_RIDERS
};
