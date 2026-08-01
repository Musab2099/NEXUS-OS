import { createClient } from 'npm:@supabase/supabase-js@2'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = { [key: string]: JsonValue }
type UnknownRecord = Record<string, unknown>

const MAX_BODY_BYTES = 4 * 1024 * 1024
const MAX_RECORDS = 500
const MAX_TEXT_LENGTH = 180
const QUANTITY_KEYS = ['value', 'qty', 'quantity', 'amount'] as const
const UNIT_KEYS = ['unit', 'units'] as const

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

/**
 * Convert HealthKit/Health Auto Export values into JSON-safe values.
 *
 * Quantity-shaped values are reduced to their scalar when no unit exists.
 * When a unit is available, the unit is retained beside the scalar so values
 * such as HKElevationAscended remain meaningful in the JSONB column.
 * Circular values, throwing getters, invalid dates, and unsupported native
 * objects become harmless strings or null rather than aborting the batch.
 */
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

  // Cross-realm plain objects normally have the [object Object] tag. If a
  // custom tag is present, still inspect enumerable fields first; this keeps
  // useful data from wrapper objects while unsupported empty natives stringify.
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
      // Keep values already read; a hostile iterator must not drop the row.
    }
    seen.delete(value)
    return result
  }

  if (extractQuantity) {
    let scalarKey: string | undefined
    try {
      scalarKey = QUANTITY_KEYS.find((key) => safeHas(object, key))
    } catch {
      scalarKey = undefined
    }

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
    // defineProperty keeps literal keys such as __proto__ as data properties.
    try {
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: sanitizeMetadataValue(safeGet(object, key), seen, true),
        writable: true,
      })
    } catch {
      // Ignore only the broken field; the rest of the record remains usable.
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

function firstValue(object: UnknownRecord | null, keys: string[]): unknown {
  if (!object) return undefined
  for (const key of keys) {
    const value = safeGet(object, key)
    if (value != null && value !== '') return value
  }
  return undefined
}

function textValue(value: unknown, fallback: string, maxLength = MAX_TEXT_LENGTH): string {
  const record = asRecord(value)
  const nested = record ? firstValue(record, ['name', 'value', 'label']) : value
  const text = safeString(nested)
  return (text || fallback).slice(0, maxLength)
}

function numberValue(value: unknown, fallback: number | null, min: number, max: number): number | null {
  const record = asRecord(value)
  const raw = record ? firstValue(record, [...QUANTITY_KEYS]) : value
  if (raw == null || raw === '') return fallback
  const text = safeString(raw)
  if (!text) return fallback
  const number = typeof raw === 'number' ? raw : Number(text)
  if (!Number.isFinite(number) || number < min || number > max) return fallback
  return Math.round(number * 100) / 100
}

function validDate(value: unknown): string | null {
  const text = safeString(value)
  if (!text) return null

  const match = text.match(/\d{4}-\d{2}-\d{2}/)
  if (!match) return null
  const candidate = match[0]
  const parsed = new Date(`${candidate}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate
    ? null
    : candidate
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
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

type GitHubArchive = {
  path: string
  url: string
  timestamp: string
  digest: string
}

type ErrorWithStatus = Error & { statusCode?: number }

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'NEXUS-Supabase-Edge-Function',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function base64Encode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  const chunkSize = 0x8000
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize))
  }
  return btoa(binary)
}

function githubArchiveError(message: string): ErrorWithStatus {
  const error = new Error(message) as ErrorWithStatus
  error.statusCode = 502
  return error
}

function githubFileEndpoint(owner: string, repo: string, filePath: string): string {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`
}

async function archiveRawExport(jsonString: string): Promise<GitHubArchive> {
  const owner = Deno.env.get('GITHUB_OWNER')?.trim()
  const repo = Deno.env.get('GITHUB_REPO')?.trim()
  const token = Deno.env.get('GITHUB_PAT')?.trim()
  const branch = Deno.env.get('GITHUB_BRANCH')?.trim() || 'main'

  if (!owner || !repo || !token) {
    throw new Error('GitHub archive configuration is incomplete')
  }

  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-')
  const dateFolder = now.toISOString().split('T')[0]
  // A content digest keeps retries idempotent while retaining the requested
  // YYYY-MM-DD archive layout. The timestamp remains available in metadata.
  const digest = await sha256(jsonString)
  const filePath = `exports/${dateFolder}/export-${digest.slice(0, 32)}.json`
  const endpoint = githubFileEndpoint(owner, repo, filePath)
  const headers = githubHeaders(token)

  let sha: string | undefined
  let lookup: Response
  try {
    lookup = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, {
      method: 'GET',
      headers,
    })
  } catch (error) {
    console.error('GitHub archive lookup failed:', error)
    throw githubArchiveError('GitHub archival is unavailable')
  }

  if (lookup.ok) {
    try {
      const existing = await lookup.json() as { type?: unknown, html_url?: unknown }
      // The path is derived from the full payload digest, so an existing file
      // at this path is the successful result of an earlier identical retry.
      if (existing.type !== 'file') {
        throw githubArchiveError('GitHub archive path is not a file')
      }
      return {
        path: filePath,
        url: typeof existing.html_url === 'string' ? existing.html_url : filePath,
        timestamp,
        digest,
      }
    } catch (error) {
      throw githubArchiveError('GitHub archive lookup returned invalid JSON')
    }
  } else if (lookup.status !== 404) {
    console.error('GitHub archive lookup rejected:', lookup.status)
    throw githubArchiveError(`GitHub archive lookup failed (${lookup.status})`)
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Add health export: ${filePath}`,
        content: base64Encode(jsonString),
        branch,
        ...(sha ? { sha } : {}),
      }),
    })
  } catch (error) {
    console.error('GitHub archive write failed:', error)
    throw githubArchiveError('GitHub archival is unavailable')
  }

  if (!response.ok) {
    // Another invocation may have created the same digest path between our
    // lookup and PUT. Re-read it and treat that immutable archive as success.
    if (response.status === 422) {
      try {
        const retryLookup = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, {
          method: 'GET',
          headers,
        })
        if (retryLookup.ok) {
          const existing = await retryLookup.json() as { type?: unknown, html_url?: unknown }
          if (existing.type !== 'file') {
            throw githubArchiveError('GitHub archive conflict path is not a file')
          }
          return {
            path: filePath,
            url: typeof existing.html_url === 'string' ? existing.html_url : filePath,
            timestamp,
            digest,
          }
        }
      } catch (error) {
        console.error('GitHub archive conflict lookup failed:', error)
      }
    }
    console.error('GitHub archive write rejected:', response.status)
    throw githubArchiveError(`GitHub archive write failed (${response.status})`)
  }

  let result: { content?: { html_url?: unknown } } = {}
  try {
    result = await response.json() as { content?: { html_url?: unknown } }
  } catch (error) {
    // A successful GitHub write without a response body is still durable; use
    // the path as the stable archive reference in the DB metadata.
  }

  return {
    path: filePath,
    url: typeof result.content?.html_url === 'string' ? result.content.html_url : filePath,
    timestamp,
    digest,
  }
}

function isExportWorkout(record: UnknownRecord): boolean {
  return [
    'start',
    'startDate',
    'workoutActivityType',
    'activeEnergy',
    'duration',
  ].some((key) => safeGet(record, key) != null)
}

function defineSafe(object: UnknownRecord, key: string, value: unknown): void {
  try {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    })
  } catch {
    // Ignore one malformed field without dropping the rest of the envelope.
  }
}

function exportEnvelope(body: UnknownRecord, nested: boolean): JsonObject {
  const envelope: UnknownRecord = {}
  for (const key of safeKeys(body)) {
    if ((nested && key === 'data') || (!nested && key === 'workouts')) continue
    defineSafe(envelope, key, safeGet(body, key))
  }

  if (nested) {
    const data = asRecord(safeGet(body, 'data'))
    if (data) {
      const cleanData: UnknownRecord = {}
      for (const key of safeKeys(data)) {
        if (key !== 'workouts') defineSafe(cleanData, key, safeGet(data, key))
      }
      if (Object.keys(cleanData).length) defineSafe(envelope, 'data', cleanData)
    }
  }

  return sanitizeMetadata(envelope)
}

async function normalizeRecord(
  raw: unknown,
  envelope: JsonObject | null,
): Promise<JsonObject> {
  const record = asRecord(raw)
  if (!record) throw new Error('Each Apple Health record must be a JSON object')

  // Accept records that do not include a workout payload; they are normalized with
  // safe defaults rather than rejected outright. This keeps the edge function resilient
  // to partial Apple Health exports and non-workout metadata objects.
  const exportWorkout = isExportWorkout(record)
  const hasWorkoutFields = exportWorkout || [
    'workout_date',
    'workoutDate',
    'workout_type',
    'active_calories',
    'avg_heart_rate',
    'duration_minutes',
    'metadata',
    'external_id',
    'externalId',
    'id',
    'uuid',
  ].some((key) => safeGet(record, key) != null)

  const date = validDate(firstValue(record, ['workout_date', 'workoutDate']))
    || (exportWorkout && (validDate(safeGet(record, 'start')) || validDate(safeGet(record, 'startDate'))))
    || todayUtc()
  const workoutType = exportWorkout
    ? textValue(firstValue(record, ['name', 'workoutActivityType']), 'Workout', 120)
    : textValue(safeGet(record, 'workout_type'), 'Workout', 120)
  const calories = exportWorkout
    ? numberValue(safeGet(record, 'activeEnergy'), 0, 0, 10000)
    : numberValue(safeGet(record, 'active_calories'), 0, 0, 10000)
  const heartRateSource = firstValue(record, ['avgHeartRate', 'heartRate'])
  const heartRateRecord = asRecord(heartRateSource)
  const heartRateValue = heartRateRecord
    ? firstValue(heartRateRecord, ['avg', ...QUANTITY_KEYS])
    : heartRateSource
  const heartRate = exportWorkout
    ? numberValue(heartRateValue, null, 0, 300)
    : numberValue(safeGet(record, 'avg_heart_rate'), null, 0, 300)
  const duration = exportWorkout
    ? numberValue(safeGet(record, 'duration'), 0, 0, 1440)
    : numberValue(safeGet(record, 'duration_minutes'), 0, 0, 1440)

  const originalMetadata = exportWorkout
    ? { ...record, ...(envelope && Object.keys(envelope).length ? { _export: envelope } : {}) }
    : safeGet(record, 'metadata')
  const metadata = sanitizeMetadata(originalMetadata)
  const suppliedId = textValue(firstValue(record, ['external_id', 'externalId', 'id', 'uuid']), '', 180)
  const source = textValue(safeGet(record, 'source'), 'apple_health', 80)
  const stableInput = sanitizeMetadata(record)
  const externalId = suppliedId || `apple-health:${await sha256(stableStringify(stableInput))}`

  return {
    user_id: textValue(safeGet(record, 'user_id'), '', 128) || null,
    external_id: externalId,
    workout_date: date,
    workout_type: workoutType,
    active_calories: calories ?? 0,
    avg_heart_rate: heartRate,
    duration_minutes: duration ?? 0,
    source,
    metadata,
  }
}

async function normalizePayload(body: unknown): Promise<JsonObject[]> {
  const root = asRecord(body)
  const nestedData = asRecord(root ? safeGet(root, 'data') : null)
  const nestedWorkouts = nestedData && Array.isArray(safeGet(nestedData, 'workouts'))
    ? safeGet(nestedData, 'workouts') as unknown[]
    : root && Array.isArray(safeGet(root, 'workouts'))
      ? safeGet(root, 'workouts') as unknown[]
      : null
  const records = Array.isArray(body) ? body : nestedWorkouts || [body]

  if (!records.length) throw new Error('At least one Apple Health record is required')
  if (records.length > MAX_RECORDS) throw new Error(`A maximum of ${MAX_RECORDS} records is allowed`)

  const envelope = nestedWorkouts && root
    ? exportEnvelope(root, Boolean(nestedData))
    : null
  const normalized = await Promise.all(records.map((record) => normalizeRecord(record, envelope)))
  const unique = new Map<string, JsonObject>()
  for (const row of normalized) unique.set(String(row.external_id), row)
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

function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) throw new Error('Supabase server configuration is incomplete')

  return createClient(url, serviceRoleKey, {
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
    // Validate server database configuration before creating an external
    // archive, avoiding an archive that can never be recorded in Supabase.
    const supabase = createAdminClient()
    // Preserve the exact UTF-8 JSON text received from the sender. The digest
    // and GitHub file therefore represent the original export, not a reformatted
    // parse/re-serialize of it.
    const archive = await archiveRawExport(rawBody)
    const archivedRows = rows.map((row) => ({
      ...row,
      metadata: {
        ...row.metadata,
        _github_archive: {
          path: archive.path,
          url: archive.url,
          export_timestamp: archive.timestamp,
          digest: archive.digest,
        },
      },
    }))

    const { data, error } = await supabase
      .from('apple_health_logs')
      .upsert(archivedRows, { onConflict: 'external_id', ignoreDuplicates: false })
      .select('id')

    if (error) {
      console.error('Apple Health Edge Function upsert failed:', error.message)
      return jsonResponse({ error: 'Database operation failed' }, 502)
    }

    return jsonResponse({
      success: true,
      count: Array.isArray(data) ? data.length : archivedRows.length,
      archive: { path: archive.path, url: archive.url },
    }, 201)
  } catch (error) {
    console.error('Apple Health Edge Function request failed:', error)
    const message = error instanceof Error ? error.message : ''
    if (message === 'Supabase server configuration is incomplete'
      || message === 'GitHub archive configuration is incomplete') {
      return jsonResponse({ error: message }, 500)
    }
    if (error && typeof error === 'object' && 'statusCode' in error
      && Number((error as ErrorWithStatus).statusCode) === 502) {
      return jsonResponse({ error: 'GitHub archival failed' }, 502)
    }
    if (message === 'At least one Apple Health record is required'
      || message.startsWith('A maximum of ')
      || message.startsWith('Each Apple Health record')) {
      return jsonResponse({ error: message }, 400)
    }
    return jsonResponse({ error: 'Unable to process Apple Health payload' }, 400)
  }
})
