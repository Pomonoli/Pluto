const test = require('node:test');
const assert = require('node:assert/strict');
const blackjack = require('../games/blackjack/server');
const { handValue } = blackjack;

test('Blackjack Aas telt als 1 wanneer nodig', () => {
  assert.equal(handValue([{rank:'A'},{rank:'9'},{rank:'5'}]), 15);
  assert.equal(handValue([{rank:'A'},{rank:'K'}]), 21);
});

test('Blackjack natural betaalt 3 op 2 en nul chips reset naar 100', () => {
  const natural={id:'a',name:'A',isNpc:false,hand:[{rank:'A'},{rank:'K'}],chips:100,bet:10,betCommitted:true};
  const broke={id:'b',name:'B',isNpc:false,hand:[{rank:'10'},{rank:'8'}],chips:10,bet:10,betCommitted:true};
  const loser={id:'c',name:'C',isNpc:false,hand:[{rank:'10'},{rank:'8'}],chips:100,bet:10,betCommitted:true};
  const game={players:[natural,broke,loser],dealer:{hand:[{rank:'10'},{rank:'Q'}]},pendingChipUpdates:[],log:[],roundNumber:1};
  blackjack.settleFinal(game,1000);
  assert.equal(natural.result,'Blackjack');
  assert.equal(natural.chipDelta,15);
  assert.equal(natural.chips,115);
  assert.equal(broke.chipDelta,-10);
  assert.equal(broke.chips,100);
  assert.equal(broke.resetChips,true);
  assert.equal(loser.chips,90);
  blackjack.tick(game,2000);
  assert.equal(natural.chips,115);
  assert.equal(broke.chips,100);
  assert.equal(loser.chips,90);
});

test('Blackjack Double verdubbelt inzet en geeft exact één kaart', () => {
  const player={id:'a',name:'A',isNpc:false,hand:[{rank:'5'},{rank:'6'}],chips:100,bet:10,doubled:false,status:'playing'};
  const game={players:[player],dealer:{hand:[{rank:'9'},{rank:'7'}]},deck:[{rank:'10'}],phase:'players',turnIndex:0,nextNpcAt:0,log:[]};
  blackjack.handleAction(game,'a','double');
  assert.equal(player.bet,20);
  assert.equal(player.hand.length,3);
  assert.equal(player.status,'stand');
  assert.equal(game.phase,'dealer');
});

test('Blackjack kan twee heren splitsen', () => {
  const player={id:'a',name:'A',isNpc:false,hand:[{rank:'K'},{rank:'K'}],chips:100,bet:10,status:'playing'};
  const game={players:[player],dealer:{hand:[{rank:'10'},{rank:'8'}]},deck:[{rank:'9'},{rank:'Q'}],phase:'players',turnIndex:0,nextNpcAt:0,log:[],lastRoundText:'',pendingChipUpdates:[]};
  blackjack.handleAction(game,'a','split');
  assert.equal(player.hands.length,2);
  assert.deepEqual(player.hands.map(hand=>hand.cards.length),[2,2]);
  assert.deepEqual(player.hands.map(hand=>hand.bet),[10,10]);
});

test('Blackjack wacht na afrekening op Opnieuw', () => {
  const player={id:'a',name:'A',isNpc:false,hand:[{rank:'10'},{rank:'8'}],chips:100,bet:10,betCommitted:true,status:'stand'};
  const game={players:[player],dealer:{hand:[{rank:'10'},{rank:'Q'}]},deck:[],phase:'dealer',turnIndex:-1,nextNpcAt:0,log:[],roundNumber:1,pendingChipUpdates:[]};
  blackjack.settleFinal(game,1000);
  assert.equal(blackjack.tick(game,5000),false);
  assert.equal(game.phase,'round_end');
});
