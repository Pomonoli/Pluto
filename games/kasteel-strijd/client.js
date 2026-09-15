import {
  createBattle, ERA_NAMES, ERA_SHORT, ERA_ICON, ROLES, ROLE_LABEL, ROLE_ICON, ROLE_DEFS, UNIT_NAMES, HERO_NAMES, TURRET_NAMES, SPECIAL_NAMES,
  TURRET_TYPES, TURRET_LABEL, TURRET_ICON, TURRET_HINT, WALL_NAMES,
  MAX_LEVEL, MAX_TURRETS, MAX_QUEUE, MAX_WORKERS, W, H,
  unitCost, castleMaxHp, costWalls, costEconomy, costTurret, evolveXp, abilityCost, goldRate, mineRate, fmtNum, fmtTime
} from './engine.js?v=5';

// Behoud het canvas tussen serverupdates (zie game-ui.js: preserveStage).
export const preserveStage = true;
export const roomOptions = { bodyClass: 'castle-defense-active' };

export const leaderboardConfig = { columns: [
  { key: 'rank', label: '#', short: '#', width: 'rank' },
  { key: 'username', label: 'Speler', short: 'Speler', width: 'player' },
  { key: 'wins', label: 'Overwinningen', short: 'W' },
  { key: 'bestEraName', label: 'Hoogste tijdperk', short: 'Tijdperk', width: 'wide' },
  { key: 'bestMs', label: 'Langste potje', short: 'Tijd', format: 'duration' }
] };

let live = null; // { matchId, battle, root, finish }
let openGroup = 'troops'; // Op mobiel staat één sectie tegelijk open; onthouden tussen renders.

const FRANCHISE_CHOICES = {
  starwars: ['Star Wars', [['jedi', 'Jedi'], ['sith', 'Sith']]],
  lotr: ['Lord of the Rings', [['good', 'Good'], ['evil', 'Evil']]],
  harrypotter: ['Harry Potter', [['harry', 'Harry'], ['voldemort', 'Voldemort']]]
};
export function renderLobbyOptions({ room, container, E, socket, handleAck }) {
  const current = room.gameOptions || {}, mode = current.mode === 'franchise' ? 'franchise' : 'ages';
  const franchise = FRANCHISE_CHOICES[current.franchise] ? current.franchise : 'starwars';
  const validSides = FRANCHISE_CHOICES[franchise][1], hostSide = validSides.some(([key]) => key === current.hostSide) ? current.hostSide : validSides[0][0];
  const wrap = E('section', 'ks-lobby-options');
  wrap.append(E('strong', 'ks-lobby-heading', 'Spelversie'));
  const modes = E('div', 'ks-lobby-modes');
  [['ages', 'Trough the Ages', 'Vecht door zeven historische tijdperken.'], ['franchise', 'Franchise', 'Upgrade binnen één gekozen universum.']].forEach(([key, label, copy]) => {
    const button = E('button', `ks-lobby-card${mode === key ? ' active' : ''}`); button.type = 'button'; button.disabled = !room.isHost;
    button.append(E('strong', '', label), E('small', '', copy)); button.onclick = () => socket.emit('room:setOptions', { ...current, mode: key }, handleAck); modes.append(button);
  });
  wrap.append(modes);
  if (mode === 'franchise') {
    wrap.append(E('strong', 'ks-lobby-heading', 'Franchise'));
    const franchises = E('div', 'ks-lobby-franchises');
    Object.entries(FRANCHISE_CHOICES).forEach(([key, [label]]) => {
      const button = E('button', `ks-lobby-pill${franchise === key ? ' active' : ''}`, label); button.type = 'button'; button.disabled = !room.isHost;
      button.onclick = () => socket.emit('room:setOptions', { mode, franchise: key, hostSide: FRANCHISE_CHOICES[key][1][0][0] }, handleAck); franchises.append(button);
    });
    wrap.append(franchises, E('strong', 'ks-lobby-heading', room.isHost ? 'Jouw kamp' : 'Kamp van de host'));
    const sides = E('div', 'ks-lobby-sides');
    validSides.forEach(([key, label], index) => {
      const opponent = validSides[1 - index][1], button = E('button', `ks-lobby-card${hostSide === key ? ' active' : ''}`); button.type = 'button'; button.disabled = !room.isHost;
      button.append(E('strong', '', label), E('small', '', `tegen ${opponent}`)); button.onclick = () => socket.emit('room:setOptions', { mode, franchise, hostSide: key }, handleAck); sides.append(button);
    });
    wrap.append(sides);
  }
  container.append(wrap);
}

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
  if (live) {
    live.battle.stop();
    window.removeEventListener('resize', live.fit);
    window.removeEventListener('keydown', live.onKeydown);
  }
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

export function bindHoldInfo(btn, show, delay = 520) {
  let timer = null, held = false;
  const clear = () => { if (timer) clearTimeout(timer); timer = null; };
  btn.addEventListener('pointerdown', (event) => {
    if (event.button != null && event.button !== 0) return;
    held = false;
    clear();
    timer = setTimeout(() => { timer = null; held = true; show(); }, delay);
  });
  btn.addEventListener('pointerup', clear);
  btn.addEventListener('pointercancel', clear);
  btn.addEventListener('pointerleave', clear);
  btn.addEventListener('click', (event) => {
    if (!held) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    held = false;
  }, true);
  btn.addEventListener('contextmenu', (event) => event.preventDefault());
}

function panelButton(E, cls, onClick, showDetail) {
  const btn = E('button', `ks-btn${cls ? ` ${cls}` : ''}`);
  btn.type = 'button';
  const glint = E('span', 'ks-btn-glint', '');
  const name = E('span', 'ks-btn-name', '');
  const hint = E('span', 'ks-btn-level', '');
  const cost = E('span', 'ks-btn-cost', '');
  btn.append(glint, name, hint, cost);
  btn.onclick = () => { if (btn.getAttribute('aria-disabled') !== 'true') onClick(); };
  bindHoldInfo(btn, () => showDetail(btn._ksDetail));
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
    live.game = game;
    live.battle.setState(game.battle);
    if (game.gameOver) live.finish(game);
    return;
  }
  stopLive();
  els.gameStage.replaceChildren();

  const variantName = game.mode === 'franchise' ? `${game.content?.franchiseName || 'Franchise'} · ${game.content?.player?.factionLabel || ''}` : 'Trough the Ages';
  const heading = titlebar(`Castle Defense · ${variantName}`, game.gameOver ? game.resultText : `Duel tegen ${game.opponentName}. Vernietig de vijandelijke basis.`);
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

  const root = E('div', `ks-root${game.mode === 'franchise' ? ` ks-franchise ks-theme-${game.franchise}` : ''}`);
  const detail = E('div', 'ks-detail-backdrop ks-hidden');
  const detailCard = E('section', 'ks-detail-card');
  detailCard.setAttribute('role', 'dialog');
  detailCard.setAttribute('aria-modal', 'true');
  detailCard.setAttribute('aria-labelledby', 'ks-detail-title');
  const detailClose = E('button', 'ks-detail-close', '×');
  detailClose.type = 'button';
  detailClose.setAttribute('aria-label', 'Sluiten');
  const detailKind = E('span', 'ks-detail-kind', 'INFORMATIE');
  const detailTitle = E('h3', 'ks-detail-title', '');
  detailTitle.id = 'ks-detail-title';
  const detailLead = E('p', 'ks-detail-lead', '');
  const detailStats = E('div', 'ks-detail-stats');
  detailCard.append(detailClose, detailKind, detailTitle, detailLead, detailStats, E('p', 'ks-detail-tip', 'Tik kort om te kiezen · houd ingedrukt voor deze uitleg'));
  detail.append(detailCard);
  const closeDetail = () => detail.classList.add('ks-hidden');
  const showDetail = (info) => {
    if (!info) return;
    detailKind.textContent = info.kind;
    detailTitle.textContent = info.title;
    detailLead.textContent = info.lead;
    detailStats.replaceChildren(...info.stats.map(([label, value, accent]) => {
      const item = E('div', `ks-detail-stat${accent ? ' ks-detail-accent' : ''}`);
      item.append(E('span', '', label), E('strong', '', value));
      return item;
    }));
    detail.classList.remove('ks-hidden');
    detailClose.focus();
  };
  detailClose.onclick = closeDetail;
  detail.onclick = (event) => { if (event.target === detail) closeDetail(); };
  const onKeydown = (event) => { if (event.key === 'Escape') closeDetail(); };
  const field = E('div', 'ks-field');
  const fieldFrame = E('div', 'ks-field-frame');
  fieldFrame.append(E('span', 'ks-frame-corner ks-frame-tl'), E('span', 'ks-frame-corner ks-frame-tr'), E('span', 'ks-frame-corner ks-frame-bl'), E('span', 'ks-frame-corner ks-frame-br'));
  // Het canvas zit in een horizontaal scrollbare laag; de HUD-overlays blijven op het veld staan.
  const scroll = E('div', 'ks-scroll');
  const canvas = E('canvas', 'ks-canvas');
  canvas.width = W;
  canvas.height = H;
  scroll.append(canvas);
  field.append(scroll, fieldFrame);

  const goldVal = E('span', '', '0');
  const rateVal = E('span', 'ks-badge-sub', '');
  const xpVal = E('span', '', '0');
  const timeVal = E('span', '', '00:00');
  const goldBadge = E('div', 'ks-badge ks-resource ks-resource-gold');
  goldBadge.append(E('span', 'ks-badge-icon', '🪙'), goldVal, rateVal);
  const xpBadge = E('div', 'ks-badge ks-badge-xp ks-resource');
  xpBadge.append(E('span', 'ks-badge-icon', '✦'), xpVal);
  const timeBadge = E('div', 'ks-badge ks-resource ks-resource-time');
  timeBadge.append(E('span', 'ks-badge-icon', '◷'), timeVal);
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
  queueWrap.setAttribute('aria-label', 'Trainingswachtrij');
  const rotateHint = E('div', 'ks-rotate', '↻ Draai je toestel voor een breder slagveld · swipe om te scrollen');
  field.append(topLeft, topRight, eraWrap, playerHp.wrap, enemyHp.wrap, queueWrap, rotateHint);
  root.append(field);

  const battle = createBattle({ canvas });
  battle.setState(game.battle);

  const panels = E('div', 'ks-panels');
  // Troepen: infanterie, schutter, zwaar, held.
  const troopRow = E('div', 'ks-row');
  const troopEls = ROLES.map((role) => ({ role, ...panelButton(E, `ks-btn-${role}`, () => action('train', { key: role }), showDetail) }));
  troopEls.forEach((u) => troopRow.append(u.btn));
  const troops = section(E, 'troops', 'TROEPEN', troopRow);

  // Basis: werkers in het veld, kasteelinkomen, muren; daarnaast de oorlogskreet.
  const baseRow = E('div', 'ks-row');
  const worker = panelButton(E, 'ks-btn-worker', () => action('train', { key: 'worker' }), showDetail);
  const economy = panelButton(E, '', () => action('upgrade', { key: 'economy' }), showDetail);
  const walls = panelButton(E, '', () => action('upgrade', { key: 'walls' }), showDetail);
  const rally = panelButton(E, '', () => action('ability', { key: 'rally' }), showDetail);
  baseRow.append(worker.btn, economy.btn, walls.btn, rally.btn);
  const base = section(E, 'base', 'BASIS', baseRow);

  // Torens: drie plaatsen, per plaats een type.
  const turretRow = E('div', 'ks-row ks-row-3');
  const turretEls = TURRET_TYPES.map((type) => ({ type, ...panelButton(E, `ks-btn-turret-${type}`, () => action('turret', { key: type }), showDetail) }));
  turretEls.forEach((t) => turretRow.append(t.btn));
  const turrets = section(E, 'turrets', 'TORENS', turretRow);

  // Tijdperk: speciale actie en evolueren.
  const eraRow = E('div', 'ks-row ks-row-2');
  const special = panelButton(E, 'ks-btn-special', () => action('ability', { key: 'special' }), showDetail);
  const evolve = panelButton(E, 'ks-btn-evolve', () => action('evolve'), showDetail);
  const xpFill = E('div', 'ks-xp-fill');
  const xpTrack = E('div', 'ks-xp-track');
  xpTrack.append(xpFill);
  evolve.btn.append(xpTrack);
  eraRow.append(special.btn, evolve.btn);
  const eraGroup = section(E, 'era', 'TIJDPERK', eraRow);

  panels.append(troops.group, base.group, turrets.group, eraGroup.group);
  root.append(panels, detail);
  els.gameStage.append(root);

  const setCost = (el, btn, text, cant, cooldown = false) => {
    el.textContent = text;
    el.classList.toggle('cant', cant);
    el.classList.toggle('cd', cooldown);
    btn.setAttribute('aria-disabled', String(cant || cooldown || !game.canAct));
  };
  const setLabel = (el, icon, text) => { el.textContent = `${icon} ${text}`; };

  function sync(s) {
    const p = s.player, e = s.enemy, era = p.era;
    const view = live?.game || game;
    const franchiseMode = view.mode === 'franchise', ownContent = view.content?.player, enemyContent = view.content?.enemy;
    const artUi = franchiseMode ? ({
      starwars: { icon: '?', roles: { melee:'?', ranged:'?', heavy:'??', hero:'?', worker:'?' }, near:'Blasterkoepel', far:'Turbolaser', wall:'Energieschild' },
      lotr: { icon:'?', roles: { melee:'?', ranged:'??', heavy:'??', hero:'?', worker:'?' }, near:'Ballista', far:'Belegeringskatapult', wall:'Vestingmuur' },
      harrypotter: { icon:'?', roles: { melee:'??', ranged:'??', heavy:'??', hero:'?', worker:'?' }, near:'Spreukwachter', far:'Magisch kristal', wall:'Beschermingsspreuk' }
    })[view.franchise] : null;
    const roleIcon = role => artUi?.roles[role] || ROLE_ICON[role];
    const turretName = type => type === 'bonus' ? 'Banier' : artUi ? artUi[type] : type === 'near' ? TURRET_NAMES[era] : `Zware ${TURRET_NAMES[era].toLowerCase()}`;
    const maxEra = franchiseMode ? 4 : ERA_NAMES.length - 1;
    const stageName = franchiseMode ? ownContent.stage : ERA_NAMES[era];
    const enemyStageName = franchiseMode ? enemyContent.stage : ERA_SHORT[e.era];
    const troopName = (role) => franchiseMode ? ownContent[role] : role === 'hero' ? HERO_NAMES[era] : UNIT_NAMES[era][role];
    // Totaal inkomen: kasteel (economie-niveau) + werkers die effectief aan de mijn staan, versterkt door banieren.
    const banners = p.turrets.filter((t) => t.type === 'bonus').length;
    const miners = s.units.filter((u) => u.side === 'player' && !u.dead && u.role === 'worker' && u.state === 'mine').length;
    const castleIncome = goldRate(p.economyLevel, era);
    const mineIncome = miners * mineRate(era) * (1 + banners * 0.15);
    goldVal.textContent = fmtNum(s.gold);
    rateVal.textContent = ` +${(castleIncome + mineIncome).toFixed(1)}/s`;
    goldBadge.title = `Kasteel +${castleIncome}/s · ${miners} werker${miners === 1 ? '' : 's'} +${mineIncome.toFixed(1)}/s${banners ? ` (banier ×${(1 + banners * 0.15).toFixed(2)})` : ''}`;
    xpVal.textContent = fmtNum(s.xp);
    timeVal.textContent = fmtTime(s.elapsed);
    playerHp.fill.style.width = `${Math.max(0, 100 * p.castleHp / p.castleMaxHp)}%`;
    enemyHp.fill.style.width = `${Math.max(0, 100 * e.castleHp / e.castleMaxHp)}%`;
    playerHp.text.textContent = `JOUW BASIS · ${fmtNum(p.castleHp)}`;
    enemyHp.text.textContent = `${game.opponentName} · ${fmtNum(e.castleHp)}`;
    eraBadge.textContent = `${artUi?.icon || ERA_ICON[era]} ${stageName}`;
    enemyEra.textContent = `${artUi?.icon || ERA_ICON[e.era]} ${enemyStageName}`;

    // Trainingswachtrij: het eerste item vult zich met de trainingsvoortgang.
    queueWrap.replaceChildren(...p.queue.map((role, i) => {
      const chip = E('div', `ks-queue-chip ks-queue-${role}`, roleIcon(role));
      if (i === 0) chip.style.setProperty('--ks-progress', `${Math.min(100, 100 * p.trainT / ROLE_DEFS[role].train)}%`);
      return chip;
    }));
    queueWrap.classList.toggle('ks-queue-full', p.queue.length >= MAX_QUEUE);

    const own = s.units.filter((u) => u.side === 'player' && !u.dead);
    const heroBusy = p.queue.includes('hero') || own.some((u) => u.role === 'hero');
    const workers = own.filter((u) => u.role === 'worker').length + p.queue.filter((r) => r === 'worker').length;
    troopEls.forEach(({ role, btn, name, hint, cost }) => {
      const price = unitCost(role, era);
      setLabel(name, roleIcon(role), troopName(role));
      hint.textContent = `${ROLE_LABEL[role]} · ${ROLE_DEFS[role].hint}`;
      btn._ksDetail = { kind: 'TROEP', title: troopName(role), lead: ROLE_DEFS[role].hint, stats: [['Kost', `${fmtNum(price)} goud`], ['Training', `${ROLE_DEFS[role].train.toFixed(1)} sec.`], ['Rol', ROLE_LABEL[role]], ['Volgende upgrade', era < maxEra ? (franchiseMode ? 'Nieuwe franchise-eenheid · sterker' : `${UNIT_NAMES[era + 1]?.[role] || HERO_NAMES[era + 1]} · sterker`) : 'Maximum', true]] };
      if (role === 'hero' && heroBusy) setCost(cost, btn, 'Actief', true);
      else setCost(cost, btn, `${fmtNum(price)}g`, !s.running || s.gold < price || p.queue.length >= MAX_QUEUE);
    });

    const workerPrice = unitCost('worker', era);
    setLabel(worker.name, ROLE_ICON.worker, `${franchiseMode ? ownContent.worker : 'Werker'} ${workers}/${MAX_WORKERS}`);
    worker.hint.textContent = miners ? `${miners} aan het werk · +${mineIncome.toFixed(1)}g/s` : `+${mineRate(era)}g/s per werker in het veld`;
    worker.btn._ksDetail = { kind: 'TROEP', title: 'Werker', lead: 'Loopt naar de mijn en ontgint blijvend goud zolang hij overleeft.', stats: [['Kost', `${fmtNum(workerPrice)} goud`], ['Opbrengst', `+${mineRate(era)} goud/sec.` , true], ['Ingezet', `${workers}/${MAX_WORKERS}`], ['Training', `${ROLE_DEFS.worker.train.toFixed(1)} sec.`]] };
    if (workers >= MAX_WORKERS) setCost(worker.cost, worker.btn, 'VOL', true);
    else setCost(worker.cost, worker.btn, `${fmtNum(workerPrice)}g`, !s.running || s.gold < workerPrice || p.queue.length >= MAX_QUEUE);

    const specialPrice = abilityCost('special', era);
    setLabel(special.name, '☄️', franchiseMode ? ownContent.special : SPECIAL_NAMES[era]);
    special.hint.textContent = 'Treft alles op vijandelijk terrein';
    special.btn._ksDetail = { kind: 'ACTIE', title: franchiseMode ? ownContent.special : SPECIAL_NAMES[era], lead: 'Raakt alle vijandelijke troepen op hun helft en beschadigt ook de vijandelijke basis.', stats: [['Kost', `${fmtNum(specialPrice)} goud`], ['Basisschade', '3% van maximum', true], ['Afkoeling', '45 sec.'], ['Bereik', 'Vijandelijk terrein']] };
    if (p.cooldowns.special > 0) setCost(special.cost, special.btn, `${Math.ceil(p.cooldowns.special)}s`, false, true);
    else setCost(special.cost, special.btn, `${fmtNum(specialPrice)}g`, !s.running || s.gold < specialPrice);

    const turretPrice = costTurret(p.turrets.length, era);
    troops.info.textContent = `wachtrij ${p.queue.length}/${MAX_QUEUE}`;
    base.info.textContent = `werkers ${workers}/${MAX_WORKERS} · muren niv. ${p.wallsLevel}`;
    turrets.info.textContent = `${p.turrets.length}/${MAX_TURRETS} plaatsen`;
    eraGroup.info.textContent = era >= maxEra ? stageName : `${fmtNum(s.xp)}/${fmtNum(evolveXp(era))} XP`;
    turretEls.forEach(({ type, btn, name, hint, cost }) => {
      const built = p.turrets.filter((t) => t.type === type).length;
      setLabel(name, TURRET_ICON[type], turretName(type));
      hint.textContent = `${TURRET_LABEL[type]} · ${TURRET_HINT[type]}${built ? ` · ×${built}` : ''}`;
      btn._ksDetail = { kind: 'TOREN', title: turretName(type), lead: TURRET_HINT[type], stats: [['Kost', `${fmtNum(turretPrice)} goud`], ['Gebouwd', `${built}/${MAX_TURRETS}`], ['Plaatsen vrij', `${MAX_TURRETS - p.turrets.length}`], ['Effect', type === 'bonus' ? '+15% schade en ontginning' : type === 'near' ? 'Kort bereik · hoge schade' : 'Lang bereik · artillerie', true]] };
      if (p.turrets.length >= MAX_TURRETS) setCost(cost, btn, 'VOL', true);
      else setCost(cost, btn, `${fmtNum(turretPrice)}g`, !s.running || s.gold < turretPrice);
    });

    for (const [def, key, icon, label, costFn] of [[walls, 'wallsLevel', '🧱', 'Muren', costWalls], [economy, 'economyLevel', '💰', 'Economie', costEconomy]]) {
      const lv = p[key], maxed = lv >= MAX_LEVEL, price = costFn(lv, era);
      const wallName = artUi ? artUi.wall : lv >= 7 ? WALL_NAMES[era][2] : lv >= 4 ? WALL_NAMES[era][1] : lv >= 2 ? WALL_NAMES[era][0] : 'Geen verdediging';
      setLabel(def.name, icon, key === 'wallsLevel' ? (lv >= 2 ? wallName : 'Muren') : label);
      def.hint.textContent = `Niv. ${lv}${maxed ? ' (MAX)' : key === 'wallsLevel' ? ' · +HP, herstel en verdediging' : ` · kasteel +${castleIncome}/s → +${goldRate(lv + 1, era)}/s`}`;
      def.btn._ksDetail = key === 'wallsLevel'
        ? { kind: 'UPGRADE', title: lv >= 2 ? wallName : 'Muren', lead: 'Verhoogt de maximale levenspunten van je basis en herstelt bij aankoop 20% van het nieuwe maximum.', stats: [['Huidig', `Niveau ${lv} · ${fmtNum(castleMaxHp(lv, era))} HP`], ['Volgend', maxed ? 'Maximum bereikt' : `Niveau ${lv + 1} · ${fmtNum(castleMaxHp(lv + 1, era))} HP`, true], ['Kost', maxed ? 'MAX' : `${fmtNum(price)} goud`]] }
        : { kind: 'UPGRADE', title: 'Economie', lead: 'Verhoogt het automatische goudinkomen van je kasteel permanent.', stats: [['Huidig', `Niveau ${lv} · +${goldRate(lv, era)} goud/sec.`], ['Volgend', maxed ? 'Maximum bereikt' : `Niveau ${lv + 1} · +${goldRate(lv + 1, era)} goud/sec.`, true], ['Kost', maxed ? 'MAX' : `${fmtNum(price)} goud`]] };
      if (maxed) setCost(def.cost, def.btn, 'MAX', true);
      else setCost(def.cost, def.btn, `${fmtNum(price)}g`, !s.running || s.gold < price);
    }

    const rallyPrice = abilityCost('rally', era);
    setLabel(rally.name, '📯', 'Oorlogskreet');
    rally.hint.textContent = '8s meer schade en snelheid';
    rally.btn._ksDetail = { kind: 'ACTIE', title: 'Oorlogskreet', lead: 'Geeft al je actieve strijders tijdelijk een krachtige aanvalsstoot.', stats: [['Duur', '8 sec.'], ['Schade', '+40%', true], ['Kost', `${fmtNum(rallyPrice)} goud`], ['Afkoeling', '30 sec.']] };
    if (p.cooldowns.rally > 0) setCost(rally.cost, rally.btn, `${Math.ceil(p.cooldowns.rally)}s`, false, true);
    else setCost(rally.cost, rally.btn, `${fmtNum(rallyPrice)}g`, !s.running || s.gold < rallyPrice);

    if (era >= maxEra) {
      setLabel(evolve.name, '🌍', 'Hoogste tijdperk');
      evolve.hint.textContent = stageName;
      xpFill.style.width = '100%';
      setCost(evolve.cost, evolve.btn, 'MAX', true);
      evolve.btn._ksDetail = { kind: franchiseMode ? 'FRANCHISE' : 'TIJDPERK', title: stageName, lead: 'Je hebt de hoogste upgrade bereikt.', stats: [['Status', 'Maximum', true], ['Troepen', 'Volledig ontwikkeld'], ['Basis', 'Volledig ontwikkeld']] };
    } else {
      const need = evolveXp(era);
      const nextStage = franchiseMode ? 'Volgende franchise-upgrade' : ERA_SHORT[era + 1];
      setLabel(evolve.name, ERA_ICON[era + 1], `Upgrade naar ${nextStage}`);
      evolve.hint.textContent = 'Nieuwe troepen, toren en basis';
      xpFill.style.width = `${Math.min(100, 100 * s.xp / need)}%`;
      setCost(evolve.cost, evolve.btn, `${fmtNum(s.xp)} / ${fmtNum(need)} XP`, !s.running || s.xp < need);
      evolve.btn._ksDetail = { kind: franchiseMode ? 'FRANCHISE' : 'TIJDPERK', title: `Naar ${nextStage}`, lead: 'Ontgrendelt een nieuwe visuele basis, nieuwe troepen en een nieuwe toren. Alle waarden schalen mee.', stats: [['Vereist', `${fmtNum(need)} XP`], ['Voortgang', `${fmtNum(s.xp)} / ${fmtNum(need)} XP`], ['Basis', '+75% schaal en 30% herstel', true], ['Ontgrendelt', franchiseMode ? 'Nieuwe franchise-eenheden' : `${UNIT_NAMES[era + 1].melee}, ${UNIT_NAMES[era + 1].ranged} en meer`]] };
    }
  }

  const fit = () => fitField(field);
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('keydown', onKeydown);
  live = {
    matchId: game.matchId, game, battle, root, fit, onKeydown,
    finish(serverGame) {
      const status = heading.querySelector('.game-status');
      if (status) status.textContent = serverGame.resultText;
      root.classList.add('ks-finished');
    }
  };

  battle.start(sync);
}

export function metric({ game }) {
  const eraLabel = game.mode === 'franchise' ? game.content?.player?.stage || 'Franchise' : ERA_SHORT[game.era];
  return {
    text: game.gameOver ? `${eraLabel} · ${fmtTime(game.survivedMs / 1000)}` : eraLabel,
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
  const eraLabel = game.mode === 'franchise' ? game.content?.player?.stage || 'Franchise' : ERA_NAMES[game.era];
  const wrap = E('div', 'ks-result');
  wrap.append(
    E('span', 'ks-result-chip', `${ERA_ICON[game.era]} ${eraLabel}`),
    E('span', 'ks-result-chip', `⏱ ${fmtTime(game.survivedMs / 1000)}`)
  );
  return wrap;
}

export function profileExtra({ stat, formatDuration }) {
  return stat.bestKasteelMs ? `Langste: ${formatDuration(stat.bestKasteelMs)} · ${ERA_SHORT[stat.bestKasteelEra] || ERA_SHORT[0]}` : '—';
}
