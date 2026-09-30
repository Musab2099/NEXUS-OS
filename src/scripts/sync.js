// ============================================================================
// NEXUS-OS — Cross-device sync engine (src/scripts/sync.js)
//
// WHAT CHANGED / WHY (cross-device workout sync fix):
// Workouts and tracker data previously lived only in localStorage, so data
// logged on one device never appeared on another. This module gives every
// tracker a single shared Supabase persistence layer:
//   • One hardcoded user identity — NEXUS_USER_ID ('nexus-ibrahim') — used by
//     ALL reads and writes. No per-device UUIDs; this is a single-user OS.
//   • Key/value upserts + SELECTs scoped by user_id, so any device fetching
//     the same keys sees the same data.
//   • localStorage stays as an OFFLINE FALLBACK ONLY: local state is written
//     immediately (offline-first UX), mirrored to Supabase on success, and
//     local data is only trusted at load when Supabase fails or is empty.
//   • Failed/queued writes are retried automatically when connectivity
//     returns (navigator.onLine + 'online' event).
//   • window.NexusSync.getStatus() exposes 'synced' | 'offline' | 'pending'
//     for the dashboard badge (badge UI intentionally not built here).
//
// Credentials (__SUPABASE_URL__ / __SUPABASE_KEY__) are injected at build
// time by scripts/build.js (PLACEHOLDER_FILES already lists this file).
// ============================================================================

(function initNexusSync() {
  'use strict';

  // ─── SINGLE-USER IDENTITY ─────────────────────────────────────────────────
  // The one and only identity for this personal OS. Every Supabase read and
  // write across ALL tracker modules must use this constant as user_id.
  const NEXUS_USER_ID = 'nexus-ibrahim';

  // ─── CONFIGURATION ─────────────────────────────────────────────────────────
  const TABLE = 'nexus_state';       // key/value JSON state table
  const QUEUE_KEY = 'nexus_sync_queue_v1';
  const MODULE_TAG = '[NEXUS sync]';

  // Supabase credentials are injected by scripts/build.js.
  const SUPABASE_URL = '__SUPABASE_URL__';
  const SUPABASE_KEY = '__SUPABASE_KEY__';
  const ESM_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

  let sb = null;            // Supabase client (lazy, async-loaded)
  let clientPromise = null; // in-flight dynamic import
  let loadFailed = false;   // hard failure (no credentials / import error)
  let inflight = 0;         // number of pending Supabase operations
  let lastSyncOk = false;   // at least one successful remote op this session
  let lastRemoteOk = null;  // most recent remote operation outcome
  const listeners = [];

  // ─── HELPERS ───────────────────────────────────────────────────────────────
  function hasCredentials() {
    return SUPABASE_URL && SUPABASE_KEY &&
      !SUPABASE_URL.includes('__SUPABASE') && !SUPABASE_URL.startsWith('your-') &&
      !SUPABASE_KEY.includes('__SUPABASE') && !SUPABASE_KEY.startsWith('your-');
  }

  function logWarn() {
    const args = Array.prototype.slice.call(arguments);
    args[0] = MODULE_TAG + ' ' + args[0];
    console.warn.apply(console, args);
  }

  function isOnline() {
    try { return navigator.onLine !== false; } catch (e) { return true; }
  }

  function readLocalJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeLocalJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      logWarn('local save failed for %s:', key, error);
      return false;
    }
  }

  function notify() {
    const status = getStatus();
    listeners.slice().forEach(function (fn) {
      try { fn(status); } catch (e) { /* listener errors are non-fatal */ }
    });
  }

  function beginOp() {
    inflight++;
    notify();
  }

  function endOp(success) {
    inflight = Math.max(0, inflight - 1);
    lastRemoteOk = success === true;
    if (lastRemoteOk) lastSyncOk = true;
    notify();
  }

  // ─── STATUS API ─────────────────────────────────────────────────────────────
  // 'synced'  — last remote operation succeeded and nothing is queued
  // 'pending' — there are queued local writes, or an operation is in flight
  // 'offline' — browser reports offline, or Supabase is unavailable/failed
  function getStatus() {
    const queued = readLocalJson(QUEUE_KEY, []);
    const hasQueue = Array.isArray(queued) && queued.length > 0;
    if (inflight > 0) return 'pending';
    if (hasQueue) return 'pending';
    if (!isOnline()) return 'offline';
    if (lastRemoteOk === false || (loadFailed && !lastSyncOk)) return 'offline';
    if (!lastSyncOk) return 'pending';
    return 'synced';
  }

  // ─── CLIENT BOOTSTRAP (CDN ESM) ────────────────────────────────────────────
  function getClient() {
    if (sb) return Promise.resolve(sb);
    if (loadFailed) return Promise.reject(new Error('Supabase client unavailable'));
    if (clientPromise) return clientPromise;

    if (!hasCredentials()) {
      loadFailed = true;
      notify();
      logWarn('Supabase credentials missing — running in offline fallback mode.');
      return Promise.reject(new Error('Supabase credentials missing'));
    }

    clientPromise = import(/* @vite-ignore */ ESM_URL)
      .then(function (mod) {
        if (!mod || typeof mod.createClient !== 'function') {
          throw new Error('supabase-js ESM bundle malformed');
        }
        sb = mod.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        return sb;
      })
      .catch(function (error) {
        loadFailed = true;
        notify();
        clientPromise = null;
        logWarn('Supabase client init failed — offline fallback mode.', error);
        throw error;
      });

    return clientPromise;
  }

  // ─── OFFLINE QUEUE ──────────────────────────────────────────────────────────
  // Each entry: { key, data, queuedAt }. FIFO; the latest entry for a key
  // wins when flushing, so repeated offline edits collapse into one upsert.
  function readQueue() {
    const q = readLocalJson(QUEUE_KEY, []);
    return Array.isArray(q) ? q : [];
  }

  function writeQueue(queue) {
    writeLocalJson(QUEUE_KEY, queue);
    notify();
  }

  function enqueue(key, data) {
    const queue = readQueue();
    queue.push({ key: key, data: data, queuedAt: Date.now() });
    writeQueue(queue);
  }

  function flushQueue() {
    if (!isOnline()) return Promise.resolve(false);
    const queue = readQueue();
    if (!queue.length) return Promise.resolve(true);

    // Collapse to the newest entry per key, preserving first-seen order.
    const latest = {};
    const order = [];
    queue.forEach(function (entry) {
      if (!order.includes(entry.key)) order.push(entry.key);
      latest[entry.key] = entry.data;
    });

    beginOp();
    return getClient()
      .then(function (client) {
        const rows = order.map(function (key) {
          return {
            user_id: NEXUS_USER_ID,
            key: key,
            data: latest[key],
            updated_at: new Date().toISOString(),
          };
        });
        return client
          .from(TABLE)
          .upsert(rows, { onConflict: 'user_id,key' })
          .then(function (result) {
            if (result.error) throw result.error;
            writeQueue([]);
            endOp(true);
            return true;
          });
      })
      .catch(function (error) {
        endOp(false);
        logWarn('queue flush failed (%d item(s) kept):', queue.length, error);
        return false;
      });
  }

  function flushIfOnline() {
    notify();
    if (isOnline() && readQueue().length) flushQueue();
  }

  function notifyOffline() {
    notify();
  }

  function dropQueued(key) {
    const queue = readQueue();
    const filtered = queue.filter(function (entry) { return entry.key !== key; });
    if (filtered.length !== queue.length) writeQueue(filtered);
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', flushIfOnline);
    window.addEventListener('offline', notifyOffline);
    // Also retry on load in case queued writes exist from a previous session.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', flushIfOnline);
    } else {
      setTimeout(flushIfOnline, 0);
    }
  }

  // ─── CORE PERSISTENCE API ──────────────────────────────────────────────────
  // One JSON document per key, scoped to NEXUS_USER_ID. Mirrors the existing
  // per-module localStorage keys (ibrahim_gym_v1, grind_log_v1, ...) one-to-one.

  /**
   * Save state: writes localStorage immediately (offline fallback), then
   * upserts to Supabase as user_id=NEXUS_USER_ID. On Supabase failure the
   * write is queued for retry when connectivity returns.
   * @returns {Promise<{ok:boolean, local:boolean, queued:boolean, error:Error|null}>}
   */
  function saveState(key, data) {
    writeLocalJson(key, data); // offline-first: local mirror always written

    if (!isOnline()) {
      enqueue(key, data);
      return Promise.resolve({ ok: false, local: true, queued: true, error: null });
    }

    beginOp();
    return getClient()
      .then(function (client) {
        return client.from(TABLE).upsert(
          {
            user_id: NEXUS_USER_ID,
            key: key,
            data: data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,key' }
        );
      })
      .then(function (result) {
        if (result.error) throw result.error;
        endOp(true);
        // Successful write — drop any earlier queued copies of this key.
        dropQueued(key);
        return { ok: true, local: true, queued: false, error: null };
      })
      .catch(function (error) {
        endOp(false);
        enqueue(key, data);
        logWarn('save queued for retry (%s):', key, error);
        return { ok: false, local: true, queued: true, error: error };
      });
  }

  /**
   * Load state: SELECT from Supabase filtered by user_id=NEXUS_USER_ID.
   * Falls back to localStorage ONLY when the remote fetch fails or the key
   * does not exist remotely yet.
   * @returns {Promise<{data:any, source:'remote'|'local'|'empty', error:Error|null}>}
   */
  function loadState(key) {
    if (!isOnline()) {
      return Promise.resolve({ data: readLocalJson(key, null), source: 'local', error: null });
    }

    beginOp();
    return getClient()
      .then(function (client) {
        return client.from(TABLE)
          .select('data')
          .eq('user_id', NEXUS_USER_ID)
          .eq('key', key)
          .maybeSingle();
      })
      .then(function (result) {
        if (result.error) throw result.error;
        endOp(true);
        if (result.data && 'data' in result.data && result.data.data != null) {
          // Remote copy exists — also seed the local mirror for offline boots.
          writeLocalJson(key, result.data.data);
          return { data: result.data.data, source: 'remote', error: null };
        }
        // Remote empty: fall back to local (first sync of this key).
        return { data: readLocalJson(key, null), source: 'local', error: null };
      })
      .catch(function (error) {
        endOp(false);
        logWarn('load fell back to local (%s):', key, error);
        return { data: readLocalJson(key, null), source: 'local', error: error };
      });
  }

  /**
   * Convenience: load-then-merge. Calls merge(remoteData, localData) — the
   * callback decides the winning payload (last-write-wins by default) — and
   * persists the merged result if it differs from the local copy.
   */
  function hydrateState(key, merge) {
    const mergeFn = typeof merge === 'function'
      ? merge
      : function (remoteData, localData) { return remoteData != null ? remoteData : localData; };

    return loadState(key).then(function (result) {
      const localData = readLocalJson(key, null);
      const merged = mergeFn(result.data, localData);
      if (merged != null && merged !== localData) {
        return saveState(key, merged).then(function () { return merged; });
      }
      return merged;
    });
  }

  // ─── PUBLIC API ─────────────────────────────────────────────────────────────
  window.NexusSync = {
    USER_ID: NEXUS_USER_ID,
    save: saveState,
    load: loadState,
    hydrate: hydrateState,
    flush: flushQueue,
    isOnline: isOnline,
    getStatus: getStatus,
    /* Internal hooks — used by workout-persistence.js for its legacy
       per-date workout_logs table and offline retry markers. */
    _getClient: function () { return getClient(); },
    _dropQueued: dropQueued,
    onStatusChange: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return function () {
        const i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    },
  };
})();
