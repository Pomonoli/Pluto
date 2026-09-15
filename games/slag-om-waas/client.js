/**
 * Total Waas — browserrenderer (Fase 1: het bord).
 *
 * Het bord komt volledig uit `game.board` (statisch) en `game.sectors`
 * (dynamisch). De client kent geen spelregels; hij tekent, selecteert en
 * toont alleen de acties die de server als geldig markeert.
 *
 * Visuele opbouw (zie STYLE.md): houten lijst → 2.5D borddikte → per regio
 * een biome-groep met polygonen, patronen en gloeiende factiegrenzen →
 * rivieren en wegen → highlights → labels en vector-iconen → hit-laag.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const KIND_ICON = { land: '🚶', road: '🛣️', bridge: '🌉', water: '⛵' };
const KIND_LABEL = { land: 'Landgrens', road: 'Hoofdweg', bridge: 'Brug over de Moervaart', water: 'Waterroute' };
const EXTERNAL_POWERS = [
  { label: 'Nederland', x: 500, y: -22, anchor: 'middle' },
  { label: 'Antwerpen', x: 1034, y: 500, anchor: 'middle', rotate: 90 },
  { label: 'Bornem · Klein-Brabant', x: 500, y: 1034, anchor: 'middle' },
  { label: 'Gent', x: -34, y: 500, anchor: 'middle', rotate: -90 }
];
// Biome-palet per regio: licht voor open terrein, donker voor dicht/nat/bebouwd terrein.
const BIOMES = {
  north: { light: '#d4e6f1', dark: '#85c1e9', pattern: 'winter', dense: ['forest'] },
  west: { light: '#f8c471', dark: '#e59866', pattern: 'zand', dense: ['desert'] },
  east: { light: '#58d68d', dark: '#28b463', pattern: 'polder', dense: ['urban'] },
  south: { light: '#5dade2', dark: '#2e86c1', pattern: 'water', dense: ['water'] },
  center: { light: '#a6acaf', dark: '#7f8c8d', pattern: 'vesting', dense: ['urban'] }
};
// Vector-iconen op sleutelprovincies (id → icoontype).
const POI_ICONS = {
  center_sint_niklaas: 'castle', west_lokeren: 'tower', south_temse: 'harbour', east_doel: 'harbour',
  north_stekene: 'trees', north_sint_pauwels: 'trees', north_stropersbos: 'trees', center_sinaai: 'trees',
  east_beveren: 'windmill', east_kieldrecht: 'windmill', south_steendorp: 'harbour', east_zwijndrecht: 'harbour'
};
const BOATS = [[992, 300], [1004, 610], [930, 880], [700, 990], [470, 1000]];
// Decoratieve rivierloop langs de westkant van Lokerzand; spelverbindingen blijven in board.js.
const DURME_PATH = [[38, 500], [66, 519], [62, 548], [83, 576], [72, 610], [91, 644], [72, 680], [53, 706], [28, 740]];
const LOBBY_FACTIONS = [
  { id: 'south', name: 'Zuid', title: 'Temsewater & Durmeland', emblem: '🌊', color: '#22b8dd', terrain: 'Water en moeras' },
  { id: 'west', name: 'West', title: 'Lokerzand & Moerbeekvlakte', emblem: '☀', color: '#f0a12e', terrain: 'Zand en open vlaktes' },
  { id: 'north', name: 'Noord', title: 'Stekenwoud & Gillsmark', emblem: '❄', color: '#2f6fd6', terrain: 'Bos en wintergrond' },
  { id: 'east', name: 'Oost', title: 'Beverpolders & Scheldeland', emblem: '🌾', color: '#7cbf2a', terrain: 'Polders en landbouw' }
];

export function renderLobbyOptions({ room, container, E, socket, handleAck }) {
  const me = room.players.find(player => player.isMe);
  if (!me) return;
  const selected = room.gameOptions?.factions?.[me.id] || null;
  const selections = room.gameOptions?.factions || {};
  const wrap = E('section', 'sow-faction-picker');
  const head = E('div', 'sow-faction-picker-head');
  head.append(E('strong', '', 'Kies jouw factie'), E('small', '', 'Iedere speler kiest zelf. Niet gekozen facties worden bij de start automatisch verdeeld.'));
  const choices = E('div', 'sow-faction-choices');
  for (const faction of LOBBY_FACTIONS) {
    const owner = room.players.find(player => player.id !== me.id && selections[player.id] === faction.id);
    const button = E('button', `sow-faction-choice${selected === faction.id ? ' active' : ''}`);
    button.type = 'button'; button.disabled = Boolean(owner);
    button.style.setProperty('--faction', faction.color);
    button.setAttribute('aria-pressed', selected === faction.id ? 'true' : 'false');
    button.append(E('span', 'sow-faction-choice-emblem', faction.emblem), E('strong', '', faction.name), E('span', '', faction.title), E('small', '', owner ? `Gekozen door ${owner.name}` : faction.terrain));
    button.onclick = () => socket.emit('room:setPlayerOptions', { faction: faction.id }, handleAck);
    choices.append(button);
  }
  wrap.append(head, choices);
  const picked = room.players.filter(player => selections[player.id]);
  if (picked.length) wrap.append(E('small', 'sow-faction-picked', picked.map(player => `${player.name}: ${LOBBY_FACTIONS.find(f => f.id === selections[player.id])?.name}`).join(' · ')));
  container.append(wrap);
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
function points(polygon) { return polygon.map((p) => `${p[0]},${p[1]}`).join(' '); }
function near(a, b) { return Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5; }
function hexAlpha(hex, alpha) {
  const v = hex.replace('#', '');
  return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${alpha})`;
}
// Catmull-Rom → cubic bezier, voor vloeiende rivieren.
function smoothPath(pts, closed = false) {
  if (pts.length < 2) return '';
  const p = (i) => pts[closed ? (i + pts.length) % pts.length : Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M${pts[0][0]},${pts[0][1]}`;
  const last = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < last; i += 1) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return closed ? `${d} Z` : d;
}

export function render(api) {
  const { game, state, els, E, action, titlebar, logBox } = api;
  const s = state.sow || (state.sow = { selected: null });
  const you = game.players.find((p) => p.isYou) || null;
  const turn = game.players.find((p) => p.id === game.turnPlayerId) || null;
  const factions = game.board.factions;
  if (!game.config?.taxPolicies || !game.config?.units) {
    els.gameStage.append(titlebar('Total Waas', 'Serverupdate nodig'));
    els.gameStage.append(E('p', '', 'De server draait nog de oude bordversie. Herstart de Pluto-server om belastingen, troepen en verplaatsingen te activeren; herlaad daarna deze pagina.'));
    return;
  }
  const byId = new Map(game.board.sectors.map((sector) => [sector.id, sector]));
  if (s.selected && !byId.has(s.selected)) s.selected = null;
  if (!s.popupOpen && !s.moving) s.selected = null;
  if (s.moving && (game.battle || !game.canEndTurn || game.sectors[s.moving]?.controller !== you?.faction || !game.sectors[s.moving]?.troops)) { s.moving = null; s.selected = null; }

  const controllerOf = (id) => game.sectors[id]?.controller || null;
  // Grenskleur van een provincie: de controller, anders de regio (Sint-Niklaas goud, rebellen hun thuiskleur).
  const colorOf = (id) => factions[controllerOf(id) || byId.get(id).factionHome].color;
  const groupOf = (id) => controllerOf(id) || `home:${byId.get(id).factionHome}`;

  const status = game.gameOver
    ? (game.resultText || 'De slag is gestreden.')
    : `Ronde ${game.round} · ${turn ? `${turn.name} (${factions[turn.faction].name})` : ''} is aan de beurt`;
  els.gameStage.append(titlebar('Total Waas', status));

  const root = E('div', 'sow-root');
  const boardWrap = E('div', 'sow-board-wrap');
  const panel = E('div', 'sow-panel');
  root.append(boardWrap, panel);
  els.gameStage.append(root);

  const sectorNodes = new Map();
  const highlightLayer = svg('g', { class: 'sow-highlights' });
  boardWrap.append(buildBoard({ game, byId, factions, colorOf, controllerOf, groupOf, sectorNodes, highlightLayer, onSelect: select, onArmy: selectArmy }));

  const popup = E('dialog', 'sow-province-popup');
  popup.setAttribute('aria-label', 'Provincie-informatie en acties');
  const close = E('button', 'sow-popup-close', '×');
  close.type = 'button'; close.setAttribute('aria-label', 'Provincie sluiten');
  const infoBox = E('div', 'sow-sector-info');
  popup.append(close, infoBox);
  root.append(popup);
  close.onclick = closePopup;
  popup.addEventListener('cancel', (event) => { event.preventDefault(); closePopup(); });
  popup.addEventListener('click', (event) => {
    if (event.target !== popup) return;
    const bounds = popup.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePopup();
  });
  panel.append(renderTurnBox(E, game, you, turn, factions, action), renderBattle(E, game, you, byId, action), renderCards(E, game, you, action), E('small', 'sow-hint', 'Klik een provincie voor informatie en acties.'), renderPlayers(E, game, factions), renderLegend(E, game.board), logBox(game.log));
  if (game.battle && s.battleId !== game.battle.id) {
    s.battleId = game.battle.id;
    if (globalThis.matchMedia?.('(max-width: 900px)')?.matches) panel.querySelector('.sow-battle')?.scrollIntoView({ block: 'start' });
  }

  function closePopup() {
    const previous = s.selected;
    s.selected = null; s.popupOpen = false;
    popup.close(); syncSelection();
    boardWrap.querySelector(`[data-sector-id="${previous}"]`)?.focus();
  }

  const moveHint = E('div', 'sow-move-hint');
  moveHint.setAttribute('role', 'status');
  boardWrap.prepend(moveHint);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && s.moving) {
      s.moving = null; s.selected = null; syncSelection();
    }
  });

  function selectArmy(id) {
    if (s.moving && s.moving !== id) { select(id); return; }
    if (game.battle || !game.canEndTurn || game.sectors[id].controller !== you?.faction) { select(id); return; }
    s.moving = s.moving === id ? null : id; s.selected = s.moving; s.popupOpen = false;
    popup.close(); syncSelection();
  }

  function select(id) {
    if (s.moving) {
      const from = s.moving;
      const connection = byId.get(from).connections.find(c => c.to === id);
      if (id === from) { s.moving = null; s.selected = null; syncSelection(); return; }
      if (game.sectors[id].controller !== you?.faction && game.sectors[from].troops < 2) return;
      if (!connection || game.sectors[from].movement < (connection.kinds.includes('road') ? 1 : 2)) return;
      s.moving = null; s.selected = null; syncSelection(); action('move', { from, to: id }); return;
    }
    s.tab = 'actions'; s.selected = id; s.popupOpen = true;
    syncSelection();
  }

  function syncSelection() {
    highlightLayer.replaceChildren();
    moveHint.replaceChildren(); moveHint.hidden = !s.moving;
    if (s.moving) {
      const movement = game.sectors[s.moving].movement;
      const canMove = byId.get(s.moving).connections.some(c => movement >= (c.kinds.includes('road') ? 1 : 2) && (game.sectors[c.to].controller === you.faction || game.sectors[s.moving].troops >= 2));
      moveHint.append(E('span', '', byId.get(s.moving).name + (canMove
        ? ': kies een gemarkeerde provincie. Bij een aanval blijft één troep achter. Daarna kies je per worp of je doorgaat.'
        : movement > 0 && game.sectors[s.moving].troops < 2 ? ': aanvallen vereist minstens 2 troepen. Werf versterkingen.' : ': onvoldoende beweging. Wacht tot je volgende beurt.')));
      const cancel = E('button', '', 'Annuleren'); cancel.onclick = () => { s.moving = null; s.selected = null; syncSelection(); }; moveHint.append(cancel);
    }
    const selected = s.selected ? byId.get(s.selected) : null;
    const neighborKinds = new Map(selected ? selected.connections.filter(c => !s.moving || (game.sectors[s.moving].movement >= (c.kinds.includes('road') ? 1 : 2) && (game.sectors[c.to].controller === you.faction || game.sectors[s.moving].troops >= 2))).map((c) => [c.to, c.kinds]) : []);
    sectorNodes.forEach((node, id) => {
      node.classList.toggle('selected', id === s.selected);
      node.classList.toggle('neighbor', neighborKinds.has(id));
      node.classList.toggle('dimmed', Boolean(selected) && id !== s.selected && !neighborKinds.has(id));
      const hit = boardWrap.querySelector(`[data-sector-id="${id}"]`);
      const label = (s.moving && neighborKinds.has(id) ? (game.sectors[id].controller === you.faction ? 'Verplaats naar ' : 'Val aan: ') : '') + byId.get(id).name;
      hit?.setAttribute('aria-label', label);
    });
    if (selected) {
      for (const connection of selected.connections) {
        if (!neighborKinds.has(connection.to)) continue;
        const target = byId.get(connection.to);
        const kind = connection.kinds.includes('bridge') ? 'bridge' : connection.kinds.includes('road') ? 'road' : connection.kinds.includes('water') ? 'water' : 'land';
        highlightLayer.append(svg('line', {
          x1: selected.seed[0], y1: selected.seed[1], x2: target.seed[0], y2: target.seed[1], class: `sow-link sow-link-${kind}`
        }));
      }
    }
    if (selected && s.popupOpen) {
      popup.setAttribute('aria-label', `${selected.name}: informatie en acties`);
      infoBox.replaceChildren(renderSectorInfo(E, game, selected, factions, byId, select, action, you, s, syncSelection));
      if (!popup.open) popup.showModal();
    }
  }

  syncSelection();
}

/* ---------------- bord: defs ---------------- */

function buildDefs(defs, factions) {
  // Gloed per factiekleur voor de regiogrenzen
  for (const faction of Object.values(factions)) {
    const filter = svg('filter', { id: `sow-glow-${faction.id}`, x: '-30%', y: '-30%', width: '160%', height: '160%' });
    filter.append(svg('feDropShadow', { dx: 0, dy: 0, stdDeviation: 5, 'flood-color': faction.color, 'flood-opacity': 0.95 }));
    defs.append(filter);
  }
  const soft = svg('filter', { id: 'sow-soft-shadow', x: '-10%', y: '-10%', width: '120%', height: '130%' });
  soft.append(svg('feDropShadow', { dx: 0, dy: 10, stdDeviation: 8, 'flood-color': '#000', 'flood-opacity': 0.55 }));
  defs.append(soft);

  const parchment = svg('linearGradient', { id: 'sow-parchment', x1: 0, y1: 0, x2: 1, y2: 1 });
  parchment.append(svg('stop', { offset: '0%', 'stop-color': '#f4e8cf' }), svg('stop', { offset: '100%', 'stop-color': '#dcc9a3' }));
  defs.append(parchment);

  // Biome-patronen
  const make = (id, size, children) => {
    const pattern = svg('pattern', { id: `sow-pat-${id}`, width: size, height: size, patternUnits: 'userSpaceOnUse' });
    children.forEach((child) => pattern.append(child));
    defs.append(pattern);
  };
  make('winter', 30, [
    svg('path', { d: 'M8 22 L13 9 L18 22 Z M11 22 L13 15 L15 22 Z', fill: '#1e5f3a', opacity: .55 }),
    svg('path', { d: 'M21 27 L24 19 L27 27 Z', fill: '#2a7048', opacity: .45 }),
    svg('circle', { cx: 5, cy: 5, r: 1.4, fill: '#fff', opacity: .9 }),
    svg('circle', { cx: 24, cy: 8, r: 1.1, fill: '#fff', opacity: .8 })
  ]);
  make('zand', 34, [
    svg('path', { d: 'M2 12 Q10 4 18 12', stroke: '#b9722c', 'stroke-width': 1.5, fill: 'none', opacity: .5 }),
    svg('path', { d: 'M16 27 Q24 19 32 27', stroke: '#b9722c', 'stroke-width': 1.3, fill: 'none', opacity: .4 }),
    svg('circle', { cx: 8, cy: 24, r: 1, fill: '#9c5a1e', opacity: .4 })
  ]);
  make('polder', 26, [
    svg('path', { d: 'M0 5 H26 M0 12 H26 M0 19 H26', stroke: '#1d8348', 'stroke-width': 1.2, opacity: .38 }),
    svg('path', { d: 'M13 25 v-8 M9 17 l8 4 M9 21 l8 -4', stroke: '#145a32', 'stroke-width': 1, opacity: .35 })
  ]);
  make('water', 28, [
    svg('path', { d: 'M0 8 q7 -5 14 0 t14 0', stroke: '#eaf6ff', 'stroke-width': 1.4, fill: 'none', opacity: .55 }),
    svg('path', { d: 'M0 21 q7 -5 14 0 t14 0', stroke: '#eaf6ff', 'stroke-width': 1.1, fill: 'none', opacity: .35 })
  ]);
  make('vesting', 22, [
    svg('path', { d: 'M0 6 H22 M0 17 H22 M6 6 V17 M17 6 V17 M11 0 V6 M11 17 V22', stroke: '#5d6d7e', 'stroke-width': 1, opacity: .4 })
  ]);
}

/* ---------------- bord: iconen ---------------- */

function buildIcon(kind, x, y) {
  const g = svg('g', { class: `sow-poi sow-poi-${kind}`, transform: `translate(${x} ${y})` });
  const add = (tag, attrs) => g.append(svg(tag, attrs));
  if (kind === 'castle') {
    add('rect', { x: -30, y: -6, width: 60, height: 22, class: 'poi-wall' });
    add('path', { d: 'M-30 -6 v-8 h6 v5 h6 v-5 h6 v5 h6 v-5 h6 v5 h6 v-5 h6 v5 h6 v-5 h6 v8', class: 'poi-wall' });
    add('rect', { x: -12, y: -24, width: 24, height: 20, class: 'poi-keep' });
    add('path', { d: 'M-12 -24 v-6 h5 v4 h4 v-4 h6 v4 h4 v-4 h5 v6', class: 'poi-keep' });
    add('path', { d: 'M-3 -30 L0 -46 L3 -30 Z', class: 'poi-roof' });
    add('path', { d: 'M0 -46 v-6 M-2 -50 h4', class: 'poi-line' });
    add('path', { d: 'M-4 16 v-9 a4 4 0 0 1 8 0 v9', class: 'poi-gate' });
  } else if (kind === 'tower') {
    add('rect', { x: -7, y: -22, width: 14, height: 30, class: 'poi-keep' });
    add('path', { d: 'M-9 -22 h18 l-3 -5 h-12 z', class: 'poi-roof' });
    add('path', { d: 'M-4 -26 L0 -40 L4 -26 Z', class: 'poi-roof' });
    add('rect', { x: -2, y: -14, width: 4, height: 6, class: 'poi-window' });
    add('path', { d: 'M-3 8 v-6 a3 3 0 0 1 6 0 v6', class: 'poi-gate' });
  } else if (kind === 'harbour') {
    add('path', { d: 'M-26 8 h52', class: 'poi-dock' });
    add('path', { d: 'M-20 8 v6 M-8 8 v6 M4 8 v6 M16 8 v6', class: 'poi-dock' });
    add('path', { d: 'M-14 2 q10 8 28 0 l-3 -8 h-22 z', class: 'poi-hull' });
    add('path', { d: 'M0 -6 v-22', class: 'poi-mast' });
    add('path', { d: 'M0 -26 q14 8 0 18 z', class: 'poi-sail' });
    add('path', { d: 'M-24 -2 v-14 l10 -6', class: 'poi-crane' });
  } else if (kind === 'trees') {
    [[-14, 4, 1], [0, -2, 1.25], [13, 6, .9], [6, 12, .8], [-6, 12, .85]].forEach(([tx, ty, sc]) => {
      const t = svg('g', { transform: `translate(${tx} ${ty}) scale(${sc})` });
      t.append(svg('path', { d: 'M0 -18 L9 -4 H4 L10 6 H-10 L-4 -4 H-9 Z', class: 'poi-pine' }), svg('rect', { x: -1.5, y: 6, width: 3, height: 5, class: 'poi-trunk' }));
      g.append(t);
    });
  } else if (kind === 'windmill') {
    add('path', { d: 'M-7 10 L-4 -8 H4 L7 10 Z', class: 'poi-keep' });
    add('path', { d: 'M-8 -8 h16 l-8 -8 z', class: 'poi-roof' });
    add('path', { d: 'M0 -10 L14 -24 M0 -10 L-14 -24 M0 -10 L14 4 M0 -10 L-14 4', class: 'poi-sails' });
    add('path', { d: 'M0 -10 L14 -24 l-4 -1 M0 -10 L-14 -24 l1 4', class: 'poi-sails' });
  }
  return g;
}

function buildCompass(x, y) {
  const g = svg('g', { class: 'sow-compass', transform: `translate(${x} ${y})` });
  g.append(svg('circle', { cx: 0, cy: 0, r: 30, class: 'ring' }));
  g.append(svg('circle', { cx: 0, cy: 0, r: 22, class: 'ring inner' }));
  g.append(svg('polygon', { points: '0,-26 6,0 0,26 -6,0', class: 'needle' }));
  g.append(svg('polygon', { points: '-26,0 0,-6 26,0 0,6', class: 'needle soft' }));
  g.append(svg('polygon', { points: '0,-26 6,0 0,0', class: 'needle dark' }));
  g.append(svg('polygon', { points: '-17,-17 0,-5 -5,0', class: 'needle soft' }));
  g.append(svg('polygon', { points: '17,17 0,5 5,0', class: 'needle soft' }));
  g.append(svg('polygon', { points: '17,-17 5,0 0,-5', class: 'needle soft' }));
  g.append(svg('polygon', { points: '-17,17 -5,0 0,5', class: 'needle soft' }));
  const n = svg('text', { x: 0, y: -36, 'text-anchor': 'middle' });
  n.textContent = 'N';
  g.append(n);
  return g;
}

function buildTitleBanner(x, y) {
  const g = svg('g', { class: 'sow-banner', transform: `translate(${x} ${y})` });
  g.append(svg('path', { d: 'M0 6 q8 -8 16 -4 h228 q10 -4 18 4 l-4 30 q-6 6 -14 4 h-228 q-10 4 -16 -4 z', class: 'banner-paper' }));
  const title = svg('text', { x: 131, y: 21, 'text-anchor': 'middle', class: 'banner-title' });
  title.textContent = 'Total Waas';
  const sub = svg('text', { x: 131, y: 34, 'text-anchor': 'middle', class: 'banner-sub' });
  sub.textContent = 'STRIJD · BOUW · VEROVER';
  g.append(title, sub);
  return g;
}

/* ---------------- bord ---------------- */

function buildBoard({ game, byId, factions, colorOf, controllerOf, groupOf, sectorNodes, highlightLayer, onSelect, onArmy }) {
  const { board } = game;
  const pad = 52;
  const root = svg('svg', { viewBox: `${-pad} ${-pad} ${board.size + pad * 2} ${board.size + pad * 2}`, class: 'sow-svg waas-board', role: 'img', 'aria-label': 'Speelbord van het Land van Waas' });
  const defs = svg('defs');
  root.append(defs);
  buildDefs(defs, factions);

  // 2.5D borddikte: donkere offset-lagen onder het bordvlak, daarna het bord zelf
  const outlinePath = smoothPath(board.outline, true);
  root.append(svg('path', { d: outlinePath, class: 'sow-board-depth', transform: 'translate(8 24)' }));
  root.append(svg('path', { d: outlinePath, class: 'sow-board-depth side', transform: 'translate(4 12)' }));
  root.append(svg('path', { d: outlinePath, class: 'sow-board-base' }));

  const regionLayer = svg('g', { class: 'sow-regions' });
  const featureLayer = svg('g', { class: 'sow-features' });
  const labelLayer = svg('g', { class: 'sow-labels' });
  const hitLayer = svg('g', { class: 'sow-hits' });
  root.append(regionLayer, featureLayer, highlightLayer, labelLayer, hitLayer);

  const regionGroups = {};
  for (const regionId of Object.keys(BIOMES)) {
    regionGroups[regionId] = svg('g', { id: `regio-${regionId}`, class: `sow-region biome-${BIOMES[regionId].pattern}` });
    regionLayer.append(regionGroups[regionId]);
  }

  for (const sector of board.sectors) {
    const biome = BIOMES[sector.factionHome];
    const clipId = `sow-clip-${sector.id}`;
    const clip = svg('clipPath', { id: clipId });
    clip.append(svg('polygon', { points: points(sector.polygon) }));
    defs.append(clip);

    const controller = controllerOf(sector.id);
    const group = svg('g', { class: `sow-sector terrain-${sector.terrain}${controller ? '' : ' rebel'}`, 'data-sector': sector.id });
    const base = biome.dense.includes(sector.terrain) ? biome.dark : biome.light;
    group.append(svg('polygon', { points: points(sector.polygon), fill: base, class: 'sow-cell-fill' }));
    group.append(svg('polygon', { points: points(sector.polygon), fill: `url(#sow-pat-${biome.pattern})`, class: 'sow-cell-pattern' }));
    // Veroverd gebied krijgt een tint van de nieuwe eigenaar; rebellenland wordt licht gedoofd
    if (controller && controller !== sector.factionHome) {
      group.append(svg('polygon', { points: points(sector.polygon), fill: hexAlpha(factions[controller].color, 0.38), class: 'sow-cell-tint' }));
    } else if (!controller && sector.factionHome !== 'center') {
      group.append(svg('polygon', { points: points(sector.polygon), class: 'sow-cell-tint rebel' }));
    }
    // Regiogrenzen met gloed: naar binnen geclipt, enkel waar de buur tot een andere groep behoort
    const edgeFaction = controller || sector.factionHome;
    const border = svg('g', { 'clip-path': `url(#${clipId})`, filter: `url(#sow-glow-${edgeFaction})`, class: 'sow-border-group' });
    for (let i = 0; i < sector.polygon.length; i += 1) {
      const a = sector.polygon[i], b = sector.polygon[(i + 1) % sector.polygon.length];
      const neighbor = board.sectors.find((o) => o.id !== sector.id && o.polygon.some((p) => near(p, a)) && o.polygon.some((p) => near(p, b)));
      if (!neighbor || groupOf(neighbor.id) !== groupOf(sector.id)) {
        border.append(svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: colorOf(sector.id), class: `sow-faction-edge${controller ? '' : ' neutral'}` }));
        border.append(svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: `sow-faction-edge-core${controller ? '' : ' neutral'}` }));
      }
    }
    group.append(border);
    group.append(svg('polygon', { points: points(sector.polygon), class: 'sow-cell-outline' }));
    regionGroups[sector.factionHome].append(group);

    const hit = svg('polygon', { points: points(sector.polygon), class: 'sow-cell-hit', tabindex: 0, role: 'button', 'aria-label': sector.name, 'data-sector-id': sector.id });
    hit.addEventListener('click', () => onSelect(sector.id));
    hit.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(sector.id); }
    });
    hit.addEventListener('mouseenter', () => group.classList.add('hover'));
    hit.addEventListener('mouseleave', () => group.classList.remove('hover'));
    hitLayer.append(hit);
    sectorNodes.set(sector.id, group);
  }

  // Stadsmuur rond Sint-Niklaas
  const city = byId.get('center_sint_niklaas');
  if (city) {
    const [cx, cy] = city.label;
    featureLayer.append(svg('circle', { cx, cy, r: 62, class: 'sow-wall-under' }));
    featureLayer.append(svg('circle', { cx, cy, r: 62, class: 'sow-wall' }));
    featureLayer.append(svg('circle', { cx, cy, r: 62, class: 'sow-wall-merlons' }));
  }

  // Schelde: vloeiende meanderende band op de oost- en zuidrand, met lichte oever
  if (board.schelde?.length > 1) {
    const d = smoothPath(board.schelde);
    featureLayer.append(svg('path', { d, class: 'sow-schelde-bank' }));
    featureLayer.append(svg('path', { d, class: 'sow-schelde' }));
    featureLayer.append(svg('path', { d, class: 'sow-schelde-hi' }));
    BOATS.forEach(([x, y]) => { const boat = buildIcon('harbour', x, y); boat.classList.add('sow-boat'); root.append(boat); });
    const label = svg('text', { x: 998, y: 700, class: 'sow-schelde-label', 'text-anchor': 'middle', transform: 'rotate(68 998 700)' });
    label.textContent = 'Schelde';
    root.append(label);
  }

  // Durme links van Lokeren, met dezelfde lichte oevers als de Moervaart.
  const durme = smoothPath(DURME_PATH);
  featureLayer.append(svg('path', { d: durme, class: 'sow-river-bank' }));
  featureLayer.append(svg('path', { d: durme, class: 'sow-river' }));
  const durmeLabel = svg('text', { x: 49, y: 610, class: 'sow-river-label', 'text-anchor': 'middle', transform: 'rotate(-82 49 610)' });
  durmeLabel.textContent = 'Durme';
  labelLayer.append(durmeLabel);

  // Hoofdwegen / handelsroutes
  for (const road of board.roads) {
    const d = smoothPath(road.path.map((id) => byId.get(id).seed));
    featureLayer.append(svg('path', { d, class: 'sow-road-under' }));
    featureLayer.append(svg('path', { d, class: 'sow-road trade-route' }));
  }

  // Moervaart: segmenten aan elkaar rijgen tot één vloeiende lijn
  if (board.moervaart.length) {
    const river = chainSegments(board.moervaart);
    river.forEach((pts) => {
      const d = smoothPath(pts);
      featureLayer.append(svg('path', { d, class: 'sow-river-bank' }));
      featureLayer.append(svg('path', { d, class: 'sow-river' }));
    });
    for (const segment of board.moervaart) {
      const [a, b] = segment.between;
      if (!byId.get(a).connections.some((c) => c.to === b && c.kinds.includes('bridge'))) continue;
      featureLayer.append(buildBridge((segment.from[0] + segment.to[0]) / 2, (segment.from[1] + segment.to[1]) / 2, segment));
    }
    const pts = board.moervaart.flatMap((seg) => [seg.from, seg.to]);
    const top = pts.reduce((m, p) => (p[1] < m[1] ? p : m)), bottom = pts.reduce((m, p) => (p[1] > m[1] ? p : m));
    const mx = (top[0] + bottom[0]) / 2 - 24, my = (top[1] + bottom[1]) / 2;
    const angle = Math.atan2(bottom[1] - top[1], bottom[0] - top[0]) * 180 / Math.PI;
    const moervaartLabel = svg('text', { x: mx, y: my, class: 'sow-river-label', 'text-anchor': 'middle', transform: `rotate(${angle - 180} ${mx} ${my})` });
    moervaartLabel.textContent = 'Moervaart';
    labelLayer.append(moervaartLabel);
  }

  // Labels, troepen en POI-iconen
  const poiLayer = svg('g', { id: 'poi-markers' });
  labelLayer.append(poiLayer);
  for (const sector of board.sectors) {
    if (POI_ICONS[sector.id]) poiLayer.append(buildIcon(POI_ICONS[sector.id], sector.label[0], sector.label[1] - (sector.isCapital ? 30 : 22)));
    labelLayer.append(buildLabel(sector, game.sectors[sector.id], controllerOf(sector.id), factions));
    const dynamic = game.sectors[sector.id];
    if (dynamic.troops) {
      const piece = buildArmy(sector, dynamic, dynamic.controller ? colorOf(sector.id) : '#8b8068');
      piece.addEventListener('click', () => onArmy(sector.id));
      piece.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onArmy(sector.id); } });
      hitLayer.append(piece);
    }
    dynamic.buildings.forEach((id, i) => {
      const marker = svg('g', { class: 'sow-building', transform: 'translate(' + (sector.label[0] - dynamic.buildings.length * 12 + i * 24) + ' ' + (sector.label[1] - 42) + ')' });
      const title = svg('title'); title.textContent = game.config.buildings[id].label + ' → niveau ' + (dynamic.buildingLevels?.[id] || 1);
      const silhouette = {
        economy: 'M-10 4V-7H10V4ZM-12-7L-8-14H8L12-7ZM-4 4V-3H4V4',
        barracks: 'M-10 4V-8L0-14 10-8V4ZM0-14V-24L10-21 0-18M-3 4V-3H3V4',
        fort: 'M-11 4V-16H-6V-11H-2V-16H3V-11H7V-16H12V4ZM-3 4V-3Q0-8 3-3V4',
        civic: 'M-11 4V0H11V4ZM-8 0V-9M0 0V-9M8 0V-9M-12-10L0-18 12-10Z',
        infrastructure: 'M-12 4V-8H12V4H7V-1Q0-9-7-1V4ZM-14-8H14M-9-8V-13M0-8V-13M9-8V-13'
      }[id];
      marker.append(title, svg('path', { d: silhouette, fill: '#e9d6a4', stroke: '#493422', 'stroke-width': 2 }));
      const label = svg('text', { y: 14, 'text-anchor': 'middle' }); label.textContent = ({ economy: 'E', barracks: 'K', fort: 'F', civic: 'B', infrastructure: 'I' })[id] + (dynamic.buildingLevels?.[id] || 1); marker.append(label); labelLayer.append(marker);
    });
  }

  // Buitenwereld, titelbanner en kompas
  for (const power of EXTERNAL_POWERS) {
    const text = svg('text', { x: power.x, y: power.y, class: 'sow-external', 'text-anchor': power.anchor, transform: power.rotate ? `rotate(${power.rotate} ${power.x} ${power.y})` : '' });
    text.textContent = power.label;
    root.append(text);
  }
  root.append(buildTitleBanner(-44, -44));
  root.append(buildCompass(20, 100));
  return root;
}

// Rijgt losse grenssegmenten aaneen tot doorlopende polylines.
function chainSegments(segments) {
  const remaining = segments.map((s) => [s.from, s.to]);
  const chains = [];
  while (remaining.length) {
    const chain = remaining.shift();
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < remaining.length; i += 1) {
        const [a, b] = remaining[i];
        const head = chain[0], tail = chain[chain.length - 1];
        if (near(tail, a)) { chain.push(b); remaining.splice(i, 1); grew = true; break; }
        if (near(tail, b)) { chain.push(a); remaining.splice(i, 1); grew = true; break; }
        if (near(head, b)) { chain.unshift(a); remaining.splice(i, 1); grew = true; break; }
        if (near(head, a)) { chain.unshift(b); remaining.splice(i, 1); grew = true; break; }
      }
    }
    chains.push(chain);
  }
  return chains;
}

function buildBridge(x, y, segment) {
  const angle = Math.atan2(segment.to[1] - segment.from[1], segment.to[0] - segment.from[0]) * 180 / Math.PI + 90;
  const g = svg('g', { class: 'sow-bridge', transform: `translate(${x} ${y}) rotate(${angle})` });
  g.append(svg('rect', { x: -16, y: -5, width: 32, height: 10, rx: 2, class: 'bridge-deck' }));
  g.append(svg('path', { d: 'M-16 -5 v-4 M-8 -5 v-4 M0 -5 v-4 M8 -5 v-4 M16 -5 v-4 M-16 5 v4 M-8 5 v4 M0 5 v4 M8 5 v4 M16 5 v4', class: 'bridge-rail' }));
  return g;
}

function buildLabel(sector, dynamic, controller, factions) {
  const group = svg('g', { class: 'sow-label' });
  const [x, y] = sector.label;
  const isCity = sector.id === 'center_sint_niklaas';
  const name = svg('text', { x, y: y + (isCity ? 18 : sector.isCapital ? 12 : 5), class: `sow-name${isCity ? ' center' : sector.isCapital ? ' capital' : ''}`, 'text-anchor': 'middle' });
  name.textContent = sector.name;
  group.append(name);
  return group;
}

/* ---------------- panelen ---------------- */

function renderTurnBox(E, game, you, turn, factions, action) {
  const box = E('div', 'sow-turnbox');
  if (game.gameOver) {
    box.append(E('strong', '', game.resultText || 'De slag is gestreden.'));
    return box;
  }
  const line = E('div', 'sow-turn-line');
  const dot = E('span', 'sow-dot');
  if (turn) dot.style.background = factions[turn.faction].color;
  line.append(dot, E('span', '', turn ? `${turn.name} · ${factions[turn.faction].name}` : ''));
  box.append(E('div', 'sow-round', `Ronde ${game.round}`), line);
  if (game.canEndTurn) {
    const tax = E('select', 'sow-tax');
    for (const [id, policy] of Object.entries(game.config.taxPolicies || {})) {
      const option = E('option', '', `${policy.label} · ×${policy.incomeMultiplier} · ${policy.supportDelta >= 0 ? '+' : ''}${policy.supportDelta} draagvlak`);
      option.value = id; option.selected = you.taxPolicy === id; tax.append(option);
    }
    tax.disabled = Boolean(game.battle);
    tax.onchange = () => action('setTax', { policy: tax.value });
    tax.id = 'sow-tax';
    const label = E('label', 'sow-tax-label', 'Belastingbeleid'); label.htmlFor = tax.id;
    box.append(label, tax, E('small', 'sow-hint', 'Keuze geldt bij je volgende inkomstenfase.'));
    const button = E('button', 'primary sow-endturn', 'Beurt beëindigen');
    button.type = 'button';
    button.disabled = Boolean(game.battle);
    button.onclick = () => action('endTurn');
    box.append(button);
  } else if (you && turn && turn.id !== you.id) {
    box.append(E('div', 'sow-hint', 'Wachten op de andere factie…'));
  }
  return box;
}

function renderBattle(E, game, you, byId, action) {
  const battle = game.battle || game.lastBattle;
  const box = E('section', 'sow-battle');
  if (!battle) { box.hidden = true; return box; }
  const source = game.sectors[battle.from], target = game.sectors[battle.to];
  const active = Boolean(game.battle), ownAttack = battle.attackerId === you?.id;
  box.append(E('strong', '', byId.get(battle.from).name + ' → ' + byId.get(battle.to).name));
  if (active) {
    box.append(E('p', 'sow-hint', 'Aanval: ' + Math.min(3, source.troops - 1) + ' dobbelstenen · verdediging: ' + Math.min(2, target.troops) + '. Eén troep blijft achter.'));
    const fort = target.buildings.includes('fort') ? target.buildingLevels?.fort || 1 : 0;
    const castle = byId.get(battle.to).isCapital ? target.capitalLevel || 1 : 0;
    const bridge = byId.get(battle.from).connections.find(c => c.to === battle.to)?.kinds.includes('bridge') ? 1 : 0;
    box.append(E('small', 'sow-hint', 'Hoogste verdedigingsworp: fort +' + fort + ', kasteel +' + castle + ', brug +' + bridge + '. Samen met colonnes maximaal +4 bonus en worpwaarde 6; gelijkspel is voor de verdediger.'));
    box.append(E('small', 'sow-hint', 'Elke colonne geeft +1 op één eigen dobbelsteen (maximaal 6).'));
  }
  if (battle.lastRoll) {
    const roll = battle.lastRoll;
    for (const [label, values, scores, cls] of [['Aanvaller', roll.attackDice, roll.attackScores, 'attacker'], ['Verdediger', roll.defenseDice, roll.defenseScores, 'defender']]) {
      const row = E('div', 'sow-dice-row'); row.append(E('small', '', label));
      values.forEach(value => { const die = E('span', 'sow-die ' + cls, String(value)); die.setAttribute('aria-label', label + ' gooit ' + value); row.append(die); });
      row.append(E('small', '', 'Met bonus: ' + scores.join(' / '))); box.append(row);
    }
    box.append(E('p', 'sow-hint', 'Worp ' + battle.rounds + ' · verlies aanvaller ' + roll.attackerLosses + ', verdediger ' + roll.defenderLosses + '.'));
  }
  if (active && ownAttack) {
    const controls = E('div', 'sow-battle-controls');
    const roll = E('button', 'primary', battle.rounds ? 'Gooi opnieuw' : 'Gooi dobbelstenen');
    roll.onclick = () => action('rollBattle');
    const retreat = E('button', '', 'Terugtrekken'); retreat.onclick = () => action('retreat');
    controls.append(roll, retreat); box.append(controls);
  } else if (active) box.append(E('p', 'sow-hint', 'De aanvaller kiest de volgende worp. De verdediging dobbelt automatisch mee.'));
  else box.append(E('strong', 'sow-battle-outcome', ({ conquered: 'Provincie veroverd', retreated: 'Aanvaller teruggetrokken', defeated: 'Aanval afgeslagen' })[battle.outcome]));
  return box;
}

function renderCards(E, game, you, action) {
  const box = E('details', 'sow-cards');
  if (!you || !game.config.cards) { box.hidden = true; return box; }
  const cards = you.cards || [];
  box.open = cards.length > 0;
  box.append(E('summary', '', 'Jouw overwinningskaarten (' + cards.length + ')'));
  box.append(E('p', 'sow-hint', 'Je eerste verovering per beurt geeft één kaart. Bewaar kaarten of speel ze tijdens je eigen beurt, buiten een gevecht.'));
  for (const card of cards) {
    const item = game.config.cards[card.type];
    if (!item) continue;
    const row = E('div', 'sow-card');
    row.append(E('strong', '', item.label), E('small', '', item.description));
    let target;
    if (item.troops) {
      target = E('select', ''); target.setAttribute('aria-label', 'Provincie voor ' + item.label);
      for (const sector of game.board.sectors.filter(s => game.sectors[s.id].controller === you.faction)) {
        const option = E('option', '', sector.name); option.value = sector.id; target.append(option);
      }
      row.append(target);
    }
    const button = E('button', '', 'Speel kaart'); button.disabled = !game.canEndTurn || Boolean(game.battle) || Boolean(item.troops && !target.children.length);
    button.onclick = () => action('playCard', { cardId: card.id, ...(target ? { sectorId: target.value } : {}) });
    row.append(button); box.append(row);
  }
  return box;
}

function renderPlayers(E, game, factions) {
  const wrap = E('div', 'sow-players');
  for (const player of game.players) {
    const faction = factions[player.faction];
    const card = E('div', `sow-player${player.isYou ? ' me' : ''}${player.id === game.turnPlayerId ? ' active' : ''}`);
    card.style.setProperty('--faction', faction.color);
    const head = E('div', 'sow-player-head');
    head.append(E('span', 'sow-emblem', faction.emblem), E('strong', '', player.name + (player.isNpc ? ' (NPC)' : '')), E('span', 'sow-faction-name', `${faction.name} · ${faction.title}`));
    const stats = E('div', 'sow-stats');
    [['💰', 'Schatkist', player.treasury], ['🤝', 'Draagvlak', `${player.support}/10`], ['🗺️', 'Provincies', player.sectors], ['⚔️', 'Legermacht', player.army]].forEach(([icon, label, value]) => {
      const stat = E('div', 'sow-stat');
      stat.title = label;
      stat.append(E('span', 'sow-stat-icon', icon), E('b', '', String(value)), E('small', '', label));
      stats.append(stat);
    });
    card.append(head, stats);
    if (player.isYou) card.append(E('small', 'sow-balance', `Opbrengst ${player.income} · onderhoud ${player.upkeep}`));
    wrap.append(card);
  }
  return wrap;
}

function renderSectorInfo(E, game, sector, factions, byId, select, action, you, state, refresh) {
  const box = E('div', 'sow-info'), d = game.sectors[sector.id], own = d.controller === you?.faction;
  const head = E('div', 'sow-info-head');
  head.style.setProperty('--faction', factions[d.controller || sector.factionHome].color);
  head.append(E('strong', '', sector.name));
  if (sector.isCapital && sector.factionHome !== 'center') head.append(E('span', 'sow-tag', 'Hoofdstad'));
  box.append(head);
  const tabs = E('div', 'sow-tabs'); tabs.setAttribute('role', 'tablist');
  const content = E('div', 'sow-tab-content'); content.id = 'sow-tab-panel'; content.setAttribute('role', 'tabpanel');
  for (const [id, label] of [['actions', 'Acties'], ['city', 'Stad'], ['connections', 'Verbindingen']]) {
    const tab = E('button', '', label); tab.id = 'sow-tab-' + id; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String((state.tab || 'actions') === id)); tab.setAttribute('aria-controls', content.id);
    tab.onclick = () => { state.tab = id; refresh(); document.getElementById(tab.id)?.focus(); }; tabs.append(tab);
  }
  content.setAttribute('aria-labelledby', 'sow-tab-' + (state.tab || 'actions')); box.append(tabs, content);
  const capitalLevel = Number.isInteger(d.capitalLevel) && d.capitalLevel > 0 ? d.capitalLevel : 1;
  const maxLevel = game.config.maxBuildingLevel || 3;
  const capitalCost = (game.config.capitalUpgradeCost || 8) * capitalLevel;
  const upgradesAvailable = Boolean(game.config.maxBuildingLevel && Number.isInteger(d.capitalLevel));
  const evolution = capitalLevel < maxLevel ? 'Naar niveau ' + (capitalLevel + 1) + ': bezit je eigen hoofdstad en betaal ' + capitalCost + ' goud. Daarna kun je elk gebouw in je gebied afzonderlijk upgraden tot niveau ' + (capitalLevel + 1) + '.' : 'Maximum niveau bereikt. Alle gebouwen kunnen naar niveau ' + maxLevel + '.';
  const level = id => d.buildings.includes(id) ? d.buildingLevels?.[id] || 1 : 0;
  if (state.tab === 'city') {
    const rows = E('dl', 'sow-info-rows'); const row = (label, value) => rows.append(E('dt', '', label), E('dd', '', value));
    row('Eigenaar', d.controller ? factions[d.controller].name : 'Neutraal'); row('Regio', factions[sector.factionHome].name);
    row('Terrein', game.board.terrains[sector.terrain].label); row('Troepen', (d.units?.militia || 0) + ' militie · ' + (d.units?.armored || 0) + ' colonne');
    row('Bevolking', d.population + '/10'); row('Beweging', d.movement + ' punten · weg 1, overige 2');
    if (sector.isCapital && sector.factionHome !== 'center') {
      row('Hoofdstad', 'Niveau ' + capitalLevel); row('Evolutie', evolution);
    }
    row('Gebouwen', d.buildings.length + '/' + sector.buildSlots + ' bouwplaatsen');
    for (const id of d.buildings) row(game.config.buildings[id].label, 'Niveau ' + level(id));
    if (own) row('Inkomen', (sector.economicValue + d.buildings.reduce((sum, id) => sum + (game.config.buildings[id].incomeBonus || 0) * level(id), 0)) + ' per ronde vóór belastingen');
    content.append(rows);
  } else if (state.tab === 'connections') {
    content.append(E('p', 'sow-hint', 'Selecteer een provincie om die te bekijken. Legers verplaats je via hun figuur op het bord.'));
    const list = E('div', 'sow-connections');
    for (const c of sector.connections) { const button = E('button', 'sow-connection', c.kinds.map(k => KIND_ICON[k]).join('') + ' ' + byId.get(c.to).name); button.title = c.kinds.map(k => KIND_LABEL[k]).join(', '); button.onclick = () => select(c.to); list.append(button); } content.append(list);
  } else {
    if (game.battle) { content.append(E('p', 'sow-hint', 'Rond eerst het gevecht af via het gevechtspaneel.')); return box; }
    if (!own || !game.canEndTurn) { content.append(E('p', 'sow-hint', own ? 'Je kunt acties uitvoeren wanneer je aan de beurt bent.' : 'Je kunt alleen in je eigen provincies bouwen en werven.')); return box; }
    const actions = E('div', 'sow-actions');
    const add = (label, benefit, cost, type, data, blocked = '') => {
      const button = E('button', ''); button.append(E('strong', '', label), E('small', 'sow-benefit', benefit), E('small', 'sow-cost', cost + ' goud'));
      button.disabled = Boolean(blocked) || you.treasury < cost; button.title = blocked || (you.treasury < cost ? 'Onvoldoende goud' : benefit);
      if (blocked) button.append(E('small', '', blocked)); button.onclick = () => action(type, { sectorId: sector.id, ...data }); actions.append(button);
    };
    for (const [id, unit] of Object.entries(game.config.units)) {
      if (unit.requires && !d.buildings.includes(unit.requires)) continue;
      const cost = Math.max(1, unit.cost - (you.support >= 8 ? 1 : 0) - Math.max(0, level('barracks') - 1));
      add('Werf ' + unit.label, 'Troepen +1' + (id === 'armored' ? ' · +1 op één dobbelsteen (max. 6)' : '') + ' · onderhoud +' + unit.upkeep + ' · bevolking −1', cost, 'recruit', { unit: id }, d.population < 2 ? 'Minimaal 2 bevolking nodig' : '');
    }
    if (sector.id === factions[you.faction].capital) {
      content.append(E('p', 'sow-evolution', 'Hoofdstad · niveau ' + capitalLevel + '. ' + evolution));
      if (!upgradesAvailable) content.append(E('p', 'sow-hint', 'Evolutie is beschikbaar zodra de spelserver is bijgewerkt.'));
      else if (capitalLevel < maxLevel) add('Evolueer hoofdstad', 'Niveau ' + (capitalLevel + 1) + ' ontsluit sterkere gebouwen in je hele gebied', capitalCost, 'upgrade', { building: 'capital' });
    }
    const benefit = (id, upgrading) => ({ economy: 'Inkomen +1 per ronde', barracks: upgrading ? 'Wervingskosten −1 goud (min. 1)' : 'Ontsluit colonnes · +1 op een dobbelsteen', fort: '+1 op hoogste verdedigingsdobbelsteen (max. 6)', civic: 'Draagvlak +1 direct (max. 10)', infrastructure: 'Beweging +1 vanaf volgende beurt' })[id];
    for (const [id, building] of Object.entries(game.config.buildings)) {
      const current = level(id);
      if (!current && d.buildings.length < sector.buildSlots) add('Bouw ' + building.label, benefit(id, false), building.cost, 'build', { building: id });
      else if (current && current < game.config.maxBuildingLevel) add(building.label + ' → niveau ' + (current + 1), benefit(id, true), building.cost * (current + 1), 'upgrade', { building: id }, (!upgradesAvailable || current >= (you.capitalLevel || 1)) ? 'Hoofdstad niveau ' + (current + 1) + ' nodig' : '');
    }
    content.append(actions, E('small', 'sow-hint', 'Gebouwniveaus volgen je eigen hoofdstad (max. ' + maxLevel + '). Klik op een legerfiguur op het bord om te bewegen.'));
  }
  return box;
}

function buildArmy(sector, dynamic, color) {
  const n = dynamic.troops, kind = n >= 20 ? 'Vliegtuig' : n >= 10 ? 'Artillerie' : n >= 5 ? 'Tank' : 'Soldaten';
  const g = svg('g', { class: 'sow-army', transform: 'translate(' + sector.label[0] + ' ' + (sector.label[1] + 30) + ')', tabindex: 0, role: 'button', 'aria-label': sector.name + ': ' + n + ' troepen, ' + kind });
  const title = svg('title'); title.textContent = n + ' troepen · ' + kind + ' · klik om te selecteren';
  g.append(title, svg('rect', { x: -27, y: -20, width: 54, height: 43, rx: 12, fill: 'transparent' }), svg('ellipse', { cx: 0, cy: 12, rx: 24, ry: 7, fill: '#342519', opacity: .6 }));
  const paths = n >= 20 ? 'M0-21L5-5 23 5 23 10 5 5 4 16 11 21 0 18-11 21-4 16-5 5-23 10-23 5-5-5Z' : n >= 10 ? 'M-18 7L-8-4 17-19 21-14-3 2 11 7 11 12-18 12ZM-13 7A6 6 0 1 0-13 19A6 6 0 1 0-13 7M10 7A6 6 0 1 0 10 19A6 6 0 1 0 10 7' : n >= 5 ? 'M-23 4Q-27 16-17 17H17Q27 16 23 4ZM-16 4V-5H12L18 4ZM-6-5V-12H9V-5M8-10H28V-6H8' : 'M-6-10A7 7 0 1 0 6-10A7 7 0 1 0-6-10M-7-3H7L12 8 7 10 5 4 4 13 10 20H2L-1 12-5 20H-13L-7 10-8 3-13 8-16 4Z';
  g.append(svg('path', { d: paths, fill: color, stroke: '#30281c', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  const count = svg('text', { x: 24, y: 24, 'text-anchor': 'middle', class: 'sow-army-count' }); count.textContent = n; g.append(count); return g;
}

function renderLegend(E, board) {
  const wrap = E('details', 'sow-legend');
  wrap.append(E('summary', '', 'Legende'));
  const terrains = E('div', 'sow-legend-grid');
  for (const terrain of Object.values(board.terrains)) {
    const item = E('div', 'sow-legend-item');
    const swatch = E('span', 'sow-swatch');
    swatch.style.background = terrain.fill;
    item.append(swatch, E('span', '', terrain.label));
    terrains.append(item);
  }
  const kinds = E('div', 'sow-legend-grid');
  for (const [kind, label] of Object.entries(KIND_LABEL)) {
    const item = E('div', 'sow-legend-item');
    item.append(E('span', 'sow-legend-icon', KIND_ICON[kind]), E('span', '', label));
    kinds.append(item);
  }
  wrap.append(terrains, kinds, E('p', 'sow-hint', 'Legers: 1–4 soldaten · 5–9 tanks · 10–19 artillerie · 20+ vliegtuigen. Elk figuur toont de legergrootte. Colonnes geven +1 op een dobbelsteen (max. 6). Gebouwen: E economie · K kazerne · F fort · B burgerlijk · I infrastructuur; cijfer = niveau.'));
  return wrap;
}

export function metric({ game, player }) {
  const p = game.players.find((entry) => entry.id === player.id);
  return { text: p ? `${p.sectors} prov.` : '', score: p ? p.sectors : 0 };
}
export function isWinner({ game, myId }) { return game.winnerId === myId; }
export function presentResult({ game }) { return game.resultText; }
