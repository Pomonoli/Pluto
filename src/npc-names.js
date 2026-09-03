'use strict';

// Belgian, Dutch and international first names for room NPCs.
const NPC_FIRST_NAMES = Object.freeze([
  'Amélie', 'Arthur', 'Axelle', 'Bram', 'Camille', 'Cédric', 'Charlotte', 'Daan',
  'Elise', 'Elias', 'Emma', 'Felix', 'Fien', 'Finn', 'Gilles', 'Hanne',
  'Hugo', 'Inès', 'Jasper', 'Julie', 'Karel', 'Lena', 'Liam', 'Lies',
  'Lotte', 'Louis', 'Lucas', 'Marie', 'Mats', 'Mila', 'Nora', 'Noah',
  'Otis', 'Pauline', 'Quinten', 'Rik', 'Robin', 'Saar', 'Sam', 'Senne',
  'Sofie', 'Thomas', 'Viktor', 'Wout', 'Yara', 'Yasmine', 'Zoë', 'Alessandro',
  'Ana', 'Ava', 'David', 'Diego', 'Elena', 'Hannah', 'Isabella', 'James',
  'Leila', 'Maya', 'Mia', 'Milan', 'Oliver', 'Sofia', 'Victor', 'Zara'
]);

function normalizedName(value) {
  return String(value || '').trim().toLocaleLowerCase('nl-BE');
}

function chooseNpcName(players = [], random = Math.random) {
  const usedNames = new Set(players.map((player) => normalizedName(player?.name)));
  const availableNames = NPC_FIRST_NAMES.filter((name) => !usedNames.has(normalizedName(name)));
  const candidates = availableNames.length ? availableNames : NPC_FIRST_NAMES;
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)));
  return candidates[index];
}

module.exports = { NPC_FIRST_NAMES, chooseNpcName };
