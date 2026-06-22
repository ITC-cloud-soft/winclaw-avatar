/**
 * /env set — builds a Transaction for setting a single field in an environment.
 *
 * §15.5 of INFRA_ENVIRONMENT_DESIGN.v2.2.md
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { SetInput, Transaction, TransactionSnapshot, ValidationIssue } from './types.js'
import { OperationError } from './types.js'
import { loadEnvironments } from '../loader.js'
import {
  parseEnvDocument,
  stringifyEnvDocument,
  setField,
  findEnvBlock,
  diffYaml,
} from './astEditor.js'
import { validateEnvironments } from './schemaValidator.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Top-level fields that cannot be changed with /env set. */
const PROTECTED_FIELDS: ReadonlySet<string> = new Set(['name', 'extends', 'tags'])

/**
 * Known path → expected JS typeof value mappings.
 * Partial — only paths that have non-string expectations.
 */
const PATH_TYPE_HINTS: Record<string, 'number' | 'boolean' | 'string'> = {
  'database.primary.port': 'number',
  'database.replicas.*.port': 'number',
  'deploy.tested': 'boolean',
  'deploy.requires_explicit_confirmation': 'boolean',
  'deploy.traffic_percent': 'number',
  'safety.writes_require_approval': 'boolean',
  'safety.writes_two_phase_commit': 'boolean',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function envFilePath(workspacePath: string): string {
  return path.join(workspacePath, '.metacoder', 'environments.yaml')
}

function readEnvFileRaw(workspacePath: string): string {
  return fs.readFileSync(envFilePath(workspacePath), 'utf8')
}

/** Validate that a dot-notation path is well-formed. */
function isValidPath(p: string): boolean {
  if (!p) return false
  if (p.startsWith('.') || p.endsWith('.')) return false
  if (p.includes('..')) return false
  // Allow alphanumeric, underscore, hyphen segments separated by dots
  return /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/.test(p)
}

/** Check the value type against known hints. */
function checkValueType(
  dotPath: string,
  value: unknown,
): 'number' | 'boolean' | 'string' | null {
  // Exact match first
  const hint = PATH_TYPE_HINTS[dotPath]
  if (hint) {
    if (typeof value !== hint) return hint
  }

  // Last segment heuristic for port fields
  const lastSeg = dotPath.split('.').pop() ?? ''
  if (lastSeg === 'port' && typeof value !== 'number') return 'number'
  if (lastSeg === 'tested' && typeof value !== 'boolean') return 'boolean'

  return null
}

// ---------------------------------------------------------------------------
// buildSetTransaction
// ---------------------------------------------------------------------------

export async function buildSetTransaction(
  input: SetInput,
  workspacePath: string,
): Promise<Transaction> {
  // 1. Load environments
  const file = await loadEnvironments(workspacePath)
  const beforeYaml = readEnvFileRaw(workspacePath)
  const doc = parseEnvDocument(beforeYaml)

  const snapshot: TransactionSnapshot = {
    environmentsYaml: beforeYaml,
    takenAt: new Date().toISOString(),
  }

  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  // 2. Verify env exists
  const existing = file.environments.find(e => e.name === input.name)
  if (!existing) {
    throw new OperationError(
      `Unknown environment "${input.name}"`,
      'validation-failed',
      [
        {
          kind: 'unknown-env',
          path: `environments[${input.name}]`,
          message: `Environment "${input.name}" does not exist.`,
          severity: 'error',
        },
      ],
    )
  }

  // 3. Validate path is sane
  if (!isValidPath(input.path)) {
    throw new OperationError(
      `Invalid path "${input.path}"`,
      'invalid-input',
      [
        {
          kind: 'invalid-path',
          path: input.path,
          message: `Path "${input.path}" is invalid. Use dot-notation like "database.primary.port".`,
          severity: 'error',
        },
      ],
    )
  }

  // 4. Check protected fields (top-level segment)
  const topLevelField = input.path.split('.')[0]!
  if (PROTECTED_FIELDS.has(topLevelField)) {
    throw new OperationError(
      `Field "${topLevelField}" is protected`,
      'invalid-input',
      [
        {
          kind: 'protected-field',
          path: input.path,
          message: `Field "${topLevelField}" cannot be changed with /env set. ` +
            `Use the appropriate operation (clone+remove for name, edit for extends/tags).`,
          severity: 'error',
        },
      ],
    )
  }

  // 5. Type-check the value
  const expectedType = checkValueType(input.path, input.value)
  if (expectedType !== null) {
    errors.push({
      kind: 'invalid-value-type',
      path: input.path,
      message:
        `Field "${input.path}" expects a ${expectedType} value, ` +
        `but got ${typeof input.value} (${JSON.stringify(input.value)}).`,
      severity: 'error',
    })
  }

  if (errors.length > 0) {
    throw new OperationError(
      `Set operation failed for "${input.name}.${input.path}": ${errors[0]!.message}`,
      'validation-failed',
      errors,
    )
  }

  // 6. Apply via AST editor
  setField(doc, input.name, input.path, input.value)
  const afterYaml = stringifyEnvDocument(doc)

  // 7. Validate full file
  // Reconstruct patched env for schema validation
  function applyDotPath(obj: Record<string, unknown>, dotPath: string, val: unknown): Record<string, unknown> {
    const segs = dotPath.split('.')
    if (segs.length === 1) {
      return { ...obj, [segs[0]!]: val }
    }
    const [head, ...rest] = segs
    const child = (obj[head!] ?? {}) as Record<string, unknown>
    return { ...obj, [head!]: applyDotPath(child, rest.join('.'), val) }
  }

  const patchedEnv = applyDotPath(existing as unknown as Record<string, unknown>, input.path, input.value)
  const patchedEnvs = file.environments.map(e =>
    e.name === input.name ? patchedEnv : e,
  )
  const fileValidation = validateEnvironments({
    version: 2,
    default: file.default,
    environments: patchedEnvs,
  })
  if (!fileValidation.ok) {
    errors.push(...fileValidation.errors)
  }
  warnings.push(...(fileValidation.warnings ?? []))

  // 8. Diff + Transaction
  const yamlDiff = diffYaml(beforeYaml, afterYaml)

  const validation =
    errors.length > 0
      ? { ok: false as const, errors, warnings }
      : { ok: true as const, warnings }

  return {
    id: randomUUID(),
    operation: 'set',
    targets: [input.name],
    yamlDiff,
    secretActions: [],
    validation,
    newEnvironmentsYaml: afterYaml,
    snapshot,
  }
}
