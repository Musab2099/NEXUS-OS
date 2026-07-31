'use strict';

const ALLOWED_ORIGIN = '*';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Health-Sync-Token',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function reply(res, status, body) {
  Object.entries(corsHeaders()).forEach(([key, value]) => res.setHeader(key, value));
  return res.status(status).json(body);
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  return null;
}

function header(req, name) {
  const value = req.headers && (req.headers[name] || req.headers[name.toLowerCase()]);
  return Array.isArray(value) ? value[0] : value;
}

function suppliedToken(req) {
  const authorization = header(req, 'authorization');
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  return header(req, 'x-health-sync-token') || '';
}

function tokensMatch(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string' || !received || !expected) return false;
  // Keep the comparison constant-time when the runtime provides Node's crypto.
  try {
    const crypto = require('crypto');
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return received === expected;
  }
}

function cleanText(value, field, maxLength, required) {
  if (value == null || value === '') {
    if (required) throw new Error(field + ' is required');
    return null;
  }
  if (typeof value !== 'string') throw new Error(field + ' must be text');
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error(field + ' is required');
  if (cleaned.length > maxLength) throw new Error(field + ' is too long');
  return cleaned || null;
}

function cleanNumber(value, field, min, max, required) {
  if (value == null || value === '') {
    if (required) throw new Error(field + ' is required');
    return null;
  }
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(field + ' must be a number between ' + min + ' and ' + max);
  }
  return Math.round(number * 100) / 100;
}

function cleanDate(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('workout_date must use YYYY-MM-DD');
  }
  const parsed = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('workout_date is not a valid calendar date');
  }
  return value;
}

function requestedDate(req) {
  const raw = req.query && req.query.date;
  return raw ? cleanDate(raw) : new Date().toISOString().slice(0, 10);
}

async function readTodayRecords(req) {
  const date = requestedDate(req);
  const endpoint = process.env.SUPABASE_URL + '/rest/v1/apple_health_logs' +
    '?workout_date=eq.' + encodeURIComponent(date) +
    '&order=created_at.desc&limit=20';
  const response = await fetch(endpoint, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error('Database read failed');
  return result;
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

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return reply(res, 204, {});
  if (req.method !== 'GET' && req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });

  const expectedToken = process.env.APPLE_HEALTH_SYNC_TOKEN;
  if (!expectedToken || !tokensMatch(suppliedToken(req), expectedToken)) {
    return reply(res, 401, { error: 'Unauthorized' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return reply(res, 500, { error: 'Server database configuration is incomplete' });
  }

  if (req.method === 'GET') {
    // NEXUS currently has no login/session identity. This read is intentionally
    // limited to the requested local date; add auth before making the app multi-user.
    try {
      const records = await readTodayRecords(req);
      return reply(res, 200, { ok: true, records: Array.isArray(records) ? records : [] });
    } catch (error) {
      console.error('Apple Health read request failed:', error);
      return reply(res, 502, { error: 'Database request failed' });
    }
  }

  const contentType = header(req, 'content-type');
  if (contentType && !contentType.toLowerCase().startsWith('application/json')) {
    return reply(res, 415, { error: 'Content-Type must be application/json' });
  }

  const body = readBody(req);
  let payload;
  try {
    payload = validatePayload(body);
    if (!payload.workout_date) throw new Error('workout_date is required');
    if (payload.source !== 'apple_health') throw new Error('source must be apple_health');
  } catch (error) {
    return reply(res, 400, { error: error.message });
  }

  try {
    const endpoint = process.env.SUPABASE_URL + '/rest/v1/apple_health_logs' +
      (payload.external_id ? '?on_conflict=external_id' : '');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        Prefer: payload.external_id ? 'return=representation,resolution=merge-duplicates' : 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('Supabase Apple Health insert failed:', response.status, result);
      return reply(res, 502, { error: 'Database insert failed' });
    }

    return reply(res, 201, { ok: true, record: Array.isArray(result) ? result[0] : result });
  } catch (error) {
    console.error('Apple Health sync request failed:', error);
    return reply(res, 502, { error: 'Database request failed' });
  }
};
