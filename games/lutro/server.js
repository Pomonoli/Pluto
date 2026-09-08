'use strict';

/** Lutro — turn-based Ludo movement with an economy and castle warfare. */

const PATH_LENGTH = 52;
const TRACK_STEPS = 51;
const HOME_STEPS = 6;
const FINISH_PROGRESS = TRACK_STEPS + HOME_STEPS - 1;
const CASTLE_MAX_HP = 100;
const COINS_PER_PIP = 10;
const CENTER_DAMAGE = 25;
const NPC_DELAY_MS = 650;

const CAMPS = [
  { key: 'red', name: 'Sauron', color: '#b83a2f', startIndex: 0 },
  { key: 'green', name: 'Elven', color: '#4e9363', startIndex: 13 },
  { key: 'yellow', name: 'Dwergen', color: '#c79a32', startIndex: 26 },
  { key: 'blue', name: 'Mensen', color: '#557b9f', startIndex: 39 }
];
const ATTACK_SITES = [[0, 9], [13, 22], [26, 35], [39, 48]];

const UNIT_TYPES = {
  normal: { label: 'Soldaat', cost: 20, damage: 10, maxHp: 10, speed: 10, march: 2, castleDamageOnDefeat: 10 },
  fast: { label: 'Snelle soldaat', cost: 60, damage: 5, maxHp: 5, speed: 20, march: 4, castleDamageOnDefeat: 15 },
  strong: { label: 'Sterke soldaat', cost: 40, damage: 15, maxHp: 15, speed: 5, march: 1, castleDamageOnDefeat: 15 },
  hero: { label: 'Held', cost: 100, damage: 20, maxHp: 20, speed: 20, march: 3, castleDamageOnDefeat: 25 }
};
const UNIT_ORDER = ['normal', 'fast', 'strong', 'hero'];
const FACTION_UNITS = [
  { normal: 'Orc', fast: 'Nazgûl', strong: 'Trol', hero: 'Sauron' },
  { normal: 'Elf met boog', fast: 'Adelaar', strong: 'Elf met zwaard', hero: 'Legolas' },
  { normal: 'Lonely Mountain-dwerg', fast: 'Dwerg op pony', strong: 'Iron Hills-dwerg', hero: 'Gimli' },
  { normal: 'Minas Tirith-soldaat', fast: 'Rohirrim', strong: 'Númenóreaan', hero: 'Aragorn' }
];
const HEROES = [
  { name: 'Sauron', ability: 'De Ene Ring', description: 'Overleeft één dodelijke treffer met 1 HP.' },
  { name: 'Legolas', ability: 'Elvenboog', description: 'Zijn unieke kasteelvaardigheid wordt later toegevoegd.' },
  { name: 'Gimli', ability: 'Mithrilpantser', description: 'Ontvangt 5 minder schade van andere troepen.' },
  { name: 'Aragorn', ability: 'Athelas', description: 'Herstelt 5 HP nadat hij een gevecht overleeft.' }
];

function normalizeRoomOptions(options = {}) {
  const startingFaction = CAMPS.some((camp) => camp.key === options.startingFaction) ? options.startingFaction : 'red';
  return { startingFaction };
}

function rollDie() { return 1 + Math.floor(Math.random() * 6); }
function cyclicDistance(a, b, length = PATH_LENGTH) {
  const distance = Math.abs(a - b);
  return Math.min(distance, length - distance);
}
function currentPlayer(game) { return game.players[game.turnIndex] || null; }
function campFor(player) { return CAMPS[player.seat]; }
function absolutePathIndex(player, progress) { return (campFor(player).startIndex + progress) % PATH_LENGTH; }
function pawnZone(pawn) {
  if (pawn.progress < 0) return 'yard';
  if (pawn.progress < TRACK_STEPS) return 'track';
  if (pawn.progress < FINISH_PROGRESS) return 'home';
  return 'finished';
}
function movementSteps(_pawn, roll) { return roll; }
function automaticSteps(pawn) { return UNIT_TYPES[pawn.type].march; }
function canMovePawn(pawn, roll) {
  if (pawn.progress < 0 || pawn.progress === FINISH_PROGRESS) return false;
  return pawn.progress + movementSteps(pawn, roll) <= FINISH_PROGRESS;
}
function movablePawns(player, roll) { return player.pawns.filter((pawn) => canMovePawn(pawn, roll)); }
function activePlayers(game) { return game.players.filter((player) => !player.eliminated); }
function addLog(game, text) {
  game.log.unshift(text);
  if (game.log.length > 50) game.log.length = 50;
}

function createPawn(playerId, seat, type, index) {
  const stats = UNIT_TYPES[type];
  return {
    id: `${playerId}-${type}-${index + 1}`,
    number: index + 1,
    type,
    progress: -1,
    hp: 0,
    ringUsed: false,
    attackedSites: [],
    hero: type === 'hero' ? HEROES[seat] : null,
    ...stats,
    label: FACTION_UNITS[seat][type]
  };
}

function createGame(roomPlayers, options = {}) {
  const { startingFaction } = normalizeRoomOptions(options);
  const startingSeat = CAMPS.findIndex((camp) => camp.key === startingFaction);
  const seatOrder = CAMPS.map((_, offset) => (startingSeat + offset) % CAMPS.length);
  const players = roomPlayers.slice(0, 4).map((rp, playerIndex) => {
    const seat = seatOrder[playerIndex];
    return ({
    id: rp.id,
    name: rp.name,
    isNpc: Boolean(rp.isNpc),
    seat,
    camp: CAMPS[seat].key,
    coins: 0,
    castleHp: CASTLE_MAX_HP,
    eliminated: false,
    pawns: UNIT_ORDER.map((type, index) => createPawn(rp.id, seat, type, index))
    });
  });
  const game = {
    gameKey: 'lutro', players, turnIndex: 0, phase: 'roll', lastRoll: null,
    lastCoinGain: 0, gameOver: false, winnerId: null, resultText: '', nextNpcAt: 0, log: []
  };
  addLog(game, `${players[0]?.name || 'De eerste speler'} begint voor ${CAMPS[players[0]?.seat || 0].name}.`);
  scheduleNpc(game, 500);
  return game;
}

function scheduleNpc(game, delay = NPC_DELAY_MS) {
  game.nextNpcAt = !game.gameOver && currentPlayer(game)?.isNpc ? Date.now() + delay : 0;
}
function advanceTurn(game) {
  if (game.gameOver) return;
  game.phase = 'roll';
  game.lastRoll = null;
  game.lastCoinGain = 0;
  if (!activePlayers(game).length) return endGame(game, null);
  let guard = 0;
  do {
    game.turnIndex = (game.turnIndex + 1) % game.players.length;
    guard += 1;
  } while (currentPlayer(game)?.eliminated && guard <= game.players.length);
  scheduleNpc(game);
}

function applyRoll(game, player) {
  if (game.phase !== 'roll') throw new Error('Kies eerst een actie voor je huidige worp.');
  const roll = rollDie();
  const income = roll * COINS_PER_PIP;
  player.coins += income;
  game.lastRoll = roll;
  game.lastCoinGain = income;
  game.phase = 'action';
  addLog(game, `${player.name} gooit ${roll} en verdient ${income} coins.`);
  marchTroops(game, player);
  if (game.gameOver) return roll;
  if (player.eliminated) {
    advanceTurn(game);
    return roll;
  }
  scheduleNpc(game);
  return roll;
}

function applyBuy(game, player, type) {
  if (game.phase !== 'action') throw new Error('Rol eerst de dobbelsteen.');
  const stats = UNIT_TYPES[type];
  if (!stats) throw new Error('Onbekende troepensoort.');
  const pawn = player.pawns.find((item) => item.type === type && item.progress < 0);
  if (!pawn) throw new Error('Deze troep is al ingezet.');
  if (player.coins < stats.cost) throw new Error('Onvoldoende coins.');
  player.coins -= stats.cost;
  pawn.progress = 0;
  pawn.hp = stats.maxHp;
  pawn.ringUsed = false;
  addLog(game, `${player.name} zet ${type === 'hero' ? pawn.hero.name : stats.label.toLowerCase()} in voor ${stats.cost} coins.`);
  advanceTurn(game);
}

function damageUnit(pawn, amount) {
  let damage = amount;
  if (pawn.type === 'hero' && pawn.hero?.ability === 'Mithrilpantser') damage = Math.max(0, damage - 5);
  pawn.hp -= damage;
  if (pawn.hp > 0) return { defeated: false, damage };
  if (pawn.type === 'hero' && pawn.hero?.ability === 'De Ene Ring' && !pawn.ringUsed) {
    pawn.ringUsed = true;
    pawn.hp = 1;
    return { defeated: false, damage, ringSaved: true };
  }
  pawn.hp = 0;
  pawn.progress = -1;
  return { defeated: true, damage };
}

function damageCastle(game, player, amount, reason) {
  if (player.eliminated) return;
  player.castleHp = Math.max(0, player.castleHp - amount);
  addLog(game, `${player.name} krijgt ${amount} kasteelschade${reason ? ` ${reason}` : ''}.`);
  if (player.castleHp === 0) {
    player.eliminated = true;
    player.pawns.forEach((pawn) => { pawn.progress = -1; pawn.hp = 0; });
    addLog(game, `Het kasteel van ${player.name} is gevallen.`);
  }
}

function resolveCombat(game, attackerPlayer, attacker) {
  if (attacker.progress < 0 || attacker.progress >= TRACK_STEPS) return;
  const pathIndex = absolutePathIndex(attackerPlayer, attacker.progress);
  const defenderPlayer = game.players.find((player) => player.id !== attackerPlayer.id && !player.eliminated && player.pawns.some((pawn) => pawn.progress >= 0 && pawn.progress < TRACK_STEPS && absolutePathIndex(player, pawn.progress) === pathIndex));
  if (!defenderPlayer) return;
  const defender = defenderPlayer.pawns.find((pawn) => pawn.progress >= 0 && pawn.progress < TRACK_STEPS && absolutePathIndex(defenderPlayer, pawn.progress) === pathIndex);
  const hit = damageUnit(defender, attacker.damage);
  addLog(game, `${attackerPlayer.name} raakt ${defenderPlayer.name}s ${defender.type} voor ${hit.damage} damage.`);
  if (hit.ringSaved) addLog(game, `${defender.hero.name} wordt door De Ene Ring gered.`);
  if (hit.defeated) {
    damageCastle(game, defenderPlayer, defender.castleDamageOnDefeat, `door het verlies van ${defender.type === 'hero' ? defender.hero.name : defender.label.toLowerCase()}`);
    if (attacker.type === 'hero' && attacker.hero?.ability === 'Athelas') attacker.hp = Math.min(attacker.maxHp, attacker.hp + 5);
    return;
  }
  const counter = damageUnit(attacker, defender.damage);
  addLog(game, `${defenderPlayer.name} slaat terug voor ${counter.damage} damage.`);
  if (counter.ringSaved) addLog(game, `${attacker.hero.name} wordt door De Ene Ring gered.`);
  if (counter.defeated) damageCastle(game, attackerPlayer, attacker.castleDamageOnDefeat, `door het verlies van ${attacker.type === 'hero' ? attacker.hero.name : attacker.label.toLowerCase()}`);
  else if (attacker.type === 'hero' && attacker.hero?.ability === 'Athelas') attacker.hp = Math.min(attacker.maxHp, attacker.hp + 5);
}

function reachCenter(game, player, pawn) {
  pawn.progress = FINISH_PROGRESS;
  pawn.hp = Math.max(1, pawn.hp);
  game.players.filter((opponent) => opponent.id !== player.id && !opponent.eliminated)
    .forEach((opponent) => damageCastle(game, opponent, CENTER_DAMAGE, 'door een aanval vanuit het midden'));
  addLog(game, `${player.name}s ${pawn.type === 'hero' ? pawn.hero.name : pawn.label.toLowerCase()} bereikt het midden.`);
}

function movePawn(game, player, pawn, steps, description) {
  pawn.progress += steps;
  addLog(game, `${player.name}s ${pawn.type === 'hero' ? pawn.hero.name : pawn.label.toLowerCase()} ${description} ${steps} vakken.`);
  if (pawn.progress === FINISH_PROGRESS) reachCenter(game, player, pawn);
  else resolveCombat(game, player, pawn);
  checkWin(game);
}

function marchTroops(game, player) {
  const deployed = player.pawns.filter((pawn) => pawn.progress >= 0 && pawn.progress < FINISH_PROGRESS);
  deployed.forEach((pawn) => {
    if (game.gameOver || pawn.progress < 0) return;
    const steps = automaticSteps(pawn);
    if (pawn.progress + steps <= FINISH_PROGRESS) movePawn(game, player, pawn, steps, 'marcheert automatisch');
  });
}

function applyMove(game, player, pawnId) {
  if (game.phase !== 'action' || !game.lastRoll) throw new Error('Rol eerst de dobbelsteen.');
  const pawn = player.pawns.find((item) => item.id === pawnId);
  if (!pawn || !canMovePawn(pawn, game.lastRoll)) throw new Error('Deze troep kan niet met de huidige worp bewegen.');
  const steps = movementSteps(pawn, game.lastRoll);
  movePawn(game, player, pawn, steps, 'gebruikt de worp en beweegt nog');
  advanceTurn(game);
}

function attackOptions(game, player) {
  const options = [];
  player.pawns.forEach((pawn) => {
    if (pawn.progress < 0 || pawn.progress >= TRACK_STEPS) return;
    const pathIndex = absolutePathIndex(player, pawn.progress);
    game.players.forEach((target) => {
      if (target.id === player.id || target.eliminated) return;
      const sites = ATTACK_SITES[target.seat] || [];
      const extraRange = pawn.type === 'hero' && pawn.hero?.ability === 'Elvenboog' ? 1 : 0;
      if (!sites.some((siteIndex) => cyclicDistance(pathIndex, siteIndex) <= extraRange)) return;
      const site = `${target.camp}:${pathIndex}`;
      if (!pawn.attackedSites.includes(site)) options.push({ pawnId: pawn.id, targetPlayerId: target.id, pathIndex });
    });
  });
  return options;
}

function applyCastleAttack(game, player, pawnId, targetPlayerId) {
  if (game.phase !== 'action') throw new Error('Rol eerst de dobbelsteen.');
  const legal = attackOptions(game, player).find((option) => option.pawnId === pawnId && option.targetPlayerId === targetPlayerId);
  if (!legal) throw new Error('Deze troep kan hier niet aanvallen.');
  const pawn = player.pawns.find((item) => item.id === pawnId);
  const target = game.players.find((item) => item.id === targetPlayerId);
  pawn.attackedSites.push(`${target.camp}:${legal.pathIndex}`);
  damageCastle(game, target, pawn.damage, `door ${pawn.type === 'hero' ? pawn.hero.name : pawn.label.toLowerCase()}`);
  addLog(game, `${player.name} valt vanuit de kasteelzone aan in plaats van te bewegen.`);
  checkWin(game);
  advanceTurn(game);
}

function endGame(game, winnerId) {
  game.gameOver = true;
  game.winnerId = winnerId;
  game.phase = 'finished';
  game.lastRoll = null;
  game.nextNpcAt = 0;
  game.resultText = winnerId ? `${game.players.find((player) => player.id === winnerId).name} heeft het laatste kasteel overeind en wint Lutro.` : 'Alle kastelen zijn gevallen.';
  addLog(game, game.resultText);
}
function checkWin(game) {
  const survivors = activePlayers(game);
  if (game.players.length > 1 && survivors.length <= 1) endGame(game, survivors[0]?.id || null);
}

function handleAction(game, playerId, action, payload = {}) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  const player = currentPlayer(game);
  if (!player || player.id !== playerId || player.isNpc || player.eliminated) throw new Error('Je bent niet aan de beurt.');
  if (action === 'roll') applyRoll(game, player);
  else if (action === 'buy') applyBuy(game, player, String(payload.type || ''));
  else if (action === 'move') applyMove(game, player, String(payload.pawnId || ''));
  else if (action === 'castleAttack') applyCastleAttack(game, player, String(payload.pawnId || ''), String(payload.targetPlayerId || ''));
  else if (action === 'pass' && game.phase === 'action') { addLog(game, `${player.name} past.`); advanceTurn(game); }
  else throw new Error('Onbekende actie.');
}

function chooseNpcAction(game, player) {
  const attacks = attackOptions(game, player);
  if (attacks.length) return { action: 'castleAttack', payload: attacks[0] };
  const hero = player.pawns.find((pawn) => pawn.type === 'hero' && pawn.progress < 0);
  if (hero && player.coins >= hero.cost) return { action: 'buy', payload: { type: 'hero' } };
  const movable = movablePawns(player, game.lastRoll);
  if (movable.length) return { action: 'move', payload: { pawnId: movable.slice().sort((a, b) => b.progress - a.progress)[0].id } };
  const affordable = UNIT_ORDER.map((type) => player.pawns.find((pawn) => pawn.type === type && pawn.progress < 0)).filter((pawn) => pawn && pawn.cost <= player.coins).sort((a, b) => b.cost - a.cost);
  if (affordable.length) return { action: 'buy', payload: { type: affordable[0].type } };
  return { action: 'pass', payload: {} };
}

function tick(game, now = Date.now()) {
  if (game.gameOver) return false;
  const player = currentPlayer(game);
  if (!player?.isNpc) { game.nextNpcAt = 0; return false; }
  if (!game.nextNpcAt) game.nextNpcAt = now + NPC_DELAY_MS;
  if (now < game.nextNpcAt) return false;
  if (game.phase === 'roll') applyRoll(game, player);
  else {
    const choice = chooseNpcAction(game, player);
    if (choice.action === 'buy') applyBuy(game, player, choice.payload.type);
    else if (choice.action === 'move') applyMove(game, player, choice.payload.pawnId);
    else if (choice.action === 'castleAttack') applyCastleAttack(game, player, choice.payload.pawnId, choice.payload.targetPlayerId);
    else { addLog(game, `${player.name} past.`); advanceTurn(game); }
  }
  scheduleNpc(game);
  return true;
}

function serializePawn(player, pawn) {
  const zone = pawnZone(pawn);
  return {
    id: pawn.id, number: pawn.number, type: pawn.type, label: pawn.type === 'hero' ? pawn.hero.name : pawn.label,
    progress: pawn.progress, zone, hp: pawn.hp, maxHp: pawn.maxHp, damage: pawn.damage,
    speed: pawn.speed, march: pawn.march, cost: pawn.cost, castleDamageOnDefeat: pawn.castleDamageOnDefeat,
    hero: pawn.hero, ringUsed: pawn.ringUsed,
    pathIndex: zone === 'track' ? absolutePathIndex(player, pawn.progress) : null,
    homeIndex: zone === 'home' || zone === 'finished' ? pawn.progress - TRACK_STEPS : null
  };
}

function serialize(game, requesterId, connected = new Map()) {
  const turn = currentPlayer(game);
  const mine = turn?.id === requesterId;
  const canAct = Boolean(!game.gameOver && mine && game.phase === 'action');
  return {
    kind: 'lutro', schemaVersion: 7, phase: game.phase, gameOver: game.gameOver,
    winnerId: game.winnerId, resultText: game.resultText, turnPlayerId: game.gameOver ? null : turn?.id,
    lastRoll: game.lastRoll, lastCoinGain: game.lastCoinGain,
    canRoll: Boolean(!game.gameOver && mine && game.phase === 'roll'), canAct,
    movablePawnIds: canAct ? movablePawns(turn, game.lastRoll).map((pawn) => pawn.id) : [],
    attackOptions: canAct ? attackOptions(game, turn) : [],
    players: game.players.map((player) => ({
      id: player.id, name: player.name, isNpc: player.isNpc, isYou: player.id === requesterId,
      connected: player.isNpc || Boolean(connected.get(player.id)), seat: player.seat, camp: player.camp,
      coins: player.coins, castleHp: player.castleHp, castleMaxHp: CASTLE_MAX_HP,
      eliminated: player.eliminated, pawns: player.pawns.map((pawn) => serializePawn(player, pawn))
    })),
    log: game.log.slice(0, 24)
  };
}

function playerScore(player) {
  return player.castleHp * 10 + player.coins + player.pawns.reduce((score, pawn) => score + Math.max(0, pawn.progress + 1) + pawn.hp, 0);
}
function results(game, durationMs) {
  return game.players.slice().sort((a, b) => playerScore(b) - playerScore(a)).map((player, index) => ({
    playerId: player.id, placement: index + 1, score: playerScore(player), won: game.winnerId === player.id,
    outcome: game.winnerId === player.id ? 'Wint' : `${player.castleHp}/100 kasteel-HP`, durationMs
  }));
}

module.exports = {
  createGame, handleAction, serialize, tick, results, normalizeRoomOptions,
  CAMPS, ATTACK_SITES, UNIT_TYPES, UNIT_ORDER, FACTION_UNITS, HEROES, PATH_LENGTH, TRACK_STEPS, HOME_STEPS,
  FINISH_PROGRESS, CASTLE_MAX_HP, COINS_PER_PIP, CENTER_DAMAGE,
  absolutePathIndex, pawnZone, movementSteps, automaticSteps, canMovePawn, movablePawns, attackOptions
};
