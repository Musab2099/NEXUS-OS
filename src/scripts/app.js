// NEXUS application bootstrap.
// This file runs synchronously in each page head so the saved theme and the
// initial navigation state are applied before the browser paints the shell.
(function bootstrapNexus() {
  'use strict';

  // ─── CONFIGURATION ───────────────────────────────────────────────
  const THEME_KEYS = ['nexus-dark', 'periwinkle', 'arctic-white'];
  const THEME_ALIASES = {
    amethyst: 'nexus-dark',
    peri: 'periwinkle',
    arctic: 'arctic-white',
    ice: 'arctic-white',
  };

  // ─── STORAGE ─────────────────────────────────────────────────────
  function readStoredTheme() {
    try {
      const savedTheme = window.localStorage.getItem('nexus-theme')
        || window.localStorage.getItem('nexus_theme');
      const themeIndex = Number(window.localStorage.getItem('nexus-theme-index'));
      const normalizedTheme = THEME_ALIASES[savedTheme] || savedTheme;

      if (THEME_KEYS.includes(normalizedTheme)) return normalizedTheme;
      if (Number.isInteger(themeIndex) && THEME_KEYS[themeIndex]) return THEME_KEYS[themeIndex];
    } catch (error) {
      console.warn('[NEXUS] theme preference read failed', error);
    }

    return 'nexus-dark';
  }

  // ─── ROUTING ─────────────────────────────────────────────────────
  function getInitialRoute() {
    const path = window.location.pathname.replace(/\\/g, '/');
    const fileName = path.split('/').pop() || 'index.html';

    if (window.location.hash === '#goals-section' && isHomePath(fileName)) return 'goals';
    if (isHomePath(fileName) || fileName === 'facescan.html' || fileName === 'facescan') return 'home';
    if (fileName === 'health.html' || fileName === 'health') return 'wellness';
    if (fileName === 'gym.html' || fileName === 'gym') return 'gym';
    if (fileName === 'progression-tab.html' || fileName === 'progression-tab' || fileName === 'skills') return 'calisthenics';
    if (fileName === 'grind-log.html' || fileName === 'grind-log' || fileName === 'grind') return 'grind';

    return 'home';
  }

  function isHomePath(fileName) {
    return fileName === '' || fileName === 'index.html' || fileName === 'index';
  }

  // ─── BOOT ────────────────────────────────────────────────────────
  document.documentElement.setAttribute('data-theme', readStoredTheme());
  document.documentElement.setAttribute('data-initial-route', getInitialRoute());
  document.documentElement.classList.add('js-loading', 'nexus-ready');
})();
