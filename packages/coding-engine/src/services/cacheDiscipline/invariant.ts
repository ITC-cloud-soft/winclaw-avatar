/**
 * invariant.ts — Proposal B: Append-only prefix hash assertion.
 *
 * Detects cache-breaking mutations to the immutable prefix of a message
 * conversation during development and test runs.  In production the assert
 * is a no-op with zero overhead.
 *
 * The core idea: before and after any operation that should only append to
 * the conversation (compact, skill injection, phase advance, etc.) take a
 * SHA-256 snapshot of everything up to the boundary index.  If the hash
 * changes, an immutable prefix was mutated — throw immediately so the bug
 * is caught at the boundary-crossing code rather than during an obscure
 * cache miss.
 *
 * Active only when:
 *   - `getCacheDisciplineConfig().features.appendOnlyAssert` is `true`, AND
 *   - `NODE_ENV=development` OR `METACODER_INVARIANT_CHECK=1`
 *     (these are baked into the config default; callers just check the flag).
 *
 * Production deployments always disable this via the config default.
 *
 * Feature flag: `getCacheDisciplineConfig().features.appendOnlyAssert`
 */

import { createHash } from 'node:crypto'
import { getCacheDisciplineConfig } from './config.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A short hex string (first 16 characters of a SHA-256 hash) representing the
 * stable prefix of a message array up to and including `boundary`.
 */
export type PrefixHash = string

// ---------------------------------------------------------------------------
// snapshotPrefixHash
// ---------------------------------------------------------------------------

/**
 * Computes a short SHA-256 hash of the first `boundary + 1` messages.
 *
 * Serialisation uses `JSON.stringify` with **sorted keys** so that
 * property-insertion order differences do not produce spurious hash changes.
 * Only the first 16 hex characters are returned — enough to detect accidental
 * mutations while keeping the string compact.
 *
 * @param messages  The full conversation message array.
 * @param boundary  Inclusive index of the last message in the stable prefix.
 *                  When `boundary >= messages.length` the entire array is hashed.
 * @returns A 16-character lowercase hex string.
 */
export function snapshotPrefixHash(
  messages: ReadonlyArray<unknown>,
  boundary: number,
): PrefixHash {
  const end = Math.min(boundary + 1, messages.length)
  const slice = messages.slice(0, end)

  // Sort keys for stable serialisation regardless of object construction order.
  const serialised = JSON.stringify(slice, (_key, value: unknown) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[k] = (value as Record<string, unknown>)[k]
      }
      return sorted
    }
    return value
  })

  return createHash('sha256').update(serialised).digest('hex').slice(0, 16)
}

// ---------------------------------------------------------------------------
// assertPrefixUnchanged
// ---------------------------------------------------------------------------

/**
 * Throws a `CachePrefixMutationError` when the hash of the prefix up to
 * `boundary` has changed since `previousHash` was captured.
 *
 * This is a no-op when:
 *   - `getCacheDisciplineConfig().features.appendOnlyAssert` is `false`, or
 *   - The configuration `enabled` flag is `false`.
 *
 * @param previousHash    Hash captured before the operation under test.
 * @param currentMessages The message array after the operation.
 * @param boundary        Inclusive boundary index (same value used for `previousHash`).
 * @param context         A short human-readable label for the caller (used in the error message).
 * @throws {CachePrefixMutationError} When mutation is detected and asserts are active.
 */
export function assertPrefixUnchanged(
  previousHash: PrefixHash,
  currentMessages: ReadonlyArray<unknown>,
  boundary: number,
  context: string,
): void {
  const config = getCacheDisciplineConfig()
  if (!config.enabled || !config.features.appendOnlyAssert) return

  const currentHash = snapshotPrefixHash(currentMessages, boundary)
  if (currentHash !== previousHash) {
    throw new CachePrefixMutationError(
      boundary,
      context,
      previousHash,
      currentHash,
    )
  }
}

// ---------------------------------------------------------------------------
// withInvariantCheck
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper that snapshots the prefix hash before calling `fn`,
 * then asserts the prefix is unchanged after `fn` returns.
 *
 * Use this to guard any code that should only append to the conversation:
 *
 * ```ts
 * const result = withInvariantCheck(messages, boundary, 'compact', () => {
 *   return compact(messages)
 * })
 * ```
 *
 * When `appendOnlyAssert` is disabled, `fn` is called directly with no
 * overhead.
 *
 * @param messages  The message array that `fn` will operate on.
 * @param boundary  Inclusive boundary index of the stable prefix.
 * @param label     Short description of the operation (used in error messages).
 * @param fn        The operation to execute and guard.
 * @returns The return value of `fn`.
 */
export function withInvariantCheck<T>(
  messages: ReadonlyArray<unknown>,
  boundary: number,
  label: string,
  fn: () => T,
): T {
  const config = getCacheDisciplineConfig()
  if (!config.enabled || !config.features.appendOnlyAssert) {
    return fn()
  }

  const before = snapshotPrefixHash(messages, boundary)
  const result = fn()
  assertPrefixUnchanged(before, messages, boundary, label)
  return result
}

// ---------------------------------------------------------------------------
// CachePrefixMutationError
// ---------------------------------------------------------------------------

/**
 * Thrown by `assertPrefixUnchanged` when a mutation is detected in the
 * supposedly immutable message prefix.
 */
export class CachePrefixMutationError extends Error {
  /** Boundary index that was checked. */
  readonly boundary: number
  /** Caller-supplied context label. */
  readonly context: string
  /** Hash before the mutation. */
  readonly previousHash: PrefixHash
  /** Hash after the mutation. */
  readonly currentHash: PrefixHash

  constructor(
    boundary: number,
    context: string,
    previousHash: PrefixHash,
    currentHash: PrefixHash,
  ) {
    super(
      `[CacheDiscipline] Prefix mutated at boundary ${boundary} ` +
      `(context: ${context}): ${previousHash} → ${currentHash}. ` +
      `This invalidates the prompt cache and indicates a bug. ` +
      `Set METACODER_CACHE_DISCIPLINE=off to silence during investigation.`,
    )
    this.name = 'CachePrefixMutationError'
    this.boundary = boundary
    this.context = context
    this.previousHash = previousHash
    this.currentHash = currentHash
  }
}
