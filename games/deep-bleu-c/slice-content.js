'use strict';

// De eerste verticale slice staat bewust als data naast de generieke reducers.
// Zo kunnen kosten, gates en nieuwe content worden aangepast zonder spelcode te
// herschrijven. validateSliceContent faalt vroeg bij een onvolledige release.
const SLICE_CONTENT = {
  tools: {
    rod: {
      label: 'Hengel', icon: '🎣', skill: 'fishing', skillLabel: 'Vissen',
      tiers: [
        { tier: 1, name: 'Hengel I', benefit: 'De basishengel voor ondiep water.' },
        { tier: 2, name: 'Hengel II', requires: { softWoodKg: 8, cash: 150, skill: 3, station: 'workbench' }, benefit: 'Geeft meer tijd om bij een beet aan te slaan.' },
        { tier: 3, name: 'Hengel III', requires: { softWoodKg: 18, cash: 400, skill: 8, station: 'workbench' }, benefit: 'Vergroot het tijdvenster bij iedere vangst verder.' },
        { tier: 4, name: 'Hengel IV', requires: { softWoodKg: 35, cash: 900, skill: 18, station: 'workbench' }, benefit: 'Een nauwkeurige hengel voor zware visgronden.' },
        { tier: 5, name: 'Hengel V', requires: { softWoodKg: 60, cash: 1800, skill: 35, station: 'workbench' }, benefit: 'Het ruimste tijdvenster om aan te slaan.' }
      ]
    },
    bait: {
      label: 'Aas', icon: '🪱', skill: 'fishing', skillLabel: 'Vissen',
      tiers: [
        { tier: 1, name: 'Aas I', benefit: 'Eenvoudig aas voor gewone vangsten.' },
        { tier: 2, name: 'Aas II', requires: { kelpFiber: 1, cash: 150, skill: 3, station: 'workbench' }, benefit: 'Trekt vaker zeldzame en epische vis aan.' },
        { tier: 3, name: 'Aas III', requires: { kelpFiber: 3, cash: 400, skill: 8, station: 'workbench' }, benefit: 'Verhoogt de kans op bijzondere vis verder.' },
        { tier: 4, name: 'Aas IV', requires: { kelpFiber: 6, cash: 900, skill: 18, station: 'workbench' }, benefit: 'Sterk wiermengsel voor zeldzame vangsten.' },
        { tier: 5, name: 'Aas V', requires: { kelpFiber: 10, cash: 1800, skill: 35, station: 'workbench' }, benefit: 'De grootste kans op zeldzame en epische vis.' }
      ]
    },
    boat: {
      label: 'Vaartuig', icon: '⛵', skill: 'collecting', skillLabel: 'Verzamelen',
      tiers: [
        { tier: 1, name: 'Kano', hull: 'kano', benefit: 'Vaart door Het Ondiep naar Wierlicht.' },
        { tier: 2, name: 'Vlot', hull: 'vlot', requires: { softWoodKg: 15, cash: 150, skill: 3, station: 'workbench' }, benefit: 'Een stevigere basis voor kusttochten.' },
        { tier: 3, name: 'Sloep', hull: 'sloep', requires: { softWoodKg: 35, cash: 400, skill: 8, station: 'workbench' }, benefit: 'Opent routes door de Wadzee.' },
        { tier: 4, name: 'Kogge', hull: 'kogge', requires: { softWoodKg: 70, cash: 900, skill: 18, station: 'workbench' }, benefit: 'Een zware romp voor verre expedities.' },
        { tier: 5, name: 'Langschip', hull: 'langschip', requires: { softWoodKg: 120, cash: 1800, skill: 35, station: 'workbench' }, benefit: 'Vaart overal, tot in de Rifzee.' }
      ]
    },
    axe: {
      label: 'Bijl', icon: '🪓', skill: 'woodcutting', skillLabel: 'Kappen',
      tiers: [
        { tier: 1, name: 'Bijl I', access: ['berk', 'grove-den'], benefit: 'De basisbijl voor zacht hout.' },
        {
          tier: 2,
          name: 'Bijl II',
          access: ['berk', 'grove-den', 'eik'],
          requires: { softWoodKg: 30, cash: 120, skill: 8, station: 'workbench' },
          benefit: 'Ontsluit eik en geeft meer tijd om raak te hakken.'
        },
        { tier: 3, name: 'Bijl III', access: ['berk', 'grove-den', 'eik'], requires: { softWoodKg: 45, cash: 400, skill: 18, station: 'workbench' }, benefit: 'Vergroot het tijdvenster bij het hakken verder.' },
        { tier: 4, name: 'Bijl IV', access: ['berk', 'grove-den', 'eik'], requires: { softWoodKg: 70, cash: 900, skill: 35, station: 'workbench' }, benefit: 'Een zware bijl voor taaie stammen.' },
        { tier: 5, name: 'Bijl V', access: ['berk', 'grove-den', 'eik'], requires: { softWoodKg: 110, cash: 1800, skill: 55, station: 'workbench' }, benefit: 'Het ruimste tijdvenster om raak te hakken.' }
      ]
    },
    pickaxe: {
      label: 'Houweel', icon: '⛏️', skill: 'mining', skillLabel: 'Delven',
      tiers: [
        { tier: 1, name: 'Houweel I', benefit: 'Het basishouweel voor losse steen.' },
        { tier: 2, name: 'Houweel II', requires: { rockKg: 10, cash: 150, skill: 3, station: 'workbench' }, benefit: 'Geeft meer tijd om een rots raak te houwen.' },
        { tier: 3, name: 'Houweel III', requires: { rockKg: 25, cash: 400, skill: 8, station: 'workbench' }, benefit: 'Vergroot het tijdvenster bij het delven verder.' },
        { tier: 4, name: 'Houweel IV', requires: { rockKg: 50, cash: 900, skill: 18, station: 'workbench' }, benefit: 'Een gehard houweel voor zware rots.' },
        { tier: 5, name: 'Houweel V', requires: { rockKg: 90, cash: 1800, skill: 35, station: 'workbench' }, benefit: 'Het ruimste tijdvenster om raak te houwen.' }
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
  const stationIds = new Set(Object.values(content.stations || {}).map((station) => station.id));
  const toolKeys = ['rod', 'bait', 'boat', 'axe', 'pickaxe'];
  for (const key of toolKeys) {
    const tool = content?.tools?.[key];
    if (!tool?.label || !tool.icon || !tool.skill || !tool.skillLabel || !Array.isArray(tool.tiers) || tool.tiers.length !== 5) fail(`ongeldig gereedschap ${key}.`);
    if (tool.tiers.some((tier, index) => tier.tier !== index + 1 || !tier.name || !tier.benefit)) fail(`ongeldig upgradepad ${key}.`);
    for (const tier of tool.tiers.slice(1)) {
      const requirements = tier.requires;
      const materialCount = ['softWoodKg', 'rockKg', 'kelpFiber'].filter((material) => requirements?.[material] > 0).length;
      if (!requirements || requirements.cash < 1 || requirements.skill < 1 || materialCount !== 1 || !stationIds.has(requirements.station)) fail(`ongeldige vereisten voor ${tier.name}.`);
    }
  }
  if (content.tools.axe.tiers.some((tier) => !Array.isArray(tier.access))) fail('ongeldig bijlpad.');
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
