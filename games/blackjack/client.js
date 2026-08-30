export function render(api){api.renderBuiltin('blackjack',api.room,api.game,{playerStrip:false})}
export function metric({player}){return {text:player.result||`${player.value??''}`,score:null}}
export function isWinner({player}){return player?.result==='Wint'}
