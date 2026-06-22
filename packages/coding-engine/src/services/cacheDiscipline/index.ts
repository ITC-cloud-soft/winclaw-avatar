/**
 * src/services/cacheDiscipline/index.ts
 *
 * Public API surface for the CacheDiscipline module (proposals A–F + config).
 *
 * Agent D integration contract:
 *   1. Import `getCacheDisciplineConfig` to check feature flags at call sites.
 *   2. Call `computeBoundaries(messages, { harnessActive })` to get boundary positions.
 *   3. Call `applyAnthropicCacheControl(apiMessages, boundaries)` to annotate the
 *      message array with cache_control markers.  Returns input unchanged when the
 *      feature flag is off — safe to call unconditionally.
 *   4. Use `withInvariantCheck` / `assertPrefixUnchanged` in development code
 *      paths that should be append-only (compact, skill inject, phase advance).
 *   5. Use `detectStorm` / `injectReflectionMessage` at tool dispatch call-sites.
 *   6. Use `markForShrink` after tool results and `applyDeferredShrinks` before sends.
 *   7. Use `detectEscalationMarker` when parsing assistant responses.
 *   8. Render `<CostIndicator>` in the TUI status bar when costTransparency is on.
 */

// Config (feature flags)
export {
  type CacheDisciplineConfig,
  _setCacheDisciplineConfigForTest,
  getCacheDisciplineConfig,
} from './config.js'

// Proposal A — 4-boundary strategy
export {
  type BoundaryMarkers,
  applyAnthropicCacheControl,
  computeBoundaries,
} from './boundaries.js'

// Proposal B — append-only invariant assert
export {
  CachePrefixMutationError,
  type PrefixHash,
  assertPrefixUnchanged,
  snapshotPrefixHash,
  withInvariantCheck,
} from './invariant.js'

// Proposal C — deferred tool-result shrink
export {
  applyDeferredShrinks,
  clearShrinkQueue,
  defaultSummarize,
  getShrinkQueueSnapshot,
  markForShrink,
  resetSummarizer,
  setSummarizer,
  type ShrinkCandidate,
  type ShrinkableMessage,
} from './deferredShrink.js'

// Proposal D — storm suppression
export {
  deepEqual,
  detectStorm,
  injectReflectionMessage,
  type ReflectionMessage,
  type StormDetection,
  type ToolCallRecord,
} from './stormSuppression.js'

// Proposal E — self-escalation
export {
  detectEscalationMarker,
  modelIdToTier,
  nextTier,
  type EscalationDetection,
  type EscalationMarker,
  type ModelTier,
} from './selfEscalation.js'

// Proposal F — cost transparency (estimator + UI)
export {
  estimateCost,
  PRICING_TABLE,
  type CostBreakdown,
  type ModelPricing,
  type UsageRecord,
} from './costEstimator.js'

export {
  CostIndicator,
  type CostIndicatorProps,
} from './CostIndicator.js'

// Final-pass sanitizer (v3.0.1) — guarantees outgoing request never
// violates Anthropic's cache_control invariants.
export {
  sanitizeAnthropicCacheControl,
  type SanitizerReport,
} from './sanitize.js'
