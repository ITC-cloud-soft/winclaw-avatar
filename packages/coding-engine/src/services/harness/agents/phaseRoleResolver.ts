/**
 * agents/phaseRoleResolver.ts — Map a phase id to its default role.
 *
 * Reads `PhaseDefinition.role` from the loaded `PhasesConfig`.
 * Returns `null` when the phase has no default role or the phase is not found.
 */

import type { PhasesConfig, PhaseDefinition } from '../types.js'
import type { RoleId } from '../standardTypes.js'

// ---------------------------------------------------------------------------
// Public: resolveRoleForPhase
// ---------------------------------------------------------------------------

/**
 * Return the default `RoleId` for the given `phaseId`, or `null` if:
 * - The phase does not exist in `phasesConfig.phases`
 * - The phase definition has no `role` field
 *
 * This is the single source of truth for auto-assume during phase transitions.
 */
export function resolveRoleForPhase(
  phasesConfig: PhasesConfig,
  phaseId: string,
): RoleId | null {
  const phase: PhaseDefinition | undefined = phasesConfig.phases.find(
    p => p.id === phaseId,
  )

  if (!phase) return null
  if (!phase.role) return null

  // PhaseDefinition.role is typed as 'pm' | 'developer' | 'reviewer' | 'tester' | undefined,
  // which is a subset of RoleId. The cast is safe.
  return phase.role as RoleId
}
