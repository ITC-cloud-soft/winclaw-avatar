/**
 * Shared threshold parsers for gate runners.
 *
 * Provides type-safe parsing of threshold expressions like ">=95%", "<=200ms",
 * ">=500" and a generic compare() function.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompareOp = '>=' | '>' | '<=' | '<' | '=' | '=='

export type PercentThreshold = {
  op: CompareOp
  value: number // 0–100
}

export type DurationThreshold = {
  op: CompareOp
  valueMs: number
}

export type CountThreshold = {
  op: CompareOp
  value: number
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

const OP_RE = /^(>=|>|<=|<|==|=)/

function parseOp(expr: string): { op: CompareOp; rest: string } | null {
  const m = expr.trim().match(OP_RE)
  if (!m) return null
  return { op: m[1] as CompareOp, rest: expr.trim().slice(m[1]!.length).trim() }
}

/**
 * Parse ">=95%" → { op: '>=', value: 95 }
 * Accepts optional spaces: ">= 95 %"
 */
export function parsePercentThreshold(expr: string): PercentThreshold | null {
  const parsed = parseOp(expr)
  if (!parsed) return null
  const num = parsed.rest.replace(/%$/, '').trim()
  const value = parseFloat(num)
  if (isNaN(value)) return null
  return { op: parsed.op, value }
}

/**
 * Parse "<=200ms" → { op: '<=', valueMs: 200 }
 * Accepts "200ms", "1s" (converted to ms), "1000" (bare = ms).
 */
export function parseDurationThreshold(expr: string): DurationThreshold | null {
  const parsed = parseOp(expr)
  if (!parsed) return null
  const rest = parsed.rest.trim()

  const msMatch = rest.match(/^(\d+(?:\.\d+)?)\s*ms$/)
  if (msMatch) return { op: parsed.op, valueMs: parseFloat(msMatch[1]!) }

  const sMatch = rest.match(/^(\d+(?:\.\d+)?)\s*s$/)
  if (sMatch) return { op: parsed.op, valueMs: parseFloat(sMatch[1]!) * 1000 }

  const bare = rest.match(/^(\d+(?:\.\d+)?)$/)
  if (bare) return { op: parsed.op, valueMs: parseFloat(bare[1]!) }

  return null
}

/**
 * Parse ">=500" → { op: '>=', value: 500 }
 * Also accepts "<1%" as a count (strips %).
 */
export function parseCountThreshold(expr: string): CountThreshold | null {
  const parsed = parseOp(expr)
  if (!parsed) return null
  const num = parsed.rest.replace(/%$/, '').trim()
  const value = parseFloat(num)
  if (isNaN(value)) return null
  return { op: parsed.op, value }
}

// ---------------------------------------------------------------------------
// Comparator
// ---------------------------------------------------------------------------

/**
 * Compare actual value against a threshold.
 * Works for both PercentThreshold, CountThreshold, or any { op, value } shape.
 */
export function compare(actual: number, threshold: { op: CompareOp; value: number }): boolean {
  switch (threshold.op) {
    case '>=': return actual >= threshold.value
    case '>':  return actual >  threshold.value
    case '<=': return actual <= threshold.value
    case '<':  return actual <  threshold.value
    case '=':
    case '==': return actual === threshold.value
    default:   return false
  }
}

/**
 * Compare actual duration (ms) against a DurationThreshold.
 */
export function compareDuration(actualMs: number, threshold: DurationThreshold): boolean {
  return compare(actualMs, { op: threshold.op, value: threshold.valueMs })
}
