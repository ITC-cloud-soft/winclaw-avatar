/**
 * auditLog.ts
 *
 * Structured append-only audit log with rotation and actor resolution.
 * Implements v2.2 §8 format: actor + gitRef + reason + skill + phase.
 *
 * Design notes:
 * - O_APPEND atomicity: POSIX guarantees append writes are atomic up to
 *   PIPE_BUF (4KB). For multi-KB lines we open, write, close in one shot
 *   which is sufficient for structured log entries at typical sizes.
 * - Lazy rotation: rotateIfNeeded runs AFTER the write that triggered it,
 *   so the current log file is never truncated mid-session.
 * - Actor / gitRef are cached module-locally after first resolution — they
 *   don't change within a process lifetime.
 */

import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import * as crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import type { AuditEntry, AuditLogOptions } from './types.js'

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

let _cachedActor: string | undefined
let _cachedGitRef: Map<string, string | undefined> = new Map()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append a structured audit entry to the configured log file.
 * Opens with O_APPEND | O_CREAT | O_WRONLY for atomic single-process writes.
 * Rotates lazily after the write completes.
 *
 * Returns the formatted line that was written.
 */
export async function appendAudit(entry: AuditEntry, options: AuditLogOptions): Promise<string> {
  const logPath = options.path
  const parentDir = path.dirname(logPath)

  await fsp.mkdir(parentDir, { recursive: true })

  const formatted = formatAuditEntry(entry)
  // Append newline separator so sequential entries are separated by a blank line.
  // formatAuditEntry already ends with \n; we add one more for the blank line.
  const block = formatted + '\n'

  const fd = await fsp.open(logPath, fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY)
  try {
    await fd.write(block)
  } finally {
    await fd.close()
  }

  // Lazy rotation — rotates the file that was just written (now possibly oversized)
  // so the next write goes to a fresh file.
  await rotateIfNeeded(options)

  return formatted
}

/**
 * Format a single AuditEntry as a multi-line block matching v2.2 §8.
 *
 * Output (trailing newline included):
 *   Line 1: timestamp [env=…] [actor=…] [git=…]
 *   Line 2: (optional) [skill=…] [phase=…] [reason=…]
 *   Line 3: toolKind(summary)
 *   Line 4: status=… duration=…s output_hash=…
 *   Line 5: (optional) rollback_plan="…"
 *
 * Values that may contain newlines are escaped (\n → \\n) to preserve the
 * one-block-per-entry invariant relied on by tailEntries().
 */
export function formatAuditEntry(entry: AuditEntry): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')

  // Line 1: always present
  let line1 = `${entry.timestamp} [env=${esc(entry.env)}] [actor=${esc(entry.actor)}]`
  if (entry.gitRef) line1 += ` [git=${esc(entry.gitRef)}]`

  // Line 2: optional metadata
  const metaParts: string[] = []
  if (entry.skill)  metaParts.push(`[skill=${esc(entry.skill)}]`)
  if (entry.phase)  metaParts.push(`[phase=${esc(entry.phase)}]`)
  if (entry.reason) metaParts.push(`[reason="${esc(entry.reason)}"]`)
  const line2 = metaParts.length > 0 ? `  ${metaParts.join(' ')}` : null

  // Line 3: tool call summary
  const summaryLabel = toolKindLabel(entry.toolKind)
  const line3 = `  ${summaryLabel}(${esc(entry.summary)})`

  // Line 4: status + duration + outputHash
  let line4 = `  status=${entry.status}`
  if (entry.durationMs !== undefined) {
    line4 += ` duration=${(entry.durationMs / 1000).toFixed(1)}s`
  }
  if (entry.outputHash) {
    line4 += ` output_hash=${esc(entry.outputHash)}`
  }

  // Line 5: optional rollback
  const line5 = entry.rollbackPlan
    ? `  rollback_plan="${esc(entry.rollbackPlan)}"`
    : null

  const lines = [line1, line2, line3, line4, line5].filter((l): l is string => l !== null)
  return lines.join('\n') + '\n'
}

/**
 * Check if log rotation is needed and perform it.
 *
 * Rotation sequence (keepRotations = K):
 *   Delete <path>.K  (if exists)
 *   Move   <path>.(K-1) → <path>.K
 *   ...
 *   Move   <path>.1 → <path>.2
 *   Move   <path>   → <path>.1
 *
 * If keepRotations === 0 or rotateAtBytes === 0 → no rotation ever.
 */
export async function rotateIfNeeded(options: AuditLogOptions): Promise<void> {
  const logPath = options.path
  const rotateAtBytes = options.rotateAtBytes ?? DEFAULT_ROTATE_AT_BYTES
  const keepRotations = options.keepRotations ?? DEFAULT_KEEP_ROTATIONS

  if (rotateAtBytes === 0 || keepRotations === 0) return

  let stat: fs.Stats
  try {
    stat = await fsp.stat(logPath)
  } catch {
    // File doesn't exist yet — nothing to rotate.
    return
  }

  if (stat.size < rotateAtBytes) return

  // Delete the oldest rotation if it exists
  const oldest = `${logPath}.${keepRotations}`
  try { await fsp.unlink(oldest) } catch { /* not present — fine */ }

  // Shift each existing rotation up by one
  for (let n = keepRotations - 1; n >= 1; n--) {
    const src = `${logPath}.${n}`
    const dst = `${logPath}.${n + 1}`
    try { await fsp.rename(src, dst) } catch { /* not present — fine */ }
  }

  // Move current log → .1
  await fsp.rename(logPath, `${logPath}.1`)
}

/**
 * Resolve current actor identity.
 * Priority: git config user.email → $GIT_AUTHOR_EMAIL → OS user@host → 'unknown'
 * Result is cached for the session.
 */
export async function resolveActor(): Promise<string> {
  if (_cachedActor !== undefined) return _cachedActor

  // 1. git config user.email
  try {
    const email = execFileSync('git', ['config', 'user.email'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (email) {
      _cachedActor = email
      return _cachedActor
    }
  } catch { /* not a git repo or git not found */ }

  // 2. GIT_AUTHOR_EMAIL env var
  const envEmail = process.env['GIT_AUTHOR_EMAIL']?.trim()
  if (envEmail) {
    _cachedActor = envEmail
    return _cachedActor
  }

  // 3. OS user@hostname
  try {
    const userInfo = os.userInfo()
    const actor = `${userInfo.username}@${os.hostname()}`
    _cachedActor = actor
    return _cachedActor
  } catch { /* unusual OS fallback */ }

  // 4. Final fallback
  _cachedActor = 'unknown'
  return _cachedActor
}

/**
 * Resolve the current git short SHA at HEAD.
 * Returns undefined when workspacePath is not a git repo or git is unavailable.
 * Result is cached per resolved path for the session.
 */
export async function resolveGitRef(workspacePath?: string): Promise<string | undefined> {
  const cwd = workspacePath ?? process.cwd()

  if (_cachedGitRef.has(cwd)) return _cachedGitRef.get(cwd)

  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const result = sha || undefined
    _cachedGitRef.set(cwd, result)
    return result
  } catch {
    _cachedGitRef.set(cwd, undefined)
    return undefined
  }
}

/**
 * Compute output hash for replay verification.
 * Returns `sha256:<first 16 hex chars>` of the UTF-8 encoded input.
 */
export function hashOutput(output: string): string {
  const hash = crypto.createHash('sha256').update(output, 'utf8').digest('hex')
  return `sha256:${hash.slice(0, 16)}`
}

/**
 * Tail the most recent N entries from the log file.
 * Reads the last 64 KB, splits on blank-line separators, parses each block.
 * Malformed blocks are silently skipped.
 * Returns [] when the file is missing or empty.
 */
export async function tailEntries(logPath: string, n: number): Promise<AuditEntry[]> {
  let content: string
  try {
    const stat = await fsp.stat(logPath)
    const size = stat.size
    const readSize = Math.min(size, TAIL_READ_BYTES)
    const offset = size - readSize

    const fd = await fsp.open(logPath, 'r')
    try {
      const buf = Buffer.alloc(readSize)
      await fd.read(buf, 0, readSize, offset)
      content = buf.toString('utf8')
    } finally {
      await fd.close()
    }
  } catch {
    return []
  }

  // Split on blank-line separator (entries are separated by \n\n)
  const blocks = content.split(/\n\n+/).map(b => b.trim()).filter(Boolean)

  const entries: AuditEntry[] = []
  for (const block of blocks) {
    const entry = parseBlock(block)
    if (entry) entries.push(entry)
  }

  return entries.slice(-n)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_ROTATE_AT_BYTES = 100 * 1024 * 1024  // 100 MB
const DEFAULT_KEEP_ROTATIONS  = 5
const TAIL_READ_BYTES         = 64 * 1024           // 64 KB

function toolKindLabel(kind: AuditEntry['toolKind']): string {
  switch (kind) {
    case 'sql':      return 'DB'
    case 'cli':      return 'Bash'
    case 'env-edit': return 'EnvEdit'
    case 'deploy':   return 'Deploy'
    case 'rollback': return 'Rollback'
    case 'misc':     return 'Misc'
  }
}

/**
 * Best-effort parser for a single log block produced by formatAuditEntry.
 * Returns undefined for blocks that cannot be parsed into a valid AuditEntry.
 */
function parseBlock(block: string): AuditEntry | undefined {
  const lines = block.split('\n')
  if (lines.length < 3) return undefined

  try {
    // Line 1: timestamp [env=…] [actor=…] [git=…]
    const line1 = lines[0]
    const timestampMatch = line1.match(/^(\S+)\s/)
    if (!timestampMatch) return undefined
    const timestamp = timestampMatch[1]

    const envMatch    = line1.match(/\[env=([^\]]+)\]/)
    const actorMatch  = line1.match(/\[actor=([^\]]+)\]/)
    const gitMatch    = line1.match(/\[git=([^\]]+)\]/)

    if (!envMatch || !actorMatch) return undefined

    let lineIdx = 1
    let skill: string | undefined
    let phase: string | undefined
    let reason: string | undefined

    // Line 2 (optional metadata): starts with spaces + [
    if (lines[lineIdx]?.trimStart().startsWith('[')) {
      const meta = lines[lineIdx]
      const skillMatch  = meta.match(/\[skill=([^\]]+)\]/)
      const phaseMatch  = meta.match(/\[phase=([^\]]+)\]/)
      const reasonMatch = meta.match(/\[reason="([^"]*)"\]/)
      skill  = skillMatch?.[1]
      phase  = phaseMatch?.[1]
      reason = reasonMatch?.[1]
      lineIdx++
    }

    // Line 3: toolKind(summary)
    const summaryLine = lines[lineIdx]?.trim() ?? ''
    const summaryMatch = summaryLine.match(/^(\w+)\((.+)\)$/)
    if (!summaryMatch) return undefined
    const labelStr = summaryMatch[1]
    const summary  = unescape(summaryMatch[2])
    lineIdx++

    const toolKind = labelToToolKind(labelStr)

    // Line 4: status + optional duration + optional output_hash
    const statusLine = lines[lineIdx]?.trim() ?? ''
    const statusMatch = statusLine.match(/status=(\S+)/)
    if (!statusMatch) return undefined
    const status = statusMatch[1] as AuditEntry['status']
    const durationMatch    = statusLine.match(/duration=([\d.]+)s/)
    const outputHashMatch  = statusLine.match(/output_hash=(\S+)/)
    const durationMs = durationMatch ? parseFloat(durationMatch[1]) * 1000 : undefined
    lineIdx++

    // Line 5 (optional): rollback_plan
    let rollbackPlan: string | undefined
    if (lines[lineIdx]?.trim().startsWith('rollback_plan=')) {
      const rpMatch = lines[lineIdx].match(/rollback_plan="(.*)"$/)
      rollbackPlan = rpMatch ? unescape(rpMatch[1]) : undefined
    }

    return {
      timestamp,
      env:          unescape(envMatch[1]),
      actor:        unescape(actorMatch[1]),
      gitRef:       gitMatch ? unescape(gitMatch[1]) : undefined,
      skill,
      phase,
      reason,
      toolKind,
      summary,
      status,
      durationMs,
      outputHash:   outputHashMatch ? outputHashMatch[1] : undefined,
      rollbackPlan,
    }
  } catch {
    return undefined
  }
}

function unescape(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
}

function labelToToolKind(label: string): AuditEntry['toolKind'] {
  switch (label) {
    case 'DB':       return 'sql'
    case 'Bash':     return 'cli'
    case 'EnvEdit':  return 'env-edit'
    case 'Deploy':   return 'deploy'
    case 'Rollback': return 'rollback'
    default:         return 'misc'
  }
}

// ---------------------------------------------------------------------------
// Test reset helper (exported for tests only)
// ---------------------------------------------------------------------------

/** @internal Reset module-level caches. Only use in tests. */
export function _resetCacheForTest(): void {
  _cachedActor = undefined
  _cachedGitRef = new Map()
}
