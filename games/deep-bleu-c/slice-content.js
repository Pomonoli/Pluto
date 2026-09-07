'use strict';

// De eerste verticale slice staat bewust als data naast de generieke reducers.
// Zo kunnen kosten, gates en nieuwe content worden aangepast zonder spelcode te
// herschrijven. validateSliceContent faalt vroeg bij een onvolledige release.
const SLICE_CONTENT = {
  tools: {
    axe: {
      tiers: [
        { tier: 1, name: 'Bijl I', access: ['berk', 'grove-den'] },
        {
          tier: 2,
          name: 'Bijl II',
          access: ['berk', 'grove-den', 'eik'],
          requires: { softWoodKg: 30, cash: 120, skill: 8, station: 'workbench' },
          benefit: 'Ontsluit eik en verbruikt 15% minder energie op zacht hout.'
        }
      ]
    }
  },
  nodes: {
    birch: { id: 'berk', name: 'Berk', toolTier: 1, skill: 1, xp: 190, minKg: 5, maxKg: 8, softWood: true },
    pine: { id: 'grove-den', name: 'Grove den', toolTier: 1, skill: 1, xp: 165, minKg: 6, maxKg: 9, softWood: true },
    oak: { id: 'eik', name: 'Eik', toolTier: 2, skill: 8, xp: 240, minKg: 8, maxKg: 13, softWood: false },
    kelp: { id: 'kelpvezel', name: 'Kelpvezel', icon: '🌿', rarity: 'rare', toolTier: 1, skill: 1, xp: 80, minKg: 1, maxKg: 2 }
  },
  stations: {
    workbench: { id: 'workbench', name: 'Werkbank', icon: '🪚', slots: 1, cost: { softWoodKg: 6 }, help: 'Vereist voor gereedschapsupgrades.' },
    cookingTable: { id: 'cookingTable', name: 'Kooktafel', icon: '🍳', slots: 1, cost: { softWoodKg: 4 }, help: 'Bereidt vangst tot expeditievoedsel.' }
  },
  recipes: {
    cookedCatch: { id: 'cooked-catch', name: 'Bereide vangst', station: 'cookingTable', input: { rawCatch: 1 } },
    expeditionSupply: { id: 'expedition-supply', name: 'Expeditierantsoen', station: 'workbench', input: { cookedCatch: 1, kelpFiber: 1 } }
  },
  zones: {
    starter: { id: 'starter-island', name: 'Starteiland', tiles: ['L', 'B', 'f', 'h', 'p'] },
    kelp: { id: 'kelp-island', name: 'Wierlicht', tiles: ['K', 'q'], uniqueMaterial: 'kelpvezel' }
  },
  boat: { hull: 'kano', name: 'Kano', tier: 1, maxHp: 100, baseSlots: 2 },
  discoveries: {
    kelpIsland: { id: 'kelp-island', name: 'Wierlicht', reward: 'Kelpvezel' }
  }
};

function validateSliceContent(content = SLICE_CONTENT) {
  const fail = (message) => { throw new Error(`Ongeldige Big Blue C-content: ${message}`); };
  const axeTiers = content?.tools?.axe?.tiers;
  if (!Array.isArray(axeTiers) || axeTiers.length < 2) fail('Bijl I en II ontbreken.');
  if (axeTiers.some((tier, index) => tier.tier !== index + 1 || !tier.name || !Array.isArray(tier.access))) fail('ongeldig bijlpad.');
  const stationIds = new Set(Object.values(content.stations || {}).map((station) => station.id));
  if (!stationIds.has(axeTiers[1].requires?.station)) fail('werkblok voor Bijl II bestaat niet.');
  for (const [key, node] of Object.entries(content.nodes || {})) {
    if (!node.id || !node.name || node.toolTier < 1 || node.skill < 1 || node.minKg > node.maxKg) fail(`ongeldige node ${key}.`);
  }
  for (const [key, recipe] of Object.entries(content.recipes || {})) {
    if (!recipe.id || !recipe.name || !stationIds.has(recipe.station)) fail(`ongeldig recept ${key}.`);
  }
  if (!content.zones?.starter || !content.zones?.kelp) fail('VS1-zones ontbreken.');
  if (!content.boat?.hull || content.boat.baseSlots < 1 || content.boat.maxHp < 1) fail('ongeldige startboot.');
  return content;
}

module.exports = validateSliceContent();
module.exports.validateSliceContent = validateSliceContent;
