/**
 * audit/auditLog.ts — Append and read HarnessAuditEntry records.
 *
 * Storage: NDJSON (one JSON object per line) at
 *   <workspacePath>/.metacoder/audit/harness-audit.jsonl
 *
 * Exports:
 *   appendAudit(workspacePath, entry)  — add a new entry (creates dir if missing)
 *   readAudit(workspacePath, limit?)   — return entries newest-first
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { HarnessAuditEntry } from '../standardTypes.js'

// ---------------------------------------------------------------------------
// Path helper
// ---------------------------------------------------------------------------

export function auditLogPath(workspacePath: string): string {
  return path.join(workspacePath, '.metacoder', 'audit', 'harness-audit.jsonl')
}

// ---------------------------------------------------------------------------
// Public: appendAudit
// ---------------------------------------------------------------------------

/**
 * Append a single `HarnessAuditEntry` to the NDJSON audit log.
 *
 * Creates the `.metacoder/audit/` directory if it does not exist.
 * Each call appends one JSON line followed by `\n`.
 */
export async function appendAudit(
  workspacePath: string,
  entry: HarnessAuditEntry,
): Promise<void> {
  const logFile = auditLogPath(workspacePath)
  await fs.mkdir(path.dirname(logFile), { recursive: true })
  const line = JSON.stringify(entry) + '\n'
  await fs.appendFile(logFile, line, 'utf8')
}

// ---------------------------------------------------------------------------
// Public: readAudit
// ---------------------------------------------------------------------------

/**
 * Read audit log entries for the workspace.
 *
 * Returns entries ordered newest-first.
 * If `limit` is provided, only the most recent `limit` entries are returned.
 * Returns an empty array if the log file does not exist or is empty.
 * Silently skips lines that fail JSON.parse (corrupt entries).
 */
export async function readAudit(
  workspacePath: string,
  limit?: number,
): Promise<HarnessAuditEntry[]> {
  const logFile = auditLogPath(workspacePath)

  let raw: string
  try {
    raw = await fs.readFile(logFile, 'utf8')
  } catch {
    return []
  }

  const entries: HarnessAuditEntry[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      entries.push(JSON.parse(trimmed) as HarnessAuditEntry)
    } catch {
      // Skip corrupt lines
    }
  }

  // Newest-first
  entries.reverse()

  if (limit !== undefined && limit > 0) {
    return entries.slice(0, limit)
  }
  return entries
}
