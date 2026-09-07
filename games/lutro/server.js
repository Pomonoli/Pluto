'use strict';

/**
 * Lutro: Siege of the Four Realms — server-authoritative logic.
 *
 * Follows the Pluto plugin server contract (see games/README.md). Like
 * Ragnarok, this is a continuous realtime board: there is no shared turn
 * order. Every player (human or NPC) rolls a personal die on a cooldown,
 * deploys or advances a unit with that roll, and gold trickles in on its
 * own. Four castles ring an isometric board; units that cross the board and
 * reach the central Siege Square strike a rival stronghold and despawn.
 */

const PATH_LENGTH = 48;
const EDGE_LENGTH = 12;
const HOME_STEPS = 4; // steps 0..3 on the home stretch, step 4 = Siege Square strike
const CASTLE_MAX_HP = 1000;
const GOLD_START = 350;
const GOLD_PER_SEC = 10;
const GOLD_TICK_MS = 1000;
const ROLL_COOLDOWN_MS = 3200;
const NPC_THINK_MS = 2000;
const REPAIR_COST = 200;
const REPAIR_AMOUNT = 250;
const UPGRADE_COST = 150;
const MAX_TURRET_TIER = 3;
const SHIELD_DURATION_MS = 12000;
const SHIELD_DEFENSE_MULT = 1.5;
const ATTACK_TILE_DAMAGE = 70;
const ATTACK_TILE_COOLDOWN_MS = 8000;
const MATCH_TIME_CAP_MS = 25 * 60 * 1000;

// Corner order fixed to the board geometry: index*EDGE_LENGTH is that
// faction's corner tile (0=NW, 1=NE, 2=SE, 3=SW).
const FACTIONS = [
  { key: 'rivendell', name: 'Rivendell', people: 'Elven', color: '#5fa8d3', turret: 'archery' },
  { key: 'erebor', name: 'Erebor', people: 'Dwarven', color: '#d4a72c', turret: 'ballista' },
  { key: 'baraddur', name: 'Barad-dûr', people: 'Orc', color: '#8a2b2b', turret: 'beam' },
  { key: 'minastirith', name: 'Minas Tirith', people: 'Human', color: '#3f6b4a', turret: 'trebuchet' }
];
// Default seat order: the first (human) seat gets Minas Tirith; NPC fills
// take the remaining seats in this order, matching the bot personalities.
const SEAT_ORDER = ['minastirith', 'baraddur', 'erebor', 'rivendell'];

const UNIT_CLASSES = {
  scout: { cost: 50, hp: 60, atk: 18, def: 8, siegeDamage: 50 },
  infantry: { cost: 100, hp: 130, atk: 30, def: 20, siegeDamage: 100 },
  siege: { cost: 250, hp: 260, atk: 50, def: 35, siegeDamage: 250 }
};
const UNIT_ORDER = ['scout', 'infantry', 'siege'];

const TURRET_CONFIG = {
  archery: { cooldownMs: 1100, damage: 12, targets: 2 },
  ballista: { cooldownMs: 2600, damage: 48, targets: 1 },
  trebuchet: { cooldownMs: 2000, damage: 22, targets: 'aoe' },
  beam: { cooldownMs: 850, damage: 9, targets: 1 }
};
const TURRET_RANGE = 3;
const TURRET_TIER_MULT = [1, 1.3, 1.6];

/* ---------------- board geometry (pure, deterministic — mirrored in client.js) ---------------- */

function factionIndex(key) { return FACTIONS.findIndex((f) => f.key === key); }
function cornerIndex(f) { return f * EDGE_LENGTH; }
function startTileIndex(f) { return f * EDGE_LENGTH + 2; }
function defenceTileIndex(f) { return f * EDGE_LENGTH + 5; }
function attackTileIndex(f) { return f * EDGE_LENGTH + 9; }
function entranceTileIndex(f) { return (f * EDGE_LENGTH - 1 + PATH_LENGTH) % PATH_LENGTH; }
function cyclicDistance(a, b, length = PATH_LENGTH) { const d = Math.abs(a - b); return Math.min(d, length - d); }

/* ---------------- helpers ---------------- */

function rollDie() { return 1 + Math.floor(Math.random() * 6); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function weightedPick(list) {
  const total = list.reduce((sum, x) => sum + x.w, 0);
  let roll = Math.random() * total;
  for (const item of list) { roll -= item.w; if (roll <= 0) return item; }
  return list[list.length - 1];
}

function addLog(game, text) {
  game.log.push(text);
  if (game.log.length > 200) game.log.splice(0, game.log.length - 200);
}

function activePlayers(game) { return game.order.map((id) => game.players[id]).filter((p) => !p.eliminated); }
function enemiesOf(game, p) { return activePlayers(game).filter((o) => o.id !== p.id); }
function playerScore(p) { return p.castleHp + p.gold * 0.5 + p.units.length * 40; }

/* ---------------- lifecycle ---------------- */

function createGame(roomPlayers) {
  const now = Date.now();
  const players = {};
  const order = roomPlayers.map((rp) => rp.id);

  roomPlayers.forEach((rp, i) => {
    const faction = SEAT_ORDER[i % SEAT_ORDER.length];
    players[rp.id] = {
      id: rp.id,
      name: rp.name,
      isNpc: Boolean(rp.isNpc),
      faction,
      gold: GOLD_START,
      castleHp: CASTLE_MAX_HP,
      turretTier: 1,
      turretNextFireAt: now + 500,
      targetFaction: null,
      lastRoll: null,
      rollPending: false,
      nextRollAt: now,
      eliminated: false,
      eliminatedAt: null,
      nextThinkAt: now + Math.random() * NPC_THINK_MS,
      units: []
    };
  });

  const game = {
    gameKey: 'lutro',
    gameOver: false,
    resultText: '',
    winnerId: null,
    startedAt: now,
    lastGoldAt: now,
    nextUnitId: 1,
    players,
    order,
    log: []
  };

  order.forEach((id) => ensureTarget(game, players[id]));
  addLog(game, 'Het beleg van de Vier Rijken begint.');
  return game;
}

function ensureTarget(game, p) {
  const enemies = enemiesOf(game, p);
  if (!enemies.length) { p.targetFaction = null; return; }
  if (p.targetFaction && enemies.some((e) => e.faction === p.targetFaction)) return;
  const weakest = enemies.slice().sort((a, b) => a.castleHp - b.castleHp)[0];
  p.targetFaction = weakest.faction;
}

function targetPlayer(game, p) {
  ensureTarget(game, p);
  if (!p.targetFaction) return null;
  return enemiesOf(game, p).find((e) => e.faction === p.targetFaction) || null;
}

/* ---------------- unit movement ---------------- */

function spawnUnit(game, p, cls) {
  const stats = UNIT_CLASSES[cls];
  const unit = {
    id: game.nextUnitId++,
    cls,
    hp: stats.hp,
    maxHp: stats.hp,
    zone: 'path',
    pos: startTileIndex(factionIndex(p.faction)),
    homeStep: 0,
    shieldUntil: 0,
    tileCooldownUntil: 0
  };
  p.units.push(unit);
  return unit;
}

function removeUnit(p, unitId) {
  const idx = p.units.findIndex((u) => u.id === unitId);
  if (idx >= 0) p.units.splice(idx, 1);
}

function effectiveDef(p, unit) {
  const stats = UNIT_CLASSES[unit.cls];
  let def = stats.def;
  if (p.faction === 'erebor') def *= 1.25;
  if (unit.shieldUntil > Date.now()) def *= SHIELD_DEFENSE_MULT;
  return def;
}

function effectiveAtk(p, unit) {
  const stats = UNIT_CLASSES[unit.cls];
  let atk = stats.atk;
  if (p.faction === 'rivendell') atk *= 1.15;
  if (p.faction === 'baraddur') atk *= 1 + (1 - unit.hp / unit.maxHp) * 0.6;
  return atk;
}

function resolveCombat(game, attackerP, attacker, defenderP, defender) {
  const dmg = Math.max(6, effectiveAtk(attackerP, attacker) - effectiveDef(defenderP, defender) * 0.5);
  defender.hp -= dmg;
  if (defender.hp <= 0) {
    removeUnit(defenderP, defender.id);
    addLog(game, `${attackerP.name} vernietigt een eenheid van ${defenderP.name}.`);
    return;
  }
  let counter = Math.max(0, effectiveDef(defenderP, defender) * 0.35 - effectiveAtk(attackerP, attacker) * 0.15);
  if (defenderP.faction === 'minastirith') counter *= 1.6;
  attacker.hp -= counter;
  if (attacker.hp <= 0) {
    removeUnit(attackerP, attacker.id);
    addLog(game, `${defenderP.name} slaat de aanval van ${attackerP.name} af en vernietigt de eenheid.`);
  } else {
    addLog(game, `${attackerP.name} en ${defenderP.name} botsen op het slagveld.`);
  }
}

function strikeCastle(game, attackerP, unit, damage, source) {
  const target = targetPlayer(game, attackerP);
  if (!target) return;
  target.castleHp = Math.max(0, target.castleHp - damage);
  addLog(game, `${attackerP.name} raakt ${target.name} ${source} voor ${damage} schade.`);
}

function moveUnit(game, p, unit, steps) {
  let remaining = steps;
  const f = factionIndex(p.faction);
  while (remaining > 0) {
    if (unit.zone === 'path') {
      if (unit.pos === entranceTileIndex(f)) {
        unit.zone = 'home';
        unit.homeStep = 0;
        remaining -= 1;
      } else {
        unit.pos = (unit.pos + 1) % PATH_LENGTH;
        remaining -= 1;
      }
    } else {
      if (unit.homeStep >= HOME_STEPS) break;
      unit.homeStep += 1;
      remaining -= 1;
    }
  }

  if (unit.zone === 'home' && unit.homeStep >= HOME_STEPS) {
    strikeCastle(game, p, unit, UNIT_CLASSES[unit.cls].siegeDamage, 'via de Belegringsplaats');
    removeUnit(p, unit.id);
    return;
  }

  if (unit.zone === 'path') {
    for (const enemy of enemiesOf(game, p)) {
      const foe = enemy.units.find((u) => u.zone === 'path' && u.pos === unit.pos);
      if (foe) { resolveCombat(game, p, unit, enemy, foe); break; }
    }
  }
}

/* ---------------- action application (shared by handleAction + NPC AI) ---------------- */

function applyRoll(game, p, now) {
  if (p.rollPending) throw new Error('Je hebt al een worp die je moet gebruiken.');
  if (now < p.nextRollAt) throw new Error('De dobbelsteen is nog niet klaar.');
  p.lastRoll = rollDie();
  p.rollPending = true;
  p.nextRollAt = now + ROLL_COOLDOWN_MS;
  addLog(game, `${p.name} rolt een ${p.lastRoll}.`);
}

function applyDeploy(game, p, cls) {
  if (!p.rollPending || p.lastRoll !== 6) throw new Error('Je hebt geen 6 gerold.');
  const stats = UNIT_CLASSES[cls];
  if (!stats) throw new Error('Onbekende troepensoort.');
  if (p.gold < stats.cost) throw new Error('Onvoldoende goud.');
  const f = factionIndex(p.faction);
  const startIdx = startTileIndex(f);
  const blocked = p.units.some((u) => u.zone === 'path' && u.pos === startIdx);
  if (blocked) { p.rollPending = false; p.lastRoll = null; throw new Error('Je vertrekplaats is bezet door eigen troepen.'); }
  for (const enemy of enemiesOf(game, p)) {
    const foe = enemy.units.find((u) => u.zone === 'path' && u.pos === startIdx);
    if (foe) { removeUnit(enemy, foe.id); addLog(game, `${p.name} verovert de vertrekplaats van ${enemy.name}.`); }
  }
  p.gold -= stats.cost;
  spawnUnit(game, p, cls);
  p.rollPending = false;
  p.lastRoll = null;
  addLog(game, `${p.name} zet een ${cls === 'scout' ? 'verkenner' : cls === 'infantry' ? 'infanterie' : 'belegeringseenheid'} in.`);
}

function applyMove(game, p, unitId) {
  if (!p.rollPending) throw new Error('Rol eerst de dobbelsteen.');
  const steps = p.lastRoll;
  let unit = p.units.find((u) => u.id === unitId);
  if (!unit) unit = mostAdvancedUnit(p);
  p.rollPending = false;
  p.lastRoll = null;
  if (!unit) { addLog(game, `${p.name} heeft geen troepen om te verplaatsen.`); return; }
  moveUnit(game, p, unit, steps);
}

function mostAdvancedUnit(p) {
  const withProgress = p.units.map((u) => ({ u, progress: u.zone === 'home' ? PATH_LENGTH + u.homeStep : distanceTravelled(p, u) }));
  withProgress.sort((a, b) => b.progress - a.progress);
  return withProgress.length ? withProgress[0].u : null;
}

function distanceTravelled(p, unit) {
  const start = startTileIndex(factionIndex(p.faction));
  return (unit.pos - start + PATH_LENGTH) % PATH_LENGTH;
}

function applyRepair(game, p) {
  if (p.gold < REPAIR_COST) throw new Error('Onvoldoende goud.');
  if (p.castleHp >= CASTLE_MAX_HP) throw new Error('Het kasteel is al op volle sterkte.');
  p.gold -= REPAIR_COST;
  p.castleHp = Math.min(CASTLE_MAX_HP, p.castleHp + REPAIR_AMOUNT);
  addLog(game, `${p.name} herstelt het kasteel.`);
}

function applyUpgradeTurret(game, p) {
  if (p.gold < UPGRADE_COST) throw new Error('Onvoldoende goud.');
  if (p.turretTier >= MAX_TURRET_TIER) throw new Error('De toren is al op het hoogste niveau.');
  p.gold -= UPGRADE_COST;
  p.turretTier += 1;
  addLog(game, `${p.name} verbetert de verdedigingstoren naar niveau ${p.turretTier}.`);
}

function applySetTarget(game, p, faction) {
  if (!enemiesOf(game, p).some((e) => e.faction === faction)) throw new Error('Ongeldig doelwit.');
  p.targetFaction = faction;
}

function applyTileAction(game, p, unitId) {
  const unit = p.units.find((u) => u.id === unitId);
  if (!unit || unit.zone !== 'path') throw new Error('Selecteer een eenheid op het pad.');
  const now = Date.now();
  if (unit.tileCooldownUntil > now) throw new Error('Deze tegel is nog niet klaar voor gebruik.');
  const isDefence = FACTIONS.some((f, idx) => defenceTileIndex(idx) === unit.pos);
  const isAttack = FACTIONS.some((f, idx) => attackTileIndex(idx) === unit.pos);
  if (isDefence) {
    unit.shieldUntil = now + SHIELD_DURATION_MS;
    unit.tileCooldownUntil = now + SHIELD_DURATION_MS;
    addLog(game, `${p.name} activeert een schilddome op het slagveld.`);
  } else if (isAttack) {
    strikeCastle(game, p, unit, ATTACK_TILE_DAMAGE, 'met een belegeringsplatform');
    unit.tileCooldownUntil = now + ATTACK_TILE_COOLDOWN_MS;
  } else {
    throw new Error('Deze tegel heeft geen speciaal effect.');
  }
}

function handleAction(game, playerId, action, payload) {
  if (game.gameOver) throw new Error('Het beleg is afgelopen.');
  const p = game.players[playerId];
  if (!p) throw new Error('Onbekende speler.');
  if (p.eliminated) throw new Error('Je kasteel is gevallen — je kunt niet meer spelen.');
  const now = Date.now();

  if (action === 'roll') applyRoll(game, p, now);
  else if (action === 'deploy') applyDeploy(game, p, String((payload && payload.cls) || ''));
  else if (action === 'move') applyMove(game, p, Number((payload && payload.unitId) || 0));
  else if (action === 'repair') applyRepair(game, p);
  else if (action === 'upgradeTurret') applyUpgradeTurret(game, p);
  else if (action === 'setTarget') applySetTarget(game, p, String((payload && payload.faction) || ''));
  else if (action === 'tileAction') applyTileAction(game, p, Number((payload && payload.unitId) || 0));
  else throw new Error('Onbekende actie.');

  checkEliminations(game, now);
  checkWin(game, now);
}

/* ---------------- NPC AI ---------------- */

const PERSONALITY = {
  baraddur: 'aggressive',
  erebor: 'defensive',
  rivendell: 'hoarder',
  minastirith: 'balanced'
};

function npcAct(game, p, now) {
  const personality = PERSONALITY[p.faction] || 'balanced';
  let changed = false;

  if (personality === 'defensive') {
    if (p.castleHp < 800 && p.gold >= REPAIR_COST) { try { applyRepair(game, p); changed = true; } catch (e) { /* ignore */ } }
    else if (p.turretTier < MAX_TURRET_TIER && p.gold >= UPGRADE_COST) { try { applyUpgradeTurret(game, p); changed = true; } catch (e) { /* ignore */ } }
  } else if (personality === 'balanced' && p.castleHp < 600 && p.gold >= REPAIR_COST) {
    try { applyRepair(game, p); changed = true; } catch (e) { /* ignore */ }
  }

  if (!p.rollPending && now >= p.nextRollAt) { applyRoll(game, p, now); changed = true; }
  if (!p.rollPending) return changed;

  if (p.lastRoll === 6) {
    const affordable = UNIT_ORDER.filter((cls) => UNIT_CLASSES[cls].cost <= p.gold);
    let wantsDeploy = affordable.length > 0;
    if (personality === 'hoarder') wantsDeploy = p.gold >= UNIT_CLASSES.siege.cost;
    if (wantsDeploy) {
      let cls;
      if (personality === 'aggressive') cls = weightedPick([{ key: 'scout', w: 0.5 }, { key: 'infantry', w: 0.4 }, { key: 'siege', w: 0.1 }].filter((o) => affordable.includes(o.key))).key;
      else if (personality === 'hoarder') cls = 'siege';
      else if (personality === 'defensive') cls = affordable.includes('infantry') ? 'infantry' : pick(affordable);
      else cls = pick(affordable);
      try { applyDeploy(game, p, cls); changed = true; } catch (e) { /* fall through to move below */ }
    }
  }

  if (p.rollPending) {
    if (personality === 'hoarder') ensureTarget(game, p);
    const unit = mostAdvancedUnit(p);
    try { applyMove(game, p, unit ? unit.id : 0); changed = true; } catch (e) { /* ignore */ }
  }

  if (personality === 'hoarder' || personality === 'aggressive') ensureTarget(game, p);
  return changed;
}

/* ---------------- turrets ---------------- */

function fireTurret(game, p, now) {
  const config = TURRET_CONFIG[FACTIONS.find((f) => f.key === p.faction).turret];
  if (now < p.turretNextFireAt) return false;
  p.turretNextFireAt = now + config.cooldownMs;
  const corner = cornerIndex(factionIndex(p.faction));
  const damage = config.damage * TURRET_TIER_MULT[p.turretTier - 1];

  const targets = [];
  for (const enemy of enemiesOf(game, p)) {
    for (const unit of enemy.units) {
      if (unit.zone !== 'path') continue;
      if (cyclicDistance(unit.pos, corner) > TURRET_RANGE) continue;
      targets.push({ enemy, unit, dist: cyclicDistance(unit.pos, corner) });
    }
  }
  if (!targets.length) return false;

  let fired = false;
  const applyDamage = (t) => {
    const shieldMult = t.unit.shieldUntil > now ? 0.6 : 1;
    t.unit.hp -= damage * shieldMult;
    fired = true;
    if (t.unit.hp <= 0) {
      removeUnit(t.enemy, t.unit.id);
      addLog(game, `De toren van ${p.name} vernietigt een eenheid van ${t.enemy.name}.`);
    }
  };

  if (config.targets === 'aoe') {
    targets.forEach(applyDamage);
  } else if (config.targets === 1) {
    targets.sort((a, b) => a.dist - b.dist || b.unit.hp - a.unit.hp);
    applyDamage(targets[0]);
  } else {
    targets.sort((a, b) => a.dist - b.dist);
    targets.slice(0, config.targets).forEach(applyDamage);
  }
  return fired;
}

/* ---------------- eliminations / win / income ---------------- */

function checkEliminations(game, now) {
  let changed = false;
  game.order.forEach((id) => {
    const p = game.players[id];
    if (!p.eliminated && p.castleHp <= 0) {
      p.eliminated = true;
      p.eliminatedAt = now;
      p.units = [];
      addLog(game, `Het kasteel van ${p.name} valt!`);
      changed = true;
    }
  });
  return changed;
}

function endGame(game, winnerId) {
  game.gameOver = true;
  game.winnerId = winnerId;
  game.resultText = winnerId
    ? `${game.players[winnerId].name} verslaat de Vier Rijken.`
    : 'Het beleg eindigt zonder overwinnaar.';
}

function checkWin(game, now) {
  if (game.gameOver) return false;
  const active = activePlayers(game);
  if (active.length <= 1) {
    endGame(game, active.length === 1 ? active[0].id : null);
    return true;
  }
  if (now - game.startedAt >= MATCH_TIME_CAP_MS) {
    const sorted = active.slice().sort((a, b) => b.castleHp - a.castleHp);
    endGame(game, sorted[0].id);
    return true;
  }
  return false;
}

/* ---------------- tick (continuous simulation) ---------------- */

function tick(game, now = Date.now()) {
  if (game.gameOver) return false;
  let changed = false;

  if (now - game.lastGoldAt >= GOLD_TICK_MS) {
    activePlayers(game).forEach((p) => { p.gold += GOLD_PER_SEC; });
    game.lastGoldAt = now;
    changed = true;
  }

  activePlayers(game).forEach((p) => { if (fireTurret(game, p, now)) changed = true; });

  activePlayers(game).forEach((p) => {
    if (!p.isNpc) return;
    if (now < (p.nextThinkAt || 0)) return;
    p.nextThinkAt = now + NPC_THINK_MS;
    if (npcAct(game, p, now)) changed = true;
  });

  if (checkEliminations(game, now)) changed = true;
  if (checkWin(game, now)) changed = true;

  return changed;
}

/* ---------------- serialize (per-requester view) ---------------- */

function serialize(game, requesterId, connected) {
  const players = game.order.map((id) => {
    const p = game.players[id];
    return {
      id: p.id,
      name: p.name,
      isNpc: p.isNpc,
      faction: p.faction,
      isYou: id === requesterId,
      gold: p.gold,
      castleHp: p.castleHp,
      castleMaxHp: CASTLE_MAX_HP,
      turretTier: p.turretTier,
      targetFaction: p.targetFaction,
      lastRoll: p.lastRoll,
      rollPending: p.rollPending,
      nextRollAt: p.nextRollAt,
      eliminated: p.eliminated,
      connected: p.isNpc || (connected ? Boolean(connected.get(id)) : true),
      units: p.units.map((u) => ({
        id: u.id, cls: u.cls, hp: Math.round(u.hp), maxHp: u.maxHp,
        zone: u.zone, pos: u.pos, homeStep: u.homeStep, shielded: u.shieldUntil > Date.now()
      }))
    };
  });

  return {
    kind: 'lutro',
    gameOver: game.gameOver,
    resultText: game.resultText,
    winnerId: game.winnerId,
    elapsedMs: Date.now() - game.startedAt,
    players,
    log: game.log.slice(-20)
  };
}

/* ---------------- end-of-match stats ---------------- */

function results(game, durationMs) {
  const ranked = game.order.slice().sort((a, b) => {
    const pa = game.players[a], pb = game.players[b];
    if (!!pa.eliminated !== !!pb.eliminated) return pa.eliminated ? 1 : -1;
    if (pa.eliminated && pb.eliminated) return (pb.eliminatedAt || 0) - (pa.eliminatedAt || 0);
    return playerScore(pb) - playerScore(pa);
  });

  return ranked.map((id, index) => {
    const p = game.players[id];
    return {
      playerId: id,
      placement: index + 1,
      score: Math.round(playerScore(p)),
      won: game.winnerId === id,
      outcome: game.winnerId === id ? 'Wint' : (p.eliminated ? 'Kasteel gevallen' : 'Overleeft'),
      durationMs
    };
  });
}

module.exports = {
  createGame, handleAction, serialize, tick, results,
  // exported for tests
  FACTIONS, UNIT_CLASSES, PATH_LENGTH, EDGE_LENGTH, HOME_STEPS, CASTLE_MAX_HP,
  cornerIndex, startTileIndex, defenceTileIndex, attackTileIndex, entranceTileIndex, cyclicDistance
};
