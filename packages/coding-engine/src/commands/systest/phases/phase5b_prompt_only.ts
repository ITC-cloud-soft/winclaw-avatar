/**
 * Phase 5B: Comprehensive API Testing
 *
 * Loads test cases from the Phase 5A seed (layer1Tests, layer2Tests, scenarios)
 * and executes them against the running backend via Chrome MCP or direct HTTP.
 *
 * Flow:
 *   1. Load test_data_seed.json  (layer1Tests, layer2Tests, auth credentials)
 *   2. Optionally discover endpoints from OpenAPI (/openapi.json)
 *   3. Discover auth endpoints from OpenAPI spec (project-agnostic)
 *   4. Acquire JWT tokens for all roles in seed (auth, auth_admin, etc.)
 *   5. Sort Layer 1 tests by CRUD lifecycle (POST before GET/PUT/DELETE)
 *   6. Execute Layer 1 tests with per-endpoint token selection
 *   7. Execute Layer 2 + scenario tests with role-based auth
 *   8. Track 500 errors as needsFix for auto-fix reporting
 *   9. Write structured results JSON
 */
import { join } from 'node:path'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import type { SystestContext, PhaseResult } from './orchestrator.js'
import {
  executeApiTestWithRetry,
  isChromeMcpAvailable,
  callMcpTool,
} from '../../../services/systest/claudeInChromeExecutor.js'
import { canRunAiSession, runAiTestFixSession, buildPhase5BPrompt, type AiSessionResult } from '../../../services/systest/aiTestFixSession.js'
import { installPhase5BTestRunner } from '../../../services/systest/resourceInstaller.js'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TestResult {
  id: string
  name: string
  endpoint: string
  method: string
  status: 'passed' | 'failed'
  statusCode?: number
  duration: number
  error?: string
  responseBody?: any
  testingMethod: 'chrome-mcp' | 'direct-http'
  needsFix?: boolean
  layer: 'auth' | 'layer1' | 'layer2'
}

interface LayerSummary {
  total: number
  passed: number
  failed: number
  tests: TestResult[]
}

interface TestSummary {
  total: number
  passed: number
  failed: number
  testingMethod: 'chrome-mcp' | 'direct-http'
  chromeMcpAvailable: boolean
  backendUrl: string
  openApiDiscovered: boolean
  layer1: LayerSummary
  layer2: LayerSummary
  results: TestResult[]
}

interface SeedTestCase {
  ID?: string
  id?: string
  Name?: string
  name?: string
  Endpoint?: string
  endpoint?: string
  Method?: string
  method?: string
  Body?: string
  body?: any
  'Expected Status'?: string | number
  expectedStatus?: number
  expected_status?: number
  Description?: string
  description?: string
  Category?: string
  category?: string
  auth_as?: string | null
  payload?: any
  constraint?: string
  [key: string]: any
}

// ─── Entry Point ────────────────────────────────────────────────────────────

export async function executePhase5B(ctx: SystestContext): Promise<PhaseResult> {
  const startTime = Date.now()
  const outputs: string[] = []

  console.log('[Phase 5B] Comprehensive API Testing')

  if (!ctx.backendUrl) {
    return { status: 'skipped', outputs: [], duration: 0, error: 'No backend URL' }
  }

  const logsDir = join(ctx.outputDir, 'test-logs')
  mkdirSync(logsDir, { recursive: true })

  try {
    // ── Load test data seed ──
    const seed = loadTestDataSeed(logsDir)

    // ── Check if AI mode is available ──
    if (canRunAiSession(ctx)) {
      const aiResult = await executeAiTestFixLoop(seed, ctx, logsDir, outputs)
      if (aiResult) return aiResult
      // aiResult is null → AI session failed, fall through to programmatic mode
      console.log('[Phase 5B] AI loop failed — falling back to programmatic mode')
    } else {
      console.log('[Phase 5B] AI session not available — running programmatic test-only mode')
    }

    console.log('[Phase 5B] Seed loaded: L1=' + (seed.layer1Tests?.length || 0) + ' L2=' + (seed.layer2Tests?.length || 0) + ' scenarios=' + countScenarios(seed.scenarios))

    // ── Determine testing method ──
    let chromeMcpAvailable = await isChromeMcpAvailable(ctx.toolUseContext)
    console.log('[Phase 5B] Chrome MCP:', chromeMcpAvailable ? 'AVAILABLE' : 'not available')

    if (chromeMcpAvailable) {
      try {
        const probe = await callMcpTool('mcp__claude-in-chrome__tabs_context_mcp', { createIfEmpty: true })
        const probeTabs = probe.data?.tabs || probe.data?.availableTabs || []
        if (!probe.success || (!probeTabs[0]?.id && !probeTabs[0]?.tabId)) {
          console.log('[Phase 5B] Chrome MCP probe failed - falling back to direct HTTP')
          chromeMcpAvailable = false
        }
      } catch {
        console.log('[Phase 5B] Chrome MCP probe exception - falling back to direct HTTP')
        chromeMcpAvailable = false
      }
    }

    const testingMethod: 'chrome-mcp' | 'direct-http' = chromeMcpAvailable ? 'chrome-mcp' : 'direct-http'
    console.log('[Phase 5B] Testing method:', testingMethod)

    // ── Discover OpenAPI (optional) ──
    const openApiEndpoints = await discoverOpenApi(ctx.backendUrl)
    console.log('[Phase 5B] OpenAPI:', openApiEndpoints ? openApiEndpoints.length + ' endpoints' : 'not available')

    // ── Build results container ──
    const results: TestSummary = {
      total: 0,
      passed: 0,
      failed: 0,
      testingMethod,
      chromeMcpAvailable,
      backendUrl: ctx.backendUrl,
      openApiDiscovered: !!openApiEndpoints,
      layer1: { total: 0, passed: 0, failed: 0, tests: [] },
      layer2: { total: 0, passed: 0, failed: 0, tests: [] },
      results: [],
    }

    // ── Discover auth endpoints from OpenAPI or fall back to common paths ──
    let loginPath = '/api/auth/login'
    let registerPath: string | undefined = '/api/auth/register'

    if (openApiEndpoints) {
      // Try to fetch the raw spec for auth discovery
      const specUrls = ['/openapi.json', '/api-docs', '/swagger.json', '/api/openapi.json']
      for (const specUrl of specUrls) {
        try {
          const res = await fetch(ctx.backendUrl + specUrl, { signal: AbortSignal.timeout(5000) })
          if (res.ok) {
            const spec = await res.json()
            const discovered = discoverAuthEndpoints(spec)
            if (discovered.loginPath) loginPath = discovered.loginPath
            if (discovered.registerPath) registerPath = discovered.registerPath
            console.log('[Phase 5B] Auth endpoints discovered: login=' + loginPath + ' register=' + (registerPath || 'none'))
            break
          }
        } catch { /* try next */ }
      }
    }

    // ── Build OpenAPI metadata for token selection ──
    const openApiMeta = buildOpenApiMeta(openApiEndpoints)

    // ── Auth: acquire tokens for all roles ──
    const createdResourceIds: Record<string, any> = {}
    const tokens = await acquireTokens(loginPath, registerPath, ctx.backendUrl, seed, results, testingMethod, chromeMcpAvailable)
    if (tokens.size > 0) {
      console.log('[Phase 5B] Auth tokens obtained for roles: ' + [...tokens.keys()].join(', '))
    } else {
      console.log('[Phase 5B] No auth tokens - authenticated tests may fail')
    }

    // ── Layer 1 tests ──
    console.log('[Phase 5B] --- Layer 1: Happy-path CRUD ---')
    await executeLayer1Tests(ctx.backendUrl, seed, tokens, openApiMeta, results, testingMethod, chromeMcpAvailable, createdResourceIds)

    // ── Layer 2 tests ──
    console.log('[Phase 5B] --- Layer 2: Auth/Validation/Constraint/Edge ---')
    await executeLayer2Tests(ctx.backendUrl, seed, tokens, openApiMeta, results, testingMethod, chromeMcpAvailable)

    // ── Scenario tests (from seed.scenarios) ──
    console.log('[Phase 5B] --- Scenario tests ---')
    await executeScenarioTests(ctx.backendUrl, seed, tokens, openApiMeta, results, testingMethod, chromeMcpAvailable)

    // ── Write results ──
    const resultsPath = join(logsDir, 'phase5b_results.json')
    writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8')
    outputs.push(resultsPath)

    const passRate = results.total > 0 ? (results.passed / results.total) * 100 : 0
    const needsFixCount = results.results.filter(r => r.needsFix).length
    console.log('[Phase 5B] Complete: ' + results.passed + '/' + results.total + ' passed (' + passRate.toFixed(1) + '%) via ' + testingMethod)
    if (needsFixCount > 0) {
      console.log('[Phase 5B] ' + needsFixCount + ' test(s) returned 500 and need fixing')
    }

    return { status: 'completed', outputs, duration: Date.now() - startTime, passRate }
  } catch (error) {
    console.error('[Phase 5B] Error:', error)
    return { status: 'failed', outputs, duration: Date.now() - startTime, error: String(error) }
  }
}

// ─── AI Test-Fix Loop ──────────────────────────────────────────────────────

async function executeAiTestFixLoop(
  seed: any,
  ctx: SystestContext,
  logsDir: string,
  outputs: string[],
): Promise<PhaseResult> {
  const startTime = Date.now()
  const targetPassRate = ctx.config.global.targetPassRate5b || 95
  const maxIterations = ctx.config.iterationControl?.maxIterations || 10
  const earlyExitThreshold = ctx.config.iterationControl?.earlyExitThreshold || 3

  let currentPassRate = 0
  let iteration = 0
  let noImprovementCount = 0
  let previousPassRate = 0
  let lastResult: AiSessionResult | null = null

  console.log('[Phase 5B] AI Test-Fix Loop: target=' + targetPassRate + '%, max=' + maxIterations + ' iterations')

  do {
    iteration++
    console.log('[Phase 5B] ═══ Iteration ' + iteration + '/' + maxIterations + ' ═══')
    console.log('[Phase 5B] Current pass rate: ' + currentPassRate + '% (target: ' + targetPassRate + '%)')

    // Ensure the runner is pristine before each iteration.
    // An AI session from a previous iteration may have mutated
    // `.systest/phase5b_test_runner.py` (the airlinesys6 failure mode). Re-installing
    // the shipped template on every iteration guarantees the test runner matches
    // what meta-coder expects, regardless of what the agent did last time.
    try {
      await installPhase5BTestRunner(ctx.workspace)
    } catch (e) {
      console.warn(`[Phase 5B] installPhase5BTestRunner failed at iteration ${iteration}: ${(e as Error).message}`)
      // Continue anyway — a previous install may still be usable.
    }

    // Dynamic reseed: analyze previous failures, regenerate test data
    if (iteration > 1 && lastResult) {
      await dynamicReseed(lastResult, seed, ctx, logsDir)
      // Reload seed after reseed
      const updatedSeed = loadTestDataSeed(logsDir)
      Object.assign(seed, updatedSeed)
    }

    // Build prompt for this iteration
    const prompt = buildPhase5BPrompt(seed, ctx, iteration)

    // Run AI session
    console.log('[Phase 5B] Starting AI test-fix session...')
    lastResult = await runAiTestFixSession(prompt, ctx, 50, '5b', iteration)

    currentPassRate = lastResult.passRate
    console.log('[Phase 5B] Iteration ' + iteration + ': ' + lastResult.passed + '/' + lastResult.total + ' (' + currentPassRate + '%) bugs_fixed=' + lastResult.bugsFixed + ' tools=' + lastResult.toolUseCount)

    // If first iteration produced zero results and zero tool use → query() failed
    // Fall back to programmatic mode
    if (iteration === 1 && lastResult.total === 0 && lastResult.toolUseCount === 0) {
      console.log('[Phase 5B] AI session produced no results (query may have failed) — falling back to programmatic mode')
      return null as any  // signal caller to use fallback
    }

    // Save iteration results
    const iterResultPath = join(logsDir, 'phase5b_iteration_' + iteration + '_results.json')
    writeFileSync(iterResultPath, JSON.stringify(lastResult, null, 2))
    outputs.push(iterResultPath)

    // Early exit: no improvement for N consecutive iterations
    if (currentPassRate <= previousPassRate) {
      noImprovementCount++
      console.log('[Phase 5B] No improvement (' + noImprovementCount + '/' + earlyExitThreshold + ')')
      if (noImprovementCount >= earlyExitThreshold) {
        console.log('[Phase 5B] Early exit: no improvement for ' + earlyExitThreshold + ' iterations')
        break
      }
    } else {
      noImprovementCount = 0
      console.log('[Phase 5B] Improved: ' + previousPassRate + '% → ' + currentPassRate + '%')
    }
    previousPassRate = currentPassRate

  } while (currentPassRate < targetPassRate && iteration < maxIterations)

  // Final report
  const achieved = currentPassRate >= targetPassRate
  console.log('[Phase 5B] ═══ COMPLETE ═══')
  console.log('[Phase 5B] Final: ' + currentPassRate + '% (' + iteration + ' iterations)')
  console.log('[Phase 5B] Target ' + targetPassRate + '%: ' + (achieved ? 'ACHIEVED' : 'NOT MET'))

  // Write final results
  const finalPath = join(logsDir, 'phase5b_results.json')
  writeFileSync(finalPath, JSON.stringify({
    ...lastResult,
    iterations: iteration,
    targetPassRate,
    achieved,
  }, null, 2))
  outputs.push(finalPath)

  return {
    status: 'completed',
    outputs,
    duration: Date.now() - startTime,
    passRate: currentPassRate,
    iteration,
  }
}

// ─── Dynamic Reseed ────────────────────────────────────────────────────────

async function dynamicReseed(
  lastResult: AiSessionResult,
  seed: any,
  ctx: SystestContext,
  logsDir: string,
): Promise<void> {
  const failures = lastResult.results.filter((t: any) => t.status === 'failed')
  if (failures.length === 0) return

  const missing404 = failures.filter((t: any) => t.statusCode === 404).length
  const auth401 = failures.filter((t: any) => t.statusCode === 401).length

  console.log('[Phase 5B] Dynamic reseed: ' + failures.length + ' failures (' + missing404 + ' 404s, ' + auth401 + ' 401s)')

  // Refresh auth tokens if we have auth failures
  if (auth401 > 0 && ctx.backendUrl) {
    try {
      const openApiUrls = ['/openapi.json', '/swagger.json', '/api-docs']
      let loginPath: string | undefined
      for (const url of openApiUrls) {
        try {
          const res = await fetch(ctx.backendUrl + url, { signal: AbortSignal.timeout(3000) })
          if (!res.ok) continue
          const spec = await res.json() as any
          for (const [path, methods] of Object.entries(spec.paths || {} as Record<string, any>)) {
            for (const [method, op] of Object.entries(methods as Record<string, any>)) {
              if (method === 'post') {
                const opId = ((op as any).operationId || '').toLowerCase()
                const summary = ((op as any).summary || '').toLowerCase()
                if (opId.includes('login') || summary.includes('log in') || path.includes('login')) {
                  loginPath = path
                }
              }
            }
          }
          break
        } catch {}
      }

      if (loginPath) {
        for (const authKey of Object.keys(seed).filter(k => k.startsWith('auth'))) {
          const cred = seed[authKey]
          if (!cred?.email || !cred?.password) continue
          try {
            const res = await fetch(ctx.backendUrl + loginPath, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: cred.email, password: cred.password }),
              signal: AbortSignal.timeout(10000),
            })
            if (res.ok) {
              const data = await res.json()
              const token = deepExtractJwt(data)
              if (token) {
                cred.token = token
                console.log('[Phase 5B] Refreshed token for', authKey)
              }
            }
          } catch {}
        }
        // Write updated seed
        writeFileSync(join(logsDir, 'test_data_seed.json'), JSON.stringify(seed, null, 2))
      }
    } catch {}
  }
}

/** Recursively search an object for a JWT-shaped string (used by dynamic reseed). */
function deepExtractJwt(obj: any, depth = 0): string | null {
  if (depth > 5 || !obj) return null
  if (typeof obj === 'string' && obj.startsWith('eyJ') && obj.includes('.')) return obj
  if (typeof obj !== 'object') return null
  for (const key of ['accessToken', 'access_token', 'token', 'jwt', 'id_token']) {
    if (obj[key] && typeof obj[key] === 'string' && obj[key].startsWith('eyJ')) return obj[key]
  }
  for (const val of Object.values(obj)) {
    const found = deepExtractJwt(val, depth + 1)
    if (found) return found
  }
  return null
}

// ─── Seed Loading ───────────────────────────────────────────────────────────

function loadTestDataSeed(logsDir: string): any {
  const seedPath = join(logsDir, 'test_data_seed.json')
  if (existsSync(seedPath)) {
    try {
      return JSON.parse(readFileSync(seedPath, 'utf-8'))
    } catch (e) {
      console.warn('[Phase 5B] Failed to parse test_data_seed.json:', e)
    }
  }
  console.warn('[Phase 5B] test_data_seed.json not found, using minimal defaults')
  return {
    auth: { email: 'test_phase5b_' + Date.now() + '@example.com', password: 'Test@123456' },
    auth_admin: { email: 'test_admin_' + Date.now() + '@example.com', password: 'Test@123456' },
    layer1Tests: [],
    layer2Tests: [],
    scenarios: {},
  }
}

function countScenarios(scenarios: any): number {
  if (!scenarios || typeof scenarios !== 'object') return 0
  let count = 0
  for (const key of Object.keys(scenarios)) {
    if (Array.isArray(scenarios[key])) count += scenarios[key].length
  }
  return count
}

// ─── OpenAPI Discovery ──────────────────────────────────────────────────────

interface OpenApiEndpoint {
  path: string
  method: string
  operationId?: string
  tags?: string[]
  requiresAuth?: boolean
}

async function discoverOpenApi(backendUrl: string): Promise<OpenApiEndpoint[] | null> {
  const candidates = ['/openapi.json', '/api-docs', '/swagger.json', '/api/openapi.json']

  for (const candidate of candidates) {
    try {
      const res = await fetch(backendUrl + candidate, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue

      const spec = await res.json()
      const paths = spec.paths || {}
      const endpoints: OpenApiEndpoint[] = []

      for (const [path, methods] of Object.entries(paths) as [string, any][]) {
        for (const [method, operation] of Object.entries(methods) as [string, any][]) {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
            const requiresAuth = !!(operation.security && operation.security.length > 0)
            endpoints.push({
              path,
              method: method.toUpperCase(),
              operationId: operation.operationId,
              tags: operation.tags,
              requiresAuth,
            })
          }
        }
      }

      if (endpoints.length > 0) return endpoints
    } catch {
      // try next candidate
    }
  }
  return null
}

// ─── Deep Token Extraction ─────────────────────────────────────────────────

/** Recursively search an object for a JWT-shaped string. */
function deepExtractToken(obj: any, depth = 0): string | null {
  if (depth > 5 || !obj) return null
  if (typeof obj === 'string' && obj.startsWith('eyJ') && obj.includes('.')) return obj
  if (typeof obj !== 'object') return null
  const priorityKeys = ['accessToken', 'access_token', 'token', 'jwt', 'id_token', 'bearer']
  for (const key of priorityKeys) {
    if (obj[key] && typeof obj[key] === 'string' && obj[key].startsWith('eyJ')) return obj[key]
  }
  for (const val of Object.values(obj)) {
    const found = deepExtractToken(val, depth + 1)
    if (found) return found
  }
  return null
}

// ─── Deep ID Extraction ───────────────────────────────────────────────────

/** Recursively search an object for an ID field. */
function deepExtractId(obj: any, depth = 0): string | number | null {
  if (depth > 4 || !obj || typeof obj !== 'object') return null
  const idKeys = ['id', 'ID', '_id', 'uuid', 'pk', 'key']
  for (const key of idKeys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      const val = obj[key]
      if (typeof val === 'string' || typeof val === 'number') return val
    }
  }
  for (const val of Object.values(obj)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const found = deepExtractId(val, depth + 1)
      if (found) return found
    }
  }
  return null
}

// ─── Endpoint Validation ──────────────────────────────────────────────────

/** Check that an endpoint string looks like a valid HTTP path. */
function isValidHttpEndpoint(endpoint: string, method: string): boolean {
  if (!endpoint || !endpoint.startsWith('/')) return false
  if (/\.(ts|js|tsx|jsx|py|go|rs|java|rb|php)$/i.test(endpoint)) return false
  if (endpoint.includes('(') || endpoint.includes('`') || endpoint.includes('\u2192')) return false
  if (method === 'UNKNOWN') return false
  return true
}

// ─── CRUD Lifecycle Sorting ───────────────────────────────────────────────

/** Sort tests so POST runs before GET/PUT/DELETE for each resource group. */
function sortByCrudLifecycle(tests: SeedTestCase[]): SeedTestCase[] {
  const methodPriority: Record<string, number> = { POST: 1, GET: 2, PUT: 3, PATCH: 3, DELETE: 4 }

  /** Strip parameter segments to get the base resource path. */
  function basePath(endpoint: string): string {
    return (endpoint || '')
      .replace(/\/[:{]\w+\}?/g, '')  // remove /:id, /{id}
      .replace(/\/+$/, '')
  }

  return [...tests].sort((a, b) => {
    const epA = normalizeField(a, 'Endpoint', 'endpoint')
    const epB = normalizeField(b, 'Endpoint', 'endpoint')
    const baseA = basePath(epA)
    const baseB = basePath(epB)

    // Group by base resource path first
    if (baseA !== baseB) return baseA.localeCompare(baseB)

    const methodA = (normalizeField(a, 'Method', 'method') || 'GET').toUpperCase()
    const methodB = (normalizeField(b, 'Method', 'method') || 'GET').toUpperCase()
    const prioA = methodPriority[methodA] ?? 99
    const prioB = methodPriority[methodB] ?? 99
    if (prioA !== prioB) return prioA - prioB

    // Within same method: list (no param) before by-id (has param)
    const hasParamA = /[:{]\w+/.test(epA) ? 1 : 0
    const hasParamB = /[:{]\w+/.test(epB) ? 1 : 0
    return hasParamA - hasParamB
  })
}

// ─── OpenAPI Auth Discovery ───────────────────────────────────────────────

/** Scan an OpenAPI spec for auth-related endpoints by tags, operationId, and summary. */
function discoverAuthEndpoints(openApiSpec: any): { registerPath?: string; loginPath?: string } {
  const paths = openApiSpec?.paths || {}
  let registerPath: string | undefined
  let loginPath: string | undefined

  const registerPatterns = /register|signup|sign.up|create.account/i
  const loginPatterns = /login|signin|sign.in|authenticate|token/i

  for (const [path, methods] of Object.entries(paths) as [string, any][]) {
    for (const [method, operation] of Object.entries(methods) as [string, any][]) {
      if (method.toLowerCase() !== 'post') continue

      const tags = (operation.tags || []).join(' ').toLowerCase()
      const opId = (operation.operationId || '').toLowerCase()
      const summary = (operation.summary || '').toLowerCase()
      const description = (operation.description || '').toLowerCase()
      const searchText = [tags, opId, summary, description].join(' ')

      if (!registerPath && registerPatterns.test(searchText)) {
        registerPath = path
      }
      if (!loginPath && loginPatterns.test(searchText)) {
        loginPath = path
      }
    }
  }

  return { registerPath, loginPath }
}

// ─── Token Acquisition (multi-role) ───────────────────────────────────────

/**
 * Acquire tokens for all auth roles defined in the seed.
 * Seed keys: auth, auth_admin, auth_superuser, etc.
 */
async function acquireTokens(
  loginPath: string,
  registerPath: string | undefined,
  backendUrl: string,
  seed: any,
  results: TestSummary,
  testingMethod: 'chrome-mcp' | 'direct-http',
  chromeMcpAvailable: boolean,
): Promise<Map<string, string>> {
  const tokens = new Map<string, string>()

  // Collect all auth entries from seed
  const authEntries = Object.entries(seed)
    .filter(([key]) => key.startsWith('auth'))
    .map(([key, val]) => ({
      role: key.replace(/^auth_?/, '') || 'user',
      credentials: val as any,
    }))

  if (authEntries.length === 0) {
    // Fallback: create a default entry
    authEntries.push({
      role: 'user',
      credentials: { email: 'test_' + Date.now() + '@example.com', password: 'Test@123456' },
    })
  }

  let authIdx = 0
  for (const { role, credentials } of authEntries) {
    authIdx++

    // ── Check if seed already has a valid token from Phase 5A ──
    if (credentials?.token && typeof credentials.token === 'string' && credentials.token.startsWith('eyJ')) {
      console.log('[Phase 5B]   Token for ' + role + ' loaded from seed (Phase 5A)')
      tokens.set(role, credentials.token)
      continue
    }

    // ── Optional: Register first ──
    if (registerPath) {
      const registerResult = await runApiTest({
        id: 'AUTH-REG-' + String(authIdx).padStart(3, '0'),
        name: 'Register (' + role + ')',
        endpoint: registerPath,
        method: 'POST',
        body: credentials,
        expectedStatusRange: [200, 201, 409], // 409 = already exists, still OK
        layer: 'auth',
      }, backendUrl, testingMethod, chromeMcpAvailable)

      pushResult(results, registerResult, 'auth')
      console.log('[Phase 5B]   Register (' + role + '):', registerResult.status, registerResult.statusCode || '')

      // Try extracting token from register response (some APIs return it on 201)
      if (registerResult.status === 'passed' && registerResult.responseBody) {
        const token = deepExtractToken(registerResult.responseBody)
        if (token) {
          tokens.set(role, token)
          console.log('[Phase 5B]   Token for ' + role + ' extracted from register response')
          continue
        }
      }
    }

    // ── Login ──
    const loginResult = await runApiTest({
      id: 'AUTH-LOGIN-' + String(authIdx).padStart(3, '0'),
      name: 'Login (' + role + ')',
      endpoint: loginPath,
      method: 'POST',
      body: credentials,
      expectedStatusRange: [200, 201],
      layer: 'auth',
    }, backendUrl, testingMethod, chromeMcpAvailable)

    pushResult(results, loginResult, 'auth')
    console.log('[Phase 5B]   Login (' + role + '):', loginResult.status, loginResult.statusCode || '')

    if (loginResult.status === 'passed' && loginResult.responseBody) {
      const token = deepExtractToken(loginResult.responseBody)
      if (token) {
        tokens.set(role, token)
        console.log('[Phase 5B]   Token for ' + role + ' extracted from login response')
      } else {
        console.log('[Phase 5B]   Token extraction failed for ' + role + '. Response:', JSON.stringify(loginResult.responseBody)?.slice(0, 300))
      }
    }
  }

  return tokens
}

// ─── Token Selection per Test ─────────────────────────────────────────────

/** Build a map of "METHOD /path" → { requiresAdmin } from OpenAPI endpoints. */
function buildOpenApiMeta(openApiEndpoints: OpenApiEndpoint[] | null): Map<string, { requiresAdmin: boolean }> {
  const meta = new Map<string, { requiresAdmin: boolean }>()
  if (!openApiEndpoints) return meta

  for (const ep of openApiEndpoints) {
    const adminTags = (ep.tags || []).some(t => /admin/i.test(t))
    const adminPath = /\/admin\b/i.test(ep.path)
    meta.set(ep.method + ' ' + ep.path, { requiresAdmin: adminTags || adminPath })
  }
  return meta
}

/** Select the appropriate token for a test based on OpenAPI metadata. */
function selectToken(
  endpoint: string,
  method: string,
  openApiMeta: Map<string, { requiresAdmin: boolean }>,
  tokens: Map<string, string>,
): string | null {
  const meta = openApiMeta.get(method + ' ' + endpoint)
  if (meta?.requiresAdmin && tokens.has('admin')) return tokens.get('admin')!
  if (tokens.has('user')) return tokens.get('user')!
  // Fall back to first available token
  const first = tokens.values().next()
  return first.done ? null : first.value
}

// ─── Layer 1 Execution ──────────────────────────────────────────────────────

async function executeLayer1Tests(
  backendUrl: string,
  seed: any,
  tokens: Map<string, string>,
  openApiMeta: Map<string, { requiresAdmin: boolean }>,
  results: TestSummary,
  testingMethod: 'chrome-mcp' | 'direct-http',
  chromeMcpAvailable: boolean,
  createdResourceIds: Record<string, any>,
): Promise<void> {
  const rawTests: SeedTestCase[] = seed.layer1Tests || []
  if (rawTests.length === 0) {
    console.log('[Phase 5B] No Layer 1 tests in seed - adding health check')
    const healthResult = await runApiTest({
      id: 'L1-HEALTH-001',
      name: 'Health Check',
      endpoint: '/api/health',
      method: 'GET',
      body: null,
      expectedStatusRange: [200],
      layer: 'layer1',
    }, backendUrl, testingMethod, chromeMcpAvailable)
    pushResult(results, healthResult, 'layer1')
    return
  }

  // Sort tests so POST runs before GET/PUT/DELETE within each resource group
  const tests = sortByCrudLifecycle(rawTests)

  let idx = 0
  for (const test of tests) {
    idx++
    const id = normalizeField(test, 'ID', 'id') || 'L1-' + String(idx).padStart(3, '0')
    const name = normalizeField(test, 'Name', 'name', 'Description', 'description') || 'Layer 1 Test ' + idx
    const endpoint = normalizeField(test, 'Endpoint', 'endpoint') || ''
    const method = (normalizeField(test, 'Method', 'method') || 'GET').toUpperCase()
    const expectedStatus = parseExpectedStatus(test)

    if (!endpoint) {
      console.log('[Phase 5B]   SKIP (no endpoint):', name)
      continue
    }

    // Validate endpoint at runtime
    if (!isValidHttpEndpoint(endpoint, method)) {
      console.log('[Phase 5B]   SKIP (invalid endpoint):', method, endpoint)
      continue
    }

    // Resolve body
    let body = resolveBody(test)

    // Substitute :param and {param} placeholders from previously created resources
    const resolvedEndpoint = substituteParams(endpoint, createdResourceIds)

    // Select appropriate token based on _auth field or OpenAPI metadata
    const headers: Record<string, string> = {}
    const testAuth = normalizeField(test, '_auth', 'auth_as', 'Auth', 'auth')
    if (testAuth !== 'none' && testAuth !== 'anonymous') {
      const token = selectToken(endpoint, method, openApiMeta, tokens)
      if (token) {
        headers['Authorization'] = 'Bearer ' + token
      }
    }

    const result = await runApiTest({
      id,
      name,
      endpoint: resolvedEndpoint,
      method,
      body,
      expectedStatusRange: expectedStatus,
      layer: 'layer1',
      headers,
    }, backendUrl, testingMethod, chromeMcpAvailable)

    pushResult(results, result, 'layer1')
    console.log('[Phase 5B]   ' + (result.status === 'passed' ? 'OK' : 'FAIL') + ' ' + name + ' ' + method + ' ' + resolvedEndpoint + ' ' + (result.statusCode || ''))

    // Track created resource IDs for subsequent tests using deep extraction
    if (result.status === 'passed' && method === 'POST' && result.responseBody) {
      const resourceId = deepExtractId(result.responseBody)
      if (resourceId !== null) {
        // Extract resource name from endpoint, e.g. /api/todos -> todos
        const resourceName = endpoint.split('/').filter(Boolean).pop() || 'resource'
        createdResourceIds[resourceName] = resourceId
        createdResourceIds['_last_id'] = resourceId
      }
    }
  }
}

// ─── Layer 2 Execution ──────────────────────────────────────────────────────

async function executeLayer2Tests(
  backendUrl: string,
  seed: any,
  tokens: Map<string, string>,
  openApiMeta: Map<string, { requiresAdmin: boolean }>,
  results: TestSummary,
  testingMethod: 'chrome-mcp' | 'direct-http',
  chromeMcpAvailable: boolean,
): Promise<void> {
  const tests: SeedTestCase[] = seed.layer2Tests || []
  if (tests.length === 0) {
    console.log('[Phase 5B] No Layer 2 tests in seed')
    return
  }

  let idx = 0
  for (const test of tests) {
    idx++
    const id = normalizeField(test, 'ID', 'id', 'Test ID') || 'L2-' + String(idx).padStart(3, '0')
    const name = normalizeField(test, 'Name', 'name', 'Description', 'description', 'Scenario', 'scenario') || 'Layer 2 Test ' + idx
    const endpoint = normalizeField(test, 'Endpoint', 'endpoint', 'Resource', 'resource', 'Path', 'path', 'URL', 'url', 'Route', 'route') || ''
    const expectedStatus = parseExpectedStatus(test)
    const category = inferCategory(test)

    if (!endpoint) {
      console.log('[Phase 5B]   SKIP (no endpoint):', name)
      continue
    }

    // Build method and body based on category when not explicit
    const l2Req = buildLayer2Request(test, category)
    let method = l2Req.method
    let body = resolveBody(test) ?? l2Req.body

    // Determine auth for this test using role field
    const role = normalizeField(test, 'Role', 'role', 'Auth', 'auth', 'auth_as')
    const headers: Record<string, string> = {}
    if (role === 'none' || role === 'anonymous' || role === '' || !role) {
      // No auth
    } else if (role === 'admin' && tokens.has('admin')) {
      headers['Authorization'] = 'Bearer ' + tokens.get('admin')!
    } else if (tokens.has('user')) {
      headers['Authorization'] = 'Bearer ' + tokens.get('user')!
    }

    const result = await runApiTest({
      id,
      name,
      endpoint,
      method,
      body,
      expectedStatusRange: expectedStatus,
      layer: 'layer2',
      headers,
    }, backendUrl, testingMethod, chromeMcpAvailable)

    pushResult(results, result, 'layer2')
    console.log('[Phase 5B]   ' + (result.status === 'passed' ? 'OK' : 'FAIL') + ' [' + category + '] ' + name + ' ' + (result.statusCode || ''))
  }
}

// ─── Scenario Tests (from seed.scenarios) ───────────────────────────────────

async function executeScenarioTests(
  backendUrl: string,
  seed: any,
  tokens: Map<string, string>,
  openApiMeta: Map<string, { requiresAdmin: boolean }>,
  results: TestSummary,
  testingMethod: 'chrome-mcp' | 'direct-http',
  chromeMcpAvailable: boolean,
): Promise<void> {
  const scenarios = seed.scenarios || {}
  let globalIdx = 0

  // Generic scenario runner: each scenario must carry its own endpoint/method/body
  const allScenarioGroups: Array<{ prefix: string; category: string; tests: any[] }> = [
    { prefix: 'L2-VAL', category: 'validation', tests: scenarios.validation || [] },
    { prefix: 'L2-AUTH', category: 'auth', tests: scenarios.authorization || [] },
    { prefix: 'L2-BIZ', category: 'constraint', tests: scenarios.business_constraints || [] },
  ]

  for (const group of allScenarioGroups) {
    for (const scenario of group.tests) {
      globalIdx++
      const id = group.prefix + '-' + String(globalIdx).padStart(3, '0')
      const expectedStatus = scenario.expected_status || scenario.expectedStatus || 422
      const endpoint = scenario.endpoint || scenario.path || ''
      const method = (scenario.method || 'POST').toUpperCase()
      const body = scenario.payload || scenario.body || {}

      if (!endpoint) {
        console.log('[Phase 5B]   SKIP (no endpoint in scenario):', scenario.description || id)
        continue
      }

      // Determine auth for this scenario
      const headers: Record<string, string> = {}
      const authAs = scenario.auth_as || scenario.role || null
      if (authAs && authAs !== 'none' && authAs !== 'anonymous') {
        const token = tokens.get(authAs) || tokens.get('user')
        if (token) {
          headers['Authorization'] = 'Bearer ' + token
        }
      }

      const result = await runApiTest({
        id,
        name: scenario.description || group.category + ' Test ' + globalIdx,
        endpoint,
        method,
        body,
        expectedStatusRange: [expectedStatus],
        layer: 'layer2',
        headers,
      }, backendUrl, testingMethod, chromeMcpAvailable)

      pushResult(results, result, 'layer2')
      console.log('[Phase 5B]   ' + (result.status === 'passed' ? 'OK' : 'FAIL') + ' [' + group.category + '] ' + (scenario.description || ''))
    }
  }
}

// ─── Core Test Runner ───────────────────────────────────────────────────────

interface ApiTestSpec {
  id: string
  name: string
  endpoint: string
  method: string
  body: any
  expectedStatusRange: number[]
  layer: 'auth' | 'layer1' | 'layer2'
  headers?: Record<string, string>
}

async function runApiTest(
  spec: ApiTestSpec,
  backendUrl: string,
  testingMethod: 'chrome-mcp' | 'direct-http',
  chromeMcpAvailable: boolean,
): Promise<TestResult> {
  const startTime = Date.now()

  try {
    let statusCode: number | undefined
    let responseBody: any
    let error: string | undefined

    // Use Chrome MCP for ALL tests (including authenticated ones).
    // Custom headers (Authorization, etc.) are now embedded in the browser fetch code.
    if (chromeMcpAvailable) {
      const mcpResult = await executeApiTestWithRetry(
        spec.endpoint,
        spec.method,
        spec.body || {},
        backendUrl,
        { maxRetries: 1 },
        spec.headers,
      )
      statusCode = mcpResult.statusCode
      responseBody = mcpResult.responseBody
      error = mcpResult.error
    } else {
      const httpResult = await executeDirectHttpTest(
        spec.endpoint,
        spec.method,
        spec.body,
        backendUrl,
        spec.headers,
      )
      statusCode = httpResult.statusCode
      responseBody = httpResult.responseBody
      error = httpResult.error
    }

    // Determine pass/fail based on expected status
    const isExpected = spec.expectedStatusRange.length === 0
      ? (statusCode !== undefined && statusCode >= 200 && statusCode < 300)
      : (statusCode !== undefined && spec.expectedStatusRange.includes(statusCode))

    const needsFix = statusCode === 500

    return {
      id: spec.id,
      name: spec.name,
      endpoint: spec.endpoint,
      method: spec.method,
      status: isExpected ? 'passed' : 'failed',
      statusCode,
      duration: Date.now() - startTime,
      error: isExpected ? undefined : (error || 'Expected ' + spec.expectedStatusRange.join('/') + ' but got ' + statusCode),
      responseBody,
      testingMethod,
      needsFix,
      layer: spec.layer,
    }
  } catch (err) {
    return {
      id: spec.id,
      name: spec.name,
      endpoint: spec.endpoint,
      method: spec.method,
      status: 'failed',
      duration: Date.now() - startTime,
      error: String(err),
      testingMethod,
      layer: spec.layer,
    }
  }
}

// ─── Direct HTTP Execution ──────────────────────────────────────────────────

async function executeDirectHttpTest(
  endpoint: string,
  method: string,
  body: any,
  backendUrl: string,
  headers?: Record<string, string>,
): Promise<{ statusCode?: number; responseBody?: any; error?: string }> {
  try {
    const url = backendUrl + endpoint
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers || {}),
    }
    const options: RequestInit = {
      method,
      headers: reqHeaders,
      signal: AbortSignal.timeout(10000),
    }

    if (body && method !== 'GET' && method !== 'HEAD') {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)
    let responseBody: any
    try {
      responseBody = await response.json()
    } catch {
      try { responseBody = await response.text() } catch { /* empty */ }
    }

    return {
      statusCode: response.status,
      responseBody,
      error: response.ok ? undefined : 'HTTP ' + response.status,
    }
  } catch (err) {
    return { error: String(err) }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pushResult(summary: TestSummary, result: TestResult, layer: 'auth' | 'layer1' | 'layer2'): void {
  summary.results.push(result)
  summary.total++
  if (result.status === 'passed') summary.passed++
  else summary.failed++

  // Also update layer-specific counters (auth counts toward layer1)
  const targetLayer = layer === 'auth' ? summary.layer1 : (layer === 'layer1' ? summary.layer1 : summary.layer2)
  targetLayer.tests.push(result)
  targetLayer.total++
  if (result.status === 'passed') targetLayer.passed++
  else targetLayer.failed++
}

/** Normalize a field across multiple possible key names from the seed test case (fuzzy matching). */
function normalizeField(obj: any, ...candidateNames: string[]): string {
  if (!obj || typeof obj !== 'object') return ''
  const keys = Object.keys(obj)
  // Exact match
  for (const name of candidateNames) {
    if (obj[name] !== undefined && obj[name] !== null) return String(obj[name]).trim()
  }
  // Case-insensitive
  for (const name of candidateNames) {
    const lower = name.toLowerCase()
    const match = keys.find(k => k.toLowerCase().trim() === lower)
    if (match && obj[match] !== undefined) return String(obj[match]).trim()
  }
  // Substring match
  for (const name of candidateNames) {
    const lower = name.toLowerCase()
    const match = keys.find(k => {
      const kl = k.toLowerCase().trim()
      return kl.includes(lower) || lower.includes(kl)
    })
    if (match && obj[match] !== undefined && String(obj[match]).trim()) return String(obj[match]).trim()
  }
  return ''
}

/** Infer L2 test category from explicit field or test ID. */
function inferCategory(test: any): string {
  const explicit = normalizeField(test, '_category', 'Category', 'category')
  if (explicit) return explicit
  const id = normalizeField(test, 'ID', 'id', 'Test ID')
  if (id.includes('AUTH')) return 'auth'
  if (id.includes('VAL')) return 'validation'
  if (id.includes('CON')) return 'constraint'
  if (id.includes('STATE')) return 'state'
  if (id.includes('EDGE')) return 'edge'
  if (id.includes('INT')) return 'integration'
  return ''
}

/** Build L2 request method and body based on category when not explicitly specified. */
function buildLayer2Request(test: any, category: string): { method: string; body: any } {
  let method = normalizeField(test, 'Method', 'method')
  let body: any = null

  if (!method || method === 'UNKNOWN') {
    // Infer from category
    switch (category) {
      case 'validation':
      case 'constraint':
        method = 'POST'
        const inputStr = normalizeField(test, 'Input', 'input', 'Data', 'data', 'Payload', 'payload', 'Scenario', 'scenario')
        if (inputStr) {
          try { body = JSON.parse(inputStr.replace(/'/g, '"').replace(/(\w+)\s*:/g, '"$1":')) }
          catch { body = { _raw: inputStr } }
        }
        break
      case 'auth':
        method = 'GET'
        break
      default:
        method = 'GET'
    }
  }

  return { method: method.toUpperCase(), body }
}

/** Parse expected status codes from various seed formats. */
function parseExpectedStatus(test: SeedTestCase): number[] {
  const raw = normalizeField(test,
    'Expected Status', 'expectedStatus', 'expected_status',
    'Expected', 'expected',
    'Status', 'status_code', 'expectedStatusCode'
  )
  if (!raw) return []

  const str = String(raw).trim()

  // Range: "200-299"
  if (str.includes('-')) {
    const [lo, hi] = str.split('-').map(Number)
    if (!isNaN(lo) && !isNaN(hi)) {
      const range: number[] = []
      for (let i = lo; i <= hi; i++) range.push(i)
      return range
    }
  }

  // Comma list: "200,201"
  if (str.includes(',')) {
    return str.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
  }

  // Slash list: "400/422"
  if (str.includes('/')) {
    return str.split('/').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
  }

  // Single value
  const n = parseInt(str, 10)
  return isNaN(n) ? [] : [n]
}

/** Resolve body from various seed field formats. */
function resolveBody(test: SeedTestCase): any {
  // Check _requestBody first (from Phase 4, has OpenAPI-derived schema data)
  if (test._requestBody && typeof test._requestBody === 'object' && Object.keys(test._requestBody).length > 0) {
    return test._requestBody
  }

  // Then try other common field names
  const bodyStr = normalizeField(test, 'Body', 'body', 'Data', 'data', 'Payload', 'payload', 'Input', 'input')
  if (!bodyStr) return null

  // Try parsing as JSON
  try {
    return JSON.parse(bodyStr.replace(/'/g, '"'))
  } catch {
    // Return raw string if not parseable
    return bodyStr
  }
}

/** Substitute :param and {param} placeholders in endpoint paths with actual IDs. */
function substituteParams(endpoint: string, createdIds: Record<string, any>): string {
  return endpoint.replace(/[:{](\w+)\}?/g, (match, paramName) => {
    // Direct match by param name
    if (createdIds[paramName] !== undefined) return String(createdIds[paramName])

    // Try resource context: derive resource name from the base path before this param
    const basePath = endpoint.substring(0, endpoint.indexOf(match)).replace(/\/$/, '')
    const resourceName = basePath.split('/').filter(Boolean).pop() || ''
    if (resourceName && createdIds[resourceName] !== undefined) return String(createdIds[resourceName])

    // Try common suffixes: :todoId -> todos, :userId -> users
    const stripped = paramName.replace(/Id$/, 's')
    if (createdIds[stripped] !== undefined) return String(createdIds[stripped])

    // Fall back to last created ID
    if (createdIds['_last_id'] !== undefined) return String(createdIds['_last_id'])

    // Placeholder UUID so the request at least has a valid shape
    return '00000000-0000-0000-0000-000000000000'
  })
}
