/**
 * Public programmatic API for /harness lint.
 *
 * Called by /harness gate (Agent D) when a check of type 'harness-lint' runs.
 *
 * Usage:
 *   import { harnessLint } from './lint.js'
 *   const result = await harnessLint('/path/to/workspace')
 */

import type { LintResult } from './types.js'
import { type LintOptions, runLint } from './lintEngine.js'

/**
 * Run all programmatic harness rules against the workspace and return a
 * LintResult. Partial LintOptions can be supplied to restrict rules, globs,
 * or enable strict mode.
 */
export async function harnessLint(
  workspacePath: string,
  options?: Partial<LintOptions>,
): Promise<LintResult> {
  return runLint({ workspacePath, ...options })
}
