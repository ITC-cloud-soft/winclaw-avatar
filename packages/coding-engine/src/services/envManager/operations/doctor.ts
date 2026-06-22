/**
 * /env doctor — 3-level health check for environments.
 *
 * Level    | What is checked
 * ---------|-------------------------------------------------------------------
 * basic    | Credential resolution: can every ${var:KEY}/${secret:KEY} be
 *          | resolved from the infra file without making any network connection?
 * standard | basic + TCP reachability for all known endpoints (db.host, storage,
 *          | deploy registry). Does NOT do TLS handshake or auth.
 * full     | standard + active probes: cloud CLI identity checks, HEAD requests
 *          | to storage endpoints, and DB active probe (Phase 2 stub).
 *          | Blocked on production-tagged envs unless forceFull: true.
 *
 * Production gate (§1.5.1): running `full` on a production env without
 * forceFull throws EnvManagerError (kind: 'production-probe-blocked').  This
 * is a runtime guard, not just a warning.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { Env, InfraFile } from '../types.js'
import { EnvManagerError } from '../types.js'
import { resolveVar, resolveSecret } from '../resolver.js'
import { probeDatabase } from './dbProbe.js'
import { probeTcp, probeHttp, parseEndpoint } from './endpointProbe.js'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DoctorLevel = 'basic' | 'standard' | 'full'

export type DoctorReport = {
  envName: string
  level: DoctorLevel
  ranAt: string                                          // ISO
  results: DoctorCheck[]
  summary: { passed: number; failed: number; skipped: number }
}

export type DoctorCheck = {
  category: 'credential' | 'network' | 'database' | 'cloud' | 'storage'
  name: string                                           // e.g. "secret:DB_PASS_DEV"
  status: 'pass' | 'fail' | 'skip'
  detail?: string
  durationMs?: number
}

export type DoctorOptions = {
  /** Skip all network checks. */
  offline?: boolean
  /** Per-check timeout in milliseconds (default 5000). */
  timeout?: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a summary from a list of checks. */
function summarise(results: DoctorCheck[]): DoctorReport['summary'] {
  return {
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    skipped: results.filter((r) => r.status === 'skip').length,
  }
}

/** Regex matching ${var:KEY} and ${secret:KEY} tokens. */
const TOKEN_RE = /\$\{(var|secret):([A-Z][A-Z0-9_]*)\}/g

/**
 * Walk env as JSON and collect all unique token strings in the form
 * "var:KEY" | "secret:KEY".
 */
function collectTokens(env: Env): Array<{ kind: 'var' | 'secret'; key: string }> {
  const json = JSON.stringify(env)
  const seen = new Set<string>()
  const tokens: Array<{ kind: 'var' | 'secret'; key: string }> = []

  for (const match of json.matchAll(TOKEN_RE)) {
    const kind = match[1] as 'var' | 'secret'
    const key = match[2]
    const id = `${kind}:${key}`
    if (!seen.has(id)) {
      seen.add(id)
      tokens.push({ kind, key })
    }
  }

  return tokens
}

// ---------------------------------------------------------------------------
// Endpoint extraction helpers
// ---------------------------------------------------------------------------

/** Extract all candidate endpoint strings from an env for TCP probing. */
function extractEndpoints(
  env: Env,
): Array<{ label: string; category: DoctorCheck['category']; host: string; port: number }> {
  const endpoints: Array<{
    label: string
    category: DoctorCheck['category']
    host: string
    port: number
  }> = []

  // Database endpoints
  if (env.database) {
    const dbConns = [
      env.database.primary,
      ...(env.database.replicas ?? []),
      ...(env.database.analytics ? [env.database.analytics] : []),
    ]
    for (const conn of dbConns) {
      if (conn.type !== 'sqlite' && conn.host && !conn.host.includes('${')) {
        const port = conn.port ?? defaultDbPort(conn.type)
        endpoints.push({ label: `db:${conn.type}:${conn.host}:${port}`, category: 'database', host: conn.host, port })
      }
    }
  }

  // Storage endpoints
  if (env.storage?.objects?.endpoint) {
    const ep = env.storage.objects.endpoint
    if (!ep.includes('${')) {
      const parsed = parseEndpoint(ep)
      endpoints.push({ label: `storage:objects:${ep}`, category: 'storage', host: parsed.host, port: parsed.port })
    }
  }

  if (env.storage?.cache?.url) {
    const url = env.storage.cache.url
    if (!url.includes('${')) {
      const parsed = parseEndpoint(url)
      endpoints.push({ label: `storage:cache:${url}`, category: 'storage', host: parsed.host, port: parsed.port })
    }
  }

  // Deploy registry
  if (env.deploy?.registry) {
    const reg = env.deploy.registry
    if (!reg.includes('${')) {
      const parsed = parseEndpoint(reg)
      endpoints.push({ label: `deploy:registry:${reg}`, category: 'network', host: parsed.host, port: parsed.port })
    }
  }

  return endpoints
}

function defaultDbPort(type: string): number {
  const m: Record<string, number> = {
    mysql: 3306,
    postgres: 5432,
    mongodb: 27017,
    sqlserver: 1433,
    redis: 6379,
  }
  return m[type] ?? 5432
}

// ---------------------------------------------------------------------------
// Credential checks (basic level)
// ---------------------------------------------------------------------------

async function runCredentialChecks(
  env: Env,
  infra: InfraFile,
  options: DoctorOptions,
): Promise<DoctorCheck[]> {
  const tokens = collectTokens(env)
  const results: DoctorCheck[] = []

  for (const { kind, key } of tokens) {
    const start = Date.now()
    try {
      const result =
        kind === 'var'
          ? await resolveVar(key, infra, { offline: options.offline })
          : await resolveSecret(key, infra, { offline: options.offline })

      const durationMs = Date.now() - start
      if (result.ok) {
        results.push({ category: 'credential', name: `${kind}:${key}`, status: 'pass', durationMs })
      } else {
        const detail =
          result.reason === 'unsupported-backend' && options.offline
            ? `skipped — backend unavailable in offline mode`
            : result.detail ?? result.reason

        const status =
          result.reason === 'unsupported-backend' && options.offline ? 'skip' : 'fail'

        results.push({ category: 'credential', name: `${kind}:${key}`, status, detail, durationMs })
      }
    } catch (err: unknown) {
      results.push({
        category: 'credential',
        name: `${kind}:${key}`,
        status: 'fail',
        detail: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Network checks (standard level)
// ---------------------------------------------------------------------------

async function runNetworkChecks(
  env: Env,
  options: DoctorOptions,
): Promise<DoctorCheck[]> {
  if (options.offline) {
    // Emit skip entries for all endpoints
    const eps = extractEndpoints(env)
    return eps.map((ep) => ({
      category: ep.category,
      name: ep.label,
      status: 'skip' as const,
      detail: 'skipped — offline mode',
      durationMs: 0,
    }))
  }

  const eps = extractEndpoints(env)
  const results: DoctorCheck[] = []

  for (const ep of eps) {
    const probe = await probeTcp(ep.host, ep.port, options.timeout ?? 5000)
    results.push({
      category: ep.category,
      name: ep.label,
      status: probe.ok ? 'pass' : 'fail',
      detail: probe.detail,
      durationMs: probe.durationMs,
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// Active probes (full level)
// ---------------------------------------------------------------------------

/** Run `az account show` / `aws sts get-caller-identity` / `aliyun sts`. */
async function runCloudCheck(
  env: Env,
  options: DoctorOptions,
): Promise<DoctorCheck> {
  if (options.offline) {
    return { category: 'cloud', name: `cloud:${env.cloud.provider}`, status: 'skip', detail: 'skipped — offline mode', durationMs: 0 }
  }

  const start = Date.now()
  const provider = env.cloud.provider

  try {
    if (provider === 'azure') {
      await execFileAsync('az', ['account', 'show'], { timeout: options.timeout ?? 5000 })
      return { category: 'cloud', name: `cloud:azure:az-account-show`, status: 'pass', durationMs: Date.now() - start }
    }

    if (provider === 'aws') {
      const profileArgs = (env.cloud as { profile?: string }).profile
        ? ['--profile', (env.cloud as { profile?: string }).profile!]
        : []
      await execFileAsync('aws', ['sts', 'get-caller-identity', ...profileArgs], {
        timeout: options.timeout ?? 5000,
      })
      return { category: 'cloud', name: `cloud:aws:sts-get-caller-identity`, status: 'pass', durationMs: Date.now() - start }
    }

    if (provider === 'aliyun') {
      await execFileAsync('aliyun', ['sts', 'GetCallerIdentity'], { timeout: options.timeout ?? 5000 })
      return { category: 'cloud', name: `cloud:aliyun:sts-get-caller-identity`, status: 'pass', durationMs: Date.now() - start }
    }

    if (provider === 'gcp') {
      await execFileAsync('gcloud', ['auth', 'print-identity-token', '--quiet'], {
        timeout: options.timeout ?? 5000,
      })
      return { category: 'cloud', name: `cloud:gcp:gcloud-auth`, status: 'pass', durationMs: Date.now() - start }
    }

    // on-prem — no cloud CLI to check
    return {
      category: 'cloud',
      name: `cloud:on-prem`,
      status: 'skip',
      detail: 'no cloud CLI check for on-prem provider',
      durationMs: Date.now() - start,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      category: 'cloud',
      name: `cloud:${provider}`,
      status: 'fail',
      detail: msg,
      durationMs: Date.now() - start,
    }
  }
}

/** Run HEAD requests to storage endpoints. */
async function runStorageChecks(
  env: Env,
  options: DoctorOptions,
): Promise<DoctorCheck[]> {
  if (!env.storage?.objects?.endpoint) return []
  if (options.offline) {
    return [{
      category: 'storage',
      name: `storage:objects:head`,
      status: 'skip',
      detail: 'skipped — offline mode',
      durationMs: 0,
    }]
  }

  const ep = env.storage.objects.endpoint
  if (ep.includes('${')) return []

  const start = Date.now()
  const probe = await probeHttp(ep, options.timeout ?? 5000)
  return [{
    category: 'storage',
    name: `storage:objects:head:${ep}`,
    status: probe.ok ? 'pass' : 'fail',
    detail: probe.detail,
    durationMs: Date.now() - start,
  }]
}

/** Run active DB probes (Phase 2 stub). */
async function runDbActiveChecks(
  env: Env,
  options: DoctorOptions,
): Promise<DoctorCheck[]> {
  if (!env.database) return []
  if (options.offline) {
    return [{
      category: 'database',
      name: 'db:active-probe',
      status: 'skip',
      detail: 'skipped — offline mode',
      durationMs: 0,
    }]
  }

  const conn = env.database.primary
  if (conn.type === 'sqlite') return []

  const start = Date.now()
  const probe = await probeDatabase(conn, {
    active: true,
    timeoutMs: options.timeout ?? 5000,
  })
  return [{
    category: 'database',
    name: `db:active:${conn.type}:${conn.host}`,
    status: probe.ok ? 'pass' : probe.detail?.includes('not installed') ? 'skip' : 'fail',
    detail: probe.detail,
    durationMs: Date.now() - start,
  }]
}

// ---------------------------------------------------------------------------
// Production gate
// ---------------------------------------------------------------------------

function assertNotProduction(env: Env, forceFull: boolean): void {
  const tags: unknown[] = Array.isArray(env.tags) ? env.tags : []
  if (tags.includes('production') && !forceFull) {
    throw new EnvManagerError(
      `runDoctorFull is blocked for production environment "${env.name}". ` +
        `Pass forceFull: true to override this safety gate.`,
      'untested-skill-on-prod',
      { env: env.name },
    )
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * basic — credential resolution only.
 * Does not attempt any network connections.
 */
export async function runDoctorBasic(
  env: Env,
  infra: InfraFile,
  options: DoctorOptions = {},
): Promise<DoctorReport> {
  const results = await runCredentialChecks(env, infra, options)
  return {
    envName: env.name,
    level: 'basic',
    ranAt: new Date().toISOString(),
    results,
    summary: summarise(results),
  }
}

/**
 * standard — basic + TCP/TLS-open reachability for all known endpoints.
 * Does NOT perform TLS handshake or authentication.
 */
export async function runDoctorStandard(
  env: Env,
  infra: InfraFile,
  options: DoctorOptions = {},
): Promise<DoctorReport> {
  const [credChecks, netChecks] = await Promise.all([
    runCredentialChecks(env, infra, options),
    runNetworkChecks(env, options),
  ])

  const results = [...credChecks, ...netChecks]
  return {
    envName: env.name,
    level: 'standard',
    ranAt: new Date().toISOString(),
    results,
    summary: summarise(results),
  }
}

/**
 * full — standard + active probes (cloud CLI, storage HEAD, DB active probe stub).
 *
 * Throws EnvManagerError (kind: 'untested-skill-on-prod') if the env has the
 * 'production' tag and options.forceFull is not true.
 */
export async function runDoctorFull(
  env: Env,
  infra: InfraFile,
  options: DoctorOptions & { forceFull?: boolean } = {},
): Promise<DoctorReport> {
  assertNotProduction(env, options.forceFull ?? false)

  const [credChecks, netChecks, cloudCheck, storageChecks, dbActiveChecks] = await Promise.all([
    runCredentialChecks(env, infra, options),
    runNetworkChecks(env, options),
    runCloudCheck(env, options),
    runStorageChecks(env, options),
    runDbActiveChecks(env, options),
  ])

  const results = [...credChecks, ...netChecks, cloudCheck, ...storageChecks, ...dbActiveChecks]
  return {
    envName: env.name,
    level: 'full',
    ranAt: new Date().toISOString(),
    results,
    summary: summarise(results),
  }
}
