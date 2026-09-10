'use strict';

// Questmotor. De inhoud staat bij de NPC die de opdracht geeft (npcs.js);
// dit bestand kent alleen de mechaniek: aannemen, voortgang aftikken op
// gebeurtenissen die de game toch al genereert, en afronden.
//
// Twee soorten doelen:
//  - tellers ('fish', 'gather', 'hunt', 'cook') lopen op via advance();
//  - toestandsdoelen ('discovery') worden niet opgeslagen maar telkens uit de
//    spelerstaat afgeleid, zodat ze ook kloppen als je de mijlpaal al vóór het
//    aannemen van de opdracht haalde.
const { NPCS } = require('./npcs');

const QUESTS = NPCS
  .filter((npc) => npc.quest)
  .map((npc) => ({ ...npc.quest, npcId: npc.id, npcName: npc.name }));

function allQuests() { return QUESTS; }
function getQuest(id) { return QUESTS.find((quest) => quest.id === id) || null; }
function questForNpc(npcId) { return QUESTS.find((quest) => quest.npcId === npcId) || null; }

function defaultQuests() { return {}; }

function sanitizeQuests(saved) {
  const out = {};
  if (!saved || typeof saved !== 'object') return out;
  for (const quest of QUESTS) {
    const entry = saved[quest.id];
    if (!entry || typeof entry !== 'object') continue;
    if (entry.status !== 'active' && entry.status !== 'done') continue;
    const progress = quest.goals.map((goal, index) => {
      const value = Number(Array.isArray(entry.progress) ? entry.progress[index] : 0);
      if (!Number.isFinite(value)) return 0;
      return Math.max(0, Math.min(goalTarget(goal), Math.round(value)));
    });
    out[quest.id] = { status: entry.status, progress };
  }
  return out;
}

function goalTarget(goal) { return goal.kind === 'discovery' ? 1 : Math.max(1, goal.count || 1); }

function goalValue(player, goal, stored) {
  if (goal.kind === 'discovery') return (player.discoveries || []).includes(goal.discovery) ? 1 : 0;
  return Math.max(0, Number(stored) || 0);
}

function goalsMet(player, quest, entry) {
  return quest.goals.every((goal, index) => goalValue(player, goal, entry.progress[index]) >= goalTarget(goal));
}

function statusFor(player, quest) {
  const entry = player.quests?.[quest.id];
  if (!entry) return 'available';
  if (entry.status === 'done') return 'done';
  return goalsMet(player, quest, entry) ? 'ready' : 'active';
}

function matches(goal, event, player) {
  if (goal.kind !== event.kind) return false;
  if (goal.resource && goal.resource !== event.resource) return false;
  if (goal.speciesId && goal.speciesId !== event.speciesId) return false;
  if (goal.setId && goal.setId !== event.setId) return false;
  if (goal.rarity && !goal.rarity.includes(event.rarity)) return false;
  if (goal.night && event.dayPhase !== 'night') return false;
  // Gereedschapsniveaus zijn nul-gebaseerd opgeslagen maar één-gebaseerd getoond.
  if (goal.minTool && (player.gear?.[goal.minTool.key] || 0) + 1 < goal.minTool.level) return false;
  return true;
}

// Werkt lopende opdrachten bij en geeft terug welke daardoor klaar zijn om in
// te leveren (voor een regel in het logboek).
function advance(player, event) {
  const finished = [];
  for (const quest of QUESTS) {
    const entry = player.quests?.[quest.id];
    if (!entry || entry.status !== 'active') continue;
    const wasMet = goalsMet(player, quest, entry);
    let changed = false;
    quest.goals.forEach((goal, index) => {
      if (goal.kind === 'discovery' || !matches(goal, event, player)) return;
      const target = goalTarget(goal);
      if (entry.progress[index] >= target) return;
      entry.progress[index] = Math.min(target, entry.progress[index] + Math.max(1, Math.round(event.amount || 1)));
      changed = true;
    });
    if (changed && !wasMet && goalsMet(player, quest, entry)) finished.push(quest);
  }
  return finished;
}

function accept(player, questId) {
  const quest = getQuest(questId);
  if (!quest) throw new Error('Onbekende opdracht.');
  if (player.quests[quest.id]) throw new Error('Deze opdracht loopt al of is afgerond.');
  player.quests[quest.id] = { status: 'active', progress: quest.goals.map(() => 0) };
  return quest;
}

function complete(player, questId) {
  const quest = getQuest(questId);
  if (!quest) throw new Error('Onbekende opdracht.');
  const entry = player.quests[quest.id];
  if (!entry || entry.status !== 'active') throw new Error('Deze opdracht loopt niet.');
  if (!goalsMet(player, quest, entry)) throw new Error('Je bent nog niet klaar met deze opdracht.');
  entry.status = 'done';
  entry.progress = quest.goals.map((goal) => goalTarget(goal));
  return quest;
}

function serializeFor(player) {
  return QUESTS.map((quest) => {
    const entry = player.quests?.[quest.id] || null;
    return {
      id: quest.id,
      npcId: quest.npcId,
      npcName: quest.npcName,
      title: quest.title,
      type: quest.type,
      context: quest.context,
      objective: quest.objective,
      reward: quest.reward,
      rewards: quest.rewards || {},
      status: statusFor(player, quest),
      goals: quest.goals.map((goal, index) => ({
        label: goal.label,
        value: goalValue(player, goal, entry?.progress?.[index]),
        target: goalTarget(goal)
      }))
    };
  });
}

module.exports = { allQuests, getQuest, questForNpc, defaultQuests, sanitizeQuests, advance, accept, complete, serializeFor, statusFor };
