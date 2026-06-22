/**
 * tokenizer.ts — Lightweight token estimator for context budget tracking.
 *
 * Uses the 4-chars-per-token heuristic (GPT/Claude average) so no external
 * dependency is needed. Intentionally deterministic — same input always
 * produces same estimate.
 *
 * Reference: HARNESS_ENGINEERING_INTEGRATION.md §10.2
 */

/**
 * Estimate the number of tokens in a string.
 *
 * Uses the 4-characters-per-token heuristic. Rounds up so budgets are never
 * under-estimated — it is safer to over-count than to silently exceed a budget.
 *
 * @param text - Arbitrary UTF-16 string (markdown, YAML, code, etc.)
 * @returns Estimated token count (always >= 0)
 */
export function approxTokens(text: string): number {
  if (text.length === 0) return 0
  return Math.ceil(text.length / 4)
}
