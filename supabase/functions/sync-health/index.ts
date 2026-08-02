import { createClient } from 'npm:@supabase/supabase-js@2'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = { [key: string]: JsonValue }
type UnknownRecord = Record<string, unknown>

const MAX_BODY_BYTES = 4 * 1024 * 1024
const MAX_RECORDS = 500
const SUPABASE_TIMEOUT_MS = 10000
const MAX_TEXT_LENGTH = 180
const QUANTITY_KEYS = ['qty', 'value', 'quantity', 'amount'] as const
const UNIT_KEYS = ['units', 'unit'] as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-health-sync-token, apikey, accept, content-type',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(body: JsonObject, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function safeString(value: unknown): string | null {
  if (value == null) return null
  try {
    const result = String(value).trim()
    return result || null
  } catch {
    return null
  }
}

function safeGet(object: UnknownRecord, key: string): unknown {
  try {
    return object[key]
  } catch {
    return undefined
  }
}

function safeHas(object: UnknownRecord, key: string): boolean {
  try {
    return Object.prototype.hasOwnProperty.call(object, key)
  } catch {
    return false
  }
}

function safeKeys(object: UnknownRecord): string[] {
  try {
    return Object.keys(object)
  } catch {
    return []
  }
}

function safeTag(value: object): string {
  try {
    return Object.prototype.toString.call(value)
  } catch {
    return ''
  }
}

/** Convert Health Auto Export values into JSON-safe metadata. */
function sanitizeMetadataValue(
  value: unknown,
  seen: WeakSet<object>,
  extractQuantity = true,
): JsonValue {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') return value.toString()
  if (typeof value !== 'object') return safeString(value)

  try {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? safeString(value) : value.toISOString()
    }
  } catch {
    return safeString(value)
  }

  const object = value as UnknownRecord
  const tag = safeTag(value)
  let isArray = false
  try {
    isArray = Array.isArray(value)
  } catch {
    return safeString(value)
  }

  if (!isArray && tag !== '[object Object]' && safeKeys(object).length === 0) {
    return safeString(value)
  }

  try {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)
  } catch {
    return safeString(value)
  }

  if (isArray) {
    const result: JsonValue[] = []
    try {
      for (const item of value as unknown[]) {
        result.push(sanitizeMetadataValue(item, seen, true))
      }
    } catch {
      // Preserve values already read if an input iterator is malformed.
    }
    seen.delete(value)
    return result
  }

  if (extractQuantity) {
    const scalarKey = QUANTITY_KEYS.find((key) => safeHas(object, key))
    if (scalarKey) {
      const scalar = sanitizeMetadataValue(safeGet(object, scalarKey), seen, true)
      const unitKey = UNIT_KEYS.find((key) => safeHas(object, key))
      const unit = unitKey ? sanitizeMetadataValue(safeGet(object, unitKey), seen, true) : null
      seen.delete(value)
      return unit == null ? scalar : { value: scalar, units: unit }
    }
  }

  const result: JsonObject = {}
  for (const key of safeKeys(object)) {
    try {
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: sanitizeMetadataValue(safeGet(object, key), seen, true),
        writable: true,
      })
    } catch {
      // Ignore one malformed field without dropping the complete record.
    }
  }

  seen.delete(value)
  return result
}

export function sanitizeMetadata(metadata: unknown): JsonObject {
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) return {}

  const sanitized = sanitizeMetadataValue(metadata, new WeakSet<object>(), false)
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? sanitized as JsonObject
    : {}
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function firstValue(object: UnknownRecord | null, keys: readonly string[]): unknown {
  if (!object) return undefined
  for (const key of keys) {
    const value = safeGet(object, key)
    if (value != null && value !== '') return value
  }
  return undefined
}

function textValue(value: unknown, maxLength = MAX_TEXT_LENGTH): string | null {
  const record = asRecord(value)
  const nested = record ? firstValue(record, ['name', 'value', 'label']) : value
  const text = safeString(nested)
  return text ? text.slice(0, maxLength) : null
}

function numericValue(value: unknown): number | null {
  const record = asRecord(value)
  const raw = record ? firstValue(record, QUANTITY_KEYS) : value
  if (raw == null || raw === '') return null

  const number = typeof raw === 'number' ? raw : Number(safeString(raw))
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null
}

function timestampValue(value: unknown): string | null {
  const text = safeString(value)
  if (!text) return null

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function stableStringify(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(value[key])}`
  )).join(',')}}`
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function recordCollection(body: unknown): unknown[] {
  if (Array.isArray(body)) return body

  const root = asRecord(body)
  if (!root) return []

  const directCollection = firstValue(root, ['samples', 'records', 'workouts'])
  if (Array.isArray(directCollection)) return directCollection

  const data = asRecord(safeGet(root, 'data'))
  if (Array.isArray(safeGet(root, 'data'))) return safeGet(root, 'data') as unknown[]
  if (data) {
    const nestedCollection = firstValue(data, ['samples', 'records', 'workouts'])
    if (Array.isArray(nestedCollection)) return nestedCollection
    if (safeKeys(data).length > 0 && firstValue(data, [
      'sample_id', 'sampleId', 'id', 'uuid', 'name', 'startDate', 'start', 'qty', 'value',
    ]) != null) return [data]
    return []
  }

  // A single flat sample is valid; an empty/envelope object is a no-op.
  return safeKeys(root).length > 0 ? [root] : []
}

async function normalizeRecord(raw: unknown): Promise<JsonObject> {
  const record = asRecord(raw)
  if (!record || safeKeys(record).length === 0) {
    throw new Error('Each Health Auto Export record must be a non-empty JSON object')
  }

  const metadata = sanitizeMetadata(record)
  const suppliedId = textValue(firstValue(record, [
    'sample_id', 'sampleId', 'id', 'uuid', 'external_id', 'externalId',
  ]))
  const sampleId = suppliedId || `health:${await sha256(stableStringify(metadata))}`
  const units = textValue(firstValue(record, UNIT_KEYS))
  const name = textValue(firstValue(record, [
    'name', 'type', 'metric', 'workoutActivityType', 'quantityType',
  ]), 180)
  const startDate = timestampValue(firstValue(record, ['startDate', 'start_date', 'start']))
  const endDate = timestampValue(firstValue(record, ['endDate', 'end_date', 'end']))
  const quantitySource = firstValue(record, QUANTITY_KEYS)
  const qty = numericValue(quantitySource)

  return {
    id: sampleId,
    sample_id: sampleId,
    name,
    startDate,
    endDate,
    qty,
    units,
    // Preserve the sanitized Shortcuts/Health Auto Export record as the raw
    // payload log while retaining normalized columns for querying.
    data: metadata,
    metadata,
  }
}

async function normalizePayload(body: unknown): Promise<JsonObject[]> {
  const records = recordCollection(body)
  if (records.length === 0) return []
  if (records.length > MAX_RECORDS) throw new Error(`A maximum of ${MAX_RECORDS} records is allowed`)

  const normalized = await Promise.all(records.map(normalizeRecord))
  const unique = new Map<string, JsonObject>()
  for (const row of normalized) {
    unique.set(String(row.sample_id), row)
  }
  return Array.from(unique.values())
}

function suppliedToken(request: Request): string {
  const authorization = request.headers.get('authorization') || ''
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim()
  return (request.headers.get('x-health-sync-token') || '').trim()
}

function tokensMatch(received: string, expected: string): boolean {
  const a = new TextEncoder().encode(received.trim())
  const b = new TextEncoder().encode(expected.trim())
  let difference = a.length ^ b.length
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index % (a.length || 1)] || 0) ^ (b[index % (b.length || 1)] || 0)
  }
  return difference === 0 && a.length > 0
}

function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS)
  const externalSignal = init.signal
  let onAbort: (() => void) | null = null

  try {
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason)
      } else {
        onAbort = () => controller.abort(externalSignal.reason)
        externalSignal.addEventListener('abort', onAbort, { once: true })
      }
    }

    return globalThis.fetch(input, { ...init, signal: controller.signal })
      .then(async (response) => {
        if (typeof response.arrayBuffer !== 'function') return response
        const body = await response.arrayBuffer()
        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      })
      .finally(() => {
        clearTimeout(timeoutId)
        if (onAbort) externalSignal?.removeEventListener('abort', onAbort)
      })
  } catch (error) {
    clearTimeout(timeoutId)
    if (onAbort) externalSignal?.removeEventListener('abort', onAbort)
    throw error
  }
}

function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) throw new Error('Supabase server configuration is incomplete')

  return createClient(url, serviceRoleKey, {
    global: { fetch: fetchWithTimeout },
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const expectedToken = Deno.env.get('APPLE_HEALTH_SYNC_TOKEN')
  if (!expectedToken || !tokensMatch(suppliedToken(request), expectedToken)) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  try {
    const contentLength = Number(request.headers.get('content-length') || '')
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Payload is too large' }, 413)
    }

    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Payload is too large' }, 413)
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return jsonResponse({ error: 'Invalid JSON payload' }, 400)
    }

    const rows = await normalizePayload(body)
    if (rows.length === 0) return jsonResponse({ success: true, count: 0 }, 200)

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('health_logs')
      .upsert(rows, { onConflict: 'sample_id', ignoreDuplicates: true })
      .select('sample_id')

    if (error) {
      console.error('Health Auto Export database upsert failed:', error.message)
      return jsonResponse({ error: 'Database operation failed' }, 502)
    }

    return jsonResponse({
      success: true,
      count: Array.isArray(data) ? data.length : 0,
    }, 200)
  } catch (error) {
    console.error('Health Auto Export request failed:', error)
    const message = error instanceof Error ? error.message : ''
    if (message === 'Supabase server configuration is incomplete') {
      return jsonResponse({ error: message }, 500)
    }
    if (message.startsWith('A maximum of ') || message.startsWith('Each Health Auto Export')) {
      return jsonResponse({ error: message }, 400)
    }
    return jsonResponse({ error: 'Unable to process Health Auto Export payload' }, 400)
  }
})
