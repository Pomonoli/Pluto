'use strict';

const { CONFIG } = require('./config');
const { randomInt } = require('node:crypto');
const combat = require('./combat');
const { FACTIONS, PLAYABLE_FACTIONS, TERRAINS, buildBoard, isConnected, landNeighbors } = require('./board');
const BOARD = buildBoard();
const FACTION_IDS = [...PLAYABLE_FACTIONS];

function normalizeRoomOptions(options = {}) {
  const source = options.factions && typeof options.factions === 'object' ? options.factions : {};
  const factions = {};
  for (const [playerId, faction] of Object.entries(source)) {
    if (typeof playerId === 'string' && FACTION_IDS.includes(faction)) factions[playerId] = faction;
  }
  return { factions };
}

function normalizePlayerRoomOptions(options, payload, { player, players }) {
  const normalized = normalizeRoomOptions(options), faction = payload.faction;
  if (!FACTION_IDS.includes(faction)) throw new Error('Kies één van de vier facties.');
  const takenBy = players.find((entry) => entry.id !== player.id && normalized.factions[entry.id] === faction);
  if (takenBy) throw new Error(`${FACTIONS[faction].name} is al gekozen door ${takenBy.name}.`);
  normalized.factions[player.id] = faction;
  return normalized;
}

function units(state) { return state.units || { militia: state.troops || 0, armored: 0 }; }
function sync(state) { state.units = units(state); state.troops = state.units.militia + state.units.armored; }
function level(state, building) { return state.buildings.includes(building) ? state.buildingLevels?.[building] || 1 : 0; }
function capitalLevel(game, player) { const capital = game.sectors[FACTIONS[player.faction].capital]; return capital.controller === player.faction ? capital.capitalLevel : 1; }
function currentPlayer(game) { return game.players[game.turnIndex]; }

// Persistente rooms uit de bordversie krijgen dezelfde campagnegegevens als nieuwe rooms.
function prepare(game) {
  const legacy = !game.rulesVersion || game.rulesVersion < 3;
  for (const p of game.players) {
    p.cards ??= [];
    p.earnedCardThisTurn ??= false;
    if (!Object.hasOwn(CONFIG.taxPolicies, p.taxPolicy)) p.taxPolicy = 'normal';
    if (legacy && !Object.values(game.sectors).some((s) => s.controller === p.faction && s.troops > 0)) {
      const capital = game.sectors[FACTIONS[p.faction].capital];
      if (capital?.controller === p.faction) { capital.troops = 3; capital.units = { militia: 3, armored: 0 }; }
    }
  }
  for (const s of Object.values(game.sectors)) {
    s.buildingLevels ??= {};
    if (!Number.isInteger(s.capitalLevel) || s.capitalLevel < 1) s.capitalLevel = 1;
    sync(s);
    s.movement ??= 2;
    s.population ??= 5;
    s.support ??= CONFIG.startSupport;
  }
  game.rulesVersion = 4;
  game.battle ??= null;
  game.lastBattle ??= null;
  game.nextCardId ??= 1;
  game.nextBattleId ??= 1;
}

function createGame(roomPlayers, options = {}) {
  const chosen = normalizeRoomOptions(options).factions, available = [...FACTION_IDS];
  const assignments = new Map();
  for (const player of roomPlayers.slice(0, 4)) {
    const faction = chosen[player.id];
    if (!faction || !available.includes(faction)) continue;
    assignments.set(player.id, faction); available.splice(available.indexOf(faction), 1);
  }
  const players = roomPlayers.slice(0, 4).map((p) => ({ id: p.id, name: p.name, isNpc: Boolean(p.isNpc),
    faction: assignments.get(p.id) || available.shift(), treasury: CONFIG.startTreasury, support: CONFIG.startSupport, taxPolicy: 'normal' }));
  const active = new Set(players.map((p) => p.faction));
  const sectors = {};
  for (const sector of BOARD.sectors.values()) {
    const controller = sector.factionHome !== 'center' && active.has(sector.factionHome) ? sector.factionHome : null;
    const troops = sector.id === 'center_sint_niklaas' ? CONFIG.neutralGarrison : controller ? (sector.isCapital ? 3 : 0) : CONFIG.rebelGarrison;
    sectors[sector.id] = { controller, troops, units: { militia: troops, armored: 0 }, buildings: [] };
  }
  const game = { gameKey: 'slag-om-waas', players, sectors, round: 1, turnIndex: 0, gameOver: false,
    resultText: '', winnerId: null, log: ['Het Land van Waas ligt klaar. Sint-Niklaas wacht neutraal in het midden.'], nextNpcAt: 0 };
  prepare(game); scheduleNpc(game); return game;
}

function economy(game, faction) {
  let base = 0, upkeep = 0;
  for (const [id, state] of Object.entries(game.sectors)) {
    if (state.controller !== faction) continue;
    base += BOARD.sectors.get(id).economicValue;
    for (const building of state.buildings) base += (CONFIG.buildings[building]?.incomeBonus || 0) * level(state, building);
    for (const [type, count] of Object.entries(units(state))) upkeep += (CONFIG.units[type]?.upkeep || 0) * count;
  }
  return { base, upkeep };
}

function rebellion(game, player) {
  const options = [...BOARD.sectors.values()].filter((s) => game.sectors[s.id].controller === player.faction && !s.isCapital);
  if (!options.length) return;
  const sector = options.sort((a, b) => a.economicValue - b.economicValue || a.id.localeCompare(b.id))[0];
  const state = game.sectors[sector.id]; state.controller = null;
  state.units = { militia: Math.max(CONFIG.rebelGarrison, state.troops), armored: 0 }; sync(state); player.support = 2;
  game.log.unshift(`${sector.name} komt in opstand en valt in handen van de Wase Boeren.`);
}

function startTurn(game) {
  const player = currentPlayer(game), totals = economy(game, player.faction), policy = CONFIG.taxPolicies[player.taxPolicy];
  player.earnedCardThisTurn = false;
  const supportFactor = player.support >= 8 ? CONFIG.support.incomeBonus : player.support <= 3 ? CONFIG.support.criticalIncome : 1;
  const income = Math.floor(totals.base * policy.incomeMultiplier * supportFactor);
  player.treasury += income - totals.upkeep;
  player.support = Math.max(0, Math.min(10, player.support + policy.supportDelta));
  game.log.unshift({ playerId: player.id, text: `${player.name} ontvangt ${income} goud en betaalt ${totals.upkeep} onderhoud.` });
  if (!player.support) rebellion(game, player);
  for (const s of Object.values(game.sectors)) if (s.controller === player.faction) {
    s.movement = 2 + level(s, 'infrastructure');
    s.population = Math.min(10, s.population + (player.taxPolicy === 'low' ? 2 : player.taxPolicy === 'extortion' ? 0 : 1));
  }
  if (player.treasury < 0) {
    for (const s of Object.values(game.sectors)) if (s.controller === player.faction && s.troops) {
      const type = s.units.militia ? 'militia' : 'armored'; s.units[type]--; sync(s);
    }
    player.treasury = 0; player.support = Math.max(0, player.support - 2);
    game.log.unshift('Onbetaalde soldaten deserteren; het draagvlak daalt met 2.');
  }
}

function endTurn(game) {
  if (checkVictory(game)) return;
  const player = currentPlayer(game); game.log.unshift(`${player.name} (${FACTIONS[player.faction].name}) beëindigt de beurt.`);
  game.turnIndex = (game.turnIndex + 1) % game.players.length;
  if (!game.turnIndex) { game.round += 1; game.log.unshift(`Ronde ${game.round} begint.`); }
  startTurn(game); checkVictory(game); game.log = game.log.slice(0, 40); scheduleNpc(game);
}

function checkVictory(game) {
  for (const p of game.players) {
    const count = Object.values(game.sectors).filter((s) => s.controller === p.faction).length;
    const center = game.sectors.center_sint_niklaas.controller === p.faction;
    if (center && (count >= 23 || p.treasury >= CONFIG.victory.economicTreasury)) {
      game.gameOver = true; game.winnerId = p.id; game.nextNpcAt = 0;
      game.resultText = `${p.name} verenigt het Waasland: Sint-Niklaas en ${count >= 23 ? '23 provincies' : '50 goud'}!`;
      game.log.unshift(game.resultText); return true;
    }
  }
  return false;
}

function owned(game, player, id) {
  const state = game.sectors[id];
  if (!state || state.controller !== player.faction) throw new Error('Deze provincie is niet van jou.');
  return state;
}

function build(game, player, { sectorId, building }) {
  const state = owned(game, player, sectorId), sector = BOARD.sectors.get(sectorId), item = CONFIG.buildings[building];
  if (!Object.hasOwn(CONFIG.buildings, building)) throw new Error('Onbekend gebouw.');
  if (state.buildings.length >= sector.buildSlots) throw new Error('Geen vrije bouwplaats.');
  if (state.buildings.includes(building)) throw new Error('Dit gebouw staat hier al.');
  if (player.treasury < item.cost) throw new Error('Onvoldoende goud.');
  player.treasury -= item.cost; state.buildings.push(building); state.buildingLevels[building] = 1;
  if (building === 'civic') player.support = Math.min(10, player.support + item.supportBonus);
  game.log.unshift(`${player.name} bouwt ${item.label} in ${sector.name}.`);
}

function upgrade(game, player, { sectorId, building }) {
  const state = owned(game, player, sectorId);
  if (building === 'capital') {
    if (sectorId !== FACTIONS[player.faction].capital) throw new Error('Upgrade je eigen hoofdstad.');
    if (state.capitalLevel >= CONFIG.maxBuildingLevel) throw new Error('Maximum niveau bereikt.');
    const cost = CONFIG.capitalUpgradeCost * state.capitalLevel;
    if (player.treasury < cost) throw new Error('Onvoldoende goud.');
    player.treasury -= cost; state.capitalLevel++;
  } else {
    if (!Object.hasOwn(CONFIG.buildings, building) || !state.buildings.includes(building)) throw new Error('Dit gebouw staat hier niet.');
    const current = level(state, building);
    if (current >= capitalLevel(game, player)) throw new Error('Upgrade eerst je hoofdstad.');
    if (current >= CONFIG.maxBuildingLevel) throw new Error('Maximum niveau bereikt.');
    const cost = CONFIG.buildings[building].cost * (current + 1);
    if (player.treasury < cost) throw new Error('Onvoldoende goud.');
    player.treasury -= cost; state.buildingLevels[building] = current + 1;
    if (building === 'civic') player.support = Math.min(10, player.support + CONFIG.buildings.civic.supportBonus);
  }
  game.log.unshift(player.name + ' verbetert ' + (building === 'capital' ? 'de hoofdstad' : CONFIG.buildings[building].label) + ' in ' + BOARD.sectors.get(sectorId).name + ' naar niveau ' + (building === 'capital' ? state.capitalLevel : level(state, building)) + '.');
}

function recruit(game, player, { sectorId, unit = 'militia' }) {
  const state = owned(game, player, sectorId), item = CONFIG.units[unit];
  if (!Object.hasOwn(CONFIG.units, unit)) throw new Error('Onbekende eenheid.');
  if (state.population < 2) throw new Error('Onvoldoende lokale bevolking (minimaal 2 nodig).');
  if (item.requires && !state.buildings.includes(item.requires)) throw new Error('Hiervoor is een kazerne nodig.');
  const cost = Math.max(1, item.cost - (player.support >= 8 ? 1 : 0) - Math.max(0, level(state, 'barracks') - 1));
  if (player.treasury < cost) throw new Error('Onvoldoende goud.');
  player.treasury -= cost; state.population--; sync(state); state.units[unit] += 1; sync(state);
  game.log.unshift(`${player.name} werft ${item.label} in ${BOARD.sectors.get(sectorId).name}.`);
}

function move(game, player, { from, to }) {
  const source = owned(game, player, from), target = game.sectors[to];
  if (!target || !isConnected(BOARD, from, to)) throw new Error('Deze provincies zijn niet verbonden.');
  sync(source); if (!source.troops) throw new Error('Geen troepen om te verplaatsen.');
  const connection = BOARD.sectors.get(from).connections.find((c) => c.to === to);
  const cost = connection.kinds.includes('road') ? 1 : 2;
  if (source.movement < cost) throw new Error('Onvoldoende beweging; wacht tot je volgende beurt.');
  const remaining = source.movement - cost;
  if (target.controller === player.faction) {
    target.movement = target.troops ? Math.min(target.movement, remaining) : remaining;
    sync(target); target.units.militia += source.units.militia; target.units.armored += source.units.armored;
    source.units = { militia: 0, armored: 0 }; sync(source); sync(target); return;
  }
  if (source.troops < 2) throw new Error('Minimaal 2 troepen nodig om aan te vallen; één blijft achter.');
  source.movement = 0;
  game.battle = { id: game.nextBattleId++, attackerId: player.id, from, to, rounds: 0, lastRoll: null };
  if (!target.troops) conquer(game, player);
}

function removeTroops(state, count) {
  for (const type of ['militia', 'armored']) {
    const lost = Math.min(state.units[type], count); state.units[type] -= lost; count -= lost;
  }
  sync(state);
}

function awardCard(game, player) {
  if (player.earnedCardThisTurn) return;
  const types = Object.keys(CONFIG.cards);
  player.cards.push({ id: String(game.nextCardId++), type: types[randomInt(types.length)] });
  player.earnedCardThisTurn = true;
  game.log.unshift(player.name + ' verdient een overwinningskaart.');
}

function finishBattle(game, outcome) {
  game.lastBattle = { ...game.battle, outcome };
  game.battle = null;
}

function conquer(game, player) {
  const { from, to } = game.battle, source = game.sectors[from], target = game.sectors[to];
  const garrison = source.units.militia ? 'militia' : 'armored';
  source.units[garrison]--;
  target.units = { ...source.units }; target.controller = player.faction; target.movement = 0;
  source.units = { militia: 0, armored: 0 }; source.units[garrison] = 1;
  sync(source); sync(target);
  player.support = Math.min(10, player.support + 1);
  game.log.unshift(player.name + ' verovert ' + BOARD.sectors.get(to).name + '. Eén troep blijft achter.');
  awardCard(game, player); finishBattle(game, 'conquered');
}

function battleAction(game, player, retreat = false) {
  const battle = game.battle;
  if (!battle || battle.attackerId !== player.id) throw new Error('Geen actieve aanval van jou.');
  if (retreat) {
    player.support = Math.max(0, player.support - 1);
    game.log.unshift(player.name + ' staakt de aanval op ' + BOARD.sectors.get(battle.to).name + '.');
    finishBattle(game, 'retreated'); return;
  }
  const source = game.sectors[battle.from], target = game.sectors[battle.to];
  const sector = BOARD.sectors.get(battle.to), connection = BOARD.sectors.get(battle.from).connections.find(c => c.to === battle.to);
  const roll = combat.rollRound({ attackers: source.troops, defenders: target.troops,
    attackArmor: Math.min(source.units.armored, source.troops - 1), defenseArmor: target.units.armored,
    fort: level(target, 'fort'), castle: sector.isCapital ? target.capitalLevel : 0,
    bridge: connection.kinds.includes('bridge') ? 1 : 0 });
  removeTroops(source, roll.attackerLosses); removeTroops(target, roll.defenderLosses);
  battle.rounds++; battle.lastRoll = roll;
  game.log.unshift(BOARD.sectors.get(battle.from).name + ' → ' + sector.name + ': worp ' + roll.attackDice.join('/') + ' tegen ' + roll.defenseDice.join('/') + '; na bonussen ' + roll.attackScores.join('/') + ' tegen ' + roll.defenseScores.join('/') + '. Verlies: aanvaller ' + roll.attackerLosses + ', verdediger ' + roll.defenderLosses + '.');
  if (!target.troops) conquer(game, player);
  else if (source.troops <= 1) {
    player.support = Math.max(0, player.support - 1);
    game.log.unshift('De aanval van ' + player.name + ' op ' + sector.name + ' is afgeslagen.');
    finishBattle(game, 'defeated');
  }
  game.log = game.log.slice(0, 40);
}

function playCard(game, player, { cardId, sectorId }) {
  const index = player.cards.findIndex(card => card.id === cardId);
  if (index < 0) throw new Error('Je bezit deze kaart niet.');
  const card = player.cards[index], item = CONFIG.cards[card.type];
  if (!item) throw new Error('Onbekende kaart.');
  if (item.troops) {
    const state = owned(game, player, sectorId);
    state.units.militia += item.troops; sync(state);
  }
  if (item.gold) player.treasury += item.gold;
  if (item.support) player.support = Math.min(10, player.support + item.support);
  player.cards.splice(index, 1);
  game.log.unshift(player.name + ' speelt ' + item.label + (item.troops ? ' in ' + BOARD.sectors.get(sectorId).name : '') + '.');
}

function handleAction(game, playerId, action, data = {}) {
  prepare(game);
  if (!data || typeof data !== 'object') throw new Error('Ongeldige actiegegevens.');
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  const player = currentPlayer(game);
  if (!player || player.id !== playerId || player.isNpc) throw new Error('Je bent niet aan de beurt.');
  if (game.battle && !['rollBattle', 'retreat'].includes(action)) throw new Error('Rond eerst je gevecht af of trek je terug.');
  if (action === 'rollBattle') return battleAction(game, player);
  if (action === 'retreat') return battleAction(game, player, true);
  if (action === 'playCard') return playCard(game, player, data);
  if (action === 'endTurn') return endTurn(game);
  if (action === 'setTax') { if (!Object.hasOwn(CONFIG.taxPolicies, data.policy)) throw new Error('Ongeldig belastingbeleid.'); player.taxPolicy = data.policy; game.log.unshift({ playerId: player.id, text: `${player.name}: ${CONFIG.taxPolicies[data.policy].label} belastingen vanaf de volgende inkomstenfase.` }); return; }
  if (action === 'upgrade') return upgrade(game, player, data);
  if (action === 'build') return build(game, player, data);
  if (action === 'recruit') return recruit(game, player, data);
  if (action === 'move') return move(game, player, data);
  throw new Error('Onbekende actie.');
}

function scheduleNpc(game) { game.nextNpcAt = !game.gameOver && currentPlayer(game)?.isNpc ? Date.now() + CONFIG.npcTurnDelayMs : 0; }
function tick(game, now = Date.now()) { prepare(game); if (game.gameOver || !currentPlayer(game)?.isNpc) return false;
  if (!game.nextNpcAt) game.nextNpcAt = now + CONFIG.npcTurnDelayMs; if (now < game.nextNpcAt) return false;
  npcTurn(game); endTurn(game); return true; }

function npcTurn(game) {
  const p = currentPlayer(game);
  p.taxPolicy = p.support < 7 ? 'low' : 'normal';
  const own = [...BOARD.sectors.values()].filter((s) => game.sectors[s.id].controller === p.faction);
  const distance = (id) => {
    const queue = [[id, 0]], seen = new Set([id]);
    for (let i = 0; i < queue.length; i++) {
      const [at, steps] = queue[i];
      if (game.sectors[at].controller !== p.faction) return steps;
      for (const c of BOARD.sectors.get(at).connections) if (!seen.has(c.to)) { seen.add(c.to); queue.push([c.to, steps + 1]); }
    }
    return 99;
  };
  own.sort((a, b) => game.sectors[b.id].troops - game.sectors[a.id].troops);
  const base = own[0];
  if (!base) return;
  for (const card of [...p.cards]) playCard(game, p, { cardId: card.id, sectorId: base.id });
  for (let i = 0; i < 3 && p.treasury >= 3 && game.sectors[base.id].population >= 2; i++) recruit(game, p, { sectorId: base.id });
  for (const s of own) {
    const source = game.sectors[s.id];
    if (!source.troops || source.controller !== p.faction) continue;
    const targets = s.connections.filter((c) => source.movement >= (c.kinds.includes('road') ? 1 : 2))
      .sort((a, b) => distance(a.to) - distance(b.to));
    const target = targets.find((c) => {
      const t = game.sectors[c.to];
      return t.controller === p.faction ? distance(c.to) < distance(s.id) : source.troops > Math.max(1, t.troops + level(t, 'fort') + (BOARD.sectors.get(c.to).isCapital ? t.capitalLevel : 0));
    });
    if (target) {
      move(game, p, { from: s.id, to: target.to });
      while (game.battle) {
        const b = game.battle;
        if (game.sectors[b.from].troops < 3 && game.sectors[b.to].troops > 1) battleAction(game, p, true);
        else battleAction(game, p);
      }
    }
  }
  const capital = game.sectors[FACTIONS[p.faction].capital];
  if (capital.controller === p.faction && capital.capitalLevel < CONFIG.maxBuildingLevel && p.treasury >= CONFIG.capitalUpgradeCost * capital.capitalLevel + 8) upgrade(game, p, { sectorId: FACTIONS[p.faction].capital, building: 'capital' });
  const upgradeSite = own.find(s => game.sectors[s.id].controller === p.faction && level(game.sectors[s.id], 'economy') > 0 && level(game.sectors[s.id], 'economy') < capitalLevel(game, p));
  if (upgradeSite && p.treasury >= CONFIG.buildings.economy.cost * (level(game.sectors[upgradeSite.id], 'economy') + 1) + 3) upgrade(game, p, { sectorId: upgradeSite.id, building: 'economy' });
  const site = own.find((s) => game.sectors[s.id].controller === p.faction && game.sectors[s.id].buildings.length < s.buildSlots && !game.sectors[s.id].buildings.includes('economy'));
  if (site && p.treasury >= 6) build(game, p, { sectorId: site.id, building: 'economy' });
}

function factionStats(game, faction) {
  let sectors = 0, army = 0, income = 0, upkeep = 0;
  for (const [id, state] of Object.entries(game.sectors)) if (state.controller === faction) {
    sectors++; army += state.troops; income += BOARD.sectors.get(id).economicValue;
    for (const building of state.buildings) income += (CONFIG.buildings[building]?.incomeBonus || 0) * level(state, building);
    for (const [type, count] of Object.entries(units(state))) upkeep += (CONFIG.units[type]?.upkeep || 0) * count;
  }
  return { sectors, army, income, upkeep };
}

const STATIC_BOARD = { size: BOARD.size, outline: BOARD.outline, roads: BOARD.roads, moervaart: BOARD.moervaart, schelde: BOARD.schelde,
  factions: FACTIONS, terrains: TERRAINS, sectors: [...BOARD.sectors.values()].map((s) => ({ id: s.id, name: s.name,
    factionHome: s.factionHome, terrain: s.terrain, buildSlots: s.buildSlots, economicValue: s.economicValue,
    isCapital: s.isCapital, isStrategic: s.isStrategic, seed: s.seed, label: s.label, polygon: s.polygon, connections: s.connections })) };

function serialize(game, requesterId, connected) {
  prepare(game);
  const turn = game.gameOver ? null : currentPlayer(game);
  return { kind: game.gameKey, board: STATIC_BOARD, config: { units: CONFIG.units, buildings: CONFIG.buildings, taxPolicies: CONFIG.taxPolicies, maxBuildingLevel: CONFIG.maxBuildingLevel, capitalUpgradeCost: CONFIG.capitalUpgradeCost, cards: CONFIG.cards },
    rulesVersion: game.rulesVersion, battle: game.battle, lastBattle: game.lastBattle, sectors: game.sectors, round: game.round, turnPlayerId: turn?.id || null, canEndTurn: Boolean(turn && turn.id === requesterId && !turn.isNpc),
    gameOver: game.gameOver, resultText: game.resultText, winnerId: game.winnerId,
    players: game.players.map((p) => {
      const stats = factionStats(game, p.faction), own = p.id === requesterId;
      if (!own) { delete stats.income; delete stats.upkeep; }
      const { taxPolicy, cards, earnedCardThisTurn, ...publicPlayer } = p;
      return { ...publicPlayer, ...stats, ...(own ? { taxPolicy, cards, earnedCardThisTurn } : {}), capitalLevel: capitalLevel(game, p), isYou: own,
        connected: p.isNpc || Boolean(connected?.get?.(p.id)) };
    }), log: game.log.filter(line => typeof line === 'string' ? !/ ontvangt .* goud en betaalt |belastingen vanaf/.test(line) : line.playerId === requesterId)
      .slice(0, 20).map(line => typeof line === 'string' ? line : line.text) };

}

function results(game) { return game.players.map((p) => ({ player: p, ...factionStats(game, p.faction) }))
  .sort((a, b) => b.sectors - a.sectors || b.player.treasury - a.player.treasury)
  .map((e, i) => ({ playerId: e.player.id, placement: i + 1, score: e.sectors, won: game.winnerId === e.player.id,
    outcome: game.winnerId === e.player.id ? 'Wint' : 'Verliest' })); }

module.exports = { createGame, handleAction, serialize, tick, results, normalizeRoomOptions, normalizePlayerRoomOptions, BOARD, CONFIG,
  isConnected: (a, b, kinds) => isConnected(BOARD, a, b, kinds), landNeighbors: (id) => landNeighbors(BOARD, id) };
