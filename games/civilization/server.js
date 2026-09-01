'use strict';

/**
 * Age of Civilization — server-authoritative logic (v6).
 *
 * Follows the Pluto plugin server contract (see games/README.md):
 *   createGame(roomPlayers)
 *   handleAction(game, playerId, action, payload)
 *   serialize(game, requesterId, connected)
 *   tick(game, now)          [optional]
 *   results(game, durationMs) [optional]
 *
 * Nothing here trusts the client: hands, gold, grid state, and phase
 * transitions all live only in `game` and are only ever mutated here.
 *
 * v6 additions on top of v5 (fixed civic buildings, 6-slot flexible grid):
 *   - 2 to 7 players. Before Age 1, players pick a unique Leader in seat
 *     order (a 'picking' phase ahead of 'draft'); each Leader grants a
 *     fixed passive bonus.
 *   - Combat is a clockwise ring: each player's Attack hits the next
 *     player's Defence (game.order is the seating), not just a single
 *     mutual opponent. A wave can now eliminate some players while others
 *     fight on; the game only ends when at most one player is left alive,
 *     or all 21 turns elapse.
 *   - Civic buildings (Science/Religion/Culture) have no Age ceiling
 *     any more — always upgradable — but the 3rd/6th upgrade (the one
 *     that fires the stacking event) costs 2x the normal civic upgrade
 *     price instead of the same price as steps 1 and 2.
 */

const TOTAL_AGES = 7;
const TURNS_PER_AGE = 3;
const TOTAL_TURNS = TOTAL_AGES * TURNS_PER_AGE;
const TURN_TIME_MS = 40000;  // soft deadline per turn for drafting/building
const WAVE_DISPLAY_MS = 4000; // how long the wave-result screen stays up before auto-advancing
const START_GOLD = 4;
const START_HP = 100;
const GRID_SIZE = 6;
const UPGRADE_COST_MULTIPLIER = 1.75;
const CIVIC_BASE_COST_MULTIPLIER = 2.5;
const EVENT_STEP_COST_MULTIPLIER = 2;
const GANDHI_DAMAGE_CAP = 25;

const CATEGORIES = ['attack', 'defence', 'economy'];
const CIVIC_CATEGORIES = ['science', 'religion', 'culture'];

const ERAS = [
  { name: 'Cavemen to Egyptians', wonder: 'Great Pyramid' },
  { name: 'Greeks to Romans', wonder: 'Colosseum' },
  { name: 'Swords to Muskets', wonder: 'Notre Dame' },
  { name: 'Chinese to Napoleon', wonder: 'Great Wall' },
  { name: 'World War I & II', wonder: 'Hoover Dam' },
  { name: '1990 to 2030', wonder: 'The Internet' },
  { name: 'Future to Futuristic', wonder: 'Dyson Sphere' }
];

// One canonical name per category per Age. Building fresh and re-skinning on
// upgrade both use this same track, so "Sharpened Spear" built in Age 1
// becomes "Drone Swarm Offensive" by Age 7 purely through upgrades.
const NAMES = {
  attack: ['Sharpened Spear', 'Phalanx Legion', 'Musketeer Vanguard', 'Grand Army Corps', 'Armored Blitz Division', 'Stealth Strike Wing', 'Drone Swarm Offensive'],
  defence: ['Stone Palisade', 'City Rampart', 'Castle Bastion', 'Great Wall Garrison', 'Trench Fortress', 'Cyber Defense Shield', 'Orbital Defense Platform'],
  economy: ['Grain Store', 'Trade Galley', 'Banking House', 'Continental Bank', 'Factory Assembly Line', 'Stock Exchange Floor', 'Quantum Bank']
};

// Fixed civic buildings: one each, present from the start, never rebuilt.
const CIVIC_NAMES = { science: 'Observatory', religion: 'Grand Temple', culture: 'Academy' };

// Permanent multiplier split applied to the player's Attack/Defence/Income
// every time a civic building's upgrade count hits a multiple of 3.
const CIVIC_SPLITS = {
  science: { attack: 0.30, income: 0.20, defence: 0.10 },
  culture: { income: 0.30, defence: 0.20, attack: 0.10 },
  religion: { income: 0.30, defence: 0.20, attack: 0.10 }
};

// Leaders: picked once per player, in seat order, before Age 1 begins.
// NOTE on Cleopatra and Gandhi: the original brief for these two referenced
// Victory Points, which this ruleset removed entirely a few iterations ago
// (see CHANGELOG v1.7.0). There is no VP left to heal from or generate, so
// both bonuses below are a reinterpretation onto the current mechanics
// rather than a literal implementation — flagged here and in the release
// notes so they're easy to adjust.
const LEADERS = [
  { key: 'cleopatra', name: 'Cleopatra', attribute: 'Nemes-hoofdtooi', bonus: '+5 start Goud. Religie en Cultuur beginnen al met hun eerste upgrade.' },
  { key: 'alexander', name: 'Alexander de Grote', attribute: 'Korinthische helm', bonus: 'Attack-gebouwen krijgen +2 Attack.' },
  { key: 'einstein', name: 'Einstein', attribute: 'Wilde haardos', bonus: 'Je Observatorium geeft een blijvende +2 Defence.' },
  { key: 'gandhi', name: 'Gandhi', attribute: 'Ronde bril', bonus: `Je Stad kan nooit meer dan ${GANDHI_DAMAGE_CAP} schade oplopen per aanvalsgolf.` },
  { key: 'bismarck', name: 'Bismarck', attribute: 'Pickelhaube', bonus: 'Upgrades kosten 25% minder goud.' },
  { key: 'lincoln', name: 'Lincoln', attribute: 'Hoge hoed', bonus: 'Je Stad geneest automatisch +10 HP als ze na een aanvalsgolf onder 30 zakt.' },
  { key: 'achilles', name: 'Achilles', attribute: 'Pluimhelm', bonus: '+50% Attack, maar je loopt ook 50% meer schade op.' }
];

function makeCard(type, age, name) {
  switch (type) {
    case 'attack': return { type, name, cost: age + 1, attack: age + 3, defence: 0, income: 0 };
    case 'defence': return { type, name, cost: age + 1, attack: 0, defence: age + 2, income: 0 };
    case 'economy': return { type, name, cost: age, attack: 0, defence: 0, income: age + 1 };
    case 'wonder': return { type, name, cost: age * 2, attack: age * 2, defence: age * 2 - 1, income: age };
    default: throw new Error('unknown card type: ' + type);
  }
}

function cardDesc(c) {
  if (c.type === 'attack') return `+${c.attack} Attack.`;
  if (c.type === 'defence') return `+${c.defence} Defence.`;
  if (c.type === 'economy') return `+${c.income} Goud per beurt.`;
  if (c.type === 'wonder') return `Wonder: +${c.attack} Attack, +${c.defence} Defence, +${c.income} Goud per beurt. Eenmalig.`;
  return '';
}

// Effective stat for a flexible tile: base, +25% of base per level beyond 1.
function tileStat(base, level) {
  return base > 0 ? Math.round(base * (1 + 0.25 * (level - 1))) : 0;
}

function withLeaderCostDiscount(player, cost) {
  return player.leaderKey === 'bismarck' ? Math.round(cost * 0.75) : cost;
}

function flexibleUpgradeCost(age, type, player) {
  return withLeaderCostDiscount(player, Math.round(makeCard(type, age, '').cost * UPGRADE_COST_MULTIPLIER));
}

// upcomingStep is the step number this purchase would advance the civic
// building to (i.e. current upgradeCount + 1). Steps that are a multiple of
// 3 fire the event, and cost EVENT_STEP_COST_MULTIPLIER times as much.
function civicUpgradeCost(age, upcomingStep, player) {
  const base = Math.round((age + 1) * CIVIC_BASE_COST_MULTIPLIER);
  const cost = upcomingStep % 3 === 0 ? base * EVENT_STEP_COST_MULTIPLIER : base;
  return withLeaderCostDiscount(player, cost);
}

function discardGold(age) { return age + 2; }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildPool(age, player) {
  const pool = [];
  CATEGORIES.forEach((type) => {
    const name = NAMES[type][age - 1];
    if (player.built.has(name)) return;
    const card = makeCard(type, age, name);
    if (type === 'attack' && player.leaderKey === 'alexander') card.attack += 2;
    pool.push(card);
  });
  if (age >= 2 && !player.wonderBuilt) pool.push(makeCard('wonder', age, ERAS[age - 1].wonder));
  return pool;
}

function drawCards(age, player) {
  return shuffle(buildPool(age, player)).slice(0, 3);
}

function dealHands(game) {
  aliveIds(game).forEach((id) => { const p = game.players[id]; p.hand = drawCards(game.age, p); });
}

function applyCivicEvent(player, key) {
  const split = CIVIC_SPLITS[key];
  player.eventMultipliers.attack *= (1 + (split.attack || 0));
  player.eventMultipliers.defence *= (1 + (split.defence || 0));
  player.eventMultipliers.income *= (1 + (split.income || 0));
}

function totals(player) {
  let attack = 0, defence = 0, income = 0;
  player.grid.forEach((tile) => {
    if (!tile) return;
    attack += tileStat(tile.base.attack, tile.level);
    defence += tileStat(tile.base.defence, tile.level);
    income += tileStat(tile.base.income, tile.level);
  });
  attack = attack * player.eventMultipliers.attack;
  defence = defence * player.eventMultipliers.defence;
  income = income * player.eventMultipliers.income;
  if (player.leaderKey === 'achilles') attack *= 1.5;
  if (player.leaderKey === 'einstein') defence += 2;
  return { attack: Math.round(attack), defence: Math.round(defence), income: Math.round(income) };
}

function cardValue(card) { return (card.attack || 0) + (card.defence || 0) + (card.income || 0) * 2; }

function aliveIds(game) { return game.order.filter((id) => game.players[id].hp > 0); }

/* ---------------- lifecycle ---------------- */

function createGame(roomPlayers) {
  const players = {};
  roomPlayers.forEach((rp) => {
    players[rp.id] = {
      id: rp.id,
      name: rp.name,
      isNpc: Boolean(rp.isNpc),
      leaderKey: null,
      gold: START_GOLD,
      hp: START_HP,
      grid: Array(GRID_SIZE).fill(null),
      built: new Set(),
      wonderBuilt: false,
      civic: {
        science: { upgradeCount: 0, eventsFired: 0 },
        religion: { upgradeCount: 0, eventsFired: 0 },
        culture: { upgradeCount: 0, eventsFired: 0 }
      },
      eventMultipliers: { attack: 1, defence: 1, income: 1 },
      acted: false,
      hand: []
    };
  });

  const game = {
    gameKey: 'civilization',
    gameOver: false,
    resultText: '',
    age: 1,
    turnInAge: 1,
    phase: 'picking', // 'picking' | 'draft' | 'wave' | 'ended'
    pickIndex: 0,
    players,
    order: roomPlayers.map((rp) => rp.id),
    log: [],
    turnDeadline: Date.now() + TURN_TIME_MS,
    waveShownUntil: null,
    waveResult: null,
    winnerId: null,       // null = draw (only meaningful once phase === 'ended')
    endedSuddenDeath: false,
    finalScores: null
  };

  game.log.push(`${game.players[game.order[0]].name} kiest als eerste een leider.`);
  return game;
}

function assignLeader(player, key) {
  player.leaderKey = key;
  if (key === 'cleopatra') {
    player.gold += 5;
    player.civic.religion.upgradeCount = 1;
    player.civic.culture.upgradeCount = 1;
  }
}

function beginAges(game) {
  game.phase = 'draft';
  dealHands(game);
  game.turnDeadline = Date.now() + TURN_TIME_MS;
  game.log.push(`Age 1 begins: ${ERAS[0].name}.`);
}

/* ---------------- actions ---------------- */

function handleAction(game, playerId, action, payload) {
  if (game.phase === 'picking') {
    if (action !== 'pickLeader') throw new Error('Kies eerst een leider.');
    const expectedId = game.order[game.pickIndex];
    if (playerId !== expectedId) throw new Error('Een andere speler is aan de beurt om te kiezen.');
    const p = game.players[playerId];
    const key = payload && payload.leaderKey;
    const leader = LEADERS.find((l) => l.key === key);
    if (!leader) throw new Error('Onbekende leider.');
    if (Object.values(game.players).some((pl) => pl.leaderKey === key)) throw new Error('Deze leider is al gekozen.');

    assignLeader(p, key);
    game.log.push(`${p.name} kiest ${leader.name}.`);
    game.pickIndex += 1;
    if (game.pickIndex >= game.order.length) beginAges(game);
    return;
  }

  if (game.phase !== 'draft' || game.gameOver) throw new Error('Je kunt nu geen actie kiezen.');
  const p = game.players[playerId];
  if (!p || p.acted || p.isNpc) throw new Error('Je hebt al gekozen.');

  if (action === 'build') {
    const idx = payload && Number.isInteger(payload.handIndex) ? payload.handIndex : -1;
    const card = p.hand[idx];
    if (!card) throw new Error('Ongeldige kaart.');
    if (p.built.has(card.name)) throw new Error('Dit gebouw heb je al.');
    const slot = p.grid.findIndex((x) => x === null);
    if (slot === -1) throw new Error('Je stad is vol.');
    if (p.gold < card.cost) throw new Error('Je hebt niet genoeg goud.');

    p.gold -= card.cost;
    p.grid[slot] = { type: card.type, name: card.name, level: 1, base: { attack: card.attack, defence: card.defence, income: card.income } };
    p.built.add(card.name);
    if (card.type === 'wonder') p.wonderBuilt = true;
    p.acted = true;
    game.log.push(`${p.name} bouwt ${card.name}.`);
  } else if (action === 'upgrade') {
    if (payload && typeof payload.civic === 'string') {
      const key = payload.civic;
      const civic = p.civic[key];
      if (!civic) throw new Error('Onbekend gebouw.');
      const upcomingStep = civic.upgradeCount + 1;
      const cost = civicUpgradeCost(game.age, upcomingStep, p);
      if (p.gold < cost) throw new Error('Je hebt niet genoeg goud.');

      p.gold -= cost;
      civic.upgradeCount = upcomingStep;
      if (civic.upgradeCount % 3 === 0) {
        applyCivicEvent(p, key);
        civic.eventsFired += 1;
        game.log.push(`${p.name} ontketent een ${CIVIC_NAMES[key]}-gebeurtenis!`);
      } else {
        game.log.push(`${p.name} upgrade ${CIVIC_NAMES[key]} (niveau ${civic.upgradeCount}).`);
      }
      p.acted = true;
    } else {
      const slot = payload && Number.isInteger(payload.slot) ? payload.slot : -1;
      const tile = p.grid[slot];
      if (!tile) throw new Error('Ongeldig gebouw.');
      if (tile.level >= game.age) throw new Error('Dit gebouw kan dit tijdperk niet verder groeien.');
      const cost = flexibleUpgradeCost(game.age, tile.type, p);
      if (p.gold < cost) throw new Error('Je hebt niet genoeg goud.');

      p.gold -= cost;
      tile.level += 1;
      tile.name = tile.type === 'wonder' ? ERAS[game.age - 1].wonder : NAMES[tile.type][game.age - 1];
      game.log.push(`${p.name} upgrade ${tile.name} (niveau ${tile.level}).`);
      p.acted = true;
    }
  } else if (action === 'discard') {
    const idx = payload && Number.isInteger(payload.handIndex) ? payload.handIndex : -1;
    const card = p.hand[idx];
    if (!card) throw new Error('Ongeldige kaart.');
    p.gold += discardGold(game.age);
    p.acted = true;
    game.log.push(`${p.name} gooit ${card.name} weg voor goud.`);
  } else {
    throw new Error('Onbekende actie.');
  }

  if (aliveIds(game).every((id) => game.players[id].acted)) completeTurn(game);
}

/* ---------------- phase transitions ---------------- */

function completeTurn(game) {
  aliveIds(game).forEach((id) => {
    const p = game.players[id];
    p.gold += totals(p).income;
  });

  if (game.turnInAge === TURNS_PER_AGE) {
    resolveWave(game);
  } else {
    game.turnInAge += 1;
    aliveIds(game).forEach((id) => { game.players[id].acted = false; });
    dealHands(game);
    game.turnDeadline = Date.now() + TURN_TIME_MS;
    game.log.push(`Age ${game.age}, beurt ${game.turnInAge}/${TURNS_PER_AGE} begint.`);
  }
}

function resolveWave(game) {
  const ids = aliveIds(game);
  const n = ids.length;
  const totalsById = {};
  ids.forEach((id) => { totalsById[id] = totals(game.players[id]); });

  const results = {};
  ids.forEach((id, i) => {
    const attackerId = ids[(i - 1 + n) % n];
    const targetId = ids[(i + 1) % n];
    let dmg = Math.max(0, totalsById[attackerId].attack - totalsById[id].defence);
    if (game.players[id].leaderKey === 'achilles') dmg = Math.round(dmg * 1.5);
    if (game.players[id].leaderKey === 'gandhi') dmg = Math.min(dmg, GANDHI_DAMAGE_CAP);
    results[id] = { attack: totalsById[id].attack, defence: totalsById[id].defence, incoming: totalsById[attackerId].attack, attackerId, targetId, damage: dmg };
  });
  ids.forEach((id) => {
    const p = game.players[id];
    p.hp = Math.max(0, p.hp - results[id].damage);
    if (p.hp > 0 && p.hp < 30 && p.leaderKey === 'lincoln') p.hp = Math.min(START_HP, p.hp + 10);
  });

  game.waveResult = { age: game.age, results };
  game.phase = 'wave';
  game.log.push(`Age ${game.age} aanval verwerkt.`);

  const stillAlive = ids.filter((id) => game.players[id].hp > 0);
  if (stillAlive.length <= 1) {
    game.phase = 'ended';
    game.gameOver = true;
    game.endedSuddenDeath = true;
    game.winnerId = stillAlive.length === 1 ? stillAlive[0] : null;
    finalizeScores(game);
    setResultText(game);
  } else {
    game.waveShownUntil = Date.now() + WAVE_DISPLAY_MS;
  }
}

function advanceAfterWave(game) {
  if (game.age >= TOTAL_AGES) {
    game.phase = 'ended';
    game.gameOver = true;
    game.endedSuddenDeath = false;
    finalizeScores(game);
    const ids = aliveIds(game);
    const maxHp = Math.max(...ids.map((id) => game.players[id].hp));
    const hpLeaders = ids.filter((id) => game.players[id].hp === maxHp);
    let winners = hpLeaders;
    if (hpLeaders.length > 1) {
      const scores = game.finalScores;
      const maxScore = Math.max(...hpLeaders.map((id) => scores[id]));
      winners = hpLeaders.filter((id) => scores[id] === maxScore);
    }
    game.winnerId = winners.length === 1 ? winners[0] : null;
    setResultText(game);
    return;
  }
  game.age += 1;
  game.turnInAge = 1;
  aliveIds(game).forEach((id) => { game.players[id].acted = false; });
  dealHands(game);
  game.phase = 'draft';
  game.waveResult = null;
  game.turnDeadline = Date.now() + TURN_TIME_MS;
  game.log.push(`Age ${game.age} begins: ${ERAS[game.age - 1].name}.`);
}

function finalizeScores(game) {
  const scores = {};
  game.order.forEach((id) => { scores[id] = game.players[id].gold; });
  game.finalScores = scores;
}

function setResultText(game) {
  game.resultText = game.winnerId
    ? `${game.players[game.winnerId].name} wint Age of Civilization.`
    : 'Age of Civilization eindigt in een gelijkspel.';
}

function playNpc(game, player) {
  const affordable = player.hand.map((card, index) => ({ card, index })).filter(({ card }) => card.cost <= player.gold);
  const hasSlot = player.grid.some((slot) => slot === null);

  if (affordable.length && hasSlot) {
    affordable.sort((a, b) => cardValue(b.card) - cardValue(a.card));
    const { card } = affordable[0];
    const slot = player.grid.findIndex((v) => v === null);
    player.gold -= card.cost;
    player.grid[slot] = { type: card.type, name: card.name, level: 1, base: { attack: card.attack, defence: card.defence, income: card.income } };
    player.built.add(card.name);
    if (card.type === 'wonder') player.wonderBuilt = true;
    game.log.push(`${player.name} bouwt ${card.name}.`);
  } else {
    const flexOptions = player.grid
      .map((tile, slot) => ({ kind: 'flex', slot, tile }))
      .filter(({ tile }) => tile && tile.level < game.age && flexibleUpgradeCost(game.age, tile.type, player) <= player.gold);
    const civicOptions = CIVIC_CATEGORIES
      .map((key) => ({ kind: 'civic', key }))
      .filter(({ key }) => civicUpgradeCost(game.age, player.civic[key].upgradeCount + 1, player) <= player.gold);
    const options = [...flexOptions, ...civicOptions];

    if (options.length) {
      const choice = options[Math.floor(Math.random() * options.length)];
      if (choice.kind === 'flex') {
        const tile = choice.tile;
        player.gold -= flexibleUpgradeCost(game.age, tile.type, player);
        tile.level += 1;
        tile.name = tile.type === 'wonder' ? ERAS[game.age - 1].wonder : NAMES[tile.type][game.age - 1];
        game.log.push(`${player.name} upgrade ${tile.name}.`);
      } else {
        const civic = player.civic[choice.key];
        const upcomingStep = civic.upgradeCount + 1;
        player.gold -= civicUpgradeCost(game.age, upcomingStep, player);
        civic.upgradeCount = upcomingStep;
        if (civic.upgradeCount % 3 === 0) {
          applyCivicEvent(player, choice.key);
          civic.eventsFired += 1;
          game.log.push(`${player.name} ontketent een ${CIVIC_NAMES[choice.key]}-gebeurtenis!`);
        } else {
          game.log.push(`${player.name} upgrade ${CIVIC_NAMES[choice.key]}.`);
        }
      }
    } else if (player.hand.length) {
      const card = player.hand[0];
      player.gold += discardGold(game.age);
      game.log.push(`${player.name} gooit ${card.name} weg voor goud.`);
    }
  }
  player.acted = true;
}

/* ---------------- optional: timers / auto-progress ---------------- */

function tick(game, now) {
  if (game.phase === 'picking') {
    const currentId = game.order[game.pickIndex];
    const current = currentId ? game.players[currentId] : null;
    if (current && current.isNpc) {
      const takenKeys = new Set(Object.values(game.players).map((pl) => pl.leaderKey).filter(Boolean));
      const available = LEADERS.filter((l) => !takenKeys.has(l.key));
      const choice = available[Math.floor(Math.random() * available.length)];
      assignLeader(current, choice.key);
      game.log.push(`${current.name} kiest ${choice.name}.`);
      game.pickIndex += 1;
      if (game.pickIndex >= game.order.length) beginAges(game);
      return true;
    }
    return false;
  }

  if (game.phase === 'draft') {
    const npc = aliveIds(game).map((id) => game.players[id]).find((player) => player.isNpc && !player.acted);
    if (npc) { playNpc(game, npc); if (aliveIds(game).every((id) => game.players[id].acted)) completeTurn(game); return true; }
  }
  if (game.phase === 'draft' && now >= game.turnDeadline) {
    let changed = false;
    aliveIds(game).forEach((id) => {
      const p = game.players[id];
      if (!p.acted) {
        p.gold += discardGold(game.age);
        p.acted = true;
        changed = true;
        game.log.push(`${p.name} was te laat en past automatisch.`);
      }
    });
    if (aliveIds(game).every((id) => game.players[id].acted)) completeTurn(game);
    return changed || true;
  }

  if (game.phase === 'wave' && game.waveShownUntil && now >= game.waveShownUntil) {
    advanceAfterWave(game);
    return true;
  }

  return false;
}

/* ---------------- serialize (per-requester view) ---------------- */

function serializeCivic(civic, age, player) {
  const out = {};
  CIVIC_CATEGORIES.forEach((key) => {
    const c = civic[key];
    out[key] = {
      name: CIVIC_NAMES[key],
      upgradeCount: c.upgradeCount,
      eventsFired: c.eventsFired,
      upgradeCost: civicUpgradeCost(age, c.upgradeCount + 1, player),
      isEventStep: (c.upgradeCount + 1) % 3 === 0
    };
  });
  return out;
}

function serialize(game, requesterId, connected) {
  const players = [];
  game.order.forEach((id) => {
    const p = game.players[id];
    const t = totals(p);
    players.push({
      id,
      name: p.name,
      isNpc: p.isNpc,
      leaderKey: p.leaderKey,
      leaderName: p.leaderKey ? LEADERS.find((l) => l.key === p.leaderKey).name : null,
      gold: p.gold,
      attack: t.attack,
      defence: t.defence,
      income: t.income,
      hp: Math.max(0, p.hp),
      alive: p.hp > 0,
      grid: p.grid.map((tile) => tile ? {
        type: tile.type,
        name: tile.name,
        level: tile.level,
        attack: tileStat(tile.base.attack, tile.level),
        defence: tileStat(tile.base.defence, tile.level),
        income: tileStat(tile.base.income, tile.level),
        upgradeCost: flexibleUpgradeCost(game.age, tile.type, p),
        maxed: tile.level >= game.age
      } : null),
      civic: serializeCivic(p.civic, game.age, p),
      wonderBuilt: p.wonderBuilt,
      acted: p.acted,
      isYou: id === requesterId,
      connected: p.isNpc || (connected ? Boolean(connected.get(id)) : true)
    });
  });

  const you = game.players[requesterId];
  const takenKeys = new Set(Object.values(game.players).map((pl) => pl.leaderKey).filter(Boolean));

  return {
    kind: game.gameKey,
    gameOver: game.gameOver,
    resultText: game.resultText,
    age: game.age,
    totalAges: TOTAL_AGES,
    turnInAge: game.turnInAge,
    turnsPerAge: TURNS_PER_AGE,
    turnNumber: (game.age - 1) * TURNS_PER_AGE + game.turnInAge,
    totalTurns: TOTAL_TURNS,
    eraName: ERAS[game.age - 1] ? ERAS[game.age - 1].name : '',
    phase: game.phase,
    deadline: game.phase === 'draft' ? game.turnDeadline
      : (game.phase === 'wave' ? game.waveShownUntil : null),
    order: game.order,
    players,
    leaders: LEADERS.map((l) => ({ key: l.key, name: l.name, attribute: l.attribute, bonus: l.bonus, taken: takenKeys.has(l.key) })),
    pickerId: game.phase === 'picking' ? game.order[game.pickIndex] : null,
    isYourPick: game.phase === 'picking' && game.order[game.pickIndex] === requesterId,
    yourHand: you && !you.acted && game.phase === 'draft'
      ? you.hand.map((c, i) => ({ idx: i, type: c.type, name: c.name, cost: c.cost, attack: c.attack, defence: c.defence, income: c.income, desc: cardDesc(c) }))
      : [],
    waveResult: game.waveResult,
    phaseIsWave: game.phase === 'wave',
    winnerId: game.winnerId,
    endedSuddenDeath: game.endedSuddenDeath,
    finalScores: game.finalScores,
    log: game.log.slice(-6)
  };
}

/* ---------------- optional: end-of-match stats ---------------- */

function results(game, durationMs) {
  const scores = game.finalScores || Object.fromEntries(game.order.map((id) => [id, game.players[id].gold]));
  return game.order.map((id) => ({
    playerId: id,
    placement: game.winnerId === null ? 1 : (game.winnerId === id ? 1 : 2),
    score: scores[id],
    won: game.winnerId === id,
    outcome: game.winnerId === null ? 'Gelijkspel' : (game.winnerId === id ? 'Wint' : 'Verliest'),
    durationMs
  }));
}

module.exports = { createGame, handleAction, serialize, tick, results };
