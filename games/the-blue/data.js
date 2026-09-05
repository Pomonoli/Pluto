'use strict';

/**
 * The Blue — statische, data-driven spelinhoud.
 * Alles wat een ontwerper zou willen aanpassen (soorten, recepten, tiers)
 * staat hier als platte data, nooit als logica.
 */

const TIER_ORDER = ['bare', 'hout', 'steen', 'brons'];

const TIERS = {
  bare: { label: 'Blote handen', power: 1, die: 4, bonus: 0, maxDurability: 0 },
  hout: { label: 'Hout', power: 2, die: 6, bonus: 0, maxDurability: 36 },
  steen: { label: 'Steen', power: 3, die: 6, bonus: 1, maxDurability: 54 },
  brons: { label: 'Brons', power: 4, die: 8, bonus: 2, maxDurability: 80 }
};

function tierIndex(tier) { return TIER_ORDER.indexOf(tier); }

const ITEM_META = {
  hout: { label: 'Hout', value: 1 },
  steen: { label: 'Steen', value: 1 },
  koper: { label: 'Koper', value: 3 },
  tin: { label: 'Tin', value: 3 },
  vezel: { label: 'Vezel', value: 1 },
  bosbes: { label: 'Bosbessen', value: 1 },
  vlees: { label: 'Rauw vlees', value: 2 },
  huid: { label: 'Dierenhuid', value: 3 },
  wolfshuid: { label: 'Wolvenhuid', value: 5 },
  geroosterd_vlees: { label: 'Geroosterd vlees', value: 4 },
  geroosterde_vis: { label: 'Gerookte... nee, geroosterde vis', value: 4 },
  vissoep: { label: 'Vissoep', value: 8 },
  stoofpot: { label: 'Zwijnstoofpot', value: 10 }
};

/**
 * Vissoorten. zones: 1 = Het Ondiep (waden), 2 = De Kelpwouden (vlot nodig).
 * time: 'day' | 'night' | 'any'. rarity bepaalt de gewichten bij vangst.
 */
const FISH = [
  { id: 'baars', name: 'Baars', zones: [1], time: 'any', rarity: 'common', flavor: 'Elke sloot heeft er wel eentje. Deze ook.' },
  { id: 'brasem', name: 'Brasem', zones: [1], time: 'any', rarity: 'common', flavor: 'Breed, saai, en verrassend voedzaam.' },
  { id: 'voorn', name: 'Voorn', zones: [1], time: 'day', rarity: 'common', flavor: 'Bijt op alles. Vraagt niet veel van je.' },
  { id: 'snoek', name: 'Snoek', zones: [1], time: 'day', rarity: 'uncommon', flavor: 'Tanden als een reden om je vingers weg te houden.' },
  { id: 'karper', name: 'Karper', zones: [1], time: 'day', rarity: 'uncommon', flavor: 'Loom, log, en niet onder de indruk van jouw aas.' },
  { id: 'paling', name: 'Paling', zones: [1], time: 'night', rarity: 'uncommon', flavor: 'Glibbert weg. Blijft weg glibberen. Uiteindelijk niet meer.' },
  { id: 'meerval', name: 'Meerval', zones: [1], time: 'night', rarity: 'rare', flavor: 'Groter dan gepast voor ondiep water.' },
  { id: 'kikkervis', name: 'Slijmerige grondel', zones: [1], time: 'night', rarity: 'common', flavor: 'Niemand is hier trots op. Toch telt hij mee.' },
  { id: 'haring', name: 'Haring', zones: [2], time: 'any', rarity: 'common', flavor: 'De basis van elke visserseconomie sinds mensenheugenis.' },
  { id: 'makreel', name: 'Makreel', zones: [2], time: 'day', rarity: 'common', flavor: 'Snel, zilver, en telkens met twee tegelijk.' },
  { id: 'tong', name: 'Tong', zones: [2], time: 'day', rarity: 'uncommon', flavor: 'Plat genoeg om over het hoofd te zien. Bijna.' },
  { id: 'kabeljauw', name: 'Kabeljauw', zones: [2], time: 'day', rarity: 'uncommon', flavor: 'Stevig genoeg om een gerecht naar te vernoemen.' },
  { id: 'zeebaars', name: 'Zeebaars', zones: [2], time: 'any', rarity: 'uncommon', flavor: 'Duurder op de markt dan in het water.' },
  { id: 'poon', name: 'Zeepoon', zones: [2], time: 'day', rarity: 'uncommon', flavor: 'Loopt bijna over de bodem op zijn vinnen. Bijna.' },
  { id: 'inktvis', name: 'Inktvis', zones: [2], time: 'night', rarity: 'rare', flavor: 'Laat een wolk achter en de twijfel of je gewonnen hebt.' },
  { id: 'zwaardvis', name: 'Zwaardvis', zones: [2], time: 'night', rarity: 'rare', flavor: 'Te groot voor deze lijn. Vist toch door.' },
  { id: 'diepzeekwal', name: 'Lichtgevende kwal', zones: [2], time: 'night', rarity: 'uncommon', flavor: 'Niet eetbaar. Wel het bewaren waard.' },
  { id: 'zeepaling', name: 'Zeepaling', zones: [2], time: 'night', rarity: 'uncommon', flavor: 'Familie van de gewone paling. Grotere tanden, zelfde houding.' },
  { id: 'harder', name: 'Harder', zones: [2], time: 'any', rarity: 'common', flavor: 'Springt uit het water voor niemand in het bijzonder.' },
  { id: 'oude_meerman', name: 'De Oude Meerman', zones: [2], time: 'night', rarity: 'legendary', flavor: 'Een vis met een naam. Dat betekent nooit iets goeds voor je lijn.' }
];

const RARITY_WEIGHT = { common: 60, uncommon: 28, rare: 10, legendary: 2 };

const WILDLIFE = {
  zwijn: {
    id: 'zwijn', name: 'Wildzwijn', time: 'any',
    hp: 26, die: 6, dieCount: 1, bonus: 0, armor: 0, speed: 1,
    loot: { vlees: [2, 3], huid: [1, 1] },
    flavor: 'Verdedigt zijn stuk bos alsof het zijn stuk bos is.'
  },
  wolf: {
    id: 'wolf', name: 'Wolf', time: 'night',
    hp: 22, die: 8, dieCount: 1, bonus: 0, armor: 1, speed: 2,
    loot: { vlees: [1, 2], wolfshuid: [1, 1] },
    flavor: 'Jaagt liever in het donker. Jij ook, blijkbaar, vanavond.'
  }
};

const NODE_TYPES = {
  boom: { label: 'Boom', tool: 'axe', minTier: 'bare', uses: 3, yieldItem: 'hout', respawnMs: 90000 },
  rots: { label: 'Rotsblok', tool: 'pickaxe', minTier: 'bare', uses: 4, yieldItem: 'steen', respawnMs: 120000 },
  erts: { label: 'Ertsader', tool: 'pickaxe', minTier: 'steen', uses: 2, yieldItem: null, respawnMs: 150000 },
  struik: { label: 'Bessenstruik', tool: null, minTier: 'bare', uses: 2, yieldItem: 'bosbes', respawnMs: 60000 }
};

const ROAST_RECIPES = {
  roast_vis: { label: 'Vis roosteren', input: 'vis', output: 'geroosterde_vis', cookMs: 2000, energy: 20 },
  roast_vlees: { label: 'Vlees roosteren', input: 'vlees', output: 'geroosterd_vlees', cookMs: 2500, energy: 25 }
};

const COOK_RECIPES = {
  vissoep: {
    label: 'Vissoep', inputs: { vis: 1, bosbes: 1 }, output: 'vissoep', cookMs: 4000, energy: 40,
    buff: { stat: 'fishBonus', value: 0.15, minutes: 15, label: 'Vislijn-gevoel' }
  },
  stoofpot: {
    label: 'Zwijnstoofpot', inputs: { vlees: 1, bosbes: 2 }, output: 'stoofpot', cookMs: 6000, energy: 55,
    buff: { stat: 'combatBonus', value: 1, minutes: 15, label: 'Volle maag' }
  }
};

const CRAFT_RECIPES = {
  axe_hout: { label: 'Bijl (hout)', kind: 'tool', slot: 'axe', tier: 'hout', station: 'werkbank', cost: { hout: 8 } },
  axe_steen: { label: 'Bijl (steen)', kind: 'tool', slot: 'axe', tier: 'steen', station: 'werkbank', cost: { hout: 6, steen: 10 } },
  axe_brons: { label: 'Bijl (brons)', kind: 'tool', slot: 'axe', tier: 'brons', station: 'smidse', cost: { hout: 4, koper: 8, tin: 4 } },
  pickaxe_hout: { label: 'Houweel (hout)', kind: 'tool', slot: 'pickaxe', tier: 'hout', station: 'werkbank', cost: { hout: 8 } },
  pickaxe_steen: { label: 'Houweel (steen)', kind: 'tool', slot: 'pickaxe', tier: 'steen', station: 'werkbank', cost: { hout: 6, steen: 10 } },
  pickaxe_brons: { label: 'Houweel (brons)', kind: 'tool', slot: 'pickaxe', tier: 'brons', station: 'smidse', cost: { hout: 4, koper: 8, tin: 4 } },
  rod_hout: { label: 'Hengel (hout)', kind: 'tool', slot: 'rod', tier: 'hout', station: 'werkbank', cost: { hout: 6, vezel: 2 } },
  rod_steen: { label: 'Hengel (steen)', kind: 'tool', slot: 'rod', tier: 'steen', station: 'werkbank', cost: { hout: 6, steen: 8, vezel: 2 } },
  rod_brons: { label: 'Hengel (brons)', kind: 'tool', slot: 'rod', tier: 'brons', station: 'smidse', cost: { hout: 4, koper: 6, vezel: 4 } },
  weapon_hout: { label: 'Speer (hout)', kind: 'tool', slot: 'weapon', tier: 'hout', station: 'werkbank', cost: { hout: 10 } },
  weapon_steen: { label: 'Speer (steen)', kind: 'tool', slot: 'weapon', tier: 'steen', station: 'werkbank', cost: { hout: 6, steen: 10 } },
  weapon_brons: { label: 'Speer (brons)', kind: 'tool', slot: 'weapon', tier: 'brons', station: 'smidse', cost: { hout: 4, koper: 10, tin: 4 } },
  armor_hout: { label: 'Berkenschild', kind: 'tool', slot: 'armor', tier: 'hout', station: 'werkbank', cost: { hout: 12 } },
  armor_steen: { label: 'Stenen schild', kind: 'tool', slot: 'armor', tier: 'steen', station: 'werkbank', cost: { hout: 6, steen: 14 } },
  armor_brons: { label: 'Bronzen harnas', kind: 'tool', slot: 'armor', tier: 'brons', station: 'smidse', cost: { koper: 10, tin: 6, huid: 4 } },
  kookvuur: { label: 'Kookvuur bouwen', kind: 'camp', flag: 'hasKookvuur', station: 'werkbank', cost: { steen: 15, hout: 5 } },
  smidse: { label: 'Smidse bouwen', kind: 'camp', flag: 'hasSmidse', station: 'werkbank', cost: { steen: 25, koper: 6 } },
  vlot: { label: 'Vlot bouwen', kind: 'raft', station: 'werkbank', cost: { hout: 20, vezel: 6 } }
};

module.exports = {
  TIER_ORDER, TIERS, tierIndex, ITEM_META, FISH, RARITY_WEIGHT, WILDLIFE,
  NODE_TYPES, ROAST_RECIPES, COOK_RECIPES, CRAFT_RECIPES
};
