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
// Azure Key Vault backend
// ---------------------------------------------------------------------------

const LOGIN_HINT =
  "Run 'az login' and grant Key Vault access (role: Key Vault Secrets User)"

const PERMISSION_HINT = 'Token lacks Key Vault permission'

/**
 * Resolves a secret from Azure Key Vault using the `az` CLI.
 *
 * Spec fields:
 *   - `vault`  — Key Vault name (e.g. `"my-keyvault"` → https://my-keyvault.vault.azure.net)
 *   - `secret` — secret name in the vault (e.g. `"db-password"`)
 *
 * Uses:
 *   `az keyvault secret show --vault-name <vault> --name <secret> --query value -o tsv`
 * which returns just the secret value on stdout.
 *
 * Requirements:
 *   - `az` CLI installed and `az login` already completed
 *   - The signed-in identity must have the `Key Vault Secrets User` role (or
 *     equivalent) on the target vault — the backend does NOT attempt re-auth.
 *
 * Results are cached according to `cache_ttl` (default 30 min).
 */
export async function resolveKeyvault(
  spec: BackendSpec & { backend: 'keyvault' },
): Promise<ResolveResult> {
  const cacheKey = `keyvault:${spec.vault}:${spec.secret}`
  const ttlMs = parseTtl(spec.cache_ttl)

  const cached = getCached(cacheKey)
  if (cached !== null) {
    return { ok: true, value: cached }
  }

  let raw: string
  try {
    raw = shellExecutor('az', [
      'keyvault', 'secret', 'show',
      '--vault-name', spec.vault,
      '--name', spec.secret,
      '--query', 'value',
      '-o', 'tsv',
    ])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stderr = (err as { stderr?: string }).stderr ?? msg

    // Needs az login
    if (
      stderr.includes('az login') ||
      stderr.includes('Please run') ||
      stderr.includes('not logged in') ||
      stderr.includes('AADSTS') ||
      msg.includes('az login') ||
      msg.includes('not logged in')
    ) {
      return {
        ok: false,
        key: `${spec.vault}/${spec.secret}`,
        kind: 'secret',
        reason: 'backend-failed',
        detail: LOGIN_HINT,
      }
    }

    // Secret does not exist
    if (
      stderr.includes('SecretNotFound') ||
      stderr.includes('secret not found') ||
      stderr.includes('was not found') ||
      msg.includes('SecretNotFound') ||
      msg.includes('was not found')
    ) {
      return {
        ok: false,
        key: `${spec.vault}/${spec.secret}`,
        kind: 'secret',
        reason: 'not-declared',
        detail: `Secret "${spec.secret}" not found in vault "${spec.vault}"`,
      }
    }

    // Forbidden / insufficient permissions
    if (
      stderr.includes('Forbidden') ||
      stderr.includes('403') ||
      stderr.includes('does not have secrets get permission') ||
      msg.includes('Forbidden') ||
      msg.includes('forbidden')
    ) {
      return {
        ok: false,
        key: `${spec.vault}/${spec.secret}`,
        kind: 'secret',
        reason: 'backend-failed',
        detail: PERMISSION_HINT,
      }
    }

    return {
      ok: false,
      key: `${spec.vault}/${spec.secret}`,
      kind: 'secret',
      reason: 'backend-failed',
      detail: msg,
    }
  }

  const value = raw.trim()
  if (value === '') {
    return {
      ok: false,
      key: `${spec.vault}/${spec.secret}`,
      kind: 'secret',
      reason: 'not-declared',
      detail: `Secret "${spec.secret}" in vault "${spec.vault}" returned empty value`,
    }
  }

  setCached(cacheKey, value, ttlMs)
  return { ok: true, value }
}
