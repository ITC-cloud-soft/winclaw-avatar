/**
 * Phase 2: Code Structure Analysis (Graphify Implementation)
 *
 * Uses Meta Coder's built-in graphify knowledge graph to extract:
 * - Real API endpoints with method + path from graph route nodes
 * - Entity schemas with fields from graph model/schema nodes
 * - Service layer nodes
 * - Architecture detection (monorepo vs standard)
 * - Graph statistics
 */

import { join } from 'node:path'
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import type { SystestContext, PhaseResult } from './orchestrator.js'
import type { GraphEngine } from '../../../services/graphify/engine.js'

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

interface EndpointInfo {
  method: string
  path: string
  handler: string
  sourceFile: string
}

interface EntityFieldInfo {
  name: string
  type: string
  optional?: boolean
  constraints?: string
}

interface EntityInfo {
  name: string
  fields: EntityFieldInfo[]
  sourceFile: string
  tableName?: string
  schemaType?: string
}

interface ServiceInfo {
  name: string
  sourceFile: string
  dependsOn: string[]
}

interface ArchitectureInfo {
  type: 'monorepo' | 'standard' | 'unknown'
  apps: string[]
}

interface GraphStats {
  nodes: number
  edges: number
  communities: number
  kindBreakdown: Record<string, number>
}

interface ProjectStructure {
  endpoints: EndpointInfo[]
  entities: EntityInfo[]
  services: ServiceInfo[]
  architecture: ArchitectureInfo
  graphStats: GraphStats
}

// ---------------------------------------------------------------------------
// Noise filter — paths to exclude from graph results
// ---------------------------------------------------------------------------

const NOISE_PATTERNS = [
  'node_modules',
  '/dist/',
  '\\dist\\',
  '.vite',
  '.systest',
  '/build/',
  '\\build\\',
  '.next',
  '.nuxt',
  '__pycache__',
  '.tsbuildinfo',
]

function isNoisySource(sourceFile: string): boolean {
  if (!sourceFile) return true
  const lower = sourceFile.toLowerCase()
  return NOISE_PATTERNS.some(p => lower.includes(p.toLowerCase()))
}

// ---------------------------------------------------------------------------
// Domain entity filter
// ---------------------------------------------------------------------------

/**
 * Prefixes that indicate function/method names rather than domain entities.
 */
const FUNCTION_PREFIXES = [
  'get', 'set', 'is', 'has', 'detect', 'find', 'create', 'update', 'delete',
  'fetch', 'load', 'save', 'parse', 'build', 'make', 'check', 'handle',
  'process', 'render', 'emit', 'on', 'off', 'reset', 'init', 'run', 'start',
  'stop', 'send', 'receive', 'compute', 'calculate', 'validate', 'format',
  'convert', 'transform', 'merge', 'filter', 'map', 'reduce', 'sort',
  'require', 'ensure', 'assign', 'unassign', 'register', 'login', 'refresh',
  'verify', 'issue', 'report', 'list', 'pull', 'push', 'cancel', 'record',
  'remove', 'add', 'read', 'write',
]

/**
 * Generic, non-domain variable/type names that should be excluded.
 */
const GENERIC_CODE_NAMES = new Set([
  'type', 'name', 'value', 'key', 'index', 'data', 'config', 'options',
  'params', 'result', 'error', 'response', 'request', 'item', 'items',
  'entry', 'entries', 'list', 'map', 'set', 'array', 'object', 'node',
  'edge', 'link', 'path', 'file', 'dir', 'info', 'meta', 'base', 'root',
  'context', 'state', 'store', 'cache', 'event', 'message', 'output',
  'input', 'payload', 'body', 'header', 'token', 'id', 'ids', 'args',
  'props', 'ref', 'cb', 'callback', 'fn', 'func', 'handler', 'helper',
  'util', 'utils', 'logger', 'log', 'debug', 'test', 'mock', 'stub',
  'client', 'server', 'db', 'connection', 'pool', 'query', 'row', 'rows',
  'record', 'records', 'field', 'fields', 'column', 'columns', 'table',
  'tables', 'schema', 'schemas', 'model', 'models', 'entity', 'entities',
  'interface', 'interfaces', 'class', 'classes', 'module', 'modules',
  'route', 'routes', 'endpoint', 'endpoints', 'middleware', 'plugin',
  'plugins', 'adapter', 'adapters', 'driver', 'drivers', 'factory',
  'builder', 'parser', 'serializer', 'deserializer', 'encoder', 'decoder',
  'manager', 'registry', 'container', 'provider', 'consumer',
])

/**
 * File extension patterns that indicate a filename was mistakenly used as an entity name.
 */
const FILE_EXTENSION_RE = /\.(ts|js|tsx|jsx|json|md|yaml|yml|toml|env|sh|py|go|rs|java|cs|cpp|c|h)$/i

/**
 * Path separator pattern.
 */
const PATH_SEPARATOR_RE = /[/\\]/

/**
 * Determine whether a candidate name looks like a real domain entity
 * (e.g. User, Avatar, Subscription, AuditLog, ModelKey) rather than a
 * code artifact (function name, filename, generic variable).
 *
 * Rules applied in order:
 *  1. Reject if contains "()" — it's a function call signature
 *  2. Reject if contains a file extension
 *  3. Reject if contains a path separator
 *  4. Reject if it is a well-known generic code name (case-insensitive)
 *  5. Reject if it starts with a function-like prefix followed by an uppercase letter
 *  6. Reject single-word all-lowercase names that are too short (<= 3 chars)
 *  7. Reject names that contain "→" or "Table" suffix (these are variable/table refs)
 *  8. Accept PascalCase or camelCase names that survived all above filters
 */
export function isLikelyDomainEntity(name: string): boolean {
  if (!name || name.length === 0) return false

  // Rule 1: function call signatures
  if (name.includes('()')) return false

  // Rule 2: filename with extension
  if (FILE_EXTENSION_RE.test(name)) return false

  // Rule 3: path separators
  if (PATH_SEPARATOR_RE.test(name)) return false

  // Rule 7: table variable references like "aiModelKeysTable → ai_model_keys"
  if (name.includes('→')) return false
  if (/Table$/i.test(name) && /^[a-z]/.test(name)) return false  // camelCase XxxTable vars

  // Rule 4: generic code names (exact match, case-insensitive)
  if (GENERIC_CODE_NAMES.has(name.toLowerCase())) return false

  // Rule 5: function-like prefix (e.g. getFileType, detectFileType, createUser)
  // Only reject if the char after the prefix is uppercase (true camelCase function)
  for (const prefix of FUNCTION_PREFIXES) {
    if (
      name.length > prefix.length &&
      name.toLowerCase().startsWith(prefix) &&
      /[A-Z_]/.test(name[prefix.length])
    ) {
      return false
    }
  }

  // Rule 6: very short all-lowercase single token — too generic
  if (/^[a-z]{1,3}$/.test(name)) return false

  // Rule 8: all-uppercase constants (FILE_TYPES, SUM, etc.) are not domain entities
  if (/^[A-Z][A-Z0-9_]+$/.test(name) && name.includes('_')) return false

  // Passed all filters — treat as a candidate domain entity
  return true
}

// ---------------------------------------------------------------------------
// OpenAPI entity extraction
// ---------------------------------------------------------------------------

/**
 * Attempt to fetch /openapi.json from the backend and extract schema definition
 * names as authoritative domain entity names.
 * Returns an empty array if the endpoint is unreachable or the response is invalid.
 */
async function fetchOpenApiEntities(backendUrl: string): Promise<string[]> {
  try {
    const url = backendUrl.replace(/\/$/, '') + '/openapi.json'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) return []

    const spec = await res.json() as any
    const definitions: Record<string, any> =
      spec?.components?.schemas || spec?.definitions || {}

    return Object.keys(definitions).filter(k => isLikelyDomainEntity(k))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Execute Phase 2: Code Structure Analysis
 */
export async function executePhase2(ctx: SystestContext): Promise<PhaseResult> {
  const startTime = Date.now()
  const outputs: string[] = []

  console.log('[Phase 2] ================================================')
  console.log('[Phase 2] Phase 2: Code Structure Analysis (graphify-enhanced)')
  console.log('[Phase 2] ================================================')
  console.log('[Phase 2]')

  const logsDir = join(ctx.outputDir, 'config')
  try { mkdirSync(logsDir, { recursive: true }) } catch {}

  try {
    const engine = ctx.graphEngine

    if (!engine || !engine.isReady()) {
      console.warn('[Phase 2] Graph engine not available, falling back to file-based graph...')
      const graphData = await loadKnowledgeGraphFromFile(ctx)
      if (!graphData) {
        console.warn('[Phase 2] Knowledge graph not available, using empty structure...')
        return await analyzeWithoutGraph(ctx, logsDir, outputs)
      }
      // File-based fallback — use the old simple extraction
      const structure = analyzeFromRawGraph(graphData, ctx)
      const outputPath = join(logsDir, 'project-structure.json')
      writeFileSync(outputPath, JSON.stringify(structure, null, 2), 'utf-8')
      outputs.push(outputPath)
      logSummary(structure, outputPath)
      return { status: 'completed', outputs, duration: Date.now() - startTime }
    }

    console.log('[Phase 2] Step 1: Graph engine available, extracting structure...')

    // Step 1: Extract real API endpoints
    console.log('[Phase 2] Step 2: Extracting API endpoints...')
    const endpoints = extractEndpoints(engine)
    console.log(`[Phase 2]   Found ${endpoints.length} endpoints`)

    // Step 2: Extract entity schemas with fields
    console.log('[Phase 2] Step 3: Extracting entity schemas...')
    const entities = await extractEntities(engine, ctx)
    console.log(`[Phase 2]   Found ${entities.length} entities`)

    // Step 3: Extract services
    console.log('[Phase 2] Step 4: Extracting services...')
    const services = extractServices(engine)
    console.log(`[Phase 2]   Found ${services.length} services`)

    // Step 4: Detect architecture
    console.log('[Phase 2] Step 5: Detecting architecture...')
    const architecture = detectArchitecture(ctx)
    console.log(`[Phase 2]   Architecture: ${architecture.type}${architecture.apps.length > 0 ? ` (apps: ${architecture.apps.join(', ')})` : ''}`)

    // Step 5: Graph stats
    const stats = engine.getStats()
    const graphStats: GraphStats = {
      nodes: stats.nodeCount,
      edges: stats.edgeCount,
      communities: stats.communityCount,
      kindBreakdown: stats.kindBreakdown,
    }

    const structure: ProjectStructure = {
      endpoints,
      entities,
      services,
      architecture,
      graphStats,
    }

    // Save
    const outputPath = join(logsDir, 'project-structure.json')
    writeFileSync(outputPath, JSON.stringify(structure, null, 2), 'utf-8')
    outputs.push(outputPath)

    logSummary(structure, outputPath)

    return {
      status: 'completed',
      outputs,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    console.error('[Phase 2] Error:', error)
    return {
      status: 'failed',
      outputs,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ---------------------------------------------------------------------------
// Engine-based extraction
// ---------------------------------------------------------------------------

/**
 * Extract real API endpoints using engine.getRoutes() and fallback query.
 */
function extractEndpoints(engine: GraphEngine): EndpointInfo[] {
  const endpoints: EndpointInfo[] = []
  const seen = new Set<string>()

  // Primary: use Level 2 route kind index
  const routes = engine.getRoutes()
  for (const route of routes) {
    if (isNoisySource(route.source_file)) continue
    const key = `${route.http_method}:${route.url_path}`
    if (seen.has(key)) continue
    seen.add(key)
    endpoints.push({
      method: route.http_method.toUpperCase(),
      path: route.url_path,
      handler: route.label,
      sourceFile: route.source_file,
    })
  }

  // Fallback: query for route-related nodes that might not have kind=route
  if (endpoints.length === 0) {
    const queryResult = engine.query('route router endpoint handler controller', 'bfs', 100)
    for (const node of queryResult.nodes) {
      if (isNoisySource(node.source_file)) continue
      const label = node.label.toLowerCase()
      if (label.includes('route') || label.includes('controller') || label.includes('handler') || label.includes('endpoint')) {
        const key = `fallback:${node.label}`
        if (seen.has(key)) continue
        seen.add(key)

        // Try to infer method + path from the label
        const { method, path } = inferMethodPathFromLabel(node.label, node.source_file)
        endpoints.push({
          method,
          path,
          handler: node.label,
          sourceFile: node.source_file,
        })
      }
    }
  }

  return endpoints
}

/**
 * Infer HTTP method and path from a node label like "POST /api/users" or "getUsers".
 */
function inferMethodPathFromLabel(label: string, sourceFile: string): { method: string; path: string } {
  // Check for explicit method prefix like "GET /api/..." or "POST /api/..."
  const explicitMatch = label.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/\S+)/i)
  if (explicitMatch) {
    return { method: explicitMatch[1].toUpperCase(), path: explicitMatch[2] }
  }

  // Check for path-like strings in the label
  const pathMatch = label.match(/(\/api\/\S+|\/v\d+\/\S+)/i)
  if (pathMatch) {
    // Guess method from name
    const lower = label.toLowerCase()
    const method = lower.includes('create') || lower.includes('post') ? 'POST'
      : lower.includes('update') || lower.includes('put') || lower.includes('patch') ? 'PUT'
      : lower.includes('delete') || lower.includes('remove') ? 'DELETE'
      : 'GET'
    return { method, path: pathMatch[1] }
  }

  // Infer from filename: e.g. "src/routes/users.ts" -> "/api/users"
  const fileMatch = sourceFile.match(/(?:routes?|controllers?|handlers?)[/\\](.+?)(?:\.ts|\.js|\.py)?$/i)
  if (fileMatch) {
    const segment = fileMatch[1].replace(/[/\\]/g, '/').replace(/\.(route|controller|handler)s?$/i, '')
    return { method: 'GET', path: `/api/${segment}` }
  }

  return { method: 'UNKNOWN', path: `/${label}` }
}

/**
 * Extract entity schemas with fields from the knowledge graph.
 *
 * Filtering strategy (in priority order):
 *  1. OpenAPI /openapi.json schema definitions (most authoritative)
 *  2. Graph nodes with kind=schema|interface|class that pass isLikelyDomainEntity()
 *  3. Graph nodes with kind=interface|class that have >= 2 field children
 * All candidates are run through isLikelyDomainEntity() to discard code
 * artifacts, filenames, function names, and generic variable names.
 */
async function extractEntities(engine: GraphEngine, ctx: SystestContext): Promise<EntityInfo[]> {
  const entities: EntityInfo[] = []
  const seen = new Set<string>()

  // -------------------------------------------------------------------------
  // Step A: Collect authoritative domain names from OpenAPI if available
  // -------------------------------------------------------------------------
  let openApiNames = new Set<string>()
  if (ctx.backendUrl) {
    console.log('[Phase 2]   Attempting OpenAPI entity extraction...')
    const names = await fetchOpenApiEntities(ctx.backendUrl)
    openApiNames = new Set(names)
    console.log(`[Phase 2]   OpenAPI entities found: ${openApiNames.size}`)
  }

  // -------------------------------------------------------------------------
  // Helper: build an EntityInfo from a graph node
  // -------------------------------------------------------------------------
  function buildEntityFromNode(node: any, tableName?: string, schemaType?: string): EntityInfo {
    const neighbors = engine.getNeighbors(node.label, 1)
    const fields: EntityFieldInfo[] = []

    for (const succ of neighbors.successors) {
      if (isNoisySource(succ.source_file)) continue
      if (
        succ.relation === 'has_field' ||
        succ.relation === 'has_column' ||
        succ.relation === 'contains'
      ) {
        const fieldName = succ.label
        if (!fields.some(f => f.name === fieldName)) {
          fields.push({ name: fieldName, type: 'unknown' })
        }
      }
    }

    // Supplement with same-file field/column kind nodes
    for (const kindName of ['field', 'column'] as const) {
      const kindNodes = engine.getNodesByKind(kindName)
      for (const kn of kindNodes) {
        if (isNoisySource(kn.source_file)) continue
        if (kn.source_file !== node.source_file) continue
        if (!fields.some(f => f.name === kn.label)) {
          fields.push({
            name: kn.label,
            type: (kn as any).field_type || 'unknown',
            optional: (kn as any).optional,
            constraints: (kn as any).constraints,
          })
        }
      }
    }

    return {
      name: node.label,
      fields,
      sourceFile: node.source_file,
      tableName,
      schemaType,
    }
  }

  // -------------------------------------------------------------------------
  // Step B: Primary — graph schema-kind nodes
  // -------------------------------------------------------------------------
  const schemas = engine.getSchemas()
  for (const schema of schemas) {
    if (isNoisySource(schema.source_file)) continue

    // Unwrap composite labels like "aiModelKeysTable → ai_model_keys"
    // by taking only the part after "→" as a candidate name, or skip if
    // neither part passes the domain filter.
    let candidateName = schema.label
    if (candidateName.includes('→')) {
      // Try the table name (after →) — it is snake_case, not PascalCase,
      // so also skip it and prefer the schema_type if available.
      const after = candidateName.split('→')[1]?.trim()
      const schemaTypeName = schema.schema_type
        ? schema.schema_type.replace(/_/g, '')
        : null
      // Convert snake_case table name to PascalCase for the domain check
      const pascalFromTable = after
        ? after.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
        : null
      if (schemaTypeName && isLikelyDomainEntity(schemaTypeName)) {
        candidateName = schemaTypeName
      } else if (pascalFromTable && isLikelyDomainEntity(pascalFromTable)) {
        candidateName = pascalFromTable
      } else {
        // Neither part is a clean domain name — skip
        continue
      }
    }

    if (!isLikelyDomainEntity(candidateName)) continue
    if (seen.has(candidateName)) continue
    seen.add(candidateName)

    const entity = buildEntityFromNode(schema, schema.table_name, schema.schema_type)
    entity.name = candidateName
    entities.push(entity)
  }

  // -------------------------------------------------------------------------
  // Step C: Supplement — interface/class nodes that look like domain models
  // -------------------------------------------------------------------------
  for (const kindName of ['interface', 'class'] as const) {
    const kindNodes = engine.getNodesByKind(kindName)
    for (const node of kindNodes) {
      if (isNoisySource(node.source_file)) continue
      if (!isLikelyDomainEntity(node.label)) continue
      if (seen.has(node.label)) continue

      // Require at least 2 field children to avoid picking up utility classes/interfaces
      const neighbors = engine.getNeighbors(node.label, 1)
      const fieldChildren = neighbors.successors.filter(
        s => !isNoisySource(s.source_file) &&
          (s.relation === 'has_field' || s.relation === 'contains' || (s as any).kind === 'field'),
      )
      if (fieldChildren.length < 2 && !openApiNames.has(node.label)) continue

      seen.add(node.label)
      entities.push(buildEntityFromNode(node))
    }
  }

  // -------------------------------------------------------------------------
  // Step D: OpenAPI-authoritative entities not yet found in the graph
  // -------------------------------------------------------------------------
  for (const name of openApiNames) {
    if (seen.has(name)) continue
    seen.add(name)
    // No graph node — record with empty fields; later phases can enrich
    entities.push({
      name,
      fields: [],
      sourceFile: '(openapi)',
      schemaType: 'api_spec',
    })
  }

  // -------------------------------------------------------------------------
  // Step E: Last-resort fallback — only if we found nothing at all
  // -------------------------------------------------------------------------
  if (entities.length === 0) {
    const queryResult = engine.query('model schema entity interface type', 'bfs', 100)
    for (const node of queryResult.nodes) {
      if (isNoisySource(node.source_file)) continue
      if (!isLikelyDomainEntity(node.label)) continue
      if (seen.has(node.label)) continue

      // Require that the node has at least one field child
      const neighbors = engine.getNeighbors(node.label, 1)
      const hasFields = neighbors.successors.some(
        s => !isNoisySource(s.source_file) &&
          (s.relation === 'has_field' || s.relation === 'has_column' || s.relation === 'contains'),
      )
      if (!hasFields) continue

      seen.add(node.label)
      entities.push(buildEntityFromNode(node))
    }
  }

  return entities
}

/**
 * Extract service layer nodes from the graph.
 */
function extractServices(engine: GraphEngine): ServiceInfo[] {
  const services: ServiceInfo[] = []
  const seen = new Set<string>()

  const queryResult = engine.query('service handler manager provider repository', 'bfs', 100)
  for (const node of queryResult.nodes) {
    if (isNoisySource(node.source_file)) continue
    const label = node.label.toLowerCase()
    if (
      label.includes('service') ||
      label.includes('handler') ||
      label.includes('manager') ||
      label.includes('provider') ||
      label.includes('repository')
    ) {
      if (seen.has(node.label)) continue
      seen.add(node.label)

      // Get dependencies
      const neighbors = engine.getNeighbors(node.label, 1)
      const dependsOn = neighbors.successors
        .filter(s => !isNoisySource(s.source_file))
        .map(s => s.label)
        .slice(0, 10)

      services.push({
        name: node.label,
        sourceFile: node.source_file,
        dependsOn,
      })
    }
  }

  return services
}

// ---------------------------------------------------------------------------
// Architecture detection
// ---------------------------------------------------------------------------

/**
 * Detect if workspace is a monorepo (has apps/ directory) or standard.
 */
function detectArchitecture(ctx: SystestContext): ArchitectureInfo {
  const appsDir = join(ctx.workspace, 'apps')
  const packagesDir = join(ctx.workspace, 'packages')

  // Check for monorepo indicators
  if (existsSync(appsDir)) {
    try {
      const apps = readdirSync(appsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
      if (apps.length > 0) {
        return { type: 'monorepo', apps }
      }
    } catch {}
  }

  if (existsSync(packagesDir)) {
    try {
      const packages = readdirSync(packagesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
      if (packages.length > 0) {
        return { type: 'monorepo', apps: packages }
      }
    } catch {}
  }

  // Check for workspace field in package.json
  const pkgPath = join(ctx.workspace, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      if (pkg.workspaces) {
        return { type: 'monorepo', apps: Array.isArray(pkg.workspaces) ? pkg.workspaces : [] }
      }
    } catch {}
  }

  return { type: 'standard', apps: [] }
}

// ---------------------------------------------------------------------------
// File-based fallback (when engine is not available)
// ---------------------------------------------------------------------------

async function loadKnowledgeGraphFromFile(ctx: SystestContext): Promise<any> {
  const graphPath = join(ctx.workspace, 'graphify-out', 'graph.json')
  if (!existsSync(graphPath)) return null
  try {
    return JSON.parse(readFileSync(graphPath, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Fallback: analyze from raw graph.json when engine is not loaded.
 */
function analyzeFromRawGraph(graphData: any, ctx: SystestContext): ProjectStructure {
  const nodes: any[] = graphData.nodes || []
  const edges: any[] = graphData.links || graphData.edges || []

  const endpoints: EndpointInfo[] = []
  const entities: EntityInfo[] = []
  const services: ServiceInfo[] = []

  for (const node of nodes) {
    const sf = String(node.source_file || node.sourceFile || '')
    if (isNoisySource(sf)) continue

    const label = String(node.label || '')
    const kind = String(node.kind || '')
    const lower = label.toLowerCase()

    // Routes
    if (kind === 'route' && node.http_method && node.url_path) {
      endpoints.push({
        method: String(node.http_method).toUpperCase(),
        path: String(node.url_path),
        handler: label,
        sourceFile: sf,
      })
    } else if (lower.includes('route') || lower.includes('controller') || lower.includes('endpoint')) {
      const { method, path } = inferMethodPathFromLabel(label, sf)
      endpoints.push({ method, path, handler: label, sourceFile: sf })
    }

    // Schemas — apply domain entity filter to avoid code artifacts
    if (kind === 'schema' || kind === 'interface' || kind === 'class' ||
        (lower.includes('model') || lower.includes('entity') || lower.includes('schema'))) {
      // Unwrap composite table-ref labels (e.g. "xyzTable → xyz_table")
      let candidateName = label
      if (candidateName.includes('→')) {
        const after = candidateName.split('→')[1]?.trim()
        const pascal = after
          ? after.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
          : null
        if (pascal && isLikelyDomainEntity(pascal)) {
          candidateName = pascal
        } else {
          candidateName = ''
        }
      }
      if (candidateName && isLikelyDomainEntity(candidateName)) {
        entities.push({
          name: candidateName,
          fields: [],
          sourceFile: sf,
          tableName: node.table_name ? String(node.table_name) : undefined,
          schemaType: node.schema_type ? String(node.schema_type) : undefined,
        })
      }
    }

    // Services
    if (lower.includes('service') || lower.includes('handler') || lower.includes('manager')) {
      services.push({
        name: label,
        sourceFile: sf,
        dependsOn: [],
      })
    }
  }

  const architecture = detectArchitecture(ctx)
  const communitySet = new Set(nodes.map((n: any) => String(n.community || '')).filter(Boolean))

  return {
    endpoints,
    entities,
    services,
    architecture,
    graphStats: {
      nodes: nodes.length,
      edges: edges.length,
      communities: communitySet.size,
      kindBreakdown: {},
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logSummary(structure: ProjectStructure, outputPath: string): void {
  console.log('[Phase 2] ================================================')
  console.log('[Phase 2] Phase 2 Complete!')
  console.log(`[Phase 2]   API endpoints: ${structure.endpoints.length}`)
  console.log(`[Phase 2]   Entities: ${structure.entities.length}`)
  console.log(`[Phase 2]   Services: ${structure.services.length}`)
  console.log(`[Phase 2]   Architecture: ${structure.architecture.type}`)
  if (structure.architecture.apps.length > 0) {
    console.log(`[Phase 2]   Apps: ${structure.architecture.apps.join(', ')}`)
  }
  console.log(`[Phase 2]   Graph: ${structure.graphStats.nodes} nodes, ${structure.graphStats.edges} edges, ${structure.graphStats.communities} communities`)
  console.log(`[Phase 2]   Output: ${outputPath}`)
  console.log('[Phase 2] ================================================')
}

/**
 * Analyze without graph (fallback)
 */
async function analyzeWithoutGraph(ctx: SystestContext, logsDir: string, outputs: string[]): Promise<PhaseResult> {
  console.log('[Phase 2] Using empty structure (graph not available)...')

  const architecture = detectArchitecture(ctx)
  const structure: ProjectStructure = {
    endpoints: [],
    entities: [],
    services: [],
    architecture,
    graphStats: { nodes: 0, edges: 0, communities: 0, kindBreakdown: {} },
  }

  const outputPath = join(logsDir, 'project-structure.json')
  writeFileSync(outputPath, JSON.stringify(structure, null, 2), 'utf-8')
  outputs.push(outputPath)

  logSummary(structure, outputPath)

  return {
    status: 'completed',
    outputs,
    duration: 0,
  }
}
