export function render(api){api.renderBuiltin('solitaire',api.room,api.game)}
export function metric(){return {text:'solo',score:null}}
export function presentResult({room}){const winner=room.players.find(p=>p.id===room.meId);return {title:winner?.name||'Uitgespeeld',copy:'is de winnaar.'}}
export function isWinner({game}){return Boolean(game.gameOver)}
