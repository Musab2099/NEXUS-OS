<<<<<<< HEAD
// NEXUS primary header enhancement.
// Every page owns the same static .navbar[data-navbar] markup in its HTML.
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

  var header = document.querySelector('.navbar[data-navbar]');
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
    if (file === 'facescan.html') return 'home';
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
      link.classList.toggle('active', active);
      link.classList.toggle('is-active', active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
    if (route) {
      document.documentElement.setAttribute('data-initial-route', route);
    }
    if (typeof window.NexusUpdateNavIndicator === 'function') {
      window.NexusUpdateNavIndicator();
    }
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

  function afterInitialLayout(callback) {
    var frame = window.requestAnimationFrame || function (next) {
      return window.setTimeout(next, 16);
    };
    var fontReady = document.fonts && document.fonts.ready
      ? Promise.resolve(document.fonts.ready).catch(function () { return undefined; })
      : Promise.resolve();
    var fontTimeout = new Promise(function (resolve) {
      window.setTimeout(resolve, 1200);
    });

    Promise.race([fontReady, fontTimeout]).then(function () {
      // Let the browser commit the font metrics before removing the critical
      // first-paint layout guard. Two frames also covers standalone launches,
      // where the safe-area/viewport geometry can settle one frame later.
      frame(function () {
        frame(callback);
      });
    });
  }

  function initializeNavigation() {
    setActiveRoute(activeRoute());
    initThemeMenu();
    window.addEventListener('hashchange', function () { setActiveRoute(activeRoute()); });
    afterInitialLayout(function () {
      setActiveRoute(activeRoute());
      document.documentElement.classList.remove('js-loading');
    });
  }

  // Defer the final active-link/layout pass until the document is complete.
  // The static HTML/data-initial-route styles still provide the correct
  // highlight while this guarded initialization is pending.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNavigation, { once: true });
  } else {
    initializeNavigation();
=======
// =============================================================
// NEXUS persistent nav bar & command palette.
// Drop this on any page with:
//     <script src="../scripts/topbar.js" defer></script>
// Detects the device (phone vs desktop) and renders the nav
// at the TOP on desktop and at the BOTTOM on phones.
// Reads live progress from each app's localStorage keys.
// =============================================================
(function () {
  'use strict';

  // -------- AUDIO CHIME & HAPTICS ENGINE --------
  window.nexusChime = function () {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      
      // Dual-tone harmonic crystal bell: 880Hz (A5) -> 1320Hz (E6)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.28, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.85);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.04);
      gain2.gain.setValueAtTime(0.18, now + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.04);
      osc2.stop(now + 0.95);
    } catch (e) { }

    if ('vibrate' in navigator) {
      try { navigator.vibrate([80, 40, 100]); } catch (e) { }
    }
  };

  // -------- DATA BACKUP & RESTORE ENGINE --------
  window.NEXUS_BACKUP = {
    exportJSON: function () {
      try {
        const backup = {
          version: 'nexus-v18',
          exportedAt: new Date().toISOString(),
          data: {}
        };
        const trackedPrefixes = ['wellness:', 'ibrahim_gym_', 'gym_', 'grind_log_v1', 'cali_skills_v1', 'long_goals_v1', 'day_window_v1', 'nexus_theme'];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          const isMatch = trackedPrefixes.some(p => key.startsWith(p));
          if (isMatch) {
            try {
              backup.data[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
              backup.data[key] = localStorage.getItem(key);
            }
          }
        }
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const d = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = 'nexus-backup-' + d + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
      } catch (e) {
        console.error('Export failed:', e);
        return false;
      }
    },
    importJSON: function (jsonStr) {
      try {
        const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (!parsed || !parsed.data) throw new Error('Invalid NEXUS backup format');
        let count = 0;
        for (const [k, v] of Object.entries(parsed.data)) {
          localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          count++;
        }
        window.dispatchEvent(new Event('storage'));
        return count;
      } catch (e) {
        console.error('Import failed:', e);
        return false;
      }
    }
  };

  // -------- DEVICE DETECTION --------
  function detectDevice() {
    const w = Math.min(window.innerWidth, window.innerHeight);
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const isPhoneSized = w <= 600;
    const isPhone = isTouch && (coarse || isPhoneSized);
    return isPhone ? 'phone' : 'desktop';
  }

  // -------- CSS --------
  const css = `
.topbar {
  position: sticky; top: 0; z-index: 40;
  display: flex; gap: 6px; align-items: center;
  padding-top: max(12px, env(safe-area-inset-top));
  padding-bottom: 10px;
  padding-left: max(14px, env(safe-area-inset-left));
  padding-right: max(14px, env(safe-area-inset-right));
  background: var(--topbar-bg, #02020C);
  border-bottom: 1px solid var(--topbar-border, rgba(255, 255, 255, 0.07));
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
}
.topbar-pill {
  flex: 1 1 0; min-width: 0;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: var(--sbg, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.07));
  border-radius: 11px;
  text-decoration: none;
  color: var(--t1, #F1F5F9);
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, border-color 0.15s, transform 0.12s;
}
.topbar-pill:hover { background: var(--card, rgba(255, 255, 255, 0.07)); border-color: var(--bdr-hov, rgba(255, 255, 255, 0.12)); }
.topbar-pill-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--pill-color, #6366F1);
  box-shadow: 0 0 6px var(--pill-color, #6366F1);
  flex-shrink: 0;
}
.topbar-pill.warn .topbar-pill-dot { background: #F59E0B; box-shadow: 0 0 6px #F59E0B; }
@media (prefers-reduced-motion: no-preference) {
  .topbar-pill.miss .topbar-pill-dot {
    animation: topbar-miss-pulse 1.6s ease-in-out infinite;
  }
  @keyframes topbar-miss-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
    50%      { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
  }
}
.topbar-pill-label {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--t3, rgba(255, 255, 255, 0.45));
  flex-shrink: 0;
}
.topbar-pill-count {
  margin-left: auto;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px; font-weight: 700;
  color: var(--t1, #F1F5F9);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Actions in topbar (Cmd+K, Theme) */
.topbar-actions {
  display: flex; gap: 6px; align-items: center; flex-shrink: 0;
}
.topbar-btn {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  height: 32px; padding: 0 9px;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.04);
  cursor: pointer;
  color: var(--t3, rgba(255,255,255,0.5));
  font-size: 11px; font-weight: 600; font-family: inherit;
  transition: all 0.15s;
}
.topbar-btn:hover {
  background: var(--card, rgba(255,255,255,0.07));
  border-color: var(--bdr-hov, rgba(255,255,255,0.14));
  color: var(--t1, #fff);
}
.topbar-btn svg {
  width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8;
  stroke-linecap: round; stroke-linejoin: round;
}
.topbar-btn kbd {
  font-family: ui-monospace, monospace; font-size: 10px; font-weight: 700;
  opacity: 0.7; padding: 1px 3px; border-radius: 4px; background: rgba(255,255,255,0.06);
}

/* Phone bottom bar */
.topbar--phone,
@media (max-width: 600px) {
  .topbar {
    position: fixed; top: auto; left: 0; right: 0; bottom: 0;
    border-bottom: none;
    border-top: 1px solid var(--topbar-border, rgba(255, 255, 255, 0.10));
    padding-top: 8px;
    padding-bottom: max(10px, env(safe-area-inset-bottom));
    padding-left: max(6px, env(safe-area-inset-left));
    padding-right: max(6px, env(safe-area-inset-right));
    gap: 4px;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    background: var(--nav-bg, rgba(2, 2, 12, 0.85));
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    backdrop-filter: blur(18px) saturate(140%);
  }
  .topbar-pill {
    flex: none; min-width: 0;
    flex-direction: column; align-items: center; justify-content: center;
    gap: 4px; padding: 6px 2px 4px;
    border-radius: 10px; height: auto; text-align: center;
  }
  .topbar-pill-dot { width: 6px; height: 6px; }
  .topbar-pill-label {
    display: block; font-size: 9px; letter-spacing: 0.08em; line-height: 1; text-align: center;
  }
  .topbar-pill-count { margin-left: 0; font-size: 10px; line-height: 1; }
  
  .topbar-actions { display: contents; }
  .topbar-btn {
    flex: none; width: auto; height: auto;
    flex-direction: column; align-items: center; justify-content: center;
    gap: 4px; padding: 6px 2px 4px;
    border-radius: 10px; border: none; background: transparent;
  }
  .topbar-btn span { font-size: 9px; letter-spacing: 0.08em; color: var(--t3, rgba(255,255,255,0.45)); }
  .topbar-btn kbd { display: none; }
}

/* Gym HUD & Flame HUD */
.topbar-gym-hud { display: flex; gap: 2px; align-items: center; }
.topbar-gym-seg { width: 6px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.1); }
.topbar-gym-seg.done { background: #B026FF; box-shadow: 0 0 4px #B026FF; }
.topbar-flame-svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; transition: all 0.3s; margin-bottom:-2px;}
.eh-flame-dim { color: rgba(255,255,255,0.2); }
.eh-flame-active { color: #D946EF; filter: drop-shadow(0 0 4px #D946EF); }

/* Command Palette & Theme Modals */
.nx-modal-bg {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  display: none; align-items: flex-start; justify-content: center;
  padding: 80px 16px 20px;
}
.nx-modal-bg.show { display: flex; }
.nx-cmd-modal {
  background: var(--card, rgba(14,10,42,0.65));
  border: 1px solid var(--border, rgba(167,139,250,0.2));
  border-radius: 18px;
  max-width: 520px; width: 100%;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6);
  backdrop-filter: blur(28px) saturate(170%);
  -webkit-backdrop-filter: blur(28px) saturate(170%);
  overflow: hidden;
  display: flex; flex-direction: column;
  animation: nxPop 0.16s ease-out;
}
@keyframes nxPop {
  from { opacity: 0; transform: scale(0.96) translateY(-8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.nx-cmd-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
}
.nx-cmd-head svg { width: 18px; height: 18px; stroke: var(--t3, rgba(255,255,255,0.5)); stroke-width: 2; fill: none; }
.nx-cmd-input {
  flex: 1; background: transparent; border: none; outline: none;
  font-family: inherit; font-size: 15px; color: var(--t1, #fff);
}
.nx-cmd-input::placeholder { color: var(--t3, rgba(255,255,255,0.35)); }
.nx-cmd-esc {
  font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 5px;
  background: rgba(255,255,255,0.08); color: var(--t3, rgba(255,255,255,0.6));
}
.nx-cmd-list {
  max-height: 340px; overflow-y: auto; padding: 8px;
}
.nx-cmd-group-title {
  font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--t3, rgba(255,255,255,0.4)); padding: 8px 10px 4px;
}
.nx-cmd-item {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 9px 12px; border-radius: 10px; border: none; background: transparent;
  color: var(--t1, #EDE9FE); cursor: pointer; text-align: left; font-family: inherit;
  transition: background 0.12s; text-decoration: none;
}
.nx-cmd-item:hover, .nx-cmd-item.selected {
  background: var(--sbg, rgba(124,58,237,0.16));
  color: #fff;
}
.nx-cmd-item-icon { font-size: 16px; width: 22px; text-align: center; }
.nx-cmd-item-text { flex: 1; font-size: 13px; font-weight: 500; }
.nx-cmd-item-badge {
  font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;
  background: rgba(255,255,255,0.06); color: var(--t3, rgba(255,255,255,0.5));
}

/* Theme Modal */
.nx-theme-modal {
  background: var(--card, rgba(14,10,42,0.65));
  border: 1px solid var(--border, rgba(167,139,250,0.2));
  border-radius: 20px; padding: 24px; max-width: 340px; width: 100%;
  box-shadow: 0 24px 80px rgba(0,0,0,0.5);
  backdrop-filter: blur(28px) saturate(170%); -webkit-backdrop-filter: blur(28px) saturate(170%);
}
.nx-theme-modal h3 {
  font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--t3, rgba(139,126,200,0.78)); margin: 0 0 16px;
}
.nx-theme-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.nx-theme-swatch {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 14px 8px; border-radius: 14px; border: 2px solid transparent; background: transparent;
  cursor: pointer; transition: all 0.2s; font-family: inherit;
}
.nx-theme-swatch:hover { background: var(--sbg, rgba(255,255,255,0.04)); }
.nx-theme-swatch.active { border-color: var(--a1, #7C3AED); background: var(--sbg, rgba(124,58,237,0.06)); }
.nx-theme-dot {
  width: 36px; height: 36px; border-radius: 50%;
  border: 2px solid var(--border, rgba(255,255,255,0.15));
  box-shadow: 0 2px 12px rgba(0,0,0,0.2); position: relative;
}
.nx-theme-dot::after {
  content: '✓'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: white; opacity: 0; transition: opacity 0.2s;
}
.nx-theme-swatch.active .nx-theme-dot::after { opacity: 1; }
.nx-theme-name { font-size: 11px; font-weight: 600; color: var(--t2, rgba(212,205,255,0.88)); letter-spacing: 0.02em; }
.nx-theme-swatch[data-t="amethyst"] .nx-theme-dot { background: linear-gradient(135deg, #7C3AED, #D946EF); }
.nx-theme-swatch[data-t="arctic"] .nx-theme-dot { background: linear-gradient(135deg, #1D4ED8, #38BDF8); }
.nx-theme-swatch[data-t="peri"] .nx-theme-dot { background: linear-gradient(135deg, #4F46E5, #C7D2FE); }
.nx-theme-swatch[data-t="ice"] .nx-theme-dot { background: linear-gradient(135deg, #075985, #38BDF8); }
`;

  // -------- TILE DEFINITIONS --------
  const TILES = [
    {
      id: 'goals', href: '../pages/index.html', label: 'GOALS', color: '#6366F1',
      getStatus: function () {
        let goals = [];
        try { goals = JSON.parse(localStorage.getItem('long_goals_v1')) || []; } catch (e) { }
        const total = Array.isArray(goals) ? goals.length : 0;
        return { text: total > 0 ? total + ' goals' : '0 goals', status: total > 0 ? 'good' : 'idle' };
      }
    },
    {
      id: 'stack', href: '../pages/health.html', label: 'STACK', color: '#10B981',
      getStatus: function () {
        let habits = [];
        try { habits = JSON.parse(localStorage.getItem('wellness:habits')) || []; } catch (e) { }
        const total = Array.isArray(habits) && habits.length ? habits.length : 6;
        
        let done = [];
        try { done = JSON.parse(localStorage.getItem('wellness:done:' + activeDateKey())) || []; } catch (e) { }
        const doneCount = Array.isArray(done) ? done.length : 0;

        // Calculate streak of 100% habit completion
        let streak = 0;
        for (let i = 1; i <= 30; i++) {
          const d = new Date();
          if (d.getHours() < 6) d.setDate(d.getDate() - 1);
          d.setDate(d.getDate() - i);
          const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          let pastDone = [];
          try { pastDone = JSON.parse(localStorage.getItem('wellness:done:' + k)) || []; } catch (e) { }
          if (Array.isArray(pastDone) && pastDone.length >= total) streak++;
          else break;
        }

        const flameClass = streak >= 3 ? 'eh-flame-active' : 'eh-flame-dim';
        const svg = '<svg class="topbar-flame-svg ' + flameClass + '" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.866 8.21 8.21 0 003 2.48z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z"></path></svg>';
        
        return { html: svg + ' ' + doneCount + '/' + total, status: classifyFraction(doneCount, total) };
      }
    },
    {
      id: 'gym', href: '../pages/gym.html', label: 'GYM', color: '#B026FF',
      getStatus: function () {
        let doneMap = {};
        try { doneMap = JSON.parse(localStorage.getItem('ibrahim_gym_done')) || {}; } catch (e) { }
        const td = calendarDateKey();

        const d = new Date();
        const dow = d.getDay();
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // Mon start
        let daysDoneThisWeek = 0;
        for (let i = 0; i < 7; i++) {
          const tempD = new Date(startOfWeek);
          tempD.setDate(startOfWeek.getDate() + i);
          const k = tempD.getFullYear() + '-' + String(tempD.getMonth() + 1).padStart(2, '0') + '-' + String(tempD.getDate()).padStart(2, '0');
          if (doneMap[k]) daysDoneThisWeek++;
        }
        daysDoneThisWeek = Math.min(daysDoneThisWeek, 4);
        let segs = '';
        for (let i = 0; i < 4; i++) {
          segs += '<span class="topbar-gym-seg' + (i < daysDoneThisWeek ? ' done' : '') + '"></span>';
        }

        const count = doneMap[td] || 0;
        const status = count > 0 ? 'good' : pastSixPm() ? 'miss' : 'warn';
        return { html: '<div class="topbar-gym-hud">' + segs + '</div>', status: status };
      }
    },
    {
      id: 'grind', href: '../pages/grind-log.html', label: 'GRIND', color: '#8B5CF6',
      getStatus: function () {
        let S = {};
        try { S = JSON.parse(localStorage.getItem('grind_log_v1')) || {}; } catch (e) { }
        const logs = Array.isArray(S.logs) ? S.logs : [];
        const td = calendarDateKey();
        const xp = logs.filter(function (l) { return l && l.date === td; }).reduce(function (s, l) { return s + (l.xp || 0); }, 0);
        return { text: xp > 0 ? '+' + xp : '0', status: xp > 0 ? 'good' : 'idle' };
      }
    },
    {
      id: 'calisthenics', href: '../pages/progression-tab.html', label: 'SKILLS', color: '#EF4444',
      getStatus: function () {
        let S = {};
        try { S = JSON.parse(localStorage.getItem('cali_skills_v1')) || {}; } catch (e) { }
        const td = calendarDateKey();
        let sessionsToday = 0;
        for (const k in S) {
          if (S[k] && Array.isArray(S[k].sessions)) {
            sessionsToday += S[k].sessions.filter(function (s) { return s && s.date === td; }).length;
          }
        }
        if (sessionsToday > 0) return { text: sessionsToday + ' logged', status: 'good' };
        return { text: '0/6', status: 'idle' };
      }
    }
  ];

  function buildHTML() {
    let pills = '';
    TILES.forEach(function (t) {
      pills +=
        '<a href="' + t.href + '" class="topbar-pill" id="topbarPill_' + t.id + '" style="--pill-color:' + t.color + '">' +
        '<span class="topbar-pill-dot"></span>' +
        '<span class="topbar-pill-label">' + t.label + '</span>' +
        '<span class="topbar-pill-count" id="topbarCount_' + t.id + '">—</span>' +
        '</a>';
    });

    const cmdSvg = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 10h10M7 14h10"/></svg>';
    const cmdBtn = '<button class="topbar-btn" id="nxCmdBtn" title="Command Palette (⌘K)">' + cmdSvg + '<span>COMMAND</span><kbd>⌘K</kbd></button>';

    const themeSvg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    const themeBtn = '<button class="topbar-btn" id="nxThemeBtn" title="Theme Switcher">' + themeSvg + '<span>THEME</span></button>';

    // Command Palette Modal
    const cmdModal = '<div class="nx-modal-bg" id="nxCmdBg">' +
      '<div class="nx-cmd-modal">' +
      '<div class="nx-cmd-head">' +
      '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' +
      '<input type="text" class="nx-cmd-input" id="nxCmdInput" placeholder="Type a command or jump to app..." autocomplete="off">' +
      '<span class="nx-cmd-esc">ESC</span>' +
      '</div>' +
      '<div class="nx-cmd-list" id="nxCmdList"></div>' +
      '</div></div>';

    // Theme Modal
    const themeModal = '<div class="nx-modal-bg" id="nxThemeBg">' +
      '<div class="nx-theme-modal">' +
      '<h3>Choose Theme</h3>' +
      '<div class="nx-theme-grid">' +
      '<button class="nx-theme-swatch" data-t="amethyst"><div class="nx-theme-dot"></div><span class="nx-theme-name">Amethyst</span></button>' +
      '<button class="nx-theme-swatch" data-t="arctic"><div class="nx-theme-dot"></div><span class="nx-theme-name">Arctic</span></button>' +
      '<button class="nx-theme-swatch" data-t="peri"><div class="nx-theme-dot"></div><span class="nx-theme-name">Peri</span></button>' +
      '<button class="nx-theme-swatch" data-t="ice"><div class="nx-theme-dot"></div><span class="nx-theme-name">Ice</span></button>' +
      '</div></div></div>';

    // Hidden File Input for Backup Import
    const hiddenFileInput = '<input type="file" id="nxBackupFileInput" accept=".json" style="display:none">';

    return '<header class="topbar" id="topbar" role="navigation" aria-label="Quick stats">' +
      pills + '<div class="topbar-actions">' + cmdBtn + themeBtn + '</div></header>' + cmdModal + themeModal + hiddenFileInput;
  }

  function injectStyleAndHTML() {
    if (document.getElementById('topbar')) return;
    const style = document.createElement('style');
    style.id = 'topbar-style';
    style.textContent = css;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = buildHTML().trim();
    document.body.insertBefore(wrap.firstChild, document.body.firstChild);
  }

  // -------- date helpers --------
  function activeDateKey() {
    const now = new Date();
    const d = new Date(now);
    if (now.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function calendarDateKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function pastSixPm() { return new Date().getHours() >= 18; }

  function classifyFraction(done, total) {
    if (total === 0) return 'idle';
    if (done >= total) return 'good';
    if (done >= total * 0.5) return 'warn';
    if (pastSixPm() && done < total * 0.5) return 'miss';
    return 'warn';
  }

  function setPillStatus(pillEl, status) {
    pillEl.classList.remove('good', 'warn', 'miss');
    if (status === 'warn' || status === 'miss') pillEl.classList.add(status);
  }

  function render() {
    const root = document.getElementById('topbar');
    if (!root) return;
    TILES.forEach(function (t) {
      const pillEl = document.getElementById('topbarPill_' + t.id);
      const countEl = document.getElementById('topbarCount_' + t.id);
      if (!pillEl || !countEl) return;
      const r = t.getStatus();
      if (r.html != null) {
        countEl.innerHTML = r.html;
      } else {
        countEl.textContent = r.text;
      }
      setPillStatus(pillEl, r.status);
    });
  }

  // -------- Mobile lockdown helpers --------
  function blockGesture(e) { e.preventDefault(); }
  let _gestureLockInstalled = false;
  function lockGestures() {
    if (_gestureLockInstalled) return;
    _gestureLockInstalled = true;
    document.addEventListener('gesturestart', blockGesture, { passive: false });
    document.addEventListener('gesturechange', blockGesture, { passive: false });
    document.addEventListener('gestureend', blockGesture, { passive: false });
    let lastTouch = 0;
    document.addEventListener('touchend', function (e) {
      const now = Date.now();
      if (now - lastTouch <= 300) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }

  function startModalLock() {
    const MODAL_SELECTORS = ['.modal-bg', '.nx-modal-bg', '.po-modal-bg', '.wt-overlay', '.wt-viewer', '.wt-cam'];
    function anyOpen() {
      for (const sel of MODAL_SELECTORS) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.classList.contains('show') || el.classList.contains('is-open')) return true;
        }
      }
      return false;
    }
    function sync() { document.body.classList.toggle('topbar-modal-open', anyOpen()); }
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    sync();
  }

  // -------- Apply device class --------
  function applyDeviceClass() {
    const device = detectDevice();
    const bar = document.getElementById('topbar');
    if (bar) {
      if (device === 'phone') {
        bar.classList.add('topbar--phone');
      } else {
        bar.classList.remove('topbar--phone');
      }
    }
    document.body.classList.toggle('topbar-phone-mode', device === 'phone');
    document.body.classList.toggle('topbar-desktop-mode', device === 'desktop');
    document.documentElement.setAttribute('data-device', device);
    if (device === 'phone') {
      document.body.style.paddingBottom = 'calc(84px + env(safe-area-inset-bottom))';
      lockGestures();
    } else {
      document.body.style.paddingBottom = '';
    }
  }

  // -------- Theme persistence --------
  const THEME_KEY = 'nexus_theme';
  const THEME_VARS_KEY = 'nexus_theme_vars_v1';
  const THEMES = ['amethyst', 'arctic', 'peri', 'ice'];

  function applyTheme(id) {
    document.documentElement.setAttribute('data-theme', id);
    try { localStorage.setItem(THEME_KEY, id); } catch (e) {}
    document.querySelectorAll('.nx-theme-swatch').forEach(function (sw) {
      sw.classList.toggle('active', sw.getAttribute('data-t') === id);
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const colors = { amethyst: '#07051A', arctic: '#EEF5FF', peri: '#0D1030', ice: '#F0F9FF' };
      meta.setAttribute('content', colors[id] || '#07051A');
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'amethyst';
    applyTheme(saved);

    const btn = document.getElementById('nxThemeBtn');
    const bg = document.getElementById('nxThemeBg');
    if (btn && bg) {
      btn.addEventListener('click', function () {
        bg.classList.add('show');
        document.body.classList.add('topbar-modal-open');
      });
      bg.addEventListener('click', function (e) {
        if (e.target === bg) {
          bg.classList.remove('show');
          document.body.classList.remove('topbar-modal-open');
        }
      });
      bg.querySelectorAll('.nx-theme-swatch').forEach(function (sw) {
        sw.addEventListener('click', function () {
          const t = sw.getAttribute('data-t');
          applyTheme(t);
          bg.classList.remove('show');
          document.body.classList.remove('topbar-modal-open');
        });
      });
    }

    window.addEventListener('storage', function (e) {
      if (e.key === THEME_KEY && e.newValue) applyTheme(e.newValue);
    });
  }

  // -------- COMMAND PALETTE LOGIC --------
  const COMMANDS = [
    { cat: 'Navigation', icon: '🎯', name: 'Goals (Command Center)', act: () => { window.location.href = '../pages/index.html'; } },
    { cat: 'Navigation', icon: '🧘', name: 'Wellness Hub (Sleep, Habits, Journal)', act: () => { window.location.href = '../pages/health.html'; } },
    { cat: 'Navigation', icon: '🏋️', name: 'Calisthenics Strength & PRs', act: () => { window.location.href = '../pages/gym.html'; } },
    { cat: 'Navigation', icon: '⚡', name: 'Grind Log & XP Productivity', act: () => { window.location.href = '../pages/grind-log.html'; } },
    { cat: 'Navigation', icon: '🤸', name: 'Calisthenics Skill Progressions', act: () => { window.location.href = '../pages/progression-tab.html'; } },

    { cat: 'Themes', icon: '🟣', name: 'Theme: Amethyst (Default Deep Glass)', act: () => { applyTheme('amethyst'); } },
    { cat: 'Themes', icon: '⚪', name: 'Theme: Arctic White', act: () => { applyTheme('arctic'); } },
    { cat: 'Themes', icon: '🔵', name: 'Theme: Periwinkle', act: () => { applyTheme('peri'); } },
    { cat: 'Themes', icon: '❄️', name: 'Theme: Ice', act: () => { applyTheme('ice'); } },

    { cat: 'Quick Actions', icon: '💻', name: 'Quick Log: +30 XP Deep Work', act: () => {
      let S = {};
      try { S = JSON.parse(localStorage.getItem('grind_log_v1')) || {}; } catch (e) { }
      if (!Array.isArray(S.logs)) S.logs = [];
      S.logs.push({ name: 'Deep work block', xp: 30, cat: 'focus', date: calendarDateKey(), ts: Date.now() });
      localStorage.setItem('grind_log_v1', JSON.stringify(S));
      window.dispatchEvent(new Event('storage'));
      window.nexusChime();
    }},
    { cat: 'Quick Actions', icon: '🔔', name: 'Audio Chime & Haptics Test', act: () => { window.nexusChime(); } },
    { cat: 'Quick Actions', icon: '💾', name: 'Export All Data (JSON Backup)', act: () => { window.NEXUS_BACKUP.exportJSON(); } },
    { cat: 'Quick Actions', icon: '📥', name: 'Import Data from JSON File', act: () => {
      const fi = document.getElementById('nxBackupFileInput');
      if (fi) fi.click();
    }}
  ];

  function initCommandPalette() {
    const bg = document.getElementById('nxCmdBg');
    const input = document.getElementById('nxCmdInput');
    const list = document.getElementById('nxCmdList');
    const btn = document.getElementById('nxCmdBtn');
    const fileInput = document.getElementById('nxBackupFileInput');

    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (evt) {
          const res = window.NEXUS_BACKUP.importJSON(evt.target.result);
          if (res) {
            alert('✓ Successfully imported ' + res + ' items into NEXUS.');
            window.location.reload();
          } else {
            alert('✗ Failed to import backup file.');
          }
        };
        reader.readAsText(file);
      });
    }

    let selectedIndex = 0;
    let filtered = COMMANDS;

    function renderList() {
      list.innerHTML = '';
      if (!filtered.length) {
        list.innerHTML = '<div style="padding:16px;text-align:center;font-size:13px;color:var(--text-muted)">No matching commands</div>';
        return;
      }
      let currentCat = '';
      filtered.forEach((cmd, idx) => {
        if (cmd.cat !== currentCat) {
          currentCat = cmd.cat;
          const group = document.createElement('div');
          group.className = 'nx-cmd-group-title';
          group.textContent = currentCat;
          list.appendChild(group);
        }
        const row = document.createElement('button');
        row.className = 'nx-cmd-item' + (idx === selectedIndex ? ' selected' : '');
        row.innerHTML = '<span class="nx-cmd-item-icon">' + cmd.icon + '</span>' +
          '<span class="nx-cmd-item-text">' + cmd.name + '</span>' +
          '<span class="nx-cmd-item-badge">' + cmd.cat + '</span>';
        row.addEventListener('click', () => {
          closeCmd();
          cmd.act();
        });
        list.appendChild(row);
      });
      // Scroll into view
      const selectedEl = list.querySelector('.nx-cmd-item.selected');
      if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });
    }

    function openCmd() {
      bg.classList.add('show');
      document.body.classList.add('topbar-modal-open');
      input.value = '';
      filtered = COMMANDS;
      selectedIndex = 0;
      renderList();
      setTimeout(() => input.focus(), 50);
    }

    function closeCmd() {
      bg.classList.remove('show');
      document.body.classList.remove('topbar-modal-open');
    }

    if (btn) btn.addEventListener('click', openCmd);
    if (bg) {
      bg.addEventListener('click', (e) => { if (e.target === bg) closeCmd(); });
    }

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      filtered = COMMANDS.filter(c => c.name.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q));
      selectedIndex = 0;
      renderList();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % Math.max(1, filtered.length);
        renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + filtered.length) % Math.max(1, filtered.length);
        renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          closeCmd();
          filtered[selectedIndex].act();
        }
      } else if (e.key === 'Escape') {
        closeCmd();
      }
    });

    // Global Hotkey (⌘K / Ctrl+K)
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (bg.classList.contains('show')) closeCmd();
        else openCmd();
      } else if (e.key === 'Escape' && bg.classList.contains('show')) {
        closeCmd();
      }
    });
  }

  // -------- Boot --------
  function boot() {
    injectStyleAndHTML();
    applyDeviceClass();
    render();
    startModalLock();
    initTheme();
    initCommandPalette();

    let resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(applyDeviceClass, 120);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(applyDeviceClass, 200);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', applyDeviceClass);
    }

    window.addEventListener('storage', render);
    window.addEventListener('focus', render);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
    setInterval(render, 30 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swPath = location.pathname.includes('/src/pages/') ? '../../sw.js' : './sw.js';
      navigator.serviceWorker.register(swPath).catch((err) => console.warn('SW registration:', err));
    });
>>>>>>> 97637ac151207f33462553962126ce48909aa0b4
  }
})();
