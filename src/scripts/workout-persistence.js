// NEXUS live-workout persistence.
// Workout sessions remain local-first so logging works without a connection.
(function initializeWorkoutStore() {
  'use strict';

  // ─── CONFIGURATION ───────────────────────────────────────────────
  const STORAGE_PREFIX = 'nexus_workout_';

  // ─── STORAGE HELPERS ──────────────────────────────────────────────
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

  // ─── PUBLIC STORE ────────────────────────────────────────────────
  function saveWorkout(date, workoutData) {
    const dateKey = toDateKey(date);
    const payload = {
      version: 1,
      date: dateKey,
      savedAt: new Date().toISOString(),
      data: workoutData,
    };

    writeWorkout(dateKey, payload);
    return Promise.resolve({ data: payload, error: null, local: true });
  }

  function loadWorkout(date) {
    return Promise.resolve(readWorkout(date));
  }

  window.NexusWorkoutStore = {
    dateKey: toDateKey,
    key: getStorageKey,
    readLocal: readWorkout,
    save: saveWorkout,
    load: loadWorkout,
  };
})();
