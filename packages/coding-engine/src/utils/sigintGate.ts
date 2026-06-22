/**
 * SIGINT double-tap gate.
 *
 * Why:
 *   On Windows conhost.exe (default cmd.exe / PowerShell window), the terminal
 *   occasionally delivers a spurious CTRL_C_EVENT to metacoder.exe under heavy
 *   React/Ink redraw load. We confirmed this with the session-2026-04-22T00-29-29
 *   crash log: memory was healthy (rss 840MB steady), no uncaught exception, and
 *   the shutdown was triggered by `[signal] SIGINT received` out of nowhere.
 *
 *   Without protection, any SIGINT — user Ctrl+C or spurious conhost event —
 *   immediately calls process.exit(0), killing an active session in the middle
 *   of a Phase 4 PRP run.
 *
 * Semantics:
 *   - First SIGINT in a window: ignored, print a one-line hint to stderr.
 *   - Second SIGINT within SIGINT_DOUBLE_TAP_MS (1.5s): shouldExitOnSigint()
 *     returns true → caller performs graceful shutdown.
 *   - After the window expires, the counter resets — the next SIGINT starts
 *     a fresh sequence.
 *
 * Call sites should be:
 *
 *   process.on('SIGINT', () => {
 *     if (!shouldExitOnSigint()) return
 *     // ...existing shutdown logic
 *   })
 *
 * Environment overrides:
 *   METACODER_SIGINT_IMMEDIATE=1  — disable the gate, restore classic Ctrl+C.
 *                                    Useful if the user is scripting metacoder
 *                                    and needs traditional single-Ctrl-C kill.
 *   METACODER_SIGINT_WINDOW_MS=<n> — override the double-tap window.
 */

/** Milliseconds between the first and second SIGINT that actually exits. */
const DEFAULT_WINDOW_MS = 1500

/**
 * Calls from different SIGINT handlers for the SAME SIGINT event arrive within
 * a few milliseconds of each other. They must not be treated as separate
 * taps, or the gate instantly "counts" two taps from one Ctrl+C and exits.
 *
 * Observed in session-2026-04-22T00-47-23: one SIGINT received, exit 0.5s
 * later because main.tsx and gracefulShutdown.ts both call the gate.
 */
const SAME_SIGINT_DEDUP_MS = 250

let lastSigintAt = 0
let lastSigintCountedAt = 0  // Only updated when gate accepts a tap as genuine.
let hintShown = false

function getWindowMs(): number {
  const raw = process.env.METACODER_SIGINT_WINDOW_MS
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed >= 100 && parsed <= 10000) {
      return parsed
    }
  }
  return DEFAULT_WINDOW_MS
}

/**
 * Returns true if the caller should proceed to exit, false if the SIGINT
 * should be treated as the first tap of a double-tap sequence.
 *
 * Always safe to call — never throws. Writes a single-line hint to stderr
 * on the first tap (only once per process lifetime to avoid spamming).
 *
 * Dedup: multiple handlers for the same SIGINT all call this function
 * within a few ms. Calls within SAME_SIGINT_DEDUP_MS of the last accepted
 * tap are treated as the SAME tap (return the same verdict, do not advance
 * state), so two handlers for one Ctrl+C cannot racially "count" it twice.
 */
export function shouldExitOnSigint(): boolean {
  // Escape hatch for automation / scripting.
  if (process.env.METACODER_SIGINT_IMMEDIATE === '1') {
    return true
  }

  const now = Date.now()
  const windowMs = getWindowMs()

  // Dedup: same-SIGINT redelivery to another handler — return the same
  // verdict as the last accepted tap without advancing state.
  //
  // Verdict encoding: if lastSigintCountedAt > lastSigintAt, the last
  // accepted tap was a "tap 2" (exit). Otherwise they're equal — the last
  // accepted tap was a "tap 1" (ignore). Redeliveries return the same.
  if (
    lastSigintCountedAt !== 0 &&
    now - lastSigintCountedAt < SAME_SIGINT_DEDUP_MS
  ) {
    return lastSigintCountedAt > lastSigintAt
  }

  // Genuine new SIGINT. Decide tap-1 vs tap-2.
  if (lastSigintAt !== 0 && now - lastSigintAt < windowMs) {
    // Second tap inside the window — legitimate user-requested exit.
    lastSigintCountedAt = now
    return true
  }

  // First tap (or a tap after the window expired). Arm the gate and
  // surface a hint. stderr keeps the message out of the Ink render buffer.
  lastSigintAt = now
  lastSigintCountedAt = now
  if (!hintShown) {
    try {
      process.stderr.write(
        '\n[metacoder] Ctrl+C ignored. Press again within ' +
          (windowMs / 1000).toFixed(1) +
          's to exit. ' +
          '(Set METACODER_SIGINT_IMMEDIATE=1 to restore classic single-Ctrl-C behaviour.)\n',
      )
    } catch {
      // stderr may be closed by the time this fires; best-effort.
    }
    hintShown = true
  }
  return false
}

/**
 * Reset the gate state. Useful for tests — in production the gate naturally
 * resets itself once the window expires, so normal callers never touch this.
 */
export function _resetSigintGateForTest(): void {
  lastSigintAt = 0
  lastSigintCountedAt = 0
  hintShown = false
}
