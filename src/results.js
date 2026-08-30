const {competitionPlacements}=require('./result-utils');

function resultsForGame(gameKey,game,durationMs){
  if(!game?.gameOver)return [];
  const engine=require('./games').getGame(gameKey);
  if(typeof engine?.results==='function')return engine.results(game,durationMs);
  return (game.players||[]).map((player)=>({playerId:player.id,placement:null,score:null,won:false,outcome:game.resultText||null}));
}

module.exports={resultsForGame,competitionPlacements};
