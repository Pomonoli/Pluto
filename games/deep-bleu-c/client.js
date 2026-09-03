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
// Twee tinten per tegeltype (licht boven, donker onder) i.p.v. een platte
// kleur: geeft elke hex een subtiel "belicht van boven"-reliëf via een
// gradient, zonder dat naburige tegels van hetzelfde type een zichtbare naad
// krijgen (iedere hex herhaalt dezelfde gradient-oriëntatie).
const TILE_SHADES = {
  L: ['#a3db7b', '#74ae4f'], B: ['#f3e0ac', '#dcbd76'], f: ['#5b9c4e', '#2d5b2a'], h: ['#b39c70', '#816d49'], p: ['#9b9591', '#5c5754'],
  r: ['#8ad2ec', '#4a9bc4'], k: ['#63b6e8', '#2f7fb3'], a: ['#3d7cb8', '#1c3f66'], m: ['#3fd0bb', '#1c8272'], z: ['#f5fbfe', '#c3dbe6']
};
const MINIMAP_RGB = {
  L: [143, 194, 108], B: [227, 205, 147], f: [63, 122, 58], h: [138, 127, 107], p: [92, 86, 72],
  r: [95, 179, 218], k: [63, 143, 196], a: [34, 85, 127], m: [31, 154, 143], z: [220, 232, 240]
};
const WATER_CHARS = new Set(['r', 'k', 'a', 'm', 'z']);
const WOOD_TILE = 'f';
const ROCK_TILE = 'p';
const GEAR_LABELS = { rod: { icon: '🎣', label: 'Hengel', help: 'Ruimer tijdvenster om aan te slaan bij een beet.' },
  bait: { icon: '🪱', label: 'Aas', help: 'Grotere kans op zeldzame en epische vis.' },
  boat: { icon: '🚤', label: 'Boot', help: 'Vaar verder over rivieren, kust en open zee — koop deze upgrade bij de Haven of de Handelsmarkt.' },
  axe: { icon: '🪓', label: 'Bijl', help: 'Ruimer tijdvenster om raak te hakken bij een boom.' },
  pickaxe: { icon: '⛏️', label: 'Houweel', help: 'Ruimer tijdvenster om raak te houwen bij een rots.' } };
const GATHER_UI = {
  wood: { verb: 'Hakken', icon: '🪓', bg: 'Je bijl staat klaar bij de stam...' },
  rock: { verb: 'Houwen', icon: '⛏️', bg: 'Je houweel staat klaar bij de rots...' }
};

let state, els, E, action, titlebar, logBox, renderGame;
function bind(api) { ({ state, els, E, action, titlebar, logBox, renderGame } = api); }

// Bump whenever worldgen.js changes shape/size — the API response is served
// with a long-lived immutable cache header, so without a version query a
// browser that already loaded an older map would keep serving it from cache
// for up to a day even after the server restarts with new world-gen code.
const WORLD_VERSION = 6;

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
  const gathering = you.gathering;
  if (gathering?.phase === 'bite') return gathering.strikeText;
  if (gathering?.phase === 'reel') return gathering.haulText;
  if (gathering?.phase === 'cast') return GATHER_UI[gathering.kind].bg;
  if (gathering?.phase === 'result') return gathering.item ? `${gathering.resultVerb}: ${gathering.item.name}` : 'Het glipte weg.';
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
  if (you.gathering && you.gathering.phase !== 'result' && you.gathering.phase !== 'cast') return;
  const adjacent = hexDistance(you.x, you.y, wx, wy) <= 1;
  if (adjacent && WATER_CHARS.has(tile)) { action('cast', { x: wx, y: wy }); return; }
  if (adjacent && tile === WOOD_TILE) { action('gatherStart', { kind: 'wood', x: wx, y: wy }); return; }
  if (adjacent && tile === ROCK_TILE) { action('gatherStart', { kind: 'rock', x: wx, y: wy }); return; }
  action('move', { x: wx, y: wy });
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
  if (p.fishingPhase || p.gatheringKind) {
    const icon = svgEl('text', { x: cx, y: cy - 32, class: 'dbc-player-fishing', 'text-anchor': 'middle' });
    icon.textContent = p.fishingPhase ? '🎣' : GATHER_UI[p.gatheringKind].icon;
    svg.append(icon);
  }
  const label = svgEl('text', { x: cx, y: cy - 25, class: 'dbc-player-label', 'text-anchor': 'middle' });
  label.textContent = p.name;
  svg.append(label);
}

// Stabiele pseudo-random waarde per tegelcoördinaat (0..1) — bepaalt welke
// tegels versiering krijgen en welke variant, zonder dat de kaart bij elke
// render "flikkert" zoals bij een echte Math.random() zou gebeuren.
function tileHash(wx, wy) {
  let h = Math.imul(wx, 374761393) ^ Math.imul(wy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function buildTileDefs() {
  const defs = svgEl('defs');
  Object.entries(TILE_SHADES).forEach(([key, [light, dark]]) => {
    const grad = svgEl('linearGradient', { id: `dbc-grad-${key}`, x1: '0.2', y1: '0', x2: '0.5', y2: '1' });
    grad.append(svgEl('stop', { offset: '0%', 'stop-color': light }));
    grad.append(svgEl('stop', { offset: '100%', 'stop-color': dark }));
    defs.append(grad);
  });
  return defs;
}

// Kleine, chibi-achtige natuurdecors — geïnspireerd op de blokkige, ronde
// bomen/rotsen/watertegels uit klassieke top-down Pokémon-kaarten.
function appendTreeDecor(svg, cx, cy, seed) {
  const g = svgEl('g', { transform: `translate(${cx},${cy})`, class: 'dbc-tile-decor' });
  const cluster = (ox, oy, scale) => {
    const tg = svgEl('g', { transform: `translate(${ox},${oy}) scale(${scale})` });
    tg.append(svgEl('rect', { x: -1.4, y: 3, width: 2.8, height: 5, rx: 1, class: 'dbc-tile-tree-trunk' }));
    tg.append(svgEl('ellipse', { cx: 0, cy: 4.5, rx: 6, ry: 1.6, class: 'dbc-tile-tree-shadow' }));
    tg.append(svgEl('circle', { cx: -3, cy: -1, r: 5.4, class: 'dbc-tile-tree-leaf' }));
    tg.append(svgEl('circle', { cx: 3, cy: 0, r: 5, class: 'dbc-tile-tree-leaf' }));
    tg.append(svgEl('circle', { cx: 0, cy: -5, r: 5.6, class: 'dbc-tile-tree-leaf' }));
    tg.append(svgEl('circle', { cx: -2, cy: -6, r: 2, class: 'dbc-tile-tree-highlight' }));
    return tg;
  };
  if (seed < 0.5) g.append(cluster(0, -1, 1));
  else { g.append(cluster(-4.5, 2, 0.66)); g.append(cluster(4, -1, 0.78)); }
  svg.append(g);
}

function appendHillDecor(svg, cx, cy) {
  const g = svgEl('g', { transform: `translate(${cx},${cy})`, class: 'dbc-tile-decor' });
  g.append(svgEl('ellipse', { cx: 0, cy: 5, rx: 10, ry: 3, class: 'dbc-tile-hill-shadow' }));
  g.append(svgEl('path', { d: 'M -9 4 Q -9 -5 0 -6 Q 9 -5 9 4 Z', class: 'dbc-tile-hill-face' }));
  g.append(svgEl('path', { d: 'M -6 0 Q -3 -5 3 -5', class: 'dbc-tile-hill-highlight' }));
  svg.append(g);
}

function appendPeakDecor(svg, cx, cy) {
  const g = svgEl('g', { transform: `translate(${cx},${cy})`, class: 'dbc-tile-decor' });
  g.append(svgEl('ellipse', { cx: 0, cy: 6, rx: 11, ry: 2.6, class: 'dbc-tile-hill-shadow' }));
  g.append(svgEl('polygon', { points: '-10,6 -3,-9 3,-3 10,6', class: 'dbc-tile-peak-face' }));
  g.append(svgEl('polygon', { points: '3,-3 10,6 5,6 1,-2', class: 'dbc-tile-peak-shadow' }));
  g.append(svgEl('polygon', { points: '-3,-9 1,-4 -1,-2 -4,-3', class: 'dbc-tile-peak-snow' }));
  svg.append(g);
}

function appendWaveDecor(svg, cx, cy, seed) {
  const g = svgEl('g', { transform: `translate(${cx},${cy + (seed - 0.5) * 7})`, class: 'dbc-tile-decor' });
  g.append(svgEl('path', { d: 'M -7 0 Q -3.5 -2.6 0 0 Q 3.5 2.6 7 0', class: 'dbc-tile-wave' }));
  svg.append(g);
}

function appendGrassDecor(svg, cx, cy, seed) {
  const g = svgEl('g', { transform: `translate(${cx + (seed - 0.5) * 8},${cy + 3})`, class: 'dbc-tile-decor' });
  g.append(svgEl('path', { d: 'M -3 3 Q -3.4 -1 -4.4 -3 M 0 3 Q 0 -2 1 -4.4 M 3 3 Q 3.2 -0.4 4.2 -2.6', class: 'dbc-tile-grass' }));
  svg.append(g);
}

function appendSandDecor(svg, cx, cy, seed) {
  const g = svgEl('g', { transform: `translate(${cx},${cy})`, class: 'dbc-tile-decor' });
  const spots = [[-4, 2], [3, -3], [1, 4], [-2, -4]];
  const count = 2 + Math.floor(seed * 3);
  for (let i = 0; i < count; i += 1) {
    const [dx, dy] = spots[i];
    g.append(svgEl('circle', { cx: dx, cy: dy, r: 0.9, class: 'dbc-tile-sand-dot' }));
  }
  svg.append(g);
}

function appendTileDecor(svg, tile, cx, cy, wx, wy) {
  const seed = tileHash(wx, wy);
  if (tile === 'f') appendTreeDecor(svg, cx, cy, seed);
  else if (tile === 'h') appendHillDecor(svg, cx, cy);
  else if (tile === 'p') appendPeakDecor(svg, cx, cy);
  else if (WATER_CHARS.has(tile)) { if (seed < 0.4) appendWaveDecor(svg, cx, cy, seed); }
  else if (tile === 'L') { if (seed < 0.3) appendGrassDecor(svg, cx, cy, seed); }
  else if (tile === 'B') { if (seed < 0.4) appendSandDecor(svg, cx, cy, seed); }
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
  svg.append(buildTileDefs());

  // Eén extra ring tegels buiten het zichtbare venster tekenen: de SVG clipt
  // alles buiten de viewBox vanzelf, maar zonder deze rand tonen de rechte
  // viewBox-hoeken een zaagtandpatroon met de achtergrondkleur erdoorheen
  // (het "blauwe randje"). De rand vult die hoeken op met echte tegels.
  // Reliëfdecors (bomen, rotsen, golven, ...) tekenen we in een aparte, latere
  // pas zodat ze nooit onder een lateref gebuurtegel wegvallen wanneer ze
  // buiten hun eigen hex uitsteken.
  const decorQueue = [];
  for (let row = -1; row <= ROWS; row += 1) {
    for (let col = -1; col <= COLS; col += 1) {
      const wx = camX + col, wy = camY + row;
      if (wx < 0 || wx >= worldData.width || wy < 0 || wy >= worldData.height) continue;
      const tile = worldData.tiles[wy * worldData.width + wx] || 'L';
      const { cx, cy } = hexPoints(col, row);
      const points = hexCorners(cx, cy, HEX_DRAW_SIZE).map(([px, py]) => `${px},${py}`).join(' ');
      const hex = svgEl('polygon', { points, fill: `url(#dbc-grad-${tile})`, class: 'dbc-tile' });
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) hex.onclick = () => handleTileClick(wx, wy, tile, you);
      svg.append(hex);
      decorQueue.push({ tile, cx, cy, wx, wy });
    }
  }
  decorQueue.forEach(({ tile, cx, cy, wx, wy }) => appendTileDecor(svg, tile, cx, cy, wx, wy));

  // Decoratieve bootjes in de Haven — puur sfeer, de bootupgrade zelf koop je
  // op de Handelsmarkt en werkt overal op de kaart.
  (worldData.boats || []).forEach((boat) => {
    if (boat.x < camX - 1 || boat.x > camX + COLS || boat.y < camY - 1 || boat.y > camY + ROWS) return;
    const { cx, cy } = hexPoints(boat.x - camX, boat.y - camY);
    const g = svgEl('g', { class: 'dbc-boat', transform: `translate(${cx},${cy})` });
    g.append(svgEl('ellipse', { cx: 0, cy: 4, rx: 8, ry: 2.5, class: 'dbc-boat-shadow' }));
    g.append(svgEl('path', { d: 'M -8 2 Q 0 8 8 2 L 6 -1 L -6 -1 Z', class: 'dbc-boat-hull' }));
    g.append(svgEl('line', { x1: 0, y1: -1, x2: 0, y2: -10, class: 'dbc-boat-mast' }));
    g.append(svgEl('path', { d: 'M 0 -9 L 6 -3 L 0 -3 Z', class: 'dbc-boat-sail' }));
    svg.append(g);
  });

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

  const activityPanel = renderFishingPanel(you.fishing) || renderGatheringPanel(you.gathering);
  if (activityPanel) {
    const overlay = E('div', 'dbc-fishing-overlay');
    overlay.append(activityPanel);
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

function renderGatheringPanel(gathering) {
  if (!gathering) return null;
  const ui = GATHER_UI[gathering.kind];
  const panel = E('div', `dbc-fishing dbc-fishing-${gathering.phase}`);
  if (gathering.phase === 'cast') {
    panel.append(E('div', 'dbc-fishing-text', ui.bg));
  } else if (gathering.phase === 'bite') {
    panel.append(E('div', 'dbc-fishing-text', gathering.strikeText));
    panel.append(timerBar(gathering.msRemaining || HOOK_WINDOW_MS));
    const button = E('button', 'primary dbc-fishing-button', `${gathering.strikeVerb}! ${ui.icon}`);
    button.onclick = () => action('gatherStrike');
    panel.append(button);
  } else if (gathering.phase === 'reel') {
    panel.append(E('div', 'dbc-fishing-text', gathering.haulText));
    panel.append(timerBar(gathering.msRemaining || REEL_WINDOW_MS));
    const button = E('button', 'primary dbc-fishing-button', `${gathering.haulVerb}!`);
    button.onclick = () => action('gatherHaul');
    panel.append(button);
  } else if (gathering.phase === 'result') {
    const item = gathering.item;
    if (item) {
      panel.append(E('div', 'dbc-catch-icon', item.icon));
      panel.append(E('div', 'dbc-fishing-text dbc-fishing-result', `${gathering.resultVerb}: ${item.name}`));
      panel.append(E('div', 'dbc-catch-detail', `${gathering.weightKg.toFixed(1)} kg${gathering.isNew ? ' · Nieuwe soort!' : ''}`));
    } else {
      panel.append(E('div', 'dbc-fishing-text dbc-fishing-result', 'Het glipte weg.'));
    }
  }
  return panel;
}

function renderActionBar() {
  const bar = E('div', 'dbc-action-bar');
  const buttons = [
    { id: 'vishandel', icon: '🐟', label: 'Vishandel' },
    { id: 'aquarium', icon: '🏛️', label: 'Aquarium' },
    { id: 'lumberyard', icon: '🪵', label: 'Houthakkerij' },
    { id: 'quarry', icon: '⛏️', label: 'Steengroeve' },
    { id: 'markt', icon: '⚖️', label: 'Markt' },
    { id: 'haven', icon: '⚓', label: 'Haven' },
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
  if (activePanel === 'lumberyard') return renderLumberyardPanel(you);
  if (activePanel === 'quarry') return renderQuarryPanel(you);
  if (activePanel === 'markt') return renderMarktPanel(you);
  if (activePanel === 'haven') return renderHavenPanel(you);
  if (activePanel === 'ruilen') return renderRuilenPanel(you, others);
  if (activePanel === 'monument') return renderMonumentPanel(you);
  if (activePanel === 'world-map') return renderMapPanel(you);
  return E('div', 'dbc-hint', 'Tik op de kaart om te wandelen, op water vlak naast je om te vissen, of op een boom/rots vlak naast je om te hakken/houwen.');
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

function renderLumberyardPanel(you) {
  const wrap = E('div', 'dbc-panel');
  wrap.append(E('h4', '', '🪵 Houthakkerij'));
  wrap.append(E('p', 'dbc-panel-copy', 'Hak bomen om vlak bij je met een bijl. Volledige sets geven een blijvende bonus.'));
  wrap.append(renderSets(you, 'wood'));
  wrap.append(renderInventory(you, 'wood'));
  return wrap;
}

function renderQuarryPanel(you) {
  const wrap = E('div', 'dbc-panel');
  wrap.append(E('h4', '', '⛏️ Steengroeve'));
  wrap.append(E('p', 'dbc-panel-copy', 'Houw rotsen los met een houweel. Volledige sets geven een blijvende bonus.'));
  wrap.append(renderSets(you, 'rock'));
  wrap.append(renderInventory(you, 'rock'));
  return wrap;
}

function renderHavenPanel(you) {
  const wrap = E('div', 'dbc-panel');
  wrap.append(E('h4', '', '⚓ De Haven'));
  wrap.append(E('p', 'dbc-panel-copy', 'De bootjes liggen hier klaar. Upgrade je boot op de Handelsmarkt om verder de rivieren, kust en open zee op te varen.'));
  const level = you.gear.boat;
  const card = E('div', 'dbc-gear-card');
  card.append(E('div', 'dbc-gear-title', `🚤 Boot · niveau ${level}/${you.gearMaxLevel}`));
  const tierText = ['Je kunt nog niet het water op.', 'Je vaart over rivieren.', 'Je vaart over rivieren en de kust.', 'Je vaart overal, tot op open zee.'][Math.min(level, 3)];
  card.append(E('p', 'dbc-gear-help', tierText));
  wrap.append(card);
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

function renderSets(you, kind = 'fish') {
  const sets = kind === 'fish' ? you.sets : kind === 'wood' ? you.woodSets : you.rockSets;
  const entriesKey = kind === 'fish' ? 'fish' : 'items';
  const wrap = E('div', 'dbc-sets');
  const grid = E('div', 'dbc-set-grid');
  sets.forEach((set) => {
    const card = E('div', 'dbc-set-card');
    const titleText = `${set.icon} ${set.name} (${set.caught}/${set.total})${set.bonusActive ? ' · +15% ✔' : ''}`;
    card.append(E('div', 'dbc-set-title', titleText));
    if (!set.bonusActive && set.rewardGearLabel) {
      card.append(E('p', 'dbc-set-reward', `Beloning bij voltooien: gratis ${set.rewardGearLabel}-upgrade`));
    }
    const row = E('div', 'dbc-set-fish');
    set[entriesKey].forEach((entry) => {
      const chip = E('span', `dbc-fish-chip ${entry.discovered ? 'discovered' : 'unknown'}`,
        entry.discovered ? `${entry.icon} ${entry.name}` : '???');
      row.append(chip);
    });
    card.append(row);
    grid.append(card);
  });
  wrap.append(grid);
  return wrap;
}

const selectedUidsByKind = { fish: new Set(), wood: new Set(), rock: new Set() };
const INVENTORY_LABELS = {
  fish: { title: 'Vangst', empty: 'Nog niets gevangen.', itemKey: 'fish' },
  wood: { title: 'Hout', empty: 'Nog niets gehakt.', itemKey: 'item' },
  rock: { title: 'Steen', empty: 'Nog niets gedolven.', itemKey: 'item' }
};

function renderInventory(you, kind = 'fish') {
  const list = kind === 'fish' ? you.inventory : kind === 'wood' ? you.woodInventory : you.rockInventory;
  const labels = INVENTORY_LABELS[kind];
  const selectedUids = selectedUidsByKind[kind];
  const wrap = E('div', 'dbc-inventory');
  wrap.append(E('h4', '', `${labels.title} (${list.length})`));
  if (!list.length) {
    wrap.append(E('p', 'dbc-empty', labels.empty));
    return wrap;
  }

  const validUids = new Set(list.map((item) => item.uid));
  for (const uid of selectedUids) if (!validUids.has(uid)) selectedUids.delete(uid);

  const actionsRow = E('div', 'dbc-inventory-actions');
  const sellSelected = E('button', 'primary', `Verkoop geselecteerde (${selectedUids.size})`);
  sellSelected.disabled = !selectedUids.size;
  sellSelected.onclick = () => { action('sell', { kind, uids: [...selectedUids] }); selectedUids.clear(); };
  const sellAll = E('button', 'secondary', 'Verkoop alles');
  sellAll.onclick = () => { action('sell', { kind, uid: 'all' }); selectedUids.clear(); };
  actionsRow.append(sellSelected, sellAll);
  wrap.append(actionsRow);

  const listWrap = E('div', 'dbc-inventory-list');
  list.forEach((item) => {
    const entry = item[labels.itemKey];
    const row = E('div', 'dbc-inventory-row');
    const checkbox = E('input', 'dbc-inventory-check');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedUids.has(item.uid);
    checkbox.onchange = () => {
      if (checkbox.checked) selectedUids.add(item.uid); else selectedUids.delete(item.uid);
      renderGame(state.room);
    };
    row.append(checkbox);
    row.append(E('span', 'dbc-inventory-label', `${entry.icon} ${entry.name} · ${item.weightKg.toFixed(1)} kg`));
    row.append(E('span', 'dbc-inventory-price', `€${item.price}`));
    const sellButton = E('button', 'secondary', 'Verkoop');
    sellButton.onclick = () => { action('sell', { kind, uid: item.uid }); selectedUids.delete(item.uid); };
    row.append(sellButton);
    listWrap.append(row);
  });
  wrap.append(listWrap);
  return wrap;
}
