const TILE = 32;
const COLS = 19;
const ROWS = 13;
const HOOK_WINDOW_MS = 900;
const REEL_WINDOW_MS = 1300;
const TILE_COLORS = { L: '#8fc26c', B: '#e3cd93', r: '#5fb3da', k: '#3f8fc4', a: '#22557f', m: '#1f9a8f', z: '#dce8f0' };
const WATER_CHARS = new Set(['r', 'k', 'a', 'm', 'z']);

let state, els, E, action, titlebar, logBox, renderGame;
function bind(api) { ({ state, els, E, action, titlebar, logBox, renderGame } = api); }

let world = null;
let worldPromise = null;
function ensureWorld() {
  if (world || worldPromise) return world;
  worldPromise = fetch('/api/deep-bleu-c/world')
    .then((response) => response.json())
    .then((data) => {
      if (!data.ok) throw new Error(data.error || 'Kaart kon niet laden.');
      world = data;
      if (state?.room) renderGame(state.room);
    })
    .catch((error) => { console.error('Deep Bleu C wereld laden mislukt:', error); worldPromise = null; });
  return null;
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
  els.gameStage.replaceChildren();
  els.gameStage.append(titlebar('The Deep Bleu C', statusFor(you)));

  const wrap = E('div', 'dbc-wrap');
  wrap.append(renderHud(you));

  const loadedWorld = ensureWorld();
  wrap.append(loadedWorld ? renderMap(you, loadedWorld) : E('div', 'dbc-loading', 'Kaart wordt geladen...'));

  const fishingPanel = renderFishingPanel(you.fishing);
  if (fishingPanel) wrap.append(fishingPanel);
  else wrap.append(renderBuildingPanel(you));

  wrap.append(renderSets(you));
  wrap.append(renderInventory(you));

  els.gameStage.append(wrap, logBox(game.log));
}

function renderHud(you) {
  const hud = E('div', 'dbc-hud');
  hud.append(E('div', 'dbc-cash', `\u{1F4B0} €${you.cash}`));
  hud.append(E('div', 'dbc-discovered', `\u{1F4D6} ${you.discovered.length} soorten`));
  return hud;
}

function handleTileClick(wx, wy, tile, you) {
  if (you.fishing && you.fishing.phase !== 'result' && you.fishing.phase !== 'cast') return;
  if (WATER_CHARS.has(tile) && Math.max(Math.abs(you.x - wx), Math.abs(you.y - wy)) <= 1) {
    action('cast', { x: wx, y: wy });
  } else {
    action('move', { x: wx, y: wy });
  }
}

function renderMap(you, worldData) {
  const camX = clampInt(you.x - Math.floor(COLS / 2), 0, worldData.width - COLS);
  const camY = clampInt(you.y - Math.floor(ROWS / 2), 0, worldData.height - ROWS);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${COLS * TILE} ${ROWS * TILE}`,
    class: 'dbc-map',
    role: 'img',
    'aria-label': 'Kaart van The Deep Bleu C'
  });

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const wx = camX + col, wy = camY + row;
      const tile = worldData.tiles[wy * worldData.width + wx] || 'L';
      const rect = svgEl('rect', {
        x: col * TILE, y: row * TILE, width: TILE, height: TILE,
        fill: TILE_COLORS[tile] || '#8fc26c', class: 'dbc-tile'
      });
      rect.onclick = () => handleTileClick(wx, wy, tile, you);
      svg.append(rect);
    }
  }

  worldData.buildings.forEach((building) => {
    if (building.x < camX || building.x >= camX + COLS || building.y < camY || building.y >= camY + ROWS) return;
    const g = svgEl('g', {
      class: `dbc-building ${building.active ? 'active' : 'locked'}`,
      transform: `translate(${(building.x - camX) * TILE},${(building.y - camY) * TILE})`
    });
    g.append(svgEl('rect', { x: 2, y: 2, width: TILE - 4, height: TILE - 4, rx: 6, class: 'dbc-building-bg' }));
    const label = svgEl('text', { x: TILE / 2, y: TILE / 2 + 6, class: 'dbc-building-icon' });
    label.textContent = building.icon;
    g.append(label);
    svg.append(g);
  });

  const px = (you.x - camX) * TILE + TILE / 2, py = (you.y - camY) * TILE + TILE / 2;
  const player = svgEl('g', { class: 'dbc-player', transform: `translate(${px},${py})` });
  player.append(svgEl('circle', { r: 11, cy: 5, class: 'dbc-player-shadow' }));
  player.append(svgEl('circle', { r: 10, class: 'dbc-player-dot' }));
  svg.append(player);

  const wrapDiv = E('div', 'dbc-map-wrap');
  wrapDiv.append(svg);
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
    const text = fish
      ? `Gevangen: ${fish.icon} ${fish.name} · ${fishing.weightKg.toFixed(1)} kg${fishing.isNew ? ' · Nieuwe soort!' : ''}`
      : 'De vis ontsnapte.';
    panel.append(E('div', 'dbc-fishing-text dbc-fishing-result', text));
  }
  return panel;
}

function renderBuildingPanel(you) {
  if (!you.nearBuilding) {
    return E('div', 'dbc-hint', 'Tik op de kaart om te wandelen, of op water vlak naast je om te vissen.');
  }
  const building = you.nearBuilding;
  const panel = E('div', 'dbc-building-panel');
  panel.append(E('strong', '', building.name));
  if (building.type === 'vishandel') {
    panel.append(E('p', '', 'Verkoop hier je vangst voor geld.'));
    const sellAll = E('button', 'primary', 'Verkoop alles');
    sellAll.disabled = !you.inventory.length;
    sellAll.onclick = () => action('sell', { uid: 'all' });
    panel.append(sellAll);
  } else {
    panel.append(E('p', '', 'Nog niet beschikbaar — volgt in een latere fase.'));
  }
  return panel;
}

function renderSets(you) {
  const wrap = E('div', 'dbc-sets');
  wrap.append(E('h4', '', 'Vissets'));
  const grid = E('div', 'dbc-set-grid');
  you.sets.forEach((set) => {
    const card = E('div', 'dbc-set-card');
    card.append(E('div', 'dbc-set-title', `${set.icon} ${set.name} (${set.caught}/${set.total})`));
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

function renderInventory(you) {
  const wrap = E('div', 'dbc-inventory');
  wrap.append(E('h4', '', `Vangst (${you.inventory.length})`));
  if (!you.inventory.length) {
    wrap.append(E('p', 'dbc-empty', 'Nog niets gevangen.'));
    return wrap;
  }
  const list = E('div', 'dbc-inventory-list');
  you.inventory.forEach((item) => {
    const row = E('div', 'dbc-inventory-row');
    row.append(E('span', '', `${item.fish.icon} ${item.fish.name} · ${item.weightKg.toFixed(1)} kg`));
    const sellButton = E('button', 'secondary', 'Verkoop');
    sellButton.disabled = you.nearBuilding?.type !== 'vishandel';
    sellButton.onclick = () => action('sell', { uid: item.uid });
    row.append(sellButton);
    list.append(row);
  });
  wrap.append(list);
  return wrap;
}
