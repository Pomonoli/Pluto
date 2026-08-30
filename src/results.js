function competitionPlacements(items, valueSelector, descending = true) {
  const values = [...new Set(items.map(valueSelector))].sort((a, b) => descending ? b - a : a - b);
  const placeByValue = new Map(values.map((value, index) => [value, index + 1]));
  return new Map(items.map((item) => [item.id, placeByValue.get(valueSelector(item))]));
}

function resultsForGame(gameKey, game, durationMs) {
  if (!game?.gameOver) return [];

  if (gameKey === 'hofslag') {
    const placements = competitionPlacements(game.players, (p) => p.score, true);
    const top = Math.max(...game.players.map((p) => p.score));
    const leaders = game.players.filter((p) => p.score === top);
    return game.players.map((p) => ({
      playerId: p.id,
      placement: placements.get(p.id),
      score: p.score,
      won: leaders.length === 1 && leaders[0].id === p.id,
      outcome: leaders.length > 1 && p.score === top ? 'Gelijkspel' : p.score === top ? 'Wint' : 'Verliest'
    }));
  }

  if (gameKey === 'blackjack') {
    return game.players.map((p) => ({
      playerId: p.id,
      placement: p.result === 'Wint' ? 1 : p.result === 'Push' ? 2 : 3,
      score: p.score,
      won: p.result === 'Wint',
      outcome: p.result
    }));
  }

  if (gameKey === 'solitaire') {
    return [{
      playerId: game.playerId,
      placement: 1,
      score: game.moves,
      won: true,
      outcome: 'Uitgespeeld',
      durationMs,
      moves: game.moves
    }];
  }

  if (gameKey === 'presidenten') {
    return game.players.map((p) => ({
      playerId: p.id,
      placement: p.place,
      score: p.place,
      won: p.place === 1,
      outcome: p.place === 1 ? 'President' : p.place === game.players.length ? 'Klootzak' : `#${p.place}`
    }));
  }

  if (gameKey === 'pesten') {
    const winner = game.players.find((p) => p.hand.length === 0);
    return game.players.map((p) => ({
      playerId: p.id,
      placement: winner?.id === p.id ? 1 : 2,
      score: p.hand.length,
      won: winner?.id === p.id,
      outcome: winner?.id === p.id ? 'Wint' : 'Verliest'
    }));
  }

  if (gameKey === 'hartenjagen') {
    const placements = competitionPlacements(game.players, (p) => p.totalScore, false);
    const low = Math.min(...game.players.map((p) => p.totalScore));
    const leaders = game.players.filter((p) => p.totalScore === low);
    return game.players.map((p) => ({
      playerId: p.id,
      placement: placements.get(p.id),
      score: p.totalScore,
      won: leaders.length === 1 && leaders[0].id === p.id,
      outcome: leaders.length > 1 && p.totalScore === low ? 'Gelijkspel' : p.totalScore === low ? 'Wint' : 'Verliest'
    }));
  }


  if (gameKey === 'minigolf') {
    const placements = competitionPlacements(game.players, (p) => p.totalPoints, true);
    const high = Math.max(...game.players.map((p) => p.totalPoints));
    const leaders = game.players.filter((p) => p.totalPoints === high);
    return game.players.map((p) => ({
      playerId: p.id,
      placement: placements.get(p.id),
      score: p.totalPoints,
      won: leaders.length === 1 && leaders[0].id === p.id,
      outcome: leaders.length > 1 && p.totalPoints === high ? 'Gelijkspel' : p.totalPoints === high ? 'Wint' : 'Verliest'
    }));
  }

  if (gameKey === 'carcassonne') {
    const placements = competitionPlacements(game.players, (p) => p.score, true);
    const high = Math.max(...game.players.map((p) => p.score));
    const leaders = game.players.filter((p) => p.score === high);
    return game.players.map((p) => ({
      playerId: p.id,
      placement: placements.get(p.id),
      score: p.score,
      won: leaders.length === 1 && leaders[0].id === p.id,
      outcome: leaders.length > 1 && p.score === high ? 'Gelijkspel' : p.score === high ? 'Wint' : 'Verliest'
    }));
  }

  if (gameKey === 'cluedo') {
    return game.players.map((p) => ({
      playerId: p.id,
      placement: game.winnerId === p.id ? 1 : 2,
      score: null,
      won: game.winnerId === p.id,
      outcome: game.winnerId === p.id ? 'Opgelost' : 'Verliest'
    }));
  }

  return game.players?.map((p) => ({
    playerId: p.id,
    placement: null,
    score: null,
    won: false,
    outcome: game.resultText || null
  })) || [];
}

module.exports = { resultsForGame, competitionPlacements };
