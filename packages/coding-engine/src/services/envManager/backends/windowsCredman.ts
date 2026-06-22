import { execFileSync } from 'child_process'
import type { BackendSpec, ResolveResult } from '../types.js'
import { getCached, setCached, parseTtl } from '../cache.js'

// ---------------------------------------------------------------------------
// Test hook — replaced in unit tests to avoid real shell calls
// ---------------------------------------------------------------------------

type ShellExecutor = (args: string[]) => string

let shellExecutor: ShellExecutor = (args: string[]): string => {
  return execFileSync('powershell.exe', args, {
    encoding: 'utf8',
    windowsHide: true,
  })
}

/**
 * Replaces the PowerShell executor. Call with `null` to restore the default.
 * Intended only for unit tests.
 */
export function setShellExecutor(fn: ShellExecutor | null): void {
  if (fn === null) {
    shellExecutor = (args: string[]): string =>
      execFileSync('powershell.exe', args, {
        encoding: 'utf8',
        windowsHide: true,
      })
  } else {
    shellExecutor = fn
  }
}

// ---------------------------------------------------------------------------
// PowerShell script template
// ---------------------------------------------------------------------------
// Requires the CredentialManager module:
//   Install-Module -Name CredentialManager -Force
// ---------------------------------------------------------------------------

function buildScript(target: string): string {
  // Escape single-quotes inside the target string
  const safe = target.replace(/'/g, "''")
  return [
    'Set-StrictMode -Off',
    '$ErrorActionPreference = "Stop"',
    `$cred = Get-StoredCredential -Target '${safe}' -AsCredentialObject`,
    'if ($null -eq $cred) { Write-Error "credential-not-found" ; exit 1 }',
    '$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred.Password)',
    'try { [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }',
    'finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }',
  ].join('\n')
}

const MODULE_MISSING_HINT =
  'PowerShell CredentialManager module required: Install-Module -Name CredentialManager -Force'

/**
 * Resolves a credential stored in Windows Credential Manager.
 *
 * Requirements:
 *   - Windows OS (win32)
 *   - PowerShell with CredentialManager module installed
 *
 * Results are cached per target according to `cache_ttl` (default 30 min).
 */
export async function resolveWindowsCredman(
  spec: BackendSpec & { backend: 'windows-credman' },
): Promise<ResolveResult> {
  if (process.platform !== 'win32') {
    return {
      ok: false,
      key: spec.target,
      kind: 'secret',
      reason: 'unsupported-backend',
      detail: 'windows-credman is only available on Windows',
    }
  }

  const cacheKey = `windows-credman:${spec.target}`
  const ttlMs = parseTtl(spec.cache_ttl)

  const cached = getCached(cacheKey)
  if (cached !== null) {
    return { ok: true, value: cached }
  }

  const script = buildScript(spec.target)
  let raw: string

  try {
    raw = shellExecutor(['-NonInteractive', '-NoProfile', '-Command', script])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)

    // Distinguish between "module missing" and other failures
    const isModuleMissing =
      msg.includes('Get-StoredCredential') ||
      msg.includes('is not recognized') ||
      msg.includes('CommandNotFoundException')

    return {
      ok: false,
      key: spec.target,
      kind: 'secret',
      reason: 'backend-failed',
      detail: isModuleMissing ? MODULE_MISSING_HINT : msg,
    }
  }

  const value = raw.trim()
  if (value === '') {
    return {
      ok: false,
      key: spec.target,
      kind: 'secret',
      reason: 'not-declared',
    }
  }

  setCached(cacheKey, value, ttlMs)
  return { ok: true, value }
}
