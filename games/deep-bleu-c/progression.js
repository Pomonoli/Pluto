'use strict';

// Public levels are 1–10; saved gear indices remain 0–9.
const SET_LEVELS = {
  'rivier-polder': 1, 'rivier-roofvis': 2, 'kust-strand': 1, 'kust-wad': 3,
  'atlantisch-diepzee': 4, 'middellandse-zee-kust': 5,
  'atlantisch-oceaanjagers': 6, 'middellandse-zee-exotisch': 8, 'nacht-diepte': 10,
  loofbos: 1, naaldwoud: 1, 'mediterraan-bos': 4, 'fruit-notenhout': 7, 'exotisch-hout': 10,
  bouwsteen: 1, ertsen: 3, edelmetalen: 5, edelstenen: 7, 'zeldzame-mineralen': 10
};

function applySetLevels(sets, entryKey) {
  for (const set of sets) {
    const level = SET_LEVELS[set.id];
    if (!level) throw new Error(`Gereedschapsniveau ontbreekt voor ${set.id}.`);
    set.requiredToolLevel = level;
    for (const entry of set[entryKey]) entry.requiredToolLevel = entry.id === 'eik' ? Math.max(2, level) : level;
  }
}

module.exports = { applySetLevels };
