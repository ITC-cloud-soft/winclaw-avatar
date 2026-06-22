/**
 * auditHelper.ts
 *
 * Higher-level convenience wrappers used by Phase 4 callsites.
 * Resolves actor + gitRef automatically and delegates to appendAudit.
 *
 * Callers that only have an Env + operation details call logAudit() —
 * a single call that builds and appends if audit_log is configured.
 */

import * as path from 'node:path'
import type { AuditEntry } from './types.js'
import type { Env } from '../types.js'
import { appendAudit, resolveActor, resolveGitRef, hashOutput } from './auditLog.js'

// ---------------------------------------------------------------------------
// buildAuditEntry
// ---------------------------------------------------------------------------

export type BuildAuditArgs = {
  env: Env
  toolKind: AuditEntry['toolKind']
  summary: string
  status: AuditEntry['status']
  workspacePath?: string
  reason?: string
  skill?: string
  phase?: string
  payload?: string
  durationMs?: number
  /** Raw output string — will be sha256-hashed; not stored verbatim */
  output?: string
  rollbackPlan?: string
}

/**
 * Build an AuditEntry from common Phase 4 callsites.
 * Resolves actor + gitRef automatically.
 * Returns the populated entry; caller decides whether / where to append it.
 */
export async function buildAuditEntry(args: BuildAuditArgs): Promise<AuditEntry> {
  const [actor, gitRef] = await Promise.all([
    resolveActor(),
    resolveGitRef(args.workspacePath),
  ])

  const entry: AuditEntry = {
    timestamp:    new Date().toISOString(),
    env:          args.env.name,
    actor,
    gitRef,
    toolKind:     args.toolKind,
    summary:      args.summary,
    status:       args.status,
  }

  if (args.reason)       entry.reason       = args.reason
  if (args.skill)        entry.skill        = args.skill
  if (args.phase)        entry.phase        = args.phase
  if (args.payload)      entry.payload      = args.payload
  if (args.durationMs !== undefined) entry.durationMs = args.durationMs
  if (args.output !== undefined)     entry.outputHash = hashOutput(args.output)
  if (args.rollbackPlan) entry.rollbackPlan = args.rollbackPlan

  return entry
}

// ---------------------------------------------------------------------------
// logAudit
// ---------------------------------------------------------------------------

/**
 * One-shot helper: build + append in one call.
 *
 * No-op when env.safety.audit_log is undefined.
 *
 * Path resolution:
 *   - Absolute audit_log path → used as-is
 *   - Relative audit_log path → resolved against workspacePath ?? process.cwd()
 */
export async function logAudit(args: BuildAuditArgs): Promise<void> {
  const auditLogPath = args.env.safety.audit_log
  if (!auditLogPath) return

  const resolvedPath = path.isAbsolute(auditLogPath)
    ? auditLogPath
    : path.resolve(args.workspacePath ?? process.cwd(), auditLogPath)

  const entry = await buildAuditEntry(args)

  await appendAudit(entry, { path: resolvedPath })
}
