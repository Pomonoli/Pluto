const crypto=require('node:crypto');

const meta={key:'elements',name:'Elements Arena',description:'Mik, counter en claim de Nexus.',minPlayers:2,maxPlayers:4,supportsNpc:true,realtime:false,solo:false};
const SIZE=900,CENTER=450,ARENA_RADIUS=410,STONE_RADIUS=24;
const ELEMENTS=['fire','water','earth','air'];
const COLORS=['#D95736','#3F82B8','#647A46','#91B7C0'];
const BEATS={water:'fire',fire:'earth',earth:'air',air:'water'};
const DT=1/120,FRICTION=.988,BOUNCE=.82,COLLISION_BOUNCE=.9,STOP_SPEED=8,MAX_STEPS=2100;
const NPC_DELAY=750,BETWEEN_ENDS_MS=1900;

function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function launchPoint(playerIndex,count){const angle=Math.PI/2+playerIndex*Math.PI*2/count;return{x:CENTER+Math.cos(angle)*(ARENA_RADIUS-STONE_RADIUS-7),y:CENTER+Math.sin(angle)*(ARENA_RADIUS-STONE_RADIUS-7)}}
function scorePosition(stone){const d=distance(stone,{x:CENTER,y:CENTER});if(d>ARENA_RADIUS-STONE_RADIUS)return 0;if(d<=64)return 5;if(d<=155)return 3;if(d<=270)return 2;return 1}
function matchup(a,b){if(a===b)return 0;if(BEATS[a]===b)return 1;if(BEATS[b]===a)return-1;return 0}
function compactPath(path){const stride=Math.max(1,Math.ceil(path.length/190)),out=[];for(let i=0;i<path.length;i+=stride)out.push(path[i]);const last=path[path.length-1];if(last&&out[out.length-1]!==last)out.push(last);return out.map(p=>({x:+p.x.toFixed(2),y:+p.y.toFixed(2),gone:Boolean(p.gone)}))}

function resolveNormal(a,b){
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=STONE_RADIUS*2)return false;
  if(d<.001){dx=1;dy=0;d=1}const nx=dx/d,ny=dy/d,over=STONE_RADIUS*2-d;
  a.x-=nx*over/2;a.y-=ny*over/2;b.x+=nx*over/2;b.y+=ny*over/2;
  const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(relative>=0)return true;
  const impulse=-(1+COLLISION_BOUNCE)*relative/2;
  a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;return true
}

function simulateShot(stones,shot){
  const bodies=stones.map(s=>({...s,vx:0,vy:0,gone:false}));
  bodies.push({...shot,vx:Math.cos(shot.angle)*(170+930*shot.power),vy:Math.sin(shot.angle)*(170+930*shot.power),gone:false});
  const paths=Object.fromEntries(bodies.map(b=>[b.id,[{x:b.x,y:b.y}]])),events=[];
  let activeSteps=0;
  for(let step=0;step<MAX_STEPS;step++){
    let moving=false;
    for(const b of bodies){
      if(b.gone)continue;const speed=Math.hypot(b.vx,b.vy);if(speed<STOP_SPEED){b.vx=0;b.vy=0;continue}
      moving=true;b.x+=b.vx*DT;b.y+=b.vy*DT;b.vx*=FRICTION;b.vy*=FRICTION;
      if(distance(b,{x:CENTER,y:CENTER})>ARENA_RADIUS+STONE_RADIUS){b.gone=true;b.vx=0;b.vy=0;events.push({type:'out',id:b.id,element:b.element})}
    }
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j];if(a.gone||b.gone||distance(a,b)>=STONE_RADIUS*2)continue;
      const relation=matchup(a.element,b.element);
      if(!relation){resolveNormal(a,b);continue}
      const winner=relation>0?a:b,loser=relation>0?b:a;
      const momentumX=(winner.vx+loser.vx)*.52,momentumY=(winner.vy+loser.vy)*.52;
      loser.gone=true;loser.vx=0;loser.vy=0;winner.vx=momentumX;winner.vy=momentumY;
      const dx=winner.x-loser.x,dy=winner.y-loser.y,d=Math.hypot(dx,dy)||1;
      winner.x+=dx/d*3;winner.y+=dy/d*3;
      events.push({type:'counter',winnerId:winner.id,loserId:loser.id,winner:winner.element,loser:loser.element})
    }
    if(step%5===0)for(const b of bodies)paths[b.id].push({x:b.x,y:b.y,gone:b.gone});
    if(moving)activeSteps=step;else break
  }
  for(const b of bodies)paths[b.id].push({x:b.x,y:b.y,gone:b.gone});
  const finalStones=bodies.filter(b=>!b.gone).map(({vx,vy,gone,angle,power,...s})=>({...s,x:+s.x.toFixed(2),y:+s.y.toFixed(2)}));
  return{stones:finalStones,paths:Object.fromEntries(Object.entries(paths).map(([id,p])=>[id,compactPath(p)])),events,durationMs:clamp(Math.round(activeSteps*DT*310),480,2600)}
}

function currentPlayer(game){return game.players[game.turnIndex]}
function addLog(game,text){game.log.unshift(text);game.log=game.log.slice(0,28)}
function scheduleNpc(game,delay=NPC_DELAY){game.nextNpcAt=!game.gameOver&&game.phase==='playing'&&!game.pendingShot&&currentPlayer(game)?.isNpc?Date.now()+delay:0}
function prepareEnd(game,first=false){game.stones=[];game.pendingShot=null;game.phase='playing';game.turnIndex=(game.end-1)%game.players.length;for(const p of game.players)p.remaining=[...ELEMENTS];addLog(game,`${first?'De match begint':`End ${game.end} begint`}. Iedere speler heeft vier elementstenen.`);scheduleNpc(game,550)}
function createGame(roomPlayers){
  if(roomPlayers.length<2||roomPlayers.length>4)throw new Error('Elements Arena is voor 2 tot 4 spelers.');
  const game={gameKey:meta.key,players:roomPlayers.map((p,i)=>({id:p.id,name:p.name,isNpc:Boolean(p.isNpc),color:COLORS[i],totalPoints:0,endPoints:0,endTwoClosest:Infinity,remaining:[...ELEMENTS]})),stones:[],end:1,turnIndex:0,phase:'playing',pendingShot:null,nextNpcAt:0,nextEndAt:0,gameOver:false,resultText:'',winnerIds:[],lastEndSummary:'',log:[]};prepareEnd(game,true);return game
}
function rankedPlayers(game){return[...game.players].sort((a,b)=>b.totalPoints-a.totalPoints||a.endTwoClosest-b.endTwoClosest)}
function winners(game){const ranked=rankedPlayers(game),first=ranked[0];return ranked.filter(p=>p.totalPoints===first.totalPoints&&p.endTwoClosest===first.endTwoClosest)}
function finishGame(game){game.gameOver=true;game.phase='done';game.nextNpcAt=0;const w=winners(game),high=w[0].totalPoints;game.winnerIds=w.map(p=>p.id);game.resultText=w.length===1?`${w[0].name} wint Elements Arena met ${high} punten.`:`Gelijkspel tussen ${w.map(p=>p.name).join(', ')} met ${high} punten.`}
function finishEnd(game){for(const p of game.players)p.endPoints=0;for(const stone of game.stones){const pts=scorePosition(stone),p=game.players.find(x=>x.id===stone.playerId);if(p)p.endPoints+=pts}for(const p of game.players)p.totalPoints+=p.endPoints;if(game.end===2)for(const p of game.players){const own=game.stones.filter(s=>s.playerId===p.id);p.endTwoClosest=own.length?Math.min(...own.map(s=>distance(s,{x:CENTER,y:CENTER}))):Infinity}game.lastEndSummary=`End ${game.end}: ${game.players.map(p=>`${p.name} +${p.endPoints}`).join(' · ')}`;addLog(game,game.lastEndSummary);if(game.end===2)return finishGame(game);game.phase='between';game.nextEndAt=Date.now()+BETWEEN_ENDS_MS;game.nextNpcAt=0}
function advanceTurn(game){if(game.players.every(p=>p.remaining.length===0))return finishEnd(game);for(let n=1;n<=game.players.length;n++){const i=(game.turnIndex+n)%game.players.length;if(game.players[i].remaining.length){game.turnIndex=i;break}}scheduleNpc(game)}
function beginShot(game,player,element,angle,power){
  if(game.pendingShot||game.phase!=='playing')throw new Error('Wacht tot de arena stilstaat.');if(!player.remaining.includes(element))throw new Error('Deze elementsteen is al gebruikt.');
  const origin=launchPoint(game.turnIndex,game.players.length),id=crypto.randomUUID();
  const result=simulateShot(game.stones,{id,playerId:player.id,element,x:origin.x,y:origin.y,angle,power});
  game.pendingShot={id,playerId:player.id,playerName:player.name,element,paths:result.paths,events:result.events,finalStones:result.stones,durationMs:result.durationMs,endsAt:Date.now()+result.durationMs};game.nextNpcAt=0;addLog(game,`${player.name} speelt ${element}.`)
}
function finishShot(game){const shot=game.pendingShot;if(!shot)return;const player=game.players.find(p=>p.id===shot.playerId);game.stones=shot.finalStones;if(player)player.remaining=player.remaining.filter(e=>e!==shot.element);for(const event of shot.events){if(event.type==='counter')addLog(game,`${event.winner} verslaat ${event.loser}.`);else if(event.id===shot.id)addLog(game,`${player?.name||'De steen'} schiet buiten de arena.`)}game.pendingShot=null;advanceTurn(game)}

function candidateScore(game,player,element,angle,power){const origin=launchPoint(game.turnIndex,game.players.length),result=simulateShot(game.stones,{id:'npc-shot',playerId:player.id,element,x:origin.x,y:origin.y,angle,power});let score=0;for(const s of result.stones){const pts=scorePosition(s);score+=s.playerId===player.id?pts*8:-pts*5;if(s.id==='npc-shot')score+=pts*4}score+=result.events.filter(e=>e.type==='counter'&&e.winnerId==='npc-shot').length*7;return score}
function chooseNpcShot(game,player){let best=null;for(const element of player.remaining)for(let a=0;a<16;a++)for(const power of [.38,.55,.72,.9]){const targetAngle=-Math.PI/2+a*Math.PI*2/16,score=candidateScore(game,player,element,targetAngle,power)+Math.random()*1.4;if(!best||score>best.score)best={element,angle:targetAngle,power,score}}return best}
function tick(game,now=Date.now()){if(game.gameOver)return false;if(game.pendingShot){if(now<game.pendingShot.endsAt)return false;finishShot(game);return true}if(game.phase==='between'){if(now<game.nextEndAt)return false;game.end++;prepareEnd(game);return true}const player=currentPlayer(game);if(!player?.isNpc)return false;if(!game.nextNpcAt)game.nextNpcAt=now+NPC_DELAY;if(now<game.nextNpcAt)return false;const shot=chooseNpcShot(game,player);beginShot(game,player,shot.element,shot.angle,shot.power);return true}
function handleAction(game,playerId,action,payload={}){if(game.gameOver)throw new Error('Het spel is afgelopen.');const player=currentPlayer(game);if(!player||player.id!==playerId||player.isNpc)throw new Error('Je bent niet aan de beurt.');if(action!=='shoot')throw new Error('Onbekende actie.');const element=String(payload.element||''),angle=Number(payload.angle),power=Number(payload.power);if(!ELEMENTS.includes(element)||!Number.isFinite(angle)||!Number.isFinite(power))throw new Error('Ongeldige worp.');if(power<.06||power>1)throw new Error('Kies een geldige kracht.');beginShot(game,player,element,angle,power)}
function serialize(game,requesterId,connected){const turn=currentPlayer(game),me=game.players.find(p=>p.id===requesterId);return{kind:meta.key,arena:{size:SIZE,center:CENTER,radius:ARENA_RADIUS,stoneRadius:STONE_RADIUS,zones:[64,155,270,ARENA_RADIUS]},end:game.end,totalEnds:2,phase:game.phase,gameOver:game.gameOver,resultText:game.resultText,winnerIds:game.winnerIds,turnPlayerId:!game.gameOver&&game.phase==='playing'&&!game.pendingShot?turn?.id:null,launch:!game.gameOver&&game.phase==='playing'?launchPoint(game.turnIndex,game.players.length):null,stones:game.stones,pendingShot:game.pendingShot?{id:game.pendingShot.id,playerId:game.pendingShot.playerId,playerName:game.pendingShot.playerName,element:game.pendingShot.element,paths:game.pendingShot.paths,events:game.pendingShot.events,durationMs:game.pendingShot.durationMs}:null,players:game.players.map(p=>({...p,connected:p.isNpc||connected.get(p.id)})),canShoot:Boolean(!game.gameOver&&game.phase==='playing'&&!game.pendingShot&&turn?.id===requesterId&&me?.remaining.length),lastEndSummary:game.lastEndSummary,log:game.log}}
function results(game){const ranked=rankedPlayers(game),places=new Map();let place=0,last=null;for(const p of ranked){const key=`${p.totalPoints}:${p.endTwoClosest}`;if(key!==last){place++;last=key}places.set(p.id,place)}const leaders=winners(game);return game.players.map(p=>{const leading=leaders.some(w=>w.id===p.id);return{playerId:p.id,placement:places.get(p.id),score:p.totalPoints,won:leaders.length===1&&leading,outcome:leading?(leaders.length===1?'Wint':'Gelijkspel'):'Verliest'}})}

module.exports={meta,ELEMENTS,BEATS,createGame,handleAction,serialize,tick,results,simulateShot,scorePosition,matchup,launchPoint,finishShot,finishEnd,chooseNpcShot};
