const COLORS = {
  blue: '#3b82f6',
  mint: '#2ec4b6',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  coral: '#ff6b6b',
  yellow: '#e7ad20'
};

export const roomOptions = { bodyClass: 'gravity-active', allowRematch: true };
export const playerStrip = false;

let activeDraft = null;

function sameCell(a, b) { return a?.r === b?.r && a?.c === b?.c; }
function manhattan(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c); }
function cellKey(cell) { return `${cell.r},${cell.c}`; }
function points(cells) { return cells.map((cell) => `${cell.c + 0.5},${cell.r + 0.5}`).join(' '); }
function planetColor(planet) { return COLORS[planet?.color] || COLORS.blue; }
function difficultyLabel(value) {
  return value === 'easy' ? 'Rustig' : value === 'hard' ? 'Sterk' : 'Normaal';
}

function planetAt(game, cell) {
  return game.planets.find((planet) => sameCell(planet, cell)) || null;
}

function asteroidAt(game, cell) {
  return game.asteroids.find((asteroid) => sameCell(asteroid, cell)) || null;
}

function buildCounts(game) {
  const counts = Object.fromEntries(game.planets.map((planet) => [planet.id, 0]));
  Object.values(game.paths || {}).forEach((path) => {
    counts[path.planetId] = (counts[path.planetId] || 0) + 1;
  });
  return counts;
}

function occupiedCells(game, ignoredAsteroidId) {
  const occupied = new Map();
  Object.entries(game.paths || {}).forEach(([asteroidId, path]) => {
    if (asteroidId === ignoredAsteroidId) return;
    path.cells.forEach((cell, index) => {
      const key = cellKey(cell);
      const list = occupied.get(key) || [];
      list.push({ asteroidId, planetId: path.planetId, endpoint: index === path.cells.length - 1 });
      occupied.set(key, list);
    });
  });
  return occupied;
}

function draftValidity(game, draft) {
  const last = draft.cells[draft.cells.length - 1];
  const planet = planetAt(game, last);
  if (!planet) return { valid: false, planet: null };

  for (let i = 1; i < draft.cells.length; i += 1) {
    if (manhattan(draft.cells[i], planet) !== manhattan(draft.cells[i - 1], planet) - 1) {
      return { valid: false, planet };
    }
  }

  const counts = buildCounts(game);
  const old = game.paths?.[draft.asteroidId];
  if (old?.planetId) counts[old.planetId] = Math.max(0, (counts[old.planetId] || 0) - 1);
  if ((counts[planet.id] || 0) >= planet.required) return { valid: false, planet };
  return { valid: true, planet };
}

function setDraftLook(game, draft) {
  const result = draftValidity(game, draft);
  const planet = result.planet;
  draft.valid = result.valid;
  draft.planetId = planet?.id || null;
  draft.polyline.setAttribute('points', points(draft.cells));
  draft.polyline.setAttribute('stroke', planet ? planetColor(planet) : COLORS.blue);
  draft.polyline.classList.toggle('invalid', Boolean(planet && !result.valid));
  draft.board.classList.toggle('gravity-invalid-draft', Boolean(planet && !result.valid));
}

function cellFromPointer(board, game, event) {
  const rect = board.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
  const c = Math.min(game.size - 1, Math.floor((x / rect.width) * game.size));
  const r = Math.min(game.size - 1, Math.floor((y / rect.height) * game.size));
  return { r, c };
}

function canAddCell(game, draft, next) {
  const previous = draft.cells[draft.cells.length - 1];
  if (manhattan(previous, next) !== 1) return false;
  if (draft.cells.some((cell) => sameCell(cell, next))) return false;

  if (game.obstacles.some((cell) => sameCell(cell, next))) return false;
  const asteroid = asteroidAt(game, next);
  if (asteroid && asteroid.id !== draft.asteroidId) return false;

  const planet = planetAt(game, next);
  const occupied = occupiedCells(game, draft.asteroidId).get(cellKey(next)) || [];
  if (occupied.length) {
    if (!planet) return false;
    if (occupied.some((entry) => !entry.endpoint || entry.planetId !== planet.id)) return false;
  }
  return true;
}

function startDraft(game, board, svg, asteroid, event) {
  if (activeDraft) return;
  const oldLine = svg.querySelector(`[data-path-id="${asteroid.id}"]`);
  if (oldLine) oldLine.classList.add('editing');

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.classList.add('gravity-path', 'gravity-path-draft');
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', COLORS.blue);
  svg.append(polyline);

  activeDraft = {
    board,
    svg,
    pointerId: event.pointerId,
    asteroidId: asteroid.id,
    cells: [{ r: asteroid.r, c: asteroid.c }],
    polyline,
    oldLine,
    ended: false,
    valid: false,
    planetId: null
  };
  board.classList.add('drawing');
  board.setPointerCapture?.(event.pointerId);
  setDraftLook(game, activeDraft);
}

function extendDraft(game, event) {
  const draft = activeDraft;
  if (!draft || event.pointerId !== draft.pointerId) return;
  const next = cellFromPointer(draft.board, game, event);
  if (!next) return;

  const last = draft.cells[draft.cells.length - 1];
  if (sameCell(last, next)) return;

  if (draft.cells.length > 1 && sameCell(draft.cells[draft.cells.length - 2], next)) {
    draft.cells.pop();
    draft.ended = Boolean(planetAt(game, draft.cells[draft.cells.length - 1]));
    setDraftLook(game, draft);
    return;
  }

  if (draft.ended || !canAddCell(game, draft, next)) return;
  draft.cells.push(next);
  draft.ended = Boolean(planetAt(game, next));
  setDraftLook(game, draft);
}

function endDraft(game, action, event, cancelled = false) {
  const draft = activeDraft;
  if (!draft || event.pointerId !== draft.pointerId) return;
  activeDraft = null;
  draft.board.classList.remove('drawing', 'gravity-invalid-draft');
  draft.board.releasePointerCapture?.(event.pointerId);
  draft.polyline.remove();
  draft.oldLine?.classList.remove('editing');

  if (!cancelled && draft.ended && draft.valid) {
    action('setPath', { asteroidId: draft.asteroidId, cells: draft.cells });
    return;
  }
  if (draft.cells.length > 1) {
    draft.board.classList.remove('gravity-draft-rejected');
    void draft.board.offsetWidth;
    draft.board.classList.add('gravity-draft-rejected');
    setTimeout(() => draft.board.classList.remove('gravity-draft-rejected'), 260);
  }
}

function renderPlanet(E, planet, fed, hinted) {
  const node = E('div', `gravity-planet gravity-planet--${planet.color}${fed === planet.required ? ' complete' : ''}${hinted ? ' hinted' : ''}`);
  node.style.setProperty('--planet-color', planetColor(planet));
  node.append(E('span', 'gravity-planet-band'));
  const badge = E('span', 'gravity-planet-badge', String(planet.required));
  badge.title = `${fed} van ${planet.required} asteroïden`;
  node.append(badge);
  return node;
}

function renderAsteroid(E, asteroid, connected, hinted) {
  const node = E('div', `gravity-asteroid${connected ? ' connected' : ''}${hinted ? ' hinted' : ''}`);
  node.dataset.asteroidId = asteroid.id;
  node.append(E('span', 'gravity-crater crater-a'), E('span', 'gravity-crater crater-b'), E('span', 'gravity-crater crater-c'));
  return node;
}

function renderBoard(api, shell) {
  const { game, E, action } = api;
  const counts = buildCounts(game);
  const board = E('div', 'gravity-board');
  board.style.setProperty('--gravity-size', String(game.size));
  board.setAttribute('aria-label', `Gravity speelveld van ${game.size} bij ${game.size}`);

  const cells = E('div', 'gravity-cells');
  for (let r = 0; r < game.size; r += 1) {
    for (let c = 0; c < game.size; c += 1) {
      const cell = E('div', 'gravity-cell');
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      const coord = { r, c };
      const planet = planetAt(game, coord);
      const asteroid = asteroidAt(game, coord);
      const obstacle = game.obstacles.find((item) => sameCell(item, coord));
      if (planet) cell.append(renderPlanet(E, planet, counts[planet.id] || 0, game.hint?.planetId === planet.id));
      if (asteroid) cell.append(renderAsteroid(E, asteroid, Boolean(game.paths?.[asteroid.id]), game.hint?.asteroidId === asteroid.id));
      if (obstacle) cell.append(E('div', 'gravity-obstacle', '×'));
      cells.append(cell);
    }
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('gravity-path-layer');
  svg.setAttribute('viewBox', `0 0 ${game.size} ${game.size}`);
  svg.setAttribute('aria-hidden', 'true');
  Object.entries(game.paths || {}).forEach(([asteroidId, path]) => {
    const planet = game.planets.find((item) => item.id === path.planetId);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.classList.add('gravity-path');
    line.dataset.pathId = asteroidId;
    line.setAttribute('points', points(path.cells));
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', planetColor(planet));
    svg.append(line);
  });

  board.append(cells, svg);
  board.onpointerdown = (event) => {
    if (game.gameOver || event.button > 0) return;
    const cell = cellFromPointer(board, game, event);
    const asteroid = cell && asteroidAt(game, cell);
    if (!asteroid) return;
    event.preventDefault();
    startDraft(game, board, svg, asteroid, event);
  };
  board.onpointermove = (event) => {
    if (!activeDraft) return;
    event.preventDefault();
    extendDraft(game, event);
  };
  board.onpointerup = (event) => endDraft(game, action, event, false);
  board.onpointercancel = (event) => endDraft(game, action, event, true);
  shell.append(board);
}

export function render(api) {
  const { game, els, E, action, titlebar } = api;
  activeDraft = null;
  const connected = Object.keys(game.paths || {}).length;
  const total = game.asteroids.length;
  const status = game.gameOver
    ? 'Puzzel opgelost'
    : `${connected}/${total} verbonden · ${difficultyLabel(game.difficulty)} · ${game.moves} ${game.moves === 1 ? 'zet' : 'zetten'}`;
  const heading = titlebar('Gravity', status);

  const controls = E('div', 'gravity-controls');
  const hint = E('button', 'secondary gravity-control', game.hint ? 'Hint actief' : 'Hint');
  hint.type = 'button';
  hint.disabled = Boolean(game.hint) || game.gameOver || connected === total;
  hint.onclick = () => action('hint');
  hint.title = 'Markeer één asteroïde en zijn doelplaneet';

  const undo = E('button', 'secondary gravity-control', 'Undo');
  undo.type = 'button';
  undo.disabled = connected === 0 || game.gameOver;
  undo.onclick = () => action('undo');

  const reset = E('button', 'secondary gravity-control', 'Reset');
  reset.type = 'button';
  reset.disabled = connected === 0 || game.gameOver;
  reset.onclick = () => action('reset');
  controls.append(hint, undo, reset);
  heading.append(controls);
  els.gameStage.append(heading);

  const shell = E('section', 'gravity-shell');
  renderBoard(api, shell);

  const footer = E('div', 'gravity-footer');
  footer.append(
    E('span', 'gravity-footer-status', `${connected} van ${total} asteroïden verbonden`),
    E('span', 'gravity-footer-rule', 'Elke stap trekt dichter naar de planeet.')
  );
  shell.append(footer);
  els.gameStage.append(shell);
}

export function metric({ game }) {
  return { text: `${Object.keys(game.paths || {}).length}/${game.asteroids?.length || 0}`, score: null };
}

export function isWinner({ game }) { return Boolean(game.gameOver); }

export function presentResult({ game }) {
  return {
    title: 'Gravity opgelost',
    copy: game.resultText || 'Elke asteroïde heeft zijn planeet gevonden.'
  };
}
