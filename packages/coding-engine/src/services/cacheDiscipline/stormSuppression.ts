/**
 * stormSuppression.ts — Proposal D: Tool-storm detection.
 *
 * A "tool storm" occurs when the model calls the same tool with identical
 * arguments repeatedly within a short window — symptoms of being stuck in a
 * loop.  This module detects the pattern and generates a synthetic user-role
 * reflection message that asks the model to reconsider its approach.
 *
 * Detection algorithm:
 *   1. Inspect the last `windowSize` (default 4) entries in the tool call
 *      history.
 *   2. Count how many of those match `next` by both name and args (deep-equal).
 *   3. If the count is ≥ `threshold` (default 2) → storm detected.
 *
 * Feature flag: `config.features.stormSuppression`.
 * When disabled, `detectStorm` always returns `{ isStorm: false }`.
 *
 * This module is a **pure-function module** — it holds no mutable state of
 * its own.  All side-effect decisions (e.g. actually inserting the message)
 * are left to the caller.
 */

import { getCacheDisciplineConfig } from './config.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single recorded tool invocation, used as history input for storm
 * detection.
 */
export type ToolCallRecord = {
  /** The tool name exactly as passed to the API. */
  name: string
  /** The arguments object exactly as passed to the API. */
  args: Record<string, unknown>
  /** Unix epoch millisecond timestamp.  Used for window pruning if the caller
   *  opts for time-based rather than count-based windows in the future. */
  timestamp: number
}

/**
 * Result returned by `detectStorm`.
 */
export type StormDetection = {
  /** True when a storm is detected AND the feature flag is enabled. */
  isStorm: boolean
  /** Human-readable explanation, present only when `isStorm` is true. */
  reason?: string
  /** Number of matching calls found in the window (including the next call).
   *  Present only when `isStorm` is true. */
  matchCount?: number
}

/**
 * A synthetic `user`-role message injected to interrupt a storm.
 * Typed as a minimal message shape compatible with the Anthropic API message
 * format used throughout the codebase.
 */
export type ReflectionMessage = {
  role: 'user'
  content: Array<{ type: 'text'; text: string }>
}

// ---------------------------------------------------------------------------
// Default parameters
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_SIZE = 4
const DEFAULT_THRESHOLD = 2

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Examine the recent tool-call history and determine whether `next` would
 * constitute a storm.
 *
 * @param history   All tool calls made so far (newest-last order).
 * @param next      The tool call that is *about* to be made.
 * @param opts.windowSize  How many recent history entries to examine
 *                         (default 4).
 * @param opts.threshold   How many matches within the window trigger a storm
 *                         (default 2).
 * @returns A `StormDetection` result.
 */
export function detectStorm(
  history: ToolCallRecord[],
  next: ToolCallRecord,
  opts?: {
    windowSize?: number
    threshold?: number
  },
): StormDetection {
  // Feature-flag guard — pure opt-out path
  const config = getCacheDisciplineConfig()
  if (!config.enabled || !config.features.stormSuppression) {
    return { isStorm: false }
  }

  const windowSize = opts?.windowSize ?? DEFAULT_WINDOW_SIZE
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD

  // Take the last `windowSize` entries from history
  const window = history.slice(-windowSize)

  const matchCount = window.filter(
    call => call.name === next.name && deepEqual(call.args, next.args),
  ).length

  if (matchCount >= threshold) {
    return {
      isStorm: true,
      reason:
        `Tool "${next.name}" called with identical args ` +
        `${matchCount + 1} times in last ${windowSize} turns`,
      matchCount: matchCount + 1,
    }
  }

  return { isStorm: false }
}

/**
 * Build a synthetic `user`-role message that asks the model to pause and
 * reflect.
 *
 * The `[SYSTEM]` prefix signals to the model (and to any filtering layer) that
 * this message is an automated injection, not genuine user input.
 *
 * @param reason - The storm reason string produced by `detectStorm`.
 * @returns A reflection message ready to be appended to the message array.
 */
export function injectReflectionMessage(reason: string): ReflectionMessage {
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text:
          `[SYSTEM] Tool storm detected: ${reason}.\n` +
          `Pause and reflect: are you making progress, or stuck in a loop? ` +
          `If stuck, summarize the issue and propose a different approach.`,
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Deep-equality check for plain JSON-compatible values.
 *
 * Handles:
 *  - Primitives (number, string, boolean, null, undefined)
 *  - Arrays (order-sensitive)
 *  - Plain objects (key order-insensitive)
 *
 * Does **not** handle: Date, Map, Set, RegExp, class instances, or circular
 * references.  Tool call args are always plain JSON objects so this is fine.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Strict identity covers primitives and same-reference objects
  if (a === b) return true

  // Null check (typeof null === 'object')
  if (a === null || b === null) return false

  // Type mismatch
  if (typeof a !== typeof b) return false

  // Array
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }

  // Object
  if (typeof a === 'object' && typeof b === 'object') {
    // Neither is an array at this point (handled above)
    if (Array.isArray(b)) return false

    const objA = a as Record<string, unknown>
    const objB = b as Record<string, unknown>

    const keysA = Object.keys(objA)
    const keysB = Object.keys(objB)

    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(objB, key)) return false
      if (!deepEqual(objA[key], objB[key])) return false
    }

    return true
  }

  // Remaining primitives already handled by `===` above
  return false
}
