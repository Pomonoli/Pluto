export const playerStrip = true;

const RANGE = 3.5;
const CAMP_RANGE = 5;
const PLAYER_COLORS = ['#C4611F', '#4E8FA0', '#6C8F56', '#75593A'];
const RARITY_LABEL = { common: 'gewoon', uncommon: 'ongewoon', rare: 'zeldzaam', legendary: 'legendarisch', wildlife: 'wild' };

let state, els, E, action, sound, titlebar, logBox, renderGame;
function bind(api) { ({ state, els, E, action, sound, titlebar, logBox, renderGame } = api); }

function ui() { state.blue = state.blue || { panel: null, drinkPicker: false }; return state.blue; }

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function landRadiusAt(shape, angle) {
  let r = shape.base;
  shape.harmonics.forEach((h) => { r += h.amp * Math.cos(h.freq * angle + h.phase); });
  return r;
}

function ringPath(center, radiusFn, steps = 64) {
  let d = '';
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const r = radiusFn(a);
    const x = center.x + Math.cos(a) * r;
    const y = center.y + Math.sin(a) * r;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function fmtClock(min) { const h = Math.floor(min / 60) % 24; const m = Math.floor(min % 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
function isFoodItem(itemId) { return itemId.startsWith('vis_') || ['vlees', 'geroosterde_vis', 'geroosterd_vlees', 'vissoep', 'stoofpot'].includes(itemId); }
function costLabel(cost, itemMeta) { return Object.entries(cost).map(([k, v]) => `${v}× ${itemMeta[k]?.label || k}`).join(', '); }
function canAfford(inventory, cost) { return Object.entries(cost).every(([k, v]) => (inventory[k] || 0) >= v); }
function refresh(room) { renderGame(room); }

/* ---------------- map ---------------- */

function nodeShape(node) {
  const g = svgEl('g', { transform: `translate(${node.x} ${node.y})` });
  if (node.type === 'boom') {
    g.append(svgEl('ellipse', { cx: 0, cy: 0.9, rx: 1.1, ry: 0.35, class: 'blue-shadow' }));
    g.append(svgEl('rect', { x: -0.18, y: -0.1, width: 0.36, height: 1, fill: 'var(--tb-bark2)' }));
    g.append(svgEl('path', { d: 'M0,-2.3 L1.1,-0.2 L-1.1,-0.2 Z', fill: 'var(--tb-pine)' }));
    g.append(svgEl('path', { d: 'M0,-1.5 L0.85,0.1 L-0.85,0.1 Z', fill: 'var(--tb-pine-dark)' }));
  } else if (node.type === 'rots') {
    g.append(svgEl('ellipse', { cx: 0, cy: 0.55, rx: 1, ry: 0.3, class: 'blue-shadow' }));
    g.append(svgEl('path', { d: 'M-1,0.4 L-0.7,-0.6 L0.2,-1 L1,-0.3 L0.7,0.5 Z', fill: 'var(--tb-stone)' }));
    g.append(svgEl('path', { d: 'M-0.7,-0.6 L0.2,-1 L0.3,-0.4 L-0.4,-0.1 Z', fill: 'var(--tb-mist)' }));
  } else if (node.type === 'erts') {
    g.append(svgEl('ellipse', { cx: 0, cy: 0.55, rx: 1, ry: 0.3, class: 'blue-shadow' }));
    g.append(svgEl('path', { d: 'M-1,0.4 L-0.7,-0.6 L0.2,-1 L1,-0.3 L0.7,0.5 Z', fill: 'var(--tb-iron)' }));
    g.append(svgEl('circle', { cx: 0.1, cy: -0.3, r: 0.22, fill: 'var(--tb-ember-lit)' }));
  } else {
    g.append(svgEl('ellipse', { cx: 0, cy: 0.45, rx: 0.7, ry: 0.22, class: 'blue-shadow' }));
    g.append(svgEl('circle', { cx: 0, cy: 0, r: 0.65, fill: 'var(--tb-meadow2)' }));
    g.append(svgEl('circle', { cx: -0.2, cy: -0.1, r: 0.1, fill: 'var(--tb-blood)' }));
    g.append(svgEl('circle', { cx: 0.25, cy: 0.1, r: 0.1, fill: 'var(--tb-blood)' }));
  }
  return g;
}

function campShape(camp) {
  const g = svgEl('g', { transform: `translate(${camp.x} ${camp.y})`, class: 'blue-camp' });
  // Invisible hit-area: the hut and fire art don't cover the icon's own
  // anchor point (where the player also spawns), so a tap there would
  // otherwise fall through to the map instead of opening the camp panel.
  g.append(svgEl('circle', { cx: 0, cy: 0, r: 2.2, fill: 'transparent' }));
  g.append(svgEl('ellipse', { cx: 0, cy: 1.4, rx: 2.6, ry: 0.7, class: 'blue-shadow' }));
  g.append(svgEl('path', { d: 'M-2,1.1 L-1.6,-0.6 L-0.4,-1 L-0.1,1.1 Z', fill: 'var(--tb-bark)' }));
  g.append(svgEl('path', { d: 'M-1.9,-0.55 L-1,-1.5 L-0.1,-0.6 Z', fill: 'var(--tb-pine-dark)' }));
  g.append(svgEl('circle', { cx: 1.2, cy: 0.9, r: 0.55, fill: 'var(--tb-ember)' }));
  g.append(svgEl('path', { d: 'M1.2,0.55 q0.3,-0.5 0,-0.8 q-0.35,0.35 0,0.8 Z', fill: 'var(--tb-ember-lit)' }));
  return g;
}

function playerShape(p, index, isMe) {
  const g = svgEl('g', { transform: `translate(${p.x} ${p.y})`, class: `blue-player ${isMe ? 'me' : ''} ${p.connected ? '' : 'offline'}` });
  g.append(svgEl('ellipse', { cx: 0, cy: 0.55, rx: 0.6, ry: 0.2, class: 'blue-shadow' }));
  g.append(svgEl('circle', { cx: 0, cy: 0, r: 0.62, fill: PLAYER_COLORS[index % PLAYER_COLORS.length], stroke: 'var(--tb-ink)', 'stroke-width': 0.08 }));
  const label = svgEl('text', { x: 0, y: 0.22, class: 'blue-player-mark' });
  label.textContent = (p.name || '?').slice(0, 1).toUpperCase();
  g.append(label);
  const name = svgEl('text', { x: 0, y: -0.95, class: 'blue-player-name' });
  name.textContent = p.name;
  g.append(name);
  if (p.hp < p.maxHp) {
    g.append(svgEl('rect', { x: -0.6, y: -0.8, width: 1.2, height: 0.14, fill: 'rgba(36,51,44,.25)' }));
    g.append(svgEl('rect', { x: -0.6, y: -0.8, width: Math.max(0, 1.2 * (p.hp / p.maxHp)), height: 0.14, fill: 'var(--tb-blood)' }));
  }
  return g;
}

function wildlifeShape(w) {
  const g = svgEl('g', { transform: `translate(${w.x} ${w.y})`, class: `blue-wildlife ${w.engagedBy ? 'engaged' : ''}` });
  const body = w.species === 'wolf' ? 'var(--tb-iron)' : 'var(--tb-bark2)';
  g.append(svgEl('ellipse', { cx: 0, cy: 0.6, rx: 0.95, ry: 0.28, class: 'blue-shadow' }));
  g.append(svgEl('ellipse', { cx: 0, cy: 0.1, rx: 0.85, ry: 0.5, fill: body }));
  g.append(svgEl('path', { d: 'M0.7,-0.15 L1.15,-0.35 L0.85,0.15 Z', fill: body }));
  if (w.hp < w.maxHp) {
    g.append(svgEl('rect', { x: -0.7, y: -0.85, width: 1.4, height: 0.14, fill: 'rgba(36,51,44,.25)' }));
    g.append(svgEl('rect', { x: -0.7, y: -0.85, width: Math.max(0, 1.4 * (w.hp / w.maxHp)), height: 0.14, fill: 'var(--tb-blood)' }));
  }
  return g;
}

function fishSpotShape(spot) {
  const g = svgEl('g', { transform: `translate(${spot.x} ${spot.y})`, class: 'blue-fishspot' });
  // Invisible but painted hit-area: the ripple rings below are stroke-only
  // (fill:none) and would otherwise let clicks fall through to the map.
  g.append(svgEl('circle', { cx: 0, cy: 0, r: 1.3, fill: 'transparent' }));
  g.append(svgEl('circle', { cx: 0, cy: 0, r: 0.9, class: 'blue-ripple blue-ripple-a' }));
  g.append(svgEl('circle', { cx: 0, cy: 0, r: 0.5, class: 'blue-ripple blue-ripple-b' }));
  return g;
}

function renderMap(room, game, me) {
  const wrap = E('div', 'blue-map-wrap');
  const size = game.world.size;
  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, class: 'blue-map', role: 'img', 'aria-label': 'Het eiland' });
  const shape = game.world.shape;
  const center = { x: size / 2, y: size / 2 };
  const outerDeep = (a) => landRadiusAt(shape, a) + game.world.shallowBand + game.world.deepBand;
  const outerShallow = (a) => landRadiusAt(shape, a) + game.world.shallowBand;
  const outerSand = (a) => landRadiusAt(shape, a);
  const outerLand = (a) => landRadiusAt(shape, a) * 0.9;

  svg.append(svgEl('rect', { x: 0, y: 0, width: size, height: size, fill: 'var(--tb-abyss)' }));
  svg.append(svgEl('path', { d: ringPath(center, outerDeep), fill: 'var(--tb-sea-deep)' }));
  svg.append(svgEl('path', { d: ringPath(center, outerShallow), fill: 'var(--tb-shallow)' }));
  svg.append(svgEl('path', { d: ringPath(center, outerSand), fill: 'var(--tb-bark)' }));
  svg.append(svgEl('path', { d: ringPath(center, outerLand), fill: 'var(--tb-meadow)' }));

  game.fishSpots.forEach((spot) => {
    const near = me ? dist(me, spot) <= RANGE : false;
    const g = fishSpotShape(spot);
    g.classList.toggle('in-range', near);
    g.addEventListener('pointerdown', (evt) => { evt.stopPropagation(); action('castLine', { spotId: spot.id }); });
    svg.append(g);
  });

  svg.append(campShape(game.world.camp));
  const campGroup = svg.lastChild;
  campGroup.classList.toggle('in-range', me ? dist(me, game.world.camp) <= CAMP_RANGE : false);
  campGroup.addEventListener('pointerdown', (evt) => { evt.stopPropagation(); ui().panel = ui().panel === 'camp' ? null : 'camp'; refresh(room); });

  game.nodes.forEach((node) => {
    const g = nodeShape(node);
    g.classList.add('blue-node');
    if (!node.available) g.classList.add('depleted');
    if (me && dist(me, node) <= RANGE) g.classList.add('in-range');
    g.addEventListener('pointerdown', (evt) => { evt.stopPropagation(); if (node.available) action('gather', { nodeId: node.id }); });
    svg.append(g);
  });

  game.wildlife.forEach((w) => {
    if (!w.alive) return;
    const g = wildlifeShape(w);
    if (me && dist(me, w) <= RANGE) g.classList.add('in-range');
    g.addEventListener('pointerdown', (evt) => { evt.stopPropagation(); action('attack', { enemyId: w.id }); });
    svg.append(g);
  });

  game.players.forEach((p, index) => svg.append(playerShape(p, index, p.id === room.meId)));

  if (game.isNight) svg.append(svgEl('rect', { x: 0, y: 0, width: size, height: size, fill: 'var(--tb-abyss)', opacity: 0.32, style: 'pointer-events:none' }));

  svg.addEventListener('pointerdown', (evt) => {
    const r = svg.getBoundingClientRect();
    const x = ((evt.clientX - r.left) / r.width) * size;
    const y = ((evt.clientY - r.top) / r.height) * size;
    action('move', { x, y });
  });

  wrap.append(svg);
  return wrap;
}

/* ---------------- HUD ---------------- */

function renderStatusBar(room, game, me) {
  const bar = E('div', 'blue-status');
  bar.append(E('span', 'blue-clock', `${game.isNight ? '🌙' : '☀️'} ${fmtClock(game.clockMin)}`));
  if (me) {
    const energyWrap = E('span', 'blue-meter');
    energyWrap.append(E('small', '', 'Energie'));
    const track = E('span', 'blue-meter-track');
    const fill = E('span', 'blue-meter-fill'); fill.style.width = `${Math.round((me.energy / me.maxEnergy) * 100)}%`; fill.style.background = 'var(--tb-ember)';
    track.append(fill); energyWrap.append(track);
    bar.append(energyWrap);
    bar.append(E('span', 'blue-chip', `📖 ${Object.keys(me.codex || {}).length}/${game.codexTotal}`));
    bar.append(E('span', 'blue-chip', me.hasRaft ? '🛶 Vlot' : '🛶 Geen vlot'));
  }
  if (me?.isHost) {
    const end = E('button', 'blue-btn blue-btn-ghost', 'Beëindig expeditie');
    end.onclick = () => { if (confirm('Expeditie beëindigen voor iedereen?')) action('endExpedition'); };
    bar.append(end);
  }
  return bar;
}

function renderTabs(room, game, me) {
  const row = E('div', 'blue-tabs');
  [['inventory', 'Inventaris'], ['codex', 'Codex'], ['camp', 'Kamp']].forEach(([key, label]) => {
    const btn = E('button', `blue-btn ${ui().panel === key ? 'active' : ''}`, label);
    btn.onclick = () => { ui().panel = ui().panel === key ? null : key; refresh(room); };
    row.append(btn);
  });
  return row;
}

/* ---------------- panels ---------------- */

function renderInventory(game, me) {
  const box = E('div', 'blue-panel');
  box.append(E('h3', '', 'Inventaris'));
  const entries = Object.entries(me.inventory || {});
  if (!entries.length) box.append(E('p', 'blue-muted', 'Nog niets verzameld.'));
  const list = E('div', 'blue-item-list');
  entries.forEach(([itemId, qty]) => {
    const row = E('div', 'blue-item-row');
    const label = itemId.startsWith('vis_') ? (game.itemMeta[itemId] ? game.itemMeta[itemId].label : itemId.slice(4)) : (game.itemMeta[itemId]?.label || itemId);
    row.append(E('span', '', `${label}`), E('b', '', `×${qty}`));
    if (isFoodItem(itemId)) {
      const eat = E('button', 'blue-btn blue-btn-small', 'Eten');
      eat.onclick = () => action('eat', { itemId });
      row.append(eat);
    }
    list.append(row);
  });
  box.append(list);
  box.append(equipmentBlock(game, me));
  return box;
}

function equipmentBlock(game, me) {
  const wrap = E('div', 'blue-equipment');
  wrap.append(E('h4', '', 'Uitrusting'));
  const rows = E('div', 'blue-item-list');
  [['axe', 'Bijl'], ['pickaxe', 'Houweel'], ['rod', 'Hengel'], ['weapon', 'Wapen'], ['armor', 'Schild']].forEach(([slot, label]) => {
    const tool = me.tools[slot];
    const tier = game.tiers[tool.tier];
    const row = E('div', 'blue-item-row');
    row.append(E('span', '', `${label}: ${tier.label}`));
    if (tool.maxDurability > 0) {
      row.append(E('span', 'blue-muted', `${tool.durability}/${tool.maxDurability}`));
      if (tool.durability < tool.maxDurability) {
        const repair = E('button', 'blue-btn blue-btn-small', 'Repareer');
        repair.onclick = () => action('repair', { slot });
        row.append(repair);
      }
    }
    rows.append(row);
  });
  wrap.append(rows);
  return wrap;
}

function renderCodex(game, me) {
  const box = E('div', 'blue-panel');
  box.append(E('h3', '', `Codex — ${Object.keys(me.codex || {}).length}/${game.codexTotal}`));
  const grid = E('div', 'blue-codex-grid');
  Object.entries(me.codexInfo || {}).forEach(([id, info]) => {
    const card = E('div', `blue-codex-card ${info.discovered ? '' : 'hidden-species'}`);
    if (info.discovered) {
      card.append(E('strong', '', info.name), E('small', '', RARITY_LABEL[info.rarity] || info.rarity), E('p', '', info.flavor));
    } else {
      card.append(E('strong', '', '???'), E('small', '', '—'));
    }
    grid.append(card);
  });
  box.append(grid);
  return box;
}

function recipeButton(recipeKey, recipe, game, me, disabledReason) {
  const row = E('div', 'blue-item-row');
  row.append(E('span', '', recipe.label), E('small', 'blue-muted', costLabel(recipe.cost, game.itemMeta)));
  const btn = E('button', 'blue-btn blue-btn-small', 'Maak');
  const affordable = canAfford(me.inventory, recipe.cost);
  if (!affordable || disabledReason) { btn.disabled = true; btn.title = disabledReason || 'Niet genoeg materiaal.'; }
  btn.onclick = () => action('craft', { recipeKey });
  row.append(btn);
  return row;
}

function renderCamp(game, me) {
  const box = E('div', 'blue-panel');
  box.append(E('h3', '', 'Kamp'));
  box.append(E('p', 'blue-muted', `Kookvuur: ${game.camp.hasKookvuur ? 'gebouwd' : 'niet gebouwd'} · Smidse: ${game.camp.hasSmidse ? 'gebouwd' : 'niet gebouwd'} · Vlot: ${me.hasRaft ? 'gebouwd' : 'niet gebouwd'}`));

  box.append(E('h4', '', 'Kampvuur — roosteren'));
  const roastList = E('div', 'blue-item-list');
  Object.entries(game.recipes.roast).forEach(([key, recipe]) => {
    const row = E('div', 'blue-item-row');
    row.append(E('span', '', recipe.label));
    const btn = E('button', 'blue-btn blue-btn-small', 'Start');
    if (me.cook) btn.disabled = true;
    btn.onclick = () => action('cook', { station: 'kampvuur', recipeKey: key });
    row.append(btn);
    roastList.append(row);
  });
  box.append(roastList);

  box.append(E('h4', '', 'Kookvuur — gerechten'));
  if (!game.camp.hasKookvuur) box.append(recipeButton('kookvuur', game.recipes.craft.kookvuur, game, me));
  else {
    const cookList = E('div', 'blue-item-list');
    Object.entries(game.recipes.cook).forEach(([key, recipe]) => {
      const row = E('div', 'blue-item-row');
      row.append(E('span', '', recipe.label), E('small', 'blue-muted', costLabel(recipe.inputs, game.itemMeta)));
      const btn = E('button', 'blue-btn blue-btn-small', 'Start');
      if (me.cook) btn.disabled = true;
      btn.onclick = () => action('cook', { station: 'kookvuur', recipeKey: key });
      row.append(btn);
      cookList.append(row);
    });
    box.append(cookList);
  }
  if (me.cook) box.append(E('p', 'blue-muted', `Klaar over enkele ogenblikken: ${game.itemMeta[me.cook.output]?.label || me.cook.output}…`));

  box.append(E('h4', '', 'Werkbank — maken'));
  const bench = E('div', 'blue-item-list');
  Object.entries(game.recipes.craft).filter(([, r]) => r.station === 'werkbank').forEach(([key, recipe]) => bench.append(recipeButton(key, recipe, game, me)));
  box.append(bench);

  box.append(E('h4', '', 'Smidse — brons'));
  if (!game.camp.hasSmidse) box.append(E('p', 'blue-muted', 'Nog geen smidse. Bouw er een bij de werkbank.'));
  else {
    const forge = E('div', 'blue-item-list');
    Object.entries(game.recipes.craft).filter(([, r]) => r.station === 'smidse').forEach(([key, recipe]) => forge.append(recipeButton(key, recipe, game, me)));
    box.append(forge);
  }
  return box;
}

/* ---------------- fishing & combat ---------------- */

function renderFishing(room, me) {
  const box = E('div', 'blue-context blue-fishing');
  if (me.fishing.state === 'waiting') box.append(E('p', '', 'De lijn ligt uit. Wachten op een beet…'));
  else box.append(E('p', 'blue-bite', 'Beet! Haal binnen!'));
  const btn = E('button', `blue-btn ${me.fishing.state === 'biting' ? 'blue-btn-primary blue-pulse' : ''}`, 'Haal binnen');
  btn.onclick = () => action('reel');
  box.append(btn);
  return box;
}

function renderCombat(room, game, me) {
  const enemy = game.wildlife.find((w) => w.id === me.combat.enemyId);
  const box = E('div', 'blue-context blue-combat');
  box.append(E('h4', '', enemy ? `Gevecht met ${enemy.name}` : 'Gevecht'));
  if (enemy) {
    const track = E('div', 'blue-meter-track blue-combat-hp');
    const fill = E('span', 'blue-meter-fill'); fill.style.width = `${Math.round((enemy.hp / enemy.maxHp) * 100)}%`; fill.style.background = 'var(--tb-blood)';
    track.append(fill);
    box.append(track);
  }
  const actionsRow = E('div', 'blue-combat-actions');
  const attack = E('button', 'blue-btn blue-btn-primary', 'Aanvallen');
  attack.onclick = () => action('combatAct', { move: 'attack' });
  const defend = E('button', 'blue-btn', 'Verdedigen');
  defend.onclick = () => action('combatAct', { move: 'defend' });
  const drink = E('button', 'blue-btn', 'Eten/drinken');
  drink.onclick = () => { ui().drinkPicker = !ui().drinkPicker; refresh(room); };
  const flee = E('button', 'blue-btn blue-btn-ghost', 'Vluchten');
  flee.onclick = () => action('combatAct', { move: 'flee' });
  actionsRow.append(attack, defend, drink, flee);
  box.append(actionsRow);

  if (ui().drinkPicker) {
    const picker = E('div', 'blue-item-list');
    const foods = Object.entries(me.inventory || {}).filter(([id]) => isFoodItem(id));
    if (!foods.length) picker.append(E('p', 'blue-muted', 'Niets te eten of drinken.'));
    foods.forEach(([itemId, qty]) => {
      const row = E('div', 'blue-item-row');
      row.append(E('span', '', `${game.itemMeta[itemId]?.label || itemId} ×${qty}`));
      const use = E('button', 'blue-btn blue-btn-small', 'Gebruik');
      use.onclick = () => { ui().drinkPicker = false; action('combatAct', { move: 'drink', itemId }); };
      row.append(use);
      picker.append(row);
    });
    box.append(picker);
  }

  if (me.combat.log?.length) {
    const log = E('div', 'blue-combat-log');
    me.combat.log.forEach((line) => log.append(E('div', '', line)));
    box.append(log);
  }
  return box;
}

/* ---------------- root ---------------- */

function renderBlue(room, game) {
  const me = game.players.find((p) => p.id === room.meId);
  const root = E('div', 'blue-root');
  root.append(renderStatusBar(room, game, me));
  root.append(renderTabs(room, game, me));
  if (me?.fishing) root.append(renderFishing(room, me));
  if (me?.combat) root.append(renderCombat(room, game, me));
  root.append(renderMap(room, game, me));
  const panel = ui().panel;
  if (panel === 'inventory' && me) root.append(renderInventory(game, me));
  else if (panel === 'codex' && me) root.append(renderCodex(game, me));
  else if (panel === 'camp' && me) root.append(renderCamp(game, me));
  root.append(logBox(game.log));
  els.gameStage.append(root);
}

export function render(api) { bind(api); renderBlue(api.room, api.game); }
export function onRoomReset() { if (state) state.blue = null; }
export function metric({ player }) { return { text: `${Math.round(player.hp)} hp`, score: null }; }
