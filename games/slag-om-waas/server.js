'use strict';

/**
 * Total Waas — server-authoritatieve spelstate (Fase 1: het bord).
 *
 * Fase 1 bevat: facties, sectoren, eigenaarschap, adjacency en een
 * eenvoudige beurtstructuur. Beweging, gevechten, economie, draagvlak en
 * overwinning volgen in latere fases (zie GAME_SPEC.md).
 */

const { CONFIG } = require('./config');
const { FACTIONS, PLAYABLE_FACTIONS, TERRAINS, buildBoard, isConnected, landNeighbors } = require('./board');

const BOARD = buildBoard();

function createGame(roomPlayers) {
  const players = roomPlayers.slice(0, PLAYABLE_FACTIONS.length).map((player, index) => ({
    id: player.id, name: player.name, isNpc: Boolean(player.isNpc),
    faction: PLAYABLE_FACTIONS[index],
    treasury: CONFIG.startTreasury,
    support: CONFIG.startSupport
  }));
  const activeFactions = new Set(players.map((p) => p.faction));
  const sectors = {};
  for (const sector of BOARD.sectors.values()) {
    const home = sector.factionHome;
    const controller = home !== 'center' && activeFactions.has(home) ? home : null;
    sectors[sector.id] = {
      // Niet-gekozen facties en de Sint-Niklaas-regio blijven neutraal: rebellen houden die provincies bezet.
      controller,
      troops: sector.id === 'center_sint_niklaas' ? CONFIG.neutralGarrison : controller ? 0 : CONFIG.rebelGarrison,
      buildings: []
    };
  }
  const game = {
    gameKey: 'slag-om-waas',
    players, sectors,
    round: 1, turnIndex: 0,
    gameOver: false, resultText: '', winnerId: null,
    log: ['Het Land van Waas ligt klaar. Sint-Niklaas wacht neutraal in het midden.'],
    nextNpcAt: 0
  };
  scheduleNpc(game);
  return game;
}

function currentPlayer(game) { return game.players[game.turnIndex]; }

function endTurn(game) {
  const player = currentPlayer(game);
  game.log.unshift(`${player.name} (${FACTIONS[player.faction].name}) beëindigt de beurt.`);
  game.turnIndex = (game.turnIndex + 1) % game.players.length;
  if (game.turnIndex === 0) {
    game.round += 1;
    game.log.unshift(`Ronde ${game.round} begint.`);
  }
  game.log = game.log.slice(0, 40);
  scheduleNpc(game);
}

function handleAction(game, playerId, action) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  const player = currentPlayer(game);
  if (!player || player.id !== playerId || player.isNpc) throw new Error('Je bent niet aan de beurt.');
  if (action === 'endTurn') { endTurn(game); return; }
  throw new Error('Onbekende actie.');
}

function scheduleNpc(game) {
  game.nextNpcAt = !game.gameOver && currentPlayer(game)?.isNpc ? Date.now() + CONFIG.npcTurnDelayMs : 0;
}

function tick(game, now = Date.now()) {
  if (game.gameOver || !currentPlayer(game)?.isNpc) return false;
  if (!game.nextNpcAt) game.nextNpcAt = now + CONFIG.npcTurnDelayMs;
  if (now < game.nextNpcAt) return false;
  endTurn(game); // TODO Fase 2+: eenvoudige AI-beurt
  return true;
}

function factionStats(game, factionId) {
  let sectors = 0, army = 0, income = 0;
  for (const [id, state] of Object.entries(game.sectors)) {
    if (state.controller !== factionId) continue;
    sectors += 1; army += state.troops; income += BOARD.sectors.get(id).economicValue;
  }
  return { sectors, army, income };
}

// Statisch bord; wordt per serialize meegestuurd zodat de client geen eigen kopie van de data hoeft te hebben.
const STATIC_BOARD = {
  size: BOARD.size, outline: BOARD.outline, roads: BOARD.roads, moervaart: BOARD.moervaart, schelde: BOARD.schelde,
  factions: FACTIONS, terrains: TERRAINS,
  sectors: [...BOARD.sectors.values()].map((s) => ({
    id: s.id, name: s.name, factionHome: s.factionHome, terrain: s.terrain,
    buildSlots: s.buildSlots, economicValue: s.economicValue,
    isCapital: s.isCapital, isStrategic: s.isStrategic,
    seed: s.seed, label: s.label, polygon: s.polygon, connections: s.connections
  }))
};

function serialize(game, requesterId, connected) {
  const turn = game.gameOver ? null : currentPlayer(game);
  return {
    kind: game.gameKey,
    board: STATIC_BOARD,
    config: { neutralGarrison: CONFIG.neutralGarrison, rebelGarrison: CONFIG.rebelGarrison },
    sectors: game.sectors,
    round: game.round,
    turnPlayerId: turn?.id || null,
    canEndTurn: Boolean(turn && turn.id === requesterId && !turn.isNpc),
    gameOver: game.gameOver, resultText: game.resultText, winnerId: game.winnerId,
    players: game.players.map((p) => ({
      id: p.id, name: p.name, isNpc: p.isNpc, faction: p.faction,
      treasury: p.treasury, support: p.support,
      ...factionStats(game, p.faction),
      isYou: p.id === requesterId,
      connected: p.isNpc || Boolean(connected?.get?.(p.id))
    })),
    log: game.log.slice(0, 20)
  };
}

function results(game) {
  const ranked = game.players
    .map((p) => ({ player: p, ...factionStats(game, p.faction) }))
    .sort((a, b) => b.sectors - a.sectors || b.player.treasury - a.player.treasury);
  return ranked.map((entry, index) => ({
    playerId: entry.player.id,
    placement: index + 1,
    score: entry.sectors,
    won: game.winnerId === entry.player.id,
    outcome: game.winnerId === entry.player.id ? 'Wint' : 'Verliest'
  }));
}

module.exports = {
  createGame, handleAction, serialize, tick, results,
  // Hulpfuncties voor tests en latere fases
  BOARD, CONFIG, isConnected: (a, b, kinds) => isConnected(BOARD, a, b, kinds), landNeighbors: (id) => landNeighbors(BOARD, id)
};
