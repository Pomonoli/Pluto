'use strict';

const { getWorld, isWalkable, isWater, resourceAt, nearestWalkable, findPath, hexDistance, biomeAt, tileAt } = require('./worldgen');
const { SETS, fishForBiome, getFish, priceFor: fishPriceFor } = require('./fish');
const resources = require('./resources');
const gear = require('./gear');
const recipes = require('./recipes');

const STEP_MS = 170;
const HOOK_WINDOW_MS = 900;
const REEL_WINDOW_MIN_MS = 700;
const REEL_WINDOW_MAX_MS = 1300;
const BITE_MIN_MS = 1200;
const BITE_MAX_MS = 3200;
const RESULT_DISPLAY_MS = 3500;
const STARTING_CASH = 25;
const RARITY_WEIGHT = { common: 60, uncommon: 27, rare: 11, epic: 2 };

const GEAR_KEYS = ['rod', 'bait', 'boat', 'axe', 'pickaxe'];
const GEAR_COSTS = [150, 400, 900, 1800];
const GEAR_MAX_LEVEL = GEAR_COSTS.length;
const ROD_HOOK_BONUS_MS = 150;
const TOOL_STRIKE_BONUS_MS = 150;
const BAIT_RARE_MULTIPLIER = 1.3;
const WATER_TIERS = [[], ['r'], ['r', 'k'], ['r', 'k', 'a', 'm']];
const SET_COMPLETE_BONUS = 600;
const SET_BONUS_MULTIPLIER = 1.15;
const GEAR_LABEL = { rod: 'hengel', bait: 'aas', boat: 'boot', axe: 'bijl', pickaxe: 'houweel' };

// Gezondheid, energie en pantser: pantser komt uitsluitend van uitgeruste
// kleding/schild (geen losse "stat", puur afgeleid), gezondheid daalt alleen
// bij een mislukte jachtpoging, energie daalt bij elke voltooide vangst/kap/
// delving/jacht en herstelt door vlees te eten.
const MAX_HEALTH = 100;
const MAX_ENERGY = 100;
const ENERGY_COST_PER_ACTION = 3;
const FAINT_HEALTH_RESTORE = 0.5;

// Dobbelgevecht bij de jacht: dobbelsteentier 0 = geen wapen/pantser (1d4),
// tier 1-4 komt overeen met de vier winkeltiers in gear.js. Zo communiceert
// de dobbelsteen zelf de kwaliteit van je uitrusting, zonder dat een speler
// getallen hoeft te lezen.
const DICE_BY_TIER = [
  { count: 1, sides: 4 }, { count: 1, sides: 6 }, { count: 1, sides: 8 }, { count: 2, sides: 8 }, { count: 2, sides: 10 }
];
const HUNTING_SKILL_BONUS_STEP = 10;
const FLEE_CHANCE = { common: 0.65, uncommon: 0.55, rare: 0.45, epic: 0.35 };
const HUNT_GEAR_WEAR = 3;
const DRINK_HEAL_PLAIN = 8;
const DRINK_HEAL_DISH = 15;
const HARBOR_COST = 200;

// Slijtage op combat-gear (kleding/wapens/schilden): elk stuk heeft een eigen
// (speler-specifieke) `maxDurability` die bij reparatie een beetje daalt —
// zo hoeft een prijs-/statwijziging in gear.js nooit al opgeslagen spelerdata
// te raken, en blijft "je moet ooit een nieuwe maken" een echt eindpunt.
const REPAIR_COST_PER_POINT = 2;
const REPAIR_MAX_LOSS_FRACTION = 0.1;

// Dag/nacht: een versnelde, sessie-gebonden cyclus (geen wandkloktijd — een
// sessie duurt vaak maar 10-15 minuten) die nachtsoorten ontgrendelt en de
// kaart een andere sfeer geeft.
const DAY_LENGTH_MS = 22 * 60 * 1000;
const NIGHT_FRACTION = 0.32;

// Vaardigheden-skilltree: elke vangst/kap/delving/jacht/nieuwe-soort-ontdekking/
// ruil levert xp op voor de bijhorende vaardigheid, van niveau 1 tot 99 — net
// als het gereedschap is dit puur progressie/statistiek, geen extra bonussen.
const SKILL_KEYS = ['fishing', 'woodcutting', 'mining', 'hunting', 'collecting', 'trading'];
const MAX_SKILL_LEVEL = 99;
const SKILL_LABEL = { fishing: 'Vissen', woodcutting: 'Houthakken', mining: 'Delven', hunting: 'Jagen', collecting: 'Verzamelen', trading: 'Handelen' };
const RARITY_XP = { common: 8, uncommon: 15, rare: 30, epic: 60 };
const COLLECT_XP = 40;
const TRADE_XP = 25;

// Cumulatieve xp om elk niveau te bereiken (LEVEL_XP[1] = 0). Elk volgend
// niveau kost geleidelijk meer, tot een stevige lange-termijn-grind naar 99.
const LEVEL_XP = (() => {
  const table = [0, 0];
  for (let level = 2; level <= MAX_SKILL_LEVEL; level += 1) {
    const prev = level - 1;
    table[level] = table[prev] + 100 + Math.round(prev * prev * 1.3);
  }
  return table;
})();
const MAX_SKILL_XP = LEVEL_XP[MAX_SKILL_LEVEL];

function levelForXp(xp) {
  let level = 1;
  while (level < MAX_SKILL_LEVEL && xp >= LEVEL_XP[level + 1]) level += 1;
  return level;
}

function defaultSkills() { return Object.fromEntries(SKILL_KEYS.map((key) => [key, 0])); }

function addXp(game, player, skillKey, amount) {
  if (!amount) return;
  const before = levelForXp(player.skills[skillKey]);
  player.skills[skillKey] = Math.min(MAX_SKILL_XP, player.skills[skillKey] + amount);
  const after = levelForXp(player.skills[skillKey]);
  if (after > before) game.log.unshift(`${SKILL_LABEL[skillKey]} omhoog naar niveau ${after}!`);
}

// Hakken en delven volgen exact hetzelfde ritme als vissen (wachten -> tijdig
// toeslaan -> tijdig lostrekken -> resultaat), alleen dan op land i.p.v. water.
const GATHER_CONFIG = {
  wood: {
    toolKey: 'axe',
    label: 'hout',
    startLog: 'Je zet je bijl in de stam...',
    strikeText: 'Nu! Hak raak!',
    strikeVerb: 'Hakken',
    haulText: 'Trek de stam om!',
    haulVerb: 'Omtrekken',
    earlyMiss: 'De boom staat er nog, wacht op je kans.',
    lateMiss: 'Mis geslagen! De boom veert terug.',
    haulMiss: 'De stam veerde terug, je moet opnieuw beginnen.',
    resultVerb: 'Gehakt'
  },
  rock: {
    toolKey: 'pickaxe',
    label: 'steen',
    startLog: 'Je zet je houweel in de rots...',
    strikeText: 'Nu! Sla raak!',
    strikeVerb: 'Houwen',
    haulText: 'Breek het los!',
    haulVerb: 'Loswrikken',
    earlyMiss: 'De rots houdt nog stand, wacht op je kans.',
    lateMiss: 'Mis geslagen! Het houweel ketst af.',
    haulMiss: 'Het brok viel terug, je moet opnieuw beginnen.',
    resultVerb: 'Gedolven'
  }
  // Jagen op wild ('animal') gebruikt geen tijdvenster-QTE meer, maar een
  // dobbelsteen-gevecht — zie doHuntStart/doHuntAction hieronder.
};

function inventoryFieldFor(kind) {
  if (kind === 'wood') return 'woodInventory';
  if (kind === 'rock') return 'rockInventory';
  if (kind === 'meat') return 'meatInventory';
  return 'inventory';
}
function discoveredFieldFor(kind) {
  if (kind === 'wood') return 'woodDiscovered';
  if (kind === 'rock') return 'rockDiscovered';
  if (kind === 'meat') return 'meatDiscovered';
  return 'discovered';
}
function itemLookup(kind, id) { return kind === 'fish' ? getFish(id) : resources.getItem(kind, id); }
function priceForKind(kind, id, weightKg, bonus) {
  return kind === 'fish' ? fishPriceFor(id, weightKg, bonus) : resources.priceFor(kind, id, weightKg, bonus);
}
function setsForKind(kind) { return kind === 'fish' ? SETS : resources.setsFor(kind); }

// Pantser komt uitsluitend van uitgeruste kleding + schild; aanval van het
// uitgeruste wapen. Beide zijn afgeleid van de winkelcatalogus (gear.js), niet
// van een los opgeslagen getal — zo hoeft een prijs-/statwijziging in de
// catalogus nergens anders bijgewerkt te worden.
function equippedItem(player, category) {
  const id = player.equipped[category];
  return id ? gear.getGear(category, id) : null;
}
function armorValue(player) {
  return (equippedItem(player, 'clothes')?.armor || 0) + (equippedItem(player, 'shields')?.armor || 0);
}
// Dobbelsteentier (0..4) van het uitgeruste wapen/pantser — index in
// DICE_BY_TIER. Pantser heeft geen aparte "tier"-lijst; de gecombineerde
// armorValue wordt in plaats daarvan gewoon in buckets van 6 verdeeld.
function weaponTier(player) {
  const weapon = equippedItem(player, 'weapons');
  if (!weapon) return 0;
  const idx = gear.WEAPONS.findIndex((entry) => entry.id === weapon.id);
  return idx === -1 ? 0 : idx + 1;
}
function armorTier(player) {
  return Math.max(0, Math.min(DICE_BY_TIER.length - 1, Math.floor(armorValue(player) / 6)));
}
function rollDice(count, sides) {
  let total = 0;
  for (let i = 0; i < count; i += 1) total += 1 + Math.floor(Math.random() * sides);
  return total;
}
function skillBonus(player, skillKey) {
  return Math.floor(levelForXp(player.skills[skillKey]) / HUNTING_SKILL_BONUS_STEP);
}

// Buffs komen van gerechten (recipes.js) en zijn puur sessie-gebonden (niet
// opgeslagen tussen bezoeken) — vervallen automatisch via tick().
function hasBuff(player, buffId) {
  return (player.buffs || []).some((b) => b.id === buffId && b.until > Date.now());
}
function applyBuff(player, buffId) {
  if (!recipes.getBuff(buffId)) return;
  player.buffs = (player.buffs || []).filter((b) => b.id !== buffId);
  player.buffs.push({ id: buffId, until: Date.now() + recipes.BUFF_DURATION_MS });
}

function dayPhaseFor(game) {
  const elapsed = (Date.now() - game.clock.startedAt) % DAY_LENGTH_MS;
  return elapsed / DAY_LENGTH_MS >= (1 - NIGHT_FRACTION) ? 'night' : 'day';
}

// Ruilen werkt over alle vier voorraadtypes heen. `nextUid` is één gedeelde
// teller per speler (`doReel`, `doGatherHaul` gebruiken 'm allemaal), dus een
// uid is al uniek over vis/hout/steen/vlees — hier hoeven we enkel de velden
// na elkaar te doorzoeken tot het item gevonden is.
function findOwnedItem(player, uid) {
  for (const kind of ['fish', 'wood', 'rock', 'meat']) {
    const item = player[inventoryFieldFor(kind)].find((candidate) => candidate.uid === uid);
    if (item) return { kind, item };
  }
  return null;
}

function boatWaterSet(player) {
  const tier = Math.min(player.gear.boat, WATER_TIERS.length - 1);
  return new Set(WATER_TIERS[tier] || []);
}

function defaultGear() { return { rod: 0, bait: 0, boat: 0, axe: 0, pickaxe: 0 }; }
function allSets() { return [...SETS, ...resources.WOOD_SETS, ...resources.ROCK_SETS, ...resources.ANIMAL_SETS]; }
function defaultSetBonuses() { return Object.fromEntries(allSets().map((set) => [set.id, false])); }
function defaultStats() { return { health: MAX_HEALTH, energy: MAX_ENERGY }; }
function defaultGearOwned() { return Object.fromEntries(gear.CATEGORIES.map((category) => [category, []])); }
function defaultEquipped() { return Object.fromEntries(gear.CATEGORIES.map((category) => [category, null])); }
function defaultGearDurability() { return Object.fromEntries(gear.CATEGORIES.map((category) => [category, {}])); }

function sanitizeItems(kind, discoveredRaw, inventoryRaw) {
  const known = new Set(resources.poolFor(kind).map((item) => item.id));
  const discovered = Array.isArray(discoveredRaw) ? discoveredRaw.filter((id) => known.has(id)) : [];
  const inventory = Array.isArray(inventoryRaw)
    ? inventoryRaw.filter((item) => item && known.has(item.speciesId) && Number.isFinite(item.weightKg))
    : [];
  if (kind === 'meat') {
    for (const item of inventory) {
      if (item.quality !== 'roasted' && item.quality !== 'dish') item.quality = 'raw';
      if (item.quality !== 'dish') delete item.buffId;
    }
  }
  return { discovered, inventory };
}

function sanitizeSaved(saved) {
  const knownFish = new Set(SETS.flatMap((set) => set.fish.map((fish) => fish.id)));
  const discovered = Array.isArray(saved?.discovered) ? saved.discovered.filter((id) => knownFish.has(id)) : [];
  const inventory = Array.isArray(saved?.inventory)
    ? saved.inventory.filter((item) => item && knownFish.has(item.speciesId) && Number.isFinite(item.weightKg))
    : [];
  const wood = sanitizeItems('wood', saved?.woodDiscovered, saved?.woodInventory);
  const rock = sanitizeItems('rock', saved?.rockDiscovered, saved?.rockInventory);
  const meat = sanitizeItems('meat', saved?.meatDiscovered, saved?.meatInventory);
  const toolLevels = { ...defaultGear() };
  for (const key of GEAR_KEYS) {
    const level = Number(saved?.gear?.[key]);
    if (Number.isFinite(level)) toolLevels[key] = Math.max(0, Math.min(GEAR_MAX_LEVEL, Math.round(level)));
  }
  const setBonuses = { ...defaultSetBonuses() };
  for (const set of allSets()) setBonuses[set.id] = Boolean(saved?.setBonuses?.[set.id]);
  const skills = { ...defaultSkills() };
  for (const key of SKILL_KEYS) {
    const xp = Number(saved?.skills?.[key]);
    if (Number.isFinite(xp)) skills[key] = Math.max(0, Math.min(MAX_SKILL_XP, Math.round(xp)));
  }
  const gearOwned = defaultGearOwned();
  for (const category of gear.CATEGORIES) {
    const ownedIds = Array.isArray(saved?.gearOwned?.[category]) ? saved.gearOwned[category] : [];
    gearOwned[category] = [...new Set(ownedIds.filter((id) => gear.getGear(category, id)))];
  }
  const equipped = defaultEquipped();
  for (const category of gear.CATEGORIES) {
    const id = saved?.equipped?.[category];
    if (id && gearOwned[category].includes(id)) equipped[category] = id;
  }
  const gearDurability = defaultGearDurability();
  for (const category of gear.CATEGORIES) {
    const rawCategory = saved?.gearDurability?.[category] || {};
    for (const id of gearOwned[category]) {
      const item = gear.getGear(category, id);
      if (!item) continue;
      const rawEntry = rawCategory[id];
      const maxDurability = Number.isFinite(Number(rawEntry?.maxDurability))
        ? Math.max(10, Math.min(item.maxDurability, Math.round(Number(rawEntry.maxDurability))))
        : item.maxDurability;
      const durability = Number.isFinite(Number(rawEntry?.durability))
        ? Math.max(0, Math.min(maxDurability, Math.round(Number(rawEntry.durability))))
        : maxDurability;
      gearDurability[category][id] = { durability, maxDurability };
    }
  }
  const stats = defaultStats();
  const health = Number(saved?.stats?.health);
  if (Number.isFinite(health)) stats.health = Math.max(0, Math.min(MAX_HEALTH, Math.round(health)));
  const energy = Number(saved?.stats?.energy);
  if (Number.isFinite(energy)) stats.energy = Math.max(0, Math.min(MAX_ENERGY, Math.round(energy)));
  return {
    cash: Math.max(0, Number(saved?.cash) || 0),
    discovered,
    inventory,
    woodDiscovered: wood.discovered,
    woodInventory: wood.inventory,
    rockDiscovered: rock.discovered,
    rockInventory: rock.inventory,
    meatDiscovered: meat.discovered,
    meatInventory: meat.inventory,
    gear: toolLevels,
    gearOwned,
    gearDurability,
    equipped,
    stats,
    setBonuses,
    skills,
    heaviestKg: Math.max(0, Number(saved?.heaviestKg) || 0)
  };
}

function weightedFish(list, player) {
  const buffMultiplier = hasBuff(player, 'lineStrength') ? 1.4 : 1;
  const raretyMultiplier = BAIT_RARE_MULTIPLIER ** (player?.gear?.bait || 0) * buffMultiplier;
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

function weightedItem(list) {
  const total = list.reduce((sum, item) => sum + (RARITY_WEIGHT[item.rarity] || 1), 0);
  let roll = Math.random() * total;
  for (const item of list) {
    roll -= RARITY_WEIGHT[item.rarity] || 1;
    if (roll <= 0) return item;
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
      woodInventory: saved ? saved.woodInventory : [],
      woodDiscovered: saved ? saved.woodDiscovered : [],
      rockInventory: saved ? saved.rockInventory : [],
      rockDiscovered: saved ? saved.rockDiscovered : [],
      meatInventory: saved ? saved.meatInventory : [],
      meatDiscovered: saved ? saved.meatDiscovered : [],
      gear: saved ? saved.gear : defaultGear(),
      gearOwned: saved ? saved.gearOwned : defaultGearOwned(),
      gearDurability: saved ? saved.gearDurability : defaultGearDurability(),
      equipped: saved ? saved.equipped : defaultEquipped(),
      stats: saved ? saved.stats : defaultStats(),
      setBonuses: saved ? saved.setBonuses : defaultSetBonuses(),
      skills: saved ? saved.skills : defaultSkills(),
      heaviestKg: saved ? saved.heaviestKg : 0,
      fishing: null,
      gathering: null,
      combat: null,
      buffs: [],
      nextUid: 1
    };
  });
  return {
    gameOver: false,
    resultText: '',
    log: ['Je staat klaar om uit te varen.'],
    players,
    trades: [],
    harbors: [],
    clock: { startedAt: Date.now() }
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
      woodInventory: player.woodInventory,
      woodDiscovered: player.woodDiscovered,
      rockInventory: player.rockInventory,
      rockDiscovered: player.rockDiscovered,
      meatInventory: player.meatInventory,
      meatDiscovered: player.meatDiscovered,
      gear: player.gear,
      gearOwned: player.gearOwned,
      gearDurability: player.gearDurability,
      equipped: player.equipped,
      stats: player.stats,
      setBonuses: player.setBonuses,
      skills: player.skills,
      heaviestKg: player.heaviestKg
    });
  }
}

function doMove(game, player, payload) {
  if (player.combat) throw new Error('Je zit midden in een gevecht — vecht het uit of vlucht.');
  const world = getWorld();
  const tx = Math.round(Number(payload.x));
  const ty = Math.round(Number(payload.y));
  if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 0 || tx >= world.width || ty < 0 || ty >= world.height) {
    throw new Error('Ongeldige bestemming.');
  }
  if (player.fishing) player.fishing = null;
  if (player.gathering) player.gathering = null;
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
  if (player.combat) throw new Error('Je zit midden in een gevecht — vecht het uit of vlucht.');
  const world = getWorld();
  if (player.path.length) throw new Error('Blijf even stilstaan om te vissen.');
  if (player.fishing && player.fishing.phase !== 'result') throw new Error('Je hengel ligt al uit.');
  if (player.stats.energy <= 0) throw new Error('Je bent te uitgeput. Eet iets om energie te herstellen.');
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
  const species = fishForBiome(fishing.biome, dayPhaseFor(game) === 'night');
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
  player.stats.energy = Math.max(0, player.stats.energy - ENERGY_COST_PER_ACTION);
  player.fishing = {
    phase: 'result',
    speciesId: fishing.speciesId,
    weightKg: fishing.weightKg,
    isNew,
    resultUntil: now + RESULT_DISPLAY_MS
  };
  game.log.unshift(`Gevangen: ${fish.name} (${fishing.weightKg.toFixed(1)} kg)${isNew ? ' — nieuwe soort!' : ''}`);

  addXp(game, player, 'fishing', RARITY_XP[fish.rarity] || 0);
  if (isNew) { addXp(game, player, 'collecting', COLLECT_XP); applySetCompletionBonus(game, player, 'fish'); }
}

// Generieke setbonus-check: gebruikt na elke nieuwe vis/hout/steen/vlees-ontdekking.
function applySetCompletionBonus(game, player, kind) {
  const discoveredField = discoveredFieldFor(kind);
  for (const set of setsForKind(kind)) {
    if (player.setBonuses[set.id]) continue;
    const items = kind === 'fish' ? set.fish : set.items;
    if (!items.every((entry) => player[discoveredField].includes(entry.id))) continue;
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

// De speler die tijdens een gevecht (dobbelgevecht bij de jacht) flauwvalt,
// wordt teruggebracht naar het dorp op halve gezondheid — nooit permadeath.
function faintPlayer(game, player) {
  const world = getWorld();
  player.x = world.spawn.x;
  player.y = world.spawn.y;
  player.path = [];
  player.stats.health = Math.round(MAX_HEALTH * FAINT_HEALTH_RESTORE);
  game.log.unshift(`${player.name} valt flauw en wordt teruggebracht naar het dorp.`);
}

function doGatherStart(game, player, payload) {
  if (player.combat) throw new Error('Je zit midden in een gevecht — vecht het uit of vlucht.');
  const kind = String(payload.kind || '');
  const config = GATHER_CONFIG[kind];
  if (!config) throw new Error('Onbekende verzamelactie.');
  const world = getWorld();
  if (player.path.length) throw new Error('Blijf even stilstaan.');
  if (player.gathering && player.gathering.phase !== 'result') throw new Error(`Je ${GEAR_LABEL[config.toolKey]} is al bezig.`);
  if (player.stats.energy <= 0) throw new Error('Je bent te uitgeput. Eet iets om energie te herstellen.');
  const tx = Math.round(Number(payload.x));
  const ty = Math.round(Number(payload.y));
  if (hexDistance(player.x, player.y, tx, ty) > 1) throw new Error('Dat is te ver weg.');
  if (resourceAt(world, tx, ty) !== kind) {
    throw new Error(kind === 'wood' ? 'Daar staat geen boom.' : 'Daar zit geen delfbare rots.');
  }
  const now = Date.now();
  player.gathering = { kind, phase: 'cast', bitesAt: now + BITE_MIN_MS + Math.random() * (BITE_MAX_MS - BITE_MIN_MS) };
  game.log.unshift(config.startLog);
}

function doGatherStrike(game, player) {
  const gathering = player.gathering;
  const config = gathering && GATHER_CONFIG[gathering.kind];
  const now = Date.now();
  if (!gathering || gathering.phase !== 'bite' || now > gathering.hookDeadline) {
    player.gathering = null;
    const early = gathering?.phase === 'cast';
    throw new Error(early ? (config?.earlyMiss || 'Nog niet klaar.') : (config?.lateMiss || 'Te laat.'));
  }
  const item = weightedItem(resources.poolFor(gathering.kind));
  const weightKg = rollWeight(item);
  player.gathering = {
    ...gathering,
    phase: 'reel',
    speciesId: item.id,
    weightKg,
    reelDeadline: now + REEL_WINDOW_MIN_MS + Math.random() * (REEL_WINDOW_MAX_MS - REEL_WINDOW_MIN_MS)
  };
}

function doGatherHaul(game, player) {
  const gathering = player.gathering;
  const config = gathering && GATHER_CONFIG[gathering.kind];
  const now = Date.now();
  if (!gathering || gathering.phase !== 'reel' || now > gathering.reelDeadline) {
    player.gathering = null;
    throw new Error(config?.haulMiss || 'Het glipte weg.');
  }
  const kind = gathering.kind;
  const item = resources.getItem(kind, gathering.speciesId);
  const discoveredField = discoveredFieldFor(kind);
  const inventoryField = inventoryFieldFor(kind);
  const isNew = !player[discoveredField].includes(gathering.speciesId);
  if (isNew) player[discoveredField].push(gathering.speciesId);
  player[inventoryField].push({
    uid: `${player.id}-${player.nextUid++}`,
    speciesId: gathering.speciesId,
    weightKg: gathering.weightKg,
    caughtAt: now
  });
  player.stats.energy = Math.max(0, player.stats.energy - ENERGY_COST_PER_ACTION);
  player.gathering = {
    ...gathering,
    phase: 'result',
    isNew,
    resultUntil: now + RESULT_DISPLAY_MS
  };
  game.log.unshift(`${config.resultVerb}: ${item.name} (${gathering.weightKg.toFixed(1)} kg)${isNew ? ' — nieuw!' : ''}`);
  const skillKey = kind === 'wood' ? 'woodcutting' : 'mining';
  addXp(game, player, skillKey, RARITY_XP[item.rarity] || 0);
  if (isNew) { addXp(game, player, 'collecting', COLLECT_XP); applySetCompletionBonus(game, player, kind); }
}

function bonusFor(player, kind, item) {
  const lookup = itemLookup(kind, item.speciesId);
  return lookup && player.setBonuses[lookup.setId] ? SET_BONUS_MULTIPLIER : 1;
}

const SELL_NOUN = { fish: 'vis', wood: 'stuk hout', rock: 'steen', meat: 'stuk vlees' };

function doSell(game, player, payload) {
  const kind = ['fish', 'wood', 'rock', 'meat'].includes(payload.kind) ? payload.kind : 'fish';
  const field = inventoryFieldFor(kind);
  const noun = SELL_NOUN[kind];
  if (!player[field].length) throw new Error('Je hebt niets om te verkopen.');
  const uid = String(payload.uid || '');
  const uids = Array.isArray(payload.uids) ? payload.uids.map(String) : null;

  if (uid === 'all') {
    const total = player[field].reduce((sum, item) => sum + priceForKind(kind, item.speciesId, item.weightKg, bonusFor(player, kind, item)), 0);
    player.cash += total;
    player[field] = [];
    game.log.unshift(`Je verkoopt alles voor €${total}.`);
    return;
  }

  if (uids) {
    const wanted = new Set(uids);
    if (!wanted.size) throw new Error(`Selecteer minstens één ${noun} om te verkopen.`);
    const toSell = player[field].filter((item) => wanted.has(item.uid));
    if (!toSell.length) throw new Error('Dat heb je niet (meer).');
    const total = toSell.reduce((sum, item) => sum + priceForKind(kind, item.speciesId, item.weightKg, bonusFor(player, kind, item)), 0);
    player.cash += total;
    player[field] = player[field].filter((item) => !wanted.has(item.uid));
    game.log.unshift(`Verkocht: ${toSell.length}x voor €${total}.`);
    return;
  }

  const index = player[field].findIndex((item) => item.uid === uid);
  if (index === -1) throw new Error('Dat heb je niet.');
  const [item] = player[field].splice(index, 1);
  const price = priceForKind(kind, item.speciesId, item.weightKg, bonusFor(player, kind, item));
  player.cash += price;
  game.log.unshift(`Verkocht: ${itemLookup(kind, item.speciesId).name} voor €${price}.`);
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

// Kwaliteit (raw/roasted/dish, zie doCook) vermenigvuldigt de energie die een
// stuk vlees geeft; een 'dish' hangt bovendien een tijdelijke buff aan het
// eten vast (zie recipes.js).
function consumeMeat(player, item) {
  const entry = resources.getItem('meat', item.speciesId);
  const base = entry?.energy || 0;
  const multiplier = recipes.QUALITY_MULTIPLIER[item.quality] || 1;
  const gained = Math.round(base * multiplier);
  player.stats.energy = Math.min(MAX_ENERGY, player.stats.energy + gained);
  if (item.quality === 'dish' && item.buffId) applyBuff(player, item.buffId);
  return { gained, name: entry?.name || 'iets' };
}

function doEat(game, player, payload) {
  if (!player.meatInventory.length) throw new Error('Je hebt niets om te eten.');
  const uid = String(payload.uid || '');

  if (uid === 'all') {
    let total = 0;
    for (const item of player.meatInventory) total += consumeMeat(player, item).gained;
    player.meatInventory = [];
    game.log.unshift(`Je eet alles op en herstelt ${total} energie.`);
    return;
  }

  const index = player.meatInventory.findIndex((item) => item.uid === uid);
  if (index === -1) throw new Error('Dat heb je niet.');
  const [item] = player.meatInventory.splice(index, 1);
  const { gained, name } = consumeMeat(player, item);
  game.log.unshift(`Je eet ${name} op en herstelt ${gained} energie.`);
}

function doCook(game, player, payload) {
  const station = String(payload.station || '');
  if (station === 'kampvuur') {
    const uid = String(payload.uid || '');
    const item = player.meatInventory.find((entry) => entry.uid === uid);
    if (!item) throw new Error('Dat heb je niet.');
    if (item.quality !== 'raw') throw new Error('Dit is al bereid.');
    item.quality = 'roasted';
    game.log.unshift('Je roostert het vlees boven het kampvuur.');
    return;
  }
  if (station === 'kookvuur') {
    const dish = recipes.getDish(String(payload.recipeId || ''));
    if (!dish) throw new Error('Onbekend recept.');
    const candidate = player.meatInventory.find((entry) => entry.quality !== 'dish');
    if (!candidate) throw new Error('Je hebt geen vlees om te bereiden.');
    if (player.cash < dish.cost) throw new Error('Onvoldoende geld voor kruiden en voorraad.');
    player.cash -= dish.cost;
    candidate.quality = 'dish';
    candidate.buffId = dish.buff.id;
    game.log.unshift(`Je bereidt ${dish.name} — geeft ${dish.buff.label} bij het eten.`);
    return;
  }
  throw new Error('Onbekend kookstation.');
}

function doBuyGear(game, player, payload) {
  const category = String(payload.category || '');
  if (!gear.CATEGORIES.includes(category)) throw new Error('Onbekende categorie.');
  const item = gear.getGear(category, String(payload.id || ''));
  if (!item) throw new Error('Onbekend item.');
  if (player.gearOwned[category].includes(item.id)) throw new Error('Je hebt dit al.');
  if (player.cash < item.price) throw new Error('Onvoldoende geld.');
  player.cash -= item.price;
  player.gearOwned[category].push(item.id);
  player.gearDurability[category][item.id] = { durability: item.maxDurability, maxDurability: item.maxDurability };
  game.log.unshift(`Gekocht: ${item.name} voor €${item.price}.`);
}

function doEquipGear(game, player, payload) {
  const category = String(payload.category || '');
  if (!gear.CATEGORIES.includes(category)) throw new Error('Onbekende categorie.');
  const id = payload.id ? String(payload.id) : null;
  if (id && !player.gearOwned[category].includes(id)) throw new Error('Dat bezit je niet.');
  player.equipped[category] = id;
  game.log.unshift(id ? `Uitgerust: ${gear.getGear(category, id).name}.` : 'Uitrusting verwijderd.');
}

function doRepairGear(game, player, payload) {
  const category = String(payload.category || '');
  if (!gear.CATEGORIES.includes(category)) throw new Error('Onbekende categorie.');
  const id = String(payload.id || '');
  const state = player.gearDurability[category]?.[id];
  if (!state) throw new Error('Dat bezit je niet.');
  if (state.durability >= state.maxDurability) throw new Error('Dit is al volledig intact.');
  const missing = state.maxDurability - state.durability;
  const cost = Math.max(1, Math.ceil(missing * REPAIR_COST_PER_POINT));
  if (player.cash < cost) throw new Error('Onvoldoende geld.');
  player.cash -= cost;
  // Repareren verlaagt het maximum een beetje — uiteindelijk moet je een
  // nieuwe maken, precies zoals het ontwerp beschrijft.
  const wear = Math.max(1, Math.round(state.maxDurability * REPAIR_MAX_LOSS_FRACTION));
  state.maxDurability = Math.max(10, state.maxDurability - wear);
  state.durability = state.maxDurability;
  game.log.unshift(`Gerepareerd voor €${cost} — maximale slijtvastheid daalt naar ${state.maxDurability}.`);
}

function doBuildHarbor(game, player, payload) {
  const world = getWorld();
  if (game.harbors.some((harbor) => harbor.ownerId === player.id)) throw new Error('Je hebt al een aanlegsteiger gebouwd.');
  const tx = Math.round(Number(payload.x));
  const ty = Math.round(Number(payload.y));
  if (hexDistance(player.x, player.y, tx, ty) > 1) throw new Error('Dat is te ver weg.');
  if (tileAt(world, tx, ty) !== 'B') throw new Error('Een aanlegsteiger moet aan een strand liggen.');
  if (player.cash < HARBOR_COST) throw new Error('Onvoldoende geld.');
  player.cash -= HARBOR_COST;
  game.harbors.push({ id: `harbor-${player.id}`, x: tx, y: ty, ownerId: player.id, ownerName: player.name, tier: 1 });
  game.log.unshift(`${player.name} bouwt een aanlegsteiger.`);
}

// ---- Dobbelgevecht bij de jacht -------------------------------------------

function degradeEquippedGear(game, player) {
  for (const category of gear.CATEGORIES) {
    const id = player.equipped[category];
    if (!id) continue;
    const state = player.gearDurability[category]?.[id];
    if (!state) continue;
    state.durability = Math.max(0, state.durability - HUNT_GEAR_WEAR);
    if (state.durability <= 0) {
      const item = gear.getGear(category, id);
      player.gearOwned[category] = player.gearOwned[category].filter((ownedId) => ownedId !== id);
      delete player.gearDurability[category][id];
      player.equipped[category] = null;
      game.log.unshift(`${item?.name || 'Uitrusting'} is versleten en kapot gegaan.`);
    }
  }
}

function doHuntStart(game, player, payload) {
  if (player.combat) throw new Error('Je zit al midden in een gevecht.');
  if (player.path.length) throw new Error('Blijf even stilstaan.');
  if (player.gathering && player.gathering.phase !== 'result') throw new Error('Je bent al bezig.');
  if (player.stats.energy <= 0) throw new Error('Je bent te uitgeput. Eet iets om energie te herstellen.');
  const world = getWorld();
  const tx = Math.round(Number(payload.x));
  const ty = Math.round(Number(payload.y));
  if (hexDistance(player.x, player.y, tx, ty) > 1) throw new Error('Dat is te ver weg.');
  if (resourceAt(world, tx, ty) !== 'animal') throw new Error('Daar zit geen wild dier.');
  const item = weightedItem(resources.poolFor('meat', { isNight: dayPhaseFor(game) === 'night' }));
  player.combat = { speciesId: item.id, enemyHp: item.combat.hp, enemyMaxHp: item.combat.hp, log: [`Een ${item.name} valt aan!`] };
  game.log.unshift(`${player.name} begint een jacht op een ${item.name}.`);
}

function enemyStrikes(game, player, item, { mitigation = 0, freeHit = false } = {}) {
  const { count, sides } = item.combat.dice;
  const roll = rollDice(count, sides);
  const rawDamage = Math.max(1, roll - (freeHit ? 0 : armorValue(player)));
  const damage = Math.max(1, Math.round(rawDamage * (1 - mitigation)));
  player.combat.log.unshift(`${item.name} valt terug (${count}d${sides} → ${roll}) — ${damage} schade.`);
  player.stats.health = Math.max(0, player.stats.health - damage);
  if (player.stats.health <= 0) {
    player.combat = null;
    faintPlayer(game, player);
  }
}

function drinkDuringHunt(player) {
  if (!player.meatInventory.length) throw new Error('Je hebt niets om te eten tijdens het gevecht.');
  const rank = { dish: 2, roasted: 1, raw: 0 };
  let best = player.meatInventory[0];
  for (const candidate of player.meatInventory) {
    if ((rank[candidate.quality] || 0) > (rank[best.quality] || 0)) best = candidate;
  }
  player.meatInventory.splice(player.meatInventory.indexOf(best), 1);
  const entry = resources.getItem('meat', best.speciesId);
  const heal = best.quality === 'dish' ? DRINK_HEAL_DISH : DRINK_HEAL_PLAIN;
  player.stats.health = Math.min(MAX_HEALTH, player.stats.health + heal);
  player.combat.log.unshift(`Je eet ${entry?.name || 'iets'} op: +${heal} gezondheid.`);
  if (best.quality === 'dish' && best.buffId) applyBuff(player, best.buffId);
}

function resolveHuntVictory(game, player, item) {
  const isNew = !player.meatDiscovered.includes(item.id);
  if (isNew) player.meatDiscovered.push(item.id);
  const weightKg = rollWeight(item);
  player.meatInventory.push({ uid: `${player.id}-${player.nextUid++}`, speciesId: item.id, weightKg, caughtAt: Date.now(), quality: 'raw' });
  player.stats.energy = Math.max(0, player.stats.energy - ENERGY_COST_PER_ACTION);
  degradeEquippedGear(game, player);
  player.combat = null;
  game.log.unshift(`Buit: ${item.name} (${weightKg.toFixed(1)} kg)${isNew ? ' — nieuw!' : ''}`);
  addXp(game, player, 'hunting', RARITY_XP[item.rarity] || 0);
  if (isNew) { addXp(game, player, 'collecting', COLLECT_XP); applySetCompletionBonus(game, player, 'meat'); }
}

function doHuntAction(game, player, payload) {
  const combat = player.combat;
  if (!combat) throw new Error('Je bent niet aan het jagen.');
  const item = resources.getItem('meat', combat.speciesId);
  const choice = String(payload.choice || '');

  if (choice === 'attack') {
    const tier = weaponTier(player);
    const { count, sides } = DICE_BY_TIER[tier];
    const extraDie = hasBuff(player, 'extraDie') ? 1 : 0;
    const bonus = skillBonus(player, 'hunting');
    const roll = rollDice(count + extraDie, sides) + bonus;
    const damage = Math.max(1, roll - item.combat.armor);
    combat.enemyHp = Math.max(0, combat.enemyHp - damage);
    combat.log.unshift(`Je gooit ${count + extraDie}d${sides}+${bonus} (${roll}) tegen pantser ${item.combat.armor} → ${damage} schade.`);
    if (combat.enemyHp <= 0) { resolveHuntVictory(game, player, item); return; }
    enemyStrikes(game, player, item);
    return;
  }
  if (choice === 'defend') {
    const tier = armorTier(player);
    const { count, sides } = DICE_BY_TIER[tier];
    const roll = rollDice(count, sides);
    combat.log.unshift(`Je verdedigt je (${count}d${sides} → ${roll}) en herstelt wat energie.`);
    player.stats.energy = Math.min(MAX_ENERGY, player.stats.energy + 5);
    enemyStrikes(game, player, item, { mitigation: 0.5 });
    return;
  }
  if (choice === 'drink') {
    drinkDuringHunt(player);
    enemyStrikes(game, player, item);
    return;
  }
  if (choice === 'flee') {
    const chance = FLEE_CHANCE[item.rarity] ?? 0.5;
    if (Math.random() < chance) {
      combat.log.unshift('Je ontsnapt.');
      game.log.unshift(`${player.name} vlucht weg van een ${item.name}.`);
      player.combat = null;
      return;
    }
    combat.log.unshift('Vluchten mislukt!');
    enemyStrikes(game, player, item, { freeHit: true });
    return;
  }
  throw new Error('Onbekende actie.');
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

  const offerFound = offerUids.map((uid) => findOwnedItem(player, uid));
  if (offerFound.some((found) => !found)) throw new Error('Je hebt niet (meer) al deze items.');
  const requestFound = requestUids.map((uid) => findOwnedItem(target, uid));
  if (requestFound.some((found) => !found)) throw new Error(`${target.name} heeft niet (meer) al deze items.`);

  game.trades = game.trades.filter((t) => !(t.fromId === player.id && t.toId === target.id));
  game.trades.push({
    id: `${player.id}-${target.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    fromId: player.id,
    fromName: player.name,
    toId: target.id,
    toName: target.name,
    offerUids,
    offerCash,
    offerSnapshot: offerFound.map(({ kind, item }) => ({ uid: item.uid, kind, speciesId: item.speciesId, weightKg: item.weightKg })),
    requestUids,
    requestCash,
    requestSnapshot: requestFound.map(({ kind, item }) => ({ uid: item.uid, kind, speciesId: item.speciesId, weightKg: item.weightKg })),
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

  const offerFound = trade.offerUids.map((uid) => findOwnedItem(from, uid));
  const requestFound = trade.requestUids.map((uid) => findOwnedItem(to, uid));
  const valid = from.cash >= trade.offerCash && to.cash >= trade.requestCash &&
    offerFound.every((found) => found) && requestFound.every((found) => found);
  if (!valid) {
    game.trades.splice(index, 1);
    throw new Error('Dit voorstel is niet meer geldig — geld of een item is intussen niet meer beschikbaar.');
  }

  from.cash += trade.requestCash - trade.offerCash;
  to.cash += trade.offerCash - trade.requestCash;
  for (const { kind, item } of offerFound) {
    const field = inventoryFieldFor(kind);
    from[field] = from[field].filter((candidate) => candidate.uid !== item.uid);
    to[field].push(item);
  }
  for (const { kind, item } of requestFound) {
    const field = inventoryFieldFor(kind);
    to[field] = to[field].filter((candidate) => candidate.uid !== item.uid);
    from[field].push(item);
  }

  game.trades.splice(index, 1);
  game.log.unshift(`${from.name} en ${to.name} hebben geruild.`);
  addXp(game, from, 'trading', TRADE_XP);
  addXp(game, to, 'trading', TRADE_XP);
}

function handleAction(game, playerId, action, payload = {}) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error('Onbekende speler.');
  if (action === 'move') return doMove(game, player, payload);
  if (action === 'cast') return doCast(game, player, payload);
  if (action === 'hook') return doHook(game, player);
  if (action === 'reel') return doReel(game, player);
  if (action === 'sell') return doSell(game, player, payload);
  if (action === 'gatherStart') return doGatherStart(game, player, payload);
  if (action === 'gatherStrike') return doGatherStrike(game, player);
  if (action === 'gatherHaul') return doGatherHaul(game, player);
  if (action === 'buyUpgrade') return doBuyUpgrade(game, player, payload);
  if (action === 'eat') return doEat(game, player, payload);
  if (action === 'cook') return doCook(game, player, payload);
  if (action === 'buyGear') return doBuyGear(game, player, payload);
  if (action === 'equipGear') return doEquipGear(game, player, payload);
  if (action === 'repairGear') return doRepairGear(game, player, payload);
  if (action === 'buildHarbor') return doBuildHarbor(game, player, payload);
  if (action === 'huntStart') return doHuntStart(game, player, payload);
  if (action === 'huntAction') return doHuntAction(game, player, payload);
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
  for (const player of game.players) {
    const gathering = player.gathering;
    if (!gathering) continue;
    const config = GATHER_CONFIG[gathering.kind];
    if (gathering.phase === 'cast' && now >= gathering.bitesAt) {
      const strikeWindow = HOOK_WINDOW_MS + (player.gear[config.toolKey] || 0) * TOOL_STRIKE_BONUS_MS;
      player.gathering = { ...gathering, phase: 'bite', hookDeadline: now + strikeWindow };
      game.log.unshift(config.strikeText);
      changed = true;
    } else if (gathering.phase === 'bite' && now > gathering.hookDeadline) {
      player.gathering = null;
      game.log.unshift(config.lateMiss);
      changed = true;
    } else if (gathering.phase === 'reel' && now > gathering.reelDeadline) {
      player.gathering = null;
      game.log.unshift(config.haulMiss);
      changed = true;
    } else if (gathering.phase === 'result' && now >= gathering.resultUntil) {
      player.gathering = null;
      changed = true;
    }
  }
  for (const player of game.players) {
    const before = (player.buffs || []).length;
    player.buffs = (player.buffs || []).filter((b) => b.until > now);
    if (player.buffs.length !== before) changed = true;
    if (hasBuff(player, 'energyRegen') && now >= (player.nextEnergyRegenAt || 0) && player.stats.energy < MAX_ENERGY) {
      player.stats.energy = Math.min(MAX_ENERGY, player.stats.energy + 2);
      player.nextEnergyRegenAt = now + 5000;
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

function serializeGathering(gathering, now) {
  if (!gathering) return null;
  const config = GATHER_CONFIG[gathering.kind];
  if (gathering.phase === 'cast') return { kind: gathering.kind, phase: 'cast', msRemaining: Math.max(0, gathering.bitesAt - now) };
  if (gathering.phase === 'bite') {
    return { kind: gathering.kind, phase: 'bite', strikeText: config.strikeText, strikeVerb: config.strikeVerb, msRemaining: Math.max(0, gathering.hookDeadline - now) };
  }
  if (gathering.phase === 'reel') {
    return { kind: gathering.kind, phase: 'reel', haulText: config.haulText, haulVerb: config.haulVerb, msRemaining: Math.max(0, gathering.reelDeadline - now) };
  }
  if (gathering.phase === 'result') {
    return {
      kind: gathering.kind,
      phase: 'result',
      item: resources.getItem(gathering.kind, gathering.speciesId),
      resultVerb: config.resultVerb,
      weightKg: gathering.weightKg,
      isNew: gathering.isNew,
      msRemaining: Math.max(0, gathering.resultUntil - now)
    };
  }
  return null;
}

function serializeItemSets(kind, discoveredList) {
  return resources.setsFor(kind).map((set) => ({
    id: set.id,
    name: set.name,
    icon: set.icon,
    description: set.description,
    total: set.items.length,
    caught: set.items.filter((item) => discoveredList.includes(item.id)).length,
    rewardGear: set.rewardGear,
    rewardGearLabel: GEAR_LABEL[set.rewardGear] || null,
    items: set.items.map((item) => ({ ...item, discovered: discoveredList.includes(item.id) }))
  }));
}

function serializeGearSlot(player, category) {
  return {
    catalog: gear.catalogFor(category),
    owned: player.gearOwned[category].map((id) => {
      const state = player.gearDurability[category]?.[id];
      const item = gear.getGear(category, id);
      return {
        id,
        durability: state?.durability ?? item?.maxDurability ?? 0,
        maxDurability: state?.maxDurability ?? item?.maxDurability ?? 0
      };
    }),
    equipped: player.equipped[category]
  };
}

function serializeCombat(player) {
  if (!player.combat) return null;
  const item = itemLookup('meat', player.combat.speciesId);
  return {
    speciesId: player.combat.speciesId,
    name: item?.name || '',
    icon: item?.icon || '🐾',
    enemyHp: player.combat.enemyHp,
    enemyMaxHp: player.combat.enemyMaxHp,
    youHealth: player.stats.health,
    youMaxHealth: MAX_HEALTH,
    log: player.combat.log.slice(0, 4),
    canDrink: player.meatInventory.length > 0
  };
}

function serializeBuffs(player, now) {
  return (player.buffs || [])
    .filter((b) => b.until > now)
    .map((b) => {
      const buff = recipes.getBuff(b.id);
      return { id: b.id, label: buff?.label || b.id, icon: buff?.icon || '✨', help: buff?.help || '', remainingMs: b.until - now };
    });
}

function serialize(game, requesterId) {
  const world = getWorld();
  const player = game.players.find((candidate) => candidate.id === requesterId) || game.players[0];
  const now = Date.now();
  const nearBuilding = world.buildings.find((building) => hexDistance(player.x, player.y, building.x, building.y) <= 1) || null;
  return {
    kind: game.gameKey,
    gameOver: false,
    world: { width: world.width, height: world.height, buildings: world.buildings, boats: world.boats, wildlife: world.wildlife },
    harbors: game.harbors,
    dayPhase: dayPhaseFor(game),
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      path: p.path,
      cash: p.cash,
      discoveredCount: p.discovered.length,
      fishingPhase: p.fishing ? p.fishing.phase : null,
      gatheringKind: p.gathering ? p.gathering.kind : null,
      inCombat: Boolean(p.combat),
      inventory: p.inventory.map((item) => ({ uid: item.uid, speciesId: item.speciesId, weightKg: item.weightKg, fish: getFish(item.speciesId) }))
    })),
    you: {
      id: player.id,
      x: player.x,
      y: player.y,
      path: player.path,
      cash: player.cash,
      stats: {
        health: player.stats.health,
        maxHealth: MAX_HEALTH,
        energy: player.stats.energy,
        maxEnergy: MAX_ENERGY,
        armor: armorValue(player)
      },
      gear: player.gear,
      gearCosts: GEAR_COSTS,
      gearMaxLevel: GEAR_MAX_LEVEL,
      gearShop: Object.fromEntries(gear.CATEGORIES.map((category) => [category, serializeGearSlot(player, category)])),
      inventory: player.inventory.map((item) => ({
        ...item,
        fish: getFish(item.speciesId),
        price: priceForKind('fish', item.speciesId, item.weightKg, bonusFor(player, 'fish', item))
      })),
      woodInventory: player.woodInventory.map((item) => ({
        ...item,
        item: resources.getItem('wood', item.speciesId),
        price: priceForKind('wood', item.speciesId, item.weightKg, bonusFor(player, 'wood', item))
      })),
      rockInventory: player.rockInventory.map((item) => ({
        ...item,
        item: resources.getItem('rock', item.speciesId),
        price: priceForKind('rock', item.speciesId, item.weightKg, bonusFor(player, 'rock', item))
      })),
      meatInventory: player.meatInventory.map((item) => ({
        ...item,
        item: resources.getItem('meat', item.speciesId),
        price: priceForKind('meat', item.speciesId, item.weightKg, bonusFor(player, 'meat', item)),
        buff: item.buffId ? recipes.getBuff(item.buffId) : null
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
      woodSets: serializeItemSets('wood', player.woodDiscovered).map((set) => ({ ...set, bonusActive: Boolean(player.setBonuses[set.id]) })),
      rockSets: serializeItemSets('rock', player.rockDiscovered).map((set) => ({ ...set, bonusActive: Boolean(player.setBonuses[set.id]) })),
      meatSets: serializeItemSets('meat', player.meatDiscovered).map((set) => ({ ...set, bonusActive: Boolean(player.setBonuses[set.id]) })),
      skills: Object.fromEntries(SKILL_KEYS.map((key) => {
        const xp = player.skills[key];
        const level = levelForXp(xp);
        const maxed = level >= MAX_SKILL_LEVEL;
        return [key, {
          level,
          xp,
          xpIntoLevel: xp - LEVEL_XP[level],
          xpForNextLevel: maxed ? 0 : LEVEL_XP[level + 1] - LEVEL_XP[level],
          maxed
        }];
      })),
      totalLevel: SKILL_KEYS.reduce((sum, key) => sum + levelForXp(player.skills[key]), 0),
      fishing: serializeFishing(player.fishing, now),
      gathering: serializeGathering(player.gathering, now),
      combat: serializeCombat(player),
      buffs: serializeBuffs(player, now),
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
            items: t.offerSnapshot.map((item) => ({ ...item, display: itemLookup(item.kind, item.speciesId) }))
          },
          request: {
            cash: t.requestCash,
            items: t.requestSnapshot.map((item) => ({ ...item, display: itemLookup(item.kind, item.speciesId) }))
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
      buildings: world.buildings,
      boats: world.boats,
      wildlife: world.wildlife
    });
  });
}

module.exports = { createGame, handleAction, serialize, tick, configureHttp, preparePlayers, afterStateChange };
