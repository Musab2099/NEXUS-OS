// =============================================================
// NEXUS persistent top bar.
// Drop this on any page with:
//     <script src="topbar.js" defer></script>
// Reads live progress from each app's localStorage keys and
// renders a row of status pills matching the NEXUS theme.
// =============================================================
(function () {
  'use strict';

  // -------- CSS --------
  const css = `
.topbar {
  position: sticky; top: 0; z-index: 40;
  display: flex; gap: 6px;
  padding-top: max(12px, env(safe-area-inset-top));
  padding-bottom: 10px;
  padding-left: max(14px, env(safe-area-inset-left));
  padding-right: max(14px, env(safe-area-inset-right));
  background: #02020C;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
}
.topbar-pill {
  flex: 1 1 0; min-width: 0;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 11px;
  text-decoration: none;
  color: #F1F5F9;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, border-color 0.15s;
}
.topbar-pill:hover { background: rgba(255, 255, 255, 0.07); border-color: rgba(255, 255, 255, 0.12); }
.topbar-pill-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--pill-color, #6366F1);
  box-shadow: 0 0 6px var(--pill-color, #6366F1);
  flex-shrink: 0;
}
.topbar-pill.warn .topbar-pill-dot { background: #F59E0B; box-shadow: 0 0 6px #F59E0B; }
.topbar-pill.miss .topbar-pill-dot {
  background: #EF4444; box-shadow: 0 0 6px #EF4444;
  animation: topbar-miss-pulse 1.6s ease-in-out infinite;
}
@keyframes topbar-miss-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
  50%      { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
}
.topbar-pill-label {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
  flex-shrink: 0;
}
.topbar-pill-count {
  margin-left: auto;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px; font-weight: 700;
  color: #F1F5F9;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .topbar {
    padding-top: max(47px, env(safe-area-inset-top));
    padding-left: max(10px, env(safe-area-inset-left));
    padding-right: max(10px, env(safe-area-inset-right));
    gap: 8px;
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .topbar::-webkit-scrollbar { display: none; }
  .topbar-pill {
    flex: 0 0 auto;
    padding: 7px 12px;
    gap: 5px;
  }
  .topbar-pill-label { display: none; }
  .topbar-pill-count { font-size: 12px; }
}

html, body { -webkit-text-size-adjust: 100%; }
@media (max-width: 768px) {
  html { touch-action: pan-y; }
  ::-webkit-scrollbar { width: 0; height: 0; display: none; }
  html, body { scrollbar-width: none; -ms-overflow-style: none; }
}
.modal-bg, .modal, .po-modal-bg, .po-modal, .wt-overlay, .wt-viewer {
  overscroll-behavior: contain;
}
body.topbar-modal-open {
  overflow: hidden;
  touch-action: none;
}
@media (max-width: 480px) {
  .modal-bg, .po-modal-bg {
    padding: 0 !important;
    align-items: stretch !important;
    justify-content: stretch !important;
  }
  .modal, .po-modal {
    width: 100% !important;
    max-width: 100% !important;
    max-height: 100vh !important;
    height: 100vh !important;
    border-radius: 0 !important;
    padding-top: max(20px, env(safe-area-inset-top)) !important;
    padding-bottom: max(28px, env(safe-area-inset-bottom)) !important;
    padding-left: max(20px, env(safe-area-inset-left)) !important;
    padding-right: max(20px, env(safe-area-inset-right)) !important;
    overflow-y: auto !important;
    overscroll-behavior: contain;
  }
}
`;

  // -------- TILE DEFINITIONS --------
  // Each tile reads its own app's localStorage and returns
  // { text, status } where status is 'idle' | 'good' | 'warn' | 'miss'.
  const TILES = [
    {
      id: 'goals', href: 'index.html', label: 'GOALS', color: '#6366F1',
      getStatus: function () {
        const key = 'goals:' + activeDateKey();
        let goals = [];
        try { goals = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { }
        const total = Array.isArray(goals) ? goals.length : 0;
        const done = total ? goals.filter(function (g) { return g && g.done; }).length : 0;
        return { text: total ? done + '/' + total : '0/0', status: classifyFraction(done, total) };
      }
    },
    {
      id: 'stack', href: 'health.html', label: 'STACK', color: '#10B981',
      getStatus: function () {
        let items = [];
        try { items = JSON.parse(localStorage.getItem('stack:items')) || []; } catch (e) { }
        let taken = {};
        try { taken = JSON.parse(localStorage.getItem('stack:taken:' + activeDateKey())) || {}; } catch (e) { }
        const total = Array.isArray(items) ? items.length : 0;
        const done = total ? items.filter(function (i) { return i && taken[i.id]; }).length : 0;
        return { text: total ? done + '/' + total : '0/0', status: classifyFraction(done, total) };
      }
    },
    {
      id: 'gym', href: 'gym.html', label: 'GYM', color: '#F97316',
      getStatus: function () {
        const dow = new Date().getDay(); // 0=Sun
        const dayMap = { 1: 0, 2: 1, 3: 2, 4: 3 };
        const idx = dayMap[dow];
        if (idx == null) return { text: 'Rest', status: 'idle' };
        let doneMap = {};
        try { doneMap = JSON.parse(localStorage.getItem('ibrahim_gym_done')) || {}; } catch (e) { }
        const td = calendarDateKey();
        const count = doneMap[td] || 0;
        return { text: count > 0 ? 'Done' : 'Pending', status: count > 0 ? 'good' : pastSixPm() ? 'miss' : 'warn' };
      }
    },
    {
      id: 'grind', href: 'grind-log.html', label: 'GRIND', color: '#8B5CF6',
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
      id: 'valorant', href: 'valorant-cc.html', label: 'VALO', color: '#EF4444',
      getStatus: function () {
        let S = {};
        try { S = JSON.parse(localStorage.getItem('val_cc_v1')) || {}; } catch (e) { }
        const sessions = Array.isArray(S.sessions) ? S.sessions : [];
        const td = calendarDateKey();
        const today = sessions.filter(function (s) { return s && s.date === td; });
        const w = today.filter(function (s) { return s.result === 'win'; }).length;
        const l = today.filter(function (s) { return s.result === 'loss'; }).length;
        if (!today.length) return { text: '—', status: 'idle' };
        return { text: w + 'W-' + l + 'L', status: w >= l ? 'good' : 'warn' };
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
    return '<header class="topbar" id="topbar" role="navigation" aria-label="Quick stats">' + pills + '</header>';
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
      countEl.textContent = r.text;
      setPillStatus(pillEl, r.status);
    });
  }

  // -------- Mobile lockdown helpers --------
  function blockGesture(e) { e.preventDefault(); }
  function lockGestures() {
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
    const MODAL_SELECTORS = ['.modal-bg', '.po-modal-bg', '.wt-overlay', '.wt-viewer', '.wt-cam'];
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

  // -------- Boot --------
  function boot() {
    injectStyleAndHTML();
    render();
    lockGestures();
    startModalLock();

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
  // --- Service Worker registration (once per page via topbar.js) ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .catch((err) => console.warn('SW registration failed:', err));
    });
  }
})();

