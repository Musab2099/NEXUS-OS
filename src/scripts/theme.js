// NEXUS theme controller.
// Applies the saved theme and synchronizes theme changes between browser tabs.
(function initializeThemeController() {
  'use strict';

  // ─── CONFIGURATION ───────────────────────────────────────────────
  const THEME_STORAGE_KEY = 'nexus-theme';
  const THEME_INDEX_KEY = 'nexus-theme-index';
  const LEGACY_THEME_KEY = 'nexus_theme';
  const THEMES = {
    'nexus-dark': { label: 'NEXUS Dark', color: '#07051A' },
    periwinkle: { label: 'Focus', color: '#0D1030' },
    'arctic-white': { label: 'Arctic White', color: '#EEF5FF' },
  };
  const THEME_ALIASES = {
    amethyst: 'nexus-dark',
    peri: 'periwinkle',
    arctic: 'arctic-white',
    ice: 'arctic-white',
  };

  // ─── NORMALIZATION ──────────────────────────────────────────────
  function normalizeTheme(theme) {
    const normalizedTheme = THEME_ALIASES[theme] || theme;
    return Object.prototype.hasOwnProperty.call(THEMES, normalizedTheme)
      ? normalizedTheme
      : null;
  }

  // ─── STORAGE ─────────────────────────────────────────────────────
  function readStoredTheme() {
    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
        || window.localStorage.getItem(LEGACY_THEME_KEY);
      const normalizedTheme = normalizeTheme(savedTheme);

      if (normalizedTheme) return normalizedTheme;

      const themeIndex = Number(window.localStorage.getItem(THEME_INDEX_KEY));
      const themeKeys = Object.keys(THEMES);
      return Number.isInteger(themeIndex) && themeKeys[themeIndex]
        ? themeKeys[themeIndex]
        : null;
    } catch (error) {
      console.warn('[NEXUS theme] preference read failed', error);
      return null;
    }
  }

  function getPreferredTheme() {
    return readStoredTheme()
      || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'arctic-white'
        : 'nexus-dark');
  }

  function saveTheme(theme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      window.localStorage.setItem(THEME_INDEX_KEY, String(Object.keys(THEMES).indexOf(theme)));
    } catch (error) {
      console.warn('[NEXUS theme] preference save failed', error);
    }
  }

  // ─── APPLICATION ─────────────────────────────────────────────────
  function updateThemeColor(theme) {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) metaThemeColor.setAttribute('content', THEMES[theme].color);
  }

  function applyTheme(theme, persist) {
    const activeTheme = normalizeTheme(theme) || getPreferredTheme();
    document.documentElement.setAttribute('data-theme', activeTheme);

    if (persist) saveTheme(activeTheme);
    updateThemeColor(activeTheme);
    window.dispatchEvent(new CustomEvent('nexus-theme-change', {
      detail: { theme: activeTheme },
    }));

    return activeTheme;
  }

  // ─── PUBLIC API ──────────────────────────────────────────────────
  window.NexusTheme = {
    key: THEME_STORAGE_KEY,
    indexKey: THEME_INDEX_KEY,
    themes: THEMES,
    get: () => normalizeTheme(document.documentElement.getAttribute('data-theme')) || getPreferredTheme(),
    set: (theme) => applyTheme(theme, true),
    init: () => applyTheme(getPreferredTheme(), true),
  };

  // ─── BOOT ────────────────────────────────────────────────────────
  window.NexusTheme.init();
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY && normalizeTheme(event.newValue)) {
      applyTheme(event.newValue, false);
    }
  });
})();
