/**
 * Go 1.21+ hexagonal architecture harness template.
 *
 * Hexagonal (ports + adapters): domain ports (interfaces) + adapter implementations.
 * Covers shopspring/decimal or int64 money, fmt.Errorf %w error wrapping,
 * context.Context propagation, errgroup goroutine management, and log/slog structured logging.
 */

import type { Template } from '../index.js'
import { minimalTemplate } from '../minimal/index.js'

export const goMicroserviceTemplate: Template = {
  ...minimalTemplate,

  'rules/architecture.md': `# Architecture Rules — Go 1.21+ Microservice (Hexagonal)

## Package Layout

\`\`\`
cmd/
  <service>/
    main.go            # Wire-up only; zero business logic
internal/
  domain/              # Core: types, errors, port interfaces
    errors.go          # Sentinel errors via errors.New
    model.go           # Domain structs and value objects
    ports.go           # Port interfaces (Repository, ExternalClient)
  service/             # Use-case implementations — pure business logic
  handler/             # HTTP/gRPC handlers — I/O boundary only
  repository/          # Adapter: DB implementation of domain ports
  client/              # Adapter: external HTTP client implementations
  config/              # Environment config parsing
pkg/                   # Exported shared utilities (used by other services)
\`\`\`

## Hexagonal (Ports and Adapters) Rules

- \`domain/ports.go\` defines all interfaces (ports) the domain needs
- Implementations (adapters) live in \`repository/\` or \`client/\`
- \`service/\` depends only on interfaces defined in \`domain/\`; never on concrete adapters
- \`handler/\` depends on \`service/\` interfaces; never on \`repository/\` or \`client/\`
- Dependency wiring happens exclusively in \`cmd/<service>/main.go\`
- No global singletons except \`slog.Logger\` (accessed via \`context\` or passed explicitly)

## Interface Rules

- Every external dependency (DB, cache, external HTTP API) has a Go interface in \`domain/ports.go\`
- Interfaces defined where they are consumed (domain), not where implemented (adapter)
- Interface size: prefer small, focused interfaces (1–3 methods); compose when needed
- Accept interfaces, return concrete types (Go proverb)

## Error Handling

- Always return \`(T, error)\`; never panic in library/service code
- Wrap errors with context: \`fmt.Errorf("service.CreateOrder: %w", err)\`
- Sentinel errors: \`var ErrOrderNotFound = errors.New("order not found")\` in \`domain/errors.go\`
- Callers use \`errors.Is\` / \`errors.As\` — never string comparison
- \`handler/\` translates domain sentinel errors to HTTP status codes

## Context Rules

- Every public function that performs I/O must accept \`ctx context.Context\` as first parameter
- Timeouts set at call site: \`ctx, cancel := context.WithTimeout(ctx, 5*time.Second)\`
- Never set timeout inside the called function — caller decides deadline
- Always call \`cancel()\` via \`defer\` immediately after \`context.WithTimeout\`

## Concurrency Rules

- Goroutines tracked with \`golang.org/x/sync/errgroup\`
- No bare \`go func()\` without explicit lifecycle management
- Shared mutable state: \`sync.Mutex\` or \`sync.RWMutex\` as struct field, not global
- Channels: prefer \`errgroup\` for fan-out/fan-in patterns

## Go-Specific Conventions

- \`gofmt\` and \`golangci-lint\` must pass in CI (no exceptions)
- No \`init()\` functions with side effects
- Exported struct fields: PascalCase; unexported: camelCase
- JSON serialization tags required on all API-facing structs
- Tests: table-driven with \`t.Run\`; test files in same package (white-box testing)
`,

  'rules/coding.md': `# Coding Rules — Go 1.21+ Microservice

## Money / Price

- Integer cents: \`int64\` field named with \`Cents\` suffix (e.g., \`TotalPriceCents int64\`)
- Non-integer precision: \`github.com/shopspring/decimal\` (\`decimal.Decimal\`)
- Never use \`float32\` or \`float64\` for monetary values — binary precision loss
- Arithmetic on int64 cents: standard \`+\`, \`-\`, \`*\`; division requires explicit rounding
- Arithmetic on Decimal: \`Add\`, \`Sub\`, \`Mul\`, \`Div\` methods; \`Round\` for display
- Currency stored alongside amount (either as struct pair or Money value object)
- DB column: \`BIGINT\` for int64 cents; \`NUMERIC(12,2)\` for Decimal

## Error Wrapping

- \`fmt.Errorf("package.FunctionName: %w", err)\` for all error wrapping
- Sentinel errors defined in \`domain/errors.go\`:
  \`var ErrNotFound = errors.New("not found")\`
- Callers: \`errors.Is(err, domain.ErrNotFound)\` — never string matching
- Never discard errors: \`_ =\` only with explicit comment explaining why
- Repository errors: wrap DB driver errors with domain context before returning

## Context Propagation

\`\`\`go
// Correct: caller sets timeout
func (s *OrderService) CreateOrder(ctx context.Context, req CreateOrderRequest) (*Order, error) {
    // ctx deadline inherited from caller; service does not add its own
    result, err := s.repo.Insert(ctx, req)
    ...
}

// Correct: adapter uses context for DB call
func (r *OrderRepository) Insert(ctx context.Context, order *domain.Order) error {
    _, err := r.db.ExecContext(ctx, insertSQL, order.ID, order.TotalPriceCents)
    return fmt.Errorf("repository.Insert: %w", err)
}
\`\`\`

Every public I/O function: \`ctx context.Context\` as first parameter (no exceptions).

## Goroutine Management

\`\`\`go
g, ctx := errgroup.WithContext(ctx)
g.Go(func() error {
    return processItem(ctx, item)
})
if err := g.Wait(); err != nil {
    return fmt.Errorf("parallel processing: %w", err)
}
\`\`\`

- Never use bare \`go func()\` in service or repository code
- Always \`g.Wait()\` before returning from the spawning function
- Goroutine leaks: use \`goleak\` in tests to detect

## Logging (log/slog)

- Use \`log/slog\` (Go 1.21 standard library); never \`fmt.Println\` or third-party logger
- Structured: \`slog.InfoContext(ctx, "order.created", "orderId", id, "userId", uid)\`
- Context-aware: always pass \`ctx\` to enable trace propagation
- PII masking: email, phone, token through \`maskPII()\` before any slog call
- Log levels: Error = human intervention, Warn = abnormal/auto-recovering,
  Info = business event, Debug = dev only (controlled by \`LOGLEVEL\` env var)

## External HTTP Calls

Every external HTTP call must include:
1. Timeout — \`http.Client\` with explicit \`Timeout\` field (no \`http.DefaultClient\`)
2. Retry — custom retry loop or \`hashicorp/go-retryablehttp\`, max 3 attempts, exponential backoff
3. Circuit Breaker — \`sony/gobreaker\` or \`failsafe-go\` wrapping the call
4. Fallback — cached response or safe empty default on circuit open

## Tests

- Table-driven tests with \`t.Run\`; test data in \`[]struct{...}\` slice
- White-box testing: test files in same package as source
- Use \`testing.T\` and standard \`testify/assert\` for assertions
- Run with race detector: \`go test ./... -race\`
- Coverage: \`go test ./... -cover\`; target ≥ 80% line
- Integration tests: build tag \`//go:build integration\`; run separately

## Go Modules

- \`go.sum\` committed; \`go mod tidy\` run after any dependency change
- Avoid indirect dependencies where direct equivalents exist
- Vendor: \`go mod vendor\` used if CI has no internet access

## Static Analysis (CI Required)

- \`go vet ./...\` — must pass on every commit
- \`golangci-lint run\` — aggregated linter; config in \`.golangci.yml\` at repo root
- \`govulncheck ./...\` — vulnerability scanner; run before each release
- \`gofmt -l .\` — must produce no output (all files formatted)
`,

  'rules/workflow.md': `# Workflow Rules — Go Microservice

## 10-Phase Pipeline

| Phase | Entry Condition | Exit Condition | Rollback Trigger |
|-------|----------------|----------------|-----------------|
| 1. Requirements | Stakeholder approval | Requirements doc v1 | Scope ambiguity |
| 2. Design | Phase 1 done | ADR + interface design | Architecture conflict |
| 3. Test Spec | Phase 2 done | Test plan with table-test cases | Coverage targets missing |
| 4. Implementation | Phase 3 done | Code + tests pass with race | \`go test -race\` fails |
| 5. Code Review | Phase 4 done | Reviewer APPROVE | Interface violation |
| 6. Integration Test | Phase 5 done | All handlers pass | Critical bug |
| 7. Performance | Phase 6 done | Benchmark within SLA | Latency regression |
| 8. Security | Phase 7 done | \`govulncheck\` + \`golangci-lint\` clean | CVE found |
| 9. Deploy Plan | Phase 8 done | Runbook confirmed | Procedure incomplete |
| 10. Confirm | Phase 9 done | Production smoke test passes | Fatal error |

## Gate Standard

All gates verified via \`go test ./... -race -cover\`, \`go vet ./...\`, \`golangci-lint run\`.

## Rollback Policy

- Phases 4–10: gate failure triggers rollback to previous phase
- Three consecutive failures: require human approval
- All rollbacks recorded in audit log
`,

  'skills/plan.md': `# Planning SOP — Go Microservice

## Purpose

Produce a structured plan before writing any Go code.
Prevents context leaks, goroutine leaks, and missing interface definitions.

## Step 1: Requirements Decomposition

1. Identify bounded context and affected domain types
2. List new port interfaces needed in \`domain/ports.go\`
3. Identify new HTTP handlers and their I/O contracts
4. List external dependencies requiring adapter implementation

## Step 2: Architecture Impact

1. Verify all new dependencies flow inward (handler → service → domain)
2. Confirm no import cycles (\`go build ./...\` will catch)
3. Plan error sentinel values for new failure modes
4. Identify goroutine patterns needed (fan-out, pipeline, etc.)

## Step 3: Risk Identification

- Money fields: confirm \`int64\` cents or \`shopspring/decimal\` — no float
- Context deadlines: identify which operations need timeout and at what level
- Goroutine lifecycle: plan errgroup usage for any concurrent work
- Race conditions: identify shared mutable state requiring mutex

## Step 4: Test Planning

1. List table-driven test cases (minimum 5 per exported function)
2. Plan integration test build tag and DB setup
3. Identify goroutine leak tests (use goleak)

## Step 5: Sequence

domain types + errors + port interfaces → repository adapter → service → handler → integration test
`,

  'skills/implement-by-layer.md': `# Implement By Layer SOP — Go Microservice

## Purpose

Implement features through the hexagonal architecture, with each layer
independently testable before the next is written.

## Prerequisites

- Interface design in \`domain/ports.go\` reviewed
- \`go test ./... -race\` green on existing tests
- \`golangci-lint run\` clean before starting

## Step 1: Domain Layer

1. Define domain structs in \`domain/model.go\` with JSON tags
2. Define sentinel errors in \`domain/errors.go\`: \`var ErrFoo = errors.New("...")\`
3. Define port interfaces in \`domain/ports.go\`
4. Money: \`int64\` cents field with \`Cents\` suffix or \`decimal.Decimal\` field
5. Write pure unit tests — zero external dependencies
6. Run: \`go test ./internal/domain/... -race\`

## Step 2: Repository Adapter

1. Implement \`domain/ports.go\` Repository interface in \`repository/\`
2. Every method: accept \`ctx context.Context\` as first param
3. Wrap DB errors: \`fmt.Errorf("repository.Insert: %w", err)\`
4. Money: map \`int64\` cents to \`BIGINT\` DB column
5. Write tests with testcontainers-go or test DB
6. Run: \`go test ./internal/repository/... -race\`

## Step 3: Service Layer

1. Create service struct in \`service/\`; inject domain interfaces via constructor
2. Every method: \`ctx context.Context\` first param; propagate to all I/O calls
3. Goroutines: use \`errgroup\` for any concurrent work
4. Money arithmetic: \`int64\` arithmetic or \`decimal.Decimal\` — consistent per ADR
5. Write unit tests with mock implementations of domain ports
6. Run: \`go test ./internal/service/... -race\`

## Step 4: Handler Layer

1. Create HTTP handler struct in \`handler/\`; inject service interface
2. Parse and validate request; call service; serialize response
3. Translate domain sentinel errors to HTTP status codes
4. Set \`context.WithTimeout\` at handler entry for overall request deadline
5. Write tests using \`net/http/httptest\`
6. Run: \`go test ./internal/handler/... -race\`

## Step 5: Wire-Up and Integration

1. Wire all adapters in \`cmd/<service>/main.go\`
2. Write integration tests with \`//go:build integration\` tag
3. Run: \`go test ./... -race -cover -tags integration\`
4. Run: \`go vet ./...\` + \`golangci-lint run\`

## Forbidden

- Panicking in any code path except \`main.go\` startup validation
- Using \`float64\` for monetary values
- Bare \`go func()\` without errgroup or explicit lifecycle management
- Missing \`ctx\` parameter on any public I/O function
`,

  'skills/review.md': `# Review SOP — Go Microservice

## Purpose

Verify implementation is production-ready before advancing to the next phase.

## Architecture Checklist

- [ ] No import cycles (\`go build ./...\` passes)
- [ ] All dependencies flow inward: handler → service → domain ← repository
- [ ] Port interfaces defined in \`domain/ports.go\`; implementations in adapters
- [ ] No global mutable state except \`slog.Logger\`
- [ ] Dependency wiring only in \`cmd/<service>/main.go\`

## Coding Standards Checklist

- [ ] Money: \`int64\` cents or \`shopspring/decimal\` — no float
- [ ] Every I/O function accepts \`ctx context.Context\` as first param
- [ ] Errors wrapped with \`fmt.Errorf("...: %w", err)\`; sentinels in \`domain/errors.go\`
- [ ] No bare \`go func()\` — all goroutines use errgroup
- [ ] \`slog\` structured logging; no \`fmt.Println\`
- [ ] PII masked before logging
- [ ] External HTTP clients use explicit timeout + retry + circuit breaker

## Test Checklist

- [ ] \`go test ./... -race\` passes
- [ ] \`go test ./... -cover\` reports ≥ 80% coverage
- [ ] Table-driven tests with \`t.Run\`
- [ ] \`goleak.VerifyNone(t)\` in tests that spawn goroutines
- [ ] Integration tests tagged with \`//go:build integration\`

## Static Analysis Checklist

- [ ] \`go vet ./...\` clean
- [ ] \`golangci-lint run\` clean (no errors, no warnings)
- [ ] \`govulncheck ./...\` clean (no known CVEs)

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

  'skills/test.md': `# Test SOP — Go Microservice

## Test Pyramid

- Unit tests (70%): pure Go, no I/O, mock port interfaces
- Handler tests (20%): \`net/http/httptest\`, mock services
- Integration tests (10%): \`//go:build integration\`, real DB + testcontainers-go

## Unit Test Standard

1. Table-driven: \`[]struct{ name string; input ...; want ... }\` with \`t.Run\`
2. Minimum 5 cases: happy path, nil/zero input, boundary, error, concurrent
3. Mock port interfaces using hand-written stubs or \`gomock\`
4. Run with race detector: \`go test ./... -race\`
5. goleak: \`defer goleak.VerifyNone(t)\` in tests involving goroutines

## Handler Test Standard

1. Use \`net/http/httptest.NewRecorder()\` and \`httptest.NewRequest()\`
2. Assert: status code, Content-Type, response JSON shape
3. Test error cases: domain sentinel errors map to correct HTTP status
4. No real DB or external HTTP; inject mock services

## Integration Test Standard

1. Build tag: \`//go:build integration\` at top of file
2. Start real DB via testcontainers-go
3. Run full request lifecycle: HTTP → handler → service → repository → DB
4. Assert DB state after mutations
5. Run: \`go test ./... -race -tags integration\`

## Benchmarks

- Benchmark money arithmetic if used in hot paths: \`func BenchmarkFoo(b *testing.B)\`
- Run: \`go test ./... -bench=. -benchmem\`
- Baseline and compare before/after performance changes

## Coverage Gate

Run \`go test ./... -cover -coverprofile=coverage.out\`.
\`go tool cover -func=coverage.out | grep total\` must show ≥ 80%.
`,

  'agents/pm.md': `# Agent: Project Manager — Go Microservice

## Identity

You are a senior technical PM experienced in Go microservice systems.
You understand Go module lifecycle, interface contract stability,
and goroutine leak risks in production.

## Responsibilities

- Own requirements doc and ADR index; particularly interface contracts
- Gate phase transitions; reject if \`go test ./... -race\` or \`golangci-lint run\` fails
- Track external dependency CVEs as security risk items
- Ensure money field type (int64 cents vs Decimal) decided in ADR before implementation

## Phase Gate Authority

- Approve transition only when \`go test ./... -race -cover\` + \`go vet\` + \`golangci-lint run\` all pass
- Require \`govulncheck ./...\` clean before Phase 8
`,

  'agents/developer.md': `# Agent: Developer — Go 1.21+ Microservice

## Identity

You are a senior Go engineer writing idiomatic, production-grade microservices.
You follow the hexagonal architecture and every rule in \`harness/rules/coding.md\`.

## Implementation Order

domain types + ports → repository adapter → service → handler → wire-up → integration test.
Never write handler code before service tests pass with race detector.

## Go Idioms

- Accept interfaces, return concrete types
- Errors are values — check every error return
- Make zero value useful where possible
- Prefer composition over inheritance (embed interfaces)

## Money Rules (Non-Negotiable)

- \`int64\` cents for simple monetary values; \`shopspring/decimal\` for non-integer precision
- Never \`float32\` or \`float64\` for money
- Document currency unit in field comment and field name suffix

## Context Rules

- Every exported I/O function: \`ctx context.Context\` first parameter
- Set deadline at call site; never inside the called function
- Always \`defer cancel()\` immediately after \`context.WithTimeout\`

## Output Format

Produce files in order:
1. \`domain/model.go\` + \`domain/errors.go\` + \`domain/ports.go\` + unit tests
2. \`repository/<name>.go\` + testcontainers integration test
3. \`service/<name>.go\` + mock unit tests (with race detector)
4. \`handler/<name>.go\` + httptest tests
5. \`cmd/<service>/main.go\` wire-up
`,

  'agents/reviewer.md': `# Agent: Reviewer — Go Microservice

## Identity

You are a principal Go engineer focused on hexagonal architecture correctness,
goroutine safety, and error wrapping hygiene.

## Primary Review Concerns

1. Import direction — does any adapter import \`service/\` directly?
2. Missing \`ctx\` — does any I/O function lack \`context.Context\` first param?
3. Bare goroutines — any \`go func()\` without errgroup?
4. Money types — any \`float\` used for monetary values?
5. Error wrapping — is \`%w\` used consistently? Are sentinels in \`domain/errors.go\`?

## Review Process

1. Run \`go test ./... -race\` — must pass
2. Run \`go vet ./...\` — must pass
3. Run \`golangci-lint run\` — must pass
4. Check \`govulncheck ./...\` — no known CVEs
5. Inspect all \`go func()\` usages for errgroup pattern
6. Verify \`context.Context\` propagation through call chain

## Verdict Rules

- REJECT: float for money, missing ctx param, bare goroutine, import cycle
- APPROVE-WITH-FIXES: suboptimal error message, missing t.Run subtests
- APPROVE: all checks clean, race detector passes
`,

  'agents/tester.md': `# Agent: Tester — Go Microservice

## Identity

You are a senior QA engineer specializing in Go table-driven tests,
race detector usage, and testcontainers-go integration testing.

## Test Strategy

- Unit: pure Go, mock interfaces, race detector always on
- Handler: net/http/httptest, mock services
- Integration: \`//go:build integration\` + testcontainers-go real DB

## Entry Criteria

- \`go test ./... -race\` passes before integration tests written
- testcontainers-go image version matches production DB version
- goleak dependency added for goroutine leak detection

## Test Case Specification

\`\`\`go
// Table-driven test format
tests := []struct {
    name    string
    input   InputType
    want    OutputType
    wantErr error
}{
    {name: "happy_path", ...},
    {name: "zero_amount", ...},
    {name: "not_found", wantErr: domain.ErrNotFound},
}
for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) { ... })
}
\`\`\`

## Money Test Policy

Every function handling money must test:
- Zero amount (0 cents / Decimal zero)
- Maximum int64 cents value
- Arithmetic that would overflow float64 precision
- Currency unit consistency (no unit mismatch)

## Goroutine Leak Policy

Any test that triggers goroutine creation must include:
\`\`\`go
defer goleak.VerifyNone(t)
\`\`\`

## Coverage Gate

\`go test ./... -cover -coverprofile=coverage.out\`
Total coverage must be ≥ 80%.
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
        command: go test ./... -race -cover
        expected_exit: 0
      - type: shell
        command: go vet ./...
        expected_exit: 0

  gate-code-review:
    phase: code-review
    timeout: 10m
    checks:
      - type: shell
        command: go test ./... -race -cover
        expected_exit: 0
      - type: shell
        command: golangci-lint run
        expected_exit: 0
      - type: harness-lint

  gate-integration-test:
    phase: integration-test
    timeout: 20m
    checks:
      - type: shell
        command: go test ./... -race -cover -tags integration
        expected_exit: 0
      - type: unit-test
        expected:
          passing_ratio: ">=95%"

  gate-performance:
    phase: performance
    timeout: 15m
    checks:
      - type: shell
        command: go test ./... -race -cover
        expected_exit: 0

  gate-security:
    phase: security
    timeout: 10m
    checks:
      - type: shell
        command: govulncheck ./...
        expected_exit: 0
      - type: shell
        command: golangci-lint run
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
      - preserve_vulncheck_report
      - notify_security_team

  confirm:
    on_gate_failure: rollback_to_deploy_plan
    cleanup:
      - trigger_incident
`,

  'context/session.md': `# Session Context — Go Microservice

## Always Active

Injected at session start for every conversation.

## Project Stack

- Go 1.21+, standard library first
- Architecture: Hexagonal (ports + adapters)
- DB: PostgreSQL via pgx/v5
- HTTP: net/http + gorilla/mux or chi
- Logging: log/slog (Go 1.21 standard)
- Resilience: sony/gobreaker or failsafe-go
- Test: testing + testify/assert + testcontainers-go + goleak

## Critical Rules (Never Violate)

1. Money = int64 cents OR shopspring/decimal. Never float32/float64.
2. Every public I/O function: ctx context.Context first parameter.
3. Errors wrapped with fmt.Errorf("...: %w", err). Sentinels in domain/errors.go.
4. No bare go func(); always errgroup.
5. No import cycles. Dependency direction: handler → service → domain ← repository.
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

  'context/on-demand-glossary.md': `# On-Demand Glossary — Go Microservice

## Terms

**int64 cents**: Integer representation of monetary values in smallest currency unit.
Avoids floating-point precision loss. Field names end in "Cents".

**shopspring/decimal**: Go library for arbitrary-precision decimal arithmetic.
Use when fractional cents or non-integer precision is required.

**errgroup**: golang.org/x/sync/errgroup — manages a group of goroutines
and collects the first non-nil error. Preferred over bare go func().

**context.Context**: Carries deadlines, cancellation signals, and request-scoped values.
First parameter of every I/O function. Timeout set by caller, not callee.

**Port (Hexagonal)**: An interface defined in the domain package representing
a capability the domain needs (e.g., OrderRepository, EmailSender).

**Adapter (Hexagonal)**: A concrete implementation of a port interface
(e.g., PostgresOrderRepository, SendgridEmailSender).

**goleak**: Test utility for detecting goroutine leaks in Go tests.
Use: defer goleak.VerifyNone(t)

**govulncheck**: Official Go vulnerability scanner from the Go team.
Checks module dependencies against the Go vulnerability database.

**golangci-lint**: Aggregated Go linter running 50+ linters in one pass.
Configuration in .golangci.yml at repo root.

**%w verb**: fmt.Errorf wrapping verb that allows errors.Is and errors.As
to unwrap the error chain. Always use %w (not %v) when wrapping errors.
`,
}
