const test=require('node:test');
const assert=require('node:assert/strict');
const elements=require('../games/elements/server');

const players=(count=2,npc=false)=>Array.from({length:count},(_,i)=>({id:`p${i+1}`,name:`P${i+1}`,isNpc:npc&&i===0}));

test('Elements maakt een volledige 2-4 speler end met vier publieke stenen per speler',()=>{
  for(const count of [2,3,4]){
    const game=elements.createGame(players(count));
    assert.equal(game.players.length,count);assert.equal(game.end,1);
    assert.deepEqual(game.players[0].remaining,['fire','water','earth','air']);
    const state=elements.serialize(game,'p1',new Map(players(count).map(p=>[p.id,true])));
    assert.equal(state.canShoot,true);assert.equal(state.totalEnds,2);assert.equal(state.players[0].remaining.length,4)
  }
});

test('counter-ring is exact en neutrale combinaties blijven neutraal',()=>{
  assert.equal(elements.matchup('water','fire'),1);assert.equal(elements.matchup('fire','water'),-1);
  assert.equal(elements.matchup('fire','earth'),1);assert.equal(elements.matchup('earth','air'),1);assert.equal(elements.matchup('air','water'),1);
  assert.equal(elements.matchup('fire','fire'),0);assert.equal(elements.matchup('fire','air'),0);assert.equal(elements.matchup('water','earth'),0)
});

test('winnende elementbotsing verwijdert alleen de zwakke steen',()=>{
  const result=elements.simulateShot([{id:'weak',playerId:'p2',element:'fire',x:450,y:450}],{id:'strong',playerId:'p1',element:'water',x:450,y:790,angle:-Math.PI/2,power:.55});
  assert.ok(result.events.some(e=>e.type==='counter'&&e.winnerId==='strong'&&e.loserId==='weak'));
  assert.ok(result.stones.some(s=>s.id==='strong'));assert.ok(!result.stones.some(s=>s.id==='weak'))
});

test('scorezones geven 5, 3, 2, 1 en buiten de arena 0',()=>{
  const stone=x=>({x:450+x,y:450});
  assert.equal(elements.scorePosition(stone(0)),5);assert.equal(elements.scorePosition(stone(100)),3);
  assert.equal(elements.scorePosition(stone(200)),2);assert.equal(elements.scorePosition(stone(300)),1);assert.equal(elements.scorePosition(stone(400)),0)
});

test('alle 4 stenen worden exact eenmaal gebruikt en na twee ends eindigt de match',()=>{
  const game=elements.createGame(players(2));
  for(let end=1;end<=2;end++){
    for(let shot=0;shot<8;shot++){
      const p=game.players[game.turnIndex],element=p.remaining[0];
      elements.handleAction(game,p.id,'shoot',{element,angle:-Math.PI/2,power:.2});
      game.pendingShot.endsAt=0;elements.tick(game,Date.now());
    }
    if(end===1){assert.equal(game.phase,'between');game.nextEndAt=0;elements.tick(game,Date.now());assert.equal(game.end,2)}
  }
  assert.equal(game.gameOver,true);assert.ok(game.players.every(p=>p.remaining.length===0));assert.match(game.resultText,/Elements Arena|Gelijkspel/)
});

test('NPC kiest een geldige resterende steen en speelt via tick',()=>{
  const game=elements.createGame(players(2,true));game.nextNpcAt=0;
  assert.equal(elements.tick(game,Date.now()+1000),false);
  assert.equal(elements.tick(game,Date.now()+2000),true);
  assert.ok(game.pendingShot);assert.ok(game.players[0].remaining.includes(game.pendingShot.element))
});

test('gelijke totaalscore wordt beslist door de dichtste steen in end 2',()=>{
  const game=elements.createGame(players(2));game.end=2;
  game.players[0].totalPoints=5;game.players[1].totalPoints=5;
  game.stones=[{id:'a',playerId:'p1',element:'fire',x:500,y:450},{id:'b',playerId:'p2',element:'water',x:510,y:450}];
  elements.finishEnd(game);
  assert.deepEqual(game.winnerIds,['p1']);assert.match(game.resultText,/P1 wint/);
  assert.equal(elements.results(game).find(r=>r.playerId==='p1').won,true)
});

test('ongeldige of dubbele menselijke worpen worden geweigerd',()=>{
  const game=elements.createGame(players(2));
  assert.throws(()=>elements.handleAction(game,'p2','shoot',{element:'fire',angle:0,power:.5}),/beurt/);
  assert.throws(()=>elements.handleAction(game,'p1','shoot',{element:'ice',angle:0,power:.5}),/Ongeldige/);
  game.players[0].remaining=['water'];
  assert.throws(()=>elements.handleAction(game,'p1','shoot',{element:'fire',angle:0,power:.5}),/al gebruikt/)
});
