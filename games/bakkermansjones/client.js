const RECIPE_ORDER = ['stokbrood', 'pistolet', 'croissant', 'koffiekoek', 'taart'];

const ICONS = {
  stokbrood: `<svg viewBox="0 0 100 100"><rect x="10" y="40" width="80" height="22" rx="11" fill="#F5B942" stroke="#3A2417" stroke-width="6"/><line x1="28" y1="40" x2="22" y2="62" stroke="#3A2417" stroke-width="5"/><line x1="46" y1="40" x2="40" y2="62" stroke="#3A2417" stroke-width="5"/><line x1="64" y1="40" x2="58" y2="62" stroke="#3A2417" stroke-width="5"/></svg>`,
  pistolet: `<svg viewBox="0 0 100 100"><circle cx="50" cy="52" r="30" fill="#F5B942" stroke="#3A2417" stroke-width="6"/><line x1="38" y1="40" x2="62" y2="64" stroke="#3A2417" stroke-width="5"/><line x1="62" y1="40" x2="38" y2="64" stroke="#3A2417" stroke-width="5"/></svg>`,
  croissant: `<svg viewBox="0 0 100 100"><path d="M14 58C22 30 46 20 70 26c14 3 20 14 16 22-10-6-20-4-26 4-8-10-20-11-30-4-6 4-10 8-16 10z" fill="#F5B942" stroke="#3A2417" stroke-width="6" stroke-linejoin="round"/></svg>`,
  koffiekoek: `<svg viewBox="0 0 100 100"><circle cx="50" cy="54" r="30" fill="#E8B87C" stroke="#3A2417" stroke-width="6"/><path d="M50 34c11 0 18 8 18 18s-9 16-16 12" fill="none" stroke="#3A2417" stroke-width="4" stroke-linecap="round"/><path d="M28 66c6 6 10-6 16 0" fill="none" stroke="#E14B3C" stroke-width="4" stroke-linecap="round"/></svg>`,
  taart: `<svg viewBox="0 0 100 100"><rect x="18" y="52" width="64" height="32" rx="6" fill="#8B5A34" stroke="#3A2417" stroke-width="6"/><path d="M18 52c0-11 9-18 32-18s32 7 32 18" fill="#FBF0DC" stroke="#3A2417" stroke-width="6"/><path d="M22 50c7-9 13 7 20-2s13 9 20-1s13 6 18-2" fill="none" stroke="#E14B3C" stroke-width="4"/><circle cx="50" cy="30" r="6" fill="#E14B3C" stroke="#3A2417" stroke-width="4"/></svg>`
};
const WARN_SVG = `<svg viewBox="0 0 100 100"><path d="M50 8 92 84H8Z" fill="#3A2417"/><path d="M50 18 84 78H16Z" fill="#fff"/><rect x="45" y="38" width="10" height="24" rx="4" fill="#3A2417"/><circle cx="50" cy="70" r="5.5" fill="#3A2417"/></svg>`;

// Bakkermans Jones: twee bakkers, dezelfde dikke-contourenstijl als de producticonen.
// bakerFigure() tekent één figuur op een 0-100/0-150 grid; BAKER_SVG plaatst er twee naast
// elkaar (jong/blond in het zwart met een broodmand, ouder/donker in het wit met een schraper).
function bakerFigure({ shirt, hair, prop }) {
  return `
    <rect x="36" y="104" width="11" height="30" rx="5" fill="#2B1C12" stroke="#3A2417" stroke-width="4"/>
    <rect x="53" y="104" width="11" height="30" rx="5" fill="#2B1C12" stroke="#3A2417" stroke-width="4"/>
    <rect x="22" y="58" width="56" height="52" rx="16" fill="${shirt}" stroke="#3A2417" stroke-width="6"/>
    <path d="M30 64c-2 20-2 34 4 46h32c6-12 6-26 4-46" fill="#FBF0DC" stroke="#3A2417" stroke-width="6"/>
    <rect x="42" y="72" width="16" height="12" rx="3" fill="none" stroke="#3A2417" stroke-width="3"/>
    <circle cx="18" cy="72" r="11" fill="${shirt}" stroke="#3A2417" stroke-width="5"/>
    <circle cx="82" cy="72" r="11" fill="${shirt}" stroke="#3A2417" stroke-width="5"/>
    <circle cx="15" cy="93" r="8" fill="#F2C29B" stroke="#3A2417" stroke-width="4"/>
    <circle cx="85" cy="93" r="8" fill="#F2C29B" stroke="#3A2417" stroke-width="4"/>
    ${prop || ''}
    <circle cx="50" cy="32" r="23" fill="#F2C29B" stroke="#3A2417" stroke-width="6"/>
    ${hair}
    <circle cx="42" cy="34" r="2.6" fill="#3A2417"/>
    <circle cx="58" cy="34" r="2.6" fill="#3A2417"/>
    <path d="M41 41q9 7 18 0" fill="none" stroke="#3A2417" stroke-width="3" stroke-linecap="round"/>
  `;
}

const HAIR_BLOND = `<ellipse cx="50" cy="16" rx="25" ry="16" fill="#F0B23A" stroke="#3A2417" stroke-width="5"/>`;
const HAIR_DARK = `<ellipse cx="50" cy="18" rx="24" ry="13" fill="#3A2B22" stroke="#3A2417" stroke-width="5"/>`;
const PROP_BASKET = `<path d="M4 88h26l-3 14a4 4 0 0 1-4 3H11a4 4 0 0 1-4-3z" fill="#C98A4B" stroke="#3A2417" stroke-width="4" stroke-linejoin="round"/><path d="M8 88c1-8 5-12 9-12s8 4 9 12" fill="none" stroke="#3A2417" stroke-width="3"/><rect x="9" y="80" width="12" height="9" rx="2" fill="#F5B942" stroke="#3A2417" stroke-width="3"/>`;
const PROP_SCRAPER = `<rect x="82" y="82" width="16" height="10" rx="2" fill="#DCE3E6" stroke="#3A2417" stroke-width="3.5"/><rect x="88" y="90" width="4" height="12" rx="2" fill="#8B5A34" stroke="#3A2417" stroke-width="3"/>`;

const BAKER_SVG = `<svg viewBox="0 0 190 150">
  <g transform="translate(-6,0) scale(.86)">${bakerFigure({ shirt: '#2B2320', hair: HAIR_BLOND, prop: PROP_BASKET })}</g>
  <g transform="translate(96,0) scale(.86)">${bakerFigure({ shirt: '#FFFFFF', hair: HAIR_DARK, prop: PROP_SCRAPER })}</g>
</svg>`;

const CUSTOMER_COLORS = ['#2E9E8C', '#E14B3C', '#8B5A34', '#C98A2E'];
function customerSvg(color) {
  return `<svg viewBox="0 0 50 80">
    <rect x="17" y="50" width="6" height="22" rx="3" fill="#2B1C12"/>
    <rect x="27" y="50" width="6" height="22" rx="3" fill="#2B1C12"/>
    <rect x="9" y="22" width="32" height="32" rx="13" fill="${color}" stroke="#3A2417" stroke-width="5"/>
    <circle cx="25" cy="13" r="13" fill="#F2C29B" stroke="#3A2417" stroke-width="5"/>
    <circle cx="21" cy="13" r="1.6" fill="#3A2417"/>
    <circle cx="29" cy="13" r="1.6" fill="#3A2417"/>
  </svg>`;
}

const PHASE_LABEL = {
  prep: 'Voorbereiding',
  shopPrompt: 'Klaar om te openen',
  shop: 'Winkel open',
  closePrompt: 'Winkel sluit',
  supermarket: 'Inkopen',
  dayEnd: 'Dag afgesloten'
};
const PROMPT_PHASES = new Set(['shopPrompt', 'closePrompt', 'dayEnd']);

function fmtMoney(n) { return Number(n || 0).toFixed(2).replace('.', ','); }
function fmtClock(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function clampNum(v, a, b) { return Math.max(a, Math.min(b, v)); }

function svgSpan(E, className, markup) {
  const span = E('span', className);
  span.innerHTML = markup;
  return span;
}

export function render({ game, els, E, action, titlebar, sound }) {
  const status = game.gameOver
    ? (game.resultText || 'Bakkermans Jones is gesloten.')
    : `Dag ${game.day} · ${fmtClock(game.clockMin)} · ${PHASE_LABEL[game.phase] || ''}`;
  els.gameStage.append(titlebar('Bakkermans Jones', status));

  const root = E('div', 'bj-root');
  root.append(renderTopbar({ game, E, action }));
  if (game.log[0]) root.append(renderTicker({ game, E }));
  if (game.koelingBroken && game.phase !== 'dayEnd') root.append(renderKoelingAlert({ game, E, action }));
  root.append(renderPhaseBody({ game, E, action, sound }));
  els.gameStage.append(root);
}

function renderTopbar({ game, E, action }) {
  const bar = E('div', 'bj-topbar');
  bar.append(E('span', 'bj-daylabel', `Dag ${game.day}`));

  const clockBlock = E('div', 'bj-clockblock');
  clockBlock.append(E('span', 'bj-clock tabular', fmtClock(game.clockMin)));
  clockBlock.append(E('span', 'bj-phase', PHASE_LABEL[game.phase] || ''));
  bar.append(clockBlock);

  const promptPhase = PROMPT_PHASES.has(game.phase);
  const controls = E('div', 'bj-controls');
  const pauseBtn = E('button', 'bj-btn bj-ghost bj-round', game.paused ? '▶' : '⏸');
  pauseBtn.type = 'button';
  pauseBtn.disabled = game.gameOver || promptPhase;
  pauseBtn.onclick = () => action('togglePause');
  controls.append(pauseBtn);

  const speedGroup = E('div', 'bj-speedgroup');
  [1, 2, 4].forEach((n) => {
    const btn = E('button', `bj-speedbtn ${game.speed === n ? 'active' : ''}`, `${n}×`);
    btn.type = 'button';
    btn.disabled = game.gameOver;
    btn.onclick = () => action('setSpeed', { value: n });
    speedGroup.append(btn);
  });
  controls.append(speedGroup);
  bar.append(controls);

  const stats = E('div', 'bj-stats');
  const moneyPill = E('div', 'bj-money-pill');
  moneyPill.append(E('span', 'bj-coin', '€'), E('span', 'tabular', fmtMoney(game.money)));
  stats.append(moneyPill);
  const repBlock = E('div', 'bj-rep-block');
  repBlock.append(E('span', 'bj-rep-label', 'Rep'));
  const meter = E('div', 'bj-rep-meter');
  const fill = E('span', 'bj-rep-fill');
  fill.style.width = `${clampNum(game.reputation, 0, 100)}%`;
  meter.append(fill);
  repBlock.append(meter, E('span', 'tabular', String(Math.round(game.reputation))));
  stats.append(repBlock);
  bar.append(stats);

  return bar;
}

function renderTicker({ game, E }) {
  const l = game.log[0];
  const row = E('div', `bj-ticker bj-log-${l.tone}`);
  row.append(E('span', 'bj-log-time tabular', fmtClock(l.min)), document.createTextNode(l.text));
  return row;
}

function renderKoelingAlert({ game, E, action }) {
  const bar = E('div', 'bj-alert');
  bar.append(svgSpan(E, 'bj-icon-small', WARN_SVG), E('span', '', 'Koeling stuk — geen taarten mogelijk.'));
  const btn = E('button', 'bj-btn bj-small', 'Herstel (€80)');
  btn.type = 'button';
  btn.disabled = game.money < 80;
  btn.onclick = () => action('repairKoeling');
  bar.append(btn);
  return bar;
}

function renderPhaseBody({ game, E, action, sound }) {
  if (game.phase === 'shopPrompt') return renderShopPromptPopup({ game, E, action });
  if (game.phase === 'shop') return renderShopScreen({ game, E, action, sound });
  if (game.phase === 'closePrompt') return renderClosePromptPopup({ game, E, action });
  if (game.phase === 'supermarket') return renderSupermarketScreen({ game, E, action });
  if (game.phase === 'dayEnd') return renderDayEndPopup({ game, E, action });
  return renderPrepScreen({ game, E, action });
}

/* ---------------- ruimtes (illustraties) ---------------- */

function scene(E, kind) { return E('div', `bj-scene bj-scene-${kind}`); }

function renderBakeryScene({ game, E }) {
  const room = scene(E, 'bakery');

  const shelf = E('div', 'bj-scene-back-shelf');
  ['bloem', 'boter', 'suiker'].forEach(() => {
    const sack = E('span', 'bj-scene-sack');
    sack.innerHTML = `<svg viewBox="0 0 40 40"><rect x="6" y="10" width="28" height="26" rx="8" fill="#E8D2A6" stroke="#3A2417" stroke-width="4"/><path d="M12 10c0-6 16-6 16 0" fill="none" stroke="#3A2417" stroke-width="3"/></svg>`;
    shelf.append(sack);
  });
  room.append(shelf);

  const ovenRow = E('div', 'bj-scene-ovens');
  game.ovens.forEach((o, idx) => {
    const box = E('div', `bj-scene-oven${o ? ' active' : ''}`);
    const win = E('div', 'bj-oven-window');
    if (o) {
      const total = o.endMin - o.startMin;
      const pct = total > 0 ? clampNum((game.clockMin - o.startMin) / total, 0, 1) : 1;
      win.style.background = `radial-gradient(circle, #FFD27A ${Math.round(15 + pct * 45)}%, #E14B3C 100%)`;
      win.style.boxShadow = `0 0 ${6 + pct * 12}px ${2 + pct * 5}px rgba(225,75,60,${(0.35 + pct * 0.4).toFixed(2)})`;
      box.append(win, E('div', 'bj-scene-oven-label tabular', `${Math.max(0, o.endMin - game.clockMin)}′`));
    } else {
      box.append(win, E('div', 'bj-scene-oven-label', String(idx + 1)));
    }
    ovenRow.append(box);
  });
  room.append(ovenRow);

  room.append(svgSpan(E, 'bj-scene-baker', BAKER_SVG));
  room.append(E('div', 'bj-scene-table'));
  return room;
}

function renderShopScene({ game, E }) {
  const room = scene(E, 'shop');

  const shelf = E('div', 'bj-scene-back-shelf');
  RECIPE_ORDER.forEach((key) => shelf.append(svgSpan(E, 'bj-scene-shelf-item', ICONS[key] || '')));
  room.append(shelf);

  room.append(E('div', 'bj-scene-door'));
  room.append(svgSpan(E, 'bj-scene-baker bj-scene-baker-behind', BAKER_SVG));
  room.append(E('div', 'bj-scene-counter'));

  const queue = E('div', 'bj-scene-queue');
  game.customerQueue.slice(0, 4).forEach((c, i) => {
    queue.append(svgSpan(E, 'bj-scene-customer', customerSvg(CUSTOMER_COLORS[i % CUSTOMER_COLORS.length])));
  });
  room.append(queue);
  return room;
}

function renderStorageScene({ game, E }) {
  const room = scene(E, 'storage');
  const shelves = E('div', 'bj-scene-shelves');
  Object.keys(game.ingredientMeta).forEach(() => {
    const sack = E('span', 'bj-scene-sack');
    sack.innerHTML = `<svg viewBox="0 0 40 40"><rect x="6" y="10" width="28" height="26" rx="8" fill="#E8D2A6" stroke="#3A2417" stroke-width="4"/><path d="M12 10c0-6 16-6 16 0" fill="none" stroke="#3A2417" stroke-width="3"/></svg>`;
    shelves.append(sack);
  });
  room.append(shelves);
  room.append(svgSpan(E, 'bj-scene-baker', BAKER_SVG));
  room.append(E('div', 'bj-scene-crate'));
  return room;
}

function renderHomeScene(E) {
  const room = scene(E, 'home');
  room.append(E('div', 'bj-scene-window'));
  room.append(E('div', 'bj-scene-bed'));
  room.append(svgSpan(E, 'bj-scene-baker', BAKER_SVG));
  return room;
}

/* ---------------- prep ---------------- */

function renderPrepScreen({ game, E, action }) {
  const wrap = E('div', 'bj-phase-wrap');
  wrap.append(renderBakeryScene({ game, E }));
  const grid = E('div', 'bj-grid-2');
  grid.append(renderStockPanel({ game, E }));
  grid.append(renderRecipePanel({ game, E, action }));
  wrap.append(grid);
  return wrap;
}

function renderStockPanel({ game, E }) {
  const panel = E('div', 'bj-panel');
  panel.append(E('h2', '', 'Voorraad'));
  const strip = E('div', 'bj-ing-strip');
  Object.entries(game.ingredients).forEach(([key, value]) => {
    const chip = E('div', `bj-ing-chip${value <= 0 ? ' empty' : ''}`);
    chip.append(E('span', '', game.ingredientMeta[key] || key), E('span', 'tabular', String(value)));
    strip.append(chip);
  });
  panel.append(strip);
  return panel;
}

function renderRecipePanel({ game, E, action }) {
  const panel = E('div', 'bj-panel');
  panel.append(E('h2', '', 'Recepten'));
  const list = E('div', 'bj-recipe-list');
  RECIPE_ORDER.forEach((key) => {
    const r = game.recipes[key];
    const hasOven = game.ovens.some((o) => o === null);
    const hasIng = Object.entries(r.kost).every(([ing, amt]) => (game.ingredients[ing] || 0) >= amt);
    const koelBlocked = r.koeling && game.koelingBroken;
    const disabled = !hasOven || !hasIng || koelBlocked;
    const btn = E('button', 'bj-recipe-btn');
    btn.type = 'button';
    btn.disabled = disabled;
    btn.title = koelBlocked ? 'Koeling is stuk' : !hasOven ? 'Geen vrije oven' : !hasIng ? 'Te weinig ingrediënten' : '';
    btn.append(svgSpan(E, 'bj-icon', ICONS[key] || ''));
    const text = E('span', 'bj-recipe-text');
    text.append(
      E('span', 'bj-recipe-name', r.naam),
      E('span', 'bj-recipe-meta', `${r.batch}× · ${r.bakMin} min · €${fmtMoney(r.prijs)}/stuk`),
      E('span', 'bj-recipe-cost', Object.entries(r.kost).map(([k, v]) => `${v} ${game.ingredientMeta[k] || k}`).join(' · '))
    );
    btn.append(text);
    btn.onclick = () => action('bake', { key });
    list.append(btn);
  });
  panel.append(list);
  return panel;
}

/* ---------------- winkel ---------------- */

function renderShopScreen({ game, E, action, sound }) {
  const wrap = E('div', 'bj-phase-wrap');
  wrap.append(renderShopScene({ game, E }));
  const grid = E('div', 'bj-grid-2');
  grid.append(renderCustomerPanel({ game, E, action, sound }));
  grid.append(renderOrdersPanel({ game, E, action, sound }));
  wrap.append(grid);
  return wrap;
}

function renderCustomerPanel({ game, E, action, sound }) {
  const panel = E('div', 'bj-panel');
  panel.append(E('h2', '', 'Op de plank'));
  const strip = E('div', 'bj-ing-strip');
  RECIPE_ORDER.forEach((key) => {
    const chip = E('div', 'bj-ing-chip');
    chip.append(svgSpan(E, 'bj-icon-small', ICONS[key] || ''), E('span', 'tabular', String(game.shelf[key] || 0)));
    strip.append(chip);
  });
  panel.append(strip);

  panel.append(E('h2', '', 'Klanten'));
  const list = E('div', 'bj-customer-list');
  if (!game.customerQueue.length) list.append(E('p', 'bj-muted', 'Nog geen klanten binnen.'));
  game.customerQueue.forEach((c) => {
    const r = game.recipes[c.wants.key];
    const left = c.patience - (game.clockMin - c.bornAt);
    const pct = clampNum((left / c.patience) * 100, 0, 100);
    const stripe = pct > 50 ? 'good' : pct > 25 ? 'mid' : 'low';
    const canServe = (game.shelf[c.wants.key] || 0) >= c.wants.qty;
    const card = E('div', `bj-customer-card bj-stripe-${stripe}`);
    card.append(svgSpan(E, 'bj-icon', ICONS[c.wants.key] || ''));
    const text = E('div', 'bj-customer-text');
    text.append(E('div', 'bj-customer-want', `${c.wants.qty}× ${r.naam}`));
    const patienceBar = E('div', 'bj-patience-bar');
    const span = E('span', '');
    span.style.width = `${pct}%`;
    patienceBar.append(span);
    text.append(patienceBar);
    card.append(text);
    const btn = E('button', 'bj-btn bj-primary bj-small', 'Bedien');
    btn.type = 'button';
    btn.disabled = !canServe;
    btn.onclick = () => { sound('score'); action('serveCustomer', { id: c.id }); };
    card.append(btn);
    list.append(card);
  });
  panel.append(list);
  return panel;
}

function renderOrdersPanel({ game, E, action, sound }) {
  const panel = E('div', 'bj-panel');
  panel.append(E('h2', '', 'Bestellingen & evenement'));
  const list = E('div', 'bj-orders-list');
  if (!game.orders.length && !game.event) list.append(E('p', 'bj-muted', 'Geen openstaande bestellingen.'));

  game.orders.forEach((o) => {
    const r = game.recipes[o.product];
    const can = o.status === 'open' && (game.shelf[o.product] || 0) >= o.qty;
    const statusLabel = o.status === 'open' ? `vóór ${fmtClock(o.due)}` : o.status === 'done' ? 'voltooid' : 'mislukt';
    const ticket = E('div', `bj-ticket bj-ticket-${o.status}`);
    ticket.append(E('div', 'bj-ticket-head', `Bestelling · ${r.naam}`));
    const body = E('div', 'bj-ticket-body');
    const item = E('div', 'bj-ticket-item');
    item.append(svgSpan(E, 'bj-icon-small', ICONS[o.product] || ''), E('span', '', `${o.qty}× ${r.naam}`));
    body.append(item, E('div', 'bj-ticket-time', `${statusLabel} · +€${fmtMoney(o.reward)}`));
    if (o.status === 'open') {
      const btn = E('button', 'bj-btn bj-primary bj-small', 'Leveren');
      btn.type = 'button';
      btn.disabled = !can;
      btn.onclick = () => { sound('score'); action('deliverOrder', { id: o.id }); };
      body.append(btn);
    }
    ticket.append(body);
    list.append(ticket);
  });

  if (game.event) {
    const ev = game.event;
    const ticket = E('div', `bj-ticket bj-ticket-event bj-ticket-${ev.status}`);
    ticket.append(E('div', 'bj-ticket-head', `Evenement · ${ev.title}`));
    const body = E('div', 'bj-ticket-body');
    Object.entries(ev.needs).forEach(([k, v]) => {
      const item = E('div', 'bj-ticket-item');
      item.append(svgSpan(E, 'bj-icon-small', ICONS[k] || ''), E('span', '', `${game.shelf[k] || 0}/${v}× ${game.recipes[k].naam}`));
      body.append(item);
    });
    const can = ev.status === 'open' && Object.entries(ev.needs).every(([k, v]) => (game.shelf[k] || 0) >= v);
    const statusLabel = ev.status === 'open' ? `vóór ${fmtClock(ev.due)}` : ev.status === 'done' ? 'voltooid' : 'mislukt';
    body.append(E('div', 'bj-ticket-time', `${statusLabel} · +€${fmtMoney(ev.reward)}`));
    if (ev.status === 'open') {
      const btn = E('button', 'bj-btn bj-primary bj-small', 'Leveren');
      btn.type = 'button';
      btn.disabled = !can;
      btn.onclick = () => { sound('score'); action('deliverEvent'); };
      body.append(btn);
    }
    ticket.append(body);
    list.append(ticket);
  }
  panel.append(list);
  return panel;
}

/* ---------------- supermarkt ---------------- */

function renderSupermarketScreen({ game, E, action }) {
  const wrap = E('div', 'bj-phase-wrap');
  wrap.append(renderStorageScene({ game, E }));
  const panel = E('div', 'bj-panel bj-market-panel');
  panel.append(E('h2', '', 'Supermarkt'));
  panel.append(E('p', 'bj-muted', `Koop ingrediënten voor morgen — sluit om ${fmtClock(game.supermarketEnd)}.`));
  const grid = E('div', 'bj-market-grid');
  Object.entries(game.ingredientMeta).forEach(([key, label]) => {
    const price = game.ingredientPrices[key];
    const batchCost = price * game.buyBatch;
    const card = E('div', 'bj-market-card');
    card.append(svgSpan(E, 'bj-icon', ICONS[key] || ''));
    const info = E('div', 'bj-market-info');
    info.append(
      E('div', 'bj-market-name', label),
      E('div', 'bj-market-stock tabular', `Voorraad: ${game.ingredients[key] || 0}`),
      E('div', 'bj-market-price', `€${fmtMoney(price)}/stuk`)
    );
    card.append(info);
    const btn = E('button', 'bj-btn bj-small', `+${game.buyBatch} · €${fmtMoney(batchCost)}`);
    btn.type = 'button';
    btn.disabled = game.money < batchCost;
    btn.onclick = () => action('buyIngredient', { key });
    card.append(btn);
    grid.append(card);
  });
  panel.append(grid);
  wrap.append(panel);
  return wrap;
}

/* ---------------- pop-ups ---------------- */

function popupCard(E, className) {
  const overlay = E('div', 'bj-popup');
  const card = E('div', `bj-popup-card ${className || ''}`);
  overlay.append(card);
  return { overlay, card };
}

function renderShopPromptPopup({ game, E, action }) {
  const { overlay, card } = popupCard(E);
  card.append(E('h3', '', 'Klaar om te openen?'));
  card.append(E('p', '', `Het is ${fmtClock(game.clockMin)}. Zodra je opent, komen de eerste klanten binnen.`));
  const btn = E('button', 'bj-btn bj-primary', 'Open de winkel');
  btn.type = 'button';
  btn.onclick = () => action('openShop');
  card.append(btn);
  return overlay;
}

function renderClosePromptPopup({ game, E, action }) {
  const { overlay, card } = popupCard(E);
  card.append(E('h3', '', 'Winkel gesloten'));
  card.append(E('p', '', 'Tijd om inkopen te doen voor morgen bij de supermarkt.'));
  const btn = E('button', 'bj-btn bj-primary', 'Naar de supermarkt');
  btn.type = 'button';
  btn.onclick = () => action('goToSupermarket');
  card.append(btn);
  return overlay;
}

function renderDayEndPopup({ game, E, action }) {
  const { overlay, card } = popupCard(E, 'bj-dayend');
  card.append(renderHomeScene(E));
  if (game.gameOver) {
    card.append(
      E('h3', '', 'Failliet…'),
      E('p', '', `Bakkermans Jones moet helaas de deuren sluiten. Eindstand: €${fmtMoney(game.money)} op dag ${game.day}.`)
    );
    return overlay;
  }
  card.append(E('h3', '', `Dag ${game.day} afgesloten`));
  const rows = [
    ['Omzet klanten', `+€${fmtMoney(game.stats.revenueToday)}`],
    ['Klanten bediend / gemist', `${game.stats.served} / ${game.stats.missed}`],
    ['Bestellingen voltooid / mislukt', `${game.stats.ordersDone} / ${game.stats.ordersFailed}`],
    ['Vaste kosten', `-€${fmtMoney(game.dailyCost)}`],
    ['Geld nu', `€${fmtMoney(game.money)}`],
    ['Reputatie', `${Math.round(game.reputation)}/100`]
  ];
  rows.forEach(([label, value]) => {
    const row = E('div', 'bj-modal-row');
    row.append(E('span', '', label), E('span', 'tabular', value));
    card.append(row);
  });
  const btn = E('button', 'bj-btn bj-primary', 'Volgende dag →');
  btn.type = 'button';
  btn.onclick = () => action('nextDay');
  card.append(btn);
  return overlay;
}

export function metric({ game }) {
  return { text: `€${fmtMoney(game.money)} · dag ${game.day}`, score: Math.round(game.money) };
}

export function isWinner() { return false; }

export function presentResult({ room, game }) {
  const me = room.players.find((p) => p.id === room.meId);
  return {
    title: me?.name || 'Bakkermans Jones',
    copy: game.resultText || `Failliet na dag ${game.day}.`
  };
}
