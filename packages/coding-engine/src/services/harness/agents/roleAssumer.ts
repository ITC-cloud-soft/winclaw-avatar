/**
 * agents/roleAssumer.ts — Apply a role assumption to PhaseState.
 *
 * `assumeRole` loads the persona, builds the injected block, updates PhaseState,
 * and returns both the updated state and the RoleAssumption record.
 * The caller is responsible for persisting state and appending the audit entry.
 *
 * `clearRole` removes the active role (sets activeRole + manualRole to null).
 */

import type { HarnessLayout } from '../types.js'
import type { PhaseState, RoleId, PersonaSpec, RoleAssumption } from '../standardTypes.js'
import { loadPersona } from './personaLoader.js'

// ---------------------------------------------------------------------------
// Internal: build fenced persona block
// ---------------------------------------------------------------------------

const PERSONA_START = '<!-- harness-persona:start -->'
const PERSONA_END = '<!-- harness-persona:end -->'

/**
 * Produce the fenced markdown block that wraps persona content.
 * This is suitable for injection into CLAUDE.md or a system prompt.
 */
export function buildPersonaBlock(role: RoleId, persona: PersonaSpec): string {
  return [
    PERSONA_START,
    `## Active Role: ${role}`,
    '',
    persona.content,
    PERSONA_END,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AssumeRoleOptions = {
  workspacePath: string
  layout: HarnessLayout
  currentState: PhaseState
  role: RoleId
  /** True when triggered by phase auto-assume; false for /harness assume */
  fromPhaseAuto: boolean
  reason?: string
}

export type AssumeRoleResult = {
  /** Updated PhaseState (caller must persist) */
  next: PhaseState
  /** Assumption record (caller may append to audit) */
  assumption: RoleAssumption
}

export type ClearRoleOptions = {
  workspacePath: string
  currentState: PhaseState
}

export type ClearRoleResult = {
  next: PhaseState
}

// ---------------------------------------------------------------------------
// Public: assumeRole
// ---------------------------------------------------------------------------

/**
 * Apply a role to the given `PhaseState`.
 *
 * - Always sets `next.activeRole = role`
 * - When `fromPhaseAuto` is `false`, also sets `next.manualRole = role`
 *   (manual overrides persist across phase transitions until explicitly cleared)
 * - Loads persona content and builds the fenced markdown block
 *
 * The returned `next` state is a shallow clone of `currentState`; the caller
 * must persist it via `savePhaseState`.
 */
export async function assumeRole(opts: AssumeRoleOptions): Promise<AssumeRoleResult> {
  const { layout, currentState, role, fromPhaseAuto, reason } = opts

  const persona = await loadPersona(layout, role)
  const personaBlock = buildPersonaBlock(role, persona)

  const next: PhaseState = {
    ...currentState,
    activeRole: role,
  }

  // Manual role sets a sticky override; auto-assume does not change manualRole
  if (!fromPhaseAuto) {
    next.manualRole = role
  }

  const assumption: RoleAssumption = {
    role,
    fromPhaseAuto,
    personaBlock,
    ...(reason !== undefined ? { reason } : {}),
  }

  return { next, assumption }
}

// ---------------------------------------------------------------------------
// Public: clearRole
// ---------------------------------------------------------------------------

/**
 * Remove the active role from PhaseState (opposite of assumeRole).
 *
 * Sets both `activeRole` and `manualRole` to `null`/`undefined`.
 * Returns the updated state; caller must persist.
 */
export function clearRole(opts: ClearRoleOptions): ClearRoleResult {
  const { currentState } = opts

  const next: PhaseState = {
    ...currentState,
    activeRole: null,
  }
  // Remove manualRole property entirely (make it optional/absent)
  delete next.manualRole

  return { next }
}

// Re-export marker constants for use in injector
export { PERSONA_START, PERSONA_END }
