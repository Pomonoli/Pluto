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
 *   - Civic buildings (Science/Religion/Culture) fire their event the
 *     instant you designate them — no multi-step upgrade path. Each civic
 *     building can be designated exactly once per game; once used, it is
 *     maxed and can never be designated again.
 *
 * Later addition: each flexible category (Attack/Defence/Economy) has TWO
 * named variants per Age instead of one, doubling the draft pool for more
 * variety. Wonders similarly come in two flavors from Age 2: the original
 * balanced one, and an aggressive one (more Attack, less Defence and
 * Income). A tile remembers which variant it was built from (`variantIndex`)
 * so upgrading it always re-skins along that same track — its identity
 * never changes once bought, only its level.
 */

const TOTAL_AGES = 7;
const TURNS_PER_AGE = 3;
const TOTAL_TURNS = TOTAL_AGES * TURNS_PER_AGE;
const START_GOLD = 4;
const START_HP = 100;
const GRID_SIZE = 6;
const UPGRADE_COST_MULTIPLIER = 1.75;
const CIVIC_BASE_COST_MULTIPLIER = 2.5;
const EVENT_STEP_COST_MULTIPLIER = 2;
const GANDHI_DAMAGE_CAP = 25;
const HARALD_RAID_GOLD = 3;

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

// Two named variants per category per Age (more choice in the draft pool,
// less predictable than a single option). Building fresh and re-skinning on
// upgrade both use the SAME variant's track, so a tile keeps its identity
// for life — "Sharpened Spear" built in Age 1 always becomes "Drone Swarm
// Offensive" by Age 7, never drifts onto the other variant's name.
const NAMES = {
  attack: [
    ['Sharpened Spear', 'Bone-tipped Arrow'],
    ['Phalanx Legion', 'Ballista Corps'],
    ['Musketeer Vanguard', 'Cannon Battery'],
    ['Grand Army Corps', 'Cavalry Brigade'],
    ['Armored Blitz Division', 'Artillery Regiment'],
    ['Stealth Strike Wing', 'Cruise Missile Battery'],
    ['Drone Swarm Offensive', 'Railgun Platform']
  ],
  defence: [
    ['Stone Palisade', 'Thorn Barricade'],
    ['City Rampart', 'Hoplite Shield Wall'],
    ['Castle Bastion', 'Moated Keep'],
    ['Great Wall Garrison', 'Watchtower Network'],
    ['Trench Fortress', 'Bunker Complex'],
    ['Cyber Defense Shield', 'Anti-Air Battery'],
    ['Orbital Defense Platform', 'Shield Generator Array']
  ],
  economy: [
    ['Grain Store', 'Fishing Weir'],
    ['Trade Galley', 'Silver Mine'],
    ['Banking House', 'Silk Road Caravan'],
    ['Continental Bank', 'Tea Trade Fleet'],
    ['Factory Assembly Line', 'Oil Refinery'],
    ['Stock Exchange Floor', 'Tech Startup Hub'],
    ['Quantum Bank', 'Asteroid Mining Rig']
  ]
};

// Second Wonder variant per Age, alongside ERAS[].wonder (variant 0, the
// original balanced Wonder). Variant 1 is the aggressive option: more
// Attack, less Defence and Income.
const WONDER_NAMES_ALT = ['Colossus of War', 'Trojan Horse', "Excalibur's Forge", 'Forbidden Arsenal', 'Manhattan Project', 'Stealth Bomber Program', 'Death Star Array'];

// Fixed civic buildings: one each, present from the start, never rebuilt.
const CIVIC_NAMES = { science: 'Observatory', religion: 'Grand Temple', culture: 'Academy' };

// Each civic building's event boosts exactly one stat: Science -> Attack,
// Culture -> Income, Religion -> Defence.
const CIVIC_EVENT_STAT = { science: 'attack', culture: 'income', religion: 'defence' };
const CIVIC_STAT_LABEL = { attack: 'Attack', income: 'Goud', defence: 'Defence' };

// Leaders: picked once per player, in seat order, before Age 1 begins.
// NOTE on Cleopatra and Gandhi: the original brief for these two referenced
// Victory Points, which this ruleset removed entirely a few iterations ago
// (see CHANGELOG v1.7.0). There is no VP left to heal from or generate, so
// both bonuses below are a reinterpretation onto the current mechanics
// rather than a literal implementation — flagged here and in the release
// notes so they're easy to adjust.
const LEADERS = [
  { key: 'cleopatra', name: 'Cleopatra', attribute: 'Nemes-hoofdtooi', bonus: '+5 start Goud. Religie en Cultuur kan je gratis aanduiden (geen goudkost).' },
  { key: 'alexander', name: 'Alexander de Grote', attribute: 'Korinthische helm', bonus: 'Attack-gebouwen krijgen +2 Attack.' },
  { key: 'einstein', name: 'Einstein', attribute: 'Wilde haardos', bonus: 'Je Observatorium geeft een blijvende +2 Defence.' },
  { key: 'gandhi', name: 'Gandhi', attribute: 'Ronde bril', bonus: `Je Stad kan nooit meer dan ${GANDHI_DAMAGE_CAP} schade oplopen per aanvalsgolf.` },
  { key: 'bismarck', name: 'Bismarck', attribute: 'Pickelhaube', bonus: 'Upgrades kosten 25% minder goud.' },
  { key: 'lincoln', name: 'Lincoln', attribute: 'Hoge hoed', bonus: 'Je Stad geneest automatisch +10 HP als ze na een aanvalsgolf onder 30 zakt.' },
  { key: 'achilles', name: 'Achilles', attribute: 'Pluimhelm', bonus: '+50% Attack, maar je loopt ook 50% meer schade op.' },
  { key: 'harald', name: 'King Harald Hardrada', attribute: 'Gehoornde helm', bonus: `Bij elke aanvalsgolf plunder je tot ${HARALD_RAID_GOLD} Goud van de speler die jij aanvalt.` }
];

// variantIndex distinguishes the two named options within a category/Age
// (0 or 1) so a tile's re-skin-on-upgrade always pulls from the same track
// it was originally built from. For Wonders, variantIndex also picks the
// stat split: 0 = the original balanced Wonder, 1 = the aggressive one.
function makeCard(type, age, name, variantIndex) {
  variantIndex = variantIndex || 0;
  switch (type) {
    case 'attack': return { type, name, variantIndex, cost: age + 1, attack: age + 3, defence: 0, income: 0 };
    case 'defence': return { type, name, variantIndex, cost: age + 1, attack: 0, defence: age + 2, income: 0 };
    case 'economy': return { type, name, variantIndex, cost: age, attack: 0, defence: 0, income: age + 1 };
    case 'wonder': return variantIndex === 1
      ? { type, name, variantIndex, cost: age * 2, attack: age * 2 + 3, defence: Math.max(1, age - 1), income: Math.max(1, age - 2) }
      : { type, name, variantIndex, cost: age * 2, attack: age * 2, defence: age * 2 - 1, income: age };
    default: throw new Error('unknown card type: ' + type);
  }
}

// The re-skin name for a tile at its current level/Age, following whichever
// variant track it was originally built from.
function reskinName(type, age, variantIndex) {
  if (type === 'wonder') return variantIndex === 1 ? WONDER_NAMES_ALT[age - 1] : ERAS[age - 1].wonder;
  return NAMES[type][age - 1][variantIndex];
}

function cardDesc(c) {
  if (c.type === 'wonder') return 'Eenmalige wonderbonus voor je stad.';
  return 'Een bouwbonus voor je stad.';
}

// Effective stat for a flexible tile: each upgrade level multiplies the
// previous level's value by x1.5, with a floor of +2 per step so upgrading
// a low-value building is never a rounding-error step — upgrading an
// existing building is deliberately worth more than its up-front cost
// would buy in a fresh building of the same type.
function tileStat(base, level) {
  if (base <= 0) return 0;
  let value = base;
  for (let l = 2; l <= level; l++) value = Math.max(Math.round(value * 1.5), value + 2);
  return value;
}

function withLeaderCostDiscount(player, cost) {
  return player.leaderKey === 'bismarck' ? Math.round(cost * 0.75) : cost;
}

function flexibleUpgradeCost(age, type, player) {
  return withLeaderCostDiscount(player, Math.round(makeCard(type, age, '').cost * UPGRADE_COST_MULTIPLIER));
}

// A civic building fires its event the instant it's designated — there is
// no multi-step upgrade path any more, so this is simply its one-time cost.
// Cleopatra designates Religion and Culture for free.
function civicActivationCost(age, key, player) {
  if (player.leaderKey === 'cleopatra' && (key === 'religion' || key === 'culture')) return 0;
  const base = Math.round((age + 1) * CIVIC_BASE_COST_MULTIPLIER);
  return withLeaderCostDiscount(player, base * EVENT_STEP_COST_MULTIPLIER);
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
    NAMES[type][age - 1].forEach((name, variantIndex) => {
      if (player.built.has(name)) return;
      const card = makeCard(type, age, name, variantIndex);
      if (type === 'attack' && player.leaderKey === 'alexander') card.attack += 2;
      pool.push(card);
    });
  });
  if (age >= 2 && !player.wonderBuilt) {
    pool.push(makeCard('wonder', age, ERAS[age - 1].wonder, 0));
    pool.push(makeCard('wonder', age, WONDER_NAMES_ALT[age - 1], 1));
  }
  return pool;
}

function drawCards(age, player) {
  return shuffle(buildPool(age, player)).slice(0, 3);
}

function dealHands(game) {
  aliveIds(game).forEach((id) => { const p = game.players[id]; p.hand = drawCards(game.age, p); });
}

// Bonus grows with the Age it fires in: Age x 10% (Age 1 = 10%, Age 7 =
// 70%) of the stat's value at the moment it fires, added once as a flat,
// permanent bonus — e.g. 10 income in Age 4 (40%) becomes 14 income for
// the rest of the game, regardless of what's built afterwards.
function civicEventBonus(age) { return 0.10 * age; }

function applyCivicEvent(player, key, age) {
  const stat = CIVIC_EVENT_STAT[key];
  const currentValue = totals(player)[stat];
  player.civicBonus[stat] += currentValue * civicEventBonus(age);
}

function totals(player) {
  let attack = 0, defence = 0, income = 0;
  player.grid.forEach((tile) => {
    if (!tile) return;
    attack += tileStat(tile.base.attack, tile.level);
    defence += tileStat(tile.base.defence, tile.level);
    income += tileStat(tile.base.income, tile.level);
  });
  if (player.leaderKey === 'achilles') attack *= 1.5;
  if (player.leaderKey === 'einstein') defence += 2;
  attack += player.civicBonus.attack;
  defence += player.civicBonus.defence;
  income += player.civicBonus.income;
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
        science: { used: false },
        religion: { used: false },
        culture: { used: false }
      },
      civicBonus: { attack: 0, defence: 0, income: 0 },
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
    waveAcknowledged: new Set(),
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
  if (key === 'cleopatra') player.gold += 5;
}

function beginAges(game) {
  game.phase = 'draft';
  dealHands(game);
  game.log.push(`Age 1 begins: ${ERAS[0].name}.`);
}

/* ---------------- actions ---------------- */

function handleAction(game, playerId, action, payload) {
  if (game.phase === 'wave') {
    const p = game.players[playerId];
    if (action !== 'continueWave' || !p || p.isNpc) throw new Error('Wacht op de aanvalsgolf.');
    game.waveAcknowledged.add(playerId);
    if (humanWavePlayers(game).every((id) => game.waveAcknowledged.has(id))) advanceAfterWave(game);
    return;
  }

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
    p.grid[slot] = { type: card.type, name: card.name, level: 1, variantIndex: card.variantIndex, base: { attack: card.attack, defence: card.defence, income: card.income } };
    p.built.add(card.name);
    if (card.type === 'wonder') p.wonderBuilt = true;
    p.acted = true;
    game.log.push(`${p.name} bouwt ${card.name}.`);
  } else if (action === 'upgrade') {
    if (payload && typeof payload.civic === 'string') {
      const key = payload.civic;
      const civic = p.civic[key];
      if (!civic) throw new Error('Onbekend gebouw.');
      if (civic.used) throw new Error('Dit gebouw is al aangeduid.');
      const cost = civicActivationCost(game.age, key, p);
      if (p.gold < cost) throw new Error('Je hebt niet genoeg goud.');

      p.gold -= cost;
      civic.used = true;
      applyCivicEvent(p, key, game.age);
      const stat = CIVIC_EVENT_STAT[key];
      const pct = Math.round(civicEventBonus(game.age) * 100);
      game.log.push(`${p.name} duidt ${CIVIC_NAMES[key]} aan en ontketent een gebeurtenis! (+${pct}% ${CIVIC_STAT_LABEL[stat]})`);
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
      tile.name = reskinName(tile.type, game.age, tile.variantIndex);
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
  ids.forEach((id) => {
    const p = game.players[id];
    if (p.leaderKey !== 'harald') return;
    const target = game.players[results[id].targetId];
    const raided = Math.min(HARALD_RAID_GOLD, target.gold);
    if (raided <= 0) return;
    target.gold -= raided;
    p.gold += raided;
    game.log.push(`${p.name} plundert ${raided} Goud van ${target.name}.`);
  });

  game.waveResult = { age: game.age, results };
  game.phase = 'wave';
  game.log.push(`Age ${game.age} aanval verwerkt.`);

  game.waveAcknowledged = new Set();
}

function humanWavePlayers(game) {
  return game.order.filter((id) => !game.players[id].isNpc);
}

function advanceAfterWave(game) {
  const stillAlive = aliveIds(game);
  if (stillAlive.length <= 1) {
    game.phase = 'ended';
    game.gameOver = true;
    game.endedSuddenDeath = true;
    game.winnerId = stillAlive.length === 1 ? stillAlive[0] : null;
    finalizeScores(game);
    setResultText(game);
    return;
  }
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
  game.waveAcknowledged = new Set();
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
    player.grid[slot] = { type: card.type, name: card.name, level: 1, variantIndex: card.variantIndex, base: { attack: card.attack, defence: card.defence, income: card.income } };
    player.built.add(card.name);
    if (card.type === 'wonder') player.wonderBuilt = true;
    game.log.push(`${player.name} bouwt ${card.name}.`);
  } else {
    const flexOptions = player.grid
      .map((tile, slot) => ({ kind: 'flex', slot, tile }))
      .filter(({ tile }) => tile && tile.level < game.age && flexibleUpgradeCost(game.age, tile.type, player) <= player.gold);
    const civicOptions = CIVIC_CATEGORIES
      .map((key) => ({ kind: 'civic', key }))
      .filter(({ key }) => !player.civic[key].used && civicActivationCost(game.age, key, player) <= player.gold);
    const options = [...flexOptions, ...civicOptions];

    if (options.length) {
      const choice = options[Math.floor(Math.random() * options.length)];
      if (choice.kind === 'flex') {
        const tile = choice.tile;
        player.gold -= flexibleUpgradeCost(game.age, tile.type, player);
        tile.level += 1;
        tile.name = reskinName(tile.type, game.age, tile.variantIndex);
        game.log.push(`${player.name} upgrade ${tile.name}.`);
      } else {
        const civic = player.civic[choice.key];
        player.gold -= civicActivationCost(game.age, choice.key, player);
        civic.used = true;
        applyCivicEvent(player, choice.key, game.age);
        const stat = CIVIC_EVENT_STAT[choice.key];
        const pct = Math.round(civicEventBonus(game.age) * 100);
        game.log.push(`${player.name} duidt ${CIVIC_NAMES[choice.key]} aan en ontketent een gebeurtenis! (+${pct}% ${CIVIC_STAT_LABEL[stat]})`);
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
    // Human choices have no deadline; only NPCs may act from tick().
    const npc = aliveIds(game).map((id) => game.players[id]).find((player) => player.isNpc && !player.acted);
    if (npc) { playNpc(game, npc); if (aliveIds(game).every((id) => game.players[id].acted)) completeTurn(game); return true; }
  }

  // A wave with only NPCs needs no human confirmation.  Never let tick()
  // skip a combat result that a human still has to acknowledge.
  if (game.phase === 'wave' && humanWavePlayers(game).length === 0) {
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
    const stat = CIVIC_EVENT_STAT[key];
    out[key] = {
      name: CIVIC_NAMES[key],
      used: c.used,
      maxed: c.used,
      upgradeCost: civicActivationCost(age, key, player),
      statKey: stat,
      statLabel: CIVIC_STAT_LABEL[stat],
      eventBonusPct: Math.round(civicEventBonus(age) * 100)
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
        nextAttack: tileStat(tile.base.attack, tile.level + 1),
        nextDefence: tileStat(tile.base.defence, tile.level + 1),
        nextIncome: tileStat(tile.base.income, tile.level + 1),
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
    deadline: null,
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
    hasAcknowledgedWave: game.waveAcknowledged.has(requesterId),
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
