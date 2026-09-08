// =============================================================
// NEXUS Shared Runtime Bootloader
// Pure local-first personal OS initialization
// =============================================================
(function () {
  'use strict';
  // Service worker registration is handled in topbar.js
  // Apply saved theme early if not already done
  try {
    const t = localStorage.getItem('nexus_theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
