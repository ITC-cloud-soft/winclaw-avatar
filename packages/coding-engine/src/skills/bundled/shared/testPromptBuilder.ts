import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestPromptParams {
  workspace: string           // target project workspace
  outputDir: string           // .project or .systest directory
  backendUrl?: string         // e.g. http://localhost:8000
  frontendUrl?: string        // e.g. http://localhost:5173
  databaseUrl?: string        // mysql://...
  designStyle?: string        // stripe, linear.app, etc.
  seedPath?: string           // path to test_data_seed.json (override)
  testCasesPath?: string      // path to generated-test-cases.json (override)
  authEmail?: string          // pre-registered user email
  authPassword?: string       // pre-registered user password
  adminEmail?: string         // pre-registered admin email
  adminPassword?: string      // pre-registered admin password
  authToken?: string          // pre-obtained JWT
  adminToken?: string         // pre-obtained admin JWT
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildSharedTestPrompt(params: TestPromptParams): string {
  const ws = params.workspace.replace(/\\/g, '/')
  const out = params.outputDir.replace(/\\/g, '/')

  const backendUrl = params.backendUrl || ''
  const frontendUrl = params.frontendUrl || ''
  const databaseUrl = params.databaseUrl || ''

  const seedPath = (params.seedPath || join(params.outputDir, 'test-logs', 'test_data_seed.json')).replace(/\\/g, '/')
  const testCasesPath = (params.testCasesPath || join(params.outputDir, 'test-cases', 'generated-test-cases.json')).replace(/\\/g, '/')
  const phase5bResultsPath = join(params.outputDir, 'test-logs', 'phase5b_results.json').replace(/\\/g, '/')
  const phase5cResultsPath = join(params.outputDir, 'test-logs', 'phase5c_results.json').replace(/\\/g, '/')
  const reportPath = join(params.outputDir, 'docs', 'TEST_REPORT.md').replace(/\\/g, '/')
  const graphPath = join(params.workspace, 'graphify-out', 'graph.json').replace(/\\/g, '/')

  const sections: string[] = []

  // ── Phase 5A: Pre-Test Setup ──
  sections.push(buildPhase5A({
    ws,
    out,
    backendUrl,
    frontendUrl,
    databaseUrl,
    seedPath,
    testCasesPath,
    params,
  }))

  // ── CHECKPOINT 5A -> 5B ──
  sections.push(`
---

CHECKPOINT: Phase 5A -> 5B
Verify: services running, seed file exists at ${seedPath}, test cases exist at ${testCasesPath}.

---`)

  // ── Phase 5B: API Testing ──
  sections.push(buildPhase5B({
    ws,
    backendUrl,
    databaseUrl,
    seedPath,
    testCasesPath,
    phase5bResultsPath,
    params,
  }))

  // ── CHECKPOINT 5B -> 5C ──
  sections.push(`
---

CHECKPOINT: Phase 5B -> 5C
Verify: ${phase5bResultsPath} written with pass rate. Proceed to frontend testing regardless of pass rate.

---`)

  // ── Phase 5C: Frontend E2E Testing ──
  sections.push(buildPhase5C({
    ws,
    frontendUrl,
    seedPath,
    phase5cResultsPath,
    params,
  }))

  // ── CHECKPOINT 5C -> 6 ──
  sections.push(`
---

CHECKPOINT: Phase 5C -> 6
1. Rebuild knowledge graph one FINAL time (reflects all bug fixes from Phase 5)
2. This ensures Phase 6 documentation and architecture diagrams are accurate
3. Proceed to report generation using the latest graph data.

---`)

  // ── Phase 6: Report Generation ──
  sections.push(buildPhase6({
    phase5bResultsPath,
    phase5cResultsPath,
    reportPath,
  }))

  // ── Mandatory Rules ──
  sections.push(buildMandatoryRules({ ws, graphPath }))

  return sections.join('\n')
}

// ---------------------------------------------------------------------------
// Phase 5A
// ---------------------------------------------------------------------------

interface Phase5ACtx {
  ws: string
  out: string
  backendUrl: string
  frontendUrl: string
  databaseUrl: string
  seedPath: string
  testCasesPath: string
  params: TestPromptParams
}

function buildPhase5A(ctx: Phase5ACtx): string {
  const dbSetup = ctx.databaseUrl
    ? `
1. **Create database** (if databaseUrl provided):
   \`\`\`bash
   # Parse ${ctx.databaseUrl} and run:
   # MySQL:  mysql -h <host> -P <port> -u <user> -p'<pass>' -e "CREATE DATABASE IF NOT EXISTS <db>"
   # Postgres: PGPASSWORD='<pass>' createdb -h <host> -p <port> -U <user> <db> 2>/dev/null || true
   \`\`\`
2. **Run migrations** (look for alembic, prisma, knex, sequelize, drizzle, or similar in ${ctx.ws})
3. **Seed test data** — run any seed script found in ${ctx.ws}
`
    : `
1. **Run migrations** (look for alembic, prisma, knex, sequelize, drizzle, or similar in ${ctx.ws})
2. **Seed test data** — run any seed script found in ${ctx.ws}
`

  return `## Phase 5A: Pre-Test Setup

### STEP 0: Rebuild Knowledge Graph (CRITICAL for large projects)

The knowledge graph from Phase 1-3 is OUTDATED — it was built BEFORE Phase 4
generated all the new code. Rebuild it now so bug tracing in Phase 5B/5C works.

For projects with 2000+ files, this is ESSENTIAL — without an updated graph,
you cannot efficiently locate source files for bug fixes.

NOTE: If graph rebuild is not possible (no graphify CLI), use this fallback
strategy when graph_query returns no results:
1. Try Glob("**/filename*") to find by name pattern
2. Try Grep("function_name", path="src/") to find by content
3. Only then use Read on specific files
NEVER read all files in a directory for large projects.

### Service Startup -- Port Conflict Resolution

When starting backend or frontend services:
1. Try the default port first
2. If port is in use (EADDRINUSE):
   a. DO NOT give up. DO NOT stop testing.
   b. Try next port: 5174, 5175, ... or 8001, 8002, ...
   c. Use: npm run dev -- --port 5174
3. Log which port was used

WARNING: NEVER abandon testing because of a port conflict.

### Setup Steps
${dbSetup}
### Start Services

**Backend**${ctx.backendUrl ? ' (' + ctx.backendUrl + ')' : ''}:
- Find the start command in package.json, pyproject.toml, Makefile, etc.
- Start the backend server. If port conflict, increment port and retry.
- Health check: \`curl -s <backendUrl>/health || curl -s <backendUrl>/api/health\`

**Frontend**${ctx.frontendUrl ? ' (' + ctx.frontendUrl + ')' : ''}:
- Find the start command (usually \`npm run dev\` or \`yarn dev\`)
- Start the frontend. If port conflict, try --port 5174, 5175, etc.
- Verify: navigate to the URL in browser

### Post-Startup

1. **Verify Swagger UI** (MANDATORY):
   Try these URLs in order: /docs, /swagger, /swagger-ui.html, /api/documentation
   - If Swagger UI loads: fetch the OpenAPI spec from /openapi.json or /swagger.json
   - If Swagger UI is NOT accessible: this is a **bug** — fix it before proceeding
     (install the appropriate Swagger package for the framework and mount it)
   - Use the OpenAPI spec to generate additional test cases -> write to ${ctx.testCasesPath}

2. **Register test users** (if not already seeded):
${ctx.params.authEmail ? '   - User: ' + ctx.params.authEmail + ' / ' + (ctx.params.authPassword || '<from seed>') : '   - Register a test user via POST /register or /signup'}
${ctx.params.adminEmail ? '   - Admin: ' + ctx.params.adminEmail + ' / ' + (ctx.params.adminPassword || '<from seed>') : '   - Register an admin user if possible'}

3. **Obtain JWT tokens**:
${ctx.params.authToken ? '   - User token (pre-obtained): ' + ctx.params.authToken.substring(0, 30) + '...' : '   - Login with user credentials -> save token'}
${ctx.params.adminToken ? '   - Admin token (pre-obtained): ' + ctx.params.adminToken.substring(0, 30) + '...' : '   - Login with admin credentials -> save token'}
   - Write tokens to ${ctx.seedPath} (update auth.token / auth_admin.token)
`
}

// ---------------------------------------------------------------------------
// Phase 5B
// ---------------------------------------------------------------------------

interface Phase5BCtx {
  ws: string
  backendUrl: string
  databaseUrl: string
  seedPath: string
  testCasesPath: string
  phase5bResultsPath: string
  params: TestPromptParams
}

function buildPhase5B(ctx: Phase5BCtx): string {
  // Note: even if backendUrl is empty, Phase 5A may have started the backend.
  // Do NOT skip — instruct AI to use the URL discovered in Phase 5A.

  const dbPromotionBlock = ctx.databaseUrl
    ? `
   **Database available:** ${ctx.databaseUrl}
   Run SQL to promote the admin user:
   \`\`\`bash
   # For MySQL:
   mysql -h <host> -P <port> -u <user> -p'<pass>' <db> -e "UPDATE users SET role='admin' WHERE email='<admin_email>'"
   # For PostgreSQL:
   PGPASSWORD='<pass>' psql -h <host> -p <port> -U <user> -d <db> -c "UPDATE users SET role='admin' WHERE email='<admin_email>'"
   \`\`\`
   After promotion, re-login the admin user to get a new JWT with admin role.
`
    : `   **No database URL provided.** Try these alternatives:
   a. Look for a seed/migration script in the workspace that creates admin users
   b. Check if there's an API endpoint to change roles (unlikely but possible)
   c. If nothing works, skip admin-only tests and note them as "blocked by permissions"
`

  return `## Phase 5B: API Testing

Backend: ${ctx.backendUrl || '(use the URL from Phase 5A — the backend you started above)'}
Target pass rate: **95%**
Max rounds: **10**

### STEP 1: Read test cases

Use the Read tool to read these two files:
- ${ctx.seedPath} -- contains layer1Tests and layer2Tests arrays
- ${ctx.testCasesPath} -- contains apiTests with endpoint, method, requestBody, expectedStatus

These are the ONLY test cases you execute. Do NOT invent your own.

### STEP 2: Authenticate

Read auth credentials from the seed file:
- seed.auth.email / seed.auth.password -- regular user
- seed.auth_admin.email / seed.auth_admin.password -- admin user
- seed.auth.token / seed.auth_admin.token -- pre-obtained JWT tokens

If tokens are available, use them directly. If not, call the login endpoint to obtain tokens.
Use admin token for endpoints containing "/admin/".

### STEP 2.5: Verify admin access (CRITICAL)

Before running tests, verify that the admin token actually has admin privileges:

1. Call any /admin/ endpoint (e.g., GET /admin/api/model-keys) with the admin token
2. If response is 200 -> admin access confirmed, proceed
3. If response is 403 -> the admin user does NOT have admin role. Fix it:
${dbPromotionBlock}
4. After fix, re-verify the admin endpoint returns 200
5. Update the admin token in your working memory for all subsequent tests

### STEP 3: Execute ALL test cases (Round 1)

For each test case in the seed:
1. Send the HTTP request (use any tool: Bash with curl, Chrome MCP fetch, etc.)
2. Compare actual status code with expected status code
3. Record: { id, endpoint, method, expectedStatus, actualStatus, pass: true/false }

### STEP 4: Calculate pass rate and write results

After testing ALL cases, calculate:
  pass_rate = (passed / total) * 100

Write results to ${ctx.phase5bResultsPath}:
\`\`\`json
{
  "round": 1,
  "total": N,
  "passed": N,
  "failed": N,
  "passRate": N,
  "bugsFixed": 0,
  "results": [ ... ]
}
\`\`\`

### STEP 5: Bug fix loop -- MANDATORY, DO NOT SKIP, DO NOT ASK USER

WARNING: THIS STEP IS MANDATORY. You MUST execute this loop automatically.
WARNING: DO NOT stop and ask the user "should I continue?" -- just DO IT.
WARNING: DO NOT skip this step even if it seems difficult.

You are now in a DO-WHILE loop. Execute it until pass_rate >= 95% or round >= 10:

\`\`\`
round = 1
DO:
  round = round + 1

  5.1. Categorize all FAILED tests by status code:
       - 500 -> server bug (fixable: read error, trace source, fix code)
       - 404 -> resource not found (fixable: create resource first, or fix route)
       - 403 -> permission denied (fixable: check token, promote user role)
       - 400 -> bad request (fixable: check request body against OpenAPI schema)
       - 401 -> unauthorized (fixable: refresh token, re-authenticate)

  5.2. Fix the top 5-10 most impactful failures:
       a. Use graph_query / graph_path to locate source file in ${ctx.ws}
       b. Read the source file
       c. Fix the bug (Edit tool)
       d. Quick-verify the fix on that single endpoint

  5.3. Re-run ALL test cases (same as STEP 3)

  5.4. Calculate new pass_rate, write updated results JSON (overwrite previous)
       Log: "Round {round}: {pass_rate}% ({passed}/{total})"

WHILE (pass_rate < 95 AND round < 10)
\`\`\`

After loop exits:
- If pass_rate >= 95%: Log "Phase 5B PASSED: {pass_rate}% in {round} rounds"
- If round >= 10: Log "Phase 5B: max rounds reached, final pass_rate={pass_rate}%"
- Proceed to Phase 5C regardless.
`
}

// ---------------------------------------------------------------------------
// Phase 5C
// ---------------------------------------------------------------------------

interface Phase5CCtx {
  ws: string
  frontendUrl: string
  seedPath: string
  phase5cResultsPath: string
  params: TestPromptParams
}

function buildPhase5C(ctx: Phase5CCtx): string {
  // Note: even if frontendUrl is empty, Phase 5A may have started the frontend.
  // Do NOT skip — instruct AI to use the URL discovered in Phase 5A.

  return `## Phase 5C: Frontend E2E Testing

Frontend: ${ctx.frontendUrl || '(use the URL from Phase 5A — the frontend you started above)'}
Target pass rate: **95%**

### STEP 1: Login

1. Use mcp__Claude_in_Chrome__navigate to open ${ctx.frontendUrl}
2. Find email/password inputs (mcp__Claude_in_Chrome__find)
3. Read admin credentials from seed file (auth_admin.email + auth_admin.password) at ${ctx.seedPath}
4. Fill credentials and click login button
5. Wait 2-3 seconds and verify URL changed from /login
6. If login fails (still on /login page):
   a. Try regular user credentials (auth.email + auth.password)
   b. Check if the frontend requires a different auth mechanism
   c. Check browser console for error messages
   d. If the frontend is an admin console, ensure the user has admin role (see Phase 5B STEP 2.5)

### STEP 2: Discover routes

After login:
1. Read page with mcp__Claude_in_Chrome__read_page -- extract nav links
2. Also test common routes: /dashboard, /home, /settings, /users, /admin, /avatars
3. Also derive routes from seed entities (e.g., entity "Avatar" -> try /avatars)

### STEP 3: Test each page

For EACH route:
1. Navigate to the page
2. Screenshot (mcp__Claude_in_Chrome__computer action=screenshot)
3. Check console errors (mcp__Claude_in_Chrome__read_console_messages onlyErrors=true)
4. Check network errors (mcp__Claude_in_Chrome__read_network_requests)
5. If errors found -> find source in ${ctx.ws} -> fix -> refresh -> recheck
6. Test forms if present (find inputs, fill with test data, submit)

### STEP 4: Write results

Write to ${ctx.phase5cResultsPath}:
\`\`\`json
{
  "total": N,
  "passed": N,
  "failed": N,
  "passRate": N,
  "results": [ { "route": "/path", "pass": true, "consoleErrors": 0, "networkErrors": 0 } ]
}
\`\`\`

### STEP 5: Bug fix loop -- MANDATORY (same as Phase 5B)

WARNING: DO NOT SKIP. DO NOT ASK USER. Execute automatically.

If pass_rate < 95%:
1. Fix console errors and network errors found on each page
2. Use knowledge graph to locate source files in ${ctx.ws}
3. Fix bugs, refresh pages, recheck
4. Re-run all page tests
5. REPEAT until pass_rate >= 95% or 10 rounds
`
}

// ---------------------------------------------------------------------------
// Phase 6
// ---------------------------------------------------------------------------

interface Phase6Ctx {
  phase5bResultsPath: string
  phase5cResultsPath: string
  reportPath: string
}

function buildPhase6(ctx: Phase6Ctx): string {
  return `## Phase 6: Final Report

After Phase 5B and 5C, generate ${ctx.reportPath}:

Include:
- Executive summary: overall pass rates, rounds needed, bugs fixed
- Phase 5B results: per-endpoint pass/fail table
- Phase 5C results: per-route pass/fail table
- Bug fix log: what was fixed, in which file, which line
- Remaining failures: what couldn't be fixed and why
- Recommendations for the project owner

Read results from:
- ${ctx.phase5bResultsPath}
- ${ctx.phase5cResultsPath}
`
}

// ---------------------------------------------------------------------------
// Mandatory Rules
// ---------------------------------------------------------------------------

interface RulesCtx {
  ws: string
  graphPath: string
}

function buildMandatoryRules(ctx: RulesCtx): string {
  return `---

## MANDATORY RULES -- VIOLATION = TEST FAILURE

1. **READ the test data files first** -- do not guess test cases
2. **Execute ALL test cases from the seed** -- do not skip or invent
3. **Write results JSON after each round** -- the files are quality evidence
4. **Fix bugs in ${ctx.ws}** -- NEVER modify meta-coder source
5. **Use knowledge graph** (graph_query, graph_path) for code navigation -- graph at ${ctx.graphPath}
6. **95% pass rate is the target** -- keep fixing and retesting until reached or 10 rounds
7. **THE BUG FIX LOOP IS NOT OPTIONAL** -- if pass rate < 95%, you MUST automatically
   fix bugs and retest. Do NOT stop to ask the user. Do NOT skip the loop.
   Execute rounds 2, 3, 4... until 95% or round 10.
8. **NEVER ask "should I continue?"** -- the answer is always YES until 95% or 10 rounds
9. **Use graph tools before Read** -- graph_query is 0 tokens, Read is 1000+. Navigate with graph first.
10. **MAX 5 image analyses** -- if workspace has screenshots, pick 5 representative ones only
11. **MAX 20 tool calls per module** -- batch operations where possible
12. **Large project navigation** — for projects with 1000+ files:
    - ALWAYS try graph_query/graph_path FIRST (0 tokens)
    - If graph doesn't find it (new file from Phase 4): use Glob/Grep
    - NEVER read all files in a directory or grep entire workspace
    - Batch related bug fixes together (same module → one Read, multiple Edits)
    - Keep each bug fix under 5 tool calls
13. **Windows encoding** — On Windows, NEVER use \`>\` redirect or \`Out-File\` to write files (produces UTF-16LE BOM). Use \`Set-Content -Encoding UTF8\` or write via the Edit/Write tools instead.
`
}
