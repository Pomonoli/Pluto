'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const quests = require('../games/deep-bleu-c/quests');
const { NPCS } = require('../games/deep-bleu-c/npcs');

function freshPlayer(overrides = {}) {
  return { discoveries: [], gear: { rod: 0, boat: 0, axe: 0, pickaxe: 0 }, quests: {}, ...overrides };
}

test('elke NPC-opdracht is machineleesbaar en uitbetaalbaar', () => {
  const seen = new Set();
  for (const npc of NPCS) {
    assert.ok(npc.quest, `${npc.id} heeft een opdracht`);
    const quest = npc.quest;
    assert.ok(quest.id && !seen.has(quest.id), `${quest.id} is een uniek id`);
    seen.add(quest.id);
    assert.ok(Array.isArray(quest.goals) && quest.goals.length, `${quest.id} heeft doelen`);
    for (const goal of quest.goals) {
      assert.ok(['fish', 'gather', 'hunt', 'cook', 'discovery'].includes(goal.kind), `${quest.id}: doeltype ${goal.kind} wordt ondersteund`);
      assert.ok(goal.label, `${quest.id}: elk doel heeft een label`);
      if (goal.kind !== 'discovery') assert.ok(goal.count >= 1, `${quest.id}: telbaar doel heeft een aantal`);
    }
    // Zonder concrete beloning zou inleveren niets opleveren.
    assert.ok(quest.rewards?.cash > 0 || Object.keys(quest.rewards?.xp || {}).length, `${quest.id} betaalt iets uit`);
  }
  assert.equal(quests.allQuests().length, NPCS.length);
});

test('voortgang telt alleen mee als aan alle voorwaarden van het doel voldaan is', () => {
  const player = freshPlayer({ gear: { pickaxe: 0 } });
  quests.accept(player, 'valerius-vezels');
  quests.advance(player, { kind: 'gather', resource: 'rock' });
  assert.equal(player.quests['valerius-vezels'].progress[0], 0, 'Houweel I is te laag');

  player.gear.pickaxe = 1;
  quests.advance(player, { kind: 'gather', resource: 'rock' });
  assert.equal(player.quests['valerius-vezels'].progress[0], 1, 'Houweel II telt wel mee');
  quests.advance(player, { kind: 'gather', resource: 'wood' });
  assert.equal(player.quests['valerius-vezels'].progress[0], 1, 'hout telt niet als steen');

  const angler = freshPlayer();
  quests.accept(angler, 'anja-kat');
  quests.advance(angler, { kind: 'fish', rarity: 'rare', dayPhase: 'day' });
  quests.advance(angler, { kind: 'fish', rarity: 'common', dayPhase: 'night' });
  assert.equal(angler.quests['anja-kat'].progress[0], 0, 'overdag of gewone vis telt niet');
  quests.advance(angler, { kind: 'fish', rarity: 'rare', dayPhase: 'night' });
  assert.equal(angler.quests['anja-kat'].progress[0], 1);

  const lumberjack = freshPlayer();
  quests.accept(lumberjack, 'lars-schuifbak');
  quests.advance(lumberjack, { kind: 'gather', resource: 'wood', speciesId: 'berk' });
  assert.equal(lumberjack.quests['lars-schuifbak'].progress[0], 0, 'alleen eik telt voor Lars');
});

test('een opdracht is pas in te leveren als alle doelen gehaald zijn', () => {
  const player = freshPlayer();
  quests.accept(player, 'kilgore-sintel');
  assert.throws(() => quests.complete(player, 'kilgore-sintel'), /nog niet klaar/i);

  for (let i = 0; i < 15; i += 1) quests.advance(player, { kind: 'gather', resource: 'wood' });
  assert.equal(quests.serializeFor(player).find((q) => q.id === 'kilgore-sintel').status, 'active',
    'één van twee doelen is niet genoeg');

  for (let i = 0; i < 5; i += 1) quests.advance(player, { kind: 'gather', resource: 'rock' });
  assert.equal(quests.serializeFor(player).find((q) => q.id === 'kilgore-sintel').status, 'ready');
  quests.complete(player, 'kilgore-sintel');
  assert.equal(quests.serializeFor(player).find((q) => q.id === 'kilgore-sintel').status, 'done');
  assert.throws(() => quests.complete(player, 'kilgore-sintel'), /loopt niet/i);
});

test('toestandsdoelen kijken naar de spelerstaat, ook van voor het aannemen', () => {
  const sailor = freshPlayer({ discoveries: ['kelp-island'] });
  quests.accept(sailor, 'joris-route');
  assert.equal(quests.serializeFor(sailor).find((q) => q.id === 'joris-route').status, 'ready');

  const landlubber = freshPlayer();
  quests.accept(landlubber, 'joris-route');
  assert.equal(quests.serializeFor(landlubber).find((q) => q.id === 'joris-route').status, 'active');
  landlubber.discoveries.push('kelp-island');
  assert.equal(quests.serializeFor(landlubber).find((q) => q.id === 'joris-route').status, 'ready');
});

test('opgeslagen questvoortgang overleeft een sessie en weert rommel', () => {
  const player = freshPlayer();
  quests.accept(player, 'maria-levada');
  quests.advance(player, { kind: 'gather', resource: 'rock' });

  const restored = quests.sanitizeQuests(player.quests);
  assert.deepEqual(restored['maria-levada'], { status: 'active', progress: [1] });

  const dirty = quests.sanitizeQuests({
    'maria-levada': { status: 'active', progress: [999] },
    'onbekende-quest': { status: 'active', progress: [3] },
    'lars-schuifbak': { status: 'rommel', progress: [1] }
  });
  assert.equal(dirty['maria-levada'].progress[0], 3, 'voortgang wordt op het doel geklemd');
  assert.ok(!dirty['onbekende-quest'], 'onbekende opdrachten verdwijnen');
  assert.ok(!dirty['lars-schuifbak'], 'ongeldige status verdwijnt');
});
