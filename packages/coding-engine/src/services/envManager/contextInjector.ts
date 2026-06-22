/**
 * contextInjector.ts
 *
 * Builds the AI prompt context block for the active environment per
 * INFRA_ENVIRONMENT_DESIGN.v2.2.md §6.
 *
 * Three public functions:
 *   buildCompactSummary    — 50-100 token one-liner block
 *   buildProductionContext — full safety block for production envs
 *   buildContextBlock      — decides which (or both) to return
 */

import type { ResolvedEnv, VerifiedStateFile, VerifiedEnvState, KnownPitfall } from './types.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Return the cloud line fragment: provider/region/rg (rg optional). */
function cloudLine(env: ResolvedEnv): string {
  const c = env.cloud
  const provider = c.provider
  const region = 'region' in c ? (c.region ?? '') : ''
  const rg =
    'resource_group' in c
      ? c.resource_group
      : 'project' in c
        ? (c as { project: string }).project
        : undefined
  return rg ? `${provider}/${region}/${rg}` : `${provider}/${region}`
}

/** Return the db line fragment: type@host (or "none" when absent). */
function dbLine(env: ResolvedEnv): string {
  const db = env.database?.primary
  if (!db) return 'none'
  return `${db.type}@${db.host}`
}

/** Return the storage line fragment: type/account (or "none"). */
function storageLine(env: ResolvedEnv): string {
  const obj = env.storage?.objects
  if (!obj) return 'none'
  const account = 'account' in obj ? obj.account : obj.bucket ?? ''
  return account ? `${obj.type}/${account}` : obj.type
}

/** True if env has the given tag. */
function hasTag(env: ResolvedEnv, tag: string): boolean {
  return Array.isArray(env.tags) && env.tags.includes(tag)
}

/** Tested mark: ✓ when deploy.tested is true, ⚠ otherwise. */
function testedMark(env: ResolvedEnv): string {
  return env.deploy?.tested === true ? '✓' : '⚠'
}

// ---------------------------------------------------------------------------
// Public: buildCompactSummary
// ---------------------------------------------------------------------------

/**
 * Build a compact (50-100 token) summary block for injection into AI context.
 *
 * Format:
 * ```
 * ## ENV[<name>]
 * cloud=<provider>/<region>/<rg> | db=<type>@<host> | storage=<type>/<account>
 * deploy=skill:<skill>(<strategy>) tested=<✓|⚠> | safety=<destructive_ops>
 * ```
 */
export function buildCompactSummary(env: ResolvedEnv): string {
  const skillName = env.deploy?.skill ?? 'none'
  const strategy = env.deploy?.strategy ? `(${env.deploy.strategy})` : ''
  const destructive = env.safety.destructive_ops

  return [
    `## ENV[${env.name}]`,
    `cloud=${cloudLine(env)} | db=${dbLine(env)} | storage=${storageLine(env)}`,
    `deploy=skill:${skillName}${strategy} tested=${testedMark(env)} | safety=${destructive}`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Public: buildProductionContext
// ---------------------------------------------------------------------------

/**
 * Build a full production safety context block.
 *
 * Includes:
 * - Header warning
 * - Active deployment skill + tested status
 * - Verified state summary (cluster, registry, db, ingress)
 * - Known pitfalls (up to 15)
 * - Safety rules
 */
export function buildProductionContext(
  env: ResolvedEnv,
  verifiedState?: VerifiedStateFile | null,
): string {
  const lines: string[] = []

  lines.push(`### PRODUCTION ENVIRONMENT — extra safety in effect`)
  lines.push(``)

  // Deployment info
  const skillName = env.deploy?.skill ?? 'none'
  const tested = env.deploy?.tested === true ? 'YES (✓)' : 'NO (⚠ — deploy blocked until tested=true)'
  lines.push(`**Deployment skill**: ${skillName}`)
  lines.push(`**Tested**: ${tested}`)
  if (env.deploy?.verified_state) {
    lines.push(`**Verified state file**: ${env.deploy.verified_state}`)
  }
  lines.push(``)

  // Verified state
  if (verifiedState) {
    const envState: VerifiedEnvState | undefined = (verifiedState as Record<string, unknown>)[env.name] as VerifiedEnvState | undefined
    if (envState) {
      lines.push(`**Verified state** (last verified: ${verifiedState.last_verified} by ${verifiedState.last_verified_by}):`)
      if (envState.cluster) {
        lines.push(`- Cluster: ${envState.cluster.type}/${envState.cluster.id}${envState.cluster.region ? ` (${envState.cluster.region})` : ''}`)
      }
      if (envState.registry) {
        lines.push(`- Registry: ${envState.registry.type} → ${envState.registry.url}`)
      }
      if (envState.database?.rds_instance) {
        lines.push(`- RDS: ${envState.database.rds_instance}`)
      } else if (envState.database?.cluster) {
        lines.push(`- DB cluster: ${envState.database.cluster}`)
      }
      if (envState.ingress) {
        const ing = envState.ingress
        lines.push(`- Ingress: ${ing.type}${ing.domain ? ` → ${ing.domain}` : ''}${ing.id ? ` (${ing.id})` : ''}`)
      }

      // Known pitfalls (capped at 15)
      const pitfalls: KnownPitfall[] = Array.isArray(envState.known_pitfalls)
        ? envState.known_pitfalls.slice(0, 15)
        : []
      if (pitfalls.length > 0) {
        lines.push(``)
        lines.push(`**Known pitfalls**:`)
        for (const p of pitfalls) {
          lines.push(`- [${p.id}] ${p.summary}`)
        }
      }
      lines.push(``)
    }
  }

  // Safety rules
  lines.push(`**Safety rules**:`)
  lines.push(`- destructive_ops: \`${env.safety.destructive_ops}\``)
  if (env.safety.writes_two_phase_commit) {
    lines.push(`- writes_two_phase_commit: enabled — all writes must use two-phase commit`)
  }
  if (env.safety.audit_log) {
    lines.push(`- audit_log: ${env.safety.audit_log}${env.safety.audit_log_retention ? ` (retention: ${env.safety.audit_log_retention})` : ''}`)
  }
  if (env.database?.primary.roles?.write) {
    lines.push(`- DB write role: ${env.database.primary.roles.write.user} (password via secret ref)`)
  }
  lines.push(`- AI safety bypass: NOT POSSIBLE — production safety rules are enforced in code`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Public: buildContextBlock
// ---------------------------------------------------------------------------

/**
 * Return the context block to inject into the AI prompt for the given env.
 *
 * Rules:
 * - If env has tag `production` → compact summary + production context block
 * - Otherwise → compact summary only
 */
export function buildContextBlock(
  env: ResolvedEnv,
  verifiedState?: VerifiedStateFile | null,
): string {
  const compact = buildCompactSummary(env)

  if (hasTag(env, 'production')) {
    const prodCtx = buildProductionContext(env, verifiedState)
    return `${compact}\n\n${prodCtx}`
  }

  return compact
}
