/* NEXUS shared animation runtime — vanilla JS only */
(function () {
  'use strict';

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduced = function () { return motionQuery.matches; };

  function all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function addClass(el, className) {
    if (el) el.classList.add(className);
  }

  function injectAmbient() {
    if (reduced() || document.querySelector('.nx-ambient')) return;
    var ambient = document.createElement('div');
    ambient.className = 'nx-ambient';
    ambient.setAttribute('aria-hidden', 'true');
    ambient.innerHTML = '<div class="nx-ambient-base"></div>' +
      '<div class="nx-ambient-orb nx-ambient-orb--one"></div>' +
      '<div class="nx-ambient-orb nx-ambient-orb--two"></div>' +
      '<div class="nx-ambient-orb nx-ambient-orb--three"></div>' +
      '<div class="nx-scanlines"></div>' +
      '<svg class="nx-noise" viewBox="0 0 120 120" preserveAspectRatio="none"><filter id="nxNoiseFilter"><feTurbulence type="fractalNoise" baseFrequency=".82" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#nxNoiseFilter)"/></svg>';
    document.body.appendChild(ambient);
    injectFocusVignette();
  }

  function injectFocusVignette() {
    if (document.querySelector('.nx-focus-vignette')) return;
    var vignette = document.createElement('div');
    vignette.className = 'nx-focus-vignette';
    vignette.setAttribute('aria-hidden', 'true');
    document.body.appendChild(vignette);
    syncFocusMode();
  }

  function syncFocusMode() {
    var focus = document.documentElement.getAttribute('data-theme') === 'periwinkle';
    document.body.classList.toggle('nx-focus-mode', focus);
  }

  function initCursorGlow() {
    if (reduced() || !finePointerQuery.matches || document.querySelector('.nx-cursor-glow')) return;
    var dot = document.createElement('div');
    dot.className = 'nx-cursor-glow';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);

    var targetX = -100;
    var targetY = -100;
    var currentX = targetX;
    var currentY = targetY;
    var visible = false;

    document.addEventListener('pointermove', function (event) {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!visible) {
        visible = true;
        dot.style.opacity = '1';
      }
    }, { passive: true });
    document.addEventListener('pointerleave', function () {
      visible = false;
      dot.style.opacity = '0';
    });

    function frame() {
      currentX += (targetX - currentX) * 0.2;
      currentY += (targetY - currentY) * 0.2;
      dot.style.transform = 'translate3d(' + currentX + 'px,' + currentY + 'px,0)';
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  function initCards() {
    var selectors = '.card, .glass, .glass-card, .ltg-card, .ov-card, .level-card, .xp-hero, .stat-box, .hist-chart-wrap, .goal-contrib-card, .mood-chart-card, .gh-metric';
    var cards = all(selectors);
    var alreadySeen = false;
    try { alreadySeen = sessionStorage.getItem('nx-entrance-seen') === '1'; } catch (e) { }
    if (!alreadySeen) {
      try { sessionStorage.setItem('nx-entrance-seen', '1'); } catch (e) { }
    } else {
      document.documentElement.classList.add('nx-session-entrance-seen');
    }
    cards.forEach(function (card, index) {
      if (card.classList.contains('nx-anim-card')) return;
      card.classList.add('nx-anim-card');
      card.style.setProperty('--nx-stagger', Math.min(index, 14) * 60 + 'ms');
      if (!card.querySelector(':scope > .nx-card-sheen')) {
        var sheen = document.createElement('span');
        sheen.className = 'nx-card-sheen';
        sheen.setAttribute('aria-hidden', 'true');
        card.appendChild(sheen);
      }
    });

    var topbar = document.querySelector('.navbar, .t-topbar');
    if (topbar) topbar.classList.add('nx-anim-topbar');

    window.requestAnimationFrame(function () {
      document.documentElement.classList.add('nx-motion-ready');
      cards.forEach(function (card) {
        card.classList.add('nx-mounted');
        if (alreadySeen) card.classList.add('nx-no-entrance');
      });
      if (topbar) topbar.classList.add('nx-mounted');
    });
  }

  function createRipple(event, host) {
    if (reduced() || !host || host.disabled) return;
    var rect = host.getBoundingClientRect();
    var ripple = document.createElement('span');
    ripple.className = 'nx-ripple';
    ripple.style.setProperty('--nx-ripple-x', event.clientX - rect.left + 'px');
    ripple.style.setProperty('--nx-ripple-y', event.clientY - rect.top + 'px');
    ripple.setAttribute('aria-hidden', 'true');
    host.classList.add('nx-ripple-host');
    host.appendChild(ripple);
    window.setTimeout(function () { ripple.remove(); }, 720);
  }

  function initRipples() {
    document.addEventListener('pointerdown', function (event) {
      var target = event.target.closest('button, a, [role="button"], .app-tile, .cat-card, .quick-pill, .habit-check');
      if (target) createRipple(event, target);
    }, { passive: true });
  }

  function initCardTilt() {
    if (reduced() || !finePointerQuery.matches) return;
    all('.nx-anim-card').forEach(function (card) {
      if (card.dataset.nxTiltReady === 'true') return;
      card.dataset.nxTiltReady = 'true';
      card.addEventListener('pointermove', function (event) {
        if (event.pointerType === 'touch') return;
        var rect = card.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - .5;
        var y = (event.clientY - rect.top) / rect.height - .5;
        card.style.willChange = 'transform';
        card.style.transform = 'perspective(800px) rotateX(' + (-y * 5) + 'deg) rotateY(' + (x * 5) + 'deg) translateY(-4px)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
        card.style.willChange = '';
      });
    });
  }

  function animateWidth(el) {
    if (!el || reduced()) return;
    var width = el.style.width;
    if (!width || width === '0%' || width === '0px') return;
    el.classList.add('nx-progress-target');
    el.style.width = '0%';
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { el.style.width = width; });
    });
  }

  function particleBurst(target, className, count) {
    if (reduced() || !target) return;
    var layer = document.createElement('span');
    layer.className = 'nx-particle-layer';
    layer.setAttribute('aria-hidden', 'true');
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
    target.appendChild(layer);
    for (var i = 0; i < count; i += 1) {
      var particle = document.createElement('span');
      particle.className = className;
      var angle = (Math.PI * 2 * i) / count;
      var distance = 28 + Math.random() * 46;
      particle.style.setProperty('--nx-particle-x', Math.cos(angle) * distance + 'px');
      particle.style.setProperty('--nx-particle-y', Math.sin(angle) * distance + 'px');
      particle.style.setProperty('--nx-particle-delay', i * 18 + 'ms');
      layer.appendChild(particle);
    }
    window.setTimeout(function () { layer.remove(); }, 1200);
  }

  function initSkeletons() {
    var targets = ['#exerciseList', '#heatmapGrid', '#overviewGrid', '#skillTabs', '#skillPanel'];
    targets.forEach(function (selector) {
      all(selector).forEach(function (host) {
        if (host.children.length || host.dataset.nxSkeletonReady === 'true') return;
        host.dataset.nxSkeletonReady = 'true';
        var stack = document.createElement('div');
        stack.className = 'nx-skeleton-stack';
        stack.setAttribute('aria-hidden', 'true');
        stack.innerHTML = '<span class="nx-skeleton wide"></span><span class="nx-skeleton"></span><span class="nx-skeleton short"></span>' + (selector === '#exerciseList' || selector === '#skillPanel' ? '<span class="nx-skeleton block"></span>' : '');
        host.appendChild(stack);
        var observer = new MutationObserver(function () {
          var realContent = Array.prototype.some.call(host.children, function (child) { return !child.classList.contains('nx-skeleton-stack'); });
          if (realContent) { stack.remove(); observer.disconnect(); }
        });
        observer.observe(host, { childList: true });
      });
    });
  }

  function initProgressAndRings() {
    all('.prog-fill, .ltg-bar-fill, .xp-bar-fill, .cat-bar-fill, .ov-bar-fill, .weight-bar-fill, .goal-contrib-bar-fill, .cat-break-bar-fill').forEach(animateWidth);

    var energy = document.getElementById('dayRingFill');
    if (energy) {
      energy.classList.add('nx-energy-ring');
      var finalOffset = energy.getAttribute('stroke-dashoffset');
      if (!reduced() && finalOffset !== null) {
        var circumference = energy.getAttribute('stroke-dasharray') || '326.7';
        energy.setAttribute('stroke-dashoffset', circumference);
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () { energy.setAttribute('stroke-dashoffset', finalOffset); });
        });
      }
    }

    all('#wellnessRingFill, #ringArc').forEach(function (ring) {
      ring.classList.add('nx-energy-ring');
      var finalOffset = ring.getAttribute('stroke-dashoffset');
      if (!reduced() && finalOffset !== null) {
        var circumference = ring.getAttribute('stroke-dasharray') || '251.2';
        ring.setAttribute('stroke-dashoffset', circumference);
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () { ring.setAttribute('stroke-dashoffset', finalOffset); });
        });
      }
    });

    var percent = document.getElementById('dayRingPercent');
    if (percent && percent.textContent.trim() === '100%') ringComplete(energy);
    if (percent) {
      var ringObserver = new MutationObserver(function () {
        if (percent.textContent.trim() === '100%') ringComplete(energy);
      });
      ringObserver.observe(percent, { childList: true, characterData: true, subtree: true });
    }

    var xpFill = document.getElementById('xpBarFill');
    var rank = document.getElementById('rankName');
    observeMilestones(xpFill, xpFill && xpFill.parentElement);
    observeMilestones(rank, rank && rank.parentElement);
  }

  function ringComplete(ring) {
    if (reduced() || !ring || ring.dataset.nxComplete === 'true') return;
    ring.dataset.nxComplete = 'true';
    ring.parentElement.classList.add('nx-ring-complete');
    particleBurst(ring.parentElement, 'nx-confetti', 12);
  }

  function observeMilestones(source, target) {
    if (!source || !target) return;
    var initialized = false;
    var observer = new MutationObserver(function () {
      if (!initialized) { initialized = true; return; }
      target.classList.remove('nx-milestone-flash');
      void target.offsetWidth;
      target.classList.add('nx-milestone-flash');
      particleBurst(target, 'nx-xp-particle', 10);
      if (source.id === 'rankName') {
        source.classList.remove('nx-rank-unlock');
        void source.offsetWidth;
        source.classList.add('nx-rank-unlock');
      }
    });
    observer.observe(source, { attributes: true, childList: true, characterData: true, subtree: true });
    initialized = true;
  }

  function initTabs() {
    all('.tab-nav, .skill-tabs, .day-tabs').forEach(function (host) {
      host.classList.add('nx-tab-host');
      var ink = host.querySelector(':scope > .nx-tab-ink');
      if (!ink) {
        ink = document.createElement('span');
        ink.className = 'nx-tab-ink';
        ink.setAttribute('aria-hidden', 'true');
        host.appendChild(ink);
      }
      updateTabInk(host, ink);
    });

    document.addEventListener('click', function (event) {
      var button = event.target.closest('.tab-btn, .skill-tab, .day-tab');
      if (!button) return;
      var host = button.parentElement;
      var ink = host && host.querySelector(':scope > .nx-tab-ink');
      if (ink) window.requestAnimationFrame(function () { updateTabInk(host, ink); });
    });

    var observer = new MutationObserver(function () {
      all('.tab-nav, .skill-tabs, .day-tabs').forEach(function (host) {
        var ink = host.querySelector(':scope > .nx-tab-ink');
        if (ink) updateTabInk(host, ink);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function updateTabInk(host, ink) {
    var active = host.querySelector('.active');
    if (!active || reduced()) return;
    var hostRect = host.getBoundingClientRect();
    var rect = active.getBoundingClientRect();
    ink.style.width = rect.width + 'px';
    ink.style.transform = 'translateX(' + (rect.left - hostRect.left + host.scrollLeft) + 'px)';
  }

  function initCharts() {
    if (window.Chart && window.Chart.defaults && !reduced()) {
      window.Chart.defaults.animation = window.Chart.defaults.animation || {};
      window.Chart.defaults.animation.duration = 720;
      window.Chart.defaults.animation.easing = 'easeOutQuart';
    }
    var stageSelector = '.hist-chart-wrap, .sleep-chart-wrap, .mood-chart-wrap, .consistency-chart-wrap, .weight-chart-wrap, .sparkline-wrap';
    all(stageSelector).forEach(function (stage) { stage.classList.add('nx-chart-stage', 'nx-chart-enter'); });
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.remove('nx-chart-enter');
            void entry.target.offsetWidth;
            entry.target.classList.add('nx-chart-enter');
          }
        });
      }, { threshold: .12 });
      all(stageSelector).forEach(function (stage) { io.observe(stage); });
    }
  }

  function initSkills() {
    var observer = new MutationObserver(function () { enhanceSkillNodes(); });
    observer.observe(document.body, { childList: true, subtree: true });
    enhanceSkillNodes();
  }

  function enhanceSkillNodes() {
    all('.ladder-step, .ladder-dot').forEach(function (node, index) {
      if (node.classList.contains('nx-skill-node')) return;
      node.classList.add('nx-skill-node');
      node.style.setProperty('--nx-node-delay', Math.min(index, 10) * 90 + 'ms');
      if (node.classList.contains('done') || node.classList.contains('current')) node.classList.add('nx-node-mounted');
    });
    all('.sparkline-wrap svg').forEach(function (svg) {
      svg.classList.add('nx-sparkline');
      all('path, polyline', svg).forEach(function (path) {
        if (!path.getAttribute('stroke-dasharray')) {
          try {
            var length = path.getTotalLength();
            path.style.setProperty('--nx-spark-length', length);
            path.style.strokeDasharray = length;
            path.style.strokeDashoffset = length;
          } catch (e) { /* Static SVG fallback. */ }
        }
      });
    });
  }

  function initNumbers() {
    var selector = '.rep-val, .stat-val, .stat-box-val, .xp-total, .session-val, [data-numeric]';
    var observer = new MutationObserver(function (records) {
      if (reduced()) return;
      records.forEach(function (record) {
        var el = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (!el || !el.matches || !el.matches(selector)) return;
        el.classList.remove('nx-number-pop', 'nx-number-up', 'nx-number-down');
        void el.offsetWidth;
        el.classList.add('nx-number-pop', 'nx-number-up');
      });
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  function initRestTimer() {
    var overlay = document.getElementById('rest-overlay');
    var display = document.getElementById('rest-display');
    if (!overlay || !display) return;
    var wasOpen = overlay.classList.contains('open');
    var observer = new MutationObserver(function () {
      var isOpen = overlay.classList.contains('open');
      var seconds = parseInt(display.textContent, 10);
      document.body.classList.toggle('nx-rest-critical', isOpen && seconds <= 5 && seconds > 0);
      if (wasOpen && !isOpen && seconds <= 0) {
        document.body.classList.add('nx-rest-shake');
        var flash = document.createElement('div');
        flash.className = 'nx-rest-flash';
        flash.setAttribute('aria-hidden', 'true');
        document.body.appendChild(flash);
        window.setTimeout(function () {
          document.body.classList.remove('nx-rest-shake');
          flash.remove();
        }, 760);
      }
      wasOpen = isOpen;
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    observer.observe(display, { childList: true, characterData: true, subtree: true });
  }

  function initNavPill() {
    all('.nav-pill').forEach(function (nav) {
      if (nav.querySelector(':scope > .nx-nav-indicator')) return;
      var indicator = document.createElement('span');
      indicator.className = 'nx-nav-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      nav.insertBefore(indicator, nav.firstChild);

      function update() {
        var active = nav.querySelector('.nav-link.active, .nav-link.is-active');
        if (!active) return;
        var navRect = nav.getBoundingClientRect();
        var rect = active.getBoundingClientRect();
        indicator.style.width = rect.width + 'px';
        indicator.style.height = rect.height + 'px';
        indicator.style.transform = 'translate3d(' + (rect.left - navRect.left + nav.scrollLeft) + 'px,0,0)';
      }
      update();
      window.addEventListener('resize', update, { passive: true });
      nav.addEventListener('scroll', update, { passive: true });
      var observer = new MutationObserver(update);
      observer.observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });
      nav.querySelectorAll('.nav-link').forEach(function (link) {
        link.addEventListener('click', function () { window.requestAnimationFrame(update); });
      });
    });
  }

  function fuzzyMatch(query, text) {
    var q = query.toLowerCase().trim();
    var value = text.toLowerCase();
    if (!q) return 1;
    if (value.indexOf(q) !== -1) return 100 - value.indexOf(q);
    var pos = 0;
    for (var i = 0; i < q.length; i += 1) {
      pos = value.indexOf(q[i], pos);
      if (pos === -1) return 0;
      pos += 1;
    }
    return 40 - (value.length - q.length);
  }

  function initCommandPalette() {
    var commands = [
      { label: 'Open Dashboard', hint: 'Home', icon: '⌂', href: '/src/pages/index.html', keys: 'dashboard home' },
      { label: 'Open Goals', hint: 'Dashboard section', icon: '◎', href: '/src/pages/index.html#goals-section', keys: 'goals target' },
      { label: 'Open Wellness', hint: 'Sleep, habits, recovery', icon: '◌', href: '/src/pages/health.html', keys: 'wellness health sleep habits' },
      { label: 'Open Gym Tracker', hint: 'Strength and progress', icon: '◇', href: '/src/pages/gym.html', keys: 'gym tracker strength' },
      { label: 'Start Workout', hint: 'Live workout mode', icon: '▶', href: '/src/pages/live-workout.html', keys: 'start workout live session' },
      { label: 'Check Skills', hint: 'Calisthenics progressions', icon: '✦', href: '/src/pages/progression-tab.html', keys: 'skills calisthenics planche handstand' },
      { label: 'Open Grind Log', hint: 'XP and daily output', icon: 'ϟ', href: '/src/pages/grind-log.html', keys: 'grind log xp productivity' },
      { label: 'Weekly Check-in', hint: 'FaceScan AI', icon: '◉', href: '/src/pages/facescan.html', keys: 'facescan face scan check in check-in' }
    ];
    var backdrop = document.createElement('div');
    backdrop.className = 'nx-command-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = '<section class="nx-command-panel" role="dialog" aria-modal="true" aria-labelledby="nx-command-title">' +
      '<div class="nx-command-head"><div><div class="nx-command-kicker">NEXUS COMMAND</div><h2 id="nx-command-title">What do you want to open?</h2></div><kbd>ESC</kbd></div>' +
      '<label class="nx-command-search"><span aria-hidden="true">⌕</span><input type="search" autocomplete="off" spellcheck="false" placeholder="Search modules or actions…" aria-label="Search commands"></label>' +
      '<div class="nx-command-results" role="listbox" aria-label="Command results"></div>' +
      '<div class="nx-command-foot"><span>↑↓ Navigate</span><span>↵ Open</span><span>⌘K / Ctrl K</span></div></section>';
    document.body.appendChild(backdrop);
    var input = backdrop.querySelector('input');
    var results = backdrop.querySelector('.nx-command-results');
    var selected = 0;
    var isOpen = false;

    function visibleCommands() {
      var query = input.value;
      return commands.map(function (command, index) {
        return { command: command, index: index, score: fuzzyMatch(query, command.label + ' ' + command.keys) };
      }).filter(function (item) { return item.score > 0; }).sort(function (a, b) { return b.score - a.score; });
    }
    function render() {
      var list = visibleCommands();
      selected = Math.max(0, Math.min(selected, list.length - 1));
      results.innerHTML = list.length ? list.map(function (item, index) {
        var c = item.command;
        return '<button class="nx-command-item' + (index === selected ? ' is-selected' : '') + '" type="button" role="option" aria-selected="' + (index === selected) + '" style="--i:' + index + '" data-command-index="' + item.index + '"><span class="nx-command-icon" aria-hidden="true">' + c.icon + '</span><span class="nx-command-copy"><strong>' + c.label + '</strong><small>' + c.hint + '</small></span><span class="nx-command-arrow" aria-hidden="true">↗</span></button>';
      }).join('') : '<div class="nx-command-empty">No matching command. Try a module name.</div>';
    }
    function close() {
      if (!isOpen) return;
      isOpen = false;
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
      window.setTimeout(function () { if (!isOpen) backdrop.style.display = 'none'; }, 220);
    }
    function open() {
      isOpen = true;
      backdrop.style.display = 'flex';
      backdrop.setAttribute('aria-hidden', 'false');
      input.value = '';
      selected = 0;
      render();
      window.requestAnimationFrame(function () {
        backdrop.classList.add('is-open');
        input.focus();
      });
    }
    function execute() {
      var list = visibleCommands();
      if (!list[selected]) return;
      close();
      window.setTimeout(function () { window.location.href = list[selected].command.href; }, 120);
    }
    input.addEventListener('input', function () { selected = 0; render(); });
    input.addEventListener('keydown', function (event) {
      var list = visibleCommands();
      if (event.key === 'ArrowDown') { event.preventDefault(); selected = Math.min(selected + 1, Math.max(0, list.length - 1)); render(); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); selected = Math.max(selected - 1, 0); render(); }
      else if (event.key === 'Enter') { event.preventDefault(); execute(); }
      else if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    results.addEventListener('click', function (event) {
      var item = event.target.closest('[data-command-index]');
      if (!item) return;
      var command = commands[Number(item.getAttribute('data-command-index'))];
      close();
      window.setTimeout(function () { window.location.href = command.href; }, 120);
    });
    backdrop.addEventListener('click', function (event) { if (event.target === backdrop) close(); });
    document.addEventListener('keydown', function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); isOpen ? close() : open(); }
      else if (event.key === 'Escape' && isOpen) close();
    });
    window.NexusCommandPalette = { open: open, close: close };
  }

  function initNavigation() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href]');
      if (!link || reduced() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
      var url;
      try { url = new URL(link.href, window.location.href); } catch (e) { return; }
      if (url.origin !== window.location.origin ||
        (url.pathname === window.location.pathname && url.hash) ||
        link.hasAttribute('download') || link.getAttribute('aria-disabled') === 'true' ||
        link.target === '_self' && link.closest('form')) return;
      event.preventDefault();
      document.body.classList.add('nx-page-exit');
      window.setTimeout(function () { window.location.href = link.href; }, 210);
    }, true);
  }

  window.nxAnimateSuccess = function (button, label) {
    if (!button) return;
    button.classList.add('nx-success-state');
    if (label) button.textContent = label;
  };

  function boot() {
    injectAmbient();
    initCursorGlow();
    initCards();
    initCardTilt();
    initSkeletons();
    initRipples();
    initProgressAndRings();
    initTabs();
    initNavPill();
    initCharts();
    initSkills();
    initNumbers();
    initRestTimer();
    initCommandPalette();
    initNavigation();
    window.addEventListener('nexus-theme-change', syncFocusMode);
    syncFocusMode();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
