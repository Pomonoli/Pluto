'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('settings popup exposes sound and both Pluto skins', () => {
  const html = read('public/index.html');
  assert.match(html, /id="settingsButton"/);
  assert.match(html, /id="settingsModal"/);
  assert.match(html, /id="soundButton"/);
  assert.match(html, /id="themeSelect"/);
  assert.match(html, /value="pluto-1-7-3">Pluto 1\.7\.3/);
  assert.match(html, /value="pluto-1-8-0">Pluto 1\.8\.0 Preview/);
  assert.doesNotMatch(html, /theme-settings-card/);
  assert.match(html, /settings\.css\?v=1\.11\.2/);
  assert.match(html, /settings\.js\?v=1\.11\.2/);
  assert.match(html, /themes\/pluto-1\.8\.0\.css\?v=1\.11\.2/);
  assert.match(html, /theme\.js\?v=1\.11\.2/);
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

test('settings gear opens and closes the popup on desktop and mobile', () => {
  const settings = read('public/settings.js');
  const css = read('public/settings.css');
  assert.match(settings, /button\.addEventListener\('click', \(\) => setOpen\(true\)\)/);
  assert.match(settings, /close\.addEventListener\('click', \(\) => setOpen\(false\)\)/);
  assert.match(settings, /event\.key === 'Escape'/);
  assert.match(css, /\.top-actions>#settingsButton/);
  assert.match(css, /display:grid!important/);
});
