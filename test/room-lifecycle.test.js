const test=require('node:test');
const assert=require('node:assert/strict');
const {createRealtime}=require('../src/server/realtime');

function harness(){
  let connect;
  const io={
    use(){},
    on(event,handler){if(event==='connection')connect=handler},
    to(){return{emit(){}}},
    sockets:{sockets:new Map()}
  };
  const runtime=createRealtime(io);
  const makeSocket=(id,roomId,token)=>{
    const handlers=new Map();
    const socket={id,data:{roomId,token,authUser:null},on:(event,handler)=>handlers.set(event,handler),join(){},leave(){}};
    io.sockets.sockets.set(id,socket);connect(socket);return{socket,handlers};
  };
  return{runtime,makeSocket};
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

test('speler kan een lopend spel hervatten en laatste vertrek verwijdert de room',()=>{
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
  assert.equal(runtime.rooms.has(room.id),false);
});

test('Carcassonne-host kiest de tegelset in de lobby en start met die optie',()=>{
  const {runtime,makeSocket}=harness(),host=makeSocket('host',null,null);let created;
  host.handlers.get('room:create')({gameKey:'carcassonne',name:'Ada',token:'aaaaaaaaaaaaaaaa'},result=>{created=result});
  assert.equal(created.ok,true);
  const room=runtime.rooms.get(created.roomId);
  assert.deepEqual(room.gameOptions,{tileCount:72});
  let changed;host.handlers.get('room:setOptions')({tileCount:36},result=>{changed=result});
  assert.deepEqual(changed,{ok:true,gameOptions:{tileCount:36}});
  host.handlers.get('room:addNpc')({},()=>{});
  let started;host.handlers.get('room:start')({},result=>{started=result});
  assert.equal(started.ok,true);
  assert.equal(room.gameState.tileCount,36);
  assert.equal(room.gameState.board.size+room.gameState.deck.length+Number(Boolean(room.gameState.currentTile)),36);
});
