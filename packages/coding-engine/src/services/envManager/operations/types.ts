/**
 * Operation types for the environment management skill (Phase 1.5).
 *
 * Implements §15.5 of INFRA_ENVIRONMENT_DESIGN.v2.2.md.
 *
 * The operations layer provides the runtime side of /env add|edit|remove|clone|set.
 * Each operation:
 *   1. Parses user intent (or accepts structured input)
 *   2. Validates against the schema
 *   3. Checks dependencies (extends: chain, cascade impact)
 *   4. Generates a preview (yaml diff + secret coordinator notes)
 *   5. Returns a Transaction object that the caller can `apply()` or `cancel()`
 */

import type { Env, EnvironmentsFile, InfraFile } from '../types.js'

// ---------------------------------------------------------------------------
// Operation kinds
// ---------------------------------------------------------------------------

export type OperationKind = 'add' | 'edit' | 'remove' | 'clone' | 'set'

// ---------------------------------------------------------------------------
// Inputs (structured form — intent parser converts NL to these)
// ---------------------------------------------------------------------------

export type AddInput = {
  kind: 'add'
  name: string                                   // new env name
  extends?: string                               // optional parent
  patch?: Partial<Env>                           // initial fields (cloud, db, etc.)
}

export type EditInput = {
  kind: 'edit'
  name: string                                   // existing env name
  patch: Partial<Env>                            // fields to merge
}

export type RemoveInput = {
  kind: 'remove'
  name: string
  cascade?: boolean                              // also remove envs that extend this one
}

export type CloneInput = {
  kind: 'clone'
  source: string
  destination: string
  overrides?: Partial<Env>                       // applied to the clone
}

export type SetInput = {
  kind: 'set'
  name: string
  path: string                                   // YAML JSONPath, e.g. "database.primary.port"
  value: unknown
}

export type OperationInput = AddInput | EditInput | RemoveInput | CloneInput | SetInput

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationIssue = {
  kind:
    | 'schema-violation'                         // ajv error
    | 'duplicate-name'                           // /env add NAME where NAME exists
    | 'unknown-env'                              // edit/remove/clone-source on missing env
    | 'missing-extends'                          // extends: refers to non-existent env
    | 'circular-extends'                         // would create A→B→A
    | 'production-untested-skill'                // production tag with tested=false
    | 'production-edit-without-reason'           // editing prod-tagged env without reason
    | 'cascade-warning'                          // remove would orphan dependents
    | 'invalid-path'                             // /env set with bad JSONPath
    | 'invalid-value-type'                       // /env set with wrong type
    | 'protected-field'                          // attempting to set a forbidden field
  path?: string                                  // YAML path or env name
  message: string
  severity: 'error' | 'warning'
}

export type ValidationResult =
  | { ok: true; warnings: ValidationIssue[] }
  | { ok: false; errors: ValidationIssue[]; warnings: ValidationIssue[] }

// ---------------------------------------------------------------------------
// Secret coordination
// ---------------------------------------------------------------------------

export type SecretAction = {
  kind: 'declare' | 'remove' | 'reuse'
  name: string                                   // e.g. DB_PASS_STG
  backend: 'env' | 'windows-credman' | 'keychain' | 'libsecret' | 'literal'
  // Per-OS guidance for actual value registration (humans only)
  registrationCommand?: string                   // e.g. "cmdkey /generic:metacoder/.../db ..."
}

// ---------------------------------------------------------------------------
// Dependency analysis
// ---------------------------------------------------------------------------

export type DependencyImpact = {
  envName: string
  dependents: string[]                           // env names that extends: this one
  recursiveDependents: string[]                  // full chain: dependents of dependents
}

// ---------------------------------------------------------------------------
// Transaction (the apply/rollback object)
// ---------------------------------------------------------------------------

export type Transaction = {
  /** Unique ID, used for snapshot filename */
  id: string
  /** What kind of operation this represents */
  operation: OperationKind
  /** Target env name(s) */
  targets: string[]
  /** Reason given by the user (required for production) */
  reason?: string
  /** YAML diff string suitable for preview UI (Markdown-friendly) */
  yamlDiff: string
  /** Secret-side actions the user must perform manually */
  secretActions: SecretAction[]
  /** Validation results — must be ok=true to apply */
  validation: ValidationResult
  /** Dependency analysis (for remove/edit on a parent env) */
  dependencyImpact?: DependencyImpact
  /** Final environments.yaml content (after operation) */
  newEnvironmentsYaml: string
  /** Final infra.yaml additions/removals (relative to existing) */
  newInfraPatch?: string
  /** Snapshot of pre-operation state, used for rollback */
  snapshot: TransactionSnapshot
}

export type TransactionSnapshot = {
  environmentsYaml: string                       // before
  infraYaml?: string                             // before
  takenAt: string                                // ISO timestamp
}

export type ApplyResult = {
  ok: boolean
  appliedAt: string                              // ISO
  filesChanged: string[]
  auditLogEntry: string                          // pre-formatted for audit log
  error?: string
}

// ---------------------------------------------------------------------------
// Intent parser (Phase 1.5 §15.5.5)
// ---------------------------------------------------------------------------

export type IntentParseResult =
  | { ok: true; input: OperationInput }
  | { ok: true; needsDialog: true; partial: Partial<OperationInput>; missingFields: string[] }
  | { ok: false; reason: string }

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class OperationError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | 'invalid-input'
      | 'validation-failed'
      | 'apply-failed'
      | 'rollback-failed'
      | 'snapshot-missing',
    public readonly issues?: ValidationIssue[],
  ) {
    super(message)
    this.name = 'OperationError'
  }
}
