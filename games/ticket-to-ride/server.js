const COLORS=['red','blue','green','yellow','purple'];
const WILD='wild';
const START_TRAINS=30;
const ROUTE_POINTS={1:1,2:2,3:4,4:7,5:10};

const CITIES=[
  {id:'lisbon',name:'Lissabon',x:78,y:475},
  {id:'madrid',name:'Madrid',x:168,y:430},
  {id:'paris',name:'Parijs',x:305,y:305},
  {id:'london',name:'Londen',x:235,y:215},
  {id:'brussels',name:'Brussel',x:355,y:258},
  {id:'amsterdam',name:'Amsterdam',x:382,y:196},
  {id:'berlin',name:'Berlijn',x:535,y:220},
  {id:'copenhagen',name:'Kopenhagen',x:535,y:112},
  {id:'warsaw',name:'Warschau',x:665,y:220},
  {id:'prague',name:'Praag',x:570,y:300},
  {id:'vienna',name:'Wenen',x:630,y:350},
  {id:'zurich',name:'Zürich',x:442,y:348},
  {id:'milan',name:'Milaan',x:472,y:425},
  {id:'rome',name:'Rome',x:530,y:520},
  {id:'venice',name:'Venetië',x:555,y:412},
  {id:'budapest',name:'Boedapest',x:682,y:390},
  {id:'zagreb',name:'Zagreb',x:632,y:447},
  {id:'belgrade',name:'Belgrado',x:720,y:462},
  {id:'athens',name:'Athene',x:747,y:575},
  {id:'istanbul',name:'Istanbul',x:865,y:525}
];

const ROUTES=[
  ['lisbon','madrid',3,'red'],['madrid','paris',4,'blue'],['madrid','zurich',4,'yellow'],['madrid','milan',5,'green'],
  ['paris','london',2,'purple'],['paris','brussels',2,'yellow'],['paris','zurich',3,'green'],['paris','milan',4,'red'],
  ['london','amsterdam',3,'blue'],['london','brussels',2,'green'],['brussels','amsterdam',1,'red'],['brussels','berlin',4,'purple'],
  ['amsterdam','berlin',3,'yellow'],['amsterdam','copenhagen',3,'green'],['copenhagen','berlin',2,'red'],['copenhagen','warsaw',4,'blue'],
  ['berlin','warsaw',3,'green'],['berlin','prague',2,'blue'],['berlin','vienna',4,'yellow'],['prague','warsaw',3,'red'],
  ['prague','vienna',2,'purple'],['prague','zurich',3,'yellow'],['zurich','vienna',3,'red'],['zurich','milan',2,'blue'],
  ['milan','venice',2,'yellow'],['milan','rome',3,'purple'],['venice','vienna',2,'green'],['venice','zagreb',2,'red'],
  ['venice','rome',3,'blue'],['vienna','budapest',1,'blue'],['vienna','zagreb',2,'purple'],['budapest','warsaw',4,'yellow'],
  ['budapest','zagreb',2,'green'],['budapest','belgrade',2,'red'],['zagreb','belgrade',2,'blue'],['belgrade','athens',4,'green'],
  ['belgrade','istanbul',4,'purple'],['athens','istanbul',4,'yellow'],['rome','athens',5,'red']
].map(([a,b,length,color],index)=>({id:`r${index+1}`,a,b,length,color,ownerId:null}));

const TICKETS=[
  ['lisbon','paris',7],['lisbon','london',9],['lisbon','rome',12],['lisbon','istanbul',20],['madrid','london',8],
  ['madrid','amsterdam',9],['madrid','berlin',11],['paris','berlin',8],['paris','rome',10],['paris','budapest',13],
  ['london','berlin',9],['london','warsaw',13],['amsterdam','prague',7],['amsterdam','vienna',9],['copenhagen','vienna',10],
  ['copenhagen','budapest',12],['berlin','milan',9],['berlin','rome',11],['berlin','athens',15],['warsaw','vienna',7],
  ['warsaw','istanbul',13],['prague','milan',7],['prague','belgrade',9],['zurich','budapest',8],['zurich','rome',7],
  ['milan','budapest',8],['milan','athens',12],['rome','istanbul',12],['vienna','athens',10],['budapest','istanbul',9]
].map(([a,b,value],index)=>({id:`t${index+1}`,a,b,value}));

function shuffled(items){
  const out=items.map(item=>typeof item==='object'?{...item}:item);
  for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
  return out;
}
function cityName(id){return CITIES.find(city=>city.id===id)?.name||id}
function playerById(game,id){return game.players.find(player=>player.id===id)}
function currentPlayer(game){return game.players[game.turnIndex]}
function addLog(game,text){game.log.unshift(text);game.log=game.log.slice(0,30)}
function makeTrainDeck(){return shuffled([...COLORS.flatMap(color=>Array(10).fill(color)),...Array(8).fill(WILD)])}
function ensureTrainDeck(game){
  if(game.trainDeck.length)return;
  if(!game.discard.length)return;
  game.trainDeck=shuffled(game.discard);
  game.discard=[];
}
function drawTrainFromDeck(game){ensureTrainDeck(game);return game.trainDeck.pop()||null}
function refillMarket(game){while(game.market.length<5){const card=drawTrainFromDeck(game);if(!card)break;game.market.push(card)}}
function drawTicketsFromDeck(game,count){return game.ticketDeck.splice(Math.max(0,game.ticketDeck.length-count),count)}
function trainCounts(hand){return hand.reduce((counts,color)=>{counts[color]=(counts[color]||0)+1;return counts},{})}

function createGame(roomPlayers){
  if(roomPlayers.length<2||roomPlayers.length>5)throw new Error('Ticket to Ride is voor 2 tot 5 spelers.');
  const trainDeck=makeTrainDeck();
  const players=roomPlayers.map((player,index)=>({
    id:player.id,name:player.name,isNpc:player.isNpc,index,trains:START_TRAINS,routeScore:0,ticketScore:0,totalScore:0,
    hand:[],tickets:[],completedTickets:0
  }));
  for(let round=0;round<4;round++)for(const player of players){const card=trainDeck.pop();if(card)player.hand.push(card)}
  const ticketDeck=shuffled(TICKETS);
  for(const player of players)player.tickets.push(...drawTicketsFromDeck({ticketDeck},2));
  const game={
    gameKey:'ticket-to-ride',players,routes:ROUTES.map(route=>({...route})),trainDeck,discard:[],market:[],ticketDeck,
    pendingTickets:{},turnIndex:0,drawCount:0,finalTurnsLeft:null,finalTriggerId:null,gameOver:false,winnerId:null,winnerIds:[],
    resultText:'',log:['Verbind je bestemmingen en scoor zoveel mogelijk punten.']
  };
  refillMarket(game);
  return game;
}

function assertCurrentPlayer(game,playerId){
  if(game.gameOver)throw new Error('Het spel is afgelopen.');
  const player=currentPlayer(game);
  if(!player||player.id!==playerId||player.isNpc)throw new Error('Je bent niet aan de beurt.');
  return player;
}
function hasPendingTickets(game,playerId){return Array.isArray(game.pendingTickets[playerId])&&game.pendingTickets[playerId].length>0}

function finishGame(game){
  for(const player of game.players){
    let ticketScore=0,completed=0;
    for(const ticket of player.tickets){
      if(ticketConnected(game,player.id,ticket)){ticketScore+=ticket.value;completed+=1}
      else ticketScore-=ticket.value;
    }
    player.ticketScore=ticketScore;
    player.completedTickets=completed;
    player.totalScore=player.routeScore+ticketScore;
  }
  const ranked=[...game.players].sort((a,b)=>b.totalScore-a.totalScore||b.completedTickets-a.completedTickets||b.trains-a.trains);
  const best=ranked[0];
  game.winnerIds=ranked.filter(player=>player.totalScore===best.totalScore&&player.completedTickets===best.completedTickets&&player.trains===best.trains).map(player=>player.id);
  game.winnerId=game.winnerIds[0]||null;
  game.gameOver=true;
  game.resultText=game.winnerIds.length>1?`Gelijkspel op ${best.totalScore} punten.`:`${best.name} wint met ${best.totalScore} punten.`;
  addLog(game,game.resultText);
}

function endTurn(game){
  const ending=currentPlayer(game);
  game.drawCount=0;
  if(game.finalTurnsLeft!==null&&ending.id!==game.finalTriggerId){
    game.finalTurnsLeft-=1;
    if(game.finalTurnsLeft<=0){finishGame(game);return}
  }
  game.turnIndex=(game.turnIndex+1)%game.players.length;
}

function drawTrain(game,playerId,payload={}){
  const player=assertCurrentPlayer(game,playerId);
  if(hasPendingTickets(game,playerId))throw new Error('Kies eerst welke bestemmingen je houdt.');
  if(game.drawCount>=2)throw new Error('Je hebt al twee kaarten getrokken.');
  let card=null;
  if(payload.source==='market'){
    const index=Number(payload.index);
    if(!Number.isInteger(index)||index<0||index>=game.market.length)throw new Error('Die open kaart bestaat niet.');
    card=game.market.splice(index,1)[0];
    refillMarket(game);
  }else if(payload.source==='deck'){
    card=drawTrainFromDeck(game);
  }else throw new Error('Kies een kaart van de stapel of uit de open markt.');
  if(!card)throw new Error('Er zijn geen treinkaarten meer.');
  player.hand.push(card);
  game.drawCount+=1;
  if(game.drawCount>=2){addLog(game,`${player.name} trekt twee treinkaarten.`);endTurn(game)}
}

function claimRoute(game,playerId,payload={}){
  const player=assertCurrentPlayer(game,playerId);
  if(game.drawCount>0)throw new Error('Je bent al kaarten aan het trekken.');
  if(hasPendingTickets(game,playerId))throw new Error('Kies eerst welke bestemmingen je houdt.');
  const route=game.routes.find(item=>item.id===payload.routeId);
  if(!route)throw new Error('Onbekende route.');
  if(route.ownerId)throw new Error('Deze route is al bezet.');
  if(player.trains<route.length)throw new Error('Je hebt niet genoeg treintjes.');
  const counts=trainCounts(player.hand);
  const colorCount=counts[route.color]||0,wildCount=counts[WILD]||0;
  if(colorCount+wildCount<route.length)throw new Error(`Je hebt ${route.length} ${route.color} kaarten of jokers nodig.`);
  let need=route.length;
  const paid=[];
  for(let i=player.hand.length-1;i>=0&&need>0;i--)if(player.hand[i]===route.color){paid.push(player.hand.splice(i,1)[0]);need--}
  for(let i=player.hand.length-1;i>=0&&need>0;i--)if(player.hand[i]===WILD){paid.push(player.hand.splice(i,1)[0]);need--}
  game.discard.push(...paid);
  route.ownerId=player.id;
  player.trains-=route.length;
  player.routeScore+=ROUTE_POINTS[route.length]||route.length;
  addLog(game,`${player.name} bouwt ${cityName(route.a)} – ${cityName(route.b)} voor ${ROUTE_POINTS[route.length]||route.length} punten.`);
  if(game.finalTurnsLeft===null&&player.trains<=2){
    game.finalTurnsLeft=game.players.length-1;
    game.finalTriggerId=player.id;
    addLog(game,`${player.name} heeft nog ${player.trains} treintjes. Iedereen krijgt nog één laatste beurt.`);
  }
  endTurn(game);
}

function drawTickets(game,playerId){
  const player=assertCurrentPlayer(game,playerId);
  if(game.drawCount>0)throw new Error('Je bent al treinkaarten aan het trekken.');
  if(hasPendingTickets(game,playerId))throw new Error('Je hebt al bestemmingen getrokken.');
  const drawn=drawTicketsFromDeck(game,3);
  if(!drawn.length)throw new Error('Er zijn geen bestemmingskaarten meer.');
  game.pendingTickets[playerId]=drawn;
  addLog(game,`${player.name} bekijkt nieuwe bestemmingen.`);
}

function keepTickets(game,playerId,payload={}){
  const player=assertCurrentPlayer(game,playerId);
  const pending=game.pendingTickets[playerId]||[];
  if(!pending.length)throw new Error('Je hebt geen bestemmingen om te kiezen.');
  const keepIds=new Set(Array.isArray(payload.ticketIds)?payload.ticketIds.map(String):[]);
  const kept=pending.filter(ticket=>keepIds.has(ticket.id));
  if(!kept.length)throw new Error('Je moet minstens één bestemming houden.');
  const rejected=pending.filter(ticket=>!keepIds.has(ticket.id));
  player.tickets.push(...kept);
  game.ticketDeck.unshift(...rejected);
  delete game.pendingTickets[playerId];
  addLog(game,`${player.name} houdt ${kept.length} nieuwe bestemming${kept.length===1?'':'en'}.`);
  endTurn(game);
}

function ticketConnected(game,playerId,ticket){
  const adjacency=new Map(CITIES.map(city=>[city.id,[]]));
  for(const route of game.routes)if(route.ownerId===playerId){adjacency.get(route.a)?.push(route.b);adjacency.get(route.b)?.push(route.a)}
  const seen=new Set([ticket.a]),queue=[ticket.a];
  while(queue.length){
    const city=queue.shift();
    if(city===ticket.b)return true;
    for(const next of adjacency.get(city)||[])if(!seen.has(next)){seen.add(next);queue.push(next)}
  }
  return false;
}

function handleAction(game,playerId,action,payload){
  if(action==='drawTrain')return drawTrain(game,playerId,payload);
  if(action==='claimRoute')return claimRoute(game,playerId,payload);
  if(action==='drawTickets')return drawTickets(game,playerId);
  if(action==='keepTickets')return keepTickets(game,playerId,payload);
  throw new Error('Onbekende actie.');
}

function publicTicket(game,playerId,ticket){return {...ticket,from:cityName(ticket.a),to:cityName(ticket.b),connected:ticketConnected(game,playerId,ticket)}}
function serialize(game,requesterId,connected){
  const me=playerById(game,requesterId);
  const turn=currentPlayer(game);
  return {
    kind:game.gameKey,gameOver:game.gameOver,winnerId:game.winnerId,winnerIds:game.winnerIds,resultText:game.resultText,
    turnPlayerId:game.gameOver?null:turn?.id||null,drawsRemaining:turn?.id===requesterId?Math.max(0,2-game.drawCount):0,
    finalTurnsLeft:game.finalTurnsLeft,finalTriggerId:game.finalTriggerId,cities:CITIES,routes:game.routes,
    market:[...game.market],deckCount:game.trainDeck.length+game.discard.length,ticketDeckCount:game.ticketDeck.length,
    players:game.players.map(player=>({
      id:player.id,name:player.name,isNpc:player.isNpc,index:player.index,trains:player.trains,routeScore:player.routeScore,
      ticketScore:game.gameOver?player.ticketScore:null,totalScore:game.gameOver?player.totalScore:player.routeScore,
      handCount:player.hand.length,ticketCount:player.tickets.length,completedTickets:game.gameOver?player.completedTickets:null,
      connected:player.isNpc||connected.get(player.id),tickets:(player.id===requesterId||game.gameOver)?player.tickets.map(ticket=>publicTicket(game,player.id,ticket)):undefined
    })),
    hand:me?[...me.hand]:[],handCounts:me?trainCounts(me.hand):{},
    pendingTickets:(game.pendingTickets[requesterId]||[]).map(ticket=>publicTicket(game,requesterId,ticket)),
    canAct:!game.gameOver&&turn?.id===requesterId,canClaim:!game.gameOver&&turn?.id===requesterId&&game.drawCount===0&&!hasPendingTickets(game,requesterId),
    canDrawTickets:!game.gameOver&&turn?.id===requesterId&&game.drawCount===0&&!hasPendingTickets(game,requesterId)&&game.ticketDeck.length>0,
    log:game.log.slice(0,24)
  };
}

function results(game){
  const ranked=[...game.players].sort((a,b)=>b.totalScore-a.totalScore||b.completedTickets-a.completedTickets||b.trains-a.trains);
  return game.players.map(player=>({
    playerId:player.id,placement:ranked.findIndex(item=>item.id===player.id)+1,score:player.totalScore,
    won:game.winnerIds.includes(player.id),outcome:game.winnerIds.includes(player.id)?'Wint':'Verliest'
  }));
}

module.exports={createGame,handleAction,serialize,results,ticketConnected,CITIES,ROUTES,TICKETS};
