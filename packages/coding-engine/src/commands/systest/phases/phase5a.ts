/**
 * Phase 5A: Test Data Seeding
 *
 * Generates comprehensive, layered test data for API and UI testing.
 * Reads outputs from Phase 1-4 and produces rich seed data with
 * entity records, business logic test cases, validation scenarios,
 * state transitions, edge cases, and integration flows.
 *
 * Runs in all modes.
 *
 * Seed fields of note (this file writes `test_data_seed.json`):
 *   - entities                   : Map<entityName, { records, primaryKey, ... }>
 *   - layer1Tests / layer2Tests  : API test cases for Phase 5B
 *   - auth / auth_admin          : credentials (may be null; AI creates users)
 *   - _authDiscovery             : OpenAPI-derived auth endpoints
 *   - _prpReferences             : PRP files for AI context
 *   - _dbSchema                  : DB introspection result
 *   - _graphEntities             : user-like entities found in the graph
 *   - frontendRoutes (B1)        : Array<{ path, component?, source }> used by
 *                                  Phase 5C — empty array if no frontend or
 *                                  no routes detected (Phase 5C then falls
 *                                  back to runtime DOM discovery)
 *   - _runId / _seedHash         : reproducibility metadata
 */

import { join } from 'node:path'
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
import type { SystestContext, PhaseResult } from './orchestrator.js'
import { getGraphEnhancer } from '../../../services/systest/graphEnhancer.js'
import { normalizeRoutePath } from '../../../services/systest/routeNormalizer.js'

// ---------------------------------------------------------------------------
// Stage cache infrastructure (P2-2: staged Phase 5A with resume)
// ---------------------------------------------------------------------------

const PHASE5A_STAGE_VERSION = '1.0.0'

interface StageCache<T> {
  _stage: number
  _version: string
  _computedAt: string
  _inputHashes: Record<string, string>
  payload: T
}

/**
 * Build a fingerprint from a list of files. Each entry becomes "path:mtimeMs".
 * The result is SHA256-hashed (first 16 hex chars). Missing files are skipped.
 * Returns "empty" if no files exist.
 */
function fingerprintFiles(paths: string[]): string {
  const parts: string[] = []
  for (const p of paths.slice().sort()) {
    try {
      const st = statSync(p)
      parts.push(`${p}:${st.mtimeMs}`)
    } catch {
      // missing — skip
    }
  }
  if (parts.length === 0) return 'empty'
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)
}

/**
 * Build a fingerprint from PRP-*.md files in any number of candidate dirs.
 * Expands glob-ish pattern `{dir}/.project/prps/PRP-*.md` per dir.
 */
function fingerprintPrpFiles(dirs: string[]): { hash: string; files: string[] } {
  const files: string[] = []
  for (const d of dirs) {
    const prpDir = join(d, '.project', 'prps')
    if (!existsSync(prpDir)) continue
    try {
      for (const f of readdirSync(prpDir)) {
        if (/^PRP-.*\.md$/i.test(f)) files.push(join(prpDir, f))
      }
    } catch {}
  }
  return { hash: fingerprintFiles(files), files }
}

/**
 * Compute a deterministic hash of stable project inputs. Same inputs → same hash.
 * Used to ensure AI-generated credentials are reproducible across runs.
 */
function computeSeedHash(inputs: {
  workspace: string,
  prpFiles?: Array<{ path: string, content: string }>,
  openApiSpecText?: string | null,
  dbSchemaText?: string | null,
  graphNodeCount?: number,
}): string {
  const hasher = createHash('sha256')
  // Workspace: normalize to forward slashes; use only the last 3 path segments
  // so moving the repo doesn't invalidate the hash
  const wsNorm = inputs.workspace.replace(/\\/g, '/').split('/').filter(Boolean).slice(-3).join('/')
  hasher.update('ws:' + wsNorm + '\n')
  // PRPs: sort by path, concatenate content
  if (inputs.prpFiles && inputs.prpFiles.length > 0) {
    const sorted = [...inputs.prpFiles].sort((a, b) => a.path.localeCompare(b.path))
    for (const f of sorted) {
      hasher.update('prp:' + f.path + ':' + f.content + '\n')
    }
  } else {
    hasher.update('prp:none\n')
  }
  // OpenAPI spec
  hasher.update('openapi:' + (inputs.openApiSpecText ? inputs.openApiSpecText.substring(0, 10000) : 'none') + '\n')
  // DB schema
  hasher.update('db:' + (inputs.dbSchemaText || 'none') + '\n')
  // Graph node count (coarse but stable)
  hasher.update('graph:' + (inputs.graphNodeCount ?? 0) + '\n')
  return hasher.digest('hex').substring(0, 16)  // first 16 hex chars = 64 bits
}

/**
 * Generate a unique-per-invocation run identifier, filesystem-safe.
 * Format: 2026-04-18T14-23-05-123Z
 */
function generateRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function humanAge(ms: number): string {
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.round(hr / 24)
  return `${day} day${day === 1 ? '' : 's'} ago`
}

/**
 * Generic cache helper. If the cache file exists and version + all input
 * hashes match, returns the cached payload. Otherwise runs `compute()` and
 * writes the result to disk.
 *
 * A corrupted cache file logs a warning and falls back to recomputation.
 */
async function loadOrCompute<T>(
  stageNum: number,
  stageLabel: string,
  cachePath: string,
  version: string,
  inputHashes: Record<string, string>,
  compute: () => Promise<T> | T,
  /**
   * Optional predicate that decides whether a freshly-computed payload is
   * worth caching. Useful for e.g. skipping cache when the result is suspiciously
   * empty (graph failed transiently → empty entities → stale empty cache bug).
   * If omitted, always caches. If returns false, payload is returned but NOT written.
   */
  shouldCache?: (payload: T) => boolean,
): Promise<T> {
  // Try cache
  if (existsSync(cachePath)) {
    try {
      const raw = readFileSync(cachePath, 'utf-8')
      const cache = JSON.parse(raw) as StageCache<T>
      if (
        cache._version === version &&
        cache._stage === stageNum &&
        cache._inputHashes &&
        Object.keys(inputHashes).every(k => cache._inputHashes[k] === inputHashes[k]) &&
        Object.keys(cache._inputHashes).every(k => inputHashes[k] === cache._inputHashes[k])
      ) {
        const age = Date.now() - new Date(cache._computedAt).getTime()
        console.log(`[Phase 5A:Stage ${stageNum}/4] ${stageLabel}: cache HIT (last computed ${humanAge(age)})`)
        return cache.payload
      }
      // Determine reason
      let reason = 'input changed'
      if (cache._version !== version) reason = `version bump ${cache._version} -> ${version}`
      else {
        for (const k of Object.keys(inputHashes)) {
          if (cache._inputHashes?.[k] !== inputHashes[k]) { reason = `${k} changed`; break }
        }
        for (const k of Object.keys(cache._inputHashes || {})) {
          if (!(k in inputHashes)) { reason = `${k} no longer tracked`; break }
        }
      }
      console.log(`[Phase 5A:Stage ${stageNum}/4] ${stageLabel}: cache MISS (reason: ${reason}) — recomputing`)
    } catch (e) {
      console.warn(`[Phase 5A:Stage ${stageNum}/4] ${stageLabel}: cache read failed (${e instanceof Error ? e.message : String(e)}) — recomputing`)
    }
  } else {
    console.log(`[Phase 5A:Stage ${stageNum}/4] ${stageLabel}: cache MISS (no cache file) — computing`)
  }

  const payload = await compute()
  // If predicate says not to cache (e.g., empty entities when graph was available),
  // return payload without writing — next run will recompute and get a real result.
  if (shouldCache && !shouldCache(payload)) {
    console.warn(`[Phase 5A:Stage ${stageNum}/4] ${stageLabel}: payload not cached (shouldCache predicate returned false)`)
    return payload
  }
  const cacheObj: StageCache<T> = {
    _stage: stageNum,
    _version: version,
    _computedAt: new Date().toISOString(),
    _inputHashes: inputHashes,
    payload,
  }
  try {
    writeFileSync(cachePath, JSON.stringify(cacheObj, null, 2))
  } catch (e) {
    console.warn(`[Phase 5A:Stage ${stageNum}/4] ${stageLabel}: failed to write cache: ${e instanceof Error ? e.message : String(e)}`)
  }
  return payload
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhaseAnalysis {
  phase1: any
  phase2: any
  phase4: any
}

interface BusinessTestCases {
  layer1: any[]
  layer2: any[]
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Filter out invalid entity names: markdown headings, TypeScript types, etc.
 */
/**
 * Shared entity filter used by all scenario builders. Drops file-like names,
 * markdown headings, and other noise picked up by upstream phases.
 */
function filterValidEntities<T = any>(entities: T[]): T[] {
  if (!Array.isArray(entities)) return []
  return entities.filter((e: any) => {
    const name = typeof e === 'string' ? e : (e?.name || e?.entityName || e?.label || '')
    return isValidEntityName(name)
  })
}

/**
 * Returns true if `name` is a file-like artifact (extension, dotfile, path).
 */
function isFileLikeName(name: string): boolean {
  if (!name) return false
  if (/\.(md|txt|json|yaml|yml|csv|tsv|pdf|docx?|xlsx?|ts|tsx|js|jsx|py|java|go|rs|rb|php|sql)$/i.test(name)) return true
  if (name.startsWith('.') || name.startsWith('/') || name.startsWith('\\')) return true
  if (name.includes('`')) return true
  return false
}

/**
 * Returns true if `name` looks like a real entity (DB table, model class, domain object).
 * Returns false for docs headings, DTOs, enums, column names, and junk.
 */
function isValidEntityName(name: string): boolean {
  if (!name || typeof name !== 'string') return false
  const trimmed = name.trim()
  if (trimmed.length === 0) return false
  if (trimmed.length < 2) return false
  if (trimmed.length > 60) return false

  // Must start with letter
  if (!/^[A-Za-z]/.test(trimmed)) return false

  // No spaces or whitespace in name
  if (/\s/.test(trimmed)) return false

  // Reject markdown/code metacharacters
  if (/[#*`\[\](){}|>\\/]/.test(trimmed)) return false

  // File-like names
  if (isFileLikeName(trimmed)) return false

  // Docs heading words (case-insensitive)
  const DOCS_HEADINGS = new Set([
    'overview', 'summary', 'introduction', 'background', 'context',
    'services', 'service', 'infrastructure', 'architecture',
    'configuration', 'config', 'settings', 'environment', 'deployment',
    'verification', 'validation', 'testing', 'tests', 'quality',
    'appendix', 'references', 'glossary', 'index',
    'requirements', 'specifications', 'specs', 'objectives',
    'features', 'roadmap', 'changelog', 'history',
    'security', 'compliance', 'privacy',
    'performance', 'scalability', 'reliability',
    'api', 'apis', 'endpoints', 'routes',
    'database', 'schema', 'migration', 'migrations',
    'troubleshooting', 'faq', 'faqs',
    'todo', 'todos', 'note', 'notes', 'remarks',
  ])
  if (DOCS_HEADINGS.has(trimmed.toLowerCase())) return false

  // ALL-CAPS column-like names: all uppercase letters (with optional digits/_) and <= 20 chars
  // Typical examples: ACHATID, PRIX, EMPLOYEID, CLIENTID, FOO_BAR_ID
  // Real entities like "User" or "Airport" have lowercase letters
  if (/^[A-Z][A-Z0-9_]{0,20}$/.test(trimmed) && trimmed.length <= 20 && !/[a-z]/.test(trimmed)) return false

  // Type-definition suffixes that are not entities
  const TYPE_SUFFIXES = ['Type', 'Interface', 'Props', 'State', 'Context', 'Config', 'Options']
  for (const suffix of TYPE_SUFFIXES) {
    if (trimmed.endsWith(suffix) && trimmed.length > suffix.length) {
      const base = trimmed.slice(0, -suffix.length)
      if (/^[A-Z][a-zA-Z]+$/.test(base)) return false
    }
  }

  // DTO suffixes — these are schemas, not entities (the base entity is tracked separately)
  const DTO_SUFFIXES = ['Create', 'Update', 'Patch', 'Delete', 'Request', 'Response', 'DTO', 'Dto',
                        'Input', 'Output', 'Params', 'Query', 'Filter', 'Form', 'Payload', 'View',
                        'List', 'Item', 'Entry', 'Ref', 'Summary', 'Detail', 'Details']
  for (const suffix of DTO_SUFFIXES) {
    if (trimmed.endsWith(suffix) && trimmed.length > suffix.length) {
      const base = trimmed.slice(0, -suffix.length)
      // Only exclude if base looks like a real entity (starts with capital letter)
      if (/^[A-Z][a-zA-Z]+$/.test(base)) return false
    }
  }

  // Require PascalCase OR snake_case with letters+underscores.
  // PascalCase: starts with capital letter, has at least one lowercase letter
  // snake_case: lowercase, with at least one underscore separator
  // This rejects single-word lowercase (e.g., "avion") which are usually enums or
  // column-projections, not domain entities.
  const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(trimmed) && /[a-z]/.test(trimmed)
  const isSnakeCase = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(trimmed)
  if (!isPascalCase && !isSnakeCase) return false

  return true
}

/**
 * Infer the required role for a test case from its method/endpoint.
 * Used to tag test cases so Phase 5B can pick the right credentials.
 */
function inferAuthRole(method: string, endpoint: string, authRequired: boolean): string {
  if (!authRequired) return 'none'
  const path = endpoint.toLowerCase()

  // Admin only for dedicated admin paths (with boundary) — not substrings like "admin-comments"
  if (/\/admin(\/|$|\?)/.test(path) || /\/adm(\/|$)/.test(path)) return 'admin'

  // DELETE on a top-level collection resource (e.g. DELETE /api/employees/{id}) is typically admin.
  // But NOT DELETE /api/sessions/me (self logout) or DELETE /api/users/{id}/favorites/{fid} (own resource).
  if (method === 'DELETE') {
    const segments = path.split('/').filter(Boolean)
    // /api/{resource}/{id} pattern — 3 segments where {id} is a param
    // Self operations (ending in /me, /self, /my) → user
    if (/\/(me|self|my)(\/|$)/.test(path)) return 'user'
    // Nested resource (>= 4 segments after /api) → usually own resource → user
    const apiIdx = segments.indexOf('api')
    const depthAfterApi = apiIdx >= 0 ? segments.length - apiIdx - 1 : segments.length
    if (depthAfterApi >= 3) return 'user'
    return 'admin'
  }

  return 'user'
}

/**
 * Extract the entity context name from an endpoint path.
 * Skips version prefixes (v1, v2) and common non-plural words.
 * e.g. /api/employees/{id} -> "Employee"; /api/v2/flight-schedules -> "FlightSchedule"
 */
const _nonPluralWords = new Set(['news', 'status', 'analytics', 'metrics', 'settings', 'users', 'series'])
const _realSingulars: Record<string, string> = {
  news: 'News', status: 'Status', analytics: 'Analytics', metrics: 'Metric',
  settings: 'Setting', users: 'User', series: 'Series',
}

function inferEntityContext(endpoint: string): string | null {
  const segments = endpoint.split('/').filter(s => s && !s.startsWith('{'))
  // Find the first meaningful segment after /api and skip version prefixes
  let i = 0
  if (segments[i]?.toLowerCase() === 'api') i++
  while (i < segments.length && /^v\d+$/i.test(segments[i])) i++
  const word = segments[i]
  if (!word) return null

  const lower = word.toLowerCase()
  if (_realSingulars[lower]) return _realSingulars[lower]
  if (_nonPluralWords.has(lower)) return word.charAt(0).toUpperCase() + word.slice(1)

  // Singularize: ies→y, s (but not ss, us)
  let singular = word
  if (/ies$/i.test(singular)) singular = singular.replace(/ies$/i, 'y')
  else if (/s$/i.test(singular) && !/(ss|us)$/i.test(singular)) singular = singular.slice(0, -1)

  return singular.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

/**
 * Extract path params from an endpoint like /api/bookings/{booking_id}/employees/{empid}.
 * For compound paths, each param is mapped to the entity inferred from its PRECEDING
 * path segment (e.g., {booking_id} → Booking, {empid} → Employee), not the final
 * endpoint-level entity. Returns null if no params.
 */
function extractPathParams(
  endpoint: string,
  entityContext: string | null,
  primaryKey: string,
): Record<string, string> | null {
  const matches = Array.from(endpoint.matchAll(/\{([^}]+)\}/g))
  if (matches.length === 0) return null

  // Split path into segments once, so we can locate each {param}'s preceding segment.
  const segments = endpoint.split('/').filter(Boolean)
  const result: Record<string, string> = {}

  for (const m of matches) {
    const paramName = m[1]
    // Find the segment index containing this {paramName} — its preceding segment
    // is the collection name (e.g., ['api','bookings','{booking_id}',...]).
    const idx = segments.findIndex(s => s === `{${paramName}}`)
    const precedingSegment = idx > 0 ? segments[idx - 1] : null
    // Infer entity from preceding segment if possible; fall back to endpoint-level entity.
    const segEntity = precedingSegment
      ? inferEntityContext('/' + precedingSegment + '/{x}')
      : null
    const targetEntity = segEntity || entityContext

    if (targetEntity) {
      // Prefer the param's own name as the field; fall back to primaryKey if it's generic "id".
      const isGenericId = paramName === 'id'
      const field = isGenericId ? primaryKey : paramName
      result[paramName] = `$entities.${targetEntity}.records[0].${field}`
    } else {
      result[paramName] = '$placeholder'
    }
  }
  return result
}

/**
 * Simple $ref resolver for OpenAPI specs — top-level only, no deep recursion.
 */
function resolveRef(ref: string | undefined, spec: any): any {
  if (!ref || typeof ref !== 'string') return null
  const path = ref.replace(/^#\//, '').split('/')
  let node: any = spec
  for (const p of path) node = node?.[p]
  return node
}

/**
 * Extract and resolve the happy-path response schema from an OpenAPI operation.
 */
function extractResponseSchema(operation: any, expectedStatus: number | string, spec: any): any {
  const statusStr = String(expectedStatus)
  const response = operation?.responses?.[statusStr] || operation?.responses?.default
  const schema = response?.content?.['application/json']?.schema
  if (!schema) return null
  return schema.$ref ? resolveRef(schema.$ref, spec) : schema
}

function schemaTypeDefault(s: any): any {
  if (!s) return null
  if (s.type === 'string') return 'string-value'
  if (s.type === 'integer' || s.type === 'number') return 0
  if (s.type === 'boolean') return false
  if (s.type === 'array') return []
  return {}
}

const MAX_SAMPLE_BODY_DEPTH = 5
const depthWarningsEmitted = new Set<string>()

function buildSampleBody(schema: any, entityContext: string | null, depth = 0): any {
  if (!schema) return null
  if (depth > MAX_SAMPLE_BODY_DEPTH) {
    // Warn once per entity-context to avoid log spam; Phase 5B AI will need to
    // derive values for these deep fields from OpenAPI spec directly.
    const key = `${entityContext || 'unknown'}@${depth}`
    if (!depthWarningsEmitted.has(key)) {
      depthWarningsEmitted.add(key)
      console.warn(`[Phase 5A] buildSampleBody: max depth ${MAX_SAMPLE_BODY_DEPTH} exceeded for entity=${entityContext || 'unknown'} — returning null. Phase 5B AI must derive deep fields from OpenAPI spec.`)
    }
    return null
  }
  if (schema.$ref) return null  // caller should resolve first

  if (schema.type === 'object' && schema.properties) {
    const body: any = {}
    for (const [prop, propSchema] of Object.entries<any>(schema.properties)) {
      const ps: any = propSchema
      // Recurse into nested objects
      if (ps.type === 'object' && ps.properties) {
        body[prop] = buildSampleBody(ps, entityContext, depth + 1)
      }
      // Array of objects — generate one sample item
      else if (ps.type === 'array' && ps.items) {
        if (ps.items.type === 'object' && ps.items.properties) {
          body[prop] = [buildSampleBody(ps.items, entityContext, depth + 1)]
        } else {
          body[prop] = [schemaTypeDefault(ps.items)]
        }
      }
      // Leaf field — use $-ref if entity context exists, else type default
      else if (entityContext) {
        body[prop] = `$entities.${entityContext}.records[0].${prop}`
      } else {
        body[prop] = schemaTypeDefault(ps)
      }
    }
    return body
  }

  // Top-level array schema (rare for request bodies)
  if (schema.type === 'array' && schema.items) {
    if (schema.items.type === 'object' && schema.items.properties) {
      return [buildSampleBody(schema.items, entityContext, depth + 1)]
    }
    return [schemaTypeDefault(schema.items)]
  }

  return null
}

function lookupPrimaryKey(seed: any, entityContext: string | null): string {
  if (!entityContext) return 'id'
  return seed?.entities?.[entityContext]?.primaryKey || 'id'
}

/**
 * Fetch OpenAPI spec from running backend and regenerate layer1/layer2 test cases.
 * Called after backend is confirmed running (Phase 5A post-startup).
 */
async function enrichFromOpenApi(backendUrl: string | undefined, seed: any, outputDir: string): Promise<void> {
  if (!backendUrl) return

  const specUrls = [
    `${backendUrl}/openapi.json`,
    `${backendUrl}/api/openapi.json`,
    `${backendUrl}/swagger.json`,
    `${backendUrl}/docs/openapi.json`,
    `${backendUrl}/api-docs`,
  ]

  let spec: any = null
  for (const url of specUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      const data = await res.json()
      if (data && (data.paths || data.openapi || data.swagger)) {
        spec = data
        console.log('[Phase 5A] OpenAPI spec found at:', url)
        break
      }
    } catch {}
  }

  if (!spec?.paths) return

  // Preserve raw spec for seedHash computation. Backend contract changes (new
  // endpoints, schema updates) then change seedHash → runs are properly differentiated.
  ;(seed as any)._openApiSpec = spec

  const layer1: any[] = []
  const layer2: any[] = []
  let apiId = 1, authId = 1, valId = 1

  for (const [path, methods] of Object.entries<any>(spec.paths)) {
    for (const [method, operation] of Object.entries<any>(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue

      const security = operation.security || spec.security || []
      const authRequired = security.length > 0 ? 'bearer' : 'none'
      const expectedStatus = method === 'post' ? 201 : 200

      // Extract request body schema
      let requestBody: any = undefined
      const content = operation?.requestBody?.content
      if (content) {
        const mediaType = content['application/json'] || Object.values(content)[0] as any
        if (mediaType?.schema) requestBody = mediaType.schema
      }

      const methodUpper = method.toUpperCase()
      const authRole = inferAuthRole(methodUpper, path, authRequired !== 'none')
      const entityContext = inferEntityContext(path)
      const primaryKey = lookupPrimaryKey(seed, entityContext)
      const pathParams = extractPathParams(path, entityContext, primaryKey)

      // Pre-resolve $ref into a concrete sample body for Phase 5B
      const resolvedSchema = requestBody?.$ref ? resolveRef(requestBody.$ref, spec) : requestBody
      const requestBodyResolved = resolvedSchema ? buildSampleBody(resolvedSchema, entityContext) : null

      // Resolve expected response schema so Phase 5B can validate body shape, not just status
      const expectedResponseSchema = extractResponseSchema(operation, expectedStatus, spec)

      // Layer 1: Happy path
      layer1.push({
        'Test ID': `API-${String(apiId++).padStart(3, '0')}`,
        'Test Name': `${methodUpper} ${path} - ${operation.summary || 'happy path'}`,
        'Endpoint': path,
        'Method': methodUpper,
        'Expected': String(expectedStatus),
        'Priority': 'P0',
        '_requestBody': requestBody,
        '_requestBodyResolved': requestBodyResolved,
        '_expectedResponseSchema': expectedResponseSchema,
        '_pathParams': pathParams,
        '_auth': authRequired,
        '_authRole': authRole,
        '_entityContext': entityContext,
        '_tags': operation.tags || [],
      })

      // Layer 2: Auth test
      if (authRequired !== 'none') {
        layer2.push({
          'Test ID': `L2-AUTH-${String(authId++).padStart(3, '0')}`,
          'Test Name': `${methodUpper} ${path} - unauthenticated access`,
          'Endpoint': path,
          'Method': methodUpper,
          'Expected': '401',
          'Priority': 'P0',
          '_category': 'auth',
          '_authRole': 'none',
          '_entityContext': entityContext,
          '_pathParams': pathParams,
        })
      }

      // Layer 2: Validation test for write endpoints
      if (['post', 'put', 'patch'].includes(method) && requestBody) {
        layer2.push({
          'Test ID': `L2-VAL-${String(valId++).padStart(3, '0')}`,
          'Test Name': `${methodUpper} ${path} - empty request body`,
          'Endpoint': path,
          'Method': methodUpper,
          'Expected': '422',
          'Priority': 'P1',
          '_category': 'validation',
          '_requestBody': {},
          '_authRole': authRole,
          '_entityContext': entityContext,
          '_pathParams': pathParams,
        })
      }
    }
  }

  if (layer1.length > 0) {
    // Merge L1: prefer existing Phase 4 tests (richer business context) over OpenAPI-derived ones.
    // Dedup key: METHOD + endpoint. Only add OpenAPI L1 tests for endpoints Phase 4 didn't cover.
    const existingL1 = seed.layer1Tests || []
    const existingL1Keys = new Set(
      existingL1.map((t: any) => `${String(t.Method || '').toUpperCase()} ${t.Endpoint}`)
    )
    const newL1 = layer1.filter(
      (t: any) => !existingL1Keys.has(`${String(t.Method || '').toUpperCase()} ${t.Endpoint}`)
    )
    const mergedL1 = [...existingL1, ...newL1]

    // Merge L2: keep existing non-auth (business/validation/edge), add OpenAPI-derived auth + val.
    // Dedup auth by METHOD + endpoint to avoid duplicates.
    const existingL2 = seed.layer2Tests || []
    const existingL2NonAuth = existingL2.filter((t: any) => t._category !== 'auth')
    const existingAuthKeys = new Set(
      existingL2
        .filter((t: any) => t._category === 'auth')
        .map((t: any) => `${String(t.Method || '').toUpperCase()} ${t.Endpoint}`)
    )
    const newL2 = layer2.filter((t: any) => {
      if (t._category !== 'auth') return true
      return !existingAuthKeys.has(`${String(t.Method || '').toUpperCase()} ${t.Endpoint}`)
    })
    const existingAuth = existingL2.filter((t: any) => t._category === 'auth')
    const mergedL2 = [...existingL2NonAuth, ...existingAuth, ...newL2]

    console.log(
      `[Phase 5A] OpenAPI enrichment: L1 merged (${existingL1.length} existing + ${newL1.length} new from OpenAPI = ${mergedL1.length}), ` +
      `L2 merged (${existingL2.length} existing + ${newL2.length} new = ${mergedL2.length})`
    )
    seed.layer1Tests = mergedL1
    seed.layer2Tests = mergedL2
  }

  // Also regenerate the test-cases file.
  // IMPORTANT: Preserve Phase 4 entityTests/businessTests/edgeCaseTests on disk.
  // Merge (not replace) apiTests/authTests/validationTests by METHOD+endpoint.
  try {
    const testCasesPath = join(outputDir, 'test-cases', 'generated-test-cases.json')
    const openApiApiTests = layer1.map(t => ({
      id: t['Test ID'],
      endpoint: t.Endpoint,
      method: t.Method,
      description: t['Test Name'],
      requestBody: t._requestBody,
      auth: t._auth,
      expectedStatus: parseInt(t.Expected),
      priority: t.Priority,
      category: 'api',
      tags: t._tags,
    }))
    const openApiAuthTests = layer2.filter(t => t._category === 'auth').map(t => ({
      id: t['Test ID'],
      endpoint: t.Endpoint,
      method: t.Method,
      description: t['Test Name'],
      auth: 'none',
      expectedStatus: parseInt(t.Expected),
      priority: t.Priority,
      category: 'auth',
    }))
    const openApiValTests = layer2.filter(t => t._category === 'validation').map(t => ({
      id: t['Test ID'],
      endpoint: t.Endpoint,
      method: t.Method,
      description: t['Test Name'],
      requestBody: t._requestBody,
      auth: t._auth || 'bearer',
      expectedStatus: parseInt(t.Expected),
      priority: t.Priority,
      category: 'validation',
    }))

    // Load existing (Phase 4) test-cases to preserve entity/business/edge tests and dedup
    let existing: any = {}
    if (existsSync(testCasesPath)) {
      try { existing = JSON.parse(readFileSync(testCasesPath, 'utf-8')) || {} } catch {}
    }

    const keyOf = (t: any) => `${String(t.method || '').toUpperCase()} ${t.endpoint}`
    const mergeByKey = (existingArr: any[], newArr: any[]) => {
      const keys = new Set((existingArr || []).map(keyOf))
      return [...(existingArr || []), ...newArr.filter(t => !keys.has(keyOf(t)))]
    }

    const apiTests = mergeByKey(existing.apiTests || [], openApiApiTests)
    const authTests = mergeByKey(existing.authTests || [], openApiAuthTests)
    const valTests = mergeByKey(existing.validationTests || [], openApiValTests)
    const entityTests = existing.entityTests || []
    const businessTests = existing.businessTests || []
    const edgeCaseTests = existing.edgeCaseTests || existing.edgeTests || []

    const fullOutput = {
      $schema: 'meta-coder-systest-test-cases',
      _version: '2.0.0',
      generated_at: new Date().toISOString(),
      sources: {
        openapi: true,
        graphEndpoints: Boolean(existing?.sources?.graphEndpoints),
        designApis: Boolean(existing?.sources?.designApis),
        phase4: Boolean(existing.apiTests || existing.entityTests || existing.businessTests),
      },
      total: apiTests.length + authTests.length + valTests.length + entityTests.length + businessTests.length + edgeCaseTests.length,
      apiTests,
      authTests,
      validationTests: valTests,
      entityTests,
      businessTests,
      edgeCaseTests,
    }
    writeFileSync(testCasesPath, JSON.stringify(fullOutput, null, 2))
    console.log(`[Phase 5A] Regenerated test-cases (merged): api=${apiTests.length} auth=${authTests.length} val=${valTests.length} entity=${entityTests.length} business=${businessTests.length} edge=${edgeCaseTests.length}`)
  } catch (e) {
    console.warn('[Phase 5A] Failed to regenerate test-cases:', e)
  }
}

/**
 * Validate the fully-built seed before writing to disk.
 * Returns { fatal, warnings, stats } — fatal[] non-empty means Phase 5B MUST NOT run.
 *
 * Fatal conditions:
 *   - layer1Tests empty, OR > 20% have Method=UNKNOWN / Endpoint with spaces
 *   - entities empty when a knowledge graph was available
 *   - total test cases (layer1 + layer2) < 5
 *
 * Warnings (non-blocking — AI may fix in STEP A-G):
 *   - auth===null && auth_admin===null AND registerEndpoint discovered
 *   - entity names with spaces
 *   - missing PRP files
 */
function validateSeedQuality(seed: any, graphAvailable: boolean): {
  fatal: string[]
  warnings: string[]
  stats: Record<string, any>
} {
  const fatal: string[] = []
  const warnings: string[] = []

  const l1: any[] = Array.isArray(seed?.layer1Tests) ? seed.layer1Tests : []
  const l2: any[] = Array.isArray(seed?.layer2Tests) ? seed.layer2Tests : []
  const total = l1.length + l2.length

  // --- Fatal checks ---

  if (l1.length === 0) {
    fatal.push('seed.layer1Tests is empty — no happy-path tests to execute')
  } else {
    const invalidL1 = l1.filter((t: any) => {
      const method = String(t?.Method || t?.method || '').toUpperCase()
      const endpoint = String(t?.Endpoint || t?.endpoint || '')
      return method === 'UNKNOWN' || endpoint.includes(' ')
    })
    const invalidPct = invalidL1.length / l1.length
    if (invalidPct > 0.2) {
      fatal.push(
        `${invalidL1.length}/${l1.length} Layer 1 tests (${Math.round(invalidPct * 100)}%) have Method=UNKNOWN or Endpoint containing spaces — threshold is 20%`
      )
    } else if (invalidL1.length > 0) {
      warnings.push(`${invalidL1.length}/${l1.length} Layer 1 tests have invalid method/endpoint (below 20% threshold)`)
    }
  }

  const entityCount = seed?.entities && typeof seed.entities === 'object'
    ? Object.keys(seed.entities).length
    : 0
  // Empty entities is only fatal when L1 tests NEED them (i.e., have _pathParams
  // or _entityContext). Functional/RPC-style backends (no CRUD resources) are legit.
  if (graphAvailable && entityCount === 0) {
    const needsEntities = l1.some((t: any) =>
      (t?._pathParams && Object.keys(t._pathParams).length > 0) || t?._entityContext
    )
    if (needsEntities) {
      fatal.push('seed.entities is empty although a knowledge graph was available AND L1 tests reference entities (via _pathParams / _entityContext) — graph enrichment produced no entities')
    } else {
      warnings.push('seed.entities is empty (graph was available but no entity-like tables found); tests do not reference entities so this may be OK for RPC-style APIs')
    }
  }

  if (total < 5) {
    fatal.push(`Total test cases (layer1 + layer2) = ${total} is below minimum of 5`)
  }

  // --- Auth creation feasibility guard ---

  const authMissing = seed?.auth == null && seed?.auth_admin == null
  const registerKnown = Boolean(seed?._authDiscovery?.registerEndpoint)
  const canRegister = registerKnown
  const dbSchemaAvailable = Boolean(seed?._dbSchema?.available)
  const userTables: string[] = Array.isArray(seed?._dbSchema?.userTableHints) ? seed._dbSchema.userTableHints : []
  const hasUserTable = userTables.length > 0
  const graphUserEntities: any[] = Array.isArray(seed?._graphEntities?.userLikeEntities) ? seed._graphEntities.userLikeEntities : []
  const graphHasUserEntity = graphUserEntities.length > 0

  if (authMissing && registerKnown) {
    warnings.push(
      'seed.auth and seed.auth_admin are both null, but _authDiscovery.registerEndpoint is known — AI must create users in STEP A-G before Phase 5B'
    )
  }

  // If we have no way to create auth AND no way to know how to create one, FAIL FAST.
  if (authMissing && !registerKnown) {
    if (!dbSchemaAvailable || !hasUserTable) {
      if (!graphHasUserEntity) {
        fatal.push(
          'Cannot create test users: (1) no registerEndpoint detected in OpenAPI, (2) no user tables found in DB ' +
          `(dbSchema.available=${dbSchemaAvailable}, userTableHints=${userTables.length}), and (3) no user-like ` +
          'entities in knowledge graph. Running Phase 5B with null auth will cause auth-required tests to fail ' +
          'en masse, and SQL INSERT fallbacks will hang on unknown tables. ' +
          'Actions: (a) run DB migrations so user table exists, (b) add --database with a reachable DB URL, ' +
          'or (c) add auth credentials manually to test_data_seed.json (seed.auth and seed.auth_admin objects).'
        )
      } else {
        // We have graph hints but no DB or register. Warn strongly, don't fail yet.
        warnings.push(
          'No registerEndpoint and no DB user tables known — relying on graph-detected entities ' +
          `(${graphUserEntities.map((e: any) => e.name).slice(0, 3).join(', ')}) for test user creation. ` +
          'If AI cannot infer the real DB table name from source code, auth creation will fail.'
        )
      }
    }
  }

  if (entityCount > 0) {
    const entityNames = Object.keys(seed.entities)
    const invalid = entityNames.filter(n => !isValidEntityName(n))
    if (invalid.length > 0) {
      warnings.push(
        `${invalid.length}/${entityNames.length} entity names failed isValidEntityName() (likely docs headings, DTOs, or column names): ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? ' ...' : ''}`
      )
    }
  }

  if (!seed?._prpReferences?.available) {
    warnings.push('No PRP files found — AI will fall back to OpenAPI/DB schema inference for test user creation')
  } else if (!Array.isArray(seed._prpReferences.prpFiles) || seed._prpReferences.prpFiles.length === 0) {
    warnings.push('seed._prpReferences marked available but prpFiles array is empty')
  }

  return {
    fatal,
    warnings,
    stats: {
      timestamp: new Date().toISOString(),
      graphAvailable,
      layer1Count: l1.length,
      layer2Count: l2.length,
      totalTests: total,
      entityCount,
      hasAuth: !authMissing,
      hasAuthDiscovery: canRegister,
      hasPrps: Boolean(seed?._prpReferences?.available),
    },
  }
}

/**
 * Execute Phase 5A: Test Data Seeding
 */
// ---------------------------------------------------------------------------
// Staged Phase 5A (P2-2)
// ---------------------------------------------------------------------------

/**
 * Stage 1 payload: the _prpReferences block + the chosen source root.
 */
interface Stage1Payload {
  prpReferences: any  // matches loadPrpReferences output shape (seed._prpReferences)
  sourcePriority: 'prp' | 'openapi'
  sourceRoot: 'workspace' | 'outputDir' | 'none'
}

/**
 * Stage 2 payload: graph entities + phase analysis + business/Phase4 test cases.
 */
interface Stage2Payload {
  entities: any[]
  phaseAnalysis: PhaseAnalysis
  businessTestCases: BusinessTestCases
  generatedTestCases: any
  phase4TestCases: { layer1: any[]; layer2: any[] }
  graphAvailable: boolean
}

/**
 * Stage 1: Load PRP references (checks workspace first, then outputDir).
 */
async function runStage1_PRP(ctx: SystestContext, logsDir: string): Promise<Stage1Payload> {
  const cachePath = join(logsDir, 'phase5a_stage1_prp.json')
  const { hash } = fingerprintPrpFiles([ctx.workspace, ctx.outputDir])
  const inputHashes = { prpFiles: hash }

  return loadOrCompute<Stage1Payload>(
    1,
    'PRP load',
    cachePath,
    PHASE5A_STAGE_VERSION,
    inputHashes,
    () => {
      // Use a throwaway seed-like object to reuse loadPrpReferences side-effects.
      const tmp: any = {}
      loadPrpReferences(ctx.workspace, tmp)
      if (tmp._prpReferences?.available) {
        console.log('[Phase 5A:Stage 1/4] Found', tmp._prpReferences.prpFiles.length, 'PRP files in workspace — using as PRIMARY source')
        return {
          prpReferences: tmp._prpReferences,
          sourcePriority: 'prp',
          sourceRoot: 'workspace',
        }
      }
      loadPrpReferences(ctx.outputDir, tmp)
      if (tmp._prpReferences?.available) {
        console.log('[Phase 5A:Stage 1/4] Found', tmp._prpReferences.prpFiles.length, 'PRP files in outputDir')
        return {
          prpReferences: tmp._prpReferences,
          sourcePriority: 'prp',
          sourceRoot: 'outputDir',
        }
      }
      console.log('[Phase 5A:Stage 1/4] No PRPs found — source priority: openapi')
      return {
        prpReferences: tmp._prpReferences || { available: false },
        sourcePriority: 'openapi',
        sourceRoot: 'none',
      }
    },
  )
}

/**
 * Stage 2: Graph extraction — entities, phase analysis, business/Phase 4
 * test cases. These are all computed from on-disk artifacts whose mtimes
 * are fingerprinted.
 */
async function runStage2_Graph(ctx: SystestContext, logsDir: string): Promise<Stage2Payload> {
  const cachePath = join(logsDir, 'phase5a_stage2_graph.json')

  // NOTE: generated-test-cases.json intentionally excluded — Stage 3 (OpenAPI) rewrites
  // this file, which would cause Stage 2 to MISS on every subsequent run when backendUrl
  // is set. Stage 2's real dependency is the Phase 1-4 analysis artifacts below, which
  // are NOT touched by Stage 3.
  const fingerprintTargets = [
    join(ctx.workspace, 'graphify-out', 'graph.json'),
    join(ctx.outputDir, 'graphify-out', 'graph.json'),
    join(ctx.outputDir, 'config', 'phase1_analysis.json'),
    join(ctx.outputDir, 'config', 'design-analysis.json'),
    join(ctx.outputDir, 'config', 'phase2_analysis.json'),
    join(ctx.outputDir, 'config', 'architecture.json'),
  ]
  const inputHashes = { inputs: fingerprintFiles(fingerprintTargets) }

  const enhancer = getGraphEnhancer()
  const graphAvailable = enhancer.isAvailable()

  return loadOrCompute<Stage2Payload>(
    2,
    'Graph extraction',
    cachePath,
    PHASE5A_STAGE_VERSION,
    inputHashes,
    async () => {
      const entities = graphAvailable ? await enhancer.locateEntities() : []
      const phaseAnalysis = loadPhaseAnalysisOutput(ctx.outputDir)
      const businessTestCases = parseBusinessLogicTestCases(ctx.outputDir)
      const generatedTestCases = loadGeneratedTestCases(ctx.outputDir)
      const phase4TestCases = loadPhase4TestCases(ctx.outputDir)

      console.log('[Phase 5A:Stage 2/4] Loaded phase analysis:')
      console.log(`[Phase 5A:Stage 2/4]   Phase 1: ${phaseAnalysis.phase1 ? 'available' : 'missing'}`)
      console.log(`[Phase 5A:Stage 2/4]   Phase 2: ${phaseAnalysis.phase2 ? 'available' : 'missing'}`)
      console.log(`[Phase 5A:Stage 2/4]   Phase 4: ${phaseAnalysis.phase4 ? 'available' : 'missing'}`)
      console.log(`[Phase 5A:Stage 2/4]   Business logic tests (Phase 3): L1=${businessTestCases.layer1.length}, L2=${businessTestCases.layer2.length}`)
      console.log(`[Phase 5A:Stage 2/4]   Phase 4 test cases: L1=${phase4TestCases.layer1.length}, L2=${phase4TestCases.layer2.length}`)
      console.log(`[Phase 5A:Stage 2/4]   Graph entities: ${entities.length}`)

      return {
        entities,
        phaseAnalysis,
        businessTestCases,
        generatedTestCases,
        phase4TestCases,
        graphAvailable,
      }
    },
    // R1-M1 FIX: don't cache suspicious empty-entities result when graph was
    // supposedly available. Transient graph load failures would otherwise
    // stick empty result until unrelated inputs change.
    (payload) => !(payload.graphAvailable && payload.entities.length === 0),
  )
}

/**
 * Stage 3: OpenAPI discovery + enrichment. NO CACHE — backend state is
 * out-of-band, spec may change arbitrarily between runs.
 *
 * Runs discoverAuthEndpoints + enrichFromOpenApi against the provided seed
 * (which must already have base entities/test cases merged by stage 4).
 * This mutates `seed` in place, matching the pre-refactor behavior.
 */
async function runStage3_OpenAPI(ctx: SystestContext, seed: any): Promise<void> {
  if (!ctx.backendUrl) {
    console.log('[Phase 5A:Stage 3/4] OpenAPI enrichment: skipped (no backendUrl)')
    return
  }
  console.log('[Phase 5A:Stage 3/4] OpenAPI enrichment: re-running (no cache — backend state may change)')
  await discoverAuthEndpoints(ctx.backendUrl, seed)
  await enrichFromOpenApi(ctx.backendUrl, seed, ctx.outputDir)
}

/**
 * Stage 4: Merge stage outputs into the final seed, add DB introspection,
 * run quality gate, write `test_data_seed.json`.
 *
 * Returns the seed path on success, or throws on fatal quality errors.
 */
async function runStage4_Merge(
  ctx: SystestContext,
  stage1: Stage1Payload,
  stage2: Stage2Payload,
  logsDir: string,
): Promise<{ seedPath: string; seed: any }> {
  console.log('[Phase 5A:Stage 4/4] Merge + validate + write')

  // Prefer Phase 4 (real OpenAPI endpoints) over Phase 3 (may be generic)
  const { phase4TestCases, businessTestCases } = stage2
  const finalLayer1 = phase4TestCases.layer1.length > 0 ? phase4TestCases.layer1 : businessTestCases.layer1
  const finalLayer2 = phase4TestCases.layer2.length > 0 ? phase4TestCases.layer2 : businessTestCases.layer2
  const mergedTestCases: BusinessTestCases = { layer1: finalLayer1, layer2: finalLayer2 }

  console.log(`[Phase 5A:Stage 4/4]   Using: L1=${finalLayer1.length} (source: ${phase4TestCases.layer1.length > 0 ? 'Phase4' : 'Phase3'}), L2=${finalLayer2.length} (source: ${phase4TestCases.layer2.length > 0 ? 'Phase4' : 'Phase3'})`)

  // Generate test data seed with all enrichments
  const testDataSeed = generateTestDataSeed(ctx, stage2.entities, stage2.phaseAnalysis, mergedTestCases, stage2.generatedTestCases)

  // Post-process: rewrite _pathParams that were built with placeholder primaryKey='id'
  // to use each entity's actual primaryKey from the fully-built seed.entities map.
  const fixPathParams = (tests: any[]) => {
    for (const t of tests) {
      if (!t?._pathParams || !t?._entityContext) continue
      const realPk = lookupPrimaryKey(testDataSeed, t._entityContext)
      if (realPk === 'id') continue
      const rebuilt: Record<string, string> = {}
      for (const [param, ref] of Object.entries<string>(t._pathParams)) {
        if (typeof ref === 'string' && ref.includes(`$entities.${t._entityContext}.records[0].id`)) {
          rebuilt[param] = ref.replace('.records[0].id', `.records[0].${realPk}`)
        } else {
          rebuilt[param] = ref
        }
      }
      t._pathParams = rebuilt
    }
  }
  fixPathParams(testDataSeed.layer1Tests || [])
  fixPathParams(testDataSeed.layer2Tests || [])

  // Merge stage 1 PRP output into the seed
  testDataSeed._prpReferences = stage1.prpReferences
  testDataSeed._sourcePriority = stage1.sourcePriority

  // Stage 3: OpenAPI discovery + enrichment (cacheless; mutates seed)
  await runStage3_OpenAPI(ctx, testDataSeed)

  // DB introspection (fast, stateless — stays inline in stage 4 per design)
  await introspectDatabaseSchema(ctx.databaseUrl, testDataSeed)
  extractUserEntitiesFromGraph(ctx.graphEngine, testDataSeed)

  // Frontend route discovery (B1 fix). Phase 5C prompt reads
  // `seed.routes || seed.frontendRoutes || []`. Without this, the prompt ships
  // an empty routes list and the AI falls back to writing discovery helper
  // scripts (the airlinesys6 incident). We write `seed.frontendRoutes` so the
  // existing `seed.routes` fallback chain in buildPhase5CPrompt keeps working.
  //
  // Strategy: static analysis ONLY. Phase 5A runs before Phase 5B starts the
  // backend, and the frontend may not be running yet either — we must not
  // depend on browser navigation here (that is Phase 5C's job).
  //   1. If graphify engine is loaded, query `react_route` nodes (fast, exact).
  //   2. Otherwise parse `frontend/src/{App,routes,router,main}.{tsx,ts,jsx,js}`
  //      and `frontend/src/{routes,pages}/**` with a regex fallback.
  //
  // Shape: `seed.frontendRoutes` = Array<{ path, component?, source }>.
  // On failure or no frontend, set to [] explicitly so downstream knows it
  // has been attempted (vs. silently undefined).
  try {
    const routes = await discoverFrontendRoutesForSeed(ctx)
    testDataSeed.frontendRoutes = routes
    console.log(`[Phase 5A:Stage 4/4] Frontend routes discovered: ${routes.length}`)
    if (routes.length > 0 && routes.length <= 5) {
      for (const r of routes) console.log(`[Phase 5A:Stage 4/4]   - ${r.path}${r.component ? ` -> ${r.component}` : ''} (${r.source})`)
    } else if (routes.length > 5) {
      console.log(`[Phase 5A:Stage 4/4]   e.g. ${routes.slice(0, 3).map(r => r.path).join(', ')}, ... (+${routes.length - 3} more)`)
    }
  } catch (e) {
    console.warn(`[Phase 5A:Stage 4/4] Frontend route discovery failed: ${(e as Error).message}`)
    testDataSeed.frontendRoutes = []
  }

  // Compute reproducibility metadata (P2-1): runId is unique per invocation,
  // seedHash is deterministic across runs with the same inputs. Must happen
  // AFTER Stage 3 (OpenAPI) and DB introspection so all inputs are available.
  testDataSeed._runId = generateRunId()
  testDataSeed._seedHash = computeSeedHash({
    workspace: ctx.workspace,
    prpFiles: testDataSeed._prpReferences?.prpFiles,
    // Trim to 10000 chars at source — computeSeedHash re-trims to 10000 internally,
    // so there's no reason to materialize a 50000-char substring first.
    openApiSpecText: testDataSeed._openApiSpec ? JSON.stringify(testDataSeed._openApiSpec).substring(0, 10000) : null,
    dbSchemaText: testDataSeed._dbSchema ? JSON.stringify(testDataSeed._dbSchema) : null,
    graphNodeCount: stage2.entities.length,
  })
  console.log(`[Phase 5A:Stage 4/4] Reproducibility: runId=${testDataSeed._runId}, seedHash=${testDataSeed._seedHash}`)

  // Quality gate
  const seedPath = join(logsDir, 'test_data_seed.json')
  const qualityReport = validateSeedQuality(testDataSeed, stage2.graphAvailable)
  const qualityReportPath = join(logsDir, 'phase5a_quality_report.json')
  let qualityReportWritten = true
  try {
    writeFileSync(qualityReportPath, JSON.stringify(qualityReport, null, 2))
  } catch (e) {
    qualityReportWritten = false
    console.warn('[Phase 5A:Stage 4/4] Failed to write quality report:', e)
  }

  if (qualityReport.fatal.length > 0) {
    console.error(`[Phase 5A:Stage 4/4] Quality: ${qualityReport.fatal.length} fatal errors — blocking Phase 5B`)
    for (const err of qualityReport.fatal) console.error(`[Phase 5A:Stage 4/4]   FATAL: ${err}`)
    for (const w of qualityReport.warnings) console.warn(`[Phase 5A:Stage 4/4]   WARN : ${w}`)
    // Remove any stale seed from a prior (successful) run.
    try {
      if (existsSync(seedPath)) {
        unlinkSync(seedPath)
        console.warn(`[Phase 5A:Stage 4/4] Removed stale seed file to prevent confusion: ${seedPath}`)
      }
    } catch (e) {
      console.warn('[Phase 5A:Stage 4/4] Failed to remove stale seed file:', e)
    }
    const reportRef = qualityReportWritten
      ? `See ${qualityReportPath}.`
      : '(quality report write failed — see stderr above).'
    const err: any = new Error(
      `Phase 5A quality gate failed: ${qualityReport.fatal.length} fatal error(s). ${reportRef} First: ${qualityReport.fatal[0]}`,
    )
    err._phase5aFatal = true
    throw err
  }
  if (qualityReport.warnings.length > 0) {
    console.warn(`[Phase 5A:Stage 4/4] Quality: ${qualityReport.warnings.length} non-fatal warning(s)`)
    for (const w of qualityReport.warnings) console.warn(`[Phase 5A:Stage 4/4]   WARN: ${w}`)
  } else {
    console.log('[Phase 5A:Stage 4/4] Quality gate: OK')
  }

  writeFileSync(seedPath, JSON.stringify(testDataSeed, null, 2))

  console.log(`[Phase 5A:Stage 4/4] Generated test_data_seed.json: ${seedPath}`)
  console.log(`[Phase 5A:Stage 4/4]   Entities: ${Object.keys(testDataSeed.entities).length}`)
  console.log(`[Phase 5A:Stage 4/4]   Layer 1 tests: ${testDataSeed.layer1Tests.length}`)
  console.log(`[Phase 5A:Stage 4/4]   Layer 2 tests: ${testDataSeed.layer2Tests.length}`)
  console.log(`[Phase 5A:Stage 4/4]   Validation scenarios: ${testDataSeed.scenarios.validation.length}`)
  console.log(`[Phase 5A:Stage 4/4]   Authorization scenarios: ${testDataSeed.scenarios.authorization.length}`)
  console.log(`[Phase 5A:Stage 4/4]   Constraint scenarios: ${testDataSeed.scenarios.constraints.length}`)
  console.log(`[Phase 5A:Stage 4/4]   State transition scenarios: ${testDataSeed.scenarios.stateTransitions.length}`)
  console.log(`[Phase 5A:Stage 4/4]   Edge case scenarios: ${testDataSeed.scenarios.edgeCases.length}`)
  console.log(`[Phase 5A:Stage 4/4]   Integration flow scenarios: ${testDataSeed.scenarios.integrationFlows.length}`)

  return { seedPath, seed: testDataSeed }
}

export async function executePhase5A(ctx: SystestContext): Promise<PhaseResult> {
  const startTime = Date.now()
  const outputs: string[] = []

  try {
    // Ensure output directories exist
    const logsDir = join(ctx.outputDir, 'test-logs')
    try { mkdirSync(logsDir, { recursive: true }) } catch {}

    // Stage 1: PRP load (cached on PRP file mtimes)
    const stage1 = await runStage1_PRP(ctx, logsDir)

    // Stage 2: Graph extraction + phase analysis (cached on input mtimes)
    const stage2 = await runStage2_Graph(ctx, logsDir)

    // Stages 3 + 4: OpenAPI (cacheless) + merge/validate/write
    const { seedPath } = await runStage4_Merge(ctx, stage1, stage2, logsDir)

    outputs.push(seedPath)

    return {
      status: 'completed',
      outputs,
      duration: Date.now() - startTime,
      graphEnhanced: stage2.graphAvailable,
    } as PhaseResult
  } catch (error) {
    return {
      status: 'failed',
      outputs,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ---------------------------------------------------------------------------
// Phase output loaders
// ---------------------------------------------------------------------------

function loadPhaseAnalysisOutput(outputDir: string): PhaseAnalysis {
  const result: PhaseAnalysis = { phase1: null, phase2: null, phase4: null }

  // Phase 1: design analysis
  const phase1Paths = [
    join(outputDir, 'config', 'phase1_analysis.json'),
    join(outputDir, 'config', 'design-analysis.json'),
  ]
  for (const p of phase1Paths) {
    if (existsSync(p)) {
      try { result.phase1 = JSON.parse(readFileSync(p, 'utf-8')); break } catch {}
    }
  }

  // Phase 2: project structure
  const phase2Paths = [
    join(outputDir, 'config', 'phase2_analysis.json'),
    join(outputDir, 'config', 'project-structure.json'),
  ]
  for (const p of phase2Paths) {
    if (existsSync(p)) {
      try { result.phase2 = JSON.parse(readFileSync(p, 'utf-8')); break } catch {}
    }
  }

  // Phase 4: architecture + test cases
  const phase4Paths = [
    join(outputDir, 'config', 'architecture.json'),
  ]
  for (const p of phase4Paths) {
    if (existsSync(p)) {
      try { result.phase4 = JSON.parse(readFileSync(p, 'utf-8')); break } catch {}
    }
  }

  return result
}

function loadGeneratedTestCases(outputDir: string): any {
  const tcPath = join(outputDir, 'test-cases', 'generated-test-cases.json')
  if (!existsSync(tcPath)) return null
  try {
    return JSON.parse(readFileSync(tcPath, 'utf-8'))
  } catch {
    return null
  }
}

function loadPhase4TestCases(outputDir: string): { layer1: any[], layer2: any[] } {
  const path = join(outputDir, 'test-cases', 'generated-test-cases.json')
  if (!existsSync(path)) return { layer1: [], layer2: [] }

  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    const layer1: any[] = []
    const layer2: any[] = []

    // Convert apiTests to Layer 1 format
    for (const test of (data.apiTests || [])) {
      const entityContext = inferEntityContext(test.endpoint)
      layer1.push({
        'Test ID': test.id,
        'Test Name': test.description || (test.method + ' ' + test.endpoint),
        'Endpoint': test.endpoint,
        'Method': test.method,
        'Expected': String(test.expectedStatus || 200),
        'Priority': test.priority || 'P0',
        '_requestBody': test.requestBody,
        '_expectedResponseSchema': test.responseSchema || test.expectedResponse || test._expectedResponseSchema,
        '_auth': test.auth,
        '_authRole': inferAuthRole(test.method, test.endpoint, test.auth && test.auth !== 'none'),
        '_entityContext': entityContext,
        '_pathParams': extractPathParams(test.endpoint, entityContext, 'id'),
        '_tags': test.tags,
      })
    }

    // Convert authTests to Layer 2
    for (const test of (data.authTests || [])) {
      layer2.push({
        'Test ID': test.id,
        'Test Name': test.description,
        'Endpoint': test.endpoint,
        'Method': test.method || 'GET',
        'Expected': String(test.expectedStatus || 401),
        'Priority': test.priority || 'P0',
        '_category': 'auth',
        '_auth': test.auth,
        '_authRole': 'none',  // auth tests test the 401 response, so no token
        '_entityContext': inferEntityContext(test.endpoint),
      })
    }

    // Convert validationTests to Layer 2
    for (const test of (data.validationTests || [])) {
      layer2.push({
        'Test ID': test.id,
        'Test Name': test.description,
        'Endpoint': test.endpoint,
        'Method': test.method || 'POST',
        'Expected': String(test.expectedStatus || 422),
        'Priority': test.priority || 'P1',
        '_category': 'validation',
        'Input': JSON.stringify(test.requestBody || test.invalidBody),
        '_authRole': inferAuthRole(test.method || 'POST', test.endpoint, test.auth && test.auth !== 'none'),
        '_entityContext': inferEntityContext(test.endpoint),
      })
    }

    // Convert entityTests to Layer 1
    for (const test of (data.entityTests || [])) {
      layer1.push({
        'Test ID': test.id,
        'Test Name': test.description || (test.method + ' ' + test.endpoint),
        'Endpoint': test.endpoint,
        'Method': test.method,
        'Expected': String(test.expectedStatus || 200),
        'Priority': test.priority || 'P1',
        '_expectedResponseSchema': test.responseSchema || test.expectedResponse || test._expectedResponseSchema,
        '_authRole': inferAuthRole(test.method, test.endpoint, true),
        '_entityContext': inferEntityContext(test.endpoint),
      })
    }

    // Convert edgeTests to Layer 2
    for (const test of (data.edgeCaseTests || data.edgeTests || [])) {
      layer2.push({
        'Test ID': test.id,
        'Test Name': test.description,
        'Endpoint': test.endpoint,
        'Method': test.method || 'POST',
        'Expected': String(test.expectedStatus || 400),
        'Priority': test.priority || 'P3',
        '_category': 'edge',
        'Input': JSON.stringify(test.requestBody || test.invalidBody),
        '_authRole': inferAuthRole(test.method || 'GET', test.endpoint, test.auth && test.auth !== 'none'),
        '_entityContext': inferEntityContext(test.endpoint),
      })
    }

    console.log('[Phase 5A] Loaded Phase 4 test cases: L1=' + layer1.length + ', L2=' + layer2.length)
    return { layer1, layer2 }
  } catch (error) {
    console.warn('[Phase 5A] Failed to load Phase 4 test cases:', error)
    return { layer1: [], layer2: [] }
  }
}

function parseBusinessLogicTestCases(outputDir: string): BusinessTestCases {
  try {
    let testCasesPath = join(outputDir, 'config', 'BUSINESS_LOGIC_TESTCASES.md')
    if (!existsSync(testCasesPath)) {
      testCasesPath = join(outputDir, 'BUSINESS_LOGIC_TESTCASES.md')
    }

    if (!existsSync(testCasesPath)) {
      console.warn('[Phase 5A] BUSINESS_LOGIC_TESTCASES.md not found')
      return { layer1: [], layer2: [] }
    }

    const content = readFileSync(testCasesPath, 'utf-8')
    const layer1: any[] = []
    const layer2: any[] = []

    const lines = content.split('\n')
    let currentTable = ''
    let headers: string[] = []
    let inTable = false
    let currentL2Category = ''

    for (const line of lines) {
      if (line.startsWith('## Layer 1')) {
        currentTable = 'layer1'
        inTable = false
        headers = []
        continue
      }
      if (line.startsWith('## Layer 2')) {
        currentTable = 'layer2'
        inTable = false
        headers = []
        currentL2Category = ''
        continue
      }

      // Detect L2 subsections by ### heading
      const sectionMatch = line.match(/^###\s+(.+)/)
      if (sectionMatch && currentTable === 'layer2') {
        const heading = sectionMatch[1].toLowerCase()
        // Derive category from heading keywords — generic matching
        if (heading.includes('auth')) currentL2Category = 'auth'
        else if (heading.includes('valid')) currentL2Category = 'validation'
        else if (heading.includes('constr')) currentL2Category = 'constraint'
        else if (heading.includes('state') || heading.includes('transition')) currentL2Category = 'state'
        else if (heading.includes('edge') || heading.includes('secur')) currentL2Category = 'edge'
        else if (heading.includes('integr') || heading.includes('flow')) currentL2Category = 'integration'
        else currentL2Category = heading.replace(/\s+tests?$/i, '').replace(/\s+/g, '-').trim()

        // New subsection means new headers — reset
        inTable = false
        headers = []
      }

      if (line.match(/^\|.*\|$/)) {
        const cells = line.split('|').filter((_, i) => i > 0 && i < line.split('|').length - 1).map(c => c.trim())

        if (!inTable && cells.length > 0 && /[a-zA-Z]/.test(cells[0])) {
          headers = cells
        }

        if (/^[\|\- ]+$/.test(line) && line.includes('-')) {
          inTable = true
          continue
        }

        if (inTable && headers.length > 0 && currentTable) {
          const row: any = {}
          headers.forEach((h, i) => {
            row[h] = cells[i] || ''
          })

          if (currentTable === 'layer1') {
            layer1.push(row)
          } else if (currentTable === 'layer2') {
            row['_category'] = currentL2Category
            layer2.push(row)
          }
        }
      }
    }

    console.log(`[Phase 5A] Parsed ${layer1.length} Layer 1 tests, ${layer2.length} Layer 2 tests`)
    return { layer1, layer2 }
  } catch (error) {
    console.warn('[Phase 5A] Failed to parse BUSINESS_LOGIC_TESTCASES.md:', error)
    return { layer1: [], layer2: [] }
  }
}

// ---------------------------------------------------------------------------
// Auth endpoint discovery (no registration — AI handles that in Phase 5A)
// ---------------------------------------------------------------------------

/**
 * Discovers register/login endpoints and their schemas from OpenAPI spec.
 * Does NOT perform registration — AI will handle that in Phase 5A based on
 * the collected raw data.
 */
async function discoverAuthEndpoints(
  backendUrl: string | undefined,
  seed: any,
): Promise<void> {
  if (!backendUrl) return

  let spec: any = null
  const specUrls = ['/openapi.json', '/swagger.json', '/api-docs']
  for (const url of specUrls) {
    try {
      const res = await fetch(backendUrl + url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      spec = await res.json()
      if (spec?.paths) break
    } catch {}
  }

  if (!spec?.paths) {
    seed._authDiscovery = { available: false, reason: 'OpenAPI spec not reachable' }
    return
  }

  // Segment-based matchers: avoid substring traps like /logout matching "log"
  const isLoginEndpoint = (pathStr: string, method?: string): boolean => {
    const segments = pathStr.toLowerCase().split('/').filter(Boolean)
    const hasLogin = segments.some(s =>
      s === 'login' || s === 'signin' || s === 'sign-in' || s === 'authenticate' || s === 'token'
    )
    const hasLogout = segments.some(s =>
      s === 'logout' || s === 'signout' || s === 'sign-out' || s === 'loggedout' || s === 'logged-out'
    )
    if (hasLogout) return false
    if (!hasLogin) return false
    if (method && !['post', 'get'].includes(method.toLowerCase())) return false
    return true
  }

  const isRegisterEndpoint = (pathStr: string, method?: string): boolean => {
    const segments = pathStr.toLowerCase().split('/').filter(Boolean)
    // Disqualify paths whose terminal segment is an auth verb — `/api/users/login`
    // would otherwise double-classify as both login AND register (since `users` is
    // a register hint). Login verbs always win for the terminal segment.
    const lastSeg = segments[segments.length - 1] ?? ''
    const authVerbs = ['login', 'signin', 'sign-in', 'authenticate', 'token',
                       'logout', 'signout', 'sign-out', 'refresh', 'me',
                       'verify', 'reset', 'forgot', 'forgot-password']
    if (authVerbs.includes(lastSeg)) return false
    const hasRegister = segments.some(s =>
      s === 'register' || s === 'signup' || s === 'sign-up' || s === 'users' || s === 'user' ||
      s === 'create' || s === 'new-user'
    )
    if (!hasRegister) return false
    if (method && method.toLowerCase() !== 'post') return false
    return true
  }

  // Score helper: prefer POST > GET, /auth/ present, shorter paths
  const scoreCandidate = (pathStr: string, method: string): number => {
    const segments = pathStr.toLowerCase().split('/').filter(Boolean)
    let score = 0
    if (method.toLowerCase() === 'post') score += 10
    else if (method.toLowerCase() === 'get') score += 3
    if (segments.includes('auth')) score += 5
    // Shorter paths preferred
    score -= segments.length
    return score
  }

  type Candidate = { path: string; method: string; score: number; op: any }
  const loginCandidates: Candidate[] = []
  const registerCandidates: Candidate[] = []

  for (const [path, methods] of Object.entries<any>(spec.paths || {})) {
    for (const [method, op] of Object.entries<any>(methods || {})) {
      if (!op || typeof op !== 'object') continue
      if (isLoginEndpoint(path, method)) {
        loginCandidates.push({ path, method, score: scoreCandidate(path, method), op })
      }
      if (isRegisterEndpoint(path, method)) {
        registerCandidates.push({ path, method, score: scoreCandidate(path, method), op })
      }
    }
  }

  loginCandidates.sort((a, b) => b.score - a.score)
  registerCandidates.sort((a, b) => b.score - a.score)

  const bestLogin = loginCandidates[0]
  const bestRegister = registerCandidates[0]

  seed._authDiscovery = {
    available: true,
    registerEndpoint: bestRegister?.path || null,
    registerSchema: bestRegister ? extractRequestSchema(bestRegister.op, spec) : null,
    loginEndpoint: bestLogin?.path || null,
    loginSchema: bestLogin ? extractRequestSchema(bestLogin.op, spec) : null,
  }
}

function extractRequestSchema(operation: any, spec: any): any {
  const content = operation?.requestBody?.content
  if (!content) return null
  const json = content['application/json'] || Object.values(content)[0]
  let schema = (json as any)?.schema
  if (!schema) return null
  // Resolve top-level $ref once (simple resolver, no deep recursion)
  if (schema.$ref && typeof schema.$ref === 'string') {
    const refPath = schema.$ref.replace(/^#\//, '').split('/')
    let node: any = spec
    for (const p of refPath) node = node?.[p]
    if (node) schema = node
  }
  return schema
}

// ---------------------------------------------------------------------------
// PRP / DB schema / graph-entity collection for AI consumption
// ---------------------------------------------------------------------------

/**
 * Load PRP design documents from {workspace}/.project/prps/ if they exist.
 * PRPs are the AUTHORITATIVE source of truth for business rules, role models,
 * and success criteria. They take priority over OpenAPI / DB schema / graph.
 */
function loadPrpReferences(workspaceOrOutput: string, seed: any): void {
  const prpDir = join(workspaceOrOutput, '.project', 'prps')
  if (!existsSync(prpDir)) {
    seed._prpReferences = { available: false }
    return
  }

  try {
    const allMd = readdirSync(prpDir).filter(f => f.toLowerCase().endsWith('.md'))
    const metaFiles = new Set(['MODULE_INDEX.md', 'FRONTEND_DESIGN.md', 'RAW_GRAPH_SUMMARY.md'].map(f => f.toLowerCase()))
    const prpFiles = allMd
      .filter(f => !metaFiles.has(f.toLowerCase()))
      .sort()
      .map(f => {
        // Only store path + first-section headers to keep seed JSON small.
        // AI Read()s the full file on demand via the .path field.
        let headers = ''
        try {
          const raw = readFileSync(join(prpDir, f), 'utf-8')
          // Keep only section headers (## ...) and the first 2KB for quick preview
          const headerLines = raw.split('\n').filter(l => /^#{1,3} /.test(l)).slice(0, 20)
          headers = headerLines.join('\n').slice(0, 2048)
        } catch {}
        return {
          name: f.replace(/\.md$/i, ''),
          path: join(prpDir, f).replace(/\\/g, '/'),
          headers,  // for AI preview; use .path to Read() full content
        }
      })

    if (prpFiles.length === 0) {
      seed._prpReferences = { available: false, reason: 'No PRP-*.md files found' }
      return
    }

    const moduleIndex = existsSync(join(prpDir, 'MODULE_INDEX.md'))
      ? readFileSync(join(prpDir, 'MODULE_INDEX.md'), 'utf-8')
      : null
    const frontendDesign = existsSync(join(prpDir, 'FRONTEND_DESIGN.md'))
      ? readFileSync(join(prpDir, 'FRONTEND_DESIGN.md'), 'utf-8')
      : null

    const doneDir = join(prpDir, 'done')
    let completedPrps: Array<{ name: string; jsonPath: string }> = []
    if (existsSync(doneDir)) {
      completedPrps = readdirSync(doneDir)
        .filter(f => f.endsWith('.completion.json'))
        .map(f => ({
          name: f.replace(/\.completion\.json$/, ''),
          jsonPath: join(doneDir, f).replace(/\\/g, '/'),
        }))
    }

    seed._prpReferences = {
      available: true,
      prpDir: prpDir.replace(/\\/g, '/'),
      prpFiles,
      moduleIndex,
      frontendDesign,
      completedPrps,
    }
  } catch (e) {
    seed._prpReferences = { available: false, reason: 'Error loading PRPs: ' + (e instanceof Error ? e.message : String(e)) }
  }
}

// ---------------------------------------------------------------------------
// Database introspection
// ---------------------------------------------------------------------------

type DbDriver = 'mysql' | 'postgres' | 'sqlite' | 'unknown'

interface ParsedDbUrl {
  driver: DbDriver
  host: string
  port: number
  user: string
  password: string
  database: string
}

const TABLE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/
const USER_TABLE_NAME_PATTERNS = [
  'users', 'user', 'employees', 'employee', 'staff', 'members', 'member',
  'accounts', 'account', 'customers', 'customer', 'patients', 'patient',
  'doctors', 'doctor', 'teachers', 'teacher', 'students', 'student',
]

function parseDatabaseUrl(url: string): ParsedDbUrl | null {
  try {
    // Match scheme (with optional +driver), user:pass@host:port/db
    // e.g. mysql+pymysql://u:p@h:3306/d, postgresql+asyncpg://..., sqlite:///path
    const schemeMatch = url.match(/^([a-zA-Z0-9+]+):\/\//)
    if (!schemeMatch) return null
    const scheme = schemeMatch[1]!.toLowerCase()
    const base = scheme.split('+')[0]!
    let driver: DbDriver = 'unknown'
    if (base === 'mysql' || base === 'mariadb') driver = 'mysql'
    else if (base === 'postgres' || base === 'postgresql') driver = 'postgres'
    else if (base === 'sqlite') driver = 'sqlite'

    if (driver === 'sqlite') {
      return { driver, host: '', port: 0, user: '', password: '', database: url.replace(/^sqlite[^:]*:\/\//, '') }
    }

    // Parse user:pass@host:port/db[?...]
    const rest = url.slice(schemeMatch[0].length)
    const m = rest.match(/^([^:/@]+):([^@]*)@([^:/]+):(\d+)\/([^?]+)/)
    if (!m) return null
    return {
      driver,
      user: decodeURIComponent(m[1]!),
      password: decodeURIComponent(m[2]!),
      host: m[3]!,
      port: parseInt(m[4]!, 10),
      database: m[5]!,
    }
  } catch {
    return null
  }
}

function shellQuote(s: string): string {
  // Cross-platform safe single-arg quoting. On Windows, wrap in double quotes and escape.
  if (process.platform === 'win32') {
    return `"${s.replace(/(["\\])/g, '\\$1')}"`
  }
  return `'${s.replace(/'/g, `'\\''`)}'`
}

function buildListTablesCommand(conn: ParsedDbUrl): { cmd: string; env: NodeJS.ProcessEnv } {
  const env = { ...process.env }
  if (conn.driver === 'mysql') {
    // SECURITY: use MYSQL_PWD env var instead of -p<PASS> inline to avoid
    // password leakage via ps/tasklist. Also avoids shellQuote → literal-quotes
    // bug on Windows (cmd.exe treats double-quotes as part of password).
    env.MYSQL_PWD = conn.password
    const cmd = [
      'mysql',
      '-h', shellQuote(conn.host),
      '-P', String(conn.port),
      '-u', shellQuote(conn.user),
      shellQuote(conn.database),
      '-N', '-B',
      '-e', shellQuote('SHOW TABLES;'),
    ].join(' ')
    return { cmd, env }
  }
  // postgres
  env.PGPASSWORD = conn.password
  const cmd = [
    'psql',
    '-h', shellQuote(conn.host),
    '-p', String(conn.port),
    '-U', shellQuote(conn.user),
    '-d', shellQuote(conn.database),
    '-t', '-A',
    '-c', shellQuote(`SELECT tablename FROM pg_tables WHERE schemaname='public'`),
  ].join(' ')
  return { cmd, env }
}

function buildDescribeCommand(conn: ParsedDbUrl, table: string): { cmd: string; env: NodeJS.ProcessEnv } {
  const env = { ...process.env }
  if (conn.driver === 'mysql') {
    // SECURITY: MYSQL_PWD env instead of -p<PASS> inline (see buildListTablesCommand).
    env.MYSQL_PWD = conn.password
    const cmd = [
      'mysql',
      '-h', shellQuote(conn.host),
      '-P', String(conn.port),
      '-u', shellQuote(conn.user),
      shellQuote(conn.database),
      '-N', '-B',
      '-e', shellQuote(`DESCRIBE \`${table}\`;`),
    ].join(' ')
    return { cmd, env }
  }
  env.PGPASSWORD = conn.password
  // SECURITY: `table` MUST be validated by TABLE_NAME_RE at the call site (line
  // identifyUserTables caller) before reaching here. The regex restricts to
  // `[a-zA-Z_][a-zA-Z0-9_]{0,63}` so SQL injection is blocked. DO NOT remove
  // that guard — this interpolation relies on it.
  const cmd = [
    'psql',
    '-h', shellQuote(conn.host),
    '-p', String(conn.port),
    '-U', shellQuote(conn.user),
    '-d', shellQuote(conn.database),
    '-t', '-A',
    '-c', shellQuote(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}'`),
  ].join(' ')
  return { cmd, env }
}

async function listTablesViaCliWithTimeout(
  conn: ParsedDbUrl | null,
  timeoutMs: number,
): Promise<string[] | null> {
  if (!conn || conn.driver === 'unknown' || conn.driver === 'sqlite') return null
  const { cmd, env } = buildListTablesCommand(conn)
  try {
    const { stdout } = await execAsync(cmd, { timeout: timeoutMs, env, windowsHide: true, maxBuffer: 4 * 1024 * 1024 })
    const tables = stdout
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && TABLE_NAME_RE.test(l.split(/\s+/)[0]!))
      .map(l => l.split(/\s+/)[0]!)
    // Dedupe
    return Array.from(new Set(tables))
  } catch {
    // Timeout, CLI missing (ENOENT), auth failure, network unreachable — all treated as null
    return null
  }
}

async function describeTableColumns(
  conn: ParsedDbUrl,
  table: string,
  timeoutMs: number,
): Promise<string[] | null> {
  if (!TABLE_NAME_RE.test(table)) return null
  const { cmd, env } = buildDescribeCommand(conn, table)
  try {
    const { stdout } = await execAsync(cmd, { timeout: timeoutMs, env, windowsHide: true, maxBuffer: 2 * 1024 * 1024 })
    return stdout
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(l => l.split(/\s+|\|/)[0]!.toLowerCase())
      .filter(c => /^[a-z_][a-z0-9_]*$/i.test(c))
  } catch {
    return null
  }
}

async function identifyUserTables(
  conn: ParsedDbUrl,
  tables: string[],
  timeoutMs: number,
): Promise<string[]> {
  // Priority 1: name pattern match (ordered by pattern list, pattern first)
  const nameMatches: string[] = []
  for (const pat of USER_TABLE_NAME_PATTERNS) {
    for (const t of tables) {
      if (t.toLowerCase() === pat && !nameMatches.includes(t)) nameMatches.push(t)
    }
  }
  // Also partial matches
  for (const t of tables) {
    const tl = t.toLowerCase()
    if (nameMatches.includes(t)) continue
    if (USER_TABLE_NAME_PATTERNS.some(p => tl.includes(p))) nameMatches.push(t)
  }

  // Priority 2/3: describe candidate tables and check columns.
  // Consider name-matched tables + up to 10 others (bounded for time).
  const candidates = [...nameMatches]
  for (const t of tables) {
    if (candidates.length >= 20) break
    if (!candidates.includes(t)) candidates.push(t)
  }

  const scored: Array<{ table: string; score: number }> = []
  for (const t of candidates) {
    const cols = await describeTableColumns(conn, t, timeoutMs)
    if (!cols) {
      // Describe failed/timed out — still include if name matched
      if (nameMatches.includes(t)) scored.push({ table: t, score: 1 })
      continue
    }
    const hasEmail = cols.some(c => c === 'email' || c === 'mail' || c === 'email_address')
    const hasPassword = cols.some(c => c === 'password' || c === 'password_hash' || c === 'passwd' || c === 'hashed_password')
    let score = 0
    if (nameMatches.includes(t)) score += 2
    if (hasEmail && hasPassword) score += 5
    else if (hasPassword) score += 3
    else if (hasEmail) score += 1
    if (score > 0) scored.push({ table: t, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.table)
}

async function introspectDatabaseSchema(
  databaseUrl: string | undefined,
  seed: any,
): Promise<void> {
  if (!databaseUrl) {
    seed._dbSchema = { available: false, reason: 'No database URL provided' }
    return
  }

  // Mask password for any logging / stored output.
  const maskedUrl = databaseUrl.replace(/:\/\/([^:/@]+):[^@]+@/, '://$1:****@')

  const parsed = parseDatabaseUrl(databaseUrl)
  if (!parsed) {
    seed._dbSchema = {
      available: false,
      reason: 'Could not parse database URL (expected format: scheme+driver://user:pass@host:port/db)',
      connectionUrl: maskedUrl,
    }
    return
  }

  if (parsed.driver === 'sqlite') {
    seed._dbSchema = {
      available: false,
      reason: 'SQLite introspection skipped — check migration files or ORM models',
      connectionUrl: maskedUrl,
      driver: 'sqlite',
    }
    return
  }

  if (parsed.driver === 'unknown') {
    seed._dbSchema = {
      available: false,
      reason: `Unknown DB driver (scheme not recognized as mysql/postgres/sqlite)`,
      connectionUrl: maskedUrl,
    }
    return
  }

  try {
    const tables = await listTablesViaCliWithTimeout(parsed, 10_000)
    if (!tables) {
      seed._dbSchema = {
        available: false,
        reason: 'DB introspection timed out after 10s OR CLI tool (mysql/psql) not installed / DB unreachable',
        connectionUrl: maskedUrl,
        driver: parsed.driver,
        _fallback_userTableHints: ['users', 'user', 'employees', 'members', 'accounts'],
      }
      return
    }

    const userTables = await identifyUserTables(parsed, tables, 2_000)

    seed._dbSchema = {
      available: true,
      connectionUrl: maskedUrl,
      driver: parsed.driver,
      database: parsed.database,
      allTables: tables,
      userTableHints: userTables,
      _introspectedAt: new Date().toISOString(),
      _hint_admin: 'After creating a user via register API, UPDATE {table} SET role="admin" WHERE email="..."',
    }
  } catch (e) {
    // Never surface the raw error if it might echo the command (with password). Filter.
    const rawMsg = e instanceof Error ? e.message : String(e)
    const safeMsg = rawMsg.replace(/-p\S+/g, '-p****').replace(/PGPASSWORD=\S+/g, 'PGPASSWORD=****')
    seed._dbSchema = {
      available: false,
      reason: `DB introspection failed: ${safeMsg}`,
      connectionUrl: maskedUrl,
    }
  }
}

function extractUserEntitiesFromGraph(graphEngine: any, seed: any): void {
  if (!graphEngine) {
    seed._graphEntities = { available: false, reason: 'Graph engine unavailable' }
    return
  }

  try {
    // Expanded vocabulary: cover employee/worker/staff/member domains + auth terms
    const queryTerms = [
      'user', 'users',
      'employee', 'employees', 'worker', 'staff',
      'account', 'accounts', 'customer', 'customers',
      'member', 'members', 'patron', 'client', 'clients',
      'doctor', 'patient', 'nurse',
      'teacher', 'student', 'instructor',
      'admin', 'administrator',
      'person', 'people', 'profile',
    ].join(' ')
    const candidates = graphEngine.query?.(queryTerms, 'bfs', 30) ?? { nodes: [] }

    const entityKinds = ['class', 'schema', 'entity', 'table', 'model', 'struct', 'interface', 'type', 'dataclass', 'record']
    const fieldKinds = ['field', 'column', 'property', 'attribute']

    const kindMatches = (candidates.nodes || []).filter((n: any) =>
      entityKinds.includes(n.kind)
    )

    const scored = kindMatches.map((n: any) => {
      const neighbors = graphEngine.getNeighbors?.(n.label, 1) ?? { successors: [] }
      const fields = (neighbors.successors || [])
        .filter((f: any) => fieldKinds.includes(f.kind))
        .map((f: any) => ({ name: String(f.label || ''), type: f.fieldType || f.type || 'unknown' }))
      const fieldNames = fields.map((f: any) => f.name.toLowerCase())
      const hasEmail = fieldNames.some((fn: string) => /email|mail/.test(fn))
      const hasPassword = fieldNames.some((fn: string) => /password|passwd|passhash/.test(fn))
      const hasUsername = fieldNames.some((fn: string) => /username|login/.test(fn))
      const hasId = fieldNames.some((fn: string) => /id$|^id$/.test(fn))
      let score = 0
      if (hasEmail) score += 2
      if (hasPassword) score += 3  // strongest signal
      if (hasUsername) score += 1
      if (hasId) score += 1
      const lbl = String(n.label || '').toLowerCase()
      if (/^(user|account|member|customer|client|employee|staff|worker|patron|doctor|patient)s?$/.test(lbl)) score += 2
      return { node: n, fields, score, hasEmail, hasPassword }
    })

    const userLike = scored
      .filter((s: any) => s.score >= 2 || (s.hasPassword && s.hasEmail))
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 10)

    // Column-based fallback: if the kind-matches returned nothing, scan all classes for password+email
    let fallbackAttempted = false
    let finalList: any[] = userLike
    if (userLike.length === 0) {
      fallbackAttempted = true
      const allClasses = graphEngine.query?.('', 'bfs', 200) ?? { nodes: [] }
      const classes = (allClasses.nodes || []).filter((n: any) =>
        ['class', 'schema', 'entity', 'model', 'struct', 'dataclass'].includes(n.kind)
      )
      const passwordBearing = classes
        .map((n: any) => {
          const neighbors = graphEngine.getNeighbors?.(n.label, 1) ?? { successors: [] }
          const fields = (neighbors.successors || [])
            .filter((f: any) => fieldKinds.includes(f.kind))
            .map((f: any) => ({ name: String(f.label || ''), type: f.fieldType || f.type || 'unknown' }))
          const fieldNames = fields.map((f: any) => f.name.toLowerCase())
          return {
            node: n,
            fields,
            hasEmail: fieldNames.some((fn: string) => /email|mail/.test(fn)),
            hasPassword: fieldNames.some((fn: string) => /password|passwd|passhash/.test(fn)),
          }
        })
        .filter((x: any) => x.hasPassword && x.hasEmail)
        .slice(0, 10)
      finalList = passwordBearing.map((x: any) => ({
        node: x.node, fields: x.fields, score: 5, hasEmail: true, hasPassword: true,
      }))
    }

    seed._graphEntities = {
      available: finalList.length > 0,
      userLikeEntities: finalList.map((s: any) => ({
        name: s.node.label,
        kind: s.node.kind,
        sourceFile: s.node.source_file || null,
        score: s.score,
        fields: s.fields,
      })),
      _fallbackUsed: fallbackAttempted,
    }
  } catch (e) {
    seed._graphEntities = {
      available: false,
      reason: 'Graph query failed: ' + (e instanceof Error ? e.message : String(e)),
    }
  }
}

// ---------------------------------------------------------------------------
// Frontend route discovery (B1 fix)
//
// Extracts the set of frontend routes so Phase 5C can test them. Two sources:
//   1. graphify engine (preferred): `kind === 'react_route'` nodes contain
//      urlPath + signature (component name) + sourceFile, and cover any routing
//      style the parser recognizes.
//   2. Regex fallback: parse conventional files (App.tsx, routes.tsx, …) and
//      recurse into `routes/` and `pages/` for file-based routing projects.
//
// Output shape: Array<{ path: string; component?: string; source: string }>
// where `source` is the file (relative to frontend/src, or "graph" for source
// 1). Callers tolerate an empty array — it just means Phase 5C will rely on
// runtime DOM discovery, the prior behavior.
// ---------------------------------------------------------------------------

interface FrontendRoute {
  path: string
  component?: string
  source: string
}

async function discoverFrontendRoutesForSeed(
  ctx: SystestContext,
): Promise<FrontendRoute[]> {
  // Source 1: graphify react_route nodes
  const fromGraph = discoverRoutesFromGraph(ctx.graphEngine)
  if (fromGraph.length > 0) {
    return dedupeRoutes(fromGraph)
  }

  // Source 2: regex fallback over conventional frontend source files
  const fromStatic = discoverRoutesFromStaticParse(ctx.workspace)
  return dedupeRoutes(fromStatic)
}

function discoverRoutesFromGraph(graphEngine: any): FrontendRoute[] {
  if (!graphEngine) return []
  try {
    // `query('', 'bfs', N)` returns up to N nodes; we then filter by kind.
    // Use a dedicated query first for speed; fall back to broad query if empty.
    const queries = ['react_route route path', '']
    for (const q of queries) {
      const res = graphEngine.query?.(q, 'bfs', 500) ?? { nodes: [] }
      const nodes = Array.isArray(res.nodes) ? res.nodes : []
      const routes = nodes
        .filter((n: any) => n && n.kind === 'react_route')
        .map((n: any) => {
          const path: string = typeof n.urlPath === 'string' && n.urlPath.length > 0
            ? n.urlPath
            : typeof n.label === 'string' ? String(n.label).replace(/^Route\s+/, '').trim() : ''
          const component: string | undefined = typeof n.signature === 'string' && n.signature.length > 0
            ? n.signature
            : undefined
          const source: string = typeof n.sourceFile === 'string' && n.sourceFile.length > 0
            ? n.sourceFile
            : (typeof n.source_file === 'string' ? n.source_file : 'graph')
          // Run through the shared normalizer even though graphify already
          // collapses `:id` → `:param`. This gives us origin-stripping,
          // trailing-slash cleanup, and keeps Phase 5A output shape-identical
          // to Phase 5C runtime discovery.
          return { path: normalizeRoutePath(path), component, source }
        })
        .filter((r: FrontendRoute) => r.path && r.path.startsWith('/'))
      if (routes.length > 0) return routes
    }
  } catch {
    // Fall through to static parse.
  }
  return []
}

function discoverRoutesFromStaticParse(workspace: string): FrontendRoute[] {
  const feSrc = join(workspace, 'frontend', 'src')
  if (!existsSync(feSrc)) return []

  const routes: FrontendRoute[] = []

  // (a) conventional top-level entry files
  const topCandidates = [
    'App.tsx', 'App.jsx', 'App.ts', 'App.js',
    'routes.tsx', 'routes.ts', 'routes.jsx', 'routes.js',
    'router.tsx', 'router.ts', 'router.jsx', 'router.js',
    'main.tsx', 'main.ts', 'main.jsx', 'main.js',
    'AppRouter.tsx', 'AppRoutes.tsx',
  ]
  for (const fname of topCandidates) {
    const p = join(feSrc, fname)
    if (!existsSync(p)) continue
    try {
      const content = readFileSync(p, 'utf-8')
      for (const r of extractRoutesFromSource(content, fname)) routes.push(r)
    } catch {
      // unreadable — skip
    }
  }

  // (b) recurse `routes/` and `pages/` directories (shallow depth-3 walk)
  for (const dirName of ['routes', 'pages']) {
    const dir = join(feSrc, dirName)
    if (!existsSync(dir)) continue
    const found = walkRouteDir(dir, dirName, 3)
    for (const r of found) routes.push(r)
  }

  return routes
}

function walkRouteDir(dir: string, relBase: string, depthLeft: number): FrontendRoute[] {
  if (depthLeft < 0) return []
  let entries: any[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out: FrontendRoute[] = []
  for (const ent of entries) {
    const full = join(dir, ent.name)
    const rel = `${relBase}/${ent.name}`
    if (ent.isDirectory()) {
      for (const r of walkRouteDir(full, rel, depthLeft - 1)) out.push(r)
    } else if (ent.isFile() && /\.(tsx|ts|jsx|js)$/.test(ent.name)) {
      try {
        const content = readFileSync(full, 'utf-8')
        for (const r of extractRoutesFromSource(content, rel)) out.push(r)
      } catch {
        // skip
      }
    }
  }
  return out
}

function extractRoutesFromSource(content: string, source: string): FrontendRoute[] {
  const found: FrontendRoute[] = []

  // Pattern 1: <Route path="..." element={<Component ... />}>
  // `element` prop may come before `path`, so match them independently within
  // the same Route tag (non-greedy up to the closing `>`).
  const routeTagRegex = /<Route\b([^>]*?)\/?>/g
  let m: RegExpExecArray | null
  while ((m = routeTagRegex.exec(content)) !== null) {
    const attrs = m[1]
    const pathMatch = /path\s*=\s*["'`]([^"'`]+)["'`]/.exec(attrs)
    if (!pathMatch) continue
    const rawPath = pathMatch[1]
    if (!rawPath || !looksLikeRoutePath(rawPath)) continue
    const elMatch = /element\s*=\s*\{\s*<\s*(\w+)/.exec(attrs)
    const compMatch = /component\s*=\s*\{?\s*(\w+)/.exec(attrs)
    const component = elMatch ? elMatch[1] : (compMatch ? compMatch[1] : undefined)
    found.push({ path: normalizeRoutePath(rawPath), component, source })
  }

  // Pattern 2: object-based route configs — { path: "...", element: <X/>, component: X }
  // Common with createBrowserRouter / react-router v6 data routers.
  const objRouteRegex = /\{\s*path\s*:\s*["'`]([^"'`]+)["'`][^}]*?(?:element\s*:\s*<\s*(\w+)|component\s*:\s*(\w+))?/g
  while ((m = objRouteRegex.exec(content)) !== null) {
    const rawPath = m[1]
    if (!rawPath || !looksLikeRoutePath(rawPath)) continue
    const component = m[2] || m[3] || undefined
    found.push({ path: normalizeRoutePath(rawPath), component, source })
  }

  return found
}

function looksLikeRoutePath(p: string): boolean {
  if (!p) return false
  // Must be root-relative path or "*" wildcard; reject full URLs and glob
  // fragments we mistook for paths.
  if (p === '*' || p === '/') return true
  if (!p.startsWith('/')) return false
  if (p.includes('\n') || p.includes(' ')) return false
  return true
}

function dedupeRoutes(routes: FrontendRoute[]): FrontendRoute[] {
  const seen = new Set<string>()
  const out: FrontendRoute[] = []
  for (const r of routes) {
    const key = r.path
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  // '/' first, then alphabetical — stable ordering across runs.
  out.sort((a, b) => {
    if (a.path === '/') return -1
    if (b.path === '/') return 1
    return a.path.localeCompare(b.path)
  })
  return out
}

// ---------------------------------------------------------------------------
// Seed data generation
// ---------------------------------------------------------------------------

function generateTestDataSeed(
  ctx: SystestContext,
  entities: any[],
  phaseAnalysis: PhaseAnalysis,
  businessTestCases: BusinessTestCases,
  generatedTestCases: any,
): any {
  const timestamp = Date.now()

  return {
    $schema: 'meta-coder-systest-test-data',
    _version: '2.0.0',
    generated_at: new Date().toISOString(),

    // --- Phase analysis summaries ---
    phase_analysis: buildPhaseAnalysisSummary(phaseAnalysis, ctx),

    // --- Entity records (all discovered entities, not just User) ---
    entities: buildEntityRecords(entities, phaseAnalysis, timestamp, ctx.graphEngine),

    // --- Auth credentials ---
    // Placeholders — AI will populate these in Phase 5A based on collected data.
    // See _prpReferences, _authDiscovery, _dbSchema, _graphEntities below.
    _authPlaceholder: {
      _instructions: "AI must generate realistic credentials matching the project's domain",
      _hint_unique: `Use timestamp ${timestamp} to ensure uniqueness`,
      _hint_admin_method: "Try register API first, then SQL UPDATE role='admin', OR INSERT directly",
      _hint_password: "Must satisfy validation rules in _authDiscovery.registerSchema or _dbSchema CHECK constraints",
      _hint_multiple_roles: "If _prpReferences exists with role matrix, create ONE user per role (auth_{role})",
    },
    auth: null,
    auth_admin: null,

    // --- Business logic test cases (Phase 4 primary, Phase 3 fallback) ---
    layer1Tests: businessTestCases.layer1,
    layer2Tests: businessTestCases.layer2,

    // --- Scenarios ---
    scenarios: {
      validation: buildValidationScenarios(filterValidEntities(entities), phaseAnalysis),
      authorization: buildAuthorizationScenarios(phaseAnalysis),
      constraints: buildConstraintScenarios(filterValidEntities(entities), phaseAnalysis),
      stateTransitions: buildStateTransitionScenarios(filterValidEntities(entities), phaseAnalysis),
      edgeCases: buildEdgeCaseScenarios(),
      integrationFlows: buildIntegrationFlowScenarios(filterValidEntities(entities), businessTestCases),
    },

    // --- Priority tiers ---
    priority_tiers: {
      P0: { description: 'Normal happy path', count: 0 },
      P1: { description: 'Required field variations', count: 0 },
      P2: { description: 'Boundary values', count: 0 },
      P3: { description: 'Authorization tests', count: 0 },
      P4: { description: 'State transitions', count: 0 },
      P5: { description: 'Business constraints', count: 0 },
    },
  }
}

// ---------------------------------------------------------------------------
// Phase analysis summary builder
// ---------------------------------------------------------------------------

function buildPhaseAnalysisSummary(phaseAnalysis: PhaseAnalysis, ctx: SystestContext): any {
  const p1 = phaseAnalysis.phase1
  const p2 = phaseAnalysis.phase2
  const p4 = phaseAnalysis.phase4

  return {
    phase1: {
      documentCount: p1?.documents?.length || p1?.designDocs?.length || 0,
      documentTypes: extractDocumentTypes(p1),
      apiCount: p1?.apiSpecifications?.length || 0,
      entityCount: p1?.entityDefinitions?.length || 0,
      businessRuleCount: p1?.businessRules?.length || 0,
    },
    phase2: {
      graphStats: {
        nodeCount: p2?.graphStats?.nodeCount || p2?.stats?.nodeCount || 0,
        edgeCount: p2?.graphStats?.edgeCount || p2?.stats?.edgeCount || 0,
      },
      endpointCount: p2?.endpoints?.length || p2?.apiEndpoints?.length || 0,
      entityCount: p2?.entities?.length || 0,
      moduleCount: p2?.modules?.length || 0,
      architecture: p2?.architecture?.type || 'unknown',
    },
    phase4: {
      backendUrl: ctx.backendUrl || null,
      frontendUrl: ctx.frontendUrl || null,
      databaseUrl: ctx.databaseUrl ? '[configured]' : null,
      architectureType: p4?.type || 'unknown',
      hasDocker: p4?.hasDockerfile || false,
      hasDockerCompose: p4?.hasDockerCompose || false,
      backendFramework: p4?.backendFramework || null,
      frontendFramework: p4?.frontendFramework || null,
    },
  }
}

function extractDocumentTypes(p1: any): string[] {
  if (!p1) return []
  const docs = p1.documents || p1.designDocs || []
  const types = new Set<string>()
  for (const d of docs) {
    if (d.type) types.add(d.type)
    else if (d.format) types.add(d.format)
  }
  return Array.from(types)
}

// ---------------------------------------------------------------------------
// Entity record builder
// ---------------------------------------------------------------------------

function extractEntityDependencies(graphEngine: any, entityName: string): string[] {
  if (!graphEngine) return []
  try {
    const neighbors = graphEngine.getNeighbors?.(entityName, 1)
    if (!neighbors?.successors) return []
    return neighbors.successors
      .filter((n: any) => ['class', 'schema', 'entity', 'table', 'model'].includes(n.kind))
      .map((n: any) => n.label)
      .filter((label: string) => label !== entityName)
      .slice(0, 10)
  } catch {
    return []
  }
}

function buildEntityRecords(entities: any[], phaseAnalysis: PhaseAnalysis, timestamp: number, graphEngine?: any): any {
  const result: any = {}

  // User entity is NOT auto-generated here — AI in Phase 5A will populate it
  // based on _prpReferences / _authDiscovery / _dbSchema with realistic
  // credentials. See _authPlaceholder for guidance.

  const isAuthEntityName = (name: string) => /^(user|employee|account|staff|member|admin)s?$/i.test(name)

  // Generate records for ALL discovered entities from graph.
  // isValidEntityName() already rejects file-like names, docs headings, DTOs, etc.
  const validEntities = filterValidEntities(entities)

  // Collect all entity names up front so FK $-references can resolve
  const allEntityNames: string[] = []
  for (const entity of validEntities) {
    const n = entity.entityName || entity.name
    if (n && n !== 'User' && !allEntityNames.includes(n)) allEntityNames.push(n)
  }
  for (const entity of (phaseAnalysis.phase2?.entities || [])) {
    const n = entity.name || entity.entityName
    if (n && !allEntityNames.includes(n) && isValidEntityName(n)) allEntityNames.push(n)
  }
  for (const entity of (phaseAnalysis.phase1?.entityDefinitions || [])) {
    const n = entity.name || entity.entityName
    if (n && !allEntityNames.includes(n) && isValidEntityName(n)) allEntityNames.push(n)
  }

  for (const entity of validEntities) {
    const name = entity.entityName || entity.name
    if (!name || name === 'User') continue

    const fields = entity.fields || []
    result[name] = {
      table: toSnakeCase(name) + 's',
      primaryKey: guessPrimaryKey(fields),
      authEntity: isAuthEntityName(name),
      dependencies: extractEntityDependencies(graphEngine, name),
      sourceFile: entity.sourceFile || null,
      records: generateEntityRecords(name, fields, timestamp, allEntityNames),
    }
  }

  // Also include entities from Phase 2 project structure
  const phase2Entities = phaseAnalysis.phase2?.entities || []
  for (const entity of phase2Entities) {
    const name = entity.name || entity.entityName
    if (!name || result[name] || !isValidEntityName(name)) continue

    const fields = entity.fields || entity.properties || []
    result[name] = {
      table: toSnakeCase(name) + 's',
      primaryKey: guessPrimaryKey(fields),
      authEntity: isAuthEntityName(name),
      dependencies: extractEntityDependencies(graphEngine, name),
      records: generateEntityRecords(name, fields, timestamp, allEntityNames),
    }
  }

  // Include entities from Phase 1 design analysis
  const phase1Entities = phaseAnalysis.phase1?.entityDefinitions || []
  for (const entity of phase1Entities) {
    const name = entity.name || entity.entityName
    if (!name || result[name] || !isValidEntityName(name)) continue

    const fields = entity.fields || entity.properties || []
    result[name] = {
      table: toSnakeCase(name) + 's',
      primaryKey: guessPrimaryKey(fields),
      authEntity: isAuthEntityName(name),
      dependencies: extractEntityDependencies(graphEngine, name),
      records: generateEntityRecords(name, fields, timestamp, allEntityNames),
    }
  }

  return result
}

function guessPrimaryKey(fields: any[]): string {
  for (const f of fields) {
    const name = (f.name || f.fieldName || f.key || '').toLowerCase()
    if (name === 'id' || name.endsWith('id') || name === 'pk') return f.name || f.fieldName || f.key
  }
  return 'id'
}

function generateEntityRecords(entityName: string, fields: any[], timestamp: number, allEntityNames: string[] = []): any[] {
  const records: any[] = []
  const fieldMap = buildFieldMap(fields)

  // Generate 2-3 sample records per entity
  for (let i = 1; i <= 3; i++) {
    const record: any = { id: i }

    for (const [fieldName, fieldDef] of Object.entries(fieldMap)) {
      if (fieldName === 'id') continue
      record[fieldName] = generateFieldValue(fieldName, fieldDef, i, timestamp, entityName, allEntityNames)
    }

    // Always include created_at if not in schema
    if (!record.created_at && !record.createdAt) {
      record.created_at = new Date().toISOString()
    }

    records.push(record)
  }

  return records
}

function buildFieldMap(fields: any[]): Record<string, any> {
  const map: Record<string, any> = {}
  for (const f of fields) {
    const name = f.name || f.fieldName || f.key
    if (name) map[name] = f
  }
  // If no fields discovered, provide sensible defaults
  if (Object.keys(map).length === 0) {
    map.name = { type: 'string' }
    map.description = { type: 'string', optional: true }
    map.status = { type: 'string' }
  }
  return map
}

function generateFieldValue(fieldName: string, fieldDef: any, index: number, timestamp: number, entityName: string, allEntityNames: string[] = []): any {
  const type = (fieldDef.type || 'string').toLowerCase()
  const lowerName = fieldName.toLowerCase()

  // FK heuristic: fieldname like "airport_id", "aircraftId", "owner_fk" → $-reference
  // so Phase 5B can resolve to a real record id at runtime.
  for (const otherEntity of allEntityNames) {
    if (otherEntity === entityName) continue
    const singular = otherEntity.toLowerCase().replace(/s$/, '')
    if (lowerName === `${singular}_id` || lowerName === `${singular}id` || lowerName === `${singular}_fk`) {
      return `$entities.${otherEntity}.records[0].id`
    }
  }

  // Name-based heuristics
  if (lowerName.includes('email')) return `test_${entityName.toLowerCase()}_${index}_${timestamp}@example.com`
  if (lowerName.includes('password')) return `TestPassw0rd!${index}`
  if (lowerName === 'name' || lowerName.includes('username')) return `Test ${entityName} ${index}`
  if (lowerName.includes('url') || lowerName.includes('link')) return `https://example.com/${entityName.toLowerCase()}/${index}`
  if (lowerName.includes('phone')) return `+1555000${String(index).padStart(4, '0')}`
  if (lowerName === 'status' || lowerName === 'state') return index === 1 ? 'active' : 'inactive'
  if (lowerName === 'role') return index === 1 ? 'user' : 'admin'
  if (lowerName.includes('count') || lowerName.includes('quantity')) return index * 10
  if (lowerName.includes('price') || lowerName.includes('amount') || lowerName.includes('cost')) return (index * 9.99)
  if (lowerName.includes('date') || lowerName.includes('_at') || lowerName.includes('At')) return new Date().toISOString()
  if (lowerName.includes('flag') || lowerName.includes('is_') || lowerName.includes('has_')) return index === 1
  if (lowerName.includes('description') || lowerName.includes('bio') || lowerName.includes('content')) {
    return `Test ${entityName} ${fieldName} content for record ${index}`
  }
  if (lowerName.includes('_id') || lowerName.includes('Id')) return index

  // Type-based fallback
  switch (type) {
    case 'string': return `test_${fieldName}_${index}`
    case 'number':
    case 'integer':
    case 'int': return index
    case 'boolean':
    case 'bool': return index === 1
    case 'date':
    case 'datetime':
    case 'timestamp': return new Date().toISOString()
    case 'array': return []
    case 'object':
    case 'json': return {}
    default: return `test_${fieldName}_${index}`
  }
}

// ---------------------------------------------------------------------------
// Validation scenarios
// ---------------------------------------------------------------------------

function buildValidationScenarios(entities: any[], phaseAnalysis: PhaseAnalysis): any[] {
  const scenarios: any[] = []

  // Base validation scenarios
  scenarios.push(
    { tier: 'P2', category: 'validation', description: 'Empty required field', payload: { email: '' }, expected_status: 422 },
    { tier: 'P2', category: 'validation', description: 'Invalid email format', payload: { email: 'not-an-email' }, expected_status: 422 },
    { tier: 'P2', category: 'validation', description: 'Excessively long input (300 chars)', payload: { name: 'x'.repeat(300) }, expected_status: 422 },
    { tier: 'P2', category: 'validation', description: 'Null value for required field', payload: { email: null }, expected_status: 422 },
    { tier: 'P2', category: 'validation', description: 'Whitespace-only input', payload: { name: '   ' }, expected_status: 422 },
    { tier: 'P2', category: 'validation', description: 'Numeric string where number expected', payload: { count: '42' }, expected_status: 422 },
    { tier: 'P2', category: 'validation', description: 'Boolean string where boolean expected', payload: { active: 'true' }, expected_status: 422 },
  )

  // Entity-specific constraint-based validation
  for (const entity of entities) {
    const entityName = entity.entityName || entity.name
    const fields = entity.fields || []

    for (const field of fields) {
      const constraints = field.constraints || {}

      if (constraints.maxLength) {
        scenarios.push({
          tier: 'P2',
          category: 'validation',
          description: `${entityName}.${field.name} exceeds maxLength (${constraints.maxLength})`,
          entity: entityName,
          field: field.name,
          payload: { [field.name]: 'x'.repeat(constraints.maxLength + 1) },
          expected_status: 422,
        })
      }

      if (constraints.minLength) {
        scenarios.push({
          tier: 'P2',
          category: 'validation',
          description: `${entityName}.${field.name} below minLength (${constraints.minLength})`,
          entity: entityName,
          field: field.name,
          payload: { [field.name]: 'x'.repeat(Math.max(0, constraints.minLength - 1)) },
          expected_status: 422,
        })
      }

      if (constraints.min != null) {
        scenarios.push({
          tier: 'P2',
          category: 'validation',
          description: `${entityName}.${field.name} below min (${constraints.min})`,
          entity: entityName,
          field: field.name,
          payload: { [field.name]: constraints.min - 1 },
          expected_status: 422,
        })
      }

      if (constraints.max != null) {
        scenarios.push({
          tier: 'P2',
          category: 'validation',
          description: `${entityName}.${field.name} exceeds max (${constraints.max})`,
          entity: entityName,
          field: field.name,
          payload: { [field.name]: constraints.max + 1 },
          expected_status: 422,
        })
      }

      if (constraints.pattern) {
        scenarios.push({
          tier: 'P2',
          category: 'validation',
          description: `${entityName}.${field.name} fails pattern validation`,
          entity: entityName,
          field: field.name,
          payload: { [field.name]: '!!!invalid!!!' },
          expected_status: 422,
        })
      }
    }
  }

  return scenarios
}

// ---------------------------------------------------------------------------
// Authorization scenarios
// ---------------------------------------------------------------------------

function buildAuthorizationScenarios(phaseAnalysis: PhaseAnalysis): any[] {
  const scenarios: any[] = [
    { tier: 'P3', category: 'authorization', description: 'User accessing admin endpoint', auth_as: 'user', expected_status: 403 },
    { tier: 'P3', category: 'authorization', description: 'Unauthenticated access to protected endpoint', auth_as: null, expected_status: 401 },
    { tier: 'P3', category: 'authorization', description: 'Expired token access', auth_as: 'expired', expected_status: 401 },
    { tier: 'P3', category: 'authorization', description: 'Malformed JWT token', auth_as: 'malformed', expected_status: 401 },
    { tier: 'P3', category: 'authorization', description: 'User accessing another user resource', auth_as: 'other_user', expected_status: 403 },
    { tier: 'P3', category: 'authorization', description: 'Revoked token access', auth_as: 'revoked', expected_status: 401 },
  ]

  return scenarios
}

// ---------------------------------------------------------------------------
// Constraint scenarios
// ---------------------------------------------------------------------------

function buildConstraintScenarios(entities: any[], phaseAnalysis: PhaseAnalysis): any[] {
  const scenarios: any[] = [
    { tier: 'P5', category: 'constraints', description: 'Duplicate unique email', constraint: 'unique_email', expected_status: 409 },
    { tier: 'P5', category: 'constraints', description: 'Duplicate unique username', constraint: 'unique_username', expected_status: 409 },
    { tier: 'P5', category: 'constraints', description: 'Exceeding maximum items per user', constraint: 'max_items_per_user', expected_status: 400 },
    { tier: 'P5', category: 'constraints', description: 'Foreign key reference to non-existent record', constraint: 'foreign_key', expected_status: 404 },
    { tier: 'P5', category: 'constraints', description: 'Deleting record with dependent children', constraint: 'cascade_delete', expected_status: 409 },
  ]

  // Add entity-specific constraints from field definitions
  for (const entity of entities) {
    const entityName = entity.entityName || entity.name
    const fields = entity.fields || []
    for (const field of fields) {
      const constraints = field.constraints || {}
      if (constraints.unique) {
        scenarios.push({
          tier: 'P5',
          category: 'constraints',
          description: `${entityName}.${field.name} unique constraint violation`,
          entity: entityName,
          field: field.name,
          constraint: `unique_${field.name}`,
          expected_status: 409,
        })
      }
    }
  }

  return scenarios
}

// ---------------------------------------------------------------------------
// State transition scenarios
// ---------------------------------------------------------------------------

function buildStateTransitionScenarios(entities: any[], phaseAnalysis: PhaseAnalysis): any[] {
  const scenarios: any[] = [
    // Common state transitions
    { tier: 'P4', category: 'state_transition', from: 'inactive', to: 'active', description: 'Activate inactive record', expected_status: 200 },
    { tier: 'P4', category: 'state_transition', from: 'active', to: 'inactive', description: 'Deactivate active record', expected_status: 200 },
    { tier: 'P4', category: 'state_transition', from: 'draft', to: 'published', description: 'Publish draft', expected_status: 200 },
    { tier: 'P4', category: 'state_transition', from: 'published', to: 'archived', description: 'Archive published record', expected_status: 200 },
    { tier: 'P4', category: 'state_transition', from: 'pending', to: 'approved', description: 'Approve pending item', expected_status: 200 },
    { tier: 'P4', category: 'state_transition', from: 'pending', to: 'rejected', description: 'Reject pending item', expected_status: 200 },
    // Invalid transitions
    { tier: 'P4', category: 'state_transition', from: 'archived', to: 'draft', description: 'Invalid: revert archived to draft', expected_status: 400 },
    { tier: 'P4', category: 'state_transition', from: 'deleted', to: 'active', description: 'Invalid: reactivate deleted record', expected_status: 400 },
  ]

  return scenarios
}

// ---------------------------------------------------------------------------
// Edge case scenarios
// ---------------------------------------------------------------------------

function buildEdgeCaseScenarios(): any[] {
  return [
    // Security edge cases
    { tier: 'P3', category: 'edge_case', description: 'SQL injection in query parameter', payload: { q: "' OR 1=1; --" }, expected_status: 400 },
    { tier: 'P3', category: 'edge_case', description: 'XSS in text field', payload: { name: '<script>alert("xss")</script>' }, expected_status: 422 },
    { tier: 'P3', category: 'edge_case', description: 'NoSQL injection attempt', payload: { email: { $gt: '' } }, expected_status: 400 },
    { tier: 'P3', category: 'edge_case', description: 'Path traversal in file field', payload: { file: '../../../etc/passwd' }, expected_status: 400 },

    // Data boundary edge cases
    { tier: 'P2', category: 'edge_case', description: 'Non-existent resource by ID', resourceId: 999999, expected_status: 404 },
    { tier: 'P2', category: 'edge_case', description: 'Negative ID', resourceId: -1, expected_status: 400 },
    { tier: 'P2', category: 'edge_case', description: 'Zero as ID', resourceId: 0, expected_status: 400 },
    { tier: 'P2', category: 'edge_case', description: 'Non-numeric ID', resourceId: 'abc', expected_status: 400 },
    { tier: 'P2', category: 'edge_case', description: 'UUID v4 as ID when integer expected', resourceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', expected_status: 400 },

    // Encoding edge cases
    { tier: 'P3', category: 'edge_case', description: 'Unicode/emoji in text field', payload: { name: '\u{1F4A9}\u{1F525}\u{1F680}' }, expected_status: 200 },
    { tier: 'P3', category: 'edge_case', description: 'Null bytes in string', payload: { name: 'test\x00value' }, expected_status: 422 },
    { tier: 'P3', category: 'edge_case', description: 'Very long URL-encoded input', payload: { search: 'a'.repeat(5000) }, expected_status: 422 },
    { tier: 'P3', category: 'edge_case', description: 'JSON with deeply nested objects (20 levels)', payload: { nested: buildDeepObject(20) }, expected_status: 400 },
    { tier: 'P3', category: 'edge_case', description: 'Content-Type mismatch (text/plain for JSON endpoint)', headers: { 'Content-Type': 'text/plain' }, expected_status: 415 },

    // Concurrency edge cases
    { tier: 'P3', category: 'edge_case', description: 'Concurrent duplicate creation (race condition)', concurrent: true, expected_status: 409 },
    { tier: 'P3', category: 'edge_case', description: 'Update after delete (stale reference)', sequence: ['delete', 'update'], expected_status: 404 },
  ]
}

function buildDeepObject(depth: number): any {
  if (depth <= 0) return 'leaf'
  return { nested: buildDeepObject(depth - 1) }
}

// ---------------------------------------------------------------------------
// Integration flow scenarios
// ---------------------------------------------------------------------------

function buildIntegrationFlowScenarios(entities: any[], businessTestCases: BusinessTestCases): any[] {
  const scenarios: any[] = []
  const layer1 = businessTestCases?.layer1 || []

  // Index layer1 tests by endpoint shape + method for reuse as step testIds.
  // Normalize path params so /api/foo/{id} and /api/foo/:id both match.
  const normalize = (p: string) => (p || '').toLowerCase().replace(/\{[^}]+\}/g, '{id}').replace(/:\w+/g, '{id}')
  const findTestId = (method: string, pathContains: string): string | null => {
    const mUp = method.toUpperCase()
    for (const t of layer1) {
      const tMethod = (t.Method || '').toUpperCase()
      const tPath = normalize(t.Endpoint || '')
      if (tMethod === mUp && tPath.includes(pathContains.toLowerCase())) {
        return t['Test ID'] || null
      }
    }
    return null
  }

  let flowCounter = 1

  // Add entity-specific CRUD flows with step-linked $flow references
  for (const entity of entities) {
    const entityName = entity.entityName || entity.name
    if (!entityName || entityName === 'User') continue

    const base = `/${entityName.toLowerCase()}` // substring match (handles /api/... /api/v1/...)
    const createId = findTestId('POST', base)
    const getId = findTestId('GET', base)
    const updateId = findTestId('PUT', base) || findTestId('PATCH', base)
    const deleteId = findTestId('DELETE', base)

    // Only emit a flow if we can link at least the create step — otherwise AI has no reference.
    if (!createId) continue

    const flowId = `FLOW-${String(flowCounter++).padStart(2, '0')}`
    const saveVar = `$flow.new${entityName}`
    const steps: any[] = [
      { stepId: `${flowId}-STEP-1`, testId: createId, action: 'create', saveAs: saveVar },
    ]
    if (getId) steps.push({ stepId: `${flowId}-STEP-${steps.length + 1}`, testId: getId, action: 'get', use: `${saveVar}.id` })
    if (updateId) steps.push({ stepId: `${flowId}-STEP-${steps.length + 1}`, testId: updateId, action: 'update', use: `${saveVar}.id` })
    if (deleteId) steps.push({ stepId: `${flowId}-STEP-${steps.length + 1}`, testId: deleteId, action: 'delete', use: `${saveVar}.id` })

    scenarios.push({
      flowId,
      name: `${entityName} CRUD`,
      tier: 'P1',
      category: 'integration_flow',
      entity: entityName,
      steps,
    })
  }

  // If no entity-specific flows could be built, emit a fallback description-only flow
  // so Phase 5B still knows integration flows are expected. No fake testIds.
  if (scenarios.length === 0) {
    scenarios.push({
      flowId: 'FLOW-01',
      name: 'CRUD lifecycle (fallback — AI should map to real test IDs)',
      tier: 'P1',
      category: 'integration_flow',
      steps: [
        { stepId: 'FLOW-01-STEP-1', action: 'create', saveAs: '$flow.newResource' },
        { stepId: 'FLOW-01-STEP-2', action: 'get', use: '$flow.newResource.id' },
        { stepId: 'FLOW-01-STEP-3', action: 'update', use: '$flow.newResource.id' },
        { stepId: 'FLOW-01-STEP-4', action: 'delete', use: '$flow.newResource.id' },
      ],
    })
  }

  return scenarios
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
}
