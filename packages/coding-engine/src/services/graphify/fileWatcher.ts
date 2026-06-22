/**
 * Layer 2 of the auto-incremental update system: file watcher.
 *
 * Uses chokidar to observe a project directory for changes made outside
 * the tool execution layer (e.g. external editor saves, git operations that
 * touch the working tree). Feeds into the same debounced notifyFileChanged /
 * notifyFileRemoved API as Layer 1, so the two layers are additive and
 * naturally de-duplicate via the Set-based pending queue.
 *
 * Phase C: multi-worktree graph isolation.
 *   Each worktree gets its own file watcher, keyed on the normalized cwd.
 *   `startGraphFileWatcher(cwd)` is idempotent per cwd, and
 *   `stopGraphFileWatcher()` / `stopGraphFileWatcher(cwd)` can stop all or
 *   a specific one.
 *
 * Design constraints:
 *  - `persistent: false` — watcher must NOT prevent the process from exiting.
 *  - `ignoreInitial: true` — we don't want to re-index everything at startup.
 *  - `awaitWriteFinish` — avoids partial-file reads on slow writes.
 *  - Per-cwd idempotency — safe to call startGraphFileWatcher(cwd) multiple times.
 *
 * chokidar v4 note: glob strings are no longer supported in the `ignored`
 * option — only `function | RegExp | 絶対パス完全一致` are accepted. We use
 * function-based predicates below so the filters actually apply.
 */

import path from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import { notifyFileChanged, notifyFileRemoved } from './autoUpdate.js'
import { logForDebugging } from '../../utils/debug.js'

// ---------------------------------------------------------------------------
// Per-cwd watcher registry (Phase C)
// ---------------------------------------------------------------------------

const watchers = new Map<string, FSWatcher>()

function normalizeCwdKey(cwd: string): string {
  return path.resolve(cwd).replace(/\\/g, '/')
}

// ---------------------------------------------------------------------------
// ignored predicate factories (chokidar v4 — functions, not glob strings)
// ---------------------------------------------------------------------------

const SEP = path.sep

/**
 * Predicate for the main-repo watcher. Ignores infrastructure directories
 * and `.claude/` entirely — each worktree under `.claude/worktrees/<slug>/`
 * is watched by its own watcher instance, so recursing into `.claude/`
 * would duplicate events and waste fs handles.
 */
function isIgnoredInMainWatcher(p: string): boolean {
  // chokidar hands us OS-native paths; guard against callers passing
  // forward-slash paths on Windows by checking both separators.
  return (
    p.includes(`${SEP}node_modules${SEP}`) ||
    p.includes(`${SEP}graphify-out${SEP}`) ||
    p.includes(`${SEP}.git${SEP}`) ||
    p.includes(`${SEP}dist${SEP}`) ||
    p.includes(`${SEP}build${SEP}`) ||
    p.includes(`${SEP}.claude${SEP}`) ||
    p.endsWith(`${SEP}node_modules`) ||
    p.endsWith(`${SEP}graphify-out`) ||
    p.endsWith(`${SEP}.git`) ||
    p.endsWith(`${SEP}dist`) ||
    p.endsWith(`${SEP}build`) ||
    p.endsWith(`${SEP}.claude`)
  )
}

/**
 * Predicate for a worktree watcher, whose cwd lives at
 * `<repo>/.claude/worktrees/<slug>/`. We must NOT treat the watcher's own
 * root (which literally contains `.claude/` in its path) as ignored —
 * otherwise every event inside the worktree would be filtered out.
 *
 * Strategy: compute the relative path from the worktree root and apply
 * the same infrastructure filters there. The special case is nested
 * worktrees: `<worktreeRoot>/.claude/worktrees/<nested>/` is ignored
 * (each nested worktree gets its own watcher), but `<worktreeRoot>/.claude/`
 * files such as `settings.local.json` remain visible.
 */
function isIgnoredInWorktreeWatcher(
  worktreeRoot: string,
): (p: string) => boolean {
  const wtRootNorm = path.resolve(worktreeRoot)
  return (p: string): boolean => {
    const abs = path.resolve(p)
    // Outside the worktree root (shouldn't happen with chokidar's scoped
    // watch, but belt-and-braces) — drop it.
    if (abs !== wtRootNorm && !abs.startsWith(wtRootNorm + SEP)) {
      return true
    }
    const relFromWt = abs.substring(wtRootNorm.length) // leading `${SEP}` or ''
    if (
      relFromWt.includes(`${SEP}node_modules${SEP}`) ||
      relFromWt.includes(`${SEP}graphify-out${SEP}`) ||
      relFromWt.includes(`${SEP}.git${SEP}`) ||
      relFromWt.includes(`${SEP}dist${SEP}`) ||
      relFromWt.includes(`${SEP}build${SEP}`) ||
      relFromWt.endsWith(`${SEP}node_modules`) ||
      relFromWt.endsWith(`${SEP}graphify-out`) ||
      relFromWt.endsWith(`${SEP}.git`) ||
      relFromWt.endsWith(`${SEP}dist`) ||
      relFromWt.endsWith(`${SEP}build`)
    ) {
      return true
    }
    // Nested worktrees: skip `<worktreeRoot>/.claude/worktrees/*` entirely,
    // but keep direct `.claude/` contents (settings.local.json et al.).
    if (
      relFromWt.startsWith(`${SEP}.claude${SEP}worktrees${SEP}`) ||
      relFromWt === `${SEP}.claude${SEP}worktrees`
    ) {
      return true
    }
    return false
  }
}

/**
 * Heuristic: is `cwd` located inside a `.claude/worktrees/` hierarchy?
 * If so we pick the worktree-aware predicate; otherwise we treat the cwd
 * as a main repo root.
 */
function isWorktreePath(cwd: string): boolean {
  const normalized = path.resolve(cwd)
  return (
    normalized.includes(`${SEP}.claude${SEP}worktrees${SEP}`) ||
    normalized.endsWith(`${SEP}.claude${SEP}worktrees`)
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start watching `cwd` for file-system changes and feed them into the
 * graphify auto-update pipeline.
 *
 * Safe to call multiple times for the same cwd — subsequent calls are
 * no-ops if a watcher is already running for that cwd. Different cwds
 * (e.g. multiple worktrees) each get their own independent watcher.
 *
 * @param cwd - Root directory to watch (typically the project working
 *   directory or a worktree root).
 */
export function startGraphFileWatcher(cwd: string): void {
  const key = normalizeCwdKey(cwd)
  if (watchers.has(key)) {
    logForDebugging(
      `[graphify:watcher] Already watching ${key}, skipping`,
    )
    return
  }

  const ignoredFn = isWorktreePath(cwd)
    ? isIgnoredInWorktreeWatcher(cwd)
    : isIgnoredInMainWatcher

  const watcher = watch(cwd, {
    ignored: ignoredFn,
    persistent: false,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
    },
  })

  watcher.on('change', (filePath) => {
    logForDebugging(`[graphify:watcher] File changed: ${filePath}`)
    notifyFileChanged(filePath, cwd)
  })

  watcher.on('add', (filePath) => {
    logForDebugging(`[graphify:watcher] File added: ${filePath}`)
    notifyFileChanged(filePath, cwd)
  })

  watcher.on('unlink', (filePath) => {
    logForDebugging(`[graphify:watcher] File removed: ${filePath}`)
    notifyFileRemoved(filePath, cwd)
  })

  watchers.set(key, watcher)
  logForDebugging(`[graphify:watcher] Started watching ${key}`)
}

/**
 * Stop the file watcher(s) and release their resources.
 *
 * - stopGraphFileWatcher()       → stops ALL watchers (legacy behavior).
 * - stopGraphFileWatcher(cwd)    → stops only the watcher for that cwd.
 *
 * Idempotent — safe to call when no matching watcher is running.
 */
export function stopGraphFileWatcher(cwd?: string): void {
  if (cwd === undefined) {
    for (const [key, w] of watchers) {
      try {
        void w.close()
      } catch (err) {
        logForDebugging(
          `[graphify:watcher] Close failed for ${key}: ${(err as Error)?.message ?? err}`,
        )
      }
      logForDebugging(`[graphify:watcher] Stopped ${key}`)
    }
    watchers.clear()
    return
  }

  const key = normalizeCwdKey(cwd)
  const w = watchers.get(key)
  if (w) {
    try {
      void w.close()
    } catch (err) {
      logForDebugging(
        `[graphify:watcher] Close failed for ${key}: ${(err as Error)?.message ?? err}`,
      )
    }
    watchers.delete(key)
    logForDebugging(`[graphify:watcher] Stopped ${key}`)
  }
}
