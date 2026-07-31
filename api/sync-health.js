'use strict';

const crypto = require('crypto');

const ALLOWED_ORIGIN = '*';
const MAX_BODY_BYTES = 64 * 1024;
const MISSING_DATABASE_CONFIG_ERROR = 'Server database configuration is incomplete: missing Supabase credentials';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Health-Sync-Token',
  };
}

function sendJson(res, status, body) {
  Object.entries(corsHeaders()).forEach(([name, value]) => res.setHeader(name, value));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function sendEmpty(res, status) {
  Object.entries(corsHeaders()).forEach(([name, value]) => res.setHeader(name, value));
  res.statusCode = status;
  res.end();
}

function tokensMatch(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string') return false;
  const normalizedReceived = received.trim();
  const normalizedExpected = expected.trim();
  if (!normalizedReceived || !normalizedExpected) return false;
  try {
    const a = Buffer.from(normalizedReceived);
    const b = Buffer.from(normalizedExpected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (error) {
    return normalizedReceived === normalizedExpected;
  }
}

function suppliedToken(req) {
  const authorization = req.headers && req.headers.authorization;
  if (typeof authorization !== 'string' || !/^Bearer\s+/i.test(authorization)) return '';
  return authorization.replace(/^Bearer\s+/i, '').trim();
}

function cleanText(value, field, maxLength, required) {
  if (value == null || value === '') {
    if (required) throw new Error(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw new Error(`${field} must be text`);
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error(`${field} is required`);
  if (cleaned.length > maxLength) throw new Error(`${field} is too long`);
  return cleaned || null;
}

function cleanNumber(value, field, min, max, required) {
  if (value == null || value === '') {
    if (required) throw new Error(`${field} is required`);
    return null;
  }
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${field} must be a number between ${min} and ${max}`);
  }
  return Math.round(number * 100) / 100;
}

function cleanDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('workout_date must use YYYY-MM-DD');
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('workout_date is not a valid calendar date');
  }
  return value;
}

function validatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('JSON object body is required');
  }
  return {
    user_id: cleanText(body.user_id, 'user_id', 128, false),
    external_id: cleanText(body.external_id, 'external_id', 180, false),
    workout_date: cleanDate(body.workout_date),
    workout_type: cleanText(body.workout_type, 'workout_type', 120, true),
    active_calories: cleanNumber(body.active_calories, 'active_calories', 0, 10000, true),
    avg_heart_rate: cleanNumber(body.avg_heart_rate, 'avg_heart_rate', 0, 300, false),
    duration_minutes: cleanNumber(body.duration_minutes, 'duration_minutes', 0, 1440, true),
    source: cleanText(body.source, 'source', 80, false) || 'apple_health',
  };
}

function numericValue(value) {
  if (value && typeof value === 'object') return value.qty ?? value.value ?? null;
  return value;
}

function optionalNumber(value, fallback) {
  const number = Number(numericValue(value));
  return Number.isFinite(number) ? number : fallback;
}

function firstText(...values) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function workoutDate(value) {
  if (value == null || value === '') return null;
  const text = String(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  if (match) {
    const candidate = match[0];
    const parsedCandidate = new Date(`${candidate}T00:00:00Z`);
    return Number.isNaN(parsedCandidate.getTime())
      || parsedCandidate.toISOString().slice(0, 10) !== candidate
      ? null
      : candidate;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function validateHealthExportWorkout(workout) {
  if (!workout || typeof workout !== 'object' || Array.isArray(workout)) {
    throw new Error('Each data.workouts item must be an object');
  }

  const duration = optionalNumber(workout.duration?.qty, 0);
  const date = workoutDate(workout.start)
    || workoutDate(workout.startDate)
    || new Date().toISOString().slice(0, 10);
  return validatePayload({
    user_id: workout.user_id ?? null,
    external_id: firstText(workout.id, workout.uuid),
    workout_date: date,
    workout_type: firstText(workout.name, workout.workoutActivityType) || 'Workout',
    active_calories: optionalNumber(workout.activeEnergy?.qty ?? workout.activeEnergy, 0),
    avg_heart_rate: optionalNumber(workout.avgHeartRate?.qty ?? workout.heartRate?.avg, null),
    duration_minutes: duration,
    source: 'apple_health',
  });
}

function validateRequestPayload(body) {
  if (body && typeof body === 'object' && Array.isArray(body.data?.workouts)) {
    if (body.data.workouts.length === 0) {
      throw new Error('data.workouts must contain at least one workout');
    }
    return {
      nested: true,
      payloads: body.data.workouts.map(validateHealthExportWorkout),
    };
  }
  return { nested: false, payloads: [validatePayload(body)] };
}

function databaseConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim().replace(/\/+$/, '') : '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error(MISSING_DATABASE_CONFIG_ERROR);
  try {
    const parsedUrl = new URL(supabaseUrl);
    if (!parsedUrl.hostname || parsedUrl.protocol !== 'https:') throw new Error('Invalid Supabase URL');
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
  if (typeof response.json === 'function') return response.json().catch(() => null);
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
  const endpoint = `${supabaseUrl}/rest/v1/apple_health_logs?workout_date=eq.${encodeURIComponent(date)}&order=created_at.desc&limit=20`;
  return supabaseFetch(endpoint, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
}

function sendDatabaseError(res, error) {
  const upstreamStatus = Number.isInteger(error && error.statusCode) ? error.statusCode : 502;
  const details = error && error.details !== undefined ? error.details : (error && error.message) || 'Unknown database error';
  return sendJson(res, upstreamStatus, {
    error: 'Database operation failed',
    status: upstreamStatus,
    details,
  });
}

function readBody(req) {
  const contentLength = Number(req.headers && req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return Promise.reject(Object.assign(new Error('Payload is too large'), { statusCode: 413 }));
  }

  if (req.body != null) {
    const rawBody = typeof req.body === 'string' || Buffer.isBuffer(req.body)
      ? req.body
      : JSON.stringify(req.body);
    if (Buffer.byteLength(rawBody || '') > MAX_BODY_BYTES) {
      return Promise.reject(Object.assign(new Error('Payload is too large'), { statusCode: 413 }));
    }
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    try {
      return Promise.resolve(JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body));
    } catch (error) {
      return Promise.reject(new Error('Invalid JSON payload'));
    }
  }

  return new Promise((resolve, reject) => {
    let size = 0;
    let rejected = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (rejected) return;
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        reject(Object.assign(new Error('Payload is too large'), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', (error) => {
      if (!rejected) reject(error);
    });
    req.on('end', () => {
      if (rejected) return;
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : null);
      } catch (error) {
        reject(new Error('Invalid JSON payload'));
      }
    });
  });
}

async function handleGet(req, res) {
  const expectedToken = process.env.APPLE_HEALTH_SYNC_TOKEN;
  if (!expectedToken || !tokensMatch(suppliedToken(req), expectedToken)) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  try {
    const { searchParams } = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
    const date = cleanDate(searchParams.get('date'));
    const records = await readTodayRecords(date);
    return sendJson(res, 200, { ok: true, records: Array.isArray(records) ? records : [] });
  } catch (error) {
    console.error('Apple Health read request failed:', error);
    const isBadDate = error.message === 'workout_date must use YYYY-MM-DD'
      || error.message === 'workout_date is not a valid calendar date';
    if (error.message === MISSING_DATABASE_CONFIG_ERROR) {
      return sendJson(res, 500, { error: error.message });
    }
    if (isBadDate) return sendJson(res, 400, { error: error.message });
    return sendDatabaseError(res, error);
  }
}

async function handlePost(req, res) {
  const expectedToken = process.env.APPLE_HEALTH_SYNC_TOKEN;
  if (!expectedToken || !tokensMatch(suppliedToken(req), expectedToken)) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  let requestPayload;
  try {
    requestPayload = validateRequestPayload(await readBody(req));
    databaseConfig();
  } catch (error) {
    const status = error.statusCode || (error.message === MISSING_DATABASE_CONFIG_ERROR ? 500 : 400);
    return sendJson(res, status, { error: error.message });
  }

  try {
    const { supabaseUrl, serviceKey } = databaseConfig();
    const { nested, payloads } = requestPayload;
    const endpoint = `${supabaseUrl}/rest/v1/apple_health_logs?on_conflict=external_id`;
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

    if (nested) {
      return sendJson(res, 201, { ok: true, records: Array.isArray(result) ? result : [result] });
    }
    return sendJson(res, 201, { ok: true, record: Array.isArray(result) ? result[0] : result });
  } catch (error) {
    console.error('Apple Health sync request failed:', error);
    return sendDatabaseError(res, error);
  }
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res, 200);
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return sendJson(res, 405, { error: 'Method not allowed' });
}

module.exports = handler;
