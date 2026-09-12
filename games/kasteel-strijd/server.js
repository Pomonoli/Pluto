'use strict';

const { randomUUID } = require('node:crypto');
const sim = require('./simulation');
const { createState, simulation, ERA_NAMES, ROLES, ROLE_DEFS, MAX_TURRETS, MAX_QUEUE, MAX_WORKERS, W } = sim;
const meta = {
  key: 'kasteel-strijd', name: 'Castle Defense',
  description: 'Train troepen, bouw torens en evolueer door zeven tijdperken in een duel tegen een speler of NPC.',
  minPlayers: 2, maxPlayers: 2, supportsNpc: true, realtime: false, solo: false
};
const SIDES = ['player', 'enemy'];
function createGame(roomPlayers, now = Date.now()) {
  if (roomPlayers.length !== 2 || roomPlayers[0].id === roomPlayers[1].id) throw new Error('Castle Defense vereist precies twee spelers.');
  return {
    gameKey: meta.key, matchId: randomUUID(),
    players: roomPlayers.map((p, i) => ({ id: p.id, name: p.name, isNpc: Boolean(p.isNpc), side: SIDES[i] })),
    startedAt: now, lastTickAt: now, nextNpcAt: 1.5,
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
const COUNTERED_BY = { melee: 'heavy', ranged: 'melee', heavy: 'ranged' };
function npcTurn(game, engine) {
  const b = game.battle;
  for (const player of game.players.filter(p => p.isNpc)) {
    const side = player.side, p = b[side];
    const foeSide = side === 'player' ? 'enemy' : 'player';
    const mine = b.units.filter(u => u.side === side && !u.dead && u.role !== 'worker');
    const theirs = b.units.filter(u => u.side === foeSide && !u.dead && u.role !== 'worker');
    const workers = b.units.filter(u => u.side === side && !u.dead && u.role === 'worker').length + p.queue.filter(r => r === 'worker').length;
    const hasHero = p.queue.includes('hero') || b.units.some(u => u.side === side && !u.dead && u.role === 'hero');
    const nextTurret = ['near', 'far', 'bonus'][p.turrets.length] || 'near';
    const ownHalf = side === 'player' ? (u) => u.x < W / 2 : (u) => u.x > W / 2;
    const nearBase = side === 'player' ? (u) => u.x < 420 : (u) => u.x > W - 420;
    const pressure = theirs.filter(nearBase).length;
    // Priority list; entries marked "save" make the NPC hold its gold instead of training when unaffordable.
    const choices = [];
    if (p.xp >= sim.evolveXp(p.era) && p.era < ERA_NAMES.length - 1) choices.push(['evolve']);
    if (theirs.filter(ownHalf).length >= 3) choices.push(['ability', 'special']);
    if (pressure >= 2 && p.turrets.length < MAX_TURRETS) choices.push(['turret', 'near']);
    if (p.castleHp < p.castleMaxHp * 0.5) choices.push(['upgrade', 'walls', true]);
    // Early workers pay for themselves quickly; keep a couple more once the base is safe.
    if (workers < Math.min(MAX_WORKERS, b.elapsed < 60 ? 2 : 4) && pressure === 0) choices.push(['train', 'worker']);
    if (pressure === 0 && p.economyLevel < 3 && b.elapsed < 90) choices.push(['upgrade', 'economy', true]);
    if (p.turrets.length < Math.min(MAX_TURRETS, 1 + Math.floor(b.elapsed / 75)) && b.elapsed > 30) choices.push(['turret', nextTurret, true]);
    if (!hasHero && b.elapsed > 45 && mine.length >= 3) choices.push(['train', 'hero', true]);
    // Counter the opponent's most common role; otherwise keep a mixed army.
    const counts = Object.fromEntries(ROLES.map(r => [r, theirs.filter(u => u.role === r).length]));
    const dominant = ROLES.reduce((a, r) => (counts[r] > counts[a] ? r : a), 'melee');
    const wanted = theirs.length ? COUNTERED_BY[dominant] : ROLES[mine.length % ROLES.length];
    if (p.queue.length < 3) choices.push(['train', wanted]);
    if (mine.length >= 5 && theirs.length >= 3) choices.push(['ability', 'rally']);
    if (b.elapsed > 20 && p.economyLevel < 4 + p.era) choices.push(['upgrade', 'economy', true]);
    if (p.queue.length < MAX_QUEUE) choices.push(['train', ROLES[(mine.length + 1) % ROLES.length]]);
    for (const [action, key, save] of choices) {
      try { engine.act(side, action, key); break; } catch {
        if (save && mine.length + p.queue.length >= 3 && pressure < 2) break;
      }
    }
  }
}
function tick(game, now = Date.now()) {
  if (game.gameOver || now <= game.lastTickAt) return false;
  // Bound catch-up after a suspended room; do not simulate hours of missed combat.
  let remaining = Math.min((now - game.lastTickAt) / 1000, 1);
  game.lastTickAt = now;
  const engine = simulation(game.battle);
  while (remaining > 0 && game.battle.running) {
    const dt = Math.min(remaining, 0.05);
    engine.update(dt); remaining -= dt;
    if (game.battle.running && game.battle.elapsed >= game.nextNpcAt) {
      npcTurn(game, engine); game.nextNpcAt = game.battle.elapsed + 1.5;
      engine.update(0);
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
  const fx = (x) => (flip ? W - x : x);
  const relSide = (s) => (s === side ? 'player' : 'enemy');
  const battle = {
    elapsed: b.elapsed, running: b.running, gold: b[side].gold, xp: b[side].xp,
    player: structuredClone(b[side]), enemy: structuredClone(b[other]),
    units: b.units.map(u => ({ ...u, target: null, side: relSide(u.side), x: fx(u.x), dir: flip ? -u.dir : u.dir })),
    effects: b.effects.map(e => ({
      ...e, side: e.side ? relSide(e.side) : undefined,
      x: e.x != null ? fx(e.x) : undefined, x1: e.x1 != null ? fx(e.x1) : undefined, x2: e.x2 != null ? fx(e.x2) : undefined
    }))
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
module.exports = { meta, createGame, handleAction, serialize, results, tick, ERA_NAMES, ROLE_DEFS };
