/**
 * Node.js + Fastify (TypeScript) harness template.
 *
 * 4-layer architecture: routes → service → repository → infrastructure.
 * Covers Zod validation, Pino structured logging, Prisma/Knex repository rules,
 * bigint money handling, and undici/cockatiel resilience patterns.
 */

import type { Template } from '../index.js'
import { minimalTemplate } from '../minimal/index.js'

export const nodeFastapiTemplate: Template = {
  ...minimalTemplate,

  'rules/architecture.md': `# Architecture Rules — Node.js + Fastify (TypeScript)

## 4-Layer Architecture

### Layer 1: Routes (API)
- Fastify route handlers in \`src/routes/\`
- Responsibilities: HTTP binding, Zod schema validation, response serialization
- Forbidden: business logic, direct DB access, external API calls
- Every route declares explicit Zod \`schema\` for request body, params, query, and response
- Authentication/authorization handled by Fastify hooks, not route handlers

### Layer 2: Service
- Plain TypeScript classes/functions in \`src/services/\`
- Responsibilities: use-case orchestration, business rule enforcement
- Forbidden: HTTP types (\`FastifyRequest\`/\`FastifyReply\`), SQL/ORM calls, raw fetch
- Injected with repository and infrastructure interfaces (never concrete classes)
- All public functions have explicit return types

### Layer 3: Repository
- Data access in \`src/repositories/\`
- Uses Prisma client or Knex query builder — no raw SQL strings outside this layer
- Responsibilities: CRUD abstraction, query optimization, pagination
- Forbidden: business logic, calling external APIs
- Each repository exports an interface; implementation is injected via DI

### Layer 4: Infrastructure
- External integrations in \`src/infra/\`
- HTTP clients via undici with explicit timeout
- Retry via \`p-retry\`; circuit breaker via \`cockatiel\`
- Every external client exports an interface for testability
- Forbidden: business logic, direct DB access

## Module Structure

\`\`\`
src/
  routes/          # Fastify route plugins — I/O boundary
  services/        # Business logic — pure TS, no HTTP/DB
  repositories/    # Data access — Prisma or Knex only
  infra/           # External HTTP clients, cache, queue
  domain/          # Types, value objects, error classes
  plugins/         # Fastify plugins (auth, logging, db)
  config/          # Environment config via env-schema
\`\`\`

## Layer Crossing Rules

- \`routes/\` → \`services/\` → \`domain/\` (one direction)
- \`repositories/\` and \`infra/\` injected into \`services/\` via constructor/function args
- \`domain/\` has zero imports from other layers
- Circular imports between any two layers: forbidden (enforced by ESLint no-cycle)

## ESM Rules

- All imports use \`.js\` extension (ESM with TypeScript source)
- No CommonJS \`require()\`; top-level \`await\` allowed in plugin files
- \`"type": "module"\` in \`package.json\`; \`moduleResolution: "bundler"\` in tsconfig
`,

  'rules/coding.md': `# Coding Rules — Node.js + Fastify (TypeScript)

## Money / Price

- Monetary values: \`bigint\` (integer cents) or \`Decimal\` from \`decimal.js\`
- Never use \`number\` for money — JavaScript floats lose precision past 2^53
- Field naming: suffix \`Cents\` for bigint (e.g., \`totalPriceCents: bigint\`)
- Comparisons: \`===\` for bigint; \`.equals()\` for \`Decimal\` instances
- Arithmetic: \`+\` / \`-\` / \`*\` on bigint; \`.plus()\` / \`.minus()\` / \`.times()\` on Decimal
- Never mix bigint and Decimal in the same calculation path without explicit ADR

## Validation (Zod)

- Every route schema defined with Zod: body, params, query, headers, response
- Zod schemas co-located with route file or in \`src/domain/schemas/\`
- Never trust unvalidated external data in service layer
- \`z.coerce.number()\` forbidden for money fields — use \`z.bigint()\` or \`z.string()\` + parse
- Validation errors produce HTTP 400 with structured error body (Fastify default + \`zod-to-json-schema\`)

## Database (Prisma / Knex)

- No raw SQL strings outside \`src/repositories/\`
- Prisma: use \`$transaction()\` for multi-table writes; never nest transactions
- Knex: parameterized queries only; never string interpolation
- N+1 prevention: use Prisma \`include\` or Knex joins; never query inside a loop
- Connection pool: configured via environment variable; not hardcoded

## External API Calls

Every external HTTP call must include all four:
1. Timeout — \`undici\` \`dispatcher\` with explicit \`connectTimeout\` and \`bodyTimeout\`
2. Retry — \`p-retry\` with exponential backoff, max 3 attempts, retryOn 5xx/network errors
3. Circuit Breaker — \`cockatiel\` \`Policy.circuitBreaker()\` wrapping the call
4. Fallback — cached response or safe empty default on circuit open

## Logging (Pino)

- Fastify built-in Pino logger; never \`console.log\` in production paths
- Structured: pass object as first arg — \`log.info({ orderId, userId }, 'order.created')\`
- PII (email, phone, token) must pass through \`maskPii()\` before logging
- Log levels: error = human intervention, warn = abnormal/auto-recovering,
  info = business event, debug = development only (stripped via log-level env var)
- Request/response logging via Fastify \`logIncomingRequest\` hook; body excluded by default

## Error Handling

- \`class FooBusinessError extends Error\` — map to HTTP 4xx; include \`code\` string field
- \`class FooSystemError extends Error\` — map to HTTP 5xx; wrap root cause
- Never \`throw 'string'\` or \`throw { message }\` — always throw Error subclasses
- Global error handler registered as Fastify \`setErrorHandler\` — never catch in route handler
- Stack traces: logged server-side only; API response contains \`code\` + \`message\`, no stack

## TypeScript

- \`strict: true\` always enabled
- No \`any\` without a comment; prefer \`unknown\` for external/untyped data
- Explicit return types on all exported functions and class methods
- Discriminated unions over nullable fields where semantics differ

## Tests

- \`bun test\` (Bun test runner) or \`vitest\`; Jest avoided for ESM friction
- Unit: mock dependencies via injected interfaces; no real DB/HTTP
- Integration: Fastify \`inject()\` for route tests; Testcontainers for DB
- Coverage: line ≥ 80%, branch ≥ 70%
`,

  'rules/workflow.md': `# Workflow Rules — Node.js + Fastify

## 10-Phase Pipeline

| Phase | Entry Condition | Exit Condition | Rollback Trigger |
|-------|----------------|----------------|-----------------|
| 1. Requirements | Stakeholder approval | Requirements doc v1 | Scope ambiguity |
| 2. Design | Phase 1 done | ADR + module diagram | Architecture conflict |
| 3. Test Spec | Phase 2 done | Test plan with Zod schema list | Coverage targets missing |
| 4. Implementation | Phase 3 done | Code + unit tests pass | \`bun test\` fails |
| 5. Code Review | Phase 4 done | Reviewer APPROVE | Layer violation |
| 6. Integration Test | Phase 5 done | All routes pass Fastify inject tests | Critical bug |
| 7. Performance | Phase 6 done | p99 within SLA | Latency regression |
| 8. Security | Phase 7 done | \`npm audit\` + eslint security plugin clean | High CVE |
| 9. Deploy Plan | Phase 8 done | Runbook confirmed | Procedure incomplete |
| 10. Confirm | Phase 9 done | Production smoke test passes | Fatal error |

## Gate Standard

Every gate must be programmatically verifiable via \`bun test\`, \`npm run typecheck\`,
or \`eslint .\`. All gates must complete within timeout and produce structured output.

## Rollback Policy

- Phases 4–10: gate failure triggers rollback to previous phase
- Three consecutive failures: require human approval
- All rollbacks recorded in audit log
`,

  'skills/plan.md': `# Planning SOP — Node.js + Fastify

## Purpose

Produce a structured plan before writing any TypeScript code.
Prevents layer violations and untyped external data from entering services.

## Step 1: Requirements Decomposition

1. Identify which routes (endpoints) are new or modified
2. List domain types and Zod schemas needed
3. Identify repository queries (Prisma models affected)
4. List external API calls requiring undici + cockatiel setup

## Step 2: Architecture Impact

1. Verify new routes only import from \`services/\`
2. Verify new services only import from \`repositories/\` and \`infra/\` interfaces
3. Check for potential circular imports
4. Plan Fastify plugin registration order

## Step 3: Risk Identification

- Money fields: confirm \`bigint\` or \`Decimal\` used; identify all Zod schemas for money
- External APIs: confirm 4-point set for each new \`undici\` call
- N+1: plan \`include\` or JOIN strategy for each Prisma query touching relations
- ESM: confirm all new imports use \`.js\` extension

## Step 4: Test Planning

1. List Zod validation edge cases (invalid types, missing fields, coercion traps)
2. List Fastify \`inject()\` test cases per route
3. Identify WireMock/nock stubs needed for external API tests

## Step 5: Sequence

Domain types → Repository interface → Repository impl → Service → Route → Integration test
`,

  'skills/implement-by-layer.md': `# Implement By Layer SOP — Node.js + Fastify

## Purpose

Implement features strictly through the 4-layer architecture, ensuring
each layer is independently testable before the next is written.

## Prerequisites

- ADR approved for any new external dependency
- Zod schemas drafted for all new API surfaces
- \`bun test\` green on existing tests before starting

## Step 1: Domain Layer

1. Define TypeScript types, interfaces, and value objects in \`src/domain/\`
2. Define error classes: \`class *BusinessError extends Error\` (4xx), \`class *SystemError extends Error\` (5xx)
3. Define Zod schemas for domain objects (reused in routes and services)
4. Write pure unit tests — no I/O, no mocks needed
5. Run: \`bun test src/domain/\`; must be green

## Step 2: Repository Layer

1. Define repository interface in \`src/domain/\` or \`src/repositories/\`
2. Implement with Prisma/Knex in \`src/repositories/\`
3. Money fields: store as \`bigint\` in DB; Prisma \`@db.BigInt\` mapping
4. Write tests with Testcontainers (real DB) for query correctness
5. Run: \`bun test src/repositories/\`

## Step 3: Service Layer

1. Create service function or class in \`src/services/\`
2. Inject repository and infra interfaces via constructor or function args
3. Money arithmetic: use \`bigint\` ops or \`Decimal\` consistently per ADR
4. Write unit tests with mock repository (jest-mock or hand-written stub)
5. Run: \`bun test src/services/\`

## Step 4: Routes Layer

1. Create Fastify route plugin in \`src/routes/\`
2. Declare \`schema\` with Zod (via \`fastify-type-provider-zod\`)
3. Inject service via Fastify DI container or plugin closure
4. Write route tests using Fastify \`inject()\` — no real DB
5. Run: \`bun test src/routes/\`

## Step 5: Infrastructure Layer

1. Implement external HTTP clients in \`src/infra/\` using undici
2. Wrap every call with cockatiel circuit breaker + p-retry
3. Set explicit \`connectTimeout\` and \`bodyTimeout\` on undici dispatcher
4. Write tests with WireMock or nock to stub HTTP responses
5. Run: \`bun test\` + \`npm run typecheck\` + \`eslint .\`

## Forbidden

- Importing \`FastifyRequest\` in service layer
- Raw SQL string outside repository layer
- Using \`number\` type for monetary calculation
- Committing code that fails \`npm run typecheck\`
`,

  'skills/review.md': `# Review SOP — Node.js + Fastify

## Purpose

Verify implementation is production-ready before advancing to the next phase.

## Architecture Checklist

- [ ] No layer violations: service does not import route types; domain has no I/O imports
- [ ] All new imports use \`.js\` extension (ESM compliance)
- [ ] No circular imports (ESLint \`import/no-cycle\` passes)
- [ ] Repository interface defined in domain/; implementation injected

## Coding Standards Checklist

- [ ] Money fields use \`bigint\` or \`Decimal\` — no \`number\` type for monetary values
- [ ] All route schemas have Zod definitions for body, params, query, and response
- [ ] External HTTP calls wrapped with undici + p-retry + cockatiel + fallback
- [ ] Pino structured logging; no \`console.log\`
- [ ] PII masked before logging
- [ ] Error classes extend \`Error\`; no thrown strings or plain objects
- [ ] Global \`setErrorHandler\` handles all unhandled errors

## TypeScript Checklist

- [ ] \`npm run typecheck\` exits 0
- [ ] No \`any\` without justification comment
- [ ] All exported functions have explicit return types

## Test Checklist

- [ ] \`bun test\` exits 0; coverage ≥ 80% line, ≥ 70% branch
- [ ] Every route has Fastify \`inject()\` test (happy + error)
- [ ] Zod validation rejection tested for each schema

## Output Format

\`\`\`json
{
  "passed": true,
  "verdict": "APPROVE | APPROVE-WITH-FIXES | REJECT",
  "violations": [
    { "rule": "<rule-id>", "file": "<path>", "line": 0, "fix": "<suggestion>" }
  ],
  "score": 100
}
\`\`\`
`,

  'skills/test.md': `# Test SOP — Node.js + Fastify

## Test Pyramid

- Unit tests (60%): pure TS, no Fastify context, mock injected deps
- Route tests (30%): Fastify \`inject()\`, real service logic, mock repository
- Integration tests (10%): real DB via Testcontainers, WireMock for HTTP

## Unit Test Standard

1. One test file per source file (adjacent, \`*.test.ts\`)
2. Minimum 5 cases: happy path, invalid input, boundary, error, idempotency
3. Money: test bigint arithmetic edge cases (zero, max safe bigint, negative)
4. Zod schemas: test valid input, each invalid field, coercion traps
5. Run: \`bun test --reporter=verbose\`

## Route Test Standard

1. Use \`fastify.inject()\` — no real HTTP; Fastify built-in test helper
2. Assert: status code, Content-Type, response body shape (Zod parse result)
3. Test HTTP 400 for each invalid Zod field
4. Test HTTP 401/403 for auth-protected routes
5. No real DB; inject mock service via Fastify DI

## Integration Test Standard

1. Start Testcontainers PostgreSQL; apply Prisma migrations
2. WireMock: stub all external HTTP dependencies
3. Run full request lifecycle: route → service → repository → DB
4. Assert DB state after mutation tests
5. Teardown: truncate tables (not drop) for fast reset

## ESM Import Check

Run \`node --input-type=module < /dev/null\` to confirm no CJS leakage.
All test files must import with \`.js\` extension.
`,

  'agents/pm.md': `# Agent: Project Manager — Node.js Fastify

## Identity

You are a senior technical PM experienced in Node.js microservices.
You understand Fastify plugin lifecycle, Prisma migration risks,
and ESM module resolution edge cases.

## Responsibilities

- Own requirements doc and ADR index
- Gate phase transitions; reject if \`bun test\` or \`npm run typecheck\` does not pass
- Track Prisma migration status as deployment risk
- Ensure money fields (bigint/Decimal) are in acceptance criteria

## Phase Gate Authority

- Approve transition only when programmatic gate passes
- Reject if \`eslint .\` reports errors
- Require \`npm audit\` clean before Phase 8 (Security)
`,

  'agents/developer.md': `# Agent: Developer — Node.js + Fastify

## Identity

You are a senior TypeScript/Node.js engineer specializing in Fastify microservices.
You follow the 4-layer architecture and every rule in \`harness/rules/coding.md\`.

## Implementation Order

Domain types → Repository interface → Repository impl → Service → Routes → Infrastructure.
Never write a route before its service tests are green.

## Money Rules (Non-Negotiable)

- \`bigint\` for integer cents storage; \`Decimal\` from decimal.js for non-integer precision
- No \`number\` type for any monetary value — JavaScript float precision is insufficient
- Document currency unit in field name suffix (\`Cents\`, \`Wei\`, \`Units\`)

## Validation Rules

- Zod schema defined before route implementation — schema-first approach
- \`z.bigint()\` for money fields; \`z.string().transform()\` for external string-encoded amounts
- Never use \`z.any()\` without team review

## Logging

- Pino via Fastify's built-in logger: \`request.log.info({ ... })\`
- Structured object first arg, message string second
- PII masked via \`maskPii()\` utility before any log call

## Output Format

Produce files in order:
1. Domain types + error classes + unit tests
2. Repository interface + Prisma implementation + Testcontainers test
3. Service + mock unit tests
4. Route plugin + inject() tests
5. Infrastructure client + WireMock tests
`,

  'agents/reviewer.md': `# Agent: Reviewer — Node.js Fastify

## Identity

You are a principal Node.js engineer focused on TypeScript type safety,
ESM compliance, and Fastify architecture correctness.

## Primary Review Concerns

1. ESM import extensions — all imports must end in \`.js\`
2. Money type — \`bigint\` or \`Decimal\`; never \`number\`
3. Zod schema completeness — response schema as strict as request schema
4. Layer violations — service must not import route types
5. Resilience — every undici call has timeout + retry + circuit breaker

## Review Process

1. Run \`npm run typecheck\` — must exit 0
2. Run \`bun test\` — must exit 0 with coverage thresholds met
3. Run \`eslint .\` — zero errors
4. Inspect money field types in Prisma schema and Zod schemas
5. Check every \`fetch\`/undici call for 4-point resilience set

## Verdict Rules

- REJECT: \`number\` used for money, missing Zod schema, \`any\` without comment
- APPROVE-WITH-FIXES: missing \`.js\` extension, suboptimal Pino usage
- APPROVE: all checks clean
`,

  'agents/tester.md': `# Agent: Tester — Node.js Fastify

## Identity

You are a senior QA engineer specializing in Fastify route testing,
Zod validation coverage, and Testcontainers integration tests.

## Test Strategy

- Unit: pure TS, no I/O, fast feedback via \`bun test\`
- Route: Fastify \`inject()\`, real service, mock repository
- Integration: real DB + WireMock + full Fastify app

## Entry Criteria

- \`bun test\` passes before integration tests are written
- Testcontainers image matches production DB version
- Zod schemas finalized before writing validation tests

## Test Case Specification

\`\`\`
Test: <route>_<scenario>_<expected_status>
Input: <request body/params>
Expected: <status code> + <response shape>
Zod path: <field being validated if applicable>
\`\`\`

## Money Test Policy

Every service function handling money must have test cases for:
- Zero amount (bigint 0n)
- Maximum realistic amount
- Arithmetic that would lose precision if float were used
- Currency mismatch detection (if applicable)

## Coverage Gate

Run \`bun test --coverage\`. Gate fails if line < 80% or branch < 70%.
`,

  'workflow/phases.yaml': `version: 1
default_phase: requirements

phases:
  - id: requirements
    name: Requirements Analysis
    next: design
    rollback_to: null
    gate: gate-requirements
    role: pm

  - id: design
    name: Architecture Design
    next: test-spec
    rollback_to: requirements
    gate: gate-design
    role: pm

  - id: test-spec
    name: Test Specification
    next: implementation
    rollback_to: design
    gate: gate-test-spec
    role: tester

  - id: implementation
    name: Implementation
    next: code-review
    rollback_to: test-spec
    gate: gate-implementation
    role: developer

  - id: code-review
    name: Code Review
    next: integration-test
    rollback_to: implementation
    gate: gate-code-review
    role: reviewer

  - id: integration-test
    name: Integration Testing
    next: performance
    rollback_to: code-review
    gate: gate-integration-test
    role: tester

  - id: performance
    name: Performance Validation
    next: security
    rollback_to: integration-test
    gate: gate-performance
    role: developer

  - id: security
    name: Security Scan
    next: deploy-plan
    rollback_to: performance
    gate: gate-security
    role: reviewer

  - id: deploy-plan
    name: Deployment Planning
    next: confirm
    rollback_to: security
    gate: gate-deploy-plan
    role: pm

  - id: confirm
    name: Production Confirmation
    next: null
    rollback_to: deploy-plan
    gate: gate-confirm
    role: pm
`,

  'workflow/gates.yaml': `version: 1

# v3.3.0: requirements/design/test-spec/implementation gates now validate the
# real spec-kit artifacts under harness/specs/\${ACTIVE_FEATURE}/ rather than
# only checking that template files exist. \${ACTIVE_FEATURE} is resolved at
# gate-run time from harness/audit/active-feature.txt; if unset, spec-aware
# checks are skipped with a warning (back-compat). Set policy.yaml
# gateEnforcement=warn to downgrade these failures to warnings during rollout
# (default), or =error to enforce. See docs/harness-gate-migration.md.

gates:
  gate-requirements:
    phase: requirements
    timeout: 5m
    checks:
      - type: file-exists
        path: harness/specs/\${ACTIVE_FEATURE}/spec.md
      - type: spec-requirements
        path: harness/specs/\${ACTIVE_FEATURE}/spec.md
        minAcceptanceCriteria: 1
        allowUnresolvedClarifications: 0
      # Back-compat: keep the old "template-exists" check so projects that
      # haven't migrated their flow yet still see green at this gate. Remove
      # after v3.4.0 cutover.
      - type: file-exists
        path: harness/rules/architecture.md

  gate-design:
    phase: design
    timeout: 5m
    checks:
      - type: file-exists
        path: harness/specs/\${ACTIVE_FEATURE}/plan.md
      - type: file-exists
        path: harness/specs/\${ACTIVE_FEATURE}/tasks.md
      - type: spec-design
        featureId: \${ACTIVE_FEATURE}
        requireAcCoverage: true
        requireTasksDecomposed: true
        requireDataModel: optional
      # Back-compat (remove after v3.4.0):
      - type: file-exists
        path: harness/rules/architecture.md
      - type: file-exists
        path: harness/workflow/phases.yaml

  gate-test-spec:
    phase: test-spec
    timeout: 5m
    checks:
      - type: file-exists
        path: harness/specs/\${ACTIVE_FEATURE}/test-plan.md
      - type: test-spec-checklist
        path: harness/specs/\${ACTIVE_FEATURE}/test-plan.md
        tasksRef: harness/specs/\${ACTIVE_FEATURE}/tasks.md
        minFieldChars: 30
        requiredCategories:
          - happy-path
          - error-path
        requireAllTasksCovered: true
      # Back-compat (remove after v3.4.0):
      - type: file-exists
        path: harness/rules/coding.md

  gate-implementation:
    phase: implementation
    timeout: 15m
    checks:
      - type: tasks-status
        featureId: \${ACTIVE_FEATURE}
        requireAllDone: true
      - type: shell
        command: bun test
        expected_exit: 0
      - type: shell
        command: npm run typecheck
        expected_exit: 0

  gate-code-review:
    phase: code-review
    timeout: 10m
    checks:
      - type: shell
        command: bun test
        expected_exit: 0
      - type: shell
        command: eslint .
        expected_exit: 0
      - type: harness-lint

  gate-integration-test:
    phase: integration-test
    timeout: 15m
    checks:
      - type: shell
        command: bun test
        expected_exit: 0
      - type: unit-test
        expected:
          passing_ratio: ">=95%"

  gate-performance:
    phase: performance
    timeout: 15m
    checks:
      - type: shell
        command: bun test
        expected_exit: 0

  gate-security:
    phase: security
    timeout: 10m
    checks:
      - type: shell
        command: npm audit --audit-level=high
        expected_exit: 0
      - type: harness-lint

  gate-deploy-plan:
    phase: deploy-plan
    timeout: 5m
    checks:
      - type: file-exists
        path: harness/workflow/rollback.yaml

  gate-confirm:
    phase: confirm
    timeout: 15m
    checks:
      - type: metacoder-systest
`,

  'workflow/rollback.yaml': `version: 1

policy:
  max_consecutive_failures: 3
  human_approval_after_max: true
  audit_log: true

phases:
  implementation:
    on_gate_failure: rollback_to_test_spec
    cleanup:
      - revert_uncommitted_changes

  code-review:
    on_gate_failure: rollback_to_implementation
    cleanup:
      - create_fix_ticket

  integration-test:
    on_gate_failure: rollback_to_code_review
    cleanup:
      - preserve_test_report
      - notify_team

  security:
    on_gate_failure: rollback_to_performance
    cleanup:
      - preserve_audit_report
      - notify_security_team

  confirm:
    on_gate_failure: rollback_to_deploy_plan
    cleanup:
      - trigger_incident
`,

  'context/session.md': `# Session Context — Node.js Fastify

## Always Active

Injected at session start for every conversation.

## Project Stack

- Node.js 20+ LTS, Fastify 4.x, TypeScript 5, ESM modules
- ORM: Prisma (primary) or Knex
- Validation: Zod + fastify-type-provider-zod
- HTTP client: undici + p-retry + cockatiel
- Logging: Pino (Fastify built-in)
- Test: bun test + Testcontainers + WireMock

## Critical Rules (Never Violate)

1. Money = bigint (cents) or Decimal from decimal.js. Never number.
2. All imports use .js extension (ESM).
3. Zod schema defined for every route before implementation.
4. External HTTP calls: undici + p-retry + cockatiel + fallback.
5. No console.log; use Pino via request.log or app.log.
`,

  'context/phase-triggers.yaml': `version: 1

triggers:
  - phase: design
    load:
      - harness/rules/architecture.md

  - phase: implementation
    load:
      - harness/rules/coding.md
      - harness/skills/implement-by-layer.md
      - harness/agents/developer.md

  - phase: code-review
    load:
      - harness/skills/review.md
      - harness/agents/reviewer.md

  - phase: integration-test
    load:
      - harness/skills/test.md
      - harness/agents/tester.md
`,

  'context/on-demand-glossary.md': `# On-Demand Glossary — Node.js Fastify

## Terms

**bigint**: JavaScript native arbitrary-precision integer type.
Used for monetary values to avoid floating-point precision loss.
Literal syntax: \`100n\`. Operations: \`+\`, \`-\`, \`*\`, \`/\` (integer division).

**decimal.js Decimal**: Library for arbitrary-precision decimal arithmetic.
Used when fractional cents or non-integer monetary values are required.
Never mix with native \`number\` arithmetic.

**Fastify inject()**: Built-in test helper that simulates HTTP requests
without opening a real TCP socket. Fast and deterministic.

**Zod schema**: Runtime TypeScript validation library.
Schemas are the single source of truth for input/output types.

**cockatiel**: Circuit breaker + bulkhead + retry library for Node.js.
Wraps unstable external calls to prevent cascade failures.

**p-retry**: Promise-based retry with exponential backoff.
Used for transient HTTP/network failures.

**undici**: High-performance HTTP/1.1 client for Node.js (official Node.js project).
Always configure explicit connectTimeout and bodyTimeout.

**Testcontainers**: Docker-based real dependency instances for integration tests.
Preferred over SQLite/in-memory mocks for DB tests.
`,
}
