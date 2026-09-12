'use strict';
// Authoritative duel simulation: identical economy and combat rules for both sides.
const W = 1400;
const GROUND_Y = 460;
const P_ATTACK_SPAWN_X = 350, E_ATTACK_SPAWN_X = W - 350;
const P_DEFENSE_GUARD_X = 260, E_DEFENSE_GUARD_X = W - 260;
const CLAMP_MIN_X = -20, CLAMP_MAX_X = W + 20;
const CASTLE_HIT_P = 205, CASTLE_HIT_E = W - 205;
const MAX_LEVEL = 10;
const ENGAGE_RANGE = 34;
const GUARD_DETECT_RANGE = 90;


const ERA_NAMES = ['Prehistorie','Oude Nabije Oosten','Klassieke Oudheid','Middeleeuwen','Vroegmoderne Tijd','Moderne Tijd','Hedendaagse Tijd'];

// ---------- Formulas ----------
function round1(x){ return Math.round(x*10)/10; }
function eraMult(era){ return Math.pow(2.3, era); }

function attackHp(lv, era){ return Math.round((16 + (lv-1)*2) * eraMult(era)); }
function attackDmg(lv, era){ return round1((3.5 + (lv-1)*0.5) * eraMult(era)); }
function attackSpeed(lv, era){ return 58 + (lv-1)*3 + era*4; }
function attackInterval(lv){ return Math.max(1.2, 3.4 - (lv-1)*0.18); }

function defenseHp(lv, era){ return Math.round((26 + (lv-1)*2.6) * eraMult(era)); }
function defenseDmg(lv, era){ return round1((4.5 + (lv-1)*0.45) * eraMult(era)); }
function defenseInterval(lv){ return Math.max(2.2, 5.2 - (lv-1)*0.22); }

function castleMaxHp(lv, era){ return Math.round((480 + (lv-1)*55) * eraMult(era)); }
function goldRate(lv, era){ return round1((2.6 + (lv-1)*0.35) * eraMult(era)); }

function costCastle(lv, era){ return Math.round(60*Math.pow(1.55, lv-1) * eraMult(era)); }
function costAttack(lv, era){ return Math.round(35*Math.pow(1.45, lv-1) * eraMult(era)); }
function costDefense(lv, era){ return Math.round(45*Math.pow(1.45, lv-1) * eraMult(era)); }
function evolveCost(era){ return Math.round(350*Math.pow(2.5, era)); }



function army(){ return { gold:50, era:0, castleHp:castleMaxHp(1,0), castleMaxHp:castleMaxHp(1,0), castleLevel:1, attackLevel:1, defenseLevel:1, attackTimer:1.5, defenseTimer:2.5, spawnBoostUntil:0, dmgBoostUntil:0, cooldowns:{spawnBoost:0,dmgBoost:0,burst:0,reinforce:0} }; }
function createState(){ return {elapsed:0,running:true,unitSeq:1,units:[],sparks:[],player:army(),enemy:army(),winner:null}; }
function simulation(state){
  function spawnUnit(side, type){
    const s = state;
    const era = s[side].era;
    const lane = (Math.random()-0.5)*26;
    let hp,dmg,speed,x,guardX;
    const p = s[side];
    const lv = type === 'attack' ? p.attackLevel : p.defenseLevel;
    hp = type === 'attack' ? attackHp(lv, era) : defenseHp(lv, era);
    dmg = type === 'attack' ? attackDmg(lv, era) : defenseDmg(lv, era);
    speed = type === 'attack' ? attackSpeed(lv, era) : 0;
    x = side === 'player' ? (type === 'attack' ? P_ATTACK_SPAWN_X : P_DEFENSE_GUARD_X) : (type === 'attack' ? E_ATTACK_SPAWN_X : E_DEFENSE_GUARD_X);
    if(type === 'defense') guardX = x;
    s.units.push({
      id: s.unitSeq++, side, type, era,
      x, y: GROUND_Y+lane, guardX,
      hp, maxHp:hp, dmg, speed,
      dir: side==='player' ? 1 : -1,
      state:'move', target:null, atkCd:0, dead:false, deathT:0,
      flash:0, phase:Math.random()*10
    });
  }


  function addSpark(x,y,color){ state.sparks.push({x,y,t:0,color}); }
  function killUnit(u, side){ u.dead=true; u.deathT=0; state[side].gold += Math.round(5*eraMult(state[side].era)); }
  function findNearestEnemy(u){
    let best=null, bestD=Infinity;
    for(const o of state.units){
      if(o.side===u.side || o.dead) continue;
      const d = Math.abs(o.x-u.x);
      if(d<bestD){ bestD=d; best=o; }
    }
    return {unit:best, dist:bestD};
  }


  function act(side, action, key){
    if(!state.running) throw new Error('Het spel is afgelopen.');
    const p=state[side], foe=state[side==='player'?'enemy':'player'];
    if(action==='evolve'){
      if(p.era>=ERA_NAMES.length-1 || p.gold<evolveCost(p.era)) throw new Error('Evolueren is nog niet mogelijk.');
      p.gold-=evolveCost(p.era); p.era++; p.castleLevel=p.attackLevel=p.defenseLevel=1;
      p.castleHp=p.castleMaxHp=castleMaxHp(1,p.era); return;
    }
    if(action==='upgrade'){
      const costs={castle:costCastle,attack:costAttack,defense:costDefense};
      if(!Object.hasOwn(costs,key)) throw new Error('Onbekende upgrade.');
      const lv=p[key+'Level'], cost=costs[key](lv,p.era);
      if(lv>=MAX_LEVEL || p.gold<cost) throw new Error('Upgrade is nog niet mogelijk.');
      p.gold-=cost; p[key+'Level']++;
      p.castleMaxHp=castleMaxHp(p.castleLevel,p.era);
      if(key==='castle') p.castleHp=Math.min(p.castleMaxHp,p.castleHp+150*eraMult(p.era));
      return;
    }
    if(action==='ability'){
      const defs={spawnBoost:[50,20],dmgBoost:[60,25],burst:[80,30],reinforce:[70,25]};
      if(!Object.hasOwn(defs,key)) throw new Error('Onbekende vaardigheid.');
      const [base,cd]=defs[key], cost=Math.round(base*eraMult(p.era));
      if(p.cooldowns[key]>0 || p.gold<cost) throw new Error('Vaardigheid is nog niet beschikbaar.');
      p.gold-=cost; p.cooldowns[key]=cd;
      if(key==='spawnBoost' || key==='dmgBoost') p[key+'Until']=state.elapsed+8;
      if(key==='burst') foe.castleHp=Math.max(0,foe.castleHp-foe.castleMaxHp*0.08);
      if(key==='reinforce'){ for(let i=0;i<3;i++) spawnUnit(side,'attack'); for(let i=0;i<2;i++) spawnUnit(side,'defense'); }
      return;
    }
    throw new Error('Onbekende actie.');
  }
  function endGame(won){ state.running=false; state.winner=won?'player':'enemy'; }
  function update(dt){
    const s=state;
    if(!s.running) return;
    s.elapsed+=dt;
    for(const side of ['player','enemy']){
      const p=s[side]; p.gold+=goldRate(p.castleLevel,p.era)*dt;
      for(const k in p.cooldowns) p.cooldowns[k]=Math.max(0,p.cooldowns[k]-dt);
      const mul=s.elapsed<p.spawnBoostUntil?0.5:1;
      p.attackTimer-=dt; p.defenseTimer-=dt;
      if(p.attackTimer<=0){spawnUnit(side,'attack');p.attackTimer=attackInterval(p.attackLevel)*mul;}
      if(p.defenseTimer<=0){spawnUnit(side,'defense');p.defenseTimer=defenseInterval(p.defenseLevel)*mul;}
    }
    for(const u of s.units){
      if(u.dead){ u.deathT += dt; continue; }
      u.phase += dt;
      if(u.flash>0) u.flash -= dt;

      if(u.type==='attack'){
        const {unit:foe, dist} = findNearestEnemy(u);
        if(foe && dist < ENGAGE_RANGE+40){ u.state='fight'; u.target=foe.id; }
        else {
          const nearCastle = u.side==='player' ? u.x>=CASTLE_HIT_E : u.x<=CASTLE_HIT_P;
          u.state = nearCastle ? 'siege' : 'move';
          if(!nearCastle) u.target=null;
        }
      } else {
        const {unit:foe, dist} = findNearestEnemy(u);
        if(foe && Math.abs(foe.x-u.guardX)<GUARD_DETECT_RANGE && dist<ENGAGE_RANGE+50){ u.state='fight'; u.target=foe.id; }
        else { u.state='idle'; u.target=null; }
      }

      if(u.state==='move'){
        u.x += u.dir*u.speed*dt;
        u.x = Math.max(CLAMP_MIN_X, Math.min(CLAMP_MAX_X, u.x));
      }

      const target = s.units.find(o => o.id === u.target && !o.dead);
      if(u.state==='fight' && target){
        u.atkCd -= dt;
        const d = target.x-u.x;
        if(Math.abs(d)>ENGAGE_RANGE && u.type==='attack'){
          u.x += Math.sign(d)*u.speed*dt;
        }
        if(Math.abs(target.x-u.x)<=ENGAGE_RANGE+6 && u.atkCd<=0){
          u.atkCd = 0.85;
          const dealt = u.dmg * (s.elapsed < s[u.side].dmgBoostUntil ? 1.6 : 1);
          target.hp -= dealt;
          target.flash = 0.15;
          addSpark((u.x+target.x)/2, u.y-40, u.side==='player'?'#bfe0ff':'#ffd0d0');
          if(target.hp<=0 && !target.dead) killUnit(target, u.side);
        }
      } else if(u.state==='siege'){
        u.atkCd -= dt;
        if(u.atkCd<=0){
          u.atkCd = 0.85;
          const dealt = u.dmg*1.4*(s.elapsed < s[u.side].dmgBoostUntil ? 1.6 : 1);
          if(u.side==='player') s.enemy.castleHp -= dealt;
          else s.player.castleHp -= dealt;
          addSpark(u.x+u.dir*24, u.y-40, '#ffd35c');
        }
      }
    }

    s.units = s.units.filter(u => !(u.dead && u.deathT>0.55));
    for(const sp of s.sparks) sp.t += dt;
    s.sparks = s.sparks.filter(sp=>sp.t<0.28);

    if(s.enemy.castleHp<0) s.enemy.castleHp=0;
    if(s.player.castleHp<0) s.player.castleHp=0;
    if(s.player.castleHp<=0) endGame(false);
    else if(s.enemy.castleHp<=0) endGame(true);

  }
  return {act,update};
}
module.exports={createState,simulation,ERA_NAMES};
