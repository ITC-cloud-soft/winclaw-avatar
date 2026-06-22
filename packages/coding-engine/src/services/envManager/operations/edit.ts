/**
 * /env edit — builds a Transaction for modifying an existing environment.
 *
 * §15.5 of INFRA_ENVIRONMENT_DESIGN.v2.2.md
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { EditInput, Transaction, TransactionSnapshot, ValidationIssue } from './types.js'
import { OperationError } from './types.js'
import { loadEnvironments } from '../loader.js'
import {
  parseEnvDocument,
  stringifyEnvDocument,
  patchEnv,
  findEnvBlock,
  diffYaml,
} from './astEditor.js'
import { validateEnvironments } from './schemaValidator.js'
import { getCascadeImpact, analyseDependencies } from './dependencyChecker.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function envFilePath(workspacePath: string): string {
  return path.join(workspacePath, '.metacoder', 'environments.yaml')
}

function readEnvFileRaw(workspacePath: string): string {
  return fs.readFileSync(envFilePath(workspacePath), 'utf8')
}

// ---------------------------------------------------------------------------
// buildEditTransaction
// ---------------------------------------------------------------------------

export async function buildEditTransaction(
  input: EditInput,
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

  // 2. Find env by name
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

  // 3. Apply patch via AST editor
  patchEnv(doc, input.name, input.patch)
  const afterYaml = stringifyEnvDocument(doc)

  // 4. Re-validate
  // Build the patched file object for schema validation
  const patchedEnvs = file.environments.map(e =>
    e.name === input.name ? { ...e, ...input.patch } : e,
  )
  const patchedFile = { version: 2 as const, default: file.default, environments: patchedEnvs }
  const fileValidation = validateEnvironments(patchedFile)
  if (!fileValidation.ok) {
    errors.push(...fileValidation.errors)
  }
  warnings.push(...(fileValidation.warnings ?? []))

  // 5. Production-edit warning
  const tags = existing.tags ?? []
  if (tags.includes('production')) {
    const reason = (input as EditInput & { reason?: string }).reason
    if (!reason) {
      warnings.push({
        kind: 'production-edit-without-reason',
        path: `environments[${input.name}]`,
        message: `Editing production environment "${input.name}" without a reason. Consider providing a reason.`,
        severity: 'warning',
      })
    }
  }

  // 6. Cascade impact
  const changedPaths = Object.keys(input.patch)
  const cascadeEnvs = getCascadeImpact(input.name, changedPaths, file)
  const dependencyImpact = analyseDependencies(input.name, file)

  if (cascadeEnvs.length > 0) {
    warnings.push({
      kind: 'cascade-warning',
      path: `environments[${input.name}]`,
      message: `Editing "${input.name}" will cascade to: ${cascadeEnvs.join(', ')}`,
      severity: 'warning',
    })
  }

  // 7. Diff
  const yamlDiff = diffYaml(beforeYaml, afterYaml)

  const validation =
    errors.length > 0
      ? { ok: false as const, errors, warnings }
      : { ok: true as const, warnings }

  return {
    id: randomUUID(),
    operation: 'edit',
    targets: [input.name],
    yamlDiff,
    secretActions: [],
    validation,
    dependencyImpact,
    newEnvironmentsYaml: afterYaml,
    snapshot,
  }
}
