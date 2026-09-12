const test = require('node:test');
const assert = require('node:assert/strict');
const ks = require('../games/kasteel-strijd/server');
const sim = require('../games/kasteel-strijd/simulation');
const { simulation } = sim;
const players = (npc = false) => [{ id: 'p1', name: 'Ada' }, { id: 'p2', name: 'Bob', isNpc: npc }];
const T0 = 1_000_000;
function advance(game, seconds) {
  for (let i = 0; i < Math.round(seconds * 10); i++) ks.tick(game, game.lastTickAt + 100);
}
// Koopt en traint een eenheid onmiddellijk, zonder dat de tijd verstrijkt.
function spawn(state, engine, side, role) {
  engine.act(side, 'train', role); state[side].trainT = 99; engine.update(0);
  return state.units.at(-1);
}

test('createGame vereist twee spelers en start beide legers gelijk in de Prehistorie', () => {
  assert.throws(() => ks.createGame(players().slice(0, 1)), /precies twee/);
  assert.throws(() => ks.createGame([...players(), { id: 'p3' }]), /precies twee/);
  const game = ks.createGame(players(), T0);
  assert.equal(ks.meta.name, 'Castle Defense');
  assert.equal(ks.meta.solo, false);
  assert.equal(ks.meta.supportsNpc, true);
  assert.equal(game.startedAt, T0);
  assert.equal(game.gameOver, false);
  assert.ok(game.matchId);
  assert.deepEqual(game.battle.player, game.battle.enemy);
  assert.equal(game.battle.player.era, 0);
  assert.equal(game.battle.units.length, 0, 'troepen verschijnen niet vanzelf');
});

test('troepen worden gekocht, getraind in volgorde en verschijnen aan de eigen basis', () => {
  const game = ks.createGame(players(), T0);
  ks.handleAction(game, 'p1', 'train', { key: 'melee' });
  ks.handleAction(game, 'p1', 'train', { key: 'heavy' });
  assert.equal(game.battle.player.gold, 120 - 25 - 90);
  assert.deepEqual(game.battle.player.queue, ['melee', 'heavy']);
  assert.throws(() => ks.handleAction(game, 'p1', 'train', { key: 'heavy' }), /goud/);
  assert.throws(() => ks.handleAction(game, 'p1', 'train', { key: 'dragon' }), /Onbekende eenheid/);
  advance(game, 1.9);
  assert.equal(game.battle.units.length, 1);
  assert.equal(game.battle.units[0].role, 'melee');
  assert.ok(game.battle.units[0].x < 700);
  advance(game, 4.6);
  assert.equal(game.battle.units.length, 2);
  assert.equal(game.battle.units[1].role, 'heavy');
  assert.equal(game.battle.player.queue.length, 0);
  game.battle.enemy.gold = 10000;
  for (let i = 0; i < sim.MAX_QUEUE; i++) ks.handleAction(game, 'p2', 'train', { key: 'melee' });
  assert.throws(() => ks.handleAction(game, 'p2', 'train', { key: 'melee' }), /wachtrij/);
});

test('serialize spiegelt het slagveld voor speler twee en verbergt niets nuttigs', () => {
  const game = ks.createGame(players(), T0);
  ks.handleAction(game, 'p1', 'train', { key: 'melee' });
  advance(game, 4.2);
  const a = ks.serialize(game, 'p1');
  const b = ks.serialize(game, 'p2');
  assert.equal(a.kind, 'kasteel-strijd');
  assert.equal(a.elapsedServerMs, 4200);
  assert.equal(a.matchId, b.matchId);
  assert.deepEqual(a.battle.player, b.battle.enemy);
  assert.equal(a.battle.units.length, 1);
  assert.equal(a.battle.units[0].x + b.battle.units[0].x, 1400);
  assert.equal(a.battle.units[0].side, 'player');
  assert.equal(b.battle.units[0].side, 'enemy');
  assert.equal(a.battle.units[0].dir, -b.battle.units[0].dir);
  assert.equal(typeof a.battle.xp, 'number');
  a.battle.player.gold = -1;
  assert.ok(game.battle.player.gold >= 0);
  assert.equal(ks.serialize(game, 'spectator').canAct, false);
  assert.doesNotThrow(() => JSON.stringify(game));
});

test('steen-papier-schaar: infanterie doet extra schade aan schutters, niet aan zwaar', () => {
  const state = sim.createState();
  const engine = simulation(state);
  state.player.gold = state.enemy.gold = 10000;
  const melee = spawn(state, engine, 'player', 'melee');
  const ranged = spawn(state, engine, 'enemy', 'ranged');
  const heavy = spawn(state, engine, 'enemy', 'heavy');
  const hit = (target) => {
    state.units = [melee, target];
    melee.x = 700; target.x = 705; melee.atkCd = 0; target.atkCd = 5; target.hp = target.maxHp;
    engine.update(0.01);
    return target.maxHp - target.hp;
  };
  assert.equal(hit(ranged), 9);
  assert.equal(hit(heavy), 6);
});

test('een gedode vijand levert goud en XP op aan de winnaar', () => {
  const state = sim.createState();
  const engine = simulation(state);
  state.player.gold = state.enemy.gold = 1000;
  const attacker = spawn(state, engine, 'player', 'heavy');
  const victim = spawn(state, engine, 'enemy', 'melee');
  attacker.x = 700; victim.x = 701; attacker.atkCd = 0; victim.hp = 1; victim.atkCd = 5;
  const gold = state.player.gold, xp = state.player.xp;
  engine.update(0.01);
  assert.ok(victim.dead);
  assert.equal(state.player.kills, 1);
  assert.equal(Math.round(state.player.gold - gold), 10);
  assert.ok(state.player.xp - xp >= 4);
});

test('torens kosten goud, zijn beperkt tot drie en schieten op vijanden bij de basis', () => {
  const game = ks.createGame(players(), T0);
  const b = game.battle;
  b.player.gold = 5000;
  assert.throws(() => ks.handleAction(game, 'p1', 'turret', { key: 'laser' }), /torentype/);
  ks.handleAction(game, 'p1', 'turret', { key: 'near' });
  assert.equal(b.player.turrets.length, 1);
  assert.equal(b.player.turrets[0].type, 'near');
  assert.equal(b.player.gold, 5000 - 120);
  ks.handleAction(game, 'p1', 'turret', { key: 'far' }); ks.handleAction(game, 'p1', 'turret', { key: 'bonus' });
  assert.throws(() => ks.handleAction(game, 'p1', 'turret', { key: 'near' }), /bezet/);
  b.enemy.gold = 1000;
  ks.handleAction(game, 'p2', 'train', { key: 'melee' });
  advance(game, 2);
  const intruder = b.units.find(u => u.side === 'enemy');
  intruder.x = 300;
  const hp = intruder.hp;
  let shots = 0;
  for (let i = 0; i < 10; i++) { ks.tick(game, game.lastTickAt + 100); shots += b.effects.filter(e => e.kind === 'shot').length; }
  assert.ok(intruder.hp < hp, 'toren raakt een vijand binnen bereik');
  assert.ok(shots > 0, 'torenschoten zijn zichtbaar als effect');
});

test('muren en economie zijn upgrades per leger; evolueren vereist XP en versterkt de eigen basis', () => {
  const game = ks.createGame(players(), T0);
  const b = game.battle;
  b.player.gold = 1000;
  ks.handleAction(game, 'p1', 'upgrade', { key: 'walls' });
  assert.equal(b.player.wallsLevel, 2);
  assert.equal(b.player.castleMaxHp, 1020);
  assert.equal(b.player.castleHp, 1020);
  ks.handleAction(game, 'p1', 'upgrade', { key: 'economy' });
  assert.equal(b.player.economyLevel, 2);
  assert.equal(b.enemy.economyLevel, 1);
  assert.throws(() => ks.handleAction(game, 'p1', 'upgrade', { key: '__proto__' }), /Onbekende upgrade/);
  assert.throws(() => ks.handleAction(game, 'p1', 'evolve'), /nog niet/);
  b.player.xp = 120; b.player.castleHp = 400; b.enemy.castleHp = 123;
  ks.handleAction(game, 'p1', 'evolve');
  assert.equal(b.player.era, 1);
  assert.equal(b.player.xp, 0);
  assert.equal(b.player.wallsLevel, 2, 'niveaus blijven behouden');
  assert.equal(b.player.castleMaxHp, sim.castleMaxHp(2, 1));
  assert.ok(b.player.castleHp > 400 && b.player.castleHp <= b.player.castleMaxHp);
  assert.equal(b.enemy.era, 0);
  assert.equal(b.enemy.castleHp, 123);
  ks.handleAction(game, 'p1', 'train', { key: 'melee' });
  assert.equal(b.player.gold, 1000 - 80 - 70 - sim.unitCost('melee', 1));
  advance(game, 2);
  assert.equal(b.units.find(u => u.side === 'player').era, 1);
});

test('alleen deelnemers kunnen acties sturen; clients kunnen geen uitslag of restart claimen', () => {
  const game = ks.createGame(players(true), T0);
  for (const id of ['stranger', 'p2']) assert.throws(() => ks.handleAction(game, id, 'evolve'), /Niet jouw spel/);
  for (const action of ['finish', 'restart']) assert.throws(() => ks.handleAction(game, 'p1', action, { won: true, elapsedMs: 999999 }), /Onbekende actie/);
});

test('oorlogskreet en ultieme aanval kosten goud, respecteren de cooldown en raken enkel vijandelijk terrein', () => {
  const game = ks.createGame(players(), T0);
  const b = game.battle;
  b.player.gold = b.enemy.gold = 5000;
  ks.handleAction(game, 'p1', 'ability', { key: 'rally' });
  assert.equal(b.player.gold, 5000 - 60);
  assert.ok(b.player.rallyUntil > 0);
  assert.throws(() => ks.handleAction(game, 'p1', 'ability', { key: 'rally' }), /beschikbaar/);
  assert.throws(() => ks.handleAction(game, 'p1', 'ability', { key: 'nuke' }), /Onbekende vaardigheid/);
  ks.handleAction(game, 'p2', 'train', { key: 'melee' }); ks.handleAction(game, 'p2', 'train', { key: 'melee' });
  ks.handleAction(game, 'p1', 'train', { key: 'melee' });
  advance(game, 4);
  const [far, near] = b.units.filter(u => u.side === 'enemy');
  const own = b.units.find(u => u.side === 'player');
  far.x = 1100; near.x = 500; own.x = 900;
  const castle = b.enemy.castleHp;
  ks.handleAction(game, 'p1', 'ability', { key: 'special' });
  assert.ok(far.dead, 'vijanden op vijandelijk terrein worden geraakt');
  assert.ok(!near.dead, 'vijanden op eigen terrein blijven gespaard');
  assert.ok(!own.dead, 'eigen troepen blijven gespaard');
  assert.ok(b.enemy.castleHp < castle);
  assert.equal(b.player.cooldowns.special, 45);
  advance(game, 1);
  assert.ok(b.player.cooldowns.special < 45);
});

test('gevallen basis sluit precies eenmaal af met tegengestelde uitslagen en serverduur', () => {
  const game = ks.createGame(players(), T0);
  advance(game, 90);
  game.battle.player.castleHp = 0;
  ks.tick(game, game.lastTickAt + 100);
  assert.equal(game.gameOver, true);
  assert.equal(game.winnerId, 'p2');
  const duration = game.survivedMs;
  assert.equal(ks.tick(game, game.lastTickAt + 5000), false);
  assert.equal(game.survivedMs, duration);
  assert.equal(ks.serialize(game, 'p1').won, false);
  assert.equal(ks.serialize(game, 'p2').won, true);
  assert.throws(() => ks.handleAction(game, 'p1', 'evolve'), /afgelopen/);
  const [a, b] = ks.results(game);
  assert.equal(a.placement, 2); assert.equal(b.placement, 1);
  assert.equal(b.durationMs, duration); assert.equal(b.score, Math.round(duration / 1000));
  assert.equal(a.won, false); assert.equal(b.won, true);
});

test('NPC investeert legaal en verslaat een passieve tegenstander', () => {
  const game = ks.createGame(players(true), T0);
  advance(game, 4);
  assert.ok(game.battle.enemy.queue.length + game.battle.units.filter(u => u.side === 'enemy').length > 0, 'NPC traint troepen');
  for (let i = 0; i < 6000 && !game.gameOver; i++) {
    ks.tick(game, game.lastTickAt + 100);
    assert.ok(game.battle.enemy.gold >= 0);
  }
  assert.equal(game.gameOver, true, 'NPC wint binnen tien minuten van een speler die niets doet');
  assert.equal(game.winnerId, 'p2');
  assert.ok(game.battle.enemy.turrets.length > 0, 'NPC spaart voor een toren');
  assert.ok(game.battle.units.some(u => u.side === 'enemy' && u.role === 'worker'), 'NPC zet werkers in');
});

test('twee NPC-legers evolueren allebei en beeindigen het duel binnen de tijd', () => {
  const game = ks.createGame([{ id: 'n1', name: 'A', isNpc: true }, { id: 'n2', name: 'B', isNpc: true }], T0);
  for (let i = 0; i < 12000 && !game.gameOver; i++) ks.tick(game, game.lastTickAt + 100);
  assert.equal(game.gameOver, true, 'een duel tussen gelijke NPC-legers eindigt binnen twintig minuten');
  assert.ok(game.battle.player.era >= 1 && game.battle.enemy.era >= 1, 'beide kanten verzamelen XP en evolueren');
  assert.ok(game.survivedMs > 120000, 'een NPC-duel is geen blitz');
});

test('torentypes: ver schiet verder dan nabij, banier versterkt eigen troepen op eigen helft', () => {
  const state = sim.createState();
  const engine = simulation(state);
  state.player.gold = state.enemy.gold = 100000;
  engine.act('player', 'turret', 'far');
  const intruder = spawn(state, engine, 'enemy', 'heavy');
  intruder.x = 500; // 395 van de basis: buiten bereik van een nabije toren, binnen artilleriebereik
  const hp = intruder.hp;
  for (let i = 0; i < 20; i++) engine.update(0.1);
  assert.ok(intruder.hp < hp, 'artillerie raakt op lange afstand');
  const state2 = sim.createState();
  const engine2 = simulation(state2);
  state2.player.gold = state2.enemy.gold = 100000;
  engine2.act('player', 'turret', 'near');
  const far = spawn(state2, engine2, 'enemy', 'heavy'); far.x = 500;
  const hp2 = far.hp;
  for (let i = 0; i < 20; i++) engine2.update(0.1);
  assert.equal(far.hp, hp2, 'een nabije toren reikt niet zo ver');
  // Banier: +15% schade voor eigen troepen op eigen helft.
  const plain = sim.createState(), boosted = sim.createState();
  for (const [st, banner] of [[plain, false], [boosted, true]]) {
    const en = simulation(st); st.player.gold = st.enemy.gold = 100000;
    if (banner) en.act('player', 'turret', 'bonus');
    const a = spawn(st, en, 'player', 'melee'), v = spawn(st, en, 'enemy', 'heavy');
    a.x = 600; v.x = 605; a.atkCd = 0; v.atkCd = 9; st.units = [a, v];
    en.update(0.01); st.dealt = v.maxHp - v.hp;
  }
  assert.equal(plain.dealt, 6);
  assert.equal(Math.round(boosted.dealt * 10) / 10, 6.9);
});

test('werkers ontginnen goud in het veld, zijn beperkt tot vijf en kunnen gedood worden', () => {
  const game = ks.createGame(players(), T0);
  const b = game.battle;
  b.player.gold = 1000;
  for (let i = 0; i < 3; i++) ks.handleAction(game, 'p1', 'train', { key: 'worker' });
  advance(game, 5);
  for (let i = 3; i < sim.MAX_WORKERS; i++) ks.handleAction(game, 'p1', 'train', { key: 'worker' });
  assert.throws(() => ks.handleAction(game, 'p1', 'train', { key: 'worker' }), /werkers/);
  advance(game, 12);
  const workers = b.units.filter(u => u.role === 'worker');
  assert.equal(workers.length, sim.MAX_WORKERS);
  assert.ok(workers.every(u => Math.abs(u.x - sim.MINE_X_P) <= 4 && u.state === 'mine'), 'werkers staan aan de mijn');
  const before = b.player.gold;
  advance(game, 5);
  const passive = sim.goldRate(1, 0) * 5;
  assert.ok(b.player.gold - before > passive + sim.mineRate(0) * 5 * sim.MAX_WORKERS * 0.9, 'ontginning levert extra goud op');
  // Een vijandelijke aanvaller die langs de mijn komt, valt de werkers aan.
  const raider = spawn(b, simulation(b), 'enemy', 'melee');
  raider.x = sim.MINE_X_P + 40;
  advance(game, 7);
  assert.ok(b.units.filter(u => u.role === 'worker' && !u.dead).length < sim.MAX_WORKERS, 'werkers sneuvelen bij een overval');
  assert.ok(b.enemy.kills >= 1);
});

test('held: één tegelijk, sterk en zonder counter-zwakte', () => {
  const game = ks.createGame(players(), T0);
  const b = game.battle;
  b.player.gold = 10000;
  ks.handleAction(game, 'p1', 'train', { key: 'hero' });
  assert.throws(() => ks.handleAction(game, 'p1', 'train', { key: 'hero' }), /al een held/);
  advance(game, 6.5);
  const hero = b.units.find(u => u.role === 'hero');
  assert.ok(hero && hero.hp === 300);
  assert.throws(() => ks.handleAction(game, 'p1', 'train', { key: 'hero' }), /al een held/);
  const engine = simulation(b);
  const foe = spawn(b, engine, 'enemy', 'melee');
  hero.x = 700; foe.x = 703; hero.atkCd = 0; foe.atkCd = 9; foe.hp = foe.maxHp = 1000; b.units = [hero, foe];
  engine.update(0.01);
  assert.equal(1000 - foe.hp, 24, 'held doet zijn basisschade zonder counterbonus');
  hero.hp = 0; hero.dead = true; hero.deathT = 1;
  advance(game, 0.2);
  ks.handleAction(game, 'p1', 'train', { key: 'hero' });
});

test('schutters worden ingehaald door infanterie en zwaar, zodat ze van achteren blijven schieten', () => {
  const state = sim.createState();
  const engine = simulation(state);
  state.player.gold = state.enemy.gold = 100000;
  const archer = spawn(state, engine, 'player', 'ranged');
  const melee = spawn(state, engine, 'player', 'melee');
  const target = spawn(state, engine, 'enemy', 'heavy');
  archer.x = 600; melee.x = 570; target.x = 760; target.hp = target.maxHp = 100000;
  for (let i = 0; i < 40; i++) engine.update(0.05);
  assert.equal(archer.state, 'fight', 'schutter blijft op afstand schieten');
  assert.ok(melee.x > archer.x + 20, 'infanterie loopt de schutter voorbij');
  // Maar een vechtende infanterist blokkeert wel de rest van de linie.
  const second = spawn(state, engine, 'player', 'melee');
  second.x = melee.x - 40; melee.state = 'fight';
  for (let i = 0; i < 20; i++) engine.update(0.05);
  assert.ok(second.x < melee.x, 'infanterie blijft achter een vechtende bondgenoot');
});

test('engine tekent snapshots van elk tijdperk zonder de serverstaat te wijzigen', async () => {
  const { pathToFileURL } = require('node:url');
  const path = require('node:path');
  const engine = await import(pathToFileURL(path.join(__dirname, '../games/kasteel-strijd/engine.js')).href);
  assert.deepEqual(engine.ERA_NAMES, ks.ERA_NAMES);
  for (const role of sim.ROLES) assert.equal(engine.unitCost(role, 3), sim.unitCost(role, 3));
  assert.equal(engine.evolveXp(2), sim.evolveXp(2));
  assert.equal(engine.costTurret(2, 4), sim.costTurret(2, 4));
  const ctx = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
  const frames = [];
  const previous = global.requestAnimationFrame;
  global.requestAnimationFrame = cb => frames.push(cb);
  try {
    const game = ks.createGame(players(), T0);
    game.battle.player.gold = game.battle.enemy.gold = 100000;
    for (const role of sim.ROLES) { ks.handleAction(game, 'p1', 'train', { key: role }); ks.handleAction(game, 'p2', 'train', { key: role }); }
    ks.handleAction(game, 'p1', 'turret', { key: 'near' }); ks.handleAction(game, 'p1', 'turret', { key: 'far' }); ks.handleAction(game, 'p1', 'turret', { key: 'bonus' });
    ks.handleAction(game, 'p1', 'train', { key: 'hero' }); ks.handleAction(game, 'p1', 'train', { key: 'worker' }); ks.handleAction(game, 'p2', 'train', { key: 'worker' });
    game.battle.player.wallsLevel = 8; game.battle.enemy.wallsLevel = 4;
    ks.handleAction(game, 'p1', 'ability', { key: 'special' });
    advance(game, 18);
    assert.ok(game.battle.units.some(u => u.role === 'hero') && game.battle.units.some(u => u.role === 'worker'));
    const battle = engine.createBattle({ canvas: { isConnected: true, getContext: () => ctx } });
    for (let era = 0; era < ks.ERA_NAMES.length; era++) {
      game.battle.player.era = era; game.battle.enemy.era = (era + 3) % ks.ERA_NAMES.length;
      for (const u of game.battle.units) u.era = u.side === 'player' ? era : game.battle.enemy.era;
      const snapshot = ks.serialize(game, 'p2').battle;
      const before = JSON.stringify(snapshot);
      battle.setState(snapshot); battle.start();
      frames.shift()(0);
      assert.equal(JSON.stringify(snapshot), before);
    }
    battle.stop();
  } finally { global.requestAnimationFrame = previous; }
});
