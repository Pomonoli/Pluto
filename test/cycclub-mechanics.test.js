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

const FLAT_SEGMENT = {segmentIndex: 0, totalSegments: 8, terrainType: 'flat', elevationGain: 20, hasIntermediateSprint: false, mountainCategory: 0};
const MOUNTAIN_SEGMENT = {segmentIndex: 0, totalSegments: 8, terrainType: 'mountain', elevationGain: 900, hasIntermediateSprint: false, mountainCategory: 0};

test('calculateSegmentStep: climbers are boosted on mountains, sprinters on flat', () => {
  const climber = makeRider({id: 'c1', specialism: 'climber'});
  const sprinter = makeRider({id: 's1', specialism: 'sprinter'});
  const team = makeTeam();
  const tactics = {c1: 'follow', s1: 'follow'};
  const results = cc.calculateSegmentStep([climber, sprinter], tactics, {}, MOUNTAIN_SEGMENT, 10, team);
  assert.ok(results.c1.personalMultiplier > results.s1.personalMultiplier);
});

test('calculateSegmentStep: tactics change fatigue as documented', () => {
  const attacker = makeRider({id: 'a1', fatigue: 20});
  const recoverer = makeRider({id: 'r2', fatigue: 20});
  const team = makeTeam();
  cc.calculateSegmentStep([attacker, recoverer], {a1: 'attack', r2: 'recover'}, {}, FLAT_SEGMENT, 5, team);
  assert.equal(attacker.fatigue, 55); // +35
  assert.equal(recoverer.fatigue, 10); // -10
});

test('calculateSegmentStep: a gel immediately relieves fatigue and consumes one gel', () => {
  const rider = makeRider({id: 'g1', fatigue: 60, gelsRemaining: 2});
  const team = makeTeam();
  cc.calculateSegmentStep([rider], {g1: 'follow'}, {g1: true}, FLAT_SEGMENT, 5, team);
  // -25 (gel) then +5 (follow fatigueDelta) = 40
  assert.equal(rider.fatigue, 40);
  assert.equal(rider.gelsRemaining, 1);
});

test('calculateSegmentStep: fetch_bidons relieves teammates but not itself', () => {
  const bidonRider = makeRider({id: 'b1', fatigue: 30});
  const teammate = makeRider({id: 't1', fatigue: 30});
  const team = makeTeam();
  cc.calculateSegmentStep([bidonRider, teammate], {b1: 'fetch_bidons', t1: 'follow'}, {}, FLAT_SEGMENT, 5, team);
  assert.equal(bidonRider.fatigue, 45); // +15 own fatigueDelta, no relief to self
  assert.equal(teammate.fatigue, 20); // -15 relief, +5 own follow delta = 20
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

test('calculateSegmentStep: bonked riders (fatigue >= 91) cannot attack or lead out and are capped', () => {
  const bonked = makeRider({id: 'bk1', fatigue: 95});
  const team = makeTeam();
  const results = cc.calculateSegmentStep([bonked], {bk1: 'attack'}, {}, FLAT_SEGMENT, 10, team);
  assert.equal(results.bk1.tactic, 'follow');
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
    const prog = game.race.progress.p1;
    if (prog && !prog.confirmed) {
      const activeIds = Object.keys(prog.riders).filter((id) => !prog.riders[id].dnf);
      const tactics = {};
      for (const id of activeIds) tactics[id] = 'follow';
      cc.handleAction(game, 'p1', 'rollSegment', {tactics, gels: {}});
    }
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
      const prog = game.race.progress.p1;
      if (prog && !prog.confirmed) {
        const activeIds = Object.keys(prog.riders).filter((id) => !prog.riders[id].dnf);
        if (activeIds.length) {
          const tactics = {};
          for (const id of activeIds) tactics[id] = 'follow';
          cc.handleAction(game, 'p1', 'rollSegment', {tactics, gels: {}});
        }
      }
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
