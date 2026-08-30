export function render(api){api.renderBuiltin('cluedo',api.room,api.game)}
export function metric({player}){return {text:player.canAccuse?`${player.handCount} kaarten`:'uit',score:null}}
export function presentResult({game}){const winner=game.players.find(p=>p.id===game.winnerId);return {title:winner?.name||'Winnaar',copy:'is de winnaar.'}}
export function isWinner({game,myId}){return game.winnerId===myId}
