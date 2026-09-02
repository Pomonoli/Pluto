const test = require('node:test');
const assert = require('node:assert/strict');
const { presidentRank, playableCardIds } = require('../games/presidenten/server');

test('Presidenten: 2 is hoger dan Aas', () => {
  assert.ok(presidentRank({rank:'2',value:2}) > presidentRank({rank:'A',value:1}));
});

test('Presidenten markeert alleen voldoende hoge en complete combinaties als speelbaar', () => {
  const player={place:null,hand:[{id:'5♣',rank:'5',value:5},{id:'8♣',rank:'8',value:8},{id:'8♦',rank:'8',value:8},{id:'K♣',rank:'K',value:13}]};
  const game={firstLead:false,lead:{rank:7,count:2}};
  assert.deepEqual(playableCardIds(game,player),['8♣','8♦']);
});

test('Presidenten sorteert kaarten primair op rang, niet op suit', () => {
  const { sortPresidentCards } = require('../games/presidenten/server');
  const hand = [
    {id:'9♣',rank:'9',value:9,suit:'♣'},
    {id:'3♠',rank:'3',value:3,suit:'♠'},
    {id:'9♥',rank:'9',value:9,suit:'♥'},
    {id:'4♦',rank:'4',value:4,suit:'♦'},
    {id:'2♣',rank:'2',value:2,suit:'♣'},
    {id:'A♠',rank:'A',value:1,suit:'♠'}
  ];
  assert.deepEqual(sortPresidentCards(hand).map(c=>c.rank), ['3','4','9','9','A','2']);
});
