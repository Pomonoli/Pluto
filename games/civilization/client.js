const ICONS={military:'🛡️',economy:'💰',culture:'🏛️',wonder:'✨'};
const ACCENTS=['#B8895A','#C9A961','#9C4A55','#3E8067','#7A8062','#3E9BC9','#9D6FEF'];

export function render(api){renderCivilization(api)}
function renderCivilization({game,state,els,E,action,titlebar,logBox,sound}) {
  const you=game.players.find((player)=>player.isYou);
  const opponent=game.players.find((player)=>!player.isYou);
  if(!you||!opponent)return;

  const status=game.gameOver?'Spel afgelopen.':game.phase==='wave'
    ?`Tijdperk ${game.age}/${game.totalAges} · aanval`
    :you.acted?`Tijdperk ${game.age}/${game.totalAges} · wachten`:`Tijdperk ${game.age}/${game.totalAges} · kies een kaart`;
  const root=E('div','civ-root');
  root.style.setProperty('--civ-accent',ACCENTS[(game.age-1)%ACCENTS.length]);
  root.append(renderMonument(E,game),renderEraBanner(E,game),renderStats(E,you,true),renderStats(E,opponent,false),renderGrid(E,you,'Jouw stad'));

  if(game.phase==='draft'){
    if(!you.acted&&game.yourHand.length)root.append(renderDraft(E,action,sound,state,game,you));
    else root.append(E('div','civ-waiting',`Wachten op ${opponent.name}…`));
  } else if(game.phase==='wave') root.append(renderWave(E,game,you,opponent));
  else root.append(renderGameOver(E,game,you,opponent));

  els.gameStage.append(titlebar('Age of Civilization',status),root,logBox(game.log||[]));
}

function renderMonument(E,game){
  const wrap=E('div','civ-monument');
  for(let age=1;age<=game.totalAges;age++)wrap.append(E('div',`civ-tablet${age<game.age?' done':age===game.age?' current':''}`,String(age)));
  return wrap;
}
function renderEraBanner(E,game){const wrap=E('div','civ-era-banner');wrap.append(E('div','civ-era-num',`TIJDPERK ${game.age} / ${game.totalAges}`),E('div','civ-era-name',game.eraName));return wrap;}
function renderStats(E,player,isYou){
  const wrap=E('div',`civ-stats-row ${isYou?'civ-you':'civ-opp'}`);
  wrap.append(E('div','civ-stat-name',`${isYou?'Jij · ':''}${player.name}${player.connected===false?' (offline)':''}`));
  const boxes=E('div','civ-stat-boxes');
  for(const [label,value] of [['Goud',player.gold],['Power',player.power],['VP',player.vp]])boxes.append(statBox(E,label,value));
  const hp=statBox(E,'Toren',player.hp),track=E('div','civ-hp-track'),fill=E('div','civ-hp-fill');fill.style.width=`${Math.max(0,player.hp)*5}%`;track.append(fill);hp.append(track);boxes.append(hp);wrap.append(boxes);return wrap;
}
function statBox(E,label,value){const box=E('div','civ-stat-box');box.append(E('div','civ-stat-label',label),E('div','civ-stat-value',String(value)));return box;}
function renderGrid(E,player,label){const wrap=E('div','civ-grid-block'),grid=E('div','civ-grid');wrap.append(E('div','civ-grid-label',label));for(const card of player.grid){const tile=E('div',`civ-tile${card?' filled':''}`);if(card)tile.append(E('div','civ-tile-icon',ICONS[card.type]||''),E('div','civ-tile-name',card.name));grid.append(tile)}wrap.append(grid);return wrap;}

function renderDraft(E,action,sound,state,game,you){
  const wrap=E('div','civ-draft'),hand=E('div','civ-hand'),detail=E('div','civ-detail-slot');
  wrap.append(E('div','civ-draft-label','Kies één kaart'));
  const showDetail=(card)=>{
    state.selection={game:'civilization',handIndex:card.idx};
    hand.querySelectorAll('.civ-card').forEach((node)=>node.classList.toggle('selected',Number(node.dataset.index)===card.idx));
    const panel=E('div','civ-detail'),actions=E('div','civ-detail-actions');
    panel.append(E('div','civ-detail-name',`${ICONS[card.type]} ${card.name}`),E('div','civ-detail-desc',card.desc));
    const build=E('button','civ-btn civ-btn-primary',`Bouw (${card.cost}g)`);build.disabled=you.gold<card.cost||!you.grid.some((slot)=>slot===null);build.onclick=()=>{sound('score');action('build',{handIndex:card.idx})};
    const discard=E('button','civ-btn civ-btn-ghost','Gooi weg voor goud');discard.onclick=()=>{sound('card');action('discard',{handIndex:card.idx})};
    actions.append(build,discard);panel.append(actions);detail.replaceChildren(panel);
  };
  for(const card of game.yourHand){const node=E('button',`civ-card${card.type==='wonder'?' wonder':''}`);node.type='button';node.dataset.index=String(card.idx);node.append(E('div','civ-card-icon',ICONS[card.type]||''),E('div','civ-card-name',card.name),E('div','civ-card-cost',`Kost ${card.cost}g`));node.onclick=()=>showDetail(card);hand.append(node)}
  wrap.append(hand,detail);
  const selected=state.selection?.game==='civilization'&&game.yourHand.find((card)=>card.idx===state.selection.handIndex);if(selected)showDetail(selected);
  return wrap;
}
function renderWave(E,game,you,opponent){const wrap=E('div','civ-wave');wrap.append(E('div','civ-wave-title',`Aanvalskracht ${game.waveResult.wave}`));const cols=E('div','civ-wave-cols');for(const player of [you,opponent]){const result=game.waveResult.results[player.id],col=E('div','civ-wave-col');col.append(E('div','civ-wave-name',player.name),E('div','civ-wave-numbers',`Power ${result.power} tegen ${result.wave}`),E('div',`civ-wave-result ${result.damage?'hit':'ok'}`,result.damage?`Toren verliest ${result.damage} HP`:'Aanval afgeslagen!'));cols.append(col)}wrap.append(cols);return wrap;}
function renderGameOver(E,game,you,opponent){const wrap=E('div','civ-gameover');wrap.append(E('h2','civ-go-headline',game.resultText));const table=E('div','civ-final-table');for(const player of [you,opponent]){const row=E('div',`civ-final-row${game.winnerId===player.id?' winner':''}`),info=E('div');info.append(E('div','civ-fname',player.name),E('div','civ-breakdown',`VP ${player.vp} + goudbonus ${Math.floor(player.gold/3)} · Toren ${player.hp}/20`));row.append(info,E('div','civ-fscore',String(game.finalScores?.[player.id]??player.vp)));table.append(row)}wrap.append(table);return wrap;}

export function metric({game,player}){const score=Number(game.finalScores?.[player.id]??player.vp??0);return{text:`${score} pt`,score};}
export function isWinner({game,myId}){return game.winnerId===myId;}
export function presentResult({game}){return game.resultText;}
