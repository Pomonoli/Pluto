'use strict';

/**
 * Kasteel Strijd — serverzijde.
 *
 * Het gevecht zelf is een real-time canvas-simulatie (60 fps, tientallen
 * eenheden) en draait in de browser (zie engine.js). De server bewaart wat
 * voor Pluto telt: wanneer het potje startte, welk tijdperk bereikt is en
 * het eindresultaat. De overlevingstijd wordt begrensd door de werkelijk
 * verstreken tijd sinds de start, zodat een client geen score kan opgeven
 * die langer is dan het potje zelf.
 */

const ERA_NAMES = ['Prehistorie', 'Oude Nabije Oosten', 'Klassieke Oudheid', 'Middeleeuwen', 'Vroegmoderne Tijd', 'Moderne Tijd', 'Hedendaagse Tijd'];
const MAX_ERA = ERA_NAMES.length - 1;
// Kleine speling voor netwerklatentie en frametiming bij de eindmelding.
const FINISH_SLACK_MS = 1500;

const meta = {
  key: 'kasteel-strijd', name: 'Kasteel Strijd',
  description: 'Verdedig je basis en evolueer door zeven tijdperken.',
  minPlayers: 1, maxPlayers: 1, supportsNpc: false, realtime: false, solo: true
};

function newMatchId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createGame(roomPlayers, now = Date.now()) {
  return {
    gameKey: meta.key,
    matchId: newMatchId(),
    playerId: roomPlayers[0].id,
    startedAt: now,
    era: 0,
    gameOver: false,
    won: false,
    survivedMs: 0,
    finishedAt: null,
    resultText: ''
  };
}

function fmtTime(ms) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function parseEra(value) {
  const era = Number(value);
  if (!Number.isInteger(era) || era < 0 || era > MAX_ERA) throw new Error('Ongeldig tijdperk.');
  return era;
}

function handleAction(game, playerId, action, payload = {}, now = Date.now()) {
  if (playerId !== game.playerId) throw new Error('Niet jouw spel.');

  if (action === 'restart') {
    Object.assign(game, createGame([{ id: game.playerId }], now));
    return;
  }
  if (game.gameOver) throw new Error('Het spel is afgelopen.');

  if (action === 'evolve') {
    const era = parseEra(payload.era);
    if (era < game.era) throw new Error('Een tijdperk kan niet terug.');
    if (era > game.era + 1) throw new Error('Tijdperken worden één voor één bereikt.');
    game.era = era;
    return;
  }

  if (action === 'finish') {
    const era = parseEra(payload.era);
    if (era < game.era || era > game.era + 1) throw new Error('Ongeldig tijdperk.');
    const wall = Math.max(0, now - game.startedAt);
    const claimed = Number(payload.elapsedMs);
    const elapsed = Number.isFinite(claimed) && claimed >= 0 ? claimed : wall;
    game.era = era;
    game.survivedMs = Math.round(Math.min(elapsed, wall + FINISH_SLACK_MS));
    game.won = Boolean(payload.won);
    game.finishedAt = now;
    game.gameOver = true;
    game.resultText = game.won
      ? `Vijand verslagen in de ${ERA_NAMES[game.era]} na ${fmtTime(game.survivedMs)}.`
      : `Basis gevallen in de ${ERA_NAMES[game.era]} na ${fmtTime(game.survivedMs)}.`;
    return;
  }

  throw new Error('Onbekende actie.');
}

function serialize(game, requesterId, connected, now = Date.now()) {
  return {
    kind: game.gameKey,
    matchId: game.matchId,
    playerId: game.playerId,
    startedAt: game.startedAt,
    elapsedServerMs: game.gameOver ? game.survivedMs : Math.max(0, now - game.startedAt),
    era: game.era,
    eraName: ERA_NAMES[game.era],
    gameOver: game.gameOver,
    won: game.won,
    survivedMs: game.survivedMs,
    resultText: game.resultText
  };
}

function results(game) {
  return [{
    playerId: game.playerId,
    placement: 1,
    score: Math.round(game.survivedMs / 1000),
    won: game.won,
    outcome: game.resultText,
    durationMs: game.survivedMs,
    moves: game.era
  }];
}

module.exports = { meta, createGame, handleAction, serialize, results, ERA_NAMES, MAX_ERA, FINISH_SLACK_MS };
