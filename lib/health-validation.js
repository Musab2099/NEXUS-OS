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
  const headers = req && req.headers ? req.headers : {};
  const authorization = headers.authorization;
  if (typeof authorization === 'string' && /^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, '').trim();
  }

  const headerToken = headers['x-health-sync-token'] || headers['X-Health-Sync-Token'];
  return typeof headerToken === 'string' ? headerToken.trim() : '';
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
  if (value && typeof value === 'object') {
    return value.qty ?? value.value ?? value.quantity ?? value.amount ?? null;
  }
  return value;
}

function optionalNumber(value, fallback) {
  const number = Number(numericValue(value));
  return Number.isFinite(number) ? number : fallback;
}

function firstText(...values) {
  for (const value of values) {
    if (value == null) continue;

    if (typeof value === 'object') {
      const nested = value.name ?? value.value ?? value.label;
      if (nested == null) continue;
      const nestedText = String(nested).trim();
      if (nestedText) return nestedText;
      continue;
    }

    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

// Health Auto Export metadata can contain quantity-shaped objects rather than
// primitives. Extract their scalar value when available, while preserving
// ordinary nested metadata and ensuring every leaf is JSON-safe for jsonb.
function sanitizeMetadataValue(value, seen, extractQuantity = true) {
  if (value == null) return null;

  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return String(value);

  if (typeof value !== 'object') return String(value);

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
    return String(value);
  }

  const visited = seen || new WeakSet();
  if (visited.has(value)) return '[Circular]';
  visited.add(value);

  if (Array.isArray(value)) {
    const result = value.map((item) => sanitizeMetadataValue(item, visited));
    visited.delete(value);
    return result;
  }

  // HealthKit/Health Auto Export quantities commonly use qty, while other
  // custom health types use value, quantity, or amount. Prefer the explicit
  // value field, then support the known quantity aliases.
  const scalarKey = extractQuantity && ['value', 'qty', 'quantity', 'amount'].find((key) => (
    Object.prototype.hasOwnProperty.call(value, key)
  ));
  if (scalarKey) {
    const result = sanitizeMetadataValue(value[scalarKey], visited);
    visited.delete(value);
    return result;
  }

  const result = {};
  Object.entries(value).forEach(([key, item]) => {
    // defineProperty preserves literal keys such as __proto__ without
    // invoking Object.prototype's legacy setter.
    Object.defineProperty(result, String(key), {
      configurable: true,
      enumerable: true,
      value: sanitizeMetadataValue(item, visited),
      writable: true,
    });
  });
  visited.delete(value);
  return result;
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(metadata);
  if (prototype !== Object.prototype && prototype !== null) return {};

  return sanitizeMetadataValue(metadata, undefined, false) || {};
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
    metadata: sanitizeMetadata(body.metadata === undefined ? null : body.metadata),
  };
}

function exportMetadata(body, hasNestedData) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};

  const envelope = {};
  Object.entries(body).forEach(([key, value]) => {
    if (hasNestedData && key === 'data') return;
    if (!hasNestedData && key === 'workouts') return;
    Object.defineProperty(envelope, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  });

  if (hasNestedData && body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    const dataEnvelope = {};
    Object.entries(body.data).forEach(([key, value]) => {
      if (key === 'workouts') return;
      Object.defineProperty(dataEnvelope, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
    });
    if (Object.keys(dataEnvelope).length) envelope.data = dataEnvelope;
  }

  return sanitizeMetadata(envelope) || {};
}

function workoutMetadata(workout, envelope) {
  const metadata = sanitizeMetadata(workout) || {};
  if (Object.keys(envelope).length) {
    Object.defineProperty(metadata, '_export', {
      configurable: true,
      enumerable: true,
      value: envelope,
      writable: true,
    });
  }
  return metadata;
}

function validateHealthExportWorkout(workout, envelope) {
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
    active_calories: optionalNumber(workout.activeEnergy, 0),
    avg_heart_rate: optionalNumber(
      workout.avgHeartRate ?? workout.heartRate?.avg,
      null
    ),
    duration_minutes: optionalNumber(workout.duration, 0),
    source: 'apple_health',
    metadata: workoutMetadata(workout, envelope || {}),
  });
}

const MAX_RECORDS = 500;

function isHealthExportWorkout(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && (
    value.start != null
    || value.startDate != null
    || value.workoutActivityType != null
    || value.activeEnergy != null
    || value.duration != null
  );
}

function validateRequestPayload(body) {
  if (Array.isArray(body)) {
    if (body.length === 0) throw new Error('JSON array must contain at least one payload');
    if (body.length > MAX_RECORDS) throw new Error(`A maximum of ${MAX_RECORDS} records is allowed`);
    const envelope = exportMetadata(body, false);
    return {
      nested: true,
      payloads: body.map((item) => (
        isHealthExportWorkout(item)
          ? validateHealthExportWorkout(item, envelope)
          : validatePayload(item)
      )),
    };
  }

  const hasNestedData = Boolean(body && typeof body === 'object' && Array.isArray(body.data?.workouts));
  const workouts = body && typeof body === 'object'
    ? (hasNestedData
      ? body.data.workouts
      : (Array.isArray(body.workouts) ? body.workouts : null))
    : null;

  if (workouts) {
    if (workouts.length === 0) {
      throw new Error('workouts must contain at least one workout');
    }
    if (workouts.length > MAX_RECORDS) {
      throw new Error(`A maximum of ${MAX_RECORDS} workouts is allowed`);
    }

    const envelope = exportMetadata(body, hasNestedData);
    return {
      nested: true,
      payloads: workouts.map((workout) => validateHealthExportWorkout(workout, envelope)),
    };
  }

  return {
    nested: false,
    payloads: [validatePayload(body)],
  };
}

module.exports = {
  cleanDate,
  MAX_RECORDS,
  sanitizeMetadata,
  suppliedToken,
  tokensMatch,
  validateRequestPayload,
};
