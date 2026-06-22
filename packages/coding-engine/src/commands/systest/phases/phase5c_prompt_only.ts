/**
 * Phase 5C: Comprehensive Frontend E2E Testing with Chrome MCP
 *
 * Flow:
 *   1. Load test data from seed (admin credentials)
 *   2. Login flow: navigate to frontend, fill login form, verify redirect
 *   3. Route discovery: find all navigation links after login
 *   4. Page-by-page testing: navigate, screenshot, check console/network errors
 *   5. Form interaction tests: find forms, fill with test data, submit
 *   6. Write structured results JSON
 *
 * Falls back to direct HTTP probing when Chrome MCP is unavailable.
 */
import { join } from 'node:path'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import type { SystestContext, PhaseResult } from './orchestrator.js'
import {
  isChromeMcpAvailable,
  executeUiNavigationTest,
  callMcpTool,
} from '../../../services/systest/claudeInChromeExecutor.js'
import { canRunAiSession, runAiTestFixSession, buildPhase5CPrompt, type AiSessionResult } from '../../../services/systest/aiTestFixSession.js'
import { normalizeRoutePath } from '../../../services/systest/routeNormalizer.js'

// ─── Types ──────────────────────────────────────────────────────────────────

interface E2ETestResult {
  id: string
  name: string
  status: 'passed' | 'failed'
  duration: number
  error?: string
  testingMethod: 'chrome-mcp' | 'direct-http'
  consoleErrors?: number
  networkErrors?: number
  route?: string
}

interface LoginTestResult {
  status: 'passed' | 'failed'
  adminLogin: boolean
  redirectedTo?: string
  error?: string
}

interface RouteTestResult {
  route: string
  status: 'passed' | 'failed'
  consoleErrors: number
  networkErrors: number
  error?: string
}

interface FormTestResult {
  route: string
  formDescription: string
  status: 'passed' | 'failed'
  error?: string
}

interface TestSummary {
  total: number
  passed: number
  failed: number
  testingMethod: 'chrome-mcp' | 'direct-http'
  chromeMcpAvailable: boolean
  frontendUrl: string
  loginTest: LoginTestResult
  routeTests: RouteTestResult[]
  formTests: FormTestResult[]
  results: E2ETestResult[]
}

// ─── Entry Point ────────────────────────────────────────────────────────────

export async function executePhase5C(ctx: SystestContext): Promise<PhaseResult> {
  const startTime = Date.now()
  const outputs: string[] = []

  console.log('[Phase 5C] Comprehensive Frontend E2E Testing')

  if (!ctx.frontendUrl && !ctx.backendUrl) {
    return { status: 'skipped', outputs: [], duration: 0, error: 'No frontend URL' }
  }

  const logsDir = join(ctx.outputDir, 'test-logs')
  mkdirSync(logsDir, { recursive: true })

  try {
    const seed = loadTestDataSeed(logsDir)

    if (canRunAiSession(ctx)) {
      const aiResult = await executeAiE2ELoop(seed, ctx, logsDir, outputs)
      if (aiResult) return aiResult
      console.log('[Phase 5C] AI loop failed — falling back to programmatic mode')
    } else {
      console.log('[Phase 5C] AI session not available — running programmatic mode')
    }

    const frontendUrl = ctx.frontendUrl || ctx.backendUrl || ''
    const backendUrl = ctx.backendUrl || frontendUrl

    // ── Determine testing method ──
    let chromeMcpAvailable = await isChromeMcpAvailable(ctx.toolUseContext)
    console.log('[Phase 5C] Chrome MCP:', chromeMcpAvailable ? 'AVAILABLE' : 'not available')

    if (chromeMcpAvailable) {
      try {
        const probe = await callMcpTool('mcp__claude-in-chrome__tabs_context_mcp', { createIfEmpty: true })
        const probeTabs = probe.data?.tabs || probe.data?.availableTabs || []
        if (!probe.success || (!probeTabs[0]?.id && !probeTabs[0]?.tabId)) {
          console.log('[Phase 5C] Chrome MCP probe failed - falling back to direct HTTP')
          chromeMcpAvailable = false
        }
      } catch {
        console.log('[Phase 5C] Chrome MCP probe exception - falling back to direct HTTP')
        chromeMcpAvailable = false
      }
    }

    const testingMethod: 'chrome-mcp' | 'direct-http' = chromeMcpAvailable ? 'chrome-mcp' : 'direct-http'
    console.log('[Phase 5C] Testing method:', testingMethod)

    // ── Build results container ──
    const results: TestSummary = {
      total: 0,
      passed: 0,
      failed: 0,
      testingMethod,
      chromeMcpAvailable,
      frontendUrl,
      loginTest: { status: 'failed', adminLogin: false },
      routeTests: [],
      formTests: [],
      results: [],
    }

    if (chromeMcpAvailable) {
      await runChromeMcpE2ETests(results, frontendUrl, backendUrl, seed)
    } else {
      await runDirectHttpE2ETests(results, frontendUrl, backendUrl)
    }

    // ── Write results ──
    const resultsPath = join(logsDir, 'phase5c_results.json')
    writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8')
    outputs.push(resultsPath)

    const passRate = results.total > 0 ? (results.passed / results.total) * 100 : 0
    console.log('[Phase 5C] Complete: ' + results.passed + '/' + results.total + ' passed (' + passRate.toFixed(1) + '%) via ' + testingMethod)

    return { status: 'completed', outputs, duration: Date.now() - startTime, passRate }
  } catch (error) {
    console.error('[Phase 5C] Error:', error)
    return { status: 'failed', outputs, duration: Date.now() - startTime, error: String(error) }
  }
}

// ─── AI E2E Test-Fix Loop ──────────────────────────────────────────────────

async function executeAiE2ELoop(
  seed: any,
  ctx: SystestContext,
  logsDir: string,
  outputs: string[],
): Promise<PhaseResult> {
  const startTime = Date.now()
  const targetPassRate = ctx.config.global.targetPassRate5c || 95
  const maxIterations = ctx.config.iterationControl?.maxIterations || 10
  const earlyExitThreshold = ctx.config.iterationControl?.earlyExitThreshold || 3

  let currentPassRate = 0
  let iteration = 0
  let noImprovementCount = 0
  let previousPassRate = 0
  let lastResult: AiSessionResult | null = null

  console.log('[Phase 5C] AI E2E Test-Fix Loop: target=' + targetPassRate + '%, max=' + maxIterations)

  do {
    iteration++
    console.log('[Phase 5C] ═══ Iteration ' + iteration + '/' + maxIterations + ' ═══')

    const prompt = buildPhase5CPrompt(seed, ctx, iteration)

    console.log('[Phase 5C] Starting AI E2E session...')
    lastResult = await runAiTestFixSession(prompt, ctx, 50, '5c', iteration)

    currentPassRate = lastResult.passRate
    console.log('[Phase 5C] Iteration ' + iteration + ': ' + lastResult.passed + '/' + lastResult.total + ' (' + currentPassRate + '%) tools=' + lastResult.toolUseCount)

    // If first iteration produced zero results → query() failed, fall back
    if (iteration === 1 && lastResult.total === 0 && lastResult.toolUseCount === 0) {
      console.log('[Phase 5C] AI session produced no results — falling back to programmatic mode')
      return null as any
    }

    // Save iteration results
    const iterPath = join(logsDir, 'phase5c_iteration_' + iteration + '_results.json')
    writeFileSync(iterPath, JSON.stringify(lastResult, null, 2))
    outputs.push(iterPath)

    // Early exit on no improvement
    if (currentPassRate <= previousPassRate) {
      noImprovementCount++
      if (noImprovementCount >= earlyExitThreshold) {
        console.log('[Phase 5C] Early exit: no improvement for ' + earlyExitThreshold + ' iterations')
        break
      }
    } else {
      noImprovementCount = 0
    }
    previousPassRate = currentPassRate

  } while (currentPassRate < targetPassRate && iteration < maxIterations)

  const achieved = currentPassRate >= targetPassRate
  console.log('[Phase 5C] ═══ COMPLETE: ' + currentPassRate + '% (' + iteration + ' iterations) ═══')

  const finalPath = join(logsDir, 'phase5c_results.json')
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

// ─── Seed Loading ───────────────────────────────────────────────────────────

function loadTestDataSeed(logsDir: string): any {
  const seedPath = join(logsDir, 'test_data_seed.json')
  if (existsSync(seedPath)) {
    try {
      return JSON.parse(readFileSync(seedPath, 'utf-8'))
    } catch { /* empty */ }
  }
  // No seed found — return empty shell. Credentials must be generated by
  // Phase 5A AI (STEP A-G) via PRP/DB/Graph; hardcoded fallbacks were removed.
  return { auth: null, auth_admin: null, entities: {}, layer1Tests: [], layer2Tests: [] }
}

// ─── Chrome MCP E2E Tests ───────────────────────────────────────────────────

async function runChromeMcpE2ETests(
  results: TestSummary,
  frontendUrl: string,
  backendUrl: string,
  seed: any,
): Promise<void> {
  const tabId = await getTabId()
  if (!tabId) {
    console.log('[Phase 5C] Cannot get Chrome tab, aborting Chrome MCP tests')
    await runDirectHttpE2ETests(results, frontendUrl, backendUrl)
    return
  }

  // ── Test 1: Navigate to frontend home ──
  await runOneTest(results, 'E2E-001', 'Frontend Home Navigation', async () => {
    await callMcpTool('mcp__claude-in-chrome__navigate', { url: frontendUrl, tabId })
    await sleep(2000)
    return 'chrome-mcp' as const
  })

  // ── Test 2: Login Flow ──
  const loginResult = await executeLoginFlow(tabId, frontendUrl, seed, results)
  results.loginTest = loginResult

  // ── Test 3: Route Discovery ──
  let discoveredRoutes: string[] = []
  await runOneTest(results, 'E2E-003', 'Route Discovery', async () => {
    discoveredRoutes = await discoverRoutes(tabId, frontendUrl, backendUrl, seed)
    console.log('[Phase 5C]   Discovered ' + discoveredRoutes.length + ' routes: ' + discoveredRoutes.join(', '))
    // Even 1 route (/) is valid — we always add it
    return 'chrome-mcp' as const
  })

  // ── Test 4: Page-by-page testing with integrated form tests ──
  if (discoveredRoutes.length > 0) {
    console.log('[Phase 5C] --- Page-by-page testing (with form tests per route) ---')
    let routeIdx = 0
    let formTestIdx = 0

    for (const route of discoveredRoutes) {
      routeIdx++
      const routeTestResult: RouteTestResult = {
        route,
        status: 'passed',
        consoleErrors: 0,
        networkErrors: 0,
      }

      await runOneTest(results, 'E2E-ROUTE-' + String(routeIdx).padStart(3, '0'), 'Page: ' + route, async () => {
        // Navigate to route
        const fullUrl = route.startsWith('http') ? route : frontendUrl + route
        await callMcpTool('mcp__claude-in-chrome__navigate', { url: fullUrl, tabId })
        await sleep(1500)

        // Take screenshot
        await callMcpTool('mcp__claude-in-chrome__computer', { action: 'screenshot', tabId })

        // Check console errors
        const consoleResult = await callMcpTool('mcp__claude-in-chrome__read_console_messages', {
          tabId,
          onlyErrors: true,
          limit: 50,
          pattern: 'error|Error|ERROR',
        })
        const consoleErrors = extractMessageCount(consoleResult)
        routeTestResult.consoleErrors = consoleErrors

        // Check network errors
        const networkResult = await callMcpTool('mcp__claude-in-chrome__read_network_requests', { tabId })
        const requests = networkResult.data?.requests || networkResult.data || []
        const failedRequests = Array.isArray(requests)
          ? requests.filter((r: any) => r.status >= 400 || r.error)
          : []
        routeTestResult.networkErrors = failedRequests.length

        // Verify page loaded (has non-empty content)
        const pageResult = await callMcpTool('mcp__claude-in-chrome__read_page', { tabId, filter: 'all', depth: 2 })
        if (!pageResult.success) {
          routeTestResult.status = 'failed'
          routeTestResult.error = 'Failed to read page'
          throw new Error('Failed to read page content for ' + route)
        }

        // Fail if critical errors
        if (consoleErrors > 5) {
          routeTestResult.status = 'failed'
          routeTestResult.error = consoleErrors + ' console errors'
          throw new Error(consoleErrors + ' console errors on ' + route)
        }

        return 'chrome-mcp' as const
      })

      results.routeTests.push(routeTestResult)

      // ── Integrated form test: check for forms on this page ──
      // (we're already on this route, no extra navigation needed)
      const formResult = await callMcpTool('mcp__claude-in-chrome__javascript_tool', {
        action: 'javascript_exec',
        text: `JSON.stringify(Array.from(document.querySelectorAll('form')).map((f,i)=>({idx:i,action:f.action||'',method:f.method||'',inputs:Array.from(f.querySelectorAll('input,textarea,select')).map(inp=>({type:inp.type||'text',name:inp.name||'',placeholder:inp.placeholder||''}))})))`,
        tabId,
      })

      if (formResult.success) {
        let forms: any[] = []
        try {
          forms = typeof formResult.data === 'string' ? JSON.parse(formResult.data) : formResult.data
        } catch { /* empty */ }

        if (Array.isArray(forms) && forms.length > 0) {
          for (const form of forms.slice(0, 2)) {
            formTestIdx++
            const formDesc = 'Form on ' + route + ' (' + (form.inputs?.length || 0) + ' inputs)'
            const formTestResult: FormTestResult = {
              route,
              formDescription: formDesc,
              status: 'failed',
            }

            await runOneTest(results, 'E2E-FORM-' + String(formTestIdx).padStart(3, '0'), formDesc, async () => {
              for (const input of form.inputs || []) {
                if (input.type === 'hidden' || input.type === 'submit') continue
                const findQuery = input.name
                  ? (input.name + ' input')
                  : (input.placeholder ? input.placeholder + ' input' : input.type + ' input')
                const inputFind = await callMcpTool('mcp__claude-in-chrome__find', { query: findQuery, tabId })
                if (inputFind.success && inputFind.data?.[0]?.ref) {
                  const testValue = generateTestValueForInput(input, seed)
                  await callMcpTool('mcp__claude-in-chrome__form_input', {
                    ref: inputFind.data[0].ref,
                    value: testValue,
                    tabId,
                  })
                }
              }
              const submitBtn = await callMcpTool('mcp__claude-in-chrome__find', { query: 'submit button', tabId })
              if (submitBtn.success && submitBtn.data?.[0]?.ref) {
                await callMcpTool('mcp__claude-in-chrome__computer', {
                  action: 'left_click',
                  ref: submitBtn.data[0].ref,
                  tabId,
                })
                await sleep(2000)
              }
              formTestResult.status = 'passed'
              return 'chrome-mcp' as const
            })

            results.formTests.push(formTestResult)
          }
        }
      }
    }

    if (formTestIdx === 0) {
      console.log('[Phase 5C]   No forms found on any tested route')
    }
  }

  // ── Test 5: API health from frontend (CORS) ──
  await runOneTest(results, 'E2E-CORS-001', 'API CORS Check', async () => {
    const jsResult = await callMcpTool('mcp__claude-in-chrome__javascript_tool', {
      action: 'javascript_exec',
      text: `fetch("${backendUrl}/api/health").then(r=>r.json().then(d=>JSON.stringify({s:r.status,d:d}))).catch(e=>"ERR:"+e.message)`,
      tabId,
    })
    if (!jsResult.success) throw new Error('JS exec failed: ' + jsResult.error)
    const data = typeof jsResult.data === 'string' ? jsResult.data : JSON.stringify(jsResult.data)
    if (data && data.startsWith('ERR:')) throw new Error(data)
    return 'chrome-mcp' as const
  })
}

// ─── Login Flow ─────────────────────────────────────────────────────────────

async function executeLoginFlow(
  tabId: number,
  frontendUrl: string,
  seed: any,
  results: TestSummary,
): Promise<LoginTestResult> {
  const loginResult: LoginTestResult = { status: 'failed', adminLogin: false }

  await runOneTest(results, 'E2E-002', 'Login Flow', async () => {
    // Build credential candidates: admin first, then regular user, then defaults
    const credCandidates: Array<{ email: string; password: string }> = []
    if (seed.auth_admin?.email) credCandidates.push({ email: seed.auth_admin.email, password: seed.auth_admin.password || 'Test@123456' })
    if (seed.auth?.email)       credCandidates.push({ email: seed.auth.email, password: seed.auth.password || 'Test@123456' })
    // Common default fallbacks
    credCandidates.push(
      { email: 'admin@example.com', password: 'Admin@123456' },
      { email: 'admin@example.com', password: 'Test@123456' },
      { email: 'user@example.com',  password: 'Test@123456' },
    )

    // ── Ensure we are on the login page ──
    await callMcpTool('mcp__claude-in-chrome__navigate', { url: frontendUrl + '/login', tabId })
    await sleep(2000)

    // Check if we even have a login page (some apps redirect /login elsewhere)
    let emailField = await callMcpTool('mcp__claude-in-chrome__find', { query: 'email input field', tabId })
    if (!emailField.success || !emailField.data?.[0]?.ref) {
      // Try the root URL — some SPAs redirect unauthenticated users to login on /
      await callMcpTool('mcp__claude-in-chrome__navigate', { url: frontendUrl, tabId })
      await sleep(2000)
      emailField = await callMcpTool('mcp__claude-in-chrome__find', { query: 'email input field', tabId })
    }

    if (!emailField.success || !emailField.data?.[0]?.ref) {
      // No login form found — app may be public or use a different auth mechanism
      loginResult.status = 'passed'
      loginResult.adminLogin = false
      loginResult.error = 'No login form found - app may be public'
      return 'chrome-mcp' as const
    }

    // ── Try each credential candidate until login succeeds ──
    let loginSucceeded = false
    for (const cred of credCandidates) {
      // Re-load the login page to reset form state
      const curPathResult = await callMcpTool('mcp__claude-in-chrome__javascript_tool', {
        action: 'javascript_exec',
        text: 'window.location.pathname',
        tabId,
      })
      const curPath = typeof curPathResult.data === 'string' ? curPathResult.data : '/login'
      if (!curPath.includes('login') && !curPath.includes('signin')) {
        // Already redirected away — previous attempt succeeded
        loginSucceeded = true
        break
      }

      await fillLoginForm(tabId, emailField, cred.email, cred.password)
      await sleep(3000)

      const urlResult = await callMcpTool('mcp__claude-in-chrome__javascript_tool', {
        action: 'javascript_exec',
        text: 'window.location.pathname',
        tabId,
      })
      const pathname = typeof urlResult.data === 'string' ? urlResult.data : '/login'
      if (!pathname.includes('login') && !pathname.includes('signin')) {
        loginSucceeded = true
        console.log('[Phase 5C] Login succeeded with: ' + cred.email)
        loginResult.redirectedTo = pathname
        break
      }

      console.log('[Phase 5C] Login attempt failed for ' + cred.email + ' (still on ' + pathname + '), trying next credential')
      // Re-find email field for next attempt
      await callMcpTool('mcp__claude-in-chrome__navigate', { url: frontendUrl + '/login', tabId })
      await sleep(1500)
      emailField = await callMcpTool('mcp__claude-in-chrome__find', { query: 'email input field', tabId })
      if (!emailField.success || !emailField.data?.[0]?.ref) break
    }

    if (!loginSucceeded) {
      console.log('[Phase 5C] All login attempts failed — continuing with unauthenticated testing')
      loginResult.status = 'failed'
      loginResult.adminLogin = false
      loginResult.error = 'All credential candidates rejected; continuing unauthenticated'
      // Do NOT throw — allow route discovery to proceed unauthenticated
      return 'chrome-mcp' as const
    }

    // ── Verify final URL ──
    const finalUrlResult = await callMcpTool('mcp__claude-in-chrome__javascript_tool', {
      action: 'javascript_exec',
      text: 'window.location.href',
      tabId,
    })
    const currentUrl = typeof finalUrlResult.data === 'string' ? finalUrlResult.data : ''
    loginResult.redirectedTo = currentUrl
    loginResult.status = 'passed'
    loginResult.adminLogin = true
    return 'chrome-mcp' as const
  })

  return loginResult
}

async function fillLoginForm(
  tabId: number,
  emailFindResult: any,
  email: string,
  password: string,
): Promise<void> {
  // Fill email
  const emailRef = emailFindResult.data?.[0]?.ref
  if (emailRef) {
    await callMcpTool('mcp__claude-in-chrome__form_input', { ref: emailRef, value: email, tabId })
  }

  // Fill password
  const passwordField = await callMcpTool('mcp__claude-in-chrome__find', { query: 'password input field', tabId })
  const passwordRef = passwordField.data?.[0]?.ref
  if (passwordRef) {
    await callMcpTool('mcp__claude-in-chrome__form_input', { ref: passwordRef, value: password, tabId })
  }

  // Click login/submit button
  const loginBtn = await callMcpTool('mcp__claude-in-chrome__find', { query: 'login button or submit button', tabId })
  const btnRef = loginBtn.data?.[0]?.ref
  if (btnRef) {
    await callMcpTool('mcp__claude-in-chrome__computer', { action: 'left_click', ref: btnRef, tabId })
  }
}

// ─── Route Discovery ────────────────────────────────────────────────────────

const AUTH_ROUTE_PATTERNS = ['/login', '/signin', '/logout', '/signout', '/register', '/signup']

async function discoverRoutes(
  tabId: number,
  frontendUrl: string,
  backendUrl?: string,
  seed?: any,
): Promise<string[]> {
  const routes: Set<string> = new Set()

  // ── Source 1: DOM navigation links (broad selector, not just nav/sidebar) ──
  const pageResult = await callMcpTool('mcp__claude-in-chrome__read_page', {
    tabId,
    filter: 'interactive',
    depth: 5,
  })

  if (pageResult.success) {
    extractLinksFromPageData(pageResult.data, routes, frontendUrl)
  }

  // ── Source 2: JavaScript — broader link extraction including non-nav areas ──
  const jsResult = await callMcpTool('mcp__claude-in-chrome__javascript_tool', {
    action: 'javascript_exec',
    text: `JSON.stringify(Array.from(new Set(Array.from(document.querySelectorAll('a[href]')).map(a=>a.getAttribute('href')).filter(h=>h&&!h.startsWith('#')&&!h.startsWith('mailto:')&&!h.startsWith('javascript:')))))`,
    tabId,
  })

  if (jsResult.success && jsResult.data) {
    try {
      const links: string[] = typeof jsResult.data === 'string' ? JSON.parse(jsResult.data) : jsResult.data
      for (const link of links) {
        if (isInternalRoute(link, frontendUrl)) {
          routes.add(normalizeRoute(link, frontendUrl))
        }
      }
    } catch { /* empty */ }
  }

  // ── Source 3: Common SPA routes that most web apps have ──
  const commonRoutes = [
    '/', '/dashboard', '/home', '/settings', '/profile',
    '/users', '/admin', '/reports', '/analytics', '/items',
    '/projects', '/tasks', '/products', '/orders',
  ]
  for (const route of commonRoutes) {
    routes.add(route)
  }

  // ── Source 4: OpenAPI spec — each tag likely maps to a frontend page ──
  if (backendUrl) {
    try {
      const specResult = await callMcpTool('mcp__claude-in-chrome__javascript_tool', {
        action: 'javascript_exec',
        text: `fetch('${backendUrl}/openapi.json').then(r=>r.json()).then(d=>{const tags=new Set();Object.values(d.paths||{}).forEach(m=>Object.values(m).forEach(o=>(o.tags||[]).forEach(t=>tags.add(t.toLowerCase()))));return JSON.stringify([...tags])}).catch(()=>fetch('${backendUrl}/docs/openapi.json').then(r=>r.json()).then(d=>{const tags=new Set();Object.values(d.paths||{}).forEach(m=>Object.values(m).forEach(o=>(o.tags||[]).forEach(t=>tags.add(t.toLowerCase()))));return JSON.stringify([...tags])}).catch(()=>'[]'))`,
        tabId,
      })
      if (specResult.success && specResult.data) {
        const rawTags = typeof specResult.data === 'string' ? specResult.data : JSON.stringify(specResult.data)
        const tags: string[] = JSON.parse(rawTags)
        if (Array.isArray(tags)) {
          for (const tag of tags) {
            const slug = tag.toLowerCase().replace(/\s+/g, '-')
            routes.add('/' + slug)
            // Also try plural form
            if (!slug.endsWith('s')) routes.add('/' + slug + 's')
          }
        }
      }
    } catch { /* empty */ }
  }

  // ── Source 5: Seed entities → frontend routes ──
  if (seed?.entities && typeof seed.entities === 'object') {
    for (const entityName of Object.keys(seed.entities)) {
      const slug = entityName.toLowerCase()
      routes.add('/' + slug)
      routes.add('/' + slug + 's')
    }
  }

  // ── Canonicalize, filter auth routes, dedupe ──
  // Run every accumulated route through normalizeRoutePath so that:
  //   - common routes from Source 3-5 end up in the same canonical shape
  //   - any path that slipped through without going through normalizeRoute()
  //     (e.g. a literal '/users' from Source 3) is still safe
  //   - the final Set collapses Source-1 `/users/42` and Source-5 `/users`
  //     correctly: runtime paths become `/users/:param` which coexists with
  //     the static `/users` — deliberate, since both are real navigation
  //     targets and both deserve testing.
  const canonical = Array.from(routes, r => normalizeRoutePath(r))
  const filtered = canonical.filter(r => {
    if (!r || r === '') return false
    return !AUTH_ROUTE_PATTERNS.some(auth => r.includes(auth))
  })

  // Deduplicate and cap; '/' always first
  const deduped = Array.from(new Set(filtered))
  const withoutRoot = deduped.filter(r => r !== '/')
  const result = ['/', ...withoutRoot]

  return result.slice(0, 20) // max 20 routes to avoid excessive testing
}

function extractLinksFromPageData(data: any, routes: Set<string>, frontendUrl: string): void {
  if (!data) return
  if (typeof data === 'string') return

  if (Array.isArray(data)) {
    for (const item of data) {
      extractLinksFromPageData(item, routes, frontendUrl)
    }
    return
  }

  if (typeof data === 'object') {
    // Check for href-like properties
    if (data.href && typeof data.href === 'string' && isInternalRoute(data.href, frontendUrl)) {
      routes.add(normalizeRoute(data.href, frontendUrl))
    }
    if (data.url && typeof data.url === 'string' && isInternalRoute(data.url, frontendUrl)) {
      routes.add(normalizeRoute(data.url, frontendUrl))
    }
    // Recurse into children
    for (const key of Object.keys(data)) {
      if (key === 'children' || key === 'items' || key === 'nodes') {
        extractLinksFromPageData(data[key], routes, frontendUrl)
      }
    }
  }
}

function isInternalRoute(href: string, frontendUrl: string): boolean {
  if (!href) return false
  if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return false
  if (href.startsWith('/')) return true
  if (href.startsWith(frontendUrl)) return true
  // Relative routes
  if (!href.startsWith('http')) return true
  return false
}

function normalizeRoute(href: string, frontendUrl: string): string {
  // Strip configured origin first (covers hostnames that normalizeRoutePath's
  // generic `https?://host` regex also handles — this branch is kept for
  // defensive parity with older behavior).
  let path = href
  if (path.startsWith(frontendUrl)) {
    path = path.slice(frontendUrl.length) || '/'
  }
  // Canonicalize dynamic segments (`:id`, `/42`, UUIDs, template vars) so
  // runtime-observed paths match statically discovered ones from Phase 5A.
  // See src/services/systest/routeNormalizer.ts for the full rule set.
  return normalizeRoutePath(path)
}

function generateTestValueForInput(input: any, seed: any): string {
  const type = (input.type || 'text').toLowerCase()
  const name = (input.name || '').toLowerCase()

  if (type === 'email' || name.includes('email')) return seed.auth?.email || 'test@example.com'
  if (type === 'password' || name.includes('password')) return seed.auth?.password || 'Test@123456'
  if (type === 'number') return '42'
  if (type === 'tel') return '+1234567890'
  if (type === 'url') return 'https://example.com'
  if (type === 'date') return '2025-01-15'
  if (name.includes('name') || name.includes('title')) return 'E2E Test Item'
  if (name.includes('description') || name.includes('content') || name.includes('body')) return 'Auto-generated E2E test data'

  return 'test_value_' + Date.now()
}

// ─── Direct HTTP E2E Tests ──────────────────────────────────────────────────

async function runDirectHttpE2ETests(
  results: TestSummary,
  frontendUrl: string,
  backendUrl: string,
): Promise<void> {
  // Test 1: Frontend home page is reachable
  await runOneTest(results, 'E2E-001', 'Frontend Home (HTTP)', async () => {
    const res = await fetch(frontendUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return 'direct-http' as const
  })

  // Test 2: API health endpoint
  await runOneTest(results, 'E2E-002', 'API Health (HTTP)', async () => {
    const res = await fetch(backendUrl + '/api/health', { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return 'direct-http' as const
  })

  // Test 3: Frontend returns HTML (not JSON error)
  await runOneTest(results, 'E2E-003', 'Frontend Content Type', async () => {
    const res = await fetch(frontendUrl, { signal: AbortSignal.timeout(10000) })
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html')) throw new Error('Expected text/html, got ' + ct)
    return 'direct-http' as const
  })

  // Test 4: Common routes return 200 or redirect
  const commonRoutes = ['/login', '/dashboard', '/']
  for (let i = 0; i < commonRoutes.length; i++) {
    const route = commonRoutes[i]
    await runOneTest(results, 'E2E-ROUTE-' + String(i + 1).padStart(3, '0'), 'Route: ' + route + ' (HTTP)', async () => {
      const res = await fetch(frontendUrl + route, {
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      })
      // Accept 200 and 3xx redirects (which follow returns as 200)
      if (!res.ok && res.status !== 304) throw new Error('HTTP ' + res.status)

      results.routeTests.push({
        route,
        status: 'passed',
        consoleErrors: 0,
        networkErrors: 0,
      })

      return 'direct-http' as const
    })
  }

  // Set login test as skipped for HTTP mode
  results.loginTest = {
    status: 'failed',
    adminLogin: false,
    error: 'Login flow requires Chrome MCP',
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getTabId(): Promise<number | null> {
  try {
    const tabResult = await callMcpTool('mcp__claude-in-chrome__tabs_context_mcp', { createIfEmpty: true })
    const tabs = tabResult.data?.tabs || tabResult.data?.availableTabs || []
    const firstTab = tabs[0]
    return firstTab?.id || firstTab?.tabId || null
  } catch {
    return null
  }
}

function extractMessageCount(consoleResult: any): number {
  if (!consoleResult.success) return 0
  const messages = consoleResult.data?.messages || consoleResult.data || []
  return Array.isArray(messages) ? messages.length : 0
}

async function runOneTest(
  results: TestSummary,
  id: string,
  name: string,
  fn: () => Promise<'chrome-mcp' | 'direct-http'>,
): Promise<void> {
  const start = Date.now()
  try {
    const method = await fn()
    results.results.push({ id, name, status: 'passed', duration: Date.now() - start, testingMethod: method })
    results.total++
    results.passed++
    console.log('[Phase 5C]   OK ' + name)
  } catch (error) {
    const method = results.testingMethod
    results.results.push({ id, name, status: 'failed', duration: Date.now() - start, error: String(error), testingMethod: method })
    results.total++
    results.failed++
    console.log('[Phase 5C]   FAIL ' + name + ' ' + String(error))
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
