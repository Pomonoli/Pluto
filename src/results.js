const {competitionPlacements}=require('./result-utils');

function resultsForGame(gameKey,game,durationMs){
  if(!game?.gameOver)return [];
  const engine=require('./games').getGame(gameKey);
  const results=typeof engine?.results==='function'
    ?engine.results(game,durationMs)
    :(game.players||[]).map((player)=>({playerId:player.id,placement:null,score:null,won:false,outcome:game.resultText||null}));
  // A match is a draw when more than one player participated but there is no
  // unique winner. This also covers engines that still flag every tied leader
  // as a winner for their existing win statistic.
  const draw=results.length>1&&results.filter((result)=>result.won).length!==1;
  return results.map((result)=>({...result,draw:Boolean(result.draw)||draw}));
}

module.exports={resultsForGame,competitionPlacements};
