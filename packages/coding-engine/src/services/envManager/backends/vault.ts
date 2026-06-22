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
// HashiCorp Vault backend
// ---------------------------------------------------------------------------

const ENV_VARS_HINT =
  'VAULT_ADDR / VAULT_TOKEN env vars required (e.g. export VAULT_ADDR=https://vault.example.com:8200)'

const PERMISSION_HINT = 'Vault token lacks permission for path'

/**
 * Resolves a secret field from HashiCorp Vault using the `vault` CLI.
 *
 * Spec fields:
 *   - `path`  — KV secret path, e.g. `"secret/data/myapp"` or `"kv/myapp/db"`
 *   - `field` — field name within the secret, e.g. `"db_password"`
 *
 * Uses `vault kv get -field=<field> <path>` which returns the raw field value
 * on stdout (no JSON wrapping).
 *
 * Pre-flight checks:
 *   - `VAULT_ADDR` must be set
 *   - `VAULT_TOKEN` must be set (or a valid token in ~/.vault-token)
 *
 * Results are cached according to `cache_ttl` (default 30 min).
 */
export async function resolveVault(
  spec: BackendSpec & { backend: 'vault' },
): Promise<ResolveResult> {
  // Pre-flight: VAULT_ADDR and VAULT_TOKEN are required environment variables.
  const vaultAddr = process.env['VAULT_ADDR']
  const vaultToken = process.env['VAULT_TOKEN']

  if (!vaultAddr || !vaultToken) {
    return {
      ok: false,
      key: `${spec.path}#${spec.field}`,
      kind: 'secret',
      reason: 'backend-failed',
      detail: ENV_VARS_HINT,
    }
  }

  const cacheKey = `vault:${spec.path}:${spec.field}`
  const ttlMs = parseTtl(spec.cache_ttl)

  const cached = getCached(cacheKey)
  if (cached !== null) {
    return { ok: true, value: cached }
  }

  let raw: string
  try {
    raw = shellExecutor('vault', [
      'kv', 'get',
      `-field=${spec.field}`,
      spec.path,
    ])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stderr = (err as { stderr?: string }).stderr ?? msg

    // Secret/field doesn't exist in Vault
    if (
      stderr.includes('no value found') ||
      stderr.includes('No value found') ||
      stderr.includes('field not present') ||
      msg.includes('no value found') ||
      msg.includes('No value found')
    ) {
      return {
        ok: false,
        key: `${spec.path}#${spec.field}`,
        kind: 'secret',
        reason: 'not-declared',
        detail: `Vault path "${spec.path}" field "${spec.field}" not found`,
      }
    }

    // Permission denied
    if (
      stderr.includes('permission denied') ||
      stderr.includes('403') ||
      msg.includes('permission denied')
    ) {
      return {
        ok: false,
        key: `${spec.path}#${spec.field}`,
        kind: 'secret',
        reason: 'backend-failed',
        detail: PERMISSION_HINT,
      }
    }

    return {
      ok: false,
      key: `${spec.path}#${spec.field}`,
      kind: 'secret',
      reason: 'backend-failed',
      detail: msg,
    }
  }

  const value = raw.trim()
  if (value === '') {
    return {
      ok: false,
      key: `${spec.path}#${spec.field}`,
      kind: 'secret',
      reason: 'not-declared',
      detail: `Vault path "${spec.path}" field "${spec.field}" returned empty value`,
    }
  }

  setCached(cacheKey, value, ttlMs)
  return { ok: true, value }
}
