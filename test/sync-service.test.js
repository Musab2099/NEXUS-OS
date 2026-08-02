'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { describe, test } = require('node:test');

function native(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadClient(overrides = {}) {
  const calls = [];
  const storage = new Map();
  const sandbox = {
    console,
    WeakSet,
    Date,
    Number,
    String,
    Object,
    Array,
    JSON,
    Math,
    Promise,
    setTimeout,
    clearTimeout,
    AbortController,
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); },
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 201,
        json: async () => ({ success: true, count: 1 }),
      };
    },
    ...overrides,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(
    fs.readFileSync('src/scripts/sync-service.js', 'utf8'),
    sandbox,
    { filename: 'src/scripts/sync-service.js' }
  );
  return { api: sandbox.appleHealthSync, calls, storage };
}

describe('appleHealthSync', () => {
  test('sanitizes HealthKit quantities and circular metadata before POST', async () => {
    const { api, calls } = loadClient();
    const circular = {};
    circular.self = circular;

    const result = await api.sync({
      id: 'workout-1',
      HKElevationAscended: { qty: 12.5, units: 'm' },
      nested: { value: 3 },
      circular,
    }, {
      endpoint: 'https://project.supabase.co/functions/v1/sync-health',
      token: 'private-token',
    });

    assert.deepEqual(native(result), { success: true, count: 1, status: 201 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://project.supabase.co/functions/v1/sync-health');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.credentials, 'omit');
    assert.ok(calls[0].options.signal instanceof AbortSignal);
    assert.equal(calls[0].options.headers.Authorization, 'Bearer private-token');
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      id: 'workout-1',
      HKElevationAscended: { value: 12.5, units: 'm' },
      nested: 3,
      circular: { self: '[Circular]' },
    });
  });

  test('reads the configured browser token and handles HTTP failures gracefully', async () => {
    const { api, calls, storage } = loadClient({
      fetch: async (url, options) => {
        calls.push({ url, options });
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        };
      },
    });
    storage.set('apple_health_sync_token', 'stored-token');

    const result = await api.sync({ id: 'workout-2' }, {
      endpoint: 'https://project.supabase.co/functions/v1/sync-health',
    });

    assert.deepEqual(native(result), {
      success: false,
      count: 0,
      status: 401,
      error: 'Unauthorized',
    });
    assert.equal(calls[0].options.headers.Authorization, 'Bearer stored-token');
  });

  test('does not throw when endpoint or token is not configured', async () => {
    const { api } = loadClient();
    assert.deepEqual(native(await api.sync({ id: 'workout-3' })), {
      success: false,
      count: 0,
      error: 'Apple Health sync endpoint is not configured',
    });
    assert.deepEqual(native(await api.sync({ id: 'workout-3' }, { endpoint: 'https://example.test' })), {
      success: false,
      count: 0,
      error: 'Apple Health sync token is not configured',
    });
  });

  test('returns a stable client error for network failures and invalid payloads', async () => {
    const { api } = loadClient({
      fetch: async () => { throw new Error('network down'); },
    });

    assert.deepEqual(native(await api.sync(null, {
      endpoint: 'https://project.supabase.co/functions/v1/sync-health',
      token: 'private-token',
    })), {
      success: false,
      count: 0,
      error: 'Apple Health payload must be an object or array',
    });

    assert.deepEqual(native(await api.sync({ id: 'workout-4' }, {
      endpoint: 'https://project.supabase.co/functions/v1/sync-health',
      token: 'private-token',
    })), {
      success: false,
      count: 0,
      error: 'Apple Health sync is unavailable right now',
    });
  });
});
