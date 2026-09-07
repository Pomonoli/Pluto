'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('Deep Bleu C laat alleen secundaire schermen intern verticaal scrollen', () => {
  const client = fs.readFileSync(path.join(root, 'games/deep-bleu-c/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'games/deep-bleu-c/styles.css'), 'utf8');

  assert.match(client, /if \(activePanel !== 'map'\)[\s\S]*?renderPanelSheet\(you, others, harbors\)/);
  assert.match(css, /\.dbc-sheet\{[^}]*max-height:88%;[^}]*overflow-y:auto/);
  assert.match(css, /#gameStage:has\(\.dbc-wrap\)\{[^}]*overflow:hidden!important/);
});

test('Deep Bleu C houdt de bootbasis vast in de HUD en toont vloeiende zee-details', () => {
  const client = fs.readFileSync(path.join(root, 'games/deep-bleu-c/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'games/deep-bleu-c/styles.css'), 'utf8');

  assert.match(client, /wrapDiv\.append\(renderBoatButton\(you\)\)/);
  assert.match(client, /function renderBoatBasePanel\(you\)/);
  assert.match(client, /appendBoatModel\(svg, you\.boat/);
  assert.match(client, /appendFishSchoolDecor/);
  assert.match(css, /\.dbc-boat-button\{[^}]*min-height:56px/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
