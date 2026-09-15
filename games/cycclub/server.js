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
const MIN_RIDER_PRICE = 10000;
const MAX_RIDER_PRICE = 250000;
const RESET_STARTER_COUNT = 5;
const RESET_STARTER_MIN_SPECIALISMS = 4;
const RESET_STARTER_POOL_FRACTION = 0.10;
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

// Individuele renner-tactieken per segment: elke renner in de opstelling kiest elk segment een
// houding, die samen met terrein, positie en energie zijn personalMultiplier bepaalt.
//
// Energie tijdens een rit bestaat uit twee balken per renner:
// - endurance (groen, uithouding): start op 100 − vermoeidheid, daalt elk segment en komt binnen
//   de rit nooit terug (behalve een beetje via een gel). Bepaalt de worp-penalty en de Hongerklop.
// - power (rood, explosiviteit): wordt verbruikt door Val aan, Kop, Bescherm, Lead-out en Volg renner,
//   laadt op bij Volg en Herstel, maar kan nooit hoger zijn dan de resterende groene balk.
const RIDER_TACTICS = ['recover','follow','leadout','attack','fetch_bidons','protect','sprint_leadout','mark'];
const TACTIC_LABELS = {recover:'Herstel', follow:'Volg', leadout:'Kop', attack:'Val aan', fetch_bidons:'Bidons', protect:'Bescherm', sprint_leadout:'Lead-out', mark:'Volg renner'};
const TACTIC_EFFECTS = {
  recover:{rollBonus:0, powerDelta:30, enduranceCost:2},
  follow:{rollBonus:2, powerDelta:15, enduranceCost:4},
  leadout:{rollBonus:3, powerDelta:-20, enduranceCost:8},
  attack:{rollBonus:5, powerDelta:-30, enduranceCost:10},
  fetch_bidons:{rollBonus:0, powerDelta:0, enduranceCost:6},
  protect:{rollBonus:0, powerDelta:-15, enduranceCost:8},
  sprint_leadout:{rollBonus:1, powerDelta:-100, enduranceCost:15},
  mark:{rollBonus:1, powerDelta:-25, enduranceCost:8}
};
// Tactieken die een doelwit nodig hebben: een ploeggenoot (Bescherm, Lead-out) of een
// aangekondigde tegenstander uit de koersradio (Volg renner).
const TACTIC_TARGET = {protect:'teammate', sprint_leadout:'teammate', mark:'rival'};
const TACTIC_DESCRIPTIONS = {
  recover:'Laadt explosiviteit op, zakt naar de staart.',
  follow:'Rustig in het wiel, laadt wat explosiviteit op.',
  leadout:'Tempo op kop; ploeggenoten die volgen krijgen +1,5.',
  attack:'Kies je inzet: hoger = grotere bonus, maar kans om te ontploffen.',
  fetch_bidons:'Ploeggenoten krijgen +15 explosiviteit.',
  protect:'Ploeggenoot krijgt +2 op de worp en valt dit segment niet.',
  sprint_leadout:'Verbrandt alle explosiviteit; de aanval van je ploeggenoot krijgt ×1,6.',
  mark:'Zit in het wiel van een aangekondigde renner: +5 als hij echt aanvalt.'
};
// Push your luck: Val aan met inzet 1-3. Bij een basisworp ≤ failBelow ontploft de renner.
const ATTACK_PUSH_LEVELS = {
  1:{cost:30, rollBonus:5, failBelow:0, label:'Licht'},
  2:{cost:45, rollBonus:7, failBelow:2, label:'Vol'},
  3:{cost:60, rollBonus:9, failBelow:4, label:'Alles'}
};
const EXPLODE_ROLL_PENALTY = 3;
const EXPLODE_ENDURANCE = 5;
const LEADOUT_DRAFT_BONUS = 1.5;
const PROTECT_ROLL_BONUS = 2;
const SPRINT_LEADOUT_ATTACK_FACTOR = 1.6;
const SPRINT_LEADOUT_FOLLOW_BONUS = 2;
const SPRINT_LEADOUT_MIN_POWER = 20;
const MARK_SUCCESS_BONUS = 5;
const FETCH_BIDONS_POWER = 15;
const GEL_POWER = 25;
const GEL_ENDURANCE = 10;
const GELS_PER_RACE = 2;
const BONK_ENDURANCE = 10;
const MOUNTAIN_ENDURANCE_COST = 2;
// Positie in de groep volgt uit de vorige tactiek: wie aanvalt of kopwerk doet zit vooraan,
// wie herstelt zakt naar de staart. Achteraan spaar je energie maar loop je meer valrisico.
const POSITIONS = ['front','middle','back'];
const POSITION_LABELS = {front:'Kop', middle:'Buik', back:'Staart'};
const POSITION_BY_TACTIC = {attack:'front', leadout:'front', sprint_leadout:'front', protect:'front', mark:'front', follow:'middle', recover:'back', fetch_bidons:'back'};
const POSITION_EFFECTS = {
  front:{enduranceCost:2, powerDelta:0, crashFactor:0.6},
  middle:{enduranceCost:0, powerDelta:0, crashFactor:1},
  back:{enduranceCost:-2, powerDelta:5, crashFactor:1.5}
};

const ROLE_BY_SPECIALISM = {sprinter:'sprinter', climber:'climber', allrounder:'allrounder', classics:'allrounder', puncheur:'allrounder'};
function riderRole(rider){return ROLE_BY_SPECIALISM[rider.specialism]||'allrounder'}

function terrainFactorFor(role,terrainType){
  if(role==='climber')return terrainType==='mountain'?0.25:(terrainType==='flat'?-0.05:0);
  if(role==='sprinter')return terrainType==='flat'?0.20:(terrainType==='mountain'?-0.25:0);
  if(role==='allrounder')return (terrainType==='hills'||terrainType==='cobbles')?0.10:0;
  return 0; // domestique: geen terreinbonus
}

function endurancePenaltyFor(endurance){
  if(endurance>=60)return 0;
  if(endurance>=30)return 0.10;
  if(endurance>BONK_ENDURANCE)return 0.25;
  return 0.5; // Hongerklop: apart afgekapt op ×0.5 in calculateSegmentStep
}

function isBonked(rider){return rider.endurance<=BONK_ENDURANCE}
function isSprintSegment(segment){
  return Boolean(segment?.isSprint||segment?.hasIntermediateSprint);
}

// Bij de start van een rit vertaalt de blijvende vermoeidheid zich in de groene balk; de rode
// balk begint vol (begrensd door groen). Buiten een rit bestaan deze velden niet op de renner.
function initRaceEnergy(rider){
  rider.endurance=clamp(Math.round(100-(Number(rider.fatigue)||0)),0,100);
  rider.power=rider.endurance;
  rider.position='middle';
}
function ensureRaceEnergy(rider){
  if(!Number.isFinite(rider.endurance)||!Number.isFinite(rider.power))initRaceEnergy(rider);
  if(!POSITIONS.includes(rider.position))rider.position='middle';
}
function clearRaceEnergy(rider){
  delete rider.endurance;
  delete rider.power;
  delete rider.position;
}
function applyGel(rider){
  if(rider.gelsRemaining<=0)return false;
  rider.gelsRemaining-=1;
  rider.endurance=clamp(rider.endurance+GEL_ENDURANCE,0,100);
  rider.power=clamp(rider.power+GEL_POWER,0,rider.endurance);
  return true;
}
function addPower(rider,delta){rider.power=clamp(Math.round(rider.power+delta),0,rider.endurance)}

// Zet de opgegeven tactiek om in wat de renner werkelijk kan rijden: onbekende tactieken,
// ontbrekende doelwitten, te weinig explosiviteit of een Hongerklop vallen terug op Volg.
function resolveTactic(rider,requested,segment,extras,activeIds){
  const targets=extras.targets||{};
  const pushes=extras.pushes||{};
  const rivalAttacks=extras.rivalAttacks||{};
  let tactic=RIDER_TACTICS.includes(requested)?requested:'follow';
  let push=1;
  let target=null;
  if(tactic==='sprint_leadout'&&(!isSprintSegment(segment)||rider.power<SPRINT_LEADOUT_MIN_POWER))tactic='follow';
  if(TACTIC_TARGET[tactic]==='teammate'){
    target=targets[rider.id];
    if(!target||target===rider.id||!activeIds.has(target))tactic='follow';
  }
  if(tactic==='mark'){
    target=targets[rider.id];
    if(!target||!Object.hasOwn(rivalAttacks,target))tactic='follow';
  }
  if(tactic==='attack'){
    push=clamp(Math.floor(Number(pushes[rider.id])||1),1,3);
    while(push>1&&rider.power<ATTACK_PUSH_LEVELS[push].cost)push-=1;
    if(rider.power<ATTACK_PUSH_LEVELS[1].cost)tactic='follow';
  } else if(tactic!=='sprint_leadout'&&TACTIC_EFFECTS[tactic].powerDelta<0&&rider.power<-TACTIC_EFFECTS[tactic].powerDelta){
    tactic='follow';
  }
  if(isBonked(rider)&&!['recover','follow','fetch_bidons'].includes(tactic))tactic='follow';
  if(!TACTIC_TARGET[tactic])target=null;
  return {tactic,push,target};
}

// Zuivere rekenfunctie: past gel-, bidon- en ploegeffecten toe (muteert endurance/power/position/
// gelsRemaining op de meegegeven renners) en berekent daarna elke renner z'n personalMultiplier.
// extras: {targets, pushes, rollModifiers (uit events), rivalAttacks (koersradio: riderId → boolean)}.
function calculateSegmentStep(riders,tacticsByRiderId,gelsByRiderId,segment,baseDiceRoll,team,extras={}){
  const bikeBonus=(team?.shop?.bikes||0)*0.02;
  const nutrition=team?.shop?.nutrition||0;
  const rollModifiers=extras.rollModifiers||{};
  const rivalAttacks=extras.rivalAttacks||{};
  const card=extras.card&&TEAM_TACTIC_BY_ID.has(extras.card.id)?{id:extras.card.id, level:clamp(Number(extras.card.level)||1,1,TEAM_TACTIC_MAX_LEVEL)}:null;
  for(const rider of riders){
    ensureRaceEnergy(rider);
    if(gelsByRiderId?.[rider.id])applyGel(rider);
  }
  const activeIds=new Set(riders.map((rider) => rider.id));
  const resolved={};
  for(const rider of riders)resolved[rider.id]=resolveTactic(rider,tacticsByRiderId?.[rider.id],segment,extras,activeIds);

  const fetchingBidons=riders.some((rider) => resolved[rider.id].tactic==='fetch_bidons');
  const hasLeadout=riders.some((rider) => resolved[rider.id].tactic==='leadout');
  const protectedIds=new Set(riders.filter((rider) => resolved[rider.id].tactic==='protect').map((rider) => resolved[rider.id].target));
  const sprintLeadoutFor=new Set(riders.filter((rider) => resolved[rider.id].tactic==='sprint_leadout').map((rider) => resolved[rider.id].target));

  const cardContext={segment, resolved, groups:extras.groups||{}};
  const results={};
  for(const rider of riders){
    const {tactic,push,target}=resolved[rider.id];
    const cardMods=cardModifiersFor(card,rider,tactic,cardContext);
    const effects=TACTIC_EFFECTS[tactic];
    const bonked=isBonked(rider);
    const role=riderRole(rider);
    const terrain=terrainFactorFor(role,segment.terrainType);
    const position=rider.position;
    const positionEffects=POSITION_EFFECTS[position];
    let tacticRollBonus=effects.rollBonus;
    let powerDelta=effects.powerDelta;
    let exploded=false;
    if(tactic==='attack'){
      const level=ATTACK_PUSH_LEVELS[push];
      tacticRollBonus=level.rollBonus;
      powerDelta=-level.cost;
      if(sprintLeadoutFor.has(rider.id))tacticRollBonus=Math.round(tacticRollBonus*SPRINT_LEADOUT_ATTACK_FACTOR*10)/10;
      if(baseDiceRoll<=level.failBelow){exploded=true;tacticRollBonus=-EXPLODE_ROLL_PENALTY}
    } else if(sprintLeadoutFor.has(rider.id))tacticRollBonus+=SPRINT_LEADOUT_FOLLOW_BONUS;
    if(tactic==='follow'&&hasLeadout)tacticRollBonus+=LEADOUT_DRAFT_BONUS;
    if(tactic==='mark')tacticRollBonus=rivalAttacks[target]?MARK_SUCCESS_BONUS:effects.rollBonus;
    if(tactic==='sprint_leadout')powerDelta=-rider.power;
    const isProtected=protectedIds.has(rider.id);
    if(isProtected)tacticRollBonus+=PROTECT_ROLL_BONUS;
    tacticRollBonus+=Number(rollModifiers[rider.id])||0;
    tacticRollBonus+=cardMods.roll;

    const fatiguePenalty=bonked?0.5:endurancePenaltyFor(rider.endurance);
    const statFactor=team?statFactorFor(rider,team,segment):0;
    // Alle effecten worden als punten bij de worp opgeteld of ervan afgetrokken.
    // Delen door tien bewaart het bestaande multiplierformaat voor scoring en klassementen.
    const effectiveRoll=baseDiceRoll+tacticRollBonus+(terrain*10)+(bikeBonus*10)+(statFactor*10)-(fatiguePenalty*10);
    let personalMultiplier=(effectiveRoll/10)*cardMods.factor;
    if(bonked)personalMultiplier=Math.min(personalMultiplier,0.5);
    personalMultiplier=Math.round(personalMultiplier*1000)/1000;

    if(exploded){
      rider.endurance=Math.min(rider.endurance,EXPLODE_ENDURANCE);
      rider.power=0;
    } else {
      let drain=effects.enduranceCost+positionEffects.enduranceCost+(segment.terrainType==='mountain'?MOUNTAIN_ENDURANCE_COST:0)+cardMods.endurance;
      drain=Math.max(0,drain)*(1-nutrition*0.08);
      rider.endurance=clamp(Math.round(rider.endurance-drain),0,100);
      const bidonBoost=fetchingBidons&&tactic!=='fetch_bidons'?FETCH_BIDONS_POWER:0;
      addPower(rider,powerDelta+positionEffects.powerDelta+bidonBoost+cardMods.power);
    }
    results[rider.id]={personalMultiplier, tactic, role, bonked, exploded, push:tactic==='attack'?push:null, target, position, protected:isProtected, crashImmune:isProtected, card:card?card.id:null};
    rider.position=POSITION_BY_TACTIC[tactic]||'middle';
  }
  Object.defineProperty(results,'cardEffect',{value:card?{id:card.id, level:card.level, cross:cardCrossEffect(card,resolved)}:null, enumerable:false});
  return results;
}

// Team-Tactics: een deckbuilding-schil bovenop de rennertactieken. Elke ploeg heeft per
// tactiek een upgradeLevel (0 = niet geactiveerd, max 5) en een actieveVoorraad aan kaarten.
// Per segment kan de speler één kaart spelen; de kaart geeft een modifier op de berekening
// van de gekozen rennertactieken en wordt daarna van de voorraad afgetrokken.
const TEAM_TACTIC_MAX_LEVEL = 5;
const TEAM_TACTIC_MAX_STOCK = 9;
const TEAM_TACTIC_ACTIVATE_COST = 6000;
const TEAM_TACTIC_UPGRADE_COSTS = [7000,10000,14000,19000]; // naar niveau 2..5
const TEAM_TACTIC_CARD_COST = 1500;
const TEAM_TACTICS = [
  {id:'lead_out', naam:'Lead-out', beschrijving:'Wie aanvalt terwijl een ploeggenoot Kop of Lead-out rijdt, krijgt een extra bonus op de worp.',
    effect:(L) => `Aanval achter een Kop/Lead-out: +${(1+0.5*L).toFixed(1)} op de worp`},
  {id:'eindsprint', naam:'Gereed voor eindsprint', beschrijving:'De hele ploeg gaat vol in het laatste segment.',
    effect:(L) => `Laatste segment: +${(1.5+0.5*L).toFixed(1)} op de worp voor alle renners · elders +0,5`},
  {id:'bergpunten', naam:'Bergpunten pakken', beschrijving:'Op berg- en heuvelsegmenten rijdt de ploeg voor de bolletjes.',
    effect:(L) => `Berg/heuvels: +${(1+0.4*L).toFixed(1)} op de worp · +${L} bergpunten bij een score`},
  {id:'tussensprint', naam:'Tussensprint pakken', beschrijving:'In een segment met tussensprint gaat de ploeg voor de groene punten.',
    effect:(L) => `Tussensprint: +${(1+0.5*L).toFixed(1)} op de worp · +${L} sprintpunten bij een score`},
  {id:'vroege_vlucht', naam:'Vroege vlucht', beschrijving:'Aanvallen in de eerste drie segmenten kost minder explosiviteit.',
    effect:(L) => `Segment 1-3: Val aan kost ${5+3*L} explosiviteit minder · +${(0.5*L).toFixed(1)} op de worp`},
  {id:'uit_de_wind', naam:'Kopman uit de wind zetten', beschrijving:'Verlaagt de vermoeidheid van renners die Kop of Volg rijden.',
    effect:(L) => `Kop/Volg: −${(1+0.6*L).toFixed(1)} uithouding-verbruik · +${L} explosiviteit`},
  {id:'gat_dichtrijden', naam:'Gat dichtrijden', beschrijving:'Bonus op Kop vanuit een slechte positie (peloton, staart of achteraan in de groep), maar het kost extra energie.',
    effect:(L) => `Kop vanuit slechte positie: +${(1.5+0.5*L).toFixed(1)} op de worp · +${8-L} uithouding-verbruik`},
  {id:'meeschuiven', naam:'Meeschuiven / Schaduwen', beschrijving:'Maakt Volg nagenoeg gratis qua energie.',
    effect:(L) => `Volg: geen uithouding-verbruik · +${2+2*L} explosiviteit extra`},
  {id:'bordje_leeg', naam:'Bordje leeg eten', beschrijving:'Knechtenactie: wie Bidons haalt, Beschermt of Kop rijdt, laat het peloton afzien.',
    effect:(L) => `Knechten +1 op de worp · alle andere ploegen −${(0.3+0.2*L).toFixed(1)} op de worp`},
  {id:'waaier', naam:'Waaier trekken', beschrijving:'Sterke multiplier voor de hele ploeg; renners van andere ploegen die Herstellen worden afgestraft.',
    effect:(L) => `Ploeg ×${(1.1+0.06*L).toFixed(2)} · Herstel bij andere ploegen −${(1+0.3*L).toFixed(1)} op de worp`}
];
const TEAM_TACTIC_BY_ID = new Map(TEAM_TACTICS.map((tactic) => [tactic.id,tactic]));
const KNECHT_TACTICS = new Set(['fetch_bidons','protect','leadout']);

function defaultTeamTactics(){
  return Object.fromEntries(TEAM_TACTICS.map((tactic) => [tactic.id,{upgradeLevel:0, actieveVoorraad:0}]));
}
function sanitizeTeamTactics(saved){
  const tactics=defaultTeamTactics();
  if(saved&&typeof saved==='object'){
    for(const id of Object.keys(tactics)){
      const row=saved[id];
      if(!row||typeof row!=='object')continue;
      tactics[id].upgradeLevel=clamp(Math.floor(Number(row.upgradeLevel)||0),0,TEAM_TACTIC_MAX_LEVEL);
      tactics[id].actieveVoorraad=tactics[id].upgradeLevel?clamp(Math.floor(Number(row.actieveVoorraad)||0),0,TEAM_TACTIC_MAX_STOCK):0;
    }
  }
  return tactics;
}
function teamTacticCosts(row){
  return {
    activate:TEAM_TACTIC_ACTIVATE_COST,
    upgrade:row.upgradeLevel>=1&&row.upgradeLevel<TEAM_TACTIC_MAX_LEVEL?TEAM_TACTIC_UPGRADE_COSTS[row.upgradeLevel-1]:null,
    card:TEAM_TACTIC_CARD_COST
  };
}
function serializeTeamTactics(team){
  const tactics=team.tactics||defaultTeamTactics();
  return TEAM_TACTICS.map((tactic) => {
    const row=tactics[tactic.id]||{upgradeLevel:0,actieveVoorraad:0};
    return {
      id:tactic.id, naam:tactic.naam, beschrijving:tactic.beschrijving,
      upgradeLevel:row.upgradeLevel, actieveVoorraad:row.actieveVoorraad, maxLevel:TEAM_TACTIC_MAX_LEVEL, maxStock:TEAM_TACTIC_MAX_STOCK,
      effect:tactic.effect(Math.max(1,row.upgradeLevel)), nextEffect:row.upgradeLevel>=1&&row.upgradeLevel<TEAM_TACTIC_MAX_LEVEL?tactic.effect(row.upgradeLevel+1):null,
      costs:teamTacticCosts(row)
    };
  });
}

// Modifiers van een gespeelde kaart voor één renner. context: {segment, resolved (alle
// rennertactieken van de ploeg), groups (riderId → koersgroep)}. Geeft {roll, endurance,
// power, factor} terug; alles is additief op de gewone berekening.
function cardModifiersFor(card,rider,tactic,context){
  const mods={roll:0, endurance:0, power:0, factor:1};
  if(!card)return mods;
  const L=card.level;
  const {segment,resolved,groups}=context;
  const isLast=segment.segmentIndex>=SEGMENTS_PER_RACE-1;
  if(card.id==='lead_out'){
    const hasKop=Object.values(resolved).some((entry) => entry.tactic==='leadout'||entry.tactic==='sprint_leadout');
    if(tactic==='attack'&&hasKop)mods.roll+=1+0.5*L;
  } else if(card.id==='eindsprint'){
    mods.roll+=isLast?1.5+0.5*L:0.5;
  } else if(card.id==='bergpunten'){
    if(segment.terrainType==='mountain'||segment.terrainType==='hills')mods.roll+=1+0.4*L;
  } else if(card.id==='tussensprint'){
    if(segment.hasIntermediateSprint)mods.roll+=1+0.5*L;
  } else if(card.id==='vroege_vlucht'){
    if(segment.segmentIndex<=2&&tactic==='attack'){mods.power+=5+3*L;mods.roll+=0.5*L}
  } else if(card.id==='uit_de_wind'){
    if(tactic==='leadout'||tactic==='follow'){mods.endurance-=1+0.6*L;mods.power+=L}
  } else if(card.id==='gat_dichtrijden'){
    const badSpot=['peloton','tail'].includes(groups?.[rider.id])||rider.position==='back';
    if(tactic==='leadout'&&badSpot){mods.roll+=1.5+0.5*L;mods.endurance+=8-L}
  } else if(card.id==='meeschuiven'){
    if(tactic==='follow'){mods.endurance-=TACTIC_EFFECTS.follow.enduranceCost;mods.power+=2+2*L}
  } else if(card.id==='bordje_leeg'){
    if(KNECHT_TACTICS.has(tactic))mods.roll+=1;
  } else if(card.id==='waaier'){
    mods.factor=1.1+0.06*L;
  }
  return mods;
}

// Effect van een kaart op de andere ploegen (toegepast in closeSegment): een worp-penalty
// voor iedereen (Bordje leeg eten, alleen als er echt knechtenwerk gedaan werd) of enkel
// voor renners die Herstel kozen (Waaier trekken).
function cardCrossEffect(card,resolved){
  if(!card)return null;
  const L=card.level;
  if(card.id==='bordje_leeg'){
    const worked=Object.values(resolved).some((entry) => KNECHT_TACTICS.has(entry.tactic));
    return worked?{penaltyAll:Math.round((0.3+0.2*L)*10)/10}:null;
  }
  if(card.id==='waaier')return {penaltyRecover:Math.round((1+0.3*L)*10)/10};
  return null;
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
    segments.push({segmentIndex:i, totalSegments:SEGMENTS_PER_RACE, terrainType, elevationGain:elevationGainFor(terrainType), hasIntermediateSprint:false, mountainCategory:0, isSprint:false});
  }
  const sprintCandidates=segments.filter((segment,index) => index<SEGMENTS_PER_RACE-1&&(segment.terrainType==='flat'||segment.terrainType==='hills'));
  if(sprintCandidates.length)pick(sprintCandidates).hasIntermediateSprint=true;
  const mountainSegments=segments.filter((segment) => segment.terrainType==='mountain').sort((a,b) => b.elevationGain-a.elevationGain);
  mountainSegments.forEach((segment,index) => {segment.mountainCategory=Math.min(4,index+1)});
  // Sprintsegmenten (tussensprint of een vlakke/heuvelachtige/kasseien-finale) laten een lead-out toe.
  const finale=segments[SEGMENTS_PER_RACE-1];
  if(['flat','hills','cobbles'].includes(finale.terrainType))finale.isSprint=true;
  for(const segment of segments)if(segment.hasIntermediateSprint)segment.isSprint=true;
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
  timeTrial:{timeTrial:0.8,stamina:0.2},
  cobbled:{cobbles:0.5,flat:0.3,stamina:0.2}
};
const STAGE_TYPE_LABELS = {flat:'Vlak',hilly:'Heuvelachtig',mountain:'Bergrit',timeTrial:'Tijdrit',cobbled:'Kasseirit'};
const STAGE_DIFFICULTY = {flat:6,hilly:7,mountain:9,timeTrial:8,cobbled:8};

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

// Elke meerdaagse koers (Grote Ronde of kortere rittenkoers) deelt dezelfde ritmotor:
// een route van rittypes, een eindklassementsprijs en een geaggregeerd terreinprofiel.
function stageRace(id,name,category,route,overallPrize){
  return {id, name, category, stages:route.length, route, overallPrize, terrain:aggregateTerrain(route)};
}

function grandTour(id,name,route,overallPrize){
  if(route.length!==STAGES_PER_GRAND_TOUR)throw new Error(`Grote Ronde ${id} moet ${STAGES_PER_GRAND_TOUR} ritten tellen.`);
  return stageRace(id,name,'grand_tour',route,overallPrize);
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
// Rittenkoersen van 5 tot 8 dagen: de klassieke voorbereidingsrondes die tussen de
// eendagskoersen en de Grote Rondes in zitten.
const STAGE_RACE_CATALOG = [
  stageRace('parijs-nice','Parijs-Nice','stage_race',
    ['flat','flat','timeTrial','hilly','mountain','hilly','mountain','hilly'],70000),
  stageRace('tirreno-adriatico','Tirreno-Adriatico','stage_race',
    ['timeTrial','flat','hilly','mountain','mountain','hilly','flat'],65000),
  stageRace('ronde-van-catalonie','Ronde van Catalonië','stage_race',
    ['flat','hilly','mountain','mountain','hilly','mountain','hilly'],55000),
  stageRace('ronde-van-het-baskenland','Ronde van het Baskenland','stage_race',
    ['timeTrial','hilly','mountain','hilly','mountain','hilly'],50000),
  stageRace('ronde-van-romandie','Ronde van Romandië','stage_race',
    ['timeTrial','hilly','mountain','hilly','mountain','timeTrial'],45000),
  stageRace('criterium-du-dauphine','Critérium du Dauphiné','stage_race',
    ['flat','hilly','flat','timeTrial','mountain','mountain','hilly','mountain'],70000),
  stageRace('ronde-van-zwitserland','Ronde van Zwitserland','stage_race',
    ['flat','hilly','timeTrial','mountain','mountain','hilly','mountain','timeTrial'],65000),
  stageRace('ronde-van-polen','Ronde van Polen','stage_race',
    ['flat','flat','hilly','hilly','timeTrial','hilly','flat'],45000),
  stageRace('renewi-tour','Renewi Tour','stage_race',
    ['flat','cobbled','hilly','hilly','timeTrial'],35000),
  stageRace('ronde-van-groot-brittannie','Ronde van Groot-Brittannië','stage_race',
    ['flat','hilly','hilly','flat','hilly','hilly'],35000)
];
const STAGE_RACE_CATEGORIES = new Set(['grand_tour','stage_race']);
const TOUR_CATALOG = [...GRAND_TOUR_CATALOG,...STAGE_RACE_CATALOG];
const GRAND_TOUR_BY_ID = new Map(TOUR_CATALOG.map((tour) => [tour.id, tour]));
const RACE_POOLS = new Map([...RACE_CATALOG,...TOUR_CATALOG].map((race) => {
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
    category:tour.category, terrain:STAGE_TERRAIN[stageType], stageType,
    basePrize:prizeForDifficulty(STAGE_DIFFICULTY[stageType]),
    tourId:tour.id, tourName:tour.name, stageNumber:parsed.stageNumber, totalStages:tour.stages
  };
}

function rand(min,max){return min+Math.random()*(max-min)}
function randInt(min,max){return Math.floor(rand(min,max+1))}
function pick(list){return list[Math.floor(Math.random()*list.length)]}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function makeId(prefix){return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`}

function baseMarketValueFor(stats){
  const avg=STAT_KEYS.reduce((sum,key)=>sum+stats[key],0)/STAT_KEYS.length;
  return avg*avg;
}
const ACTIVE_CATALOG_BASE_VALUES=RIDER_CATALOG.filter((rider) => !rider.retired)
  .map((rider) => baseMarketValueFor(rider.stats));
const MIN_CATALOG_BASE_VALUE=Math.min(...ACTIVE_CATALOG_BASE_VALUES);
const MAX_CATALOG_BASE_VALUE=Math.max(...ACTIVE_CATALOG_BASE_VALUES);

function marketValueFor(stats,age){
  const baseValue=baseMarketValueFor(stats);
  const position=(baseValue-MIN_CATALOG_BASE_VALUE)/(MAX_CATALOG_BASE_VALUE-MIN_CATALOG_BASE_VALUE);
  return Math.round((MIN_RIDER_PRICE+position*(MAX_RIDER_PRICE-MIN_RIDER_PRICE))/50)*50;
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

function shuffled(list){
  const result=[...list];
  for(let index=result.length-1;index>0;index-=1){
    const other=randInt(0,index);
    [result[index],result[other]]=[result[other],result[index]];
  }
  return result;
}

function resetStarterRiders(game,playerId){
  const activeCatalog=RIDER_CATALOG.filter((rider) => !rider.retired)
    .sort((a,b) => marketValueFor(a.stats,a.age)-marketValueFor(b.stats,b.age)||a.id.localeCompare(b.id));
  const cheapest=activeCatalog.slice(0,Math.ceil(activeCatalog.length*RESET_STARTER_POOL_FRACTION));
  const ownedByOthers=ownedRiderIds(game,playerId);
  const availableCatalog=activeCatalog.filter((rider) => !ownedByOthers.has(rider.id));
  const available=cheapest.filter((rider) => !ownedByOthers.has(rider.id));
  const resetPool=[...available];
  const poolSpecialisms=new Set(resetPool.map((rider) => rider.specialism));
  for(const rider of availableCatalog){
    if(poolSpecialisms.size>=RESET_STARTER_MIN_SPECIALISMS)break;
    if(poolSpecialisms.has(rider.specialism))continue;
    resetPool.push(rider);
    poolSpecialisms.add(rider.specialism);
  }
  const bySpecialism=new Map();
  for(const rider of resetPool){
    if(!bySpecialism.has(rider.specialism))bySpecialism.set(rider.specialism,[]);
    bySpecialism.get(rider.specialism).push(rider);
  }
  if(resetPool.length<RESET_STARTER_COUNT||bySpecialism.size<RESET_STARTER_MIN_SPECIALISMS){
    throw new Error('Er zijn onvoldoende goedkope, beschikbare renners om opnieuw te beginnen.');
  }
  const selected=shuffled([...bySpecialism.keys()]).slice(0,RESET_STARTER_MIN_SPECIALISMS)
    .map((specialism) => pick(bySpecialism.get(specialism)));
  const selectedIds=new Set(selected.map((rider) => rider.id));
  selected.push(...shuffled(resetPool.filter((rider) => !selectedIds.has(rider.id))).slice(0,RESET_STARTER_COUNT-selected.length));
  return shuffled(selected).map(makeRealRider);
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
const JERSEY_KEYS = ['gc','green','polka','youth','team'];
function defaultJerseys(){return Object.fromEntries(JERSEY_KEYS.map((key) => [key,0]))}
function defaultCareer(){return {victories:0,podiums:0,monumentsWon:0,grandToursWon:0,stageRacesWon:0,gtStagesWon:0,prizeMoney:0,racesEntered:0,raceWins:{},jerseys:defaultJerseys()}}

// Erelijst per koers: één teller per koers-id, zodat het clubleaderboard kan tonen
// wie welke koers hoe vaak won. Meerdaagse koersen tellen op de eindwinnaar.
function recordRaceWin(career,raceId){
  if(!raceId)return;
  if(!career.raceWins||typeof career.raceWins!=='object')career.raceWins={};
  career.raceWins[raceId]=(Number(career.raceWins[raceId])||0)+1;
}

function recordJersey(career,jerseyKey){
  if(!JERSEY_KEYS.includes(jerseyKey))return;
  if(!career.jerseys||typeof career.jerseys!=='object')career.jerseys=defaultJerseys();
  career.jerseys[jerseyKey]=(Number(career.jerseys[jerseyKey])||0)+1;
}

// Oude opslag kent raceWins/jerseys nog niet, en een handmatig aangepaste save mag
// de erelijst niet kunnen breken: alles wordt hier naar getallen teruggebracht.
function sanitizeCareer(saved){
  const career={...defaultCareer(),...(saved||{})};
  const rawWins=saved?.raceWins;
  career.raceWins={};
  if(rawWins&&typeof rawWins==='object'){
    for(const [raceId,count] of Object.entries(rawWins)){
      const wins=Math.max(0,Math.floor(Number(count)||0));
      if(wins)career.raceWins[String(raceId)]=wins;
    }
  }
  const rawJerseys=saved?.jerseys;
  career.jerseys=defaultJerseys();
  if(rawJerseys&&typeof rawJerseys==='object'){
    for(const key of JERSEY_KEYS)career.jerseys[key]=Math.max(0,Math.floor(Number(rawJerseys[key])||0));
  }
  return career;
}

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
    career:sanitizeCareer(saved?.career),
    raceCount:Math.max(0,Number(saved?.raceCount)||0),
    tactics:sanitizeTeamTactics(saved?.tactics)
  };
}

function defaultTeam(isNpc){
  return {
    wallet:STARTING_WALLET, riders:starterRiders(isNpc?0:STARTER_RIDERS), shop:defaultShop(),
    career:defaultCareer(), raceCount:0, tactics:defaultTeamTactics()
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

// NPC-tactiekkeuze: aangekondigde renners (koersradio) vallen gegarandeerd aan, de rest herstelt
// bij een lege rode balk, valt aan op passend terrein (soms met hogere inzet), beschermt af en toe
// de kopman en zet in een sprintsegment een lead-out op voor de sprinter.
function autoTacticsFor(player,prog,segment,race){
  const tactics={},gels={},targets={},pushes={};
  const riders=activeRiderIds(prog).map((riderId) => player.team.riders.find((candidate) => candidate.id===riderId)).filter(Boolean);
  for(const rider of riders)ensureRaceEnergy(rider);
  const hinted=new Map((race?.hints||[]).filter((hint) => hint.playerId===player.id).map((hint) => [hint.riderId,hint]));
  const fit=(rider) => terrainFactorFor(riderRole(rider),segment.terrainType)+(player.team?statFactorFor(rider,player.team,segment):0);
  const ranked=riders.slice().sort((a,b) => fit(b)-fit(a));
  const leader=ranked[0];
  for(const rider of riders){
    const hint=hinted.get(rider.id);
    if(hint?.willAttack){
      tactics[rider.id]='attack';
      pushes[rider.id]=rider.power>=ATTACK_PUSH_LEVELS[2].cost&&Math.random()<0.3?2:1;
    } else if(isBonked(rider)||rider.power<15)tactics[rider.id]='recover';
    else if(rider.endurance<30)tactics[rider.id]=Math.random()<0.5?'recover':'follow';
    else if(isSprintSegment(segment)&&riders.length>1&&rider!==leader&&riderRole(leader)==='sprinter'&&rider.power>=SPRINT_LEADOUT_MIN_POWER&&Math.random()<0.4){
      tactics[rider.id]='sprint_leadout';targets[rider.id]=leader.id;
    } else if(riders.length>1&&rider!==leader&&rider.power>=-TACTIC_EFFECTS.protect.powerDelta&&Math.random()<0.2){
      tactics[rider.id]='protect';targets[rider.id]=leader.id;
    } else if(fit(rider)>0&&rider.power>=ATTACK_PUSH_LEVELS[1].cost&&Math.random()<0.5){
      tactics[rider.id]='attack';
      pushes[rider.id]=rider.power>=ATTACK_PUSH_LEVELS[2].cost&&Math.random()<0.25?2:1;
    } else tactics[rider.id]='follow';
    if(rider.power<40&&rider.gelsRemaining>0&&Math.random()<0.6)gels[rider.id]=true;
  }
  return {tactics,gels,targets,pushes};
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
    for(const riderId of riderIds){
      riders[riderId]={pr:0,timeAccumulated:0,pointsGreen:0,pointsPolka:0,segments:[],dnf:false};
      const rider=player.team.riders.find((candidate) => candidate.id===riderId);
      if(rider)initRaceEnergy(rider);
    }
    game.race.progress[player.id]={pendingRoll:null, pendingEvent:null, lastEvent:null, lastEventType:null, confirmed:false, riders, usedTactics:[], cardEffect:null};
  }
  buildHints(game);
}

// Koersradio: kondigt per segment 1-2 NPC-renners aan die "naar voren schuiven". Meestal (70%)
// vallen ze echt aan; wie ze met Volg renner markeert, zit dan in de juiste ontsnapping.
const HINT_RELIABILITY = 0.7;
const HINT_CANDIDATE_POOL = 6;
function buildHints(game){
  const race=game.race;
  const segment=race.segments[race.segmentIndex];
  race.hints=[];
  if(!segment)return;
  const candidates=[];
  for(const player of raceActors(game)){
    if(!player.isNpc)continue;
    const prog=race.progress[player.id];
    if(!prog)continue;
    for(const riderId of activeRiderIds(prog)){
      const rider=player.team.riders.find((candidate) => candidate.id===riderId);
      if(!rider)continue;
      ensureRaceEnergy(rider);
      if(isBonked(rider)||rider.power<ATTACK_PUSH_LEVELS[1].cost)continue;
      candidates.push({player,rider,fit:terrainFactorFor(riderRole(rider),segment.terrainType)+statFactorFor(rider,player.team,segment)});
    }
  }
  const pool=shuffled(candidates.sort((a,b) => b.fit-a.fit).slice(0,HINT_CANDIDATE_POOL));
  race.hints=pool.slice(0,randInt(1,2)).map(({player,rider}) => ({
    playerId:player.id, riderId:rider.id, riderName:rider.name,
    teamName:TEAM_BY_ID.get(rider.teamId)?.name||player.name,
    willAttack:Math.random()<HINT_RELIABILITY
  }));
}
function rivalAttackMap(race){
  return Object.fromEntries((race.hints||[]).map((hint) => [hint.riderId,Boolean(hint.willAttack)]));
}

// Dynamische gebeurtenissen halverwege een segment: na de worp pauzeert de rit met een keuze
// die energie en worp beïnvloedt. Alleen menselijke spelers krijgen events.
const EVENT_CHANCE = 0.3;
const RACE_EVENT_TYPES = ['crosswind','puncture','crash_ahead','feedzone','tailwind'];
const EVENT_TERRAINS = {crosswind:['flat','cobbles','hills']};
function buildRaceEvent(type,riders){
  const rider=riders[Math.floor(Math.random()*riders.length)];
  const name=rider?.name||'je renner';
  if(type==='crosswind')return {type, riderId:null, title:'Zijwind!', text:'Het peloton breekt in waaiers. Wie niet vooraan zit, dreigt de slag te missen.', options:[
    {key:'echelon', label:'Mee in de waaier', detail:'Alle renners −15 explosiviteit, +1 op de worp.'},
    {key:'sit_in', label:'Laat lopen', detail:'Staart −2 en buik −1 op de worp; wie op kop zit blijft ongedeerd.'}
  ]};
  if(type==='puncture')return {type, riderId:rider?.id||null, title:`Lekke band voor ${name}!`, text:'De volgwagen zit ver. Wachten kost de hele ploeg, alleen terugkeren kost hem energie.', options:[
    {key:'wait', label:'De ploeg wacht', detail:'Alle renners −1 op de worp.'},
    {key:'chase', label:`${name} keert alleen terug`, detail:`${name}: −25 explosiviteit en −1 op de worp.`},
    ...(rider&&rider.gelsRemaining>0?[{key:'gel', label:'Gel en jagen', detail:`${name} verbruikt een gel: −10 explosiviteit, geen worp-penalty.`}]:[])
  ]};
  if(type==='crash_ahead')return {type, riderId:null, title:'Valpartij vooraan!', text:'Renners gaan tegen de grond en het peloton schuift door de gaten.', options:[
    {key:'brake', label:'Remmen', detail:'Alle renners −1 op de worp, iedereen blijft recht.'},
    {key:'push_through', label:'Doorrijden', detail:'Geen penalty, maar buik 15% en staart 30% kans om te vallen (−3 worp, −20 explosiviteit). Beschermde renners vallen niet.'}
  ]};
  if(type==='feedzone')return {type, riderId:null, title:'Bevoorradingszone', text:'De soigneurs staan klaar langs de weg.', options:[
    {key:'grab', label:'Bidons pakken', detail:'Alle renners +15 explosiviteit, −1 op de worp.'},
    {key:'skip', label:'Doorrijden', detail:'Geen effect.'}
  ]};
  return {type:'tailwind', riderId:null, title:'Rugwind', text:'De wind draait mee. Tempo maken of meesurfen?', options:[
    {key:'tempo', label:'Tempo maken', detail:'Alle renners +2 op de worp, −10 explosiviteit.'},
    {key:'surf', label:'Meesurfen', detail:'Alle renners +1 op de worp.'}
  ]};
}
function maybeTriggerEvent(prog,riders,segment,chance=EVENT_CHANCE){
  if(!riders.length||Math.random()>=chance)return null;
  const eligible=RACE_EVENT_TYPES.filter((type) => type!==prog.lastEventType&&(!EVENT_TERRAINS[type]||EVENT_TERRAINS[type].includes(segment.terrainType)));
  if(!eligible.length)return null;
  return buildRaceEvent(pick(eligible),riders);
}
// Past de gekozen optie toe: energie wordt meteen aangepast, worp-modifiers komen in pendingRoll.
// Geeft de uitkomsttekst terug die de speler achteraf ziet.
function applyRaceEvent(prog,riders,choiceKey){
  const event=prog.pendingEvent;
  if(!event)throw new Error('Er is geen gebeurtenis om op te reageren.');
  const option=event.options.find((candidate) => candidate.key===choiceKey);
  if(!option)throw new Error('Onbekende keuze.');
  const pending=prog.pendingRoll||{};
  const modifiers=pending.rollModifiers||{};
  const addRoll=(riderId,delta) => {modifiers[riderId]=(modifiers[riderId]||0)+delta};
  const tactics=pending.tactics||{};
  const targets=pending.targets||{};
  const isProtected=(riderId) => riders.some((rider) => tactics[rider.id]==='protect'&&targets[rider.id]===riderId);
  const subject=riders.find((rider) => rider.id===event.riderId);
  let outcome=option.label;
  for(const rider of riders)ensureRaceEnergy(rider);
  if(option.key==='echelon'){for(const rider of riders){addPower(rider,-15);addRoll(rider.id,1)}}
  else if(option.key==='sit_in'){for(const rider of riders){if(rider.position==='back')addRoll(rider.id,-2);else if(rider.position==='middle')addRoll(rider.id,-1)}}
  else if(option.key==='wait'){for(const rider of riders)addRoll(rider.id,-1)}
  else if(option.key==='chase'&&subject){addPower(subject,-25);addRoll(subject.id,-1)}
  else if(option.key==='gel'&&subject){
    if(subject.gelsRemaining>0){subject.gelsRemaining-=1;addPower(subject,-10)}
    else {addPower(subject,-25);addRoll(subject.id,-1);outcome=`${subject.name} had geen gel meer en keert alleen terug`}
  }
  else if(option.key==='brake'){for(const rider of riders)addRoll(rider.id,-1)}
  else if(option.key==='push_through'){
    const fallen=[];
    for(const rider of riders){
      if(isProtected(rider.id))continue;
      const risk=rider.position==='back'?0.30:rider.position==='middle'?0.15:0;
      if(Math.random()<risk){addRoll(rider.id,-3);addPower(rider,-20);fallen.push(rider.name)}
    }
    outcome=fallen.length?`Doorrijden — ${fallen.join(' en ')} ging tegen de grond`:'Doorrijden — iedereen bleef recht';
  }
  else if(option.key==='grab'){for(const rider of riders){addPower(rider,15);addRoll(rider.id,-1)}}
  else if(option.key==='tempo'){for(const rider of riders){addPower(rider,-10);addRoll(rider.id,2)}}
  else if(option.key==='surf'){for(const rider of riders)addRoll(rider.id,1)}
  pending.rollModifiers=modifiers;
  prog.pendingRoll=pending;
  prog.lastEvent={type:event.type, title:event.title, choice:option.label, outcome};
  prog.lastEventType=event.type;
  prog.pendingEvent=null;
  return outcome;
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
function maybeCrash(rider,team,roll,step={}){
  if(roll!==1||step.crashImmune)return false;
  const crashChance=clamp(0.30-team.shop.medical*0.06,0.04,0.30)*(POSITION_EFFECTS[step.position]?.crashFactor??1);
  if(Math.random()>=crashChance)return false;
  const duration=Math.max(1,randInt(3,6)-Math.floor(team.shop.medical*0.6));
  applyUnavailable(rider,team,duration,'injured');
  return true;
}

function resolveSegmentFor(game,player){
  const race=game.race;
  const prog=race.progress[player.id];
  if(!prog||prog.confirmed||!prog.pendingRoll||prog.pendingEvent)return;
  const {roll,tactics,gels,targets,pushes,rollModifiers,card}=prog.pendingRoll;
  const activeIds=activeRiderIds(prog);
  const riders=activeIds.map((riderId) => player.team.riders.find((candidate) => candidate.id===riderId)).filter(Boolean);
  const segment=race.segments[race.segmentIndex];
  const situation=buildRaceSituation(game);
  const groups=Object.fromEntries(activeIds.map((riderId) => [riderId,situation.byEntry[`${player.id}:${riderId}`]?.raceGroup||null]));
  const cardRow=card&&player.team.tactics?.[card]?player.team.tactics[card]:null;
  const playedCard=cardRow&&cardRow.upgradeLevel>=1&&cardRow.actieveVoorraad>0?{id:card, level:cardRow.upgradeLevel}:null;
  const steps=calculateSegmentStep(riders,tactics,gels,segment,roll,player.team,{targets,pushes,rollModifiers,rivalAttacks:rivalAttackMap(race),card:playedCard,groups});
  prog.cardEffect=steps.cardEffect;
  if(playedCard){
    cardRow.actieveVoorraad-=1;
    prog.usedTactics.push(playedCard.id);
  }
  for(const rider of riders){
    const state=prog.riders[rider.id];
    const step=steps[rider.id];
    if(!state||!step)continue;
    const entry={n:race.segmentIndex+1, roll, tactic:step.tactic, multiplier:step.personalMultiplier, push:step.push, exploded:step.exploded, position:step.position, event:prog.lastEvent?.title||null};
    if(maybeCrash(rider,player.team,roll,step)){
      state.dnf=true;
      clearRaceEnergy(rider);
      state.segments.push({...entry, outcome:'valt'});
      continue;
    }
    const score=scoreFromMultiplier(step.personalMultiplier);
    state.pr+=score;
    state.segments.push({...entry, outcome:score>=6?'topdag':score<=-4?'pech':'normaal'});
  }
  prog.pendingRoll=null;
  prog.confirmed=true;
}

// Sluit een segment af zodra iedereen bevestigd heeft: berekent het veldgemiddelde
// (voor het tijdsverschil in het algemeen klassement) en kent tussensprint-/bergpunten toe.
function closeSegment(game){
  const race=game.race;
  const segment=race.segments[race.segmentIndex];
  const segmentResults=[];
  for(const player of raceActors(game)){
    const prog=race.progress[player.id];
    if(!prog)continue;
    for(const riderId of Object.keys(prog.riders)){
      const state=prog.riders[riderId];
      const entrySegment=state.segments.find((candidate) => candidate.n===race.segmentIndex+1);
      if(!entrySegment||entrySegment.outcome==='valt')continue;
      segmentResults.push({playerId:player.id, riderId, state, multiplier:entrySegment.multiplier});
    }
  }
  if(!segmentResults.length)return;
  applyCardCrossEffects(game,segmentResults);
  const fieldAverage=segmentResults.reduce((sum,result) => sum+result.multiplier,0)/segmentResults.length;
  for(const result of segmentResults) result.state.timeAccumulated+=timeDeltaFromMultiplier(result.multiplier,fieldAverage);

  const cardFor=(playerId) => race.progress[playerId]?.cardEffect;
  if(game.grandTour&&segment.hasIntermediateSprint){
    segmentResults.slice().sort((a,b) => b.multiplier-a.multiplier).slice(0,SPRINT_POINTS.length)
      .forEach((result,index) => {
        result.state.pointsGreen+=SPRINT_POINTS[index];
        if(cardFor(result.playerId)?.id==='tussensprint')result.state.pointsGreen+=cardFor(result.playerId).level;
      });
  }
  if(game.grandTour&&segment.mountainCategory>0){
    const points=MOUNTAIN_POINTS[segment.mountainCategory]||0;
    if(points)segmentResults.slice().sort((a,b) => b.multiplier-a.multiplier).slice(0,3)
      .forEach((result,index) => {
        result.state.pointsPolka+=Math.round(points/(index+1));
        if(cardFor(result.playerId)?.id==='bergpunten')result.state.pointsPolka+=cardFor(result.playerId).level;
      });
  }
  for(const player of raceActors(game)){const prog=race.progress[player.id];if(prog)prog.cardEffect=null}
}

// Kaarten met een effect op andere ploegen (Bordje leeg eten, Waaier trekken): verlaagt de
// segmentmultiplier van de andere renners en corrigeert hun al geboekte segmentscore.
function applyCardCrossEffects(game,segmentResults){
  const race=game.race;
  for(const source of raceActors(game)){
    const cross=race.progress[source.id]?.cardEffect?.cross;
    if(!cross)continue;
    for(const result of segmentResults){
      if(result.playerId===source.id)continue;
      const entrySegment=result.state.segments.find((candidate) => candidate.n===race.segmentIndex+1);
      if(!entrySegment)continue;
      let penalty=0;
      if(cross.penaltyAll)penalty+=cross.penaltyAll;
      if(cross.penaltyRecover&&entrySegment.tactic==='recover')penalty+=cross.penaltyRecover;
      if(!penalty)continue;
      const before=entrySegment.multiplier;
      const after=Math.round((before-penalty/10)*1000)/1000;
      entrySegment.multiplier=after;
      result.multiplier=after;
      result.state.pr+=scoreFromMultiplier(after)-scoreFromMultiplier(before);
    }
  }
}

// Beloning: wie top 3 rijdt in de rit of een leiderstrui pakt, krijgt de gespeelde kaarten terug.
function refundTeamTactics(game,race,qualifiesFor){
  const refunds={};
  for(const player of game.players){
    const prog=race.progress[player.id];
    const used=prog?.usedTactics||[];
    if(!used.length||!qualifiesFor(player))continue;
    for(const id of used){
      const row=player.team.tactics?.[id];
      if(row)row.actieveVoorraad=Math.min(TEAM_TACTIC_MAX_STOCK,row.actieveVoorraad+1);
    }
    refunds[player.id]=used.slice();
  }
  return refunds;
}
function usedTacticsByPlayer(game,race){
  return Object.fromEntries(game.players.map((player) => [player.id,(race.progress[player.id]?.usedTactics||[]).slice()]));
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
        const rider=player.team.riders.find((candidate) => candidate.id===riderId);
        if(!rider)continue;
        // De groene balk wordt na de rit weer blijvende vermoeidheid; uitvallers houden wat ze hadden.
        if(!prog.riders[riderId].dnf){
          ensureRaceEnergy(rider);
          rider.fatigue=clamp(Math.round(100-rider.endurance)+Math.max(6,22-player.team.shop.nutrition*3),0,100);
        }
        clearRaceEnergy(rider);
      }
    }
    finalizeRace(game);
    return true;
  }
  for(const player of raceActors(game)){
    const prog=race.progress[player.id];
    if(prog){prog.confirmed=false;prog.lastEvent=null}
  }
  buildHints(game);
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

  if(game.grandTour&&STAGE_RACE_CATEGORIES.has(catalogRace.category)){
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
      recordRaceWin(player.team.career,race.raceId);
    }
    if(best&&best.place<=3)player.team.career.podiums+=1;
    if((race.lineups[player.id]||[]).length)player.team.career.racesEntered+=1;
    player.team.career.prizeMoney+=prizeWon;
    payouts.push({playerId:player.id, prizeWon, bestPlace:best?best.place:null});
  }
  const bestPlaceById=new Map(payouts.map((entry) => [entry.playerId,entry.bestPlace]));
  const usedTactics=usedTacticsByPlayer(game,race);
  const tacticRefunds=refundTeamTactics(game,race,(player) => (bestPlaceById.get(player.id)||99)<=3);

  game.lastResult={
    usedTactics, tacticRefunds,
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

// Richttijd per rittype: de leider krijgt een echte totaaltijd, de rest een achterstand op hem.
const STAGE_BASE_SECONDS = {flat:4*3600+18*60, hilly:4*3600+42*60, mountain:5*3600+9*60, timeTrial:44*60, cobbled:4*3600+51*60};
const TEAM_CLASSIFICATION_MIN_RIDERS = 3;
function formatRaceTime(seconds){
  const total=Math.max(0,Math.round(seconds));
  const hours=Math.floor(total/3600), minutes=Math.floor((total%3600)/60), rest=total%60;
  return `${hours}u${String(minutes).padStart(2,'0')}'${String(rest).padStart(2,'0')}"`;
}
function tourBaseSeconds(grandTour){
  return (grandTour?.stageLog||[]).reduce((sum,stage) => sum+(STAGE_BASE_SECONDS[stage.type]||0),0);
}

// Berekent alle vijf klassementen (geel/groen/bolletjes/wit/ploegen) uit de gc-boekhouding
// van een Grote Ronde. Tijdklassementen tonen de leider met zijn totaaltijd en iedereen
// erachter met de achterstand (+Xs); value blijft de achterstand zodat 0 = leider.
// Het ploegenklassement telt per ploeg de beste drie renners: spelersploegen als geheel,
// het NPC-veld per echte ploeg, en alleen ploegen met minstens drie renners doen mee.
function classificationStandings(gc,baseSeconds=0){
  const entries=Object.values(gc);
  const withTime=(list,leaderTime) => list.map((entry,index) => {
    const gap=entry.value-leaderTime;
    return {...entry, value:gap, display:index===0?formatRaceTime(baseSeconds+leaderTime):`+${gap}s`};
  });
  const rankTime=(list) => {
    const sorted=list.slice().sort((a,b) => a.timeAccumulated-b.timeAccumulated)
      .map((entry,index) => ({place:index+1, playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName, value:entry.timeAccumulated, stageWins:entry.stageWins}));
    return sorted.length?withTime(sorted,sorted[0].value):[];
  };
  const rankPoints=(key) => entries.slice().sort((a,b) => b[key]-a[key])
    .map((entry,index) => ({place:index+1, playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName, value:entry[key], display:String(entry[key]), stageWins:entry.stageWins}));
  const squads=new Map();
  for(const entry of entries){
    const isField=entry.playerId===RACE_NPC_ID;
    const key=isField?`team:${entry.rider?.teamId||'field'}`:entry.playerId;
    if(!squads.has(key))squads.set(key,{playerId:entry.playerId, playerName:isField?(TEAM_BY_ID.get(entry.rider?.teamId)?.name||entry.playerName):entry.playerName, riders:[]});
    squads.get(key).riders.push(entry);
  }
  const teamSorted=[...squads.values()].filter((squad) => squad.riders.length>=TEAM_CLASSIFICATION_MIN_RIDERS).map((squad) => {
    const top=squad.riders.slice().sort((a,b) => a.timeAccumulated-b.timeAccumulated).slice(0,3);
    return {playerId:squad.playerId, playerName:squad.playerName, value:top.reduce((sum,entry) => sum+entry.timeAccumulated,0)};
  }).sort((a,b) => a.value-b.value).map((entry,index) => ({...entry,place:index+1}));
  return {
    gc:rankTime(entries),
    green:rankPoints('pointsGreen'),
    polka:rankPoints('pointsPolka'),
    youth:rankTime(entries.filter((entry) => entry.age<=25)),
    team:teamSorted.length?teamSorted.map((entry,index) => ({...entry, value:entry.value-teamSorted[0].value, display:index===0?formatRaceTime(baseSeconds*3+teamSorted[0].value):`+${entry.value-teamSorted[0].value}s`})):[]
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

  const standings=classificationStandings(game.grandTour.gc,tourBaseSeconds(game.grandTour));
  const leaders=new Set(JERSEY_KEYS.map((key) => (standings[key]||[]).find((entry) => entry.place===1)?.playerId).filter(Boolean));
  const bestPlaceById=new Map(payouts.map((entry) => [entry.playerId,entry.bestPlace]));
  const usedTactics=usedTacticsByPlayer(game,race);
  const tacticRefunds=refundTeamTactics(game,race,(player) => (bestPlaceById.get(player.id)||99)<=3||leaders.has(player.id));

  if(stageNumber>=tour.stages){
    finalizeGrandTourOverall(game,tour);
    game.lastResult.usedTactics=usedTactics;
    game.lastResult.tacticRefunds=tacticRefunds;
    return;
  }

  game.lastResult={
    usedTactics, tacticRefunds,
    type:'grand_tour_stage', tourId:tour.id, raceName:catalogRace.name, stageNumber, totalStages:tour.stages,
    classification:finishers.map((entry) => ({place:entry.place, playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName, event:entry.event, segments:entry.segments, prize:entry.prize||0})),
    dnfs:dnfs.map((entry) => ({playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName, event:entry.event, segments:entry.segments})),
    classifications:classificationStandings(game.grandTour.gc,tourBaseSeconds(game.grandTour))
  };
  game.phase='stageResult';
  game.race=null;
}

// Kent de vijf truien toe aan wie elk klassement wint. Renners uit het NPC-veld
// horen bij geen enkele speler, dus die leveren geen trui op.
function awardJerseys(game,classifications){
  const byId=new Map(game.players.map((player) => [player.id,player]));
  for(const key of JERSEY_KEYS){
    const winner=(classifications[key]||[]).find((entry) => entry.place===1);
    const player=winner&&byId.get(winner.playerId);
    if(player)recordJersey(player.team.career,key);
  }
}

function finalizeGrandTourOverall(game,tour){
  const gcEntries=Object.values(game.grandTour.gc).sort((a,b) => a.timeAccumulated-b.timeAccumulated);
  gcEntries.forEach((entry,index) => {entry.gcPlace=index+1});
  const classifications=classificationStandings(game.grandTour.gc,tourBaseSeconds(game.grandTour));
  awardJerseys(game,classifications);

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
      if(tour.category==='grand_tour')player.team.career.grandToursWon+=1;
      else player.team.career.stageRacesWon+=1;
      recordRaceWin(player.team.career,tour.id);
    }
    if(best&&best.gcPlace<=3)player.team.career.podiums+=1;
    if(gcEntries.some((entry) => entry.playerId===player.id))player.team.career.racesEntered+=1;
    payouts.push({playerId:player.id, gcPrize, gcPlace:best?best.gcPlace:null});
  }

  game.lastResult={
    type:'grand_tour_final', tourId:tour.id, raceName:tour.name, totalStages:tour.stages,
    stages:game.grandTour.stageLog,
    gc:gcEntries.slice(0,10).map((entry) => ({place:entry.gcPlace, playerId:entry.playerId, playerName:entry.playerName, riderId:entry.riderId, riderName:entry.riderName, stageWins:entry.stageWins})),
    classifications,
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

  if(action==='activateTactic'||action==='upgradeTactic'||action==='buyTacticCard'){
    if(game.phase!=='club')throw new Error('Dit kan alleen in de club.');
    const tactic=TEAM_TACTIC_BY_ID.get(payload.tacticId);
    if(!tactic)throw new Error('Onbekende tactiek.');
    if(!player.team.tactics)player.team.tactics=defaultTeamTactics();
    const row=player.team.tactics[tactic.id];
    const costs=teamTacticCosts(row);
    let cost=0;
    if(action==='activateTactic'){
      if(row.upgradeLevel>=1)throw new Error('Deze tactiek is al geactiveerd.');
      cost=costs.activate;
    } else if(action==='upgradeTactic'){
      if(row.upgradeLevel<1)throw new Error('Activeer deze tactiek eerst.');
      if(row.upgradeLevel>=TEAM_TACTIC_MAX_LEVEL)throw new Error('Deze tactiek zit al op het maximum.');
      cost=costs.upgrade;
    } else {
      if(row.upgradeLevel<1)throw new Error('Activeer deze tactiek eerst.');
      if(row.actieveVoorraad>=TEAM_TACTIC_MAX_STOCK)throw new Error(`Je kunt maximaal ${TEAM_TACTIC_MAX_STOCK} kaarten van een tactiek bewaren.`);
      cost=costs.card;
    }
    if(player.team.wallet<cost)throw new Error('Onvoldoende budget.');
    player.team.wallet-=cost;
    if(action==='activateTactic'){row.upgradeLevel=1;row.actieveVoorraad+=1}
    else if(action==='upgradeTactic')row.upgradeLevel+=1;
    else row.actieveVoorraad+=1;
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
    const riders=resetStarterRiders(game,playerId);
    player.team=defaultTeam(player.isNpc);
    player.team.riders=riders;
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
    const asMap=(value) => value&&typeof value==='object'?value:{};
    const tactics=asMap(payload.tactics);
    const gels=asMap(payload.gels);
    const targets=asMap(payload.targets);
    const pushes=asMap(payload.pushes);
    const segment=game.race.segments[game.race.segmentIndex];
    for(const riderId of activeIds){
      if(!RIDER_TACTICS.includes(tactics[riderId]))throw new Error('Ken elke renner een tactiek toe voor je rolt.');
      if(tactics[riderId]==='sprint_leadout'&&!isSprintSegment(segment))throw new Error('Een lead-out kan alleen in een sprintsegment.');
      if(TACTIC_TARGET[tactics[riderId]]==='teammate'&&(!activeIds.includes(targets[riderId])||targets[riderId]===riderId))throw new Error('Kies een ploeggenoot als doelwit.');
      if(tactics[riderId]==='mark'&&!(game.race.hints||[]).some((hint) => hint.riderId===targets[riderId]))throw new Error('Je kunt alleen een aangekondigde renner volgen.');
    }
    let card=null;
    if(payload.card){
      const row=player.team.tactics?.[payload.card];
      if(!TEAM_TACTIC_BY_ID.has(payload.card)||!row||row.upgradeLevel<1)throw new Error('Deze tactiekkaart is niet geactiveerd.');
      if(row.actieveVoorraad<1)throw new Error('Je hebt geen kaarten meer van deze tactiek.');
      card=payload.card;
    }
    prog.pendingRoll={roll:randInt(1,10), tactics, gels, targets, pushes, rollModifiers:{}, card};
    if(!player.isNpc){
      const riders=activeIds.map((riderId) => player.team.riders.find((candidate) => candidate.id===riderId)).filter(Boolean);
      prog.pendingEvent=maybeTriggerEvent(prog,riders,segment);
      if(prog.pendingEvent)return;
    }
    resolveSegmentFor(game,player);
    maybeAdvanceSegment(game);
    return;
  }

  if(action==='resolveEvent'){
    if(game.phase!=='racing'||!game.race)throw new Error('Er is geen actieve rit.');
    const prog=game.race.progress[playerId];
    if(!prog?.pendingEvent||!prog.pendingRoll)throw new Error('Er is geen gebeurtenis om op te reageren.');
    const riders=activeRiderIds(prog).map((riderId) => player.team.riders.find((candidate) => candidate.id===riderId)).filter(Boolean);
    applyRaceEvent(prog,riders,payload.choice);
    resolveSegmentFor(game,player);
    maybeAdvanceSegment(game);
    return;
  }

  if(action==='cancelRace'){
    if(!['lineup','racing','stageResult'].includes(game.phase))throw new Error('Er is geen koers om te annuleren.');
    if(playerId!==game.hostId)throw new Error('Alleen de host kan annuleren.');
    for(const candidate of game.players)for(const rider of candidate.team.riders)clearRaceEnergy(rider);
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
      const {tactics,gels,targets,pushes}=autoTacticsFor(player,prog,segment,game.race);
      prog.pendingRoll={roll:randInt(1,10), tactics, gels, targets, pushes, rollModifiers:{}};
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
      ...TOUR_CATALOG.map((tour) => ({id:tour.id, name:tour.name, category:tour.category, stages:tour.stages, overallPrize:tour.overallPrize, terrain:tour.terrain}))
    ],
    race:game.race?serializeRace(game,requesterId,catalogRace):null,
    grandTour:game.grandTour?serializeGrandTour(game):null,
    lastResult:game.lastResult,
    honours:game.phase==='club'?buildHonours(game):null,
    jerseyKeys:JERSEY_KEYS,
    log:game.log.slice(0,20),
    myScoutMarket:(game.scoutMarkets[requesterId]||[]).map(serializeRider),
    players:game.players.map((player) => ({
      id:player.id, name:player.name, isNpc:player.isNpc, connected:player.isNpc||connected.get(player.id),
      wallet:player.team.wallet, shop:player.team.shop, shopEffects:describeShopEffects(player.team.shop), career:player.team.career,
      tactics:player.isNpc?[]:serializeTeamTactics(player.team),
      riders:player.team.riders.map(serializeRider)
    }))
  };
}

function serializeGrandTour(game){
  const tour=GRAND_TOUR_BY_ID.get(game.grandTour.tourId);
  return {
    tourId:tour?.id, tourName:tour?.name||'', category:tour?.category||'grand_tour', stageNumber:game.grandTour.stageNumber,
    totalStages:tour?.stages||STAGES_PER_GRAND_TOUR,
    classifications:classificationStandings(game.grandTour.gc,tourBaseSeconds(game.grandTour))
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
  base.tacticOptions=RIDER_TACTICS.map((key) => ({
    key, label:TACTIC_LABELS[key], description:TACTIC_DESCRIPTIONS[key],
    rollBonus:TACTIC_EFFECTS[key].rollBonus, powerDelta:TACTIC_EFFECTS[key].powerDelta, enduranceCost:TACTIC_EFFECTS[key].enduranceCost,
    target:TACTIC_TARGET[key]||null, sprintOnly:key==='sprint_leadout'
  }));
  base.attackPushLevels=Object.fromEntries(Object.entries(ATTACK_PUSH_LEVELS).map(([level,config]) => [level,{...config, successPct:Math.round((10-config.failBelow)*10)}]));
  base.positionLabels=POSITION_LABELS;
  base.bonkEndurance=BONK_ENDURANCE;
  base.teamTactics=TEAM_TACTICS.map((tactic) => ({id:tactic.id, naam:tactic.naam}));
  base.hints=(game.race.hints||[]).map((hint) => ({riderId:hint.riderId, riderName:hint.riderName, teamName:hint.teamName}));
  base.teamBonuses={leadoutDraft:LEADOUT_DRAFT_BONUS, protect:PROTECT_ROLL_BONUS, sprintLeadoutAttackFactor:SPRINT_LEADOUT_ATTACK_FACTOR, sprintLeadoutFollow:SPRINT_LEADOUT_FOLLOW_BONUS, markSuccess:MARK_SUCCESS_BONUS};
  const situation=buildRaceSituation(game);
  if(game.race.segmentIndex>0)base.leader=situation.leader;
  const myProg=game.race.progress[requesterId];
  const requester=game.players.find((candidate) => candidate.id===requesterId);
  base.myProgress=myProg?{
    awaitingConfirmation:playerAwaitsConfirmation(myProg),
    pendingEvent:myProg.pendingEvent?{...myProg.pendingEvent, riderName:requester?.team.riders.find((candidate) => candidate.id===myProg.pendingEvent.riderId)?.name||null}:null,
    lastEvent:myProg.lastEvent||null,
    usedTactics:(myProg.usedTactics||[]).slice(),
    pendingCard:myProg.pendingRoll?.card||null,
    riders:Object.fromEntries(Object.entries(myProg.riders).map(([riderId,state]) => {
      const rider=requester?.team.riders.find((candidate) => candidate.id===riderId);
      const position=situation.byEntry[`${requesterId}:${riderId}`]||{};
      return [riderId,{
        name:rider?.name||'Renner', role:rider?riderRole(rider):'allrounder',
        fatigue:rider?.fatigue??0, gelsRemaining:rider?.gelsRemaining??0,
        endurance:rider?.endurance??(rider?100-rider.fatigue:0), power:rider?.power??(rider?100-rider.fatigue:0), position:rider?.position||'middle', bonked:rider?(rider.endurance??100-rider.fatigue)<=BONK_ENDURANCE:false,
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

// De erelijst leest alle opgeslagen ploegen, dus die db-verwijzing wordt hier
// eenmalig bij het opstarten vastgelegd (zie server.js: game.configure).
let database=null;
let honoursCache=null;
const HONOURS_CACHE_MS=2000;

function configure({db}){database=db||null}
function invalidateHonours(){honoursCache=null}

function persistedHonours(){
  if(!database?.cycclubRaceRecords)return [];
  if(honoursCache&&Date.now()-honoursCache.at<HONOURS_CACHE_MS)return honoursCache.rows;
  let rows=[];
  try{rows=database.cycclubRaceRecords()}catch{rows=[]}
  honoursCache={at:Date.now(), rows};
  return rows;
}

// Combineert de opgeslagen erelijsten met de spelers in deze room. Spelers zonder
// account staan niet in de database, en wie nu meespeelt heeft de verste stand —
// die overschrijft dus de opgeslagen rij met dezelfde naam.
function buildHonours(game){
  const byName=new Map();
  for(const row of persistedHonours()){
    byName.set(row.username,{name:row.username, raceWins:{...row.raceWins}, jerseys:{...row.jerseys}, inRoom:false});
  }
  for(const player of game.players){
    const career=player.team.career;
    byName.set(player.name,{
      name:player.name,
      raceWins:{...(career.raceWins||{})},
      jerseys:{...defaultJerseys(),...(career.jerseys||{})},
      inRoom:true
    });
  }
  return [...byName.values()]
    .map((entry) => ({
      ...entry,
      totalWins:Object.values(entry.raceWins).reduce((sum,count) => sum+count,0),
      totalJerseys:JERSEY_KEYS.reduce((sum,key) => sum+(entry.jerseys[key]||0),0)
    }))
    .sort((a,b) => b.totalWins-a.totalWins||b.totalJerseys-a.totalJerseys||a.name.localeCompare(b.name,'nl-BE',{sensitivity:'base'}));
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
  invalidateHonours();
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
  meta, configure, createGame, handleAction, serialize, tick, preparePlayers, afterStateChange,
  RACE_CATALOG, GRAND_TOUR_CATALOG, STAGE_RACE_CATALOG, RACE_POOLS, RIDER_CATALOG, RIDER_BY_ID, SHOP_COSTS, STAT_KEYS, SQUAD_SIZE, MAX_RIDERS, RACE_FIELD_SIZE, MIN_RIDER_PRICE, MAX_RIDER_PRICE, RESET_STARTER_COUNT, RESET_STARTER_MIN_SPECIALISMS, RESET_STARTER_POOL_FRACTION, marketValueFor, TEAMS, REAL_RIDERS:RIDER_CATALOG,
  STAGES_PER_GRAND_TOUR, SEGMENTS_PER_RACE, RIDER_TACTICS, TACTIC_LABELS, TACTIC_EFFECTS, TACTIC_TARGET, ATTACK_PUSH_LEVELS, GELS_PER_RACE, BONK_ENDURANCE,
  POSITION_LABELS, POSITION_BY_TACTIC, RACE_EVENT_TYPES, EVENT_CHANCE,
  calculateSegmentStep, buildSegmentPlan, raceGroupForGap, buildRaceSituation, initRaceEnergy, buildRaceEvent, applyRaceEvent, isSprintSegment, classificationStandings, formatRaceTime, TEAM_TACTICS, TEAM_TACTIC_MAX_LEVEL, TEAM_TACTIC_MAX_STOCK, TEAM_TACTIC_ACTIVATE_COST, TEAM_TACTIC_UPGRADE_COSTS, TEAM_TACTIC_CARD_COST, cardModifiersFor
};
