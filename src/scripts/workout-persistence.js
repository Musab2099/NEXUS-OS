// NEXUS live workout persistence.
// Workout state is intentionally local-first and remains available offline.
(function () {
  'use strict';

  var PREFIX = 'nexus_workout_';

  function safeJson(value, fallback) {
    try { return value == null ? fallback : JSON.parse(value); } catch (e) { return fallback; }
  }

  function dateKey(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    var date = value instanceof Date ? value : new Date(value || Date.now());
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function localKey(date) { return PREFIX + dateKey(date); }

  function readLocal(date) {
    try { return safeJson(localStorage.getItem(localKey(date)), null); } catch (e) { return null; }
  }

  function writeLocal(date, value) {
    try {
      localStorage.setItem(localKey(date), JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[NEXUS workout] local save failed', error);
      return false;
    }
  }

  function save(date, workoutData) {
    var key = dateKey(date);
    var payload = { version: 1, date: key, savedAt: new Date().toISOString(), data: workoutData };
    writeLocal(key, payload);
    return Promise.resolve({ data: payload, error: null, local: true });
  }

  function load(date) {
    return Promise.resolve(readLocal(date));
  }

  window.NexusWorkoutStore = {
    dateKey: dateKey,
    key: localKey,
    readLocal: readLocal,
    save: save,
    load: load
  };
})();
