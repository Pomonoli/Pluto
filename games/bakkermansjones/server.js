'use strict';

/**
 * Bakkermans Jones — server-authoritative logic.
 *
 * Volgt het Pluto plugin-servercontract (zie games/README.md):
 *   createGame(roomPlayers)
 *   handleAction(game, playerId, action, payload)
 *   serialize(game)
 *   tick(game, now)
 *   results(game, durationMs)
 *
 * De dag is opgedeeld in fases (game.phase), telkens met een eigen scherm:
 *   prep         — 00:00-07:00, bakken. Alleen oven/recepten/voorraad.
 *   shopPrompt   — pop-up "winkel openen?", klok gepauzeerd.
 *   shop         — 07:00-12:00, klanten bedienen en bestellingen leveren.
 *   closePrompt  — pop-up "winkel sluit", klok gepauzeerd.
 *   supermarket  — 12:00-15:00, ingrediënten inkopen voor de volgende dag.
 *   dayEnd       — pop-up met dagoverzicht, klok gepauzeerd.
 *
 * tick() zet de speltijd-klok verder op basis van verstreken werkelijke tijd
 * (zoals Ragnarok dat doet), zodat de simulatie doorloopt zonder speleractie
 * binnen een actieve fase (prep/shop/supermarket). Bij elke fase-overgang
 * naar een pop-up wordt de klok automatisch gepauzeerd; de speler bevestigt
 * met een actie om verder te gaan.
 */

const DAY_START = 0;          // 00:00 in minuten sinds middernacht
const SHOP_START = 420;       // 07:00
const SHOP_END = 720;         // 12:00
const SUPERMARKET_END = 900;  // 15:00 — einde van de dag
const DAILY_COST = 35;        // basiskosten op dag 1 (huur, energie)
const TICK_BASE_MS = 250;     // bij snelheid 1x kost één speltijd-minuut dit aantal ms
const PAUSING_PHASES = new Set(['shopPrompt', 'closePrompt', 'dayEnd']);

const RECIPES = {
  stokbrood: { key: 'stokbrood', naam: 'Stokbrood', batch: 4, bakMin: 18, prijs: 2.60, kost: { bloem: 3, gist: 1 }, koeling: false, weight: 30 },
  pistolet: { key: 'pistolet', naam: 'Pistolets', batch: 8, bakMin: 15, prijs: 0.70, kost: { bloem: 3, gist: 1, boter: 1 }, koeling: false, weight: 25 },
  croissant: { key: 'croissant', naam: 'Croissants', batch: 8, bakMin: 24, prijs: 1.90, kost: { bloem: 4, boter: 3, eieren: 1 }, koeling: false, weight: 25 },
  koffiekoek: { key: 'koffiekoek', naam: 'Koffiekoeken', batch: 6, bakMin: 22, prijs: 2.30, kost: { bloem: 3, boter: 2, suiker: 2, eieren: 1 }, koeling: false, weight: 15 },
  taart: { key: 'taart', naam: 'Taart', batch: 1, bakMin: 40, prijs: 19.00, kost: { bloem: 2, boter: 2, eieren: 3, suiker: 3, room: 2 }, koeling: true, weight: 5 },
  brioche: { key: 'brioche', naam: 'Brioche', batch: 6, bakMin: 28, prijs: 3.40, kost: { bloem: 4, gist: 1, boter: 3, suiker: 2, eieren: 2 }, koeling: false, weight: 13, unlockDay: 2, unlockPrice: 85, premium: true },
  muffin: { key: 'muffin', naam: 'Muffins', batch: 8, bakMin: 25, prijs: 2.90, kost: { bloem: 3, boter: 2, suiker: 3, eieren: 2 }, koeling: false, weight: 14, unlockDay: 4, unlockPrice: 130, premium: true },
  slagroomtaart: { key: 'slagroomtaart', naam: 'Slagroomtaart', batch: 2, bakMin: 48, prijs: 24.00, kost: { bloem: 3, boter: 3, suiker: 4, eieren: 4, room: 4 }, koeling: true, weight: 7, unlockDay: 6, unlockPrice: 190, premium: true }
};
const START_RECIPES = ['stokbrood', 'pistolet', 'croissant', 'koffiekoek', 'taart'];

const INGREDIENT_META = { bloem: 'Bloem', gist: 'Gist', boter: 'Boter', suiker: 'Suiker', eieren: 'Eieren', room: 'Room' };
const INGREDIENT_PRICES = { bloem: 0.15, gist: 0.40, boter: 0.35, suiker: 0.20, eieren: 0.25, room: 0.60 };
const BUY_BATCH = 10; // eenheden per aankoopklik in de supermarkt

const START_INGREDIENTS = { bloem: 70, gist: 12, boter: 28, suiker: 18, eieren: 22, room: 8 };
const EMPTY_SHELF = Object.fromEntries(Object.keys(RECIPES).map((key) => [key, 0]));

const EVENT_TITLES = ['Schoolreis passeert langs', 'Communiefeest bestelling', 'Buurtfeest catering', 'Kantoor bestelt ontbijt', 'Voetbalclub na de match'];

const EVENTS = [
  {
    id: 'wegenwerken', tone: 'bad', title: 'Wegenwerken voor de deur',
    desc: 'Klanten mijden de bakkerij een tijdlang.',
    apply(game) { game.mods.push({ id: uid(), type: 'customerMult', value: 0.5, endMin: game.clockMin + 180 }); }
  },
  {
    id: 'water', tone: 'bad', title: 'Wateroverlast in de kelder',
    desc: 'De koelgroep valt uit — room en taarten gaan verloren.',
    apply(game) { game.ingredients.room = 0; game.shelf.taart = 0; game.koelingBroken = true; }
  },
  {
    id: 'stroom', tone: 'bad', title: 'Korte stroomstoring',
    desc: 'De ovens vallen enkele minuten stil.',
    apply(game) { const extra = 20 + Math.floor(Math.random() * 20); game.ovens.forEach((o) => { if (o) o.endMin += extra; }); }
  },
  {
    id: 'levering', tone: 'bad', title: 'Late meellevering',
    desc: 'Er is minder bloem dan gehoopt vandaag.',
    apply(game) { game.ingredients.bloem = Math.max(4, Math.floor(game.ingredients.bloem * 0.55)); }
  },
  {
    id: 'blogger', tone: 'good', title: 'Foodblogger schrijft een lovende recensie',
    desc: 'Extra volk over de vloer dankzij een online review.',
    apply(game) {
      changeReputation(game, 8);
      game.mods.push({ id: uid(), type: 'customerMult', value: 1.6, endMin: game.clockMin + 150 });
    }
  },
  {
    id: 'school', tone: 'good', title: 'Schoolreis stopt binnen',
    desc: 'Een groep kinderen stroomt de winkel binnen.',
    apply(game) {
      for (let i = 0; i < 3; i += 1) {
        if (game.customerQueue.length < 4) {
          const key = weightedPick([['stokbrood', 40], ['pistolet', 30], ['koffiekoek', 30]]);
          game.customerQueue.push({ id: uid(), wants: { key, qty: 1 }, bornAt: game.clockMin, patience: 16 });
        }
      }
    }
  }
];

const INCIDENTS = [
  {
    id: 'ovenstoring', title: 'Oven maakt een verdacht geluid',
    desc: 'Een lager loopt warm. Laat je een technieker komen of bak je voorzichtig verder?',
    choices(day) {
      return [
        { id: 'technieker', label: 'Technieker bellen', detail: `Kost €${25 + day * 3}, maar alles blijft draaien.` },
        { id: 'doorbakken', label: 'Voorzichtig doorbakken', detail: `Ovens lopen vertraging op en je verliest ${3 + Math.ceil(day / 3)} reputatie.` }
      ];
    }
  },
  {
    id: 'klacht', title: 'Boze klant aan de toonbank',
    desc: 'Een vaste klant klaagt over de bestelling van gisteren. Hoe maak je dit goed?',
    choices(day) {
      return [
        { id: 'terugbetalen', label: 'Ruim compenseren', detail: `Kost €${12 + day * 2} en levert 2 reputatie op.` },
        { id: 'excuses', label: 'Alleen excuses', detail: `Kost niets, maar je verliest ${4 + Math.floor(day / 3)} reputatie.` }
      ];
    }
  },
  {
    id: 'spoedlevering', title: 'Leverancier staat vast in het verkeer',
    desc: 'Je basisvoorraad komt niet op tijd. Regel je een dure spoedrit of rek je de voorraad?',
    choices(day) {
      return [
        { id: 'koerier', label: 'Spoedkoerier', detail: `Kost €${18 + day * 2} en brengt bloem en gist.` },
        { id: 'rekken', label: 'Voorraad rekken', detail: `Je verliest een kwart bloem en gist en 2 reputatie.` }
      ];
    }
  },
  {
    id: 'ochtendspits', title: 'Onverwachte ochtendspits', shopOnly: true,
    desc: 'De rij groeit sneller dan voorzien. Zet je extra hulp in of probeer je het alleen?',
    choices(day) {
      return [
        { id: 'hulp', label: 'Extra hulp inzetten', detail: `Kost €${20 + day * 2}; alle wachtende klanten houden langer vol.` },
        { id: 'alleen', label: 'Zelf oplossen', detail: `Kost niets, maar je verliest ${3 + Math.floor(day / 4)} reputatie.` }
      ];
    }
  }
];

/* ---------------- helpers ---------------- */
let _uidCounter = 0;
function uid() { return 'id' + (_uidCounter += 1) + '_' + Math.floor(Math.random() * 10000); }
function clampNum(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmtMoney(n) { return Number(n).toFixed(2).replace('.', ','); }
function fmtClock(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function weightedPick(pairs) {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of pairs) { if (r < w) return k; r -= w; }
  return pairs[pairs.length - 1][0];
}

function dailyCostFor(day) { return DAILY_COST + Math.min(65, Math.max(0, day - 1) * 5); }
function difficultyFor(day) {
  const pressure = Math.max(1, day);
  return {
    level: pressure,
    label: pressure < 3 ? 'Rustig' : pressure < 6 ? 'Druk' : pressure < 9 ? 'Heftig' : 'Meedogenloos',
    customerPressure: 1 + Math.min(0.75, Math.max(0, day - 1) * 0.05),
    patiencePenalty: Math.min(8, Math.floor(Math.max(0, day - 1) / 2)),
    missPenalty: 2 + Math.floor(Math.max(0, day - 1) / 5)
  };
}

function equipmentShopFor(game) {
  const ovenCount = game.ovens.length;
  const equipment = game.equipment;
  return [
    {
      key: 'extraOven', name: 'Extra oven', level: ovenCount, maxLevel: 5,
      cost: 120 + Math.max(0, ovenCount - 3) * 90,
      description: 'Voegt een extra ovenplaats toe zodat je gelijktijdig meer kunt bakken.'
    },
    {
      key: 'ovenUpgrade', name: 'Ovens upgraden', level: equipment.ovenLevel, maxLevel: 4,
      cost: 95 + Math.max(0, equipment.ovenLevel - 1) * 105,
      description: `Elke oven bakt grotere batches en werkt sneller. Nu +${(equipment.ovenLevel - 1) * 25}% opbrengst.`
    },
    {
      key: 'cooling', name: 'Koelcel', level: equipment.coolingLevel, maxLevel: 3,
      cost: 80 + equipment.coolingLevel * 80,
      description: `Bewaart ${equipment.coolingLevel * 4} gekoelde producten voor de volgende dag.`
    },
    {
      key: 'counter', name: 'Toonbank', level: equipment.counterLevel, maxLevel: 4,
      cost: 75 + Math.max(0, equipment.counterLevel - 1) * 75,
      description: `Meer wachtruimte en ${Math.max(0, equipment.counterLevel - 1) * 5}% extra verkoopopbrengst.`
    }
  ];
}

function batchFor(game, recipe) {
  return Math.max(1, Math.ceil(recipe.batch * (1 + (game.equipment.ovenLevel - 1) * 0.25)));
}

function bakeMinutesFor(game, recipe) {
  return Math.max(8, Math.ceil(recipe.bakMin * (1 - (game.equipment.ovenLevel - 1) * 0.08)));
}

function changeReputation(game, amount) {
  game.reputation = clampNum(game.reputation + amount, 0, 100);
  if (game.reputation > 0 || game.gameOver) return;
  game.gameOver = true;
  game.paused = true;
  game.pendingIncident = null;
  game.resultText = `De reputatie van Bakkermans Jones is ingestort. Je hield ${game.daysSurvived} volledige dagen stand en strandde op dag ${game.day}.`;
}

/* ---------------- lifecycle ---------------- */

function genOrdersFor(day, unlockedRecipes = START_RECIPES) {
  const n = Math.min(3, 1 + Math.floor((day - 1) / 4) + (Math.random() < 0.5 ? 0 : 1));
  const premiumPool = unlockedRecipes.filter((key) => RECIPES[key]?.premium);
  const list = [];
  for (let i = 0; i < n; i += 1) {
    const due = 480 + Math.floor(Math.random() * 210); // 08:00 - 11:30
    const product = premiumPool.length && Math.random() < 0.45
      ? premiumPool[Math.floor(Math.random() * premiumPool.length)]
      : 'taart';
    const qty = product === 'taart' || product === 'slagroomtaart'
      ? (day >= 8 && Math.random() < 0.35 ? 2 : 1)
      : 3 + Math.floor(Math.random() * 4);
    list.push({
      id: uid(), product, qty, due,
      reward: Math.round(RECIPES[product].prijs * qty * 1.35 + 8 + day),
      repBonus: 3, status: 'open'
    });
  }
  return list;
}

function genEventFor(day, unlockedRecipes = START_RECIPES) {
  const chance = Math.min(0.75, 0.35 + day * 0.05);
  if (Math.random() >= chance) return null;
  const pool = unlockedRecipes.filter((key) => !RECIPES[key].koeling);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, 2 + (Math.random() < 0.4 ? 1 : 0));
  const needs = {};
  let cost = 0;
  picks.forEach((k) => {
    const qty = 6 + Math.floor(Math.random() * 11) + Math.floor(day / 2);
    needs[k] = qty;
    cost += qty * RECIPES[k].prijs;
  });
  const due = 660 + Math.floor(Math.random() * 60); // 11:00 - 12:00
  return {
    id: uid(),
    title: EVENT_TITLES[Math.floor(Math.random() * EVENT_TITLES.length)],
    desc: 'Levering vóór ' + fmtClock(due) + '.',
    needs, due,
    reward: Math.round(cost * 1.4 + 10),
    repBonus: 6 + Math.floor(day / 3),
    status: 'open'
  };
}

function createGame(roomPlayers) {
  const now = Date.now();
  const game = {
    gameKey: 'bakkermansjones',
    playerId: roomPlayers[0].id,
    gameOver: false,
    resultText: '',
    phase: 'prep',
    day: 1,
    daysSurvived: 0,
    clockMin: DAY_START,
    paused: false,
    speed: 2,
    money: 150,
    reputation: 60,
    difficulty: difficultyFor(1),
    unlockedRecipes: [...START_RECIPES],
    equipment: { ovenLevel: 1, coolingLevel: 0, counterLevel: 1 },
    ingredients: { ...START_INGREDIENTS },
    ovens: [null, null, null],
    shelf: { ...EMPTY_SHELF },
    koelingBroken: false,
    mods: [],
    orders: [],
    event: null,
    pendingIncident: null,
    customerQueue: [],
    nextCustomerAt: SHOP_START + 5,
    log: [{ min: DAY_START, text: 'Nieuwe dag bij Bakkermans Jones. De oven wordt aangestoken…', tone: 'info' }],
    stats: { served: 0, missed: 0, revenueToday: 0, ordersDone: 0, ordersFailed: 0 },
    eventsToday: 0,
    maxEventsToday: 2,
    lastTickAt: now,
    minuteAccumMs: 0
  };
  game.orders = genOrdersFor(1, game.unlockedRecipes);
  game.event = genEventFor(1, game.unlockedRecipes);
  return game;
}

function addLog(game, text, tone) {
  game.log.unshift({ min: game.clockMin, text, tone });
  if (game.log.length > 40) game.log.length = 40;
}

/* ---------------- simulatie ---------------- */

function activeCustomerMultiplier(game) {
  let m = 1;
  game.mods.forEach((mod) => { if (mod.type === 'customerMult') m *= mod.value; });
  return clampNum(m, 0.2, 2.5);
}

function nextInterval(game) {
  const t = game.clockMin;
  let base;
  if (t < 540) base = 4 + Math.random() * 4;       // 07:00-09:00 piek
  else if (t < 660) base = 6 + Math.random() * 5;  // 09:00-11:00
  else base = 9 + Math.random() * 7;                // 11:00-12:00
  const repFactor = clampNum(0.6 + game.reputation / 150, 0.6, 1.4);
  const mult = activeCustomerMultiplier(game) * difficultyFor(game.day).customerPressure;
  return clampNum(Math.round(base / (repFactor * mult)), 2, 40);
}

function maybeSpawnCustomer(game) {
  if (game.clockMin < game.nextCustomerAt) return;
  const queueCapacity = 3 + game.equipment.counterLevel;
  if (game.customerQueue.length < queueCapacity) {
    const key = weightedPick(game.unlockedRecipes.map((recipeKey) => [recipeKey, RECIPES[recipeKey].weight || 10]));
    const extraDemand = game.day >= 4 && Math.random() < Math.min(0.6, game.day * 0.04) ? 1 : 0;
    const qty = key === 'taart' ? 1 : 1 + Math.floor(Math.random() * 3) + extraDemand;
    const patience = Math.max(7, 12 + Math.floor(Math.random() * 9) - difficultyFor(game.day).patiencePenalty + (game.equipment.counterLevel - 1) * 2);
    game.customerQueue.push({ id: uid(), wants: { key, qty }, bornAt: game.clockMin, patience });
  } else {
    addLog(game, 'Een klant zag de rij en liep verder.', 'info');
  }
  game.nextCustomerAt = game.clockMin + nextInterval(game);
}

function updateCustomerPatience(game) {
  const still = [];
  game.customerQueue.forEach((c) => {
    if (game.clockMin - c.bornAt >= c.patience) {
      game.stats.missed += 1;
      changeReputation(game, -difficultyFor(game.day).missPenalty);
      addLog(game, `Een klant vertrok ongeduldig zonder ${RECIPES[c.wants.key].naam}.`, 'bad');
    } else {
      still.push(c);
    }
  });
  game.customerQueue = still;
}

function checkDeadlines(game) {
  game.orders.forEach((o) => {
    if (o.status === 'open' && game.clockMin > o.due) {
      o.status = 'failed';
      changeReputation(game, -o.repBonus);
      game.stats.ordersFailed += 1;
      addLog(game, `Bestelling (${RECIPES[o.product].naam}) niet op tijd geleverd.`, 'bad');
    }
  });
  if (game.event && game.event.status === 'open' && game.clockMin > game.event.due) {
    game.event.status = 'failed';
    changeReputation(game, -game.event.repBonus);
    addLog(game, `Evenement "${game.event.title}" mislukt: te laat.`, 'bad');
  }
}

function completeOven(game, idx) {
  const o = game.ovens[idx];
  const r = RECIPES[o.recipeKey];
  const batch = batchFor(game, r);
  game.shelf[o.recipeKey] += batch;
  game.ovens[idx] = null;
  addLog(game, `${batch}× ${r.naam} vers uit de oven!`, 'good');
}

function maybeTriggerEvent(game) {
  if (game.eventsToday >= game.maxEventsToday || game.pendingIncident) return;
  if (game.clockMin < 60) return;
  const chance = Math.min(0.006, 0.0018 + game.day * 0.00025);
  if (Math.random() >= chance) return;
  game.eventsToday += 1;
  if (Math.random() < 0.7) {
    const eligible = INCIDENTS.filter((incident) => !incident.shopOnly || game.phase === 'shop');
    const incident = eligible[Math.floor(Math.random() * eligible.length)];
    game.pendingIncident = {
      id: uid(), type: incident.id, title: incident.title, desc: incident.desc,
      choices: incident.choices(game.day), wasPaused: game.paused
    };
    game.paused = true;
    addLog(game, `${incident.title} — ingrijpen nodig!`, 'bad');
    return;
  }
  const eligible = EVENTS.filter((e) => e.tone === 'good' && (e.id !== 'school' || game.phase === 'shop'));
  const ev = eligible[Math.floor(Math.random() * eligible.length)];
  ev.apply(game);
  addLog(game, `${ev.title} — ${ev.desc}`, ev.tone);
}

function openShop(game) {
  if (game.phase !== 'shopPrompt') throw new Error('De winkel kan nu niet geopend worden.');
  game.phase = 'shop';
  game.paused = false;
  addLog(game, 'De winkel is open!', 'info');
}

function closeShop(game) {
  if (game.customerQueue.length) {
    game.customerQueue.forEach(() => {
      game.stats.missed += 1;
      changeReputation(game, -difficultyFor(game.day).missPenalty);
    });
    addLog(game, 'De winkel sluit — de rest van de rij gaat onverrichter zake naar huis.', 'bad');
    game.customerQueue = [];
  }
  addLog(game, 'De winkel is gesloten voor vandaag.', 'info');
  game.phase = 'closePrompt';
  game.paused = true;
}

function goToSupermarket(game) {
  if (game.phase !== 'closePrompt') throw new Error('Je kunt nu niet naar de supermarkt.');
  game.phase = 'supermarket';
  game.paused = false;
  addLog(game, 'Tijd om inkopen te doen voor morgen.', 'info');
}

function endDay(game) {
  const dailyCost = dailyCostFor(game.day);
  game.money -= dailyCost;
  game.phase = 'dayEnd';
  game.paused = true;
  if (game.money < 0) {
    const shortage = Math.abs(game.money);
    const repLoss = Math.max(2, Math.ceil(shortage / 3));
    game.money = 0;
    addLog(game, `De dagkosten konden niet volledig betaald worden: -${repLoss} reputatie.`, 'bad');
    changeReputation(game, -repLoss);
  }
  if (!game.gameOver) game.daysSurvived = game.day;
}

function advanceOneMinute(game) {
  game.clockMin += 1;
  game.ovens.forEach((o, idx) => { if (o && game.clockMin >= o.endMin) completeOven(game, idx); });
  game.mods = game.mods.filter((m) => m.endMin > game.clockMin);
  checkDeadlines(game);
  if (game.gameOver) return;
  if (game.phase === 'shop') {
    updateCustomerPatience(game);
    maybeSpawnCustomer(game);
  }
  if (game.gameOver) return;
  maybeTriggerEvent(game);

  if (game.phase === 'prep' && game.clockMin >= SHOP_START) {
    game.phase = 'shopPrompt';
    game.paused = true;
  } else if (game.phase === 'shop' && game.clockMin >= SHOP_END) {
    closeShop(game);
  } else if (game.phase === 'supermarket' && game.clockMin >= SUPERMARKET_END) {
    endDay(game);
  }
}

function goToNextDay(game) {
  if (game.phase !== 'dayEnd') throw new Error('De dag is nog niet voorbij.');
  const wasBroken = game.koelingBroken;
  let coolingSpace = game.equipment.coolingLevel * 4;
  const chilledStock = {};
  [...game.unlockedRecipes].sort((a, b) => RECIPES[b].prijs - RECIPES[a].prijs).forEach((key) => {
    if (!RECIPES[key].koeling || coolingSpace <= 0) return;
    const kept = Math.min(game.shelf[key] || 0, coolingSpace);
    chilledStock[key] = kept;
    coolingSpace -= kept;
  });
  game.day += 1;
  game.difficulty = difficultyFor(game.day);
  game.clockMin = DAY_START;
  game.phase = 'prep';
  game.ovens = [null, null, null];
  game.shelf = { ...EMPTY_SHELF };
  Object.entries(chilledStock).forEach(([key, qty]) => { game.shelf[key] = qty; });
  game.koelingBroken = false;
  game.mods = [];
  game.customerQueue = [];
  game.nextCustomerAt = SHOP_START + Math.floor(Math.random() * 10);
  game.orders = genOrdersFor(game.day, game.unlockedRecipes);
  game.event = genEventFor(game.day, game.unlockedRecipes);
  game.pendingIncident = null;
  game.eventsToday = 0;
  game.maxEventsToday = Math.min(5, 2 + Math.floor((game.day - 1) / 3));
  game.stats = { served: 0, missed: 0, revenueToday: 0, ordersDone: 0, ordersFailed: 0 };
  game.paused = false;
  game.minuteAccumMs = 0;
  if (wasBroken) addLog(game, 'De koelgroep is \'s nachts hersteld.', 'good');
  const keptTotal = Object.values(chilledStock).reduce((sum, qty) => sum + qty, 0);
  if (keptTotal) addLog(game, `${keptTotal} gekoelde producten bleven vers in de koelcel.`, 'good');
  addLog(game, `— Dag ${game.day} begint —`, 'info');
}

/* ---------------- acties ---------------- */

function bakeRecipe(game, key) {
  const r = RECIPES[key];
  if (!r) throw new Error('Onbekend recept.');
  if (!game.unlockedRecipes.includes(key)) throw new Error('Dit recept is nog niet ontgrendeld.');
  if (game.phase !== 'prep') throw new Error('Je kunt enkel bakken tijdens de voorbereiding.');
  if (r.koeling && game.koelingBroken) throw new Error('De koeling is stuk — geen taarten mogelijk.');
  const idx = game.ovens.findIndex((o) => o === null);
  if (idx === -1) throw new Error('Geen vrije oven.');
  for (const ing in r.kost) { if ((game.ingredients[ing] || 0) < r.kost[ing]) throw new Error('Te weinig ingrediënten.'); }
  for (const ing in r.kost) { game.ingredients[ing] -= r.kost[ing]; }
  game.ovens[idx] = { recipeKey: key, startMin: game.clockMin, endMin: game.clockMin + bakeMinutesFor(game, r) };
  addLog(game, `Oven ${idx + 1} gestart met ${r.naam}.`, 'info');
}

function serveCustomer(game, id) {
  if (game.phase !== 'shop') throw new Error('De winkel is niet open.');
  const c = game.customerQueue.find((x) => x.id === id);
  if (!c) throw new Error('Klant niet gevonden.');
  const r = RECIPES[c.wants.key];
  if ((game.shelf[c.wants.key] || 0) < c.wants.qty) throw new Error('Niet genoeg op de plank.');
  game.shelf[c.wants.key] -= c.wants.qty;
  const earn = c.wants.qty * r.prijs * (1 + (game.equipment.counterLevel - 1) * 0.05);
  game.money += earn;
  changeReputation(game, 1);
  game.stats.served += 1;
  game.stats.revenueToday += earn;
  game.customerQueue = game.customerQueue.filter((x) => x.id !== id);
  addLog(game, `Klant bediend: ${c.wants.qty}× ${r.naam} (+€${fmtMoney(earn)}).`, 'good');
}

function deliverOrder(game, id) {
  if (game.phase !== 'shop') throw new Error('De winkel is niet open.');
  const o = game.orders.find((x) => x.id === id);
  if (!o || o.status !== 'open') throw new Error('Bestelling niet beschikbaar.');
  if ((game.shelf[o.product] || 0) < o.qty) throw new Error('Niet genoeg op de plank.');
  game.shelf[o.product] -= o.qty;
  game.money += o.reward;
  changeReputation(game, o.repBonus);
  o.status = 'done';
  game.stats.ordersDone += 1;
  addLog(game, `Bestelling geleverd: ${o.qty}× ${RECIPES[o.product].naam} (+€${fmtMoney(o.reward)}).`, 'good');
}

function deliverEvent(game) {
  if (game.phase !== 'shop') throw new Error('De winkel is niet open.');
  const ev = game.event;
  if (!ev || ev.status !== 'open') throw new Error('Geen openstaand evenement.');
  for (const k in ev.needs) { if ((game.shelf[k] || 0) < ev.needs[k]) throw new Error('Niet genoeg op de plank.'); }
  for (const k in ev.needs) { game.shelf[k] -= ev.needs[k]; }
  game.money += ev.reward;
  changeReputation(game, ev.repBonus);
  ev.status = 'done';
  addLog(game, `Evenement "${ev.title}" geleverd! (+€${fmtMoney(ev.reward)})`, 'good');
}

function repairKoeling(game) {
  if (!game.koelingBroken) throw new Error('De koeling is niet stuk.');
  if (game.money < 80) throw new Error('Te weinig geld voor herstel.');
  game.money -= 80;
  game.koelingBroken = false;
  addLog(game, 'De koelgroep is hersteld.', 'good');
}

function buyIngredient(game, key) {
  if (game.phase !== 'supermarket') throw new Error('Je kunt nu niet inkopen.');
  const price = INGREDIENT_PRICES[key];
  if (!price) throw new Error('Onbekend ingrediënt.');
  const cost = price * BUY_BATCH;
  if (game.money < cost) throw new Error('Te weinig geld.');
  game.money -= cost;
  game.ingredients[key] = (game.ingredients[key] || 0) + BUY_BATCH;
  addLog(game, `${BUY_BATCH}× ${INGREDIENT_META[key]} ingeslagen (-€${fmtMoney(cost)}).`, 'info');
}

function buyEquipment(game, key) {
  if (game.phase !== 'supermarket') throw new Error('Je kunt nu alleen materiaal kopen in de supermarkt.');
  const offer = equipmentShopFor(game).find((item) => item.key === key);
  if (!offer) throw new Error('Onbekend materiaal.');
  if (offer.level >= offer.maxLevel) throw new Error('Dit materiaal is maximaal verbeterd.');
  if (game.money < offer.cost) throw new Error('Te weinig geld.');
  game.money -= offer.cost;
  if (key === 'extraOven') game.ovens.push(null);
  else if (key === 'ovenUpgrade') game.equipment.ovenLevel += 1;
  else if (key === 'cooling') game.equipment.coolingLevel += 1;
  else if (key === 'counter') game.equipment.counterLevel += 1;
  addLog(game, `${offer.name} gekocht of verbeterd (-€${fmtMoney(offer.cost)}).`, 'good');
}

function buyRecipe(game, key) {
  if (game.phase !== 'supermarket') throw new Error('Je kunt nu alleen recepten kopen in de supermarkt.');
  const recipe = RECIPES[key];
  if (!recipe?.unlockPrice) throw new Error('Dit recept is niet te koop.');
  if (game.unlockedRecipes.includes(key)) throw new Error('Dit recept is al ontgrendeld.');
  if (game.day < recipe.unlockDay) throw new Error(`Dit recept is beschikbaar vanaf dag ${recipe.unlockDay}.`);
  if (game.money < recipe.unlockPrice) throw new Error('Te weinig geld.');
  game.money -= recipe.unlockPrice;
  game.unlockedRecipes.push(key);
  changeReputation(game, 3);
  addLog(game, `Nieuw recept geleerd: ${recipe.naam}! (+3 reputatie)`, 'good');
}

function resolveIncident(game, choiceId) {
  const incident = game.pendingIncident;
  if (!incident) throw new Error('Er is geen incident om op te lossen.');
  if (!incident.choices.some((choice) => choice.id === choiceId)) throw new Error('Ongeldige ingreep.');
  const day = game.day;
  let result = '';

  if (incident.type === 'ovenstoring' && choiceId === 'technieker') {
    const cost = 25 + day * 3;
    if (game.money < cost) throw new Error('Te weinig geld voor deze ingreep.');
    game.money -= cost;
    result = `De technieker houdt de ovens draaiende (-€${fmtMoney(cost)}).`;
  } else if (incident.type === 'ovenstoring') {
    const delay = 20 + day * 2;
    game.ovens.forEach((oven) => { if (oven) oven.endMin += delay; });
    changeReputation(game, -(3 + Math.ceil(day / 3)));
    result = `De ovens lopen ${delay} minuten vertraging op.`;
  } else if (incident.type === 'klacht' && choiceId === 'terugbetalen') {
    const cost = 12 + day * 2;
    if (game.money < cost) throw new Error('Te weinig geld voor deze ingreep.');
    game.money -= cost;
    changeReputation(game, 2);
    result = `De klant vertrekt tevreden na een compensatie van €${fmtMoney(cost)}.`;
  } else if (incident.type === 'klacht') {
    changeReputation(game, -(4 + Math.floor(day / 3)));
    result = 'De excuses overtuigen niet en het verhaal doet de ronde.';
  } else if (incident.type === 'spoedlevering' && choiceId === 'koerier') {
    const cost = 18 + day * 2;
    if (game.money < cost) throw new Error('Te weinig geld voor deze ingreep.');
    game.money -= cost;
    game.ingredients.bloem += 18;
    game.ingredients.gist += 5;
    result = `De spoedkoerier levert bloem en gist (-€${fmtMoney(cost)}).`;
  } else if (incident.type === 'spoedlevering') {
    game.ingredients.bloem = Math.floor(game.ingredients.bloem * 0.75);
    game.ingredients.gist = Math.floor(game.ingredients.gist * 0.75);
    changeReputation(game, -2);
    result = 'De kleinere broden vallen op bij je vaste klanten.';
  } else if (incident.type === 'ochtendspits' && choiceId === 'hulp') {
    const cost = 20 + day * 2;
    if (game.money < cost) throw new Error('Te weinig geld voor deze ingreep.');
    game.money -= cost;
    game.customerQueue.forEach((customer) => { customer.patience += 8; });
    result = `Extra hulp kalmeert de rij (-€${fmtMoney(cost)}).`;
  } else if (incident.type === 'ochtendspits') {
    changeReputation(game, -(3 + Math.floor(day / 4)));
    result = 'De wachtrij zorgt voor gemopper en slechte mond-tot-mondreclame.';
  }

  const shouldResume = !incident.wasPaused && !game.gameOver;
  game.pendingIncident = null;
  game.paused = !shouldResume;
  addLog(game, result, game.gameOver ? 'bad' : 'info');
}

function togglePause(game) {
  if (PAUSING_PHASES.has(game.phase) || game.pendingIncident) throw new Error('Nu even niet.');
  game.paused = !game.paused;
}

function setSpeed(game, n) {
  if (![1, 2, 4].includes(n)) throw new Error('Ongeldige snelheid.');
  game.speed = n;
}

function handleAction(game, playerId, action, payload = {}) {
  if (playerId !== game.playerId) throw new Error('Niet jouw spel.');
  if (game.gameOver) throw new Error('Het spel is afgelopen.');

  if (game.pendingIncident && action !== 'resolveIncident') throw new Error('Los eerst het incident op.');

  if (action === 'bake') bakeRecipe(game, String(payload.key || ''));
  else if (action === 'serveCustomer') serveCustomer(game, String(payload.id || ''));
  else if (action === 'deliverOrder') deliverOrder(game, String(payload.id || ''));
  else if (action === 'deliverEvent') deliverEvent(game);
  else if (action === 'repairKoeling') repairKoeling(game);
  else if (action === 'buyIngredient') buyIngredient(game, String(payload.key || ''));
  else if (action === 'buyEquipment') buyEquipment(game, String(payload.key || ''));
  else if (action === 'buyRecipe') buyRecipe(game, String(payload.key || ''));
  else if (action === 'resolveIncident') resolveIncident(game, String(payload.choiceId || ''));
  else if (action === 'togglePause') togglePause(game);
  else if (action === 'setSpeed') setSpeed(game, Number(payload.value));
  else if (action === 'openShop') openShop(game);
  else if (action === 'goToSupermarket') goToSupermarket(game);
  else if (action === 'nextDay') goToNextDay(game);
  else throw new Error('Onbekende actie.');
}

/* ---------------- tick (doorlopende simulatie) ---------------- */

function tick(game, now) {
  if (game.gameOver) return false;
  const last = game.lastTickAt || now;
  const elapsedMs = Math.min(Math.max(0, now - last), 4000);
  game.lastTickAt = now;
  if (game.paused) return false;

  const msPerMinute = TICK_BASE_MS / game.speed;
  game.minuteAccumMs = (game.minuteAccumMs || 0) + elapsedMs;

  let changed = false;
  let guard = 0;
  while (game.minuteAccumMs >= msPerMinute && guard < 600) {
    game.minuteAccumMs -= msPerMinute;
    advanceOneMinute(game);
    changed = true;
    guard += 1;
    if (game.gameOver || game.paused || PAUSING_PHASES.has(game.phase)) break;
  }
  return changed;
}

/* ---------------- serialize ---------------- */

function serialize(game) {
  return {
    kind: 'bakkermansjones',
    gameOver: game.gameOver,
    resultText: game.resultText,
    phase: game.phase,
    day: game.day,
    clockMin: game.clockMin,
    dayStart: DAY_START,
    shopStart: SHOP_START,
    shopEnd: SHOP_END,
    supermarketEnd: SUPERMARKET_END,
    dailyCost: dailyCostFor(game.day),
    daysSurvived: game.daysSurvived,
    difficulty: difficultyFor(game.day),
    paused: game.paused,
    speed: game.speed,
    money: game.money,
    reputation: game.reputation,
    ingredients: { ...game.ingredients },
    ingredientMeta: INGREDIENT_META,
    ingredientPrices: INGREDIENT_PRICES,
    buyBatch: BUY_BATCH,
    recipes: Object.fromEntries(Object.entries(RECIPES).map(([key, recipe]) => [key, {
      ...recipe,
      baseBatch: recipe.batch,
      batch: batchFor(game, recipe),
      bakMin: bakeMinutesFor(game, recipe)
    }])),
    unlockedRecipes: [...game.unlockedRecipes],
    equipment: { ...game.equipment, ovenCount: game.ovens.length },
    equipmentShop: equipmentShopFor(game),
    ovens: game.ovens.map((o) => (o ? { recipeKey: o.recipeKey, startMin: o.startMin, endMin: o.endMin } : null)),
    shelf: { ...game.shelf },
    koelingBroken: game.koelingBroken,
    orders: game.orders.map((o) => ({ ...o })),
    event: game.event ? { ...game.event, needs: { ...game.event.needs } } : null,
    pendingIncident: game.pendingIncident ? {
      id: game.pendingIncident.id,
      type: game.pendingIncident.type,
      title: game.pendingIncident.title,
      desc: game.pendingIncident.desc,
      choices: game.pendingIncident.choices.map((choice) => ({ ...choice }))
    } : null,
    customerQueue: game.customerQueue.map((c) => ({ ...c })),
    log: game.log.slice(0, 40),
    stats: { ...game.stats }
  };
}

/* ---------------- eindresultaat ---------------- */

function results(game, durationMs) {
  return [{
    playerId: game.playerId,
    placement: 1,
    score: game.daysSurvived,
    won: false,
    outcome: game.resultText || `${game.daysSurvived} dagen overleefd.`,
    durationMs
  }];
}

module.exports = {
  createGame, handleAction, serialize, tick, results,
  // geëxporteerd voor tests / intern hergebruik
  RECIPES, INGREDIENT_META, INGREDIENT_PRICES, BUY_BATCH,
  DAY_START, SHOP_START, SHOP_END, SUPERMARKET_END, DAILY_COST,
  dailyCostFor, difficultyFor
};
