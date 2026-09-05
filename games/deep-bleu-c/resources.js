'use strict';

// Hout en steen volgen exact hetzelfde patroon als fish.js: meerdere sets van
// elk 10 soorten, gebundeld per grondstof ("kind"). Er is bewust geen
// biome-opsplitsing zoals bij vis — elk bos-tegel (`f`) put uit dezelfde
// houtpool, elke bergpiek (`p`) uit dezelfde steenpool. `setId` wordt net als
// bij vis achteraf ingevuld zodat setbonussen generiek via `player.setBonuses`
// kunnen lopen.

const WOOD_SETS = [
  {
    id: 'loofbos',
    biome: 'bos',
    name: 'Loofbos',
    icon: '🌳',
    description: 'Gewone loofbomen uit de gematigde bossen van het vasteland.',
    rewardGear: 'axe',
    items: [
      { id: 'berk', name: 'Berk', icon: '🌳', rarity: 'common', minKg: 0.5, maxKg: 4, basePrice: 3 },
      { id: 'populier', name: 'Populier', icon: '🌳', rarity: 'common', minKg: 1, maxKg: 6, basePrice: 3 },
      { id: 'wilg', name: 'Wilg', icon: '🌳', rarity: 'common', minKg: 1, maxKg: 6, basePrice: 3 },
      { id: 'iep', name: 'Iep', icon: '🌳', rarity: 'common', minKg: 1, maxKg: 7, basePrice: 4 },
      { id: 'eik', name: 'Eik', icon: '🌳', rarity: 'uncommon', minKg: 2, maxKg: 12, basePrice: 9 },
      { id: 'beuk', name: 'Beuk', icon: '🌳', rarity: 'uncommon', minKg: 2, maxKg: 11, basePrice: 8 },
      { id: 'linde', name: 'Linde', icon: '🌳', rarity: 'uncommon', minKg: 2, maxKg: 13, basePrice: 8 },
      { id: 'esdoorn', name: 'Esdoorn', icon: '🍁', rarity: 'rare', minKg: 4, maxKg: 20, basePrice: 17 },
      { id: 'kastanje', name: 'Kastanje', icon: '🌳', rarity: 'rare', minKg: 5, maxKg: 22, basePrice: 19 },
      { id: 'treurwilg', name: 'Treurwilg', icon: '🌳', rarity: 'epic', minKg: 10, maxKg: 35, basePrice: 48 }
    ]
  },
  {
    id: 'naaldwoud',
    biome: 'bos',
    name: 'Naaldwoud',
    icon: '🌲',
    description: 'Naaldbomen uit de dichte, noordelijke wouden.',
    rewardGear: 'axe',
    items: [
      { id: 'grove-den', name: 'Grove Den', icon: '🌲', rarity: 'common', minKg: 1, maxKg: 7, basePrice: 4 },
      { id: 'fijnspar', name: 'Fijnspar', icon: '🌲', rarity: 'common', minKg: 1, maxKg: 8, basePrice: 4 },
      { id: 'lariks', name: 'Lariks', icon: '🌲', rarity: 'common', minKg: 1, maxKg: 7, basePrice: 4 },
      { id: 'jeneverbes', name: 'Jeneverbes', icon: '🌲', rarity: 'common', minKg: 0.3, maxKg: 3, basePrice: 5 },
      { id: 'zilverspar', name: 'Zilverspar', icon: '🌲', rarity: 'uncommon', minKg: 3, maxKg: 14, basePrice: 9 },
      { id: 'douglasspar', name: 'Douglasspar', icon: '🌲', rarity: 'uncommon', minKg: 3, maxKg: 16, basePrice: 10 },
      { id: 'zeeden', name: 'Zeeden', icon: '🌲', rarity: 'uncommon', minKg: 2, maxKg: 12, basePrice: 8 },
      { id: 'corsicaanse-den', name: 'Corsicaanse Den', icon: '🌲', rarity: 'rare', minKg: 5, maxKg: 24, basePrice: 18 },
      { id: 'taxus', name: 'Taxus', icon: '🌲', rarity: 'rare', minKg: 3, maxKg: 15, basePrice: 21 },
      { id: 'mammoetboom', name: 'Mammoetboom', icon: '🌲', rarity: 'epic', minKg: 15, maxKg: 50, basePrice: 55 }
    ]
  },
  {
    id: 'mediterraan-bos',
    biome: 'bos',
    name: 'Mediterraan Bos',
    icon: '🫒',
    description: 'Zon- en droogteminnend hout uit het zuiden.',
    rewardGear: 'axe',
    items: [
      { id: 'steeneik', name: 'Steeneik', icon: '🌳', rarity: 'common', minKg: 1, maxKg: 8, basePrice: 5 },
      { id: 'kurkeik', name: 'Kurkeik', icon: '🌳', rarity: 'common', minKg: 1, maxKg: 7, basePrice: 5 },
      { id: 'cipres', name: 'Cipres', icon: '🌲', rarity: 'common', minKg: 1, maxKg: 6, basePrice: 4 },
      { id: 'laurier', name: 'Laurier', icon: '🌿', rarity: 'common', minKg: 0.4, maxKg: 3, basePrice: 5 },
      { id: 'olijfboom', name: 'Olijfboom', icon: '🫒', rarity: 'uncommon', minKg: 1, maxKg: 6, basePrice: 12 },
      { id: 'amandelboom', name: 'Amandelboom', icon: '🌳', rarity: 'uncommon', minKg: 1, maxKg: 7, basePrice: 10 },
      { id: 'parasolden', name: 'Parasolden', icon: '🌲', rarity: 'uncommon', minKg: 3, maxKg: 15, basePrice: 11 },
      { id: 'vijgenboom', name: 'Vijgenboom', icon: '🌳', rarity: 'rare', minKg: 1, maxKg: 8, basePrice: 20 },
      { id: 'granaatappelboom', name: 'Granaatappelboom', icon: '🌳', rarity: 'rare', minKg: 1, maxKg: 6, basePrice: 22 },
      { id: 'ceder-van-libanon', name: 'Ceder van Libanon', icon: '🌲', rarity: 'epic', minKg: 12, maxKg: 40, basePrice: 52 }
    ]
  },
  {
    id: 'fruit-notenhout',
    biome: 'bos',
    name: 'Fruit- en Notenhout',
    icon: '🍎',
    description: 'Fruit- en notenbomen uit boomgaarden en erven.',
    rewardGear: 'axe',
    items: [
      { id: 'appelboom', name: 'Appelboom', icon: '🍎', rarity: 'common', minKg: 0.5, maxKg: 5, basePrice: 4 },
      { id: 'perenboom', name: 'Perenboom', icon: '🍐', rarity: 'common', minKg: 0.5, maxKg: 5, basePrice: 4 },
      { id: 'kersenboom', name: 'Kersenboom', icon: '🍒', rarity: 'common', minKg: 0.5, maxKg: 4, basePrice: 5 },
      { id: 'pruimenboom', name: 'Pruimenboom', icon: '🍑', rarity: 'common', minKg: 0.5, maxKg: 4, basePrice: 5 },
      { id: 'hazelaar', name: 'Hazelaar', icon: '🌰', rarity: 'uncommon', minKg: 0.5, maxKg: 4, basePrice: 9 },
      { id: 'notenboom', name: 'Notenboom', icon: '🌰', rarity: 'uncommon', minKg: 2, maxKg: 12, basePrice: 12 },
      { id: 'vlierboom', name: 'Vlierboom', icon: '🌳', rarity: 'uncommon', minKg: 0.5, maxKg: 4, basePrice: 9 },
      { id: 'mispel', name: 'Mispel', icon: '🌳', rarity: 'rare', minKg: 0.5, maxKg: 4, basePrice: 19 },
      { id: 'abrikozenboom', name: 'Abrikozenboom', icon: '🍑', rarity: 'rare', minKg: 0.5, maxKg: 5, basePrice: 20 },
      { id: 'perzikboom', name: 'Perzikboom', icon: '🍑', rarity: 'epic', minKg: 1, maxKg: 8, basePrice: 46 }
    ]
  },
  {
    id: 'exotisch-hout',
    biome: 'bos',
    name: 'Exotisch Hout',
    icon: '🪵',
    description: 'Zeldzaam hout dat je bij toeval tussen de rest aantreft.',
    rewardGear: 'axe',
    items: [
      { id: 'bamboe', name: 'Bamboe', icon: '🎍', rarity: 'common', minKg: 0.2, maxKg: 2, basePrice: 5 },
      { id: 'eucalyptushout', name: 'Eucalyptushout', icon: '🌳', rarity: 'common', minKg: 1, maxKg: 8, basePrice: 6 },
      { id: 'acaciahout', name: 'Acaciahout', icon: '🌳', rarity: 'common', minKg: 1, maxKg: 7, basePrice: 6 },
      { id: 'kurk', name: 'Kurk', icon: '🪵', rarity: 'common', minKg: 0.2, maxKg: 2, basePrice: 7 },
      { id: 'balsahout', name: 'Balsahout', icon: '🪵', rarity: 'uncommon', minKg: 0.3, maxKg: 3, basePrice: 13 },
      { id: 'sandelhout', name: 'Sandelhout', icon: '🪵', rarity: 'uncommon', minKg: 0.5, maxKg: 4, basePrice: 16 },
      { id: 'sequoia', name: 'Sequoia', icon: '🌲', rarity: 'uncommon', minKg: 6, maxKg: 25, basePrice: 15 },
      { id: 'mahonie', name: 'Mahonie', icon: '🪵', rarity: 'rare', minKg: 2, maxKg: 12, basePrice: 30 },
      { id: 'palissander', name: 'Palissander', icon: '🪵', rarity: 'rare', minKg: 2, maxKg: 10, basePrice: 34 },
      { id: 'ebbenhout', name: 'Ebbenhout', icon: '🪵', rarity: 'epic', minKg: 3, maxKg: 15, basePrice: 70 }
    ]
  }
];

const ROCK_SETS = [
  {
    id: 'bouwsteen',
    biome: 'berg',
    name: 'Bouwsteen',
    icon: '🪨',
    description: 'Gewone steensoorten die overal in de heuvels liggen.',
    rewardGear: 'pickaxe',
    items: [
      { id: 'kalksteen', name: 'Kalksteen', icon: '🪨', rarity: 'common', minKg: 1, maxKg: 10, basePrice: 3 },
      { id: 'zandsteen', name: 'Zandsteen', icon: '🪨', rarity: 'common', minKg: 1, maxKg: 9, basePrice: 3 },
      { id: 'grind', name: 'Grind', icon: '🪨', rarity: 'common', minKg: 1, maxKg: 8, basePrice: 3 },
      { id: 'krijt', name: 'Krijt', icon: '🪨', rarity: 'common', minKg: 0.5, maxKg: 6, basePrice: 3 },
      { id: 'leisteen', name: 'Leisteen', icon: '🪨', rarity: 'uncommon', minKg: 2, maxKg: 14, basePrice: 8 },
      { id: 'graniet', name: 'Graniet', icon: '🪨', rarity: 'uncommon', minKg: 3, maxKg: 18, basePrice: 9 },
      { id: 'kwartsiet', name: 'Kwartsiet', icon: '🪨', rarity: 'uncommon', minKg: 2, maxKg: 15, basePrice: 9 },
      { id: 'basalt', name: 'Basalt', icon: '🪨', rarity: 'rare', minKg: 4, maxKg: 22, basePrice: 17 },
      { id: 'dolomiet', name: 'Dolomiet', icon: '🪨', rarity: 'rare', minKg: 4, maxKg: 20, basePrice: 18 },
      { id: 'marmer', name: 'Marmer', icon: '🪨', rarity: 'epic', minKg: 8, maxKg: 35, basePrice: 44 }
    ]
  },
  {
    id: 'ertsen',
    biome: 'berg',
    name: 'Ertsen',
    icon: '⛰️',
    description: 'Metaalertsen, gedolven diep uit de berghellingen.',
    rewardGear: 'pickaxe',
    items: [
      { id: 'ijzererts', name: 'IJzererts', icon: '⛰️', rarity: 'common', minKg: 1, maxKg: 10, basePrice: 5 },
      { id: 'tinerts', name: 'Tinerts', icon: '⛰️', rarity: 'common', minKg: 1, maxKg: 9, basePrice: 5 },
      { id: 'zinkerts', name: 'Zinkerts', icon: '⛰️', rarity: 'common', minKg: 1, maxKg: 8, basePrice: 5 },
      { id: 'looderts', name: 'Looderts', icon: '⛰️', rarity: 'common', minKg: 1, maxKg: 9, basePrice: 5 },
      { id: 'kopererts', name: 'Kopererts', icon: '⛰️', rarity: 'uncommon', minKg: 2, maxKg: 14, basePrice: 11 },
      { id: 'nikkelerts', name: 'Nikkelerts', icon: '⛰️', rarity: 'uncommon', minKg: 2, maxKg: 13, basePrice: 12 },
      { id: 'chroomerts', name: 'Chroomerts', icon: '⛰️', rarity: 'uncommon', minKg: 2, maxKg: 12, basePrice: 12 },
      { id: 'mangaanerts', name: 'Mangaanerts', icon: '⛰️', rarity: 'rare', minKg: 3, maxKg: 18, basePrice: 22 },
      { id: 'bauxiet', name: 'Bauxiet', icon: '⛰️', rarity: 'rare', minKg: 3, maxKg: 17, basePrice: 21 },
      { id: 'wolfraamerts', name: 'Wolfraamerts', icon: '⛰️', rarity: 'epic', minKg: 5, maxKg: 25, basePrice: 58 }
    ]
  },
  {
    id: 'edelmetalen',
    biome: 'berg',
    name: 'Edelmetalen',
    icon: '✨',
    description: 'Zeldzame ertsaders met een hoog metaalgehalte.',
    rewardGear: 'pickaxe',
    items: [
      { id: 'ruw-koper', name: 'Ruw Koper', icon: '⛰️', rarity: 'common', minKg: 0.5, maxKg: 5, basePrice: 7 },
      { id: 'ruw-tin', name: 'Ruw Tin', icon: '⛰️', rarity: 'common', minKg: 0.5, maxKg: 5, basePrice: 7 },
      { id: 'cinnaber', name: 'Cinnaber', icon: '🟥', rarity: 'common', minKg: 0.3, maxKg: 3, basePrice: 9 },
      { id: 'antimoonerts', name: 'Antimoonerts', icon: '⛰️', rarity: 'common', minKg: 0.5, maxKg: 4, basePrice: 8 },
      { id: 'kobalterts', name: 'Kobalterts', icon: '🔷', rarity: 'uncommon', minKg: 1, maxKg: 8, basePrice: 18 },
      { id: 'molybdeenerts', name: 'Molybdeenerts', icon: '⛰️', rarity: 'uncommon', minKg: 1, maxKg: 8, basePrice: 17 },
      { id: 'titaniumerts', name: 'Titaniumerts', icon: '⛰️', rarity: 'uncommon', minKg: 1, maxKg: 9, basePrice: 19 },
      { id: 'zilverader', name: 'Zilverader', icon: '⚪', rarity: 'rare', minKg: 0.3, maxKg: 4, basePrice: 40 },
      { id: 'platina-erts', name: 'Platina-erts', icon: '⚪', rarity: 'rare', minKg: 0.2, maxKg: 3, basePrice: 48 },
      { id: 'gouderts', name: 'Gouderts', icon: '🟡', rarity: 'epic', minKg: 0.1, maxKg: 2, basePrice: 95 }
    ]
  },
  {
    id: 'edelstenen',
    biome: 'berg',
    name: 'Edelstenen',
    icon: '💎',
    description: 'Geslepen noch ongeslepen, maar altijd raak bij een verkoop.',
    rewardGear: 'pickaxe',
    items: [
      { id: 'kwarts', name: 'Kwarts', icon: '🔹', rarity: 'common', minKg: 0.1, maxKg: 1.5, basePrice: 8 },
      { id: 'amethist', name: 'Amethist', icon: '🟣', rarity: 'common', minKg: 0.1, maxKg: 1.2, basePrice: 9 },
      { id: 'toermalijn', name: 'Toermalijn', icon: '🟢', rarity: 'common', minKg: 0.1, maxKg: 1, basePrice: 10 },
      { id: 'granaat', name: 'Granaat', icon: '🔴', rarity: 'common', minKg: 0.1, maxKg: 1, basePrice: 9 },
      { id: 'aquamarijn', name: 'Aquamarijn', icon: '🔵', rarity: 'uncommon', minKg: 0.1, maxKg: 1.2, basePrice: 24 },
      { id: 'topaas', name: 'Topaas', icon: '🟡', rarity: 'uncommon', minKg: 0.1, maxKg: 1, basePrice: 25 },
      { id: 'opaal', name: 'Opaal', icon: '⚪', rarity: 'uncommon', minKg: 0.05, maxKg: 0.8, basePrice: 27 },
      { id: 'smaragd', name: 'Smaragd', icon: '🟢', rarity: 'rare', minKg: 0.05, maxKg: 0.8, basePrice: 55 },
      { id: 'robijn', name: 'Robijn', icon: '🔴', rarity: 'rare', minKg: 0.05, maxKg: 0.7, basePrice: 60 },
      { id: 'diamant', name: 'Diamant', icon: '💎', rarity: 'epic', minKg: 0.02, maxKg: 0.5, basePrice: 130 }
    ]
  },
  {
    id: 'zeldzame-mineralen',
    biome: 'berg',
    name: 'Zeldzame Mineralen',
    icon: '🌋',
    description: 'Ongewone vondsten die je zelden op deze diepte verwacht.',
    rewardGear: 'pickaxe',
    items: [
      { id: 'pyriet', name: 'Pyriet', icon: '🟡', rarity: 'common', minKg: 0.2, maxKg: 3, basePrice: 6 },
      { id: 'fluoriet', name: 'Fluoriet', icon: '🟣', rarity: 'common', minKg: 0.2, maxKg: 3, basePrice: 7 },
      { id: 'malachiet', name: 'Malachiet', icon: '🟢', rarity: 'common', minKg: 0.2, maxKg: 3, basePrice: 8 },
      { id: 'turkoois', name: 'Turkoois', icon: '🔵', rarity: 'common', minKg: 0.1, maxKg: 2, basePrice: 9 },
      { id: 'azuriet', name: 'Azuriet', icon: '🔵', rarity: 'uncommon', minKg: 0.2, maxKg: 3, basePrice: 20 },
      { id: 'lapis-lazuli', name: 'Lapis Lazuli', icon: '🔵', rarity: 'uncommon', minKg: 0.2, maxKg: 3, basePrice: 22 },
      { id: 'jade', name: 'Jade', icon: '🟢', rarity: 'uncommon', minKg: 0.2, maxKg: 4, basePrice: 23 },
      { id: 'barnsteen', name: 'Barnsteen', icon: '🟠', rarity: 'rare', minKg: 0.05, maxKg: 1, basePrice: 42 },
      { id: 'obsidiaan', name: 'Obsidiaan', icon: '⚫', rarity: 'rare', minKg: 0.5, maxKg: 6, basePrice: 38 },
      { id: 'meteoriet', name: 'Meteoriet', icon: '☄️', rarity: 'epic', minKg: 1, maxKg: 10, basePrice: 110 }
    ]
  }
];

// Wilde dieren, gejaagd op graslandtegels — zelfde patroon als hout/steen,
// maar met twee extra velden: `energy` (hoeveel een stuk vlees herstelt bij
// het opeten, zie doEat) en `combat` (hp/dobbelstenen/pantser voor het
// dobbelgevecht bij de jacht, zie DICE_BY_TIER en doHuntAction in server.js).
const ANIMAL_SETS = [
  {
    id: 'kleinwild',
    biome: 'wildernis',
    name: 'Kleinwild',
    icon: '🐇',
    description: 'Snel, schuw en overal op het eiland te vinden.',
    rewardGear: null,
    items: [
      { id: 'konijn', name: 'Konijn', icon: '🐇', rarity: 'common', minKg: 0.5, maxKg: 2, basePrice: 5, energy: 8, combat: { hp: 12, dice: { count: 1, sides: 4 }, armor: 0 } },
      { id: 'fazant', name: 'Fazant', icon: '🐦', rarity: 'common', minKg: 0.5, maxKg: 1.5, basePrice: 6, energy: 9, combat: { hp: 10, dice: { count: 1, sides: 4 }, armor: 0 } },
      { id: 'eekhoorn', name: 'Eekhoorn', icon: '🐿️', rarity: 'common', minKg: 0.1, maxKg: 0.5, basePrice: 3, energy: 4, combat: { hp: 8, dice: { count: 1, sides: 4 }, armor: 0 } },
      { id: 'egel', name: 'Egel', icon: '🦔', rarity: 'uncommon', minKg: 0.3, maxKg: 1, basePrice: 8, energy: 6, combat: { hp: 16, dice: { count: 1, sides: 6 }, armor: 1 } },
      { id: 'vos', name: 'Vos', icon: '🦊', rarity: 'uncommon', minKg: 3, maxKg: 8, basePrice: 14, energy: 12, combat: { hp: 22, dice: { count: 1, sides: 6 }, armor: 1 } },
      { id: 'das', name: 'Das', icon: '🦡', rarity: 'rare', minKg: 6, maxKg: 14, basePrice: 22, energy: 16, combat: { hp: 30, dice: { count: 2, sides: 6 }, armor: 2 } },
      { id: 'havik', name: 'Havik', icon: '🦅', rarity: 'epic', minKg: 0.5, maxKg: 1.5, basePrice: 48, energy: 14, combat: { hp: 26, dice: { count: 2, sides: 6 }, armor: 1 } }
    ]
  },
  {
    id: 'grofwild',
    biome: 'wildernis',
    name: 'Grofwild',
    icon: '🦌',
    description: 'Groot, gevaarlijk en zeldzamer — maar de moeite waard.',
    rewardGear: null,
    items: [
      { id: 'ree', name: 'Ree', icon: '🦌', rarity: 'common', minKg: 15, maxKg: 30, basePrice: 20, energy: 24, combat: { hp: 35, dice: { count: 1, sides: 8 }, armor: 1 } },
      { id: 'wild-zwijn', name: 'Wild Zwijn', icon: '🐗', rarity: 'uncommon', minKg: 40, maxKg: 90, basePrice: 34, energy: 32, combat: { hp: 55, dice: { count: 2, sides: 8 }, armor: 3 } },
      { id: 'steenbok', name: 'Steenbok', icon: '🐐', rarity: 'uncommon', minKg: 20, maxKg: 45, basePrice: 30, energy: 28, combat: { hp: 48, dice: { count: 2, sides: 6 }, armor: 2 } },
      { id: 'wolf', name: 'Wolf', icon: '🐺', rarity: 'rare', minKg: 25, maxKg: 45, basePrice: 55, energy: 30, combat: { hp: 60, dice: { count: 2, sides: 8 }, armor: 3 } },
      { id: 'hert', name: 'Edelhert', icon: '🦌', rarity: 'epic', minKg: 60, maxKg: 140, basePrice: 95, energy: 45, combat: { hp: 90, dice: { count: 3, sides: 8 }, armor: 4 } }
    ]
  },
  {
    id: 'nachtdieren',
    biome: 'wildernis',
    name: 'Nachtdieren',
    icon: '🦉',
    description: 'Enkel actief als het donker is.',
    rewardGear: null,
    nightOnly: true,
    items: [
      { id: 'uil', name: 'Uil', icon: '🦉', rarity: 'common', minKg: 0.3, maxKg: 1, basePrice: 10, energy: 7, combat: { hp: 14, dice: { count: 1, sides: 4 }, armor: 0 } },
      { id: 'vleermuis', name: 'Vleermuis', icon: '🦇', rarity: 'uncommon', minKg: 0.05, maxKg: 0.3, basePrice: 12, energy: 5, combat: { hp: 10, dice: { count: 1, sides: 4 }, armor: 0 } },
      { id: 'nachtwolf', name: 'Nachtwolf', icon: '🐺', rarity: 'rare', minKg: 25, maxKg: 45, basePrice: 60, energy: 26, combat: { hp: 50, dice: { count: 2, sides: 6 }, armor: 2 } }
    ]
  }
];

const RARITY_LABEL = { common: 'Gewoon', uncommon: 'Ongewoon', rare: 'Zeldzaam', epic: 'Episch' };

function buildIndex(sets) {
  const byId = new Map();
  const flat = [];
  for (const set of sets) {
    for (const item of set.items) {
      const enriched = { ...item, biome: set.biome, setId: set.id, nightOnly: Boolean(set.nightOnly) };
      byId.set(item.id, enriched);
      flat.push(enriched);
    }
  }
  return { byId, flat };
}

const INDEX = { wood: buildIndex(WOOD_SETS), rock: buildIndex(ROCK_SETS), meat: buildIndex(ANIMAL_SETS) };
const SETS_BY_KIND = { wood: WOOD_SETS, rock: ROCK_SETS, meat: ANIMAL_SETS };

function setsFor(kind) { return SETS_BY_KIND[kind] || []; }
// `isNight` filtert nightOnly-soorten (enkel relevant voor 'meat'; hout/steen
// hebben geen nachtsoorten, dus daar verandert de aanroep zonder opts niets).
function poolFor(kind, { isNight = true } = {}) {
  const flat = INDEX[kind] ? INDEX[kind].flat : [];
  return isNight ? flat : flat.filter((item) => !item.nightOnly);
}
function getItem(kind, id) { return INDEX[kind] ? INDEX[kind].byId.get(id) || null : null; }

function priceFor(kind, id, weightKg, bonusMultiplier = 1) {
  const item = getItem(kind, id);
  if (!item) return 0;
  const span = Math.max(0.001, item.maxKg - item.minKg);
  const factor = 0.5 + Math.min(1, Math.max(0, (weightKg - item.minKg) / span));
  return Math.max(1, Math.round(item.basePrice * factor * bonusMultiplier));
}

module.exports = { WOOD_SETS, ROCK_SETS, ANIMAL_SETS, RARITY_LABEL, setsFor, poolFor, getItem, priceFor };
