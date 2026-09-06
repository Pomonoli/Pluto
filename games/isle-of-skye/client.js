const ROTATIONS = [0, 90, 180, 270];
const TERRAIN_META = { pasture: { label: 'Weide', icon: '🌾' }, mountain: { label: 'Berg', icon: '🏔️' }, water: { label: 'Water', icon: '🌊' } };
const FEATURE_META = {
  whisky: { icon: '🥃', label: 'Whisky' },
  sheep: { icon: '🐑', label: 'Schapen' },
  cattle: { icon: '🐄', label: 'Vee' },
  ship: { icon: '⛵', label: 'Schip' }
};
const CATEGORY_LABELS = { SCORING_WHISKY: 'Whisky', SCORING_SHEEP: 'Schapen', SCORING_CATTLE: 'Vee', SCORING_SHIPS: 'Schepen' };
const LEGEND_ITEMS = [
  { icon: '🌾', label: 'Weide' },
  { icon: '🏔️', label: 'Berg' },
  { icon: '🌊', label: 'Water' },
  { icon: '🛣️', label: 'Weg' },
  { icon: '🏰', label: 'Kasteel' },
  { icon: '🥃', label: 'Whisky' },
  { icon: '🐑', label: 'Schapen' },
  { icon: '🐄', label: 'Vee' },
  { icon: '⛵', label: 'Schip' }
];

let selectedIndex = null;
let rotationIndex = 0;
let priceDraft = null;
let lastKey = '';

function key(x, y) { return `${x},${y}`; }
function playerById(game, id) { return game.players.find((player) => player.id === id); }
function rotatedEdges(edges, rotation) {
  const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
  let current = edges;
  for (let i = 0; i < steps; i++) current = { top: current.left, right: current.top, bottom: current.right, left: current.bottom };
  return current;
}

function tileNode(E, tile, { mini = false } = {}) {
  const isCastle = tile.id === 'castle';
  const node = E('div', `isle-tile${mini ? ' mini' : ''}${isCastle ? ' castle' : ''}${tile.hasRoad ? ' has-road' : ''}`);
  const edges = rotatedEdges(tile.edges, tile.rotation || 0);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const meta = TERRAIN_META[edges[side]] || {};
    const wedge = E('span', `isle-wedge isle-wedge-${side} terrain-${edges[side]}`, mini ? '' : meta.icon || '');
    wedge.title = meta.label || edges[side];
    node.append(wedge);
  }
  const medallion = E('span', 'isle-medallion');
  if (isCastle) {
    medallion.append(E('span', 'isle-medallion-icon', '🏰'));
    medallion.title = 'Kasteel';
  } else {
    const feature = (tile.features || [])[0];
    if (feature) {
      const meta = FEATURE_META[feature.type] || {};
      medallion.append(E('span', 'isle-medallion-icon', meta.icon || '?'));
      if (feature.count > 1) medallion.append(E('span', 'isle-medallion-badge', String(feature.count)));
      medallion.title = `${meta.label || feature.type}${feature.count > 1 ? ` ×${feature.count}` : ''}`;
    } else if (tile.hasRoad) {
      medallion.title = 'Wegverbinding';
    }
  }
  node.append(medallion);
  return node;
}

function renderLegend(E) {
  const legend = E('div', 'isle-legend');
  for (const item of LEGEND_ITEMS) legend.append(E('span', 'isle-legend-item', `${item.icon} ${item.label}`));
  return legend;
}

function boundsFor(board) {
  const cells = board.map((cell) => cell);
  const xs = cells.map((c) => c.x), ys = cells.map((c) => c.y);
  return { minX: Math.min(...xs) - 1, maxX: Math.max(...xs) + 1, minY: Math.min(...ys) - 1, maxY: Math.max(...ys) + 1 };
}

function renderMiniBoard(E, player) {
  const card = E('div', 'isle-mini-card');
  const head = E('div', 'isle-mini-head');
  head.append(E('strong', '', player.name), E('span', '', `${player.score} pt · ${player.gold}g`));
  card.append(head);
  const bounds = boundsFor(player.board);
  const map = new Map(player.board.map((cell) => [key(cell.x, cell.y), cell]));
  const grid = E('div', 'isle-mini-grid');
  grid.style.gridTemplateColumns = `repeat(${bounds.maxX - bounds.minX + 1}, 1fr)`;
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const cell = map.get(key(x, y));
      grid.append(cell ? tileNode(E, cell.tile, { mini: true }) : E('span', 'isle-mini-empty'));
    }
  }
  const scroller = E('div', 'isle-mini-scroll');
  scroller.append(grid);
  card.append(scroller);
  return card;
}

function renderMainBoard(E, game, me, action, rerender) {
  const section = E('section', 'isle-board-section');
  const head = E('div', 'isle-section-head');
  head.append(E('strong', '', 'Jouw eiland'), E('small', '', `${me.score} punten · ${me.gold} goud`));
  section.append(head);

  const legalOptions = selectedIndex !== null ? (game.legalPlacements[selectedIndex] || []) : [];
  const canPlaceNow = (game.canBuy || game.canSellerPlace) && selectedIndex !== null;
  if (canPlaceNow) {
    const tools = E('div', 'isle-turn-tools');
    tools.append(E('small', '', 'Gekozen tegel'), tileNode(E, { ...game.market[selectedIndex], rotation: ROTATIONS[rotationIndex] }));
    const rotateButtons = E('div', 'isle-rotate-buttons');
    ROTATIONS.forEach((rotation, index) => {
      const count = legalOptions.filter((option) => option.rotation === rotation).length;
      const button = E('button', `isle-rotate${index === rotationIndex ? ' active' : ''}`, `${rotation}° (${count})`);
      button.type = 'button';
      button.addEventListener('click', () => { rotationIndex = index; rerender(); });
      rotateButtons.append(button);
    });
    tools.append(rotateButtons);
    const cancel = E('button', 'secondary', 'Andere tegel kiezen');
    cancel.type = 'button';
    cancel.addEventListener('click', () => { selectedIndex = null; rerender(); });
    tools.append(cancel);
    section.append(tools);
  }

  const legalCells = new Set(legalOptions.filter((option) => option.rotation === ROTATIONS[rotationIndex]).map((option) => key(option.x, option.y)));
  const bounds = boundsFor(me.board);
  const map = new Map(me.board.map((cell) => [key(cell.x, cell.y), cell]));
  const board = E('div', 'isle-board');
  board.style.gridTemplateColumns = `repeat(${bounds.maxX - bounds.minX + 1}, 1fr)`;
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const cell = map.get(key(x, y));
      const isLegal = canPlaceNow && legalCells.has(key(x, y));
      if (cell) { board.append(tileNode(E, cell.tile)); continue; }
      const button = E('button', `isle-empty-cell${isLegal ? ' legal' : ''}`);
      button.type = 'button';
      button.disabled = !isLegal;
      button.textContent = isLegal ? '+' : '';
      if (isLegal) button.addEventListener('click', () => {
        const payload = { tileIndex: selectedIndex, x, y, rotation: ROTATIONS[rotationIndex] };
        action(game.canBuy ? 'buy' : 'sellerPlace', payload);
        selectedIndex = null; rotationIndex = 0;
      });
      button.setAttribute('aria-label', isLegal ? 'Geldige plek' : 'Leeg vak');
      board.append(button);
    }
  }
  const scroller = E('div', 'isle-board-scroll');
  scroller.append(board);
  section.append(scroller);
  return section;
}

function renderMarket(E, game, me, action, rerender) {
  const section = E('section', 'isle-market');
  const head = E('div', 'isle-section-head');
  const seller = playerById(game, game.sellerId);
  head.append(E('strong', '', 'Markt'), E('small', '', `Verkoper: ${seller?.name || ''}`));
  section.append(head);

  if (game.canSetPrices && (!priceDraft || priceDraft.length !== game.market.length)) priceDraft = game.market.map(() => 1);

  const row = E('div', 'isle-market-row');
  game.market.forEach((tile, idx) => {
    const card = E('div', 'isle-market-card');
    card.append(tileNode(E, tile));
    if (tile.takenBy) {
      const owner = playerById(game, tile.takenBy);
      card.append(E('span', 'isle-taken', `Verkocht aan ${owner?.name || '?'}`));
    } else if (game.canSetPrices) {
      const priceRow = E('div', 'isle-price-row');
      [0, 1, 2, 3].forEach((price) => {
        const button = E('button', `isle-price${priceDraft[idx] === price ? ' active' : ''}`, `${price}g`);
        button.type = 'button';
        button.addEventListener('click', () => { priceDraft[idx] = price; rerender(); });
        priceRow.append(button);
      });
      card.append(priceRow);
    } else {
      card.append(E('span', 'isle-price-tag', tile.price === null || tile.price === undefined ? '…' : `${tile.price}g`));
      const canChoose = (game.canBuy || game.canSellerPlace) && (game.legalPlacements[idx] || []).length > 0 && (!game.canBuy || tile.price <= me.gold);
      if (canChoose) {
        const choose = E('button', `primary${selectedIndex === idx ? ' active' : ''}`, selectedIndex === idx ? 'Gekozen' : 'Kies');
        choose.type = 'button';
        choose.addEventListener('click', () => { selectedIndex = idx; rotationIndex = 0; rerender(); });
        card.append(choose);
      }
    }
    row.append(card);
  });
  section.append(row);

  if (game.canSetPrices) {
    const confirm = E('button', 'primary', 'Bevestig prijzen');
    confirm.type = 'button';
    confirm.addEventListener('click', () => action('setPrices', { prices: priceDraft }));
    section.append(confirm);
  }
  if (game.canBuy) {
    const pass = E('button', 'secondary', 'Niets kopen');
    pass.type = 'button';
    pass.addEventListener('click', () => { selectedIndex = null; action('pass'); });
    section.append(pass);
  }
  if (game.canSellerPlace) {
    const skip = E('button', 'secondary', 'Gratis tegel overslaan');
    skip.type = 'button';
    skip.addEventListener('click', () => { selectedIndex = null; action('sellerSkip'); });
    section.append(skip);
  }
  return section;
}

function statusText(game) {
  if (game.gameOver) return game.resultText;
  const seller = playerById(game, game.sellerId);
  if (game.phase === 'price') return game.canSetPrices ? 'Bepaal de prijzen van je markt.' : `${seller?.name || ''} bepaalt de prijzen.`;
  if (game.phase === 'buy') {
    const buyer = playerById(game, game.turnPlayerId);
    return game.canBuy ? 'Koop een tegel of sla over.' : `${buyer?.name || ''} overweegt een aankoop.`;
  }
  if (game.phase === 'sellerPlace') return game.canSellerPlace ? 'Plaats gratis een overgebleven tegel.' : `${seller?.name || ''} plaatst de laatste tegel.`;
  return '';
}

export function render(api) {
  const { room, game, els, E, action, titlebar, logBox, renderGame } = api;
  const rerender = () => renderGame(room);
  const me = playerById(game, room.meId);

  const stateKey = `${game.phase}:${game.sellerId}:${game.market.map((t) => t.id).join(',')}`;
  if (stateKey !== lastKey) { selectedIndex = null; rotationIndex = 0; priceDraft = null; lastKey = stateKey; }

  els.gameStage.append(titlebar('Isle of Skye', statusText(game)));

  const meta = E('div', 'isle-meta');
  meta.append(E('span', 'badge', `Ronde ${game.round}/${game.totalRounds}`));
  meta.append(E('span', 'isle-categories', `Scoort op: ${(game.scoringCategories || []).map((c) => CATEGORY_LABELS[c]).join(', ')}`));
  els.gameStage.append(meta);

  const strip = E('div', 'isle-players');
  game.players.forEach((player) => {
    const item = E('div', `isle-player${player.id === game.sellerId ? ' selling' : ''}${player.id === game.turnPlayerId ? ' active' : ''}`);
    item.append(E('strong', '', player.name), E('span', '', `${player.score} pt`), E('small', '', `${player.gold} goud`));
    strip.append(item);
  });
  els.gameStage.append(strip);
  els.gameStage.append(renderLegend(E));

  const layout = E('div', 'isle-layout');
  const main = E('div', 'isle-main');
  if (game.market.length) main.append(renderMarket(E, game, me, action, rerender));
  if (me) main.append(renderMainBoard(E, game, me, action, rerender));
  layout.append(main);

  const aside = E('aside', 'isle-overview');
  aside.append(E('div', 'isle-section-head', 'Eilanden'));
  game.players.filter((player) => player.id !== room.meId).forEach((player) => aside.append(renderMiniBoard(E, player)));
  layout.append(aside);

  els.gameStage.append(layout, logBox(game.log));
}

export function metric({ player }) { return { text: `${player.score || 0} pt`, score: Number(player.score || 0) }; }
export function presentResult({ game }) {
  const winners = game.players.filter((player) => (game.winnerIds || []).includes(player.id));
  return { title: winners.length > 1 ? 'Gelijkspel' : (winners[0]?.name || 'Isle of Skye'), copy: game.resultText || 'Spel afgelopen.' };
}
export function isWinner({ game, myId }) { return (game.winnerIds || []).length === 1 && game.winnerIds[0] === myId; }
