'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('profile exposes classic and Pluto 1.8.0 preview skins', () => {
  const html = read('public/index.html');
  assert.match(html, /id="themeSelect"/);
  assert.match(html, /value="pluto-1-7-3">Pluto 1\.7\.3/);
  assert.match(html, /value="pluto-1-8-0">Pluto 1\.8\.0 Preview/);
  assert.match(html, /themes\/pluto-1\.8\.0\.css\?v=1\.8\.0/);
  assert.match(html, /theme\.js\?v=1\.8\.0/);
});

test('classic skin remains the fallback and the choice persists locally', () => {
  const html = read('public/index.html');
  const theme = read('public/theme.js');
  assert.match(html, /allowed\.has\(saved\) \? saved : 'pluto-1-7-3'/);
  assert.match(theme, /const DEFAULT_THEME = 'pluto-1-7-3'/);
  assert.match(theme, /localStorage\.setItem\(STORAGE_KEY, theme\)/);
});

test('preview skin launches games from the full card and shows arrows', () => {
  const theme = read('public/theme.js');
  const css = read('public/themes/pluto-1.8.0.css');
  assert.match(theme, /event\.target\.closest\('\.game-card'\)/);
  assert.match(theme, /launch\.click\(\)/);
  assert.match(css, /html\[data-theme="pluto-1-8-0"\] \.game-launch\{display:none!important\}/);
  assert.match(css, /\.game-card\.theme-card-launchable::after/);
  assert.match(css, /#recentGames \.recent-game-button span\{display:none\}/);
});
