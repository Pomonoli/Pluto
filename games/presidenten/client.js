export function render(api){api.renderBuiltin('presidenten',api.room,api.game,{playerStrip:false})}
export function metric({player}){return {text:player.place?`#${player.place}`:`${player.handCount} kaarten`,score:null}}
export function presentResult({game}){const winner=game.players.find(p=>p.place===1);return {title:winner?.name||'President',copy:'is de winnaar.'}}
export function isWinner({player}){return player?.place===1}
