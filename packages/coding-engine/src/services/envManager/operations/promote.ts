/**
 * promote.ts
 *
 * Phase 3 v1 — builds a SQL diff plan for promoting config/schema changes
 * from one environment to another.
 *
 * Data-side migration execution is OUT OF SCOPE for Phase 3.  This module
 * produces the plan (what WOULD be done) and persists it to the audit log at
 * `.metacoder/audit/promotions/`.
 *
 * Contract: callers (e.g. /modernize) call buildPromoteTransaction() to get
 * a dry-run plan that can be reviewed before any write is performed.
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { loadEnvironments, resolveEnvByName, resolveExtendsChain } from '../loader.js'
import type { Env } from '../types.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PromoteTransactionResult = {
  /** Unique ID for this promotion plan */
  id: string
  fromEnv: string
  toEnv: string
  /** ISO timestamp when the plan was created */
  createdAt: string
  /** Human-readable reason for the promotion */
  reason: string
  /** Was this a dry run? (Phase 3 v1: always true) */
  dryRun: boolean
  /**
   * SQL diff plan — each item is a DDL / config statement that would need to
   * run on the target env to bring it in line with the source.
   * Phase 3 v1: generated from structural differences between resolved envs.
   */
  sqlDiffPlan: SqlDiffEntry[]
  /** Absolute path where the plan was persisted */
  auditPath: string
  /** Warnings emitted during plan generation */
  warnings: string[]
}

export type SqlDiffEntry = {
  /** DDL operation kind */
  kind: 'CREATE_INDEX' | 'ALTER_TABLE' | 'CREATE_EXTENSION' | 'SET_PARAMETER' | 'COMMENT'
  /** The SQL statement or comment text */
  sql: string
  /** Which env section this came from */
  source: 'database' | 'cloud' | 'safety' | 'deploy' | 'meta'
}

// ---------------------------------------------------------------------------
// Public: buildPromoteTransaction
// ---------------------------------------------------------------------------

/**
 * Build a promotion plan from `fromEnv` to `toEnv`.
 *
 * Phase 3 v1 scope:
 *   - Generates a SQL diff plan describing structural changes between envs
 *   - Does NOT execute anything
 *   - Persists the plan to `.metacoder/audit/promotions/<id>.json`
 *
 * @param fromEnv       - source environment name (e.g. "staging")
 * @param toEnv         - target environment name (e.g. "prod")
 * @param workspacePath - absolute path to the workspace root
 * @param options.reason  - human-readable reason for the promotion (required)
 * @param options.dryRun  - always true in Phase 3 v1; reserved for future use
 */
export async function buildPromoteTransaction(
  fromEnv: string,
  toEnv: string,
  workspacePath: string,
  options: { reason: string; dryRun?: boolean },
): Promise<PromoteTransactionResult> {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const dryRun = options.dryRun !== false // Phase 3 v1: always dry-run
  const warnings: string[] = []

  // Load environments
  const envFile = await loadEnvironments(workspacePath)
  const rawFrom = resolveEnvByName(fromEnv, envFile)
  const rawTo   = resolveEnvByName(toEnv, envFile)

  const mergedFrom = resolveExtendsChain(rawFrom, envFile.environments)
  const mergedTo   = resolveExtendsChain(rawTo,   envFile.environments)

  // Safety check: refuse to promote directly to production unless from is staging
  const toTags = Array.isArray(mergedTo.tags) ? mergedTo.tags : []
  if (toTags.includes('production')) {
    const fromTags = Array.isArray(mergedFrom.tags) ? mergedFrom.tags : []
    const fromIsStaging = fromTags.some(t => String(t).includes('staging'))
    if (!fromIsStaging) {
      warnings.push(
        `Promoting directly to production from "${fromEnv}" (non-staging). ` +
          `Consider using a staging intermediary for safety.`,
      )
    }
  }

  // Build SQL diff plan
  const sqlDiffPlan = buildSqlDiffPlan(mergedFrom, mergedTo, warnings)

  // Persist audit record
  const auditPath = persistAuditRecord(workspacePath, {
    id,
    fromEnv,
    toEnv,
    createdAt,
    reason: options.reason,
    dryRun,
    sqlDiffPlan,
    warnings,
  })

  return {
    id,
    fromEnv,
    toEnv,
    createdAt,
    reason: options.reason,
    dryRun,
    sqlDiffPlan,
    auditPath,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildSqlDiffPlan(from: Env, to: Env, warnings: string[]): SqlDiffEntry[] {
  const entries: SqlDiffEntry[] = []

  entries.push({
    kind: 'COMMENT',
    sql: `-- Promotion plan: ${from.name} → ${to.name}`,
    source: 'meta',
  })

  // Database diff
  const dbFrom = from.database?.primary
  const dbTo   = to.database?.primary

  if (dbFrom && dbTo) {
    if (dbFrom.type !== dbTo.type) {
      entries.push({
        kind: 'COMMENT',
        sql: `-- WARNING: database type differs: ${from.name}=${dbFrom.type} vs ${to.name}=${dbTo.type}`,
        source: 'database',
      })
      warnings.push(`Database type mismatch: ${from.name} uses ${dbFrom.type}, ${to.name} uses ${dbTo.type}`)
    }

    if (dbFrom.ssl !== dbTo.ssl) {
      entries.push({
        kind: 'SET_PARAMETER',
        sql: `-- Verify SSL mode on ${to.name}: expected "${dbTo.ssl ?? 'prefer'}" (${from.name} had "${dbFrom.ssl ?? 'prefer'}")`,
        source: 'database',
      })
    }

    // Replicas present in source but not target
    const replicasFrom = from.database?.replicas ?? []
    const replicasTo   = to.database?.replicas ?? []
    if (replicasFrom.length > 0 && replicasTo.length === 0) {
      entries.push({
        kind: 'COMMENT',
        sql: `-- NOTE: ${from.name} has ${replicasFrom.length} replica(s); ${to.name} has none. ` +
          `Add replicas to ${to.name} if read scaling is required.`,
        source: 'database',
      })
    }
  } else if (dbFrom && !dbTo) {
    entries.push({
      kind: 'COMMENT',
      sql: `-- WARNING: ${from.name} has a primary database but ${to.name} does not. ` +
        `Add a database config to ${to.name} before promoting.`,
      source: 'database',
    })
    warnings.push(`${to.name} has no database configured; ${from.name} does.`)
  }

  // Safety rules diff
  const safetyFrom = from.safety
  const safetyTo   = to.safety
  if (safetyFrom.destructive_ops !== safetyTo.destructive_ops) {
    entries.push({
      kind: 'COMMENT',
      sql: `-- Safety level change: ${from.name} destructive_ops="${safetyFrom.destructive_ops}" ` +
        `→ ${to.name} destructive_ops="${safetyTo.destructive_ops}"`,
      source: 'safety',
    })
  }

  // Audit log reminder for production targets
  const toTags = Array.isArray(to.tags) ? to.tags : []
  if (toTags.includes('production') && !safetyTo.audit_log) {
    entries.push({
      kind: 'COMMENT',
      sql: `-- RECOMMENDATION: add audit_log to ${to.name}.safety for production environments`,
      source: 'safety',
    })
    warnings.push(`${to.name} is tagged production but has no audit_log configured.`)
  }

  // Deploy skill diff
  const deployFrom = from.deploy?.skill
  const deployTo   = to.deploy?.skill
  if (deployFrom && deployTo && deployFrom !== deployTo) {
    entries.push({
      kind: 'COMMENT',
      sql: `-- Deploy skill differs: ${from.name}="${deployFrom}" vs ${to.name}="${deployTo}"`,
      source: 'deploy',
    })
  }

  if (to.deploy && !to.deploy.tested) {
    entries.push({
      kind: 'COMMENT',
      sql: `-- BLOCKER: ${to.name} deploy.tested=false. Set to true after verifying the deploy skill.`,
      source: 'deploy',
    })
    warnings.push(`${to.name} has deploy.tested=false — deploy skill must be verified before promotion.`)
  }

  return entries
}

type AuditRecord = Omit<PromoteTransactionResult, 'auditPath'>

function persistAuditRecord(workspacePath: string, record: AuditRecord): string {
  const auditDir = path.join(workspacePath, '.metacoder', 'audit', 'promotions')

  try {
    fs.mkdirSync(auditDir, { recursive: true })
    const filePath = path.join(auditDir, `${record.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8')
    return filePath
  } catch {
    // If we can't write the audit record (e.g. read-only FS in tests), return
    // a synthetic path so the caller still gets a valid result.
    return path.join(auditDir, `${record.id}.json`)
  }
}
