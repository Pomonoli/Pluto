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

  assert.match(client, /function renderBoatBaseHud\(you\)[\s\S]*?hud\.append\(renderBoatButton\(you\)\)/);
  assert.match(client, /BOAT_BASE_BUTTONS\.forEach\(\(button\) => actions\.append\(renderIconButton\(button\)\)\)/);
  assert.doesNotMatch(client, /dbc-rail-right/);
  assert.match(client, /function renderBoatBasePanel\(you\)/);
  assert.match(client, /wrap\.append\(renderToolUpgrades\(you\)\)/);
  assert.match(client, /const tools = visibleToolUpgrades\(you\)[\s\S]*?tools\.forEach/);
  assert.match(client, /TOOL_FALLBACK_META\.map[\s\S]*?Serverherstart vereist/);
  assert.doesNotMatch(client, /GEAR_LABELS|gearCosts|gearMaxLevel|axeUpgrade/);
  assert.match(client, /appendBoatModel\(svg, you\.boat/);
  assert.match(client, /appendFishSchoolDecor/);
  assert.match(client, /class: 'dbc-boat-mini'/);
  assert.match(css, /\.dbc-tile\{[^}]*stroke:rgba\(43,33,28,\.07\)/);
  assert.match(css, /\.dbc-boat-base-hud\{[^}]*width:300px/);
  assert.match(css, /\.dbc-boat-base-hud\{[^}]*background:linear-gradient\(145deg,#895838,var\(--dbc-wood-dark\)\)/);
  assert.match(css, /\.dbc-boat-base-actions\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /\.dbc-icon-btn\{[^}]*width:44px;height:44px/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test('Deep Bleu C inventaris volgt de v6 perkament- en houttaal', () => {
  const client = fs.readFileSync(path.join(root, 'games/deep-bleu-c/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'games/deep-bleu-c/styles.css'), 'utf8');

  assert.match(client, /usesV6Sheet = \['boat', 'inventaris', 'markt', 'monument', 'vaardigheden', 'world-map'\]/);
  assert.match(client, /dbc-panel dbc-inventory-panel/);
  assert.match(client, /class: 'dbc-inventory-title-icon'/);
  assert.match(css, /\.dbc-sheet-v6\{[\s\S]*?var\(--dbc-parchment-hi\),var\(--dbc-parchment\)/);
  assert.match(css, /\.dbc-inventory-panel \.dbc-subtab-btn\{[\s\S]*?linear-gradient\(180deg,#E8BE8F,#D69A68\)/);
  assert.match(css, /\.dbc-inventory-panel \.dbc-inventory-row\{[\s\S]*?linear-gradient\(180deg,#E7B986,#D9A06E\)/);
  assert.match(css, /\.dbc-inventory-panel \.dbc-gear-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test('Deep Bleu C systeemschermen delen de v6-paneeltaal', () => {
  const client = fs.readFileSync(path.join(root, 'games/deep-bleu-c/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'games/deep-bleu-c/styles.css'), 'utf8');

  assert.match(client, /dbc-v6-panel dbc-market-panel/);
  assert.match(client, /dbc-v6-panel dbc-skills-panel/);
  assert.match(client, /dbc-v6-panel dbc-monument-panel/);
  assert.match(client, /dbc-v6-panel dbc-world-map-panel/);
  assert.match(client, /dbc-skill-card dbc-skill-\$\{key\}/);
  assert.match(client, /dbc-world-map-frame/);
  assert.match(css, /\.dbc-market-panel \.dbc-subtab-row\{[\s\S]*?background:#A96F43/);
  assert.match(css, /\.dbc-skills-panel>\.dbc-gear-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.dbc-monument-panel \.dbc-leaderboard th\{[\s\S]*?background:linear-gradient\(180deg,#B77A4E,#8A5537\)/);
  assert.match(css, /\.dbc-world-map-frame\{[\s\S]*?background:linear-gradient\(145deg,#B97D50,#70452E\)/);
});

test('Deep Bleu C toont meer wereld en gebruikt een hoge mobiele uitsnede', () => {
  const client = fs.readFileSync(path.join(root, 'games/deep-bleu-c/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'games/deep-bleu-c/styles.css'), 'utf8');

  assert.match(client, /desktop: \{ cols: 22, rows: 15 \}/);
  assert.match(client, /portrait: \{ cols: 9, rows: 20 \}/);
  assert.match(client, /window\.innerHeight > window\.innerWidth/);
  assert.match(client, /renderMapWrap\(you, worldData, camX, camY, others, harbors, dayPhase, viewport\)/);
  assert.doesNotMatch(client, /const COLS = 18|const ROWS = 12/);
  assert.match(css, /body\.game-active #gameStage:has\(\.dbc-wrap\) \.dbc-boat-base-hud\{[\s\S]*?top:auto;left:10px;right:10px;[^}]*box-sizing:border-box/);
});

test('Deep Bleu C Hall of Fame houdt vijf kolommen zonder horizontale scroll leesbaar', () => {
  const client = fs.readFileSync(path.join(root, 'games/deep-bleu-c/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'games/deep-bleu-c/styles.css'), 'utf8');

  assert.match(client, /\['#', 'Speler', 'Geld', 'Soorten', 'Total level'\]/);
  assert.match(client, /row\.totalLevel/);
  assert.match(css, /\.dbc-monument-panel \.dbc-leaderboard\{table-layout:fixed/);
  assert.match(css, /\.dbc-monument-panel \.dbc-leaderboard :is\(th,td\)\{padding:8px 4px;font-size:clamp\(11px,3\.25vw,14px\)/);
});

test('Deep Bleu C bouwt het v6-landschap op uit geschilderde terreinlagen', () => {
  const client = fs.readFileSync(path.join(root, 'games/deep-bleu-c/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'games/deep-bleu-c/styles.css'), 'utf8');

  assert.match(client, /const TILE_PALETTE = \{[\s\S]*?r: \['#[A-F0-9]{6}', '#8FC6CC'[\s\S]*?m: \['#[A-F0-9]{6}', '#17414F'/);
  assert.match(client, /Object\.entries\(TILE_PALETTE\)[\s\S]*?`dbc-terrain-\$\{tile\}`/);
  assert.match(client, /dbc-conifer-crown/);
  assert.match(client, /dbc-tree-leaf-dark/);
  assert.match(client, /function appendCoastFoam[\s\S]*?hexDistance\(wx, wy, nx, ny\)/);
  assert.match(client, /appendWaveDecor\(svg, cx, cy, seed, tile\)/);
  assert.match(client, /class: `dbc-tile dbc-tile-\$\{terrain\}`/);
  assert.match(css, /\.dbc-coast-foam\{[^}]*stroke:#F4F3DE/);
  assert.match(css, /\.dbc-tile-sand-ripple\{[^}]*stroke:#866943/);
  assert.match(css, /\.dbc-tile-peak-snow\{[^}]*fill:#EEF1EA/);
});

test('Deep Bleu C HUD volgt de ingelijste v6-statusreferentie', () => {
  const client = fs.readFileSync(path.join(root, 'games/deep-bleu-c/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'games/deep-bleu-c/styles.css'), 'utf8');

  assert.match(client, /dbc-stat-pill dbc-stat-wealth[\s\S]*?dbc-stat-support-icon[\s\S]*?`€\$\{you\.cash\}`/);
  assert.match(client, /dbc-stat-pill dbc-stat-discoveries/);
  assert.match(client, /dbc-stat-pill dbc-stat-level/);
  assert.match(client, /dbc-stat-armor-icon', '💎'/);
  assert.match(css, /\.dbc-stat-pill\{[\s\S]*?border:3px solid #68432F[\s\S]*?inset 0 0 0 2px #C5915E/);
  assert.match(css, /\.dbc-stat-bar-track\{[^}]*height:16px[^}]*border:2px solid #68432F/);
  assert.match(css, /\.dbc-stat-wealth\{min-width:150px/);
  assert.match(css, /\.dbc-stat-bar-health \.dbc-stat-bar-fill\{background:linear-gradient\(180deg,#F14272,#B50F49\)/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\) 60px/);
});

test('Deep Bleu C vaste gebouwen zijn uitsluitend decoratieve v6-architectuur', () => {
  const client = fs.readFileSync(path.join(root, 'games/deep-bleu-c/client.js'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'games/deep-bleu-c/server.js'), 'utf8');
  const worldgen = fs.readFileSync(path.join(root, 'games/deep-bleu-c/worldgen.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'games/deep-bleu-c/styles.css'), 'utf8');

  assert.match(client, /function appendTemple\(/);
  assert.match(client, /function appendRotunda\(/);
  assert.match(client, /function appendQuarryHouse\(/);
  assert.match(client, /function appendHarborHouse\(/);
  assert.match(client, /type === 'monument' \|\| type === 'aquarium' \? 1\.24/);
  assert.doesNotMatch(client, /dbc-bldg-sign|appendObelisk|building\.active/);
  assert.doesNotMatch(server, /nearBuilding/);
  assert.doesNotMatch(worldgen, /icon:|active:/);
  assert.match(css, /\.dbc-building\{pointer-events:none/);
  assert.match(css, /\.dbc-bldg-dome\{/);
  assert.match(css, /\.dbc-bldg-pediment\{/);
});

test('Deep Bleu C Bootbasis gebruikt op mobiel een vaste fullscreen werkruimte', () => {
  const client = fs.readFileSync(path.join(root, 'games/deep-bleu-c/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'games/deep-bleu-c/styles.css'), 'utf8');

  assert.match(client, /dbc-station-section[\s\S]*?Bootstations[\s\S]*?dbc-station-grid/);
  assert.match(client, /dbc-upgrade-card dbc-create-loop/);
  assert.match(client, /dbc-sheet-mobile-title', `Bootbasis · \$\{you\.boat\.name\} \$\{you\.boat\.tier\}`/);
  assert.match(client, /role', 'tab'[\s\S]*?aria-selected[\s\S]*?activeToolKey = tool\.key[\s\S]*?classList\.toggle\('active'/);
  assert.doesNotMatch(client, /button\.onclick = \(\) => \{ activeToolKey = tool\.key; renderGame/);
  assert.match(css, /\.dbc-sheet-overlay:has\(\.dbc-sheet-boat\)\{position:fixed;inset:calc\(58px \+ env\(safe-area-inset-top\)\) 0 0;z-index:20/);
  assert.match(css, /\.dbc-sheet-boat\{[^}]*height:100%;max-height:100%;[^}]*overflow:hidden/);
  assert.match(css, /\.dbc-sheet-boat \.dbc-sheet-header\{[^}]*flex:0 0 auto/);
  assert.match(css, /\.dbc-sheet-boat \.dbc-boat-base\{[^}]*min-height:0;overflow-y:auto;overscroll-behavior:contain/);
  assert.match(css, /\.dbc-sheet-boat \.dbc-sheet-header\{[\s\S]*?background:linear-gradient/);
  assert.match(css, /\.dbc-sheet-boat \.dbc-sheet-mobile-title\{[\s\S]*?display:block/);
  assert.match(css, /\.dbc-sheet-boat \.dbc-station-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.dbc-sheet-boat \.dbc-tool-grid\{grid-template-columns:1fr/);
  assert.match(css, /\.dbc-sheet-boat \.dbc-tool-menu\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.dbc-sheet-boat \.dbc-tool-card\{display:none;[\s\S]*?\.dbc-sheet-boat \.dbc-tool-card\.active\{display:grid\}/);
  assert.match(css, /\.dbc-sheet-boat \.dbc-tool-card :is\(\.primary,\.secondary\)\{[^}]*width:auto;min-width:132px;min-height:38px/);
  assert.match(css, /\.dbc-sheet-boat \.dbc-create-loop :is\(\.primary,\.secondary\)\{[^}]*width:auto;min-width:150px;min-height:38px/);
});
