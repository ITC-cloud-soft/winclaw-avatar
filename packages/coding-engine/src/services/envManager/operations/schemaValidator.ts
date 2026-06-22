/**
 * JSON-Schema validation for environments.yaml and infra.yaml.
 *
 * Uses ajv@8 for validation. Schemas are defined inline.
 * Converts ajv errors + custom business-rule checks into ValidationIssue[].
 *
 * §15.5 of INFRA_ENVIRONMENT_DESIGN.v2.2.md
 */

import Ajv from 'ajv'
import type { ErrorObject } from 'ajv'
import type { ValidationIssue, ValidationResult } from './types.js'

// ---------------------------------------------------------------------------
// Ajv instance (strict: false to allow additional properties by default)
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true, strict: false })

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

const SAFETY_SCHEMA = {
  type: 'object',
  required: ['destructive_ops'],
  properties: {
    destructive_ops: { type: 'string', enum: ['allow', 'confirm', 'deny'] },
    writes_require_approval: { type: 'boolean' },
    writes_two_phase_commit: { type: 'boolean' },
    audit_log: { type: 'string' },
    audit_log_retention: { type: 'string', enum: ['7d', '30d', '1y', 'forever'] },
  },
  additionalProperties: false,
}

const DEPLOY_SKILL_NAMES = [
  'azure-cloud-deploy',
  'azure-appservice-node',
  'azure-appservice-static',
  'aliyun-deploy',
  'aliyun-cloud-deploy',
  'aws-cloud-deploy',
  'gcp-cloud-deploy',
  'kubernetes-rolling',
  'static-cdn',
  'manual',
] as const

const DEPLOY_SCHEMA = {
  type: 'object',
  required: ['skill', 'tested'],
  properties: {
    skill: { type: 'string', enum: DEPLOY_SKILL_NAMES },
    tested: { type: 'boolean' },
    requires_explicit_confirmation: { type: 'boolean' },
    verified_state: { type: 'string' },
    strategy: { type: 'string' },
    app_name: { type: 'string' },
    registry: { type: 'string' },
    rollback: {
      type: 'string',
      enum: ['previous-revision', 'kubectl-rollout-undo', 'lambda-previous-alias', 'manual'],
    },
    traffic_percent: { type: 'number' },
  },
  additionalProperties: false,
}

const CLOUD_SCHEMA = {
  oneOf: [
    {
      type: 'object',
      required: ['provider', 'subscription', 'region', 'resource_group'],
      properties: {
        provider: { const: 'azure' },
        subscription: { type: 'string' },
        tenant: { type: 'string' },
        region: { type: 'string' },
        resource_group: { type: 'string' },
      },
    },
    {
      type: 'object',
      required: ['provider', 'region'],
      properties: {
        provider: { const: 'aws' },
        account: { type: 'string' },
        region: { type: 'string' },
        profile: { type: 'string' },
      },
    },
    {
      type: 'object',
      required: ['provider', 'project', 'region'],
      properties: {
        provider: { const: 'gcp' },
        project: { type: 'string' },
        region: { type: 'string' },
      },
    },
    {
      type: 'object',
      required: ['provider', 'access_key_id', 'access_key_secret', 'region'],
      properties: {
        provider: { const: 'aliyun' },
        access_key_id: { type: 'string' },
        access_key_secret: { type: 'string' },
        region: { type: 'string' },
        resource_group: { type: 'string' },
      },
    },
    {
      type: 'object',
      required: ['provider', 'host'],
      properties: {
        provider: { const: 'on-prem' },
        host: { type: 'string' },
        region: { type: 'string' },
      },
    },
  ],
}

const ENV_SCHEMA = {
  type: 'object',
  required: ['name', 'cloud', 'safety'],
  properties: {
    name: { type: 'string', minLength: 1 },
    tags: { type: 'array', items: { type: 'string' } },
    description: { type: 'string' },
    extends: { type: 'string' },
    cloud: CLOUD_SCHEMA,
    database: { type: 'object' },
    storage: { type: 'object' },
    deploy: DEPLOY_SCHEMA,
    safety: SAFETY_SCHEMA,
    lifecycle: { type: 'object' },
  },
}

const ENVIRONMENTS_FILE_SCHEMA = {
  type: 'object',
  required: ['version', 'default', 'environments'],
  properties: {
    version: { const: 2 },
    default: { type: 'string', minLength: 1 },
    environments: {
      type: 'array',
      items: ENV_SCHEMA,
    },
  },
  additionalProperties: false,
}

const INFRA_FILE_SCHEMA = {
  type: 'object',
  required: ['version'],
  properties: {
    version: { const: 2 },
    vars: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['backend'],
        properties: { backend: { type: 'string' } },
      },
    },
    secrets: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['backend'],
        properties: { backend: { type: 'string' } },
      },
    },
    ci_mode: { type: 'object' },
  },
  additionalProperties: false,
}

// Compile validators once
const validateEnvsFile = ajv.compile(ENVIRONMENTS_FILE_SCHEMA)
const validateEnvItem = ajv.compile(ENV_SCHEMA)
const validateInfraFile = ajv.compile(INFRA_FILE_SCHEMA)

// ---------------------------------------------------------------------------
// Credential leak pattern
// ---------------------------------------------------------------------------

/** Regex that matches likely literal credential values. */
const CREDENTIAL_PATTERN =
  /^(?!.*\$\{(?:secret|var):)(?=.{6,})(?:(?:password|passwd|pass|secret|token|key|apikey|api_key|credential|private_key)\b.*|.*(?:hunter2|p@ssw0rd|qwerty|letmein|admin123).*)$/i

/** Check all string leaves of an object for likely literal credentials. */
function scanForLiteralCredentials(
  obj: unknown,
  basePath: string,
  issues: ValidationIssue[],
): void {
  if (typeof obj === 'string') {
    if (CREDENTIAL_PATTERN.test(obj)) {
      issues.push({
        kind: 'schema-violation',
        path: basePath,
        message: `Potential literal credential detected at "${basePath}". Use \${secret:KEY} references instead.`,
        severity: 'error',
      })
    }
    return
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      scanForLiteralCredentials(obj[i], `${basePath}[${i}]`, issues)
    }
    return
  }
  if (obj !== null && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const childPath = basePath ? `${basePath}.${key}` : key
      // Scan string values for credential patterns based on the key name
      if (typeof val === 'string') {
        const lkey = key.toLowerCase()
        const isCredentialKey =
          lkey === 'password' ||
          lkey === 'passwd' ||
          lkey === 'pass' ||
          lkey === 'secret' ||
          lkey === 'token' ||
          lkey === 'api_key' ||
          lkey === 'apikey' ||
          lkey === 'private_key' ||
          lkey === 'credential'

        if (isCredentialKey && !val.startsWith('${')) {
          issues.push({
            kind: 'schema-violation',
            path: childPath,
            message: `Potential literal credential at "${childPath}". Use \${secret:KEY} references instead.`,
            severity: 'error',
          })
        }
      } else {
        scanForLiteralCredentials(val, childPath, issues)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Error → ValidationIssue conversion
// ---------------------------------------------------------------------------

function ajvErrorsToIssues(errors: ErrorObject[]): ValidationIssue[] {
  return errors.map(err => ({
    kind: 'schema-violation' as const,
    path: err.instancePath || err.schemaPath,
    message: `${err.instancePath || 'root'}: ${err.message ?? 'validation failed'}`,
    severity: 'error' as const,
  }))
}

// ---------------------------------------------------------------------------
// Business-rule warnings for a single Env
// ---------------------------------------------------------------------------

function businessRuleWarnings(env: Record<string, unknown>, nameOverride?: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const name = (nameOverride ?? (env['name'] as string | undefined)) || '<unknown>'

  // Warning: no description
  if (!env['description']) {
    issues.push({
      kind: 'schema-violation',
      path: `environments[${name}].description`,
      message: `Env "${name}" has no description.`,
      severity: 'warning',
    })
  }

  // Warning: production tag without audit_log
  const tags = env['tags']
  const safety = env['safety'] as Record<string, unknown> | undefined
  if (Array.isArray(tags) && tags.includes('production')) {
    if (!safety?.['audit_log']) {
      issues.push({
        kind: 'schema-violation',
        path: `environments[${name}].safety.audit_log`,
        message: `Env "${name}" is tagged production but has no audit_log set.`,
        severity: 'warning',
      })
    }
    // ★ Reviewer D2 fix: production tag with deploy.tested=false → ERROR.
    // Spec §15.5.7 + §1.5.1: untested deployment skill is forbidden in production.
    const deploy = env['deploy'] as Record<string, unknown> | undefined
    if (deploy && deploy['tested'] === false) {
      issues.push({
        kind: 'production-untested-skill',
        path: `environments[${name}].deploy.tested`,
        message:
          `Env "${name}" is tagged production but deploy.tested = false. ` +
          `Untested deployment skills cannot be bound to production-tagged environments.`,
        severity: 'error',
      })
    }
  }

  // Warning: extends self
  if (typeof env['extends'] === 'string' && env['extends'] === name) {
    issues.push({
      kind: 'circular-extends',
      path: `environments[${name}].extends`,
      message: `Env "${name}" extends itself — circular reference hint.`,
      severity: 'warning',
    })
  }

  return issues
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a fully-resolved environments.yaml object (post-extends).
 */
export function validateEnvironments(file: unknown): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  const valid = validateEnvsFile(file)
  if (!valid && validateEnvsFile.errors) {
    errors.push(...ajvErrorsToIssues(validateEnvsFile.errors))
  }

  // Business rules on each env
  if (
    file !== null &&
    typeof file === 'object' &&
    Array.isArray((file as Record<string, unknown>)['environments'])
  ) {
    const envs = (file as Record<string, unknown>)['environments'] as unknown[]
    for (const env of envs) {
      if (env !== null && typeof env === 'object') {
        const envObj = env as Record<string, unknown>
        // businessRuleWarnings now returns mixed severities (warnings + errors
        // for production-untested-skill); split by severity.
        for (const issue of businessRuleWarnings(envObj)) {
          if (issue.severity === 'error') errors.push(issue)
          else warnings.push(issue)
        }
        // Credential scan
        scanForLiteralCredentials(envObj, `environments[${String(envObj['name'] ?? '')}]`, errors)
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings }
  }
  return { ok: true, warnings }
}

/**
 * Validate a single env object (used after set / edit / clone).
 */
export function validateEnv(env: unknown, name: string): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  const valid = validateEnvItem(env)
  if (!valid && validateEnvItem.errors) {
    errors.push(...ajvErrorsToIssues(validateEnvItem.errors))
  }

  if (env !== null && typeof env === 'object') {
    const envObj = env as Record<string, unknown>
    for (const issue of businessRuleWarnings(envObj, name)) {
      if (issue.severity === 'error') errors.push(issue)
      else warnings.push(issue)
    }
    scanForLiteralCredentials(envObj, `env[${name}]`, errors)
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings }
  }
  return { ok: true, warnings }
}

/**
 * Validate an infra.yaml object.
 */
export function validateInfra(file: unknown): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  const valid = validateInfraFile(file)
  if (!valid && validateInfraFile.errors) {
    errors.push(...ajvErrorsToIssues(validateInfraFile.errors))
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings }
  }
  return { ok: true, warnings }
}
