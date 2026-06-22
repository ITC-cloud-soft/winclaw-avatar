/**
 * COBOL → modern stack migration harness template.
 *
 * Strangler-fig migration phases: analyze → port → verify → deprecate.
 * Covers COBOL PIC 9 precision → BigDecimal/Decimal, YYYYMMDD packed dates → ISO 8601,
 * VSAM → relational DB mapping, explicit concurrency introduction,
 * and byte-identical dual-run comparison gate.
 */

import type { Template } from '../index.js'
import { minimalTemplate } from '../minimal/index.js'

export const cobolModernizationTemplate: Template = {
  ...minimalTemplate,

  'rules/architecture.md': `# Architecture Rules — COBOL Modernization

## Migration Phases (Strangler Fig Pattern)

Migration proceeds incrementally — never a big-bang rewrite:

\`\`\`
Phase 1: ANALYZE
  Inventory COBOL programs, COPY books, VSAM files, JCL jobs
  Map PERFORM sections to bounded contexts
  Document data types: PIC 9, COMP-3, COMP, USAGE IS DISPLAY

Phase 2: FACADE
  Modern API gateway routes requests to COBOL or new service
  COBOL still runs unchanged; facade is additive only
  Feature flags control routing per business function

Phase 3: PORT
  One bounded context at a time: rewrite COBOL PERFORM → function
  Dual-run: COBOL and new code run in parallel; outputs compared
  Gate: output delta must be zero for monetary values

Phase 4: VERIFY
  Automated parity test suite (production-sourced anonymized data)
  Statistical comparison for non-monetary outputs (< 0.001% delta)
  30-day canary period with COBOL path as hot fallback

Phase 5: DEPRECATE
  Disable COBOL path after stability period
  Archive COBOL source (never delete — regulatory/audit)
  Document which COBOL program each new module replaced
\`\`\`

## COBOL → Modern Structure Mapping

| COBOL Construct | Modern Equivalent |
|----------------|-------------------|
| PROGRAM-ID | Service / module name |
| WORKING-STORAGE SECTION | Service-scoped state / struct fields |
| LINKAGE SECTION | Function parameters |
| PERFORM section | Named function |
| COPY book | Shared module / library |
| FILE SECTION (VSAM) | Repository (relational DB or KV store) |
| JCL job step | CI/CD pipeline step or scheduled task |
| CALL statement | Inter-service HTTP/gRPC call |
| REDEFINES | Union type or type alias |

## Dual-Run Architecture

\`\`\`
Request → Facade → [COBOL Path] → compare outputs → respond
                 ↘ [New Code Path] ↗
\`\`\`

- Facade always executes both paths in parallel during Phase 3–4
- Comparison engine logs delta for every field
- Gate: zero delta for monetary fields; configurable threshold for statistics

## Facade Rules

- Only the facade layer may call COBOL programs (via CICS/batch JCL wrapper)
- New services must not call JCL directly
- Feature flag (per business function) controls which path is authoritative
- Flag state persisted in config service — never hardcoded

## COBOL Source Preservation

- COBOL source checked into version control (git LFS if large)
- Each COBOL PERFORM section documented with its modern equivalent reference
- COBOL programs archived in \`legacy/cobol/\` directory — never deleted
- Business logic comments extracted and preserved in modern code
`,

  'rules/coding.md': `# Coding Rules — COBOL Modernization

## Money / Price (Critical — Precision Must Be Preserved)

COBOL monetary precision rule: PIC 9(7)V99 = 7 integer digits + 2 decimal places.
The modern replacement MUST preserve this precision exactly.

### Java / Kotlin target:
- Use \`BigDecimal\` with \`setScale(2, RoundingMode.HALF_EVEN)\`
- Never \`double\` / \`float\`
- Map COBOL COMP-3 packed decimal to \`BigDecimal\` during deserialization

### Python target:
- Use \`decimal.Decimal\` with explicit context: \`decimal.getcontext().prec = 9\`
- Quantize: \`Decimal('0.01')\` with \`ROUND_HALF_EVEN\`
- Never \`float\` arithmetic for monetary values

### TypeScript target:
- Use \`Decimal\` from \`decimal.js\` with precision 9, rounding ROUND_HALF_EVEN
- Never JavaScript \`number\` for monetary values

### Verification:
Dual-run comparison for monetary fields must show ZERO delta.
Any monetary delta = mandatory investigation before proceeding.

## Date / Time

COBOL date formats encountered:
- \`PIC 9(8)\` = YYYYMMDD (most common)
- \`PIC 9(6)\` = YYMMDD (Y2K-era programs — requires epoch documentation)
- \`PIC 9(7)\` = YYYYDDD (Julian date)
- \`COMP-3\` packed: binary-coded decimal date

Modernization rules:
- All dates converted to ISO 8601 (YYYY-MM-DD) at the COBOL interface boundary
- Epoch for 2-digit year fields: document assumed century cutoff (typically 1940 or 1950)
- Julian date conversion: explicit library function with test case
- Never use \`new Date(string)\` (JavaScript) — use explicit parsing library
- Store as ISO 8601 string or UTC epoch; never as integer YYYYMMDD in new code

## File I/O (VSAM → Modern)

| VSAM Type | Modern Equivalent | Notes |
|-----------|------------------|-------|
| ESDS (Entry Sequenced) | Append-only table or log stream | Preserve insertion order |
| KSDS (Key Sequenced) | Primary-key relational table | Map RECORD KEY → PK |
| RRDS (Relative Record) | Table with integer offset PK | Map relative record number → ID |

Rules:
- Document the VSAM file name → new table/collection name mapping in \`docs/vsam-mapping.md\`
- RECORD KEY becomes primary key; ALTERNATE RECORD KEY becomes unique index
- COBOL sequential reads map to cursor-based pagination in new code
- COBOL REWRITE maps to UPDATE with optimistic locking in new code

## Concurrency (COBOL Was Single-Threaded)

COBOL programs were inherently single-threaded via JCL job steps.
New code MUST explicitly handle concurrency:

- Race conditions: any shared state in WORKING-STORAGE that maps to shared DB state
  must use transactions or optimistic locking in the new code
- Batch jobs: COBOL batch steps become idempotent, retriable tasks (Celery/Kafka)
- Parallel execution: if new architecture runs multiple instances, identify all
  COBOL "singleton" behaviors (e.g., sequence number generation) and replace with
  DB sequences, Redis atomic incr, or UUID

## Validation (Explicit Replacement for PIC Clause)

COBOL PICTURE clause implicitly validated data type and length.
New code MUST explicitly validate all input:

- PIC 9(5): validate integer, max 5 digits → \`z.number().int().max(99999)\` or equivalent
- PIC X(10): validate string max 10 chars → \`z.string().max(10)\`
- PIC 9(7)V99: validate Decimal precision 9, scale 2
- COBOL \`88 level\` (condition names) → TypeScript enum or union type

Every input from legacy interfaces (CICS screens, flat files, JCL params)
must pass explicit validation before entering new code logic.

## Error Handling

- COBOL used \`FILE STATUS\` codes; document each code and its new exception mapping
- \`FILE STATUS '35'\` (file not found) → \`ResourceNotFoundException\` (4xx)
- \`FILE STATUS '22'\` (duplicate key) → \`DuplicateKeyException\` (4xx conflict)
- \`FILE STATUS '30'\` (permanent error) → \`StorageSystemException\` (5xx)
- ABEND codes: document top-10 ABEND codes and their new exception equivalents

## Logging

- COBOL produced sysout/SYSPRINT; new code uses structured logging
- Correlation: every new log record includes \`cobolJobName\`, \`stepName\` when called from facade
- Dual-run comparison logs to separate \`dual-run-delta\` log stream for analysis
`,

  'rules/workflow.md': `# Workflow Rules — COBOL Modernization

## Migration Pipeline (10 Phases)

| Phase | Entry Condition | Exit Condition | Rollback Trigger |
|-------|----------------|----------------|-----------------|
| 1. Inventory | COBOL source in git LFS | All PERFORM sections documented | Missing source |
| 2. Boundary Mapping | Phase 1 done | Bounded context map + VSAM mapping | Ambiguous ownership |
| 3. Test Spec | Phase 2 done | Dual-run test plan with sample data | No production sample data |
| 4. Facade | Phase 3 done | Feature flag routing functional | Facade breaks COBOL path |
| 5. Port (1 context) | Phase 4 done | New code ports one bounded context | Dual-run delta > 0 for money |
| 6. Dual-Run Verify | Phase 5 done | 30-day zero monetary delta | Any monetary delta found |
| 7. Canary | Phase 6 done | 5% traffic, zero critical errors | Error rate spike |
| 8. Full Cutover | Phase 7 done | 100% traffic, COBOL path idle | Latency regression |
| 9. Stability Period | Phase 8 done | 30 days clean | Any COBOL path needed |
| 10. Deprecate | Phase 9 done | COBOL path removed, source archived | Never (archive, never delete) |

## Gate Standard

Dual-run comparison gate: zero monetary delta is a hard gate (cannot be waived).
Statistical delta < 0.001% is acceptable for non-monetary computed values.

## Rollback Policy

- Any phase: COBOL path hot fallback via feature flag (< 1 minute switchover)
- Dual-run delta detected: immediate halt of port phase; investigation required
- Three consecutive dual-run failures: escalate to senior architect

## COBOL Path Preservation

COBOL path must remain functional and deployable through all phases.
Never modify COBOL source during modernization (read-only reference).
`,

  'skills/plan.md': `# Planning SOP — COBOL Modernization

## Purpose

Produce a structured migration plan before porting any COBOL program.
Prevents precision loss, missed validation, and concurrency bugs.

## Step 1: COBOL Program Analysis

1. Read the COBOL source; document IDENTIFICATION, ENVIRONMENT, DATA, PROCEDURE divisions
2. List all PERFORM sections with their business function description
3. Document all monetary fields (PIC 9...V...) with their precision requirements
4. Document all date fields and their format (YYYYMMDD, YYMMDD, Julian)
5. List all VSAM files accessed: file name, type (KSDS/ESDS/RRDS), RECORD KEY

## Step 2: Data Type Mapping

1. Map each COBOL PIC clause to the target language type
2. Confirm monetary precision is preserved exactly
3. Document date epoch for any 2-digit year fields
4. Map each COBOL 88-level condition to an enum or union type

## Step 3: Concurrency Risk Assessment

1. Identify WORKING-STORAGE fields that represent shared state
2. Identify any sequence number generation (must use DB sequence or UUID)
3. Identify batch job steps that may run in parallel in new architecture
4. Plan transaction boundaries for multi-record updates

## Step 4: Dual-Run Test Planning

1. Obtain anonymized production data set (minimum 1,000 representative records)
2. Define comparison schema: which fields must match exactly vs statistically
3. Plan test harness: COBOL output file vs new code output, field-by-field comparison
4. Identify boundary cases in production data (zero amounts, max amounts, edge dates)

## Step 5: Sequence

COBOL analysis + data mapping → VSAM mapping doc → Validation rules → Dual-run harness → Port one PERFORM → Verify → Next PERFORM
`,

  'skills/implement-by-layer.md': `# Implement By Layer SOP — COBOL Modernization

## Purpose

Port COBOL programs to modern code while guaranteeing byte-identical output
for monetary values and preserving all implicit PICTURE clause validation.

## Prerequisites

- COBOL source read and all PERFORM sections documented
- Dual-run comparison harness skeleton in place
- Anonymized production sample data set available
- \`dual-run-delta\` log stream configured

## Step 1: Data Layer (VSAM → Repository)

1. Create new DB schema from VSAM structure documentation
2. Implement data migration: read VSAM export → insert into relational DB
3. Validate: row count matches VSAM record count
4. Verify monetary precision: spot-check 100 records against VSAM raw values
5. Write repository interface with same I/O contract as COBOL FILE operations

## Step 2: Validation Layer (PIC Clauses → Explicit Validation)

1. For each COBOL data element, write an explicit validator:
   - \`PIC 9(5)\` → integer validator max 99999
   - \`PIC 9(7)V99\` → Decimal validator precision 9, scale 2
   - \`PIC X(30)\` → string validator maxLength 30
2. For each 88-level condition, create enum or union type
3. Write unit tests for each validator with boundary values

## Step 3: Business Logic Layer (PERFORM Sections → Functions)

1. Port one PERFORM section at a time — not the entire program
2. Comments: reference the original COBOL PERFORM name and line number
3. Monetary arithmetic: use BigDecimal / Decimal / decimal.Decimal — no floats
4. Date arithmetic: use explicit library; document COBOL's assumed epoch
5. Write unit tests with identical inputs to COBOL test data

## Step 4: Dual-Run Integration

1. Wire the new function into the dual-run facade
2. Run dual-run comparison on anonymized production data set
3. Check \`dual-run-delta\` log: ZERO delta required for monetary fields
4. Investigate and fix any delta before proceeding to next PERFORM section
5. Document comparison results in migration log

## Step 5: Concurrency Hardening

1. Identify any WORKING-STORAGE state that was effectively global in COBOL
2. Replace with explicit concurrency primitives (transactions, mutexes, atomic ops)
3. Run load test to detect race conditions (10x expected peak load)
4. Verify idempotency: running the same input twice produces identical result

## Forbidden

- Porting multiple bounded contexts simultaneously (one at a time only)
- Using float/double/number for monetary values
- Modifying COBOL source during migration
- Proceeding past dual-run verification with any monetary delta
`,

  'skills/review.md': `# Review SOP — COBOL Modernization

## Purpose

Verify each ported COBOL program maintains full business logic fidelity
before advancing the cutover percentage.

## COBOL Fidelity Checklist

- [ ] Every COBOL PERFORM section mapped to a named function in new code
- [ ] Original COBOL PERFORM name referenced in comment above modern function
- [ ] All monetary fields use BigDecimal / Decimal with correct precision (no float)
- [ ] All date fields converted to ISO 8601; epoch documented for 2-digit year fields
- [ ] All VSAM operations mapped to repository functions (see \`docs/vsam-mapping.md\`)
- [ ] All 88-level conditions mapped to enum or union type

## Dual-Run Verification Checklist

- [ ] Dual-run comparison executed on full anonymized production data set
- [ ] Monetary field delta = ZERO (hard requirement, no exceptions)
- [ ] Non-monetary statistical delta < 0.001%
- [ ] Comparison results documented in migration log with date and data set size
- [ ] \`dual-run-delta\` log stream reviewed for any anomalies

## Concurrency Checklist

- [ ] All COBOL WORKING-STORAGE shared state identified and replaced with safe primitives
- [ ] Sequence number generation uses DB sequence or UUID (not in-memory counter)
- [ ] Batch jobs are idempotent (safe to re-run on failure)
- [ ] Load test executed; no race conditions detected

## Validation Checklist

- [ ] Explicit validator written for every COBOL PIC clause in input fields
- [ ] Validators tested with boundary values (max length, max numeric, empty)
- [ ] 88-level conditions converted to typed enums

## Output Format

\`\`\`json
{
  "passed": true,
  "verdict": "APPROVE | APPROVE-WITH-FIXES | REJECT",
  "cobolFidelity": {
    "monetaryDelta": "0.00",
    "statisticalDelta": "0.0001%",
    "performSectionsCovered": 12,
    "performSectionsTotal": 12
  },
  "violations": [
    { "rule": "<rule-id>", "file": "<path>", "line": 0, "fix": "<suggestion>" }
  ],
  "score": 100
}
\`\`\`
`,

  'skills/test.md': `# Test SOP — COBOL Modernization

## Test Strategy

- Unit tests: ported function vs expected output from COBOL test data
- Dual-run harness: COBOL output vs new code output, field-by-field
- Regression tests: full production-sourced anonymized data set
- Concurrency tests: race condition detection under load

## Unit Test Standard

1. Obtain COBOL test cases from existing COBOL test JCL or unit test framework
2. Convert COBOL test data to modern format (parse VSAM dump or flat file)
3. One test per COBOL PERFORM section minimum
4. Assert exact equality for monetary fields (BigDecimal.compareTo == 0)
5. Assert ISO 8601 date output from each COBOL date field conversion

## Dual-Run Test Standard

\`\`\`
Input dataset: anonymized production records (min 1,000; target 10,000)
COBOL execution: batch JCL job producing output flat file
New code execution: same input → structured output
Comparison:
  - Monetary fields: ZERO delta required (hard gate)
  - Date fields: ISO 8601 equivalence after epoch adjustment
  - String fields: trim + case-normalize then compare
  - Statistical fields: delta < 0.001%
\`\`\`

## Dual-Run Comparison Gate Script

\`\`\`bash
# Example gate check (adapt to project tooling)
dual-run-compare \
  --cobol-output ./cobol-output.dat \
  --new-output ./new-output.json \
  --schema ./docs/dual-run-schema.yaml \
  --monetary-tolerance 0 \
  --statistical-tolerance 0.00001 \
  --exit-code-on-monetary-delta
\`\`\`

Gate exits non-zero on any monetary delta.

## Modernization Coverage Metric

Track: (PERFORM sections verified dual-run) / (total PERFORM sections)
Gate: coverage ≥ 100% for the current bounded context before cutover.

## Regression Test After Cutover

After disabling COBOL path:
1. Run full dual-run data set against new code only
2. Compare against stored COBOL baseline output (kept in test fixtures)
3. Any deviation = regression; must roll back and investigate
`,

  'agents/pm.md': `# Agent: Project Manager — COBOL Modernization

## Identity

You are a senior technical PM with COBOL mainframe modernization experience.
You understand JCL job scheduling, VSAM data structures, CICS transactions,
and the regulatory requirements around financial data precision.

## Responsibilities

- Own the PERFORM section migration tracker (spreadsheet or issue tracker)
- Gate each bounded context cutover; reject unless dual-run shows zero monetary delta
- Track COBOL path availability as a risk item (must remain deployable through Phase 9)
- Ensure all VSAM → relational DB mappings are documented before porting begins
- Communicate cutover timeline to operations team (JCL schedule changes)

## Phase Gate Authority

- Approve port phase only when dual-run comparison on full data set passes (zero monetary delta)
- Reject if any float/double used for monetary field in new code
- Require load test results before Phase 7 (canary) gate
- Never approve deprecation (Phase 10) without archived COBOL source confirmed in git LFS
`,

  'agents/developer.md': `# Agent: Developer — COBOL Modernization

## Identity

You are a senior engineer specializing in mainframe-to-modern migrations.
You read COBOL fluently and understand COMP-3 decimal arithmetic,
VSAM file structures, JCL job steps, and CICS transaction patterns.

## Implementation Approach

One PERFORM section at a time — never port an entire program in one commit.
Dual-run verification must pass before the next PERFORM section is ported.

## COBOL Reading Guide

Before porting any PERFORM section:
1. Read DATA DIVISION: document all PIC clauses and their modern types
2. Read FILE SECTION: map VSAM structure to DB schema
3. Read PROCEDURE DIVISION: trace data flow from input to output
4. Note all arithmetic verbs: ADD, SUBTRACT, MULTIPLY, DIVIDE, COMPUTE
5. Note all PERFORM with VARYING (maps to for loop), PERFORM UNTIL (maps to while loop)

## Money Rules (Non-Negotiable)

- COBOL PIC 9(7)V99 → BigDecimal (Java/Kotlin) / decimal.Decimal (Python) / Decimal (JS)
- Scale must match COBOL V specification exactly
- COBOL ROUNDED → HALF_EVEN rounding
- Test: compare output digit-for-digit with COBOL output on same input

## Concurrency Rules

COBOL was single-threaded; you are introducing concurrency.
Document every place where new code could have race conditions.
Use explicit primitives — no assumptions about execution order.

## Output Format

For each PERFORM section ported, produce:
1. Function implementation with COBOL reference comment
2. Unit tests matching COBOL test data
3. Dual-run comparison result (zero delta confirmation)
4. Updated PERFORM section migration tracker
`,

  'agents/reviewer.md': `# Agent: Reviewer — COBOL Modernization

## Identity

You are a principal engineer with COBOL modernization expertise.
You catch precision loss, missed validation, concurrency bugs, and
dual-run comparison gaps before they reach production.

## Primary Review Concerns

1. Monetary precision — does BigDecimal/Decimal scale exactly match COBOL PIC V spec?
2. Date handling — is the 2-digit year epoch documented and tested?
3. Missing validation — does every COBOL PIC clause have an explicit validator?
4. Concurrency — is any COBOL WORKING-STORAGE state now shared state without locks?
5. Dual-run coverage — does the comparison cover the full production-sourced data set?

## Review Process

1. Read the COBOL source being ported — verify you understand what it does
2. Verify monetary field precision: count digits in PIC 9(N)V99 → check BigDecimal scale
3. Run dual-run comparison on anonymized data; verify delta log shows zero monetary delta
4. Check all new I/O functions for explicit concurrency handling
5. Verify all PIC clause validations are present in new code

## Verdict Rules

- REJECT: float for money, monetary dual-run delta > 0, missing PIC validation, COBOL source modified
- APPROVE-WITH-FIXES: missing PERFORM reference comment, incomplete date epoch documentation
- APPROVE: dual-run passes, precision matches, all PIC validated
`,

  'agents/tester.md': `# Agent: Tester — COBOL Modernization

## Identity

You are a senior QA engineer specializing in COBOL output validation,
dual-run harness operation, and batch job regression testing.

## Test Strategy

- Unit: ported function vs COBOL test data outputs
- Dual-run: full data set comparison with zero-delta gate for monetary fields
- Regression: COBOL baseline preserved for post-cutover comparison
- Concurrency: race condition detection under 10x peak load

## Entry Criteria

- Anonymized production data set obtained and validated (min 1,000 records)
- Dual-run comparison harness operational (both COBOL and new code runnable)
- COBOL test JCL and expected output files available in test fixtures

## Dual-Run Test Specification

\`\`\`
Test: <program>_<perform_section>_dual_run_parity
Dataset: anonymized_production_{date}.dat (N records)
COBOL output: cobol_output_{date}.dat
New code output: new_output_{date}.json
Monetary delta: MUST BE ZERO (hard gate — no tolerance)
Statistical delta: < 0.001%
Date delta: ISO 8601 equivalent after epoch normalization
String delta: after trim + uppercase normalization
\`\`\`

## Monetary Precision Test Policy

For every monetary PERFORM section:
1. Test with COBOL minimum value (all 9s in integer, V99 = .00)
2. Test with COBOL maximum value (PIC 9(7)V99 max = 9999999.99)
3. Test arithmetic rounding: X.005 must round to X.01 (HALF_EVEN)
4. Test with zero (0.00)
5. Compare byte-by-byte with COBOL formatted output

## Coverage Gate

Dual-run coverage: (PERFORM sections with zero-delta verification) / (total PERFORM sections in scope)
Gate: 100% coverage required before bounded context cutover is approved.
`,

  'workflow/phases.yaml': `version: 1
default_phase: inventory

phases:
  - id: inventory
    name: COBOL Inventory
    next: boundary-mapping
    rollback_to: null
    gate: gate-inventory
    role: pm

  - id: boundary-mapping
    name: Bounded Context Mapping
    next: test-spec
    rollback_to: inventory
    gate: gate-boundary-mapping
    role: pm

  - id: test-spec
    name: Dual-Run Test Specification
    next: facade
    rollback_to: boundary-mapping
    gate: gate-test-spec
    role: tester

  - id: facade
    name: Facade Implementation
    next: port
    rollback_to: test-spec
    gate: gate-facade
    role: developer

  - id: port
    name: COBOL Port (one bounded context)
    next: dual-run-verify
    rollback_to: facade
    gate: gate-port
    role: developer

  - id: dual-run-verify
    name: Dual-Run Verification
    next: canary
    rollback_to: port
    gate: gate-dual-run
    role: tester

  - id: canary
    name: Canary (5% traffic)
    next: full-cutover
    rollback_to: dual-run-verify
    gate: gate-canary
    role: developer

  - id: full-cutover
    name: Full Cutover
    next: stability
    rollback_to: canary
    gate: gate-cutover
    role: developer

  - id: stability
    name: 30-Day Stability Period
    next: deprecate
    rollback_to: full-cutover
    gate: gate-stability
    role: pm

  - id: deprecate
    name: COBOL Path Deprecation
    next: null
    rollback_to: stability
    gate: gate-deprecate
    role: pm
`,

  'workflow/gates.yaml': `version: 1

# v3.3.0: The COBOL modernization template uses a different phase model
# (inventory/boundary-mapping/test-spec/facade/port/...). It does NOT have
# gate-requirements/gate-design/gate-implementation IDs, so the spec-kit
# upgrades only apply to gate-test-spec (test-plan.md + test-spec-checklist)
# and gate-port (tasks-status as the implementation analog). Other gates
# retain their COBOL-specific dual-run + inventory artifact checks.
# \${ACTIVE_FEATURE} is resolved at gate-run time from
# harness/audit/active-feature.txt; if unset, spec-aware checks are skipped
# with a warning (back-compat). Set policy.yaml gateEnforcement=warn to
# downgrade these failures to warnings during rollout (default), or =error
# to enforce. See docs/harness-gate-migration.md.

gates:
  gate-inventory:
    phase: inventory
    timeout: 10m
    checks:
      - type: file-exists
        path: docs/cobol-inventory.md
      - type: file-exists
        path: legacy/cobol

  gate-boundary-mapping:
    phase: boundary-mapping
    timeout: 10m
    checks:
      - type: file-exists
        path: docs/vsam-mapping.md
      - type: file-exists
        path: harness/rules/architecture.md

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
      # Back-compat + COBOL-specific dual-run schema (remove generic
      # file-exists after v3.4.0; keep dual-run-schema check):
      - type: file-exists
        path: harness/rules/coding.md
      - type: file-exists
        path: docs/dual-run-schema.yaml

  gate-facade:
    phase: facade
    timeout: 15m
    checks:
      - type: shell
        command: dual-run compare --dry-run
        expected_exit: 0
      - type: unit-test

  gate-port:
    phase: port
    timeout: 20m
    checks:
      - type: tasks-status
        featureId: \${ACTIVE_FEATURE}
        requireAllDone: true
      - type: unit-test
      - type: shell
        command: dual-run compare --sample 100
        expected_exit: 0

  gate-dual-run:
    phase: dual-run-verify
    timeout: 30m
    checks:
      - type: shell
        command: dual-run compare --full-dataset --monetary-tolerance 0
        expected_exit: 0
      - type: shell
        command: dual-run compare --modernization-coverage
        expected_exit: 0
      - type: unit-test
        expected:
          passing_ratio: ">=99%"

  gate-canary:
    phase: canary
    timeout: 30m
    checks:
      - type: shell
        command: dual-run compare --live --traffic 5pct --duration 24h
        expected_exit: 0

  gate-cutover:
    phase: full-cutover
    timeout: 20m
    checks:
      - type: shell
        command: dual-run compare --full-dataset --monetary-tolerance 0
        expected_exit: 0

  gate-stability:
    phase: stability
    timeout: 5m
    checks:
      - type: file-exists
        path: docs/stability-report.md

  gate-deprecate:
    phase: deprecate
    timeout: 10m
    checks:
      - type: file-exists
        path: legacy/cobol
      - type: shell
        command: git lfs ls-files legacy/cobol
        expected_exit: 0
`,

  'workflow/rollback.yaml': `version: 1

policy:
  max_consecutive_failures: 3
  human_approval_after_max: true
  audit_log: true
  cobol_path_always_available: true

phases:
  port:
    on_gate_failure: rollback_to_facade
    cleanup:
      - disable_new_code_path_via_feature_flag
      - preserve_dual_run_delta_log

  dual-run-verify:
    on_gate_failure: rollback_to_port
    cleanup:
      - disable_new_code_path_via_feature_flag
      - mandatory_investigation_required
      - notify_architect

  canary:
    on_gate_failure: rollback_to_dual_run_verify
    cleanup:
      - set_traffic_to_cobol_100pct
      - notify_operations

  full-cutover:
    on_gate_failure: rollback_to_canary
    cleanup:
      - set_traffic_to_cobol_100pct
      - trigger_incident
      - notify_oncall

  stability:
    on_gate_failure: rollback_to_full_cutover
    cleanup:
      - set_traffic_to_cobol_100pct
      - notify_architect

rollback_sla:
  cobol_path_restore: 60s  # Feature flag flip — must be < 1 minute
  data_consistency_check: 30m
`,

  'context/session.md': `# Session Context — COBOL Modernization

## Always Active

Injected at session start for every conversation.

## Project Stack

- Legacy: COBOL (IBM Enterprise COBOL or Micro Focus), VSAM, JCL, CICS
- Modern target: Java 21 + Spring Boot (primary) OR Python + Django OR Go
- Dual-run: feature-flag router + comparison engine
- DB: PostgreSQL (VSAM replacement)
- Test: JUnit 5 / pytest / go test + dual-run harness

## Critical Rules (Never Violate)

1. COBOL PIC 9(7)V99 → BigDecimal (Java) / decimal.Decimal (Python) / Decimal (JS). Never float.
2. Dual-run monetary delta must be ZERO before any cutover proceeds.
3. COBOL source is READ-ONLY during migration. Never modify it.
4. Port ONE PERFORM section at a time. Verify before next section.
5. COBOL path must remain hot-standby through Phase 9 (stability period).

## Current Migration Status

Check \`docs/cobol-inventory.md\` for PERFORM section migration tracker.
Check \`docs/vsam-mapping.md\` for VSAM → relational DB mapping status.
`,

  'context/phase-triggers.yaml': `version: 1

triggers:
  - phase: boundary-mapping
    load:
      - harness/rules/architecture.md
      - docs/cobol-inventory.md

  - phase: port
    load:
      - harness/rules/coding.md
      - harness/skills/implement-by-layer.md
      - harness/agents/developer.md

  - phase: dual-run-verify
    load:
      - harness/skills/test.md
      - harness/agents/tester.md

  - phase: canary
    load:
      - harness/agents/reviewer.md

  - phase: deprecate
    load:
      - harness/agents/pm.md
`,

  'context/on-demand-glossary.md': `# On-Demand Glossary — COBOL Modernization

## COBOL Terms

**PIC (PICTURE) clause**: Defines data type and format of a COBOL data item.
PIC 9(7)V99 = 7 integer digits, implied decimal point, 2 decimal digits.

**COMP-3 (Packed Decimal)**: Binary representation of decimal numbers.
Each byte stores two decimal digits; sign in last nibble. High-precision monetary format.

**PERFORM section**: Named subroutine in COBOL PROCEDURE DIVISION.
Equivalent to a named function in modern languages.

**WORKING-STORAGE SECTION**: COBOL program-level variable storage.
Equivalent to class/struct fields. Effectively global within the program (single-threaded).

**LINKAGE SECTION**: Parameters passed to a called COBOL program.
Equivalent to function parameters.

**VSAM (Virtual Storage Access Method)**: IBM mainframe file system.
KSDS (keyed), ESDS (sequential), RRDS (relative record) variants.

**JCL (Job Control Language)**: IBM mainframe batch job definition language.
Equivalent to CI/CD pipeline steps or shell scripts.

**CICS (Customer Information Control System)**: IBM mainframe transaction processor.
Equivalent to a web application server; handles request/response lifecycle.

**88-level condition**: Named boolean condition on a data item.
\`88 IS-VALID-STATUS VALUES 'A' 'B' 'C'.\` → modern enum or union type.

**ABEND**: Abnormal end of COBOL program execution.
Equivalent to unhandled exception. Each ABEND code maps to a specific error.

## Modernization Terms

**Strangler Fig**: Migration pattern where new code gradually replaces old code.
Traffic shifts incrementally; legacy system kept as fallback.

**Dual-Run Harness**: Infrastructure that runs both COBOL and new code on same input
and compares outputs. Used to verify parity before cutover.

**Monetary Delta**: Difference in monetary output between COBOL and new code.
Must be ZERO. Any non-zero delta halts migration and requires investigation.

**Feature Flag**: Runtime toggle controlling which code path handles a request.
Used to route traffic between COBOL and new code during transition.
`,
}
