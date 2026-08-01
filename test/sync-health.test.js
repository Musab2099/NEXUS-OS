'use strict';

const assert = require('node:assert/strict');
const { afterEach, beforeEach, describe, test } = require('node:test');

const handler = require('../api/sync-health');
const { sanitizeMetadata } = require('../lib/health-validation');
const { upsertHealthRecords } = require('../lib/supabase');

const ENV_KEYS = [
  'APPLE_HEALTH_SYNC_TOKEN',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_KEY',
];

function invoke(method, body, headers = {}, url = '/') {
  return new Promise((resolve, reject) => {
    const request = { method, headers, body, url };
    const response = {
      headers: {},
      request,
      statusCode: 200,
      body: null,
      setHeader(name, value) {
        this.headers[name] = value;
      },
      end(value) {
        this.body = value ? JSON.parse(value) : null;
        resolve(this);
      },
    };

    Promise.resolve(handler(request, response)).catch(reject);
  });
}

describe('sanitizeMetadata', () => {
  test('extracts quantity values and recursively preserves JSON-safe metadata', () => {
    const circular = {};
    circular.self = circular;

    assert.deepEqual(sanitizeMetadata({
      empty: null,
      text: 'ok',
      count: 3,
      enabled: true,
      valueObject: { value: 1.5, units: 'kg' },
      qtyObject: { qty: 12.5, units: 'm' },
      quantityObject: { quantity: 7, units: 'count' },
      amountObject: { amount: 9, units: 'kcal' },
      nested: { source: 'watch', values: [1, { value: 2 }] },
      circular,
    }), {
      empty: null,
      text: 'ok',
      count: 3,
      enabled: true,
      valueObject: 1.5,
      qtyObject: 12.5,
      quantityObject: 7,
      amountObject: 9,
      nested: { source: 'watch', values: [1, 2] },
      circular: { self: '[Circular]' },
    });

    assert.deepEqual(sanitizeMetadata(null), {});
    assert.deepEqual(sanitizeMetadata('not metadata'), {});
    assert.deepEqual(sanitizeMetadata([]), {});
    assert.equal(
      sanitizeMetadata({ unsupported: new Date('2026-07-31T00:00:00Z') }).unsupported,
      String(new Date('2026-07-31T00:00:00Z'))
    );
  });
});

describe('api/sync-health', () => {
  let originalEnv;
  let originalFetch;
  let fetchCalls;

  beforeEach(() => {
    originalEnv = Object.fromEntries(
      ENV_KEYS.map((key) => [key, process.env[key]])
    );
    originalFetch = global.fetch;
    fetchCalls = [];

    process.env.APPLE_HEALTH_SYNC_TOKEN = 'test-sync-token';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    global.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify([{ id: 'saved-row' }]),
      };
    };
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }

    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  });

  test('sanitizes metadata again at the Supabase write boundary', async () => {
    await upsertHealthRecords([
      {
        external_id: 'write-boundary-test',
        metadata: {
          HKElevationAscended: { qty: 12.5, units: 'm' },
          nested: { value: 3 },
        },
      },
    ], true);

    assert.deepEqual(JSON.parse(fetchCalls[0].options.body), [
      {
        external_id: 'write-boundary-test',
        metadata: {
          HKElevationAscended: 12.5,
          nested: 3,
        },
      },
    ]);
  });

  test('handles OPTIONS preflight with the required CORS contract', async () => {
    const response = await invoke('OPTIONS', null);

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
    assert.equal(
      response.headers['Access-Control-Allow-Methods'],
      'GET, POST, PUT, PATCH, OPTIONS'
    );
    assert.equal(
      response.headers['Access-Control-Allow-Headers'],
      'Content-Type, Authorization, X-Health-Sync-Token'
    );
    assert.equal(response.body, null);
    assert.equal(fetchCalls.length, 0);
  });

  test('rejects missing, malformed, and invalid Bearer tokens with 401', async () => {
    const requests = [
      {},
      { authorization: 'test-sync-token' },
      { authorization: 'Basic test-sync-token' },
      { authorization: 'Bearer wrong-token' },
    ];

    for (const headers of requests) {
      const response = await invoke('POST', {}, headers);

      assert.equal(response.statusCode, 401);
      assert.deepEqual(response.body, { error: 'Unauthorized' });
      assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
    }

    assert.equal(fetchCalls.length, 0);
  });

  test('accepts the custom sync-token header for Health Auto Export clients', async () => {
    const response = await invoke(
      'POST',
      {
        external_id: 'custom-header-test',
        workout_date: '2026-07-31',
        workout_type: 'Custom Header Test',
        active_calories: 1,
        duration_minutes: 1,
      },
      { 'x-health-sync-token': 'test-sync-token' }
    );

    assert.equal(response.statusCode, 201);
    assert.equal(fetchCalls.length, 1);
  });

  test('maps Health Auto Export v2 workouts and persists sanitized metadata', async () => {
    const response = await invoke(
      'POST',
      {
        data: {
          workouts: [
            {
              start: '2026-07-31T08:15:00Z',
              name: 'Traditional Strength Training',
              activeEnergy: { qty: 420 },
              avgHeartRate: { qty: 138 },
              duration: { qty: 52 },
              id: 'apple-workout-123',
              HKElevationAscended: { qty: 12.5, units: 'm' },
              metadata: { source: 'watch', nested: { valid: true } },
            },
          ],
        },
      },
      { authorization: 'Bearer test-sync-token' }
    );

    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.body, {
      ok: true,
      records: [{ id: 'saved-row' }],
    });
    assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
    assert.equal(fetchCalls.length, 1);

    const { url, options } = fetchCalls[0];
    assert.equal(
      url,
      'https://example.supabase.co/rest/v1/apple_health_logs?on_conflict=external_id'
    );
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.apikey, 'service-role-key');
    assert.equal(
      options.headers.Authorization,
      'Bearer service-role-key'
    );
    assert.equal(
      options.headers.Prefer,
      'return=representation,resolution=merge-duplicates'
    );
    assert.deepEqual(JSON.parse(options.body), [
      {
        user_id: null,
        external_id: 'apple-workout-123',
        workout_date: '2026-07-31',
        workout_type: 'Traditional Strength Training',
        active_calories: 420,
        avg_heart_rate: 138,
        duration_minutes: 52,
        source: 'apple_health',
        metadata: {
          start: '2026-07-31T08:15:00Z',
          name: 'Traditional Strength Training',
          activeEnergy: 420,
          avgHeartRate: 138,
          duration: 52,
          id: 'apple-workout-123',
          HKElevationAscended: 12.5,
          metadata: { source: 'watch', nested: { valid: true } },
        },
      },
    ]);
  });

  test('supports v2 field fallbacks and defaults invalid dates to today', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await invoke(
      'POST',
      {
        data: {
          workouts: [
            {
              start: 'not-a-date',
              startDate: 'also-not-a-date',
              workoutActivityType: 'Cycling',
              activeEnergy: 125,
              heartRate: { avg: 144 },
              duration: { qty: 30 },
              uuid: 'fallback-workout-123',
            },
          ],
        },
      },
      { authorization: 'Bearer test-sync-token' }
    );

    assert.equal(response.statusCode, 201);
    const mapped = JSON.parse(fetchCalls[0].options.body)[0];

    assert.deepEqual(mapped, {
      user_id: null,
      external_id: 'fallback-workout-123',
      workout_date: today,
      workout_type: 'Cycling',
      active_calories: 125,
      avg_heart_rate: 144,
      duration_minutes: 30,
      source: 'apple_health',
      metadata: {
        start: 'not-a-date',
        startDate: 'also-not-a-date',
        workoutActivityType: 'Cycling',
        activeEnergy: 125,
        heartRate: { avg: 144 },
        duration: 30,
        uuid: 'fallback-workout-123',
      },
    });
  });

  test('preserves literal prototype keys in sanitized metadata', async () => {
    const response = await invoke(
      'POST',
      {
        external_id: 'prototype-key-test',
        workout_date: '2026-07-31',
        workout_type: 'Metadata Test',
        active_calories: 1,
        duration_minutes: 1,
        metadata: JSON.parse('{"__proto__":{"safe":true},"normal":{"value":1}}'),
      },
      { authorization: 'Bearer test-sync-token' }
    );

    assert.equal(response.statusCode, 201);
    const saved = JSON.parse(fetchCalls[0].options.body);
    assert.deepEqual(
      saved.metadata,
      JSON.parse('{"__proto__":{"safe":true},"normal":1}')
    );
    assert.equal(Object.getPrototypeOf(saved.metadata), Object.prototype);
  });

  test('preserves support for flat JSON payloads', async () => {
    const response = await invoke(
      'POST',
      {
        user_id: 'manual-user',
        external_id: 'manual-workout-123',
        workout_date: '2026-07-31',
        workout_type: 'Manual Workout',
        active_calories: 250,
        avg_heart_rate: null,
        duration_minutes: 45,
        source: 'manual-test',
      },
      { authorization: 'Bearer test-sync-token' }
    );

    assert.equal(response.statusCode, 201);
    assert.deepEqual(JSON.parse(fetchCalls[0].options.body), {
      user_id: 'manual-user',
      external_id: 'manual-workout-123',
      workout_date: '2026-07-31',
      workout_type: 'Manual Workout',
      active_calories: 250,
      avg_heart_rate: null,
      duration_minutes: 45,
      source: 'manual-test',
      metadata: {},
    });
  });

  test('routes PUT and PATCH through the validated upsert path without redirecting', async () => {
    const payload = {
      user_id: null,
      external_id: 'method-compatibility-test',
      workout_date: '2026-07-31',
      workout_type: 'Method Compatibility Test',
      active_calories: 10,
      avg_heart_rate: null,
      duration_minutes: 5,
      source: 'manual-test',
    };

    for (const method of ['PUT', 'PATCH']) {
      const response = await invoke(
        method,
        payload,
        { authorization: 'Bearer test-sync-token' },
        '/api/sync-health///?source=automated-test'
      );

      assert.equal(response.statusCode, 201);
      assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
      assert.equal(
        response.headers['Access-Control-Allow-Methods'],
        'GET, POST, PUT, PATCH, OPTIONS'
      );
      assert.equal(response.request.url, '/api/sync-health?source=automated-test');
      assert.deepEqual(JSON.parse(fetchCalls.at(-1).options.body), {
        ...payload,
        metadata: {},
      });
    }

    assert.equal(fetchCalls.length, 2);
  });

  test('writes batches in chunks while preserving sanitized HAE workout metadata', async () => {
    const workouts = Array.from({ length: 51 }, (_, index) => ({
      id: `batch-workout-${index}`,
      start: '2026-07-31T08:15:00Z',
      workoutActivityType: 'Cycling',
      activeEnergy: { qty: index + 1, units: 'kcal' },
      duration: { qty: 30, units: 'min' },
      HKElevationAscended: { qty: index, units: 'm' },
    }));

    const response = await invoke(
      'POST',
      workouts,
      { authorization: 'Bearer test-sync-token' }
    );

    assert.equal(response.statusCode, 201);
    assert.equal(fetchCalls.length, 2);
    assert.equal(JSON.parse(fetchCalls[0].options.body).length, 50);
    assert.equal(JSON.parse(fetchCalls[1].options.body).length, 1);
    assert.equal(JSON.parse(fetchCalls[1].options.body)[0].metadata.HKElevationAscended, 50);
  });

  test('reads authenticated records for a requested date', async () => {
    const response = await invoke(
      'GET',
      null,
      { authorization: 'Bearer test-sync-token' },
      '/api/sync-health?date=2026-07-31'
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      ok: true,
      records: [{ id: 'saved-row' }],
    });
    assert.equal(fetchCalls.length, 1);
    assert.equal(
      fetchCalls[0].url,
      'https://example.supabase.co/rest/v1/apple_health_logs?workout_date=eq.2026-07-31&order=created_at.desc&limit=20'
    );
    assert.equal(fetchCalls[0].options.headers.apikey, 'service-role-key');
    assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
  });

  test('returns 405 with an Allow header for unsupported methods', async () => {
    const response = await invoke('DELETE', null);

    assert.equal(response.statusCode, 405);
    assert.deepEqual(response.body, { error: 'Method not allowed' });
    assert.equal(response.headers.Allow, 'GET, POST, PUT, PATCH, OPTIONS');
    assert.equal(
      response.headers['Access-Control-Allow-Methods'],
      'GET, POST, PUT, PATCH, OPTIONS'
    );
    assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
    assert.equal(fetchCalls.length, 0);
  });

  test('returns a generic error when Supabase rejects a write', async () => {
    global.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ code: 'PGRST204', hint: 'metadata column missing' }),
      };
    };

    const response = await invoke(
      'POST',
      {
        external_id: 'database-error-test',
        workout_date: '2026-07-31',
        workout_type: 'Database Error Test',
        active_calories: 1,
        duration_minutes: 1,
      },
      { authorization: 'Bearer test-sync-token' }
    );

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
      error: 'Database operation failed',
      status: 400,
    });
  });

  test('does not use the public anon key for server-side database access', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_KEY = 'anon-fallback-key';

    const response = await invoke(
      'POST',
      {
        external_id: 'fallback-upsert-123',
        workout_date: '2026-07-31',
        workout_type: 'Fallback Test',
        active_calories: 1,
        duration_minutes: 2,
      },
      { authorization: 'Bearer test-sync-token' }
    );

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      error: 'Server database configuration is incomplete: missing Supabase credentials',
    });
    assert.equal(fetchCalls.length, 0);
  });
});
