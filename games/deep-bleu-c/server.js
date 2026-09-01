'use strict';

const { getWorld, isWalkable, isWater, biomeAt, nearestWalkable, findPath } = require('./worldgen');
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

function chebyshev(x1, y1, x2, y2) { return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)); }

function weightedFish(list) {
  const total = list.reduce((sum, fish) => sum + (RARITY_WEIGHT[fish.rarity] || 1), 0);
  let roll = Math.random() * total;
  for (const fish of list) {
    roll -= RARITY_WEIGHT[fish.rarity] || 1;
    if (roll <= 0) return fish;
  }
  return list[list.length - 1];
}

function rollWeight(fish) {
  const t = Math.pow(Math.random(), 1.8);
  return Math.round((fish.minKg + (fish.maxKg - fish.minKg) * t) * 100) / 100;
}

function createGame(roomPlayers) {
  const world = getWorld();
  const players = roomPlayers.map((roomPlayer) => ({
    id: roomPlayer.id,
    name: roomPlayer.name,
    isNpc: false,
    x: world.spawn.x,
    y: world.spawn.y,
    path: [],
    nextStepAt: 0,
    cash: STARTING_CASH,
    inventory: [],
    discovered: [],
    fishing: null,
    nextUid: 1
  }));
  return {
    gameOver: false,
    resultText: '',
    log: ['Je staat bij De Vishandel, klaar om uit te varen.'],
    players
  };
}

function doMove(game, player, payload) {
  const world = getWorld();
  const tx = Math.round(Number(payload.x));
  const ty = Math.round(Number(payload.y));
  if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 0 || tx >= world.width || ty < 0 || ty >= world.height) {
    throw new Error('Ongeldige bestemming.');
  }
  if (player.fishing) player.fishing = null;
  const target = isWalkable(world, tx, ty) ? { x: tx, y: ty } : nearestWalkable(world, tx, ty, 6);
  if (!target) throw new Error('Daar kun je niet naartoe lopen.');
  if (target.x === player.x && target.y === player.y) { player.path = []; return; }
  const path = findPath(world, player.x, player.y, target.x, target.y);
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
  if (chebyshev(player.x, player.y, tx, ty) > 1) throw new Error('Dat water is te ver weg.');
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
  const fish = weightedFish(species);
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
}

function doSell(game, player, payload) {
  const world = getWorld();
  const shop = world.buildings.find((building) => building.type === 'vishandel');
  if (chebyshev(player.x, player.y, shop.x, shop.y) > 1) throw new Error('Je moet bij De Vishandel staan.');
  const uid = String(payload.uid || '');
  if (uid === 'all') {
    if (!player.inventory.length) throw new Error('Je inventaris is leeg.');
    const total = player.inventory.reduce((sum, item) => sum + priceFor(item.speciesId, item.weightKg), 0);
    player.cash += total;
    player.inventory = [];
    game.log.unshift(`Je verkoopt je hele vangst voor €${total}.`);
    return;
  }
  const index = player.inventory.findIndex((item) => item.uid === uid);
  if (index === -1) throw new Error('Die vis heb je niet.');
  const [item] = player.inventory.splice(index, 1);
  const price = priceFor(item.speciesId, item.weightKg);
  player.cash += price;
  game.log.unshift(`Verkocht: ${getFish(item.speciesId).name} voor €${price}.`);
}

function handleAction(game, playerId, action, payload = {}) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error('Onbekende speler.');
  if (action === 'move') return doMove(game, player, payload);
  if (action === 'cast') return doCast(game, player, payload);
  if (action === 'hook') return doHook(game, player);
  if (action === 'reel') return doReel(game, player);
  if (action === 'sell') return doSell(game, player, payload);
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
      player.fishing = { ...fishing, phase: 'bite', hookDeadline: now + HOOK_WINDOW_MS };
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
  const nearBuilding = world.buildings.find((building) => chebyshev(player.x, player.y, building.x, building.y) <= 1) || null;
  return {
    kind: game.gameKey,
    gameOver: false,
    world: { width: world.width, height: world.height, buildings: world.buildings },
    you: {
      x: player.x,
      y: player.y,
      path: player.path,
      cash: player.cash,
      inventory: player.inventory.map((item) => ({ ...item, fish: getFish(item.speciesId) })),
      discovered: player.discovered,
      sets: SETS.map((set) => ({
        id: set.id,
        name: set.name,
        icon: set.icon,
        description: set.description,
        total: set.fish.length,
        caught: set.fish.filter((fish) => player.discovered.includes(fish.id)).length,
        fish: set.fish.map((fish) => ({ ...fish, discovered: player.discovered.includes(fish.id) }))
      })),
      fishing: serializeFishing(player.fishing, now),
      nearBuilding: nearBuilding
        ? { id: nearBuilding.id, type: nearBuilding.type, name: nearBuilding.name, active: nearBuilding.active }
        : null
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

module.exports = { createGame, handleAction, serialize, tick, configureHttp };
