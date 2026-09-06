'use strict';

// Koken: Kampvuur roostert gratis (quality raw -> roasted, geen buff, meer
// energie). Kookvuur verwerkt een stuk vlees tot een gerecht met een
// tijdelijke buff, tegen een kleine kruiden/voorraadkost in geld i.p.v. een
// tweede fysiek ingrediënt — een bewuste vereenvoudiging van het ontwerp om
// geen aparte "kies je tweede ingrediënt"-UI nodig te hebben.
const QUALITY_MULTIPLIER = { raw: 1, roasted: 1.5, dish: 2.5 };
const BUFF_DURATION_MS = 6 * 60 * 1000;

const DISHES = [
  {
    id: 'vislijn-stoofpot',
    name: 'Vislijnstoofpot',
    icon: '🍲',
    cost: 15,
    buff: { id: 'lineStrength', label: 'Lijnsterkte', icon: '🎣', help: 'Grotere kans op een zeldzame vangst.' }
  },
  {
    id: 'winterkost',
    name: 'Winterkost',
    icon: '🥘',
    cost: 15,
    buff: { id: 'energyRegen', label: 'Warme Maag', icon: '🔥', help: 'Energie herstelt langzaam vanzelf.' }
  },
  {
    id: 'jagerspot',
    name: 'Jagerspot',
    icon: '🍖',
    cost: 20,
    buff: { id: 'extraDie', label: 'Jachtlust', icon: '🎲', help: 'Extra dobbelsteen bij een aanval.' }
  },
  {
    id: 'nachtbrouwsel',
    name: 'Nachtbrouwsel',
    icon: '🍵',
    cost: 20,
    buff: { id: 'nightVision', label: 'Nachtzicht', icon: '🌙', help: 'Zie wild en visgronden verder weg in het donker.' }
  }
];

function getDish(id) { return DISHES.find((dish) => dish.id === id) || null; }
function getBuff(id) { return DISHES.map((dish) => dish.buff).find((buff) => buff.id === id) || null; }

module.exports = { QUALITY_MULTIPLIER, BUFF_DURATION_MS, DISHES, getDish, getBuff };
