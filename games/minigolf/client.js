import {createMapEditor as createEditor} from './map-editor.js';
let editorInstance=null;
export function mount(api){
  const ids=['minigolfEditorView','newGolfMapButton','saveGolfMapButton','customMapCount','customMapList','mapNameInput','mapDifficultySelect','mapMaxStrokesInput','mapSaveState','mapToolGrid','mapToolHelp','deleteMapObjectButton','mapEditorCanvas','mapInspectorEmpty','mapInspectorFields','testGolfMapButton','resetGolfTestButton','mapTestHint'];
  const els={...api.els};ids.forEach(id=>els[id]=document.getElementById(id));
  if(editorInstance||!els.mapEditorCanvas)return;
  editorInstance=createEditor({...api,els,svgEl,minigolfPathPoint,minigolfTerrainNode,minigolfBoostNode});
  els.mapToolGrid.addEventListener('click',(event)=>{const button=event.target.closest('.map-tool');if(button&&!editorInstance.ensureMapEditor().testMode)editorInstance.selectEditorTool(button.dataset.tool)});
  els.newGolfMapButton.onclick=()=>{if(editorInstance.ensureMapEditor().dirty&&!confirm('Niet-opgeslagen wijzigingen wissen?'))return;editorInstance.resetEditorMap()};
  els.saveGolfMapButton.onclick=editorInstance.saveEditorMap;
  els.deleteMapObjectButton.onclick=editorInstance.editorDeleteSelection;
  els.testGolfMapButton.onclick=editorInstance.toggleEditorTest;
  els.resetGolfTestButton.onclick=editorInstance.resetEditorTest;
  [els.mapNameInput,els.mapDifficultySelect,els.mapMaxStrokesInput].forEach(input=>input.addEventListener('change',()=>{editorInstance.syncEditorMetaToMap();editorInstance.editorMarkDirty()}));
  editorInstance.bindMapCanvasEvents();
}
export function openTool({state,setRoute,toast}){if(state.room)return toast('Verlaat eerst de room.');if(!editorInstance)return toast('Minigolf-editor kon niet laden.');setRoute('/minigolf/editor');editorInstance.showMinigolfEditor()}
export function handleRoute({path}){if(!/^\/minigolf\/editor\/?$/.test(path)||!editorInstance)return false;editorInstance.showMinigolfEditor();return true}
export const roomOptions={bodyClass:'minigolf-mode'};

let state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList;
let shotAnimation=null;
function bind(api){({state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList}=api)}
export function render(api){bind(api);renderMinigolf(api.room,api.game)}

function svgEl(tag, attrs={}) {
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));
  return node;
}

function minigolfPathPoint(path, t) {
  if(!path?.length)return null;
  if(path.length===1)return path[0];
  const scaled=Math.max(0,Math.min(1,t))*(path.length-1);
  const index=Math.min(path.length-2,Math.floor(scaled));
  const f=scaled-index,a=path[index],b=path[index+1];
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
}

function golfScoreLabel(strokes,par){const d=strokes-par;return d===0?'E':d>0?`+${d}`:String(d)}

function minigolfTerrainNode(zone) {
  if(zone.shape==='ellipse') return svgEl('ellipse',{
    cx:zone.cx,cy:zone.cy,rx:zone.rx,ry:zone.ry,
    class:`golf-terrain golf-${zone.type}`
  });
  return svgEl('rect',{
    x:zone.x,y:zone.y,width:zone.w,height:zone.h,rx:zone.r||0,
    class:`golf-terrain golf-${zone.type}`
  });
}

function minigolfPropNode(prop) {
  const g=svgEl('g',{class:`golf-prop golf-prop-${prop.kind}`,'data-prop-id':prop.id});
  const asset=`/game-plugins/minigolf/assets/${prop.kind}.svg`;
  if(prop.shape==='circle'){
    const size=Math.max(44,(prop.r||28)*2.5);
    g.append(svgEl('image',{href:asset,x:prop.cx-size/2,y:prop.cy-size/2,width:size,height:size,preserveAspectRatio:'xMidYMid meet'}));
  }else{
    const pad=prop.kind==='windmill'?12:6;
    g.append(svgEl('image',{href:asset,x:prop.x-pad,y:prop.y-pad,width:prop.w+pad*2,height:prop.h+pad*2,preserveAspectRatio:'xMidYMid meet'}));
  }
  return g;
}

function minigolfBoostNode(boost) {
  const g=svgEl('g',{class:'golf-boost',transform:`translate(${boost.x} ${boost.y})`});
  g.append(svgEl('rect',{x:0,y:0,width:boost.w,height:boost.h,rx:8,class:'golf-boost-bg'}));
  const cx=boost.w/2,cy=boost.h/2;
  for(let i=-1;i<=1;i+=1){
    const ox=i*22;
    const arrow=svgEl('path',{
      d:`M ${cx-16+ox} ${cy-9} L ${cx+2+ox} ${cy} L ${cx-16+ox} ${cy+9}`,
      class:'golf-boost-arrow',
      transform:`rotate(${boost.angle*180/Math.PI} ${cx+ox} ${cy})`
    });
    g.append(arrow)
  }
  return g;
}

function renderMinigolf(room,game) {
  const me=game.players.find(p=>p.id===room.meId);
  const turn=game.players.find(p=>p.id===game.turnPlayerId);

  const screen=E('div','golf-game-screen');
  const hud=E('div','golf-hud');

  const playerHud=E('div','golf-player-hud');
  game.players.forEach((p,index)=>{
    const chip=E('div',`golf-player-card ${p.id===room.meId?'me':''} ${p.id===game.turnPlayerId?'active':''}`);
    const avatar=E('span','golf-avatar',p.name.slice(0,1).toUpperCase());
    avatar.style.background=p.color;
    const info=E('span','golf-player-info');
    info.append(E('strong','',p.name),E('small','',p.placed?`SHOT: ${p.holeStrokes+1}`:'START'));
    const score=E('b','golf-point-badge',String(p.totalPoints));
    chip.append(avatar,info,score);
    playerHud.append(chip)
  });

  const holeHud=E('div','golf-hole-hud');
  holeHud.append(
    E('strong','',`HOLE ${game.hole.number}/5`),
    E('span','',`${game.hole.name}${game.hole.gimmick ? ` · ${game.hole.gimmick}` : ''}`),
    E('b','',`MAX SHOTS: ${game.hole.maxStrokes}`)
  );
  hud.append(playerHud,holeHud);
  screen.append(hud);

  const courseWrap=E('div','golf-full-course-wrap');
  const svg=svgEl('svg',{
    viewBox:`0 0 ${game.course.width} ${game.course.height}`,
    class:'minigolf-course golf-full-course',
    role:'img',
    'aria-label':`Minigolf hole ${game.hole.number}: ${game.hole.name}`
  });

  svg.append(svgEl('rect',{x:0,y:0,width:game.course.width,height:game.course.height,rx:16,class:'golf-world'}));
  svg.append(svgEl('rect',{x:8,y:8,width:game.course.width-16,height:game.course.height-16,rx:12,class:'golf-border'}));
  (game.hole.terrain||[]).forEach(zone=>svg.append(minigolfTerrainNode(zone)));

  const sz=game.hole.startZone;
  svg.append(svgEl('rect',{x:sz.x,y:sz.y,width:sz.w,height:sz.h,rx:sz.r||12,class:`golf-start-zone ${game.canPlace?'placing':''}`}));
  const startText=svgEl('text',{x:sz.x+sz.w/2,y:sz.y+18,class:'golf-start-label'});
  startText.textContent='START';
  svg.append(startText);

  (game.hole.boosts||[]).forEach(boost=>svg.append(minigolfBoostNode(boost)));
  (game.hole.walls||[]).forEach(o=>svg.append(svgEl('rect',{x:o.x,y:o.y,width:o.w,height:o.h,rx:7,class:'golf-wall'})));
  (game.hole.props||[]).forEach(prop=>svg.append(minigolfPropNode(prop)));

  svg.append(svgEl('circle',{cx:game.hole.cup.x,cy:game.hole.cup.y,r:25,class:'golf-cup-shadow'}));
  svg.append(svgEl('circle',{cx:game.hole.cup.x,cy:game.hole.cup.y,r:18,class:'golf-cup'}));
  const flag=svgEl('g',{class:'golf-flag'});
  flag.append(svgEl('line',{x1:game.hole.cup.x,y1:game.hole.cup.y,x2:game.hole.cup.x,y2:game.hole.cup.y-62}));
  flag.append(svgEl('path',{d:`M ${game.hole.cup.x} ${game.hole.cup.y-62} l 38 13 l -38 13 z`}));
  svg.append(flag);

  const ballNodes=new Map();
  const pendingIds=new Set(Object.keys(game.pendingShot?.paths||{}));
  [...game.players].sort((a,b)=>(a.id===room.meId?1:0)-(b.id===room.meId?1:0)).forEach((p)=>{
    if(!p.ball)return;
    if(p.holeDone&&!pendingIds.has(p.id))return;
    const index=game.players.findIndex(x=>x.id===p.id);
    const group=svgEl('g',{class:`golf-ball-group ${p.id===room.meId?'me':''}`});
    const shadow=svgEl('circle',{cx:p.ball.x+3,cy:p.ball.y+5,r:12,class:'golf-ball-shadow'});
    const ball=svgEl('circle',{cx:p.ball.x,cy:p.ball.y,r:11,class:'golf-ball',fill:p.color,'data-player-id':p.id});
    const mark=svgEl('text',{x:p.ball.x,y:p.ball.y+4,class:'golf-ball-mark'});
    mark.textContent=String(index+1);
    group.append(shadow,ball,mark);svg.append(group);
    ballNodes.set(p.id,{group,ball,shadow,mark})
  });

  const aim=svgEl('g',{class:'golf-aim hidden'});
  const aimLine=svgEl('line',{class:'golf-aim-line'});
  const aimHead=svgEl('circle',{r:6,class:'golf-aim-head'});
  const pullLine=svgEl('line',{class:'golf-pull-line'});
  const powerBg=svgEl('rect',{rx:8,class:'golf-power-label-bg'});
  const powerText=svgEl('text',{class:'golf-power-label'});
  aim.append(aimLine,aimHead,pullLine,powerBg,powerText);
  svg.append(aim);

  courseWrap.append(svg);
  screen.append(courseWrap);

  let status='';
  if(game.gameOver)status='Match afgelopen.';
  else if(game.phase==='between')status='Punten verdeeld. Volgende hole…';
  else if(game.phase==='placing')status=game.canPlace?'Tik in het startvak om je bal te plaatsen.':'Wachten tot iedereen zijn bal geplaatst heeft…';
  else if(game.pendingShot)status=`${game.pendingShot.playerName} slaat…`;
  else if(game.canShoot)status='Jouw beurt. Sleep eender waar op de baan om te mikken.';
  else status=`${turn?.name||'Speler'} is aan de beurt.`;

  const footer=E('div','golf-game-footer');
  const statusBox=E('div','golf-status-line',status);
  const miniScores=E('div','golf-mini-scores');
  game.players.forEach(p=>miniScores.append(E('span','',`${p.name}: ${p.totalPoints} pt · ${p.potted?'✓':p.failed?'DNF':`${p.holeStrokes}/${game.hole.maxStrokes}`}`)));
  footer.append(statusBox,miniScores);
  if(game.lastHoleSummary)footer.append(E('div','minigolf-hole-summary',game.lastHoleSummary));
  screen.append(footer);
  els.gameStage.append(screen);

  const setBallPosition=(playerId,point)=>{
    const n=ballNodes.get(playerId);
    if(!n||!point)return;
    n.ball.setAttribute('cx',point.x);n.ball.setAttribute('cy',point.y);
    n.shadow.setAttribute('cx',point.x+3);n.shadow.setAttribute('cy',point.y+5);
    n.mark.setAttribute('x',point.x);n.mark.setAttribute('y',point.y+4)
  };

  const shot=game.pendingShot;
  if(shot){
    (shot.removedPropIds||[]).forEach(id=>{
      const prop=svg.querySelector(`[data-prop-id="${CSS.escape(id)}"]`);
      if(prop)prop.classList.add('golf-prop-disappearing')
    });
    if(!shotAnimation||shotAnimation.id!==shot.id){
      shotAnimation={id:shot.id,start:performance.now()}
    }
    const animation=shotAnimation;
    const frame=(now)=>{
      if(!svg.isConnected||state.room?.gameState?.pendingShot?.id!==shot.id)return;
      const t=Math.min(1,(now-animation.start)/Math.max(1,shot.durationMs));
      Object.entries(shot.paths||{}).forEach(([playerId,path])=>setBallPosition(playerId,minigolfPathPoint(path,t)));
      if(t<1)requestAnimationFrame(frame)
    };
    requestAnimationFrame(frame)
  }else shotAnimation=null;

  const logicalPoint=(event)=>{
    const r=svg.getBoundingClientRect();
    return{
      x:Math.max(0,Math.min(game.course.width,(event.clientX-r.left)/r.width*game.course.width)),
      y:Math.max(0,Math.min(game.course.height,(event.clientY-r.top)/r.height*game.course.height))
    }
  };

  if(game.canPlace&&me&&!me.placed){
    svg.classList.add('golf-placement-mode');
    svg.addEventListener('pointerdown',(event)=>{
      const point=logicalPoint(event);
      if(point.x<sz.x||point.x>sz.x+sz.w||point.y<sz.y||point.y>sz.y+sz.h)return;
      action('placeBall',point);
      event.preventDefault()
    })
  }

  if(game.canShoot&&me&&!game.pendingShot&&!game.gameOver&&!me.holeDone&&me.ball){
    let dragging=false,pointerId=null,dragStart=null;
    const origin={...me.ball};

    const updateAim=(point)=>{
      if(!dragStart)return null;
      let dx=dragStart.x-point.x,dy=dragStart.y-point.y;
      const d=Math.hypot(dx,dy);
      if(d<2){aim.classList.add('hidden');return null}
      const max=180,clamped=Math.min(max,d),ux=dx/d,uy=dy/d,power=Math.min(1,clamped/max);
      const end={x:origin.x+ux*(60+power*145),y:origin.y+uy*(60+power*145)};
      aim.classList.remove('hidden');
      aimLine.setAttribute('x1',origin.x);aimLine.setAttribute('y1',origin.y);
      aimLine.setAttribute('x2',end.x);aimLine.setAttribute('y2',end.y);
      aimHead.setAttribute('cx',end.x);aimHead.setAttribute('cy',end.y);
      pullLine.setAttribute('x1',dragStart.x);pullLine.setAttribute('y1',dragStart.y);
      pullLine.setAttribute('x2',point.x);pullLine.setAttribute('y2',point.y);

      const pct=Math.round(power*100);
      powerText.textContent=`${pct}%`;
      const tx=Math.max(42,Math.min(game.course.width-42,point.x));
      const ty=Math.max(28,Math.min(game.course.height-18,point.y-18));
      powerText.setAttribute('x',tx);powerText.setAttribute('y',ty+4);
      powerBg.setAttribute('x',tx-31);powerBg.setAttribute('y',ty-15);
      powerBg.setAttribute('width',62);powerBg.setAttribute('height',27);
      return{angle:Math.atan2(uy,ux),power}
    };

    svg.addEventListener('pointerdown',(event)=>{
      dragging=true;pointerId=event.pointerId;dragStart=logicalPoint(event);
      svg.setPointerCapture?.(pointerId);
      event.preventDefault()
    });
    svg.addEventListener('pointermove',(event)=>{
      if(!dragging||event.pointerId!==pointerId)return;
      updateAim(logicalPoint(event));event.preventDefault()
    });
    const finish=(event)=>{
      if(!dragging||event.pointerId!==pointerId)return;
      const shotData=updateAim(logicalPoint(event));
      dragging=false;dragStart=null;aim.classList.add('hidden');
      if(shotData&&shotData.power>=.06){sound('card');action('shoot',shotData)}
      event.preventDefault()
    };
    svg.addEventListener('pointerup',finish);
    svg.addEventListener('pointercancel',()=>{dragging=false;dragStart=null;aim.classList.add('hidden')})
  }
}

export function metric({player}){return {text:`${player.totalPoints} pt`,score:Number(player.totalPoints||0)}}
export function presentResult({game}){const high=Math.max(...game.players.map(p=>p.totalPoints)),w=game.players.filter(p=>p.totalPoints===high);return w.length===1?{title:w[0].name,copy:'is de winnaar.'}:{title:'Gelijkspel',copy:'Er is geen unieke winnaar.'}}
export function isWinner({game,myId}){const high=Math.max(...game.players.map(p=>p.totalPoints));return game.players.filter(p=>p.totalPoints===high).length===1&&game.players.find(p=>p.id===myId)?.totalPoints===high}


export {svgEl,minigolfPathPoint,minigolfTerrainNode,minigolfPropNode,minigolfBoostNode};
