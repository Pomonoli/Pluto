import { hexToPixel, hexCorners, hexDistance } from './hex-client.js';

const HEX_SIZE = 18;
const HEX_DRAW_SIZE = HEX_SIZE * 1.03; // iets groter dan de rasterpitch: verbergt anti-aliasing-naden tussen tegels
// Show a smaller window into the world so each hex renders roughly twice as
// large on screen (half as many columns/rows fill the same fixed viewport).
const COLS = 15;
const ROWS = 10;

// Exacte omvattende rechthoek van de zichtbare COLS x ROWS tegels (in de
// eigen hex-pixelruimte). De viewBox hierop baseren — i.p.v. een handmatig
// geschatte marge — garandeert dat de rand-tegels het venster volledig
// vullen: elke marge-mismatch liet eerder een reep achtergrondkleur zien
// (het "blauwe randje") aan één kant van de kaart.
function computeCoreBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const { x, y } = hexToPixel(col, row, HEX_SIZE);
      for (const [cx, cy] of hexCorners(x, y, HEX_SIZE)) {
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
      }
    }
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}
const VIEW_BOX = computeCoreBounds();
const HOOK_WINDOW_MS = 900;
const REEL_WINDOW_MS = 1300;
const TILE_COLORS = {
  L: '#8fc26c', B: '#e3cd93', f: '#3f7a3a', h: '#8a7f6b', p: '#5c5648',
  r: '#5fb3da', k: '#3f8fc4', a: '#22557f', m: '#1f9a8f', z: '#dce8f0'
};
const MINIMAP_RGB = {
  L: [143, 194, 108], B: [227, 205, 147], f: [63, 122, 58], h: [138, 127, 107], p: [92, 86, 72],
  r: [95, 179, 218], k: [63, 143, 196], a: [34, 85, 127], m: [31, 154, 143], z: [220, 232, 240]
};
const WATER_CHARS = new Set(['r', 'k', 'a', 'm', 'z']);
const GEAR_LABELS = { rod: { icon: '🎣', label: 'Hengel', help: 'Ruimer tijdvenster om aan te slaan bij een beet.' },
  bait: { icon: '🪱', label: 'Aas', help: 'Grotere kans op zeldzame en epische vis.' },
  boat: { icon: '🚤', label: 'Boot', help: 'Vaar verder over rivieren, kust en open zee.' } };

let state, els, E, action, titlebar, logBox, renderGame;
function bind(api) { ({ state, els, E, action, titlebar, logBox, renderGame } = api); }

// Bump whenever worldgen.js changes shape/size — the API response is served
// with a long-lived immutable cache header, so without a version query a
// browser that already loaded an older map would keep serving it from cache
// for up to a day even after the server restarts with new world-gen code.
const WORLD_VERSION = 5;

let world = null;
let worldPromise = null;
function ensureWorld() {
  if (world || worldPromise) return world;
  worldPromise = fetch(`/api/deep-bleu-c/world?wv=${WORLD_VERSION}`)
    .then((response) => response.json())
    .then((data) => {
      if (!data.ok) throw new Error(data.error || 'Kaart kon niet laden.');
      world = data;
      if (state?.room) renderGame(state.room);
    })
    .catch((error) => { console.error('Deep Bleu C wereld laden mislukt:', error); worldPromise = null; });
  return null;
}

let activePanel = 'map';
let leaderboardData = null;
let leaderboardPromise = null;
function loadLeaderboard() {
  leaderboardPromise = fetch('/api/leaderboard?game=deep-bleu-c')
    .then((response) => response.json())
    .then((data) => {
      leaderboardData = data.ok ? (data.leaderboard || []) : [];
      if (state?.room) renderGame(state.room);
    })
    .catch((error) => { console.error('Deep Bleu C leaderboard laden mislukt:', error); leaderboardData = []; })
    .finally(() => { leaderboardPromise = null; });
}

let minimapBase = null;
let minimapWorldRef = null;
function buildMinimapBase(worldData) {
  const canvas = document.createElement('canvas');
  canvas.width = worldData.width;
  canvas.height = worldData.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(worldData.width, worldData.height);
  for (let i = 0; i < worldData.tiles.length; i += 1) {
    const [r, g, b] = MINIMAP_RGB[worldData.tiles[i]] || MINIMAP_RGB.L;
    const o = i * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  minimapBase = canvas;
  minimapWorldRef = worldData;
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function clampInt(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function render(api) {
  bind(api);
  renderDeepBleuC(api.room, api.game);
}
export const playerStrip = true;
export function metric({ player }) {
  return { text: `€${player.cash} · ${player.discoveredCount} soorten`, score: player.discoveredCount };
}

function statusFor(you) {
  const fishing = you.fishing;
  if (fishing?.phase === 'bite') return 'Beet! Trek nu aan!';
  if (fishing?.phase === 'reel') return 'Haal de vis binnen!';
  if (fishing?.phase === 'cast') return 'Je wacht op een beet...';
  if (fishing?.phase === 'result') return fishing.fish ? `Gevangen: ${fishing.fish.name}` : 'Vis ontsnapt.';
  return `€${you.cash} · ${you.discovered.length} soorten ontdekt`;
}

function renderDeepBleuC(room, game) {
  const you = game.you;
  const others = (game.players || []).filter((p) => p.id !== you.id);
  els.gameStage.replaceChildren();
  els.gameStage.append(titlebar('The Deep Bleu C', statusFor(you)));

  const wrap = E('div', 'dbc-wrap');
  wrap.append(renderHud(you));

  if (activePanel !== 'map') {
    wrap.append(renderDetailScreen(you, others));
  } else {
    const loadedWorld = ensureWorld();
    wrap.append(loadedWorld ? renderPlayArea(you, loadedWorld, others) : E('div', 'dbc-loading', 'Kaart wordt geladen...'));
  }

  els.gameStage.append(wrap, logBox(game.log));
}

function renderDetailScreen(you, others) {
  const screen = E('div', 'dbc-detail-screen');
  const back = E('button', 'secondary dbc-back-button', '← Terug naar de kaart');
  back.type = 'button';
  back.onclick = () => { activePanel = 'map'; renderGame(state.room); };
  screen.append(back);
  screen.append(renderActivePanel(you, others));
  return screen;
}

function renderPlayArea(you, worldData, others) {
  const camX = clampInt(you.x - Math.floor(COLS / 2), 0, worldData.width - COLS);
  const camY = clampInt(you.y - Math.floor(ROWS / 2), 0, worldData.height - ROWS);

  const area = E('div', 'dbc-play-area');
  area.append(renderMapWrap(you, worldData, camX, camY, others));
  area.append(renderSidebar());
  return area;
}

function renderSidebar() {
  const sidebar = E('div', 'dbc-sidebar');
  sidebar.append(renderActionBar());
  return sidebar;
}

function renderHud(you) {
  const hud = E('div', 'dbc-hud');
  hud.append(E('div', 'dbc-cash', `\u{1F4B0} €${you.cash}`));
  hud.append(E('div', 'dbc-discovered', `\u{1F4D6} ${you.discovered.length} soorten`));
  return hud;
}

function handleTileClick(wx, wy, tile, you) {
  if (you.fishing && you.fishing.phase !== 'result' && you.fishing.phase !== 'cast') return;
  if (WATER_CHARS.has(tile) && hexDistance(you.x, you.y, wx, wy) <= 1) {
    action('cast', { x: wx, y: wy });
  } else {
    action('move', { x: wx, y: wy });
  }
}

function hexPoints(localCol, localRow) {
  const { x, y } = hexToPixel(localCol, localRow, HEX_SIZE);
  return { cx: x, cy: y };
}

// Karakters draaien niet volledig mee met de reisrichting (dat zou een
// mensfiguur ondersteboven laten hangen) — enkel horizontaal spiegelen op
// basis van de laatst gekozen links/rechts-richting, net als klassieke
// top-down RPG-sprites.
const lastFacingLeftById = new Map();
function facingLeftFor(id, entity) {
  const next = entity.path && entity.path[0];
  if (next) {
    const cur = hexToPixel(entity.x, entity.y, HEX_SIZE);
    const tgt = hexToPixel(next.x, next.y, HEX_SIZE);
    const dx = tgt.x - cur.x;
    if (dx > 0.5) lastFacingLeftById.set(id, false);
    else if (dx < -0.5) lastFacingLeftById.set(id, true);
  }
  return lastFacingLeftById.get(id) || false;
}

const OTHER_PLAYER_COLORS = ['#ff9f43', '#4dd0e1', '#c77dff', '#ffe066'];

// Kleine 2D visser-avatar (chibi trainer met pet, geïnspireerd op klassieke
// top-down RPG-personages) — hengel-arm en vislijn wijzen standaard naar
// rechts/voren; facingLeftFor spiegelt de hele groep bij het naar links lopen.
function appendAnglerFigure(g, { accent = 'var(--accent)', skin = '#f2c199', jeans = '#33456a', hair = '#3a2a1a' } = {}) {
  g.append(svgEl('ellipse', { cx: 0, cy: 10, rx: 9, ry: 3, class: 'dbc-angler-shadow' }));
  g.append(svgEl('rect', { x: -4.5, y: 1, width: 4, height: 9, rx: 2, fill: jeans }));
  g.append(svgEl('rect', { x: 0.5, y: 1, width: 4, height: 9, rx: 2, fill: jeans }));
  g.append(svgEl('path', { d: 'M -5 -6 Q -9 -3 -8 2', fill: 'none', stroke: skin, 'stroke-width': 3, 'stroke-linecap': 'round' }));
  g.append(svgEl('rect', { x: -6, y: -9, width: 12, height: 12, rx: 4, fill: accent, stroke: '#fff', 'stroke-width': 1.2 }));
  g.append(svgEl('path', { d: 'M 5 -5 Q 10 -6 12 -3', fill: 'none', stroke: skin, 'stroke-width': 3, 'stroke-linecap': 'round' }));
  g.append(svgEl('line', { x1: 12, y1: -3, x2: 22, y2: -13, stroke: '#7a5636', 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
  g.append(svgEl('path', { d: 'M 22 -13 Q 28 -5 26 6', class: 'dbc-fish-line' }));
  g.append(svgEl('circle', { cx: 26, cy: 7, r: 1.6, class: 'dbc-fish-hook' }));
  g.append(svgEl('circle', { cx: 0, cy: -13, r: 5.5, fill: skin, stroke: '#0d1117', 'stroke-width': 0.6 }));
  g.append(svgEl('path', { d: 'M -5.5 -15 Q -6.5 -19 -2 -18', fill: hair }));
  g.append(svgEl('path', { d: 'M -6 -15 Q -6 -22 0 -22 Q 6 -22 6 -15 Z', fill: accent, stroke: '#fff', 'stroke-width': 0.8 }));
  g.append(svgEl('ellipse', { cx: 5, cy: -15, rx: 4, ry: 1.6, fill: accent, stroke: '#fff', 'stroke-width': 0.6 }));
  g.append(svgEl('circle', { cx: 0, cy: -18.5, r: 1.5, fill: '#fff' }));
}

function renderOtherPlayerMarker(svg, p, camX, camY, colorIndex) {
  if (p.x < camX - 1 || p.x > camX + COLS || p.y < camY - 1 || p.y > camY + ROWS) return;
  const { cx, cy } = hexPoints(p.x - camX, p.y - camY);
  const facingLeft = facingLeftFor(p.id, p);
  const color = OTHER_PLAYER_COLORS[colorIndex % OTHER_PLAYER_COLORS.length];
  const g = svgEl('g', {
    class: 'dbc-player dbc-player-other',
    transform: `translate(${cx},${cy}) scale(${facingLeft ? -1 : 1},1)`
  });
  appendAnglerFigure(g, { accent: color });
  svg.append(g);
  if (p.fishingPhase) {
    const rod = svgEl('text', { x: cx, y: cy - 32, class: 'dbc-player-fishing', 'text-anchor': 'middle' });
    rod.textContent = '🎣';
    svg.append(rod);
  }
  const label = svgEl('text', { x: cx, y: cy - 25, class: 'dbc-player-label', 'text-anchor': 'middle' });
  label.textContent = p.name;
  svg.append(label);
}

function renderMapWrap(you, worldData, camX, camY, others = []) {
  const svg = svgEl('svg', {
    viewBox: `${VIEW_BOX.minX} ${VIEW_BOX.minY} ${VIEW_BOX.width} ${VIEW_BOX.height}`,
    // Keep hexagons proportional while scaling the visible map just enough
    // to cover the fixed game viewport without empty edges.
    preserveAspectRatio: 'xMidYMid slice',
    class: 'dbc-map',
    role: 'img',
    'aria-label': 'Kaart van The Deep Bleu C'
  });

  // Eén extra ring tegels buiten het zichtbare venster tekenen: de SVG clipt
  // alles buiten de viewBox vanzelf, maar zonder deze rand tonen de rechte
  // viewBox-hoeken een zaagtandpatroon met de achtergrondkleur erdoorheen
  // (het "blauwe randje"). De rand vult die hoeken op met echte tegels.
  for (let row = -1; row <= ROWS; row += 1) {
    for (let col = -1; col <= COLS; col += 1) {
      const wx = camX + col, wy = camY + row;
      if (wx < 0 || wx >= worldData.width || wy < 0 || wy >= worldData.height) continue;
      const tile = worldData.tiles[wy * worldData.width + wx] || 'L';
      const { cx, cy } = hexPoints(col, row);
      const points = hexCorners(cx, cy, HEX_DRAW_SIZE).map(([px, py]) => `${px},${py}`).join(' ');
      const hex = svgEl('polygon', { points, fill: TILE_COLORS[tile] || '#8fc26c', class: 'dbc-tile' });
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) hex.onclick = () => handleTileClick(wx, wy, tile, you);
      svg.append(hex);
    }
  }

  worldData.buildings.forEach((building) => {
    if (building.x < camX || building.x >= camX + COLS || building.y < camY || building.y >= camY + ROWS) return;
    // Sla het gebouwicoontje over als een speler er precies op staat — anders
    // piept het zwarte icoonkader achter de visserfiguur uit.
    const occupied = (you.x === building.x && you.y === building.y)
      || others.some((other) => other.x === building.x && other.y === building.y);
    if (occupied) return;
    const { cx, cy } = hexPoints(building.x - camX, building.y - camY);
    const g = svgEl('g', {
      class: `dbc-building ${building.active ? 'active' : 'locked'}`,
      transform: `translate(${cx},${cy})`
    });
    g.append(svgEl('rect', { x: -14, y: -14, width: 28, height: 28, rx: 6, class: 'dbc-building-bg' }));
    const label = svgEl('text', { x: 0, y: 6, class: 'dbc-building-icon' });
    label.textContent = building.icon;
    g.append(label);
    svg.append(g);
  });

  others.forEach((other, index) => renderOtherPlayerMarker(svg, other, camX, camY, index));

  const { cx: px, cy: py } = hexPoints(you.x - camX, you.y - camY);
  const facingLeft = facingLeftFor(you.id, you);
  const player = svgEl('g', {
    class: 'dbc-player',
    transform: `translate(${px},${py}) scale(${facingLeft ? -1 : 1},1)`
  });
  appendAnglerFigure(player);
  svg.append(player);

  const wrapDiv = E('div', 'dbc-map-wrap');
  wrapDiv.append(svg);

  const fishingPanel = renderFishingPanel(you.fishing);
  if (fishingPanel) {
    const overlay = E('div', 'dbc-fishing-overlay');
    overlay.append(fishingPanel);
    wrapDiv.append(overlay);
  }
  return wrapDiv;
}

function renderMinimap(you, worldData, camX, camY) {
  if (!minimapBase || minimapWorldRef !== worldData) buildMinimapBase(worldData);
  const canvas = document.createElement('canvas');
  canvas.className = 'dbc-minimap';
  canvas.width = worldData.width;
  canvas.height = worldData.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(minimapBase, 0, 0);
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(camX, camY, COLS, ROWS);
  ctx.fillStyle = '#ff5c5c';
  ctx.beginPath();
  ctx.arc(you.x, you.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  canvas.onclick = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * worldData.width);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * worldData.height);
    action('move', { x, y });
  };
  return canvas;
}

function timerBar(msRemaining) {
  const track = E('div', 'dbc-timer-track');
  const fill = E('div', 'dbc-timer-fill');
  fill.style.width = '100%';
  fill.style.transitionDuration = `${Math.max(50, msRemaining)}ms`;
  track.append(fill);
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = '0%'; }));
  return track;
}

function renderFishingPanel(fishing) {
  if (!fishing) return null;
  const panel = E('div', `dbc-fishing dbc-fishing-${fishing.phase}`);
  if (fishing.phase === 'cast') {
    panel.append(E('div', 'dbc-fishing-text', 'Je hengel ligt in het water...'));
  } else if (fishing.phase === 'bite') {
    panel.append(E('div', 'dbc-fishing-text', 'Beet! Trek nu aan!'));
    panel.append(timerBar(fishing.msRemaining || HOOK_WINDOW_MS));
    const button = E('button', 'primary dbc-fishing-button', 'Hengel! \u{1F3A3}');
    button.onclick = () => action('hook');
    panel.append(button);
  } else if (fishing.phase === 'reel') {
    panel.append(E('div', 'dbc-fishing-text', 'Haal de vis binnen!'));
    panel.append(timerBar(fishing.msRemaining || REEL_WINDOW_MS));
    const button = E('button', 'primary dbc-fishing-button', 'Binnenhalen!');
    button.onclick = () => action('reel');
    panel.append(button);
  } else if (fishing.phase === 'result') {
    const fish = fishing.fish;
    if (fish) {
      panel.append(E('div', 'dbc-catch-icon', fish.icon));
      panel.append(E('div', 'dbc-fishing-text dbc-fishing-result', `Gevangen: ${fish.name}`));
      panel.append(E('div', 'dbc-catch-detail', `${fishing.weightKg.toFixed(1)} kg${fishing.isNew ? ' · Nieuwe soort!' : ''}`));
    } else {
      panel.append(E('div', 'dbc-fishing-text dbc-fishing-result', 'De vis ontsnapte.'));
    }
  }
  return panel;
}

function renderActionBar() {
  const bar = E('div', 'dbc-action-bar');
  const buttons = [
    { id: 'vishandel', icon: '🐟', label: 'Vishandel' },
    { id: 'aquarium', icon: '🏛️', label: 'Aquarium' },
    { id: 'markt', icon: '⚖️', label: 'Markt' },
    { id: 'ruilen', icon: '🤝', label: 'Ruilen' },
    { id: 'monument', icon: '🏆', label: 'Hall of Fame' },
    { id: 'world-map', label: 'Map' }
  ];
  buttons.forEach((b) => {
    const btn = E('button', 'dbc-action-btn', b.label);
    btn.type = 'button';
    btn.onclick = () => {
      activePanel = b.id;
      if (b.id === 'monument') loadLeaderboard();
      renderGame(state.room);
    };
    bar.append(btn);
  });
  return bar;
}

function renderActivePanel(you, others) {
  if (activePanel === 'vishandel') return renderVishandelPanel(you);
  if (activePanel === 'aquarium') return renderAquariumPanel(you);
  if (activePanel === 'markt') return renderMarktPanel(you);
  if (activePanel === 'ruilen') return renderRuilenPanel(you, others);
  if (activePanel === 'monument') return renderMonumentPanel(you);
  if (activePanel === 'world-map') return renderMapPanel(you);
  return E('div', 'dbc-hint', 'Tik op de kaart om te wandelen, of op water vlak naast je om te vissen.');
}

function renderMapPanel(you) {
  const wrap = E('div', 'dbc-panel dbc-world-map-panel');
  wrap.append(E('h4', '', 'Grote map'));
  wrap.append(E('p', 'dbc-panel-copy', 'Een uitgezoomd overzicht van de volledige wereld. Je positie staat in het rood.'));

  if (!world) {
    wrap.append(E('p', 'dbc-empty', 'Kaart wordt geladen...'));
    return wrap;
  }

  if (!minimapBase || minimapWorldRef !== world) buildMinimapBase(world);
  const canvas = document.createElement('canvas');
  canvas.className = 'dbc-world-map';
  canvas.width = world.width;
  canvas.height = world.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(minimapBase, 0, 0);
  ctx.fillStyle = '#ff5c5c';
  ctx.beginPath();
  ctx.arc(you.x, you.y, 1.8, 0, Math.PI * 2);
  ctx.fill();
  wrap.append(canvas);
  return wrap;
}

function renderVishandelPanel(you) {
  const wrap = E('div', 'dbc-panel');
  wrap.append(E('h4', '', '🐟 Vishandel'));
  wrap.append(E('p', 'dbc-panel-copy', 'Verkoop je vangst — vanaf overal, geen reis nodig.'));
  wrap.append(renderInventory(you));
  return wrap;
}

function renderAquariumPanel(you) {
  const wrap = E('div', 'dbc-panel');
  wrap.append(E('h4', '', '🏛️ Aquarium-Museum'));
  wrap.append(E('p', 'dbc-panel-copy', 'Volledige sets geven een eenmalige bonus en een blijvend hogere verkoopprijs.'));
  wrap.append(renderSets(you));
  return wrap;
}

function renderMarktPanel(you) {
  const wrap = E('div', 'dbc-panel');
  wrap.append(E('h4', '', '⚖️ Handelsmarkt'));
  wrap.append(E('p', 'dbc-panel-copy', 'Investeer in betere uitrusting.'));
  const grid = E('div', 'dbc-gear-grid');
  Object.keys(GEAR_LABELS).forEach((key) => {
    const info = GEAR_LABELS[key];
    const level = you.gear[key];
    const maxed = level >= you.gearMaxLevel;
    const card = E('div', 'dbc-gear-card');
    card.append(E('div', 'dbc-gear-title', `${info.icon} ${info.label} · niveau ${level}/${you.gearMaxLevel}`));
    card.append(E('p', 'dbc-gear-help', info.help));
    const button = E('button', 'secondary', maxed ? 'Maximum bereikt' : `Upgraden (€${you.gearCosts[level]})`);
    button.disabled = maxed || you.cash < you.gearCosts[level];
    button.onclick = () => action('buyUpgrade', { category: key });
    card.append(button);
    grid.append(card);
  });
  wrap.append(grid);
  return wrap;
}

let tradeTargetId = null;
let tradeOfferUids = new Set();
let tradeRequestUids = new Set();

function renderRuilenPanel(you, others) {
  const wrap = E('div', 'dbc-panel dbc-trade-panel');
  wrap.append(E('h4', '', '🤝 Ruilen'));
  wrap.append(E('p', 'dbc-panel-copy', 'Ruil vis en geld met andere spelers in deze wereld.'));

  if (!others.length) {
    wrap.append(E('p', 'dbc-empty', 'Je bent alleen in deze wereld. Nodig vrienden uit via de gamecode om samen te vissen en te ruilen.'));
    return wrap;
  }

  if (tradeTargetId && !others.some((p) => p.id === tradeTargetId)) tradeTargetId = null;

  const playerList = E('div', 'dbc-trade-players');
  others.forEach((p) => {
    const btn = E('button', `dbc-trade-player-btn ${p.id === tradeTargetId ? 'active' : ''}`,
      `${p.name} · €${p.cash} · ${p.inventory.length} vis`);
    btn.type = 'button';
    btn.onclick = () => {
      tradeTargetId = p.id;
      tradeOfferUids = new Set();
      tradeRequestUids = new Set();
      renderGame(state.room);
    };
    playerList.append(btn);
  });
  wrap.append(playerList);

  const target = others.find((p) => p.id === tradeTargetId);
  if (target) wrap.append(renderTradeBuilder(you, target));

  wrap.append(renderTradeList(you));
  return wrap;
}

function renderTradeItemPicker(title, items, selectedUids) {
  const box = E('div', 'dbc-trade-column');
  box.append(E('h5', '', title));
  if (!items.length) {
    box.append(E('p', 'dbc-empty', 'Geen vis beschikbaar.'));
    return box;
  }
  items.forEach((item) => {
    const row = E('label', 'dbc-trade-item');
    const checkbox = E('input', '');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedUids.has(item.uid);
    checkbox.onchange = () => {
      if (checkbox.checked) selectedUids.add(item.uid); else selectedUids.delete(item.uid);
      renderGame(state.room);
    };
    row.append(checkbox, E('span', '', ` ${item.fish.icon} ${item.fish.name} · ${item.weightKg.toFixed(1)} kg`));
    box.append(row);
  });
  return box;
}

function renderTradeBuilder(you, target) {
  const wrap = E('div', 'dbc-trade-builder');
  const validOfferUids = new Set(you.inventory.map((item) => item.uid));
  for (const uid of tradeOfferUids) if (!validOfferUids.has(uid)) tradeOfferUids.delete(uid);
  const validRequestUids = new Set(target.inventory.map((item) => item.uid));
  for (const uid of tradeRequestUids) if (!validRequestUids.has(uid)) tradeRequestUids.delete(uid);

  const columns = E('div', 'dbc-trade-columns');
  columns.append(renderTradeItemPicker('Jij biedt', you.inventory, tradeOfferUids));
  columns.append(renderTradeItemPicker(`${target.name} heeft`, target.inventory, tradeRequestUids));
  wrap.append(columns);

  const cashRow = E('div', 'dbc-trade-cash-row');
  const offerCashLabel = E('label', 'dbc-trade-cash', 'Jij biedt ook: €');
  const offerCashInput = E('input', 'dbc-trade-cash-input');
  offerCashInput.type = 'number';
  offerCashInput.min = '0';
  offerCashInput.max = String(you.cash);
  offerCashInput.value = '0';
  offerCashLabel.append(offerCashInput);
  const requestCashLabel = E('label', 'dbc-trade-cash', 'Jij vraagt ook: €');
  const requestCashInput = E('input', 'dbc-trade-cash-input');
  requestCashInput.type = 'number';
  requestCashInput.min = '0';
  requestCashInput.value = '0';
  requestCashLabel.append(requestCashInput);
  cashRow.append(offerCashLabel, requestCashLabel);
  wrap.append(cashRow);

  const submit = E('button', 'primary', `Voorstel sturen aan ${target.name}`);
  submit.type = 'button';
  submit.onclick = () => {
    action('proposeTrade', {
      toId: target.id,
      offerUids: [...tradeOfferUids],
      offerCash: Number(offerCashInput.value) || 0,
      requestUids: [...tradeRequestUids],
      requestCash: Number(requestCashInput.value) || 0
    });
    tradeOfferUids = new Set();
    tradeRequestUids = new Set();
  };
  wrap.append(submit);
  return wrap;
}

function renderTradeList(you) {
  const wrap = E('div', 'dbc-trade-list');
  if (!you.trades.length) return wrap;
  wrap.append(E('h5', '', 'Voorstellen'));
  you.trades.forEach((trade) => {
    const card = E('div', 'dbc-trade-card');
    const who = trade.incoming ? trade.fromName : trade.toName;
    card.append(E('div', 'dbc-trade-card-title', trade.incoming ? `Voorstel van ${who}` : `Voorstel aan ${who}`));
    const summarize = (side) => {
      const parts = side.items.map((item) => `${item.fish.icon} ${item.fish.name}`);
      if (side.cash) parts.push(`€${side.cash}`);
      return parts.length ? parts.join(', ') : 'niets';
    };
    card.append(E('p', 'dbc-trade-card-line', `Aangeboden: ${summarize(trade.offer)}`));
    card.append(E('p', 'dbc-trade-card-line', `Gevraagd: ${summarize(trade.request)}`));
    const actionsRow = E('div', 'dbc-trade-card-actions');
    if (trade.incoming) {
      const accept = E('button', 'primary', 'Accepteren');
      accept.onclick = () => action('respondTrade', { tradeId: trade.id, decision: 'accept' });
      const decline = E('button', 'secondary', 'Weigeren');
      decline.onclick = () => action('respondTrade', { tradeId: trade.id, decision: 'decline' });
      actionsRow.append(accept, decline);
    } else {
      const cancel = E('button', 'secondary', 'Intrekken');
      cancel.onclick = () => action('respondTrade', { tradeId: trade.id, decision: 'decline' });
      actionsRow.append(cancel);
    }
    card.append(actionsRow);
    wrap.append(card);
  });
  return wrap;
}

function renderMonumentPanel() {
  const wrap = E('div', 'dbc-panel');
  wrap.append(E('h4', '', '🏆 Hall of Fame'));
  if (leaderboardData === null) {
    wrap.append(E('p', 'dbc-panel-copy', 'Leaderboard wordt geladen...'));
    if (!leaderboardPromise) loadLeaderboard();
    return wrap;
  }
  if (!leaderboardData.length) {
    wrap.append(E('p', 'dbc-panel-copy', 'Nog geen resultaten — verkoop wat vis!'));
    return wrap;
  }
  const table = E('table', 'dbc-leaderboard');
  const head = E('tr');
  ['#', 'Speler', 'Geld', 'Soorten'].forEach((label) => head.append(E('th', '', label)));
  table.append(head);
  leaderboardData.forEach((row, index) => {
    const tr = E('tr');
    tr.append(E('td', '', String(index + 1)));
    tr.append(E('td', '', row.username));
    tr.append(E('td', '', `€${row.cash}`));
    tr.append(E('td', '', String(row.discovered)));
    table.append(tr);
  });
  wrap.append(table);
  return wrap;
}

function renderSets(you) {
  const wrap = E('div', 'dbc-sets');
  const grid = E('div', 'dbc-set-grid');
  you.sets.forEach((set) => {
    const card = E('div', 'dbc-set-card');
    const titleText = `${set.icon} ${set.name} (${set.caught}/${set.total})${set.bonusActive ? ' · +15% ✔' : ''}`;
    card.append(E('div', 'dbc-set-title', titleText));
    if (!set.bonusActive && set.rewardGearLabel) {
      card.append(E('p', 'dbc-set-reward', `Beloning bij voltooien: gratis ${set.rewardGearLabel}-upgrade`));
    }
    const row = E('div', 'dbc-set-fish');
    set.fish.forEach((fish) => {
      const chip = E('span', `dbc-fish-chip ${fish.discovered ? 'discovered' : 'unknown'}`,
        fish.discovered ? `${fish.icon} ${fish.name}` : '???');
      row.append(chip);
    });
    card.append(row);
    grid.append(card);
  });
  wrap.append(grid);
  return wrap;
}

let selectedUids = new Set();

function renderInventory(you) {
  const wrap = E('div', 'dbc-inventory');
  wrap.append(E('h4', '', `Vangst (${you.inventory.length})`));
  if (!you.inventory.length) {
    wrap.append(E('p', 'dbc-empty', 'Nog niets gevangen.'));
    return wrap;
  }

  const validUids = new Set(you.inventory.map((item) => item.uid));
  for (const uid of selectedUids) if (!validUids.has(uid)) selectedUids.delete(uid);

  const actionsRow = E('div', 'dbc-inventory-actions');
  const sellSelected = E('button', 'primary', `Verkoop geselecteerde (${selectedUids.size})`);
  sellSelected.disabled = !selectedUids.size;
  sellSelected.onclick = () => { action('sell', { uids: [...selectedUids] }); selectedUids.clear(); };
  const sellAll = E('button', 'secondary', 'Verkoop alles');
  sellAll.onclick = () => { action('sell', { uid: 'all' }); selectedUids.clear(); };
  actionsRow.append(sellSelected, sellAll);
  wrap.append(actionsRow);

  const list = E('div', 'dbc-inventory-list');
  you.inventory.forEach((item) => {
    const row = E('div', 'dbc-inventory-row');
    const checkbox = E('input', 'dbc-inventory-check');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedUids.has(item.uid);
    checkbox.onchange = () => {
      if (checkbox.checked) selectedUids.add(item.uid); else selectedUids.delete(item.uid);
      renderGame(state.room);
    };
    row.append(checkbox);
    row.append(E('span', 'dbc-inventory-label', `${item.fish.icon} ${item.fish.name} · ${item.weightKg.toFixed(1)} kg`));
    row.append(E('span', 'dbc-inventory-price', `€${item.price}`));
    const sellButton = E('button', 'secondary', 'Verkoop');
    sellButton.onclick = () => { action('sell', { uid: item.uid }); selectedUids.delete(item.uid); };
    row.append(sellButton);
    list.append(row);
  });
  wrap.append(list);
  return wrap;
}
