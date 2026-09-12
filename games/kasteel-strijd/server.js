'use strict';

const { randomUUID } = require('node:crypto');
const { createState, simulation, ERA_NAMES } = require('./simulation');
const meta = {
  key: 'kasteel-strijd', name: 'Kasteel Strijd',
  description: 'Verover de vijandelijke basis in een duel tegen een speler of NPC.',
  minPlayers: 2, maxPlayers: 2, supportsNpc: true, realtime: false, solo: false
};
const SIDES = ['player', 'enemy'];
function createGame(roomPlayers, now = Date.now()) {
  if (roomPlayers.length !== 2 || roomPlayers[0].id === roomPlayers[1].id) throw new Error('Kasteel Strijd vereist precies twee spelers.');
  return {
    gameKey: meta.key, matchId: randomUUID(),
    players: roomPlayers.map((p, i) => ({ id: p.id, name: p.name, isNpc: Boolean(p.isNpc), side: SIDES[i] })),
    startedAt: now, lastTickAt: now, nextNpcAt: 2,
    battle: createState(), gameOver: false, winnerId: null, survivedMs: 0, resultText: ''
  };
}
function finish(game) {
  if (game.battle.running || game.gameOver) return;
  game.gameOver = true;
  game.survivedMs = Math.round(game.battle.elapsed * 1000);
  const winner = game.players.find(p => p.side === game.battle.winner);
  game.winnerId = winner.id;
  game.resultText = winner.name + ' wint: de vijandelijke basis is gevallen.';
}
function handleAction(game, playerId, action, payload = {}) {
  const player = game.players.find(p => p.id === playerId && !p.isNpc);
  if (!player) throw new Error('Niet jouw spel.');
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  simulation(game.battle).act(player.side, action, payload.key);
  // Resolve direct base damage immediately, before another action can heal it.
  simulation(game.battle).update(0);
  finish(game);
}
function npcTurn(game, sim) {
  for (const player of game.players.filter(p => p.isNpc)) {
    const p = game.battle[player.side];
    const foe = game.battle[player.side === 'player' ? 'enemy' : 'player'];
    const choices = [];
    if (foe.castleHp <= foe.castleMaxHp * 0.08) choices.push(['ability', 'burst']);
    // Save for the next era once the army has a basic set of upgrades.
    if (p.attackLevel >= 3 && p.castleLevel >= 2 && p.era < ERA_NAMES.length - 1) {
      choices.push(['evolve']);
    } else {
      if (p.castleHp < p.castleMaxHp * 0.6) choices.push(['upgrade', 'castle']);
      choices.push(['upgrade', p.attackLevel <= p.defenseLevel ? 'attack' : 'defense']);
      choices.push(['upgrade', 'castle'], ['ability', 'reinforce'], ['ability', 'burst']);
    }
    for (const [action, key] of choices) {
      try { sim.act(player.side, action, key); break; } catch { /* Save until an option is affordable. */ }
    }
  }
}
function tick(game, now = Date.now()) {
  if (game.gameOver || now <= game.lastTickAt) return false;
  // Bound catch-up after a suspended room; do not simulate hours of missed combat.
  let remaining = Math.min((now - game.lastTickAt) / 1000, 1);
  game.lastTickAt = now;
  const sim = simulation(game.battle);
  while (remaining > 0 && game.battle.running) {
    const dt = Math.min(remaining, 0.05);
    sim.update(dt); remaining -= dt;
    if (game.battle.running && game.battle.elapsed >= game.nextNpcAt) {
      npcTurn(game, sim); game.nextNpcAt = game.battle.elapsed + 2;
      sim.update(0);
    }
  }
  finish(game);
  return true;
}
function serialize(game, requesterId) {
  const me = game.players.find(p => p.id === requesterId);
  const side = me?.side || 'player', other = side === 'player' ? 'enemy' : 'player';
  const b = game.battle;
  const flip = side === 'enemy';
  const battle = {
    elapsed: b.elapsed, running: b.running, gold: b[side].gold,
    player: structuredClone(b[side]), enemy: structuredClone(b[other]),
    units: b.units.map(u => ({ ...u, target: null, side: u.side === side ? 'player' : 'enemy',
      x: flip ? 1400 - u.x : u.x, guardX: flip && u.guardX != null ? 1400 - u.guardX : u.guardX, dir: flip ? -u.dir : u.dir })),
    sparks: b.sparks.map(s => ({ ...s, x: flip ? 1400 - s.x : s.x }))
  };
  return {
    kind: meta.key, matchId: game.matchId, players: game.players,
    playerId: me?.id, opponentName: game.players.find(p => p.side === other).name,
    canAct: Boolean(me && !me.isNpc && !game.gameOver), battle,
    era: b[side].era, eraName: ERA_NAMES[b[side].era],
    elapsedServerMs: Math.round(b.elapsed * 1000),
    gameOver: game.gameOver, winnerId: game.winnerId, won: Boolean(me && game.winnerId === me.id),
    survivedMs: game.survivedMs, resultText: game.resultText
  };
}
function results(game) {
  return game.players.map(p => ({
    playerId: p.id, placement: p.id === game.winnerId ? 1 : 2,
    score: Math.round(game.survivedMs / 1000), won: p.id === game.winnerId,
    outcome: game.resultText, durationMs: game.survivedMs, moves: game.battle[p.side].era
  }));
}
module.exports = { meta, createGame, handleAction, serialize, results, tick, ERA_NAMES };
