/**
 * CacheDiscipline configuration — feature flag hub.
 *
 * Agents A/B/C all import `getCacheDisciplineConfig()` from this module.
 * Set `METACODER_CACHE_DISCIPLINE=off` to restore v2.0.6 behaviour with
 * zero runtime overhead.
 *
 * Feature flag defaults:
 *  - `fourBoundaryStrategy` (A): on by default, override with `METACODER_CD_FOUR_BOUNDARY=off`
 *  - `appendOnlyAssert`     (B): on ONLY in dev/test (`NODE_ENV=development` or
 *                                `METACODER_INVARIANT_CHECK=1`), unless
 *                                `METACODER_CD_APPEND_ONLY_ASSERT` is set explicitly
 *  - All others: on by default, disable with `METACODER_CD_<NAME>=off`
 *
 * Master kill-switch: `METACODER_CACHE_DISCIPLINE=off` → all features disabled.
 */

export type CacheDisciplineConfig = {
  /** Master switch — false when METACODER_CACHE_DISCIPLINE=off */
  enabled: boolean
  features: {
    fourBoundaryStrategy: boolean      // proposal A
    appendOnlyAssert: boolean          // proposal B
    deferredToolResultShrink: boolean  // proposal C
    stormSuppression: boolean          // proposal D
    selfEscalation: boolean            // proposal E
    costTransparency: boolean          // proposal F
    /**
     * v3.0.2 — Proposal G (intentional 1h-TTL on system prompt).
     *
     * Pre-v2 Meta Coder achieved ~97.65% cache hit rate by attaching 1h TTL
     * markers to the system prompt via `getCacheControl({ querySource })`.
     * That code path is gated by `should1hCacheTTL()` which requires the
     * `querySource` to match a GrowthBook allowlist — when GrowthBook is
     * unreachable or returns an empty allowlist the 1h marker is silently
     * skipped and the request falls back to 5m TTL, losing ~6 pts of hit
     * rate over a long session.
     *
     * When this flag is on, `buildSystemPromptBlocks` forces `ttl='1h'` on
     * the system block regardless of GrowthBook eligibility. This is safe
     * because the system block is processed BEFORE any message block
     * (Anthropic processing order: tools → system → messages), so 1h-on-
     * system never violates the "1h must precede 5m" invariant.
     *
     * Default ON whenever `fourBoundaryStrategy` is on. Disable via
     * `METACODER_CD_SYSTEM_1H_TTL=off`.
     */
    intentionalSystem1hTtl: boolean    // proposal G (v3.0.2)
  }
}

let _override: CacheDisciplineConfig | null = null

/**
 * Override the config for testing. Pass `null` to restore default behaviour.
 */
export function _setCacheDisciplineConfigForTest(
  cfg: CacheDisciplineConfig | null,
): void {
  _override = cfg
}

/**
 * Returns true when the invariant assert should be active by default.
 *
 * Active when `NODE_ENV=development` OR `METACODER_INVARIANT_CHECK=1`.
 * Can be overridden by `METACODER_CD_APPEND_ONLY_ASSERT=off` (or `=on`).
 */
function isInvariantDefaultActive(): boolean {
  const nodeEnv = (process.env['NODE_ENV'] ?? '').toLowerCase()
  const explicitCheck = (process.env['METACODER_INVARIANT_CHECK'] ?? '') === '1'
  return nodeEnv === 'development' || explicitCheck
}

/**
 * Returns the effective CacheDiscipline config.
 *
 * All sub-features default to `true` unless the master switch is off or an
 * individual feature flag env var is set to `"off"`.
 *
 * Exception: `appendOnlyAssert` defaults to `false` in production unless
 * `NODE_ENV=development` or `METACODER_INVARIANT_CHECK=1` is set — this keeps
 * the assertion zero-overhead in production.
 */
export function getCacheDisciplineConfig(): CacheDisciplineConfig {
  if (_override !== null) return _override

  const masterOff =
    (process.env['METACODER_CACHE_DISCIPLINE'] ?? '').toLowerCase() === 'off'

  if (masterOff) {
    return {
      enabled: false,
      features: {
        fourBoundaryStrategy: false,
        appendOnlyAssert: false,
        deferredToolResultShrink: false,
        stormSuppression: false,
        selfEscalation: false,
        costTransparency: false,
        intentionalSystem1hTtl: false,
      },
    }
  }

  /** Returns true unless the env var is explicitly set to "off". */
  const feat = (name: string): boolean =>
    (process.env[`METACODER_CD_${name}`] ?? '').toLowerCase() !== 'off'

  /**
   * `appendOnlyAssert` has a special default: off in production.
   * An explicit env var (`METACODER_CD_APPEND_ONLY_ASSERT=on|off`) takes
   * precedence; otherwise falls back to the dev/check heuristic.
   */
  const appendOnlyAssertEnv =
    (process.env['METACODER_CD_APPEND_ONLY_ASSERT'] ?? '').toLowerCase()
  const appendOnlyAssert =
    appendOnlyAssertEnv === 'off'
      ? false
      : appendOnlyAssertEnv === 'on'
        ? true
        : isInvariantDefaultActive()

  return {
    enabled: true,
    features: {
      fourBoundaryStrategy: feat('FOUR_BOUNDARY'),
      appendOnlyAssert,
      deferredToolResultShrink: feat('DEFERRED_SHRINK'),
      stormSuppression: feat('STORM_SUPPRESSION'),
      selfEscalation: feat('SELF_ESCALATION'),
      costTransparency: feat('COST_TRANSPARENCY'),
      intentionalSystem1hTtl: feat('SYSTEM_1H_TTL'),
    },
  }
}
