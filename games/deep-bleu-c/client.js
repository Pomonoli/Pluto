import { hexToPixel, hexToViewport, hexCorners, hexDistance } from './hex-client.js';
import { treeStatus, treeIconUrl } from './tree-visuals.js';
import { wildlifeStatus, wildlifeIconUrl } from './wildlife-visuals.js';

export const leaderboardConfig={columns:[
  {key:'rank',label:'#',short:'#',width:'rank'},
  {key:'username',label:'Speler',short:'Speler',width:'player'},
  {key:'discovered',label:'Ontdekte soorten',short:'Soorten',width:'wide'},
  {key:'totalLevel',label:'Total level',short:'Level',width:'compact'}
]};

const HEX_SIZE = 18;
// Een kleine tekenoverlap voorkomt zichtbare antialiasingnaden tussen tegels.
// Het bewegingsraster houdt zijn oorspronkelijke afmetingen.
const HEX_DRAW_SIZE = HEX_SIZE + 0.3;
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
  L: ['#96B578', '#8FAE72', '#89A96D'], B: ['#BD9A68', '#B79261', '#AE8A5B'],
  f: ['#45684B', '#3F6247', '#3A5B42'], h: ['#9CA59F', '#949D98', '#8C9590'],
  p: ['#878E89', '#7C8480', '#737B77'], K: ['#658D61', '#5F875D', '#598059'],
  q: ['#3C7159', '#376B55', '#326550'], r: ['#99CDD1', '#8FC6CC', '#85C0C7'],
  k: ['#5798A8', '#4E8FA0', '#488799'], a: ['#306273', '#2A5A6B', '#275465'],
  m: ['#1B4756', '#17414F', '#153D4A'], w: ['#0E232B', '#0B1D24', '#0A1A21']
};
const MINIMAP_RGB = {
  L: [143, 174, 114], B: [168, 135, 95], f: [63, 98, 71], h: [148, 157, 152], p: [124, 132, 128],
  K: [95, 135, 93], q: [55, 107, 85],
  r: [143, 198, 204], k: [78, 143, 160], a: [42, 90, 107], m: [23, 65, 79], w: [11, 29, 36]
};
const WATER_CHARS = new Set(['r', 'k', 'a', 'm']);
// Reliëf per tegeltype, in pixels: hoeveel de tegel als een "puck" boven de
// waterbasis uitsteekt. Water blijft het laagste vlak; land steekt licht uit;
// heuvels duidelijk meer; onbeloopbare bergpieken torenen enorm boven de rest
// uit. Elke tegel tekent een donkerdere kopie van zichzelf iets lager
// (de "zijkant"), gevolgd door de echte tegel op zijn onveranderde positie —
// zo blijft klikafhandeling en spelerspositie exact gelijk, maar oogt de
// wereld als echt landschap i.p.v. een plat schaakbord.
const TILE_ELEVATION = {
  L: 3, B: 2, K: 3, q: 3, f: 5, h: 9, p: 19,
  r: 0, k: 0, a: 0, m: 0, w: 0
};
function tileElevation(tile) { return TILE_ELEVATION[tile] || 0; }
function darkenColor(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
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
// `art` verwijst naar een geïllustreerd rond icoon in assets/ui — die brengen
// hun eigen bronzen lijst mee, dus de knop eronder blijft zelf kaal.
const BOAT_BASE_BUTTONS = [
  { id: 'inventaris', art: 'inventaris', label: 'Inventaris' },
  { id: 'monument', art: 'hero', label: 'Hero' },
  { id: 'world-map', art: 'map', label: 'Map' }
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

// Keep in sync with worldgen.js; bypass older immutable map responses.
const WORLD_VERSION = 9;

let world = null;
let worldPromise = null;
function ensureWorld(expected) {
  // A running tab may retain the old atlas across a server restart. Never
  // draw new player coordinates over terrain from a different world.
  if (world && expected && (world.width !== expected.width || world.height !== expected.height
    || (expected.version && world.version !== expected.version))) {
    world = null;
    minimapBase = null;
    minimapWorldRef = null;
  }
  if (world || worldPromise) return world;
  worldPromise = fetch(`/api/deep-bleu-c/world?wv=${expected?.version || WORLD_VERSION}`, { cache: 'no-store' })
    .then((response) => response.json())
    .then((data) => {
      if (!data.ok) throw new Error(data.error || 'Kaart kon niet laden.');
      if (expected && (data.width !== expected.width || data.height !== expected.height
        || (expected.version && data.version !== expected.version))) throw new Error('De wereldkaart wordt bijgewerkt.');
      world = data;
      worldPromise = null;
      if (state?.room) renderGame(state.room);
    })
    .catch((error) => { console.error('Big Blue C wereld laden mislukt:', error); worldPromise = null; });
  return null;
}

let activePanel = 'map';
let activeNpcId = null;
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
  const loadedWorld = ensureWorld(game.world);
  wrap.append(loadedWorld
    ? renderStage(you, loadedWorld, others, game.harbors || [], game.dayPhase || 'day', game.npcs || [])
    : E('div', 'dbc-loading', 'Kaart wordt geladen...'));

  els.gameStage.append(wrap, logBox(game.log));
}

// De kaart blijft altijd zichtbaar op de achtergrond, schermvullend; een open
// paneel (Inventaris, Hero, ...) schuift eroverheen als een los "sheet" in
// plaats van de kaart te vervangen — zo blijft de wereld altijd in beeld.
function renderStage(you, worldData, others, harbors, dayPhase, npcs = []) {
  const viewport = currentViewportPreset();
  const camX = clampInt(you.x - Math.floor(viewport.cols / 2), 0, worldData.width - viewport.cols);
  const camY = clampInt(you.y - Math.floor(viewport.rows / 2), 0, worldData.height - viewport.rows);
  const stage = E('div', 'dbc-stage');
  stage.append(renderMapWrap(you, worldData, camX, camY, others, harbors, dayPhase, viewport, npcs));
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

function uiIconUrl(name) {
  return new URL(`./assets/ui/${name}.png`, import.meta.url).href;
}

function uiIconImg(name, className) {
  const img = E('img', className);
  img.src = uiIconUrl(name);
  img.alt = '';
  return img;
}

function renderIconButton(b) {
  const col = E('div', 'dbc-icon-col');
  const btn = E('button', `dbc-icon-btn${b.art ? ' art' : ''}`, b.art ? undefined : b.icon);
  btn.type = 'button';
  btn.title = b.label;
  btn.setAttribute('aria-label', b.label);
  if (b.art) btn.append(uiIconImg(b.art, 'dbc-icon-art'));
  btn.onclick = () => {
    activePanel = b.id;
    if (b.id === 'monument') loadLeaderboard();
    renderGame(state.room);
  };
  col.append(btn, E('div', 'dbc-icon-label', b.label));
  return col;
}

// Deze twee elementen (de backdrop en het scrollbare paneel zelf) worden
// maar één keer aangemaakt en daarna hergebruikt over alle renders heen —
// alleen hun inhoud wordt elke keer vervangen. Zo blijft de browser zijn
// eigen scrollpositie van het paneel vasthouden, ook al bouwt de rest van de
// pagina (kaart, HUD) bij elke serverupdate volledig opnieuw op.
let sheetOverlay = null;
let sheetInner = null;
let sheetInnerPanel = null;

function renderPanelSheet(you, others, harbors) {
  if (!sheetOverlay) {
    sheetOverlay = E('div', 'dbc-sheet-overlay');
    sheetOverlay.onclick = (event) => {
      if (event.target === sheetOverlay) { activePanel = 'map'; renderGame(state.room); }
    };
  }
  const usesV6Sheet = ['boat', 'inventaris', 'monument', 'world-map', 'npc'].includes(activePanel);
  const sheetClass = `dbc-sheet dbc-sheet-${activePanel}${usesV6Sheet ? ' dbc-sheet-v6' : ''}`;
  if (!sheetInner) {
    sheetInner = E('div', sheetClass);
    sheetOverlay.append(sheetInner);
  } else {
    sheetInner.className = sheetClass;
  }
  // Alleen bij het wisselen van paneel of tabblad (niet bij elke content-
  // ververshing binnen hetzelfde tabblad) terug naar boven scrollen — net
  // als vroeger elk paneel/tabblad altijd bovenaan opende.
  const panelKey = `${activePanel}:${activePanel === 'inventaris' ? inventarisTab : ''}:${inventarisTab === 'uitrusting' ? uitrustingTab : ''}:${activePanel === 'npc' ? activeNpcId : ''}`;
  if (sheetInnerPanel !== panelKey) {
    sheetInner.scrollTop = 0;
    sheetInnerPanel = panelKey;
  }
  const header = E('div', 'dbc-sheet-header');
  header.append(E('div', 'dbc-sheet-handle'));
  if (activePanel === 'boat') header.append(E('strong', 'dbc-sheet-mobile-title', `Bootbasis · ${you.boat.name} ${you.boat.tier}`));
  const close = E('button', 'dbc-sheet-close', '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Sluiten');
  close.onclick = () => { activePanel = 'map'; renderGame(state.room); };
  header.append(close);
  sheetInner.replaceChildren(header, renderActivePanel(you, others, harbors));
  return sheetOverlay;
}

function isWildlifeTile(wx, wy) {
  return Boolean(world && (world.wildlife || []).some((spot) => spot.x === wx && spot.y === wy));
}

// Naam, titel, dialoog en opdracht komen uit de statische wereldrespons
// (npcs.js op de server); de spelstate stuurt enkel nog de positie mee.
function npcProfile(id) {
  return (world?.npcs || []).find((npc) => npc.id === id) || null;
}

// Praten kan van vlakbij; sta je verder weg, dan loop je er eerst naartoe.
function handleNpcClick(npc, you) {
  if (you.combat) return;
  if (hexDistance(you.x, you.y, npc.x, npc.y) <= 1) {
    activeNpcId = npc.id;
    activePanel = 'npc';
    renderGame(state.room);
    return;
  }
  action('move', { x: npc.x, y: npc.y });
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

function hexPoints(worldCol, worldRow, camX, camY) {
  const { x, y } = hexToViewport(worldCol, worldRow, camX, camY, HEX_SIZE);
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

// Dorpsbewoners: puur decoratieve, niet-interactieve figuren die volgens
// world.npcHomes rondlopen (zie server tick()). Uiterlijk per type, gebouwd
// op dezelfde anglerrig als spelers/skins — zie appendHeadgear.
// Per NPC-id (zie npcs.js) het kleurenpalet en hoofddeksel op dezelfde
// chibi-rig als spelers en skins.
const NPC_APPEARANCE = {
  elara: { accent: '#8C8757', skin: '#E0B58C', hood: '#6E5A38', boots: '#6B563A', headgear: 'sunflowerhair' },
  krelis: { accent: '#35607F', skin: '#EAD3B8', hood: '#22405A', boots: '#5C4630', headgear: 'ceremonyhat' },
  joris: { accent: '#8A6A4A', skin: '#E3B58C', hood: '#6B4A32', boots: '#4A3728', headgear: 'glasses' },
  valerius: { accent: '#5A6470', skin: '#DDB08A', hood: '#39424C', boots: '#2E3339', headgear: 'officercap' },
  lars: { accent: '#EDE6D6', skin: '#E0B089', hood: '#6B4A32', boots: '#4A3728', headgear: 'shortbeard' },
  anja: { accent: '#7FA8C4', skin: '#EFC6A6', hood: '#5E88A8', boots: '#4A5A66', headgear: 'winterhood' },
  nikos: { accent: '#F2F0E8', skin: '#C98F63', hood: '#FBFAF6', boots: '#2E2E2C', headgear: 'chefhat' },
  kilgore: { accent: '#2E4468', skin: '#E2BB95', hood: '#1C2A44', boots: '#3A2E22', headgear: 'captaincap' },
  maria: { accent: '#5B7FA6', skin: '#C68A5E', hood: '#4A3728', boots: '#5C4630', headgear: 'ponytail' },
  borri: { accent: '#8A7A4A', skin: '#DDA877', hood: '#7A4A28', boots: '#4A3728', headgear: 'dwarfbeard' }
};

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

// Hoofddeksel per skin — een herkenbaar silhouet bovenop dezelfde kop/rig
// i.p.v. enkel een herkleuring, zodat skins ook op afstand uit elkaar te
// houden zijn. 'hood' (of onbekend) is de oorspronkelijke basiskap.
function appendHeadgear(g, kind, { hood, accent }) {
  if (kind === 'cap') {
    // Matroos: platte matrozenmuts met opstaande rand.
    g.append(svgEl('path', { d: 'M -6 -13 Q -6 -20.5 0 -20.5 Q 6 -20.5 6 -13 Z', fill: hood, stroke: '#fff', 'stroke-width': 0.8 }));
    g.append(svgEl('ellipse', { cx: 0, cy: -13, rx: 6.6, ry: 1.5, fill: hood, stroke: '#fff', 'stroke-width': 0.8 }));
    g.append(svgEl('circle', { cx: 0, cy: -20.2, r: 0.9, fill: '#fff' }));
    return;
  }
  if (kind === 'tricorn') {
    // Piraat / Spookpiraat: driekantige steek met een klein embleem.
    g.append(svgEl('path', {
      d: 'M -9.5 -15 Q -3 -23.5 0 -15.5 Q 3 -23.5 9.5 -15 Q 4.5 -11.5 0 -13.5 Q -4.5 -11.5 -9.5 -15 Z',
      fill: hood, stroke: '#0d1117', 'stroke-width': 0.7
    }));
    g.append(svgEl('circle', { cx: 0, cy: -17.6, r: 1.2, fill: '#E7C87A' }));
    return;
  }
  if (kind === 'horned') {
    // Viking: leren kap met twee gebogen hoorns.
    g.append(svgEl('path', { d: 'M -6.5 -13 Q -8 -21.5 -1 -20.5 Q 1 -21.5 6.5 -13 Q 3 -17 0 -17 Q -3 -17 -6.5 -13 Z', fill: hood, stroke: '#fff', 'stroke-width': 0.8 }));
    g.append(svgEl('path', { d: 'M -5.8 -17.5 Q -10.5 -23.5 -7.5 -27 Q -3.5 -23 -3.6 -17', fill: '#EDE3D2', stroke: '#B9AC90', 'stroke-width': 0.6 }));
    g.append(svgEl('path', { d: 'M 5.8 -17.5 Q 10.5 -23.5 7.5 -27 Q 3.5 -23 3.6 -17', fill: '#EDE3D2', stroke: '#B9AC90', 'stroke-width': 0.6 }));
    return;
  }
  if (kind === 'helmet') {
    // Duiker: ronde duikhelm met venster en kraagring.
    g.append(svgEl('circle', { cx: 0, cy: -14.8, r: 7.2, fill: hood, stroke: '#fff', 'stroke-width': 0.8 }));
    g.append(svgEl('circle', { cx: 0.6, cy: -14.8, r: 3.6, fill: '#BFE3EA', opacity: 0.88 }));
    g.append(svgEl('rect', { x: -3.4, y: -8.2, width: 6.8, height: 2, rx: 1, fill: '#8B96A0' }));
    return;
  }
  if (kind === 'leafcrown') {
    // Zeenimf: kroon van afwisselende koraal-/bladpunten.
    [-4.8, -1.7, 1.7, 4.8].forEach((x, i) => {
      g.append(svgEl('path', {
        d: `M ${x - 1.5} -13.5 Q ${x} -21 ${x + 1.5} -13.5 Z`,
        fill: i % 2 ? accent : hood, stroke: '#254536', 'stroke-width': 0.5
      }));
    });
    return;
  }
  if (kind === 'crown') {
    // Zeekoning: gouden kroon met een edelsteen.
    g.append(svgEl('path', {
      d: 'M -6.5 -13 L -6.5 -19.5 L -3.5 -16 L 0 -21.5 L 3.5 -16 L 6.5 -19.5 L 6.5 -13 Z',
      fill: hood, stroke: '#7A5A1E', 'stroke-width': 0.7
    }));
    g.append(svgEl('circle', { cx: 0, cy: -18, r: 1.1, fill: '#E86B6B' }));
    return;
  }
  if (kind === 'capgoggles') {
    // Monteur: platte pet met een veiligheidsbril op de rand.
    g.append(svgEl('path', { d: 'M -6.5 -13 Q -6.5 -19.5 0 -19.5 Q 6.5 -19.5 6.5 -13 Z', fill: hood, stroke: '#fff', 'stroke-width': 0.8 }));
    g.append(svgEl('rect', { x: -6.8, y: -14.3, width: 13.6, height: 1.8, rx: 0.6, fill: hood }));
    g.append(svgEl('circle', { cx: -2.6, cy: -13.1, r: 1.6, fill: '#CDE0E6', stroke: '#5A5F5C', 'stroke-width': 0.5 }));
    g.append(svgEl('circle', { cx: 2.6, cy: -13.1, r: 1.6, fill: '#CDE0E6', stroke: '#5A5F5C', 'stroke-width': 0.5 }));
    return;
  }
  if (kind === 'sunflowerhair') {
    // Elara: bruin haar met zonnebloemen en een takje lavendel.
    g.append(svgEl('path', {
      d: 'M -6.2 -13 Q -8 -21 0 -21.5 Q 8 -21 6.2 -13 Q 3 -17 0 -17 Q -3 -17 -6.2 -13 Z',
      fill: hood, stroke: '#4A3B26', 'stroke-width': 0.6
    }));
    [[-4.4, -19], [4.4, -18.6]].forEach(([fx, fy]) => {
      g.append(svgEl('circle', { cx: fx, cy: fy, r: 2.1, fill: '#E9C24A' }));
      g.append(svgEl('circle', { cx: fx, cy: fy, r: 0.9, fill: '#6B4A22' }));
    });
    g.append(svgEl('path', { d: 'M -6.6 -17.4 Q -8.6 -20.4 -7.4 -22.6', fill: 'none', stroke: '#9B7BC4', 'stroke-width': 1.3, 'stroke-linecap': 'round' }));
    return;
  }
  if (kind === 'ceremonyhat') {
    // Oude Krelis: hoge ceremoniehoed met gouden band en wit haar eronder.
    g.append(svgEl('path', { d: 'M -6.4 -13 Q -7.4 -16.6 -5.4 -17.6 L 5.4 -17.6 Q 7.4 -16.6 6.4 -13 Z', fill: '#EFEAE0' }));
    g.append(svgEl('path', { d: 'M -6.8 -17.4 L 6.8 -17.4 L 5.2 -26.5 Q 0 -28.5 -5.2 -26.5 Z', fill: hood, stroke: '#1A2E42', 'stroke-width': 0.7 }));
    g.append(svgEl('rect', { x: -6.6, y: -19.4, width: 13.2, height: 2.2, rx: 0.6, fill: '#C9A227' }));
    g.append(svgEl('circle', { cx: 0, cy: -23.4, r: 1.4, fill: '#C9A227' }));
    return;
  }
  if (kind === 'glasses') {
    // Joris: kortgeknipt haar met een ronde bril.
    g.append(svgEl('path', { d: 'M -6 -13.4 Q -6.8 -19.4 0 -19.6 Q 6.8 -19.4 6 -13.4 Q 3 -16.6 0 -16.6 Q -3 -16.6 -6 -13.4 Z', fill: hood, stroke: '#4A3320', 'stroke-width': 0.6 }));
    g.append(svgEl('circle', { cx: -2.4, cy: -14.4, r: 1.9, fill: '#DCEAF0', stroke: '#4A3320', 'stroke-width': 0.6, opacity: 0.9 }));
    g.append(svgEl('circle', { cx: 2.4, cy: -14.4, r: 1.9, fill: '#DCEAF0', stroke: '#4A3320', 'stroke-width': 0.6, opacity: 0.9 }));
    g.append(svgEl('path', { d: 'M -0.5 -14.4 L 0.5 -14.4', stroke: '#4A3320', 'stroke-width': 0.6 }));
    return;
  }
  if (kind === 'officercap') {
    // Inspecteur Valerius: uniformpet met klep, gasmasker om de hals.
    g.append(svgEl('path', { d: 'M -6.4 -14.6 Q -6.6 -21.4 0 -21.6 Q 6.6 -21.4 6.4 -14.6 Z', fill: hood, stroke: '#232A31', 'stroke-width': 0.7 }));
    g.append(svgEl('rect', { x: -6.6, y: -16.4, width: 13.2, height: 2, rx: 0.5, fill: '#232A31' }));
    g.append(svgEl('path', { d: 'M -6.6 -14.6 L 4.6 -14.6 L 6.8 -12.8 L -6.6 -12.8 Z', fill: '#232A31' }));
    g.append(svgEl('circle', { cx: -4.6, cy: -8.6, r: 2.2, fill: '#9AA6B0', stroke: '#4A545E', 'stroke-width': 0.6 }));
    return;
  }
  if (kind === 'shortbeard') {
    // Lars: kort bruin haar met een volle baard.
    g.append(svgEl('path', { d: 'M -6 -13.6 Q -6.8 -19.6 0 -19.8 Q 6.8 -19.6 6 -13.6 Q 3 -16.8 0 -16.8 Q -3 -16.8 -6 -13.6 Z', fill: hood, stroke: '#4A3320', 'stroke-width': 0.6 }));
    g.append(svgEl('path', { d: 'M -5.4 -12.4 Q -5 -6 0 -5.6 Q 5 -6 5.4 -12.4 Q 2.6 -10.4 0 -10.4 Q -2.6 -10.4 -5.4 -12.4 Z', fill: hood, stroke: '#4A3320', 'stroke-width': 0.5 }));
    return;
  }
  if (kind === 'winterhood') {
    // Anja: gevoerde wintermuts met een kat op de schouder.
    g.append(svgEl('path', { d: 'M -6.6 -13 Q -8 -22.4 0 -22.6 Q 8 -22.4 6.6 -13 Q 3 -17.4 0 -17.4 Q -3 -17.4 -6.6 -13 Z', fill: hood, stroke: '#3C5E76', 'stroke-width': 0.7 }));
    g.append(svgEl('path', { d: 'M -6.8 -14.6 Q 0 -12.4 6.8 -14.6 L 6.8 -12.4 Q 0 -10.2 -6.8 -12.4 Z', fill: '#E7EEF2' }));
    const cat = svgEl('g', { transform: 'translate(-8.4,-8.6)' });
    cat.append(svgEl('ellipse', { cx: 0, cy: 1.4, rx: 3.1, ry: 2.2, fill: '#E4CDB2' }));
    cat.append(svgEl('circle', { cx: -0.4, cy: -1.6, r: 2.1, fill: '#E4CDB2' }));
    cat.append(svgEl('path', { d: 'M -2.2 -3 L -1.4 -0.9 L -2.9 -1.1 Z M 1.4 -3 L 0.6 -0.9 L 2.1 -1.1 Z', fill: '#C9A98A' }));
    cat.append(svgEl('circle', { cx: -1.2, cy: -1.8, r: 0.4, fill: '#3A2E22' }));
    cat.append(svgEl('circle', { cx: 0.4, cy: -1.8, r: 0.4, fill: '#3A2E22' }));
    g.append(cat);
    return;
  }
  if (kind === 'chefhat') {
    // Chef Nikos: hoge koksmuts met een donkere snor.
    g.append(svgEl('rect', { x: -5.4, y: -17.2, width: 10.8, height: 2.6, rx: 0.6, fill: '#FBFAF6', stroke: '#C9C4B6', 'stroke-width': 0.5 }));
    g.append(svgEl('path', { d: 'M -5.6 -17 Q -7.4 -25.4 0 -25.8 Q 7.4 -25.4 5.6 -17 Z', fill: '#FBFAF6', stroke: '#C9C4B6', 'stroke-width': 0.6 }));
    g.append(svgEl('path', { d: 'M -3 -10.6 Q 0 -9.2 3 -10.6 Q 0 -11.8 -3 -10.6 Z', fill: '#3A2A1E' }));
    return;
  }
  if (kind === 'captaincap') {
    // Kapitein Kilgore: kapiteinspet met goggles en een pijp.
    g.append(svgEl('path', { d: 'M -6.4 -15.2 Q -6.6 -21.8 0 -22 Q 6.6 -21.8 6.4 -15.2 Z', fill: '#F2F0E8', stroke: '#1C2A44', 'stroke-width': 0.7 }));
    g.append(svgEl('rect', { x: -6.6, y: -17.2, width: 13.2, height: 2.2, rx: 0.5, fill: hood }));
    g.append(svgEl('path', { d: 'M -6.6 -15.2 L 4.6 -15.2 L 6.8 -13.4 L -6.6 -13.4 Z', fill: hood }));
    g.append(svgEl('circle', { cx: 0, cy: -19.2, r: 1.2, fill: '#C9A227' }));
    g.append(svgEl('circle', { cx: -3.2, cy: -12.6, r: 1.7, fill: '#C9B27A', stroke: '#5C4630', 'stroke-width': 0.5, opacity: 0.85 }));
    g.append(svgEl('circle', { cx: 3.2, cy: -12.6, r: 1.7, fill: '#C9B27A', stroke: '#5C4630', 'stroke-width': 0.5, opacity: 0.85 }));
    return;
  }
  if (kind === 'ponytail') {
    // Maria: naar achteren gebonden haar in een staart.
    g.append(svgEl('path', { d: 'M -6.2 -13.4 Q -7 -20 0 -20.2 Q 7 -20 6.2 -13.4 Q 3 -16.8 0 -16.8 Q -3 -16.8 -6.2 -13.4 Z', fill: hood, stroke: '#33241A', 'stroke-width': 0.6 }));
    g.append(svgEl('path', { d: 'M -5.8 -17.4 Q -10.4 -15.4 -9.4 -9.4 Q -7.2 -11.6 -6.4 -15.4 Z', fill: hood, stroke: '#33241A', 'stroke-width': 0.5 }));
    return;
  }
  if (kind === 'dwarfbeard') {
    // Borri: gedrongen dwerg met een imposante baard en ijzeren helmrand.
    g.append(svgEl('path', { d: 'M -6.6 -13.6 Q -7.2 -19.8 0 -20.2 Q 7.2 -19.8 6.6 -13.6 Z', fill: '#8B939A', stroke: '#4C5359', 'stroke-width': 0.7 }));
    g.append(svgEl('rect', { x: -6.8, y: -15, width: 13.6, height: 1.8, rx: 0.5, fill: '#B08A3E' }));
    g.append(svgEl('path', { d: 'M -6 -12.4 Q -6.4 -3.4 0 -2.8 Q 6.4 -3.4 6 -12.4 Q 3 -9.8 0 -9.8 Q -3 -9.8 -6 -12.4 Z', fill: hood, stroke: '#5A3418', 'stroke-width': 0.6 }));
    return;
  }
  // Basiskap — ongewijzigd t.o.v. het originele silhouet.
  g.append(svgEl('path', {
    d: 'M -6.5 -13 Q -8.5 -25 0 -25 Q 8.5 -25 6.5 -13 Q 3 -18.5 0 -18.5 Q -3 -18.5 -6.5 -13 Z',
    fill: hood, stroke: '#fff', 'stroke-width': 0.8
  }));
  g.append(svgEl('path', { d: 'M -1.6 -25 L 1.6 -25 L 0 -29.5 Z', class: 'dbc-angler-hood-trim' }));
}

// RPG-avonturier (kap, cape, gereedschap) i.p.v. het vorige platte
// visser-silhouet — de voorste arm (en het werktuig erin) wijst standaard
// naar rechts/voren; facingLeftFor spiegelt de hele groep bij het naar links
// lopen. Kap en cape blijven vaste, neutrale tinten (net als de mantel in de
// art-styleguide) zodat het "accent" de speler blijft onderscheiden via de
// tuniek, ook met meerdere spelers tegelijk in beeld.
function appendAnglerFigure(g, { accent = 'var(--accent)', skin = '#e8b98a', hood = '#2e5c4a', boots = '#3c2f22', tool = null, headgear = null, ghost = false } = {}) {
  if (ghost) g.classList.add('dbc-angler-ghost');
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
  appendHeadgear(g, headgear, { hood, accent });
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
  const { cx, cy } = hexPoints(p.x, p.y, camX, camY);
  const facingLeft = facingLeftFor(p.id, p);
  const color = OTHER_PLAYER_COLORS[colorIndex % OTHER_PLAYER_COLORS.length];
  const g = svgEl('g', {
    class: 'dbc-player dbc-player-other',
    transform: `translate(${cx},${cy}) scale(${facingLeft ? -1 : 1},1)`
  });
  appendAnglerFigure(g, { accent: color, tool: toolFor(p.fishingPhase, p.gatheringKind, p.inCombat), ...p.skinVisual });
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

// Dorpsbewoner: net als een medespeler getekend, maar niet-klikbaar (puur
// sfeer) en zonder naamlabel of activiteitsicoon.
function renderNpcMarker(svg, npc, camX, camY, viewport, you) {
  if (npc.x < camX - 1 || npc.x > camX + viewport.cols || npc.y < camY - 1 || npc.y > camY + viewport.rows) return;
  const { cx, cy } = hexPoints(npc.x, npc.y, camX, camY);
  const profile = npcProfile(npc.id);
  const g = svgEl('g', {
    class: 'dbc-player dbc-npc',
    transform: `translate(${cx},${cy}) scale(${npc.facingLeft ? -1 : 1},1)`
  });
  appendAnglerFigure(g, NPC_APPEARANCE[npc.id] || {});
  if (profile) {
    const title = svgEl('title');
    title.textContent = `${profile.name} — ${profile.title}. Tik om te praten.`;
    g.append(title);
  }
  g.onclick = () => handleNpcClick(npc, you);
  svg.append(g);
  // Naam en het statussymbool staan buiten de gespiegelde groep, anders lopen
  // ze achterstevoren mee als de NPC naar links kijkt. Het symbool verklapt
  // meteen of hier werk ligt: ❗ nieuw, ⏳ bezig, ✅ klaar om in te leveren.
  const quest = questForNpc(you, npc.id);
  const marker = svgEl('text', { x: cx, y: cy - 30, class: 'dbc-npc-marker', 'text-anchor': 'middle' });
  marker.textContent = quest ? (QUEST_STATUS_META[quest.status] || QUEST_STATUS_META.available).icon : '💬';
  svg.append(marker);
  if (profile) {
    const label = svgEl('text', { x: cx, y: cy - 21, class: 'dbc-player-label dbc-npc-label', 'text-anchor': 'middle' });
    label.textContent = profile.name;
    svg.append(label);
  }
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
    // Donkerdere "zijkant"-variant — de rotswand/graszode die zichtbaar wordt
    // onder een verhoogde tegel (zie TILE_ELEVATION), puur een getemperde
    // kopie van dezelfde tegelkleuren.
    const wall = svgEl('linearGradient', { id: `dbc-terrain-wall-${tile}`, x1: '0', y1: '0', x2: '1', y2: '1' });
    wall.append(svgEl('stop', { offset: '0%', 'stop-color': darkenColor(colors[0], 0.6) }));
    wall.append(svgEl('stop', { offset: '100%', 'stop-color': darkenColor(colors[2], 0.52) }));
    defs.append(wall);
  });
  const grad = svgEl('linearGradient', {
    id: 'dbc-atmosphere', gradientUnits: 'userSpaceOnUse',
    x1: '0', y1: bounds.minY, x2: '0', y2: bounds.minY + bounds.height
  });
  grad.append(svgEl('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': '0.12' }));
  grad.append(svgEl('stop', { offset: '55%', 'stop-color': '#fff', 'stop-opacity': '0' }));
  grad.append(svgEl('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': '0.16' }));
  defs.append(grad);

  // Volumetrische shading voor rotsvlakken (heuvels/pieken) — top-lit
  // gradient i.p.v. platte kleur, zodat de tegel meer als een echte helling
  // oogt in plaats van een silhouet.
  const hillGrad = svgEl('linearGradient', { id: 'dbc-hill-face-grad', x1: '0', y1: '0', x2: '0.3', y2: '1' });
  hillGrad.append(svgEl('stop', { offset: '0%', 'stop-color': '#AEB5AF' }));
  hillGrad.append(svgEl('stop', { offset: '100%', 'stop-color': '#656E69' }));
  defs.append(hillGrad);
  const peakGrad = svgEl('linearGradient', { id: 'dbc-peak-face-grad', x1: '0', y1: '0', x2: '0.35', y2: '1' });
  peakGrad.append(svgEl('stop', { offset: '0%', 'stop-color': '#A2A8A4' }));
  peakGrad.append(svgEl('stop', { offset: '100%', 'stop-color': '#5D6461' }));
  defs.append(peakGrad);

  // Zachte "optil"-schaduw voor reliëfdecors (bomen, heuvels, pieken): tilt
  // de vorm visueel los van zijn grondschaduw-ellips voor een sterker
  // hoogte/dieptegevoel, zonder een echte 3D-camera te gebruiken.
  const lift = svgEl('filter', { id: 'dbc-relief-lift', x: '-60%', y: '-80%', width: '220%', height: '260%' });
  lift.append(svgEl('feDropShadow', { dx: '0', dy: '1.6', stdDeviation: '1.1', 'flood-color': '#1C2B22', 'flood-opacity': '0.32' }));
  defs.append(lift);
  return defs;
}

// Kleine, chibi-achtige natuurdecors — geïnspireerd op de blokkige, ronde
// bomen/rotsen/watertegels uit klassieke top-down Pokémon-kaarten.
function appendTreeDecor(svg, cx, cy, seed) {
  const g = svgEl('g', { transform: `translate(${cx},${cy})`, class: 'dbc-tile-decor' });
  const broadleaf = (ox, oy, scale) => {
    const tg = svgEl('g', { transform: `translate(${ox},${oy}) scale(${scale})` });
    tg.append(svgEl('ellipse', { cx: 1, cy: 7, rx: 8.5, ry: 2.3, class: 'dbc-tile-tree-shadow' }));
    const relief = svgEl('g', { transform: 'translate(0,6) scale(1,1.2) translate(0,-6)', filter: 'url(#dbc-relief-lift)' });
    relief.append(svgEl('path', { d: 'M -1 6 L -1 -1 L 2 -1 L 3 6 Z', class: 'dbc-tile-tree-trunk' }));
    relief.append(svgEl('circle', { cx: -4.2, cy: -2, r: 5.7, class: 'dbc-tile-tree-leaf dbc-tree-leaf-dark' }));
    relief.append(svgEl('circle', { cx: 4, cy: -1, r: 5.8, class: 'dbc-tile-tree-leaf' }));
    relief.append(svgEl('circle', { cx: 0, cy: -7, r: 6.3, class: 'dbc-tile-tree-leaf dbc-tree-leaf-mid' }));
    relief.append(svgEl('path', { d: 'M -4 -8 Q -1 -12 3 -9 Q 0 -7 -3 -5 Z', class: 'dbc-tile-tree-highlight' }));
    tg.append(relief);
    return tg;
  };
  const conifer = (ox, oy, scale) => {
    const tg = svgEl('g', { transform: `translate(${ox},${oy}) scale(${scale})` });
    tg.append(svgEl('ellipse', { cx: 1, cy: 8, rx: 7.5, ry: 2.1, class: 'dbc-tile-tree-shadow' }));
    const relief = svgEl('g', { transform: 'translate(0,5) scale(1,1.22) translate(0,-5)', filter: 'url(#dbc-relief-lift)' });
    relief.append(svgEl('rect', { x: -1.2, y: 3, width: 2.4, height: 6, rx: 0.8, class: 'dbc-tile-tree-trunk' }));
    relief.append(svgEl('path', { d: 'M 0 -13 L -7 -2 L -4 -2 L -9 5 L 9 5 L 4 -2 L 7 -2 Z', class: 'dbc-conifer-crown' }));
    relief.append(svgEl('path', { d: 'M 0 -12 L -1 -2 L -5 4 L -8 4 L -4 -2 L -7 -2 Z', class: 'dbc-conifer-light' }));
    tg.append(relief);
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
  const relief = svgEl('g', { transform: 'translate(0,8) scale(1,1.3) translate(0,-8)', filter: 'url(#dbc-relief-lift)' });
  relief.append(svgEl('path', { d: 'M -10 6 L -7 -3 L -1 -8 L 7 -4 L 10 5 L 5 8 L -6 8 Z', class: 'dbc-tile-hill-face' }));
  relief.append(svgEl('path', { d: flip > 0 ? 'M -7 -3 L -1 -8 L 0 5 L -6 8 Z' : 'M 7 -4 L -1 -8 L 0 5 L 5 8 Z', class: 'dbc-tile-hill-light' }));
  relief.append(svgEl('path', { d: 'M -1 -8 L 7 -4 L 3 1 L 0 5 Z', class: 'dbc-tile-hill-shade' }));
  g.append(relief);
  g.append(svgEl('circle', { cx: -9, cy: 7, r: 1.6, class: 'dbc-tile-scree' }));
  g.append(svgEl('circle', { cx: 9, cy: 7, r: 1.1, class: 'dbc-tile-scree' }));
  svg.append(g);
}

function appendPeakDecor(svg, cx, cy, seed) {
  const g = svgEl('g', { transform: `translate(${cx},${cy})`, class: 'dbc-tile-decor' });
  const shoulder = seed > 0.5 ? 5 : -5;
  g.append(svgEl('ellipse', { cx: 1, cy: 8, rx: 13, ry: 3.2, class: 'dbc-tile-hill-shadow' }));
  const relief = svgEl('g', { transform: 'translate(0,8) scale(1,1.32) translate(0,-8)', filter: 'url(#dbc-relief-lift)' });
  relief.append(svgEl('polygon', { points: '-12,8 -4,-12 1,-6 5,-14 13,8', class: 'dbc-tile-peak-face' }));
  relief.append(svgEl('polygon', { points: '5,-14 13,8 4,8 1,-5', class: 'dbc-tile-peak-shadow' }));
  relief.append(svgEl('polygon', { points: '-4,-12 0,-7 -2,-5 -5,-7 -7,-5', class: 'dbc-tile-peak-snow' }));
  relief.append(svgEl('polygon', { points: '5,-14 9,-7 6,-8 4,-5 2,-8', class: 'dbc-tile-peak-snow' }));
  g.append(relief);
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

// Het Hero-monument krijgt een obelisk i.p.v. een huisje — thematisch een
// monument, geen winkel.
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

function appendTreeNode(svg, cx, cy, tree, you) {
  const status = treeStatus(tree, you);
  const g = svgEl('g', { class: `dbc-tree-node dbc-tree-${status.state}`, transform: `translate(${cx},${cy})`, 'pointer-events': 'none' });
  g.append(svgEl('image', { href: treeIconUrl(tree.setId), x: -14, y: -24, width: 28, height: 36, class: 'dbc-tree-art' }));
  appendResourceStatusMark(g, status.state);
  svg.append(g);
}

function appendResourceStatusMark(g, state) {
  const mark = svgEl('g', { class: 'dbc-tree-status-mark', transform: 'translate(-8,8) scale(0.65) translate(8,-8)' });
  mark.append(svgEl('circle', { cx: -8, cy: 8, r: 5.5 }));
  if (state === 'ready') mark.append(svgEl('path', { d: 'M-11 8l2 2 4-4' }));
  else if (state === 'locked') {
    mark.append(svgEl('rect', { x: -11, y: 7, width: 6, height: 4, rx: 1 }));
    mark.append(svgEl('path', { d: 'M-10 7V5a2 2 0 0 1 4 0v2' }));
  } else mark.append(svgEl('path', { d: 'M-11 5h6l-6 6h6Z' }));
  g.append(mark);
}

function appendTileDecor(svg, tile, cx, cy, wx, wy, worldData, you) {
  const seed = tileHash(wx, wy);
  if (tile === 'f') {
    const tree = worldData.trees?.[`${wx}:${wy}`];
    if (tree) appendTreeNode(svg, cx, cy, tree, you);
    else appendTreeDecor(svg, cx, cy, seed);
  }
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

function boatArtworkUrl(boat) {
  const tier = Math.max(1, Math.min(10, Math.round(Number(boat.tier) || 1)));
  return new URL(`./assets/boats/boat-${tier}.svg`, import.meta.url).href;
}

function appendBoatModel(svg, boat, cx, cy, { moving = false } = {}) {
  const g = svgEl('g', { class: `dbc-player-boat${moving ? ' moving' : ''}`, transform: `translate(${cx},${cy})` });
  // Boot 2x vergroot t.o.v. het origineel, verankerd op de waterlijn (y=8)
  // zodat hij nog altijd op zijn eigen tegel drijft i.p.v. te verschuiven.
  const scaled = svgEl('g', { transform: 'translate(0,8) scale(2) translate(0,-8)' });
  if (moving) {
    scaled.append(svgEl('path', { d: 'M -4 7 Q -10 13 -18 14 M 4 7 Q 10 13 18 14', class: 'dbc-boat-wake' }));
  }
  const width = 30 + Math.min(10, boat.tier || 1) * 1.4;
  const height = boat.tier <= 3 ? 22 : 34;
  scaled.append(svgEl('image', { href: boatArtworkUrl(boat), x: -width / 2, y: 8 - height, width, height, preserveAspectRatio: 'xMidYMax meet' }));
  if (boat.stations.includes('workbench')) scaled.append(svgEl('rect', { x: -8, y: -7, width: 6, height: 4, rx: 1, class: 'dbc-boat-station' }));
  if (boat.stations.includes('cookingTable')) scaled.append(svgEl('circle', { cx: 6, cy: -5, r: 2.6, class: 'dbc-boat-cook' }));
  g.append(scaled);
  svg.append(g);
}

function renderMapWrap(you, worldData, camX, camY, others = [], harbors = [], dayPhase = 'day', viewport = VIEWPORT_PRESETS.desktop, npcs = []) {
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
  const wildlifeByTile = new Map((worldData.wildlife || []).map((spot) => [`${spot.x}:${spot.y}`, spot]));
  for (let row = -1; row <= rows; row += 1) {
    for (let col = -1; col <= cols; col += 1) {
      const wx = camX + col, wy = camY + row;
      if (wx < 0 || wx >= worldData.width || wy < 0 || wy >= worldData.height) continue;
      const tile = worldData.tiles[wy * worldData.width + wx] || 'L';
      const { cx, cy } = hexPoints(wx, wy, camX, camY);
      const points = hexCorners(cx, cy, HEX_DRAW_SIZE).map(([px, py]) => `${px},${py}`).join(' ');
      const terrain = TILE_PALETTE[tile] ? tile : 'L';
      const rise = tileElevation(terrain);
      if (rise > 0) {
        // Elke tegel met reliëf tekent een donkerdere kopie van zichzelf iets
        // lager als "zijkant"; de echte tegel (hieronder, onveranderde
        // positie) dekt het bovenste deel af, zodat alleen de rand als een
        // stukje rotswand/graszode zichtbaar blijft. Latere (lagere/verdere)
        // tegels in de rastervolgorde overschilderen dit vanzelf weer waar ze
        // overlappen, dus geen aparte occlusieberekening nodig.
        const wallPoints = hexCorners(cx, cy + rise, HEX_DRAW_SIZE).map(([px, py]) => `${px},${py}`).join(' ');
        svg.append(svgEl('polygon', {
          points: wallPoints, fill: `url(#dbc-terrain-wall-${terrain})`,
          class: 'dbc-tile-wall', 'pointer-events': 'none'
        }));
      }
      const hex = svgEl('polygon', { points, fill: `url(#dbc-terrain-${terrain})`, class: `dbc-tile dbc-tile-${terrain}` });
      const tree = worldData.trees?.[`${wx}:${wy}`];
      if (tree) {
        const description = treeStatus(tree, you).description;
        const title = svgEl('title');
        title.textContent = description;
        hex.append(title);
        hex.setAttribute('aria-label', description);
      }
      const animal = wildlifeByTile.get(`${wx}:${wy}`);
      if (animal) {
        const description = wildlifeStatus(animal, you, dayPhase).description;
        const title = svgEl('title');
        title.textContent = description;
        hex.append(title);
        hex.setAttribute('aria-label', description);
      }
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
  decorQueue.forEach(({ tile, cx, cy, wx, wy }) => appendTileDecor(svg, tile, cx, cy, wx, wy, worldData, you));

  // Decoratieve bootjes in de Haven — puur sfeer, de bootupgrade zelf koop je
  // op de Handelsmarkt en werkt overal op de kaart.
  (worldData.boats || []).forEach((boat) => {
    if (boat.x < camX - 1 || boat.x > camX + cols || boat.y < camY - 1 || boat.y > camY + rows) return;
    const { cx, cy } = hexPoints(boat.x, boat.y, camX, camY);
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
    const { cx, cy } = hexPoints(building.x, building.y, camX, camY);
    appendBuildingArt(svg, cx, cy, { type: building.type });
  });

  // Door spelers gebouwde aanlegsteigers — dynamisch (per sessie), niet
  // onderdeel van de vaste wereld, maar visueel dezelfde dok-illustratie.
  harbors.forEach((harbor) => {
    if (harbor.x < camX || harbor.x >= camX + cols || harbor.y < camY || harbor.y >= camY + rows) return;
    const occupied = (you.x === harbor.x && you.y === harbor.y) || others.some((other) => other.x === harbor.x && other.y === harbor.y);
    if (occupied) return;
    const { cx, cy } = hexPoints(harbor.x, harbor.y, camX, camY);
    appendBuildingArt(svg, cx, cy, { type: 'harbor' });
  });

  // Wilde dieren: klein icoontje met slagschaduw op hun vaste graslandplek,
  // aanklikbaar zoals een boom (hout) of rots (steen) — start een
  // dobbelgevecht i.p.v. een gewone stap.
  (worldData.wildlife || []).forEach((spot) => {
    if (spot.x < camX || spot.x >= camX + cols || spot.y < camY || spot.y >= camY + rows) return;
    const occupied = (you.x === spot.x && you.y === spot.y) || others.some((other) => other.x === spot.x && other.y === spot.y);
    if (occupied) return;
    const { cx, cy } = hexPoints(spot.x, spot.y, camX, camY);
    const status = wildlifeStatus(spot, you, dayPhase);
    const g = svgEl('g', { class: `dbc-wildlife-node dbc-tree-${status.state}`, transform: `translate(${cx},${cy})`, 'pointer-events': 'none' });
    g.append(svgEl('image', { href: wildlifeIconUrl(spot.setId || 'kleinwild'), x: -13, y: -20, width: 26, height: 32, class: 'dbc-tree-art' }));
    appendResourceStatusMark(g, status.state);
    svg.append(g);
  });

  others.forEach((other, index) => renderOtherPlayerMarker(svg, other, camX, camY, index, viewport));
  npcs.forEach((npc) => renderNpcMarker(svg, npc, camX, camY, viewport, you));

  if (you.mode === 'land' && Number.isFinite(you.boat.x) && Number.isFinite(you.boat.y)
    && you.boat.x >= camX - 1 && you.boat.x <= camX + cols && you.boat.y >= camY - 1 && you.boat.y <= camY + rows) {
    const docked = hexPoints(you.boat.x, you.boat.y, camX, camY);
    appendBoatModel(svg, you.boat, docked.cx, docked.cy);
  }

  const { cx: px, cy: py } = hexPoints(you.x, you.y, camX, camY);
  if (you.mode === 'sea') {
    appendBoatModel(svg, you.boat, px, py, { moving: Boolean(you.path.length) });
  } else {
    const facingLeft = facingLeftFor(you.id, you);
    const player = svgEl('g', {
      class: 'dbc-player',
      transform: `translate(${px},${py}) scale(${facingLeft ? -1 : 1},1)`
    });
    appendAnglerFigure(player, { tool: toolFor(you.fishing, you.gathering?.kind, Boolean(you.combat)), ...you.skinVisual });
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
  boat.append(svgEl('image', { href: boatArtworkUrl(you.boat), x: 0, y: 0, width: 96, height: 56, preserveAspectRatio: 'xMidYMid meet' }));
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
  if (Array.isArray(you.toolUpgrades) && you.toolUpgrades.length) return you.toolUpgrades.filter((tool) => TOOL_FALLBACK_META.some((meta) => meta.key === tool.key));
  return TOOL_FALLBACK_META.map((tool) => ({
    ...tool,
    level: Number(you.gear?.[tool.key]) || 0,
    maxLevel: 9,
    current: { name: tool.label, benefit: 'Herstart de Pluto-server om de upgradevereisten te laden.' },
    next: null,
    serverRestartRequired: true
  }));
}

function renderToolUpgrades(you) {
  const section = E('section', 'dbc-tool-section');
  section.append(E('h5', '', 'Gereedschappen'));
  const tools = visibleToolUpgrades(you).filter((tool) => tool.key !== 'boat');
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
    appendUpgradeDetails(card, tool, you);
    grid.append(card);
  });
  section.append(grid);
  return section;
}

function appendUpgradeDetails(card, tool, you) {
    const title = tool.serverRestartRequired
      ? tool.current.name
      : tool.next ? `${tool.current.name} → ${tool.next.name}` : `${tool.current.name} · voltooid`;
    card.append(E('h5', '', `${tool.icon} ${title}`));
    card.append(E('div', 'dbc-tool-level', `Niveau ${tool.level + 1}/${tool.maxLevel + 1}`));
    card.append(E('p', 'dbc-panel-copy', tool.next?.benefit || tool.current.benefit));
    if (tool.unlockSets?.length) card.append(E('p', 'dbc-panel-copy', `Ontgrendelt: ${tool.unlockSets.join(', ')}.`));
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
}

function renderBoatBasePanel(you) {
  const wrap = E('div', 'dbc-panel dbc-boat-base');
  wrap.append(E('h4', '', `⛵ Bootbasis · ${you.boat.name} ${you.boat.tier}`));
  wrap.append(E('p', 'dbc-panel-copy', `Romp ${you.boat.hp}/${you.boat.maxHp} · ${you.mode === 'sea' ? 'op zee' : 'aangemeerd'} · ${you.boat.baseSlots} basisslots`));

  const diagram = E('div', 'dbc-boat-diagram');
  const artwork = E('img', 'dbc-boat-illustration');
  artwork.src = boatArtworkUrl(you.boat);
  artwork.alt = `${you.boat.name}, niveau ${you.boat.tier}`;
  diagram.append(artwork);
  const slots = E('div', 'dbc-boat-slots');
  for (let index = 0; index < you.boat.baseSlots; index += 1) {
    const stationId = you.boat.stations[index];
    const station = (you.boatStations || []).find((entry) => entry.id === stationId);
    slots.append(E('div', `dbc-boat-slot${station ? ' filled' : ''}`, station ? `${station.icon} ${station.name}` : `Vrij slot ${index + 1}`));
  }
  diagram.append(slots);
  wrap.append(diagram);
  const boatUpgrade = visibleToolUpgrades(you).find((tool) => tool.key === 'boat');
  if (boatUpgrade) {
    const card = E('div', 'dbc-upgrade-card dbc-boat-upgrade');
    appendUpgradeDetails(card, boatUpgrade, you);
    wrap.append(card);
  }

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
  if (activePanel === 'inventaris') return renderInventarisPanel(you, others, harbors);
  if (activePanel === 'monument') return renderMonumentPanel(you);
  if (activePanel === 'world-map') return renderMapPanel(you);
  if (activePanel === 'npc') return renderNpcPanel(you);
  return E('div', 'dbc-hint', 'Tik op de kaart om te wandelen, op water vlak naast je om te vissen, op een boom/rots vlak naast je om te hakken/houwen, of op een dier om te jagen.');
}

function questForNpc(you, npcId) {
  return (you.quests || []).find((quest) => quest.npcId === npcId) || null;
}

const QUEST_STATUS_META = {
  available: { icon: '❗', label: 'Nieuw' },
  active: { icon: '⏳', label: 'Bezig' },
  ready: { icon: '✅', label: 'Klaar om in te leveren' },
  done: { icon: '🏅', label: 'Afgerond' }
};

// Concrete beloning naast de verhalende tekst, zodat je weet wat je krijgt.
function rewardSummary(quest) {
  const parts = [];
  if (quest.rewards?.cash) parts.push(`€${quest.rewards.cash}`);
  Object.entries(quest.rewards?.xp || {}).forEach(([skill, amount]) => {
    parts.push(`+${amount} ${SKILL_LABELS[skill]?.label || skill}-xp`);
  });
  return parts.join(' · ');
}

function renderQuestGoals(quest) {
  const list = E('div', 'dbc-quest-goals');
  quest.goals.forEach((goal) => {
    const row = E('div', 'dbc-quest-goal');
    const done = goal.value >= goal.target;
    row.append(E('span', `dbc-quest-goal-check${done ? ' met' : ''}`, done ? '✔' : '•'));
    row.append(E('span', 'dbc-quest-goal-label', goal.label));
    const track = E('div', 'dbc-timer-track dbc-quest-track');
    const fill = E('div', 'dbc-timer-fill dbc-quest-fill');
    fill.style.width = `${Math.min(100, Math.round((goal.value / goal.target) * 100))}%`;
    track.append(fill);
    row.append(track);
    row.append(E('span', 'dbc-quest-goal-count', `${Math.min(goal.value, goal.target)}/${goal.target}`));
    list.append(row);
  });
  return list;
}

// Gesprek met een dorpsbewoner: portret, karaktertekst en zijn opdracht —
// aannemen, voortgang volgen en inleveren gebeurt hier.
function renderNpcPanel(you) {
  const wrap = E('div', 'dbc-panel dbc-v6-panel dbc-npc-panel');
  const profile = npcProfile(activeNpcId);
  if (!profile) {
    wrap.append(renderV6PanelTitle('💬', 'Gesprek'));
    wrap.append(E('p', 'dbc-panel-copy', 'Deze dorpsbewoner is niet meer in de buurt.'));
    return wrap;
  }
  wrap.append(renderV6PanelTitle('', profile.name));
  wrap.append(E('p', 'dbc-panel-copy', profile.title));

  const talk = E('div', 'dbc-npc-talk');
  talk.append(renderSkinAvatar(NPC_APPEARANCE[profile.id], 78));
  talk.append(E('p', 'dbc-npc-quote', `“${profile.dialogue}”`));
  wrap.append(talk);

  const quest = questForNpc(you, profile.id);
  if (quest) {
    const meta = QUEST_STATUS_META[quest.status] || QUEST_STATUS_META.available;
    const card = E('div', `dbc-npc-quest dbc-quest-${quest.status}`);
    const head = E('div', 'dbc-npc-quest-head');
    head.append(E('div', 'dbc-gear-title', quest.title));
    head.append(E('span', 'dbc-npc-quest-type', `${meta.icon} ${meta.label}`));
    card.append(head);
    card.append(E('p', 'dbc-gear-help', quest.context));
    const rows = E('dl', 'dbc-npc-quest-rows');
    rows.append(E('dt', '', 'Doel'), E('dd', '', quest.objective));
    rows.append(E('dt', '', 'Beloning'), E('dd', '', `${quest.reward} (${rewardSummary(quest)})`));
    card.append(rows);

    if (quest.status !== 'available') card.append(renderQuestGoals(quest));

    if (quest.status === 'available') {
      const accept = E('button', 'primary', 'Opdracht aannemen');
      accept.onclick = () => action('questAccept', { id: quest.id });
      card.append(accept);
    } else if (quest.status === 'ready') {
      const hand = E('button', 'primary', 'Inleveren');
      hand.onclick = () => action('questComplete', { id: quest.id });
      card.append(hand);
    } else if (quest.status === 'done') {
      card.append(E('p', 'dbc-gear-help', 'Deze opdracht heb je al voor hem afgerond.'));
    }
    wrap.append(card);
  }
  return wrap;
}

function renderMapPanel(you) {
  const wrap = E('div', 'dbc-panel dbc-v6-panel dbc-world-map-panel');
  wrap.append(renderV6PanelTitle(uiIconImg('map', 'dbc-title-art'), 'Grote map'));
  wrap.append(E('p', 'dbc-panel-copy', 'Het vertrouwde eiland ligt midden in een uitgestrekte archipel. Verken de eilandring, de noordelijke eilandjes en de verre zuidkusten. Je positie staat in het rood.'));

  if (!world) {
    wrap.append(E('p', 'dbc-empty', 'Kaart wordt geladen...'));
    return wrap;
  }

  if (!minimapBase || minimapWorldRef !== world) buildMinimapBase(world);
  const canvas = document.createElement('canvas');
  canvas.className = 'dbc-world-map';
  canvas.width = world.width;
  canvas.height = world.height;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Wereldkaart van ${world.width} bij ${world.height} tegels. Je positie: ${you.x}, ${you.y}.`);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(minimapBase, 0, 0);
  ctx.strokeStyle = 'rgba(237,241,234,0.18)';
  ctx.lineWidth = 0.2;
  for (let i = 1; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * world.width / 5, 0);
    ctx.lineTo(i * world.width / 5, world.height);
    ctx.moveTo(0, i * world.height / 5);
    ctx.lineTo(world.width, i * world.height / 5);
    ctx.stroke();
  }
  ctx.fillStyle = '#F6F2E7';
  ctx.beginPath();
  ctx.arc(you.x + 0.5, you.y + 0.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#A34433';
  ctx.beginPath();
  ctx.arc(you.x + 0.5, you.y + 0.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  const frame = E('div', 'dbc-world-map-frame');
  frame.append(canvas);
  wrap.append(frame);
  return wrap;
}

// `icon` mag een emoji zijn of een klaargezet <img> (zie uiIconImg) voor de
// geïllustreerde ronde iconen.
function renderV6PanelTitle(icon, label, className = '') {
  const title = E('h4', `dbc-v6-title${className ? ` ${className}` : ''}`);
  const iconWrap = E('span', 'dbc-v6-title-icon');
  if (icon instanceof Node) iconWrap.append(icon); else iconWrap.textContent = icon;
  title.append(iconWrap, E('span', '', label));
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

// Mijn uitrusting: per categorie de eigen items als aan/uit-knoppen (actief
// item gemarkeerd), met een slijtagebalk en een Herstellen-knop zodra een
// stuk niet meer volledig intact is. Kopen gebeurt bij Te koop.
function renderEquipSection(you) {
  const wrap = E('div', 'dbc-equip-section');
  Object.keys(GEAR_CATEGORY_META).forEach((category) => {
    const meta = GEAR_CATEGORY_META[category];
    const slot = you.gearShop[category];
    const card = E('div', 'dbc-gear-card');
    card.append(E('div', 'dbc-gear-title', `${meta.icon} ${meta.label}`));
    if (!slot.owned.length) {
      card.append(E('p', 'dbc-gear-help', 'Nog niets gekocht — bekijk Te koop.'));
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
  { id: 'bouwen', icon: '🔨', label: 'Bouwen & Handelen' }
];

let uitrustingTab = 'mijn';
const UITRUSTING_TABS = [
  { id: 'mijn', icon: '⭐', label: 'Mijn uitrusting' },
  { id: 'te-koop', icon: '🛒', label: 'Te koop' }
];

// Uitrusting combineert wat je al bezit ("Mijn uitrusting": kleding, wapens
// en schilden om uit te rusten) met de winkel ("Te koop": drankjes, skins en
// de volledige kledingcatalogus) — voorheen respectievelijk in Inventaris en
// Marktplaats.
function renderUitrustingSection(you) {
  const wrap = E('div', 'dbc-uitrusting-section');
  wrap.append(renderSubtabs(UITRUSTING_TABS, uitrustingTab, (id) => { uitrustingTab = id; renderGame(state.room); }));
  if (uitrustingTab === 'mijn') wrap.append(renderEquipSection(you));
  else wrap.append(renderShopSection(you));
  return wrap;
}

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

// Bouwen & Handelen combineert de aanlegsteiger met ruilen tussen spelers —
// voorheen respectievelijk in Inventaris en Marktplaats.
function renderBouwenHandelenSection(you, others, harbors) {
  const wrap = E('div', 'dbc-panel');
  wrap.append(renderBouwenSection(you, harbors));
  wrap.append(E('h5', '', '🤝 Handelen'));
  wrap.append(renderRuilenBody(you, others));
  return wrap;
}

function renderInventarisPanel(you, others, harbors) {
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
  wrap.append(E('p', 'dbc-panel-copy', 'Al je bezittingen, je setvoortgang, uitrusting en handel op één plek.'));
  wrap.append(renderSubtabs(INVENTARIS_TABS, inventarisTab, (id) => { inventarisTab = id; renderGame(state.room); }));

  if (inventarisTab === 'bezit') {
    wrap.append(renderInventory(you, 'fish'));
    wrap.append(renderInventory(you, 'wood'));
    wrap.append(renderInventory(you, 'rock'));
    wrap.append(renderInventory(you, 'meat', { mode: 'eat' }));
  } else if (inventarisTab === 'sets') {
    wrap.append(renderSets(you, 'fish'));
    wrap.append(renderSets(you, 'wood'));
    wrap.append(renderSets(you, 'rock'));
    wrap.append(renderSets(you, 'meat'));
  } else if (inventarisTab === 'uitrusting') {
    wrap.append(renderUitrustingSection(you));
  } else if (inventarisTab === 'bouwen') {
    wrap.append(renderBouwenHandelenSection(you, others, harbors));
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
function renderSkinShop(you) {
  const wrap = E('div', 'dbc-gear-grid');
  (you.skinShop || []).forEach((item) => {
    const owned = (you.skinsOwned || []).includes(item.id);
    const card = E('div', 'dbc-gear-card');
    card.append(renderSkinAvatar(item));
    card.append(E('div', 'dbc-gear-title', `${item.icon} ${item.name}`));
    card.append(E('p', 'dbc-gear-help', item.description));
    const button = E('button', 'secondary', owned ? 'In bezit' : `Kopen (€${item.price})`);
    button.disabled = owned || you.cash < item.price;
    button.onclick = () => action('buySkin', { id: item.id });
    card.append(button);
    wrap.append(card);
  });
  return wrap;
}

function renderShopSection(you) {
  const wrap = E('div', 'dbc-shop-section');
  wrap.append(E('h5', '', '⚡ Drankjes'));
  wrap.append(renderConsumableShop(you));
  wrap.append(E('h5', '', '🧑‍🎤 Skins'));
  wrap.append(renderSkinShop(you));
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


// Vaardigheden-tabel op de Hero-pagina, boven de ranglijst: vijf kolommen
// (naam, niveau, verduidelijking, progressiebalk, xp) i.p.v. de vroegere
// aparte kaarten-grid, zodat alle zes vaardigheden compact naast elkaar
// vergelijkbaar zijn.
function renderSkillsTable(you) {
  const wrap = E('div', 'dbc-skills-table-wrap');
  const table = E('table', 'dbc-skills-table');
  const head = E('tr');
  ['Vaardigheid', 'Niveau', 'Verduidelijking', 'Voortgang', 'Xp'].forEach((label) => head.append(E('th', '', label)));
  table.append(head);
  Object.keys(SKILL_LABELS).forEach((key) => {
    const info = SKILL_LABELS[key];
    const skill = you.skills[key];
    const row = E('tr', `dbc-skill-row dbc-skill-${key}`);
    row.append(E('td', 'dbc-skill-name', `${info.icon} ${info.label}`));
    row.append(E('td', 'dbc-skill-level', `${skill.level}/99`));
    row.append(E('td', 'dbc-skill-help', info.help));
    const progressCell = E('td', 'dbc-skill-progress-cell');
    const track = E('div', 'dbc-timer-track dbc-skill-track');
    const fill = E('div', 'dbc-timer-fill dbc-skill-fill');
    fill.style.width = `${skill.maxed ? 100 : Math.round((skill.xpIntoLevel / skill.xpForNextLevel) * 100)}%`;
    track.append(fill);
    progressCell.append(track);
    row.append(progressCell);
    row.append(E('td', 'dbc-skill-xp', skill.maxed ? `${skill.xp} xp · max` : `${skill.xpIntoLevel}/${skill.xpForNextLevel} xp`));
    table.append(row);
  });
  wrap.append(table);
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

// Kleine SVG-preview van de anglerrig met een skin-kleurenpalet erop — zowel
// in de Winkel (koopkaart) als op de Hero-pagina (huidige/eigen skins).
function renderSkinAvatar(palette, size = 48) {
  const svg = svgEl('svg', { viewBox: '-20 -34 40 50', width: size, height: Math.round(size * 1.25), class: 'dbc-skin-avatar' });
  const g = svgEl('g', { transform: 'translate(0,3)' });
  appendAnglerFigure(g, palette || {});
  svg.append(g);
  return svg;
}

function renderMonumentPanel(you) {
  const wrap = E('div', 'dbc-panel dbc-v6-panel dbc-monument-panel');
  wrap.append(renderV6PanelTitle(uiIconImg('hero', 'dbc-title-art'), 'Hero'));

  const currentSkin = (you.skinShop || []).find((s) => s.id === you.skin);
  const hero = E('div', 'dbc-hero-card');
  hero.append(renderSkinAvatar(you.skinVisual, 64));
  const heroInfo = E('div', 'dbc-hero-info');
  heroInfo.append(E('div', 'dbc-gear-title', currentSkin ? `${currentSkin.icon} ${currentSkin.name}` : '🎣 Basis'));
  const statsRow = E('div', 'dbc-hero-stats');
  statsRow.append(E('span', '', `💰 €${you.cash}`));
  statsRow.append(E('span', '', `📖 ${you.discovered.length} soorten`));
  statsRow.append(E('span', '', `⭐ Totaalniveau ${you.totalLevel}`));
  heroInfo.append(statsRow);
  hero.append(heroInfo);
  wrap.append(hero);

  const owned = ['default', ...(you.skinsOwned || []).filter((id) => id !== 'default')];
  if (owned.length > 1) {
    wrap.append(E('h5', '', '🧑‍🎤 Jouw skins'));
    const grid = E('div', 'dbc-gear-grid');
    owned.forEach((id) => {
      const item = id === 'default' ? { id: 'default', name: 'Basis', icon: '🎣' } : you.skinShop.find((s) => s.id === id);
      if (!item) return;
      const isEquipped = you.skin === id;
      const card = E('div', 'dbc-gear-card');
      card.append(renderSkinAvatar(id === 'default' ? null : item));
      card.append(E('div', 'dbc-gear-title', `${item.icon} ${item.name}`));
      const btn = E('button', `dbc-subtab-btn${isEquipped ? ' active' : ''}`, isEquipped ? 'Actief' : 'Dragen');
      btn.type = 'button';
      btn.disabled = isEquipped;
      btn.onclick = () => action('equipSkin', { id });
      card.append(btn);
      grid.append(card);
    });
    wrap.append(grid);
  }

  const running = (you.quests || []).filter((quest) => quest.status !== 'available');
  wrap.append(E('h5', '', `📜 Opdrachten · ${running.filter((q) => q.status === 'done').length}/${(you.quests || []).length} afgerond`));
  if (!running.length) {
    wrap.append(E('p', 'dbc-panel-copy', 'Nog geen opdrachten aangenomen. Loop naar een dorpsbewoner met een ❗ boven zijn hoofd en praat met hem.'));
  } else {
    const list = E('div', 'dbc-quest-list');
    running.forEach((quest) => {
      const meta = QUEST_STATUS_META[quest.status] || QUEST_STATUS_META.active;
      const card = E('div', `dbc-quest-card dbc-quest-${quest.status}`);
      const head = E('div', 'dbc-npc-quest-head');
      head.append(E('div', 'dbc-gear-title', quest.title));
      head.append(E('span', 'dbc-npc-quest-type', `${meta.icon} ${meta.label}`));
      card.append(head);
      card.append(E('p', 'dbc-gear-help', `${quest.npcName} · ${quest.objective}`));
      if (quest.status !== 'done') card.append(renderQuestGoals(quest));
      list.append(card);
    });
    wrap.append(list);
  }

  wrap.append(E('h5', '', `⭐ Vaardigheden · totaalniveau ${you.totalLevel}`));
  wrap.append(E('p', 'dbc-panel-copy', 'Elke vangst, kap, delving, jacht, nieuwe ontdekking en ruil levert xp op. Niveau 1 tot en met 99 per vaardigheid.'));
  wrap.append(renderSkillsTable(you));

  wrap.append(E('h5', '', '🏆 Ranglijst'));
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
  ['#', 'Speler', 'Geld', 'Soorten', 'Total level'].forEach((label) => head.append(E('th', '', label)));
  table.append(head);
  leaderboardData.forEach((row, index) => {
    const tr = E('tr');
    tr.append(E('td', '', String(index + 1)));
    tr.append(E('td', '', row.username));
    tr.append(E('td', '', `€${row.cash}`));
    tr.append(E('td', '', String(row.discovered)));
    tr.append(E('td', '', String(row.totalLevel)));
    table.append(tr);
  });
  wrap.append(table);
  return wrap;
}

function renderSets(you, kind = 'fish') {
  const sets = kind === 'fish' ? you.sets : kind === 'wood' ? you.woodSets : kind === 'rock' ? you.rockSets : you.meatSets;
  const entriesKey = kind === 'fish' ? 'fish' : 'items';
  const wrap = E('div', 'dbc-sets');
  if (kind === 'wood') wrap.append(E('p', 'dbc-panel-copy', 'Op de kaart toont het boompictogram de houtset. Vinkje = kapbaar; slot = bijl of Kappen te laag; zandloper = herstelt. De vereiste niveaus staan hieronder bij de sets.'));
  if (kind === 'meat') wrap.append(E('p', 'dbc-panel-copy', 'Het dierpictogram toont de set: kleinwild, grofwild of nachtdieren. Een klein vinkje betekent bejaagbaar; een slotje betekent nu niet beschikbaar. Nachtdieren zijn alleen in het donker actief.'));
  const grid = E('div', 'dbc-set-grid');
  sets.forEach((set) => {
    const card = E('div', 'dbc-set-card');
    const titleText = `${set.icon} ${set.name} (${set.caught}/${set.total})${set.bonusActive ? ' · +15% ✔' : ''}`;
    const title = E('div', 'dbc-set-title', titleText);
    if (kind === 'wood' || kind === 'meat') {
      title.textContent = '';
      const icon = E('img', 'dbc-tree-set-icon');
      icon.src = kind === 'wood' ? treeIconUrl(set.id) : wildlifeIconUrl(set.id);
      icon.alt = set.name;
      title.append(icon, E('span', '', `${set.name} (${set.caught}/${set.total})${set.bonusActive ? ' · +15% ✔' : ''}`));
      title.classList.add('dbc-tree-set-title');
    }
    card.append(title);
    if (set.requiredToolLevel) {
      card.append(E('p', 'dbc-set-reward', `${set.unlocked ? 'Beschikbaar' : 'Vergrendeld'} · ${set.toolLabel} niveau ${set.requiredToolLevel} vereist (jij: ${set.toolLevel})`));
    }
    if (!set.bonusActive && set.rewardGearLabel) {
      card.append(E('p', 'dbc-set-reward', `Beloning bij voltooien: gratis ${set.rewardGearLabel}-upgrade`));
    }
    const row = E('div', 'dbc-set-fish');
    set[entriesKey].forEach((entry) => {
      const chip = E('span', `dbc-fish-chip ${entry.discovered ? 'discovered' : 'unknown'}`,
        entry.discovered ? `${entry.icon} ${entry.name}` : '???');
      if (entry.requiredToolLevel) {
        const requirement = `${set.toolLabel} niveau ${entry.requiredToolLevel}${entry.requiredSkillLevel ? ` · Kappen ${entry.requiredSkillLevel}` : ''}`;
        chip.title = requirement;
        if (entry.requiredToolLevel > set.toolLevel || (kind === 'wood' && (you.skills?.woodcutting?.level || 1) < entry.requiredSkillLevel)) {
          chip.classList.add('locked');
          if (!entry.discovered) chip.textContent = `🔒 Niv. ${entry.requiredToolLevel}`;
        }
      }
      row.append(chip);
    });
    card.append(row);
    if (kind === 'wood' && set.items.some((item) => item.requiredSkillLevel > 1)) {
      const extra = set.items.filter((item) => item.requiredSkillLevel > 1).map((item) => `${item.name}: Bijl ${item.requiredToolLevel} en Kappen ${item.requiredSkillLevel}`);
      card.append(E('p', 'dbc-set-reward', extra.join(' · ')));
    }
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

// `mode` bepaalt de extra's per rij: 'sell' (standaard: vis/hout/steen) toont
// selectie + verkoopknoppen, 'eat' (vlees) toont daarnaast ook kwaliteit en
// Roosteren/Eet — verkopen blijft ook bij vlees altijd mogelijk, want
// Bezittingen combineert nu bekijken én verkopen op één plek.
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

  const actionsRow = E('div', 'dbc-inventory-actions');
  const sellSelected = E('button', 'primary', `Verkoop geselecteerde (${selectedUids.size})`);
  sellSelected.disabled = !selectedUids.size;
  sellSelected.onclick = () => { action('sell', { kind, uids: [...selectedUids] }); selectedUids.clear(); };
  const sellAll = E('button', 'secondary', 'Verkoop alles');
  sellAll.onclick = () => { action('sell', { kind, uid: 'all' }); selectedUids.clear(); };
  actionsRow.append(sellSelected, sellAll);
  if (mode === 'eat') {
    const eatAll = E('button', 'secondary', 'Eet alles op');
    eatAll.onclick = () => action('eat', { uid: 'all' });
    actionsRow.append(eatAll);
  }
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
    }
    row.append(E('span', 'dbc-inventory-price', `€${item.price}`));
    const sellButton = E('button', 'secondary', 'Verkoop');
    sellButton.onclick = () => { action('sell', { kind, uid: item.uid }); selectedUids.delete(item.uid); };
    row.append(sellButton);
    listWrap.append(row);
  });
  wrap.append(listWrap);
  if (mode === 'eat') wrap.append(renderCookSection(you));
  return wrap;
}
