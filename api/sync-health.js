import { NextResponse } from 'next/server';

const ALLOWED_ORIGIN = '*';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Health-Sync-Token',
  };
}

function tokensMatch(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string' || !received || !expected) return false;
  try {
    const crypto = require('crypto');
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return received === expected;
  }
}

function suppliedToken(request) {
  const authorization = request.headers.get('authorization');
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  return request.headers.get('x-health-sync-token') || '';
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
  // If no date provided, default to today (YYYY-MM-DD)
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('workout_date must use YYYY-MM-DD');
  }
  const parsed = new Date(value + 'T00:00:00Z');
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
    workout_date: cleanDate(body.workout_date), // Auto-defaults to today if omitted
    workout_type: cleanText(body.workout_type, 'workout_type', 120, true),
    active_calories: cleanNumber(body.active_calories, 'active_calories', 0, 10000, true),
    avg_heart_rate: cleanNumber(body.avg_heart_rate, 'avg_heart_rate', 0, 300, false),
    duration_minutes: cleanNumber(body.duration_minutes, 'duration_minutes', 0, 1440, true),
    source: cleanText(body.source, 'source', 80, false) || 'apple_health', // Auto-defaults to 'apple_health'
  };
}

async function readTodayRecords(date) {
  const endpoint = `${process.env.SUPABASE_URL}/rest/v1/apple_health_logs?workout_date=eq.${encodeURIComponent(date)}&order=created_at.desc&limit=20`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error('Database read failed');
  return result;
}

// CORS Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// GET Handler
export async function GET(request) {
  const expectedToken = process.env.APPLE_HEALTH_SYNC_TOKEN;
  if (!expectedToken || !tokensMatch(suppliedToken(request), expectedToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server database configuration is incomplete' }, { status: 500, headers: corsHeaders() });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const date = cleanDate(dateParam);
    const records = await readTodayRecords(date);
    return NextResponse.json({ ok: true, records: Array.isArray(records) ? records : [] }, { status: 200, headers: corsHeaders() });
  } catch (error) {
    console.error('Apple Health read request failed:', error);
    return NextResponse.json({ error: 'Database request failed' }, { status: 502, headers: corsHeaders() });
  }
}

// POST Handler
export async function POST(request) {
  const expectedToken = process.env.APPLE_HEALTH_SYNC_TOKEN;
  if (!expectedToken || !tokensMatch(suppliedToken(request), expectedToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server database configuration is incomplete' }, { status: 500, headers: corsHeaders() });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400, headers: corsHeaders() });
  }

  let payload;
  try {
    payload = validatePayload(body);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });
  }

  try {
    const endpoint = `${process.env.SUPABASE_URL}/rest/v1/apple_health_logs${payload.external_id ? '?on_conflict=external_id' : ''}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: payload.external_id ? 'return=representation,resolution=merge-duplicates' : 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('Supabase Apple Health insert failed:', response.status, result);
      return NextResponse.json({ error: 'Database insert failed' }, { status: 502, headers: corsHeaders() });
    }

    return NextResponse.json({ ok: true, record: Array.isArray(result) ? result[0] : result }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Apple Health sync request failed:', error);
    return NextResponse.json({ error: 'Database request failed' }, { status: 502, headers: corsHeaders() });
  }
}