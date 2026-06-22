/**
 * dotenvExporter.ts
 *
 * Exports an environment from environments.yaml + infra.yaml into a .env
 * formatted string.
 *
 * Phase 0: secret resolution is out of scope — secrets always produce
 * placeholder lines. Var resolution supports 'literal' and 'env' backends
 * inline (no dependency on resolver.ts).
 */

import type { EnvironmentsFile, InfraFile, Env } from './types.js'

// ---------------------------------------------------------------------------
// Internal: extract all ${var:KEY} and ${secret:KEY} references from a value
// ---------------------------------------------------------------------------

const VAR_REF_RE = /\$\{var:([^}]+)\}/g
const SECRET_REF_RE = /\$\{secret:([^}]+)\}/g

function extractRefs(
  value: unknown,
  vars: Set<string>,
  secrets: Set<string>,
): void {
  if (typeof value === 'string') {
    for (const m of value.matchAll(VAR_REF_RE)) {
      vars.add(m[1]!)
    }
    for (const m of value.matchAll(SECRET_REF_RE)) {
      secrets.add(m[1]!)
    }
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) extractRefs(item, vars, secrets)
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      extractRefs(v, vars, secrets)
    }
  }
}

/** Walk the entire Env object and collect all ${var:KEY} / ${secret:KEY} refs. */
function collectRefs(env: Env): { varKeys: string[]; secretKeys: string[] } {
  const varSet = new Set<string>()
  const secretSet = new Set<string>()
  extractRefs(env as unknown, varSet, secretSet)
  return {
    varKeys: [...varSet].sort(),
    secretKeys: [...secretSet].sort(),
  }
}

// ---------------------------------------------------------------------------
// Internal: simple var resolution (no resolver.ts dependency)
// ---------------------------------------------------------------------------

/**
 * Resolve a var using the infra backend spec.
 *
 * Supported backends:
 *   literal → use value directly
 *   env     → use process.env[name]
 *   others  → write <NEEDS_RESOLUTION>
 */
function resolveVarInline(key: string, infra: InfraFile): string {
  const spec = infra.vars?.[key]
  if (!spec) return '<NEEDS_RESOLUTION>'

  switch (spec.backend) {
    case 'literal':
      return spec.value

    case 'env': {
      const val = process.env[spec.name]
      return val !== undefined ? val : `<ENV_NOT_SET:${spec.name}>`
    }

    default:
      return '<NEEDS_RESOLUTION>'
  }
}

// ---------------------------------------------------------------------------
// Internal: resolve extends chain (minimal, no circular-check needed here)
// ---------------------------------------------------------------------------

/**
 * Find an env by name from a EnvironmentsFile; returns undefined if not found.
 */
function findEnv(name: string, file: EnvironmentsFile): Env | undefined {
  return file.environments.find(e => e.name === name)
}

/**
 * Resolve extends chain by collecting all ${var:KEY} and ${secret:KEY}
 * references across the env and its ancestors.
 *
 * We do NOT need full deep-merge here — we just collect refs from ALL envs
 * in the chain so the export is complete.
 */
function collectAllRefs(
  envName: string,
  file: EnvironmentsFile,
  visited: Set<string> = new Set(),
): { varKeys: Set<string>; secretKeys: Set<string> } {
  if (visited.has(envName)) return { varKeys: new Set(), secretKeys: new Set() }
  visited.add(envName)

  const env = findEnv(envName, file)
  if (!env) return { varKeys: new Set(), secretKeys: new Set() }

  const { varKeys, secretKeys } = collectRefs(env)
  const varSet = new Set(varKeys)
  const secretSet = new Set(secretKeys)

  if (env.extends) {
    const parentRefs = collectAllRefs(env.extends, file, visited)
    for (const k of parentRefs.varKeys) varSet.add(k)
    for (const k of parentRefs.secretKeys) secretSet.add(k)
  }

  return { varKeys: varSet, secretKeys: secretSet }
}

// ---------------------------------------------------------------------------
// Public: exportDotenv
// ---------------------------------------------------------------------------

/**
 * Export an environment as a .env formatted string.
 *
 * @param envName            - name of the env to export
 * @param environmentsFile   - parsed environments.yaml
 * @param infraFile          - parsed infra.yaml (for var resolution)
 * @param options.includeSecrets       - if false (default), secrets become placeholder
 * @param options.resolveSecretValues  - Phase 0: always placeholder regardless of flag
 *
 * @returns .env content as a string
 */
export async function exportDotenv(
  envName: string,
  environmentsFile: EnvironmentsFile,
  infraFile: InfraFile,
  options: {
    includeSecrets?: boolean
    resolveSecretValues?: boolean
  } = {},
): Promise<string> {
  const { includeSecrets = false } = options

  const env = findEnv(envName, environmentsFile)
  if (!env) {
    throw new Error(
      `Unknown environment "${envName}". Available: ${environmentsFile.environments.map(e => e.name).join(', ')}`,
    )
  }

  // Collect all refs (including from extends ancestors)
  const { varKeys, secretKeys } = collectAllRefs(envName, environmentsFile)

  // Build sorted key list
  const lines: string[] = []

  // Header comment
  const timestamp = new Date().toISOString()
  lines.push(`# Generated by Meta Coder Infra Environment Manager`)
  lines.push(`# Environment: ${envName}`)
  lines.push(`# Generated at: ${timestamp}`)
  lines.push(`# WARNING: Do NOT commit this file — it may contain sensitive values.`)
  lines.push(`# Source environments.yaml env: ${envName}`)
  lines.push(``)

  // Vars section
  const sortedVarKeys = [...varKeys].sort()
  if (sortedVarKeys.length > 0) {
    lines.push(`# --- vars ---`)
    for (const key of sortedVarKeys) {
      const value = resolveVarInline(key, infraFile)
      // Quote value if it contains spaces or special characters
      const needsQuotes = /[\s#"'\\]/.test(value) || value.startsWith('<')
      const formatted = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value
      lines.push(`${key}=${formatted}`)
    }
    lines.push(``)
  }

  // Secrets section
  const sortedSecretKeys = [...secretKeys].sort()
  if (sortedSecretKeys.length > 0) {
    lines.push(`# --- secrets ---`)
    for (const key of sortedSecretKeys) {
      if (!includeSecrets) {
        lines.push(`${key}=<SECRET_NOT_INCLUDED>`)
      } else {
        // Phase 0: resolveSecretValues is out of scope
        lines.push(`${key}=<SECRET_NEEDS_RESOLVE>`)
      }
    }
    lines.push(``)
  }

  return lines.join('\n')
}
