const { makeDeck, shuffle, cardLabel } = require('../../src/cards');

const meta = {
  key:'blackjack', name:'Blackjack', description:'Versla de dealer zonder boven 21 te gaan.',
  minPlayers:1, maxPlayers:4, supportsNpc:true, realtime:false, solo:false
};

const NPC_DELAY=760, ROUND_DELAY=120, BASE_BET=10;

function handValue(cards){
  let total=0,aces=0;
  for(const card of cards){
    if(card.rank==='A'){total+=11;aces+=1}
    else if(['K','Q','J'].includes(card.rank))total+=10;
    else total+=Number(card.rank);
  }
  while(total>21&&aces>0){total-=10;aces-=1}
  return total;
}

function isNatural(cards){return cards.length===2&&handValue(cards)===21}
function makeHand(cards,bet=BASE_BET,fromSplit=false){return {cards,status:'playing',bet,result:'',chipDelta:0,doubled:false,betCommitted:false,fromSplit}}
function handsOf(player){
  if(!player.hands){
    const hand=makeHand(player.hand||[],player.bet||BASE_BET,false);
    hand.status=player.status||'playing';hand.result=player.result||'';hand.doubled=Boolean(player.doubled);hand.betCommitted=Boolean(player.betCommitted);
    player.hands=[hand];player.activeHandIndex=0;
  }
  return player.hands;
}
function activeHand(player){return handsOf(player)[player.activeHandIndex||0]}
function syncLegacy(player){const hand=activeHand(player)||handsOf(player)[0];player.hand=hand.cards;player.status=hand.status;player.bet=hand.bet;player.result=hand.result;player.doubled=hand.doubled;player.betCommitted=hand.betCommitted}
function canSplitHand(player,hand){return hand.cards.length===2&&hand.cards[0].rank===hand.cards[1].rank&&handsOf(player).length<4&&player.chips>=hand.bet*(handsOf(player).length+1)}

function advanceTurn(game){
  const start=game.turnIndex;
  const current=game.players[start];
  const nextHand=handsOf(current).findIndex((hand,index)=>index>(current.activeHandIndex||0)&&hand.status==='playing');
  if(nextHand>=0){current.activeHandIndex=nextHand;syncLegacy(current);prepareNext(game);return}
  game.turnIndex=(start+1)%game.players.length;prepareNext(game);
}

function prepareNext(game,delay=NPC_DELAY){
  if(game.phase==='round_end')return;
  if(game.players.every((player)=>handsOf(player).every((hand)=>hand.status!=='playing'))){
    game.phase='dealer';game.turnIndex=-1;game.nextNpcAt=Date.now()+delay;return;
  }
  game.phase='players';
  let guard=0;
  while(guard++<game.players.length&&handsOf(game.players[game.turnIndex]).every((hand)=>hand.status!=='playing'))game.turnIndex=(game.turnIndex+1)%game.players.length;
  const nextHand=handsOf(game.players[game.turnIndex]).findIndex((hand)=>hand.status==='playing');
  if(nextHand>=0)game.players[game.turnIndex].activeHandIndex=nextHand;
  const player=game.players[game.turnIndex];game.nextNpcAt=player?.isNpc?Date.now()+delay:0;
}

function dealRound(game){
  game.deck=shuffle(makeDeck());game.dealer={hand:[game.deck.pop(),game.deck.pop()]};
  for(const player of game.players){
    player.hands=[makeHand([game.deck.pop(),game.deck.pop()])];player.activeHandIndex=0;player.hand=player.hands[0].cards;player.status='playing';
    player.result='';player.chipDelta=0;player.resetChips=false;player.doubled=false;player.betCommitted=false;
    player.bet=Math.min(BASE_BET,Math.max(0,Number(player.chips||100)));
  }
  game.turnIndex=0;game.phase='players';game.nextNpcAt=0;game.roundEndsAt=0;
  if(game.roundNumber===0)game.lastRoundText='';
  game.roundNumber+=1;game.roundStartedAt=Date.now();prepareNext(game,650);
}

function createGame(roomPlayers){
  const game={
    gameKey:meta.key,
    players:roomPlayers.map((player)=>({
      id:player.id,name:player.name,isNpc:player.isNpc,chips:Number(player.blackjackChips??100),
      hand:[],status:'playing',result:'',bet:BASE_BET,doubled:false,betCommitted:false,chipDelta:0,resetChips:false
    })),
    deck:[],dealer:{hand:[]},turnIndex:0,phase:'players',nextNpcAt:0,gameOver:false,
    resultText:'',lastRoundText:'',roundNumber:0,roundEndsAt:0,pendingChipUpdates:[],pendingRoundRecord:null,log:[]
  };
  dealRound(game);return game;
}

function applyHandPayout(game,player,hand){
  if(!hand.betCommitted){hand.result='Niet ingezet';hand.chipDelta=0;return}
  const value=handValue(hand.cards),dealerValue=handValue(game.dealer.hand);
  const playerNatural=!hand.fromSplit&&isNatural(hand.cards),dealerNatural=isNatural(game.dealer.hand);
  let multiplier=0;
  if(value>21){hand.result='Bust';multiplier=-1}
  else if(playerNatural&&dealerNatural){hand.result='Push';multiplier=0}
  else if(playerNatural){hand.result='Blackjack';multiplier=1.5}
  else if(dealerNatural){hand.result='Verliest';multiplier=-1}
  else if(dealerValue>21||value>dealerValue){hand.result='Wint';multiplier=1}
  else if(value===dealerValue){hand.result='Push';multiplier=0}
  else{hand.result='Verliest';multiplier=-1}
  hand.chipDelta=hand.bet*multiplier;player.chips+=hand.chipDelta;
}

function applyPayout(game,player){
  for(const hand of handsOf(player))applyHandPayout(game,player,hand);
  player.chipDelta=handsOf(player).reduce((sum,hand)=>sum+hand.chipDelta,0);
  player.result=handsOf(player).map((hand)=>hand.result).join(' / ');
  if(player.chips<=0){player.chips=100;player.resetChips=true}
  if(!player.isNpc)game.pendingChipUpdates.push({playerId:player.id,chips:player.chips,delta:player.chipDelta});
}

function settleFinal(game,now=Date.now()){
  for(const player of game.players)applyPayout(game,player);
  const dealerValue=handValue(game.dealer.hand);
  game.phase='round_end';game.nextNpcAt=0;game.roundEndsAt=now+ROUND_DELAY;
  const summaries=game.players.map((player)=>`${player.name}: ${player.chipDelta>0?'+':''}${player.chipDelta} chips${player.resetChips?' · reset naar 100':''}`);
  game.lastRoundText=summaries.join(' · ');game.resultText=game.lastRoundText;
  game.pendingRoundRecord={
    startedAt:game.roundStartedAt,
    endedAt:now,
    players:game.players.map((player)=>({
      playerId:player.id,
      placement:['Blackjack','Wint'].includes(player.result)?1:player.result==='Push'?2:3,
      score:player.chipDelta,
      won:['Blackjack','Wint'].includes(player.result),
      outcome:player.result
    }))
  };
  game.log.unshift(`Ronde ${game.roundNumber}: ${game.lastRoundText}`);
  game.log.unshift(`Dealer eindigt op ${dealerValue}${dealerValue>21?' (bust)':''}.`);
}

function npcStep(game,player){
  const hand=activeHand(player);hand.betCommitted=true;syncLegacy(player);
  const value=handValue(hand.cards);
  if(value<17){
    const card=game.deck.pop();hand.cards.push(card);game.log.unshift(`${player.name} trekt ${cardLabel(card)}.`);
    if(handValue(hand.cards)>21){hand.status='bust';syncLegacy(player);advanceTurn(game);return}
  }else{hand.status='stand';syncLegacy(player);advanceTurn(game);return}
  prepareNext(game);
}

function dealerStep(game,now){
  const value=handValue(game.dealer.hand);
  if(value<17){const card=game.deck.pop();game.dealer.hand.push(card);game.log.unshift(`Dealer trekt ${cardLabel(card)}.`);game.nextNpcAt=now+NPC_DELAY}
  else settleFinal(game,now);
}

function tick(game,now=Date.now()){
  if(game.phase==='round_end')return false;
  if(game.phase==='dealer'){
    if(!game.nextNpcAt)game.nextNpcAt=now+NPC_DELAY;
    if(now<game.nextNpcAt)return false;
    dealerStep(game,now);return true;
  }
  const player=game.players[game.turnIndex];
  if(!player?.isNpc){game.nextNpcAt=0;return false}
  if(!game.nextNpcAt)game.nextNpcAt=now+NPC_DELAY;
  if(now<game.nextNpcAt)return false;
  npcStep(game,player);return true;
}

function handleAction(game,playerId,action){
  if(game.phase==='round_end'){
    if(action!=='newRound')throw new Error('Start eerst een nieuwe ronde.');
    if(!game.players.some((player)=>player.id===playerId&&!player.isNpc))throw new Error('Speler niet gevonden.');
    dealRound(game);return;
  }
  if(game.phase!=='players')throw new Error('De dealer is bezig.');
  const player=game.players[game.turnIndex];
  if(!player||player.id!==playerId||player.isNpc)throw new Error('Je bent niet aan de beurt.');
  const hand=activeHand(player);hand.betCommitted=true;game.lastRoundText='';
  if(action==='hit'){
    const card=game.deck.pop();hand.cards.push(card);game.log.unshift(`${player.name} trekt ${cardLabel(card)}.`);
    if(handValue(hand.cards)>21){hand.status='bust';syncLegacy(player);advanceTurn(game)}else syncLegacy(player)
  }else if(action==='stand'){
    hand.status='stand';game.log.unshift(`${player.name} past.`);syncLegacy(player);advanceTurn(game);
  }else if(action==='double'){
    if(hand.cards.length!==2||hand.doubled)throw new Error('Je kunt alleen met je eerste twee kaarten verdubbelen.');
    if(player.chips<hand.bet*2)throw new Error('Je hebt niet genoeg chips om te verdubbelen.');
    hand.bet*=2;hand.doubled=true;
    const card=game.deck.pop();hand.cards.push(card);hand.status=handValue(hand.cards)>21?'bust':'stand';syncLegacy(player);
    game.log.unshift(`${player.name} verdubbelt en trekt ${cardLabel(card)}.`);
    advanceTurn(game);
  }else if(action==='split'){
    if(!canSplitHand(player,hand))throw new Error('Deze hand kan niet gesplitst worden.');
    const secondCard=hand.cards.pop();hand.cards.push(game.deck.pop());hand.fromSplit=true;hand.betCommitted=true;
    const second=makeHand([secondCard,game.deck.pop()],hand.bet,true);second.betCommitted=true;
    player.hands.splice((player.activeHandIndex||0)+1,0,second);
    if(hand.cards[0].rank==='A'){hand.status='stand';second.status='stand';syncLegacy(player);advanceTurn(game)}else syncLegacy(player);
    game.log.unshift(`${player.name} splitst de hand.`);
  }else throw new Error('Onbekende actie.');
}

function serialize(game,requesterId,connected){
  const revealDealer=game.phase!=='players';
  const dealerVisible=revealDealer?game.dealer.hand:[game.dealer.hand[0],{hidden:true}];
  return {
    kind:meta.key,phase:game.phase,gameOver:false,resultText:game.resultText,lastRoundText:game.lastRoundText,
    roundNumber:game.roundNumber,roundEndsAt:game.roundEndsAt,
    turnPlayerId:game.phase==='players'?game.players[game.turnIndex]?.id:null,
    dealer:{hand:dealerVisible,value:revealDealer?handValue(game.dealer.hand):null},log:game.log,
    players:game.players.map((player)=>{
      const hands=handsOf(player),current=activeHand(player);syncLegacy(player);
      return {
        id:player.id,name:player.name,isNpc:player.isNpc,connected:player.isNpc||connected.get(player.id),
        hand:current.cards,value:handValue(current.cards),status:current.status,result:player.result,activeHandIndex:player.activeHandIndex||0,
        hands:hands.map((hand)=>({cards:hand.cards,value:handValue(hand.cards),status:hand.status,result:hand.result,bet:hand.bet,betCommitted:hand.betCommitted,chipDelta:hand.chipDelta,doubled:hand.doubled})),
        chips:player.chips,bet:current.bet,betCommitted:current.betCommitted,chipDelta:player.chipDelta,resetChips:player.resetChips,
        canDouble:player.id===requesterId&&game.phase==='players'&&game.players[game.turnIndex]?.id===player.id&&current.cards.length===2&&player.chips>=current.bet*2,
        canSplit:player.id===requesterId&&game.phase==='players'&&game.players[game.turnIndex]?.id===player.id&&canSplitHand(player,current)
      };
    })
  };
}

function results(game){return game.players.map(p=>({playerId:p.id,placement:p.result==='Wint'?1:p.result==='Push'?2:3,score:p.score,won:p.result==='Wint',outcome:p.result}))}

function preparePlayers(players,{db}){return players.map(player=>({...player,blackjackChips:player.userId?db.getBlackjackChips(player.userId):100}))}
function afterStateChange(room,{db}){
  const updates=room.gameState?.pendingChipUpdates?.splice(0)||[];
  for(const update of updates){const roomPlayer=room.players.find(player=>player.id===update.playerId);if(!roomPlayer?.userId)continue;const persisted=db.setBlackjackChips(roomPlayer.userId,update.chips),gamePlayer=room.gameState.players.find(player=>player.id===update.playerId);if(gamePlayer){gamePlayer.chips=persisted.chips;gamePlayer.resetChips=persisted.reset}}
  const round=room.gameState?.pendingRoundRecord;if(!round)return;room.gameState.pendingRoundRecord=null;
  if(room.players.filter(player=>!player.isNpc).length<2)return;
  const resultByPlayer=new Map(round.players.map(result=>[result.playerId,result]));
  db.recordMatch({gameKey:meta.key,roomId:room.id,startedAt:round.startedAt,endedAt:round.endedAt,players:room.players.map(player=>{const result=resultByPlayer.get(player.id)||{};return{userId:player.userId||null,displayName:player.name,placement:result.placement??null,score:result.score??null,won:Boolean(result.won),outcome:result.outcome||null,durationMs:Math.max(0,round.endedAt-round.startedAt),moves:null}})});
}

module.exports={meta,createGame,handleAction,serialize,tick,handValue,isNatural,settleFinal,BASE_BET,results,preparePlayers,afterStateChange};
