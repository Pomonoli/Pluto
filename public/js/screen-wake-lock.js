export function createScreenWakeLock({ navigator, document, window }) {
  let active = false;
  let hiddenPage = false;
  let sentinel = null;
  let pending = false;
  const wanted = () => active && !hiddenPage && document.visibilityState === 'visible';

  async function sync() {
    if (!wanted()) {
      const previous = sentinel;
      sentinel = null;
      try { await previous?.release(); } catch (_) {}
      return;
    }
    if (sentinel || pending || !navigator.wakeLock?.request) return;
    pending = true;
    try {
      const acquired = await navigator.wakeLock.request('screen');
      if (!wanted()) { await acquired.release(); return; }
      sentinel = acquired;
      acquired.addEventListener('release', () => {
        if (sentinel === acquired) sentinel = null;
      });
    } catch (_) {
      // Unsupported devices, battery saving and permission refusal are silent.
    } finally {
      pending = false;
    }
  }

  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { hiddenPage = true; sync(); });
  window.addEventListener('pageshow', () => { hiddenPage = false; sync(); });
  return {
    setActive(value) {
      if (active === Boolean(value)) return;
      active = Boolean(value);
      sync();
    }
  };
}
