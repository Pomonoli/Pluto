'use strict';

// Vissoorten per biotoop. Elk biotoop (tegeltype in worldgen.js) heeft nu
// meerdere sets van elk 10 vissoorten in het Aquarium-Museum, in plaats van
// één set per biotoop. `biome` bepaalt waar je een soort kan vangen;
// `rewardGear` bepaalt welke Handelsmarkt-uitrusting een gratis niveau
// krijgt zodra de hele set ontdekt is (zie server.js doReel).
const SETS = [
  {
    id: 'rivier-polder',
    biome: 'rivier',
    name: 'Polderrivieren',
    icon: '🏞️',
    description: 'Rustige rivieren en meren midden in het vasteland.',
    rewardGear: 'rod',
    fish: [
      { id: 'baars', name: 'Baars', icon: '🐟', rarity: 'common', minKg: 0.1, maxKg: 1.2, basePrice: 4 },
      { id: 'blankvoorn', name: 'Blankvoorn', icon: '🐟', rarity: 'common', minKg: 0.05, maxKg: 0.6, basePrice: 3 },
      { id: 'brasem', name: 'Brasem', icon: '🐟', rarity: 'common', minKg: 0.2, maxKg: 2.5, basePrice: 4 },
      { id: 'zeelt', name: 'Zeelt', icon: '🐟', rarity: 'common', minKg: 0.15, maxKg: 1.8, basePrice: 5 },
      { id: 'ruisvoorn', name: 'Ruisvoorn', icon: '🐟', rarity: 'uncommon', minKg: 0.1, maxKg: 0.8, basePrice: 6 },
      { id: 'giebel', name: 'Giebel', icon: '🐟', rarity: 'uncommon', minKg: 0.2, maxKg: 1.5, basePrice: 6 },
      { id: 'winde', name: 'Winde', icon: '🐟', rarity: 'uncommon', minKg: 0.2, maxKg: 1.2, basePrice: 7 },
      { id: 'kopvoorn', name: 'Kopvoorn', icon: '🐟', rarity: 'rare', minKg: 0.3, maxKg: 2, basePrice: 13 },
      { id: 'beekforel', name: 'Beekforel', icon: '🐟', rarity: 'rare', minKg: 0.2, maxKg: 1.5, basePrice: 16 },
      { id: 'steur', name: 'Steur', icon: '🐊', rarity: 'epic', minKg: 3, maxKg: 40, basePrice: 85 }
    ]
  },
  {
    id: 'rivier-roofvis',
    biome: 'rivier',
    name: 'Rivierroofvis',
    icon: '🐊',
    description: 'Grote roofvis en specialisten in diepe rivierkolken.',
    rewardGear: 'rod',
    fish: [
      { id: 'snoek', name: 'Snoek', icon: '🐊', rarity: 'common', minKg: 0.5, maxKg: 6, basePrice: 9 },
      { id: 'snoekbaars', name: 'Snoekbaars', icon: '🐟', rarity: 'common', minKg: 0.5, maxKg: 5, basePrice: 10 },
      { id: 'aal', name: 'Aal', icon: '🐟', rarity: 'common', minKg: 0.2, maxKg: 1.5, basePrice: 8 },
      { id: 'karper', name: 'Karper', icon: '🐟', rarity: 'common', minKg: 1, maxKg: 12, basePrice: 8 },
      { id: 'meerval', name: 'Meerval', icon: '🐡', rarity: 'uncommon', minKg: 3, maxKg: 40, basePrice: 24 },
      { id: 'kwabaal', name: 'Kwabaal', icon: '🐟', rarity: 'uncommon', minKg: 0.3, maxKg: 3, basePrice: 14 },
      { id: 'graskarper', name: 'Graskarper', icon: '🐟', rarity: 'uncommon', minKg: 2, maxKg: 15, basePrice: 18 },
      { id: 'barbeel', name: 'Barbeel', icon: '🐟', rarity: 'rare', minKg: 0.5, maxKg: 6, basePrice: 20 },
      { id: 'sneep', name: 'Sneep', icon: '🐟', rarity: 'rare', minKg: 0.3, maxKg: 2, basePrice: 22 },
      { id: 'elft', name: 'Elft', icon: '🐟', rarity: 'epic', minKg: 1, maxKg: 6, basePrice: 65 }
    ]
  },
  {
    id: 'kust-strand',
    biome: 'kust',
    name: 'Kustwateren',
    icon: '🏖️',
    description: 'Ondiepe zeewateren rond havens en stranden.',
    rewardGear: 'bait',
    fish: [
      { id: 'haring', name: 'Haring', icon: '🐟', rarity: 'common', minKg: 0.1, maxKg: 0.4, basePrice: 3 },
      { id: 'makreel', name: 'Makreel', icon: '🐟', rarity: 'common', minKg: 0.2, maxKg: 0.9, basePrice: 5 },
      { id: 'bot', name: 'Bot', icon: '🐟', rarity: 'common', minKg: 0.1, maxKg: 0.8, basePrice: 4 },
      { id: 'wijting', name: 'Wijting', icon: '🐟', rarity: 'common', minKg: 0.15, maxKg: 1, basePrice: 4 },
      { id: 'zeebaars', name: 'Zeebaars', icon: '🐟', rarity: 'uncommon', minKg: 0.5, maxKg: 4, basePrice: 12 },
      { id: 'schol', name: 'Schol', icon: '🐠', rarity: 'uncommon', minKg: 0.2, maxKg: 1.5, basePrice: 7 },
      { id: 'schar', name: 'Schar', icon: '🐟', rarity: 'uncommon', minKg: 0.1, maxKg: 0.8, basePrice: 6 },
      { id: 'tong', name: 'Tong', icon: '🐟', rarity: 'rare', minKg: 0.2, maxKg: 1.2, basePrice: 18 },
      { id: 'poon', name: 'Poon', icon: '🐟', rarity: 'rare', minKg: 0.2, maxKg: 1.5, basePrice: 16 },
      { id: 'zeewolf', name: 'Zeewolf', icon: '🐡', rarity: 'epic', minKg: 2, maxKg: 15, basePrice: 60 }
    ]
  },
  {
    id: 'kust-wad',
    biome: 'kust',
    name: 'Wadden & Diepere Kust',
    icon: '🌫️',
    description: 'Troebele wadwateren en de diepere randen van de kust.',
    rewardGear: 'bait',
    fish: [
      { id: 'ansjovis', name: 'Ansjovis', icon: '🐟', rarity: 'common', minKg: 0.02, maxKg: 0.1, basePrice: 3 },
      { id: 'sprot', name: 'Sprot', icon: '🐟', rarity: 'common', minKg: 0.02, maxKg: 0.15, basePrice: 3 },
      { id: 'horsmakreel', name: 'Horsmakreel', icon: '🐟', rarity: 'common', minKg: 0.1, maxKg: 0.6, basePrice: 5 },
      { id: 'pitvis', name: 'Pitvis', icon: '🐟', rarity: 'common', minKg: 0.05, maxKg: 0.3, basePrice: 4 },
      { id: 'harder', name: 'Harder', icon: '🐟', rarity: 'uncommon', minKg: 0.3, maxKg: 2, basePrice: 9 },
      { id: 'zeedonderpad', name: 'Zeedonderpad', icon: '🐡', rarity: 'uncommon', minKg: 0.1, maxKg: 0.6, basePrice: 8 },
      { id: 'schartong', name: 'Schartong', icon: '🐟', rarity: 'uncommon', minKg: 0.15, maxKg: 0.9, basePrice: 9 },
      { id: 'gladde-haai', name: 'Gladde Haai', icon: '🦈', rarity: 'rare', minKg: 2, maxKg: 10, basePrice: 28 },
      { id: 'griet', name: 'Griet', icon: '🐠', rarity: 'rare', minKg: 0.5, maxKg: 6, basePrice: 26 },
      { id: 'koolvis', name: 'Koolvis', icon: '🐟', rarity: 'epic', minKg: 3, maxKg: 18, basePrice: 55 }
    ]
  },
  {
    id: 'atlantisch-diepzee',
    biome: 'atlantisch',
    name: 'Atlantische Diepzee',
    icon: '🌊',
    description: 'De ruige, diepe wateren van de Atlantische Oceaan.',
    rewardGear: 'boat',
    fish: [
      { id: 'schelvis', name: 'Schelvis', icon: '🐟', rarity: 'common', minKg: 0.3, maxKg: 3, basePrice: 8 },
      { id: 'leng', name: 'Leng', icon: '🐟', rarity: 'common', minKg: 1, maxKg: 8, basePrice: 9 },
      { id: 'blauwe-wijting', name: 'Blauwe Wijting', icon: '🐟', rarity: 'common', minKg: 0.2, maxKg: 1.5, basePrice: 7 },
      { id: 'zilversmelt', name: 'Zilversmelt', icon: '🐟', rarity: 'common', minKg: 0.1, maxKg: 0.6, basePrice: 6 },
      { id: 'kabeljauw', name: 'Kabeljauw', icon: '🐟', rarity: 'uncommon', minKg: 1, maxKg: 15, basePrice: 14 },
      { id: 'roodbaars', name: 'Roodbaars', icon: '🐠', rarity: 'uncommon', minKg: 0.4, maxKg: 3, basePrice: 13 },
      { id: 'atlantische-heek', name: 'Atlantische Heek', icon: '🐟', rarity: 'uncommon', minKg: 0.5, maxKg: 4, basePrice: 12 },
      { id: 'heilbot', name: 'Heilbot', icon: '🐡', rarity: 'rare', minKg: 5, maxKg: 60, basePrice: 35 },
      { id: 'tonijn', name: 'Tonijn', icon: '🐟', rarity: 'rare', minKg: 10, maxKg: 120, basePrice: 55 },
      { id: 'zwaardvis', name: 'Zwaardvis', icon: '🗡️', rarity: 'epic', minKg: 20, maxKg: 200, basePrice: 90 }
    ]
  },
  {
    id: 'atlantisch-oceaanjagers',
    biome: 'atlantisch',
    name: 'Oceaanjagers',
    icon: '🦈',
    description: 'Grote, snelle jagers op open Atlantisch water.',
    rewardGear: 'boat',
    fish: [
      { id: 'goudmakreel', name: 'Goudmakreel', icon: '🐟', rarity: 'common', minKg: 1, maxKg: 8, basePrice: 10 },
      { id: 'atlantische-zalm', name: 'Atlantische Zalm', icon: '🐟', rarity: 'common', minKg: 1, maxKg: 6, basePrice: 12 },
      { id: 'blauwe-haai', name: 'Blauwe Haai', icon: '🦈', rarity: 'common', minKg: 3, maxKg: 15, basePrice: 15 },
      { id: 'pelamide', name: 'Pelamide', icon: '🐟', rarity: 'common', minKg: 0.5, maxKg: 4, basePrice: 9 },
      { id: 'geelvintonijn', name: 'Geelvintonijn', icon: '🐟', rarity: 'uncommon', minKg: 5, maxKg: 60, basePrice: 30 },
      { id: 'witte-tonijn', name: 'Witte Tonijn', icon: '🐟', rarity: 'uncommon', minKg: 3, maxKg: 25, basePrice: 26 },
      { id: 'koningsmakreel', name: 'Koningsmakreel', icon: '🐟', rarity: 'uncommon', minKg: 2, maxKg: 20, basePrice: 24 },
      { id: 'blauwvintonijn', name: 'Blauwvintonijn', icon: '🐟', rarity: 'rare', minKg: 20, maxKg: 300, basePrice: 70 },
      { id: 'hamerhaai', name: 'Hamerhaai', icon: '🦈', rarity: 'rare', minKg: 10, maxKg: 80, basePrice: 65 },
      { id: 'marlijn', name: 'Marlijn', icon: '🗡️', rarity: 'epic', minKg: 30, maxKg: 250, basePrice: 100 }
    ]
  },
  {
    id: 'middellandse-zee-kust',
    biome: 'middellandse-zee',
    name: 'Middellandse Zee',
    icon: '🏛️',
    description: 'Warme wateren rond eilanden en riffen in het zuiden.',
    rewardGear: 'boat',
    fish: [
      { id: 'dorade', name: 'Dorade', icon: '🐟', rarity: 'common', minKg: 0.2, maxKg: 1.5, basePrice: 6 },
      { id: 'zeebrasem', name: 'Zeebrasem', icon: '🐟', rarity: 'common', minKg: 0.2, maxKg: 1.8, basePrice: 6 },
      { id: 'sardien', name: 'Sardien', icon: '🐟', rarity: 'common', minKg: 0.03, maxKg: 0.2, basePrice: 3 },
      { id: 'ansjovis-zuid', name: 'Zuiderse Ansjovis', icon: '🐟', rarity: 'common', minKg: 0.02, maxKg: 0.1, basePrice: 3 },
      { id: 'mul', name: 'Rode Mul', icon: '🐠', rarity: 'uncommon', minKg: 0.1, maxKg: 0.6, basePrice: 10 },
      { id: 'goudbrasem', name: 'Goudbrasem', icon: '🐠', rarity: 'uncommon', minKg: 0.2, maxKg: 1.2, basePrice: 11 },
      { id: 'poon-zuid', name: 'Zuiderse Poon', icon: '🐟', rarity: 'uncommon', minKg: 0.2, maxKg: 1.4, basePrice: 10 },
      { id: 'tandbaars', name: 'Tandbaars', icon: '🐟', rarity: 'rare', minKg: 2, maxKg: 40, basePrice: 28 },
      { id: 'lipvis', name: 'Lipvis', icon: '🐠', rarity: 'rare', minKg: 0.2, maxKg: 1.5, basePrice: 24 },
      { id: 'leervis', name: 'Leervis', icon: '🐡', rarity: 'epic', minKg: 5, maxKg: 50, basePrice: 45 }
    ]
  },
  {
    id: 'middellandse-zee-exotisch',
    biome: 'middellandse-zee',
    name: 'Exotische Wateren',
    icon: '🐠',
    description: 'Zeldzame gasten uit warmere en diepere Middellandse wateren.',
    rewardGear: 'bait',
    fish: [
      { id: 'goudbaars', name: 'Goudbaars', icon: '🐠', rarity: 'common', minKg: 0.1, maxKg: 0.8, basePrice: 6 },
      { id: 'harder-zuid', name: 'Zuiderse Harder', icon: '🐟', rarity: 'common', minKg: 0.3, maxKg: 2, basePrice: 8 },
      { id: 'zeepaling', name: 'Zeepaling', icon: '🐟', rarity: 'common', minKg: 0.3, maxKg: 3, basePrice: 9 },
      { id: 'sardinella', name: 'Sardinella', icon: '🐟', rarity: 'common', minKg: 0.03, maxKg: 0.2, basePrice: 4 },
      { id: 'barracuda', name: 'Barracuda', icon: '🐟', rarity: 'uncommon', minKg: 1, maxKg: 8, basePrice: 20 },
      { id: 'papegaaivis', name: 'Papegaaivis', icon: '🐠', rarity: 'uncommon', minKg: 0.3, maxKg: 2, basePrice: 16 },
      { id: 'koningsvis', name: 'Koningsvis', icon: '🐠', rarity: 'uncommon', minKg: 0.5, maxKg: 3, basePrice: 18 },
      { id: 'keizersnapper', name: 'Keizersnapper', icon: '🐠', rarity: 'rare', minKg: 1, maxKg: 10, basePrice: 32 },
      { id: 'murene', name: 'Murene', icon: '🐍', rarity: 'rare', minKg: 1, maxKg: 12, basePrice: 30 },
      { id: 'tonijnhaai', name: 'Tonijnhaai', icon: '🦈', rarity: 'epic', minKg: 15, maxKg: 100, basePrice: 80 }
    ]
  },
  {
    id: 'nacht-diepte',
    biome: 'atlantisch',
    name: 'Nachtdiepte',
    icon: '🌑',
    description: 'Vissen die enkel in het donker naar de oppervlakte komen.',
    rewardGear: 'bait',
    nightOnly: true,
    fish: [
      { id: 'lantaarnvis', name: 'Lantaarnvis', icon: '🐟', rarity: 'common', minKg: 0.05, maxKg: 0.4, basePrice: 9 },
      { id: 'spookgarnaal', name: 'Spookgarnaal', icon: '🦐', rarity: 'common', minKg: 0.02, maxKg: 0.1, basePrice: 7 },
      { id: 'nachtaal', name: 'Nachtaal', icon: '🐍', rarity: 'uncommon', minKg: 0.3, maxKg: 3, basePrice: 18 },
      { id: 'schaduwrog', name: 'Schaduwrog', icon: '🐡', rarity: 'rare', minKg: 2, maxKg: 20, basePrice: 40 },
      { id: 'maanvis', name: 'Maanvis', icon: '🌕', rarity: 'epic', minKg: 5, maxKg: 40, basePrice: 95 }
    ]
  }
];

const RARITY_LABEL = { common: 'Gewoon', uncommon: 'Ongewoon', rare: 'Zeldzaam', epic: 'Episch' };

const FISH_BY_ID = new Map();
const SETS_BY_BIOME = new Map();
for (const set of SETS) {
  if (!SETS_BY_BIOME.has(set.biome)) SETS_BY_BIOME.set(set.biome, []);
  SETS_BY_BIOME.get(set.biome).push(set);
  for (const fish of set.fish) FISH_BY_ID.set(fish.id, { ...fish, biome: set.biome, setId: set.id, nightOnly: Boolean(set.nightOnly) });
}

// `isNight` bepaalt of nachtsoorten (nightOnly-sets) meedoen: overdag vallen
// ze weg, 's nachts komen ze er gewoon bovenop — bestaande soorten blijven
// dus altijd vangbaar, ongeacht tijdstip.
function fishForBiome(biome, isNight = false) {
  const sets = SETS_BY_BIOME.get(biome);
  if (!sets) return null;
  return sets.filter((set) => isNight || !set.nightOnly).flatMap((set) => set.fish);
}

function getFish(id) {
  return FISH_BY_ID.get(id) || null;
}

function priceFor(speciesId, weightKg, bonusMultiplier = 1) {
  const fish = getFish(speciesId);
  if (!fish) return 0;
  const span = Math.max(0.001, fish.maxKg - fish.minKg);
  const factor = 0.5 + Math.min(1, Math.max(0, (weightKg - fish.minKg) / span));
  return Math.max(1, Math.round(fish.basePrice * factor * bonusMultiplier));
}

module.exports = { SETS, RARITY_LABEL, fishForBiome, getFish, priceFor };
