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
// macOS Keychain via `security` CLI
// ---------------------------------------------------------------------------

/**
 * Resolves a credential stored in the macOS Keychain.
 *
 * Requirements:
 *   - macOS (darwin)
 *   - `security` CLI (ships with macOS)
 *
 * Results are cached per `service:account` according to `cache_ttl` (default 30 min).
 */
export async function resolveKeychain(
  spec: BackendSpec & { backend: 'keychain' },
): Promise<ResolveResult> {
  if (process.platform !== 'darwin') {
    return {
      ok: false,
      key: `${spec.service}:${spec.account}`,
      kind: 'secret',
      reason: 'unsupported-backend',
      detail: 'keychain is only available on macOS',
    }
  }

  const cacheKey = `keychain:${spec.service}:${spec.account}`
  const ttlMs = parseTtl(spec.cache_ttl)

  const cached = getCached(cacheKey)
  if (cached !== null) {
    return { ok: true, value: cached }
  }

  let raw: string
  try {
    raw = shellExecutor('security', [
      'find-generic-password',
      '-s', spec.service,
      '-a', spec.account,
      '-w',
    ])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stderr = (err as { stderr?: string }).stderr ?? msg

    if (stderr.includes('could not be found') || msg.includes('could not be found')) {
      return {
        ok: false,
        key: `${spec.service}:${spec.account}`,
        kind: 'secret',
        reason: 'not-declared',
        detail: `No Keychain entry for service="${spec.service}" account="${spec.account}"`,
      }
    }

    return {
      ok: false,
      key: `${spec.service}:${spec.account}`,
      kind: 'secret',
      reason: 'backend-failed',
      detail: msg,
    }
  }

  const value = raw.trim()
  if (value === '') {
    return {
      ok: false,
      key: `${spec.service}:${spec.account}`,
      kind: 'secret',
      reason: 'not-declared',
    }
  }

  setCached(cacheKey, value, ttlMs)
  return { ok: true, value }
}
