'use strict';

const RAW = ['wood', 'clay', 'stone'];
const MANUFACTURED = ['glass', 'papyrus'];
const RESOURCES = [...RAW, ...MANUFACTURED];
const SCIENCES = ['wheel', 'mortar', 'tablet', 'compass', 'astrolabe', 'law'];
const NPC_DELAY = 700;

const AGE_CARDS = {
  1: [
    {name:'Lumber Yard', color:'brown', produces:{wood:1}},
    {name:'Clay Pool', color:'brown', produces:{clay:1}},
    {name:'Stone Pit', color:'brown', produces:{stone:1}},
    {name:'Logging Camp', color:'brown', cost:{coins:1}, produces:{wood:1}},
    {name:'Clay Pit', color:'brown', cost:{coins:1}, produces:{clay:1}},
    {name:'Quarry', color:'brown', cost:{coins:1}, produces:{stone:1}},
    {name:'Glassworks', color:'gray', cost:{coins:1}, produces:{glass:1}},
    {name:'Press', color:'gray', cost:{coins:1}, produces:{papyrus:1}},
    {name:'Tavern', color:'yellow', coins:4},
    {name:'Caravansery', color:'yellow', cost:{resources:{wood:1}}, produces:{wildRaw:1}},
    {name:'Forum', color:'yellow', cost:{resources:{clay:1}}, produces:{wildGray:1}},
    {name:'Marketplace', color:'yellow', cost:{coins:3}, effect:'grayTrade'},
    {name:'Baths', color:'blue', cost:{resources:{stone:1}}, vp:3},
    {name:'Altar', color:'blue', vp:3},
    {name:'Theatre', color:'blue', vp:3},
    {name:'Guard Tower', color:'red', shields:1},
    {name:'Stable', color:'red', cost:{resources:{wood:1}}, shields:1},
    {name:'Garrison', color:'red', cost:{resources:{clay:1}}, shields:1},
    {name:'Workshop', color:'green', cost:{resources:{papyrus:1}}, vp:1, science:'wheel'},
    {name:'Apothecary', color:'green', cost:{resources:{glass:1}}, vp:1, science:'mortar'}
  ],
  2: [
    {name:'Sawmill', color:'brown', cost:{coins:2}, produces:{wood:2}},
    {name:'Brickyard', color:'brown', cost:{coins:2}, produces:{clay:2}},
    {name:'Shelf Quarry', color:'brown', cost:{coins:2}, produces:{stone:2}},
    {name:'Glassblower', color:'gray', produces:{glass:1}},
    {name:'Drying Room', color:'gray', produces:{papyrus:1}},
    {name:'Brewery', color:'yellow', coins:6},
    {name:'Customs House', color:'yellow', cost:{coins:4}, effect:'grayTrade'},
    {name:'Merchants Guildhall', color:'yellow', cost:{resources:{papyrus:1}}, effect:'rawTrade'},
    {name:'Caravan Hub', color:'yellow', cost:{resources:{glass:1}}, produces:{wildRaw:1}, coins:2},
    {name:'Forum Annex', color:'yellow', cost:{resources:{clay:1,papyrus:1}}, produces:{wildGray:1}, coins:2},
    {name:'Aqueduct', color:'blue', cost:{resources:{stone:3}}, vp:5},
    {name:'Courthouse', color:'blue', cost:{resources:{wood:2,glass:1}}, vp:5},
    {name:'Statue', color:'blue', cost:{resources:{clay:2}}, vp:4},
    {name:'Walls', color:'red', cost:{resources:{stone:2}}, shields:2},
    {name:'Training Ground', color:'red', cost:{resources:{wood:1,clay:1}}, shields:2},
    {name:'Archery Range', color:'red', cost:{resources:{wood:2}}, shields:2},
    {name:'Laboratory', color:'green', cost:{resources:{wood:1,glass:1}}, vp:2, science:'tablet'},
    {name:'Library', color:'green', cost:{resources:{stone:1,papyrus:1}}, vp:2, science:'compass'},
    {name:'School', color:'green', cost:{resources:{wood:1,papyrus:1}}, vp:2, science:'wheel'},
    {name:'Dispensary', color:'green', cost:{resources:{clay:2,glass:1}}, vp:2, science:'mortar'}
  ],
  3: [
    {name:'Palace', color:'blue', cost:{resources:{wood:1,clay:1,stone:1,glass:1,papyrus:1}}, vp:7},
    {name:'Town Hall', color:'blue', cost:{resources:{stone:2,wood:1}}, vp:6},
    {name:'Pantheon', color:'blue', cost:{resources:{clay:2,papyrus:1}}, vp:6},
    {name:'Gardens', color:'blue', cost:{resources:{clay:2,wood:1}}, vp:6},
    {name:'Senate', color:'blue', cost:{resources:{stone:2,wood:1,papyrus:1}}, vp:7},
    {name:'Arsenal', color:'red', cost:{resources:{wood:2,clay:1}}, shields:3},
    {name:'Siege Workshop', color:'red', cost:{resources:{clay:3}}, shields:3},
    {name:'Fortifications', color:'red', cost:{resources:{stone:2,clay:1}}, shields:3},
    {name:'Circus', color:'red', cost:{resources:{stone:2,wood:1}}, shields:2},
    {name:'Academy', color:'green', cost:{resources:{stone:1,wood:1,glass:2}}, vp:3, science:'astrolabe'},
    {name:'Observatory', color:'green', cost:{resources:{stone:1,papyrus:2}}, vp:3, science:'compass'},
    {name:'University', color:'green', cost:{resources:{wood:1,glass:1,papyrus:1}}, vp:3, science:'tablet'},
    {name:'Study', color:'green', cost:{resources:{wood:2,glass:1}}, vp:3, science:'law'},
    {name:'Chamber of Commerce', color:'yellow', cost:{resources:{papyrus:1}}, coins:8, vp:2},
    {name:'Port', color:'yellow', cost:{resources:{wood:1,glass:1}}, coins:6, vp:3},
    {name:'Armory', color:'yellow', cost:{resources:{stone:1,clay:1}}, coins:5, vp:3},
    {name:'Builders Guild', color:'purple', cost:{resources:{stone:2,clay:1,glass:1}}, guild:'wonder'},
    {name:'Scientists Guild', color:'purple', cost:{resources:{wood:2,papyrus:1}}, guild:'green'},
    {name:'Magistrates Guild', color:'purple', cost:{resources:{wood:1,clay:1,papyrus:1}}, guild:'blue'},
    {name:'Tacticians Guild', color:'purple', cost:{resources:{stone:1,clay:1,glass:1}}, guild:'red'}
  ]
};

const WONDER_POOL = [
  {name:'The Pyramids', cost:{resources:{stone:3,papyrus:1}}, vp:9},
  {name:'The Colossus', cost:{resources:{clay:3,glass:1}}, vp:3, shields:2},
  {name:'The Sphinx', cost:{resources:{stone:1,clay:1,glass:2}}, vp:6, extraTurn:true},
  {name:'Temple of Artemis', cost:{resources:{wood:1,stone:1,glass:1,papyrus:1}}, coins:12, extraTurn:true},
  {name:'The Great Lighthouse', cost:{resources:{stone:1,wood:1,papyrus:2}}, vp:4, produces:{wildRaw:1}},
  {name:'Piraeus', cost:{resources:{wood:2,clay:1,stone:1}}, vp:2, produces:{wildGray:1}, extraTurn:true},
  {name:'Circus Maximus', cost:{resources:{stone:2,wood:1,glass:1}}, vp:3, shields:2},
  {name:'The Hanging Gardens', cost:{resources:{wood:2,glass:1,papyrus:1}}, vp:3, coins:6, extraTurn:true},
  {name:'Via Appia', cost:{resources:{clay:2,stone:2,papyrus:1}}, vp:3, coins:3, opponentCoins:-3, extraTurn:true},
  {name:'Statue of Zeus', cost:{resources:{wood:1,clay:1,stone:1,papyrus:2}}, vp:3, shields:1, coins:4},
  {name:'The Great Library', cost:{resources:{wood:3,glass:1}}, vp:4, progress:true},
  {name:'The Mausoleum', cost:{resources:{clay:2,glass:2,papyrus:1}}, vp:5, coins:4}
];

const PROGRESS_POOL = [
  {id:'urbanism', name:'Urbanisme', text:'+6 munten.', coins:6},
  {id:'philosophy', name:'Filosofie', text:'+7 overwinningspunten.', vp:7},
  {id:'strategy', name:'Strategie', text:'Elke toekomstige rode kaart geeft +1 schild.', effect:'strategy'},
  {id:'mathematics', name:'Wiskunde', text:'+3 punten per vooruitgangstoken op het einde.', effect:'mathematics'},
  {id:'law', name:'Recht', text:'Geeft meteen het wetenschapssymbool Recht.', science:'law'},
  {id:'architecture', name:'Architectuur', text:'Je wonders kosten 2 munten minder per ontbrekende grondstof.', effect:'architecture'},
  {id:'masonry', name:'Metselwerk', text:'Je blauwe gebouwen kosten 2 munten minder per ontbrekende grondstof.', effect:'masonry'},
  {id:'theology', name:'Theologie', text:'Elk gebouwd wonder geeft een extra beurt.', effect:'theology'},
  {id:'economy', name:'Economie', text:'+4 munten en handel blijft goedkoop.', coins:4, effect:'rawTrade'},
  {id:'craft', name:'Vakmanschap', text:'+4 punten en grijze grondstoffen kosten 1 munt.', vp:4, effect:'grayTrade'}
];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function resourceMap() { return Object.fromEntries(RESOURCES.map((r) => [r, 0])); }

function buildLayout(age) {
  const rows = [2, 3, 4, 5, 6];
  const shuffled = shuffle(AGE_CARDS[age]).map((card, i) => ({...clone(card), id:`a${age}-${i}`}));
  const cards = [];
  let index = 0;
  rows.forEach((length, row) => {
    const start = 7 - length;
    for (let i = 0; i < length; i += 1) {
      const col = start + i * 2;
      cards.push({
        ...shuffled[index], row, col, removed:false,
        revealed: row % 2 === 0 || row === rows.length - 1
      });
      index += 1;
    }
  });
  for (const card of cards) {
    const coverRow = card.row + 1;
    card.coveredBy = cards.filter((other) => other.row === coverRow && Math.abs(other.col - card.col) === 1).map((other) => other.id);
  }
  revealAvailable(cards);
  return cards;
}

function revealAvailable(cards) {
  for (const card of cards) {
    if (card.removed) continue;
    if (isAvailable(cards, card)) card.revealed = true;
  }
}
function isAvailable(cards, card) {
  return !card.removed && card.coveredBy.every((id) => cards.find((item) => item.id === id)?.removed);
}
function availableCards(game) { return game.ageCards.filter((card) => isAvailable(game.ageCards, card)); }

function production(player) {
  const result = resourceMap();
  let wildRaw = 0, wildGray = 0;
  const sources = [...player.built, ...player.wonders.filter((w) => w.built)];
  for (const source of sources) {
    const produces = source.produces || {};
    for (const resource of RESOURCES) result[resource] += Number(produces[resource] || 0);
    wildRaw += Number(produces.wildRaw || 0);
    wildGray += Number(produces.wildGray || 0);
  }
  return {...result, wildRaw, wildGray};
}
function hasEffect(player, effect) {
  return player.effects.includes(effect) || player.progress.some((token) => token.effect === effect);
}
function colorCount(player, color) { return player.built.filter((card) => card.color === color).length; }
function scienceCounts(player) {
  const counts = Object.fromEntries(SCIENCES.map((s) => [s, 0]));
  player.built.forEach((card) => { if (card.science) counts[card.science] += 1; });
  player.progress.forEach((token) => { if (token.science) counts[token.science] += 1; });
  return counts;
}
function distinctScience(player) { return Object.values(scienceCounts(player)).filter((count) => count > 0).length; }

function tradePrice(game, player, resource, cardOrWonder) {
  const opponent = game.players.find((p) => p.id !== player.id);
  if (RAW.includes(resource) && hasEffect(player, 'rawTrade')) return 1;
  if (MANUFACTURED.includes(resource) && hasEffect(player, 'grayTrade')) return 1;
  const prod = production(opponent)[resource] || 0;
  let price = 2 + prod;
  if (cardOrWonder?.color === 'blue' && hasEffect(player, 'masonry')) price = Math.max(0, price - 2);
  if (!cardOrWonder?.color && hasEffect(player, 'architecture')) price = Math.max(0, price - 2);
  return price;
}

function costInfo(game, player, item) {
  const baseCoins = Number(item.cost?.coins || 0);
  const needs = {...resourceMap(), ...(item.cost?.resources || {})};
  const prod = production(player);
  const deficits = resourceMap();
  for (const resource of RESOURCES) deficits[resource] = Math.max(0, Number(needs[resource] || 0) - Number(prod[resource] || 0));

  let rawWild = prod.wildRaw;
  for (const resource of RAW) {
    const used = Math.min(rawWild, deficits[resource]);
    deficits[resource] -= used;
    rawWild -= used;
  }
  let grayWild = prod.wildGray;
  for (const resource of MANUFACTURED) {
    const used = Math.min(grayWild, deficits[resource]);
    deficits[resource] -= used;
    grayWild -= used;
  }

  let tradeCoins = 0;
  const purchases = {};
  for (const resource of RESOURCES) {
    if (!deficits[resource]) continue;
    const unitPrice = tradePrice(game, player, resource, item);
    purchases[resource] = {count:deficits[resource], unitPrice};
    tradeCoins += deficits[resource] * unitPrice;
  }
  return {coins:baseCoins + tradeCoins, baseCoins, tradeCoins, purchases, affordable:player.coins >= baseCoins + tradeCoins};
}

function createPlayer(rp, seat, wonders) {
  return {
    id:rp.id, name:rp.name, isNpc:Boolean(rp.isNpc), seat,
    coins:7, built:[], wonders:wonders.map((w) => ({...clone(w), built:false})),
    progress:[], effects:[], militaryPenalties:[], score:0
  };
}

function createGame(roomPlayers) {
  if (!Array.isArray(roomPlayers) || roomPlayers.length !== 2) throw new Error('7 Wonders Duel is voor precies 2 spelers.');
  const wonders = shuffle(WONDER_POOL).slice(0, 8);
  const players = [createPlayer(roomPlayers[0], 0, wonders.slice(0, 4)), createPlayer(roomPlayers[1], 1, wonders.slice(4, 8))];
  return {
    gameKey:'seven-wonders-duel', age:1, ageCards:buildLayout(1), players, turnIndex:Math.random() < .5 ? 0 : 1,
    military:0, militaryPenaltyFlags:{p0_3:false,p0_6:false,p1_3:false,p1_6:false},
    progressAvailable:shuffle(PROGRESS_POOL).slice(0, 5).map(clone), pendingProgressFor:null,
    gameOver:false, winnerId:null, winType:null, resultText:'', log:[], nextNpcAt:0
  };
}
function currentPlayer(game) { return game.players[game.turnIndex]; }
function opponentOf(game, player) { return game.players.find((p) => p.id !== player.id); }
function builtWonderCount(game) { return game.players.reduce((sum, p) => sum + p.wonders.filter((w) => w.built).length, 0); }

function militaryMove(game, player, shields) {
  if (!shields) return;
  const bonus = hasEffect(player, 'strategy') ? 1 : 0;
  const delta = (shields + bonus) * (player.seat === 0 ? 1 : -1);
  const before = game.military;
  game.military = Math.max(-9, Math.min(9, game.military + delta));
  const opponent = opponentOf(game, player);
  const crossing = [
    {threshold:3, flag:'p0_3', active:before < 3 && game.military >= 3, loss:2},
    {threshold:6, flag:'p0_6', active:before < 6 && game.military >= 6, loss:5},
    {threshold:-3, flag:'p1_3', active:before > -3 && game.military <= -3, loss:2},
    {threshold:-6, flag:'p1_6', active:before > -6 && game.military <= -6, loss:5}
  ];
  for (const zone of crossing) {
    if (!zone.active || game.militaryPenaltyFlags[zone.flag]) continue;
    game.militaryPenaltyFlags[zone.flag] = true;
    opponent.coins = Math.max(0, opponent.coins - zone.loss);
    game.log.unshift(`${opponent.name} verliest ${zone.loss} munten door militaire druk.`);
  }
  if (Math.abs(game.military) >= 9) endGame(game, player.id, 'military');
}

function applyCard(game, player, card) {
  player.coins += Number(card.coins || 0);
  if (card.effect && !player.effects.includes(card.effect)) player.effects.push(card.effect);
  player.built.push(clone(card));
  militaryMove(game, player, Number(card.shields || 0));
  if (!game.gameOver && distinctScience(player) >= 6) endGame(game, player.id, 'science');
}

function maybeQueueProgress(game, player, scienceBefore, source) {
  if (!source?.science || game.gameOver) return false;
  const after = scienceCounts(player)[source.science] || 0;
  if (scienceBefore < 2 && after >= 2 && game.progressAvailable.length) {
    game.pendingProgressFor = player.id;
    return true;
  }
  return false;
}

function applyWonder(game, player, wonder) {
  wonder.built = true;
  player.coins += Number(wonder.coins || 0);
  const opponent = opponentOf(game, player);
  if (wonder.opponentCoins) opponent.coins = Math.max(0, opponent.coins + wonder.opponentCoins);
  militaryMove(game, player, Number(wonder.shields || 0));
  if (wonder.progress && game.progressAvailable.length && !game.gameOver) game.pendingProgressFor = player.id;
}

function removeAgeCard(game, card) {
  card.removed = true;
  revealAvailable(game.ageCards);
}

function discardValue(game, player) { return 2 + colorCount(opponentOf(game, player), 'yellow'); }

function advanceTurn(game, extraTurn=false) {
  if (game.gameOver || game.pendingProgressFor) return;
  if (!extraTurn) game.turnIndex = 1 - game.turnIndex;
  if (game.ageCards.every((card) => card.removed)) advanceAge(game);
  scheduleNpc(game);
}
function advanceAge(game) {
  if (game.age >= 3) { finishCivilian(game); return; }
  game.age += 1;
  game.ageCards = buildLayout(game.age);
  game.log.unshift(`Leeftijd ${game.age} begint.`);
}

function buildCardAction(game, player, card) {
  const info = costInfo(game, player, card);
  if (!info.affordable) throw new Error('Je hebt niet genoeg munten om deze kaart te bouwen.');
  const before = card.science ? (scienceCounts(player)[card.science] || 0) : 0;
  player.coins -= info.coins;
  removeAgeCard(game, card);
  applyCard(game, player, card);
  game.log.unshift(`${player.name} bouwt ${card.name} voor ${info.coins} munten.`);
  maybeQueueProgress(game, player, before, card);
  advanceTurn(game, false);
}
function discardCardAction(game, player, card) {
  const gain = discardValue(game, player);
  player.coins += gain;
  removeAgeCard(game, card);
  game.log.unshift(`${player.name} legt ${card.name} af en krijgt ${gain} munten.`);
  advanceTurn(game, false);
}
function wonderAction(game, player, card, wonderIndex) {
  const wonder = player.wonders[wonderIndex];
  if (!wonder || wonder.built) throw new Error('Ongeldig wonder.');
  if (builtWonderCount(game) >= 7) throw new Error('Er kunnen maximaal 7 wonders gebouwd worden.');
  const info = costInfo(game, player, wonder);
  if (!info.affordable) throw new Error('Je hebt niet genoeg munten om dit wonder te bouwen.');
  player.coins -= info.coins;
  removeAgeCard(game, card);
  applyWonder(game, player, wonder);
  game.log.unshift(`${player.name} gebruikt ${card.name} om ${wonder.name} te bouwen.`);
  const extra = Boolean(wonder.extraTurn || hasEffect(player, 'theology'));
  advanceTurn(game, extra);
}

function chooseProgress(game, player, tokenId) {
  const index = game.progressAvailable.findIndex((token) => token.id === tokenId);
  if (index < 0) throw new Error('Ongeldig vooruitgangstoken.');
  const [token] = game.progressAvailable.splice(index, 1);
  player.progress.push(token);
  player.coins += Number(token.coins || 0);
  if (token.effect && !player.effects.includes(token.effect)) player.effects.push(token.effect);
  game.pendingProgressFor = null;
  game.log.unshift(`${player.name} kiest ${token.name}.`);
  if (distinctScience(player) >= 6) endGame(game, player.id, 'science');
  advanceTurn(game, false);
}

function findAvailableCard(game, cardId) {
  const card = game.ageCards.find((item) => item.id === cardId);
  return card && isAvailable(game.ageCards, card) ? card : null;
}

function handleAction(game, playerId, action, payload) {
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  const player = currentPlayer(game);
  if (!player || player.id !== playerId || player.isNpc) throw new Error('Je bent niet aan de beurt.');

  if (game.pendingProgressFor) {
    if (game.pendingProgressFor !== playerId || action !== 'progress') throw new Error('Kies eerst een vooruitgangstoken.');
    return chooseProgress(game, player, String(payload?.tokenId || ''));
  }

  const card = findAvailableCard(game, String(payload?.cardId || ''));
  if (!card) throw new Error('Deze kaart is niet beschikbaar.');
  if (action === 'build') return buildCardAction(game, player, card);
  if (action === 'discard') return discardCardAction(game, player, card);
  if (action === 'wonder') return wonderAction(game, player, card, Number(payload?.wonderIndex));
  throw new Error('Onbekende actie.');
}

function scoreGuild(game, player, guild) {
  const opponent = opponentOf(game, player);
  if (guild === 'wonder') return Math.max(player.wonders.filter((w) => w.built).length, opponent.wonders.filter((w) => w.built).length) * 2;
  return Math.max(colorCount(player, guild), colorCount(opponent, guild));
}
function militaryScore(game, player) {
  const lead = game.military * (player.seat === 0 ? 1 : -1);
  if (lead >= 8) return 10;
  if (lead >= 6) return 5;
  if (lead >= 3) return 2;
  return 0;
}
function calculateScore(game, player) {
  let score = Math.floor(player.coins / 3) + militaryScore(game, player);
  for (const card of player.built) score += Number(card.vp || 0) + (card.guild ? scoreGuild(game, player, card.guild) : 0);
  for (const wonder of player.wonders) if (wonder.built) score += Number(wonder.vp || 0);
  for (const token of player.progress) score += Number(token.vp || 0);
  if (hasEffect(player, 'mathematics')) score += player.progress.length * 3;
  return score;
}
function finishCivilian(game) {
  const scores = game.players.map((player) => ({player, score:calculateScore(game, player)}));
  scores.forEach(({player, score}) => { player.score = score; });
  scores.sort((a, b) => b.score - a.score || b.player.coins - a.player.coins);
  const winnerId = scores[0].score === scores[1].score && scores[0].player.coins === scores[1].player.coins ? null : scores[0].player.id;
  endGame(game, winnerId, 'civilian');
}
function endGame(game, winnerId, type) {
  game.gameOver = true;
  game.winnerId = winnerId;
  game.winType = type;
  game.pendingProgressFor = null;
  game.nextNpcAt = 0;
  game.players.forEach((player) => { player.score = calculateScore(game, player); });
  const winner = game.players.find((p) => p.id === winnerId);
  const label = type === 'military' ? 'militaire suprematie' : type === 'science' ? 'wetenschappelijke suprematie' : 'overwinningspunten';
  game.resultText = winner ? `${winner.name} wint door ${label}.` : 'Het spel eindigt in een gelijkspel.';
  game.log.unshift(game.resultText);
}

function cardUtility(game, player, card) {
  let value = Number(card.vp || 0) * 2 + Number(card.coins || 0) * .7 + Number(card.shields || 0) * 5;
  if (card.science) {
    const counts = scienceCounts(player);
    value += counts[card.science] ? 7 : 4;
    if (distinctScience(player) >= 5 && !counts[card.science]) value += 100;
  }
  if (card.produces) value += Object.values(card.produces).reduce((a, b) => a + Number(b || 0), 0) * 4;
  if (card.effect) value += 4;
  if (card.guild) value += 5;
  return value;
}
function wonderUtility(game, player, wonder) {
  return Number(wonder.vp || 0) * 2 + Number(wonder.coins || 0) * .6 + Number(wonder.shields || 0) * 5 + (wonder.extraTurn ? 4 : 0) + (wonder.progress ? 7 : 0) + (wonder.produces ? 5 : 0);
}
function npcProgress(game, player) {
  const scored = game.progressAvailable.map((token) => ({token, value:Number(token.vp || 0) * 2 + Number(token.coins || 0) + (token.science && distinctScience(player) >= 5 ? 100 : 0) + (token.effect ? 6 : 0)}));
  scored.sort((a, b) => b.value - a.value);
  chooseProgress(game, player, scored[0].token.id);
}
function npcTurn(game, player) {
  if (game.pendingProgressFor === player.id) return npcProgress(game, player);
  const cards = availableCards(game);
  const options = [];
  for (const card of cards) {
    const cost = costInfo(game, player, card);
    if (cost.affordable) options.push({type:'build', card, value:cardUtility(game, player, card) - cost.coins * .25});
    player.wonders.forEach((wonder, index) => {
      if (wonder.built || builtWonderCount(game) >= 7) return;
      const wCost = costInfo(game, player, wonder);
      if (wCost.affordable) options.push({type:'wonder', card, wonderIndex:index, value:wonderUtility(game, player, wonder) - wCost.coins * .2 - cardUtility(game, player, card) * .35});
    });
    options.push({type:'discard', card, value:discardValue(game, player) * .5 - cardUtility(game, opponentOf(game, player), card) * .18});
  }
  options.sort((a, b) => b.value - a.value);
  const bestPool = options.slice(0, Math.min(3, options.length));
  const choice = bestPool[Math.floor(Math.random() * bestPool.length)] || options[0];
  if (!choice) return;
  if (choice.type === 'build') buildCardAction(game, player, choice.card);
  else if (choice.type === 'wonder') wonderAction(game, player, choice.card, choice.wonderIndex);
  else discardCardAction(game, player, choice.card);
}
function scheduleNpc(game, delay=NPC_DELAY) {
  const player = currentPlayer(game);
  game.nextNpcAt = !game.gameOver && player?.isNpc ? Date.now() + delay : 0;
}
function tick(game, now=Date.now()) {
  if (game.gameOver) return false;
  const player = currentPlayer(game);
  if (!player?.isNpc) { game.nextNpcAt = 0; return false; }
  if (!game.nextNpcAt) game.nextNpcAt = now + NPC_DELAY;
  if (now < game.nextNpcAt) return false;
  npcTurn(game, player);
  scheduleNpc(game);
  return true;
}

function publicCard(game, requester, card, canAct) {
  const visible = card.revealed || card.removed;
  const base = {id:card.id,row:card.row,col:card.col,removed:card.removed,revealed:visible,available:!card.removed && isAvailable(game.ageCards, card)};
  if (!visible) return base;
  const copy = {...clone(card)};
  delete copy.coveredBy;
  const info = canAct && base.available ? costInfo(game, requester, card) : null;
  return {...base, ...copy, cost:copy.cost || {}, costCoins:info?.coins ?? null, trade:info ? {baseCoins:info.baseCoins,tradeCoins:info.tradeCoins,purchases:info.purchases} : null, affordable:info?.affordable ?? false};
}
function serialize(game, requesterId, connected) {
  const requester = game.players.find((p) => p.id === requesterId);
  const active = currentPlayer(game);
  const canAct = !game.gameOver && active?.id === requesterId && !active?.isNpc;
  return {
    kind:game.gameKey, gameOver:game.gameOver, winnerId:game.winnerId, winType:game.winType, resultText:game.resultText,
    age:game.age, military:game.military, turnPlayerId:game.gameOver ? null : active?.id || null,
    canAct, pendingProgressFor:game.pendingProgressFor,
    players:game.players.map((player) => ({
      id:player.id,name:player.name,isNpc:player.isNpc,seat:player.seat,coins:player.coins,score:game.gameOver?player.score:null,
      production:production(player), sciences:scienceCounts(player), distinctScience:distinctScience(player),
      built:player.built.map((card) => ({name:card.name,color:card.color,vp:card.vp||0,shields:card.shields||0,science:card.science||null,produces:card.produces||null})),
      wonders:player.wonders.map((wonder,index) => {
        const info=canAct&&player.id===requesterId&&!wonder.built?costInfo(game, player, wonder):null;
        return {...clone(wonder),index,costCoins:info?.coins??null,trade:info?{baseCoins:info.baseCoins,tradeCoins:info.tradeCoins,purchases:info.purchases}:null,affordable:info?.affordable??false};
      }),
      progress:player.progress.map((token) => ({id:token.id,name:token.name,text:token.text})),
      connected:player.isNpc || Boolean(connected?.get?.(player.id))
    })),
    cards:game.ageCards.map((card) => publicCard(game, requester || active, card, canAct)),
    progressAvailable:game.progressAvailable.map((token) => ({id:token.id,name:token.name,text:token.text})),
    canChooseProgress:canAct && game.pendingProgressFor === requesterId,
    discardCoins:requester ? discardValue(game, requester) : 2,
    builtWonderCount:builtWonderCount(game),
    log:game.log.slice(0, 28)
  };
}

function results(game) {
  return game.players.map((player) => ({
    playerId:player.id,
    placement:game.winnerId ? (player.id === game.winnerId ? 1 : 2) : 1,
    score:Number(player.score || 0),
    won:player.id === game.winnerId,
    outcome:game.winnerId ? (player.id === game.winnerId ? 'Wint' : 'Verliest') : 'Gelijkspel'
  }));
}

module.exports={createGame,handleAction,serialize,tick,results,costInfo,calculateScore,availableCards};
