/**
 * Detects if the current runtime is Bun.
 * Returns true when:
 * - Running a JS file via the `bun` command
 * - Running a Bun-compiled standalone executable
 */
export function isRunningWithBun(): boolean {
  // https://bun.com/guides/util/detect-bun
  return process.versions.bun !== undefined
}

/**
 * Detects if running as a Bun-compiled standalone executable.
 * This checks for embedded files which are present in compiled binaries.
 *
 * Result is cached since the runtime environment cannot change during
 * a single process lifetime. This function is called on every React
 * render of PromptInput — without caching, it was producing ~11,000
 * log lines per session.
 */
let _cachedBundledMode: boolean | null = null

export function isInBundledMode(): boolean {
  if (_cachedBundledMode !== null) return _cachedBundledMode

  if (typeof Bun === "undefined") {
    _cachedBundledMode = false
    return false
  }

  // Primary signal: embeddedFiles is non-empty in a compiled binary
  if (Array.isArray(Bun.embeddedFiles) && Bun.embeddedFiles.length > 0) {
    _cachedBundledMode = true
    return true
  }

  // Fallback for exe mode where embeddedFiles may not be populated
  const execPath = process.execPath.toLowerCase()
  if (execPath.endsWith(".exe") || execPath.includes("metacoder")) {
    _cachedBundledMode = true
    return true
  }

  _cachedBundledMode = false
  return false
}