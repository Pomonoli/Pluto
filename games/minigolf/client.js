export function render(api){api.renderBuiltin('minigolf',api.room,api.game,{playerStrip:false})}
export function metric({player}){return {text:`${player.totalPoints} pt`,score:Number(player.totalPoints||0)}}
export function presentResult({game}){const high=Math.max(...game.players.map(p=>p.totalPoints)),w=game.players.filter(p=>p.totalPoints===high);return w.length===1?{title:w[0].name,copy:'is de winnaar.'}:{title:'Gelijkspel',copy:'Er is geen unieke winnaar.'}}
export function isWinner({game,myId}){const high=Math.max(...game.players.map(p=>p.totalPoints));return game.players.filter(p=>p.totalPoints===high).length===1&&game.players.find(p=>p.id===myId)?.totalPoints===high}
