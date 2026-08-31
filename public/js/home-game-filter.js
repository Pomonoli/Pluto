'use strict';

const heading = document.getElementById('gamesHeading');
const grid = document.getElementById('gameGrid');

if (heading && grid) {
  const style = document.createElement('style');
  style.textContent = `
    #gamesHeading.games-heading-filterable{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
    #gamesHeading.games-heading-filterable .eyebrow{margin-bottom:0}
    .games-player-filter{position:relative;margin-left:auto}
    .games-player-filter-button{width:38px;height:38px;min-height:38px;padding:0;display:grid;place-items:center;position:relative;border-radius:10px}
    .games-player-filter-button svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .games-player-filter-button.active::after{content:'';position:absolute;top:7px;right:7px;width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 2px var(--panel)}
    .games-player-filter-popover{position:absolute;z-index:120;top:calc(100% + 8px);right:0;width:min(280px,calc(100vw - 36px));padding:14px;border:1px solid var(--border);border-radius:13px;background:var(--panel);box-shadow:0 18px 45px rgba(0,0,0,.35)}
    .games-player-filter-popover strong{display:block;font-size:13px}
    .games-player-filter-value{margin-top:3px;color:var(--muted);font-size:11px}
    .games-player-filter-range{width:100%;min-height:30px;height:30px;margin:10px 0 1px;padding:0;border:0;border-radius:0;background:transparent;accent-color:var(--accent);box-shadow:none}
    .games-player-filter-scale{display:flex;justify-content:space-between;gap:4px;color:var(--muted);font-size:9px;font-weight:800}
    .games-player-filter-empty{grid-column:1/-1;margin:0;padding:18px;border:1px dashed var(--border);border-radius:14px;color:var(--muted);text-align:center;font-size:12px}
  `;
  document.head.append(style);
  heading.classList.add('games-heading-filterable');

  const filter = document.createElement('div');
  filter.className = 'games-player-filter';
  filter.innerHTML = `
    <button type="button" class="ghost games-player-filter-button" aria-label="Filter games op aantal spelers" aria-haspopup="true" aria-expanded="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
    </button>
    <div class="games-player-filter-popover hidden">
      <strong>Aantal spelers</strong>
      <div class="games-player-filter-value">Alle spelers</div>
      <input type="range" class="games-player-filter-range" min="0" max="6" step="1" value="0" aria-label="Aantal spelers">
      <div class="games-player-filter-scale"></div>
    </div>`;
  heading.append(filter);

  const button = filter.querySelector('.games-player-filter-button');
  const popover = filter.querySelector('.games-player-filter-popover');
  const value = filter.querySelector('.games-player-filter-value');
  const range = filter.querySelector('.games-player-filter-range');
  const scale = filter.querySelector('.games-player-filter-scale');
  const empty = document.createElement('p');
  empty.className = 'games-player-filter-empty hidden';
  grid.after(empty);

  let gamesByKey = new Map();
  let currentPlayers = 0;

  function keepHeadingVisible() {
    if (grid.querySelector('.game-card') && heading.classList.contains('hidden')) {
      heading.classList.remove('hidden');
    }
  }

  function setPopover(open) {
    popover.classList.toggle('hidden', !open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function renderScale(maxPlayers) {
    scale.replaceChildren();
    for (let count = 0; count <= maxPlayers; count += 1) {
      const tick = document.createElement('span');
      tick.textContent = count === 0 ? 'Alle' : String(count);
      scale.append(tick);
    }
  }

  function applyFilter() {
    const cards = [...grid.querySelectorAll('.game-card')];
    let visible = 0;
    for (const card of cards) {
      const key = card.querySelector('[data-game]')?.dataset.game;
      const meta = gamesByKey.get(key);
      const matches = !currentPlayers || !meta || (meta.minPlayers <= currentPlayers && meta.maxPlayers >= currentPlayers);
      card.classList.toggle('hidden', !matches);
      if (matches) visible += 1;
    }

    value.textContent = currentPlayers === 0 ? 'Alle spelers' : `${currentPlayers} ${currentPlayers === 1 ? 'speler' : 'spelers'}`;
    button.classList.toggle('active', currentPlayers > 0);
    button.setAttribute('aria-label', currentPlayers > 0 ? `Filter actief: ${value.textContent}` : 'Filter games op aantal spelers');
    empty.textContent = currentPlayers > 0 ? `Geen games voor ${value.textContent}.` : '';
    empty.classList.toggle('hidden', visible > 0 || cards.length === 0);
    keepHeadingVisible();
  }

  button.addEventListener('click', () => setPopover(popover.classList.contains('hidden')));
  range.addEventListener('input', () => {
    currentPlayers = Number(range.value) || 0;
    applyFilter();
  });
  document.addEventListener('click', (event) => {
    if (!filter.contains(event.target)) setPopover(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !popover.classList.contains('hidden')) {
      setPopover(false);
      button.focus();
    }
  });

  new MutationObserver(applyFilter).observe(grid, { childList:true });
  new MutationObserver(keepHeadingVisible).observe(heading, { attributes:true, attributeFilter:['class'] });

  fetch('/api/game-plugins', { cache:'no-store' })
    .then((response) => response.json())
    .then((data) => {
      if (!data.ok || !Array.isArray(data.games)) throw new Error(data.error || 'Gamegegevens konden niet laden.');
      gamesByKey = new Map(data.games.map((game) => [game.key, game]));
      const maxPlayers = Math.max(1, ...data.games.map((game) => Number(game.maxPlayers) || 1));
      range.max = String(maxPlayers);
      renderScale(maxPlayers);
      applyFilter();
    })
    .catch((error) => {
      console.error('Spelersfilter kon niet laden:', error);
      filter.remove();
    });

  renderScale(Number(range.max));
  applyFilter();
}
