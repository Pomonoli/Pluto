const test=require('node:test');
const assert=require('node:assert/strict');
const {createRealtime}=require('../src/server/realtime');
const {getGame}=require('../src/games');
const {NPC_FIRST_NAMES}=require('../src/npc-names');

function invoke(client,event,payload={}){
  let result;client.handlers.get(event)(payload,value=>{result=value});return result;
}

function maintenance(t,runtime){
  const callbacks=[];
  const timer=t.mock.method(global,'setInterval',(callback)=>{callbacks.push(callback);return{unref(){}}});
  runtime.startMaintenance();timer.mock.restore();return callbacks;
}

function harness(){
  let connect;
  const events=[];
  const io={
    use(){},
    on(event,handler){if(event==='connection')connect=handler},
    to(id){return{emit(event,payload){events.push({id,event,payload})}}},
    sockets:{sockets:new Map()}
  };
  const runtime=createRealtime(io);
  const makeSocket=(id,roomId,token)=>{
    const handlers=new Map();
    const socket={id,data:{roomId,token,authUser:null},on:(event,handler)=>handlers.set(event,handler),join(){},leave(){}};
    io.sockets.sockets.set(id,socket);connect(socket);return{socket,handlers};
  };
  return{runtime,makeSocket,events};
}

function playingRoom(){
  const now=Date.now();
  return{
    id:'ABCDE',gameKey:'quoridor',status:'playing',hostToken:'aaaaaaaaaaaaaaaa',
    players:[
      {id:'a',token:'aaaaaaaaaaaaaaaa',name:'Ada',isNpc:false,connected:true,socketId:'socket-a'},
      {id:'b',token:'bbbbbbbbbbbbbbbb',name:'Bob',isNpc:false,connected:true,socketId:'socket-b'}
    ],
    messages:[],gameState:null,gameRevision:0,createdAt:now,updatedAt:now
  };
}

test('lopend spel blijft in lobbyoverzicht zolang iemand aanwezig is',()=>{
  const {runtime}=harness(),room=playingRoom();runtime.rooms.set(room.id,room);
  const [summary]=runtime.openRoomSummaries();
  assert.equal(summary.id,room.id);
  assert.equal(summary.status,'playing');
  assert.equal(summary.resumable,true);
  assert.equal(summary.joinable,false);
});

test('speler kan een verlaten spel hervatten en sluit een lege game expliciet',()=>{
  const {runtime,makeSocket}=harness(),room=playingRoom();runtime.rooms.set(room.id,room);
  const first=makeSocket('socket-a',room.id,room.players[0].token);
  first.handlers.get('room:leave')({},()=>{});
  assert.equal(runtime.rooms.has(room.id),true);
  assert.equal(room.players[0].connected,false);

  const resumed=makeSocket('socket-a2',null,null);let joinResult;
  resumed.handlers.get('room:join')({roomId:room.id,name:'Ada',token:'aaaaaaaaaaaaaaaa'},result=>{joinResult=result});
  assert.equal(joinResult.resumed,true);
  assert.equal(room.players[0].connected,true);

  resumed.handlers.get('room:leave')({},()=>{});
  const second=makeSocket('socket-b',room.id,room.players[1].token);
  second.handlers.get('room:leave')({},()=>{});
  assert.equal(runtime.rooms.has(room.id),true);
  const [emptySummary]=runtime.openRoomSummaries({token:'aaaaaaaaaaaaaaaa'});
  assert.equal(emptySummary.canResume,true);
  assert.equal(emptySummary.connectedHumanCount,0);
  let closeResult;resumed.handlers.get('room:close')({roomId:room.id,token:'aaaaaaaaaaaaaaaa'},result=>{closeResult=result});
  assert.equal(closeResult.ok,true);
  assert.equal(runtime.rooms.has(room.id),true);
  assert.equal(runtime.openRoomSummaries({token:'aaaaaaaaaaaaaaaa'}).length,0);
  assert.equal(runtime.openRoomSummaries({token:'bbbbbbbbbbbbbbbb'})[0].canResume,true);
  second.handlers.get('room:close')({roomId:room.id,token:'bbbbbbbbbbbbbbbb'},result=>{closeResult=result});
  assert.equal(closeResult.ok,true);
  assert.equal(runtime.rooms.has(room.id),false);
});

test('Carcassonne-host kiest tegelset en burgers in de lobby en start met die opties',()=>{
  const {runtime,makeSocket}=harness(),host=makeSocket('host',null,null);let created;
  host.handlers.get('room:create')({gameKey:'carcassonne',name:'Ada',token:'aaaaaaaaaaaaaaaa'},result=>{created=result});
  assert.equal(created.ok,true);
  const room=runtime.rooms.get(created.roomId);
  assert.deepEqual(room.gameOptions,{tileCount:72,meepleCount:7});
  let changed;host.handlers.get('room:setOptions')({tileCount:36},result=>{changed=result});
  assert.deepEqual(changed,{ok:true,gameOptions:{tileCount:36,meepleCount:7}});
  host.handlers.get('room:setOptions')({meepleCount:10},result=>{changed=result});
  assert.deepEqual(changed,{ok:true,gameOptions:{tileCount:36,meepleCount:10}});
  host.handlers.get('room:addNpc')({},()=>{});
  let started;host.handlers.get('room:start')({},result=>{started=result});
  assert.equal(started.ok,true);
  assert.equal(room.gameState.tileCount,36);
  assert.equal(room.gameState.meepleCount,10);
  assert.deepEqual(room.gameState.players.map(player=>player.meeples),[10,10]);
  assert.equal(room.gameState.board.size+room.gameState.deck.length+Number(Boolean(room.gameState.currentTile)),36);
});

test('niet-host verlaat een afgewerkt spel definitief zonder de overige spelers te storen',()=>{
  const {runtime,makeSocket}=harness(),room=playingRoom();
  room.status='finished';room.matchRecorded=true;runtime.rooms.set(room.id,room);
  const host=makeSocket('socket-a',room.id,room.players[0].token),other=makeSocket('socket-b',room.id,room.players[1].token);
  assert.equal(invoke(host,'room:leaveFinished').ok,false);
  assert.equal(invoke(other,'room:leaveFinished').ok,true);
  assert.deepEqual(room.players.map(player=>player.id),['a']);
  assert.equal(other.socket.data.roomId,null);
  assert.equal(other.socket.data.token,null);
  assert.equal(runtime.rooms.has(room.id),true);
  assert.equal(host.socket.data.roomId,room.id);
});

test('NPCs krijgen unieke echte voornamen die bij de start behouden blijven',()=>{
  const {runtime,makeSocket}=harness(),host=makeSocket('host',null,null);
  const created=invoke(host,'room:create',{gameKey:'cascadia',name:'Ada',token:'aaaaaaaaaaaaaaaa'});
  const room=runtime.rooms.get(created.roomId);
  invoke(host,'room:addNpc');invoke(host,'room:addNpc');invoke(host,'room:addNpc');
  const npcNames=room.players.filter(player=>player.isNpc).map(player=>player.name);
  assert.equal(npcNames.length,3);
  assert.ok(npcNames.every(name=>NPC_FIRST_NAMES.includes(name)));
  assert.equal(new Set(npcNames).size,npcNames.length);
  assert.ok(npcNames.every(name=>!/^NPC(?:\s|\d|$)/i.test(name)));
  assert.equal(invoke(host,'room:start').ok,true);
  assert.deepEqual(room.gameState.players.filter(player=>player.isNpc).map(player=>player.name),npcNames);
});

test('andere human offline: geldige beurt gaat door, offline beurt blijft wachten en kan hervatten',t=>{
  const {runtime,makeSocket}=harness(),room=playingRoom();
  room.gameState=getGame(room.gameKey).createGame(room.players);runtime.rooms.set(room.id,room);
  const host=makeSocket('socket-a',room.id,room.players[0].token);
  const other=makeSocket('socket-b',room.id,room.players[1].token);
  invoke(other,'disconnect');
  assert.equal(invoke(host,'game:action',{action:'move',data:{row:7,col:4}}).ok,true);
  const before=structuredClone(room.gameState);
  t.mock.method(console,'error',()=>{});
  assert.equal(invoke(host,'game:action',{action:'move',data:{row:6,col:4}}).ok,false);
  const [tick]=maintenance(t,runtime);
  const later=Date.now()+3600000;t.mock.method(Date,'now',()=>later);
  for(let i=0;i<5;i++)tick();
  assert.equal(room.gameState.turnIndex,1);
  assert.deepEqual(room.gameState.players,before.players);
  const resumed=makeSocket('resumed',null,null);
  assert.equal(invoke(resumed,'room:join',{roomId:room.id,name:'Bob',token:room.players[1].token}).ok,true);
  assert.equal(invoke(resumed,'game:action',{action:'move',data:{row:1,col:4}}).ok,true);
});

test('NPC tick gaat door met een offline human en stopt op de menselijke beurt',t=>{
  const {runtime}=harness(),room=playingRoom();
  room.players.push({id:'c',name:'NPC',isNpc:true,connected:true},{id:'d',name:'NPC 2',isNpc:true,connected:true});
  room.players[1].connected=false;room.players[1].socketId=null;
  room.gameState=getGame(room.gameKey).createGame(room.players);
  room.gameState.turnIndex=3;room.gameState.nextNpcAt=1;room.gameState.players[3].walls=0;
  runtime.rooms.set(room.id,room);
  const [tick]=maintenance(t,runtime);tick();
  assert.equal(room.gameState.turnIndex,0);
  const positions=structuredClone(room.gameState.players);tick();
  assert.deepEqual(room.gameState.players,positions);
});

test('onderhoud pauzeert volledig verlaten games en ruimt ze na twee uur op',t=>{
  const {runtime}=harness(),room=playingRoom();
  room.players.forEach(p=>{p.connected=false;p.socketId=null});
  room.gameState=getGame(room.gameKey).createGame(room.players);runtime.rooms.set(room.id,room);
  const [tick,cleanup]=maintenance(t,runtime),updatedAt=room.updatedAt;
  t.mock.method(Date,'now',()=>updatedAt+2*60*60*1000+1);
  tick();assert.equal(room.updatedAt,updatedAt);cleanup();assert.equal(runtime.rooms.has(room.id),false);
});

test('host verwijdert online humans, offline humans en NPCs uitsluitend in de lobby',()=>{
  const {runtime,makeSocket,events}=harness(),room=playingRoom();room.status='lobby';runtime.rooms.set(room.id,room);
  const host=makeSocket('socket-a',room.id,room.players[0].token),other=makeSocket('socket-b',room.id,room.players[1].token);
  assert.equal(invoke(other,'room:removePlayer',{playerId:'a'}).ok,false);
  assert.equal(invoke(host,'room:removePlayer',{playerId:'a'}).ok,false);
  room.status='playing';assert.equal(invoke(host,'room:removePlayer',{playerId:'b'}).ok,false);room.status='lobby';
  assert.equal(invoke(host,'room:removePlayer',{playerId:'b'}).ok,true);
  assert.equal(other.socket.data.roomId,null);
  assert.ok(events.some(e=>e.id==='socket-b'&&e.event==='room:removed'&&e.payload.roomId===room.id));
  assert.equal(invoke(other,'room:start').ok,false);
  room.players.push({id:'offline',name:'Offline',token:'cccccccccccccccc',isNpc:false,connected:false});
  assert.equal(invoke(host,'room:removePlayer',{playerId:'offline'}).ok,true);
  invoke(host,'room:addNpc');const npc=room.players.find(p=>p.isNpc);
  assert.equal(invoke(host,'room:removePlayer',{playerId:npc.id}).ok,true);
  assert.deepEqual(room.players.map(p=>p.id),['a']);
});

test('hostoverdracht wacht 15 seconden, wordt geannuleerd bij reconnect en blijft na overdracht staan',t=>{
  const {runtime,makeSocket}=harness(),room=playingRoom();room.status='lobby';runtime.rooms.set(room.id,room);
  let now=100000;t.mock.method(Date,'now',()=>now);
  const host=makeSocket('socket-a',room.id,room.players[0].token);makeSocket('socket-b',room.id,room.players[1].token);
  const [tick]=maintenance(t,runtime);invoke(host,'disconnect');now+=14999;tick();assert.equal(room.hostToken,'aaaaaaaaaaaaaaaa');
  const resumed=makeSocket('resumed',null,null);invoke(resumed,'room:join',{roomId:room.id,name:'Ada',token:'aaaaaaaaaaaaaaaa'});
  now+=15000;tick();assert.equal(room.hostToken,'aaaaaaaaaaaaaaaa');
  invoke(resumed,'disconnect');now+=15000;tick();assert.equal(room.hostToken,'bbbbbbbbbbbbbbbb');
  invoke(resumed,'room:join',{roomId:room.id,name:'Ada',token:'aaaaaaaaaaaaaaaa'});
  assert.equal(room.hostToken,'bbbbbbbbbbbbbbbb');
});

test('vervangen socket kan geen acties of hostbeheer meer uitvoeren',()=>{
  const {runtime,makeSocket}=harness(),room=playingRoom();room.status='lobby';runtime.rooms.set(room.id,room);
  const old=makeSocket('socket-a',room.id,room.players[0].token),fresh=makeSocket('fresh',null,null);
  invoke(fresh,'room:join',{roomId:room.id,name:'Ada',token:'aaaaaaaaaaaaaaaa'});
  assert.equal(invoke(old,'room:removePlayer',{playerId:'b'}).ok,false);
  assert.equal(invoke(fresh,'room:removePlayer',{playerId:'b'}).ok,true);
});

test('naar lobby bewaart room, spelers en opties en laat een nieuwe game starten zonder dubbele score',t=>{
  const {runtime,makeSocket}=harness(),host=makeSocket('host',null,null);
  const created=invoke(host,'room:create',{gameKey:'carcassonne',name:'Ada',token:'aaaaaaaaaaaaaaaa'});
  const other=makeSocket('other',null,null);invoke(other,'room:join',{roomId:created.roomId,name:'Bob',token:'bbbbbbbbbbbbbbbb'});
  invoke(host,'room:setOptions',{tileCount:36,meepleCount:10});invoke(host,'room:start');
  const room=runtime.rooms.get(created.roomId),roster=room.players.map(p=>p.id);
  assert.equal(invoke(host,'room:returnToLobby').ok,false);
  room.gameState.gameOver=true;room.status='finished';room.matchRecorded=true;
  const db=require('../src/db'),record=t.mock.method(db,'recordMatch',()=>{throw new Error('dubbele score')});
  assert.equal(invoke(other,'room:returnToLobby').ok,false);
  invoke(other,'disconnect');
  assert.equal(invoke(host,'room:returnToLobby').ok,true);
  assert.equal(room.status,'lobby');assert.equal(room.gameState,null);assert.equal(room.startedAt,null);
  assert.deepEqual(room.players.map(p=>p.id),roster);assert.deepEqual(room.gameOptions,{tileCount:36,meepleCount:10});
  assert.equal(invoke(host,'room:start').ok,false);
  invoke(host,'room:removePlayer',{playerId:roster[1]});invoke(host,'room:addNpc');
  assert.equal(invoke(host,'room:start').ok,true);assert.equal(room.gameState.tileCount,36);
  assert.equal(record.mock.callCount(),0);
});

test('kruisje wist alleen eigen hervatrecht, bewaart spelposities en verwijdert de room bij de laatste human',()=>{
  const {runtime,makeSocket}=harness(),room=playingRoom();room.gameState=getGame(room.gameKey).createGame(room.players);runtime.rooms.set(room.id,room);
  const host=makeSocket('socket-a',room.id,room.players[0].token),other=makeSocket('socket-b',room.id,room.players[1].token);
  const stranger=makeSocket('stranger',null,null);
  assert.equal(invoke(stranger,'room:close',{roomId:room.id,token:'cccccccccccccccc'}).ok,false);
  assert.equal(invoke(host,'room:close',{roomId:room.id,token:'aaaaaaaaaaaaaaaa'}).ok,false);
  invoke(host,'room:leave');
  assert.equal(invoke(host,'room:close',{roomId:room.id,token:'aaaaaaaaaaaaaaaa'}).ok,true);
  assert.equal(runtime.rooms.has(room.id),true);assert.equal(room.gameState.players.length,2);
  assert.equal(runtime.openRoomSummaries({token:'aaaaaaaaaaaaaaaa'})[0].canResume,false);
  assert.equal(invoke(host,'room:join',{roomId:room.id,name:'Ada',token:'aaaaaaaaaaaaaaaa'}).ok,false);
  invoke(other,'room:leave');invoke(other,'room:close',{roomId:room.id,token:'bbbbbbbbbbbbbbbb'});
  assert.equal(runtime.rooms.has(room.id),false);
});
