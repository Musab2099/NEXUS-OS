'use strict';

const {
  cleanDate,
  suppliedToken,
  tokensMatch,
  validateRequestPayload,
} = require('../lib/health-validation');
const {
  MISSING_DATABASE_CONFIG_ERROR,
  databaseConfig,
  readTodayRecords,
  upsertHealthRecords,
} = require('../lib/supabase');

const MAX_BODY_BYTES = 64 * 1024;
const ALLOWED_ORIGIN = '*';
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, OPTIONS';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Health-Sync-Token',
  };
}

function normalizeRequestUrl(url) {
  if (typeof url !== 'string' || !url) return url;

  const queryIndex = url.indexOf('?');
  const path = queryIndex === -1 ? url : url.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : url.slice(queryIndex);
  let normalizedPath = path;
  while (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }

  return normalizedPath + query;
}

function sendJson(res, status, body) {
  Object.entries(corsHeaders()).forEach(([name, value]) => {
    res.setHeader(name, value);
  });

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function sendEmpty(res, status) {
  Object.entries(corsHeaders()).forEach(([name, value]) => {
    res.setHeader(name, value);
  });

  res.statusCode = status;
  res.end();
}

function sendDatabaseError(res, error) {
  const upstreamStatus = Number.isInteger(error && error.statusCode)
    ? error.statusCode
    : 502;

  const details = error && error.details !== undefined
    ? error.details
    : (error && error.message) || 'Unknown database error';

  return sendJson(res, upstreamStatus, {
    error: 'Database operation failed',
    status: upstreamStatus,
    details,
  });
}

function readBody(req) {
  const contentLength = Number(
    req.headers && req.headers['content-length']
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    return Promise.reject(
      Object.assign(new Error('Payload is too large'), {
        statusCode: 413,
      })
    );
  }

  if (req.body != null) {
    const rawBody =
      typeof req.body === 'string' || Buffer.isBuffer(req.body)
        ? req.body
        : JSON.stringify(req.body);

    if (Buffer.byteLength(rawBody || '') > MAX_BODY_BYTES) {
      return Promise.reject(
        Object.assign(new Error('Payload is too large'), {
          statusCode: 413,
        })
      );
    }

    if (
      typeof req.body === 'object' &&
      !Buffer.isBuffer(req.body)
    ) {
      return Promise.resolve(req.body);
    }

    try {
      return Promise.resolve(
        JSON.parse(
          Buffer.isBuffer(req.body)
            ? req.body.toString('utf8')
            : req.body
        )
      );
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
        reject(
          Object.assign(new Error('Payload is too large'), {
            statusCode: 413,
          })
        );
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

function isUnauthorized(req) {
  const expectedToken = process.env.APPLE_HEALTH_SYNC_TOKEN;
  return !expectedToken || !tokensMatch(suppliedToken(req), expectedToken);
}

async function handleGet(req, res) {
  if (isUnauthorized(req)) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  try {
    const { searchParams } = new URL(
      req.url || '/',
      `https://${req.headers.host || 'localhost'}`
    );
    const date = cleanDate(searchParams.get('date'));
    const records = await readTodayRecords(date);

    return sendJson(res, 200, {
      ok: true,
      records: Array.isArray(records) ? records : [],
    });
  } catch (error) {
    console.error('Apple Health read request failed:', error);

    const isBadDate =
      error.message === 'workout_date must use YYYY-MM-DD' ||
      error.message === 'workout_date is not a valid calendar date';

    if (error.message === MISSING_DATABASE_CONFIG_ERROR) {
      return sendJson(res, 500, { error: error.message });
    }

    if (isBadDate) {
      return sendJson(res, 400, { error: error.message });
    }

    return sendDatabaseError(res, error);
  }
}

async function handlePost(req, res) {
  if (isUnauthorized(req)) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  let requestPayload;
  try {
    requestPayload = validateRequestPayload(await readBody(req));
    databaseConfig();
  } catch (error) {
    const status =
      error.statusCode ||
      (error.message === MISSING_DATABASE_CONFIG_ERROR ? 500 : 400);

    return sendJson(res, status, { error: error.message });
  }

  try {
    const { nested, payloads } = requestPayload;
    const { result, record, records } =
      await upsertHealthRecords(payloads, nested);

    if (nested) {
      return sendJson(res, 201, {
        ok: true,
        records,
      });
    }

    return sendJson(res, 201, {
      ok: true,
      record: Array.isArray(result) ? result[0] : record,
    });
  } catch (error) {
    console.error('Apple Health sync request failed:', error);
    return sendDatabaseError(res, error);
  }
}

async function handler(req, res) {
  // Normalize locally instead of issuing a redirect. Redirects can cause
  // clients/proxies to replay a request as GET and drop its request body.
  if (req && typeof req.url === 'string') {
    req.url = normalizeRequestUrl(req.url);
  }

  if (req.method === 'OPTIONS') {
    return sendEmpty(res, 200);
  }

  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    return handlePost(req, res);
  }

  res.setHeader('Allow', ALLOWED_METHODS);
  return sendJson(res, 405, { error: 'Method not allowed' });
}

module.exports = handler;
