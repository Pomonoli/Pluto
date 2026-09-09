'use strict';

const SKILL_KEYS = ['fishing', 'woodcutting', 'mining', 'hunting', 'collecting', 'trading'];
const MAX_SKILL_LEVEL = 99;

const LEVEL_XP = (() => {
  const table = [0, 0];
  for (let level = 2; level <= MAX_SKILL_LEVEL; level += 1) {
    const previous = level - 1;
    table[level] = table[previous] + 100 + Math.round(previous * previous * 1.3);
  }
  return table;
})();

function levelForXp(xp) {
  let level = 1;
  while (level < MAX_SKILL_LEVEL && Number(xp || 0) >= LEVEL_XP[level + 1]) level += 1;
  return level;
}

function totalLevel(skills) {
  return SKILL_KEYS.reduce((sum, key) => sum + levelForXp(skills?.[key]), 0);
}

module.exports = { SKILL_KEYS, MAX_SKILL_LEVEL, LEVEL_XP, levelForXp, totalLevel };
