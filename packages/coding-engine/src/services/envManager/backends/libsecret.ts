import { execFileSync } from 'child_process'
import type { BackendSpec, ResolveResult } from '../types.js'
import { getCached, setCached, parseTtl } from '../cache.js'

// ---------------------------------------------------------------------------
// Test hook — replaced in unit tests to avoid real shell calls
// ---------------------------------------------------------------------------

export type ShellExecutor = (cmd: string, args: string[]) => string

let shellExecutor: ShellExecutor = (cmd: string, args: string[]): string => {
  return execFileSync(cmd, args, { encoding: 'utf8' })
}

/**
 * Replaces the shell executor. Call with `null` to restore the default.
 * Intended only for unit tests.
 */
export function setShellExecutor(fn: ShellExecutor | null): void {
  if (fn === null) {
    shellExecutor = (cmd: string, args: string[]): string =>
      execFileSync(cmd, args, { encoding: 'utf8' })
  } else {
    shellExecutor = fn
  }
}

// ---------------------------------------------------------------------------
// Linux libsecret via `secret-tool` CLI
// ---------------------------------------------------------------------------

/**
 * All metacoder secrets are stored under the attribute name `metacoder-key`.
 * The spec's `attr` field supplies the attribute value.
 *
 * Store secrets with:
 *   secret-tool store --label="<label>" metacoder-key <attr>
 */
const ATTR_NAME = 'metacoder-key'

/**
 * Resolves a credential stored via libsecret (GNOME keyring / KWallet).
 *
 * Requirements:
 *   - Linux (linux)
 *   - `secret-tool` CLI installed (e.g. `apt install libsecret-tools`)
 *
 * Results are cached per `attr` according to `cache_ttl` (default 30 min).
 */
export async function resolveLibsecret(
  spec: BackendSpec & { backend: 'libsecret' },
): Promise<ResolveResult> {
  if (process.platform !== 'linux') {
    return {
      ok: false,
      key: spec.attr,
      kind: 'secret',
      reason: 'unsupported-backend',
      detail: 'libsecret is only available on Linux',
    }
  }

  const cacheKey = `libsecret:${spec.attr}`
  const ttlMs = parseTtl(spec.cache_ttl)

  const cached = getCached(cacheKey)
  if (cached !== null) {
    return { ok: true, value: cached }
  }

  let raw: string
  try {
    raw = shellExecutor('secret-tool', ['lookup', ATTR_NAME, spec.attr])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      key: spec.attr,
      kind: 'secret',
      reason: 'backend-failed',
      detail: msg,
    }
  }

  const value = raw.trim()
  if (value === '') {
    return {
      ok: false,
      key: spec.attr,
      kind: 'secret',
      reason: 'not-declared',
      detail: `No libsecret entry for ${ATTR_NAME}="${spec.attr}"`,
    }
  }

  setCached(cacheKey, value, ttlMs)
  return { ok: true, value }
}
