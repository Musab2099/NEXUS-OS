// NEXUS GitHub Health Intel connector.
// The PAT is intentionally local-only: this module talks directly to GitHub and
// stores only the configured source plus a parsed six-hour cache in localStorage.
(function (root) {
  'use strict';

  const CONFIG_KEY = 'nexus_health_github_config_v1';
  const CACHE_KEY = 'nexus_health_github_cache_v1';
  const DEFAULT_CACHE_MINUTES = 360;
  const GITHUB_TIMEOUT_MS = 10000;
  const DEFAULT_FIELDS = {
    date: 'date',
    sleep: 'sleep_hours',
    hrv: 'hrv',
    rhr: 'resting_heart_rate',
    calories: 'active_calories',
    steps: 'steps',
  };
  const METRICS = [
    { key: 'sleep', label: 'Sleep', unit: 'h', icon: '◒', color: '#A78BFA', format: value => value.toFixed(1) },
    { key: 'hrv', label: 'HRV', unit: 'ms', icon: '⌁', color: '#D946EF', format: value => String(Math.round(value)) },
    { key: 'rhr', label: 'Resting HR', unit: 'bpm', icon: '♥', color: '#F59E0B', format: value => String(Math.round(value)) },
    { key: 'calories', label: 'Active cal', unit: 'kcal', icon: '↗', color: '#10B981', format: value => String(Math.round(value)) },
    { key: 'steps', label: 'Steps', unit: 'k', icon: '⌁', color: '#8B5CF6', format: value => (value / 1000).toFixed(1) },
  ];

  const $ = id => document.getElementById(id);

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(root.localStorage.getItem(key) || 'null');
      return value == null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new Error('Browser storage is full. Clear the GitHub cache and try again.');
    }
  }

  function clampCacheMinutes(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(10080, parsed)) : DEFAULT_CACHE_MINUTES;
  }

  function requestWithTimeout(input, options, readBody) {
    const controller = new root.AbortController();
    const requestOptions = options || {};
    const externalSignal = requestOptions.signal;
    let onAbort = null;
    const timeoutId = root.setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);

    function cleanup() {
      root.clearTimeout(timeoutId);
      if (onAbort) externalSignal.removeEventListener('abort', onAbort);
    }

    try {
      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort(externalSignal.reason);
        } else {
          onAbort = () => controller.abort(externalSignal.reason);
          externalSignal.addEventListener('abort', onAbort, { once: true });
        }
      }

      return root.fetch(input, { ...requestOptions, signal: controller.signal })
        .then(response => Promise.resolve(readBody(response)).then(body => ({ response, body })))
        .finally(cleanup);
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  function getConfig() {
    const value = readJson(CONFIG_KEY, null);
    if (!value || typeof value !== 'object') return null;
    return {
      pat: typeof value.pat === 'string' ? value.pat : '',
      repo: typeof value.repo === 'string' ? value.repo : '',
      branch: typeof value.branch === 'string' && value.branch ? value.branch : 'main',
      path: typeof value.path === 'string' ? value.path : '',
      cacheMinutes: clampCacheMinutes(value.cacheMinutes),
      fieldMap: { ...DEFAULT_FIELDS, ...(value.fieldMap && typeof value.fieldMap === 'object' ? value.fieldMap : {}) },
    };
  }

  function configFingerprint(config) {
    return JSON.stringify({
      repo: config.repo,
      branch: config.branch,
      path: config.path,
      cacheMinutes: config.cacheMinutes,
      fieldMap: config.fieldMap,
    });
  }

  function updateConnectionUi(connected) {
    const hint = $('ghConfiguredHint');
    const refresh = $('ghNavRefresh');
    if (hint) hint.textContent = connected ? 'Connected · auto-fetch checks the local cache first.' : 'Not connected · your PAT never goes through NEXUS servers.';
    if (refresh) refresh.style.display = connected ? '' : 'none';
  }

  function saveConfig(config) {
    writeJson(CONFIG_KEY, config);
  }

  function clearStoredData() {
    root.localStorage.removeItem(CONFIG_KEY);
    root.localStorage.removeItem(CACHE_KEY);
  }

  function getPath(value, path) {
    if (!path) return undefined;
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, path)) return value[path];
    return String(path).split('.').reduce((current, part) => {
      if (current == null || typeof current !== 'object') return undefined;
      return current[part];
    }, value);
  }

  function numeric(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  function dateKey(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    const text = String(value == null ? '' : value).trim();
    if (!text) return null;
    const match = text.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  function stableRows(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const preferred = ['data', 'records', 'entries', 'workouts', 'metrics', 'samples', 'results'];
    const visited = new Set();
    function findRows(value, depth) {
      if (depth > 5 || !value || typeof value !== 'object' || visited.has(value)) return null;
      visited.add(value);
      if (Array.isArray(value)) {
        return value.some(item => item && typeof item === 'object') ? value : null;
      }
      for (const key of preferred) {
        const found = findRows(value[key], depth + 1);
        if (found) return found;
      }
      for (const child of Object.values(value)) {
        const found = findRows(child, depth + 1);
        if (found) return found;
      }
      return null;
    }
    return findRows(payload, 0) || [payload];
  }

  function normalizeRows(payload, fieldMap) {
    const map = { ...DEFAULT_FIELDS, ...(fieldMap || {}) };
    const output = {};
    METRICS.forEach(metric => { output[metric.key] = {}; });
    stableRows(payload).forEach(row => {
      if (!row || typeof row !== 'object') return;
      const date = dateKey(getPath(row, map.date));
      if (!date) return;
      METRICS.forEach(metric => {
        const value = numeric(getPath(row, map[metric.key]));
        if (value != null) output[metric.key][date] = value;
      });
    });
    return flatten(output);
  }

  function flatten(metrics) {
    const result = {};
    METRICS.forEach(metric => {
      result[metric.key] = Object.entries(metrics[metric.key] || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, value]) => ({ date, value }));
    });
    return result;
  }

  function parseCsvLine(line) {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"' && quoted) {
        cell += '"'; index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        cells.push(cell.trim()); cell = '';
      } else {
        cell += char;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  function parseCsv(text, fieldMap) {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (!lines.length) return normalizeRows([], fieldMap);
    const headers = parseCsvLine(lines[0]);
    const rows = lines.slice(1).map(line => {
      const cells = parseCsvLine(line);
      return headers.reduce((row, header, index) => {
        row[header] = cells[index] == null ? '' : cells[index];
        return row;
      }, {});
    });
    return normalizeRows(rows, fieldMap);
  }

  function parseXml(text) {
    if (typeof root.DOMParser !== 'function') throw new Error('This browser cannot parse XML exports.');
    const doc = new root.DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('The XML file is malformed.');
    const metrics = {};
    METRICS.forEach(metric => { metrics[metric.key] = {}; });
    doc.querySelectorAll('Record').forEach(record => {
      const type = record.getAttribute('type') || '';
      const endDate = record.getAttribute('endDate') || record.getAttribute('startDate');
      const date = dateKey(endDate);
      if (!date) return;
      const value = numeric(record.getAttribute('value'));
      if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
        const sleepValue = (record.getAttribute('value') || '').toLowerCase();
        const start = new Date(record.getAttribute('startDate') || '');
        const end = new Date(endDate || '');
        const hours = sleepValue.includes('asleep') && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
          ? (end - start) / 3600000
          : null;
        if (hours != null && hours > 0 && hours < 16) metrics.sleep[date] = (metrics.sleep[date] || 0) + hours;
      } else if (type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' && value != null) {
        metrics.hrv[date] = value;
      } else if (type === 'HKQuantityTypeIdentifierRestingHeartRate' && value != null && metrics.rhr[date] == null) {
        metrics.rhr[date] = value;
      } else if (type === 'HKQuantityTypeIdentifierActiveEnergyBurned' && value != null) {
        metrics.calories[date] = (metrics.calories[date] || 0) + value;
      } else if (type === 'HKQuantityTypeIdentifierStepCount' && value != null) {
        metrics.steps[date] = (metrics.steps[date] || 0) + value;
      }
    });
    return flatten(metrics);
  }

  function parseAny(raw, fieldMap) {
    const text = String(raw || '').trim();
    if (!text) throw new Error('The GitHub file is empty.');
    if (text[0] === '<') return parseXml(text);
    if (text[0] === '{' || text[0] === '[') {
      let payload;
      try { payload = JSON.parse(text); } catch (error) { throw new Error('The JSON file is malformed.'); }
      return normalizeRows(payload, fieldMap);
    }
    return parseCsv(text, fieldMap);
  }

  function decodeBase64(value) {
    const binary = root.atob(String(value).replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  function readCache() {
    const cache = readJson(CACHE_KEY, null);
    return cache && cache.data && cache.ts ? cache : null;
  }

  function cacheIsFresh(config, cache) {
    return Boolean(cache && cache.configKey === configFingerprint(config) && config.cacheMinutes > 0 && Date.now() - cache.ts < config.cacheMinutes * 60000);
  }

  function repoUrl(config) {
    const repo = config.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
    if (!/^[^/]+\/[^/]+$/.test(repo)) throw new Error('Repository must use owner/repo format.');
    const path = config.path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    if (!path) throw new Error('File path is required.');
    return `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(config.branch || 'main')}`;
  }

  async function fetchSource(config) {
    if (!config.pat) throw new Error('A GitHub PAT is required.');
    const metadataRequest = await requestWithTimeout(repoUrl(config), {
      headers: {
        Authorization: `Bearer ${config.pat}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }, response => response.json().catch(() => ({})));
    const response = metadataRequest.response;
    const metadata = metadataRequest.body;
    if (!response.ok) {
      let message = `GitHub returned ${response.status}`;
      message = metadata && metadata.message ? metadata.message : message;
      if (response.status === 401 || response.status === 403) message = 'GitHub rejected the PAT or repository permission.';
      if (response.status === 404) message = 'File or private repository not found. Check repo, branch, and PAT access.';
      throw new Error(message);
    }
    if (metadata.content) return decodeBase64(metadata.content);
    if (!metadata.download_url) throw new Error('GitHub returned no readable file content.');
    let downloadUrl;
    try { downloadUrl = new URL(metadata.download_url); } catch (error) { throw new Error('GitHub returned an invalid download URL.'); }
    const safeHost = downloadUrl.protocol === 'https:'
      && (downloadUrl.hostname === 'github.com' || downloadUrl.hostname === 'raw.githubusercontent.com' || downloadUrl.hostname.endsWith('.githubusercontent.com'));
    if (!safeHost) throw new Error('GitHub returned an unsafe download URL.');
    const downloadRequest = await requestWithTimeout(downloadUrl.href, {
      headers: { Authorization: `Bearer ${config.pat}`, Accept: 'application/octet-stream' },
    }, response => response.text());
    if (!downloadRequest.response.ok) throw new Error(`GitHub download failed (${downloadRequest.response.status}).`);
    return downloadRequest.body;
  }

  function days(count) {
    const result = [];
    const now = new Date();
    for (let index = count - 1; index >= 0; index -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - index);
      result.push(date.toISOString().slice(0, 10));
    }
    return result;
  }

  function valueFor(records, date) {
    const item = records.find(record => record.date === date);
    return item ? item.value : null;
  }

  function average(values) {
    const valid = values.filter(value => value != null);
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  }

  function formatAge(ts) {
    const minutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
    return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function drawSparkline(canvas, values, color) {
    if (!canvas || !canvas.parentElement) return;
    const width = canvas.clientWidth || 260;
    const height = canvas.clientHeight || 42;
    const dpr = root.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr;
    const context = canvas.getContext('2d');
    context.scale(dpr, dpr);
    const valid = values.filter(value => value != null);
    if (valid.length < 2) return;
    const min = Math.min(...valid); const range = Math.max(...valid) - min || 1;
    const points = values.map((value, index) => ({
      x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
      y: height - 5 - (((value == null ? min : value) - min) / range) * (height - 10),
    }));
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.strokeStyle = color; context.lineWidth = 2; context.lineJoin = 'round'; context.stroke();
    const last = points[points.length - 1];
    context.beginPath(); context.arc(last.x, last.y, 3, 0, Math.PI * 2); context.fillStyle = color; context.fill();
  }

  function setStatus(message, kind) {
    ['ghStatus', 'ghModalStatus'].forEach(id => {
      const status = $(id);
      if (!status) return;
      status.hidden = !message;
      status.className = `gh-status ${kind || ''}`;
      status.textContent = message || '';
    });
  }

  function showConfigModal() {
    const config = getConfig() || { pat: '', repo: '', branch: 'main', path: '', cacheMinutes: DEFAULT_CACHE_MINUTES, fieldMap: DEFAULT_FIELDS };
    $('ghPat').value = config.pat;
    $('ghRepo').value = config.repo;
    $('ghBranch').value = config.branch;
    $('ghPath').value = config.path;
    $('ghCache').value = config.cacheMinutes;
    Object.entries(DEFAULT_FIELDS).forEach(([key, fallback]) => { $(`ghField${key[0].toUpperCase()}${key.slice(1)}`).value = config.fieldMap[key] ?? fallback; });
    $('ghModal').classList.add('open');
    $('ghPat').focus();
  }

  function hideConfigModal() { $('ghModal').classList.remove('open'); }

  function readForm() {
    const fieldMap = {};
    Object.keys(DEFAULT_FIELDS).forEach(key => { fieldMap[key] = $(`ghField${key[0].toUpperCase()}${key.slice(1)}`).value.trim(); });
    return {
      pat: $('ghPat').value.trim(), repo: $('ghRepo').value.trim(), branch: $('ghBranch').value.trim() || 'main', path: $('ghPath').value.trim(),
      cacheMinutes: clampCacheMinutes($('ghCache').value), fieldMap,
    };
  }

  function renderEmpty(message, actionLabel) {
    const target = $('ghDashboard');
    if (!target) return;
    target.innerHTML = `<div class="gh-empty"><div class="gh-empty-icon">⌁</div><h3>${esc(message)}</h3><p>Connect a private GitHub file to turn your exported metrics into a seven-day readiness view.</p><button class="btn-primary" type="button" id="ghEmptyAction">${esc(actionLabel || 'Configure GitHub')}</button></div>`;
    $('ghEmptyAction').addEventListener('click', showConfigModal);
  }

  function readiness(data) {
    const recent = days(7);
    const get = key => valueFor(data[key], recent[recent.length - 1]) ?? valueFor(data[key], recent[recent.length - 2]);
    const sleep = get('sleep'); const hrv = get('hrv'); const rhr = get('rhr');
    const sleepScore = sleep == null ? 50 : Math.max(0, Math.min(100, 100 - Math.abs(sleep - 8) * 15));
    const hrvAverage = average(recent.slice(0, 6).map(date => valueFor(data.hrv, date)));
    const rhrAverage = average(recent.slice(0, 6).map(date => valueFor(data.rhr, date)));
    const hrvScore = hrv == null ? 50 : hrvAverage == null ? 70 : Math.max(0, Math.min(100, hrv / hrvAverage * 70));
    const rhrScore = rhr == null ? 50 : rhrAverage == null ? 70 : Math.max(0, Math.min(100, rhrAverage / rhr * 70));
    return { score: Math.round(sleepScore * .4 + hrvScore * .35 + rhrScore * .25), sleep, hrv, rhr, sleepScore, hrvScore, rhrScore };
  }

  function render(data, fromCache, cacheTs) {
    const dashboard = $('ghDashboard');
    if (!dashboard) return;
    const recent = days(7); const score = readiness(data); const today = recent[recent.length - 1];
    const state = score.score >= 85 ? ['READY TO TRAIN', '#10B981', 'Strong recovery signals. Full session is on the table.']
      : score.score >= 70 ? ['TRAIN SMART', '#F59E0B', 'Keep intensity controlled and prioritize clean technique.']
        : score.score >= 50 ? ['LIGHT SESSION', '#F97316', 'Choose mobility, easy skill drills, or active recovery.']
          : ['REST DAY', '#EF4444', 'Prioritize sleep, food, and hydration before pushing volume.'];
    dashboard.innerHTML = `
      <div class="gh-intel-head"><div><div class="card-eyebrow">GitHub health intel</div><h2 class="gh-headline">${score.score}<span>/100</span></h2><p class="gh-subline"><i style="background:${state[1]}"></i>${state[0]} · ${esc(new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }))}</p></div><div class="gh-head-actions"><span class="gh-cache">${fromCache ? `cached ${formatAge(cacheTs)}` : 'synced just now'}</span><button class="btn-ghost" type="button" id="ghRefresh">↻ Refresh</button></div></div>
      <p class="gh-readiness" style="border-left-color:${state[1]}">${state[2]}</p>
      <div class="gh-metrics">${METRICS.map(metric => {
        const value = valueFor(data[metric.key], today) ?? valueFor(data[metric.key], recent[recent.length - 2]);
        const avg = average(recent.map(date => valueFor(data[metric.key], date)));
        return `<article class="gh-metric"><div class="gh-metric-icon" style="color:${metric.color}">${metric.icon}</div><div class="gh-metric-label">${metric.label}</div><strong>${value == null ? '—' : metric.format(value)}<small>${value == null ? '' : metric.unit}</small></strong><span>${avg == null ? 'No 7d avg' : `7d avg ${metric.format(avg)}${metric.unit}`}</span></article>`;
      }).join('')}</div>
      <div class="gh-section-label">7-day trends <span></span></div>
      <div class="gh-trends">${METRICS.filter(metric => ['sleep', 'hrv', 'rhr', 'steps'].includes(metric.key)).map(metric => `<div class="gh-trend"><span>${metric.label}</span><div><canvas id="ghSpark${metric.key}"></canvas></div><strong>${average(recent.map(date => valueFor(data[metric.key], date))) == null ? '—' : metric.format(average(recent.map(date => valueFor(data[metric.key], date))))}</strong></div>`).join('')}</div>`;
    $('ghRefresh').addEventListener('click', () => load(true));
    METRICS.filter(metric => ['sleep', 'hrv', 'rhr', 'steps'].includes(metric.key)).forEach(metric => drawSparkline($(`ghSpark${metric.key}`), recent.map(date => valueFor(data[metric.key], date)), metric.color));
  }

  function setLoading(loading) {
    const dashboard = $('ghDashboard');
    if (!dashboard) return;
    if (loading) dashboard.innerHTML = '<div class="gh-loading"><span></span><span></span><span></span><p>Fetching your private health file…</p></div>';
  }

  async function load(force) {
    const config = getConfig();
    if (!config) { renderEmpty('Connect your health repo'); return; }
    if (force) root.localStorage.removeItem(CACHE_KEY);
    const cache = readCache();
    if (!force && cacheIsFresh(config, cache)) { render(cache.data, true, cache.ts); return; }
    setLoading(true); setStatus('');
    try {
      const data = parseAny(await fetchSource(config), config.fieldMap);
      const hasData = METRICS.some(metric => data[metric.key].length);
      if (!hasData) throw new Error('No mapped records found. Check the date and metric field names.');
      const timestamp = Date.now();
      writeJson(CACHE_KEY, { ts: timestamp, configKey: configFingerprint(config), data });
      render(data, false, timestamp);
      updateConnectionUi(true);
      setStatus('Connected · data cached locally for the configured window.', 'ok');
    } catch (error) {
      const fallback = readCache();
      if (fallback && fallback.configKey === configFingerprint(config)) { render(fallback.data, true, fallback.ts); setStatus(`Refresh failed: ${error.message} Showing cached data.`, 'error'); }
      else { renderEmpty('GitHub fetch failed'); setStatus(error.message, 'error'); }
    }
  }

  async function loadLocalFile(file) {
    try {
      const config = getConfig() || { fieldMap: DEFAULT_FIELDS };
      const data = parseAny(await file.text(), config.fieldMap);
      if (!METRICS.some(metric => data[metric.key].length)) throw new Error('No mapped records found. Check the date and metric field names.');
      render(data, false, Date.now());
      setStatus(`Loaded ${file.name} locally · nothing was uploaded.`, 'ok');
    } catch (error) {
      renderEmpty('Could not parse file');
      setStatus(error.message, 'error');
    }
  }

  function demoData() {
    const dates = days(7);
    const series = values => dates.map((date, index) => ({ date, value: values[index] }));
    return {
      sleep: series([7.1, 8.0, 6.7, 7.6, 8.2, 7.8, 7.7]),
      hrv: series([48, 54, 43, 51, 58, 55, 61]),
      rhr: series([55, 53, 57, 54, 52, 52, 50]),
      calories: series([560, 710, 340, 640, 760, 430, 680]),
      steps: series([9200, 11200, 5700, 8600, 12000, 6900, 10400]),
    };
  }

  async function testConnection() {
    try {
      const config = readForm();
      if (!config.pat || !config.repo || !config.path) throw new Error('PAT, repository, and file path are required.');
      setStatus('Testing GitHub connection…');
      const data = parseAny(await fetchSource(config), config.fieldMap);
      const count = METRICS.reduce((total, metric) => total + data[metric.key].length, 0);
      setStatus(`Connected · mapped ${count} metric series records.`, 'ok');
    } catch (error) { setStatus(error.message, 'error'); }
  }

  async function saveAndConnect() {
    try {
      const config = readForm();
      if (!config.pat || !config.repo || !config.path) throw new Error('PAT, repository, and file path are required.');
      saveConfig(config); root.localStorage.removeItem(CACHE_KEY); updateConnectionUi(true); hideConfigModal(); await load(true);
    } catch (error) { setStatus(error.message, 'error'); }
  }

  function disconnect() {
    clearStoredData(); updateConnectionUi(false); hideConfigModal(); renderEmpty('Connect your health repo'); setStatus('Disconnected. The PAT and local cache were removed.', 'ok');
  }

  function init() {
    if (!$('ghDashboard')) return;
    $('ghConfigure').addEventListener('click', showConfigModal);
    if ($('ghNavConfigure')) $('ghNavConfigure').addEventListener('click', showConfigModal);
    if ($('ghNavRefresh')) $('ghNavRefresh').addEventListener('click', () => load(true));
    if ($('ghUpload')) $('ghUpload').addEventListener('change', event => { if (event.target.files[0]) loadLocalFile(event.target.files[0]); event.target.value = ''; });
    if ($('ghDemo')) $('ghDemo').addEventListener('click', () => { render(demoData(), false, Date.now()); setStatus('Demo data loaded · no network request made.', 'ok'); });
    $('ghClose').addEventListener('click', hideConfigModal);
    $('ghTest').addEventListener('click', testConnection);
    $('ghSave').addEventListener('click', saveAndConnect);
    $('ghDisconnect').addEventListener('click', disconnect);
    $('ghModal').addEventListener('click', event => { if (event.target === $('ghModal')) hideConfigModal(); });
    root.addEventListener('keydown', event => { if (event.key === 'Escape') hideConfigModal(); });
    updateConnectionUi(Boolean(getConfig()));
    load(false);
  }

  const api = { parseAny, parseCsv, parseXml, normalizeRows, getPath, DEFAULT_FIELDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.nexusGitHubHealth = api;
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
}(typeof window !== 'undefined' ? window : globalThis));
