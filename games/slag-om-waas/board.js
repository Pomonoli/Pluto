'use strict';

/**
 * De Slag om Waas — bordmodel (data-driven).
 *
 * Dit bestand is de enige bron van waarheid voor facties, provincies en
 * verbindingen. De spelregels werken uitsluitend op de sector-id's en de
 * expliciete CONNECTIONS-lijst; de seed-coördinaten dienen enkel voor de
 * geometrie (Voronoi-cellen, zie geometry.js) en het tekenen van het bord.
 *
 * Opbouw: vijf regio's (vier facties + het neutrale Sint-Niklaas), elk
 * verdeeld in provincies. Namen zijn fictief maar geënt op de echte
 * plaatsen; de ligging volgt het Waasland bij benadering (noorden boven).
 */

const { BOARD_SIZE, boardOutline, computeCells, polygonCentroid } = require('./geometry');

const FACTIONS = {
  north: {
    id: 'north', name: 'Noord', title: 'Stekenwoud & Gillismark', color: '#2f6fd6', accent: '#bcd6ff',
    theme: 'Bos, sneeuw en hinderlagen', capital: 'north_stekene', external: 'Nederland', emblem: '❄'
  },
  east: {
    id: 'east', name: 'Oost', title: 'Beverpolder & Scheldekant', color: '#7cbf2a', accent: '#dcf5b0',
    theme: 'Landbouw, polders en industrie', capital: 'east_beveren', external: 'Antwerpen', emblem: '🌾'
  },
  south: {
    id: 'south', name: 'Zuid', title: 'Temsewater & Durmeland', color: '#22b8dd', accent: '#bdf0fb',
    theme: 'Water, bruggen en moeras', capital: 'south_temse', external: 'Bornem / Klein-Brabant', emblem: '🌊'
  },
  west: {
    id: 'west', name: 'West', title: 'Lokerzand & Moerbeekvlakte', color: '#f0a12e', accent: '#ffe2ae',
    theme: 'Droge vlakten en mobiliteit', capital: 'west_lokeren', external: 'Gent', emblem: '☀'
  },
  center: {
    id: 'center', name: 'Sint-Niklaas', title: 'Neutrale hoofdstad', color: '#d9c58a', accent: '#f4ead0',
    theme: 'Stadsmuren, kathedraal en hoofdwegen', capital: 'center_sint_niklaas', external: null, emblem: '🏰'
  }
};

// Volgorde waarin spelers een factie krijgen toegewezen.
const PLAYABLE_FACTIONS = ['south', 'west', 'north', 'east'];

const TERRAINS = {
  water: { label: 'Water', fill: '#3c8fc4' },
  marsh: { label: 'Moeras', fill: '#5fa88a' },
  desert: { label: 'Zand', fill: '#e2b96a' },
  plains: { label: 'Vlakte', fill: '#d8c689' },
  forest: { label: 'Bos', fill: '#3f7a4a' },
  snow: { label: 'Sneeuw', fill: '#dfe8f2' },
  farmland: { label: 'Landbouw', fill: '#9ccf5a' },
  urban: { label: 'Stad', fill: '#b9b0a0' }
};

// id, naam, regio, terrein, seed-x, seed-y, buildSlots, economicValue, vlaggen
const SECTOR_ROWS = [
  // Sint-Niklaas — neutrale kern met drie buitenwijken
  ['center_sint_niklaas', 'Sint-Niklaas', 'center', 'urban', 500, 500, 3, 4, { isCapital: true, isStrategic: true }],
  ['center_sinaai', 'Sinaaiwoud', 'center', 'forest', 400, 390, 1, 1, {}],
  ['center_nieuwkerken', 'Nieuwkerkhove', 'center', 'farmland', 600, 405, 1, 1, {}],
  ['center_belsele', 'Belselveld', 'center', 'plains', 410, 615, 1, 1, {}],

  // Noord — Stekenwoud & Gillismark
  ['north_stekene', 'Stekenburg', 'north', 'forest', 340, 240, 3, 3, { isCapital: true }],
  ['north_kemzeke', 'Kemzeekhof', 'north', 'snow', 430, 190, 1, 1, {}],
  ['north_hellestraat', 'Hellestrate', 'north', 'snow', 330, 140, 1, 1, {}],
  ['north_klein_sinaai', 'Sinaaikluis', 'north', 'forest', 285, 330, 1, 1, {}],
  ['north_stropersbos', 'Stropersbos', 'north', 'forest', 440, 300, 2, 1, {}],
  ['north_sint_pauwels', 'Pauwelsbos', 'north', 'forest', 510, 330, 2, 1, {}],
  ['north_sint_gillis', 'Gillismark', 'north', 'snow', 590, 220, 2, 2, {}],
  ['north_de_klinge', 'Klingehorst', 'north', 'snow', 520, 90, 1, 2, { isStrategic: true }],
  ['north_meerdonk', 'Meerdonkmoer', 'north', 'snow', 690, 130, 1, 1, {}],

  // Oost — Beverpolder & Scheldekant
  ['east_beveren', 'Beverhof', 'east', 'farmland', 750, 390, 3, 3, { isCapital: true }],
  ['east_vrasene', 'Vrasenveld', 'east', 'farmland', 655, 290, 1, 1, {}],
  ['east_verrebroek', 'Verrepolder', 'east', 'farmland', 790, 290, 1, 0, {}],
  ['east_kieldrecht', 'Kielpolder', 'east', 'farmland', 775, 175, 1, 1, {}],
  ['east_doel', 'Doelhaven', 'east', 'urban', 915, 120, 1, 0, { isStrategic: true }],
  ['east_kallo', 'Kallosluis', 'east', 'urban', 905, 290, 2, 1, {}],
  ['east_zwijndrecht', 'Zwijndrechtwerf', 'east', 'urban', 915, 420, 2, 2, { isStrategic: true }],
  ['east_melsele', 'Melseleveld', 'east', 'farmland', 820, 470, 1, 1, {}],
  ['east_haasdonk', 'Hazendonk', 'east', 'farmland', 670, 495, 2, 1, {}],
  ['east_burcht', 'Burchtkaai', 'east', 'urban', 910, 540, 1, 1, {}],
  ['east_kruibeke', 'Kruibeekweide', 'east', 'farmland', 790, 600, 2, 1, {}],
  ['east_bazel', 'Bazelhoeve', 'east', 'farmland', 760, 690, 1, 1, {}],
  ['east_rupelmonde', 'Rupelburcht', 'east', 'plains', 850, 740, 1, 1, { isStrategic: true }],

  // Zuid — Temsewater & Durmeland
  ['south_temse', 'Temsehaven', 'south', 'marsh', 650, 760, 3, 3, { isCapital: true }],
  ['south_steendorp', 'Steendorpwerf', 'south', 'water', 760, 830, 1, 1, { isStrategic: true }],
  ['south_tielrode', 'Tielrodeveer', 'south', 'water', 570, 880, 1, 1, {}],
  ['south_elversele', 'Elverselmoer', 'south', 'marsh', 520, 760, 1, 1, {}],
  ['south_velle', 'Vellebroek', 'south', 'marsh', 590, 650, 2, 1, {}],
  ['south_heide', 'Durmeheide', 'south', 'marsh', 470, 650, 2, 1, {}],
  ['south_waasmunster', 'Waasmunsterwal', 'south', 'marsh', 380, 710, 2, 2, {}],
  ['south_sombeke', 'Sombekekreek', 'south', 'marsh', 270, 780, 1, 1, {}],
  ['south_ruiter', 'Ruiterbroek', 'south', 'water', 450, 890, 1, 1, {}],
  ['south_durmebocht', 'Durmebocht', 'south', 'water', 340, 870, 1, 1, {}],

  // West — Lokerzand & Moerbeekvlakte
  ['west_lokeren', 'Lokerzand', 'west', 'desert', 180, 570, 3, 3, { isCapital: true }],
  ['west_daknam', 'Daknamveld', 'west', 'plains', 345, 505, 2, 1, {}],
  ['west_eksaarde', 'Eksaardeduin', 'west', 'plains', 205, 465, 1, 1, {}],
  ['west_oudenbos', 'Oudenbosrots', 'west', 'desert', 280, 640, 1, 1, {}],
  ['west_heiende', 'Heiendezand', 'west', 'desert', 200, 700, 1, 1, {}],
  ['west_kruisstraat', 'Kruiswacht', 'west', 'desert', 85, 400, 1, 1, {}],
  ['west_moerbeke', 'Moerbeekveste', 'west', 'desert', 150, 300, 2, 2, {}],
  ['west_koewacht', 'Koewachtpost', 'west', 'desert', 235, 185, 1, 2, { isStrategic: true }],
  ['west_moervaartdal', 'Moervaartdal', 'west', 'plains', 300, 430, 1, 1, {}]
];

/**
 * Expliciete verbindingen. Soorten:
 *  land   – gewone landgrens
 *  road   – hoofdweg (impliceert land)
 *  bridge – brug over de Moervaart (impliceert land; strategisch knelpunt)
 *  water  – waterroute langs Schelde of Durme (voor de zuidelijke factie / latere units)
 * Grenzen tussen Noord en West die hier NIET voorkomen zijn door de Moervaart
 * gescheiden en kunnen enkel via een brug worden overgestoken.
 */
const CONNECTIONS = [
  // center ↔ center
  ['center_belsele', 'center_sint_niklaas', ['land', 'road']],
  ['center_nieuwkerken', 'center_sint_niklaas', ['land']],
  ['center_sinaai', 'center_sint_niklaas', ['land']],
  // center ↔ south
  ['center_belsele', 'south_heide', ['land']],
  ['center_belsele', 'south_waasmunster', ['land']],
  ['center_sint_niklaas', 'south_heide', ['land']],
  ['center_sint_niklaas', 'south_velle', ['land', 'road']],
  // center ↔ west
  ['center_belsele', 'west_daknam', ['land']],
  ['center_belsele', 'west_oudenbos', ['land', 'road']],
  ['center_sinaai', 'west_daknam', ['land']],
  ['center_sinaai', 'west_moervaartdal', ['land']],
  ['center_sint_niklaas', 'west_daknam', ['land', 'road']],
  // center ↔ east
  ['center_nieuwkerken', 'east_beveren', ['land']],
  ['center_nieuwkerken', 'east_haasdonk', ['land']],
  ['center_nieuwkerken', 'east_vrasene', ['land']],
  ['center_sint_niklaas', 'east_haasdonk', ['land', 'road']],
  // center ↔ north
  ['center_nieuwkerken', 'north_sint_pauwels', ['land']],
  ['center_sinaai', 'north_klein_sinaai', ['land']],
  ['center_sinaai', 'north_sint_pauwels', ['land']],
  ['center_sinaai', 'north_stropersbos', ['land']],
  ['center_sint_niklaas', 'north_sint_pauwels', ['land', 'road']],
  // east ↔ east
  ['east_bazel', 'east_kruibeke', ['land']],
  ['east_bazel', 'east_rupelmonde', ['land']],
  ['east_beveren', 'east_haasdonk', ['land', 'road']],
  ['east_beveren', 'east_melsele', ['land']],
  ['east_beveren', 'east_verrebroek', ['land']],
  ['east_beveren', 'east_vrasene', ['land']],
  ['east_beveren', 'east_zwijndrecht', ['land', 'road']],
  ['east_burcht', 'east_kruibeke', ['land', 'road']],
  ['east_burcht', 'east_melsele', ['land']],
  ['east_burcht', 'east_rupelmonde', ['land', 'water']],
  ['east_burcht', 'east_zwijndrecht', ['land', 'water']],
  ['east_doel', 'east_kallo', ['land', 'water']],
  ['east_doel', 'east_kieldrecht', ['land']],
  ['east_haasdonk', 'east_kruibeke', ['land']],
  ['east_haasdonk', 'east_melsele', ['land']],
  ['east_kallo', 'east_kieldrecht', ['land']],
  ['east_kallo', 'east_verrebroek', ['land', 'road']],
  ['east_kallo', 'east_zwijndrecht', ['land', 'water']],
  ['east_kieldrecht', 'east_verrebroek', ['land']],
  ['east_kieldrecht', 'east_vrasene', ['land']],
  ['east_kruibeke', 'east_melsele', ['land']],
  ['east_kruibeke', 'east_rupelmonde', ['land', 'water']],
  ['east_melsele', 'east_zwijndrecht', ['land']],
  ['east_verrebroek', 'east_vrasene', ['land', 'road']],
  ['east_verrebroek', 'east_zwijndrecht', ['land']],
  // east ↔ south
  ['east_bazel', 'south_steendorp', ['land', 'water']],
  ['east_bazel', 'south_temse', ['land']],
  ['east_bazel', 'south_velle', ['land']],
  ['east_haasdonk', 'south_velle', ['land']],
  ['east_kruibeke', 'south_velle', ['land', 'road']],
  ['east_rupelmonde', 'south_steendorp', ['land', 'water']],
  // east ↔ north
  ['east_kieldrecht', 'north_meerdonk', ['land']],
  ['east_vrasene', 'north_meerdonk', ['land']],
  ['east_vrasene', 'north_sint_gillis', ['land', 'road']],
  ['east_vrasene', 'north_sint_pauwels', ['land']],
  // north ↔ north
  ['north_de_klinge', 'north_hellestraat', ['land']],
  ['north_de_klinge', 'north_kemzeke', ['land']],
  ['north_de_klinge', 'north_meerdonk', ['land']],
  ['north_de_klinge', 'north_sint_gillis', ['land']],
  ['north_hellestraat', 'north_kemzeke', ['land']],
  ['north_hellestraat', 'north_stekene', ['land']],
  ['north_kemzeke', 'north_sint_gillis', ['land', 'road']],
  ['north_kemzeke', 'north_stekene', ['land', 'road']],
  ['north_kemzeke', 'north_stropersbos', ['land']],
  ['north_klein_sinaai', 'north_stekene', ['land']],
  ['north_meerdonk', 'north_sint_gillis', ['land']],
  ['north_sint_gillis', 'north_sint_pauwels', ['land']],
  ['north_sint_pauwels', 'north_stropersbos', ['land', 'road']],
  ['north_stekene', 'north_stropersbos', ['land', 'road']],
  // north ↔ west
  ['north_klein_sinaai', 'west_moervaartdal', ['bridge']],
  ['north_stekene', 'west_koewacht', ['bridge', 'road']],
  // south ↔ south
  ['south_durmebocht', 'south_ruiter', ['land', 'water']],
  ['south_durmebocht', 'south_sombeke', ['land', 'water']],
  ['south_durmebocht', 'south_waasmunster', ['land']],
  ['south_elversele', 'south_heide', ['land']],
  ['south_elversele', 'south_ruiter', ['land']],
  ['south_elversele', 'south_temse', ['land', 'road']],
  ['south_elversele', 'south_tielrode', ['land', 'water']],
  ['south_elversele', 'south_velle', ['land']],
  ['south_elversele', 'south_waasmunster', ['land', 'road']],
  ['south_heide', 'south_velle', ['land']],
  ['south_heide', 'south_waasmunster', ['land']],
  ['south_ruiter', 'south_tielrode', ['land', 'water']],
  ['south_ruiter', 'south_waasmunster', ['land']],
  ['south_sombeke', 'south_waasmunster', ['land']],
  ['south_steendorp', 'south_temse', ['land', 'road', 'water']],
  ['south_steendorp', 'south_tielrode', ['land']],
  ['south_temse', 'south_tielrode', ['land', 'water']],
  ['south_temse', 'south_velle', ['land', 'road']],
  // south ↔ west
  ['south_sombeke', 'west_heiende', ['land']],
  ['south_sombeke', 'west_oudenbos', ['land']],
  ['south_waasmunster', 'west_oudenbos', ['land', 'road']],
  // west ↔ west
  ['west_daknam', 'west_eksaarde', ['land']],
  ['west_daknam', 'west_lokeren', ['land', 'road']],
  ['west_daknam', 'west_moervaartdal', ['land']],
  ['west_daknam', 'west_oudenbos', ['land']],
  ['west_eksaarde', 'west_kruisstraat', ['land']],
  ['west_eksaarde', 'west_lokeren', ['land']],
  ['west_eksaarde', 'west_moerbeke', ['land']],
  ['west_eksaarde', 'west_moervaartdal', ['land']],
  ['west_heiende', 'west_lokeren', ['land']],
  ['west_heiende', 'west_oudenbos', ['land']],
  ['west_koewacht', 'west_moerbeke', ['land']],
  ['west_kruisstraat', 'west_lokeren', ['land']],
  ['west_kruisstraat', 'west_moerbeke', ['land']],
  ['west_lokeren', 'west_oudenbos', ['land', 'road']],
];

const ROADS = [
  { id: 'n70', name: 'N70', path: ['west_lokeren', 'west_daknam', 'center_sint_niklaas', 'east_haasdonk', 'east_beveren', 'east_zwijndrecht'] },
  { id: 'e17', name: 'E17', path: ['west_lokeren', 'west_oudenbos', 'center_belsele', 'center_sint_niklaas', 'south_velle', 'east_kruibeke', 'east_burcht'] },
  { id: 'e34', name: 'E34', path: ['north_stekene', 'north_kemzeke', 'north_sint_gillis', 'east_vrasene', 'east_verrebroek', 'east_kallo'] },
  { id: 'n403', name: 'N403', path: ['center_sint_niklaas', 'north_sint_pauwels', 'north_stropersbos', 'north_stekene', 'west_koewacht'] },
  { id: 'n16', name: 'N16', path: ['center_sint_niklaas', 'south_velle', 'south_temse', 'south_steendorp'] },
  { id: 'n41', name: 'N41', path: ['south_temse', 'south_elversele', 'south_waasmunster', 'west_oudenbos'] }
];

const LAND_KINDS = ['land', 'road', 'bridge'];

function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

function sharedEdge(polyA, polyB) {
  const near = (p, q) => Math.abs(p[0] - q[0]) < 0.5 && Math.abs(p[1] - q[1]) < 0.5;
  const shared = polyA.filter((p) => polyB.some((q) => near(p, q)));
  return shared.length >= 2 ? [shared[0], shared[shared.length - 1]] : null;
}

/** Bouwt het volledige statische bord (sectoren, verbindingen, geometrie). */
function buildBoard() {
  const seeds = SECTOR_ROWS.map(([id, , , , x, y]) => ({ id, x, y }));
  const cells = computeCells(seeds);
  const sectors = new Map();
  for (const [id, name, factionHome, terrain, x, y, buildSlots, economicValue, flags] of SECTOR_ROWS) {
    const cell = cells.get(id);
    sectors.set(id, {
      id, name, factionHome, terrain, buildSlots, economicValue,
      isCapital: Boolean(flags.isCapital), isStrategic: Boolean(flags.isStrategic),
      seed: [x, y], polygon: cell.polygon, label: polygonCentroid(cell.polygon),
      connections: []
    });
  }
  for (const [a, b, kinds] of CONNECTIONS) {
    if (!sectors.has(a) || !sectors.has(b)) throw new Error(`Onbekende sector in verbinding ${a}-${b}`);
    sectors.get(a).connections.push({ to: b, kinds: [...kinds] });
    sectors.get(b).connections.push({ to: a, kinds: [...kinds] });
  }
  // De Moervaart volgt alle geometrische grenzen tussen Noord en West.
  const moervaart = [];
  for (const sector of sectors.values()) {
    if (sector.factionHome !== 'west') continue;
    for (const neighborId of cells.get(sector.id).neighbors) {
      const neighbor = sectors.get(neighborId);
      if (neighbor.factionHome !== 'north') continue;
      const edge = sharedEdge(sector.polygon, neighbor.polygon);
      if (edge) moervaart.push({ between: [sector.id, neighborId], from: edge[0], to: edge[1] });
    }
  }
  // De Schelde stroomt langs de oost- en zuidrand van het bord, buiten de provincies.
  const outline = boardOutline();
  const angleOf = ([x, y]) => Math.atan2(y - BOARD_SIZE / 2, x - BOARD_SIZE / 2) * 180 / Math.PI;
  const schelde = outline.filter((p) => angleOf(p) >= -62 && angleOf(p) <= 112).sort((a, b) => angleOf(a) - angleOf(b));
  return {
    size: BOARD_SIZE, outline, sectors, roads: ROADS, moervaart, schelde,
    geometricNeighbors: new Map([...cells].map(([id, cell]) => [id, cell.neighbors]))
  };
}

/** Is `a` met `b` verbonden via minstens één van de gevraagde soorten (standaard: eender welke)? */
function isConnected(board, a, b, kinds = null) {
  const sector = board.sectors.get(a);
  if (!sector) return false;
  return sector.connections.some((c) => c.to === b && (!kinds || c.kinds.some((k) => kinds.includes(k))));
}

/** Buren die met een landbeweging bereikbaar zijn (land, road of bridge). */
function landNeighbors(board, id) {
  const sector = board.sectors.get(id);
  if (!sector) return [];
  return sector.connections.filter((c) => c.kinds.some((k) => LAND_KINDS.includes(k))).map((c) => c.to);
}

module.exports = { FACTIONS, PLAYABLE_FACTIONS, TERRAINS, SECTOR_ROWS, CONNECTIONS, ROADS, LAND_KINDS, buildBoard, isConnected, landNeighbors, pairKey };
