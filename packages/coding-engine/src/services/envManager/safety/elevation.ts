/**
 * elevation.ts
 *
 * Process-singleton elevation manager (§7.4).
 *
 * One active elevation at a time.  A real setTimeout fires auto-revoke so
 * callers do not need to poll.  Elevation is entirely in-memory and dies
 * with the process.
 */

import type { ElevationState, ElevationOptions } from './types.js'
import { SafetyError } from './types.js'

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let _state: ElevationState | null = null
const _autoRevokeCallbacks = new Set<(state: ElevationState) => void>()

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _clearTimer(): void {
  if (_state?.timer != null) {
    clearTimeout(_state.timer)
    ;(_state as ElevationState).timer = null
  }
}

function _fireAutoRevoke(snapshot: ElevationState): void {
  for (const cb of _autoRevokeCallbacks) {
    try {
      cb(snapshot)
    } catch {
      // Callbacks must not crash the elevation machinery.
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Elevate `envName` for `durationMs` milliseconds.
 *
 * - `options.reason` is REQUIRED; throws `SafetyError('two-phase-required')`
 *   when missing or empty.
 * - If an elevation is already active the previous timer is cancelled and the
 *   new elevation replaces it.
 * - Returns the new ElevationState.
 */
export function elevate(envName: string, options: ElevationOptions): ElevationState {
  if (!options.reason || options.reason.trim() === '') {
    throw new SafetyError(
      'Elevation requires a reason. Pass options.reason describing why write access is needed.',
      'two-phase-required',
    )
  }

  const durationMs = options.durationMs ?? 5 * 60 * 1000
  const now = Date.now()

  // If already elevated, tear down the previous timer first.
  if (_state !== null) {
    _clearTimer()
    // Note: we intentionally do NOT fire onAutoRevoke listeners here — the
    // elevation was replaced, not auto-revoked.
  }

  const expiresAt = now + durationMs

  // Placeholder state so the timer callback can safely close over _state.
  _state = {
    envName,
    reason: options.reason,
    startedAt: now,
    expiresAt,
    timer: null,
  }

  const timer = setTimeout(() => {
    // Guard against race: only fire if _state still refers to this elevation.
    if (_state !== null && _state.expiresAt === expiresAt) {
      const snapshot: ElevationState = { ..._state, timer: null }
      _state = null
      _fireAutoRevoke(snapshot)
    }
  }, durationMs)

  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  _state.timer = timer

  return { ..._state }
}

/**
 * Manually revoke elevation.  Clears the timer.  Does NOT fire
 * `onAutoRevoke` listeners (use the return value or isElevated() to detect).
 */
export function revoke(): void {
  if (_state === null) return
  _clearTimer()
  _state = null
}

/**
 * Return the current ElevationState, or null if not elevated.
 * Does NOT filter by expiry — callers should use isElevated() for that.
 */
export function getState(): ElevationState | null {
  return _state === null ? null : { ..._state }
}

/**
 * True if an elevation is active AND has not yet expired.
 *
 * Uses both the live timer AND a timestamp comparison so it is correct even
 * if the JavaScript event loop drifts (e.g. in heavy-load scenarios).
 */
export function isElevated(): boolean {
  return _state !== null && _state.expiresAt > Date.now()
}

/**
 * Milliseconds remaining in the current elevation, or 0 if not elevated.
 */
export function remainingMs(): number {
  if (!isElevated()) return 0
  return Math.max(0, _state!.expiresAt - Date.now())
}

/**
 * Register a callback that fires when elevation auto-revokes (timer fires).
 * Manual revoke() does NOT trigger these callbacks.
 *
 * @returns An unsubscribe function.
 */
export function onAutoRevoke(callback: (state: ElevationState) => void): () => void {
  _autoRevokeCallbacks.add(callback)
  return () => {
    _autoRevokeCallbacks.delete(callback)
  }
}

// ---------------------------------------------------------------------------
// Test reset hook
// ---------------------------------------------------------------------------

/**
 * Reset all module state.  Use only in tests.
 */
export function _resetForTest(): void {
  _clearTimer()
  _state = null
  _autoRevokeCallbacks.clear()
}
