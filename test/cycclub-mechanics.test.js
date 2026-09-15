'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cc = require('../games/cycclub/server');

function makeRider(overrides = {}) {
  return {
    id: overrides.id || 'r1',
    name: overrides.name || 'Test Rider',
    age: overrides.age ?? 24,
    teamId: 'uae',
    marketValue: 10000,
    stats: {flat: 50, mountain: 50, cobbles: 50, timeTrial: 50, sprint: 50, stamina: 50},
    status: 'active',
    statusUntil: 0,
    fatigue: overrides.fatigue ?? 0,
    gelsRemaining: overrides.gelsRemaining ?? cc.GELS_PER_RACE,
    specialism: overrides.specialism || 'allrounder'
  };
}

function makeTeam(shopOverrides = {}) {
  return {shop: {bikes: 0, nutrition: 0, trainers: 0, medical: 0, ...shopOverrides}};
}

function savedCatalogRider(entry) {
  return {
    ...entry,
    marketValue: 10000,
    status: 'active', statusUntil: 0, fatigue: 0, gelsRemaining: cc.GELS_PER_RACE
  };
}

function savedTeam(riders) {
  return {
    wallet: 100000, riders: riders.map(savedCatalogRider),
    shop: {bikes: 0, nutrition: 0, trainers: 0, medical: 0},
    career: {victories: 0, podiums: 0, monumentsWon: 0, grandToursWon: 0, gtStagesWon: 0, prizeMoney: 0, racesEntered: 0},
    raceCount: 0
  };
}

const FLAT_SEGMENT = {segmentIndex: 0, totalSegments: 8, terrainType: 'flat', elevationGain: 20, hasIntermediateSprint: false, mountainCategory: 0};
const MOUNTAIN_SEGMENT = {segmentIndex: 0, totalSegments: 8, terrainType: 'mountain', elevationGain: 900, hasIntermediateSprint: false, mountainCategory: 0};
const SPRINT_SEGMENT = {...FLAT_SEGMENT, segmentIndex: 7, isSprint: true};

// Zet een renner in een bekende energietoestand (groen/rood/positie) voor een segmentberekening.
function withEnergy(rider, {endurance = 100, power = endurance, position = 'middle'} = {}) {
  rider.endurance = endurance;
  rider.power = Math.min(power, endurance);
  rider.position = position;
  return rider;
}

// Speelt één segment als p1: lost een eventuele gebeurtenis op of werpt met de opgegeven tactiek.
function playSegmentAsP1(game, tactic = 'follow') {
  const prog = game.race.progress.p1;
  if (!prog || prog.confirmed) return;
  if (prog.pendingEvent) {
    cc.handleAction(game, 'p1', 'resolveEvent', {choice: prog.pendingEvent.options[0].key});
    return;
  }
  const activeIds = Object.keys(prog.riders).filter((id) => !prog.riders[id].dnf);
  if (!activeIds.length) return;
  const tactics = {};
  for (const id of activeIds) tactics[id] = tactic;
  cc.handleAction(game, 'p1', 'rollSegment', {tactics, gels: {}});
}

test('calculateSegmentStep: climbers are boosted on mountains, sprinters on flat', () => {
  const climber = makeRider({id: 'c1', specialism: 'climber'});
  const sprinter = makeRider({id: 's1', specialism: 'sprinter'});
  const team = makeTeam();
  const tactics = {c1: 'follow', s1: 'follow'};
  const results = cc.calculateSegmentStep([climber, sprinter], tactics, {}, MOUNTAIN_SEGMENT, 10, team);
  assert.ok(results.c1.personalMultiplier > results.s1.personalMultiplier);
});

test('calculateSegmentStep: tactic bonuses are added directly to the dice roll', () => {
  const rider = makeRider({id: 'd1'});
  const follow = cc.calculateSegmentStep([rider], {d1: 'follow'}, {}, FLAT_SEGMENT, 5, makeTeam());
  assert.equal(follow.d1.personalMultiplier, 0.7);
  rider.fatigue=0;
  const attack = cc.calculateSegmentStep([rider], {d1: 'attack'}, {}, FLAT_SEGMENT, 5, makeTeam());
  assert.equal(attack.d1.personalMultiplier, 1);
});

test('race groups are determined by the time gap to the leader', () => {
  assert.equal(cc.raceGroupForGap(0), 'breakaway');
  assert.equal(cc.raceGroupForGap(5), 'breakaway');
  assert.equal(cc.raceGroupForGap(6), 'chasers');
  assert.equal(cc.raceGroupForGap(20), 'chasers');
  assert.equal(cc.raceGroupForGap(21), 'peloton');
  assert.equal(cc.raceGroupForGap(60), 'peloton');
  assert.equal(cc.raceGroupForGap(61), 'tail');
});

test('calculateSegmentStep: the green bar drains per tactic and the red bar is spent or recharged', () => {
  const attacker = makeRider({id: 'a1', fatigue: 20});
  const recoverer = makeRider({id: 'r2', fatigue: 20});
  const team = makeTeam();
  // fatigue 20 → groen 80 en rood 80 bij de start van de rit
  cc.calculateSegmentStep([attacker, recoverer], {a1: 'attack', r2: 'recover'}, {}, FLAT_SEGMENT, 5, team);
  assert.equal(attacker.endurance, 70); // −10 uithouding
  assert.equal(attacker.power, 50); // −30 explosiviteit (inzet Licht)
  assert.equal(attacker.position, 'front');
  assert.equal(recoverer.endurance, 78); // −2 uithouding
  assert.equal(recoverer.power, 78); // +30, maar nooit boven de groene balk
  assert.equal(recoverer.position, 'back');
});

test('calculateSegmentStep: the red bar can never exceed the remaining green bar', () => {
  const rider = withEnergy(makeRider({id: 'cap1'}), {endurance: 40, power: 40});
  cc.calculateSegmentStep([rider], {cap1: 'recover'}, {}, FLAT_SEGMENT, 5, makeTeam());
  assert.equal(rider.endurance, 38);
  assert.equal(rider.power, 38);
});

test('calculateSegmentStep: a gel immediately boosts both bars and consumes one gel', () => {
  const rider = withEnergy(makeRider({id: 'g1', gelsRemaining: 2}), {endurance: 40, power: 10});
  const team = makeTeam();
  cc.calculateSegmentStep([rider], {g1: 'follow'}, {g1: true}, FLAT_SEGMENT, 5, team);
  // gel: groen 40→50, rood 10→35; volg: groen −4 = 46, rood +15 = 50 → begrensd op 46
  assert.equal(rider.endurance, 46);
  assert.equal(rider.power, 46);
  assert.equal(rider.gelsRemaining, 1);
});

test('calculateSegmentStep: fetch_bidons recharges teammates but not itself', () => {
  const bidonRider = withEnergy(makeRider({id: 'b1'}), {endurance: 70, power: 20});
  const teammate = withEnergy(makeRider({id: 't1'}), {endurance: 70, power: 20});
  const team = makeTeam();
  cc.calculateSegmentStep([bidonRider, teammate], {b1: 'fetch_bidons', t1: 'follow'}, {}, FLAT_SEGMENT, 5, team);
  assert.equal(bidonRider.power, 20); // geen eigen boost
  assert.equal(teammate.power, 50); // +15 bidons, +15 volg
  assert.equal(bidonRider.endurance, 64);
});

test('calculateSegmentStep: the position in the group changes energy and follows from the tactic', () => {
  const tail = withEnergy(makeRider({id: 'tail'}), {endurance: 60, power: 20, position: 'back'});
  const front = withEnergy(makeRider({id: 'front'}), {endurance: 60, power: 20, position: 'front'});
  cc.calculateSegmentStep([tail, front], {tail: 'follow', front: 'follow'}, {}, FLAT_SEGMENT, 5, makeTeam());
  assert.equal(tail.endurance, 58); // 4 − 2 (staart spaart)
  assert.equal(tail.power, 40); // +15 volg, +5 staart
  assert.equal(front.endurance, 54); // 4 + 2 (kop in de wind)
  assert.equal(front.power, 35);
  assert.equal(tail.position, 'middle');
  assert.equal(front.position, 'middle');
});

test('calculateSegmentStep: protecting a teammate gives him +2 and crash immunity, costs the helper', () => {
  const helper = makeRider({id: 'h1'});
  const leader = makeRider({id: 'l1'});
  const alone = makeRider({id: 'l2'});
  const team = makeTeam();
  const protectedRun = cc.calculateSegmentStep([helper, leader], {h1: 'protect', l1: 'follow'}, {}, FLAT_SEGMENT, 5, team, {targets: {h1: 'l1'}});
  const aloneRun = cc.calculateSegmentStep([alone], {l2: 'follow'}, {}, FLAT_SEGMENT, 5, team);
  assert.equal(protectedRun.h1.tactic, 'protect');
  assert.equal(protectedRun.l1.protected, true);
  assert.equal(protectedRun.l1.crashImmune, true);
  assert.equal(Math.round((protectedRun.l1.personalMultiplier - aloneRun.l2.personalMultiplier) * 100) / 100, 0.2);
  assert.equal(helper.power, 85);
  // Zonder geldig doelwit valt Bescherm terug op Volg.
  const noTarget = cc.calculateSegmentStep([makeRider({id: 'h2'})], {h2: 'protect'}, {}, FLAT_SEGMENT, 5, team, {targets: {h2: 'h2'}});
  assert.equal(noTarget.h2.tactic, 'follow');
});

test('calculateSegmentStep: a sprint lead-out burns all power and multiplies the sprinter\'s attack', () => {
  const leadout = makeRider({id: 'lo'});
  const sprinter = makeRider({id: 'sp', specialism: 'sprinter'});
  const soloSprinter = makeRider({id: 'sp2', specialism: 'sprinter'});
  const team = makeTeam();
  const withLeadout = cc.calculateSegmentStep([leadout, sprinter], {lo: 'sprint_leadout', sp: 'attack'}, {}, SPRINT_SEGMENT, 5, team, {targets: {lo: 'sp'}});
  const solo = cc.calculateSegmentStep([soloSprinter], {sp2: 'attack'}, {}, SPRINT_SEGMENT, 5, team);
  assert.equal(withLeadout.lo.tactic, 'sprint_leadout');
  assert.equal(leadout.power, 0);
  // aanvalsbonus 5 × 1,6 = 8 → +0,3 op de multiplier tegenover een gewone aanval
  assert.equal(Math.round((withLeadout.sp.personalMultiplier - solo.sp2.personalMultiplier) * 100) / 100, 0.3);
  // Buiten een sprintsegment is een lead-out niet mogelijk.
  const flat = cc.calculateSegmentStep([makeRider({id: 'lo2'}), makeRider({id: 'sp3'})], {lo2: 'sprint_leadout', sp3: 'attack'}, {}, FLAT_SEGMENT, 5, team, {targets: {lo2: 'sp3'}});
  assert.equal(flat.lo2.tactic, 'follow');
});

test('calculateSegmentStep: push your luck scales the attack and can blow the rider up for the rest of the race', () => {
  const team = makeTeam();
  const light = makeRider({id: 'p1'});
  const full = makeRider({id: 'p2'});
  const allIn = makeRider({id: 'p3'});
  const safeRoll = cc.calculateSegmentStep([light, full, allIn], {p1: 'attack', p2: 'attack', p3: 'attack'}, {}, FLAT_SEGMENT, 8, team, {pushes: {p1: 1, p2: 2, p3: 3}});
  assert.equal(safeRoll.p1.push, 1);
  assert.equal(safeRoll.p3.push, 3);
  assert.equal(Math.round((safeRoll.p2.personalMultiplier - safeRoll.p1.personalMultiplier) * 100) / 100, 0.2);
  assert.equal(Math.round((safeRoll.p3.personalMultiplier - safeRoll.p1.personalMultiplier) * 100) / 100, 0.4);
  assert.equal(allIn.power, 40); // 100 − 60
  // Bij worp 2 mislukt inzet Alles en Vol, maar Licht nooit.
  const safe = makeRider({id: 'q1'});
  const boom = makeRider({id: 'q3'});
  const lowRoll = cc.calculateSegmentStep([safe, boom], {q1: 'attack', q3: 'attack'}, {}, FLAT_SEGMENT, 2, team, {pushes: {q1: 1, q3: 3}});
  assert.equal(lowRoll.q1.exploded, false);
  assert.equal(lowRoll.q3.exploded, true);
  assert.ok(lowRoll.q3.personalMultiplier < lowRoll.q1.personalMultiplier);
  assert.equal(boom.power, 0);
  assert.ok(boom.endurance <= cc.BONK_ENDURANCE);
  // Een ontplofte renner zit in de Hongerklop en kan niet meer aanvallen.
  const after = cc.calculateSegmentStep([boom], {q3: 'attack'}, {}, FLAT_SEGMENT, 9, team, {pushes: {q3: 3}});
  assert.equal(after.q3.tactic, 'follow');
  assert.ok(after.q3.personalMultiplier <= 0.5);
  // Te weinig explosiviteit voor de gekozen inzet zakt naar een haalbare inzet.
  const tired = withEnergy(makeRider({id: 't1'}), {endurance: 80, power: 50});
  const downgraded = cc.calculateSegmentStep([tired], {t1: 'attack'}, {}, FLAT_SEGMENT, 8, team, {pushes: {t1: 3}});
  assert.equal(downgraded.t1.push, 2);
});

test('calculateSegmentStep: marking an announced rival pays off only when he really attacks', () => {
  const team = makeTeam();
  const inBreak = makeRider({id: 'm1'});
  const bluffed = makeRider({id: 'm2'});
  const unknown = makeRider({id: 'm3'});
  const results = cc.calculateSegmentStep([inBreak, bluffed, unknown], {m1: 'mark', m2: 'mark', m3: 'mark'}, {}, FLAT_SEGMENT, 5, team,
    {targets: {m1: 'rival-a', m2: 'rival-b', m3: 'rival-z'}, rivalAttacks: {'rival-a': true, 'rival-b': false}});
  assert.equal(results.m1.tactic, 'mark');
  assert.equal(results.m2.tactic, 'mark');
  assert.equal(results.m3.tactic, 'follow');
  assert.equal(Math.round((results.m1.personalMultiplier - results.m2.personalMultiplier) * 100) / 100, 0.4);
  assert.equal(inBreak.power, 75);
  assert.equal(inBreak.position, 'front');
});

test('race events: choices adjust energy immediately and add roll modifiers to the pending roll', () => {
  const riders = [withEnergy(makeRider({id: 'e1', gelsRemaining: 1}), {endurance: 80, power: 60, position: 'back'}), withEnergy(makeRider({id: 'e2'}), {endurance: 80, power: 60, position: 'front'})];
  const prog = {pendingRoll: {roll: 5, tactics: {e1: 'follow', e2: 'follow'}, targets: {}, rollModifiers: {}}, pendingEvent: cc.buildRaceEvent('crosswind', riders), lastEventType: null};
  assert.equal(prog.pendingEvent.options.length, 2);
  cc.applyRaceEvent(prog, riders, 'sit_in');
  assert.equal(prog.pendingEvent, null);
  assert.equal(prog.lastEventType, 'crosswind');
  assert.deepEqual(prog.pendingRoll.rollModifiers, {e1: -2}); // staart −2, kop ongedeerd
  const puncture = {pendingRoll: {roll: 5, tactics: {}, targets: {}, rollModifiers: {}}, pendingEvent: {...cc.buildRaceEvent('puncture', riders), riderId: 'e1'}};
  assert.ok(puncture.pendingEvent.options.some((option) => option.key === 'gel'));
  cc.applyRaceEvent(puncture, riders, 'gel');
  assert.equal(riders[0].gelsRemaining, 0);
  assert.equal(riders[0].power, 50);
  assert.equal(puncture.pendingRoll.rollModifiers.e1, undefined);
  assert.throws(() => cc.applyRaceEvent({pendingEvent: cc.buildRaceEvent('feedzone', riders), pendingRoll: {}}, riders, 'nope'), /Onbekende keuze/);
});

test('rollSegment can pause on an event that must be resolved before the segment closes', () => {
  const {game, player1} = buildGame();
  cc.handleAction(game, 'p1', 'selectRace', {raceId: cc.RACE_CATALOG[0].id});
  const riderIds = player1.team.riders.slice(0, 3).map((rider) => rider.id);
  cc.handleAction(game, 'p1', 'submitLineup', {riderIds});
  const originalRandom = Math.random;
  Math.random = () => 0; // dwingt een gebeurtenis af
  try {
    cc.handleAction(game, 'p1', 'rollSegment', {tactics: Object.fromEntries(riderIds.map((id) => [id, 'follow'])), gels: {}});
  } finally {
    Math.random = originalRandom;
  }
  const prog = game.race.progress.p1;
  assert.ok(prog.pendingEvent, 'er hangt een gebeurtenis');
  assert.equal(prog.confirmed, false);
  const state = cc.serialize(game, 'p1', new Map());
  assert.equal(state.race.myProgress.pendingEvent.title, prog.pendingEvent.title);
  assert.throws(() => cc.handleAction(game, 'p1', 'rollSegment', {tactics: {}, gels: {}}), /vorige worp/);
  cc.handleAction(game, 'p1', 'resolveEvent', {choice: prog.pendingEvent.options[0].key});
  assert.equal(prog.pendingEvent, null);
  assert.equal(prog.confirmed, true);
  assert.ok(prog.lastEvent.title);
});

test('rollSegment validates team targets, sprint lead-outs and announced rivals', () => {
  const {game, player1} = buildGame();
  cc.handleAction(game, 'p1', 'selectRace', {raceId: cc.RACE_CATALOG[0].id});
  const riderIds = player1.team.riders.slice(0, 3).map((rider) => rider.id);
  cc.handleAction(game, 'p1', 'submitLineup', {riderIds});
  const [a, b, c] = riderIds;
  const base = {[b]: 'follow', [c]: 'follow'};
  assert.throws(() => cc.handleAction(game, 'p1', 'rollSegment', {tactics: {...base, [a]: 'protect'}, targets: {[a]: a}}), /ploeggenoot/);
  assert.throws(() => cc.handleAction(game, 'p1', 'rollSegment', {tactics: {...base, [a]: 'mark'}, targets: {[a]: 'niemand'}}), /aangekondigde/);
  if (!cc.isSprintSegment(game.race.segments[0])) {
    assert.throws(() => cc.handleAction(game, 'p1', 'rollSegment', {tactics: {...base, [a]: 'sprint_leadout'}, targets: {[a]: b}}), /sprintsegment/);
  }
  const state = cc.serialize(game, 'p1', new Map());
  assert.ok(Array.isArray(state.race.hints));
  assert.ok(state.race.hints.length >= 1 && state.race.hints.length <= 2);
  assert.equal(state.race.hints.some((hint) => 'willAttack' in hint), false, 'de betrouwbaarheid blijft verborgen');
  assert.equal(state.race.tacticOptions.length, cc.RIDER_TACTICS.length);
  assert.equal(state.race.myProgress.riders[a].endurance, 100);
  assert.equal(state.race.myProgress.riders[a].position, 'middle');
});

test('after a race the green bar becomes lasting fatigue and the in-race energy fields disappear', () => {
  const {game, player1} = buildGame();
  cc.handleAction(game, 'p1', 'selectRace', {raceId: cc.RACE_CATALOG[0].id});
  const riderIds = player1.team.riders.slice(0, 3).map((rider) => rider.id);
  cc.handleAction(game, 'p1', 'submitLineup', {riderIds});
  let fakeNow = Date.now();
  let guard = 0;
  while (game.phase === 'racing' && guard < 200) {
    guard += 1;
    fakeNow += 1000;
    playSegmentAsP1(game, 'recover');
    cc.tick(game, fakeNow);
  }
  assert.equal(game.phase, 'result');
  for (const rider of player1.team.riders) {
    assert.equal('endurance' in rider, false);
    assert.equal('power' in rider, false);
    assert.equal('position' in rider, false);
  }
  const raced = player1.team.riders.filter((rider) => riderIds.includes(rider.id) && rider.status === 'active');
  for (const rider of raced) assert.ok(rider.fatigue >= 22 && rider.fatigue <= 60, `vermoeidheid ${rider.fatigue}`);
});

test('calculateSegmentStep: leadout grants a draft bonus to teammates who follow', () => {
  const leader = makeRider({id: 'l1'});
  const followerWithLeadout = makeRider({id: 'f1'});
  const followerAlone = makeRider({id: 'f2'});
  const team = makeTeam();
  const withLeadout = cc.calculateSegmentStep([leader, followerWithLeadout], {l1: 'leadout', f1: 'follow'}, {}, FLAT_SEGMENT, 10, team);
  const withoutLeadout = cc.calculateSegmentStep([followerAlone], {f2: 'follow'}, {}, FLAT_SEGMENT, 10, team);
  assert.ok(withLeadout.f1.personalMultiplier > withoutLeadout.f2.personalMultiplier);
});

test('calculateSegmentStep: bonked riders (green bar <= 10) cannot attack or lead out and are capped', () => {
  const bonked = makeRider({id: 'bk1', fatigue: 95});
  const team = makeTeam();
  const results = cc.calculateSegmentStep([bonked], {bk1: 'attack'}, {}, FLAT_SEGMENT, 10, team);
  assert.equal(results.bk1.tactic, 'follow');
  assert.equal(results.bk1.bonked, true);
  assert.ok(results.bk1.personalMultiplier <= 0.5);
});

test('buildSegmentPlan: produces the expected number of segments with valid terrain types and at most one intermediate sprint', () => {
  const catalogRace = {terrain: {mountain: 0.6, stamina: 0.4}};
  const plan = cc.buildSegmentPlan(catalogRace);
  assert.equal(plan.length, cc.SEGMENTS_PER_RACE);
  const validTypes = new Set(['flat', 'hills', 'mountain', 'cobbles', 'timeTrial']);
  for (const segment of plan) assert.ok(validTypes.has(segment.terrainType));
  assert.ok(plan.filter((segment) => segment.hasIntermediateSprint).length <= 1);
  const mountainCats = plan.filter((segment) => segment.terrainType === 'mountain').map((segment) => segment.mountainCategory);
  assert.ok(mountainCats.every((cat) => cat >= 1 && cat <= 4));
  for (const segment of plan) {
    if (segment.hasIntermediateSprint) assert.equal(segment.isSprint, true);
    if (segment.isSprint) assert.ok(['flat', 'hills', 'cobbles'].includes(segment.terrainType));
  }
});

test('hydrating a team saved before gelsRemaining existed defaults it to a full ration, not NaN/undefined', () => {
  const oldSavedTeam = {
    wallet: 50000,
    riders: [{
      id: 'old1', name: 'Old Rider', age: 28, teamId: 'uae', marketValue: 20000,
      stats: {flat: 60, mountain: 60, cobbles: 60, timeTrial: 60, sprint: 60, stamina: 60},
      status: 'active', statusUntil: 0, fatigue: 15, specialism: 'climber'
      // no gelsRemaining field, as in a save from before this feature shipped
    }],
    shop: {bikes: 1, nutrition: 0, trainers: 0, medical: 0},
    career: {victories: 0, podiums: 0, monumentsWon: 0, grandToursWon: 0, gtStagesWon: 0, prizeMoney: 0, racesEntered: 0},
    raceCount: 3
  };
  const roomPlayers = [{id: 'p1', name: 'Alice', isNpc: false, cycclubTeam: oldSavedTeam}, {id: 'p2', name: 'Bot', isNpc: true}];
  const game = cc.createGame(roomPlayers);
  const rider = game.players.find((player) => player.id === 'p1').team.riders[0];
  assert.equal(rider.gelsRemaining, cc.GELS_PER_RACE);
  assert.equal(rider.fatigue, 15);
});

test('rider ownership is unique across human rosters and scout markets', () => {
  const shared = cc.RIDER_CATALOG[0];
  const game = cc.createGame([
    {id: 'p1', name: 'Alice', isNpc: false, cycclubTeam: savedTeam([shared])},
    {id: 'p2', name: 'Bob', isNpc: false, cycclubTeam: savedTeam([shared])}
  ]);
  assert.deepEqual(game.players[0].team.riders.map((rider) => rider.id), [shared.id]);
  assert.deepEqual(game.players[1].team.riders, []);
  for (const market of Object.values(game.scoutMarkets)) {
    assert.equal(market.some((rider) => rider.id === shared.id), false);
  }
  game.scoutMarkets.p2=[savedCatalogRider(shared)];
  assert.throws(() => cc.handleAction(game, 'p2', 'buyRider', {candidateId: shared.id}), /andere ploeg/);
});

test('catalog rider prices preserve their order and span 10,000 to 250,000 euros', () => {
  const priced = cc.RIDER_CATALOG.filter((rider) => !rider.retired).map((rider) => ({
    rider,
    price: cc.marketValueFor(rider.stats, rider.age)
  }));
  assert.equal(Math.min(...priced.map(({price}) => price)), cc.MIN_RIDER_PRICE);
  assert.equal(Math.max(...priced.map(({price}) => price)), cc.MAX_RIDER_PRICE);
  assert.ok(priced.every(({price}) => price % 50 === 0));

  const averageStats = ({rider}) => cc.STAT_KEYS.reduce((sum, key) => sum + rider.stats[key], 0) / cc.STAT_KEYS.length;
  const ordered = priced.slice().sort((a, b) => averageStats(a) - averageStats(b));
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(ordered[index].price >= ordered[index - 1].price);
  }
});

test('resetting progress grants five cheap random riders with four specialisms', () => {
  const active = cc.RIDER_CATALOG.filter((rider) => !rider.retired)
    .sort((a, b) => cc.marketValueFor(a.stats, a.age) - cc.marketValueFor(b.stats, b.age) || a.id.localeCompare(b.id));
  const cheapestIds = new Set(active.slice(0, Math.ceil(active.length * cc.RESET_STARTER_POOL_FRACTION)).map((rider) => rider.id));
  const claimedByBob = active[0];
  const game = cc.createGame([
    {id: 'p1', name: 'Alice', isNpc: false},
    {id: 'p2', name: 'Bob', isNpc: false, cycclubTeam: savedTeam([claimedByBob])}
  ]);

  cc.handleAction(game, 'p1', 'resetTeam');
  const starters = game.players.find((player) => player.id === 'p1').team.riders;
  const available = active.filter((rider) => rider.id !== claimedByBob.id);
  const allowedIds = new Set(cheapestIds);
  for (const specialism of new Set(available.map((rider) => rider.specialism))) {
    allowedIds.add(available.find((rider) => rider.specialism === specialism).id);
  }
  assert.equal(starters.length, cc.RESET_STARTER_COUNT);
  assert.equal(new Set(starters.map((rider) => rider.id)).size, cc.RESET_STARTER_COUNT);
  assert.ok(starters.every((rider) => allowedIds.has(rider.id)));
  assert.ok(new Set(starters.map((rider) => rider.specialism)).size >= cc.RESET_STARTER_MIN_SPECIALISMS);
  assert.equal(starters.some((rider) => rider.id === claimedByBob.id), false);
});

test('a race contains 30 unique riders and NPC fill respects its pool and all human ownership', () => {
  const race = cc.RACE_CATALOG[0];
  const pool = cc.RACE_POOLS.get(race.id);
  const owned = pool.slice(0, 4).map((id) => cc.RIDER_BY_ID.get(id));
  const game = cc.createGame([{id: 'p1', name: 'Alice', isNpc: false, cycclubTeam: savedTeam(owned)}]);
  cc.handleAction(game, 'p1', 'selectRace', {raceId: race.id});
  cc.handleAction(game, 'p1', 'submitLineup', {riderIds: owned.slice(0, 3).map((rider) => rider.id)});

  const humanIds = game.race.lineups.p1;
  const npcIds = game.race.lineups.__race_npcs__;
  const allIds = [...humanIds, ...npcIds];
  assert.equal(allIds.length, cc.RACE_FIELD_SIZE);
  assert.equal(new Set(allIds).size, cc.RACE_FIELD_SIZE);
  assert.equal(npcIds.includes(owned[3].id), false, 'ook een niet-ingeschreven human-owned renner is uitgesloten');
  assert.ok(npcIds.every((id) => pool.includes(id)));
  for (const id of npcIds) assert.deepEqual(game.race.npcPlayer.team.riders.find((rider) => rider.id === id).stats, cc.RIDER_BY_ID.get(id).stats);
});

test('every configured race pool has exactly 50 unique catalog rider IDs', () => {
  for (const [raceId, pool] of cc.RACE_POOLS) {
    assert.equal(pool.length, 50, raceId);
    assert.equal(new Set(pool).size, 50, raceId);
    assert.ok(pool.every((id) => cc.RIDER_BY_ID.has(id)), raceId);
  }
});

function buildGame() {
  const roomPlayers = [{id: 'p1', name: 'Alice', isNpc: false}, {id: 'p2', name: 'Bot', isNpc: true}];
  const game = cc.createGame(roomPlayers);
  const player1 = game.players.find((player) => player.id === 'p1');
  player1.team.riders = cc.REAL_RIDERS.slice(0, 6).map((entry, index) => makeRider({
    id: `real${index}`, name: entry.name, specialism: entry.specialism
  }));
  return {game, player1};
}

test('rollSegment requires a tactic for every active rider before it is accepted', () => {
  const {game, player1} = buildGame();
  cc.handleAction(game, 'p1', 'selectRace', {raceId: cc.RACE_CATALOG[0].id});
  const riderIds = player1.team.riders.slice(0, 3).map((rider) => rider.id);
  cc.handleAction(game, 'p1', 'submitLineup', {riderIds});
  assert.equal(game.phase, 'racing');
  assert.throws(() => cc.handleAction(game, 'p1', 'rollSegment', {tactics: {}, gels: {}}), /tactiek/);
});

test('a full one-day race resolves to a one_day result via rollSegment', () => {
  const {game, player1} = buildGame();
  cc.handleAction(game, 'p1', 'selectRace', {raceId: cc.RACE_CATALOG[0].id});
  const riderIds = player1.team.riders.slice(0, 3).map((rider) => rider.id);
  cc.handleAction(game, 'p1', 'submitLineup', {riderIds});
  let fakeNow = Date.now();
  let guard = 0;
  while (game.phase === 'racing' && guard < 200) {
    guard += 1;
    fakeNow += 1000;
    playSegmentAsP1(game);
    cc.tick(game, fakeNow);
  }
  assert.equal(game.phase, 'result');
  assert.equal(game.lastResult.type, 'one_day');
  assert.ok(game.lastResult.classification.length > 0);
});

test('a full grand tour produces all five classifications', () => {
  const {game, player1} = buildGame();
  cc.handleAction(game, 'p1', 'selectRace', {raceId: cc.GRAND_TOUR_CATALOG[0].id});
  let fakeNow = Date.now();
  let guard = 0;
  while (game.phase !== 'result' && guard < 5000) {
    guard += 1;
    fakeNow += 1000;
    if (game.phase === 'lineup' && game.race.lineups.p1 === undefined) {
      const riderIds = player1.team.riders.filter((rider) => rider.status === 'active').slice(0, 3).map((rider) => rider.id);
      cc.handleAction(game, 'p1', 'submitLineup', {riderIds});
    } else if (game.phase === 'racing') {
      playSegmentAsP1(game);
    } else if (game.phase === 'stageResult') {
      cc.handleAction(game, 'p1', 'nextStage', {});
    }
    cc.tick(game, fakeNow);
  }
  assert.equal(game.phase, 'result');
  assert.equal(game.lastResult.type, 'grand_tour_final');
  const c = game.lastResult.classifications;
  for (const key of ['gc', 'green', 'polka', 'youth', 'team']) assert.ok(Array.isArray(c[key]));
  assert.ok(c.gc.length > 0);
});

test('every stage race lasts between 5 and 8 stages and has its own 50-rider pool', () => {
  assert.equal(cc.STAGE_RACE_CATALOG.length, 10);
  for (const race of cc.STAGE_RACE_CATALOG) {
    assert.equal(race.category, 'stage_race');
    assert.ok(race.stages >= 5 && race.stages <= 8, `${race.id} heeft ${race.stages} ritten`);
    assert.equal(race.route.length, race.stages);
    assert.ok(race.overallPrize > 0);
    const pool = cc.RACE_POOLS.get(race.id);
    assert.equal(pool.length, 50);
    assert.equal(new Set(pool).size, 50);
    for (const riderId of pool) assert.ok(cc.RIDER_BY_ID.has(riderId), `onbekende renner ${riderId}`);
  }
});

test('a stage race runs to a final classification and counts as a stage-race win', () => {
  const {game, player1} = buildGame();
  const race = cc.STAGE_RACE_CATALOG.find((entry) => entry.stages === 5);
  cc.handleAction(game, 'p1', 'selectRace', {raceId: race.id});
  let fakeNow = Date.now();
  let guard = 0;
  let stagesSeen = 0;
  while (game.phase !== 'result' && guard < 5000) {
    guard += 1;
    fakeNow += 1000;
    if (game.phase === 'lineup' && game.race.lineups.p1 === undefined) {
      const riderIds = player1.team.riders.filter((rider) => rider.status === 'active').slice(0, 3).map((rider) => rider.id);
      cc.handleAction(game, 'p1', 'submitLineup', {riderIds});
    } else if (game.phase === 'racing') {
      playSegmentAsP1(game);
    } else if (game.phase === 'stageResult') {
      stagesSeen += 1;
      cc.handleAction(game, 'p1', 'nextStage', {});
    }
    cc.tick(game, fakeNow);
  }
  assert.equal(game.phase, 'result');
  assert.equal(game.lastResult.type, 'grand_tour_final');
  assert.equal(game.lastResult.totalStages, race.stages);
  assert.equal(stagesSeen, race.stages - 1);
  assert.ok(game.lastResult.classifications.gc.length > 0);
  // Een rittenkoerszege telt niet mee als Grote Ronde-zege.
  const gcWinner = game.lastResult.gc[0];
  if (gcWinner && gcWinner.playerId === 'p1') {
    assert.equal(player1.team.career.stageRacesWon, 1);
    assert.equal(player1.team.career.grandToursWon, 0);
  }
});

test('the honours board compares every player on race wins and jerseys', () => {
  const {game, player1} = buildGame();
  player1.team.career.raceWins = {'parijs-roubaix': 2, 'parijs-nice': 1};
  player1.team.career.jerseys = {gc: 3, green: 1, polka: 0, youth: 2, team: 1};
  const state = cc.serialize(game, 'p1', new Map());
  assert.deepEqual(state.jerseyKeys, ['gc', 'green', 'polka', 'youth', 'team']);
  const alice = state.honours.find((entry) => entry.name === 'Alice');
  assert.equal(alice.raceWins['parijs-roubaix'], 2);
  assert.equal(alice.totalWins, 3);
  assert.equal(alice.totalJerseys, 7);
  // Elke speler in de room staat erop, ook wie nog niets won.
  const bot = state.honours.find((entry) => entry.name === 'Bot');
  assert.equal(bot.totalWins, 0);
  assert.deepEqual(bot.jerseys, {gc: 0, green: 0, polka: 0, youth: 0, team: 0});
  // De erelijst hoort bij de clubfase; tijdens een koers hoeft ze niet mee.
  cc.handleAction(game, 'p1', 'selectRace', {raceId: cc.RACE_CATALOG[0].id});
  assert.equal(cc.serialize(game, 'p1', new Map()).honours, null);
});

test('a career saved before the honours board existed hydrates without wins or jerseys', () => {
  const roomPlayers = [{
    id: 'p1', name: 'Alice', isNpc: false, userId: 7,
    cycclubTeam: savedTeam(cc.REAL_RIDERS.slice(0, 3))
  }];
  const game = cc.createGame(roomPlayers);
  const career = game.players[0].team.career;
  assert.deepEqual(career.raceWins, {});
  assert.deepEqual(career.jerseys, {gc: 0, green: 0, polka: 0, youth: 0, team: 0});
  const alice = cc.serialize(game, 'p1', new Map()).honours.find((entry) => entry.name === 'Alice');
  assert.equal(alice.totalWins, 0);
});

test('a CycClub race is only recorded with at least two human players', () => {
  const recorded = [];
  const db = {
    saveCycClubTeam() {},
    recordMatch(match) { recorded.push(match); }
  };
  const makeRoom = (players) => ({
    id: 'cycclub-ranked-check',
    players,
    gameState: {
      players: players.map((player) => ({id: player.id, team: {}})),
      pendingRoundRecord: {
        startedAt: 100,
        endedAt: 200,
        players: players.map((player, index) => ({
          playerId: player.id, placement: index + 1, won: index === 0
        }))
      }
    }
  });

  cc.afterStateChange(makeRoom([
    {id: 'p1', name: 'Alice', userId: 1, isNpc: false},
    {id: 'bot', name: 'Bot', userId: null, isNpc: true}
  ]), {db});
  assert.equal(recorded.length, 0);

  cc.afterStateChange(makeRoom([
    {id: 'p1', name: 'Alice', userId: 1, isNpc: false},
    {id: 'p2', name: 'Bob', userId: 2, isNpc: false}
  ]), {db});
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].players[0].won, true);
});

test('finishing a stage race records the win per race and hands out the five jerseys', () => {
  const {game, player1} = buildGame();
  const race = cc.STAGE_RACE_CATALOG.find((entry) => entry.stages === 5);
  cc.handleAction(game, 'p1', 'selectRace', {raceId: race.id});
  let fakeNow = Date.now();
  let guard = 0;
  while (game.phase !== 'result' && guard < 5000) {
    guard += 1;
    fakeNow += 1000;
    if (game.phase === 'lineup' && game.race.lineups.p1 === undefined) {
      const riderIds = player1.team.riders.filter((rider) => rider.status === 'active').slice(0, 3).map((rider) => rider.id);
      cc.handleAction(game, 'p1', 'submitLineup', {riderIds});
    } else if (game.phase === 'racing') {
      playSegmentAsP1(game);
    } else if (game.phase === 'stageResult') {
      cc.handleAction(game, 'p1', 'nextStage', {});
    }
    cc.tick(game, fakeNow);
  }
  assert.equal(game.phase, 'result');

  const classifications = game.lastResult.classifications;
  const byId = new Map(game.players.map((player) => [player.id, player]));
  // Elke trui die naar een echte speler ging, staat exact één keer in zijn erelijst.
  for (const key of ['gc', 'green', 'polka', 'youth', 'team']) {
    const winner = (classifications[key] || []).find((entry) => entry.place === 1);
    const owner = winner && byId.get(winner.playerId);
    if (owner) assert.equal(owner.team.career.jerseys[key], 1, `trui ${key}`);
  }
  // Niemand kan meer dan één exemplaar van dezelfde trui pakken in één ronde.
  for (const player of game.players) {
    for (const key of ['gc', 'green', 'polka', 'youth', 'team']) {
      assert.ok(player.team.career.jerseys[key] <= 1, `trui ${key} dubbel toegekend`);
    }
  }

  const gcWinner = game.lastResult.gc[0];
  const champion = gcWinner && byId.get(gcWinner.playerId);
  if (champion) {
    assert.equal(champion.team.career.raceWins[race.id], 1);
    assert.equal(champion.team.career.stageRacesWon, 1);
  }
  // Winst wordt op de ronde geboekt, niet op de losse ritten.
  for (const player of game.players) {
    for (const raceId of Object.keys(player.team.career.raceWins)) {
      assert.ok(!raceId.includes('::stage:'), `ritwinst apart geboekt: ${raceId}`);
    }
  }
});

test('time classifications show the leader with a total time and everyone else as a gap; teams group per real team', () => {
  const entry = (playerId, riderId, teamId, time, age = 30) => ({
    playerId, playerName: playerId, riderId, riderName: riderId, rider: {teamId}, age,
    totalPr: 0, stageWins: 0, timeAccumulated: time, pointsGreen: 0, pointsPolka: 0
  });
  const gc = {
    'p1:a': entry('p1', 'a', 'x', -30, 22), 'p1:b': entry('p1', 'b', 'x', 10), 'p1:c': entry('p1', 'c', 'x', 20),
    'npc:n1': entry('__race_npcs__', 'n1', 'catalog-0', -66, 24), 'npc:n2': entry('__race_npcs__', 'n2', 'catalog-0', 0)
  };
  const standings = cc.classificationStandings(gc, 4 * 3600);
  assert.deepEqual(standings.gc.map((row) => [row.riderId, row.value, row.display]), [
    ['n1', 0, cc.formatRaceTime(4 * 3600 - 66)], ['a', 36, '+36s'], ['n2', 66, '+66s'], ['b', 76, '+76s'], ['c', 86, '+86s']
  ]);
  assert.equal(standings.gc[0].display, `3u58'54"`);
  assert.equal(standings.youth[0].riderId, 'n1');
  assert.equal(standings.youth[1].display, '+36s');
  // Het NPC-veld telt per echte ploeg mee en alleen met minstens drie renners.
  assert.deepEqual(standings.team.map((row) => [row.playerName, row.value]), [['p1', 0]]);
  gc['npc:n3'] = entry('__race_npcs__', 'n3', 'catalog-0', -50);
  const withTeam = cc.classificationStandings(gc, 0);
  assert.equal(withTeam.team.length, 2);
  assert.equal(withTeam.team[0].playerId, '__race_npcs__');
  assert.equal(withTeam.team[1].display, '+116s');
});

test('team tactics: every team owns the ten tactics, inactive and without stock by default', () => {
  const game = cc.createGame([{id: 'p1', name: 'Alice', isNpc: false}]);
  const tactics = game.players[0].team.tactics;
  assert.equal(Object.keys(tactics).length, 10);
  assert.equal(cc.TEAM_TACTICS.length, 10);
  for (const row of Object.values(tactics)) assert.deepEqual(row, {upgradeLevel: 0, actieveVoorraad: 0});
  const serialized = cc.serialize(game, 'p1', new Map()).players[0].tactics;
  assert.equal(serialized.length, 10);
  assert.deepEqual(serialized.map((tactic) => tactic.naam), ['Lead-out', 'Gereed voor eindsprint', 'Bergpunten pakken', 'Tussensprint pakken', 'Vroege vlucht', 'Kopman uit de wind zetten', 'Gat dichtrijden', 'Meeschuiven / Schaduwen', 'Bordje leeg eten', 'Waaier trekken']);
  // Een oude save zonder tactieken, of met kapotte waarden, hydrateert veilig.
  const hydrated = cc.createGame([{id: 'p2', name: 'Bob', isNpc: false, cycclubTeam: {...savedTeam([]), tactics: {waaier: {upgradeLevel: 9, actieveVoorraad: -3}, onbekend: {upgradeLevel: 2}}}}]);
  assert.deepEqual(hydrated.players[0].team.tactics.waaier, {upgradeLevel: 5, actieveVoorraad: 0});
  assert.equal('onbekend' in hydrated.players[0].team.tactics, false);
});

test('team tactics shop: activate, upgrade and buy cards cost budget and respect the limits', () => {
  const game = cc.createGame([{id: 'p1', name: 'Alice', isNpc: false}]);
  const team = game.players[0].team;
  team.wallet = 100000;
  assert.throws(() => cc.handleAction(game, 'p1', 'upgradeTactic', {tacticId: 'lead_out'}), /Activeer/);
  assert.throws(() => cc.handleAction(game, 'p1', 'buyTacticCard', {tacticId: 'lead_out'}), /Activeer/);
  assert.throws(() => cc.handleAction(game, 'p1', 'activateTactic', {tacticId: 'nope'}), /Onbekende/);
  cc.handleAction(game, 'p1', 'activateTactic', {tacticId: 'lead_out'});
  assert.deepEqual(team.tactics.lead_out, {upgradeLevel: 1, actieveVoorraad: 1});
  assert.equal(team.wallet, 100000 - cc.TEAM_TACTIC_ACTIVATE_COST);
  assert.throws(() => cc.handleAction(game, 'p1', 'activateTactic', {tacticId: 'lead_out'}), /al geactiveerd/);
  cc.handleAction(game, 'p1', 'upgradeTactic', {tacticId: 'lead_out'});
  assert.equal(team.tactics.lead_out.upgradeLevel, 2);
  assert.equal(team.wallet, 100000 - cc.TEAM_TACTIC_ACTIVATE_COST - cc.TEAM_TACTIC_UPGRADE_COSTS[0]);
  cc.handleAction(game, 'p1', 'buyTacticCard', {tacticId: 'lead_out'});
  assert.equal(team.tactics.lead_out.actieveVoorraad, 2);
  team.tactics.lead_out.actieveVoorraad = cc.TEAM_TACTIC_MAX_STOCK;
  assert.throws(() => cc.handleAction(game, 'p1', 'buyTacticCard', {tacticId: 'lead_out'}), /maximaal/);
  team.tactics.lead_out.upgradeLevel = cc.TEAM_TACTIC_MAX_LEVEL;
  assert.throws(() => cc.handleAction(game, 'p1', 'upgradeTactic', {tacticId: 'lead_out'}), /maximum/);
  team.wallet = 10;
  assert.throws(() => cc.handleAction(game, 'p1', 'activateTactic', {tacticId: 'waaier'}), /budget/);
  const shown = cc.serialize(game, 'p1', new Map()).players[0].tactics.find((tactic) => tactic.id === 'lead_out');
  assert.equal(shown.costs.upgrade, null);
  assert.equal(shown.actieveVoorraad, cc.TEAM_TACTIC_MAX_STOCK);
});

test('team tactic cards modify the segment calculation per card', () => {
  const team = makeTeam();
  const flat = {...FLAT_SEGMENT, segmentIndex: 7};
  // Meeschuiven: Volg kost geen uithouding en laadt extra explosiviteit.
  const shadow = withEnergy(makeRider({id: 's1'}), {endurance: 80, power: 20});
  cc.calculateSegmentStep([shadow], {s1: 'follow'}, {}, FLAT_SEGMENT, 5, team, {card: {id: 'meeschuiven', level: 2}});
  assert.equal(shadow.endurance, 80);
  assert.equal(shadow.power, 20 + 15 + 6);
  // Gereed voor eindsprint: +2 op de worp in het laatste segment op niveau 1.
  const plain = cc.calculateSegmentStep([makeRider({id: 'e0'})], {e0: 'follow'}, {}, flat, 5, team);
  const boosted = cc.calculateSegmentStep([makeRider({id: 'e1'})], {e1: 'follow'}, {}, flat, 5, team, {card: {id: 'eindsprint', level: 1}});
  assert.equal(Math.round((boosted.e1.personalMultiplier - plain.e0.personalMultiplier) * 100) / 100, 0.2);
  // Waaier trekken: ploegmultiplier en een kruis-effect op Herstel bij anderen.
  const echelon = cc.calculateSegmentStep([makeRider({id: 'w1'})], {w1: 'follow'}, {}, FLAT_SEGMENT, 5, team, {card: {id: 'waaier', level: 1}});
  assert.equal(echelon.w1.personalMultiplier, Math.round(0.7 * 1.16 * 1000) / 1000);
  assert.deepEqual(echelon.cardEffect, {id: 'waaier', level: 1, cross: {penaltyRecover: 1.3}});
  // Bordje leeg eten telt alleen als er knechtenwerk gedaan wordt.
  const lazy = cc.calculateSegmentStep([makeRider({id: 'b1'})], {b1: 'follow'}, {}, FLAT_SEGMENT, 5, team, {card: {id: 'bordje_leeg', level: 1}});
  assert.equal(lazy.cardEffect.cross, null);
  const busy = cc.calculateSegmentStep([makeRider({id: 'b2'})], {b2: 'fetch_bidons'}, {}, FLAT_SEGMENT, 5, team, {card: {id: 'bordje_leeg', level: 3}});
  assert.deepEqual(busy.cardEffect.cross, {penaltyAll: 0.9});
  // Gat dichtrijden: alleen Kop vanuit een slechte positie, en het kost extra uithouding.
  const chaser = withEnergy(makeRider({id: 'g1'}), {endurance: 80, power: 80, position: 'back'});
  const chase = cc.calculateSegmentStep([chaser], {g1: 'leadout'}, {}, FLAT_SEGMENT, 5, team, {card: {id: 'gat_dichtrijden', level: 1}});
  assert.equal(Math.round((chase.g1.personalMultiplier - 0.8) * 100) / 100, 0.2);
  assert.equal(chaser.endurance, 80 - (8 - 2 + 7)); // Kop 8, staart −2, kaart +7
  // Onbekende kaart doet niets.
  const none = cc.calculateSegmentStep([makeRider({id: 'n1'})], {n1: 'follow'}, {}, FLAT_SEGMENT, 5, team, {card: {id: 'nope', level: 1}});
  assert.equal(none.n1.personalMultiplier, 0.7);
  assert.equal(none.cardEffect, null);
});

test('playing a card in a race consumes stock, is refunded after a top-3 finish and penalises rivals', () => {
  const {game, player1} = buildGame();
  player1.team.tactics.waaier = {upgradeLevel: 2, actieveVoorraad: 2};
  player1.team.tactics.lead_out = {upgradeLevel: 1, actieveVoorraad: 0};
  cc.handleAction(game, 'p1', 'selectRace', {raceId: cc.RACE_CATALOG[0].id});
  const riderIds = player1.team.riders.slice(0, 3).map((rider) => rider.id);
  cc.handleAction(game, 'p1', 'submitLineup', {riderIds});
  const tactics = Object.fromEntries(riderIds.map((id) => [id, 'follow']));
  assert.throws(() => cc.handleAction(game, 'p1', 'rollSegment', {tactics, card: 'lead_out'}), /geen kaarten/);
  assert.throws(() => cc.handleAction(game, 'p1', 'rollSegment', {tactics, card: 'bergpunten'}), /niet geactiveerd/);
  cc.handleAction(game, 'p1', 'rollSegment', {tactics, card: 'waaier'});
  const prog = game.race.progress.p1;
  if (prog.pendingEvent) cc.handleAction(game, 'p1', 'resolveEvent', {choice: prog.pendingEvent.options[0].key});
  assert.equal(player1.team.tactics.waaier.actieveVoorraad, 1);
  assert.deepEqual(prog.usedTactics, ['waaier']);
  assert.deepEqual(prog.cardEffect, {id: 'waaier', level: 2, cross: {penaltyRecover: 1.6}});
  // Een NPC-renner die Herstel koos, verliest 0,16 op zijn multiplier zodra het segment sluit.
  let fakeNow = Date.now();
  let guard = 0;
  while (game.race.segmentIndex === 0 && guard < 20) { guard += 1; fakeNow += 1000; cc.tick(game, fakeNow); }
  const npcProg = game.race.progress.__race_npcs__;
  const recovered = Object.values(npcProg.riders).map((state) => state.segments[0]).find((entry) => entry && entry.tactic === 'recover');
  if (recovered) assert.ok(recovered.multiplier <= 1.0, 'herstelde NPC-renner draagt de penalty');
  assert.equal(cc.serialize(game, 'p1', new Map()).race.myProgress.usedTactics.length, 1);
  // Forceer een podiumplaats: alle andere renners uitgevallen, dan rijden we de rit uit.
  for (const riderId of Object.keys(npcProg.riders)) npcProg.riders[riderId].dnf = true;
  guard = 0;
  while (game.phase === 'racing' && guard < 100) { guard += 1; fakeNow += 1000; playSegmentAsP1(game); cc.tick(game, fakeNow); }
  assert.equal(game.phase, 'result');
  assert.deepEqual(game.lastResult.usedTactics.p1, ['waaier']);
  assert.deepEqual(game.lastResult.tacticRefunds.p1, ['waaier']);
  assert.equal(player1.team.tactics.waaier.actieveVoorraad, 2);
});

test('cards are not refunded without a podium or a jersey', () => {
  const {game, player1} = buildGame();
  player1.team.tactics.eindsprint = {upgradeLevel: 1, actieveVoorraad: 1};
  for (const rider of player1.team.riders) rider.fatigue = 95; // Hongerklop: kansloos
  cc.handleAction(game, 'p1', 'selectRace', {raceId: cc.RACE_CATALOG[0].id});
  const riderIds = player1.team.riders.slice(0, 3).map((rider) => rider.id);
  cc.handleAction(game, 'p1', 'submitLineup', {riderIds});
  cc.handleAction(game, 'p1', 'rollSegment', {tactics: Object.fromEntries(riderIds.map((id) => [id, 'recover'])), card: 'eindsprint'});
  let fakeNow = Date.now();
  let guard = 0;
  while (game.phase === 'racing' && guard < 100) { guard += 1; fakeNow += 1000; playSegmentAsP1(game, 'recover'); cc.tick(game, fakeNow); }
  assert.equal(game.phase, 'result');
  const best = game.lastResult.classification.find((entry) => entry.playerId === 'p1');
  if (!best || best.place > 3) {
    assert.deepEqual(game.lastResult.tacticRefunds, {});
    assert.equal(player1.team.tactics.eindsprint.actieveVoorraad, 0);
  }
});
