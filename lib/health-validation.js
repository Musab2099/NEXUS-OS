'use strict';

const crypto = require('crypto');

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

  const number = typeof value === 'number'
    ? value
    : Number(String(value).trim());

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
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
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

function validateHealthExportWorkout(workout) {
  if (!workout || typeof workout !== 'object' || Array.isArray(workout)) {
    throw new Error('Each data.workouts item must be an object');
  }

  const date = workoutDate(workout.start)
    || workoutDate(workout.startDate)
    || new Date().toISOString().slice(0, 10);

  return validatePayload({
    user_id: workout.user_id ?? null,
    external_id: firstText(workout.id, workout.uuid),
    workout_date: date,
    workout_type: firstText(workout.name, workout.workoutActivityType) || 'Workout',
    active_calories: optionalNumber(
      workout.activeEnergy?.qty ?? workout.activeEnergy,
      0
    ),
    avg_heart_rate: optionalNumber(
      workout.avgHeartRate?.qty ?? workout.heartRate?.avg,
      null
    ),
    duration_minutes: optionalNumber(workout.duration?.qty, 0),
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

  return {
    nested: false,
    payloads: [validatePayload(body)],
  };
}

module.exports = {
  cleanDate,
  suppliedToken,
  tokensMatch,
  validateRequestPayload,
};
