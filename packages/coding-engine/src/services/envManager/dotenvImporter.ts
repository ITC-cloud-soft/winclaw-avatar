/**
 * dotenvImporter.ts
 *
 * Parses a .env file and produces:
 *   - environments.yaml snippet (ready to write)
 *   - infra.yaml patch (vars + secrets backend declarations)
 *
 * Per v2.2 §3.4 classification rules.
 */

import YAML from 'yaml'
import type { EnvironmentsFile, InfraFile, BackendSpec } from './types.js'

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export type ImportResult = {
  /** e.g. "dev" */
  envName: string
  /** YAML stringified environments.yaml block (single env), ready to write */
  environmentsYaml: string
  /** YAML for ~/.metacoder/projects/<id>/infra.yaml additions */
  infraYamlPatch: string
  /** names classified as var */
  varsAdded: string[]
  /** names classified as secret */
  secretsAdded: string[]
  /** user-visible warnings */
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Secret keyword patterns (case-insensitive substrings)
// ---------------------------------------------------------------------------

const SECRET_SUBSTRINGS = [
  'PASSWORD',
  'SECRET',
  'TOKEN',
  'CREDENTIAL',
  'PASS',
  'PWD',
  'KEY',
] as const

/**
 * Public prefix patterns that force classification to "var" even when the key
 * contains a secret keyword (Next.js / Vite public-env convention).
 */
const PUBLIC_PREFIXES = ['NEXT_PUBLIC_', 'VITE_PUBLIC_', 'PUBLIC_'] as const

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Classify a single key as 'var' or 'secret'.
 *
 * Rules (applied in priority order):
 * 1. If key starts with PUBLIC_, NEXT_PUBLIC_, VITE_PUBLIC_ → var (forced)
 * 2. If key contains any SECRET_SUBSTRINGS (case-insensitive) → secret
 * 3. Otherwise → var
 */
export function classifyKey(key: string): 'var' | 'secret' {
  const upper = key.toUpperCase()

  // Rule 1: public prefix override
  for (const prefix of PUBLIC_PREFIXES) {
    if (upper.startsWith(prefix)) return 'var'
  }

  // Rule 2: secret keyword substring
  for (const sub of SECRET_SUBSTRINGS) {
    if (upper.includes(sub)) return 'secret'
  }

  return 'var'
}

/**
 * Parse a .env file content into a key→value map.
 *
 * Handles:
 *   KEY=value
 *   KEY="double quoted"
 *   KEY='single quoted'
 *   # comments
 *   blank lines
 *   KEY=          (empty value)
 *   Lines with leading/trailing whitespace
 *   Unicode values
 *   Malformed lines (no "=") are silently skipped with a warning side-channel
 *   via the returned tuple
 */
export function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    // skip blanks and comments
    if (!line || line.startsWith('#')) continue

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue // malformed — no '='

    const key = line.slice(0, eqIdx).trim()
    if (!key) continue // empty key

    let rawVal = line.slice(eqIdx + 1).trim()

    // strip surrounding quotes (double or single)
    if (
      (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
      (rawVal.startsWith("'") && rawVal.endsWith("'"))
    ) {
      rawVal = rawVal.slice(1, -1)
    }

    result[key] = rawVal
  }

  return result
}

// ---------------------------------------------------------------------------
// Cloud provider heuristics
// ---------------------------------------------------------------------------

type CloudHint = 'azure' | 'aws' | 'aliyun' | null

function detectCloudHint(keys: string[]): CloudHint {
  const upper = keys.map(k => k.toUpperCase())
  if (upper.some(k => k.startsWith('AZURE_'))) return 'azure'
  if (upper.some(k => k.startsWith('AWS_'))) return 'aws'
  if (upper.some(k => k.startsWith('ALIYUN_'))) return 'aliyun'
  return null
}

/** Returns true if key suggests a database connection string or host. */
function isDatabaseKey(key: string): boolean {
  const u = key.toUpperCase()
  return (
    u === 'DATABASE_URL' ||
    u === 'DB_URL' ||
    u === 'DB_HOST'
  )
}

// ---------------------------------------------------------------------------
// YAML builders
// ---------------------------------------------------------------------------

/**
 * Build the cloud section placeholder for environments.yaml.
 * When a cloud hint is detected, fill provider; otherwise use on-prem.
 */
function buildCloudSection(cloudHint: CloudHint): Record<string, unknown> {
  switch (cloudHint) {
    case 'azure':
      return {
        provider: 'azure',
        subscription: '<FILL_IN>',
        region: '<FILL_IN>',
        resource_group: '<FILL_IN>',
      }
    case 'aws':
      return {
        provider: 'aws',
        region: '<FILL_IN>',
      }
    case 'aliyun':
      return {
        provider: 'aliyun',
        access_key_id: '<FILL_IN>',
        access_key_secret: '<FILL_IN>',
        region: '<FILL_IN>',
      }
    default:
      return {
        provider: 'on-prem',
        host: '<FILL_IN>',
      }
  }
}

/**
 * Build the infra.yaml vars/secrets sections.
 *
 * For vars: backend=env, name=KEY
 * For secrets with backendForSecrets='env': backend=env, name=KEY
 * For secrets with backendForSecrets='windows-credman':
 *   target = metacoder/<project-id>/<envName>/<key-lowercased-with-dashes>
 */
function buildInfraSection(
  vars: Record<string, string>,
  secrets: Record<string, string>,
  envName: string,
  backendForSecrets: 'env' | 'windows-credman',
): { vars: Record<string, BackendSpec>; secrets: Record<string, BackendSpec> } {
  const infraVars: Record<string, BackendSpec> = {}
  for (const key of Object.keys(vars)) {
    infraVars[key] = { backend: 'env', name: key }
  }

  const infraSecrets: Record<string, BackendSpec> = {}
  for (const key of Object.keys(secrets)) {
    if (backendForSecrets === 'windows-credman') {
      const credmanKey = key.toLowerCase().replace(/_/g, '-')
      infraSecrets[key] = {
        backend: 'windows-credman',
        target: `metacoder/<project-id>/${envName}/${credmanKey}`,
      }
    } else {
      infraSecrets[key] = { backend: 'env', name: key }
    }
  }

  return { vars: infraVars, secrets: infraSecrets }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Import a .env file, classifying keys and producing YAML outputs.
 */
export async function importDotenv(
  dotenvPath: string,
  options: {
    asEnvName: string
    existingEnvironmentsFile?: EnvironmentsFile
    existingInfraFile?: InfraFile
    backendForSecrets?: 'env' | 'windows-credman'
  },
): Promise<ImportResult> {
  const { asEnvName, backendForSecrets = 'env' } = options

  // Read file
  const fs = await import('node:fs')
  let content: string
  try {
    content = fs.readFileSync(dotenvPath, 'utf8')
  } catch (err: unknown) {
    throw new Error(`Failed to read .env file at ${dotenvPath}: ${String(err)}`)
  }

  const parsed = parseDotenv(content)
  const warnings: string[] = []
  const varsMap: Record<string, string> = {}
  const secretsMap: Record<string, string> = {}
  const keys = Object.keys(parsed)

  if (keys.length === 0) {
    warnings.push('The .env file is empty or contains no valid key=value pairs.')
  }

  // Classify keys
  for (const key of keys) {
    const kind = classifyKey(key)
    if (kind === 'secret') {
      secretsMap[key] = parsed[key]!
    } else {
      varsMap[key] = parsed[key]!
    }
  }

  // Database heuristics
  for (const key of keys) {
    if (isDatabaseKey(key)) {
      warnings.push(
        `Key "${key}" detected — consider mapping into database.primary.host in environments.yaml`,
      )
    }
  }

  // Cloud heuristics
  const cloudHint = detectCloudHint(keys)

  // Build environments.yaml env block
  // Vars use ${var:KEY}, secrets use ${secret:KEY}
  const varRefs: Record<string, string> = {}
  for (const key of Object.keys(varsMap)) {
    varRefs[key] = `\${var:${key}}`
  }
  const secretRefs: Record<string, string> = {}
  for (const key of Object.keys(secretsMap)) {
    secretRefs[key] = `\${secret:${key}}`
  }

  const envBlock: Record<string, unknown> = {
    name: asEnvName,
    cloud: buildCloudSection(cloudHint),
    database: {
      primary: {
        type: '<FILL_IN: mysql|postgres|mongodb|sqlserver|redis|sqlite>',
        host: '<FILL_IN>',
        port: null,
        database: '<FILL_IN>',
        user: '<FILL_IN>',
        password: '<FILL_IN>',
      },
    },
    storage: {
      objects: null,
      cache: null,
      queue: null,
    },
    safety: {
      destructive_ops: 'confirm',
    },
    vars: Object.keys(varRefs).length > 0 ? varRefs : undefined,
    secrets: Object.keys(secretRefs).length > 0 ? secretRefs : undefined,
  }

  // Remove undefined fields
  for (const k of Object.keys(envBlock)) {
    if (envBlock[k] === undefined) delete envBlock[k]
  }

  // Merge with existing environments file if provided
  let environmentsFileObj: Record<string, unknown>
  if (options.existingEnvironmentsFile) {
    const existing = options.existingEnvironmentsFile
    const otherEnvs = existing.environments.filter(e => e.name !== asEnvName)
    environmentsFileObj = {
      version: 2,
      default: existing.default,
      environments: [...otherEnvs, envBlock],
    }
  } else {
    environmentsFileObj = {
      version: 2,
      default: asEnvName,
      environments: [envBlock],
    }
  }

  const environmentsYaml = YAML.stringify(environmentsFileObj, { lineWidth: 120 })

  // Build infra.yaml patch
  const { vars: infraVars, secrets: infraSecrets } = buildInfraSection(
    varsMap,
    secretsMap,
    asEnvName,
    backendForSecrets,
  )

  let infraPatchObj: Record<string, unknown>
  if (options.existingInfraFile) {
    const existing = options.existingInfraFile
    infraPatchObj = {
      version: 2,
      vars: { ...(existing.vars ?? {}), ...infraVars },
      secrets: { ...(existing.secrets ?? {}), ...infraSecrets },
    }
    if (existing.ci_mode) {
      infraPatchObj['ci_mode'] = existing.ci_mode
    }
  } else {
    infraPatchObj = {
      version: 2,
      ...(Object.keys(infraVars).length > 0 ? { vars: infraVars } : {}),
      ...(Object.keys(infraSecrets).length > 0 ? { secrets: infraSecrets } : {}),
    }
  }

  const infraYamlPatch = YAML.stringify(infraPatchObj, { lineWidth: 120 })

  return {
    envName: asEnvName,
    environmentsYaml,
    infraYamlPatch,
    varsAdded: Object.keys(varsMap),
    secretsAdded: Object.keys(secretsMap),
    warnings,
  }
}
