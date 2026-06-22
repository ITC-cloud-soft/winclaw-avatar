/**
 * Resolution layer for the Meta Coder Infra Environment Manager.
 *
 * Implements §4.4 of INFRA_ENVIRONMENT_DESIGN.v2.2.md.
 */

import type { InfraFile, Env, ResolvedEnv, ResolveResult, BackendSpec } from './types.js'
import { EnvManagerError } from './types.js'
import { getBackendDispatcher } from './backends/index.js'
import { getCached, setCached, parseTtl, invalidateAll as _invalidateAll } from './cache.js'

// ---------------------------------------------------------------------------
// Public option types
// ---------------------------------------------------------------------------

export type ResolveOptions = {
  /** Skip the cache and always re-fetch from the backend. */
  noCache?: boolean
  /**
   * Skip network-dependent backends (az-cli, aws-cli, 1password, vault,
   * keyvault, aliyun-cli).  Literal and env still work.
   */
  offline?: boolean
  /**
   * Optional user-level infra file (~/.metacoder/infra.yaml) used as a
   * fallback when the project-level infra file does not declare a key.
   */
  userInfra?: InfraFile
}

// ---------------------------------------------------------------------------
// Network backends that are skipped in offline mode
// ---------------------------------------------------------------------------

const NETWORK_BACKENDS = new Set([
  'az-cli',
  'aws-cli',
  'aliyun-cli',
  '1password',
  'vault',
  'keyvault',
])

// Regex that matches ${var:KEY} and ${secret:KEY} tokens
const TOKEN_RE = /\$\{(var|secret):([A-Z][A-Z0-9_]*)\}/g

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Dispatches to the appropriate backend and honours the offline flag.
 * Does NOT handle caching — that is the caller's responsibility.
 */
async function dispatch(
  spec: BackendSpec,
  key: string,
  kind: 'var' | 'secret',
  options: ResolveOptions,
): Promise<ResolveResult> {
  const name = spec.backend

  if (options.offline && NETWORK_BACKENDS.has(name)) {
    return {
      ok: false,
      key,
      kind,
      reason: 'unsupported-backend',
      detail: `Backend '${name}' is not available in offline mode`,
    }
  }

  const dispatcher = getBackendDispatcher(name as Parameters<typeof getBackendDispatcher>[0])
  if (dispatcher === null) {
    return {
      ok: false,
      key,
      kind,
      reason: 'unsupported-backend',
      detail: `Backend '${name}' is not implemented on this platform`,
    }
  }

  return dispatcher(spec)
}

/**
 * Looks up a spec in the given infra file's `vars` or `secrets` map.
 */
function findSpec(
  key: string,
  kind: 'var' | 'secret',
  infra: InfraFile,
): BackendSpec | undefined {
  const map = kind === 'var' ? infra.vars : infra.secrets
  return map?.[key]
}

/**
 * Resolves a single key against the resolution order described in §4.4:
 *   1. project infra
 *   2. user infra (if provided)
 *   3. process.env fallback (var only, silent; secret: loud error)
 */
async function resolveSingle(
  key: string,
  kind: 'var' | 'secret',
  infra: InfraFile,
  options: ResolveOptions,
): Promise<ResolveResult> {
  // ── Step 1: project-level infra ──────────────────────────────────────────
  const projectSpec = findSpec(key, kind, infra)
  if (projectSpec !== undefined) {
    return resolveSpec(key, kind, projectSpec, options)
  }

  // ── Step 2: user-level infra fallback ────────────────────────────────────
  const userSpec = options.userInfra
    ? findSpec(key, kind, options.userInfra)
    : undefined

  if (userSpec !== undefined) {
    return resolveSpec(key, kind, userSpec, options)
  }

  // ── Step 3: process.env fallback (var only) ──────────────────────────────
  if (kind === 'var') {
    const raw = process.env[key]
    if (raw !== undefined && raw !== '') {
      return { ok: true, value: raw }
    }
    // Silent: var not found
    return { ok: false, key, kind, reason: 'not-declared' }
  }

  // Secret not found — loud (distinct from var)
  return {
    ok: false,
    key,
    kind: 'secret',
    reason: 'not-declared',
    detail: `Secret '${key}' is not declared in any infra file`,
  }
}

/**
 * Resolves a single BackendSpec with caching.
 */
async function resolveSpec(
  key: string,
  kind: 'var' | 'secret',
  spec: BackendSpec,
  options: ResolveOptions,
): Promise<ResolveResult> {
  // §4.3 enforcement: literal backend is never allowed for secrets.
  // The schema marks `literal | secret:` as ❌. We guard here as well so a
  // hand-edited infra.yaml that bypasses load-time validation still cannot
  // leak a plaintext secret through resolution.
  if (kind === 'secret' && spec.backend === 'literal') {
    return {
      ok: false,
      key,
      kind: 'secret',
      reason: 'unsupported-backend',
      detail: 'literal backend is not allowed for secrets (use env / windows-credman / vault / etc.)',
    }
  }

  const cacheKey = `${kind}:${key}:${spec.backend}`

  if (!options.noCache) {
    const cached = getCached(cacheKey)
    if (cached !== null) {
      return { ok: true, value: cached }
    }
  }

  const result = await dispatch(spec, key, kind, options)

  if (result.ok) {
    const ttlMs = 'cache_ttl' in spec ? parseTtl((spec as { cache_ttl?: string }).cache_ttl) : parseTtl()
    setCached(cacheKey, result.value, ttlMs)
  }

  return result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves a single var key from the given infra file.
 */
export async function resolveVar(
  key: string,
  infra: InfraFile,
  options: ResolveOptions = {},
): Promise<ResolveResult> {
  return resolveSingle(key, 'var', infra, options)
}

/**
 * Resolves a single secret key from the given infra file.
 */
export async function resolveSecret(
  key: string,
  infra: InfraFile,
  options: ResolveOptions = {},
): Promise<ResolveResult> {
  return resolveSingle(key, 'secret', infra, options)
}

/**
 * Resolves all ${var:KEY} and ${secret:KEY} tokens found recursively in the
 * env object.
 *
 * - ${var:KEY} tokens are substituted in-place in the returned object.
 * - ${secret:KEY} tokens are left as opaque markers in the returned object;
 *   their key names are collected into `secretRefs`.
 * - `envVars` is a flat map of all resolved var values suitable for child
 *   process injection.
 *
 * Circular references (a var whose value references another var) are NOT
 * recursed — the substitution is a single pass to keep things simple.
 */
export async function resolveEnvironment(
  env: Env,
  infra: InfraFile,
  options: ResolveOptions = {},
): Promise<ResolvedEnv> {
  const varCache = new Map<string, string>()
  const secretRefs = new Set<string>()
  const failures: ResolveResult[] = []

  // ── Collect all tokens from a stringified walk of the env ─────────────────
  const envJson = JSON.stringify(env)
  const allTokens = new Set<string>()

  for (const match of envJson.matchAll(TOKEN_RE)) {
    allTokens.add(`${match[1]}:${match[2]}`)
  }

  // ── Resolve vars (pre-fetch) ───────────────────────────────────────────────
  for (const token of allTokens) {
    const [kindRaw, key] = token.split(':') as ['var' | 'secret', string]
    if (kindRaw === 'var') {
      const result = await resolveSingle(key, 'var', infra, options)
      if (result.ok) {
        varCache.set(key, result.value)
      } else {
        failures.push(result)
      }
    } else {
      // Register secret token — resolve to verify it exists (but don't expose)
      const result = await resolveSingle(key, 'secret', infra, options)
      if (result.ok) {
        secretRefs.add(key)
      } else {
        // Not-declared secrets are still tracked (they may be optional at this
        // point); backend failures are surfaced as hard errors below.
        if (result.reason !== 'not-declared') {
          failures.push(result)
        } else {
          secretRefs.add(key)
        }
      }
    }
  }

  if (failures.length > 0) {
    throw new EnvManagerError(
      `Failed to resolve ${failures.length} key(s): ${failures.map((f) => (f.ok ? '' : f.key)).join(', ')}`,
      'backend-resolution-failed',
      failures,
    )
  }

  // ── Substitute vars in a deep clone of the env ────────────────────────────
  const substituted = substituteVars(envJson, varCache)
  const resolvedEnvBase = JSON.parse(substituted) as Env

  // ── Build flat envVars map ────────────────────────────────────────────────
  const envVars: Record<string, string> = {}
  for (const [k, v] of varCache.entries()) {
    envVars[k] = v
  }

  return {
    ...resolvedEnvBase,
    secretRefs: Array.from(secretRefs),
    envVars,
  }
}

// ---------------------------------------------------------------------------
// Internal: string substitution
// ---------------------------------------------------------------------------

/**
 * Replaces all ${var:KEY} tokens in the serialised JSON string using the
 * pre-resolved varCache.  Secret tokens are left intact.
 */
function substituteVars(json: string, varCache: Map<string, string>): string {
  return json.replace(TOKEN_RE, (match, kind: string, key: string) => {
    if (kind === 'var') {
      const value = varCache.get(key)
      if (value !== undefined) {
        // JSON-encode the replacement value so it stays valid JSON
        return JSON.stringify(value).slice(1, -1) // strip surrounding quotes — we're already inside a string
      }
    }
    // Leave secret tokens (and unresolved var tokens) unchanged
    return match
  })
}
