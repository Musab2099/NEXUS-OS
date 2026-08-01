// =============================================================
// Apple Health read-through cache for the gym dashboard.
// Writes happen only through /api/sync-health; this client is read-only.
// =============================================================
(function () {
  'use strict';

  const CACHE_KEY = 'apple_health_metrics_v1';
  const QUANTITY_KEYS = ['value', 'qty', 'quantity', 'amount'];

  function todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  // Convert HealthKit-shaped values into values that can safely cross the
  // cache/JSON boundary. Quantity objects collapse to their scalar value;
  // ordinary objects and arrays remain structured. Circular and unsupported
  // values become harmless strings/nulls instead of aborting the refresh.
  function sanitizeMetadataValue(value, seen, extractQuantity) {
    if (value == null) return null;

    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'bigint') return String(value);
    if (typeof value === 'undefined') return null;
    if (typeof value !== 'object') {
      try { return String(value); } catch (error) { return null; }
    }

    try {
      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
      }
    } catch (error) {
      return null;
    }

    let prototype;
    let isArray = false;
    let tag;
    try {
      prototype = Object.getPrototypeOf(value);
      isArray = Array.isArray(value);
      tag = Object.prototype.toString.call(value);
    } catch (error) {
      try { return String(value); } catch (stringError) { return null; }
    }
    // Use the object tag rather than comparing Object.prototype identity so
    // values from an iframe/worker realm remain sanitizable.
    if (tag !== '[object Object]' && !isArray) {
      try { return String(value); } catch (error) { return null; }
    }
    if (prototype !== Object.prototype && prototype !== null && !isArray && tag !== '[object Object]') {
      try { return String(value); } catch (error) { return null; }
    }

    const visited = seen || new WeakSet();
    try {
      if (visited.has(value)) return '[Circular]';
      visited.add(value);
    } catch (error) {
      return null;
    }

    if (isArray) {
      let result;
      try {
        result = Array.prototype.map.call(value, function (item) {
          return sanitizeMetadataValue(item, visited, true);
        });
      } catch (error) {
        result = [];
      }
      visited.delete(value);
      return result;
    }

    if (extractQuantity) {
      let scalarKey = null;
      try {
        scalarKey = QUANTITY_KEYS.find(function (key) {
          return Object.prototype.hasOwnProperty.call(value, key);
        });
      } catch (error) {
        visited.delete(value);
        return null;
      }
      if (scalarKey) {
        let scalarValue;
        try { scalarValue = value[scalarKey]; } catch (error) { scalarValue = null; }
        const scalar = sanitizeMetadataValue(scalarValue, visited, true);
        visited.delete(value);
        return scalar;
      }
    }

    const result = {};
    let entries;
    try { entries = Object.entries(value); } catch (error) { entries = []; }
    entries.forEach(function (entry) {
      const key = entry[0];
      let item;
      try { item = value[key]; } catch (error) { item = null; }
      // defineProperty preserves literal keys such as __proto__ safely.
      try {
        Object.defineProperty(result, String(key), {
          configurable: true,
          enumerable: true,
          value: sanitizeMetadataValue(item, visited, true),
          writable: true,
        });
      } catch (error) { }
    });
    visited.delete(value);
    return result;
  }

  function sanitizeMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {};
    }

    let prototype;
    let tag;
    try {
      prototype = Object.getPrototypeOf(metadata);
      tag = Object.prototype.toString.call(metadata);
    } catch (error) { return {}; }
    if (tag !== '[object Object]') return {};
    if (prototype !== Object.prototype && prototype !== null && tag !== '[object Object]') return {};
    return sanitizeMetadataValue(metadata, undefined, false) || {};
  }

  function safeJsonStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return '{}';
    }
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
    try { localStorage.setItem(CACHE_KEY, safeJsonStringify(value)); } catch (e) { }
  }

  function safeField(row, key, fallback) {
    try {
      return row && typeof row === 'object' && row[key] !== undefined
        ? row[key]
        : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function normalise(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(function (rawRow) {
      const row = rawRow && typeof rawRow === 'object' ? rawRow : {};
      const createdAt = safeField(row, 'created_at', null);
      const workoutDate = safeField(row, 'workout_date', null);
      let fallbackDate = null;
      try {
        fallbackDate = typeof createdAt === 'string' ? createdAt.slice(0, 10) : null;
      } catch (error) { }

      return {
        id: safeField(row, 'id', null) || null,
        workout_date: workoutDate || fallbackDate,
        workout_type: typeof safeField(row, 'workout_type', null) === 'string'
          ? safeField(row, 'workout_type', null)
          : 'Workout',
        active_calories: Number(safeField(row, 'active_calories', 0)) || 0,
        avg_heart_rate: safeField(row, 'avg_heart_rate', null) == null
          ? null
          : Number(safeField(row, 'avg_heart_rate', null)),
        duration_minutes: Number(safeField(row, 'duration_minutes', 0)) || 0,
        source: safeField(row, 'source', null) || 'apple_health',
        metadata: sanitizeMetadata(safeField(row, 'metadata', null)),
        created_at: createdAt || null,
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

  async function fetchRowsOnce() {
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

  // Coalesce overlapping refresh triggers. A trigger received while a refresh
  // is active requests one follow-up pass; it never starts a second request
  // concurrently and the lock is always released in the finally path.
  let activeSync = null;
  let rerunRequested = false;

  function runAutoSync() {
    if (activeSync) {
      rerunRequested = true;
      return activeSync;
    }

    activeSync = (async function () {
      let firstError = null;
      do {
        rerunRequested = false;
        try {
          await fetchRowsOnce();
        } catch (error) {
          if (!firstError) firstError = error;
        }
      } while (rerunRequested);

      if (firstError) throw firstError;
    })().finally(function () {
      activeSync = null;
      rerunRequested = false;
    });

    return activeSync;
  }

  window.appleHealth = {
    today: todayKey,
    cached: cachedRows,
    refresh: runAutoSync,
    runAutoSync: runAutoSync,
    sanitizeMetadata: sanitizeMetadata,
    latestForDate: function (date) {
      return cachedRows().filter(function (row) { return row.workout_date === date; })[0] || null;
    },
  };
})();
