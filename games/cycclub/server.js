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
const MAX_RIDERS = 10;
const SQUAD_SIZE = 3;
const SEGMENTS_PER_RACE = 8;
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

// 2026-seizoen: de 10 grootste WorldTour-ploegen met hun actuele kernrenners.
const TEAMS = [
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
const TEAM_BY_ID = new Map(TEAMS.map((team) => [team.id, team]));

// Stats zijn handmatig ingeschat op basis van elke renner se werkelijke specialiteiten
// (in lijn met de PCS-specialiteitsprofielen: one-day/GC/klim/tijdrit/sprint/heuvel).
// Volgorde per renner: flat, mountain, cobbles, timeTrial, sprint, stamina.
const REAL_RIDERS = [
  {name:'Tadej Pogačar', teamId:'uae', age:28, specialism:'climber', stats:{flat:78,mountain:98,cobbles:62,timeTrial:90,sprint:80,stamina:97}},
  {name:'João Almeida', teamId:'uae', age:28, specialism:'climber', stats:{flat:68,mountain:92,cobbles:40,timeTrial:88,sprint:55,stamina:90}},
  {name:'Isaac del Toro', teamId:'uae', age:23, specialism:'climber', stats:{flat:65,mountain:90,cobbles:42,timeTrial:72,sprint:68,stamina:85}},
  {name:'Adam Yates', teamId:'uae', age:34, specialism:'climber', stats:{flat:58,mountain:88,cobbles:35,timeTrial:65,sprint:50,stamina:84}},
  {name:'Juan Sebastián Molano', teamId:'uae', age:32, specialism:'sprinter', stats:{flat:78,mountain:30,cobbles:45,timeTrial:50,sprint:82,stamina:55}},
  {name:'Brandon McNulty', teamId:'uae', age:28, specialism:'allrounder', stats:{flat:72,mountain:78,cobbles:45,timeTrial:90,sprint:55,stamina:80}},
  {name:'Nils Politt', teamId:'uae', age:32, specialism:'classics', stats:{flat:75,mountain:40,cobbles:90,timeTrial:70,sprint:45,stamina:78}},
  {name:'Jay Vine', teamId:'uae', age:31, specialism:'climber', stats:{flat:55,mountain:85,cobbles:30,timeTrial:68,sprint:45,stamina:80}},
  {name:'Marc Soler', teamId:'uae', age:33, specialism:'climber', stats:{flat:60,mountain:82,cobbles:38,timeTrial:65,sprint:48,stamina:78}},
  {name:'Tim Wellens', teamId:'uae', age:35, specialism:'puncheur', stats:{flat:62,mountain:78,cobbles:55,timeTrial:60,sprint:65,stamina:75}},

  {name:'Jonas Vingegaard', teamId:'visma', age:30, specialism:'climber', stats:{flat:70,mountain:97,cobbles:35,timeTrial:85,sprint:55,stamina:96}},
  {name:'Wout van Aert', teamId:'visma', age:32, specialism:'classics', stats:{flat:88,mountain:70,cobbles:92,timeTrial:82,sprint:88,stamina:88}},
  {name:'Matteo Jorgenson', teamId:'visma', age:27, specialism:'allrounder', stats:{flat:78,mountain:80,cobbles:60,timeTrial:85,sprint:55,stamina:82}},
  {name:'Sepp Kuss', teamId:'visma', age:32, specialism:'climber', stats:{flat:55,mountain:90,cobbles:30,timeTrial:68,sprint:35,stamina:92}},
  {name:'Christophe Laporte', teamId:'visma', age:34, specialism:'classics', stats:{flat:80,mountain:45,cobbles:78,timeTrial:65,sprint:82,stamina:65}},
  {name:'Edoardo Affini', teamId:'visma', age:30, specialism:'allrounder', stats:{flat:75,mountain:35,cobbles:60,timeTrial:92,sprint:50,stamina:65}},
  {name:'Wilco Kelderman', teamId:'visma', age:35, specialism:'climber', stats:{flat:58,mountain:80,cobbles:35,timeTrial:72,sprint:40,stamina:78}},
  {name:'Bruno Armirail', teamId:'visma', age:32, specialism:'allrounder', stats:{flat:72,mountain:60,cobbles:55,timeTrial:82,sprint:40,stamina:70}},
  {name:'Ben Tulett', teamId:'visma', age:25, specialism:'climber', stats:{flat:55,mountain:78,cobbles:40,timeTrial:62,sprint:42,stamina:72}},

  {name:'Remco Evenepoel', teamId:'bora', age:26, specialism:'allrounder', stats:{flat:80,mountain:88,cobbles:50,timeTrial:97,sprint:70,stamina:90}},
  {name:'Primož Roglič', teamId:'bora', age:37, specialism:'climber', stats:{flat:68,mountain:92,cobbles:40,timeTrial:88,sprint:58,stamina:90}},
  {name:'Florian Lipowitz', teamId:'bora', age:26, specialism:'climber', stats:{flat:62,mountain:87,cobbles:35,timeTrial:78,sprint:45,stamina:82}},
  {name:'Aleksandr Vlasov', teamId:'bora', age:30, specialism:'climber', stats:{flat:58,mountain:80,cobbles:32,timeTrial:70,sprint:40,stamina:76}},
  {name:'Jai Hindley', teamId:'bora', age:30, specialism:'climber', stats:{flat:58,mountain:82,cobbles:35,timeTrial:68,sprint:42,stamina:78}},
  {name:'Daniel Martínez', teamId:'bora', age:30, specialism:'climber', stats:{flat:60,mountain:83,cobbles:35,timeTrial:66,sprint:48,stamina:78}},
  {name:'Danny van Poppel', teamId:'bora', age:32, specialism:'sprinter', stats:{flat:75,mountain:25,cobbles:55,timeTrial:45,sprint:85,stamina:50}},
  {name:'Jordi Meeus', teamId:'bora', age:28, specialism:'sprinter', stats:{flat:72,mountain:22,cobbles:50,timeTrial:42,sprint:88,stamina:48}},
  {name:'Gianni Vermeersch', teamId:'bora', age:33, specialism:'classics', stats:{flat:68,mountain:40,cobbles:82,timeTrial:55,sprint:60,stamina:65}},

  {name:'Tim Merlier', teamId:'soudal-qs', age:34, specialism:'sprinter', stats:{flat:82,mountain:20,cobbles:55,timeTrial:42,sprint:96,stamina:48}},
  {name:'Mikel Landa', teamId:'soudal-qs', age:37, specialism:'climber', stats:{flat:55,mountain:88,cobbles:30,timeTrial:65,sprint:40,stamina:82}},
  {name:'Paul Magnier', teamId:'soudal-qs', age:22, specialism:'sprinter', stats:{flat:75,mountain:22,cobbles:48,timeTrial:40,sprint:90,stamina:45}},
  {name:'Jasper Stuyven', teamId:'soudal-qs', age:34, specialism:'classics', stats:{flat:78,mountain:42,cobbles:85,timeTrial:62,sprint:72,stamina:72}},
  {name:'Yves Lampaert', teamId:'soudal-qs', age:35, specialism:'classics', stats:{flat:75,mountain:30,cobbles:88,timeTrial:78,sprint:55,stamina:68}},
  {name:'Dylan van Baarle', teamId:'soudal-qs', age:34, specialism:'classics', stats:{flat:76,mountain:38,cobbles:90,timeTrial:70,sprint:50,stamina:74}},
  {name:'Ilan Van Wilder', teamId:'soudal-qs', age:26, specialism:'allrounder', stats:{flat:68,mountain:70,cobbles:55,timeTrial:78,sprint:48,stamina:72}},
  {name:'Mauri Vansevenant', teamId:'soudal-qs', age:27, specialism:'climber', stats:{flat:58,mountain:76,cobbles:45,timeTrial:62,sprint:42,stamina:74}},
  {name:'Louis Vervaeke', teamId:'soudal-qs', age:33, specialism:'allrounder', stats:{flat:62,mountain:68,cobbles:55,timeTrial:68,sprint:45,stamina:72}},

  {name:'Filippo Ganna', teamId:'ineos', age:30, specialism:'allrounder', stats:{flat:82,mountain:35,cobbles:60,timeTrial:98,sprint:60,stamina:70}},
  {name:'Egan Bernal', teamId:'ineos', age:29, specialism:'climber', stats:{flat:60,mountain:86,cobbles:38,timeTrial:75,sprint:45,stamina:80}},
  {name:'Thymen Arensman', teamId:'ineos', age:26, specialism:'climber', stats:{flat:62,mountain:85,cobbles:40,timeTrial:80,sprint:45,stamina:80}},
  {name:'Carlos Rodríguez', teamId:'ineos', age:25, specialism:'climber', stats:{flat:60,mountain:84,cobbles:38,timeTrial:72,sprint:48,stamina:78}},
  {name:'Joshua Tarling', teamId:'ineos', age:22, specialism:'allrounder', stats:{flat:78,mountain:55,cobbles:50,timeTrial:95,sprint:45,stamina:68}},
  {name:'Michał Kwiatkowski', teamId:'ineos', age:36, specialism:'puncheur', stats:{flat:68,mountain:70,cobbles:60,timeTrial:72,sprint:58,stamina:75}},
  {name:'Ben Turner', teamId:'ineos', age:27, specialism:'classics', stats:{flat:72,mountain:40,cobbles:78,timeTrial:60,sprint:55,stamina:65}},
  {name:'Magnus Sheffield', teamId:'ineos', age:24, specialism:'puncheur', stats:{flat:65,mountain:68,cobbles:62,timeTrial:68,sprint:55,stamina:70}},
  {name:'Kévin Vauquelin', teamId:'ineos', age:25, specialism:'puncheur', stats:{flat:65,mountain:72,cobbles:55,timeTrial:68,sprint:58,stamina:72}},
  {name:'Oscar Onley', teamId:'ineos', age:24, specialism:'climber', stats:{flat:58,mountain:80,cobbles:35,timeTrial:65,sprint:42,stamina:76}},

  {name:'Mathieu van der Poel', teamId:'alpecin', age:31, specialism:'classics', stats:{flat:90,mountain:55,cobbles:98,timeTrial:68,sprint:85,stamina:82}},
  {name:'Jasper Philipsen', teamId:'alpecin', age:28, specialism:'sprinter', stats:{flat:85,mountain:25,cobbles:65,timeTrial:45,sprint:96,stamina:55}},
  {name:'Kaden Groves', teamId:'alpecin', age:28, specialism:'sprinter', stats:{flat:78,mountain:28,cobbles:55,timeTrial:45,sprint:90,stamina:52}},
  {name:'Jonas Rickaert', teamId:'alpecin', age:32, specialism:'classics', stats:{flat:70,mountain:35,cobbles:78,timeTrial:55,sprint:65,stamina:62}},
  {name:'Silvan Dillier', teamId:'alpecin', age:36, specialism:'classics', stats:{flat:68,mountain:32,cobbles:80,timeTrial:50,sprint:48,stamina:65}},
  {name:'Gerben Thijssen', teamId:'alpecin', age:28, specialism:'sprinter', stats:{flat:72,mountain:22,cobbles:50,timeTrial:40,sprint:84,stamina:45}},
  {name:'Edward Planckaert', teamId:'alpecin', age:31, specialism:'classics', stats:{flat:68,mountain:30,cobbles:75,timeTrial:48,sprint:62,stamina:60}},
  {name:'Hugo Houle', teamId:'alpecin', age:36, specialism:'allrounder', stats:{flat:62,mountain:65,cobbles:45,timeTrial:68,sprint:42,stamina:68}},

  {name:'Juan Ayuso', teamId:'lidl-trek', age:23, specialism:'climber', stats:{flat:62,mountain:92,cobbles:35,timeTrial:82,sprint:48,stamina:86}},
  {name:'Mads Pedersen', teamId:'lidl-trek', age:31, specialism:'classics', stats:{flat:85,mountain:45,cobbles:88,timeTrial:65,sprint:88,stamina:75}},
  {name:'Jonathan Milan', teamId:'lidl-trek', age:26, specialism:'sprinter', stats:{flat:82,mountain:22,cobbles:55,timeTrial:48,sprint:96,stamina:55}},
  {name:'Mattias Skjelmose', teamId:'lidl-trek', age:25, specialism:'climber', stats:{flat:65,mountain:85,cobbles:45,timeTrial:75,sprint:55,stamina:78}},
  {name:'Tao Geoghegan Hart', teamId:'lidl-trek', age:31, specialism:'climber', stats:{flat:55,mountain:80,cobbles:32,timeTrial:68,sprint:40,stamina:74}},
  {name:'Giulio Ciccone', teamId:'lidl-trek', age:32, specialism:'climber', stats:{flat:55,mountain:84,cobbles:30,timeTrial:60,sprint:42,stamina:76}},
  {name:'Thibau Nys', teamId:'lidl-trek', age:23, specialism:'puncheur', stats:{flat:62,mountain:68,cobbles:70,timeTrial:58,sprint:72,stamina:65}},
  {name:'Toms Skujiņš', teamId:'lidl-trek', age:35, specialism:'classics', stats:{flat:65,mountain:55,cobbles:72,timeTrial:58,sprint:58,stamina:62}},

  {name:'Ben Healy', teamId:'ef', age:26, specialism:'puncheur', stats:{flat:65,mountain:78,cobbles:62,timeTrial:68,sprint:62,stamina:76}},
  {name:'Richard Carapaz', teamId:'ef', age:33, specialism:'climber', stats:{flat:58,mountain:86,cobbles:35,timeTrial:65,sprint:45,stamina:82}},
  {name:'Kasper Asgreen', teamId:'ef', age:31, specialism:'classics', stats:{flat:75,mountain:38,cobbles:85,timeTrial:68,sprint:60,stamina:68}},
  {name:'Neilson Powless', teamId:'ef', age:29, specialism:'puncheur', stats:{flat:65,mountain:72,cobbles:58,timeTrial:65,sprint:55,stamina:72}},
  {name:'Marijn van den Berg', teamId:'ef', age:26, specialism:'sprinter', stats:{flat:72,mountain:28,cobbles:50,timeTrial:42,sprint:80,stamina:48}},
  {name:'Alex Baudin', teamId:'ef', age:25, specialism:'climber', stats:{flat:55,mountain:76,cobbles:35,timeTrial:60,sprint:42,stamina:70}},
  {name:'Michael Valgren', teamId:'ef', age:33, specialism:'classics', stats:{flat:68,mountain:42,cobbles:75,timeTrial:55,sprint:55,stamina:62}},

  {name:'Enric Mas', teamId:'movistar', age:31, specialism:'climber', stats:{flat:58,mountain:86,cobbles:32,timeTrial:68,sprint:42,stamina:80}},
  {name:'Nairo Quintana', teamId:'movistar', age:36, specialism:'climber', stats:{flat:50,mountain:82,cobbles:28,timeTrial:55,sprint:35,stamina:78}},
  {name:'Iván García Cortina', teamId:'movistar', age:30, specialism:'classics', stats:{flat:70,mountain:40,cobbles:70,timeTrial:55,sprint:65,stamina:60}},
  {name:'Einer Rubio', teamId:'movistar', age:29, specialism:'climber', stats:{flat:52,mountain:80,cobbles:28,timeTrial:55,sprint:38,stamina:76}},
  {name:'Cian Uijtdebroeks', teamId:'movistar', age:23, specialism:'climber', stats:{flat:55,mountain:78,cobbles:32,timeTrial:62,sprint:40,stamina:74}},
  {name:'Gonzalo Serrano', teamId:'movistar', age:31, specialism:'sprinter', stats:{flat:68,mountain:30,cobbles:48,timeTrial:45,sprint:78,stamina:48}},
  {name:'Davide Formolo', teamId:'movistar', age:34, specialism:'allrounder', stats:{flat:60,mountain:68,cobbles:45,timeTrial:62,sprint:45,stamina:65}},

  {name:'David Gaudu', teamId:'fdj', age:30, specialism:'climber', stats:{flat:55,mountain:82,cobbles:32,timeTrial:62,sprint:42,stamina:76}},
  {name:'Valentin Madouas', teamId:'fdj', age:30, specialism:'classics', stats:{flat:68,mountain:55,cobbles:70,timeTrial:58,sprint:58,stamina:65}},
  {name:'Romain Grégoire', teamId:'fdj', age:23, specialism:'puncheur', stats:{flat:62,mountain:70,cobbles:58,timeTrial:60,sprint:65,stamina:66}},
  {name:'Rémi Cavagna', teamId:'fdj', age:31, specialism:'allrounder', stats:{flat:75,mountain:40,cobbles:55,timeTrial:85,sprint:50,stamina:62}},
  {name:'Guillaume Martin', teamId:'fdj', age:33, specialism:'climber', stats:{flat:52,mountain:78,cobbles:30,timeTrial:58,sprint:35,stamina:72}},
  {name:'Kevin Geniets', teamId:'fdj', age:30, specialism:'allrounder', stats:{flat:60,mountain:60,cobbles:48,timeTrial:65,sprint:42,stamina:62}},
  {name:'Olivier Le Gac', teamId:'fdj', age:33, specialism:'classics', stats:{flat:62,mountain:42,cobbles:65,timeTrial:52,sprint:55,stamina:58}}
];

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
  {id:'omloop-het-nieuwsblad', name:'Omloop Het Nieuwsblad', category:'classic', difficulty:5, terrain:{cobbles:0.45,flat:0.25,stamina:0.3}},
  {id:'tour-vlakke-rit', name:'Tour de France — Vlakke Rit', category:'gt_stage', difficulty:7, terrain:{flat:0.5,sprint:0.4,stamina:0.1}},
  {id:'tour-bergrit', name:'Tour de France — Bergrit', category:'gt_stage', difficulty:9, terrain:{mountain:0.7,stamina:0.3}},
  {id:'tour-tijdrit', name:'Tour de France — Tijdrit', category:'gt_stage', difficulty:8, terrain:{timeTrial:0.8,stamina:0.2}},
  {id:'giro-bergrit', name:'Giro d’Italia — Bergrit', category:'gt_stage', difficulty:8, terrain:{mountain:0.5,stamina:0.5}},
  {id:'vuelta-rit', name:'Vuelta a España — Rit', category:'gt_stage', difficulty:8, terrain:{mountain:0.5,flat:0.3,stamina:0.2}},
  {id:'tour-eindklassement', name:'Tour de France — Eindklassement', category:'grand_tour', difficulty:10, terrain:{mountain:0.35,timeTrial:0.25,stamina:0.3,flat:0.1}},
  {id:'giro-eindklassement', name:'Giro d’Italia — Eindklassement', category:'grand_tour', difficulty:9, terrain:{mountain:0.4,timeTrial:0.2,stamina:0.4}},
  {id:'vuelta-eindklassement', name:'Vuelta a España — Eindklassement', category:'grand_tour', difficulty:9, terrain:{mountain:0.45,stamina:0.35,flat:0.2}}
].map((race) => ({...race, basePrize:prizeForDifficulty(race.difficulty)}));
const RACE_BY_ID = new Map(RACE_CATALOG.map((race) => [race.id, race]));
const PAYOUT_TABLE = [0.40,0.22,0.14,0.09,0.06,0.04,0.025,0.015,0.01,0.005];

function rand(min,max){return min+Math.random()*(max-min)}
function randInt(min,max){return Math.floor(rand(min,max+1))}
function pick(list){return list[Math.floor(Math.random()*list.length)]}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function makeId(prefix){return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`}

function jitteredStats(baseStats){
  const stats={};
  for(const key of STAT_KEYS) stats[key]=clamp(baseStats[key]+randInt(-2,2),1,99);
  return stats;
}

function marketValueFor(stats,age){
  const avg=STAT_KEYS.reduce((sum,key)=>sum+stats[key],0)/STAT_KEYS.length;
  const primeFactor=age>=24&&age<=30?1.15:(age<22||age>33?0.85:1);
  return Math.round((avg*avg*4*primeFactor)/50)*50;
}

function makeRealRider(entry){
  const stats=jitteredStats(entry.stats);
  return {
    id:makeId('r'), name:entry.name, age:entry.age, teamId:entry.teamId,
    marketValue:marketValueFor(stats,entry.age), stats,
    status:'active', statusUntil:0, fatigue:0, specialism:entry.specialism
  };
}

function ridersExcluding(excludeNames){
  const exclude=excludeNames instanceof Set?excludeNames:new Set(excludeNames||[]);
  const pool=REAL_RIDERS.filter((entry) => !exclude.has(entry.name));
  return pool.length?pool:REAL_RIDERS;
}

function starterRiders(count,excludeNames){
  const pool=[...ridersExcluding(excludeNames)].sort(() => Math.random()-0.5);
  return pool.slice(0,count).map(makeRealRider);
}

function scoutCandidates(excludeNames){
  const source=ridersExcluding(excludeNames);
  const picks=[];
  const used=new Set();
  while(picks.length<SCOUT_MARKET_SIZE&&used.size<source.length){
    const entry=pick(source);
    if(used.has(entry.name))continue;
    used.add(entry.name);
    picks.push(makeRealRider(entry));
  }
  return picks;
}

function defaultShop(){return {bikes:0,nutrition:0,trainers:0,medical:0}}

function describeShopEffects(shop){
  const pechThreshold=Math.max(2,8-shop.bikes);
  const injuryReduction=Math.min(5,Math.floor(shop.medical*0.6));
  const crashChancePct=Math.round(clamp(0.30-shop.medical*0.06,0.04,0.30)*100);
  const illnessChancePct=Math.round(clamp(0.06-shop.medical*0.01,0.01,0.06)*100);
  return {
    bikes:shop.bikes?`+${Math.round(shop.bikes*1.4*10)/10} snelheid · pech pas onder ${pechThreshold} i.p.v. 8`:'Geen bonus',
    nutrition:shop.nutrition?`-${shop.nutrition*8}% impact vermoeidheid · +${shop.nutrition*3} sneller herstel`:'Geen bonus',
    trainers:shop.trainers?`+${shop.trainers*3} op de 3 beste statistieken per renner`:'Geen bonus',
    medical:shop.medical?`-${injuryReduction} races uitvaltijd · ${crashChancePct}% valkans · ${illnessChancePct}% ziektekans`:'Geen bonus'
  };
}
function defaultCareer(){return {victories:0,podiums:0,monumentsWon:0,grandToursWon:0,gtStagesWon:0,prizeMoney:0,racesEntered:0}}

function sanitizeRider(rider){
  const stats={};
  for(const key of STAT_KEYS) stats[key]=clamp(Number(rider?.stats?.[key])||40,1,99);
  return {
    id:String(rider?.id||makeId('r')), name:String(rider?.name||'Onbekende renner'), age:Number(rider?.age)||24,
    teamId:rider?.teamId?String(rider.teamId):null,
    marketValue:Math.max(0,Number(rider?.marketValue)||marketValueFor(stats,Number(rider?.age)||24)),
    stats, status:['active','injured','sick'].includes(rider?.status)?rider.status:'active',
    statusUntil:Number(rider?.statusUntil)||0, fatigue:clamp(Number(rider?.fatigue)||0,0,100),
    specialism:SPECIALISMS[rider?.specialism]?rider.specialism:'allrounder'
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
  return {wallet:STARTING_WALLET, riders:starterRiders(isNpc?NPC_STARTER_RIDERS:STARTER_RIDERS), shop:defaultShop(), career:defaultCareer(), raceCount:0};
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
  for(const player of game.players){
    refreshRiderStatus(player.team);
    if(recover) recoverTeam(player.team);
    if(!player.isNpc) game.scoutMarkets[player.id]=scoutCandidates(player.team.riders.map((rider) => rider.name));
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

function autoLineup(game,player){
  const catalogRace=RACE_BY_ID.get(game.race.raceId);
  const ranked=availableRiders(player.team).sort((a,b) => scoreRiderForRace(b,catalogRace,player.team)-scoreRiderForRace(a,catalogRace,player.team));
  game.race.lineups[player.id]=ranked.slice(0,SQUAD_SIZE).map((rider) => rider.id);
}

function applyUnavailable(rider,team,races,status){
  rider.status=status;
  rider.statusUntil=team.raceCount+races;
}

function pechThresholdFor(team){return Math.max(2,8-team.shop.bikes)}

function trainerBoostedStats(stats,trainers){
  if(!trainers)return stats;
  const boosted={...stats};
  const topKeys=STAT_KEYS.slice().sort((a,b) => stats[b]-stats[a]).slice(0,3);
  for(const key of topKeys) boosted[key]=clamp(boosted[key]+trainers*3,1,99);
  return boosted;
}

function baseMultiplierFor(team){
  const totalLevels=team.shop.bikes+team.shop.nutrition+team.shop.trainers+team.shop.medical;
  return Math.round((1+totalLevels*0.03)*1000)/1000;
}

function riderSegmentModifier(rider,catalogRace,team){
  const trainedStats=trainerBoostedStats(rider.stats,team.shop.trainers);
  const baseStat=weightedStat(trainedStats,catalogRace.terrain);
  const statMod=Math.round((baseStat-50)/8);
  const fatiguePenalty=clamp((rider.fatigue/100)*(1-team.shop.nutrition*0.08),0,0.6);
  const fatigueMod=-Math.round(fatiguePenalty*10);
  return statMod+fatigueMod;
}

function resolveRiderSegment(rider,catalogRace,team,roll,multiplier){
  const riderModifier=riderSegmentModifier(rider,catalogRace,team);
  const bonus=Math.round(riderModifier*multiplier);
  if(roll===1){
    const crashChance=clamp(0.30-team.shop.medical*0.06,0.04,0.30);
    if(Math.random()<crashChance){
      const duration=Math.max(1,randInt(3,6)-Math.floor(team.shop.medical*0.6));
      applyUnavailable(rider,team,duration,'injured');
      return {roll,total:roll+bonus,outcome:'valt',score:0,dnf:true};
    }
  }
  const total=roll+bonus;
  const pechThreshold=pechThresholdFor(team);
  if(total>=24)return {roll,total,outcome:'topdag',score:total+6,dnf:false};
  if(total>=18)return {roll,total,outcome:'opportuniteit',score:total+3,dnf:false};
  if(total<=pechThreshold)return {roll,total,outcome:'pech',score:total-4,dnf:false};
  return {roll,total,outcome:'normaal',score:total,dnf:false};
}

function startRacing(game){
  game.phase='racing';
  game.race.npcTimers={};
  game.race.segmentIndex=0;
  game.race.progress={};
  for(const player of game.players){
    const riderIds=game.race.lineups[player.id]||[];
    const riders={};
    for(const riderId of riderIds) riders[riderId]={pr:0,segments:[],dnf:false};
    game.race.progress[player.id]={
      multiplier:baseMultiplierFor(player.team), bankStreak:0,
      pendingRoll:null, confirmed:false, riders
    };
  }
}

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

function resolveSegmentFor(game,player,apply){
  const race=game.race;
  const prog=race.progress[player.id];
  if(!prog||prog.confirmed||!prog.pendingRoll)return;
  const catalogRace=RACE_BY_ID.get(race.raceId);
  const roll=prog.pendingRoll.roll;
  const multiplierUsed=apply?prog.multiplier:1;
  for(const riderId of activeRiderIds(prog)){
    const rider=player.team.riders.find((candidate) => candidate.id===riderId);
    const state=prog.riders[riderId];
    if(!rider||!state)continue;
    const segment=resolveRiderSegment(rider,catalogRace,player.team,roll,multiplierUsed);
    state.segments.push({n:race.segmentIndex+1, roll:segment.roll, total:segment.total, outcome:segment.outcome});
    if(segment.dnf)state.dnf=true;
    else state.pr+=segment.score;
  }
  prog.multiplier=apply?baseMultiplierFor(player.team):Math.round(prog.multiplier*1.125*1000)/1000;
  prog.bankStreak=apply?0:prog.bankStreak+1;
  prog.pendingRoll=null;
  prog.confirmed=true;
}

function maybeAdvanceSegment(game){
  if(game.phase!=='racing'||!game.race)return false;
  const race=game.race;
  const stillWaiting=game.players.some((player) => playerAwaitsConfirmation(race.progress[player.id]||{riders:{},confirmed:true}));
  if(stillWaiting)return false;
  race.segmentIndex+=1;
  const finished=race.segmentIndex>=SEGMENTS_PER_RACE||game.players.every((player) => activeRiderIds(race.progress[player.id]).length===0);
  if(finished){
    for(const player of game.players){
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
  for(const player of game.players){
    const prog=race.progress[player.id];
    if(prog)prog.confirmed=false;
  }
  return true;
}

function finalizeRace(game){
  const race=game.race;
  const catalogRace=RACE_BY_ID.get(race.raceId);
  for(const player of game.players) player.team.raceCount+=1;

  const entries=[];
  for(const player of game.players){
    const prog=race.progress[player.id];
    if(!prog)continue;
    for(const riderId of Object.keys(prog.riders)){
      const rider=player.team.riders.find((candidate) => candidate.id===riderId);
      const state=prog.riders[riderId];
      if(!rider||!state)continue;
      const event=state.dnf?'valt'
        :state.segments.some((segment) => segment.outcome==='topdag')?'topdag'
        :state.segments.some((segment) => segment.outcome==='opportuniteit')?'opportuniteit'
        :state.segments.some((segment) => segment.outcome==='pech')?'pech'
        :'normaal';
      entries.push({
        playerId:player.id, playerName:player.name, riderId, riderName:rider.name, rider,
        pr:Math.round(state.pr*10)/10, event, dnf:state.dnf, segments:state.segments
      });
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
      if(catalogRace.category==='grand_tour')player.team.career.grandToursWon+=1;
      if(catalogRace.category==='gt_stage')player.team.career.gtStagesWon+=1;
    }
    if(best&&best.place<=3)player.team.career.podiums+=1;
    if((race.lineups[player.id]||[]).length)player.team.career.racesEntered+=1;
    player.team.career.prizeMoney+=prizeWon;
    payouts.push({playerId:player.id, prizeWon, bestPlace:best?best.place:null});
  }

  game.lastResult={
    raceId:race.raceId, raceName:catalogRace.name, category:catalogRace.category,
    classification:finishers.map((entry) => ({place:entry.place, playerId:entry.playerId, playerName:entry.playerName, riderName:entry.riderName, event:entry.event, segments:entry.segments, prize:entry.prize||0})),
    dnfs:dnfs.map((entry) => ({playerId:entry.playerId, playerName:entry.playerName, riderName:entry.riderName, event:entry.event, segments:entry.segments})),
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

function createGame(roomPlayers){
  const game={
    gameKey:meta.key,
    phase:'club',
    hostId:roomPlayers.find((player) => !player.isNpc)?.id||roomPlayers[0]?.id,
    players:roomPlayers.map((player) => ({
      id:player.id, name:player.name, isNpc:player.isNpc,
      team:player.cycclubTeam?hydrateTeam(player.cycclubTeam):defaultTeam(player.isNpc)
    })),
    race:null, lastResult:null, log:[], scoutMarkets:{}, pendingRoundRecord:null
  };
  for(const player of game.players) if(!player.isNpc) game.scoutMarkets[player.id]=scoutCandidates(player.team.riders.map((rider) => rider.name));
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
    const exclude=new Set([...player.team.riders.map((rider) => rider.name), ...market.map((rider) => rider.name)]);
    market.splice(index,1,scoutCandidates(exclude)[0]);
    return;
  }

  if(action==='refreshScoutMarket'){
    if(game.phase!=='club')throw new Error('Dit kan alleen in de club.');
    if(player.isNpc)throw new Error('NPC-ploegen scouten niet zelf.');
    game.scoutMarkets[playerId]=scoutCandidates(player.team.riders.map((rider) => rider.name));
    return;
  }

  if(action==='sellRider'){
    if(game.phase!=='club')throw new Error('Dit kan alleen in de club.');
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

  if(action==='resetTeam'){
    if(game.phase!=='club')throw new Error('Dit kan alleen in de club.');
    player.team=defaultTeam(player.isNpc);
    if(!player.isNpc)game.scoutMarkets[playerId]=scoutCandidates();
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
    maybeStartRacing(game);
    return;
  }

  if(action==='rollSegment'){
    if(game.phase!=='racing'||!game.race)throw new Error('Er is geen actieve rit.');
    const prog=game.race.progress[playerId];
    if(!prog||!playerAwaitsConfirmation(prog))throw new Error('Er valt voor jou niets te rollen in dit segment.');
    if(prog.pendingRoll)throw new Error('Verwerk eerst je vorige worp.');
    prog.pendingRoll={roll:randInt(1,20)};
    return;
  }

  if(action==='resolveSegment'){
    if(game.phase!=='racing'||!game.race)throw new Error('Er is geen actieve rit.');
    const prog=game.race.progress[playerId];
    if(!prog||!playerAwaitsConfirmation(prog))throw new Error('Er valt voor jou niets te bevestigen in dit segment.');
    if(!prog.pendingRoll)throw new Error('Rol eerst een dobbelsteen.');
    resolveSegmentFor(game,player,Boolean(payload.apply));
    maybeAdvanceSegment(game);
    return;
  }

  if(action==='cancelRace'){
    if(game.phase!=='lineup'&&game.phase!=='racing')throw new Error('Er is geen koers om te annuleren.');
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
    for(const player of game.players){
      if(!player.isNpc)continue;
      const prog=game.race.progress[player.id];
      if(!prog||!playerAwaitsConfirmation(prog))continue;
      if(!game.race.npcTimers[player.id])game.race.npcTimers[player.id]=now+NPC_DELAY;
      if(now<game.race.npcTimers[player.id])continue;
      if(!prog.pendingRoll)prog.pendingRoll={roll:randInt(1,20)};
      else resolveSegmentFor(game,player,true);
      game.race.npcTimers[player.id]=now+NPC_DELAY;
      changed=true;
    }
    if(maybeAdvanceSegment(game))changed=true;
    return changed;
  }

  return false;
}

function serialize(game,requesterId,connected){
  const catalogRace=game.race?RACE_BY_ID.get(game.race.raceId):null;
  return {
    kind:meta.key, gameOver:false, phase:game.phase, hostId:game.hostId, squadSize:SQUAD_SIZE, maxRiders:MAX_RIDERS,
    raceCatalog:RACE_CATALOG.map((race) => ({id:race.id, name:race.name, category:race.category, difficulty:race.difficulty, basePrize:race.basePrize, terrain:race.terrain})),
    race:game.race?serializeRace(game,requesterId,catalogRace):null,
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

function serializeRace(game,requesterId,catalogRace){
  const base={
    raceId:game.race.raceId, raceName:catalogRace?.name||'', category:catalogRace?.category||'',
    terrain:catalogRace?.terrain||{}, squadSize:SQUAD_SIZE,
    readyIds:Object.keys(game.race.lineups), myLineup:game.race.lineups[requesterId]??null
  };
  if(game.phase!=='racing'||!game.race.progress)return base;
  base.segmentIndex=game.race.segmentIndex;
  const myProg=game.race.progress[requesterId];
  const requester=game.players.find((candidate) => candidate.id===requesterId);
  base.myProgress=myProg?{
    multiplier:myProg.multiplier, bankStreak:myProg.bankStreak,
    awaitingConfirmation:playerAwaitsConfirmation(myProg),
    pendingRoll:myProg.pendingRoll?{roll:myProg.pendingRoll.roll}:null,
    riders:Object.fromEntries(Object.entries(myProg.riders).map(([riderId,state]) => {
      const rider=requester?.team.riders.find((candidate) => candidate.id===riderId);
      return [riderId,{name:rider?.name||'Renner', pr:Math.round(state.pr*10)/10, segments:state.segments, dnf:state.dnf}];
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
    status:rider.status, statusUntil:rider.statusUntil, fatigue:rider.fatigue, specialism:rider.specialism,
    available:rider.status==='active'
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
  RACE_CATALOG, SHOP_COSTS, STAT_KEYS, SQUAD_SIZE, MAX_RIDERS, TEAMS, REAL_RIDERS
};
