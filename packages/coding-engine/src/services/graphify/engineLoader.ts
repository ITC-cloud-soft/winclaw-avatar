/**
 * GraphEngine loader for graphify.
 *
 * Phase C: multi-worktree graph isolation.
 *   - Each workspace (cwd) has its own cached engine instance.
 *   - Legacy singleton API (`getEngine`, `reloadEngine`, `resetEngine`) is
 *     preserved and simply delegates to the cwd-scoped cache keyed on
 *     process.cwd().
 *   - Returns null when the graph is unavailable (no graph.json, load
 *     failure) so all callers must guard against null without throwing.
 *
 * Usage:
 * ```ts
 * const engine = await getEngine() // process.cwd()-scoped
 * if (engine) {
 *   const result = engine.query('authentication')
 * }
 *
 * // cwd-scoped (worktree-aware):
 * const engine = await getEngineForCwd('/path/to/worktree')
 *
 * // systest workspace-scoped (uses its own cache key = workspace path):
 * const engine = await getEngineForWorkspace('/path/to/workspace')
 * ```
 */

import fs from 'node:fs'
import path from 'node:path'
import { GraphEngine } from './engine.js'
import { logForDebugging } from '../../utils/debug.js'

// Re-export GraphEngine so consumers (e.g. autoUpdate.ts) can import the
// class type from this module without reaching into engine.ts directly.
export { GraphEngine } from './engine.js'

// ---------------------------------------------------------------------------
// Path resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the graph.json path locally without importing client.ts.
 * Avoids a circular dependency: client.ts -> engineLoader.ts -> client.ts.
 * Mirrors the logic in resolveGraphPath() from client.ts exactly.
 */
function resolveGraphPathLocal(): string {
  return (
    process.env['GRAPHIFY_GRAPH_PATH'] ??
    path.join(process.cwd(), 'graphify-out', 'graph.json')
  )
}

/**
 * Tracks which workspace paths have already resolved to an env-var-provided
 * graph path, so the multi-workspace warning fires at most once per workspace.
 *
 * Exported for diagnostics and test teardown only — not part of the stable API.
 */
const GRAPHIFY_GRAPH_PATH_WARNED = new Set<string>()

/**
 * Resolve graph.json path for a specific workspace/cwd directory.
 * Independent of process.cwd() — used by cwd-scoped and workspace-scoped caches.
 *
 * Environment variable precedence:
 *   - GRAPHIFY_GRAPH_PATH (if set, used for ALL workspaces — see caveat below)
 *   - Otherwise: `${workspace}/graphify-out/graph.json`
 *
 * ⚠️ GRAPHIFY_GRAPH_PATH × multi-workspace caveat:
 *
 * The engineCache Map is keyed by workspace path, so each worktree/cwd gets
 * its own in-memory engine instance. BUT if GRAPHIFY_GRAPH_PATH is set,
 * ALL keyed entries point to the same on-disk graph.json, meaning concurrent
 * /graphify rebuilds from different workspaces will race on write. The
 * in-memory isolation holds, but the on-disk state becomes ambiguous.
 *
 * Recommended usage:
 *   - Single workspace / CI: GRAPHIFY_GRAPH_PATH is fine.
 *   - Multi-worktree agent sessions: LEAVE UNSET, rely on per-workspace paths.
 *
 * Behavior: this function warns once per workspace after the second distinct
 * workspace resolves to the env-var path. It does NOT auto-unset or alter
 * the returned path — the warning is purely diagnostic.
 */
export function resolveGraphPathForWorkspace(workspace: string): string {
  const envPath = process.env['GRAPHIFY_GRAPH_PATH']
  if (envPath) {
    // Multi-workspace detection: if multiple distinct workspaces are using
    // the same env-var path, it's almost certainly a misconfiguration in a
    // multi-worktree agent session. Warn once per workspace to surface this,
    // but only after the second distinct workspace resolves — a single
    // workspace using GRAPHIFY_GRAPH_PATH is a legitimate (CI / single-repo)
    // configuration and should stay silent.
    const key = normalizeWorkspaceKey(workspace)
    if (!GRAPHIFY_GRAPH_PATH_WARNED.has(key)) {
      GRAPHIFY_GRAPH_PATH_WARNED.add(key)
      if (GRAPHIFY_GRAPH_PATH_WARNED.size > 1) {
        const sample = [...GRAPHIFY_GRAPH_PATH_WARNED].slice(0, 5).join(', ')
        console.warn(
          `[graphify] GRAPHIFY_GRAPH_PATH is set (${envPath}) but multiple ` +
            `workspaces are using it (${sample}). This defeats per-workspace ` +
            `graph isolation: every workspace will read/write the same ` +
            `graph.json and concurrent /graphify rebuilds will race. ` +
            `Unset GRAPHIFY_GRAPH_PATH for multi-worktree setups, or accept ` +
            `that all workspaces share a single graph.json.`,
        )
      }
    }
    return envPath
  }
  return path.join(workspace, 'graphify-out', 'graph.json')
}

/**
 * Reset the GRAPHIFY_GRAPH_PATH warning state.
 *
 * Intended for test teardown only — so tests that flip the env var between
 * scenarios don't leak "already warned" state across cases. Not part of the
 * stable API.
 */
export function __resetGraphifyGraphPathWarningForTests(): void {
  GRAPHIFY_GRAPH_PATH_WARNED.clear()
}

function resolveGraphPathForCwd(cwd: string): string {
  return resolveGraphPathForWorkspace(cwd)
}

/**
 * Normalize a workspace/cwd path for use as a cache key.
 * Must be stable regardless of trailing slashes or case (Windows).
 */
function normalizeWorkspaceKey(cwd: string): string {
  return path.resolve(cwd).replace(/\\/g, '/')
}

// ---------------------------------------------------------------------------
// cwd-scoped engine cache (Phase C)
// ---------------------------------------------------------------------------

const engineCache = new Map<string, Promise<GraphEngine | null>>()
let currentWorkspace: string | null = null

/**
 * Phase C: get or load the graph engine for a specific workspace directory.
 * Each worktree/workspace has its own cached engine keyed by normalized path.
 *
 * Returns null if graph.json is missing or the load fails. Never throws.
 */
export function getEngineForCwd(cwd: string): Promise<GraphEngine | null> {
  const key = normalizeWorkspaceKey(cwd)
  let promise = engineCache.get(key)
  if (!promise) {
    const graphPath = resolveGraphPathForCwd(cwd)
    promise = loadEngine(graphPath)
    engineCache.set(key, promise)
    logForDebugging(`[graphify:engine] Loaded engine for cwd: ${key}`)
  }
  return promise
}

/**
 * Return the shared GraphEngine instance for the current process.cwd().
 *
 * Backward-compatible singleton API — internally delegates to getEngineForCwd
 * so each distinct cwd gets its own cached engine. Returns null if graph.json
 * does not exist or the load fails. Never throws.
 */
export function getEngine(): Promise<GraphEngine | null> {
  const cwd = process.cwd()
  if (currentWorkspace === null) {
    currentWorkspace = cwd
  }
  return getEngineForCwd(cwd)
}

/**
 * Load or return a GraphEngine for a specific workspace.
 *
 * This is used by systest when working with different workspaces.
 * Each workspace gets its own cached engine instance.
 *
 * Unlike getEngineForCwd, this variant also returns null when graph.json
 * is missing (checked explicitly before loading) to preserve the legacy
 * systest behavior.
 *
 * @param workspace - Path to the workspace directory
 * @returns GraphEngine instance or null if unavailable
 */
export async function getEngineForWorkspace(
  workspace: string,
): Promise<GraphEngine | null> {
  const graphPath = resolveGraphPathForWorkspace(workspace)

  if (!fs.existsSync(graphPath)) {
    logForDebugging(
      `[graphify] engineLoader: graph.json not found for workspace ${workspace}`,
    )
    return null
  }

  // Use the cwd-scoped cache so repeated calls for the same workspace reuse
  // the loaded engine instead of rereading graph.json every time.
  return getEngineForCwd(workspace)
}

/**
 * Phase C (+ B): Reload the graph engine from disk.
 *
 * If `cwd` is provided, reloads only that workspace's cached engine.
 * Otherwise reloads the engine for process.cwd().
 *
 * Used after a graph rebuild (including worktree merge — after
 * mergeWorktreeGraph writes new graph.json, callers invoke
 * reloadEngine(repoRoot) to pick up the merged state).
 *
 * Never throws.
 */
export function reloadEngine(cwd?: string): Promise<GraphEngine | null> {
  const targetCwd = cwd ?? process.cwd()
  const key = normalizeWorkspaceKey(targetCwd)
  const graphPath = resolveGraphPathForCwd(targetCwd)
  const promise = loadEngine(graphPath)
  engineCache.set(key, promise)
  if (cwd === undefined) {
    currentWorkspace = targetCwd
  }
  logForDebugging(`[graphify:engine] Reloaded engine for cwd: ${key}`)
  return promise
}

/**
 * Phase C: Reset the cached engine instance for a single workspace.
 *
 * - resetEngine()       → clears only the engine for process.cwd() (the
 *                         "current workspace" — legacy singleton semantics).
 * - resetEngine(cwd)    → clears only the engine for that workspace.
 *
 * Backward-compat note: this USED to clear ALL cached engines when called
 * with no arguments. That was wrong for every known caller — each of them
 * had just rebuilt the graph for a specific cwd (process.cwd() or a
 * passed-in worktreePath) and intended to refresh that one engine, not
 * nuke every worktree's cache. Callers that genuinely want a full wipe
 * should use resetAllEngines() below.
 *
 * The next call to getEngine() / getEngineForCwd(cwd) will reload from disk.
 * Use reloadEngine() if you want to eagerly start the reload.
 */
export function resetEngine(cwd?: string): void {
  const targetCwd = cwd ?? process.cwd()
  const key = normalizeWorkspaceKey(targetCwd)
  engineCache.delete(key)
  if (cwd === undefined && currentWorkspace && normalizeWorkspaceKey(currentWorkspace) === key) {
    currentWorkspace = null
  }
  logForDebugging(`[graphify:engine] Reset engine for cwd: ${key}`)
}

/**
 * Phase C: Reset ALL cached engines across every workspace.
 *
 * Intended for test teardown and coarse-grained lifecycle events (process
 * shutdown, catastrophic graph corruption). Day-to-day callers should use
 * resetEngine(cwd) to scope the invalidation to a single workspace — a
 * blanket clear forces every other worktree to pay the graph.json reload
 * cost on its next query.
 */
export function resetAllEngines(): void {
  engineCache.clear()
  currentWorkspace = null
  logForDebugging(`[graphify:engine] Reset all engines`)
}

// ---------------------------------------------------------------------------
// Internal loader
// ---------------------------------------------------------------------------

async function loadEngine(graphPath: string): Promise<GraphEngine | null> {
  if (!fs.existsSync(graphPath)) {
    logForDebugging(
      `[graphify] engineLoader: graph.json not found at ${graphPath}, engine unavailable`,
    )
    return null
  }

  try {
    const engine = new GraphEngine()
    await engine.load(graphPath)
    logForDebugging(
      `[graphify] engineLoader: TS engine loaded successfully from ${graphPath}`,
    )
    return engine
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logForDebugging(
      `[graphify] engineLoader: TS engine load failed (Python fallback active) — ${msg}`,
    )
    return null
  }
}

// Referenced above so TS does not flag `currentWorkspace` as write-only.
// Intentionally exported only for diagnostics — not part of the stable API.
export function __getCurrentWorkspaceForDiagnostics(): string | null {
  return currentWorkspace
}

// Note: resolveGraphPathLocal is kept for potential future use by other
// functions in this module. It's currently unused after the Map migration
// but preserved to match the comment above about avoiding circular imports.
void resolveGraphPathLocal
