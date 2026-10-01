const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function runtime(remote = new Map()) {
  const values = new Map(); const handlers = {};
  const client = { from: () => ({
    upsert: async rows => { for (const row of (Array.isArray(rows) ? rows : [rows])) remote.set(row.key, row.data); return { error: null }; },
    select: () => { let key; const query = { eq: (field, value) => { if (field === 'key') key = value; return query; }, maybeSingle: async () => ({ data: remote.has(key) ? { data: remote.get(key) } : null }) }; return query; }
  }) };
  const context = { console, setTimeout, clearTimeout, Map, Set, Promise, Date, Math, JSON, AbortController, Response,
    navigator: { onLine: true }, document: { readyState: 'loading', addEventListener: () => {} },
    localStorage: { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), key: i => Array.from(values.keys())[i], get length() { return values.size; } },
    window: { addEventListener: (name, fn) => handlers[name] = fn },
    mockImport: () => Promise.resolve({ createClient: () => client }) };
  const source = fs.readFileSync('src/scripts/sync.js', 'utf8').replaceAll('__SUPABASE_URL__','https://test.invalid').replaceAll('__SUPABASE_KEY__','test-key').replace("import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm')", 'mockImport()');
  vm.runInNewContext(source, context);
  return { nx: context.window.NexusSync, context, values, remote, client };
}
test('offline writes collapse, load protects pending local data, reconnect flushes', async () => {
  const r = runtime(new Map([['x', { old: true }]]));
  r.context.navigator.onLine = false;
  await r.nx.save('x', { count: 1 }); await r.nx.save('x', { count: 2 });
  assert.equal(JSON.parse(r.values.get('nexus_sync_queue_v1')).length, 1);
  assert.equal((await r.nx.load('x')).data.count, 2);
  r.context.navigator.onLine = true; await r.nx.flush();
  assert.equal(r.remote.get('x').count, 2); assert.equal(r.nx.getStatus(), 'synced');
});
test('hydrate captures local data before remote mirror updates', async () => {
  const r = runtime(new Map([['x', [1]]])); r.values.set('x', '[2]');
  await r.nx.hydrate('x', (remote, local) => remote.concat(local));
  assert.deepEqual(JSON.parse(r.values.get('x')), [1,2]);
});
test('new writes arriving during flush survive its acknowledgement', async () => {
  const r = runtime(); let release;
  r.client.from = () => ({ upsert: rows => new Promise(resolve => { release = () => { for (const row of rows) r.remote.set(row.key,row.data); resolve({}); }; }) });
  const first = r.nx.save('x', 1); await new Promise(resolve => setTimeout(resolve, 0));
  const second = r.nx.save('x', 2); release(); await first; await second;
  assert.equal(JSON.parse(r.values.get('nexus_sync_queue_v1'))[0].data, 2);
  // Drain scheduled retry before test teardown.
  await new Promise(resolve => setTimeout(resolve, 5)); release(); await r.nx.flush();
});
