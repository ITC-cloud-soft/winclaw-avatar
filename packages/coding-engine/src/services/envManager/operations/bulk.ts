/**
 * bulk.ts — Bulk operation support for /env
 *
 * Supports fan-out operations like "全 staging の SSL を require にして" that
 * apply a single set/edit operation to all environments matching a tag filter.
 *
 * Phase 2 §15.5.5 row 5.
 */

import type { IntentParseResult, OperationInput, SetInput } from './types.js'
import type { EnvironmentsFile } from '../types.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BulkInput = {
  kind: 'bulk'
  tagFilter: string                                // e.g. "staging"
  operation: 'set' | 'edit'                        // verb to apply to each matching env
  setPath?: string                                 // for operation === 'set'
  setValue?: unknown                               // for operation === 'set'
  editPatch?: object                               // for operation === 'edit'
}

// ---------------------------------------------------------------------------
// Value coercion (mirrors intentParser.coerceValue)
// ---------------------------------------------------------------------------

function coerceValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1)
    if (inner.trim() === '') return []
    return inner.split(',').map(s => s.trim()).filter(s => s.length > 0)
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return trimmed
}

// ---------------------------------------------------------------------------
// parseBulkIntent — regex-only
// ---------------------------------------------------------------------------

/**
 * Attempt to detect a bulk-style intent from raw input text.
 *
 * Detected patterns (in order):
 *
 * English:
 *   1. `set tag=<TAG> <path> <value>`
 *   2. `for all <TAG> envs, set <path> = <value>`
 *   3. `for all <TAG> envs, set <path> <value>`
 *
 * Japanese:
 *   4. `全(ての)?<TAG>の <path> を <value> に`
 *   5. `<TAG> タグの全環境で <path>=<value>`
 *   6. `全(ての)?<TAG> 環境の <path> を <value> に`
 *
 * Returns a parsed IntentParseResult on match, null on no match.
 */
export function parseBulkIntent(input: string): IntentParseResult | null {
  const s = input.trim()

  // ── English pattern 1 ──────────────────────────────────────────────────
  // set tag=TAG PATH VALUE
  {
    const m = s.match(/^set\s+tag=([\w-]+)\s+([\w.]+)\s+(\S+)/i)
    if (m) {
      const bulk: BulkInput = {
        kind: 'bulk',
        tagFilter: m[1]!,
        operation: 'set',
        setPath: m[2]!,
        setValue: coerceValue(m[3]!),
      }
      return { ok: true, input: bulk as unknown as OperationInput }
    }
  }

  // ── English pattern 2 ──────────────────────────────────────────────────
  // for all TAG envs, set PATH = VALUE
  {
    const m = s.match(/^for\s+all\s+([\w-]+)\s+envs?,\s*set\s+([\w.]+)\s*=\s*(\S+)/i)
    if (m) {
      const bulk: BulkInput = {
        kind: 'bulk',
        tagFilter: m[1]!,
        operation: 'set',
        setPath: m[2]!,
        setValue: coerceValue(m[3]!),
      }
      return { ok: true, input: bulk as unknown as OperationInput }
    }
  }

  // ── English pattern 3 ──────────────────────────────────────────────────
  // for all TAG envs, set PATH VALUE
  {
    const m = s.match(/^for\s+all\s+([\w-]+)\s+envs?,\s*set\s+([\w.]+)\s+(\S+)/i)
    if (m) {
      const bulk: BulkInput = {
        kind: 'bulk',
        tagFilter: m[1]!,
        operation: 'set',
        setPath: m[2]!,
        setValue: coerceValue(m[3]!),
      }
      return { ok: true, input: bulk as unknown as OperationInput }
    }
  }

  // ── Japanese pattern 4 ──────────────────────────────────────────────────
  // 全(ての)?TAG の PATH を VALUE に
  {
    const m = s.match(/^全(?:ての?)?([\w-]+)の\s*([\w.]+)\s*を\s*(\S+)\s*に/)
    if (m) {
      const bulk: BulkInput = {
        kind: 'bulk',
        tagFilter: m[1]!,
        operation: 'set',
        setPath: m[2]!,
        setValue: coerceValue(m[3]!),
      }
      return { ok: true, input: bulk as unknown as OperationInput }
    }
  }

  // ── Japanese pattern 5 ──────────────────────────────────────────────────
  // TAG タグの全環境で PATH=VALUE
  {
    const m = s.match(/([\w-]+)\s*タグの全環境で\s*([\w.]+)=([\S]+)/)
    if (m) {
      const bulk: BulkInput = {
        kind: 'bulk',
        tagFilter: m[1]!,
        operation: 'set',
        setPath: m[2]!,
        setValue: coerceValue(m[3]!),
      }
      return { ok: true, input: bulk as unknown as OperationInput }
    }
  }

  // ── Japanese pattern 6 ──────────────────────────────────────────────────
  // 全(ての)?TAG 環境の PATH を VALUE に
  {
    const m = s.match(/^全(?:ての?)?([\w-]+)\s*環境の\s*([\w.]+)\s*を\s*(\S+)\s*に/)
    if (m) {
      const bulk: BulkInput = {
        kind: 'bulk',
        tagFilter: m[1]!,
        operation: 'set',
        setPath: m[2]!,
        setValue: coerceValue(m[3]!),
      }
      return { ok: true, input: bulk as unknown as OperationInput }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// expandBulk
// ---------------------------------------------------------------------------

/**
 * Expand a BulkInput into individual OperationInputs — one per matching env.
 *
 * Matching logic: an env matches if its `tags` array includes `bulk.tagFilter`.
 * If `tags` is absent or empty, the env does NOT match.
 *
 * For `operation === 'set'`, each result is a `SetInput`.
 * For `operation === 'edit'`, each result is an `EditInput`.
 */
export function expandBulk(bulk: BulkInput, file: EnvironmentsFile): OperationInput[] {
  const matching = file.environments.filter(env => {
    if (!Array.isArray(env.tags)) return false
    return env.tags.includes(bulk.tagFilter)
  })

  if (bulk.operation === 'set') {
    if (bulk.setPath === undefined || bulk.setValue === undefined) {
      return []
    }
    return matching.map(env => ({
      kind: 'set',
      name: env.name,
      path: bulk.setPath!,
      value: bulk.setValue,
    } satisfies SetInput))
  }

  if (bulk.operation === 'edit') {
    if (!bulk.editPatch) return []
    return matching.map(env => ({
      kind: 'edit',
      name: env.name,
      patch: bulk.editPatch as Record<string, unknown>,
    })) as OperationInput[]
  }

  return []
}
