// =============================================================
// Apple Health read-through cache for the gym dashboard.
// Writes happen only through /api/sync-health; this client is read-only.
// =============================================================
(function () {
  'use strict';

  const CACHE_KEY = 'apple_health_metrics_v1';

  function todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function cacheGet() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function cacheSet(value) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch (e) { }
  }

  function normalise(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(function (row) {
      return {
        id: row.id || null,
        workout_date: row.workout_date || (row.created_at ? row.created_at.slice(0, 10) : null),
        workout_type: typeof row.workout_type === 'string' ? row.workout_type : 'Workout',
        active_calories: Number(row.active_calories) || 0,
        avg_heart_rate: row.avg_heart_rate == null ? null : Number(row.avg_heart_rate),
        duration_minutes: Number(row.duration_minutes) || 0,
        source: row.source || 'apple_health',
        created_at: row.created_at || null,
      };
    }).filter(function (row) { return row.workout_date; });
  }

  function cachedRows() {
    const cached = cacheGet();
    return normalise(cached.rows || []);
  }

  function saveRows(rows) {
    cacheSet({ saved_at: new Date().toISOString(), rows: normalise(rows).slice(0, 100) });
  }

  async function fetchRows() {
    let token = '';
    try { token = localStorage.getItem('apple_health_sync_token') || ''; } catch (e) { }
    const response = await fetch('/api/sync-health?date=' + encodeURIComponent(todayKey()), {
      headers: {
        Accept: 'application/json',
        Authorization: token ? 'Bearer ' + token : '',
      },
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error('Apple Health metrics unavailable');
    const result = await response.json();
    const rows = normalise(result.records || []);
    saveRows(rows);
    return rows;
  }

  window.appleHealth = {
    today: todayKey,
    cached: cachedRows,
    refresh: fetchRows,
    latestForDate: function (date) {
      return cachedRows().filter(function (row) { return row.workout_date === date; })[0] || null;
    },
  };
})();
