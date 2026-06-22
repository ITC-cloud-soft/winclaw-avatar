/**
 * /env clone — builds a Transaction for cloning an existing environment.
 *
 * §15.5 of INFRA_ENVIRONMENT_DESIGN.v2.2.md
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { CloneInput, Transaction, TransactionSnapshot, ValidationIssue } from './types.js'
import { OperationError } from './types.js'
import { loadEnvironments } from '../loader.js'
import {
  parseEnvDocument,
  stringifyEnvDocument,
  cloneEnv,
  patchEnv,
  findEnvBlock,
  diffYaml,
} from './astEditor.js'
import { validateEnvironments } from './schemaValidator.js'
import YAML from 'yaml'

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
// buildCloneTransaction
// ---------------------------------------------------------------------------

export async function buildCloneTransaction(
  input: CloneInput,
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

  // 2. Verify source exists
  const sourceEnv = file.environments.find(e => e.name === input.source)
  if (!sourceEnv) {
    throw new OperationError(
      `Source environment "${input.source}" does not exist.`,
      'validation-failed',
      [
        {
          kind: 'unknown-env',
          path: `environments[${input.source}]`,
          message: `Source environment "${input.source}" does not exist.`,
          severity: 'error',
        },
      ],
    )
  }

  // 3. Verify destination does NOT exist
  const destExists = file.environments.find(e => e.name === input.destination)
  if (destExists) {
    throw new OperationError(
      `Destination environment "${input.destination}" already exists.`,
      'validation-failed',
      [
        {
          kind: 'duplicate-name',
          path: `environments[${input.destination}]`,
          message: `Destination environment "${input.destination}" already exists.`,
          severity: 'error',
        },
      ],
    )
  }

  // 4. Clone via AST editor
  cloneEnv(doc, input.source, input.destination)

  // 5. Apply overrides on the new env if provided
  if (input.overrides && Object.keys(input.overrides).length > 0) {
    patchEnv(doc, input.destination, input.overrides)
  }

  const afterYaml = stringifyEnvDocument(doc)

  // 6. Validate
  // Build the expected cloned env for schema validation
  const clonedEnv = {
    ...sourceEnv,
    name: input.destination,
    ...(input.overrides ?? {}),
  }
  const fileValidation = validateEnvironments({
    version: 2,
    default: file.default,
    environments: [...file.environments, clonedEnv],
  })
  if (!fileValidation.ok) {
    errors.push(...fileValidation.errors)
  }
  warnings.push(...(fileValidation.warnings ?? []))

  // 7. Diff + Transaction
  const yamlDiff = diffYaml(beforeYaml, afterYaml)

  const validation =
    errors.length > 0
      ? { ok: false as const, errors, warnings }
      : { ok: true as const, warnings }

  return {
    id: randomUUID(),
    operation: 'clone',
    targets: [input.source, input.destination],
    yamlDiff,
    secretActions: [],
    validation,
    newEnvironmentsYaml: afterYaml,
    snapshot,
  }
}
