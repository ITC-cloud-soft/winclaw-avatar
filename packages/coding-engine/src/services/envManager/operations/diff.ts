/**
 * diff.ts — /env diff A B
 *
 * Computes and renders a structural diff between two environments after
 * resolving their extends chains.
 *
 * Phase 2 §15.5.5 row 4.
 */

import type { Env, EnvironmentsFile } from '../types.js'
import { resolveExtendsChain } from '../loader.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EnvDiff = {
  envA: string
  envB: string
  differences: DiffEntry[]
  identical: boolean
}

export type DiffEntry = {
  /** Dot-notation YAML path, e.g. "cloud.region" */
  path: string
  /** Value in env A (undefined if the key is absent in A) */
  inA: unknown
  /** Value in env B (undefined if the key is absent in B) */
  inB: unknown
  severity: 'info' | 'notable'
}

// ---------------------------------------------------------------------------
// Notable path prefixes
// ---------------------------------------------------------------------------

const NOTABLE_PATHS = new Set([
  'safety.destructive_ops',
  'safety.writes_two_phase_commit',
  'deploy.skill',
  'deploy.tested',
  'cloud.provider',
  'cloud.region',
])

function isNotable(path: string): boolean {
  return NOTABLE_PATHS.has(path)
}

// ---------------------------------------------------------------------------
// Flatten an object to a dot-path → value map
// ---------------------------------------------------------------------------

function flatten(
  obj: unknown,
  prefix: string,
  out: Map<string, unknown>,
): void {
  if (obj === null || obj === undefined) {
    out.set(prefix, obj)
    return
  }

  if (Array.isArray(obj)) {
    // Arrays: store as JSON for comparison; do not recurse into indices
    out.set(prefix, JSON.stringify(obj))
    return
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>
    let hasKeys = false
    for (const [key, val] of Object.entries(record)) {
      hasKeys = true
      const childPath = prefix ? `${prefix}.${key}` : key
      flatten(val, childPath, out)
    }
    // Empty object — still record it so it shows up in the diff
    if (!hasKeys) {
      out.set(prefix, '{}')
    }
    return
  }

  out.set(prefix, obj)
}

function flattenEnv(env: Env): Map<string, unknown> {
  const map = new Map<string, unknown>()
  // Exclude meta-fields that are structural (name, extends) — they are
  // always expected to differ between two envs.
  const { name: _name, extends: _ext, ...rest } = env as Env & { extends?: string }
  flatten(rest, '', map)
  return map
}

// ---------------------------------------------------------------------------
// diffEnvs
// ---------------------------------------------------------------------------

/**
 * Compute the structural diff between two environments.
 * Both envs are resolved through their extends chains before comparison.
 */
export function diffEnvs(
  envA: Env,
  envB: Env,
  fileForExtends: EnvironmentsFile,
): EnvDiff {
  const resolvedA = resolveExtendsChain(envA, fileForExtends.environments)
  const resolvedB = resolveExtendsChain(envB, fileForExtends.environments)

  const mapA = flattenEnv(resolvedA)
  const mapB = flattenEnv(resolvedB)

  // Collect the union of all keys
  const allPaths = new Set([...mapA.keys(), ...mapB.keys()])

  const differences: DiffEntry[] = []

  for (const path of [...allPaths].sort()) {
    const inA = mapA.get(path)
    const inB = mapB.get(path)

    // Both absent — should not happen given the union logic, but guard anyway
    if (!mapA.has(path) && !mapB.has(path)) continue

    const aVal = mapA.has(path) ? inA : undefined
    const bVal = mapB.has(path) ? inB : undefined

    // Stringify for comparison to handle edge cases like object equality
    const aStr = JSON.stringify(aVal)
    const bStr = JSON.stringify(bVal)

    if (aStr !== bStr) {
      differences.push({
        path,
        inA: aVal,
        inB: bVal,
        severity: isNotable(path) ? 'notable' : 'info',
      })
    }
  }

  return {
    envA: envA.name,
    envB: envB.name,
    differences,
    identical: differences.length === 0,
  }
}

// ---------------------------------------------------------------------------
// renderDiff
// ---------------------------------------------------------------------------

/** Format a value for display in the diff table. */
function fmtValue(val: unknown): string {
  if (val === undefined) return '*(absent)*'
  if (val === null) return 'null'
  if (typeof val === 'string') return val
  return String(val)
}

/**
 * Render an EnvDiff as a Markdown table suitable for display in the /env skill.
 *
 * Example output:
 * ```markdown
 * ## /env diff dev vs staging
 *
 * | Path | dev | staging |
 * |------|-----|---------|
 * | `cloud.region` | japaneast | westeurope |
 * | ⚠ `safety.destructive_ops` | allow | confirm |
 *
 * **Identical sections**: 12 fields, **differences**: 2 (1 notable)
 * ```
 */
export function renderDiff(diff: EnvDiff): string {
  const { envA, envB, differences, identical } = diff

  if (identical) {
    return `## /env diff ${envA} vs ${envB}\n\nNo differences found — environments are identical (after extends resolution).\n`
  }

  const lines: string[] = []
  lines.push(`## /env diff ${envA} vs ${envB}`)
  lines.push('')
  lines.push(`| Path | ${envA} | ${envB} |`)
  lines.push(`|------|${'-'.repeat(envA.length + 2)}|${'-'.repeat(envB.length + 2)}|`)

  for (const entry of differences) {
    const prefix = entry.severity === 'notable' ? '⚠ ' : ''
    const pathCell = `${prefix}\`${entry.path}\``
    lines.push(`| ${pathCell} | ${fmtValue(entry.inA)} | ${fmtValue(entry.inB)} |`)
  }

  const notableCount = differences.filter(d => d.severity === 'notable').length
  const notableNote = notableCount > 0 ? ` (${notableCount} notable)` : ''

  lines.push('')
  lines.push(`**Differences**: ${differences.length}${notableNote}`)
  lines.push('')

  return lines.join('\n')
}
