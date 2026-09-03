'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('Deep Bleu C laat alleen secundaire schermen intern verticaal scrollen', () => {
  const client = fs.readFileSync(path.join(root, 'games/deep-bleu-c/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'games/deep-bleu-c/styles.css'), 'utf8');

  assert.match(client, /if \(activePanel !== 'map'\)[\s\S]*?renderDetailScreen\(you, others\)/);
  assert.match(css, /\.dbc-detail-screen\{[^}]*flex:1;[^}]*min-height:0;[^}]*overflow-y:auto/);
  assert.match(css, /#gameStage:has\(\.dbc-wrap\)\{[^}]*overflow:hidden!important/);
});
