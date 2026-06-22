/**
 * workflow/phaseState.ts — Persist and load PhaseState.
 *
 * State is stored as YAML at:
 *   <workspacePath>/.metacoder/audit/phase-state.yaml
 *
 * Three public functions:
 *   loadPhaseState   — read existing state; null if absent
 *   savePhaseState   — write state atomically (write-then-rename)
 *   initPhaseState   — create a fresh state at the given defaultPhase
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import yaml from 'yaml'
import type { PhaseState, PhaseId, RoleId } from '../standardTypes.js'

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export function phaseStatePath(workspacePath: string): string {
  return path.join(workspacePath, '.metacoder', 'audit', 'phase-state.yaml')
}

async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

// ---------------------------------------------------------------------------
// Internal: coerce raw YAML object into PhaseState
// ---------------------------------------------------------------------------

/**
 * The 10 canonical Harness Engineering phase ids — the design-mandated
 * pipeline shape. Per HARNESS_ENGINEERING_INTEGRATION.md §10.2, every harness
 * project MUST use these phase ids; aliasing / renaming (e.g. `review` instead
 * of `code-review`, or `done` instead of `confirm`) breaks the state machine.
 *
 * Order is significant — matches the default pipeline progression.
 */
export const CANONICAL_PHASE_IDS: readonly PhaseId[] = [
  'requirements',
  'design',
  'test-spec',
  'implementation',
  'code-review',
  'integration-test',
  'performance',
  'security',
  'deploy-plan',
  'confirm',
] as const

const VALID_PHASES = new Set<PhaseId>(CANONICAL_PHASE_IDS)

const VALID_ROLES = new Set<RoleId>(['pm', 'developer', 'reviewer', 'tester'])

export function isCanonicalPhaseId(v: unknown): v is PhaseId {
  return typeof v === 'string' && VALID_PHASES.has(v as PhaseId)
}

/**
 * Coerce an unknown into a canonical PhaseId, or null when invalid.
 *
 * Emits a console.warn for non-null inputs that fail validation — silent
 * coercion previously hid serious phase-state corruption and phases.yaml
 * misconfiguration. Callers should NOT rely on this to "clean up" arbitrary
 * IDs; phases.yaml is validated strictly at load time by `phasesLoader`.
 */
function coercePhaseId(v: unknown): PhaseId | null {
  if (v === null || v === undefined) return null
  const s = String(v)
  if (VALID_PHASES.has(s as PhaseId)) return s as PhaseId
  // eslint-disable-next-line no-console
  console.warn(
    `[harness] Phase id "${s}" is not one of the 10 canonical ids ` +
    `(${CANONICAL_PHASE_IDS.join(', ')}). Coercing to null — phase ` +
    `state machine will report current=null. Fix your harness/workflow/phases.yaml.`,
  )
  return null
}

function coerceRoleId(v: unknown): RoleId | null {
  if (v === null || v === undefined) return null
  const s = String(v)
  return VALID_ROLES.has(s as RoleId) ? (s as RoleId) : null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function coerceGateResult(
  v: unknown,
): PhaseState['lastGateResult'] | undefined {
  if (!isRecord(v)) return undefined
  if (typeof v['gateId'] !== 'string') return undefined
  if (typeof v['passed'] !== 'boolean') return undefined
  if (typeof v['ranAt'] !== 'string') return undefined
  return { gateId: v['gateId'], passed: v['passed'], ranAt: v['ranAt'] }
}

function coercePhaseState(raw: unknown): PhaseState | null {
  if (!isRecord(raw)) return null
  if (typeof raw['workspacePath'] !== 'string') return null

  const state: PhaseState = {
    current: coercePhaseId(raw['current']),
    workspacePath: raw['workspacePath'],
    enteredAt:
      typeof raw['enteredAt'] === 'number'
        ? raw['enteredAt']
        : Date.now(),
    activeRole: coerceRoleId(raw['activeRole']),
    rollbackAttempts:
      typeof raw['rollbackAttempts'] === 'number' && raw['rollbackAttempts'] >= 0
        ? Math.floor(raw['rollbackAttempts'])
        : 0,
  }

  const manualRole = coerceRoleId(raw['manualRole'])
  if (manualRole !== null) state.manualRole = manualRole

  if (typeof raw['reason'] === 'string') state.reason = raw['reason']

  const lastGateResult = coerceGateResult(raw['lastGateResult'])
  if (lastGateResult) state.lastGateResult = lastGateResult

  return state
}

// ---------------------------------------------------------------------------
// Public: loadPhaseState
// ---------------------------------------------------------------------------

/**
 * Load the persisted PhaseState for a workspace.
 *
 * Returns `null` if the state file does not exist or its content is corrupt.
 * Never throws for I/O or parse errors — returns null instead.
 */
export async function loadPhaseState(workspacePath: string): Promise<PhaseState | null> {
  const stateFile = phaseStatePath(workspacePath)
  let raw: string
  try {
    raw = await fs.readFile(stateFile, 'utf8')
  } catch {
    return null
  }

  let parsed: unknown
  try {
    parsed = yaml.parse(raw)
  } catch {
    return null
  }

  return coercePhaseState(parsed)
}

// ---------------------------------------------------------------------------
// Public: savePhaseState
// ---------------------------------------------------------------------------

/**
 * Atomically persist `PhaseState` to disk.
 *
 * Writes to a temp file in the same directory then renames to avoid partial
 * writes being visible to concurrent readers.
 */
export async function savePhaseState(state: PhaseState): Promise<void> {
  const stateFile = phaseStatePath(state.workspacePath)
  await ensureDir(stateFile)

  const content = yaml.stringify(state)

  // Write to a temp file in the same directory then rename
  const dir = path.dirname(stateFile)
  const tmp = path.join(dir, `.phase-state.${process.pid}.tmp`)
  try {
    await fs.writeFile(tmp, content, 'utf8')
    await fs.rename(tmp, stateFile)
  } catch (err) {
    // Clean up temp on failure
    await fs.unlink(tmp).catch(() => undefined)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Public: initPhaseState
// ---------------------------------------------------------------------------

/**
 * Create and persist a fresh PhaseState, overwriting any existing state.
 *
 * @param workspacePath  Absolute path to the workspace
 * @param defaultPhase   Phase to start at (from PhasesConfig.default_phase)
 */
export async function initPhaseState(
  workspacePath: string,
  defaultPhase: PhaseId,
): Promise<PhaseState> {
  const state: PhaseState = {
    current: defaultPhase,
    workspacePath,
    enteredAt: Date.now(),
    activeRole: null,
    rollbackAttempts: 0,
  }
  await savePhaseState(state)
  return state
}

// Re-export path helper for tests
export { os }
