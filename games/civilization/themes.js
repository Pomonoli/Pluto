/**
 * Age of Civilization — visual theme spec, per Age, per building category.
 *
 * Each Age has a material palette and an architectural logic; each building
 * category within that Age gets its own color drawn from that palette (not
 * just a tinted variant of one accent) plus a short motif line. client.js
 * uses ERA_THEMES[age-1].buildings[type].color/.icon for tile and card
 * accents instead of a single flat per-age accent, so categories read as
 * visually distinct within an era.
 */

export const ERA_THEMES = [
  {
    age: 1,
    name: 'Cavemen to Egyptians',
    materials: ['mud-brick', 'limestone', 'papyrus', 'gold leaf', 'reed'],
    architecture: 'Monumental mass over ornament — thick tapering walls, pylon gateways, sun-baked geometry. Nothing floats; everything is rooted and heavy.',
    palette: { background: '#2b1d12', stone: '#c9a66b', sky: '#2a5f6b', gold: '#d4af37', clay: '#7a2f1f' },
    buildings: {
      attack: { color: '#7a2f1f', motif: 'Chariot yards and obelisk-flanked spear racks', icon: '🗡️' },
      defence: { color: '#8a7350', motif: 'Tapering mud-brick palisades with reed battlements', icon: '🧱' },
      science: { color: '#2a5f6b', motif: 'Rooftop star-charting platforms, shadow-clocks', icon: '📜' },
      economy: { color: '#d4af37', motif: 'Grain silos and Nile barge docks', icon: '🌾' },
      religion: { color: '#c9a66b', motif: 'Sun-disk shrines and sphinx-lined avenues', icon: '☀️' },
      culture: { color: '#9c6b30', motif: 'Painted tomb chambers, reed-pen scriptoria', icon: '🎨' },
      wonder: { color: '#ffd700', motif: 'The Great Pyramid — white limestone casing capped in gold', icon: '🔺' }
    }
  },
  {
    age: 2,
    name: 'Greeks to Romans',
    materials: ['marble', 'travertine', 'bronze', 'terracotta', 'mosaic tile'],
    architecture: 'Post-and-lintel symmetry — colonnades, pediments, and the round arch. Civic order expressed as repeated columns.',
    palette: { background: '#1c1a16', marble: '#e8e2d4', laurel: '#4c6b3f', bronze: '#8a6d3a', purple: '#5b3161' },
    buildings: {
      attack: { color: '#8a3a2e', motif: 'Phalanx drill grounds and bronze-tipped siege yards', icon: '⚔️' },
      defence: { color: '#6b6255', motif: 'Travertine ramparts with rounded watch-towers', icon: '🛡️' },
      science: { color: '#4c6b3f', motif: 'Open-air geometry schools, water-clock workshops', icon: '📐' },
      economy: { color: '#8a6d3a', motif: 'Harbor granaries and bronze-coin mints', icon: '⚓' },
      religion: { color: '#5b3161', motif: 'Marble temples with painted pediment friezes', icon: '🏛️' },
      culture: { color: '#c9a961', motif: 'Amphitheaters and laurel-crowned forums', icon: '🎭' },
      wonder: { color: '#e8e2d4', motif: 'The Colosseum — travertine arches stacked in tiers', icon: '🏟️' }
    }
  },
  {
    age: 3,
    name: 'Swords to Muskets',
    materials: ['quarried stone', 'oak timber', 'stained glass', 'wrought iron', 'tapestry'],
    architecture: 'Verticality and defense — pointed arches, crenellations, buttresses that pull the eye upward and keep enemies out.',
    palette: { background: '#171418', slate: '#4a5560', crimson: '#7a2333', gold: '#b8964a', forest: '#2f4a3a' },
    buildings: {
      attack: { color: '#7a2333', motif: 'Musketeer drill yards and cannon foundries', icon: '🔫' },
      defence: { color: '#4a5560', motif: 'Crenellated stone ramparts with arrow-slit towers', icon: '🏰' },
      science: { color: '#3d5a6b', motif: 'Alchemist workshops and clockwork ateliers', icon: '⚗️' },
      economy: { color: '#b8964a', motif: 'Guild halls and stone counting-houses', icon: '💰' },
      religion: { color: '#5b3a5c', motif: 'Gothic cathedrals with stained-glass rose windows', icon: '⛪' },
      culture: { color: '#8a5a3a', motif: 'Tapestried royal courts and manuscript scriptoria', icon: '👑' },
      wonder: { color: '#c9a961', motif: 'Notre Dame — flying buttresses cradling stained glass', icon: '🗼' }
    }
  },
  {
    age: 4,
    name: 'Chinese to Napoleon',
    materials: ['lacquered wood', 'porcelain', 'silk', 'gilt bronze', 'cut stone'],
    architecture: 'Symmetrical courtyards and curved rooflines in the East; grand axial boulevards and stone facades in the West. Power expressed through scale and repetition.',
    palette: { background: '#1a1210', vermillion: '#a13a2e', jade: '#3f6b52', gold: '#c9a227', lacquer: '#241614' },
    buildings: {
      attack: { color: '#a13a2e', motif: 'Grand army parade grounds and cannon rows', icon: '💣' },
      defence: { color: '#5a5248', motif: 'Watchtower garrisons along fortified walls', icon: '🏯' },
      science: { color: '#3f6b52', motif: 'Imperial academies with astronomical instruments', icon: '🔭' },
      economy: { color: '#c9a227', motif: 'Continental trading banks and porcelain workshops', icon: '🏦' },
      religion: { color: '#7a2f4a', motif: 'Forbidden temple courtyards, incense-filled halls', icon: '🕍' },
      culture: { color: '#8a6d3a', motif: 'Palace gardens with pavilions and koi ponds', icon: '🎋' },
      wonder: { color: '#c9a227', motif: 'The Great Wall — stone rampart following the mountain ridge', icon: '🧱' }
    }
  },
  {
    age: 5,
    name: 'World War I & II',
    materials: ['reinforced concrete', 'corrugated steel', 'sandbags', 'riveted iron', 'canvas'],
    architecture: 'Function over form — angular bunkers, blackout facades, industrial mass production. Beauty is incidental; survival is the design brief.',
    palette: { background: '#141512', olive: '#5a5f3e', rust: '#7a3f28', steel: '#5c6068', blackout: '#1e2a33' },
    buildings: {
      attack: { color: '#7a3f28', motif: 'Tank assembly lines and artillery batteries', icon: '🎖️' },
      defence: { color: '#5a5f3e', motif: 'Concrete bunkers and sandbagged trench lines', icon: '🪖' },
      science: { color: '#5c6068', motif: 'Radar arrays and codebreaking bunkers', icon: '📡' },
      economy: { color: '#8a6d3a', motif: 'War-bond halls and rationed factory floors', icon: '🏭' },
      religion: { color: '#3a4a52', motif: 'Field chapels and quiet chaplain tents', icon: '✝️' },
      culture: { color: '#6b5a3a', motif: 'Radio broadcast towers and memorial halls', icon: '📻' },
      wonder: { color: '#5c6068', motif: 'The Hoover Dam — poured concrete curving across the canyon', icon: '🌊' }
    }
  },
  {
    age: 6,
    name: '1990 to 2030',
    materials: ['glass curtain wall', 'brushed steel', 'injection-molded plastic', 'fiber optics', 'LED'],
    architecture: 'Glass towers and open-plan campuses — transparency as a statement, screens replacing walls, the skyline as a stock ticker.',
    palette: { background: '#0d1017', chrome: '#8a94a3', cyan: '#3e9bc9', magenta: '#a83e8a', charcoal: '#1c2029' },
    buildings: {
      attack: { color: '#a83e2e', motif: 'Stealth-wing hangars and missile silo fields', icon: '✈️' },
      defence: { color: '#3e6b9c', motif: 'Satellite-linked missile shield installations', icon: '🛰️' },
      science: { color: '#3e9bc9', motif: 'Glass-walled research campuses, server farms', icon: '💻' },
      economy: { color: '#c9a227', motif: 'Glass-tower stock exchanges and startup lofts', icon: '📈' },
      religion: { color: '#7a3e8a', motif: 'Mega-church broadcast auditoriums', icon: '📿' },
      culture: { color: '#a83e8a', motif: 'Streaming studios lit by LED walls', icon: '🎬' },
      wonder: { color: '#3e9bc9', motif: 'The Internet — a glowing lattice of fiber and light', icon: '🌐' }
    }
  },
  {
    age: 7,
    name: 'Future to Futuristic',
    materials: ['smart alloy', 'holographic film', 'bio-luminescent panel', 'graphene weave', 'exotic matter'],
    architecture: 'Gravity is optional — structures float, fold, and glow from within. No visible seams; surfaces respond to touch and light.',
    palette: { background: '#0f0a1a', violet: '#7c3aed', electric: '#3ee6d8', voidBlack: '#08060f', whiteLight: '#eae6ff' },
    buildings: {
      attack: { color: '#7c3aed', motif: 'Autonomous drone swarms launched from floating pads', icon: '🤖' },
      defence: { color: '#3ee6d8', motif: 'Orbital defense platforms ringing the city', icon: '🛡️' },
      science: { color: '#3ee6d8', motif: 'AI war-rooms humming behind holographic walls', icon: '🧠' },
      economy: { color: '#c9a227', motif: 'Asteroid-mining exchanges and quantum vaults', icon: '💎' },
      religion: { color: '#9d6fef', motif: 'Galactic temples suspended in light', icon: '🌌' },
      culture: { color: '#eae6ff', motif: 'Neural memory archives, shared dreamspace halls', icon: '✨' },
      wonder: { color: '#eae6ff', motif: 'The Dyson Sphere — a shell of panels ringing a captured star', icon: '☀️' }
    }
  }
];
