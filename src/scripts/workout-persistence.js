// ============================================================================
// NEXUS live-workout persistence (src/scripts/workout-persistence.js)
//
// WHAT CHANGED / WHY (cross-device workout sync fix):
// Workout sessions were localStorage-only. They now save and load through the
// shared sync engine's `nexus_state` key/value table, scoped to the single
// NEXUS_USER_ID. This avoids the legacy workout_logs table whose user_id is
// UUID/auth-scoped. The local per-date entry remains an offline fallback, and
// NexusSync queues failed writes for its online-event retry. Public method
// names and signatures remain unchanged.
// ============================================================================
(function initializeWorkoutStore() {
  'use strict';

  const STORAGE_PREFIX = 'nexus_workout_';

  function parseJson(value, fallback) {
    try {
      return value == null ? fallback : JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function toDateKey(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function getStorageKey(date) {
    return STORAGE_PREFIX + toDateKey(date);
  }

  function readWorkout(date) {
    try {
      return parseJson(window.localStorage.getItem(getStorageKey(date)), null);
    } catch (error) {
      return null;
    }
  }

  function writeWorkout(date, value) {
    try {
      window.localStorage.setItem(getStorageKey(date), JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[NEXUS workout] local save failed', error);
      return false;
    }
  }

  function sessionIdentity(data) {
    return data.sessionId || (data.source === 'gym' ? 'gym:' + data.dayIndex : 'live:' + (data.startTs || (data.session && data.session.date) || 'legacy'));
  }

  function mergeWorkoutData(previous, incoming) {
    const sessions = new Map();
    function collect(data) {
      if (!data || typeof data !== 'object') return;
      (Array.isArray(data.sessions) ? data.sessions : []).forEach(function (session) {
        if (session && typeof session === 'object') sessions.set(sessionIdentity(session), session);
      });
      if (data.source === 'gym' || data.startTs || data.session || (Array.isArray(data.log) && data.log.length)) {
        const session = Object.assign({}, data, { sessionId: sessionIdentity(data) });
        delete session.sessions;
        sessions.set(session.sessionId, session);
      }
    }
    collect(previous);
    collect(incoming);
    return Object.assign({}, incoming, { sessions: Array.from(sessions.values()) });
  }

  function saveWorkout(date, workoutData) {
    const dateKey = toDateKey(date);
    const storageKey = getStorageKey(dateKey);
    const payload = {
      version: 2,
      date: dateKey,
      savedAt: new Date().toISOString(),
      data: mergeWorkoutData((readWorkout(dateKey) || {}).data, workoutData),
    };

    // Preserve fast local availability; NexusSync mirrors this same key to
    // nexus_state with user_id=NEXUS_USER_ID or queues it while offline.
    writeWorkout(dateKey, payload);
    const nx = window.NexusSync;
    if (nx && typeof nx.save === 'function') {
      return nx.save(storageKey, payload).then(function (result) {
        return { data: payload, error: result.error || null, local: true, queued: !!result.queued };
      }).catch(function (error) {
        return { data: payload, error: error, local: true, queued: true };
      });
    }

    return Promise.resolve({ data: payload, error: null, local: true });
  }

  function loadWorkout(date) {
    const dateKey = toDateKey(date);
    const storageKey = getStorageKey(dateKey);
    const nx = window.NexusSync;
    if (!nx || typeof nx.load !== 'function') return Promise.resolve(readWorkout(dateKey));

    return nx.load(storageKey)
      .then(function (result) {
        if (result && result.data != null) {
          writeWorkout(dateKey, result.data);
          return result.data;
        }
        return readWorkout(dateKey);
      })
      .catch(function (error) {
        console.warn('[NEXUS workout] remote load failed; using local copy', error);
        return readWorkout(dateKey);
      });
  }

  window.NexusWorkoutStore = {
    dateKey: toDateKey,
    key: getStorageKey,
    readLocal: readWorkout,
    save: saveWorkout,
    load: loadWorkout,
  };
})();
