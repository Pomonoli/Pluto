'use strict';

const { randomUUID } = require('node:crypto');
const sim = require('./simulation');
const { createState, simulation, ERA_NAMES, ROLES, ROLE_DEFS, MAX_TURRETS, MAX_QUEUE, MAX_WORKERS, W } = sim;
const meta = {
  key: 'kasteel-strijd', name: 'Castle Defense',
  description: 'Speel Trough the Ages of kies een franchise, bouw je basis uit en versla de vijand.',
  minPlayers: 2, maxPlayers: 2, supportsNpc: true, realtime: false, solo: false
};
const SIDES = ['player', 'enemy'];
const FRANCHISES = {
  starwars: {
    name: 'Star Wars', sides: ['jedi', 'sith'], labels: { jedi: 'Jedi', sith: 'Sith' },
    tracks: {
      jedi: [
        ['Galactic Republic', 'Clone Trooper', 'Clone Marksman', 'AT-TE', 'Jedi Knight', 'Republic Engineer', 'Venator Command', 'Orbital Salvo'],
        ['Jedi Generals', 'Clone Veteran', 'ARC Trooper', 'Republic Gunship', 'Jedi Master', 'Astromech Crew', 'Jedi Temple', 'Force Wave'],
        ['Rebel Alliance', 'Rebel Trooper', 'Rebel Sniper', 'T-47 Speeder', 'Rebel Commander', 'Alliance Technician', 'Yavin Base', 'Starfighter Strike'],
        ['Resistance', 'Resistance Fighter', 'Pathfinder', 'X-wing Squadron', 'Resistance General', 'Resistance Mechanic', 'Resistance Outpost', 'Fleet Bombardment'],
        ['New Jedi Order', 'Jedi Guardian', 'Jedi Sentinel', 'Jedi Starfighter', 'Grand Master', 'Temple Keeper', 'Jedi Citadel', 'Light of the Force']
      ],
      sith: [
        ['Separatist Federation', 'Battle Droid', 'Droid Sniper', 'AAT', 'Sith Apprentice', 'Pit Droid', 'Droid Foundry', 'Droid Barrage'],
        ['Sith Conspiracy', 'Super Battle Droid', 'Droideka', 'Hailfire Droid', 'Sith Lord', 'Techno Union Worker', 'Sith Temple', 'Force Storm'],
        ['Galactic Empire', 'Stormtrooper', 'Scout Trooper', 'AT-AT', 'Imperial Commander', 'Imperial Technician', 'Imperial Fortress', 'Orbital Strike'],
        ['First Order', 'First Order Trooper', 'Executioner', 'Heavy Walker', 'First Order General', 'First Order Engineer', 'Starkiller Bastion', 'TIE Bombardment'],
        ['Final Order', 'Sith Trooper', 'Praetorian Guard', 'Sith Dreadnought', 'Supreme Leader', 'Sith Cultist', 'Exegol Citadel', 'Dark Force Tempest']
      ]
    }
  },
  lotr: {
    name: 'Lord of the Rings', sides: ['good', 'evil'], labels: { good: 'Good', evil: 'Evil' },
    tracks: {
      good: [
        ['The Shire', 'Hobbit Militia', 'Shire Archer', 'Pony Riders', 'Thain of the Shire', 'Hobbit Gardener', 'Hobbiton', 'Stone Throw'],
        ['Rohan', 'Rohan Spearman', 'Rohan Archer', 'Rohirrim', 'Marshal of the Mark', 'Stablemaster', 'Golden Hall', 'Horn of Helm'],
        ['Erebor', 'Dwarf Warrior', 'Dwarf Crossbowman', 'Battle Ram', 'Dwarf King', 'Dwarf Miner', 'Lonely Mountain', 'Rockfall'],
        ['Numenor & Dunedain', 'Dunedain Ranger', 'Numenorean Bowman', 'Armoured Cavalry', 'High King', 'Master Smith', 'White Citadel', 'Army of the Dead'],
        ['Elven Realms', 'Elven Guardian', 'Elven Archer', 'Great Eagle', 'Elven Lord', 'Elven Artisan', 'Elven Sanctuary', 'Wrath of the Valar']
      ],
      evil: [
        ['Goblin Caves', 'Goblin', 'Goblin Archer', 'Cave Troll', 'Goblin King', 'Goblin Digger', 'Goblin Warren', 'Cave Collapse'],
        ['Harad', 'Haradrim Warrior', 'Haradrim Archer', 'Mumakil', 'Serpent Lord', 'Haradrim Labourer', 'Harad Camp', 'Serpent Volley'],
        ['Isengard', 'Uruk-hai', 'Uruk Crossbowman', 'Siege Ballista', 'Saruman', 'Orc Woodcutter', 'Orthanc', 'Fire of Orthanc'],
        ['Mordor', 'Mordor Orc', 'Morgul Archer', 'War Troll', 'Sauron', 'Orc Smith', 'Barad-dur', 'Eye of Sauron'],
        ['Angband', 'Balrog Guard', 'Dark Elf', 'Dragon of Angband', 'Morgoth', 'Thrall of Angband', 'Thangorodrim', 'Flame of Udun']
      ]
    }
  },
  harrypotter: {
    name: 'Harry Potter', sides: ['harry', 'voldemort'], labels: { harry: 'Harry', voldemort: 'Voldemort' },
    tracks: {
      harry: [
        ['Hogwarts Students', 'Gryffindor Student', 'Young Wizard', 'Animated Armour', 'Harry Potter', 'House Elf', 'Hogwarts', 'Stupefy Volley'],
        ['Dumbledore’s Army', 'DA Duelist', 'DA Caster', 'Enchanted Knight', 'Neville Longbottom', 'Magical Caretaker', 'Room of Requirement', 'Patronus Wave'],
        ['Order of the Phoenix', 'Order Auror', 'Order Witch', 'Hippogriff Rider', 'Sirius Black', 'Order Healer', 'Grimmauld Place', 'Phoenix Fire'],
        ['Ministry Resistance', 'Elite Auror', 'Spell Sniper', 'Dragon Rider', 'Kingsley Shacklebolt', 'Ministry Artificer', 'Ministry Bastion', 'Auror Assault'],
        ['Dumbledore’s Legacy', 'Light Guardian', 'Master Witch', 'Phoenix Rider', 'Albus Dumbledore', 'Master Enchanter', 'Hogwarts Restored', 'Ancient Protection']
      ],
      voldemort: [
        ['Forbidden Creatures', 'Acromantula', 'Poacher', 'Mountain Giant', 'Dark Handler', 'Snatcher', 'Forbidden Lair', 'Spider Swarm'],
        ['Dark Wizards', 'Dark Duelist', 'Dark Caster', 'Werewolf Pack', 'Bellatrix Lestrange', 'Dark Alchemist', 'Knockturn Hideout', 'Fiendfyre'],
        ['Death Eaters', 'Masked Death Eater', 'Curse Caster', 'Armoured Giant', 'Lucius Malfoy', 'Bloodhound', 'Malfoy Manor', 'Dark Mark'],
        ['Ministry Fallen', 'Ministry Enforcer', 'Dementor', 'Inferi Horde', 'Nagini', 'Ministry Thrall', 'Occupied Ministry', 'Dementor’s Kiss'],
        ['Voldemort Ascendant', 'Dark Guard', 'Elder Curse Master', 'Basilisk', 'Lord Voldemort', 'Horcrux Keeper', 'Dark Hogwarts', 'Avada Kedavra Storm']
      ]
    }
  }
};
function normalizeRoomOptions(options = {}) {
  const mode = options.mode === 'franchise' ? 'franchise' : 'ages';
  const franchise = FRANCHISES[options.franchise] ? options.franchise : 'starwars';
  const def = FRANCHISES[franchise];
  const hostSide = def.sides.includes(options.hostSide) ? options.hostSide : def.sides[0];
  return { mode, franchise, hostSide };
}
function contentFor(franchise, faction, era) {
  const row = FRANCHISES[franchise].tracks[faction][Math.min(era, 4)];
  return { faction, factionLabel: FRANCHISES[franchise].labels[faction], stage: row[0], melee: row[1], ranged: row[2], heavy: row[3], hero: row[4], worker: row[5], base: row[6], special: row[7] };
}
function createGame(roomPlayers, options = {}, now = Date.now()) {
  if (typeof options === 'number') { now = options; options = {}; }
  if (roomPlayers.length !== 2 || roomPlayers[0].id === roomPlayers[1].id) throw new Error('Castle Defense vereist precies twee spelers.');
  const setup = normalizeRoomOptions(options), franchise = FRANCHISES[setup.franchise];
  const factions = setup.mode === 'franchise' ? [setup.hostSide, franchise.sides.find(side => side !== setup.hostSide)] : [null, null];
  const battle = createState(); battle.mode = setup.mode; battle.franchise = setup.franchise;
  battle.player.faction = factions[0]; battle.enemy.faction = factions[1];
  return {
    gameKey: meta.key, matchId: randomUUID(),
    mode: setup.mode, franchise: setup.franchise,
    players: roomPlayers.map((p, i) => ({ id: p.id, name: p.name, isNpc: Boolean(p.isNpc), side: SIDES[i], faction: factions[i] })),
    startedAt: now, lastTickAt: now, nextNpcAt: 1.5,
    battle, gameOver: false, winnerId: null, survivedMs: 0, resultText: ''
  };
}
function finish(game) {
  if (game.battle.running || game.gameOver) return;
  game.gameOver = true;
  game.survivedMs = Math.round(game.battle.elapsed * 1000);
  const winner = game.players.find(p => p.side === game.battle.winner);
  game.winnerId = winner.id;
  game.resultText = winner.name + ' wint: de vijandelijke basis is gevallen.';
}
function handleAction(game, playerId, action, payload = {}) {
  const player = game.players.find(p => p.id === playerId && !p.isNpc);
  if (!player) throw new Error('Niet jouw spel.');
  if (game.gameOver) throw new Error('Het spel is afgelopen.');
  simulation(game.battle).act(player.side, action, payload.key);
  // Resolve direct base damage immediately, before another action can heal it.
  simulation(game.battle).update(0);
  finish(game);
}
const COUNTERED_BY = { melee: 'heavy', ranged: 'melee', heavy: 'ranged' };
function npcTurn(game, engine) {
  const b = game.battle;
  for (const player of game.players.filter(p => p.isNpc)) {
    const side = player.side, p = b[side];
    const foeSide = side === 'player' ? 'enemy' : 'player';
    const mine = b.units.filter(u => u.side === side && !u.dead && u.role !== 'worker');
    const theirs = b.units.filter(u => u.side === foeSide && !u.dead && u.role !== 'worker');
    const workers = b.units.filter(u => u.side === side && !u.dead && u.role === 'worker').length + p.queue.filter(r => r === 'worker').length;
    const hasHero = p.queue.includes('hero') || b.units.some(u => u.side === side && !u.dead && u.role === 'hero');
    const nextTurret = ['near', 'far', 'bonus'][p.turrets.length] || 'near';
    const ownHalf = side === 'player' ? (u) => u.x < W / 2 : (u) => u.x > W / 2;
    const nearBase = side === 'player' ? (u) => u.x < 420 : (u) => u.x > W - 420;
    const pressure = theirs.filter(nearBase).length;
    // Priority list; entries marked "save" make the NPC hold its gold instead of training when unaffordable.
    const choices = [];
    if (p.xp >= sim.evolveXp(p.era) && p.era < (game.mode === 'franchise' ? 4 : ERA_NAMES.length - 1)) choices.push(['evolve']);
    if (theirs.filter(ownHalf).length >= 3) choices.push(['ability', 'special']);
    if (pressure >= 2 && p.turrets.length < MAX_TURRETS) choices.push(['turret', 'near']);
    if (p.castleHp < p.castleMaxHp * 0.5) choices.push(['upgrade', 'walls', true]);
    // Early workers pay for themselves quickly; keep a couple more once the base is safe.
    if (workers < Math.min(MAX_WORKERS, b.elapsed < 60 ? 2 : 4) && pressure === 0) choices.push(['train', 'worker']);
    if (pressure === 0 && p.economyLevel < 3 && b.elapsed < 90) choices.push(['upgrade', 'economy', true]);
    if (p.turrets.length < Math.min(MAX_TURRETS, 1 + Math.floor(b.elapsed / 75)) && b.elapsed > 30) choices.push(['turret', nextTurret, true]);
    if (!hasHero && b.elapsed > 45 && mine.length >= 3) choices.push(['train', 'hero', true]);
    // Counter the opponent's most common role; otherwise keep a mixed army.
    const counts = Object.fromEntries(ROLES.map(r => [r, theirs.filter(u => u.role === r).length]));
    const dominant = ROLES.reduce((a, r) => (counts[r] > counts[a] ? r : a), 'melee');
    const wanted = theirs.length ? COUNTERED_BY[dominant] : ROLES[mine.length % ROLES.length];
    if (p.queue.length < 3) choices.push(['train', wanted]);
    if (mine.length >= 5 && theirs.length >= 3) choices.push(['ability', 'rally']);
    if (b.elapsed > 20 && p.economyLevel < 4 + p.era) choices.push(['upgrade', 'economy', true]);
    if (p.queue.length < MAX_QUEUE) choices.push(['train', ROLES[(mine.length + 1) % ROLES.length]]);
    for (const [action, key, save] of choices) {
      try { engine.act(side, action, key); break; } catch {
        if (save && mine.length + p.queue.length >= 3 && pressure < 2) break;
      }
    }
  }
}
function tick(game, now = Date.now()) {
  if (game.gameOver || now <= game.lastTickAt) return false;
  // Bound catch-up after a suspended room; do not simulate hours of missed combat.
  let remaining = Math.min((now - game.lastTickAt) / 1000, 1);
  game.lastTickAt = now;
  const engine = simulation(game.battle);
  while (remaining > 0 && game.battle.running) {
    const dt = Math.min(remaining, 0.05);
    engine.update(dt); remaining -= dt;
    if (game.battle.running && game.battle.elapsed >= game.nextNpcAt) {
      npcTurn(game, engine); game.nextNpcAt = game.battle.elapsed + 1.5;
      engine.update(0);
    }
  }
  finish(game);
  return true;
}
function serialize(game, requesterId) {
  const me = game.players.find(p => p.id === requesterId);
  const side = me?.side || 'player', other = side === 'player' ? 'enemy' : 'player';
  const b = game.battle;
  const flip = side === 'enemy';
  const fx = (x) => (flip ? W - x : x);
  const relSide = (s) => (s === side ? 'player' : 'enemy');
  const battle = {
    elapsed: b.elapsed, running: b.running, mode: game.mode, franchise: game.franchise, gold: b[side].gold, xp: b[side].xp,
    player: structuredClone(b[side]), enemy: structuredClone(b[other]),
    units: b.units.map(u => ({ ...u, target: null, side: relSide(u.side), x: fx(u.x), dir: flip ? -u.dir : u.dir })),
    effects: b.effects.map(e => ({
      ...e, side: e.side ? relSide(e.side) : undefined,
      x: e.x != null ? fx(e.x) : undefined, x1: e.x1 != null ? fx(e.x1) : undefined, x2: e.x2 != null ? fx(e.x2) : undefined
    }))
  };
  return {
    kind: meta.key, matchId: game.matchId, players: game.players,
    playerId: me?.id, opponentName: game.players.find(p => p.side === other).name,
    canAct: Boolean(me && !me.isNpc && !game.gameOver), battle,
    mode: game.mode, franchise: game.franchise,
    content: game.mode === 'franchise' ? { player: contentFor(game.franchise, b[side].faction, b[side].era), enemy: contentFor(game.franchise, b[other].faction, b[other].era), maxStage: 4, franchiseName: FRANCHISES[game.franchise].name } : null,
    era: b[side].era, eraName: game.mode === 'franchise' ? contentFor(game.franchise, b[side].faction, b[side].era).stage : ERA_NAMES[b[side].era],
    elapsedServerMs: Math.round(b.elapsed * 1000),
    gameOver: game.gameOver, winnerId: game.winnerId, won: Boolean(me && game.winnerId === me.id),
    survivedMs: game.survivedMs, resultText: game.resultText
  };
}
function results(game) {
  return game.players.map(p => ({
    playerId: p.id, placement: p.id === game.winnerId ? 1 : 2,
    score: Math.round(game.survivedMs / 1000), won: p.id === game.winnerId,
    outcome: game.resultText, durationMs: game.survivedMs, moves: game.battle[p.side].era
  }));
}
module.exports = { meta, createGame, handleAction, serialize, results, tick, normalizeRoomOptions, FRANCHISES, ERA_NAMES, ROLE_DEFS };
