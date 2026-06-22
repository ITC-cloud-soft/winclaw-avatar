/**
 * activeEnv.ts
 *
 * Session-wide active environment state singleton for the Meta Coder Infra
 * Environment Manager.  All state is held in a module-level variable; all
 * setters are synchronous so they can be called from prompt handlers without
 * an await.
 */

import type { ActiveEnvState, EnvironmentsFile, PartialOverride } from './types.js'
import { SafetyError } from './safety/types.js'
import {
  elevate,
  revoke,
  isElevated as _elevationIsActive,
  _resetForTest as _elevationResetForTest,
} from './safety/elevation.js'

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

const DEFAULT_STATE: ActiveEnvState = {
  envName: '',
  readonly: false,
}

let _state: ActiveEnvState = { ...DEFAULT_STATE }

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return a snapshot of the current active env state.
 * Callers must NOT mutate the returned object.
 */
export function getActiveEnv(): ActiveEnvState {
  return { ..._state, partialOverrides: _state.partialOverrides ? [..._state.partialOverrides] : undefined }
}

/**
 * Switch the active environment.
 *
 * @param envName  - name of the environment to activate
 * @param options.reason   - human-readable reason written to the state (e.g. "/env use production Reason: hotfix")
 * @param options.readonly - if true, the env is mounted read-only
 */
export function setActiveEnv(
  envName: string,
  options?: { reason?: string; readonly?: boolean },
): void {
  // Switching env clears prior elevation. Per spec §7.4, elevation is bound
  // to a specific env + reason — when the operator switches envs the
  // elevation context is no longer valid. They must re-elevate explicitly
  // for the new env.
  _state = {
    envName,
    readonly: options?.readonly ?? false,
    ...(options?.reason !== undefined ? { reason: options.reason } : {}),
    partialOverrides: undefined,
  }
}

/**
 * Set partial overrides — e.g. "use prod for cloud but dev for storage".
 * Replaces any existing overrides.
 */
export function setPartialOverrides(overrides: PartialOverride[]): void {
  _state = { ..._state, partialOverrides: [...overrides] }
}

/**
 * Elevate the active env for a limited duration.
 *
 * Delegates to the real timer-based elevation module (safety/elevation.ts).
 * A real setTimeout auto-revokes the elevation when durationMs elapses.
 *
 * @param reason     - human-readable reason for elevation (REQUIRED)
 * @param durationMs - how long elevation lasts in milliseconds (default 5 min)
 */
export function elevateActiveEnv(reason: string, durationMs: number = 5 * 60 * 1000): void {
  const env = getActiveEnv()
  if (!env.envName) {
    throw new SafetyError(
      'Cannot elevate: no active environment is set. Call setActiveEnv() first.',
      'elevation-not-active',
    )
  }
  elevate(env.envName, { reason, durationMs })
  // Mirror elevatedUntil into local state so getActiveEnv() still reflects it
  // and existing code that reads _state.elevatedUntil continues to work.
  _state = { ..._state, reason, elevatedUntil: Date.now() + durationMs }
}

/**
 * Returns true if the active env is currently elevated AND the elevation has
 * not yet expired.  Delegates to the real timer-based elevation module.
 */
export function isElevated(): boolean {
  return _elevationIsActive()
}

/**
 * Clear elevation state.  Cancels the real timer in the elevation module.
 */
export function clearElevation(): void {
  revoke()
  const { elevatedUntil: _ignored, ...rest } = _state
  _state = rest
}

/**
 * Reset all state back to the default (empty envName, not readonly).
 * Also resets the elevation module so timers don't bleed across tests.
 */
export function resetActiveEnv(): void {
  _elevationResetForTest()
  _state = { ...DEFAULT_STATE }
}

/**
 * Initialise the active env from an EnvironmentsFile by honouring the
 * `default:` field.  Called once at session start.
 *
 * If the default env name is blank or missing, the state remains empty.
 */
export function loadDefaultActiveEnv(envFile: EnvironmentsFile): void {
  const defaultName = envFile.default
  if (defaultName && typeof defaultName === 'string') {
    _state = {
      envName: defaultName,
      readonly: false,
    }
  }
}
