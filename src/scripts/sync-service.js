// =============================================================
// Apple Health Edge Function client.
// This browser helper never handles or sends the server-only database key.
// =============================================================
(function (root) {
  'use strict';

  var TOKEN_KEY = 'apple_health_sync_token';
  var ENDPOINT_PROPERTY = 'appleHealthSyncEndpoint';
  var QUANTITY_KEYS = ['value', 'qty', 'quantity', 'amount'];
  var UNIT_KEYS = ['unit', 'units'];

  function safeString(value) {
    if (value == null) return null;
    try {
      var text = String(value).trim();
      return text || null;
    } catch (error) {
      return null;
    }
  }

  function safeRead(object, key) {
    try { return object[key]; } catch (error) { return undefined; }
  }

  function safeKeys(object) {
    try { return Object.keys(object); } catch (error) { return []; }
  }

  function safeHas(object, key) {
    try { return Object.prototype.hasOwnProperty.call(object, key); } catch (error) { return false; }
  }

  function safeTag(value) {
    try { return Object.prototype.toString.call(value); } catch (error) { return ''; }
  }

  // Prepare the request before JSON.stringify so native HealthKit-shaped
  // values, circular metadata, invalid dates, and throwing fields cannot make
  // the browser drop the sync request before it reaches the Edge Function.
  function sanitizeValue(value, seen, extractQuantity) {
    if (value == null) return null;
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'bigint') return String(value);
    if (typeof value !== 'object') return safeString(value);

    try {
      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? safeString(value) : value.toISOString();
      }
    } catch (error) {
      return safeString(value);
    }

    var tag = safeTag(value);
    var isArray;
    try { isArray = Array.isArray(value); } catch (error) { return safeString(value); }
    if (!isArray && tag !== '[object Object]') return safeString(value);

    try {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    } catch (error) {
      return safeString(value);
    }

    if (isArray) {
      var arrayResult = [];
      try {
        for (var index = 0; index < value.length; index += 1) {
          arrayResult.push(sanitizeValue(safeRead(value, index), seen, true));
        }
      } catch (error) { }
      seen.delete(value);
      return arrayResult;
    }

    if (extractQuantity) {
      var scalarKey = null;
      for (var q = 0; q < QUANTITY_KEYS.length; q += 1) {
        if (safeHas(value, QUANTITY_KEYS[q])) {
          scalarKey = QUANTITY_KEYS[q];
          break;
        }
      }
      if (scalarKey) {
        var scalar = sanitizeValue(safeRead(value, scalarKey), seen, true);
        var unit = null;
        for (var u = 0; u < UNIT_KEYS.length; u += 1) {
          if (safeHas(value, UNIT_KEYS[u])) {
            unit = sanitizeValue(safeRead(value, UNIT_KEYS[u]), seen, true);
            break;
          }
        }
        seen.delete(value);
        return unit == null ? scalar : { value: scalar, units: unit };
      }
    }

    var result = {};
    safeKeys(value).forEach(function (key) {
      try {
        Object.defineProperty(result, key, {
          configurable: true,
          enumerable: true,
          value: sanitizeValue(safeRead(value, key), seen, true),
          writable: true,
        });
      } catch (error) { }
    });
    seen.delete(value);
    return result;
  }

  function sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return sanitizeValue(payload, new WeakSet(), false);
  }

  function configuredEndpoint(options) {
    var explicit = options && options.endpoint;
    if (typeof explicit === 'string' && explicit.trim()) return explicit.trim().replace(/\/+$/, '');
    var configured = root && root[ENDPOINT_PROPERTY];
    return typeof configured === 'string' ? configured.trim().replace(/\/+$/, '') : '';
  }

  function configuredToken(options) {
    if (options && typeof options.token === 'string' && options.token.trim()) return options.token.trim();
    try {
      return root.localStorage.getItem(TOKEN_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function responseBody(response) {
    return response.json().catch(function () { return {}; });
  }

  async function syncAppleHealth(payload, options) {
    var endpoint = configuredEndpoint(options || {});
    var token = configuredToken(options || {});
    if (!endpoint) return { success: false, count: 0, error: 'Apple Health sync endpoint is not configured' };
    if (!token) return { success: false, count: 0, error: 'Apple Health sync token is not configured' };

    var safePayload = sanitizePayload(payload);
    if (!safePayload) return { success: false, count: 0, error: 'Apple Health payload must be an object or array' };

    try {
      var response = await root.fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(safePayload),
        credentials: 'omit',
      });
      var body = await responseBody(response);
      if (!response.ok) {
        return {
          success: false,
          count: 0,
          status: response.status,
          error: body && body.error ? String(body.error) : 'Apple Health sync failed',
        };
      }
      return {
        success: body && body.success === true,
        count: Number(body && body.count) || 0,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error: 'Apple Health sync is unavailable right now',
      };
    }
  }

  root.appleHealthSync = {
    sanitizePayload: sanitizePayload,
    sync: syncAppleHealth,
  };
}(typeof window !== 'undefined' ? window : this));
