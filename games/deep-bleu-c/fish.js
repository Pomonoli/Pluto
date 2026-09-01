'use strict';

// Vissoorten per biotoop. Elk biotoop hoort bij een tegeltype in worldgen.js
// en vormt tegelijk de eerste visset in het Aquarium-Museum (fase 2).
const SETS = [
  {
    id: 'rivier',
    name: 'Polderrivieren',
    icon: '🏞️',
    description: 'Rustige rivieren en meren midden in het vasteland.',
    fish: [
      { id: 'baars', name: 'Baars', icon: '🐟', rarity: 'common', weight: 6, minKg: 0.1, maxKg: 1.2, basePrice: 4 },
      { id: 'snoek', name: 'Snoek', icon: '🐊', rarity: 'uncommon', weight: 3, minKg: 0.5, maxKg: 6, basePrice: 9 },
      { id: 'karper', name: 'Karper', icon: '🐟', rarity: 'uncommon', weight: 3, minKg: 1, maxKg: 12, basePrice: 8 },
      { id: 'meerval', name: 'Meerval', icon: '🐡', rarity: 'rare', weight: 1, minKg: 3, maxKg: 40, basePrice: 22 }
    ]
  },
  {
    id: 'kust',
    name: 'Kustwateren',
    icon: '🏖️',
    description: 'Ondiepe zeewateren rond havens en stranden.',
    fish: [
      { id: 'haring', name: 'Haring', icon: '🐟', rarity: 'common', weight: 6, minKg: 0.1, maxKg: 0.4, basePrice: 3 },
      { id: 'makreel', name: 'Makreel', icon: '🐟', rarity: 'common', weight: 5, minKg: 0.2, maxKg: 0.9, basePrice: 5 },
      { id: 'zeebaars', name: 'Zeebaars', icon: '🐟', rarity: 'uncommon', weight: 3, minKg: 0.5, maxKg: 4, basePrice: 12 },
      { id: 'schol', name: 'Schol', icon: '🐠', rarity: 'uncommon', weight: 3, minKg: 0.2, maxKg: 1.5, basePrice: 7 }
    ]
  },
  {
    id: 'atlantisch',
    name: 'Atlantische Diepzee',
    icon: '🌊',
    description: 'De ruige, diepe wateren van de Atlantische Oceaan.',
    fish: [
      { id: 'kabeljauw', name: 'Kabeljauw', icon: '🐟', rarity: 'uncommon', weight: 4, minKg: 1, maxKg: 15, basePrice: 14 },
      { id: 'heilbot', name: 'Heilbot', icon: '🐡', rarity: 'rare', weight: 2, minKg: 5, maxKg: 60, basePrice: 35 },
      { id: 'tonijn', name: 'Tonijn', icon: '🐟', rarity: 'rare', weight: 2, minKg: 10, maxKg: 120, basePrice: 55 },
      { id: 'zwaardvis', name: 'Zwaardvis', icon: '🗡️', rarity: 'epic', weight: 1, minKg: 20, maxKg: 200, basePrice: 90 }
    ]
  },
  {
    id: 'middellandse-zee',
    name: 'Middellandse Zee',
    icon: '🏛️',
    description: 'Warme wateren rond eilanden en riffen in het zuiden.',
    fish: [
      { id: 'dorade', name: 'Dorade', icon: '🐟', rarity: 'common', weight: 6, minKg: 0.2, maxKg: 1.5, basePrice: 6 },
      { id: 'mul', name: 'Rode Mul', icon: '🐠', rarity: 'uncommon', weight: 3, minKg: 0.1, maxKg: 0.6, basePrice: 10 },
      { id: 'tandbaars', name: 'Tandbaars', icon: '🐟', rarity: 'rare', weight: 2, minKg: 2, maxKg: 40, basePrice: 28 },
      { id: 'leervis', name: 'Leervis', icon: '🐡', rarity: 'epic', weight: 1, minKg: 5, maxKg: 50, basePrice: 45 }
    ]
  }
];

const RARITY_LABEL = { common: 'Gewoon', uncommon: 'Ongewoon', rare: 'Zeldzaam', epic: 'Episch' };

const FISH_BY_ID = new Map();
const SET_BY_BIOME = new Map();
for (const set of SETS) {
  SET_BY_BIOME.set(set.id, set);
  for (const fish of set.fish) FISH_BY_ID.set(fish.id, { ...fish, biome: set.id });
}

function fishForBiome(biome) {
  return SET_BY_BIOME.get(biome)?.fish || null;
}

function getFish(id) {
  return FISH_BY_ID.get(id) || null;
}

function priceFor(speciesId, weightKg) {
  const fish = getFish(speciesId);
  if (!fish) return 0;
  const span = Math.max(0.001, fish.maxKg - fish.minKg);
  const factor = 0.5 + Math.min(1, Math.max(0, (weightKg - fish.minKg) / span));
  return Math.max(1, Math.round(fish.basePrice * factor));
}

module.exports = { SETS, RARITY_LABEL, fishForBiome, getFish, priceFor };
