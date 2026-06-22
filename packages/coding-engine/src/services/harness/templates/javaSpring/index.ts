/**
 * Java 21 + Spring Boot 3 enterprise harness template.
 *
 * 5-layer DDD architecture: Controller → Service → Domain → Repository → Infrastructure.
 * Covers Lombok conventions, JPA transaction rules, BigDecimal money handling,
 * SLF4J/MDC structured logging, and Spring profile guards.
 */

import type { Template } from '../index.js'
import { minimalTemplate } from '../minimal/index.js'

export const javaSpringTemplate: Template = {
  ...minimalTemplate,

  'rules/architecture.md': `# Architecture Rules — Java 21 / Spring Boot 3

## 5-Layer Architecture

### Layer 1: Controller (API)
- Annotated with \`@RestController\` + \`@RequestMapping\`
- Responsibilities: HTTP binding, input validation via \`@Validated\`, DTO ↔ Service boundary
- Forbidden: business logic, direct Repository injection, \`@Transactional\`
- Every endpoint returns \`ResponseEntity<T>\`; never raw objects
- Exception mapping handled by \`@ControllerAdvice\` — do not catch in controller

### Layer 2: Service
- Annotated with \`@Service\`
- Read operations: \`@Transactional(readOnly = true)\` on the method
- Write operations: separate \`@Service\` method with default \`@Transactional\`
- Responsibilities: use-case orchestration, domain rule enforcement
- Forbidden: HTTP types (\`HttpServletRequest\`), raw SQL, direct external API calls

### Layer 3: Domain
- Plain Java 21 records or classes — zero Spring/JPA annotations
- Responsibilities: invariants, value objects, domain events, business rules
- Forbidden: any framework import (Spring, Hibernate, Jackson)
- Use \`sealed\` classes + \`permits\` for closed type hierarchies
- Value objects are immutable; use \`@Value\` (Lombok) or Java records

### Layer 4: Repository
- Interface extends \`JpaRepository<Entity, ID>\` or \`CrudRepository\`
- Annotated with \`@Repository\` on implementation classes only
- Custom queries: JPQL preferred; native SQL only with explicit comment justifying it
- Forbidden: business logic, \`@Transactional\` (delegate to Service)
- Projections via interface-based Spring Data Projections for read models

### Layer 5: Infrastructure
- External HTTP clients, message brokers, cache adapters, storage clients
- Must implement domain-defined interfaces (Dependency Inversion Principle)
- Every external call: timeout + retry + circuit breaker + fallback (4-point set)
- Annotated beans: \`@Component\` + \`@Profile("!test")\` where real vs. stub differs
- \`@Profile("!production")\` on beans that must not run in production

## Spring Bean Rules

- Constructor injection only — \`@Autowired\` on fields is forbidden
- \`@Configuration\` classes live in \`config/\` package; one class per concern
- \`@PostConstruct\` with I/O side effects is forbidden; use \`ApplicationReadyEvent\`
- \`@Conditional\` variants preferred over runtime \`if (env.equals("prod"))\` checks
- Prototype-scoped beans require explicit documentation explaining the lifecycle choice

## Module (Package) Responsibilities

Each package must be describable in a single sentence covering:
1. Domain responsibility it owns
2. Layer it belongs to
3. Public API (interfaces or \`@RestController\` endpoints)

Layer crossing: Controller → Service → Domain ← Repository ← Infrastructure.
Lower layers never import upper layers. Domain has zero outward imports.

## File Size & Naming

- Java class files: ≤ 300 lines; split using composition not inheritance
- DTOs: suffix \`Request\` / \`Response\` (e.g., \`CreateOrderRequest\`)
- Service interfaces: suffix \`Service\`; implementations suffix \`ServiceImpl\` only if no better name
- Mappers: use MapStruct; never hand-write field-copy loops in Service
`,

  'rules/coding.md': `# Coding Rules — Java 21 / Spring Boot 3

## Money / Price

- Monetary values: \`BigDecimal\` with \`setScale(2, RoundingMode.HALF_EVEN)\`
- Never use \`double\` or \`float\` for money — floating-point precision loss is unacceptable
- Field naming: suffix \`Amount\` or \`Price\` and document the currency (e.g., \`totalAmountUsd\`)
- Comparisons: always \`bigDecimal.compareTo(other) == 0\`; never \`.equals()\` without scale check
- Arithmetic: chain via \`BigDecimal\` operations; avoid converting to \`long\` cents mid-calculation

## Lombok Usage

- \`@Value\` — immutable value objects (generates \`final\` fields + all-args constructor)
- \`@Data\` — mutable DTOs only; never on domain entities
- \`@Builder\` — complex construction; pair with \`@AllArgsConstructor(access = PRIVATE)\`
- \`@Slf4j\` — all classes that log; never instantiate \`Logger\` manually
- \`@EqualsAndHashCode(callSuper = false)\` — document why \`callSuper\` is false when used
- Forbidden on JPA entities: \`@Data\`, \`@EqualsAndHashCode\` (causes proxy issues)

## JPA / Hibernate

- \`@Transactional(readOnly = true)\` on all query methods in Service
- Write transactions: own \`@Transactional\` method, never nested within read-only
- Fetch strategy: LAZY by default; EAGER only with explicit justification comment
- N+1 prevention: use \`JOIN FETCH\` or \`@EntityGraph\` — never call collection inside loop
- \`ddl-auto\`: never \`create\` or \`create-drop\` outside of integration test context
- Migrations via Flyway; naming: \`V{version}__{description}.sql\`

## Logging (SLF4J + MDC)

- Use \`@Slf4j\` (Lombok) — \`log.info(...)\`, \`log.error(...)\`
- Structured logging: always include key=value context, not just a message string
- MDC: set \`requestId\`, \`userId\`, \`traceId\` at the entry point (filter/interceptor)
- PII masking: email, phone, SSN must pass through \`PiiMasker.mask()\` before any log call
- Log levels:
  - ERROR = requires human intervention, always include exception
  - WARN = abnormal but auto-recoverable
  - INFO = business event (order placed, payment processed)
  - DEBUG = development detail; \`@Profile("!production")\` guard recommended

## Exception Hierarchy

- \`*BusinessException extends RuntimeException\` — maps to HTTP 4xx; include error code field
- \`*SystemException extends RuntimeException\` — maps to HTTP 5xx; wraps root cause
- Never catch bare \`Exception\` or \`Throwable\` without re-throw or explicit documented reason
- \`@ControllerAdvice\` class handles mapping to \`ProblemDetail\` (RFC 9457)
- Stack traces: always log server-side via SLF4J; never include in API response body

## Spring Profiles

- \`@Profile("!production")\` on dev/test-only beans (mock clients, seed data loaders)
- \`@Profile("integration-test")\` for beans used only in \`@SpringBootTest\` context
- Never check profile name via string comparison at runtime in business code
- \`application-{profile}.yaml\` for environment config; no secrets in version control

## External API Calls

Every external call must include all four:
1. Timeout — set explicitly on \`RestClient\` / \`WebClient\` builder (no default reliance)
2. Retry — Spring Retry \`@Retryable\` with exponential backoff, max 3 attempts
3. Circuit Breaker — Resilience4j \`@CircuitBreaker\` with \`fallbackMethod\`
4. Fallback — degrade strategy: cached response or safe empty default

## Tests

- Unit tests: JUnit 5 + Mockito; one test class per production class
- Minimum 5 test cases: happy path + null input + boundary + error path + idempotency
- Integration tests: \`@SpringBootTest\` + Testcontainers for real DB; every endpoint covered
- Coverage targets: line ≥ 80%, branch ≥ 70% (enforced by JaCoCo in CI)
- Test naming: \`methodName_stateUnderTest_expectedBehavior()\`
`,

  'rules/workflow.md': `# Workflow Rules — Java 21 / Spring Boot 3

## 10-Phase Pipeline

| Phase | Entry Condition | Exit Condition | Rollback Trigger |
|-------|----------------|----------------|-----------------|
| 1. Requirements | Stakeholder sign-off | Requirements doc v1 approved | Scope ambiguity |
| 2. Design | Phase 1 done | ADR + package diagram | Architecture conflict |
| 3. Test Spec | Phase 2 done | Test plan with coverage targets | Coverage targets not defined |
| 4. Implementation | Phase 3 done | Code + unit tests passing | \`mvn -B test\` fails |
| 5. Code Review | Phase 4 done | Reviewer APPROVE | Architecture violation |
| 6. Integration Test | Phase 5 done | All endpoints pass Testcontainers | Critical bug |
| 7. Performance | Phase 6 done | p99 latency within SLA | Latency regression |
| 8. Security | Phase 7 done | SpotBugs + OWASP Dependency Check clean | CVE found |
| 9. Deploy Plan | Phase 8 done | Runbook + rollback script confirmed | Procedure incomplete |
| 10. Confirm | Phase 9 done | Production smoke test passes | Fatal error |

## Gate Standard

Every gate must be:
1. Programmatically verifiable (Maven exit code 0)
2. Idempotent (re-running produces same result)
3. Time-bounded (complete within timeout)
4. Logged with failure root cause

## Rollback Policy

- Phases 4–10: gate failure triggers rollback to previous phase
- Three consecutive failures at same phase: require human approval
- All rollbacks recorded in audit log with reason + attempt count

## Maven Build Rules

- Always use \`mvn -B\` (batch mode, no color codes) in CI
- \`mvn verify\` runs: compile → test → integration-test → package → verify
- SpotBugs and Checkstyle must pass as part of \`verify\`
- Never skip tests: \`-DskipTests\` is forbidden in CI pipelines
`,

  'skills/plan.md': `# Planning SOP — Java 21 / Spring Boot 3

## Purpose

Produce a structured implementation plan before writing any code.
Planning prevents layer violations and N+1 query surprises.

## Step 1: Requirements Decomposition

1. Read the feature request and extract bounded context(s) affected
2. Identify which of the 5 layers need new or changed classes
3. List domain entities and value objects introduced or modified
4. Note any new external API calls or DB tables required

## Step 2: Architecture Impact

1. Draw the package dependency graph (text diagram is sufficient)
2. Verify no new upward imports (lower → upper layer) are introduced
3. Identify if a new \`@Configuration\` class is needed
4. List required DB migrations (Flyway script names)

## Step 3: Risk Identification

- Money fields: confirm \`BigDecimal\` with correct scale used throughout
- JPA relations: identify potential N+1 and plan \`JOIN FETCH\` or \`@EntityGraph\`
- External APIs: confirm 4-point set (timeout/retry/CB/fallback) for each new call
- Transactions: confirm read-only vs. write transaction boundaries

## Step 4: Test Planning

1. List unit test cases (minimum 5 per new class)
2. List integration test endpoints (happy + error path per endpoint)
3. Confirm Testcontainers image version for DB

## Step 5: Estimate & Sequence

1. Sequence implementation: Domain → Repository interface → Service → Controller → Infrastructure
2. Estimate test coverage achievable
3. Flag any items needing tech lead review before implementation

## Output

A markdown plan including: entity list, layer impact table, risk table, test case list.
`,

  'skills/implement-by-layer.md': `# Implement By Layer SOP — Java 21 / Spring Boot 3

## Purpose

Implement features strictly bottom-up through the 5-layer architecture to
prevent layer violations and ensure each layer is testable in isolation.

## Prerequisites

- Phase 2 (Design) ADR approved
- \`harness/rules/architecture.md\` and \`rules/coding.md\` read
- Flyway migration script written and verified

## Step 1: Domain Layer

1. Define domain entities as Java records or immutable classes (zero Spring imports)
2. Define value objects with \`@Value\` (Lombok) or Java records
3. Implement invariant checks in constructors; throw \`*BusinessException\` on violation
4. Write unit tests — no mocks needed; pure Java
5. Run: \`mvn -B test -pl domain\`; must be green before proceeding

## Step 2: Repository Layer

1. Define repository interface extending \`JpaRepository<Entity, ID>\`
2. Add custom JPQL query methods with \`@Query\`; annotate native SQL with justification comment
3. Write unit tests using \`@DataJpaTest\` + H2 (or Testcontainers for dialect-specific features)
4. Verify no business logic leaks into repository methods
5. Run: \`mvn -B test -Dtest=*RepositoryTest\`

## Step 3: Service Layer

1. Create \`@Service\` class; inject repository via constructor
2. Read methods: annotate with \`@Transactional(readOnly = true)\`
3. Write methods: separate methods with default \`@Transactional\`
4. Money arithmetic: use \`BigDecimal\` + \`setScale(2, RoundingMode.HALF_EVEN)\` throughout
5. Write unit tests with Mockito mocks for repository
6. Run: \`mvn -B test -Dtest=*ServiceTest\`

## Step 4: Controller Layer

1. Create \`@RestController\`; inject service via constructor
2. Define \`@Validated\` request DTOs with Bean Validation annotations
3. Map service results to response DTOs via MapStruct mapper
4. Exception mapping: verify \`@ControllerAdvice\` handles all new exceptions
5. Write \`@WebMvcTest\` slice tests for every endpoint (happy + error paths)
6. Run: \`mvn -B test -Dtest=*ControllerTest\`

## Step 5: Infrastructure Layer

1. Implement external API clients; wrap with Resilience4j \`@CircuitBreaker\`
2. Set explicit timeouts on \`RestClient\` or \`WebClient\` builders
3. Add \`@Retryable\` with exponential backoff for transient failures
4. Write integration tests using Testcontainers (real DB + WireMock for HTTP stubs)
5. Run: \`mvn -B verify\`; all tests + SpotBugs + Checkstyle must pass

## Forbidden During Implementation

- Committing code that fails \`mvn -B test\`
- Skipping layer: never write Controller logic before Service tests pass
- Importing upper layer from lower layer
- Using \`double\` / \`float\` for any monetary calculation
`,

  'skills/review.md': `# Review SOP — Java 21 / Spring Boot 3

## Purpose

Verify that implementation is production-ready before advancing to the next phase.

## Architecture Checklist

- [ ] No layer violations: Controller does not call Repository; Domain has no Spring imports
- [ ] Constructor injection used throughout (no \`@Autowired\` fields)
- [ ] No upward imports (lower layer importing upper layer)
- [ ] New \`@Configuration\` classes live in \`config/\` package

## Coding Standards Checklist

- [ ] All monetary fields use \`BigDecimal\` with \`setScale(2, RoundingMode.HALF_EVEN)\`
- [ ] No \`double\` or \`float\` used anywhere for monetary values
- [ ] \`@Transactional(readOnly = true)\` on all read-only Service methods
- [ ] N+1 queries eliminated (verify with \`hibernate.show_sql=true\` in test logs)
- [ ] Lombok: \`@Data\` absent from JPA entities; \`@Slf4j\` used for all logging
- [ ] MDC populated at entry point (\`requestId\`, \`userId\`, \`traceId\`)
- [ ] PII masked before logging
- [ ] All new external API calls have 4-point set (timeout/retry/CB/fallback)
- [ ] Exception hierarchy: \`*BusinessException\` for 4xx, \`*SystemException\` for 5xx
- [ ] \`@Profile("!production")\` on all dev/test-only beans

## Test Checklist

- [ ] Minimum 5 unit test cases per new class
- [ ] \`@SpringBootTest\` integration test covers all new endpoints
- [ ] Testcontainers used for DB-dependent integration tests
- [ ] JaCoCo report: line ≥ 80%, branch ≥ 70%
- [ ] Test naming follows \`methodName_state_expectedBehavior()\` convention

## Security Checklist

- [ ] No secrets in code or \`application.yaml\` (use environment variable references)
- [ ] Input validated at Controller boundary with Bean Validation
- [ ] SQL injection impossible (JPQL or parameterized native SQL only)
- [ ] SpotBugs clean (run \`mvn spotbugs:check\`)

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

| Verdict | Condition |
|---------|-----------|
| APPROVE | 0 errors, 0 warnings |
| APPROVE-WITH-FIXES | 0 errors, ≤ 3 warnings |
| REJECT | ≥ 1 error, architecture violation, or BigDecimal rule broken |
`,

  'skills/test.md': `# Test SOP — Java 21 / Spring Boot 3

## Test Pyramid

- Unit tests (70%): pure Java, no Spring context, Mockito for dependencies
- Slice tests (20%): \`@WebMvcTest\` for controllers, \`@DataJpaTest\` for repositories
- Integration tests (10%): \`@SpringBootTest\` + Testcontainers

## Unit Test Standard

1. One test class per production class (co-located in \`src/test/java\`)
2. Minimum 5 cases: happy path, null/empty input, boundary, error, idempotency
3. Use \`@ExtendWith(MockitoExtension.class)\`; inject mocks via constructor
4. Assert on behavior, not implementation: verify outcomes, not internal calls
5. Run: \`mvn -B test -Dtest=!*IT,!*IntegrationTest\`

## Slice Test Standard

- \`@WebMvcTest\`: test HTTP binding, validation errors, response status codes
- \`@DataJpaTest\`: test query correctness; use \`@Sql\` for fixture data
- Use \`MockMvc\` for HTTP assertions; verify \`Content-Type\` and response body shape

## Integration Test Standard

1. Class name suffix: \`*IT.java\`; run via \`mvn -B verify -Pfailsafe\`
2. Testcontainers: PostgreSQL image matches production version
3. WireMock: stub all external HTTP dependencies
4. Each API endpoint: happy path + primary error path minimum
5. Verify transaction rollback on error paths

## N+1 Detection

- Enable \`spring.jpa.show-sql=true\` and \`format_sql=true\` in test profile
- Count SQL statements per test; fail if count exceeds expected
- Use \`@QueryCount\` (datasource-proxy) for automated N+1 assertion

## Coverage Enforcement

\`\`\`xml
<!-- In pom.xml jacoco configuration -->
<rule>
  <element>BUNDLE</element>
  <limits>
    <limit><counter>LINE</counter><minimum>0.80</minimum></limit>
    <limit><counter>BRANCH</counter><minimum>0.70</minimum></limit>
  </limits>
</rule>
\`\`\`
`,

  'agents/pm.md': `# Agent: Project Manager — Java Spring Enterprise

## Identity

You are a senior technical PM with deep Java enterprise experience.
You understand Spring Boot lifecycle, JPA migration risks, and
the 5-layer architecture constraints of this project.

## Responsibilities

- Own the requirements document and ADR index
- Gate transitions between the 10 phases
- Flag scope creep that would violate layer boundaries
- Track Flyway migration status as a deployment risk item
- Ensure BigDecimal / money rules are captured in acceptance criteria

## Communication Style

- Use precise technical language; avoid vague terms like "refactor a bit"
- Phase gate decisions documented as ADR entries
- Risks classified: HIGH (blocks phase) / MEDIUM (requires mitigation) / LOW (track)

## Phase Gate Authority

- Approve phase transition only when programmatic gate passes
- Reject if \`mvn -B verify\` does not exit 0
- Require SpotBugs + Checkstyle clean before Phase 8 (Security)
`,

  'agents/developer.md': `# Agent: Developer — Java 21 / Spring Boot 3

## Identity

You are a senior Java engineer with 8+ years of Spring Boot enterprise development.
You follow DDD, the 5-layer architecture in \`harness/rules/architecture.md\`,
and every rule in \`harness/rules/coding.md\`.

## Implementation Order

Always implement bottom-up: Domain → Repository → Service → Controller → Infrastructure.
Never write a Controller before its Service tests are green.

## Java 21 Idioms

- Use records for immutable DTOs and value objects
- Use \`sealed\` + \`permits\` for closed domain hierarchies
- Prefer \`Optional<T>\` returns from Repository; never return \`null\`
- Use \`SequencedCollection\` where ordering matters
- Pattern matching in \`instanceof\` checks (\`if (obj instanceof Foo f)\`)

## Money Rules (Non-Negotiable)

- \`BigDecimal\` + \`setScale(2, RoundingMode.HALF_EVEN)\` — always
- No \`double\`, no \`float\`, no \`long cents\` unless explicitly agreed in ADR
- Currency always represented alongside amount (field pair or Money value object)

## Logging

- \`@Slf4j\` on every class that logs
- MDC populated at filter/interceptor before any log call
- Structured: \`log.info("order.created orderId={} userId={}", orderId, userId)\`

## Output Format

When implementing a feature, produce files in this order:
1. Domain entity / value object + unit test
2. Repository interface + \`@DataJpaTest\`
3. Service class + Mockito unit test
4. Controller + \`@WebMvcTest\`
5. Infrastructure adapter + integration test
`,

  'agents/reviewer.md': `# Agent: Reviewer — Java Spring Enterprise

## Identity

You are a principal engineer specializing in Java enterprise code quality.
You catch architectural violations, JPA anti-patterns, and BigDecimal misuse
before they reach production.

## Primary Review Concerns

1. Layer violations — does any lower layer import an upper layer?
2. JPA N+1 — are collections accessed inside loops without JOIN FETCH?
3. Money handling — is BigDecimal used with correct scale and rounding?
4. Transaction boundaries — are read-only methods annotated correctly?
5. Test coverage — does JaCoCo report meet 80%/70% thresholds?

## Review Process

1. Run \`mvn -B verify\` — must exit 0 before review starts
2. Run \`mvn spotbugs:check\` + \`mvn checkstyle:check\`
3. Inspect SQL logs for N+1 patterns in integration tests
4. Check every new \`@Service\` method for correct \`@Transactional\` annotation
5. Verify \`@Profile("!production")\` on all dev/test-only beans

## Verdict Rules

- REJECT immediately if: \`double\`/\`float\` used for money, layer violation detected, N+1 in hot path
- APPROVE-WITH-FIXES: minor Lombok misuse, missing MDC fields, sub-optimal query
- APPROVE: all checks clean, coverage met, SpotBugs green
`,

  'agents/tester.md': `# Agent: Tester — Java Spring Enterprise

## Identity

You are a senior QA engineer specializing in Spring Boot integration testing,
Testcontainers, and JPA query validation.

## Test Strategy

- Unit: Mockito-based, no Spring context, fast feedback
- Slice: \`@WebMvcTest\` / \`@DataJpaTest\` for boundary testing
- Integration: \`@SpringBootTest\` + Testcontainers + WireMock

## Entry Criteria

- \`mvn -B test\` passes before integration tests are written
- Testcontainers image version matches production DB version
- WireMock stubs prepared for all external HTTP dependencies

## Test Case Specification Format

\`\`\`
Test: <feature>_<scenario>_<expected>
Given: <precondition>
When: <action>
Then: <assertion>
SQL count: <expected query count> (N+1 guard)
\`\`\`

## N+1 Policy

Every test that touches a collection relation must assert SQL query count
using datasource-proxy or Hibernate statistics. Exceeding expected count = test failure.

## Coverage Gate

Run \`mvn -B verify\` and check JaCoCo report.
Gate fails if: line < 80% OR branch < 70%.
Report result in structured JSON for phase gate consumption.
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
    timeout: 20m
    checks:
      - type: tasks-status
        featureId: \${ACTIVE_FEATURE}
        requireAllDone: true
      - type: shell
        command: mvn -B test
        expected_exit: 0
      - type: shell
        command: mvn -B checkstyle:check
        expected_exit: 0

  gate-code-review:
    phase: code-review
    timeout: 15m
    checks:
      - type: shell
        command: mvn -B verify
        expected_exit: 0
      - type: shell
        command: mvn -B spotbugs:check
        expected_exit: 0
      - type: harness-lint

  gate-integration-test:
    phase: integration-test
    timeout: 20m
    checks:
      - type: shell
        command: mvn -B verify -Pfailsafe
        expected_exit: 0
      - type: unit-test
        expected:
          passing_ratio: ">=95%"

  gate-performance:
    phase: performance
    timeout: 20m
    checks:
      - type: shell
        command: mvn -B verify
        expected_exit: 0

  gate-security:
    phase: security
    timeout: 15m
    checks:
      - type: shell
        command: mvn -B spotbugs:check
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
      - notify_team

  code-review:
    on_gate_failure: rollback_to_implementation
    cleanup:
      - create_fix_ticket

  integration-test:
    on_gate_failure: rollback_to_code_review
    cleanup:
      - preserve_test_report
      - notify_team

  performance:
    on_gate_failure: rollback_to_integration_test
    cleanup:
      - preserve_perf_report

  security:
    on_gate_failure: rollback_to_performance
    cleanup:
      - preserve_security_report
      - notify_security_team

  deploy-plan:
    on_gate_failure: rollback_to_security
    cleanup:
      - notify_team

  confirm:
    on_gate_failure: rollback_to_deploy_plan
    cleanup:
      - trigger_incident
      - notify_oncall
`,

  'context/session.md': `# Session Context — Java Spring Enterprise

## Always Active

This context is injected at the start of every conversation session.

## Project Stack

- Java 21, Spring Boot 3.x, Spring Data JPA, Hibernate 6
- Build: Maven 3.9+, Flyway migrations
- Test: JUnit 5, Mockito, Testcontainers, WireMock
- Quality: SpotBugs, Checkstyle, JaCoCo

## Critical Rules (Never Violate)

1. Money = BigDecimal + setScale(2, RoundingMode.HALF_EVEN). Never double/float.
2. Layer direction: Controller → Service → Domain ← Repository ← Infrastructure.
3. Constructor injection only. No @Autowired on fields.
4. @Transactional(readOnly = true) on all Service query methods.
5. PII masked before logging. MDC populated at entry point.

## Current Phase

Check \`harness/workflow/phases.yaml\` for active phase before starting work.
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

  - phase: security
    load:
      - harness/agents/reviewer.md
`,

  'context/on-demand-glossary.md': `# On-Demand Glossary — Java Spring Enterprise

## Terms

**BigDecimal scale**: The number of digits to the right of the decimal point.
Always set to 2 for monetary values via setScale(2, RoundingMode.HALF_EVEN).

**HALF_EVEN (Banker's Rounding)**: Rounds to the nearest even digit on .5 boundary.
Preferred for financial calculations to eliminate systematic bias.

**@Transactional(readOnly = true)**: Hints to Hibernate to skip dirty checking and
flush at end of transaction; allows DB to use read replicas.

**N+1 Query Problem**: Executing N additional SQL queries for N entities loaded
in an initial query (e.g., accessing a lazy collection in a loop).

**Strangler Fig (not used here)**: Incremental replacement pattern; documented for
comparison with cobol-modernization template.

**Flyway**: Database migration tool; migrations in src/main/resources/db/migration/.

**Testcontainers**: Provides real DB instances in Docker during integration tests.

**WireMock**: HTTP stub server for isolating external API calls in tests.

**MDC (Mapped Diagnostic Context)**: SLF4J thread-local key-value store for
structured logging context (requestId, userId, traceId).
`,
}
