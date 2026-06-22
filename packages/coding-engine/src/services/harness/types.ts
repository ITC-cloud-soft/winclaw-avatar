/**
 * Harness Engineering — shared types.
 *
 * Implements the MVP scope per
 * docs/meta-coder/all-in-one/HARNESS_ENGINEERING_INTEGRATION.md §10.1.
 *
 * Layers:
 *   1. harness/ directory layout types (rules / skills / agents / workflow / context)
 *   2. Loader / validator / linter contracts
 *   3. Gate execution types (gate definition, check types, results)
 *   4. Init template types
 */

// ---------------------------------------------------------------------------
// 1. Directory layout & file types
// ---------------------------------------------------------------------------

export type HarnessTemplateName =
  | 'java-spring-enterprise'
  | 'node-fastapi'
  | 'python-django'
  | 'go-microservice'
  | 'react-nextjs-frontend'
  | 'cobol-modernization'
  | 'minimal'

export type HarnessLayout = {
  /** Absolute path to the harness/ directory root */
  rootDir: string
  /** Detected/expected template (informational) */
  template?: HarnessTemplateName
  rules: HarnessRulesIndex
  skills: HarnessSkillsIndex
  agents: HarnessAgentsIndex
  workflow: HarnessWorkflowIndex
  context: HarnessContextIndex
}

export type HarnessRulesIndex = {
  architecture: string                          // path to rules/architecture.md
  workflow: string                              // path to rules/workflow.md
  coding: string                                // path to rules/coding.md
  /** Additional rule files dropped in by the project */
  extra?: string[]
}

export type HarnessSkillsIndex = {
  plan?: string
  implement?: string
  review?: string
  test?: string
  extra?: string[]
}

export type HarnessAgentsIndex = {
  pm?: string
  developer?: string
  reviewer?: string
  tester?: string
  extra?: string[]
}

export type HarnessWorkflowIndex = {
  /** Path to workflow/phases.yaml */
  phases?: string
  /** Path to workflow/gates.yaml */
  gates?: string
  /** Path to workflow/rollback.yaml */
  rollback?: string
}

export type HarnessContextIndex = {
  session?: string                              // context/session.md
  phaseTriggers?: string                        // context/phase-triggers.yaml
  onDemandGlossary?: string                     // context/on-demand-glossary.md
}

// ---------------------------------------------------------------------------
// 2. Rules: parsed structures
// ---------------------------------------------------------------------------

/**
 * A programmatic rule extracted from harness/rules/*.md.
 * The Markdown file is human-readable; we extract structured rules from
 * fenced code blocks tagged ```rule { ... } or via heading conventions.
 */
export type ProgrammaticRule = {
  /** Rule id, e.g. "money-no-double", "i18n-all-locales" */
  id: string
  /** Source file (architecture.md / coding.md / workflow.md) */
  source: string
  /** Human-readable summary */
  summary: string
  /** Severity */
  severity: 'error' | 'warning' | 'info'
  /** Programmatic check kind */
  kind:
    | 'pattern-forbidden'                       // regex must NOT match
    | 'pattern-required'                        // regex must match in target files
    | 'pair-required'                           // if file A pattern matches, file B must also match
    | 'function-call-arity'                     // calls to fn(...) must include N specific args
    | 'extension-restriction'                   // certain types only in certain extensions
    | 'human'                                   // not programmable, requires reviewer eyeball
  /** Pattern (regex source) — for pattern-* and pair-required */
  pattern?: string
  /** Glob of files to check (default: all source) */
  fileGlob?: string
  /** For pair-required: the partner file/glob */
  partnerGlob?: string
  /** For function-call-arity: required args */
  requiredArgs?: string[]
  /** For extension-restriction: allowed extensions */
  allowedExtensions?: string[]
  /** Suggested fix (free text) */
  fix?: string
}

// ---------------------------------------------------------------------------
// 3. Lint results
// ---------------------------------------------------------------------------

export type LintViolation = {
  ruleId: string
  ruleSource: string
  severity: 'error' | 'warning' | 'info'
  file: string                                  // workspace-relative path
  line?: number
  column?: number
  message: string
  fix?: string
}

export type LintResult = {
  passed: boolean
  violations: LintViolation[]
  score: number                                 // 0-100
  durationMs: number
  filesScanned: number
  rulesEvaluated: number
}

// ---------------------------------------------------------------------------
// 4. Gates: definition + execution
// ---------------------------------------------------------------------------

export type GateCheckType =
  | 'file-exists'
  | 'typescript-typecheck'
  | 'unit-test'
  | 'harness-lint'
  | 'metacoder-systest'

export type GateCheck =
  | { type: 'file-exists'; path: string }
  | {
      type: 'typescript-typecheck'
      command?: string                          // default: "bun run typecheck" or "npx tsc --noEmit"
      expected_exit?: number                    // default 0
    }
  | {
      type: 'unit-test'
      command?: string                          // default: "bun test"
      expected?: {
        line_coverage?: string                  // e.g. ">=80%"
        branch_coverage?: string                // e.g. ">=70%"
        passing_ratio?: string                  // e.g. ">=95%"
      }
    }
  | {
      type: 'harness-lint'
      command?: string                          // default: invoke the in-process lint
      expected_exit?: number                    // default 0
    }
  | {
      type: 'metacoder-systest'
      command?: string                          // default: "/systest run"
      expected?: {
        phase5b_pass_rate?: string
        phase5c_pass_rate?: string
      }
    }

export type GateDefinition = {
  /** Gate id, e.g. "gate-implementation" */
  id: string
  /** Phase id this gate is associated with */
  phase: string
  checks: GateCheck[]
  /** Per-gate timeout (default 15m). Format: "5m", "1h" */
  timeout?: string
}

export type GateConfig = {
  version: number
  gates: Record<string, Omit<GateDefinition, 'id'>>
}

export type CheckResult = {
  type: GateCheckType | string
  passed: boolean
  durationMs: number
  output?: string
  error?: string
  detail?: Record<string, unknown>
  /**
   * Optional severity hint. When omitted, behaviour is binary (passed: true/false).
   * 'warn' indicates the underlying check failed but was downgraded — gate still
   * counts this as passing. Used by softened spec-* / tasks-status checks under
   * gateEnforcement: warn, and by checks skipped due to unset ${ACTIVE_FEATURE}.
   */
  severity?: 'pass' | 'warn' | 'fail'
  /**
   * True when the check was skipped (e.g. ${ACTIVE_FEATURE} unset). Skipped
   * results have passed: true and severity: 'warn' so they do not block the gate
   * but are visible in the result list.
   */
  skipped?: boolean
  /**
   * True when a hard failure was softened to a warning by gateEnforcement: warn.
   * The original failure detail is preserved in `output` / `error`.
   */
  softened?: boolean
}

export type GateResult = {
  gateId: string
  phaseId: string
  passed: boolean
  results: CheckResult[]
  totalDurationMs: number
  ranAt: string                                 // ISO
}

// ---------------------------------------------------------------------------
// 5. Phases (loaded but the MVP only needs the structure for Gate associations)
// ---------------------------------------------------------------------------

export type PhaseDefinition = {
  id: string
  name: string
  next: string | null
  rollback_to: string | null
  gate?: string
  role?: 'pm' | 'developer' | 'reviewer' | 'tester'
}

export type PhasesConfig = {
  version: number
  default_phase: string
  phases: PhaseDefinition[]
}

// ---------------------------------------------------------------------------
// 6. Init / scaffolding
// ---------------------------------------------------------------------------

export type CiTarget = 'github' | 'gitlab' | 'both' | 'none'

export type InitOptions = {
  /** Workspace path (where harness/ will be created) */
  workspacePath: string
  /** Template to use */
  template: HarnessTemplateName
  /** If true, overwrite existing files. Default false. */
  force?: boolean
  /** Adopt minimal subset (only rules + 1 skill) */
  minimal?: boolean
  /**
   * Whether to emit CI scaffold files during init.
   * 'github' → .github/workflows/harness.yml
   * 'gitlab' → .gitlab-ci.yml
   * 'both'   → both files
   * 'none'   → skip CI files (default, avoids surprising existing users)
   */
  ciTarget?: CiTarget
}

export type InitResult = {
  ok: boolean
  filesCreated: string[]
  filesSkipped: string[]                        // already existed
  warnings: string[]
  templateUsed: HarnessTemplateName
}

// ---------------------------------------------------------------------------
// 7. Errors
// ---------------------------------------------------------------------------

export class HarnessError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | 'harness-not-initialized'
      | 'invalid-yaml'
      | 'invalid-rule-block'
      | 'unknown-template'
      | 'lint-failed'
      | 'gate-not-found'
      | 'gate-check-failed'
      | 'gate-timeout'
      | 'init-conflict'
      // Standard scope kinds (Phase 1.5)
      | 'phase-not-active'
      | 'phase-transition-not-allowed'
      | 'rollback-limit-exceeded'
      | 'role-unknown'
      | 'persona-missing'
      | 'context-budget-exceeded'
      | 'human-approval-timeout',
    public readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'HarnessError'
  }
}
