/**
 * Minimal harness template.
 *
 * Provides the essential rule and workflow files needed to get started
 * with Harness Engineering on any project.
 *
 * TODO Agent B: enrich with framework-specific rules.
 */

import type { Template } from '../index.js'

export const minimalTemplate: Template = {
  'rules/architecture.md': `# Architecture Rules

## Module Responsibilities

Each module must be describable in a single sentence:
- What domain responsibility it owns
- What other modules it depends on (minimize)
- What its public API is

## Layer Crossing Rules

- References flow in one direction only: upper layers depend on lower layers
- Lower layers must not import upper layers
- API communicates via DTOs; domain objects are not exposed directly

## Dependency Principles

- Prefer dependency injection over hard-coded instantiation
- Use interfaces/abstract types at layer boundaries
- Avoid circular dependencies between modules

## File Organization

- Group files by feature/domain, not by technical type
- Each directory should own one clear responsibility
- Keep files under 300 lines; split if larger

## Quality Baseline

- All public functions must have TSDoc/JSDoc comments
- No commented-out production code in commits
- No console.log in production paths; use structured logging
`,

  'rules/coding.md': `# Coding Rules

## Money / Price

- Monetary values: use integer (cents) or \`BigDecimal\`-equivalent — never \`float\`/\`double\`
- Field names must end with \`Cents\`, \`Wei\`, or \`Units\` to express the unit
- Comparisons: use \`.equals()\` or \`===\` on integers; never \`==\` on decimals

## Internationalization

- No hard-coded user-visible strings
- All UI/error messages must route through i18n lookup
- When adding strings: update **all** locale files simultaneously
- CI must verify locale file parity

## External API Calls

Every external call must include all four of:
1. **Timeout** — explicit value, no default reliance
2. **Retry** — exponential backoff, max 3 attempts
3. **Circuit Breaker** — open after N consecutive failures
4. **Fallback** — degrade strategy (cached response or empty safe default)

## Logging

- PII (email, phone, SSN, tokens) must pass through \`mask()\` before logging
- Log levels:
  - ERROR = human intervention required
  - WARN = abnormal but auto-recovering
  - INFO = business event
  - DEBUG = development only (stripped in prod build)
- Use structured logging (key=value or JSON)

## Error Handling

- Business exceptions: \`*BusinessError\` suffix, map to HTTP 4xx
- System exceptions: \`*SystemError\` suffix, map to HTTP 5xx
- Never catch the base \`Error\` without re-throwing or explicit reason
- Stack traces: always log server-side; never expose to API consumers

## Tests

- Each module: minimum 5 test cases covering happy path + edge cases
- Integration tests: every API endpoint needs happy path + primary error path
- Coverage targets: line ≥ 80%, branch ≥ 70%
- Test file must live adjacent to implementation (\`*.test.ts\`)

## TypeScript

- \`strict: true\` always enabled
- No \`any\` without a comment justifying the exception
- Prefer \`unknown\` over \`any\` for external data
- Explicit return types on all exported functions
`,

  'skills/review.md': `# Review SOP

## Purpose

Confirm that any code change is Production-ready before it advances
to the next phase. Apply this checklist whether reviewing your own
output or another agent's.

## Checklist

### Architecture
- [ ] No layer violations (see rules/architecture.md)
- [ ] Single Responsibility Principle upheld
- [ ] Dependency direction correct (no upward imports)

### Coding Standards
- [ ] Money/price fields use integer cents or equivalent (rules/coding.md §Money)
- [ ] All locale files updated if strings were added (§Internationalization)
- [ ] External API calls include 4-point set (§External API Calls)
- [ ] PII masked in logs (§Logging)
- [ ] Exception handling follows conventions (§Error Handling)

### Tests
- [ ] At least 5 unit test cases per new module
- [ ] Integration test covers all new endpoints
- [ ] Coverage ≥ 80% line, ≥ 70% branch

### Documentation
- [ ] All exported functions have TSDoc comments
- [ ] Significant design decisions recorded (ADR or inline comment)

## Output Format

Return a JSON verdict:

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

### Verdict Criteria

| Verdict | Condition |
|---|---|
| APPROVE | 0 errors, 0 warnings |
| APPROVE-WITH-FIXES | 0 errors, ≤ 3 warnings |
| REJECT | ≥ 1 error, or ≥ 4 warnings, or architecture violation |
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

  // -------------------------------------------------------------------------
  // Agent persona stubs (minimal — 50-100 words each)
  // -------------------------------------------------------------------------

  'agents/pm.md': `# Agent: Project Manager

## Identity
You are a PM focused on requirements clarity and delivery.

## Responsibilities
- Define acceptance criteria before implementation starts
- Gate phase transitions — advance only when criteria are met
- Track scope changes and communicate ROI impact

## Communication
- Be concise and precise; avoid vague language
- Document decisions as short ADR entries
- Classify risks: HIGH / MEDIUM / LOW
`,

  'agents/developer.md': `# Agent: Developer

## Identity
You are a disciplined software engineer who writes tested, reviewable code.

## Responsibilities
- Implement to spec, starting with tests
- Keep commits small and reversible
- Follow the coding rules in \`harness/rules/coding.md\`

## Non-Negotiables
- No production code without a passing test
- No \`any\` types without a justification comment
- Structured logging only — no bare \`console.log\` in production paths
`,

  'agents/reviewer.md': `# Agent: Reviewer

## Identity
You are a principal engineer focused on design conformance and security.

## Review Focus
1. Architecture — are layer boundaries respected?
2. Security — input validation, PII masking, secrets management
3. Maintainability — clear names, documented decisions, no magic numbers

## Verdict
- APPROVE: all checks clean
- APPROVE-WITH-FIXES: minor issues, no blockers
- REJECT: architecture violation, security gap, or untested code path
`,

  'agents/tester.md': `# Agent: Tester

## Identity
You are a QA engineer who owns test coverage and regression discipline.

## Responsibilities
- Write test specs before implementation (test-first)
- Define coverage targets: line ≥ 80%, branch ≥ 70%
- Maintain regression suite — every bug fix gets a regression test

## Test Structure
- Given / When / Then format for each case
- Cover: happy path, null input, boundary values, error paths
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
      - type: typescript-typecheck
      - type: unit-test

  gate-code-review:
    phase: code-review
    timeout: 20m
    # Anti-rubber-stamp design: a single human-approval is rejected by default.
    # Reviewer MUST produce a structured CODE_REVIEW.md with per-item evidence,
    # AND programmatic checks (lint, rule-conformance, unit-test) must pass.
    # Adjust requiredCategories / minEvidenceChars for project needs.
    checks:
      - type: review-checklist
        path: docs/CODE_REVIEW.md
        minEvidenceChars: 40
        requiredCategories:
          - architecture-conformance
          - god-class-detection
          - action-coverage
          - security
          - tests
      - type: harness-lint
      - type: harness-rule-conformance
      - type: unit-test

  gate-integration-test:
    phase: integration-test
    timeout: 15m
    checks:
      - type: unit-test
        expected:
          passing_ratio: ">=95%"

  gate-performance:
    phase: performance
    timeout: 15m
    checks:
      - type: unit-test

  gate-security:
    phase: security
    timeout: 10m
    checks:
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

  'context/session.md': `# Session Context

## Project Mission

This project uses the Harness Engineering framework to bring structured
engineering discipline to AI-assisted development.

The harness provides rules, skills, agents, workflow phases, and quality gates
that guide every code change from requirements to production confirmation.

## Key Invariants (Always Active)

1. All monetary values use integers (cents/wei/units) — never float or double.
2. Every external API call must include: timeout, retry, circuit breaker, fallback.
3. PII (email, phone, tokens) must be masked before appearing in any log output.
4. Layer crossing is unidirectional — lower layers never import upper layers.
5. No commented-out production code in commits.
6. All exported functions carry TSDoc/JSDoc comments.

## Always Remember

- Check \`harness/workflow/phases.yaml\` for the current phase before starting work.
- Run \`/harness gate <id>\` to verify each gate before advancing phases.
- Keep files under 300 lines; split on single responsibility.
- Tests live adjacent to implementation (\`*.test.ts\` or \`*_test.go\`, etc.).
`,

  'context/phase-triggers.yaml': `version: 1

phase_contexts:
  design:
    inject:
      - harness/rules/architecture.md

  implementation:
    inject:
      - harness/rules/coding.md

  code-review:
    inject:
      - harness/skills/review.md
`,

  'context/on-demand-glossary.md': `# On-Demand Glossary

## Money / Monetary Values

Always use integers (cents, wei, units) for monetary amounts.
Never use float or double — floating-point arithmetic introduces rounding errors
that compound across transactions. Field names must end with Cents, Wei, or Units.

## Circuit Breaker

A resilience pattern that stops calling a failing service after N consecutive
failures. The circuit "opens" (blocks calls) and periodically allows a probe
request to check recovery. Prevents cascade failures in distributed systems.

## PII (Personally Identifiable Information)

Any data that can identify a person: email addresses, phone numbers, SSNs,
passport numbers, IP addresses, biometrics. Must be masked before logging.
Use a mask() or redact() helper function — never log raw PII.

## Layer Violation

When a lower architectural layer (e.g., domain, repository) imports a type or
function from a higher layer (e.g., controller, API). This is forbidden because
it creates circular dependencies and breaks the single-direction dependency rule.

## Gate

A quality checkpoint between phases. A gate contains one or more checks
(file-exists, typecheck, unit-test, harness-lint, etc.) that must all pass
before the phase can advance. Defined in harness/workflow/gates.yaml.
`,
}
