'use strict';

(() => {
  function setOpen(open) {
    const modal = document.getElementById('settingsModal');
    const button = document.getElementById('settingsButton');
    if (!modal || !button) return;
    modal.classList.toggle('hidden', !open);
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) document.getElementById('closeSettingsButton')?.focus();
    else button.focus();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('settingsButton');
    const modal = document.getElementById('settingsModal');
    const close = document.getElementById('closeSettingsButton');
    if (!button || !modal || !close) return;

    button.addEventListener('click', () => setOpen(true));
    close.addEventListener('click', () => setOpen(false));
    modal.addEventListener('click', (event) => {
      if (event.target === modal) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) setOpen(false);
    });
  });
})();
