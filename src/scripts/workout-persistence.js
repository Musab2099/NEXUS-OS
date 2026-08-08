// NEXUS live workout persistence.
// Local state is written immediately; authenticated cloud writes are best-effort
// and deliberately visible in the console so schema/RLS failures are diagnosable.
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

  async function session() {
    try {
      if (window.nexusSession && window.nexusSession.user) return window.nexusSession;
      if (window.nexusAuthReady) return await window.nexusAuthReady;
      if (window.nexusAuth && window.nexusAuth.getSession) return await window.nexusAuth.getSession();
    } catch (error) {
      console.warn('[NEXUS workout] auth session lookup failed', error);
    }
    return null;
  }

  var saveQueues = {};

  function enqueue(key, task) {
    var previous = saveQueues[key] || Promise.resolve();
    var next = previous.catch(function () {}).then(task);
    saveQueues[key] = next.finally(function () {
      if (saveQueues[key] === next) delete saveQueues[key];
    });
    return next;
  }

  async function save(date, workoutData) {
    var key = dateKey(date);
    var payload = { version: 1, date: key, savedAt: new Date().toISOString(), data: workoutData };
    writeLocal(key, payload);

    return enqueue(key, async function () {
      var currentSession = await session();
      if (!window.supabaseClient || !currentSession || !currentSession.user) {
        console.info('[NEXUS workout] saved locally; cloud unavailable', { date: key });
        return { data: null, error: null, local: true };
      }

      var mergedPayload = payload;
      try {
        var existing = await window.supabaseClient.from('workout_logs').select('workout_data').eq('user_id', currentSession.user.id).eq('date', key).maybeSingle();
        if (!existing.error && existing.data && existing.data.workout_data) {
          var previous = existing.data.workout_data;
          var previousData = previous && previous.data ? previous.data : {};
          var incomingData = payload.data || {};
          var sources = Object.assign({}, previousData.sources || {});
          if (incomingData.source) sources[incomingData.source] = incomingData;
          mergedPayload = {
            version: 1,
            date: key,
            savedAt: payload.savedAt,
            data: Object.assign({}, previousData, incomingData, { sources: sources })
          };
        }
      } catch (mergeError) {
        console.warn('[NEXUS workout] existing row merge failed; writing latest payload', mergeError);
      }
      var row = {
        user_id: currentSession.user.id,
        date: key,
        workout_data: mergedPayload,
        updated_at: new Date().toISOString()
      };
      try {
        var result = await window.supabaseClient.from('workout_logs').upsert(row, { onConflict: 'user_id,date' }).select().maybeSingle();
        console.info('[NEXUS workout] Supabase upsert response', { date: key, data: result.data, error: result.error });
        if (result.error) console.error('[NEXUS workout] Supabase upsert failed', result.error);
        return result;
      } catch (error) {
        console.error('[NEXUS workout] Supabase upsert exception', error);
        return { data: null, error: error };
      }
    });
  }

  async function load(date) {
    var key = dateKey(date);
    var local = readLocal(key);
    var currentSession = await session();
    if (!window.supabaseClient || !currentSession || !currentSession.user) return local;

    try {
      var result = await window.supabaseClient.from('workout_logs').select('workout_data,updated_at').eq('user_id', currentSession.user.id).eq('date', key).maybeSingle();
      console.info('[NEXUS workout] Supabase load response', { date: key, data: result.data, error: result.error });
      if (!result.error && result.data && result.data.workout_data) {
        writeLocal(key, result.data.workout_data);
        return result.data.workout_data;
      }
      if (result.error) console.warn('[NEXUS workout] Supabase load failed; using local fallback', result.error);
    } catch (error) {
      console.warn('[NEXUS workout] Supabase load exception; using local fallback', error);
    }
    return local;
  }

  window.NexusWorkoutStore = {
    dateKey: dateKey,
    key: localKey,
    readLocal: readLocal,
    save: save,
    load: load
  };
})();
