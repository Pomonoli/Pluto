import {
  createBattle, ERA_NAMES, ERA_SHORT, ERA_ICON, MAX_LEVEL, W, H,
  castleMaxHp, costCastle, costAttack, costDefense, evolveCost, fmtNum, fmtTime
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

const UPGRADES = [
  { key: 'castle', icon: '🏰', name: 'Basis', level: (p) => p.castleLevel, cost: (p) => costCastle(p.castleLevel, p.era) },
  { key: 'attack', icon: '⚔️', name: 'Aanval', level: (p) => p.attackLevel, cost: (p) => costAttack(p.attackLevel, p.era) },
  { key: 'defense', icon: '🛡️', name: 'Verdediging', level: (p) => p.defenseLevel, cost: (p) => costDefense(p.defenseLevel, p.era) }
];
const ABILITIES = [
  { key: 'spawnBoost', icon: '📯', name: 'Oorlogskreet', hint: 'Sneller spawnen' },
  { key: 'dmgBoost', icon: '💢', name: 'Furie', hint: 'Meer schade' },
  { key: 'burst', icon: '💥', name: 'Bonusaanval', hint: 'Raak vijand direct' },
  { key: 'reinforce', icon: '🪖', name: 'Versterking', hint: 'Extra troepen' }
];

let live = null; // { matchId, battle, root, finish }

function stopLive() {
  if (live) live.battle.stop();
  live = null;
}

function panelButton(E, def, onClick) {
  const btn = E('button', `ks-btn${def.key === 'evolve' ? ' ks-btn-evolve' : ''}`);
  btn.type = 'button';
  const level = E('span', 'ks-btn-level', def.hint || '');
  const cost = E('span', 'ks-btn-cost', '');
  btn.append(E('span', 'ks-btn-name', `${def.icon} ${def.name}`), level, cost);
  btn.onclick = onClick;
  return { btn, level, cost };
}

function hpBar(E, cls, label) {
  const wrap = E('div', `ks-hp ${cls}`);
  const fill = E('div', 'ks-hp-fill');
  fill.style.width = '100%';
  const track = E('div', 'ks-hp-track');
  track.append(fill);
  wrap.append(E('div', 'ks-hp-label', label), track);
  return { wrap, fill };
}

export function render({ game, els, E, action, titlebar }) {
  if (live && live.root.isConnected && live.matchId === game.matchId) {
    live.battle.setState(game.battle);
    if (game.gameOver) live.finish(game);
    return;
  }
  stopLive();
  els.gameStage.replaceChildren();

  const heading = titlebar('Kasteel Strijd', game.gameOver ? game.resultText : `Duel tegen ${game.opponentName}. Vernietig de vijandelijke basis.`);
  els.gameStage.append(heading);

  if (game.gameOver) {
    // Geen lokale simulatie meer (bv. na herladen): toon enkel de uitkomst.
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
  const canvas = E('canvas', 'ks-canvas');
  canvas.width = W;
  canvas.height = H;
  field.append(canvas);

  const goldVal = E('span', '', '0');
  const timeVal = E('span', '', '00:00');
  const goldBadge = E('div', 'ks-badge');
  goldBadge.append(E('span', '', '🪙 '), goldVal);
  const timeBadge = E('div', 'ks-badge');
  timeBadge.append(E('span', '', '⏱ '), timeVal);
  const topLeft = E('div', 'ks-overlay ks-top-left');
  topLeft.append(goldBadge, timeBadge);
  const eraBadge = E('div', 'ks-badge ks-era-badge', `${ERA_ICON[0]} ${ERA_NAMES[0]}`);
  const eraWrap = E('div', 'ks-overlay ks-era');
  eraWrap.append(eraBadge);
  const playerHp = hpBar(E, 'ks-hp-left', 'JOUW LEGER');
  const enemyHp = hpBar(E, 'ks-hp-right', game.opponentName);
  field.append(topLeft, eraWrap, playerHp.wrap, enemyHp.wrap);
  root.append(field);

  const battle = createBattle({ canvas });
  battle.setState(game.battle);

  root.append(E('div', 'ks-section', 'UPGRADES'));
  const upgradeRow = E('div', 'ks-row');
  const upgradeEls = UPGRADES.map((def) => ({ def, ...panelButton(E, def, () => action('upgrade', { key: def.key })) }));
  upgradeEls.forEach((u) => upgradeRow.append(u.btn));
  const evolve = panelButton(E, { key: 'evolve', icon: '🌍', name: 'Evolueer' }, () => action('evolve'));
  upgradeRow.append(evolve.btn);
  root.append(upgradeRow);

  root.append(E('div', 'ks-section', 'VAARDIGHEDEN'));
  const abilityRow = E('div', 'ks-row');
  const abilityEls = ABILITIES.map((def) => ({ def, ...panelButton(E, def, () => action('ability', { key: def.key })) }));
  abilityEls.forEach((a) => abilityRow.append(a.btn));
  root.append(abilityRow);
  els.gameStage.append(root);

  const setCost = (el, btn, text, cant, cooldown = false) => {
    el.textContent = text;
    el.classList.toggle('cant', cant);
    el.classList.toggle('cd', cooldown);
    btn.disabled = cant || cooldown || !game.canAct;
  };

  function sync(s) {
    const p = s.player;
    goldVal.textContent = fmtNum(s.gold);
    timeVal.textContent = fmtTime(s.elapsed);
    playerHp.fill.style.width = `${Math.max(0, 100 * p.castleHp / castleMaxHp(p.castleLevel, p.era))}%`;
    enemyHp.fill.style.width = `${Math.max(0, 100 * s.enemy.castleHp / s.enemy.castleMaxHp)}%`;
    eraBadge.textContent = `${ERA_ICON[p.era]} ${ERA_NAMES[p.era]}`;

    upgradeEls.forEach(({ def, btn, level, cost }) => {
      const lv = def.level(p), maxed = lv >= MAX_LEVEL, price = def.cost(p);
      level.textContent = `Niv. ${lv}${maxed ? ' (MAX)' : ''}`;
      if (maxed) setCost(cost, btn, 'MAX', true);
      else setCost(cost, btn, `${fmtNum(price)}g`, !s.running || s.gold < price);
    });

    if (p.era >= ERA_NAMES.length - 1) {
      evolve.level.textContent = 'Hoogste tijdperk';
      setCost(evolve.cost, evolve.btn, 'MAX', true);
    } else {
      const price = evolveCost(p.era);
      evolve.level.textContent = `Naar ${ERA_SHORT[p.era + 1]}`;
      setCost(evolve.cost, evolve.btn, `${fmtNum(price)}g`, !s.running || s.gold < price);
    }

    const defs = battle.abilityDefs();
    abilityEls.forEach(({ def, btn, cost }) => {
      const cd = p.cooldowns[def.key];
      if (cd > 0) setCost(cost, btn, `${Math.ceil(cd)}s`, false, true);
      else setCost(cost, btn, `${fmtNum(defs[def.key].cost)}g`, !s.running || s.gold < defs[def.key].cost);
    });
  }

  live = {
    matchId: game.matchId, battle, root,
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
