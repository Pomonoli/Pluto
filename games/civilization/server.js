'use strict';

/**
 * Age of Civilization — server-authoritative logic.
 *
 * Follows the Pluto plugin server contract (see games/README.md):
 *   createGame(roomPlayers)
 *   handleAction(game, playerId, action, payload)
 *   serialize(game, requesterId, connected)
 *   tick(game, now)          [optional]
 *   results(game, durationMs) [optional]
 *
 * Nothing here trusts the client: hands, gold, grid state, and phase
 * transitions all live only in `game` and are only ever mutated here.
 */

const TOTAL_AGES = 7;
const AGE_TIME_MS = 40000;   // soft deadline per age for drafting/building
const WAVE_DISPLAY_MS = 4000; // how long the wave-result screen stays up before auto-advancing
const START_GOLD = 4;
const START_HP = 20;

const ERAS = [
  { name: 'Cavemen to Egyptians', wonder: 'Great Pyramid' },
  { name: 'Greeks to Romans', wonder: 'Colosseum' },
  { name: 'Swords to Muskets', wonder: 'Notre Dame' },
  { name: 'Chinese to Napoleon', wonder: 'Great Wall' },
  { name: 'World War I & II', wonder: 'Hoover Dam' },
  { name: '1990 to 2030', wonder: 'The Internet' },
  { name: 'Future to Futuristic', wonder: 'Dyson Sphere' }
];

const CARD_NAMES = [
  { military: ['Sharpened Spear', 'Bone Club Warriors', 'Stone Palisade'],
    economy: ['Grain Store', 'Flint Trade Route', 'River Fishing Camp'],
    culture: ['Cave Painting', 'Sun Ritual Circle', 'Tribal Totem Pole'] },
  { military: ['Phalanx Formation', 'Legion Camp', 'Siege Ballista'],
    economy: ['Grain Silo', 'Trade Galley', 'Silver Mine'],
    culture: ['Marble Temple', 'Olympic Games', 'Grand Amphitheater'] },
  { military: ['Longbow Company', 'Castle Rampart', 'Musketeer Line'],
    economy: ['Merchant Guild Hall', 'Silk Road Post', 'Banking House'],
    culture: ['Gothic Cathedral', 'Renaissance Workshop', 'Royal Court'] },
  { military: ['Cannon Battery', 'Great Wall Garrison', 'Grand Army'],
    economy: ['Tea Trade House', 'Porcelain Works', 'Continental Bank'],
    culture: ['Forbidden City', 'Palace Gardens', 'Imperial Exam Hall'] },
  { military: ['Trench Line', 'Tank Division', 'Radar Defense Grid'],
    economy: ['War Bonds Drive', 'Factory Assembly Line', 'Oil Field Rig'],
    culture: ['Propaganda Reels', 'War Memorial', 'National Broadcast'] },
  { military: ['Cyber Defense Unit', 'Stealth Fighter Wing', 'Missile Shield'],
    economy: ['Tech Startup', 'Stock Exchange Floor', 'Global Shipping Line'],
    culture: ['Viral Internet Meme', 'Blockbuster Studio', 'Social Platform'] },
  { military: ['Drone Swarm', 'Orbital Defense Platform', 'AI War Room'],
    economy: ['Fusion Reactor', 'Asteroid Mining Rig', 'Quantum Bank'],
    culture: ['Mars Colony Archive', 'Neural Memory Vault', 'Galactic Council'] }
];

function cardStats(age, type) {
  switch (type) {
    case 'military': return { cost: age + 1, power: age + 2 };
    case 'economy': return { cost: age, gold: age + 3 };
    case 'culture': return { cost: age + 1, vp: age + 2 };
    case 'wonder': return { cost: age * 2, power: age, gold: age, vp: age * 2 };
    default: throw new Error('unknown card type: ' + type);
  }
}

function cardDesc(c) {
  if (c.type === 'military') return `+${c.power} Power tegen de aanval van dit tijdperk.`;
  if (c.type === 'economy') return `Direct +${c.gold} Goud.`;
  if (c.type === 'culture') return `+${c.vp} Victory Points.`;
  if (c.type === 'wonder') return `Wonder: +${c.power} Power, +${c.gold} Goud, +${c.vp} VP. Eenmalig.`;
  return '';
}

function waveStrength(age) { return age * 2 + 4; }
function discardGold(age) { return age + 2; }
function finalScore(p) { return p.vp + Math.floor(p.gold / 3); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawCards(age, player) {
  const pool = CARD_NAMES[age - 1];
  let deck = [];
  ['military', 'economy', 'culture'].forEach((type) => {
    pool[type].forEach((name) => {
      deck.push({ type, name, ...cardStats(age, type) });
    });
  });
  if (age >= 2 && !player.wonderBuilt) {
    deck.push({ type: 'wonder', name: ERAS[age - 1].wonder, ...cardStats(age, 'wonder') });
  }
  shuffle(deck);
  return deck.slice(0, 3);
}

function dealHands(game) {
  Object.values(game.players).forEach((p) => {
    p.hand = drawCards(game.age, p);
  });
}

/* ---------------- lifecycle ---------------- */

function createGame(roomPlayers) {
  const players = {};
  roomPlayers.forEach((rp) => {
    players[rp.id] = {
      id: rp.id,
      name: rp.name,
      isNpc: Boolean(rp.isNpc),
      gold: START_GOLD,
      power: 0,
      vp: 0,
      hp: START_HP,
      grid: Array(9).fill(null),
      wonderBuilt: false,
      acted: false,
      hand: []
    };
  });

  const game = {
    gameKey: 'civilization',
    gameOver: false,
    resultText: '',
    age: 1,
    phase: 'draft', // 'draft' | 'wave' | 'ended'
    players,
    order: roomPlayers.map((rp) => rp.id),
    log: [],
    ageDeadline: Date.now() + AGE_TIME_MS,
    waveShownUntil: null,
    waveResult: null,
    winnerId: null,       // null = draw (only meaningful once phase === 'ended')
    endedSuddenDeath: false,
    finalScores: null
  };

  dealHands(game);
  game.log.push(`Age 1 begins: ${ERAS[0].name}.`);
  return game;
}

/* ---------------- actions ---------------- */

function handleAction(game, playerId, action, payload) {
  if (game.phase !== 'draft' || game.gameOver) throw new Error('Je kunt nu geen kaart kiezen.');
  const p = game.players[playerId];
  if (!p || p.acted || p.isNpc) throw new Error('Je hebt al gekozen.');

  const idx = payload && Number.isInteger(payload.handIndex) ? payload.handIndex : -1;
  const card = p.hand[idx];

  if (action === 'build') {
    if (!card) throw new Error('Ongeldige kaart.');
    const slot = p.grid.findIndex((x) => x === null);
    if (slot === -1) throw new Error('Je stad is vol.');
    if (p.gold < card.cost) throw new Error('Je hebt niet genoeg goud.');

    p.gold -= card.cost;
    p.grid[slot] = { type: card.type, name: card.name };
    if (card.type === 'military') p.power += card.power;
    if (card.type === 'economy') p.gold += card.gold;
    if (card.type === 'culture') p.vp += card.vp;
    if (card.type === 'wonder') {
      p.power += card.power;
      p.gold += card.gold;
      p.vp += card.vp;
      p.wonderBuilt = true;
    }
    p.acted = true;
    game.log.push(`${p.name} bouwt ${card.name}.`);
  } else if (action === 'discard') {
    if (!card) throw new Error('Ongeldige kaart.');
    p.gold += discardGold(game.age);
    p.acted = true;
    game.log.push(`${p.name} gooit ${card.name} weg voor goud.`);
  } else {
    throw new Error('Onbekende actie.');
  }

  if (game.order.every((id) => game.players[id].acted)) {
    resolveWave(game);
  }
}

/* ---------------- phase transitions ---------------- */

function resolveWave(game) {
  const ws = waveStrength(game.age);
  const results = {};
  game.order.forEach((id) => {
    const p = game.players[id];
    const dmg = Math.max(0, ws - p.power);
    p.hp -= dmg;
    results[id] = { power: p.power, wave: ws, damage: dmg };
  });

  game.waveResult = { age: game.age, wave: ws, results };
  game.phase = 'wave';
  game.log.push(`Age ${game.age} wave (kracht ${ws}) verwerkt.`);

  const deadIds = game.order.filter((id) => game.players[id].hp <= 0);
  if (deadIds.length > 0) {
    game.phase = 'ended';
    game.gameOver = true;
    game.endedSuddenDeath = true;
    game.winnerId = deadIds.length === game.order.length
      ? null
      : game.order.find((id) => !deadIds.includes(id));
    finalizeScores(game);
    setResultText(game);
  } else {
    game.waveShownUntil = Date.now() + WAVE_DISPLAY_MS;
  }
}

function advanceAfterWave(game) {
  if (game.age >= TOTAL_AGES) {
    game.phase = 'ended';
    game.gameOver = true;
    game.endedSuddenDeath = false;
    finalizeScores(game);
    const scores = game.finalScores;
    const maxScore = Math.max(...Object.values(scores));
    const winners = game.order.filter((id) => scores[id] === maxScore);
    game.winnerId = winners.length === 1 ? winners[0] : null;
    setResultText(game);
    return;
  }
  game.age += 1;
  game.order.forEach((id) => { game.players[id].acted = false; });
  dealHands(game);
  game.phase = 'draft';
  game.waveResult = null;
  game.ageDeadline = Date.now() + AGE_TIME_MS;
  game.log.push(`Age ${game.age} begins: ${ERAS[game.age - 1].name}.`);
}

function finalizeScores(game) {
  const scores = {};
  game.order.forEach((id) => { scores[id] = finalScore(game.players[id]); });
  game.finalScores = scores;
}

function setResultText(game) {
  game.resultText = game.winnerId
    ? `${game.players[game.winnerId].name} wint Age of Civilization.`
    : 'Age of Civilization eindigt in een gelijkspel.';
}

function playNpc(game, player) {
  const choices=player.hand.map((card,index)=>({card,index})).filter(({card})=>card.cost<=player.gold);
  if (choices.length && player.grid.some((slot)=>slot===null)) {
    choices.sort((a,b)=>((b.card.vp||0)+(b.card.power||0)+(b.card.gold||0))-((a.card.vp||0)+(a.card.power||0)+(a.card.gold||0)));
    const card=choices[0].card;
    const slot=player.grid.findIndex((value)=>value===null);
    player.gold-=card.cost;player.grid[slot]={type:card.type,name:card.name};
    if(card.type==='military')player.power+=card.power;
    if(card.type==='economy')player.gold+=card.gold;
    if(card.type==='culture')player.vp+=card.vp;
    if(card.type==='wonder'){player.power+=card.power;player.gold+=card.gold;player.vp+=card.vp;player.wonderBuilt=true;}
    game.log.push(`${player.name} bouwt ${card.name}.`);
  } else {
    const card=player.hand[0];player.gold+=discardGold(game.age);
    game.log.push(`${player.name} gooit ${card.name} weg voor goud.`);
  }
  player.acted=true;
}

/* ---------------- optional: timers / auto-progress ---------------- */

function tick(game, now) {
  if (game.phase === 'draft') {
    const npc=game.order.map((id)=>game.players[id]).find((player)=>player.isNpc&&!player.acted);
    if(npc){playNpc(game,npc);if(game.order.every((id)=>game.players[id].acted))resolveWave(game);return true;}
  }
  if (game.phase === 'draft' && now >= game.ageDeadline) {
    let changed = false;
    game.order.forEach((id) => {
      const p = game.players[id];
      if (!p.acted) {
        p.gold += discardGold(game.age);
        p.acted = true;
        changed = true;
        game.log.push(`${p.name} was te laat en past automatisch.`);
      }
    });
    if (game.order.every((id) => game.players[id].acted)) {
      resolveWave(game);
    }
    return changed || true;
  }

  if (game.phase === 'wave' && game.waveShownUntil && now >= game.waveShownUntil) {
    advanceAfterWave(game);
    return true;
  }

  return false;
}

/* ---------------- serialize (per-requester view) ---------------- */

function serialize(game, requesterId, connected) {
  const players = [];
  game.order.forEach((id) => {
    const p = game.players[id];
    players.push({
      id,
      name: p.name,
      isNpc: p.isNpc,
      gold: p.gold,
      power: p.power,
      vp: p.vp,
      hp: Math.max(0, p.hp),
      grid: p.grid,
      wonderBuilt: p.wonderBuilt,
      acted: p.acted,
      isYou: id === requesterId,
      connected: p.isNpc || (connected ? Boolean(connected.get(id)) : true)
    });
  });

  const you = game.players[requesterId];

  return {
    kind: game.gameKey,
    gameOver: game.gameOver,
    resultText: game.resultText,
    age: game.age,
    totalAges: TOTAL_AGES,
    eraName: ERAS[game.age - 1] ? ERAS[game.age - 1].name : '',
    phase: game.phase,
    deadline: game.phase === 'draft' ? game.ageDeadline
      : (game.phase === 'wave' ? game.waveShownUntil : null),
    order: game.order,
    players,
    yourHand: you && !you.acted && game.phase === 'draft'
      ? you.hand.map((c, i) => ({ idx: i, type: c.type, name: c.name, cost: c.cost, desc: cardDesc(c) }))
      : [],
    waveResult: game.waveResult,
    phaseIsWave: game.phase === 'wave',
    winnerId: game.winnerId,
    endedSuddenDeath: game.endedSuddenDeath,
    finalScores: game.finalScores,
    log: game.log.slice(-6)
  };
}

/* ---------------- optional: end-of-match stats ---------------- */

function results(game, durationMs) {
  const scores = game.finalScores || (() => { finalizeScores(game); return game.finalScores; })();
  const high=Math.max(...Object.values(scores));
  const leaders=game.order.filter((id)=>scores[id]===high);
  return game.order.map((id)=>({
    playerId:id,
    placement:game.endedSuddenDeath?(game.winnerId===null?1:game.winnerId===id?1:2):(scores[id]===high?1:2),
    score:scores[id],
    won:game.endedSuddenDeath?game.winnerId===id:leaders.length===1&&leaders[0]===id,
    outcome:game.endedSuddenDeath
      ?(game.winnerId===null?'Gelijkspel':game.winnerId===id?'Wint':'Verliest')
      :(scores[id]===high?(leaders.length===1?'Wint':'Gelijkspel'):'Verliest'),
    durationMs
  }));
}

module.exports = { createGame, handleAction, serialize, tick, results };
