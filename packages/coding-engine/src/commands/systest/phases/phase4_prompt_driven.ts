/**
 * Phase 4: Test Case Generation (Graphify Implementation)
 *
 * Uses Meta Coder's built-in graphify knowledge graph + OpenAPI spec
 * to generate comprehensive, prioritized test cases.
 */

import { join } from 'node:path'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import type { SystestContext, PhaseResult } from './orchestrator.js'

/** Phase4Result is an alias for PhaseResult with architecture-specific fields */
export type Phase4Result = PhaseResult

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MergedEndpoint {
  path: string
  method: string
  description: string
  requestBody?: any
  responseSchema?: any
  authRequired: 'none' | 'bearer' | 'admin'
  source: 'openapi' | 'graph' | 'design'
  tags?: string[]
  parameters?: any[]
}

interface GeneratedTestCase {
  id: string
  endpoint: string
  method: string
  description: string
  requestBody?: any
  auth: 'none' | 'bearer' | 'admin'
  expectedStatus: number
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  category: string
  tags?: string[]
}

interface ArchitectureInfo {
  type: 'separated' | 'monolith' | 'ssr' | 'static' | 'unknown'
  hasAppsDir: boolean
  hasDockerfile: boolean
  hasDockerCompose: boolean
  backendFramework?: string
  frontendFramework?: string
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Execute Phase 4: Test Case Generation
 */
export async function executePhase4(ctx: SystestContext): Promise<PhaseResult> {
  const startTime = Date.now()
  const outputs: string[] = []

  console.log('[Phase 4] ================================================')
  console.log('[Phase 4] Phase 4: Test Case Generation (Enhanced)')
  console.log('[Phase 4] ================================================')
  console.log('[Phase 4]')

  const logsDir = join(ctx.outputDir, 'test-cases')
  try { mkdirSync(logsDir, { recursive: true }) } catch {}

  try {
    // Step 1: Load design analysis from Phase 1
    console.log('[Phase 4] Step 1: Loading design analysis...')
    const designAnalysis = await loadJson(join(ctx.outputDir, 'config', 'design-analysis.json'))
    console.log('[Phase 4]   Design specs:', designAnalysis?.apiSpecifications?.length || 0, 'APIs')

    // Step 2: Load project structure from Phase 2
    console.log('[Phase 4] Step 2: Loading project structure...')
    const projectStructure = await loadJson(join(ctx.outputDir, 'config', 'project-structure.json'))
    console.log('[Phase 4]   Modules:', projectStructure?.modules?.length || 0)

    // Step 3: Detect architecture
    console.log('[Phase 4] Step 3: Detecting architecture...')
    const architecture = detectArchitecture(ctx.workspace)
    console.log('[Phase 4]   Architecture:', architecture.type)
    console.log('[Phase 4]   Docker:', architecture.hasDockerfile ? 'yes' : 'no')
    console.log('[Phase 4]   Monorepo (apps/):', architecture.hasAppsDir ? 'yes' : 'no')

    // Step 4: Fetch OpenAPI spec if backendUrl is available
    console.log('[Phase 4] Step 4: Fetching OpenAPI spec...')
    let openApiSpec: any = null
    if (ctx.backendUrl) {
      openApiSpec = await fetchOpenApiSpec(ctx.backendUrl)
      if (openApiSpec) {
        const pathCount = Object.keys(openApiSpec.paths || {}).length
        console.log('[Phase 4]   OpenAPI paths:', pathCount)
      } else {
        console.log('[Phase 4]   OpenAPI spec not available, using graph-discovered endpoints')
      }
    } else {
      console.log('[Phase 4]   No backendUrl configured, skipping OpenAPI fetch')
    }

    // Step 5: Merge endpoints from all sources
    console.log('[Phase 4] Step 5: Merging endpoints from all sources...')
    const mergedEndpoints = mergeEndpoints(openApiSpec, projectStructure, designAnalysis)
    console.log('[Phase 4]   Merged endpoints:', mergedEndpoints.length)

    // Step 6: Generate rich test cases
    console.log('[Phase 4] Step 6: Generating test cases...')
    const testCases = generateTestCases(mergedEndpoints, designAnalysis, projectStructure, ctx)

    // Step 7: Save results
    const testCasesPath = join(logsDir, 'generated-test-cases.json')
    const fullOutput = {
      $schema: 'meta-coder-systest-test-cases',
      _version: '2.0.0',
      generated_at: new Date().toISOString(),
      architecture,
      sources: {
        openapi: openApiSpec != null,
        graphEndpoints: (projectStructure?.endpoints?.length || 0) > 0,
        designApis: (designAnalysis?.apiSpecifications?.length || 0) > 0,
      },
      total: testCases.length,
      byPriority: countByPriority(testCases),
      byCategory: countByCategory(testCases),
      apiTests: testCases.filter(t => t.category === 'api'),
      entityTests: testCases.filter(t => t.category === 'entity'),
      businessTests: testCases.filter(t => t.category === 'business'),
      validationTests: testCases.filter(t => t.category === 'validation'),
      authTests: testCases.filter(t => t.category === 'auth'),
      edgeCaseTests: testCases.filter(t => t.category === 'edge'),
    }

    writeFileSync(testCasesPath, JSON.stringify(fullOutput, null, 2), 'utf-8')
    outputs.push(testCasesPath)

    // Also save architecture info separately for downstream phases
    const archPath = join(ctx.outputDir, 'config', 'architecture.json')
    writeFileSync(archPath, JSON.stringify(architecture, null, 2), 'utf-8')
    outputs.push(archPath)

    console.log('[Phase 4] ================================================')
    console.log('[Phase 4] Phase 4 Complete!')
    console.log('[Phase 4]   Total test cases:', fullOutput.total)
    console.log('[Phase 4]   - API tests:', fullOutput.apiTests.length)
    console.log('[Phase 4]   - Entity tests:', fullOutput.entityTests.length)
    console.log('[Phase 4]   - Business tests:', fullOutput.businessTests.length)
    console.log('[Phase 4]   - Validation tests:', fullOutput.validationTests.length)
    console.log('[Phase 4]   - Auth tests:', fullOutput.authTests.length)
    console.log('[Phase 4]   - Edge case tests:', fullOutput.edgeCaseTests.length)
    console.log('[Phase 4]   By priority:', JSON.stringify(fullOutput.byPriority))
    console.log('[Phase 4]   Output:', testCasesPath)
    console.log('[Phase 4] ================================================')

    return {
      status: 'completed',
      outputs,
      duration: Date.now() - startTime,
      architecture: architecture.type,
      skipPhase5B: architecture.type !== 'separated',
    }
  } catch (error) {
    console.error('[Phase 4] Error:', error)
    return {
      status: 'failed',
      outputs,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ---------------------------------------------------------------------------
// JSON loader
// ---------------------------------------------------------------------------

async function loadJson(path: string): Promise<any> {
  if (!existsSync(path)) return null
  try {
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// OpenAPI fetching
// ---------------------------------------------------------------------------

async function fetchOpenApiSpec(backendUrl: string): Promise<any> {
  const urls = [
    `${backendUrl}/openapi.json`,
    `${backendUrl}/api/openapi.json`,
    `${backendUrl}/swagger.json`,
    `${backendUrl}/api-docs`,
    `${backendUrl}/docs/openapi.json`,
  ]

  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)

      if (res.ok) {
        const spec = await res.json()
        if (spec && (spec.paths || spec.openapi || spec.swagger)) {
          console.log(`[Phase 4]   Found OpenAPI spec at: ${url}`)
          return spec
        }
      }
    } catch {
      // try next URL
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Architecture detection
// ---------------------------------------------------------------------------

function detectArchitecture(workspace: string): ArchitectureInfo {
  const hasAppsDir = existsSync(join(workspace, 'apps'))
  const hasDockerfile = existsSync(join(workspace, 'Dockerfile'))
  const hasDockerCompose = existsSync(join(workspace, 'docker-compose.yml'))
    || existsSync(join(workspace, 'docker-compose.yaml'))
    || existsSync(join(workspace, 'compose.yml'))
    || existsSync(join(workspace, 'compose.yaml'))

  // Check for common framework indicators
  const packageJsonPath = join(workspace, 'package.json')
  let backendFramework: string | undefined
  let frontendFramework: string | undefined

  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (deps['express']) backendFramework = 'express'
      else if (deps['fastify']) backendFramework = 'fastify'
      else if (deps['hono']) backendFramework = 'hono'
      else if (deps['koa']) backendFramework = 'koa'
      else if (deps['nestjs'] || deps['@nestjs/core']) backendFramework = 'nestjs'

      if (deps['next']) frontendFramework = 'next'
      else if (deps['nuxt']) frontendFramework = 'nuxt'
      else if (deps['react']) frontendFramework = 'react'
      else if (deps['vue']) frontendFramework = 'vue'
      else if (deps['svelte'] || deps['@sveltejs/kit']) frontendFramework = 'svelte'
    } catch {}
  }

  // Also check for Python backends
  if (!backendFramework) {
    if (existsSync(join(workspace, 'requirements.txt')) || existsSync(join(workspace, 'pyproject.toml'))) {
      try {
        const reqPath = existsSync(join(workspace, 'requirements.txt'))
          ? join(workspace, 'requirements.txt')
          : join(workspace, 'pyproject.toml')
        const content = readFileSync(reqPath, 'utf-8')
        if (content.includes('fastapi')) backendFramework = 'fastapi'
        else if (content.includes('django')) backendFramework = 'django'
        else if (content.includes('flask')) backendFramework = 'flask'
      } catch {}
    }
  }

  // Determine architecture type
  let type: ArchitectureInfo['type'] = 'unknown'
  if (hasAppsDir) {
    type = 'separated'  // monorepo with apps/ typically means separated frontend/backend
  } else if (frontendFramework === 'next' || frontendFramework === 'nuxt' || frontendFramework === 'svelte') {
    type = 'ssr'
  } else if (backendFramework && frontendFramework) {
    type = 'separated'
  } else if (backendFramework && !frontendFramework) {
    type = 'monolith'
  } else if (!backendFramework && frontendFramework) {
    type = 'static'
  }

  return {
    type,
    hasAppsDir,
    hasDockerfile,
    hasDockerCompose,
    backendFramework,
    frontendFramework,
  }
}

// ---------------------------------------------------------------------------
// Endpoint merging
// ---------------------------------------------------------------------------

function mergeEndpoints(openApiSpec: any, projectStructure: any, designAnalysis: any): MergedEndpoint[] {
  const endpointMap = new Map<string, MergedEndpoint>()

  // Source 1: OpenAPI spec (authoritative, has request body schemas)
  if (openApiSpec?.paths) {
    for (const [path, methods] of Object.entries<any>(openApiSpec.paths)) {
      for (const [method, operation] of Object.entries<any>(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          const key = `${method.toUpperCase()} ${path}`
          const requestBody = extractRequestBodySchema(operation, openApiSpec)
          const authRequired = detectAuthRequirement(operation)

          endpointMap.set(key, {
            path,
            method: method.toUpperCase(),
            description: operation.summary || operation.description || '',
            requestBody,
            responseSchema: extractResponseSchema(operation, openApiSpec),
            authRequired,
            source: 'openapi',
            tags: operation.tags || [],
            parameters: operation.parameters || [],
          })
        }
      }
    }
  }

  // Source 2: Graph-discovered endpoints from Phase 2
  const graphEndpoints = projectStructure?.endpoints || projectStructure?.apiEndpoints || []
  for (const ep of graphEndpoints) {
    const method = (ep.method || 'GET').toUpperCase()
    const path = ep.path || ep.endpoint || ep.url || ''
    if (!path) continue
    // Validate endpoint path: must start with "/" and contain no spaces, method must not be UNKNOWN
    if (!path.startsWith('/') || path.includes(' ') || method === 'UNKNOWN') {
      console.log(`[Phase 4] Skipping invalid endpoint: ${method} ${path}`)
      continue
    }
    const key = `${method} ${path}`
    if (!endpointMap.has(key)) {
      endpointMap.set(key, {
        path,
        method,
        description: ep.description || ep.handler || '',
        authRequired: ep.auth ? 'bearer' : 'none',
        source: 'graph',
        tags: ep.tags || [],
      })
    }
  }

  // Source 3: Design doc APIs from Phase 1
  const designApis = designAnalysis?.apiSpecifications || []
  for (const api of designApis) {
    // Design docs often have format like "POST /api/users" or just a description
    const parts = (api.endpoint || '').match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)/i)
    const method = parts ? parts[1].toUpperCase() : (api.method || 'GET').toUpperCase()
    const path = parts ? parts[2].trim() : (api.path || api.endpoint || '')
    if (!path) continue
    const key = `${method} ${path}`
    if (!endpointMap.has(key)) {
      endpointMap.set(key, {
        path,
        method,
        description: api.description || '',
        authRequired: api.auth ? 'bearer' : 'none',
        source: 'design',
        tags: [],
      })
    }
  }

  return Array.from(endpointMap.values())
}

function extractRequestBodySchema(operation: any, spec: any): any {
  const content = operation?.requestBody?.content
  if (!content) return undefined

  const mediaType = content['application/json'] || content['multipart/form-data'] || Object.values(content)[0]
  if (!mediaType?.schema) return undefined

  return resolveSchemaRef(mediaType.schema, spec)
}

function extractResponseSchema(operation: any, spec: any): any {
  const responses = operation?.responses
  if (!responses) return undefined

  // Prefer 200/201 response
  const successResponse = responses['200'] || responses['201'] || responses['2XX']
  if (!successResponse) return undefined

  const content = successResponse.content
  if (!content) return undefined

  const mediaType = content['application/json'] || Object.values(content)[0]
  if (!mediaType?.schema) return undefined

  return resolveSchemaRef(mediaType.schema, spec)
}

function resolveSchemaRef(schema: any, spec: any, depth = 0): any {
  if (!schema || depth > 5) return schema

  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/', '').split('/')
    let resolved: any = spec
    for (const segment of refPath) {
      resolved = resolved?.[segment]
    }
    return resolved ? resolveSchemaRef(resolved, spec, depth + 1) : schema
  }

  if (schema.type === 'object' && schema.properties) {
    const resolved: any = { ...schema, properties: {} }
    for (const [key, val] of Object.entries<any>(schema.properties)) {
      resolved.properties[key] = resolveSchemaRef(val, spec, depth + 1)
    }
    return resolved
  }

  if (schema.type === 'array' && schema.items) {
    return { ...schema, items: resolveSchemaRef(schema.items, spec, depth + 1) }
  }

  return schema
}

function detectAuthRequirement(operation: any): 'none' | 'bearer' | 'admin' {
  const security = operation.security
  if (!security || security.length === 0) return 'none'

  // Check for admin-level scopes
  for (const sec of security) {
    for (const scopes of Object.values<any>(sec)) {
      if (Array.isArray(scopes) && scopes.some(s => /admin/i.test(s))) {
        return 'admin'
      }
    }
  }

  return 'bearer'
}

// ---------------------------------------------------------------------------
// Test case generation
// ---------------------------------------------------------------------------

function generateTestCases(
  endpoints: MergedEndpoint[],
  designAnalysis: any,
  projectStructure: any,
  ctx: SystestContext,
): GeneratedTestCase[] {
  const cases: GeneratedTestCase[] = []
  let idCounter = 1

  const nextId = (prefix: string) => `${prefix}-${String(idCounter++).padStart(3, '0')}`

  // --- Category 1: API happy-path tests (P0) ---
  for (const ep of endpoints) {
    cases.push({
      id: nextId('API'),
      endpoint: ep.path,
      method: ep.method,
      description: `${ep.method} ${ep.path} - happy path${ep.description ? ': ' + ep.description : ''}`,
      requestBody: ep.requestBody ? generateSampleBody(ep.requestBody) : undefined,
      auth: ep.authRequired,
      expectedStatus: ep.method === 'POST' ? 201 : 200,
      priority: 'P0',
      category: 'api',
      tags: ep.tags,
    })
  }

  // --- Category 2: Validation tests (P1) ---
  for (const ep of endpoints) {
    if (!['POST', 'PUT', 'PATCH'].includes(ep.method)) continue

    // Missing required fields
    if (ep.requestBody?.required?.length) {
      for (const field of ep.requestBody.required.slice(0, 3)) {
        cases.push({
          id: nextId('VAL'),
          endpoint: ep.path,
          method: ep.method,
          description: `${ep.method} ${ep.path} - missing required field: ${field}`,
          requestBody: { _omit: field },
          auth: ep.authRequired,
          expectedStatus: 422,
          priority: 'P1',
          category: 'validation',
        })
      }
    }

    // Invalid field types
    if (ep.requestBody?.properties) {
      for (const [field, schema] of Object.entries<any>(ep.requestBody.properties).slice(0, 3)) {
        cases.push({
          id: nextId('VAL'),
          endpoint: ep.path,
          method: ep.method,
          description: `${ep.method} ${ep.path} - invalid type for field: ${field}`,
          requestBody: { [field]: generateInvalidValue(schema) },
          auth: ep.authRequired,
          expectedStatus: 422,
          priority: 'P1',
          category: 'validation',
        })
      }
    }

    // Empty body
    cases.push({
      id: nextId('VAL'),
      endpoint: ep.path,
      method: ep.method,
      description: `${ep.method} ${ep.path} - empty request body`,
      requestBody: {},
      auth: ep.authRequired,
      expectedStatus: 422,
      priority: 'P1',
      category: 'validation',
    })
  }

  // --- Category 3: Auth tests (P1) ---
  for (const ep of endpoints) {
    if (ep.authRequired === 'none') continue

    // Unauthenticated access
    cases.push({
      id: nextId('AUTH'),
      endpoint: ep.path,
      method: ep.method,
      description: `${ep.method} ${ep.path} - unauthenticated access`,
      auth: 'none',
      expectedStatus: 401,
      priority: 'P1',
      category: 'auth',
    })

    // If admin-only, test with regular user token
    if (ep.authRequired === 'admin') {
      cases.push({
        id: nextId('AUTH'),
        endpoint: ep.path,
        method: ep.method,
        description: `${ep.method} ${ep.path} - regular user accessing admin endpoint`,
        auth: 'bearer',
        expectedStatus: 403,
        priority: 'P1',
        category: 'auth',
      })
    }
  }

  // --- Category 4: Entity CRUD tests (P0) ---
  const entities = designAnalysis?.entityDefinitions || projectStructure?.entities || []
  for (const entity of entities) {
    const entityName = entity.name || entity.entityName || 'unknown'
    const basePath = `/api/${entityName.toLowerCase()}s`

    for (const op of ['create', 'read', 'update', 'delete', 'list'] as const) {
      const methodMap = { create: 'POST', read: 'GET', update: 'PUT', delete: 'DELETE', list: 'GET' } as const
      const pathMap = { create: basePath, read: `${basePath}/:id`, update: `${basePath}/:id`, delete: `${basePath}/:id`, list: basePath }
      cases.push({
        id: nextId('ENTITY'),
        endpoint: pathMap[op],
        method: methodMap[op],
        description: `${entityName} - ${op} operation`,
        auth: 'bearer',
        expectedStatus: op === 'create' ? 201 : op === 'delete' ? 204 : 200,
        priority: 'P0',
        category: 'entity',
      })
    }
  }

  // --- Category 5: Business rule tests (P2) ---
  const rules = designAnalysis?.businessRules || []
  for (const rule of rules) {
    cases.push({
      id: nextId('BIZ'),
      endpoint: rule.endpoint || '/api/unknown',
      method: rule.method || 'POST',
      description: `Business rule: ${(rule.description || 'rule validation').substring(0, 80)}`,
      auth: 'bearer',
      expectedStatus: rule.expectedStatus || 400,
      priority: 'P2',
      category: 'business',
    })
  }

  // --- Category 6: Edge case tests (P3) ---
  const edgeCases = [
    { desc: 'SQL injection in query parameter', payload: { q: "'; DROP TABLE users; --" }, status: 400 },
    { desc: 'XSS in text field', payload: { name: '<script>alert("xss")</script>' }, status: 422 },
    { desc: 'Excessively long string input', payload: { name: 'x'.repeat(10000) }, status: 422 },
    { desc: 'Unicode/emoji in text field', payload: { name: '\u{1F4A9}\u{1F525}\u{1F680}' }, status: 200 },
    { desc: 'Negative numeric value', payload: { count: -1 }, status: 422 },
    { desc: 'Zero as numeric value', payload: { count: 0 }, status: 200 },
    { desc: 'Float where integer expected', payload: { count: 1.5 }, status: 422 },
    { desc: 'Non-existent resource by ID', payload: {}, status: 404 },
  ]

  // Apply edge cases to a representative POST endpoint (or first write endpoint)
  const writeEndpoint = endpoints.find(e => ['POST', 'PUT', 'PATCH'].includes(e.method))
  if (writeEndpoint) {
    for (const edge of edgeCases) {
      cases.push({
        id: nextId('EDGE'),
        endpoint: writeEndpoint.path,
        method: writeEndpoint.method,
        description: `Edge case: ${edge.desc}`,
        requestBody: edge.payload,
        auth: writeEndpoint.authRequired,
        expectedStatus: edge.status,
        priority: 'P3',
        category: 'edge',
      })
    }
  }

  return cases
}

// ---------------------------------------------------------------------------
// Sample body / invalid value generators
// ---------------------------------------------------------------------------

function generateSampleBody(schema: any): any {
  if (!schema || !schema.properties) return {}

  const body: any = {}
  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    body[key] = generateSampleValue(key, prop)
  }
  return body
}

function generateSampleValue(key: string, schema: any): any {
  const type = schema?.type || 'string'

  switch (type) {
    case 'string':
      if (schema.format === 'email' || key.toLowerCase().includes('email')) return 'test@example.com'
      if (schema.format === 'uri' || key.toLowerCase().includes('url')) return 'https://example.com'
      if (schema.format === 'date-time') return new Date().toISOString()
      if (schema.format === 'date') return '2024-01-15'
      if (key.toLowerCase().includes('password')) return 'Test@123456'
      if (key.toLowerCase().includes('name')) return 'Test User'
      if (schema.enum) return schema.enum[0]
      return `test_${key}`
    case 'integer':
    case 'number':
      if (schema.minimum != null) return schema.minimum + 1
      return 1
    case 'boolean':
      return true
    case 'array':
      return [generateSampleValue(key, schema.items || { type: 'string' })]
    case 'object':
      return generateSampleBody(schema)
    default:
      return `test_${key}`
  }
}

function generateInvalidValue(schema: any): any {
  const type = schema?.type || 'string'
  switch (type) {
    case 'string': return 12345         // number instead of string
    case 'integer': return 'not-a-number'
    case 'number': return 'not-a-number'
    case 'boolean': return 'not-a-bool'
    case 'array': return 'not-an-array'
    case 'object': return 'not-an-object'
    default: return null
  }
}

// ---------------------------------------------------------------------------
// Counting helpers
// ---------------------------------------------------------------------------

function countByPriority(cases: GeneratedTestCase[]): Record<string, number> {
  const counts: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 }
  for (const c of cases) counts[c.priority] = (counts[c.priority] || 0) + 1
  return counts
}

function countByCategory(cases: GeneratedTestCase[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of cases) counts[c.category] = (counts[c.category] || 0) + 1
  return counts
}
