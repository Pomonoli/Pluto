'use strict';

/**
 * Age of Civilization — server-authoritative logic (v5).
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
 * v5 rules (on top of v4's 21-turn / combat-on-turn-3 structure):
 *   - Science, Religion and Culture are no longer draftable cards. Every
 *     player instead starts with one fixed, permanent building of each
 *     (never built or replaced, only upgraded).
 *   - The flexible city grid drops from 9 to 6 slots, drafted from Attack,
 *     Defence and Economy cards (plus a Wonder from Age 2).
 *   - Upgrading a flexible tile adds +25% of its BASE stat per level,
 *     linearly (level 2 = 125% of base, level 3 = 150%, ...).
 *   - Upgrading a fixed civic building does nothing on its own until the
 *     3rd upgrade (and again the 6th, 9th, ...): that "event" permanently
 *     multiplies the player's Attack/Defence/Income by a civic-specific
 *     split (Science: +30% attack/+20% income/+10% defence; Culture and
 *     Religion: +30% income/+20% defence/+10% attack), stacking each time
 *     it fires.
 *   - Every upgrade (flexible or civic) costs more than before, and its
 *     counter (tile level, or civic upgrade count) can never exceed the
 *     current Age — a building can't be pushed further than "its Age"
 *     allows, so nothing built or upgraded this Age can upgrade again
 *     until the Age advances.
 *   - City HP starts at 100 (no VP, so no healing). A tower hitting 0 is an
 *     instant loss. If both towers survive all 21 turns, the higher HP wins;
 *     gold only breaks a tie in HP.
 */

const TOTAL_AGES = 7;
const TURNS_PER_AGE = 3;
const TOTAL_TURNS = TOTAL_AGES * TURNS_PER_AGE;
const TURN_TIME_MS = 40000;  // soft deadline per turn for drafting/building
const WAVE_DISPLAY_MS = 4000; // how long the wave-result screen stays up before auto-advancing
const START_GOLD = 4;
const START_HP = 100;
const GRID_SIZE = 6;
const UPGRADE_COST_MULTIPLIER = 2;

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

function flexibleUpgradeCost(age, type) {
  return makeCard(type, age, '').cost * UPGRADE_COST_MULTIPLIER;
}

function civicUpgradeCost(age) {
  return (age + 1) * 3;
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
    if (!player.built.has(name)) pool.push(makeCard(type, age, name));
  });
  if (age >= 2 && !player.wonderBuilt) pool.push(makeCard('wonder', age, ERAS[age - 1].wonder));
  return pool;
}

function drawCards(age, player) {
  return shuffle(buildPool(age, player)).slice(0, 3);
}

function dealHands(game) {
  Object.values(game.players).forEach((p) => { p.hand = drawCards(game.age, p); });
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
  return {
    attack: Math.round(attack * player.eventMultipliers.attack),
    defence: Math.round(defence * player.eventMultipliers.defence),
    income: Math.round(income * player.eventMultipliers.income)
  };
}

function cardValue(card) { return (card.attack || 0) + (card.defence || 0) + (card.income || 0) * 2; }

/* ---------------- lifecycle ---------------- */

function createGame(roomPlayers) {
  const players = {};
  roomPlayers.forEach((rp) => {
    players[rp.id] = {
      id: rp.id,
      name: rp.name,
      isNpc: Boolean(rp.isNpc),
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
    phase: 'draft', // 'draft' | 'wave' | 'ended'
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

  dealHands(game);
  game.log.push(`Age 1 begins: ${ERAS[0].name}.`);
  return game;
}

/* ---------------- actions ---------------- */

function handleAction(game, playerId, action, payload) {
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
      if (civic.upgradeCount >= game.age) throw new Error('Dit gebouw kan dit tijdperk niet verder groeien.');
      const cost = civicUpgradeCost(game.age);
      if (p.gold < cost) throw new Error('Je hebt niet genoeg goud.');

      p.gold -= cost;
      civic.upgradeCount += 1;
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
      const cost = flexibleUpgradeCost(game.age, tile.type);
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

  if (game.order.every((id) => game.players[id].acted)) completeTurn(game);
}

/* ---------------- phase transitions ---------------- */

function completeTurn(game) {
  game.order.forEach((id) => {
    const p = game.players[id];
    p.gold += totals(p).income;
  });

  if (game.turnInAge === TURNS_PER_AGE) {
    resolveWave(game);
  } else {
    game.turnInAge += 1;
    game.order.forEach((id) => { game.players[id].acted = false; });
    dealHands(game);
    game.turnDeadline = Date.now() + TURN_TIME_MS;
    game.log.push(`Age ${game.age}, beurt ${game.turnInAge}/${TURNS_PER_AGE} begint.`);
  }
}

function resolveWave(game) {
  const totalsById = {};
  game.order.forEach((id) => { totalsById[id] = totals(game.players[id]); });

  const results = {};
  game.order.forEach((id) => {
    const p = game.players[id];
    const opponentId = game.order.find((oid) => oid !== id);
    const dmg = Math.max(0, totalsById[opponentId].attack - totalsById[id].defence);
    p.hp = Math.max(0, p.hp - dmg);
    results[id] = { attack: totalsById[id].attack, defence: totalsById[id].defence, incoming: totalsById[opponentId].attack, damage: dmg };
  });

  game.waveResult = { age: game.age, results };
  game.phase = 'wave';
  game.log.push(`Age ${game.age} aanval verwerkt.`);

  const deadIds = game.order.filter((id) => game.players[id].hp <= 0);
  if (deadIds.length > 0) {
    game.phase = 'ended';
    game.gameOver = true;
    game.endedSuddenDeath = true;
    game.winnerId = deadIds.length === game.order.length
      ? null
      : game.order.find((id) => !deadIds.includes(id));
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
    const maxHp = Math.max(...game.order.map((id) => game.players[id].hp));
    const hpLeaders = game.order.filter((id) => game.players[id].hp === maxHp);
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
  game.order.forEach((id) => { game.players[id].acted = false; });
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
      .filter(({ tile }) => tile && tile.level < game.age && flexibleUpgradeCost(game.age, tile.type) <= player.gold);
    const civicOptions = CIVIC_CATEGORIES
      .map((key) => ({ kind: 'civic', key }))
      .filter(({ key }) => player.civic[key].upgradeCount < game.age && civicUpgradeCost(game.age) <= player.gold);
    const options = [...flexOptions, ...civicOptions];

    if (options.length) {
      const choice = options[Math.floor(Math.random() * options.length)];
      if (choice.kind === 'flex') {
        const tile = choice.tile;
        player.gold -= flexibleUpgradeCost(game.age, tile.type);
        tile.level += 1;
        tile.name = tile.type === 'wonder' ? ERAS[game.age - 1].wonder : NAMES[tile.type][game.age - 1];
        game.log.push(`${player.name} upgrade ${tile.name}.`);
      } else {
        const civic = player.civic[choice.key];
        player.gold -= civicUpgradeCost(game.age);
        civic.upgradeCount += 1;
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
  if (game.phase === 'draft') {
    const npc = game.order.map((id) => game.players[id]).find((player) => player.isNpc && !player.acted);
    if (npc) { playNpc(game, npc); if (game.order.every((id) => game.players[id].acted)) completeTurn(game); return true; }
  }
  if (game.phase === 'draft' && now >= game.turnDeadline) {
    let changed = false;
    game.order.forEach((id) => {
      const p = game.players[id];
      if (!p.acted) {
        p.gold += discardGold(game.age);
        p.acted = true;
        changed = true;
        game.log.push(`${p.name} was te laat en past automatisch.`);
      }
    });
    if (game.order.every((id) => game.players[id].acted)) completeTurn(game);
    return changed || true;
  }

  if (game.phase === 'wave' && game.waveShownUntil && now >= game.waveShownUntil) {
    advanceAfterWave(game);
    return true;
  }

  return false;
}

/* ---------------- serialize (per-requester view) ---------------- */

function serializeCivic(civic, age) {
  const out = {};
  CIVIC_CATEGORIES.forEach((key) => {
    const c = civic[key];
    out[key] = {
      name: CIVIC_NAMES[key],
      upgradeCount: c.upgradeCount,
      eventsFired: c.eventsFired,
      upgradeCost: civicUpgradeCost(age),
      maxed: c.upgradeCount >= age
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
      gold: p.gold,
      attack: t.attack,
      defence: t.defence,
      income: t.income,
      hp: Math.max(0, p.hp),
      grid: p.grid.map((tile) => tile ? {
        type: tile.type,
        name: tile.name,
        level: tile.level,
        attack: tileStat(tile.base.attack, tile.level),
        defence: tileStat(tile.base.defence, tile.level),
        income: tileStat(tile.base.income, tile.level),
        upgradeCost: flexibleUpgradeCost(game.age, tile.type),
        maxed: tile.level >= game.age
      } : null),
      civic: serializeCivic(p.civic, game.age),
      wonderBuilt: p.wonderBuilt,
      acted: p.acted,
      isYou: id === requesterId,
      connected: p.isNpc || (connected ? Boolean(connected.get(id)) : true)
    });
  });

  const you = game.players[requesterId];

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
