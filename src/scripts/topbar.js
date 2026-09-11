// NEXUS shared header controller.
// Pages own the static header markup; this file only wires behavior to it.
(function initializeTopbar() {
  'use strict';

  // ─── SERVICE WORKER ───────────────────────────────────────────────
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[NEXUS] service worker registration failed', error);
      });
    }, { once: true });
  }

  // ─── ROUTING ─────────────────────────────────────────────────────
  function getCurrentPageName() {
    const path = window.location.pathname.replace(/\\/g, '/');
    const fileName = path.split('/').pop() || 'index.html';

    if (fileName === 'index.html' || fileName === '' || fileName === 'index') return 'home';
    if (fileName === 'health.html' || fileName === 'health') return 'wellness';
    if (fileName === 'gym.html' || fileName === 'gym') return 'gym';
    if (fileName === 'progression-tab.html' || fileName === 'progression-tab' || fileName === 'skills') return 'calisthenics';
    if (fileName === 'grind-log.html' || fileName === 'grind-log' || fileName === 'grind') return 'grind';
    if (fileName === 'facescan.html' || fileName === 'facescan') return 'home';

    return 'home';
  }

  function getActiveRoute() {
    const pageName = getCurrentPageName();
    return pageName === 'home' && window.location.hash === '#goals-section' ? 'goals' : pageName;
  }

  function setActiveRoute(links, route) {
    links.forEach((link) => {
      const isActive = link.getAttribute('data-route') === route;
      link.classList.toggle('active', isActive);
      link.classList.toggle('is-active', isActive);
      link.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    if (route) document.documentElement.setAttribute('data-initial-route', route);
    if (typeof window.NexusUpdateNavIndicator === 'function') window.NexusUpdateNavIndicator();
  }

  // ─── THEME MENU ──────────────────────────────────────────────────
  function closeThemeMenu(themeControl, themeButton) {
    if (!themeControl) return;
    themeControl.classList.remove('is-open');
    if (themeButton) themeButton.setAttribute('aria-expanded', 'false');
  }

  function markSelectedTheme(themeMenu, theme) {
    themeMenu.querySelectorAll('[data-theme-option]').forEach((option) => {
      const isSelected = option.getAttribute('data-theme-option') === theme;
      option.setAttribute('aria-checked', String(isSelected));
    });
  }

  function initializeThemeMenu(themeControl, themeButton, themeMenu) {
    if (!themeControl || !themeButton || !themeMenu) return;

    themeButton.addEventListener('click', () => {
      const isOpen = !themeControl.classList.contains('is-open');
      themeControl.classList.toggle('is-open', isOpen);
      themeButton.setAttribute('aria-expanded', String(isOpen));
    });

    themeMenu.querySelectorAll('[data-theme-option]').forEach((option) => {
      option.addEventListener('click', () => {
        if (window.NexusTheme) window.NexusTheme.set(option.getAttribute('data-theme-option'));
        closeThemeMenu(themeControl, themeButton);
      });
    });

    document.addEventListener('click', (event) => {
      if (!themeControl.contains(event.target)) closeThemeMenu(themeControl, themeButton);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeThemeMenu(themeControl, themeButton);
    });

    markSelectedTheme(themeMenu, window.NexusTheme ? window.NexusTheme.get() : 'nexus-dark');
    window.addEventListener('nexus-theme-change', (event) => {
      markSelectedTheme(themeMenu, event.detail.theme);
    });
  }

  // ─── LOCAL ANCHOR NAVIGATION ─────────────────────────────────────
  function initializeLocalLinks(links, setRoute) {
    links.forEach((link) => {
      link.addEventListener('click', (event) => {
        const route = link.getAttribute('data-route');
        const href = link.getAttribute('href') || '';
        const isHomePage = getCurrentPageName() === 'home';
        const isLocalGoalsLink = route === 'goals' && isHomePage;
        const isLocalHomeLink = route === 'home' && isHomePage && href.includes('#');

        if (!isLocalGoalsLink && !isLocalHomeLink) return;

        event.preventDefault();
        const targetId = href.split('#')[1];
        const target = targetId ? document.getElementById(targetId) : null;
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (href.includes('#')) window.history.replaceState(null, '', href);
        setRoute(route);
      });
    });
  }

  // ─── FIRST-PAINT RELEASE ─────────────────────────────────────────
  function runAfterInitialLayout(callback) {
    const requestFrame = window.requestAnimationFrame || ((next) => window.setTimeout(next, 16));
    const fontsReady = document.fonts && document.fonts.ready
      ? Promise.resolve(document.fonts.ready).catch(() => undefined)
      : Promise.resolve();
    const fontTimeout = new Promise((resolve) => window.setTimeout(resolve, 1200));

    Promise.race([fontsReady, fontTimeout]).then(() => {
      requestFrame(() => requestFrame(callback));
    });
  }

  // ─── BOOT ────────────────────────────────────────────────────────
  function initializeHeader() {
    const header = document.querySelector('.navbar[data-navbar]');
    if (!header) return;

    const links = Array.from(header.querySelectorAll('[data-route]'));
    const themeControl = header.querySelector('[data-theme-control]');
    const themeButton = header.querySelector('[data-theme-button]');
    const themeMenu = header.querySelector('[data-theme-menu]');
    const refreshRoute = () => setActiveRoute(links, getActiveRoute());

    refreshRoute();
    initializeThemeMenu(themeControl, themeButton, themeMenu);
    initializeLocalLinks(links, (route) => setActiveRoute(links, route));
    window.addEventListener('hashchange', refreshRoute);

    runAfterInitialLayout(() => {
      refreshRoute();
      document.documentElement.classList.remove('js-loading');
    });
  }

  registerServiceWorker();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHeader, { once: true });
  } else {
    initializeHeader();
  }
})();
