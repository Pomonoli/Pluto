'use strict';

// Skin-winkel: cosmetische herkleuringen + een herkenbaar hoofddeksel op
// dezelfde chibi-anglerrig (tuniek/accent, huidtint, kap, laarzen) — geen
// nieuw silhouet, in lijn met STYLE.md ("chunky RPG-avonturiers", geen plat
// silhouet). `headgear` verwijst naar een tekenfunctie in client.js
// (appendHeadgear); 'default' is de gratis basisuitstraling en staat daarom
// niet in deze koopbare catalogus.
const SKINS = [
  { id: 'matroos', name: 'Matroos', icon: '⚓', price: 200, description: 'Marineblauw uniform met witte matrozenmuts.', accent: '#2F4C6E', skin: '#E8B98A', hood: '#16283B', boots: '#22364A', headgear: 'cap' },
  { id: 'piraat', name: 'Piraat', icon: '🏴‍☠️', price: 200, description: 'Zwarte kapiteinsjas met steek en goud galon.', accent: '#241F1C', skin: '#D9A876', hood: '#171310', boots: '#3A2E22', headgear: 'tricorn' },
  { id: 'viking', name: 'Viking', icon: '🪓', price: 200, description: 'Ruige bontmantel met gehoornde helm.', accent: '#5C4632', skin: '#E3AE84', hood: '#7A5A3A', boots: '#3E2E1F', headgear: 'horned' },
  { id: 'duiker', name: 'Duiker', icon: '🤿', price: 200, description: 'Strak neopreen pak met duikhelm.', accent: '#1E5C63', skin: '#DDAA7E', hood: '#123A40', boots: '#0F2A2E', headgear: 'helmet' },
  { id: 'zeenimf', name: 'Zeenimf', icon: '🪸', price: 200, description: 'Koraalroze gewaad met een bladerkroon.', accent: '#3E8267', skin: '#C98C7A', hood: '#B95C7A', boots: '#2E5C4C', headgear: 'leafcrown' },
  { id: 'zeekoning', name: 'Zeekoning', icon: '🔱', price: 200, description: 'Diepblauw gewaad met een gouden kroon.', accent: '#1A4E5E', skin: '#E0AE86', hood: '#B78A3E', boots: '#12323D', headgear: 'crown' },
  { id: 'monteur', name: 'Monteur', icon: '🔧', price: 200, description: 'Grijze overall, pet en veiligheidsbril.', accent: '#5A5F5C', skin: '#D9A876', hood: '#D9701F', boots: '#2E2E2C', headgear: 'capgoggles' },
  { id: 'spookpiraat', name: 'Spookpiraat', icon: '👻', price: 200, description: 'Verweerde piratenjas in doorschijnend spookgroen.', accent: '#3E5C4A', skin: '#9FC7A8', hood: '#284A3A', boots: '#1D3428', headgear: 'tricorn', ghost: true }
];

function getSkin(id) { return SKINS.find((entry) => entry.id === id) || null; }

// Alleen de weergavevelden die appendAnglerFigure herkent — leeg object voor
// 'default'/onbekend zodat die de basiskleuren en -kap van de rig zelf gebruikt.
function visualFor(id) {
  const entry = getSkin(id);
  if (!entry) return {};
  const { accent, skin, hood, boots, headgear, ghost } = entry;
  return { accent, skin, hood, boots, headgear, ghost };
}

module.exports = { SKINS, getSkin, visualFor };
