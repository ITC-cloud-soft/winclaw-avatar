/**
 * Dependency analysis for environments.yaml extends: chains.
 *
 * Provides:
 *  - analyseDependencies   — direct + recursive dependents of an env
 *  - detectCircularExtends — cycle detection across the whole file
 *  - getCascadeImpact      — which children are affected by a parent field change
 *
 * §15.5 of INFRA_ENVIRONMENT_DESIGN.v2.2.md
 */

import type { EnvironmentsFile } from '../types.js'
import type { DependencyImpact, ValidationIssue } from './types.js'

// ---------------------------------------------------------------------------
// Internal: build parent→children map
// ---------------------------------------------------------------------------

/** Returns a Map<parentName, childNames[]>. */
function buildChildrenMap(file: EnvironmentsFile): Map<string, string[]> {
  const map = new Map<string, string[]>()

  // Seed all env names with empty arrays
  for (const env of file.environments) {
    if (!map.has(env.name)) map.set(env.name, [])
  }

  for (const env of file.environments) {
    if (env.extends) {
      const children = map.get(env.extends)
      if (children) {
        children.push(env.name)
      } else {
        map.set(env.extends, [env.name])
      }
    }
  }

  return map
}

// ---------------------------------------------------------------------------
// Public: analyseDependencies
// ---------------------------------------------------------------------------

/**
 * Analyse extends: relations.
 * - dependents           = direct children of envName
 * - recursiveDependents  = full descendant tree (BFS to avoid stack overflow)
 */
export function analyseDependencies(
  envName: string,
  file: EnvironmentsFile,
): DependencyImpact {
  const childrenMap = buildChildrenMap(file)

  // Direct dependents
  const dependents: string[] = childrenMap.get(envName) ?? []

  // BFS for full descendant tree
  const recursiveDependents: string[] = []
  const queue: string[] = [...dependents]
  const visited = new Set<string>([envName])

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    recursiveDependents.push(current)

    const children = childrenMap.get(current) ?? []
    for (const child of children) {
      if (!visited.has(child)) {
        queue.push(child)
      }
    }
  }

  return { envName, dependents, recursiveDependents }
}

// ---------------------------------------------------------------------------
// Public: detectCircularExtends
// ---------------------------------------------------------------------------

/**
 * Detect circular extends chains across the entire file using DFS.
 * Returns one ValidationIssue per cycle, reported once.
 */
export function detectCircularExtends(file: EnvironmentsFile): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const envMap = new Map(file.environments.map(e => [e.name, e]))

  // DFS state
  const globalVisited = new Set<string>()  // fully processed nodes
  const reportedCycles = new Set<string>() // cycle signatures already reported

  function dfs(envName: string, stack: string[]): void {
    const cycleIdx = stack.indexOf(envName)
    if (cycleIdx !== -1) {
      // Found a cycle — extract the cycle segment and normalise to a canonical form
      const cycle = stack.slice(cycleIdx)
      const canonical = [...cycle].sort().join(',')
      if (!reportedCycles.has(canonical)) {
        reportedCycles.add(canonical)
        const chainStr = [...cycle, envName].join(' → ')
        issues.push({
          kind: 'circular-extends',
          path: `environments[${envName}].extends`,
          message: `Circular extends chain detected: ${chainStr}`,
          severity: 'error',
        })
      }
      return
    }

    if (globalVisited.has(envName)) return

    const env = envMap.get(envName)
    if (!env?.extends) {
      globalVisited.add(envName)
      return
    }

    stack.push(envName)
    dfs(env.extends, stack)
    stack.pop()
    globalVisited.add(envName)
  }

  for (const env of file.environments) {
    if (!globalVisited.has(env.name)) {
      dfs(env.name, [])
    }
  }

  return issues
}

// ---------------------------------------------------------------------------
// Public: getCascadeImpact
// ---------------------------------------------------------------------------

/**
 * For an /env edit operation: given changed dot-notation paths in a parent env,
 * returns the names of child envs whose effective configuration will change.
 *
 * An env is affected when it:
 *  - is a (recursive) descendant of the edited env, AND
 *  - does NOT override every one of the changedPaths itself
 */
export function getCascadeImpact(
  envName: string,
  changedPaths: string[],
  file: EnvironmentsFile,
): string[] {
  const impact = analyseDependencies(envName, file)
  if (impact.recursiveDependents.length === 0) return []

  const envMap = new Map(file.environments.map(e => [e.name, e]))
  const affected: string[] = []

  for (const descendantName of impact.recursiveDependents) {
    const descendant = envMap.get(descendantName)
    if (!descendant) continue

    // Check if the descendant overrides all changed paths locally.
    // A path like "cloud.region" is overridden if the descendant's own
    // (pre-merge) object has that nested value set.
    const overridesAll = changedPaths.every(dotPath => {
      return _hasOwnPath(descendant as Record<string, unknown>, dotPath)
    })

    if (!overridesAll) {
      affected.push(descendantName)
    }
  }

  return affected
}

/** Check whether an object has a non-undefined value at a dot-notation path. */
function _hasOwnPath(obj: Record<string, unknown>, dotPath: string): boolean {
  const segments = dotPath.split('.')
  let current: unknown = obj
  for (const seg of segments) {
    if (current === null || typeof current !== 'object') return false
    current = (current as Record<string, unknown>)[seg]
    if (current === undefined) return false
  }
  return true
}
