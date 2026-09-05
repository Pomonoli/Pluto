'use strict';

// Uitrustingswinkel: kleding en schilden geven pantser (vermindert schade bij
// het mislukken van een jacht), wapens geven aanval (bepaalt de dobbelsteen-
// grootte bij een aanval — zie DICE_BY_TIER in server.js). Elk stuk heeft
// slijtage (`maxDurability`): een speler-eigen kopie van dit maximum daalt
// telkens het stuk gerepareerd wordt (zie doRepairGear in server.js), zodat
// een prijs-/statwijziging hier zelf nooit de opgeslagen spelerdata raakt.
const CLOTHES = [
  { id: 'vissersvest', name: 'Vissersvest', icon: '🦺', price: 40, armor: 2, maxDurability: 40 },
  { id: 'leren-jas', name: 'Leren Jas', icon: '🧥', price: 120, armor: 5, maxDurability: 60 },
  { id: 'malienkolder', name: 'Maliënkolder', icon: '⛓️', price: 320, armor: 10, maxDurability: 90 },
  { id: 'plaatharnas', name: 'Plaatharnas', icon: '🥋', price: 800, armor: 18, maxDurability: 130 }
];

const WEAPONS = [
  { id: 'houten-speer', name: 'Houten Speer', icon: '🔱', price: 50, attack: 2, maxDurability: 35 },
  { id: 'jachtmes', name: 'Jachtmes', icon: '🔪', price: 130, attack: 5, maxDurability: 55 },
  { id: 'jachtboog', name: 'Jachtboog', icon: '🏹', price: 350, attack: 10, maxDurability: 80 },
  { id: 'zwaard', name: 'Zwaard', icon: '⚔️', price: 850, attack: 18, maxDurability: 120 }
];

const SHIELDS = [
  { id: 'houten-schild', name: 'Houten Schild', icon: '🛡️', price: 60, armor: 3, maxDurability: 45 },
  { id: 'ijzeren-schild', name: 'IJzeren Schild', icon: '🛡️', price: 200, armor: 8, maxDurability: 70 },
  { id: 'ridderschild', name: 'Ridderschild', icon: '🛡️', price: 500, armor: 15, maxDurability: 110 }
];

const CATALOG = { clothes: CLOTHES, weapons: WEAPONS, shields: SHIELDS };
const CATEGORIES = Object.keys(CATALOG);

function catalogFor(category) { return CATALOG[category] || []; }
function getGear(category, id) { return catalogFor(category).find((item) => item.id === id) || null; }

module.exports = { CLOTHES, WEAPONS, SHIELDS, CATEGORIES, catalogFor, getGear };
