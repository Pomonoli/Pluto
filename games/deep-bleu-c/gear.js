'use strict';

// Uitrustingswinkel: kleding en schilden geven pantser (vermindert schade bij
// het mislukken van een jacht), wapens geven aanval (verruimt het tijdvenster
// om een dier te vellen — hetzelfde principe als de bijl/houweel-bonus bij
// hakken/delven, alleen nu gekoppeld aan een uitgerust wapen i.p.v. een
// losse gearlevel).
const CLOTHES = [
  { id: 'vissersvest', name: 'Vissersvest', icon: '🦺', price: 40, armor: 2 },
  { id: 'leren-jas', name: 'Leren Jas', icon: '🧥', price: 120, armor: 5 },
  { id: 'malienkolder', name: 'Maliënkolder', icon: '⛓️', price: 320, armor: 10 },
  { id: 'plaatharnas', name: 'Plaatharnas', icon: '🥋', price: 800, armor: 18 }
];

const WEAPONS = [
  { id: 'houten-speer', name: 'Houten Speer', icon: '🔱', price: 50, attack: 2 },
  { id: 'jachtmes', name: 'Jachtmes', icon: '🔪', price: 130, attack: 5 },
  { id: 'jachtboog', name: 'Jachtboog', icon: '🏹', price: 350, attack: 10 },
  { id: 'zwaard', name: 'Zwaard', icon: '⚔️', price: 850, attack: 18 }
];

const SHIELDS = [
  { id: 'houten-schild', name: 'Houten Schild', icon: '🛡️', price: 60, armor: 3 },
  { id: 'ijzeren-schild', name: 'IJzeren Schild', icon: '🛡️', price: 200, armor: 8 },
  { id: 'ridderschild', name: 'Ridderschild', icon: '🛡️', price: 500, armor: 15 }
];

const CATALOG = { clothes: CLOTHES, weapons: WEAPONS, shields: SHIELDS };
const CATEGORIES = Object.keys(CATALOG);

function catalogFor(category) { return CATALOG[category] || []; }
function getGear(category, id) { return catalogFor(category).find((item) => item.id === id) || null; }

module.exports = { CLOTHES, WEAPONS, SHIELDS, CATEGORIES, catalogFor, getGear };
