let state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList;
const uiState={animation:null,animatedRound:0};
function bind(api){({state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList}=api)}
export function render(api){bind(api);renderHofslag(api.room,api.game)}
export function isPlayerActive({game,player}){return !player.pending&&!game.gameOver}

function renderHofslag(room, game) {
  const me = game.players.find(p=>p.id===room.meId);
  const offline = game.players.find(p=>!p.isNpc&&!p.connected);
  const shouldAnimate =
    game.lastRound &&
    game.lastRound.boardBefore &&
    game.lastRound.round > uiState.animatedRound &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const animating = shouldAnimate || Boolean(uiState.animation?.active);
  const status = game.gameOver
    ? 'Spel afgelopen.'
    : animating
      ? `Ronde ${game.lastRound?.round || game.round}: pionnen bewegen…`
      : offline
        ? `Gepauzeerd: ${offline.name} offline.`
        : me?.pending
          ? 'Kaart gekozen. Wachten op de anderen.'
          : 'Kies één kaart.';

  els.gameStage.append(titlebar('Hofslag',status));

  const board = E('div','hof-board');
  const center = E('div','hof-center');
  center.append(E('span','eyebrow','RONDE'),E('div','round-number',String(game.round)));
  const stats = E('div','stat-grid');
  [['Beeldkaarten',game.facesLeft],['Resterende punten',game.pointsLeft]].forEach(([l,v])=>{
    const d=E('div');d.append(E('span','',l),E('strong','',String(v)));stats.append(d)
  });
  center.append(stats); board.append(center);
  els.gameStage.append(board);

  const handArea=E('div','hand-area hof-hand');
  const row=E('div','card-row');
  (me?.hand||[]).forEach(v=>{
    const c=cardNode({rank:valueLabel(v),suit:me.suit},{legal:!me.pending&&!game.gameOver&&!offline&&!animating});
    c.disabled=me.pending||game.gameOver||Boolean(offline)||animating;
    c.onclick=()=>action('playCard',{value:v});
    row.append(c);
  });
  handArea.append(E('span','eyebrow','JOUW HAND'),row);
  const scores=scoreList(game.players,p=>`${p.score} pt`);
  scores.classList.add('hof-score-list',`hof-score-list-${game.players.length}`);
  els.gameStage.append(handArea,scores,logBox(game.log));

  if (shouldAnimate) startHofAnimation(board, game);
  else requestAnimationFrame(()=>renderHofBoard(board,game));
}

function startHofAnimation(board, game) {
  const round = game.lastRound.round;
  if (uiState.animation?.active && uiState.animation.round === round) return;

  const plays = game.lastRound.plays || [];
  const maxMove = Math.max(0,...plays.map(p=>p.move||0));
  const animation = { round, active:true, step:0, timer:null };
  uiState.animation = animation;

  const frame = () => {
    if (!animation.active || !board.isConnected) return;
    const positions = {};
    for (const play of plays) {
      positions[play.playerId] = (play.from + Math.min(animation.step, play.move)) % 12;
    }

    const useFinalBoard = animation.step >= maxMove;
    renderHofBoard(board, game, {
      positions,
      boardOverride: useFinalBoard ? game.board : game.lastRound.boardBefore
    });

    if (animation.step < maxMove) {
      animation.step += 1;
      animation.timer = setTimeout(frame, 220);
    } else {
      animation.timer = setTimeout(()=>{
        animation.active = false;
        uiState.animatedRound = Math.max(uiState.animatedRound, round);
        uiState.animation = null;
        if (state.room?.gameState?.kind === 'hofslag') renderGame(state.room);
      }, 420);
    }
  };

  frame();
}

function renderHofBoard(board,game,opts={}) {
  if (!board.isConnected) return;
  board.querySelectorAll('.hof-card').forEach(n=>n.remove());

  const cards = opts.boardOverride || game.board;
  const positions = opts.positions || Object.fromEntries(game.players.map(p=>[p.id,p.pos]));
  const w=board.clientWidth||700,h=board.clientHeight||590,cx=w/2,cy=h/2;
  let rx=Math.min(w*.40,390),ry=Math.min(h*.39,230);
  if(w<520){rx=Math.max(112,w*.39);ry=Math.max(150,h*.39)}

  cards.forEach((card,i)=>{
    const a=(-90+i*30)*Math.PI/180,x=cx+rx*Math.cos(a),y=cy+ry*Math.sin(a);
    const el=E('div',`hof-card ${card.kind==='face'?'face':'replaced'}`);
    el.style.left=`${x}px`;el.style.top=`${y}px`;
    const tokens=E('div','tokens');

    game.players.filter(p=>positions[p.id]===i).forEach(p=>{
      const t=E('div','token',p.name[0].toUpperCase());
      t.style.background=p.color;t.title=p.name;tokens.append(t)
    });

    const cont=E('div','hof-content');
    const red=card.suit==='♥'||card.suit==='♦';
    cont.append(
      E('div',`hof-rank ${red?'red':'black'}`,card.kind==='face'?card.rank:valueLabel(card.value)),
      E('div',`hof-suit ${red?'red':'black'}`,card.suit),
      E('div','hof-meta',card.kind==='face'?`${card.points} pt${card.points===1?'':'n'}`:card.ownerName)
    );
    el.append(tokens,cont);board.append(el)
  });
}

export function metric({player}){return {text:`${player.score} pt`,score:Number(player.score||0)}}
export function presentResult({game}){const high=Math.max(...game.players.map(p=>p.score)),w=game.players.filter(p=>p.score===high);return w.length===1?{title:w[0].name,copy:'is de winnaar.'}:{title:'Gelijkspel',copy:'Er is geen unieke winnaar.'}}
export function isWinner({game,myId}){const high=Math.max(...game.players.map(p=>p.score));return game.players.filter(p=>p.score===high).length===1&&game.players.find(p=>p.id===myId)?.score===high}


export function shouldSkipRender({game}){return uiState.animation?.active&&uiState.animation.round===game.lastRound?.round}
export function onResize(api){bind(api);if(!uiState.animation?.active){const board=document.querySelector('.hof-board');if(board)renderHofBoard(board,api.game)}}
export function onRoomReset(){uiState.animation=null;uiState.animatedRound=0}
