'use strict';

const MISSING_DATABASE_CONFIG_ERROR =
  'Server database configuration is incomplete: missing Supabase credentials';

function databaseConfig() {
  const rawUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseUrl = typeof rawUrl === 'string'
    ? rawUrl.trim().replace(/\/+$/, '')
    : '';

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;

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
  try {
    const response = await fetch(endpoint, options);
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
    if (!error || error.statusCode == null) {
      console.error('Supabase fetch failed:', error);
    }

    throw error;
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

  const result = await supabaseFetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(nested ? payloads : payloads[0]),
  });

  return {
    result,
    record: Array.isArray(result) ? result[0] : result,
    records: Array.isArray(result) ? result : [result],
  };
}

module.exports = {
  MISSING_DATABASE_CONFIG_ERROR,
  databaseConfig,
  readTodayRecords,
  supabaseFetch,
  upsertHealthRecords,
};
