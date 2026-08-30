const test=require('node:test');
const assert=require('node:assert/strict');
const gameModule=require('../games/ticket-to-ride/server');

function players(){return [{id:'a',name:'A',isNpc:false},{id:'b',name:'B',isNpc:false}]}

test('Ticket to Ride start met kaarten, tickets en treintjes',()=>{
  const game=gameModule.createGame(players());
  assert.equal(game.players.length,2);
  assert.equal(game.players[0].hand.length,4);
  assert.equal(game.players[0].tickets.length,2);
  assert.equal(game.players[0].trains,30);
  assert.equal(game.market.length,5);
});

test('Ticket to Ride claimt alleen betaalbare vrije routes en wisselt de beurt',()=>{
  const game=gameModule.createGame(players());
  const route=game.routes[0];
  game.players[0].hand=Array(route.length).fill(route.color);
  gameModule.handleAction(game,'a','claimRoute',{routeId:route.id});
  assert.equal(route.ownerId,'a');
  assert.equal(game.players[0].trains,30-route.length);
  assert.equal(game.players[0].routeScore,4);
  assert.equal(game.turnIndex,1);
});

test('Ticket to Ride houdt tickets geheim voor andere spelers',()=>{
  const game=gameModule.createGame(players());
  const connected=new Map([['a',true],['b',true]]);
  const state=gameModule.serialize(game,'a',connected);
  assert.equal(state.players.find(player=>player.id==='a').tickets.length,2);
  assert.equal(state.players.find(player=>player.id==='b').tickets,undefined);
});
