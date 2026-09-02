'use strict';

const { getWorld, isWalkable, isWater, biomeAt, nearestWalkable, findPath, hexDistance } = require('./worldgen');
const { SETS, fishForBiome, getFish, priceFor } = require('./fish');

const STEP_MS = 170;
const HOOK_WINDOW_MS = 900;
const REEL_WINDOW_MIN_MS = 700;
const REEL_WINDOW_MAX_MS = 1300;
const BITE_MIN_MS = 1200;
const BITE_MAX_MS = 3200;
const RESULT_DISPLAY_MS = 3500;
const STARTING_CASH = 25;
const RARITY_WEIGHT = { common: 60, uncommon: 27, rare: 11, epic: 2 };

const GEAR_KEYS = ['rod', 'bait', 'boat'];
const GEAR_COSTS = [150, 400, 900, 1800];
const GEAR_MAX_LEVEL = GEAR_COSTS.length;
const ROD_HOOK_BONUS_MS = 150;
const BAIT_RARE_MULTIPLIER = 1.3;
const WATER_TIERS = [[], ['r'], ['r', 'k'], ['r', 'k', 'a', 'm']];
const SET_COMPLETE_BONUS = 600;
const SET_BONUS_MULTIPLIER = 1.15;
const GEAR_LABEL = { rod: 'hengel', bait: 'aas', boat: 'boot' };

function boatWaterSet(player) {
  const tier = Math.min(player.gear.boat, WATER_TIERS.length - 1);
  return new Set(WATER_TIERS[tier] || []);
}

function defaultGear() { return { rod: 0, bait: 0, boat: 0 }; }
function defaultSetBonuses() { return Object.fromEntries(SETS.map((set) => [set.id, false])); }

function sanitizeSaved(saved) {
  const knownFish = new Set(SETS.flatMap((set) => set.fish.map((fish) => fish.id)));
  const discovered = Array.isArray(saved?.discovered) ? saved.discovered.filter((id) => knownFish.has(id)) : [];
  const inventory = Array.isArray(saved?.inventory)
    ? saved.inventory.filter((item) => item && knownFish.has(item.speciesId) && Number.isFinite(item.weightKg))
    : [];
  const gear = { ...defaultGear() };
  for (const key of GEAR_KEYS) {
    const level = Number(saved?.gear?.[key]);
    if (Number.isFinite(level)) gear[key] = Math.max(0, Math.min(GEAR_MAX_LEVEL, Math.round(level)));
  }
  const setBonuses = { ...defaultSetBonuses() };
  for (const set of SETS) setBonuses[set.id] = Boolean(saved?.setBonuses?.[set.id]);
  return {
    cash: Math.max(0, Number(saved?.cash) || 0),
    discovered,
    inventory,
    gear,
    setBonuses,
    heaviestKg: Math.max(0, Number(saved?.heaviestKg) || 0)
  };
}

function weightedFish(list, player) {
  const raretyMultiplier = BAIT_RARE_MULTIPLIER ** (player?.gear?.bait || 0);
  const weightFor = (fish) => {
    const base = RARITY_WEIGHT[fish.rarity] || 1;
    return fish.rarity === 'rare' || fish.rarity === 'epic' ? base * raretyMultiplier : base;
  };
  const total = list.reduce((sum, fish) => sum + weightFor(fish), 0);
  let roll = Math.random() * total;
  for (const fish of list) {
    roll -= weightFor(fish);
    if (roll <= 0) return fish;
  }
  return list[list.length - 1];
}

function rollWeight(fish) {
  const t = Math.pow(Math.random(), 1.8);
  return Math.round((fish.minKg + (fish.maxKg - fish.minKg) * t) * 100) / 100;
}

function preparePlayers(players, { db }) {
  return players.map((player) => ({ ...player, dbcState: player.userId ? db.getDeepBleuCPlayer(player.userId) : null }));
}

function createGame(roomPlayers) {
  const world = getWorld();
  const players = roomPlayers.map((roomPlayer) => {
    const saved = roomPlayer.dbcState ? sanitizeSaved(roomPlayer.dbcState) : null;
    return {
      id: roomPlayer.id,
      name: roomPlayer.name,
      isNpc: false,
      x: world.spawn.x,
      y: world.spawn.y,
      path: [],
      nextStepAt: 0,
      cash: saved ? saved.cash : STARTING_CASH,
      inventory: saved ? saved.inventory : [],
      discovered: saved ? saved.discovered : [],
      gear: saved ? saved.gear : defaultGear(),
      setBonuses: saved ? saved.setBonuses : defaultSetBonuses(),
      heaviestKg: saved ? saved.heaviestKg : 0,
      fishing: null,
      nextUid: 1
    };
  });
  return {
    gameOver: false,
    resultText: '',
    log: ['Je staat bij De Vishandel, klaar om uit te varen.'],
    players,
    trades: []
  };
}

function afterStateChange(room, { db }) {
  const game = room.gameState;
  if (!game) return;
  for (const player of game.players) {
    const roomPlayer = room.players.find((candidate) => candidate.id === player.id);
    if (!roomPlayer?.userId) continue;
    db.saveDeepBleuCPlayer(roomPlayer.userId, {
      cash: player.cash,
      discovered: player.discovered,
      inventory: player.inventory,
      gear: player.gear,
      setBonuses: player.setBonuses,
      heaviestKg: player.heaviestKg
    });
  }
}

function doMove(game, player, payload) {
  const world = getWorld();
  const tx = Math.round(Number(payload.x));
  const ty = Math.round(Number(payload.y));
  if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 0 || tx >= world.width || ty < 0 || ty >= world.height) {
    throw new Error('Ongeldige bestemming.');
  }
  if (player.fishing) player.fishing = null;
  const extra = boatWaterSet(player);
  const target = isWalkable(world, tx, ty, extra) ? { x: tx, y: ty } : nearestWalkable(world, tx, ty, extra);
  if (!target) throw new Error('Daar kun je niet naartoe lopen.');
  if (target.x === player.x && target.y === player.y) { player.path = []; return; }
  const path = findPath(world, player.x, player.y, target.x, target.y, extra);
  if (!path || !path.length) throw new Error('Geen pad gevonden naar die plek.');
  player.path = path;
  player.nextStepAt = Date.now();
}

function doCast(game, player, payload) {
  const world = getWorld();
  if (player.path.length) throw new Error('Blijf even stilstaan om te vissen.');
  if (player.fishing && player.fishing.phase !== 'result') throw new Error('Je hengel ligt al uit.');
  const tx = Math.round(Number(payload.x));
  const ty = Math.round(Number(payload.y));
  if (hexDistance(player.x, player.y, tx, ty) > 1) throw new Error('Dat water is te ver weg.');
  const biome = biomeAt(world, tx, ty);
  if (!isWater(world, tx, ty) || !biome) throw new Error('Daar kun je niet vissen.');
  const now = Date.now();
  player.fishing = { phase: 'cast', biome, bitesAt: now + BITE_MIN_MS + Math.random() * (BITE_MAX_MS - BITE_MIN_MS) };
  game.log.unshift('Je werpt je lijn uit...');
}

function doHook(game, player) {
  const fishing = player.fishing;
  const now = Date.now();
  if (!fishing || fishing.phase !== 'bite' || now > fishing.hookDeadline) {
    player.fishing = null;
    throw new Error(fishing?.phase === 'cast' ? 'Nog geen beet, wacht even.' : 'Te laat! De vis is ontsnapt.');
  }
  const species = fishForBiome(fishing.biome);
  const fish = weightedFish(species, player);
  const weightKg = rollWeight(fish);
  player.fishing = {
    phase: 'reel',
    biome: fishing.biome,
    speciesId: fish.id,
    weightKg,
    reelDeadline: now + REEL_WINDOW_MIN_MS + Math.random() * (REEL_WINDOW_MAX_MS - REEL_WINDOW_MIN_MS)
  };
}

function doReel(game, player) {
  const fishing = player.fishing;
  const now = Date.now();
  if (!fishing || fishing.phase !== 'reel' || now > fishing.reelDeadline) {
    player.fishing = null;
    throw new Error('De lijn brak, de vis ontsnapte.');
  }
  const fish = getFish(fishing.speciesId);
  const isNew = !player.discovered.includes(fishing.speciesId);
  if (isNew) player.discovered.push(fishing.speciesId);
  if (fishing.weightKg > player.heaviestKg) player.heaviestKg = fishing.weightKg;
  player.inventory.push({
    uid: `${player.id}-${player.nextUid++}`,
    speciesId: fishing.speciesId,
    weightKg: fishing.weightKg,
    caughtAt: now
  });
  player.fishing = {
    phase: 'result',
    speciesId: fishing.speciesId,
    weightKg: fishing.weightKg,
    isNew,
    resultUntil: now + RESULT_DISPLAY_MS
  };
  game.log.unshift(`Gevangen: ${fish.name} (${fishing.weightKg.toFixed(1)} kg)${isNew ? ' — nieuwe soort!' : ''}`);

  if (isNew) {
    for (const set of SETS) {
      if (player.setBonuses[set.id]) continue;
      if (set.fish.every((setFish) => player.discovered.includes(setFish.id))) {
        player.setBonuses[set.id] = true;
        player.cash += SET_COMPLETE_BONUS;
        let gearMsg = '';
        const gearKey = set.rewardGear;
        if (gearKey && player.gear[gearKey] < GEAR_MAX_LEVEL) {
          player.gear[gearKey] += 1;
          gearMsg = ` + gratis ${GEAR_LABEL[gearKey]}-upgrade (niveau ${player.gear[gearKey]})`;
        }
        game.log.unshift(`Set voltooid: ${set.name}! Bonus €${SET_COMPLETE_BONUS}${gearMsg} + permanent 15% hogere verkoopprijs voor deze set.`);
      }
    }
  }
}

function bonusFor(player, item) {
  const fish = getFish(item.speciesId);
  return player.setBonuses[fish.setId] ? SET_BONUS_MULTIPLIER : 1;
}

function doSell(game, player, payload) {
  if (!player.inventory.length) throw new Error('Je inventaris is leeg.');
  const uid = String(payload.uid || '');
  const uids = Array.isArray(payload.uids) ? payload.uids.map(String) : null;

  if (uid === 'all') {
    const total = player.inventory.reduce((sum, item) => sum + priceFor(item.speciesId, item.weightKg, bonusFor(player, item)), 0);
    player.cash += total;
    player.inventory = [];
    game.log.unshift(`Je verkoopt je hele vangst voor €${total}.`);
    return;
  }

  if (uids) {
    const wanted = new Set(uids);
    if (!wanted.size) throw new Error('Selecteer minstens één vis om te verkopen.');
    const toSell = player.inventory.filter((item) => wanted.has(item.uid));
    if (!toSell.length) throw new Error('Die vissen heb je niet (meer).');
    const total = toSell.reduce((sum, item) => sum + priceFor(item.speciesId, item.weightKg, bonusFor(player, item)), 0);
    player.cash += total;
    player.inventory = player.inventory.filter((item) => !wanted.has(item.uid));
    game.log.unshift(`Verkocht: ${toSell.length} vis${toSell.length === 1 ? '' : 'sen'} voor €${total}.`);
    return;
  }

  const index = player.inventory.findIndex((item) => item.uid === uid);
  if (index === -1) throw new Error('Die vis heb je niet.');
  const [item] = player.inventory.splice(index, 1);
  const price = priceFor(item.speciesId, item.weightKg, bonusFor(player, item));
  player.cash += price;
  game.log.unshift(`Verkocht: ${getFish(item.speciesId).name} voor €${price}.`);
}

function doBuyUpgrade(game, player, payload) {
  const category = String(payload.category || '');
  if (!GEAR_KEYS.includes(category)) throw new Error('Onbekende upgrade.');
  const level = player.gear[category];
  if (level >= GEAR_MAX_LEVEL) throw new Error('Deze upgrade zit al op het maximum.');
  const cost = GEAR_COSTS[level];
  if (player.cash < cost) throw new Error('Onvoldoende geld.');
  player.cash -= cost;
  player.gear[category] += 1;
  game.log.unshift(`Upgrade gekocht: ${category} niveau ${player.gear[category]}.`);
}

function doProposeTrade(game, player, payload) {
  const target = game.players.find((candidate) => candidate.id === String(payload.toId || ''));
  if (!target || target.id === player.id) throw new Error('Kies een andere speler om mee te ruilen.');

  const offerUids = Array.isArray(payload.offerUids) ? [...new Set(payload.offerUids.map(String))] : [];
  const requestUids = Array.isArray(payload.requestUids) ? [...new Set(payload.requestUids.map(String))] : [];
  const offerCash = Math.max(0, Math.round(Number(payload.offerCash) || 0));
  const requestCash = Math.max(0, Math.round(Number(payload.requestCash) || 0));
  if (!offerUids.length && !requestUids.length && !offerCash && !requestCash) {
    throw new Error('Kies iets om aan te bieden of te vragen.');
  }
  if (offerCash > player.cash) throw new Error('Je hebt niet genoeg geld om dat te bieden.');

  const offerItems = offerUids.map((uid) => player.inventory.find((item) => item.uid === uid));
  if (offerItems.some((item) => !item)) throw new Error('Je hebt niet (meer) al deze vissen.');
  const requestItems = requestUids.map((uid) => target.inventory.find((item) => item.uid === uid));
  if (requestItems.some((item) => !item)) throw new Error(`${target.name} heeft niet (meer) al deze vissen.`);

  game.trades = game.trades.filter((t) => !(t.fromId === player.id && t.toId === target.id));
  game.trades.push({
    id: `${player.id}-${target.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    fromId: player.id,
    fromName: player.name,
    toId: target.id,
    toName: target.name,
    offerUids,
    offerCash,
    offerSnapshot: offerItems.map((item) => ({ uid: item.uid, speciesId: item.speciesId, weightKg: item.weightKg })),
    requestUids,
    requestCash,
    requestSnapshot: requestItems.map((item) => ({ uid: item.uid, speciesId: item.speciesId, weightKg: item.weightKg })),
    createdAt: Date.now()
  });
  game.log.unshift(`${player.name} stelt een ruil voor aan ${target.name}.`);
}

function doRespondTrade(game, player, payload) {
  const tradeId = String(payload.tradeId || '');
  const index = game.trades.findIndex((t) => t.id === tradeId);
  if (index === -1) throw new Error('Dat ruilvoorstel bestaat niet meer.');
  const trade = game.trades[index];
  if (trade.fromId !== player.id && trade.toId !== player.id) throw new Error('Dit voorstel is niet voor jou.');

  const decision = String(payload.decision || '');
  if (decision === 'decline') {
    game.trades.splice(index, 1);
    game.log.unshift(`Ruilvoorstel tussen ${trade.fromName} en ${trade.toName} afgewezen.`);
    return;
  }
  if (decision !== 'accept') throw new Error('Onbekende actie.');
  if (trade.toId !== player.id) throw new Error('Alleen de ontvanger kan een voorstel accepteren.');

  const from = game.players.find((candidate) => candidate.id === trade.fromId);
  const to = game.players.find((candidate) => candidate.id === trade.toId);
  if (!from || !to) { game.trades.splice(index, 1); throw new Error('De andere speler is niet meer beschikbaar.'); }

  const offerItems = trade.offerUids.map((uid) => from.inventory.find((item) => item.uid === uid));
  const requestItems = trade.requestUids.map((uid) => to.inventory.find((item) => item.uid === uid));
  const valid = from.cash >= trade.offerCash && to.cash >= trade.requestCash &&
    offerItems.every((item) => item) && requestItems.every((item) => item);
  if (!valid) {
    game.trades.splice(index, 1);
    throw new Error('Dit voorstel is niet meer geldig — geld of vis is intussen niet meer beschikbaar.');
  }

  from.cash += trade.requestCash - trade.offerCash;
  to.cash += trade.offerCash - trade.requestCash;
  from.inventory = from.inventory.filter((item) => !trade.offerUids.includes(item.uid));
  to.inventory = to.inventory.filter((item) => !trade.requestUids.includes(item.uid));
  to.inventory.push(...offerItems);
  from.inventory.push(...requestItems);

  game.trades.splice(index, 1);
  game.log.unshift(`${from.name} en ${to.name} hebben geruild.`);
}

function handleAction(game, playerId, action, payload = {}) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error('Onbekende speler.');
  if (action === 'move') return doMove(game, player, payload);
  if (action === 'cast') return doCast(game, player, payload);
  if (action === 'hook') return doHook(game, player);
  if (action === 'reel') return doReel(game, player);
  if (action === 'sell') return doSell(game, player, payload);
  if (action === 'buyUpgrade') return doBuyUpgrade(game, player, payload);
  if (action === 'proposeTrade') return doProposeTrade(game, player, payload);
  if (action === 'respondTrade') return doRespondTrade(game, player, payload);
  throw new Error('Onbekende actie.');
}

function tick(game, now = Date.now()) {
  let changed = false;
  for (const player of game.players) {
    if (player.path.length && now >= player.nextStepAt) {
      const step = player.path.shift();
      player.x = step.x;
      player.y = step.y;
      player.nextStepAt = now + STEP_MS;
      changed = true;
    }
    const fishing = player.fishing;
    if (!fishing) continue;
    if (fishing.phase === 'cast' && now >= fishing.bitesAt) {
      const hookWindow = HOOK_WINDOW_MS + player.gear.rod * ROD_HOOK_BONUS_MS;
      player.fishing = { ...fishing, phase: 'bite', hookDeadline: now + hookWindow };
      game.log.unshift('Beet! Trek nu aan!');
      changed = true;
    } else if (fishing.phase === 'bite' && now > fishing.hookDeadline) {
      player.fishing = null;
      game.log.unshift('De vis is ontsnapt, te laat.');
      changed = true;
    } else if (fishing.phase === 'reel' && now > fishing.reelDeadline) {
      player.fishing = null;
      game.log.unshift('De lijn brak, de vis ontsnapte.');
      changed = true;
    } else if (fishing.phase === 'result' && now >= fishing.resultUntil) {
      player.fishing = null;
      changed = true;
    }
  }
  if (game.log.length > 30) game.log.length = 30;
  return changed;
}

function serializeFishing(fishing, now) {
  if (!fishing) return null;
  if (fishing.phase === 'cast') return { phase: 'cast', msRemaining: Math.max(0, fishing.bitesAt - now) };
  if (fishing.phase === 'bite') return { phase: 'bite', msRemaining: Math.max(0, fishing.hookDeadline - now) };
  if (fishing.phase === 'reel') return { phase: 'reel', msRemaining: Math.max(0, fishing.reelDeadline - now) };
  if (fishing.phase === 'result') {
    return {
      phase: 'result',
      fish: getFish(fishing.speciesId),
      weightKg: fishing.weightKg,
      isNew: fishing.isNew,
      msRemaining: Math.max(0, fishing.resultUntil - now)
    };
  }
  return null;
}

function serialize(game, requesterId) {
  const world = getWorld();
  const player = game.players.find((candidate) => candidate.id === requesterId) || game.players[0];
  const now = Date.now();
  const nearBuilding = world.buildings.find((building) => hexDistance(player.x, player.y, building.x, building.y) <= 1) || null;
  return {
    kind: game.gameKey,
    gameOver: false,
    world: { width: world.width, height: world.height, buildings: world.buildings },
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      path: p.path,
      cash: p.cash,
      discoveredCount: p.discovered.length,
      fishingPhase: p.fishing ? p.fishing.phase : null,
      inventory: p.inventory.map((item) => ({ uid: item.uid, speciesId: item.speciesId, weightKg: item.weightKg, fish: getFish(item.speciesId) }))
    })),
    you: {
      id: player.id,
      x: player.x,
      y: player.y,
      path: player.path,
      cash: player.cash,
      gear: player.gear,
      gearCosts: GEAR_COSTS,
      gearMaxLevel: GEAR_MAX_LEVEL,
      inventory: player.inventory.map((item) => ({
        ...item,
        fish: getFish(item.speciesId),
        price: priceFor(item.speciesId, item.weightKg, bonusFor(player, item))
      })),
      discovered: player.discovered,
      sets: SETS.map((set) => ({
        id: set.id,
        name: set.name,
        icon: set.icon,
        description: set.description,
        total: set.fish.length,
        caught: set.fish.filter((fish) => player.discovered.includes(fish.id)).length,
        bonusActive: Boolean(player.setBonuses[set.id]),
        rewardGear: set.rewardGear,
        rewardGearLabel: GEAR_LABEL[set.rewardGear] || null,
        fish: set.fish.map((fish) => ({ ...fish, discovered: player.discovered.includes(fish.id) }))
      })),
      fishing: serializeFishing(player.fishing, now),
      nearBuilding: nearBuilding
        ? { id: nearBuilding.id, type: nearBuilding.type, name: nearBuilding.name, active: nearBuilding.active }
        : null,
      trades: game.trades
        .filter((t) => t.fromId === requesterId || t.toId === requesterId)
        .map((t) => ({
          id: t.id,
          incoming: t.toId === requesterId,
          fromName: t.fromName,
          toName: t.toName,
          offer: {
            cash: t.offerCash,
            items: t.offerSnapshot.map((item) => ({ ...item, fish: getFish(item.speciesId) }))
          },
          request: {
            cash: t.requestCash,
            items: t.requestSnapshot.map((item) => ({ ...item, fish: getFish(item.speciesId) }))
          }
        }))
    },
    log: game.log.slice(0, 20)
  };
}

function configureHttp({ app }) {
  app.get('/api/deep-bleu-c/world', (_req, res) => {
    const world = getWorld();
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.json({
      ok: true,
      width: world.width,
      height: world.height,
      tiles: world.tileString,
      spawn: world.spawn,
      buildings: world.buildings
    });
  });
}

module.exports = { createGame, handleAction, serialize, tick, configureHttp, preparePlayers, afterStateChange };
