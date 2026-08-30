export function render(api){api.renderBuiltin('hartenjagen',api.room,api.game)}
export function metric({player}){return {text:String(player.totalScore),score:Number(player.totalScore||0)}}
export function presentResult({game}){const low=Math.min(...game.players.map(p=>p.totalScore)),w=game.players.filter(p=>p.totalScore===low);return w.length===1?{title:w[0].name,copy:'is de winnaar.'}:{title:'Gelijkspel',copy:'Er is geen unieke winnaar.'}}
export function isWinner({game,myId}){const low=Math.min(...game.players.map(p=>p.totalScore));return game.players.filter(p=>p.totalScore===low).length===1&&game.players.find(p=>p.id===myId)?.totalScore===low}
