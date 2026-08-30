export function render(api){api.renderBuiltin('pesten',api.room,api.game,{playerStrip:false})}
export function metric({player}){return {text:`${player.handCount} kaarten`,score:null}}
export function presentResult({game}){const winner=game.players.find(p=>p.handCount===0);return {title:winner?.name||'Winnaar',copy:'is de winnaar.'}}
export function isWinner({player}){return player?.handCount===0}
