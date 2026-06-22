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
// Azure CLI via `az` command
// ---------------------------------------------------------------------------

const LOGIN_HINT = "Run 'az login' first"

/**
 * Resolves a value from the Azure CLI using a JMESPath query against
 * `az account show`.
 *
 * The `query` field in the spec is a JMESPath expression, e.g. `".tenantId"`.
 * Leading dots are stripped so the expression is passed cleanly to `--query`.
 *
 * Requirements:
 *   - `az` CLI installed and authenticated (`az login`)
 *
 * Results are cached according to `cache_ttl` (default 30 min).
 */
export async function resolveAzCli(
  spec: BackendSpec & { backend: 'az-cli' },
): Promise<ResolveResult> {
  // az-cli is a cross-platform tool; no OS restriction applied.
  const cacheKey = `az-cli:${spec.query}`
  const ttlMs = parseTtl(spec.cache_ttl)

  const cached = getCached(cacheKey)
  if (cached !== null) {
    return { ok: true, value: cached }
  }

  // Strip leading dot that some users include in JMESPath expressions.
  const query = spec.query.startsWith('.') ? spec.query.slice(1) : spec.query

  let raw: string
  try {
    raw = shellExecutor('az', [
      'account', 'show',
      '--query', query,
      '-o', 'tsv',
    ])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stderr = (err as { stderr?: string }).stderr ?? msg

    const needsLogin =
      stderr.includes("Please run 'az login'") ||
      stderr.includes('az login') ||
      msg.includes('az login') ||
      stderr.includes('AADSTS') ||
      stderr.includes('not logged in')

    return {
      ok: false,
      key: spec.query,
      kind: 'var',
      reason: 'backend-failed',
      detail: needsLogin ? LOGIN_HINT : msg,
    }
  }

  const value = raw.trim()
  if (value === '') {
    return {
      ok: false,
      key: spec.query,
      kind: 'var',
      reason: 'not-declared',
      detail: `az account show --query "${query}" returned empty output`,
    }
  }

  setCached(cacheKey, value, ttlMs)
  return { ok: true, value }
}
