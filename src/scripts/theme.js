// NEXUS global theme controller. Load before page styles and topbar.js.
(function () {
  'use strict';

  var KEY = 'nexus-theme';
  var INDEX_KEY = 'nexus-theme-index';
  var LEGACY_KEY = 'nexus_theme';
  var THEMES = {
    amethyst: { label: 'NEXUS Dark', color: '#07051A' },
    peri: { label: 'Periwinkle', color: '#0D1030' },
    arctic: { label: 'Arctic White', color: '#EEF5FF' }
  };

  function storedTheme() {
    try {
      var value = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
      if (validTheme(value)) return value;
      var index = Number(localStorage.getItem(INDEX_KEY));
      var keys = Object.keys(THEMES);
      return Number.isInteger(index) && keys[index] ? keys[index] : null;
    } catch (e) { return null; }
  }

  function validTheme(theme) {
    return Object.prototype.hasOwnProperty.call(THEMES, theme) ? theme : null;
  }

  function preferredTheme() {
    var stored = validTheme(storedTheme());
    if (stored) return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'arctic' : 'amethyst';
  }

  function apply(theme, persist) {
    var id = validTheme(theme) || preferredTheme();
    document.documentElement.setAttribute('data-theme', id);
    if (persist) {
      try {
        localStorage.setItem(KEY, id);
        localStorage.setItem(INDEX_KEY, String(Object.keys(THEMES).indexOf(id)));
      } catch (e) { }
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEMES[id].color);
    window.dispatchEvent(new CustomEvent('nexus-theme-change', { detail: { theme: id } }));
    return id;
  }

  window.NexusTheme = {
    key: KEY,
    indexKey: INDEX_KEY,
    themes: THEMES,
    get: function () { return validTheme(document.documentElement.getAttribute('data-theme')) || preferredTheme(); },
    set: function (theme) { return apply(theme, true); },
    init: function () { return apply(preferredTheme(), false); }
  };

  window.NexusTheme.init();
  window.addEventListener('storage', function (event) {
    if (event.key === KEY && validTheme(event.newValue)) apply(event.newValue, false);
  });
})();
