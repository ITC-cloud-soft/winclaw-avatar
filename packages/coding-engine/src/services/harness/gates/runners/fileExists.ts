/**
 * fileExists runner — checks that a file path exists within the workspace.
 *
 * GateCheck type: 'file-exists'
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { GateCheck, CheckResult } from '../../types.js'

export async function runFileExists(
  check: GateCheck,
  workspacePath: string,
): Promise<CheckResult> {
  // Type narrow
  if (check.type !== 'file-exists') {
    return {
      type: 'file-exists',
      passed: false,
      durationMs: 0,
      error: `runFileExists invoked with wrong check type: ${(check as GateCheck).type}`,
    }
  }

  const start = Date.now()
  const absPath = path.isAbsolute(check.path)
    ? check.path
    : path.join(workspacePath, check.path)

  let passed: boolean
  let output: string

  try {
    await fs.access(absPath)
    passed = true
    output = `File found at ${absPath}`
  } catch {
    passed = false
    output = `Missing: ${check.path}`
  }

  return {
    type: 'file-exists',
    passed,
    durationMs: Date.now() - start,
    output,
  }
}
