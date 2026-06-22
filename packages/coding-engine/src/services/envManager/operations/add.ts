/**
 * /env add — builds a Transaction for adding a new environment.
 *
 * §15.5 of INFRA_ENVIRONMENT_DESIGN.v2.2.md
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Env } from '../types.js'
import type { AddInput, Transaction, TransactionSnapshot, ValidationIssue } from './types.js'
import { OperationError } from './types.js'
import { loadEnvironments } from '../loader.js'
import {
  parseEnvDocument,
  stringifyEnvDocument,
  appendEnv,
  findEnvBlock,
  diffYaml,
} from './astEditor.js'
import { validateEnvironments, validateEnv } from './schemaValidator.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENVIRONMENTS_REL = path.join('.metacoder', 'environments.yaml')

function envFilePath(workspacePath: string): string {
  return path.join(workspacePath, ENVIRONMENTS_REL)
}

function readEnvFileRaw(workspacePath: string): string {
  return fs.readFileSync(envFilePath(workspacePath), 'utf8')
}

// ---------------------------------------------------------------------------
// buildAddTransaction
// ---------------------------------------------------------------------------

export async function buildAddTransaction(
  input: AddInput,
  workspacePath: string,
): Promise<Transaction> {
  // 1. Load + parse
  const file = await loadEnvironments(workspacePath)
  const beforeYaml = readEnvFileRaw(workspacePath)
  const doc = parseEnvDocument(beforeYaml)

  const snapshot: TransactionSnapshot = {
    environmentsYaml: beforeYaml,
    takenAt: new Date().toISOString(),
  }

  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  // 2. Check for duplicate name
  const duplicate = file.environments.find(e => e.name === input.name)
  if (duplicate) {
    errors.push({
      kind: 'duplicate-name',
      path: `environments[${input.name}]`,
      message: `Environment "${input.name}" already exists.`,
      severity: 'error',
    })
  }

  // 3. Verify extends parent exists
  if (input.extends) {
    const parent = file.environments.find(e => e.name === input.extends)
    if (!parent) {
      errors.push({
        kind: 'missing-extends',
        path: `environments[${input.name}].extends`,
        message: `Parent environment "${input.extends}" does not exist.`,
        severity: 'error',
      })
    }
  }

  // Short-circuit on blocking errors — cannot build a valid new YAML
  if (errors.length > 0) {
    throw new OperationError(
      `Cannot add environment "${input.name}": ${errors.map(e => e.message).join('; ')}`,
      'validation-failed',
      errors,
    )
  }

  // 4. Build the new env object with defaults
  const patch = input.patch ?? {}

  // cloud.provider is mandatory — no default
  if (!patch.cloud) {
    throw new OperationError(
      `Cannot add environment "${input.name}": cloud spec is required (no default for cloud.provider).`,
      'invalid-input',
    )
  }

  const newEnv: Partial<Env> & { name: string; cloud: Env['cloud']; safety: Env['safety'] } = {
    name: input.name,
    ...(input.extends ? { extends: input.extends } : {}),
    cloud: patch.cloud,
    safety: patch.safety ?? { destructive_ops: 'confirm' },
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
    ...(patch.database !== undefined ? { database: patch.database } : {}),
    ...(patch.storage !== undefined ? { storage: patch.storage } : {}),
    ...(patch.deploy !== undefined
      ? { deploy: { tested: false, ...patch.deploy } }
      : {}),
    ...(patch.lifecycle !== undefined ? { lifecycle: patch.lifecycle } : {}),
  }

  // 5. Validate the new env alone
  const singleValidation = validateEnv(newEnv, input.name)
  if (!singleValidation.ok) {
    throw new OperationError(
      `New env "${input.name}" fails validation: ${singleValidation.errors.map(e => e.message).join('; ')}`,
      'validation-failed',
      singleValidation.errors,
    )
  }
  warnings.push(...singleValidation.warnings)

  // 6. Append via AST editor
  appendEnv(doc, newEnv)
  const afterYaml = stringifyEnvDocument(doc)

  // 7. Full file validation
  const fileValidation = validateEnvironments(
    { version: 2, default: file.default, environments: [...file.environments, newEnv] },
  )
  if (!fileValidation.ok) {
    errors.push(...fileValidation.errors)
  }
  warnings.push(...(fileValidation.warnings ?? []))

  // 8. Diff
  const yamlDiff = diffYaml(beforeYaml, afterYaml)

  // 9. Build validation result
  const validation =
    errors.length > 0
      ? { ok: false as const, errors, warnings }
      : { ok: true as const, warnings }

  return {
    id: randomUUID(),
    operation: 'add',
    targets: [input.name],
    yamlDiff,
    secretActions: [],
    validation,
    newEnvironmentsYaml: afterYaml,
    snapshot,
  }
}
