// ---------- World constants ----------
  // ---------- World constants ----------
export const W = 1400, H = 584;
export const GROUND_Y = 460;
export const P_CASTLE_X = 105, E_CASTLE_X = W - 105;
export const P_TRENCH_X = 270, E_TRENCH_X = W - 270;
export const P_ATTACK_SPAWN_X = 350, E_ATTACK_SPAWN_X = W - 350;
export const P_DEFENSE_GUARD_X = 260, E_DEFENSE_GUARD_X = W - 260;
export const CLAMP_MIN_X = -20, CLAMP_MAX_X = W + 20;
export const CASTLE_HIT_P = 205, CASTLE_HIT_E = W - 205;
export const MAX_LEVEL = 10;
export const ENGAGE_RANGE = 34;
export const GUARD_DETECT_RANGE = 90;

export const PLAYER_COLOR = '#4f7942', PLAYER_SHADE = '#2e4a24';
export const ENEMY_COLOR = '#6b6f76', ENEMY_SHADE = '#40434a';

export const ERA_NAMES = ['Prehistorie','Oude Nabije Oosten','Klassieke Oudheid','Middeleeuwen','Vroegmoderne Tijd','Moderne Tijd','Hedendaagse Tijd'];
export const ERA_SHORT = ['Oertijd','Nabije Oosten','Oudheid','Middeleeuwen','Vroegmodern','Moderne Tijd','Hedendaags'];
export const ERA_ICON = ['🪨','𓉐','🏛️','🏰','⚓','🎖️','🛰️'];
export const CASTLE_TYPES = ['hut','mudbrick','classical','medieval','starfort','bunker','modernbase'];
export const WEAPON_BY_ERA_ROLE = [
    {attack:'club', defense:'palisadespear'},
    {attack:'axe', defense:'shieldspear'},
    {attack:'gladius', defense:'phalanx'},
    {attack:'sword', defense:'crossbow'},
    {attack:'musket', defense:'cannon'},
    {attack:'rifleww', defense:'machinegun'},
    {attack:'riflemodern', defense:'turret'}
  ];
export const HELMET_BY_ERA = ['none','conical','roman','greathelm','tricorn','steelpot','tactical'];

// ---------- Formulas ----------
  // ---------- Formulas ----------
export function round1(x){ return Math.round(x*10)/10; }
export function eraMult(era){ return Math.pow(2.3, era); }
export function tierMult(elapsed){ return 1 + Math.floor(elapsed/20)*0.09; }
export function tierIntervalMult(elapsed){ return Math.max(0.55, 1 - Math.floor(elapsed/20)*0.05); }

export function attackHp(lv, era){ return Math.round((16 + (lv-1)*2) * eraMult(era)); }
export function attackDmg(lv, era){ return round1((3.5 + (lv-1)*0.5) * eraMult(era)); }
export function attackSpeed(lv, era){ return 58 + (lv-1)*3 + era*4; }
export function attackInterval(lv){ return Math.max(1.2, 3.4 - (lv-1)*0.18); }

export function defenseHp(lv, era){ return Math.round((26 + (lv-1)*2.6) * eraMult(era)); }
export function defenseDmg(lv, era){ return round1((4.5 + (lv-1)*0.45) * eraMult(era)); }
export function defenseInterval(lv){ return Math.max(2.2, 5.2 - (lv-1)*0.22); }

export function castleMaxHp(lv, era){ return Math.round((480 + (lv-1)*55) * eraMult(era)); }
export function goldRate(lv, era){ return round1((2.6 + (lv-1)*0.35) * eraMult(era)); }
export function enemyCastleMaxHp(era){ return Math.round(480 * eraMult(era)); }

export function costCastle(lv, era){ return Math.round(60*Math.pow(1.55, lv-1) * eraMult(era)); }
export function costAttack(lv, era){ return Math.round(35*Math.pow(1.45, lv-1) * eraMult(era)); }
export function costDefense(lv, era){ return Math.round(45*Math.pow(1.45, lv-1) * eraMult(era)); }
export function evolveCost(era){ return Math.round(350*Math.pow(2.5, era)); }

export function fmtNum(n){
  n = Math.round(n);
  if(n>=1000000) return (n/1000000).toFixed(n>=10000000?0:1)+'M';
  if(n>=1000) return (n/1000).toFixed(n>=10000?0:1)+'k';
  return String(n);
}

export function fmtTime(sec){
  const m = Math.floor(sec/60), s = Math.floor(sec%60);
  return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}

// Canvas renders authoritative server snapshots.
export function createBattle({canvas}){
  const ctx=canvas.getContext('2d');
  let state=null, stopped=false, onFrame=null;
  // ---------- Rendering: background/trench/sparks ----------
  function drawBackground(){
    const g = ctx.createLinearGradient(0,0,0,GROUND_Y);
    g.addColorStop(0,'#6fb8e0'); g.addColorStop(1,'#bfe6ee');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,GROUND_Y);

    ctx.fillStyle = 'rgba(255,250,220,.9)';
    ctx.beginPath(); ctx.arc(W-160,90,46,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = '#8fbf6a';
    ctx.beginPath();
    ctx.moveTo(0,GROUND_Y);
    ctx.quadraticCurveTo(W*0.18,GROUND_Y-90,W*0.35,GROUND_Y-30);
    ctx.quadraticCurveTo(W*0.55,GROUND_Y-95,W*0.72,GROUND_Y-25);
    ctx.quadraticCurveTo(W*0.88,GROUND_Y-80,W,GROUND_Y-20);
    ctx.lineTo(W,GROUND_Y); ctx.closePath(); ctx.fill();

    const t = state ? state.elapsed : 0;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for(let i=0;i<3;i++){
      const cx = ((i*480 + t*8) % (W+220)) - 110;
      const cy = 70 + i*45;
      drawCloud(cx,cy);
    }

    ctx.fillStyle = '#6a9a44';
    ctx.fillRect(0,GROUND_Y,W,22);
    const gd = ctx.createLinearGradient(0,GROUND_Y+22,0,H);
    gd.addColorStop(0,'#6b4a30'); gd.addColorStop(1,'#43301f');
    ctx.fillStyle = gd; ctx.fillRect(0,GROUND_Y+22,W,H-GROUND_Y-22);

    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth=1;
    for(let x=0;x<W;x+=40){ ctx.beginPath(); ctx.moveTo(x,GROUND_Y+26); ctx.lineTo(x-10,H); ctx.stroke(); }
  }

  function drawCloud(cx,cy){
    ctx.beginPath();
    ctx.ellipse(cx,cy,34,16,0,0,Math.PI*2);
    ctx.ellipse(cx+26,cy+6,26,13,0,0,Math.PI*2);
    ctx.ellipse(cx-26,cy+6,24,12,0,0,Math.PI*2);
    ctx.fill();
  }

  function drawTrench(cx){
    ctx.fillStyle = '#2c1d10';
    ctx.beginPath();
    ctx.moveTo(cx-70, GROUND_Y+22); ctx.lineTo(cx+70, GROUND_Y+22);
    ctx.lineTo(cx+52, GROUND_Y+50); ctx.lineTo(cx-52, GROUND_Y+50);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a8a8a';
    for(let i=-3;i<=3;i++){
      const sx = cx + i*18;
      ctx.beginPath();
      ctx.moveTo(sx-6, GROUND_Y+24); ctx.lineTo(sx, GROUND_Y-14); ctx.lineTo(sx+6, GROUND_Y+24);
      ctx.closePath(); ctx.fill();
    }
  }

  // ---------- Rendering: castles per era ----------
  function drawFlagAt(cx, topY, color){
    ctx.strokeStyle='#4a3220'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(cx,topY); ctx.lineTo(cx,topY-33); ctx.stroke();
    const wobble = Math.sin((state?state.elapsed:0)*3)*4;
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.moveTo(cx,topY-33); ctx.lineTo(cx+28,topY-27+wobble); ctx.lineTo(cx,topY-19);
    ctx.closePath(); ctx.fill();
  }

  function drawHutCastle(cx, baseY, flagColor){
    ctx.fillStyle = '#8a6a45'; ctx.fillRect(cx-70, baseY-60, 140, 60);
    ctx.fillStyle = '#6b4a30';
    ctx.beginPath(); ctx.moveTo(cx-85, baseY-60); ctx.lineTo(cx, baseY-115); ctx.lineTo(cx+85, baseY-60);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#2c1d10'; ctx.fillRect(cx-14,baseY-30,28,30);
    ctx.fillStyle='#5a4128';
    for(let i=-4;i<=4;i+=2){
      if(Math.abs(i)<2) continue;
      const sx=cx+i*22;
      ctx.beginPath(); ctx.moveTo(sx-4,baseY); ctx.lineTo(sx,baseY-40); ctx.lineTo(sx+4,baseY);
      ctx.closePath(); ctx.fill();
    }
    drawFlagAt(cx, baseY-115, flagColor);
  }

  function drawMudbrickCastle(cx, baseY, flagColor){
    ctx.fillStyle = '#c2a26b'; ctx.fillRect(cx-90, baseY-90, 180, 90);
    ctx.fillStyle = '#a4874f'; ctx.fillRect(cx-60, baseY-130, 120, 40);
    ctx.fillRect(cx-30, baseY-160, 60, 30);
    ctx.fillStyle='#3a2716'; ctx.fillRect(cx-16,baseY-38,32,38);
    drawFlagAt(cx, baseY-160, flagColor);
  }

  function drawClassicalCastle(cx, baseY, flagColor){
    ctx.fillStyle = '#d9d2c1'; ctx.fillRect(cx-95, baseY-100, 190, 100);
    ctx.fillStyle = '#c4bba5';
    for(let i=0;i<5;i++) ctx.fillRect(cx-85+i*40, baseY-95, 14, 90);
    ctx.fillStyle='#b8ae94';
    ctx.beginPath(); ctx.moveTo(cx-100,baseY-100); ctx.lineTo(cx,baseY-150); ctx.lineTo(cx+100,baseY-100);
    ctx.closePath(); ctx.fill();
    drawFlagAt(cx, baseY-150, flagColor);
  }

  function drawMedievalCastle(cx, baseY, flagColor){
    ctx.fillStyle = '#8f8f8f'; ctx.fillRect(cx-95, baseY-95, 190, 95);
    ctx.fillStyle = '#77787a';
    for(let i=0;i<6;i++) ctx.fillRect(cx-95+i*33+4, baseY-105, 20, 14);
    ctx.fillStyle = '#3a2716';
    ctx.beginPath(); ctx.moveTo(cx-24, baseY); ctx.lineTo(cx-24, baseY-40);
    ctx.quadraticCurveTo(cx, baseY-64, cx+24, baseY-40); ctx.lineTo(cx+24, baseY);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a2a2a2'; ctx.fillRect(cx-34, baseY-165, 68, 78);
    ctx.beginPath(); ctx.moveTo(cx-40, baseY-165); ctx.lineTo(cx, baseY-205); ctx.lineTo(cx+40, baseY-165);
    ctx.closePath(); ctx.fillStyle='#5a4a42'; ctx.fill();
    drawFlagAt(cx, baseY-205, flagColor);
  }

  function drawStarfortCastle(cx, baseY, flagColor){
    ctx.fillStyle = '#a89a82'; ctx.fillRect(cx-110, baseY-80, 220, 80);
    ctx.beginPath(); ctx.moveTo(cx-110,baseY-80); ctx.lineTo(cx-140,baseY-50); ctx.lineTo(cx-110,baseY-20);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx+110,baseY-80); ctx.lineTo(cx+140,baseY-50); ctx.lineTo(cx+110,baseY-20);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#3a2716';
    for(let i=-1;i<=1;i++) ctx.fillRect(cx+i*40-6, baseY-55, 12, 8);
    ctx.fillStyle='#8f8477'; ctx.fillRect(cx-20, baseY-130, 40, 55);
    drawFlagAt(cx, baseY-130, flagColor);
  }

  function drawBunkerCastle(cx, baseY, flagColor){
    ctx.fillStyle = '#6b6b60'; ctx.fillRect(cx-100, baseY-70, 200, 70);
    ctx.fillStyle='#1c1c18';
    for(let i=-2;i<=2;i++) ctx.fillRect(cx+i*35-12, baseY-45, 24, 6);
    ctx.fillStyle='#8a7a52';
    for(let i=-5;i<=5;i++){ ctx.beginPath(); ctx.ellipse(cx+i*20, baseY-2, 11, 6, 0,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#5a5a52'; ctx.fillRect(cx-10, baseY-120, 20, 55); ctx.fillRect(cx-18, baseY-135, 36, 18);
    drawFlagAt(cx, baseY-135, flagColor);
  }

  function drawModernBaseCastle(cx, baseY, flagColor){
    ctx.fillStyle = '#8c8f92'; ctx.fillRect(cx-105, baseY-85, 210, 85);
    ctx.fillStyle='#6d7276'; ctx.fillRect(cx-105, baseY-95, 210, 12);
    ctx.fillStyle='#2a3a44';
    for(let i=-4;i<=4;i++) ctx.fillRect(cx+i*20-6, baseY-70, 12, 14);
    ctx.strokeStyle='#4a4d50'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(cx+70,baseY-95); ctx.lineTo(cx+70,baseY-150); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx+70,baseY-150,10,Math.PI,0); ctx.stroke();
    ctx.strokeStyle='#b5b8ba'; ctx.lineWidth=1.5;
    ctx.beginPath();
    for(let x=cx-100;x<cx+100;x+=14){ ctx.moveTo(x,baseY-96); ctx.lineTo(x+7,baseY-104); ctx.lineTo(x+14,baseY-96); }
    ctx.stroke();
    drawFlagAt(cx, baseY-140, flagColor);
  }

  function drawCastleByEra(cx, hpPct, flagColor, era){
    const baseY = GROUND_Y+18;
    const type = CASTLE_TYPES[era] || 'hut';
    if(type==='hut') drawHutCastle(cx,baseY,flagColor);
    else if(type==='mudbrick') drawMudbrickCastle(cx,baseY,flagColor);
    else if(type==='classical') drawClassicalCastle(cx,baseY,flagColor);
    else if(type==='medieval') drawMedievalCastle(cx,baseY,flagColor);
    else if(type==='starfort') drawStarfortCastle(cx,baseY,flagColor);
    else if(type==='bunker') drawBunkerCastle(cx,baseY,flagColor);
    else drawModernBaseCastle(cx,baseY,flagColor);
    if(hpPct<0.4){
      ctx.fillStyle = 'rgba(60,20,10,'+(0.35*(1-hpPct/0.4))+')';
      ctx.fillRect(cx-105, baseY-225, 210, 225);
    }
  }

  // ---------- Rendering: toy soldiers ----------
  function drawChargeBody(color, bob){
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-3,-32); ctx.lineTo(-15,-4+bob*0.2); ctx.lineTo(-7,0+bob*0.2); ctx.lineTo(3,-30);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3,-32); ctx.lineTo(19,-2-bob*0.2); ctx.lineTo(27,-4-bob*0.2); ctx.lineTo(9,-30);
    ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.translate(0,-32); ctx.rotate(-0.22);
    ctx.beginPath();
    ctx.moveTo(-8,2); ctx.lineTo(8,2); ctx.lineTo(6,-30); ctx.lineTo(-6,-30);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(-7,-52,5,11,0.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(3,-70,10,0,Math.PI*2); ctx.fill();
    return { frontHand:{x:20,y:-50}, head:{x:3,y:-70} };
  }

  function drawKneelBody(color){
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(-10,-1,8,4,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10,-1); ctx.lineTo(-4,-26); ctx.lineTo(2,-26); ctx.lineTo(-4,-1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2,-26); ctx.lineTo(16,-20); ctx.lineTo(20,-24); ctx.lineTo(20,-2); ctx.lineTo(12,-2); ctx.lineTo(6,-20);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(18,-1,7,3.5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5,-26); ctx.lineTo(9,-26); ctx.lineTo(7,-54); ctx.lineTo(-3,-54);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-4,-40,5,9,0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6,-60,10,0,Math.PI*2); ctx.fill();
    return { frontHand:{x:16,y:-44}, head:{x:6,y:-60} };
  }

  function drawHelmet(type, head, shade){
    const {x,y} = head;
    ctx.fillStyle = shade;
    if(type==='conical'){
      ctx.beginPath(); ctx.moveTo(x-7,y-4); ctx.lineTo(x,y-18); ctx.lineTo(x+7,y-4); ctx.closePath(); ctx.fill();
    } else if(type==='roman'){
      ctx.fillRect(x-9,y-13,18,4);
      ctx.beginPath(); ctx.moveTo(x-2,y-13); ctx.lineTo(x,y-19); ctx.lineTo(x+2,y-13); ctx.closePath(); ctx.fill();
    } else if(type==='greathelm'){
      ctx.fillRect(x-9,y-16,18,14);
      ctx.fillStyle='#000'; ctx.globalAlpha=.5; ctx.fillRect(x-7,y-10,14,2); ctx.globalAlpha=1;
    } else if(type==='tricorn'){
      ctx.beginPath();
      ctx.moveTo(x-14,y-2); ctx.lineTo(x,y-14); ctx.lineTo(x+14,y-2); ctx.lineTo(x+7,y+2); ctx.lineTo(x-7,y+2);
      ctx.closePath(); ctx.fill();
    } else if(type==='steelpot'){
      ctx.beginPath(); ctx.arc(x,y-6,11,Math.PI,0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x,y-5,13,3,0,0,Math.PI*2); ctx.fill();
    } else if(type==='tactical'){
      ctx.beginPath(); ctx.arc(x,y-4,10,Math.PI,0); ctx.fill();
      ctx.fillRect(x+6,y-10,4,6);
    }
  }

  function drawWeapon(type, hand, color, accent, swing){
    const {x,y} = hand;
    const a = -0.3+swing*0.8;
    ctx.save();
    ctx.translate(x,y); ctx.rotate(a);
    ctx.fillStyle = accent;
    if(type==='club'){
      ctx.fillRect(0,-3,24,6);
      ctx.beginPath(); ctx.arc(24,0,6,0,Math.PI*2); ctx.fill();
    } else if(type==='axe'){
      ctx.fillRect(0,-2,20,4);
      ctx.beginPath(); ctx.moveTo(18,-10); ctx.lineTo(30,-4); ctx.lineTo(18,8); ctx.closePath(); ctx.fill();
    } else if(type==='gladius'){
      ctx.fillRect(0,-2,20,4);
      ctx.fillStyle=color; ctx.fillRect(-16,-14,10,22);
    } else if(type==='sword'){
      ctx.fillRect(0,-2,30,4);
      ctx.beginPath(); ctx.moveTo(30,-2); ctx.lineTo(36,0); ctx.lineTo(30,2); ctx.closePath(); ctx.fill();
    } else if(type==='musket'){
      ctx.fillRect(0,-2.5,40,5);
      ctx.beginPath(); ctx.moveTo(40,-1); ctx.lineTo(48,0); ctx.lineTo(40,1); ctx.closePath(); ctx.fill();
    } else if(type==='rifleww'){
      ctx.fillRect(-6,-3,36,6);
      ctx.beginPath(); ctx.moveTo(30,-1); ctx.lineTo(40,0); ctx.lineTo(30,1); ctx.closePath(); ctx.fill();
    } else if(type==='riflemodern'){
      ctx.fillRect(-4,-3,32,6);
      ctx.fillRect(6,3,5,10);
      ctx.fillRect(24,-7,7,5);
    } else if(type==='palisadespear'){
      ctx.fillRect(0,-2,34,4);
      ctx.beginPath(); ctx.moveTo(34,-4); ctx.lineTo(42,0); ctx.lineTo(34,4); ctx.closePath(); ctx.fill();
    } else if(type==='shieldspear'){
      ctx.fillRect(0,-2,26,4);
      ctx.fillStyle=color; ctx.beginPath(); ctx.ellipse(-10,0,10,14,0,0,Math.PI*2); ctx.fill();
    } else if(type==='phalanx'){
      ctx.fillRect(0,-2,40,4);
      ctx.fillStyle=color; ctx.beginPath(); ctx.ellipse(-12,-2,13,20,0,0,Math.PI*2); ctx.fill();
    } else if(type==='crossbow'){
      ctx.fillRect(-2,-10,4,20); ctx.fillRect(-14,-2,28,4);
    } else if(type==='cannon'){
      ctx.fillRect(0,-5,30,10);
      ctx.beginPath(); ctx.arc(0,10,6,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(24,10,6,0,Math.PI*2); ctx.fill();
    } else if(type==='machinegun'){
      ctx.fillRect(-4,-3,32,6); ctx.fillRect(6,3,3,10); ctx.fillRect(22,3,3,10);
    } else if(type==='turret'){
      ctx.fillRect(4,-14,14,12);
      ctx.beginPath(); ctx.arc(11,-16,3,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=accent; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(11,-14); ctx.lineTo(11,2); ctx.stroke();
    } else {
      ctx.fillRect(0,-2,20,4);
    }
    ctx.restore();
  }

  function drawSoldierShape(u){
    const color = u.side==='player' ? PLAYER_COLOR : ENEMY_COLOR;
    const shade = u.side==='player' ? PLAYER_SHADE : ENEMY_SHADE;
    const weapons = WEAPON_BY_ERA_ROLE[u.era] || WEAPON_BY_ERA_ROLE[0];
    const wpn = u.type==='attack' ? weapons.attack : weapons.defense;
    const helmet = HELMET_BY_ERA[u.era] || 'none';
    const moving = u.state==='move';
    const fighting = u.state==='fight' || u.state==='siege';
    const bob = moving ? Math.sin(u.phase*7)*3 : 0;
    const swing = fighting ? Math.sin(u.phase*14)*0.5+0.5 : 0.2;

    let anchors;
    if(u.type==='attack') anchors = drawChargeBody(color, bob);
    else anchors = drawKneelBody(color);
    drawHelmet(helmet, anchors.head, shade);
    drawWeapon(wpn, anchors.frontHand, color, shade, swing);

    if(u.flash>0){
      ctx.globalAlpha = Math.min(1,u.flash*6);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(6,-42,22,28,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawStick(u){
    if(u.dead){
      const a = Math.max(0, 1 - u.deathT/0.55);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(u.x, u.y + u.deathT*10);
      ctx.scale(u.dir,1);
      ctx.rotate(0.9*(u.deathT/0.55));
      drawSoldierShape(u);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(u.x,u.y);
    ctx.scale(u.dir,1);
    drawSoldierShape(u);
    ctx.restore();

    if(u.hp<u.maxHp){
      const w=28;
      ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(u.x-w/2, u.y-84, w, 5);
      ctx.fillStyle = u.side==='player' ? '#bfe0ff' : '#e6e8ea';
      ctx.fillRect(u.x-w/2, u.y-84, w*Math.max(0,u.hp/u.maxHp), 5);
    }
  }

  function drawSparks(){
    for(const sp of state.sparks){
      const a = 1-sp.t/0.28, r = 4+sp.t*40;
      ctx.strokeStyle = sp.color; ctx.globalAlpha = a; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function render(){
    ctx.clearRect(0,0,W,H);
    drawBackground();
    drawTrench(P_TRENCH_X);
    drawTrench(E_TRENCH_X);
    drawCastleByEra(P_CASTLE_X, state.player.castleHp/castleMaxHp(state.player.castleLevel, state.player.era), PLAYER_COLOR, state.player.era);
    drawCastleByEra(E_CASTLE_X, state.enemy.castleHp/state.enemy.castleMaxHp, ENEMY_COLOR, state.enemy.era);
    const sorted = state.units.slice().sort((a,b)=>a.y-b.y);
    for(const u of sorted) drawStick(u);
    drawSparks();
  }



  function frame(){
    if(stopped || !canvas.isConnected) return;
    if(state){render();onFrame?.(state);}
    requestAnimationFrame(frame);
  }
  return {
    get state(){return state;},
    setState(snapshot){state=snapshot;},
    start(cb){onFrame=cb;requestAnimationFrame(frame);},
    stop(){stopped=true;},
    abilityDefs(){const em=eraMult(state.player.era);return Object.fromEntries(Object.entries({spawnBoost:50,dmgBoost:60,burst:80,reinforce:70}).map(([k,v])=>[k,{cost:Math.round(v*em)}]));}
  };
}
