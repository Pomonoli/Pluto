export function render({room,game,els,E,action,titlebar,logBox}) {
  const turn=game.players.find((player) => player.id===game.turnPlayerId);
  els.gameStage.append(titlebar('Mijn spel',game.gameOver?'Spel afgelopen.':`${turn?.name||''} is aan de beurt.`));
  const board=E('div','template-game-board');
  game.players.forEach((player) => {
    const row=E('div',`template-player ${player.id===game.turnPlayerId?'active':''}`);
    row.append(E('strong','',player.name),E('b','',String(player.score)));
    board.append(row);
  });
  if (game.canScore) {
    const button=E('button','primary','Scoor punt');
    button.onclick=()=>action('score');
    board.append(button);
  }
  els.gameStage.append(board,logBox(game.log));
}

export function metric({player}) {
  return {text:`${player.score} pt`,score:Number(player.score||0)};
}

export function isWinner({game,myId}) {
  const high=Math.max(...game.players.map((player) => player.score));
  return game.players.filter((player) => player.score===high).length===1 && game.players.find((player) => player.id===myId)?.score===high;
}
