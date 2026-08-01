'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const script = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'scripts', 'apple-health.js'),
  'utf8'
);

function createClient(fetchImpl) {
  const storage = new Map();
  const localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  };
  const window = {};
  const context = {
    window,
    localStorage,
    fetch: fetchImpl,
    console,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    BigInt,
    WeakSet,
    Set,
    Map,
    Promise,
    encodeURIComponent,
    Error,
  };

  vm.runInNewContext(script, context, { filename: 'apple-health.js' });
  return { api: window.appleHealth, storage };
}

test('sanitizes Apple Health metadata before cache serialization', () => {
  const { api, storage } = createClient(async () => ({
    ok: true,
    async json() {
      return {
        records: [{
          id: 'complex-metadata',
          workout_date: '2026-08-01',
          workout_type: 'Cycling',
          active_calories: 10,
          duration_minutes: 20,
          metadata: {
            HKElevationAscended: { qty: 12.5, units: 'm' },
            nested: { value: 4 },
            circular: null,
          },
        }],
      };
    },
  }));

  const circular = {};
  circular.self = circular;
  assert.deepEqual(JSON.parse(JSON.stringify(api.sanitizeMetadata({
    quantity: { value: 2, units: 'kg' },
    circular,
    invalid: new Date('not-a-date'),
  }))), {
    quantity: 2,
    circular: { self: '[Circular]' },
    invalid: 'Invalid Date',
  });

  return api.refresh().then(() => {
    const cached = JSON.parse(storage.get('apple_health_metrics_v1'));
    assert.deepEqual(cached.rows[0].metadata, {
      HKElevationAscended: 12.5,
      nested: 4,
      circular: null,
    });
  });
});

test('contains throwing metadata getters without aborting sanitization', () => {
  const { api } = createClient(async () => ({
    ok: true,
    async json() { return { records: [] }; },
  }));
  const hostile = Object.create(null);
  Object.defineProperty(hostile, 'broken', {
    enumerable: true,
    get() { throw new Error('corrupted metadata'); },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(api.sanitizeMetadata({ hostile }))), {
    hostile: {},
  });
});

test('contains throwing row fields during normalization', async () => {
  const row = {
    workout_date: '2026-08-01',
    workout_type: 'Row Getter Test',
  };
  Object.defineProperty(row, 'metadata', {
    enumerable: true,
    get() { throw new Error('corrupted row metadata'); },
  });

  const { api, storage } = createClient(async () => ({
    ok: true,
    async json() { return { records: [row] }; },
  }));

  await api.refresh();
  const cached = JSON.parse(storage.get('apple_health_metrics_v1'));
  assert.deepEqual(cached.rows[0].metadata, {});
  assert.equal(cached.rows[0].workout_type, 'Row Getter Test');
});

test('coalesces overlapping runAutoSync triggers and releases the lock', async () => {
  let calls = 0;
  let releaseFirst;
  let releaseSecond;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const secondGate = new Promise((resolve) => { releaseSecond = resolve; });
  const { api } = createClient(async () => {
    calls += 1;
    await (calls === 1 ? firstGate : secondGate);
    return { ok: true, async json() { return { records: [] }; } };
  });

  const first = api.runAutoSync();
  const overlapping = api.runAutoSync();
  assert.strictEqual(overlapping, first);
  assert.equal(calls, 1);

  releaseFirst();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);

  releaseSecond();
  await first;

  const next = api.runAutoSync();
  assert.notStrictEqual(next, first);
  releaseSecond();
  await next;
  assert.equal(calls, 3);
});

test('runs a queued follow-up after a failed refresh and then releases the lock', async () => {
  let calls = 0;
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const { api } = createClient(async () => {
    calls += 1;
    if (calls === 1) {
      await firstGate;
      throw new Error('temporary network failure');
    }
    return { ok: true, async json() { return { records: [] }; } };
  });

  const first = api.runAutoSync();
  const queued = api.runAutoSync();
  assert.strictEqual(queued, first);
  releaseFirst();
  await assert.rejects(first, /temporary network failure/);
  assert.equal(calls, 2);

  await api.runAutoSync();
  assert.equal(calls, 3);
});

test('releases the sync lock after a failed refresh', async () => {
  let calls = 0;
  const { api } = createClient(async () => {
    calls += 1;
    if (calls === 1) throw new Error('temporary network failure');
    return { ok: true, async json() { return { records: [] }; } };
  });

  await assert.rejects(api.runAutoSync(), /temporary network failure/);
  await api.runAutoSync();
  assert.equal(calls, 2);
});
