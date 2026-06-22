/**
 * costEstimator.ts — Proposal F (cost calculation layer)
 *
 * Provides a pure, side-effect-free function to convert Anthropic API
 * `usage` objects into a `CostBreakdown` denominated in USD.
 *
 * Pricing values are expressed **per million tokens** and sourced from the
 * Anthropic public pricing page as of 2026-05.  Update the `PRICING_TABLE`
 * constant when Anthropic publishes new rates.
 *
 * All exported symbols are pure — no env reads, no side effects.
 */

import type { ModelTier } from './selfEscalation.js'

// Re-export ModelTier for consumers who only import from costEstimator
export type { ModelTier }

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Token counts from a single Anthropic API response.
 * Mirrors the `usage` field shape in the Anthropic SDK `BetaUsage`.
 */
export type UsageRecord = {
  input_tokens: number
  output_tokens: number
  /** Tokens written to cache (billed at ~1.25× input rate). */
  cache_creation_input_tokens?: number
  /** Tokens read from cache (billed at ~0.1× input rate). */
  cache_read_input_tokens?: number
}

/** Per-model pricing in USD per million tokens. */
export type ModelPricing = {
  /** Base input token price ($/M). */
  input: number
  /** Output token price ($/M). */
  output: number
  /** Cache-read price ($/M) — typically 10 % of input. */
  cacheRead: number
  /** Cache-write price ($/M) — typically 125 % of input (1h TTL). */
  cacheCreate: number
}

/** Full cost breakdown for a single API turn. */
export type CostBreakdown = {
  /** Cost of non-cached input tokens (USD). */
  inputCost: number
  /** Cost of output tokens (USD). */
  outputCost: number
  /** Cost of cache-write tokens (USD). */
  cacheCreationCost: number
  /** Cost of cache-read tokens (USD). */
  cacheReadCost: number
  /** Sum of all costs (USD). */
  total: number
  /**
   * Fraction of total input-side tokens served from cache.
   * `cache_read / (input + cache_creation + cache_read)`.
   * Returns 0 when no input-side tokens were consumed.
   */
  cacheHitRate: number
  /** Always `'USD'` — callers convert to display currency. */
  currency: 'USD'
}

// ---------------------------------------------------------------------------
// Pricing table  (USD per million tokens)
// ---------------------------------------------------------------------------

/**
 * Publicly documented Anthropic model pricing as of 2026-05.
 *
 * Sources:
 *  - Opus 4.8  : https://www.anthropic.com/pricing  ($15/$75, cache read 10%, cache write 125%)
 *  - Sonnet 4.6: $3/$15, cache read $0.30/M, cache write $3.75/M
 *  - Haiku 4.5 : $1/$5,  cache read $0.10/M, cache write $1.25/M  (approximate — update when confirmed)
 *  - DeepSeek-flash/pro: approximate community-sourced rates; verify before production use.
 *
 * NOTE: These prices are **per million tokens**.  `estimateCost` divides token
 * counts by 1 000 000 before multiplying.
 */
export const PRICING_TABLE: Record<ModelTier, ModelPricing> = {
  // Claude Haiku 4.5 — fast / cheap tier
  haiku: {
    input: 1.0,
    output: 5.0,
    cacheRead: 0.1,
    cacheCreate: 1.25,
  },

  // Claude Sonnet 4.6 — balanced tier
  sonnet: {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheCreate: 3.75,
  },

  // Claude Opus 4.8 — most capable tier
  opus: {
    input: 15.0,
    output: 75.0,
    cacheRead: 1.5,
    cacheCreate: 18.75,
  },

  // DeepSeek flash — approximate; update when official pricing is available
  'deepseek-flash': {
    input: 0.27,
    output: 1.1,
    cacheRead: 0.027,
    cacheCreate: 0.34,
  },

  // DeepSeek pro — approximate; update when official pricing is available
  'deepseek-pro': {
    input: 0.55,
    output: 2.19,
    cacheRead: 0.055,
    cacheCreate: 0.69,
  },
}

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

const PER_MILLION = 1_000_000

/**
 * Converts a `UsageRecord` to a `CostBreakdown` for the given `modelTier`.
 *
 * All arithmetic is done in full floating-point USD to avoid premature
 * rounding.  Callers should round for display purposes only.
 *
 * @param usage     Token counts from the API response `usage` field.
 * @param modelTier The tier to look up in `PRICING_TABLE`.
 * @returns         A complete `CostBreakdown` in USD.
 */
export function estimateCost(
  usage: UsageRecord,
  modelTier: ModelTier,
): CostBreakdown {
  const pricing = PRICING_TABLE[modelTier]

  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0

  const inputCost = (usage.input_tokens / PER_MILLION) * pricing.input
  const outputCost = (usage.output_tokens / PER_MILLION) * pricing.output
  const cacheCreationCost =
    (cacheCreationTokens / PER_MILLION) * pricing.cacheCreate
  const cacheReadCost = (cacheReadTokens / PER_MILLION) * pricing.cacheRead

  const total = inputCost + outputCost + cacheCreationCost + cacheReadCost

  // Cache hit rate: fraction of all input-side tokens that came from cache
  const totalInputSide =
    usage.input_tokens + cacheCreationTokens + cacheReadTokens
  const cacheHitRate =
    totalInputSide > 0 ? cacheReadTokens / totalInputSide : 0

  return {
    inputCost,
    outputCost,
    cacheCreationCost,
    cacheReadCost,
    total,
    cacheHitRate,
    currency: 'USD',
  }
}
