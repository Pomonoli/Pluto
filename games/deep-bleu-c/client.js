import { hexToPixel, hexCorners, hexDistance } from './hex-client.js';

export const leaderboardConfig={columns:[
  {key:'rank',label:'#',short:'#',width:'rank'},
  {key:'username',label:'Speler',short:'Speler',width:'player'},
  {key:'discovered',label:'Ontdekte soorten',short:'Soorten',width:'wide'}
]};

const HEX_SIZE = 18;
// v6 gebruikt de hex als rustige kaarttaal. De tegelrand valt exact op de
// rasterpitch, zodat de lage-contrastlijn overal even breed blijft.
const HEX_DRAW_SIZE = HEX_SIZE;
// Desktop toont 22×15 i.p.v. 18×12 tegels: 330 tegenover 216, dus ongeveer
// 53% meer wereld. In portret gebruiken we een hoge uitsnede zodat mobiel niet
// alsnog het grootste deel van die extra context door `slice` verliest.
const VIEWPORT_PRESETS = {
  desktop: { cols: 22, rows: 15 },
  portrait: { cols: 9, rows: 20 }
};

// Exacte omvattende rechthoek van de gekozen cols × rows-tegels (in de
// eigen hex-pixelruimte). De viewBox hierop baseren — i.p.v. een handmatig
// geschatte marge — garandeert dat de rand-tegels het venster volledig
// vullen: elke marge-mismatch liet eerder een reep achtergrondkleur zien
// (het "blauwe randje") aan één kant van de kaart.
function computeCoreBounds(cols, rows) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
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
Object.values(VIEWPORT_PRESETS).forEach((preset) => { preset.bounds = computeCoreBounds(preset.cols, preset.rows); });
function currentViewportPreset() {
  return window.innerHeight > window.innerWidth ? VIEWPORT_PRESETS.portrait : VIEWPORT_PRESETS.desktop;
}
const HOOK_WINDOW_MS = 900;
const REEL_WINDOW_MS = 1300;
// Drie nabije schildertonen per terrein houden de v6-hexstructuur zichtbaar
// en geven tegelijk zacht reliëf. Water verloopt per zone van cyaan naar petrol;
// 'w' is de donkere wereldrand die in het niets stort.
const TILE_PALETTE = {
  L: ['#A9C98A', '#8FAE72', '#78995F'], B: ['#D0B27C', '#B79261', '#927047'],
  f: ['#587B55', '#3F6247', '#2A4433'], h: ['#B4BBB4', '#949D98', '#737D78'],
  p: ['#A6AAA4', '#7C8480', '#565E5A'], K: ['#78A06E', '#5F875D', '#456C4B'],
  q: ['#4C8466', '#376B55', '#24513F'], r: ['#B7E1DF', '#8FC6CC', '#68AEB9'],
  k: ['#72B2BF', '#4E8FA0', '#376F82'], a: ['#42788C', '#2A5A6B', '#1D4352'],
  m: ['#28596A', '#17414F', '#0F303B'], w: ['#163641', '#0B1D24', '#061116']
};
const MINIMAP_RGB = {
  L: [143, 174, 114], B: [168, 135, 95], f: [63, 98, 71], h: [148, 157, 152], p: [124, 132, 128],
  K: [95, 135, 93], q: [55, 107, 85],
  r: [143, 198, 204], k: [78, 143, 160], a: [42, 90, 107], m: [23, 65, 79], w: [11, 29, 36]
};
const WATER_CHARS = new Set(['r', 'k', 'a', 'm']);
const WOOD_TILE = 'f';
const ROCK_TILE = 'p';
const KELP_TILE = 'q';
const GEAR_CATEGORY_META = {
  clothes: { icon: '🧥', label: 'Kleding' },
  weapons: { icon: '⚔️', label: 'Wapens' },
  shields: { icon: '🛡️', label: 'Schilden' }
};
const TOOL_FALLBACK_META = [
  { key: 'rod', icon: '🎣', label: 'Hengel' },
  { key: 'bait', icon: '🪱', label: 'Aas' },
  { key: 'boat', icon: '⛵', label: 'Vaartuig' },
  { key: 'axe', icon: '🪓', label: 'Bijl' },
  { key: 'pickaxe', icon: '⛏️', label: 'Houweel' }
];
// Kookrecepten — puur weergave; de server (recipes.js) is de bron van
// waarheid en valideert alles zelf.
const DISH_DISPLAY = [
  { id: 'vislijn-stoofpot', name: 'Vislijnstoofpot', icon: '🍲', cost: 15, buffIcon: '🎣', buffLabel: 'Lijnsterkte' },
  { id: 'winterkost', name: 'Winterkost', icon: '🥘', cost: 15, buffIcon: '🔥', buffLabel: 'Warme Maag' },
  { id: 'jagerspot', name: 'Jagerspot', icon: '🍖', cost: 20, buffIcon: '🎲', buffLabel: 'Jachtlust' },
  { id: 'nachtbrouwsel', name: 'Nachtbrouwsel', icon: '🍵', cost: 20, buffIcon: '🌙', buffLabel: 'Nachtzicht' }
];
const QUALITY_LABEL = { raw: 'Rauw', roasted: 'Geroosterd', dish: 'Gerecht' };

// De vaste menuacties horen bij de bootbasis: ze staan samen onder de
// bootstatus in één compacte HUD, in plaats van als losse rail over de kaart.
const BOAT_BASE_BUTTONS = [
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
GATHER_UI.kelp = { verb: 'Oogsten', icon: '🌿', bg: 'De wierwortels bewegen met de stroming...' };
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
const WORLD_VERSION = 8;

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
let activeToolKey = 'rod';
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
  const viewport = currentViewportPreset();
  const camX = clampInt(you.x - Math.floor(viewport.cols / 2), 0, worldData.width - viewport.cols);
  const camY = clampInt(you.y - Math.floor(viewport.rows / 2), 0, worldData.height - viewport.rows);
  const stage = E('div', 'dbc-stage');
  stage.append(renderMapWrap(you, worldData, camX, camY, others, harbors, dayPhase, viewport));
  if (activePanel !== 'map') stage.append(renderPanelSheet(you, others, harbors));
  return stage;
}

function renderStatPills(you, dayPhase) {
  const wrap = E('div', 'dbc-stat-pills');
  const wealth = E('div', 'dbc-stat-pill dbc-stat-wealth');
  wealth.setAttribute('aria-label', `${dayPhase === 'night' ? 'Nacht' : 'Dag'}, ${you.cash} euro`);
  wealth.append(E('span', 'dbc-stat-hero-icon', dayPhase === 'night' ? '🌙' : '☀️'));
  wealth.append(E('span', 'dbc-stat-support-icon', '💰'));
  wealth.append(E('strong', 'dbc-stat-number', `€${you.cash}`));

  const discoveries = E('div', 'dbc-stat-pill dbc-stat-discoveries');
  discoveries.setAttribute('aria-label', `${you.discovered.length} ontdekte soorten`);
  discoveries.append(E('span', 'dbc-stat-hero-icon', '📖'), E('strong', 'dbc-stat-number', String(you.discovered.length)));

  const level = E('div', 'dbc-stat-pill dbc-stat-level');
  level.setAttribute('aria-label', `Level ${you.totalLevel}`);
  level.append(E('span', 'dbc-stat-hero-icon', '⭐'), E('strong', 'dbc-stat-number', `Lv. ${you.totalLevel}`));
  wrap.append(wealth, discoveries, level);
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
  bar.append(E('strong', 'dbc-stat-bar-value', `${value}/${max}`));
  bar.setAttribute('aria-label', `${kind === 'health' ? 'Gezondheid' : 'Energie'} ${value} van ${max}`);
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
  const armor = E('div', 'dbc-stat-armor');
  armor.setAttribute('aria-label', `Pantser ${you.stats.armor}`);
  armor.append(E('span', 'dbc-stat-armor-icon', '💎'), E('strong', 'dbc-stat-number', String(you.stats.armor)));
  wrap.append(armor);
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
  btn.setAttribute('aria-label', b.label);
  btn.onclick = () => {
    activePanel = b.id;
    if (b.id === 'monument') loadLeaderboard();
    renderGame(state.room);
  };
  col.append(btn, E('div', 'dbc-icon-label', b.label));
  return col;
}

function renderPanelSheet(you, others, harbors) {
  const overlay = E('div', 'dbc-sheet-overlay');
  overlay.onclick = (event) => {
    if (event.target === overlay) { activePanel = 'map'; renderGame(state.room); }
  };
  const usesV6Sheet = ['boat', 'inventaris', 'markt', 'monument', 'vaardigheden', 'world-map'].includes(activePanel);
  const sheet = E('div', `dbc-sheet dbc-sheet-${activePanel}${usesV6Sheet ? ' dbc-sheet-v6' : ''}`);
  const header = E('div', 'dbc-sheet-header');
  header.append(E('div', 'dbc-sheet-handle'));
  if (activePanel === 'boat') header.append(E('strong', 'dbc-sheet-mobile-title', `Bootbasis · ${you.boat.name} ${you.boat.tier}`));
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
  if (adjacent && tile === KELP_TILE) { action('gatherStart', { kind: 'kelp', x: wx, y: wy }); return; }
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

function renderOtherPlayerMarker(svg, p, camX, camY, colorIndex, viewport) {
  if (p.x < camX - 1 || p.x > camX + viewport.cols || p.y < camY - 1 || p.y > camY + viewport.rows) return;
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
function buildTileDefs(bounds) {
  const defs = svgEl('defs');
  Object.entries(TILE_PALETTE).forEach(([tile, colors]) => {
    const terrain = svgEl('linearGradient', { id: `dbc-terrain-${tile}`, x1: '0', y1: '0', x2: '1', y2: '1' });
    terrain.append(svgEl('stop', { offset: '0%', 'stop-color': colors[0] }));
    terrain.append(svgEl('stop', { offset: '55%', 'stop-color': colors[1] }));
    terrain.append(svgEl('stop', { offset: '100%', 'stop-color': colors[2] }));
    defs.append(terrain);
  });
  const grad = svgEl('linearGradient', {
    id: 'dbc-atmosphere', gradientUnits: 'userSpaceOnUse',
    x1: '0', y1: bounds.minY, x2: '0', y2: bounds.minY + bounds.height
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
  const broadleaf = (ox, oy, scale) => {
    const tg = svgEl('g', { transform: `translate(${ox},${oy}) scale(${scale})` });
    tg.append(svgEl('ellipse', { cx: 1, cy: 7, rx: 8.5, ry: 2.3, class: 'dbc-tile-tree-shadow' }));
    tg.append(svgEl('path', { d: 'M -1 6 L -1 -1 L 2 -1 L 3 6 Z', class: 'dbc-tile-tree-trunk' }));
    tg.append(svgEl('circle', { cx: -4.2, cy: -2, r: 5.7, class: 'dbc-tile-tree-leaf dbc-tree-leaf-dark' }));
    tg.append(svgEl('circle', { cx: 4, cy: -1, r: 5.8, class: 'dbc-tile-tree-leaf' }));
    tg.append(svgEl('circle', { cx: 0, cy: -7, r: 6.3, class: 'dbc-tile-tree-leaf dbc-tree-leaf-mid' }));
    tg.append(svgEl('path', { d: 'M -4 -8 Q -1 -12 3 -9 Q 0 -7 -3 -5 Z', class: 'dbc-tile-tree-highlight' }));
    return tg;
  };
  const conifer = (ox, oy, scale) => {
    const tg = svgEl('g', { transform: `translate(${ox},${oy}) scale(${scale})` });
    tg.append(svgEl('ellipse', { cx: 1, cy: 8, rx: 7.5, ry: 2.1, class: 'dbc-tile-tree-shadow' }));
    tg.append(svgEl('rect', { x: -1.2, y: 3, width: 2.4, height: 6, rx: 0.8, class: 'dbc-tile-tree-trunk' }));
    tg.append(svgEl('path', { d: 'M 0 -13 L -7 -2 L -4 -2 L -9 5 L 9 5 L 4 -2 L 7 -2 Z', class: 'dbc-conifer-crown' }));
    tg.append(svgEl('path', { d: 'M 0 -12 L -1 -2 L -5 4 L -8 4 L -4 -2 L -7 -2 Z', class: 'dbc-conifer-light' }));
    return tg;
  };
  if (seed < 0.43) g.append(conifer(0, -1, 1));
  else if (seed < 0.72) g.append(broadleaf(0, -1, 1));
  else { g.append(conifer(-4.8, 2, 0.7)); g.append(broadleaf(4.2, -1, 0.76)); }
  svg.append(g);
}

function appendHillDecor(svg, cx, cy, seed) {
  const g = svgEl('g', { transform: `translate(${cx},${cy})`, class: 'dbc-tile-decor' });
  const flip = seed > 0.5 ? -1 : 1;
  g.append(svgEl('ellipse', { cx: 1, cy: 7, rx: 11.5, ry: 3, class: 'dbc-tile-hill-shadow' }));
  g.append(svgEl('path', { d: 'M -10 6 L -7 -3 L -1 -8 L 7 -4 L 10 5 L 5 8 L -6 8 Z', class: 'dbc-tile-hill-face' }));
  g.append(svgEl('path', { d: flip > 0 ? 'M -7 -3 L -1 -8 L 0 5 L -6 8 Z' : 'M 7 -4 L -1 -8 L 0 5 L 5 8 Z', class: 'dbc-tile-hill-light' }));
  g.append(svgEl('path', { d: 'M -1 -8 L 7 -4 L 3 1 L 0 5 Z', class: 'dbc-tile-hill-shade' }));
  g.append(svgEl('circle', { cx: -9, cy: 7, r: 1.6, class: 'dbc-tile-scree' }));
  g.append(svgEl('circle', { cx: 9, cy: 7, r: 1.1, class: 'dbc-tile-scree' }));
  svg.append(g);
}

function appendPeakDecor(svg, cx, cy, seed) {
  const g = svgEl('g', { transform: `translate(${cx},${cy})`, class: 'dbc-tile-decor' });
  const shoulder = seed > 0.5 ? 5 : -5;
  g.append(svgEl('ellipse', { cx: 1, cy: 8, rx: 13, ry: 3.2, class: 'dbc-tile-hill-shadow' }));
  g.append(svgEl('polygon', { points: '-12,8 -4,-12 1,-6 5,-14 13,8', class: 'dbc-tile-peak-face' }));
  g.append(svgEl('polygon', { points: '5,-14 13,8 4,8 1,-5', class: 'dbc-tile-peak-shadow' }));
  g.append(svgEl('polygon', { points: '-4,-12 0,-7 -2,-5 -5,-7 -7,-5', class: 'dbc-tile-peak-snow' }));
  g.append(svgEl('polygon', { points: '5,-14 9,-7 6,-8 4,-5 2,-8', class: 'dbc-tile-peak-snow' }));
  g.append(svgEl('circle', { cx: shoulder, cy: 8, r: 1.5, class: 'dbc-tile-scree' }));
  svg.append(g);
}

function appendWaveDecor(svg, cx, cy, seed, tile) {
  const g = svgEl('g', { transform: `translate(${cx},${cy + (seed - 0.5) * 7})`, class: 'dbc-tile-decor' });
  g.append(svgEl('path', { d: 'M -9 -2 Q -5 -5 -1 -2 Q 3 1 7 -2', class: `dbc-tile-wave dbc-wave-${tile}` }));
  g.append(svgEl('path', { d: 'M -6 3 Q -2 0 2 3 Q 5 5 9 2', class: `dbc-tile-wave dbc-wave-${tile} dbc-wave-soft` }));
  if (tile === 'a' || tile === 'm') g.append(svgEl('path', { d: 'M -3 7 Q 0 5 4 7', class: `dbc-tile-wave dbc-wave-${tile} dbc-wave-glint` }));
  svg.append(g);
}

function appendGrassDecor(svg, cx, cy, seed) {
  const g = svgEl('g', { transform: `translate(${cx + (seed - 0.5) * 8},${cy + 3})`, class: 'dbc-tile-decor' });
  g.append(svgEl('path', { d: 'M -4 4 Q -4 -1 -6 -4 M -1 4 Q -1 -3 1 -6 M 2 4 Q 3 0 6 -3 M 0 3 Q 3 -1 5 -1', class: 'dbc-tile-grass' }));
  if (seed > 0.72) {
    g.append(svgEl('circle', { cx: -5.8, cy: -4.2, r: 1.15, class: 'dbc-wildflower dbc-wildflower-light' }));
    g.append(svgEl('circle', { cx: 5.8, cy: -3.2, r: 1, class: 'dbc-wildflower' }));
  }
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
  g.append(svgEl('path', { d: 'M -8 5 Q -3 2 2 4 M 2 -6 Q 6 -4 8 -5', class: 'dbc-tile-sand-ripple' }));
  svg.append(g);
}

function appendCoastFoam(svg, cx, cy, wx, wy, worldData) {
  for (let ny = wy - 1; ny <= wy + 1; ny += 1) {
    for (let nx = wx - 1; nx <= wx + 1; nx += 1) {
      if (nx < 0 || ny < 0 || nx >= worldData.width || ny >= worldData.height) continue;
      if (hexDistance(wx, wy, nx, ny) !== 1) continue;
      const neighbor = worldData.tiles[ny * worldData.width + nx];
      if (WATER_CHARS.has(neighbor) || neighbor === 'w' || neighbor === 'q') continue;
      const here = hexToPixel(wx, wy, HEX_SIZE);
      const there = hexToPixel(nx, ny, HEX_SIZE);
      const dx = there.x - here.x, dy = there.y - here.y;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length, uy = dy / length, tx = -uy, ty = ux;
      const bx = cx + ux * 14.7, by = cy + uy * 14.7;
      const x1 = bx - tx * 7, y1 = by - ty * 7, x2 = bx + tx * 7, y2 = by + ty * 7;
      const path = `M ${x1} ${y1} Q ${bx - ux * 2.2} ${by - uy * 2.2} ${x2} ${y2}`;
      svg.append(svgEl('path', { d: path, class: 'dbc-coast-foam dbc-tile-decor' }));
    }
  }
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

function appendFishSchoolDecor(svg, cx, cy) {
  const school = svgEl('g', { class: 'dbc-fish-school' });
  [[-8, 1, 1], [0, -4, 0.82], [7, 2, 0.72], [-1, 6, 0.58]].forEach(([dx, dy, scale]) => {
    school.append(svgEl('path', {
      d: `M ${cx + dx - 4 * scale} ${cy + dy} Q ${cx + dx} ${cy + dy - 2 * scale} ${cx + dx + 3 * scale} ${cy + dy} Q ${cx + dx} ${cy + dy + 2 * scale} ${cx + dx - 4 * scale} ${cy + dy} L ${cx + dx - 6 * scale} ${cy + dy - 2 * scale} L ${cx + dx - 6 * scale} ${cy + dy + 2 * scale} Z`
    }));
  });
  svg.append(school);
}

// Vaste gebouwen zijn illustratieve herkenningspunten uit het landschap.
// Ze hebben bewust geen label, status, uithangbord of interactie.
const BUILDING_VARIANT = {
  vishandel: { roofColor: '#7B4D34', accessory: 'barrels' },
  markt: { roofColor: '#A3623E', accessory: 'crates' },
  lumberyard: { roofColor: '#68432F', accessory: 'logs' }
};

function appendCottage(g, variant) {
  g.append(svgEl('ellipse', { cx: 1, cy: 15, rx: 20, ry: 4.2, class: 'dbc-bldg-shadow' }));
  g.append(svgEl('path', { d: 'M -14 -8 L 15 -8 L 15 12 L 8 16 L -14 12 Z', class: 'dbc-bldg-wall-side' }));
  g.append(svgEl('rect', { x: -16, y: -10, width: 27, height: 22, rx: 1, class: 'dbc-bldg-wall' }));
  g.append(svgEl('rect', { x: -4, y: 1, width: 8, height: 11, rx: 1, class: 'dbc-bldg-door' }));
  g.append(svgEl('rect', { x: -13, y: -4, width: 6, height: 6, rx: 0.8, class: 'dbc-bldg-window' }));
  g.append(svgEl('rect', { x: 7, y: -24, width: 4, height: 10, class: 'dbc-bldg-chimney' }));
  g.append(svgEl('path', { d: 'M -19 -9 L -2 -25 L 17 -9 L 12 -6 L -16 -6 Z', style: `fill:${variant.roofColor}`, class: 'dbc-bldg-roof' }));
  g.append(svgEl('path', { d: 'M -2 -25 L 17 -9 L 12 -6 L -2 -19 Z', class: 'dbc-bldg-roof-shade' }));
  if (variant.accessory === 'logs') {
    const logs = svgEl('g', { transform: 'translate(17,8)' });
    [0, 1, 2].forEach((i) => logs.append(svgEl('circle', { cx: 0, cy: -i * 3.4, r: 3, class: 'dbc-bldg-log' })));
    g.append(logs);
  } else if (variant.accessory === 'barrels') {
    g.append(svgEl('ellipse', { cx: 16, cy: 8, rx: 4, ry: 5.5, class: 'dbc-bldg-barrel' }));
  } else if (variant.accessory === 'crates') {
    g.append(svgEl('rect', { x: 13, y: 4, width: 8, height: 8, class: 'dbc-bldg-crate' }));
  }
}

// Hall of Fame krijgt een obelisk i.p.v. een huisje — thematisch een monument,
// geen winkel.
function appendTemple(g) {
  g.append(svgEl('ellipse', { cx: 0, cy: 18, rx: 25, ry: 4.5, class: 'dbc-bldg-shadow' }));
  g.append(svgEl('path', { d: 'M -23 13 H 23 L 20 18 H -20 Z', class: 'dbc-bldg-plaza' }));
  g.append(svgEl('rect', { x: -19, y: 9, width: 38, height: 4, class: 'dbc-bldg-base' }));
  [-14, -5, 5, 14].forEach((x) => {
    g.append(svgEl('rect', { x: x - 2, y: -8, width: 4, height: 18, class: 'dbc-bldg-column' }));
    g.append(svgEl('rect', { x: x - 3, y: -10, width: 6, height: 2.5, class: 'dbc-bldg-column-cap' }));
  });
  g.append(svgEl('path', { d: 'M -23 -9 L 0 -27 L 23 -9 Z', class: 'dbc-bldg-pediment' }));
  g.append(svgEl('path', { d: 'M -17 -10 L 0 -22 L 17 -10 Z', class: 'dbc-bldg-pediment-inset' }));
  g.append(svgEl('polygon', { points: '0,-20 4,-16 0,-12 -4,-16', class: 'dbc-bldg-gem' }));
}

function appendRotunda(g) {
  g.append(svgEl('ellipse', { cx: 0, cy: 18, rx: 24, ry: 4.5, class: 'dbc-bldg-shadow' }));
  g.append(svgEl('rect', { x: -17, y: -8, width: 34, height: 22, rx: 2, class: 'dbc-bldg-wall' }));
  g.append(svgEl('path', { d: 'M -18 -8 Q -15 -29 0 -34 Q 15 -29 18 -8 Z', class: 'dbc-bldg-dome' }));
  g.append(svgEl('rect', { x: -4, y: -38, width: 8, height: 6, class: 'dbc-bldg-cupola' }));
  g.append(svgEl('path', { d: 'M -5 -38 Q 0 -45 5 -38 Z', class: 'dbc-bldg-cupola-roof' }));
  [-11, -4, 4, 11].forEach((x) => g.append(svgEl('ellipse', { cx: x, cy: -1, rx: 2.2, ry: 4, class: 'dbc-bldg-round-window' })));
  g.append(svgEl('path', { d: 'M -19 8 L 0 -5 L 19 8 Z', class: 'dbc-bldg-pediment' }));
  [-11, -4, 4, 11].forEach((x) => g.append(svgEl('rect', { x: x - 1.7, y: 7, width: 3.4, height: 10, class: 'dbc-bldg-column' })));
  g.append(svgEl('rect', { x: -21, y: 16, width: 42, height: 4, class: 'dbc-bldg-base' }));
}

function appendQuarryHouse(g) {
  appendCottage(g, { roofColor: '#666A67' });
  g.append(svgEl('path', { d: 'M 11 13 L 15 2 L 22 -2 L 27 9 L 23 15 Z', class: 'dbc-bldg-quarry-rock' }));
  g.append(svgEl('path', { d: 'M 15 2 L 22 -2 L 20 9 L 11 13 Z', class: 'dbc-bldg-quarry-light' }));
}

function appendHarborHouse(g) {
  g.append(svgEl('path', { d: 'M -22 8 L 19 8 L 24 18 L -18 18 Z', class: 'dbc-bldg-plaza' }));
  appendCottage(g, { roofColor: '#70452E', accessory: 'barrels' });
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

function appendBasaltNeedle(g) {
  g.append(svgEl('ellipse', { cx: 0, cy: 13, rx: 12, ry: 3, class: 'dbc-bldg-shadow' }));
  g.append(svgEl('path', { d: 'M -8 10 L -4 -24 L 2 -34 L 8 10 Z', class: 'dbc-basalt-needle' }));
  g.append(svgEl('path', { d: 'M 2 -34 L 8 10 L 2 7 Z', class: 'dbc-basalt-shade' }));
  g.append(svgEl('circle', { cx: -1, cy: -20, r: 2.2, class: 'dbc-wierlight' }));
}

function appendBuildingArt(svg, cx, cy, { type }) {
  const scale = type === 'monument' || type === 'aquarium' ? 1.24
    : type === 'landmark' || type === 'harbor' ? 1
      : 1.08;
  const g = svgEl('g', { class: `dbc-building dbc-building-${type}`, transform: `translate(${cx},${cy}) scale(${scale})` });
  if (type === 'monument') appendTemple(g);
  else if (type === 'aquarium') appendRotunda(g);
  else if (type === 'quarry') appendQuarryHouse(g);
  else if (type === 'haven') appendHarborHouse(g);
  else if (type === 'harbor') appendDock(g);
  else if (type === 'landmark') appendBasaltNeedle(g);
  else appendCottage(g, BUILDING_VARIANT[type] || BUILDING_VARIANT.vishandel);
  svg.append(g);
}

function appendTileDecor(svg, tile, cx, cy, wx, wy, worldData) {
  const seed = tileHash(wx, wy);
  if (tile === 'f') appendTreeDecor(svg, cx, cy, seed);
  else if (tile === 'h') appendHillDecor(svg, cx, cy, seed);
  else if (tile === 'p') appendPeakDecor(svg, cx, cy, seed);
  else if (tile === 'w') appendVoidDecor(svg, cx, cy, seed);
  else if (tile === 'K') {
    appendGrassDecor(svg, cx, cy, seed);
    const kelp = svgEl('path', { d: `M ${cx - 7} ${cy + 7} Q ${cx - 10} ${cy - 1} ${cx - 5} ${cy - 8} M ${cx + 6} ${cy + 7} Q ${cx + 10} ${cy - 2} ${cx + 5} ${cy - 9}`, class: 'dbc-kelp-frond' });
    svg.append(kelp);
  }
  else if (tile === 'q') {
    const kelp = svgEl('path', { d: `M ${cx - 8} ${cy + 8} Q ${cx - 13} ${cy - 2} ${cx - 5} ${cy - 12} M ${cx} ${cy + 8} Q ${cx - 5} ${cy - 4} ${cx + 2} ${cy - 15} M ${cx + 8} ${cy + 8} Q ${cx + 14} ${cy - 3} ${cx + 6} ${cy - 12}`, class: 'dbc-kelp-frond dbc-kelp-node' });
    svg.append(kelp);
  }
  else if (WATER_CHARS.has(tile)) {
    if (seed < 0.68) appendWaveDecor(svg, cx, cy, seed, tile);
    else if (seed < 0.76) appendFishSchoolDecor(svg, cx, cy);
    if (tile === 'r') appendCoastFoam(svg, cx, cy, wx, wy, worldData);
  }
  else if (tile === 'L') { if (seed < 0.3) appendGrassDecor(svg, cx, cy, seed); }
  else if (tile === 'B') { if (seed < 0.4) appendSandDecor(svg, cx, cy, seed); }
}

function appendBoatModel(svg, boat, cx, cy, { moving = false } = {}) {
  const g = svgEl('g', { class: `dbc-player-boat${moving ? ' moving' : ''}`, transform: `translate(${cx},${cy})` });
  if (moving) {
    g.append(svgEl('path', { d: 'M -4 7 Q -10 13 -18 14 M 4 7 Q 10 13 18 14', class: 'dbc-boat-wake' }));
  }
  g.append(svgEl('ellipse', { cx: 0, cy: 6, rx: 12, ry: 3.5, class: 'dbc-boat-shadow' }));
  g.append(svgEl('path', { d: 'M -13 0 Q 0 11 13 0 L 9 -5 L -9 -5 Z', class: 'dbc-boat-hull' }));
  g.append(svgEl('line', { x1: 0, y1: -3, x2: 0, y2: -18, class: 'dbc-boat-mast' }));
  g.append(svgEl('path', { d: 'M 1 -17 Q 11 -12 10 -5 L 1 -7 Z', class: 'dbc-boat-sail dbc-boat-sail-player' }));
  if (boat.stations.includes('workbench')) g.append(svgEl('rect', { x: -8, y: -7, width: 6, height: 4, rx: 1, class: 'dbc-boat-station' }));
  if (boat.stations.includes('cookingTable')) g.append(svgEl('circle', { cx: 6, cy: -5, r: 2.6, class: 'dbc-boat-cook' }));
  svg.append(g);
}

function renderMapWrap(you, worldData, camX, camY, others = [], harbors = [], dayPhase = 'day', viewport = VIEWPORT_PRESETS.desktop) {
  const { cols, rows, bounds } = viewport;
  const svg = svgEl('svg', {
    viewBox: `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`,
    // Keep hexagons proportional while scaling the visible map just enough
    // to cover the fixed game viewport without empty edges.
    preserveAspectRatio: 'xMidYMid slice',
    class: 'dbc-map',
    role: 'img',
    'aria-label': 'Kaart van The Big Blue C'
  });
  svg.append(buildTileDefs(bounds));

  // Eén extra ring tegels buiten het zichtbare venster tekenen: de SVG clipt
  // alles buiten de viewBox vanzelf, maar zonder deze rand tonen de rechte
  // viewBox-hoeken een zaagtandpatroon met de achtergrondkleur erdoorheen
  // (het "blauwe randje"). De rand vult die hoeken op met echte tegels.
  // Reliëfdecors (bomen, rotsen, golven, ...) tekenen we in een aparte, latere
  // pas zodat ze nooit onder een lateref gebuurtegel wegvallen wanneer ze
  // buiten hun eigen hex uitsteken.
  const decorQueue = [];
  for (let row = -1; row <= rows; row += 1) {
    for (let col = -1; col <= cols; col += 1) {
      const wx = camX + col, wy = camY + row;
      if (wx < 0 || wx >= worldData.width || wy < 0 || wy >= worldData.height) continue;
      const tile = worldData.tiles[wy * worldData.width + wx] || 'L';
      const { cx, cy } = hexPoints(col, row);
      const points = hexCorners(cx, cy, HEX_DRAW_SIZE).map(([px, py]) => `${px},${py}`).join(' ');
      const terrain = TILE_PALETTE[tile] ? tile : 'L';
      const hex = svgEl('polygon', { points, fill: `url(#dbc-terrain-${terrain})`, class: `dbc-tile dbc-tile-${terrain}` });
      if (row >= 0 && row < rows && col >= 0 && col < cols) hex.onclick = () => handleTileClick(wx, wy, tile, you);
      svg.append(hex);
      decorQueue.push({ tile, cx, cy, wx, wy });
    }
  }
  // Kaartbrede lichtval bovenop de vlakke tegelkleuren, los van tegelgrenzen
  // (zie buildTileDefs) — vóór de reliëfdecors zodat bomen/rotsen/golven
  // fris en scherp blijven.
  svg.append(svgEl('rect', {
    x: bounds.minX, y: bounds.minY, width: bounds.width, height: bounds.height,
    fill: 'url(#dbc-atmosphere)', 'pointer-events': 'none'
  }));
  decorQueue.forEach(({ tile, cx, cy, wx, wy }) => appendTileDecor(svg, tile, cx, cy, wx, wy, worldData));

  // Decoratieve bootjes in de Haven — puur sfeer, de bootupgrade zelf koop je
  // op de Handelsmarkt en werkt overal op de kaart.
  (worldData.boats || []).forEach((boat) => {
    if (boat.x < camX - 1 || boat.x > camX + cols || boat.y < camY - 1 || boat.y > camY + rows) return;
    const { cx, cy } = hexPoints(boat.x - camX, boat.y - camY);
    const g = svgEl('g', { class: 'dbc-boat', transform: `translate(${cx},${cy})` });
    g.append(svgEl('ellipse', { cx: 0, cy: 4, rx: 8, ry: 2.5, class: 'dbc-boat-shadow' }));
    g.append(svgEl('path', { d: 'M -8 2 Q 0 8 8 2 L 6 -1 L -6 -1 Z', class: 'dbc-boat-hull' }));
    g.append(svgEl('line', { x1: 0, y1: -1, x2: 0, y2: -10, class: 'dbc-boat-mast' }));
    g.append(svgEl('path', { d: 'M 0 -9 L 6 -3 L 0 -3 Z', class: 'dbc-boat-sail' }));
    svg.append(g);
  });

  worldData.buildings.forEach((building) => {
    if (building.x < camX || building.x >= camX + cols || building.y < camY || building.y >= camY + rows) return;
    // Sla het gebouw over als een speler er precies op staat — anders piept
    // het gebouw achter de visserfiguur uit.
    const occupied = (you.x === building.x && you.y === building.y)
      || others.some((other) => other.x === building.x && other.y === building.y);
    if (occupied) return;
    const { cx, cy } = hexPoints(building.x - camX, building.y - camY);
    appendBuildingArt(svg, cx, cy, { type: building.type });
  });

  // Door spelers gebouwde aanlegsteigers — dynamisch (per sessie), niet
  // onderdeel van de vaste wereld, maar visueel dezelfde dok-illustratie.
  harbors.forEach((harbor) => {
    if (harbor.x < camX || harbor.x >= camX + cols || harbor.y < camY || harbor.y >= camY + rows) return;
    const occupied = (you.x === harbor.x && you.y === harbor.y) || others.some((other) => other.x === harbor.x && other.y === harbor.y);
    if (occupied) return;
    const { cx, cy } = hexPoints(harbor.x - camX, harbor.y - camY);
    appendBuildingArt(svg, cx, cy, { type: 'harbor' });
  });

  // Wilde dieren: klein icoontje met slagschaduw op hun vaste graslandplek,
  // aanklikbaar zoals een boom (hout) of rots (steen) — start een
  // dobbelgevecht i.p.v. een gewone stap.
  (worldData.wildlife || []).forEach((spot) => {
    if (spot.x < camX || spot.x >= camX + cols || spot.y < camY || spot.y >= camY + rows) return;
    const occupied = (you.x === spot.x && you.y === spot.y) || others.some((other) => other.x === spot.x && other.y === spot.y);
    if (occupied) return;
    const { cx, cy } = hexPoints(spot.x - camX, spot.y - camY);
    svg.append(svgEl('ellipse', { cx, cy: cy + 6, rx: 6, ry: 1.8, class: 'dbc-wildlife-shadow' }));
    const icon = svgEl('text', { x: cx, y: cy + 4, class: 'dbc-wildlife-icon', 'text-anchor': 'middle' });
    icon.textContent = '🐇';
    svg.append(icon);
  });

  others.forEach((other, index) => renderOtherPlayerMarker(svg, other, camX, camY, index, viewport));

  if (you.mode === 'land' && Number.isFinite(you.boat.x) && Number.isFinite(you.boat.y)
    && you.boat.x >= camX - 1 && you.boat.x <= camX + cols && you.boat.y >= camY - 1 && you.boat.y <= camY + rows) {
    const docked = hexPoints(you.boat.x - camX, you.boat.y - camY);
    appendBoatModel(svg, you.boat, docked.cx, docked.cy);
  }

  const { cx: px, cy: py } = hexPoints(you.x - camX, you.y - camY);
  if (you.mode === 'sea') {
    appendBoatModel(svg, you.boat, px, py, { moving: Boolean(you.path.length) });
  } else {
    const facingLeft = facingLeftFor(you.id, you);
    const player = svgEl('g', {
      class: 'dbc-player',
      transform: `translate(${px},${py}) scale(${facingLeft ? -1 : 1},1)`
    });
    appendAnglerFigure(player, { tool: toolFor(you.fishing, you.gathering?.kind, Boolean(you.combat)) });
    svg.append(player);
  }

  // 's Nachts krijgt de hele kaart een koelere, donkerdere waas — het palet
  // is zelf de dag/nacht-indicator, net als bij de zeezones.
  if (dayPhase === 'night') {
    svg.append(svgEl('rect', {
      x: bounds.minX, y: bounds.minY, width: bounds.width, height: bounds.height,
      fill: '#17414F', opacity: '0.32', 'pointer-events': 'none'
    }));
  }

  const wrapDiv = E('div', 'dbc-map-wrap');
  wrapDiv.append(svg);

  wrapDiv.append(renderStatPills(you, dayPhase));
  wrapDiv.append(renderStatBars(you));
  if (activePanel === 'map') wrapDiv.append(renderBoatBaseHud(you));

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

function renderBoatButton(you) {
  const button = E('button', 'dbc-boat-button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Open bootbasis');
  const condition = Math.round((you.boat.hp / you.boat.maxHp) * 100);
  const boat = svgEl('svg', { viewBox: '0 0 96 56', class: 'dbc-boat-mini', 'aria-hidden': 'true' });
  boat.append(
    svgEl('ellipse', { cx: 48, cy: 47, rx: 34, ry: 5, class: 'dbc-boat-hud-shadow' }),
    svgEl('path', { d: 'M11 31 Q48 49 85 29 Q77 48 49 52 Q20 49 11 31Z', class: 'dbc-boat-hud-hull' }),
    svgEl('path', { d: 'M23 33 Q49 42 74 32', class: 'dbc-boat-hud-rim' }),
    svgEl('path', { d: 'M43 35 L75 10', class: 'dbc-boat-hud-oar' }),
    svgEl('path', { d: 'M72 8 Q80 6 84 11 Q80 15 75 12Z', class: 'dbc-boat-hud-oar-blade' })
  );
  button.append(boat);
  const copy = E('span', 'dbc-boat-button-copy');
  copy.append(E('strong', '', `${you.boat.name} · ${you.boat.tier}`), E('small', '', `${condition}% romp · ${you.boat.stations.length}/${you.boat.baseSlots} stations`));
  button.append(copy);
  button.onclick = () => { activePanel = 'boat'; renderGame(state.room); };
  return button;
}

function renderBoatBaseHud(you) {
  const hud = E('div', 'dbc-boat-base-hud');
  hud.setAttribute('role', 'navigation');
  hud.setAttribute('aria-label', 'Bootbasis en menu');
  hud.append(renderBoatButton(you));
  const actions = E('div', 'dbc-boat-base-actions');
  BOAT_BASE_BUTTONS.forEach((button) => actions.append(renderIconButton(button)));
  hud.append(actions);
  return hud;
}

function formatUpgradeAmount(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
}

function visibleToolUpgrades(you) {
  if (Array.isArray(you.toolUpgrades) && you.toolUpgrades.length) return you.toolUpgrades;
  return TOOL_FALLBACK_META.map((tool) => ({
    ...tool,
    level: Number(you.gear?.[tool.key]) || 0,
    maxLevel: 4,
    current: { name: tool.label, benefit: 'Herstart de Pluto-server om de upgradevereisten te laden.' },
    next: null,
    serverRestartRequired: true
  }));
}

function renderToolUpgrades(you) {
  const section = E('section', 'dbc-tool-section');
  section.append(E('h5', '', 'Gereedschappen'));
  const tools = visibleToolUpgrades(you);
  if (!tools.some((tool) => tool.key === activeToolKey)) activeToolKey = tools[0]?.key || 'rod';
  const menu = E('div', 'dbc-tool-menu');
  menu.setAttribute('role', 'tablist');
  menu.setAttribute('aria-label', 'Kies gereedschap');
  tools.forEach((tool) => {
    const fallback = TOOL_FALLBACK_META.find((entry) => entry.key === tool.key);
    const label = fallback?.label || tool.current.name.split(' ')[0];
    const button = E('button', `dbc-tool-menu-btn${tool.key === activeToolKey ? ' active' : ''}`);
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tool.key === activeToolKey));
    button.setAttribute('aria-controls', `dbc-tool-panel-${tool.key}`);
    button.dataset.toolKey = tool.key;
    button.append(E('span', 'dbc-tool-menu-icon', tool.icon), E('span', 'dbc-tool-menu-label', label));
    button.onclick = () => {
      activeToolKey = tool.key;
      menu.querySelectorAll('.dbc-tool-menu-btn').forEach((item) => {
        const selected = item.dataset.toolKey === activeToolKey;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      grid.querySelectorAll('.dbc-tool-card').forEach((item) => item.classList.toggle('active', item.dataset.toolKey === activeToolKey));
    };
    menu.append(button);
  });
  section.append(menu);
  const grid = E('div', 'dbc-tool-grid');
  tools.forEach((tool) => {
    const card = E('div', `dbc-upgrade-card dbc-tool-card${tool.key === activeToolKey ? ' active' : ''}`);
    card.id = `dbc-tool-panel-${tool.key}`;
    card.dataset.toolKey = tool.key;
    card.setAttribute('role', 'tabpanel');
    const title = tool.serverRestartRequired
      ? tool.current.name
      : tool.next ? `${tool.current.name} → ${tool.next.name}` : `${tool.current.name} · voltooid`;
    card.append(E('h5', '', `${tool.icon} ${title}`));
    card.append(E('div', 'dbc-tool-level', `Niveau ${tool.level}/${tool.maxLevel}`));
    card.append(E('p', 'dbc-panel-copy', tool.next?.benefit || tool.current.benefit));
    if (tool.serverRestartRequired) {
      const button = E('button', 'secondary', 'Serverherstart vereist');
      button.disabled = true;
      card.append(button);
    }
    if (tool.next) {
      const req = tool.next.requires;
      const material = tool.material;
      const checklist = E('div', 'dbc-requirement-list');
      const unit = material.unit ? ` ${material.unit}` : '';
      checklist.append(E('span', material.available >= material.required ? 'met' : 'missing', `${formatUpgradeAmount(material.available)}/${material.required}${unit} ${material.label}`));
      checklist.append(E('span', you.cash >= req.cash ? 'met' : 'missing', `€${you.cash}/€${req.cash}`));
      checklist.append(E('span', tool.skillLevel >= req.skill ? 'met' : 'missing', `${tool.skillLabel} ${tool.skillLevel}/${req.skill}`));
      checklist.append(E('span', tool.hasWorkbench ? 'met' : 'missing', tool.hasWorkbench ? 'Werkbank aanwezig' : 'Werkbank vereist'));
      card.append(checklist);
      const button = E('button', 'primary', `Maak ${tool.next.name}`);
      button.disabled = material.available < material.required || you.cash < req.cash || tool.skillLevel < req.skill || !tool.hasWorkbench;
      button.onclick = () => action('buyUpgrade', { category: tool.key });
      card.append(button);
    }
    grid.append(card);
  });
  section.append(grid);
  return section;
}

function renderBoatBasePanel(you) {
  const wrap = E('div', 'dbc-panel dbc-boat-base');
  wrap.append(E('h4', '', `⛵ Bootbasis · ${you.boat.name} ${you.boat.tier}`));
  wrap.append(E('p', 'dbc-panel-copy', `Romp ${you.boat.hp}/${you.boat.maxHp} · ${you.mode === 'sea' ? 'op zee' : 'aangemeerd'} · ${you.boat.baseSlots} basisslots`));

  const diagram = E('div', 'dbc-boat-diagram');
  diagram.append(E('div', 'dbc-boat-hull-shape', ''));
  const slots = E('div', 'dbc-boat-slots');
  for (let index = 0; index < you.boat.baseSlots; index += 1) {
    const stationId = you.boat.stations[index];
    const station = (you.boatStations || []).find((entry) => entry.id === stationId);
    slots.append(E('div', `dbc-boat-slot${station ? ' filled' : ''}`, station ? `${station.icon} ${station.name}` : `Vrij slot ${index + 1}`));
  }
  diagram.append(slots);
  wrap.append(diagram);

  const stationSection = E('section', 'dbc-station-section');
  stationSection.append(E('h5', '', 'Bootstations'));
  const stationGrid = E('div', 'dbc-gear-grid dbc-station-grid');
  (you.boatStations || []).forEach((station) => {
    const placed = you.boat.stations.includes(station.id);
    const cost = station.cost?.softWoodKg || 0;
    const card = E('div', 'dbc-gear-card');
    card.append(E('div', 'dbc-gear-title', `${station.icon} ${station.name}`));
    card.append(E('p', 'dbc-gear-help', `${station.help} · ${cost} kg zacht hout`));
    const button = E('button', 'secondary', placed ? 'Geplaatst' : 'Plaats op boot');
    button.disabled = placed || you.boat.stations.length >= you.boat.baseSlots || you.softWoodKg < cost;
    button.onclick = () => action('placeBoatStation', { stationId: station.id });
    card.append(button);
    stationGrid.append(card);
  });
  stationSection.append(stationGrid);
  wrap.append(stationSection);
  wrap.append(renderToolUpgrades(you));

  const loop = E('div', 'dbc-upgrade-card dbc-create-loop');
  loop.append(E('h5', '', 'Catch → Cook → Create'));
  loop.append(E('p', 'dbc-panel-copy', `Kelpvezel ${you.materials.kelpFiber} · expeditierantsoenen ${you.createdSupplies}`));
  const rawFish = you.inventory.filter((item) => item.quality !== 'cooked');
  if (rawFish.length) {
    const cook = E('button', 'secondary', 'Bereid eerste vangst');
    cook.disabled = !you.boat.stations.includes('cookingTable');
    cook.onclick = () => action('cookCatch', { uid: rawFish[0].uid });
    loop.append(cook);
  }
  const create = E('button', 'primary', 'Maak expeditierantsoen');
  create.disabled = !you.boat.stations.includes('workbench') || !you.inventory.some((item) => item.quality === 'cooked') || you.materials.kelpFiber < 1;
  create.onclick = () => action('createSupply');
  loop.append(create);
  wrap.append(loop);
  return wrap;
}

function renderActivePanel(you, others, harbors) {
  if (activePanel === 'boat') return renderBoatBasePanel(you);
  if (activePanel === 'inventaris') return renderInventarisPanel(you, harbors);
  if (activePanel === 'markt') return renderMarktplaatsPanel(you, others);
  if (activePanel === 'vaardigheden') return renderVaardighedenPanel(you);
  if (activePanel === 'monument') return renderMonumentPanel(you);
  if (activePanel === 'world-map') return renderMapPanel(you);
  return E('div', 'dbc-hint', 'Tik op de kaart om te wandelen, op water vlak naast je om te vissen, op een boom/rots vlak naast je om te hakken/houwen, of op een dier om te jagen.');
}

function renderMapPanel(you) {
  const wrap = E('div', 'dbc-panel dbc-v6-panel dbc-world-map-panel');
  wrap.append(renderV6PanelTitle('🗺️', 'Grote map'));
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
  const frame = E('div', 'dbc-world-map-frame');
  frame.append(canvas);
  wrap.append(frame);
  return wrap;
}

function renderV6PanelTitle(icon, label, className = '') {
  const title = E('h4', `dbc-v6-title${className ? ` ${className}` : ''}`);
  title.append(E('span', 'dbc-v6-title-icon', icon), E('span', '', label));
  return title;
}

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
  const wrap = E('div', 'dbc-panel dbc-inventory-panel');
  const title = E('h4', 'dbc-inventory-title');
  const icon = svgEl('svg', { viewBox: '0 0 48 48', class: 'dbc-inventory-title-icon', 'aria-hidden': 'true' });
  icon.append(
    svgEl('path', { d: 'M16 14V10c0-4 3-7 8-7s8 3 8 7v4', class: 'dbc-inventory-icon-handle' }),
    svgEl('path', { d: 'M9 15h30l3 8-2 20H8L6 23Z', class: 'dbc-inventory-icon-bag' }),
    svgEl('path', { d: 'M7 23q17 8 34 0M14 15v25M34 15v25', class: 'dbc-inventory-icon-seam' }),
    svgEl('rect', { x: 20, y: 24, width: 8, height: 10, rx: 2, class: 'dbc-inventory-icon-lock' })
  );
  title.append(icon, E('span', '', 'Inventaris'));
  wrap.append(title);
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
  const wrap = E('div', 'dbc-panel dbc-v6-panel dbc-market-panel');
  wrap.append(renderV6PanelTitle('🏪', 'Marktplaats'));
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
  const wrap = E('div', 'dbc-panel dbc-v6-panel dbc-skills-panel');
  const heading = E('div', 'dbc-skills-heading');
  heading.append(E('span', 'dbc-skills-sun', '☀️'), renderV6PanelTitle('', `Vaardigheden · totaalniveau ${you.totalLevel}`, 'dbc-skills-title'));
  wrap.append(heading);
  wrap.append(E('p', 'dbc-panel-copy', 'Elke vangst, kap, delving, jacht, nieuwe ontdekking en ruil levert xp op. Niveau 1 tot en met 99 per vaardigheid.'));
  const grid = E('div', 'dbc-gear-grid');
  Object.keys(SKILL_LABELS).forEach((key) => {
    const info = SKILL_LABELS[key];
    const skill = you.skills[key];
    const card = E('div', `dbc-gear-card dbc-skill-card dbc-skill-${key}`);
    card.append(E('div', 'dbc-gear-title', `${info.icon} ${info.label} · niveau ${skill.level}/99`));
    card.append(E('p', 'dbc-gear-help', info.help));
    const track = E('div', 'dbc-timer-track dbc-skill-track');
    const fill = E('div', 'dbc-timer-fill dbc-skill-fill');
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
  const wrap = E('div', 'dbc-panel dbc-v6-panel dbc-monument-panel');
  wrap.append(renderV6PanelTitle('🏆', 'Hall of Fame'));
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
