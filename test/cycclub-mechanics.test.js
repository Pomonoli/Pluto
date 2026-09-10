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
