const hofslag = require('./hofslag');
const blackjack = require('./blackjack');
const solitaire = require('./solitaire');
const presidenten = require('./presidenten');
const pesten = require('./pesten');
const hartenjagen = require('./hartenjagen');
const cluedo = require('./cluedo');
const carcassonne = require('./carcassonne');
const minigolf = require('./minigolf');

const modules = [hofslag, blackjack, solitaire, presidenten, pesten, hartenjagen, cluedo, carcassonne, minigolf];
const byKey = new Map(modules.map((game) => [game.meta.key, game]));

function getGame(key) {
  return byKey.get(String(key || '').toLowerCase()) || null;
}

function listGames() {
  return modules.map((game) => game.meta);
}

module.exports = { getGame, listGames, modules };
