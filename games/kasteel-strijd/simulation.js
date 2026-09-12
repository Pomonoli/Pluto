'use strict';
// Authoritative duel simulation for Castle Defense: identical rules for both sides.
const W = 1400;
const GROUND_Y = 460;
const P_CASTLE_X = 105, E_CASTLE_X = W - 105;
const P_SPAWN_X = 215, E_SPAWN_X = W - 215;
const CASTLE_HIT_P = 300, CASTLE_HIT_E = W - 300; // Aanvallers stoppen vóór de muren.
const CLAMP_MIN_X = -20, CLAMP_MAX_X = W + 20;
const MAX_LEVEL = 10;
const MAX_TURRETS = 3;
const MAX_QUEUE = 5;
const SEPARATION = 26;
const MINE_X_P = 430, MINE_X_E = W - 430;
const MAX_WORKERS = 5;
// Turret types: near = short range/high damage, far = artillery, bonus = banner that buffs own units and workers.
const TURRET_TYPES = {
  near: { range: 210, dmg: 12, cd: 1.0 },
  far: { range: 440, dmg: 8, cd: 2.2 },
  bonus: { range: 0, dmg: 0, cd: 0, aura: 0.15 }
};

const ERA_NAMES = ['Prehistorie', 'Klassieke Oudheid', 'Middeleeuwen', 'Renaissance', 'Verlichting', 'Moderne Tijd', 'Huidige Tijd'];
const ROLES = ['melee', 'ranged', 'heavy'];
const TRAIN_ROLES = ['melee', 'ranged', 'heavy', 'hero', 'worker'];
// Base stats per role (era 0); hp, damage and cost scale with eraMult.
const ROLE_DEFS = {
  melee: { cost: 25, hp: 42, dmg: 6, speed: 64, range: 30, interval: 0.9, train: 1.8, xp: 4, counters: 'ranged' },
  ranged: { cost: 40, hp: 26, dmg: 7, speed: 56, range: 170, interval: 1.3, train: 2.4, xp: 6, counters: 'heavy' },
  heavy: { cost: 90, hp: 150, dmg: 17, speed: 44, range: 38, interval: 1.4, train: 4.5, xp: 14, counters: 'melee' },
  hero: { cost: 160, hp: 300, dmg: 24, speed: 60, range: 36, interval: 0.8, train: 6, xp: 30, counters: null },
  worker: { cost: 30, hp: 30, dmg: 0, speed: 50, range: 0, interval: 1, train: 1.5, xp: 3, counters: null, mine: 1.2 }
};
const COUNTER_BONUS = 1.5;
const EVOLVE_XP = [120, 260, 450, 700, 1000, 1400];
const ABILITY_DEFS = { rally: { cost: 60, cd: 30 }, special: { cost: 140, cd: 45 } };

// ---------- Formulas ----------
function round1(x) { return Math.round(x * 10) / 10; }
function eraMult(era) { return Math.pow(1.75, era); }
function unitCost(role, era) { return Math.round(ROLE_DEFS[role].cost * eraMult(era)); }
function unitHp(role, era) { return Math.round(ROLE_DEFS[role].hp * eraMult(era)); }
function unitDmg(role, era) { return round1(ROLE_DEFS[role].dmg * eraMult(era)); }
function castleMaxHp(lv, era) { return Math.round((900 + (lv - 1) * 120) * eraMult(era)); }
function goldRate(lv, era) { return round1((3 + (lv - 1) * 0.6) * eraMult(era)); }
function costWalls(lv, era) { return Math.round(80 * Math.pow(1.5, lv - 1) * eraMult(era)); }
function costEconomy(lv, era) { return Math.round(70 * Math.pow(1.5, lv - 1) * eraMult(era)); }
function costTurret(count, era) { return Math.round(120 * Math.pow(1.6, count) * eraMult(era)); }
function turretDmg(type, era) { return round1(TURRET_TYPES[type].dmg * eraMult(era)); }
function mineRate(era) { return round1(ROLE_DEFS.worker.mine * eraMult(era)); }
function evolveXp(era) { return EVOLVE_XP[era] ?? Infinity; }
function abilityCost(key, era) { return Math.round(ABILITY_DEFS[key].cost * eraMult(era)); }
function specialDamage(era) { return Math.round(45 * eraMult(era)); }

function army() {
  return {
    gold: 120, xp: 0, era: 0,
    castleHp: castleMaxHp(1, 0), castleMaxHp: castleMaxHp(1, 0), wallsLevel: 1, economyLevel: 1,
    turrets: [], queue: [], trainT: 0,
    rallyUntil: 0, cooldowns: { rally: 0, special: 0 }, kills: 0
  };
}
function createState() { return { elapsed: 0, running: true, unitSeq: 1, units: [], effects: [], player: army(), enemy: army(), winner: null }; }

function simulation(state) {
  const other = (side) => (side === 'player' ? 'enemy' : 'player');
  const bonusCount = (side) => state[side].turrets.filter((t) => t.type === 'bonus').length;
  const onOwnHalf = (u) => (u.side === 'player' ? u.x < W / 2 : u.x > W / 2);
  function addEffect(kind, props) { state.effects.push({ kind, t: 0, ...props }); }

  function spawnUnit(side, role) {
    const p = state[side], def = ROLE_DEFS[role];
    state.units.push({
      id: state.unitSeq++, side, role, era: p.era,
      x: side === 'player' ? P_SPAWN_X : E_SPAWN_X, y: GROUND_Y + (Math.random() - 0.5) * 26,
      hp: unitHp(role, p.era), maxHp: unitHp(role, p.era), dmg: unitDmg(role, p.era),
      speed: def.speed + p.era * 3, range: def.range, interval: def.interval,
      mineX: role === 'worker' ? (side === 'player' ? MINE_X_P : MINE_X_E) : undefined,
      dir: side === 'player' ? 1 : -1, state: 'move', target: null, atkCd: 0.3, dead: false, deathT: 0,
      flash: 0, phase: Math.random() * 10
    });
  }

  function grantKill(side, victim) {
    const p = state[side];
    p.kills++;
    p.gold += Math.round(unitCost(victim.role, victim.era) * 0.4);
    // Kills of higher-era units are worth more XP, so a trailing side can catch up.
    p.xp += ROLE_DEFS[victim.role].xp * Math.max(1, eraMult(victim.era - p.era));
  }
  function hurtUnit(target, dealt, attackerSide, hitX) {
    target.hp -= dealt; target.flash = 0.15;
    if (target.hp <= 0 && !target.dead) { target.dead = true; target.deathT = 0; grantKill(attackerSide, target); }
    addEffect('hit', { x: hitX, y: target.y - 40, color: attackerSide === 'player' ? '#bfe0ff' : '#ffd0d0' });
  }
  function hurtCastle(side, dealt, attackerSide) {
    state[side].castleHp = Math.max(0, state[side].castleHp - dealt);
    state[attackerSide].xp += 0.4;
  }
  function nearestFoe(u) {
    let best = null, bestD = Infinity;
    for (const o of state.units) {
      if (o.side === u.side || o.dead) continue;
      const d = Math.abs(o.x - u.x);
      if (d < bestD) { bestD = d; best = o; }
    }
    return { unit: best, dist: bestD };
  }
  function damageMult(attacker, target) {
    const rally = state.elapsed < state[attacker.side].rallyUntil ? 1.4 : 1;
    const banner = onOwnHalf(attacker) ? 1 + bonusCount(attacker.side) * TURRET_TYPES.bonus.aura : 1;
    return rally * banner * (target && ROLE_DEFS[attacker.role].counters === target.role ? COUNTER_BONUS : 1);
  }

  function act(side, action, key) {
    if (!state.running) throw new Error('Het spel is afgelopen.');
    const p = state[side], foe = state[other(side)];
    if (action === 'train') {
      if (!TRAIN_ROLES.includes(key)) throw new Error('Onbekende eenheid.');
      const cost = unitCost(key, p.era);
      if (p.queue.length >= MAX_QUEUE) throw new Error('De wachtrij is vol.');
      const owned = (role) => p.queue.filter((r) => r === role).length + state.units.filter((u) => u.side === side && u.role === role && !u.dead).length;
      if (key === 'hero' && owned('hero') >= 1) throw new Error('Je hebt al een held.');
      if (key === 'worker' && owned('worker') >= MAX_WORKERS) throw new Error('Alle werkers zijn al ingezet.');
      if (p.gold < cost) throw new Error('Niet genoeg goud.');
      p.gold -= cost; p.queue.push(key);
      return;
    }
    if (action === 'turret') {
      if (!Object.hasOwn(TURRET_TYPES, key)) throw new Error('Onbekend torentype.');
      const cost = costTurret(p.turrets.length, p.era);
      if (p.turrets.length >= MAX_TURRETS) throw new Error('Alle torenplaatsen zijn bezet.');
      if (p.gold < cost) throw new Error('Niet genoeg goud.');
      p.gold -= cost; p.turrets.push({ type: key, cd: 0.5 });
      return;
    }
    if (action === 'upgrade') {
      const costs = { walls: costWalls, economy: costEconomy };
      if (!Object.hasOwn(costs, key)) throw new Error('Onbekende upgrade.');
      const lv = p[key + 'Level'], cost = costs[key](lv, p.era);
      if (lv >= MAX_LEVEL || p.gold < cost) throw new Error('Upgrade is nog niet mogelijk.');
      p.gold -= cost; p[key + 'Level']++;
      if (key === 'walls') {
        p.castleMaxHp = castleMaxHp(p.wallsLevel, p.era);
        p.castleHp = Math.min(p.castleMaxHp, p.castleHp + p.castleMaxHp * 0.2);
      }
      return;
    }
    if (action === 'evolve') {
      if (p.era >= ERA_NAMES.length - 1 || p.xp < evolveXp(p.era)) throw new Error('Evolueren is nog niet mogelijk.');
      const pct = p.castleHp / p.castleMaxHp;
      p.xp -= evolveXp(p.era); p.era++;
      p.castleMaxHp = castleMaxHp(p.wallsLevel, p.era);
      p.castleHp = Math.min(p.castleMaxHp, (pct + 0.3) * p.castleMaxHp);
      addEffect('evolve', { side, era: p.era });
      return;
    }
    if (action === 'ability') {
      if (!Object.hasOwn(ABILITY_DEFS, key)) throw new Error('Onbekende vaardigheid.');
      const cost = abilityCost(key, p.era);
      if (p.cooldowns[key] > 0 || p.gold < cost) throw new Error('Vaardigheid is nog niet beschikbaar.');
      p.gold -= cost; p.cooldowns[key] = ABILITY_DEFS[key].cd;
      if (key === 'rally') { p.rallyUntil = state.elapsed + 8; addEffect('rally', { side }); return; }
      const dmg = specialDamage(p.era), foeSide = other(side);
      const half = side === 'player' ? (u) => u.x >= W / 2 - 80 : (u) => u.x <= W / 2 + 80;
      for (const u of state.units) if (u.side === foeSide && !u.dead && half(u)) hurtUnit(u, dmg, side, u.x);
      hurtCastle(foeSide, foe.castleMaxHp * 0.03, side);
      addEffect('special', { side, era: p.era });
      return;
    }
    throw new Error('Onbekende actie.');
  }
  function endGame(winner) { state.running = false; state.winner = winner; }

  function update(dt) {
    const s = state;
    if (!s.running) return;
    s.elapsed += dt;
    for (const side of ['player', 'enemy']) {
      const p = s[side];
      p.gold += goldRate(p.economyLevel, p.era) * dt;
      p.xp += 0.6 * dt;
      for (const k in p.cooldowns) p.cooldowns[k] = Math.max(0, p.cooldowns[k] - dt);
      if (p.queue.length) {
        p.trainT += dt;
        if (p.trainT >= ROLE_DEFS[p.queue[0]].train) { spawnUnit(side, p.queue.shift()); p.trainT = 0; }
      } else p.trainT = 0;
      // Turrets fire at the closest hostile within their range of the base; banners only buff.
      const cx = side === 'player' ? P_CASTLE_X : E_CASTLE_X;
      for (const t of p.turrets) {
        const def = TURRET_TYPES[t.type];
        if (!def.dmg) continue;
        t.cd -= dt;
        if (t.cd > 0) continue;
        let best = null, bestD = def.range;
        for (const u of s.units) {
          if (u.side === side || u.dead) continue;
          const d = Math.abs(u.x - cx);
          if (d < bestD) { bestD = d; best = u; }
        }
        if (!best) continue;
        t.cd = def.cd;
        addEffect('shot', { x1: cx + (side === 'player' ? 40 : -40), y1: GROUND_Y - 150, x2: best.x, y2: best.y - 40, era: p.era, side, heavy: t.type === 'far' });
        hurtUnit(best, turretDmg(t.type, p.era), side, best.x);
      }
    }

    for (const u of s.units) {
      if (u.dead) { u.deathT += dt; continue; }
      u.phase += dt;
      if (u.flash > 0) u.flash -= dt;
      const rallied = s.elapsed < s[u.side].rallyUntil;
      const speed = u.speed * (rallied ? 1.3 : 1);
      if (u.role === 'worker') {
        // Workers walk to the mine and dig; they never fight and stay a soft target.
        const d = u.mineX - u.x;
        if (Math.abs(d) > 4) { u.state = 'move'; u.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt); }
        else { u.state = 'mine'; s[u.side].gold += mineRate(u.era) * (1 + bonusCount(u.side) * TURRET_TYPES.bonus.aura) * dt; }
        continue;
      }
      const { unit: foe, dist } = nearestFoe(u);
      const castleDist = u.side === 'player' ? CASTLE_HIT_E - u.x : u.x - CASTLE_HIT_P;
      if (foe && dist <= u.range + 4) { u.state = 'fight'; u.target = foe.id; }
      else if (castleDist <= Math.max(0, u.range - 20)) { u.state = 'siege'; u.target = null; }
      else { u.state = 'move'; u.target = null; }

      if (u.state === 'move') {
        // Hold formation behind a friendly unit that is already ahead; ranged units and workers never block,
        // so melee, heavy and heroes always overtake them and the shooters keep firing from the back.
        let blocked = false;
        for (const o of s.units) {
          if (o === u || o.side !== u.side || o.dead || o.state === 'move' || o.role === 'ranged' || o.role === 'worker') continue;
          const ahead = (o.x - u.x) * u.dir;
          if (ahead > 0 && ahead < SEPARATION) { blocked = true; break; }
        }
        if (!blocked) u.x = Math.max(CLAMP_MIN_X, Math.min(CLAMP_MAX_X, u.x + u.dir * speed * dt));
      }

      u.atkCd -= dt;
      if (u.state === 'fight') {
        const target = s.units.find((o) => o.id === u.target && !o.dead);
        if (target && u.atkCd <= 0) {
          u.atkCd = u.interval;
          const dealt = round1(u.dmg * damageMult(u, target));
          if (u.role === 'ranged') addEffect('shot', { x1: u.x + u.dir * 14, y1: u.y - 46, x2: target.x, y2: target.y - 40, era: u.era, side: u.side });
          hurtUnit(target, dealt, u.side, (u.x + target.x) / 2);
        }
      } else if (u.state === 'siege' && u.atkCd <= 0) {
        u.atkCd = u.interval;
        const dealt = round1(u.dmg * damageMult(u, null));
        const foeSide = other(u.side);
        hurtCastle(foeSide, dealt, u.side);
        addEffect('hit', { x: u.x + u.dir * 28, y: u.y - 40, color: '#ffd35c' });
      }
    }

    s.units = s.units.filter((u) => !(u.dead && u.deathT > 0.55));
    for (const e of s.effects) e.t += dt;
    s.effects = s.effects.filter((e) => e.t < (e.kind === 'special' || e.kind === 'evolve' ? 1.4 : e.kind === 'rally' ? 1 : 0.3));

    if (s.player.castleHp <= 0 && s.enemy.castleHp <= 0) endGame(s.player.castleHp >= s.enemy.castleHp ? 'player' : 'enemy');
    else if (s.player.castleHp <= 0) endGame('enemy');
    else if (s.enemy.castleHp <= 0) endGame('player');
  }
  return { act, update };
}

module.exports = {
  createState, simulation, ERA_NAMES, ROLES, TRAIN_ROLES, ROLE_DEFS, TURRET_TYPES, MAX_LEVEL, MAX_TURRETS, MAX_QUEUE, MAX_WORKERS, MINE_X_P, MINE_X_E, W,
  eraMult, unitCost, unitHp, unitDmg, castleMaxHp, goldRate, costWalls, costEconomy, costTurret, turretDmg, mineRate, evolveXp, abilityCost, specialDamage
};
