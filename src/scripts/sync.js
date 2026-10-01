// NEXUS single-user local-first sync. Credentials are injected only at build.
(function initNexusSync() {
  'use strict';
  const USER_ID = 'nexus-ibrahim';
  const TABLE = 'nexus_state';
  const QUEUE_KEY = 'nexus_sync_queue_v1';
  const URL = '__SUPABASE_URL__';
  const KEY = '__SUPABASE_KEY__';
  const TIMEOUT = 10000;
  let clientPromise = null, client = null, inflight = 0, lastOk = null;
  let flushPromise = null, serial = Promise.resolve();
  const listeners = [];
  const revisions = new Map();
  function read(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value == null ? fallback : value; } catch (_) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { console.warn('[NEXUS sync] local save failed', error); return false; } }
  function online() { return navigator.onLine !== false; }
  function queue() { const q = read(QUEUE_KEY, []); return Array.isArray(q) ? q.filter(e => e && typeof e.key === 'string') : []; }
  function status() {
    if (inflight) return 'pending';
    if (!online() || lastOk === false) return 'offline';
    return queue().length || lastOk == null ? 'pending' : 'synced';
  }
  function notify() { listeners.slice().forEach(fn => { try { fn(status()); } catch (_) {} }); }
  function bounded(promise) {
    let timer;
    return Promise.race([Promise.resolve(promise), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('NEXUS sync timed out')), TIMEOUT); })]).finally(() => clearTimeout(timer));
  }
  async function timedFetch(input, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    const outer = init && init.signal;
    const abort = () => controller.abort();
    if (outer) { if (outer.aborted) abort(); else outer.addEventListener('abort', abort, { once: true }); }
    try {
      const response = await fetch(input, Object.assign({}, init, { signal: controller.signal }));
      // Keep the timeout active while consuming the response body.
      const body = await response.arrayBuffer();
      return new Response([204, 205, 304].includes(response.status) ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
    } finally { clearTimeout(timer); if (outer) outer.removeEventListener('abort', abort); }
  }
  function getClient() {
    if (client) return Promise.resolve(client);
    if (clientPromise) return clientPromise;
    if (URL.includes('__SUPABASE') || KEY.includes('__SUPABASE') || !URL || !KEY) return Promise.reject(new Error('Supabase credentials missing'));
    clientPromise = bounded(import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'))
      .then(mod => { client = mod.createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: timedFetch } }); return client; })
      .catch(error => { clientPromise = null; throw error; });
    return clientPromise;
  }
  function enqueue(key, data) {
    const entry = { key, data, queuedAt: Date.now(), id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) };
    write(QUEUE_KEY, queue().filter(e => e.key !== key).concat(entry)); notify(); return entry;
  }
  function removeSent(entries) {
    const ids = new Set(entries.map(e => e.id || JSON.stringify(e)));
    write(QUEUE_KEY, queue().filter(e => !ids.has(e.id || JSON.stringify(e)))); notify();
  }
  function serialize(task) { const result = serial.then(task, task); serial = result.catch(() => {}); return result; }
  function flushQueue() {
    if (flushPromise) return flushPromise;
    flushPromise = serialize(async () => {
      if (!online()) { notify(); return false; }
      const snapshot = queue();
      if (!snapshot.length) return true;
      inflight++; notify();
      try {
        const sb = await getClient();
        const latest = new Map(snapshot.map(e => [e.key, e]));
        const rows = Array.from(latest.values(), e => ({ user_id: USER_ID, key: e.key, data: e.data, updated_at: new Date(e.queuedAt).toISOString() }));
        const result = await sb.from(TABLE).upsert(rows, { onConflict: 'user_id,key' });
        if (result.error) throw result.error;
        removeSent(snapshot); lastOk = true; return true;
      } catch (error) { lastOk = false; console.warn('[NEXUS sync] writes retained for retry', error); return false; }
      finally { inflight--; notify(); }
    }).finally(() => { flushPromise = null; if (lastOk === true && queue().length && online()) setTimeout(flushQueue, 0); });
    return flushPromise;
  }
  function save(key, data) {
    const local = write(key, data);
    revisions.set(key, (revisions.get(key) || 0) + 1);
    const entry = enqueue(key, JSON.parse(JSON.stringify(data)));
    return flushQueue().then(ok => ({ ok: ok && !queue().some(e => e.id === entry.id), local, queued: queue().some(e => e.key === key), error: ok ? null : new Error('Remote save pending') }));
  }
  async function load(key) {
    await backfillPromise;
    const revision = revisions.get(key) || 0;
    if (!online() || queue().some(e => e.key === key)) return { data: read(key, null), source: 'local', error: null };
    inflight++; notify();
    try {
      const sb = await getClient();
      const result = await sb.from(TABLE).select('data').eq('user_id', USER_ID).eq('key', key).maybeSingle();
      if (result.error) throw result.error;
      lastOk = true;
      if (revision !== (revisions.get(key) || 0) || queue().some(e => e.key === key)) return { data: read(key, null), source: 'local', error: null };
      if (result.data && result.data.data != null) { write(key, result.data.data); return { data: result.data.data, source: 'remote', error: null }; }
      return { data: read(key, null), source: 'local', error: null };
    } catch (error) { lastOk = false; return { data: read(key, null), source: 'local', error }; }
    finally { inflight--; notify(); }
  }
  async function hydrate(key, merge) {
    const local = read(key, null); // Snapshot before load updates the mirror.
    const revision = revisions.get(key) || 0;
    const result = await load(key);
    if (revision !== (revisions.get(key) || 0)) return read(key, null);
    const merged = typeof merge === 'function' ? merge(result.data, local) : result.data;
    if (merged != null && JSON.stringify(merged) !== JSON.stringify(result.data)) await save(key, merged);
    return merged;
  }
  // Insert-only migration: an existing remote row always wins, even if a
  // second device inserts it between discovery and this request.
  const BACKFILL_KEY = 'nexus_backfill_v1';
  const fixedKeys = new Set(['ibrahim_gym_v1','ibrahim_gym_done','gym_pr_v1','gym_measurements_v1','gym_schedule_v1','grind_log_v1','cali_skills_v1','long_goals_v1','day_window_v1','wellness:habits','wellness:sleep','wellness:recovery','wellness:dreams','wellness:journal']);
  function isDataKey(key) { return fixedKeys.has(key) || /^wellness:done:\d{4}-\d{2}-\d{2}$/.test(key) || /^nexus_workout_\d{4}-\d{2}-\d{2}$/.test(key); }
  const legacyRows = [];
  try {
    for (let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i); if (!isDataKey(key)) continue;
      const data=read(key,null); if(data!=null) legacyRows.push({user_id:USER_ID,key,data});
    }
  } catch (_) {}
  async function backfill() {
    if(read(BACKFILL_KEY,false) || !online()) return false;
    inflight++;notify();
    try {
      const sb=await getClient();
      for(let i=0;i<legacyRows.length;i+=50) {
        const result=await sb.from(TABLE).upsert(legacyRows.slice(i,i+50),{onConflict:'user_id,key',ignoreDuplicates:true});
        if(result.error)throw result.error;
      }
      write(BACKFILL_KEY,{completedAt:new Date().toISOString()});lastOk=true;return true;
    } catch(error) {lastOk=false;console.warn('[NEXUS sync] backfill will retry',error);return false;}
    finally {inflight--;notify();}
  }
  const backfillPromise=serialize(backfill);
  window.addEventListener('online',()=>serialize(backfill));

  window.NexusSync = {
    USER_ID, save, load, hydrate, flush: flushQueue, getStatus: status, isOnline: online,
    _getClient: getClient,
    _dropQueued: key => { write(QUEUE_KEY, queue().filter(e => e.key !== key)); notify(); },
    onStatusChange: fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }
  };
  window.addEventListener('online', () => { lastOk = null; flushQueue(); });
  window.addEventListener('offline', notify);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => flushQueue(), { once: true });
  else setTimeout(flushQueue, 0);
})();
