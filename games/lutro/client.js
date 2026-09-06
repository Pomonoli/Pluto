/* Lutro — isometric parchment board rendered as inline SVG.
   Board geometry mirrors server.js exactly (pure math, no network payload). */

const PATH_LENGTH = 48;
const EDGE_LENGTH = 12;
const HOME_STEPS = 4;
const CENTER = { gx: 6, gy: 6 };
const TILE_W = 34;
const TILE_H = 18;

const FACTIONS = [
  { key: 'rivendell', name: 'Rivendell', people: 'Elven', color: '#7fb7e0', dark: '#2c4c66', icon: '🧝', turretName: 'Elfenboogtoren' },
  { key: 'erebor', name: 'Erebor', people: 'Dwarven', color: '#e0b23c', dark: '#5a4114', icon: '⛏️', turretName: 'Dwergballista' },
  { key: 'baraddur', name: 'Barad-dûr', people: 'Orc', color: '#c14a4a', dark: '#1c1010', icon: '👁️', turretName: 'Oog van Sauron' },
  { key: 'minastirith', name: 'Minas Tirith', people: 'Human', color: '#5fa06f', dark: '#274430', icon: '🛡️', turretName: 'Gondorijnse trebuchet' }
];
const UNIT_META = {
  scout: {
    cost: 50, icon: '🐎',
    names: { rivendell: 'Rivendell Verkenner', erebor: 'Berg-rijder', baraddur: 'Warg-rijder', minastirith: 'Rohan-ruiter' }
  },
  infantry: {
    cost: 100, icon: '⚔️',
    names: { rivendell: 'Elfenwacht', erebor: 'Moria-strijder', baraddur: 'Uruk-hai Kliever', minastirith: 'Torenwacht' }
  },
  siege: {
    cost: 250, icon: '🗿',
    names: { rivendell: 'Ent-bewaker', erebor: 'IJzeren Stormram', baraddur: 'Bergtrol', minastirith: 'Belegeringsmachine' }
  }
};
const UNIT_ORDER = ['scout', 'infantry', 'siege'];

function factionMeta(key) { return FACTIONS.find((f) => f.key === key) || FACTIONS[0]; }
function factionIndex(key) { return FACTIONS.findIndex((f) => f.key === key); }
function cornerIndex(f) { return f * EDGE_LENGTH; }

function pathTileCoord(index) {
  const edge = Math.floor(index / EDGE_LENGTH), off = index % EDGE_LENGTH;
  if (edge === 0) return { gx: off, gy: 0 };
  if (edge === 1) return { gx: 12, gy: off };
  if (edge === 2) return { gx: 12 - off, gy: 12 };
  return { gx: 0, gy: 12 - off };
}
function tileRole(index) {
  const edge = Math.floor(index / EDGE_LENGTH), off = index % EDGE_LENGTH;
  if (off === 0) return { role: 'corner', faction: FACTIONS[edge].key };
  if (off === 2) return { role: 'start', faction: FACTIONS[edge].key };
  if (off === 5) return { role: 'defence' };
  if (off === 9) return { role: 'attack' };
  if (off === 11) return { role: 'entrance', faction: FACTIONS[(edge + 1) % 4].key };
  return { role: 'plain' };
}
function homeTileCoord(f, step) {
  const c = pathTileCoord(cornerIndex(f));
  const t = [0.25, 0.45, 0.65, 0.85][step];
  return { gx: c.gx + (CENTER.gx - c.gx) * t, gy: c.gy + (CENTER.gy - c.gy) * t };
}
function castleCoord(f) {
  const c = pathTileCoord(cornerIndex(f));
  return { gx: c.gx + (c.gx - CENTER.gx) * 0.55, gy: c.gy + (c.gy - CENTER.gy) * 0.55 };
}
function isoX(gx, gy) { return (gx - gy) * (TILE_W / 2); }
function isoY(gx, gy) { return (gx + gy) * (TILE_H / 2); }
function diamond(cx, cy, w, h) {
  return `${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`;
}
function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  return node;
}
function findUnit(game, unitId) {
  for (const p of game.players) { const u = p.units.find((x) => x.id === unitId); if (u) return { p, u }; }
  return null;
}

export function render({ game, state, els, E, action, titlebar, logBox, sound }) {
  const you = game.players.find((p) => p.isYou);
  const s = state.lutro || (state.lutro = { selectedUnitId: null, panel: null });
  if (s.selectedUnitId && !findUnit(game, s.selectedUnitId)) s.selectedUnitId = null;

  const canAct = you && !you.eliminated && !game.gameOver;
  if (!canAct) s.panel = null;

  const doAction = (name, payload) => { sound(name === 'roll' ? 'turn' : 'score'); action(name, payload); };

  const root = E('div', 'lutro-root');
  root.append(buildTopBar({ game, you, E, doAction }));
  root.append(buildBoard({ game, you, s, E }));
  if (you) root.append(buildStatusBar({ you, E }));
  root.append(buildTray({ game, you, s, canAct, E, doAction }));
  root.append(buildTicker({ game, E }));

  const status = game.gameOver
    ? (game.resultText || 'Het beleg is afgelopen.')
    : (you && you.eliminated ? 'Je kasteel is gevallen — kijk toe.' : 'Het beleg woedt voort.');
  els.gameStage.append(titlebar('Lutro', status), root);
}

/* ---------------- top bar ---------------- */

function elapsedLabel(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(total / 60), sec = total % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function buildTopBar({ game, you, E, doAction }) {
  const bar = E('div', 'lutro-topbar');
  bar.append(E('div', 'lutro-clock', `⏱ ${elapsedLabel(game.elapsedMs)}`));
  if (you) {
    bar.append(E('div', 'lutro-gold', `💰 ${you.gold}g`));
    const enemies = game.players.filter((p) => p.id !== you.id && !p.eliminated);
    const targetBtn = E('button', 'lutro-target');
    targetBtn.type = 'button';
    if (!enemies.length) {
      targetBtn.textContent = 'Geen doelwit';
      targetBtn.disabled = true;
    } else {
      const target = enemies.find((p) => p.faction === you.targetFaction) || enemies[0];
      const meta = factionMeta(target.faction);
      targetBtn.textContent = `🎯 ${meta.icon} ${meta.name}`;
      targetBtn.style.setProperty('--faction-color', meta.color);
      targetBtn.onclick = () => {
        const idx = enemies.findIndex((p) => p.faction === target.faction);
        const next = enemies[(idx + 1) % enemies.length];
        doAction('setTarget', { faction: next.faction });
      };
    }
    bar.append(targetBtn);
  }
  return bar;
}

/* ---------------- board ---------------- */

function buildBoard({ game, you, s, E }) {
  const wrap = E('div', 'lutro-board-wrap');

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const extend = (gx, gy, pad = 1) => {
    const x = isoX(gx, gy), y = isoY(gx, gy);
    minX = Math.min(minX, x - pad * TILE_W); maxX = Math.max(maxX, x + pad * TILE_W);
    minY = Math.min(minY, y - pad * TILE_H); maxY = Math.max(maxY, y + pad * TILE_H);
  };
  for (let i = 0; i < PATH_LENGTH; i += 1) { const c = pathTileCoord(i); extend(c.gx, c.gy, 0.6); }
  FACTIONS.forEach((f, idx) => {
    const cc = castleCoord(idx); extend(cc.gx, cc.gy, 1.6);
    for (let step = 0; step < HOME_STEPS; step += 1) { const h = homeTileCoord(idx, step); extend(h.gx, h.gy, 0.6); }
  });
  extend(CENTER.gx, CENTER.gy, 1.2);

  const pad = 14;
  const svg = svgEl('svg', { viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`, class: 'lutro-svg' });
  const landLayer = svgEl('g', { class: 'lutro-land' });
  const homeLayer = svgEl('g', { class: 'lutro-home' });
  const castleLayer = svgEl('g', { class: 'lutro-castles' });
  const unitLayer = svgEl('g', { class: 'lutro-units' });
  svg.append(landLayer, homeLayer, castleLayer, unitLayer);

  // Siege square
  const sc = { x: isoX(CENTER.gx, CENTER.gy), y: isoY(CENTER.gx, CENTER.gy) };
  landLayer.append(svgEl('polygon', { points: diamond(sc.x, sc.y, TILE_W * 1.5, TILE_H * 1.5), class: 'lutro-siege-tile' }));
  const siegeLabel = svgEl('text', { x: sc.x, y: sc.y + 3, 'text-anchor': 'middle', class: 'lutro-siege-label' });
  siegeLabel.textContent = '⚔️';
  landLayer.append(siegeLabel);

  // Home stretches
  FACTIONS.forEach((f, idx) => {
    for (let step = 0; step < HOME_STEPS; step += 1) {
      const h = homeTileCoord(idx, step);
      const x = isoX(h.gx, h.gy), y = isoY(h.gx, h.gy);
      const poly = svgEl('polygon', { points: diamond(x, y, TILE_W * 0.85, TILE_H * 0.85), class: 'lutro-home-tile' });
      poly.style.setProperty('--faction-color', f.color);
      homeLayer.append(poly);
    }
  });

  // Main path
  for (let i = 0; i < PATH_LENGTH; i += 1) {
    const c = pathTileCoord(i);
    const x = isoX(c.gx, c.gy), y = isoY(c.gx, c.gy);
    const info = tileRole(i);
    const poly = svgEl('polygon', { points: diamond(x, y, TILE_W, TILE_H), class: `lutro-tile lutro-tile-${info.role}` });
    if (info.faction) poly.style.setProperty('--faction-color', factionMeta(info.faction).color);
    landLayer.append(poly);
    if (info.role === 'defence' || info.role === 'attack') {
      const glyph = svgEl('text', { x, y: y + 3, 'text-anchor': 'middle', class: 'lutro-tile-glyph' });
      glyph.textContent = info.role === 'defence' ? '🛡' : '🎯';
      landLayer.append(glyph);
    }
  }

  // Castles
  FACTIONS.forEach((f, idx) => {
    const p = game.players.find((pl) => pl.faction === f.key);
    const cc = castleCoord(idx);
    const x = isoX(cc.gx, cc.gy), y = isoY(cc.gx, cc.gy);
    const group = svgEl('g', { class: `lutro-castle${p && p.eliminated ? ' fallen' : ''}` });
    group.style.setProperty('--faction-color', f.color);
    group.style.setProperty('--faction-dark', f.dark);

    const towerW = TILE_W * 1.4, towerH = TILE_H * 2.6;
    group.append(svgEl('polygon', { points: diamond(x, y, towerW, towerH * 0.55), class: 'lutro-castle-base' }));
    const tower = svgEl('polygon', { points: `${x - towerW * 0.28},${y} ${x + towerW * 0.28},${y} ${x + towerW * 0.2},${y - towerH} ${x - towerW * 0.2},${y - towerH}`, class: 'lutro-castle-tower' });
    group.append(tower);
    const flag = svgEl('text', { x, y: y - towerH - 6, 'text-anchor': 'middle', class: 'lutro-castle-flag' });
    flag.textContent = f.icon;
    group.append(flag);

    if (p) {
      const hpPct = Math.max(0, p.castleHp / p.castleMaxHp);
      const barW = towerW * 1.1;
      group.append(svgEl('rect', { x: x - barW / 2, y: y - towerH - 20, width: barW, height: 5, class: 'lutro-hp-back' }));
      group.append(svgEl('rect', { x: x - barW / 2, y: y - towerH - 20, width: Math.max(0, barW * hpPct), height: 5, class: 'lutro-hp-fill' }));
      const tierLabel = svgEl('text', { x, y: y - towerH - 26, 'text-anchor': 'middle', class: 'lutro-tier-label' });
      tierLabel.textContent = '★'.repeat(p.turretTier) + '☆'.repeat(3 - p.turretTier);
      group.append(tierLabel);
      const nameLabel = svgEl('text', { x, y: y + towerH * 0.55 + 14, 'text-anchor': 'middle', class: 'lutro-castle-name' });
      nameLabel.textContent = `${f.name}${p.isNpc ? ' 🤖' : ''}`;
      group.append(nameLabel);
    }
    castleLayer.append(group);
  });

  // Units, grouped by occupied tile so stacks fan out
  const stacks = new Map();
  game.players.forEach((p) => {
    p.units.forEach((u) => {
      const coord = u.zone === 'home' ? homeTileCoord(factionIndex(p.faction), u.homeStep) : pathTileCoord(u.pos);
      const key = `${coord.gx.toFixed(2)},${coord.gy.toFixed(2)}`;
      if (!stacks.has(key)) stacks.set(key, { coord, list: [] });
      stacks.get(key).list.push({ p, u });
    });
  });
  stacks.forEach(({ coord, list }) => {
    const baseX = isoX(coord.gx, coord.gy), baseY = isoY(coord.gx, coord.gy);
    list.forEach((entry, i) => {
      const offset = (i - (list.length - 1) / 2) * 11;
      unitLayer.append(buildUnitToken({ ...entry, x: baseX + offset, y: baseY - 4, s, you }));
    });
  });

  wrap.append(svg);
  return wrap;
}

function buildUnitToken({ p, u, x, y, s, you }) {
  const meta = factionMeta(p.faction);
  const g = svgEl('g', { class: `lutro-unit${s.selectedUnitId === u.id ? ' selected' : ''}${p.isYou ? ' mine' : ''}` });
  g.style.setProperty('--faction-color', meta.color);
  g.style.cursor = 'pointer';
  const r = 8;
  if (u.shielded) g.append(svgEl('circle', { cx: x, cy: y, r: r + 4, class: 'lutro-unit-shield' }));
  g.append(svgEl('circle', { cx: x, cy: y, r, class: 'lutro-unit-body' }));
  const hpPct = Math.max(0, u.hp / u.maxHp);
  const circumference = 2 * Math.PI * (r + 1.5);
  const ring = svgEl('circle', {
    cx: x, cy: y, r: r + 1.5, class: 'lutro-unit-hp',
    'stroke-dasharray': `${circumference * hpPct} ${circumference}`
  });
  g.append(ring);
  const glyph = svgEl('text', { x, y: y + 3, 'text-anchor': 'middle', class: 'lutro-unit-glyph' });
  glyph.textContent = UNIT_META[u.cls].icon;
  g.append(glyph);
  g.addEventListener('click', () => {
    if (you && p.id === you.id) s.selectedUnitId = s.selectedUnitId === u.id ? null : u.id;
  });
  return g;
}

/* ---------------- status bar ---------------- */

function buildStatusBar({ you, E }) {
  const meta = factionMeta(you.faction);
  const bar = E('div', 'lutro-statusbar');
  bar.style.setProperty('--faction-color', meta.color);
  bar.append(E('span', 'lutro-status-icon', meta.icon));
  bar.append(E('span', 'lutro-status-name', `${meta.name} · ${meta.turretName} Lv${you.turretTier}`));
  const hpWrap = E('div', 'lutro-status-hp');
  const hpFill = E('div', 'lutro-status-hp-fill');
  hpFill.style.width = `${Math.max(0, Math.min(100, (you.castleHp / you.castleMaxHp) * 100))}%`;
  hpWrap.append(hpFill);
  bar.append(hpWrap, E('span', 'lutro-status-hp-text', `${Math.max(0, Math.round(you.castleHp))}/${you.castleMaxHp}`));
  return bar;
}

/* ---------------- bottom action tray ---------------- */

function buildTray({ game, you, s, canAct, E, doAction }) {
  const tray = E('div', 'lutro-tray');
  if (!you) { tray.append(E('div', 'lutro-tray-hint', 'Toeschouwer.')); return tray; }
  if (!canAct) {
    tray.append(E('div', 'lutro-tray-hint', you.eliminated ? 'Je kasteel is gevallen.' : (game.resultText || 'Beleg afgelopen.')));
    return tray;
  }

  const now = Date.now();
  const cooling = !you.rollPending && now < you.nextRollAt;
  const grid = E('div', 'lutro-actions');

  // ACTIE 1 — troepen plaatsen
  const btn1 = E('button', 'lutro-actbtn');
  btn1.type = 'button';
  btn1.disabled = cooling;
  if (you.rollPending) {
    btn1.append(E('span', 'lutro-actbtn-icon', '🎲'), E('span', 'lutro-actbtn-label', `Worp: ${you.lastRoll}`));
    btn1.disabled = you.lastRoll !== 6;
  } else {
    btn1.append(E('span', 'lutro-actbtn-icon', '🎲'), E('span', 'lutro-actbtn-label', 'Worp'));
  }
  btn1.onclick = () => {
    if (!you.rollPending) { doAction('roll'); return; }
    s.panel = s.panel === 'deploy' ? null : 'deploy';
  };
  grid.append(btn1);

  // ACTIE 2 — versterk kasteel
  const btn2 = E('button', 'lutro-actbtn');
  btn2.type = 'button';
  btn2.append(E('span', 'lutro-actbtn-icon', '🏰'), E('span', 'lutro-actbtn-label', 'Versterk'));
  btn2.onclick = () => { s.panel = s.panel === 'reinforce' ? null : 'reinforce'; };
  grid.append(btn2);

  // ACTIE 3 — verplaats troepen
  const btn3 = E('button', 'lutro-actbtn');
  btn3.type = 'button';
  btn3.disabled = !you.rollPending;
  btn3.append(E('span', 'lutro-actbtn-icon', '🏃'), E('span', 'lutro-actbtn-label', you.rollPending ? `Verplaats ${you.lastRoll}` : 'Verplaats'));
  btn3.onclick = () => { doAction('move', { unitId: s.selectedUnitId || 0 }); };
  grid.append(btn3);

  // ACTIE 4 — actie troepen (contextual)
  const selected = s.selectedUnitId ? you.units.find((u) => u.id === s.selectedUnitId) : null;
  const role = selected && selected.zone === 'path' ? tileRole(selected.pos).role : null;
  const btn4 = E('button', 'lutro-actbtn');
  btn4.type = 'button';
  const label4 = role === 'defence' ? 'Schild' : role === 'attack' ? 'Belegeren' : 'Actie';
  btn4.append(E('span', 'lutro-actbtn-icon', role === 'defence' ? '🛡' : role === 'attack' ? '🎯' : '✋'), E('span', 'lutro-actbtn-label', label4));
  btn4.disabled = !selected || (role !== 'defence' && role !== 'attack');
  btn4.onclick = () => { if (selected) doAction('tileAction', { unitId: selected.id }); };
  grid.append(btn4);

  tray.append(grid);

  if (s.panel === 'deploy' && you.rollPending && you.lastRoll === 6) {
    tray.append(buildDeployPanel({ you, E, doAction }));
  } else if (s.panel === 'reinforce') {
    tray.append(buildReinforcePanel({ you, E, doAction }));
  } else if (!you.rollPending) {
    const secsLeft = Math.max(0, Math.ceil((you.nextRollAt - now) / 1000));
    tray.append(E('div', 'lutro-tray-hint', secsLeft > 0 ? `Volgende worp over ${secsLeft}s.` : 'Klaar om te rollen.'));
  } else if (you.lastRoll !== 6) {
    tray.append(E('div', 'lutro-tray-hint', 'Tik een eenheid aan en verplaats haar met deze worp.'));
  }

  return tray;
}

function buildDeployPanel({ you, E, doAction }) {
  const panel = E('div', 'lutro-panel');
  UNIT_ORDER.forEach((cls) => {
    const meta = UNIT_META[cls];
    const btn = E('button', 'lutro-panel-btn');
    btn.type = 'button';
    btn.disabled = you.gold < meta.cost;
    btn.append(
      E('span', 'lutro-panel-icon', meta.icon),
      E('span', 'lutro-panel-name', meta.names[you.faction]),
      E('span', 'lutro-panel-cost', `${meta.cost}g`)
    );
    btn.onclick = () => doAction('deploy', { cls });
    panel.append(btn);
  });
  return panel;
}

function buildReinforcePanel({ you, E, doAction }) {
  const panel = E('div', 'lutro-panel');
  const repair = E('button', 'lutro-panel-btn');
  repair.type = 'button';
  repair.disabled = you.gold < 200 || you.castleHp >= you.castleMaxHp;
  repair.append(E('span', 'lutro-panel-icon', '🧱'), E('span', 'lutro-panel-name', 'Herstel +250 HP'), E('span', 'lutro-panel-cost', '200g'));
  repair.onclick = () => doAction('repair');
  panel.append(repair);

  const upgrade = E('button', 'lutro-panel-btn');
  upgrade.type = 'button';
  upgrade.disabled = you.gold < 150 || you.turretTier >= 3;
  upgrade.append(E('span', 'lutro-panel-icon', '🔧'), E('span', 'lutro-panel-name', 'Toren upgraden'), E('span', 'lutro-panel-cost', '150g'));
  upgrade.onclick = () => doAction('upgradeTurret');
  panel.append(upgrade);
  return panel;
}

/* ---------------- event ticker ---------------- */

function buildTicker({ game, E }) {
  const wrap = E('div', 'lutro-ticker');
  wrap.textContent = (game.log && game.log[game.log.length - 1]) || 'Het beleg begint...';
  return wrap;
}

/* ---------------- lobby / leaderboard helpers ---------------- */

export function metric({ game, player }) {
  const p = game.players.find((pl) => pl.id === player.id);
  return { text: p ? `${Math.max(0, Math.round(p.castleHp))} HP` : '', score: p ? Math.round(p.castleHp) : 0 };
}
export function isWinner({ game, myId }) { return game.winnerId === myId; }
export function presentResult({ game }) { return game.resultText; }
