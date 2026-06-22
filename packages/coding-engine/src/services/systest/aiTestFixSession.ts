/**
 * AI-driven test-and-fix session wrapper around the query AsyncGenerator.
 *
 * Provides helpers to launch a full query loop that tests endpoints (API or
 * frontend), detects failures, fixes bugs in-place, and reports results back
 * as a structured AiSessionResult.
 */

import { dirname, join } from 'node:path'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { appendFile, mkdir } from 'node:fs/promises'

import { query } from '../../query.js'
import type { Message } from '../../types/message.js'
import type { SystestContext } from '../../commands/systest/phases/orchestrator.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiSessionResult {
  passRate: number
  total: number
  passed: number
  failed: number
  bugsFixed: number
  toolUseCount: number
  /** NEW: count of Edit / Write / NotebookEdit tool_use blocks observed in the session stream. */
  editToolUseCount?: number
  /** NEW: upper bound on bugsFixed (== editToolUseCount at capping time). */
  bugsFixedCap?: number
  /** NEW: AI self-reported bugsFixed BEFORE capping (for telemetry / drift analysis). */
  bugsFixedRaw?: number
  /** NEW: true iff bugsFixedRaw > bugsFixedCap (AI over-reported). */
  cappingApplied?: boolean
  results: any[]
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

/**
 * Check whether an AI-driven test-fix session can run.
 *
 * Requires a real ToolUseContext (with options.tools, getAppState, etc.) –
 * a mock / partial context will cause query() to blow up.
 */
export function canRunAiSession(ctx: SystestContext): boolean {
  const tuc = ctx.toolUseContext
  if (!tuc) return false
  if (!tuc.options?.tools) return false
  if (typeof tuc.getAppState !== 'function') return false
  // query() accesses appState.toolPermissionContext.mode — must exist
  try {
    const appState = tuc.getAppState()
    if (!appState?.toolPermissionContext?.mode) return false
  } catch {
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Core session runner
// ---------------------------------------------------------------------------

/**
 * Run an AI test-and-fix session via the query AsyncGenerator.
 *
 * The AI will test endpoints, fix bugs, and (if instructed in the prompt)
 * write a JSON results file that `parseSessionResults` picks up.
 */
export async function runAiTestFixSession(
  prompt: string,
  ctx: SystestContext,
  maxTurns: number = 50,
  phase: '5b' | '5c' | 'unknown' = 'unknown',
  iteration: number = 0,
): Promise<AiSessionResult> {
  const sessionStartMs = Date.now()
  const tuc = ctx.toolUseContext!

  // Build system prompt parts using the real fetchSystemPromptParts signature
  const { fetchSystemPromptParts } = await import('../../utils/queryContext.js')
  const { asSystemPrompt } = await import('../../utils/systemPromptType.js')

  const { defaultSystemPrompt, userContext, systemContext } =
    await fetchSystemPromptParts({
      tools: tuc.options.tools,
      mainLoopModel: tuc.options.mainLoopModel || 'claude-sonnet-4-6',
      additionalWorkingDirectories: [],
      mcpClients: tuc.options.mcpClients || [],
      customSystemPrompt: undefined,
    })

  const messages: Message[] = [{ role: 'user', content: prompt }]

  let toolUseCount = 0
  let editToolUseCount = 0

  try {
    for await (const event of query({
      messages,
      systemPrompt: asSystemPrompt(defaultSystemPrompt),
      userContext,
      systemContext,
      canUseTool:
        tuc.canUseTool || (async () => ({ behavior: 'allow' as const })),
      toolUseContext: tuc,
      querySource: 'sdk',
      maxTurns,
    })) {
      // Count tool-use blocks emitted by the assistant
      if (
        event.type === 'assistant' ||
        (event as any).role === 'assistant'
      ) {
        const content = (event as any).content || []
        for (const block of content) {
          if (block.type === 'tool_use') {
            toolUseCount++
            // Count Edit / Write / NotebookEdit tool uses specifically —
            // these are the only tools that actually mutate source files.
            const name = (block as any).name
            if (
              name === 'Edit' ||
              name === 'Write' ||
              name === 'NotebookEdit'
            ) {
              editToolUseCount++
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[AI Session] query error:', err)
  }

  console.log(
    '[AI Session] Complete. Tool uses:',
    toolUseCount,
    ' Edit/Write uses:',
    editToolUseCount,
  )

  // Parse results from the JSON file the AI was instructed to write
  const parsed = parseSessionResults(ctx.outputDir, toolUseCount)

  // Cap the AI-reported bugsFixed to the number of actual Edit/Write calls
  // observed in the session stream. If the AI over-reports, log a warning.
  const cappedBugsFixed = Math.min(parsed.bugsFixed, editToolUseCount)
  const cappingApplied = parsed.bugsFixed > editToolUseCount
  if (cappingApplied) {
    console.warn(
      `[AI Session] AI claimed ${parsed.bugsFixed} bugs fixed but only ${editToolUseCount} Edit/Write calls observed — capping bugsFixed to ${editToolUseCount}`,
    )
  }

  const result: AiSessionResult = {
    ...parsed,
    bugsFixed: cappedBugsFixed,
    editToolUseCount,
    bugsFixedCap: editToolUseCount,
    bugsFixedRaw: parsed.bugsFixed,
    cappingApplied,
  }

  // Append per-iteration stats to session_stats.jsonl for telemetry / trend
  // analysis. Never fail the session if telemetry writing errors.
  try {
    await appendSessionStats(ctx, {
      timestamp: new Date().toISOString(),
      phase,
      iteration,
      turnCount: toolUseCount, // best-available proxy: tool_use blocks observed
      toolUseCount,
      editToolUseCount,
      bugsFixed: cappedBugsFixed,
      bugsFixedRaw: parsed.bugsFixed,
      bugsFixedCap: editToolUseCount,
      cappingApplied,
      passRate: parsed.passRate,
      totalTests: parsed.total,
      passedTests: parsed.passed,
      failedTests: parsed.failed,
      durationMs: Date.now() - sessionStartMs,
      success: true,
    })
  } catch (e) {
    // Never fail the session due to telemetry
    console.warn(
      `[telemetry] Failed to append session stats: ${(e as Error).message}`,
    )
  }

  return result
}

// ---------------------------------------------------------------------------
// Telemetry helper
// ---------------------------------------------------------------------------

/**
 * Append one JSON object per line to ${outputDir}/session_stats.jsonl.
 *
 * Format: JSON Lines (https://jsonlines.org/) — one object per line, '\n'-
 * terminated. append-only; never overwrites existing rows.
 */
async function appendSessionStats(
  ctx: SystestContext,
  stats: Record<string, unknown>,
): Promise<void> {
  const statsPath = join(ctx.outputDir, 'session_stats.jsonl')
  // Ensure parent dir exists (idempotent)
  await mkdir(dirname(statsPath), { recursive: true })
  // JSONL: one object per line
  const line = JSON.stringify(stats) + '\n'
  await appendFile(statsPath, line, 'utf-8')
}

// ---------------------------------------------------------------------------
// Result parser
// ---------------------------------------------------------------------------

function parseSessionResults(
  outputDir: string,
  toolUseCount: number,
): AiSessionResult {
  const logsDir = join(outputDir, 'test-logs')

  // Look for the most recent iteration results (phase5b or phase5c)
  try {
    const files = readdirSync(logsDir)
      .filter(
        (f) =>
          (f.startsWith('phase5b_iteration_') || f.startsWith('phase5c_iteration_')) && f.endsWith('_results.json'),
      )
    if (files.length > 0) {
      files.sort().reverse() // newest first
      const data = JSON.parse(
        readFileSync(join(logsDir, files[0]!), 'utf-8'),
      )
      return {
        passRate: data.pass_rate ?? data.passRate ?? 0,
        total: data.total ?? 0,
        passed: data.passed ?? 0,
        failed: data.failed ?? 0,
        bugsFixed: data.bugs_fixed ?? data.bugsFixed ?? 0,
        toolUseCount,
        results: data.results ?? [],
      }
    }
  } catch {
    // directory may not exist yet – fall through
  }

  // Fallback: phase5b_results.json (non-iteration variant)
  try {
    const path = join(logsDir, 'phase5b_results.json')
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf-8'))
      const total = data.total ?? 0
      const passed = data.passed ?? 0
      return {
        passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
        total,
        passed,
        failed: data.failed ?? 0,
        bugsFixed: 0,
        toolUseCount,
        results: data.results ?? [],
      }
    }
  } catch {
    // fall through
  }

  // No results found – the AI may not have written the file yet
  return {
    passRate: 0,
    total: 0,
    passed: 0,
    failed: 0,
    bugsFixed: 0,
    toolUseCount,
    results: [],
  }
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Build the prompt for a Phase 5B (API test-and-fix) iteration.
 */
export function buildPhase5BPrompt(
  seed: any,
  ctx: SystestContext,
  iteration: number,
): string {
  const backendUrl = ctx.backendUrl || ''
  const workspace = ctx.workspace
  const layer1 = seed.layer1Tests || []
  const layer2 = seed.layer2Tests || []
  const auth = seed.auth || {}
  const authAdmin = seed.auth_admin || {}

  return `# Phase 5B: API Test & Fix — Iteration ${iteration}

## MISSION
Test ALL API endpoints via a hybrid strategy and fix ANY bugs found immediately.
- Test execution: batch via pre-installed Python runner
- Bug fixing: ALWAYS your responsibility (Edit tool), NEVER delegated to Python

## BACKEND
- URL: ${backendUrl}
- Swagger UI: ${backendUrl}/docs
- Workspace: ${workspace}

## AUTH
User: ${JSON.stringify(auth)}
Admin: ${JSON.stringify(authAdmin)}

## TEST DATA
Layer 1 (${layer1.length} happy-path tests):
${JSON.stringify(layer1.slice(0, 50), null, 2)}

Layer 2 (${layer2.length} auth/validation/edge tests):
${JSON.stringify(layer2.slice(0, 30), null, 2)}

## 🚫 ABSOLUTELY FORBIDDEN

You MUST NOT:
1. ❌ Write your own Python test runner (one is already installed at \`${workspace}/.systest/phase5b_test_runner.py\`)
2. ❌ Write a \`fix_bugs()\` or similar auto-fix function in Python
3. ❌ Use \`print()\` or any logging to simulate bug fixes
4. ❌ Update bug_fix counters without actually modifying code
5. ❌ Write wrapper scripts that "pretend" to fix — every reported fix must correspond to an actual Edit tool call

**If you write Python code that reads a file and does NOT write back with Edit tool, you are cheating.**

## ✅ MANDATORY EXECUTION STRATEGY

### Step 1: Verify test runner is installed
Confirm that \`${workspace}/.systest/phase5b_test_runner.py\` exists (installed by resourceInstaller).
If missing: STOP and report "Phase 5B runner template not installed — check resourceInstaller".

### Step 2: Execute the Python runner (test-only, no fix)
Run the installed runner, writing directly to the FINAL results path
(NOT an intermediate file — the same JSON will be augmented in Step 7):
\`\`\`bash
cd ${workspace} && python .systest/phase5b_test_runner.py \\
  --iteration ${iteration} \\
  --output ${ctx.outputDir}/test-logs/phase5b_iteration_${iteration}_results.json
\`\`\`
The runner will:
- Load test cases from seed
- Execute each via HTTP requests
- Write per-test results + summary to the FINAL output JSON
- **NOT attempt any fix — that's your job**

You will re-read and augment this same file in Steps 3-7.

### Step 3: Read failures from the results file
After runner completes, read
\`${ctx.outputDir}/test-logs/phase5b_iteration_${iteration}_results.json\`:
\`\`\`json
{ "iteration": N, "total": N, "passed": N, "failed": N, "pass_rate": N.N,
  "failures": [...], "results": [...] }
\`\`\`
Identify unique failures to fix (dedupe by endpoint+actualStatus).

### Step 4: Fix bugs (Claude-driven, with Edit tool)

⚠️ This step is YOUR responsibility. The Python runner has NO fix logic. Every bug must be fixed by YOU using Edit tool.

For each unique failure (deduplicate by endpoint+error-type):
1. **Analyze**: read responseBody, error message, status
2. **Locate**: use graph_query to find source file (e.g. graph_query("endpoint /api/flights POST handler"))
3. **Read**: open the source file with Read tool
4. **Fix**: use Edit tool with precise old_string/new_string — no regex tricks, no print statements
5. **Log the fix**: append a line to \`.systest/test-logs/phase5b_iter_${iteration}_fixes.md\`:
   \`\`\`
   - {timestamp} | {test_id} | {endpoint} | {file}:{line} | {fix_description}
   \`\`\`

### Step 5: Restart backend (if Python source was edited)
If any fix touched \`.py\` files (backend):
- Backend uvicorn auto-reload should pick it up within 2-3s
- Confirm by re-fetching \`/openapi.json\` and checking it responds

### Step 6: Verify fixes (re-run runner)
Run the Python runner again, overwriting the results file with post-fix numbers:
\`\`\`bash
python .systest/phase5b_test_runner.py \\
  --iteration ${iteration} \\
  --output ${ctx.outputDir}/test-logs/phase5b_iteration_${iteration}_results.json
\`\`\`
Check if pass_rate improved. If same failures persist → your Edit didn't fix the real bug → re-analyze.

### Step 7: Augment the results file (overwrite in place)
After all fixes and the verify re-run: re-open
\`${ctx.outputDir}/test-logs/phase5b_iteration_${iteration}_results.json\`
and ADD the following fields (preserve all existing fields from the runner):
\`\`\`json
{
  "bugs_fixed": K,
  "files_edited": ["backend/api/flights.py", "..."],
  "fix_log": [
    { "test_id": "...", "file": "...", "description": "...", "timestamp": "..." }
  ]
}
\`\`\`
- \`bugs_fixed\` MUST equal the number of Edit tool invocations you made in this iteration.
- \`files_edited\` is the list of absolute/relative paths actually modified.
- \`fix_log\` has one entry per Edit call.
Write back to the SAME path. meta-coder's parseSessionResults reads this JSON
to judge iteration progress — do NOT write to a different file name.

## RULES

- Fix code in ${workspace}, NEVER in meta-coder
- Fix bugs IMMEDIATELY when found, don't collect for later
- Do NOT change test expectations — fix actual code
- Every "bug fixed" count MUST correspond to an Edit tool invocation (verifiable in session log)
- Write the JSON results file — the iteration loop depends on it
- If the Python runner hangs or crashes: debug it BUT DO NOT add fix logic to it — it remains test-only forever

## ANTI-PATTERNS TO AVOID (airlinesys6 incident)

These EXACT patterns appeared in airlinesys6 and are now forbidden:
- \`print(f"  Fixing null pointer in {source_file}")\` + \`fixes_applied += 1\` without Edit call
- \`with open(file, 'r') as f: content = f.read()\` followed by no \`write\`
- Creating \`fix_bugs()\`, \`apply_fix()\`, \`repair_code()\` methods in Python
- Silent success logging like "bugs_fixed: 10" when no files were actually edited

## AUTH TOKEN REFRESH (if 401 rate spikes)

If >30% of tests return 401 and were passing previously:
1. The JWT in seed has likely expired (default TTL 30-60 min)
2. Re-login: POST ${backendUrl}/api/auth/login with { username, password } from seed.auth
3. Extract the new \`access_token\` from the response
4. Update the seed in memory (and pass the fresh token to the runner) and re-run the runner
5. If login itself returns 401: backend auth is broken — fix that first (highest priority)

⚠️ DO NOT mask auth failures as "bug fixed". A 401 means the test never reached
the endpoint under test, so there is no bug to count there — fix auth first.

## BUGS_FIXED COUNT RULE

The \`bugs_fixed\` field you write to the results JSON MUST equal the number of
distinct Edit/Write tool invocations you made during this iteration.
meta-coder verifies this by counting tool_use blocks with name='Edit' or
'Write' in the session stream. If your self-reported count exceeds the actual
Edit count, meta-coder caps it automatically and logs a warning.

Each Edit call = 1 fix. If you edit 3 files for 1 logical bug, that's 3.
If you edit 1 file to fix 5 related symptoms, that's 1.
`
}

/**
 * Build the prompt for a Phase 5C (Frontend E2E test-and-fix) iteration.
 */
export function buildPhase5CPrompt(
  seed: any,
  ctx: SystestContext,
  iteration: number,
): string {
  const frontendUrl = ctx.frontendUrl || ''
  const backendUrl = ctx.backendUrl || ''
  const workspace = ctx.workspace
  const auth = seed.auth || {}
  const authAdmin = seed.auth_admin || {}
  const routes = seed.routes || seed.frontendRoutes || []

  return `# Phase 5C: Frontend E2E Test & Fix — Iteration ${iteration}

## MISSION
Test ALL frontend routes/pages via Claude in Chrome (browser automation) and fix bugs with Edit tool.

## 🚫 ABSOLUTELY FORBIDDEN

You MUST NOT:
1. ❌ Write ANY helper scripts — no Python, no Node.js, no Playwright scripts, no Selenium scripts, NOTHING
2. ❌ Use requests, axios, curl, or any HTTP library from a script to test the frontend
3. ❌ Create \`.systest/phase5c_e2e_runner.py\` or similar
4. ❌ Use the Bash tool to spawn node/python for E2E testing
5. ❌ Delegate browser automation to any external tool or script

**Phase 5C requires REAL browser testing. Only \`mcp__Claude_in_Chrome__*\` tools can observe console errors, network requests, DOM state, screenshots, and form behavior — exactly the things frontend bugs manifest as. A Python script that calls HTTP endpoints does NOT test the frontend.**

## ✅ MANDATORY TOOLS

You MUST use only these for Phase 5C:
- \`mcp__Claude_in_Chrome__navigate\` — open a URL in the browser
- \`mcp__Claude_in_Chrome__read_page\` — read current DOM + URL
- \`mcp__Claude_in_Chrome__read_console_messages\` — get JS console errors
- \`mcp__Claude_in_Chrome__read_network_requests\` — get failed API calls
- \`mcp__Claude_in_Chrome__form_input\` — fill form fields
- \`mcp__Claude_in_Chrome__computer action=left_click / screenshot / type\` — user interaction
- \`mcp__Claude_in_Chrome__find\` — find interactive elements
- \`mcp__Claude_in_Chrome__javascript_tool\` — run JS in page context (use sparingly)

Plus (for fixes):
- \`graph_query\` — find frontend source file
- \`Read\` / \`Edit\` — read and modify source

## TOOL USAGE EXAMPLES (mcp__Claude_in_Chrome__form_input)

Fill a single input field:
\`\`\`
mcp__Claude_in_Chrome__form_input
  selector: "input[name='firstname']"
  value: "John"
\`\`\`

Fill a select / dropdown:
\`\`\`
mcp__Claude_in_Chrome__form_input
  selector: "select[name='country']"
  value: "US"
\`\`\`

Fill a textarea:
\`\`\`
mcp__Claude_in_Chrome__form_input
  selector: "textarea[name='notes']"
  value: "Some text"
\`\`\`

To fill a form with multiple fields: call \`form_input\` ONCE PER field, in order.
DO NOT try to batch multiple fields in one call — the MCP API is per-element.

Submit button:
\`\`\`
mcp__Claude_in_Chrome__computer
  action: "left_click"
  target: "button[type='submit']"
\`\`\`

## FRONTEND
- URL: ${frontendUrl}
- Backend API: ${backendUrl}
- Workspace: ${workspace}

## AUTH
Admin: ${JSON.stringify(authAdmin)}
User: ${JSON.stringify(auth)}

## ROUTES TO TEST
${JSON.stringify(routes, null, 2)}

## BATCHING STRATEGY (efficiency for many routes)

Process routes **by PRP module**, not one by one randomly:
1. Group routes by module (e.g. /passengers/*, /airports/*)
2. For each module: login once, navigate module routes in order
3. Fix all bugs in one module before moving to next (avoids context switch)
4. Between modules: clear console log, reset navigation

Expected throughput: 5-10 routes per browser session, ~30-60s per route including fix time.

## ✅ MANDATORY EXECUTION

### Step 1: Open browser and authenticate
\`\`\`
mcp__Claude_in_Chrome__navigate url=${frontendUrl}/login
mcp__Claude_in_Chrome__form_input  (fill email + password from seed.auth)
mcp__Claude_in_Chrome__computer action=left_click  (submit)
\`\`\`
Verify URL changed away from /login. If not: FIX login bug first (Read + Edit frontend auth code), retry.

### Step 2: For EACH route in seed

a. Navigate:
   \`\`\`
   mcp__Claude_in_Chrome__navigate url=${frontendUrl}{route}
   \`\`\`
   Wait 2s for React render.

b. Check for rendering failures:
   \`\`\`
   mcp__Claude_in_Chrome__read_console_messages onlyErrors=true
   mcp__Claude_in_Chrome__read_network_requests
   mcp__Claude_in_Chrome__read_page
   \`\`\`
   Record: console_errors, network 4xx/5xx, page text content length.

c. If the route is a Form page (e.g. /new, /edit):
   - Fill ALL required fields (use seed.entities[Entity].records[0] as test data)
   - Click Submit
   - Check the POST/PUT request status from network log
   - **422 = contract gap**: the form is missing required backend fields
     - Read form source (graph_query + Read)
     - Compare required fields from backend Pydantic schema
     - Edit form to add missing inputs
     - Re-test (navigate back, fill, submit) to verify fix

d. If the route is a List/Detail page:
   - Verify data is displayed (page text length > 100, no "Loading..." stuck)
   - Check Edit/Delete buttons work → click → verify navigation

e. Capture evidence:
   - Screenshot: \`mcp__Claude_in_Chrome__computer action=screenshot\`
   - Save to: \`${ctx.outputDir}/evidence/phase5c/{route-slug}/screenshot.png\`

### Step 3: Fix bugs (Edit tool, not scripts)

For each bug found:
1. **graph_query** to find source file in ${workspace}/frontend/
2. **Read** the file
3. **Edit** with precise old_string/new_string — NEVER regex replace, NEVER string manipulation in scripts
4. Re-navigate to the route via Chrome MCP to verify fix took effect (Vite HMR should auto-reload)
5. Log the fix to \`.systest/test-logs/phase5c_iter_${iteration}_fixes.md\`

### Step 4: Write results JSON

Write to: \`${ctx.outputDir}/test-logs/phase5c_iteration_${iteration}_results.json\`
Format:
\`\`\`json
{
  "total": N_routes,
  "passed": N,
  "failed": N,
  "pass_rate": N.NN,
  "bugs_fixed": K,
  "files_edited": ["frontend/src/pages/Airport/CreateForm.tsx", ...],
  "results": [
    { "route": "/airports/new", "pass": false, "consoleErrors": 0, "networkErrors": 1,
      "contract_gap": { "form_fields": [...], "backend_required": [...], "missing": [...] },
      "evidence_dir": "..." },
    ...
  ]
}
\`\`\`

## RULES

- Frontend Vite HMR should auto-reload on file save; no manual restart needed
- If Chrome MCP connection fails: STOP and report — do NOT fall back to Python scripts
- Fix code in ${workspace}/frontend/, NEVER in meta-coder
- Every "bug fixed" count MUST correspond to an Edit tool invocation
- Contract gaps (422 on form submit) are HIGH priority — they break user-facing features

## ANTI-PATTERNS TO AVOID (airlinesys6 incident)

These EXACT patterns appeared in airlinesys6 \`.systest/phase5c_e2e_runner.py\` and are now forbidden:
- Writing any Python/Node script to "automate" E2E (Chrome MCP IS the automation)
- Detecting bugs without fixing them (airlinesys6 runner had no fix logic at all)
- Using requests/axios to call /api endpoints (that's Phase 5B, not 5C)
- Recording "bugs found: 10" without "bugs fixed: 10" + corresponding Edit calls

## AUTH TOKEN REFRESH (if 401 rate spikes)

If >30% of routes get kicked back to /login (or XHRs return 401) mid-iteration:
1. The session cookie / stored JWT in the browser has likely expired
   (default TTL 30-60 min).
2. Re-login via the UI:
   - \`mcp__Claude_in_Chrome__navigate\` to \`${frontendUrl}/login\`
   - \`mcp__Claude_in_Chrome__form_input\` for email + password from seed.auth
   - \`mcp__Claude_in_Chrome__computer action=left_click\` on the submit button
3. Verify the URL moves away from /login and no 401s appear in the network log.
4. Resume the route you were testing.
5. If the login itself returns 401 (or the /api/auth/login call 4xx's): backend
   auth is broken — switch to fixing that first (highest priority) before
   continuing frontend tests.

⚠️ DO NOT mask auth failures as "bug fixed". A 401 / redirect-to-login means
the test never exercised the page under test, so there is no frontend bug
to count there — re-authenticate first.

## BUGS_FIXED COUNT RULE

The \`bugs_fixed\` field you write to the results JSON MUST equal the number of
distinct Edit/Write tool invocations you made during this iteration.
meta-coder verifies this by counting tool_use blocks with name='Edit' or
'Write' in the session stream. If your self-reported count exceeds the actual
Edit count, meta-coder caps it automatically and logs a warning.

Each Edit call = 1 fix. If you edit 3 files for 1 logical bug, that's 3.
If you edit 1 file to fix 5 related symptoms, that's 1.
`
}
