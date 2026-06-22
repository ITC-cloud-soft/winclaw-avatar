/**
 * Phase 4 — Production safety types.
 *
 * Implements §7 (Production safety mechanisms) + §8 (Audit log) of v2.2.
 *
 * Layers:
 *   1. SQL classifier — tokenizes + classifies SQL into kind/tables/destructive
 *   2. CLI allowlist  — matches Bash tool call args against destructive patterns
 *   3. 2-phase commit — preview → approval → apply, intercepts production writes
 *   4. Elevation      — /env elevate with real setTimeout-based auto-revoke
 *   5. Audit log      — structured append-only log with actor + gitRef + reason
 */

// ---------------------------------------------------------------------------
// 1. SQL classifier
// ---------------------------------------------------------------------------

export type SqlDialect = 'mysql' | 'postgres' | 'mongodb' | 'sqlserver' | 'redis' | 'sqlite' | 'generic'

export type SqlClassification = {
  /** Top-level statement kind */
  kind:
    | 'SELECT' | 'WITH'
    | 'INSERT' | 'UPDATE' | 'DELETE' | 'MERGE' | 'UPSERT'
    | 'DROP' | 'TRUNCATE' | 'ALTER' | 'CREATE' | 'RENAME'
    | 'GRANT' | 'REVOKE'
    | 'EXEC' | 'CALL'
    | 'BEGIN' | 'COMMIT' | 'ROLLBACK'
    | 'SHOW' | 'DESCRIBE' | 'EXPLAIN'
    | 'UNKNOWN'
  /** Tables touched (best-effort extraction, may be empty for complex queries) */
  tables: string[]
  /** True for: DROP/TRUNCATE/ALTER ... DROP/RENAME/CREATE OR REPLACE.
   *  Also true for DELETE/UPDATE without WHERE. */
  isDestructive: boolean
  /** True if statement is read-only (SELECT/WITH/SHOW/DESCRIBE/EXPLAIN) */
  isReadOnly: boolean
  /** True if the statement modifies data (INSERT/UPDATE/DELETE/MERGE/UPSERT) */
  isWrite: boolean
  /** True if a WHERE clause is present (relevant for UPDATE/DELETE safety) */
  hasWhere: boolean
  /** Human-readable reason if isDestructive */
  destructiveReason?: string
  /** Number of statements found (multi-statement input) */
  statementCount: number
}

export type SqlClassifyOptions = {
  dialect?: SqlDialect
  /** When true, an UPDATE/DELETE without WHERE is flagged destructive (default: true) */
  flagBareWriteAsDestructive?: boolean
}

// ---------------------------------------------------------------------------
// 2. CLI allowlist
// ---------------------------------------------------------------------------

export type AllowlistRule = {
  /** Command to match, e.g. 'az', 'aws', 'kubectl', 'rm' */
  command: string
  /** Args that must ALL appear (in any order) for the rule to match */
  args_match: string[]
  /** Optional human description */
  description?: string
  /** Severity level (used for prompts/audit) */
  severity?: 'destructive' | 'risky' | 'noisy'
}

export type CliClassification = {
  command: string
  args: string[]
  isDestructive: boolean
  matchedRule?: AllowlistRule
}

// ---------------------------------------------------------------------------
// 3. 2-phase commit
// ---------------------------------------------------------------------------

export type PendingOperation = {
  /** Unique pending id */
  id: string
  /** When this pending was created */
  createdAt: number  // epoch ms
  /** Auto-discard timestamp (createdAt + 5 minutes by default) */
  expiresAt: number
  /** Description shown in preview */
  description: string
  /** SQL or CLI being held for confirmation */
  payload: { kind: 'sql'; statement: string; dialect: SqlDialect } | { kind: 'cli'; command: string; args: string[] }
  /** Active env at preview time */
  envName: string
  /** Reason supplied by /env elevate */
  reason?: string
  /** Rollback plan (required for destructive ops) */
  rollbackPlan?: string
}

export type CommitResult =
  | { ok: true; appliedAt: number; output?: string }
  | { ok: false; reason: 'expired' | 'cancelled' | 'not-found' | 'execution-failed'; detail?: string }

// ---------------------------------------------------------------------------
// 4. Elevation
// ---------------------------------------------------------------------------

export type ElevationState = {
  envName: string
  reason: string
  startedAt: number  // epoch ms
  expiresAt: number  // epoch ms
  /** Active timer handle for auto-revoke; null after revoke */
  timer: NodeJS.Timeout | null
}

export type ElevationOptions = {
  reason: string
  durationMs?: number  // default 5 * 60 * 1000
}

// ---------------------------------------------------------------------------
// 5. Audit log
// ---------------------------------------------------------------------------

export type AuditEntry = {
  timestamp: string                           // ISO 8601
  env: string
  actor: string                               // git user.email | $GIT_AUTHOR_EMAIL | OS user
  gitRef?: string                             // short SHA at time of operation
  reason?: string
  skill?: string                              // /deploy skill name if applicable
  phase?: string                              // multi-phase op (e.g. "Phase-2-build-push")
  toolKind: 'sql' | 'cli' | 'env-edit' | 'deploy' | 'rollback' | 'misc'
  /** Single-line human-readable summary of the operation */
  summary: string
  /** Full payload for forensic replay (multi-line ok) */
  payload?: string
  status: 'success' | 'failure' | 'denied' | 'pending' | 'rolled-back'
  durationMs?: number
  outputHash?: string                         // sha256 of output for replay verification
  rollbackPlan?: string
}

export type AuditLogOptions = {
  /** Path to log file. Created with O_APPEND. */
  path: string
  /** When file exceeds this many bytes, rotate. 0 = never rotate. Default: 100MB */
  rotateAtBytes?: number
  /** How many rotated files to keep. Default: 5 */
  keepRotations?: number
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SafetyError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | 'sql-destructive-on-prod'
      | 'cli-destructive-on-prod'
      | 'two-phase-required'
      | 'elevation-expired'
      | 'elevation-not-active'
      | 'audit-log-write-failed'
      | 'pending-not-found'
      | 'pending-expired',
    public readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'SafetyError'
  }
}
