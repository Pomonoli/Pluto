'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const version = require(path.join(root, 'package.json')).version;
const escapedVersion = version.replaceAll('.', '\\.');

test('settings popup exposes sound and both Pluto themes', () => {
  const html = read('public/index.html');
  assert.match(html, /id="settingsButton"/);
  assert.match(html, /id="settingsModal"/);
  assert.match(html, /id="soundButton"/);
  assert.match(html, /id="themeSelect"/);
  assert.match(html, /value="pluto-1-8-0">Light theme/);
  assert.match(html, /value="pluto-1-7-3">Classic theme/);
  assert.doesNotMatch(html, /theme-settings-card/);
  assert.match(html, new RegExp(`settings\\.css\\?v=${escapedVersion}`));
  assert.match(html, new RegExp(`settings\\.js\\?v=${escapedVersion}`));
  assert.match(html, new RegExp(`themes/pluto-1\\.8\\.0\\.css\\?v=${escapedVersion}`));
  assert.match(html, new RegExp(`theme\\.js\\?v=${escapedVersion}`));
});

test('light theme is the default and an explicit choice persists locally', () => {
  const html = read('public/index.html');
  const theme = read('public/theme.js');
  assert.match(html, /allowed\.has\(saved\) \? saved : 'pluto-1-8-0'/);
  assert.match(theme, /const DEFAULT_THEME = 'pluto-1-8-0'/);
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

test('preview skin keeps home header visible and themes active rooms', () => {
  const css = read('public/themes/pluto-1.8.0.css');
  assert.match(css, /body\.room-active #lobbySection/);
  assert.match(css, /body\.game-active \.game-panel/);
  assert.match(css, /position:sticky;\s*top:0;\s*z-index:900/);
  assert.doesNotMatch(css, /\.topbar\{\s*position:relative;\s*top:auto;/);
});

test('preview skin uses a compact header and edge-to-edge mobile navigation', () => {
  const css = read('public/themes/pluto-1.8.0.css');
  assert.match(css, /min-height:126px/);
  assert.match(css, /body\.game-active \.mobile-game-header\{[\s\S]*?linear-gradient\(135deg,#b74b18 0%,#d56620 52%,#ed8129 100%\)/);
  assert.match(css, /\.mobile-nav\{[\s\S]*?left:0;[\s\S]*?bottom:0;[\s\S]*?width:100%;/);
  assert.match(css, /border-radius:18px 18px 0 0/);
});

test('light theme has strong score contrast and light game surfaces', () => {
  const css = read('public/themes/pluto-1.8.0.css');
  assert.match(css, /\.head-to-head-side strong/);
  assert.match(css, /color:#b84f17/);
  assert.match(css, /body\.game-active \.civ-root\{[\s\S]*?--civ-bg-panel:#fffaf6/);
  assert.match(css, /body\.game-active \.carc-viewport\{[\s\S]*?background-color:#e8ddcf/);
  assert.match(css, /\.cluedo-last,[\s\S]*?\.cluedo-form,\.cluedo-notes/);
  assert.match(css, /body\.game-active \.ttr-map-bg\{fill:#e8e1d5\}/);
});

test('light theme finishes Cluedo, rules and mobile profile overflow', () => {
  const css = read('public/themes/pluto-1.8.0.css');
  assert.match(css, /body\.game-active \.clue-card\{/);
  assert.match(css, /body\.game-active \.danger-button\{[\s\S]*?background:#b64f38/);
  assert.match(css, /\.rules-content :is\(p,li,span,strong\)\{color:#344054\}/);
  assert.match(css, /#profileGames\{overflow-x:auto;overscroll-behavior-inline:contain\}/);
  assert.match(css, /#profileGames \.stats-table\{width:100%;table-layout:fixed/);
  assert.match(css, /#profileRecent \.recent-match\{grid-template-columns:minmax\(0,1fr\) auto/);
});
