'use strict';

/**
 * Total Waas — centrale spelconfiguratie.
 * Alle cijfers zijn voorlopig en horen hier, nooit verspreid in de code.
 * Waarden voor latere fases staan er al zodat balans op één plek gebeurt.
 */
const CONFIG = {
  startTreasury: 10,
  startSupport: 6,
  neutralGarrison: 6, // startgarnizoen van de stad Sint-Niklaas
  rebelGarrison: 2, // rebellen in elke andere neutrale provincie (buitenwijken en niet-gekozen facties)
  npcTurnDelayMs: 900,

  taxPolicies: {
    low: { label: 'Laag', incomeMultiplier: 0.75, supportDelta: 2 },
    normal: { label: 'Normaal', incomeMultiplier: 1, supportDelta: 0 },
    extortion: { label: 'Knevelarij', incomeMultiplier: 1.5, supportDelta: -2 }
  },

  // Fase 2 — troepen
  units: {
    militia: { label: 'Militie', cost: 3, upkeep: 1, strength: 1 },
    armored: { label: 'Gepantserde colonne', cost: 6, upkeep: 2, strength: 2, requires: 'barracks' }
  },

  // Fase 3 — gebouwen
  buildings: {
    economy: { label: 'Economisch gebouw', cost: 3, incomeBonus: 1 },
    barracks: { label: 'Kazerne', cost: 4 },
    fort: { label: 'Fort', cost: 4, defenseBonus: 1 },
    civic: { label: 'Burgerlijk gebouw', cost: 3, supportBonus: 1 },
    infrastructure: { label: 'Infrastructuur', cost: 3 }
  },

  // Fase 4 — draagvlak (0-10)
  support: { enthusiastic: 8, unrest: 3, incomeBonus: 1.2, criticalIncome: 0.5 },

  // Fase 7 — overwinning
  victory: { economicTreasury: 50, socialSupportRounds: 3 }
};

module.exports = { CONFIG };
