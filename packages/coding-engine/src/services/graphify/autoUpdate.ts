/**
 * Auto-update module for graphify — Layer 1 of the incremental update system.
 *
 * Provides a debounced notification API that tool call sites (FileEditTool,
 * FileWriteTool, …) call after a successful write. Batches rapid successive
 * edits into a single incrementalUpdate() call on the GraphEngine.
 *
 * Phase C: multi-worktree graph isolation.
 *   Pending files are batched per workspace (cwd). Each workspace's queue
 *   flushes independently against its own GraphEngine instance with its own
 *   debounce timer (so a removal in workspace A cannot early-flush workspace
 *   B's pending queue).
 *
 *   Workspace resolution priority (most specific → least):
 *     1. Explicit `cwd` arg — authoritative, used by the file watcher.
 *     2. AsyncLocalStorage cwd override (runWithCwdOverride) — AgentTool
 *        worktree context.
 *     3. `.claude/worktrees/<slug>/` path detection on the filePath — catches
 *        edits whose tool call did NOT go through runWithCwdOverride.
 *     4. findGitRoot(filePath) — returns the worktree root (NOT canonicalized
 *        to main), so each worktree gets its own engine cache.
 *     5. process.cwd() — last resort for files outside any git root.
 *
 *   Note: we intentionally do NOT use findCanonicalGitRoot here. That helper
 *   collapses a worktree path to the main repo root, which would funnel all
 *   worktree edits into the main engine's cache key and defeat the whole
 *   Phase C isolation story.
 *
 * Design principles:
 *  - Never throws — this is a background side-effect; errors are only logged.
 *  - Only processes recognized code file extensions (ignores assets, configs, …).
 *  - Debounce window: DEBOUNCE_MS (1500 ms) to merge quick consecutive edits.
 */

import path from 'node:path'
import { homedir } from 'node:os'
import { findGitRoot } from '../../utils/git.js'
import { getCwd } from '../../utils/cwd.js'
import { logForDebugging } from '../../utils/debug.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Debounce window — waits this long after the LAST edit before flushing.
// Larger values coalesce more edits into one full-rebuild (the rebuild is
// expensive: walks the whole workspace, re-parses every file, rewrites
// graph.json). During /newproject Phase 4 the AI may burst 20-50 Edit/Write
// calls; a short debounce combined with the fire-and-forget timer below
// produced overlapping rebuilds and out-of-memory crashes on 6k-node graphs.
const DEBOUNCE_MS = 5000

// Minimum interval between rebuilds for the same workspace. Even if edits
// keep streaming in, we never rebuild more often than this. Protects against
// the pathological case of a 5-second rebuild that finishes just as another
// 5-second window of edits completes, immediately kicking off another.
const MIN_REBUILD_INTERVAL_MS = 15000

/**
 * Regex that matches file extensions we want to track in the graph.
 * Intentionally narrow — binary files, images, and generated files are excluded.
 */
const CODE_FILE_RE = /\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|hpp)$/

// ---------------------------------------------------------------------------
// Per-workspace debounce + re-entrance state (Phase C + reentrance fix)
// ---------------------------------------------------------------------------

const pendingByWorkspace = new Map<string, Set<string>>()
const timersByWorkspace = new Map<string, ReturnType<typeof setTimeout>>()

// Re-entrance guard: tracks the in-flight rebuild (if any) for each workspace.
// While a rebuild is running, new edits queue into `pendingByWorkspace` but do
// NOT kick off another rebuild. When the current one finishes we check whether
// pending edits accumulated and schedule one more flush.
const inFlightByWorkspace = new Map<string, Promise<void>>()

// Last completion time per workspace — enforces MIN_REBUILD_INTERVAL_MS.
const lastFlushedAtByWorkspace = new Map<string, number>()

// ---------------------------------------------------------------------------
// Workspace resolution
// ---------------------------------------------------------------------------

function normalizeCwdKey(cwd: string): string {
  return path.resolve(cwd).replace(/\\/g, '/')
}

/**
 * Sentinel returned by resolveWorkspaceForFile when no safe workspace could be
 * determined. Callers MUST check for this and skip the rebuild — never feed it
 * to buildGraph as rootDir.
 */
export const SKIP_REBUILD = '__SKIP_REBUILD__'

/**
 * Reject paths that would cause graphify to scan the user's whole home or the
 * filesystem root. Triggered when `notifyFileChanged()` is called without a
 * cwd and the file lives outside any git repository — without this guard the
 * fallback `process.cwd()` was once `C:\\Users\\USER`, leading to a 761,179-
 * file walk and a 13 GB memory leak (airlinesys5 incident, 2026-04-28).
 */
function isDangerousRoot(p: string): boolean {
  if (!p) return true
  const norm = path.resolve(p).replace(/\\/g, '/')
  // OS roots: "/", "C:/", "D:/", etc.
  if (/^([a-zA-Z]:)?\/?$/.test(norm)) return true
  // Anything that IS the user's home or one of its top-level junk dirs.
  // We treat anything whose path equals (or is exactly) os.homedir() as unsafe,
  // since legitimate workspaces should never be the home itself.
  try {
    const home = homedir().replace(/\\/g, '/')
    if (norm === home || norm === home.replace(/\/$/, '')) return true
    // Also reject /Users, /home, C:/Users — common shared parents.
    if (/^([a-zA-Z]:)?\/(Users|home)\/?$/i.test(norm)) return true
  } catch {
    // ignore
  }
  return false
}

/**
 * Detect whether `filePath` lives under a `.claude/worktrees/<slug>/`
 * hierarchy. If so, return the worktree root (`<...>/.claude/worktrees/<slug>`).
 *
 * We match on OS-native separators explicitly — the regex is constructed
 * against `path.sep` rather than a hardcoded `/` to stay cross-platform.
 */
function findWorktreeRoot(filePath: string): string | null {
  const abs = path.resolve(filePath)
  const sep = path.sep
  const sepEsc = sep.replace(/\\/g, '\\\\')
  // Greedy match on everything up to and including `.claude/worktrees/<slug>`,
  // where <slug> is a single path component.
  const re = new RegExp(
    `^(.+?${sepEsc}\\.claude${sepEsc}worktrees${sepEsc}[^${sepEsc}]+)(?:${sepEsc}|$)`,
  )
  const match = abs.match(re)
  return match ? match[1]! : null
}

/**
 * Best-effort mapping from a changed file to its workspace root.
 * See the file-level doc comment for the full priority order.
 */
function resolveWorkspaceForFile(filePath: string, cwd?: string): string | typeof SKIP_REBUILD {
  // 1. Explicit cwd argument (watcher path — authoritative).
  //    Still gated by isDangerousRoot: even an "authoritative" caller must not
  //    smuggle HOME or the OS root in. Without this guard, the airlinesys5
  //    incident could reproduce if a future caller passes a bad cwd directly.
  if (cwd) {
    const key = normalizeCwdKey(cwd)
    if (isDangerousRoot(key)) {
      logForDebugging(
        `[graphify] resolveWorkspaceForFile: refusing dangerous explicit cwd "${cwd}" for file "${filePath}". Skipping rebuild.`,
      )
      return SKIP_REBUILD
    }
    return key
  }

  // 2. AsyncLocalStorage override (AgentTool worktree execution context).
  //    Only honour it when it actually differs from the process cwd — using
  //    process.cwd() as a fallback here would just duplicate step 5.
  try {
    const localCwd = getCwd()
    if (localCwd && localCwd !== process.cwd()) {
      const key = normalizeCwdKey(localCwd)
      if (!isDangerousRoot(key)) return key
    }
  } catch {
    // ignore — getCwd can throw if bootstrap state is missing
  }

  // 3. `.claude/worktrees/<slug>/` detection from the file path itself.
  try {
    const wt = findWorktreeRoot(filePath)
    if (wt) {
      const key = normalizeCwdKey(wt)
      if (!isDangerousRoot(key)) return key
    }
  } catch {
    // ignore
  }

  // 4. findGitRoot — returns the worktree root (NOT canonicalized to main),
  //    so each worktree keeps its own engine.
  try {
    const absPath = path.resolve(filePath)
    const root = findGitRoot(path.dirname(absPath))
    if (root && !isDangerousRoot(root)) return normalizeCwdKey(root)
  } catch {
    // ignore
  }

  // 5. Last-resort fallback — but ONLY if process.cwd() is sane.
  //    Without this guard, a process started in HOME (or any non-project
  //    directory) was triggering full-HOME graph builds via Edit/Write
  //    notifications. See SKIP_REBUILD docs above for the airlinesys5 incident.
  const fallback = process.cwd()
  if (isDangerousRoot(fallback)) {
    logForDebugging(
      `[graphify] resolveWorkspaceForFile: refusing dangerous fallback root "${fallback}" for file "${filePath}". Skipping rebuild.`,
    )
    return SKIP_REBUILD
  }
  return normalizeCwdKey(fallback)
}

function queueForWorkspace(workspaceKey: string): Set<string> {
  let set = pendingByWorkspace.get(workspaceKey)
  if (!set) {
    set = new Set<string>()
    pendingByWorkspace.set(workspaceKey, set)
  }
  return set
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Notify the auto-update system that a file has been created or modified.
 *
 * Called by the tool execution layer (FileEditTool, FileWriteTool) and by the
 * chokidar file watcher after a successful write. Non-code files are silently
 * ignored.
 *
 * @param filePath - Absolute path to the changed file.
 * @param cwd - Optional workspace root the file belongs to. When omitted,
 *   inferred via the priority chain documented at the top of this file.
 */
export function notifyFileChanged(filePath: string, cwd?: string): void {
  if (!CODE_FILE_RE.test(filePath)) return

  const workspaceKey = resolveWorkspaceForFile(filePath, cwd)
  if (workspaceKey === SKIP_REBUILD) return
  queueForWorkspace(workspaceKey).add(filePath)
  scheduleFlush(workspaceKey)
}

/**
 * Notify the auto-update system that a file has been removed.
 *
 * Flushes the target workspace's queue immediately (with the deleted file
 * appended so the engine observes its absence and drops its nodes).
 * Other workspaces' queues and timers are untouched — the per-workspace
 * debounce map makes cross-workspace interference impossible.
 *
 * @param filePath - Absolute path to the removed file.
 * @param cwd - Optional workspace root. See notifyFileChanged for semantics.
 */
export function notifyFileRemoved(filePath: string, cwd?: string): void {
  if (!CODE_FILE_RE.test(filePath)) return

  const workspaceKey = resolveWorkspaceForFile(filePath, cwd)
  if (workspaceKey === SKIP_REBUILD) return

  // Queue the deletion into the pending set. Previously this path bypassed the
  // debounce/re-entrance guard and called flushFiles directly — that was the
  // root cause of overlapping rebuilds when a session deleted many files in
  // a row (each call spawned its own concurrent full rebuild).
  const set = queueForWorkspace(workspaceKey)
  set.add(filePath)
  scheduleFlush(workspaceKey)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Schedule (or re-schedule) the debounced flush for a single workspace.
 *
 * Each workspace has its own timer in `timersByWorkspace`, so an edit in
 * workspace A never resets or cancels workspace B's pending flush.
 *
 * Re-entrance semantics: if a rebuild for this workspace is already running
 * when the timer fires, we skip kicking off a second one. Pending files stay
 * in the queue; maybeScheduleFollowupFlush() picks them up when the current
 * rebuild finishes.
 */
function scheduleFlush(workspaceKey: string): void {
  const existing = timersByWorkspace.get(workspaceKey)
  if (existing) clearTimeout(existing)

  // Compute effective delay: respect MIN_REBUILD_INTERVAL_MS since last flush.
  const lastFlushed = lastFlushedAtByWorkspace.get(workspaceKey) ?? 0
  const sinceLast = Date.now() - lastFlushed
  const extraWait = Math.max(0, MIN_REBUILD_INTERVAL_MS - sinceLast)
  const delay = Math.max(DEBOUNCE_MS, extraWait)

  const timer = setTimeout(() => {
    timersByWorkspace.delete(workspaceKey)

    // Re-entrance guard: skip if a rebuild is already in flight. When it
    // completes, its `finally` block will schedule another flush if there
    // are still pending files.
    if (inFlightByWorkspace.has(workspaceKey)) {
      logForDebugging(
        `[graphify] Auto-rebuild for ${workspaceKey} skipped — previous rebuild still running`,
      )
      return
    }

    const fileSet = pendingByWorkspace.get(workspaceKey)
    if (!fileSet || fileSet.size === 0) return
    pendingByWorkspace.delete(workspaceKey)

    const promise = flushFiles(workspaceKey, [...fileSet])
    inFlightByWorkspace.set(workspaceKey, promise)
    promise.finally(() => {
      inFlightByWorkspace.delete(workspaceKey)
      lastFlushedAtByWorkspace.set(workspaceKey, Date.now())
      // If edits accumulated during the rebuild, schedule a follow-up.
      const residual = pendingByWorkspace.get(workspaceKey)
      if (residual && residual.size > 0) {
        scheduleFlush(workspaceKey)
      }
    })
  }, delay)

  timersByWorkspace.set(workspaceKey, timer)
}

async function flushFiles(workspaceKey: string, files: string[]): Promise<void> {
  if (files.length === 0) return

  // Why full rebuild instead of engine.incrementalUpdate(files):
  //   The legacy incrementalUpdate only REMOVES nodes for changed files — it
  //   does NOT re-parse content to add new nodes, and it does NOT persist to
  //   disk. This meant graph.json was frozen at Phase 0 state even as /newproject
  //   generated hundreds of new files; GATE queries then ran against a snapshot
  //   of an empty workspace. Full rebuild is slower (seconds) but correct:
  //   writes fresh graph.json, then reloadEngine refreshes the in-memory cache.
  //
  // Re-entrance safety lives in scheduleFlush — flushFiles itself assumes
  // it's the only rebuild running for this workspace.

  const t0 = performance.now()
  try {
    const { buildGraph } = await import('./builder/index.js')
    const { reloadEngine } = await import('./engineLoader.js')
    const result = await buildGraph({ rootDir: workspaceKey })
    if (result.success) {
      await reloadEngine(workspaceKey)
      const ms = Math.round(performance.now() - t0)
      logForDebugging(
        `[graphify] Auto-rebuilt graph (${result.nodes} nodes, ${result.edges} edges) in ${ms}ms for ${workspaceKey} (trigger: ${files.length} file(s))`,
      )
    } else {
      logForDebugging(
        `[graphify] Auto-rebuild reported failure for ${workspaceKey}`,
      )
    }
  } catch (err) {
    logForDebugging(
      `[graphify] Auto-rebuild failed for ${workspaceKey}: ${(err as Error)?.message ?? err}`,
    )
  }
}
