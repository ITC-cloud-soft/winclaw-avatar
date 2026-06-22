/**
 * Transaction apply/rollback for the env operations layer (Phase 1.5).
 *
 * Implements §15.5 of INFRA_ENVIRONMENT_DESIGN.v2.2.md.
 */

import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import YAML from 'yaml'
import type { InfraFile } from '../types.js'
import type { Transaction, TransactionSnapshot, ApplyResult } from './types.js'
import { OperationError } from './types.js'
import { getProjectInfraDir } from '../projectId.js'

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function envFilePath(workspacePath: string): string {
  return path.join(workspacePath, '.metacoder', 'environments.yaml')
}

function infraFilePath(workspacePath: string): string {
  return path.join(getProjectInfraDir(workspacePath), 'infra.yaml')
}

function auditDir(workspacePath: string): string {
  return path.join(workspacePath, '.metacoder', 'audit')
}

function auditLogPath(workspacePath: string): string {
  return path.join(auditDir(workspacePath), 'operations.log')
}

function snapshotDir(workspacePath: string): string {
  return path.join(auditDir(workspacePath), 'snapshots')
}

// ---------------------------------------------------------------------------
// Atomic write
// ---------------------------------------------------------------------------

/**
 * Write content to targetPath atomically (write to .tmp, then rename).
 * On Windows EBUSY, retries once after 50 ms.
 */
async function atomicWrite(targetPath: string, content: string): Promise<void> {
  const tmpPath = `${targetPath}.tmp`
  await fsPromises.writeFile(tmpPath, content, 'utf8')
  try {
    await fsPromises.rename(tmpPath, targetPath)
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EBUSY' || code === 'EPERM') {
      // Windows: retry once after 50 ms
      await new Promise(resolve => setTimeout(resolve, 50))
      await fsPromises.rename(tmpPath, targetPath)
    } else {
      // Clean up .tmp on failure
      await fsPromises.unlink(tmpPath).catch(() => undefined)
      throw err
    }
  }
}

// ---------------------------------------------------------------------------
// takeSnapshot
// ---------------------------------------------------------------------------

/**
 * Take a snapshot of current environments.yaml and infra.yaml.
 * environments.yaml must exist; infra.yaml is optional.
 */
export async function takeSnapshot(workspacePath: string): Promise<TransactionSnapshot> {
  const envPath = envFilePath(workspacePath)

  let environmentsYaml: string
  try {
    environmentsYaml = await fsPromises.readFile(envPath, 'utf8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new OperationError(
        `environments.yaml not found at ${envPath}. Cannot take snapshot.`,
        'snapshot-missing',
      )
    }
    throw err
  }

  let infraYaml: string | undefined
  try {
    infraYaml = await fsPromises.readFile(infraFilePath(workspacePath), 'utf8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
    infraYaml = undefined
  }

  return {
    environmentsYaml,
    infraYaml,
    takenAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// applyTransaction
// ---------------------------------------------------------------------------

/**
 * Apply a transaction: write new YAML to disk, merge infra patch, write audit log.
 */
export async function applyTransaction(
  txn: Transaction,
  workspacePath: string,
  options?: { actor?: string; gitRef?: string },
): Promise<ApplyResult> {
  const { actor = 'unknown', gitRef = '' } = options ?? {}

  // 1. Validate
  if (!txn.validation.ok) {
    throw new OperationError(
      `Transaction ${txn.id} cannot be applied: validation failed`,
      'validation-failed',
      'errors' in txn.validation ? txn.validation.errors : [],
    )
  }

  // 2. Drift detection: compare on-disk content to snapshot
  const envPath = envFilePath(workspacePath)
  let currentContent: string
  try {
    currentContent = await fsPromises.readFile(envPath, 'utf8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new OperationError(
        `environments.yaml not found at ${envPath}`,
        'apply-failed',
      )
    }
    throw err
  }

  if (currentContent !== txn.snapshot.environmentsYaml) {
    throw new OperationError(
      `environments.yaml changed since snapshot — refresh and retry`,
      'apply-failed',
    )
  }

  const filesChanged: string[] = []

  // 3. Persist snapshot BEFORE writing
  await persistSnapshot(txn, workspacePath)

  // 4. Write new environments.yaml atomically
  await atomicWrite(envPath, txn.newEnvironmentsYaml)
  filesChanged.push(envPath)

  // 5. Merge infra patch if present
  if (txn.newInfraPatch) {
    const infraPath = infraFilePath(workspacePath)
    await fsPromises.mkdir(path.dirname(infraPath), { recursive: true })

    let existing: InfraFile = { version: 2 }
    try {
      const existingText = await fsPromises.readFile(infraPath, 'utf8')
      existing = YAML.parse(existingText) as InfraFile
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err
      }
    }

    const patch = YAML.parse(txn.newInfraPatch) as Partial<InfraFile>
    const merged: InfraFile = {
      ...existing,
      vars: { ...(existing.vars ?? {}), ...(patch.vars ?? {}) },
      secrets: { ...(existing.secrets ?? {}), ...(patch.secrets ?? {}) },
    }
    if (patch.ci_mode) {
      merged.ci_mode = { ...(existing.ci_mode ?? {}), ...patch.ci_mode }
    }

    await atomicWrite(infraPath, YAML.stringify(merged))
    filesChanged.push(infraPath)
  }

  // 6. Append audit log
  const appliedAt = new Date().toISOString()
  const targets = txn.targets.join(',')
  const reason = txn.reason ?? ''
  const diffSummary = txn.yamlDiff.split('\n').slice(0, 3).join(' ').trim()
  const auditEntry =
    `${appliedAt} [op=${txn.operation}] [targets=${targets}] ` +
    `[actor=${actor}] [gitRef=${gitRef}] [reason="${reason}"] diff=${diffSummary}\n`

  const logPath = auditLogPath(workspacePath)
  await fsPromises.mkdir(path.dirname(logPath), { recursive: true })
  await fsPromises.appendFile(logPath, auditEntry, 'utf8')

  return {
    ok: true,
    appliedAt,
    filesChanged,
    auditLogEntry: auditEntry,
  }
}

// ---------------------------------------------------------------------------
// rollbackTransaction
// ---------------------------------------------------------------------------

/**
 * Rollback: restore environments.yaml + infra.yaml from txn.snapshot.
 */
export async function rollbackTransaction(
  txn: Transaction,
  workspacePath: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const envPath = envFilePath(workspacePath)
    await atomicWrite(envPath, txn.snapshot.environmentsYaml)

    if (txn.snapshot.infraYaml !== undefined) {
      const infraPath = infraFilePath(workspacePath)
      await fsPromises.mkdir(path.dirname(infraPath), { recursive: true })
      await atomicWrite(infraPath, txn.snapshot.infraYaml)
    }

    // Append rollback audit entry
    const rolledBackAt = new Date().toISOString()
    const auditEntry =
      `${rolledBackAt} [op=rollback] [txn=${txn.id}] [targets=${txn.targets.join(',')}] ` +
      `[original-op=${txn.operation}]\n`

    const logPath = auditLogPath(workspacePath)
    await fsPromises.mkdir(path.dirname(logPath), { recursive: true })
    await fsPromises.appendFile(logPath, auditEntry, 'utf8')

    return { ok: true }
  } catch (err: unknown) {
    return { ok: false, error: String(err) }
  }
}

// ---------------------------------------------------------------------------
// persistSnapshot
// ---------------------------------------------------------------------------

/**
 * Save a transaction snapshot to .metacoder/audit/snapshots/<txn-id>.snapshot.yaml.
 * Returns the saved path.
 */
export async function persistSnapshot(
  txn: Transaction,
  workspacePath: string,
): Promise<string> {
  const dir = snapshotDir(workspacePath)
  await fsPromises.mkdir(dir, { recursive: true })

  const snapshotPath = path.join(dir, `${txn.id}.snapshot.yaml`)

  const lines: string[] = []
  lines.push('--- pre')
  lines.push(txn.snapshot.environmentsYaml)
  if (txn.snapshot.infraYaml !== undefined) {
    lines.push('--- pre-infra')
    lines.push(txn.snapshot.infraYaml)
  }
  lines.push('--- meta')
  lines.push(`takenAt: ${txn.snapshot.takenAt}`)
  lines.push(`txnId: ${txn.id}`)
  lines.push(`operation: ${txn.operation}`)
  lines.push(`targets: [${txn.targets.join(', ')}]`)
  lines.push('')  // trailing newline

  await fsPromises.writeFile(snapshotPath, lines.join('\n'), 'utf8')
  return snapshotPath
}

// ---------------------------------------------------------------------------
// generateTxnId
// ---------------------------------------------------------------------------

/**
 * Generate a unique transaction ID.
 * Format: txn-YYYYMMDD-HHMMSS-<6-char-hex>
 */
export function generateTxnId(): string {
  const now = new Date()
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  const date =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time =
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const hex = crypto.randomBytes(3).toString('hex')
  return `txn-${date}-${time}-${hex}`
}
