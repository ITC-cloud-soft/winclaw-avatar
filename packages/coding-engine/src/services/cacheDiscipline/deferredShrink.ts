/**
 * deferredShrink.ts — Proposal C: Deferred tool-result shrink.
 *
 * The problem: summarising a large tool result *immediately* after it arrives
 * mutates the messages array and breaks any already-created cache entry that
 * covers that position.
 *
 * The solution: mark a message as a shrink candidate now, but perform the
 * actual mutation only on the *next* `applyDeferredShrinks()` call, just
 * before sending the next request.  By that point the message is safely
 * behind the stable-log cache boundary (#4) and the model has already
 * consumed its full content.
 *
 * Feature flag: `config.features.deferredToolResultShrink`.
 * When disabled, every exported function is a strict no-op.
 */

import { getCacheDisciplineConfig } from './config.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A message that has been nominated for deferred shrinking.
 * `summarizedContent` is null until the first `applyDeferredShrinks()` call,
 * at which point it is computed lazily by the installed summarizer.
 */
export type ShrinkCandidate = {
  /** Stable id of the target message. */
  messageId: string
  /** Token count at nomination time. */
  originalTokens: number
  /** Computed lazily on first apply.  null until then. */
  summarizedContent: string | null
}

/**
 * Minimal representation of a message that this module needs to operate on.
 * Callers pass their own richer message objects — only these fields are read.
 */
export type ShrinkableMessage = {
  /** Stable unique identifier for the message. */
  id: string
  /**
   * The primary text content of the message.
   * For tool-result messages this is typically the tool output string.
   */
  content: string
  /** Approximate token count for this message's content. */
  tokens?: number
  /** Arbitrary additional properties preserved verbatim. */
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Default threshold
// ---------------------------------------------------------------------------

/** Messages with at least this many tokens are eligible for shrinking. */
const DEFAULT_SHRINK_THRESHOLD_TOKENS = 3_000

// ---------------------------------------------------------------------------
// Module-level queue (reset between tests via clearShrinkQueue())
// ---------------------------------------------------------------------------

let _queue: ShrinkCandidate[] = []

// ---------------------------------------------------------------------------
// Summarizer — pluggable, defaults to head+tail heuristic
// ---------------------------------------------------------------------------

/**
 * The currently installed summarizer function.
 * Replace with `setSummarizer()` for tests or production LLM integration.
 */
let _summarizer: (content: string) => string = defaultSummarize

/**
 * Simple head+tail heuristic summarizer.
 *
 * Keeps the first 500 characters and the last 200 characters of the input,
 * joined by a `[…summarized…]` separator when the content is long enough to
 * warrant truncation.
 *
 * @param content - The raw content string to summarize.
 * @returns A shortened representation of the content.
 */
export function defaultSummarize(content: string): string {
  const HEAD = 500
  const TAIL = 200
  const SEP = '\n[…summarized…]\n'

  if (content.length <= HEAD + TAIL) {
    return content
  }

  return content.slice(0, HEAD) + SEP + content.slice(content.length - TAIL)
}

/**
 * Replace the summarizer used by `applyDeferredShrinks`.
 *
 * Useful for tests (inject a deterministic stub) or for wiring in a real LLM
 * summarizer in production.
 *
 * @param fn - New summarizer.  Receives the full content string and must
 *             return a shorter (or equal-length) string.
 */
export function setSummarizer(fn: (content: string) => string): void {
  _summarizer = fn
}

/**
 * Reset the summarizer to the built-in `defaultSummarize` heuristic.
 * Called implicitly by `clearShrinkQueue()` so tests start from a known state.
 */
export function resetSummarizer(): void {
  _summarizer = defaultSummarize
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Nominate `message` for deferred shrinking.
 *
 * The message is queued if and only if:
 *   - the `deferredToolResultShrink` feature flag is enabled, AND
 *   - the message's token count meets the configured threshold.
 *
 * The message itself is **not mutated** at this point.
 *
 * @param message - The message to evaluate.
 */
export function markForShrink(message: ShrinkableMessage): void {
  const config = getCacheDisciplineConfig()
  if (!config.enabled || !config.features.deferredToolResultShrink) return

  const threshold =
    (config as unknown as { shrinkThresholdTokens?: number }).shrinkThresholdTokens ??
    DEFAULT_SHRINK_THRESHOLD_TOKENS

  const tokens = message.tokens ?? estimateTokens(message.content)
  if (tokens < threshold) return

  // Avoid double-queuing the same message id
  if (_queue.some(c => c.messageId === message.id)) return

  _queue.push({
    messageId: message.id,
    originalTokens: tokens,
    summarizedContent: null,
  })
}

/**
 * Apply all pending shrinks to the supplied message array and return a new
 * array with the mutated messages.
 *
 * Rules:
 *  - Only messages at or before `safeBoundaryIndex` are eligible.  Pass
 *    `undefined` to allow shrinking any queued message regardless of position.
 *  - The summary is computed lazily here (on first invocation for each
 *    candidate) by calling the installed summarizer.
 *  - When the feature flag is disabled the original array is returned
 *    unchanged (zero allocations).
 *
 * @param messages - The current message array.
 * @param opts.safeBoundaryIndex - Only shrink messages at indices ≤ this value.
 * @returns A new array with shrunk messages substituted.
 */
export function applyDeferredShrinks<T extends ShrinkableMessage>(
  messages: T[],
  opts?: { safeBoundaryIndex?: number },
): T[] {
  const config = getCacheDisciplineConfig()
  if (!config.enabled || !config.features.deferredToolResultShrink) {
    return messages
  }

  if (_queue.length === 0) return messages

  const boundaryIdx = opts?.safeBoundaryIndex ?? messages.length - 1

  // Build a fast-lookup set of eligible message ids (those at or before the boundary)
  const eligibleIds = new Set<string>()
  for (let i = 0; i <= boundaryIdx && i < messages.length; i++) {
    const msg = messages[i]
    if (msg) eligibleIds.add(msg.id)
  }

  // Nothing in the queue is eligible — short-circuit
  const applicableCandidates = _queue.filter(c => eligibleIds.has(c.messageId))
  if (applicableCandidates.length === 0) return messages

  // Build lookup: messageId → candidate
  const candidateMap = new Map<string, ShrinkCandidate>()
  for (const c of applicableCandidates) {
    candidateMap.set(c.messageId, c)
  }

  return messages.map(msg => {
    const candidate = candidateMap.get(msg.id)
    if (!candidate) return msg

    // Lazy summarisation — compute once and cache in the candidate object
    if (candidate.summarizedContent === null) {
      candidate.summarizedContent = _summarizer(msg.content)
    }

    // Return a shallow copy with the shrunken content
    return { ...msg, content: candidate.summarizedContent } as T
  })
}

/**
 * Clear the shrink queue and reset the summarizer to the default.
 *
 * Must be called in `afterEach` (or equivalent) when running tests so that
 * module-level state does not bleed between test cases.
 */
export function clearShrinkQueue(): void {
  _queue = []
  resetSummarizer()
}

/**
 * Return a read-only snapshot of the current shrink queue.
 *
 * Useful for test introspection — does not mutate internal state.
 *
 * @returns Immutable view of the pending shrink candidates.
 */
export function getShrinkQueueSnapshot(): ReadonlyArray<ShrinkCandidate> {
  return _queue.slice()
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Very rough token estimator: 1 token ≈ 4 characters.
 * Used when `message.tokens` is not provided.
 */
function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4)
}
