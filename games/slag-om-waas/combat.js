'use strict';

const { randomInt } = require('node:crypto');

// Dice are rolled only on the server. An injected die keeps the rule tests deterministic.
function rollRound({ attackers, defenders, attackArmor = 0, defenseArmor = 0, fort = 0, castle = 0, bridge = 0 }, die = () => randomInt(1, 7)) {
  const roll = count => Array.from({ length: count }, () => die()).sort((a, b) => b - a);
  const attackDice = roll(Math.min(3, Math.max(0, attackers - 1)));
  const defenseDice = roll(Math.min(2, defenders));
  const attackScores = attackDice.map((d, i) => Math.min(6, d + (i < attackArmor ? 1 : 0))).sort((a, b) => b - a);
  // A combined bonus of at most four leaves a natural 1 beatable even in a castle.
  const defenseScores = defenseDice.map((d, i) => Math.min(6, d + Math.min(4, (i < defenseArmor ? 1 : 0) + (i === 0 ? fort + castle + bridge : 0)))).sort((a, b) => b - a);
  let attackerLosses = 0, defenderLosses = 0;
  for (let i = 0; i < Math.min(attackScores.length, defenseScores.length); i++) {
    if (attackScores[i] > defenseScores[i]) defenderLosses++;
    else attackerLosses++;
  }
  return { attackDice, defenseDice, attackScores, defenseScores, attackerLosses, defenderLosses,
    bonuses: { attackArmor, defenseArmor, fort, castle, bridge } };
}

module.exports = { rollRound };
