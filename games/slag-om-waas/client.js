/**
 * De Slag om Waas — browserrenderer (Fase 1: het bord).
 *
 * Het bord komt volledig uit `game.board` (statisch) en `game.sectors`
 * (dynamisch). De client kent geen spelregels; hij tekent, selecteert en
 * toont alleen de acties die de server als geldig markeert.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const KIND_ICON = { land: '🚶', road: '🛣️', bridge: '🌉', water: '⛵' };
const KIND_LABEL = { land: 'Landgrens', road: 'Hoofdweg', bridge: 'Brug over de Moervaart', water: 'Waterroute' };
const EXTERNAL_POWERS = [
  { label: 'Nederland', x: 500, y: -22, anchor: 'middle' },
  { label: 'Antwerpen', x: 1030, y: 500, anchor: 'middle', rotate: 90 },
  { label: 'Bornem · Klein-Brabant', x: 500, y: 1030, anchor: 'middle' },
  { label: 'Gent', x: -30, y: 500, anchor: 'middle', rotate: -90 }
];
const BOATS = [[985, 330], [1000, 620], [905, 905], [640, 985]];

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

export function render(api) {
  const { game, state, els, E, action, titlebar, logBox } = api;
  const s = state.sow || (state.sow = { selected: null });
  const you = game.players.find((p) => p.isYou) || null;
  const turn = game.players.find((p) => p.id === game.turnPlayerId) || null;
  const factions = game.board.factions;
  const byId = new Map(game.board.sectors.map((sector) => [sector.id, sector]));
  if (s.selected && !byId.has(s.selected)) s.selected = null;

  const controllerOf = (id) => game.sectors[id]?.controller || null;
  // Kleur van een provincie: de controller, anders de neutrale Sint-Niklaas-regio, anders niets (rebellenland).
  const colorOf = (id) => {
    const controller = controllerOf(id);
    if (controller) return factions[controller].color;
    return byId.get(id).factionHome === 'center' ? factions.center.color : null;
  };
  const groupOf = (id) => controllerOf(id) || `home:${byId.get(id).factionHome}`;

  const status = game.gameOver
    ? (game.resultText || 'De slag is gestreden.')
    : `Ronde ${game.round} · ${turn ? `${turn.name} (${factions[turn.faction].name})` : ''} is aan de beurt`;
  els.gameStage.append(titlebar('De Slag om Waas', status));

  const root = E('div', 'sow-root');
  const boardWrap = E('div', 'sow-board-wrap');
  const panel = E('div', 'sow-panel');
  root.append(boardWrap, panel);
  els.gameStage.append(root);

  const sectorNodes = new Map();
  const highlightLayer = svg('g', { class: 'sow-highlights' });
  boardWrap.append(buildBoard({ game, byId, factions, colorOf, controllerOf, groupOf, sectorNodes, highlightLayer, onSelect: select }));

  const infoBox = E('div', 'sow-sector-info');
  panel.append(renderTurnBox(E, game, you, turn, factions, action), renderPlayers(E, game, factions), infoBox, renderLegend(E, game.board), logBox(game.log));

  function select(id) {
    s.selected = s.selected === id ? null : id;
    syncSelection();
  }

  function syncSelection() {
    highlightLayer.replaceChildren();
    const selected = s.selected ? byId.get(s.selected) : null;
    const neighborKinds = new Map(selected ? selected.connections.map((c) => [c.to, c.kinds]) : []);
    sectorNodes.forEach((node, id) => {
      node.classList.toggle('selected', id === s.selected);
      node.classList.toggle('neighbor', neighborKinds.has(id));
      node.classList.toggle('dimmed', Boolean(selected) && id !== s.selected && !neighborKinds.has(id));
    });
    if (selected) {
      for (const connection of selected.connections) {
        const target = byId.get(connection.to);
        const kind = connection.kinds.includes('bridge') ? 'bridge' : connection.kinds.includes('road') ? 'road' : connection.kinds.includes('water') ? 'water' : 'land';
        highlightLayer.append(svg('line', {
          x1: selected.seed[0], y1: selected.seed[1], x2: target.seed[0], y2: target.seed[1], class: `sow-link sow-link-${kind}`
        }));
      }
    }
    infoBox.replaceChildren(renderSectorInfo(E, game, selected, factions, byId, select));
  }

  syncSelection();
}

/* ---------------- bord ---------------- */

// Terreinpatronen: eenvoudige, herhaalde motieven per biome bovenop de basiskleur.
function buildTerrainPatterns(defs) {
  const make = (id, size, children) => {
    const pattern = svg('pattern', { id: `sow-pat-${id}`, width: size, height: size, patternUnits: 'userSpaceOnUse' });
    children.forEach((child) => pattern.append(child));
    defs.append(pattern);
  };
  make('forest', 26, [
    svg('polygon', { points: '6,18 11,7 16,18', fill: '#1f4a2a', opacity: .55 }),
    svg('polygon', { points: '17,24 21,14 25,24', fill: '#28603a', opacity: .5 })
  ]);
  make('snow', 22, [
    svg('circle', { cx: 5, cy: 6, r: 1.6, fill: '#ffffff', opacity: .9 }),
    svg('circle', { cx: 15, cy: 15, r: 1.2, fill: '#ffffff', opacity: .8 }),
    svg('polygon', { points: '9,20 12,13 15,20', fill: '#9fb6cc', opacity: .45 })
  ]);
  make('desert', 30, [
    svg('path', { d: 'M2 12 Q9 6 16 12', stroke: '#b98a3c', 'stroke-width': 1.4, fill: 'none', opacity: .55 }),
    svg('path', { d: 'M14 24 Q21 18 28 24', stroke: '#b98a3c', 'stroke-width': 1.2, fill: 'none', opacity: .45 })
  ]);
  make('plains', 28, [
    svg('path', { d: 'M4 10 l3 -3 l3 3', stroke: '#9a8a48', 'stroke-width': 1.2, fill: 'none', opacity: .5 }),
    svg('path', { d: 'M17 22 l3 -3 l3 3', stroke: '#9a8a48', 'stroke-width': 1.2, fill: 'none', opacity: .45 })
  ]);
  make('marsh', 26, [
    svg('path', { d: 'M2 8 q4 -3 8 0 q4 3 8 0', stroke: '#2f7a66', 'stroke-width': 1.3, fill: 'none', opacity: .55 }),
    svg('path', { d: 'M6 19 v-6 M9 19 v-8 M12 19 v-5', stroke: '#2f6a4e', 'stroke-width': 1.2, opacity: .55 })
  ]);
  make('water', 24, [
    svg('path', { d: 'M0 7 q6 -4 12 0 t12 0', stroke: '#dff3ff', 'stroke-width': 1.3, fill: 'none', opacity: .6 }),
    svg('path', { d: 'M0 18 q6 -4 12 0 t12 0', stroke: '#dff3ff', 'stroke-width': 1.1, fill: 'none', opacity: .4 })
  ]);
  make('farmland', 18, [
    svg('path', { d: 'M0 4 H18 M0 10 H18 M0 16 H18', stroke: '#5d8f2a', 'stroke-width': 1.2, opacity: .45 })
  ]);
  make('urban', 20, [
    svg('rect', { x: 3, y: 3, width: 6, height: 5, fill: '#7a6f62', opacity: .5 }),
    svg('rect', { x: 11, y: 11, width: 6, height: 6, fill: '#8c8175', opacity: .45 })
  ]);
}

function buildBoard({ game, byId, factions, colorOf, controllerOf, groupOf, sectorNodes, highlightLayer, onSelect }) {
  const { board } = game;
  const pad = 48;
  const root = svg('svg', { viewBox: `${-pad} ${-pad} ${board.size + pad * 2} ${board.size + pad * 2}`, class: 'sow-svg', role: 'img', 'aria-label': 'Speelbord van het Land van Waas' });
  const defs = svg('defs');
  root.append(defs);
  buildTerrainPatterns(defs);

  // Schaduw, bordvlak en de Schelde langs de oost- en zuidrand
  root.append(svg('polygon', { points: points(board.outline), class: 'sow-board-shadow' }));
  root.append(svg('polygon', { points: points(board.outline), class: 'sow-board-base' }));

  const terrainLayer = svg('g', { class: 'sow-terrain' });
  const featureLayer = svg('g', { class: 'sow-features' });
  const labelLayer = svg('g', { class: 'sow-labels' });
  const hitLayer = svg('g', { class: 'sow-hits' });
  root.append(terrainLayer, featureLayer, highlightLayer, labelLayer, hitLayer);

  for (const sector of board.sectors) {
    const clipId = `sow-clip-${sector.id}`;
    const clip = svg('clipPath', { id: clipId });
    clip.append(svg('polygon', { points: points(sector.polygon) }));
    defs.append(clip);

    const group = svg('g', { class: `sow-sector terrain-${sector.terrain}`, 'data-sector': sector.id });
    group.append(svg('polygon', { points: points(sector.polygon), fill: board.terrains[sector.terrain].fill, class: 'sow-cell-fill' }));
    group.append(svg('polygon', { points: points(sector.polygon), fill: `url(#sow-pat-${sector.terrain})`, class: 'sow-cell-pattern' }));

    const color = colorOf(sector.id);
    const controller = controllerOf(sector.id);
    if (color) {
      group.append(svg('polygon', { points: points(sector.polygon), fill: hexAlpha(color, controller ? 0.34 : 0.26), class: 'sow-cell-tint' }));
    } else {
      // Rebellenprovincie van een niet-gekozen factie: vage thuiskleur
      group.append(svg('polygon', { points: points(sector.polygon), fill: hexAlpha(factions[sector.factionHome].color, 0.1), class: 'sow-cell-tint neutral' }));
    }
    // Regiogrenzen: dik gekleurd, naar binnen geclipt, enkel waar de buur tot een andere groep behoort
    const border = svg('g', { 'clip-path': `url(#${clipId})` });
    const edgeColor = color || factions[sector.factionHome].color;
    for (let i = 0; i < sector.polygon.length; i += 1) {
      const a = sector.polygon[i], b = sector.polygon[(i + 1) % sector.polygon.length];
      const neighbor = board.sectors.find((o) => o.id !== sector.id && o.polygon.some((p) => near(p, a)) && o.polygon.some((p) => near(p, b)));
      if (!neighbor || groupOf(neighbor.id) !== groupOf(sector.id)) {
        border.append(svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: edgeColor, class: `sow-faction-edge${color ? '' : ' neutral'}` }));
      }
    }
    group.append(border);
    group.append(svg('polygon', { points: points(sector.polygon), class: 'sow-cell-outline' }));
    terrainLayer.append(group);

    const hit = svg('polygon', { points: points(sector.polygon), class: 'sow-cell-hit' });
    hit.addEventListener('click', () => onSelect(sector.id));
    hit.addEventListener('mouseenter', () => group.classList.add('hover'));
    hit.addEventListener('mouseleave', () => group.classList.remove('hover'));
    hitLayer.append(hit);
    sectorNodes.set(sector.id, group);

    labelLayer.append(buildLabel(sector, game.sectors[sector.id], controller, factions));
  }

  // Schelde: brede rivier op de bordrand, met een paar schepen
  if (board.schelde?.length > 1) {
    featureLayer.append(svg('polyline', { points: points(board.schelde), class: 'sow-schelde-under' }));
    featureLayer.append(svg('polyline', { points: points(board.schelde), class: 'sow-schelde' }));
    featureLayer.append(svg('polyline', { points: points(board.schelde), class: 'sow-schelde-hi' }));
    BOATS.forEach(([x, y]) => {
      const boat = svg('text', { x, y, class: 'sow-boat', 'text-anchor': 'middle' });
      boat.textContent = '⛵';
      root.append(boat);
    });
    const label = svg('text', { x: 992, y: 700, class: 'sow-schelde-label', 'text-anchor': 'middle', transform: 'rotate(68 992 700)' });
    label.textContent = 'Schelde';
    root.append(label);
  }

  // Hoofdwegen
  for (const road of board.roads) {
    const path = road.path.map((id) => byId.get(id).seed);
    featureLayer.append(svg('polyline', { points: points(path), class: 'sow-road-under' }));
    featureLayer.append(svg('polyline', { points: points(path), class: 'sow-road' }));
  }
  // Moervaart
  for (const segment of board.moervaart) {
    featureLayer.append(svg('line', { x1: segment.from[0], y1: segment.from[1], x2: segment.to[0], y2: segment.to[1], class: 'sow-river-under' }));
    featureLayer.append(svg('line', { x1: segment.from[0], y1: segment.from[1], x2: segment.to[0], y2: segment.to[1], class: 'sow-river' }));
  }
  for (const segment of board.moervaart) {
    const [a, b] = segment.between;
    if (!byId.get(a).connections.some((c) => c.to === b && c.kinds.includes('bridge'))) continue;
    const glyph = svg('text', { x: (segment.from[0] + segment.to[0]) / 2, y: (segment.from[1] + segment.to[1]) / 2 + 8, class: 'sow-bridge', 'text-anchor': 'middle' });
    glyph.textContent = '🌉';
    featureLayer.append(glyph);
  }
  if (board.moervaart.length) {
    const pts = board.moervaart.flatMap((seg) => [seg.from, seg.to]);
    const top = pts.reduce((m, p) => (p[1] < m[1] ? p : m)), bottom = pts.reduce((m, p) => (p[1] > m[1] ? p : m));
    const mx = (top[0] + bottom[0]) / 2 - 22, my = (top[1] + bottom[1]) / 2;
    const angle = Math.atan2(bottom[1] - top[1], bottom[0] - top[0]) * 180 / Math.PI;
    const moervaartLabel = svg('text', { x: mx, y: my, class: 'sow-river-label', 'text-anchor': 'middle', transform: `rotate(${angle - 180} ${mx} ${my})` });
    moervaartLabel.textContent = 'Moervaart';
    labelLayer.append(moervaartLabel);
  }

  // Stadsmuur rond Sint-Niklaas
  const city = byId.get('center_sint_niklaas');
  if (city) {
    const [cx, cy] = city.label;
    featureLayer.append(svg('circle', { cx, cy, r: 58, class: 'sow-wall-under' }));
    featureLayer.append(svg('circle', { cx, cy, r: 58, class: 'sow-wall' }));
  }

  // Buitenwereld en kompas
  for (const power of EXTERNAL_POWERS) {
    const text = svg('text', { x: power.x, y: power.y, class: 'sow-external', 'text-anchor': power.anchor, transform: power.rotate ? `rotate(${power.rotate} ${power.x} ${power.y})` : '' });
    text.textContent = power.label;
    root.append(text);
  }
  root.append(buildCompass(-10, 40));
  return root;
}

function buildLabel(sector, dynamic, controller, factions) {
  const group = svg('g', { class: 'sow-label' });
  const [x, y] = sector.label;
  const isCity = sector.id === 'center_sint_niklaas';
  if (isCity || sector.isCapital) {
    const glyph = svg('text', { x, y: y - 16, class: 'sow-glyph', 'text-anchor': 'middle' });
    glyph.textContent = isCity ? '🏰' : factions[sector.factionHome].emblem;
    group.append(glyph);
  }
  const name = svg('text', { x, y: y + (isCity || sector.isCapital ? 14 : 4), class: `sow-name${isCity ? ' center' : sector.isCapital ? ' capital' : ''}`, 'text-anchor': 'middle' });
  name.textContent = sector.name;
  group.append(name);
  if (dynamic?.troops > 0) {
    const badge = svg('g', { class: `sow-troops${controller ? '' : ' rebel'}` });
    badge.append(svg('circle', { cx: x, cy: y + 32, r: 12, fill: controller ? factions[controller].color : '#4a3f35' }));
    const count = svg('text', { x, y: y + 37, 'text-anchor': 'middle' });
    count.textContent = String(dynamic.troops);
    badge.append(count);
    group.append(badge);
  }
  return group;
}

function buildCompass(x, y) {
  const g = svg('g', { class: 'sow-compass', transform: `translate(${x} ${y})` });
  g.append(svg('circle', { cx: 0, cy: 0, r: 22 }));
  g.append(svg('polygon', { points: '0,-18 5,0 0,18 -5,0', class: 'needle' }));
  g.append(svg('polygon', { points: '-18,0 0,-5 18,0 0,5', class: 'needle soft' }));
  const n = svg('text', { x: 0, y: -26, 'text-anchor': 'middle' });
  n.textContent = 'N';
  g.append(n);
  return g;
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
    const button = E('button', 'primary sow-endturn', 'Beurt beëindigen');
    button.type = 'button';
    button.onclick = () => action('endTurn');
    box.append(button);
  } else if (you && turn && turn.id !== you.id) {
    box.append(E('div', 'sow-hint', 'Wachten op de andere factie…'));
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
    wrap.append(card);
  }
  return wrap;
}

function renderSectorInfo(E, game, sector, factions, byId, select) {
  const box = E('div', 'sow-info');
  if (!sector) {
    box.append(E('div', 'sow-info-empty', 'Klik een provincie op het bord om details en verbindingen te zien.'));
    return box;
  }
  const dynamic = game.sectors[sector.id] || { controller: null, troops: 0, buildings: [] };
  const home = factions[sector.factionHome];
  const controller = dynamic.controller ? factions[dynamic.controller] : null;
  const isCity = sector.id === 'center_sint_niklaas';
  const head = E('div', 'sow-info-head');
  head.style.setProperty('--faction', (controller || home).color);
  head.append(E('span', 'sow-emblem', isCity ? '🏰' : home.emblem), E('strong', '', sector.name));
  if (sector.isCapital) head.append(E('span', 'sow-tag', isCity ? 'Hoofdprijs' : 'Hoofdstad'));
  if (sector.isStrategic && !isCity) head.append(E('span', 'sow-tag', 'Strategisch'));
  box.append(head);

  const rows = E('dl', 'sow-info-rows');
  const row = (label, value) => { rows.append(E('dt', '', label), E('dd', '', value)); };
  row('Controller', controller ? `${controller.name} · ${controller.title}` : (isCity ? 'Neutraal garnizoen' : 'Rebellen (neutraal)'));
  row('Regio', `${home.name}${home.external ? ` · ${home.title}` : ''}`);
  row('Terrein', game.board.terrains[sector.terrain].label);
  row('Troepen', String(dynamic.troops));
  row('Gebouwen', `${dynamic.buildings.length} / ${sector.buildSlots} bouwplaatsen`);
  row('Inkomen', `${sector.economicValue} per ronde`);
  box.append(rows);

  box.append(E('div', 'sow-info-sub', 'Verbindingen'));
  const list = E('div', 'sow-connections');
  for (const connection of sector.connections) {
    const target = byId.get(connection.to);
    const targetController = game.sectors[connection.to]?.controller;
    const chip = E('button', 'sow-connection');
    chip.type = 'button';
    chip.style.setProperty('--faction', targetController ? factions[targetController].color : (target.factionHome === 'center' ? factions.center.color : 'transparent'));
    chip.title = connection.kinds.map((kind) => KIND_LABEL[kind]).join(', ');
    chip.append(E('span', 'sow-connection-kinds', connection.kinds.map((kind) => KIND_ICON[kind]).join('')), E('span', '', target.name));
    chip.onclick = () => select(connection.to);
    list.append(chip);
  }
  box.append(list);
  // Acties: enkel geldige acties tonen — in Fase 1 zijn er nog geen provincie-acties.
  return box;
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
  wrap.append(terrains, kinds);
  return wrap;
}

export function metric({ game, player }) {
  const p = game.players.find((entry) => entry.id === player.id);
  return { text: p ? `${p.sectors} prov.` : '', score: p ? p.sectors : 0 };
}
export function isWinner({ game, myId }) { return game.winnerId === myId; }
export function presentResult({ game }) { return game.resultText; }
