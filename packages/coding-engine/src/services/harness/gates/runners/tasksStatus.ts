/**
 * tasksStatus runner — verifies that tasks defined in
 * `harness/specs/<featureId>/tasks.md` have reached the desired completion
 * state before a phase advance is permitted.
 *
 * This is a thin wrapper over {@link parseTasksStatus} in
 * `src/services/harness/spec/tasks.ts` — it does NOT reparse tasks.md or
 * mutate the sidecar `tasks-status.yaml`.
 *
 * Configuration in gates.yaml:
 *
 *   gate-implementation:
 *     phase: implementation
 *     checks:
 *       - type: tasks-status
 *         featureId: feature-001       # resolved by the gate foundation
 *         requireAllDone: true         # default true
 *
 * Pass / fail semantics:
 *   - tasks.md missing                            → fail
 *   - requireAllDone === true (default)
 *       - any task with status !== 'done'         → fail (list up to 10 IDs)
 *       - all tasks done                          → pass
 *   - requireAllDone === false
 *       - always passes (acts as a passive count, useful for visibility-only
 *         gates that surface progress without blocking the phase)
 */

import type { CheckResult } from '../../types.js'
import { parseTasksStatus } from '../../spec/tasks.js'

export type TasksStatusCheck = {
  type: 'tasks-status'
  featureId: string
  requireAllDone?: boolean
}

const MAX_LISTED_IDS = 10

export async function runTasksStatus(
  check: TasksStatusCheck,
  ctx: { workspacePath: string; timeoutMs?: number },
  meta?: { gateId?: string; phaseId?: string },
): Promise<CheckResult> {
  const start = Date.now()
  const requireAllDone = check.requireAllDone ?? true

  const status = await parseTasksStatus(ctx.workspacePath, check.featureId)

  if (status === null) {
    return {
      type: 'tasks-status' as never,
      passed: false,
      durationMs: Date.now() - start,
      output: `tasks.md not found for feature ${check.featureId}`,
      detail: {
        gateId: meta?.gateId,
        phaseId: meta?.phaseId,
        featureId: check.featureId,
      },
    }
  }

  const { total, done, tasks } = status
  const notDone = tasks.filter((t) => t.status !== 'done')

  // requireAllDone === false → passive count, always passes
  if (!requireAllDone) {
    return {
      type: 'tasks-status' as never,
      passed: true,
      durationMs: Date.now() - start,
      output: `${done}/${total} tasks done (requireAllDone=false; passive count)`,
      detail: {
        gateId: meta?.gateId,
        phaseId: meta?.phaseId,
        featureId: check.featureId,
        total,
        done,
        notDone: notDone.length,
        progressPercent: status.progressPercent,
      },
    }
  }

  if (notDone.length > 0) {
    const shownIds = notDone.slice(0, MAX_LISTED_IDS).map((t) => t.id)
    const suffix =
      notDone.length > MAX_LISTED_IDS
        ? `, …(+${notDone.length - MAX_LISTED_IDS} more)`
        : ''
    return {
      type: 'tasks-status' as never,
      passed: false,
      durationMs: Date.now() - start,
      output:
        `${done} of ${total} tasks done; ${notDone.length} not done: ` +
        shownIds.join(', ') +
        suffix,
      detail: {
        gateId: meta?.gateId,
        phaseId: meta?.phaseId,
        featureId: check.featureId,
        total,
        done,
        notDone: notDone.length,
        notDoneIds: notDone.map((t) => t.id),
        progressPercent: status.progressPercent,
      },
    }
  }

  return {
    type: 'tasks-status' as never,
    passed: true,
    durationMs: Date.now() - start,
    output: `${done}/${total} tasks done`,
    detail: {
      gateId: meta?.gateId,
      phaseId: meta?.phaseId,
      featureId: check.featureId,
      total,
      done,
      progressPercent: status.progressPercent,
    },
  }
}
