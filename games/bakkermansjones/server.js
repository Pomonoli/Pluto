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
 * De dag loopt van 03:00 (bakken) tot 12:00 (winkel dicht) in speltijd-
 * minuten. tick() zet die speltijd-klok verder op basis van verstreken
 * werkelijke tijd (zoals Ragnarok dat doet), zodat de simulatie ook
 * doorloopt zonder speleractie: ovens worden klaar, klanten komen en gaan,
 * en willekeurige tegenslagen kunnen toeslaan.
 */

const DAY_START = 180;   // 03:00 in minuten sinds middernacht
const SHOP_START = 420;  // 07:00
const DAY_END = 720;     // 12:00
const DAILY_COST = 35;   // vaste kosten per dag (huur, energie)
const TICK_BASE_MS = 250; // bij snelheid 1x kost één speltijd-minuut dit aantal ms

const RECIPES = {
  stokbrood: { key: 'stokbrood', naam: 'Stokbrood', batch: 4, bakMin: 18, prijs: 2.60, kost: { bloem: 3, gist: 1 }, koeling: false },
  pistolet: { key: 'pistolet', naam: 'Pistolets', batch: 8, bakMin: 15, prijs: 0.70, kost: { bloem: 3, gist: 1, boter: 1 }, koeling: false },
  croissant: { key: 'croissant', naam: 'Croissants', batch: 8, bakMin: 24, prijs: 1.90, kost: { bloem: 4, boter: 3, eieren: 1 }, koeling: false },
  koffiekoek: { key: 'koffiekoek', naam: 'Koffiekoeken', batch: 6, bakMin: 22, prijs: 2.30, kost: { bloem: 3, boter: 2, suiker: 2, eieren: 1 }, koeling: false },
  taart: { key: 'taart', naam: 'Taart', batch: 1, bakMin: 40, prijs: 19.00, kost: { bloem: 2, boter: 2, eieren: 3, suiker: 3, room: 2 }, koeling: true }
};

const INGREDIENT_META = { bloem: 'Bloem', gist: 'Gist', boter: 'Boter', suiker: 'Suiker', eieren: 'Eieren', room: 'Room' };

const START_INGREDIENTS = { bloem: 70, gist: 12, boter: 28, suiker: 18, eieren: 22, room: 8 };
const EMPTY_SHELF = { stokbrood: 0, pistolet: 0, croissant: 0, koffiekoek: 0, taart: 0 };

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
      game.reputation = clampNum(game.reputation + 8, 0, 100);
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

/* ---------------- lifecycle ---------------- */

function genOrdersFor(day) {
  const n = Math.random() < 0.5 ? 1 : 2;
  const list = [];
  for (let i = 0; i < n; i += 1) {
    const due = 480 + Math.floor(Math.random() * 210); // 08:00 - 11:30
    list.push({
      id: uid(), product: 'taart', qty: 1, due,
      reward: Math.round(14 + Math.random() * 10 + day),
      repBonus: 3, status: 'open'
    });
  }
  return list;
}

function genEventFor(day) {
  const chance = Math.min(0.75, 0.35 + day * 0.05);
  if (Math.random() >= chance) return null;
  const pool = ['stokbrood', 'pistolet', 'croissant', 'koffiekoek'];
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
    day: 1,
    clockMin: DAY_START,
    paused: false,
    speed: 2,
    dayEndPending: false,
    money: 150,
    reputation: 60,
    ingredients: { ...START_INGREDIENTS },
    ovens: [null, null, null],
    shelf: { ...EMPTY_SHELF },
    koelingBroken: false,
    mods: [],
    orders: [],
    event: null,
    customerQueue: [],
    nextCustomerAt: SHOP_START + 5,
    log: [{ min: DAY_START, text: 'Nieuwe dag bij Bakkermans Jones. De oven wordt aangestoken…', tone: 'info' }],
    stats: { served: 0, missed: 0, revenueToday: 0, ordersDone: 0, ordersFailed: 0 },
    eventsToday: 0,
    maxEventsToday: 2,
    lastTickAt: now,
    minuteAccumMs: 0
  };
  game.orders = genOrdersFor(1);
  game.event = genEventFor(1);
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
  const mult = activeCustomerMultiplier(game);
  return clampNum(Math.round(base / (repFactor * mult)), 2, 40);
}

function maybeSpawnCustomer(game) {
  if (game.clockMin < game.nextCustomerAt) return;
  if (game.customerQueue.length < 4) {
    const key = weightedPick([['stokbrood', 30], ['pistolet', 25], ['croissant', 25], ['koffiekoek', 15], ['taart', 5]]);
    const qty = key === 'taart' ? 1 : 1 + Math.floor(Math.random() * 3);
    const patience = 12 + Math.floor(Math.random() * 9);
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
      game.reputation = clampNum(game.reputation - 2, 0, 100);
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
      game.reputation = clampNum(game.reputation - o.repBonus, 0, 100);
      game.stats.ordersFailed += 1;
      addLog(game, `Bestelling (${RECIPES[o.product].naam}) niet op tijd geleverd.`, 'bad');
    }
  });
  if (game.event && game.event.status === 'open' && game.clockMin > game.event.due) {
    game.event.status = 'failed';
    game.reputation = clampNum(game.reputation - game.event.repBonus, 0, 100);
    addLog(game, `Evenement "${game.event.title}" mislukt: te laat.`, 'bad');
  }
}

function completeOven(game, idx) {
  const o = game.ovens[idx];
  const r = RECIPES[o.recipeKey];
  game.shelf[o.recipeKey] += r.batch;
  game.ovens[idx] = null;
  addLog(game, `${r.batch}× ${r.naam} vers uit de oven!`, 'good');
}

function maybeTriggerEvent(game) {
  if (game.eventsToday >= game.maxEventsToday) return;
  if (game.clockMin < 200) return;
  if (Math.random() >= 0.0025) return;
  const eligible = EVENTS.filter((e) => e.id !== 'school' || game.clockMin >= SHOP_START);
  const ev = eligible[Math.floor(Math.random() * eligible.length)];
  ev.apply(game);
  game.eventsToday += 1;
  addLog(game, `${ev.title} — ${ev.desc}`, ev.tone);
}

function endDay(game) {
  game.money -= DAILY_COST;
  game.dayEndPending = true;
  game.paused = true;
  if (game.money < 0) {
    game.gameOver = true;
    game.resultText = `Bakkermans Jones is failliet gegaan na dag ${game.day} (eindstand €${fmtMoney(game.money)}).`;
  }
}

function advanceOneMinute(game) {
  game.clockMin += 1;
  game.ovens.forEach((o, idx) => { if (o && game.clockMin >= o.endMin) completeOven(game, idx); });
  game.mods = game.mods.filter((m) => m.endMin > game.clockMin);
  checkDeadlines(game);
  if (game.clockMin >= SHOP_START) {
    updateCustomerPatience(game);
    maybeSpawnCustomer(game);
  }
  maybeTriggerEvent(game);
  if (game.clockMin >= DAY_END) endDay(game);
}

function goToNextDay(game) {
  if (!game.dayEndPending) throw new Error('De dag is nog niet voorbij.');
  const wasBroken = game.koelingBroken;
  game.day += 1;
  game.clockMin = DAY_START;
  game.ovens = [null, null, null];
  game.shelf = { ...EMPTY_SHELF };
  game.ingredients = { ...START_INGREDIENTS };
  game.koelingBroken = false;
  game.mods = [];
  game.customerQueue = [];
  game.nextCustomerAt = SHOP_START + Math.floor(Math.random() * 10);
  game.orders = genOrdersFor(game.day);
  game.event = genEventFor(game.day);
  game.eventsToday = 0;
  game.maxEventsToday = 2 + (game.day > 4 ? 1 : 0);
  game.stats = { served: 0, missed: 0, revenueToday: 0, ordersDone: 0, ordersFailed: 0 };
  game.dayEndPending = false;
  game.paused = false;
  game.minuteAccumMs = 0;
  if (wasBroken) addLog(game, 'De koelgroep is \'s nachts hersteld.', 'good');
  addLog(game, `— Dag ${game.day} begint —`, 'info');
}

/* ---------------- acties ---------------- */

function bakeRecipe(game, key) {
  const r = RECIPES[key];
  if (!r) throw new Error('Onbekend recept.');
  if (game.dayEndPending) throw new Error('De dag is voorbij.');
  if (r.koeling && game.koelingBroken) throw new Error('De koeling is stuk — geen taarten mogelijk.');
  const idx = game.ovens.findIndex((o) => o === null);
  if (idx === -1) throw new Error('Geen vrije oven.');
  for (const ing in r.kost) { if ((game.ingredients[ing] || 0) < r.kost[ing]) throw new Error('Te weinig ingrediënten.'); }
  for (const ing in r.kost) { game.ingredients[ing] -= r.kost[ing]; }
  game.ovens[idx] = { recipeKey: key, startMin: game.clockMin, endMin: game.clockMin + r.bakMin };
  addLog(game, `Oven ${idx + 1} gestart met ${r.naam}.`, 'info');
}

function serveCustomer(game, id) {
  const c = game.customerQueue.find((x) => x.id === id);
  if (!c) throw new Error('Klant niet gevonden.');
  const r = RECIPES[c.wants.key];
  if ((game.shelf[c.wants.key] || 0) < c.wants.qty) throw new Error('Niet genoeg op de plank.');
  game.shelf[c.wants.key] -= c.wants.qty;
  const earn = c.wants.qty * r.prijs;
  game.money += earn;
  game.reputation = clampNum(game.reputation + 1, 0, 100);
  game.stats.served += 1;
  game.stats.revenueToday += earn;
  game.customerQueue = game.customerQueue.filter((x) => x.id !== id);
  addLog(game, `Klant bediend: ${c.wants.qty}× ${r.naam} (+€${fmtMoney(earn)}).`, 'good');
}

function deliverOrder(game, id) {
  const o = game.orders.find((x) => x.id === id);
  if (!o || o.status !== 'open') throw new Error('Bestelling niet beschikbaar.');
  if ((game.shelf[o.product] || 0) < o.qty) throw new Error('Niet genoeg op de plank.');
  game.shelf[o.product] -= o.qty;
  game.money += o.reward;
  game.reputation = clampNum(game.reputation + o.repBonus, 0, 100);
  o.status = 'done';
  game.stats.ordersDone += 1;
  addLog(game, `Bestelling geleverd: ${o.qty}× ${RECIPES[o.product].naam} (+€${fmtMoney(o.reward)}).`, 'good');
}

function deliverEvent(game) {
  const ev = game.event;
  if (!ev || ev.status !== 'open') throw new Error('Geen openstaand evenement.');
  for (const k in ev.needs) { if ((game.shelf[k] || 0) < ev.needs[k]) throw new Error('Niet genoeg op de plank.'); }
  for (const k in ev.needs) { game.shelf[k] -= ev.needs[k]; }
  game.money += ev.reward;
  game.reputation = clampNum(game.reputation + ev.repBonus, 0, 100);
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

function setSpeed(game, n) {
  if (![1, 2, 4].includes(n)) throw new Error('Ongeldige snelheid.');
  game.speed = n;
}

function handleAction(game, playerId, action, payload = {}) {
  if (playerId !== game.playerId) throw new Error('Niet jouw spel.');
  if (game.gameOver) throw new Error('Het spel is afgelopen.');

  if (action === 'bake') bakeRecipe(game, String(payload.key || ''));
  else if (action === 'serveCustomer') serveCustomer(game, String(payload.id || ''));
  else if (action === 'deliverOrder') deliverOrder(game, String(payload.id || ''));
  else if (action === 'deliverEvent') deliverEvent(game);
  else if (action === 'repairKoeling') repairKoeling(game);
  else if (action === 'togglePause') game.paused = !game.paused;
  else if (action === 'setSpeed') setSpeed(game, Number(payload.value));
  else if (action === 'nextDay') goToNextDay(game);
  else throw new Error('Onbekende actie.');
}

/* ---------------- tick (doorlopende simulatie) ---------------- */

function tick(game, now) {
  if (game.gameOver) return false;
  const last = game.lastTickAt || now;
  const elapsedMs = Math.min(Math.max(0, now - last), 4000);
  game.lastTickAt = now;
  if (game.paused || game.dayEndPending) return false;

  const msPerMinute = TICK_BASE_MS / game.speed;
  game.minuteAccumMs = (game.minuteAccumMs || 0) + elapsedMs;

  let changed = false;
  let guard = 0;
  while (game.minuteAccumMs >= msPerMinute && guard < 600) {
    game.minuteAccumMs -= msPerMinute;
    advanceOneMinute(game);
    changed = true;
    guard += 1;
    if (game.dayEndPending || game.gameOver) break;
  }
  return changed;
}

/* ---------------- serialize ---------------- */

function serialize(game) {
  return {
    kind: 'bakkermansjones',
    gameOver: game.gameOver,
    resultText: game.resultText,
    day: game.day,
    clockMin: game.clockMin,
    dayStart: DAY_START,
    shopStart: SHOP_START,
    dayEnd: DAY_END,
    dailyCost: DAILY_COST,
    paused: game.paused,
    speed: game.speed,
    dayEndPending: game.dayEndPending,
    money: game.money,
    reputation: game.reputation,
    ingredients: { ...game.ingredients },
    ingredientMeta: INGREDIENT_META,
    recipes: RECIPES,
    ovens: game.ovens.map((o) => (o ? { recipeKey: o.recipeKey, startMin: o.startMin, endMin: o.endMin } : null)),
    shelf: { ...game.shelf },
    koelingBroken: game.koelingBroken,
    orders: game.orders.map((o) => ({ ...o })),
    event: game.event ? { ...game.event, needs: { ...game.event.needs } } : null,
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
    score: Math.round(game.money),
    won: false,
    outcome: game.resultText || `Dag ${game.day} bereikt.`,
    durationMs
  }];
}

module.exports = {
  createGame, handleAction, serialize, tick, results,
  // geëxporteerd voor tests / intern hergebruik
  RECIPES, INGREDIENT_META, DAY_START, SHOP_START, DAY_END, DAILY_COST
};
