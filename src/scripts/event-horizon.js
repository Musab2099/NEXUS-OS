// =============================================================
// EVENT HORIZON — Interaction Engine
// Pure vanilla JS. No dependencies.
// Handles: Circadian tinting, 3D tilt tracker, tactile buttons,
//          sync flash signals.
// Drop on any page with:
//     <script src="../scripts/event-horizon.js" defer></script>
//     <link rel="stylesheet" href="../styles/event-horizon.css">
// =============================================================
(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // §2A — CHRONO-REACTIVE CIRCADIAN TINTING
  // ──────────────────────────────────────────────
  const GRIND_MODE = {
    '--canvas-bg': '#f4f5f6',
    '--glow-primary': '#4f46e5',
    '--glow-secondary': '#0ea5e9',
    '--glow-primary-alpha': 'rgba(79, 70, 229, 0.08)',
    '--text-brightness': '1.0'
  };

  const WIND_DOWN_MODE = {
    '--canvas-bg': '#fbfbf9',
    '--glow-primary': '#d97706',
    '--glow-secondary': '#f59e0b',
    '--glow-primary-alpha': 'rgba(217, 119, 6, 0.08)',
    '--text-brightness': '0.85'
  };

  function timeStrToDecimal(t) {
    if (!t) return 0;
    var parts = t.split(':').map(Number);
    return (parts[0] || 0) + (parts[1] || 0) / 60;
  }

  function getDayWindow() {
    try {
      var s = JSON.parse(localStorage.getItem('day_window_v1'));
      return {
        wake: (s && s.wake) || '07:00',
        sleep: (s && s.sleep) || '00:00'
      };
    } catch (e) {
      return { wake: '07:00', sleep: '00:00' };
    }
  }

  function updateCircadianTinting() {
    var win = getDayWindow();
    var wakeH = timeStrToDecimal(win.wake);
    var sleepH = timeStrToDecimal(win.sleep);

    // Normalize sleep past midnight
    if (sleepH <= wakeH) sleepH += 24;

    var now = new Date();
    var currentH = now.getHours() + now.getMinutes() / 60;
    // If current time is past midnight but before wake, add 24 for comparison
    if (currentH < wakeH && sleepH > 24) currentH += 24;

    var windDownStart = sleepH - 2;
    var isWindDown = currentH >= windDownStart && currentH < sleepH;
    var mode = isWindDown ? WIND_DOWN_MODE : GRIND_MODE;

    var root = document.documentElement;
    for (var key in mode) {
      if (mode.hasOwnProperty(key)) {
        root.style.setProperty(key, mode[key]);
      }
    }

    // Apply brightness filter to text containers
    var brightness = parseFloat(mode['--text-brightness']);
    if (brightness < 1.0) {
      root.style.setProperty('--t1', '#D9DEE5');
      root.style.setProperty('--t2', '#7E8A9A');
    } else {
      root.style.setProperty('--t1', '#F1F5F9');
      root.style.setProperty('--t2', '#94A3B8');
    }
  }

  function initCircadianEngine() {
    updateCircadianTinting();
    setInterval(updateCircadianTinting, 60 * 1000);
    // Re-check when window regains focus
    window.addEventListener('focus', updateCircadianTinting);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) updateCircadianTinting();
    });
    // Re-check when localStorage changes (user adjusts day window)
    window.addEventListener('storage', function (e) {
      if (e.key === 'day_window_v1') updateCircadianTinting();
    });
  }

  // ──────────────────────────────────────────────
  // §2B — MICRO-ELASTIC TILT TRACKER
  // ──────────────────────────────────────────────
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function initTiltTracker() {
    if (prefersReducedMotion.matches) return;

    document.addEventListener('pointermove', function (e) {
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      var card = target.closest('[data-tiltable]');
      if (!card) return;

      var rect = card.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;

      var offsetX = (e.clientX - centerX) / (rect.width / 2);
      var offsetY = (e.clientY - centerY) / (rect.height / 2);

      // Clamp to ±4 degrees
      var maxDeg = 4;
      var rotateY = Math.max(-maxDeg, Math.min(maxDeg, offsetX * maxDeg));
      var rotateX = Math.max(-maxDeg, Math.min(maxDeg, -offsetY * maxDeg));

      card.style.transform =
        'perspective(1000px) rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' + rotateY.toFixed(2) + 'deg)';
    }, { passive: true });

    document.addEventListener('pointerleave', function (e) {
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      var card = target.closest('[data-tiltable]');
      if (card) {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
      }
    }, true);

    // Also reset on scroll (prevents stuck tilt)
    var tiltResetTimer = null;
    window.addEventListener('scroll', function () {
      if (tiltResetTimer) return;
      tiltResetTimer = setTimeout(function () {
        var tilted = document.querySelectorAll('[data-tiltable]');
        for (var i = 0; i < tilted.length; i++) {
          tilted[i].style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
        }
        tiltResetTimer = null;
      }, 100);
    }, { passive: true });
  }

  // ──────────────────────────────────────────────
  // §2B — TACTILE BUTTON PRESS
  // ──────────────────────────────────────────────
  function initTactileButtons() {
    var TACTILE_SELECTORS = 'button, a.topbar-pill, .app-tile, .day-tab, .cat-card, .tab-btn, .result-btn, .quick-pill, .habit-check';

    document.addEventListener('pointerdown', function (e) {
      var target = e.target.closest(TACTILE_SELECTORS);
      if (target) target.classList.add('eh-pressed');
    }, { passive: true });

    document.addEventListener('pointerup', function (e) {
      var target = e.target.closest(TACTILE_SELECTORS);
      if (target) target.classList.remove('eh-pressed');
      // Also remove from any orphaned pressed elements
      var pressed = document.querySelectorAll('.eh-pressed');
      for (var i = 0; i < pressed.length; i++) {
        pressed[i].classList.remove('eh-pressed');
      }
    }, { passive: true });

    document.addEventListener('pointerleave', function (e) {
      var target = e.target.closest(TACTILE_SELECTORS);
      if (target) target.classList.remove('eh-pressed');
    }, true);

    // Clean up if pointer leaves the window
    document.addEventListener('pointercancel', function () {
      var pressed = document.querySelectorAll('.eh-pressed');
      for (var i = 0; i < pressed.length; i++) {
        pressed[i].classList.remove('eh-pressed');
      }
    }, { passive: true });
  }

  // ──────────────────────────────────────────────
  // §2C — DATA SYNC FLASH
  // ──────────────────────────────────────────────
  /**
   * Trigger a sync confirmation flash on an element.
   * Call this from sync.js onApplied callbacks.
   * @param {HTMLElement|string} target - Element or CSS selector
   */
  window.triggerSyncFlash = function (target) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    if (prefersReducedMotion.matches) return;

    // Remove existing flash if re-triggered
    el.classList.remove('eh-sync-flash');
    // Force reflow to reset animation
    void el.offsetWidth;
    el.classList.add('eh-sync-flash');

    el.addEventListener('animationend', function handler() {
      el.classList.remove('eh-sync-flash');
      el.removeEventListener('animationend', handler);
    }, { once: true });
  };

  /**
   * Flash all glass cards on the page (for global sync events).
   */
  window.triggerGlobalSyncFlash = function () {
    var cards = document.querySelectorAll('.glass-card, .card');
    for (var i = 0; i < cards.length; i++) {
      window.triggerSyncFlash(cards[i]);
    }
  };

  // ──────────────────────────────────────────────
  // BOOT
  // ──────────────────────────────────────────────
  function boot() {
    initCircadianEngine();
    initTiltTracker();
    initTactileButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
