/**
 * React 18 + Next.js 14 (App Router) frontend harness template.
 *
 * Layered: app router → server components → client components → hooks → utils.
 * Covers next-intl i18n, Temporal/date-fns date handling, server-first state,
 * pre-formatted money display, WAI-ARIA accessibility, and axe-core gate.
 */

import type { Template } from '../index.js'
import { minimalTemplate } from '../minimal/index.js'

export const reactNextjsTemplate: Template = {
  ...minimalTemplate,

  'rules/architecture.md': `# Architecture Rules — React 18 / Next.js 14 (App Router)

## Layered Architecture

\`\`\`
app/                        # Next.js App Router — file-system routing
  (public)/                 # Unauthenticated routes
  (dashboard)/              # Authenticated routes — shared layout
  api/                      # Route Handlers (server-side API endpoints)
  layout.tsx                # Root layout — providers, fonts, metadata
components/
  ui/                       # Pure presentational — no data fetching, no business logic
  features/                 # Feature-coupled — may call server actions or queries
lib/
  actions/                  # Server Actions — mutations only, Zod-validated input
  queries/                  # Server-side data fetching — async functions, no ORM
  clients/                  # External API clients — server-side only
  utils/                    # Pure isomorphic utilities (no Node or browser APIs)
hooks/                      # Custom React hooks — client-side only
types/                      # Shared TypeScript types and Zod schemas
public/                     # Static assets
\`\`\`

## Server vs Client Boundary

- Default: Server Components — no \`"use client"\` unless explicitly needed
- \`"use client"\` only for: event handlers, browser APIs (\`window\`, \`localStorage\`), React state/effects
- \`"use server"\` marks Server Actions in \`lib/actions/\`
- Guard server-only modules with \`import 'server-only'\` at top of file
- Never import DB clients, secrets, or \`fs\` into client components

## Data Fetching Rules

- Fetch in Server Components; pass data down as props to Client Components
- No \`useEffect\` for initial data fetching — use \`lib/queries/\` + Suspense
- \`cache()\` (React cache) for deduplication within a single render pass
- \`revalidatePath\` / \`revalidateTag\` for on-demand ISR after mutations
- Streaming: wrap slow components in \`<Suspense fallback={...}>\`

## State Management Rules

- URL state (search params) for shareable/bookmarkable state
- \`useState\` / \`useReducer\` for ephemeral UI state (local to component)
- \`useOptimistic\` for optimistic updates with Server Actions
- Global client stores (Zustand/Jotai) only if justified by cross-route state; document in ADR
- No Redux — too much boilerplate for App Router patterns

## Component Rules

- \`components/ui/\`: zero side effects, zero data fetching, fully controlled via props
- \`components/features/\`: may call Server Actions directly; document data dependencies
- File naming: PascalCase for components, kebab-case for pages
- Co-locate component styles in \`<ComponentName>.module.css\` adjacent to component

## Accessibility Rules

- All interactive elements keyboard accessible (Tab + Enter/Space)
- \`aria-\` attributes required on custom controls (custom dropdown, modal, tooltip)
- Color contrast minimum WCAG AA: 4.5:1 for normal text, 3:1 for large text
- Images: meaningful \`alt\` text; decorative images use \`alt=""\`
- Focus management: modals must trap focus; closing returns focus to trigger element
`,

  'rules/coding.md': `# Coding Rules — React 18 / Next.js 14

## Internationalization (next-intl)

- No hardcoded user-visible strings in TSX or TS source files
- All UI text via \`useTranslations\` hook (client) or \`getTranslations\` (server)
- Translation keys: dot-notation namespaces matching file structure (e.g., \`dashboard.orders.title\`)
- When adding strings: update \`messages/{locale}.json\` for ALL locales simultaneously
- CI must run translation completeness check (no missing keys in any locale)
- Number, date, currency formatting: always use \`useFormatter\` from next-intl

## Date / Time

- Never use \`new Date(string)\` — timezone-sensitive and ambiguous
- Preferred: \`date-fns\` or \`@js-temporal/polyfill\` (\`Temporal\` API)
- Display formatting: always use \`useFormatter\` from next-intl (respects locale)
- Storage: ISO 8601 strings or Unix epoch integers from API; parse at display boundary only
- Never compute date arithmetic in frontend; delegate to backend API
- \`Date\` constructor allowed only with explicit UTC epoch: \`new Date(epochMs)\`

## Money Display

- Frontend never performs monetary arithmetic — receive pre-formatted values from API
- Display: \`useFormatter().number(amount, { style: 'currency', currency: 'USD' })\`
- Never use \`toFixed(2)\` or manual string formatting for currency display
- API must return monetary values as strings (not floats) to prevent JSON precision loss
- If raw cents (integer) received: divide by 100 only for display, then format via next-intl

## Server Components (Default)

- Async server components fetch their own data via \`lib/queries/\`
- Use \`import { cache } from 'react'\` for request-level deduplication
- Do not pass server data through many component layers — fetch close to where data is used
- Mark expensive components with \`<Suspense>\` for streaming

## Client Components (\`"use client"\`)

- Minimize \`"use client"\` surface — push boundary as low as possible
- Never import \`lib/queries/\` or \`lib/clients/\` in client components
- Data props: pass only serializable data (no functions, no class instances) across boundary

## Server Actions (\`lib/actions/\`)

- Validate all input with Zod at the action entry point (never trust FormData)
- Return typed results: \`{ success: true; data: T } | { success: false; error: string }\`
- Call \`revalidatePath\` / \`revalidateTag\` after successful mutations
- Never perform user-facing redirects inside try/catch (Next.js throws internally)

## Accessibility

- WAI-ARIA: use semantic HTML first (\`<button>\`, \`<nav>\`, \`<main>\`, \`<article>\`)
- Custom controls: \`role\`, \`aria-label\`, \`aria-expanded\`, \`aria-controls\` as appropriate
- Form fields: always \`<label htmlFor>\` or \`aria-labelledby\`
- Error messages: \`aria-describedby\` linking field to error text
- Skip navigation link: \`<a href="#main-content">\` as first focusable element on each page

## TypeScript

- \`strict: true\` always
- No \`any\` without justification comment
- Props interfaces: explicit type, no inline \`{}\` objects for complex shapes
- Server Action return types: explicitly typed (not inferred from body)
- Zod schemas are source of truth for form/action types; derive TS types via \`z.infer<>\`

## Tests

- \`bun test\` (Bun test runner) with React Testing Library
- Unit: pure component rendering, no network
- Integration: user event flows with \`@testing-library/user-event\`
- Accessibility: \`axe-core\` (via \`jest-axe\` or \`@axe-core/react\`) on every page component
- E2E: Playwright for critical flows (auth, checkout, form submission)
`,

  'rules/workflow.md': `# Workflow Rules — React / Next.js Frontend

## 10-Phase Pipeline

| Phase | Entry Condition | Exit Condition | Rollback Trigger |
|-------|----------------|----------------|-----------------|
| 1. Requirements | Design mockups reviewed | Requirements + a11y criteria defined | Scope ambiguity |
| 2. Design | Phase 1 done | Component tree + data flow diagram | Architecture conflict |
| 3. Test Spec | Phase 2 done | Test plan with a11y assertions | Coverage targets missing |
| 4. Implementation | Phase 3 done | Code + tests pass | \`bun test\` fails |
| 5. Code Review | Phase 4 done | Reviewer APPROVE | Client/server boundary violation |
| 6. Integration Test | Phase 5 done | All routes render + a11y scan clean | Critical a11y failure |
| 7. Performance | Phase 6 done | Core Web Vitals within target | LCP/CLS regression |
| 8. Security | Phase 7 done | CSP configured + \`npm audit\` clean | XSS vector found |
| 9. Deploy Plan | Phase 8 done | Preview deployment verified | i18n missing locale |
| 10. Confirm | Phase 9 done | Production smoke test + a11y passes | Fatal error |

## Gate Standard

All gates verified via \`bun test\`, \`npm run typecheck\`, \`next build\`, and \`eslint .\`.
Accessibility gate uses axe-core scan.

## Rollback Policy

- Phases 4–10: gate failure triggers rollback to previous phase
- Three consecutive failures: require human approval
- All rollbacks recorded in audit log
`,

  'skills/plan.md': `# Planning SOP — React / Next.js Frontend

## Purpose

Produce a structured plan before writing any TSX code.
Prevents client/server boundary violations and missing i18n strings.

## Step 1: Requirements Decomposition

1. List new routes (app/ pages) and their data requirements
2. Identify which components are Server vs Client (mark \`"use client"\`)
3. List new Server Actions needed for mutations
4. Identify i18n strings to add (locale file keys)

## Step 2: Architecture Impact

1. Draw component tree — note server/client boundary
2. Verify no DB/secrets imported into client components
3. Plan Suspense boundaries for streaming
4. Confirm \`lib/queries/\` covers all new data fetching

## Step 3: Risk Identification

- i18n: list all new user-visible strings; confirm all locale files updated
- Accessibility: list custom interactive elements requiring ARIA
- Money display: confirm pre-formatted strings from API (no frontend arithmetic)
- Date display: confirm next-intl formatter used (not raw toLocaleDateString)

## Step 4: Test Planning

1. List component tests (RTL render + user event)
2. List axe-core accessibility assertions
3. Identify Playwright E2E tests for critical flows

## Step 5: Sequence

Types + Zod schemas → Server queries → Server Actions → Server Components → Client Components → Tests
`,

  'skills/implement-by-layer.md': `# Implement By Layer SOP — React / Next.js

## Purpose

Implement features through the App Router architecture, ensuring server/client
boundary is respected at every step.

## Prerequisites

- Component tree diagram reviewed
- i18n keys drafted in all locale files
- \`bun test\` green on existing tests before starting

## Step 1: Types and Schemas

1. Define TypeScript interfaces in \`types/\`
2. Define Zod schemas for Server Action inputs and API responses
3. Derive TS types: \`type Foo = z.infer<typeof FooSchema>\`
4. Write pure unit tests for any schema validators

## Step 2: Server Data Layer

1. Implement data fetching in \`lib/queries/\` (async functions, no ORM)
2. Wrap with \`cache()\` for request deduplication
3. Add \`import 'server-only'\` at top of each query file
4. Test: mock the underlying fetch and assert return shape

## Step 3: Server Actions

1. Create Server Actions in \`lib/actions/\`; mark with \`"use server"\`
2. Validate input with Zod at action entry
3. Call \`revalidatePath\` or \`revalidateTag\` on success
4. Return typed result: \`{ success: true; data } | { success: false; error }\`
5. Test: call action directly in tests (no HTTP needed)

## Step 4: Server Components

1. Create async Server Components in \`app/\` that call \`lib/queries/\`
2. Wrap slow sections in \`<Suspense fallback={<Skeleton />}>\`
3. Pass only serializable data as props to any Client Components
4. Add i18n: \`const t = await getTranslations('namespace')\`
5. Run: \`next build\` — must succeed before proceeding

## Step 5: Client Components

1. Add \`"use client"\` at top of file
2. Bind Server Actions to \`<form action={...}>\` or \`startTransition\`
3. Use \`useOptimistic\` for immediate UI feedback
4. Accessibility: add ARIA attributes on all custom interactive elements
5. i18n: \`const t = useTranslations('namespace')\`

## Step 6: Tests

1. RTL: render component, assert accessible text, fire user events
2. axe-core: \`await expect(container).toHaveNoViolations()\`
3. Run: \`bun test\` + \`npm run typecheck\` + \`eslint .\`

## Forbidden

- Hardcoded English strings in TSX (no i18n)
- \`useEffect\` for initial data fetching
- Importing \`lib/queries/\` or \`lib/clients/\` in \`"use client"\` components
- Monetary arithmetic in frontend (even display formatting must use next-intl)
- \`new Date(string)\` without explicit UTC epoch
`,

  'skills/review.md': `# Review SOP — React / Next.js Frontend

## Purpose

Verify implementation is production-ready before advancing to the next phase.

## Architecture Checklist

- [ ] No server-only imports (\`lib/queries/\`, DB clients) in client components
- [ ] \`"use client"\` boundary as narrow as possible (pushed to leaves)
- [ ] Server Actions in \`lib/actions/\` only; marked with \`"use server"\`
- [ ] \`import 'server-only'\` at top of all server-only modules

## Coding Standards Checklist

- [ ] No hardcoded user-visible strings — all via next-intl
- [ ] All locale files updated with new keys
- [ ] Money displayed via \`useFormatter\` — no manual \`toFixed\` or arithmetic
- [ ] Date displayed via \`useFormatter\` — no \`new Date(string)\`, no \`toLocaleDateString\`
- [ ] Server Actions validate input with Zod before processing
- [ ] \`revalidatePath\` / \`revalidateTag\` called after mutations

## Accessibility Checklist

- [ ] All custom interactive elements have ARIA roles and attributes
- [ ] Images have meaningful \`alt\` text (or \`alt=""\` for decorative)
- [ ] Form fields linked to labels via \`htmlFor\` or \`aria-labelledby\`
- [ ] axe-core scan passes with zero violations
- [ ] Keyboard navigation tested manually (Tab, Enter, Space, Escape)
- [ ] Color contrast ≥ 4.5:1 for normal text (WCAG AA)

## TypeScript Checklist

- [ ] \`npm run typecheck\` exits 0
- [ ] No \`any\` without justification comment
- [ ] Server Action return types explicitly typed

## Test Checklist

- [ ] \`bun test\` exits 0
- [ ] axe-core assertion in every page component test
- [ ] Zod validation rejection tested per schema
- [ ] \`next build\` succeeds

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

  'skills/test.md': `# Test SOP — React / Next.js Frontend

## Test Pyramid

- Unit tests (50%): RTL component rendering, no network
- Interaction tests (30%): RTL + \`@testing-library/user-event\` for user flows
- E2E tests (20%): Playwright for critical cross-page flows

## Unit Test Standard

1. One test file per component (\`ComponentName.test.tsx\` adjacent)
2. Render with required props; assert accessible text content
3. Test loading states (Suspense fallback)
4. Test error states (error.tsx boundaries)
5. Run: \`bun test\`

## Accessibility Test Standard

\`\`\`tsx
import { axe } from 'jest-axe'

it('has no accessibility violations', async () => {
  const { container } = render(<MyPage />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
\`\`\`

Every page component must have this test. Custom interactive components must also.

## Interaction Test Standard

1. Use \`userEvent.setup()\` (not \`fireEvent\`) for realistic user interactions
2. Test: click button → assert Server Action called → assert UI updates
3. Test: form submission → Zod validation error displayed
4. Test: keyboard navigation — Tab through interactive elements
5. Assert: focus returns to trigger element after modal close

## i18n Test Standard

- Render with \`NextIntlClientProvider\` mock wrapper
- Assert translated text (not translation keys) appears in component
- Test fallback behavior for missing translation keys

## E2E Standard (Playwright)

- Critical flows: authentication, payment, form submission
- Mobile viewport tested alongside desktop
- Accessibility: run \`@axe-core/playwright\` scan in E2E tests too

## Core Web Vitals

Before Phase 7 gate: run \`next build\` + Lighthouse CI.
Targets: LCP < 2.5s, FID < 100ms, CLS < 0.1.
`,

  'agents/pm.md': `# Agent: Project Manager — React / Next.js Frontend

## Identity

You are a senior technical PM experienced in React frontend projects.
You understand Next.js App Router lifecycle, Core Web Vitals,
and accessibility compliance requirements (WCAG AA).

## Responsibilities

- Own requirements doc; ensure a11y criteria are explicit in acceptance conditions
- Gate phase transitions; reject if \`bun test\` or \`next build\` fails
- Track i18n completeness as deployment blocker (missing locale = production bug)
- Ensure money display uses next-intl (not manual formatting) in acceptance criteria

## Phase Gate Authority

- Approve transition only when \`bun test\` + \`npm run typecheck\` + \`next build\` + \`eslint .\` all pass
- Require axe-core scan clean before Phase 6 gate
- Require Lighthouse CI scores within target before Phase 7 gate
`,

  'agents/developer.md': `# Agent: Developer — React 18 / Next.js 14

## Identity

You are a senior frontend engineer specializing in Next.js App Router,
React Server Components, and accessible UI development.
You follow the architecture rules and every rule in \`harness/rules/coding.md\`.

## Implementation Order

Types + Zod schemas → Server queries → Server Actions → Server Components → Client Components → Tests.
Never write a Client Component before its Server Component data flow is verified.

## Server-First Mindset

- Default to Server Components; add \`"use client"\` only when justified
- Push \`"use client"\` boundary as low as possible (leaf components)
- Fetch data close to where it is rendered; avoid prop drilling through many layers

## i18n Rules (Non-Negotiable)

- Every user-visible string through next-intl — no exceptions
- Add keys to ALL locale files simultaneously, never one at a time
- Use \`getTranslations\` in server context, \`useTranslations\` in client context

## Money Display Rules (Non-Negotiable)

- Receive pre-formatted strings from API where possible
- If receiving integer cents: \`formatter.number(cents / 100, { style: 'currency', currency })\`
- Never \`toFixed(2)\` — use \`useFormatter\` from next-intl always

## Output Format

Produce files in order:
1. \`types/\` interfaces + Zod schemas + unit tests
2. \`lib/queries/\` server data functions
3. \`lib/actions/\` Server Actions + Zod validation
4. Server Components (\`app/\` pages) + Suspense boundaries
5. Client Components + ARIA attributes
6. RTL tests + axe-core assertions
`,

  'agents/reviewer.md': `# Agent: Reviewer — React / Next.js Frontend

## Identity

You are a principal frontend engineer focused on Next.js App Router correctness,
accessibility compliance, and i18n completeness.

## Primary Review Concerns

1. Client/server boundary — does any client component import server-only modules?
2. Hardcoded strings — any user-visible text without next-intl?
3. Money display — any \`toFixed\` or manual arithmetic instead of useFormatter?
4. Missing ARIA — custom interactive elements without accessibility attributes?
5. \`useEffect\` for data fetching — should be server component instead?

## Review Process

1. Run \`npm run typecheck\` — must exit 0
2. Run \`bun test\` — must exit 0 including axe-core assertions
3. Run \`eslint .\` — zero errors
4. Run \`next build\` — must succeed
5. Inspect all \`"use client"\` files for server-only imports
6. Check all locale files for missing translation keys

## Verdict Rules

- REJECT: hardcoded string, client import of server-only, money arithmetic in frontend
- APPROVE-WITH-FIXES: missing aria-label on non-critical element, axe warning (not error)
- APPROVE: all checks clean, axe-core zero violations
`,

  'agents/tester.md': `# Agent: Tester — React / Next.js Frontend

## Identity

You are a senior QA engineer specializing in RTL component testing,
axe-core accessibility auditing, and Playwright E2E for Next.js.

## Test Strategy

- Unit: RTL render assertions, no network
- Interaction: RTL + userEvent for user flows
- Accessibility: axe-core on every page and custom component
- E2E: Playwright for critical cross-page flows

## Entry Criteria

- \`bun test\` passes before E2E tests written
- Next.js dev server running for Playwright tests
- All locale files complete (no missing translation keys)

## Test Case Specification

\`\`\`
Test: <component>_<scenario>_<expected>
Given: <render props / mocked data>
When: <user interaction via userEvent>
Then: <accessible text assertion> + <aria-state assertion>
A11y: <axe-core result: no violations>
\`\`\`

## Accessibility Test Policy

Every page component test must include axe-core assertion.
Custom components (modal, dropdown, tooltip, tabs) additionally need:
- Keyboard navigation test (Tab, Enter, Space, Escape)
- Focus management test
- Screen reader announcement test (aria-live or aria-label)

## i18n Test Policy

Every component rendering user-visible text must:
- Be wrapped in \`NextIntlClientProvider\` in tests
- Assert translated text appears (not raw translation key)
- Test RTL locale if bidirectional layout support required

## Coverage Gate

Run \`bun test --coverage\`. Gate fails if line < 80% or branch < 70%.
Separate axe-core gate: zero accessibility violations on all page components.
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
    timeout: 15m
    checks:
      - type: shell
        command: bun test
        expected_exit: 0
      - type: shell
        command: next build
        expected_exit: 0
      - type: shell
        command: eslint .
        expected_exit: 0
      - type: harness-lint

  gate-integration-test:
    phase: integration-test
    timeout: 20m
    checks:
      - type: shell
        command: bun test
        expected_exit: 0
      - type: shell
        command: axe-core scan --exit-code-violations
        expected_exit: 0
      - type: unit-test
        expected:
          passing_ratio: ">=95%"

  gate-performance:
    phase: performance
    timeout: 20m
    checks:
      - type: shell
        command: next build
        expected_exit: 0
      - type: shell
        command: lighthouse-ci collect
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
      - preserve_axe_report
      - notify_team

  performance:
    on_gate_failure: rollback_to_integration_test
    cleanup:
      - preserve_lighthouse_report

  security:
    on_gate_failure: rollback_to_performance
    cleanup:
      - preserve_audit_report

  confirm:
    on_gate_failure: rollback_to_deploy_plan
    cleanup:
      - trigger_incident
`,

  'context/session.md': `# Session Context — React / Next.js Frontend

## Always Active

Injected at session start for every conversation.

## Project Stack

- React 18, Next.js 14 App Router, TypeScript 5
- i18n: next-intl
- Validation: Zod + react-hook-form
- Styling: Tailwind CSS or CSS Modules
- Test: bun test + React Testing Library + jest-axe + Playwright
- Quality: TypeScript strict, ESLint (eslint-plugin-jsx-a11y), next build

## Critical Rules (Never Violate)

1. No hardcoded user-visible strings. All via next-intl.
2. No monetary arithmetic in frontend. Display via useFormatter only.
3. No new Date(string). Use date-fns or Temporal polyfill + useFormatter.
4. No "use client" on files importing lib/queries/ or lib/clients/.
5. axe-core must pass with zero violations on all page components.
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

  'context/on-demand-glossary.md': `# On-Demand Glossary — React / Next.js Frontend

## Terms

**Server Component**: React component that renders on the server only.
No useState, no useEffect, no browser APIs. Default in Next.js App Router.

**Client Component**: React component marked with "use client".
Has access to browser APIs, useState, event handlers.
Should be pushed to leaf nodes of the component tree.

**Server Action**: Async function marked with "use server".
Runs on server; called from client components or forms.
Validates input with Zod; calls revalidatePath after mutations.

**next-intl useTranslations**: Client-side translation hook.
Use in "use client" components. Keys are dot-notation namespace paths.

**next-intl getTranslations**: Server-side translation function (async).
Use in Server Components and Server Actions.

**useFormatter**: next-intl hook for locale-aware number, date, and currency formatting.
Always use for money display instead of toFixed or Intl.NumberFormat directly.

**Temporal API**: TC39 proposal for modern date/time handling.
Fixes timezone and arithmetic problems of the Date object.
Use @js-temporal/polyfill until browsers support it natively.

**axe-core**: Automated accessibility testing engine from Deque Systems.
Detects WCAG violations in rendered HTML. Run via jest-axe in unit tests.

**WCAG AA**: Web Content Accessibility Guidelines level AA.
Minimum accessibility standard for production web applications.
Color contrast: 4.5:1 for normal text, 3:1 for large text.

**revalidatePath**: Next.js function that purges cache for a route path.
Call after Server Action mutations to trigger fresh data fetch.
`,
}
