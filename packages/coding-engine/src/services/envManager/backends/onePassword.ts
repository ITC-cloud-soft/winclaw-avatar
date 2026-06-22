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
// 1Password CLI (`op`) backend
// ---------------------------------------------------------------------------

const NOT_SIGNED_IN_HINT = "Run 'op signin' first"

/**
 * Resolves a field from a 1Password item using the `op` CLI.
 *
 * Spec fields:
 *   - `item`  — item name or UUID in 1Password (e.g. `"GitHub PAT"`)
 *   - `field` — field label to retrieve (e.g. `"credential"`, `"password"`)
 *
 * Uses `op item get "<item>" --fields "<field>"` which returns the raw field
 * value on stdout. The lookup is scoped to all vaults accessible to the
 * currently signed-in account; the default vault for new items is `Personal`.
 *
 * Requirements:
 *   - `op` CLI installed (https://developer.1password.com/docs/cli)
 *   - Signed in: `eval $(op signin)` or a service account token in `OP_SERVICE_ACCOUNT_TOKEN`
 *
 * Results are cached according to `cache_ttl` (default 30 min).
 */
export async function resolveOnePassword(
  spec: BackendSpec & { backend: '1password' },
): Promise<ResolveResult> {
  const cacheKey = `1password:${spec.item}:${spec.field}`
  const ttlMs = parseTtl(spec.cache_ttl)

  const cached = getCached(cacheKey)
  if (cached !== null) {
    return { ok: true, value: cached }
  }

  let raw: string
  try {
    raw = shellExecutor('op', [
      'item', 'get', spec.item,
      '--fields', spec.field,
    ])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stderr = (err as { stderr?: string }).stderr ?? msg

    // Detect sign-in required
    if (
      stderr.includes('not signed in') ||
      stderr.includes('sign in') ||
      stderr.includes('signin') ||
      stderr.includes('authentication required') ||
      msg.includes('not signed in') ||
      msg.includes('signin')
    ) {
      return {
        ok: false,
        key: `${spec.item}/${spec.field}`,
        kind: 'secret',
        reason: 'backend-failed',
        detail: NOT_SIGNED_IN_HINT,
      }
    }

    // Item or field not found
    if (
      stderr.includes("doesn't exist") ||
      stderr.includes('not found') ||
      stderr.includes('no item') ||
      msg.includes("doesn't exist") ||
      msg.includes('not found')
    ) {
      return {
        ok: false,
        key: `${spec.item}/${spec.field}`,
        kind: 'secret',
        reason: 'not-declared',
        detail: `1Password item "${spec.item}" field "${spec.field}" not found`,
      }
    }

    return {
      ok: false,
      key: `${spec.item}/${spec.field}`,
      kind: 'secret',
      reason: 'backend-failed',
      detail: msg,
    }
  }

  const value = raw.trim()
  if (value === '') {
    return {
      ok: false,
      key: `${spec.item}/${spec.field}`,
      kind: 'secret',
      reason: 'not-declared',
      detail: `1Password item "${spec.item}" field "${spec.field}" returned empty value`,
    }
  }

  setCached(cacheKey, value, ttlMs)
  return { ok: true, value }
}
