'use strict';

/**
 * The Blue — server-autoritatieve spelregels.
 *
 * Volgt het Pluto plugin-servercontract (zie games/README.md):
 *   createGame(roomPlayers), handleAction(game, playerId, action, payload),
 *   serialize(game, requesterId, connected), tick(game, now), results(game, durationMs).
 *
 * Fase 1-kernloop: één gedeeld eiland per room (1-4 spelers), vrij bewegen,
 * hout/steen/erts verzamelen, vissen, koken tot kookvuur, dobbelgevecht op
 * land, slijtage, een vlot om dieper te komen, en een dag/nachtcyclus.
 * Havens, PvP, weer/seizoenen en de rest van de archipel zijn latere fases.
 */

const {
  TIER_ORDER, TIERS, tierIndex, ITEM_META, FISH, RARITY_WEIGHT, WILDLIFE,
  NODE_TYPES, ROAST_RECIPES, COOK_RECIPES, CRAFT_RECIPES
} = require('./data');
const { WORLD_SIZE, SHALLOW_BAND, DEEP_BAND, generateWorld, classify, isWalkable, clampToWorld, dist } = require('./world');

const PLAYER_SPEED = 7; // eenheden per seconde
const WILDLIFE_SPEED = 1.6;
const INTERACT_RANGE = 3.5;
const CAMP_RANGE = 5;
const MS_PER_GAME_MINUTE = 800;
const GATHER_ENERGY = 4;
const CAST_ENERGY = 3;
const BITE_WINDOW_MS = 1800;
const WILDLIFE_RESPAWN_MS = 180000;
const WANDER_RADIUS = 5;

const COOK_OUTPUT_EFFECTS = {};
Object.values(ROAST_RECIPES).forEach((r) => { COOK_OUTPUT_EFFECTS[r.output] = { energy: r.energy, buff: null }; });
Object.values(COOK_RECIPES).forEach((r) => { COOK_OUTPUT_EFFECTS[r.output] = { energy: r.energy, buff: r.buff }; });

/* ---------------- helpers ---------------- */

let _uidCounter = 0;
function uid(prefix) { return `${prefix}${(_uidCounter += 1)}`; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rollDie(sides) { return 1 + Math.floor(Math.random() * sides); }

function addLog(game, text) {
  game.log.unshift(text);
  if (game.log.length > 30) game.log.length = 30;
}

function isNight(game) {
  const hour = Math.floor(game.clockMin / 60) % 24;
  return hour < 6 || hour >= 20;
}

function addItem(player, itemId, qty) {
  player.inventory[itemId] = (player.inventory[itemId] || 0) + qty;
}

function hasItems(inventory, cost) {
  return Object.entries(cost).every(([key, qty]) => (inventory[key] || 0) >= qty);
}

function removeItems(inventory, cost) {
  Object.entries(cost).forEach(([key, qty]) => {
    inventory[key] -= qty;
    if (inventory[key] <= 0) delete inventory[key];
  });
}

function categoryOf(itemId) {
  if (itemId.startsWith('vis_')) return 'vis';
  if (itemId === 'vlees') return 'vlees';
  return null;
}

function categoryTotal(player, cat) {
  return Object.entries(player.inventory)
    .filter(([key]) => categoryOf(key) === cat)
    .reduce((sum, [, qty]) => sum + qty, 0);
}

function removeCategory(player, cat, qty) {
  let remaining = qty;
  for (const key of Object.keys(player.inventory)) {
    if (categoryOf(key) !== cat) continue;
    const take = Math.min(remaining, player.inventory[key]);
    player.inventory[key] -= take;
    if (player.inventory[key] <= 0) delete player.inventory[key];
    remaining -= take;
    if (remaining <= 0) break;
  }
  if (remaining > 0) throw new Error(`Niet genoeg ${cat === 'vis' ? 'vis' : 'vlees'}.`);
}

function foodEffect(itemId) {
  if (categoryOf(itemId) === 'vis' || itemId === 'vlees') return { energy: 5, raw: true, buff: null };
  return COOK_OUTPUT_EFFECTS[itemId] ? { ...COOK_OUTPUT_EFFECTS[itemId], raw: false } : null;
}

function addBuff(game, player, buff) {
  player.buffs = player.buffs.filter((b) => b.stat !== buff.stat);
  player.buffs.push({ stat: buff.stat, value: buff.value, label: buff.label, expiresAt: game.elapsedMin + buff.minutes });
}

function activeBuffValue(game, player, stat) {
  const buff = player.buffs.find((b) => b.stat === stat && b.expiresAt > game.elapsedMin);
  return buff ? buff.value : 0;
}

function applyFood(game, player, itemId) {
  if (!(player.inventory[itemId] > 0)) throw new Error('Dat heb je niet.');
  const effect = foodEffect(itemId);
  if (!effect) throw new Error('Dat kun je niet eten.');
  player.inventory[itemId] -= 1;
  if (player.inventory[itemId] <= 0) delete player.inventory[itemId];
  player.energy = clamp(player.energy + effect.energy, 0, player.maxEnergy);
  if (effect.raw && Math.random() < 0.15) player.hp = clamp(player.hp - 5, 0, player.maxHp);
  if (effect.buff) addBuff(game, player, effect.buff);
}

function findPlayer(game, playerId) {
  const player = game.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Onbekende speler.');
  return player;
}

function weightedPickFish(zone, night, rarityMultiplier) {
  const timeLabel = night ? 'night' : 'day';
  const pool = FISH.filter((f) => f.zones.includes(zone) && (f.time === 'any' || f.time === timeLabel));
  const weights = pool.map((f) => {
    const base = RARITY_WEIGHT[f.rarity];
    return (f.rarity === 'rare' || f.rarity === 'legendary') ? base * rarityMultiplier : base;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i += 1) {
    if (r < weights[i]) return pool[i];
    r -= weights[i];
  }
  return pool[pool.length - 1];
}

function newTool(tier) {
  const info = TIERS[tier];
  return { tier, durability: info.maxDurability, maxDurability: info.maxDurability };
}

function findCraftRecipe(slot, tier) {
  return Object.values(CRAFT_RECIPES).find((r) => r.kind === 'tool' && r.slot === slot && r.tier === tier);
}

/* ---------------- lifecycle ---------------- */

function createGame(roomPlayers) {
  const hostId = roomPlayers.find((p) => !p.isNpc)?.id || roomPlayers[0]?.id;
  const world = generateWorld((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);

  const wildlife = world.wildlifeAnchors.map((anchor) => {
    const info = WILDLIFE.zwijn;
    return {
      id: uid('e'), anchorId: anchor.id,
      species: info.id, name: info.name,
      x: anchor.x, y: anchor.y,
      hp: info.hp, maxHp: info.hp, die: info.die, bonus: info.bonus, armor: info.armor, speed: info.speed, loot: info.loot,
      alive: true, engagedBy: null, respawnAt: 0,
      wanderTarget: null, nextWanderAt: 0
    };
  });

  const players = roomPlayers.map((rp) => ({
    id: rp.id, name: rp.name, isNpc: Boolean(rp.isNpc),
    pos: { x: world.camp.x, y: world.camp.y }, target: null,
    hp: 100, maxHp: 100, energy: 100, maxEnergy: 100,
    tools: {
      axe: newTool('hout'), pickaxe: newTool('hout'), rod: newTool('hout'),
      weapon: newTool('bare'), armor: newTool('bare')
    },
    hasRaft: false, inventory: {}, codex: {}, buffs: [],
    combat: null, fishing: null, cook: null
  }));

  return {
    gameKey: 'the-blue', hostId, gameOver: false, resultText: '',
    world, wildlife, camp: { hasKookvuur: false, hasSmidse: false },
    clockMin: 8 * 60, elapsedMin: 0, minuteAccumMs: 0, lastTickAt: Date.now(), nextWanderBroadcastAt: 0,
    players, log: ['De expeditie begint. Het kamp staat, de zee wacht.']
  };
}

/* ---------------- acties ---------------- */

function doMove(game, player, payload) {
  if (player.combat) throw new Error('Je zit midden in een gevecht.');
  const target = clampToWorld(Number(payload.x), Number(payload.y));
  if (Number.isNaN(target.x) || Number.isNaN(target.y)) throw new Error('Ongeldige bestemming.');
  if (!isWalkable(game.world.shape, target.x, target.y, player.hasRaft)) {
    throw new Error(classify(game.world.shape, target.x, target.y) === 'deep'
      ? 'Daar is het water te diep zonder vlot.'
      : 'Daar kun je niet komen. Dat is de rand van de wereld.');
  }
  player.target = target;
  player.fishing = null;
}

function doGather(game, player, payload) {
  if (player.combat) throw new Error('Je zit midden in een gevecht.');
  const node = game.world.nodes.find((n) => n.id === payload.nodeId);
  if (!node) throw new Error('Onbekend knooppunt.');
  if (node.usesLeft === 0) throw new Error('Dit is uitgeput. Geef het tijd om aan te groeien.');
  if (dist(player.pos, node) > INTERACT_RANGE) throw new Error('Te ver weg.');

  const def = NODE_TYPES[node.type];
  const toolTier = def.tool ? player.tools[def.tool].tier : 'bare';
  if (def.tool && tierIndex(toolTier) < tierIndex(def.minTier)) {
    throw new Error(`Je hebt minstens gereedschap van ${TIERS[def.minTier].label} nodig.`);
  }
  if (player.energy < GATHER_ENERGY) throw new Error('Te moe om nog iets te doen. Eet iets.');

  if (node.usesLeft === null) node.usesLeft = def.uses;
  const bonus = tierIndex(toolTier) >= 2 ? 1 : 0;
  const qty = 1 + bonus;
  const item = node.type === 'erts' ? (Math.random() < 0.5 ? 'koper' : 'tin') : def.yieldItem;
  addItem(player, item, qty);

  node.usesLeft -= 1;
  if (node.usesLeft <= 0) node.respawnAt = Date.now() + def.respawnMs;

  if (def.tool && toolTier !== 'bare') {
    const tool = player.tools[def.tool];
    tool.durability -= 1;
    if (tool.durability <= 0) {
      player.tools[def.tool] = newTool('bare');
      addLog(game, `${player.name}s ${def.tool === 'axe' ? 'bijl' : 'houweel'} breekt.`);
    }
  }
  player.energy -= GATHER_ENERGY;
}

function doCastLine(game, player, payload) {
  if (player.combat) throw new Error('Je zit midden in een gevecht.');
  if (player.fishing) throw new Error('Je hebt al een lijn uit.');
  const spot = game.world.fishSpots.find((s) => s.id === payload.spotId);
  if (!spot) throw new Error('Onbekende visstek.');
  if (spot.zone === 2 && !player.hasRaft) throw new Error('Je hebt een vlot nodig voor dieper water.');
  if (dist(player.pos, spot) > INTERACT_RANGE) throw new Error('Te ver van het water.');
  if (player.energy < CAST_ENERGY) throw new Error('Te moe om te vissen.');

  player.energy -= CAST_ENERGY;
  player.fishing = { spotId: spot.id, zone: spot.zone, state: 'waiting', biteAt: Date.now() + 2000 + Math.random() * 6000, expiresAt: null };
}

function doReel(game, player) {
  if (!player.fishing) throw new Error('Je hebt geen lijn uit.');
  if (player.fishing.state === 'waiting') {
    player.fishing = null;
    addLog(game, `${player.name}: lijn gebroken. De vis is niet onder de indruk.`);
    return;
  }
  const rarityMultiplier = clamp(1 + Object.keys(player.codex).length * 0.03 + activeBuffValue(game, player, 'fishBonus'), 1, 2.5);
  const fish = weightedPickFish(player.fishing.zone, isNight(game), rarityMultiplier);
  addItem(player, `vis_${fish.id}`, 1);
  const isNew = !player.codex[fish.id];
  if (isNew) {
    player.codex[fish.id] = true;
    addLog(game, `${player.name} ontdekt een nieuwe soort: ${fish.name}.`);
  }
  player.fishing = null;
}

function findWildlife(game, enemyId) {
  const enemy = game.wildlife.find((w) => w.id === enemyId);
  if (!enemy || !enemy.alive) throw new Error('Dat dier is er niet meer.');
  return enemy;
}

function resolveCombatRound(game, player, enemy, move, itemId) {
  const log = [];
  const weaponTier = TIERS[player.tools.weapon.tier];
  const armorTier = TIERS[player.tools.armor.tier];
  const combatBonus = activeBuffValue(game, player, 'combatBonus');
  let defending = false;
  let fled = false;
  let failedFlee = false;

  if (move === 'attack') {
    const roll = rollDie(weaponTier.die) + weaponTier.bonus + combatBonus;
    let dmg = Math.max(1, roll - enemy.armor);
    const crit = roll >= weaponTier.die + weaponTier.bonus + combatBonus;
    if (crit) dmg *= 2;
    enemy.hp = clamp(enemy.hp - dmg, 0, enemy.maxHp);
    log.push(`Je raakt de ${enemy.name} voor ${dmg}${crit ? ' — kritiek!' : '.'}`);
  } else if (move === 'defend') {
    const roll = rollDie(armorTier.die) + armorTier.bonus;
    defending = true;
    player.energy = clamp(player.energy + 3, 0, player.maxEnergy);
    log.push(`Je zet je schrap (${roll}).`);
  } else if (move === 'drink') {
    if (!itemId) throw new Error('Kies wat je wilt consumeren.');
    applyFood(game, player, itemId);
    log.push(`Je neemt ${ITEM_META[itemId]?.label || itemId} tot je.`);
  } else if (move === 'flee') {
    const chance = clamp(0.75 - enemy.speed * 0.15, 0.2, 0.9);
    fled = Math.random() < chance;
    failedFlee = !fled;
    log.push(fled ? 'Je ontsnapt.' : 'Ontsnappen mislukt!');
  } else {
    throw new Error('Onbekende gevechtsactie.');
  }

  if (fled) {
    enemy.engagedBy = null;
    player.combat = null;
    addLog(game, `${player.name} vlucht van een ${enemy.name}.`);
    return { log, fled: true };
  }

  if (enemy.hp > 0) {
    let enemyRoll = rollDie(enemy.die) + (enemy.bonus || 0);
    if (failedFlee) enemyRoll = Math.ceil(enemyRoll * 1.5);
    let dmg = Math.max(0, enemyRoll - armorTier.bonus);
    if (defending) dmg = Math.ceil(dmg * 0.5);
    player.hp = clamp(player.hp - dmg, 0, player.maxHp);
    log.push(`De ${enemy.name} raakt terug voor ${dmg}.`);
  }

  if (enemy.hp <= 0) {
    const [minQty, maxQty] = [0, 0];
    Object.entries(enemy.loot).forEach(([item, range]) => {
      const qty = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
      addItem(player, item, qty);
    });
    const isNew = !player.codex[enemy.species];
    if (isNew) player.codex[enemy.species] = true;
    enemy.alive = false;
    enemy.hp = 0;
    enemy.engagedBy = null;
    enemy.respawnAt = Date.now() + WILDLIFE_RESPAWN_MS;
    player.combat = null;
    addLog(game, `${player.name} verslaat een ${enemy.name}.${isNew ? ' Nieuwe soort in de codex!' : ''}`);
  } else if (player.hp <= 0) {
    handleDefeat(game, player);
    enemy.hp = enemy.maxHp;
    enemy.engagedBy = null;
    player.combat = null;
    addLog(game, `${player.name} wordt geveld door een ${enemy.name} en strompelt terug naar het kamp.`);
  } else {
    player.combat.log = [...log, ...player.combat.log].slice(0, 6);
  }

  return { log, fled: false };
}

function handleDefeat(game, player) {
  player.pos = { x: game.world.camp.x, y: game.world.camp.y };
  player.target = null;
  player.hp = Math.round(player.maxHp * 0.5);
  ['hout', 'steen', 'koper', 'tin', 'vezel', 'bosbes'].forEach((key) => {
    if (player.inventory[key]) {
      player.inventory[key] = Math.floor(player.inventory[key] / 2);
      if (!player.inventory[key]) delete player.inventory[key];
    }
  });
}

function doAttack(game, player, payload) {
  if (player.combat) throw new Error('Je vecht al.');
  const enemy = findWildlife(game, payload.enemyId);
  if (enemy.engagedBy && enemy.engagedBy !== player.id) throw new Error('Iemand anders vecht al met dit dier.');
  if (dist(player.pos, enemy) > INTERACT_RANGE) throw new Error('Te ver weg.');
  enemy.engagedBy = player.id;
  player.combat = { enemyId: enemy.id, log: [] };
  resolveCombatRound(game, player, enemy, 'attack', null);
}

function doCombatAct(game, player, payload) {
  if (!player.combat) throw new Error('Je bent niet in een gevecht.');
  const enemy = game.wildlife.find((w) => w.id === player.combat.enemyId);
  if (!enemy) { player.combat = null; throw new Error('Dat gevecht bestaat niet meer.'); }
  resolveCombatRound(game, player, enemy, payload.move, payload.itemId);
}

function doEat(game, player, payload) {
  if (player.combat) throw new Error('Gebruik de gevechtsactie “drinken” tijdens een gevecht.');
  applyFood(game, player, payload.itemId);
}

function doCook(game, player, payload) {
  if (dist(player.pos, game.world.camp) > CAMP_RANGE) throw new Error('Je moet bij het kamp zijn.');
  if (player.cook) throw new Error('Er staat al iets te bereiden.');

  if (payload.station === 'kampvuur') {
    const recipe = ROAST_RECIPES[payload.recipeKey];
    if (!recipe) throw new Error('Onbekend recept.');
    if (categoryTotal(player, recipe.input) < 1) throw new Error(`Je hebt geen ${recipe.input === 'vis' ? 'rauwe vis' : 'rauw vlees'}.`);
    removeCategory(player, recipe.input, 1);
    player.cook = { station: 'kampvuur', recipeKey: payload.recipeKey, output: recipe.output, doneAt: Date.now() + recipe.cookMs };
    return;
  }
  if (payload.station === 'kookvuur') {
    if (!game.camp.hasKookvuur) throw new Error('Er is nog geen kookvuur.');
    const recipe = COOK_RECIPES[payload.recipeKey];
    if (!recipe) throw new Error('Onbekend recept.');
    Object.entries(recipe.inputs).forEach(([cat, qty]) => {
      if (categoryTotal(player, cat) < qty) throw new Error(`Niet genoeg ${cat === 'vis' ? 'vis' : 'vlees'}.`);
    });
    Object.entries(recipe.inputs).forEach(([cat, qty]) => removeCategory(player, cat, qty));
    player.cook = { station: 'kookvuur', recipeKey: payload.recipeKey, output: recipe.output, doneAt: Date.now() + recipe.cookMs };
    return;
  }
  throw new Error('Onbekend station.');
}

function doCraft(game, player, payload) {
  const recipe = CRAFT_RECIPES[payload.recipeKey];
  if (!recipe) throw new Error('Onbekend recept.');
  if (dist(player.pos, game.world.camp) > CAMP_RANGE) throw new Error('Je moet bij het kamp zijn.');
  if (recipe.station === 'smidse' && !game.camp.hasSmidse) throw new Error('Er is nog geen smidse.');
  if (!hasItems(player.inventory, recipe.cost)) throw new Error('Niet genoeg materiaal.');
  removeItems(player.inventory, recipe.cost);

  if (recipe.kind === 'tool') player.tools[recipe.slot] = newTool(recipe.tier);
  else if (recipe.kind === 'camp') game.camp[recipe.flag] = true;
  else if (recipe.kind === 'raft') player.hasRaft = true;
  addLog(game, `${player.name} maakt: ${recipe.label}.`);
}

function doRepair(game, player, payload) {
  const tool = player.tools[payload.slot];
  if (!tool || tool.tier === 'bare') throw new Error('Niets te repareren.');
  if (tool.durability >= tool.maxDurability) throw new Error('Dit is al heel.');
  const recipe = findCraftRecipe(payload.slot, tool.tier);
  if (!recipe) throw new Error('Onbekend gereedschap.');
  const floor = Math.round(TIERS[tool.tier].maxDurability * 0.4);
  if (tool.maxDurability <= floor) throw new Error('Te vaak gerepareerd. Maak een nieuwe.');
  const cost = {};
  Object.entries(recipe.cost).forEach(([key, qty]) => { cost[key] = Math.max(1, Math.ceil(qty * 0.3)); });
  if (!hasItems(player.inventory, cost)) throw new Error('Niet genoeg materiaal om te repareren.');
  removeItems(player.inventory, cost);
  tool.maxDurability = Math.max(floor, Math.round(tool.maxDurability * 0.9));
  tool.durability = tool.maxDurability;
}

function doEndExpedition(game, player) {
  if (player.id !== game.hostId) throw new Error('Alleen de host kan de expeditie beëindigen.');
  game.gameOver = true;
  const best = [...game.players].sort((a, b) => Object.keys(b.codex).length - Object.keys(a.codex).length)[0];
  game.resultText = `De expeditie eindigt. ${best.name} bracht de rijkste codex mee (${Object.keys(best.codex).length} soorten).`;
}

function handleAction(game, playerId, action, payload = {}) {
  if (game.gameOver) throw new Error('De expeditie is afgelopen.');
  const player = findPlayer(game, playerId);

  if (action === 'move') doMove(game, player, payload);
  else if (action === 'gather') doGather(game, player, payload);
  else if (action === 'castLine') doCastLine(game, player, payload);
  else if (action === 'reel') doReel(game, player);
  else if (action === 'attack') doAttack(game, player, payload);
  else if (action === 'combatAct') doCombatAct(game, player, payload);
  else if (action === 'eat') doEat(game, player, payload);
  else if (action === 'cook') doCook(game, player, payload);
  else if (action === 'craft') doCraft(game, player, payload);
  else if (action === 'repair') doRepair(game, player, payload);
  else if (action === 'endExpedition') doEndExpedition(game, player);
  else throw new Error('Onbekende actie.');
}

/* ---------------- tick ---------------- */

function stepMovement(player, elapsedMs) {
  if (!player.target) return false;
  const dx = player.target.x - player.pos.x;
  const dy = player.target.y - player.pos.y;
  const distance = Math.hypot(dx, dy);
  const step = (PLAYER_SPEED * elapsedMs) / 1000;
  if (distance <= step || distance < 0.05) {
    player.pos = { ...player.target };
    player.target = null;
  } else {
    player.pos = { x: player.pos.x + (dx / distance) * step, y: player.pos.y + (dy / distance) * step };
  }
  return true;
}

function stepWildlife(game, enemy, now, elapsedMs) {
  if (!enemy.alive || enemy.engagedBy) return false;
  if (!enemy.wanderTarget || now >= enemy.nextWanderAt) {
    const anchor = game.world.wildlifeAnchors.find((a) => a.id === enemy.anchorId) || enemy;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * WANDER_RADIUS;
    const candidate = { x: anchor.x + Math.cos(angle) * r, y: anchor.y + Math.sin(angle) * r };
    enemy.wanderTarget = classify(game.world.shape, candidate.x, candidate.y) === 'land' ? candidate : { x: anchor.x, y: anchor.y };
    enemy.nextWanderAt = now + 4000 + Math.random() * 4000;
  }
  const dx = enemy.wanderTarget.x - enemy.x;
  const dy = enemy.wanderTarget.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.1) return false;
  const step = Math.min(distance, (WILDLIFE_SPEED * elapsedMs) / 1000);
  enemy.x += (dx / distance) * step;
  enemy.y += (dy / distance) * step;
  return true;
}

function tick(game, now = Date.now()) {
  if (game.gameOver) return false;
  const elapsedMs = clamp(now - (game.lastTickAt || now), 0, 4000);
  game.lastTickAt = now;
  let changed = false;

  game.players.forEach((player) => {
    if (stepMovement(player, elapsedMs)) changed = true;
    if (player.fishing) {
      if (player.fishing.state === 'waiting' && now >= player.fishing.biteAt) {
        player.fishing.state = 'biting';
        player.fishing.expiresAt = now + BITE_WINDOW_MS;
        changed = true;
      } else if (player.fishing.state === 'biting' && now >= player.fishing.expiresAt) {
        player.fishing = null;
        addLog(game, `${player.name}: de vis verliest zijn interesse.`);
        changed = true;
      }
    }
    if (player.cook && now >= player.cook.doneAt) {
      addItem(player, player.cook.output, 1);
      player.cook = null;
      changed = true;
    }
  });

  let wildlifeMoved = false;
  game.wildlife.forEach((enemy) => {
    if (!enemy.alive && enemy.respawnAt && now >= enemy.respawnAt) {
      const species = isNight(game) && Math.random() < 0.6 ? 'wolf' : 'zwijn';
      const info = WILDLIFE[species];
      Object.assign(enemy, {
        alive: true, species, name: info.name, hp: info.hp, maxHp: info.hp,
        die: info.die, bonus: info.bonus, armor: info.armor, speed: info.speed, loot: info.loot, respawnAt: 0
      });
      changed = true;
    }
    if (stepWildlife(game, enemy, now, elapsedMs)) wildlifeMoved = true;
  });
  // Ambient wandering updates positions every tick for accurate range-checks,
  // but is throttled as a broadcast reason so idle wildlife doesn't keep the
  // whole room re-rendering every 120ms forever.
  if (wildlifeMoved && now >= (game.nextWanderBroadcastAt || 0)) {
    changed = true;
    game.nextWanderBroadcastAt = now + 600;
  }

  game.minuteAccumMs = (game.minuteAccumMs || 0) + elapsedMs;
  let guard = 0;
  while (game.minuteAccumMs >= MS_PER_GAME_MINUTE && guard < 500) {
    game.minuteAccumMs -= MS_PER_GAME_MINUTE;
    game.clockMin = (game.clockMin + 1) % 1440;
    game.elapsedMin += 1;
    guard += 1;
    changed = true;
    game.players.forEach((player) => {
      player.energy = clamp(player.energy + 2, 0, player.maxEnergy);
      if (player.energy >= 50 && game.elapsedMin % 2 === 0) player.hp = clamp(player.hp + 2, 0, player.maxHp);
      player.buffs = player.buffs.filter((b) => b.expiresAt > game.elapsedMin);
    });
  }

  game.world.nodes.forEach((node) => {
    if (node.usesLeft === 0 && node.respawnAt && now >= node.respawnAt) {
      node.usesLeft = null;
      node.respawnAt = 0;
      changed = true;
    }
  });

  return changed;
}

/* ---------------- serialisatie ---------------- */

function equipmentDie(tier) { return { die: TIERS[tier].die, bonus: TIERS[tier].bonus, label: TIERS[tier].label }; }

function speciesInfo(codex) {
  const info = {};
  FISH.forEach((f) => {
    info[f.id] = codex[f.id]
      ? { discovered: true, name: f.name, flavor: f.flavor, rarity: f.rarity, kind: 'fish' }
      : { discovered: false };
  });
  Object.values(WILDLIFE).forEach((w) => {
    info[w.id] = codex[w.id]
      ? { discovered: true, name: w.name, flavor: w.flavor, rarity: 'wildlife', kind: 'wildlife' }
      : { discovered: false };
  });
  return info;
}

function serialize(game, requesterId, connected) {
  const codexTotal = FISH.length + Object.keys(WILDLIFE).length;
  return {
    kind: 'the-blue', gameOver: game.gameOver, resultText: game.resultText, hostId: game.hostId,
    world: {
      size: WORLD_SIZE, shape: game.world.shape, camp: game.world.camp,
      shallowBand: SHALLOW_BAND, deepBand: DEEP_BAND
    },
    nodes: game.world.nodes.map((n) => ({ id: n.id, type: n.type, x: n.x, y: n.y, available: n.usesLeft !== 0 })),
    fishSpots: game.world.fishSpots,
    wildlife: game.wildlife.map((w) => ({ id: w.id, species: w.species, name: w.name, x: w.x, y: w.y, hp: w.hp, maxHp: w.maxHp, alive: w.alive, engagedBy: w.engagedBy })),
    camp: game.camp,
    clockMin: game.clockMin, isNight: isNight(game), codexTotal,
    log: game.log.slice(0, 20),
    itemMeta: ITEM_META, tiers: TIERS, recipes: { roast: ROAST_RECIPES, cook: COOK_RECIPES, craft: CRAFT_RECIPES },
    players: game.players.map((p) => {
      const base = {
        id: p.id, name: p.name, x: p.pos.x, y: p.pos.y, hp: p.hp, maxHp: p.maxHp,
        connected: p.isNpc || Boolean(connected && connected.get(p.id))
      };
      if (p.id !== requesterId) return base;
      return {
        ...base, energy: p.energy, maxEnergy: p.maxEnergy, tools: p.tools,
        equipment: { axe: equipmentDie(p.tools.axe.tier), pickaxe: equipmentDie(p.tools.pickaxe.tier), weapon: equipmentDie(p.tools.weapon.tier), armor: equipmentDie(p.tools.armor.tier), rod: equipmentDie(p.tools.rod.tier) },
        hasRaft: p.hasRaft, inventory: p.inventory, codex: p.codex, codexInfo: speciesInfo(p.codex),
        buffs: p.buffs, combat: p.combat, fishing: p.fishing, cook: p.cook, isHost: p.id === game.hostId
      };
    })
  };
}

/* ---------------- eindresultaat ---------------- */

const FISH_VALUE = { common: 2, uncommon: 4, rare: 8, legendary: 20 };
const FISH_BY_ID = Object.fromEntries(FISH.map((f) => [f.id, f]));

function inventoryValue(inventory) {
  return Object.entries(inventory).reduce((sum, [item, qty]) => {
    if (item.startsWith('vis_')) {
      const fish = FISH_BY_ID[item.slice(4)];
      return sum + qty * (fish ? FISH_VALUE[fish.rarity] : 1);
    }
    return sum + qty * (ITEM_META[item]?.value || 1);
  }, 0);
}

function equipmentScore(player) {
  return ['axe', 'pickaxe', 'rod', 'weapon', 'armor'].reduce((sum, slot) => sum + tierIndex(player.tools[slot].tier) * 5, 0);
}

function results(game, durationMs) {
  const scored = game.players.map((p) => ({
    playerId: p.id,
    score: Object.keys(p.codex).length * 10 + inventoryValue(p.inventory) + equipmentScore(p)
  }));
  const high = Math.max(...scored.map((s) => s.score));
  const ranked = [...scored].sort((a, b) => b.score - a.score);
  return scored.map((s) => ({
    playerId: s.playerId,
    placement: ranked.findIndex((r) => r.score === s.score) + 1,
    score: s.score,
    won: s.score === high,
    outcome: s.score === high ? 'Rijkste codex en uitrusting' : 'Expeditie voltooid',
    durationMs
  }));
}

module.exports = {
  createGame, handleAction, serialize, tick, results,
  TIER_ORDER, TIERS, ITEM_META, FISH, WILDLIFE, NODE_TYPES, ROAST_RECIPES, COOK_RECIPES, CRAFT_RECIPES,
  WORLD_SIZE, PLAYER_SPEED, INTERACT_RANGE, CAMP_RANGE
};
