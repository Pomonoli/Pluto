const HEX_SIZE = 1;
const PLAYER_COLORS = ['#d1602f', '#5f8fb4', '#7fae6a', '#b596d9', '#c9a24b', '#8fa8b0'];
const LAND_SHADES = ['#3f6b3a', '#4a7642', '#446f3d'];
const RANGE = { arbeider: 1, krijger: 2, graaf: 1, boot: 2 };
const PAWN_GLYPH = { arbeider: '👤', krijger: '⚔️', graaf: '🛡️', boot: '⛵' };
const ACTION_ICON = { uitbreiden: '🧭', upgraden: '⬆️', aanvallen: '⚔️', offeren: '🙏' };
const ACTION_LABEL = { uitbreiden: 'Uitbreiden', upgraden: 'Upgraden', aanvallen: 'Aanvallen', offeren: 'Offeren' };
const ACTION_HINT = {
  uitbreiden: 'Klik een gemarkeerde tegel om te claimen, of je thuisbasis om te versterken.',
  aanvallen: 'Klik een gemarkeerde vijandelijke tegel om aan te vallen.',
  upgraden: 'Klik een eigen tegel met een arbeider of krijger.'
};

function hkey(q, r) { return q + ',' + r; }
function hexDist(a, b) { const dq = a.q - b.q, dr = a.r - b.r; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2; }
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
function neighborKeys(t) { return DIRS.map(([dq, dr]) => hkey(t.q + dq, t.r + dr)); }
function hexPixel(q, r) { return { x: HEX_SIZE * 1.5 * q, y: HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r) }; }
function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) { const ang = Math.PI / 180 * (60 * i); pts.push(`${cx + size * Math.cos(ang)},${cy + size * Math.sin(ang)}`); }
  return pts.join(' ');
}
function landShade(q, r) {
  const h = ((q * 374761393 + r * 668265263) ^ (q * 3266489917)) >>> 0;
  return LAND_SHADES[h % 3];
}
function hexToRgba(hex, a) {
  const v = hex.replace('#', '');
  const r = parseInt(v.substr(0, 2), 16), g = parseInt(v.substr(2, 2), 16), b = parseInt(v.substr(4, 2), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  return node;
}

function expandTargets(tileByKey, myTiles, homeKey) {
  const res = new Set();
  myTiles.forEach((t) => neighborKeys(t).forEach((k) => { const nt = tileByKey.get(k); if (nt && nt.owner === null) res.add(k); }));
  if (homeKey) res.add(homeKey);
  return res;
}
function attackTargets(tileByKey, myTiles, myId) {
  const res = new Set();
  myTiles.forEach((t) => {
    if (!t.pawn) return;
    const rng = RANGE[t.pawn] || 1;
    tileByKey.forEach((ot) => { if (ot.owner !== null && ot.owner !== myId && hexDist(t, ot) <= rng) res.add(ot.key); });
  });
  return res;
}
function upgradeTargets(myTiles) {
  const res = new Set();
  myTiles.forEach((t) => { if (t.pawn === 'arbeider' || t.pawn === 'krijger') res.add(t.key); });
  return res;
}

export function render(api) { renderRagnarok(api); }

function elapsedLabel(ms) {
  const totalSec = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(totalSec / 60), sec = totalSec % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function colorIndexFor(game, playerId) {
  const p = game.players.find((pl) => pl.id === playerId);
  return p ? p.color % PLAYER_COLORS.length : 0;
}

function renderRagnarok({ game, state, els, E, action, titlebar, sound }) {
  const you = game.players.find((p) => p.isYou);
  if (!you) return;

  const s = state.ragnarok || (state.ragnarok = { pending: null, upgradeTile: null });
  const canAct = !you.eliminated && !game.gameOver;
  if (!canAct) { s.pending = null; s.upgradeTile = null; }

  const tileByKey = new Map(game.tiles.map((t) => [hkey(t.q, t.r), { ...t, key: hkey(t.q, t.r) }]));
  const myTiles = [...tileByKey.values()].filter((t) => t.owner === you.id);
  const homeTile = myTiles.find((t) => t.isHome) || null;

  const doAction = (name, payload) => {
    sound('score');
    s.pending = null; s.upgradeTile = null;
    action(name, payload);
    syncPendingUI();
  };

  // --- board ---
  const tileEls = new Map(); // key -> { base, tint, border }
  const boardWrap = E('div', 'rgnk-board-wrap');
  boardWrap.append(buildBoardSvg({ game, tileByKey, you, tileEls, onTileClick: (key, t) => handleTileClick(key, t, s, you, homeTile, doAction, syncPendingUI) }));

  // --- hud ---
  const actionBtnEls = {};
  const subchoiceBox = E('div', 'rgnk-subchoice');
  const hintBox = E('div', 'rgnk-hint');

  const hud = E('div', 'rgnk-hud');
  hud.append(renderResources(E, you));
  hud.append(renderStandings(E, game));

  const actionsWrap = E('div', 'rgnk-actions-wrap');
  if (!canAct) {
    actionsWrap.append(E('div', 'rgnk-waiting', you.eliminated ? 'Je bent uitgeschakeld — kijk toe hoe het afloopt.' : (game.resultText || 'Expeditie afgelopen.')));
  } else {
    const grid = E('div', 'rgnk-actions');
    ['uitbreiden', 'upgraden', 'aanvallen', 'offeren'].forEach((type) => {
      const btn = E('button', 'rgnk-actbtn');
      btn.type = 'button';
      btn.append(E('span', 'rgnk-actbtn-icon', ACTION_ICON[type]), E('span', 'rgnk-actbtn-label', ACTION_LABEL[type]));
      btn.onclick = () => {
        s.pending = s.pending === type ? null : type;
        s.upgradeTile = null;
        syncPendingUI();
      };
      actionBtnEls[type] = btn;
      grid.append(btn);
    });
    actionsWrap.append(grid, subchoiceBox, hintBox);
  }
  hud.append(actionsWrap, renderLog(E, game));

  function syncPendingUI() {
    let validTargets = null;
    if (canAct) {
      if (s.pending === 'uitbreiden') validTargets = expandTargets(tileByKey, myTiles, homeTile ? homeTile.key : null);
      else if (s.pending === 'aanvallen') validTargets = attackTargets(tileByKey, myTiles, you.id);
      else if (s.pending === 'upgraden' || s.pending === 'upgrade-choice') validTargets = upgradeTargets(myTiles);
    }

    tileEls.forEach(({ base, border }, key) => {
      const isTarget = Boolean(validTargets && validTargets.has(key));
      const isSelected = s.upgradeTile === key;
      const t = tileByKey.get(key);
      border.setAttribute('stroke', isSelected ? '#ea7a44' : (isTarget ? 'rgba(234,122,68,0.9)' : (t.owner === null ? 'rgba(18,32,14,0.45)' : hexToRgba(PLAYER_COLORS[colorIndexFor(game, t.owner)], 0.6))));
      border.setAttribute('stroke-width', isSelected ? 0.09 : (isTarget ? 0.07 : 0.025));
      base.style.cursor = isTarget ? 'pointer' : 'default';
    });

    Object.entries(actionBtnEls).forEach(([type, btn]) => {
      btn.classList.toggle('selected', s.pending === type || (type === 'upgraden' && s.pending === 'upgrade-choice'));
    });

    subchoiceBox.replaceChildren();
    hintBox.replaceChildren();
    if (s.pending === 'upgrade-choice') {
      subchoiceBox.append(E('div', 'rgnk-subchoice-label', 'Krijger opklimmen tot:'));
      const row = E('div', 'rgnk-subchoice-row');
      const graaf = E('button', 'rgnk-subbtn', '🛡️ Graaf'); graaf.type = 'button';
      graaf.onclick = () => doAction('upgraden', { targetKey: s.upgradeTile, choice: 'graaf' });
      const boot = E('button', 'rgnk-subbtn', '⛵ Boot'); boot.type = 'button';
      boot.onclick = () => doAction('upgraden', { targetKey: s.upgradeTile, choice: 'boot' });
      row.append(graaf, boot);
      subchoiceBox.append(row);
    } else if (s.pending === 'offeren') {
      subchoiceBox.append(E('div', 'rgnk-subchoice-label', 'Offer 2 erts + 2 ijzer voor:'));
      const row = E('div', 'rgnk-subchoice-row');
      const protect = E('button', 'rgnk-subbtn', '🛡️ Bescherming'); protect.type = 'button';
      protect.onclick = () => doAction('offeren', { choice: 'protect' });
      const gamble = E('button', 'rgnk-subbtn', '🎲 Gok op bonus'); gamble.type = 'button';
      gamble.onclick = () => doAction('offeren', { choice: 'gamble' });
      row.append(protect, gamble);
      subchoiceBox.append(row);
    } else if (ACTION_HINT[s.pending]) {
      hintBox.textContent = ACTION_HINT[s.pending];
    }
  }

  const root = E('div', 'rgnk-root');
  root.append(boardWrap, hud);

  const status = you.eliminated
    ? 'Je bent toeschouwer.'
    : game.gameOver ? (game.resultText || 'Expeditie afgelopen.')
    : `${game.finale ? 'Eindstrijd' : 'Expeditie'} · ${elapsedLabel(game.elapsedMs)}`;

  els.gameStage.append(titlebar('Ragnarok', status), root);
  syncPendingUI();
}

function buildBoardSvg({ game, tileByKey, you, tileEls, onTileClick }) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  game.tiles.forEach((t) => {
    const p = hexPixel(t.q, t.r);
    minX = Math.min(minX, p.x - HEX_SIZE); maxX = Math.max(maxX, p.x + HEX_SIZE);
    minY = Math.min(minY, p.y - HEX_SIZE); maxY = Math.max(maxY, p.y + HEX_SIZE);
  });
  const pad = 0.5;
  const svg = svgEl('svg', { viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`, class: 'rgnk-svg' });

  const landLayer = svgEl('g', { class: 'rgnk-land' });
  const riverLayer = svgEl('g', { class: 'rgnk-rivers' });
  const contentLayer = svgEl('g', { class: 'rgnk-content' });
  svg.append(landLayer, riverLayer, contentLayer);

  game.tiles.forEach((t) => {
    const key = hkey(t.q, t.r);
    const p = hexPixel(t.q, t.r);
    const size = HEX_SIZE * 0.94;

    const base = svgEl('polygon', { points: hexCorners(p.x, p.y, size), fill: landShade(t.q, t.r) });
    landLayer.append(base);
    base.addEventListener('click', () => onTileClick(key, t));

    if (t.owner !== null) {
      const tint = svgEl('polygon', {
        points: hexCorners(p.x, p.y, size),
        fill: PLAYER_COLORS[colorIndexFor(game, t.owner)],
        'fill-opacity': t.owner === you.id ? 0.34 : 0.24
      });
      tint.style.pointerEvents = 'none'; // let clicks fall through to `base` — a painted fill still hit-tests otherwise
      landLayer.append(tint);
    }

    const border = svgEl('polygon', { points: hexCorners(p.x, p.y, size), fill: 'none', 'stroke-width': 0.025 });
    border.style.pointerEvents = 'none';
    landLayer.append(border);

    tileEls.set(key, { base, tint: null, border });

    if (t.owner !== null) {
      if (t.isHome) {
        const glyph = svgEl('text', { x: p.x, y: p.y + size * 0.32, 'font-size': size * 0.8, 'text-anchor': 'middle', class: 'rgnk-glyph' });
        glyph.textContent = '🏠';
        contentLayer.append(glyph);
      } else if (t.pawn) {
        const glyph = svgEl('text', { x: p.x, y: p.y + size * 0.32, 'font-size': size * 0.72, 'text-anchor': 'middle', class: 'rgnk-glyph' });
        glyph.textContent = PAWN_GLYPH[t.pawn] || '';
        contentLayer.append(glyph);
      }
    }
  });

  (game.rivers || []).forEach((path) => {
    if (path.length < 2) return;
    const pts = [];
    const startP = hexPixel(path[0].q, path[0].r);
    pts.push(`${startP.x},${startP.y}`);
    for (let i = 0; i < path.length - 1; i += 1) {
      const pa = hexPixel(path[i].q, path[i].r), pb = hexPixel(path[i + 1].q, path[i + 1].r);
      pts.push(`${(pa.x + pb.x) / 2},${(pa.y + pb.y) / 2}`);
    }
    const endP = hexPixel(path[path.length - 1].q, path[path.length - 1].r);
    pts.push(`${endP.x},${endP.y}`);
    const pointStr = pts.join(' ');
    riverLayer.append(svgEl('polyline', { points: pointStr, class: 'rgnk-river-under', fill: 'none' }));
    riverLayer.append(svgEl('polyline', { points: pointStr, class: 'rgnk-river-body', fill: 'none' }));
    riverLayer.append(svgEl('polyline', { points: pointStr, class: 'rgnk-river-hi', fill: 'none' }));
  });

  return svg;
}

function handleTileClick(key, tile, s, you, homeTile, doAction, syncPendingUI) {
  if (s.pending === 'uitbreiden') {
    if (tile.owner === null) { doAction('uitbreiden', { targetKey: key }); return; }
    if (homeTile && key === homeTile.key) { doAction('uitbreiden', { home: true, targetKey: key }); return; }
    return;
  }
  if (s.pending === 'aanvallen') {
    if (tile.owner !== null && tile.owner !== you.id) doAction('aanvallen', { targetKey: key });
    return;
  }
  if (s.pending === 'upgraden') {
    if (tile.owner !== you.id || !tile.pawn) return;
    if (tile.pawn === 'krijger') { s.pending = 'upgrade-choice'; s.upgradeTile = key; syncPendingUI(); return; }
    doAction('upgraden', { targetKey: key });
  }
}

/* ---------------- HUD pieces ---------------- */

function renderResources(E, you) {
  const wrap = E('div', 'rgnk-resources');
  const res = you.resources || { erts: 0, ijzer: 0, gunst: 0 };
  [['⛏️', 'Erts', res.erts], ['🔨', 'IJzer', res.ijzer], ['✨', 'Gunst', res.gunst]].forEach(([icon, label, val]) => {
    const box = E('div', 'rgnk-res-box');
    box.append(E('div', 'rgnk-res-icon', icon), E('div', 'rgnk-res-val', String(val)), E('div', 'rgnk-res-label', label));
    wrap.append(box);
  });
  if (you.protectedNext) wrap.append(E('div', 'rgnk-protected', '🛡️ Beschermd tegen het volgende oordeel'));
  return wrap;
}

function renderStandings(E, game) {
  const wrap = E('div', 'rgnk-standings');
  game.players.slice().sort((a, b) => b.score - a.score).forEach((p) => {
    const row = E('div', `rgnk-standing-row${p.isYou ? ' me' : ''}${p.eliminated ? ' out' : ''}`);
    const dot = E('span', 'rgnk-dot'); dot.style.background = PLAYER_COLORS[p.color % PLAYER_COLORS.length];
    row.append(dot, E('span', 'rgnk-standing-name', p.name + (p.isNpc ? ' (NPC)' : '')), E('span', 'rgnk-standing-meta', `${p.tiles} tegels`), E('span', 'rgnk-standing-score', String(p.score)));
    wrap.append(row);
  });
  return wrap;
}

function renderLog(E, game) {
  const wrap = E('div', 'rgnk-log');
  wrap.append(E('div', 'rgnk-log-title', 'Sage'));
  const list = E('div', 'rgnk-log-list');
  (game.log || []).slice().reverse().forEach((line) => list.append(E('div', 'rgnk-log-line', line)));
  wrap.append(list);
  return wrap;
}

export function metric({ game, player }) {
  const p = game.players.find((pl) => pl.id === player.id);
  return { text: p ? `${p.score}` : '', score: p ? p.score : 0 };
}
export function isWinner({ game, myId }) { return game.winnerId === myId; }
export function presentResult({ game }) { return game.resultText; }
