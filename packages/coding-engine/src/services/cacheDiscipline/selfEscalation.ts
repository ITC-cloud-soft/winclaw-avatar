/**
 * selfEscalation.ts — Proposal E
 *
 * Detects `<<<NEEDS_SONNET>>>` / `<<<NEEDS_OPUS>>>` / `<<<NEEDS_PRO>>>` markers
 * that a model may emit on the **first line** of its response to signal that the
 * task exceeds its capability tier and should be retried with a stronger model.
 *
 * Rules enforced here:
 *  - Marker MUST appear on the first non-empty line (after trimming leading
 *    whitespace).  Mid-content markers are silently ignored to prevent false
 *    positives when the AI describes the escalation system to a user.
 *  - Escalation is strictly one-way (haiku → sonnet → opus,
 *    deepseek-flash → deepseek-pro).  Downgrade is never permitted.
 *  - When the `selfEscalation` feature flag is off, every call returns
 *    `shouldEscalate: false` — no side-effects.
 */

import { getCacheDisciplineConfig } from './config.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Logical model capability tier. */
export type ModelTier =
  | 'haiku'
  | 'sonnet'
  | 'opus'
  | 'deepseek-flash'
  | 'deepseek-pro'

/** Escalation request markers that a model may emit as its first line. */
export type EscalationMarker =
  | '<<<NEEDS_SONNET>>>'
  | '<<<NEEDS_OPUS>>>'
  | '<<<NEEDS_PRO>>>'

/** Result of analysing a single response for an escalation request. */
export type EscalationDetection = {
  /** True when the model requested escalation AND the feature is enabled. */
  shouldEscalate: boolean
  /** The tier the model was running at when it emitted the marker. */
  fromTier: ModelTier
  /** The tier to retry with, when `shouldEscalate` is true. */
  toTier?: ModelTier
  /** The raw marker string that triggered escalation. */
  marker?: EscalationMarker
}

// ---------------------------------------------------------------------------
// Tier → marker mapping
// Only models that have a higher tier emit a marker; top-tier models return null.
// ---------------------------------------------------------------------------

const TIER_TO_MARKER: Record<ModelTier, EscalationMarker | null> = {
  haiku: '<<<NEEDS_SONNET>>>',
  sonnet: '<<<NEEDS_OPUS>>>',
  opus: null,
  'deepseek-flash': '<<<NEEDS_PRO>>>',
  'deepseek-pro': null,
}

// ---------------------------------------------------------------------------
// Tier resolution from raw model id strings
// ---------------------------------------------------------------------------

/**
 * Maps a raw Anthropic / DeepSeek model id to the appropriate `ModelTier`.
 *
 * The mapping is intentionally broad so that future model versions
 * (e.g. `claude-haiku-4-6-...`) are automatically classified without a code
 * change.
 *
 * @returns The resolved `ModelTier`, or `null` when the id is unrecognised.
 */
export function modelIdToTier(modelId: string): ModelTier | null {
  const lower = modelId.toLowerCase().replace(/\[.*\]$/, '').trim()

  // DeepSeek family — check before generic Claude checks
  if (lower.includes('deepseek') && lower.includes('flash')) {
    return 'deepseek-flash'
  }
  if (lower.includes('deepseek')) {
    return 'deepseek-pro'
  }

  // Claude haiku (3.x and 4.x)
  if (lower.includes('haiku')) return 'haiku'

  // Claude opus (3.x and 4.x)
  if (lower.includes('opus')) return 'opus'

  // Claude sonnet (3.x and 4.x) — after haiku/opus to avoid substring clashes
  if (lower.includes('sonnet')) return 'sonnet'

  return null
}

// ---------------------------------------------------------------------------
// Tier progression
// ---------------------------------------------------------------------------

/**
 * Returns the next higher `ModelTier` in the escalation chain, or `null` when
 * the provided tier is already at the top of its chain.
 *
 * Escalation chains:
 *   haiku → sonnet → opus   (Claude)
 *   deepseek-flash → deepseek-pro   (DeepSeek)
 */
export function nextTier(tier: ModelTier): ModelTier | null {
  switch (tier) {
    case 'haiku':         return 'sonnet'
    case 'sonnet':        return 'opus'
    case 'opus':          return null
    case 'deepseek-flash': return 'deepseek-pro'
    case 'deepseek-pro':  return null
  }
}

// ---------------------------------------------------------------------------
// Core detection function
// ---------------------------------------------------------------------------

/**
 * Analyses the first line of `response` to detect an escalation marker.
 *
 * @param response       The full response string returned by the model.
 * @param currentModelId The raw model id string (e.g. `"claude-haiku-4-5-20251001"`).
 * @returns              An `EscalationDetection` result.  When the feature flag
 *                       is disabled, always returns `{ shouldEscalate: false, fromTier }`.
 */
export function detectEscalationMarker(
  response: string,
  currentModelId: string,
): EscalationDetection {
  const fromTier = modelIdToTier(currentModelId) ?? 'sonnet'

  // Respect feature flag — pure opt-out path
  const config = getCacheDisciplineConfig()
  if (!config.enabled || !config.features.selfEscalation) {
    return { shouldEscalate: false, fromTier }
  }

  // Extract the first non-empty line
  const firstLine = extractFirstLine(response)
  if (!firstLine) {
    return { shouldEscalate: false, fromTier }
  }

  // Check whether the first line is exactly an escalation marker
  const expectedMarker = TIER_TO_MARKER[fromTier]
  if (expectedMarker === null) {
    // Top-of-chain model — no escalation possible
    return { shouldEscalate: false, fromTier }
  }

  if (firstLine !== expectedMarker) {
    return { shouldEscalate: false, fromTier }
  }

  const toTier = nextTier(fromTier)
  if (toTier === null) {
    // Defensive: should never happen because top-tier models have null markers
    return { shouldEscalate: false, fromTier }
  }

  return {
    shouldEscalate: true,
    fromTier,
    toTier,
    marker: expectedMarker,
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Returns the trimmed first non-empty line of `text`, or an empty string when
 * the text is blank.
 */
function extractFirstLine(text: string): string {
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.length > 0) return line
  }
  return ''
}
