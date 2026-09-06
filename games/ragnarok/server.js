'use strict';

/**
 * Ragnarok — server-authoritative logic.
 *
 * Follows the Pluto plugin server contract (see games/README.md):
 *   createGame(roomPlayers)
 *   handleAction(game, playerId, action, payload)
 *   serialize(game, requesterId, connected)
 *   tick(game, now)
 *   results(game, durationMs)
 *
 * Design note (see games/ragnarok/DESIGN.md): the original design used
 * discrete 8-round timers with a secret-simultaneous reveal. This build is
 * inspired by Age of Civilization / Age of Civilizations-style map painters
 * instead: there are no rounds and no per-action clock. Erts and IJzer trickle
 * in continuously via tick(), every player (human or NPC) may act the moment
 * they can afford it, and actions apply and broadcast instantly. The god
 * events and finale escalation from the design doc survive, just driven by
 * elapsed real time instead of a round counter.
 */

const INCOME_INTERVAL_MS = 4000;
const NPC_THINK_MIN_MS = 3200;
const NPC_THINK_JITTER_MS = 2600;
const JUDGMENT_INTERVAL_MS = 45000;
const FINALE_JUDGMENT_INTERVAL_MS = 18000;
const FINALE_AFTER_MS = 5 * 60 * 1000;
const SAFETY_CAP_MS = 12 * 60 * 1000;

const STR = { arbeider: 1, krijger: 3, graaf: 2, boot: 2 };
const RANGE = { arbeider: 1, krijger: 2, graaf: 1, boot: 2 };
const EVENTS = [
  { key: 'muspel', w: 3, name: 'Vuur van Muspelheim' },
  { key: 'niflheim', w: 3, name: 'Winter van Niflheim' },
  { key: 'giants', w: 3, name: 'Hebzucht der Reuzen' },
  { key: 'thor', w: 2, name: 'Woede van Thor' },
  { key: 'freya', w: 1, name: 'Zegen van Freya' }
];

/* ---------------- hex geometry ---------------- */

function hkey(q, r) { return q + ',' + r; }
function hexDist(a, b) {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
function neighborKeys(t) { return DIRS.map(([dq, dr]) => hkey(t.q + dq, t.r + dr)); }
function hexPixel(q, r) { return { x: 1.5 * q, y: (Math.sqrt(3) / 2) * q + Math.sqrt(3) * r }; }

function buildMap(R) {
  const tiles = new Map();
  for (let q = -R; q <= R; q += 1) {
    const r1 = Math.max(-R, -q - R), r2 = Math.min(R, -q + R);
    for (let r = r1; r <= r2; r += 1) {
      const key = hkey(q, r);
      tiles.set(key, { q, r, key, owner: null, pawn: null, isHome: false });
    }
  }
  return tiles;
}

function buildRivers(R, tiles) {
  const rivers = [];
  const count = R <= 4 ? 2 : 3;
  const ring = [];
  tiles.forEach((t) => { if (hexDist(t, { q: 0, r: 0 }) === R) ring.push(t); });
  if (!ring.length) return rivers;

  for (let i = 0; i < count; i += 1) {
    const start = ring[Math.floor((i + Math.random()) * ring.length / count) % ring.length];
    if (!start) continue;
    const path = [start];
    const visited = new Set([start.key]);
    let lastDir = Math.floor(Math.random() * 6);
    const steps = R * 2 + Math.floor(Math.random() * R) + 2;
    let current = start;
    for (let s = 0; s < steps; s += 1) {
      const candidates = [];
      for (let d = 0; d < 6; d += 1) {
        const nk = hkey(current.q + DIRS[d][0], current.r + DIRS[d][1]);
        const nt = tiles.get(nk);
        if (nt && !visited.has(nk)) {
          const dirDiff = Math.min(Math.abs(d - lastDir), 6 - Math.abs(d - lastDir));
          candidates.push({ t: nt, d, w: (3 - dirDiff) * (3 - dirDiff) + 0.3 });
        }
      }
      if (!candidates.length) break;
      const total = candidates.reduce((sum, c) => sum + c.w, 0);
      let roll = Math.random() * total, chosen = candidates[0];
      for (const c of candidates) { roll -= c.w; if (roll <= 0) { chosen = c; break; } }
      current = chosen.t; lastDir = chosen.d;
      path.push(current); visited.add(current.key);
    }
    if (path.length >= 4) rivers.push(path);
  }
  return rivers;
}

/* ---------------- helpers ---------------- */

function rollDie() { return 1 + Math.floor(Math.random() * 6); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function weightedPick(list) {
  const total = list.reduce((sum, x) => sum + x.w, 0);
  let roll = Math.random() * total;
  for (const item of list) { roll -= item.w; if (roll <= 0) return item; }
  return list[list.length - 1];
}

function activePlayers(game) { return game.order.map((id) => game.players[id]).filter((p) => !p.eliminated); }
function playerScore(p) { return p.tiles.size * 3 + p.resources.erts + p.resources.ijzer + p.resources.gunst * 2; }
function ownedTiles(game, p) { return [...p.tiles].map((k) => game.tiles.get(k)); }
function homeTileOf(game, p) {
  for (const k of p.tiles) { const t = game.tiles.get(k); if (t.isHome) return t; }
  return null;
}

function costExpand(p) { return 3 + Math.floor(Math.max(0, p.tiles.size - 2) / 3); }
const MAX_HOME_LEVEL = 6;
function costHome(p) { return 4 + p.homeLevel * p.homeLevel * 2; }
function costUpgrade(pawn) { return pawn === 'arbeider' ? { ijzer: 3 } : { ijzer: 5 }; }
const OFFER_COST = { erts: 2, ijzer: 2 };

function canPay(p, cost) { return Object.keys(cost).every((k) => (p.resources[k] || 0) >= cost[k]); }
function pay(p, cost) { Object.keys(cost).forEach((k) => { p.resources[k] -= cost[k]; }); }

function expandTargets(game, p) {
  const res = new Set();
  ownedTiles(game, p).forEach((t) => {
    neighborKeys(t).forEach((k) => { const nt = game.tiles.get(k); if (nt && nt.owner === null) res.add(k); });
  });
  return res;
}
function attackTargets(game, p) {
  const res = new Set();
  ownedTiles(game, p).forEach((t) => {
    if (!t.pawn) return;
    const rng = RANGE[t.pawn] || 1;
    game.tiles.forEach((ot) => { if (ot.owner !== null && ot.owner !== p.id && hexDist(t, ot) <= rng) res.add(ot.key); });
  });
  return res;
}
function upgradeTargets(game, p) {
  const res = new Set();
  ownedTiles(game, p).forEach((t) => { if (t.pawn === 'arbeider' || t.pawn === 'krijger') res.add(t.key); });
  return res;
}

/* ---------------- lifecycle ---------------- */

function createGame(roomPlayers) {
  const R = 3 + Math.ceil(roomPlayers.length / 2);
  const tiles = buildMap(R);
  const rivers = buildRivers(R, tiles);

  const ring = [];
  tiles.forEach((t) => { if (hexDist(t, { q: 0, r: 0 }) === R) ring.push(t); });
  ring.sort((a, b) => {
    const pa = hexPixel(a.q, a.r), pb = hexPixel(b.q, b.r);
    return Math.atan2(pa.y, pa.x) - Math.atan2(pb.y, pb.x);
  });

  const players = {};
  const order = roomPlayers.map((rp) => rp.id);
  roomPlayers.forEach((rp, i) => {
    players[rp.id] = {
      id: rp.id,
      name: rp.name,
      isNpc: Boolean(rp.isNpc),
      colorIndex: i,
      tiles: new Set(),
      resources: { erts: 4, ijzer: 2, gunst: 0 },
      homeLevel: 1,
      protectedNext: false,
      eliminated: false,
      eliminatedAt: null,
      nextThinkAt: 0
    };
  });

  order.forEach((id, i) => {
    const idx = Math.floor(i * ring.length / order.length);
    const home = ring[idx];
    home.owner = id; home.isHome = true;
    players[id].tiles.add(home.key);
    for (const k of neighborKeys(home)) {
      const nt = tiles.get(k);
      if (nt && nt.owner === null) { nt.owner = id; nt.pawn = 'arbeider'; players[id].tiles.add(nt.key); break; }
    }
  });

  const now = Date.now();
  return {
    gameKey: 'ragnarok',
    gameOver: false,
    resultText: '',
    winnerId: null,
    R, tiles, rivers, players, order,
    startedAt: now,
    lastIncomeAt: now,
    lastJudgmentAt: now,
    judgmentIntervalMs: JUDGMENT_INTERVAL_MS,
    finale: false,
    finaleStartedAt: null,
    log: []
  };
}

function addLog(game, text) {
  game.log.push(text);
  if (game.log.length > 200) game.log.splice(0, game.log.length - 200);
}

/* ---------------- action application (shared by handleAction + NPC AI) ---------------- */

function applyExpand(game, p, payload) {
  if (payload && payload.home) {
    const home = homeTileOf(game, p);
    if (!home) throw new Error('Je hebt geen thuisbasis meer.');
    if (p.homeLevel >= MAX_HOME_LEVEL) throw new Error('Je thuisbasis heeft het hoogste niveau al bereikt.');
    const cost = costHome(p);
    if (!canPay(p, { erts: cost })) throw new Error('Te weinig erts.');
    pay(p, { erts: cost });
    p.homeLevel += 1;
    addLog(game, `${p.name} versterkt de thuisbasis naar niveau ${p.homeLevel}.`);
    return;
  }
  const key = String((payload && payload.targetKey) || '');
  const t = game.tiles.get(key);
  if (!t || t.owner !== null) throw new Error('Die tegel is niet meer vrij.');
  if (!expandTargets(game, p).has(key)) throw new Error('Die tegel ligt niet binnen bereik.');
  const cost = costExpand(p);
  if (!canPay(p, { erts: cost })) throw new Error('Te weinig erts.');
  pay(p, { erts: cost });
  t.owner = p.id; t.pawn = 'arbeider';
  p.tiles.add(key);
  addLog(game, `${p.name} claimt nieuw land.`);
}

function applyUpgrade(game, p, payload) {
  const key = String((payload && payload.targetKey) || '');
  const t = game.tiles.get(key);
  if (!t || t.owner !== p.id || !t.pawn) throw new Error('Ongeldig doel om te upgraden.');
  const cost = costUpgrade(t.pawn);
  if (!canPay(p, cost)) throw new Error('Te weinig ijzer.');
  if (t.pawn === 'arbeider') {
    pay(p, cost); t.pawn = 'krijger';
    addLog(game, `${p.name} traint een krijger.`);
  } else if (t.pawn === 'krijger') {
    const kind = payload && payload.choice === 'boot' ? 'boot' : 'graaf';
    pay(p, cost); t.pawn = kind;
    addLog(game, `${p.name} laat een krijger opklimmen tot ${kind}.`);
  } else {
    throw new Error('Dit is al het hoogste niveau.');
  }
}

function applyAttack(game, p, payload) {
  const key = String((payload && payload.targetKey) || '');
  const at = game.tiles.get(key);
  if (!at || at.owner === null || at.owner === p.id) throw new Error('Ongeldig doelwit.');
  if (!attackTargets(game, p).has(key)) throw new Error('Dat doelwit ligt niet binnen bereik.');

  const sources = ownedTiles(game, p).filter((t) => t.pawn && hexDist(t, at) <= (RANGE[t.pawn] || 1));
  if (!sources.length) throw new Error('Geen pion binnen bereik.');
  sources.sort((a, b) => STR[b.pawn] - STR[a.pawn]);
  const src = sources[0];

  const defender = game.players[at.owner];
  const atkRoll = STR[src.pawn] + rollDie();
  const defBonus = (at.pawn === 'graaf' ? 2 : 0) + (at.isHome ? 2 : 0);
  const defRoll = STR[at.pawn || 'arbeider'] + defBonus + rollDie();

  if (atkRoll > defRoll) {
    defender.tiles.delete(at.key);
    at.owner = p.id; at.pawn = 'arbeider'; at.isHome = false;
    p.tiles.add(at.key);
    addLog(game, `${p.name} verslaat ${defender.name} en verovert een tegel! (${atkRoll} vs ${defRoll})`);
  } else {
    addLog(game, `${p.name} valt ${defender.name} aan, maar wordt teruggeslagen. (${atkRoll} vs ${defRoll})`);
  }
}

function applyOffer(game, p, payload) {
  if (!canPay(p, OFFER_COST)) throw new Error('Te weinig voor een offer.');
  const choice = payload && payload.choice === 'gamble' ? 'gamble' : 'protect';
  pay(p, OFFER_COST);
  p.resources.gunst += 2;
  if (choice === 'protect') {
    p.protectedNext = true;
    addLog(game, `${p.name} offert voor bescherming tegen het volgende oordeel.`);
  } else if (Math.random() < 0.5) {
    const bonus = pick(['erts', 'ijzer']);
    p.resources[bonus] += 3;
    addLog(game, `${p.name} gokt met een offer — de goden belonen met ${bonus}.`);
  } else {
    addLog(game, `${p.name} gokt met een offer, maar de goden blijven stil.`);
  }
}

function handleAction(game, playerId, action, payload) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  const p = game.players[playerId];
  if (!p) throw new Error('Onbekende speler.');
  if (p.eliminated) throw new Error('Je bent uitgeschakeld en kunt niet meer spelen.');

  if (action === 'uitbreiden') applyExpand(game, p, payload);
  else if (action === 'upgraden') applyUpgrade(game, p, payload);
  else if (action === 'aanvallen') applyAttack(game, p, payload);
  else if (action === 'offeren') applyOffer(game, p, payload);
  else throw new Error('Onbekende actie.');

  checkEliminations(game, Date.now());
  checkWin(game, Date.now());
}

/* ---------------- NPC AI ---------------- */

function npcDecide(game, p) {
  const opts = [];
  if (canPay(p, { erts: costExpand(p) })) opts.push('uitbreiden');
  const up = upgradeTargets(game, p);
  if ([...up].some((k) => canPay(p, costUpgrade(game.tiles.get(k).pawn)))) opts.push('upgraden');
  if (attackTargets(game, p).size > 0) opts.push('aanvallen');
  if (canPay(p, OFFER_COST)) opts.push('offeren');
  if (!opts.length) return null;

  const weights = { uitbreiden: 0.32, upgraden: 0.22, aanvallen: 0.34, offeren: 0.12 };
  const choice = weightedPick(opts.map((o) => ({ key: o, w: weights[o] }))).key;

  if (choice === 'uitbreiden') {
    const home = homeTileOf(game, p);
    if (home && p.homeLevel < MAX_HOME_LEVEL && Math.random() < 0.18 && canPay(p, { erts: costHome(p) })) return { action: 'uitbreiden', payload: { home: true } };
    const targets = [...expandTargets(game, p)];
    if (!targets.length) return null;
    return { action: 'uitbreiden', payload: { targetKey: pick(targets) } };
  }
  if (choice === 'upgraden') {
    const cand = [...up].filter((k) => canPay(p, costUpgrade(game.tiles.get(k).pawn)));
    if (!cand.length) return null;
    const key = pick(cand);
    const tile = game.tiles.get(key);
    if (tile.pawn === 'krijger') return { action: 'upgraden', payload: { targetKey: key, choice: Math.random() < 0.5 ? 'graaf' : 'boot' } };
    return { action: 'upgraden', payload: { targetKey: key } };
  }
  if (choice === 'aanvallen') {
    const targets = [...attackTargets(game, p)].map((k) => game.tiles.get(k));
    if (!targets.length) return null;
    const defenseValue = (t) => (STR[t.pawn || 'arbeider'] || 1) + (t.pawn === 'graaf' ? 2 : 0) + (t.isHome ? 2 : 0);
    targets.sort((a, b) => defenseValue(a) - defenseValue(b));
    const weak = targets.slice(0, Math.max(1, Math.ceil(targets.length / 2)));
    return { action: 'aanvallen', payload: { targetKey: pick(weak).key } };
  }
  if (choice === 'offeren') return { action: 'offeren', payload: { choice: p.protectedNext ? 'gamble' : (Math.random() < 0.5 ? 'protect' : 'gamble') } };
  return null;
}

function npcAct(game, p) {
  const decision = npcDecide(game, p);
  if (!decision) return false;
  try {
    if (decision.action === 'uitbreiden') applyExpand(game, p, decision.payload);
    else if (decision.action === 'upgraden') applyUpgrade(game, p, decision.payload);
    else if (decision.action === 'aanvallen') applyAttack(game, p, decision.payload);
    else if (decision.action === 'offeren') applyOffer(game, p, decision.payload);
    else return false;
  } catch (error) {
    return false;
  }
  return true;
}

/* ---------------- god judgment ---------------- */

function applyEvent(game, ev, victim, sev) {
  if (ev.key === 'muspel') {
    const loseable = ownedTiles(game, victim).filter((t) => !t.isHome);
    const n = Math.min(sev, loseable.length);
    if (!n) { addLog(game, `${ev.name} zoekt ${victim.name}, maar vindt enkel de thuisbasis.`); return; }
    shuffle(loseable).slice(0, n).forEach((t) => { victim.tiles.delete(t.key); t.owner = null; t.pawn = null; });
    addLog(game, `${ev.name} verbrandt ${n} tegel(en) van ${victim.name}.`);
    return;
  }
  if (ev.key === 'niflheim') {
    const lost = Math.min(victim.resources.ijzer, Math.ceil(victim.resources.ijzer * (sev > 1 ? 0.75 : 0.5)));
    victim.resources.ijzer -= lost;
    addLog(game, `${ev.name} bevriest ${lost} ijzer van ${victim.name}.`);
    return;
  }
  if (ev.key === 'giants') {
    const lost = Math.min(victim.resources.erts, Math.ceil(victim.resources.erts * (sev > 1 ? 0.75 : 0.5)));
    victim.resources.erts -= lost;
    addLog(game, `${ev.name} rooft ${lost} erts van ${victim.name}.`);
    return;
  }
  if (ev.key === 'thor') {
    const warriors = ownedTiles(game, victim).filter((t) => t.pawn === 'krijger');
    if (warriors.length) {
      pick(warriors).pawn = 'arbeider';
      addLog(game, `${ev.name} verjaagt een krijger van ${victim.name} terug tot arbeider.`);
    } else {
      const loss = Math.min(victim.resources.ijzer, 1 + (sev > 1 ? 1 : 0));
      victim.resources.ijzer -= loss;
      addLog(game, `${ev.name} treft ${victim.name} voor ${loss} ijzer.`);
    }
    return;
  }
  if (ev.key === 'freya') {
    victim.resources.gunst += 2;
    addLog(game, `${ev.name} zegent ${victim.name} met 2 gunst der goden.`);
  }
}

function runJudgment(game, now) {
  const active = activePlayers(game);
  if (!active.length) return;
  const finaleMs = game.finale ? now - game.finaleStartedAt : 0;
  const eventCount = game.finale ? Math.min(1 + Math.floor(finaleMs / 120000), 3) : 1;
  const sev = game.finale ? Math.min(1 + Math.floor(finaleMs / 90000), 3) : 1;
  const hit = {};

  for (let i = 0; i < eventCount; i += 1) {
    const pool = active.filter((p) => !hit[p.id]);
    if (!pool.length) break;
    pool.sort((a, b) => playerScore(a) - playerScore(b));
    let target = null;
    for (const cand of pool) {
      if (cand.protectedNext) {
        cand.protectedNext = false;
        hit[cand.id] = true;
        addLog(game, `${cand.name} werd beschermd — het oordeel gleed af.`);
        continue;
      }
      target = cand; break;
    }
    if (!target) continue;
    hit[target.id] = true;
    applyEvent(game, weightedPick(EVENTS), target, sev);
  }
}

/* ---------------- eliminations / win / income ---------------- */

function checkEliminations(game, now) {
  let changed = false;
  game.order.forEach((id) => {
    const p = game.players[id];
    if (!p.eliminated && p.tiles.size === 0) {
      p.eliminated = true;
      p.eliminatedAt = now;
      addLog(game, `${p.name} verliest de laatste tegel en wordt toeschouwer.`);
      changed = true;
    }
  });
  return changed;
}

function endGame(game, winnerId) {
  game.gameOver = true;
  game.winnerId = winnerId;
  game.resultText = winnerId
    ? `${game.players[winnerId].name} wint Ragnarok.`
    : 'Ragnarok eindigt zonder overlevenden.';
}

function checkWin(game, now) {
  if (game.gameOver) return false;
  const active = activePlayers(game);
  if (active.length <= 1) {
    endGame(game, active.length === 1 ? active[0].id : null);
    return true;
  }
  if (now - game.startedAt >= SAFETY_CAP_MS) {
    const sorted = active.slice().sort((a, b) => playerScore(b) - playerScore(a));
    endGame(game, sorted[0].id);
    return true;
  }
  return false;
}

function grantIncome(game) {
  activePlayers(game).forEach((p) => {
    const arbeiders = ownedTiles(game, p).filter((t) => t.pawn === 'arbeider').length;
    const home = homeTileOf(game, p);
    const homeBonus = home ? p.homeLevel : 0;
    p.resources.erts += arbeiders + homeBonus;
    p.resources.ijzer += arbeiders;
  });
}

/* ---------------- tick (continuous simulation) ---------------- */

function tick(game, now) {
  if (game.gameOver) return false;
  let changed = false;

  if (now - game.lastIncomeAt >= INCOME_INTERVAL_MS) {
    grantIncome(game);
    game.lastIncomeAt = now;
    changed = true;
  }

  activePlayers(game).forEach((p) => {
    if (!p.isNpc) return;
    if (now < (p.nextThinkAt || 0)) return;
    p.nextThinkAt = now + NPC_THINK_MIN_MS + Math.random() * NPC_THINK_JITTER_MS;
    if (npcAct(game, p)) changed = true;
  });

  if (!game.finale && now - game.startedAt >= FINALE_AFTER_MS) {
    game.finale = true;
    game.finaleStartedAt = now;
    game.judgmentIntervalMs = FINALE_JUDGMENT_INTERVAL_MS;
    addLog(game, 'De eindstrijd begint — het oordeel der goden wordt heftiger en frequenter.');
    changed = true;
  }

  if (now - game.lastJudgmentAt >= game.judgmentIntervalMs) {
    runJudgment(game, now);
    game.lastJudgmentAt = now;
    changed = true;
  }

  if (checkEliminations(game, now)) changed = true;
  if (checkWin(game, now)) changed = true;

  return changed;
}

/* ---------------- serialize (per-requester view) ---------------- */

function serialize(game, requesterId, connected) {
  const tiles = [];
  game.tiles.forEach((t) => tiles.push({ q: t.q, r: t.r, owner: t.owner, pawn: t.pawn, isHome: t.isHome }));

  const rivers = (game.rivers || []).map((path) => path.map((t) => ({ q: t.q, r: t.r })));

  const players = game.order.map((id) => {
    const p = game.players[id];
    const isYou = id === requesterId;
    return {
      id: p.id,
      name: p.name,
      isNpc: p.isNpc,
      color: p.colorIndex,
      tiles: p.tiles.size,
      score: playerScore(p),
      homeLevel: p.homeLevel,
      eliminated: p.eliminated,
      connected: p.isNpc || (connected ? Boolean(connected.get(id)) : true),
      isYou,
      resources: isYou ? { ...p.resources } : undefined,
      protectedNext: isYou ? p.protectedNext : undefined
    };
  });

  return {
    kind: 'ragnarok',
    gameOver: game.gameOver,
    resultText: game.resultText,
    winnerId: game.winnerId,
    finale: game.finale,
    elapsedMs: Date.now() - game.startedAt,
    tiles,
    rivers,
    players,
    order: game.order,
    log: game.log.slice(-16)
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
      score: playerScore(p),
      won: game.winnerId === id,
      outcome: game.winnerId === id ? 'Wint' : (p.eliminated ? 'Uitgeschakeld' : 'Overleeft'),
      durationMs
    };
  });
}

module.exports = {
  createGame, handleAction, serialize, tick, results,
  // exported for tests / internal reuse
  hexDist, playerScore, costExpand, costHome, costUpgrade
};
