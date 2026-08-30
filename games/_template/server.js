function createGame(roomPlayers) {
  const game = {
    gameKey: '_template',
    players: roomPlayers.map((player) => ({
      id:player.id, name:player.name, isNpc:player.isNpc, score:0
    })),
    turnIndex:0, gameOver:false, resultText:'', log:[], nextNpcAt:0
  };
  scheduleNpc(game);
  return game;
}

function currentPlayer(game) { return game.players[game.turnIndex]; }

function scorePoint(game) {
  const player=currentPlayer(game);
  player.score+=1;
  game.log.unshift(`${player.name} scoort een punt.`);
  if (player.score >= 10) {
    game.gameOver=true;
    game.resultText=`${player.name} wint met 10 punten.`;
    game.nextNpcAt=0;
    return;
  }
  game.turnIndex=(game.turnIndex+1)%game.players.length;
  scheduleNpc(game);
}

function handleAction(game, playerId, action) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  const player=currentPlayer(game);
  if (!player || player.id !== playerId || player.isNpc) throw new Error('Je bent niet aan de beurt.');
  if (action !== 'score') throw new Error('Onbekende actie.');
  scorePoint(game);
}

function scheduleNpc(game, delay=700) {
  game.nextNpcAt=!game.gameOver && currentPlayer(game)?.isNpc ? Date.now()+delay : 0;
}

function tick(game, now=Date.now()) {
  if (game.gameOver || !currentPlayer(game)?.isNpc) return false;
  if (!game.nextNpcAt) game.nextNpcAt=now+700;
  if (now < game.nextNpcAt) return false;
  scorePoint(game);
  return true;
}

function serialize(game, requesterId, connected) {
  return {
    kind:game.gameKey, gameOver:game.gameOver, resultText:game.resultText,
    turnPlayerId:game.gameOver ? null : currentPlayer(game)?.id,
    players:game.players.map((player) => ({
      ...player, connected:player.isNpc || connected.get(player.id)
    })),
    canScore:!game.gameOver && currentPlayer(game)?.id===requesterId,
    log:game.log.slice(0,20)
  };
}

function results(game) {
  const high=Math.max(...game.players.map((player) => player.score));
  const leaders=game.players.filter((player) => player.score===high);
  return game.players.map((player) => ({
    playerId:player.id,
    placement:player.score===high ? 1 : 2,
    score:player.score,
    won:leaders.length===1 && leaders[0].id===player.id,
    outcome:player.score===high ? (leaders.length===1 ? 'Wint' : 'Gelijkspel') : 'Verliest'
  }));
}

module.exports={createGame,handleAction,serialize,tick,results};
