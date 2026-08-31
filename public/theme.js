'use strict';

(() => {
  const STORAGE_KEY = 'pluto.theme';
  const DEFAULT_THEME = 'pluto-1-7-3';
  const THEMES = {
    'pluto-1-7-3': { color: '#090b13' },
    'pluto-1-8-0': { color: '#cf641f' }
  };

  function normalizeTheme(value) {
    return Object.prototype.hasOwnProperty.call(THEMES, value) ? value : DEFAULT_THEME;
  }

  function currentTheme() {
    return normalizeTheme(document.documentElement.dataset.theme || localStorage.getItem(STORAGE_KEY));
  }

  function applyTheme(value, persist = false) {
    const theme = normalizeTheme(value);
    document.documentElement.dataset.theme = theme;
    if (persist) localStorage.setItem(STORAGE_KEY, theme);

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', THEMES[theme].color);

    const select = document.getElementById('themeSelect');
    if (select && select.value !== theme) select.value = theme;
    syncGameCards();
  }

  function syncGameCards() {
    const preview = currentTheme() === 'pluto-1-8-0';
    document.querySelectorAll('#gameGrid .game-card').forEach((card) => {
      const launch = card.querySelector('.game-launch');
      const available = Boolean(launch && !launch.disabled);
      card.classList.toggle('theme-card-launchable', preview && available);
      if (preview && available) {
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Start ${card.querySelector('h3')?.textContent || 'spel'}`);
        card.removeAttribute('aria-disabled');
      } else {
        card.removeAttribute('tabindex');
        card.removeAttribute('role');
        card.removeAttribute('aria-label');
        if (preview && !available) card.setAttribute('aria-disabled', 'true');
        else card.removeAttribute('aria-disabled');
      }
    });
  }

  function launchCard(card) {
    if (currentTheme() !== 'pluto-1-8-0') return;
    const launch = card?.querySelector('.game-launch');
    if (!launch || launch.disabled) return;
    launch.click();
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME);

    const select = document.getElementById('themeSelect');
    if (select) {
      select.value = currentTheme();
      select.addEventListener('change', () => applyTheme(select.value, true));
    }

    const grid = document.getElementById('gameGrid');
    if (grid) {
      grid.addEventListener('click', (event) => {
        const card = event.target.closest('.game-card');
        if (!card || event.target.closest('button,a,input,select,textarea')) return;
        launchCard(card);
      });
      grid.addEventListener('keydown', (event) => {
        const card = event.target.closest('.game-card');
        if (!card || event.target !== card || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        launchCard(card);
      });
      new MutationObserver(syncGameCards).observe(grid, { childList: true, subtree: true });
    }

    syncGameCards();
  });
})();
