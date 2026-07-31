// NEXUS primary header enhancement.
// Every page owns the same static .nexus-header markup in its HTML.
// This script only wires interactions; it never injects or replaces navigation.
(function () {
  'use strict';

  // Register the service worker independently of header enhancement so this
  // shared script remains safe to reuse on utility entry points.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (error) {
        console.warn('SW registration failed:', error);
      });
    }, { once: true });
  }

  var header = document.querySelector('[data-nexus-header]');
  if (!header) return;

  var links = Array.prototype.slice.call(header.querySelectorAll('[data-route]'));
  var themeControl = header.querySelector('[data-theme-control]');
  var themeButton = header.querySelector('[data-theme-button]');
  var themeMenu = header.querySelector('[data-theme-menu]');

  function pageName() {
    var path = window.location.pathname.replace(/\\/g, '/');
    var file = path.split('/').pop() || 'index.html';
    if (file === 'index.html' || file === '') return 'home';
    if (file === 'health.html') return 'wellness';
    if (file === 'gym.html') return 'gym';
    if (file === 'progression-tab.html') return 'calisthenics';
    if (file === 'grind-log.html') return 'grind';
    return 'home';
  }

  function activeRoute() {
    if (pageName() === 'home' && window.location.hash === '#goals-section') return 'goals';
    return pageName();
  }

  function setActiveRoute(route) {
    links.forEach(function (link) {
      var active = link.getAttribute('data-route') === route;
      link.classList.toggle('is-active', active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  function closeThemeMenu() {
    if (!themeControl) return;
    themeControl.classList.remove('is-open');
    if (themeButton) themeButton.setAttribute('aria-expanded', 'false');
  }

  function initThemeMenu() {
    if (!themeControl || !themeButton || !themeMenu) return;

    themeButton.addEventListener('click', function () {
      var open = !themeControl.classList.contains('is-open');
      themeControl.classList.toggle('is-open', open);
      themeButton.setAttribute('aria-expanded', String(open));
    });

    themeMenu.querySelectorAll('[data-theme-option]').forEach(function (option) {
      option.addEventListener('click', function () {
        if (window.NexusTheme) window.NexusTheme.set(option.getAttribute('data-theme-option'));
        closeThemeMenu();
      });
    });

    document.addEventListener('click', function (event) {
      if (!themeControl.contains(event.target)) closeThemeMenu();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeThemeMenu();
    });

    function refreshThemeOptions(theme) {
      themeMenu.querySelectorAll('[data-theme-option]').forEach(function (option) {
        var selected = option.getAttribute('data-theme-option') === theme;
        option.setAttribute('aria-checked', String(selected));
      });
    }

    refreshThemeOptions(window.NexusTheme ? window.NexusTheme.get() : 'nexus-dark');
    window.addEventListener('nexus-theme-change', function (event) {
      refreshThemeOptions(event.detail.theme);
    });
  }

  links.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var route = link.getAttribute('data-route');
      var href = link.getAttribute('href') || '';
      var isLocalGoals = route === 'goals' && pageName() === 'home';
      if (isLocalGoals || (route === 'home' && pageName() === 'home' && href.indexOf('#') !== -1)) {
        event.preventDefault();
        var target = document.querySelector(href.split('#')[1] ? '#' + href.split('#')[1] : '#');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (href.indexOf('#') !== -1) history.replaceState(null, '', href);
        setActiveRoute(route);
      }
    });
  });

  setActiveRoute(activeRoute());
  initThemeMenu();
  window.addEventListener('hashchange', function () { setActiveRoute(activeRoute()); });
})();
