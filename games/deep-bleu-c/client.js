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
// Eén platte kleur per tegeltype i.p.v. een per-tegel gradient: een gradient
// die zichzelf op iedere hex herhaalt creëert net een zichtbaar herhalend
// "hex-grid"-patroon, ook zonder rand. Kleuren volgen het v3-styleguide-palet
// ("The Big Blue C"): zongebleekt en aards op het land, water dat donkerder
// wordt naarmate de zone zwaarder is (Ondiep → Kelpwouden → Wadzee → Rifzee).
// 'w' is de wereldrand: een platte-aarde-waterval die in het niets stort.
const TILE_COLOR = {
  L: '#8FAE72', B: '#A8875F', f: '#3F6247', h: '#949D98', p: '#7C8480',
  r: '#8FC6CC', k: '#4E8FA0', a: '#2A5A6B', m: '#17414F', w: '#0B1D24'
};
const MINIMAP_RGB = {
  L: [143, 174, 114], B: [168, 135, 95], f: [63, 98, 71], h: [148, 157, 152], p: [124, 132, 128],
  r: [143, 198, 204], k: [78, 143, 160], a: [42, 90, 107], m: [23, 65, 79], w: [11, 29, 36]
};
const WATER_CHARS = new Set(['r', 'k', 'a', 'm']);
const WOOD_TILE = 'f';
const ROCK_TILE = 'p';
const GEAR_LABELS = { rod: { icon: '🎣', label: 'Hengel', help: 'Ruimer tijdvenster om aan te slaan bij een beet.' },
  bait: { icon: '🪱', label: 'Aas', help: 'Grotere kans op zeldzame en epische vis.' },
  boat: { icon: '🚤', label: 'Vaartuig', help: 'Vaar verder van kust tot Rifzee — koop deze upgrade in je Inventaris.' },
  axe: { icon: '🪓', label: 'Bijl', help: 'Ruimer tijdvenster om raak te hakken bij een boom.' },
  pickaxe: { icon: '⛏️', label: 'Houweel', help: 'Ruimer tijdvenster om raak te houwen bij een rots.' } };
const GEAR_CATEGORY_META = {
  clothes: { icon: '🧥', label: 'Kleding' },
  weapons: { icon: '⚔️', label: 'Wapens' },
  shields: { icon: '🛡️', label: 'Schilden' }
};
// Kookrecepten — puur weergave; de server (recipes.js) is de bron van
// waarheid en valideert alles zelf.
const DISH_DISPLAY = [
  { id: 'vislijn-stoofpot', name: 'Vislijnstoofpot', icon: '🍲', cost: 15, buffIcon: '🎣', buffLabel: 'Lijnsterkte' },
  { id: 'winterkost', name: 'Winterkost', icon: '🥘', cost: 15, buffIcon: '🔥', buffLabel: 'Warme Maag' },
  { id: 'jagerspot', name: 'Jagerspot', icon: '🍖', cost: 20, buffIcon: '🎲', buffLabel: 'Jachtlust' },
  { id: 'nachtbrouwsel', name: 'Nachtbrouwsel', icon: '🍵', cost: 20, buffIcon: '🌙', buffLabel: 'Nachtzicht' }
];
const QUALITY_LABEL = { raw: 'Rauw', roasted: 'Geroosterd', dish: 'Gerecht' };

// De actieknoppen staan rechts, verticaal gecentreerd, in dezelfde blauwe
// stijl als elkaar (geen apart uitgelichte "primary"-knop meer) — zo blijft
// de speler zelf altijd centraal op de kaart in beeld.
// Alle actieknoppen in één rail aan de rechterkant, verticaal gecentreerd.
const RIGHT_BUTTONS = [
  { id: 'inventaris', icon: '🎒', label: 'Inventaris' },
  { id: 'markt', icon: '🏪', label: 'Marktplaats' },
  { id: 'monument', icon: '🏆', label: 'Hall of Fame', square: true },
  { id: 'vaardigheden', icon: '⭐', label: 'Vaardigheden', square: true },
  { id: 'world-map', icon: '🗺️', label: 'Map', square: true }
];
const GATHER_UI = {
  wood: { verb: 'Hakken', icon: '🪓', bg: 'Je bijl staat klaar bij de stam...' },
  rock: { verb: 'Houwen', icon: '⛏️', bg: 'Je houweel staat klaar bij de rots...' }
};
const SKILL_LABELS = {
  fishing: { icon: '🎣', label: 'Vissen', help: 'Xp per gevangen vis — hoe zeldzamer, hoe meer.' },
  woodcutting: { icon: '🪓', label: 'Houthakken', help: 'Xp per gehakte stam — hoe zeldzamer, hoe meer.' },
  mining: { icon: '⛏️', label: 'Delven', help: 'Xp per gedolven steen — hoe zeldzamer, hoe meer.' },
  hunting: { icon: '🏹', label: 'Jagen', help: 'Xp per gevelde prooi — hoe zeldzamer, hoe meer.' },
  collecting: { icon: '📖', label: 'Verzamelen', help: 'Bonus-xp telkens je een vis-, hout-, steen- of diersoort voor het eerst ontdekt.' },
  trading: { icon: '🤝', label: 'Handelen', help: 'Xp voor beide spelers bij elke voltooide ruil.' }
};

let state, els, E, action, logBox, renderGame;
function bind(api) { ({ state, els, E, action, logBox, renderGame } = api); }

// Bump whenever worldgen.js changes shape/size — the API response is served
// with a long-lived immutable cache header, so without a version query a
// browser that already loaded an older map would keep serving it from cache
// for up to a day even after the server restarts with new world-gen code.
const WORLD_VERSION = 7;

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
    .catch((error) => { console.error('Big Blue C wereld laden mislukt:', error); worldPromise = null; });
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
    .catch((error) => { console.error('Big Blue C leaderboard laden mislukt:', error); leaderboardData = []; })
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

function renderDeepBleuC(room, game) {
  const you = game.you;
  const others = (game.players || []).filter((p) => p.id !== you.id);
  els.gameStage.replaceChildren();

  const wrap = E('div', 'dbc-wrap');
  const loadedWorld = ensureWorld();
  wrap.append(loadedWorld
    ? renderStage(you, loadedWorld, others, game.harbors || [], game.dayPhase || 'day')
    : E('div', 'dbc-loading', 'Kaart wordt geladen...'));

  els.gameStage.append(wrap, logBox(game.log));
}

// De kaart blijft altijd zichtbaar op de achtergrond, schermvullend; een open
// paneel (Inventaris, Marktplaats, ...) schuift eroverheen als een los "sheet"
// in plaats van de kaart te vervangen — zo blijft de wereld altijd in beeld.
function renderStage(you, worldData, others, harbors, dayPhase) {
  const camX = clampInt(you.x - Math.floor(COLS / 2), 0, worldData.width - COLS);
  const camY = clampInt(you.y - Math.floor(ROWS / 2), 0, worldData.height - ROWS);
  const stage = E('div', 'dbc-stage');
  stage.append(renderMapWrap(you, worldData, camX, camY, others, harbors, dayPhase));
  if (activePanel !== 'map') stage.append(renderPanelSheet(you, others, harbors));
  return stage;
}

function renderStatPills(you, dayPhase) {
  const wrap = E('div', 'dbc-stat-pills');
  wrap.append(E('div', 'dbc-stat-pill', `${dayPhase === 'night' ? '🌙' : '☀️'}`));
  wrap.append(E('div', 'dbc-stat-pill', `💰 €${you.cash}`));
  wrap.append(E('div', 'dbc-stat-pill', `📖 ${you.discovered.length}`));
  wrap.append(E('div', 'dbc-stat-pill', `⭐ Lv. ${you.totalLevel}`));
  return wrap;
}

function renderStatBar(icon, value, max, kind) {
  const bar = E('div', `dbc-stat-bar dbc-stat-bar-${kind}`);
  bar.append(E('span', 'dbc-stat-bar-icon', icon));
  const track = E('div', 'dbc-stat-bar-track');
  const fill = E('div', 'dbc-stat-bar-fill');
  fill.style.width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  track.append(fill);
  bar.append(track);
  bar.append(E('span', 'dbc-stat-bar-value', `${value}/${max}`));
  return bar;
}

// Gezondheid en energie als vullende balken (ze putten uit/herstellen);
// pantser is een afgeleide, niet-vullende waarde uit je uitrusting, dus die
// krijgt een badge in plaats van een balk. Actieve buffs krijgen hun eigen
// badge met resterende tijd.
function renderStatBars(you) {
  const wrap = E('div', 'dbc-stat-bars');
  wrap.append(renderStatBar('❤️', you.stats.health, you.stats.maxHealth, 'health'));
  wrap.append(renderStatBar('⚡', you.stats.energy, you.stats.maxEnergy, 'energy'));
  wrap.append(E('div', 'dbc-stat-armor', `🛡️ ${you.stats.armor}`));
  (you.buffs || []).forEach((buff) => {
    const minutes = Math.max(1, Math.round(buff.remainingMs / 60000));
    const badge = E('div', 'dbc-stat-clock', `${buff.icon} ${minutes}m`);
    badge.title = `${buff.label} — ${buff.help}`;
    wrap.append(badge);
  });
  return wrap;
}

function renderIconButton(b) {
  const col = E('div', 'dbc-icon-col');
  const btn = E('button', `dbc-icon-btn${b.square ? ' square' : ''}`, b.icon);
  btn.type = 'button';
  btn.title = b.label;
  btn.onclick = () => {
    activePanel = b.id;
    if (b.id === 'monument') loadLeaderboard();
    renderGame(state.room);
  };
  col.append(btn, E('div', 'dbc-icon-label', b.label));
  return col;
}

function renderButtonRail(className, buttons) {
  const rail = E('div', className);
  buttons.forEach((b) => rail.append(renderIconButton(b)));
  return rail;
}

function renderPanelSheet(you, others, harbors) {
  const overlay = E('div', 'dbc-sheet-overlay');
  overlay.onclick = (event) => {
    if (event.target === overlay) { activePanel = 'map'; renderGame(state.room); }
  };
  const sheet = E('div', 'dbc-sheet');
  const header = E('div', 'dbc-sheet-header');
  header.append(E('div', 'dbc-sheet-handle'));
  const close = E('button', 'dbc-sheet-close', '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Sluiten');
  close.onclick = () => { activePanel = 'map'; renderGame(state.room); };
  header.append(close);
  sheet.append(header, renderActivePanel(you, others, harbors));
  overlay.append(sheet);
  return overlay;
}

function isWildlifeTile(wx, wy) {
  return Boolean(world && (world.wildlife || []).some((spot) => spot.x === wx && spot.y === wy));
}

function handleTileClick(wx, wy, tile, you) {
  if (you.combat) return;
  if (you.fishing && you.fishing.phase !== 'result' && you.fishing.phase !== 'cast') return;
  if (you.gathering && you.gathering.phase !== 'result' && you.gathering.phase !== 'cast') return;
  const adjacent = hexDistance(you.x, you.y, wx, wy) <= 1;
  if (adjacent && WATER_CHARS.has(tile)) { action('cast', { x: wx, y: wy }); return; }
  if (adjacent && tile === WOOD_TILE) { action('gatherStart', { kind: 'wood', x: wx, y: wy }); return; }
  if (adjacent && tile === ROCK_TILE) { action('gatherStart', { kind: 'rock', x: wx, y: wy }); return; }
  if (adjacent && isWildlifeTile(wx, wy)) { action('huntStart', { x: wx, y: wy }); return; }
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

// Werktuig in de voorste hand — enkel getekend zolang de bijhorende actie
// bezig is: hengel bij vissen, bijl bij hakken, houweel bij delven, wapen bij
// een dobbelgevecht. Anders hangt die hand net als de andere gewoon leeg
// naast het lichaam.
function appendTool(g, tool) {
  if (tool === 'rod') {
    g.append(svgEl('line', { x1: 12, y1: -3, x2: 22, y2: -13, class: 'dbc-tool-handle' }));
    g.append(svgEl('path', { d: 'M 22 -13 Q 28 -5 26 6', class: 'dbc-fish-line' }));
    g.append(svgEl('circle', { cx: 26, cy: 7, r: 1.6, class: 'dbc-fish-hook' }));
  } else if (tool === 'axe') {
    g.append(svgEl('line', { x1: 12, y1: -3, x2: 20, y2: -16, class: 'dbc-tool-handle' }));
    g.append(svgEl('path', { d: 'M 20 -16 L 15 -21 Q 24 -23 27 -16 Q 24 -10 16 -12 Z', class: 'dbc-tool-axe-head' }));
  } else if (tool === 'pickaxe') {
    g.append(svgEl('line', { x1: 12, y1: -3, x2: 20, y2: -16, class: 'dbc-tool-handle' }));
    g.append(svgEl('path', { d: 'M 10 -12 Q 20 -23 30 -12', class: 'dbc-tool-pick-head' }));
  } else if (tool === 'weapon') {
    g.append(svgEl('line', { x1: 12, y1: -3, x2: 22, y2: -18, class: 'dbc-tool-handle' }));
    g.append(svgEl('path', { d: 'M 14 -8 Q 22 -22 30 -10', class: 'dbc-tool-bow' }));
    g.append(svgEl('line', { x1: 14, y1: -8, x2: 30, y2: -10, class: 'dbc-tool-bowstring' }));
  }
}

// RPG-avonturier (kap, cape, gereedschap) i.p.v. het vorige platte
// visser-silhouet — de voorste arm (en het werktuig erin) wijst standaard
// naar rechts/voren; facingLeftFor spiegelt de hele groep bij het naar links
// lopen. Kap en cape blijven vaste, neutrale tinten (net als de mantel in de
// art-styleguide) zodat het "accent" de speler blijft onderscheiden via de
// tuniek, ook met meerdere spelers tegelijk in beeld.
function appendAnglerFigure(g, { accent = 'var(--accent)', skin = '#e8b98a', hood = '#2e5c4a', boots = '#3c2f22', tool = null } = {}) {
  g.append(svgEl('ellipse', { cx: 0, cy: 10, rx: 9, ry: 3, class: 'dbc-angler-shadow' }));
  // cape, achter de tuniek, waaiert uit naar de rugzijde
  g.append(svgEl('path', { d: 'M -6 -8 Q -15 -1 -10 9 Q -6 6 -4 -2 Z', class: 'dbc-angler-cape' }));
  // laarzen
  g.append(svgEl('rect', { x: -4.2, y: 2, width: 3.6, height: 7.5, rx: 1.6, fill: boots }));
  g.append(svgEl('rect', { x: 0.6, y: 2, width: 3.6, height: 7.5, rx: 1.6, fill: boots }));
  // achterste arm
  g.append(svgEl('path', { d: 'M -5 -6 Q -9 -3 -8 2', fill: 'none', stroke: skin, 'stroke-width': 3, 'stroke-linecap': 'round' }));
  // tuniek, per speler gekleurd via accent
  g.append(svgEl('path', { d: 'M -7 -9 Q 0 -12 7 -9 L 6 2 Q 0 6 -6 2 Z', fill: accent, stroke: '#fff', 'stroke-width': 1.1 }));
  g.append(svgEl('rect', { x: -6, y: 0, width: 12, height: 2.4, rx: 1, class: 'dbc-angler-belt' }));
  if (tool) {
    g.append(svgEl('path', { d: 'M 5 -5 Q 10 -6 12 -3', fill: 'none', stroke: skin, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    appendTool(g, tool);
  } else {
    g.append(svgEl('path', { d: 'M 5 -6 Q 9 -3 8 2', fill: 'none', stroke: skin, 'stroke-width': 3, 'stroke-linecap': 'round' }));
  }
  g.append(svgEl('circle', { cx: 0, cy: -13, r: 5.5, fill: skin, stroke: '#0d1117', 'stroke-width': 0.6 }));
  // kap
  g.append(svgEl('path', {
    d: 'M -6.5 -13 Q -8.5 -25 0 -25 Q 8.5 -25 6.5 -13 Q 3 -18.5 0 -18.5 Q -3 -18.5 -6.5 -13 Z',
    fill: hood, stroke: '#fff', 'stroke-width': 0.8
  }));
  g.append(svgEl('path', { d: 'M -1.6 -25 L 1.6 -25 L 0 -29.5 Z', class: 'dbc-angler-hood-trim' }));
  g.append(svgEl('circle', { cx: 0, cy: -15.5, r: 1.3, fill: '#fff' }));
}

function toolFor(fishingPhase, gatheringKind, inCombat) {
  if (fishingPhase) return 'rod';
  if (gatheringKind === 'wood') return 'axe';
  if (gatheringKind === 'rock') return 'pickaxe';
  if (inCombat) return 'weapon';
  return null;
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
  appendAnglerFigure(g, { accent: color, tool: toolFor(p.fishingPhase, p.gatheringKind, p.inCombat) });
  svg.append(g);
  if (p.fishingPhase || p.gatheringKind || p.inCombat) {
    const icon = svgEl('text', { x: cx, y: cy - 38, class: 'dbc-player-fishing', 'text-anchor': 'middle' });
    icon.textContent = p.fishingPhase ? '🎣' : p.inCombat ? '⚔️' : GATHER_UI[p.gatheringKind].icon;
    svg.append(icon);
  }
  const label = svgEl('text', { x: cx, y: cy - 31, class: 'dbc-player-label', 'text-anchor': 'middle' });
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

// Eén gedeelde, kaartbrede lichtval (lichter bovenaan, donkerder onderaan) —
// userSpaceOnUse over de volle viewBox, dus volledig los van de individuele
// tegelgrenzen. 's Nachts komt daar een blauwige, donkerder overlay bij (zie
// appendNightOverlay) zodat het hele eiland zichtbaar in sfeer verandert.
function buildTileDefs() {
  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', {
    id: 'dbc-atmosphere', gradientUnits: 'userSpaceOnUse',
    x1: '0', y1: VIEW_BOX.minY, x2: '0', y2: VIEW_BOX.minY + VIEW_BOX.height
  });
  grad.append(svgEl('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': '0.12' }));
  grad.append(svgEl('stop', { offset: '55%', 'stop-color': '#fff', 'stop-opacity': '0' }));
  grad.append(svgEl('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': '0.16' }));
  defs.append(grad);
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

// Wereldrand: een waterval die letterlijk in het niets stort — twee vage,
// verticale stromen die naar onderen toe oplossen in de duisternis.
function appendVoidDecor(svg, cx, cy, seed) {
  const g = svgEl('g', { transform: `translate(${cx},${cy})`, class: 'dbc-tile-decor' });
  const offset = (seed - 0.5) * 8;
  g.append(svgEl('path', { d: `M ${-6 + offset} -9 Q ${-4 + offset} 0 ${-7 + offset} 9`, class: 'dbc-tile-void-stream' }));
  g.append(svgEl('path', { d: `M ${3 + offset} -9 Q ${5 + offset} 0 ${2 + offset} 9`, class: 'dbc-tile-void-stream' }));
  svg.append(g);
}

// Echte kleine gebouwen i.p.v. een icoon-in-kader: muur + dak + deur + venster
// plus een hangend uithangbord met het bestaande emoji-icoon. Een lichte
// zijmuur-sliver geeft het geheel dimensie (dezelfde 2.5D-kanteling als de
// speler- en boomfiguren), zonder de hex-positionering aan te raken.
const BUILDING_VARIANT = {
  vishandel: { roof: 'pitched', roofColor: 'var(--dbc-sea-deep)' },
  aquarium: { roof: 'dome', roofColor: 'var(--dbc-stone)' },
  markt: { roof: 'tent', roofColor: 'var(--dbc-ember)' },
  lumberyard: { roof: 'pitched', roofColor: 'var(--dbc-bark-2)', accessory: 'logs' },
  quarry: { roof: 'pitched', roofColor: 'var(--dbc-iron)', accessory: 'rocks' }
};

function appendCottage(g, variant) {
  g.append(svgEl('ellipse', { cx: 0, cy: 15, rx: 15, ry: 3.4, class: 'dbc-bldg-shadow' }));
  g.append(svgEl('rect', { x: -9, y: -4, width: 20, height: 16, class: 'dbc-bldg-wall-side' }));
  g.append(svgEl('rect', { x: -11, y: -6, width: 20, height: 16, class: 'dbc-bldg-wall' }));
  g.append(svgEl('rect', { x: -3, y: 2, width: 6, height: 8, rx: 1, class: 'dbc-bldg-door' }));
  g.append(svgEl('rect', { x: -8, y: -2, width: 5, height: 5, rx: 0.6, class: 'dbc-bldg-window' }));
  if (variant.roof === 'dome') {
    g.append(svgEl('path', { d: 'M -13 -6 Q -1 -22 11 -6 Z', style: `fill:${variant.roofColor}`, class: 'dbc-bldg-roof' }));
    g.append(svgEl('circle', { cx: -1, cy: -18, r: 1.6, class: 'dbc-bldg-roof-finial' }));
  } else if (variant.roof === 'tent') {
    g.append(svgEl('path', { d: 'M -14 -6 L -1 -19 L 12 -6 Z', style: `fill:${variant.roofColor}`, class: 'dbc-bldg-roof' }));
    g.append(svgEl('path', { d: 'M -14 -6 L -1 -19 L -1 -6 Z', class: 'dbc-bldg-roof-shade' }));
  } else {
    g.append(svgEl('path', { d: 'M -14 -6 L -1 -17 L 12 -6 Z', style: `fill:${variant.roofColor}`, class: 'dbc-bldg-roof' }));
    g.append(svgEl('path', { d: 'M -1 -17 L 12 -6 L 9 -6 L -1 -14 Z', class: 'dbc-bldg-roof-shade' }));
  }
  if (variant.accessory === 'logs') {
    const logs = svgEl('g', { transform: 'translate(13,6)' });
    [0, 1, 2].forEach((i) => logs.append(svgEl('circle', { cx: 0, cy: -i * 3.4, r: 3, class: 'dbc-bldg-log' })));
    g.append(logs);
  } else if (variant.accessory === 'rocks') {
    const rocks = svgEl('g', { transform: 'translate(13,7)' });
    rocks.append(svgEl('circle', { cx: -2, cy: 0, r: 3.4, class: 'dbc-bldg-rock' }));
    rocks.append(svgEl('circle', { cx: 3, cy: 1.4, r: 2.6, class: 'dbc-bldg-rock' }));
    g.append(rocks);
  }
}

// Hall of Fame krijgt een obelisk i.p.v. een huisje — thematisch een monument,
// geen winkel.
function appendObelisk(g) {
  g.append(svgEl('ellipse', { cx: 0, cy: 13, rx: 12, ry: 3, class: 'dbc-bldg-shadow' }));
  g.append(svgEl('rect', { x: -10, y: 8, width: 20, height: 4, rx: 1, class: 'dbc-bldg-base' }));
  g.append(svgEl('polygon', { points: '-5,8 -4,-16 4,-16 5,8', class: 'dbc-bldg-obelisk' }));
  g.append(svgEl('polygon', { points: '0,-16 4,-16 5,8 2.5,8', class: 'dbc-bldg-obelisk-shade' }));
  g.append(svgEl('polygon', { points: '-2,-16 2,-16 0,-22', class: 'dbc-bldg-obelisk-tip' }));
}

// Haven en speler-aanlegsteigers krijgen een dokplateau op palen i.p.v. een
// huisje.
function appendDock(g) {
  g.append(svgEl('ellipse', { cx: 0, cy: 13, rx: 15, ry: 3.4, class: 'dbc-bldg-shadow' }));
  g.append(svgEl('rect', { x: -14, y: 1, width: 28, height: 8, rx: 1.4, class: 'dbc-bldg-dock-deck' }));
  [-11, -3, 5, 12].forEach((dx) => g.append(svgEl('rect', { x: dx - 1.2, y: 8, width: 2.4, height: 7, class: 'dbc-bldg-dock-pile' })));
  g.append(svgEl('line', { x1: -10, y1: 1, x2: -10, y2: -13, class: 'dbc-bldg-dock-pole' }));
  g.append(svgEl('path', { d: 'M -10 -13 L 0 -9 L -10 -6 Z', class: 'dbc-bldg-dock-flag' }));
}

function appendBuildingArt(svg, cx, cy, { type, icon, active }) {
  const g = svgEl('g', { class: `dbc-building ${active ? 'active' : 'locked'}`, transform: `translate(${cx},${cy})` });
  if (type === 'monument') appendObelisk(g);
  else if (type === 'haven' || type === 'harbor') appendDock(g);
  else appendCottage(g, BUILDING_VARIANT[type] || BUILDING_VARIANT.vishandel);
  const sign = svgEl('g', { transform: 'translate(0,-20)' });
  sign.append(svgEl('rect', { x: -8, y: -8, width: 16, height: 14, rx: 3, class: 'dbc-bldg-sign' }));
  const label = svgEl('text', { x: 0, y: 3, class: 'dbc-bldg-sign-icon', 'text-anchor': 'middle' });
  label.textContent = icon;
  sign.append(label);
  g.append(sign);
  svg.append(g);
}

function appendTileDecor(svg, tile, cx, cy, wx, wy) {
  const seed = tileHash(wx, wy);
  if (tile === 'f') appendTreeDecor(svg, cx, cy, seed);
  else if (tile === 'h') appendHillDecor(svg, cx, cy);
  else if (tile === 'p') appendPeakDecor(svg, cx, cy);
  else if (tile === 'w') appendVoidDecor(svg, cx, cy, seed);
  else if (WATER_CHARS.has(tile)) { if (seed < 0.4) appendWaveDecor(svg, cx, cy, seed); }
  else if (tile === 'L') { if (seed < 0.3) appendGrassDecor(svg, cx, cy, seed); }
  else if (tile === 'B') { if (seed < 0.4) appendSandDecor(svg, cx, cy, seed); }
}

function renderMapWrap(you, worldData, camX, camY, others = [], harbors = [], dayPhase = 'day') {
  const svg = svgEl('svg', {
    viewBox: `${VIEW_BOX.minX} ${VIEW_BOX.minY} ${VIEW_BOX.width} ${VIEW_BOX.height}`,
    // Keep hexagons proportional while scaling the visible map just enough
    // to cover the fixed game viewport without empty edges.
    preserveAspectRatio: 'xMidYMid slice',
    class: 'dbc-map',
    role: 'img',
    'aria-label': 'Kaart van The Big Blue C'
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
      const hex = svgEl('polygon', { points, fill: TILE_COLOR[tile] || TILE_COLOR.L, class: 'dbc-tile' });
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) hex.onclick = () => handleTileClick(wx, wy, tile, you);
      svg.append(hex);
      decorQueue.push({ tile, cx, cy, wx, wy });
    }
  }
  // Kaartbrede lichtval bovenop de vlakke tegelkleuren, los van tegelgrenzen
  // (zie buildTileDefs) — vóór de reliëfdecors zodat bomen/rotsen/golven
  // fris en scherp blijven.
  svg.append(svgEl('rect', {
    x: VIEW_BOX.minX, y: VIEW_BOX.minY, width: VIEW_BOX.width, height: VIEW_BOX.height,
    fill: 'url(#dbc-atmosphere)', 'pointer-events': 'none'
  }));
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
    // Sla het gebouw over als een speler er precies op staat — anders piept
    // het gebouw achter de visserfiguur uit.
    const occupied = (you.x === building.x && you.y === building.y)
      || others.some((other) => other.x === building.x && other.y === building.y);
    if (occupied) return;
    const { cx, cy } = hexPoints(building.x - camX, building.y - camY);
    appendBuildingArt(svg, cx, cy, { type: building.type, icon: building.icon, active: building.active });
  });

  // Door spelers gebouwde aanlegsteigers — dynamisch (per sessie), niet
  // onderdeel van de vaste wereld, maar visueel dezelfde dok-illustratie.
  harbors.forEach((harbor) => {
    if (harbor.x < camX || harbor.x >= camX + COLS || harbor.y < camY || harbor.y >= camY + ROWS) return;
    const occupied = (you.x === harbor.x && you.y === harbor.y) || others.some((other) => other.x === harbor.x && other.y === harbor.y);
    if (occupied) return;
    const { cx, cy } = hexPoints(harbor.x - camX, harbor.y - camY);
    appendBuildingArt(svg, cx, cy, { type: 'harbor', icon: '⚓', active: true });
  });

  // Wilde dieren: klein icoontje met slagschaduw op hun vaste graslandplek,
  // aanklikbaar zoals een boom (hout) of rots (steen) — start een
  // dobbelgevecht i.p.v. een gewone stap.
  (worldData.wildlife || []).forEach((spot) => {
    if (spot.x < camX || spot.x >= camX + COLS || spot.y < camY || spot.y >= camY + ROWS) return;
    const occupied = (you.x === spot.x && you.y === spot.y) || others.some((other) => other.x === spot.x && other.y === spot.y);
    if (occupied) return;
    const { cx, cy } = hexPoints(spot.x - camX, spot.y - camY);
    svg.append(svgEl('ellipse', { cx, cy: cy + 6, rx: 6, ry: 1.8, class: 'dbc-wildlife-shadow' }));
    const icon = svgEl('text', { x: cx, y: cy + 4, class: 'dbc-wildlife-icon', 'text-anchor': 'middle' });
    icon.textContent = '🐇';
    svg.append(icon);
  });

  others.forEach((other, index) => renderOtherPlayerMarker(svg, other, camX, camY, index));

  const { cx: px, cy: py } = hexPoints(you.x - camX, you.y - camY);
  const facingLeft = facingLeftFor(you.id, you);
  const player = svgEl('g', {
    class: 'dbc-player',
    transform: `translate(${px},${py}) scale(${facingLeft ? -1 : 1},1)`
  });
  appendAnglerFigure(player, { tool: toolFor(you.fishing, you.gathering?.kind, Boolean(you.combat)) });
  svg.append(player);

  // 's Nachts krijgt de hele kaart een koelere, donkerdere waas — het palet
  // is zelf de dag/nacht-indicator, net als bij de zeezones.
  if (dayPhase === 'night') {
    svg.append(svgEl('rect', {
      x: VIEW_BOX.minX, y: VIEW_BOX.minY, width: VIEW_BOX.width, height: VIEW_BOX.height,
      fill: '#17414F', opacity: '0.32', 'pointer-events': 'none'
    }));
  }

  const wrapDiv = E('div', 'dbc-map-wrap');
  wrapDiv.append(svg);

  wrapDiv.append(renderStatPills(you, dayPhase));
  wrapDiv.append(renderStatBars(you));
  if (activePanel === 'map') {
    wrapDiv.append(renderButtonRail('dbc-rail-right', RIGHT_BUTTONS));
  }

  const activityPanel = renderFishingPanel(you.fishing) || renderCombatPanel(you.combat) || renderGatheringPanel(you.gathering);
  if (activityPanel) {
    const overlay = E('div', 'dbc-fishing-overlay');
    overlay.append(activityPanel);
    wrapDiv.append(overlay);
  }
  return wrapDiv;
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

// Dobbelgevecht: één beest, vier knoppen, een korte logregel per worp — geen
// reactietijd nodig, elke beurt is één druk op de knop.
function combatBarRow(label, value, max, kind) {
  const row = E('div', `dbc-combat-bar-row dbc-combat-bar-${kind}`);
  row.append(E('span', 'dbc-combat-bar-label', label));
  const track = E('div', 'dbc-combat-bar-track');
  const fill = E('div', 'dbc-combat-bar-fill');
  fill.style.width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  track.append(fill);
  row.append(track);
  row.append(E('span', '', `${Math.max(0, value)}/${max}`));
  return row;
}

function renderCombatPanel(combat) {
  if (!combat) return null;
  const panel = E('div', 'dbc-combat');
  panel.append(E('div', 'dbc-combat-heading', `${combat.icon} ${combat.name}`));
  const bars = E('div', 'dbc-combat-bars');
  bars.append(combatBarRow('Jij', combat.youHealth, combat.youMaxHealth, 'you'));
  bars.append(combatBarRow(combat.name, combat.enemyHp, combat.enemyMaxHp, 'enemy'));
  panel.append(bars);
  panel.append(E('div', 'dbc-combat-log', combat.log[0] || 'Kies je actie...'));
  const actions = E('div', 'dbc-combat-actions');
  const attack = E('button', 'primary', '⚔️ Aanvallen');
  attack.onclick = () => action('huntAction', { choice: 'attack' });
  const defend = E('button', 'secondary', '🛡️ Verdedigen');
  defend.onclick = () => action('huntAction', { choice: 'defend' });
  const drink = E('button', 'secondary', '🍖 Eten');
  drink.disabled = !combat.canDrink;
  drink.onclick = () => action('huntAction', { choice: 'drink' });
  const flee = E('button', 'secondary', '🏃 Vluchten');
  flee.onclick = () => action('huntAction', { choice: 'flee' });
  actions.append(attack, defend, drink, flee);
  panel.append(actions);
  return panel;
}

function renderActivePanel(you, others, harbors) {
  if (activePanel === 'inventaris') return renderInventarisPanel(you, harbors);
  if (activePanel === 'markt') return renderMarktplaatsPanel(you, others);
  if (activePanel === 'vaardigheden') return renderVaardighedenPanel(you);
  if (activePanel === 'monument') return renderMonumentPanel(you);
  if (activePanel === 'world-map') return renderMapPanel(you);
  return E('div', 'dbc-hint', 'Tik op de kaart om te wandelen, op water vlak naast je om te vissen, op een boom/rots vlak naast je om te hakken/houwen, of op een dier om te jagen.');
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
  ctx.fillStyle = '#A34433';
  ctx.beginPath();
  ctx.arc(you.x, you.y, 1.8, 0, Math.PI * 2);
  ctx.fill();
  wrap.append(canvas);
  return wrap;
}

// Vaartuignaam per bootniveau (0..3), met de zone die je er vanaf kunt
// bereiken — de dobbelsteen/het schip communiceert zelf de voortgang.
const BOAT_TIER_TEXT = [
  'Kano — je kunt nog niet het water op.',
  'Vlot — je vaart over de kustwateren (Kelpwouden).',
  'Sloep — je vaart tot in de Wadzee.',
  'Langschip — je vaart overal, tot in de Rifzee.'
];

function renderSubtabs(tabs, activeId, onSelect) {
  const row = E('div', 'dbc-subtab-row');
  tabs.forEach((tab) => {
    const btn = E('button', `dbc-subtab-btn${tab.id === activeId ? ' active' : ''}`, `${tab.icon} ${tab.label}`);
    btn.type = 'button';
    btn.onclick = () => onSelect(tab.id);
    row.append(btn);
  });
  return row;
}

// Uitrusting: per categorie de eigen items als aan/uit-knoppen (actief item
// gemarkeerd), met een slijtagebalk en een Herstellen-knop zodra een stuk
// niet meer volledig intact is. Kopen gebeurt op de Marktplaats.
function renderEquipSection(you) {
  const wrap = E('div', 'dbc-equip-section');
  wrap.append(E('h5', '', 'Uitrusting'));
  Object.keys(GEAR_CATEGORY_META).forEach((category) => {
    const meta = GEAR_CATEGORY_META[category];
    const slot = you.gearShop[category];
    const card = E('div', 'dbc-gear-card');
    card.append(E('div', 'dbc-gear-title', `${meta.icon} ${meta.label}`));
    if (!slot.owned.length) {
      card.append(E('p', 'dbc-gear-help', 'Nog niets gekocht — bezoek de Marktplaats.'));
    } else {
      slot.owned.forEach((ownedEntry) => {
        const item = slot.catalog.find((entry) => entry.id === ownedEntry.id);
        if (!item) return;
        const isEquipped = slot.equipped === ownedEntry.id;
        const row = E('div', 'dbc-equip-row');
        const btn = E('button', `dbc-subtab-btn${isEquipped ? ' active' : ''}`, `${item.icon} ${item.name}`);
        btn.type = 'button';
        btn.onclick = () => action('equipGear', { category, id: isEquipped ? null : ownedEntry.id });
        row.append(btn);
        row.append(E('span', 'dbc-inventory-quality', `🔧 ${ownedEntry.durability}/${ownedEntry.maxDurability}`));
        if (ownedEntry.durability < ownedEntry.maxDurability) {
          const repair = E('button', 'secondary', 'Herstellen');
          repair.onclick = () => action('repairGear', { category, id: ownedEntry.id });
          row.append(repair);
        }
        card.append(row);
      });
    }
    wrap.append(card);
  });
  return wrap;
}

let inventarisTab = 'bezit';
const INVENTARIS_TABS = [
  { id: 'bezit', icon: '🎒', label: 'Bezittingen' },
  { id: 'sets', icon: '📖', label: 'Sets' },
  { id: 'uitrusting', icon: '⭐', label: 'Uitrusting' },
  { id: 'bouwen', icon: '🔨', label: 'Bouwen' }
];

function renderBouwenSection(you, harbors) {
  const wrap = E('div', 'dbc-panel');
  const mine = (harbors || []).find((harbor) => harbor.ownerId === you.id);
  if (mine) {
    const card = E('div', 'dbc-gear-card');
    card.append(E('div', 'dbc-gear-title', '⚓ Aanlegsteiger'));
    card.append(E('p', 'dbc-gear-help', `Gebouwd op (${mine.x}, ${mine.y}). Je boot ligt hier veilig terwijl je in deze wereld bent.`));
    wrap.append(card);
    return wrap;
  }
  const card = E('div', 'dbc-build-stub');
  card.append(E('div', 'dbc-gear-title', '⚓ Aanlegsteiger bouwen'));
  card.append(E('p', 'dbc-gear-help', `Kost €${200} en moet op een strandtegel staan — loop naar het strand en bouw hier.`));
  const button = E('button', 'primary', `Bouw hier (€200)`);
  button.disabled = you.cash < 200;
  button.onclick = () => action('buildHarbor', { x: you.x, y: you.y });
  card.append(button);
  wrap.append(card);
  return wrap;
}

function renderInventarisPanel(you, harbors) {
  const wrap = E('div', 'dbc-panel');
  wrap.append(E('h4', '', '🎒 Inventaris'));
  wrap.append(E('p', 'dbc-panel-copy', 'Al je bezittingen, je setvoortgang en je uitrusting op één plek.'));
  wrap.append(renderSubtabs(INVENTARIS_TABS, inventarisTab, (id) => { inventarisTab = id; renderGame(state.room); }));

  if (inventarisTab === 'bezit') {
    wrap.append(renderInventory(you, 'fish', { mode: 'readOnly' }));
    wrap.append(renderInventory(you, 'wood', { mode: 'readOnly' }));
    wrap.append(renderInventory(you, 'rock', { mode: 'readOnly' }));
    wrap.append(renderInventory(you, 'meat', { mode: 'eat' }));
  } else if (inventarisTab === 'sets') {
    wrap.append(renderSets(you, 'fish'));
    wrap.append(renderSets(you, 'wood'));
    wrap.append(renderSets(you, 'rock'));
    wrap.append(renderSets(you, 'meat'));
  } else if (inventarisTab === 'uitrusting') {
    const grid = E('div', 'dbc-gear-grid');
    Object.keys(GEAR_LABELS).forEach((key) => {
      const info = GEAR_LABELS[key];
      const level = you.gear[key];
      const maxed = level >= you.gearMaxLevel;
      const card = E('div', 'dbc-gear-card');
      card.append(E('div', 'dbc-gear-title', `${info.icon} ${info.label} · niveau ${level}/${you.gearMaxLevel}`));
      card.append(E('p', 'dbc-gear-help', info.help));
      if (key === 'boat') card.append(E('p', 'dbc-gear-help', BOAT_TIER_TEXT[Math.min(level, 3)]));
      const button = E('button', 'secondary', maxed ? 'Maximum bereikt' : `Upgraden (€${you.gearCosts[level]})`);
      button.disabled = maxed || you.cash < you.gearCosts[level];
      button.onclick = () => action('buyUpgrade', { category: key });
      card.append(button);
      grid.append(card);
    });
    wrap.append(grid);
    wrap.append(renderEquipSection(you));
  } else if (inventarisTab === 'bouwen') {
    wrap.append(renderBouwenSection(you, harbors));
  }
  return wrap;
}

// Drankjes werken meteen bij aankoop (geen inventarisplek) — de knop toont
// zelf waarom hij uitstaat: vol of te weinig geld.
function renderConsumableShop(you) {
  const wrap = E('div', 'dbc-gear-grid');
  (you.consumableShop || []).forEach((item) => {
    const full = item.kind === 'energy' ? you.stats.energy >= you.stats.maxEnergy : you.stats.health >= you.stats.maxHealth;
    const card = E('div', 'dbc-gear-card');
    card.append(E('div', 'dbc-gear-title', `${item.icon} ${item.name}`));
    card.append(E('p', 'dbc-gear-help', `Herstelt ${item.restore} ${item.kind === 'energy' ? 'energie' : 'gezondheid'}.`));
    const button = E('button', 'secondary', full ? 'Al vol' : `Kopen (€${item.price})`);
    button.disabled = full || you.cash < item.price;
    button.onclick = () => action('buyConsumable', { kind: item.kind });
    card.append(button);
    wrap.append(card);
  });
  return wrap;
}

// Winkel: per categorie de volledige catalogus, met "In bezit" i.p.v. een
// koopknop zodra je het al hebt.
function renderShopSection(you) {
  const wrap = E('div', 'dbc-shop-section');
  wrap.append(E('h5', '', '⚡ Drankjes'));
  wrap.append(renderConsumableShop(you));
  Object.keys(GEAR_CATEGORY_META).forEach((category) => {
    const meta = GEAR_CATEGORY_META[category];
    const slot = you.gearShop[category];
    wrap.append(E('h5', '', `${meta.icon} ${meta.label}`));
    const grid = E('div', 'dbc-gear-grid');
    slot.catalog.forEach((item) => {
      const owned = slot.owned.some((entry) => entry.id === item.id);
      const card = E('div', 'dbc-gear-card');
      const statLine = item.armor ? `Pantser +${item.armor}` : `Aanval +${item.attack}`;
      card.append(E('div', 'dbc-gear-title', `${item.icon} ${item.name}`));
      card.append(E('p', 'dbc-gear-help', `${statLine} · slijtvastheid ${item.maxDurability}`));
      const button = E('button', 'secondary', owned ? 'In bezit' : `Kopen (€${item.price})`);
      button.disabled = owned || you.cash < item.price;
      button.onclick = () => action('buyGear', { category, id: item.id });
      card.append(button);
      grid.append(card);
    });
    wrap.append(grid);
  });
  return wrap;
}

let marktTab = 'verkopen';
const MARKT_TABS = [
  { id: 'verkopen', icon: '🐟', label: 'Verkopen' },
  { id: 'winkel', icon: '🧥', label: 'Winkel' },
  { id: 'ruilen', icon: '🤝', label: 'Ruilen' }
];

function renderMarktplaatsPanel(you, others) {
  const wrap = E('div', 'dbc-panel');
  wrap.append(E('h4', '', '🏪 Marktplaats'));
  wrap.append(E('p', 'dbc-panel-copy', 'Verkoop je vangst, koop uitrusting of ruil met andere spelers in deze wereld.'));
  wrap.append(renderSubtabs(MARKT_TABS, marktTab, (id) => { marktTab = id; renderGame(state.room); }));

  if (marktTab === 'verkopen') {
    wrap.append(renderInventory(you, 'fish'));
    wrap.append(renderInventory(you, 'wood'));
    wrap.append(renderInventory(you, 'rock'));
    wrap.append(renderInventory(you, 'meat'));
  } else if (marktTab === 'winkel') {
    wrap.append(renderShopSection(you));
  } else if (marktTab === 'ruilen') {
    wrap.append(renderRuilenBody(you, others));
  }
  return wrap;
}

function renderVaardighedenPanel(you) {
  const wrap = E('div', 'dbc-panel');
  wrap.append(E('h4', '', `⭐ Vaardigheden · totaalniveau ${you.totalLevel}`));
  wrap.append(E('p', 'dbc-panel-copy', 'Elke vangst, kap, delving, jacht, nieuwe ontdekking en ruil levert xp op. Niveau 1 tot en met 99 per vaardigheid.'));
  const grid = E('div', 'dbc-gear-grid');
  Object.keys(SKILL_LABELS).forEach((key) => {
    const info = SKILL_LABELS[key];
    const skill = you.skills[key];
    const card = E('div', 'dbc-gear-card');
    card.append(E('div', 'dbc-gear-title', `${info.icon} ${info.label} · niveau ${skill.level}/99`));
    card.append(E('p', 'dbc-gear-help', info.help));
    const track = E('div', 'dbc-timer-track');
    const fill = E('div', 'dbc-timer-fill');
    fill.style.width = `${skill.maxed ? 100 : Math.round((skill.xpIntoLevel / skill.xpForNextLevel) * 100)}%`;
    track.append(fill);
    card.append(track);
    card.append(E('p', 'dbc-gear-help', skill.maxed
      ? `${skill.xp} xp · maximumniveau bereikt`
      : `${skill.xpIntoLevel}/${skill.xpForNextLevel} xp naar niveau ${skill.level + 1}`));
    grid.append(card);
  });
  wrap.append(grid);
  return wrap;
}

let tradeTargetId = null;
let tradeOfferUids = new Set();
let tradeRequestUids = new Set();

// Genormaliseerde ruilpool over de vier voorraadtypes — elke uid is al uniek
// per speler (server deelt één teller over vis/hout/steen/vlees), dus deze
// lijst kan gerust items van alle vier types samen bevatten.
function combinedInventory(player) {
  return [
    ...player.inventory.map((item) => ({ uid: item.uid, weightKg: item.weightKg, icon: item.fish.icon, name: item.fish.name })),
    ...player.woodInventory.map((item) => ({ uid: item.uid, weightKg: item.weightKg, icon: item.item.icon, name: item.item.name })),
    ...player.rockInventory.map((item) => ({ uid: item.uid, weightKg: item.weightKg, icon: item.item.icon, name: item.item.name })),
    ...player.meatInventory.map((item) => ({ uid: item.uid, weightKg: item.weightKg, icon: item.item.icon, name: item.item.name }))
  ];
}

function renderRuilenBody(you, others) {
  const wrap = E('div', 'dbc-trade-panel');

  if (!others.length) {
    wrap.append(E('p', 'dbc-empty', 'Je bent alleen in deze wereld. Nodig vrienden uit via de gamecode om samen te vissen en te ruilen.'));
    return wrap;
  }

  if (tradeTargetId && !others.some((p) => p.id === tradeTargetId)) tradeTargetId = null;

  const playerList = E('div', 'dbc-trade-players');
  others.forEach((p) => {
    const btn = E('button', `dbc-trade-player-btn ${p.id === tradeTargetId ? 'active' : ''}`,
      `${p.name} · €${p.cash} · ${combinedInventory(p).length} items`);
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
    box.append(E('p', 'dbc-empty', 'Niets beschikbaar.'));
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
    row.append(checkbox, E('span', '', ` ${item.icon} ${item.name} · ${item.weightKg.toFixed(1)} kg`));
    box.append(row);
  });
  return box;
}

function renderTradeBuilder(you, target) {
  const wrap = E('div', 'dbc-trade-builder');
  const yourItems = combinedInventory(you);
  const targetItems = combinedInventory(target);
  const validOfferUids = new Set(yourItems.map((item) => item.uid));
  for (const uid of tradeOfferUids) if (!validOfferUids.has(uid)) tradeOfferUids.delete(uid);
  const validRequestUids = new Set(targetItems.map((item) => item.uid));
  for (const uid of tradeRequestUids) if (!validRequestUids.has(uid)) tradeRequestUids.delete(uid);

  const columns = E('div', 'dbc-trade-columns');
  columns.append(renderTradeItemPicker('Jij biedt', yourItems, tradeOfferUids));
  columns.append(renderTradeItemPicker(`${target.name} heeft`, targetItems, tradeRequestUids));
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
      const parts = side.items.map((item) => `${item.display.icon} ${item.display.name}`);
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
  const sets = kind === 'fish' ? you.sets : kind === 'wood' ? you.woodSets : kind === 'rock' ? you.rockSets : you.meatSets;
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

const selectedUidsByKind = { fish: new Set(), wood: new Set(), rock: new Set(), meat: new Set() };
const INVENTORY_LABELS = {
  fish: { title: 'Vangst', empty: 'Nog niets gevangen.', itemKey: 'fish' },
  wood: { title: 'Hout', empty: 'Nog niets gehakt.', itemKey: 'item' },
  rock: { title: 'Steen', empty: 'Nog niets gedolven.', itemKey: 'item' },
  meat: { title: 'Vlees', empty: 'Nog niets buitgemaakt.', itemKey: 'item' }
};

// Kookvuur: een vaste rij recepten (zie DISH_DISPLAY) die het eerste
// niet-'dish' stuk vlees omzet naar een gerecht met een buff — geen aparte
// "kies je tweede ingrediënt"-stap nodig, de server kiest het beschikbare
// vlees automatisch.
function renderCookSection(you) {
  const wrap = E('div', 'dbc-inventory');
  wrap.append(E('h4', '', '🔥 Kookvuur'));
  wrap.append(E('p', 'dbc-panel-copy', 'Bereidt het eerste rauwe of geroosterde stuk vlees tot een gerecht met een tijdelijke buff.'));
  const hasRaw = you.meatInventory.some((item) => item.quality !== 'dish');
  const grid = E('div', 'dbc-gear-grid');
  DISH_DISPLAY.forEach((dish) => {
    const card = E('div', 'dbc-gear-card');
    card.append(E('div', 'dbc-gear-title', `${dish.icon} ${dish.name}`));
    card.append(E('p', 'dbc-gear-help', `${dish.buffIcon} ${dish.buffLabel}`));
    const button = E('button', 'secondary', `Bereiden (€${dish.cost})`);
    button.disabled = !hasRaw || you.cash < dish.cost;
    button.onclick = () => action('cook', { station: 'kookvuur', recipeId: dish.id });
    card.append(button);
    grid.append(card);
  });
  wrap.append(grid);
  return wrap;
}

// `mode` bepaalt de actie per rij: 'sell' (Marktplaats, standaard) toont
// selectie + verkoopknoppen, 'readOnly' (Inventaris: vis/hout/steen) toont
// enkel de lijst, 'eat' (Inventaris: vlees) toont kwaliteit + Roosteren/Eet.
function renderInventory(you, kind = 'fish', { mode = 'sell' } = {}) {
  const list = kind === 'fish' ? you.inventory : kind === 'wood' ? you.woodInventory : kind === 'rock' ? you.rockInventory : you.meatInventory;
  const labels = INVENTORY_LABELS[kind];
  const selectedUids = selectedUidsByKind[kind];
  const wrap = E('div', 'dbc-inventory');
  wrap.append(E('h4', '', `${labels.title} (${list.length})`));
  if (!list.length) {
    wrap.append(E('p', 'dbc-empty', labels.empty));
    if (mode === 'eat') wrap.append(renderCookSection(you));
    return wrap;
  }

  const validUids = new Set(list.map((item) => item.uid));
  for (const uid of selectedUids) if (!validUids.has(uid)) selectedUids.delete(uid);

  if (mode === 'sell') {
    const actionsRow = E('div', 'dbc-inventory-actions');
    const sellSelected = E('button', 'primary', `Verkoop geselecteerde (${selectedUids.size})`);
    sellSelected.disabled = !selectedUids.size;
    sellSelected.onclick = () => { action('sell', { kind, uids: [...selectedUids] }); selectedUids.clear(); };
    const sellAll = E('button', 'secondary', 'Verkoop alles');
    sellAll.onclick = () => { action('sell', { kind, uid: 'all' }); selectedUids.clear(); };
    actionsRow.append(sellSelected, sellAll);
    wrap.append(actionsRow);
  } else if (mode === 'eat') {
    const eatAll = E('button', 'primary', 'Eet alles op');
    eatAll.onclick = () => action('eat', { uid: 'all' });
    wrap.append(eatAll);
  }

  const listWrap = E('div', 'dbc-inventory-list');
  list.forEach((item) => {
    const entry = item[labels.itemKey];
    const row = E('div', 'dbc-inventory-row');
    if (mode === 'sell') {
      const checkbox = E('input', 'dbc-inventory-check');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedUids.has(item.uid);
      checkbox.onchange = () => {
        if (checkbox.checked) selectedUids.add(item.uid); else selectedUids.delete(item.uid);
        renderGame(state.room);
      };
      row.append(checkbox);
    }
    row.append(E('span', 'dbc-inventory-label', `${entry.icon} ${entry.name} · ${item.weightKg.toFixed(1)} kg`));
    if (mode === 'eat') {
      const qualityChip = E('span', `dbc-inventory-quality ${item.quality}`, QUALITY_LABEL[item.quality] || 'Rauw');
      if (item.buff) qualityChip.title = `${item.buff.icon} ${item.buff.label}`;
      row.append(qualityChip);
      row.append(E('span', 'dbc-inventory-price', `⚡${entry.energy}`));
      if (item.quality === 'raw') {
        const roast = E('button', 'secondary', 'Roosteren');
        roast.onclick = () => action('cook', { station: 'kampvuur', uid: item.uid });
        row.append(roast);
      }
      const eatButton = E('button', 'secondary', 'Eet');
      eatButton.onclick = () => action('eat', { uid: item.uid });
      row.append(eatButton);
    } else {
      row.append(E('span', 'dbc-inventory-price', `€${item.price}`));
      if (mode === 'sell') {
        const sellButton = E('button', 'secondary', 'Verkoop');
        sellButton.onclick = () => { action('sell', { kind, uid: item.uid }); selectedUids.delete(item.uid); };
        row.append(sellButton);
      }
    }
    listWrap.append(row);
  });
  wrap.append(listWrap);
  if (mode === 'eat') wrap.append(renderCookSection(you));
  return wrap;
}
