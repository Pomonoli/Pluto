export function render(api){api.renderBuiltin('carcassonne',api.room,api.game,{playerStrip:false})}
export function metric({player}){return {text:`${player.score} pt · ${player.meeples} horigen`,score:Number(player.score||0)}}
export function presentResult({game}){const high=Math.max(...game.players.map(p=>p.score)),w=game.players.filter(p=>p.score===high);return w.length===1?{title:w[0].name,copy:'is de winnaar.'}:{title:'Gelijkspel',copy:'Er is geen unieke winnaar.'}}
export function isWinner({game,myId}){const high=Math.max(...game.players.map(p=>p.score));return game.players.filter(p=>p.score===high).length===1&&game.players.find(p=>p.id===myId)?.score===high}
