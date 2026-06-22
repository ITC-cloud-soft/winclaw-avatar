/**
 * boundaries.ts — Proposal A (4-boundary cache strategy)
 *
 * Computes and applies four `cache_control` boundary markers to an Anthropic
 * API message array, maximising cache hit rate by segregating:
 *
 *   BP #1 — System prompt + tool definitions (session-stable, 1 h TTL)
 *   BP #2 — Session context (CLAUDE.md, memory — session-stable, 1 h TTL)
 *   BP #3 — Phase context (harness phase injection — ephemeral)
 *   BP #4 — Stable log tail (all messages except the last N — ephemeral)
 *
 * Detection heuristics scan message text content for well-known markers:
 *   BP #1: first message containing `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__`
 *          or message at index 0 when the boundary marker is absent.
 *   BP #2: last message (within a search window) containing `<context>` or
 *          `CLAUDE.md`; falls back to `systemPromptEnd` when none found.
 *   BP #3: last message containing `<!-- harness-context:end -->`; `null`
 *          when `harnessActive` is false or no such block is found.
 *   BP #4: `messages.length - stableTailOffsetFromEnd - 1` (default offset 2).
 *
 * Monotonicity invariant: if the four boundaries are not strictly
 * non-decreasing the function falls back to a single boundary
 * (`stableLogTailEnd` for all four) to preserve safe cache behaviour.
 *
 * The legacy path (feature flag off) is exposed by `applyAnthropicCacheControl`
 * returning the original array unchanged.
 *
 * Feature flag: `getCacheDisciplineConfig().features.fourBoundaryStrategy`
 */

import type { BetaMessageParam as MessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import { getCacheDisciplineConfig } from './config.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Index positions (in the message array) of the four cache boundaries.
 *
 * All numeric values are inclusive indices into the `messages` array.
 * A value of `-1` means the boundary could not be determined (only possible
 * when the array is empty).
 */
export type BoundaryMarkers = {
  /** End of system-prompt + tool definition region (BP #1). */
  systemPromptEnd: number
  /** End of session context region (BP #2, e.g. CLAUDE.md, memories). */
  sessionContextEnd: number
  /**
   * End of harness phase context (BP #3).
   * `null` when there is no active harness phase.
   */
  phaseContextEnd: number | null
  /** Index of the last message included in the stable log tail (BP #4). */
  stableLogTailEnd: number
}

// ---------------------------------------------------------------------------
// Marker constants
// ---------------------------------------------------------------------------

/** Injected into the system prompt to mark where session content starts. */
const SYSTEM_PROMPT_DYNAMIC_BOUNDARY = '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'

/** Harness phase-context delimiters (injected by promptInjector.ts). */
const HARNESS_CONTEXT_START = '<!-- harness-context:start -->'
const HARNESS_CONTEXT_END = '<!-- harness-context:end -->'

/** Sub-strings that identify session-context messages. */
const SESSION_CONTEXT_NEEDLES = ['<context>', 'CLAUDE.md'] as const

/** How far past `systemPromptEnd` to search for session-context messages. */
const SESSION_CONTEXT_SEARCH_WINDOW = 10

/**
 * Number of trailing messages excluded from the stable-log-tail boundary.
 * These most-recent messages are left uncached to avoid cache-write overhead
 * on every turn.
 */
const DEFAULT_STABLE_TAIL_OFFSET_FROM_END = 2

// ---------------------------------------------------------------------------
// Content-extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extracts all text from a `MessageParam` as a single concatenated string.
 * Returns an empty string for messages with no text-type content blocks.
 */
function extractText(msg: MessageParam): string {
  const content = msg.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  const parts: string[] = []
  for (const block of content) {
    if (typeof block === 'string') {
      parts.push(block)
    } else if (
      typeof block === 'object' &&
      block !== null &&
      'type' in block &&
      (block as { type: string }).type === 'text' &&
      'text' in block &&
      typeof (block as { text: unknown }).text === 'string'
    ) {
      parts.push((block as { text: string }).text)
    }
  }
  return parts.join('\n')
}

/**
 * Returns `true` when `text` includes any of the `needles`.
 */
function includesAny(text: string, needles: readonly string[]): boolean {
  return needles.some(n => text.includes(n))
}

// ---------------------------------------------------------------------------
// computeBoundaries
// ---------------------------------------------------------------------------

/**
 * Derives the four boundary positions from the current message array.
 *
 * Boundaries are computed by scanning message text for well-known markers
 * (see module-level JSDoc for full heuristic description).  When the
 * resulting positions would be non-monotonic (i.e. a later boundary has a
 * smaller index than an earlier one) all boundaries collapse to
 * `stableLogTailEnd` so the caller always receives a valid single-marker
 * fallback.
 *
 * @param messages                    Ordered message array (user/assistant).
 * @param opts.harnessActive          `true` when a harness workflow is active.
 * @param opts.stableTailOffsetFromEnd How many trailing messages to exclude (default 2).
 */
export function computeBoundaries(
  messages: MessageParam[],
  opts?: {
    harnessActive?: boolean
    stableTailOffsetFromEnd?: number
  },
): BoundaryMarkers {
  const tailOffset = opts?.stableTailOffsetFromEnd ?? DEFAULT_STABLE_TAIL_OFFSET_FROM_END
  const len = messages.length

  if (len === 0) {
    return { systemPromptEnd: 0, sessionContextEnd: 0, phaseContextEnd: null, stableLogTailEnd: 0 }
  }

  // ── BP #4: stable log tail ───────────────────────────────────────────────
  const stableLogTailEnd = Math.max(0, len - tailOffset - 1)

  // ── BP #1: system prompt end ─────────────────────────────────────────────
  // Scan for the first message containing the dynamic-boundary marker.
  let systemPromptEnd = 0
  for (let i = 0; i < len; i++) {
    if (extractText(messages[i]!).includes(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)) {
      systemPromptEnd = i
      break
    }
  }

  // ── BP #2: session context end ───────────────────────────────────────────
  // Scan a window after systemPromptEnd for CLAUDE.md / <context> messages.
  const sessionSearchEnd = Math.min(len - 1, systemPromptEnd + SESSION_CONTEXT_SEARCH_WINDOW)
  let sessionContextEnd = systemPromptEnd
  for (let i = systemPromptEnd; i <= sessionSearchEnd; i++) {
    if (includesAny(extractText(messages[i]!), SESSION_CONTEXT_NEEDLES)) {
      sessionContextEnd = i
    }
  }

  // ── BP #3: phase context end ─────────────────────────────────────────────
  let phaseContextEnd: number | null = null
  if (opts?.harnessActive) {
    // Scan forward from sessionContextEnd for a harness-context block.
    outer: for (let i = sessionContextEnd; i <= stableLogTailEnd; i++) {
      if (extractText(messages[i]!).includes(HARNESS_CONTEXT_START)) {
        // Found start; scan forward for the closing marker.
        for (let j = i; j <= stableLogTailEnd; j++) {
          if (extractText(messages[j]!).includes(HARNESS_CONTEXT_END)) {
            phaseContextEnd = j
            break outer
          }
        }
      }
    }
    // Fallback: if no explicit delimiter found but harness is active, use the
    // legacy heuristic (last message containing a harness phase marker).
    if (phaseContextEnd === null) {
      for (let i = len - 1; i >= sessionContextEnd; i--) {
        const text = extractText(messages[i]!)
        if (text.includes('[HARNESS PHASE:') || text.includes('<harness_phase>')) {
          phaseContextEnd = i
          break
        }
      }
    }
  }

  // ── Monotonicity check ───────────────────────────────────────────────────
  const bp3 = phaseContextEnd ?? sessionContextEnd
  const isMonotonic =
    systemPromptEnd <= sessionContextEnd &&
    sessionContextEnd <= bp3 &&
    bp3 <= stableLogTailEnd

  if (!isMonotonic) {
    // Fall back: all boundaries collapse to stableLogTailEnd (safe single-marker).
    return {
      systemPromptEnd: stableLogTailEnd,
      sessionContextEnd: stableLogTailEnd,
      phaseContextEnd: null,
      stableLogTailEnd,
    }
  }

  return { systemPromptEnd, sessionContextEnd, phaseContextEnd, stableLogTailEnd }
}

// ---------------------------------------------------------------------------
// Cache-control block helpers
// ---------------------------------------------------------------------------

/** Ephemeral cache-control descriptor without a TTL hint. */
const CC_EPHEMERAL = { type: 'ephemeral' } as const

/** Ephemeral cache-control descriptor with a 1-hour TTL hint (BP #1 and #2). */
const CC_EPHEMERAL_1H = { type: 'ephemeral', ttl: '1h' } as const

/**
 * Attaches a `cache_control` marker to the last eligible content block of a
 * `MessageParam`.  Returns a new object — the input is never mutated.
 *
 * Blocks whose `type` is `"thinking"` or `"redacted_thinking"` are skipped
 * (Anthropic does not allow attaching `cache_control` to thinking blocks).
 */
function attachCacheControl(
  msg: MessageParam,
  cacheControl: { type: string; ttl?: string },
): MessageParam {
  const content = msg.content

  if (typeof content === 'string') {
    return {
      ...msg,
      content: [
        {
          type: 'text' as const,
          text: content,
          cache_control: cacheControl as { type: 'ephemeral' },
        },
      ],
    }
  }

  if (!Array.isArray(content) || content.length === 0) {
    return msg
  }

  const newContent = [...content]
  // Walk backward to find the last non-thinking block.
  for (let i = newContent.length - 1; i >= 0; i--) {
    const block = newContent[i]
    if (
      typeof block === 'object' &&
      block !== null &&
      'type' in block &&
      (block as { type: string }).type !== 'thinking' &&
      (block as { type: string }).type !== 'redacted_thinking'
    ) {
      newContent[i] = { ...block, cache_control: cacheControl }
      break
    }
  }

  return { ...msg, content: newContent }
}

// ---------------------------------------------------------------------------
// applyAnthropicCacheControl
// ---------------------------------------------------------------------------

/**
 * Applies up to four `cache_control` markers to the message array at the
 * positions indicated by `boundaries`.
 *
 * - BP #1 (`systemPromptEnd`) and BP #2 (`sessionContextEnd`) receive
 *   `{ type: 'ephemeral', ttl: '1h' }` — providers that do not support `ttl`
 *   will ignore the extra field safely.
 * - BP #3 (`phaseContextEnd`) and BP #4 (`stableLogTailEnd`) receive
 *   `{ type: 'ephemeral' }`.
 *
 * When the feature flag is disabled, this function returns the original array
 * unchanged so the legacy single-marker placement in `claude.ts` remains active.
 *
 * @param messages    API-ready message array (already converted from internal types).
 * @param boundaries  Boundary positions from `computeBoundaries`.
 * @returns A new array with `cache_control` injected at up to four positions.
 */
export function applyAnthropicCacheControl(
  messages: MessageParam[],
  boundaries: BoundaryMarkers,
): MessageParam[] {
  const config = getCacheDisciplineConfig()
  if (!config.enabled || !config.features.fourBoundaryStrategy) {
    // Feature disabled — legacy single-marker path handles this request.
    return messages
  }

  if (messages.length === 0) return messages

  const result = [...messages]

  // v3.0.1 — Anthropic API rule: within a single request, `ttl='1h'` blocks
  // MUST NOT come after `ttl='5m'` blocks (processing order: tools → system →
  // messages). When multiple BPs collapse onto the same message — or when
  // `addCacheBreakpoints` has already attached a 1h marker via `getCacheControl`
  // — mixing TTLs inside the `messages` array trivially violates the rule.
  //
  // The system prompt itself is emitted in the `system:` field by
  // `buildSystemPromptBlocks`, which still applies 1h TTL via `getCacheControl`
  // for eligible callers. That marker is processed BEFORE any `messages`
  // marker, so there is no benefit to also using 1h here — and significant
  // risk of breaking the request entirely. All four message-level BPs
  // therefore use plain `{ type: 'ephemeral' }` (5-minute TTL).
  const markerEntries: Array<[number | null, typeof CC_EPHEMERAL]> = [
    [boundaries.systemPromptEnd,   CC_EPHEMERAL],  // BP #1
    [boundaries.sessionContextEnd, CC_EPHEMERAL],  // BP #2
    [boundaries.phaseContextEnd,   CC_EPHEMERAL],  // BP #3
    [boundaries.stableLogTailEnd,  CC_EPHEMERAL],  // BP #4
  ]

  for (const [idx, cc] of markerEntries) {
    if (idx === null || idx < 0) continue
    const clamped = Math.min(idx, result.length - 1)
    const msg = result[clamped]
    if (msg) {
      result[clamped] = attachCacheControl(msg, cc)
    }
  }

  return result
}
