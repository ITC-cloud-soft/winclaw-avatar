/**
 * Resource installer for systest.
 * 
 * Manages the bundled resources (best practices, templates, configs)
 * that are installed to the user's Meta Coder home directory.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { appendFile, chmod, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ensureSystestDirectories } from '../../utils/metaCoderHome.js'
import { PHASE5B_TEST_RUNNER_SOURCE } from './templates/phase5b_test_runner.js'

const RESOURCE_VERSION = '1.1.0'

/**
 * Ensure all systest resources are installed.
 */
export async function ensureSystestResources(): Promise<{
  installed: boolean
  updated: boolean
  version: string
}> {
  const resourceDir = ensureSystestDirectories()
  
  const versionFile = join(resourceDir, '.version')
  const currentVersion = existsSync(versionFile) 
    ? readFileSync(versionFile, 'utf-8').trim()
    : null
  
  if (currentVersion === RESOURCE_VERSION) {
    return { installed: false, updated: false, version: currentVersion }
  }
  
  // Create default best practices (bundled from winclaw)
  await ensureBestPractices(resourceDir)
  
  // Create default config templates
  await ensureConfigTemplates(resourceDir)
  
  // Create default prompt templates (bundled from winclaw)
  await ensurePromptTemplates(resourceDir)
  
  // Create default report templates
  await ensureReportTemplates(resourceDir)
  
  // Write version file
  writeFileSync(versionFile, RESOURCE_VERSION, 'utf-8')
  
  return {
    installed: !currentVersion,
    updated: !!currentVersion,
    version: RESOURCE_VERSION,
  }
}

/**
 * Ensure the target workspace's `.gitignore` contains `.systest/`.
 *
 * Rationale: the `.systest/` directory holds installed runners, test logs,
 * evidence captures, and other runtime artifacts. These are machine-generated
 * and should not be committed into the target project's VCS.
 *
 * Behavior:
 * - If no `.gitignore` exists, creates one containing only the systest block.
 * - If a `.gitignore` exists and already ignores `.systest` (in any common
 *   variant: `.systest`, `.systest/`, `/.systest`, `/.systest/`, `**\/.systest`,
 *   `**\/.systest/`), this is a no-op.
 * - Otherwise appends a commented systest block to the end of the file.
 *
 * Non-fatal: any filesystem error is logged as a warning and swallowed, so
 * runner installation continues.
 *
 * @param workspace Absolute path to the target project's workspace root.
 */
async function ensureSystestGitignore(workspace: string): Promise<void> {
  const gitignorePath = join(workspace, '.gitignore')
  const ignorePattern = '.systest/'
  const commentLine = '# meta-coder systest runtime (evidence, test-logs, runners)'

  try {
    // Check if .gitignore exists
    let exists = true
    try {
      await stat(gitignorePath)
    } catch {
      exists = false
    }

    if (!exists) {
      // .gitignore doesn't exist — create it with just the systest block
      await writeFile(
        gitignorePath,
        `${commentLine}\n${ignorePattern}\n`,
        'utf-8'
      )
      return
    }

    // Read existing .gitignore
    const existing = await readFile(gitignorePath, 'utf-8')

    // Check if `.systest` is already ignored (any common variant).
    // We normalize each non-comment, non-empty line by:
    //   - trimming whitespace
    //   - stripping a leading `!` (negation — still counts as "mentioned")
    //   - stripping leading `/` and trailing `/`
    //   - stripping a leading `**/`
    // Then we accept an exact match of `.systest`.
    const hasIgnore = existing.split('\n').some(rawLine => {
      let line = rawLine.trim()
      if (line.length === 0 || line.startsWith('#')) return false
      if (line.startsWith('!')) line = line.slice(1).trim()
      // Strip leading `**/`
      if (line.startsWith('**/')) line = line.slice(3)
      // Strip leading slashes
      line = line.replace(/^\/+/, '')
      // Strip trailing slashes
      line = line.replace(/\/+$/, '')
      return line === '.systest'
    })

    if (hasIgnore) {
      return // Already ignored — idempotent no-op
    }

    // Append (with leading blank line for readability if file doesn't end with newline)
    const needsNewline = !existing.endsWith('\n')
    await appendFile(
      gitignorePath,
      `${needsNewline ? '\n' : ''}\n${commentLine}\n${ignorePattern}\n`,
      'utf-8'
    )
  } catch (e) {
    // Non-fatal — log and continue
    console.warn(
      `[systest] Could not auto-add .systest/ to ${gitignorePath}: ${(e as Error).message}`
    )
  }
}

/**
 * Install the Phase 5B Python test runner into the target workspace.
 *
 * Writes `${workspace}/.systest/phase5b_test_runner.py` from the embedded
 * template source. Idempotent: overwrites any existing runner on each call
 * so the shipped template always wins over a user-mutated copy.
 *
 * Why we install a pre-authored runner instead of letting Phase 5B generate
 * one: in airlinesys6 the AI-authored runner included a fake `fix_bugs()`
 * that only printed to stdout while claiming success. Shipping a known-good
 * test-only runner prevents that failure mode. Fixes must go through the
 * Claude agent's Edit tool, not through a script.
 *
 * This function also scans the workspace `.systest/` directory for stray
 * AI-authored Python runners/fixers left over from previous sessions and
 * warns about them. It never deletes — a user's hand-written helper could
 * legitimately live there.
 *
 * @param workspace Absolute path to the target project's workspace root.
 * @returns Absolute path of the installed runner.
 */
export async function installPhase5BTestRunner(workspace: string): Promise<string> {
  const destDir = join(workspace, '.systest')
  const destPath = join(destDir, 'phase5b_test_runner.py')

  await mkdir(destDir, { recursive: true })

  // Auto-add `.systest/` to the target project's `.gitignore` so that runner
  // files, test logs, and evidence captures never leak into commits. Idempotent
  // and non-fatal — a failure here must not block runner installation.
  await ensureSystestGitignore(workspace)

  // Scan for stray AI-authored Python runners/fixers and warn the user.
  // airlinesys6 left behind files like `phase5b_runner.py`, `phase5b_runner_fixed.py`,
  // `phase5c_e2e_runner.py`, and `fix_tests.py`. Our official runner is the
  // specific name `phase5b_test_runner.py`; strays with similar names can
  // confuse operators who grep the directory. Non-fatal — a readdir failure
  // (permissions, missing dir, etc.) must not block the install.
  try {
    const files = await readdir(destDir)
    const strayPatterns: RegExp[] = [
      /^phase5[bc].*runner.*\.py$/i,  // phase5b_runner.py, phase5c_e2e_runner.py, etc.
      /^fix.*\.py$/i,                 // fix_tests.py, fix_bugs.py, etc.
      /^runner.*\.py$/i,              // runner.py, runner_v2.py
    ]
    const stray = files.filter(f => {
      if (f === 'phase5b_test_runner.py') return false  // our official template
      return strayPatterns.some(rx => rx.test(f))
    })
    if (stray.length > 0) {
      console.warn(
        `[systest] Detected stray AI-authored Python files in ${destDir}:\n` +
        stray.map(f => `  - ${f}`).join('\n') +
        `\n[systest] These may be leftovers from a previous run. The official runner is\n` +
        `[systest] phase5b_test_runner.py (installed by meta-coder). Consider deleting\n` +
        `[systest] strays to avoid confusion. meta-coder will NOT auto-delete them.`
      )
    }
  } catch {
    /* readdir failure is non-fatal. */
  }

  await writeFile(destPath, PHASE5B_TEST_RUNNER_SOURCE, 'utf-8')

  // Make executable on Unix-like systems (no-op / errors on Windows — ignored).
  try {
    await chmod(destPath, 0o755)
  } catch {
    /* Windows: chmod not supported or permission denied — safe to ignore. */
  }

  return destPath
}

/**
 * Ensure best practice files exist.
 * Bundles best practices from winclaw/ai-dev-system-testing
 */
async function ensureBestPractices(resourceDir: string): Promise<void> {
  const bestPracticesDir = join(resourceDir, 'bestpractices')
  const customDir = join(bestPracticesDir, '_custom')
  
  try { mkdirSync(customDir, { recursive: true }) } catch {}
  
  // Bundled best practices (from winclaw skill)
  const bundledPractices: Record<string, string> = {
    // From winclaw/references/bestpractices/
    'go-zero.md': getGoZeroBestPractice(),
    'java-spring-boot.md': getJavaSpringBootBestPractice(),
    'php-laravel.md': getPhpLaravelBestPractice(),
    'python-fastapi.md': getPythonFastAPIBestPractice(),
    'react-nextjs.md': getReactNextjsBestPractice(),
    
    // Additional practices for common frameworks
    'typescript-hono.md': getTypeScriptHonoBestPractice(),
    'typescript-react.md': getTypeScriptReactBestPractice(),
    'security-general.md': getSecurityGeneralBestPractice(),
    'testing-best-practices.md': getTestingBestPractices(),
  }
  
  for (const [filename, content] of Object.entries(bundledPractices)) {
    const filePath = join(bestPracticesDir, filename)
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content, 'utf-8')
    }
  }
  
  // Create README in custom directory
  const readmePath = join(customDir, 'README.md')
  if (!existsSync(readmePath)) {
    writeFileSync(
      readmePath,
      '# Custom Best Practices\n\nPlace your custom best practice files here.\nThey will be automatically loaded during systest execution.\n',
      'utf-8'
    )
  }
}

/**
 * Ensure config template files exist.
 */
async function ensureConfigTemplates(resourceDir: string): Promise<void> {
  const configDir = join(resourceDir, 'config')
  
  try { mkdirSync(configDir, { recursive: true }) } catch {}
  
  const defaultConfigs: Record<string, string> = {
    'phase-control.json': getPhaseControlConfig(),
    'design-doc-patterns.json': getDesignDocPatterns(),
  }
  
  for (const [filename, content] of Object.entries(defaultConfigs)) {
    const filePath = join(configDir, filename)
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content, 'utf-8')
    }
  }
}

/**
 * Ensure prompt template files exist.
 * Bundles prompts from winclaw/ai-dev-system-testing
 */
async function ensurePromptTemplates(resourceDir: string): Promise<void> {
  const promptsDir = join(resourceDir, 'prompts')
  
  try { mkdirSync(promptsDir, { recursive: true }) } catch {}
  
  const defaultPrompts: Record<string, string> = {
    // Bundled from winclaw/references/prompts/
    'phase1-design-analysis.md': getPhase1PromptBundled(),
    'phase2-gap-analysis.md': getPhase2PromptBundled(),
    'phase3-code-review.md': getPhase3PromptBundled(),
    'phase5a-test-data-seeding.md': getPhase5APromptBundled(),
    'phase5b-api-tests-efficient.md': getPhase5BPromptBundled(),
    'phase5c-ui-tests-efficient.md': getPhase5CPromptBundled(),
  }
  
  for (const [filename, content] of Object.entries(defaultPrompts)) {
    const filePath = join(promptsDir, filename)
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content, 'utf-8')
    }
  }
}

/**
 * Ensure report template files exist.
 */
async function ensureReportTemplates(resourceDir: string): Promise<void> {
  const templatesDir = join(resourceDir, 'templates')
  
  try { mkdirSync(templatesDir, { recursive: true }) } catch {}
  
  const defaultTemplates: Record<string, string> = {
    'test-report.md': getTestReportTemplate(),
    'design-review-report.md': getDesignReviewTemplate(),
  }
  
  for (const [filename, content] of Object.entries(defaultTemplates)) {
    const filePath = join(templatesDir, filename)
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content, 'utf-8')
    }
  }
}

// ---------------------------------------------------------------------------
// Bundled Best Practice Content (from winclaw skill)
// ---------------------------------------------------------------------------

function getGoZeroBestPractice(): string {
  return `# Go / go-zero Best Practices for Code Review

- **Language**: Go 1.19+
- **Framework**: go-zero 1.5+ (microservices framework)
- **Applicable when**: \`backend.framework == "go-zero"\` or (\`backend.language == "go"\` and go-zero imports detected)

## Architecture Patterns

### Three-Layer Separation (Mandatory)
\`\`\`
Handler Layer  → HTTP routing, request parsing (httpx utilities only)
    ↓
Logic Layer    → Business logic, validation, transaction orchestration
    ↓
Model Layer    → Database access (via sqlx), cache operations
\`\`\`

### Service Discovery & RPC
- Use go-zero's built-in service discovery (etcd/consul)
- Define RPC proto files in \`rpc/\` directory
- Implement timeout on all RPC calls

## Code Quality

### Error Handling
- Wrap all external calls with error checking
- Use go-zero's \`xerr\` for error codes
- Return structured errors: code, message, details

### Validation
- Validate at Handler layer entry
- Use go-zero's built-in validation structs
- Return 400 for validation errors, 500 for system errors

## Database
- Use transactions for multi-step operations
- Implement proper connection pooling
- Add indexes on frequently queried fields
`
}

function getJavaSpringBootBestPractice(): string {
  return `# Java / Spring Boot Best Practices for Code Review

- **Language**: Java 17+
- **Framework**: Spring Boot 3.x
- **Applicable when**: \`backend.framework == "spring-boot"\` or Spring dependencies detected

## Architecture Patterns

### Layered Architecture
\`\`\`
Controller Layer    → @RestController, request mapping
    ↓
Service Layer       → @Service, business logic
    ↓
Repository Layer    → @Repository, data access
\`\`\`

## Code Quality

### Dependency Injection
- Use constructor injection over field injection
- Use @Lazy for circular dependencies
- Qualify beans with @Qualifier when needed

### Validation
- Use @Valid for request body validation
- Implement custom validators for business rules
- Return BindingResult errors as 400 Bad Request

## Security
- Enable Spring Security with JWT
- Use @PreAuthorize for method-level security
- Validate all user inputs
- Configure CORS properly
`
}

function getPhpLaravelBestPractice(): string {
  return `# PHP / Laravel Best Practices for Code Review

- **Language**: PHP 8.2+
- **Framework**: Laravel 10.x
- **Applicable when**: \`backend.framework == "laravel"\` or Laravel detected

## Architecture Patterns

### MVC Structure
- Controllers in \`app/Http/Controllers/\`
- Models in \`app/Models/\`
- Views in \`resources/views/\`

### Service Layer Pattern
- Create Services in \`app/Services/\`
- Keep controllers thin, move logic to services
- Use dependency injection via constructor

## Code Quality

### Validation
- Use Form Requests for validation
- Implement custom validation rules
- Return validation errors as 422

### Database
- Use Eloquent ORM for simple queries
- Use Query Builder for complex queries
- Implement database transactions for multi-step operations
`
}

function getPythonFastAPIBestPractice(): string {
  return `# Python / FastAPI Best Practices for Code Review

- **Language**: Python 3.11+
- **Framework**: FastAPI 0.100+
- **Applicable when**: \`backend.framework == "fastapi"\` or FastAPI detected

## Architecture Patterns

### Router-Service-Model Pattern
\`\`\`
router/    → API route definitions (FastAPI router)
    ↓
service/  → Business logic, coordination
    ↓
model/    → Database access (SQLAlchemy), schemas
\`\`\`

## Code Quality

### Validation
- Use Pydantic models for request/response validation
- Implement custom validators with @field_validator
- Return 422 for validation errors

### Error Handling
- Define custom exception classes
- Use HTTPException for known error codes
- Implement proper logging with structured logs

## Database
- Use async database drivers (asyncpg/aiomysql)
- Implement proper connection pooling
- Use transactions for multi-step operations
`
}

function getReactNextjsBestPractice(): string {
  return `# React / Next.js Best Practices for Code Review

- **Language**: JavaScript / TypeScript
- **Framework**: React 18+, Next.js 13.5+
- **Applicable when**: \`frontend.framework == "react"\` or \`frontend.framework == "nextjs"\`

## Architecture Patterns

### Server Components vs Client Components
- Default to Server Components (RSC); add \`"use client"\` only when needed
- Use Client Components for interactivity (onClick, useState, etc.)
- Keep Server Components for data fetching and static content

### App Router Structure
- Use \`app/\` directory for App Router (Next.js 13+)
- Use file-based routing: \`app/dashboard/page.tsx\`
- Use \`layout.tsx\` for shared layouts
- Use \`loading.tsx\` and \`error.tsx\` for UI states

## Code Quality

### Component Design
- Keep components focused and single-purpose
- Use TypeScript for type safety
- Prefer function components with hooks
- Extract custom hooks for reusable logic

### Performance
- Memoize expensive computations with useMemo/useCallback
- Use dynamic imports for code splitting: next/dynamic
- Optimize images with next/image
- Implement proper caching strategies
`
}

// ---------------------------------------------------------------------------
// Additional Best Practices (Meta Coder specific)
// ---------------------------------------------------------------------------

function getTypeScriptHonoBestPractice(): string {
  return `# TypeScript + Hono Best Practices

## Project Structure
- Separate routes from business logic
- Use middleware for cross-cutting concerns
- Organize by feature/domain

## Error Handling
- Use consistent error response format
- Implement proper HTTP status codes
- Log errors with context

## Validation
- Use Zod for request/response validation
- Validate at route handler entry point
- Return meaningful validation errors

## Security
- Implement authentication middleware
- Use environment variables for secrets
- Validate and sanitize user input
- Implement rate limiting

## Testing
- Test route handlers independently
- Mock external dependencies
- Test error scenarios
`
}

function getTypeScriptReactBestPractice(): string {
  return `# TypeScript + React Best Practices

## Component Design
- Keep components focused and single-purpose
- Use TypeScript for type safety
- Prefer function components with hooks

## State Management
- Lift state appropriately
- Use context for global state
- Consider URL state for shareable state

## Performance
- Memoize expensive computations
- Lazy load routes/components
- Optimize re-renders

## Accessibility
- Use semantic HTML
- Ensure keyboard navigation
- Provide ARIA labels where needed
`
}

function getSecurityGeneralBestPractice(): string {
  return `# Security Best Practices

## Authentication & Authorization
- Always validate JWT tokens
- Check permissions on every protected endpoint
- Implement proper session management

## Input Validation
- Never trust user input
- Validate length, type, and format
- Sanitize output to prevent XSS

## Data Protection
- Encrypt sensitive data at rest
- Use HTTPS in production
- Never log sensitive information

## Common Vulnerabilities
- Protect against SQL injection
- Prevent CSRF attacks
- Implement proper CORS
`
}

function getTestingBestPractices(): string {
  return `# Testing Best Practices

## Test Organization
- Organize tests by feature
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

## Test Coverage
- Aim for high coverage of critical paths
- Test edge cases and error scenarios
- Don't test implementation details

## Test Data
- Use factories for test data
- Clean up after tests
- Use deterministic data

## API Testing
- Test happy path and error paths
- Validate response schemas
- Test authentication and authorization
`
}

// ---------------------------------------------------------------------------
// Config Templates
// ---------------------------------------------------------------------------

function getPhaseControlConfig(): string {
  return JSON.stringify(
    {
      _version: '2.0.0',
      global: {
        target_pass_rate_5b: 95,
        target_pass_rate_5c: 100,
        verbose_logging: true,
        stop_on_failure: true,
        graph_enabled: true,
        graph_auto_build: true,
      },
      phase_timeouts: {
        phase1: 1800,
        phase2: 1800,
        phase3: 2400,
        phase5a: 1800,
        phase5b_iteration: 3600,
        phase5c_iteration: 3600,
        phase6: 1800,
      },
      iteration_control: {
        max_iterations: 15,
        early_exit_threshold: 3,
        enable_early_exit: true,
      },
      phase5a_seeding: {
        test_user_email: 'systest_user@example.com',
        test_user_password: 'Test@123456',
        admin_test_user_email: 'systest_admin@example.com',
        admin_test_user_password: 'Test@123456',
        scenario_priority_tiers: [
          'basic_crud',
          'authorization',
          'validation',
          'state_machine',
          'business_constraints',
          'error_paths',
        ],
      },
      environment_check: {
        chrome_mcp_check_enabled: true,
        chrome_mcp_check_timeout_seconds: 60,
        allowed_test_methods: ['claude_in_chrome_mcp'],
        prohibited_test_methods: [
          'curl',
          'python_requests',
          'playwright',
          'puppeteer',
          'selenium',
        ],
      },
    },
    null,
    2
  )
}

function getDesignDocPatterns(): string {
  return JSON.stringify(
    {
      api_specs: [
        '**/openapi.yaml',
        '**/openapi.json',
        '**/api*.md',
        '**/API*.md',
        '**/endpoints*.md',
      ],
      screen_specs: [
        '**/画面*.md',
        '**/screen*.md',
        '**/wireframe*',
        '**/page*.md',
        '**/ui*.md',
      ],
      db_specs: [
        '**/ER*.md',
        '**/テーブル*.md',
        '**/table*.md',
        '**/schema*.sql',
        '**/database*.md',
      ],
      business_specs: [
        '**/要件*.md',
        '**/requirement*.md',
        '**/use-case*.md',
        '**/business*.md',
        '**/flow*.md',
        '**/state*.md',
      ],
      architecture_specs: [
        '**/アーキテクチャ*.md',
        '**/architecture*.md',
        '**/system*.md',
        '**/tech-stack*.md',
        '**/deployment*.md',
      ],
      supported_formats: {
        text: ['.md', '.txt', '.rst'],
        structured: ['.yaml', '.yml', '.json'],
        sql: ['.sql', '.ddl'],
        image: ['.png', '.jpg', '.jpeg', '.svg'],
      },
    },
    null,
    2
  )
}

// ---------------------------------------------------------------------------
// Bundled Prompt Templates (from winclaw)
// ---------------------------------------------------------------------------

function getPhase1PromptBundled(): string {
  return `# Phase 1: Design Document Analysis

## Task
Analyze the provided design documents and extract:
1. API specifications and endpoints
2. Database schema and entity relationships
3. Business rules and validation requirements
4. Screen/flow specifications
5. Architecture decisions

## Output
- DESIGN_ANALYSIS.md: Human-readable design overview
- config/design-spec.json: Machine-readable design specification
- DESIGN_TESTCASES.md: Test cases derived from design
- DESIGN_QUALITY_ISSUES.md: Identified design problems
`
}

function getPhase2PromptBundled(): string {
  return `# Phase 2: Code Structure Analysis (Gap Analysis for Mode B)

## Task
Analyze the codebase structure using the knowledge graph:
1. Identify modules and their relationships
2. Map API routes to handlers to services to models
3. Identify key entities and their dependencies
4. Compare with design documents (Mode B) - identify gaps

## Graph Context
{{GRAPH_CONTEXT}}

## Design Context (Mode B)
{{DESIGN_SPEC}}

## Output
- CODE_ANALYSIS.md: Code structure overview
- config/project-structure.json: Project structure configuration
- DESIGN_CODE_GAP_REPORT.md: Design vs implementation gaps (Mode B)
`
}

function getPhase3PromptBundled(): string {
  return `# Phase 3: Code Review

## Task
Review the codebase for:
1. Security vulnerabilities
2. Performance issues
3. Code quality and maintainability
4. Best practice violations
5. Business logic correctness

## Review Priorities
{{REVIEW_PRIORITIES}}

## Best Practices
{{BEST_PRACTICES}}

## Output
- CODE_REVIEW_REPORT.md: Detailed review findings
- BUSINESS_LOGIC_TESTCASES.md: Extracted business logic test cases
`
}

function getPhase5APromptBundled(): string {
  return `# Phase 5A: Test Data Seeding

## Task
Generate layered test data:
1. P0: Basic valid data
2. P1: Required field variations
3. P2: Boundary values
4. P3: Authorization tests
5. P4: State transition tests
6. P5: Business constraint tests

## Entity Information
{{ENTITIES}}

## Output
- test-logs/test_data_seed.json: Generated test data (includes AI-generated auth/auth_admin credentials)
`
}

function getPhase5BPromptBundled(): string {
  return `# Phase 5B: API Endpoint Testing (Efficient)

## Task
Execute iterative API testing:
1. Run all API tests
2. Analyze failures
3. Fix issues
4. Repeat until target pass rate achieved

## API Endpoints
{{API_ENDPOINTS}}

## Test Data
{{TEST_DATA}}

## Efficiency Notes
- Use Chrome MCP for HTTP requests
- Batch similar requests
- Reuse auth tokens across requests
- Stop early if pass rate is not improving

## Output
- test-logs/phase5b_results.json: Test results with pass rate
- test-logs/phase5b_fixes.md: Applied fixes
`
}

function getPhase5CPromptBundled(): string {
  return `# Phase 5C: UI Browser Testing (Efficient)

## Task
Execute browser-based UI testing:
1. Navigate to pages
2. Fill forms and submit
3. Verify content and interactions
4. Capture screenshots

## Test Cases
{{UI_TEST_CASES}}

## Efficiency Notes
- Use Chrome MCP for browser automation
- Record GIF for visual verification
- Test critical user flows first
- Stop early if critical issues found

## Output
- test-logs/phase5c_results.json: Test results with pass rate
- test-logs/screenshots/: Captured screenshots
`
}

// ---------------------------------------------------------------------------
// Report Templates
// ---------------------------------------------------------------------------

function getTestReportTemplate(): string {
  return `# System Test Report

## Executive Summary

**Project**: {{PROJECT_NAME}}
**Date**: {{REPORT_DATE}}
**Mode**: {{TEST_MODE}}
**Overall Pass Rate**: {{PASS_RATE}}%

### Health Score
{{HEALTH_SCORE_BAR}} {{HEALTH_SCORE}}/100

### Quick Stats
| Metric | Value |
|--------|-------|
| Total Tests | {{TOTAL_TESTS}} |
| Passed | {{PASSED_TESTS}} |
| Failed | {{FAILED_TESTS}} |
| Duration | {{DURATION}} |

---

## Module-Level Results

{{MODULE_RESULTS}}

---

## Failure Analysis

{{FAILURE_ANALYSIS}}

---

## Coverage Report

{{COVERAGE_REPORT}}

---

## Action Items

{{ACTION_ITEMS}}
`
}

function getDesignReviewTemplate(): string {
  return `# Design Review Report

## Executive Summary

**Project**: {{PROJECT_NAME}}
**Date**: {{REPORT_DATE}}
**Documents Reviewed**: {{DOC_COUNT}}

### Design Quality Score
{{DESIGN_SCORE_BAR}} {{DESIGN_SCORE}}/100

---

## Design Analysis

{{DESIGN_ANALYSIS}}

---

## Identified Issues

{{ISSUES}}

---

## Test Plan

{{TEST_PLAN}}

---

## Estimated Effort

{{EFFORT_ESTIMATE}}
`
}
