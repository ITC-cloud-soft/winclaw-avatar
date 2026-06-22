/**
 * Harness Engineering — Standard phase types.
 *
 * Implements the Standard scope per
 * docs/meta-coder/all-in-one/HARNESS_ENGINEERING_INTEGRATION.md §10.2.
 *
 * Adds:
 *   1. 10-phase workflow + phase state machine
 *   2. Rollback policy + transitions
 *   3. 4 agent personas + role assumption
 *   4. 9 additional gate check types (total 14)
 *   5. 3-layer context loading (session / phase / on-demand)
 */

import type { GateCheck, CheckResult } from './types.js'

// ---------------------------------------------------------------------------
// 1. Phase state machine
// ---------------------------------------------------------------------------

export type PhaseId =
  | 'requirements'
  | 'design'
  | 'test-spec'
  | 'implementation'
  | 'code-review'
  | 'integration-test'
  | 'performance'
  | 'security'
  | 'deploy-plan'
  | 'confirm'

export type RoleId = 'pm' | 'developer' | 'reviewer' | 'tester'

export type PhaseState = {
  /** Currently active phase */
  current: PhaseId | null
  /** Workspace path (so multi-workspace state can coexist) */
  workspacePath: string
  /** Phase entered at (epoch ms) */
  enteredAt: number
  /** Active role for this phase (auto-assumed) */
  activeRole: RoleId | null
  /** Active role manually set (overrides phase default) */
  manualRole?: RoleId
  /** Reason supplied by /harness phase advance */
  reason?: string
  /** Number of rollback attempts in this phase */
  rollbackAttempts: number
  /** Audit ref of last gate result for this phase */
  lastGateResult?: { gateId: string; passed: boolean; ranAt: string }
}

export type PhaseTransition = {
  from: PhaseId | null
  to: PhaseId | null
  kind: 'advance' | 'rollback' | 'reset' | 'init'
  ranAt: string                                    // ISO timestamp
  actor: string
  reason?: string
  gateResult?: { gateId: string; passed: boolean }
}

// ---------------------------------------------------------------------------
// 2. Rollback policy (loaded from harness/workflow/rollback.yaml)
// ---------------------------------------------------------------------------

export type RollbackPerPhasePolicy = {
  /** Phase to rollback to (overrides default) */
  target?: PhaseId
  /** Max consecutive rollback attempts before requiring human approval */
  max_attempts?: number
  /** Action when max_attempts exceeded */
  after_max?: 'human-approval-required' | 'emergency-rollback-deploy' | 'abort'
}

export type RollbackPolicy = {
  default: {
    max_attempts: number
    after_max: RollbackPerPhasePolicy['after_max']
    audit: boolean
  }
  per_phase?: Partial<Record<PhaseId, RollbackPerPhasePolicy>>
}

// ---------------------------------------------------------------------------
// 3. Agent personas
// ---------------------------------------------------------------------------

export type PersonaSpec = {
  role: RoleId
  /** Markdown content of the persona file (harness/agents/<role>.md) */
  content: string
  /** Path on disk */
  path: string
  /** Token estimate (4-char average) */
  approxTokens: number
}

export type RoleAssumption = {
  /** New active role */
  role: RoleId
  /** True if this was triggered by phase auto-assume; false if /harness assume */
  fromPhaseAuto: boolean
  /** Persona content injected into system prompt */
  personaBlock: string
  /** Reason for the assumption */
  reason?: string
}

// ---------------------------------------------------------------------------
// 4. Extended gate check types (11 new = 16 total)
// ---------------------------------------------------------------------------

export type ExtendedGateCheckType =
  | 'harness-rule-conformance'
  | 'skill-execution'
  | 'rules-coverage'
  | 'dependency-scan'
  | 'sast'
  | 'load-test'
  | 'human-approval'
  | 'metacoder-deploy-dryrun'
  | 'metacoder-deploy'
  | 'review-checklist'
  | 'command'
  // v3.3.0: spec-kit-backed phase validation runners (stubs registered by
  // Wave 2 wiring; runner impls live in sibling files). These types are
  // recognised by gates.yaml today so authors can declare them now, and the
  // gate runner softens their failures when policy.yaml gateEnforcement=warn.
  | 'spec-requirements'
  | 'spec-design'
  | 'test-spec-checklist'
  | 'tasks-status'

/** Discriminated union for the 9 extended check types */
export type ExtendedGateCheck =
  | {
      type: 'harness-rule-conformance'
      rule: string                                 // rule id, e.g. "money-no-double"
      threshold?: string                           // e.g. ">=95%"
    }
  | {
      type: 'skill-execution'
      skill: string                                // path or skill id
      role?: RoleId
      expected_output?: { passed: boolean; min_score?: number }
      timeout?: string
    }
  | {
      type: 'rules-coverage'
      rules: string[]                              // array of rule files
      threshold: string                            // e.g. "95%"
    }
  | {
      type: 'dependency-scan'
      command?: string                             // default: "bun audit"
      expected: { critical?: number; high?: number; medium?: number }
    }
  | {
      type: 'sast'
      command?: string                             // default: "semgrep --config=auto src/"
      expected_exit?: number
    }
  | {
      type: 'load-test'
      command: string                              // e.g. "k6 run perf/scenario.js"
      expected: { p95_ms?: string; rps?: string; error_rate?: string }
    }
  | {
      type: 'human-approval'
      role?: RoleId                                // who must approve
      prompt: string                               // shown to human
      timeout?: string                             // default 24h
    }
  | {
      type: 'metacoder-deploy-dryrun'
      env: string                                  // active env name
      command?: string                             // default: "/deploy --dry-run"
      expected_exit?: number
    }
  | {
      type: 'review-checklist'
      /** Path (relative to workspace) to the review checklist file (markdown w/ YAML frontmatter or pure YAML). */
      path: string
      /** Minimum evidence length per item. Default 20. */
      minEvidenceChars?: number
      /** Categories that must be covered by at least one checked item. */
      requiredCategories?: string[]
    }
  | {
      type: 'metacoder-deploy'
      env: string
      intent?: 'verify' | 'deploy'
      command?: string
      expected?: { health?: 'ok' | 'degraded' }
    }
  | {
      type: 'command'
      /** Shell command to execute. */
      command: string
      /** Working dir (workspace-relative or absolute). Defaults to workspacePath. */
      cwd?: string
      /** Use a shell to invoke (true, default) or spawn directly (false). */
      shell?: boolean
      /** Timeout (e.g. "30s", "5m"). Defaults to gate timeout. */
      timeout?: string
      /** Expected exit code. Default 0. */
      expected_exit?: number
      /** Regex that captured stdout MUST match (when present). */
      expected_stdout?: string
      /** Regex that captured stderr MUST NOT match (when present). */
      expected_stderr_absent?: string
      /** Extra environment variables merged into the child process. */
      env?: Record<string, string>
    }
  // ---------------------------------------------------------------------------
  // v3.3.0 spec-kit-backed phase validation stubs (runners owned by Wave 2)
  // ---------------------------------------------------------------------------
  | {
      type: 'spec-requirements'
      /** Path to spec.md (typically harness/specs/${ACTIVE_FEATURE}/spec.md). */
      path: string
      /** Minimum number of AC-NNN entries required. Default 1. */
      minAcceptanceCriteria?: number
      /** Max allowed [NEEDS CLARIFICATION] markers. Default 0. */
      allowUnresolvedClarifications?: number
    }
  | {
      type: 'spec-design'
      /** Feature id — typically ${ACTIVE_FEATURE}. */
      featureId: string
      /** When true, spec.md AC → plan.md coverage must be 100%. Default true. */
      requireAcCoverage?: boolean
      /** When true, plan.md → tasks.md decomposition gap must be 0. Default true. */
      requireTasksDecomposed?: boolean
      /** Whether a data-model.md (or equivalent) is required. Default 'optional'. */
      requireDataModel?: 'optional' | 'required'
    }
  | {
      type: 'test-spec-checklist'
      /** Path to test-plan.md (markdown w/ YAML frontmatter). */
      path: string
      /** Path to tasks.md to cross-reference taskIds against. */
      tasksRef: string
      /** Minimum chars per Given/When/Then field. Default 30. */
      minFieldChars?: number
      /** Categories that must be covered by at least one case (e.g. happy-path). */
      requiredCategories?: string[]
      /** When true, every taskId in tasks.md must be covered by ≥1 test case. */
      requireAllTasksCovered?: boolean
    }
  | {
      type: 'tasks-status'
      /** Feature id — typically ${ACTIVE_FEATURE}. */
      featureId: string
      /** When true, all tasks in tasks-status.yaml must be 'done'. Default true. */
      requireAllDone?: boolean
    }

/** Union of MVP + Extended = 14 total */
export type AnyGateCheck = GateCheck | ExtendedGateCheck

// ---------------------------------------------------------------------------
// 5. 3-Layer Context Loading
// ---------------------------------------------------------------------------

export type ContextLayer = 'session' | 'phase' | 'on-demand'

export type ContextEntry = {
  layer: ContextLayer
  /** Which phase(s) trigger this entry (only for layer=phase) */
  phases?: PhaseId[]
  /** Source path (workspace-relative) */
  path: string
  /** Resolved content (markdown, possibly truncated to fit token budget) */
  content: string
  /** Estimated tokens */
  approxTokens: number
  /** Whether content was summarized (compressed) to fit budget */
  summarized: boolean
}

export type ContextLoadingPolicy = {
  /** Total token budget per layer */
  budget: {
    session: number                                // default 1500
    phase: number                                  // default 3000
    onDemand: number                               // default 8000
  }
  /** When phase content exceeds budget, summarize at this length */
  summarizeIfOverTokens: number
}

export type PhaseTriggers = {
  version: number
  phase_contexts: Partial<
    Record<
      PhaseId,
      {
        inject: string[]                           // file paths or graphify:// URIs
        summarize_if_over?: string                 // e.g. "1500 tokens"
      }
    >
  >
}

export type ContextSnapshot = {
  /** Active phase at snapshot time */
  phase: PhaseId | null
  /** Active role */
  role: RoleId | null
  entries: ContextEntry[]
  totalTokens: number
  budgetUsed: { session: number; phase: number; onDemand: number }
}

// ---------------------------------------------------------------------------
// 6. Audit log integration (Standard adds phase + role fields)
// ---------------------------------------------------------------------------

export type HarnessAuditEntry = {
  timestamp: string
  workspacePath: string
  phase: PhaseId | null
  role: RoleId | null
  actor: string
  kind:
    | 'phase-advance'
    | 'phase-rollback'
    | 'phase-init'
    | 'role-assume'
    | 'gate-run'
    | 'lint-run'
    | 'context-load'
    | 'drill-run'
  summary: string
  detail?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// 7. Errors (Standard-specific kinds added)
// ---------------------------------------------------------------------------

// Note: HarnessError already exists in types.ts; we add new kinds here as
// string literals to be folded into the union when types.ts is updated. For
// now, callers cast to the existing kinds when possible, or use 'lint-failed'
// as a generic.

export type StandardErrorKind =
  | 'phase-not-active'
  | 'phase-transition-not-allowed'
  | 'rollback-limit-exceeded'
  | 'role-unknown'
  | 'persona-missing'
  | 'context-budget-exceeded'
  | 'human-approval-timeout'
