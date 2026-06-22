/**
 * /env remove — builds a Transaction for removing an environment.
 *
 * §15.5 of INFRA_ENVIRONMENT_DESIGN.v2.2.md
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { RemoveInput, Transaction, TransactionSnapshot, ValidationIssue } from './types.js'
import { OperationError } from './types.js'
import { loadEnvironments } from '../loader.js'
import {
  parseEnvDocument,
  stringifyEnvDocument,
  removeEnv,
  diffYaml,
} from './astEditor.js'
import { validateEnvironments } from './schemaValidator.js'
import { analyseDependencies } from './dependencyChecker.js'

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
// buildRemoveTransaction
// ---------------------------------------------------------------------------

export async function buildRemoveTransaction(
  input: RemoveInput,
  workspacePath: string,
): Promise<Transaction> {
  // 1. Load environments
  const file = await loadEnvironments(workspacePath)
  const beforeYaml = readEnvFileRaw(workspacePath)

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

  // 3. Compute dependency impact
  const dependencyImpact = analyseDependencies(input.name, file)
  const { dependents, recursiveDependents } = dependencyImpact

  // 4. Handle dependents
  let toRemove: string[] = [input.name]

  if (dependents.length > 0) {
    if (input.cascade) {
      // cascade=true: also remove all descendants
      toRemove = [input.name, ...recursiveDependents]
      warnings.push({
        kind: 'cascade-warning',
        path: `environments[${input.name}]`,
        message: `Cascade remove: also removing dependents: ${recursiveDependents.join(', ')}`,
        severity: 'warning',
      })
    } else {
      // Warn but still allow apply — caller decides
      warnings.push({
        kind: 'cascade-warning',
        path: `environments[${input.name}]`,
        message:
          `Removing "${input.name}" will orphan dependent environments: ${dependents.join(', ')}. ` +
          `Use cascade: true to remove them as well.`,
        severity: 'warning',
      })
    }
  }

  // 5. Build the new environments list (remove targeted envs)
  const removeSet = new Set(toRemove)

  // 6. Warn if removing the default env
  if (removeSet.has(file.default)) {
    warnings.push({
      kind: 'cascade-warning',
      path: `environments[${input.name}]`,
      message:
        `Removing "${input.name}" which is the current default environment. ` +
        `Update the "default:" field to another environment before applying.`,
      severity: 'warning',
    })
  }

  // 7. Apply removals via AST editor
  const doc = parseEnvDocument(beforeYaml)
  for (const name of toRemove) {
    removeEnv(doc, name)
  }
  const afterYaml = stringifyEnvDocument(doc)

  // 8. Validate the resulting file
  const remainingEnvs = file.environments.filter(e => !removeSet.has(e.name))

  // Only run full schema validation if there are remaining envs and default still exists
  if (remainingEnvs.length > 0 && !removeSet.has(file.default)) {
    const fileValidation = validateEnvironments({
      version: 2,
      default: file.default,
      environments: remainingEnvs,
    })
    if (!fileValidation.ok) {
      errors.push(...fileValidation.errors)
    }
    warnings.push(...(fileValidation.warnings ?? []))
  }

  // 9. Diff
  const yamlDiff = diffYaml(beforeYaml, afterYaml)

  const validation =
    errors.length > 0
      ? { ok: false as const, errors, warnings }
      : { ok: true as const, warnings }

  return {
    id: randomUUID(),
    operation: 'remove',
    targets: toRemove,
    yamlDiff,
    secretActions: [],
    validation,
    dependencyImpact,
    newEnvironmentsYaml: afterYaml,
    snapshot,
  }
}
