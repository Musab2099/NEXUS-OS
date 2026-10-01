const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function runtime(remote = new Map(), initial = [], options = {}) {
  const values = new Map(initial); const handlers = {};
  const client = { from: () => ({
    upsert: async (rows, options = {}) => { for (const row of (Array.isArray(rows) ? rows : [rows])) { if (!options.ignoreDuplicates || !remote.has(row.key)) remote.set(row.key, row.data); } return { error: null }; },
    select: () => { let key; const query = { eq: (field, value) => { if (field === 'key') key = value; return query; }, maybeSingle: async () => ({ data: remote.has(key) ? { data: remote.get(key) } : null }) }; return query; }
  }) };
  const context = { console, setTimeout, clearTimeout, Map, Set, Promise, Date, Math, JSON, AbortController, Response,
    navigator: { onLine: true }, document: { readyState: 'loading', addEventListener: () => {} },
    localStorage: { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), key: i => Array.from(values.keys())[i], get length() { return values.size; } },
    window: { addEventListener: (name, fn) => (handlers[name] ||= []).push(fn) },
    mockImport: options.import || (() => Promise.resolve({ createClient: () => client })) };
  const source = fs.readFileSync('src/scripts/sync.js', 'utf8').replaceAll('__SUPABASE_URL__','https://test.invalid').replaceAll('__SUPABASE_KEY__','test-key').replace("import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm')", 'mockImport()');
  vm.runInNewContext(options.timeout ? source.replace('const TIMEOUT = 10000;', 'const TIMEOUT = 20;') : source, context);
  return { nx: context.window.NexusSync, context, values, remote, client, emit: name => (handlers[name] || []).forEach(fn=>fn()) };
}
test('offline writes collapse, load protects pending local data, reconnect flushes', async () => {
  const r = runtime(new Map([['x', { old: true }]]));
  r.context.navigator.onLine = false;
  await r.nx.save('x', { count: 1 }); await r.nx.save('x', { count: 2 });
  assert.equal(JSON.parse(r.values.get('nexus_sync_queue_v1')).length, 1);
  assert.equal((await r.nx.load('x')).data.count, 2);
  r.context.navigator.onLine = true; r.emit('online'); await r.nx.flush();
  assert.equal(r.remote.get('x').count, 2); assert.equal(r.nx.getStatus(), 'synced');
});
test('hydrate captures local data before remote mirror updates', async () => {
  const r = runtime(new Map([['x', [1]]])); r.values.set('x', '[2]');
  await r.nx.hydrate('x', (remote, local) => remote.concat(local));
  assert.deepEqual(JSON.parse(r.values.get('x')), [1,2]);
});
test('new writes arriving during flush survive its acknowledgement', async () => {
  const r = runtime(); let release;
  await r.nx.load('empty');
  r.client.from = () => ({ upsert: rows => new Promise(resolve => { release = () => { for (const row of rows) r.remote.set(row.key,row.data); resolve({}); }; }) });
  const first = r.nx.save('x', 1); await new Promise(resolve => setTimeout(resolve, 0));
  const second = r.nx.save('x', 2); release(); await first; await second;
  assert.equal(JSON.parse(r.values.get('nexus_sync_queue_v1'))[0].data, 2);
  // Drain scheduled retry before test teardown.
  await new Promise(resolve => setTimeout(resolve, 5)); release(); await r.nx.flush();
});
test('backfill inserts missing data once, never overwrites remote, ignores private config', async () => {
  const r = runtime(new Map([['grind_log_v1', {logs:['remote']}]]), [
    ['grind_log_v1', JSON.stringify({logs:['old']})], ['wellness:sleep','[{"date":"2026-09-30","dur":8}]'], ['nexus_health_github_config_v1','{"token":"not-for-sync"}']
  ]);
  await r.nx.load('empty');
  assert.equal(r.remote.get('grind_log_v1').logs[0], 'remote');
  assert.equal(r.remote.get('wellness:sleep')[0].dur, 8);
  assert.equal(r.remote.has('nexus_health_github_config_v1'), false);
  assert.ok(JSON.parse(r.values.get('nexus_backfill_v1')).completedAt);
  r.remote.set('wellness:sleep',[{dur:9}]);
  r.emit('online'); await r.nx.load('empty');
  assert.equal(r.remote.get('wellness:sleep')[0].dur,9);
  const second=runtime(r.remote,Array.from(r.values)); await second.nx.load('empty');
  assert.equal(second.remote.get('wellness:sleep')[0].dur,9);
});
test('hung CDN import settles offline instead of pending',async()=>{
  const r=runtime(new Map(),[],{timeout:true,import:()=>new Promise(()=>{})});
  await r.nx.load('empty'); assert.equal(r.nx.getStatus(),'offline');
});
test('hung queries time out and keep offline writes queued',async()=>{
  const r=runtime(new Map(),[],{timeout:true}); await r.nx.load('empty');
  r.client.from=()=>({upsert:()=>new Promise(()=>{})});
  await r.nx.save('x',1); assert.equal(r.nx.getStatus(),'offline');
  assert.equal(JSON.parse(r.values.get('nexus_sync_queue_v1')).length,1);
});
test('empty reconnect finishes with a settled status',async()=>{
  const r=runtime(); await r.nx.load('empty'); r.emit('online'); await r.nx.flush();
  assert.equal(r.nx.getStatus(),'synced');
});
test('hydration cannot wipe writes made while a read is pending',async()=>{
  const r=runtime(); await r.nx.load('empty'); let release;
  r.client.from=()=>({select:()=>{const q={eq:()=>q,maybeSingle:()=>new Promise(resolve=>{release=()=>resolve({data:{data:{old:true}}});})};return q;}});
  const pending=r.nx.hydrate('x',remote=>remote); await new Promise(resolve=>setTimeout(resolve,0));
  r.context.navigator.onLine=false; await r.nx.save('x',{edited:true}); release(); await pending;
  assert.equal(JSON.parse(r.values.get('x')).edited,true);
});
