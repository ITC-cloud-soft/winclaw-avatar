/**
 * systestEnvBridge.ts
 *
 * Bridges the env manager to /systest by reading the active (or override)
 * env, resolving it, and producing systest-ready settings including inferred
 * URLs and a database connection string.
 *
 * All URL inference is best-effort; when uncertain, a warning is emitted and
 * the URL is left undefined so the caller can prompt the user to fill it in.
 */

import type { ResolvedEnv, AzureCloud, AwsCloud, AliyunCloud } from './types.js'
import { getActiveEnv } from './activeEnv.js'
import { loadEnvironments, loadInfraFile, resolveEnvByName, resolveExtendsChain } from './loader.js'
import { resolveEnvironment } from './resolver.js'
import { EnvManagerError } from './types.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SystestEnvSettings = {
  /** Backend URL inferred from env (e.g. cloud + deploy.app_name + region) */
  backendUrl?: string
  /** Frontend URL inferred from env */
  frontendUrl?: string
  /** Database connection string usable as a SQLAlchemy-style URL */
  databaseUrl?: string
  /** Resolved env vars for child process injection (incl. secrets, NEVER for AI) */
  envVars: Record<string, string>
  /** Source env name for audit logging */
  sourceEnvName: string
  /**
   * True if env tags include 'production' — caller MUST refuse systest in this
   * case (destructive_ops enforcement at runtime, not just prompt).
   */
  isProduction: boolean
  /** Warnings (e.g. "frontend URL was inferred; verify before running E2E") */
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the active env (or `options.envOverride`), resolve it, and produce
 * systest-ready settings.  Returns `null` when:
 *   - no active env is set AND no override was given
 *   - environments.yaml is missing or invalid
 *   - the named env cannot be found
 *
 * Var-resolution failures (missing backend) throw an EnvManagerError.
 */
export async function buildSystestSettings(
  workspacePath: string,
  options?: { envOverride?: string },
): Promise<SystestEnvSettings | null> {
  // Determine env name
  const envName = options?.envOverride ?? getActiveEnv().envName
  if (!envName) return null

  // Load environments.yaml
  let envFile
  try {
    envFile = await loadEnvironments(workspacePath)
  } catch {
    return null
  }

  // Find env and resolve extends chain
  let rawEnv
  try {
    rawEnv = resolveEnvByName(envName, envFile)
  } catch {
    return null
  }
  const mergedEnv = resolveExtendsChain(rawEnv, envFile.environments)

  // Load infra and resolve vars
  const infra = await loadInfraFile(workspacePath)
  const resolved = await resolveEnvironment(mergedEnv, infra)

  return buildSettingsFromResolved(envName, resolved)
}

// ---------------------------------------------------------------------------
// Internal: build settings from a resolved env
// ---------------------------------------------------------------------------

function buildSettingsFromResolved(
  envName: string,
  resolved: ResolvedEnv,
): SystestEnvSettings {
  const warnings: string[] = []
  const isProduction = Array.isArray(resolved.tags) && resolved.tags.includes('production')

  // Production envs: no URL inference (we refuse to run, so no point guessing)
  if (isProduction) {
    return {
      envVars: resolved.envVars,
      sourceEnvName: envName,
      isProduction: true,
      warnings: [],
    }
  }

  const { backendUrl, backendWarnings } = inferBackendUrl(resolved)
  warnings.push(...backendWarnings)

  const { frontendUrl, frontendWarnings } = inferFrontendUrl(resolved, backendUrl)
  warnings.push(...frontendWarnings)

  const { databaseUrl, dbWarnings } = inferDatabaseUrl(resolved)
  warnings.push(...dbWarnings)

  return {
    backendUrl,
    frontendUrl,
    databaseUrl,
    envVars: resolved.envVars,
    sourceEnvName: envName,
    isProduction: false,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Internal: URL inference
// ---------------------------------------------------------------------------

function inferBackendUrl(
  resolved: ResolvedEnv,
): { backendUrl?: string; backendWarnings: string[] } {
  const warnings: string[] = []
  const deploy = resolved.deploy
  const appName = deploy?.app_name
  const cloud = resolved.cloud

  if (!appName) {
    warnings.push(
      'deploy.app_name is not set — backend URL cannot be inferred. ' +
        'Pass --backend-url or set deploy.app_name in your env config.',
    )
    return { backendUrl: undefined, backendWarnings: warnings }
  }

  // Azure Container Apps
  if (cloud.provider === 'azure') {
    const azCloud = cloud as AzureCloud
    const skill = deploy?.skill ?? ''
    if (skill === 'azure-cloud-deploy') {
      // Azure Container Apps pattern
      const url = `https://${appName}.${azCloud.region}.azurecontainerapps.io`
      warnings.push(
        `Backend URL inferred as Azure Container App: ${url} — verify before running E2E.`,
      )
      return { backendUrl: url, backendWarnings: warnings }
    }
    // Azure App Service
    if (skill === 'azure-appservice-node' || skill === 'azure-appservice-static') {
      const url = `https://${appName}.azurewebsites.net`
      warnings.push(
        `Backend URL inferred as Azure App Service: ${url} — verify before running E2E.`,
      )
      return { backendUrl: url, backendWarnings: warnings }
    }
    // Generic Azure fallback — try App Service naming
    const url = `https://${appName}.azurewebsites.net`
    warnings.push(
      `Backend URL inferred as Azure App Service (fallback): ${url} — verify before running E2E.`,
    )
    return { backendUrl: url, backendWarnings: warnings }
  }

  // AWS — cannot infer without ALB/ELB hostname
  if (cloud.provider === 'aws') {
    warnings.push(
      'AWS detected: backend URL cannot be inferred without an ALB/ELB hostname. ' +
        'Pass --backend-url explicitly.',
    )
    return { backendUrl: undefined, backendWarnings: warnings }
  }

  // Aliyun ACK
  if (cloud.provider === 'aliyun') {
    const alCloud = cloud as AliyunCloud
    const url = `https://${appName}.${alCloud.region}.aliyuncs.com`
    warnings.push(
      `Backend URL inferred as Aliyun ACK: ${url} — this is a best-effort guess. ` +
        'Verify before running E2E.',
    )
    return { backendUrl: url, backendWarnings: warnings }
  }

  // GCP / on-prem — no reliable inference
  warnings.push(
    `Cloud provider "${cloud.provider}" does not support automatic URL inference. ` +
      'Pass --backend-url explicitly.',
  )
  return { backendUrl: undefined, backendWarnings: warnings }
}

function inferFrontendUrl(
  resolved: ResolvedEnv,
  backendUrl: string | undefined,
): { frontendUrl?: string; frontendWarnings: string[] } {
  const warnings: string[] = []
  const appName = resolved.deploy?.app_name

  if (!backendUrl && !appName) {
    return { frontendUrl: undefined, frontendWarnings: [] }
  }

  // Common pattern: frontend is co-deployed alongside backend with a web/admin suffix
  if (backendUrl) {
    const frontendUrl = backendUrl.replace(/\/$/, '') + '/web'
    warnings.push(
      `Frontend URL inferred by appending "/web" to backend URL: ${frontendUrl} — ` +
        'verify before running E2E or pass --frontend-url.',
    )
    return { frontendUrl, frontendWarnings: warnings }
  }

  return { frontendUrl: undefined, frontendWarnings: [] }
}

function inferDatabaseUrl(
  resolved: ResolvedEnv,
): { databaseUrl?: string; dbWarnings: string[] } {
  const warnings: string[] = []
  const primary = resolved.database?.primary

  if (!primary) {
    return { databaseUrl: undefined, dbWarnings: [] }
  }

  const url = buildConnectionUrl(
    primary.type,
    primary.host,
    primary.port,
    primary.database,
    primary.user,
    primary.password,
  )

  return { databaseUrl: url, dbWarnings: warnings }
}

// ---------------------------------------------------------------------------
// Public helper: connection string builder
// ---------------------------------------------------------------------------

/**
 * Convert individual DB connection fields into a SQLAlchemy-style URL.
 *
 * Examples:
 *   mysql://<user>:<pass>@<host>:<port>/<db>
 *   postgres://<user>:<pass>@<host>/<db>
 *   mongodb://<user>:<pass>@<host>:<port>/<db>
 *   redis://<host>:<port>
 *   sqlite:///<path>
 */
export function buildConnectionUrl(
  type: string,
  host: string,
  port: number | undefined,
  database: string | undefined,
  user: string | undefined,
  password: string | undefined,
): string {
  // sqlite has its own format
  if (type === 'sqlite') {
    return `sqlite:///${database ?? host}`
  }

  const scheme = type === 'sqlserver' ? 'mssql+pyodbc' : type

  const portPart = port !== undefined ? `:${port}` : ''
  const dbPart = database ? `/${database}` : ''

  if (!user) {
    return `${scheme}://${host}${portPart}${dbPart}`
  }

  const encodedPassword = password
    ? encodeURIComponent(password)
    : ''
  const credPart = encodedPassword ? `${user}:${encodedPassword}@` : `${user}@`

  return `${scheme}://${credPart}${host}${portPart}${dbPart}`
}
