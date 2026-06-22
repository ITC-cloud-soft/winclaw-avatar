/**
 * CostIndicator.tsx — Proposal F (cost transparency UI)
 *
 * Renders a single-line Ink widget showing per-turn cost, cache hit rate,
 * and session progress against an optional daily budget.
 *
 * Renders nothing (`null`) when the `costTransparency` feature flag is off.
 *
 * Display format (~80 chars):
 *   Turn: ¥6.2 (cache 92%) | Session: ¥84.3 / ¥500 (17%)
 *
 * Color thresholds (turn cost in USD before conversion):
 *   green  < $0.05
 *   yellow  $0.05 – $0.20
 *   red    >= $0.20
 */

import React from 'react'
import { Box, Text } from '../../ink.js'
import { getCacheDisciplineConfig } from './config.js'
import { estimateCost } from './costEstimator.js'
import type { UsageRecord, ModelTier } from './costEstimator.js'

// Re-export types so callers can import them from a single file
export type { UsageRecord, ModelTier }

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type CostIndicatorProps = {
  /** Token counts for the current turn (from the API response `usage` field). */
  turnUsage: UsageRecord
  /** The capability tier of the model that produced the response. */
  modelTier: ModelTier
  /** Running USD total for the whole session so far (including this turn). */
  sessionTotalUSD: number
  /** Optional daily spend cap in USD; omit to hide budget progress. */
  dailyBudgetUSD?: number
  /**
   * Display currency.
   * @default 'USD'
   */
  currency?: 'USD' | 'JPY' | 'CNY'
  /**
   * Exchange rate: units of `currency` per 1 USD.
   * Required when `currency` is not `'USD'`; ignored otherwise.
   * @example 150  (150 JPY per USD)
   */
  exchangeRate?: number
}

// ---------------------------------------------------------------------------
// Currency helpers
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOL: Record<'USD' | 'JPY' | 'CNY', string> = {
  USD: '$',
  JPY: '¥',
  CNY: '¥',
}

function convertUSD(
  amountUSD: number,
  currency: 'USD' | 'JPY' | 'CNY',
  exchangeRate: number | undefined,
): number {
  if (currency === 'USD') return amountUSD
  const rate = exchangeRate ?? 1
  return amountUSD * rate
}

function formatAmount(
  amountUSD: number,
  currency: 'USD' | 'JPY' | 'CNY',
  exchangeRate: number | undefined,
): string {
  const converted = convertUSD(amountUSD, currency, exchangeRate)
  const sym = CURRENCY_SYMBOL[currency]
  // JPY / CNY: show one decimal; USD: show four decimals (amounts are tiny)
  const decimals = currency === 'USD' ? 4 : 1
  return `${sym}${converted.toFixed(decimals)}`
}

// ---------------------------------------------------------------------------
// Turn-cost color thresholds (USD)
// ---------------------------------------------------------------------------

function turnCostColor(turnCostUSD: number): 'green' | 'yellow' | 'red' {
  if (turnCostUSD < 0.05) return 'green'
  if (turnCostUSD < 0.20) return 'yellow'
  return 'red'
}

// ---------------------------------------------------------------------------
// ASCII progress bar
// ---------------------------------------------------------------------------

function asciiBar(ratio: number, width = 10): string {
  const clamped = Math.max(0, Math.min(1, ratio))
  const filled = Math.round(clamped * width)
  const empty = width - filled
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a one-line cost transparency widget.
 * Returns `null` when the `costTransparency` feature flag is disabled.
 */
export function CostIndicator({
  turnUsage,
  modelTier,
  sessionTotalUSD,
  dailyBudgetUSD,
  currency = 'USD',
  exchangeRate,
}: CostIndicatorProps): React.ReactElement | null {
  const config = getCacheDisciplineConfig()
  if (!config.enabled || !config.features.costTransparency) {
    return null
  }

  const breakdown = estimateCost(turnUsage, modelTier)
  const hitPct = Math.round(breakdown.cacheHitRate * 100)
  const color = turnCostColor(breakdown.total)

  const turnLabel = formatAmount(breakdown.total, currency, exchangeRate)
  const sessionLabel = formatAmount(sessionTotalUSD, currency, exchangeRate)

  const hasBudget =
    dailyBudgetUSD !== undefined && dailyBudgetUSD > 0

  const budgetLabel = hasBudget
    ? formatAmount(dailyBudgetUSD!, currency, exchangeRate)
    : undefined

  const sessionPct = hasBudget
    ? Math.round((sessionTotalUSD / dailyBudgetUSD!) * 100)
    : undefined

  const bar = hasBudget
    ? asciiBar(sessionTotalUSD / dailyBudgetUSD!)
    : undefined

  return (
    <Box>
      <Text color={color}>
        {'Turn: '}
        {turnLabel}
        {' (cache '}
        {hitPct}
        {'%)'}
      </Text>
      {hasBudget ? (
        <>
          <Text dimColor>{' | '}</Text>
          <Text>
            {'Session: '}
            {sessionLabel}
            {' / '}
            {budgetLabel}
            {' ('}
            {sessionPct}
            {'%) '}
            {bar}
          </Text>
        </>
      ) : (
        <>
          <Text dimColor>{' | '}</Text>
          <Text>
            {'Session: '}
            {sessionLabel}
          </Text>
        </>
      )}
    </Box>
  )
}
