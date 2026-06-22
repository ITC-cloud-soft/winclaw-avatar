/**
 * twoPhaseCommit.ts
 *
 * In-memory 2-phase commit queue for production safety (§7.3).
 *
 * Lifecycle:
 *   preview() → pending op enters the map with a TTL
 *   apply()   → executor runs, op removed on success, kept on failure
 *   cancel()  → immediately removes the op
 *
 * A 30-second sweep interval discards expired entries so the map never leaks.
 */

import type { PendingOperation, CommitResult, SqlDialect } from './types.js'
import { SafetyError } from './types.js'

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const _pending = new Map<string, PendingOperation>()

const DEFAULT_TTL_MS = 5 * 60 * 1000  // 5 minutes

// Sweep interval — cleared in _resetForTest / process teardown.
const _sweepInterval: ReturnType<typeof setInterval> = setInterval(() => {
  const now = Date.now()
  for (const [id, op] of _pending) {
    if (op.expiresAt < now) {
      _pending.delete(id)
    }
  }
}, 30_000)

// Prevent the sweep from keeping the Node/Bun process alive.
if (typeof _sweepInterval.unref === 'function') {
  _sweepInterval.unref()
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a pending id in the format "pending-<YYYYMMDD-HHMMSS>-<6hex>".
 */
export function generatePendingId(): string {
  const now = new Date()
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const date =
    String(now.getFullYear()) +
    pad2(now.getMonth() + 1) +
    pad2(now.getDate())
  const time =
    pad2(now.getHours()) +
    pad2(now.getMinutes()) +
    pad2(now.getSeconds())
  const hex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')
  return `pending-${date}-${time}-${hex}`
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Add a pending operation to the queue and return the full PendingOperation
 * record (including the generated id).
 */
export function preview(
  payload: PendingOperation['payload'],
  options: {
    description: string
    envName: string
    reason?: string
    rollbackPlan?: string
    ttlMs?: number
  },
): PendingOperation {
  const now = Date.now()
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS
  const op: PendingOperation = {
    id: generatePendingId(),
    createdAt: now,
    expiresAt: now + ttl,
    description: options.description,
    payload,
    envName: options.envName,
    ...(options.reason !== undefined ? { reason: options.reason } : {}),
    ...(options.rollbackPlan !== undefined ? { rollbackPlan: options.rollbackPlan } : {}),
  }
  _pending.set(op.id, op)
  return op
}

/**
 * Apply a pending operation by id.
 *
 * - Not found         → `{ ok: false, reason: 'not-found' }`
 * - Expired           → discards op, returns `{ ok: false, reason: 'expired' }`
 * - Executor throws   → keeps op (for retry/diagnostics), returns
 *                       `{ ok: false, reason: 'execution-failed', detail }`
 * - Executor succeeds → removes op, returns `{ ok: true, appliedAt, output }`
 */
export async function apply(
  id: string,
  executor: (op: PendingOperation) => Promise<{ output?: string }>,
): Promise<CommitResult> {
  const op = _pending.get(id)

  if (!op) {
    return { ok: false, reason: 'not-found' }
  }

  if (op.expiresAt < Date.now()) {
    _pending.delete(id)
    return { ok: false, reason: 'expired' }
  }

  try {
    const result = await executor(op)
    _pending.delete(id)
    return {
      ok: true,
      appliedAt: Date.now(),
      ...(result.output !== undefined ? { output: result.output } : {}),
    }
  } catch (err) {
    // Keep in map for retry / diagnostics.
    const detail = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: 'execution-failed', detail }
  }
}

/**
 * Cancel a pending operation by id.  Returns `{ ok: true }` if found and
 * removed, `{ ok: false }` if the id was not in the queue.
 */
export function cancel(id: string): { ok: boolean } {
  return { ok: _pending.delete(id) }
}

/**
 * List all pending operations that have not yet expired.
 */
export function listPending(): PendingOperation[] {
  const now = Date.now()
  const result: PendingOperation[] = []
  for (const op of _pending.values()) {
    if (op.expiresAt >= now) {
      result.push(op)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Test / reset hook
// ---------------------------------------------------------------------------

/**
 * Clear all pending operations.  Use only in tests.
 */
export function clearAllPending(): void {
  _pending.clear()
}
