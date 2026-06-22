/**
 * Layer 3 of the auto-incremental update system: Git event detection.
 *
 * Examines the Git history and working-tree diff relative to the time the
 * current graph.json was last built.  Callers use the result to decide
 * whether to trigger a targeted incremental update (small change set) or a
 * full rebuild (large change / merge / rebase).
 *
 * Called at session startup (via bootstrap) and on demand from `/graph status`.
 * All errors are swallowed and represented as an empty-change sentinel so the
 * rest of the boot path is never disrupted by Git being unavailable.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { statSync } from 'node:fs'
import { resolveGraphPath } from './client.js'
import { logForDebugging } from '../../utils/debug.js'

const exec = promisify(execFile)

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Summary of Git-level changes that have occurred since the graph was built.
 */
export interface GitChangeResult {
  /** Source files that have been added, copied, modified, or renamed. */
  changed: string[]
  /**
   * True when the change set is too large for targeted incremental updates
   * (e.g. a merge or rebase commit, or more than 50 changed files).
   * The caller should trigger a full graph rebuild in this case.
   */
  isLargeChange: boolean
  /** Number of commits recorded since graph.json was last written. */
  commitsSinceGraph: number
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect Git changes that have occurred since graph.json was last built.
 *
 * Strategy:
 *  1. Read the `mtime` of graph.json as the "graph was last built at" marker.
 *  2. Run `git log --oneline --after <mtime>` to count commits and identify
 *     merge / rebase operations that warrant a full rebuild.
 *  3. Run `git diff --name-only --diff-filter=ACMR HEAD` to enumerate the
 *     files actually changed in the working tree.
 *
 * @returns A {@link GitChangeResult} describing what changed, or an empty
 *          sentinel value if graph.json is absent or Git is unavailable.
 */
export async function detectGitChanges(): Promise<GitChangeResult> {
  const graphPath = resolveGraphPath()

  let graphMtime: Date
  try {
    graphMtime = statSync(graphPath).mtime
  } catch {
    // graph.json does not exist yet — nothing to compare against.
    return { changed: [], isLargeChange: false, commitsSinceGraph: 0 }
  }

  try {
    const since = graphMtime.toISOString()

    // Count commits (and detect merges/rebases) since the graph was built.
    const { stdout: logOut } = await exec(
      'git',
      ['log', '--oneline', '--after', since],
      { timeout: 5000, windowsHide: true },
    )
    const commits = logOut.trim().split('\n').filter(Boolean)
    const isMerge = commits.some(c => /merge|rebase/i.test(c))

    // Enumerate changed source files in the current working tree.
    const { stdout: diffOut } = await exec(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'],
      { timeout: 5000, windowsHide: true },
    )
    const changed = diffOut
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter(f => /\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|hpp)$/.test(f))

    return {
      changed,
      isLargeChange: isMerge || changed.length > 50,
      commitsSinceGraph: commits.length,
    }
  } catch (err) {
    logForDebugging(`[graphify:git] Detection failed: ${err}`)
    return { changed: [], isLargeChange: false, commitsSinceGraph: 0 }
  }
}
