'use strict';

const assert = require('node:assert/strict');
const { afterEach, beforeEach, describe, test } = require('node:test');

const handler = require('../api/sync-health');

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
      { 'x-health-sync-token': 'test-sync-token' },
    ];

    for (const headers of requests) {
      const response = await invoke('POST', {}, headers);

      assert.equal(response.statusCode, 401);
      assert.deepEqual(response.body, { error: 'Unauthorized' });
      assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
    }

    assert.equal(fetchCalls.length, 0);
  });

  test('maps Health Auto Export v2 workouts and persists them as an array', async () => {
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
    });
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
      assert.deepEqual(JSON.parse(fetchCalls.at(-1).options.body), payload);
    }

    assert.equal(fetchCalls.length, 2);
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

  test('uses Supabase environment fallbacks for an upsert', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fallback.supabase.co';
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

    assert.equal(response.statusCode, 201);
    assert.equal(fetchCalls.length, 1);
    assert.equal(
      fetchCalls[0].url,
      'https://fallback.supabase.co/rest/v1/apple_health_logs?on_conflict=external_id'
    );
    assert.equal(fetchCalls[0].options.headers.apikey, 'anon-fallback-key');
    assert.equal(
      fetchCalls[0].options.headers.Authorization,
      'Bearer anon-fallback-key'
    );
  });
});
