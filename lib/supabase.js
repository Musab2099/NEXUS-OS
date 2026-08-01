'use strict';

const MISSING_DATABASE_CONFIG_ERROR =
  'Server database configuration is incomplete: missing Supabase credentials';
const UPSERT_BATCH_SIZE = 50;
const MAX_CONCURRENT_BATCHES = 3;
const SUPABASE_TIMEOUT_MS = 10000;

function databaseConfig() {
  const rawUrl = process.env.SUPABASE_URL;
  const supabaseUrl = typeof rawUrl === 'string'
    ? rawUrl.trim().replace(/\/+$/, '')
    : '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(MISSING_DATABASE_CONFIG_ERROR);
  }

  try {
    const parsedUrl = new URL(supabaseUrl);
    if (!parsedUrl.hostname || parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid Supabase URL');
    }
  } catch (error) {
    throw new Error(MISSING_DATABASE_CONFIG_ERROR);
  }

  return { supabaseUrl, serviceKey };
}

async function responsePayload(response) {
  if (typeof response.text === 'function') {
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  }

  if (typeof response.json === 'function') {
    return response.json().catch(() => null);
  }

  return null;
}

async function supabaseFetch(endpoint, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      ...options,
      signal: controller.signal,
    });
    const result = await responsePayload(response);

    if (!response.ok) {
      console.error('Supabase request failed:', response.status, result);

      const error = new Error('Database operation failed');
      error.statusCode = response.status;
      error.details = result;
      throw error;
    }

    return result;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      const timeoutError = new Error('Database operation timed out');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    if (!error || error.statusCode == null) {
      console.error('Supabase fetch failed:', error);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readTodayRecords(date) {
  const { supabaseUrl, serviceKey } = databaseConfig();
  const endpoint =
    `${supabaseUrl}/rest/v1/apple_health_logs` +
    `?workout_date=eq.${encodeURIComponent(date)}` +
    '&order=created_at.desc&limit=20';

  return supabaseFetch(endpoint, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
}

async function upsertHealthRecords(payloads, nested) {
  const { supabaseUrl, serviceKey } = databaseConfig();
  const endpoint =
    `${supabaseUrl}/rest/v1/apple_health_logs` +
    '?on_conflict=external_id';
  const rows = Array.isArray(payloads) ? payloads : [payloads];
  const batches = [];

  for (let start = 0; start < rows.length; start += UPSERT_BATCH_SIZE) {
    batches.push(rows.slice(start, start + UPSERT_BATCH_SIZE));
  }

  const results = [];
  for (let start = 0; start < batches.length; start += MAX_CONCURRENT_BATCHES) {
    const group = batches.slice(start, start + MAX_CONCURRENT_BATCHES);
    const groupResults = await Promise.all(group.map((batch) => supabaseFetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation,resolution=merge-duplicates',
      },
      body: JSON.stringify(!nested && rows.length === 1 ? rows[0] : batch),
    })));
    results.push(...groupResults);
  }

  const records = results.flatMap((result) => (
    Array.isArray(result) ? result : (result == null ? [] : [result])
  ));

  return {
    result: records,
    record: records[0] || null,
    records,
  };
}

module.exports = {
  MISSING_DATABASE_CONFIG_ERROR,
  MAX_CONCURRENT_BATCHES,
  SUPABASE_TIMEOUT_MS,
  UPSERT_BATCH_SIZE,
  databaseConfig,
  readTodayRecords,
  supabaseFetch,
  upsertHealthRecords,
};
