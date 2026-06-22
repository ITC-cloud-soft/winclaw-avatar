/**
 * Python 3.11 + Django 4 + DRF harness template.
 *
 * Django app-layer architecture: serializers / views / models / services.
 * Covers decimal.Decimal money handling, select_related/prefetch_related N+1 prevention,
 * DRF permission_classes, ugettext_lazy i18n, async views, mypy, ruff, and pytest.
 */

import type { Template } from '../index.js'
import { minimalTemplate } from '../minimal/index.js'

export const pythonDjangoTemplate: Template = {
  ...minimalTemplate,

  'rules/architecture.md': `# Architecture Rules — Python 3.11 / Django 4 / DRF

## Django App Structure

Each app owns one bounded context. Internal layout:

\`\`\`
<app>/
  models.py          # ORM models — field definitions + clean() only
  serializers.py     # DRF serializers — validation + representation
  views.py           # DRF ViewSets — HTTP handling only
  services.py        # Business logic — pure Python, no request object
  tasks.py           # Celery tasks — always idempotent + retry-safe
  permissions.py     # Custom DRF permission classes
  selectors.py       # Read-only query helpers (QuerySets only)
  urls.py            # URL routing for this app
  tests/
    test_models.py
    test_serializers.py
    test_services.py
    test_views.py
    test_tasks.py
\`\`\`

## Layer Rules

- \`views.py\` calls \`services.py\` or \`selectors.py\`; never queries ORM directly
- \`services.py\` accepts domain primitives or model instances — never \`request\`
- \`models.py\`: field definitions and \`clean()\` only; no business methods
- \`selectors.py\`: read-only QuerySets; never mutates DB; used only by views
- Celery tasks: idempotent, retry-safe; log all failures with structured data

## Django-Specific Rules

- \`select_related\` / \`prefetch_related\` required on all QuerySets accessing relations
- All model changes via Migrations; never \`migrate --run-syncdb\` in production
- \`settings.py\` uses environment variables for secrets (via \`django-environ\` or \`python-decouple\`)
- Custom user model required from project start; cannot retroactively add
- \`AUTH_USER_MODEL\` set in \`settings.py\` before first migration

## REST Framework Conventions

- ViewSets + DefaultRouter for standard CRUD; explicit \`basename\` always set
- Explicit \`permission_classes\` on every ViewSet — never rely on global default
- Pagination required on all list endpoints: \`PageNumberPagination\` or \`CursorPagination\`
- Explicit \`serializer_class\` and \`queryset\` on all ViewSets
- Nested resources: use explicit \`lookup_field\` and \`parent_lookup_kwargs\`

## Async Rules

- Async views: \`async def\` ViewSet methods allowed with Django 4.1+
- ORM calls inside async views must use \`database_sync_to_async\` wrapper
- Celery tasks remain synchronous; async Celery requires explicit configuration

## Module Boundaries

Each app package must be describable in one sentence.
Apps must not import from sibling apps' \`models\` directly — use public service APIs.
Shared utilities belong in \`common/\` or \`core/\` app.
`,

  'rules/coding.md': `# Coding Rules — Python 3.11 / Django 4 / DRF

## Money / Price

- Monetary values: \`decimal.Decimal\` with explicit \`decimal.Context\`
- Never use \`float\` for money — Python floats have binary precision issues
- Django model field: \`DecimalField(max_digits=12, decimal_places=2)\`
- Arithmetic: use \`Decimal\` operations; never cast to \`float\` mid-calculation
- Comparison: \`==\` works correctly for \`Decimal\`; document precision expectations in ADR
- Rounding: explicit \`quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)\`

## Internationalization

- No hardcoded user-visible strings in Python code or templates
- Use \`gettext_lazy\` (aliased as \`_\`) for all user-facing strings
- Import: \`from django.utils.translation import gettext_lazy as _\`
- When adding strings: update \`locale/{lang}/LC_MESSAGES/django.po\` for all languages
- CI must run \`django-admin makemessages\` and fail if new untranslated strings exist
- Model \`verbose_name\` and \`verbose_name_plural\` always wrapped with \`_(...)\`

## Database / QuerySet Rules

- Never access ORM relations inside a loop without \`select_related\` or \`prefetch_related\`
- N+1 detection: use \`django-silk\` or assert query count in tests via \`django.test.utils.override_settings\`
- \`QuerySet.only()\` and \`defer()\` for large models where not all fields are needed
- Bulk operations: \`bulk_create()\`, \`bulk_update()\` for multi-row writes; never loop inserts
- Transactions: \`transaction.atomic()\` decorator or context manager; never nested \`atomic()\` without explicit savepoints
- Raw SQL: \`RawSQL\` or \`cursor.execute()\` only in \`selectors.py\` with explicit justification comment

## DRF Permissions

- Every ViewSet has explicit \`permission_classes = [...]\` — empty list allowed only for public endpoints with comment
- Custom permission classes inherit \`BasePermission\`; \`has_object_permission\` implemented when needed
- Never override \`has_permission\` to return \`True\` unconditionally without comment

## Async Views

\`\`\`python
from asgiref.sync import database_sync_to_async

async def get_queryset(self):
    return await database_sync_to_async(
        lambda: MyModel.objects.select_related('related').filter(active=True)
    )()
\`\`\`

- Every ORM call inside \`async def\` must be wrapped with \`database_sync_to_async\`
- Never call synchronous ORM in async context without wrapper — causes \`SynchronousOnlyOperation\`

## Logging

- Use Python standard \`logging\` module with Django's \`LOGGING\` config
- Structured logging via \`python-json-logger\`; key-value context in \`extra={}\`
- PII (email, phone, national ID) must pass through \`mask_pii()\` before logging
- Log levels: ERROR = human intervention, WARNING = abnormal/auto-recovering,
  INFO = business event, DEBUG = dev only

## Error Handling

- Business errors: subclass \`APIException\` with explicit \`status_code\` and \`default_code\`
- System errors: let Django/DRF exception handler log and return 500; never swallow
- Never catch bare \`Exception\` without re-raise or explicit documented reason
- Validation errors: raise \`serializers.ValidationError\` from serializer \`validate_*\` methods

## Type Annotations

- All public functions and methods have type annotations (mypy enforced)
- Use \`from __future__ import annotations\` for forward references
- \`TypedDict\` for dict structures passed between layers
- \`Protocol\` for duck-typed interfaces at service boundaries

## Tests

- pytest + pytest-django; never Django \`TestCase\` unless specifically needed
- Minimum 5 test cases per service function
- Factory Boy for test fixtures; never raw \`Model.objects.create()\` in tests
- Coverage: line ≥ 80%, branch ≥ 70% (enforced by pytest-cov in CI)
`,

  'rules/workflow.md': `# Workflow Rules — Python / Django / DRF

## 10-Phase Pipeline

| Phase | Entry Condition | Exit Condition | Rollback Trigger |
|-------|----------------|----------------|-----------------|
| 1. Requirements | Stakeholder approval | Requirements doc v1 | Scope ambiguity |
| 2. Design | Phase 1 done | ADR + app boundary diagram | Architecture conflict |
| 3. Test Spec | Phase 2 done | Test plan with fixture list | Coverage targets missing |
| 4. Implementation | Phase 3 done | Code + tests pass | \`pytest\` fails |
| 5. Code Review | Phase 4 done | Reviewer APPROVE | Layer violation |
| 6. Integration Test | Phase 5 done | All endpoints pass | Critical bug |
| 7. Performance | Phase 6 done | QuerySet counts within target | N+1 detected in prod path |
| 8. Security | Phase 7 done | \`bandit\` + \`safety\` clean | High severity finding |
| 9. Deploy Plan | Phase 8 done | Migration plan + rollback script | Procedure incomplete |
| 10. Confirm | Phase 9 done | Production smoke test passes | Fatal error |

## Gate Standard

All gates verified via \`pytest --cov\`, \`mypy .\`, and \`ruff check\`.
Migration safety checked before Phase 9 gate.

## Rollback Policy

- Phases 4–10: gate failure triggers rollback to previous phase
- Three consecutive failures: require human approval
- All rollbacks recorded in audit log
`,

  'skills/plan.md': `# Planning SOP — Python / Django / DRF

## Purpose

Produce a structured implementation plan before writing any Python code.
Prevents N+1 queries and missing i18n strings from reaching production.

## Step 1: Requirements Decomposition

1. Identify which Django apps are affected
2. List new models, fields, and required migrations
3. List new ViewSets and their HTTP methods
4. Identify external API calls (requires resilience wrapper)

## Step 2: Architecture Impact

1. Verify new views call only services/selectors — not ORM directly
2. Verify services are pure Python (no request object)
3. Plan \`select_related\`/\`prefetch_related\` for each new QuerySet
4. List migration operations and check for table-lock risk (large tables)

## Step 3: Risk Identification

- Money fields: confirm \`DecimalField\` + \`decimal.Decimal\` arithmetic
- i18n: list all user-visible strings; confirm \`gettext_lazy\` applied
- N+1: identify relation traversals; plan QuerySet optimization
- Permissions: confirm \`permission_classes\` defined for every new ViewSet

## Step 4: Test Planning

1. List pytest cases (minimum 5 per service function)
2. List Factory Boy factories needed for fixtures
3. Identify QuerySet count assertions for N+1 detection

## Step 5: Sequence

Models + migrations → Serializers → Services/Selectors → ViewSets + URLs → Celery tasks → Tests
`,

  'skills/implement-by-layer.md': `# Implement By Layer SOP — Python / Django / DRF

## Purpose

Implement features through Django's app structure, ensuring each layer
is independently testable before the next is written.

## Prerequisites

- Migration plan reviewed and approved
- Factory Boy factories identified for all affected models
- \`pytest\` green on existing tests before starting

## Step 1: Models Layer

1. Define model fields with correct types (\`DecimalField\` for money)
2. Wrap \`verbose_name\` with \`gettext_lazy\`
3. Implement \`clean()\` for model-level invariants
4. Generate migration: \`python manage.py makemigrations\`
5. Review migration SQL: \`python manage.py sqlmigrate <app> <num>\`
6. Write \`test_models.py\` with Factory Boy; run pytest

## Step 2: Serializers Layer

1. Define \`ModelSerializer\` with explicit \`fields\` list (never \`__all__\`)
2. Add \`validate_<field>\` methods for business validation
3. Money fields: serialize as string to avoid float JSON precision loss
4. Write \`test_serializers.py\` — valid + invalid input cases

## Step 3: Services / Selectors Layer

1. \`services.py\`: mutation functions (accept primitives, return model instances)
2. \`selectors.py\`: read-only QuerySets with \`select_related\`/\`prefetch_related\`
3. Money arithmetic: \`Decimal\` only; quantize before persistence
4. Write \`test_services.py\` with mock-free unit tests (use real test DB)
5. Run pytest; assert query count for N+1 detection

## Step 4: ViewSets Layer

1. Create ViewSet with explicit \`permission_classes\` and \`serializer_class\`
2. List endpoint in \`urls.py\` via \`DefaultRouter\`
3. Add pagination class to list actions
4. Write \`test_views.py\` using DRF \`APIClient\`; test auth + business happy/error paths
5. Run: \`pytest tests/test_views.py\`

## Step 5: Celery Tasks

1. Implement task in \`tasks.py\`; decorate with \`@shared_task(bind=True, max_retries=3)\`
2. Ensure idempotency: check state before performing action
3. Write \`test_tasks.py\` with \`@override_settings(CELERY_TASK_ALWAYS_EAGER=True)\`
4. Run: \`pytest --cov\` + \`mypy .\` + \`ruff check\`

## Forbidden

- Accessing ORM in views without selector/service abstraction
- Using \`float\` for monetary arithmetic anywhere
- Missing \`permission_classes\` on any ViewSet
- Untranslated user-visible string literals
`,

  'skills/review.md': `# Review SOP — Python / Django / DRF

## Purpose

Verify implementation is production-ready before advancing to the next phase.

## Architecture Checklist

- [ ] Views call only services/selectors — no direct ORM in views
- [ ] Services accept primitives — no \`request\` object in service layer
- [ ] Models contain only field definitions and \`clean()\`
- [ ] Tasks are idempotent and handle \`MaxRetriesExceededError\`

## Coding Standards Checklist

- [ ] Money fields use \`DecimalField\` + \`decimal.Decimal\` arithmetic; no \`float\`
- [ ] All user-visible strings wrapped with \`gettext_lazy\`
- [ ] \`select_related\`/\`prefetch_related\` on all QuerySets accessing relations
- [ ] Explicit \`permission_classes\` on every ViewSet
- [ ] \`database_sync_to_async\` wrapper on all ORM calls in async views
- [ ] PII masked before logging
- [ ] All public functions have type annotations (\`mypy .\` clean)

## Test Checklist

- [ ] \`pytest --cov\` exits 0; line ≥ 80%, branch ≥ 70%
- [ ] \`mypy .\` exits 0
- [ ] \`ruff check\` exits 0
- [ ] Every ViewSet has \`APIClient\` tests (happy + auth error + validation error)
- [ ] N+1 assertions in tests for all relation-accessing QuerySets

## Migration Checklist

- [ ] Migration reviewed via \`sqlmigrate\` — no table locks on large tables
- [ ] Migration is reversible (define \`database_backwards\` for custom operations)
- [ ] No data migration in the same transaction as schema migration for large tables

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

  'skills/test.md': `# Test SOP — Python / Django / DRF

## Test Pyramid

- Unit tests (60%): pure Python, no DB, Factory Boy stubs
- Integration tests (30%): real SQLite/PostgreSQL via pytest-django, APIClient
- E2E tests (10%): full stack via \`LiveServerTestCase\` or Playwright

## Unit Test Standard

1. One test file per source file; co-located in \`tests/\` within the app
2. Minimum 5 cases: happy path, invalid input, edge case, error, idempotency
3. Use \`@pytest.fixture\` and Factory Boy; no raw \`Model.objects.create()\`
4. \`pytest.raises\` for exception assertions; check \`exc_info.value.code\` for DRF errors
5. Run: \`pytest tests/ -x --tb=short\`

## Integration Test Standard

1. \`@pytest.mark.django_db\` on all tests that touch the DB
2. DRF \`APIClient\` for HTTP simulation; set credentials via \`force_authenticate\`
3. Assert response status code + response body structure
4. Assert DB state after mutations
5. Query count assertion: \`django.test.utils.CaptureQueriesContext\`

## N+1 Detection

\`\`\`python
from django.test.utils import CaptureQueriesContext
from django.db import connection

def test_list_orders_no_n_plus_one(api_client, order_factory):
    order_factory.create_batch(10)
    with CaptureQueriesContext(connection) as ctx:
        response = api_client.get('/api/orders/')
    assert len(ctx) <= 3  # Adjust to expected count
\`\`\`

## Coverage Gate

Run \`pytest --cov=. --cov-report=term-missing\`.
Gate fails if: line < 80% OR branch < 70%.
`,

  'agents/pm.md': `# Agent: Project Manager — Python Django

## Identity

You are a senior technical PM experienced in Django REST API projects.
You understand migration risks, Celery task failure modes,
and DRF permission model complexity.

## Responsibilities

- Own requirements doc and ADR index
- Gate phase transitions; reject if \`pytest\` or \`mypy\` fails
- Track migration safety as deployment risk (table lock on large tables)
- Ensure Decimal money fields in acceptance criteria

## Phase Gate Authority

- Approve transition only when \`pytest --cov\` + \`mypy .\` + \`ruff check\` all exit 0
- Require \`bandit\` clean before Phase 8 (Security)
`,

  'agents/developer.md': `# Agent: Developer — Python / Django / DRF

## Identity

You are a senior Python engineer with deep Django expertise.
You follow the app-layer architecture and every rule in \`harness/rules/coding.md\`.

## Implementation Order

Models + migrations → Serializers → Services/Selectors → ViewSets → Tasks → Tests.
Never write a ViewSet before its service tests are green.

## Money Rules (Non-Negotiable)

- \`decimal.Decimal\` + \`quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)\`
- Django model: \`DecimalField(max_digits=12, decimal_places=2)\`
- Never cast to \`float\`; never use \`float\` literals in monetary arithmetic

## i18n Rules

- Every user-visible string: \`from django.utils.translation import gettext_lazy as _\`
- \`_()\` on all model \`verbose_name\`, error messages, DRF \`detail\` strings

## Async Rules

- \`async def\` view methods: always wrap ORM calls with \`database_sync_to_async\`
- Document why a view is async; default to synchronous unless explicitly needed

## Output Format

Produce files in order:
1. Model + migration + test_models.py
2. Serializer + test_serializers.py
3. Service/Selector + test_services.py
4. ViewSet + URLs + test_views.py
5. Celery task + test_tasks.py
`,

  'agents/reviewer.md': `# Agent: Reviewer — Python Django

## Identity

You are a principal Python engineer focused on Django architecture correctness,
QuerySet N+1 prevention, and Decimal money handling.

## Primary Review Concerns

1. N+1 queries — are \`select_related\`/\`prefetch_related\` missing?
2. Money precision — is \`float\` used anywhere for monetary values?
3. Layer violations — do views bypass service layer to query ORM?
4. Missing permission_classes — is any ViewSet missing explicit permissions?
5. Untranslated strings — any user-visible string without \`gettext_lazy\`?

## Review Process

1. Run \`pytest --cov\` — must exit 0
2. Run \`mypy .\` — must exit 0
3. Run \`ruff check\` — must exit 0
4. Inspect QuerySets in views/selectors for missing prefetch
5. Check all \`permission_classes\` on ViewSets

## Verdict Rules

- REJECT: \`float\` for money, missing permission_classes, view queries ORM directly
- APPROVE-WITH-FIXES: missing select_related for non-critical path, minor mypy warning
- APPROVE: all checks clean, N+1 assertions present in tests
`,

  'agents/tester.md': `# Agent: Tester — Python Django

## Identity

You are a senior QA engineer specializing in pytest-django,
DRF APIClient testing, and N+1 query detection.

## Test Strategy

- Unit: pure Python, no DB, Factory Boy, fast
- Integration: real DB (\`@pytest.mark.django_db\`), APIClient
- Task: Celery eager mode (\`CELERY_TASK_ALWAYS_EAGER=True\`)

## Entry Criteria

- \`pytest\` passes before integration tests written
- Factory Boy factories created for all affected models
- DRF \`APIClient\` setup with authentication fixture

## Test Case Specification

\`\`\`
Test: <view>_<scenario>_<expected_status>
Given: <fixture state via Factory Boy>
When: <API call via APIClient>
Then: <status code> + <response body assertion> + <DB state assertion>
Query count: <max expected queries> (N+1 guard)
\`\`\`

## Decimal Test Policy

Every service function handling money must test:
- Zero amount (Decimal('0.00'))
- Maximum realistic amount
- Rounding: 0.005 rounds to 0.01 with HALF_EVEN
- String serialization: amount serialized as string in JSON (not float)

## Coverage Gate

Run \`pytest --cov=. --cov-report=term-missing\`.
Gate fails if: line < 80% OR branch < 70%.
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
        command: pytest --cov
        expected_exit: 0
      - type: shell
        command: mypy .
        expected_exit: 0

  gate-code-review:
    phase: code-review
    timeout: 10m
    checks:
      - type: shell
        command: pytest --cov
        expected_exit: 0
      - type: shell
        command: ruff check
        expected_exit: 0
      - type: harness-lint

  gate-integration-test:
    phase: integration-test
    timeout: 15m
    checks:
      - type: shell
        command: pytest --cov -m integration
        expected_exit: 0
      - type: unit-test
        expected:
          passing_ratio: ">=95%"

  gate-performance:
    phase: performance
    timeout: 15m
    checks:
      - type: shell
        command: pytest --cov
        expected_exit: 0

  gate-security:
    phase: security
    timeout: 10m
    checks:
      - type: shell
        command: bandit -r . -ll
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
      - preserve_bandit_report
      - notify_security_team

  confirm:
    on_gate_failure: rollback_to_deploy_plan
    cleanup:
      - trigger_incident
`,

  'context/session.md': `# Session Context — Python Django DRF

## Always Active

Injected at session start for every conversation.

## Project Stack

- Python 3.11, Django 4.x, Django REST Framework 3.x
- DB: PostgreSQL via psycopg3
- Async: ASGI + asgiref database_sync_to_async
- Tasks: Celery + Redis broker
- Test: pytest + pytest-django + Factory Boy + pytest-cov
- Quality: mypy, ruff, bandit

## Critical Rules (Never Violate)

1. Money = decimal.Decimal + quantize(Decimal('0.01'), ROUND_HALF_EVEN). Never float.
2. All user-visible strings: gettext_lazy. No hardcoded English strings.
3. select_related/prefetch_related on every QuerySet accessing relations.
4. Explicit permission_classes on every ViewSet.
5. ORM in async views: always database_sync_to_async.
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

  'context/on-demand-glossary.md': `# On-Demand Glossary — Python Django DRF

## Terms

**decimal.Decimal**: Python standard library arbitrary-precision decimal type.
Always use for monetary values. Context controls precision and rounding.

**ROUND_HALF_EVEN (Banker's Rounding)**: Rounds 0.5 to the nearest even digit.
Preferred for financial calculations to eliminate systematic rounding bias.

**gettext_lazy**: Django's lazy translation function.
Evaluated at render time (not import time), safe in class body.
Alias: from django.utils.translation import gettext_lazy as _

**select_related**: SQL JOIN-based prefetch for ForeignKey/OneToOne relations.
Used to prevent N+1 on forward relations.

**prefetch_related**: Separate query-based prefetch for ManyToMany and reverse FK.
Used when JOIN would cause row multiplication.

**database_sync_to_async**: asgiref wrapper that runs synchronous ORM code
in a thread pool, making it safe to call from async views.

**CaptureQueriesContext**: Django test utility for counting SQL queries.
Used in tests to assert N+1 absence.

**Factory Boy**: Python fixture library for creating test model instances.
Preferred over raw Model.objects.create() in tests.

**Celery shared_task**: Task decorator that works without app instance reference.
bind=True gives access to self for retry logic.
`,
}
