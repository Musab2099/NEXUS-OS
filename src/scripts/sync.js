// =============================================================
// Shared cloud-sync helper. Each page calls initCloudSync({...}).
// =============================================================
(function () {
  'use strict';
  // Supabase credentials are injected at build time from .env.
  // In the committed source these are placeholders; scripts/build.js
  // substitutes real values when producing dist/.
  const SUPABASE_URL = '__SUPABASE_URL__';
  const SUPABASE_KEY = '__SUPABASE_KEY__';
  const CLOUD_TIMEOUT_MS = 10000;

  // Bound both direct REST calls and Supabase client's internal requests.
  // Preserve a caller-provided signal so Supabase can still cancel requests.
  function fetchWithTimeout(input, options) {
    const controller = new AbortController();
    const requestOptions = options || {};
    const externalSignal = requestOptions.signal;
    let onAbort = null;
    let settled = false;
    let timeoutId;
    function cleanup() {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (onAbort) externalSignal.removeEventListener('abort', onAbort);
    }
    timeoutId = setTimeout(() => { controller.abort(); cleanup(); }, CLOUD_TIMEOUT_MS);

    try {
      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort(externalSignal.reason);
        } else {
          onAbort = function () { controller.abort(externalSignal.reason); };
          externalSignal.addEventListener('abort', onAbort, { once: true });
        }
      }

      return fetch(input, { ...requestOptions, signal: controller.signal })
        .then(async function (response) {
          if (typeof response.arrayBuffer !== 'function' || typeof Response !== 'function') {
            cleanup();
            return response;
          }
          const body = await response.arrayBuffer();
          const wrapped = new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
          cleanup();
          return wrapped;
        })
        .catch(function (error) {
          cleanup();
          throw error;
        });
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  window.initCloudSync = function (config) {
    const appKey = config && config.appKey;
    const syncedKeys = (config && config.syncedKeys) || [];
    const syncedPrefixes = (config && config.syncedPrefixes) || [];
    const onApplied = config && config.onApplied;
    if (!appKey || !window.supabase) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    // Bail if values are still placeholders (i.e. someone ran the source
    // files directly without running `npm run build`).
    if (SUPABASE_URL.indexOf('__SUPABASE_') === 0) return;
    if (SUPABASE_KEY.indexOf('__SUPABASE_') === 0) return;

    let supa = null, pushTimer = null, suppressSync = false, lastSyncedJson = null;

    function matches(k) {
      if (!k) return false;
      if (syncedKeys.indexOf(k) !== -1) return true;
      for (let i = 0; i < syncedPrefixes.length; i++) {
        if (k.indexOf(syncedPrefixes[i]) === 0) return true;
      }
      return false;
    }
    function listAllKeys() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (matches(k)) out.push(k);
      }
      return out;
    }
    function collect() {
      const out = {};
      for (const k of listAllKeys()) {
        const v = localStorage.getItem(k);
        if (v == null) continue;
        try { out[k] = JSON.parse(v); } catch (e) { out[k] = v; }
      }
      return out;
    }
    const origSet = localStorage.setItem.bind(localStorage);
    const origRemove = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      origSet(k, v);
      try { if (!suppressSync && matches(k)) schedulePush(); } catch (e) { }
    };
    localStorage.removeItem = function (k) {
      origRemove(k);
      try { if (!suppressSync && matches(k)) schedulePush(); } catch (e) { }
    };
    function applyRemote(remote) {
      if (!remote || typeof remote !== 'object') return false;
      suppressSync = true;
      let changed = false;
      try {
        for (const k of Object.keys(remote)) {
          if (!matches(k)) continue;
          const incoming = JSON.stringify(remote[k]);
          const local = localStorage.getItem(k);
          if (local !== incoming) { try { origSet(k, incoming); changed = true; } catch (e) { } }
        }
        for (const k of listAllKeys()) {
          if (!(k in remote)) { try { origRemove(k); changed = true; } catch (e) { } }
        }
      } finally { suppressSync = false; }
      if (changed && typeof onApplied === 'function') { try { onApplied(); } catch (e) { } }
      return changed;
    }
    async function pushNow() {
      if (!supa) return;
      const state = collect();
      const json = JSON.stringify(state);
      if (json === lastSyncedJson) return;
      try {
        const { error } = await supa.from('app_state').upsert(
          { key: appKey, data: state, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
        if (!error) lastSyncedJson = json;
      } catch (e) { }
    }
    function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, 250); }
    function flushOnUnload() {
      const state = collect();
      const json = JSON.stringify(state);
      if (json === lastSyncedJson) return;
      try {
        fetchWithTimeout(SUPABASE_URL + '/rest/v1/app_state?on_conflict=key', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ key: appKey, data: state, updated_at: new Date().toISOString() }),
          keepalive: true,
        }).catch(() => { });
        lastSyncedJson = json;
      } catch (e) { }
    }
    (async function init() {
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        global: { fetch: fetchWithTimeout },
      });
      try {
        const { data, error } = await supa.from('app_state').select('data').eq('key', appKey).maybeSingle();
        if (!error && data && data.data && Object.keys(data.data).length > 0) {
          lastSyncedJson = JSON.stringify(data.data);
          applyRemote(data.data);
        } else if (Object.keys(collect()).length > 0) {
          schedulePush();
        }
      } catch (e) { }
      supa.channel('app_state_' + appKey)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.' + appKey,
        }, (payload) => {
          if (!payload.new || !payload.new.data) return;
          const incoming = JSON.stringify(payload.new.data);
          if (incoming === lastSyncedJson) return;
          lastSyncedJson = incoming;
          applyRemote(payload.new.data);
        })
        .subscribe();
    })();
    window.addEventListener('beforeunload', flushOnUnload);
    window.addEventListener('pagehide', flushOnUnload);
    window.addEventListener('storage', (e) => { if (e.key && matches(e.key)) schedulePush(); });
  };
})();
