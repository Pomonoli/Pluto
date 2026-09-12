import {
  createBattle, ERA_NAMES, ERA_SHORT, ERA_ICON, ROLES, ROLE_LABEL, ROLE_ICON, ROLE_DEFS, UNIT_NAMES, HERO_NAMES, TURRET_NAMES, SPECIAL_NAMES,
  TURRET_TYPES, TURRET_LABEL, TURRET_ICON, TURRET_HINT, WALL_NAMES,
  MAX_LEVEL, MAX_TURRETS, MAX_QUEUE, MAX_WORKERS, W, H,
  unitCost, costWalls, costEconomy, costTurret, evolveXp, abilityCost, goldRate, mineRate, fmtNum, fmtTime
} from './engine.js';

// Behoud het canvas tussen serverupdates (zie game-ui.js: preserveStage).
export const preserveStage = true;

export const leaderboardConfig = { columns: [
  { key: 'rank', label: '#', short: '#', width: 'rank' },
  { key: 'username', label: 'Speler', short: 'Speler', width: 'player' },
  { key: 'wins', label: 'Overwinningen', short: 'W' },
  { key: 'bestEraName', label: 'Hoogste tijdperk', short: 'Tijdperk', width: 'wide' },
  { key: 'bestMs', label: 'Langste potje', short: 'Tijd', format: 'duration' }
] };

let live = null; // { matchId, battle, root, finish }
let openGroup = 'troops'; // Op mobiel staat één sectie tegelijk open; onthouden tussen renders.

// Sectiekop die op mobiel de rij eronder in- en uitklapt.
function section(E, key, title, row) {
  const group = E('div', `ks-group${openGroup === key ? ' ks-open' : ''}`);
  const head = E('button', 'ks-section');
  head.type = 'button';
  const label = E('span', 'ks-section-label', title);
  const info = E('span', 'ks-section-info', '');
  head.append(label, info, E('span', 'ks-section-chevron', '▾'));
  head.onclick = () => {
    const willOpen = !group.classList.contains('ks-open');
    for (const g of group.parentElement.querySelectorAll('.ks-group')) g.classList.remove('ks-open');
    if (willOpen) { group.classList.add('ks-open'); openGroup = key; } else openGroup = null;
  };
  group.append(head, row);
  return { group, label, info };
}

function stopLive() {
  if (live) { live.battle.stop(); window.removeEventListener('resize', live.fit); }
  live = null;
}

const MOBILE = '(max-width: 820px)';
// Op mobiel krijgt het veld een vaste hoogte: staand ingezoomd (horizontaal scrollen), liggend passend.
function fitField(field) {
  if (!window.matchMedia(MOBILE).matches) { field.style.height = ''; return; }
  const w = field.clientWidth, fit = w * H / W, landscape = window.innerWidth > window.innerHeight;
  let h = Math.min(Math.max(w * (landscape ? 0.55 : 0.9), 230), window.innerHeight * (landscape ? 0.82 : 0.6));
  if (h < fit) h = fit;
  field.style.height = `${Math.round(h)}px`;
}

function panelButton(E, cls, onClick) {
  const btn = E('button', `ks-btn${cls ? ` ${cls}` : ''}`);
  btn.type = 'button';
  const name = E('span', 'ks-btn-name', '');
  const hint = E('span', 'ks-btn-level', '');
  const cost = E('span', 'ks-btn-cost', '');
  btn.append(name, hint, cost);
  btn.onclick = onClick;
  return { btn, name, hint, cost };
}

function hpBar(E, cls, label) {
  const wrap = E('div', `ks-hp ${cls}`);
  const fill = E('div', 'ks-hp-fill');
  fill.style.width = '100%';
  const track = E('div', 'ks-hp-track');
  track.append(fill);
  const text = E('div', 'ks-hp-label', label);
  wrap.append(text, track);
  return { wrap, fill, text };
}

export function render({ game, els, E, action, titlebar }) {
  if (live && live.root.isConnected && live.matchId === game.matchId) {
    live.battle.setState(game.battle);
    if (game.gameOver) live.finish(game);
    return;
  }
  stopLive();
  els.gameStage.replaceChildren();

  const heading = titlebar('Castle Defense', game.gameOver ? game.resultText : `Duel tegen ${game.opponentName}. Vernietig de vijandelijke basis.`);
  els.gameStage.append(heading);

  if (game.gameOver) {
    // Geen lokale snapshot meer (bv. na herladen): toon enkel de uitkomst.
    const summary = E('div', 'ks-root ks-summary');
    summary.append(
      E('h3', 'ks-summary-title', game.won ? 'Overwinning!' : 'Basis gevallen'),
      renderResultDetails({ game, E }),
      E('p', 'ks-summary-copy', 'Start via de kamer een nieuw duel.')
    );
    els.gameStage.append(summary);
    return;
  }

  const root = E('div', 'ks-root');
  const field = E('div', 'ks-field');
  // Het canvas zit in een horizontaal scrollbare laag; de HUD-overlays blijven op het veld staan.
  const scroll = E('div', 'ks-scroll');
  const canvas = E('canvas', 'ks-canvas');
  canvas.width = W;
  canvas.height = H;
  scroll.append(canvas);
  field.append(scroll);

  const goldVal = E('span', '', '0');
  const rateVal = E('span', 'ks-badge-sub', '');
  const xpVal = E('span', '', '0');
  const timeVal = E('span', '', '00:00');
  const goldBadge = E('div', 'ks-badge');
  goldBadge.append(E('span', '', '🪙 '), goldVal, rateVal);
  const xpBadge = E('div', 'ks-badge ks-badge-xp');
  xpBadge.append(E('span', '', '✨ '), xpVal);
  const timeBadge = E('div', 'ks-badge');
  timeBadge.append(E('span', '', '⏱ '), timeVal);
  const topLeft = E('div', 'ks-overlay ks-top-left');
  topLeft.append(goldBadge, xpBadge, timeBadge);
  const eraBadge = E('div', 'ks-badge ks-era-badge', `${ERA_ICON[0]} ${ERA_NAMES[0]}`);
  const eraWrap = E('div', 'ks-overlay ks-era');
  eraWrap.append(eraBadge);
  const enemyEra = E('div', 'ks-badge ks-badge-small', '');
  const topRight = E('div', 'ks-overlay ks-top-right');
  topRight.append(enemyEra);
  const playerHp = hpBar(E, 'ks-hp-left', 'JOUW BASIS');
  const enemyHp = hpBar(E, 'ks-hp-right', game.opponentName);
  const queueWrap = E('div', 'ks-overlay ks-queue');
  const rotateHint = E('div', 'ks-rotate', '↻ Draai je toestel voor een breder slagveld · swipe om te scrollen');
  field.append(topLeft, topRight, eraWrap, playerHp.wrap, enemyHp.wrap, queueWrap, rotateHint);
  root.append(field);

  const battle = createBattle({ canvas });
  battle.setState(game.battle);

  const panels = E('div', 'ks-panels');
  // Troepen: infanterie, schutter, zwaar, held.
  const troopRow = E('div', 'ks-row');
  const troopEls = ROLES.map((role) => ({ role, ...panelButton(E, `ks-btn-${role}`, () => action('train', { key: role })) }));
  troopEls.forEach((u) => troopRow.append(u.btn));
  const troops = section(E, 'troops', 'TROEPEN', troopRow);

  // Basis: werkers in het veld, kasteelinkomen, muren; daarnaast de oorlogskreet.
  const baseRow = E('div', 'ks-row');
  const worker = panelButton(E, 'ks-btn-worker', () => action('train', { key: 'worker' }));
  const economy = panelButton(E, '', () => action('upgrade', { key: 'economy' }));
  const walls = panelButton(E, '', () => action('upgrade', { key: 'walls' }));
  const rally = panelButton(E, '', () => action('ability', { key: 'rally' }));
  baseRow.append(worker.btn, economy.btn, walls.btn, rally.btn);
  const base = section(E, 'base', 'BASIS', baseRow);

  // Torens: drie plaatsen, per plaats een type.
  const turretRow = E('div', 'ks-row ks-row-3');
  const turretEls = TURRET_TYPES.map((type) => ({ type, ...panelButton(E, `ks-btn-turret-${type}`, () => action('turret', { key: type })) }));
  turretEls.forEach((t) => turretRow.append(t.btn));
  const turrets = section(E, 'turrets', 'TORENS', turretRow);

  // Tijdperk: speciale actie en evolueren.
  const eraRow = E('div', 'ks-row ks-row-2');
  const special = panelButton(E, 'ks-btn-special', () => action('ability', { key: 'special' }));
  const evolve = panelButton(E, 'ks-btn-evolve', () => action('evolve'));
  const xpFill = E('div', 'ks-xp-fill');
  const xpTrack = E('div', 'ks-xp-track');
  xpTrack.append(xpFill);
  evolve.btn.append(xpTrack);
  eraRow.append(special.btn, evolve.btn);
  const eraGroup = section(E, 'era', 'TIJDPERK', eraRow);

  panels.append(troops.group, base.group, turrets.group, eraGroup.group);
  root.append(panels);
  els.gameStage.append(root);

  const setCost = (el, btn, text, cant, cooldown = false) => {
    el.textContent = text;
    el.classList.toggle('cant', cant);
    el.classList.toggle('cd', cooldown);
    btn.disabled = cant || cooldown || !game.canAct;
  };
  const setLabel = (el, icon, text) => { el.textContent = `${icon} ${text}`; };

  function sync(s) {
    const p = s.player, e = s.enemy, era = p.era;
    goldVal.textContent = fmtNum(s.gold);
    rateVal.textContent = ` +${goldRate(p.economyLevel, era)}/s`;
    xpVal.textContent = fmtNum(s.xp);
    timeVal.textContent = fmtTime(s.elapsed);
    playerHp.fill.style.width = `${Math.max(0, 100 * p.castleHp / p.castleMaxHp)}%`;
    enemyHp.fill.style.width = `${Math.max(0, 100 * e.castleHp / e.castleMaxHp)}%`;
    playerHp.text.textContent = `JOUW BASIS · ${fmtNum(p.castleHp)}`;
    enemyHp.text.textContent = `${game.opponentName} · ${fmtNum(e.castleHp)}`;
    eraBadge.textContent = `${ERA_ICON[era]} ${ERA_NAMES[era]}`;
    enemyEra.textContent = `${ERA_ICON[e.era]} ${ERA_SHORT[e.era]}`;

    // Trainingswachtrij: het eerste item vult zich met de trainingsvoortgang.
    queueWrap.replaceChildren(...p.queue.map((role, i) => {
      const chip = E('div', `ks-queue-chip ks-queue-${role}`, ROLE_ICON[role]);
      if (i === 0) chip.style.setProperty('--ks-progress', `${Math.min(100, 100 * p.trainT / ROLE_DEFS[role].train)}%`);
      return chip;
    }));
    queueWrap.classList.toggle('ks-queue-full', p.queue.length >= MAX_QUEUE);

    const own = s.units.filter((u) => u.side === 'player' && !u.dead);
    const heroBusy = p.queue.includes('hero') || own.some((u) => u.role === 'hero');
    const workers = own.filter((u) => u.role === 'worker').length + p.queue.filter((r) => r === 'worker').length;
    troopEls.forEach(({ role, btn, name, hint, cost }) => {
      const price = unitCost(role, era);
      setLabel(name, ROLE_ICON[role], role === 'hero' ? HERO_NAMES[era] : UNIT_NAMES[era][role]);
      hint.textContent = `${ROLE_LABEL[role]} · ${ROLE_DEFS[role].hint}`;
      if (role === 'hero' && heroBusy) setCost(cost, btn, 'Actief', true);
      else setCost(cost, btn, `${fmtNum(price)}g`, !s.running || s.gold < price || p.queue.length >= MAX_QUEUE);
    });

    const workerPrice = unitCost('worker', era);
    setLabel(worker.name, ROLE_ICON.worker, `Werker ${workers}/${MAX_WORKERS}`);
    worker.hint.textContent = `+${mineRate(era)}g/s per werker in het veld`;
    if (workers >= MAX_WORKERS) setCost(worker.cost, worker.btn, 'VOL', true);
    else setCost(worker.cost, worker.btn, `${fmtNum(workerPrice)}g`, !s.running || s.gold < workerPrice || p.queue.length >= MAX_QUEUE);

    const specialPrice = abilityCost('special', era);
    setLabel(special.name, '☄️', SPECIAL_NAMES[era]);
    special.hint.textContent = 'Treft alles op vijandelijk terrein';
    if (p.cooldowns.special > 0) setCost(special.cost, special.btn, `${Math.ceil(p.cooldowns.special)}s`, false, true);
    else setCost(special.cost, special.btn, `${fmtNum(specialPrice)}g`, !s.running || s.gold < specialPrice);

    const turretPrice = costTurret(p.turrets.length, era);
    troops.info.textContent = `wachtrij ${p.queue.length}/${MAX_QUEUE}`;
    base.info.textContent = `werkers ${workers}/${MAX_WORKERS} · muren niv. ${p.wallsLevel}`;
    turrets.info.textContent = `${p.turrets.length}/${MAX_TURRETS} plaatsen`;
    eraGroup.info.textContent = era >= ERA_NAMES.length - 1 ? ERA_SHORT[era] : `${fmtNum(s.xp)}/${fmtNum(evolveXp(era))} XP`;
    turretEls.forEach(({ type, btn, name, hint, cost }) => {
      const built = p.turrets.filter((t) => t.type === type).length;
      setLabel(name, TURRET_ICON[type], type === 'near' ? TURRET_NAMES[era] : type === 'far' ? `Zware ${TURRET_NAMES[era].toLowerCase()}` : 'Banier');
      hint.textContent = `${TURRET_LABEL[type]} · ${TURRET_HINT[type]}${built ? ` · ×${built}` : ''}`;
      if (p.turrets.length >= MAX_TURRETS) setCost(cost, btn, 'VOL', true);
      else setCost(cost, btn, `${fmtNum(turretPrice)}g`, !s.running || s.gold < turretPrice);
    });

    for (const [def, key, icon, label, costFn] of [[walls, 'wallsLevel', '🧱', 'Muren', costWalls], [economy, 'economyLevel', '💰', 'Economie', costEconomy]]) {
      const lv = p[key], maxed = lv >= MAX_LEVEL, price = costFn(lv, era);
      const wallName = lv >= 7 ? WALL_NAMES[era][2] : lv >= 4 ? WALL_NAMES[era][1] : lv >= 2 ? WALL_NAMES[era][0] : 'Geen verdediging';
      setLabel(def.name, icon, key === 'wallsLevel' ? (lv >= 2 ? wallName : 'Muren') : label);
      def.hint.textContent = `Niv. ${lv}${maxed ? ' (MAX)' : key === 'wallsLevel' ? ' · +HP, herstel en verdediging' : ' · meer goud/s uit het kasteel'}`;
      if (maxed) setCost(def.cost, def.btn, 'MAX', true);
      else setCost(def.cost, def.btn, `${fmtNum(price)}g`, !s.running || s.gold < price);
    }

    const rallyPrice = abilityCost('rally', era);
    setLabel(rally.name, '📯', 'Oorlogskreet');
    rally.hint.textContent = '8s meer schade en snelheid';
    if (p.cooldowns.rally > 0) setCost(rally.cost, rally.btn, `${Math.ceil(p.cooldowns.rally)}s`, false, true);
    else setCost(rally.cost, rally.btn, `${fmtNum(rallyPrice)}g`, !s.running || s.gold < rallyPrice);

    if (era >= ERA_NAMES.length - 1) {
      setLabel(evolve.name, '🌍', 'Hoogste tijdperk');
      evolve.hint.textContent = ERA_NAMES[era];
      xpFill.style.width = '100%';
      setCost(evolve.cost, evolve.btn, 'MAX', true);
    } else {
      const need = evolveXp(era);
      setLabel(evolve.name, ERA_ICON[era + 1], `Evolueer naar ${ERA_SHORT[era + 1]}`);
      evolve.hint.textContent = 'Nieuwe troepen, toren en basis';
      xpFill.style.width = `${Math.min(100, 100 * s.xp / need)}%`;
      setCost(evolve.cost, evolve.btn, `${fmtNum(s.xp)} / ${fmtNum(need)} XP`, !s.running || s.xp < need);
    }
  }

  const fit = () => fitField(field);
  fit();
  window.addEventListener('resize', fit);
  live = {
    matchId: game.matchId, battle, root, fit,
    finish(serverGame) {
      const status = heading.querySelector('.game-status');
      if (status) status.textContent = serverGame.resultText;
      root.classList.add('ks-finished');
    }
  };

  battle.start(sync);
}

export function metric({ game }) {
  return {
    text: game.gameOver ? `${ERA_SHORT[game.era]} · ${fmtTime(game.survivedMs / 1000)}` : ERA_SHORT[game.era],
    score: game.survivedMs || 0
  };
}

export function isWinner({ game }) { return Boolean(game.won); }

export function presentResult({ game }) {
  return {
    title: game.won ? 'Overwinning!' : 'Basis gevallen',
    copy: game.resultText || 'Het potje is afgelopen.'
  };
}

export function renderResultDetails({ game, E }) {
  const wrap = E('div', 'ks-result');
  wrap.append(
    E('span', 'ks-result-chip', `${ERA_ICON[game.era]} ${ERA_NAMES[game.era]}`),
    E('span', 'ks-result-chip', `⏱ ${fmtTime(game.survivedMs / 1000)}`)
  );
  return wrap;
}

export function profileExtra({ stat, formatDuration }) {
  return stat.bestKasteelMs ? `Langste: ${formatDuration(stat.bestKasteelMs)} · ${ERA_SHORT[stat.bestKasteelEra] || ERA_SHORT[0]}` : '—';
}
