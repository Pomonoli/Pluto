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

  // Fase 2 — troepen
  units: {
    militia: { label: 'Militie', cost: 2, strength: 1 },
    armored: { label: 'Gepantserde colonne', cost: 4, strength: 2 }
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
  support: { enthusiastic: 8, unrest: 3 },

  // Fase 7 — overwinning
  victory: { economicTreasury: 50, socialSupportRounds: 3 }
};

module.exports = { CONFIG };
