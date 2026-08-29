const crypto = require('node:crypto');

const meta = {
  key: 'minigolf',
  name: 'Minigolf',
  description: '5 slimme random holes met eigen route of gimmick. Scoor punten per hole.',
  minPlayers: 1,
  maxPlayers: 4,
  supportsNpc: true,
  realtime: false,
  solo: false
};

const WIDTH = 900;
const HEIGHT = 520;
const BALL_RADIUS = 11;
const CUP_RADIUS = 18;
const NPC_DELAY = 900;
const BETWEEN_HOLES_MS = 2100;
const BOUNCE = 0.84;
const BALL_BOUNCE = 0.92;
const DT = 1 / 120;
const STOP_SPEED = 14;
const MAX_STEPS = 1900;
const COLORS = ['#f0c94d', '#5bc0eb', '#ff6b77', '#7bd389'];

const MATERIALS = {
  grass: { friction60: 0.982, label: 'Gras' },
  sand: { friction60: 0.945, label: 'Zand' },
  cement: { friction60: 0.74, label: 'Cement' },
  water: { friction60: 1, label: 'Water' }
};

const { THEMES, generateSmartMap } = require('./minigolf/generator');

let customMapProvider = () => [];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cleanNumber(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function startZoneFromPoint(point) {
  const w = 122;
  const h = 82;
  return {
    x: clamp(point.x - w / 2, 16, WIDTH - w - 16),
    y: clamp(point.y - h / 2, 16, HEIGHT - h - 16),
    w,
    h,
    r: 13
  };
}

function zoneCenter(zone) {
  return { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
}

function insideZone(point, zone, pad = 0) {
  if (zone.shape === 'ellipse') {
    const rx = Math.max(1, zone.rx + pad);
    const ry = Math.max(1, zone.ry + pad);
    const dx = (point.x - zone.cx) / rx;
    const dy = (point.y - zone.cy) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return point.x >= zone.x - pad &&
    point.x <= zone.x + zone.w + pad &&
    point.y >= zone.y - pad &&
    point.y <= zone.y + zone.h + pad;
}

function normalizeRuntimeMap(raw, fallbackId = null) {
  const map = JSON.parse(JSON.stringify(raw || {}));
  map.id = map.id || fallbackId || `map-${crypto.randomUUID()}`;
  map.name = String(map.name || 'Map').slice(0, 40);
  map.difficulty = ['Makkelijk','Normaal','Moeilijk','Expert'].includes(map.difficulty) ? map.difficulty : 'Normaal';
  map.maxStrokes = Math.round(cleanNumber(map.maxStrokes, 5, 3, 10));
  map.cup = {
    x:cleanNumber(map.cup?.x, 790, BALL_RADIUS + 2, WIDTH - BALL_RADIUS - 2),
    y:cleanNumber(map.cup?.y, 110, BALL_RADIUS + 2, HEIGHT - BALL_RADIUS - 2)
  };

  const legacyStart = {
    x:cleanNumber(map.start?.x, 110, BALL_RADIUS + 2, WIDTH - BALL_RADIUS - 2),
    y:cleanNumber(map.start?.y, 410, BALL_RADIUS + 2, HEIGHT - BALL_RADIUS - 2)
  };
  const sz = map.startZone || startZoneFromPoint(legacyStart);
  map.startZone = {
    x:cleanNumber(sz.x, legacyStart.x - 61, 14, WIDTH - 60),
    y:cleanNumber(sz.y, legacyStart.y - 41, 14, HEIGHT - 60),
    w:cleanNumber(sz.w, 122, 52, 380),
    h:cleanNumber(sz.h, 82, 52, 280),
    r:cleanNumber(sz.r, 13, 0, 42)
  };
  map.startZone.w = Math.min(map.startZone.w, WIDTH - 14 - map.startZone.x);
  map.startZone.h = Math.min(map.startZone.h, HEIGHT - 14 - map.startZone.y);
  map.start = zoneCenter(map.startZone);

  map.terrain = Array.isArray(map.terrain) ? map.terrain : [];
  map.walls = Array.isArray(map.walls) ? map.walls : [];
  map.props = Array.isArray(map.props) ? map.props : [];
  const rawBoosts = Array.isArray(map.boosts) ? map.boosts : [];
  map.boosts = rawBoosts.map((b, i) => ({
    id:String(b.id || `boost${i+1}`),
    x:cleanNumber(b.x, 400, 4, WIDTH - 28),
    y:cleanNumber(b.y, 240, 4, HEIGHT - 28),
    w:cleanNumber(b.w, 105, 36, 260),
    h:cleanNumber(b.h, 42, 24, 140),
    angle:cleanNumber(b.angle, 0, -Math.PI * 2, Math.PI * 2),
    strength:cleanNumber(b.strength, 1, 0.35, 2.25)
  }));
  return map;
}


function setCustomMapProvider(provider) {
  customMapProvider = typeof provider === 'function' ? provider : () => [];
}

function terrainAt(hole, point) {
  for (const zone of hole.terrain || []) {
    if (zone.type === 'water' && insideZone(point, zone, -BALL_RADIUS * 0.2)) return 'water';
  }
  for (let i = (hole.terrain || []).length - 1; i >= 0; i -= 1) {
    const zone = hole.terrain[i];
    if (zone.type !== 'water' && insideZone(point, zone)) return zone.type;
  }
  return 'grass';
}

function circleRectCollision(body, rect, radius = BALL_RADIUS) {
  const nearestX = clamp(body.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(body.y, rect.y, rect.y + rect.h);
  const dx = body.x - nearestX;
  const dy = body.y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function obstacleHit(body, prop, radius = BALL_RADIUS) {
  if (prop.shape === 'circle') {
    const dx = body.x - prop.cx;
    const dy = body.y - prop.cy;
    return dx * dx + dy * dy < (radius + prop.r) ** 2;
  }
  return circleRectCollision(body, prop, radius);
}

function pointBlocked(hole, point, { water = true, includeDestructible = false } = {}) {
  if (point.x < BALL_RADIUS || point.x > WIDTH - BALL_RADIUS ||
      point.y < BALL_RADIUS || point.y > HEIGHT - BALL_RADIUS) return true;
  if (water && terrainAt(hole, point) === 'water') return true;
  if ((hole.walls || []).some((wall) => circleRectCollision(point, wall, BALL_RADIUS + 1))) return true;
  if ((hole.props || []).some((prop) => (includeDestructible || !prop.destructible) && obstacleHit(point, prop, BALL_RADIUS + 1))) return true;
  return false;
}

function placementCandidates(hole) {
  const zone = hole.startZone;
  const points = [];
  const step = 27;
  for (let y = zone.y + 7; y <= zone.y + zone.h - 7; y += step) {
    for (let x = zone.x + 7; x <= zone.x + zone.w - 7; x += step) {
      const point = {x, y};
      if (!pointBlocked(hole, point, { includeDestructible:true })) points.push(point);
    }
  }
  const c = zoneCenter(zone);
  if (!points.length && !pointBlocked(hole, c, { includeDestructible:true })) points.push(c);
  return points;
}

function validateMapPlayability(rawHole) {
  const hole = normalizeRuntimeMap(rawHole, rawHole?.id || 'validate');
  const errors = [];
  const cup = hole.cup;

  if (terrainAt(hole, cup) === 'water') errors.push('De hole ligt in water.');
  if ((hole.walls || []).some((wall) => circleRectCollision(cup, wall, CUP_RADIUS))) {
    errors.push('De hole wordt geblokkeerd door een muur.');
  }
  if ((hole.props || []).some((prop) => !prop.destructible && obstacleHit(cup, prop, CUP_RADIUS))) {
    errors.push('De hole wordt geblokkeerd door een vast object.');
  }

  const placements = placementCandidates(hole);
  const spaced = [];
  for (const p of placements) {
    if (spaced.every((other) => dist(p, other) >= BALL_RADIUS * 2 + 4)) spaced.push(p);
  }
  if (spaced.length < 4) errors.push('Het startvak heeft niet genoeg vrije plaats voor 4 spelers.');

  // Flood-fill free floor. Water, walls and non-destructible props are treated as impassable.
  const GRID = 14;
  const cols = Math.floor(WIDTH / GRID);
  const rows = Math.floor(HEIGHT / GRID);
  const queue = [];
  const visited = new Set();
  const key = (x, y) => `${x},${y}`;

  for (let gy = 0; gy <= rows; gy += 1) {
    for (let gx = 0; gx <= cols; gx += 1) {
      const p = {x:gx * GRID + GRID / 2, y:gy * GRID + GRID / 2};
      if (!insideZone(p, hole.startZone, 0)) continue;
      if (pointBlocked(hole, p, { includeDestructible:true })) continue;
      visited.add(key(gx,gy));
      queue.push([gx,gy]);
    }
  }

  let reachable = false;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

  while (queue.length && !reachable) {
    const [gx,gy] = queue.shift();
    const p = {x:gx * GRID + GRID / 2, y:gy * GRID + GRID / 2};
    if (dist(p, cup) <= CUP_RADIUS + GRID * 1.5) {
      reachable = true;
      break;
    }

    for (const [dx,dy] of dirs) {
      const nx = gx + dx, ny = gy + dy;
      if (nx < 0 || ny < 0 || nx > cols || ny > rows) continue;
      const k = key(nx,ny);
      if (visited.has(k)) continue;
      const np = {x:nx * GRID + GRID / 2, y:ny * GRID + GRID / 2};
      if (pointBlocked(hole, np, { includeDestructible:false })) continue;

      if (dx && dy) {
        const a = {x:nx * GRID + GRID / 2, y:gy * GRID + GRID / 2};
        const b = {x:gx * GRID + GRID / 2, y:ny * GRID + GRID / 2};
        if (pointBlocked(hole,a,{includeDestructible:false}) &&
            pointBlocked(hole,b,{includeDestructible:false})) continue;
      }

      visited.add(k);
      queue.push([nx,ny]);
    }
  }

  if (!reachable) {
    errors.push('De hole is niet bereikbaar vanaf het startvak zonder door water of vaste obstakels te gaan.');
  }

  return {ok:errors.length === 0, errors, reachable};
}

function sanitizeMapDefinition(input = {}, options = {}) {
  const validate = options.validate !== false;
  const cleanName = String(input.name || 'Custom map')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g,'')
    .trim()
    .slice(0,40) || 'Custom map';
  const difficulty = ['Makkelijk','Normaal','Moeilijk','Expert'].includes(input.difficulty)
    ? input.difficulty
    : 'Normaal';
  const maxStrokes = Math.round(cleanNumber(input.maxStrokes,5,3,10));

  const legacyStart = {
    x:cleanNumber(input.start?.x,110,BALL_RADIUS+2,WIDTH-BALL_RADIUS-2),
    y:cleanNumber(input.start?.y,410,BALL_RADIUS+2,HEIGHT-BALL_RADIUS-2)
  };
  const rawZone = input.startZone || startZoneFromPoint(legacyStart);
  const startZone = {
    x:cleanNumber(rawZone.x,legacyStart.x-61,14,WIDTH-60),
    y:cleanNumber(rawZone.y,legacyStart.y-41,14,HEIGHT-60),
    w:cleanNumber(rawZone.w,122,52,380),
    h:cleanNumber(rawZone.h,82,52,280),
    r:cleanNumber(rawZone.r,13,0,42)
  };
  startZone.w = Math.min(startZone.w, WIDTH - 14 - startZone.x);
  startZone.h = Math.min(startZone.h, HEIGHT - 14 - startZone.y);

  const start = zoneCenter(startZone);
  const cup = {
    x:cleanNumber(input.cup?.x,790,BALL_RADIUS+2,WIDTH-BALL_RADIUS-2),
    y:cleanNumber(input.cup?.y,110,BALL_RADIUS+2,HEIGHT-BALL_RADIUS-2)
  };
  if (dist(start,cup) < 90) throw new Error('Startvak en hole moeten voldoende uit elkaar liggen.');

  const terrain = (Array.isArray(input.terrain) ? input.terrain : []).slice(0,60).map((z,index) => {
    const type = ['sand','cement','water'].includes(z?.type) ? z.type : null;
    if (!type) return null;
    const shape = z?.shape === 'ellipse' ? 'ellipse' : 'rect';
    const id = `t${index+1}`;
    if (shape === 'ellipse') return {
      id,type,shape,
      cx:cleanNumber(z.cx,450,20,880),cy:cleanNumber(z.cy,260,20,500),
      rx:cleanNumber(z.rx,80,15,360),ry:cleanNumber(z.ry,55,15,230)
    };
    return {
      id,type,shape,
      x:cleanNumber(z.x,300,5,860),y:cleanNumber(z.y,200,5,480),
      w:cleanNumber(z.w,150,20,500),h:cleanNumber(z.h,90,20,350),
      r:cleanNumber(z.r,16,0,60)
    };
  }).filter(Boolean);

  const walls = (Array.isArray(input.walls) ? input.walls : []).slice(0,40).map((w,index) => ({
    id:`wall${index+1}`,
    x:cleanNumber(w?.x,400,5,870),y:cleanNumber(w?.y,180,5,490),
    w:cleanNumber(w?.w,42,16,300),h:cleanNumber(w?.h,130,16,300)
  }));

  const propSpecs = {
    tree:{shape:'circle',radius:28,destructible:true},
    tractor:{shape:'rect',w:76,h:46,destructible:true},
    rock:{shape:'circle',radius:28,destructible:false},
    hay:{shape:'rect',w:70,h:46,destructible:true},
    windmill:{shape:'rect',w:70,h:95,destructible:false}
  };
  const props = (Array.isArray(input.props) ? input.props : []).slice(0,40).map((prop,index) => {
    const kind = propSpecs[prop?.kind] ? prop.kind : null;
    if (!kind) return null;
    const spec = propSpecs[kind];
    if (spec.shape === 'circle') return {
      id:`prop${index+1}`,kind,shape:'circle',
      cx:cleanNumber(prop.cx,450,20,880),cy:cleanNumber(prop.cy,260,20,500),
      r:cleanNumber(prop.r,spec.radius,16,60),destructible:spec.destructible
    };
    return {
      id:`prop${index+1}`,kind,shape:'rect',
      x:cleanNumber(prop.x,420,5,850),y:cleanNumber(prop.y,240,5,460),
      w:cleanNumber(prop.w,spec.w,24,160),h:cleanNumber(prop.h,spec.h,24,150),
      destructible:spec.destructible
    };
  }).filter(Boolean);

  const boosts = (Array.isArray(input.boosts) ? input.boosts : []).slice(0,30).map((b,index) => ({
    id:`boost${index+1}`,
    x:cleanNumber(b?.x,400,4,870),y:cleanNumber(b?.y,240,4,490),
    w:cleanNumber(b?.w,105,36,260),h:cleanNumber(b?.h,42,24,140),
    angle:cleanNumber(b?.angle,0,-Math.PI*2,Math.PI*2),
    strength:cleanNumber(b?.strength,1,0.35,2.25)
  }));

  const map = {name:cleanName,difficulty,maxStrokes,startZone,start,cup,terrain,walls,props,boosts};
  if (validate) {
    const check = validateMapPlayability(map);
    if (!check.ok) throw new Error(`Map niet speelbaar: ${check.errors.join(' ')}`);
  }
  return map;
}

function buildSmartPool(count = 20) {
  const accepted = [];
  const seed = crypto.randomInt(1, 0x7fffffff);
  let attempt = 0;
  while (accepted.length < count && attempt < count * 30) {
    const theme = THEMES[attempt % THEMES.length];
    const candidate = normalizeRuntimeMap(generateSmartMap(seed + attempt * 7919, attempt, theme));
    if (validateMapPlayability(candidate).ok) accepted.push(candidate);
    attempt += 1;
  }
  if (accepted.length < count) throw new Error(`Kon slechts ${accepted.length}/${count} speelbare Minigolf-maps genereren.`);
  return accepted;
}

function customMapPool() {
  let custom = [];
  try { custom = customMapProvider() || []; } catch (error) { console.error('Custom minigolf maps:', error); }
  return custom.map((map,index) => {
    try {
      const normalized = sanitizeMapDefinition(map,{validate:false});
      normalized.id = map.id || `custom-${index+1}`;
      normalized.ownerName = map.ownerName;
      normalized.theme = map.theme || 'custom';
      normalized.gimmick = map.gimmick || 'Custom map';
      return normalized;
    } catch { return null; }
  }).filter(Boolean).filter((map) => validateMapPlayability(map).ok);
}

function combinedMapPool() {
  return [...buildSmartPool(20), ...customMapPool()];
}

function selectCourse(count = 5) {
  const pool = combinedMapPool().slice();
  if (pool.length < count) throw new Error(`Er zijn maar ${pool.length} speelbare Minigolf-maps beschikbaar.`);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0,count);
}

function resolveRectCollision(body, rect) {
  const nearestX = clamp(body.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(body.y, rect.y, rect.y + rect.h);
  let dx = body.x - nearestX;
  let dy = body.y - nearestY;
  let d2 = dx * dx + dy * dy;
  if (d2 >= BALL_RADIUS * BALL_RADIUS) return false;

  if (d2 < 0.0001) {
    const left = Math.abs(body.x - rect.x);
    const right = Math.abs(rect.x + rect.w - body.x);
    const top = Math.abs(body.y - rect.y);
    const bottom = Math.abs(rect.y + rect.h - body.y);
    const minSide = Math.min(left,right,top,bottom);
    if (minSide === left) { dx=-1;dy=0;body.x=rect.x-BALL_RADIUS; }
    else if (minSide === right) { dx=1;dy=0;body.x=rect.x+rect.w+BALL_RADIUS; }
    else if (minSide === top) { dx=0;dy=-1;body.y=rect.y-BALL_RADIUS; }
    else { dx=0;dy=1;body.y=rect.y+rect.h+BALL_RADIUS; }
  } else {
    const d = Math.sqrt(d2);
    const nx = dx/d, ny = dy/d;
    const penetration = BALL_RADIUS - d;
    body.x += nx*penetration;
    body.y += ny*penetration;
    dx=nx;dy=ny;
  }

  const len = Math.hypot(dx,dy) || 1;
  const nx=dx/len,ny=dy/len;
  const dot=body.vx*nx+body.vy*ny;
  if(dot<0){
    body.vx=(body.vx-2*dot*nx)*BOUNCE;
    body.vy=(body.vy-2*dot*ny)*BOUNCE;
  }
  return true;
}

function resolveCircleCollision(body,circle) {
  let dx=body.x-circle.cx,dy=body.y-circle.cy;
  const minDist=BALL_RADIUS+circle.r;
  const d2=dx*dx+dy*dy;
  if(d2>=minDist*minDist)return false;
  const d=Math.sqrt(d2)||0.001;
  const nx=dx/d,ny=dy/d,penetration=minDist-d;
  body.x+=nx*penetration;body.y+=ny*penetration;
  const dot=body.vx*nx+body.vy*ny;
  if(dot<0){
    body.vx=(body.vx-2*dot*nx)*BOUNCE;
    body.vy=(body.vy-2*dot*ny)*BOUNCE;
  }
  return true;
}

function resolveBallCollision(a,b) {
  let dx=b.x-a.x,dy=b.y-a.y;
  const minDist=BALL_RADIUS*2;
  const d2=dx*dx+dy*dy;
  if(d2>=minDist*minDist||d2<0.000001)return false;
  const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,overlap=minDist-d;
  a.x-=nx*overlap/2;a.y-=ny*overlap/2;
  b.x+=nx*overlap/2;b.y+=ny*overlap/2;
  const rvx=b.vx-a.vx,rvy=b.vy-a.vy,rel=rvx*nx+rvy*ny;
  if(rel>=0)return true;
  const impulse=-(1+BALL_BOUNCE)*rel/2;
  a.vx-=impulse*nx;a.vy-=impulse*ny;
  b.vx+=impulse*nx;b.vy+=impulse*ny;
  return true;
}

function compactPath(path) {
  const compact=[];
  const stride=Math.max(1,Math.ceil(path.length/180));
  for(let i=0;i<path.length;i+=stride)compact.push(path[i]);
  const last=path[path.length-1];
  if(last&&compact[compact.length-1]!==last)compact.push(last);
  return compact.map((p)=>({x:Number(p.x.toFixed(2)),y:Number(p.y.toFixed(2)),reset:Boolean(p.reset)}));
}

function simulateShot(holeInput, playerStates, shooterId, angle, power, removedPropIds = []) {
  const hole = normalizeRuntimeMap(holeInput,holeInput?.id || 'shot');

  // Single-ball compatibility for editor/tests:
  if (!Array.isArray(playerStates)) {
    const start = playerStates;
    const actualAngle = Number(shooterId);
    const actualPower = Number(angle);
    const actualRemoved = Array.isArray(power) ? power : removedPropIds;
    const synthetic=[{id:'ball',ball:start,holeDone:false}];
    const result=simulateShot(hole,synthetic,'ball',actualAngle,actualPower,actualRemoved);
    return {
      end:result.finalPositions.ball,
      holed:result.holedIds.includes('ball'),
      water:result.waterIds.includes('ball'),
      path:result.paths.ball,
      removedPropIds:result.removedPropIds,
      newlyRemovedPropIds:result.newlyRemovedPropIds,
      durationMs:result.durationMs
    };
  }

  const safePower=clamp(Number(power)||0,0.06,1);
  const safeAngle=Number.isFinite(Number(angle))?Number(angle):0;
  const speed=135+865*safePower;
  const removed=new Set(removedPropIds);
  const initial=new Map();
  const bodies=[];
  const paths={};
  const waterIds=new Set();
  const holedIds=new Set();
  const movedIds=new Set([shooterId]);

  for(const p of playerStates){
    if(p.holeDone||!p.ball)continue;
    initial.set(p.id,{...p.ball});
    bodies.push({
      id:p.id,x:p.ball.x,y:p.ball.y,
      vx:p.id===shooterId?Math.cos(safeAngle)*speed:0,
      vy:p.id===shooterId?Math.sin(safeAngle)*speed:0,
      boostInside:new Set()
    });
    paths[p.id]=[{x:p.ball.x,y:p.ball.y}];
  }

  const shooter=bodies.find((b)=>b.id===shooterId);
  if(!shooter)throw new Error('Bal niet gevonden.');

  let lastActiveStep=0;

  for(let step=0;step<MAX_STEPS;step+=1){
    let anyMoving=false;

    for(const body of bodies){
      if(waterIds.has(body.id)||holedIds.has(body.id))continue;
      const speedNow=Math.hypot(body.vx,body.vy);
      if(speedNow<STOP_SPEED){
        body.vx=0;body.vy=0;
        continue;
      }

      anyMoving=true;
      body.x+=body.vx*DT;body.y+=body.vy*DT;

      if(body.x<BALL_RADIUS){body.x=BALL_RADIUS;body.vx=Math.abs(body.vx)*BOUNCE}
      else if(body.x>WIDTH-BALL_RADIUS){body.x=WIDTH-BALL_RADIUS;body.vx=-Math.abs(body.vx)*BOUNCE}
      if(body.y<BALL_RADIUS){body.y=BALL_RADIUS;body.vy=Math.abs(body.vy)*BOUNCE}
      else if(body.y>HEIGHT-BALL_RADIUS){body.y=HEIGHT-BALL_RADIUS;body.vy=-Math.abs(body.vy)*BOUNCE}

      for(const wall of hole.walls||[])resolveRectCollision(body,wall);

      for(const prop of hole.props||[]){
        if(removed.has(prop.id))continue;
        if(!obstacleHit(body,prop))continue;
        if(prop.destructible){
          if(prop.shape==='circle')resolveCircleCollision(body,prop);
          else resolveRectCollision(body,prop);
          body.vx*=0.90;body.vy*=0.90;
          removed.add(prop.id);
        }else if(prop.shape==='circle')resolveCircleCollision(body,prop);
        else resolveRectCollision(body,prop);
      }
    }

    for(let i=0;i<bodies.length;i+=1){
      const a=bodies[i];
      if(waterIds.has(a.id)||holedIds.has(a.id))continue;
      for(let j=i+1;j<bodies.length;j+=1){
        const b=bodies[j];
        if(waterIds.has(b.id)||holedIds.has(b.id))continue;
        if(resolveBallCollision(a,b)){movedIds.add(a.id);movedIds.add(b.id)}
      }
    }

    for(const body of bodies){
      if(waterIds.has(body.id)||holedIds.has(body.id))continue;

      const material=terrainAt(hole,body);
      if(material==='water'){
        waterIds.add(body.id);
        body.vx=0;body.vy=0;movedIds.add(body.id);
        paths[body.id].push({x:body.x,y:body.y});
        continue;
      }

      const speedNow=Math.hypot(body.vx,body.vy);
      if(dist(body,hole.cup)<=CUP_RADIUS-2&&speedNow<=330){
        holedIds.add(body.id);
        body.x=hole.cup.x;body.y=hole.cup.y;body.vx=0;body.vy=0;
        movedIds.add(body.id);
        paths[body.id].push({x:body.x,y:body.y});
        continue;
      }

      for(const boost of hole.boosts||[]){
        const inside = body.x>=boost.x && body.x<=boost.x+boost.w &&
          body.y>=boost.y && body.y<=boost.y+boost.h;
        if(inside&&!body.boostInside.has(boost.id)){
          const impulse=310*boost.strength;
          body.vx+=Math.cos(boost.angle)*impulse;
          body.vy+=Math.sin(boost.angle)*impulse;
          body.boostInside.add(boost.id);
        }else if(!inside){
          body.boostInside.delete(boost.id);
        }
      }

      const friction=Math.pow(MATERIALS[material].friction60,DT*60);
      body.vx*=friction;body.vy*=friction;

      if(step%5===0&&(Math.hypot(body.vx,body.vy)>0||movedIds.has(body.id))){
        paths[body.id].push({x:body.x,y:body.y});
      }
    }

    if(anyMoving)lastActiveStep=step;
    if(!anyMoving)break;
  }

  const finalPositions={};
  let maxLength=0;

  for(const body of bodies){
    if(waterIds.has(body.id)){
      const reset=initial.get(body.id);
      finalPositions[body.id]={...reset};
      paths[body.id].push({x:reset.x,y:reset.y,reset:true});
    }else if(holedIds.has(body.id)){
      finalPositions[body.id]={...hole.cup};
    }else{
      finalPositions[body.id]={x:Number(body.x.toFixed(2)),y:Number(body.y.toFixed(2))};
      paths[body.id].push({x:body.x,y:body.y});
    }

    paths[body.id]=compactPath(paths[body.id]);
    const length=paths[body.id].reduce((sum,p,i)=>i?sum+dist(p,paths[body.id][i-1]):0,0);
    maxLength=Math.max(maxLength,length);
  }

  return {
    finalPositions,
    holedIds:[...holedIds],
    waterIds:[...waterIds],
    movedIds:[...movedIds],
    removedPropIds:[...removed],
    newlyRemovedPropIds:[...removed].filter((id)=>!removedPropIds.includes(id)),
    paths,
    durationMs:clamp(Math.round(520+maxLength*1.2),600,1850),
    simulatedSteps:lastActiveStep
  };
}

function scoreHole(players) {
  const playerCount=players.length;
  const successfulStrokes=[...new Set(players.filter((p)=>p.potted).map((p)=>p.holeStrokes))].sort((a,b)=>a-b);
  const pointsByStrokes=new Map(successfulStrokes.map((strokes,index)=>[strokes,Math.max(0,playerCount-1-index)]));
  return players.map((p)=>({
    playerId:p.id,
    strokes:p.holeStrokes,
    potted:p.potted,
    points:p.potted?(pointsByStrokes.get(p.holeStrokes)||0):0
  }));
}

function currentHole(game){return game.course[game.holeIndex]}
function currentPlayer(game){return game.players[game.turnIndex]}
function allDone(game){return game.players.every((p)=>p.holeDone)}

function isPlacementValid(game, playerId, point) {
  const hole=currentHole(game);
  // Only the ball centre has to be inside the start zone.
  if(!insideZone(point,hole.startZone,0))return false;
  if(pointBlocked(hole,point,{includeDestructible:true}))return false;
  for(const p of game.players){
    if(p.id===playerId||!p.placed||!p.ball||p.holeDone)continue;
    if(dist(point,p.ball)<BALL_RADIUS*2+5)return false;
  }
  return true;
}

function npcPlacement(game,player){
  const candidates=placementCandidates(currentHole(game));
  const point=candidates.find((candidate)=>isPlacementValid(game,player.id,candidate));
  if(!point)throw new Error(`Geen vrije startpositie voor ${player.name}.`);
  player.ball={...point};player.placed=true;
  game.log.unshift(`${player.name} kiest een startpositie.`);
}

function prepareHole(game, first=false) {
  const hole=currentHole(game);
  for(const p of game.players){
    p.ball=null;p.placed=false;p.holeStrokes=0;p.holeDone=false;p.potted=false;p.failed=false;
  }
  game.removedPropIds=[];game.pendingShot=null;game.phase='playing';game.nextNpcAt=0;game.nextHoleAt=0;
  game.lastChance=null;game.lastFinisherStrokes=null;
  game.turnIndex=game.holeIndex%game.players.length;
  game.log.unshift(`${first?'Hole 1':`Hole ${game.holeIndex+1}`} · ${hole.name} · ${hole.gimmick||hole.theme||'route'} · max ${hole.maxStrokes} slagen. De speler aan beurt kiest een startpositie en speelt meteen.`);
  scheduleNpc(game,650);
}

function createGame(roomPlayers) {
  const course=selectCourse(5);
  const players=roomPlayers.map((p,index)=>({
    id:p.id,name:p.name,isNpc:p.isNpc,color:COLORS[index%COLORS.length],
    ball:null,placed:false,holeStrokes:0,holeDone:false,potted:false,failed:false,
    totalPoints:0,holeResults:[]
  }));
  const game={
    gameKey:meta.key,players,course,holeIndex:0,turnIndex:0,pendingShot:null,
    removedPropIds:[],phase:'playing',nextNpcAt:0,nextHoleAt:0,lastHoleSummary:null,
    lastChance:null,lastFinisherStrokes:null,gameOver:false,resultText:'',log:[]
  };
  prepareHole(game,true);
  return game;
}

function nextPlayableIndex(game,fromIndex=game.turnIndex){
  for(let step=1;step<=game.players.length;step+=1){
    const idx=(fromIndex+step)%game.players.length;
    if(!game.players[idx].holeDone)return idx;
  }
  return fromIndex;
}

function remainingPlayers(game){return game.players.filter((p)=>!p.holeDone)}

function markFailed(game,player,reason){
  if(player.holeDone)return;
  player.failed=true;player.holeDone=true;
  game.log.unshift(`${player.name} ${reason} en krijgt 0 punten.`);
}

function activateLastPlayerRule(game, latestFinisherStrokes) {
  if(game.players.length<=1)return;
  const remaining=remainingPlayers(game);
  if(remaining.length!==1)return;
  const player=remaining[0];
  const target=Math.min(currentHole(game).maxStrokes, latestFinisherStrokes);
  game.lastChance={playerId:player.id,targetStrokes:target};
  if(player.holeStrokes>=target){
    markFailed(game,player,`heeft al ${player.holeStrokes} slagen; de laatste finisher had ${target}`);
    game.lastChance=null;
  }else{
    game.log.unshift(`${player.name} is als laatste over en krijgt nog maximaal 1 poging, tot ${target} slagen.`);
  }
}

function beginShot(game,player,angle,power){
  if(game.pendingShot||game.phase!=='playing')throw new Error('Wacht tot de vorige slag klaar is.');
  if(player.holeDone)throw new Error('Je bent al klaar met deze hole.');

  const result=simulateShot(currentHole(game),game.players,player.id,angle,power,game.removedPropIds);
  const shotNumber=player.holeStrokes+1;

  game.pendingShot={
    id:crypto.randomUUID(),playerId:player.id,playerName:player.name,
    paths:result.paths,finalPositions:result.finalPositions,holedIds:result.holedIds,
    waterIds:result.waterIds,movedIds:result.movedIds,newlyRemovedPropIds:result.newlyRemovedPropIds,
    durationMs:result.durationMs,endsAt:Date.now()+result.durationMs,shotNumber
  };
  game.nextNpcAt=0;
  game.log.unshift(`${player.name} slaat ${shotNumber}.`);
}

function finishShot(game){
  const shot=game.pendingShot;
  if(!shot)return;
  const shooter=game.players.find((p)=>p.id===shot.playerId);
  if(!shooter){game.pendingShot=null;return}

  shooter.holeStrokes+=1;
  const newlyPotted=[];

  for(const p of game.players){
    if(p.holeDone)continue;
    if(shot.finalPositions[p.id])p.ball={...shot.finalPositions[p.id]};
    if(shot.holedIds.includes(p.id)){
      p.potted=true;p.holeDone=true;newlyPotted.push(p);
      game.log.unshift(`${p.name} pot in ${p.holeStrokes} slag${p.holeStrokes===1?'':'en'}${p.id!==shooter.id?' dankzij een botsing':''}.`);
    }
  }

  for(const id of shot.waterIds){
    const p=game.players.find((x)=>x.id===id);
    if(p&&!p.holeDone)game.log.unshift(`${p.name} belandt in het water en wordt teruggelegd.`);
  }

  game.removedPropIds=[...new Set([...game.removedPropIds,...shot.newlyRemovedPropIds])];
  if(shot.newlyRemovedPropIds.length){
    game.log.unshift(`${shot.newlyRemovedPropIds.length} obstakel${shot.newlyRemovedPropIds.length===1?'':'s'} botst met de bal en verdwijnt daarna.`);
  }

  if(newlyPotted.length){
    game.lastFinisherStrokes=Math.max(...newlyPotted.map((p)=>p.holeStrokes));
  }

  if(!shooter.holeDone){
    if(game.lastChance?.playerId===shooter.id){
      markFailed(game,shooter,`mist zijn laatste poging op ${shooter.holeStrokes} slagen`);
      game.lastChance=null;
    }else if(shooter.holeStrokes>=currentHole(game).maxStrokes){
      markFailed(game,shooter,`haalt de limiet van ${currentHole(game).maxStrokes}`);
    }
  }

  if(remainingPlayers(game).length===1 && !game.lastChance && game.lastFinisherStrokes!=null){
    activateLastPlayerRule(game,game.lastFinisherStrokes);
  }

  game.pendingShot=null;
  if(remainingPlayers(game).length===0){finishHole(game);return}
  game.turnIndex=nextPlayableIndex(game);
  scheduleNpc(game);
}

function finishHole(game){
  const results=scoreHole(game.players);
  for(const result of results){
    const p=game.players.find((x)=>x.id===result.playerId);
    p.totalPoints+=result.points;
    p.holeResults.push({strokes:result.strokes,potted:result.potted,points:result.points});
  }
  const summary=results.map((result)=>{
    const p=game.players.find((x)=>x.id===result.playerId);
    return `${p.name} ${result.potted?`${result.strokes} sl.`:'DNF'} → ${result.points} pt`;
  }).join(' · ');
  game.lastHoleSummary=`Hole ${game.holeIndex+1}: ${summary}`;
  game.log.unshift(game.lastHoleSummary);

  if(game.holeIndex>=game.course.length-1){finishGame(game);return}
  game.phase='between';game.nextHoleAt=Date.now()+BETWEEN_HOLES_MS;game.nextNpcAt=0;
}

function startNextHole(game){
  game.holeIndex+=1;
  prepareHole(game,false);
}

function finishGame(game){
  game.phase='done';game.gameOver=true;game.nextNpcAt=0;game.nextHoleAt=0;
  const high=Math.max(...game.players.map((p)=>p.totalPoints));
  const winners=game.players.filter((p)=>p.totalPoints===high);
  game.resultText=winners.length===1
    ?`${winners[0].name} wint Minigolf met ${high} punten.`
    :`Gelijkspel tussen ${winners.map((p)=>p.name).join(', ')} met ${high} punten.`;
}

function rayBlocked(hole,from,to,removedPropIds=[]){
  const removed=new Set(removedPropIds);
  const steps=Math.max(8,Math.ceil(dist(from,to)/16));
  for(let i=1;i<steps;i+=1){
    const t=i/steps;
    const point={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
    if((hole.walls||[]).some((rect)=>circleRectCollision(point,rect,BALL_RADIUS+2)))return true;
    if((hole.props||[]).some((prop)=>!removed.has(prop.id)&&!prop.destructible&&obstacleHit(point,prop)))return true;
    if(terrainAt(hole,point)==='water')return true;
  }
  return false;
}

function chooseNpcShot(game,player){
  const hole=currentHole(game);
  const directAngle=Math.atan2(hole.cup.y-player.ball.y,hole.cup.x-player.ball.x);
  const directDistance=dist(player.ball,hole.cup);
  const powers=directDistance<160?[0.15,0.2,0.26,0.34,0.42]:[0.38,0.5,0.62,0.74,0.88,1];
  const offsets=[0,-0.1,0.1,-0.22,0.22,-0.38,0.38,-0.62,0.62,-0.9,0.9,1.2,-1.2];
  let best=null;
  for(const offset of offsets){
    const angle=directAngle+offset;
    for(const power of powers){
      const sim=simulateShot(hole,game.players,player.id,angle,power,game.removedPropIds);
      const end=sim.finalPositions[player.id];
      const holed=sim.holedIds.includes(player.id);
      const water=sim.waterIds.includes(player.id);
      const remaining=end?dist(end,hole.cup):9999;
      const blockedPenalty=end&&rayBlocked(hole,end,hole.cup,sim.removedPropIds)?75:0;
      const score=holed?-10000+power*10:remaining+blockedPenalty+(water?450:0)+power*8;
      if(!best||score<best.score)best={angle,power,score};
    }
  }
  return {
    angle:best.angle+(Math.random()-0.5)*0.045,
    power:clamp(best.power+(Math.random()-0.5)*0.035,0.08,1)
  };
}

function scheduleNpc(game,delay=NPC_DELAY){
  const player=currentPlayer(game);
  game.nextNpcAt=!game.gameOver&&game.phase==='playing'&&!game.pendingShot&&player?.isNpc
    ?Date.now()+delay:0;
}

function tick(game,now=Date.now()){
  if(game.gameOver)return false;
  if(game.pendingShot){
    if(now<game.pendingShot.endsAt)return false;
    finishShot(game);return true;
  }
  if(game.phase==='between'){
    if(now<game.nextHoleAt)return false;
    startNextHole(game);return true;
  }
  if(game.phase!=='playing')return false;

  const player=currentPlayer(game);
  if(!player?.isNpc||player.holeDone){game.nextNpcAt=0;return false}
  if(!game.nextNpcAt)game.nextNpcAt=now+NPC_DELAY;
  if(now<game.nextNpcAt)return false;

  if(!player.placed){
    npcPlacement(game,player);
    game.nextNpcAt=now+420;
    return true;
  }

  const shot=chooseNpcShot(game,player);
  beginShot(game,player,shot.angle,shot.power);
  return true;
}

function handleAction(game,playerId,action,payload={}){
  if(game.gameOver)throw new Error('Het spel is afgelopen.');
  const player=game.players.find((p)=>p.id===playerId);
  if(!player||player.isNpc)throw new Error('Speler niet gevonden.');
  const turn=currentPlayer(game);
  if(!turn||turn.id!==playerId)throw new Error('Je bent niet aan de beurt.');

  if(action==='placeBall'){
    if(game.phase!=='playing'||player.placed)throw new Error('Je kunt nu geen startpositie kiezen.');
    const point={x:Number(payload.x),y:Number(payload.y)};
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!isPlacementValid(game,playerId,point)){
      throw new Error('Kies een vrije plek waarvan het middelpunt binnen het startvak ligt.');
    }
    player.ball={x:Number(point.x.toFixed(2)),y:Number(point.y.toFixed(2))};
    player.placed=true;
    game.log.unshift(`${player.name} kiest een startpositie en mag nu zijn eerste slag spelen.`);
    return;
  }

  if(action!=='shoot')throw new Error('Onbekende actie.');
  if(game.phase!=='playing'||game.pendingShot)throw new Error('Wacht tot je kunt slaan.');
  if(!player.placed||!player.ball)throw new Error('Kies eerst je startpositie.');
  const angle=Number(payload.angle),power=Number(payload.power);
  if(!Number.isFinite(angle)||!Number.isFinite(power))throw new Error('Ongeldige slag.');
  if(power<0.06)throw new Error('Sleep iets verder om kracht te geven.');
  beginShot(game,turn,angle,clamp(power,0.06,1));
}

function serialize(game,requesterId,connected){
  const hole=currentHole(game);
  const me=game.players.find((p)=>p.id===requesterId);
  const turn=currentPlayer(game);
  return {
    kind:meta.key,
    course:{width:WIDTH,height:HEIGHT,holes:game.course.length,poolSize:20+customMapPool().length},
    hole:{
      number:game.holeIndex+1,name:hole.name,theme:hole.theme,gimmick:hole.gimmick,difficulty:hole.difficulty,maxStrokes:hole.maxStrokes,
      start:hole.start,startZone:hole.startZone,cup:hole.cup,terrain:hole.terrain,walls:hole.walls,
      props:hole.props.filter((p)=>!game.removedPropIds.includes(p.id)),boosts:hole.boosts||[]
    },
    phase:game.phase,
    turnPlayerId:game.phase==='playing'&&!game.pendingShot&&!game.gameOver?turn?.id:null,
    pendingShot:game.pendingShot?{
      id:game.pendingShot.id,playerId:game.pendingShot.playerId,playerName:game.pendingShot.playerName,
      paths:game.pendingShot.paths,movedIds:game.pendingShot.movedIds,waterIds:game.pendingShot.waterIds,
      holedIds:game.pendingShot.holedIds,removedPropIds:game.pendingShot.newlyRemovedPropIds,
      durationMs:game.pendingShot.durationMs,shotNumber:game.pendingShot.shotNumber
    }:null,
    lastChance:game.lastChance,
    lastHoleSummary:game.lastHoleSummary,gameOver:game.gameOver,resultText:game.resultText,log:game.log,
    players:game.players.map((p)=>({
      id:p.id,name:p.name,isNpc:p.isNpc,connected:p.isNpc||connected.get(p.id),color:p.color,
      ball:p.ball,placed:p.placed,totalPoints:p.totalPoints,holeStrokes:p.holeStrokes,
      holeDone:p.holeDone,potted:p.potted,failed:p.failed,holeResults:p.holeResults
    })),
    canPlace:Boolean(!game.gameOver&&game.phase==='playing'&&!game.pendingShot&&turn?.id===requesterId&&me&&!me.placed),
    canShoot:Boolean(!game.gameOver&&game.phase==='playing'&&!game.pendingShot&&turn?.id===requesterId&&me?.placed)
  };
}

module.exports={
  meta,MATERIALS,selectCourse,combinedMapPool,buildSmartPool,customMapPool,setCustomMapProvider,
  sanitizeMapDefinition,validateMapPlayability,normalizeRuntimeMap,
  createGame,handleAction,serialize,tick,simulateShot,chooseNpcShot,scoreHole,terrainAt,
  isPlacementValid,activateLastPlayerRule
};
