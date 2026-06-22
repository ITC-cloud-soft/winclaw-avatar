import { registerBundledSkill } from '../bundledSkills.js'
import { join } from 'node:path'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedArgs {
  workspace: string
  designDocsDir?: string
  backendUrl?: string
  frontendUrl?: string
  databaseUrl?: string
  // Env-aware fields
  envName?: string
  envVars?: Record<string, string>
  isProduction?: boolean
}

interface SetupResult {
  workspace: string
  outputDir: string
  seed: any
  testCases: any
  graphStats: { nodes: number; edges: number } | null
  phaseResults: { phase: string; status: string; duration: number }[]
  parsed: ParsedArgs
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(args: string): ParsedArgs {
  const parts = args.split(/\s+/)
  let workspace = ''
  let designDocsDir: string | undefined
  let backendUrl: string | undefined
  let frontendUrl: string | undefined
  let databaseUrl: string | undefined
  let envName: string | undefined

  let i = 0
  if (parts[0] === 'run') i = 1

  for (; i < parts.length; i++) {
    const part = parts[i]
    if ((part === '--workspace' || part === '-w') && i + 1 < parts.length) { workspace = parts[++i]; continue }
    if ((part === '--design-docs' || part === '-d') && i + 1 < parts.length) { designDocsDir = parts[++i]; continue }
    if ((part === '--backend-url' || part === '--backend' || part === '-b') && i + 1 < parts.length) { backendUrl = parts[++i]; continue }
    if ((part === '--frontend-url' || part === '--frontend' || part === '-f') && i + 1 < parts.length) { frontendUrl = parts[++i]; continue }
    if ((part === '--database' || part === '--database-url' || part === '--db') && i + 1 < parts.length) { databaseUrl = parts[++i]; continue }
    if (part === '--env' && i + 1 < parts.length) { envName = parts[++i]; continue }
  }

  // Normalize Windows backslashes
  workspace = workspace.replace(/\\/g, '/')

  return { workspace, designDocsDir, backendUrl, frontendUrl, databaseUrl, envName }
}

/**
 * Step 0: Env discovery — fill in missing URL args from the active/override env.
 *
 * Priority: explicit CLI args > active env inference > leave undefined.
 * If the resolved env is production, returns `isProduction: true` immediately
 * so the caller can refuse before any phase runs.
 */
async function applyEnvDiscovery(parsed: ParsedArgs, workspace: string): Promise<ParsedArgs> {
  // If all three URLs are explicitly given, skip env discovery entirely (backward compat)
  if (parsed.backendUrl && parsed.frontendUrl && parsed.databaseUrl) {
    return parsed
  }

  try {
    const { buildSystestSettings } = await import('../../services/envManager/systestEnvBridge.js')
    const settings = await buildSystestSettings(workspace, { envOverride: parsed.envName })
    if (!settings) return parsed

    // Emit warnings to console (non-fatal)
    for (const w of settings.warnings) {
      console.log('[systest] [env] ' + w)
    }

    // Production: surface immediately; caller must refuse
    if (settings.isProduction) {
      return { ...parsed, isProduction: true, envName: settings.sourceEnvName, envVars: settings.envVars }
    }

    // Fill only the slots that weren't explicitly passed
    return {
      ...parsed,
      backendUrl: parsed.backendUrl ?? settings.backendUrl,
      frontendUrl: parsed.frontendUrl ?? settings.frontendUrl,
      databaseUrl: parsed.databaseUrl ?? settings.databaseUrl,
      envName: settings.sourceEnvName,
      envVars: settings.envVars,
      isProduction: false,
    }
  } catch (e) {
    console.warn('[systest] [env] Env discovery failed (non-fatal):', e instanceof Error ? e.message : String(e))
    return parsed
  }
}

// ---------------------------------------------------------------------------
// Phase 1-5A execution
// ---------------------------------------------------------------------------

async function runSetupPhases(args: string): Promise<SetupResult> {
  let parsed = parseArgs(args)
  const workspace = parsed.workspace

  // Step 0: Env discovery — fill in missing URL args from the active/override env
  parsed = await applyEnvDiscovery(parsed, workspace)

  // Production safety — refuse before any phase runs
  if (parsed.isProduction) {
    throw new Error(
      `systest cannot run against a production env (destructive_ops=deny). ` +
        `Env "${parsed.envName ?? 'unknown'}" is tagged production. Use staging.`,
    )
  }

  // Audit log entry at run start
  if (parsed.envName) {
    console.log(
      `[systest] audit: /systest started for env=${parsed.envName}` +
        ` backend=${parsed.backendUrl ?? '(none)'}` +
        ` frontend=${parsed.frontendUrl ?? '(none)'}`,
    )
  }

  const outputDir = join(workspace, '.systest')

  // Create output directories
  for (const dir of ['', 'test-logs', 'config', 'test-cases', 'docs']) {
    mkdirSync(join(outputDir, dir), { recursive: true })
  }

  const phaseResults: SetupResult['phaseResults'] = []
  let graphStats: { nodes: number; edges: number } | null = null

  // ── Build knowledge graph ──
  console.log('[systest] Building knowledge graph...')
  try {
    const { buildGraph } = await import('../../services/graphify/builder/index.ts')
    const { ensureGraphifyInGitignore } = await import('../../services/graphify/gitignoreHelper.ts')
    ensureGraphifyInGitignore(workspace)
    const result = await buildGraph({ rootDir: workspace })
    if (result.success) {
      graphStats = { nodes: result.nodes, edges: result.edges }
      console.log('[systest] Graph built:', result.nodes, 'nodes,', result.edges, 'edges')
    }
  } catch (e) {
    console.warn('[systest] Graph build failed:', e)
  }

  // ── Load graph engine ──
  let graphEngine: any = undefined
  try {
    const { getGraphEnhancer } = await import('../../services/systest/graphEnhancer.ts')
    const enhancer = getGraphEnhancer(workspace)
    if (!enhancer.isAvailable()) {
      await enhancer.reinitialize()
    }
    graphEngine = enhancer.getEngine() || undefined
  } catch {}

  // ── Detect mode ──
  let mode: any = 'A'
  try {
    const { detectMode } = await import('../../services/systest/modeDetector.ts')
    const detection = detectMode(workspace, parsed.designDocsDir)
    mode = detection.mode
  } catch {}

  // ── Build SystestContext ──
  const { createWorkflowState } = await import('../../services/systest/workflowState.ts')
  const workflowState = createWorkflowState(mode, workspace, outputDir, {
    designDocsDir: parsed.designDocsDir,
    frontendUrl: parsed.frontendUrl,
    backendUrl: parsed.backendUrl,
    databaseUrl: parsed.databaseUrl,
  })

  const { getDefaultConfig } = await import('../../commands/systest/phases/orchestrator.ts')
  const config = getDefaultConfig()

  const ctx: any = {
    mode,
    workspace,
    designDocsDir: parsed.designDocsDir,
    backendUrl: parsed.backendUrl,
    frontendUrl: parsed.frontendUrl,
    databaseUrl: parsed.databaseUrl,
    outputDir,
    graphEngine,
    workflowState,
    config,
    nonInteractive: false,
    // Env-aware fields
    envName: parsed.envName,
    envVars: parsed.envVars,
    isProduction: parsed.isProduction ?? false,
  }

  // ── Execute phases sequentially ──
  const phases = [
    { name: 'Phase 1', fn: async () => { const { executePhase1 } = await import('../../commands/systest/phases/phase1_prompt_driven.ts'); return executePhase1(ctx) } },
    { name: 'Phase 2', fn: async () => { const { executePhase2 } = await import('../../commands/systest/phases/phase2_prompt_driven.ts'); return executePhase2(ctx) } },
    { name: 'Phase 3', fn: async () => { const { executePhase3 } = await import('../../commands/systest/phases/phase3.ts'); return executePhase3(ctx) } },
    { name: 'Phase 4', fn: async () => { const { executePhase4 } = await import('../../commands/systest/phases/phase4_prompt_driven.ts'); return executePhase4(ctx) } },
    { name: 'Phase 5A', fn: async () => { const { executePhase5A } = await import('../../commands/systest/phases/phase5a.ts'); return executePhase5A(ctx) } },
  ]

  for (const phase of phases) {
    const start = Date.now()
    let phaseStatus: string = 'failed'
    try {
      console.log('[systest] ' + phase.name + '...')
      const result = await phase.fn()
      phaseStatus = result.status
      const elapsed = Date.now() - start
      phaseResults.push({ phase: phase.name, status: result.status, duration: elapsed })
      console.log('[systest] ' + phase.name + ': ' + result.status + ' (' + Math.round(elapsed / 1000) + 's)')
      if ((result as any)?.error) {
        console.warn('[systest]   reason: ' + (result as any).error)
      }
    } catch (e) {
      phaseResults.push({ phase: phase.name, status: 'failed', duration: Date.now() - start })
      console.warn('[systest] ' + phase.name + ' failed:', e)
    }
    // Hard-stop subsequent setup phases on failure. Downstream phases assume prior
    // phase outputs on disk; running them on a failed state produces corrupt data.
    // buildTestPrompt() will still detect the failure via phase5a_quality_report.json
    // or absent seed file and emit an abort prompt.
    if (phaseStatus === 'failed') {
      console.warn('[systest] Phase ' + phase.name + ' failed — stopping setup chain. Remaining phases skipped.')
      break
    }
  }

  // ── Read generated data ──
  let seed: any = {}
  let testCases: any = {}
  try { seed = JSON.parse(readFileSync(join(outputDir, 'test-logs', 'test_data_seed.json'), 'utf-8')) } catch {}
  try { testCases = JSON.parse(readFileSync(join(outputDir, 'test-cases', 'generated-test-cases.json'), 'utf-8')) } catch {}

  // Admin user creation/promotion is now handled by AI in Phase 5A itself,
  // using the _prpReferences / _authDiscovery / _dbSchema raw data that
  // Phase 5A collects. See phase5a.ts for details.

  console.log('[systest] Setup complete:')
  console.log('[systest]   Layer 1:', seed.layer1Tests?.length || 0, 'tests')
  console.log('[systest]   Layer 2:', seed.layer2Tests?.length || 0, 'tests')
  console.log('[systest]   Auth user:', seed.auth?.token ? 'token ready' : 'no token')
  console.log('[systest]   Auth admin:', seed.auth_admin?.token ? 'token ready' : 'no token')

  return { workspace, outputDir, seed, testCases, graphStats, phaseResults, parsed }
}

// ---------------------------------------------------------------------------
// Prompt builder for Phase 5B/5C/6
// ---------------------------------------------------------------------------

function buildTestPrompt(result: SetupResult): string {
  const { workspace, outputDir, seed, testCases, graphStats, phaseResults, parsed } = result

  const ws = workspace.replace(/\\/g, '/')
  const out = outputDir.replace(/\\/g, '/')
  const backendUrl = parsed.backendUrl || ''
  const frontendUrl = parsed.frontendUrl || ''

  const phaseSummary = phaseResults
    .map(p => '  ' + p.phase + ': ' + p.status + ' (' + Math.round(p.duration / 1000) + 's)')
    .join('\n')

  const graphPath = join(workspace, 'graphify-out', 'graph.json').replace(/\\/g, '/')
  const seedPath = join(outputDir, 'test-logs', 'test_data_seed.json').replace(/\\/g, '/')
  const testCasesPath = join(outputDir, 'test-cases', 'generated-test-cases.json').replace(/\\/g, '/')
  const phase5bResultsPath = join(outputDir, 'test-logs', 'phase5b_results.json').replace(/\\/g, '/')
  const phase5cResultsPath = join(outputDir, 'test-logs', 'phase5c_results.json').replace(/\\/g, '/')
  const reportPath = join(outputDir, 'docs', 'TEST_REPORT.md').replace(/\\/g, '/')
  const qualityReportPath = join(outputDir, 'test-logs', 'phase5a_quality_report.json').replace(/\\/g, '/')

  const l1Count = seed.layer1Tests?.length || 0
  const l2Count = seed.layer2Tests?.length || 0
  const totalTests = l1Count + l2Count

  // Load Phase 5A quality report (produced by validateSeedQuality in phase5a.ts)
  let qualityReport: { fatal: string[]; warnings: string[]; stats?: Record<string, any> } = {
    fatal: [],
    warnings: [],
  }
  try {
    if (existsSync(qualityReportPath)) {
      qualityReport = JSON.parse(readFileSync(qualityReportPath, 'utf-8'))
    }
  } catch {}

  // HARD GATE: if Phase 5A flagged fatal quality issues, return an error prompt
  // and DO NOT continue to Phase 5B. The AI must fix upstream and retry.
  if (Array.isArray(qualityReport.fatal) && qualityReport.fatal.length > 0) {
    const fatalList = qualityReport.fatal.map((e, i) => `${i + 1}. ${e}`).join('\n')
    const warnList = (qualityReport.warnings || []).length > 0
      ? '\n\n### Non-fatal warnings (for reference):\n' + qualityReport.warnings.map(w => '- ' + w).join('\n')
      : ''
    return [
      '# Systest ABORTED — Phase 5A quality gate failed',
      '',
      `Phase 5A produced a seed that cannot be used for Phase 5B. ${qualityReport.fatal.length} fatal error(s):`,
      '',
      fatalList,
      '',
      `Full report: ${qualityReportPath}`,
      `Seed (possibly not written): ${seedPath}`,
      '',
      '### Required action',
      '',
      '**Fix Phase 5A output or regenerate the knowledge graph and retry. DO NOT proceed to Phase 5B with this seed.**',
      '',
      'Typical remedies:',
      '- Regenerate the knowledge graph: `/graphify`',
      '- Verify Phase 4 produced valid `test-cases/generated-test-cases.json` (no `UNKNOWN` methods)',
      '- Ensure the backend exposes an OpenAPI spec so `enrichFromOpenApi` can enrich L1 tests',
      '- Re-run: `/systest run --workspace <path> --backend-url <url> ...`',
      warnList,
    ].join('\n')
  }

  const qualitySection = (qualityReport.warnings || []).length > 0
    ? `\n## Test data quality notes (informational)\n\n${qualityReport.warnings.map(w => '- ' + w).join('\n')}\n\nThese are non-fatal. Proceed with testing, but be aware that tests affected by these conditions may fail.\n`
    : ''

  const prompt = `# System Test Execution — Phase 5B / 5C / 6

Phase 1-5A completed. You MUST now execute Phase 5B, 5C, and 6.

## Setup Summary
${phaseSummary}
Knowledge graph: ${graphStats ? graphPath + ' (' + graphStats.nodes + ' nodes)' : 'not available'}
Test cases: ${totalTests} (Layer1=${l1Count}, Layer2=${l2Count})
${qualitySection}
## Critical Files (YOU MUST READ THESE)
- Test data seed: ${seedPath}
- Generated test cases: ${testCasesPath}
- Workspace: ${ws}

## Auth Credentials
${formatAuth(seed)}

---

### Phase 5A — Create Test Users (YOU do this before Phase 5B)

Read the seed file at ${seedPath} and look at these fields:
- seed._sourcePriority: "prp" | "openapi"
- seed._prpReferences (if available, contains PRP files — PRIMARY authority)
- seed._authDiscovery (OpenAPI register/login endpoint + schema)
- seed._dbSchema (database hints)
- seed._graphEntities (user-like entities from knowledge graph)

#### STEP A — Determine authoritative source

If seed._sourcePriority === "prp" AND seed._prpReferences.available:
  Use PRP files as PRIMARY source of truth. Skip STEP B, go to STEP C.
Else:
  Use OpenAPI + DB schema + graph entities. Skip STEP C, go to STEP D.

#### STEP B — (Not used in prp mode, skip)

#### STEP C — PRP-driven test user generation (used when PRPs available)

1. Read each file in seed._prpReferences.prpFiles (the .content field is already loaded)
2. Identify the Authentication-related PRP (usually PRP-001-*, look for "auth", "login", "user management")
3. Extract roles from the PRP's Business Rules / Data Models:
   - E.g., airline: [ceo, airport, sales, it, hr, schedule]
   - E.g., hospital: [doctor, nurse, admin, patient]
   - E.g., simple SaaS: [user, admin]
4. Extract User entity fields from the PRP's Data Models section:
   - Required fields (empid, firstname, deptid, etc.)
   - Validation rules (length, format)
5. Read seed._prpReferences.frontendDesign for role→page mappings

Generate ONE test user per role:
- seed.auth_{role}: { role, all required fields, token: null }
- For "admin" role (or highest-privilege role), also populate seed.auth_admin

Infer the business domain from project name and PRP context:
- "airline" → emails like \`qa.ceo.\${hash8}@airline.test\` where \`hash8 = seed._seedHash.substring(0, 8)\`
- "bank" → \`qa.teller.\${hash8}@bank.test\`
- "hospital" → \`qa.doctor.\${hash8}@hospital.test\`

**Reproducibility**: Include \`\${hash8}\` in the local-part of email addresses so running the same project multiple times produces the SAME emails. This lets CI compare runs. Read \`seed._seedHash\` and \`seed._runId\` from the seed before generating credentials.

#### STEP D — OpenAPI-driven fallback (used when no PRPs)

1. Read seed._authDiscovery.registerSchema.required
2. Generate ONE regular user (seed.auth) with ALL required fields filled realistically
3. Generate ONE admin user (seed.auth_admin) similarly

Use the project name to infer domain for email addresses.

**Reproducibility**: Include \`\${hash8}\` (where \`hash8 = seed._seedHash.substring(0, 8)\`) in the local-part of every generated email (e.g. \`qa.user.\${hash8}@project.test\`) so running the same project multiple times produces the SAME emails. Read \`seed._seedHash\` and \`seed._runId\` from the seed before generating credentials — same project → same credentials across runs.

#### STEP E — Create users via API/DB

> ⚠️ **MANDATORY TIMEOUT RULE for Phase 5A STEP E**
>
> ANY bash command that connects to an external service (mysql/psql/curl/etc.) MUST have
> an explicit timeout of ≤ 15 seconds. A single hanging command can crash metacoder
> (the shell gives up only after ~7.5 minutes, which has triggered unrecoverable
> ensureToolResultPairing loops in past incidents).
>
> Example:
> - ❌ BAD:  \`mysql -h ... -e "..."\`
> - ✅ GOOD (bash/WSL/Linux/macOS): \`timeout 15 mysql --connect-timeout=10 -h ... -e "..."\`
> - ✅ GOOD (Windows Git Bash, **no GNU \`timeout\` available**): rely on the tool's
>   own connect-timeout flag, e.g. \`mysql --connect-timeout=10 -h ... -e "..."\` and
>   \`psql\` with \`PGCONNECT_TIMEOUT=10\` env var. Do NOT use \`timeout 15\` on Windows
>   Git Bash — it errors with "command not found" silently and the mysql call still
>   hangs indefinitely.
>
> If a tool call exceeds 30 seconds wall-clock from this section, ABORT it (send Ctrl-C
> or kill the bash PID) and treat as 'DB unreachable'. Do NOT silently retry.

For each seed.auth_* object you populated:

1. Try POST to seed._authDiscovery.registerEndpoint:
   - Body: the user object (minus "token" and "role" fields)
   - Expected: 200 or 201
2. If 422: read error message, fix the offending field, retry
3. If 404 / 500: try direct SQL INSERT using seed._dbSchema:
   - **TIMEOUT MANDATORY**: ALL mysql/psql invocations MUST include an explicit
     connect-timeout flag. Prefer \`--connect-timeout=10\` (MySQL) / \`PGCONNECT_TIMEOUT=10\`
     env (PostgreSQL) — these work cross-platform. Add \`timeout 15\` prefix ONLY on
     Linux/macOS/WSL where GNU coreutils \`timeout\` is available. Example:
       - Cross-platform: \`mysql --connect-timeout=10 -h HOST -P PORT -u USER -pPASS DB -e "..."\`
       - Linux/macOS:   \`timeout 15 mysql --connect-timeout=10 -h HOST -P PORT -u USER -pPASS DB -e "..."\`
       - PostgreSQL:    \`PGCONNECT_TIMEOUT=10 PGPASSWORD=PASS psql -h HOST -p PORT -U USER -d DB -c '...'\`
   - If the timeout hits (exit code 124), the DB is unreachable. Do NOT retry.
     Write a note to \${out}/auth_creation_failure.md, set seed.auth_*.token = null,
     continue Phase 5B with null tokens (auth-required tests will fail but execution proceeds).
   - Build INSERT with the table name from seed._dbSchema.userTableHints[0] (HIGHEST confidence
     match) NOT a hardcoded 'users'. Phase 5A's introspection returned the real table list — trust it.
   - **SQL escaping**: NEVER let user-supplied values contain raw single quotes.
     Either (a) generate emails/names WITHOUT single quotes (recommended — use
     only alphanumeric + dot + @ + hyphen), OR (b) escape every \`'\` to \`''\` before
     embedding in SQL. For parameters coming from OpenAPI schema response (rare),
     always (b).
   - **DB URL**: Use the real connection URL from the CLI args (\`--database\`) or
     environment (DATABASE_URL). seed._dbSchema.connectionUrl is MASKED for
     security — do NOT use the masked URL for actual connection.
4. For admin/privileged roles:
   - If separate admin endpoint in OpenAPI: use it
   - Otherwise: run SQL UPDATE to set role after register:
     \`UPDATE {table} SET role='admin' WHERE email='...'\` (remember SQL escape rules above)

⚠️ **CRITICAL ORDER for admin/privileged roles:**
   1. POST register (creates user with default role='user')
   2. SQL UPDATE to set role='admin'
   3. **THEN** POST login (to get a FRESH token with the new role embedded in JWT claims)
   - Do NOT reuse a token obtained before the role UPDATE — it has the old role.
   - If you logged in first and then UPDATEd, you MUST re-login to refresh the token.

#### STEP F — Login and save token

For each seed.auth_* user (AFTER any role UPDATEs in STEP E):
1. POST to seed._authDiscovery.loginEndpoint with { email, password }
2. Extract token from response (may be nested: response.token, response.data.token, response.tokens.accessToken)
3. Write back: seed.auth_{role}.token = "<token>"
4. Verify: GET /api/auth/me or equivalent with the token
   - For admin users, verify the response shows role='admin' — if not, the UPDATE+relogin ordering is wrong

#### STEP G — Write final seed back

Update the seed file at ${seedPath} with:
1. All generated user credentials and tokens (seed.auth, seed.auth_admin, seed.auth_{role}, ...)
2. **Delete** seed._authPlaceholder — it was only a hint for you, not needed downstream

Use the Write tool to overwrite the seed file with the updated content.

Log: "Created N test users: auth_user, auth_admin, auth_hr, ..."

#### Fallback

If ALL methods fail for a given role:
- Set seed.auth_{role}.token = null
- Write ${out}/auth_creation_failure.md with details
- Continue Phase 5B (anonymous tests only); auth-required tests will fail

---

## Phase 5B: API Testing${backendUrl ? '' : ' (SKIP — no backend URL)'}
${backendUrl ? `
Backend: ${backendUrl}
Target pass rate: **95%**
Max rounds: **10**

### STEP 1: Read test cases

Read the VALIDATED test data files:
- ${seedPath} — contains layer1Tests (happy path) AND layer2Tests (negative/auth/validation)
- ${testCasesPath} — supplementary test cases with detailed schemas

Execute ALL layer1Tests AND ALL layer2Tests. Not just layer1.
Total expected: Layer 1 (${l1Count}) + Layer 2 (${l2Count}) = ${totalTests} tests minimum.

⚠️ You MUST execute BOTH layers. Skipping layer2Tests is a VIOLATION.

### STEP 2: Authenticate

Read auth credentials from the seed file:
- seed.auth.email / seed.auth.password — regular user
- seed.auth_admin.email / seed.auth_admin.password — admin user
- seed.auth.token / seed.auth_admin.token — pre-obtained JWT tokens

If tokens are available, use them directly. If not, call the login endpoint to obtain tokens.
Use admin token for endpoints containing "/admin/".

### STEP 2.5: Verify admin access (CRITICAL)

Before running tests, verify that the admin token actually has admin privileges:

1. Call any /admin/ endpoint (e.g., GET /admin/api/model-keys) with the admin token
2. If response is 200 → admin access confirmed, proceed
3. If response is 403 → the admin user does NOT have admin role. Fix it:
${parsed.databaseUrl ? `
   **Database available:** ${parsed.databaseUrl}
   Run SQL to promote the admin user:
   \`\`\`bash
   # Parse the connection string and run the UPDATE
   # For MySQL:
   mysql -h <host> -P <port> -u <user> -p'<pass>' <db> -e "UPDATE users SET role='admin' WHERE email='<admin_email>'"
   # For PostgreSQL:
   PGPASSWORD='<pass>' psql -h <host> -p <port> -U <user> -d <db> -c "UPDATE users SET role='admin' WHERE email='<admin_email>'"
   \`\`\`
   After promotion, re-login the admin user to get a new JWT with admin role.
` : `   **No database URL provided.** Try these alternatives:
   a. Look for a seed/migration script in the workspace that creates admin users
   b. Check if there's an API endpoint to change roles (unlikely but possible)
   c. If nothing works, skip admin-only tests and note them as "blocked by permissions"
`}
4. After fix, re-verify the admin endpoint returns 200
5. Update the admin token in your working memory for all subsequent tests

### Phase 5B STEP 2.6: Resolve $ references before each test

For each test case in layer1Tests / layer2Tests, before execution, resolve:

1. **Token selection** — look at test case \`_authRole\`:
   - "none": no Authorization header
   - "user": Authorization: Bearer <seed.auth.token>
   - "admin": Authorization: Bearer <seed.auth_admin.token>
   - "{role}" (e.g. "hr", "sales"): Authorization: Bearer <seed.auth_{role}.token> (if exists)
   - If \`_authRole\` is missing, infer from method + endpoint:
     * \`/admin/\` boundary or method=DELETE on top-level resource → admin
     * Others → user
   - Defensive: if the selected \`seed.auth_*.token\` is null/undefined, STEP A-G of Phase 5A did not complete for that role. Go back and run STEP A-G first.

2. **Path parameter resolution** — look at \`_pathParams\` (map of {param: $-ref}):
   - If present: replace each \`{param}\` in endpoint using the $-ref value
   - If absent: use seed.entities[_entityContext].records[0][primaryKey] as fallback
   - Example: \`/api/employees/{empid}\` with \`_pathParams={empid: "$entities.Employee.records[0].empid"}\`
     → look up seed.entities.Employee.records[0].empid → "QA000001"

3. **Request body resolution**:
   - If \`_requestBodyResolved\` exists (an object): use it as the body template
     - Walk the object and replace any string matching \`$entities.X.records[i].field\` with the actual value from seed
   - Else if \`_requestBody.$ref\`: look up schema in OpenAPI, fill from seed.entities[_entityContext].records[0]
   - Else: send the test case's Body as-is (may be absent for GET/DELETE)

4. **Dollar-reference resolution syntax** (applies everywhere):
   - \`$auth.token\` → seed.auth.token
   - \`$auth_admin.token\` → seed.auth_admin.token
   - \`$auth_{role}.{field}\` → seed["auth_" + role][field]
   - \`$entities.{EntityName}.records[{i}].{field}\` → seed.entities.EntityName.records[i].field
   - \`$flow.{var}.{path}\` → value saved by earlier integrationFlow step with saveAs
   - Before sending the HTTP request, scan path + headers + body for \`$\` substrings and replace

5. **Report failures with actionable context**:
   - 401: "Auth token missing/invalid — _authRole=<role>, seed.auth_<role>.token=<preview>"
   - 403: "Auth role mismatch. Was using token for role=<role>. Retrying with admin token..."
   - 404 on path param: "Referenced record not found. Resolved {param}=<value> but endpoint returned 404. Check seed.entities.{_entityContext}.records[] is non-empty."
   - 500 with FK error: "FK constraint violation — seed.entities.{X}.records[0].{field} references an entity that doesn't exist in DB. Ensure parent entity was created first."

### STEP 3: Execute ALL test cases (Round 1)

For each test case in the seed:
1. Send the HTTP request (resolve $ references from STEP 2.6 first)
2. **Layer 1 — Status assertion**: compare actualStatus with expectedStatus
3. **Layer 2 — Schema assertion** (if \`_expectedResponseSchema\` present):
   - Parse response JSON body
   - Validate against schema (required fields present, types match)
   - If body is empty but schema requires fields → FAIL with "schema violation: missing required field X"
   - If body contains an "error"/"message" field AND status is 2xx → FAIL (inconsistent: success status but error payload)
4. **Layer 3 — Business assertion** (if test has \`_businessAssertion\` field, rare):
   - Evaluate the assertion expression against response body
5. **Write evidence file** at \`${out}/evidence/phase5b/test-{id}.json\`:
   - FIRST ensure the directory exists: \`mkdir -p ${out}/evidence/phase5b\` (run once before the loop)
   - Then write the evidence JSON with this shape:
   \`\`\`json
   {
     "testId": "API-001",
     "timestamp": "<ISO>",
     "request": { "method": "...", "url": "...", "headers": {...}, "body": {...} },
     "response": { "status": <num>, "headers": {...}, "body": {...} },
     "expected": { "status": <num>, "schema": {...or null} },
     "assertions": { "statusPass": bool, "schemaPass": bool, "businessPass": bool,
                     "schemaErrors": [...] },
     "pass": bool
   }
   \`\`\`
   ⚠️ Evidence MUST be written BEFORE the results JSON claims pass/fail. A claim
   without a corresponding evidence file is treated as FAIL in Phase 6.5 audit.
6. Record: { id, endpoint, method, expectedStatus, actualStatus,
            statusPass: bool, schemaPass: bool, businessPass: bool,
            pass: (all three true),
            schemaErrors: [...] if any,
            evidence_path: "${out}/evidence/phase5b/test-{id}.json" }

A test PASSES only when statusPass AND schemaPass AND businessPass are all true
(missing assertions count as PASS — only explicit violations fail).

### STEP 4: Calculate pass rate and write results

After testing ALL cases, calculate:
  pass_rate = (passed / total) * 100

Write results to ${phase5bResultsPath}:
\`\`\`json
{
  "round": 1,
  "total": N,
  "passed": N,
  "failed": N,
  "passRate": N,
  "bugsFixed": 0,
  "results": [
    { "id": "...", "actualStatus": 200, "statusPass": true, "schemaPass": true, "businessPass": true,
      "pass": true, "schemaErrors": [],
      "evidence_path": "${out}/evidence/phase5b/test-API-001.json" }
  ],
  "runId": "<ISO timestamp or uuid>",
  "seedHash": "<sha256 of seed file, or seed.version if present>"
}
\`\`\`

### STEP 5: Bug fix loop — MANDATORY (differential testing)

⚠️ THIS STEP IS MANDATORY. You MUST execute this loop automatically.
⚠️ DO NOT stop and ask the user "should I continue?" — just DO IT.
⚠️ DO NOT skip this step even if it seems difficult.

**Strategy**: by default, re-run ONLY the tests affected by your fixes (previously-failed
tests + tests whose endpoint source files you just modified). Every 3 rounds, run the FULL
suite for regression detection. The final round (10) ALWAYS runs full suite to produce
authoritative CI evidence. This cuts total HTTP requests from ~10N to ~5.5N while keeping
regression safety.

You are now in a DO-WHILE loop. Execute it until pass_rate_from_last_full >= 95% or round >= 10:

\`\`\`
round = 1
mode = "full"                      // Round 1 (initial run in STEP 3) is full
failed_ids = [ ids that failed in STEP 3 / previous round ]
previously_passing = { ids that passed at least once so far }
regressions = []                   // ids that regressed during the loop
pass_rate_from_last_full = <pass rate from STEP 3 initial full run>

DO:
  round = round + 1

  // 5.1. Classify failures by status code:
  //   500 → server bug (read error, trace source, fix code)
  //   404 → resource missing (create resource first, or fix route)
  //   403 → permission denied (check token, promote user role)
  //   400 → bad body (validate against OpenAPI schema)
  //   401 → unauthorized (refresh token, re-authenticate)
  // Pick top 5-10 most impactful failures. For each fix:
  //   a. Use graph_query / graph_path to locate source file in ${ws}
  //   b. Read the source file
  //   c. Edit to fix the bug
  //   d. Record each modified file path into edited_files (used in 5.2)

  // 5.2. Select test set for THIS round:
  IF round % 3 == 0 OR round == 10:
    mode = "full"                   // Regression sweep every 3 rounds + final round
    test_set = ALL tests (layer1 + layer2)
  ELSE:
    mode = "diff"
    // Affected = previously-failed tests ∪ tests whose endpoint source was just edited.
    // Use graph_neighbors / graph_query on edited_files to find tests pointing at those endpoints.
    affected_by_edits = tests whose endpoint source ∈ edited_files
    test_set = failed_ids ∪ affected_by_edits
    // SAFETY FALLBACK: if the knowledge graph is unavailable or you cannot reliably
    // map edited files → tests, DO NOT guess. Switch this round to "full" for correctness.
    IF (graph_unavailable) OR (mapping_unreliable):
      mode = "full"; test_set = ALL tests
    IF test_set is empty:
      mode = "full"; test_set = ALL tests

  // 5.3. Execute test_set (same HTTP / assertion logic as STEP 3), record per-test results.

  // 5.4. Detect regressions (only meaningful when mode == "full"):
  IF mode == "full":
    regressions_this_round = previously_passing ∩ current_failures
    regressions = regressions ∪ regressions_this_round
    IF regressions_this_round is non-empty:
      Log "⚠️ Regression detected: {N} previously-passing tests now fail: {ids}"
      // Treat regressions as P0 (prepend to the 5.1 fix priority queue next round).

  // 5.5. Update loop state:
  previously_passing = previously_passing ∪ current_passes
  failed_ids = current_failures       // used as diff seed next round

  // 5.6. Compute pass_rate:
  //   The loop-exit gate uses pass_rate_from_last_full (authoritative, full-suite).
  //   Diff runs are PARTIAL evidence — they update per-test statuses but do NOT
  //   overwrite pass_rate_from_last_full. Example: round 2 diff shows 5/10 pass,
  //   but the gate still uses round 1's 60/100 = 60% until round 3 runs full again.
  IF mode == "full":
    pass_rate_from_last_full = passed / total * 100

  // 5.7. Write ${phase5bResultsPath} (overwrite) with:
  //   {
  //     round, mode: "full" | "diff",
  //     total: <size of test_set this round>,
  //     passed, failed,
  //     passRate: pass_rate_from_last_full,       // gate value, always last full
  //     passRateThisRound: passed/test_set*100,   // informational for diff rounds
  //     regressions: [ ...ids ],
  //     results: [ ...per-test entries ]
  //   }

  Log "Round {round} [{mode}]: {passed}/{test_set_size} this round, " +
      "overall pass_rate (from last full) = {pass_rate_from_last_full}%"

WHILE (pass_rate_from_last_full < 95 AND round < 10)
\`\`\`

**Request-count math**:
- Round 1 full: N
- Rounds 2, 4, 5, 7, 8: diff (~10-20 tests each)
- Rounds 3, 6, 9: full regression
- Round 10: final full (authoritative CI evidence)
- Total ≈ 5N + 5·small_diff ≈ 5.5N  (vs. old naïve 10N)

After loop exits:
- If pass_rate_from_last_full >= 95%: Log "Phase 5B PASSED: {pass_rate}% in {round} rounds, {|regressions|} regressions recovered"
- If round >= 10: Log "Phase 5B: max rounds reached, final pass_rate={pass_rate}%"
- Proceed to Phase 5C regardless.
` : ''}
---

## Phase 5C: Frontend E2E Testing${frontendUrl ? '' : ' (SKIPPED — no --frontend-url)'}
${!frontendUrl ? `
**Status**: SKIPPED. **Sole reason**: no \`--frontend-url\` argument was passed to /systest.

🚨 **WHEN WRITING \`${out}/phase5c_summary.md\`, USE THIS EXACT CONTENT. DO NOT invent alternative reasons.**

The orchestrator's only skip trigger for Phase 5C is \`!!ctx.frontendUrl\` evaluating to false. It does NOT check for Playwright, Cypress, Selenium, Chrome MCP availability, package.json scripts, or anything else. Any summary that cites those is a hallucination and will mislead the user.

Write \`${out}/phase5c_summary.md\` with exactly:

\`\`\`markdown
# Phase 5C: Frontend E2E Testing — SKIPPED

## Skip Reason (authoritative)
\`--frontend-url\` was not provided to /systest. Phase 5C navigates real pages via Chrome MCP (or falls back to direct HTTP), and both paths require a live frontend URL. This is the SOLE reason for skipping.

## To Enable Phase 5C
Re-run /systest with the frontend URL:

    /systest run --workspace <path> --backend-url http://localhost:<backend-port> --frontend-url http://localhost:<frontend-port>

The frontend dev server must be reachable at that URL before /systest runs.

## What Was NOT The Cause (common misdiagnoses)
- **Chrome MCP / "Claude in Chrome"**: not checked by the skip gate. If present, Phase 5C uses it; if absent, it falls back to direct HTTP.
- **Playwright / Cypress / Selenium**: systest does NOT depend on any of these. It runs its own automation via Chrome MCP or HTTP.
- **E2E test framework configured in package.json**: irrelevant to this phase.
- **seed integrationFlows / userJourneys**: also irrelevant — Phase 5C discovers routes dynamically at runtime.
\`\`\`

After writing the summary, continue to Phase 6. Do NOT attempt to run Phase 5C tests without a frontend URL.
` : ''}
${frontendUrl ? `
Frontend: ${frontendUrl}
Target pass rate: **95%**

### STEP 1: Login

1. Use mcp__Claude_in_Chrome__navigate to open ${frontendUrl}
2. Find email/password inputs (mcp__Claude_in_Chrome__find)
3. Read admin credentials from seed file (auth_admin.email + auth_admin.password)
4. Fill credentials and click login button
5. Wait 2-3 seconds and verify URL changed from /login
6. If login fails (still on /login page):
   a. Try regular user credentials (auth.email + auth.password)
   b. Check if the frontend requires a different auth mechanism
   c. Check browser console for error messages
   d. If the frontend is an admin console, ensure the user has admin role (see Phase 5B STEP 2.5)

### STEP 2: Discover routes

After login:
1. Read page with mcp__Claude_in_Chrome__read_page — extract nav links
2. Also test common routes: /dashboard, /home, /settings, /users, /admin, /avatars
3. Also derive routes from seed entities (e.g., entity "Avatar" → try /avatars)

### STEP 3: Test each page — FUNCTIONAL TESTING (not just error checking)

For EACH route, perform ALL of these tests:

#### A. Structural check (quick)
1. Navigate to the page (mcp__Claude_in_Chrome__navigate)
2. Screenshot (mcp__Claude_in_Chrome__computer action=screenshot)
3. Check console errors (mcp__Claude_in_Chrome__read_console_messages onlyErrors=true)
4. Check network errors (mcp__Claude_in_Chrome__read_network_requests) — capture ALL 4xx/5xx, not just 5xx
5. If 5xx network errors → BUG (server side), fix immediately
6. If 422 on a form submission → CONTRACT MISMATCH BUG: parse response body
   (FastAPI format: \`detail[].loc[]\` like \`["body", "address"]\`), extract missing
   field names, record to \`contractMismatch.missingFields\`, mark this route FAIL
7. If 4xx (non-422, non-401/403) on form submission → BUG, investigate
   (401/403 on a page that requires auth is expected IF user is not logged in — skip)

#### B. Content verification (required)
1. Read page content (mcp__Claude_in_Chrome__read_page or get_page_text)
2. Verify the page shows meaningful content (not empty, not "Loading..." stuck, not error page)
3. Verify navigation links exist and are clickable
4. If the page shows a data list → verify at least 1 row of data

#### C. Login flow testing (MANDATORY, test FIRST before other pages)
1. Navigate to login page (${frontendUrl}/login)
2. Find email/password inputs (mcp__Claude_in_Chrome__find)
3. Fill with test credentials from seed (auth.email + auth.password)
4. Click login button
5. Wait 2-3 seconds, verify URL changed from /login
6. If login fails → check console errors → fix backend/frontend auth → retry
7. After login, verify authenticated pages show correct user info

#### D. CRUD operation testing (MANDATORY for each entity page — NOT optional)

⚠️ Form submission testing is NOT optional. "Click button, see page" is NOT a test.
You MUST actually submit the form and verify the API response.

1. Navigate to entity list page (e.g., /employees)
2. Verify list displays data (at least 1 row from seed)
3. **CREATE test** (mandatory):
   a. Click "create/new" button → verify navigation to form page
   b. BEFORE filling: snapshot form fields (read_page filter=interactive → list all \`input[name]\`, \`select[name]\`, \`textarea[name]\`). Save to \`formFieldsSnapshot\`.
   c. Fill form with test data from \`seed.entities.{Entity}.records[0]\`
   d. Click submit; capture the network request via read_network_requests
   e. Check the POST response status:
      - 2xx → record \`crud.create = true\`
      - 422 → **CRITICAL: CONTRACT MISMATCH**. Parse \`response.body.detail[]\`,
        extract \`loc[-1]\` values (e.g. "address", "zipcode") into
        \`contractMismatch.missingFields\`. **SET \`contractMismatch.detected = true\`**
        and \`contractMismatch.status = 422\` and \`contractMismatch.endpoint = "<METHOD> <url-path>"\`.
        Record \`crud.create = false\`. This is a BUG in the frontend form — the form
        is missing required backend fields.
      - 4xx (non-422) → record \`crud.create = false\`, investigate (bad request data?)
      - 5xx → server bug, fix backend
   f. If 2xx: verify new record appears in list (navigate back, check row count grew)
4. **READ test**: Click an existing record → verify detail page loads and shows the record's actual data (not just renders)
5. **UPDATE test** (if edit exists): Change a field, save, check PUT response status (422 handling same as above), verify change persists after page reload
6. **DELETE test** (if delete exists): Delete a record, check DELETE response, verify removed from list

⚠️ A route claiming \`crud.create = true\` MUST have evidence: a captured 2xx POST
request in network.json. Phase 6.5 audit will verify this and FAIL the route if
the claim does not match evidence.

#### E. Pass/Fail criteria for EACH route

A route PASSES only when ALL true:
- No uncaught console errors (JavaScript exceptions)
- No 5xx network errors on page load
- No 422 responses on form submission (contract must match)
- No 4xx (other than expected 401/403 for unauth pages) on form submission
- Page renders meaningful content (not empty/error)
- Login flow works (if login page)
- Form submissions return 2xx (for entity create/edit pages)
- CRUD operations actually execute (not just rendered) — evidence in network.json

A route FAILS if ANY:
- White/blank page
- Uncaught JavaScript exception
- 5xx API error on page load
- **422 Unprocessable Entity on form submission** (frontend/backend contract mismatch)
- 4xx on form submission (other than expected 401/403)
- Form submission fails with error
- Login doesn't work
- Data list is empty when seed data exists
- \`crud.create = true\` claimed but no 2xx POST in network.json (hallucinated claim)

#### F. Evidence capture (MANDATORY for every route)

For each route, in addition to recording pass/fail, SAVE EVIDENCE. Before the loop,
create the evidence root: \`mkdir -p ${out}/evidence/phase5c\`.

Define \`{route-slug}\` with this exact, filesystem-safe derivation:
\`\`\`js
slug = path.toLowerCase()
           .replace(/^\\//,'')              // strip leading slash
           .replace(/\\?.*$/,'')             // strip query string
           .replace(/#.*$/,'')              // strip fragment
           .replace(/\\//g,'-')              // path separators → dashes
           .replace(/[{}]/g,'')             // strip path-param braces
           .replace(/[^a-z0-9._-]/g,'_')    // any other unsafe char → underscore
           || 'root'                        // empty path = homepage
\`\`\`
Examples: \`/employees/123\` → \`employees-123\`, \`/\` → \`root\`, \`/API/Users?sort=asc\` → \`api-users\`,
\`/employees/{id}/docs\` → \`employees-id-docs\`.

Then \`mkdir -p ${out}/evidence/phase5c/{route-slug}\` and write:
- Screenshot: \`${out}/evidence/phase5c/{route-slug}/screenshot.png\`
  (use \`mcp__Claude_in_Chrome__computer action=screenshot\` → save binary)
- Console log: \`${out}/evidence/phase5c/{route-slug}/console.json\` (array of console messages)
- Network log: \`${out}/evidence/phase5c/{route-slug}/network.json\` (array of failed requests)

  ⚠️ **REDACT secrets BEFORE writing network.json**: for every request in the log,
  replace sensitive header values:
    - \`request.headers.Authorization\` → \`"Bearer <REDACTED>"\`
    - \`request.headers.Cookie\` → \`"<REDACTED>"\`
    - \`request.headers['x-api-key']\` → \`"<REDACTED>"\`
  Also redact the same fields in \`response.headers\` if present (Set-Cookie etc.)
- Summary: \`${out}/evidence/phase5c/{route-slug}/summary.json\`:
  \`\`\`json
  {
    "route": "/path",
    "timestamp": "<ISO>",
    "pass": bool,
    "consoleErrors": <count>,
    "networkErrors": <count>,          // count of 4xx+5xx (excluding expected 401/403)
    "http4xxErrors": <count>,          // separate 4xx count for transparency
    "http5xxErrors": <count>,          // separate 5xx count
    "contentVerified": bool,
    "crud": { "create": bool, "read": bool, "update": bool, "delete": bool },
    "contractMismatch": {              // null if no form submission attempted; object otherwise
      "detected": bool,                // MUST be true iff status === 422 OR missingFields.length > 0
      "endpoint": "<e.g. POST /api/airports>",  // derived from network.json request URL + method
      "status": <422 | null>,
      "missingFields": ["<field1>", "<field2>"],
      "formFieldsSnapshot": ["<field1>", ...],   // what the form actually had
      "backendRequiredFields": ["<field1>", ...] // what the backend requires (from 422 detail)
    }
  }
  \`\`\`
  (omit "crud" for non-entity pages)

Each result entry in phase5c_results.json MUST include:
\`"evidence_dir": "${out}/evidence/phase5c/{route-slug}"\`

⚠️ Evidence MUST be saved BEFORE the results JSON claims pass/fail. Missing evidence
dir = FAIL in Phase 6.5 audit.

### Phase 5C STEP: Role-based routing tests (if PRP available)

If seed._prpReferences.frontendDesign contains a role matrix (visibility rules for each route):

For each route in FRONTEND_DESIGN.md Section 5 (Navigation):
1. Parse the "Visibility" rule (e.g., "admin, hr")
2. Create 2 test cases:
   a. **Authorized**: Log in as a role IN the visibility list → navigate → expect the route renders
   b. **Unauthorized**: Log in as a role NOT in the visibility list → navigate → expect 403, redirect to /dashboard, or hidden from sidebar

Use seed.auth_{role} tokens for each login. If the role doesn't exist in seed, skip that pair.

### STEP 4: Write results

Write to ${phase5cResultsPath}:
\`\`\`json
{
  "total": N,
  "passed": N,
  "failed": N,
  "passRate": N,
  "results": [ { "route": "/path", "pass": true, "consoleErrors": 0, "networkErrors": 0,
                 "http4xxErrors": 0, "http5xxErrors": 0,
                 "contractMismatch": null,
                 "evidence_dir": "${out}/evidence/phase5c/{route-slug}" } ],
  "runId": "<ISO timestamp or uuid>",
  "seedHash": "<sha256 of seed file, or seed.version if present>"
}
\`\`\`

### STEP 5: Bug fix loop — MANDATORY (same as Phase 5B)

⚠️ DO NOT SKIP. DO NOT ASK USER. Execute automatically.

If pass_rate < 95%:
1. Fix console errors and network errors found on each page
2. Use knowledge graph to locate source files in ${ws}
3. Fix bugs, refresh pages, recheck
4. Re-run all page tests
5. REPEAT until pass_rate >= 95% or 10 rounds
` : ''}
---

## Phase 6: Final Report

After Phase 5B and 5C, generate ${reportPath} with the following MANDATORY structure:

### ## Executive Summary
- Run metadata:
  - runId: \`{seed._runId}\` — unique per invocation, format YYYY-MM-DDTHH-MM-SS-mmmZ
  - seedHash: \`{seed._seedHash}\` — deterministic 16-char hex hash of project inputs; same inputs produce same hash
  - timestamp: current ISO datetime
- Overall pass rates (Phase 5B: N%, Phase 5C: N%)
- Rounds needed, bugs fixed
- Reproducibility note: runs with the same seedHash should produce comparable results. If two runs with the same seedHash differ significantly in pass rate, the cause is either (a) backend state drift or (b) a flaky test — investigate.

### ## Phase 5B Results
Per-endpoint table with columns:
\`| Test ID | Method | Endpoint | Expected | Actual | Pass | Evidence |\`

Each "Evidence" cell MUST be a relative markdown link to the corresponding
test-{id}.json, e.g.:
\`[evidence](../evidence/phase5b/test-API-001.json)\`

### ## Phase 5C Results
Per-route table with similar columns, with Evidence linking to the route's summary.json:
\`[evidence](../evidence/phase5c/{route-slug}/summary.json)\`

### ## Bug Fix Log
For each fix applied during the loop:
- What was the failure (test ID + actual result)
- What file was edited (workspace-relative path)
- Line number
- Brief description
- Evidence of success (post-fix test ID + evidence_path)

### ## Remaining Failures
Tests that couldn't be fixed. For each:
- Test ID + evidence_path
- Attempted fixes (from bug fix log)
- Recommendation

### ## Claim Integrity Requirement
EVERY numeric claim (pass rate, bug count, test count) MUST be derivable from
the evidence files on disk. A human auditor should be able to spot-check by reading
phase5b_results.json + evidence/phase5b/*.json (or the 5C equivalents) and arrive
at the same numbers. If you cannot back a claim with evidence, OMIT the claim.

### Phase 6 STEP: Clean up test users (MANDATORY)

After writing the test report:

1. List all test users you created in Phase 5A (seed.auth, seed.auth_admin, seed.auth_*)
2. For each test user with a \`systest_\` or \`qa.\` email prefix (indicates it was created by this tool):
   - Call DELETE /api/users/{id} with admin token, OR
   - Run SQL: DELETE FROM {users_table} WHERE email = '<test email>'
3. Log: "Cleaned up N test users"

Do NOT delete users that existed before this test run (check by email prefix — only systest/qa prefixed emails).

If cleanup fails for some users (e.g., foreign key constraints): log the failure but do not fail the whole test run. Write warnings to docs/TEST_REPORT.md.

---

## Phase 6.5: Self-Audit (MANDATORY)

After writing TEST_REPORT.md, you MUST perform an independent audit of your own report.
This catches hallucinated claims. DO NOT skip. DO NOT ask the user.

### STEP 1: Sample selection

From phase5b_results.json, select the first \`max(5, ceil(total_tests * 0.1))\` test IDs
from the sorted-by-id results list (deterministic — no RNG needed).
From phase5c_results.json, similarly select \`max(3, ceil(total_routes * 0.1))\` routes.

Record selected IDs in \`${out}/docs/AUDIT_SAMPLES.json\`:
\`\`\`json
{
  "phase5b_sampled": ["API-001", "API-002", ...],
  "phase5c_sampled": ["/dashboard", "/employees", ...],
  "timestamp": "<ISO>"
}
\`\`\`

### STEP 2: Evidence re-verification

For each sampled Phase 5B test:
1. Read \`${out}/evidence/phase5b/test-{id}.json\`
2. Independently check:
   - Does \`response.status\` in the evidence file match \`actualStatus\` in phase5b_results.json?
   - Does \`pass\` in evidence match \`pass\` in results file?
   - Is the evidence file internally consistent (e.g., pass=true but status mismatch = RED FLAG)?
3. Check TEST_REPORT.md: is this test listed correctly (pass/fail matches evidence)?

For each sampled Phase 5C route:
1. Read \`${out}/evidence/phase5c/{slug}/summary.json\`
2. Check \`consoleErrors\` / \`networkErrors\` counts match what TEST_REPORT.md claims
3. Verify the evidence dir exists and contains screenshot.png + console.json + network.json

### STEP 2.5: Contract Validation (for frontend form pages)

⚠️ This step catches the airlinesys5 class of bugs: a form page renders fine
and the structural check passes, but submitting the form returns 422 because
the frontend is missing required backend fields. Phase 5C should catch this,
but we double-check here in the audit.

**PRECONDITION CHECK (MANDATORY — do this BEFORE any curl or Chrome navigation):**

If \`${backendUrl}\` is empty OR not set:
- Log: \`"Phase 6.5 Contract: SKIP (no --backend-url provided)"\`
- Write to TEST_REPORT_AUDIT.md Contract Validation section: \`"SKIPPED: no backend URL"\`
- Skip the rest of STEP 2.5 entirely. Proceed to STEP 3 with \`C = 0\`.

If \`${frontendUrl}\` is empty OR not set:
- Log: \`"Phase 6.5 Contract: SKIP (no --frontend-url provided — no form pages to validate)"\`
- Write to TEST_REPORT_AUDIT.md: \`"SKIPPED: no frontend URL"\`
- Skip the rest of STEP 2.5. Proceed to STEP 3 with \`C = 0\`.

If phase5c_results.json does not exist (Phase 5C was skipped or failed to write):
- Log: \`"Phase 6.5 Contract: SKIP (no phase5c_results.json)"\`
- Skip the rest of STEP 2.5. Proceed to STEP 3 with \`C = 0\`.

Only if ALL THREE preconditions are met, proceed with contract validation below:

For each Phase 5C route that is a Create / Edit form page, identified by (in priority order):

**Primary signal (most reliable):**
- Evidence \`summary.json\` has \`formFieldsSnapshot.length > 0\` — the form was
  actually detected during Phase 5C Section D step 3b. This is the authoritative
  indicator of a form page regardless of URL shape.

**Secondary signals (URL pattern, used when Phase 5C did not capture snapshot):**
- Route ends with \`/new\` or \`/create\` (create form)
- Route ends with \`/edit\` (e.g. \`/employees/123/edit\`)
- Route matches \`/{resource}/[0-9]+\` AND evidence has at least one POST/PUT
  in network.json (detail page with embedded edit form)

If neither primary nor secondary signals match: this route is NOT a form page,
skip it for contract validation.

1. **Fetch the backend OpenAPI spec** — try paths in order, stop at first 200:

   Given \`BASE = ${backendUrl}\` with trailing slash trimmed:

   \`\`\`bash
   for suffix in "/openapi.json" "/docs/openapi.json" "/api/openapi.json" "/v1/openapi.json"; do
     status=$(curl -s -o /tmp/openapi_spec.json -w '%{http_code}' "\${BASE}\${suffix}")
     if [ "$status" = "200" ]; then
       echo "Phase 6.5 Contract: using \${BASE}\${suffix}"
       break
     fi
   done

   if [ "$status" != "200" ]; then
     echo "Phase 6.5 Contract: SKIP (no OpenAPI spec found at \${BASE} — tried 4 paths)"
     # skip rest of STEP 2.5, C = 0
   fi
   \`\`\`

   Note: if \`BASE\` contains a path (e.g. \`http://localhost:8000/api\`), the
   concatenation may produce \`/api/api/openapi.json\`. That is acceptable —
   the loop will try all 4 variants regardless.

2. **Identify the matching endpoint** for this form route:
   - \`/employees/new\` → \`POST /api/employees\` (or \`/employees\`)
   - \`/employees/{id}/edit\` → \`PUT /api/employees/{id}\`
   - If no match found: log \`"no backend endpoint matches route X"\` and skip this route.

3. **Extract required fields** from the endpoint's requestBody schema:

   a. Navigate \`spec.paths[path][method].requestBody.content['application/json'].schema\`
   b. **Resolve \`$ref\` iteratively** (multi-hop is common — e.g.
      requestBody.$ref → components.requestBodies.X → content.schema.$ref → components.schemas.Y).
      Cap at 10 hops to prevent infinite loops; log WARN and skip route if exceeded.
   c. **Handle composition**:
      - \`allOf\`: merge \`required[]\` from ALL branches (union)
      - \`oneOf\` / \`anyOf\`: take union of all branches' \`required[]\` (conservative — a field is "required" if ANY branch needs it)
      - Plain schema: use \`schema.required[]\` directly
   d. **Ignore OpenAPI-level \`nullable: true\`** when judging requiredness. A field can be required AND nullable (e.g. \`{"name": "string", "nullable": true}\` still must be present in the request body, just with value \`null\` permitted).
   e. For unresolvable schemas (circular \`$ref\`, missing component reference, malformed spec): log \`"Phase 6.5 Contract: cannot resolve schema for {route} — skipping"\` and skip THIS route only (not the whole audit).

4. **Read the form's actual fields** from Phase 5C evidence:
   - Open \`${out}/evidence/phase5c/{route-slug}/summary.json\`
   - Look for \`contractMismatch.formFieldsSnapshot[]\` (populated by Phase 5C Section D step 3b)
   - If missing (Phase 5C did not capture it): re-navigate via Chrome MCP:
     - \`mcp__Claude_in_Chrome__navigate url=${frontendUrl}{route}\`
     - \`mcp__Claude_in_Chrome__read_page filter=interactive\`
     - Extract all \`input[name]\`, \`select[name]\`, \`textarea[name]\` values

5. **Compare sets**:
   \`\`\`
   missingFromForm = backendRequired - formFields
   extraInForm     = formFields - (backendRequired ∪ backendOptional)
   \`\`\`

6. **Record findings** in \`${out}/docs/CONTRACT_AUDIT.json\`:
   \`\`\`json
   {
     "timestamp": "<ISO>",
     "backendUrl": "<url>",
     "totalFormsChecked": N,
     "formsWithMismatch": M,
     "results": [
       {
         "route": "/airports/new",
         "endpoint": "POST /api/airports",
         "backendRequired": ["code", "name", "city", "country", "address", "zipcode"],
         "formFields": ["code", "name", "city", "country"],
         "missingFromForm": ["address", "zipcode"],
         "extraInForm": [],
         "severity": "critical"
       }
     ]
   }
   \`\`\`

7. **Cross-check against Phase 5C results**:
   - For every route where \`missingFromForm.length > 0\`, the corresponding
     entry in phase5c_results.json SHOULD have \`pass = false\` and
     \`contractMismatch.detected = true\`.
   - If phase5c_results claims \`pass = true\` despite a contract gap detected
     here: **RED FLAG** — add to the Phase 6.5 Discrepancy report as a HIGH
     severity finding: "hallucinated pass — contract gap was not detected by
     Phase 5C but is visible in the rendered form".

### STEP 3: Discrepancy report

Write \`${out}/docs/TEST_REPORT_AUDIT.md\`:

\`\`\`markdown
# Test Report Audit

- Audit timestamp: <ISO>
- Sample size: N tests, M routes
- Discrepancies found: K

## Findings

### Consistent (N-K cases)
No issues.

### Discrepancies (K cases)

#### Test {id}
- Results file claims: pass=true, status=200
- Evidence file shows: pass=true, status=404
- TEST_REPORT.md claims: PASS
- Severity: HIGH (report unreliable)

## Contract Validation (NEW)

- Forms checked: N
- Contract mismatches found: M
- Hallucinated passes (Phase 5C said pass, but contract gap exists): H

### Critical contract gaps (by severity)

For each form with missingFromForm.length > 0:

#### {route}
- Endpoint: {method} {path}
- Backend requires: {required fields}
- Form has: {form fields}
- **Missing from form**: {missingFromForm}
- Phase 5C reported pass: {true | false}
- Severity: {"critical" if Phase 5C said pass else "warning"}

## Confidence

Given K/N discrepancies in sample:
- Estimated report accuracy: {(1 - K/N) * 100}%
- Recommendation: {"High confidence" if K==0, "Review needed" if K<3, "Report unreliable — redo testing" if K>=3}
\`\`\`

### STEP 4: On discrepancy

Let K = evidence-vs-report discrepancies (existing)
Let C = contract mismatches where Phase 5C hallucinated pass
Let Total = K + C

- If Total >= 3: LOG LOUD warning. Report unreliable. Recommend re-run of Phase 5B/5C.
  Additionally if C >= 1: list affected routes — users must fix frontend forms.
- If Total == 0: Log "Phase 6.5 Audit: PASS (N samples, 0 discrepancies, 0 contract gaps)".
- If 1 <= Total < 3: Log "Phase 6.5 Audit: WARN (K discrepancies, C contract gaps — review needed)".

---

## MANDATORY RULES — VIOLATION = TEST FAILURE

1. **READ the test data files first** — do not guess test cases
2. **Execute ALL test cases from the seed** — do not skip or invent
3. **Write results JSON after each round** — the files are quality evidence
4. **Fix bugs in ${ws}** — NEVER modify meta-coder source
5. **Use knowledge graph** (graph_query, graph_path) for code navigation
6. **95% pass rate is the target** — keep fixing and retesting until reached or 10 rounds
7. **THE BUG FIX LOOP IS NOT OPTIONAL** — if pass rate < 95%, you MUST automatically
   fix bugs and retest. Do NOT stop to ask the user. Do NOT skip the loop.
   Execute rounds 2, 3, 4... until 95% or round 10.
8. **NEVER ask "should I continue?"** — the answer is always YES until 95% or 10 rounds
9. **Use graph tools before Read** — graph_query is 0 tokens, Read is 1000+. Navigate with graph first.
10. **MAX 5 image analyses** — if workspace has screenshots, pick 5 representative ones only
11. **Test users must be created before Phase 5B**: seed.auth / seed.auth_admin / seed.auth_{role} may all be null at the start of Phase 5A. Phase 5A STEP A-G is MANDATORY — do NOT proceed to Phase 5B until at least one of seed.auth.token / seed.auth_admin.token is non-null.
    - **Partial auth success (at least one role has token)**: proceed to Phase 5B; tests with \`_authRole\` matching a null-token role will be skipped with log \`"skipped: no token for role=X"\` — do NOT attempt them with null Authorization header.
    - **Total auth failure (ALL roles null)**: write docs/auth_creation_failure.md with diagnosis, then STOP (do not execute Phase 5B). Exit with clear error message.
    - This resolves the former contradiction with STEP E fallback: partial = continue skipping, total = fail fast.
12. **$ references**: test cases reference seed data via $-syntax — resolve them before each request.
13. **Evidence is mandatory** — every test must write an evidence file (Phase 5B: \`${out}/evidence/phase5b/test-{id}.json\`; Phase 5C: \`${out}/evidence/phase5c/{route-slug}/*\`) BEFORE the results JSON claims pass/fail. A claim without evidence is treated as FAIL.
14. **Phase 6.5 Audit is NOT optional** — always run it after Phase 6. Skipping the audit is a VIOLATION.
15. **Contract validation gate** — see Phase 6.5 STEP 4 for the authoritative
    threshold (Total = K + C). Additional rule: any \`C >= 1\` (contract gap
    that Phase 5C hallucinated as pass) MUST be classified \`severity: critical\`
    in TEST_REPORT_AUDIT.md regardless of the Total threshold. A hallucinated
    pass in Phase 5C is worse than a reported fail — users trust the report,
    so false positives mislead more than false negatives.
`

  return prompt
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAuth(seed: any): string {
  const lines: string[] = []
  const auth = seed.auth || {}
  const admin = seed.auth_admin || {}

  // User credentials
  if (auth.email) lines.push('User email: ' + auth.email)
  if (auth.password) lines.push('User password: ' + auth.password)
  if (auth.token) {
    lines.push('User token (JWT): ' + auth.token.substring(0, 50) + '...')
  } else {
    lines.push('User token: not pre-obtained — login to get token')
  }

  // Admin credentials
  if (admin.email) lines.push('Admin email: ' + admin.email)
  if (admin.password) lines.push('Admin password: ' + admin.password)
  if (admin.token) {
    lines.push('Admin token (JWT): ' + admin.token.substring(0, 50) + '...')
  } else if (admin.email) {
    lines.push('Admin token: not pre-obtained — login to get token')
  }

  if (lines.length === 0) {
    lines.push('No auth credentials in seed. You will need to register/login manually.')
  }

  return lines.join('\n')
}

function formatTestCases(tests: any[], limit: number, label: string): string {
  if (!tests || tests.length === 0) {
    return '### ' + label + ' tests\n\nNo ' + label.toLowerCase() + ' tests generated.'
  }

  const truncated = tests.slice(0, limit)
  const lines: string[] = []
  lines.push('### ' + label + ' tests (' + tests.length + ' total' + (tests.length > limit ? ', showing first ' + limit : '') + ')')
  lines.push('')

  for (const t of truncated) {
    // Support multiple field name conventions (Phase 4 vs Phase 3 vs generic)
    const endpoint = t.Endpoint || t.endpoint || t.path || t.url || '???'
    const method = (t.Method || t.method || 'GET').toUpperCase()
    const status = t.Expected || t.expectedStatus || t.expected_status || t['Expected Status'] || 200
    const name = t['Test Name'] || t['Test ID'] || t.description || t.name || ''
    const body = t._requestBody || t.body
    let line = '- ' + method + ' ' + endpoint + ' -> ' + status
    if (name) line += ' | ' + name
    if (body && typeof body === 'object') {
      const bodyStr = JSON.stringify(body)
      if (bodyStr.length <= 120) line += ' body=' + bodyStr
    }
    lines.push(line)
  }

  if (tests.length > limit) {
    lines.push('')
    lines.push('(' + (tests.length - limit) + ' more tests in ' + label.toLowerCase() + ' -- read the full list from the test-cases dir if needed)')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Skill registration
// ---------------------------------------------------------------------------

export function registerSystestSkill(): void {
  registerBundledSkill({
    name: 'systest',
    description: 'System testing with knowledge graph, Chrome MCP browser automation, and auto-fix',
    userInvocable: true,
    async getPromptForCommand(args) {
      if (!args || !args.includes('--workspace')) {
        return [{
          type: 'text',
          text: [
            'Usage: /systest run --workspace <path> [OPTIONS]',
            '',
            'URL options (explicit args override active env inference):',
            '  --backend-url <url>    Backend base URL for API testing',
            '  --frontend-url <url>   Frontend URL for E2E testing',
            '  --database <conn>      Database connection URL',
            '',
            'Env options (alternative to per-URL flags):',
            '  --env <name>           Use a named env instead of the active env',
            '                         (active env is used automatically when set)',
            '',
            'Other options:',
            '  --design-docs <path>   Design documents directory',
          ].join('\n'),
        }]
      }

      try {
        const result = await runSetupPhases(args)
        const prompt = buildTestPrompt(result)
        return [{ type: 'text', text: prompt }]
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return [{ type: 'text', text: '[systest] Setup failed: ' + msg }]
      }
    },
  })
}
