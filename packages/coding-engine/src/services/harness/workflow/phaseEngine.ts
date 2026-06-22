/**
 * workflow/phaseEngine.ts — Phase state machine: advance and rollback.
 *
 * Public functions:
 *   advancePhase  — validate gate (if defined), move to phases[i].next
 *   rollbackPhase — move to rollback_to, increment rollbackAttempts; error if over limit
 *
 * Both functions write to the audit log via auditLog.ts and persist
 * the updated PhaseState via phaseState.ts.
 */

import type { HarnessLayout, PhasesConfig, PhaseDefinition, GateResult } from '../types.js'
import { HarnessError } from '../types.js'
import type { PhaseState, PhaseTransition, RollbackPolicy, StandardErrorKind } from '../standardTypes.js'
import type { PhaseId } from '../standardTypes.js'
import { savePhaseState } from './phaseState.js'
import { appendAudit } from '../audit/auditLog.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString()
}

/**
 * Resolve a phase definition by id from the config.
 * Returns undefined if not found.
 */
function findPhase(config: PhasesConfig, id: PhaseId | null): PhaseDefinition | undefined {
  if (id === null) return undefined
  return config.phases.find(p => p.id === id)
}

/**
 * Find the PhasesConfig embedded in the layout's workflow index.
 * The layout only stores the file path; the caller must pass the loaded
 * config directly (it was already loaded to build the layout).
 */
function resolveRollbackLimits(
  policy: RollbackPolicy | null,
  phaseId: PhaseId | null,
): { maxAttempts: number; afterMax: RollbackPolicy['default']['after_max'] } {
  const defaults = policy?.default ?? {
    max_attempts: 3,
    after_max: 'human-approval-required' as const,
    audit: true,
  }

  if (phaseId && policy?.per_phase?.[phaseId]?.max_attempts !== undefined) {
    return {
      maxAttempts: policy.per_phase[phaseId]!.max_attempts!,
      afterMax: policy.per_phase[phaseId]!.after_max ?? defaults.after_max,
    }
  }

  return {
    maxAttempts: defaults.max_attempts,
    afterMax: defaults.after_max,
  }
}

// ---------------------------------------------------------------------------
// Public: advancePhase
// ---------------------------------------------------------------------------

export type AdvancePhaseOpts = {
  workspacePath: string
  layout: HarnessLayout
  phasesConfig: PhasesConfig
  currentState: PhaseState
  gateResult?: GateResult
  reason?: string
  rollbackPolicy?: RollbackPolicy | null
}

export type PhaseEngineResult = {
  next: PhaseState
  transition: PhaseTransition
}

/**
 * Move the workflow to the next phase.
 *
 * Rules:
 *   1. If the current phase has a `gate` field, `gateResult` must be provided
 *      and must have `passed === true`. Otherwise throws HarnessError.
 *   2. Moves to `phases[i].next`.  If `next` is null (final phase), the state
 *      stays at the current phase but kind is still 'advance'.
 *   3. Resets rollbackAttempts to 0.
 *   4. Writes an audit entry.
 *   5. Persists and returns the new PhaseState + PhaseTransition.
 */
export async function advancePhase(opts: AdvancePhaseOpts): Promise<PhaseEngineResult> {
  const { workspacePath, phasesConfig, currentState, gateResult, reason } = opts

  const currentPhase = findPhase(phasesConfig, currentState.current)

  // If phase has a gate, gate must have passed
  if (currentPhase?.gate) {
    if (!gateResult) {
      throw new HarnessError(
        `Phase "${currentState.current}" requires gate "${currentPhase.gate}" to pass before advancing. Run /harness gate ${currentPhase.gate} first.`,
        'gate-not-found',
      )
    }
    if (!gateResult.passed) {
      throw new HarnessError(
        `Gate "${gateResult.gateId}" did not pass (ranAt: ${gateResult.ranAt}). Fix the failing checks before advancing.`,
        'gate-check-failed',
        { gateId: gateResult.gateId, results: gateResult.results },
      )
    }
  }

  const nextPhaseId = currentPhase?.next ?? null

  const nextState: PhaseState = {
    ...currentState,
    current: nextPhaseId as PhaseId | null,
    enteredAt: Date.now(),
    rollbackAttempts: 0,
    activeRole: null, // role re-assumed on next entry
    ...(reason !== undefined ? { reason } : {}),
    ...(gateResult
      ? {
          lastGateResult: {
            gateId: gateResult.gateId,
            passed: gateResult.passed,
            ranAt: gateResult.ranAt,
          },
        }
      : {}),
  }

  // Clear manualRole on advance (fresh phase, fresh role assumption)
  delete nextState.manualRole

  const transition: PhaseTransition = {
    from: currentState.current,
    to: nextPhaseId as PhaseId | null,
    kind: 'advance',
    ranAt: now(),
    actor: 'harness-engine',
    ...(reason !== undefined ? { reason } : {}),
    ...(gateResult
      ? { gateResult: { gateId: gateResult.gateId, passed: gateResult.passed } }
      : {}),
  }

  await appendAudit(workspacePath, {
    timestamp: transition.ranAt,
    workspacePath,
    phase: nextPhaseId as PhaseId | null,
    role: nextState.activeRole,
    actor: transition.actor,
    kind: 'phase-advance',
    summary: `Advanced from "${currentState.current ?? 'null'}" to "${nextPhaseId ?? 'null'}"${reason ? ` — ${reason}` : ''}`,
    detail: {
      from: currentState.current,
      to: nextPhaseId,
      ...(gateResult ? { gateId: gateResult.gateId, gatePassed: gateResult.passed } : {}),
    },
  })

  await savePhaseState(nextState)

  return { next: nextState, transition }
}

// ---------------------------------------------------------------------------
// Public: rollbackPhase
// ---------------------------------------------------------------------------

export type RollbackPhaseOpts = {
  workspacePath: string
  layout: HarnessLayout
  phasesConfig: PhasesConfig
  currentState: PhaseState
  reason?: string
  rollbackPolicy?: RollbackPolicy | null
}

/**
 * Roll back the workflow to the phase's `rollback_to` target.
 *
 * Rules:
 *   1. Increments `rollbackAttempts` on the resulting state.
 *   2. If `rollbackAttempts > maxAttempts` (after increment), throws
 *      `HarnessError('lint-failed', { kind: 'rollback-limit-exceeded' })`.
 *      The `'lint-failed'` error kind is reused because the existing
 *      HarnessError union does not yet include Standard-specific kinds;
 *      `StandardErrorKind` is included in `detail`.
 *   3. If the current phase has no `rollback_to` set, stays in place and
 *      still increments the counter (interpreted as a no-op rollback).
 *   4. Writes an audit entry.
 *   5. Persists and returns the new PhaseState + PhaseTransition.
 */
export async function rollbackPhase(opts: RollbackPhaseOpts): Promise<PhaseEngineResult> {
  const { workspacePath, phasesConfig, currentState, reason, rollbackPolicy = null } = opts

  const currentPhase = findPhase(phasesConfig, currentState.current)
  const rollbackTarget = (currentPhase?.rollback_to ?? null) as PhaseId | null

  // Determine rollback limits
  const { maxAttempts } = resolveRollbackLimits(rollbackPolicy, currentState.current)

  // Increment attempt count
  const newAttempts = currentState.rollbackAttempts + 1

  if (newAttempts > maxAttempts) {
    const errorKind: StandardErrorKind = 'rollback-limit-exceeded'
    throw new HarnessError(
      `Rollback limit exceeded for phase "${currentState.current}": attempted ${newAttempts} times (max ${maxAttempts}). Human approval required.`,
      'lint-failed',
      {
        kind: errorKind,
        phase: currentState.current,
        rollbackAttempts: newAttempts,
        maxAttempts,
      },
    )
  }

  const nextState: PhaseState = {
    ...currentState,
    current: rollbackTarget,
    enteredAt: Date.now(),
    rollbackAttempts: newAttempts,
    activeRole: null,
    ...(reason !== undefined ? { reason } : {}),
  }

  delete nextState.lastGateResult
  delete nextState.manualRole

  const transition: PhaseTransition = {
    from: currentState.current,
    to: rollbackTarget,
    kind: 'rollback',
    ranAt: now(),
    actor: 'harness-engine',
    ...(reason !== undefined ? { reason } : {}),
  }

  // Honor rollbackPolicy.default.audit flag (default: true)
  const auditEnabled = rollbackPolicy?.default?.audit !== false
  if (auditEnabled) {
    await appendAudit(workspacePath, {
      timestamp: transition.ranAt,
      workspacePath,
      phase: rollbackTarget,
      role: null,
      actor: transition.actor,
      kind: 'phase-rollback',
      summary: `Rolled back from "${currentState.current ?? 'null'}" to "${rollbackTarget ?? 'null'}" (attempt ${newAttempts}/${maxAttempts})${reason ? ` — ${reason}` : ''}`,
      detail: {
        from: currentState.current,
        to: rollbackTarget,
        attempt: newAttempts,
        maxAttempts,
      },
    })
  }

  await savePhaseState(nextState)

  return { next: nextState, transition }
}
